#!/usr/bin/env python3
"""조건 V 계산 충실도의 기준: 시각 판정자(Opus 5.5 medium)가 칸 좌표가 그려진 목업(mockup-grid.png)에서 물건마다 칸 상자를 적는다.
조수에게는 주지 않는다(맵은 조수가 목업을 보고 깐다) — fidelity.py 의 «물건이 1칸 안에 놓였나»에만 쓴다.
  python3 mockup_objects.py <prep dir>  → prep/objects.json"""
import json, os, sys
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa"); import mapvqa
PREP = sys.argv[1]; cj = json.load(open(f"{PREP}/cells.json"))
PROMPT = f"""The image is a pixel-art room mockup with a cell grid drawn on it: column numbers along the top (x = 0..{cj['w'] - 1}), row numbers down the left (y = 0..{cj['h'] - 1}).
List every distinct object in the room — furniture, statues, columns, braziers, torches, banners, rugs, pits, chests, piles, plants, counters, tables, stairs — one entry per object (a row of 4 identical columns is 4 entries). Not floors, not walls, not doorways.
For each give its cell box using the printed coordinates: x0,y0 = top-left cell it covers, x1,y1 = bottom-right cell (inclusive).
Answer JSON only: {{"objects":[{{"name":"short name","box":[x0,y0,x1,y1]}}]}}"""
r = mapvqa.ask(os.environ.get("MOCKUP_JUDGE", "teamclaude/claude-opus-5-5@medium"), PROMPT, [f"{PREP}/mockup-grid.png"], f"mockobjs-{os.path.basename(PREP)}")
objs = []
for o in ((r.get("result") or {}).get("objects") or []):
    b = o.get("box")
    if isinstance(b, list) and len(b) == 4 and all(isinstance(v, (int, float)) for v in b):
        x0, y0, x1, y1 = (int(v) for v in b); objs.append({"name": str(o.get("name", ""))[:40], "box": [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]})
json.dump({"objects": objs, "meta": r.get("meta"), "error": r.get("error")}, open(f"{PREP}/objects.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps({"n": len(objs), "error": r.get("error")}))
