// Use the real app exporter; never invent cropped-image label coordinates.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const DEFAULT_WIDTH_MM=68.2,DEFAULT_LINE_WIDTH=3;
const STROKE_TYPES=new Set(['point','pointOnLine','pointOnCircle','circleCenterPoint','segment','line','ray','circle','circleThreePoints','ellipse','hyperbola','parabola','intersection','midpoint','parallel','perpendicular','perpendicularBisector','angleBisector','tangentCircle','tangentFunction','function','vector','rightAngleMarker','equalLengthMarker','angleDimension','lengthDimension','arc','polygon','prism','pyramid','numberLine','cylinder','cone','sphere']);
const args=process.argv.slice(2), options={};
for(let i=0;i<args.length;i+=2){
  if(!['--input','--output','--project','--width-mm','--width-reason','--scale'].includes(args[i]) || !args[i+1])throw Error('사용법: --input 도형.json --output 내보내기.json [--width-mm 68.2] [--width-reason 조정이유] [--project MathGraph경로] [--scale 50]');
  options[args[i].slice(2)]=args[i+1];
}
if(!options.input || !options.output)throw Error('입력과 새 출력 경로가 필요합니다.');
const input=path.resolve(options.input), output=path.resolve(options.output);
const project=path.resolve(options.project || 'C:/Users/pbj95/Desktop/mathGraph');
const widthMm=Number(options['width-mm'] || DEFAULT_WIDTH_MM), widthReason=options['width-reason']||'', scale=options.scale===undefined?null:Number(options.scale);
if(!Number.isFinite(widthMm)||widthMm<40||widthMm>160 || (scale!==null && (!Number.isFinite(scale)||scale<=0||scale>1000)))throw Error('그림 폭 또는 화면 배율을 확인하세요.');
if(Math.abs(widthMm-DEFAULT_WIDTH_MM)>1e-9 && !widthReason.trim())throw Error('기본 68.2mm와 다른 폭은 --width-reason으로 조정 이유를 기록하세요.');
const outputs=[output,output.replace(/\.json$/i,'')+'.preview.png',output.replace(/\.json$/i,'')+'.geometry.png'];
for(const name of outputs){try{await fs.access(name);throw Error('출력 파일이 이미 있습니다: '+name);}catch(error){if(error.code!=='ENOENT')throw error;}}
const raw=await fs.readFile(input), payload=JSON.parse(raw.toString('utf8'));
if(!Array.isArray(payload.operations)||!payload.operations.length)throw Error('GraphA operations가 필요합니다.');
for(const operation of payload.operations){
  if(operation?.op==='create'&&STROKE_TYPES.has(operation.type)&&operation.lineWidth===undefined)operation.lineWidth=DEFAULT_LINE_WIDTH;
  if(operation?.op==='create'&&['angleDimension','lengthDimension'].includes(operation.type)&&operation.labelFontSize===undefined)operation.labelFontSize=22;
  if(operation?.op==='create'&&operation.type==='lengthDimension'&&operation.curvature===undefined)operation.curvature=100;
}
const require=createRequire(path.join(project,'package.json'));
const {chromium}=require('playwright');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
  try{
    const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(req.method!=='GET'||route.split(/[\\/]/).some(part=>part.startsWith('.')))throw Error('route');
    const file=path.resolve(project,'.'+(route==='/'?'/index.html':route));
    if(!file.startsWith(project+path.sep)||!types[path.extname(file)])throw Error('path');
    let data=await fs.readFile(file);
    // Reserve a real curve gap including the print stroke radius and AA pixels.
    if(path.basename(file)==='Dimension.js')data=Buffer.from(data.toString().replace('Math.max(5, this.labelFontSize * .4)', 'Math.max(9, this.labelFontSize * .6)'));
    if(path.basename(file)==='DiagramExportLayout.js')data=Buffer.from(data.toString().replace("throw new Error('그림의 글자가 너무 촘촘합니다. 겹친 라벨을 조금 옮긴 뒤 한글에 넣어 주세요.')", "throw new Error('라벨 충돌: '+JSON.stringify({text:label.text,boxWidth,boxHeight,gap,ink:ink.count(expand({x:label.x,y:label.y,width:boxWidth,height:boxHeight},gap))}))"));
    res.setHeader('Content-Type',types[path.extname(file)]);res.end(data);
  }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.app?.canvas?.width>0);
  const result=await page.evaluate(async({payload,widthMm,scale})=>{
    const app=window.app;app.objectManager.clear();
    const validation=app.schemaValidator.parseAndValidate(JSON.stringify(payload));
    if(!validation.valid)throw Error(JSON.stringify(validation.errors));
    const applied=app.patchApplier.apply(payload);if(!applied.success)throw Error(applied.message);
    app.objectManager.updateAll();
    const objects=app.objectManager.getAllObjects();
    if(objects.some(object=>object.valid===false))throw Error('유효하지 않은 도형이 있습니다. 조건과 의존성을 확인하세요.');
    const points=[];
    const add=p=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))points.push(p);};
    for(const object of objects){
      if(typeof object.getPosition==='function')add(object.getPosition());
      else add(object);
      if(typeof object.getCenter==='function'&&typeof object.getRadius==='function'){
        const p=object.getCenter(),r=object.getRadius();
        if(p&&Number.isFinite(r)){add({x:p.x-r,y:p.y-r});add({x:p.x+r,y:p.y+r});}
      }
    }
    if(points.length){
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
      const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
      app.canvas.offset.x=(xmin+xmax)/2;app.canvas.offset.y=(ymin+ymax)/2;
      app.canvas.scale=scale??Math.min((app.canvas.width-160)/Math.max(1,xmax-xmin),(app.canvas.height-160)/Math.max(1,ymax-ymin),45);
    }else{
      if(scale===null)throw Error('유한한 도형 범위를 찾지 못했습니다. 그래프의 화면 배율을 --scale로 지정하세요.');
      app.canvas.scale=scale;app.canvas.offset.x=0;app.canvas.offset.y=0;
    }
    const {captureHwpDiagram}=await import('/js/utils/HwpDiagram.js');
    // Export adapter: older app builds hard-code length strokes to 1px and
    // average wrapped atan2 endpoints when locating angle labels.
    for(const object of objects){
      if(!['lengthDimension','angleDimension'].includes(object.type))continue;
      const render=object.render;
      object.render=function(canvas){
        if(this.type==='angleDimension')this.endAngle=this.startAngle+this.angle;
        const ctx=canvas.ctx,stroke=ctx.stroke,fillRect=ctx.fillRect;
        ctx.fillRect=()=>{}; // Never hide real geometry behind angle-label white boxes.
        ctx.stroke=function(...args){this.lineWidth=object.lineWidth||3;return stroke.apply(this,args);};
        try{return render.call(this,canvas);}finally{ctx.stroke=stroke;ctx.fillRect=fillRect;}
      };
    }
    const diagram=captureHwpDiagram(app,{widthMm,includeAxes:false,includePreview:true});
    const norm=s=>String(s).replace(/\\mathrm|[{}\\^\s]/g,'').replace(/circ/g,'°');
    const remaining=diagram.labels.map(l=>norm(l.text));
    for(const object of objects.filter(o=>['angleDimension','lengthDimension'].includes(o.type)&&o.visible!==false&&o.showValue!==false&&o.customText)){
      const i=remaining.indexOf(norm(object.customText));
      if(i<0)throw Error('주어진 조건 라벨이 실제 내보내기에서 누락되었습니다: '+object.customText);
      remaining.splice(i,1);
    }
    return {diagram,project:objects.map(object=>object.toJSON()),printProfile:{dimensionStroke:'matches-object-lineWidth',angleWrap:'normalized-before-render',allConditionLabelsExported:true}};
  },{payload,widthMm,scale}).catch(async error=>{
    const debug=await page.evaluate(()=>{const c=document.createElement('canvas');window.app.renderSceneToCanvas(c,{scale:1,includeGrid:false,includeAxes:false,includeBackground:true});return c.toDataURL();});
    await fs.mkdir(path.dirname(output),{recursive:true});
    await fs.writeFile(output.replace(/\.json$/i,'')+'.failed.png',Buffer.from(debug.split(',')[1],'base64'));
    throw error;
  });
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  result.source={engine:'MathGraph.captureHwpDiagram',graphA:path.relative(path.dirname(output),input),graphA_sha256:digest(raw),exporter_sha256:digest(await fs.readFile(fileURLToPath(import.meta.url))),hwp_diagram_sha256:digest(await fs.readFile(path.join(project,'js/utils/HwpDiagram.js'))),default_width_mm:DEFAULT_WIDTH_MM,default_line_width:DEFAULT_LINE_WIDTH,width_reason:widthReason};
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.writeFile(output,JSON.stringify(result,null,2));
  await fs.writeFile(outputs[1],Buffer.from(result.diagram.preview.split(',')[1],'base64'));
  await fs.writeFile(outputs[2],Buffer.from(result.diagram.png.split(',')[1],'base64'));
  console.log(JSON.stringify({output,objects:result.project.length,labels:result.diagram.labels.length,widthMm:result.diagram.widthMm,aspect:result.diagram.aspect}));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
