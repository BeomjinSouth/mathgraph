"""중2 2학기 「사각형의 성질」 13문항 검토용 지필평가를 만든다."""
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parent
PROJECT = BASE.parent / "2026-중2-2학기-사각형의-성질-13문항-검토용"
SKILL = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")
sys.path.insert(0, str(SKILL / "scripts"))

from exam_tools import prepare
from native_author import NativeDocument


def text(value):
    return ("text", value)


def eq(value):
    return ("eq", value)


def write_student():
    prepared = BASE / "준비본-최종5.hwpx"
    student = BASE / "학생용-중2-2학기-사각형의-성질-13문항-최종5.hwpx"
    prepare(BASE / "시험정보.json", prepared)

    with NativeDocument(prepared, mathgraph_root=PROJECT) as doc:
        doc.body_start()

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{A}=68^{\circ}"), text("일 때, "),
            eq(r"\angle\mathrm{C}"), text("의 크기는?")
        ], 3)
        doc.choices([
            [eq(r"68^{\circ}")], [eq(r"112^{\circ}")], [eq(r"90^{\circ}")],
            [eq(r"136^{\circ}")], [eq(r"292^{\circ}")]
        ], rows=(3, 2))

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\bar{\mathrm{AB}}=3x+2"), text(", "),
            eq(r"\bar{\mathrm{CD}}=5x-10"), text("일 때, "), eq("x"),
            text("의 값은?")
        ], 3)
        doc.choices([
            [eq("4")], [eq("5")], [eq("6")], [eq("7")], [eq("8")]
        ], rows=(3, 2))

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("의 두 대각선의 교점을 "),
            eq(r"\mathrm{O}"), text("라 하자. "), eq(r"\bar{\mathrm{AO}}=7"),
            text(", "), eq(r"\bar{\mathrm{OC}}=x+2"), text("일 때, "), eq("x"),
            text("의 값은?")
        ], 3)
        doc.choices([
            [eq("3")], [eq("4")], [eq("5")], [eq("6")], [eq("7")]
        ], rows=(3, 2))

        doc.question([text("다음 중 사각형이 평행사변형이 되는 조건으로 충분한 것은?")], 4)
        doc.choices([
            [text("한 쌍의 대변의 길이가 같다.")],
            [text("한 쌍의 대변이 평행하다.")],
            [text("두 대각선의 길이가 같다.")],
            [text("한 쌍의 대각의 크기가 같다.")],
            [text("한 쌍의 대변이 평행하고 그 길이가 같다.")]
        ], rows=(1, 1, 1, 1, 1))

        doc.new_column()

        doc.question([text("평행사변형이 직사각형이 되는 조건으로 항상 충분한 것은?")], 4)
        doc.choices([
            [text("두 대각선이 서로 수직이다.")],
            [text("한 각의 크기가 직각이다.")],
            [text("이웃한 두 변의 길이가 같다.")],
            [text("한 쌍의 대변의 길이가 같다.")],
            [text("두 대각선이 서로를 이등분한다.")]
        ], rows=(1, 1, 1, 1, 1))

        doc.question([
            text("마름모 "), eq(r"\mathrm{ABCD}"), text("의 두 대각선의 교점을 "),
            eq(r"\mathrm{O}"), text("라 할 때, 항상 성립하지 않는 것은?")
        ], 4)
        doc.choices([
            [eq(r"\bar{\mathrm{AO}}=\bar{\mathrm{OC}}")],
            [eq(r"\bar{\mathrm{BO}}=\bar{\mathrm{OD}}")],
            [eq(r"\bar{\mathrm{AC}}\perp\bar{\mathrm{BD}}")],
            [eq(r"\bar{\mathrm{AC}}=\bar{\mathrm{BD}}")],
            [eq(r"\angle\mathrm{AOB}=90^{\circ}")]
        ], rows=(1, 1, 1, 1, 1))

        doc.question([text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 항상 옳은 것을 고르시오.")], 5)
        doc.statement_box([
            [text("두 쌍의 대변의 길이가 각각 같다.")],
            [text("두 대각선의 길이가 같다.")],
            [text("두 대각선은 서로를 이등분한다.")]
        ])
        doc.choices([
            [text("ㄱ")], [text("ㄴ")], [text("ㄱ, ㄷ")],
            [text("ㄴ, ㄷ")], [text("ㄱ, ㄴ, ㄷ")]
        ], rows=(3, 2))

        doc.new_column()

        doc.question([
            text("직사각형 "), eq(r"\mathrm{ABCD}"), text("의 두 변의 길이가 "),
            eq(r"\bar{\mathrm{AB}}=3x+1"), text(", "),
            eq(r"\bar{\mathrm{BC}}=x+3"), text(", "),
            text("둘레가 "), eq(r"40\mathrm{cm}"), text("일 때 "), eq("x"),
            text("의 값은?")
        ], 5)
        doc.choices([
            [eq("2")], [eq("3")], [eq("4")], [eq("5")], [eq("6")]
        ], rows=(3, 2))

        doc.question([
            text("마름모 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{BAC}=32^{\circ}"), text("일 때 "),
            eq(r"\angle\mathrm{D}"), text("는?")
        ], 5)
        doc.choices([
            [eq(r"32^{\circ}")], [eq(r"64^{\circ}")], [eq(r"90^{\circ}")],
            [eq(r"116^{\circ}")], [eq(r"148^{\circ}")]
        ], rows=(3, 2))

        doc.question([
            text("두 대각선의 길이가 같고 서로 수직인 평행사변형이 정사각형임을 설명하시오.")
        ], 6, kind="essay")
        doc.space(8)

        doc.new_column()

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{A}=(3x+10)^{\circ}"), text(", "),
            eq(r"\angle\mathrm{B}=(5x-30)^{\circ}"), text("이다. "),
            text("미지수 "), eq("x"), text("의 값과 네 각의 크기를 구하고 풀이 과정을 쓰시오.")
        ], 6, kind="essay")
        doc.space(8)

        doc.question([
            text("직사각형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\bar{\mathrm{AB}}=3x+1"), text(", "),
            eq(r"\bar{\mathrm{BC}}=x+3"), text(", "),
            text("둘레가 "), eq(r"40\mathrm{cm}"), text("이다. "),
            text("미지수 "), eq("x"), text("의 값과 직사각형의 넓이를 구하고 풀이 과정을 쓰시오.")
        ], 6, kind="essay")
        doc.space(8)

        doc.question([
            text("마름모 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{ABC}=(4x+10)^{\circ}"), text(", "),
            eq(r"\angle\mathrm{ACB}=(2x+5)^{\circ}"), text("이다. "),
            text("미지수 "), eq("x"), text("의 값과 네 각의 크기를 구하고 풀이 과정을 쓰시오.")
        ], 6, kind="essay")
        doc.space(8)
        doc.save(student)


def write_teacher():
    teacher = BASE / "교사용-중2-2학기-사각형의-성질-정답해설-최종5.hwpx"
    with NativeDocument(mathgraph_root=PROJECT) as doc:
        doc.line([text("중2 2학기 사각형의 성질 지필평가 정답 및 해설")], metadata=True)
        doc.line([text("모든 문항은 창작 문항이다.")])
        doc.space(1)

        entries = [
            ("선택형 1번 [3점]", [
                text("정답은 ①이다. 평행사변형의 두 대각의 크기는 같으므로 "),
                eq(r"\angle\mathrm{C}=\angle\mathrm{A}=68^{\circ}")
            ]),
            ("선택형 2번 [3점]", [
                text("정답은 ③이다. 대변의 길이가 같으므로 "),
                eq(r"3x+2=5x-10"), text("이고, "), eq(r"x=6")
            ]),
            ("선택형 3번 [3점]", [
                text("정답은 ③이다. 대각선은 서로를 이등분하므로 "),
                eq(r"\bar{\mathrm{AO}}=\bar{\mathrm{OC}}"), text("이다. 따라서 "),
                eq(r"7=x+2"), text("에서 "), eq(r"x=5")
            ]),
            ("선택형 4번 [4점]", [
                text("정답은 ⑤이다. 사각형에서 한 쌍의 대변이 평행하고 그 길이가 같으면 평행사변형이다.")
            ]),
            ("선택형 5번 [4점]", [
                text("정답은 ②이다. 평행사변형은 한 각이 직각이면 네 각이 모두 직각이므로 직사각형이다.")
            ]),
            ("선택형 6번 [4점]", [
                text("정답은 ④이다. 마름모의 두 대각선은 서로 수직이고 서로를 이등분하지만, 그 길이가 항상 같은 것은 아니다.")
            ]),
            ("선택형 7번 [5점]", [
                text("정답은 ③이다. 평행사변형은 두 쌍의 대변의 길이가 각각 같고 두 대각선이 서로를 이등분한다. 두 대각선의 길이가 같은 것은 일반적으로 성립하지 않는다.")
            ]),
            ("선택형 8번 [5점]", [
                text("정답은 ③이다. 직사각형의 둘레는 "),
                eq(r"2((3x+1)+(x+3))=40"), text("이므로 "),
                eq(r"8x+8=40"), text("에서 "), eq(r"x=4")
            ]),
            ("선택형 9번 [5점]", [
                text("정답은 ④이다. 마름모의 대각선 "),
                eq(r"\bar{\mathrm{AC}}"), text("는 "), eq(r"\angle\mathrm{A}"),
                text("를 이등분하므로 "), eq(r"\angle\mathrm{A}=64^{\circ}"),
                text("이다. 평행사변형의 이웃한 각의 합은 "), eq(r"180^{\circ}"),
                text("이므로 "), eq(r"\angle\mathrm{D}=180^{\circ}-64^{\circ}=116^{\circ}")
            ]),
        ]
        for heading, parts in entries:
            doc.line([text(heading)], metadata=True)
            doc.line(parts)

        doc.new_page()
        doc.line([text("서술형 문항의 모범 답안 및 채점 기준")])

        doc.line([text("서술형 1번 [6점]")], metadata=True)
        doc.line([text("평행사변형에서 두 대각선의 길이가 같으면 직사각형이다. 두 대각선이 서로 수직이면 마름모이다. 따라서 이 평행사변형은 직사각형이면서 마름모이므로 정사각형이다.")])
        doc.line([text("채점 기준: 두 대각선의 길이가 같다는 조건으로 직사각형임을 설명함 "), text("[2점]"), text("; 두 대각선이 서로 수직이라는 조건으로 마름모임을 설명함 "), text("[2점]"), text("; 직사각형과 마름모의 성질을 모두 만족하므로 정사각형이라고 결론 내림 "), text("[2점]")], metadata=True)
        doc.line([text("답만 쓴 경우: 정사각형이라는 결론만 쓰면 [2점]으로 한다.")], metadata=True)

        doc.line([text("서술형 2번 [6점]")], metadata=True)
        doc.line([text("평행사변형의 이웃한 두 각의 합은 "), eq(r"180^{\circ}"), text("이므로 ")])
        doc.line([eq(r"(3x+10)+(5x-30)=180")])
        doc.line([eq(r"8x-20=180"), text("에서 "), eq(r"x=25")])
        doc.line([text("따라서 "), eq(r"\angle\mathrm{A}=\angle\mathrm{C}=(3\times25+10)^{\circ}=85^{\circ}"), text("이고, "), eq(r"\angle\mathrm{B}=\angle\mathrm{D}=(5\times25-30)^{\circ}=95^{\circ}")])
        doc.line([text("채점 기준: 이웃한 두 각의 합을 이용한 관계를 씀 "), text("[1점]"), text("; "), eq(r"(3x+10)+(5x-30)=180"), text("을 세움 "), text("[1점]"), text("; "), eq(r"x=25"), text("를 구함 "), text("[2점]"), text("; 네 각의 크기를 모두 구함 "), text("[2점]")], metadata=True)
        doc.line([text("답만 쓴 경우: "), eq(r"x=25"), text("와 네 각을 모두 맞히면 [3점], 미지수만 맞히면 [2점], 네 각만 모두 맞히면 [2점]으로 한다. 앞 단계의 계산 오류를 일관되게 사용한 후속 각의 계산은 인정한다.")], metadata=True)

        doc.line([text("서술형 3번 [6점]")], metadata=True)
        doc.line([text("직사각형의 둘레는 "), eq(r"2(\bar{\mathrm{AB}}+\bar{\mathrm{BC}})"), text("이므로 ")])
        doc.line([eq(r"2((3x+1)+(x+3))=40")])
        doc.line([eq(r"8x+8=40"), text("에서 "), eq(r"x=4")])
        doc.line([text("따라서 "), eq(r"\bar{\mathrm{AB}}=13\mathrm{cm}"), text(", "), eq(r"\bar{\mathrm{BC}}=7\mathrm{cm}"), text("이고, 넓이는 "), eq(r"13\times7=91\mathrm{cm}^{2}")])
        doc.line([text("채점 기준: 둘레 관계를 식으로 나타냄 "), text("[2점]"), text("; "), eq(r"x=4"), text("를 구함 "), text("[2점]"), text("; 두 변의 길이를 구하여 넓이 "), eq(r"91\mathrm{cm}^{2}"), text("를 구함 "), text("[2점]")], metadata=True)
        doc.line([text("답만 쓴 경우: "), eq(r"x=4"), text("와 넓이를 모두 맞히면 [3점], 미지수만 맞히면 [2점], 넓이만 맞히면 [2점]으로 한다. 앞 단계의 계산 오류를 일관되게 사용한 후속 넓이 계산은 인정한다.")], metadata=True)

        doc.line([text("서술형 4번 [6점]")], metadata=True)
        doc.line([text("마름모의 네 변은 같으므로 삼각형 "), eq(r"\mathrm{ABC}"), text("는 "), eq(r"\bar{\mathrm{AB}}=\bar{\mathrm{BC}}"), text("인 이등변삼각형이다. 따라서 "), eq(r"\angle\mathrm{BAC}=\angle\mathrm{ACB}= (2x+5)^{\circ}")])
        doc.line([text("또한 마름모의 대각선 "), eq(r"\bar{\mathrm{AC}}"), text("는 "), eq(r"\angle\mathrm{A}"), text("를 이등분하므로 삼각형 "), eq(r"\mathrm{ABC}"), text("의 세 각의 합에서 ")])
        doc.line([eq(r"2(2x+5)+(4x+10)=180")])
        doc.line([eq(r"8x+20=180"), text("에서 "), eq(r"x=20")])
        doc.line([text("따라서 "), eq(r"\angle\mathrm{A}=90^{\circ}"), text("이고, 평행사변형의 이웃한 각과 마주 보는 각의 성질에 따라 네 각은 모두 "), eq(r"90^{\circ}")])
        doc.line([text("채점 기준: 이등변삼각형과 대각선의 성질을 설명함 [2점]; 각의 합으로 "), eq(r"x=20"), text("을 구함 [2점]; 네 각이 "), eq(r"90^{\circ}"), text("임을 구함 [2점].")], metadata=True)
        doc.line([text("답만 쓴 경우: "), eq(r"x=20"), text("과 네 각을 모두 맞히면 [3점], 하나만 맞히면 [2점]으로 한다.")], metadata=True)
        doc.save(teacher)


if __name__ == "__main__":
    write_student()
    write_teacher()
