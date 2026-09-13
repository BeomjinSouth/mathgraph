"""Regenerate only the three diagrams named in the user's visual review."""
from pathlib import Path
import json
import subprocess

BASE = Path(__file__).resolve().parent
OLD = BASE.parent / "가독성-개선" / "MathGraph"
OUT = BASE / "MathGraph"
NODE = r"C:\Users\pbj95\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
EXPORT = r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts\export_mathgraph.mjs"
PROJECT = r"C:\Users\pbj95\Desktop\mathGraph\dist"

jobs = [
    (OLD / "02.grapha.json", OUT / "02-길이호-5mm.json", 68.2,
     ["--angle-radius-mm", "source", "--length-arc-height-mm", "5"]),
    (OUT / "09-교점O.grapha.json", OUT / "09-각도호-5mm.json", 96,
     ["--angle-radius-mm", "5", "--length-arc-height-mm", "source"]),
    (OLD / "E2.grapha.json", OUT / "E2-각도호-5mm.json", 86,
     ["--angle-radius-mm", "5", "--length-arc-height-mm", "source"]),
]

for source, target, width, extra in jobs:
    if target.exists():
        raise FileExistsError(f"새 버전 경로가 필요합니다: {target}")
    command = [NODE, EXPORT, "--input", str(source), "--output", str(target),
               "--project", PROJECT, "--scale", "35", "--width-mm", str(width)]
    if width != 68.2:
        command += ["--width-reason", "사용자가 조정한 기존 그림·라벨의 인쇄 크기 보존"]
    command += extra
    subprocess.run(command, check=True)

    produced = json.loads(target.read_text(encoding="utf-8"))
    previous_name = {"02": "02-내보내기-v4.json", "09": "09-작은호-v2.json", "E2": "E2-작은호-v2.json"}[target.name[:2] if target.name[:2] != "E2" else "E2"]
    previous_path = (OLD / previous_name) if target.name.startswith("02") else (OUT / previous_name)
    previous = json.loads(previous_path.read_text(encoding="utf-8"))
    if abs(produced["diagram"]["aspect"] - previous["diagram"]["aspect"]) > 1e-10:
        raise RuntimeError(f"{target.name}: 기존 그림 비율이 바뀌었습니다.")
    print(target.name, produced["printProfile"])
