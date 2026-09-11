from pathlib import Path
import importlib.util
import sys

ROOT = Path(__file__).resolve().parent
SKILL = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")
RUNTIME = Path(r"C:\Users\pbj95\Documents\wt\mathGraph\사진-한글-연속확인-20260909-20260909-8fa3")
sys.path.insert(0, str(SKILL / "scripts"))
from native_author import NativeDocument

spec = importlib.util.spec_from_file_location("exam_builder", ROOT / "제작.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

target = ROOT / "교사용-전체진단"
target.mkdir()
teacher, shutdown = builder.write_teacher(NativeDocument, RUNTIME, target)
print(teacher)
print(shutdown)
