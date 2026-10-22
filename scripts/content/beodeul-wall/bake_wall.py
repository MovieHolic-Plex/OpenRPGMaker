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
  성문루 4×8 = (왼쪽 위 열, yw−1) 부터 — 윗면 플랫폼 세 줄 + 앞면 다섯 줄(성벽보다 한 줄 앞까지).
  망루 3×9 = (왼쪽 위 열, yw−2) 부터 — 윗면 플랫폼 세 줄 + 앞면 여섯 줄(성벽 흉벽보다 한 줄 위에 윗면이 선다).
  세로 성벽을 길이 지나는 곳은 쪽문 문루(*_pg_*·*_pgw_*, ★ — 성벽 위로 한 줄 솟은 네모 문루) + 양옆 땅에 터널 입 그늘(mo_w·mo_e). 성문루 안쪽 길 칸에는 mo_n.
  기후 변형: 같은 이름 앞에 snow: · desert: (눈 덮인 성벽 · 사막 사암 성벽).
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
ROWS_ADDED = 8         # 3판 r9: 조각 656(기본 228 + 눈 214 + 사막 214) — 여섯 행(28,544~29,311)
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
GH = 2 + NF + 2                  # 성문루 높이(줄): 플랫폼이 한 줄 솟고(−1), 윗면 두 줄, 앞면 NF 줄, 한 줄 앞으로 내민다
GT = GH + 1                      # 망루 높이(줄): 플랫폼이 두 줄 솟는다(−2) — 성벽 흉벽 위로 윗면이 보인다
TOWER_VARS, GATE_VARS = 3, 2     # 윗면 소품 변형 수(망루 tower·tower1·tower2, 성문루 gate·gate1)


def tower_name(v, cx, cy, corner=""):
    """corner = 'w'(서쪽 모서리 망루) · 'e'(동쪽): 바깥 열의 통로 두 줄(cy 2·3)은 바깥쪽 걸음을 막은 조각."""
    c = corner if corner and cy in (2, 3) and cx == (0 if corner == "w" else 2) else ""
    return f"tower{'' if v == 0 else v}{c}_{cx}_{cy}"


def postern_rows(e, gy, rows):
    """쪽문 문루 줄(3판 r15): 앞면은 늘 두 줄 이상. 길 한 줄: gy−3 t · gy−2 b · gy−1 f2u(성벽 줄, pgw) · gy f2l. 길 두 줄: gy−2 t · gy−1 b · gy f2u · gy+1 f2l.
    길 세 줄 이상: gy−2 t · gy−1 b · gy fu · 사이 fm · 끝 fl. 이름의 {} 는 열(0·1)."""
    if rows == 1:
        return [(gy - 3, f"{e}_pgw_{{}}_t"), (gy - 2, f"{e}_pgw_{{}}_b"), (gy - 1, f"{e}_pgw_{{}}_f2u"), (gy, f"{e}_pg_{{}}_f2l")]
    out = [(gy - 2, f"{e}_pgw_{{}}_t"), (gy - 1, f"{e}_pgw_{{}}_b")]
    for i in range(rows):
        k = ("f2u" if i == 0 else "f2l") if rows == 2 else ("fu" if i == 0 else "fl" if i == rows - 1 else "fm")
        out.append((gy + i, f"{e}_pg_{{}}_{k}"))
    return out


def gate_name(v, cx, cy, shut=False):
    if shut and cy >= 3 and cx in (1, 2): return f"gatec_{cx}_{cy}"
    own = cy < 3 or (cy in (3, 4) and cx in (0, 3))      # 변형 1 은 윗면 + 방패 건 앞면 기둥
    return f"gate{v if v and own else ''}_{cx}_{cy}"


def plan_ring(x0, y0, x1, y1, gates=(), closed=(), vgaps=(), towers=(), stairs=()):
    """통로 사각형(북 y0·남 y1·서 x0·동 x1 — 세로 성벽은 x0..x0+1, x1-1..x1)의 둘레 성벽. 반환 {(x,y): 조각} 위층 · 아래층.
    gates: [('S'|'N', gx[, 변형])] 통로 두 칸 gx·gx+1(성문루 gx-1..gx+2). closed: 닫힌 문으로 그릴 gates 의 (side, gx).
    vgaps: [('W'|'E', gy, rows)] 세로 성벽 쪽문 터널. towers: [('S'|'N', tx[, 변형])] 망루 tx..tx+2. stairs: [sx] 북쪽 성벽 안쪽 계단.
    변형을 주지 않으면 편집기와 같은 해시로 고른다."""
    up, lo = {}, {}

    def fvar(x, town):
        # 마을 쪽(북쪽 성벽 안쪽) 앞면에는 화살 구멍 변형 c 를 쓰지 않는다. 바로 왼쪽 열과 같은 변형이면 다음 변형(같은 칸이 나란히 서지 않게)
        # 열마다 1~(n−1) 단씩 걸어가는 누적 합 — 이웃 열은 늘 다르고, 값은 x 만으로 정해진다
        # 3판 r9: 변형 여덟(a b c e f g h + 드문 d 물빼기 구멍) — 넷이면 긴 앞면이 4칸 주기로 보였다
        if hsh(x, 1, 4) % 13 == 0: return "d"
        vs = "abefgh" if town else "abcefgh"
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
        r = hsh(y, 0, 6) % 8
        up[(x0, y)] = f"vw{r}_0"; up[(x0 + 1, y)] = f"vw{r}_1"
        r = hsh(y, 1, 6) % 8
        up[(x1 - 1, y)] = f"ve{r}_0"; up[(x1, y)] = f"ve{r}_1"

    def shade_right(x, yw):
        n = up.get((x, yw))
        if n and n.startswith("hs"): up[(x, yw)] = "hs_sh_a"; up[(x, yw + 1)] = "hs_sh_b"
        elif n and n.startswith("hn") and n != "hn_stair" and up.get((x, yw + 1)) != "hn_stair": up[(x, yw)] = "hn_sh_a"; up[(x, yw + 1)] = "hn_sh_b"
        for i, k in enumerate(FACE_ROWS):
            if up.get((x, yw + 2 + i), "").startswith("f_") and not up[(x, yw + 2 + i)].endswith(("endL", "endR")): up[(x, yw + 2 + i)] = f"f_{k}_shL"

    # 변형은 목록 순서로 돌려 쓴다(이웃 망루·성문루가 같은 윗면이 되지 않게 — r8: 해시로 고르니 세 망루가 같았다)
    g0 = hsh(gates[0][1], 0, 6) if gates else 0
    t0 = hsh(towers[0][1], 0, 5) if towers else 0
    gates = [(g[0], g[1], g[2] if len(g) > 2 else (g0 + i) % GATE_VARS) for i, g in enumerate(gates)]
    towers = [(t[0], t[1], t[2] if len(t) > 2 else (t0 + i) % TOWER_VARS) for i, t in enumerate(towers)]
    for (side, gx, gv) in gates:
        yw = y1 if side == "S" else y0
        shut = (side, gx) in closed
        for cx in range(4):
            for cy in range(GH):
                x, y = gx - 1 + cx, yw - 1 + cy
                up.pop((x, y), None); lo.pop((x, y), None)
                n = gate_name(gv, cx, cy, shut)
                (lo if layer_of(n) == "lower" else up)[(x, y)] = n
        shade_right(gx + 3, yw)
        for cx in (1, 2):
            if not shut: lo[(gx - 1 + cx, yw - 2)] = "mo_n"      # 성문루 뒤(통로가 플랫폼 밑으로 들어가는 칸)
    for (side, tx, tv) in towers:
        yw = y1 if side == "S" else y0
        for cx in range(3):
            for cy in range(GT):
                up.pop((tx + cx, yw - 2 + cy), None)
                up[(tx + cx, yw - 2 + cy)] = tower_name(tv, cx, cy, "w" if tx == x0 else "e" if tx == x1 - 2 else "")
        shade_right(tx + 3, yw)
    for (side, gy, rows) in vgaps:      # 쪽문 터널: 성벽 윗면은 덮개돌로 잇고, 양옆 땅에 터널 입 그늘
        xa = x0 if side == "W" else x1 - 1
        e = "vw" if side == "W" else "ve"
        for (y, nm) in postern_rows(e, gy, rows):
            up[(xa, y)] = nm.format(0); up[(xa + 1, y)] = nm.format(1)
        for r in range(rows):
            lo[(xa - 1, gy + r)] = "mo_w"; lo[(xa + 2, gy + r)] = "mo_e"
    for sx in stairs:   # 옆 계단 3×4: 왼쪽 아래(sx, y0+5) 땅에서 오른쪽 위(sx+2, y0+2) → 통로(sx+2, y0+1)
        up[(sx + 2, y0 + 1)] = "hn_stair"
        for i, k in enumerate(FACE_ROWS):
            for cx in range(3): up[(sx + cx, y0 + 2 + i)] = f"stair_{cx}_{k}"
            n = up.get((sx + 3, y0 + 2 + i), "")      # 계단 몸이 오른쪽 앞면에 드리운 그늘(빛이 왼쪽 위, r12)
            if n.startswith("f_") and not n.endswith(("endL", "endR")): up[(sx + 3, y0 + 2 + i)] = f"f_{k}_shL"
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
    for (side, tx, _tv) in towers:
        yw = y1 if side == "S" else y0
        for cx in range(3): put_sh(tx + cx, yw + FB + 1, "s")
        put_sh(tx + 3, yw + FB, "e" if tx + 3 > x1 else "se")
        for dy in (-2, -1): put_sh(tx + 3, yw + dy, "e")
    for (side, gx, _gv) in gates:
        yw = y1 if side == "S" else y0
        for cx in range(4): put_sh(gx - 1 + cx, yw + FB + 1, "s")
        put_sh(gx + 3, yw + FB, "se")
    for (x, y), k in sh.items(): lo[(x, y)] = f"sh_{k}"
    return up, lo


def ring_sample():
    """조립 예 둘레(26×23): 남문(열림)·북문(닫힘, 윗면 변형 1)·망루 셋(남서 모서리 망루 포함, 윗면 변형 0·1·2)·계단·서쪽 쪽문 문루(길 두 줄)·동쪽 쪽문 문루(길 한 줄)."""
    return plan_ring(2, 3, 23, 14, gates=[("S", 10, 0), ("N", 15, 1)], closed=[("N", 15)], vgaps=[("W", 10, 2), ("E", 10, 1)],
                     towers=[("S", 2, 0), ("S", 17, 1), ("N", 6, 2)], stairs=[11]), 26, 23


ROAD_TILE = 3221  # 버들항 자갈길(시트 앞쪽 원본 칸) — 조립 그림에서 성문 통로 밑 땅으로만 쓴다
GRASS = 737
SNOW_GROUND, SNOW_ROAD = 25839, 25859     # 설원 마을 바탕 눈·길 가운데 칸(bd-pick-snowfield-ground-*)
SAND_GROUND, SAND_ROAD = 24548, 24538     # 사막 오아시스 마을 바탕 모래·길 가운데 칸
SNOW_GROUND_KIT = [25864, 25865, 25866, 25867, 25839, 25868, 25839, 25839, 25869]   # bd-pick-snowfield-ground-snow 3×3
SAND_GROUND_KIT = list(range(24543, 24552))                                          # bd-pick-desert-oasis-ground-sand 3×3


# 3판 r8: 기후 변형 이름 — 이 조각의 snow:/desert: 판이 있으면 그것, 없으면(그림자·터널 입 그늘) 기본 조각
def biome_name(n, biome):
    if not biome: return n
    b = f"{biome}:{n}"
    return b if b in INDEX else n


RETIRED = {f"{e}_{k}_{c}" for e in ("vw", "ve") for k in ("endS", "endN") for c in (0, 1)}   # 옛 성벽 틈 끝 마감 — 쪽문 터널로 바꾼 뒤 쓰지 않는다(칸 번호만 지킨다)


def ring_ground():
    """조립 예 둘레의 길: 서쪽 쪽문에서 동서 길(10·11행) · 남문 통로 두 열 · 닫힌 북문 안쪽 길(닫힌 문 밖에는 길을 내지 않는다).
    길은 그림 테두리에 닿지 않는다(테두리 화소는 윤곽이 아니다 — 관문 화풍 사실이 길 자갈을 윤곽으로 셌다)."""
    return ([(x, y) for x in range(1, 17) for y in (10, 11)] + [(x, y) for x in (10, 11) for y in range(10, 22)]
            + [(x, 10) for x in range(17, 25)])


def sheet_tile(n):
    sh = _SHEET()
    return sh.crop(((n % COLS) * T, (n // COLS) * T, (n % COLS + 1) * T, (n // COLS + 1) * T))


_SH = []


def _SHEET():
    if not _SH: _SH.append(Image.open(SHEET_PATH).convert("RGBA"))
    return _SH[0]


def render_plan(up, lo, W, H, bg=None, ground=(), biome=None):
    up = {k: biome_name(v, biome) for k, v in up.items()}
    lo = {k: biome_name(v, biome) for k, v in lo.items()}
    bg = {"snow": SNOW_GROUND_KIT, "desert": SAND_GROUND_KIT}.get(biome, bg) if bg is not None else None
    road = {"snow": SNOW_ROAD, "desert": SAND_ROAD}.get(biome, ROAD_TILE)
    im = Image.new("RGBA", (W * T, H * T), (0, 0, 0, 0))
    if bg is not None:
        # 기후 땅은 그 마을 바탕 키트 3×3 을 돌려 깐다(가운데 한 칸만 깔면 판판한 면이 관문 「평면 채움」으로 잡혔다)
        for y in range(H):
            for x in range(W): im.paste(sheet_tile(bg[(y % 3) * 3 + x % 3] if isinstance(bg, list) else bg), (x * T, y * T))
    if ground:
        rt = sheet_tile(road)
        for (x, y) in ground:
            if 0 <= x < W and 0 <= y < H: im.paste(rt, (x * T, y * T))
    for (x, y), n in lo.items(): im.alpha_composite(img(n), (x * T, y * T))
    for (x, y), n in up.items(): im.alpha_composite(img(n), (x * T, y * T))
    return im


def parts_plan():
    """작은 둘레 표본(16×23): 모서리 넷·서쪽 쪽문 문루(길 세 줄 — fu·fm·fl 앞면, r18: 동쪽은 모서리 망루와 겹쳤다)·계단·망루 하나(윗면 변형 1). 반환 (위층, 아래층, 가로, 세로)."""
    up, lo = plan_ring(2, 3, 13, 14, vgaps=[("W", 10, 3)], towers=[("N", 4, 1), ("N", 11, 0)], stairs=[7])
    return up, lo, 16, 23


PARTS_GROUND = [(x, y) for x in range(1, 9) for y in (10, 11, 12)]


def gate_items():
    """관문에 낼 조립 그림: (이름, 그림, 판정자에게 줄 이름, 덮는 조각 이름 집합). 기본 판 바탕 = 풀(그림자가 보이게).
    눈·사막 둘레 그림은 바탕을 투명으로 둔다 — 그 마을 땅 칸은 거의 한 색이라 관문 화풍 사실 「평면 채움」이 성벽이 아니라 땅을 셌다(r9). 길만 깐다.
    기후 변형(눈 덮인 성벽 · 사막 사암 성벽)도 같은 다섯 그림으로 따로 낸다 — 변형 조각은 그 그림의 영수증으로만 덮인다."""
    items = []
    for biome in (None,) + A.BIOMES:
        sfx = "" if biome is None else f"_{biome}"
        what = {None: "Roman-style stone", "snow": "snow-covered Roman-style stone", "desert": "sandstone (desert) Roman-style"}[biome]

        def keys(*plans):
            out = set()
            for d in plans: out |= {biome_name(v, biome) for v in d.values()}
            return out
        (up, lo), W, H = ring_sample()
        # 투명 바탕(기후 판)에서는 반투명 땅 그림자·터널 입 그늘을 빼고 낸다 — 그 조각은 기후와 무관해 기본 판 영수증이 덮는다
        nosh = lambda d: d if biome is None else {k: v for k, v in d.items() if not v.startswith(("sh_", "mo_"))}
        lo = nosh(lo)
        items.append(("wall_ring" + sfx, render_plan(up, lo, W, H, bg=GRASS if biome is None else None, ground=ring_ground(), biome=biome),
                      f"{what} town wall ring, 3/4 top-down (16px tiles): wall-walk tops two tiles deep seen from above (flagstone walkway with "
                      "crenellated parapets), four-tile-high weathered ashlar front faces below the north and south walls, two-tile-wide west and east walls seen from above, "
                      "a gatehouse with an open round arch tunnel, a gatehouse with closed wooden doors, square towers rising above the wall with crenellated top platforms "
                      "(trapdoor and pennant, brazier, stone balls and crates; each tower's face has a different arrangement of arrow slits and a barred window), stone stairs up the inner face, a road passing under the west wall through a postern gate tower, ground shadows",
                      keys(up, lo)))
        pu, pl, PW, PH = parts_plan()
        pl = nosh(pl)
        items.append(("wall_parts" + sfx, render_plan(pu, pl, PW, PH, bg=GRASS if biome is None else None, ground=PARTS_GROUND, biome=biome),
                      f"small {what} town wall ring, 3/4 top-down: flagstone wall-walk tops with crenellated parapets, four corners, "
                      "north wall inner face with stone stairs, south wall outer face, a road passing under the west wall through a postern (a small square gate tower rising one step above the wall, crenellated top with a murder-hole grate, south face with an arched door), "
                      "a square tower rising above the wall with a crenellated top platform, ground shadows",
                      keys(pu, pl)))
        gu, gl = {}, {}
        for cy in range(GH):
            for cx in range(4):
                n = f"gate_{cx}_{cy}"
                (gl if layer_of(n) == "lower" else gu)[(cx, cy)] = n
        items.append(("gatehouse_open" + sfx, render_plan(gu, gl, 4, GH, bg=GRASS, ground=[(x, y) for x in (1, 2) for y in range(1, GH)], biome=biome),
                      f"{what} town gatehouse, 3/4 top-down: crenellated walkable top platform seen from above (windlass drum, portcullis pit with grate, stone balls, barrel), "
                      "corbelled front face with a deep round arch tunnel (vault ribs, raised portcullis, darker toward the inside, paved road through), two wall torches",
                      keys(gu, gl)))
        cu = dict(gu)
        for cy in range(3, GH):
            for cx in (1, 2): cu[(cx, cy)] = f"gatec_{cx}_{cy}"
        items.append(("gatehouse_closed" + sfx, render_plan(cu, {}, 4, GH, bg=GRASS, biome=biome),
                      f"{what} town gatehouse, 3/4 top-down: crenellated top platform seen from above (windlass drum, portcullis pit, stone balls, barrel), "
                      "front face with a round arch closed by two iron-banded wooden doors",
                      keys(cu)))
        # 3판 r11: 세로 성벽만 따로 내면 판정자가 「위에서 본 납작한 띠(앞면 0행)」로 읽었다 — 남북 성벽·모서리로 닫은 좁은 둘레 안에서 변형 0~7 을 보인다
        ru, rl = plan_ring(1, 1, 6, 12)
        for i in range(8):
            ru[(1, 3 + i)] = f"vw{i}_0"; ru[(2, 3 + i)] = f"vw{i}_1"; ru[(5, 3 + i)] = f"ve{i}_0"; ru[(6, 3 + i)] = f"ve{i}_1"
        rl = nosh(rl)
        items.append(("wall_runs" + sfx, render_plan(ru, rl, 8, 19, bg=GRASS if biome is None else None, biome=biome),
                      f"{what} narrow town wall ring, 3/4 top-down: west and east walls (two tiles wide, seen from above: flagstone wall-walk with the outer "
                      "crenellated parapet strip, eight walk variants each) joined by corners to the north wall (walkway top and inner face) and the south wall "
                      "(walkway top and four-tile-high ashlar outer face)",
                      keys(ru, rl)))
        tu = {(cx, cy): f"tower_{cx}_{cy}" for cx in range(3) for cy in range(GT)}
        items.append(("tower" + sfx, render_plan(tu, {}, 3, GT, bg=GRASS, biome=biome),
                      f"{what} square wall tower, 3/4 top-down: crenellated top platform seen from above with a wooden trapdoor and a pennant on a pole, corbel band, "
                      "tall ashlar front face with corner quoins and three cross-shaped arrow slits, plinth",
                      keys(tu)))
    return items


def palette_problems():
    """조각의 모든 불투명·반투명 색이 버들항 시트 앞 칸(성벽 꼬리 앞)에 있는지 — 팔레트 잠금."""
    sheet = Image.open(SHEET_PATH).convert("RGBA").crop((0, 0, COLS * T, BASE_ROW * T))
    allowed = {c for _n, c in sheet.getcolors(1 << 24)}
    bad = {}
    for p in PIECES:
        for _n, c in p["img"].getcolors(1 << 16):
            if c[3] and c not in allowed: bad.setdefault(c, []).append(p["name"])
    return bad


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
        "버들항 마을 성벽의 성문루. 위 세 줄은 사방 흉벽을 두른 윗면 플랫폼(물레·쇠창살 구덩이·돌 탄환·통), 아래 다섯 줄은 받침돌 띠·마름돌 앞면·모서리 돌과 두 칸 폭 둥근 아치 터널"
        "(궁륭 갈빗대·들어 올린 쇠창살·안으로 갈수록 어두운 바닥)·횃불 둘. 사람이 아치 밑으로 지나간다(위 네 줄은 ★).",
        gate_rules, parts=[dict(id="gate", kind="entrance", dx=1, dy=GH - 1, w=2, h=1, note="통로 두 칸(걸음). 아래 칸에 바깥 길을 잇는다")])
    cu = dict(gu)
    for cy in range(3, GH):
        for cx in (1, 2): cu[(cx, cy)] = f"gatec_{cx}_{cy}"
    kit("bd-wall-gatehouse-closed", "버들항 성문루 4×8(닫힌 문)", cu, {}, 4, GH,
        "닫힌 성문루: 같은 아치를 쇠띠 두른 널 문짝 두 짝이 막는다(막힘). 열린 성문루(bd-wall-gatehouse)와 같은 자리에 바꿔 찍어 문을 여닫는다.",
        gate_rules.replace("가운데 두 열(1·2)이 통로 — 길 두 칸을 그 열에 맞추고 문 앞뒤(위·아래 칸)에 길을 잇는다.", "가운데 두 열은 닫힌 문(막힘)."))
    tu = {(cx, cy): f"tower_{cx}_{cy}" for cx in range(3) for cy in range(GT)}
    kit("bd-wall-tower", "버들항 성벽 망루 3×9(흉벽 두른 윗면)", tu, {}, 3, GT,
        "성벽 줄에 서는 네모 망루: 위 세 줄은 사방 흉벽을 두른 윗면 플랫폼(나무 들창·상자), 아래 여섯 줄은 받침돌 띠·마름돌 앞면·모서리 돌·십자 화살 구멍 셋·굽도리. "
        "성벽보다 32px 높아 윗면이 성벽 흉벽보다 한 줄 위에 서고, 한 줄 앞으로 내민다. 2·3행은 성벽 통로가 망루 밑을 지나는 ★ 칸(동서 걸음), 나머지는 막힘. "
        "윗면 소품 변형 tower1_*(들창 + 화로)·tower2_*(돌 탄환·상자·통)을 0~2행에 바꿔 찍을 수 있다.",
        "가로 성벽 줄에 넣는다: 망루 0행 = 성벽 윗면 첫 줄보다 두 줄 위, 2·3행 = 성벽 윗면 두 줄, 8행 = 성벽 앞면 아래 땅 줄. 망루 오른쪽 성벽 칸은 그늘 판. 모서리에는 쓰지 않는다.")
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
        "둘레 성벽 조립 예: 남쪽 열린 성문루·북쪽 닫힌 성문루·망루 셋(윗면 변형 셋)·북쪽 성벽 안쪽 계단·서쪽 성벽 쪽문 터널(길).",
        "참고·견본용. 마을 둘레는 author_beodeul_town 의 walls:true 가 맵 크기에 맞춰 짓는다(같은 조각·같은 규칙).",
        parts=[dict(id="gate-s", kind="entrance", dx=10, dy=20, w=2, h=1, note="남문 통로"), dict(id="postern-w", kind="entrance", dx=2, dy=10, w=2, h=2, note="서쪽 쪽문 터널")])
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
    ids = lambda pred: [tid(p["name"]) for p in PIECES if p["name"] not in RETIRED and pred(p["name"].split(":")[-1])]
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith("beodeul:town_wall")] + [
        dict(id="beodeul:town_wall", name="버들항 마을 성벽(윗면·앞면·모서리·끝·그림자)", role="wall", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: not n.startswith(("gate", "tower", "stair"))),
             description="3/4 시점 마을 성벽 조각. 가로 성벽 = 윗면 두 줄(판석 통로 + 흉벽, 동서 걸음) + 앞면 네 줄(마름돌, 막힘). 세로 성벽 = 두 칸 폭 윗면(남북 걸음). "
                         "hs = 남쪽 성벽(앞 흉벽), hn = 북쪽 성벽(뒤 흉벽, 마을 쪽 앞면), vw·ve = 서·동 성벽, *_pg_*·*_pgw_* 쪽문 문루(★), c_* 2×2 모서리, f_* 앞면(u·m·n·l), "
                         "sh_* 2층 땅 그림자, mo_* 2층 터널 입 그늘. 눈 덮인 판 snow:* · 사막 사암 판 desert:* 이 같은 이름으로 있다.",
             placementRules="마을 둘레는 author_beodeul_town walls:true 로 짓고 손으로 줄을 긋지 않는다. 손으로 고칠 때: 가로 성벽 윗면 두 줄 밑에 앞면 네 줄(f_u_* · f_m_* · f_n_* · f_l_*), "
                            "남쪽 앞면 양 끝은 f_*_endL·endR, 북쪽 앞면 맨 왼쪽은 f_*_shL. 성벽은 3층, 그림자(sh_*)는 2층 땅 칸."),
        dict(id="beodeul:town_wall_gate", name="버들항 성문루(열림·닫힘)", role="object", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: n.startswith("gate")),
             description="4×8 성문루(윗면 변형 gate1_*). 가운데 두 열이 통로(열림: 남북 걸음, 위 네 줄 ★ + 아래 네 줄은 2층 터널 / 닫힘: 막힘). 키트 bd-wall-gatehouse · bd-wall-gatehouse-closed 로 통째로 찍는다.",
             placementRules="가로 성벽 줄에서 성문루 0행 = 성벽 윗면 첫 줄 위 한 줄. 통로 열 위아래에 길을 잇는다."),
        dict(id="beodeul:town_wall_tower", name="버들항 성벽 망루·계단", role="object", source="bundled-default", defaultLayer="upper", confidence="high",
             tileIds=ids(lambda n: n.startswith(("tower", "stair"))),
             description="망루 3×9(흉벽 두른 윗면, 2·3행은 통로가 밑으로 지나가는 ★, 윗면 변형 tower1_*·tower2_*)과 북쪽 성벽 안쪽 계단(걸음 남북). 키트 bd-wall-tower · bd-wall-stairs.",
             placementRules="망루는 가로 성벽 줄에(0행 = 윗면 첫 줄 위 두 줄), 계단은 북쪽 성벽 윗면 아래 줄 + 앞면 네 칸 자리에(3×4)."),
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

    bad = palette_problems()
    if bad:
        for c, names in bad.items(): print("팔레트 밖 색", "#%02x%02x%02x" % c[:3], c[3], names[:4], len(names), file=sys.stderr)
        sys.exit(3)
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
        # 화소가 똑같은 조각(모서리 망루 바깥 열 = 통행만 다른 같은 그림)은 그 그림의 영수증이 덮는다
        same = {}
        for p in PIECES: same.setdefault(p["img"].tobytes(), set()).add(p["name"])
        for names in same.values():
            if names & covered: covered |= names
        missing = sorted(set(INDEX) - covered - RETIRED)
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
