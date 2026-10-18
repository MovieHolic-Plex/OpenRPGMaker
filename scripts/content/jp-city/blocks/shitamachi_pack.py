#!/usr/bin/env python3
"""jp_city 블록 `shitamachi_pack` - 시타마치 골목·상점가(쇼텐가이) 바깥 거리 손 도트 팩.

2026-10-18 사용자: 「이런 식의 일본 실외도 만들 수 있음 좋겠군」 - 참고 그림 두 장(.herdr-web-ui/paste-20261017-181615 / -181623).
참고에서 가져온 것(그림을 베끼지 않고 우리 modern3 램프로 다시 그렸다):
  - 바닥: 얼음색 콘크리트 대신 따뜻한 테라코타 벽돌 보도(황토 벽돌 섞임)·흙빛 회갈색 아스팔트, 맨홀·빗물받이, 45° 사선 그림자.
  - 빈틈 없는 건물 띠: 청과물 가게·붉은 벽돌 이자카야·줄무늬 차양 자판기 골목, 앞줄 옥상(난간·위성 안테나)·골목 계단과 느티나무·골기와 발코니 집.
  - 상점가: 코인 주차(P 간판·주차선·정산기·비상계단)·붉은 함석 아케이드 차양(기둥 6개·파란 깃발)·大門通 아치(채광 볼트·우체통)·전신주(변압기 2개)·버스 정류장.
화풍: 다른 jp_city 블록과 같다 - modern3 램프만, sumi 윤곽, 빛 왼쪽 위·그림자 오른쪽 아래, 3/4 정면 고정. 간판 글자는 읽히지 않는 획(상표 없음).
키트 칸: 위층 그림(up)은 키트 grid, 바닥 그림(base)은 키트 base(1층, 걷는 바닥) - 주차장 아스팔트·아케이드 바닥·골목 계단.
번호: bake_jp.BLOCK_ORDER 끝에 붙어 앞 번호(핀)는 그대로, 새 칸은 시트 끝에 붙는다.

  python3 scripts/content/jp-city/blocks/shitamachi_pack.py [OUT_DIR]   # selftest + 키트·바닥 미리보기(1x, 2x)
"""
import collections, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'houses')); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
from PIL import Image  # noqa: E402
from house_kit import K, Cv, OL  # noqa: E402

BLOCK = 'shitamachi_pack'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)
SUMI2 = K('sumi', 1)


def H(x, y, s=0):
    """칸 좌표 해시 0..1(시드 고정)."""
    n = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF


# ═══════════════════════════ 바닥 질감 ═══════════════════════════
# 판석 보도 밝기 단(높을수록 밝다): 차가운 회색(conc)과 따뜻한 베이지(kinari)를 화소마다 섞어 따뜻한 밝은 회색(≈#b8b4aa)을 만든다 — 팔레트에 그 색이 없다.
_SLAB_LV = {2: (('conc', 2), ('kinari', 1)), 1: (('conc', 1), ('kinari', 0)), 0: (('conc', 0), ('kinari', -1)),
            -1: (('conc', -1), ('kinari', -1)), -2: (('conc', -2), ('kinari', -2)), -3: (('tekko', -1), ('kinari', -2)), -4: (('tekko', -2), ('tekko', -1))}


def _slab_col(lv, x, y, warm, seed):
    cool, hot = _SLAB_LV[max(-4, min(2, lv))]
    r, t = hot if H(x, y, 31 + seed) < warm else cool
    return K(r, t)


def slab_px(x, y, shade=0, seed=0, tone=0.0):
    """콘크리트 판석 보도(8×8 판, 이음 1px) 한 화소 - 16px 주기로 이음새 없다. 판마다 따뜻함(베이지 섞는 비율)이 조금 다르다.
    2026-10-18 사용자 반려 「붉은 벽돌 저거 '바닥' 으로 쓰는 게 아니라 '벽' 으로 써야함」: 일본 보도는 밝은 회베이지 콘크리트 판석이다(붉은 벽돌은 벽에만).
    tone>0 이면 그만큼 판을 갈아 끼운 밝은 판(보수 자국)이 섞인다. shade>0 이면 그만큼 어둡게."""
    x %= 16; y %= 16
    sx, sy = x // 8, y // 8
    if x % 8 == 7 or y % 8 == 7:
        return _slab_col(-1 - shade, x, y, 0.7, seed)
    h = H(sx, sy, 17 + seed)
    warm = 0.38 + 0.24 * h
    lv = 1
    if h < tone: lv = 2 if H(sx, sy, 5 + seed) < 0.5 else 1; warm = 0.75 if lv == 1 else 0.3
    if x % 8 == 0 or y % 8 == 0: lv += 1                     # 판 윗변·왼변 빛(왼쪽 위)
    if x % 8 == 6 or y % 8 == 6: lv -= 1                     # 판 아랫변·오른변 그늘
    return _slab_col(lv - shade, x, y, warm, seed)


def asph_px(x, y, shade=0, seed=0):
    """어두운 따뜻한 아스팔트(≈#3a3d45) - 먹회색(tekko -2) 바탕에 밝은 골재 알갱이·갈색 알갱이를 드문드문.
    2026-10-18 사용자 반려 후: 밝은 회갈색 아스팔트는 판석 보도와 대비가 약했다 -> 한 단 어둡게."""
    h = H(x % 16, y % 16, 77 + seed)
    if h < 0.66: c = ('tekko', -2)
    elif h < 0.84: c = ('tekko', -1)
    elif h < 0.93: c = ('ita', -2)
    elif h < 0.985: c = ('tekko', -3)
    else: c = ('tekko', 0)
    return K(c[0], c[1] - shade)


def tile_px(x, y, shade=0):
    """아케이드 통로 청회색 타일(8px 격자)."""
    if x % 8 == 7 or y % 8 == 7: return K('tairu', -1 - shade)
    t = 1 if ((x // 8) + (y // 8)) % 2 else 0
    if y % 8 == 0 and x % 8 < 6: t += 1
    return K('tairu', t - shade)


def fill_tex(c, x0, y0, w, h, fn, **kw):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w): c.P(x, y, fn(x, y, **kw))


def shade_poly(c, x0, y0, w, h, inside, fn, s=1, **kw):
    """사선 그림자: inside(x,y) 가 참인 화소만 s 단 어두운 질감으로 다시 칠한다."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if inside(x - x0, y - y0): c.P(x, y, fn(x, y, shade=s, **kw))


# ═══════════════════════════ 그리기 부품 ═══════════════════════════
def outline_rect(c, x, y, w, h, col=OL):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def disc(c, cx, cy, r, col, ry=None):
    ry = r if ry is None else ry
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1.0: c.P(x, y, col)


def line(c, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        c.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col)


def kawara(c, x0, y0, w, h, ramp, t=0, ridge=True):
    """골기와 지붕(3/4 윗면): 세로 골 4px · 가로 단 4px · 위 용마루 · 아래 처마."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            k = (x - x0) % 4; r = (y - y0) % 4
            tt = t + (1 if k == 0 else -1 if k == 3 else 0)
            if r == 3: tt -= 1
            if r == 0 and k < 3: tt += 1
            c.P(x, y, K(ramp, tt))
    if ridge:
        c.HL(x0, y0, w, OL); c.HL(x0, y0 + 1, w, K(ramp, t + 2)); c.HL(x0, y0 + 2, w, K(ramp, t - 2))
    c.HL(x0, y0 + h - 2, w, K(ramp, t - 2)); c.HL(x0, y0 + h - 1, w, OL)


def flat_roof(c, x0, y0, w, h, ramp='conc', t=0, seed=0):
    """평지붕 윗면: 8px 방수 판 이음매·얼룩, 뒷모서리 OL, 앞 난간 턱."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            v = H(x, y, seed)
            tt = t + (1 if v < 0.12 else -1 if v > 0.93 else 0)
            if (x - x0) % 10 == 9 or (y - y0) % 8 == 7: tt = t - 1
            c.P(x, y, K(ramp, tt))
    c.HL(x0, y0, w, OL); c.HL(x0, y0 + 1, w, K(ramp, t + 2))
    c.HL(x0, y0 + h - 3, w, K(ramp, t + 2)); c.HL(x0, y0 + h - 2, w, K(ramp, t - 1)); c.HL(x0, y0 + h - 1, w, OL)


def plaster(c, x0, y0, w, h, ramp='kinari', t=0, seed=1):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            v = H(x, y, seed)
            c.P(x, y, K(ramp, t - 1 if v > 0.9 else t + 1 if v < 0.05 else t))
    c.VL(x0, y0, h, K(ramp, t + 1)); c.VL(x0 + w - 1, y0, h, K(ramp, t - 2))


def corrugated(c, x0, y0, w, h, ramp='conc', t=0):
    for x in range(x0, x0 + w):
        k = (x - x0) % 4
        c.VL(x, y0, h, K(ramp, t + (1 if k == 0 else -1 if k == 3 else 0)))


def brick_wall(c, x0, y0, w, h, ramp='renga', t=0, bw=6, bh=3, seed=3):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            row = (y - y0) // bh; off = bw // 2 if row % 2 else 0
            if (y - y0) % bh == bh - 1 or (x - x0 + off) % bw == bw - 1: c.P(x, y, K(ramp, t - 2)); continue
            v = H((x - x0 + off) // bw, row, seed)
            tt = t + (1 if v < 0.25 else -1 if v > 0.8 else 0)
            if (y - y0) % bh == 0: tt += 1
            c.P(x, y, K(ramp, tt))
    c.VL(x0, y0, h, K(ramp, t + 2)); c.VL(x0 + w - 1, y0, h, K(ramp, t - 3))


def window(c, x, y, w, h, lit=False, bars=False):
    outline_rect(c, x, y, w, h, K('tekko', -2))
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            if lit: col = K('mado', 1 if (i + j) % 7 else 2)
            else: col = K('garasu', 1 if i + j < 6 else (0 if j < h // 2 else -1))
            c.P(x + i, y + j, col)
    if not lit:
        for k in range(min(w, h) - 3): c.P(x + 2 + k, y + h - 3 - k, K('garasu', 2)) if k % 3 != 2 else None
    c.VL(x + w // 2, y + 1, h - 2, K('tekko', -1))
    if bars:
        for i in range(x + 2, x + w - 1, 3): c.VL(i, y + 1, h - 2, K('tekko', 1))
    c.HL(x - 1, y + h, w + 2, K('conc', 2)); c.HL(x - 1, y + h + 1, w + 2, K('conc', -1))


def awning(c, x0, y0, w, h, ramp, t=0, stripe=None, sw=4):
    """비탈 차양: 위 밝은 줄 -> 아래로 어두워짐, 줄무늬(stripe 램프), 물결 끝단."""
    body = h - 3
    for y in range(y0, y0 + body):
        dt = 1 if y - y0 < 2 else (0 if y - y0 < body - 2 else -1)
        for x in range(x0, x0 + w):
            st = stripe and ((x - x0) // sw) % 2
            c.P(x, y, K(stripe, dt + 1) if st else K(ramp, t + dt))
    c.HL(x0, y0, w, OL)
    for x in range(x0, x0 + w):
        k = (x - x0) % 6
        depth = 3 if 1 <= k <= 4 else 2 if k in (0, 5) else 1
        st = stripe and ((x - x0) // sw) % 2
        for j in range(depth - 1): c.P(x, y0 + body + j, K(stripe, 0) if st else K(ramp, t - 1))
        c.P(x, y0 + body + depth - 1, OL)


def glyphs(c, x, y, n, col, size=6, seed=0, gap=2, vertical=False):
    """읽히지 않는 한자풍 획(간판). 글자 칸 size×size 를 n 개."""
    for g in range(n):
        gx = x + (0 if vertical else g * (size + gap)); gy = y + (g * (size + gap) if vertical else 0)
        v = [H(g, k, seed) for k in range(6)]
        c.HL(gx, gy + 1 + int(v[0] * 2), size, col)
        c.VL(gx + 1 + int(v[1] * (size - 2)), gy, size, col)
        if v[2] > 0.35: c.HL(gx + 1, gy + size - 2, size - 2, col)
        if v[3] > 0.5: line(c, gx + size // 2, gy + size // 2, gx + size - 1, gy + size - 1, col)
        if v[4] > 0.4: line(c, gx + size // 2, gy + size // 2, gx, gy + size - 1, col)
        if v[5] > 0.6: c.VL(gx + size - 2, gy + 1, size - 2, col)


PRODUCE = [('daidai', 'o'), ('aka', 'o'), ('shiba', 'c'), ('kii', 'b'), ('aka', 's'), ('shiro', 'd'), ('murasaki', 'o'), ('yuka', 'o'), ('midori', 's'), ('daidai', 's')]


def crate(c, x, y, w, h, prod, box='ita', seed=0):
    """나무(또는 플라스틱) 상자 + 위에 수북한 청과. prod=(램프, 모양): o 둥근 과일, c 양배추, b 바나나, s 작은 알, d 무."""
    ramp, kind = prod
    c.R(x, y + 3, w, h - 3, K(box, 1)); c.HL(x, y + 3, w, K(box, 2)); c.HL(x, y + h - 1, w, K(box, -1))
    for j in range(y + 5, y + h - 1, 3): c.HL(x + 1, j, w - 2, K(box, 0))
    c.VL(x, y + 3, h - 3, K(box, -2)); c.VL(x + w - 1, y + 3, h - 3, K(box, -2))
    if kind == 'c':
        for i in range(x + 1, x + w - 1, 4):
            disc(c, i + 1.5, y + 2.5, 2.2, K(ramp, 0)); c.P(i + 1, y + 1, K(ramp, 2)); c.P(i + 2, y + 3, K(ramp, -1))
    elif kind == 'b':
        for i in range(x + 1, x + w - 2, 3):
            c.HL(i, y + 1, 3, K(ramp, 1)); c.HL(i, y + 2, 3, K(ramp, 0)); c.P(i, y + 3, K(ramp, -1))
    elif kind == 'd':
        for i in range(x + 1, x + w - 1, 2):
            c.VL(i, y + 1, 3, K(ramp, 1)); c.P(i, y, K('ki', 1))
    else:
        big = kind == 'o'
        step = 3 if big else 2
        for j in range(y, y + 4, step):
            for i in range(x + 1 + (j // step) % 2, x + w - 1, step):
                c.P(i, j + 1, K(ramp, 0)); c.P(i, j, K(ramp, 1 + (H(i, j, seed) > 0.6)))
                if big: c.P(i + 1, j + 1, K(ramp, -1)); c.P(i + 1, j, K(ramp, 0))


def railing(c, x0, y0, w, h, ramp='tekko', t=0, gap=3):
    c.HL(x0, y0, w, K(ramp, t + 2)); c.HL(x0, y0 + 1, w, K(ramp, t - 1))
    for x in range(x0, x0 + w, gap): c.VL(x, y0 + 2, h - 3, K(ramp, t + (1 if (x - x0) % (gap * 2) == 0 else 0)))
    c.HL(x0, y0 + h - 1, w, K(ramp, t - 2))


def ac_unit(c, x, y, w=14, h=10):
    """에어컨 실외기: 흰 상자 + 둥근 팬 격자 + 그림자."""
    c.R(x, y, w, h, K('shiro', 0)); c.HL(x, y, w, K('shiro', 2)); c.VL(x, y, h, K('shiro', 1))
    c.HL(x, y + h - 1, w, K('shiro', -2)); c.VL(x + w - 1, y, h, K('shiro', -2))
    r = (h - 3) / 2; cx = x + 1.5 + r; cy = y + h / 2 - 0.5
    disc(c, cx, cy, r, K('tekko', -1))
    for k in range(int(cx - r) + 1, int(cx + r) + 1, 2): c.VL(k, int(cy - r) + 1, int(2 * r) - 1, K('tekko', 1))
    for j in range(y + 2, y + h - 2, 2): c.HL(x + w - 4, j, 3, K('shiro', -1))
    c.HL(x + 1, y + h, w, K('yoru', -1))


def lantern(c, x, y, w=8, h=12):
    c.VL(x + w // 2, y - 2, 2, OL)
    c.HL(x + 1, y, w - 2, OL)
    for j in range(1, h - 1):
        hw = w // 2 - (1 if j in (1, h - 2) else 0)
        c.HL(x + w // 2 - hw, y + j, hw * 2, K('aka', 1 if j < h // 2 else 0))
        c.P(x + w // 2 - hw, y + j, K('aka', 2)); c.P(x + w // 2 + hw - 1, y + j, K('aka', -1))
    c.HL(x + 1, y + h - 1, w - 2, OL); c.HL(x + 2, y + 3, w - 4, OL); c.HL(x + 2, y + h - 4, w - 4, OL)
    glyphs(c, x + w // 2 - 1, y + 5, 1, OL, size=3, seed=9)


def postbox(c, x, y):
    """빨간 우체통(14×30): 둥근 머리·투입구 둘·흰 〒 표."""
    disc(c, x + 6.5, y + 4, 6.5, K('aka', 0), ry=4)
    disc(c, x + 6.5, y + 4, 5.5, K('aka', 1), ry=3)
    c.R(x, y + 5, 14, 20, K('aka', 0)); c.VL(x, y + 5, 20, K('aka', 1)); c.VL(x + 1, y + 5, 20, K('aka', 2))
    c.VL(x + 13, y + 4, 21, K('aka', -1)); c.VL(x + 12, y + 5, 20, K('aka', -1))
    c.HL(x + 3, y + 8, 4, OL); c.HL(x + 8, y + 8, 4, OL)
    c.HL(x + 4, y + 12, 6, K('shiro', 2)); c.HL(x + 4, y + 14, 6, K('shiro', 2)); c.VL(x + 6, y + 14, 4, K('shiro', 2))
    c.HL(x + 1, y + 21, 12, K('aka', -1)); c.HL(x + 2, y + 18, 10, K('aka', -2))
    c.R(x + 2, y + 25, 10, 4, K('tekko', -1)); c.HL(x + 2, y + 25, 10, K('tekko', 1))
    outline_rect(c, x - 1, y + 4, 16, 22, OL)
    c.HL(x, y + 29, 14, K('yoru', -2))


# ═══════════════════════════ 키트 목록 ═══════════════════════════
KITS = []


def kit(id_, name, w, h, kind, solid=(), other='star', tags=(), rules='', role='prop'):
    def deco(fn):
        KITS.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=set(solid), other=other, tags=list(tags), rules=rules, role=role))
        return fn
    return deco


def rows(w, ys):
    return [(x, y) for y in ys for x in range(w)]


# ----------------------------- 바닥 1칸 키트 -----------------------------
def _gnd(id_, name, fn, tags, rules):
    @kit(id_, name, 1, 1, 'flat', other='flat', tags=['바닥', '시타마치'] + tags, rules=rules, role='floor')
    def _d(up, base):
        fn(base)


def _slab_b(c): fill_tex(c, 0, 0, 16, 16, slab_px, seed=5, tone=0.5)
def _slab_c(c):
    """얼룩 판: 판석 위 물 자국(어두운 둥근 얼룩)과 껌 자국 점."""
    fill_tex(c, 0, 0, 16, 16, slab_px, seed=11)
    for y in range(16):
        for x in range(16):
            if (x - 9.5) ** 2 / 20 + (y - 10) ** 2 / 9 <= 1 and x % 8 != 7 and y % 8 != 7: c.P(x, y, slab_px(x, y, shade=1, seed=11))
    for (x, y) in ((3, 3), (12, 2), (5, 12)): c.P(x, y, K('conc', -1))
def _asph_b(c):
    fill_tex(c, 0, 0, 16, 16, asph_px, seed=3)
    for (x, y) in ((2, 11), (3, 10), (4, 10), (5, 9), (6, 9), (7, 8), (8, 8), (9, 7), (10, 7), (11, 5), (12, 4)): c.P(x, y, K('ita', -2))
    for (x, y) in ((7, 9), (10, 8), (12, 5)): c.P(x, y, K('tekko', 2))
def _manhole(c):
    fill_tex(c, 0, 0, 16, 16, asph_px)
    disc(c, 8, 8.5, 6.5, OL); disc(c, 7.5, 8, 6.5, K('tekko', 0)); disc(c, 7.5, 8, 5.5, K('tekko', -1))
    for y in range(3, 14):
        for x in range(2, 14):
            if (x - 7.5) ** 2 + (y - 8) ** 2 <= 25 and (x + y) % 3 == 0: c.P(x, y, K('tekko', 1))
    disc(c, 7.5, 8, 1.6, K('tekko', 1))
    for (x, y) in ((3, 6), (4, 4), (5, 3), (7, 2), (3, 7)): c.P(x, y, K('tekko', 2))
    for (x, y) in ((13, 10), (12, 12), (10, 13), (13, 9)): c.P(x, y, K('tekko', -2))
def _edge_line(c, y):
    """路側帯 흰 실선(2px, 닳은 알갱이) — 큰길 가장자리 차로 칸."""
    for x in range(16):
        c.P(x, y, K('shiro', 1) if H(x, y, 5) > 0.1 else K('tekko', 1)); c.P(x, y + 1, K('shiro', 0) if H(x, y + 1, 5) > 0.15 else K('tekko', 0))
def _drain(c):
    fill_tex(c, 0, 0, 16, 16, asph_px)
    c.R(1, 0, 14, 7, K('tekko', -2)); c.HL(1, 7, 14, K('conc', 1))
    for x in range(2, 14, 2): c.VL(x, 0, 6, K('tekko', 1)); c.VL(x + 1, 0, 6, SUMI2)
    c.HL(1, 6, 14, K('tekko', 0)); c.VL(0, 0, 8, OL); c.VL(15, 0, 8, K('tekko', -1)); c.HL(0, 8, 16, K('ita', -1))
    _edge_line(c, 12)
def _line_n(c): fill_tex(c, 0, 0, 16, 16, asph_px); _edge_line(c, 12)
def _line_s(c): fill_tex(c, 0, 0, 16, 16, asph_px); _edge_line(c, 2)
def _zebra(c):
    """횡단보도 막대(세로 막대 5px, 8px 주기) — 가로 큰길을 남북으로 건너는 사다리 무늬. 따뜻한 아스팔트 위, 차로 줄마다 세로로 이어 찍는다."""
    fill_tex(c, 0, 0, 16, 16, asph_px)
    for x0 in (1, 9):
        for x in range(x0, x0 + 5):
            for y in range(16):
                worn = H(x, y, 9) < 0.06
                c.P(x, y, K('tekko', 1) if worn else K('shiro', 2 if x == x0 else 1 if x < x0 + 4 else 0))
_CURB_V = (K('conc', 2), K('conc', 1), K('conc', 0), K('conc', -2), K('yoru', -1))
def _curb_e(c, south=False, north=False):
    """보도 동쪽 연석(오른쪽이 세로 길). south/north = 모퉁이(아래·위도 도로)."""
    fill_tex(c, 0, 0, 16, 16, slab_px)
    if south: _curb_s(c)
    if north: _curb_n(c)
    for i, col in enumerate(_CURB_V): c.VL(11 + i, 0, 16, col)
    c.HL(12, 7, 2, K('conc', -1)); c.HL(12, 15, 2, K('conc', -1))
def _curb_w(c, south=False, north=False):
    fill_tex(c, 0, 0, 16, 16, slab_px)
    if south: _curb_s(c)
    if north: _curb_n(c)
    for i, col in enumerate(reversed(_CURB_V)): c.VL(i, 0, 16, col)
    c.HL(1, 7, 2, K('conc', -1)); c.HL(1, 15, 2, K('conc', -1))
def _curb_s(c, shade=0):
    fill_tex(c, 0, 0, 16, 11, slab_px, shade=shade)
    c.HL(0, 11, 16, K('conc', 2 - 2 * shade)); c.HL(0, 12, 16, K('conc', 1 - 2 * shade)); c.HL(0, 13, 16, K('conc', 0 - 2 * shade))
    c.HL(0, 14, 16, K('conc', -2)); c.HL(0, 15, 16, K('yoru', -1))
    c.VL(7, 12, 2, K('conc', -1)); c.VL(15, 12, 2, K('conc', -1))
def _curb_n(c):
    fill_tex(c, 0, 4, 16, 12, slab_px)
    c.HL(0, 0, 16, K('yoru', -1)); c.HL(0, 1, 16, K('conc', 2)); c.HL(0, 2, 16, K('conc', 1)); c.HL(0, 3, 16, K('conc', -1))
    c.VL(7, 1, 2, K('conc', 0)); c.VL(15, 1, 2, K('conc', 0))
def _shade(fn, inside=None, s=1):
    def f(c):
        fill_tex(c, 0, 0, 16, 16, fn)
        shade_poly(c, 0, 0, 16, 16, inside or (lambda x, y: True), fn, s=s)
    return f


def _curb_shade(inside):
    """연석 줄 사선 그림자: 그림자 진 연석(_curb_s shade=1)을 inside 화소에만 옮긴다(2026-10-18 적대 QA: 그림자가 보도 한 줄에서 뚝 끊겼다)."""
    def f(c):
        _curb_s(c, 0)
        d = Cv(16, 16); _curb_s(d, 1)
        for y in range(16):
            for x in range(16):
                if inside(x, y): c.a[y, x] = d.a[y, x]
    return f


_DL = lambda x, y: x >= y           # 건물 왼쪽 끝 아래: 그림자가 오른쪽으로 비껴 시작
_DR = lambda x, y: x < y            # 건물 오른쪽 끝 다음 칸: 사선으로 끝남
_gnd('gnd-slab-b', '콘크리트 판석 보도(갈아 끼운 밝은 판)', _slab_b, ['판석'], '보도 몸통 사이 드문드문(15%) - 같은 무늬 반복을 깬다.')
_gnd('gnd-slab-c', '콘크리트 판석 보도(물 얼룩)', _slab_c, ['판석'], '보도 몸통 사이 드문드문.')
_gnd('gnd-asph-crack', '따뜻한 아스팔트(금 간)', _asph_b, ['아스팔트'], '도로 몸통 사이 드문드문.')
_gnd('gnd-manhole', '둥근 주철 맨홀', _manhole, ['아스팔트', '맨홀'], '도로 가운데 줄 8~12칸마다.')
_gnd('gnd-drain', '빗물받이(グレーチング)', _drain, ['아스팔트', '배수'], '연석 바로 아래 도로 칸, 6칸마다.')
_gnd('gnd-curb-s', '보도 남쪽 연석(아래가 도로)', _curb_s, ['판석', '연석'], '보도 맨 아랫줄(도로와 닿는 줄).')
_gnd('gnd-curb-s-shade', '보도 남쪽 연석(그림자)', lambda c: _curb_s(c, 1), ['판석', '연석', '그림자'], '그림자 줄이 연석 줄일 때.')
_gnd('gnd-curb-s-shade-dl', '보도 남쪽 연석(사선 그림자 시작)', _curb_shade(lambda x, y: x >= y), ['판석', '연석', '그림자'], '건물 왼쪽 끝 한 칸 오른쪽의 연석 줄.')
_gnd('gnd-curb-s-shade-dr', '보도 남쪽 연석(사선 그림자 끝)', _curb_shade(lambda x, y: x < y), ['판석', '연석', '그림자'], '건물 오른쪽 끝 두 칸 오른쪽의 연석 줄.')
_gnd('gnd-curb-n', '보도 북쪽 연석(위가 도로)', _curb_n, ['판석', '연석'], '도로 아래 보도 맨 윗줄.')
_gnd('gnd-shade-slab', '건물 그림자 진 판석 보도', _shade(slab_px, s=2), ['판석', '그림자'], '건물 정면 바로 아래 보도 줄.')
_gnd('gnd-shade-slab-dl', '사선 그림자 시작(판석)', _shade(slab_px, _DL, s=2), ['판석', '그림자'], '건물 왼쪽 끝 아래(빛 왼쪽 위 -> 그림자 오른쪽 아래 45°).')
_gnd('gnd-shade-slab-dr', '사선 그림자 끝(판석)', _shade(slab_px, _DR, s=2), ['판석', '그림자'], '건물 오른쪽 끝 다음 칸.')
_gnd('gnd-shade-asph', '건물 그림자 진 아스팔트', _shade(asph_px), ['아스팔트', '그림자'], '건물 바로 아래 도로 줄.')
_gnd('gnd-shade-asph-dl', '사선 그림자 시작(아스팔트)', _shade(asph_px, _DL), ['아스팔트', '그림자'], '건물 왼쪽 끝 아래.')
_gnd('gnd-shade-asph-dr', '사선 그림자 끝(아스팔트)', _shade(asph_px, _DR), ['아스팔트', '그림자'], '건물 오른쪽 끝 다음 칸.')
_gnd('gnd-asph-line-n', '따뜻한 아스팔트(路側帯 흰 선, 위 보도 쪽)', _line_n, ['아스팔트', '노면 표시'], '큰길 맨 윗 차로 줄(빗물받이 칸 사이).')
_gnd('gnd-asph-line-s', '따뜻한 아스팔트(路側帯 흰 선, 아래 보도 쪽)', _line_s, ['아스팔트', '노면 표시'], '큰길 맨 아랫 차로 줄.')
_gnd('gnd-zebra', '횡단보도 줄(따뜻한 아스팔트)', _zebra, ['아스팔트', '횡단보도'], '큰길 차로 칸을 세로로 3칸 폭 이어 찍는다.')
_gnd('gnd-curb-e', '보도 동쪽 연석(오른쪽이 세로 길)', _curb_e, ['판석', '연석'], '세로 길 왼쪽 보도 열.')
_gnd('gnd-curb-w', '보도 서쪽 연석(왼쪽이 세로 길)', _curb_w, ['판석', '연석'], '세로 길 오른쪽 보도 열.')
_gnd('gnd-curb-se', '보도 모퉁이 연석(아래·오른쪽이 길)', lambda c: _curb_e(c, south=True), ['판석', '연석'], '큰길 위 보도와 세로 길 왼쪽 보도가 만나는 모퉁이.')
_gnd('gnd-curb-sw', '보도 모퉁이 연석(아래·왼쪽이 길)', lambda c: _curb_w(c, south=True), ['판석', '연석'], '큰길 위 보도와 세로 길 오른쪽 보도가 만나는 모퉁이.')
_gnd('gnd-curb-ne', '보도 모퉁이 연석(위·오른쪽이 길)', lambda c: _curb_e(c, north=True), ['판석', '연석'], '큰길 아래 보도와 세로 길 왼쪽 보도가 만나는 모퉁이.')
_gnd('gnd-curb-nw', '보도 모퉁이 연석(위·왼쪽이 길)', lambda c: _curb_w(c, north=True), ['판석', '연석'], '큰길 아래 보도와 세로 길 오른쪽 보도가 만나는 모퉁이.')


# ----------------------------- 뒷줄(위 거리) 가게 -----------------------------
def shop_greengrocer(c, base):
    kawara(c, 0, 0, 96, 15, 'tekko', 0)
    plaster(c, 0, 15, 96, 21, 'kinari', 0)
    window(c, 6, 18, 20, 12); window(c, 70, 18, 20, 12)
    c.R(32, 17, 32, 15, K('shiro', 1)); outline_rect(c, 31, 16, 34, 17); c.HL(32, 17, 32, K('shiro', 2))
    glyphs(c, 35, 20, 3, K('midori', -1), size=7, seed=4)
    c.VL(28, 15, 21, K('tekko', -1)); c.VL(29, 15, 21, K('tekko', 1))          # 홈통
    awning(c, 0, 36, 96, 12, 'sora', 0)
    c.R(0, 48, 96, 32, K('sumi', 2))
    for y in range(48, 54): c.HL(0, y, 96, K('yoru', -3 + (y - 48) // 3))
    for bx in (14, 38, 58, 82):
        c.VL(bx, 48, 2, OL); c.R(bx - 1, 50, 3, 2, K('mado', 2)); c.P(bx - 2, 51, K('mado', 0)); c.P(bx + 2, 51, K('mado', 0)); c.P(bx, 52, K('mado', 1))
    i = 0
    for y, x0, step, w in ((53, 5, 11, 10), (61, 3, 11, 10), (69, 1, 12, 11)):
        c.HL(0, y + 7, 96, K('ita', -2))
        for x in range(x0, 92, step):
            crate(c, x, y, w, 8 if y < 69 else 10, PRODUCE[(i * 7 + y) % len(PRODUCE)], box='ita' if (i % 3) else 'yuka', seed=i); i += 1
    for px in (0, 92):
        c.R(px, 48, 4, 32, K('tekko', 0)); c.VL(px, 48, 32, K('tekko', 2)); c.VL(px + 3, 48, 32, K('tekko', -2))
    c.HL(0, 79, 96, OL); c.VL(95, 0, 80, OL)


def izakaya_brick(c, base):
    flat_roof(c, 0, 0, 64, 12, 'conc', -1, seed=2)
    c.R(44, 2, 12, 6, K('shiro', 0)); c.HL(44, 2, 12, K('shiro', 2)); c.HL(44, 8, 12, K('yoru', -1))      # 옥상 환기 상자
    brick_wall(c, 0, 12, 64, 68, 'renga', 0)
    c.R(6, 16, 50, 12, K('shiro', 2)); outline_rect(c, 5, 15, 52, 14); c.HL(6, 27, 50, K('shiro', 0))
    glyphs(c, 9, 18, 4, K('aka', 0), size=8, gap=4, seed=12)
    for lx in (14, 30, 46): c.R(lx, 13, 3, 2, K('tekko', -1))
    window(c, 7, 33, 16, 10, bars=True); window(c, 33, 33, 16, 10, bars=True)
    c.R(13, 50, 30, 30, K('ita', -2)); outline_rect(c, 12, 49, 32, 31)
    for x in range(15, 41, 4):
        c.VL(x, 58, 21, K('ita', 1))
    for y in range(59, 79, 4): c.HL(14, y, 28, K('ita', 1))
    for y in range(60, 78):
        for x in range(16, 40):
            if (x - 15) % 4 and (y - 59) % 4: c.P(x, y, K('mado', 1 if (x + y) % 5 else 0))
    for k, nx in enumerate(range(14, 42, 7)):
        c.R(nx, 50, 6, 11, K('kon', 0)); c.VL(nx, 50, 11, K('kon', 1)); c.HL(nx, 60, 6, K('kon', -1))
    c.R(23, 53, 10, 4, K('shiro', 1)); glyphs(c, 25, 53, 1, K('kon', 0), size=4, seed=5)
    lantern(c, 47, 50, 9, 13)
    c.R(58, 12, 3, 68, K('tekko', 0)); c.VL(58, 12, 68, K('tekko', 2)); c.VL(60, 12, 68, K('tekko', -2))
    for y in range(18, 80, 14): c.R(57, y, 5, 2, K('tekko', -1))
    c.R(55, 42, 8, 7, K('tekko', 1)); outline_rect(c, 55, 42, 8, 7, K('tekko', -2))
    c.HL(0, 76, 64, K('conc', -1)); c.HL(0, 79, 64, OL); c.VL(63, 0, 80, OL)


def vending_alcove(c, base):
    corrugated(c, 0, 0, 48, 10, 'tekko', 0); c.HL(0, 0, 48, OL); c.HL(0, 9, 48, OL)
    plaster(c, 0, 10, 48, 12, 'conc', 1, seed=7)
    c.R(6, 12, 36, 7, K('kii', 1)); outline_rect(c, 5, 11, 38, 9); glyphs(c, 8, 13, 4, OL, size=4, seed=21)
    awning(c, 0, 22, 48, 11, 'aka', 0, stripe='shiro', sw=4)
    c.R(0, 33, 48, 47, K('tairu', -2))
    for y in range(33, 80, 6): c.HL(0, y, 48, K('tairu', -3))
    c.R(4, 35, 24, 43, K('shiro', 1)); outline_rect(c, 3, 34, 26, 45)
    c.VL(4, 35, 43, K('shiro', 2)); c.VL(27, 35, 43, K('shiro', -1))
    c.R(6, 37, 20, 19, K('garasu', -2))
    cans = ('aka', 'sora', 'kii', 'midori', 'daidai', 'shiro', 'murasaki')
    for r, cy in enumerate((38, 44, 50)):
        for k, cx in enumerate(range(7, 25, 3)):
            ramp = cans[(r * 3 + k) % len(cans)]
            c.VL(cx, cy, 4, K(ramp, 1)); c.VL(cx + 1, cy, 4, K(ramp, 0)); c.P(cx, cy, K(ramp, 2))
            c.P(cx, cy + 5, K('neonC', 0) if (k + r) % 3 else K('aka', 1))
    c.R(6, 58, 20, 8, K('shiro', 2)); c.R(20, 59, 4, 5, K('tekko', -1)); c.R(8, 60, 9, 3, K('garasu', 0))
    c.R(6, 68, 20, 6, OL); c.HL(7, 69, 18, K('tekko', 0))
    for bx in (31, 39):
        c.R(bx, 58, 8, 19, K('tekko', 1)); c.VL(bx, 58, 19, K('tekko', 2)); c.VL(bx + 7, 58, 19, K('tekko', -1))
        c.R(bx, 56, 8, 3, K('tekko', 2)); disc(c, bx + 3.5, 57, 1.6, OL); outline_rect(c, bx - 1, 55, 10, 23)
        c.HL(bx + 1, 64, 6, K('kii', 1) if bx == 31 else K('sora', 1))
    c.HL(0, 79, 48, OL); c.VL(47, 0, 80, OL)


# ----------------------------- 앞줄(아래 거리) 3/4 위에서 본 건물 -----------------------------

def _two_storey_front(c, y0, ramp='conc', seed=9):
    """앞줄 집 정면(2층 + 1층) y0~79: 층 띠·창·1층 문/셔터. 반환: 2층 바닥 줄 y."""
    plaster(c, 0, y0, 96, 80 - y0, ramp, 1, seed=seed)
    mid = y0 + (80 - y0) // 2 - 1
    c.HL(0, mid, 96, K(ramp, 3)); c.HL(0, mid + 1, 96, K(ramp, -1))              # 층 띠(2층 바닥)
    return mid


def fg_balcony(c, base):
    """하나의 골기와 박공 지붕(갈색) + 2층(발코니) + 1층(셔터·현관). (2026-10-18 4등분 확대 QA: 두 색 지붕 조각이 1층 정면 위에 얹혀 「납작한 1층 집 + 지붕 바다」로 읽혔다.)"""
    kawara(c, 0, 0, 96, 26, 'kawara', 0)
    for y in range(2, 24): c.P(0, y, K('kawara', 2)); c.P(95, y, K('kawara', -3))                # 박공 끝 기와
    c.R(6, 3, 8, 6, K('conc', 0)); c.HL(6, 3, 8, K('conc', 2)); c.HL(6, 9, 9, K('kawara', -3))      # 환기 굴뚝
    mid = _two_storey_front(c, 26, 'conc', 9)
    # 2층: 발코니(난간·화분·실외기) + 오른쪽 방범창
    window(c, 10, 28, 46, 13)
    for px, ramp in ((12, 'ki'), (46, 'shiba')):
        c.R(px, 38, 6, 5, K('daidai', -1)); c.HL(px, 38, 6, K('daidai', 0))
        disc(c, px + 3, 35, 4, K(ramp, -1)); disc(c, px + 2, 34, 3, K(ramp, 0)); c.P(px + 1, 33, K(ramp, 1))
    ac_unit(c, 24, 34, 16, 9)
    railing(c, 6, 33, 54, 10, 'tekko', 0, gap=3)
    c.R(6, mid - 2, 54, 3, K('conc', 3)); c.HL(6, mid + 1, 54, OL)
    window(c, 68, 30, 18, 11, bars=True)
    # 1층: 셔터 + 현관 + 우편함
    for y in range(mid + 4, 79, 2): c.HL(8, y, 46, K('tekko', 1)); c.HL(8, y + 1, 46, K('tekko', -1))
    outline_rect(c, 7, mid + 3, 48, 79 - mid - 3); c.HL(8, mid + 4, 46, K('tekko', 2))
    c.R(64, mid + 4, 16, 79 - mid - 4, K('ita', 0)); outline_rect(c, 63, mid + 3, 18, 79 - mid - 3); c.VL(72, mid + 4, 79 - mid - 4, K('ita', -2)); c.P(70, mid + 12, K('mado', 1))
    c.R(84, mid + 6, 6, 5, K('shiro', 1)); outline_rect(c, 83, mid + 5, 8, 7, K('tekko', -1))
    c.R(90, 26, 3, 54, K('tekko', 0)); c.VL(90, 26, 54, K('tekko', 2))                          # 홈통
    c.HL(0, 79, 96, OL); c.VL(95, 26, 54, OL)


def fg_rooftop(c, base):
    """옥상(난간·위성 안테나·실외기) 30px + 2층 골함석 벽 + 1층 가게 정면. (2026-10-18: 옥상 50px + 벽 30px 은 납작한 1층 집으로 읽혔다.)"""
    import math
    flat_roof(c, 0, 0, 96, 30, 'conc', 0, seed=8)
    railing(c, 2, 2, 92, 7, 'tekko', 0, gap=3)
    c.VL(2, 2, 26, K('tekko', 1)); c.VL(93, 2, 26, K('tekko', -1))
    disc(c, 30, 20, 8, K('conc', -1), ry=5)                                                       # 안테나 그림자
    c.VL(25, 16, 7, K('tekko', -1)); c.R(22, 22, 7, 3, K('tekko', 0))
    disc(c, 25, 15, 7, K('shiro', 0), ry=5); disc(c, 24, 14, 6, K('shiro', 1), ry=4); disc(c, 23, 13, 3, K('shiro', 2), ry=2)
    for t in range(20, 200, 12):
        c.P(round(25 + 7 * math.cos(math.radians(t))), round(15 + 5 * math.sin(math.radians(t))), K('shiro', -2))
    line(c, 25, 15, 32, 9, K('tekko', -1)); c.R(31, 8, 3, 3, K('tekko', 1))
    for ax in (54, 72):
        c.R(ax + 3, 15, 16, 10, K('conc', -1)); ac_unit(c, ax, 12, 15, 10)
    mid = _two_storey_front(c, 30, 'conc', 8)
    corrugated(c, 0, 30, 96, mid - 30, 'conc', 0)
    window(c, 8, 33, 22, 11); ac_unit(c, 34, 35, 13, 8); window(c, 60, 33, 22, 11, lit=True)
    # 1층 가게: 짧은 차양 + 유리문 + 진열창
    awning(c, 0, mid + 2, 96, 7, 'midori', -1)
    c.R(0, mid + 9, 96, 79 - mid - 9, K('tairu', -2))
    window(c, 6, mid + 11, 30, 79 - mid - 14, lit=True); window(c, 62, mid + 11, 28, 79 - mid - 14, lit=True)
    c.R(40, mid + 10, 18, 79 - mid - 10, K('garasu', 0)); outline_rect(c, 39, mid + 9, 20, 79 - mid - 9, K('tekko', -2)); c.VL(48, mid + 10, 79 - mid - 10, K('tekko', 1))
    c.R(88, 30, 3, 50, K('tekko', 0)); c.VL(88, 30, 50, K('tekko', 2))
    c.HL(0, 79, 96, OL); c.VL(95, 0, 80, OL); c.VL(0, 0, 80, K('conc', 2))


# ----------------------------- 상점가 -----------------------------
def coin_parking(c, base):
    fill_tex(base, 0, 32, 128, 64, asph_px, seed=2)
    shade_poly(base, 0, 32, 128, 12, lambda x, y: y < 12 - (x % 1) and x >= y, asph_px, seed=2)
    for x in (4, 44, 84, 124):
        base.R(x, 36, 2, 58, K('kii', 1)); base.VL(x + 2, 36, 58, K('kii', -1))
    base.R(4, 36, 122, 2, K('kii', 1))
    for sx in (4, 44, 84):
        base.R(sx + 12, 41, 16, 3, K('conc', 1)); base.HL(sx + 12, 41, 16, K('conc', 3)); base.HL(sx + 12, 44, 16, K('yoru', -1))
        base.R(sx + 16, 70, 10, 5, K('tekko', 0)); base.HL(sx + 16, 70, 10, K('tekko', 2)); base.HL(sx + 17, 72, 8, K('kii', 1)); base.HL(sx + 16, 75, 10, OL)
        base.R(sx + 18, 50, 6, 4, K('shiro', 1))
    brick_wall(c, 0, 0, 128, 26, 'renga', -1, bw=8, bh=4, seed=6)
    for y in range(26, 32):
        for x in range(128): c.P(x, y, K('conc', -1) if (x % 16 == 15 or y == 29) else K('conc', 1 if y < 29 else 0))
    c.HL(0, 26, 128, K('conc', 3)); c.HL(0, 31, 128, OL)
    c.R(6, 3, 36, 21, K('shiro', 2)); outline_rect(c, 5, 2, 38, 23)
    c.R(6, 3, 36, 6, K('aka', 0)); disc(c, 13, 13.5, 4.5, K('aka', 0)); disc(c, 13, 13.5, 3, K('shiro', 2))
    c.VL(12, 11, 6, K('aka', 0)); c.HL(12, 11, 3, K('aka', 0)); c.HL(12, 14, 3, K('aka', 0)); c.P(14, 12, K('aka', 0)); c.P(14, 13, K('aka', 0))
    for y in (12, 16, 20): c.HL(21, y, 18, K('aka', -1)); c.HL(21, y + 1, 8, K('kon', 0))
    glyphs(c, 8, 4, 4, K('shiro', 2), size=4, seed=50)
    for k in range(32):
        x = 96 + k; y = 30 - k * 26 // 32
        c.VL(x, y, 2, K('tekko', -1)); c.P(x, y - 4, K('tekko', 1))
        if k % 4 == 0: c.HL(x, y, 4, K('tekko', 2))
    c.VL(96, 4, 27, K('tekko', 0)); c.VL(127, 2, 29, K('tekko', 0)); c.HL(110, 14, 18, K('tekko', 2)); c.HL(110, 15, 18, K('tekko', -2))
    c.R(98, 32, 22, 4, K('midori', 0)); c.HL(98, 32, 22, K('midori', 2)); c.HL(98, 36, 22, OL)
    c.R(102, 37, 13, 22, K('shiro', 1)); c.VL(102, 37, 22, K('shiro', 2)); c.VL(114, 37, 22, K('shiro', -1)); outline_rect(c, 101, 36, 15, 24)
    c.R(104, 39, 9, 6, K('garasu', 1)); c.R(104, 47, 4, 3, K('tekko', -1)); c.R(109, 47, 3, 6, K('kii', 1)); c.HL(104, 54, 9, OL)
    c.R(100, 33, 2, 27, K('tekko', 0)); c.R(116, 33, 2, 27, K('tekko', -1))
    c.HL(102, 60, 14, K('yoru', -2)); c.HL(104, 61, 14, K('yoru', -1))


def shotengai_canopy(c, base):
    fill_tex(base, 0, 80, 128, 16, slab_px, shade=1)
    for y in range(0, 36):
        for x in range(128):
            k = x % 5; t = 1 if k == 0 else -1 if k == 4 else 0
            if y % 12 == 11: t -= 1
            if y % 12 == 0: t += 1
            if H(x, y // 2, 61) < 0.012: c.P(x, y, K('daidai', -1)); continue
            c.P(x, y, K('aka', t))
    c.HL(0, 0, 128, OL); c.HL(0, 1, 128, K('aka', -2))
    c.R(0, 36, 128, 7, K('shiro', 1)); c.HL(0, 36, 128, K('shiro', 2)); c.HL(0, 42, 128, K('shiro', -1)); c.HL(0, 43, 128, OL)
    for gx in range(6, 120, 30): glyphs(c, gx, 37, 3, K('sora', -1), size=4, gap=2, seed=gx)
    c.R(0, 44, 128, 52, K('sumi', 2))
    for y in range(44, 50): c.HL(0, y, 128, K('yoru', -3))
    for k, sx in enumerate((5, 29, 53, 77, 101)):
        c.R(sx, 50, 20, 6, K('yoru', -1))
        for i in range(sx + 1, sx + 19, 3): c.P(i, 52, K(('kii', 'aka', 'midori', 'daidai')[(i + k) % 4], 1)); c.P(i + 1, 53, K('shiro', 0))
        kind = k % 3
        if kind == 0:
            for j, cx in enumerate(range(sx, sx + 20, 7)):
                crate(c, cx, 58, 7, 8, PRODUCE[(j + k) % len(PRODUCE)], seed=j + k)
                crate(c, cx, 66, 7, 10, PRODUCE[(j + k + 3) % len(PRODUCE)], seed=j + k + 5)
        elif kind == 1:
            c.R(sx, 60, 20, 16, K('shiro', 1)); c.R(sx + 1, 61, 18, 7, K('garasu', 2)); outline_rect(c, sx, 60, 20, 16)
            for i in range(sx + 2, sx + 18, 4): c.R(i, 64, 3, 3, K('pinku', 0)); c.P(i, 64, K('pinku', 2)); c.P(i + 2, 66, K('aka', -1))
            c.HL(sx, 69, 20, K('shiro', 2)); c.R(sx + 2, 71, 16, 4, K('shiro', 0))
        else:
            c.R(sx, 62, 20, 14, K('ita', 0)); c.HL(sx, 62, 20, K('ita', 2)); outline_rect(c, sx, 61, 20, 15)
            for j, i in enumerate(range(sx + 1, sx + 19, 6)):
                ramp = ('kii', 'daidai', 'midori', 'yuka')[(j + k) % 4]
                c.R(i, 63, 5, 4, K('shiro', 1)); c.R(i + 1, 64, 3, 2, K(ramp, 0)); c.P(i + 1, 64, K(ramp, 1))
                c.R(i, 68, 5, 4, K('shiro', 1)); c.R(i + 1, 69, 3, 2, K(('daidai', 'ki', 'kii', 'aka')[(j + k) % 4], 0))
    c.HL(0, 77, 128, K('ita', -2)); c.HL(0, 78, 128, OL)
    for px in (1, 26, 50, 75, 99, 124):
        c.R(px, 44, 3, 52, K('tekko', 0)); c.VL(px, 44, 52, K('tekko', 2)); c.VL(px + 2, 44, 52, K('tekko', -2))
        c.R(px - 1, 44, 5, 2, K('tekko', 1)); c.R(px - 1, 93, 5, 3, K('conc', 0))
        if px < 120:
            fx = px + 4
            c.HL(fx - 1, 47, 8, K('tekko', 1))
            c.R(fx, 48, 6, 16, K('sora', 0)); c.VL(fx, 48, 16, K('sora', 1)); c.VL(fx + 5, 48, 16, K('sora', -1))
            c.R(fx + 1, 51, 4, 8, K('shiro', 2)); glyphs(c, fx + 1, 52, 2, K('sora', -1), size=3, gap=1, seed=px, vertical=True)
            c.P(fx, 64, K('sora', 0)); c.P(fx + 2, 64, K('sora', 0)); c.P(fx + 4, 64, K('sora', 0))


def shotengai_arch(c, base):
    fill_tex(base, 12, 52, 72, 44, tile_px)
    for y in range(52, 62): 
        for x in range(12, 84): base.P(x, y, tile_px(x, y, shade=1 if y > 56 else 2))
    shade_poly(base, 12, 52, 72, 44, lambda x, y: x < 30 - y // 2 or x > 66 - y // 4, tile_px)
    for y in range(26, 52):
        k = (y - 26)
        band = k // 6
        for x in range(12, 84):
            rib = (x - 12) % 9 == 0 or k % 6 == 5
            c.P(x, y, K('tekko', 0 - band // 2) if rib else K('garasu', 2 - band))
    for side in (12, 76):
        c.R(side, 30, 8, 22, K('yoru', -1))
        for j in range(32, 50, 5): c.HL(side + 1, j, 6, K(('kii', 'aka', 'sora', 'midori')[(j + side) % 4], 0))
    for px in (0, 84):
        c.R(px, 20, 12, 76, K('conc', 0)); c.VL(px, 20, 76, K('conc', 2)); c.VL(px + 1, 20, 76, K('conc', 1))
        c.VL(px + 10, 20, 76, K('conc', -1)); c.VL(px + 11, 20, 76, K('conc', -2)); outline_rect(c, px - 1 if px else 0, 20, 13, 76)
        c.R(px, 88, 12, 8, K('conc', -1)); c.HL(px, 88, 12, K('conc', 2))
        for y in range(30, 86, 10): c.HL(px + 2, y, 8, K('conc', -1))
    kawara(c, 0, 0, 96, 7, 'tekko', -1)
    c.R(0, 7, 96, 19, K('kon', -1)); outline_rect(c, 0, 7, 96, 19)
    c.R(6, 9, 84, 15, K('shiro', 2)); outline_rect(c, 5, 8, 86, 17, K('kii', 0))
    ink = K('kon', 0)
    # 大: 가로획 + 위 세로 + 좌우로 벌어지는 두 삐침
    c.R(18, 13, 13, 2, ink); c.R(24, 9, 2, 6, ink)
    line(c, 24, 15, 18, 22, ink); line(c, 25, 15, 19, 22, ink); line(c, 25, 15, 31, 22, ink); line(c, 26, 15, 31, 21, ink)
    # 門: 두 기둥 + 위 문짝 칸 둘
    c.R(42, 10, 2, 13, ink); c.R(53, 10, 2, 13, ink)
    c.R(42, 10, 5, 1, ink); c.R(42, 12, 5, 1, ink); c.R(42, 14, 5, 1, ink); c.R(46, 10, 1, 5, ink)
    c.R(50, 10, 5, 1, ink); c.R(50, 12, 5, 1, ink); c.R(50, 14, 5, 1, ink); c.R(50, 10, 1, 5, ink)
    # 通: 오른쪽 위 甬 + 왼쪽 辶 받침
    c.R(70, 10, 9, 1, ink); c.R(70, 12, 2, 8, ink); c.R(77, 12, 2, 8, ink); c.R(70, 12, 9, 1, ink); c.R(70, 15, 9, 1, ink); c.R(73, 11, 2, 9, ink)
    c.P(66, 11, ink); c.P(67, 12, ink); c.R(65, 15, 3, 1, ink); c.R(67, 15, 1, 5, ink); line(c, 66, 20, 68, 22, ink); c.R(68, 22, 13, 1, ink)
    postbox(c, 97, 64)


@kit('utility-pole-xfmr', '콘크리트 전신주(완목·애자·원통 변압기 2개·노란 지선 보호관, 2×6)', 2, 6, 'column', solid=[(0, 5)],
     tags=['전신주', '변압기', '거리'], rules='보도 연석 쪽 칸(앞줄 보도). 위 칸들은 도로 위로 겹쳐 그려진다(위층 소품 없는 칸 위에 둔다).', role='prop')
def utility_pole(c, base):
    c.R(5, 4, 6, 88, K('conc', 1)); c.VL(5, 4, 88, K('conc', 3)); c.VL(6, 4, 88, K('conc', 2)); c.VL(9, 4, 88, K('conc', 0)); c.VL(10, 4, 88, K('conc', -1))
    c.VL(4, 4, 88, OL); c.VL(11, 4, 88, OL); c.HL(5, 3, 6, OL); c.HL(5, 4, 6, K('conc', 3))
    for y in range(40, 88, 7): c.R(3 if (y // 7) % 2 else 11, y, 2, 1, K('tekko', 1))
    c.R(0, 10, 30, 3, K('tekko', 0)); c.HL(0, 10, 30, K('tekko', 2)); c.HL(0, 13, 30, OL)
    for ix in (1, 15, 27):
        c.R(ix, 6, 3, 4, K('shiro', 1)); c.P(ix, 6, K('shiro', 2)); c.HL(ix, 5, 3, OL)
    c.R(2, 20, 24, 2, K('tekko', 0)); c.HL(2, 22, 24, OL)
    for ix in (3, 22): c.R(ix, 17, 2, 3, K('shiro', 1))
    for cx in (13, 22):
        c.HL(11, 30, 19, K('tekko', -1)); c.HL(11, 38, 19, K('tekko', -1))
        c.R(cx, 26, 8, 17, K('tairu', 1)); c.VL(cx, 26, 17, K('tairu', 3)); c.VL(cx + 1, 26, 17, K('tairu', 2)); c.VL(cx + 6, 26, 17, K('tairu', 0)); c.VL(cx + 7, 26, 17, K('tairu', -1))
        c.HL(cx, 26, 8, K('tairu', 3)); c.HL(cx, 31, 8, K('tairu', -1)); c.HL(cx, 37, 8, K('tairu', -1)); outline_rect(c, cx - 1, 25, 10, 19)
        c.R(cx + 2, 23, 2, 2, K('shiro', 1)); c.R(cx + 5, 23, 2, 2, K('shiro', 1))
    line(c, 11, 46, 29, 92, OL); line(c, 12, 46, 30, 92, K('tekko', 1))
    for k in range(20):
        y = 72 + k; x = round(11 + (y - 46) * 18 / 46)
        c.R(x - 1, y, 3, 1, K('kii', 1) if (y // 3) % 2 else SUMI2)
        c.P(x - 1, y, K('kii', 2) if (y // 3) % 2 else OL)
    c.R(26, 92, 6, 3, K('conc', -1)); c.HL(3, 92, 10, K('conc', -1)); c.HL(3, 93, 10, OL)


@kit('bus-stop-sign', '버스 정류장 표지(빨강·흰 둥근 판·시각표, 1×3)', 1, 3, 'column', solid=[(0, 2)], tags=['버스', '정류장', '거리'],
     rules='보도 연석 쪽 칸.', role='prop')
def bus_stop(c, base):
    c.R(7, 12, 2, 32, K('tekko', 0)); c.VL(7, 12, 32, K('tekko', 2))
    disc(c, 8, 7, 7, OL); disc(c, 7.5, 6.5, 6.5, K('aka', 0)); disc(c, 7.5, 6.5, 4.5, K('shiro', 2))
    c.HL(4, 6, 8, K('kon', 0)); c.HL(5, 4, 5, K('aka', 1))
    c.R(3, 18, 10, 13, K('shiro', 1)); outline_rect(c, 2, 17, 12, 15); c.HL(3, 18, 10, K('kii', 1))
    for y in range(21, 30, 2): c.HL(4, y, 7 - (y % 3), K('tekko', -1))
    disc(c, 8, 44, 5, K('conc', 0), ry=2.5); c.HL(4, 43, 8, K('conc', 2)); c.HL(4, 46, 9, OL)


@kit('postbox-red', '빨간 우체통(〒, 1×2)', 1, 2, 'column', solid=[(0, 1)], tags=['우체통', '거리'], rules='보도 칸.', role='prop')
def postbox_kit(c, base):
    postbox(c, 1, 2)

# ═══════════════════════════ 깊은 3/4 지붕 ═══════════════════════════
# 2026-10-18 5라운드(참고 A·B 대비): 참고는 집마다 3~4줄 깊이의 3/4 지붕(기와 비탈·용마루, 또는 파라펫 옥상의 실외기·물탱크·계단탑)이 보이고
# 그 아래 정면은 1~2층이다. 우리 것은 1줄 지붕 띠 + 같은 창 3줄 벽이었고, 앞줄 키트(5~6줄)는 7줄 띠 앞에 벽돌 턱을 남겼다.
# -> 앞줄 키트는 위에 깊은 지붕을 얹어 7줄로 키우고(보도까지 꽉), 조립 건물에는 roof-<종류>-<폭> 4줄 지붕 키트를 덮는다(구성기).
ROOF_ROWS = 4
ROOF_WIDTHS = range(3, 11)
ROOF_STYLES = {'kawara': '갈색 골기와', 'kuro': '먹색 골기와', 'tin-aka': '붉은 함석', 'tin-sora': '파란 함석', 'deck': '벽돌색 옥상(계단탑·실외기)', 'dish': '회색 옥상(위성 안테나·실외기·물탱크)'}


def _gable_ends(c, x0, y0, w, y1, ramp, t):
    for y in range(y0 + 1, y1):
        c.P(x0, y, OL); c.P(x0 + 1, y, K(ramp, t + 2)); c.P(x0 + w - 2, y, K(ramp, t - 2)); c.P(x0 + w - 1, y, OL)


def _eave_shadow(c, x0, y, w):
    """처마 밑 그림자 3px(지붕 키트 맨 아래) — 바로 아래 벽 줄과 붙어 처마가 벽 앞으로 나온 것처럼 읽힌다."""
    c.HL(x0, y, w, OL); c.HL(x0, y + 1, w, K('sumi', 2)); c.HL(x0, y + 2, w, K('yoru', 0))


def deep_kawara(c, x0, y0, w, h, ramp='kawara', t=0, seed=0):
    """깊은 골기와 비탈(h px): 용마루 5px · 둥근 골 4px(왼쪽 빛) · 단 6px · 처마 막새 줄 4px · 처마 밑 그림자 3px.
    용마루 쪽 두 단은 한 단 어둡게(비탈이 멀어진다). 무늬는 16px 주기라 폭이 달라도 가운데 칸은 같은 칸으로 묶인다."""
    eave = y0 + h - 7
    for y in range(y0 + 5, eave):
        r = (y - y0 - 5) % 6
        far = 1 if y - y0 < 17 else 0
        for x in range(x0, x0 + w):
            k = (x - x0) % 4
            tt = t - far + (1 if k == 0 else -1 if k == 3 else 0)
            if r == 0: tt += 1
            elif r == 5: tt -= 2
            v = H((x - x0) % 16, y - y0, seed)
            if v < 0.035: tt -= 1
            elif v > 0.975: tt += 1
            c.P(x, y, K(ramp, tt))
    c.HL(x0, y0, w, OL)
    for x in range(x0, x0 + w):
        k = (x - x0) % 8
        c.P(x, y0 + 1, K(ramp, t + 2 if k not in (0, 7) else t))
        c.P(x, y0 + 2, K(ramp, t + 1 if k not in (0, 7) else t - 1))
        c.P(x, y0 + 3, K(ramp, t - 1))
    c.HL(x0, y0 + 4, w, K(ramp, t - 3))
    for x in range(x0, x0 + w):                       # 막새(둥근 기와 끝) 줄
        k = (x - x0) % 4
        c.P(x, eave, K(ramp, t + 1 if k in (1, 2) else t - 1))
        c.P(x, eave + 1, K(ramp, t + 2 if k == 1 else t - 2 if k == 3 else t))
        c.P(x, eave + 2, K(ramp, t if k in (1, 2) else t - 2))
        c.P(x, eave + 3, K(ramp, t - 3 if k == 3 else t - 2))
    _gable_ends(c, x0, y0, w, eave + 4, ramp, t)
    _eave_shadow(c, x0, eave + 4, w)


def tin_roof(c, x0, y0, w, h, ramp='aka', t=0, seed=0):
    """함석 비탈 지붕(h px): 용마루 덮개 · 4px 골 · 20px 판 겹침 줄 · 녹 점·녹물 줄 · 물받이 · 처마 밑 그림자."""
    eave = y0 + h - 7
    for y in range(y0 + 4, eave):
        for x in range(x0, x0 + w):
            k = (x - x0) % 4
            tt = t + (1 if k == 0 else -1 if k == 3 else 0) - (1 if y - y0 < 14 else 0)
            if (y - y0 - 4) % 20 == 19: tt -= 2
            v = H((x - x0) % 16, y - y0, seed + 5)
            rust = K('daidai', -2) if ramp != 'tekko' else K('tekko', t - 2)
            c.P(x, y, rust if v < 0.01 else K(ramp, tt))
    for x in range(x0 + 9, x0 + w, 32):                # 녹물 줄(판 겹침 아래로 흘러내림)
        for y in range(y0 + 24, min(eave, y0 + 31)): c.P(x, y, (K('daidai', -2) if ramp != 'tekko' else K('tekko', t - 2)) if (y - y0) % 3 else K(ramp, t - 2))
    c.HL(x0, y0, w, OL); c.HL(x0, y0 + 1, w, K('tekko', 2)); c.HL(x0, y0 + 2, w, K('tekko', 0)); c.HL(x0, y0 + 3, w, K(ramp, t - 3))
    c.HL(x0, eave, w, K(ramp, t + 1)); c.HL(x0, eave + 1, w, K('tekko', 1)); c.HL(x0, eave + 2, w, K('tekko', -1)); c.HL(x0, eave + 3, w, K('tekko', -2))
    _gable_ends(c, x0, y0, w, eave + 4, ramp, t)
    _eave_shadow(c, x0, eave + 4, w)


def deck_roof(c, x0, y0, w, h, surf=('renga', 1), seed=0, rail=True):
    """평지붕 옥상(h px) 3/4: 뒤·옆 파라펫 윗면, 안쪽 바닥(8px 판, 빛 왼쪽 위 -> 뒤·왼쪽 파라펫 아래 그림자), 앞 철 난간,
    앞 파라펫 윗면 3px + 정면 8px. 반환: (바닥 위 y, 바닥 아래 y, 그림자 색 함수)."""
    ramp, st = surf
    fy = y0 + h - 12

    def floor_col(x, y, d=0):
        seam = (x - x0) % 8 == 7 or (y - y0) % 8 == 7
        v = H((x - x0) % 16, y - y0, seed + 3)
        return K(ramp, st - d + (-1 if seam else (1 if v < 0.07 else -1 if v > 0.95 else 0)))
    for y in range(y0, fy):
        for x in range(x0, x0 + w):
            d = 2 if (y < y0 + 8 or x < x0 + 7) else 0
            c.P(x, y, floor_col(x, y, d))
    c.HL(x0, y0, w, OL); c.HL(x0, y0 + 1, w, K('conc', 3)); c.HL(x0, y0 + 2, w, K('conc', 2)); c.HL(x0, y0 + 3, w, K('conc', -1))
    for y in range(y0 + 1, fy + 3):
        c.P(x0, y, OL); c.P(x0 + 1, y, K('conc', 3)); c.P(x0 + 2, y, K('conc', 2)); c.P(x0 + 3, y, K('conc', -1))
        c.P(x0 + w - 4, y, K('conc', 2)); c.P(x0 + w - 3, y, K('conc', 1)); c.P(x0 + w - 2, y, K('conc', 0)); c.P(x0 + w - 1, y, OL)
    if rail:                                           # 앞 철 난간(세로 살 4px)
        c.HL(x0 + 4, fy - 9, w - 8, K('tekko', 2)); c.HL(x0 + 4, fy - 8, w - 8, K('tekko', -1))
        for x in range(x0 + 5, x0 + w - 4, 4):
            c.VL(x, fy - 7, 7, K('tekko', 1)); c.P(x + 1, fy - 1, floor_col(x + 1, fy - 1, 2))
    c.HL(x0, fy, w, K('conc', 3)); c.HL(x0, fy + 1, w, K('conc', 2)); c.HL(x0, fy + 2, w, K('conc', 1)); c.HL(x0, fy + 3, w, OL)
    for y in range(fy + 4, y0 + h - 1):
        c.HL(x0, y, w, K('conc', 0 if y < fy + 9 else -1))
    c.HL(x0, fy + 6, w, K('conc', 1)); c.VL(x0, fy + 4, h - (fy - y0) - 4, OL); c.VL(x0 + w - 1, fy + 4, h - (fy - y0) - 4, OL)
    c.HL(x0, y0 + h - 1, w, K('yoru', 0))
    return floor_col


def water_tank(c, x, y, shade):
    """옥상 물탱크(14×22): 다리 · 파란 원통 · 둥근 뚜껑 · 오른쪽 아래 그림자."""
    c.R(x + 4, y + 21, 14, 3, shade)
    for lx in (x + 2, x + 11): c.VL(lx, y + 14, 8, K('tekko', -1)); c.P(lx, y + 14, K('tekko', 1))
    c.HL(x + 1, y + 18, 12, K('tekko', 0))
    c.R(x, y + 3, 14, 12, K('sora', 1)); c.VL(x, y + 3, 12, K('sora', 2)); c.VL(x + 1, y + 3, 12, K('sora', 2)); c.VL(x + 13, y + 3, 12, K('sora', -1))
    c.HL(x, y + 8, 14, K('sora', 0)); c.HL(x, y + 14, 14, K('sora', -1))
    disc(c, x + 6.5, y + 3, 7, K('sora', 0), ry=3); disc(c, x + 6.5, y + 3, 5.5, K('sora', 2), ry=2); c.R(x + 5, y + 1, 4, 2, K('shiro', 1))
    c.VL(x - 1, y + 3, 12, OL); c.VL(x + 14, y + 3, 12, OL)


def penthouse(c, x, y, shade, w=22, h=24):
    """계단탑(塔屋): 평지붕 윗면 · 정면 회벽 · 철문 · 작은 창 · 오른쪽 그림자."""
    c.R(x + w, y + 5, 4, h - 3, shade); c.R(x + 3, y + h, w, 3, shade)
    c.R(x, y, w, 6, K('conc', 2)); c.HL(x, y + 1, w, K('conc', 3)); c.HL(x, y + 6, w, K('conc', -1))
    c.R(x, y + 7, w, h - 7, K('conc', 0)); c.VL(x + 1, y + 7, h - 7, K('conc', 1))
    c.R(x + w - 9, y + 10, 6, h - 10, K('tekko', -1)); c.VL(x + w - 9, y + 10, h - 10, K('tekko', 1)); c.P(x + w - 5, y + 17, K('kii', 1))
    c.R(x + 4, y + 10, 6, 5, K('garasu', 1)); c.P(x + 4, y + 10, K('garasu', 2))
    outline_rect(c, x, y, w, h)


def sat_dish(c, cx, cy, shade):
    import math
    disc(c, cx + 5, cy + 6, 8, shade, ry=5)
    c.VL(cx, cy + 1, 8, K('tekko', -1)); c.R(cx - 3, cy + 8, 7, 3, K('tekko', 0))
    disc(c, cx, cy, 7, K('shiro', 0), ry=5); disc(c, cx - 1, cy - 1, 6, K('shiro', 1), ry=4); disc(c, cx - 2, cy - 2, 3, K('shiro', 2), ry=2)
    for t in range(20, 200, 12):
        c.P(round(cx + 7 * math.cos(math.radians(t))), round(cy + 5 * math.sin(math.radians(t))), K('shiro', -2))
    line(c, cx, cy, cx + 7, cy - 6, K('tekko', -1)); c.R(cx + 6, cy - 7, 3, 3, K('tekko', 1))


def roof_items(c, style, W, col):
    """옥상 기물: 폭(px)에 맞춰 계단탑·위성 안테나·실외기·물탱크를 겹치지 않게 놓는다."""
    sh = col(0, 0, 3) if col else K('yoru', 0)
    if style == 'deck':
        if W >= 64: penthouse(c, 7, 9, sh)
        if W >= 96: ac_unit(c, W - 24, 26, 14, 10)
        if W >= 128: ac_unit(c, W - 44, 26, 14, 10)
        if W < 64: ac_unit(c, 10, 24, 14, 10)
    else:
        sat_dish(c, 16, 22, sh)
        if W >= 80: ac_unit(c, W - 24, 26, 14, 10)
        if W >= 112: water_tank(c, W // 2 - 4, 10, sh)


def _roof_kit(style, w):
    def draw(c, base):
        W, Hh = w * 16, ROOF_ROWS * 16
        if style == 'kawara': deep_kawara(c, 0, 0, W, Hh, 'kawara', 0, seed=1)
        elif style == 'kuro': deep_kawara(c, 0, 0, W, Hh, 'tekko', -1, seed=2)
        elif style == 'tin-aka': tin_roof(c, 0, 0, W, Hh, 'aka', -1, seed=3)
        elif style == 'tin-sora': tin_roof(c, 0, 0, W, Hh, 'sora', -1, seed=4)
        else:
            col = deck_roof(c, 0, 0, W, Hh, ('renga', 1) if style == 'deck' else ('conc', 0), seed=5)
            roof_items(c, style, W, col)
    return draw


for _st, _nm in ROOF_STYLES.items():
    for _w in ROOF_WIDTHS:
        kit('roof-%s-%d' % (_st, _w), '깊은 3/4 지붕 · %s (%d×%d)' % (_nm, _w, ROOF_ROWS), _w, ROOF_ROWS, 'structure', solid=rows(_w, range(ROOF_ROWS)),
            tags=['지붕', '깊은 지붕', '시타마치'], rules='조립 건물 맨 윗줄에 덮는다(조립 지붕 2줄 + 맨 위층 2줄을 가린다). 시타마치·쇼텐가이 구성기가 쓴다.',
            role='building')(_roof_kit(_st, _w))


# ═══════════════════════════ 7줄 앞줄 키트 ═══════════════════════════
def _lift(fn, w, old_h, dy):
    """옛 키트 그림(old_h 줄)을 dy px 내려 그린다 — 위 dy px 는 새 깊은 지붕 자리."""
    def draw(c, base):
        u, b = _cv(w, old_h), _cv(w, old_h)
        fn(u, b)
        c.a[dy:dy + old_h * 16] = u.a; base.a[dy:dy + old_h * 16] = b.a
    return draw


FRONT_RULES = '앞줄 7줄 띠를 꽉 채운다: 발(맨 아랫줄)이 앞 보도 바로 위, 지붕이 뒷골목 바로 아래.'


@kit('shop-greengrocer', '청과물 가게(깊은 먹색 기와·2층 간판·파란 차양·전구·청과 상자 진열, 6×7)', 6, 7, 'structure', solid=rows(6, range(7)),
     tags=['가게', '청과', '시타마치'], rules=FRONT_RULES, role='building')
def greengrocer7(c, base):
    _lift(shop_greengrocer, 6, 5, 32)(c, base)
    deep_kawara(c, 0, 0, 96, 47, 'tekko', -1, seed=4)


@kit('izakaya-brick-wall', '대중주점(옥상 파라펫·실외기 + 붉은 벽돌 벽·흰 간판·노렌·붉은 등롱·전선관, 4×7)', 4, 7, 'structure', solid=rows(4, range(7)),
     tags=['가게', '이자카야', '벽돌', '시타마치'], rules=FRONT_RULES, role='building')
def izakaya7(c, base):
    _lift(izakaya_brick, 4, 5, 32)(c, base)
    col = deck_roof(c, 0, 0, 64, 44, ('conc', 0), seed=6)
    ac_unit(c, 8, 14, 14, 10); c.R(36, 10, 14, 10, K('shiro', 0)); c.HL(36, 10, 14, K('shiro', 2)); c.HL(36, 20, 15, col(0, 0, 3)); outline_rect(c, 36, 10, 14, 10)
    c.R(58, 44, 3, 36, K('tekko', 0)); c.VL(58, 44, 36, K('tekko', 2)); c.VL(60, 44, 36, K('tekko', -2))


@kit('vending-stripe-alcove', '줄무늬 차양 자판기 골목(함석 지붕·흰 음료 자판기·휴지통, 3×7)', 3, 7, 'structure', solid=rows(3, range(7)),
     tags=['자판기', '골목', '시타마치'], rules=FRONT_RULES, role='building')
def vending7(c, base):
    _lift(vending_alcove, 3, 5, 32)(c, base)
    tin_roof(c, 0, 0, 48, 42, 'tekko', 0, seed=7)


@kit('fg-tiled-balcony', '골기와 2층 집(깊은 갈색 박공 지붕·굴뚝, 2층 발코니·난간·화분·실외기, 1층 셔터·현관, 6×7)', 6, 7, 'structure', solid=rows(6, range(7)),
     tags=['건물', '기와', '발코니', '시타마치'], rules=FRONT_RULES, role='building')
def balcony7(c, base):
    _lift(fg_balcony, 6, 5, 32)(c, base)
    deep_kawara(c, 0, 0, 96, 58, 'kawara', 0, seed=8)
    c.R(70, 18, 10, 18, K('kawara', -3))                                                   # 굴뚝 그림자(오른쪽 아래)
    c.R(64, 8, 9, 22, K('conc', 0)); c.VL(64, 8, 22, K('conc', 2)); c.VL(72, 8, 22, K('conc', -2))
    c.R(63, 5, 11, 4, K('conc', 2)); c.HL(63, 5, 11, K('conc', 3)); outline_rect(c, 63, 4, 11, 26)


@kit('fg-rooftop-dish', '평지붕 2층 건물(깊은 옥상: 난간·위성 안테나·계단탑·실외기, 2층 골함석 벽·1층 가게, 6×7)', 6, 7, 'structure', solid=rows(6, range(7)),
     tags=['건물', '옥상', '시타마치'], rules=FRONT_RULES, role='building')
def rooftop7(c, base):
    _lift(fg_rooftop, 6, 5, 32)(c, base)
    col = deck_roof(c, 0, 0, 96, 62, ('renga', 1), seed=9)
    sh = col(0, 0, 3)
    sat_dish(c, 16, 22, sh); penthouse(c, 36, 8, sh); ac_unit(c, 70, 28, 14, 10); ac_unit(c, 70, 12, 14, 10)


@kit('coin-parking', '코인 주차장(벽돌 건물 옆벽·P 간판·노란 주차선 3칸·초록 차양 정산기·비상계단, 8×7)', 8, 7, 'structure',
     solid=rows(8, (0, 1, 2)) + [(6, 3), (6, 4)], other='star', tags=['주차', '코인 주차', '상점가'],
     rules='앞줄 7줄 띠. 아래 4줄은 아스팔트 바닥(걷는 칸)이고 앞 보도에 붙는다.', role='building')
def coin7(c, base):
    _lift(coin_parking, 8, 6, 16)(c, base)
    brick_wall(c, 0, 0, 128, 16, 'renga', -1, bw=8, bh=4, seed=6)
    c.HL(0, 0, 128, OL); c.R(0, 1, 128, 3, K('conc', 2)); c.HL(0, 1, 128, K('conc', 3)); c.HL(0, 4, 128, K('conc', -1))
    c.VL(96, 5, 14, K('tekko', 0)); c.VL(127, 5, 14, K('tekko', 0))                         # 비상계단 위 층계참
    c.R(96, 9, 32, 2, K('tekko', 1)); c.HL(96, 11, 32, K('tekko', -2))
    for x in range(98, 127, 4): c.VL(x, 5, 4, K('tekko', 1))


@kit('shotengai-canopy', '상점가 아케이드(깊은 붉은 함석 차양·철 기둥 6개·파란 깃발·청과/정육/반찬 진열, 8×7)', 8, 7, 'structure',
     solid=rows(8, (3, 4, 5)), tags=['상점가', '아케이드', '시장'], rules='앞줄 7줄 띠. 맨 아랫줄은 차양 밑 걷는 바닥.', role='building')
def canopy7(c, base):
    _lift(shotengai_canopy, 8, 6, 16)(c, base)
    for y in range(0, 52):
        for x in range(128):
            k = x % 5; t = 1 if k == 0 else -1 if k == 4 else 0
            if y % 12 == 11: t -= 1
            if y % 12 == 0: t += 1
            if y < 14: t -= 1                                                               # 차양 위쪽이 멀어진다
            c.P(x, y, K('daidai', -1) if H(x, y // 2, 61) < 0.012 else K('aka', t))
    c.HL(0, 0, 128, OL); c.HL(0, 1, 128, K('aka', 2)); c.HL(0, 2, 128, K('aka', -2))


@kit('shotengai-arch', '大門通 상점가 아치(깊은 먹색 기와·간판 문·채광 볼트 지붕·청회색 타일 통로·빨간 우체통, 7×7)', 7, 7, 'structure',
     solid=[(x, 0) for x in range(6)] + [(0, 4), (0, 5), (0, 6), (5, 4), (5, 5), (5, 6), (6, 6)], tags=['상점가', '아치', '아케이드', '우체통'],
     rules='앞줄 7줄 띠. 통로 바닥(가운데 4칸)이 보도로 이어진다.', role='building')
def arch7(c, base):
    _lift(shotengai_arch, 7, 6, 16)(c, base)
    deep_kawara(c, 0, 0, 96, 23, 'tekko', -1, seed=10)


def leafy_canopy(c, blobs, seed=0):
    """여러 덩이 잎 뭉치(5단 명암): 오른쪽 아래 그늘 -> 몸통 -> 중간 -> 빛 받은 왼쪽 위 덩이 -> 잎 끝 반짝임, 잎결 점."""
    for bx, by, r in blobs: disc(c, bx + 2, by + 3, r, K('ki', -3))
    for bx, by, r in blobs: disc(c, bx, by, r, K('ki', -2))
    for bx, by, r in blobs: disc(c, bx - 1, by - 1, r - 2, K('ki', -1))
    for bx, by, r in blobs: disc(c, bx - r // 4 - 1, by - r // 4 - 1, max(2, r * 3 // 5), K('ki', 0))
    for bx, by, r in blobs: disc(c, bx - r // 3 - 1, by - r // 3 - 1, max(1, r // 3), K('ki', 1))
    for bx, by, r in blobs: disc(c, bx - r // 3 - 2, by - r // 3 - 2, max(1, r // 6), K('ki', 2))
    x0 = min(b[0] - b[2] for b in blobs) - 2; x1 = max(b[0] + b[2] for b in blobs) + 4
    y0 = min(b[1] - b[2] for b in blobs) - 2; y1 = max(b[1] + b[2] for b in blobs) + 5
    for y in range(max(0, y0), min(c.h, y1)):
        for x in range(max(0, x0), min(c.w, x1)):
            if not c.a[y, x, 3] or c.a[y, x, 1] <= c.a[y, x, 0]: continue
            v = H(x, y, 40 + seed)
            px = (int(c.a[y, x, 0]) << 16) | (int(c.a[y, x, 1]) << 8) | int(c.a[y, x, 2])
            if v < 0.07: c.P(x, y, K('ki', 2) if px == K('ki', 1) else K('ki', 1))
            elif v > 0.92: c.P(x, y, K('ki', -3))


@kit('alley-stair-tree', '골목 계단(3칸 폭 콘크리트 계단·양옆 낮은 벽·손잡이·층계참·2층 현관)·붉은 울타리 화단의 큰 느티나무·메뉴판 타일 기둥·맥주 상자(6×7)', 6, 7, 'structure',
     solid=[(0, y) for y in range(7)] + [(x, y) for x in (1, 2, 3) for y in (0, 1)] + [(x, y) for x in (4, 5) for y in range(7)],
     tags=['골목', '계단', '나무', '시타마치'], rules='앞줄 7줄 띠, 건물 사이. 가운데 3칸 계단(3~7줄)은 걷는 바닥 — 맨 위 2줄은 2층 현관.', role='building')
def alley_stair7(c, base):
    """참고 A 가운데: 두 건물 사이 3칸 폭 계단이 2층 현관으로 오르고, 오른쪽 붉은 울타리 화단의 큰 느티나무가 계단 위로 드리운다. 왼쪽 벽의 사선 그림자."""
    # 계단(바닥 층): 층계참 y36~47 · 단 8개(7px) y48~103 · 보도 문턱 y104~111
    for y in range(36, 112):
        for x in range(16, 64):
            if y >= 104: col = slab_px(x, y)
            elif y < 48: col = K('conc', 2 if y == 36 else 1)
            else:
                k = (y - 48) % 7
                col = K('conc', 3 if k == 0 else 2 if k < 4 else 0 if k < 6 else -2)
            if y < 104 and (x - 16) < 24 - (y - 36) // 3:                                    # 왼쪽 벽이 던지는 사선 그림자(빛 왼쪽 위)
                col = K('conc', (-1 if y >= 48 and (y - 48) % 7 >= 4 else 0) - 1)
            base.P(x, y, col)
    # 2층 현관(처마 + 회벽 + 문 + 문등 + 우편함)이 계단 위를 닫는다
    deep_kawara(c, 16, 0, 48, 16, 'tekko', -1, seed=12)
    plaster(c, 16, 16, 48, 20, 'kinari', 0, seed=13)
    c.R(22, 18, 12, 17, K('ita', 0)); outline_rect(c, 21, 17, 14, 19); c.VL(27, 18, 17, K('ita', -2)); c.P(31, 26, K('kii', 1))
    c.R(37, 20, 3, 3, K('mado', 2)); c.P(38, 23, K('mado', 0))
    c.HL(16, 35, 48, K('kinari', -2))
    # 양옆 낮은 벽(계단 따라 내려온다): 왼쪽은 윗면 밝게, 오른쪽은 손잡이
    for y in range(36, 104):
        c.P(16, y, OL); c.P(17, y, K('conc', 3)); c.P(18, y, K('conc', 2)); c.P(19, y, K('conc', 0)); c.P(20, y, K('conc', -2))
        c.P(59, y, K('conc', 2)); c.P(60, y, K('conc', 1)); c.P(61, y, K('conc', 0)); c.P(62, y, K('conc', -1)); c.P(63, y, OL)
    for y in range(38, 102): c.P(56, y, K('tekko', 2)); c.P(57, y, K('tekko', -1))
    for y in range(40, 102, 9): c.HL(55, y, 4, K('tekko', 1))
    # 왼쪽 기둥: 타일 + 검은 메뉴판 + 맥주 상자(노랑·빨강)
    c.R(0, 0, 16, 6, K('conc', 2)); c.HL(0, 0, 16, OL); c.HL(0, 5, 16, K('conc', -1))
    for y in range(6, 112):
        for x in range(0, 16):
            c.P(x, y, K('tairu', -1) if (x % 5 == 4 or (y - 6) % 5 == 4) else K('tairu', 1 if x < 3 else 0))
    c.VL(15, 0, 112, OL)
    c.R(3, 30, 10, 34, OL); c.R(4, 31, 8, 32, K('sumi', 2)); glyphs(c, 5, 33, 4, K('shiro', 1), size=4, gap=3, seed=31, vertical=True)
    c.R(2, 64, 12, 2, K('ita', 0))
    for k, (cy, ramp) in enumerate(((82, 'kii'), (93, 'aka'))):
        c.R(1, cy, 14, 9, K(ramp, 0)); c.HL(1, cy, 14, K(ramp, 1)); outline_rect(c, 0, cy - 1, 16, 11)
        for bx in range(3, 14, 3): c.P(bx, cy + 1, K('midori', -1) if k else K('ita', 1)); c.P(bx, cy + 2, K('shiro', 1))
        for bx in range(2, 14, 4): c.VL(bx, cy + 4, 3, K(ramp, -1))
    c.HL(0, 103, 16, K('yoru', -1))
    # 오른쪽: 옆집 기와 모서리 + 회벽 옆면, 붉은 울타리 화단(흙·덤불), 줄기·가지, 큰 잎 뭉치(계단 위로 드리운다)
    deep_kawara(c, 64, 0, 32, 22, 'kawara', 0, seed=14)
    plaster(c, 64, 22, 32, 60, 'conc', 0, seed=14); c.VL(64, 22, 60, OL)
    c.R(70, 30, 10, 12, K('garasu', 0)); outline_rect(c, 69, 29, 12, 14, K('tekko', -2))
    c.R(64, 82, 32, 22, K('soil', -1)); c.HL(64, 82, 32, K('soil', 0))
    for bx in (68, 86, 92): disc(c, bx, 85, 4, K('ki', -1)); disc(c, bx - 1, 84, 2, K('ki', 1))
    c.R(73, 52, 8, 40, K('ita', -1)); c.VL(73, 52, 40, K('ita', 1)); c.VL(74, 52, 40, K('ita', 0)); c.VL(80, 52, 40, K('ita', -3))
    for y in range(56, 90, 6): c.HL(75, y, 3, K('ita', -2))
    line(c, 75, 60, 60, 44, K('ita', -1)); line(c, 75, 61, 60, 45, K('ita', -2)); line(c, 79, 58, 90, 44, K('ita', -1))
    for x in range(64, 96, 5): c.VL(x, 88, 16, K('aka', 0)); c.P(x, 88, K('aka', 2))
    c.HL(64, 89, 32, K('aka', 2)); c.HL(64, 90, 32, K('aka', 0)); c.HL(64, 96, 32, K('aka', 1)); c.HL(64, 103, 32, K('aka', -1))
    c.R(64, 104, 32, 8, K('conc', 0)); c.HL(64, 104, 32, K('conc', 2)); c.HL(64, 111, 32, K('conc', -2)); c.VL(64, 88, 24, OL)
    leafy_canopy(c, ((64, 34, 15), (48, 26, 11), (80, 18, 13), (84, 44, 11), (44, 46, 9), (62, 12, 11), (70, 56, 10), (54, 54, 9), (88, 6, 7), (34, 52, 6)), seed=2)



# ═══════════════════════════ 상점가 아케이드(비 가림 지붕) ═══════════════════════════
# 2026-10-18 사용자 반려 「대문통 이거 맞냐? 이건 대형 시장용... 손님들 비 맞는 거 방지하는 그런거잖아」: 상점가 아케이드는 길 한가운데 홀로 선
# 간판 문이 아니라 보행자 길 전체를 덮는 비 가림 지붕(반투명 채광 볼트)이고, 길 어귀에 간판 아치가 선다. 구성기(shotengai)는 세로 길을 보행자
# 아케이드로 바꾼다: 줄마다 arcade-roof-<w>(세 줄마다 철 아치·깃발 -rib), 양 어귀에 arcade-gate-<w>(기둥이 길 양옆 한 칸씩 밖에 선다).
ARCADE_WIDTHS = (4, 5)
STALLS = ('produce', 'fish', 'meat', 'croquette', 'produce', 'tea')


def stall(c, x0, kind, seed=0):
    """처마 밑 진열대(폭 10px, 16px 줄 하나) - 나무 받침 위 상품. 줄마다 이어 붙어도 이음새가 안 보이게 받침은 위아래 끝까지 간다."""
    c.R(x0, 0, 10, 16, K('ita', -1)); c.VL(x0, 0, 16, K('ita', 1)); c.VL(x0 + 9, 0, 16, K('ita', -3))
    if kind == 'produce':
        crate(c, x0, 0, 10, 8, PRODUCE[seed % len(PRODUCE)], seed=seed); crate(c, x0, 8, 10, 8, PRODUCE[(seed + 4) % len(PRODUCE)], seed=seed + 1)
    elif kind == 'fish':                                   # 스티로폼 상자 + 얼음 + 생선(은빛·붉은 도미)
        for y0 in (1, 9):
            c.R(x0 + 1, y0, 8, 6, K('shiro', 1)); c.HL(x0 + 1, y0, 8, K('shiro', 2)); c.HL(x0 + 1, y0 + 5, 8, K('shiro', -1))
            for i in range(x0 + 2, x0 + 8): c.P(i, y0 + 2 + (i % 2), K('sora', 2))
            ramp = 'aka' if (seed + y0) % 3 == 0 else 'tekko'
            c.HL(x0 + 2, y0 + 2, 5, K(ramp, 1)); c.HL(x0 + 2, y0 + 3, 5, K(ramp, -1)); c.P(x0 + 7, y0 + 2, K(ramp, 0)); c.P(x0 + 7, y0 + 4, K(ramp, 0)); c.P(x0 + 2, y0 + 2, OL)
    elif kind == 'meat':                                   # 흰 유리 진열장 + 분홍 고기 덩이
        c.R(x0, 0, 10, 16, K('shiro', 0)); c.VL(x0, 0, 16, K('shiro', 2)); c.R(x0 + 1, 2, 8, 12, K('garasu', 2))
        for y in (3, 7, 11): c.R(x0 + 2, y, 3, 2, K('pinku', 0)); c.P(x0 + 2, y, K('pinku', 2)); c.R(x0 + 6, y, 2, 2, K('aka', -1))
    elif kind == 'croquette':                              # 쟁반 위 고로케·튀김(노릇)
        for y0 in (1, 9):
            c.R(x0 + 1, y0, 8, 6, K('shiro', 1)); c.HL(x0 + 1, y0 + 5, 8, K('shiro', -1))
            for i in range(x0 + 2, x0 + 8, 3): c.R(i, y0 + 1, 2, 2, K('daidai', 0)); c.P(i, y0 + 1, K('kii', 1)); c.P(i + 1, y0 + 3, K('daidai', -1))
    else:                                                  # 찻잎·건어물 통
        for y0 in (1, 9):
            c.R(x0 + 1, y0, 8, 6, K('ita', 1)); c.HL(x0 + 1, y0, 8, K('ita', 2))
            for i in range(x0 + 2, x0 + 8): c.P(i, y0 + 2, K('yuka' if (i + seed) % 2 else 'kii', -1)); c.P(i, y0 + 3, K('yuka', -2))


def _arcade_roof(w, rib):
    """한 줄짜리 아케이드 지붕 칸(위층) + 통로 바닥·진열대(바닥 층). 16px 주기라 줄을 이어 찍으면 한 덩이 볼트가 된다.
    처마(양쪽 7px)는 막힌 함석, 가운데 볼트는 반투명 채광판(화소 3/4 만 칠한 망점 - 밑의 사람·바닥이 비친다), 철 도리(세로 줄)·용마루 빛."""
    def draw(c, base):
        W = w * 16
        fill_tex(base, 16, 0, W - 32, 16, tile_px)
        fill_tex(base, 0, 0, 16, 16, tile_px, shade=2); fill_tex(base, W - 16, 0, 16, 16, tile_px, shade=2)
        k = w + (3 if rib else 0)
        stall(base, 6, STALLS[k % len(STALLS)], seed=k); stall(base, W - 16, STALLS[(k + 3) % len(STALLS)], seed=k + 2)
        for y in range(16): base.P(16, y, tile_px(16, y, shade=2)); base.P(W - 17, y, tile_px(W - 17, y, shade=1))   # 처마 그늘 가장자리
        lo, hi = 7, W - 8
        for y in range(16):
            cor = 1 if y % 4 == 0 else -1 if y % 4 == 3 else 0
            for i, t in enumerate((None, 2, 0, -1, 1, 0, -1)):          # 왼쪽 처마: 윤곽 · 물받이(빛) · 함석 비탈
                c.P(i, y, OL if t is None else K('tekko' if i < 4 else 'sora', t + (cor if i >= 4 else 0)))
            for i, t in enumerate((-1, -2, -2, -2, 0, -2, None)):       # 오른쪽 처마(그늘)
                c.P(hi + 1 + i, y, OL if t is None else K('sora' if i < 3 else 'tekko', t + (cor if i < 3 else 0)))
            for x in range(lo + 1, hi):
                if x % 2 and y % 2: continue                            # 망점 구멍(반투명)
                rel = (x - lo) / (hi - lo)
                c.P(x, y, K('garasu', 3 if rel < 0.18 else 2 if rel < 0.5 else 1 if rel < 0.78 else 0))
            c.P(lo, y, K('tekko', 1)); c.P(hi, y, K('tekko', -1))
            for qx, t in ((lo + (hi - lo) // 4, 0), (W // 2, 2), (W // 2 + 1, 0), (lo + 3 * (hi - lo) // 4, -1)): c.P(qx, y, K('tekko', t))
        if rib:                                                          # 철 아치 트러스 + 매단 깃발 둘 + 붉은 초롱
            c.HL(lo, 0, hi - lo + 1, K('tekko', 2)); c.HL(lo, 1, hi - lo + 1, K('tekko', 0)); c.HL(lo, 5, hi - lo + 1, K('tekko', 1)); c.HL(lo, 6, hi - lo + 1, K('tekko', -2))
            for x in range(lo, hi - 3, 4): line(c, x, 2, x + 2, 4, K('tekko', 0))
            for fx in (lo + 2, hi - 7):
                c.R(fx, 7, 6, 8, K('sora', 0)); c.VL(fx, 7, 8, K('sora', 1)); c.VL(fx + 5, 7, 8, K('sora', -1)); c.R(fx + 1, 8, 4, 5, K('shiro', 2))
                glyphs(c, fx + 1, 8, 1, K('sora', -1), size=4, seed=fx); c.P(fx, 15, K('sora', 0)); c.P(fx + 2, 15, K('sora', 0)); c.P(fx + 4, 15, K('sora', 0))
            lantern(c, W // 2 - 4, 7, 8, 9)
        else:
            c.HL(lo, 0, hi - lo + 1, K('tekko', 1)); c.HL(lo, 1, hi - lo + 1, K('tekko', -1))
    return draw


def _shotengai_text(c, x, y, ink):
    """「商店街」 손 글자(각 14×14, 2px 간격)."""
    # 商
    c.R(x + 6, y, 2, 2, ink); c.R(x + 1, y + 2, 12, 1, ink); c.P(x + 4, y + 3, ink); c.P(x + 9, y + 3, ink)
    c.R(x + 1, y + 5, 12, 1, ink); c.R(x + 1, y + 5, 1, 9, ink); c.R(x + 12, y + 5, 1, 9, ink); c.P(x + 11, y + 13, ink)
    line(c, x + 5, y + 6, x + 4, y + 8, ink); line(c, x + 8, y + 6, x + 9, y + 8, ink); outline_rect(c, x + 4, y + 9, 6, 4, ink)
    x += 16                                                          # 店
    c.R(x + 7, y, 2, 2, ink); c.R(x + 2, y + 2, 11, 1, ink); c.R(x + 2, y + 2, 1, 8, ink); line(c, x + 2, y + 10, x, y + 13, ink)
    c.R(x + 7, y + 3, 1, 5, ink); c.R(x + 8, y + 5, 4, 1, ink); outline_rect(c, x + 5, y + 8, 7, 5, ink)
    x += 16                                                          # 街
    line(c, x + 3, y, x, y + 3, ink); line(c, x + 3, y + 3, x, y + 6, ink); c.R(x + 2, y + 5, 1, 9, ink)
    for yy in (0, 5): c.R(x + 5, y + yy + 2, 3, 1, ink); c.R(x + 6, y + yy, 1, 5, ink); c.R(x + 4, y + yy + 4, 5, 1, ink)
    c.R(x + 10, y + 1, 4, 1, ink); c.R(x + 9, y + 4, 5, 1, ink); c.R(x + 12, y + 4, 1, 9, ink); c.P(x + 11, y + 12, ink)


def _arcade_gate(w):
    """아케이드 어귀 간판 아치(w×3): 길 양옆 보도 칸에 철 기둥, 위에 「商店街」 간판, 그 밑으로 볼트 지붕 단면(철 아치 + 채광판), 깃발·초롱."""
    def draw(c, base):
        G = w * 16                                                      # 길 폭 그대로 - 기둥은 길 양옆 보도 칸에 선다(바로 옆 열은 가게가 붙는다)
        fill_tex(base, 16, 0, G - 32, 48, tile_px)
        S0, S1 = 14, G - 15
        import math
        for x in range(S0, S1 + 1):                                     # 볼트 단면: 간판 밑 반원 아치(가운데 높고 기둥 쪽 낮다)
            yc = 22 + round(11 * (1 - math.sin(math.pi * (x - S0) / (S1 - S0))))
            for y in range(21, yc):
                if x % 2 and y % 2: continue
                c.P(x, y, K('garasu', 2 if x < G // 2 else 1))
            c.P(x, yc, K('tekko', 2)); c.P(x, yc + 1, K('tekko', 0)); c.P(x, yc + 2, K('tekko', -2)); c.P(x, yc + 3, OL)
        for px in (2, G - 14):                                          # 철 기둥(빛 왼쪽) + 받침
            c.R(px, 18, 12, 30, K('tekko', 0)); c.VL(px + 1, 18, 30, K('tekko', 2)); c.VL(px + 2, 18, 30, K('tekko', 1)); c.VL(px + 10, 18, 30, K('tekko', -2))
            outline_rect(c, px, 18, 12, 30); c.R(px - 1, 42, 14, 6, K('conc', 0)); c.HL(px - 1, 42, 14, K('conc', 2)); c.HL(px - 1, 47, 14, OL)
            for y in range(24, 40, 6): c.HL(px + 2, y, 8, K('tekko', -1))
        for fx in (S0 + 1, S1 - 6):                                     # 기둥 안쪽 상점가 깃발
            c.R(fx, 27, 6, 14, K('sora', 0)); c.VL(fx, 27, 14, K('sora', 1)); c.VL(fx + 5, 27, 14, K('sora', -1)); c.R(fx + 1, 29, 4, 9, K('shiro', 2))
            glyphs(c, fx + 1, 29, 2, K('sora', -1), size=4, gap=1, seed=fx, vertical=True)
        lantern(c, G // 2 - 4, 23, 8, 11)
        c.R(0, 0, G, 21, K('kon', -1)); outline_rect(c, 0, 0, G, 21)                 # 간판: 남색 틀 · 흰 판 · 붉은 띠
        c.HL(1, 1, G - 2, K('kon', 1)); c.R(4, 3, G - 8, 15, K('shiro', 2)); c.HL(4, 3, G - 8, K('aka', 0)); c.HL(4, 4, G - 8, K('aka', -1))
        _shotengai_text(c, G // 2 - 23, 5, K('kon', 0))
        c.HL(0, 21, G, K('kon', -2)); c.HL(4, 17, G - 8, K('shiro', -1))
    return draw


for _w in ARCADE_WIDTHS:
    kit('arcade-roof-%d' % _w, '상점가 아케이드 비 가림 지붕 한 줄(반투명 채광 볼트·함석 처마·처마 밑 진열대, %d×1)' % _w, _w, 1, 'structure', solid=[(0, 0), (_w - 1, 0)],
        tags=['상점가', '아케이드', '지붕', '시장'], rules='세로 보행자 길(폭 %d) 한 줄마다. 양옆 칸은 가게 진열대(막힘), 가운데는 지붕 밑 통로.' % _w, role='building')(_arcade_roof(_w, False))
    kit('arcade-roof-%d-rib' % _w, '상점가 아케이드 지붕 한 줄 · 철 아치 트러스(깃발·초롱, %d×1)' % _w, _w, 1, 'structure', solid=[(0, 0), (_w - 1, 0)],
        tags=['상점가', '아케이드', '지붕', '시장'], rules='arcade-roof-%d 사이 세 줄마다.' % _w, role='building')(_arcade_roof(_w, True))
    kit('arcade-gate-%d' % _w, '상점가 아케이드 어귀 간판 아치(「商店街」·철 기둥·볼트 단면·깃발·초롱, %d×3)' % _w, _w, 3, 'structure', solid=[(0, 2), (_w - 1, 2)],
        tags=['상점가', '아케이드', '아치', '시장'], rules='아케이드 길 어귀(큰길 보도 쪽 끝). x 는 길 왼쪽 보도 칸(기둥이 양옆 보도 칸에 선다).', role='building')(_arcade_gate(_w))


# ═══════════════════════════ 시장 가게(정육·생선·약국·다방) ═══════════════════════════
MARKET = {
    'butcher': ('정육·고로케 가게', 'tin-aka', 'aka', 'shiro'),
    'fish': ('생선 가게', 'kawara', 'sora', 'shiro'),
    'drug': ('약국', 'deck', 'kii', 'kon'),
    'kissa': ('옛 다방(喫茶)', 'kuro', 'ita', 'kinari'),
}


def _market_shop(kind):
    """4×7 시장 가게: 깊은 지붕 32px · 2층 벽(창·세로 돌출 간판) · 가게 간판 띠 · 차양 · 열린 가게 앞 진열(종류별)."""
    nm, roof, sign, ink = MARKET[kind]
    gs = 50 + 7 * list(MARKET).index(kind)                       # 간판 획 시드(종류마다 고정)
    def draw(c, base):
        W = 64
        if roof == 'tin-aka': tin_roof(c, 0, 0, W, 32, 'aka', -1, seed=21)
        elif roof == 'kawara': deep_kawara(c, 0, 0, W, 32, 'kawara', 0, seed=22)
        elif roof == 'kuro': deep_kawara(c, 0, 0, W, 32, 'tekko', -1, seed=23)
        else: roof_items(c, 'dish', W, deck_roof(c, 0, 0, W, 32, ('conc', 0), seed=24))
        if kind == 'kissa':
            for y in range(32, 64):
                for x in range(W): c.P(x, y, K('ita', (1 if x % 8 == 0 else -1 if x % 8 == 7 else 0) - (1 if H(x // 8, y, 9) > 0.8 else 0)))
        elif kind == 'drug': plaster(c, 0, 32, W, 32, 'shiro', 0, seed=25)
        else: brick_wall(c, 0, 32, W, 32, 'tairu' if kind == 'fish' else 'kinari', 0, bw=6, bh=4, seed=26)
        window(c, 5, 37, 24, 15, lit=kind == 'kissa')
        c.R(44, 33, 12, 30, K(sign, 0)); outline_rect(c, 43, 32, 14, 32); c.VL(44, 33, 30, K(sign, 1))           # 세로 돌출 간판
        glyphs(c, 46, 35, 3, K(ink, 1), size=6, gap=3, seed=gs, vertical=True)
        c.R(0, 64, W, 12, K(sign, 0)); c.HL(0, 64, W, K(sign, 2)); c.HL(0, 75, W, K(sign, -2)); outline_rect(c, 0, 63, W, 13)   # 가게 간판 띠
        glyphs(c, 6, 67, 5, K(ink, 1), size=6, gap=4, seed=gs + 3)
        c.R(0, 76, W, 36, K('sumi', 2)); c.HL(0, 76, W, K('yoru', -3))
        if kind == 'kissa':                                                              # 나무 처마 + 레이스 창 + 유리문 + 커피 입간판
            c.R(0, 76, W, 5, K('ita', -2)); c.HL(0, 76, W, K('ita', 0)); c.HL(0, 81, W, OL)
            plaster(c, 0, 82, W, 26, 'kinari', 0, seed=27)
            c.R(4, 85, 30, 16, K('mado', 1)); outline_rect(c, 3, 84, 32, 18, K('ita', -2))
            for i in range(5, 34, 3): c.P(i, 86, K('shiro', 2)); c.P(i + 1, 87, K('shiro', 2))
            c.R(40, 84, 16, 24, K('ita', -1)); c.R(42, 86, 12, 12, K('garasu', 1)); outline_rect(c, 39, 83, 18, 25); c.P(52, 99, K('kii', 1))
            c.R(26, 98, 8, 9, K('kon', 0)); c.R(28, 100, 4, 3, K('shiro', 2)); c.P(32, 101, K('shiro', 2)); outline_rect(c, 25, 97, 10, 11)
        else:
            awning(c, 0, 76, W, 12, sign, 0, stripe='shiro' if kind != 'drug' else None)
            for i in range(4, W - 4, 8): c.P(i, 88, K('mado', 2)); c.P(i, 89, K('kii', 1))  # 차양 밑 전구
            if kind == 'butcher':
                c.R(2, 94, 60, 14, K('shiro', 0)); c.HL(2, 94, 60, K('shiro', 2)); c.R(4, 96, 56, 7, K('garasu', 2)); outline_rect(c, 1, 93, 62, 16)
                for i in range(6, 58, 6): c.R(i, 98, 4, 3, K('pinku', 0) if i % 12 else K('aka', -1)); c.P(i, 98, K('pinku', 2))
                for i in range(6, 58, 5): c.R(i, 104, 3, 2, K('daidai', 0)); c.P(i, 104, K('kii', 1))
            elif kind == 'fish':
                for i, x0 in enumerate(range(2, 60, 12)):
                    c.R(x0, 95, 11, 12, K('shiro', 1)); c.HL(x0, 95, 11, K('shiro', 2)); outline_rect(c, x0 - 1, 94, 13, 14)
                    for j in range(x0 + 1, x0 + 10): c.P(j, 97 + j % 2, K('sora', 2))
                    ramp = 'aka' if i % 3 == 1 else 'tekko'
                    for fy in (99, 103): c.HL(x0 + 2, fy, 7, K(ramp, 1)); c.HL(x0 + 2, fy + 1, 7, K(ramp, -1)); c.P(x0 + 2, fy, OL); c.P(x0 + 9, fy, K(ramp, 0)); c.P(x0 + 9, fy + 2, K(ramp, 0))
            else:
                for sy in (91, 99):                                                     # 약국 선반: 색색 상자 + 노란 가격표
                    c.HL(2, sy + 7, 60, K('shiro', 1))
                    for i in range(3, 61, 4): c.R(i, sy + 1, 3, 6, K(('aka', 'sora', 'kii', 'pinku', 'shiro', 'daidai')[(i // 4 + sy) % 6], 0)); c.P(i, sy + 1, K('shiro', 2))
                c.R(46, 96, 12, 12, K('daidai', 1)); c.R(48, 92, 8, 6, K('daidai', 1)); c.P(50, 94, OL); c.P(53, 94, OL)    # 가게 앞 마스코트 인형
        c.R(0, 108, W, 4, K('conc', 0)); c.HL(0, 108, W, K('conc', 2)); c.HL(0, 111, W, OL)
        c.VL(0, 32, 80, OL); c.VL(W - 1, 32, 80, OL)
    return draw


for _k, (_nm, _roof, _s, _i) in MARKET.items():
    kit('shop-market-%s' % _k, '상점가 %s(깊은 지붕·2층 창·세로 간판·차양·가게 앞 진열, 4×7)' % _nm, 4, 7, 'structure', solid=rows(4, range(7)),
        tags=['가게', '상점가', '시장'], rules=FRONT_RULES, role='building')(_market_shop(_k))


# ═══════════════════════════ 주거 맨션 · 월정액 주차장 · 지장보살 감실 ═══════════════════════════
# 2026-10-18 사용자 「사설 주차장이라던가, 주거 멘션이라던가. 일본의 실상을 덜 반영해서 아쉬움」.
@kit('mansion-tile', '3층 타일 맨션(옥상 파라펫·베란다 난간·실외기·빨래·바깥 철계단, 1층 자전거 보관소·오토락 현관·우편함, 6×7)', 6, 7, 'structure',
     solid=rows(6, range(7)), tags=['맨션', '아파트', '주거', '시타마치'], rules=FRONT_RULES, role='building')
def mansion_tile(c, base):
    W = 96
    c.HL(0, 0, W, OL); c.R(0, 1, W, 3, K('conc', 2)); c.HL(0, 1, W, K('conc', 3))           # 옥상 파라펫 윗면 + 안쪽 바닥(얕게)
    c.R(4, 4, W - 8, 6, K('conc', -1)); c.HL(4, 4, W - 8, K('conc', -2))
    c.R(0, 4, 4, 6, K('conc', 2)); c.R(W - 4, 4, 4, 6, K('conc', 1))
    ac_unit(c, 70, 2, 12, 7)
    c.R(0, 10, W, 4, K('conc', 1)); c.HL(0, 13, W, OL)
    brick_wall(c, 0, 14, W, 66, 'kinari', -1, bw=4, bh=3, seed=40)                        # 갈색 타일 외벽
    for fy in (14, 44):                                                                   # 3층·2층: 미닫이 창 + 베란다(젖빛 난간판)·실외기·빨래
        c.R(4, fy + 2, 52, 18, K('tekko', -2)); window(c, 5, fy + 3, 24, 16); window(c, 30, fy + 3, 24, 16)
        for i, x in enumerate(range(8, 52, 5)):                                           # 빨래 장대 + 옷
            c.R(x, fy + 6, 3, 6 + (i % 2) * 2, K(('aka', 'shiro', 'sora', 'kii', 'pinku', 'shiro')[i % 6], 1))
        c.HL(4, fy + 5, 52, K('tekko', 2))
        ac_unit(c, 40, fy + 11, 12, 9)
        c.R(2, fy + 18, 56, 9, K('garasu', 2)); c.HL(2, fy + 18, 56, K('tekko', 2))
        for x in range(2, 58, 14): c.VL(x, fy + 18, 9, K('tekko', 0))
        c.R(1, fy + 27, 58, 3, K('conc', 1)); c.HL(1, fy + 27, 58, K('conc', 3)); c.HL(1, fy + 30, 58, K('yoru', -1)); outline_rect(c, 1, fy + 17, 58, 13)
    c.R(60, 14, 36, 98, K('tekko', -2))                                                   # 바깥 철계단 칸(그늘진 벽 앞)
    ext_stair_flight(c, 61, 46, 78, 8); ext_stair_flight(c, 61, 76, 108, 8)
    for ly in (44, 74): c.R(60, ly, 36, 4, K('tekko', 1)); c.HL(60, ly, 36, K('tekko', 2)); c.HL(60, ly + 4, 36, OL)   # 층계참·복도
    c.R(62, 18, 10, 22, K('ita', -1)); outline_rect(c, 61, 17, 12, 24); c.P(70, 30, K('kii', 1))          # 3층 현관문
    c.R(80, 18, 12, 10, K('garasu', 0)); outline_rect(c, 79, 17, 14, 12, K('tekko', -2))
    c.HL(0, 80, W, OL)
    c.R(0, 81, 60, 31, K('conc', -1))                                                     # 1층: 자전거 보관소(골함석 차양) · 우편함 · 오토락 현관
    c.R(0, 81, 32, 5, K('sora', 0)); corrugated(c, 0, 81, 32, 5, 'sora', 0); c.HL(0, 86, 32, OL)
    for bx in (3, 12, 21):
        disc(c, bx + 2, 103, 2.5, OL); disc(c, bx + 2, 103, 1.2, K('tekko', 1)); disc(c, bx + 7, 103, 2.5, OL); disc(c, bx + 7, 103, 1.2, K('tekko', 1))
        line(c, bx + 2, 103, bx + 5, 97, K(('aka', 'shiro', 'sora')[bx % 3], 0)); line(c, bx + 5, 97, bx + 7, 103, K(('aka', 'shiro', 'sora')[bx % 3], 0))
        c.HL(bx + 4, 96, 3, OL); c.P(bx + 6, 95, K('tekko', 1))
    c.R(33, 86, 8, 12, K('tekko', 1))
    for yy in range(87, 97, 3):
        for xx in range(34, 40, 3): c.R(xx, yy, 2, 2, K('tekko', -1))
    c.R(43, 84, 16, 26, K('garasu', 1)); outline_rect(c, 42, 83, 18, 27, K('tekko', 0)); c.VL(50, 84, 26, K('tekko', 0)); c.R(41, 92, 1, 4, K('kii', 1))
    c.R(44, 80, 14, 3, K('shiro', 2)); glyphs(c, 45, 80, 3, K('kon', 0), size=3, gap=1, seed=41)
    c.R(0, 108, W, 4, K('conc', 0)); c.HL(0, 108, W, K('conc', 2)); c.HL(0, 111, W, OL); c.VL(0, 0, 112, OL); c.VL(W - 1, 0, 112, OL)


def ext_stair_flight(c, x, ytop, ybot, depth=8):
    """바깥 철계단 한 경사(오른쪽 위로) - 디딤판 윗면 띠 + 옆판 + 손잡이(house_kit.ext_stair 와 같은 3/4 읽힘, 폭 고정)."""
    n = max(1, (ybot - ytop) // 4)
    for k in range(n):
        sx = x + k * 4; sy = ybot - (k + 1) * 4
        c.R(sx, sy - depth, 4, depth, K('tekko', 2)); c.HL(sx, sy - depth, 4, K('tekko', 3))
        c.R(sx, sy, 4, 3, K('tekko', -1)); c.HL(sx, sy - depth - 1, 4, OL); c.HL(sx, sy + 3, 4, OL)
    for i in range(n * 4):
        hy = ybot - (i // 4 + 1) * 4 - depth - 2
        c.P(x + i, hy, K('tekko', 3)); c.P(x + i, hy + 1, K('tekko', -1))
        if i % 8 == 2: c.VL(x + i, hy + 2, depth - 1, K('tekko', 0))


def parked_car(c, x, y, ramp, kei=False):
    """주차 칸 안 차(위에서 본 3/4, 앞이 북쪽 담): 그림자 · 보닛 · 앞유리 · 지붕 · 뒷유리 · 트렁크 · 미등."""
    cw, ch = (20, 36) if kei else (24, 44)
    c.R(x + 3, y + 4, cw, ch, K('yoru', -2))
    c.R(x, y + 1, cw, ch - 2, K(ramp, 0)); c.R(x + 2, y, cw - 4, ch, K(ramp, 0))
    hood = 6 if kei else 11
    c.R(x + 2, y + 1, cw - 4, hood, K(ramp, 1)); c.VL(x + 1, y + 2, ch - 4, K(ramp, 2))
    c.R(x + 3, y + hood + 1, cw - 6, 6, K('garasu', 1)); c.HL(x + 3, y + hood + 1, cw - 6, K('garasu', 2))
    c.R(x + 3, y + hood + 7, cw - 6, ch - hood - 17, K(ramp, 1)); c.HL(x + 3, y + hood + 7, cw - 6, K(ramp, 2))
    c.R(x + 3, y + ch - 10, cw - 6, 4, K('garasu', -1)); c.R(x + 2, y + ch - 6, cw - 4, 4, K(ramp, -1))
    c.P(x + 2, y + ch - 2, K('aka', 0)); c.P(x + cw - 3, y + ch - 2, K('aka', 0)); c.P(x + 3, y, K('kii', 2)); c.P(x + cw - 4, y, K('kii', 2))
    c.P(x - 1, y + hood + 2, OL); c.P(x + cw, y + hood + 2, OL)
    c.HL(x + 2, y - 1, cw - 4, OL); c.HL(x + 2, y + ch, cw - 4, OL); c.VL(x - 1, y + 1, ch - 2, OL); c.VL(x + cw, y + 1, ch - 2, OL); c.VL(x + cw - 1, y + 2, ch - 4, K(ramp, -2))


@kit('monthly-parking', '월정액 주차장(月極 - 블록 담·간판·흰 주차선 4칸·차막이, 세단·경차 셋 주차, 8×7)', 8, 7, 'structure',
     solid=rows(8, (0, 1)) + [(x, y) for x in (0, 1, 2, 3, 6, 7) for y in (2, 3, 4)], tags=['주차', '월정액 주차', '시타마치'],
     rules='앞줄 7줄 띠. 아래 5줄은 아스팔트(빈 칸은 걷는 바닥)이고 앞 보도에 붙는다.', role='building')
def monthly_parking(c, base):
    W = 128
    fill_tex(base, 0, 32, W, 80, asph_px, seed=7)
    shade_poly(base, 0, 32, W, 10, lambda x, y: y < 10 - x // 6, asph_px, seed=7)
    for x in range(0, W + 1, 32): base.R(min(x, W - 2), 36, 2, 70, K('shiro', 1))
    for sx in range(0, W, 32):
        base.R(sx + 9, 38, 14, 3, K('conc', 1)); base.HL(sx + 9, 38, 14, K('conc', 3)); base.HL(sx + 9, 41, 14, K('yoru', -1))
        base.R(sx + 13, 98, 6, 5, K('shiro', 0)); base.P(sx + 15, 100, K('tekko', -2))
    c.HL(0, 0, W, OL); c.R(0, 1, W, 5, K('conc', 2)); c.HL(0, 1, W, K('conc', 3)); c.HL(0, 5, W, K('conc', 0))     # 블록 담(갓돌 + 블록 면)
    for y in range(6, 30):
        for x in range(W):
            j = (y - 6) % 8 == 7 or (x + (8 if ((y - 6) // 8) % 2 else 0)) % 16 == 15
            c.P(x, y, K('conc', -2) if j else K('conc', 0 if H(x // 16, (y - 6) // 8, 42) < 0.7 else -1))
    c.HL(0, 30, W, K('conc', -2)); c.HL(0, 31, W, OL)
    c.R(58, 14, 2, 18, K('tekko', 0)); c.R(84, 14, 2, 18, K('tekko', 0))                                         # 月極 간판(남색 머리띠 · 흰 판 · 전화 줄)
    c.R(44, 1, 54, 22, K('shiro', 2)); outline_rect(c, 43, 0, 56, 24); c.R(44, 1, 54, 8, K('kon', 0))
    glyphs(c, 47, 2, 5, K('shiro', 2), size=5, gap=5, seed=43)
    for yy in (12, 16): c.HL(48, yy, 46, K('kon', -1))
    c.HL(48, 20, 30, K('aka', 0))
    parked_car(c, 4, 40, 'shiro'); parked_car(c, 102, 40, 'kon'); parked_car(c, 38, 44, 'kii', kei=True)


@kit('hokora-jizo', '지장보살 감실(작은 기와 지붕 나무 사당·붉은 턱받이 지장 둘·꽃·공양 컵, 2×2)', 2, 2, 'column', solid=[(0, 1), (1, 1)],
     tags=['지장', '사당', '골목', '시타마치'], rules='건물 옆 빈 열·골목 어귀, 발 줄에 붙여 세운다.', role='prop')
def hokora(c, base):
    c.R(6, 29, 24, 3, K('yoru', -1))
    c.R(3, 22, 26, 7, K('conc', 0)); c.HL(3, 22, 26, K('conc', 2)); c.HL(3, 28, 26, K('conc', -2)); outline_rect(c, 2, 21, 28, 9)
    c.R(6, 8, 20, 14, K('ita', -2)); c.R(8, 10, 16, 12, K('sumi', 2)); outline_rect(c, 5, 7, 22, 16)
    c.VL(6, 8, 14, K('ita', 0)); c.VL(25, 8, 14, K('ita', -3))
    for jx, jy in ((12, 12), (19, 13)):                                                    # 지장 둘: 둥근 머리 · 몸 · 붉은 턱받이
        disc(c, jx, jy, 2.3, K('conc', 1)); c.P(jx - 1, jy - 1, K('conc', 3))
        c.R(jx - 2, jy + 2, 5, 7, K('conc', 0)); c.VL(jx - 2, jy + 2, 7, K('conc', 2))
        c.R(jx - 2, jy + 2, 5, 3, K('aka', 0)); c.HL(jx - 2, jy + 2, 5, K('aka', 1))
    for i, fx in enumerate((4, 26)):                                                       # 꽃병(노랑·분홍) + 공양 컵
        c.R(fx, 17, 2, 5, K('shiro', 1)); c.P(fx, 15, K(('kii', 'pinku')[i], 1)); c.P(fx + 1, 16, K(('kii', 'pinku')[i], 0))
    c.R(14, 23, 4, 2, K('shiro', 2))
    for y in range(0, 8):                                                                  # 작은 기와 지붕
        for x in range(2 + max(0, 3 - y), 30 - max(0, 3 - y)):
            c.P(x, y, K('tekko', (0 if x % 4 else 1) - (1 if y < 3 else 0) - (1 if y == 7 else 0)))
    c.HL(5, 0, 22, OL); c.HL(2, 7, 28, OL)


# ═══════════════════════════ 굽기 ═══════════════════════════
GROUND = {
    'gnd/slab': lambda c: fill_tex(c, 0, 0, 16, 16, slab_px),
    'gnd/asph': lambda c: fill_tex(c, 0, 0, 16, 16, asph_px),
}
GROUND_GROUPS = (
    ('jp:shita-slab', '콘크리트 판석 보도', ['gnd/slab'], '시타마치·상점가 보도(밝은 회베이지 콘크리트 판석, 8px 판·줄눈). 붉은 벽돌은 벽에만 쓴다(2026-10-18 사용자). fill_region 몸통. 드문드문 jp-gnd-slab-b·jp-gnd-slab-c 키트로 반복을 깬다.'),
    ('jp:shita-asphalt', '따뜻한 아스팔트 골목', ['gnd/asph'], '시타마치 골목·상점가 도로(흙빛 회갈색). fill_region 몸통. 맨홀(jp-gnd-manhole)·빗물받이(jp-gnd-drain)·금(jp-gnd-asph-crack)을 얹는다.'),
)


def _cv(w, h):
    return Cv(w * 16, h * 16)


def _cells_of(a, R, C):
    for cy in range(R):
        for cx in range(C):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
            if not t[:, :, 3].any(): yield cx, cy, None; continue
            t[t[:, :, 3] == 0] = 0
            yield cx, cy, t


_CACHE = {}


# 2026-10-18 붉은 벽돌 보도 -> 콘크리트 판석으로 바꾸며 이름을 고쳤다. 번호 핀 자리 키는 옛 이름을 그대로 써서
# 이미 깔린 맵의 같은 칸 번호가 새 판석 그림으로 바뀌게 한다(새 칸을 끝에 붙이면 옛 맵에 붉은 벽돌 바닥이 legacy 로 남는다).
PIN_KEY = {'gnd/slab': 'gnd/brick', 'gnd-slab-b': 'gnd-brick-ochre', 'gnd-slab-c': 'gnd-brick-c',
           'gnd-shade-slab': 'gnd-shade-brick', 'gnd-shade-slab-dl': 'gnd-shade-brick-dl', 'gnd-shade-slab-dr': 'gnd-shade-brick-dr'}


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; renders = {}
    for name, fn in GROUND.items():
        loc = PIN_KEY.get(name, name)
        c = Cv(16, 16); fn(c)
        im = Image.fromarray(c.a, 'RGBA')
        seen[(c.a.tobytes(), 'floor')] = loc
        cells[loc] = dict(img=im, pc='floor', label='시타마치 바닥 · ' + ('콘크리트 판석 보도' if name == 'gnd/slab' else '따뜻한 아스팔트'),
                          desc='[시타마치 팩] 바닥 몸통 칸(1층).', tags=['바닥', '시타마치'])
    for k in KITS:
        up, base = _cv(k['w'], k['h']), _cv(k['w'], k['h'])
        k['draw'](up, base)
        grids = {}
        for layer, cv in (('up', up), ('base', base)):
            g = [[None] * k['w'] for _ in range(k['h'])]
            for cx, cy, t in _cells_of(cv.a, k['h'], k['w']):
                if t is None: continue
                pc = 'floor' if layer == 'base' else ('solid' if (cx, cy) in k['solid'] else k['other'])
                key = (t.tobytes(), pc)
                if key not in seen:
                    loc = '%s/%s%d.%d' % (PIN_KEY.get(k['id'], k['id']), 'b' if layer == 'base' else '', cx, cy)
                    seen[key] = loc
                    cells[loc] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)%s' % (k['name'], cx, cy, ' 바닥' if layer == 'base' else ''),
                                      desc='[시타마치 팩] %s 의 일부. 키트 jp-%s 로 통째로 놓는다.' % (k['name'], k['id']), tags=list(k['tags']))
                g[cy][cx] = seen[key]
            grids[layer] = g
        has_base = any(v for r in grids['base'] for v in r)
        desc = '%s - 폭 %d칸×높이 %d칸. 손 도트 시타마치·상점가(modern3, 빛 왼쪽 위, 3/4).%s' % (k['name'], k['w'], k['h'], ' 바닥(1층) 칸 포함.' if has_base else '')
        ai = dict(snap='floor', tags=list(k['tags']) + ['shitamachi'], description=desc, placementRules=k['rules'], repeatability='fixed', growthAxis=None,
                  anchor=dict(dx=0, dy=k['h'] - 1), access=[], role='terrain' if k['role'] == 'floor' else k['role'])
        kits.append(dict(id='jp-' + k['id'], name=k['name'], grid=grids['up'], base=grids['base'] if has_base else None, parts=[], ai=ai))
        comp = Image.new('RGBA', (k['w'] * 16, k['h'] * 16), (0, 0, 0, 0))
        comp.alpha_composite(Image.fromarray(base.a, 'RGBA')); comp.alpha_composite(Image.fromarray(up.a, 'RGBA'))
        renders[k['id']] = comp
    groups = [dict(id=gid, name=nm, role='terrain', defaultLayer='lower', cells=[PIN_KEY.get(x, x) for x in cs], desc=d, rules=d) for gid, nm, cs, d in GROUND_GROUPS]
    groups.append(dict(id='jp:shita-shade', name='시타마치 사선 그림자 바닥', role='detail', defaultLayer='lower',
                       cells=[seen[k] for k in seen if any(seen[k].startswith(p) for p in ('gnd-shade', 'gnd-curb-s-shade'))],
                       desc='건물 정면 아래 보도·도로의 45° 그림자 칸(빛 왼쪽 위).', rules='건물 바로 아래 줄. 왼쪽 끝 -dl, 오른쪽 끝 다음 칸 -dr.'))
    _CACHE['r'] = (cells, kits, renders, groups)
    return _CACHE['r']


NOTES = '시타마치·상점가 바깥 거리 팩: 콘크리트 판석 보도·어두운 아스팔트·맨홀·빗물받이·45° 사선 그림자 바닥 + 뒷줄 가게(청과·이자카야·자판기 골목) · 앞줄 3/4 건물(옥상 안테나·골목 계단·기와 발코니) · 상점가(코인 주차·아케이드·大門通 아치) · 전신주·버스 정류장·우체통. 키트 %d종.'


def build():
    cells, kits, renders, groups = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits], 'notes': NOTES % len(kits)}


def kinds():
    return {'jp-' + k['id']: k['kind'] for k in KITS}


def selftest(verbose=True):
    from lib_blocks_lines.core import check_cell
    out = []
    b = build()
    for k, c in b['cells'].items():
        for m in check_cell(c['img']): out.append('(a) %s: %s' % (k, m))
    ids = [k['id'] for k in b['kits']]
    if len(ids) != len(set(ids)): out.append('키트 id 중복')
    for k in b['kits']:
        for layer in ('grid', 'base'):
            for row in (k[layer] or []):
                for v in row:
                    if v is not None and v not in b['cells']: out.append('(b) %s 칸 %s 없음' % (k['id'], v))
    if verbose:
        print('shitamachi_pack: 칸 %d · 키트 %d · 문제 %d' % (len(b['cells']), len(b['kits']), len(out)))
        for m in out[:20]: print('  ', m)
    return len(out)


def preview(outdir=OUTDIR):
    os.makedirs(outdir, exist_ok=True)
    cells, kits, renders, groups = _finalize()
    bg = (60, 52, 58, 255)
    ims = [renders[k['id']] for k in KITS if k['role'] != 'floor']
    gnd = [renders[k['id']] for k in KITS if k['role'] == 'floor'] + [cells[PIN_KEY.get(g, g)]['img'] for g in GROUND]
    W = 860; x = y = 0; rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    gy = y + rowh + 10
    S = Image.new('RGBA', (W, gy + 20), bg)
    for im, p in zip(ims, pos): S.alpha_composite(im, p)
    for i, im in enumerate(gnd): S.alpha_composite(im, (i * 20, gy))
    S.save(os.path.join(outdir, '_all.png'))
    S.resize((S.width * 2, S.height * 2), Image.NEAREST).save(os.path.join(outdir, '_all-x2.png'))
    for k in KITS: renders[k['id']].save(os.path.join(outdir, 'jp-%s.png' % k['id']))
    return os.path.join(outdir, '_all-x2.png')


if __name__ == '__main__':
    bad = selftest()
    print(preview(sys.argv[1] if len(sys.argv) > 1 else OUTDIR))
    sys.exit(1 if bad else 0)
