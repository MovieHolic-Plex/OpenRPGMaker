"""monster-rooms 바닥·벽·큰 구조물(사천왕 경기장 선·챔피언 단·배 뱃머리) — 방 문법(원작 지도를 3배로 그려 잰 것).

공통 틀(본 시트 실내 2차 interior2 와 같다): 뒷벽 두 줄(32px 가로 띠: 흰 천장 끝 → 색 띠 → 진한 선 → 벽면 → 몰딩·걸레받이 → 외곽선),
옆·아래는 i2_edge 검은 여백 + 흰 띠, 벽 바로 아래 바닥 한 줄은 한 톤 그늘(`*_s`), 아래 벽선 가운데 칸이 출구(매트 + i2_edge_mat).
바닥은 3톤 규칙 무늬 두 변형 `(x+y)%2` — 1px 잡음 없음. 벽 장식(창·칠판·문·현창)은 천장 끝 띠(벽 위 칸 y 0..2) 아래에서 시작한다.

- 사천왕 방(em EliteFour 네 방, 13×14): 뒷벽 두 줄 가운데에 봉인 문(3칸), 문 앞은 그냥 바닥이다(단상 없음). 뒷벽 밑에 매달린 등이 칸마다 하나.
  바닥 맨 위 줄과 양 옆 줄은 한 톤 진한 테두리. 가운데에 5×5 경기장 선(네모 테 · 가운데 가로선 · 몬스터볼 원 — 위·아래 반원을 테마 두 색으로 채우되
  바닥 네모 무늬가 비친다, 가로선은 바깥 원에서 안쪽 원까지 관통). 좌우 옆벽에 붙은 3×5 테마 블록(`lg_side_<테마>_l/_r`, 방 쪽 모서리 깎은 팔각 상자:
  윗면 띠 + 앞면 결 + 같은 결을 한 톤 어둡게 감아 도는 빗면 + 윗모서리 흰 사선)이 방의 정체를 만든다 — 유령: 이끼 돌 테두리 속 어두운 감실,
  얼음: 빗살 얼음 결정 판, 드래곤: 엇갈린 비늘(주황 테) 사이로 솟은 가시, 악: 길이 제각각인 밤 빌딩 창 줄. 아래 벽 두 줄 가운데 3칸이 트여
  테마 바닥이 매트 없이 그대로 다음 방으로 내려간다.
- 챔피언 방(em EverGrandeCity_ChampionsRoom, 13×14): 사천왕 틀을 쓰지 않는다. 뒷벽은 남색 창살 격자 유리, 옆과 위 모서리는 사선 창살의 비스듬한 유리 벽
  (아래로 갈수록 흰 반사). 방 전체를 팔각으로 높인 단(`ch_stage` 13×11)이 차지한다: 윗면(밝은 청록 + 저대비 네모 결, 먼 변 2px 흰 테 + 안쪽 그늘) ·
  깎인 모서리 · 맵 맨 아래까지 내려오는 돌 앞면. 아래 가운데 3칸 계단이 단으로 올라오고(계단 바로 옆 1칸만 어둠), 뒷벽 문은 받침 단(양옆 돌 옆면) 위에 있고
  그 앞에 3단 계단. 경기장 선·기둥 없음. 깔기: 단 범위(x1..13, y2..12)를 먼저 `rm_fl_ch_top0` 으로 칠한 뒤 `ch_stage`(막힘)와 `rmw_ch`(걷는 칸)를
  같은 원점 (1,2)에 찍는다.
- 배 갑판(fr SSAnne_Deck): 가로 널 갑판. 북쪽(먼 쪽) 가로 난간 `rm_rail_t`(밖은 바다, 기둥 사이로 바다, 기둥 밑 흰 갑판 끝선)와 남쪽(가까운 쪽) 난간
  `rm_rail_b` 사이가 갑판이다. 뱃머리 쪽은 두 난간이 1:2 사선으로 대칭으로 모여 뾰족해지고, 가까운 쪽 난간 밑에 흰 선체 옆면 세 줄(`rm_hull_t/m/b`:
  흰 철판 → 남색 흘수선 → 거품)이 바다로 내려간다(높은 현측). 선실(상부 구조물)은 갑판 안에 선다: 지붕 윗면 2줄(`rm_dh_roof_*`, 서쪽 끝·북쪽 끝 흰 테) +
  앞벽 2줄(문·현창). 배는 맵 오른쪽 끝 밖으로 이어진다(선미를 자르지 않는다). 깔기: 바다 바탕 → 북쪽 난간·갑판 널·앞 난간·선체를 x7 부터 맵 끝까지 →
  선실 지붕·앞벽 → 뱃머리 물체 `sh_bow`(막힘)+`rmw_bow`(걷는 널)를 원점 (0,0)에 찍는다(뱃머리의 바다 칸은 빠져 맵의 바다가 보인다).
- 배 복도·선실: 복도는 흰 철판 벽(남색 띠·금 선)에 선실 문이 일정 간격, 사이에 현창, 문 사이 벽 밑에 벤치·소화기, 카펫 바닥, 한쪽 끝에 흰 철 난간 계단. 선실은 나무 판벽 + 붉은 점 카펫,
  문은 뒷벽, 침대 머리판을 뒷벽에 붙이고, 탁자는 방 가운데, 휴지통은 옆벽 쪽.
- 박물관(em OceanicMuseum 1F, 20×9): 벽을 따라 1칸 어두운 체크 카펫 테두리, 안쪽은 밝은 체크 직사각(모서리 직각). 뒷벽 왼쪽에 아치 계단(2층),
  뒷벽에 수조·유리 원통 진열장·명판. 입구 매트 양옆에 ∩자 크림 접수대 둘(3×3, 안쪽은 접수원 자리). 안쪽 카펫 위에 배 모형(줄 차단봉)·화석·진열대.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import interior2 as i2  # noqa: E402
import coast  # noqa: E402  (바다 물결만 빌려 쓴다 — 고치지 않는다)

OL = "i2_ol"
LG_THEMES = ("ghost", "ice", "dragon", "dark", "champ")


def _ol(P):
    return P[OL][0]


# ---- 바닥 -------------------------------------------------------------------------------------
def floor(P, kind: str, v: int = 0):
    """kind: lab · school · museum(바깥 어두운 카펫) · dept · dept2 · carpet(배 복도) · cabin(선실) · deck(갑판 널) · lg_<테마> · lgb_<테마>(테두리) · ch_top(챔피언 단)."""
    im = px.new()
    put = im.putpixel
    if kind == "lab":                                                   # 큰 흰 타일 + 비스듬한 결(헤링본: v 로 결 방향이 바뀐다)
        d, b, l = P["rm_fl_lab"]
        for y in range(T):
            for x in range(T):
                k = (x + y) % 8 if v == 0 else (x - y) % 8
                c = d if x == 15 or y == 15 else l if k == 0 and 0 < x < 15 and 0 < y < 15 else b
                put((x, y), c)
    elif kind == "school":                                              # 회색 타일 안에 밝은 네모 테
        d, b, l = P["rm_fl_school"]
        for y in range(T):
            for x in range(T):
                ring = (x in (3, 12) and 3 <= y <= 12) or (y in (3, 12) and 3 <= x <= 12)
                c = d if x == 15 or y == 15 else l if ring else b
                if v == 1 and ring and x in (3, 12) and y in (3, 12):
                    c = b                                                   # 둘째 변형은 테 모서리가 둥글다

                put((x, y), c)
    elif kind in ("museum", "museum_in"):                               # 마름모 격자 카펫(바깥은 어둡게, 안쪽 카펫은 한 톤 밝게)
        m = P["rm_fl_museum"]
        lo, base, hi = (m[0], m[1], m[2]) if kind == "museum" else (m[1], m[2], m[3])
        for y in range(T):
            for x in range(T):
                a, b2 = (x + y) % 8, (x - y) % 8
                c = lo if a == 0 or b2 == 0 else hi if (a == 4 and b2 == 4) or (v == 1 and a == 4 and b2 in (3, 5)) else base
                put((x, y), c)
    elif kind == "dept":                                                # 주황 큰 타일 + 사선 광택 한 줄
        d, b, l = P["rm_fl_dept"]
        for y in range(T):
            for x in range(T):
                s = x + y
                c = d if x == 15 or y == 15 else l if (5 <= s <= 6 if v == 0 else 19 <= s <= 20) and x < 15 and y < 15 else b
                put((x, y), c)
    elif kind == "dept2":                                               # 민트 팔각 타일(모서리에 작은 마름모)
        d, b, l = P["rm_fl_dept2"]
        for y in range(T):
            for x in range(T):
                cx, cy = abs(x - 7.5), abs(y - 7.5)
                if cx + cy > 10.5:
                    c = d
                elif cx > 6.5 or cy > 6.5 or cx + cy > 9.5:
                    c = b
                else:
                    c = l if cx + cy > 8.5 or v == 0 else b if (x + y) % 2 and cx + cy < 2 else l
                put((x, y), c)
    elif kind == "carpet":                                              # 배 복도 카펫: 바탕 + 2px 점 마름모 배열
        d, b, l = P["rm_fl_carpet"]
        for y in range(T):
            for x in range(T):
                xx, yy = x % 8, y % 8
                dots = ((1, 1), (2, 1), (5, 5), (6, 5)) if v == 0 else ((5, 1), (6, 1), (1, 5), (2, 5))   # 두 변형 점 수 같게(자리만 엇갈림)
                c = l if (xx, yy) in dots else b
                put((x, y), c)
    elif kind == "cabin":                                               # 선실 붉은 카펫: 밝은 점 + 그 아래 그늘 점
        d, b, l = P["rm_fl_cabin"]
        for y in range(T):
            for x in range(T):
                xx, yy = x % 8, (y + (4 if (x // 8 + v) % 2 else 0)) % 8
                c = l if (xx, yy) in ((3, 2), (4, 2)) else d if (xx, yy) == (4, 3) and v == 1 else b
                put((x, y), c)
    elif kind == "deck":                                                # 가로 긴 널(4px): 이음매는 줄마다 한 칸 건너 하나, 널 위쪽 밝은 줄
        d, b, l = P["rm_deck"]
        for y in range(T):
            for x in range(T):
                row = y // 4
                joint = (row * 6 + 3) % T if (row + v) % 2 == 0 else -1
                c = d if y % 4 == 3 or x == joint else l if y % 4 == 0 and abs(x - joint) > 1 else b
                put((x, y), c)
    elif kind.startswith("lg_") or kind.startswith("lgb_"):             # 사천왕 바닥: 낮은 대비의 네모 안 네모(테두리 바닥은 한 톤 어둡게)
        th = kind.split("_", 1)[1]
        t = P[f"rm_lg_{th}"]
        base = t[2] if kind.startswith("lg_") else t[1]
        lo, hi = px.tint(base, 0.9), px.tint(base, 1.09)
        for y in range(T):
            for x in range(T):
                ring = (x in (3, 12) and 3 <= y <= 12) or (y in (3, 12) and 3 <= x <= 12)
                c = lo if x == 15 or y == 15 else hi if ring else base
                put((x, y), c)
    elif kind == "ch_top":                                              # 챔피언 단 윗면: 밝은 청록 판 + 저대비 네모 결(16px 이음 · 가운데 8px 옅은 네모) — 두 변형이 같다
        t, g = P["rm_lg_champ"], P["rm_ch_top"]
        for y in range(T):
            for x in range(T):
                c = g[0] if x == 15 or y == 15 else g[1] if (x in (4, 11) and 4 <= y <= 11) or (y in (4, 11) and 4 <= x <= 11) else t[3]
                put((x, y), c)
    else:
        raise ValueError(kind)
    return im


def lg_under_wall(P, th: str):
    """사천왕 방 뒷벽 밑 줄: 바닥 무늬 그대로 + 위 2px 만 벽 밑 그늘(테마 램프 한 톤 아래). 반 칸 밝기 단(턱처럼 보임)을 피한다."""
    im = floor(P, f"lg_{th}")
    t = P[f"rm_lg_{th}"]
    for x in range(T):
        im.putpixel((x, 0), t[0]); im.putpixel((x, 1), t[1])
    return im


def mat(P, floor_im, ramp=None):
    """출입 매트(본 시트 i2.mat 과 같은 모양): 바닥 위 두 톤 테두리 깔개 + 가로 줄 둘. ramp 를 주면 그 램프(사천왕 방은 테마 색)."""
    im = floor_im.copy()
    r = ramp or P["i2_mat"]
    px.rect(im, 1, 4, 14, 14, r[0]); px.rect(im, 2, 5, 13, 13, r[1])
    for y in (7, 10):
        px.rect(im, 3, y, 12, y, r[2])
    return im


# ---- 벽 ---------------------------------------------------------------------------------------
def _wall_col(P, style: str):
    """32px 세로 띠(위 칸 0..15 + 아래 칸 16..31). 반환 col(x, y) → 색."""
    ce, ol, g = P["i2_ceil"], _ol(P), P["i2_gray"]
    if style == "lab":                                                  # 흰 벽: 회청 띠 → 흰 벽면 → 허리 띠 → 회색 걸레받이
        f, bd = P["rm_lab_face"], P["rm_lab_band"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return bd[2]
            if y <= 5: return bd[1]
            if y == 6: return ol
            if y == 7: return f[2]
            if y <= 22: return f[1]
            if y == 23: return f[0]
            if y == 24: return bd[1]
            if y == 25: return bd[0]
            if y <= 28: return g[2] if y == 26 else g[1]
            if y <= 30: return g[0]
            return ol
    elif style == "school":                                             # 크림 벽면 → 초록 징두리판 → 나무 걸레받이
        f, bd, wd = P["rm_s_face"], P["rm_s_band"], P["i2_wood"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return f[2]
            if y <= 19: return f[1]
            if y == 20: return f[0]
            if y == 21: return ol
            if y == 22: return bd[2]
            if y <= 25: return bd[1] if x % 16 != 15 else bd[0]
            if y == 26: return bd[0]
            if y <= 29: return wd[2] if y == 27 else wd[1]
            if y == 30: return wd[0]
            return ol
    elif style == "museum":                                             # 황토 벽면 · 주황 선 · 파란 띠 두 단(흰 선) · 걸레받이
        f, bd = P["rm_mu_face"], P["rm_mu_band"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return f[2]
            if y <= 12: return f[1]
            if y == 13: return P["i2_orange"][1]
            if y <= 15: return f[0]
            if y == 16: return ol
            if y == 17: return bd[2]
            if y <= 21: return bd[1]
            if y == 22: return ce[1]
            if y <= 27: return bd[0] if y != 23 else bd[1]
            if y <= 29: return g[1]
            if y == 30: return g[0]
            return ol
    elif style == "dept":                                               # 회녹 벽면 → 연어색 띠 → 회색 걸레받이
        f, s = P["rm_d_face"], P["i2_salmon"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return f[2]
            if y <= 20: return f[1]
            if y == 21: return f[0]
            if y == 22: return ol
            if y == 23: return s[2]
            if y <= 25: return s[1]
            if y == 26: return s[0]
            if y <= 29: return g[2] if y == 27 else g[1]
            if y == 30: return g[0]
            return ol
    elif style == "ship":                                               # 배 복도: 흰 철판(가로 이음매) → 남색 띠 · 금 선 → 걸레받이
        w, b, gd = P["i2_white"], P["i2_blue"], P["i2_gold"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return ol
            if y == 4: return w[2]
            if y <= 18: return w[0] if y == 11 else w[1]
            if y == 19: return b[2]
            if y <= 22: return b[1]
            if y == 23: return gd[1]
            if y <= 25: return b[1]
            if y == 26: return b[0]
            if y <= 29: return g[2] if y == 27 else g[1]
            if y == 30: return g[0]
            return ol
    elif style == "cabin":                                              # 선실 나무 판벽: 16px 세로 판(이음매 1px · 밝은 결 1px)
        wd = P["i2_wood"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return ol
            if y == 4: return wd[2]
            if y <= 25:
                if y == 14: return wd[0]
                if y == 15: return wd[2]
                return wd[0] if x % 16 == 0 else wd[2] if x % 16 == 1 else wd[1]
            if y == 26: return wd[2]
            if y <= 29: return wd[0]
            if y == 30: return g[0]
            return ol
    elif style == "deckhouse":                                          # 갑판 위 선실 바깥벽: 회색 지붕 끝 → 흰 철판 → 남색 띠
        w, b = P["i2_white"], P["i2_blue"]
        def col(x, y):
            if y <= 1: return g[2]
            if y == 2: return g[1]
            if y == 3: return ol
            if y == 4: return w[2]
            if y <= 23: return w[0] if (y in (7, 20) and x % 4 == 1) else w[2] if y == 13 else w[1]
            if y == 24: return b[2]
            if y <= 27: return b[1]
            if y == 28: return b[0]
            if y <= 30: return w[0]
            return ol
    elif style == "lg_champ":                                           # 챔피언 유리 벽: 남색 창살 격자(세로 16px · 가로 두 줄) · 위 회녹 → 아래 청록 판유리
        gl = P["rm_ch_glass"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return gl[0]
            if y == 31: return ol
            k = x % 16
            if k == 0 or y in (13, 23):
                return gl[4] if k == 0 and y in (13, 23) else gl[0]       # 창살 · 교차점 밝은 못
            if y == 4 or y == 14 or y == 24: return gl[4] if k < 12 else gl[3]   # 판 윗변 빛
            if y <= 12: return gl[1]
            if y <= 22: return gl[2] if not (k in (3, 4) and 16 <= y <= 19) else gl[3]
            return gl[3]
    elif style.startswith("lg_"):                                       # 사천왕 벽: 테마색 벽판 · 판 사이 진한 기둥선 · 세로 등 셋
        t = P[f"rm_lg_{style[3:]}"]
        o = P["i2_orange"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return o[1]
            if y == 4: return ol
            if y == 5: return t[2]
            if y <= 24:
                k = x % 16
                if k == 0: return ol
                if k == 1: return t[1]
                if k in (7, 8) and y in (9, 10, 14, 15, 19, 20): return o[2] if y % 5 == 4 else o[1]
                return t[0]
            if y == 25: return t[3]
            if y <= 27: return t[2]
            if y == 28: return t[1]
            if y <= 30: return t[0] if y == 29 else ol
            return ol
    else:
        raise ValueError(style)
    return col


def wall(P, style: str, part: str):
    col = _wall_col(P, style)
    y0 = 0 if part == "up" else T
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), col(x, y0 + y))
    return im


def corner_wall(P, style: str, part: str, side: str):
    im = wall(P, style, part)
    x = 0 if side == "l" else T - 1
    for y in range(T):
        im.putpixel((x, y), _ol(P))
    return im


# ---- 바다·선체(갑판 맵) ----------------------------------------------------------------------
def sea(P, f: int = 0):
    """바다 = 해안 지역 시트(coast.sea_px)와 같은 물: 본 시트 연못과 같은 그물 물결을 바다 램프 P["sea"] 로, 4프레임(f 0..3).
    칸마다 같은 그물이라 이음매가 없다 — 변형이 필요 없다."""
    return coast.sea(P, f)


HULL_H = 48                  # 선체 옆면 띠 높이(3줄) — 큰 여객선의 높은 현측(원작 상트안느호)


def _hull_px(P, yy):
    """선체 띠 깊이 yy(0..47) 의 색. 흰 철판 0..32(외곽선 · 빛 줄 · 이음 못 두 줄) → 남색 흘수선 33..39 → 외곽선 40 → 거품 41 → 바다(None)."""
    w, b, ol = P["i2_white"], P["i2_blue"], _ol(P)
    if yy == 0: return ol
    if yy == 1: return w[2]
    if yy <= 32: return w[0] if yy in (11, 23) else w[1]
    if yy == 33: return b[2]
    if yy <= 36: return b[1]
    if yy <= 39: return b[0]
    if yy == 40: return ol
    if yy == 41: return P["foam"][0]
    return None


def hull(P, row: str, f: int = 0):
    """선체 옆면 칸(갑판 앞 난간 밑 3줄): row t·m·b = 띠 깊이 0..15 · 16..31 · 32..47. 끝 없이 맵 끝까지 이어 깐다(선미 없는 끝)."""
    sea_im = sea(P, f)
    y0 = {"t": 0, "m": 16, "b": 32}[row]
    im = px.new()
    for y in range(T):
        for x in range(T):
            c = _hull_px(P, y0 + y)
            if c == P["i2_white"][1] and (y0 + y) in (11, 23):
                c = P["i2_white"][0]
            if c is not None and (y0 + y) in (11, 23) and x % 8 != 3:
                c = P["i2_white"][1]
            im.putpixel((x, y), c if c is not None else sea_im.getpixel((x, y)))
    return im


def dh_roof(P, part: str):
    """갑판 선실 지붕 윗면(위에서 보인다): 보라빛 철판 · 가장자리 2px 흰 테. part: c(속) · t(북쪽 끝) · l(서쪽 끝) · tl(모서리)."""
    r, w, ol = P["rm_dh_roof"], P["i2_white"], _ol(P)
    im = px.new()
    for y in range(T):
        for x in range(T):
            c = r[1] if (x + 2 * y) % 16 else r[2]                         # 옅은 사선 빛결
            if y == 15:
                c = r[0]                                                    # 앞벽 위 처마 그늘
            if "t" in part and y <= 2:
                c = ol if y == 0 else w[2] if y == 1 else w[0]
            if "l" in part and x <= 2:
                c = ol if x == 0 else w[2] if x == 1 else w[0]
            im.putpixel((x, y), c)
    return im


def rail(P, part: str, f: int = 0):
    """갑판 난간(널 위): t=먼 쪽(북쪽 가로 난간 — 위는 바다, 기둥 사이로 바다가 비치고 기둥 밑에 흰 갑판 끝선 · 그늘) ·
    b=앞쪽(가로 난간 + 기둥) · l/r=옆(세로 난간) · bl/br=앞 모서리. 난간 바깥은 바다(옆) / 선체(앞, hull 칸이 받는다)."""
    st, ol = P["i2_steel"], _ol(P)
    im = floor(P, "deck", 0)
    if part == "t":
        sea_im = sea(P, f)
        for y in range(T):
            for x in range(T):
                post = x % 7 in (2, 3)
                if y <= 4 or (9 <= y <= 11 and not post):
                    im.putpixel((x, y), sea_im.getpixel((x, y)))
        px.rect(im, 0, 5, 15, 5, ol); px.rect(im, 0, 6, 15, 6, st[2]); px.rect(im, 0, 7, 15, 7, st[1]); px.rect(im, 0, 8, 15, 8, ol)
        for x in range(T):
            if x % 7 in (2, 3):
                px.rect(im, x, 9, x, 11, st[1] if x % 7 == 2 else st[0])
        px.rect(im, 0, 12, 15, 12, P["i2_white"][2]); px.rect(im, 0, 13, 15, 13, _shade_rows(P))
        return im
    if part in ("l", "r", "bl", "br"):
        sea_im = sea(P, f)
        for y in range(T):
            for x in range(T):
                out = x < 3 if part in ("l", "bl") else x > 12
                if out:
                    im.putpixel((x, y), sea_im.getpixel((x, y)))
        xs = 3 if part in ("l", "bl") else 9
        for y in range(T if part in ("l", "r") else 11):
            im.putpixel((xs, y), ol); im.putpixel((xs + 1, y), st[2]); im.putpixel((xs + 2, y), st[1]); im.putpixel((xs + 3, y), ol)
        for y in (2, 10):                                               # 기둥 머리
            if part in ("l", "r") or y < 11:
                px.rect(im, xs, y, xs + 3, y + 1, st[0])
    if part in ("b", "bl", "br"):
        x0 = 3 if part == "bl" else 0
        x1 = 12 if part == "br" else 15
        px.rect(im, x0, 8, x1, 8, ol); px.rect(im, x0, 9, x1, 9, st[2]); px.rect(im, x0, 10, x1, 10, st[1]); px.rect(im, x0, 11, x1, 11, ol)
        px.rect(im, x0, 13, x1, 13, st[1])                              # 아래 가로대
        for x in range(x0 + 2, x1, 7):
            px.rect(im, x, 12, x + 1, 15, st[0]); px.put(im, x, 12, st[2])
        px.rect(im, x0, 14, x1, 15, _shade_rows(P))
        if part == "bl":
            px.rect(im, 0, 8, 2, 15, sea(P, f).getpixel((0, 0)))
        if part == "br":
            px.rect(im, 13, 8, 15, 15, sea(P, f).getpixel((0, 0)))
    return im


def _shade_rows(P):
    return px.tint(P["rm_deck"][0], 0.84)


# ---- 사천왕 경기장 선(5×5, 바닥에 구워 넣는다) ------------------------------------------------
FIELD_N = 5


def lg_field(P, th: str):
    """5×5 칸(80px) 경기장 선(원작 사천왕 방에서 잰 비례: 테 = 방 폭의 0.4, 볼 지름 = 테 폭의 0.6):
    네모 테 2px · 가운데 가로선 2px(바깥 원에서 안쪽 원까지 관통) · 몬스터볼 — 바깥 원 2px, 위 반원은 테마 색 A, 아래 반원은 테마 색 B
    (바닥 네모 무늬가 같은 칸에서 한 톤 밝게 비친다), 안쪽 원 2px 속은 바닥 그대로 · 네 모서리 3×3 점. 선 색은 테마 램프 rm_lgf_<테마>[4].
    바닥 그대로인 칸은 None(물체에서 빠지고 바닥이 남는다)."""
    A, A_hi, B, B_hi, line = P[f"rm_lgf_{th}"]
    t = P[f"rm_lg_{th}"]
    base = floor(P, f"lg_{th}")
    S = FIELD_N * T
    big = px.new(S, S)
    for y in range(S):
        for x in range(S):
            big.putpixel((x, y), base.getpixel((x % T, y % T)))
    a, b_ = 3, S - 4
    cx = cy = S / 2
    base_hi = px.tint(t[2], 1.09)
    for y in range(S):
        for x in range(S):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            c = big.getpixel((x, y))
            onrect = (a <= x <= b_ and (a <= y <= a + 1 or b_ - 1 <= y <= b_)) or (a <= y <= b_ and (a <= x <= a + 1 or b_ - 1 <= x <= b_))
            mid = a <= x <= b_ and cy - 1 <= y + 0.5 <= cy + 1 and not d < 5.6
            if 21.0 <= d <= 23.0 or 5.6 <= d <= 7.6 or onrect or mid:
                big.putpixel((x, y), line)
            elif 7.6 < d < 21.0:
                hi = c == base_hi
                big.putpixel((x, y), (A_hi if hi else A) if y + 0.5 < cy else (B_hi if hi else B))
    for qx, qy in ((a, a), (b_ - 1, a), (a, b_ - 1), (b_ - 1, b_ - 1)):  # 모서리 점(3×3)
        px.rect(big, qx - 1, qy - 1, qx + 2, qy + 2, line)
        px.rect(big, qx, qy, qx + 1, qy + 1, t[1])
    out = {}
    btxt = base.tobytes()
    for j in range(FIELD_N):
        for i in range(FIELD_N):
            c = big.crop((i * T, j * T, i * T + T, j * T + T))
            out[(i, j)] = None if c.tobytes() == btxt else c
    return out


# ---- 큰 그림 → 칸 나누기 ----------------------------------------------------------------------
def split_big(big, walk, skip=()):
    """큰 그림을 칸으로 자른다. walk(i, j) 가 참이면 걷는 칸, 아니면 막힌 칸. skip 의 칸 그림과 똑같은 칸은 빼서(None) 맵의 바닥이 보이게 한다.
    반환 (막힌 칸 {(i,j): 그림}, 걷는 칸 {(i,j): 그림})."""
    skip_b = {s.tobytes() for s in skip}
    shut, open_ = {}, {}
    for j in range(big.height // T):
        for i in range(big.width // T):
            c = big.crop((i * T, j * T, i * T + T, j * T + T))
            if c.tobytes() in skip_b or c.getbbox() is None:
                continue
            (open_ if walk(i, j) else shut)[(i, j)] = c
    return shut, open_


# ---- 챔피언 방 팔각 단(13×11) -----------------------------------------------------------------
CH_W, CH_H = 13, 11          # 방 안쪽 x1..13 · y2..12 를 덮는다(원점 = 맵 (1,2))
CH_STEPS = (5, 7)            # 문 앞 3단 계단 · 아래 계단의 칸 열(원점 기준)


def _ch_geom(X, Y):
    """챔피언 단 그림의 픽셀 분류. 원점 기준 px. 윗면 = x 16..191, y 32..143, 모서리 32px 깎음(팔각)."""
    x0, x1, y0, y1, cut = 16, 191, 32, 143, 32
    inside = x0 <= X <= x1 and y0 <= Y <= y1 and (X - x0) + (Y - y0) >= cut and (x1 - X) + (Y - y0) >= cut \
        and (X - x0) + (y1 - Y) >= cut and (x1 - X) + (y1 - Y) >= cut
    return inside


def _side_glass(P, X, Y, side):
    """비스듬한 유리 벽(챔피언 방 옆·모서리): 사선 창살(왼쪽은 / , 오른쪽은 \\) · 위 회녹 → 가운데 청록 → 아래로 갈수록 흰 반사."""
    gl, w = P["rm_ch_glass"], P["i2_white"]
    d = (X + Y) if side == "l" else (Y - X + 400)
    if d % 24 in (0, 1):
        return gl[0]
    if Y >= 128:
        return w[2] if (d % 24) in (2, 3, 4) or Y >= 160 else gl[4]
    if Y >= 104:
        return gl[4] if (d % 24) in (2, 3, 4) else gl[3]
    return gl[1] if Y < 40 else gl[2] if (d % 24) > 5 else gl[3]


def ch_stage(P):
    """챔피언 방 팔각 단 큰 그림(13×11 칸, 원점 = 맵 (1,2)).
    윗면: 밝은 청록 판 + 저대비 네모 결(rm_fl_ch_top 과 같은 칸), 바깥 1px 외곽선 · 먼 변(위·옆·위 사선) 2px 흰 테 + 안쪽 1px 그늘, 앞 변 1px 밝은 줄.
    앞면: 윗면 아래 끝에서 맵 맨 아래(y12)까지 회색 돌판(곧은 앞면은 밝게 · 사선 앞면은 한 톤 진하게, 위 빛 줄 · 이음 두 줄).
    아래 가운데 3칸 계단(흰 디딤 · 회색 챌판 · 흰 철 난간) · 계단 바로 옆 1칸만 남색 어둠.
    위 가운데 문 받침 단: 문 앞 3단 계단(열 5..7) + 양옆 받침 옆면(열 4·8, 윗면 띠 · 돌 면).
    단 밖: 옆 열(0·12)과 위 모서리는 비스듬한 유리 벽(_side_glass), 맨 아래 두 줄 옆 열은 흰 반사."""
    fc, vd, t, g = P["rm_ch_face"], P["rm_ch_void"], P["rm_lg_champ"], P["rm_ch_top"]
    ol, w = _ol(P), P["i2_white"]
    W_, H_ = CH_W * T, CH_H * T
    big = px.new(W_, H_)
    top = floor(P, "ch_top", 0)
    G = _ch_geom
    s0, s1 = CH_STEPS[0] * T, (CH_STEPS[1] + 1) * T - 1
    edge_y = {X: next((Y for Y in range(143, 31, -1) if G(X, Y)), None) for X in range(W_)}
    for Y in range(H_):
        for X in range(W_):
            if G(X, Y):
                c = top.getpixel((X % T, Y % T))
                if not G(X, Y - 1) or not G(X - 1, Y) or not G(X + 1, Y) or not G(X, Y + 1):
                    c = ol
                elif not G(X, Y + 2):
                    c = t[2] if Y > 120 else c                                     # 앞 변 밝은 줄(외곽선 바로 위)
                    if Y > 120: c = w[2]
                elif (not G(X, Y - 3) or not G(X - 3, Y) or not G(X + 3, Y)) and Y <= 120:
                    c = w[2]                                                       # 먼 변 2px 흰 테
                elif (not G(X, Y - 4) or not G(X - 4, Y) or not G(X + 4, Y)) and Y <= 120:
                    c = g[0]                                                       # 테 안쪽 1px 그늘
                big.putpixel((X, Y), c)
                continue
            if s0 <= X <= s1 and (Y < 32 or Y > 143):                      # 계단(위 3단 · 아래 계단)
                k = X - s0
                if k in (0, 47):
                    big.putpixel((X, Y), ol); continue
                if k in (1, 2, 45, 46):                                      # 옆 난간(흰 강철)
                    big.putpixel((X, Y), w[2] if k in (1, 45) else w[0]); continue
                if Y < 32:                                                   # 문 앞 3단: 디딤 8px(흰)·챌판 2px(회)
                    q = (Y - 2) % 10
                    c = ol if Y < 2 else w[2] if q < 1 else w[1] if q < 7 else fc[2] if q < 9 else fc[1]
                else:                                                        # 아래 계단: 디딤 6px·챌판 2px, 아래로 갈수록 한 톤 진하게
                    q = (Y - 144) % 8
                    deep = (Y - 144) // 16
                    c = w[2] if q == 0 else (w[1] if deep == 0 else fc[3]) if q < 6 else fc[1] if q == 6 else fc[0]
                big.putpixel((X, Y), c); continue
            if Y < 32 and (s0 - 16 <= X < s0 or s1 < X <= s1 + 16):          # 문 받침 단 옆면(열 4·8)
                inner = X - (s0 - 16) if X < s0 else (s1 + 16) - X
                cs = P["rm_ch_side"]
                c = ol if inner == 0 or Y == 0 else cs[3] if Y <= 4 else cs[2] if inner > 2 else cs[1]
                if Y == 5: c = cs[0]
                if Y in (14, 24) and inner % 4 != 0: c = cs[1]
                if Y >= 26: c = cs[1]
                big.putpixel((X, Y), c); continue
            be = edge_y[X]
            if be is not None and 16 <= X <= 191 and Y > be:                 # 앞면(청록 회색 돌) — 맵 맨 아래까지
                if Y >= 144 and (64 <= X < 80 or 128 <= X < 144):
                    big.putpixel((X, Y), vd[0] if Y < 174 else vd[1]); continue   # 계단 바로 옆 1칸만 어둠
                cs = P["rm_ch_side"]
                d = Y - be
                diag = X < 48 or X > 159
                # 높이 단계: 위(윗면 테 밑 1px 진한 그늘) → 밝은 테 2px → 위가 밝고 아래로 짙어지는 3톤
                if d == 1:
                    c = cs[0]
                elif d <= 3:
                    c = cs[3]
                else:
                    depth = (Y - (be + 3)) / max(1, (H_ - 1) - (be + 3))
                    c = cs[2] if depth < 0.4 else cs[1] if depth < 0.8 else cs[0]
                    if diag:                                                 # 사선 면: 한 톤 진하고 면 방향 4px 사선 해칭
                        c = cs[1] if depth < 0.5 else cs[0]
                        if ((X + Y) if X < 48 else (Y - X)) % 4 == 0 and depth < 0.85:
                            c = cs[0] if c == cs[1] else vd[1]
                    else:                                                    # 곧은 앞면: 돌 블록(가로 이음 · 세로 엇갈림)
                        row = (Y - (be + 4)) // 9
                        if (Y - (be + 4)) % 9 == 8 or (X + (8 if row % 2 else 0)) % 16 == 0:
                            c = cs[0] if c != cs[0] else vd[1]
                        elif (Y - (be + 4)) % 9 == 0:
                            c = cs[3] if depth < 0.4 else cs[2]
                if Y == H_ - 1:
                    c = vd[1]
                if diag and X in (47, 160):
                    c = cs[0]                                                # 사선 면과 곧은 앞면 사이 모서리
                big.putpixel((X, Y), c); continue
            side = "l" if X < W_ // 2 else "r"
            c = _side_glass(P, X, Y + 32, side)                              # 단 밖 = 비스듬한 유리 벽
            if X in (14, 193):
                c = P["rm_ch_glass"][4]                                      # 세로 창살: 밝은 1px + 그늘 1px(사선 끊김을 창살로)
            elif X in (15, 192):
                c = P["rm_ch_glass"][0]
            big.putpixel((X, Y), c)
    return big


def ch_walk(i, j):
    """챔피언 단에서 걷는 칸: 칸 전체가 윗면인 칸 + 문 앞 3단(행 0..1) + 아래 계단(행 9..10), 계단 열 CH_STEPS."""
    if CH_STEPS[0] <= i <= CH_STEPS[1] and (j <= 1 or j >= 9):
        return True
    return all(_ch_geom(i * T + dx, j * T + dy) for dx in (0, 15) for dy in (0, 15))


# ---- 배 뱃머리(7×13) ---------------------------------------------------------------------------
BOW_W, BOW_H = 7, 13         # 원점 = 맵 (0,0): 북쪽 난간 y2 · 갑판 y3..8 · 앞 난간 y9 · 선체 y10..12 가 x7 부터 맵 끝까지 이어진다


def _bow_lines(X):
    """먼 난간선 U(X)·가까운 난간선 L(X) — 뾰족한 끝(X=10)에서 약 1:2 기울기(0.54)로 대칭으로 벌어져 X=112 에서 직선 갑판의
    북쪽 난간(rm_rail_t 띠 y=37)·앞 난간(rm_rail_b 띠 y=152)과 맞물린다. 중심선 y≈95(맵 6줄)."""
    k = (112 - X) * 0.54                                                      # 끝에서 두 난간 사이가 5px 로 모인다(뾰족한 끝)
    return 37 + k, 152 - k


def sh_bow(P, f: int = 0):
    """뱃머리 큰 그림(7×13 칸): 갑판 널(본 갑판 칸과 같은 결) · 먼 난간(사선, 밖은 바다, 기둥 사이로 바다가 비치고 밑에 흰 갑판 끝선) ·
    가까운 난간(사선, 기둥 + 아래 가로대) · 가까운 난간 밑 흰 선체 옆면 3줄(직선 부분과 같은 띠) · 끝은 둥근 뱃머리 기둥.
    바다 칸은 맵의 바다 칸과 같아 빠진다."""
    st, ol, w = P["i2_steel"], _ol(P), P["i2_white"]
    seas = [sea(P, f), sea(P, f)]
    decks = [floor(P, "deck", 0), floor(P, "deck", 1)]
    shade = _shade_rows(P)
    W_, H_ = BOW_W * T, BOW_H * T
    big = px.new(W_, H_)
    tip = 10
    for Y in range(H_):
        for X in range(W_):
            tx, ty = X // T, Y // T
            c = seas[(tx + ty) % 2].getpixel((X % T, Y % T))
            if X >= tip:
                U, L = _bow_lines(min(X, 111.999))
                Ui, Li = int(round(U)), int(round(L))
                post = X % 7 in (2, 3)
                if Ui + 9 <= Y < Li:                                         # 갑판 널
                    c = decks[(tx + ty) % 2].getpixel((X % T, Y % T))
                    if Y >= Li - 1:
                        c = shade
                if Ui <= Y <= Ui + 3:                                        # 먼 난간 띠
                    c = (ol, st[2], st[1], ol)[Y - Ui]
                elif Ui + 4 <= Y <= Ui + 6 and post:                         # 먼 난간 기둥(사이는 바다)
                    c = st[1] if X % 7 == 2 else st[0]
                elif Y == Ui + 7:
                    c = w[2]                                                 # 흰 갑판 끝선
                elif Y == Ui + 8:
                    c = shade                                                # 끝선 안쪽 그늘
                if Li <= Y <= Li + 3:                                        # 가까운 난간 띠
                    c = (ol, st[2], st[1], ol)[Y - Li]
                elif Li + 4 <= Y <= Li + 7:                                  # 기둥 · 아래 가로대 · 그늘
                    c = st[1] if Y == Li + 5 else st[0] if post else shade
                elif Li + 8 <= Y < Li + 8 + HULL_H:                          # 선체 옆면(hull t/m/b 칸과 같은 띠)
                    yy = Y - (Li + 8)
                    q = _hull_px(P, yy)
                    if q is not None:
                        c = q
                        if yy in (11, 23):
                            c = w[1]                                         # 사선 옆면엔 못 줄을 두지 않는다(엇갈린 점으로 보인다)
                        if yy <= 39 and X < tip + 3:
                            c = ol if X == tip else w[2]                     # 뱃머리 기둥(앞 끝 세로 외곽 · 빛)
            if tip - 2 <= X < tip:                                           # 뾰족한 끝: 두 난간이 만나는 둥근 기둥 머리
                U, L = _bow_lines(tip)
                if U <= Y <= L + 3:
                    c = ol if X == tip - 2 or Y in (int(U), int(L) + 3) else st[2]
            big.putpixel((X, Y), c)
    return big


def bow_walk(i, j):
    """뱃머리에서 걷는 칸: 칸 전체가 갑판 널인 칸."""
    for dx in (0, 15):
        for dy in (0, 15):
            X, Y = i * T + dx, j * T + dy
            if X < 10:
                return False
            U, L = _bow_lines(min(X, 111.999))
            if not (int(round(U)) + 9 <= Y < int(round(L)) - 1):
                return False
    return True


# ---- 박물관 안쪽 카펫 오토타일(47) ----------------------------------------------------------
CARPET = ("mu-carpet", 2, 0, 0)        # 모서리 직각(원작 해양 박물관 카펫은 네모)


def carpet_masks():
    name, depth, radius, amp = CARPET
    return {m: px.inside_mask(m, name, depth, radius, amp) for m in px.ALL47}


def carpet_cell(P, m: int):
    """안쪽(밝은 카펫) · 바깥(어두운 카펫) · 경계 안쪽 1px 은 가장 밝은 테."""
    name, depth, radius, amp = CARPET
    inside = px.inside_mask(m, name, depth, radius, amp)
    inn, out = floor(P, "museum_in"), floor(P, "museum")
    hi = P["rm_fl_museum"][3]
    lo = P["rm_fl_museum"][0]
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, m)
            if inside[y][x]:
                im.putpixel((x, y), hi if not all(nb.values()) else inn.getpixel((x, y)))
            else:
                im.putpixel((x, y), lo if any(nb.values()) else out.getpixel((x, y)))
    return im
