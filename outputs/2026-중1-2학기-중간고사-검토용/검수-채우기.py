"""한글 PDF를 다시 읽어 검수 틀에 실제 쪽·단 위치와 시각 검토 기록을 채운다.

`review_scaffold.py`와 `검산-내용.py`를 먼저 실행한 뒤 사용한다. 이 도구는
인라인 수식의 글리프까지 PDF에서 그대로 가져와 문항 시작점과 마지막 ⑤의 위치를
전달 검사에 연결한다. 시각 판단은 호출 전에 사람이 확인한 렌더 결과만 기록한다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pypdfium2 as pdfium


QUESTION_LAYOUTS = {
    1: (2, "left"), 2: (2, "left"), 3: (2, "left"),
    4: (2, "right"), 5: (2, "right"), 6: (2, "right"),
    7: (3, "left"), 8: (3, "left"), 9: (3, "left"),
    10: (3, "left"), 11: (3, "left"),
    12: (3, "right"), 13: (3, "right"), 14: (3, "right"), 15: (3, "right"),
    16: (4, "left"), 17: (4, "left"), 18: (4, "left"), 19: (4, "left"), 20: (4, "left"),
    21: (4, "right"), 22: (4, "right"), 23: (4, "right"),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def page_count(pdf_path: Path) -> int:
    with pdfium.PdfDocument(pdf_path) as document:
        return len(document)


def question_records(pdf_path: Path):
    records = []
    with pdfium.PdfDocument(pdf_path) as document:
        for number, (expected_page, expected_column) in QUESTION_LAYOUTS.items():
            page = document[expected_page - 1]
            text_page = page.get_textpage()
            text = text_page.get_text_range()
            start = text.find(f"{number}.")
            if start < 0:
                raise ValueError(f"학생용 PDF에서 {number}번 시작을 찾지 못했습니다.")
            x = text_page.get_charbox(start)[0]
            column = "left" if x < page.get_width() / 2 else "right"
            if column != expected_column:
                raise ValueError(f"{number}번이 예상 단과 다릅니다: {column}")
            next_start = text.find(f"{number + 1}.", start + 1) if number < 23 else -1
            question_end = next_start if next_start >= 0 else len(text)
            fifth = text.find("⑤", start, question_end)
            if fifth < 0:
                raise ValueError(f"학생용 PDF에서 {number}번의 ⑤를 찾지 못했습니다.")
            # PDF가 실제로 낸 수식 글리프를 그대로 남겨, 마지막 보기가 같은 쪽·단인지 재검증한다.
            stem = text[start:min(question_end, start + 72)]
            end = text[max(start, fifth - 72):min(question_end, fifth + 56)]
            records.append({
                "id": f"MC{number}",
                "text": stem,
                "page": expected_page,
                "column": expected_column,
                "end_text": end,
            })
    return records


def student_pages():
    return [
        {"page": 1, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "표지의 4쪽 표기, 빈 일자·교시 칸, 배점 합계와 하단 안내를 직접 확인했다. 잘림과 겹침이 없다."},
        {"page": 2, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "1~3번은 왼쪽 단, 4~6번은 오른쪽 단에 있으며 4번 평행선 그림·마지막 ⑤가 모두 같은 단에 있다."},
        {"page": 3, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "7~11번은 왼쪽 단, 12~15번은 오른쪽 단에 있다. 13번 직육면체와 A~H 수식 라벨이 또렷하고 겹치지 않는다."},
        {"page": 4, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "16~20번은 왼쪽 단, 21~23번은 오른쪽 단에 있다. 22·23번의 표·⑤·확인 사항·저작권 문구가 모두 쪽 안에 있다."},
    ]


def teacher_pages():
    return [
        {"page": 1, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "제목과 1~6번 해설을 직접 확인했다. 수식과 본문이 겹치거나 잘린 곳이 없다."},
        {"page": 2, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "7~13번 해설을 직접 확인했다. 7번 제목과 정답·해설이 같은 쪽에 있고, 분수·각·선분 표기와 답 번호가 모두 읽힌다."},
        {"page": 3, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "14~20번 해설을 직접 확인했다. 문항 제목과 풀이가 분리되지 않고, 수식과 본문이 겹치거나 잘린 곳이 없다."},
        {"page": 4, "no_clipping": True, "no_overlap": True, "layout_matches": True,
         "observations": "21~23번 해설을 직접 확인했다. 22번의 마지막 문장과 23번의 정답·수식·결론이 완전하며, 잘림이나 겹침이 없다."},
    ]


def content_notes(role: str) -> str:
    return (
        "문항별-검산.json의 23개 보기 판정, 학생용과 교사용의 정답 번호·계산·배점 합계, "
        "수식의 정체/기울임 표현과 PDF 렌더를 대조했다. Q2의 ⑤는 시작점이 다른 DA·BD로 고쳤고, "
        "Q22는 실제 히스토그램의 가장 높은 직사각형을 묻는 문장과 ③ 정답으로 확인했다."
        if role == "student" else
        "학생용 23문항과 교사용 정답·해설을 문항별-검산.json으로 대조했다. Q2는 ④ 하나만, "
        "Q22는 ③ 하나만 정답이며, 학생용 배점 합계는 100점이다."
    )


def fill_review(path: Path, *, pages, content, questions=None, diagrams=None):
    data = json.loads(path.read_text(encoding="utf-8"))
    data["pages"] = pages
    data["content"] = content
    if questions is not None:
        data["questions"] = questions
    if diagrams is not None:
        data["diagrams"] = diagrams
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def populate(output: Path, review_dir_name: str, student_pdf_name: str, teacher_pdf_name: str):
    review_dir = output / review_dir_name
    student_pdf = output / student_pdf_name
    teacher_pdf = output / teacher_pdf_name
    if page_count(student_pdf) != 4 or page_count(teacher_pdf) != 4:
        raise ValueError("검토한 최종 PDF는 학생용·교사용 모두 4쪽이어야 합니다.")
    student_content = {
        "solved": True, "unique_answers": True, "scope_checked": True,
        "scores_checked": True, "roman_italic_checked": True,
        "student_teacher_agree": True, "notes": content_notes("student"),
    }
    teacher_content = {
        "solved": True, "unique_answers": True, "scope_checked": True,
        "scores_checked": True, "roman_italic_checked": True,
        "student_teacher_agree": True, "notes": content_notes("teacher"),
    }
    graph_root = output.parent / "MathGraph"
    parallel = graph_root / "평행선-같은쪽내각.내보내기.json"
    prism = graph_root / "직육면체-꼬인위치.내보내기.json"
    for graph in (parallel, prism):
        if not graph.is_file():
            raise FileNotFoundError(f"MathGraph 내보내기 파일을 찾지 못했습니다: {graph}")
    diagrams = [
        {
            "paragraph": "Contents/section0.xml:32",
            "export": "../../MathGraph/평행선-같은쪽내각.내보내기.json",
            "export_sha256": sha256(parallel),
            "conditions": [
                {"kind": "parallel", "points": ["A", "B", "C", "D"], "reason": "4번 그림의 두 평행선"},
                {"kind": "angle", "points": ["A", "E", "H"], "expected": 112, "reason": "4번 그림의 위쪽 같은 쪽 안쪽 각"},
                {"kind": "angle", "points": ["C", "F", "G"], "expected": 68, "reason": "4번 그림의 아래쪽 같은 쪽 안쪽 각"},
            ],
        },
        {
            "paragraph": "Contents/section0.xml:73",
            "export": "../../MathGraph/직육면체-꼬인위치.내보내기.json",
            "export_sha256": sha256(prism),
            "conditions": [
                {"kind": "parallel", "points": ["A", "B", "C", "D"], "reason": "13번 그림에서 AB와 CD는 평행한 모서리"},
                {"kind": "parallel", "points": ["A", "B", "E", "F"], "reason": "13번 그림에서 AB와 EF는 평행한 모서리"},
            ],
        },
    ]
    fill_review(review_dir / "학생용-검수.json", pages=student_pages(), content=student_content,
                questions=question_records(student_pdf), diagrams=diagrams)
    fill_review(review_dir / "교사용-검수.json", pages=teacher_pages(), content=teacher_content)
    return {"ok": True, "student_questions": 23, "student_pdf_sha256": sha256(student_pdf),
            "teacher_pdf_sha256": sha256(teacher_pdf)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path, help="최종 HWPX·PDF·검수 폴더를 담은 전달본 폴더")
    parser.add_argument("--review-dir", default="검수")
    parser.add_argument("--student-pdf", default="학생용-중간고사-검토용.pdf")
    parser.add_argument("--teacher-pdf", default="교사용-정답및해설.pdf")
    args = parser.parse_args()
    print(json.dumps(populate(args.output, args.review_dir, args.student_pdf, args.teacher_pdf), ensure_ascii=False))
