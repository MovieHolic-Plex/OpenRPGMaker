"""체육관 2차 — 적대 검수(qa_gym.md)와 원작 조립본(FRLG 상록·회색, RSE 보라)을 다시 읽고 처음부터 다시 그린다.
문법(눈으로 읽은 것, 픽셀은 복사하지 않음):
- 올린 칸막이는 두 줄이다: 윗면 칸(회색, 1px 외곽선 · 안쪽 ㄱ자 하이라이트) + 앞면 칸(처마턱 2px · 앞면 본체 · 외곽선 · 굽).
  가로 칸막이는 두 줄로, 세로 팔은 한 칸 폭(양옆 2px 바닥이 보인다)으로 칠하고, 남쪽이 빈 칸이 자동으로 앞면이 된다.
  체육관마다 앞면이 다르다(상록: 단색 살구, 보라: 가로 줄무늬). 벽 아래 바닥 8px 는 한 톤 어둡다(바닥 _s 칸).
- 바닥은 조용하다: 상록 청록 격자는 셀보다 밝은 줄눈 + 칸마다 합친 큰 셀 하나, 보라 노랑 마름모 체커, 회색 흙은 1px 점만.
- 장치는 받침 없이 바닥에 직접: 회전 화살표는 어두운 판 + 흰 테 + 굵은 셰브런 둘, 정지는 3×3 돌기 판,
  전기 문은 서 있는 기둥 한 쌍 + 기둥 사이 아크, 스위치는 바닥에 솟은 번개 판, 구멍은 흙을 파낸 모양.
색은 seed.palette 의 g2_* · i2_* 램프에서만 쓴다."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, NW, SE, SW, T  # noqa: E402
from interior2 import F, C, SHADOW, _shade  # noqa: E402

BLOCK_THEMES = {"teal": ("g2_salmon", "g2_fl_teal"), "elec": ("g2_lav", "g2_fl_yel"), "rock": ("g2_stone", "g2_fl_dirt")}   # rock: 바위 체육관 돌 칸막이(돌 쌓기 앞면, 흙 바닥)
AUTOTILE_PARAMS = {f"pb_{k}": k for k in BLOCK_THEMES}


# ---- 바닥 -------------------------------------------------------------------------------------
def floor(P, kind: str, v: int = 0):
    im = px.new()
    if kind == "teal":
        sh, cell, grout = P["g2_fl_teal"]
        bx, by = (4, 0) if v % 2 == 0 else (8, 8)                          # 칸마다 합친 큰 셀(7×7) 위치
        for y in range(T):
            for x in range(T):
                g = x % 4 == 3 or y % 4 == 3
                if bx <= x < bx + 7 and by <= y < by + 7:
                    g = False
                im.putpixel((x, y), grout if g else cell)
    elif kind == "yel":
        sh, fill, empty, hi = P["g2_fl_yel"]
        for y in range(T):
            for x in range(T):
                # 16px 주기 마름모: |x-8|+|y-8| 로 안쪽/바깥(네 귀퉁이 = 이웃 마름모). 안쪽은 채움, 귀퉁이는 빈 마름모
                d = abs(x - 7.5) + abs(y - 7.5)
                c = fill if d < 7.5 else empty
                if abs(d - 7.5) < 0.6 and (x + y) % 2 == 0:
                    c = sh                                                  # 1px 계단 점선
                if (x, y) in ((0, 0), (8, 8)) or (x in (0, 15) and y in (0, 15)):
                    c = hi
                im.putpixel((x, y), c)
        if v % 2:
            im = im.transpose(0)
    elif kind == "dirt":
        sh, base, s1, s2 = P["g2_fl_dirt"]
        r = px.rng(f"dirt2-{v}")
        px.rect(im, 0, 0, 15, 15, base)
        pts = []
        while len(pts) < 7:
            x, y = r.randrange(T), r.randrange(T)
            if all(max(abs(x - a), abs(y - b)) >= 3 for a, b in pts):
                pts.append((x, y))
        for k, (x, y) in enumerate(pts):
            im.putpixel((x, y), s1 if k % 2 else s2)
    elif kind == "plank":
        d, m, l, hi = P["g2_plank"]
        for y in range(T):
            for x in range(T):
                k = y % 4
                c = l if k == 0 else d if k == 3 else m
                if k in (1, 2) and (x + (y // 4) * 6) % 16 == 0:
                    c = d
                im.putpixel((x, y), c)
    return im


def east_shadow(im, top: bool = False, start: bool = False):
    """칸막이 오른쪽(동쪽) 바닥(적대 검수 L4 N51 — 칸마다 대각 쐐기를 다시 시작해 16px 톱니가 됐다):
    왼쪽 4px 곧은 그늘 띠(지역 체육관 시트 gyms_common 과 같은 폭) — 세로로 이어 깔면 끊김 없는 띠다.
    start=True(_e_top): 그늘 띠가 시작하는 칸(바로 위가 그늘 칸이 아니다) — 위 끝만 사선으로 연다.
    top=True(_se): 위 8px 그늘(북쪽도 칸막이)도 함께."""
    out = im.copy()
    for y in range(T):
        for x in range(T):
            if (x < 4 and (not start or y >= x)) or (top and y < 8):
                out.putpixel((x, y), _shade(im.getpixel((x, y)), 0.84))
    return out


def corner_shadow(im):
    """칸막이 남동 모서리 바닥(_c, L5 N61): 남쪽 8px 띠와 동쪽 4px 띠가 만나는 왼쪽 위 4×8 만 그늘 — 그늘이 ㄱ자로 끊기지 않게."""
    out = im.copy()
    for y in range(8):
        for x in range(4):
            out.putpixel((x, y), _shade(im.getpixel((x, y)), 0.84))
    return out


def under_wall(im, west_gap: int = 0):
    """벽·칸막이 밑 그늘 8줄. west_gap: 칸막이 서쪽 끝 밑 칸 — 왼쪽 그 폭은 원래 바닥(칸막이 외곽선이 칸 x=2 에서 시작, L6 N66)."""
    out = im.copy()
    for y in range(8):
        for x in range(west_gap, T):
            out.putpixel((x, y), _shade(im.getpixel((x, y)), 0.84))
    return out


def plank_edge(P):
    """나무단 앞턱: 판 위 9px + 밝은 줄 1px + 어두운 앞면 5px(널 이음 세로줄) + 외곽선 1px."""
    im = floor(P, "plank")
    d = P["g2_plank"]
    px.rect(im, 0, 9, 15, 9, d[3]); px.rect(im, 0, 10, 15, 14, d[0])
    for x in range(3, T, 6):
        px.rect(im, x, 10, x, 14, d[1])
    px.rect(im, 0, 15, 15, 15, C(P, "i2_ol"))
    return im


# ---- 올린 칸막이(오토타일 47) ----------------------------------------------------------------------
def _cell_geom(open_n, open_e, open_w):
    """칸 안 벽 영역(가로 안쪽 여백 2px, 북쪽 여백 1px)."""
    x0 = 2 if open_w else 0
    x1 = T - 3 if open_e else T - 1
    y0 = 1 if open_n else 0
    return x0, x1, y0


def _virtual(m):
    """가운데 칸과 이웃 8칸의 벽 픽셀(48×48)과 칸 종류(top/face). 3×3 밖 이웃은 이어진 것으로 본다."""
    has = {(0, 0): True, (0, -1): bool(m & N), (1, 0): bool(m & E), (0, 1): bool(m & S), (-1, 0): bool(m & W),
           (1, -1): bool(m & NE), (1, 1): bool(m & SE), (-1, 1): bool(m & SW), (-1, -1): bool(m & NW)}
    wall = [[False] * 48 for _ in range(48)]
    kind = [[None] * 48 for _ in range(48)]
    for (cx, cy), ok in has.items():
        if not ok:
            continue
        def nb(dx, dy):
            k = (cx + dx, cy + dy)
            return has.get(k, True)
        x0, x1, y0 = _cell_geom(not nb(0, -1), not nb(1, 0), not nb(-1, 0))
        typ = "face" if not nb(0, 1) else "top"
        # 안쪽 모서리 홈: 두 변이 이어졌는데 그 사이 대각이 비면 그 구석 2px 를 판다 — 이웃 칸의 안쪽 여백과 이음새가 맞는다
        cuts = set()
        for sx, cxr in ((1, range(T - 2, T)), (-1, range(0, 2))):
            for sy, yy in ((-1, 0), (1, T - 1)):
                if nb(sx, 0) and nb(0, sy) and not nb(sx, sy):
                    cuts |= {(xx, yy) for xx in cxr}
        y_end = T - 2 if typ == "face" else T - 1                         # 앞면 칸 맨 아랫줄은 바닥(굽 아래 그늘)
        for y in range(y0, y_end + 1):
            for x in range(x0, x1 + 1):
                if (x, y) in cuts:
                    continue
                X, Y = (cx + 1) * T + x, (cy + 1) * T + y
                wall[Y][X] = True
                kind[Y][X] = typ
    return wall, kind


def block_mask(m):
    wall, _ = _virtual(m)
    return [[wall[T + y][T + x] for x in range(T)] for y in range(T)]


def autotile_masks(kind: str) -> dict:
    return {m: block_mask(m) for m in px.ALL47}


def block_cell(P, m: int, theme: str):
    """칸막이 한 칸. 윗면 칸: 회색 윗면 + 빛 쪽(북·서) 안쪽 1px 하이라이트 + 외곽선.
    앞면 칸(남쪽이 빔): 위 2px 윗면 → 어두운 선 → 처마턱 2px → 어두운 선 → 앞면 본체(체육관마다 다름) → 외곽선 → 회색 굽."""
    face_key, floor_key = BLOCK_THEMES[theme]
    wg, fc = P["g2_wall"], P[face_key]
    ol = C(P, "i2_ol")
    flo = floor(P, {"teal": "teal", "elec": "yel", "rock": "dirt"}[theme], 0)
    wall, kind = _virtual(m)
    me_face = not (m & S)
    open_n = not (m & N)
    im = px.new()
    for y in range(T):
        for x in range(T):
            X, Y = T + x, T + y
            if not wall[Y][X]:
                c = flo.getpixel((x, y))
                # 칸막이가 칸 안쪽 2px 까지만 서므로 그 밖 바닥(오른쪽 2px·아래 줄)도 그늘 — 옆 칸 _e/_s 띠와 이어진다(적대 검수 L5 N61)
                lee = wall[Y][X - 1] or wall[Y][X - 2] or wall[Y - 1][X] or wall[Y - 2][X]
                # 앞면 칸 맨 아래 줄은 바로 위(또는 서북 1~2px)가 칸막이인 열만 — 서쪽 끝 밖 2px 는 원래 바닥(L6 N66: 띠가 외곽선보다 2px 서쪽으로 나왔다)
                foot = me_face and y == T - 1 and (wall[Y - 1][X - 1] or wall[Y - 1][X - 2])
                im.putpixel((x, y), _shade(c, 0.84) if foot or lee else c)
                continue
            edge = any(not wall[Y + dy][X + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if me_face:
                yy = y - (1 if open_n else 0)                              # 한 줄짜리 벽은 1px 내려 그린다
                if edge or yy <= 0 and open_n:
                    c = ol
                elif yy <= 1:
                    c = wg[3] if (open_n and yy == 1) else wg[2]
                elif yy == 2:
                    c = wg[0]
                elif yy <= 4:
                    c = wg[1] if yy == 4 else wg[3]
                elif yy == 5:
                    c = wg[0]
                elif y <= 12:
                    if theme == "elec":
                        c = fc[2] if (yy - 6) % 4 == 0 else fc[1] if (yy - 6) % 4 < 3 else fc[0]
                    elif theme == "rock":                                      # 돌 쌓기: 단 높이 3 + 줄눈 1, 단마다 세로 줄눈이 반 칸 엇갈린다
                        q = yy - 6
                        k = q % 4
                        if k == 3 or (x + (q // 4) * 4) % 8 == 7:
                            c = fc[0]
                        else:
                            c = fc[3] if k == 0 else fc[2] if k == 1 else fc[1]
                    else:
                        c = fc[0] if yy == 6 else fc[1]
                elif y == 13:
                    c = wg[1]
                else:
                    c = ol
                # 이웃이 윗면 칸이면(세로 팔이 내려가는 자리) 앞면 쪽에 세로 외곽선
                if 5 <= yy and y <= 13:
                    for dx in (1, -1):
                        if wall[Y][X + dx] and kind[Y][X + dx] == "top":
                            c = ol
                im.putpixel((x, y), c)
            else:
                if edge:
                    c = ol
                else:
                    hi = (not wall[Y - 2][X]) or (not wall[Y][X - 2])
                    lo = (not wall[Y + 2][X] and kind[Y + 2][X] is None) or (not wall[Y][X + 2])
                    c = wg[3] if hi else wg[1] if lo else wg[2]
                    if theme == "rock" and not hi and not lo:              # 돌 칸막이 윗면: 거친 바위 덩이(2~3px, 왼쪽 위 밝음) — 매끈한 탁자 윗면이 아니다
                        u, v = (x * 5 + y * 3) % 16, (x + y * 7) % 11
                        c = fc[3] if u in (1, 2) and v < 6 else fc[1] if u in (8, 9) and v > 4 else fc[2]
                    # 옆이 앞면 칸이면(가로 벽이 이 세로 팔에 닿는 자리) 앞면 높이만큼 세로 외곽선으로 마감
                    for dx in (1, -1):
                        if wall[Y][X + dx] and kind[Y][X + dx] == "face" and y >= 5:
                            c = ol
                im.putpixel((x, y), c)
    return im


# ---- 체육관 뒷벽 --------------------------------------------------------------------------------
def wall(P, style: str, part: str):
    """체육관 뒷벽 두 칸(32px). teal: 살구 지그재그 프리즈 · elec: 연보라 가로 줄무늬 · rock: 연두 세로 줄무늬 + 돌 걸레받이."""
    ce, ol = P["i2_ceil"], C(P, "i2_ol")
    y0 = 0 if part == "up" else T
    im = px.new()
    for y in range(T):
        Y = y0 + y
        for x in range(T):
            if Y <= 1:
                c = ce[1]
            elif Y == 2:
                c = ce[0]
            elif style == "teal":
                s, tl = P["g2_salmon"], P["g2_fl_teal"]
                if Y <= 12:
                    zz = 4 + abs((x % 8) - 4)                               # 8px 주기 지그재그
                    c = s[2] if Y - 3 == zz - 2 else s[1] if Y - 3 < zz else s[0] if Y == 12 else s[1]
                elif Y == 13:
                    c = ol
                elif Y <= 25:
                    c = tl[2] if Y == 14 else tl[1]
                elif Y <= 29:
                    c = s[0] if Y == 29 else s[1]
                else:
                    c = ol
            elif style == "elec":
                lv = P["g2_lav"]
                if Y <= 27:
                    k = (Y - 3) % 4
                    c = lv[3] if k == 0 else lv[2] if k < 3 else lv[1]
                elif Y <= 29:
                    c = lv[0]
                else:
                    c = ol
            else:
                gr, st = P["g2_rockwall"], P["g2_stone"]
                if Y <= 24:
                    c = gr[2] if x % 6 < 4 else gr[1]
                    if Y == 3:
                        c = gr[0]
                elif Y == 25:
                    c = ol
                elif Y <= 30:
                    c = st[2] if Y == 26 else st[1] if (x + (Y // 3) * 3) % 8 else st[0]
                else:
                    c = ol
            im.putpixel((x, y), c)
    return im


def corner_wall(P, style, part, side):
    im = wall(P, style, part)
    x = 0 if side == "l" else T - 1
    for y in range(T):
        im.putpixel((x, y), C(P, "i2_ol"))
    return im


# ---- 장치 -------------------------------------------------------------------------------------
def _chev(im, cx, cy, d, c, w=2):
    """위(d='u')를 향한 셰브런 한 개(폭 9, 굵기 w)를 방향에 맞게 찍는다."""
    for k in range(5):
        for t in range(w):
            for sgn in (-1, 1):
                ax, ay = sgn * k, k + t                                    # 꼭짓점이 위
                x, y = {"u": (ax, ay), "d": (ax, -ay), "l": (ay, ax), "r": (-ay, ax)}[d]
                px.put(im, cx + x, cy + y, c)


def spin(P, d: str, base: str = "teal"):
    """회전 칸: 바닥 위 어두운 판(모서리 1px 깎기) + 흰 테 1px + 2px 굵기 셰브런 둘(앞 어두운 녹색 · 뒤 밝은 녹색)."""
    im = floor(P, base, 0)
    sl, ar, w = P["g2_slate"], P["g2_arrow"], P["i2_white"]
    px.rect(im, 1, 1, 14, 14, w[2])
    px.rect(im, 2, 2, 13, 13, sl[0])
    for x, y in ((1, 1), (14, 1), (1, 14), (14, 14)):
        im.putpixel((x, y), floor(P, base, 0).getpixel((x, y)))
    px.rect(im, 3, 3, 12, 3, sl[1])
    o = {"u": (0, -1), "d": (0, 1), "l": (-1, 0), "r": (1, 0)}[d]
    cx, cy = 7, 7
    tip = {"u": (7, 3), "d": (8, 12), "l": (3, 8), "r": (12, 7)}[d]
    back = (tip[0] - 4 * o[0], tip[1] - 4 * o[1])
    _chev(im, back[0], back[1], d, ar[1])
    _chev(im, tip[0], tip[1], d, ar[0])
    return im


def spin_stop(P, base: str = "teal"):
    """정지 칸(적대 검수 L2 N37 — 크림색 와플이 크래커로 읽혔다): 화살표 판과 짝인 어두운 판(흰 테 · 모서리 깎기) 가운데
    흰 정지 단추(둥근 네모 6px, 오른쪽 아래 그늘 1px, 가운데 판 색 점). 화살표 = 간다, 단추 = 선다."""
    im = floor(P, base, 0)
    sl, w = P["g2_slate"], P["i2_white"]
    px.rect(im, 1, 1, 14, 14, w[2])
    px.rect(im, 2, 2, 13, 13, sl[0])
    for x, y in ((1, 1), (14, 1), (1, 14), (14, 14)):
        im.putpixel((x, y), floor(P, base, 0).getpixel((x, y)))
    px.rect(im, 3, 3, 12, 3, sl[1])
    px.rect(im, 5, 5, 10, 10, w[2])
    for x, y in ((5, 5), (10, 5), (5, 10), (10, 10)):
        im.putpixel((x, y), sl[0])
    px.rect(im, 6, 11, 10, 11, sl[1]); px.rect(im, 11, 6, 11, 10, sl[1])
    px.rect(im, 7, 7, 8, 8, sl[1])
    im.putpixel((6, 6), w[2])
    return im


def leader_mat(P):
    """관장 매트(3×2, 걷는다, L2 N37 — 노란 사선이 공사 경고 띠로 읽혔다): 노란 판 · 안쪽 밝은 테 1px · 가운데 체육관 문장(금테 원 + 보석) · 앞 두께 2px."""
    y_, gd, r = P["i2_yellow"], P["i2_gold"], P["g2_salmon"]
    f = F(3, 2)
    f.r(1, 2, 46, 26, y_[1])
    f.r(3, 4, 44, 4, y_[2]); f.r(3, 24, 44, 24, y_[0]); f.r(3, 4, 3, 24, y_[2]); f.r(44, 4, 44, 24, y_[0])
    f.ell(24, 14.5, 7.2, 6.4, gd[0]); f.ell(24, 14.5, 5.8, 5.0, gd[1]); f.ell(24, 14.5, 3.0, 2.6, r[1]); f.p(23, 13, P["i2_white"][2])
    f.r(1, 27, 46, 28, y_[0])
    return f.done(P, floor_y=0)


def pylon(P, on: bool = True):
    """전기 기둥(1×2, 막힘): 폭 13px — 둥근 애자 세 단(흰·밝은 시안·남색 3단 명암)을 쌓고 폭 16px 받침. 꺼진 기둥은 애자가 회색."""
    st = P["i2_steel"]
    ins = P["g2_arc"] if on else P["g2_wall"]
    f = F(1, 2)
    f.r(0, 25, 15, 30, st[1]); f.r(0, 25, 15, 25, st[2]); f.r(0, 30, 15, 30, st[0])
    f.r(6, 4, 9, 25, st[0])
    for k, cy in enumerate((6.5, 13.5, 20.5)):
        f.ell(8, cy, 6.5, 3.4, ins[0] if on else ins[1])
        f.ell(7.4, cy - 0.6, 5.2, 2.4, ins[1] if on else ins[2])
        f.ell(6.2, cy - 1.2, 2.4, 1.1, P["i2_white"][2] if on else ins[3])
    return f.done(P, floor_y=26)


def arc(P, v: int):
    """기둥 사이 아크(1×1, 위층, 막힘): 높이 6px — 흰 심 + 시안 번짐 + 검은 잔줄이 기둥 애자 높이(칸 위쪽)에 떠 있다."""
    ar = P["g2_arc"]
    im = px.new()
    r = px.rng(f"arc{v}")
    y = 5
    pts = []
    for x in range(T):
        y = max(3, min(8, y + r.choice((-2, -1, 1, 2))))
        pts.append((x, y))
    for x, y in pts:
        for dy in (-3, 3):
            if r.random() < 0.5:
                px.put(im, x, y + dy, ar[0])
        for dy in (-2, -1, 1, 2):
            px.put(im, x, y + dy, ar[1] if abs(dy) < 2 else (ar[1] if (x + dy) % 2 else ar[0]))
    for x, y in pts:
        px.put(im, x, y, ar[2])
    return im


def switch(P, base: str = "yel"):
    """스위치(바닥 칸, 밟는다): 바닥에 박힌 판(어두운 테 1px, 회색 면) 위에 노란 번개 「S」 12×14px(외곽선 포함)."""
    im = floor(P, base, 0)
    y_, ol = P["i2_yellow"], C(P, "i2_ol")
    px.rect(im, 1, 1, 14, 14, ol); px.rect(im, 2, 2, 13, 13, P["g2_wall"][1]); px.rect(im, 2, 2, 13, 2, P["g2_wall"][2])
    bolt = ["....oooooo", "...oYYYYo.", "..oYYYYo..", ".oYYYYoooo", "oYYYYYYYYo", "ooooYYYYo.", "...oYYYo..",
            "..oYYYo...", ".oYYYo....", ".oYYo.....", "oYYo......", "oYo.......", "oo........"]
    for j, row in enumerate(bolt):
        for i, ch in enumerate(row):
            if ch == "o":
                px.put(im, 3 + i, 1 + j, ol)
            elif ch == "Y":
                px.put(im, 3 + i, 1 + j, y_[2] if j < 3 or i < 4 + (j > 5) * -3 + 3 and j < 5 else y_[1])
    return im


def pit(P):
    """흙 구멍(1×1, 바닥): 위 가장자리 1px 밝은 입술 · 안쪽 위 2px 흙벽(어둠) · 바닥 검정. 흙을 직접 파낸 모양."""
    im = floor(P, "dirt", 0)
    d = P["g2_fl_dirt"]
    for y in range(T):
        for x in range(T):
            dd = ((x + 0.5 - 8) / 6.5) ** 2 + ((y + 0.5 - 8.5) / 5.6) ** 2
            if dd <= 1:
                top = ((x + 0.5 - 8) / 6.5) ** 2 + ((y - 0.5 - 8.5) / 5.6) ** 2 > 1
                wall_ = ((x + 0.5 - 8) / 6.5) ** 2 + ((y - 2.5 - 8.5) / 5.6) ** 2 > 1
                im.putpixel((x, y), C(P, "i2_ol") if top else d[0] if wall_ else C(P, "i2_void"))
            elif ((x + 0.5 - 8) / 6.5) ** 2 + ((y + 1.5 - 8.5) / 5.6) ** 2 <= 1:
                im.putpixel((x, y), P["g2_stop"][2])                           # 위 입술(밝음)
    return im


def boulder(P, v: int, outdoor: bool = False):
    """outdoor=True(야외 boulder0/1, 적대 검수 L2 N27): 바위 픽셀은 같고, 다각형 밖 갈색 접지 고리만 풀 위 반투명 그림자로 바꾼다.
밀 바위(괴력, 1×1, 위층) — 본 시트의 밀기 바위는 이 그림 하나다(동굴 cave_boulder 도 같은 픽셀, 감독 지시 2026-10-02).
    원작 괴력 바위처럼 모가 난 덩이 돌: 8각 다각형 윤곽, 면마다 한 톤(왼쪽 위 면 최명 · 윗면 명 · 오른쪽 면 암 · 아래 면 최암),
    면 사이는 톤 차로만 가르고(구슬처럼 둥글게 번지지 않는다) 금 한 줄, 아래 갈색 접지 고리."""
    st = P["g2_stone"]
    f = F(1, 1)
    f.ell(8, 13.6, 6.6, 1.9, P["g2_plank"][1])
    poly = [(2.5, 6), (5.5, 2), (10.5, 1.8), (14, 5.5), (14.2, 10.5), (11, 13.4), (4.5, 13.4), (1.8, 10)] if v == 0 else \
           [(2, 7), (4.5, 2.6), (9.5, 1.6), (13.6, 4), (14.4, 9.6), (12, 13.4), (5, 13.6), (2, 11)]
    import landmarks as lm_
    cx, cy = 8.0, 7.6
    ph = 0.0 if v == 0 else 0.35
    for y in range(T):
        for x in range(T):
            if not lm_._in_poly(x + 0.5, y + 0.5, poly):
                continue
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            rr = math.hypot(dx / 6.2, dy / 5.8)
            if rr < 0.38:
                c = st[2]                                                   # 윗면(평평한 꼭대기)
            else:
                sec = int(((math.atan2(dy, dx) + math.pi + ph) / (2 * math.pi) * 6)) % 6   # 0 = 왼쪽, 시계 방향
                c = (st[3], st[3], st[2], st[1], st[0], st[1])[sec]
            f.p(x, y, c)
    if v == 0:
        f.line(9, 4, 11, 7, st[0]); f.p(12, 8, st[1])
    else:
        f.line(5, 9, 7, 11, st[0])
    im = f.done(P, floor_y=16, shadow=False)
    if outdoor:
        for y in range(T):
            for x in range(T):
                if im.getpixel((x, y))[3] and not lm_._in_poly(x + 0.5, y + 0.5, poly):
                    im.putpixel((x, y), SHADOW)
    return im


def big_rock(P, outline=None):
    """관장 뒤 큰 바위(2×2, 막힘). 밀 바위(회색 g2_stone)와 갈리게 따뜻한 회갈 램프(동굴 바닥 계열) + 이끼 점(L3 N50).
    outline: 윤곽 색(기본 None = 지금처럼 가구 윤곽 i2_ol — 본 시트 출력 바이트 그대로). 야생 산은 바위 램프 최암을 넘긴다(야생 QA-L8 N8)."""
    st = P["cave_floor"]
    f = F(2, 2)
    for cx, cy, rx, ry in ((15, 15, 12, 11), (8, 20, 7, 7), (23, 19, 7, 8), (16, 8, 8, 6)):
        for y in range(32):
            for x in range(32):
                dd = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                if dd <= 1:
                    l = -((x - cx) / rx + (y - cy) / ry)
                    f.p(x, y, st[3] if l > 1.0 else st[2] if l > 0.2 else st[1] if l > -0.7 else st[0])
    f.line(12, 10, 16, 16, st[0]); f.line(16, 16, 22, 18, st[0])
    for x, y in ((10, 6), (11, 6), (9, 7), (21, 12), (22, 12)):          # 이끼 점(꼭대기 그늘 쪽)
        f.p(x, y, P["leaf"][1])
    return f.done(P if outline is None else dict(P, i2_ol=[outline]), floor_y=20)


def dais(P):
    """회색 체육관 관장 단상(3×3, 걷는다): 네모 돌판 윗면(줄눈·하이라이트) + 앞면 8px + 가운데 계단 한 단."""
    st = P["g2_stone"]
    f = F(3, 3)
    f.r(1, 2, 46, 30, st[2]); f.r(1, 2, 46, 2, st[3]); f.r(1, 2, 1, 30, st[3])
    for y in (10, 20):
        f.r(2, y, 45, y, st[1])
    for x in (16, 31):
        f.r(x, 3, x, 30, st[1])
    f.r(1, 31, 46, 38, st[1]); f.r(1, 31, 46, 31, st[0]); f.r(1, 38, 46, 38, st[0])
    f.r(16, 39, 31, 44, st[2]); f.r(16, 39, 31, 39, st[3]); f.r(16, 44, 31, 44, st[0])
    return f.done(P, floor_y=0)


def e_dais(P):
    """보라 관장 연단(4×2, 걷는다): 회색 단 위 노란 명판."""
    st, y_ = P["g2_stone"], P["i2_yellow"]
    f = F(4, 2)
    f.r(1, 2, 62, 24, st[2]); f.r(1, 2, 62, 2, st[3]); f.r(1, 25, 62, 28, st[0])
    f.r(14, 7, 49, 19, y_[1]); f.r(14, 7, 49, 7, y_[2]); f.r(14, 19, 49, 19, y_[0])
    return f.done(P, floor_y=0)


def statue(P):
    """입구 석상(1×2, 막힘): 몬스터 조각이 받침 윗면에 붙어 앉는다(귀 둘이 머리에 붙음) · 금색 명판 · 외곽선 · 왼쪽 하이라이트."""
    st, gd = P["g2_stone"], P["i2_gold"]
    f = F(1, 2)
    f.r(2, 21, 13, 29, st[1]); f.r(2, 21, 13, 22, st[3]); f.r(2, 29, 13, 29, st[0])
    f.r(5, 24, 10, 27, gd[1]); f.r(5, 24, 10, 24, gd[0])
    f.ell(8, 15, 5, 6.5, st[2]); f.ell(8, 7, 4, 3.6, st[2])
    f.r(4, 2, 5, 6, st[2]); f.r(11, 2, 12, 6, st[2])
    f.ell(6.5, 13, 2, 3.5, st[3]); f.r(5, 5, 5, 8, st[3]); f.p(6, 7, st[0]); f.p(10, 7, st[0])
    return f.done(P, floor_y=21)


def gym_mat(P):
    """체육관 입구 매트(바닥 칸 아래쪽, L8 N75 · L9 N83): 바닥과 같은 높이에 깔린 천 깔개 14×11(술 포함).
    바탕은 매트 파랑 gl[0](밝은 바닥 위에서 한 단 진하게 — 상록·크림 바닥에서 흐렸다) · 안쪽 한 겹 연파랑 바둑 무늬 테 ·
    가운데 연파랑 가로 띠(원 무늬는 정지판 ◎ 과 닮았다) · 위아래 끝에 술(1px 걸러). 남색 외곽선·흰 반짝임·그림자 없음."""
    def _(base):
        im = floor(P, base, 0)
        gl = P["i2_glass"]
        px.rect(im, 1, 4, 14, 12, gl[0])
        for x in range(2, 14):                                       # 안쪽 바둑 무늬 테(1px)
            for y in (5, 11):
                if (x + y) % 2 == 0:
                    im.putpixel((x, y), gl[1])
        for y in range(6, 11):
            for x in (2, 13):
                if (x + y) % 2 == 0:
                    im.putpixel((x, y), gl[1])
        px.rect(im, 4, 8, 11, 8, gl[1])                              # 가운데 가로 띠
        for x in (4, 11):
            im.putpixel((x, 7), gl[1]); im.putpixel((x, 9), gl[1])
        for x in range(2, 14, 2):                                    # 위아래 술
            im.putpixel((x, 3), gl[0]); im.putpixel((x, 13), gl[0])
        return im
    return _


def edge_mat(P):
    from interior2 import edge_mat as _em
    return _em(P)


def emblem(P, ramp: str):
    """뒷벽 가운데 체육관 문장(2×2 캔버스, 벽 위): 금테 원판 + 가운데 체육관 색 보석."""
    gd, r = P["i2_gold"], P[ramp]
    f = F(2, 2)
    f.ell(16, 13, 9, 9, gd[0]); f.ell(16, 13, 7.6, 7.6, gd[1]); f.ell(16, 13, 4.2, 4.2, r[1]); f.ell(15, 12, 1.8, 1.6, P["i2_white"][2])
    f.r(14, 2, 17, 4, gd[1])
    return f.done(P, shadow=False)


def window(P):
    """바위 체육관 뒷벽 창(1×2 캔버스, 벽 위): 나무틀 · 하늘 유리 · 창살."""
    gl, wd = P["i2_glass"], P["i2_wood"]
    f = F(1, 2)
    f.r(2, 6, 13, 21, wd[1]); f.r(4, 8, 11, 19, gl[1]); f.r(7, 8, 8, 19, wd[1]); f.line(5, 18, 7, 10, gl[2])
    return f.done(P, shadow=False)


FURN = {"g_leader_mat": (leader_mat, "decor"), "g_pylon": (pylon, "prop"), "g_pylon_off": (lambda P: pylon(P, False), "prop"),
        "g_emblem_teal": (lambda P: emblem(P, "g2_salmon"), "prop"), "g_emblem_elec": (lambda P: emblem(P, "g2_lav"), "prop"), "g_window": (window, "prop"), "g_dais": (dais, "decor"), "g_edais": (e_dais, "decor"),
        "g_statue": (statue, "prop"), "g_bigrock": (big_rock, "prop")}
