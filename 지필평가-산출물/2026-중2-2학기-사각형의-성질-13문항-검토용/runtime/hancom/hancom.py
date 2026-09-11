"""이번 시험지 작성에 필요한 최소 한글 입력 어댑터이다.

`NativeDocument`가 요구하는 텍스트·문단·수식 입력만 지원한다.
그림을 넣지 않는 시험지이므로 MathGraph 그림 조합 기능은 의도적으로 포함하지 않는다.
"""


class Hancom:
    def _check_write_target(self, hwp):
        if hwp is None or hwp.XHwpDocuments.Count < 1:
            raise RuntimeError("한글의 작성 대상 문서를 확인하지 못했습니다.")

    def _text(self, hwp, value):
        param = hwp.HParameterSet.HInsertText
        hwp.HAction.GetDefault("InsertText", param.HSet)
        param.Text = value
        if not hwp.HAction.Execute("InsertText", param.HSet):
            raise RuntimeError("텍스트 입력에 실패했습니다.")

    def _break(self, hwp):
        if not hwp.HAction.Run("BreakPara"):
            raise RuntimeError("문단 나누기에 실패했습니다.")

    def _equation(self, hwp, script, font_size):
        param = hwp.HParameterSet.HEqEdit
        hwp.HAction.GetDefault("EquationCreate", param.HSet)
        param.EqFontName = "HancomEQN"
        param.BaseUnit = int(font_size * 100)
        param.string = script
        param.HSet.SetItem("TreatAsChar", 1)
        if not hwp.HAction.Execute("EquationCreate", param.HSet):
            raise RuntimeError("수식 입력에 실패했습니다.")
