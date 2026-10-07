"""굽기(bake): 후보 시트 → 엔진이 읽는 타일셋 정의 + 물체(구조 킷) 목록.

그림은 후보가 정했고, 여기서는 **의미**를 붙인다 — 통행 4방향·층(priority)·지형 태그·오토타일 그룹·턱 방향·애니메이션·건물 입구.
의미는 칸 이름(후보 tiles.json 의 ids)에서 규칙으로 유도한다(손으로 칸마다 적지 않는다). 규칙 표는 seed.json `bake`.
산출: <run>/bake/{tileset.json, objects.json, semantic.json, sheet.png}. 번들·프로젝트에는 쓰지 않는다 — 사용자가 고른 뒤 wire 가 한다.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import px  # noqa: E402
from px import N, E, S, W, T  # noqa: E402

OPEN = dict(up=True, down=True, left=True, right=True)
VERT = dict(up=True, down=True, left=False, right=False)   # 이중문 문짝 칸: 남쪽에서 들어가고 나올 뿐, 문짝끼리 옆으로 옮겨 다니지 않는다
SHUT = dict(up=False, down=False, left=False, right=False)
TERRAIN = {"none": 0, "water": 1, "sand": 2, "snow": 3, "stone": 4, "tall_grass": 5}   # 0~4 는 chipsetMapping.TERRAIN_TAG, 5 는 포켓몬식 풀숲(프로젝트 지형 기록을 하나 더 심어야 한다)

OBJ_RE = re.compile(r"^(?P<name>.+)\.(?P<x>\d+)\.(?P<y>\d+)$")


def _alpha_class(sheet: np.ndarray, cols: int, i: int) -> str:
    r, c = divmod(i, cols)
    a = sheet[r * T:(r + 1) * T, c * T:(c + 1) * T, 3]
    if (a == 0).all():
        return "empty"
    if (a == 255).all():
        return "opaque"
    return "partial"


def edge_pass(mask: int) -> dict:
    """오토타일 변형의 통행: 이웃이 없는 변(= 돌 고리·낭떠러지 쪽)으로는 나가지도 들어오지도 못한다. 대각만 빠진 칸은 사방이 열린다."""
    return dict(up=bool(mask & N), down=bool(mask & S), left=bool(mask & W), right=bool(mask & E))


def bake(sheet_png: Path, tiles: dict, seed: dict, roles: dict, out: Path) -> dict:
    cols, count = tiles["cols"], tiles["count"]
    tiles_all = range(count)
    ids: dict[str, int] = tiles["ids"]
    rule = seed["bake"]
    sheet = np.array(Image.open(sheet_png).convert("RGBA"))
    n_rows = sheet.shape[0] // T
    total = cols * n_rows
    passability = [dict(SHUT) for _ in range(total)]
    priority = ["lower"] * total
    terrain = [0] * total
    label: dict[int, str] = {}
    ledge: dict[str, str] = {}
    slide: dict[str, str] = {}
    groups = []
    names_by_id = {v: k for k, v in ids.items()}

    def setp(i, p, tag=0, lay="lower", name=""):
        passability[i] = dict(p)
        terrain[i] = tag
        priority[i] = lay
        if name:
            label[i] = name

    # 시드가 선언한 규칙이 먼저(위에서 아래로 첫 일치) — 지역 시트는 bake.py 를 고치지 않고 seed.bake.rules 로 의미를 붙인다.
    # 항목: {"re": 정규식, "pass": "open"|"shut"|"edge", "terrain": TERRAIN 키, "label": 이름, "slide": SlideRule, "ledge": 방향, "layer": "lower"|"upper"}
    seed_rules = [(re.compile(r["re"]), r) for r in rule.get("rules", [])]
    claimed: set[int] = set()
    for name, i in ids.items():
        for rx, r in seed_rules:
            if rx.fullmatch(name):
                setp(i, OPEN if r.get("pass", "open") == "open" else SHUT, TERRAIN[r.get("terrain", "none")], r.get("layer", "lower"), r.get("label", name))
                if r.get("slide"):
                    slide[str(i)] = r["slide"]
                if r.get("ledge"):
                    ledge[str(i)] = r["ledge"]
                claimed.add(i)
                break
    # 바닥
    for name, i in ids.items():
        if i in claimed:
            continue
        if re.fullmatch(r"grass\d+", name):
            setp(i, OPEN, 0, "lower", "풀밭")
        elif re.fullmatch(r"tall\d+", name):
            setp(i, OPEN, TERRAIN["tall_grass"], "lower", "키 큰 풀(야생 조우)")
        elif re.fullmatch(r"sand\d+", name):
            setp(i, OPEN, TERRAIN["sand"], "lower", "모래")
        elif re.fullmatch(r"boulder\d+", name):
            setp(i, SHUT, 0, "lower", "바위(밀기 이벤트를 올릴 자리)")
        elif re.fullmatch(r"bush\d+", name):
            setp(i, SHUT, 0, "lower", "장식 덤불(막힘, 자르기 아님 — 자르기는 cuttree)")
        elif name == "mailbox":
            setp(i, SHUT, 0, "lower", "우편함(조사 이벤트를 올릴 자리)")
        elif name == "sign_metal":
            setp(i, SHUT, 0, "lower", "도로 표지판(조사 이벤트를 올릴 자리)")
        elif name.startswith("flower_") or name.startswith("flowerbed_"):
            setp(i, OPEN, 0, "lower", "꽃밭")
        elif name == "ledge_e":
            setp(i, OPEN, 0, "lower", "턱(동쪽으로만 뛰어내림)"); ledge[str(i)] = "right"
        elif name == "ledge_w":
            setp(i, OPEN, 0, "lower", "턱(서쪽으로만 뛰어내림)"); ledge[str(i)] = "left"
        elif name == "stairs_v":
            setp(i, OPEN, 0, "lower", "돌계단")
        elif name.startswith("bridge_"):
            setp(i, OPEN, 0, "lower", "나무다리(물 칸 위에 덮어 찍는다)")
        elif re.fullmatch(r"cave_floor\d+", name) or name == "cave_floor_s":
            setp(i, OPEN, 0, "lower", "동굴 바닥")
        elif re.fullmatch(r"int_(wood|tile|blue)\d+|int_(wood|tile|blue)_s|int_mat|int_stairs_down", name):
            setp(i, OPEN, 0, "lower", "실내 바닥" if name != "int_mat" else "출입 매트 — 이동 이벤트를 올릴 자리")
        elif re.fullmatch(r"int_void|int_wall_.*|int_side_[lr]", name):
            setp(i, SHUT, 0, "lower", "실내 벽·바깥(통행 불가)")
        elif name == "g2_plank_edge":
            setp(i, SHUT, 0, "lower", "나무단 앞턱(높이를 그린 칸이라 막힘 — 단에는 계단으로 오른다)")
        elif re.fullmatch(r"g2_fl_\w+", name):
            setp(i, OPEN, 0, "lower", "체육관 바닥")
        elif re.fullmatch(r"g2_mat_\w+", name):
            setp(i, OPEN, 0, "lower", "체육관 입구 매트 — 이동 이벤트를 올릴 자리")
        elif re.fullmatch(r"g2_(wall|edge)_\w+", name):
            setp(i, SHUT, 0, "lower", "체육관 뒷벽(통행 불가)")
        elif re.fullmatch(r"g2_spin_([udlr])(_s|_e)?", name):          # _s·_e = 벽·칸막이 그늘을 덮은 판(L8 N76·L9 N76b)
            setp(i, OPEN, 0, "lower", "회전 칸 — 밟으면 화살표 방향으로 미끄러진다(slideTiles)")
            slide[str(i)] = {"u": "up", "d": "down", "l": "left", "r": "right"}[re.fullmatch(r"g2_spin_([udlr])(_s|_e)?", name).group(1)]
        elif name in ("g2_spin_stop", "g2_spin_stop_s", "g2_spin_stop_e"):
            setp(i, OPEN, 0, "lower", "정지 칸 — 미끄러짐이 멈춘다(slideTiles)")
            slide[str(i)] = "stop"
        elif name == "g2_pit":
            setp(i, OPEN, 0, "lower", "구멍 — 떨어지는 이벤트를 올릴 자리")
        elif name == "g2_switch":
            setp(i, OPEN, 0, "lower", "스위치 — 밟으면 전기 문 묶음이 바뀌는 이벤트를 올릴 자리")
        elif re.fullmatch(r"g2_arc\d", name):
            setp(i, SHUT, 0, "lower", "전기 아크 — 닫힌 전기 문(스위치 이벤트로 지운다)")
        elif re.fullmatch(r"g2_boulder\d", name):
            setp(i, SHUT, 0, "lower", "밀 수 있는 돌(밀기 이벤트를 올릴 자리)")
        elif re.fullmatch(r"i2_fl_\w+", name):
            setp(i, OPEN, 0, "lower", "실내 바닥")
        elif re.fullmatch(r"i2_mat_\w+", name):
            setp(i, OPEN, 0, "lower", "출입 매트 — 이동 이벤트를 올릴 자리")
        elif re.fullmatch(r"i2_(wall|edge)_\w+", name):
            setp(i, SHUT, 0, "lower", "실내 벽·바깥(통행 불가)")
        elif re.fullmatch(r"gym_(teal|diamond|dirt|brick)\d+", name):
            setp(i, OPEN, 0, "lower", "체육관 바닥")
        elif re.fullmatch(r"spin_[udlr]", name):
            setp(i, OPEN, 0, "lower", "회전 칸 — 밟으면 화살표 방향으로 미끄러지는 이벤트를 올릴 자리")
        elif name == "spin_stop":
            setp(i, OPEN, 0, "lower", "정지 칸 — 미끄러짐이 멈추는 자리")
        elif re.fullmatch(r"warp_pad\d+", name):
            setp(i, OPEN, 0, "lower", "워프 칸 — 이동 이벤트를 올릴 자리")
        elif name == "gym_switch":
            setp(i, OPEN, 0, "lower", "스위치 — 밟으면 문·칸막이가 바뀌는 이벤트를 올릴 자리")
        elif name in ("elec_h", "elec_v"):
            setp(i, SHUT, 0, "lower", "전기 문 — 스위치 이벤트로 열린다(막힘)")
        elif name == "gym_pit":
            setp(i, OPEN, 0, "lower", "구멍 — 떨어져 아래층·시작점으로 가는 이벤트를 올릴 자리")
        elif re.fullmatch(r"cave_pebbles\d+", name):
            setp(i, SHUT, 0, "lower", "바위 무더기(통행 불가 장식)")
        elif re.fullmatch(r"cave_sand\d+", name):
            setp(i, OPEN, TERRAIN["sand"], "lower", "동굴 모래 구역")
        elif name == "cave_void":
            setp(i, SHUT, 0, "lower", "동굴 밖 어둠(통행 불가)")
        elif name == "hole_down":
            setp(i, OPEN, 0, "lower", "아래층으로(구멍·계단) — 이동 이벤트를 올릴 자리")
        elif name == "ladder_up":
            setp(i, OPEN, 0, "lower", "위층으로(사다리) — 이동 이벤트를 올릴 자리")
        elif name == "cave_boulder":
            setp(i, SHUT, 0, "lower", "동굴 바위(밀기 이벤트를 올릴 자리)")
        elif name == "cracked_rock":
            setp(i, SHUT, 0, "lower", "부술 수 있는 바위(이벤트를 올릴 자리)")
        elif name.startswith("ledge_s_"):
            setp(i, OPEN, 0, "lower", "턱(남쪽으로만 뛰어내림)")
            ledge[str(i)] = "down"
    # 오토타일 가족
    for entry in rule["autotile"]:
        fam, prefix, kind = entry[:3]
        opt = entry[3] if len(entry) > 3 else {}          # {"terrain": 키, "label": 이름, "slide": "ice"} — 지역 시트용
        tag = TERRAIN[opt.get("terrain", "none")]
        member = {}
        for k in px.ALL47:
            key = f"{prefix}{k}" if kind != "water" else f"{prefix}{k}_f0"
            i = ids[key]
            member[k] = i
            if opt.get("slide"):
                slide[str(i)] = opt["slide"]
            if kind == "path":
                setp(i, OPEN, tag, "lower", opt.get("label", "길"))
            elif kind == "edge":
                setp(i, edge_pass(k), tag, "lower", opt.get("label", "가장자리가 막힌 구역"))
            elif kind == "plateau":
                setp(i, edge_pass(k), TERRAIN[opt.get("terrain", "stone")], "lower", opt.get("label", "바위 고리(고원)"))
            elif kind == "wall":
                setp(i, SHUT, TERRAIN[opt.get("terrain", "stone")], "lower", opt.get("label", "동굴 벽(바위 덩어리)"))
            elif kind == "block":
                setp(i, SHUT, tag, "lower", opt.get("label", "퍼즐 칸막이(올린 벽)"))
            elif kind == "water":
                wtag = TERRAIN[opt["terrain"]] if "terrain" in opt else TERRAIN["water"]   # 용암·낭떠러지는 "terrain": "none"
                setp(i, SHUT, wtag, "lower", opt.get("label", "물(바위 둑)"))
                for f in range(1, 4):
                    if f"{prefix}{k}_f{f}" in ids:
                        setp(ids[f"{prefix}{k}_f{f}"], SHUT, wtag, "lower", opt.get("label", "물") + " 프레임")
        tiles_list = sorted(set(member.values()))
        interior = None
        if kind == "wall":
            mids = [ids[f"{prefix[:-3]}_mid{v}"] for v in range(3) if f"{prefix[:-3]}_mid{v}" in ids]
            deeps = [ids[f"{prefix[:-3]}_deep{v}"] for v in range(3) if f"{prefix[:-3]}_deep{v}" in ids]
            if mids and deeps:
                interior = [mids, deeps]
                for i in mids + deeps:
                    setp(i, SHUT, TERRAIN["stone"], "lower", "동굴 벽 속(깊이 변형)")
                tiles_list = sorted(set(tiles_list) | set(mids) | set(deeps))
            faces = [ids[f"{prefix[:-3]}_face{v}"] for v in range(1, 4) if f"{prefix[:-3]}_face{v}" in ids]
            for i in faces:                                       # 곧은 앞면 주름 변형: 같은 그룹 칸(이웃으로 이어짐), 찍는 쪽이 칸 위치 해시로 고른다
                setp(i, SHUT, TERRAIN[opt.get("terrain", "stone")], "lower", "동굴 벽 앞면(주름 변형)")
            tiles_list = sorted(set(tiles_list) | set(faces))
        if interior is None:
            # 속 변형(일반): <접두사>in<단>_<v>(물은 _f0) — 0단 = 가장자리에서 2칸 안, 1단 = 더 깊은 곳(바다의 깊은 물·포장의 판 변형).
            # 엔진 shadeAutotileInterior 가 칸 위치 해시로 고른다(같은 칸은 늘 같은 변형).
            sfx = "_f0" if kind == "water" else ""
            tiers = [[ids[f"{prefix}in{t}_{v}{sfx}"] for v in range(8) if f"{prefix}in{t}_{v}{sfx}" in ids] for t in (0, 1)]
            if tiers[0] or tiers[1]:
                full = member[255]
                tiers = [t or [full] for t in tiers]
                interior = tiers
                for t in tiers:
                    for i in t:
                        if i == full:
                            continue
                        setp(i, passability[full], terrain[full], "lower", label.get(full, "") + " · 속 변형")
                        if opt.get("slide"):
                            slide[str(i)] = opt["slide"]
                        if kind == "water":
                            n_ = f"{prefix}" + next(k[len(prefix):] for k, v in ids.items() if v == i and k.endswith("_f0"))
                            base = n_[:-3]
                            for f in range(1, 4):
                                if f"{base}_f{f}" in ids:
                                    setp(ids[f"{base}_f{f}"], passability[full], terrain[full], "lower", label.get(full, "") + " 프레임")
                tiles_list = sorted(set(tiles_list) | {i for t in tiers for i in t})
        groups.append({
            "id": fam, "name": rule["autotile_names"][fam], "neighborhood": 8,
            "memberTileIds": tiles_list, "connectTileIds": tiles_list,
            "variantMap": px.variant_map256(member),
            **({"interiorVariants": interior} if interior else {}),
            **({"edgeConnects": True} if kind in ("wall", "block") or opt.get("edgeConnects") else {}),   # 바다·항구 물은 맵 밖으로 이어진다
        })
    # connectGroups: 이 그룹이 다른 그룹 칸도 「이어진 이웃」으로 본다(모래길이 바다 쪽에 풀 테두리를 그리지 않게, 포장길이 부두 돌 앞에 연석을 안 그리게)
    by_id = {g["id"]: g for g in groups}
    for entry in rule["autotile"]:
        opt = entry[3] if len(entry) > 3 else {}
        for other in opt.get("connectGroups", []):
            g = by_id[entry[0]]
            g["connectTileIds"] = sorted(set(g["connectTileIds"]) | set(by_id[other]["memberTileIds"]))
        if opt.get("connectTiles"):                       # 낱칸도 이웃으로(정규식): 방파제 앞면 칸 위의 포장이 연석을, 그 밑 모래가 풀 테를 안 그리게
            pat = re.compile(opt["connectTiles"])
            g = by_id[entry[0]]
            g["connectTileIds"] = sorted(set(g["connectTileIds"]) | {i for n, i in ids.items() if pat.fullmatch(n)})
    for name, i in ids.items():
        if name.startswith("fence_at"):
            setp(i, SHUT, 0, "lower", "울타리")
    # 물체(여러 칸): 이름.x.y
    objs: dict[str, dict] = {}
    for name, i in ids.items():
        m = OBJ_RE.match(name)
        if m:
            o = objs.setdefault(m["name"], {"cells": {}})
            o["cells"][(int(m["x"]), int(m["y"]))] = i
    if "sign" in ids:
        objs["sign"] = {"cells": {(0, 0): ids["sign"]}}
    objects = []
    partial_in_objects: set[int] = set()
    for oname, o in sorted(objs.items()):
        w = 1 + max(x for x, _ in o["cells"]); h = 1 + max(y for _, y in o["cells"])
        kind = _kind(oname, rule)
        r = roles.get(oname) or {}
        door = None
        door_w = 1
        ent = rule.get("entrances", {}).get(oname)
        if ent:
            door = (ent[0], ent[1])
        elif kind == "building" and r.get("doors"):
            x0, y0, x1, y1 = r["doors"][0]
            door = ((x0 + x1) // 2 // T, min(h - 1, y1 // T))
            if x1 - x0 + 1 >= 24 and x1 // T > x0 // T:          # 두 칸 폭 이중문(센터·마트): 보이는 문짝 칸이 모두 입구다(적대 검수 L1 N7)
                door = (x0 // T, door[1])
                door_w = x1 // T - x0 // T + 1
        rows_lower, rows_upper, cell_pass = [], [], []
        for y in range(h):
            lo, up = [], []
            for x in range(w):
                i = o["cells"].get((x, y))
                if i is None:
                    lo.append(-1); up.append(-1); continue
                cls = _alpha_class(sheet, cols, i)
                if cls == "partial":
                    partial_in_objects.add(i)
                opaque = cls == "opaque"
                is_door = door is not None and y == door[1] and door[0] <= x < door[0] + door_w
                if cls == "empty":
                    setp(i, OPEN, 0, "lower", f"{oname} 빈 칸")
                elif kind == "decor":
                    setp(i, OPEN, 0, "lower", f"{oname}(걸을 수 있다)")
                elif kind in ("building", "tree", "prop"):
                    setp(i, (VERT if door_w > 1 else OPEN) if is_door else SHUT, 0, "lower",
                         f"{oname} 입구" if is_door else f"{oname}")
                lo.append(i if opaque else -1)
                up.append(-1 if opaque else i)
            rows_lower.append(lo); rows_upper.append(up)
        # 투명 칸이 낀 칸은 위 층에 두고 아래 층은 비운다(아래에 깔 땅은 찍는 쪽이 정한다)
        ent = {"id": f"{seed['id']}.{oname}", "name": oname, "kind": kind, "width": w, "height": h,
               "rowsLower": rows_lower, "rowsUpper": rows_upper}
        if door:
            ent["entrance"] = {"dx": door[0], "dy": door[1], **({"w": door_w} if door_w > 1 else {})}
        objects.append(ent)

    # 칸 메타(이름·통행·홈 레이어). 투명 칸이 낀 낱칸(울타리·간판)은 아래에 풀을 깔고 위층에 둔다.
    grass0 = ids[rule.get("backing", "grass0")]          # 투명 낱칸 밑에 깔 바닥 — 지역 시트는 자기 바닥(눈·모래)을 고른다
    tile_meta = []
    for i in range(total):
        cls = _alpha_class(sheet, cols, i) if i < len(tiles_all) else "empty"
        m = {"label": label.get(i, "미사용"), "description": "", "source": "bundled-default",
             "terrainTag": terrain[i],
             "passage": "solid" if not any(passability[i].values()) else "passable"}
        if cls in ("partial", "empty") and i < len(tiles_all) and i not in partial_in_objects and label.get(i):   # 이름 있는 빈 칸도 위층(아래층에 두면 땅에 구멍이 난다)
            m["defaultLayer"] = "upper"
            m["layerBacking"] = grass0
        tile_meta.append(m)
    ts = {
        "id": seed["tilesetId"], "name": seed["tilesetName"], "family": seed.get("family", "pokemon"),
        "image": {"type": "uploaded", "id": f"tex_{seed['tilesetId']}"},
        "kind": "custom", "tileSize": T, "tilesPerRow": cols, "count": total,
        "passability": passability, "priority": priority, "terrain": terrain,
        "ledgeDirections": ledge, **({"slideTiles": slide} if slide else {}), "autotileGroups": groups, "tileMeta": tile_meta,
        "animationStrips": tiles["anim"],
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "tileset.json").write_text(json.dumps(ts, ensure_ascii=False))
    (out / "objects.json").write_text(json.dumps(objects, ensure_ascii=False, indent=1))
    sem = {"labels": {str(k): v for k, v in label.items()}, "terrainTags": TERRAIN,
           "notes": "terrain 5(키 큰 풀)은 프로젝트 database.terrains 에 다섯째 기록을 넣어야 조우율이 붙는다."}
    (out / "semantic.json").write_text(json.dumps(sem, ensure_ascii=False, indent=1))
    Image.open(sheet_png).save(out / "sheet.png")
    return {"tiles": total, "objects": len(objects), "groups": len(groups), "ledges": len(ledge)}


def _kind(name: str, rule: dict) -> str:
    for kind, pats in rule["object_kinds"].items():
        if any(name.startswith(p) for p in pats):
            return kind
    return "prop"
