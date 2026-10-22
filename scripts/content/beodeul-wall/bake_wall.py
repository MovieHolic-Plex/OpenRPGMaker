#!/usr/bin/env python3
"""버들항 마을 성벽 3판 — 버들항 시트 꼬리(28,544~, 한 행 128칸)에 성벽 조각을 덧붙여 굽는다.

  python3 scripts/content/beodeul-wall/bake_wall.py --gate-export DIR   # 3/4 관문에 낼 조립 그림 + items.jsonl 만 쓴다
  python3 scripts/content/beodeul-wall/bake_wall.py --samples DIR       # 확인용 조립 그림만 쓴다
  python3 scripts/content/beodeul-wall/bake_wall.py --no-gate           # 관문 영수증을 확인하지 않고 굽는다(개발 중 헤드리스 시험용 — 번들 반영 전 반드시 관문)
  python3 scripts/content/beodeul-wall/bake_wall.py                     # 관문을 확인하고 굽는다

입력  wall_art.py (규칙 함수가 찍는 코드 손 도트)
출력  public/assets/beodeul-city/beodeul-city-chipset.png — 앞 223행(28,544칸)은 그대로, 뒤 1행(128칸)
      src/assets/beodeulCityTileset.json · beodeulCitySheet.json · beodeulTownWallPieces.json
덧붙이기 전용: 앞 칸 번호는 바뀌지 않는다. 다시 돌려도 같은 결과(멱등).
bake_dungeon_ceiling.py(28,416~)가 시트를 다시 쓰면 이 꼬리가 사라지므로 그 끝에서 이 스크립트를 다시 부른다.

3판 기하(beodeulTownWall.ts 의 planTownWallRing 과 같다):
  가로 성벽 = 윗면 두 줄(yw, yw+1) + 앞면 네 줄(yw+2~yw+5). 세로 성벽 = 두 열 윗면. 모서리 2×2.
  망루 3×8·성문루 4×8 = (왼쪽 위 열, yw−1) 부터 — 윗면 플랫폼 세 줄 + 앞면 다섯 줄(성벽보다 한 줄 앞까지).
  땅 그림자 sh_* 는 2층(앞면 밑 줄, 세로 성벽 오른쪽 열).
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
ROWS_ADDED = 2         # 3판: 조각이 128칸을 넘어 한 행 더(28,672~28,799) 덧붙인다
COUNT = BASE + ROWS_ADDED * COLS
GATE_KIND = "structure"

PIECES = A.pieces()
INDEX = {p["name"]: i for i, p in enumerate(PIECES)}
assert len(PIECES) <= ROWS_ADDED * COLS, len(PIECES)


def tid(name): return BASE + INDEX[name]


def img(name): return PIECES[INDEX[name]]["img"]


def layer_of(name): return PIECES[INDEX[name]]["layer"]


# ---------------------------------------------------------------- 둘레 계획(편집기 beodeulTownWall.ts 와 같은 규칙)
def hsh(x, y, salt):
    """beodeulTownWall.ts 의 hsh 와 같은 값(Math.imul 하위 32비트 + 섞기 — 곱셈만 쓰면 6칸 주기로 같은 변형이 돌아왔다)."""
    h = ((x * 31 + y * 17 + salt * 101 + 7) * 2654435761) & 0xFFFFFFFF
    h ^= h >> 15
    h = (h * 0x2C1B3C6D) & 0xFFFFFFFF
    h ^= h >> 12
    return h & 0xFFFF


FACE_ROWS = A.FACE_ROWS          # 앞면 네 줄(u·m·n·l)
NF = len(FACE_ROWS)
GH = 2 + NF + 2                  # 성문루·망루 높이(줄): 플랫폼이 한 줄 솟고(−1), 윗면 두 줄, 앞면 NF 줄, 한 줄 앞으로 내민다


def plan_ring(x0, y0, x1, y1, gates=(), closed=(), vgaps=(), towers=(), stairs=()):
    """통로 사각형(북 y0·남 y1·서 x0·동 x1 — 세로 성벽은 x0..x0+1, x1-1..x1)의 둘레 성벽. 반환 {(x,y): 조각} 위층 · 아래층.
    gates: [('S'|'N', gx)] 통로 두 칸 gx·gx+1(성문루 gx-1..gx+2). closed: 닫힌 문으로 그릴 gates 원소.
    vgaps: [('W'|'E', gy, rows)] 세로 성벽 틈. towers: [('S'|'N', tx)] 망루 tx..tx+2. stairs: [sx] 북쪽 성벽 안쪽 계단."""
    up, lo = {}, {}

    def fvar(x, town):
        # 마을 쪽(북쪽 성벽 안쪽) 앞면에는 화살 구멍 변형 c 를 쓰지 않는다. 바로 왼쪽 열과 같은 변형이면 다음 변형(같은 칸이 나란히 서지 않게)
        # 열마다 1~(n−1) 단씩 걸어가는 누적 합 — 이웃 열은 늘 다르고, 값은 x 만으로 정해진다
        vs = "abd" if town else "abcd"
        n = len(vs)
        return vs[sum(1 + hsh(i, 0, 3) % (n - 1) for i in range(max(0, x) + 1)) % n]

    def face(x, y, k, kind="", town=False):
        up[(x, y)] = f"f_{k}_{kind}" if kind else f"f_{k}_{fvar(x, town)}"

    for x in range(x0, x1 + 1):
        if x0 + 1 < x < x1 - 1:
            v = hsh(x, y0, 1) % 4
            up[(x, y0)] = f"hn{v}_a"; up[(x, y0 + 1)] = f"hn{v}_b"
            v = hsh(x, y1, 1) % 4
            up[(x, y1)] = f"hs{v}_a"; up[(x, y1 + 1)] = f"hs{v}_b"
            for i, k in enumerate(FACE_ROWS): face(x, y0 + 2 + i, k, "shL" if x == x0 + 2 else "", town=True)
        for i, k in enumerate(FACE_ROWS): face(x, y1 + 2 + i, k, "endL" if x == x0 else "endR" if x == x1 else "")
    for (k, cx0, cy0) in (("nw", x0, y0), ("ne", x1 - 1, y0), ("sw", x0, y1), ("se", x1 - 1, y1)):
        for cy in range(2):
            for cx in range(2): up[(cx0 + cx, cy0 + cy)] = f"c_{k}_{cx}{cy}"
    for y in range(y0 + 2, y1):
        r = hsh(0, y, 2) % 4
        up[(x0, y)] = f"vw{r}_0"; up[(x0 + 1, y)] = f"vw{r}_1"
        r = hsh(1, y, 2) % 4
        up[(x1 - 1, y)] = f"ve{r}_0"; up[(x1, y)] = f"ve{r}_1"

    def shade_right(x, yw):
        n = up.get((x, yw))
        if n and n.startswith("hs"): up[(x, yw)] = "hs_sh_a"; up[(x, yw + 1)] = "hs_sh_b"
        for i, k in enumerate(FACE_ROWS):
            if up.get((x, yw + 2 + i), "").startswith("f_") and not up[(x, yw + 2 + i)].endswith(("endL", "endR")): up[(x, yw + 2 + i)] = f"f_{k}_shL"

    for (side, gx) in gates:
        yw = y1 if side == "S" else y0
        shut = (side, gx) in closed
        for cx in range(4):
            for cy in range(GH):
                x, y = gx - 1 + cx, yw - 1 + cy
                up.pop((x, y), None); lo.pop((x, y), None)
                n = f"gatec_{cx}_{cy}" if (shut and cy >= 3 and cx in (1, 2)) else f"gate_{cx}_{cy}"
                (lo if layer_of(n) == "lower" else up)[(x, y)] = n
        shade_right(gx + 3, yw)
    for (side, tx) in towers:
        yw = y1 if side == "S" else y0
        for cx in range(3):
            for cy in range(GH):
                up.pop((tx + cx, yw - 1 + cy), None)
                up[(tx + cx, yw - 1 + cy)] = f"tower_{cx}_{cy}"
        shade_right(tx + 3, yw)
    for (side, gy, rows) in vgaps:
        xa = x0 if side == "W" else x1 - 1
        e = "vw" if side == "W" else "ve"
        up[(xa, gy - 1 - NF)] = f"{e}_endS_0"; up[(xa + 1, gy - 1 - NF)] = f"{e}_endS_1"
        for i, k in enumerate(FACE_ROWS):
            up[(xa, gy - NF + i)] = f"f_{k}_endL"; up[(xa + 1, gy - NF + i)] = f"f_{k}_endR"
        for r in range(rows):
            up.pop((xa, gy + r), None); up.pop((xa + 1, gy + r), None)
        up[(xa, gy + rows)] = f"{e}_endN_0"; up[(xa + 1, gy + rows)] = f"{e}_endN_1"
    for sx in stairs:   # 옆 계단 3×4: 왼쪽 아래(sx, y0+5) 땅에서 오른쪽 위(sx+2, y0+2) → 통로(sx+2, y0+1)
        up[(sx + 2, y0 + 1)] = "hn_stair"
        for i, k in enumerate(FACE_ROWS):
            for cx in range(3): up[(sx + cx, y0 + 2 + i)] = f"stair_{cx}_{k}"
    # 땅 그림자(2층): 성벽 칸이 아닌 땅에만
    sh = {}

    def put_sh(x, y, k):
        if (x, y) in up or (x, y) in lo: return
        old = sh.get((x, y))
        if old and old != k: k = "se"
        sh[(x, y)] = k
    FB = 2 + NF            # 가로 성벽 앞면 바로 아래 땅 줄(윗면 첫 줄 기준)
    for x in range(x0 + 2, x1 - 1): put_sh(x, y0 + FB, "s")
    for x in range(x0, x1 + 1): put_sh(x, y1 + FB, "s")
    gap_rows = {(s_, gy + r) for (s_, gy, rows) in vgaps for r in range(rows)}
    for y in range(y0 + FB, y1):
        if ("W", y) not in gap_rows: put_sh(x0 + 2, y, "e")
    for y in range(y0, y1 + FB):
        if ("E", y) not in gap_rows: put_sh(x1 + 1, y, "e")
    for (side, tx) in towers:
        yw = y1 if side == "S" else y0
        for cx in range(3): put_sh(tx + cx, yw + FB + 1, "s")
        put_sh(tx + 3, yw + FB, "se")
    for (side, gx) in gates:
        yw = y1 if side == "S" else y0
        for cx in range(4): put_sh(gx - 1 + cx, yw + FB + 1, "s")
        put_sh(gx + 3, yw + FB, "se")
    for (side, gy, rows) in vgaps:
        xa = x0 if side == "W" else x1 - 1
        put_sh(xa, gy, "s"); put_sh(xa + 1, gy, "s")
    for (x, y), k in sh.items(): lo[(x, y)] = f"sh_{k}"
    return up, lo


def ring_sample():
    """조립 예 둘레(24×21): 남문(열림)·북문(닫힘)·망루 셋·계단·서쪽 틈."""
    return plan_ring(1, 2, 22, 13, gates=[("S", 10), ("N", 15)], closed=[("N", 15)], vgaps=[("W", 9, 2)],
                     towers=[("S", 3), ("S", 16), ("N", 5)], stairs=[10]), 24, 21


ROAD_TILE = 3221  # 버들항 자갈길(시트 앞쪽 원본 칸) — 조립 그림에서 성문 통로 밑 땅으로만 쓴다
GRASS = 737


def ring_ground():
    """조립 예 둘레의 길: 남문 통로 두 열 · 서쪽 틈 두 줄 · 북문 앞."""
    # 길은 그림 테두리에 닿지 않게 한 칸 안에서 끝낸다(테두리 화소는 윤곽이 아니다 — 관문 화풍 사실이 길 자갈을 윤곽으로 셌다)
    return ([(x, y) for x in (10, 11) for y in range(9, 20)] + [(x, y) for x in range(1, 6) for y in (9, 10)]
            + [(x, y) for x in (15, 16) for y in range(1, 3)])


def sheet_tile(n):
    sh = _SHEET()
    return sh.crop(((n % COLS) * T, (n // COLS) * T, (n % COLS + 1) * T, (n // COLS + 1) * T))


_SH = []


def _SHEET():
    if not _SH: _SH.append(Image.open(SHEET_PATH).convert("RGBA"))
    return _SH[0]


def render_plan(up, lo, W, H, bg=None, ground=()):
    im = Image.new("RGBA", (W * T, H * T), (0, 0, 0, 0))
    if bg is not None:
        g = sheet_tile(bg)
        for y in range(H):
            for x in range(W): im.paste(g, (x * T, y * T))
    if ground:
        rt = sheet_tile(ROAD_TILE)
        for (x, y) in ground:
            if 0 <= x < W and 0 <= y < H: im.paste(rt, (x * T, y * T))
    for (x, y), n in lo.items(): im.alpha_composite(img(n), (x * T, y * T))
    for (x, y), n in up.items(): im.alpha_composite(img(n), (x * T, y * T))
    return im


def parts_plan():
    """작은 둘레 표본(14×16): 모서리 넷·동쪽 틈(끝 마감 + 끝 앞면)·계단·망루 하나. 반환 (위층, 아래층, 가로, 세로)."""
    up, lo = plan_ring(1, 2, 12, 13, vgaps=[("E", 9, 2)], towers=[("N", 3)], stairs=[7])
    return up, lo, 14, 21


def gate_items():
    """관문에 낼 조립 그림: (이름, 그림, 판정자에게 줄 이름, 덮는 조각 이름 집합). 풀밭 바탕(그림자가 보이게)."""
    items = []
    (up, lo), W, H = ring_sample()
    items.append(("wall_ring", render_plan(up, lo, W, H, bg=GRASS, ground=ring_ground()),
                  "Roman-style stone town wall ring, 3/4 top-down (16px tiles): wall-walk tops two tiles deep seen from above (flagstone walkway with "
                  "crenellated parapets), four-tile-high weathered ashlar front faces below the north and south walls, two-tile-wide west and east walls seen from above, "
                  "a gatehouse with an open round arch tunnel, a gatehouse with closed wooden doors, square towers with crenellated top platforms, "
                  "stone stairs up the inner face, a gap in the west wall, ground shadows",
                  set(up.values()) | set(lo.values())))
    pu, pl, PW, PH = parts_plan()
    items.append(("wall_parts", render_plan(pu, pl, PW, PH, bg=GRASS, ground=[(x, y) for x in range(8, 13) for y in (9, 10)]),
                  "small Roman-style stone town wall ring, 3/4 top-down: flagstone wall-walk tops with crenellated parapets, four corners, "
                  "north wall inner face with stone stairs, south wall outer face, a gap in the east wall closed by end caps with their end faces, "
                  "a square tower with a crenellated top platform, ground shadows",
                  set(pu.values()) | set(pl.values())))
    gu, gl = {}, {}
    for cy in range(GH):
        for cx in range(4):
            n = f"gate_{cx}_{cy}"
            (gl if layer_of(n) == "lower" else gu)[(cx, cy)] = n
    items.append(("gatehouse_open", render_plan(gu, gl, 4, GH, bg=GRASS, ground=[(x, y) for x in (1, 2) for y in range(GH)]),
                  "stone town gatehouse, 3/4 top-down: crenellated walkable top platform seen from above, corbelled front face with a deep round arch tunnel "
                  "(vault ribs, raised portcullis, darker toward the inside, paved road through), two wall torches",
                  set(gu.values()) | set(gl.values())))
    cu = dict(gu)
    for cy in range(3, GH):
        for cx in (1, 2): cu[(cx, cy)] = f"gatec_{cx}_{cy}"
    items.append(("gatehouse_closed", render_plan(cu, {}, 4, GH, bg=GRASS),
                  "stone town gatehouse, 3/4 top-down: crenellated top platform seen from above, front face with a round arch closed by two iron-banded wooden doors",
                  set(cu.values())))
    tu = {(cx, cy): f"tower_{cx}_{cy}" for cx in range(3) for cy in range(GH)}
    items.append(("tower", render_plan(tu, {}, 3, GH, bg=GRASS),
                  "square stone wall tower, 3/4 top-down: crenellated top platform seen from above with a wooden trapdoor, corbel band, "
                  "ashlar front face with corner quoins and two arrow slits, plinth",
                  set(tu.values())))
    return items


def meta(label, desc, tags, passage, layer):
    return dict(label=label, description=desc, tags=["버들항", "성벽", "town_wall"] + tags, defaultLayer=layer, passage=passage, source="bundled-default")


def pass_flag(s):
    return {"up": "U" in s, "down": "D" in s, "left": "L" in s, "right": "R" in s}


def kits():
    """번들 키트 bd-wall-*. 위층(upperTiles)은 성벽 칸, 아래층(tiles)은 성문 터널 칸만(나머지 -1 = 땅 그대로). 그림자 조각은 키트에 넣지 않는다."""
    themes = ["village", "town", "city", "마을", "도시", "성벽"]
    out = []

    def kit(kid, name, up, lo, W, H, desc, rules, parts=None):
        lo = {k: v for k, v in lo.items() if not v.startswith("sh_")}
        rows = []
        for y in range(H):
            rows.append(dict(tiles=[tid(lo[(x, y)]) if (x, y) in lo else -1 for x in range(W)],
                             upperTiles=[tid(up[(x, y)]) if (x, y) in up else -1 for x in range(W)]))
        k = dict(id=kid, kind="section", name=name, width=W, height=H, tileSize=16, rows=rows, learnedFrom="db-authored",
                 ai=dict(description=desc, placementRules=rules, tags=["버들항", "성벽", "town_wall"], role="prop", repeatability="fixed", layerHome="upper", themes=themes))
        if parts: k["parts"] = parts
        out.append(k)

    gu, gl = {}, {}
    for cy in range(GH):
        for cx in range(4):
            n = f"gate_{cx}_{cy}"
            (gl if layer_of(n) == "lower" else gu)[(cx, cy)] = n
    gate_rules = ("가로 성벽(남·북) 줄에 넣는다: 성문루 0행 = 성벽 윗면 첫 줄보다 한 줄 위, 1·2행 = 성벽 윗면 두 줄, 3~6행 = 성벽 앞면 네 줄, 7행 = 그 아래 땅 줄(성문루는 한 줄 앞으로 내민다). "
                  "가운데 두 열(1·2)이 통로 — 길 두 칸을 그 열에 맞추고 문 앞뒤(위·아래 칸)에 길을 잇는다. 양옆 열(0·3)은 막힘. 성문루 오른쪽 성벽 칸은 그늘 판(hs_sh_*·f_*_shL).")
    kit("bd-wall-gatehouse", "버들항 성문루 4×8(열린 아치 터널)", gu, gl, 4, GH,
        "버들항 마을 성벽의 성문루. 위 세 줄은 사방 흉벽을 두른 윗면 플랫폼(쇠창살 홈), 아래 다섯 줄은 받침돌 띠·마름돌 앞면·모서리 돌과 두 칸 폭 둥근 아치 터널"
        "(궁륭 갈빗대·들어 올린 쇠창살·안으로 갈수록 어두운 바닥)·횃불 둘. 사람이 아치 밑으로 지나간다(위 네 줄은 ★).",
        gate_rules, parts=[dict(id="gate", kind="entrance", dx=1, dy=GH - 1, w=2, h=1, note="통로 두 칸(걸음). 아래 칸에 바깥 길을 잇는다")])
    cu = dict(gu)
    for cy in range(3, GH):
        for cx in (1, 2): cu[(cx, cy)] = f"gatec_{cx}_{cy}"
    kit("bd-wall-gatehouse-closed", "버들항 성문루 4×8(닫힌 문)", cu, {}, 4, GH,
        "닫힌 성문루: 같은 아치를 쇠띠 두른 널 문짝 두 짝이 막는다(막힘). 열린 성문루(bd-wall-gatehouse)와 같은 자리에 바꿔 찍어 문을 여닫는다.",
        gate_rules.replace("가운데 두 열(1·2)이 통로 — 길 두 칸을 그 열에 맞추고 문 앞뒤(위·아래 칸)에 길을 잇는다.", "가운데 두 열은 닫힌 문(막힘)."))
    tu = {(cx, cy): f"tower_{cx}_{cy}" for cx in range(3) for cy in range(GH)}
    kit("bd-wall-tower", "버들항 성벽 망루 3×8(흉벽 두른 윗면)", tu, {}, 3, GH,
        "성벽 줄에 서는 네모 망루: 위 세 줄은 사방 흉벽을 두른 윗면 플랫폼(나무 들창), 아래 다섯 줄은 받침돌 띠·마름돌 앞면·모서리 돌·화살 구멍 둘·굽도리. "
        "성벽보다 16px 높고 한 줄 앞으로 내민다. 1·2행은 성벽 통로가 망루를 지나는 ★ 칸(동서 걸음), 나머지는 막힘.",
        "가로 성벽 줄에 넣는다: 망루 0행 = 성벽 윗면 첫 줄보다 한 줄 위, 1·2행 = 성벽 윗면 두 줄, 7행 = 성벽 앞면 아래 땅 줄. 망루 오른쪽 성벽 칸은 그늘 판. 모서리에는 쓰지 않는다.")
    su = {(2, 0): "hn_stair"}
    for i, k in enumerate(FACE_ROWS):
        for cx in range(3): su[(cx, 1 + i)] = f"stair_{cx}_{k}"
    kit("bd-wall-stairs", "버들항 성벽 옆 계단 3×5(북쪽 성벽 안쪽)", su, {}, 3, 1 + NF,
        "북쪽 성벽(마을 쪽 앞면이 보이는 성벽)의 앞면 네 줄에 붙여 쌓은 옆 계단: 왼쪽 아래 땅에서 오른쪽 위 성벽 통로로 8단(밝은 디딤판·짙은 계단 몸). 오른쪽 위 통로 칸이 계단 머리.",
        "북쪽 성벽 윗면 아래 줄(0행)의 오른쪽 칸(열 2)과 그 아래 앞면 네 줄(1~4행) × 세 열에 찍는다. 계단 왼쪽 아래(열 0, 5행) 땅 칸은 비워 둔다.")
    hs = {}
    for x in range(4):
        v = x % 2
        hs[(x, 0)] = f"hs{v}_a"; hs[(x, 1)] = f"hs{v}_b"
        for i, k in enumerate(FACE_ROWS): hs[(x, 2 + i)] = f"f_{k}_{'abcd'[x]}"
    kit("bd-wall-run-south-4", "버들항 남쪽 성벽 4×6(바깥 앞면)", hs, {}, 4, 2 + NF,
        "마을 남쪽(맵 아래쪽) 성벽 한 토막: 위 두 줄 = 윗면(판석 통로 + 앞 흉벽 톱니, 동서로 걷는다), 아래 네 줄 = 바깥 마름돌 앞면(갓돌 띠·빗물 자국·이끼 낀 굽도리, 막힘).",
        "가로로 이어 찍는다. 끝은 c_sw_*·c_se_*(2×2 모서리) 아래에 f_*_endL·f_*_endR 로 닫는다.")
    hn = {}
    for x in range(4):
        v = (x + 1) % 2
        hn[(x, 0)] = f"hn{v}_a"; hn[(x, 1)] = f"hn{v}_b"
        for i, k in enumerate(FACE_ROWS): hn[(x, 2 + i)] = f"f_{k}_{'dabd'[x]}"
    kit("bd-wall-run-north-4", "버들항 북쪽 성벽 4×6(안쪽 앞면)", hn, {}, 4, 2 + NF,
        "마을 북쪽(맵 위쪽) 성벽 한 토막: 위 두 줄 = 윗면(뒤 흉벽 안쪽 면 + 판석 통로), 아래 네 줄 = 마을 쪽 안쪽 앞면.",
        "가로로 이어 찍는다. 계단(bd-wall-stairs)은 이 성벽에만 단다.")
    kit("bd-wall-run-west-4", "버들항 서쪽 성벽 2×4", {(cx, y): f"vw{y % 2}_{cx}" for cx in range(2) for y in range(4)}, {}, 2, 4,
        "마을 서쪽 성벽: 위에서 본 두 칸 폭 통로와 바깥(서)쪽 흉벽 띠. 남북으로 걷는다.", "세로로 이어 찍는다. 위 끝은 c_nw_*(북서 모서리 2×2), 아래 끝은 c_sw_*.")
    kit("bd-wall-run-east-4", "버들항 동쪽 성벽 2×4", {(cx, y): f"ve{y % 2}_{cx}" for cx in range(2) for y in range(4)}, {}, 2, 4,
        "마을 동쪽 성벽: 두 칸 폭 통로와 바깥(동)쪽 흉벽 띠.", "세로로 이어 찍는다. 위 끝은 c_ne_*, 아래 끝은 c_se_*.")
    (up, lo), W, H = ring_sample()
    kit("bd-wall-ring-sample", f"버들항 성벽 둘레 조립 예 {W}×{H}", up, lo, W, H,
        "둘레 성벽 조립 예: 남쪽 열린 성문루·북쪽 닫힌 성문루·망루 셋·북쪽 성벽 안쪽 계단·서쪽 성벽 틈(길).",
        "참고·견본용. 마을 둘레는 author_beodeul_town 의 walls:true 가 맵 크기에 맞춰 짓는다(같은 조각·같은 규칙).",
        parts=[dict(id="gate-s", kind="entrance", dx=10, dy=20, w=2, h=1, note="남문 통로"), dict(id="gap-w", kind="entrance", dx=1, dy=9, w=2, h=2, note="서쪽 틈")])
    return out


def write_tables():
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
    ids = lambda pred: [tid(p["name"]) for p in PIECES if pred(p["name"])]
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith("beodeul:town_wall")] + [
        dict(id="beodeul:town_wall", name="버들항 마을 성벽(윗면·앞면·모서리·끝·그림자)", role="wall", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: not n.startswith(("gate", "tower", "stair"))),
             description="3/4 시점 마을 성벽 조각. 가로 성벽 = 윗면 두 줄(판석 통로 + 흉벽, 동서 걸음) + 앞면 네 줄(마름돌, 막힘). 세로 성벽 = 두 칸 폭 윗면(남북 걸음). "
                         "hs = 남쪽 성벽(앞 흉벽), hn = 북쪽 성벽(뒤 흉벽, 마을 쪽 앞면), vw·ve = 서·동 성벽, c_* 2×2 모서리, *_end* 틈의 끝 마감, f_* 앞면(u·m·n·l), sh_* 2층 땅 그림자.",
             placementRules="마을 둘레는 author_beodeul_town walls:true 로 짓고 손으로 줄을 긋지 않는다. 손으로 고칠 때: 가로 성벽 윗면 두 줄 밑에 앞면 네 줄(f_u_* · f_m_* · f_n_* · f_l_*), "
                            "남쪽 앞면 양 끝은 f_*_endL·endR, 북쪽 앞면 맨 왼쪽은 f_*_shL. 성벽은 3층, 그림자(sh_*)는 2층 땅 칸."),
        dict(id="beodeul:town_wall_gate", name="버들항 성문루(열림·닫힘)", role="object", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: n.startswith("gate")),
             description="4×8 성문루. 가운데 두 열이 통로(열림: 남북 걸음, 위 네 줄 ★ + 아래 네 줄은 2층 터널 / 닫힘: 막힘). 키트 bd-wall-gatehouse · bd-wall-gatehouse-closed 로 통째로 찍는다.",
             placementRules="가로 성벽 줄에서 성문루 0행 = 성벽 윗면 첫 줄 위 한 줄. 통로 열 위아래에 길을 잇는다."),
        dict(id="beodeul:town_wall_tower", name="버들항 성벽 망루·계단", role="object", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: n.startswith(("tower", "stair"))),
             description="망루 3×8(흉벽 두른 윗면, 1·2행은 통로가 지나가는 ★)과 북쪽 성벽 안쪽 계단(걸음 남북). 키트 bd-wall-tower · bd-wall-stairs.",
             placementRules="망루는 가로 성벽 줄에(0행 = 윗면 첫 줄 위 한 줄), 계단은 북쪽 성벽 윗면 아래 줄 + 앞면 네 칸 자리에(3×4)."),
    ]
    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith("bd-wall-")] + kits()
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=COUNT, tilesPerRow=COLS)) + "\n")
    PIECES_JSON.write_text(json.dumps(dict(base=BASE, tiles={p["name"]: tid(p["name"]) for p in PIECES},
                                           lower=[p["name"] for p in PIECES if p["layer"] == "lower"]), ensure_ascii=False, indent=0) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-export", help="3/4 관문용 조립 그림 PNG 와 items.jsonl 을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--samples", help="확인용 조립 그림을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--no-gate", action="store_true", help="관문 영수증 확인 없이 굽는다(개발 중 시험용)")
    args = ap.parse_args()

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

    if not args.no_gate:
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

    sheet = Image.open(SHEET_PATH).convert("RGBA")
    if sheet.height < BASE_ROW * T: sys.exit(f"시트가 {BASE_ROW}행보다 짧다 — 던전 천장 꼬리부터 굽는다")
    out_sheet = Image.new("RGBA", (COLS * T, (BASE_ROW + ROWS_ADDED) * T), (0, 0, 0, 0))
    out_sheet.alpha_composite(sheet.crop((0, 0, COLS * T, BASE_ROW * T)), (0, 0))
    for i, p in enumerate(PIECES):
        out_sheet.alpha_composite(p["img"], ((i % COLS) * T, (BASE_ROW + i // COLS) * T))
    out_sheet.save(SHEET_PATH, optimize=True)
    _SH.clear()
    write_tables()
    print(json.dumps(dict(count=COUNT, pieces=len(PIECES), kits=[k["id"] for k in kits()]), ensure_ascii=False))


if __name__ == "__main__":
    main()
