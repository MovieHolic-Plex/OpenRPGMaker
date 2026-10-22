#!/usr/bin/env python3
"""버들항 마을 성벽 — 버들항 시트 꼬리(28,544~, 한 행 128칸)에 성벽 조각을 덧붙여 굽는다.

  python3 scripts/content/beodeul-wall/bake_wall.py --gate-export DIR   # 3/4 관문에 낼 조립 그림 + items.jsonl 만 쓴다
  python3 scripts/content/beodeul-wall/bake_wall.py --samples DIR       # 확인용 조립 그림(1배·3배)만 쓴다
  python3 scripts/content/beodeul-wall/bake_wall.py                     # 관문을 확인하고 굽는다

입력  wall_art.py (행 문자열 손 도트)
출력  public/assets/beodeul-city/beodeul-city-chipset.png — 앞 223행(28,544칸)은 그대로, 뒤 1행(128칸)
      src/assets/beodeulCityTileset.json · beodeulCitySheet.json — 칸 표 + 칸 묶음 beodeul:town_wall* + 키트 bd-wall-*
덧붙이기 전용: 앞 칸 번호는 바뀌지 않는다. 다시 돌려도 같은 결과(멱등).
bake_dungeon_ceiling.py(28,416~)가 시트를 다시 쓰면 이 꼬리가 사라지므로 그 끝에서 이 스크립트를 다시 부른다.

3/4 관문(hard rule): 모든 칸이 그 칸을 화소 그대로 품은 조립 그림(object-gate kind structure) 중 하나 이상의 통과로 덮여야 굽는다.
통과 = object_gate.refusal(..., context="bundle") 가 None(서명된 사람·위임 허용 또는 보정된 프로필의 pass). 하나라도 덮이지 않으면 굽지 않는다.
"""
import argparse, json, pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import wall_art as A  # noqa: E402

ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
PIECES_JSON = ROOT / "src/assets/beodeulTownWallPieces.json"  # 조각 이름 → 칸 번호(beodeulTownWall.ts 가 읽는다)
T = 16
COLS = 128
BASE = 28544          # 던전 천장 꼬리(28,416~28,543) 끝 = 성벽 시작
BASE_ROW = BASE // COLS
ROWS_ADDED = 1
COUNT = BASE + ROWS_ADDED * COLS
GATE_KIND = "structure"

PIECES = A.pieces()
INDEX = {p["name"]: i for i, p in enumerate(PIECES)}
assert len(PIECES) <= COLS


def tid(name): return BASE + INDEX[name]


def img(name): return A.img_of(PIECES[INDEX[name]]["rows"])


# ---------------------------------------------------------------- 둘레 계획(편집기 beodeulTownWall.ts 와 같은 규칙)
def plan_ring(x0, y0, x1, y1, gates=(), closed=(), vgaps=(), towers=(), stairs=()):
    """통로 사각형(북 y0·남 y1·서 x0·동 x1)의 둘레 성벽. 반환 {(x,y): 조각 이름} 위층 / 아래층 두 장.
    gates: [('S'|'N', gx)] 통로 두 칸 gx·gx+1, 성문루는 gx-1..gx+2. closed: 닫힌 문으로 그릴 gates 의 원소.
    vgaps: [('W'|'E', gy)] 세로 성벽 틈(길 두 줄 gy·gy+1). towers: [('S'|'N', tx)] 망루 tx..tx+1. stairs: [sx] 북쪽 성벽 안쪽 계단."""
    up, lo = {}, {}
    var = "abc"

    def face(x, y, k, left="", right=""):
        if left == "end" and right == "end": n = f"f_{k}_col"
        elif left == "end": n = f"f_{k}_endL"
        elif right == "end": n = f"f_{k}_endR"
        elif left == "sh": n = f"f_{k}_shL"
        elif right == "ab": n = f"f_{k}_abR"
        else: n = f"f_{k}_{var[(x * 7 + y * 3) % 3]}"
        up[(x, y)] = n

    for x in range(x0, x1 + 1):
        up[(x, y0)] = "c_nw" if x == x0 else "c_ne" if x == x1 else "hn"
        up[(x, y1)] = "c_sw" if x == x0 else "c_se" if x == x1 else "hs"
        if x0 < x < x1:
            face(x, y0 + 1, "u", "sh" if x == x0 + 1 else "", "ab" if x == x1 - 1 else "")
            face(x, y0 + 2, "l", "sh" if x == x0 + 1 else "", "ab" if x == x1 - 1 else "")
        face(x, y1 + 1, "u", "end" if x == x0 else "", "end" if x == x1 else "")
        face(x, y1 + 2, "l", "end" if x == x0 else "", "end" if x == x1 else "")
    for y in range(y0 + 1, y1):
        up[(x0, y)] = "vw"; up[(x1, y)] = "ve"

    def shade_right(x, yw):
        n = up.get((x, yw))
        if n in ("hs", "hn"): up[(x, yw)] = n + "_shL"
        for dy, k in ((1, "u"), (2, "l")):
            if up.get((x, yw + dy), "").startswith("f_"): up[(x, yw + dy)] = f"f_{k}_shL"

    for (side, gx) in gates:
        yw = y1 if side == "S" else y0
        shut = (side, gx) in closed
        for cx in range(4):
            for cy in range(4):
                x, y = gx - 1 + cx, yw - 1 + cy
                up.pop((x, y), None); lo.pop((x, y), None)
                if shut and cy >= 1 and cx in (1, 2):
                    n = f"gatec_{cx}_{cy}"
                    (lo if PIECES[INDEX[n]]["layer"] == "lower" else up)[(x, y)] = n
                    continue
                n = f"gate_{cx}_{cy}"
                (lo if PIECES[INDEX[n]]["layer"] == "lower" else up)[(x, y)] = n
                if cy == 0 and cx in (1, 2): lo[(x, y)] = f"gate_floor_{cx}"
                if cy == 1 and cx in (1, 2) and not shut: lo[(x, y)] = f"gate_dark_{cx}"
        shade_right(gx + 3, yw)
    for (side, gy) in vgaps:
        x = x0 if side == "W" else x1
        e = "vw" if side == "W" else "ve"
        up[(x, gy - 3)] = e + "_endS"; up[(x, gy - 2)] = "f_u_col"; up[(x, gy - 1)] = "f_l_col"
        up.pop((x, gy), None); up.pop((x, gy + 1), None)
        up[(x, gy + 2)] = e + "_endN"
    for (side, tx) in towers:
        yw = y1 if side == "S" else y0
        for cx in range(2):
            for cy in range(7): up[(tx + cx, yw - 3 + cy)] = f"tower_{cx}_{cy}"
        shade_right(tx + 2, yw)
    for sx in stairs:
        up[(sx, y0)] = "hn_stair"; up[(sx, y0 + 1)] = "stair_u"; up[(sx, y0 + 2)] = "stair_l"
    return up, lo


def parts_plan():
    """오목 모서리·T 자·끝 마감·가름벽 표본(조립 예). 반환 (위층, 아래층, 가로, 세로)."""
    up = {}

    def face2(x, y, l="", r=""):
        def k(kind):
            if l == "end" and r == "end": return f"f_{kind}_col"
            if l == "end": return f"f_{kind}_endL"
            if r == "end": return f"f_{kind}_endR"
            if l == "sh": return f"f_{kind}_shL"
            if r == "ab": return f"f_{kind}_abR"
            return f"f_{kind}_" + "abc"[(x * 7 + y) % 3]
        up[(x, y + 1)] = k("u"); up[(x, y + 2)] = k("l")
    for x in range(1, 23):
        up[(x, 1)] = "c_nw" if x == 1 else "c_ne" if x == 22 else "hn"
        if 1 < x < 22: face2(x, 1, "sh" if x == 2 else "", "ab" if x == 21 else "")
    for y in range(2, 14): up[(1, y)] = "vw"
    for y in range(2, 9): up[(22, y)] = "ve"
    for x in range(1, 13):
        up[(x, 14)] = "c_sw" if x == 1 else "c_se" if x == 12 else "hs"
        face2(x, 14, "end" if x == 1 else "", "end" if x == 12 else "")
    for y in range(10, 14): up[(12, y)] = "ve"
    up[(12, 9)] = "cc_se"
    for x in range(13, 23):
        up[(x, 9)] = "c_se" if x == 22 else "hs"
        face2(x, 9, "sh" if x == 13 else "", "end" if x == 22 else "")
    up[(8, 1)] = "t_n"
    for y in (2, 3, 4, 5): up[(8, y)] = "v2"
    up[(8, 6)] = "v2_endS"; up[(8, 7)] = "f_u_col"; up[(8, 8)] = "f_l_col"
    up[(7, 2)] = "f_u_abR"; up[(7, 3)] = "f_l_abR"; up[(9, 2)] = "f_u_shL"; up[(9, 3)] = "f_l_shL"
    up[(1, 10)] = "t_w"
    for x in range(2, 7): up[(x, 10)] = "hs_endE" if x == 6 else "hs"
    for x in range(2, 7): face2(x, 10, "sh" if x == 2 else "", "end" if x == 6 else "")
    for x in range(14, 19):
        up[(x, 4)] = "hn_endW" if x == 14 else "hn_endE" if x == 18 else "hn"
        face2(x, 4, "end" if x == 14 else "", "end" if x == 18 else "")
    # 둘째 표본 줄: 오목 모서리 셋(┐ └ ┘)·┤·┴·세로 끝(북)·남쪽 성벽 끝 마감
    oy = 18
    # ┐ (바깥 남서): 남쪽 성벽이 서쪽으로, 세로 성벽(바깥 서)이 남쪽으로
    up[(6, oy)] = "cc_sw"
    for x in range(1, 6): up[(x, oy)] = "hs_endW" if x == 1 else "hs"
    for x in range(1, 6): face2(x, oy, "end" if x == 1 else "", "ab" if x == 5 else "")
    for y in range(oy + 1, oy + 4): up[(6, y)] = "vw"
    up[(6, oy + 4)] = "vw_endS"; up[(6, oy + 5)] = "f_u_col"; up[(6, oy + 6)] = "f_l_col"
    # └ (바깥 북동): 세로 성벽(바깥 동)이 북쪽으로, 북쪽 성벽이 동쪽으로
    up[(10, oy + 4)] = "cc_ne"
    for y in range(oy, oy + 4): up[(10, y)] = "ve_endN" if y == oy else "ve"
    for x in range(11, 15): up[(x, oy + 4)] = "hn_endE" if x == 14 else "hn"
    face2(10, oy + 4, "end", ""); [face2(x, oy + 4, "", "end" if x == 14 else "") for x in range(11, 15)]
    # ┘ (바깥 북서): 세로 성벽(바깥 서)이 북쪽으로, 북쪽 성벽이 서쪽으로
    up[(20, oy + 4)] = "cc_nw"
    for y in range(oy, oy + 4): up[(20, y)] = "vw_endN" if y == oy else "vw"
    for x in range(16, 20): up[(x, oy + 4)] = "hn_endW" if x == 16 else "hn"
    [face2(x, oy + 4, "end" if x == 16 else "", "") for x in range(16, 20)]; face2(20, oy + 4, "", "end")
    # ┤ + ┴ : 동쪽 성벽에서 서쪽으로 가름벽, 가름벽 v2 가 남쪽 성벽에 닿는다
    for y in range(oy, oy + 8): up[(29, y)] = "ve_endN" if y == oy else "ve"
    up[(29, oy + 2)] = "t_e"
    for x in range(25, 29): up[(x, oy + 2)] = "hs_endW" if x == 25 else "hs"
    for x in range(25, 29): face2(x, oy + 2, "end" if x == 25 else "", "ab" if x == 28 else "")
    up[(29, oy + 8)] = "c_se"
    for x in range(19, 29): up[(x, oy + 8)] = "hs_endW" if x == 19 else ("t_s" if x == 22 else "hs")
    for x in range(19, 30): face2(x, oy + 8, "end" if x == 19 else "", "end" if x == 29 else "")
    up[(22, oy + 6)] = "v2_endN"; up[(22, oy + 7)] = "v2"
    return up, {}, 31, oy + 11


def ring_sample():
    """조립 예 둘레(18×16): 남문(열림)·북문(닫힘)·망루 셋·계단 둘·서쪽 틈."""
    return plan_ring(1, 3, 16, 12, gates=[("S", 7), ("N", 11)], closed=[("N", 11)], vgaps=[("W", 7)],
                     towers=[("S", 3), ("S", 12), ("N", 4)], stairs=[2, 8]), 18, 16


ROAD_TILE = 3221  # 버들항 자갈길(시트 앞쪽 원본 칸) — 조립 그림에서 성문 통로 밑 땅으로만 쓴다


def road_tile():
    sh = Image.open(SHEET_PATH).convert("RGBA")
    return sh.crop(((ROAD_TILE % COLS) * T, (ROAD_TILE // COLS) * T, (ROAD_TILE % COLS + 1) * T, (ROAD_TILE // COLS + 1) * T))


def ring_ground():
    """조립 예 둘레의 길: 남문 통로 두 열(성문 앞뒤 포함) · 서쪽 틈 두 줄 · 북문 앞."""
    g = [(x, y) for x in (7, 8) for y in range(9, 16)] + [(x, y) for x in (0, 1, 2) for y in (7, 8)] + [(x, y) for x in (11, 12) for y in range(0, 2)]
    return g


def render_plan(up, lo, W, H, bg=None, ground=()):
    im = Image.new("RGBA", (W * T, H * T), (0, 0, 0, 0))
    if bg is not None:
        for y in range(H):
            for x in range(W): im.paste(bg, (x * T, y * T))
    if ground:
        rt = road_tile()
        for (x, y) in ground:
            if 0 <= x < W and 0 <= y < H: im.paste(rt, (x * T, y * T))
    for (x, y), n in lo.items(): im.alpha_composite(img(n), (x * T, y * T))
    for (x, y), n in up.items(): im.alpha_composite(img(n), (x * T, y * T))
    return im


def object_rows(names):
    return [[(img(n) if n else None) for n in row] for row in names]


def gate_items():
    """관문에 낼 조립 그림: (이름, 그림, 판정자에게 줄 이름, 덮는 조각 이름 집합). 투명 바탕."""
    items = []
    (up, lo), W, H = ring_sample()
    items.append(("wall_ring", render_plan(up, lo, W, H, ground=ring_ground()),
                  "Roman-style stone town wall ring, 3/4 top-down (16px tiles): walkable wall-walk tops seen from above with crenellated parapets, "
                  "the front faces of the north and south walls below them, a gatehouse with an open round arch (passage), a gatehouse with closed wooden doors, "
                  "square towers with terracotta tiled pyramid roofs, stone stairs up the inner face, a gap in the west wall",
                  set(up.values()) | set(lo.values())))
    pu, pl, PW, PH = parts_plan()
    items.append(("wall_parts", render_plan(pu, pl, PW, PH),
                  "Roman-style stone town wall pieces assembled, 3/4 top-down: walkable wall-walk tops with crenellated parapets, wall front faces, "
                  "inner and outer corners, T-junctions with cross walls, wall end caps with their end faces",
                  set(pu.values())))
    gu, gl = {}, {}
    for cy in range(4):
        for cx in range(4):
            n = f"gate_{cx}_{cy}"
            (gl if PIECES[INDEX[n]]["layer"] == "lower" else gu)[(cx, cy)] = n
            if cy == 0 and cx in (1, 2): gl[(cx, cy)] = f"gate_floor_{cx}"
            if cy == 1 and cx in (1, 2): gl[(cx, cy)] = f"gate_dark_{cx}"
    items.append(("gatehouse_open", render_plan(gu, gl, 4, 4, ground=[(x, y) for x in (1, 2) for y in range(4)]),
                  "stone town gatehouse, 3/4 top-down: crenellated walkable top seen from above, front face with an open round arch passage (raised portcullis, dark tunnel, paved floor), two wall torches",
                  set(gu.values()) | set(gl.values())))
    cu, cl = dict(gu), {}
    for cy in (1, 2, 3):
        for cx in (1, 2): cu[(cx, cy)] = f"gatec_{cx}_{cy}"
    for cx in (1, 2): cl[(cx, 0)] = f"gate_floor_{cx}"
    items.append(("gatehouse_closed", render_plan(cu, cl, 4, 4),
                  "stone town gatehouse, 3/4 top-down: crenellated walkable top seen from above, front face with a round arch closed by two iron-banded wooden doors",
                  set(cu.values()) | set(cl.values())))
    eu, el = plan_ring(0, 0, 6, 11, vgaps=[("E", 6)])
    items.append(("wall_east_gap", render_plan(eu, el, 8, 14, ground=[(x, y) for x in (5, 6, 7) for y in (6, 7)]),
                  "small Roman-style stone town wall ring, 3/4 top-down: walkable wall-walk tops with crenellated parapets, north and south walls with front faces, west and east walls seen from above, a road passing through a gap in the east wall closed by end caps with their end faces",
                  set(eu.values()) | set(el.values())))
    tu = {(cx, cy): f"tower_{cx}_{cy}" for cx in range(2) for cy in range(7)}
    items.append(("tower", render_plan(tu, {}, 2, 7),
                  "small square stone wall tower projecting slightly in front of the wall line, 3/4 top-down: terracotta tiled pyramid roof, stone front face with corner quoins, an arched window and a cross arrow slit",
                  set(tu.values())))
    return items


def meta(label, desc, tags, passage, layer):
    return dict(label=label, description=desc, tags=["버들항", "성벽", "town_wall"] + tags, defaultLayer=layer, passage=passage, source="bundled-default")


def pass_flag(s):
    return {"up": "U" in s, "down": "D" in s, "left": "L" in s, "right": "R" in s}


def kits():
    """번들 키트 bd-wall-*. 위층(upperTiles)은 성벽 칸, 아래층(tiles)은 성문 통로 칸만(나머지 -1 = 땅 그대로)."""
    themes = ["village", "town", "city", "마을", "도시", "성벽"]
    out = []

    def kit(kid, name, up, lo, W, H, desc, rules, parts=None, x0=0, y0=0):
        rows = []
        for y in range(H):
            rows.append(dict(tiles=[tid(lo[(x0 + x, y0 + y)]) if (x0 + x, y0 + y) in lo else -1 for x in range(W)],
                             upperTiles=[tid(up[(x0 + x, y0 + y)]) if (x0 + x, y0 + y) in up else -1 for x in range(W)]))
        k = dict(id=kid, kind="section", name=name, width=W, height=H, tileSize=16, rows=rows, learnedFrom="db-authored",
                 ai=dict(description=desc, placementRules=rules, tags=["버들항", "성벽", "town_wall"], role="prop", repeatability="fixed", layerHome="upper", themes=themes))
        if parts: k["parts"] = parts
        out.append(k)

    # 성문루(열림·닫힘)
    gu, gl = {}, {}
    for cy in range(4):
        for cx in range(4):
            n = f"gate_{cx}_{cy}"
            (gl if PIECES[INDEX[n]]["layer"] == "lower" else gu)[(cx, cy)] = n
            if cy == 0 and cx in (1, 2): gl[(cx, cy)] = f"gate_floor_{cx}"
            if cy == 1 and cx in (1, 2): gl[(cx, cy)] = f"gate_dark_{cx}"
    gate_rules = ("가로 성벽(남·북) 줄에 넣는다: 성문루 0행은 성벽 통로 줄보다 한 줄 위, 3행은 성벽 앞면 아래 칸과 같은 줄. "
                  "가운데 두 열(1·2)이 통로 — 길 두 칸을 그 열에 맞추고 문 앞뒤(위·아래 칸)에 길을 잇는다. 양옆 기둥 열(0·3)은 막힘. 성문루 오른쪽 성벽 칸은 그늘 판(hs_shL·f_*_shL).")
    kit("bd-wall-gatehouse", "버들항 성문루 4×4(열린 아치)", gu, gl, 4, 4,
        "버들항 마을 성벽의 성문루. 꼭대기는 사방 흉벽, 앞면 가운데에 두 칸 폭 둥근 아치 통로(들어 올린 쇠창살·어두운 통로·판석 바닥)와 횃불 둘. 사람이 아치 밑으로 지나간다(위 두 줄은 ★).",
        gate_rules, parts=[dict(id="gate", kind="entrance", dx=1, dy=3, w=2, h=1, note="통로 두 칸(걸음). 아래 칸에 바깥 길을 잇는다")])
    cu, cl = dict(gu), {(1, 0): "gate_floor_1", (2, 0): "gate_floor_2"}
    for cy in (1, 2, 3):
        for cx in (1, 2): cu[(cx, cy)] = f"gatec_{cx}_{cy}"
    kit("bd-wall-gatehouse-closed", "버들항 성문루 4×4(닫힌 문)", cu, cl, 4, 4,
        "닫힌 성문루: 같은 아치를 쇠띠 두른 널 문짝 두 짝이 막는다(막힘). 열린 성문루(bd-wall-gatehouse)와 같은 자리에 바꿔 찍어 문을 여닫는다.",
        gate_rules.replace("가운데 두 열(1·2)이 통로 — 길 두 칸을 그 열에 맞추고 문 앞뒤(위·아래 칸)에 길을 잇는다.", "가운데 두 열은 닫힌 문(막힘)."))
    tu = {(cx, cy): f"tower_{cx}_{cy}" for cx in range(2) for cy in range(7)}
    kit("bd-wall-tower", "버들항 성벽 망루 2×7(기와 모임지붕)", tu, {}, 2, 7,
        "성벽 줄에 서는 네모 망루: 버들항 민가와 같은 테라코타 기와 모임지붕, 모서리 돌, 아치 창, 십자 화살 구멍. 앞면이 성벽보다 한 칸 높고 성벽 앞으로 6px 내민다(7번째 줄 = 밑동·땅 그림자). 전부 막힘.",
        "가로 성벽 줄에 넣는다: 망루 3행 = 성벽 통로 줄, 5행 = 성벽 앞면 아래 칸 줄, 6행 = 그 아래 땅 줄(밑동·그림자, 비워 둔다)(지붕이 통로 줄 위로 솟는다). 망루 오른쪽 성벽 칸은 그늘 판. 모서리에는 쓰지 않는다.")
    su = {(0, 0): "hn_stair", (0, 1): "stair_u", (0, 2): "stair_l"}
    kit("bd-wall-stairs", "버들항 성벽 계단 1×3(북쪽 성벽 안쪽)", su, {}, 1, 3,
        "북쪽 성벽(안쪽 앞면이 보이는 성벽)의 앞면 두 칸을 계단으로 바꾸고, 그 위 통로 칸이 계단 머리가 된다. 땅에서 성벽 위 통로로 오르내린다(위아래 걸음).",
        "북쪽 성벽 줄에서 통로 칸(0행)과 그 아래 앞면 두 칸(1·2행)에 찍는다. 계단 아래 땅 칸(3행)은 비운다.")
    # 곧은 성벽·모서리 조각(조수가 손으로 성벽 둘레를 짓지 않게 — 짓기는 author_beodeul_town walls:"ring")
    kit("bd-wall-run-south-4", "버들항 남쪽 성벽 4×3(바깥 앞면)", {(x, 0): "hs" for x in range(4)} | {(x, 1): f"f_u_{'abca'[x]}" for x in range(4)} | {(x, 2): f"f_l_{'abca'[x]}" for x in range(4)}, {}, 4, 3,
        "마을 남쪽(맵 아래쪽) 성벽 한 토막: 위 줄 = 통로(앞 흉벽 톱니, 동서로 걷는다), 아래 두 줄 = 바깥 앞면(마름돌·굽도리, 막힘).",
        "가로로 이어 찍는다. 끝은 c_sw·c_se(둘레 모서리) 또는 hs_endW·hs_endE + f_*_endL·endR(끝 마감)로 닫는다.")
    kit("bd-wall-run-north-4", "버들항 북쪽 성벽 4×3(안쪽 앞면)", {(x, 0): "hn" for x in range(4)} | {(x, 1): f"f_u_{'bcab'[x]}" for x in range(4)} | {(x, 2): f"f_l_{'bcab'[x]}" for x in range(4)}, {}, 4, 3,
        "마을 북쪽(맵 위쪽) 성벽 한 토막: 위 줄 = 통로(뒤 흉벽 톱니), 아래 두 줄 = 마을 쪽 안쪽 앞면.",
        "가로로 이어 찍는다. 계단(bd-wall-stairs)은 이 성벽에만 단다.")
    kit("bd-wall-run-west-4", "버들항 서쪽 성벽 1×4", {(0, y): "vw" for y in range(4)}, {}, 1, 4,
        "마을 서쪽 성벽: 위에서 본 통로와 바깥(서)쪽 흉벽 띠. 남북으로 걷는다.", "세로로 이어 찍는다. 위 끝은 c_nw(북서 모서리), 아래 끝은 c_sw.")
    kit("bd-wall-run-east-4", "버들항 동쪽 성벽 1×4", {(0, y): "ve" for y in range(4)}, {}, 1, 4,
        "마을 동쪽 성벽: 통로와 바깥(동)쪽 흉벽 띠.", "세로로 이어 찍는다. 위 끝은 c_ne, 아래 끝은 c_se.")
    (up, lo), W, H = ring_sample()
    kit("bd-wall-ring-sample", "버들항 성벽 둘레 조립 예 18×16", up, lo, W, H,
        "둘레 성벽 조립 예: 남쪽 열린 성문루·북쪽 닫힌 성문루·망루 셋·북쪽 성벽 안쪽 계단 둘·서쪽 성벽 틈(길). 안쪽 마당 12×7.",
        "참고·견본용. 마을 둘레는 author_beodeul_town 의 walls:\"ring\" 이 맵 크기에 맞춰 짓는다(같은 조각·같은 규칙).",
        parts=[dict(id="gate-s", kind="entrance", dx=7, dy=14, w=2, h=1, note="남문 통로"), dict(id="gap-w", kind="entrance", dx=1, dy=7, w=1, h=2, note="서쪽 틈")])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-export", help="3/4 관문용 조립 그림 PNG 와 items.jsonl 을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--samples", help="확인용 조립 그림(풀밭 위 1배·3배)을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--dev-tail", help="굽지 않고 꼬리 한 행 그림(tail.png)과 칸 표(tables.json)만 이 폴더에 쓴다 — 관문 전 헤드리스 시험용, 번들에 넣지 않는다")
    args = ap.parse_args()

    if args.dev_tail:
        out = pathlib.Path(args.dev_tail); out.mkdir(parents=True, exist_ok=True)
        tail = Image.new("RGBA", (COLS * T, ROWS_ADDED * T), (0, 0, 0, 0))
        for i, p in enumerate(PIECES): tail.alpha_composite(A.img_of(p["rows"]), ((i % COLS) * T, (i // COLS) * T))
        tail.save(out / "tail.png")
        rows = []
        for i in range(ROWS_ADDED * COLS):
            if i >= len(PIECES): rows.append(dict(pass_=pass_flag("UDLR"), priority="lower", meta=dict(label="", description="", source="bundled-default"))); continue
            p = PIECES[i]
            rows.append(dict(pass_=pass_flag(p["pass_"]), priority="upper" if p["star"] else "lower", meta=dict(label=f"버들항 성벽 · {p['name']}", description=p["desc"], source="bundled-default")))
        (out / "tables.json").write_text(json.dumps(dict(base=BASE, rows=rows), ensure_ascii=False))
        print("dev tail ->", out)
        return

    if args.gate_export or args.samples:
        out = pathlib.Path(args.gate_export or args.samples); out.mkdir(parents=True, exist_ok=True)
        lines = []
        for name, im, label, _keys in gate_items():
            p = out / f"{name}.png"; im.save(p)
            lines.append(dict(png=str(p), kind=GATE_KIND, name=label, label=f"beodeul_town_wall/{name}"))
        if args.gate_export:
            (out / "items.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lines) + "\n")
        print("gate export" if args.gate_export else "samples", len(lines), "->", out)
        return

    # ---- 관문 ----
    import object_gate as OG
    covered, why = set(), {}
    for name, im, _label, keys in gate_items():
        r = OG.refusal(im, kind=GATE_KIND, context="bundle")
        if r: why[name] = r
        else: covered |= keys
    missing = sorted(set(INDEX) - covered)
    if missing:
        print("3/4 관문 미통과 — 굽지 않는다:", file=sys.stderr)
        for k, v in why.items(): print("  ", k, "←", v, file=sys.stderr)
        print("   덮이지 않은 조각:", missing, file=sys.stderr)
        sys.exit(2)

    # ---- 시트 ----
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    if sheet.height < BASE_ROW * T: sys.exit(f"시트가 {BASE_ROW}행보다 짧다 — 던전 천장 꼬리부터 굽는다")
    out_sheet = Image.new("RGBA", (COLS * T, (BASE_ROW + ROWS_ADDED) * T), (0, 0, 0, 0))
    out_sheet.alpha_composite(sheet.crop((0, 0, COLS * T, BASE_ROW * T)), (0, 0))
    for i, p in enumerate(PIECES):
        out_sheet.alpha_composite(A.img_of(p["rows"]), ((i % COLS) * T, (BASE_ROW + i // COLS) * T))
    out_sheet.save(SHEET_PATH, optimize=True)

    # ---- 칸 표 ----
    TS = json.loads(TS_PATH.read_text())
    for k in ("passability", "priority", "terrain", "tileMeta"): TS[k] = TS[k][:BASE]
    TS["animationStrips"] = [s for s in TS["animationStrips"] if s["baseTile"] < BASE]
    empty = dict(label="", description="", source="bundled-default")
    for i in range(ROWS_ADDED * COLS):
        if i >= len(PIECES):
            TS["passability"].append(pass_flag("UDLR")); TS["priority"].append("lower"); TS["terrain"].append(0); TS["tileMeta"].append(dict(empty)); continue
        p = PIECES[i]
        TS["passability"].append(pass_flag(p["pass_"]))
        TS["priority"].append("upper" if p["star"] else "lower")
        TS["terrain"].append(0)
        passage = "star" if p["star"] else ("solid" if not p["pass_"] else "passable")
        dirs = "".join(n for c, n in (("U", "북"), ("D", "남"), ("L", "서"), ("R", "동")) if c in p["pass_"])
        desc = p["desc"] + (f". 걸음 방향: {dirs}" if p["pass_"] and not p["star"] else (". 사람 위에 그려진다(★)" if p["star"] else ". 막힘")) + f". 조각 `{p['name']}`."
        TS["tileMeta"].append(meta(f"버들항 성벽 · {p['name']}", desc, [p["name"].split("_")[0]], passage, p["layer"]))
    TS["count"] = COUNT

    # ---- 칸 묶음 ----
    ids = lambda pred: [tid(p["name"]) for p in PIECES if pred(p["name"])]
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith("beodeul:town_wall")] + [
        dict(id="beodeul:town_wall", name="버들항 마을 성벽(통로·앞면·모서리·갈림목·끝)", role="wall", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: not n.startswith(("gate", "tower", "stair"))),
             description="3/4 시점 마을 성벽 조각. 통로 칸(위에서 본 판석 + 흉벽 톱니)은 걸음(방향 제한: 가로 성벽은 동서, 세로 성벽은 남북), 앞면 칸(마름돌 두 켜·굽도리)은 막힘. "
                         "hs = 남쪽 성벽(바깥 앞면이 보인다, 앞 흉벽), hn = 북쪽 성벽(마을 쪽 앞면, 뒤 흉벽), vw·ve = 서·동 성벽(바깥쪽 흉벽 띠), v2 = 가름벽. c_* 볼록 모서리, cc_* 오목 모서리, t_* 갈림목, *_end* 끝 마감, f_* 앞면.",
             placementRules="가로 성벽 = 통로 한 줄 + 그 아래 앞면 두 줄(f_u_* 위 칸, f_l_* 아래 칸). 세로 성벽 = 통로 한 열(앞면 없음). 둘레 모서리: 북서 c_nw 아래로 vw, 남서 c_sw 아래로 f_*_endL. "
                            "북쪽 성벽 앞면의 맨 왼쪽 칸은 f_*_shL(세로 성벽 그늘), 맨 오른쪽 칸은 f_*_abR. 위층(3층)에 놓는다. 마을 둘레는 author_beodeul_town walls:\"ring\" 으로 짓고 손으로 줄을 긋지 않는다."),
        dict(id="beodeul:town_wall_gate", name="버들항 성문루(열림·닫힘)", role="object", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: n.startswith("gate")),
             description="4×4 성문루. 가운데 두 열이 통로(열림: 걸음 남북, 위 두 줄 ★ + 아래층 통로 바닥·어둠 / 닫힘: 막힘). 키트 bd-wall-gatehouse · bd-wall-gatehouse-closed 로 통째로 찍는다.",
             placementRules="가로 성벽 줄에서 성문루 0행 = 통로 줄 위 한 줄. 통로 열 위아래에 길을 잇는다."),
        dict(id="beodeul:town_wall_tower", name="버들항 성벽 망루·계단", role="object", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: n.startswith(("tower", "stair"))),
             description="망루 2×7(기와 모임지붕, 막힘)과 북쪽 성벽 안쪽 계단(걸음 남북). 키트 bd-wall-tower · bd-wall-stairs.",
             placementRules="망루는 가로 성벽 줄에(3행 = 통로 줄), 계단은 북쪽 성벽 앞면 두 칸 자리에."),
    ]
    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith("bd-wall-")] + kits()
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=COUNT, tilesPerRow=COLS)) + "\n")
    PIECES_JSON.write_text(json.dumps(dict(base=BASE, tiles={p["name"]: tid(p["name"]) for p in PIECES},
                                           lower=[p["name"] for p in PIECES if p["layer"] == "lower"]), ensure_ascii=False, indent=0) + "\n")
    print(json.dumps(dict(count=COUNT, pieces=len(PIECES), kits=[k["id"] for k in kits()]), ensure_ascii=False))
    # 다음 꼬리: 마당 바닥(row 224, BASE 28672). 성벽이 시트를 다시 쓰면 마당 줄도 이어서 다시 굽는다.
    import subprocess
    subprocess.run([sys.executable, str(HERE.parent / "beodeul-yard" / "bake_yard.py")] + (["--dev"] if "--dev" in sys.argv else []), check=True)


if __name__ == "__main__":
    main()
