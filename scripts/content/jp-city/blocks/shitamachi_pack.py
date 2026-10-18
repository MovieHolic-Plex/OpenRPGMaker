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
def brick_px(x, y, shade=0, seed=0, ochre=0.0):
    """테라코타 벽돌 보도(8×4 반장 엇갈림) 한 화소 - 16px 주기로 이음새 없다. shade>0 이면 그만큼 어둡게."""
    x %= 16; y %= 16
    row = y // 4; off = 4 if row % 2 else 0
    bx = ((x + off) // 8) % 2
    if y % 4 == 3 or (x + off) % 8 == 7:
        return K('renga', -1 - shade) if shade else K('renga', -1)
    h = H(bx, row, seed)
    if h < ochre:
        ramp, t = ('mado', 0) if h < ochre * 0.55 else ('yuka', 0)
        lift = 1 if y % 4 == 0 and (x + off) % 8 < 6 else 0
        return K(ramp, t + lift - shade)
    t = 1 if h < 0.55 else (0 if h < 0.8 else 2)
    if y % 4 == 0 and (x + off) % 8 < 6: t += 1          # 벽돌 윗변 빛(왼쪽 위)
    if y % 4 == 2 and (x + off) % 8 == 6: t -= 1         # 오른쪽 아래 모서리
    return K('renga', t - shade)


def asph_px(x, y, shade=0, seed=0):
    """흙빛 회갈색 아스팔트 - 어두운 ita(갈색) 바탕에 tekko(회색) 알갱이를 드문드문(자갈밭처럼 시끄럽지 않게)."""
    h = H(x % 16, y % 16, 77 + seed)
    if h < 0.58: c = ('ita', 0)
    elif h < 0.80: c = ('tekko', 0)
    elif h < 0.92: c = ('ita', -1)
    else: c = ('tekko', 1)
    return K(c[0], c[1] - 2 * shade)


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


def _brick_b(c): fill_tex(c, 0, 0, 16, 16, brick_px, seed=5, ochre=0.45)
def _brick_c(c): fill_tex(c, 0, 0, 16, 16, brick_px, seed=11, ochre=0.12)
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
def _drain(c):
    fill_tex(c, 0, 0, 16, 16, asph_px)
    c.R(1, 0, 14, 7, K('tekko', -2)); c.HL(1, 7, 14, K('conc', 1))
    for x in range(2, 14, 2): c.VL(x, 0, 6, K('tekko', 1)); c.VL(x + 1, 0, 6, SUMI2)
    c.HL(1, 6, 14, K('tekko', 0)); c.VL(0, 0, 8, OL); c.VL(15, 0, 8, K('tekko', -1)); c.HL(0, 8, 16, K('ita', -1))
def _curb_s(c, shade=0):
    fill_tex(c, 0, 0, 16, 11, brick_px, shade=shade)
    c.HL(0, 11, 16, K('conc', 2 - 2 * shade)); c.HL(0, 12, 16, K('conc', 1 - 2 * shade)); c.HL(0, 13, 16, K('conc', 0 - 2 * shade))
    c.HL(0, 14, 16, K('conc', -2)); c.HL(0, 15, 16, K('yoru', -1))
    c.VL(7, 12, 2, K('conc', -1)); c.VL(15, 12, 2, K('conc', -1))
def _curb_n(c):
    fill_tex(c, 0, 4, 16, 12, brick_px)
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
_gnd('gnd-brick-ochre', '테라코타 벽돌 보도(황토 벽돌 섞임)', _brick_b, ['벽돌'], '보도 몸통 사이 드문드문(15%) - 같은 무늬 반복을 깬다.')
_gnd('gnd-brick-c', '테라코타 벽돌 보도(얼룩)', _brick_c, ['벽돌'], '보도 몸통 사이 드문드문.')
_gnd('gnd-asph-crack', '따뜻한 아스팔트(금 간)', _asph_b, ['아스팔트'], '도로 몸통 사이 드문드문.')
_gnd('gnd-manhole', '둥근 주철 맨홀', _manhole, ['아스팔트', '맨홀'], '도로 가운데 줄 8~12칸마다.')
_gnd('gnd-drain', '빗물받이(グレーチング)', _drain, ['아스팔트', '배수'], '연석 바로 아래 도로 칸, 6칸마다.')
_gnd('gnd-curb-s', '보도 남쪽 연석(아래가 도로)', _curb_s, ['벽돌', '연석'], '보도 맨 아랫줄(도로와 닿는 줄).')
_gnd('gnd-curb-s-shade', '보도 남쪽 연석(그림자)', lambda c: _curb_s(c, 1), ['벽돌', '연석', '그림자'], '그림자 줄이 연석 줄일 때.')
_gnd('gnd-curb-s-shade-dl', '보도 남쪽 연석(사선 그림자 시작)', _curb_shade(lambda x, y: x >= y), ['벽돌', '연석', '그림자'], '건물 왼쪽 끝 한 칸 오른쪽의 연석 줄.')
_gnd('gnd-curb-s-shade-dr', '보도 남쪽 연석(사선 그림자 끝)', _curb_shade(lambda x, y: x < y), ['벽돌', '연석', '그림자'], '건물 오른쪽 끝 두 칸 오른쪽의 연석 줄.')
_gnd('gnd-curb-n', '보도 북쪽 연석(위가 도로)', _curb_n, ['벽돌', '연석'], '도로 아래 보도 맨 윗줄.')
_gnd('gnd-shade-brick', '건물 그림자 진 벽돌 보도', _shade(brick_px, s=2), ['벽돌', '그림자'], '건물 정면 바로 아래 보도 줄.')
_gnd('gnd-shade-brick-dl', '사선 그림자 시작(벽돌)', _shade(brick_px, _DL, s=2), ['벽돌', '그림자'], '건물 왼쪽 끝 아래(빛 왼쪽 위 -> 그림자 오른쪽 아래 45°).')
_gnd('gnd-shade-brick-dr', '사선 그림자 끝(벽돌)', _shade(brick_px, _DR, s=2), ['벽돌', '그림자'], '건물 오른쪽 끝 다음 칸.')
_gnd('gnd-shade-asph', '건물 그림자 진 아스팔트', _shade(asph_px), ['아스팔트', '그림자'], '건물 바로 아래 도로 줄.')
_gnd('gnd-shade-asph-dl', '사선 그림자 시작(아스팔트)', _shade(asph_px, _DL), ['아스팔트', '그림자'], '건물 왼쪽 끝 아래.')
_gnd('gnd-shade-asph-dr', '사선 그림자 끝(아스팔트)', _shade(asph_px, _DR), ['아스팔트', '그림자'], '건물 오른쪽 끝 다음 칸.')


# ----------------------------- 뒷줄(위 거리) 가게 -----------------------------
@kit('shop-greengrocer', '청과물 가게(파란 차양·전구·청과 상자 진열, 6×5)', 6, 5, 'structure', solid=rows(6, (2, 3, 4)), tags=['가게', '청과', '시타마치'],
     rules='보도 바로 위(발 줄 = 보도 첫 줄 위). 양옆에 다른 가게를 빈틈 없이 붙인다.', role='building')
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


@kit('izakaya-brick-wall', '대중주점(붉은 벽돌 벽·흰 간판·노렌·붉은 등롱·전선관, 4×5)', 4, 5, 'structure', solid=rows(4, (2, 3, 4)), tags=['가게', '이자카야', '벽돌', '시타마치'],
     rules='보도 바로 위. 청과물·자판기 골목 사이에 붙인다.', role='building')
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


@kit('vending-stripe-alcove', '줄무늬 차양 자판기 골목(흰 음료 자판기·휴지통, 3×5)', 3, 5, 'structure', solid=rows(3, (2, 3, 4)), tags=['자판기', '골목', '시타마치'],
     rules='가게 사이 좁은 틈. 보도 바로 위.', role='building')
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
@kit('fg-rooftop-dish', '앞줄 평지붕 건물(옥상 난간·위성 안테나·실외기·골함석 벽, 6×5)', 6, 5, 'structure', solid=rows(6, range(5)), tags=['건물', '옥상', '시타마치'],
     rules='도로 아래 앞줄. 옥상이 위(북쪽), 남쪽 벽이 아래.', role='building')
def fg_rooftop(c, base):
    flat_roof(c, 0, 0, 96, 50, 'conc', 0, seed=8)
    railing(c, 2, 2, 92, 9, 'tekko', 0, gap=3)
    c.VL(2, 2, 46, K('tekko', 1)); c.VL(93, 2, 46, K('tekko', -1))
    for y in range(10, 46, 3): c.P(2, y, K('tekko', 2)); c.P(93, y, K('tekko', -2))
    # 위성 안테나 + 오른쪽 아래 그림자
    disc(c, 32, 31, 10, K('conc', -1), ry=7)
    c.VL(26, 24, 10, K('tekko', -1)); c.R(23, 33, 7, 3, K('tekko', 0))
    disc(c, 26, 22, 9, K('shiro', 0), ry=7); disc(c, 25, 21, 8, K('shiro', 1), ry=6); disc(c, 24, 20, 5, K('shiro', 2), ry=3)
    line(c, 26, 22, 34, 14, K('tekko', -1)); c.R(33, 12, 3, 3, K('tekko', 1))
    for t in range(0, 360, 12):
        import math
        x = 26 + 9 * math.cos(math.radians(t)); y = 22 + 7 * math.sin(math.radians(t))
        if 20 < t < 200: c.P(round(x), round(y), K('shiro', -2))
    # 실외기 줄
    for k, ax in enumerate((54, 72)):
        c.R(ax + 3, 18, 16, 12, K('conc', -1))
        ac_unit(c, ax, 15, 15, 11)
    c.R(44, 38, 18, 6, K('tekko', 0)); c.HL(44, 38, 18, K('tekko', 2)); c.HL(45, 44, 18, K('conc', -1))     # 배관 덮개
    # 남쪽 벽(골함석)
    corrugated(c, 0, 50, 96, 30, 'conc', 0)
    window(c, 8, 54, 22, 13); ac_unit(c, 33, 57, 13, 9)
    window(c, 60, 54, 22, 13, lit=True)
    c.R(88, 50, 3, 30, K('tekko', 0)); c.VL(88, 50, 30, K('tekko', 2))
    c.R(0, 74, 96, 6, K('conc', -2)); c.HL(0, 74, 96, K('conc', 0)); c.HL(0, 79, 96, OL); c.VL(95, 0, 80, OL); c.VL(0, 0, 80, K('conc', 2))


@kit('alley-stair-tree', '골목 계단(사선 그림자)·붉은 울타리 화단 느티나무·메뉴판 타일 기둥·맥주 상자(4×5)', 4, 5, 'structure',
     solid=[(0, y) for y in range(5)] + [(3, 3), (3, 4)], tags=['골목', '계단', '나무', '시타마치'],
     rules='앞줄 건물 사이 좁은 틈. 가운데 2칸 계단은 걷는 바닥.', role='building')
def alley_stair(c, base):
    for y in range(80):
        for x in range(16, 48):
            k = y % 8
            if k < 5: col = K('conc', 2 if k == 0 else 1)
            elif k == 5: col = K('conc', 3)
            else: col = K('conc', -1)
            if (x - 16) < 22 - y // 5: col = K('conc', -2 if k >= 5 else -1)
            base.P(x, y, col)
    base.VL(16, 0, 80, OL); base.VL(47, 0, 80, K('conc', -2))
    # 타일 기둥 + 메뉴판 + 맥주 상자
    c.R(0, 0, 16, 6, K('conc', 2)); c.HL(0, 0, 16, OL); c.HL(0, 5, 16, K('conc', -1))
    for y in range(6, 80):
        for x in range(0, 16):
            c.P(x, y, K('tairu', -1) if (x % 5 == 4 or (y - 6) % 5 == 4) else K('tairu', 1 if x < 3 else 0))
    c.VL(15, 0, 80, OL)
    c.R(3, 22, 10, 30, OL); c.R(4, 23, 8, 28, K('sumi', 2)); glyphs(c, 5, 25, 4, K('shiro', 1), size=4, gap=3, seed=31, vertical=True)
    c.R(2, 52, 12, 2, K('ita', 0))
    for k, (cy, ramp) in enumerate(((60, 'kii'), (70, 'aka'))):
        c.R(1, cy, 14, 9, K(ramp, 0)); c.HL(1, cy, 14, K(ramp, 1)); outline_rect(c, 0, cy - 1, 16, 11)
        for bx in range(3, 14, 3): c.P(bx, cy + 1, K('midori', -1) if k else K('ita', 1)); c.P(bx, cy + 2, K('shiro', 1))
        for bx in range(2, 14, 4): c.VL(bx, cy + 4, 3, K(ramp, -1))
    # 붉은 울타리 화단 + 느티나무
    c.R(48, 58, 16, 14, K('soil', -1)); c.HL(48, 58, 16, K('soil', 0))
    for x in range(48, 64, 3): c.VL(x, 52, 20, K('aka', 0)); c.P(x, 52, K('aka', 2))
    c.HL(48, 54, 16, K('aka', 1)); c.HL(48, 63, 16, K('aka', 1)); c.HL(48, 71, 16, K('aka', -1)); c.HL(48, 72, 16, OL)
    c.R(54, 34, 4, 26, K('ita', -1)); c.VL(54, 34, 26, K('ita', 0)); c.VL(57, 34, 26, K('ita', -2))
    blobs = ((52, 24, 12), (40, 16, 9), (60, 12, 9), (46, 6, 8), (34, 30, 6), (61, 32, 7), (52, 38, 7))
    for bx, by, r in blobs: disc(c, bx + 1, by + 1, r, K('ki', -3))
    for bx, by, r in blobs: disc(c, bx, by, r, K('ki', -1))
    for bx, by, r in blobs: disc(c, bx - 1, by - 1, r - 2, K('ki', 0))
    for bx, by, r in blobs: disc(c, bx - r // 3, by - r // 3, max(1, r // 3), K('ki', 2))
    for y in range(0, 46):
        for x in range(28, 64):
            if c.a[y, x, 3] and H(x, y, 40) < 0.12: c.P(x, y, K('ki', 1))


@kit('fg-tiled-balcony', '앞줄 골기와 집(2층 발코니·난간·화분·실외기, 6×5)', 6, 5, 'structure', solid=rows(6, range(5)), tags=['건물', '기와', '발코니', '시타마치'],
     rules='도로 아래 앞줄.', role='building')
def fg_balcony(c, base):
    kawara(c, 0, 0, 58, 40, 'kawara', 0)
    kawara(c, 56, 6, 40, 34, 'tekko', -1)
    c.VL(56, 6, 34, OL)
    plaster(c, 0, 40, 96, 40, 'conc', 1, seed=9)
    window(c, 10, 42, 46, 18)
    c.R(6, 56, 54, 4, K('conc', 3)); c.HL(6, 60, 54, K('conc', -1)); c.HL(6, 61, 54, OL)
    for px, ramp in ((12, 'ki'), (46, 'shiba')):
        c.R(px, 51, 6, 5, K('daidai', -1)); c.HL(px, 51, 6, K('daidai', 0))
        disc(c, px + 3, 48, 4, K(ramp, -1)); disc(c, px + 2, 47, 3, K(ramp, 0)); c.P(px + 1, 46, K(ramp, 1))
    ac_unit(c, 24, 46, 16, 10)
    railing(c, 6, 46, 54, 11, 'tekko', 0, gap=3)
    window(c, 68, 44, 18, 14, bars=True)
    c.R(90, 40, 3, 40, K('tekko', 0)); c.VL(90, 40, 40, K('tekko', 2))
    for y in range(64, 79, 2): c.HL(8, y, 46, K('tekko', 1)); c.HL(8, y + 1, 46, K('tekko', -1))
    outline_rect(c, 7, 63, 48, 17)
    c.R(64, 62, 16, 18, K('ita', 0)); outline_rect(c, 63, 61, 18, 19); c.VL(72, 62, 18, K('ita', -2)); c.P(70, 71, K('mado', 1))
    c.HL(0, 79, 96, OL); c.VL(95, 0, 80, OL)


# ----------------------------- 상점가 -----------------------------
@kit('coin-parking', '코인 주차장(P 간판 벽·노란 주차선 3칸·초록 차양 정산기·비상계단, 8×6)', 8, 6, 'structure',
     solid=rows(8, (0, 1)) + [(6, 2), (6, 3)], other='star', tags=['주차', '코인 주차', '상점가'],
     rules='뒷줄. 아래 4줄은 아스팔트 바닥(걷는 칸)이고 보도에 붙는다.', role='building')
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


@kit('shotengai-canopy', '상점가 아케이드(붉은 함석 차양·철 기둥 6개·파란 깃발·청과/정육/반찬 진열, 8×6)', 8, 6, 'structure',
     solid=rows(8, (2, 3, 4)), tags=['상점가', '아케이드', '시장'], rules='뒷줄. 맨 아랫줄은 차양 밑 걷는 바닥.', role='building')
def shotengai_canopy(c, base):
    fill_tex(base, 0, 80, 128, 16, brick_px, shade=1)
    for y in range(0, 36):
        for x in range(128):
            k = x % 5; t = 1 if k == 0 else -1 if k == 4 else 0
            if y % 12 == 11: t -= 1
            if y % 12 == 0: t += 1
            if H(x // 5, y // 3, 61) < 0.05: c.P(x, y, K('daidai', -1)); continue
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


@kit('shotengai-arch', '大門通 상점가 아치(간판 문·채광 볼트 지붕·청회색 타일 통로·빨간 우체통, 7×6)', 7, 6, 'structure',
     solid=[(0, 3), (0, 4), (0, 5), (5, 3), (5, 4), (5, 5), (6, 5)], tags=['상점가', '아치', '아케이드', '우체통'],
     rules='뒷줄. 통로 바닥(가운데 4칸)이 보도로 이어진다.', role='building')
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


# ═══════════════════════════ 굽기 ═══════════════════════════
GROUND = {
    'gnd/brick': lambda c: fill_tex(c, 0, 0, 16, 16, brick_px),
    'gnd/asph': lambda c: fill_tex(c, 0, 0, 16, 16, asph_px),
}
GROUND_GROUPS = (
    ('jp:shita-brick', '테라코타 벽돌 보도', ['gnd/brick'], '시타마치·상점가 보도(붉은 테라코타 벽돌, 황토 벽돌 섞임). fill_region 몸통. 드문드문 jp-gnd-brick-ochre·jp-gnd-brick-c 키트로 반복을 깬다.'),
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


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; renders = {}
    for loc, fn in GROUND.items():
        c = Cv(16, 16); fn(c)
        im = Image.fromarray(c.a, 'RGBA')
        seen[(c.a.tobytes(), 'floor')] = loc
        cells[loc] = dict(img=im, pc='floor', label='시타마치 바닥 · ' + ('테라코타 벽돌 보도' if 'brick' in loc else '따뜻한 아스팔트'),
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
                    loc = '%s/%s%d.%d' % (k['id'], 'b' if layer == 'base' else '', cx, cy)
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
    groups = [dict(id=gid, name=nm, role='terrain', defaultLayer='lower', cells=list(cs), desc=d, rules=d) for gid, nm, cs, d in GROUND_GROUPS]
    groups.append(dict(id='jp:shita-shade', name='시타마치 사선 그림자 바닥', role='detail', defaultLayer='lower',
                       cells=[seen[k] for k in seen if seen[k].startswith('gnd-shade') or seen[k].startswith('gnd-curb-s-shade')],
                       desc='건물 정면 아래 보도·도로의 45° 그림자 칸(빛 왼쪽 위).', rules='건물 바로 아래 줄. 왼쪽 끝 -dl, 오른쪽 끝 다음 칸 -dr.'))
    _CACHE['r'] = (cells, kits, renders, groups)
    return _CACHE['r']


NOTES = '시타마치·상점가 바깥 거리 팩: 테라코타 벽돌 보도·따뜻한 아스팔트·맨홀·빗물받이·45° 사선 그림자 바닥 + 뒷줄 가게(청과·이자카야·자판기 골목) · 앞줄 3/4 건물(옥상 안테나·골목 계단·기와 발코니) · 상점가(코인 주차·아케이드·大門通 아치) · 전신주·버스 정류장·우체통. 키트 %d종.'


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
    gnd = [renders[k['id']] for k in KITS if k['role'] == 'floor'] + [cells[g]['img'] for g in GROUND]
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
