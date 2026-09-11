"""최종 전달 검사를 실행하고 학생용·교사용 JSON 영수증을 함께 남긴다."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SKILL_SCRIPTS = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts")


def run(output: Path, review_dir_name: str, student_pdf_name: str, student_native_name: str,
        teacher_pdf_name: str, teacher_native_name: str):
    if not SKILL_SCRIPTS.is_dir():
        raise FileNotFoundError(f"전달 검사 스크립트를 찾지 못했습니다: {SKILL_SCRIPTS}")
    sys.path.insert(0, str(SKILL_SCRIPTS))
    from delivery_check import check

    review_dir = output / review_dir_name
    student = check(
        output / "학생용-중간고사-검토용.hwpx",
        output / student_pdf_name,
        output / student_native_name,
        review_dir / "학생용-검수.json",
        role="student", mc=23, essay=0, points=100,
        diagrams=("Contents/section0.xml:32", "Contents/section0.xml:73"),
    )
    teacher = check(
        output / "교사용-정답및해설.hwpx",
        output / teacher_pdf_name,
        output / teacher_native_name,
        review_dir / "교사용-검수.json",
        role="teacher",
    )
    for name, result in (("최종-전달검사-학생용.json", student), ("최종-전달검사-교사용.json", teacher)):
        (review_dir / name).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"student": student, "teacher": teacher}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--review-dir", default="검수")
    parser.add_argument("--student-pdf", default="학생용-중간고사-검토용.pdf")
    parser.add_argument("--student-native", default="학생용-한글검증.json")
    parser.add_argument("--teacher-pdf", default="교사용-정답및해설.pdf")
    parser.add_argument("--teacher-native", default="교사용-한글검증.json")
    args = parser.parse_args()
    results = run(args.output, args.review_dir, args.student_pdf, args.student_native,
                  args.teacher_pdf, args.teacher_native)
    print(json.dumps({key: {"ok": value["ok"], "errors": value["errors"]} for key, value in results.items()}, ensure_ascii=False))
    raise SystemExit(0 if all(result["ok"] for result in results.values()) else 2)
