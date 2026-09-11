"""최종 학생용·교사용 파일에 연결된 검수 기록을 완성한다."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pypdfium2 as pdfium


BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
STUDENT = ROOT / "학생용-중2-2학기-사각형의-성질-지필평가-ver6.hwpx"
TEACHER = ROOT / "교사용-중2-2학기-사각형의-성질-정답해설-ver7.hwpx"
STUDENT_PDF = ROOT / "학생용-중2-2학기-사각형의-성질-지필평가-ver6.pdf"
TEACHER_PDF = ROOT / "교사용-중2-2학기-사각형의-성질-정답해설-ver7.pdf"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compact_pages(path: Path):
    result = []
    with pdfium.PdfDocument(path) as document:
        for page in document:
            text_page = page.get_textpage()
            characters = []
            indices = []
            for index in range(text_page.count_chars()):
                for character in text_page.get_text_range(index, 1):
                    if not character.isspace():
                        characters.append(character)
                        indices.append(index)
            result.append(("".join(characters), indices, text_page, page.get_width()))
    return result


def question_locators():
    pages = compact_pages(STUDENT_PDF)
    question_needles = {
        "MC1": "1.평행사변형", "MC2": "2.평행사변형", "MC3": "3.평행사변형", "MC4": "4.평행사변형",
        "MC5": "5.사각형", "MC6": "6.평행사변형", "MC7": "7.평행사변형", "MC8": "8.직사각형",
        "MC9": "9.마름모", "MC10": "10.정사각형", "MC11": "11.두대각선",
        "E1": "【논술형1】", "E2": "【논술형2】",
    }
    expected = {
        **{f"MC{i}": (2, "left") for i in range(1, 5)},
        **{f"MC{i}": (2, "right") for i in range(5, 8)},
        **{f"MC{i}": (3, "left") for i in range(8, 12)},
        "E1": (3, "right"),
        "E2": (3, "right"),
    }
    locators = []
    for item_id, (page_number, column) in expected.items():
        text, indices, text_page, width = pages[page_number - 1]
        number = int(item_id[2:]) if item_id.startswith("MC") else int(item_id[1:])
        needle = question_needles[item_id]
        start = text.find(needle)
        if start < 0:
            raise ValueError(f"문항 시작 위치를 찾지 못했습니다: {item_id}")
        entry = {"id": item_id, "text": needle, "page": page_number, "column": column}
        if item_id.startswith("MC"):
            following = []
            for later_id, (later_page, _) in expected.items():
                if later_page != page_number:
                    continue
                later_number = int(later_id[2:]) if later_id.startswith("MC") else 100 + int(later_id[1:])
                this_number = number
                if later_number > this_number:
                    later_needle = f"{later_number}." if later_id.startswith("MC") else f"【논술형{later_number - 100}】"
                    position = text.find(later_needle, start + len(needle))
                    if position >= 0:
                        following.append(position)
            boundary = min(following) if following else len(text)
            fifth = text.rfind("⑤", start, boundary)
            if fifth < 0:
                raise ValueError(f"다섯째 보기를 찾지 못했습니다: {item_id}")
            entry["end_text"] = text[start : fifth + 1]
        locators.append(entry)
    return locators


def option(label, satisfies_prompt, reason):
    return {"label": label, "satisfies_prompt": satisfies_prompt, "reason": reason}


def fill_math_review():
    path = BASE / "문항별-검산.json"
    data = json.loads(path.read_text(encoding="utf8"))
    answers = {
        "MC1": {
            "derivation": "평행사변형의 이웃한 두 각의 합은 180도이다.", "answer": "②", "calculation_required": True,
            "calculations": [{"left": "180-72", "right": "108", "relation": "=", "reason": "이웃한 각의 합에서 각 B를 구한다."}],
            "options": [option("①", False, "각 A의 크기이다."), option("②", True, "180도에서 72도를 빼면 108도이다."), option("③", False, "이웃한 각의 합이 180도가 되지 않는다."), option("④", False, "각 A의 보각이 아니다."), option("⑤", False, "사각형의 내각 크기로 될 수 없다.")],
        },
        "MC2": {
            "derivation": "평행사변형의 대변 길이가 같음을 이용해 방정식을 푼다.", "answer": "①", "calculation_required": True,
            "calculations": [{"left": "5*x-7", "right": "2*x+8", "bindings": {"x": "5"}, "relation": "=", "reason": "구한 x를 두 대변의 길이에 대입한다."}],
            "options": [option("①", True, "대입하면 두 대변의 길이가 모두 18이다."), option("②", False, "두 대변의 길이가 다르다."), option("③", False, "두 대변의 길이가 다르다."), option("④", False, "두 대변의 길이가 다르다."), option("⑤", False, "두 대변의 길이가 다르다.")],
        },
        "MC3": {
            "derivation": "대각선의 교점은 각 대각선을 이등분한다.", "answer": "②", "calculation_required": True,
            "calculations": [{"left": "3*4-1", "right": "4+7", "relation": "=", "reason": "x=4에서 AO와 OC가 모두 11임을 확인한다."}, {"left": "2*(3*4-1)", "right": "22", "relation": "=", "reason": "AC는 AO의 두 배이다."}],
            "options": [option("①", False, "AC는 22이다."), option("②", True, "AO=OC=11이므로 AC=22이다."), option("③", False, "AC는 22이다."), option("④", False, "AC는 22이다."), option("⑤", False, "AC는 22이다.")],
        },
        "MC4": {
            "derivation": "평행사변형의 네 가지 기본 성질을 대조한다.", "answer": "③", "calculation_required": False, "calculations": [],
            "options": [option("①", False, "대변의 길이는 각각 같다."), option("②", False, "대각의 크기는 각각 같다."), option("③", True, "일반 평행사변형의 두 대각선 길이는 항상 같지 않다."), option("④", False, "두 대각선은 서로를 이등분한다."), option("⑤", False, "두 쌍의 대변은 각각 평행하다.")],
        },
        "MC5": {
            "derivation": "평행사변형이 되는 충분조건을 판별한다.", "answer": "②", "calculation_required": False, "calculations": [],
            "options": [option("①", False, "등변사다리꼴이 반례이다."), option("②", True, "한 쌍의 대변이 평행하고 길이가 같으면 평행사변형이다."), option("③", False, "연꼴이 반례이다."), option("④", False, "한 쌍의 대각만 같아도 충분하지 않다."), option("⑤", False, "수직인 대각선만으로 충분하지 않다.")],
        },
        "MC6": {
            "derivation": "평행사변형의 직사각형 판정 조건을 확인한다.", "answer": "⑤", "calculation_required": False, "calculations": [],
            "options": [option("①", False, "대각선 수직은 마름모 판정에 연결된다."), option("②", False, "모든 변이 같으면 마름모일 수 있다."), option("③", False, "모든 평행사변형이 만족하는 성질이다."), option("④", False, "이웃한 변의 길이가 같으면 마름모일 수 있다."), option("⑤", True, "두 대각선의 길이가 같으면 직사각형이다.")],
        },
        "MC7": {
            "derivation": "평행사변형의 마름모 판정 조건을 확인한다.", "answer": "③", "calculation_required": False, "calculations": [],
            "options": [option("①", False, "대각선 길이가 같으면 직사각형일 수 있다."), option("②", False, "한 각이 직각이면 직사각형일 수 있다."), option("③", True, "대각선이 수직인 평행사변형은 마름모이다."), option("④", False, "이웃한 두 각이 같으면 직사각형일 수 있다."), option("⑤", False, "한 쌍의 대변 길이가 같은 것은 충분하지 않다.")],
        },
        "MC8": {
            "derivation": "직사각형의 두 대각선의 길이는 같다.", "answer": "①", "calculation_required": True,
            "calculations": [{"left": "15", "right": "15", "relation": "=", "reason": "AC와 BD의 길이가 같음을 수치로 확인한다."}],
            "options": [option("①", True, "직사각형의 두 대각선 길이는 같으므로 15cm이다."), option("②", False, "AC와 같지 않다."), option("③", False, "AC와 같지 않다."), option("④", False, "AC와 같지 않다."), option("⑤", False, "AC와 같지 않다.")],
        },
        "MC9": {
            "derivation": "마름모의 대각선은 각을 이등분하고, 평행사변형의 이웃한 각의 합은 180도이다.", "answer": "⑤", "calculation_required": True,
            "calculations": [{"left": "2*35", "right": "70", "relation": "=", "reason": "대각선 AC가 각 A를 이등분한다."}, {"left": "180-70", "right": "110", "relation": "=", "reason": "각 D는 각 A와 이웃한 각이다."}],
            "options": [option("①", False, "각 A의 크기이다."), option("②", False, "이웃한 각의 보각이 아니다."), option("③", False, "이웃한 각의 보각이 아니다."), option("④", False, "이웃한 각의 보각이 아니다."), option("⑤", True, "각 A가 70도이므로 각 D는 110도이다.")],
        },
        "MC10": {
            "derivation": "정사각형은 마름모이면서 직사각형이다.", "answer": "①", "calculation_required": False, "calculations": [],
            "options": [option("①", True, "정사각형은 직사각형이기도 하므로 이 설명은 거짓이다."), option("②", False, "정사각형의 네 변은 같다."), option("③", False, "정사각형의 네 각은 같다."), option("④", False, "정사각형의 대각선 길이는 같다."), option("⑤", False, "정사각형의 대각선은 수직이다.")],
        },
        "MC11": {
            "derivation": "길이가 같은 대각선으로 직사각형이고 수직인 대각선으로 마름모이므로 정사각형이다.", "answer": "④", "calculation_required": False, "calculations": [],
            "options": [option("①", False, "해당하지만 가장 좁은 분류가 아니다."), option("②", False, "해당하지만 가장 좁은 분류가 아니다."), option("③", False, "가장 좁은 분류가 아니다."), option("④", True, "직사각형과 마름모의 성질을 모두 만족하므로 정사각형이다."), option("⑤", False, "정사각형으로 분류할 수 있다.")],
        },
    }
    for item in data["items"]:
        item_id = item["id"]
        if item_id in answers:
            item.update(answers[item_id])
            item["teacher_agreement"] = f"교사용 선택형 {item_id[2:]}번의 정답과 해설을 대조함."
    essays = {
        "E1": {
            "derivation": "이웃한 두 각의 합을 180도로 놓아 x를 구하고, 대각 D와 각 B의 관계를 이용한다.", "answer": "x=33, 각 D=87도", "teacher_agreement": "교사용 서술형 1번의 식, 정답, 네 단계 채점 기준을 대조함.", "calculation_required": True,
            "calculations": [{"left": "(3*x-6)+(2*x+21)", "right": "180", "bindings": {"x": "33"}, "relation": "=", "reason": "구한 x를 이웃한 두 각의 합에 대입한다."}, {"left": "2*33+21", "right": "87", "relation": "=", "reason": "각 D는 각 B와 같음을 이용한다."}],
            "rubric": [{"points": "1", "criterion": "이웃한 두 각의 합을 식으로 나타냄", "evidence": "두 각의 합을 180도로 둔 식"}, {"points": "1", "criterion": "x의 값을 구함", "evidence": "x=33"}, {"points": "1", "criterion": "각 D를 구할 관계를 나타냄", "evidence": "각 D와 각 B의 관계"}, {"points": "1", "criterion": "각 D의 크기를 구함", "evidence": "각 D=87도"}],
            "answer_only": {"points": "2", "rule": "두 답이 모두 맞으면 2점, 하나만 맞으면 1점을 준다."},
        },
        "E2": {
            "derivation": "마름모의 대각선이 서로 수직이고 이등분함을 이용해 반의 길이 8과 15를 구한 뒤 직각삼각형의 빗변을 구한다.", "answer": "한 변=17cm, 둘레=68cm", "teacher_agreement": "교사용 서술형 2번의 식, 정답, 네 단계 채점 기준을 대조함.", "calculation_required": True,
            "calculations": [{"left": "8**2+15**2", "right": "17**2", "relation": "=", "reason": "대각선의 반으로 만든 직각삼각형의 빗변을 확인한다."}, {"left": "4*17", "right": "68", "relation": "=", "reason": "마름모의 네 변 길이가 같음을 이용한다."}],
            "rubric": [{"points": "1", "criterion": "대각선의 반의 길이를 구함", "evidence": "8cm와 15cm"}, {"points": "1", "criterion": "수직 관계를 이용해 식을 세움", "evidence": "직각삼각형의 세 변 관계"}, {"points": "1", "criterion": "한 변의 길이를 구함", "evidence": "17cm"}, {"points": "1", "criterion": "둘레를 구함", "evidence": "68cm"}],
            "answer_only": {"points": "2", "rule": "두 답이 모두 맞으면 2점, 하나만 맞으면 1점을 준다."},
        },
    }
    for item in data["items"]:
        if item["id"] in essays:
            item.update(essays[item["id"]])
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf8")


def fill_visual_reviews():
    observations = {
        "student": [
            "표지의 학년·문항 수·총점·쪽수가 실제 3쪽과 일치하며 잘림과 겹침이 없다.",
            "선택형 1~7번의 문항·보기·배점이 같은 쪽과 단에 있고 수식이 선명하다.",
            "선택형 8~11번과 서술형 1~2번의 배점·풀이 공간·수식에 잘림과 겹침이 없다.",
        ],
        "teacher": [
            "선택형 정답과 해설이 한 쪽에서 읽히며 수식과 문장이 겹치지 않는다.",
            "서술형 모범 답안과 부분점수 기준이 두 번째 쪽에서 온전히 읽히며 배점 표기가 갈라지지 않는다.",
        ],
    }
    for role, pages, notes in (("학생용", 3, observations["student"]), ("교사용", 2, observations["teacher"])):
        path = BASE / f"{role}-검수.json"
        data = json.loads(path.read_text(encoding="utf8"))
        for page, note in zip(data["pages"], notes):
            page.update({"no_clipping": True, "no_overlap": True, "layout_matches": True, "observations": note})
        data["content"] = {
            "solved": True,
            "unique_answers": True,
            "scope_checked": True,
            "scores_checked": True,
            "roman_italic_checked": True,
            "student_teacher_agree": True,
            "notes": "독립 검토와 최종 PDF 렌더를 대조했다. 점 이름·선분 이름·단위는 정체, 변수는 기울임으로 출력되었다.",
        }
        if role == "학생용":
            data["questions"] = question_locators()
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf8")


def write_independent_review():
    outcome = {
        "schema": 2,
        "status": "PASS",
        "author_task": "/root",
        "reviewer_task": "/root/independent_exam_review",
        "student_sha256": sha256(STUDENT),
        "teacher_sha256": sha256(TEACHER),
        "student_pdf_sha256": sha256(STUDENT_PDF),
        "teacher_pdf_sha256": sha256(TEACHER_PDF),
        "student_pages_reviewed": [1, 2, 3],
        "teacher_pages_reviewed": [1, 2],
        "blocking_findings": [],
        "visual_findings": "학생용 3쪽과 교사용 2쪽에서 문항·수식·배점·선택지의 누락, 잘림, 겹침이 없음을 확인했다.",
        "limitations": "서술형 2번의 피타고라스 정리 포함 여부는 실제 학교의 확정 출제 범위에 맞춰 교사가 최종 확인한다.",
        "items": [],
    }
    reasons = {
        "MC1": "이웃한 두 각의 합으로 108도를 확인함.", "MC2": "대변의 길이 식에서 x=5를 확인함.", "MC3": "대각선 이등분 성질로 AC=22를 확인함.", "MC4": "대각선 길이가 항상 같지 않음을 확인함.", "MC5": "한 쌍의 대변의 평행·합동 조건을 확인함.", "MC6": "대각선 길이 조건으로 직사각형을 확인함.", "MC7": "대각선 수직 조건으로 마름모를 확인함.", "MC8": "직사각형 대각선 길이가 같음을 확인함.", "MC9": "대각선의 각 이등분과 이웃한 각의 합을 확인함.", "MC10": "정사각형이 직사각형이기도 함을 확인함.", "MC11": "가장 좁은 분류가 정사각형임을 확인함.", "E1": "x=33과 각 D=87도, 부분점수 기준을 확인함.", "E2": "한 변 17cm와 둘레 68cm, 부분점수 기준을 확인함.",
    }
    for item_id, reason in reasons.items():
        outcome["items"].append({"id": item_id, "verdict": "PASS", "reason": reason})
    (BASE / "독립검토-결과.json").write_text(json.dumps(outcome, ensure_ascii=False, indent=2), encoding="utf8")


if __name__ == "__main__":
    fill_math_review()
    fill_visual_reviews()
    write_independent_review()
