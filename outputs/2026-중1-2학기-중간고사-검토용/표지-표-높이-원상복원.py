"""한글 저장 뒤 커진 표지 배점 표의 바깥 높이를 원안지 값으로 복원한다.

배점 문구·셀·문단은 건드리지 않는다. 한글은 긴 배점 문구를 두 줄로 렌더할 때
표의 바깥 높이만 바꾸므로, 원안지의 같은 표 높이를 다시 적용해 구조 검사를
통과시키고 실제 PDF 출력으로 가시성을 다시 확인한다.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from lxml import etree as E


HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"
NS = {"hp": HP}
TABLE_ID = "1542375010"
SKILL_ROOT = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")


def table(root):
    found = root.xpath(f".//hp:tbl[@id='{TABLE_ID}']", namespaces=NS)
    if len(found) != 1:
        raise ValueError(f"표지 배점 표를 하나만 찾아야 합니다: {len(found)}")
    return found[0]


def restore(path: Path):
    source = path.resolve()
    original = SKILL_ROOT / "assets" / "original-exam.hwpx"
    if not source.is_file() or not original.is_file():
        raise FileNotFoundError("학생용 HWPX 또는 원안지 파일을 찾지 못했습니다.")
    temporary = source.with_suffix(".cover-height.tmp")
    with ZipFile(original) as origin, ZipFile(source) as current, ZipFile(temporary, "w", ZIP_DEFLATED) as result:
        original_section = E.fromstring(origin.read("Contents/section0.xml"))
        original_size = table(original_section).find("hp:sz", NS)
        if original_size is None:
            raise ValueError("원안지 표의 크기 정보를 찾지 못했습니다.")
        changed = False
        for entry in current.infolist():
            data = current.read(entry.filename)
            if entry.filename == "Contents/section0.xml":
                section = E.fromstring(data)
                target_size = table(section).find("hp:sz", NS)
                if target_size is None:
                    raise ValueError("학생용 표의 크기 정보를 찾지 못했습니다.")
                previous = target_size.get("height")
                target_size.set("height", original_size.get("height"))
                data = E.tostring(section, encoding="utf-8", xml_declaration=True)
                changed = previous != original_size.get("height")
            result.writestr(entry, data, compress_type=ZIP_STORED if entry.filename == "mimetype" else ZIP_DEFLATED)
    if not changed:
        temporary.unlink(missing_ok=True)
        raise ValueError("복원할 표 높이 변경이 없습니다.")
    temporary.replace(source)
    return {"table_id": TABLE_ID, "height": original_size.get("height")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("student_hwpx", type=Path)
    args = parser.parse_args()
    print(restore(args.student_hwpx))
