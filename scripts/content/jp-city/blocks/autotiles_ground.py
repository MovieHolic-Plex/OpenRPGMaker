#!/usr/bin/env python3
"""jp_city 블록 `autotiles_ground` — 지면 8방 오토타일 7종(각 49칸 = canon 47 + 몸통 변형 2).

  보도 연석 sidewalk(보도/바깥=아스팔트) · 생활도로 lane(아스팔트/바깥=집 앞 콘크리트) · 잔디 lawn(잔디/바깥=대지 자갈)
  자갈 참배길 gravel(자갈/바깥=잔디) · 판석 광장 plaza(판석/바깥=잔디) · 연못 pond(물/바깥=잔디, 돌 호안)
  수로 canal(물/바깥=콘크리트 보도, 콘크리트 호안)

계약: scripts/content/jp-city/CONTRACT.md. 같은 입력이면 같은 결과(난수 없음, 위치 해시). 그림은 코드로 그린 손 도트.
질감은 기존 jp_shopstreet16 칸의 이음새 없는 내부를 빌리고(sw·road_c·lawn·pave_a/b·water·gravel) 가장자리만 그린다.
  python3 blocks/autotiles_ground.py            # selftest + 눈 확인용 PNG 를 tiledata/jp-city/blocks/autotiles_ground/ 에 쓴다
"""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib_blocks import ground_autotile as GA  # noqa: E402
from lib_blocks.ground_autotile import C, chip, h01, CANON, canon  # noqa: E402

BLOCK = "autotiles_ground"
OUT_DIR = GA.ROOT / "tiledata/jp-city/blocks/autotiles_ground"


# ───────────────────────── 질감(16 주기) ─────────────────────────
def with_px(a, pts):
    a = a.copy()
    for (x, y, c) in pts: a[y, x] = c
    return a


# 계약 재료 색(tiledata/jp-city/palette-contract.json, 재료 5단: 0 깊은 그늘 … 4 하이라이트)
import json as _json
_CONTRACT = _json.load(open(GA.ROOT / "tiledata/jp-city/palette-contract.json", encoding="utf-8"))
_RAMP_J = {m["id"]: [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in m["steps"]] for f in _CONTRACT["families"] for m in f["materials"]}
CONTRACT_SET = {c for r in _RAMP_J.values() for c in r}


def J(mat, s):
    r = _RAMP_J[mat]
    return (*r[max(0, min(4, s))], 255)


def grid(rows, legend):
    """손 도트 행 문자열(16줄 × 16글자) → 16x16x4. legend: 글자 → RGBA."""
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    a = np.zeros((16, 16, 4), np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row): a[y, x] = legend[ch]
    return a


# ── 생활도로 아스팔트(계약 asphalt = yoru 1~5). 손으로 찍은 16 주기 골재: 밝은 알(l) 오른쪽 아래에 그늘(d), 드문 깊은 구멍(D·k),
#    아주 드문 반짝 알(w). 몸통은 고르게(큰 얼룩·보수 이음·잔금은 변형 b1 b2 에만 — 몸통에 넣으면 16px 마다 도장처럼 반복된다).
ASPH = {"k": J("asphalt", 0), "D": J("asphalt", 1), "d": J("asphalt", 2), ".": J("asphalt", 3), "l": J("asphalt", 4), "w": C("yoru", 6)}
LANE_BODY = [
    "....d.......l...",
    "..l......d......",
    "...d.........dD.",
    "......l..wl.....",
    ".d.....d..dd...l",
    "...............d",
    ".....d...l......",
    "..l...........d.",
    "...d...l......l.",
    "........d.......",
    "l..dD.....l.....",
    ".d.........d....",
    "......d.l....dd.",
    "...l.....d......",
    "....d........l..",
    ".........d....d.",
]
# b1: 기름·물이 밴 옅은 얼룩(경계가 딱딱하지 않게 어두운 알의 밀도로만) — 네모 보수판은 칸마다 도장처럼 읽혀 뺐다
LANE_B1 = [
    "....d.......l...",
    "..l......d......",
    "...d.........dD.",
    "......l..wl.....",
    ".d.....d..dd...l",
    "....d...d......d",
    "..d...d...l.....",
    "..l.d..d.d....d.",
    "...d..d..l.d..l.",
    "....d...d.......",
    "l..dD.d...l.....",
    ".d....d....d....",
    "......d.l....dd.",
    "...l.....d......",
    "....d........l..",
    ".........d....d.",
]
# b2: 짧은 잔금(갈래 하나, 금 왼쪽 위 가장자리만 군데군데 밝게)
LANE_B2 = [
    "....d.......l...",
    "..l......d......",
    "...d.........dD.",
    "......l..wl.....",
    ".d.....d..dd...l",
    "...............d",
    ".....d..........",
    "..l..l....l...d.",
    "...dDDD..DDD..l.",
    ".......DD...D...",
    "l..dD.......D...",
    ".d.........d....",
    "......d.l....dd.",
    "...l.....d......",
    "....d........l..",
    ".........d....d.",
]


def lane_tex():
    return grid(LANE_BODY, ASPH)


# ── 수로 물(계약 canal_indigo). 기본 2단, 물결 마루(r 3단)와 바로 밑 골(a 1단)이 짧은 가로 줄로, 드문 반짝(h 4단).
WATER = {"o": J("canal_indigo", 0), "a": J("canal_indigo", 1), ".": J("canal_indigo", 2), "r": J("canal_indigo", 3), "h": J("canal_indigo", 4)}
CANAL_BODY = [
    "................",
    "..rrr...........",
    "...a............",
    ".......aa.......",
    "................",
    "..........rr....",
    "...........a....",
    ".....h..........",
    "................",
    "................",
    "rrr.............",
    ".a..............",
    "................",
    "........rrrr....",
    ".........aa.....",
    "................",
]
CANAL_B1 = [
    "................",
    "..rrr...........",
    "...a............",
    "................",
    "........rrr.....",
    ".........a......",
    "...aa...........",
    "................",
    "............h...",
    "................",
    "rrr.............",
    ".a..............",
    ".....rr.........",
    "......a.........",
    "...........aa...",
    "................",
]
CANAL_B2 = [
    "................",
    "..rrr...........",
    "...a............",
    "................",
    "................",
    "....rr.....aa...",
    ".....a..........",
    "................",
    "..........rrr...",
    "...........a....",
    "rrr.............",
    ".a.....h........",
    "................",
    "................",
    "...aa...........",
    "................",
]


def canal_tex():
    return grid(CANAL_BODY, WATER)


def water_tex():
    """chipset water(849): 아래 3줄은 그림자가 구워져 있어 반복하면 줄무늬가 된다 → 위 13줄 + 3~5줄 되풀이로 16 주기."""
    w = chip("water")
    out = w.copy()
    out[13:16] = w[3:6]
    return out


def gravel_tex():
    """참배길 옥사리(玉砂利): 옅은 보도색 바탕에 1px 알갱이(chipset 의 1px 흩뿌림 관례). 16 주기."""
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            k = h01(x, y, 41)
            c = C("hodo", 5)
            if k < 0.09: c = C("hodo", 4)
            elif k < 0.15: c = C("hodo", 6)
            elif k < 0.17: c = C("hodo", 3)
            a[y, x] = c
    for (x, y) in ((3, 3), (11, 6), (6, 11), (13, 13), (8, 1)):   # 2px 굵은 알갱이
        a[y, x] = C("hodo", 4); a[y, (x + 1) % 16] = C("hodo", 4)
    return a


# ───────────────────────── 띠 그리기 ─────────────────────────
def _pick(seq, d):
    return seq[d] if 0 <= d < len(seq) else None


def style_sidewalk(side, d, s, x, y):
    """보도(높음)/바깥=아스팔트. 3/4: 남쪽 변은 연석 앞면이 보이고(블록 이음 8px), 북·동·서는 윗면 띠만."""
    if side == "S":
        if d == 0: return C("yoru", 2)                                  # 발치 그림자
        if d in (1, 2, 3):                                              # 앞면(위로 갈수록 밝게) + 블록 이음
            if s % 8 == 0: return C("conc", 1)
            return C("conc", 5 - d + 1)
        return _pick([None, None, None, None, C("conc", 5), C("conc", 6)], d)
    if side == "N": return _pick([C("conc", 3), C("conc", 6), C("conc", 5)], d)
    if side == "W": return _pick([C("conc", 3), C("conc", 6), C("conc", 5)], d)
    return _pick([C("conc", 2), C("conc", 4), C("conc", 5)], d)         # E


# 흰 외측선의 낡음(변을 따라 16 주기): 끊김(본바닥이 드러남)·때(한 단 탁함)
_LINE_GAP = {5, 12}
_LINE_DIRT = {2, 3, 9, 14}
_EDGE_DARK = {0, 7, 8, 13}


def style_lane(side, d, s, x, y):
    """생활도로(보도 없음): 집 앞 땅과 맞닿는 줄 한 칸(어두운 가장자리, 군데군데 더 깊음) + 1px 간격 + 낡은 흰 외측선 1px."""
    k = s % 16
    if d == 0: return J("asphalt", 0) if k in _EDGE_DARK else J("asphalt", 1)
    if d == 2:
        if k in _LINE_GAP: return J("asphalt", 4)                         # 선이 닳아 끊긴 곳(바닥이 드러난 밝은 자국)
        return C("shiro", 2) if k in _LINE_DIRT else C("shiro", 3)
    return None


# 풀 가장자리 높낮이(맨흙이 파고드는 깊이, 16 주기, 이웃 칸과 이어지게 끝-처음 차 ≤1)
GRASS_PROFILE = {
    "N": [2, 3, 3, 2, 1, 1, 2, 3, 4, 3, 2, 2, 1, 2, 3, 3],
    "S": [3, 2, 1, 2, 3, 4, 3, 2, 2, 1, 1, 2, 3, 3, 4, 3],
    "W": [2, 2, 3, 4, 3, 2, 1, 1, 2, 3, 3, 2, 2, 1, 2, 2],
    "E": [3, 3, 2, 1, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3, 3, 3],
}
_DIRT = None


def dirt_px(x, y):
    """풀 가장자리 바깥 = 거리 대지 바닥(자갈 참배길 질감). 예전엔 맨흙 칸을 빌려 자갈 대지·판석과 닿는 곳마다 갈색 디더 테두리가 붙었다(2026-10-13 조화 QA)."""
    global _DIRT
    if _DIRT is None: _DIRT = gravel_tex()
    return tuple(int(v) for v in _DIRT[y % 16, x % 16])


def style_lawn(side, d, s, x, y):
    """잔디(member)/바깥=맨흙. 풀이 흙 위로 삐죽: 깊이 프로필 안은 흙, 경계에 풀끝(밝음)·뿌리 그늘."""
    depth = GRASS_PROFILE[side][s % 16]
    if d < depth:
        if side in "SE" and d == depth - 1: return C("hodo", 3)        # 풀이 드리운 그림자(오른쪽 아래) — 대지 자갈보다 한 단 어둡게
        return dirt_px(x, y)
    if d == depth:
        return C("midori", 4) if h01(s, ord(side), 5) < 0.4 else C("midori", 3)
    if d == depth + 1 and h01(s, ord(side), 9) < 0.25: return C("midori", 1)
    return None


def style_gravel(side, d, s, x, y):
    """자갈길(member)/바깥=잔디. 가장자리를 두른 경계석(8px 마디, 마디 사이 흙 틈)."""
    joint = s % 8 == 7
    if side == "S":
        if d == 0: return C("hodo", 1)
        if d == 1: return C("hodo", 1) if joint else C("hodo", 3)
        if d == 2: return C("hodo", 2) if joint else C("hodo", 4)
        return _pick([None, None, None, None, C("hodo", 6)], d) if not joint else C("hodo", 2) if d == 3 else None
    top = {"N": [C("hodo", 3), C("hodo", 6), C("hodo", 5)], "W": [C("hodo", 3), C("hodo", 6), C("hodo", 5)],
           "E": [C("hodo", 2), C("hodo", 4), C("hodo", 5)]}[side]
    if d == 0: return C("hodo", 1) if joint else top[0]
    return top[d] if d < 3 else None


def style_plaza(side, d, s, x, y):
    """판석 광장(높음)/바깥=잔디. 연석과 같은 3/4: 남쪽 변은 판석 옆면(앞면)이 보인다. 판석 마디 8px."""
    if side == "S":
        if d == 0: return C("ki", 1)                                    # 풀밭에 지는 그림자
        if d in (1, 2, 3):
            if s % 8 == 0: return C("conc", 1)
            return C("conc", 5 - d + 1)
        return _pick([None, None, None, None, C("conc", 5), C("conc", 6)], d)
    if side in "NW": return _pick([C("conc", 3), C("conc", 6), C("conc", 5)], d)
    return _pick([C("conc", 2), C("conc", 4), C("conc", 5)], d)


# 연못 호안: 막돌(불규칙 2단), 북쪽 호안만 앞면이 보인다
def _pond_face(d, s):
    row = (d - 3) // 2                      # 막돌 2단(2px씩), 단마다 이음이 어긋남
    off = 3 if row else 0
    if (s + off) % 6 == 0 or (d - 3) % 2 == 1 and False: return C("conc", 1)
    k = h01((s + off) // 6, row, 17)
    top = (d - 3) % 2 == 0
    base = 4 if k < 0.4 else 3 if k < 0.75 else 5
    return C("conc", min(6, base + 1) if top else base)


def style_pond(side, d, s, x, y):
    if side == "N":
        if d == 0: return C("conc", 2)
        if d == 1: return C("conc", 6)
        if d == 2: return C("conc", 5)
        if d < 7: return _pond_face(d, s)
        if d == 7: return C("conc", 1)
        if d in (8, 9): return C("sora", 0)                              # 북쪽 호안이 물에 드리운 그림자
        return None
    if side == "W":
        if d == 0: return C("conc", 2)
        if d == 1: return C("conc", 6)
        if d == 2: return C("conc", 4)
        if d == 3: return C("conc", 1)
        if d == 4: return C("sora", 0)                                   # 서쪽 호안 그림자가 물 위로
        return None
    if side == "S":
        return _pick([C("conc", 2), C("conc", 6), C("conc", 5), C("conc", 3), C("sora", 0)], d)
    return _pick([C("conc", 1), C("conc", 3), C("conc", 4), C("conc", 2)], d)   # E


# 수로 호안(콘크리트 conc + 물때 moss/onsen_mineral_teal + 물 canal_indigo). 북쪽 호안 = 수직 앞면이 보인다(깊이 CANAL_N).
CANAL_N, CANAL_S, CANAL_W, CANAL_E = 13, 6, 6, 5
_FORM = {11}                       # 거푸집 이음(세로 줄) — 16 주기에 하나(둘이면 8px 눈금으로 읽혔다)
_TIE = {4, 13}                     # 거푸집 고정 구멍(폼타이) 자리 — 간격이 고르지 않게
_MOSS = [1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1]   # 물때 띠 종류(0 이끼 / 1 옥빛 물때)


def style_canal(side, d, s, x, y):
    """수로: 콘크리트 호안. 윗면 입술(이음 줄 → 윗면 → 밝은 모서리) 뒤로, 북쪽은 수직 앞면(입술 밑 그늘·거푸집 이음·폼타이 구멍·물때 띠)
    아래 물이 벽 그림자로 짙다가 가운데로 갈수록 밝아진다. 서·동·남은 윗면 띠 + 얇은 안쪽 벽 + 물에 비친 그늘."""
    k = s % 16
    if side == "N":
        if d == 0: return C("conc", 2)                                   # 보도 판과 갓돌 사이 줄
        if d == 1: return C("conc", 5)                                   # 갓돌 윗면
        if d == 2: return C("conc", 6)                                   # 갓돌 앞 모서리(빛)
        if 3 <= d <= 7:                                                  # 수직 앞면(5px)
            if d == 3: return C("conc", 1)                               # 갓돌이 드리운 그늘
            if k in _FORM: return C("conc", 1) if d < 7 else J("moss", 0)
            if k in _TIE and d == 5: return C("conc", 1)
            if k == 7 and d in (5, 6): return J("onsen_mineral_teal", 1)   # 물때가 흘러내린 자국
            if d == 7:                                                   # 물때 띠(수면 바로 위)
                return J("moss", 1) if _MOSS[k] == 0 else J("onsen_mineral_teal", 1)
            return C("conc", 2) if d == 6 else C("conc", 3)
        if d == 8: return J("moss", 0) if _MOSS[k] else J("canal_indigo", 0)   # 물 닿는 선
        if d in (9, 10): return J("canal_indigo", 0)                     # 벽 그림자 속 물
        if d == 11: return J("canal_indigo", 0) if k % 5 in (1, 3) else J("canal_indigo", 1)
        if d == 12: return J("canal_indigo", 1) if k % 4 != 2 else None
        return None
    if side == "W":
        if d == 0: return C("conc", 2)
        if d == 1: return C("conc", 5)
        if d == 2: return C("conc", 6)
        if d == 3: return C("conc", 1)                                   # 안쪽 벽(그늘 쪽, 한 줄)
        if d == 4: return J("canal_indigo", 0)
        if d == 5: return J("canal_indigo", 1) if k % 3 else None
        return None
    if side == "S":
        if d == 0: return C("conc", 2)
        if d == 1: return C("conc", 4)
        if d == 2: return C("conc", 5)
        if d == 3: return C("conc", 6)                                   # 물 쪽 모서리(빛)
        if d == 4: return J("canal_indigo", 1) if k not in (4, 10) else J("canal_indigo", 0)   # 호안이 물에 비친 얇은 그늘
        if d == 5: return J("canal_indigo", 1) if k in (1, 2, 7, 12, 13) else None
        return None
    # E: 오른쪽 호안 — 안쪽 벽이 빛을 받는 쪽이라 밝은 줄
    if d == 0: return C("conc", 1)
    if d == 1: return C("conc", 4)
    if d == 2: return C("conc", 5)
    if d == 3: return C("conc", 3)
    if d == 4: return J("canal_indigo", 1) if k % 4 else J("canal_indigo", 0)
    return None


# ───────────────────────── 몸통 변형 ─────────────────────────
def sidewalk_variants(base):
    b1 = with_px(base, [(10, 5, C("hodo", 4)), (4, 11, C("hodo", 6)), (11, 10, C("hodo", 6)), (6, 7, C("hodo", 4)), (7, 8, C("hodo", 4)),
                        (12, 13, C("hodo", 4))])                                                                        # 잔금 한 줄 + 얼룩
    return b1, chip("sw_tactile")                                          # b2 = 점자블록 줄(기존 칸 그대로)


def lane_variants(base):
    return grid(LANE_B1, ASPH), grid(LANE_B2, ASPH)


def lawn_variants(base):
    b1 = with_px(base, [(4, 4, C("midori", 1)), (5, 4, C("midori", 3)), (4, 5, C("midori", 3)), (11, 10, C("midori", 4)),
                        (10, 10, C("midori", 3)), (11, 11, C("midori", 1)), (7, 13, C("midori", 3)), (13, 3, C("midori", 3))])
    b2 = with_px(base, [(9, 3, C("midori", 1)), (9, 4, C("midori", 1)), (10, 3, C("midori", 4)), (3, 10, C("midori", 3)),
                        (4, 10, C("midori", 4)), (3, 11, C("midori", 1)), (12, 12, C("midori", 3)), (6, 7, C("midori", 3))])
    return b1, b2


def gravel_variants(base):
    b1 = with_px(base, [(5, 5, C("hodo", 3)), (6, 5, C("hodo", 4)), (11, 9, C("hodo", 3)), (3, 12, C("hodo", 4)), (4, 12, C("hodo", 4)),
                        (9, 2, C("hodo", 6)), (13, 7, C("hodo", 6))])
    b2 = with_px(base, [(8, 4, C("hodo", 3)), (8, 5, C("hodo", 4)), (2, 8, C("hodo", 6)), (12, 12, C("hodo", 3)), (13, 12, C("hodo", 4)),
                        (6, 13, C("hodo", 6)), (11, 3, C("hodo", 4))])
    return b1, b2


def _tint(a, x0, x1, y0, y1, c):
    a = a.copy()
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1): a[yy, xx] = c
    return a


def plaza_variants(base):
    """판석 한 장씩만 한 단 어둡게(이음 배치는 그대로, 이음 화소는 몸통과 같음)."""
    t = C("conc", 5)
    b1 = _tint(_tint(base, 1, 7, 1, 7, t), 5, 11, 9, 15, t)
    b2 = _tint(base, 9, 15, 1, 7, t)
    return b1, b2


def pond_variants(base):
    b1, b2 = base.copy(), base.copy()
    for (x, y) in ((3, 4), (4, 4), (5, 4), (10, 9), (11, 9), (12, 9), (3, 14), (4, 14), (5, 14)): b1[y, x] = C("sora", 1)
    for (x, y) in ((6, 3), (7, 3), (8, 3), (11, 7), (12, 7), (13, 7), (2, 11), (3, 11), (4, 11), (9, 13), (10, 13)): b1[y, x] = C("sora", 4)
    for (x, y) in ((3, 4), (4, 4), (5, 4), (10, 9), (11, 9), (12, 9), (3, 14), (4, 14), (5, 14)): b2[y, x] = C("sora", 1)
    for (x, y) in ((1, 6), (2, 6), (3, 6), (8, 10), (9, 10), (10, 10), (12, 4), (13, 4), (6, 1), (7, 1)): b2[y, x] = C("sora", 4)
    return b1, b2


def canal_variants(base):
    return grid(CANAL_B1, WATER), grid(CANAL_B2, WATER)


# ───────────────────────── 세트 정의 ─────────────────────────
def _s_rank(side, diag): return 0 if side == "S" else 1
def _n_rank(side, diag): return 0 if side == "N" else 1


def _raised_notch(style):
    """높은 지형(보도·판석)의 안쪽 모서리. 남쪽 대각(SE/SW)은 이웃 팔의 남쪽 연석 앞면 띠(6)가 끝나는 자리라
    윗면 줄(남쪽 변식)과 옆 띠(폭 3)로 L 자를 이어 준다. 북쪽 대각은 폭 3 의 윗면 띠 한 겹(체비셰프 고리)."""
    def f(nb, x, y):
        gx = 15 - x if nb[1] == "E" else x
        gy = 15 - y if nb[0] == "S" else y
        if nb[0] == "S":
            if gx >= 3 or gy >= 6: return None
            if gy in (4, 5): return style("S", gy, x, x, y)           # 남쪽 연석 윗면 줄
            return style(nb[1], gx, y, x, y)                           # 옆 띠(앞면 자리에 옆 띠가 선다)
        d = max(gx, gy)
        if d >= 3: return None
        return style(nb[1] if gx > gy else "N", d, y if gx > gy else x, x, y)
    return f


def _water_notch(style):
    """낮은 지형(물)의 안쪽 모서리. 북쪽 대각(NE/NW)은 땅의 남서(남동) 모서리가 물로 튀어나온 자리:
    위 칸의 옆 호안 띠(E 4 / W 5)가 내려오다가(gy < gx 쪽), 옆 칸의 북쪽 호안 앞면(깊이 10)과 만난다. 남쪽 대각은 윗면 띠 한 겹."""
    def f(nb, x, y):
        gx = 15 - x if nb[1] == "E" else x
        gy = 15 - y if nb[0] == "S" else y
        wd = 4 if nb[1] == "E" else 5
        if nb[0] == "N":
            if gx >= wd or gy >= 10: return None
            if gy < gx: return style(nb[1], gx, y, x, y)
            return style("N", gy, x, x, y)
        d = max(gx, gy)
        if d >= 5: return None
        return style(nb[1] if gx > gy else "S", d, y if gx > gy else x, x, y)
    return f


def _water_notch_w(style, nd, sd, wdW, wdE):
    """_water_notch 와 같은 생각(북쪽 대각 = 옆 호안 띠가 내려오다 북쪽 호안 앞면과 만남)에 띠 깊이를 세트가 정한다."""
    def f(nb, x, y):
        gx = 15 - x if nb[1] == "E" else x
        gy = 15 - y if nb[0] == "S" else y
        wd = wdE if nb[1] == "E" else wdW
        if nb[0] == "N":
            if gx >= wd or gy >= nd: return None
            if gy < gx: return style(nb[1], gx, y, x, y)
            return style("N", gy, x, x, y)
        d = max(gx, gy)
        eff = nb[1] if gx > gy else "S"
        if d >= (wd if eff != "S" else sd): return None
        return style(eff, d, y if gx > gy else x, x, y)
    return f


def sets():
    sw, rc, lawn, pave = chip("sw"), chip("road_c"), chip("lawn"), chip("pave_a")
    g, w = gravel_tex(), water_tex()
    lt, ct = lane_tex(), canal_tex()
    # (key, id, 한국어 이름, role, 질감, 띠, 변형, 순위, pc, 바깥 지형 칸(마스크 맵 렌더용), 설명)
    return [
        dict(key="sidewalk", id="jp-sidewalk-curb", name="보도 연석", role="road", tex=sw, style=style_sidewalk, var=sidewalk_variants(sw),
             rank=_s_rank, notch=_raised_notch(style_sidewalk), pc="floor", outside=lambda: rc, interior_n=2, tactile_b2=True, body_weights=(2, 1, 0),
             desc="보도(점자블록 줄 변형 포함) ↔ 아스팔트 도로. 바깥은 아스팔트 한 가지. 남쪽 변은 연석 앞면이 보이는 3/4."),
        dict(key="lane", id="jp-lane-road", name="생활도로", role="road", tex=lt, style=style_lane, var=lane_variants(lt),
             rank=None, pc="floor", outside=lambda: chip("sw"), interior_n=2,
             desc="보도 없는 생활도로 아스팔트. 집 앞 콘크리트와 맞닿는 가장자리에 1px 간격의 흰 외측선."),
        dict(key="lawn", id="jp-lawn-dirt", name="잔디", role="green", tex=lawn, style=style_lawn, var=lawn_variants(lawn),
             rank=None, pc="floor", outside=lambda: chip("gravel"), interior_n=2,
             desc="잔디 ↔ 맨흙. 풀 가장자리가 흙 위로 삐죽 나온다. 바깥은 맨흙(st.gravel 칸) 한 가지."),
        dict(key="gravel", id="jp-gravel-lawn", name="자갈 참배길", role="path", tex=g, style=style_gravel, var=gravel_variants(g),
             rank=_s_rank, pc="floor", outside=lambda: chip("lawn"), interior_n=2,
             desc="자갈 사도·참배길 ↔ 잔디. 경계석이 자갈길을 두른다. 바깥은 잔디(st.lawn) 한 가지."),
        dict(key="plaza", id="jp-plaza-pave", name="판석 광장", role="terrain", tex=pave, style=style_plaza, var=plaza_variants(pave),
             rank=_s_rank, notch=_raised_notch(style_plaza), body_weights=(5, 1, 1), pc="floor", outside=lambda: chip("lawn"), interior_n=2,
             desc="판석 광장 ↔ 잔디. 판석 모서리 면(남쪽은 옆면이 보임). 몸통은 판석 줄눈이 이어진다."),
        dict(key="pond", id="jp-water-pond", name="연못", role="water", tex=w, style=style_pond, var=pond_variants(w),
             rank=_n_rank, notch=_water_notch(style_pond), pc="solidfloor", outside=lambda: chip("lawn"), interior_n=2,
             desc="못·정원 연못(물, 지나갈 수 없음) ↔ 잔디. 돌 호안: 북쪽은 앞면이 보이고 남쪽·옆은 윗면 띠."),
        dict(key="canal", id="jp-water-canal", name="수로", role="water", tex=ct, style=style_canal, var=canal_variants(ct),
             rank=_n_rank, notch=_water_notch_w(style_canal, CANAL_N, CANAL_S, CANAL_W, CANAL_E), pc="solidfloor", outside=lambda: chip("sw"), interior_n=2,
             desc="수로·하천(물, 지나갈 수 없음) ↔ 콘크리트 보도. 콘크리트 호안: 북쪽은 수직 앞면 + 거푸집 이음."),
    ]


_CACHE = {}


def painted(S):
    """세트 → [(key, arr)] (47 + b1 + b2). 같은 프로세스에서는 한 번만 그린다."""
    if S["key"] not in _CACHE:
        _CACHE[S["key"]] = GA.build_set(S["tex"], S["style"], S["var"], S["rank"], S.get("notch"))
    return _CACHE[S["key"]]


def local_of(S, key):
    return f"{S['key']}.{'m%d' % key if isinstance(key, int) else key}"


def build():
    cells, autotiles, groups = {}, [], []
    for S in sets():
        arrs = painted(S)
        members = []
        for key, a in arrs:
            loc = local_of(S, key)
            members.append(loc)
            if isinstance(key, int):
                lab = f"{S['name']} · {GA.describe_mask(key)}"
                desc = f"{S['name']} 오토타일 칸(마스크 {key}). {S['desc']}"
            else:
                lab = f"{S['name']} · 몸통 변형 {key[1:]}"
                desc = f"{S['name']} 몸통 변형 {key[1:]}" + (" — 점자블록 줄(손으로 놓는 칸, 속칸 자동 배치에서 뺌)" if S.get("tactile_b2") and key == "b2" else " — 속칸 자동 변형") + ". " + S["desc"]
            cells[loc] = dict(img=_pil(a), pc=S["pc"], label=lab, desc=desc, tags=["autotile", "ground", S["key"], S["role"]])
        vm = GA.variant_map(lambda m, S=S: local_of(S, m))
        full = local_of(S, 255)
        body = [full, local_of(S, "b1")] + ([] if S.get("tactile_b2") else [local_of(S, "b2")])
        w3 = S.get("body_weights", (2, 1, 1))
        body = [full] * w3[0] + [local_of(S, "b1")] * w3[1] + [local_of(S, "b2")] * w3[2]       # 몸통을 더 자주(해시 선택)
        interior = [list(body) for _ in range(S["interior_n"])]
        autotiles.append(dict(id=S["id"], name=S["name"], neighborhood=8, layer="lower", member=members, connect=list(members),
                              variantMap=vm, interior=interior, edgeConnects=True, outsideConnects=True))
        groups.append(dict(id="jp:" + S["id"][3:], name=S["name"], role=S["role"], defaultLayer="lower", cells=list(members),
                           desc=S["desc"], rules="8방 오토타일: 같은 세트 칸끼리만 이웃으로 센다. 맵 밖은 같은 지형으로 이어진다(edgeConnects — 맵 둘레가 톱니로 끊기지 않는다). 타 지형과 맞닿는 변은 이 가장자리 그림을 그대로 쓴다."))
    return dict(cells=cells, autotiles=autotiles, groups=groups, kits=[], notes=NOTES)


def _pil(a):
    from PIL import Image
    return Image.fromarray(a, "RGBA")


NOTES = ("지면 8방 오토타일 7종 × 49칸 = 343칸. 오토타일 하나는 바깥 지형 한 가지만 가정한다: 보도=아스팔트, 생활도로=집 앞 콘크리트, "
         "잔디=맨흙(st.gravel), 자갈길=잔디, 판석=잔디, 연못=잔디, 수로=콘크리트 보도(st.sw). 다른 지형과 맞닿으면 가장자리 그림이 어색하다. "
         "connect 는 자기 세트 칸뿐(공원↔도로 사이에 연석이 서지 않음). 3/4: 높은 지형(보도·판석)은 남쪽 변에 앞면, 낮은 지형(물)은 북쪽 변에 앞면. "
         "경사진 모서리는 없고 직각(연석 모서리는 사선 접합). 보도 b2(점자블록 줄)는 엔진이 이웃 편집 때 몸통으로 되돌리므로 스탬프로만 쓴다. "
         "자갈·잔디 등 속칸 변형은 shadeAutotileInterior 가 해시로 고른다. 안쪽 모서리(대각만 비어 있는 칸)는 남쪽 연석 앞면·북쪽 호안 앞면이 끝나는 자리를 이어 붙인 전용 그림이다.")


# ───────────────────────── 검사·눈 확인 ─────────────────────────
def selftest(write=True, verbose=True):
    res = {}
    # 계약 재료 색(palette-contract.json)도 허용 팔레트다(굽기도 modern3 ∪ 계약으로 검사한다). 이음선 검사의 「계열」에도 재료 이름으로 넣는다.
    GA.PAL_SET |= CONTRACT_SET
    for mat, r in _RAMP_J.items():
        for c in r: GA.FAMILY.setdefault(c, mat)
    blk = build()
    errs = []
    # (a) 16x16 RGBA · 색 ⊂ modern3 · 알파 0/255
    n_img = 0
    for loc, c in blk["cells"].items():
        a = np.array(c["img"])
        n_img += 1
        for e in GA.check_image(a): errs.append(f"(a) {loc}: {e}")
        if a[..., 3].min() != 255: errs.append(f"(a) {loc}: 불투명 칸이어야 함")
    res["cells"] = n_img
    # (b) 256키·canon 47·키 존재
    for at in blk["autotiles"]:
        vm = at["variantMap"]
        if len(vm) != 256 or set(vm) != {str(i) for i in range(256)}: errs.append(f"(b) {at['id']}: 키 256 아님")
        miss = [v for v in vm.values() if v not in blk["cells"]]
        if miss: errs.append(f"(b) {at['id']}: 없는 칸 {set(miss)}")
        for m in range(256):
            if vm[str(m)] != vm[str(canon(m))]: errs.append(f"(b) {at['id']}: canon 불일치 {m}"); break
        canon_locals = {vm[str(m)] for m in range(256)}
        if len(canon_locals) != 47: errs.append(f"(b) {at['id']}: canon 종류 {len(canon_locals)} != 47")
        if len(at["member"]) != 49: errs.append(f"(b) {at['id']}: 멤버 {len(at['member'])} != 49")
        if any(c.startswith("other:") for c in at["connect"]): errs.append(f"(b) {at['id']}: 다른 오토타일 connect")
        # 그룹 칸 = 멤버 칸
    for gdef, at in zip(blk["groups"], blk["autotiles"]):
        if set(gdef["cells"]) != set(at["member"]): errs.append(f"(b) 그룹 {gdef['id']} 칸이 멤버와 다름")
    # (c) 이음새 — 변형이 몸통과 둘레 1줄이 같아야 섞어 깔아도 이어진다 + 3x3 반복 이음 비
    seam = {}
    for S in sets():
        arrs = dict((k, a) for k, a in painted(S))
        base = arrs[255]
        r = {k: GA.seam_ratio(arrs[k]) for k in (255, "b1", "b2")}
        ident = {k: GA.border_identical(arrs[k], base) for k in ("b1", "b2")}
        if S["key"] == "plaza":   # 판석 색조만 다르다: 이음(c4) 화소 위치가 몸통과 같으면 이어진다
            jm = lambda a: (a[..., :3] == np.array(C("conc", 4)[:3])).all(-1)
            ident = {k: bool((jm(arrs[k]) == jm(base)).all()) for k in ("b1", "b2")}
        seam[S["key"]] = (r, ident)
        src = {"sidewalk": "sw", "plaza": "pave_a"}.get(S["key"])
        for k in ("b1", "b2"):
            if not ident[k] and not (S["key"] == "sidewalk" and k == "b2"): errs.append(f"(c) {S['key']}.{k}: 둘레가 몸통과 다름")
        if src:    # 판 한 장이 칸 하나인 기존 칸을 빌린 세트: 원본 칸 자신의 반복 이음 비를 넘으면 안 된다(새 이음선을 만들지 않는다)
            lim = GA.seam_ratio(chip(src)) * 1.05
            r["src"] = GA.seam_ratio(chip(src))
        else: lim = 1.3
        if r[255] > lim: errs.append(f"(c) {S['key']}.m255: 반복 이음 비 {r[255]:.2f} > {lim:.2f}")
        for k in ("b1", "b2"):
            if r[k] > max(lim, r[255] * 1.25) and not (S["key"] == "sidewalk" and k == "b2"): errs.append(f"(c) {S['key']}.{k}: 반복 이음 비 {r[k]:.2f}")
    # (e) 참고 수치: 이어진 변의 둘레 한 줄에서 몸통과 다른 화소 수의 최댓값(열린 이웃 변의 띠가 모서리에서 파고드는 만큼 — 정상)
    worst = {}
    for S in sets():
        arrs = dict(painted(S)); body = arrs[255]; w = 0
        for m in CANON:
            a = arrs[m]
            for n, line in (("N", lambda t: t[0]), ("S", lambda t: t[15]), ("W", lambda t: t[:, 0]), ("E", lambda t: t[:, 15])):
                if m & GA.DIRS[n]:
                    diff = int((np.abs(line(a).astype(int) - line(body).astype(int)).sum(-1) > 0).sum())
                    w = max(w, diff)
        worst[S["key"]] = w
    res["connected_border_worst"] = worst
    res["seam"] = seam
    # (d) 마스크 맵 + 이음선 계열 불일치
    mism = {}
    maps = {}
    for S in sets():
        arrs = dict(painted(S))
        by_mask = {m: arrs[m] for m in CANON}
        body = [arrs[255], arrs["b1"]] + ([] if S.get("tactile_b2") else [arrs["b2"]])
        w3 = S.get("body_weights", (2, 1, 1))
        body = [arrs[255]] * w3[0] + [arrs["b1"]] * w3[1] + [arrs["b2"]] * w3[2]
        interior = [body] * S["interior_n"]
        tot = bad = 0; ex_all = []; used = set()
        for seed in range(1, 21):
            g = GA.blob_map(seed)
            t, b, ex = GA.seam_mismatches(g, by_mask, interior, tol=1)
            tot += t; bad += b; ex_all += ex[:3]
            used |= {canon(GA.mask_at(g, x, y)) for y in range(32) for x in range(32) if g[y, x]}
        gg = GA.gallery_map()           # canon 47종 전부를 가운데 칸으로 둔 5x5 조각들(막다른 줄·곶·안쪽 모서리 포함)
        t, b, ex = GA.seam_mismatches(gg, by_mask, interior, tol=1)
        gtot, gbad = t, b
        _, g0, ex0 = GA.seam_mismatches(gg, by_mask, interior, tol=0)
        mism[S["key"]] = dict(random=(tot, bad), random_masks=len(used), gallery=(gtot, gbad), gallery_exact=g0, ex=(ex_all + ex)[:6])
        if bad or gbad: errs.append(f"(d) {S['key']}: 이웃 칸 이음선 불량 random {bad}/{tot} gallery {gbad}/{gtot} {(ex_all + ex)[:3]}")
        gimg = GA.render_map(gg, by_mask, interior, np.tile(S["outside"](), (2, 2, 1))[:16, :16], 40, 30)
        if write: GA.save_png(gimg, OUT_DIR / f"{S['key']}-mask-gallery-x2.png", 2)
        g = GA.blob_map(7)
        img = GA.render_map(g, by_mask, interior, np.tile(S["outside"](), (2, 2, 1))[:16, :16], 32, 32)
        maps[S["key"]] = (img, g, by_mask, interior)
        if write:
            GA.save_png(img, OUT_DIR / f"{S['key']}-mask-map.png")
            GA.save_png(img, OUT_DIR / f"{S['key']}-mask-map-x4.png", 4)
    res["seam_mismatch"] = mism
    if write: write_overview(maps); write_compare(maps); write_tilesheets()
    res["errors"] = errs
    if verbose:
        print("cells", n_img, "errors", len(errs))
        for e in errs[:40]: print("  ", e)
        for k, (r, ident) in seam.items(): print("seam", k, {kk: round(v, 2) for kk, v in r.items()}, ident)
        for k, v in mism.items(): print("seam-lines", k, v)
        print("connected-border worst px", res["connected_border_worst"])
    return res


def write_tilesheets():
    """세트마다 49칸을 7열로 늘어놓은 시트 ×6."""
    for S in sets():
        arrs = painted(S)
        cols = 7; rows = (len(arrs) + cols - 1) // cols
        sheet = np.full((rows * 18 + 2, cols * 18 + 2, 4), (40, 36, 52, 255), np.uint8)
        for i, (k, a) in enumerate(arrs):
            x, y = 2 + (i % cols) * 18, 2 + (i // cols) * 18
            sheet[y:y + 16, x:x + 16] = a
        GA.save_png(sheet, OUT_DIR / f"{S['key']}-tiles-x6.png", 6)


def write_overview(maps):
    keys = [S["key"] for S in sets()]
    W = 512
    sheet = np.full((2 * W + 6, 4 * W + 15, 4), (24, 20, 34, 255), np.uint8)
    for i, k in enumerate(keys):
        x, y = (i % 4) * (W + 5), (i // 4) * (W + 5)
        sheet[y:y + W, x:x + W] = maps[k][0]
    GA.save_png(sheet, OUT_DIR / "overview.png")


def write_compare(maps):
    """세트 칸을 기존 chipset 칸과 나란히: 위 = 기존 칸(참조), 아래 = 이 세트의 m255·b1·b2 + 마스크 맵 한 구석(원본 바깥 지형 = 기존 칸)."""
    refs = {"sidewalk": ["sw", "sw_tactile", "road_n", "road_c", "road_s", "lane_n", "lane_c", "quay"],
            "lane": ["lane_n", "lane_c", "lane_s", "road_c", "sw", "lot", "lot_line", "manhole"],
            "lawn": ["lawn", "gravel", "plant_strip", "sw", "road_c", "pave_a", "water", "sando"],
            "gravel": ["gravel", "sando", "sando_b", "lawn", "pave_a", "pave_b", "sw", "plant_strip"],
            "plaza": ["pave_a", "pave_b", "sando", "lawn", "sw", "quay", "road_c", "gravel"],
            "pond": ["water", "quay", "lawn", "sw", "pave_a", "plant_strip", "gravel", "road_c"],
            "canal": ["water", "quay", "sw", "road_c", "lawn", "pave_a", "road_n", "lane_n"]}
    for S in sets():
        arrs = dict(painted(S))
        S_ = 4
        pad = 2
        n = 8
        ref_row = [chip(r) for r in refs[S["key"]]]
        row2 = [arrs[255], arrs["b1"], arrs["b2"], arrs[0 if 0 in arrs else CANON[0]], arrs[CANON[1]], arrs[CANON[2]], arrs[CANON[3]], arrs[CANON[4]]]
        mm = maps[S["key"]][0][4 * 16:12 * 16, 4 * 16:16 * 16]          # 8x12 칸 구석
        W = max(n * 16, 12 * 16)
        H = 16 + 4 + 16 + 4 + 8 * 16
        sheet = np.full((H, W, 4), (24, 20, 34, 255), np.uint8)
        for i, a in enumerate(ref_row): sheet[0:16, i * 16:i * 16 + 16] = a
        for i, a in enumerate(row2): sheet[20:36, i * 16:i * 16 + 16] = a
        sheet[40:40 + mm.shape[0], 0:mm.shape[1]] = mm
        GA.save_png(sheet, OUT_DIR / f"{S['key']}-compare-x6.png", 6)


if __name__ == "__main__":
    selftest()
