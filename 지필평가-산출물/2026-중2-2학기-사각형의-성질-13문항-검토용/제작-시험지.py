"""중2 2학기 사각형의 성질 검토용 지필평가를 원안지에 작성한다."""
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parent
SKILL = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")
sys.path.insert(0, str(SKILL / "scripts"))

from exam_tools import prepare
from native_author import NativeDocument


def text(value):
    return ("text", value)


def eq(value):
    return ("eq", value)


def write_student():
    prepared = BASE / "준비본-ver6.hwpx"
    student = BASE / "학생용-중2-2학기-사각형의-성질-지필평가-ver6.hwpx"
    prepare(BASE / "시험정보.json", prepared)

    with NativeDocument(prepared, mathgraph_root=BASE) as doc:
        doc.body_start()

        doc.question([text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "), eq(r"\angle\mathrm{A}=72^{\circ}"), text("일 때, "), eq(r"\angle\mathrm{B}"), text("는?")], 2)
        doc.choices([[eq(r"72^{\circ}")], [eq(r"108^{\circ}")], [eq(r"90^{\circ}")], [eq(r"144^{\circ}")], [eq(r"288^{\circ}")]], rows=(3, 2))

        doc.question([text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "), eq(r"\bar{\mathrm{AB}}=5x-7"), text(", "), eq(r"\bar{\mathrm{CD}}=2x+8"), text("일 때, "), eq("x"), text("의 값은?")], 2)
        doc.choices([[eq("5")], [eq("3")], [eq("4")], [eq("6")], [eq("7")]], rows=(3, 2))

        doc.question([text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("의 두 대각선의 교점을 "), eq(r"\mathrm{O}"), text("라 하자. "), eq(r"\bar{\mathrm{AO}}=3x-1"), text(", "), eq(r"\bar{\mathrm{OC}}=x+7"), text("일 때, "), eq(r"\bar{\mathrm{AC}}"), text("의 길이는?")], 2)
        doc.choices([[eq("18")], [eq("22")], [eq("20")], [eq("24")], [eq("26")]], rows=(3, 2))

        doc.question([text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 항상 성립하지 않는 것은?")], 2)
        doc.choices([[eq(r"\bar{\mathrm{AB}}=\bar{\mathrm{CD}}")], [eq(r"\angle\mathrm{A}=\angle\mathrm{C}")], [eq(r"\bar{\mathrm{AC}}=\bar{\mathrm{BD}}")], [text("두 대각선은 서로를 이등분한다.")], [text("두 쌍의 대변이 각각 평행하다.")]], rows=(1, 1, 1, 1, 1))

        doc.new_column()

        doc.question([text("사각형이 평행사변형이 되는 조건으로 옳은 것은?")], 2)
        doc.choices([[text("두 대각선의 길이가 같다.")], [text("한 쌍의 대변이 평행하고 길이가 같다.")], [text("두 쌍의 이웃한 변의 길이가 각각 같다.")], [text("한 쌍의 대각의 크기가 같다.")], [text("두 대각선이 서로 수직이다.")]], rows=(1, 1, 1, 1, 1))

        doc.question([text("평행사변형이 직사각형이 되는 조건으로 옳은 것은?")], 2)
        doc.choices([[text("두 대각선이 서로 수직이다.")], [text("모든 변의 길이가 같다.")], [text("두 쌍의 대변의 길이가 각각 같다.")], [text("한 쌍의 이웃한 변의 길이가 같다.")], [text("두 대각선의 길이가 같다.")]], rows=(1, 1, 1, 1, 1))

        doc.question([text("평행사변형이 마름모가 되는 조건으로 옳은 것은?")], 2)
        doc.choices([[text("두 대각선의 길이가 같다.")], [text("한 각이 직각이다.")], [text("두 대각선이 서로 수직이다.")], [text("이웃한 두 각의 크기가 같다.")], [text("한 쌍의 대변의 길이가 같다.")]], rows=(1, 1, 1, 1, 1))

        doc.new_column()

        doc.question([text("직사각형 "), eq(r"\mathrm{ABCD}"), text("에서 "), eq(r"\bar{\mathrm{AC}}=15\mathrm{cm}"), text("일 때, "), eq(r"\bar{\mathrm{BD}}"), text("는?")], 2)
        doc.choices([[eq(r"15\mathrm{cm}")], [eq(r"12\mathrm{cm}")], [eq(r"13\mathrm{cm}")], [eq(r"14\mathrm{cm}")], [eq(r"17\mathrm{cm}")]], rows=(3, 2))

        doc.question([text("마름모 "), eq(r"\mathrm{ABCD}"), text("에서 "), eq(r"\angle\mathrm{BAC}=35^{\circ}"), text("일 때, "), eq(r"\angle\mathrm{D}"), text("는?")], 2)
        doc.choices([[eq(r"70^{\circ}")], [eq(r"90^{\circ}")], [eq(r"100^{\circ}")], [eq(r"120^{\circ}")], [eq(r"110^{\circ}")]], rows=(3, 2))

        doc.question([text("정사각형의 성질로 옳지 않은 것은?")], 2)
        doc.choices([[text("마름모이지만 직사각형은 아니다.")], [text("네 변의 길이가 모두 같다.")], [text("네 각의 크기가 모두 같다.")], [text("두 대각선의 길이가 같다.")], [text("두 대각선은 서로 수직이다.")]], rows=(1, 1, 1, 1, 1))

        doc.question([text("두 대각선의 길이가 같고 서로 수직인 평행사변형을 가장 좁게 분류한 것은?")], 2)
        doc.choices([[text("직사각형")], [text("마름모")], [text("사다리꼴")], [text("정사각형")], [text("어느 것도 아니다")]], rows=(3, 2))

        doc.new_column()

        doc.question([text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "), eq(r"\angle\mathrm{A}=(3x-6)^{\circ}"), text(", "), eq(r"\angle\mathrm{B}=(2x+21)^{\circ}"), text("이다. "), eq("x"), text("의 값과 "), eq(r"\angle\mathrm{D}"), text("의 크기를 구하고 풀이 과정을 쓰시오.")], 4, kind="essay")
        doc.space(7)

        doc.question([text("마름모 "), eq(r"\mathrm{ABCD}"), text("의 두 대각선의 길이가 각각 "), eq(r"\bar{\mathrm{AC}}=16\mathrm{cm}"), text(", "), eq(r"\bar{\mathrm{BD}}=30\mathrm{cm}"), text("이다. 한 변의 길이와 둘레를 구하고 풀이 과정을 쓰시오.")], 4, kind="essay")
        doc.space(7)
        doc.save(student)


def write_teacher():
    teacher = BASE / "교사용-중2-2학기-사각형의-성질-정답해설-ver7.hwpx"
    with NativeDocument(mathgraph_root=BASE) as doc:
        doc.line([text("중2 2학기 사각형의 성질 지필평가 정답 및 해설")], metadata=True)
        doc.line([text("모든 문항은 창작 문항이다.")])
        doc.space(1)

        entries = [
            ("선택형 1번 [2점]", "정답은 ②이다. 인접한 두 각의 크기의 합이 ", [eq(r"180^{\circ}"), text("이므로 "), eq(r"\angle\mathrm{B}=108^{\circ}")]),
            ("선택형 2번 [2점]", "정답은 ①이다. 대변의 길이가 같으므로 ", [eq(r"5x-7=2x+8"), text("이고, "), eq("x=5")]),
            ("선택형 3번 [2점]", "정답은 ②이다. 대각선은 서로를 이등분하므로 ", [eq(r"3x-1=x+7"), text("에서 "), eq("x=4"), text("이다. 따라서 "), eq(r"\bar{\mathrm{AC}}=2\times11=22")]),
            ("선택형 4번 [2점]", "정답은 ③이다. 일반적인 평행사변형의 두 대각선의 길이는 항상 같지 않다.", []),
            ("선택형 5번 [2점]", "정답은 ②이다. 한 쌍의 대변이 평행하고 길이가 같으면 평행사변형이 된다.", []),
            ("선택형 6번 [2점]", "정답은 ⑤이다. 평행사변형의 두 대각선의 길이가 같으면 직사각형이 된다.", []),
            ("선택형 7번 [2점]", "정답은 ③이다. 평행사변형의 두 대각선이 서로 수직이면 마름모가 된다.", []),
            ("선택형 8번 [2점]", "정답은 ①이다. 직사각형의 두 대각선의 길이는 같으므로 ", [eq(r"\bar{\mathrm{BD}}=15\mathrm{cm}")]),
            ("선택형 9번 [2점]", "정답은 ⑤이다. 대각선 ", [eq(r"\bar{\mathrm{AC}}"), text("가 "), eq(r"\angle\mathrm{A}"), text("를 이등분하므로 "), eq(r"\angle\mathrm{A}=70^{\circ}"), text("이다. 따라서 "), eq(r"\angle\mathrm{D}=110^{\circ}")]),
            ("선택형 10번 [2점]", "정답은 ①이다. 정사각형은 마름모이면서 직사각형이다.", []),
            ("선택형 11번 [2점]", "정답은 ④이다. 길이가 같은 두 대각선의 성질로 직사각형이고, 수직인 두 대각선의 성질로 마름모이므로 정사각형이다.", []),
        ]
        for heading, opening, formula_parts in entries:
            doc.line([text(heading)], metadata=True)
            doc.parts([text(opening)])
            doc.parts(formula_parts)
            doc.paragraph()

        doc.new_page()
        doc.line([text("서술형 문항의 모범 답안 및 채점 기준")])
        doc.line([text("서술형 1번 [4점]")], metadata=True)
        doc.line([text("인접한 두 각의 크기의 합을 이용하면 "), eq(r"(3x-6)+(2x+21)=180"), text("이다.")])
        doc.line([eq(r"5x+15=180"), text("에서 "), eq("x=33")])
        doc.line([text("따라서 "), eq(r"\angle\mathrm{D}=\angle\mathrm{B}=(2\times33+21)^{\circ}=87^{\circ}")])
        doc.line([text("채점 기준: 인접한 두 각의 합을 식으로 세움 "), text("[1점]"), text("; "), eq("x=33"), text("을 구함 "), text("[1점]"), text(".")], metadata=True)
        doc.line([eq(r"\angle\mathrm{D}"), text("를 구할 관계를 나타냄 "), text("[1점]"), text("; "), eq(r"\angle\mathrm{D}=87^{\circ}"), text("을 구함 "), text("[1점]"), text(".")], metadata=True)
        doc.line([text("답만 쓴 경우 두 답이 모두 맞으면 "), text("[2점]"), text(", 하나만 맞으면 "), text("[1점]"), text("을 준다.")], metadata=True)
        doc.line([text("앞 계산의 오류를 일관되게 사용한 후속 관계는 인정한다.")], metadata=True)

        doc.line([text("서술형 2번 [4점]")], metadata=True)
        doc.line([text("두 대각선은 서로 수직이고 각각 이등분하므로 반의 길이는 "), eq(r"8\mathrm{cm}"), text("와 "), eq(r"15\mathrm{cm}"), text("이다.")])
        doc.line([eq(r"\bar{\mathrm{AB}}^2=8^2+15^2=289"), text("이므로 "), eq(r"\bar{\mathrm{AB}}=17\mathrm{cm}")])
        doc.line([text("따라서 둘레는 "), eq(r"4\times17\mathrm{cm}=68\mathrm{cm}")])
        doc.line([text("채점 기준: 대각선의 반의 길이 "), eq(r"8\mathrm{cm}"), text(", "), eq(r"15\mathrm{cm}"), text("을 구함 "), text("[1점]"), text(".")], metadata=True)
        doc.line([text("수직 관계로 식을 세움 "), text("[1점]"), text("; 한 변의 길이 "), eq(r"17\mathrm{cm}"), text("을 구함 "), text("[1점]"), text(".")], metadata=True)
        doc.line([text("둘레 "), eq(r"68\mathrm{cm}"), text("을 구함 "), text("[1점]"), text(".")], metadata=True)
        doc.line([text("답만 쓴 경우 두 답이 모두 맞으면 "), text("[2점]"), text(", 하나만 맞으면 "), text("[1점]"), text("을 준다.")], metadata=True)
        doc.line([text("앞 계산의 오류를 일관되게 사용한 후속 관계는 인정한다.")], metadata=True)
        doc.save(teacher)


if __name__ == "__main__":
    write_student()
    write_teacher()
