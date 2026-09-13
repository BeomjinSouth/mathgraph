"""Inspect user-edited labels without changing either source document."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import json,hashlib,subprocess
BASE=Path(__file__).resolve().parent
OLD=BASE.parent/'가독성-개선'
NS={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
NAME='학생용-사각형의-성질-가독성-개선-완성.hwpx'
USER=OLD/'학생용-사각형의-성질-가독성-개선-완성-내가수정한거.hwpx'
gitpath=(OLD/NAME).relative_to(Path.cwd()).as_posix()
before=subprocess.run(['git','show','HEAD:'+gitpath],capture_output=True,check=True).stdout
import io
def inspect(raw):
    with ZipFile(io.BytesIO(raw)) as z:
        root=E.fromstring(z.read('Contents/section0.xml'))
        rows=[]
        for i,p in enumerate(root):
            if p.find('.//hp:pic',NS) is None:continue
            labels=[]
            for box in p.findall('.//hp:rect',NS):
                labels.append({'script':box.findtext('.//hp:script','',NS),'pos':dict(box.find('hp:pos',NS).attrib),'size':dict(box.find('hp:sz',NS).attrib)})
            rows.append({'paragraph':i,'labels':labels,'picture_size':dict(p.find('.//hp:pic/hp:sz',NS).attrib)})
        return rows
original=inspect(before);user=inspect(USER.read_bytes())
changes=[]
for i,(a,b) in enumerate(zip(original,user)):
    for x,y in zip(a['labels'],b['labels']):
        if x!=y:changes.append({'diagram':i+1,'before':x,'user':y})
report={'source':str(USER),'sha256':hashlib.sha256(USER.read_bytes()).hexdigest(),'committed_original_sha256':hashlib.sha256(before).hexdigest(),'diagrams':user,'label_changes':changes}
(BASE/'사용자-수정-비교.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'source':str(USER),'sha256':report['sha256'],'changed_labels':len(changes),'changes':[{'diagram':v['diagram'],'script':v['user']['script'],'x':v['user']['pos']['horzOffset'],'y':v['user']['pos']['vertOffset']} for v in changes]},ensure_ascii=False))
data=json.loads((OLD/'MathGraph/09-내보내기-v6.json').read_text(encoding='utf8'))
print('EXPORT_KEYS',list(data))
print('DIAGRAM_METADATA',json.dumps({k:v for k,v in data['diagram'].items() if k in ('widthMm','aspect')},ensure_ascii=False))
