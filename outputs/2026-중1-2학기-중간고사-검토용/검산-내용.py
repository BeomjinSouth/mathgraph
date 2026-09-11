"""review_scaffold.py가 만든 문항별-검산.json에 문항별 수학 검토 근거를 채운다.

이 스크립트는 수학적 풀이·모든 보기 판정만 기록한다. PDF 전체 쪽 검토와 별도
검토 결과는 실제 확인 후 별도로 기록해야 한다.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def option(label, ok, reason):
    return {"label": label, "satisfies_prompt": ok, "reason": reason}


REVIEWS = {
    "MC1": {
        "answer": "②",
        "derivation": "한 직선 위에 있지 않은 세 점은 하나의 평면을 정한다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 1번에서 세 점이 정하는 평면과 각 오답의 반례를 설명한 결론과 일치한다.",
        "options": [
            option("①", False, "서로 다른 두 점을 지나는 직선은 하나이다."),
            option("②", True, "한 직선 위에 있지 않은 세 점을 지나는 평면은 하나이다."),
            option("③", False, "서로 평행한 두 평면은 만나지 않으므로 항상 한 직선에서 만나지 않는다."),
            option("④", False, "한 평면 위에 있지 않은 네 점은 한 평면 위에 모두 놓일 수 없다."),
            option("⑤", False, "서로 다른 두 직선은 평행하거나 꼬인 위치일 수 있다."),
        ],
    },
    "MC2": {
        "answer": "④",
        "derivation": "A, B, C, D 순서에서 AB와 AC는 모두 A에서 시작하여 오른쪽으로 뻗는다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 2번의 시작점과 방향 판정과 일치한다.",
        "options": [
            option("①", False, "AB와 BA는 시작점과 방향이 모두 다르다."),
            option("②", False, "BC와 CB는 시작점이 다르고 방향도 반대이다."),
            option("③", False, "CA와 CD는 같은 C에서 시작하지만 방향이 반대이다."),
            option("④", True, "AB와 AC는 시작점 A와 방향이 같다."),
            option("⑤", False, "DA와 BD는 시작점이 서로 다르므로 같은 반직선이 아니다."),
        ],
    },
    "MC3": {
        "answer": "③",
        "derivation": "P는 평면 α 위, Q는 평면 α 밖이므로 PQ는 P에서만 α와 만난다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 3번의 P∈α, Q∉α 근거와 일치한다.",
        "options": [
            option("①", False, "Q가 α 위에 있지 않아 PQ 전체가 α 위에 있지 않다."),
            option("②", False, "P라는 공통점이 있으므로 평행하지 않다."),
            option("③", True, "P만 평면 α 위에 있으므로 P에서만 만난다."),
            option("④", False, "P가 공통점이다."),
            option("⑤", False, "P와 Q의 위치로 관계가 충분히 정해진다."),
        ],
    },
    "MC4": {
        "answer": "⑤",
        "derivation": "평행선의 같은 쪽 안쪽 각의 합은 180°이므로 x=68이다.",
        "calculation_required": True,
        "calculations": [{"left": "112+x", "right": "180", "bindings": {"x": "68"}, "relation": "=", "reason": "같은 쪽 안쪽 두 각의 합에 x=68을 대입한다."}],
        "teacher_agreement": "교사용 4번의 112°+x°=180°와 x=68 결론과 일치한다.",
        "options": [
            option("①", False, "112와 56의 합은 168이라서 같은 쪽 안쪽 각의 합이 아니다."),
            option("②", False, "112와 112의 합은 224이다."),
            option("③", False, "112와 124의 합은 236이다."),
            option("④", False, "각의 크기는 0°와 180° 사이여야 하며 292는 불가능하다."),
            option("⑤", True, "112+68=180이다."),
        ],
    },
    "MC5": {
        "answer": "①",
        "derivation": "세 변으로 삼각형을 만들려면 가장 긴 변보다 나머지 두 변의 합이 커야 한다.",
        "calculation_required": True,
        "calculations": [
            {"left": "3+4", "right": "5", "relation": ">", "reason": "①의 두 짧은 변의 합이 가장 긴 변보다 크다."},
            {"left": "2+3", "right": "5", "relation": "=", "reason": "②는 삼각형 부등식을 만족하지 않는다."},
        ],
        "teacher_agreement": "교사용 5번의 삼각형 부등식 판정과 일치한다.",
        "options": [
            option("①", True, "3+4>5이므로 작도할 수 있다."),
            option("②", False, "2+3=5이므로 세 점이 일직선이 된다."),
            option("③", False, "2+3<6이다."),
            option("④", False, "1+2=3이다."),
            option("⑤", False, "1+2<4이다."),
        ],
    },
    "MC6": {
        "answer": "④",
        "derivation": "두 변의 길이와 그 끼인각의 크기가 각각 같으면 SAS 합동이다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 6번의 SAS 합동 조건 설명과 일치한다.",
        "options": [
            option("①", False, "세 각만 같으면 크기가 다른 닮은 삼각형이 가능하다."),
            option("②", False, "두 변만으로는 끼인각을 바꿀 수 있다."),
            option("③", False, "한 변과 한 각만으로는 삼각형이 정해지지 않는다."),
            option("④", True, "두 변과 그 끼인각이 각각 같으면 SAS 합동이다."),
            option("⑤", False, "세 변 중 두 변만 같아도 남은 변 또는 각을 바꿀 수 있다."),
        ],
    },
    "MC7": {
        "answer": "②",
        "derivation": "한 꼭짓점에서 자기 자신과 양옆 두 꼭짓점을 제외하면 5개가 남는다.",
        "calculation_required": True,
        "calculations": [{"left": "8-3", "right": "5", "relation": "=", "reason": "팔각형 한 꼭짓점에서 대각선을 그을 수 있는 꼭짓점 수이다."}],
        "teacher_agreement": "교사용 7번의 8−3 계산과 일치한다.",
        "options": [
            option("①", False, "자기 자신과 양옆을 모두 제외하지 않은 값이다."),
            option("②", True, "8−3=5이다."),
            option("③", False, "양옆 꼭짓점 하나를 잘못 포함한 값이다."),
            option("④", False, "자기 자신만 제외한 값에 가깝다."),
            option("⑤", False, "대각선 수가 꼭짓점 수와 같을 수 없다."),
        ],
    },
    "MC8": {
        "answer": "⑤",
        "derivation": "정다각형의 외각의 합 360°를 한 외각 24°로 나눈다.",
        "calculation_required": True,
        "calculations": [{"left": "360/24", "right": "15", "relation": "=", "reason": "외각의 합으로 변의 수를 구한다."}],
        "teacher_agreement": "교사용 8번의 360÷24=15와 일치한다.",
        "options": [
            option("①", False, "12각형의 한 외각은 30°이다."),
            option("②", False, "14각형의 한 외각은 360/14°이다."),
            option("③", False, "16각형의 한 외각은 22.5°이다."),
            option("④", False, "18각형의 한 외각은 20°이다."),
            option("⑤", True, "15각형의 한 외각은 24°이다."),
        ],
    },
    "MC9": {
        "answer": "③",
        "derivation": "12각형의 내각의 합은 (12−2)×180°이다.",
        "calculation_required": True,
        "calculations": [{"left": "(12-2)*180", "right": "1800", "relation": "=", "reason": "다각형 내각의 합 공식에 n=12를 대입한다."}],
        "teacher_agreement": "교사용 9번의 계산과 일치한다.",
        "options": [
            option("①", False, "1440°는 십각형의 내각의 합이다."),
            option("②", False, "1620°는 11각형의 내각의 합이다."),
            option("③", True, "(12−2)×180°=1800°이다."),
            option("④", False, "1980°는 13각형의 내각의 합이다."),
            option("⑤", False, "2160°는 14각형의 내각의 합이다."),
        ],
    },
    "MC10": {
        "answer": "①",
        "derivation": "호의 길이는 원둘레의 80/360배이다.",
        "calculation_required": True,
        "calculations": [{"left": "2*9*80/360", "right": "4", "relation": "=", "reason": "π를 제외한 호의 길이 계수를 계산한다."}],
        "teacher_agreement": "교사용 10번의 4πcm 결론과 일치한다.",
        "options": [
            option("①", True, "2π×9×80/360=4πcm이다."),
            option("②", False, "반지름 또는 중심각의 비를 절반으로 잘못 적용한 값이다."),
            option("③", False, "80/360의 비를 잘못 계산한 값이다."),
            option("④", False, "중심각의 비를 잘못 적용한 값이다."),
            option("⑤", False, "원의 전체 둘레보다 큰 값이다."),
        ],
    },
    "MC11": {
        "answer": "④",
        "derivation": "부채꼴의 넓이는 원의 넓이의 150/360배이다.",
        "calculation_required": True,
        "calculations": [{"left": "6**2*150/360", "right": "15", "relation": "=", "reason": "π를 제외한 부채꼴 넓이 계수를 계산한다."}],
        "teacher_agreement": "교사용 11번의 15πcm² 결론과 일치한다.",
        "options": [
            option("①", False, "중심각의 비를 잘못 적용한 값이다."),
            option("②", False, "반지름 제곱 또는 중심각의 비를 잘못 적용한 값이다."),
            option("③", False, "150/360의 비를 반올림해 잘못 계산한 값이다."),
            option("④", True, "π×6²×150/360=15πcm²이다."),
            option("⑤", False, "원의 넓이 36π보다 큰 비율을 적용한 값이다."),
        ],
    },
    "MC12": {
        "answer": "②",
        "derivation": "오각기둥은 꼭짓점 10개, 모서리 15개, 면 7개이다.",
        "calculation_required": True,
        "calculations": [{"left": "5*3", "right": "15", "relation": "=", "reason": "밑면 모서리 5개씩 두 묶음과 옆모서리 5개의 합이다."}],
        "teacher_agreement": "교사용 12번의 꼭짓점·모서리·면 계산과 일치한다.",
        "options": [
            option("①", False, "꼭짓점 수를 한 밑면만 세었다."),
            option("②", True, "꼭짓점 10개, 모서리 15개, 면 7개이다."),
            option("③", False, "면 수가 밑면 두 개를 반영하지 못했다."),
            option("④", False, "모서리 수를 과다하게 셌다."),
            option("⑤", False, "꼭짓점 수가 맞지 않는다."),
        ],
    },
    "MC13": {
        "answer": "⑤",
        "derivation": "CG는 AB와 만나지 않고 평행하지도 않으므로 꼬인 위치이다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 13번의 모서리 위치 관계 설명과 일치한다.",
        "options": [
            option("①", False, "CD는 AB와 평행하다."),
            option("②", False, "AE는 A에서 AB와 만난다."),
            option("③", False, "EF는 AB와 평행하다."),
            option("④", False, "BF는 B에서 AB와 만난다."),
            option("⑤", True, "CG는 AB와 만나지 않고 평행하지 않다."),
        ],
    },
    "MC14": {
        "answer": "③",
        "derivation": "직육면체의 세 쌍의 합동인 면 넓이를 모두 더한다.",
        "calculation_required": True,
        "calculations": [{"left": "2*(3*4+4*5+5*3)", "right": "94", "relation": "=", "reason": "가로·세로, 세로·높이, 높이·가로 면을 각각 두 장씩 더한다."}],
        "teacher_agreement": "교사용 14번의 94cm² 계산과 일치한다.",
        "options": [
            option("①", False, "한 쌍의 면을 누락한 값이다."),
            option("②", False, "세 면 넓이의 합을 잘못 더한 값이다."),
            option("③", True, "2(3×4+4×5+5×3)=94cm²이다."),
            option("④", False, "계산 결과가 94와 다르다."),
            option("⑤", False, "계산 결과가 94와 다르다."),
        ],
    },
    "MC15": {
        "answer": "①",
        "derivation": "각기둥의 부피는 밑넓이와 높이의 곱이다.",
        "calculation_required": True,
        "calculations": [{"left": "5*4*7", "right": "140", "relation": "=", "reason": "직사각형 밑넓이 20과 높이 7을 곱한다."}],
        "teacher_agreement": "교사용 15번의 140cm³ 계산과 일치한다.",
        "options": [
            option("①", True, "5×4×7=140cm³이다."),
            option("②", False, "밑넓이 또는 높이를 잘못 곱한 값이다."),
            option("③", False, "밑넓이 또는 높이를 잘못 곱한 값이다."),
            option("④", False, "밑넓이 또는 높이를 잘못 곱한 값이다."),
            option("⑤", False, "두 배를 잘못 적용한 값이다."),
        ],
    },
    "MC16": {
        "answer": "④",
        "derivation": "원뿔의 부피는 같은 밑넓이와 높이인 원기둥 부피의 1/3이다.",
        "calculation_required": True,
        "calculations": [{"left": "(1/3)*3**2*8", "right": "24", "relation": "=", "reason": "π를 제외한 원뿔 부피 계수를 계산한다."}],
        "teacher_agreement": "교사용 16번의 24πcm³ 계산과 일치한다.",
        "options": [
            option("①", False, "1/3 또는 반지름 제곱을 잘못 적용한 값이다."),
            option("②", False, "계산 결과가 24π와 다르다."),
            option("③", False, "1/3을 빼고 계산한 값과도 다르다."),
            option("④", True, "(1/3)π×3²×8=24πcm³이다."),
            option("⑤", False, "원기둥 부피 72π를 그대로 쓴 값이다."),
        ],
    },
    "MC17": {
        "answer": "②",
        "derivation": "구의 겉넓이는 4πr²이다.",
        "calculation_required": True,
        "calculations": [{"left": "4*4**2", "right": "64", "relation": "=", "reason": "π를 제외한 구의 겉넓이 계수를 계산한다."}],
        "teacher_agreement": "교사용 17번의 64πcm² 계산과 일치한다.",
        "options": [
            option("①", False, "4πr²의 계수 또는 제곱을 빠뜨린 값이다."),
            option("②", True, "4π×4²=64πcm²이다."),
            option("③", False, "계수 4를 2로 잘못 적용한 값이다."),
            option("④", False, "계수 또는 반지름 제곱을 과다 적용한 값이다."),
            option("⑤", False, "반지름을 한 번 더 제곱한 값에 가깝다."),
        ],
    },
    "MC18": {
        "answer": "⑤",
        "derivation": "다섯 자료의 합을 자료 수 5로 나눈다.",
        "calculation_required": True,
        "calculations": [{"left": "(4+6+8+10+12)/5", "right": "8", "relation": "=", "reason": "주어진 다섯 자료의 평균을 계산한다."}],
        "teacher_agreement": "교사용 18번의 평균 8 계산과 일치한다.",
        "options": [
            option("①", False, "자료의 평균은 6이 아니다."),
            option("②", False, "자료의 평균은 7이 아니다."),
            option("③", False, "자료의 평균은 9가 아니다."),
            option("④", False, "자료의 평균은 10이 아니다."),
            option("⑤", True, "(4+6+8+10+12)/5=8이다."),
        ],
    },
    "MC19": {
        "answer": "③",
        "derivation": "자료 수가 6개이므로 세 번째와 네 번째 자료의 평균이 중앙값이다.",
        "calculation_required": True,
        "calculations": [{"left": "(4+5)/2", "right": "9/2", "relation": "=", "reason": "정렬된 자료의 가운데 두 수를 평균낸다."}],
        "teacher_agreement": "교사용 19번의 9/2 결론과 일치한다.",
        "options": [
            option("①", False, "4는 세 번째 자료일 뿐 중앙값이 아니다."),
            option("②", False, "17/4은 가운데 두 자료의 평균이 아니다."),
            option("③", True, "(4+5)/2=9/2이다."),
            option("④", False, "5는 네 번째 자료일 뿐 중앙값이 아니다."),
            option("⑤", False, "6은 가운데 두 자료의 평균이 아니다."),
        ],
    },
    "MC20": {
        "answer": "①",
        "derivation": "20 이상인 자료는 20, 20, 24, 27, 31, 35로 여섯 개이다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 20번의 해당 자료 열거와 여섯 개 결론과 일치한다.",
        "options": [
            option("①", True, "20 이상 자료가 여섯 개이다."),
            option("②", False, "20이 두 번 나타난 것을 하나로 세면 안 된다."),
            option("③", False, "24, 27, 31, 35를 일부 누락한 수이다."),
            option("④", False, "20 이상 자료는 일곱 개가 아니다."),
            option("⑤", False, "20 이상 자료는 여덟 개가 아니다."),
        ],
    },
    "MC21": {
        "answer": "④",
        "derivation": "30은 30 이상이고 40 미만이므로 30≤x<40 계급에 속한다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 21번의 30≤30<40 판정과 일치한다.",
        "options": [
            option("①", False, "30은 10≤x<20 범위에 없다."),
            option("②", False, "20≤x<30은 오른쪽 끝값 30을 포함하지 않는다."),
            option("③", False, "30은 40≤x<50 범위에 없다."),
            option("④", True, "30≤30<40이다."),
            option("⑤", False, "두 계급을 합친 범위는 한 계급이 아니다."),
        ],
    },
    "MC22": {
        "answer": "③",
        "derivation": "계급 너비가 모두 같으므로 히스토그램 직사각형의 높이는 도수에 비례하고, 최대 도수는 8이다.",
        "calculation_required": False,
        "calculations": [],
        "teacher_agreement": "교사용 22번의 계급 너비와 최대 도수 설명과 일치한다.",
        "options": [
            option("①", False, "도수 2는 최대 도수가 아니다."),
            option("②", False, "도수 5는 최대 도수가 아니다."),
            option("③", True, "20≤x<30의 도수 8이 가장 크다."),
            option("④", False, "도수 5는 최대 도수가 아니다."),
            option("⑤", False, "도수분포표에 각 계급의 도수가 제시되어 있다."),
        ],
    },
    "MC23": {
        "answer": "⑤",
        "derivation": "네 계급 도수의 합이 30이므로 a=12이고, 10≤x<30의 도수는 9+12=21이다.",
        "calculation_required": True,
        "calculations": [
            {"left": "4+9+a+5", "right": "30", "bindings": {"a": "12"}, "relation": "=", "reason": "전체 도수 30에 a=12를 대입한다."},
            {"left": "9+12", "right": "21", "relation": "=", "reason": "10≤x<20과 20≤x<30의 도수를 더한다."},
        ],
        "teacher_agreement": "교사용 23번의 a=12와 21개 결론 및 계산과 일치한다.",
        "options": [
            option("①", False, "a=10이면 전체 도수가 28이 된다."),
            option("②", False, "a=12는 맞지만 10≤x<30의 도수는 21이다."),
            option("③", False, "a=12는 맞지만 10≤x<30의 도수는 21이다."),
            option("④", False, "a=13이면 전체 도수가 31이 된다."),
            option("⑤", True, "a=12이고 9+12=21이다."),
        ],
    },
}


def populate(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    seen = {item.get("id") for item in data.get("items", [])}
    if seen != set(REVIEWS):
        raise ValueError("최종 학생용에서 만든 문항 ID와 검산 원본이 일치하지 않습니다.")
    for item in data["items"]:
        review = REVIEWS[item["id"]]
        item.update(review)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "items": len(data["items"])}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    print(json.dumps(populate(args.path), ensure_ascii=False))
