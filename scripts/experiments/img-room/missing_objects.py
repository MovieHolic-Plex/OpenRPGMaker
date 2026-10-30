#!/usr/bin/env python3
"""조건 O 1단계: 시각 판정자(Opus 5.5 medium)가 자유 목업에서 칩셋에 맞는 조각이 없는 물건을 최대 6개 고르고,
object-gen 에 넘길 이름·설명·칸 크기·놓는 곳을 적는다.
  python3 missing_objects.py <mockup.png> <pieces.png> <pieces.txt> [max=6]  → stdout JSON {objects:[…], n, meta}"""
import json, os, re, sys
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa"); import mapvqa
mock, sheet, ids = sys.argv[1:4]
CAP = int(sys.argv[4]) if len(sys.argv) > 4 else 6
names = open(ids).read().strip().splitlines()
KINDS = ["tall_furniture", "low_furniture", "seat", "frame", "container", "round_body", "column", "box", "figure", "organic", "debris", "flat", "wall_mounted", "front_prop", "other"]
PROMPT = f"""Image 1 is a pixel-art room mockup (16px cells, 3/4 top-down). Image 2 is the chipset sheet the room will be built from; each piece is labelled with its id.
Allowed piece ids: {", ".join(names)}.
Find the objects in image 1 that have NO matching piece in image 2 (a different shape or an invented thing; a mere recolour of an existing piece does not count). Only free-standing or wall-hung OBJECTS: furniture, relics, statues, braziers, coffins, pools or hazards that sit on the floor as one patch. NOT floor or wall materials, NOT doors or doorways, NOT people.
Pick at most {CAP}, the ones that matter most for this room's identity (the landmark first). For each give what an artist needs to redraw it as one chipset piece:
- name: 2-4 English words, lower case
- brief: one sentence describing its look, materials and colours as seen in image 1
- w, h: its size in 16px cells as drawn in image 1 (whole drawing incl. the part that rises above its footprint; 1..5 each)
- anchor: floor (stands on the floor) | wall (stands against the north wall) | hang (hung on the wall face) | flat (lies flat on the floor, walkable)
- kind: one of {", ".join(KINDS)}
- where: rough place in image 1
Answer JSON only: {{"objects":[{{"name":"…","brief":"…","w":2,"h":3,"anchor":"floor","kind":"…","where":"…"}}]}}"""
r = mapvqa.ask(os.environ.get("MOCKUP_JUDGE", "teamclaude/claude-opus-5-5@medium"), PROMPT, [mock, sheet], f"missing-{os.path.basename(os.path.dirname(os.path.abspath(mock)))}")
res = r.get("result") or {}
out, seen = [], set()
for o in (res.get("objects") or [])[:CAP]:
    name = re.sub(r"[^a-z0-9 ]+", "", str(o.get("name", "")).lower()).strip()[:40]
    if not name or name in seen: continue
    seen.add(name)
    w = max(1, min(5, int(o.get("w") or 1))); h = max(1, min(5, int(o.get("h") or 1)))
    anchor = o.get("anchor") if o.get("anchor") in ("floor", "wall", "hang", "flat") else "floor"
    kind = o.get("kind") if o.get("kind") in KINDS else "other"
    if anchor == "flat": kind = "flat"
    if anchor == "hang": kind = "wall_mounted"
    out.append({"name": name, "brief": str(o.get("brief", ""))[:300], "w": w, "h": h, "anchor": anchor, "kind": kind, "where": o.get("where")})
print(json.dumps({"n": len(out), "objects": out, "meta": r.get("meta"), "error": r.get("error")}, ensure_ascii=False))
