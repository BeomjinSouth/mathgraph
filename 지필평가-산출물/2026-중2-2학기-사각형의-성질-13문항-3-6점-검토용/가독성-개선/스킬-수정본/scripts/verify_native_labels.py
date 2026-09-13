"""Recheck actual saved HWPX label rectangles against geometry and each other."""
from pathlib import Path
from zipfile import ZipFile
import argparse,base64,hashlib,json,math
from lxml import etree as E
from native_label_layout import NativeLabelLayout
from equations import to_hwp
NS={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
def signed(value):
    n=int(value);return n-2**32 if n>=2**31 else n

def check(source,exports):
    errors=[];details=[]
    with ZipFile(source) as z:
        paragraphs=[p for n in z.namelist() if n.startswith('Contents/section') and n.endswith('.xml') for p in E.fromstring(z.read(n)) if p.find('.//hp:pic',NS) is not None]
        binaries=[z.read(n) for n in z.namelist() if n.startswith('BinData/')]
        if len(paragraphs)!=len(exports):raise ValueError('도형과 내보내기 개수가 다릅니다.')
        for index,(p,path) in enumerate(zip(paragraphs,exports),1):
            data=json.loads(Path(path).read_text(encoding='utf8'));d=data['diagram'];png=base64.b64decode(d['png'].split(',')[1])
            if png not in binaries:errors.append(f'{index}: GEOMETRY_BINARY_MISMATCH')
            layout=NativeLabelLayout(png,d['widthMm'],clearance_mm=.85)
            pic=p.find('.//hp:pic',NS);ps=pic.find('hp:sz',NS);line=p.find('./hp:linesegarray/hp:lineseg',NS)
            picture_left=max(0,(int(line.get('horzsize'))-int(ps.get('width')))/2)
            labels=[]
            for box in p.findall('.//hp:rect',NS):
                equation=box.find('.//hp:equation',NS)
                if equation is None:continue
                es=equation.find('hp:sz',NS);bs=box.find('hp:sz',NS);pos=box.find('hp:pos',NS)
                w,h=int(es.get('width')),int(es.get('height'))
                x=signed(pos.get('horzOffset'))+max(0,(int(bs.get('width'))-w)//2)-picture_left
                y=signed(pos.get('vertOffset'))+max(0,(int(bs.get('height'))-h)//2)
                factor=25.4/7200*layout.px_mm
                rect=(x*factor,y*factor,w*factor,h*factor)
                script=equation.findtext('hp:script','',NS)
                if not layout.clear(rect):errors.append(f'{index}: SAVED_LABEL_COLLISION: {script}')
                layout.placed.append(rect)
                is_point=script.startswith('{rm ') and script.endswith('} it')
                matches=[l for l in d['labels'] if to_hwp(l['text'])==script]
                if len(matches)!=1:errors.append(f'{index}: LABEL_ASSOCIATION: {script}')
                elif math.hypot(x*25.4/7200-matches[0]['x']*d['widthMm'],y*25.4/7200-matches[0]['y']*d['widthMm'])>(7.05 if is_point else 4.05):errors.append(f'{index}: LABEL_TOO_FAR: {script}')
                if int(equation.get('baseUnit'))!=(1300 if is_point else 1100):errors.append(f'{index}: PRINT_FONT: {script}')
                labels.append({'script':script,'pt':int(equation.get('baseUnit'))/100,'x_mm':x*25.4/7200,'y_mm':y*25.4/7200,'width_mm':w*25.4/7200,'height_mm':h*25.4/7200})
            if len(labels)!=len(d['labels']):errors.append(f'{index}: LABEL_COUNT')
            details.append({'diagram':index,'export':str(path),'export_sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'labels':labels})
    return {'ok':not errors,'errors':errors,'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'clearance_mm':.85,'diagrams':details}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--exports',nargs='+',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    r=check(a.source,a.exports);Path(a.output).write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'ok':r['ok'],'errors':r['errors'],'diagrams':len(r['diagrams']),'labels':sum(len(d['labels']) for d in r['diagrams'])},ensure_ascii=False));raise SystemExit(0 if r['ok'] else 2)
