"""중1 2학기 수학 중간고사 검토용 HWPX를 새 파일로 만드는 재실행 코드.

실행 예:
  <python> -B 제작.py --preflight
  <python> -B 제작.py --build

한글 자동화와 원안지·수식 도구는 현행 pbj-exam-hwpx 스킬을 사용한다.
이 스크립트는 기존 최종 파일을 덮어쓰지 않는다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile


ROOT = Path(__file__).resolve().parent
DEFAULT_SKILL_ROOT = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")
DEFAULT_MATHGRAPH_ROOT = Path(
    r"C:\Users\pbj95\Documents\wt\mathGraph\사진-한글-연속확인-20260909-20260909-8fa3"
)


def text(value: str):
    return ("text", value)


def equation(value: str):
    return ("eq", value)


T = text
E = equation


POINTS = [3, 3, 3, 3] + [4] * 9 + [5] * 8 + [6, 6]
METADATA = {
    "year": 2026,
    "semester": 2,
    "round": 1,
    "grade": 1,
    "pages": 4,
    "sheets": 4,
    "exam_title": "2026학년도 2학기 중간고사(검토)",
    "footer_kind": "중간고사 검토용",
    "mc_points": POINTS,
    "essay_points": [],
}


ITEMS = [
    {
        "id": "MC1",
        "points": 3,
        "stem": [T("다음 설명 중 옳은 것은?"),],
        "choices": [
            [T("서로 다른 두 점을 지나는 직선은 두 개이다.")],
            [T("한 직선 위에 있지 않은 세 점을 지나는 평면은 하나이다.")],
            [T("서로 다른 두 평면은 항상 한 직선에서 만난다.")],
            [T("한 평면 위에 있지 않은 네 점을 지나는 평면은 하나이다.")],
            [T("서로 다른 두 직선은 항상 한 점에서 만난다.")],
        ],
        "rows": (1, 1, 1, 1, 1),
        "answer": "②",
        "teacher": [
            [T("정답: ②")],
            [T("한 직선 위에 있지 않은 세 점을 지나도록 정해지는 평면은 하나이다.")],
            [T("①은 직선이 하나이고, ③은 서로 평행한 두 평면이 반례이며, ④와 ⑤도 항상 성립하지 않는다.")],
        ],
    },
    {
        "id": "MC2",
        "points": 3,
        "stem": [
            T("한 직선 위에 네 점 "), E(r"\mathrm{A},\mathrm{B},\mathrm{C},\mathrm{D}"),
            T("가 이 순서로 놓여 있다. 다음 중 서로 같은 반직선인 것은?"),
        ],
        "choices": [
            [E(r"\overrightarrow{\mathrm{AB}}"), T("와 "), E(r"\overrightarrow{\mathrm{BA}}")],
            [E(r"\overrightarrow{\mathrm{BC}}"), T("와 "), E(r"\overrightarrow{\mathrm{CB}}")],
            [E(r"\overrightarrow{\mathrm{CA}}"), T("와 "), E(r"\overrightarrow{\mathrm{CD}}")],
            [E(r"\overrightarrow{\mathrm{AB}}"), T("와 "), E(r"\overrightarrow{\mathrm{AC}}")],
            [E(r"\overrightarrow{\mathrm{DA}}"), T("와 "), E(r"\overrightarrow{\mathrm{BD}}")],
        ],
        "rows": (1, 1, 1, 1, 1),
        "answer": "④",
        "teacher": [
            [T("정답: ④")],
            [E(r"\overrightarrow{\mathrm{AB}}"), T("와 "), E(r"\overrightarrow{\mathrm{AC}}"), T("는 시작점이 같고 같은 방향으로 뻗는다.")],
            [T("나머지 짝은 시작점이 다르거나, 같은 시작점에서 서로 반대 방향이다.")],
        ],
    },
    {
        "id": "MC3",
        "points": 3,
        "stem": [
            T("평면 "), E(r"\alpha"), T(" 위에 점 "), E(r"\mathrm{P}"), T("가 있고, 점 "), E(r"\mathrm{Q}"),
            T("는 평면 "), E(r"\alpha"), T(" 위에 있지 않다. 직선 "), E(r"\mathrm{PQ}"),
            T("와 평면 "), E(r"\alpha"), T("의 위치 관계로 옳은 것은?"),
        ],
        "choices": [
            [E(r"\mathrm{PQ}"), T("는 평면 "), E(r"\alpha"), T(" 위에 있다.")],
            [E(r"\mathrm{PQ}"), T("는 평면 "), E(r"\alpha"), T("와 평행하다.")],
            [E(r"\mathrm{PQ}"), T("는 평면 "), E(r"\alpha"), T("와 점 "), E(r"\mathrm{P}"), T("에서만 만난다.")],
            [E(r"\mathrm{PQ}"), T("와 평면 "), E(r"\alpha"), T("는 공통점이 없다.")],
            [T("주어진 조건만으로는 알 수 없다.")],
        ],
        "rows": (1, 1, 1, 1, 1),
        "answer": "③",
        "teacher": [
            [T("정답: ③")],
            [E(r"\mathrm{P}\in\alpha"), T("이고 "), E(r"\mathrm{Q}\notin\alpha"), T("이므로 직선 "), E(r"\mathrm{PQ}"), T("가 평면 "), E(r"\alpha"), T(" 전체에 놓이거나 평행할 수는 없다.")],
            [T("공통점은 점 "), E(r"\mathrm{P}"), T("뿐이다.")],
        ],
    },
    {
        "id": "MC4",
        "points": 3,
        "stem": [
            T("그림과 같이 직선 "), E(r"l"), T("과 직선 "), E(r"m"), T("은 평행하고 직선 "), E(r"n"),
            T("은 두 직선과 만난다. 위쪽 같은 쪽 안쪽 각의 크기가 "), E(r"112^{\circ}"),
            T("일 때, 아래쪽 같은 쪽 안쪽 각의 크기 "), E(r"x^{\circ}"), T("를 구하여라."),
        ],
        "diagram": "MathGraph/평행선-같은쪽내각.내보내기.json",
        "choices": [[E(r"56^{\circ}")], [E(r"112^{\circ}")], [E(r"124^{\circ}")], [E(r"292^{\circ}")], [E(r"68^{\circ}")]],
        "rows": (3, 2),
        "answer": "⑤",
        "teacher": [
            [T("정답: ⑤")],
            [T("평행선과 한 직선이 만날 때 같은 쪽 안쪽 두 각의 크기의 합은 "), E(r"180^{\circ}"), T("이다.")],
            [E(r"112^{\circ}+x^{\circ}=180^{\circ},\quad x=68")],
        ],
    },
    {
        "id": "MC5",
        "points": 4,
        "stem": [T("다음 중 주어진 세 선분을 세 변으로 하는 삼각형을 작도할 수 있는 것은?"),],
        "choices": [
            [E(r"3\mathrm{cm},\ 4\mathrm{cm},\ 5\mathrm{cm}")],
            [E(r"2\mathrm{cm},\ 3\mathrm{cm},\ 5\mathrm{cm}")],
            [E(r"2\mathrm{cm},\ 3\mathrm{cm},\ 6\mathrm{cm}")],
            [E(r"1\mathrm{cm},\ 2\mathrm{cm},\ 3\mathrm{cm}")],
            [E(r"1\mathrm{cm},\ 2\mathrm{cm},\ 4\mathrm{cm}")],
        ],
        "rows": (3, 2),
        "answer": "①",
        "teacher": [
            [T("정답: ①")],
            [E(r"3+4>5"), T("이므로 ①은 삼각형을 만들 수 있다.")],
            [E(r"2+3=5,\quad2+3<6,\quad1+2=3,\quad1+2<4"), T("이므로 나머지는 두 변의 길이의 합이 나머지 한 변보다 크지 않다.")],
        ],
    },
    {
        "id": "MC6",
        "points": 4,
        "stem": [T("두 삼각형의 합동을 보장하는 조건은?"),],
        "choices": [
            [T("대응하는 세 각의 크기가 각각 같다.")],
            [T("대응하는 두 변의 길이가 각각 같다.")],
            [T("대응하는 한 변의 길이와 한 각의 크기가 각각 같다.")],
            [T("대응하는 두 변의 길이와 그 끼인각의 크기가 각각 같다.")],
            [T("대응하는 세 변 중 두 변의 길이가 각각 같다.")],
        ],
        "rows": (1, 1, 1, 1, 1),
        "answer": "④",
        "teacher": [
            [T("정답: ④")],
            [T("두 변의 길이와 그 끼인각의 크기가 각각 같으면 두 삼각형은 합동이다.")],
            [T("세 각만 같은 경우에는 닮음일 수 있고, 두 변 또는 한 변과 한 각만 같은 경우에는 모양이 하나로 정해지지 않는다.")],
        ],
    },
    {
        "id": "MC7",
        "points": 4,
        "stem": [E(r"8"), T("각형의 한 꼭짓점에서 그을 수 있는 대각선의 수는?"),],
        "choices": [[E(r"4")], [E(r"5")], [E(r"6")], [E(r"7")], [E(r"8")]],
        "rows": (5,),
        "answer": "②",
        "teacher": [
            [T("정답: ②")],
            [T("한 꼭짓점에서는 자기 자신과 양옆의 두 꼭짓점을 제외한다.")],
            [E(r"8-3=5")],
        ],
    },
    {
        "id": "MC8",
        "points": 4,
        "stem": [T("한 정다각형의 한 외각의 크기가 "), E(r"24^{\circ}"), T("일 때, 이 정다각형의 변의 수는?"),],
        "choices": [[E(r"12")], [E(r"14")], [E(r"16")], [E(r"18")], [E(r"15")]],
        "rows": (5,),
        "answer": "⑤",
        "teacher": [
            [T("정답: ⑤")],
            [T("정다각형의 한 꼭짓점에서의 외각의 크기의 합은 "), E(r"360^{\circ}"), T("이다.")],
            [E(r"360\div24=15")],
        ],
    },
    {
        "id": "MC9",
        "points": 4,
        "stem": [E(r"12"), T("각형의 내각의 크기의 합은?"),],
        "choices": [[E(r"1440^{\circ}")], [E(r"1620^{\circ}")], [E(r"1800^{\circ}")], [E(r"1980^{\circ}")], [E(r"2160^{\circ}")]],
        "rows": (3, 2),
        "answer": "③",
        "teacher": [
            [T("정답: ③")],
            [E(r"(12-2)\times180^{\circ}=1800^{\circ}")],
        ],
    },
    {
        "id": "MC10",
        "points": 4,
        "stem": [T("반지름의 길이가 "), E(r"9\mathrm{cm}"), T("이고 중심각의 크기가 "), E(r"80^{\circ}"), T("인 부채꼴의 호의 길이는?"),],
        "choices": [[E(r"4\pi\mathrm{cm}")], [E(r"2\pi\mathrm{cm}")], [E(r"6\pi\mathrm{cm}")], [E(r"8\pi\mathrm{cm}")], [E(r"12\pi\mathrm{cm}")]],
        "rows": (3, 2),
        "answer": "①",
        "teacher": [
            [T("정답: ①")],
            [E(r"2\pi\times9\times\frac{80}{360}=4\pi\mathrm{cm}")],
        ],
    },
    {
        "id": "MC11",
        "points": 4,
        "stem": [T("반지름의 길이가 "), E(r"6\mathrm{cm}"), T("이고 중심각의 크기가 "), E(r"150^{\circ}"), T("인 부채꼴의 넓이는?"),],
        "choices": [[E(r"10\pi\mathrm{cm}^{2}")], [E(r"12\pi\mathrm{cm}^{2}")], [E(r"18\pi\mathrm{cm}^{2}")], [E(r"15\pi\mathrm{cm}^{2}")], [E(r"24\pi\mathrm{cm}^{2}")]],
        "rows": (3, 2),
        "answer": "④",
        "teacher": [
            [T("정답: ④")],
            [E(r"\pi\times6^{2}\times\frac{150}{360}=15\pi\mathrm{cm}^{2}")],
        ],
    },
    {
        "id": "MC12",
        "points": 4,
        "stem": [E(r"5"), T("각기둥의 꼭짓점, 모서리, 면의 수를 차례로 바르게 나타낸 것은?"),],
        "choices": [
            [E(r"5,\ 10,\ 7")], [E(r"10,\ 15,\ 7")], [E(r"10,\ 15,\ 5")], [E(r"10,\ 20,\ 7")], [E(r"12,\ 15,\ 7")],
        ],
        "rows": (3, 2),
        "answer": "②",
        "teacher": [
            [T("정답: ②")],
            [T("밑면과 윗면의 꼭짓점 수는 각각 "), E(r"5"), T("개이므로 꼭짓점 수는 "), E(r"10"), T("개이다.")],
            [T("모서리 수: "), E(r"5\times3=15"), T(", 면의 수: "), E(r"5+2=7")],
        ],
    },
    {
        "id": "MC13",
        "points": 4,
        "stem": [T("그림과 같은 직육면체에서 모서리 "), E(r"\bar{\mathrm{AB}}"), T("와 꼬인 위치에 있는 모서리는?"),],
        "diagram": "MathGraph/직육면체-꼬인위치.내보내기.json",
        "choices": [[E(r"\bar{\mathrm{CD}}")], [E(r"\bar{\mathrm{AE}}")], [E(r"\bar{\mathrm{EF}}")], [E(r"\bar{\mathrm{BF}}")], [E(r"\bar{\mathrm{CG}}")]],
        "rows": (5,),
        "answer": "⑤",
        "teacher": [
            [T("정답: ⑤")],
            [E(r"\bar{\mathrm{CD}}"), T("와 "), E(r"\bar{\mathrm{EF}}"), T("는 "), E(r"\bar{\mathrm{AB}}"), T("와 평행하고, "), E(r"\bar{\mathrm{AE}}"), T("와 "), E(r"\bar{\mathrm{BF}}"), T("는 "), E(r"\bar{\mathrm{AB}}"), T("와 만난다.")],
            [E(r"\bar{\mathrm{CG}}"), T("는 "), E(r"\bar{\mathrm{AB}}"), T("와 만나지 않고 평행하지도 않으므로 꼬인 위치이다.")],
        ],
    },
    {
        "id": "MC14",
        "points": 5,
        "stem": [T("가로, 세로, 높이가 각각 "), E(r"3\mathrm{cm},\ 4\mathrm{cm},\ 5\mathrm{cm}"), T("인 직육면체의 겉넓이는?"),],
        "choices": [[E(r"74\mathrm{cm}^{2}")], [E(r"84\mathrm{cm}^{2}")], [E(r"94\mathrm{cm}^{2}")], [E(r"104\mathrm{cm}^{2}")], [E(r"114\mathrm{cm}^{2}")]],
        "rows": (3, 2),
        "answer": "③",
        "teacher": [
            [T("정답: ③")],
            [E(r"2\times(3\times4+4\times5+5\times3)=94\mathrm{cm}^{2}")],
        ],
    },
    {
        "id": "MC15",
        "points": 5,
        "stem": [T("밑면이 가로 "), E(r"5\mathrm{cm}"), T(", 세로 "), E(r"4\mathrm{cm}"), T("인 직사각형이고 높이가 "), E(r"7\mathrm{cm}"), T("인 각기둥의 부피는?"),],
        "choices": [[E(r"140\mathrm{cm}^{3}")], [E(r"120\mathrm{cm}^{3}")], [E(r"110\mathrm{cm}^{3}")], [E(r"100\mathrm{cm}^{3}")], [E(r"280\mathrm{cm}^{3}")]],
        "rows": (3, 2),
        "answer": "①",
        "teacher": [
            [T("정답: ①")],
            [E(r"5\times4\times7=140\mathrm{cm}^{3}")],
        ],
    },
    {
        "id": "MC16",
        "points": 5,
        "stem": [T("밑면의 반지름의 길이가 "), E(r"3\mathrm{cm}"), T("이고 높이가 "), E(r"8\mathrm{cm}"), T("인 원뿔의 부피는?"),],
        "choices": [[E(r"12\pi\mathrm{cm}^{3}")], [E(r"18\pi\mathrm{cm}^{3}")], [E(r"36\pi\mathrm{cm}^{3}")], [E(r"24\pi\mathrm{cm}^{3}")], [E(r"72\pi\mathrm{cm}^{3}")]],
        "rows": (3, 2),
        "answer": "④",
        "teacher": [
            [T("정답: ④")],
            [E(r"\frac{1}{3}\times\pi\times3^{2}\times8=24\pi\mathrm{cm}^{3}")],
        ],
    },
    {
        "id": "MC17",
        "points": 5,
        "stem": [T("반지름의 길이가 "), E(r"4\mathrm{cm}"), T("인 구의 겉넓이는?"),],
        "choices": [[E(r"16\pi\mathrm{cm}^{2}")], [E(r"64\pi\mathrm{cm}^{2}")], [E(r"32\pi\mathrm{cm}^{2}")], [E(r"128\pi\mathrm{cm}^{2}")], [E(r"256\pi\mathrm{cm}^{2}")]],
        "rows": (3, 2),
        "answer": "②",
        "teacher": [
            [T("정답: ②")],
            [E(r"4\pi\times4^{2}=64\pi\mathrm{cm}^{2}")],
        ],
    },
    {
        "id": "MC18",
        "points": 5,
        "stem": [T("다음 자료의 평균은? "), E(r"4,\ 6,\ 8,\ 10,\ 12")],
        "choices": [[E(r"6")], [E(r"7")], [E(r"9")], [E(r"10")], [E(r"8")]],
        "rows": (5,),
        "answer": "⑤",
        "teacher": [
            [T("정답: ⑤")],
            [E(r"\frac{4+6+8+10+12}{5}=8")],
        ],
    },
    {
        "id": "MC19",
        "points": 5,
        "stem": [T("다음 자료의 중앙값은? "), E(r"2,\ 4,\ 4,\ 5,\ 7,\ 9")],
        "choices": [[E(r"4")], [E(r"\frac{17}{4}")], [E(r"\frac{9}{2}")], [E(r"5")], [E(r"6")]],
        "rows": (5,),
        "answer": "③",
        "teacher": [
            [T("정답: ③")],
            [T("자료의 수가 짝수이므로 가운데 두 수의 평균을 구한다.")],
            [E(r"\frac{4+5}{2}=\frac{9}{2}")],
        ],
    },
    {
        "id": "MC20",
        "points": 5,
        "stem": [T("다음 줄기와 잎 그림에서 "), E(r"20"), T(" 이상인 자료의 수는?"),],
        "supplement": [
            [T("줄기 "), E(r"1"), T("의 잎: "), E(r"2,\ 6,\ 9")],
            [T("줄기 "), E(r"2"), T("의 잎: "), E(r"0,\ 0,\ 4,\ 7")],
            [T("줄기 "), E(r"3"), T("의 잎: "), E(r"1,\ 5")],
            [E(r"1\mid2=12"), T("로 약속한다.")],
        ],
        "choices": [[E(r"6")], [E(r"5")], [E(r"4")], [E(r"7")], [E(r"8")]],
        "rows": (5,),
        "answer": "①",
        "teacher": [
            [T("정답: ①")],
            [T("해당 자료는 "), E(r"20,\ 20,\ 24,\ 27,\ 31,\ 35"), T("이므로 모두 "), E(r"6"), T("개이다.")],
        ],
    },
    {
        "id": "MC21",
        "points": 5,
        "stem": [
            T("도수분포표의 계급이 "), E(r"10\leq x<20,\ 20\leq x<30,\ 30\leq x<40,\ 40\leq x<50"),
            T("일 때, 자료값 "), E(r"30"), T("이 속하는 계급은?"),
        ],
        "choices": [
            [E(r"10\leq x<20")], [E(r"20\leq x<30")], [E(r"40\leq x<50")], [E(r"30\leq x<40")], [E(r"10\leq x<30")],
        ],
        "rows": (1, 1, 1, 1, 1),
        "answer": "④",
        "teacher": [
            [T("정답: ④")],
            [E(r"30\leq30<40"), T("이므로 자료값은 "), E(r"30\leq x<40"), T("에 속한다.")],
            [E(r"20\leq x<30"), T("에서는 오른쪽 끝값 "), E(r"30"), T("을 포함하지 않는다.")],
        ],
    },
    {
        "id": "MC22",
        "points": 6,
        "stem": [T("다음 도수분포표를 히스토그램으로 나타낼 때, 가장 높은 직사각형의 밑변에 해당하는 계급은?"),],
        "supplement": [
            [T("계급 "), E(r"0\leq x<10"), T("의 도수: "), E(r"2")],
            [T("계급 "), E(r"10\leq x<20"), T("의 도수: "), E(r"5")],
            [T("계급 "), E(r"20\leq x<30"), T("의 도수: "), E(r"8")],
            [T("계급 "), E(r"30\leq x<40"), T("의 도수: "), E(r"5")],
        ],
        "choices": [
            [E(r"0\leq x<10")],
            [E(r"10\leq x<20")],
            [E(r"20\leq x<30")],
            [E(r"30\leq x<40")],
            [T("알 수 없다.")],
        ],
        "rows": (1, 1, 1, 1, 1),
        "answer": "③",
        "teacher": [
            [T("정답: ③")],
            [T("계급의 너비가 모두 같으므로, 히스토그램의 직사각형 높이는 도수에 비례한다.")],
            [T("가장 큰 도수는 "), E(r"8"), T("이고, 그 계급은 "), E(r"20\leq x<30"), T("이다.")],
        ],
    },
    {
        "id": "MC23",
        "points": 6,
        "stem": [T("전체 자료의 수가 "), E(r"30"), T("인 다음 도수분포표에서 "), E(r"a"), T("의 값과 "), E(r"10\leq x<30"), T("인 자료의 수를 차례로 바르게 나타낸 것은?"),],
        "supplement": [
            [T("계급 "), E(r"0\leq x<10"), T("의 도수: "), E(r"4")],
            [T("계급 "), E(r"10\leq x<20"), T("의 도수: "), E(r"9")],
            [T("계급 "), E(r"20\leq x<30"), T("의 도수: "), E(r"a")],
            [T("계급 "), E(r"30\leq x<40"), T("의 도수: "), E(r"5")],
        ],
        "choices": [[E(r"10,\ 20")], [E(r"12,\ 18")], [E(r"12,\ 20")], [E(r"13,\ 21")], [E(r"12,\ 21")]],
        "rows": (5,),
        "answer": "⑤",
        "teacher": [
            [T("정답: ⑤")],
            [E(r"4+9+a+5=30,\quad a=12")],
            [E(r"9+12=21"), T("이므로 "), E(r"10\leq x<30"), T("인 자료는 "), E(r"21"), T("개이다.")],
        ],
    },
]


BREAK_AFTER = {
    "MC3": "column",
    "MC6": "page",
    "MC11": "column",
    "MC15": "page",
    "MC20": "column",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def add_skill_modules(skill_root: Path):
    scripts = skill_root / "scripts"
    if not scripts.is_dir():
        raise FileNotFoundError(f"현행 시험지 스킬 scripts 폴더를 찾지 못했습니다: {scripts}")
    sys.path.insert(0, str(scripts))
    from equations import to_hwp
    from exam_tools import prepare
    from native_author import NativeDocument

    return to_hwp, prepare, NativeDocument


def validate_source(to_hwp):
    if len(ITEMS) != 23:
        raise ValueError("문항 수는 23개여야 합니다.")
    if [item["points"] for item in ITEMS] != POINTS or sum(POINTS) != 100:
        raise ValueError("확정 배점 구성과 문항 배점이 일치하지 않습니다.")
    for index, item in enumerate(ITEMS, 1):
        if item["id"] != f"MC{index}":
            raise ValueError("선택형 문항 번호가 연속하지 않습니다.")
        if len(item["choices"]) != 5:
            raise ValueError(f"{item['id']}의 보기는 다섯 개여야 합니다.")
        if item["answer"] not in "①②③④⑤":
            raise ValueError(f"{item['id']}의 정답 표기를 확인하세요.")
        for part_groups in (item["stem"], *item["choices"], *item.get("supplement", []), *item["teacher"]):
            for kind, value in part_groups:
                if kind == "eq":
                    to_hwp(value)
    for item in ITEMS:
        export = item.get("diagram")
        if export and not (ROOT / export).is_file():
            raise FileNotFoundError(f"MathGraph 내보내기 파일을 찾지 못했습니다: {export}")


def write_metadata(path: Path):
    path.write_text(json.dumps(METADATA, ensure_ascii=False, indent=2), encoding="utf-8")


def compact_cover_score_line(path: Path):
    """원안지의 고정 높이를 넘기지 않도록 반복되는 '문항'만 생략한다.

    문항 수·배점·총점은 그대로이며, 이 준비본은 곧 한글에서 다시 저장된다.
    """
    full = "3점×4문항=12점, 4점×9문항=36점, 5점×8문항=40점, 6점×2문항=12점"
    compact = "3점×4=12점, 4점×9=36점, 5점×8=40점, 6점×2=12점"
    temporary = path.with_suffix(".compact.tmp")
    with ZipFile(path, "r") as source, ZipFile(temporary, "w", ZIP_DEFLATED) as destination:
        replaced = 0
        for entry in source.infolist():
            data = source.read(entry.filename)
            if entry.filename == "Contents/section0.xml":
                original = data.decode("utf-8")
                replaced = original.count(full)
                data = original.replace(full, compact).encode("utf-8")
            destination.writestr(entry, data, compress_type=ZIP_STORED if entry.filename == "mimetype" else ZIP_DEFLATED)
    if replaced != 1:
        temporary.unlink(missing_ok=True)
        raise ValueError("표지 배점 문구를 한 번만 찾을 수 있어야 합니다.")
    temporary.replace(path)


def write_student(prepare, NativeDocument, runtime_root: Path, output: Path, metadata_path: Path):
    prepared = output / "준비본.hwpx"
    student = output / "학생용-중간고사-검토용.hwpx"
    prepare(metadata_path, prepared)
    # 표지의 배점 문구는 전달 검사가 참조하는 원안지 메타데이터와 정확히 같아야 한다.
    # 줄여 쓰면 한글 렌더는 가능해도 원본 표지 검증이 실패하므로 그대로 둔다.
    document = NativeDocument(prepared, mathgraph_root=str(runtime_root))
    with document as doc:
        doc.body_start()
        for item in ITEMS:
            doc.question(item["stem"], points=item["points"])
            for line in item.get("supplement", []):
                doc.line(line, style="지문")
            if item.get("diagram"):
                exported = json.loads((ROOT / item["diagram"]).read_text(encoding="utf-8"))
                doc.diagram(exported)
            doc.choices(item["choices"], rows=item["rows"])
            where = BREAK_AFTER.get(item["id"])
            if where == "column":
                doc.new_column()
            elif where == "page":
                doc.new_page()
        doc.save(student)
    return student, document.session.shutdown


def write_teacher(NativeDocument, runtime_root: Path, output: Path):
    teacher = output / "교사용-정답및해설.hwpx"
    document = NativeDocument(mathgraph_root=str(runtime_root))
    with document as doc:
        doc.line([T("중학교 1학년 2학기 수학 중간고사 검토용")], metadata=True)
        doc.line([T("정답 및 해설")])
        doc.line([T("모든 문항은 창작 검토 문항이며, 실제 시행일과 교시는 확정하지 않았다.")])
        for number, item in enumerate(ITEMS, 1):
            # 문항 제목과 해설을 분리하지 않도록, 검토용 해설은 6·13·20번 뒤에서 쪽을 나눈다.
            if item["id"] in {"MC7", "MC14", "MC21"}:
                doc.new_page()
            doc.line([T(f"선택형 {number}번 [{item['points']}점]")], metadata=True)
            for line in item["teacher"]:
                doc.line(line)
            doc.space(1)
        doc.save(teacher)
    return teacher, document.session.shutdown


def build(skill_root: Path, runtime_root: Path, output: Path):
    if output.exists():
        raise FileExistsError(f"새 출력 폴더가 필요합니다. 기존 폴더를 덮어쓰지 않습니다: {output}")
    if not (runtime_root / "runtime" / "hancom" / "hancom.py").is_file():
        raise FileNotFoundError(f"MathGraph 한글 입력 모듈을 찾지 못했습니다: {runtime_root}")
    to_hwp, prepare, NativeDocument = add_skill_modules(skill_root)
    validate_source(to_hwp)
    output.mkdir(parents=True)
    metadata_path = output / "시험정보.json"
    write_metadata(metadata_path)
    student, student_shutdown = write_student(prepare, NativeDocument, runtime_root, output, metadata_path)
    teacher, teacher_shutdown = write_teacher(NativeDocument, runtime_root, output)
    receipt = {
        "status": "HWPX_CREATED_NATIVE_VERIFICATION_PENDING",
        "student": student.name,
        "student_sha256": sha256(student),
        "teacher": teacher.name,
        "teacher_sha256": sha256(teacher),
        "metadata": metadata_path.name,
        "student_author_shutdown": student_shutdown,
        "teacher_author_shutdown": teacher_shutdown,
        "next": "strict 검사, native_verify.py PDF 출력, 전체 쪽·수학 검토, 독립 검토, delivery_check.py를 새 증거 파일로 실행해야 합니다.",
    }
    (output / "제작-실행기록.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    return receipt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skill-root", type=Path, default=DEFAULT_SKILL_ROOT)
    parser.add_argument("--runtime-root", type=Path, default=DEFAULT_MATHGRAPH_ROOT)
    parser.add_argument("--output", type=Path, default=ROOT / "최종본")
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--build", action="store_true")
    args = parser.parse_args()
    to_hwp, _, _ = add_skill_modules(args.skill_root)
    validate_source(to_hwp)
    if args.preflight:
        print(json.dumps({"ok": True, "questions": len(ITEMS), "points": sum(POINTS)}, ensure_ascii=False))
    if args.build:
        print(json.dumps(build(args.skill_root, args.runtime_root, args.output), ensure_ascii=False, indent=2))
    if not args.preflight and not args.build:
        parser.error("--preflight 또는 --build 중 하나를 지정하세요.")


if __name__ == "__main__":
    main()
