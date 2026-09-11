from pathlib import Path
import importlib.util
import json
import sys

ROOT = Path(__file__).resolve().parent
SKILL = Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")
RUNTIME = Path(r"C:\Users\pbj95\Documents\wt\mathGraph\사진-한글-연속확인-20260909-20260909-8fa3")
LOG = ROOT / "진단-실행기록.txt"

sys.path.insert(0, str(SKILL / "scripts"))
from native_author import NativeDocument

spec = importlib.util.spec_from_file_location("exam_builder", ROOT / "제작.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def log(message):
    print(message, flush=True)
    with LOG.open("a", encoding="utf-8") as stream:
        stream.write(message + "\n")


log("all-items-start")
document = NativeDocument(ROOT / "중단된-생성초안" / "준비본.hwpx", mathgraph_root=str(RUNTIME))
with document as doc:
    log("entered")
    doc.body_start()
    log("body-start")
    for item in builder.ITEMS:
        log(item["id"] + "-start")
        doc.question(item["stem"], points=item["points"])
        for line in item.get("supplement", []):
            doc.line(line, style="지문")
        if item.get("diagram"):
            doc.diagram(json.loads((ROOT / item["diagram"]).read_text(encoding="utf-8")))
        doc.choices(item["choices"], rows=item["rows"])
        log(item["id"] + "-done")
        where = builder.BREAK_AFTER.get(item["id"])
        if where == "column":
            doc.new_column()
        elif where == "page":
            doc.new_page()
log("closed=" + str(document.session.shutdown))
