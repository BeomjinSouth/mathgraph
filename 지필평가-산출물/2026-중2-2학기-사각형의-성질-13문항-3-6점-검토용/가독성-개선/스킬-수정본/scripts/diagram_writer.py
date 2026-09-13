"""Insert one MathGraph diagram as an inline, centered exam figure.

The PNG and its native equation labels share one paragraph anchor. The picture
is treated as a character; the floating label boxes flow with that paragraph.
"""
from pathlib import Path
import tempfile
from native_label_layout import NativeLabelLayout


HWPUNIT_PER_MM = 7200 / 25.4
LABEL_BOX = round(10 * HWPUNIT_PER_MM)


def _require(result, operation):
    if not result:
        raise RuntimeError(operation + "에 실패했습니다.")
    return result


def _set_paragraph_center(hwp):
    para = hwp.HParameterSet.HParaShape
    hwp.HAction.GetDefault("ParagraphShape", para.HSet)
    para.AlignType = 3
    para.PrevSpacing = 0
    para.NextSpacing = 0
    _require(hwp.HAction.Execute("ParagraphShape", para.HSet), "도형 문단 가운데 정렬")


def _label_shape(x_mm, y_mm, equation_width, equation_height):
    box_width = max(LABEL_BOX, equation_width + round(4 * HWPUNIT_PER_MM))
    box_height = max(LABEL_BOX, equation_height + round(2 * HWPUNIT_PER_MM))
    horizontal = (box_width - equation_width) // 2
    vertical = (box_height - equation_height) // 2
    return {
        "TreatAsChar": 0,
        "HorzRelTo": 3,
        "VertRelTo": 2,
        "HorzAlign": 0,
        "VertAlign": 0,
        "WidthRelTo": 4,
        "HeightRelTo": 2,
        "Width": box_width,
        "Height": box_height,
        "HorzOffset": round(x_mm * HWPUNIT_PER_MM) - horizontal,
        "VertOffset": round(y_mm * HWPUNIT_PER_MM) - vertical,
        "TextWrap": 3,
        "FlowWithText": 1,
        "AllowOverlap": 1,
        "Lock": 0,
        "ProtectSize": 0,
        "OutsideMarginLeft": 0,
        "OutsideMarginRight": 0,
        "OutsideMarginTop": 0,
        "OutsideMarginBottom": 0,
    }


def _diagram_label(hwp, writer, script, font_pt, x_mm, y_mm, layout=None, label=None, left_mm=0, width_mm=0):
    anchor = tuple(hwp.GetPos())
    param = hwp.HParameterSet.HShapeObject
    hwp.HAction.GetDefault("DrawObjCreatorTextBox", param.HSet)
    for key, value in {
        "TreatAsChar": 0,
        "HorzRelTo": 3,
        "VertRelTo": 2,
        "HorzAlign": 0,
        "VertAlign": 0,
        "WidthRelTo": 4,
        "HeightRelTo": 2,
        "Width": LABEL_BOX,
        "Height": LABEL_BOX,
        "HorzOffset": round(x_mm * HWPUNIT_PER_MM),
        "VertOffset": round(y_mm * HWPUNIT_PER_MM),
        "TextWrap": 3,
        "FlowWithText": 1,
        "AllowOverlap": 1,
        "Lock": 0,
        "ProtectSize": 0,
        "ShapeCreationMode": 0,
    }.items():
        param.HSet.SetItem(key, value)
    param.ShapeDrawLayOut.CreateNumPt = 4
    param.ShapeDrawLayOut.CreateItemArray("CreatePt", 8)
    for index, value in enumerate((0, 0, LABEL_BOX, 0, LABEL_BOX, LABEL_BOX, 0, LABEL_BOX)):
        param.ShapeDrawLayOut.CreatePt.SetItem(index, value)
    param.ShapeDrawLineAttr.HSet.SetItem("Style", 0)
    param.ShapeDrawFillAttr.HSet.SetItem("Type", 0)
    list_properties = param.ShapeListProperites.HSet
    list_properties.SetItem("VertAlign", 1)
    for key in ("MarginLeft", "MarginRight", "MarginTop", "MarginBottom"):
        list_properties.SetItem(key, 0)
    _require(hwp.HAction.Execute("DrawObjCreatorTextBox", param.HSet), "도형 라벨용 글상자 생성")
    box = hwp.CurSelectedCtrl
    if box is None or box.CtrlID != "gso":
        raise RuntimeError("도형 라벨용 글상자를 확인하지 못했습니다.")
    _require(hwp.HAction.Run("ShapeObjTextBoxEdit"), "도형 라벨용 글상자 편집")
    _set_paragraph_center(hwp)
    para=hwp.HParameterSet.HParaShape
    hwp.HAction.GetDefault('ParagraphShape',para.HSet)
    para.LeftMargin=0;para.RightMargin=0;para.Indentation=0
    para.LineSpacingType=0;para.LineSpacing=100;para.HeadingType=0
    _require(hwp.HAction.Execute('ParagraphShape',para.HSet),'라벨 내부 문단 여백 초기화')
    equation = writer._equation(hwp, script, font_pt)
    equation_properties = equation.Properties
    placement = None
    if layout is not None:
        placement = layout.place(label, int(equation_properties.Item('Width')), int(equation_properties.Item('Height')))
        x_mm = left_mm + placement['x'] * width_mm
        y_mm = placement['y'] * width_mm
    properties = box.Properties
    for key, value in _label_shape(
        x_mm,
        y_mm,
        int(equation_properties.Item("Width")),
        int(equation_properties.Item("Height")),
    ).items():
        properties.SetItem(key, value)
    box.Properties = properties
    hwp.HAction.Run("Cancel")
    hwp.SetPos(*anchor)
    return placement


def compose_inline_diagram(hwp, writer, diagram, column_width_mm):
    if diagram.get("kind") != "diagram":
        raise ValueError("지원하지 않는 한글 삽입 자료입니다.")
    width_mm = diagram["width_mm"]
    if width_mm > column_width_mm:
        raise ValueError("도형 폭이 현재 단 폭보다 큽니다.")

    anchor = tuple(hwp.GetPos())
    _set_paragraph_center(hwp)
    with tempfile.TemporaryDirectory(prefix="mathgraph-exam-diagram-") as directory:
        image = Path(directory) / "diagram.png"
        image.write_bytes(diagram["png"])
        picture = hwp.InsertPicture(
            str(image.resolve()),
            True,
            1,
            False,
            False,
            0,
            width_mm,
            width_mm * diagram["aspect"],
        )
        if picture is None:
            raise RuntimeError("MathGraph 그림 삽입에 실패했습니다.")
        after_picture = tuple(hwp.GetPos())
        hwp.SetPos(*anchor)
        _require(hwp.HAction.Run("SelectCtrlFront"), "삽입한 MathGraph 그림 선택")
        selected = hwp.CurSelectedCtrl
        if selected is None or selected.CtrlID != picture.CtrlID:
            raise RuntimeError("삽입한 MathGraph 그림을 확인하지 못했습니다.")
        properties = picture.Properties
        for key, value in {
            "TreatAsChar": 1,
            "FlowWithText": 1,
            "AllowOverlap": 0,
            "Lock": 0,
            "ProtectSize": 0,
            "OutsideMarginLeft": 0,
            "OutsideMarginRight": 0,
            "OutsideMarginTop": 0,
            "OutsideMarginBottom": 0,
        }.items():
            properties.SetItem(key, value)
        picture.Properties = properties
        hwp.HAction.Run("Cancel")

        left_mm = (column_width_mm - width_mm) / 2
        layout = NativeLabelLayout(diagram['png'], width_mm)
        placements = []
        for label in sorted(diagram["labels"], key=lambda item: item.get('is_point', False)):
            hwp.SetPos(*anchor)
            placement = _diagram_label(
                hwp,
                writer,
                label["script"],
                label["font_pt"],
                left_mm + label["x"] * width_mm,
                label["y"] * width_mm,
                layout, label, left_mm, width_mm,
            )
            placements.append(placement)

        hwp.SetPos(*after_picture)
        hwp.HAction.Run("MoveParaEnd")
        _require(hwp.HAction.Run("BreakPara"), "도형 뒤 문단 나누기")
        return {'schema': 1, 'width_mm': width_mm, 'labels': placements, 'collision_check': 'native-measurement-against-geometry'}
