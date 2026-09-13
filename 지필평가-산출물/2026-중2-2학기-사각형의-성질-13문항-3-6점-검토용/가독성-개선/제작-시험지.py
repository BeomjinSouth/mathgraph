"""중2 2학기 「사각형의 성질」 13문항 검토용 지필평가를 만든다."""
from pathlib import Path
import sys
import json

BASE = Path(__file__).resolve().parent
PROJECT = BASE.parent.parent / "2026-중2-2학기-사각형의-성질-고난도-개정본"
SKILL = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")
sys.path.insert(0, str(SKILL / "scripts"))

from exam_tools import prepare
from native_author import NativeDocument


def text(value):
    return ("text", value)


def eq(value):
    return ("eq", value)


def diagram(name):
    keys={'01-평행사변형-이웃각-내보내기.json':'01','02-평행사변형-변의길이-내보내기.json':'02',
          '03-평행사변형-대각선길이-내보내기-v2.json':'03','09-마름모-두대각선-내보내기.json':'09',
          '서술02-마름모-각-내보내기.json':'E2','서술04-마름모-각-내보내기.json':'E4'}
    key=keys[name];version='v6' if key=='09' else ('v5' if key=='E2' else 'v4')
    return json.loads((BASE / 'MathGraph' / (key+'-내보내기-'+version+'.json')).read_text(encoding='utf8'))


def write_student():
    prepared = BASE / "준비본-가독성-v5.hwpx"
    student = BASE / "학생용-사각형의-성질-가독성-개선-완성.hwpx"
    prepare(BASE / "시험정보.json", prepared)

    with NativeDocument(prepared, mathgraph_root=PROJECT) as doc:
        doc.body_start()

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{DAB}=(3x+15)^{\circ}"), text(", "),
            eq(r"\angle\mathrm{ABC}=(5x-11)^{\circ}"), text("일 때, "),
            eq(r"\angle\mathrm{D}"), text("의 크기는?")
        ], 3)
        doc.diagram(diagram("01-평행사변형-이웃각-내보내기.json"))
        doc.choices([
            [eq(r"81^{\circ}")], [eq(r"90^{\circ}")], [eq(r"95^{\circ}")],
            [eq(r"99^{\circ}")], [eq(r"108^{\circ}")]
        ], rows=(3, 2))

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\bar{\mathrm{AB}}=3x-2"), text(", "),
            eq(r"\bar{\mathrm{CD}}=x+8"), text(", 둘레가 "), eq(r"44\mathrm{cm}"),
            text("일 때, "), eq(r"\bar{\mathrm{AD}}"), text("의 길이는?")
        ], 3)
        doc.diagram(diagram("02-평행사변형-변의길이-내보내기.json"))
        doc.choices([
            [eq(r"8\mathrm{cm}")], [eq(r"9\mathrm{cm}")], [eq(r"10\mathrm{cm}")],
            [eq(r"11\mathrm{cm}")], [eq(r"12\mathrm{cm}")]
        ], rows=(3, 2))

        doc.new_column()

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("의 두 대각선의 교점을 "),
            eq(r"\mathrm{O}"), text("라 하자. "), eq(r"\bar{\mathrm{AO}}=2x+1"),
            text(", "), eq(r"\bar{\mathrm{OC}}=x+7"), text("일 때, "),
            eq(r"\bar{\mathrm{AC}}"), text("의 길이는?")
        ], 3)
        doc.diagram(diagram("03-평행사변형-대각선길이-내보내기-v2.json"))
        doc.choices([
            [eq("22")], [eq("24")], [eq("26")], [eq("28")], [eq("30")]
        ], rows=(3, 2))

        doc.question([
            text("사각형 "), eq(r"\mathrm{ABCD}"), text("의 두 대각선의 교점을 "), eq(r"\mathrm{O}"),
            text("라 하자. 이 사각형이 평행사변형임을 보장하는 조건은?")
        ], 4)
        doc.choices([
            [eq(r"\bar{\mathrm{AO}}=\bar{\mathrm{OC}}"), text("이고 "), eq(r"\bar{\mathrm{BO}}=\bar{\mathrm{OD}}")],
            [eq(r"\bar{\mathrm{AO}}=\bar{\mathrm{OC}}")],
            [eq(r"\bar{\mathrm{BO}}=\bar{\mathrm{OD}}")],
            [eq(r"\bar{\mathrm{AC}}=\bar{\mathrm{BD}}")],
            [eq(r"\bar{\mathrm{AC}}\perp\bar{\mathrm{BD}}")]
        ], rows=(1, 1, 1, 1, 1))

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\bar{\mathrm{AC}}=\bar{\mathrm{BD}}"), text(", "),
            eq(r"\angle\mathrm{DAB}=(4x+6)^{\circ}"), text("일 때, "), eq("x"), text("의 값은?")
        ], 4)
        doc.choices([
            [eq("19")], [eq("20")], [eq("22")], [eq("23")], [eq("21")]
        ], rows=(3, 2))

        doc.question([
            text("마름모 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{BAC}=(x+5)^{\circ}"), text(", "),
            eq(r"\angle\mathrm{ABD}=(2x+10)^{\circ}"), text("일 때, "),
            eq(r"\angle\mathrm{D}"), text("의 크기는?")
        ], 4)
        doc.choices([
            [eq(r"100^{\circ}")], [eq(r"120^{\circ}")], [eq(r"110^{\circ}")],
            [eq(r"130^{\circ}")], [eq(r"140^{\circ}")]
        ], rows=(3, 2))

        doc.new_page()

        doc.question([text("다음 중 항상 옳은 것을 모두 고른 것은?")], 5)
        doc.statement_box([
            [text("평행사변형에서 한 각이 직각이면 직사각형이다.")],
            [text("평행사변형에서 네 변의 길이가 같으면 정사각형이다.")],
            [text("평행사변형에서 두 대각선의 길이가 같으면 직사각형이다.")],
            [text("마름모에서 두 대각선의 길이가 같으면 정사각형이다.")]
        ])
        doc.choices([
            [text("ㄱ, ㄷ, ㄹ")], [text("ㄱ, ㄷ")], [text("ㄱ, ㄴ, ㄷ")],
            [text("ㄱ, ㄹ")], [text("ㄱ, ㄴ, ㄷ, ㄹ")]
        ], rows=(3, 2))

        doc.question([
            text("직사각형 "), eq(r"\mathrm{ABCD}"), text("의 두 대각선의 교점을 "), eq(r"\mathrm{O}"),
            text("라 하자. 길이의 단위는 모두 "), eq(r"\mathrm{cm}"), text("이다. "),
            eq(r"\bar{\mathrm{AO}}=x+1"), text(", "), eq(r"\bar{\mathrm{BO}}=2x-3"),
            text(", "), eq(r"\bar{\mathrm{AB}}=2x"), text(", "), eq(r"\bar{\mathrm{BC}}=x+2"),
            text("일 때, 이 직사각형의 둘레는?")
        ], 5)
        doc.choices([
            [eq(r"26\mathrm{cm}")], [eq(r"28\mathrm{cm}")], [eq(r"30\mathrm{cm}")],
            [eq(r"32\mathrm{cm}")], [eq(r"34\mathrm{cm}")]
        ], rows=(3, 2))

        doc.new_column()

        doc.question([
            text("마름모 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{BAC}=(x+12)^{\circ}"), text(", "),
            eq(r"\angle\mathrm{ABD}=(2x+6)^{\circ}"), text("일 때 "),
            eq(r"\angle\mathrm{D}"), text("는?")
        ], 5)
        doc.diagram(diagram("09-마름모-두대각선-내보내기.json"))
        doc.choices([
            [eq(r"100^{\circ}")], [eq(r"102^{\circ}")], [eq(r"104^{\circ}")],
            [eq(r"106^{\circ}")], [eq(r"108^{\circ}")]
        ], rows=(3, 2))

        doc.question([
            text("두 대각선의 길이가 같고 서로 수직인 평행사변형이 정사각형임을 설명하시오.")
        ], 6, kind="essay")
        doc.space(8)

        doc.new_column()

        doc.question([
            text("마름모 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{BAC}=(x+10)^{\circ}"), text(", "),
            eq(r"\angle\mathrm{ABC}=(3x+20)^{\circ}"), text("이다. "),
            text("미지수 "), eq("x"), text("의 값과 네 각의 크기를 구하고 풀이 과정을 쓰시오.")
        ], 6, kind="essay")
        doc.diagram(diagram("서술02-마름모-각-내보내기.json"))
        doc.space(8)

        doc.question([
            text("평행사변형 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\bar{\mathrm{AC}}=\bar{\mathrm{BD}}"), text(", "), eq(r"\bar{\mathrm{AB}}=3x+1"),
            text(", "), eq(r"\bar{\mathrm{BC}}=x+5"), text(", 둘레가 "), eq(r"60\mathrm{cm}"), text("이다. "),
            text("이 사각형의 종류를 판정하고, 미지수 "), eq("x"), text("의 값과 넓이를 구하는 풀이 과정을 쓰시오.")
        ], 6, kind="essay")
        doc.space(8)

        doc.new_column()
        doc.question([
            text("마름모 "), eq(r"\mathrm{ABCD}"), text("에서 "),
            eq(r"\angle\mathrm{ABC}=(4x+20)^{\circ}"), text(", "),
            eq(r"\angle\mathrm{ACB}=(2x)^{\circ}"), text("이다. "),
            text("미지수 "), eq("x"), text("의 값과 네 각의 크기를 구하고 풀이 과정을 쓰시오.")
        ], 6, kind="essay")
        doc.diagram(diagram("서술04-마름모-각-내보내기.json"))
        doc.space(8)
        doc.save(student)
        (BASE/'라벨-실측-배치.json').write_text(json.dumps(doc.diagram_receipts,ensure_ascii=False,indent=2),encoding='utf8')


def write_teacher():
    teacher = BASE / "교사용-사각형의-성질-가독성-개선-채점보완.hwpx"
    with NativeDocument(mathgraph_root=PROJECT) as doc:
        doc.line([text("중2 2학기 사각형의 성질 지필평가 정답 및 해설")], metadata=True)
        doc.line([text("모든 문항은 창작 문항이다.")])
        doc.line([text("제시한 풀이와 수학적으로 동치인 타당한 풀이는 해당 단계의 점수를 인정한다.")])
        doc.space(1)

        entries = [
            ("선택형 1번 [3점]", [
                text("정답은 ④이다. 평행사변형의 이웃한 두 각의 합은 "), eq(r"180^{\circ}"), text("이므로 "),
                eq(r"(3x+15)+(5x-11)=180"), text("에서 "), eq(r"x=22"), text("이다. 따라서 "),
                eq(r"\angle\mathrm{D}=\angle\mathrm{B}=99^{\circ}")
            ]),
            ("선택형 2번 [3점]", [
                text("정답은 ②이다. 대변의 길이가 같으므로 "), eq(r"3x-2=x+8"),
                text("에서 "), eq(r"x=5"), text("이고, "), eq(r"\bar{\mathrm{AB}}=13\mathrm{cm}"), text("이다. 둘레에서 "),
                eq(r"2(13+\bar{\mathrm{AD}})=44"), text("이므로 "), eq(r"\bar{\mathrm{AD}}=9\mathrm{cm}")
            ]),
            ("선택형 3번 [3점]", [
                text("정답은 ③이다. 대각선은 서로를 이등분하므로 "),
                eq(r"\bar{\mathrm{AO}}=\bar{\mathrm{OC}}"), text("이다. 따라서 "),
                eq(r"2x+1=x+7"), text("에서 "), eq(r"x=6"), text("이다. 그러므로 "),
                eq(r"\bar{\mathrm{AC}}=2\bar{\mathrm{AO}}=2\times13=26")
            ]),
            ("선택형 4번 [4점]", [
                text("정답은 ①이다. 사각형의 두 대각선이 서로를 이등분하면 평행사변형이다. ②와 ③은 한 대각선만 이등분한 경우이고, ④와 ⑤는 직사각형 또는 마름모의 필요조건이지만 평행사변형을 보장하지 않는다.")
            ]),
            ("선택형 5번 [4점]", [
                text("정답은 ⑤이다. 평행사변형에서 두 대각선의 길이가 같으면 직사각형이다. 따라서 "),
                eq(r"\angle\mathrm{DAB}=90^{\circ}"), text("이므로 "), eq(r"4x+6=90"), text("에서 "), eq(r"x=21")
            ]),
            ("선택형 6번 [4점]", [
                text("정답은 ②이다. 마름모의 두 대각선은 각각 꼭짓각을 이등분하므로 이웃한 두 각의 합에서 "),
                eq(r"2(x+5)+2(2x+10)=180"), text("이다. 따라서 "), eq(r"x=25"), text("이고, "),
                eq(r"\angle\mathrm{D}=\angle\mathrm{B}=2(2\times25+10)^{\circ}=120^{\circ}")
            ]),
            ("선택형 7번 [5점]", [
                text("정답은 ①이다. ㄱ은 평행사변형의 한 각이 직각이면 모든 각이 직각이라는 성질로 참이다. ㄴ은 마름모일 수 있으므로 거짓이다. ㄷ은 평행사변형의 두 대각선 길이가 같으면 직사각형이므로 참이다. ㄹ은 마름모이면서 두 대각선 길이가 같은 도형은 정사각형이므로 참이다.")
            ]),
            ("선택형 8번 [5점]", [
                text("정답은 ②이다. 직사각형의 두 대각선은 길이가 같고 서로를 이등분하므로 "), eq(r"\bar{\mathrm{AO}}=\bar{\mathrm{BO}}"),
                text("이다. 따라서 "), eq(r"x+1=2x-3"), text("에서 "), eq(r"x=4"), text("이다. 둘레는 "),
                eq(r"2(8+6)=28\mathrm{cm}")
            ]),
            ("선택형 9번 [5점]", [
                text("정답은 ⑤이다. 마름모의 두 대각선은 각각 꼭짓각을 이등분하므로 "),
                eq(r"2(x+12)+2(2x+6)=180"), text("에서 "), eq(r"x=24"), text("이다. 따라서 "),
                eq(r"\angle\mathrm{D}=\angle\mathrm{B}=2(2\times24+6)^{\circ}=108^{\circ}")
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
        doc.line([text("마름모의 네 변은 같으므로 삼각형 "), eq(r"\mathrm{ABC}"), text("는 "), eq(r"\bar{\mathrm{AB}}=\bar{\mathrm{BC}}"), text("인 이등변삼각형이다. 따라서 "), eq(r"\angle\mathrm{BAC}=\angle\mathrm{ACB}=(x+10)^{\circ}")])
        doc.line([text("삼각형 "), eq(r"\mathrm{ABC}"), text("의 세 각의 합에서 ")])
        doc.line([eq(r"2(x+10)+(3x+20)=180")])
        doc.line([eq(r"5x+40=180"), text("에서 "), eq(r"x=28")])
        doc.line([text("따라서 "), eq(r"\angle\mathrm{A}=\angle\mathrm{C}=2(28+10)^{\circ}=76^{\circ}"), text("이고, "), eq(r"\angle\mathrm{B}=\angle\mathrm{D}=(3\times28+20)^{\circ}=104^{\circ}")])
        doc.line([text("채점 기준: 이등변삼각형의 밑각 관계를 씀 "), text("[1점]"), text("; "), eq(r"2(x+10)+(3x+20)=180"), text("을 세움 "), text("[1점]"), text("; "), eq(r"x=28"), text("을 구함 "), text("[2점]"), text("; 네 각의 크기를 모두 구함 "), text("[2점]")], metadata=True)
        doc.line([text("답만 쓴 경우: 미지수와 네 각 전체가 모두 정답이면 [3점], 미지수만 정답이거나 네 각 전체만 정답이면 [2점]이다. 네 각 중 일부 정답에는 점수를 더하지 않으며, 나머지는 [0점]이다. 풀이를 제시한 경우에만 앞 단계의 계산 오류를 일관되게 사용한 후속 각의 계산을 인정한다.")], metadata=True)

        doc.line([text("서술형 3번 [6점]")], metadata=True)
        doc.line([text("평행사변형에서 두 대각선의 길이가 같으면 직사각형이다. 직사각형의 둘레는 "), eq(r"2(\bar{\mathrm{AB}}+\bar{\mathrm{BC}})"), text("이므로 ")])
        doc.line([eq(r"2((3x+1)+(x+5))=60")])
        doc.line([eq(r"8x+12=60"), text("에서 "), eq(r"x=6")])
        doc.line([text("따라서 "), eq(r"\bar{\mathrm{AB}}=19\mathrm{cm}"), text(", "), eq(r"\bar{\mathrm{BC}}=11\mathrm{cm}"), text("이고, 넓이는 "), eq(r"19\times11=209\mathrm{cm}^{2}")])
        doc.line([text("채점 기준: 대각선의 길이 조건으로 직사각형임을 설명함 "), text("[1점]"), text("; 둘레 관계를 식으로 나타냄 "), text("[1점]"), text("; "), eq(r"x=6"), text("을 구함 "), text("[2점]"), text("; 넓이 "), eq(r"209\mathrm{cm}^{2}"), text("를 구함 "), text("[2점]")], metadata=True)
        doc.line([text("답만 쓴 경우: 직사각형이라는 종류 [1점], 미지수의 값 [1점], 넓이 [1점]을 각각 합산하여 최대 [3점]을 부여한다. 모두 틀리면 [0점]이다. 풀이에서 앞 단계의 계산 오류를 일관되게 사용한 후속 넓이 계산은 인정한다.")], metadata=True)

        doc.new_page()
        doc.line([text("서술형 4번 [6점]")], metadata=True)
        doc.line([text("마름모의 네 변은 같으므로 삼각형 "), eq(r"\mathrm{ABC}"), text("는 "), eq(r"\bar{\mathrm{AB}}=\bar{\mathrm{BC}}"), text("인 이등변삼각형이다. 따라서 "), eq(r"\angle\mathrm{BAC}=\angle\mathrm{ACB}=2x^{\circ}")])
        doc.line([text("또한 마름모의 대각선 "), eq(r"\bar{\mathrm{AC}}"), text("는 "), eq(r"\angle\mathrm{A}"), text("를 이등분하므로 삼각형 "), eq(r"\mathrm{ABC}"), text("의 세 각의 합에서 ")])
        doc.line([eq(r"2(2x)+(4x+20)=180")])
        doc.line([eq(r"8x+20=180"), text("에서 "), eq(r"x=20")])
        doc.line([text("따라서 "), eq(r"\angle\mathrm{A}=\angle\mathrm{C}=80^{\circ}"), text(", "), eq(r"\angle\mathrm{B}=\angle\mathrm{D}=100^{\circ}")])
        doc.line([text("채점 기준: 이등변삼각형과 대각선의 성질을 설명함 [2점]; 각의 합으로 "), eq(r"x=20"), text("을 구함 [2점]; 네 각의 크기를 모두 구함 [2점].")], metadata=True)
        doc.line([text("답만 쓴 경우: 미지수와 네 각 전체가 모두 정답이면 [3점], 미지수만 정답이거나 네 각 전체만 정답이면 [2점]이다. 네 각 중 일부 정답에는 점수를 더하지 않으며, 나머지는 [0점]이다.")], metadata=True)
        doc.save(teacher)


if __name__ == "__main__":
    write_student()
    write_teacher()
