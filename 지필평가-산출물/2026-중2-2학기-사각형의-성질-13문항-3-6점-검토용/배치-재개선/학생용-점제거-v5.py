"""Remove vertex/intersection markers from the approved v4 paper."""
from pathlib import Path
from zipfile import ZipFile
import base64
import json
import sys

from lxml import etree as E

BASE = Path(__file__).resolve().parent
SOURCE = BASE / "학생용-배치조정-v4.hwpx"
TARGET = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else BASE / "학생용-배치조정-v5.hwpx"
HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"
HC = "http://www.hancom.co.kr/hwpml/2011/core"
NS = {"hp": HP, "hc": HC}

sys.path.insert(0, r"C:\Users\pbj95\.codex\skills\hwpx-skill\scripts")
from clone_form import clone


def hwpunit(mm):
    return str(round(mm * 7200 / 25.4))


if TARGET.exists():
    raise FileExistsError(f"출력 파일이 이미 있습니다: {TARGET}")
clone(str(SOURCE), str(TARGET), replacements={})
with ZipFile(TARGET) as archive:
    entries = [(entry, archive.read(entry.filename)) for entry in archive.infolist()]
files = {entry.filename: data for entry, data in entries}
section = E.fromstring(files["Contents/section0.xml"])

exports = {
    14: BASE / "MathGraph" / "01-점없음-v2.json",
    19: BASE / "MathGraph" / "02-점없음-v2.json",
    24: BASE / "MathGraph" / "03-점없음-v2.json",
    55: BASE / "MathGraph" / "09-점없음-v2.json",
    66: BASE / "MathGraph" / "E2-점없음-v2.json",
    89: BASE / "MathGraph" / "E4-점없음-v2.json",
}
for paragraph, export_path in exports.items():
    picture = section[paragraph].find(".//hp:pic", NS)
    ref = picture.find("hc:img", NS).get("binaryItemIDRef")
    binary_path = next(name for name in files if name.startswith("BinData/") and Path(name).stem == ref)
    export = json.loads(export_path.read_text(encoding="utf-8"))
    files[binary_path] = base64.b64decode(export["diagram"]["png"].split(",", 1)[1])

positions_mm = {
    "(x+10)^{circ}": (31.0, 37.0),
    "(3x+20)^{circ}": (44.9, 45.8),
}
found = set()
for box in section[66].findall("./hp:run/hp:rect", NS):
    script = box.findtext(".//hp:script", "", NS)
    if script not in positions_mm:
        continue
    x, y = positions_mm[script]
    pos = box.find("hp:pos", NS)
    pos.set("horzOffset", hwpunit(x))
    pos.set("vertOffset", hwpunit(y))
    found.add(script)
if found != set(positions_mm):
    raise RuntimeError("논술형 2의 각도식 두 개를 모두 찾지 못했습니다.")

files["Contents/section0.xml"] = E.tostring(section, encoding="UTF-8", xml_declaration=True)
with ZipFile(TARGET, "w") as archive:
    for entry, _ in entries:
        archive.writestr(entry, files[entry.filename])
print(TARGET)
