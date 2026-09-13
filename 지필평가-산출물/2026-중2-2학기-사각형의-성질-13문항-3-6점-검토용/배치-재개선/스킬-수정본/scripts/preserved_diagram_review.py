"""Validate a user's manually positioned diagram without silently reflowing it.

The existing auto-placement clearance is a generator preference, not authority
to undo a user's edit. Existing labels must match the supplied source exactly;
new labels still require ink clearance. Final visual review remains mandatory.
"""
from pathlib import Path
from zipfile import ZipFile
import base64,copy,hashlib,json
from exam_tools import read,styles,NS,STYLE_MC,STYLE_ESSAY
from equations import to_hwp
from geometry_review import review as geometry_review
from native_label_layout import NativeLabelLayout
NS={**NS,'hc':'http://www.hancom.co.kr/hwpml/2011/core'}

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def signed(n):
    n=int(n);return n-2**32 if n>=2**31 else n
def groups(path):
    header,sections=read(path);style_names={s.get('id'):name for name,s in styles(header).items()}
    with ZipFile(path) as z:binaries={Path(n).stem:z.read(n) for n in z.namelist() if n.startswith('BinData/')}
    result={};current=None;counts={'MC':0,'E':0}
    for section,root in sections:
        for index,p in enumerate(root):
            name=style_names.get(p.get('styleIDRef'))
            if name in (STYLE_MC,STYLE_ESSAY):
                prefix='MC' if name==STYLE_MC else 'E';counts[prefix]+=1;current=prefix+str(counts[prefix])
                result[current]={'labels':{},'label_anchors':{},'pictures':[],'paragraph':index}
            if current is None:continue
            item=result[current]
            for box in p.findall('./hp:run/hp:rect',NS):
                equation=box.find('.//hp:equation',NS)
                if equation is None:continue
                script=equation.findtext('hp:script','',NS)
                if script in item['labels']:raise ValueError('같은 문항의 중복 라벨은 명시적으로 구분해야 합니다.')
                item['labels'][script]={'pos':dict(box.find('hp:pos',NS).attrib),'size':dict(box.find('hp:sz',NS).attrib),
                    'equation_size':dict(equation.find('hp:sz',NS).attrib),'baseUnit':equation.get('baseUnit'),
                    'anchor_role':'question' if index==item['paragraph'] else 'diagram'}
                item['label_anchors'][script]=f'{section}:{index}'
            for picture in p.findall('./hp:run/hp:pic',NS):
                ref=picture.find('hc:img',NS).get('binaryItemIDRef')
                item['pictures'].append({'at':f'{section}:{index}','p':p,'size':dict(picture.find('hp:sz',NS).attrib),
                    'binary':binaries[ref]})
    return result

def preserved_label_anchors(source,review_path,manifest):
    spec=manifest['user_layout_preservation'];baseline=(Path(review_path).parent/spec['source']).resolve()
    if digest(baseline)!=spec.get('source_sha256'):return []
    before,after=groups(baseline),groups(source);allowed=[]
    for id,item in after.items():
        if not item['pictures'] or id not in before:continue
        for script,label in item['labels'].items():
            if label['anchor_role']=='question' and label==before[id]['labels'].get(script):
                allowed.append((item['label_anchors'][script],script))
    return allowed

def check(source,review_path,manifest):
    spec=manifest['user_layout_preservation'];baseline=(Path(review_path).parent/spec['source']).resolve()
    if digest(baseline)!=spec.get('source_sha256'):return ['USER_LAYOUT_SOURCE_HASH']
    before,after=groups(baseline),groups(source);errors=[]
    declared={d['paragraph']:d for d in manifest['diagrams']};seen=[]
    for id,item in after.items():
        if not item['pictures']:continue
        old=before.get(id)
        if old is None or len(old['pictures'])!=1 or len(item['pictures'])!=1:
            errors.append('USER_LAYOUT_PICTURE_GROUP: '+id);continue
        pic=item['pictures'][0];seen.append(pic['at']);record=declared.get(pic['at'])
        if record is None:errors.append('USER_LAYOUT_EXPORT_MISSING: '+id);continue
        export=(Path(review_path).parent/record['export']).resolve()
        if digest(export)!=record['export_sha256']:errors.append('DIAGRAM_EXPORT_HASH: '+id)
        data=json.loads(export.read_text(encoding='utf8'));d=data['diagram']
        if pic['binary']!=base64.b64decode(d['png'].split(',')[1]):errors.append('GEOMETRY_BINARY_MISMATCH: '+id)
        if pic['size']!=old['pictures'][0]['size']:errors.append('USER_PICTURE_SIZE_CHANGED: '+id)
        for script,label in old['labels'].items():
            if item['labels'].get(script)!=label:errors.append('USER_LABEL_CHANGED: '+id+' '+script)
        if sorted(item['labels'])!=sorted(to_hwp(l['text']) for l in d['labels']):errors.append('DIAGRAM_LABEL_COVERAGE: '+id)
        # Validate geometry in its actual printed aspect, including a user resize.
        printed=copy.deepcopy(data)
        width,height=int(pic['size']['width']),int(pic['size']['height'])
        # Native sizes are rounded to integral HWPUNITs (about 0.0035mm).
        # Do not turn that documented quantization into a new geometric stretch.
        sy=1 if abs(height-width*d['aspect'])<=2 else (height/width)/d['aspect']
        for obj in printed['project']:
            if obj.get('type')=='point' and isinstance(obj.get('y'),(int,float)):obj['y']*=sy
        errors.extend(e+': '+id for e in geometry_review(printed,record.get('conditions')))
        added=set(item['labels'])-set(old['labels'])
        if added:
            if abs(sy-1)>1e-3:errors.append('NEW_LABEL_ON_STRETCHED_PICTURE: '+id);continue
            layout=NativeLabelLayout(pic['binary'],width*25.4/7200,clearance_mm=.85)
            line=pic['p'].find('./hp:linesegarray/hp:lineseg',NS)
            left=max(0,(int(line.get('horzsize'))-width)/2);factor=layout.width/width
            def rect(label):
                es,sz,pos=label['equation_size'],label['size'],label['pos'];w,h=int(es['width']),int(es['height'])
                x=signed(pos['horzOffset'])+(int(sz['width'])-w)//2-left;y=signed(pos['vertOffset'])+(int(sz['height'])-h)//2
                return (x*factor,y*factor,w*factor,h*factor)
            for script,label in item['labels'].items():
                if script not in added:layout.placed.append(rect(label))
            for script in sorted(added):
                label=item['labels'][script]
                if label['baseUnit'] not in ('1100','1300') or label['anchor_role']!='diagram' or not layout.clear(rect(label)):
                    errors.append('NEW_LABEL_COLLISION_OR_STYLE: '+id+' '+script)
                layout.placed.append(rect(label))
    if sorted(seen)!=sorted(declared):errors.append('DIAGRAM_EVIDENCE_COVERAGE')
    return errors
