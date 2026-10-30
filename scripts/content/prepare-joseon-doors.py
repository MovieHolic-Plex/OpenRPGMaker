#!/usr/bin/env python3
"""조선 등록 장소의 문 표 — link_joseon_interior 가 읽는다(src/project/defaults/joseonDoors.json).

입력: build-joseon-tileset.py 가 구운 tiledata/joseon-village/maps/<맵>.json(doors·walk·start)과
      등록 장소 카드(src/project/joseonPlaceReferences.ts 의 id ↔ sourceMapId).
출력: 장소마다
  - 바깥 맵(마을·국내성·사냥터): 건물 문 [{piece, name, door:[x,y] 막힌 문 칸, step:[x,y] 문 앞 칸}]
    · 건물 문은 디딤돌이 있는 문만 싣는다(디딤돌이 없는 대문·사립·성문·굴 입구는 통로라 문이 아니다).
    · 문 칸 = 디딤돌 바로 위의 막힌 칸(그 칸이 걸을 수 있는 처마 칸이면 그 위 막힌 칸까지 올라간다).
  - 실내 맵: 출구 [{door:[x,y] 출구 깔개, landing:[x,y] 들어오는 칸}]
  - 지문(fingerprint): 맵 크기 + 아랫층 칸 몇 개 — 가져온 맵이 이 장소 그대로인지 알아본다(고쳐 그린 맵은 표를 쓰지 않는다).
rebuild-joseon.sh 끝에서 돌린다. 인자 없음.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/content/lib"))
from joseon_tileset import names as NM  # noqa: E402

MAPS = ROOT / "tiledata/joseon-village/maps"
OUT = ROOT / "src/project/defaults/joseonDoors.json"
CARDS = (ROOT / "src/project/joseonPlaceReferences.ts").read_text(encoding="utf-8")

# 카드의 id ↔ sourceMapId (카드 순서 그대로)
pairs = re.findall(r'"id": "([^"]+)",[\s\S]*?"sourceMapId": "([^"]+)"', CARDS)


def fingerprint(m):
    """맵 크기와 아랫층 칸 16개(고르게 흩은 자리). 같은 장소를 가져온 맵이면 그대로 같다."""
    w, h, lower = m["width"], m["height"], m["lowerTiles"]
    n = len(lower)
    idx = sorted({(i * 7919) % n for i in range(1, 17)})
    return {"width": w, "height": h, "samples": [[i, lower[i]] for i in idx]}


places = {}
for place_id, map_id in pairs:
    f = MAPS / f"{map_id}.json"
    if not f.exists():
        print(f"건너뜀: {place_id} ({map_id}.json 없음)")
        continue
    m = json.loads(f.read_text(encoding="utf-8"))
    walk = m["walk"]
    W, H = m["width"], m["height"]
    ok = lambda x, y: 0 <= x < W and 0 <= y < H and walk[y][x] == "1"
    entry = {"sourceMapId": map_id, "fingerprint": fingerprint(m)}
    interior = map_id.startswith("joseon_in_")
    if interior:
        exits = []
        for d in m["doors"]:
            x, y = d["x"], d["y"]
            landing = [x, y - 1] if ok(x, y - 1) else None
            if landing is None:
                continue
            exits.append({"door": [x, y], "landing": landing})
        entry["kind"] = "interior"
        entry["exits"] = exits
    else:
        doors = []
        seen = set()
        for d in m["doors"]:
            st = d.get("step")
            if not st:
                continue  # 디딤돌 없는 대문·사립·굴 입구 = 통로
            sx, sy = st
            if not ok(sx, sy):
                continue
            # 디딤돌 위로 올라가 첫 막힌 칸이 문 칸(처마 아래 걸음 칸은 건너뛴다, 두 칸까지)
            door = None
            for dy in (1, 2, 3):
                if not ok(sx, sy - dy):
                    door = [sx, sy - dy]
                    break
            if not door or (sx, sy) in seen:
                continue
            seen.add((sx, sy))
            doors.append({"piece": d["piece"], "name": NM.ko_name(d["piece"]), "door": door, "step": [sx, sy]})
        entry["kind"] = "outdoor"
        entry["doors"] = doors
    places[place_id] = entry

OUT.write_text(json.dumps({"_note": "scripts/content/prepare-joseon-doors.py 생성 — 손으로 고치지 않는다", "places": places}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(OUT.relative_to(ROOT), {k: len(v.get("doors", v.get("exits", []))) for k, v in places.items()})
