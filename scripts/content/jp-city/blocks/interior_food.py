#!/usr/bin/env python3
"""jp_city 실내 — 음식점 묶음(라멘집·이자카야·초밥집·킷사텐). id 접두 `fd-`.
바닥(빨간 타일·짙은 마루·주방 타일), 벽(회벽+널 허리벽·짙은 널벽), 카운터·탁자, 의자·스툴, 주방 기구, 식권기, 노렌·등롱·메뉴판, 자시키, 탁상 물건.
빛은 왼쪽 위. 색은 modern3 램프 K(램프, 단) 만. 글자·상표·사람 없음(메뉴·값은 색띠와 점).
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa
import categories as CATS                           # noqa

BLOCK = 'interior_food'
R = Registry(BLOCK, '음식점')


def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def box(c, x, y, w, h, col):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def ell(c, cx, cy, rx, ry, m, ol=True, hi=True):
    def inside(x, y): return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if not inside(x, y): continue
            if ol and not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.P(x, y, K(m, -2)); continue
            t = (x + .5 - cx) / rx * 0.6 + (y + .5 - cy) / ry * 0.8
            c.P(x, y, K(m, (2 if t < -0.5 else 1 if t < -0.1 else -1 if t > 0.5 else 0) if hi else 0))


def O(id_, ko, **kw):
    kw.setdefault('cat', 'food'); kw.setdefault('cat_ko', '음식점')
    return R.obj(id_, ko, **kw)


# 스테인리스 — conc 램프
def st(t): return K('conc', t)


# ───────────────────────── 바닥 ─────────────────────────
@R.floor('fd-tile-red', '라멘집 붉은 타일 바닥', cols=4, rows=4, tags=('라멘', '음식점', '식당'), desc='붉은 갈색 8px 타일 + 1px 줄눈. 타일마다 톤이 조금씩 다르고 왼쪽 위 모서리가 밝다. 기름때 점 몇 개.')
def _(c):
    for ty in range(0, c.h, 8):
        for tx in range(0, c.w, 8):
            t = hs(tx // 8, ty // 8, 1) % 6
            b = K('renga', (0, 0, 0, 1, -1, 0)[t])
            c.R(tx, ty, 8, 8, b)
            c.HL(tx, ty, 7, K('renga', 1 if t != 3 else 2)); c.VL(tx, ty, 7, K('renga', 1 if t != 3 else 2))
            c.HL(tx, ty + 7, 8, K('renga', -2)); c.VL(tx + 7, ty, 8, K('renga', -2))
            if rnd(tx, ty, 2, 180): c.P(tx + 2 + hs(tx, ty, 3) % 4, ty + 2 + hs(tx, ty, 4) % 4, K('renga', -1))


@R.floor('fd-wood-dark', '이자카야 짙은 마루', cols=6, rows=6, tags=('이자카야', '킷사텐', '음식점'), desc='조용한 짙은 갈색 마루. 폭 4px 세로 널(널마다 톤은 인접 한 단계 차이뿐), 널 사이는 한 단계 어두운 1px 세로 틈, 널 끝 이음은 1px 어두운 가로선이 48px 간격(세 칸)으로 이웃 널과 16px 이상 엇갈린다(96px 주기라 16px 칸 경계가 보이지 않는다).')
def _(c):
    # (이음 간격, 시작 오프셋): 96px 안에서 48×2 로 정확히 닫힌다.
    PLAN = ((48, 38), (48, 20), (48, 44), (48, 20), (48, 40), (48, 15), (48, 36), (48, 20))   # 이웃 널과 이음 위치 16px 이상 어긋남
    BW = 4
    for bi in range(c.w // BW):
        x0 = bi * BW
        ln, off = PLAN[bi % len(PLAN)]
        tone = (0, 0, 1, 0, 1, 0, 0)[hs(bi, 0, 6) % 7]                  # 널마다 한 가지 톤(0 또는 +1, 두 단계 차이 없음)
        for y in range(c.h):
            for dx in range(BW):
                c.P(x0 + dx, y, K('ita', -1) if dx == 0 else K('ita', tone))   # 왼쪽 1px = 널 사이 틈
        for seg in range(c.h // ln):
            ys = (off + seg * ln) % c.h
            for dx in range(BW): c.P(x0 + dx, ys, K('ita', -2))             # 널 끝 이음(1px)
        for k in range(2):                                               # 아주 드문 세로 결(한 단계 아래)
            gx = x0 + 1 + hs(bi, k, 7) % 3
            gy = hs(bi, k, 9) % c.h
            for d in range(2 + hs(bi, k, 8) % 3):
                if (gy + d) % ln != off % ln: c.P(gx, (gy + d) % c.h, K('ita', tone - 1) if tone else K('ita', -1))


@R.floor('fd-kitchen-tile', '주방 회색 타일', cols=4, rows=4, tags=('주방', '음식점'), desc='8px 회색 타일 + 짙은 줄눈. 왼쪽 위 모서리 하이라이트, 아주 드문 얼룩.')
def _(c):
    for ty in range(0, c.h, 8):
        for tx in range(0, c.w, 8):
            t = hs(tx // 8, ty // 8, 11) % 7
            b = K('conc', 1 if t != 0 else 0)
            c.R(tx, ty, 8, 8, b)
            c.HL(tx, ty, 7, K('conc', 2)); c.VL(tx, ty, 7, K('conc', 2))
            c.HL(tx, ty + 7, 8, K('conc', -1)); c.VL(tx + 7, ty, 8, K('conc', -1))
            if t == 5: c.P(tx + 3, ty + 4, K('conc', 0)); c.P(tx + 4, ty + 4, K('conc', 0))


# ───────────────────────── 벽 ─────────────────────────
@R.wall('fd-plaster', '회벽 + 나무 허리벽', cols=4, tags=('음식점', '라멘', '킷사텐'), desc='흰 회벽(미세한 얼룩) 위에 나무 허리벽과 턱 레일, 아래 굽도리.')
def _(c):
    W = c.w
    c.R(0, 0, W, 21, K('shiro', 0))
    for y in range(0, 21):
        for x in range(W):
            if rnd(x, y, 21, 55): c.P(x, y, K('shiro', -1))
            elif rnd(x, y, 22, 20): c.P(x, y, K('shiro', 1))
    c.HL(0, 20, W, K('shiro', -2))
    c.HL(0, 21, W, K('ita', 2)); c.HL(0, 22, W, K('ita', 1)); c.HL(0, 23, W, K('ita', -1))     # 레일
    c.R(0, 24, W, 5, K('ita', 0))
    for x in range(0, W, 8): c.VL(x, 24, 5, K('ita', -1)); c.VL(x + 1, 24, 5, K('ita', 1))
    c.R(0, 29, W, 3, K('ita', -2)); c.HL(0, 29, W, K('ita', -1))                                 # 굽도리


@R.wall('fd-wood-wall', '짙은 널벽', cols=4, tags=('이자카야', '킷사텐', '음식점'), desc='조용한 짙은 나무 세로 널벽. 널은 한 톤, 8px 간격 1px 어두운 틈 + 옆 한 줄 밝은 결, 가운데 가로 레일, 굽도리.')
def _(c):
    W = c.w
    c.R(0, 0, W, 29, K('ita', -1))
    for x in range(0, W, 8):
        c.VL(x, 0, 29, K('ita', -2)); c.VL(x + 1, 0, 29, K('ita', 0))
        if rnd(x, 0, 32, 600):
            c.VL(x + 4 + hs(x, 1, 33) % 3, hs(x, 2, 34) % 18, 4, K('ita', -2))
    c.HL(0, 17, W, K('ita', 1)); c.HL(0, 18, W, K('ita', 0)); c.HL(0, 19, W, K('ita', -2))
    c.R(0, 29, W, 3, K('ita', -3)); c.HL(0, 29, W, K('ita', -2))


# ───────────────────────── 탁자 ─────────────────────────
@R.table('fd-counter', '식당 카운터', one_row=True, desc='손님 쪽 앞 모서리가 보이는 나무 카운터. 뒤쪽(주방 쪽)에 낮은 턱, 앞 판은 세로 널. L자는 가로줄+세로줄(1×1)로.', tags=('카운터', '라멘', '초밥'))
def _(c, w, h):
    W = w * 16
    c.R(0, 0, W, 3, K('yuka', -2)); c.HL(0, 0, W, K('yuka', 0)); c.HL(0, 2, W, K('yuka', -2))        # 주방 쪽 턱
    c.R(0, 3, W, 6, K('yuka', 1)); c.HL(0, 3, W, K('yuka', 2))
    for x in range(W):
        if rnd(x, 5, 41, 140): c.HL(x, 5 + hs(x, 0, 42) % 3, 2, K('yuka', 0))
    c.R(0, 9, W, 3, K('yuka', -1)); c.HL(0, 9, W, K('yuka', 0)); c.HL(0, 11, W, K('yuka', -2))        # 앞 모서리
    c.R(0, 12, W, 4, K('ita', -1))
    for x in range(0, W, 4): c.VL(x, 12, 4, K('ita', -2))
    c.HL(0, 15, W, K('ita', -3))
    c.VL(0, 3, 13, K('yuka', 2)); c.P(0, 3, None); c.VL(W - 1, 3, 13, K('yuka', -2)); c.P(W - 1, 3, None)


@R.table('fd-table', '식당 탁자', desc='짙은 나무 탁자(2·4인). 윗면 림, 앞 테두리, 양 끝 다리.', tags=('탁자', '킷사텐', '이자카야'))
def _(c, w, h):
    W, H = w * 16, h * 16; m = 'ita'; ty1 = H - 10
    c.R(0, 1, W, ty1, K('yuka', 1)); c.HL(0, 1, W, K('yuka', 3))
    for y in range(4, ty1, 4):
        for x in range(0, W, 16): c.HL(x + (3 if (y // 4) % 2 else 9), y, 5, K('yuka', 0))
    c.R(0, ty1 + 1, W, 3, K('yuka', -1)); c.HL(0, ty1 + 1, W, K('yuka', 0)); c.HL(0, ty1 + 3, W, K('ita', -3))
    c.VL(0, 2, ty1 + 2, K('yuka', 3)); c.VL(W - 1, 2, ty1 + 2, K('yuka', -2)); c.P(0, 1, None); c.P(W - 1, 1, None)
    for x0 in (1, W - 3): c.R(x0, H - 6, 2, 6, K(m, -1)); c.VL(x0, H - 6, 6, K(m, 0)); c.VL(x0 + 1, H - 6, 6, K(m, -3))


# ───────────────────────── 의자·스툴 ─────────────────────────
@O('fd-stool', '스툴', w=1, h=1, up=0, kind='floor', use=('sit',), desc='카운터 앞 둥근 스툴. 붉은 방석 + 가는 다리.', tags=('스툴', '카운터'))
def _(c):
    c.R(7, 9, 2, 6, K('tekko', 0)); c.VL(7, 9, 6, K('tekko', 1)); c.VL(8, 9, 6, K('tekko', -2))
    c.HL(4, 14, 8, K('tekko', -1)); c.HL(4, 15, 8, K('tekko', -3))
    ell(c, 8, 6, 5.5, 3.2, 'aka')
    c.HL(5, 4, 3, K('aka', 3))


def _chair(d):
    m = 'ita'; yb = 16
    def f(c):
        def seat(x0, w): c.R(x0, yb + 3, w, 4, K(m, 1)); c.HL(x0, yb + 3, w, K(m, 2)); c.HL(x0, yb + 6, w, K(m, -2))
        if d == 's':
            c.R(4, 6, 8, 9, K(m, 0)); box(c, 4, 6, 8, 9, K(m, -3)); c.HL(5, 7, 6, K(m, 1))
            seat(3, 10); c.R(3, yb + 7, 10, 2, K(m, -1)); c.HL(3, yb + 8, 10, K(m, -3))
            for x in (4, 10): c.R(x, yb + 9, 2, 6, K(m, -1)); c.VL(x, yb + 9, 6, K(m, 0))
        elif d == 'n':
            c.R(3, 8, 10, 13, K(m, -1)); box(c, 3, 8, 10, 13, K(m, -3)); c.HL(4, 9, 8, K(m, 0))
            for y in (12, 16): c.HL(5, y, 6, K(m, -2))
            c.R(3, yb + 6, 10, 2, K(m, -1)); c.HL(3, yb + 7, 10, K(m, -3))
            for x in (4, 10): c.R(x, yb + 8, 2, 7, K(m, -2)); c.VL(x, yb + 8, 7, K(m, -1))
        else:
            bx = 3 if d == 'e' else 11
            c.R(bx, 6, 2, 12, K(m, 0)); c.VL(bx, 6, 12, K(m, 2)); c.VL(bx + 1, 6, 12, K(m, -3))
            seat(3, 10); c.R(3, yb + 7, 10, 2, K(m, -1)); c.HL(3, yb + 8, 10, K(m, -3))
            for x in (3, 11): c.R(x, yb + 9, 2, 6, K(m, -1)); c.VL(x, yb + 9, 6, K(m, 0))
    return f


for _d in 'snew':
    O('fd-chair-' + _d, {'s': '의자(남향)', 'n': '의자(북향)', 'e': '의자(동향)', 'w': '의자(서향)'}[_d], w=1, h=1, up=16, kind='floor',
      use=('sit',), facing=_d.upper(), desc='식당 나무 의자 4방향 중 하나.', tags=('의자', '탁자'))(_chair(_d))


# ───────────────────────── 주방 기구(벽 1×1, up=16) ─────────────────────────
def steam(c, x, y, s=0):
    for i, (dx, dy) in enumerate(((0, 0), (1, -2), (0, -4), (-1, -6))):
        if rnd(x, i, s, 800): c.P(x + dx, y + dy, K('shiro', 1)); c.P(x + dx + 1, y + dy, K('shiro', 0))


def steel_front(c, yb, doors=2, handle=True):
    c.R(0, yb + 8, 16, 7, K('conc', 2)); c.HL(0, yb + 8, 16, K('conc', 3)); c.HL(0, yb + 9, 16, K('conc', 1))
    c.VL(0, yb + 8, 7, K('conc', 3)); c.VL(15, yb + 8, 7, K('conc', 0)); c.HL(0, yb + 14, 16, K('conc', 0))
    c.R(0, yb + 15, 16, 1, K('tekko', -2))
    if doors == 2:
        c.VL(8, yb + 10, 4, K('conc', -1))
        if handle: c.VL(6, yb + 11, 2, K('tekko', -2)); c.VL(10, yb + 11, 2, K('tekko', -2))
    elif handle: c.VL(11, yb + 11, 2, K('tekko', -2))


@O('fd-prep', '조리 작업대', w=1, h=1, up=16, kind='wall', surface=True, use=('search',), desc='스테인리스 작업대. 뒤 타일 + 도구 걸이.', tags=('주방', '작업대'))
def _(c):
    yb = 16
    c.R(1, 6, 14, 10, K('conc', 2)); c.HL(1, 6, 14, K('conc', 3))
    for x in (5, 9, 13): c.VL(x, 7, 9, K('conc', 1))
    c.HL(1, 11, 14, K('conc', 1)); c.HL(1, 15, 14, K('conc', 0))
    c.HL(2, 7, 12, K('tekko', -1))
    for x, col in ((4, K('tekko', 0)), (8, K('aka', 0)), (12, K('tekko', 1))):
        c.VL(x, 8, 4, col); c.P(x, 12, col); c.P(x + 1, 12, col)
    c.R(0, yb, 16, 8, K('shiro', 1)); c.HL(0, yb, 16, K('shiro', 3)); c.HL(0, yb + 7, 16, K('conc', 1))
    c.VL(0, yb, 8, K('shiro', 2)); c.VL(15, yb, 8, K('conc', 1))
    c.R(0, yb + 8, 16, 2, K('conc', 0)); c.HL(0, yb + 9, 16, K('conc', -2))
    c.R(0, yb + 10, 16, 5, K('conc', 2)); c.VL(0, yb + 10, 5, K('conc', 3)); c.VL(15, yb + 10, 5, K('conc', 0))
    c.VL(8, yb + 10, 4, K('conc', -1)); c.VL(6, yb + 11, 2, K('tekko', -2)); c.VL(10, yb + 11, 2, K('tekko', -2))
    c.HL(0, yb + 14, 16, K('conc', 0)); c.R(0, yb + 15, 16, 1, K('tekko', -2))


@O('fd-sink', '조리 싱크', w=1, h=1, up=16, kind='wall', surface=False, use=('search',), desc='스테인리스 깊은 싱크 + 수전.', tags=('주방', '싱크'))
def _(c):
    yb = 16
    c.R(6, 3, 2, 5, K('tekko', 1)); c.HL(6, 3, 6, K('tekko', 2)); c.VL(11, 3, 4, K('tekko', 0)); c.P(11, 7, K('tekko', -1))   # 수전
    c.P(5, 8, K('aka', 0)); c.P(9, 8, K('sora', 0))
    c.R(0, yb, 16, 8, K('shiro', 1)); c.HL(0, yb, 16, K('shiro', 3)); c.VL(0, yb, 8, K('shiro', 2)); c.VL(15, yb, 8, K('conc', 1))
    c.R(2, yb + 2, 12, 5, K('conc', 0)); box(c, 2, yb + 2, 12, 5, K('conc', -2)); c.HL(3, yb + 3, 10, K('conc', 1))
    c.R(3, yb + 4, 10, 2, K('sora', -1)); c.HL(3, yb + 4, 10, K('sora', 0))
    c.R(0, yb + 8, 16, 7, K('conc', 2)); c.HL(0, yb + 8, 16, K('conc', 1)); c.VL(0, yb + 8, 7, K('conc', 3)); c.VL(15, yb + 8, 7, K('conc', 0))
    c.VL(8, yb + 9, 5, K('conc', -1)); c.VL(6, yb + 10, 2, K('tekko', -2)); c.VL(10, yb + 10, 2, K('tekko', -2))
    c.HL(0, yb + 14, 16, K('conc', 0)); c.R(0, yb + 15, 16, 1, K('tekko', -2))


@O('fd-stockpot', '육수 솥(곤로)', w=1, h=1, up=16, kind='wall', use=(), desc='곤로 위의 큰 솥 두 개 + 김. 라멘 육수.', tags=('주방', '라멘'))
def _(c):
    yb = 16
    steam(c, 5, 5, 3); steam(c, 11, 3, 4)
    for x0, w in ((1, 7), (8, 7)):
        c.R(x0, 8, w, 12, K('conc', 1)); c.VL(x0, 8, 12, K('conc', 3)); c.VL(x0 + w - 1, 8, 12, K('conc', -1))
        c.HL(x0, 8, w, K('shiro', 2)); c.HL(x0, 9, w, K('conc', 2)); c.HL(x0, 19, w, K('conc', -2))
        c.VL(x0 - 1 if x0 > 1 else 0, 11, 2, K('tekko', 0)) if x0 > 1 else None
        c.R(x0 + 1, 6, w - 2, 2, K('conc', 0)); c.HL(x0 + 1, 6, w - 2, K('conc', 2))                               # 뚜껑
        c.P(x0 + w // 2, 5, K('tekko', -1))
        c.HL(x0, 12, w, K('conc', 0))
    c.R(0, yb + 4, 16, 11, K('tekko', 0)); c.HL(0, yb + 4, 16, K('tekko', 2)); c.HL(0, yb + 5, 16, K('tekko', 1))
    c.VL(0, yb + 4, 11, K('tekko', 2)); c.VL(15, yb + 4, 11, K('tekko', -2))
    for x in (4, 11): ell(c, x, yb + 9, 2.2, 2.2, 'tekko', ol=True, hi=False); c.P(x, yb + 9, K('daidai', 1))     # 화구 불빛
    c.R(0, yb + 14, 16, 2, K('tekko', -2))
    c.P(3, yb + 13, K('daidai', 0)); c.P(12, yb + 13, K('kii', 0))


@O('fd-noodle-boiler', '면 삶는 기계', w=1, h=1, up=16, kind='wall', use=(), desc='스테인리스 면 삶는 통. 끓는 물 + 면 소쿠리 손잡이 + 김.', tags=('주방', '라멘'))
def _(c):
    yb = 16
    steam(c, 4, 6, 5); steam(c, 10, 5, 6)
    for x in (3, 9):
        c.VL(x, 7, 8, K('tekko', 0)); c.HL(x, 7, 4, K('tekko', 1)); c.VL(x + 3, 7, 8, K('tekko', -1))
    c.R(1, yb - 1, 14, 3, K('conc', 3)); c.HL(1, yb - 1, 14, K('shiro', 3))
    c.R(0, yb + 2, 16, 6, K('shiro', 1)); c.HL(0, yb + 2, 16, K('shiro', 3)); c.VL(0, yb + 2, 6, K('shiro', 2)); c.VL(15, yb + 2, 6, K('conc', 1))
    c.R(2, yb + 3, 12, 4, K('sora', 0)); box(c, 2, yb + 3, 12, 4, K('conc', -2))
    for x, y in ((4, yb + 4), (8, yb + 5), (11, yb + 4)): c.P(x, y, K('shiro', 2)); c.P(x + 1, y, K('shiro', 1))
    steel_front(c, yb - 0)
    c.R(6, yb + 10, 4, 2, K('tekko', -1)); c.P(7, yb + 10, K('midori', 0)); c.P(9, yb + 10, K('aka', 0))     # 다이얼


@O('fd-fryer', '튀김기', w=1, h=1, up=16, kind='wall', use=(), desc='스테인리스 튀김기. 노란 기름 + 바구니 손잡이.', tags=('주방', '튀김'))
def _(c):
    yb = 16
    c.VL(3, 7, 7, K('tekko', 0)); c.HL(1, 7, 5, K('tekko', 2)); c.P(1, 8, K('tekko', 0))
    c.VL(12, 7, 7, K('tekko', 0)); c.HL(10, 7, 5, K('tekko', 2)); c.P(14, 8, K('tekko', 0))
    c.R(2, 13, 12, 3, K('conc', 0)); c.HL(2, 13, 12, K('conc', 3))
    c.R(0, yb + 1, 16, 7, K('shiro', 1)); c.HL(0, yb + 1, 16, K('shiro', 3)); c.VL(0, yb + 1, 7, K('shiro', 2)); c.VL(15, yb + 1, 7, K('conc', 1))
    for x0 in (1, 9):
        c.R(x0, yb + 2, 6, 5, K('kii', 0)); box(c, x0, yb + 2, 6, 5, K('conc', -2)); c.HL(x0 + 1, yb + 3, 3, K('kii', 2)); c.P(x0 + 4, yb + 5, K('daidai', 0))
    steel_front(c, yb)


@O('fd-fridge', '업소용 냉장고', w=1, h=2, up=0, kind='wall', use=('open',), desc='스테인리스 업소용 냉장고(2칸 높이). 문 두 짝 + 긴 손잡이 + 온도 표시등.', tags=('주방', '냉장'))
def _(c):
    c.R(1, 1, 14, 31, K('conc', 2)); box(c, 1, 1, 14, 31, K('conc', -3))
    c.HL(2, 2, 12, K('shiro', 3)); c.VL(2, 2, 29, K('conc', 3)); c.VL(13, 3, 28, K('conc', 1))
    c.R(3, 3, 10, 3, K('conc', 0)); c.HL(3, 3, 10, K('conc', 1)); c.P(4, 4, K('midori', 1)); c.P(5, 4, K('midori', 1)); c.P(11, 4, K('aka', 0))
    c.HL(2, 7, 12, K('conc', -2))
    c.VL(8, 8, 22, K('conc', -2)); c.VL(7, 8, 22, K('conc', 3))
    for x in (6, 9):
        c.VL(x, 14, 8, K('tekko', 1) if x == 6 else K('tekko', -2))
    c.HL(1, 30, 14, K('tekko', 0)); c.R(1, 31, 14, 1, K('tekko', -3))
    c.R(3, 30, 2, 2, K('tekko', -2)); c.R(11, 30, 2, 2, K('tekko', -2))


@O('fd-sake-shelf', '술병 선반', w=2, h=1, up=16, kind='wall', use=('search',), desc='나무 선반장 가득한 술병(초록·남·흰·붉은 라벨 띠). 아래는 수납 문.', tags=('이자카야', '술'))
def _(c):
    W = 32; yb = 16
    c.R(0, 2, W, 30, K('ita', -1)); c.VL(0, 2, 30, K('ita', 1)); c.VL(W - 1, 2, 30, K('ita', -3)); c.HL(0, 2, W, K('ita', 1))
    c.R(2, 4, W - 4, 22, K('ita', -3))
    cols = ['midori', 'kon', 'shiro', 'aka', 'midori', 'kon', 'kii', 'shiro']
    for sy in (4, 15):
        for i in range(7):
            bx = 3 + i * 4 + (1 if i > 3 else 0)
            col = cols[(i + sy) % len(cols)]
            c.R(bx + 1, sy + 1, 2, 3, K(col, 0)); c.P(bx + 1, sy + 1, K(col, 2))                      # 목
            c.R(bx, sy + 4, 3, 6, K(col, 0)); c.VL(bx, sy + 4, 6, K(col, 1)); c.VL(bx + 2, sy + 4, 6, K(col, -2))
            c.HL(bx, sy + 6, 3, K('shiro', 1) if col != 'shiro' else K('aka', 0))                         # 라벨 띠
        c.R(2, sy + 10, W - 4, 2, K('ita', 0)); c.HL(2, sy + 10, W - 4, K('ita', 2)); c.HL(2, sy + 11, W - 4, K('ita', -2))
    c.R(0, yb + 10, W, 6, K('ita', 0)); c.HL(0, yb + 10, W, K('ita', 2)); c.HL(0, yb + 11, W, K('ita', -2))
    c.VL(0, yb + 10, 6, K('ita', 2)); c.VL(W - 1, yb + 10, 6, K('ita', -3)); c.VL(16, yb + 11, 5, K('ita', -3)); c.VL(15, yb + 12, 3, K('ita', 2))
    c.P(13, yb + 12, K('tekko', -1)); c.P(18, yb + 12, K('tekko', -1)); c.HL(0, yb + 15, W, K('ita', -3))


# ───────────────────────── 손님 쪽 소품 ─────────────────────────
@O('fd-ticket-machine', '식권 자판기', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='라멘집 식권기(벽에 붙여 세우는 상자형). 은회색 몸통, 위쪽에 작은 색 버튼이 촘촘한 격자(글자 없음), 중간에 지폐 투입 슬롯, 아래에 식권이 나오는 어두운 출구.', tags=('라멘', '식권'))
def _(c):
    c.R(1, 2, 14, 29, K('conc', 1)); box(c, 1, 2, 14, 29, K('conc', -3)); c.HL(2, 3, 12, K('conc', 3)); c.VL(2, 3, 27, K('conc', 2)); c.VL(13, 4, 26, K('conc', -1))
    c.R(3, 5, 10, 14, K('conc', -2)); box(c, 3, 5, 10, 14, K('sumi', 1))                                # 버튼 패널(어두운 판)
    cols = ('shiro', 'kii', 'midori', 'sora', 'daidai', 'pinku', 'aka')
    for r in range(6):
        for q in range(4):
            col = cols[(r * 2 + q * 3 + (r // 2)) % len(cols)]
            x, y = 4 + q * 2 + (0 if q < 4 else 0), 6 + r * 2
            c.R(x, y, 1, 1, K(col, 1)); c.P(x + 1, y, K('sumi', 2))
    c.R(4, 20, 8, 3, K('conc', 0)); box(c, 4, 20, 8, 3, K('conc', -3))                                  # 지폐 투입구 둘레
    c.R(5, 21, 6, 1, K('sumi', -2)); c.HL(5, 21, 6, K('sumi', -2))
    c.R(4, 24, 8, 5, K('tekko', -2)); box(c, 4, 24, 8, 5, K('sumi', -2)); c.HL(5, 25, 6, K('sumi', -3))   # 식권 출구
    c.R(6, 27, 4, 2, K('shiro', 1)); c.HL(6, 27, 4, K('shiro', 3))                                       # 나오는 식권
    c.R(2, 31, 12, 1, K('conc', -3))


@O('fd-water-jug', '물병 스탠드', w=1, h=1, up=16, kind='floor', surface=True, use=(), desc='입구 옆 셀프 물 — 스탠드 위 물 주전자와 컵.', tags=('라멘', '물'))
def _(c):
    yb = 16
    c.R(4, 5, 8, 9, K('garasu', 1)); box(c, 4, 5, 8, 9, K('garasu', -2)); c.R(5, 8, 6, 5, K('sora', 0)); c.HL(5, 8, 6, K('sora', 2)); c.HL(4, 4, 8, K('tekko', 0))
    c.R(11, 8, 2, 4, K('tekko', 0)); c.VL(13, 9, 2, K('tekko', -1))
    c.R(0, yb, 16, 5, K('yuka', 1)); c.HL(0, yb, 16, K('yuka', 2)); c.HL(0, yb + 4, 16, K('yuka', -2))
    for x in (2, 6): c.R(x, yb + 1, 3, 3, K('garasu', 2)); box(c, x, yb + 1, 3, 3, K('garasu', 0))
    c.R(0, yb + 5, 16, 10, K('ita', -1)); c.VL(0, yb + 5, 10, K('ita', 1)); c.VL(15, yb + 5, 10, K('ita', -3)); c.HL(0, yb + 5, 16, K('ita', 0))
    c.R(1, yb + 7, 14, 6, K('ita', 0)); box(c, 1, yb + 7, 14, 6, K('ita', -3)); c.P(12, yb + 9, K('tekko', 1)); c.HL(0, yb + 15, 16, K('ita', -3))


@O('fd-register', '계산대', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='작은 계산 카운터. 위에 금전 등록기(화면은 초록 점).', tags=('계산', '킷사텐'))
def _(c):
    yb = 16
    c.R(3, 4, 10, 8, K('conc', 1)); box(c, 3, 4, 10, 8, K('conc', -3)); c.R(4, 5, 8, 3, K('sumi', 0)); c.HL(5, 6, 4, K('midori', 1)); c.P(10, 6, K('kii', 1))
    for r in range(2):
        for q in range(4): c.P(4 + q * 2, 9 + r * 1 * 1, K('conc', 3 if (q + r) % 2 else 2))
    c.R(2, 11, 12, 3, K('tekko', 0)); c.HL(2, 11, 12, K('tekko', 2)); c.HL(2, 13, 12, K('tekko', -2))
    c.R(0, yb + 1, 16, 4, K('yuka', 1)); c.HL(0, yb + 1, 16, K('yuka', 2)); c.HL(0, yb + 4, 16, K('yuka', -2)); c.P(11, yb + 2, K('kii', 1))
    c.R(0, yb + 5, 16, 10, K('ita', -1)); c.HL(0, yb + 5, 16, K('ita', 0)); c.VL(0, yb + 5, 10, K('ita', 1)); c.VL(15, yb + 5, 10, K('ita', -3))
    c.R(2, yb + 7, 5, 6, K('ita', 0)); box(c, 2, yb + 7, 5, 6, K('ita', -3)); c.R(9, yb + 7, 5, 6, K('ita', 0)); box(c, 9, yb + 7, 5, 6, K('ita', -3))
    c.HL(0, yb + 15, 16, K('ita', -3))


@O('fd-neta-case', '네타 케이스', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='초밥 카운터 위의 유리 생선 진열장. 안에 붉은살·흰살·새우 토막(색 띠)이 줄지어 있고 아래는 나무 카운터. 가로로 이어 놓는다.', tags=('초밥', '가게', '진열'))
def _(c):
    yb = 16
    # 유리 상자: 위 테두리(철) + 뒤판 + 앞유리, 안에 네타 3줄
    c.R(1, 3, 14, 11, K('garasu', 1)); box(c, 1, 3, 14, 11, K('tekko', -2))
    c.R(2, 4, 12, 2, K('garasu', 3)); c.HL(2, 4, 12, K('shiro', 1))
    c.R(2, 6, 12, 6, K('garasu', 2))
    for i, col in enumerate(('aka', 'pinku', 'kinari', 'aka')):
        x = 3 + i * 3
        c.R(x, 8, 3, 2, K('shiro', 0)); c.R(x, 7, 3, 2, K(col, 0)); c.HL(x, 7, 3, K(col, 2)); c.HL(x, 9, 3, K(col, -2))
    c.HL(2, 10, 12, K('tekko', 1))
    c.R(2, 11, 12, 2, K('garasu', 0)); c.HL(2, 11, 12, K('shiro', 2)); c.VL(2, 4, 8, K('shiro', 2))
    c.R(1, 13, 14, 2, K('tekko', 0)); c.HL(1, 13, 14, K('tekko', 2)); c.HL(1, 14, 14, K('tekko', -2))
    # 나무 카운터
    c.R(0, yb, 16, 5, K('yuka', 1)); c.HL(0, yb, 16, K('yuka', 2)); c.HL(0, yb + 4, 16, K('yuka', -2))
    c.R(0, yb + 5, 16, 10, K('ita', -1)); c.HL(0, yb + 5, 16, K('ita', 0)); c.VL(0, yb + 5, 10, K('ita', 1)); c.VL(15, yb + 5, 10, K('ita', -3))
    for x in (5, 10): c.VL(x, yb + 6, 9, K('ita', -3))
    c.HL(0, yb + 15, 16, K('ita', -3))


@O('fd-beer-crates', '맥주 상자', w=1, h=1, up=0, kind='floor', use=(), desc='붉은·노란 플라스틱 병 상자 2단.', tags=('이자카야', '술'))
def _(c):
    for y0, col in ((9, 'aka'), (2, 'kii')):
        c.R(1, y0, 14, 6, K(col, 0)); box(c, 1, y0, 14, 6, K(col, -3)); c.HL(2, y0 + 1, 12, K(col, 2)); c.VL(2, y0 + 1, 4, K(col, 1))
        for x in range(3, 14, 3): c.R(x, y0 + 2, 2, 3, K('sumi', 1)); c.P(x, y0 + 2, K('midori', 0) if (x + y0) % 2 else K('kii', 1))   # 병 목
        c.R(5, y0 + 5, 6, 1, K(col, -2))
    c.HL(1, 14, 14, K('aka', -3)); c.P(14, 2, None)


@O('fd-zashiki', '자시키 단(4×2)', w=4, h=2, up=0, kind='flat', walk=tuple((x, y) for y in range(2) for x in range(4)), use=(), desc='바닥보다 한 단 높은 다다미 단(4×2칸). 위는 다다미 네 장(가로로 긴 모양, 반 장 어긋난 깔기, 결은 가로줄, 장 둘레는 짙은 가장자리 띠). 방석·좌탁은 그려져 있지 않다(zataku 를 따로 놓는다). 서쪽·동쪽 가장자리에 나무 테두리 1px, 남쪽 앞면은 나무 단 두께 띠 한 줄.', tags=('이자카야', '다다미', '좌식'))
def _(c):
    W = c.w
    c.HL(0, 0, W, OL)
    for (y0, seams) in ((1, (32,)), (14, (16, 48))):                                  # 다다미 두 줄(13px 높이)
        c.R(0, y0, W, 13, K('kinari', 0))
        c.HL(0, y0, W, K('kinari', -2)); c.HL(0, y0 + 12, W, K('kinari', -2))         # 긴 변 가장자리 띠(짙게)
        for y in (y0 + 3, y0 + 6, y0 + 9):                                                  # 결: 가로 가는 줄
            c.HL(1, y, W - 2, K('kinari', -1))
        for x in seams:
            c.VL(x, y0, 13, K('kinari', -2)); c.VL(x + 1, y0 + 1, 11, K('kinari', 1))
    c.VL(0, 0, 28, OL); c.VL(W - 1, 0, 28, OL)
    # 서쪽·동쪽 단 가장자리: 나무 테두리 1px(바깥 외곽선 안쪽)
    c.VL(1, 1, 26, K('ita', 1)); c.VL(W - 2, 1, 26, K('ita', -2))
    c.HL(0, 27, W, OL)
    c.HL(0, 28, W, K('ita', 3)); c.R(0, 29, W, 1, K('ita', 1)); c.HL(0, 30, W, K('ita', -1))   # 나무 단 두께 띠(한 줄)
    c.HL(0, 31, W, OL)
    for x in (21, 43): c.VL(x, 28, 3, K('ita', -2))


@O('fd-kutsunugi', '신발 벗는 디딤돌(2×1)', w=2, h=1, up=0, kind='flat', walk=((0, 0), (1, 0)), use=(), desc='자시키 단 앞 바닥에 깔린 납작한 회색 디딤돌(구츠누기 이시, 앞쪽 가장자리 두께만 보인다). 위에 벗어 둔 구두 한 켤레(코가 오른쪽).', tags=('이자카야', '신발', '현관'))
def _(c):
    W = c.w
    c.HL(1, 1, W - 2, OL); c.VL(0, 2, 12, OL); c.VL(W - 1, 2, 12, OL)
    c.R(1, 2, W - 2, 10, K('conc', 1)); c.HL(1, 2, W - 2, K('conc', 2)); c.VL(1, 2, 10, K('conc', 2))
    for x, y in ((9, 10), (24, 4), (14, 11), (27, 9)): c.P(x, y, K('conc', 0))
    c.R(1, 12, W - 2, 3, K('conc', -1)); c.HL(1, 12, W - 2, K('conc', 0))                   # 앞쪽 가장자리 두께
    c.HL(0, 15, W, OL); c.P(0, 12, OL); c.P(0, 13, OL); c.P(0, 14, OL)
    G = ('.oooooo......', 'ohhhhhho.....', 'ohddddhtto...', 'obbbbbbtbbbo.', 'obbbbbbbsbccb', 'ollllllllllll', '.mmmmmmmmmmm.')
    COL = {'o': K('yoru', -3), 'b': K('yoru', 1), 'h': K('yoru', 3), 'd': K('yoru', -3), 't': K('yoru', 2),
           's': K('yoru', -1), 'c': K('yoru', 3), 'l': K('ita', 2), 'm': K('ita', -2)}
    for x0 in (3, 17):                                                                       # 구두 두 짝(옆면이 보이게 비스듬히)
        for r, row in enumerate(G):
            for i, ch in enumerate(row):
                if ch in COL: c.P(x0 + i, 3 + r, COL[ch])


@O('fd-noren', '노렌', w=1, h=1, up=0, kind='hang', hrows=2, use=(), desc='문 위에 걸린 천 가림막. 남색 천 셋 갈래 + 흰 가장자리 띠(글자 없음).', tags=('노렌', '입구'))
def _(c):
    c.R(1, 1, 14, 1, K('tekko', -1)); c.HL(1, 1, 14, K('tekko', 1)); c.P(0, 1, K('tekko', 0)); c.P(15, 1, K('tekko', 0))
    for x0 in (1, 6, 11):
        w = 4 if x0 != 6 else 5
        c.R(x0, 2, w, 14, K('kon', 0)); c.VL(x0, 2, 14, K('kon', 1)); c.VL(x0 + w - 1, 2, 14, K('kon', -2))
        c.R(x0 + 1, 6, w - 2, 3, K('shiro', 0)); c.HL(x0 + 1, 6, w - 2, K('shiro', 2))                    # 흰 문양 띠
        c.HL(x0, 15, w, K('shiro', 1))
        for y in (3, 10, 12):
            if hs(x0, y, 71) % 2: c.P(x0 + 1, y, K('kon', 1))
        c.P(x0 + w // 2, 2, K('tekko', 1))


@O('fd-lantern', '붉은 등롱', w=1, h=1, up=0, kind='hang', hrows=1, use=(), desc='음식점 입구 붉은 종이 등롱. 줄 + 검은 뚜껑·받침 + 흰 띠.', tags=('등롱', '입구'))
def _(c):
    c.VL(8, 0, 2, K('sumi', 1))
    c.R(5, 2, 6, 2, K('sumi', 0)); c.HL(5, 2, 6, K('sumi', 2))
    ell(c, 8, 8, 4.5, 4.5, 'aka')
    for y in (6, 8, 10): c.HL(4 + (1 if y != 8 else 0), y, 7 if y == 8 else 5, K('aka', -1))
    c.R(6, 7, 4, 3, K('shiro', 1)); c.HL(6, 7, 4, K('shiro', 3)); c.P(7, 8, K('aka', 0)); c.P(8, 9, K('aka', 0))
    c.R(5, 12, 6, 2, K('sumi', 0)); c.HL(5, 12, 6, K('sumi', 2)); c.VL(8, 14, 2, K('sumi', 1)); c.P(8, 15, K('daidai', 0))


@O('fd-menu-board', '메뉴판', w=2, h=1, up=0, kind='hang', hrows=2, use=('read',), desc='벽 메뉴판 — 나무 틀 + 색띠(품목)·값 점·작은 음식 그림 칸. 글자 없음.', tags=('메뉴', '벽'))
def _(c):
    W = 32
    c.R(1, 3, W - 2, 27, K('sumi', 0)); box(c, 1, 3, W - 2, 27, K('ita', 0)); box(c, 2, 4, W - 4, 25, K('ita', -2)); c.HL(2, 3, W - 2, K('ita', 2))
    cols = ('aka', 'kii', 'midori', 'sora', 'daidai', 'shiro')
    for i, y in enumerate(range(6, 27, 5)):
        c.R(4, y, 12, 3, K(cols[(i * 2) % 6], 0)); c.HL(4, y, 12, K(cols[(i * 2) % 6], 2))
        for k in range(4): c.P(17 + k * 2, y + 1, K('shiro', 1))                                        # 값 점
        c.R(24, y - 1, 5, 4, K(cols[(i * 2 + 1) % 6], 1)); box(c, 24, y - 1, 5, 4, K('shiro', 0))     # 음식 그림 칸
        c.P(26, y, K('kii', 2)); c.P(27, y + 1, K('aka', 0))
    c.P(1, 3, None); c.P(W - 2, 3, None)


# ───────────────────────── 탁상 물건(16×16, y 0~9) ─────────────────────────
@R.good('fd-ramen-bowl', '라멘 그릇', desc='붉은 그릇에 국물·차슈·파·면 + 젓가락.')
def _(c):
    ell(c, 8, 5, 6, 3.4, 'aka')
    c.R(4, 3, 8, 3, K('daidai', 1)); c.HL(4, 3, 8, K('kii', 2))
    c.R(5, 4, 3, 2, K('renga', 0)); c.P(6, 4, K('shiro', 1)); c.P(9, 3, K('midori', 1)); c.P(10, 5, K('midori', 1)); c.P(8, 3, K('midori', 1))
    c.HL(3, 8, 10, K('aka', -2)); c.HL(6, 9, 4, K('aka', -3))
    c.HL(11, 0, 4, K('ki', 1)); c.HL(12, 1, 3, K('ki', 0))


@R.good('fd-sushi-geta', '초밥 게타', desc='나무 받침판 위 초밥 네 점(흰 밥 + 붉은·주황 생선) + 와사비.')
def _(c):
    c.R(1, 5, 14, 3, K('yuka', 0)); c.HL(1, 5, 14, K('yuka', 2)); c.HL(1, 7, 14, K('yuka', -1))
    c.R(3, 8, 2, 1, K('yuka', -1)); c.R(11, 8, 2, 1, K('yuka', -1))
    for i, col in enumerate(('aka', 'daidai', 'pinku', 'aka')):
        x = 2 + i * 3
        c.R(x, 3, 3, 2, K('shiro', 1)); c.P(x, 4, K('shiro', 0)); c.R(x, 2, 3, 2, K(col, 0)); c.HL(x, 2, 3, K(col, 2))
    c.P(14, 3, K('midori', 0)); c.P(14, 4, K('midori', -1))


@R.good('fd-beer-mug', '맥주잔', desc='손잡이 달린 큰 잔, 노란 맥주 + 흰 거품.')
def _(c):
    c.R(4, 2, 7, 7, K('kii', 0)); box(c, 4, 2, 7, 7, K('garasu', -1)); c.VL(5, 3, 5, K('kii', 2))
    c.R(4, 1, 7, 2, K('shiro', 1)); c.HL(4, 1, 7, K('shiro', 3)); c.P(4, 1, None); c.P(10, 1, None)
    c.VL(11, 3, 4, K('garasu', 0)); c.VL(12, 3, 4, K('garasu', 0)); c.P(12, 3, K('garasu', 2)); c.P(12, 6, K('garasu', -1))
    c.HL(4, 9, 7, K('garasu', -2))


@R.good('fd-tokkuri', '도쿠리와 잔', desc='하늘색 도쿠리(술병) + 작은 흰 잔.')
def _(c):
    c.R(5, 0, 2, 2, K('sora', 0)); c.P(5, 0, K('sora', 2))
    c.R(4, 2, 4, 7, K('sora', 0)); c.VL(4, 2, 7, K('sora', 2)); c.VL(7, 2, 7, K('sora', -2)); c.HL(4, 8, 4, K('sora', -3)); c.HL(4, 5, 4, K('shiro', 1))
    c.P(4, 2, None); c.P(7, 2, None)
    c.R(10, 6, 4, 3, K('shiro', 1)); c.HL(10, 6, 4, K('shiro', 3)); c.VL(13, 6, 3, K('shiro', -1)); c.HL(11, 8, 2, K('conc', 0)); c.HL(10, 9, 4, K('conc', -2))


@R.good('fd-water-set', '물 주전자와 컵', desc='투명 물 주전자(손잡이·하늘색 물) + 유리컵 둘.')
def _(c):
    c.R(2, 2, 6, 7, K('garasu', 1)); box(c, 2, 2, 6, 7, K('garasu', -2)); c.R(3, 4, 4, 4, K('sora', 0)); c.HL(3, 4, 4, K('sora', 2))
    c.HL(3, 1, 4, K('tekko', 0)); c.P(2, 2, None); c.P(7, 2, None)
    c.VL(8, 3, 4, K('garasu', 0)); c.VL(9, 3, 4, K('garasu', 0)); c.P(9, 3, K('garasu', 2)); c.P(9, 6, K('garasu', -1))
    c.HL(2, 9, 6, K('garasu', -3))
    for x in (11, 13):
        c.R(x, 5, 2, 4, K('garasu', 2)); box(c, x, 5, 2, 4, K('garasu', -1)); c.P(x, 6, K('sora', 1)); c.P(x + 1, 7, K('sora', 0))


@R.good('fd-condiments', '조미료 세 가지', desc='간장병(검정 뚜껑)·후추 통·소금 통(투명 + 흰 뚜껑).')
def _(c):
    c.R(1, 3, 4, 6, K('renga', -1)); c.HL(1, 3, 4, K('renga', 1)); c.R(2, 1, 2, 2, K('aka', 0)); c.HL(1, 9, 4, K('renga', -3)); c.P(2, 5, K('shiro', 1))
    c.R(6, 3, 4, 6, K('garasu', 1)); box(c, 6, 3, 4, 6, K('garasu', -1)); c.R(7, 6, 2, 3, K('sumi', 1)); c.R(6, 1, 4, 2, K('tekko', 0)); c.HL(6, 1, 4, K('tekko', 2)); c.HL(6, 9, 4, K('garasu', -2))
    c.R(11, 3, 4, 6, K('garasu', 2)); box(c, 11, 3, 4, 6, K('garasu', -1)); c.R(12, 5, 2, 4, K('shiro', 2)); c.R(11, 1, 4, 2, K('shiro', 0)); c.HL(11, 1, 4, K('shiro', 3)); c.HL(11, 9, 4, K('garasu', -2))


@R.good('fd-teishoku', '정식 쟁반', desc='쟁반에 밥·국·주반찬·절임(흰 밥, 갈색 국, 구운 생선, 작은 접시).')
def _(c):
    c.R(0, 1, 16, 8, K('ita', -1)); box(c, 0, 1, 16, 8, K('ita', -3)); c.HL(1, 2, 14, K('ita', 1)); c.P(0, 1, None); c.P(15, 1, None)
    ell(c, 4, 5, 3, 2.4, 'shiro'); c.R(2, 4, 4, 2, K('shiro', 2)); c.P(3, 3, K('shiro', 3))
    ell(c, 11, 4.5, 3, 2.3, 'aka'); c.R(9, 4, 4, 2, K('renga', 0)); c.P(10, 4, K('midori', 1))
    c.R(7, 6, 5, 2, K('conc', 2)); c.HL(7, 6, 5, K('conc', 3)); c.R(7, 5, 4, 1, K('daidai', 0)); c.P(11, 5, K('daidai', -1))
    c.R(13, 6, 2, 2, K('shiro', 1)); c.P(13, 6, K('aka', 0)); c.P(14, 7, K('kii', 0))


# ───────────────────────── 킷사텐 카운터 쪽 ─────────────────────────
def counter_base(c, doors=True):
    """카운터 칸 아래 16행(yb=16): 상판 + 앞 널판 두 칸. 윗면 하이라이트는 왼쪽 위."""
    yb = 16
    c.R(0, yb, 16, 5, K('yuka', 1)); c.HL(0, yb, 16, K('yuka', 2)); c.HL(0, yb + 4, 16, K('yuka', -2))
    c.R(0, yb + 5, 16, 10, K('ita', -1)); c.HL(0, yb + 5, 16, K('ita', 0)); c.VL(0, yb + 5, 10, K('ita', 1)); c.VL(15, yb + 5, 10, K('ita', -3))
    if doors:
        c.R(2, yb + 7, 5, 6, K('ita', 0)); box(c, 2, yb + 7, 5, 6, K('ita', -3)); c.R(9, yb + 7, 5, 6, K('ita', 0)); box(c, 9, yb + 7, 5, 6, K('ita', -3))
        c.P(6, yb + 9, K('tekko', 1)); c.P(9, yb + 9, K('tekko', 1))
    c.HL(0, yb + 15, 16, K('ita', -3))


@O('fd-siphon', '사이펀 커피 기구', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='카운터 위 사이펀 두 대 — 철 기둥에 유리 위·아래 플라스크, 알코올 램프 불꽃. 한쪽은 끓어 오른 커피, 한쪽은 내려온 커피.', tags=('킷사텐', '커피', '사이펀'))
def _(c):
    # 철 기둥(두 사이펀 사이): 왼쪽이 밝고 오른쪽이 어둡다
    c.VL(7, 2, 12, K('tekko', 2)); c.VL(8, 2, 12, K('tekko', -2)); c.HL(7, 1, 2, K('tekko', 1))
    def siphon(x0, brewing):
        # 위 플라스크 (rows 1~6)
        c.R(x0, 2, 5, 5, K('garasu', 2)); box(c, x0, 2, 5, 5, K('garasu', -2)); c.P(x0, 2, None); c.P(x0 + 4, 2, None)
        c.P(x0 + 1, 3, K('shiro', 2)); c.P(x0 + 1, 4, K('shiro', 2))
        if brewing:
            c.R(x0 + 1, 4, 3, 2, K('ita', -2)); c.HL(x0 + 1, 4, 3, K('ita', 0)); c.P(x0 + 1, 4, K('ita', 1))
        c.HL(x0 + 1, 1, 3, K('tekko', 0))
        # 관
        c.VL(x0 + 2, 7, 2, K('garasu', -1))
        # 아래 플라스크 (rows 8~12)
        c.R(x0, 8, 5, 5, K('garasu', 2)); box(c, x0, 8, 5, 5, K('garasu', -2)); c.P(x0, 12, None); c.P(x0 + 4, 12, None)
        c.P(x0 + 1, 9, K('shiro', 2))
        if brewing:
            c.R(x0 + 1, 11, 3, 1, K('sora', 0)); c.P(x0 + 1, 11, K('sora', 2))
        else:
            c.R(x0 + 1, 10, 3, 2, K('ita', -2)); c.HL(x0 + 1, 10, 3, K('ita', 0)); c.P(x0 + 1, 10, K('ita', 1))
        # 알코올 램프 + 불꽃
        c.HL(x0 + 1, 13, 3, K('daidai', 0)); c.P(x0 + 2, 13, K('kii', 2))
        c.R(x0, 14, 5, 2, K('tekko', 0)); c.HL(x0, 14, 5, K('tekko', 2)); c.HL(x0, 15, 5, K('tekko', -3))
    siphon(2, True); siphon(9, False)
    counter_base(c)


@O('fd-coffee-machine', '에스프레소 머신', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='카운터 위 스테인리스 에스프레소 머신 — 붉은 띠, 압력계, 추출구 아래 잔 두 개, 위에 포개 둔 잔.', tags=('킷사텐', '커피', '카페'))
def _(c):
    # 위에 포개 둔 잔
    for x in (3, 8):
        c.R(x, 1, 4, 2, K('shiro', 1)); box(c, x, 1, 4, 2, K('conc', -2)); c.HL(x + 1, 1, 2, K('shiro', 3))
    # 몸통
    c.R(1, 3, 14, 11, st(0)); box(c, 1, 3, 14, 11, st(-3)); c.HL(2, 4, 12, st(3)); c.VL(2, 4, 9, st(2)); c.VL(13, 4, 9, st(-2))
    c.R(3, 5, 10, 2, K('aka', 0)); c.HL(3, 5, 10, K('aka', 2)); c.HL(3, 6, 10, K('aka', -2))
    # 압력계 + 버튼
    c.R(7, 7, 2, 2, K('shiro', 1)); box(c, 7, 7, 2, 2, K('sumi', -1)); c.P(8, 8, K('aka', 0))
    c.P(4, 8, K('midori', 1)); c.P(11, 8, K('kii', 1))
    # 추출구 홈 + 잔
    c.R(3, 9, 10, 4, K('sumi', 0)); c.HL(3, 9, 10, K('sumi', -1))
    for x in (4, 9):
        c.R(x + 1, 9, 2, 2, K('tekko', 1)); c.P(x + 1, 11, K('ita', 0))
        c.R(x, 11, 4, 2, K('shiro', 0)); c.HL(x, 11, 4, K('ita', -2)); c.HL(x, 12, 4, K('conc', -1)); c.P(x, 11, K('ita', 0))
    # 스팀 완드
    c.VL(14, 7, 6, K('tekko', 1)); c.P(14, 13, K('tekko', 3))
    counter_base(c)


@O('fd-cake-case', '케이크 쇼케이스', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='카운터 위 유리 케이크 진열장 — 나무 뚜껑, 위 칸 조각 케이크(딸기·초콜릿), 아래 칸 통 케이크와 푸딩.', tags=('킷사텐', '케이크', '진열'))
def _(c):
    c.R(0, 1, 16, 2, K('ita', 0)); c.HL(0, 1, 16, K('ita', 2)); c.HL(0, 2, 16, K('ita', -2)); c.P(0, 1, K('ita', 3))
    c.R(1, 3, 14, 11, K('garasu', 1)); box(c, 1, 3, 14, 11, K('ita', -3))
    c.R(2, 4, 12, 9, K('garasu', 2))
    c.VL(2, 4, 8, K('shiro', 2)); c.P(3, 4, K('shiro', 2))
    # 위 칸: 조각 케이크 둘
    c.R(4, 6, 4, 2, K('pinku', 0)); c.HL(4, 6, 4, K('shiro', 1)); c.HL(4, 7, 4, K('pinku', -2)); c.P(5, 5, K('aka', 1))
    c.R(9, 6, 4, 2, K('soil', -1)); c.HL(9, 6, 4, K('shiro', 1)); c.HL(9, 7, 4, K('soil', -2)); c.P(10, 5, K('kii', 1))
    c.HL(2, 8, 12, K('garasu', -1))
    # 아래 칸: 통 케이크 + 푸딩
    c.HL(3, 9, 6, K('shiro', 2)); c.P(4, 9, K('aka', 1)); c.P(6, 9, K('aka', 1)); c.P(8, 9, K('aka', 1))
    c.R(3, 10, 6, 2, K('kinari', 0)); c.HL(3, 10, 6, K('shiro', 1)); c.HL(3, 11, 6, K('kinari', -2))
    c.R(11, 10, 3, 2, K('kii', 0)); c.HL(11, 10, 3, K('soil', -1)); c.HL(11, 11, 3, K('kii', -2))
    c.HL(2, 12, 12, K('shiro', 0)); c.P(2, 12, K('shiro', 2))
    counter_base(c)


@O('fd-bean-shelf', '원두 병 선반', w=2, h=1, up=16, kind='wall', use=('search',), desc='나무 선반장 — 유리 원두 병 열 개(갈색 원두, 검은 뚜껑, 흰 이름표 점) 두 단, 아래는 서랍 수납.', tags=('킷사텐', '커피', '원두'))
def _(c):
    W = 32; yb = 16
    c.R(0, 2, W, 30, K('ita', -1)); c.VL(0, 2, 30, K('ita', 1)); c.VL(W - 1, 2, 30, K('ita', -3)); c.HL(0, 2, W, K('ita', 1))
    c.R(2, 4, W - 4, 22, K('ita', -3))
    beans = [('soil', -1), ('soil', 0), ('ita', -2), ('kinari', -2), ('soil', -2)]
    for sy in (4, 15):
        for i in range(5):
            bx = 3 + i * 5
            b, t = beans[(i + sy) % 5]
            c.R(bx, sy + 1, 4, 2, K('tekko', 0)); c.HL(bx, sy + 1, 4, K('tekko', 2))                                  # 뚜껑
            c.R(bx, sy + 3, 4, 7, K('garasu', 1)); c.VL(bx, sy + 3, 7, K('shiro', 2)); c.VL(bx + 3, sy + 3, 7, K('garasu', -2))
            c.R(bx + 1, sy + 4, 2, 6, K(b, t)); c.HL(bx + 1, sy + 4, 2, K(b, min(t + 1, 2)))                       # 원두
            c.P(bx + 1, sy + 6, K('shiro', 2)); c.P(bx + 2, sy + 6, K('shiro', 1))                                    # 이름표 점
        c.R(2, sy + 10, W - 4, 2, K('ita', 0)); c.HL(2, sy + 10, W - 4, K('ita', 2)); c.HL(2, sy + 11, W - 4, K('ita', -2))
    c.R(0, yb + 10, W, 6, K('ita', 0)); c.HL(0, yb + 10, W, K('ita', 2)); c.HL(0, yb + 11, W, K('ita', -2))
    c.VL(0, yb + 10, 6, K('ita', 2)); c.VL(W - 1, yb + 10, 6, K('ita', -3))
    for x in (1, 17):
        c.R(x + 1, yb + 12, 12, 3, K('ita', 1)); box(c, x + 1, yb + 12, 12, 3, K('ita', -3)); c.P(x + 6, yb + 13, K('tekko', 1)); c.P(x + 7, yb + 13, K('tekko', 1))
    c.HL(0, yb + 15, W, K('ita', -3))


# ───────────────────── 초밥집 동쪽 주방 줄(바닥 1×1, up=16) ─────────────────────
def _steel_top(c, yb):
    """스테인리스 작업대 몸체(윗면 8줄 + 앞면) — 위에 올린 것은 호출한 쪽이 위 반 칸에 그린다."""
    c.R(0, yb, 16, 8, K('shiro', 1)); c.HL(0, yb, 16, K('shiro', 3)); c.HL(0, yb + 7, 16, K('conc', 1))
    c.VL(0, yb, 8, K('shiro', 2)); c.VL(15, yb, 8, K('conc', 1))
    c.R(0, yb + 8, 16, 2, K('conc', 0)); c.HL(0, yb + 9, 16, K('conc', -2))
    c.R(0, yb + 10, 16, 5, K('conc', 2)); c.VL(0, yb + 10, 5, K('conc', 3)); c.VL(15, yb + 10, 5, K('conc', 0))
    c.VL(8, yb + 10, 4, K('conc', -1)); c.VL(6, yb + 11, 2, K('tekko', -2)); c.VL(10, yb + 11, 2, K('tekko', -2))
    c.HL(0, yb + 14, 16, K('conc', 0)); c.R(0, yb + 15, 16, 1, K('tekko', -2))


@O('fd-rice-tub', '초밥 밥통', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='스테인리스 대 위에 올린 나무 밥통(하시오케)과 하얀 밥, 주걱. 초밥집 동쪽 주방 줄.', tags=('초밥', '주방'))
def _(c):
    yb = 16
    _steel_top(c, yb)
    c.R(2, 8, 12, 10, K('ita', 1)); c.VL(2, 8, 10, K('ita', 2)); c.VL(13, 8, 10, K('ita', -2)); c.HL(2, 17, 12, K('ita', -3))
    c.HL(2, 11, 12, K('ita', -2)); c.HL(2, 14, 12, K('ita', -2))
    c.R(3, 4, 10, 5, K('shiro', 2)); box(c, 3, 4, 10, 5, K('ita', -2)); c.HL(4, 5, 7, K('shiro', 3))
    for x, y in ((5, 6), (8, 7), (10, 5), (6, 8)): c.P(x, y, K('shiro', 1))
    c.R(12, 1, 3, 3, K('ita', 2)); c.HL(12, 1, 3, K('ita', 3)); c.VL(13, 3, 5, K('ita', 1))


@O('fd-grill-range', '초밥집 화구', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='스테인리스 대 위 곤로. 국냄비와 주전자. 초밥집 동쪽 주방 줄(국·계란말이).', tags=('초밥', '주방'))
def _(c):
    yb = 16
    _steel_top(c, yb)
    c.R(1, 6, 8, 9, K('tekko', 0)); box(c, 1, 6, 8, 9, K('tekko', -3)); c.VL(2, 7, 7, K('tekko', 2)); c.HL(1, 6, 8, K('tekko', 2))
    c.HL(2, 9, 6, K('tekko', -1)); c.P(0, 9, K('tekko', -2)); c.P(9, 9, K('tekko', -2))
    c.R(11, 8, 4, 7, K('tekko', 1)); c.VL(11, 8, 7, K('tekko', 3)); c.HL(11, 8, 4, K('tekko', 3)); c.P(10, 9, K('tekko', 2)); c.P(9, 8, K('tekko', 2))
    c.R(12, 6, 2, 2, K('sumi', 1)); c.HL(11, 15, 4, K('tekko', -3))
    steam(c, 4, 4, 3)
    for x in (3, 6, 10): c.R(x, yb + 11, 2, 2, K('daidai', 0)); c.P(x, yb + 11, K('daidai', 2))


@O('fd-cutting-block', '초밥 도마', w=1, h=1, up=16, kind='floor', surface=False, use=('counter',), desc='스테인리스 대 위 나무 도마에 생선 토막과 칼. 초밥집 동쪽 주방 줄.', tags=('초밥', '주방'))
def _(c):
    yb = 16
    _steel_top(c, yb)
    c.R(1, 9, 14, 8, K('ita', 2)); box(c, 1, 9, 14, 8, K('ita', -2)); c.HL(2, 10, 12, K('ita', 3))
    c.R(3, 11, 8, 3, K('shiro', 1)); c.HL(3, 11, 8, K('shiro', 3)); c.R(3, 13, 8, 1, K('pinku', 0)); c.R(11, 11, 2, 3, K('pinku', 1)); c.P(13, 12, K('aka', 0))
    c.HL(2, 7, 10, K('tekko', 3)); c.HL(2, 8, 10, K('tekko', 0)); c.R(12, 6, 3, 3, K('ita', -2)); c.HL(12, 6, 3, K('ita', 0))


@R.good('fd-coffee-cup', '커피 잔', desc='하얀 잔과 받침, 안에 갈색 커피 한 줄. 킷사텐 탁자 위.')
def _(c):
    c.R(2, 10, 12, 3, K('shiro', 2)); box(c, 2, 10, 12, 3, K('conc', 0)); c.HL(3, 10, 10, K('shiro', 3))
    c.R(4, 4, 8, 7, K('shiro', 3)); c.VL(4, 4, 7, K('shiro', 3)); c.VL(11, 4, 7, K('shiro', 0)); c.HL(4, 10, 8, K('shiro', -1)); c.HL(4, 4, 8, K('shiro', 2))
    c.R(5, 5, 6, 1, K('soil', -2)); c.P(6, 5, K('soil', 0))
    c.VL(12, 5, 3, K('shiro', 2)); c.P(13, 6, K('shiro', 2)); c.P(12, 8, K('shiro', 1))
    c.P(7, 1, K('shiro', 1)); c.P(8, 2, K('shiro', 0))


# 놓는 법(조수가 읽는 placementRules) — 가구마다 어디에·무엇 옆에.
PLACE = {
    'fd-stool': '카운터 앞(손님 쪽, 카운터 바로 남쪽 줄)에 1칸 간격 없이 한 줄로. 라멘집·이자카야·초밥집 카운터석, 초밥집은 문 곁 대기석으로도 한 줄.',
    'fd-chair-s': '탁자 북쪽 칸(남쪽 탁자를 본다).', 'fd-chair-n': '탁자 남쪽 칸(북쪽 탁자를 본다).',
    'fd-chair-e': '탁자 서쪽 칸(동쪽 탁자를 본다).', 'fd-chair-w': '탁자 동쪽 칸(서쪽 탁자를 본다).',
    'fd-prep': '주방 북쪽 벽 첫 바닥 줄 — 개수대·화구와 한 줄로 붙인다(카운터 안쪽, 손님이 못 들어오는 쪽).',
    'fd-sink': '주방 북쪽 벽 첫 바닥 줄, 조리대 옆.', 'fd-stockpot': '라멘집 주방 북쪽 벽 줄, 면 삶는 칸 옆(육수 솥).',
    'fd-noodle-boiler': '라멘집 주방 북쪽 벽 줄, 육수 솥과 조리대 사이.', 'fd-fryer': '주방 북쪽 벽 줄, 조리대 옆(튀김).',
    'fd-fridge': '주방 북쪽 벽 줄 끝(업소용 냉장고, 1×2 — 발밑 두 칸).', 'fd-sake-shelf': '이자카야·초밥집 카운터 뒤 북쪽 벽(술병 선반).',
    'fd-ticket-machine': '라멘집 입구 바로 안쪽, 문 틈 옆 바닥에 세운다(위쪽 칸에 카운터 위 그릇을 두지 않는다, 앞 칸을 비운다, 뒤에 막다른 틈을 만들지 않는다) — 손님이 들어와 먼저 식권을 산다.',
    'fd-water-jug': '카운터 끝 칸이나 입구 옆(셀프 물 서버).', 'fd-register': '출입구 가까이(나가며 계산) — 카운터 끝이나 입구 옆.',
    'fd-neta-case': '초밥집 카운터 칸 위치에 카운터 대신 한 줄로(생선 진열 케이스가 올라간 카운터 칸).',
    'fd-beer-crates': '주방·뒷문 쪽 구석(맥주 상자).', 'fd-zashiki': '이자카야 한쪽 벽 쪽 다다미 좌석 단(4×2, 방석·좌탁 없음) — 북쪽 줄 가운데 두 칸 위에 zataku 를 따로 놓는다(방석은 바닥 무늬끼리 겹쳐 단을 지우므로 단 위에 두지 않는다). 앞(남쪽)에 fd-kutsunugi.', 'fd-kutsunugi': '자시키 단 바로 남쪽 앞 바닥의 디딤돌(2×1, 신발 한 켤레 포함) — 좌탁 앞 두 칸에.',
    'fd-siphon': '킷사텐 카운터 위 한 칸(사이펀 커피) — 계산대·머신과 한 줄로 카운터 뒤.', 'fd-coffee-machine': '킷사텐 카운터 칸 하나(에스프레소 머신).',
    'fd-cake-case': '킷사텐 카운터 칸 하나, 입구에서 보이는 쪽(케이크 쇼케이스).', 'fd-bean-shelf': '킷사텐 카운터 뒤 북쪽 벽 첫 줄(원두 병 선반, 2칸).',
    'fd-noren': '주방 입구(칸막이 틈) 위 벽면에 건다.', 'fd-lantern': '이자카야·라멘집 벽면 윗줄에 건다(붉은 초롱). 킷사텐에는 걸지 않는다.',
    'fd-rice-tub': '초밥집 동쪽 벽 곁 세로 주방 줄(냉장고 아래 칸부터 아래로) — 도마·화구와 한 줄로 쌓는다.',
    'fd-grill-range': '초밥집 동쪽 벽 곁 세로 주방 줄 — 밥통·도마와 같은 열(국·계란말이).',
    'fd-cutting-block': '초밥집 동쪽 벽 곁 세로 주방 줄 끝 — 카운터 쪽을 본다(도마).',
    'fd-menu-board': '카운터 뒤·주방 위 북쪽 벽면 윗줄(메뉴판, 글자 없이 색 띠).',
}
for _id, _t in PLACE.items(): R.objs[_id]['place'] = _t


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
