"""조선 번들(joseon_baram) 참고문서 — 새 판(사냥터·동굴·실내 키트 6방·궁 내부 3방, 지도 11장) 3용도.

  7) 사냥터·동굴 지형   8) 조선 실내 키트   9) 궁 내부
prepare-joseon-baram-references.py 가 `build(ctx)` 로 부른다(ctx = 그 스크립트의 공용 함수·표 묶음).
그림은 모두 번들 시트 칸 번호를 다시 조립한 것(nearest-neighbor 확대)이다 — AI 가 그린 모형은 없다.
AI-REFERENCE-CONTRACT 8항목: ①사전(칸 번호·크기·전체 배열) ②실행 순서 ③완전한 조립 예제 ④입력→정답 배열→완성 그림 ⑤반복/고정·문/접근칸/출입구
⑥정상/오류 그림 + 실제 변조 검출(코드·좌표, qa-tamper-checks-new.json) ⑦검사 범위 ⑧레이어 정정(신규 용도라 정정할 이전 문서 없음).
"""
import collections
import json
import pathlib
import re

from PIL import Image, ImageDraw

FIELD_CAVE = ("joseon_field", "joseon_cave")
INTERIOR = ("joseon_in_house_b", "joseon_in_inn_b", "joseon_in_smith_b", "joseon_in_pharmacy_b", "joseon_in_school_b", "joseon_in_office_b")
PALACE = ("joseon_in_throne", "joseon_in_corridor", "joseon_in_bedchamber")
ROOM_KO = {"joseon_in_house_b": "민가", "joseon_in_inn_b": "주막", "joseon_in_smith_b": "대장간", "joseon_in_pharmacy_b": "약방", "joseon_in_school_b": "서당",
           "joseon_in_office_b": "관아 동헌", "joseon_in_throne": "정전 어좌 홀", "joseon_in_corridor": "회랑", "joseon_in_bedchamber": "침전"}
SYM = {"grass": ".", "road": "r", "yard": "y", "water": "w", "paddy": "p", "field": "f", "paving": "s", "slab": "s", "wall": "#", "cityback": "B", "tface0": "1",
       "tface1": "2", "floor": "_", "void": "#", "ceil": "C", "cface0": "1", "cface1": "2", "pool": "w", "lit": "L", "bridge": "b", "diamond": "d", "other": "?"}
SYM_KO = {"grass": "풀", "road": "길", "yard": "마당", "water": "물(막힘)", "wall": "바위산·벽", "cityback": "성 뒷벽", "tface0": "절벽 앞면 윗줄", "tface1": "절벽 앞면 아랫줄",
          "slab": "석판", "floor": "걷는 바닥", "void": "천장·어둠(막힘)", "ceil": "천장", "cface0": "벽 앞면 윗줄", "cface1": "벽 앞면 아랫줄", "pool": "지하 못(막힘)", "lit": "햇빛 문턱"}
# 구조 부품(벽·문·기둥·보·단·깔개·계단)은 같은 그림이 일렬로 이어지는 것이 규칙이다 — 「같은 기물 셋 일렬 금지」검사에서 뺀다
STRUCT_WORDS = ("wall", "pillar", "beam", "dais", "carpet", "mat_", "nangan", "stair", "step_stone", "exit_mat", "door", "win_", "fort_wall", "bridge", "dock")


def build(c):
    ROOT, DATA, TS, PW, KITS, PASS, PRI, AT, EQUIV, STATS = (c[k] for k in ("ROOT", "DATA", "TS", "PW", "KITS", "PASS", "PRI", "AT", "EQUIV", "STATS"))
    TID, PFX, T, HEAD, WALKTXT, NEW_PFX, NEW_AT, NEW_GROUP = (c[k] for k in ("TID", "PFX", "T", "HEAD", "WALKTXT", "NEW_PFX", "NEW_AT", "NEW_GROUP"))
    draw, up, save, piece_image, piece_docs, grid_image, array_text, ko, add_doc, tint_overlay, tile = (
        c[k] for k in ("draw", "up", "save", "piece_image", "piece_docs", "grid_image", "array_text", "ko", "add_doc", "tint_overlay", "tile"))
    GROUPS = {g["id"]: g for g in TS["tileGroups"]}

    # ------------------------------------------------------------------ 지도 읽기
    M = {}
    for mid in FIELD_CAVE + INTERIOR + PALACE:
        mj = json.loads((DATA / "maps" / f"{mid}.json").read_text())
        ex = json.loads((ROOT / STATS["maps"][mid]["extra"]).read_text())
        M[mid] = dict(id=mid, name=mj["name"], W=mj["width"], H=mj["height"], lo=mj["lowerTiles"], up=mj["upperTiles"], walk=mj["walk"], start=tuple(mj["start"]),
                      doors=mj["doors"], people=mj["people"], exits=mj.get("exits", []), ex=ex, placed=ex["placed"], kind=ex.get("groundDetail") or ex["groundKind"])

    terrain_tiles = set(t for g in TS["tileGroups"] if g["id"].startswith("jb:") and g["defaultLayer"] == "lower" for t in g["tileIds"])
    terrain_tiles |= set(t for a in TS["autotileGroups"] for t in a["memberTileIds"])
    overlap_tiles = set(i for i, m in enumerate(TS["tileMeta"]) if m.get("label") == "조선 · 겹침 칸")
    members = {a["id"]: set(a["memberTileIds"]) for a in TS["autotileGroups"]}

    def piece_tiles(pred):
        return {t for n, k in ((n[len(PFX):], k) for n, k in KITS.items()) if pred(n) for r in k["rows"] for t in r["upperTiles"] if t >= 0}

    wallish = piece_tiles(lambda n: n.startswith(("in_b_wall", "in_b_win", "in_b_door", "pal_wall", "pal_door"))) | overlap_tiles
    struct_tiles = piece_tiles(lambda n: any(w in n for w in STRUCT_WORDS))
    carpet_tiles = piece_tiles(lambda n: n.startswith("pal_mat_carpet"))
    stair_tiles = piece_tiles(lambda n: n == "pal_dais_stair_3")
    ceil_in = members["jb_in_b_ceil47_autotile"] | members["jb_pal_ceil47_autotile"]
    roof = members["jb_cav_roof47_autotile"]
    face = set(GROUPS["jb:cav_face24"]["tileIds"])
    cave_floor = set(t for gid in ("jb:cav_floor", "jb:cav_floor_sh", "jb:cav_floor_lit") for t in GROUPS[gid]["tileIds"])

    def solid_tile(name):
        """조각 name 에서 막힘(X) 칸 하나의 번호."""
        k = KITS[PFX + name]
        for j, r in enumerate(k["rows"]):
            for i, t in enumerate(r["upperTiles"]):
                if t >= 0 and PW[name]["rows"][j][i] == "X":
                    return t
        raise KeyError(name)

    # ------------------------------------------------------------------ 그림·통행 도우미
    def mdraw(m, x0, y0, x1, y1, lo=None, upv=None, bg=(0, 0, 0, 255)):
        lo, upv, W, H = lo or m["lo"], upv or m["up"], m["W"], m["H"]
        lw = [lo[y * W + x] if 0 <= x < W and 0 <= y < H else -1 for y in range(y0, y1) for x in range(x0, x1)]
        uw = [upv[y * W + x] if 0 <= x < W and 0 <= y < H else -1 for y in range(y0, y1) for x in range(x0, x1)]
        return draw(lw, uw, x1 - x0, y1 - y0, bg), lw, uw

    def cell_walk(lo_t, up_t):
        """엔진 규칙(collision.ts): 윗층이 ★(걸음+upper)가 아니고 정보가 있으면 윗층이, 아니면 아래층이 정한다."""
        if up_t is not None and up_t >= 0 and not (PASS[up_t] and PRI[up_t] == "upper"):
            return PASS[up_t]
        return PASS[lo_t] if lo_t is not None and lo_t >= 0 else False

    def reach(m, lo, upv, start, allow=None):
        W, H = m["W"], m["H"]
        ok = lambda x, y: 0 <= x < W and 0 <= y < H and cell_walk(lo[y * W + x], upv[y * W + x]) and (allow is None or allow(x, y))
        if not ok(*start):
            return set()
        seen = {start}
        q = collections.deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n not in seen and ok(*n):
                    seen.add(n)
                    q.append(n)
        return seen

    def walkable(m, lo, upv):
        W = m["W"]
        return {(x, y) for y in range(m["H"]) for x in range(W) if cell_walk(lo[y * W + x], upv[y * W + x])}

    def mask_of(group, lo, W, H, x, y):
        conn = set(group["connectTileIds"])
        r = 0
        for bit, dx, dy in ((1, 0, -1), (2, 1, 0), (4, 0, 1), (8, -1, 0), (16, 1, -1), (32, 1, 1), (64, -1, 1), (128, -1, -1)):
            X, Y = x + dx, y + dy
            if not (0 <= X < W and 0 <= Y < H):
                if group.get("edgeConnects"):
                    r |= bit
            elif lo[Y * W + X] in conn:
                r |= bit
        return r

    def mask_mismatches(m, lo, aids):
        out = set()
        W, H = m["W"], m["H"]
        for gid in aids:
            g = {a["id"]: a for a in TS["autotileGroups"]}[gid]
            mem, eq = members[gid], EQUIV[gid]
            for y in range(H):
                for x in range(W):
                    t = lo[y * W + x]
                    if t in mem:
                        v = g["variantMap"][str(mask_of(g, lo, W, H, x, y))]
                        if eq.get(str(v), v) != eq.get(str(t), t):
                            out.add((gid, x, y))
        return out

    # ------------------------------------------------------------------ 검사(저작 검사: 구조·통행 범위)
    def detect(m, lo, upv, cases=None):
        """반환 [(코드, x, y, 설명)]. 정상 지도는 마스크 불일치를 뺀 모든 코드가 0 이다."""
        W, H = m["W"], m["H"]
        out = []
        sx, sy = m["start"]
        seen = reach(m, lo, upv, (sx, sy))
        if not seen:
            out.append(("entry-blocked", sx, sy, "들어오는 칸(start)이 걸을 수 없다"))
        else:
            for d in m["doors"]:
                if (d["x"], d["y"]) not in seen:
                    out.append(("door-unreachable", d["x"], d["y"], f"{d['piece']} 문 앞·출구 칸에 닿지 못한다"))
            lost = sorted(walkable(m, lo, upv) - seen)
            if lost:
                out.append(("region-unreachable", lost[0][0], lost[0][1], f"들어오는 칸에서 닿지 못하는 걸을 수 있는 칸 {len(lost)}개"))
        for i, t in enumerate(lo):
            if t not in terrain_tiles:
                out.append(("object-tile-in-lower-layer", i % W, i // W, f"아래층 칸 {t} 은 지형 묶음이 아니다(윗층 그림이 아래층에 칠해짐)"))
        if m["id"] in INTERIOR + PALACE:   # 천장 밑 벽 규칙: 천장 바로 아래 걷는 바닥 칸에는 벽 조각이 서 있어야 한다
            for y in range(1, H):
                for x in range(W):
                    if lo[(y - 1) * W + x] in ceil_in and lo[y * W + x] not in ceil_in and upv[y * W + x] not in wallish:
                        out.append(("wall-missing-under-ceiling", x, y, "천장 바로 아래 칸에 벽 조각이 없다(천장 밑 벽 규칙)"))
        if m["id"] == "joseon_cave":      # 천장 3단: 걷는 바닥 바로 위는 앞면 아랫줄, 그 위는 앞면 윗줄, 그 위는 천장
            for y in range(3, H):
                for x in range(W):
                    if lo[y * W + x] in cave_floor and lo[(y - 1) * W + x] not in cave_floor and lo[(y - 1) * W + x] not in members["jb_cav_pool94_autotile"]:
                        if not (lo[(y - 1) * W + x] in face and lo[(y - 2) * W + x] in face and lo[(y - 3) * W + x] in roof):
                            out.append(("wall-missing-under-ceiling", x, y - 1, "걷는 바닥 위에 앞면 두 줄 + 천장이 차례로 서 있지 않다(동굴 천장 3단 구조)"))
        if m["id"] == "joseon_in_throne" and seen:      # 어도: 입구 칸에서 단 계단까지 카펫(깔개·계단)만 밟아 걸어갈 수 있어야 한다
            on_aisle = lambda x, y: upv[y * W + x] in carpet_tiles or upv[y * W + x] in stair_tiles or (x, y) == (sx, sy)
            aisle = reach(m, lo, upv, (sx, sy), on_aisle)
            stair = [(x, y) for y in range(H) for x in range(W) if upv[y * W + x] in stair_tiles]
            if stair and not any(s in aisle for s in stair):
                out.append(("aisle-blocked", stair[0][0], stair[0][1] + 1, "입구에서 단 계단까지 이어지는 어도(카펫)가 막혔다"))
        # 같은 기물 셋 일렬 금지(구조 부품 제외)
        flat = lambda x, y: upv[y * W + x]
        for y in range(H):
            for x in range(W):
                t = flat(x, y)
                if t < 0 or t in struct_tiles or t in terrain_tiles:
                    continue
                if x + 2 < W and flat(x + 1, y) == t and flat(x + 2, y) == t:
                    out.append(("same-prop-three-in-row", x, y, "같은 기물 그림 셋이 가로로 일렬"))
                if y + 2 < H and flat(x, y + 1) == t and flat(x, y + 2) == t:
                    out.append(("same-prop-three-in-row", x, y, "같은 기물 그림 셋이 세로로 일렬"))
        return out

    base_find = {}
    base_mm = {}
    mask_ids = lambda m: [a["id"] for a in TS["autotileGroups"] if a["id"].startswith(NEW_AT)]
    for mid, m in M.items():
        f = detect(m, m["lo"], m["up"])
        base_find[mid] = f
        base_mm[mid] = mask_mismatches(m, m["lo"], mask_ids(m))
    # 정상 지도는 검사가 걸리지 않아야 한다(걸리면 규칙이 지도와 안 맞는 것 — 문서를 쓰기 전에 알린다)
    bad = {mid: f[:3] for mid, f in base_find.items() if f}
    assert not bad, f"정상 지도에서 검사가 걸린다: {bad}"

    tamper = dict(baseline={mid: dict(findings=len(f), maskMismatchKnown=len(base_mm[mid])) for mid, f in base_find.items()}, cases=[])

    def pair_image(m, bad_lo, bad_up, x0, y0, x1, y1, zoom=3, mark=None):
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(m["W"], x1), min(m["H"], y1)
        a = mdraw(m, x0, y0, x1, y1, bad_lo, bad_up)[0]
        b = mdraw(m, x0, y0, x1, y1)[0]
        if mark:
            d = ImageDraw.Draw(a)
            for (mx, my) in mark:
                d.rectangle(((mx - x0) * T, (my - y0) * T, (mx - x0 + 1) * T - 1, (my - y0 + 1) * T - 1), outline=(255, 255, 0, 255), width=1)
        out = Image.new("RGBA", (a.width * 2 * zoom + 8, a.height * zoom), (255, 255, 255, 255))
        out.alpha_composite(up(a, zoom), (0, 0))
        out.alpha_composite(up(b, zoom), (a.width * zoom + 8, 0))
        return out

    qa_images = collections.defaultdict(list)
    qa_rows = collections.defaultdict(list)

    def record(group, did, mid, expect, change, bad_lo, bad_up, view, caption, zoom=3):
        """변조한 그림으로 검사를 돌려 expect(코드) 가 찍히는지 단언하고 오류/정답 그림을 남긴다."""
        m = M[mid]
        f = detect(m, bad_lo, bad_up)
        if expect == "autotile-mask-mismatch":
            mm = mask_mismatches(m, bad_lo, mask_ids(m)) - base_mm[mid]
            hits = sorted([list(a) for a in mm])
            assert hits, (mid, change)
            at = hits[0][1:]
            detected = hits[:6]
        else:
            hits = [h for h in f if h[0] == expect]
            assert hits, (mid, expect, change, f[:3])
            at = list(hits[0][1:3])
            detected = [list(h[1:3]) for h in hits[:6]]
        x0, y0, x1, y1 = view
        qa_images[group].append(save(f"err-{did}", pair_image(m, bad_lo, bad_up, x0, y0, x1, y1, zoom, mark=[tuple(at)]),
                                     f"왼쪽 오류 · 오른쪽 정답. 맵 `{mid}`({ROOM_KO.get(mid, m['name'])}) {caption} 검출: {expect} ({at[0]},{at[1]})"
                                     f"{'' if len(detected) < 2 else f' 외 {len(detected) - 1}곳'}."))
        qa_rows[group].append(f"| `{expect}` | `{mid}` ({at[0]},{at[1]}) | {change} | {detected[:3]} |")
        tamper["cases"].append(dict(map=mid, code=expect, at=at, change=change, detected=detected, detectedCount=len(hits) if expect != "autotile-mask-mismatch" else len(hits)))

    def set_cells(m, layer, cells):
        a = list(m[layer])
        for (x, y), t in cells.items():
            a[y * m["W"] + x] = t
        return a

    def find_cut(m, widths=(1, 2, 3), lo_n=8, hi_n=400, avoid=(), area=None):
        """한 줄(가로/세로 1~3칸)을 막으면 들어오는 칸에서 닿지 못하는 칸이 lo_n..hi_n 개 생기는 자리 — 좁은 길목 하나를 찾는다."""
        W, H = m["W"], m["H"]
        base = walkable(m, m["lo"], m["up"])
        for w in widths:
            for y in range(H):
                for x in range(W):
                    if area and not (area[0] <= x <= area[2] and area[1] <= y <= area[3]):
                        continue
                    for horiz in (True, False):
                        seg = [(x + i, y) if horiz else (x, y + i) for i in range(w)]
                        if any(s not in base or s == m["start"] or s in avoid for s in seg):
                            continue
                        # 길목이 좁다는 것은 양 끝 바깥이 막혀 있다는 뜻: 줄 바로 옆 칸이 걸을 수 있으면 건너뛴다
                        edge = [(seg[0][0] - 1, seg[0][1]), (seg[-1][0] + 1, seg[-1][1])] if horiz else [(seg[0][0], seg[0][1] - 1), (seg[-1][0], seg[-1][1] + 1)]
                        if any(e in base for e in edge):
                            continue
                        blocked = set(seg)
                        seen = reach(m, m["lo"], m["up"], m["start"], lambda a, b: (a, b) not in blocked)
                        lost = len(base) - len(blocked) - len(seen)
                        if lo_n <= lost <= hi_n:
                            return seg, lost
        raise RuntimeError(f"{m['id']}: 길목을 못 찾았다")

    # ------------------------------------------------------------------ 변조 사례(실제로 바꿔서 검출)
    STOOL = solid_tile("in_b_stool")
    CAIRN = solid_tile("fld_cairn")

    # ---- 사냥터·동굴
    mf, mc = M["joseon_field"], M["joseon_cave"]
    d0 = next(d for d in mf["doors"] if d["piece"] == "fld_cave_a")
    record("fc", "field-door-blocked", "joseon_field", "door-unreachable", f"굴 입구 `fld_cave_a` 문 앞 칸 ({d0['x']},{d0['y']}) 에 돌탑(`fld_cairn`) 1칸을 윗층에 놓음",
           mf["lo"], set_cells(mf, "up", {(d0["x"], d0["y"]): CAIRN}), (d0["x"] - 6, d0["y"] - 7, d0["x"] + 7, d0["y"] + 3),
           "굴 입구 앞 칸에 돌탑을 놓아 문 앞을 막았다(굴 입구 앞 걸을 칸은 비운다).")
    seg, lost = find_cut(mc, widths=(2, 3, 4), lo_n=20, hi_n=200, area=(19, 8, 29, 18))   # 광장 → 보물방 복도
    record("fc", "cave-corridor-cut", "joseon_cave", "region-unreachable", f"동굴 길목 {len(seg)}칸 {seg[0]}~{seg[-1]} 에 돌탑을 놓아 길을 끊음(그 너머 {lost}칸이 갇힘)",
           mc["lo"], set_cells(mc, "up", {s: CAIRN for s in seg}), (seg[0][0] - 8, seg[0][1] - 7, seg[0][0] + 9, seg[0][1] + 8),
           f"동굴 복도를 돌탑으로 끊었다 → 너머 걸을 칸 {lost}개가 입구에서 닿지 못한다(모든 걸을 칸은 입구에서 닿아야 한다).", zoom=3)
    tr = next(p for p in mf["placed"] if p["name"] == "fld_pine_a")
    cells_lo, cells_up, moved = {}, {}, []
    for j in range(2):
        for i in range(tr["w"]):
            x, y = tr["x"] + i, tr["y"] + j
            if 0 <= x < mf["W"] and 0 <= y < mf["H"] and mf["up"][y * mf["W"] + x] >= 0:
                cells_lo[(x, y)] = mf["up"][y * mf["W"] + x]
                cells_up[(x, y)] = -1
                moved.append((x, y))
    record("fc", "field-canopy-lower", "joseon_field", "object-tile-in-lower-layer", f"소나무 `fld_pine_a` ({tr['x']},{tr['y']}) 수관 위 두 줄 {len(moved)}칸을 lowerTiles 에 칠함",
           set_cells(mf, "lo", cells_lo), set_cells(mf, "up", cells_up), (tr["x"] - 2, max(0, tr["y"] - 1), tr["x"] + tr["w"] + 2, tr["y"] + tr["h"] + 1),
           f"소나무 수관 위 두 줄을 아래층에 칠했다 → 투명 부분 밑에 땅이 없어 검게 비었다.")
    bg = next(a for a in TS["autotileGroups"] if a["id"] == "jb_fld_bog94_autotile")
    bm = members[bg["id"]]
    cand = None
    for y in range(3, mf["H"] - 3):
        for x in range(1, mf["W"] - 1):
            t = mf["lo"][y * mf["W"] + x]
            if t in bm and mf["lo"][y * mf["W"] + x - 1] not in bm and mf["lo"][y * mf["W"] + x + 1] in bm and y not in (0, mf["H"] - 1):
                cand = (x, y)
                break
        if cand:
            break
    cx, cy = cand
    mk = mask_of(bg, mf["lo"], mf["W"], mf["H"], cx, cy)
    swapped = (mk & ~(2 | 8 | 16 | 32 | 64 | 128)) | (2 if mk & 8 else 0) | (8 if mk & 2 else 0) | (16 if mk & 128 else 0) | (128 if mk & 16 else 0) | (32 if mk & 64 else 0) | (64 if mk & 32 else 0)
    record("fc", "field-bog-bank-reversed", "joseon_field", "autotile-mask-mismatch", f"늪 서쪽 둑 칸 ({cx},{cy}) 을 동쪽 둑 모양(마스크 {mk}→{swapped})으로 바꿈",
           set_cells(mf, "lo", {(cx, cy): bg["variantMap"][str(swapped)]}), mf["up"], (cx - 4, cy - 4, cx + 5, cy + 5), f"늪 서쪽 둑 칸 ({cx},{cy}) 을 반대 방향 둑으로 바꿨다 → 둑이 반대편을 본다.")
    run = None
    for y in range(8, mf["H"] - 8):
        for x in range(30, mf["W"] - 30):
            if all(mf["up"][y * mf["W"] + x + i] < 0 and mf["lo"][y * mf["W"] + x + i] in members["jb_fld_tall32_autotile"] | set(GROUPS["jb:grass8"]["tileIds"]) for i in range(3)):
                run = (x, y)
                break
        if run:
            break
    ROCK = solid_tile("fld_rock_s_a")
    record("fc", "field-three-in-row", "joseon_field", "same-prop-three-in-row", f"풀밭 ({run[0]},{run[1]})~({run[0] + 2},{run[1]}) 에 같은 작은 바위(`fld_rock_s_a`) 셋을 가로로 일렬로 놓음",
           mf["lo"], set_cells(mf, "up", {(run[0] + i, run[1]): ROCK for i in range(3)}), (run[0] - 5, run[1] - 4, run[0] + 8, run[1] + 5),
           "같은 바위 그림 셋을 한 줄로 세웠다 → 도장 찍은 듯한 일렬 배치(같은 종은 3개 일렬·균등 간격 금지).")
    wf = next((x, y) for y in range(mc["H"]) for x in range(mc["W"]) if mc["lo"][y * mc["W"] + x] in face and mc["lo"][(y + 1) * mc["W"] + x] in cave_floor)
    record("fc", "cave-face-missing", "joseon_cave", "wall-missing-under-ceiling", f"동굴 벽 앞면 아랫줄 ({wf[0]},{wf[1]}) 을 바닥 칸으로 바꿈(앞면 두 줄 구조가 깨짐)",
           set_cells(mc, "lo", {wf: mc["lo"][(wf[1] + 1) * mc["W"] + wf[0]]}), mc["up"], (wf[0] - 6, wf[1] - 5, wf[0] + 7, wf[1] + 5),
           "벽 앞면 아랫줄이 바닥으로 바뀌었다 → 바닥 위에 앞면 두 줄 + 천장의 3단이 끊긴다.")

    # ---- 실내
    mi = M["joseon_in_inn_b"]
    ent = mi["start"]
    record("in", "inn-entry-blocked", "joseon_in_inn_b", "entry-blocked", f"들어오는 칸 ({ent[0]},{ent[1]}) 에 걸상(`in_b_stool`)을 놓음",
           mi["lo"], set_cells(mi, "up", {ent: STOOL}), (ent[0] - 6, ent[1] - 6, ent[0] + 7, ent[1] + 3), "출구 깔개 바로 북쪽(들어오는 칸)에 걸상을 놓았다 → 방에 들어서자마자 막힌다(입구 앞 3×3 은 비운다).")
    mh = M["joseon_in_house_b"]
    seg, lost = find_cut(mh, widths=(1,), lo_n=5, hi_n=200)
    record("in", "house-partition-cut", "joseon_in_house_b", "region-unreachable", f"민가 칸막이 문 틈 ({seg[0][0]},{seg[0][1]}) 에 걸상을 놓음(그 너머 {lost}칸이 갇힘)",
           mh["lo"], set_cells(mh, "up", {s: STOOL for s in seg}), (0, 0, mh["W"], mh["H"]), f"방 사이 문 틈(걷는 줄 한 칸)을 걸상으로 막았다 → 건너편 {lost}칸에 닿지 못한다.", zoom=3)
    ms = M["joseon_in_school_b"]
    wl = next((x, y) for y in range(1, ms["H"]) for x in range(ms["W"]) if ms["lo"][(y - 1) * ms["W"] + x] in ceil_in and ms["lo"][y * ms["W"] + x] not in ceil_in
              and ms["up"][y * ms["W"] + x] in wallish and ms["up"][y * ms["W"] + x] not in overlap_tiles)
    record("in", "school-wall-missing", "joseon_in_school_b", "wall-missing-under-ceiling", f"서당 북벽 벽면 윗줄 ({wl[0]},{wl[1]}) 의 벽 조각 칸을 지움",
           ms["lo"], set_cells(ms, "up", {wl: -1}), (wl[0] - 5, wl[1] - 2, wl[0] + 6, wl[1] + 6), "천장 바로 아래 벽면 한 칸을 비웠다 → 벽 없이 천장 밑 바닥이 드러난다(천장 밑 벽 규칙).")
    mo = M["joseon_in_office_b"]
    wo = next((x, y) for y in range(1, mo["H"]) for x in range(mo["W"]) if mo["lo"][(y - 1) * mo["W"] + x] in ceil_in and mo["lo"][y * mo["W"] + x] not in ceil_in
              and mo["up"][y * mo["W"] + x] in wallish and mo["up"][y * mo["W"] + x] not in overlap_tiles)
    record("in", "office-wall-lower", "joseon_in_office_b", "object-tile-in-lower-layer", f"관아 벽 조각 칸 ({wo[0]},{wo[1]}) 을 lowerTiles 에 칠함",
           set_cells(mo, "lo", {wo: mo["up"][wo[1] * mo["W"] + wo[0]]}), set_cells(mo, "up", {wo: -1}), (wo[0] - 5, wo[1] - 2, wo[0] + 6, wo[1] + 6),
           "벽 조각의 한 칸을 아래층에 칠했다 → 투명 부분 밑에 바닥이 없어 검게 빈다(벽·가구는 윗층).")
    msm = M["joseon_in_smith_b"]
    free = None
    for y in range(3, msm["H"] - 2):
        for x in range(2, msm["W"] - 4):
            if all(msm["up"][y * msm["W"] + x + i] < 0 and msm["lo"][y * msm["W"] + x + i] not in ceil_in and msm["lo"][y * msm["W"] + x + i] != -1 for i in range(3)) \
                    and all((x + i, y) in walkable(msm, msm["lo"], msm["up"]) for i in range(3)):
                free = (x, y)
                break
        if free:
            break
    record("in", "smith-three-in-row", "joseon_in_smith_b", "same-prop-three-in-row", f"대장간 바닥 ({free[0]},{free[1]})~({free[0] + 2},{free[1]}) 에 같은 걸상 셋을 가로로 일렬로 놓음",
           msm["lo"], set_cells(msm, "up", {(free[0] + i, free[1]): STOOL for i in range(3)}), (free[0] - 4, free[1] - 3, free[0] + 7, free[1] + 4),
           "같은 걸상 셋을 한 줄로 놓았다 → 같은 기물 셋 일렬 금지(기물은 서로 다르게, 용도 곁에 묶는다).")
    cg = next(a for a in TS["autotileGroups"] if a["id"] == "jb_in_b_ceil47_autotile")
    cm = members[cg["id"]]
    cand = None
    for y in range(0, mh["H"]):
        for x in range(1, mh["W"] - 1):
            t = mh["lo"][y * mh["W"] + x]
            if t in cm and mh["lo"][y * mh["W"] + x - 1] not in cm and mh["lo"][y * mh["W"] + x + 1] in cm:
                cand = (x, y)
                break
        if cand:
            break
    if cand is None:
        cand = next((x, y) for y in range(mi["H"]) for x in range(1, mi["W"] - 1) if mi["lo"][y * mi["W"] + x] in cm and mi["lo"][y * mi["W"] + x - 1] not in cm and mi["lo"][y * mi["W"] + x + 1] in cm)
        mm_ = mi
    else:
        mm_ = mh
    cx, cy = cand
    mk = mask_of(cg, mm_["lo"], mm_["W"], mm_["H"], cx, cy)
    swapped = (mk & ~(2 | 8 | 16 | 32 | 64 | 128)) | (2 if mk & 8 else 0) | (8 if mk & 2 else 0) | (16 if mk & 128 else 0) | (128 if mk & 16 else 0) | (32 if mk & 64 else 0) | (64 if mk & 32 else 0)
    record("in", "ceil-edge-reversed", mm_["id"], "autotile-mask-mismatch", f"천장 가장자리 칸 ({cx},{cy}) 을 반대쪽 가장자리 모양(마스크 {mk}→{swapped})으로 바꿈",
           set_cells(mm_, "lo", {(cx, cy): cg["variantMap"][str(swapped)]}), mm_["up"], (cx - 4, cy - 3, cx + 5, cy + 4), f"천장(벽 덩어리) 가장자리 칸 ({cx},{cy}) 을 반대 방향으로 바꿨다 → 테두리가 어긋난다.")

    # ---- 궁
    mt = M["joseon_in_throne"]
    ax = sorted({x for y in range(mt["H"]) for x in range(mt["W"]) if mt["up"][y * mt["W"] + x] in carpet_tiles and y == 12})
    record("pal", "throne-aisle-blocked", "joseon_in_throne", "aisle-blocked", f"어도(카펫) y=12 의 세 칸 x={ax[0]}~{ax[-1]} 에 걸상 셋을 놓음",
           mt["lo"], set_cells(mt, "up", {(x, 12): STOOL for x in ax}), (3, 5, 18, 21), "어도 한 줄을 걸상으로 막았다 → 입구에서 단 계단까지 카펫만 밟아 가는 길이 끊긴다(어도 위에는 아무것도 놓지 않는다).", zoom=3)
    mco = M["joseon_in_corridor"]
    wc = next((x, y) for y in range(1, mco["H"]) for x in range(mco["W"]) if mco["lo"][(y - 1) * mco["W"] + x] in ceil_in and mco["lo"][y * mco["W"] + x] not in ceil_in
              and mco["up"][y * mco["W"] + x] in wallish and mco["up"][y * mco["W"] + x] not in overlap_tiles)
    record("pal", "corridor-wall-missing", "joseon_in_corridor", "wall-missing-under-ceiling", f"회랑 북벽 ({wc[0]},{wc[1]}) 의 벽 조각 칸을 지움",
           mco["lo"], set_cells(mco, "up", {wc: -1}), (max(0, wc[0] - 7), 0, wc[0] + 8, mco["H"]), "회랑 북벽 한 칸을 비웠다 → 천장 밑 벽 규칙(천장 바로 아래는 벽 조각)이 깨진다.")
    mb = M["joseon_in_bedchamber"]
    rd = next(d for d in mb["doors"] if d["piece"] != "in_b_exit_mat")
    record("pal", "bed-door-blocked", "joseon_in_bedchamber", "door-unreachable", f"침전 칸막이 문 앞 칸 ({rd['x']},{rd['y']}) 에 걸상을 놓음",
           mb["lo"], set_cells(mb, "up", {(rd["x"], rd["y"]): STOOL}), (rd["x"] - 6, rd["y"] - 5, rd["x"] + 7, rd["y"] + 4), "마루와 침소를 잇는 칸막이 문 앞 칸을 막았다 → 문 앞 칸에 닿지 못한다.")
    seg, lost = find_cut(mb, widths=(2,), lo_n=20, hi_n=300)
    record("pal", "bed-gap-cut", "joseon_in_bedchamber", "region-unreachable", f"침전 칸막이 틈 {seg} 두 칸을 걸상으로 막음(침소 {lost}칸이 갇힘)",
           mb["lo"], set_cells(mb, "up", {s: STOOL for s in seg}), (0, 0, mb["W"], mb["H"]), f"칸막이 틈(2칸 폭)을 막았다 → 침소 {lost}칸에 닿지 못한다.")
    dt = next(p for p in mt["placed"] if p["name"] == "pal_dais_top_m_b")
    dtile = mt["up"][dt["y"] * mt["W"] + dt["x"]]
    record("pal", "throne-dais-lower", "joseon_in_throne", "object-tile-in-lower-layer", f"어좌 단 윗면 칸 ({dt['x']},{dt['y']}) 을 lowerTiles 에 칠함",
           set_cells(mt, "lo", {(dt["x"], dt["y"]): dtile}), set_cells(mt, "up", {(dt["x"], dt["y"]): -1}), (dt["x"] - 5, dt["y"] - 3, dt["x"] + 6, dt["y"] + 5),
           "어좌 단 칸을 아래층에 칠했다 → 단 위 병풍·용상이 바닥 높이로 가라앉아 겹침 순서가 깨진다.")
    pg = next(a for a in TS["autotileGroups"] if a["id"] == "jb_pal_ceil47_autotile")
    pm = members[pg["id"]]
    cand = next((x, y) for y in range(mt["H"]) for x in range(1, mt["W"] - 1) if mt["lo"][y * mt["W"] + x] in pm and mt["lo"][y * mt["W"] + x - 1] not in pm and mt["lo"][y * mt["W"] + x + 1] in pm
                or False)
    cx, cy = cand
    mk = mask_of(pg, mt["lo"], mt["W"], mt["H"], cx, cy)
    swapped = (mk & ~(2 | 8 | 16 | 32 | 64 | 128)) | (2 if mk & 8 else 0) | (8 if mk & 2 else 0) | (16 if mk & 128 else 0) | (128 if mk & 16 else 0) | (32 if mk & 64 else 0) | (64 if mk & 32 else 0)
    record("pal", "palace-ceil-reversed", "joseon_in_throne", "autotile-mask-mismatch", f"궁 천장(단청 띠) 가장자리 칸 ({cx},{cy}) 을 반대쪽 가장자리 모양(마스크 {mk}→{swapped})으로 바꿈",
           set_cells(mt, "lo", {(cx, cy): pg["variantMap"][str(swapped)]}), mt["up"], (cx - 4, cy - 3, cx + 5, cy + 4), f"궁 천장 가장자리 칸 ({cx},{cy}) 을 반대 방향으로 바꿨다 → 단청 띠 테두리가 어긋난다.")
    (DATA / "qa-tamper-checks-new.json").write_text(json.dumps(tamper, ensure_ascii=False, indent=1) + "\n")

    # ================================================================== 문서 만들기
    from joseon_tileset import newrefs_text as TXT   # noqa: E402  (문서 본문)
    ctx = dict(c=c, M=M, GROUPS=GROUPS, SYM=SYM, SYM_KO=SYM_KO, ROOM_KO=ROOM_KO, FIELD_CAVE=FIELD_CAVE, INTERIOR=INTERIOR, PALACE=PALACE, mdraw=mdraw, walkable=walkable, reach=reach,
               qa_images=qa_images, qa_rows=qa_rows, tamper=tamper, members=members, piece_image=piece_image, cell_walk=cell_walk, base_mm=base_mm)
    return TXT.make_categories(ctx)
