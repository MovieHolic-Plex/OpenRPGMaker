#!/usr/bin/env python3
"""스킨 행렬 요약 — dmx-<tag>-<id>-rects.json 마다 「저자가 못박은 줄」을 뺀 연속 줄 사이 최대 이동(px).
사용: python3 scripts/qa/runtime/dialogue-frame-matrix.py <tag> [--json]"""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from importlib import import_module
measure = import_module("dialogue-frame-measure".replace("-", "_")) if False else None
import importlib.util
spec = importlib.util.spec_from_file_location("m", os.path.join(os.path.dirname(__file__), "dialogue-frame-measure.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
tag = sys.argv[1]
rows = []
for path in sorted(glob.glob(f"verify-shots/runtime-qa/dmx-{tag}-*-rects.json")):
    sid = path.split(f"dmx-{tag}-")[1].replace("-rects.json", "")
    out = m.summarize(path)
    lines = out["lines"]
    worst = 0.0; worst_pair = ""; worstX = 0.0; worstX_pair = ""
    for a, b in zip(lines, lines[1:]):
        if "fixed" in (a.get("reason") or "") or "fixed" in (b.get("reason") or ""):
            # 저자가 그 줄만 못박은 자리(시험 마지막 줄) — 이동이 의도다. 제외.
            if a["pos"] != b["pos"]: continue
        d = max(abs(b["top"] - a["top"]), abs(b["bottom"] - a["bottom"]))
        # 좌우도 잰다 — 선택지 틀이 옆으로 줄어도 「창이 움직인다」. 단 skew 스킨의 화자 상자 기울임(의도된 장식)은 따로 본다.
        dx = max(abs((b.get("left") or 0) - (a.get("left") or 0)), abs((b.get("right") or 0) - (a.get("right") or 0)))
        if dx > worstX: worstX, worstX_pair = dx, f'{a["kind"]}->{b["kind"]}'
        if d > worst: worst, worst_pair = d, f'{a["kind"]}->{b["kind"]}'
    heights = sorted({l["height"] for l in lines if "fixed" not in (l.get("reason") or "")})
    rows.append({"id": sid, "lines": len(lines), "maxMovePx": round(worst, 1), "worst": worst_pair, "maxSidePx": round(worstX, 1), "worstSide": worstX_pair, "heights": heights,
                 "kinds": sorted({l["kind"] for l in lines})})
if "--json" in sys.argv:
    print(json.dumps(rows, ensure_ascii=False, indent=1)); sys.exit()
for r in rows:
    print(f'{r["id"]:28} lines={r["lines"]:2} maxMove={r["maxMovePx"]:6} {r["worst"]:22} side={r["maxSidePx"]:5} {r["worstSide"]:22} heights={r["heights"]} kinds={r["kinds"]}')
