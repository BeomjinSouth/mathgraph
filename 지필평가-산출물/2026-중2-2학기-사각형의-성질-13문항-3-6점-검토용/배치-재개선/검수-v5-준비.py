"""Verify that v5 changes only the six diagram bitmaps and removes point markers."""
from pathlib import Path
import copy
import json
import os
import sys

BASE = Path(__file__).resolve().parent
OUT = BASE / "검수-v5"
OUT.mkdir(exist_ok=True)
SOURCE = BASE / "학생용-배치조정-v5.hwpx"
BASELINE = BASE / "학생용-배치조정-v4.hwpx"
REVIEW = OUT / "학생용-검수.json"

sys.path.insert(0, r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts")
from native_verify import sha
from preserved_diagram_review import check

previous = json.loads((BASE / "검수-v4" / "학생용-검수.json").read_text(encoding="utf-8"))
manifest = {"schema": 1, "diagrams": copy.deepcopy(previous["diagrams"])}
manifest["user_layout_preservation"] = {
    "source": os.path.relpath(BASELINE, OUT),
    "source_sha256": sha(BASELINE),
    "allowed_label_changes": [],
}
exports = {
    "Contents/section0.xml:14": "01-점없음-v2.json",
    "Contents/section0.xml:19": "02-점없음-v2.json",
    "Contents/section0.xml:24": "03-점없음-v2.json",
    "Contents/section0.xml:55": "09-점없음-v2.json",
    "Contents/section0.xml:66": "E2-점없음-v2.json",
    "Contents/section0.xml:89": "E4-점없음-v2.json",
}
for diagram in manifest["diagrams"]:
    export = BASE / "MathGraph" / exports[diagram["paragraph"]]
    diagram["export"] = os.path.relpath(export, OUT)
    diagram["export_sha256"] = sha(export)
    data = json.loads(export.read_text(encoding="utf-8"))
    if data["printProfile"].get("pointMarkers") != "none":
        raise RuntimeError(f"점 표식 제거 기록이 없습니다: {export.name}")
    point_types = {"point", "pointOnObject", "intersection", "midpoint"}
    if any(item.get("pointSize") != 0 for item in data["project"] if item.get("type") in point_types):
        raise RuntimeError(f"점 표식이 남았습니다: {export.name}")

REVIEW.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
errors = check(SOURCE, REVIEW, manifest)
result = {"ok": not errors, "errors": errors, "source_sha256": sha(SOURCE), "point_markers": "none"}
(OUT / "사용자배치-검사.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
raise SystemExit(0 if not errors else 2)
