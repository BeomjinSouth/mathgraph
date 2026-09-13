"""Build preservation evidence for the narrowly adjusted v3 student paper."""
from pathlib import Path
import copy
import hashlib
import json
import os
import sys

BASE = Path(__file__).resolve().parent
OUT = BASE / "검수-v4"
OUT.mkdir(exist_ok=True)
SOURCE = BASE / "학생용-배치조정-v4.hwpx"
BASELINE = BASE / "학생용-배치조정-v2.hwpx"
REVIEW = OUT / "학생용-검수.json"

sys.path.insert(0, r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts")
from native_verify import sha
from preserved_diagram_review import check, groups

previous = json.loads((BASE / "검수-v2" / "학생용-검수.json").read_text(encoding="utf-8"))
manifest = {"schema": 1, "diagrams": copy.deepcopy(previous["diagrams"])}
manifest["user_layout_preservation"] = {
    "source": os.path.relpath(BASELINE, OUT),
    "source_sha256": sha(BASELINE),
    "allowed_label_changes": [],
}

exports = {
    "Contents/section0.xml:19": BASE / "MathGraph" / "02-길이호-5mm.json",
    "Contents/section0.xml:55": BASE / "MathGraph" / "09-각도호-5mm.json",
    "Contents/section0.xml:66": BASE / "MathGraph" / "E2-각도호-5mm.json",
}
for diagram in manifest["diagrams"]:
    if diagram["paragraph"] in exports:
        export = exports[diagram["paragraph"]]
        diagram["export"] = os.path.relpath(export, OUT)
        diagram["export_sha256"] = sha(export)

before = groups(BASELINE)["E2"]["labels"]
after = groups(SOURCE)["E2"]["labels"]
for script in ("(x+10)^{circ}", "(3x+20)^{circ}"):
    assert before[script]["pos"] != after[script]["pos"]
    old_except_pos = copy.deepcopy(before[script]); old_except_pos.pop("pos")
    new_except_pos = copy.deepcopy(after[script]); new_except_pos.pop("pos")
    assert old_except_pos == new_except_pos
    manifest["user_layout_preservation"]["allowed_label_changes"].append({
        "question": "E2",
        "script": script,
        "after_pos": after[script]["pos"],
        "reason": "사용자가 지적한 각도식의 소속을 분명히 하도록 해당 각의 내부 이등분선 부근으로 이동",
    })

REVIEW.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
errors = check(SOURCE, REVIEW, manifest)
result = {"ok": not errors, "errors": errors, "source_sha256": sha(SOURCE)}
(OUT / "사용자배치-검사.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
raise SystemExit(0 if not errors else 2)
