"""실내 2차 — 적대 검수(2026-10-02, qa_interior.md)와 FRLG 센터·마트·집 조립본을 다시 읽고 처음부터 다시 그린다.
문법(눈으로 읽은 것, 픽셀은 복사하지 않음):
- 뒷벽은 방마다 다르다(32px 가로 띠 골격: 흰 천장 끝 → 색 띠 → 진한 선 → 벽면 → 몰딩 → 걸레받이). 세로 줄무늬·액자 테두리 없음.
- 옆·아래는 검은 여백 + 흰 천장 끝 가는 띠. 벽 바로 아래 바닥 8px 는 한 톤 어둡게(단색).
- 바닥은 3톤 규칙 무늬(센터 볼록 사각 8px · 마트 2단 체크 16px · 집 바구니 짜임 8px). 센터 한가운데 별 문양 3×3(몬스터볼 모양은 쓰지 않는다).
- 가구는 전부 진남회 외곽선 1px 하나, 윗면 하이라이트 1px, 앞면 진한 띠, 오른쪽·아래 한 톤 그림자(반투명). 큰 가구는 뒷벽에 붙어 벽을 덮는다.
색은 seed.palette 의 i2_* 램프에서만 쓴다."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402

SHADOW = (0, 0, 0, 72)
CLEAR = (0, 0, 0, 0)


def C(P, key, i=0):
    return P[key][i]


# ---- 그리기 도구 -------------------------------------------------------------------------------
class F:
    """가구 캔버스: 모양을 칠한 뒤 done() 이 외곽선(진남회)과 그림자(오른쪽·아래)를 붙인다."""

    def __init__(self, wt, ht):
        self.im = px.new(wt * T, ht * T)
        self.w, self.h = wt * T, ht * T

    def r(self, x0, y0, x1, y1, c):
        px.rect(self.im, x0, y0, x1, y1, c)

    def p(self, x, y, c):
        px.put(self.im, x, y, c)

    def ell(self, cx, cy, rx, ry, c):
        for y in range(self.h):
            for x in range(self.w):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.im.putpixel((x, y), c)

    def line(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            self.p(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), c)

    def done(self, P, floor_y=0, sx=2, sy=3, outline=True, shadow=True):
        a = [[self.im.getpixel((x, y))[3] == 255 for x in range(self.w)] for y in range(self.h)]
        ol = C(P, "i2_ol")
        if outline:
            for y in range(self.h):
                for x in range(self.w):
                    if a[y][x] and any(not (0 <= x + dx < self.w and 0 <= y + dy < self.h) or not a[y + dy][x + dx]
                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        self.im.putpixel((x, y), ol)
        if shadow:
            for y in range(max(0, floor_y), self.h):
                for x in range(self.w):
                    if a[y][x]:
                        continue
                    hit = (x - sx >= 0 and a[y][x - sx]) or (y - sy >= 0 and a[y - sy][x]) or (x - sx >= 0 and y - sy >= 0 and a[y - sy][x - sx])
                    if hit and y - sy >= floor_y - sy:
                        self.im.putpixel((x, y), SHADOW)
        return self.im


def _shade(c, f=0.86):
    return px.tint(c, f)


# ---- 바닥 -------------------------------------------------------------------------------------
def floor(P, kind: str, v: int = 0):
    """kind: center(볼록 사각 8px) · mart(2단 체크 16px) · house(바구니 짜임 8px). 전부 3톤."""
    im = px.new()
    if kind == "center":
        d, b, l = P["i2_fl_center"]
        for y in range(T):
            for x in range(T):
                xx, yy = x % 8, y % 8
                c = d if xx == 7 or yy == 7 else l if 1 <= xx <= 5 and 1 <= yy <= 5 else b
                im.putpixel((x, y), c)
    elif kind == "mart":
        d, m, l = P["i2_fl_mart"]                                            # 2단 파랑 체크(GBA 다시 그리기 때 파랑·흰 체크로 바꿨다가 사용자가 옛 판이 낫다고 해 되돌림, 2026-10-07)
        for y in range(T):
            for x in range(T):
                c = d if x % 8 == 7 or y % 8 == 7 else l if (x // 8 + y // 8) % 2 == 0 else m
                im.putpixel((x, y), c)
    else:
        im = _planks(P, v)
    return im


_JOINTS = (2, 10, 6, 14)                                                 # 판자 줄마다 이음매 x(위아래 줄이 엇갈린다)
_GRAIN = {0: ((7, 1, 3), (12, 9, 2)), 1: ((13, 2, 3), (4, 9, 3))}       # 결 자국(x, y, 길이) — 변형마다 다른 자리, 칸 안에서만


def _planks(P, v: int):
    """집 바닥: 가로 판자 4px 4줄(윗줄 밝은 결 1px · 몸 2px · 이음 진한 줄 1px), 줄마다 엇갈린 세로 이음매.
    두 변형은 이음매 자리가 같고(어느 쪽과 이웃해도 이어진다) 결 자국만 다르다."""
    sm, dk, b, l = P["i2_plank"]
    im = px.new()
    for y in range(T):
        r, k = y // 4, y % 4
        j = _JOINTS[r]
        for x in range(T):
            if k == 3 or x == j:
                c = sm
            elif k == 0:
                c = l
            else:
                c = b
            im.putpixel((x, y), c)
        if k == 0:
            im.putpixel(((j + 1) % T, y), l)
    for gx, gy, n in _GRAIN[v % 2]:
        for x in range(gx, gx + n):
            if x != _JOINTS[gy // 4]:
                im.putpixel((x, gy), dk)
    return im


def under_wall(im):
    """벽 바로 아래 칸: 위 8px 를 한 톤 어둡게(단색 한 단, 바닥 무늬는 비친다)."""
    out = im.copy()
    for y in range(8):
        for x in range(T):
            out.putpixel((x, y), _shade(im.getpixel((x, y)), 0.84))
    return out


def star_mask(S: int, r_out: float, r_in: float, points: int = 4, rot: float = -math.pi / 2):
    """S×S 안 가운데 별(꼭짓점 points 개) 안쪽 여부 표 — 반지름 r_out(뾰족 끝)·r_in(오목 안쪽) 사이를 직선으로 잇는다."""
    cx = cy = S / 2
    out = [[False] * S for _ in range(S)]
    for y in range(S):
        for x in range(S):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > r_out:
                continue
            ang = (math.atan2(dy, dx) - rot) % (2 * math.pi / points)
            half = math.pi / points
            t = abs(ang - half) / half                                     # 0 = 오목한 곳, 1 = 뾰족 끝
            out[y][x] = d <= r_in + (r_out - r_in) * t
    return out


def emblem(P):
    """센터 바닥 별 문양(3×3 칸, 48px, 별빛섬): 바닥 무늬 그대로 톤만 바꾼다 — 둥근 테 한 줄, 그 안에 네 갈래 별(빛 받는 왼쪽 위 갈래는 밝게).
    예전 몬스터볼 문양(위 반원 어둡게·가운데 띠·단추)은 원작 상표 모양이라 지웠다(2026-10-07 사용자)."""
    base = floor(P, "center")
    big = px.new(48, 48)
    for y in range(48):
        for x in range(48):
            big.putpixel((x, y), base.getpixel((x % T, y % T)))
    cx = cy = 24
    star = star_mask(48, 19.0, 6.0)
    edge = [[star[y][x] and any(not (0 <= x + dx < 48 and 0 <= y + dy < 48) or not star[y + dy][x + dx]
                                 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) for x in range(48)] for y in range(48)]
    for y in range(48):
        for x in range(48):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            c = big.getpixel((x, y))
            if 20.3 < d <= 21.5:
                big.putpixel((x, y), _shade(c, 0.80))
            elif edge[y][x]:
                big.putpixel((x, y), _shade(c, 0.76))
            elif star[y][x]:
                lit = (x + 0.5 - cx) + (y + 0.5 - cy) < 0
                big.putpixel((x, y), px.tint(c, 1.05) if lit else _shade(c, 0.9))
    return {f"c_emblem.{i}.{j}": big.crop((i * T, j * T, i * T + T, j * T + T)) for j in range(3) for i in range(3)}


def mat(P, kind: str):
    """출입 매트: 바닥 칸 아래쪽에 붙은 넓은 깔개(2톤 테두리) — 아래 벽선(검은 여백 위 흰 띠)에 반쯤 걸친다."""
    im = floor(P, kind)
    r = P["i2_mat"]
    px.rect(im, 1, 4, 14, 14, r[0]); px.rect(im, 2, 5, 13, 13, r[1])
    for y in (7, 10):
        px.rect(im, 3, y, 12, y, r[2])
    return im


# ---- 벽 ---------------------------------------------------------------------------------------
def _wall_column(P, style: str):
    """32px 세로 띠 하나(가로로 반복). 반환: 32줄짜리 색 목록 생성기(x 를 받아 색)."""
    ce = P["i2_ceil"]
    if style == "center":
        y_, o = P["i2_c_band"]
        face, mo, bb = P["i2_c_face"], P["i2_c_mold"], P["i2_base_navy"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y in (3, 6): return y_
            if y <= 9: return o
            if y == 10: return C(P, "i2_ol")
            if y <= 21: return face[1] if y == 11 else face[0]
            if y <= 27:                                                     # 아치 몰딩 띠: 8px 주기 반원
                k = x % 8
                arc = 22 + round(2.6 * (1 - ((k - 3.5) / 4) ** 2))
                return mo[1] if y == arc else mo[0] if y > arc else face[0]
            if y == 28: return bb[2]
            if y == 29: return bb[1]
            if y == 30: return bb[0]
            return C(P, "i2_ol")
    elif style == "mart":
        g, face, bb = P["i2_m_band"], P["i2_m_face"], P["i2_base_sky"]
        def col(x, y):
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return g[1]
            if y <= 6: return g[0]
            if y == 7: return C(P, "i2_ol")
            if y <= 24: return face[1] if y == 8 else face[0]
            if y <= 27: return bb[2] if y == 25 else bb[1]
            if y == 28: return bb[0]
            if y <= 30: return P["i2_gray"][1]
            return C(P, "i2_ol")
    else:
        pa, tr = P["i2_h_paper"], P["i2_h_trim"]
        def col(x, y):                                                      # 크림 벽지 + 나무 징두리(허리 아래 판벽)
            if y <= 1: return ce[1]
            if y == 2: return ce[0]
            if y == 3: return C(P, "i2_ol")                                 # 벽 윗선
            if y == 4: return pa[0]                                         # 천장 아래 그늘 1px
            if y <= 19: return pa[2] if x % 8 == 0 else pa[1]               # 벽지: 8px 마다 옅은 세로 결
            if y == 20: return tr[3]                                        # 허리 띠(빛 받는 윗면)
            if y == 21: return tr[1]
            if y == 22: return tr[0]
            if y <= 28:
                return tr[1] if x % 8 == 7 else tr[2]                       # 판벽 이음(8px)
            if y == 29: return tr[1]
            if y == 30: return tr[0]
            return C(P, "i2_ol")
    return col


def wall(P, style: str, part: str):
    """뒷벽 한 칸(part: up=위 칸, dn=아래 칸)."""
    col = _wall_column(P, style)
    y0 = 0 if part == "up" else T
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), col(x, y0 + y))
    return im


def _strip(P):
    """옆·아래 벽 두께 6px(바닥 쪽부터): 외곽선 · 연회색 · 흰 윗면 3px · 회색 바깥 테."""
    ce = P["i2_ceil"]
    return [C(P, "i2_ol"), P["i2_gray"][2], ce[1], ce[1], ce[1], ce[0]]


def edge(P, sides: str):
    """검은 여백 칸 + 벽 두께 띠(6px). sides: 띠가 붙는 쪽(l/r/t 조합 — 방 안쪽을 향한 변)."""
    vd = C(P, "i2_void")
    st = _strip(P)
    im = px.new()
    px.rect(im, 0, 0, 15, 15, vd)
    for y in range(T):
        for x in range(T):
            ds = []
            if "r" in sides:
                ds.append(T - 1 - x)
            if "l" in sides:
                ds.append(x)
            if "t" in sides:
                ds.append(y)
            if not ds:
                continue
            if "t" in sides and len(ds) == 2:                             # 아래 모서리: 옆 띠와 아래 띠가 만나는 6×6 구석만
                if ("r" in sides and x < T - 6) or ("l" in sides and x > 5) or y > 5:
                    continue
            d = min(ds)
            if d < 6:
                im.putpixel((x, y), st[d])
    return im


def edge_mat(P):
    """출구 틈: 매트 아래 아래벽 칸은 띠를 끊어 검은 틈으로 둔다(밖으로 나가는 자리)."""
    im = px.new()
    px.rect(im, 0, 0, 15, 15, C(P, "i2_void"))
    st = _strip(P)
    for y in range(6):
        im.putpixel((0, y), st[0]); im.putpixel((15, y), st[0])
    return im


def corner_wall(P, style: str, part: str, side: str):
    """뒷벽 양 끝 칸: 옆 여백의 흰 띠가 벽 위까지 이어 올라간다(방이 상자로 닫힌다)."""
    im = wall(P, style, part)
    x = 0 if side == "l" else T - 1
    for y in range(T):
        im.putpixel((x, y), C(P, "i2_ol"))                                    # 옆벽 두께 띠(옆 칸)와 맞닿는 선
    return im


# ---- 센터 가구 --------------------------------------------------------------------------------
def _plant_small(f, P, cx, base_y):
    """접수대 위 작은 화분(6px)."""
    lf = P["leaf"]
    f.r(cx - 2, base_y - 3, cx + 2, base_y, P["i2_white"][1]); f.r(cx - 2, base_y - 3, cx + 2, base_y - 3, P["i2_white"][0])
    f.ell(cx + 0.5, base_y - 6, 3.6, 3.0, lf[2]); f.ell(cx - 0.2, base_y - 6.8, 2.2, 1.6, lf[3])
    f.p(cx - 2, base_y - 8, P["i2_c_flower"][0]); f.p(cx + 2, base_y - 7, P["i2_c_flower"][0]); f.p(cx, base_y - 9, P["i2_c_flower"][1])


def c_counter(P):
    """센터 접수대(7×3): ㄷ자 — 양 팔이 뒷벽까지 올라가고 그 사이 한 줄(16px)이 간호사 자리(빈 바닥).
    연어색 윗면(하이라이트 1px) · 진한 앞 띠 2px · 강철 받침 6px · 아래 그림자."""
    s_, st = P["i2_salmon"], P["i2_steel"]
    f = F(7, 3)
    f.r(0, 0, 13, 31, s_[1]); f.r(98, 0, 111, 31, s_[1])                 # 팔(윗면, 뒷벽까지)
    f.r(0, 18, 111, 31, s_[1])                                            # 상판
    f.r(1, 1, 1, 17, s_[2]); f.r(99, 1, 99, 17, s_[2]); f.r(14, 19, 97, 19, s_[2])
    f.r(0, 32, 111, 33, s_[0])
    f.r(0, 34, 111, 40, st[1]); f.r(0, 34, 111, 34, st[2]); f.r(0, 40, 111, 40, st[0])
    for x in range(12, 108, 16):
        f.r(x, 35, x, 39, st[0])
    f.r(51, 22, 60, 26, P["i2_white"][2]); f.r(53, 24, 58, 24, P["i2_gray"][1])          # 서류판
    f.r(40, 23, 43, 26, P["i2_gold"][1]); f.p(41, 22, P["i2_gold"][0])                   # 종
    _plant_small(f, P, 7, 28); _plant_small(f, P, 104, 28)
    return f.done(P, floor_y=32)

def c_healer(P):
    """회복기(2×2, 뒷벽에 박힘): 흰 둥근 몸체, 위 유리 돔, 구슬 칸 여섯(초록 바탕 파란 구슬), 앞 패널 빨간 십자."""
    w, g, gl = P["i2_white"], P["i2_green"], P["i2_glass"]
    f = F(2, 2)
    f.r(3, 6, 28, 30, w[1]); f.r(3, 6, 28, 7, w[2]); f.r(3, 28, 28, 30, w[0])
    f.ell(16, 8, 10, 6, gl[1]); f.ell(14, 6.5, 5, 2.4, gl[2])
    f.r(5, 13, 26, 21, g[0]); f.r(5, 13, 26, 13, g[1])
    for k in range(6):                                                    # 포획구슬 여섯: 한 색 구슬 + 왼쪽 위 빛 1px(빨강·흰 반쪽 몬스터볼 모양은 쓰지 않는다)
        x = 7 + (k % 3) * 7; y = 14 + (k // 3) * 4
        f.r(x, y, x + 3, y + 2, P["i2_blue"][1]); f.r(x, y + 2, x + 3, y + 2, P["i2_blue"][0]); f.p(x, y, w[2])
    f.r(13, 23, 18, 27, w[2]); f.r(15, 22, 16, 28, P["i2_red"][1]); f.r(12, 24, 19, 25, P["i2_red"][1])
    return f.done(P, floor_y=31, shadow=False)


def c_pc(P):
    """PC 단말(1×2, 뒷벽에 붙임): 흰 본체 16×30 · 위 모니터(사선 반사) · 디스크 슬롯 둘 · 받침 띠."""
    w, gl = P["i2_white"], P["i2_glass"]
    f = F(1, 2)
    f.r(0, 2, 15, 29, w[1]); f.r(0, 2, 15, 3, w[2]); f.r(1, 4, 1, 27, w[2])
    f.r(2, 5, 13, 14, P["i2_gray"][0]); f.r(3, 6, 12, 13, gl[1]); f.line(4, 12, 7, 7, gl[2]); f.line(7, 12, 9, 9, gl[2])
    for y in (18, 22):
        f.r(3, y, 12, y + 1, P["i2_gray"][1]); f.r(3, y, 12, y, P["i2_gray"][0])
    f.p(12, 26, P["i2_green"][2]); f.r(0, 28, 15, 29, w[0])
    return f.done(P, floor_y=16)

def c_screen(P):
    """벽 화면(2×2 캔버스, 벽 위): 검은 테두리 모니터 + 세계 지도 화면."""
    gl = P["i2_glass"]
    f = F(2, 2)
    f.r(3, 6, 28, 20, P["i2_gray"][0]); f.r(5, 8, 26, 18, gl[0])
    f.r(8, 10, 13, 13, P["i2_green"][1]); f.r(17, 12, 23, 16, P["i2_green"][1]); f.r(9, 15, 12, 16, P["i2_green"][1])
    f.line(6, 17, 10, 9, gl[2])
    return f.done(P, shadow=False)


def c_sofa(P, color: str):
    """쿠션 의자(1×1): 윗면 쿠션(하이라이트 1px) + 회색 앞 띠 + 손잡이 점."""
    r = P[color]
    f = F(1, 1)
    f.r(1, 1, 12, 8, r[1]); f.r(1, 1, 12, 1, r[2]); f.r(2, 3, 2, 6, r[2])
    f.r(1, 9, 12, 11, P["i2_gray"][1]); f.r(1, 9, 12, 9, P["i2_gray"][2])
    f.p(3, 10, r[0]); f.p(10, 10, r[0])
    return f.done(P, floor_y=0)


def c_table(P):
    """유리 탁자(2×2): 흰 테 · 유리 윗면 · 사선 반사 2줄 · 짧은 다리 · 그림자."""
    gl, w = P["i2_glass"], P["i2_white"]
    f = F(2, 2)
    f.r(2, 4, 27, 20, w[1]); f.r(4, 6, 25, 18, gl[1]); f.r(4, 6, 25, 6, gl[2])
    f.line(8, 17, 15, 7, gl[2]); f.line(12, 17, 19, 7, gl[2])
    f.r(2, 21, 27, 22, w[0])
    f.r(3, 23, 5, 26, P["i2_gray"][1]); f.r(24, 23, 26, 26, P["i2_gray"][1])
    return f.done(P, floor_y=0)


def plant(P):
    """화분(1×2): 야자 잎 다섯 갈래가 화분 테에 거의 닿는다(줄기 2px), 흰 화분에 금색 테."""
    lf, w, gd = P["leaf"], P["i2_white"], P["i2_gold"]
    f = F(1, 2)
    for a, ln in ((-160, 7), (-120, 7), (-90, 6), (-60, 7), (-20, 7), (-180, 5), (0, 5)):
        rad = math.radians(a)
        for k in range(ln + 1):
            x = 8 + k * math.cos(rad); y = 15 + k * math.sin(rad) + 0.09 * k * k
            f.ell(x, y, 1.7, 1.4, lf[2] if a < -80 else lf[1])
            if k > 1:
                f.p(round(x - 0.5), round(y - 1), lf[3])
    f.r(7, 15, 8, 18, P["i2_wood"][0])
    f.r(4, 19, 11, 28, w[1]); f.r(4, 19, 11, 20, gd[1]); f.r(4, 21, 11, 21, gd[0]); f.r(4, 27, 11, 28, w[0]); f.r(5, 22, 5, 26, w[2])
    return f.done(P, floor_y=22)


def _stair_sides(f, P, metal: bool, y1: int, low: int = 0):
    """계단 양옆(4px): 나무는 옆판(윗면 밝은 1px) + 아래 끝 기둥, 금속은 주황 옆판 + 검은 손잡이 벨트.
    low>0 이면 옆판을 그 높이에서 시작한다(내려가는 계단: 바닥 높이 난간)."""
    if metal:
        o = P["i2_orange"]
        for x0, x1 in ((0, 3), (28, 31)):
            f.r(x0, low, x1, y1, o[1]); f.r(x0, low, x0, y1, o[2])
            f.r(x1, low, x1, y1, o[0])
        f.r(2, low, 3, y1 - 2, C(P, "i2_ol")); f.r(28, low, 29, y1 - 2, C(P, "i2_ol"))   # 손잡이 벨트(안쪽)
        f.r(3, low, 3, y1 - 2, P["i2_gray"][0]); f.r(29, low, 29, y1 - 2, P["i2_gray"][0])
        return
    t = P["i2_h_trim"]
    for x0 in (0, 28):
        f.r(x0, low, x0 + 3, y1, t[1]); f.r(x0, low, x0 + 3, low, t[3]); f.r(x0 + 1, low + 1, x0 + 2, y1, t[2]); f.r(x0 + 1, low + 1, x0 + 1, y1, t[3])
        f.r(x0, y1 - 9, x0 + 3, y1, t[1]); f.r(x0, y1 - 9, x0 + 3, y1 - 8, t[3]); f.r(x0 + 3, y1 - 7, x0 + 3, y1, t[0])   # 아래 끝 기둥(머리 밝음)


def stairs(P, side: str, metal: bool):
    """올라가는 계단(2×3, 뒷벽에 붙임): 0·1줄은 벽·벽 밑 바닥 줄을 덮고(불투명) 2줄 아래는 발 디딤(바닥이 비친다).
    아래 단일수록 높다(가까울수록 크다): 디딤판(밝은 앞 모서리) + 챌판(위 1px 그늘, 앞면 중간 톤)이 위로 갈수록 좁아지고
    맨 위 두 단은 어두워지며 천장 구멍(어둠)으로 들어간다. metal=True 는 센터 에스컬레이터(강철 홈 디딤판·주황 옆판·검은 벨트).
    빛은 왼쪽 위 — 그림자는 늘 오른쪽 아래(side 는 예전 호출과 맞추려 남긴다)."""
    f = F(2, 3)
    f.r(4, 0, 27, 7, C(P, "i2_void"))
    if metal:
        st = P["i2_steel"]
        tread, nose, rise, rsh = st[1], st[2], st[0], C(P, "i2_ol")
        f.r(4, 7, 27, 7, st[0])
    else:
        pl, t = P["i2_plank"], P["i2_h_trim"]
        tread, nose, rise, rsh = pl[3], P["i2_h_paper"][2], t[1], t[0]
    y = 8
    hs = (3, 4, 4, 5, 5, 6, 6)
    for i, h in enumerate(hs):
        dim = (0.6, 0.8)[i] if i < 2 else 1.0
        tr_ = (h + 1) // 2                                                      # 디딤판(위) · 챌판(아래)
        f.r(4, y, 27, y + tr_ - 1, px.tint(tread, dim)); f.r(4, y, 27, y, px.tint(nose, dim))
        if metal:
            for x in range(6, 27, 3):
                f.r(x, y + 1, x, y + tr_ - 1, px.tint(rise, dim))
        f.r(4, y + tr_, 27, y + h - 1, px.tint(rise, dim)); f.r(4, y + tr_, 27, y + tr_, px.tint(rsh, dim))
        if metal and h - tr_ > 1:
            for x in range(5, 27, 3):
                f.r(x, y + tr_ + 1, x, y + h - 1, px.tint(rsh, dim))
        y += h
    f.r(4, y, 27, y, px.tint(nose, 1.0) if not metal else P["i2_white"][2])  # 맨 아래 단 앞 모서리 = 바닥 높이
    _stair_sides(f, P, metal, y + 1)
    return f.done(P, floor_y=32)


def stairs_down(P, metal: bool):
    """내려가는 계단(2×3, 뒷벽에 붙임 — 올라가는 계단과 같은 자리): 벽과 벽 밑 줄에 뚫린 어두운 입구로 디딤판만 보이며 내려간다.
    챌판은 안쪽을 향해 보이지 않고, 단 사이는 어두운 틈, 깊을수록(위로 갈수록) 단이 좁아지고 어두워져 어둠에 묻힌다.
    양옆은 바닥 높이의 낮은 난간(위 두 줄을 덮는다), 2줄은 구멍 앞 바닥 턱과 난간 기둥 — 그 밖은 바닥이 비친다."""
    f = F(2, 3)
    vd = C(P, "i2_void")
    f.r(4, 0, 27, 33, vd)
    if metal:
        st = P["i2_steel"]
        tread, nose, gap = st[1], st[2], C(P, "i2_ol")
    else:
        pl = P["i2_plank"]
        tread, nose, gap = pl[3], P["i2_h_paper"][2], P["i2_h_trim"][0]
    y = 33
    for i, h in enumerate((6, 5, 4, 4, 3, 3, 2, 2)):                    # 아래(가까움)부터 위(깊음)로
        dim = (1.0, 0.86, 0.72, 0.6, 0.48, 0.38, 0.3, 0.24)[i]
        top = y - h
        f.r(4, top, 27, y - 1, px.tint(tread, dim)); f.r(4, top, 27, top, px.tint(nose, dim))
        if metal:
            for x in range(6, 27, 3):
                f.r(x, top + 1, x, y - 1, px.tint(st[0], dim))
        f.r(4, y - 1, 27, y - 1, px.tint(gap, max(dim, 0.5)) if i else gap)
        y = top
    f.r(4, 0, 27, 1, vd)
    # 구멍 앞 턱(바닥 높이): 밝은 모서리 + 앞면
    if metal:
        f.r(2, 34, 29, 35, P["i2_white"][2]); f.r(2, 36, 29, 37, st[0])
    else:
        t = P["i2_h_trim"]
        f.r(2, 34, 29, 34, t[3]); f.r(2, 35, 29, 37, t[1])
    _stair_sides(f, P, metal, 40, low=0)
    return f.done(P, floor_y=32)

# ---- 마트 가구 --------------------------------------------------------------------------------
_GOODS = ("i2_red", "i2_blue", "i2_yellow", "i2_green")


def _goods(f, P, x0, y0, x1, y1, w=3, h=3, seed=0):
    k = seed
    for y in range(y0, y1 - h + 2, h + 1):
        for x in range(x0, x1 - w + 2, w + 1):
            r = P[_GOODS[k % 4]]
            f.r(x, y, x + w - 1, y + h - 1, r[1]); f.r(x, y, x + w - 1, y, r[2]); f.r(x + w - 1, y + 1, x + w - 1, y + h - 1, r[0])
            k += 1
        k += 1


def m_fridge(P):
    """냉장 유리장(1×2, 뒷벽에 박힘 — 벽 높이를 다 쓴다): 강철 틀 · 유리 사선 반사 · 상품 칸 네 줄."""
    st, gl = P["i2_steel"], P["i2_glass"]
    f = F(1, 2)
    f.r(0, 4, 15, 30, st[1]); f.r(0, 4, 15, 5, st[2])
    f.r(2, 7, 13, 27, gl[0])
    _goods(f, P, 3, 8, 12, 26, 2, 3, seed=1)
    for y in (11, 15, 19, 23):
        f.r(2, y + 1, 13, y + 1, st[0])
    f.line(3, 26, 12, 9, gl[2])
    f.r(0, 28, 15, 30, st[0])
    return f.done(P, floor_y=31, shadow=False)


def m_freezer(P):
    """냉동 평대(2×2): 흰 뚜껑(유리로 상품 두 줄이 비친다) · 파란 앞면 · 받침."""
    w, gl, b = P["i2_white"], P["i2_glass"], P["i2_blue"]
    f = F(2, 2)
    f.r(1, 4, 28, 18, w[1]); f.r(1, 4, 28, 4, w[2])
    f.r(3, 6, 26, 16, gl[1]); _goods(f, P, 4, 7, 25, 15, 3, 3, seed=2); f.line(6, 15, 11, 7, gl[2])
    f.r(1, 19, 28, 26, b[1]); f.r(1, 19, 28, 19, b[2]); f.r(1, 26, 28, 26, b[0])
    f.r(1, 27, 28, 28, P["i2_gray"][0])
    return f.done(P, floor_y=0)


def m_gondola(P):
    """양면 진열대(2×2): 밝은 윗판 3px · 앞면 선반 두 단에 상품 · 아래 받침 · 그림자."""
    w, g = P["i2_white"], P["i2_gray"]
    f = F(2, 2)
    f.r(1, 2, 28, 6, w[2]); f.r(1, 7, 28, 8, g[1])
    f.r(1, 9, 28, 26, w[1])
    _goods(f, P, 3, 10, 26, 15, 3, 5, seed=3); f.r(1, 16, 28, 16, g[1])
    _goods(f, P, 3, 18, 26, 23, 3, 5, seed=5); f.r(1, 24, 28, 24, g[1])
    f.r(1, 25, 28, 27, g[0])
    return f.done(P, floor_y=0)

def m_counter(P):
    """계산대(3×2): 흰 윗면(하이라이트) · 나무 앞면 판 셋 · 위에 금전등록기(회색 몸체·초록 화면·영수증)."""
    w, wd, st = P["i2_white"], P["i2_wood"], P["i2_steel"]
    f = F(3, 2)
    f.r(1, 10, 44, 18, w[1]); f.r(1, 10, 44, 10, w[2])
    f.r(1, 19, 44, 28, wd[1]); f.r(1, 19, 44, 19, wd[2])
    for x0 in (3, 17, 31):
        f.r(x0, 21, x0 + 11, 26, wd[2]); f.r(x0 + 1, 22, x0 + 10, 25, wd[1])
    f.r(30, 3, 41, 13, st[1]); f.r(30, 3, 41, 4, st[2]); f.r(32, 6, 39, 9, P["i2_green"][1]); f.r(33, 7, 36, 7, P["i2_green"][2])
    f.r(35, 0, 39, 2, w[2])
    return f.done(P, floor_y=0)

def m_box(P):
    """골판지 상자(1×1): 윗면 날개 · 테이프 · 앞면."""
    b = P["i2_card"]
    f = F(1, 1)
    f.r(1, 2, 12, 6, b[2]); f.r(6, 2, 7, 6, b[1]); f.r(1, 7, 12, 12, b[1]); f.r(1, 7, 12, 7, b[0])
    f.r(4, 9, 9, 10, b[2])
    return f.done(P, floor_y=0)


def m_poster(P):
    """포스터(1×2 캔버스, 벽 위)."""
    """상품 광고(L1 N23 — 빨간 십자가 구급·센터 표지로 읽혔다): 흰 종이에 파란 상단 띠, 가운데 약병(보라 병 · 흰 뚜껑 · 노란 라벨) 그림, 아래 가격 줄."""
    f = F(1, 2)
    b, y_, w, g = P["i2_blue"], P["i2_yellow"], P["i2_white"], P["i2_gray"]
    f.r(2, 8, 13, 24, w[2]); f.r(2, 8, 13, 10, b[1])
    f.r(6, 11, 9, 12, w[1]); f.r(6, 11, 9, 11, w[2])                         # 병뚜껑
    f.r(5, 13, 10, 20, P["g2_lav"][1]); f.r(5, 13, 6, 20, P["g2_lav"][2])       # 병 몸(왼쪽 빛)
    f.r(5, 15, 10, 17, y_[1])                                                   # 라벨
    f.r(4, 22, 11, 22, g[1])
    return f.done(P, shadow=False)


# ---- 집 가구 ----------------------------------------------------------------------------------
def h_kitchen(P):
    """부엌 조리대(3×2, 뒷벽 걸레받이를 덮는다): 흰 상판 · 개수대와 수도꼭지 · 화구 둘 · 앞 찬장 문과 손잡이."""
    w, st, wd = P["i2_white"], P["i2_steel"], P["i2_wood"]
    f = F(3, 2)
    f.r(0, 8, 47, 18, w[1]); f.r(0, 8, 47, 8, w[2])
    f.r(4, 10, 17, 16, st[1]); f.r(5, 11, 16, 15, st[0]); f.r(5, 11, 16, 11, P["i2_glass"][1])          # 개수대
    f.r(10, 4, 11, 10, st[1]); f.r(8, 4, 11, 5, st[2])                                                   # 수도꼭지
    for cx in (30, 40):
        f.ell(cx, 13, 3.5, 2.6, P["i2_gray"][0]); f.ell(cx, 13, 2, 1.3, P["i2_gray"][2])
    f.r(0, 19, 47, 29, wd[1]); f.r(0, 19, 47, 19, wd[2])
    for x0 in (1, 17, 33):
        f.r(x0, 21, x0 + 13, 28, wd[2]); f.r(x0 + 1, 22, x0 + 12, 27, wd[1]); f.r(x0 + 11, 24, x0 + 11, 25, P["i2_gold"][1])
    return f.done(P, floor_y=19)


def h_cupboard(P):
    """찬장(1×2): 노란 윗면 · 유리문(사선 반사, 접시) · 아래 서랍 둘."""
    wd, gl = P["i2_wood"], P["i2_glass"]
    f = F(1, 2)
    f.r(1, 0, 14, 3, P["i2_yellow"][1]); f.r(1, 0, 14, 0, P["i2_yellow"][2])
    f.r(1, 4, 14, 29, wd[1])
    f.r(3, 6, 12, 16, gl[1]); f.r(7, 6, 8, 16, wd[1]); f.line(4, 15, 6, 7, gl[2])
    for y in (9, 13):
        f.r(3, y, 12, y, P["i2_white"][1])
    for y in (19, 24):
        f.r(3, y, 12, y + 3, wd[2]); f.r(7, y + 1, 8, y + 1, P["i2_gold"][1])
    return f.done(P, floor_y=16)


def h_fridge(P):
    """냉장고(1×2): 흰 몸체, 위 냉동칸 문과 아래 냉장칸 문, 세로 손잡이."""
    w = P["i2_white"]
    f = F(1, 2)
    f.r(1, 1, 14, 29, w[1]); f.r(1, 1, 14, 2, w[2]); f.r(2, 3, 2, 27, w[2])
    f.r(1, 10, 14, 10, w[0]); f.r(11, 4, 12, 8, P["i2_gray"][1]); f.r(11, 13, 12, 20, P["i2_gray"][1])
    return f.done(P, floor_y=16)


def h_tv(P):
    """TV(1×2): 회색 몸체 · 화면 반사 · 받침대(유리 수납)."""
    g, gl, wd = P["i2_gray"], P["i2_glass"], P["i2_wood"]
    f = F(1, 2)
    f.r(1, 5, 14, 18, g[1]); f.r(1, 5, 14, 5, g[2]); f.r(3, 7, 12, 15, gl[0]); f.r(4, 8, 11, 14, gl[1]); f.line(5, 13, 8, 9, gl[2])
    f.p(13, 17, P["i2_red"][1])
    f.r(1, 19, 14, 29, wd[1]); f.r(1, 19, 14, 19, wd[2]); f.r(3, 22, 12, 27, gl[0]); f.line(4, 26, 6, 23, gl[1])
    return f.done(P, floor_y=16)


def h_table(P):
    """식탁(2×2): 파랑·흰 체크 식탁보가 상판을 덮고 앞으로 늘어진다 · 다리 넷."""
    b, w = P["i2_blue"], P["i2_white"]
    f = F(2, 2)
    for y in range(4, 22):
        for x in range(3, 29):
            f.p(x, y, b[1] if ((x - 3) // 3 + (y - 4) // 3) % 2 else w[2])
    f.r(3, 4, 28, 4, w[2])
    f.r(3, 19, 28, 21, b[0])
    for x in (4, 26):
        f.r(x, 22, x + 1, 27, P["i2_wood"][0])
    return f.done(P, floor_y=0)


def h_chair(P, face: str):
    """3/4 시점 의자(1×1): 앉는 면(윗면 하이라이트) + 바깥쪽 등받이 띠(세로, 앉는 면보다 높다) · 짧은 다리. 식탁 쪽 변이 칸 끝에 붙는다.
    face: 식탁이 있는 쪽(r/l)."""
    """위에서 본 방석 의자(L1 N24 — 등받이 옆모습이라 식탁 3/4 와 시점이 섞였다): 둥근 방석 윗면(빛 받는 왼쪽 위) + 앞면 3px(나무 테두리)."""
    wd, y_ = P["i2_wood"], P["i2_yellow"]
    f = F(1, 1)
    f.r(3, 4, 13, 10, wd[2]); f.r(3, 11, 13, 13, wd[1]); f.r(4, 14, 5, 14, wd[0]); f.r(11, 14, 12, 14, wd[0])   # 의자 윗판 + 앞면 3px + 다리 끝
    f.ell(8, 7, 4.2, 2.6, y_[1]); f.ell(7, 6.4, 2.6, 1.4, y_[2])                                                   # 방석
    im = f.done(P, floor_y=0, sx=1, sy=1)
    return im if face == "r" else px.mirror(im)

def h_rug(P):
    """초록 깔개(6×4, 걸을 수 있다): 테두리 한 줄에 점무늬, 안은 단색 두 톤."""
    g = P["i2_green"]
    f = F(6, 4)
    f.r(0, 0, 95, 63, g[0]); f.r(2, 2, 93, 61, g[1]); f.r(6, 6, 89, 57, g[2]); f.r(7, 7, 88, 56, g[1])
    for x in range(5, 92, 4):
        f.p(x, 3, g[2]); f.p(x, 60, g[2])
    for y in range(5, 60, 4):
        f.p(3, y, g[2]); f.p(92, y, g[2])
    return f.done(P, outline=False, shadow=False)


def h_window(P):
    """커튼 창(2×2 캔버스, 벽 위): 하늘 유리 · 십자 창살 · 양옆으로 묶은 노란 커튼 · 창턱 그늘."""
    gl, y_ = P["i2_glass"], P["i2_yellow"]
    f = F(2, 2)
    f.r(6, 6, 25, 21, P["i2_white"][2]); f.r(8, 8, 23, 20, gl[1]); f.r(15, 8, 16, 20, P["i2_white"][2]); f.r(8, 14, 23, 14, P["i2_white"][2])
    f.line(10, 19, 13, 9, gl[2])
    for x0, d in ((4, 1), (27, -1)):
        f.r(min(x0, x0 + 2 * d), 5, max(x0, x0 + 2 * d), 12, y_[1]); f.r(min(x0, x0 + d), 13, max(x0, x0 + d), 20, y_[1])
    f.r(4, 4, 27, 5, y_[2])
    f.r(5, 22, 26, 22, P["i2_gray"][1])
    return f.done(P, shadow=False)


def h_clock(P):
    f = F(1, 1)
    f.ell(8, 8, 5.5, 5.5, P["i2_wood"][1]); f.ell(8, 8, 4, 4, P["i2_white"][2])
    f.r(8, 5, 8, 8, P["i2_ol"][0]); f.r(8, 8, 10, 8, P["i2_ol"][0])
    return f.done(P, shadow=False)


def h_bin(P):
    f = F(1, 1)
    f.ell(8, 5, 4.5, 2, P["i2_gray"][2]); f.r(4, 5, 12, 13, P["i2_gray"][1]); f.r(5, 6, 5, 12, P["i2_gray"][2]); f.ell(8, 5, 3, 1, P["i2_gray"][0])
    return f.done(P, floor_y=0)


def h_mat(P):
    """계단 발치 연어색 매트(1×1, 걷는다): 두 톤 + 양 끝 술."""
    o = P["i2_salmon"]
    f = F(1, 1)
    f.r(2, 3, 13, 12, o[0]); f.r(3, 4, 12, 11, o[1]); f.r(5, 6, 10, 9, o[2])
    for y in range(4, 12, 2):
        f.p(1, y, o[1]); f.p(14, y, o[1])
    return f.done(P, outline=False, shadow=False)

def h_bed(P):
    """침대(2×2): 나무 머리판(윗면 밝음 · 양 기둥) · 흰 시트와 베개(아래 그늘) · 파란 이불(위로 접힌 흰 단, 왼쪽 빛 · 앞면 진한 띠) · 발치 나무 틀."""
    t, b, w = P["i2_h_trim"], P["i2_blue"], P["i2_white"]
    f = F(2, 2)
    f.r(2, 0, 29, 6, t[2]); f.r(2, 0, 29, 0, t[3]); f.r(2, 6, 29, 6, t[1])      # 머리판
    f.r(2, 0, 4, 8, t[1]); f.r(2, 0, 4, 0, t[3]); f.r(27, 0, 29, 8, t[1]); f.r(27, 0, 29, 0, t[3])
    f.r(4, 7, 27, 27, w[1]); f.r(4, 7, 4, 27, w[2])                              # 시트
    f.r(8, 8, 23, 12, w[2]); f.r(8, 12, 23, 12, w[0]); f.r(8, 8, 8, 11, w[2])    # 베개
    f.r(4, 14, 27, 15, w[2]); f.r(4, 16, 27, 16, w[0])                           # 접힌 단
    f.r(4, 17, 27, 26, b[1]); f.r(4, 17, 5, 26, b[2]); f.r(26, 17, 27, 26, b[0]) # 이불
    f.r(4, 27, 27, 28, b[0])
    f.r(2, 27, 29, 30, t[1]); f.r(2, 27, 29, 27, t[2]); f.r(2, 30, 29, 30, t[0])  # 발치 틀
    return f.done(P, floor_y=0)


def h_shelf(P):
    """책장(1×2, 뒷벽에 붙여 위 칸이 벽을 덮는다): 나무 틀 · 세 칸 · 색 책."""
    wd = P["i2_wood"]
    f = F(1, 2)
    f.r(1, 2, 14, 29, wd[0]); f.r(2, 3, 13, 28, wd[1])
    k = 0
    for y0 in (4, 12, 20):
        f.r(2, y0 + 7, 13, y0 + 7, wd[2])
        x = 3
        while x < 13:
            r = P[_GOODS[k % 4]]
            h = 5 + (k % 2)
            f.r(x, y0 + 7 - h, x + 1, y0 + 6, r[1]); f.p(x, y0 + 7 - h, r[2])
            x += 2 + (k % 3 == 0); k += 1
    return f.done(P, floor_y=16)


FURNITURE = {
    # 이름: (그리는 함수, 종류) — 종류 prop=막힘, decor=걷는다, wallart=벽 위 장식(벽이라 막힘)
    "c_counter": (c_counter, "prop"), "c_healer": (c_healer, "prop"), "c_pc": (c_pc, "prop"), "c_screen": (c_screen, "prop"),
    "c_sofa_y": (lambda P: c_sofa(P, "i2_yellow"), "prop"), "c_sofa_b": (lambda P: c_sofa(P, "i2_blue"), "prop"),
    "c_table": (c_table, "prop"), "plant2": (plant, "prop"),
    "c_escalator": (lambda P: stairs(P, "l", True), "prop"), "h_stairs": (lambda P: stairs(P, "r", False), "prop"),
    "m_fridge": (m_fridge, "prop"), "m_freezer": (m_freezer, "prop"), "m_gondola": (m_gondola, "prop"), "m_counter": (m_counter, "prop"),
    "m_box": (m_box, "prop"), "m_poster": (m_poster, "prop"),
    "h_kitchen": (h_kitchen, "prop"), "h_cupboard": (h_cupboard, "prop"), "h_fridge": (h_fridge, "prop"), "h_tv": (h_tv, "prop"),
    "h_table": (h_table, "prop"), "h_chair_r": (lambda P: h_chair(P, "r"), "prop"), "h_chair_l": (lambda P: h_chair(P, "l"), "prop"),
    "h_rug": (h_rug, "decor"), "h_window": (h_window, "prop"), "h_clock": (h_clock, "prop"), "h_bin": (h_bin, "prop"),
    "h_mat": (h_mat, "decor"), "h_bed": (h_bed, "prop"), "h_shelf": (h_shelf, "prop"),
}


# ---- 실내 3차: 층계 내려가기 · 2층 침실 · 거실 가구 (시트 끝에 덧붙는 새 칸 — 크기는 계약, 그림은 다듬는다) ----
def h_desk(P):
    """책상(2×2, 뒷벽에 붙임 — 윗줄이 벽 아랫칸을 덮는다): 나무 상판(앞 모서리 밝음) 위 흰 모니터(파란 화면 반사)와 자판,
    왼쪽은 무릎 들어가는 어두운 빈칸 + 다리, 오른쪽은 서랍 둘 받침."""
    wd, w, gl = P["i2_wood"], P["i2_white"], P["i2_glass"]
    f = F(2, 2)
    f.r(1, 15, 30, 19, wd[2]); f.r(1, 19, 30, 20, wd[1])                       # 상판 + 앞 모서리
    f.r(1, 21, 30, 29, wd[1]); f.r(5, 21, 18, 29, CLEAR)                       # 앞면, 무릎 자리는 비운다
    f.r(5, 21, 18, 22, wd[0])                                                   # 상판 밑 그늘
    f.r(2, 21, 4, 29, wd[1]); f.r(2, 21, 2, 29, wd[2])                          # 왼쪽 다리
    f.r(19, 21, 30, 29, wd[1]); f.r(19, 21, 19, 29, wd[2])                      # 서랍 받침
    for y0 in (22, 26):
        f.r(21, y0, 29, y0 + 2, wd[2]); f.r(21, y0 + 2, 29, y0 + 2, wd[0]); f.r(24, y0 + 1, 26, y0 + 1, P["i2_gold"][1])
    f.r(4, 2, 19, 13, w[1]); f.r(4, 2, 19, 2, w[2]); f.r(4, 3, 4, 12, w[2]); f.r(4, 13, 19, 13, w[0])   # 모니터
    f.r(6, 4, 17, 11, gl[0]); f.r(7, 5, 16, 10, P["i2_blue"][1]); f.line(8, 9, 11, 5, gl[2]); f.p(13, 9, gl[1])
    f.r(10, 14, 13, 15, P["i2_gray"][1])                                         # 받침
    f.r(6, 16, 18, 17, P["i2_gray"][2]); f.r(6, 17, 18, 17, P["i2_gray"][1])    # 자판
    f.r(22, 13, 27, 17, P["i2_yellow"][1]); f.r(22, 13, 27, 13, P["i2_yellow"][2]); f.r(23, 15, 26, 15, P["i2_yellow"][0])   # 책 묶음
    return f.done(P, floor_y=20)


def h_console(P):
    """게임기(1×1, 바닥): 회색 본체(윗면 밝음 · 앞면 · 빨간 불) + 줄로 이은 조이패드."""
    g, r = P["i2_gray"], P["i2_red"]
    f = F(1, 1)
    f.r(1, 5, 9, 8, g[2]); f.r(1, 9, 9, 11, g[1]); f.r(3, 6, 7, 6, g[1])        # 본체 윗면(카트리지 홈) + 앞면
    f.p(2, 10, r[1]); f.r(5, 10, 7, 10, g[0])
    f.line(9, 7, 11, 9, g[0])                                                    # 줄
    f.r(10, 10, 14, 13, P["g2_lav"][1]); f.r(10, 10, 14, 10, P["g2_lav"][2])    # 패드
    f.p(11, 11, P["g2_lav"][3]); f.p(13, 12, r[1])
    return f.done(P, floor_y=0, sx=1, sy=1)


def h_wardrobe(P):
    """옷장(1×2, 뒷벽에 붙임): 나무 윗면 · 문 두 짝(왼쪽 빛 받는 테) · 금 손잡이 · 아래 받침."""
    t = P["i2_h_trim"]
    f = F(1, 2)
    f.r(1, 1, 14, 3, t[3]); f.r(1, 4, 14, 29, t[2]); f.r(1, 4, 14, 4, t[1])
    for x0 in (2, 8):
        f.r(x0, 6, x0 + 5, 25, t[2]); f.r(x0, 6, x0, 25, t[3]); f.r(x0 + 5, 6, x0 + 5, 25, t[1]); f.r(x0, 25, x0 + 5, 25, t[1])
    f.r(8, 5, 8, 26, t[0])                                                       # 문 사이
    f.r(6, 14, 6, 16, P["i2_gold"][1]); f.r(10, 14, 10, 16, P["i2_gold"][1])
    f.r(1, 27, 14, 29, t[1]); f.r(1, 29, 14, 29, t[0])
    return f.done(P, floor_y=16)


def h_poster(P):
    """벽 포스터(1×1, 벽 윗칸): 흰 종이 · 하늘과 초록 언덕 · 해 — 위 모서리 압정."""
    w, gl, g = P["i2_white"], P["i2_glass"], P["i2_green"]
    f = F(1, 1)
    f.r(3, 4, 12, 14, w[2]); f.r(4, 5, 11, 12, gl[1]); f.r(4, 5, 11, 5, gl[2])
    for x in range(4, 12):                                                       # 언덕 두 개(그림 칸 안에서만)
        h1 = round(3.2 * math.sqrt(max(0, 1 - ((x - 9.5) / 4.5) ** 2)))
        h2 = round(2.2 * math.sqrt(max(0, 1 - ((x - 5) / 3.2) ** 2)))
        if h1: f.r(x, 13 - h1, x, 12, g[1])
        if h2: f.r(x, 13 - h2, x, 12, g[2])
    f.r(5, 6, 6, 7, P["i2_yellow"][1])
    f.r(3, 13, 12, 14, w[0]); f.r(3, 13, 12, 13, w[2])
    return f.done(P, shadow=False)


def h_lamp(P):
    """스탠드(1×2): 크림 갓(위 좁고 아래 넓다, 왼쪽 밝음) · 가는 기둥 · 둥근 받침."""
    y_, g = P["i2_yellow"], P["i2_gray"]
    f = F(1, 2)
    for k, y in enumerate(range(5, 13)):
        hw = 3 + k // 2
        f.r(8 - hw, y, 7 + hw, y, y_[2]); f.p(8 - hw, y, P["i2_white"][2]); f.p(7 + hw, y, y_[1])
    f.r(3, 12, 12, 12, y_[1])
    f.r(7, 13, 8, 27, g[1]); f.r(7, 13, 7, 27, g[2])
    f.r(4, 27, 11, 29, g[1]); f.r(4, 27, 11, 27, g[2]); f.r(4, 29, 11, 29, g[0])
    return f.done(P, floor_y=24)


def h_sofa(P):
    """소파(2×1, 앞을 보고 벽에 붙임, 3/4): 등받이 윗면 · 등받이 앞면 · 방석 둘(윗면 밝음) · 앞 치마 · 양 팔걸이."""
    r = P["i2_red"]
    f = F(2, 1)
    f.r(2, 0, 29, 1, r[2]); f.r(2, 2, 29, 6, r[1])                              # 등받이
    f.r(4, 7, 27, 10, r[2]); f.r(15, 7, 16, 10, r[1]); f.r(4, 7, 27, 7, P["i2_salmon"][2])   # 방석 윗면
    f.r(4, 11, 27, 13, r[0]); f.r(4, 11, 27, 11, r[1])                           # 앞 치마
    for x0 in (0, 27):
        f.r(x0, 3, x0 + 4, 13, r[1]); f.r(x0, 3, x0 + 4, 4, r[2]); f.r(x0 + 4, 5, x0 + 4, 13, r[0]) if x0 == 0 else f.r(x0, 5, x0, 13, r[0])
    f.r(2, 14, 4, 14, P["i2_wood"][0]); f.r(27, 14, 29, 14, P["i2_wood"][0])    # 다리
    return f.done(P, floor_y=0, sx=1, sy=1)


FURNITURE3 = {
    # 이름: (그리는 함수, 종류) — 크기(칸): h_stairs_dn 2×3 · c_escalator_dn 2×3 · h_desk 2×2 · h_console 1×1 · h_wardrobe 1×2 · h_poster 1×1 · h_lamp 1×2 · h_sofa 2×1
    "h_stairs_dn": (lambda P: stairs_down(P, False), "stairs"), "c_escalator_dn": (lambda P: stairs_down(P, True), "stairs"),
    "h_desk": (h_desk, "prop"), "h_console": (h_console, "prop"), "h_wardrobe": (h_wardrobe, "prop"),
    "h_poster": (h_poster, "prop"), "h_lamp": (h_lamp, "prop"), "h_sofa": (h_sofa, "prop"),
}
