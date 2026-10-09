#!/usr/bin/env python3
"""jp_city 일본 실내 — 게임 센터·파친코 `interior_amuse` (id 머리 `am-`).
  python3 scripts/content/jp-city/blocks/interior_amuse.py     # selftest + tiledata/jp-city/blocks/interior_amuse/_all-x3.png

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 윤곽 sumi, 팔레트 modern3 램프만. 글자·숫자·상표·로고·사람·캐릭터 얼굴 없음.
빛나는 화면(대전 게임·리듬 게임·레이싱·파친코 액정)은 색 덩이·줄·점 무늬로만 그린다.

크기 근거(§12-3 공식, 1칸 = 1m):
  UFO 캐처 0.9×0.9×1.9m → 1×1, F 26 + T 6 = 32 → up 16. 대형 캐처 1.8×0.9×1.9m → 2×1 up 16.
  대전 기기(캔디 캐비닛) 0.8×0.9×1.5m → 1×1, 24px → up 8(맞은편 뒷면도 up 8 — 등을 맞댄 두 줄이 뒤 의자를 반만 가린다).
  리듬 게임(북) 1.0×1.0×2.1m(화면 포함) → 1×1, up 24. 레이싱 좌석 기기 1.0×2.0×1.9m → 1×2 up 16.
  메달 푸셔 2×2×1.6m(꼭대기 장식 포함) → 2×2, 윗면(놀이판) 16 + 앞면 16 + 꼭대기 16 → up 16.
  스티커 사진 부스 2×2×2.3m → 2×2, 지붕 윗면 13 + 앞면 37 → up 24. 교환기 0.6×0.5×1.8m → wall 1×1 up 16. 경품 선반 2×0.5×1.8m → wall 2×1 up 16.
  파친코 섬: 기기 1대 + 구슬 대여기 = 폭 1m, 받침대 0.8m + 기기 0.9m + 데이터 램프 → 2m → 앞줄 up 16. 뒷면 줄은 up 8(뒤 의자가 반쯤 보이게).
  파친코 의자 0.45m → up 0. 구슬 상자 3단 0.6m → up 8. 재떨이 기둥 0.7m → up 8. 경품 카운터 1m → up 0(윗면 6 + 앞면 6, 유리 진열).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402

BLOCK = 'interior_amuse'
R = Registry(BLOCK, '오락실')
GC = ('게임 센터', 'ゲームセンター', '오락실', 'game center')
PA = ('파친코', 'パチンコ', 'pachinko')


# ── 도우미(interior_office.py 와 같은 꼴) ─────────────────────────────────────
def kc(ramp, t): return K(ramp, t)


def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def px(c, x, y, col):
    if 0 <= x < c.w and 0 <= y < c.h: c.P(x, y, col)


def rc(c, x, y, w, h, col):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(c.w, x + w), min(c.h, y + h)
    if x1 > x0 and y1 > y0: c.R(x0, y0, x1 - x0, y1 - y0, col)


def hl(c, x, y, n, col): rc(c, x, y, n, 1, col)
def vl(c, x, y, n, col): rc(c, x, y, 1, n, col)


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def ring(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 and (((x + .5 - cx) / max(.1, rx - 1)) ** 2 + ((y + .5 - cy) / max(.1, ry - 1)) ** 2) > 1: px(c, x, y, col)


def outline(c, x, y, w, h, col=None):
    col = col or OL
    hl(c, x, y, w, col); hl(c, x, y + h - 1, w, col); vl(c, x, y, h, col); vl(c, x + w - 1, y, h, col)


def bev(c, x, y, w, h, ramp, t=0, olc=None):
    """외곽선 + 면 + 왼위 밝은 변 + 오른아래 어두운 변."""
    outline(c, x, y, w, h, olc)
    ix, iy, iw, ih = x + 1, y + 1, w - 2, h - 2
    rc(c, ix, iy, iw, ih, kc(ramp, t))
    hl(c, ix, iy, iw, kc(ramp, t + 1)); vl(c, ix, iy, ih, kc(ramp, t + 1))
    hl(c, ix, iy + ih - 1, iw, kc(ramp, t - 1)); vl(c, ix + iw - 1, iy, ih, kc(ramp, t - 1))


def ol_in(c, col=None):
    """투명 이웃(캔버스 안)에 닿는 불투명 칸을 윤곽색으로 — 둥근 실루엣용."""
    col = col or OL
    a = c.a; H, W = a.shape[:2]; todo = []
    for y in range(H):
        for x in range(W):
            if a[y, x, 3] == 0: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and a[ny, nx, 3] == 0: todo.append((x, y)); break
    for x, y in todo: c.P(x, y, col)


def ball(c, cx, cy, r, ramp, t=0):
    """색 공(인형·구슬 덩이): 몸 + 아래 그늘 + 왼위 반사 점. 얼굴 없음."""
    disc(c, cx, cy, r, r, kc(ramp, t - 1))
    disc(c, cx - .5, cy - .6, r - .7, r - .8, kc(ramp, t))
    px(c, int(cx - r * .45), int(cy - r * .5), kc(ramp, t + 2))


def medals(c, x, y, w, h, seed, silver=False):
    """메달(금)·구슬(은) 더미: 2px 동전이 엇갈려 쌓인 점 무늬."""
    for j in range(h):
        for i in range(w):
            k = hs(x + i, y + j, seed) % 6
            if silver: col = (kc('shiro', 2), kc('tekko', 3), kc('shiro', 1), kc('tekko', 2), kc('shiro', 2), kc('tekko', 1))[k]
            else: col = (kc('kii', 2), kc('kii', 1), kc('kii', 0), kc('kii', 2), kc('daidai', 2), kc('kii', 1))[k]
            if (i + j) % 2 == 0 and k == 0: col = kc('shiro', 2) if not silver else kc('tekko', 0)
            px(c, x + i, y + j, col)


def glow_line(c, pts, ramp):
    """네온관: 1px 심(밝은 단) + 상하좌우 1px 번짐(가운데 단). 반투명이 아니라 같은 램프 불투명 단."""
    core = set(pts)
    for (x, y) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in core: px(c, x + dx, y + dy, kc(ramp, -1))
    for (x, y) in pts: px(c, x, y, kc(ramp, 1))


def line_pts(x0, y0, x1, y1):
    pts = []; n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1): pts.append((round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)))
    return pts


# ══ 바닥 ═══════════════════════════════════════════════════════════════════
@R.floor('am-carpet', '게임 센터 카펫', cols=4, rows=4, tags=GC + ('카펫',),
         desc='짙은 남색 짧은 털 카펫. 바탕은 두 톤 결뿐이고 64px 주기에 작은 네온 무늬 조각(고리·번개·별·물결)이 드문드문 박혀 있다(청록·분홍·보라 낮은 단). 게임 센터 매장 전체.')
def _carpet(c):
    W, H = c.w, c.h
    base, lo, hi = kc('kon', -2), kc('sumi', 1), kc('kon', -1)
    for y in range(H):
        for x in range(W):
            col = base
            if (x + 2 * y) % 5 == 0 and rnd(x // 2, y, 3, 380): col = hi                    # 짧은 털 결(성김)
            elif rnd(x, y, 4, 40): col = lo
            c.P(x, y, col)
    # 무늬 조각 — 주기 안 좌표(감싸기)로 찍어 이음매가 없다. 칸마다 같은 자리에 오지 않게 주기 안 8곳.
    # 밝은 네온 무늬는 주기(64px)에 둘만, 나머지는 바탕보다 한두 단 밝은 보라·남색(가까이 봐야 보이는 결).
    motifs = [((5, 6), 'ring', 'neonC'), ((25, 3), 'bolt', 'kon'), ((44, 10), 'star', 'murasaki'), ((58, 27), 'wave', 'kon'),
              ((12, 31), 'star', 'kon'), ((33, 22), 'ring', 'murasaki'), ((6, 50), 'wave', 'murasaki'), ((38, 45), 'bolt', 'neonP'),
              ((54, 56), 'ring', 'kon'), ((22, 58), 'star', 'murasaki')]
    shapes = {'ring': [(1, 0), (2, 0), (0, 1), (3, 1), (0, 2), (3, 2), (1, 3), (2, 3)],
              'bolt': [(2, 0), (1, 1), (0, 2), (1, 2), (2, 2), (1, 3), (0, 4)],
              'star': [(2, 0), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (2, 1), (2, 3), (1, 4), (3, 4)],
              'wave': [(0, 1), (1, 0), (2, 1), (3, 2), (4, 1), (5, 0)]}
    for (mx, my), sh, ramp in motifs:
        for (dx, dy) in shapes[sh]:
            col = {'kon': kc('kon', 0), 'murasaki': kc('murasaki', -1)}.get(ramp) or kc(ramp, -1)
            c.P((mx + dx) % W, (my + dy) % H, col)


@R.floor('am-pachinko-carpet', '파친코 붉은 카펫', cols=4, rows=4, tags=PA + ('카펫',),
         desc='팥빛 붉은 카펫에 어두운 마름모 격자(16px)와 격자 매듭마다 작은 금빛 점. 4톤 저대비. 파친코 홀 바닥.')
def _pcarpet(c):
    W, H = c.w, c.h
    for y in range(H):
        for x in range(W):
            col = kc('aka', -1)
            u, v = (x + y) % 16, (x - y) % 16
            if u == 0 or v == 0: col = kc('aka', -2)                                   # 마름모 격자
            elif u == 8 and v == 8: col = kc('kii', -1)                                # 마름모 가운데 금 점
            elif (u in (7, 9) and v == 8) or (v in (7, 9) and u == 8): col = kc('kawara', -1)
            elif rnd(x, y, 9, 18): col = kc('aka', 0) if rnd(x, y, 10, 500) else kc('kawara', -1)
            c.P(x, y, col)


# ══ 벽면(2줄 = 32px) ═══════════════════════════════════════════════════════
@R.wall('am-wall', '게임 센터 검은 벽(네온 띠)', cols=4, tags=GC + ('벽',),
        desc='검정에 가까운 짙은 남색 벽면. 윗줄에 분홍 네온관 한 줄, 아랫줄에 청록 네온관 한 줄이 가로로 흐르고, 맨 아래 철제 걸레받이.')
def _wall(c):
    W = c.w
    for y in range(32):
        for x in range(W):
            col = kc('sumi', 0) if y < 16 else kc('kon', -2)
            if x % 32 == 0: col = kc('sumi', -1)                                       # 패널 이음
            elif x % 32 == 1: col = kc('kon', -1) if y >= 16 else kc('sumi', 1)
            elif y >= 16 and (x + y) % 4 == 0 and rnd(x, y, 21, 300): col = kc('sumi', 1)
            c.P(x, y, col)
    glow_line(c, [(x, 10) for x in range(W)], 'neonP')
    glow_line(c, [(x, 21) for x in range(W)], 'neonC')
    hl(c, 0, 27, W, kc('tekko', 1)); rc(c, 0, 28, W, 3, kc('tekko', -1)); hl(c, 0, 31, W, kc('sumi', -1))


@R.wall('am-mirror-wall', '파친코 거울 벽', cols=4, tags=PA + ('벽', '거울'),
        desc='금빛 테로 나뉜 거울 판(푸른 회색에 사선 반사 줄)이 이어지고, 아래는 짙은 붉은 허리 판과 금 몰딩·걸레받이. 파친코 홀 벽면.')
def _mirror(c):
    W = c.w
    for y in range(32):
        for x in range(W):
            lx = x % 16
            if y < 21:
                col = kc('garasu', 1) if y < 10 else kc('garasu', 0)
                d = (lx + y) % 16
                if d in (3, 4) and 2 < y < 19: col = kc('garasu', 3)                    # 사선 반사
                elif d == 9 and 2 < y < 19 and (y % 3): col = kc('garasu', 2)
                if lx == 0: col = kc('kii', -1)
                elif lx == 1: col = kc('kii', 1)
                elif lx == 15: col = kc('kii', -2)
            else:
                col = kc('aka', -2) if y > 22 else kc('kii', 1 if y == 21 else -1)
                if y > 22 and lx in (0, 8): col = kc('aka', -1) if lx == 0 else kc('kawara', -2)
            c.P(x, y, col)
    for (x, y, rp) in ((6, 6, 'neonP'), (7, 6, 'neonP'), (21, 13, 'kii'), (40, 8, 'neonC'), (41, 8, 'neonC'), (55, 15, 'kii'), (12, 16, 'kii'), (34, 17, 'neonP')):
        px(c, x, y, kc(rp, 1) if rp in ('neonP', 'neonC') else kc(rp, 2))                                     # 비친 램프 빛
    hl(c, 0, 0, W, kc('kii', -1)); hl(c, 0, 1, W, kc('kii', 1))
    hl(c, 0, 27, W, kc('kii', 0)); rc(c, 0, 28, W, 3, kc('ita', -2)); hl(c, 0, 31, W, kc('sumi', -1))


# ══ 게임 센터 ═══════════════════════════════════════════════════════════════
def _crane(c, W, ramp, prizes, sign):
    """UFO 캐처: 꼭대기 빛 간판 상자(윗면 3 + 앞 4) · 유리 상자(집게·경품) · 조작 받침(윗면) · 아랫단(경품 출구·동전 투입구)."""
    # 꼭대기 상자
    rc(c, 1, 1, W - 2, 3, kc('shiro', 1)); hl(c, 1, 1, W - 2, kc('shiro', 2)); hl(c, 1, 3, W - 2, kc('shiro', 2))   # 윗면 + 앞 가장자리
    rc(c, 1, 4, W - 2, 4, kc(sign, 0)); hl(c, 1, 4, W - 2, kc(sign, 1))
    for x in range(2, W - 2, 3): px(c, x + (1 if (x // 3) % 2 else 0), 6, kc('kii', 2) if (x // 3) % 2 else kc('shiro', 2))   # 전구 점
    hl(c, 1, 8, W - 2, kc(ramp, -2))                                                                   # 간판 밑 그늘
    # 기둥
    vl(c, 1, 8, 16, kc(ramp, 1)); vl(c, W - 2, 8, 16, kc(ramp, -1))
    # 유리 속
    rc(c, 2, 9, W - 4, 12, kc('garasu', -2)); hl(c, 2, 9, W - 4, kc('garasu', -1))
    hl(c, 2, 20, W - 4, kc('garasu', -1))                                                              # 경품 받침판
    prizes(c)
    cx = W // 2 - 1                                                                                    # 집게
    vl(c, cx, 9, 3, kc('tekko', 2)); vl(c, cx + 1, 9, 3, kc('tekko', 0))
    rc(c, cx - 1, 12, 4, 1, kc('tekko', 3)); px(c, cx - 2, 13, kc('tekko', 2)); px(c, cx + 3, 13, kc('tekko', 1)); px(c, cx - 2, 14, kc('tekko', 1)); px(c, cx + 3, 14, kc('tekko', 0))
    for i in range(3): px(c, 3 + i, 11 - i, kc('garasu', 3))                                           # 유리 반사 사선
    vl(c, W - 4, 11, 4, kc('garasu', 1))
    # 조작 받침: 윗면(밝게) + 앞 가장자리 + 그늘
    rc(c, 1, 21, W - 2, 3, kc('shiro', 1)); hl(c, 1, 21, W - 2, kc('shiro', 2)); hl(c, 1, 23, W - 2, kc('shiro', 2))
    disc(c, 4.5, 21.8, 1.3, 1.1, kc('aka', 1)); px(c, 4, 21, kc('aka', 2))                            # 레버 공
    px(c, 7, 22, kc('kii', 2)); px(c, 9, 22, kc('sora', 2))                                           # 단추
    hl(c, 1, 24, W - 2, kc(ramp, -2))
    # 아랫단
    rc(c, 1, 25, W - 2, 5, kc(ramp, 0)); vl(c, 1, 25, 5, kc(ramp, 1)); vl(c, W - 2, 25, 5, kc(ramp, -2))
    rc(c, 2, 25, 5, 4, kc('yoru', -2)); hl(c, 2, 25, 5, kc('tekko', 2)); vl(c, 2, 25, 4, kc('tekko', 1)); hl(c, 3, 28, 3, kc('shiro', 0))   # 경품 출구(덮개)
    rc(c, W - 5, 26, 2, 2, kc('tekko', 1)); px(c, W - 5, 26, kc('kii', 2))                             # 동전 투입구
    hl(c, 1, 30, W - 2, kc('yoru', 0))
    outline(c, 0, 0, W, 32)


def _crane_prizes(c):
    for (x, y, r, rp) in ((4, 18, 1.8, 'aka'), (7, 18.5, 1.6, 'kii'), (10.5, 18, 1.8, 'sora'), (5.5, 16, 1.5, 'midori'), (9, 16, 1.5, 'pinku'), (12, 16.5, 1.3, 'kii')):
        ball(c, x, y, r, rp, 1)


@R.obj('am-crane', 'UFO 캐처', w=1, h=1, up=16, kind='floor', use=('search',), tags=GC + ('UFO 캐처', 'クレーンゲーム', '인형 뽑기'),
       place='입구 쪽 손님 통로를 보고 가로로 이어 붙여 한 줄(3~6대). 앞(남쪽)에 손님 통로 2줄.', pair=('am-crane-big', 'am-prize-shelf'),
       desc='분홍 테의 UFO 캐처 한 대 — 꼭대기 빛 간판 상자(전구 점, 글자 없음), 유리 상자 안에 은빛 집게와 색 공 모양 경품 더미, 앞 조작 받침에 빨간 레버와 단추, 아랫단 왼쪽 경품 출구·오른쪽 동전 투입구. 옆으로 이어 붙여 줄을 만든다.')
def _crane1(c): _crane(c, 16, 'pinku', _crane_prizes, 'neonP')


def _big_prizes(c):
    for (x, y, w, h, rp) in ((3, 15, 6, 5, 'sora'), (21, 16, 7, 4, 'midori')):                       # 경품 상자
        rc(c, x, y, w, 2, kc(rp, 2)); rc(c, x, y + 2, w, h - 2, kc(rp, 0)); vl(c, x + w // 2, y, h, kc('kii', 2)); outline(c, x - 1, y - 1, w + 2, h + 1, kc(rp, -2))
    ball(c, 14.5, 16.5, 3.5, 'pinku', 1); ball(c, 10.5, 18, 2, 'kii', 1); ball(c, 18.5, 18.2, 1.8, 'aka', 1); ball(c, 27, 18.4, 1.6, 'kii', 1)


@R.obj('am-crane-big', '대형 UFO 캐처', w=2, h=1, up=16, kind='floor', use=('search',), tags=GC + ('UFO 캐처', 'クレーンゲーム', '인형 뽑기'),
       place='UFO 캐처 줄 끝이나 벽 앞. 앞(남쪽)에 손님 자리 2줄.', pair=('am-crane',),
       desc='하늘색 테의 폭 2칸 대형 UFO 캐처 — 꼭대기 빛 간판, 넓은 유리 상자 안에 큰 색 공 인형과 리본 두른 경품 상자, 가운데 큰 집게, 앞 조작 받침, 아랫단 경품 출구.')
def _crane2(c): _crane(c, 32, 'sora', _big_prizes, 'neonC')


@R.obj('am-arcade-n', '대전 게임 기기(화면 쪽)', w=1, h=1, up=8, kind='floor', use=('search',), facing='N', tags=GC + ('비디오 게임', '대전', 'アーケード'),
       place='대전 기기 줄의 남쪽 줄. 바로 북쪽에 맞은편 기기 뒷면(am-arcade-back)을 등 맞대어 놓고, 남쪽에 의자(am-arcade-stool).', pair=('am-arcade-back', 'am-arcade-stool'),
       desc='흰 캔디 캐비닛 대전 기기 — 손님이 남쪽에 앉아 북쪽을 본다(화면이 남쪽으로 보인다). 꼭대기 빛 띠, 화면에는 위 생명 막대 둘과 색 덩이 둘(글자·캐릭터 없음), 비스듬한 조작판 윗면에 빨간 레버와 색 단추 셋, 아래 동전 문.')
def _arcade_n(c):
    rc(c, 1, 9, 14, 3, kc('shiro', 1)); hl(c, 1, 9, 14, kc('shiro', 2)); hl(c, 1, 11, 14, kc('shiro', 2))          # 윗면
    rc(c, 1, 12, 14, 3, kc('sora', 1)); hl(c, 1, 12, 14, kc('sora', 2)); hl(c, 3, 13, 10, kc('neonC', 1)); hl(c, 1, 14, 14, kc('sora', -1))   # 빛 띠
    rc(c, 1, 15, 14, 8, kc('yoru', -2))                                                                            # 화면 테
    rc(c, 2, 16, 12, 6, kc('sora', 1)); rc(c, 2, 19, 12, 1, kc('kon', 1)); rc(c, 2, 20, 12, 2, kc('midori', 0)); hl(c, 2, 20, 12, kc('midori', 1))
    hl(c, 3, 16, 4, kc('kii', 2)); hl(c, 9, 16, 4, kc('aka', 2))                                                  # 생명 막대
    rc(c, 4, 18, 2, 2, kc('sora', 3)); px(c, 4, 18, kc('shiro', 2)); rc(c, 10, 17, 2, 3, kc('aka', 1)); px(c, 10, 17, kc('aka', 2))   # 색 덩이
    px(c, 7, 18, kc('kii', 2)); px(c, 8, 17, kc('shiro', 2))                                                      # 불꽃
    rc(c, 1, 23, 14, 3, kc('conc', 3)); hl(c, 1, 23, 14, kc('shiro', 1)); hl(c, 1, 25, 14, kc('shiro', 2))         # 조작판 윗면
    disc(c, 4, 23.6, 1.2, 1, kc('aka', 1)); px(c, 3, 23, kc('aka', 2))
    px(c, 8, 24, kc('kii', 2)); px(c, 10, 24, kc('sora', 2)); px(c, 12, 24, kc('aka', 2))
    hl(c, 1, 26, 14, kc('conc', -1))
    rc(c, 1, 27, 14, 4, kc('shiro', 0)); vl(c, 1, 27, 4, kc('shiro', 1)); vl(c, 14, 27, 4, kc('conc', 1))           # 아랫단
    rc(c, 5, 27, 6, 3, kc('tekko', 0)); px(c, 6, 28, kc('kii', 2)); px(c, 9, 28, kc('aka', 2)); hl(c, 5, 27, 6, kc('tekko', 2))   # 동전 문
    hl(c, 1, 30, 14, kc('yoru', 0))
    outline(c, 0, 8, 16, 24)


@R.obj('am-arcade-back', '대전 게임 기기(뒷면)', w=1, h=1, up=8, kind='floor', use=('block',), facing='S', tags=GC + ('비디오 게임', '대전', 'アーケード'),
       place='대전 기기 줄의 북쪽 줄 — am-arcade-n 바로 북쪽에 등을 맞댄다. 이 기기의 손님은 북쪽 의자(am-arcade-stool)에 앉아 남쪽을 본다.', pair=('am-arcade-n', 'am-arcade-stool'),
       desc='맞은편 대전 기기의 뒷면 — 같은 흰 윗면, 간판 뒤로 새는 청록 빛 한 줄, 화면 뒤 불룩한 덮개의 환기 틈, 나사 박힌 뒤판. 화면은 북쪽이라 안 보인다.')
def _arcade_back(c):
    rc(c, 1, 9, 14, 3, kc('shiro', 1)); hl(c, 1, 9, 14, kc('shiro', 2)); hl(c, 1, 11, 14, kc('shiro', 2))
    hl(c, 1, 12, 14, kc('neonC', 0)); rc(c, 1, 13, 14, 2, kc('conc', 1)); hl(c, 1, 14, 14, kc('conc', -1))          # 간판 뒤 빛 샘
    rc(c, 1, 15, 14, 16, kc('conc', 2)); vl(c, 1, 15, 16, kc('conc', 3)); vl(c, 14, 15, 16, kc('conc', 0))
    rc(c, 3, 16, 10, 7, kc('conc', 3)); hl(c, 3, 16, 10, kc('shiro', 0)); outline(c, 2, 15, 12, 9, kc('conc', 0))   # 화면 뒤 덮개
    for y in (18, 20): hl(c, 5, y, 6, kc('yoru', 0)); hl(c, 5, y + 1, 6, kc('conc', 4))                         # 환기 틈
    outline(c, 3, 25, 10, 5, kc('conc', 0)); px(c, 4, 26, kc('tekko', 3)); px(c, 11, 26, kc('tekko', 3)); px(c, 4, 28, kc('tekko', 3)); px(c, 11, 28, kc('tekko', 3))
    hl(c, 1, 30, 14, kc('yoru', 0))
    outline(c, 0, 8, 16, 24)


def _stool(c, ramp, rail=False):
    disc(c, 8, 6.5, 5.5, 3.3, kc(ramp, -1)); disc(c, 7.6, 6.0, 4.6, 2.5, kc(ramp, 0))
    for (x, y) in ((4, 5), (5, 4), (6, 4), (7, 4)): px(c, x, y, kc(ramp, 2))                                    # 방석 반사
    rc(c, 3, 8, 10, 2, kc(ramp, -1)); hl(c, 3, 9, 10, kc(ramp, -2))                                              # 방석 옆
    rc(c, 7, 10, 2, 4, kc('tekko', 1)); vl(c, 7, 10, 4, kc('tekko', 3)); vl(c, 8, 10, 4, kc('tekko', -1))       # 기둥
    if rail:
        rc(c, 1, 13, 14, 2, kc('tekko', 0)); hl(c, 1, 13, 14, kc('tekko', 2))                                    # 바닥 고정 레일
    else:
        disc(c, 8, 14, 4.5, 1.4, kc('tekko', -1)); hl(c, 5, 13, 5, kc('tekko', 1))
    ol_in(c)


@R.obj('am-arcade-stool', '게임 의자(둥근 스툴)', w=1, h=1, up=0, kind='floor', use=('sit',), tags=GC + ('의자', '스툴'),
       place='대전 기기·메달 푸셔 앞. 기기 줄 남쪽(화면 쪽)과 등 맞댄 뒷줄의 북쪽에 한 대씩, 메달 푸셔는 둘레 세 면에.', pair=('am-arcade-n', 'am-medal-pusher'),
       desc='빨간 비닐 방석의 둥근 스툴 — 등받이가 없어 어느 쪽에서나 앉는다. 크롬 기둥과 둥근 받침.')
def _astool(c): _stool(c, 'aka')


@R.obj('am-rhythm', '리듬 게임(북)', w=1, h=1, up=24, kind='floor', use=('search',), tags=GC + ('리듬 게임', '音ゲー', '북'),
       place='벽 앞이나 기기 줄 끝(키가 크다 — 북쪽 벽 앞 첫 바닥 줄이 좋다). 앞(남쪽)에 서서 친다. 2대를 나란히.', pair=('am-racing',),
       desc='높은 화면 아래 큰 북이 놓인 리듬 게임 — 화면에는 회색 길 위로 흘러오는 빨강·파랑 동그라미와 왼쪽 판정 고리(글자 없음), 북은 크림색 가죽 윗면과 금 징을 박은 붉은 몸통, 아래 받침.')
def _rhythm(c):
    rc(c, 1, 9, 14, 3, kc('kon', 1)); hl(c, 1, 9, 14, kc('kon', 2)); hl(c, 1, 11, 14, kc('kon', 2))              # 윗면
    rc(c, 1, 12, 14, 3, kc('kii', 1)); hl(c, 1, 12, 14, kc('kii', 2))
    for x in (3, 7, 11): px(c, x, 13, kc('aka', 1)); px(c, x + 1, 13, kc('daidai', 2))
    hl(c, 1, 14, 14, kc('kii', -2))
    rc(c, 1, 15, 14, 13, kc('kon', -2))                                                                           # 화면 테
    rc(c, 2, 16, 12, 11, kc('sora', 2)); rc(c, 2, 16, 12, 2, kc('kon', 2))
    rc(c, 2, 20, 12, 4, kc('yoru', 2)); hl(c, 2, 20, 12, kc('yoru', 3)); hl(c, 2, 23, 12, kc('yoru', 0))            # 길
    ring(c, 4, 21.9, 2, 2, kc('shiro', 2))
    disc(c, 7.5, 22, 1.4, 1.4, kc('aka', 1)); disc(c, 10.5, 22, 1.4, 1.4, kc('sora', 0)); disc(c, 13, 22, 1.2, 1.2, kc('aka', 1))
    for x in range(2, 14, 2): px(c, x, 25, kc('pinku', 2)); px(c, x + 1, 26, kc('pinku', 1))
    rc(c, 1, 28, 14, 4, kc('kon', 0)); hl(c, 1, 28, 14, kc('kon', 1))                                             # 스피커 판
    disc(c, 4, 30, 1.5, 1.5, kc('yoru', -2)); disc(c, 12, 30, 1.5, 1.5, kc('yoru', -2)); px(c, 3, 29, kc('tekko', 1)); px(c, 11, 29, kc('tekko', 1))
    # 북(가죽이 남쪽 손님을 본다): 받침 다리 → 몸통 윗면 호 → 둥근 가죽 얼굴(붉은 테·금 징)
    rc(c, 3, 43, 2, 4, kc('yoru', 0)); rc(c, 11, 43, 2, 4, kc('yoru', -1)); hl(c, 2, 46, 12, kc('yoru', 1))   # 받침
    disc(c, 8, 33.5, 6.4, 2.2, kc('aka', 1)); disc(c, 7.6, 33.2, 4.8, 1.3, kc('aka', 2))                     # 몸통 윗면(통 위 호)
    disc(c, 8, 38.5, 6.8, 6, kc('aka', -1)); disc(c, 7.8, 38.3, 5.9, 5.1, kc('aka', 0))                     # 테
    disc(c, 8, 38.5, 4.6, 4, kc('kinari', 1)); disc(c, 7.3, 37.6, 3, 2.4, kc('kinari', 2))                   # 가죽
    px(c, 6, 36, kc('shiro', 2)); px(c, 10, 41, kc('kinari', 0)); px(c, 11, 40, kc('kinari', 0))
    import math
    for i in range(10):                                                                                          # 금 징
        a = i * math.pi / 5 + .3
        px(c, round(8 + math.cos(a) * 5.7 - .5), round(38.5 + math.sin(a) * 5.0 - .5), kc('kii', 2) if math.sin(a) < 0 else kc('kii', 0))
    for (x0, t) in ((13, 2), (14, 0)):                                                                            # 북채(오른쪽 걸이)
        vl(c, x0, 30, 7, kc('ita', t)); px(c, x0, 30, kc('ita', 3))
    ol_in(c)


@R.obj('am-racing', '레이싱 게임 좌석', w=1, h=2, up=16, kind='floor', use=('sit',), facing='N', tags=GC + ('레이싱', 'レースゲーム', '드라이브'),
       place='기기 줄 끝·벽 쪽에 세로로(북쪽이 화면, 남쪽이 좌석). 2대를 나란히 붙여 대전.', pair=('am-rhythm',),
       desc='세로 2칸 레이싱 게임 — 북쪽 화면에 하늘과 가운데 흰 점선의 회색 길(글자 없음), 그 아래 계기판과 검은 운전대, 남쪽 칸에 뒤에서 본 빨간 버킷 좌석과 낮은 받침대.')
def _racing(c):
    rc(c, 1, 1, 14, 3, kc('yoru', 2)); hl(c, 1, 1, 14, kc('yoru', 3)); hl(c, 1, 3, 14, kc('yoru', 3))              # 윗면
    rc(c, 1, 4, 14, 2, kc('aka', 1)); hl(c, 1, 4, 14, kc('aka', 2)); hl(c, 4, 5, 8, kc('kii', 2))
    rc(c, 1, 6, 14, 12, kc('yoru', -2))
    rc(c, 2, 7, 12, 4, kc('sora', 2)); px(c, 4, 8, kc('shiro', 2)); px(c, 5, 8, kc('shiro', 2)); px(c, 11, 9, kc('shiro', 1))
    rc(c, 2, 11, 12, 6, kc('midori', 0)); hl(c, 2, 11, 12, kc('midori', 1))
    for i, y in enumerate(range(11, 17)):                                                                        # 길(원근)
        hw = 1 + i
        rc(c, 8 - hw, y, hw * 2, 1, kc('yoru', 1)); px(c, 8 - hw, y, kc('shiro', 1)); px(c, 7 + hw, y, kc('shiro', 1))
        if y % 2: rc(c, 7, y, 2, 1, kc('shiro', 2))
    rc(c, 1, 18, 14, 9, kc('yoru', 0)); hl(c, 1, 18, 14, kc('yoru', 2)); hl(c, 1, 19, 14, kc('yoru', 1))           # 계기판
    px(c, 3, 20, kc('neonC', 1)); px(c, 12, 20, kc('kii', 2))
    ring(c, 8, 23.5, 4.2, 3.3, kc('yoru', -2)); hl(c, 5, 20, 6, kc('tekko', 2)); rc(c, 7, 23, 2, 2, kc('tekko', 1))   # 운전대
    rc(c, 0, 27, 16, 2, kc('yoru', -1))
    # 버킷 좌석(뒤에서 본 모습): 머리받침 → 둥근 어깨의 등판 껍데기 → 양옆 날개 → 등판 가운데 검은 판과 바느질
    rc(c, 5, 26, 6, 4, kc('aka', 0)); hl(c, 6, 26, 4, kc('aka', 2)); vl(c, 5, 27, 3, kc('aka', 1)); vl(c, 10, 27, 3, kc('aka', -2))
    rc(c, 6, 30, 4, 1, kc('yoru', -1))                                                                            # 머리받침 목
    rc(c, 3, 31, 10, 11, kc('aka', -1)); rc(c, 4, 31, 8, 1, kc('aka', 1))
    for (x, y) in ((3, 31), (12, 31)): px(c, x, y, None)
    vl(c, 3, 32, 9, kc('aka', 1)); vl(c, 12, 32, 9, kc('aka', -2))
    rc(c, 2, 34, 1, 7, kc('aka', 0)); rc(c, 13, 34, 1, 7, kc('aka', -2))                                          # 날개
    rc(c, 6, 32, 4, 9, kc('yoru', -1)); vl(c, 6, 32, 9, kc('yoru', 1))
    for y in range(33, 41, 2): px(c, 8, y, kc('yoru', 2))                                                         # 바느질
    hl(c, 3, 41, 10, kc('aka', -2))
    rc(c, 0, 42, 16, 4, kc('yoru', 1)); hl(c, 0, 42, 16, kc('yoru', 3)); hl(c, 0, 45, 16, kc('yoru', -1))           # 받침대
    ol_in(c); outline(c, 0, 0, 16, 26)


@R.obj('am-medal-pusher', '메달 푸셔', w=2, h=2, up=16, kind='floor', use=('search',), tags=GC + ('메달 게임', 'メダルゲーム', '메달'),
       place='메달 코너 — 북쪽 벽 앞 첫 두 바닥 줄에 붙이면(꼭대기가 벽면을 덮는다) 서·동은 아랫줄 옆에 한 대씩, 남쪽은 두 대 의자(am-arcade-stool). 가운데 둘 때는 북쪽 두 줄을 통로로 비운다(윗부분이 바로 북쪽 칸을 덮는다).', pair=('am-arcade-stool', 'am-exchange', 'am-medal-cup'),
       desc='2×2 메달 푸셔 — 뒤쪽 가운데 금빛 원판(색 칸으로 나뉜 룰렛)이 박힌 꼭대기 장식 탑, 위에서 보이는 유리 놀이판에 금 메달이 빽빽이 깔리고 흰 밀판이 가로지른다, 놀이판 둘레 청록 전구 점, 앞면에 은빛 메달 받침 둘과 빛 띠.')
def _pusher(c):
    W = 32
    # 놀이판(윗면 16)
    rc(c, 1, 13, 30, 17, kc('kon', 1)); hl(c, 1, 13, 30, kc('kon', 2))
    for x in range(2, 30, 3): px(c, x, 14, kc('neonC', 1)); px(c, x + 1, 28, kc('neonC', 1))
    rc(c, 3, 15, 26, 12, kc('sora', -1))
    rc(c, 3, 15, 26, 3, kc('shiro', 1)); hl(c, 3, 17, 26, kc('shiro', -1)); hl(c, 3, 15, 26, kc('shiro', 2))     # 밀판
    medals(c, 4, 15, 24, 2, 3)
    medals(c, 3, 19, 26, 8, 5)
    for (x, y) in ((6, 21), (16, 24), (24, 20)): px(c, x, y, kc('shiro', 2))
    for i in range(4): px(c, 22 + i, 25 - i, kc('garasu', 3))                                                   # 유리 반사
    hl(c, 1, 29, 30, kc('kon', 3))                                                                              # 앞 가장자리
    # 꼭대기 탑(뒤쪽 가운데)
    rc(c, 9, 1, 14, 12, kc('murasaki', 0)); hl(c, 9, 1, 14, kc('murasaki', 2)); vl(c, 9, 1, 12, kc('murasaki', 1)); vl(c, 22, 1, 12, kc('murasaki', -2))
    for i, rp in enumerate(('aka', 'kii', 'sora', 'midori', 'pinku', 'kii', 'aka', 'sora')):
        import math
        a = i * math.pi / 4
        for rr in (2, 3, 4):
            px(c, int(16 + math.cos(a) * rr), int(7 + math.sin(a) * rr * .8), kc(rp, 1))
    disc(c, 16, 7, 1.4, 1.2, kc('kii', 2))
    for x in range(10, 22, 2): px(c, x, 2, kc('kii', 2) if x % 4 else kc('neonP', 1)); px(c, x + 1, 12, kc('neonP', 1) if x % 4 else kc('kii', 2))
    outline(c, 8, 0, 16, 14)
    # 앞면(16)
    hl(c, 1, 30, 30, kc('kon', -2))
    rc(c, 1, 31, 30, 14, kc('kon', 0)); vl(c, 1, 31, 14, kc('kon', 1)); vl(c, 30, 31, 14, kc('kon', -2))
    for x0 in (4, 18):                                                                                          # 메달 받침
        rc(c, x0, 33, 10, 5, kc('tekko', 2)); hl(c, x0, 33, 10, kc('tekko', 3)); rc(c, x0 + 1, 34, 8, 3, kc('tekko', 0))
        medals(c, x0 + 1, 35, 8, 2, x0)
        hl(c, x0, 38, 10, kc('tekko', -1))
    for x in range(3, 30, 2): px(c, x, 41, kc('neonC', 1) if x % 4 == 1 else kc('neonP', 0))
    rc(c, 1, 43, 30, 3, kc('yoru', 0)); hl(c, 1, 43, 30, kc('yoru', 2))
    outline(c, 0, 12, W, 35)
    c.P(0, 12, None); c.P(W - 1, 12, None)


@R.obj('am-photo-booth', '스티커 사진 부스', w=2, h=2, up=24, kind='floor', use=('search',), tags=GC + ('스티커 사진', 'プリクラ', '사진'),
       place='메달 코너·벽 앞(키가 크다 — 북쪽 벽 앞 첫 두 바닥 줄). 커튼 쪽(동쪽 반)이 남쪽 통로를 보게. 두 대를 나란히 두면 부스 거리.', pair=('am-exchange',),
       desc='2×2 스티커 사진 부스 — 위에서 보이는 흰 지붕(환기 상자), 앞면 위 빛 띠, 왼쪽 반은 분홍 판에 큰 노란 별과 반짝이·물결 무늬(사람·글자 없음)와 작은 동전 상자, 오른쪽 반은 주름진 분홍 커튼 입구와 그 밑 어두운 안쪽.')
def _booth(c):
    W = 32
    rc(c, 1, 9, 30, 12, kc('shiro', 1)); hl(c, 1, 9, 30, kc('shiro', 2)); vl(c, 1, 9, 12, kc('shiro', 2))        # 지붕 윗면
    for y in (12, 16): hl(c, 2, y, 28, kc('shiro', 0))
    rc(c, 18, 11, 9, 5, kc('conc', 2)); hl(c, 18, 11, 9, kc('conc', 4)); hl(c, 19, 13, 7, kc('yoru', 0)); hl(c, 18, 16, 9, kc('conc', -1))   # 환기 상자 + 그림자
    hl(c, 1, 20, 30, kc('shiro', 2)); hl(c, 1, 21, 30, kc('conc', 0))                                           # 앞 가장자리 + 처마 그늘
    rc(c, 1, 22, 30, 3, kc('shiro', 2)); hl(c, 1, 24, 30, kc('shiro', 0))                                      # 빛 띠
    for x in range(3, 30, 4): px(c, x, 23, kc('kii', 2))
    # 왼쪽 판
    rc(c, 1, 25, 16, 34, kc('pinku', 1)); vl(c, 1, 25, 34, kc('pinku', 2))
    st = [(8, 28), (7, 31), (8, 31), (9, 31), (4, 33), (5, 33), (6, 33), (7, 33), (8, 33), (9, 33), (10, 33), (11, 33), (12, 33),
          (6, 34), (7, 34), (8, 34), (9, 34), (10, 34), (6, 35), (7, 35), (8, 35), (9, 35), (10, 35), (5, 36), (6, 36), (10, 36), (11, 36), (4, 37), (12, 37),
          (7, 29), (8, 29), (9, 29), (7, 30), (8, 30), (9, 30), (6, 32), (7, 32), (8, 32), (9, 32), (10, 32), (5, 37), (11, 37)]
    for (x, y) in st: px(c, x, y, kc('kii', 2))
    for (x, y) in ((8, 28), (7, 30), (6, 32), (5, 33), (4, 37)): px(c, x, y, kc('shiro', 2))
    for (x, y) in st:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in st and 2 <= x + dx <= 15: px(c, x + dx, y + dy, kc('daidai', 1))
    for (x, y) in ((3, 27), (13, 28), (14, 35), (3, 40)): px(c, x, y, kc('shiro', 2)); px(c, x + 1, y, kc('pinku', 2)); px(c, x - 1, y, kc('pinku', 2)); px(c, x, y - 1, kc('pinku', 2)); px(c, x, y + 1, kc('pinku', 2))
    for y in (43, 46):
        for x in range(2, 16): px(c, x, y + (1 if (x // 2) % 2 else 0), kc('murasaki', 2))
    rc(c, 3, 50, 7, 7, kc('shiro', 0)); hl(c, 3, 50, 7, kc('shiro', 2)); rc(c, 4, 51, 5, 2, kc('sora', 2)); px(c, 7, 54, kc('tekko', 0)); px(c, 8, 54, kc('kii', 2))
    outline(c, 2, 49, 9, 9, kc('pinku', -2))
    vl(c, 16, 25, 34, kc('pinku', -1))
    # 오른쪽 커튼 입구
    rc(c, 17, 25, 14, 34, kc('shiro', 0)); vl(c, 17, 25, 34, kc('shiro', 1)); vl(c, 30, 25, 34, kc('conc', 1))
    rc(c, 18, 26, 12, 23, kc('pinku', 0))
    for x in range(18, 30):
        col = (kc('pinku', 1), kc('pinku', 0), kc('pinku', -1))[(x - 18) % 3]
        vl(c, x, 26, 22 + (x % 2), col)
    hl(c, 18, 26, 12, kc('tekko', 2))                                                                           # 커튼 봉
    rc(c, 18, 49, 12, 9, kc('yoru', -2)); hl(c, 18, 49, 12, kc('pinku', -2))                                     # 안쪽 어둠
    rc(c, 18, 56, 12, 2, kc('yoru', 0))
    rc(c, 1, 59, 30, 4, kc('conc', 0)); hl(c, 1, 59, 30, kc('conc', 2)); hl(c, 1, 62, 30, kc('yoru', 0))         # 받침
    outline(c, 0, 8, W, 56)


@R.obj('am-exchange', '메달·동전 교환기', w=1, h=1, up=16, kind='wall', use=('search',), tags=GC + ('메달 게임', '교환기', '両替機'),
       place='메달 코너·입구 쪽 북쪽 벽 아래 첫 바닥 줄(앞 칸을 비워 손님이 선다).', pair=('am-medal-pusher', 'am-medal-cup'),
       desc='노란 몸통의 메달·동전 교환기(키 1.8m, 벽 붙이) — 윗면과 앞 가장자리, 처마 그늘, 청록 빛 머리띠, 작은 하늘색 화면, 지폐 넣는 틈과 초록 불, 아래 은빛 받침에 금 메달이 쏟아져 있다(글자 없음).')
def _exchange(c):
    rc(c, 1, 1, 14, 4, kc('kii', 1)); hl(c, 1, 1, 14, kc('kii', 2)); hl(c, 1, 4, 14, kc('kii', 2))               # 윗면 + 앞 가장자리
    hl(c, 1, 5, 14, kc('kii', -2)); hl(c, 1, 6, 14, kc('kii', -1))                                               # 처마 그늘
    rc(c, 1, 7, 14, 24, kc('kii', 0)); vl(c, 1, 7, 24, kc('kii', 1)); vl(c, 14, 7, 24, kc('kii', -2))
    rc(c, 2, 7, 12, 3, kc('neonC', 0)); hl(c, 3, 8, 10, kc('neonC', 1))                                        # 빛 머리띠
    rc(c, 3, 11, 6, 5, kc('sora', 1)); hl(c, 3, 11, 6, kc('sora', 2)); px(c, 4, 12, kc('shiro', 2)); outline(c, 2, 10, 8, 7, kc('kii', -2))
    hl(c, 10, 12, 3, kc('yoru', -2)); px(c, 12, 14, kc('midori', 2)); px(c, 10, 14, kc('aka', 1))
    for x in (4, 6, 8): px(c, x, 18, kc('shiro', 2))
    rc(c, 4, 21, 8, 2, kc('yoru', -2))                                                                          # 배출구
    rc(c, 3, 23, 10, 5, kc('tekko', 2)); hl(c, 3, 23, 10, kc('tekko', 3)); rc(c, 4, 24, 8, 3, kc('tekko', 0))
    medals(c, 4, 25, 8, 2, 7)
    hl(c, 3, 27, 10, kc('tekko', -1))
    rc(c, 1, 29, 14, 2, kc('kii', -2)); hl(c, 1, 30, 14, kc('yoru', 0))
    outline(c, 0, 0, 16, 32)


@R.obj('am-prize-shelf', '경품 선반', w=2, h=1, up=16, kind='wall', use=('search',), tags=GC + PA + ('경품', '景品'),
       place='직원 카운터 뒤 북쪽 벽 아래 첫 바닥 줄(게임 센터·파친코 경품 카운터 뒤).', pair=('am-counter', 'am-prize-box', 'am-plush'),
       desc='흰 철제 경품 선반 2칸(키 1.8m, 벽 붙이) — 윗면과 처마 그늘, 짙은 뒤판 앞 세 단에 리본 두른 색 상자·색 공 모양 인형·과자 상자가 빽빽하다(글자·상표 없음).')
def _prize_shelf(c):
    W = 32
    rc(c, 1, 1, 30, 4, kc('shiro', 1)); hl(c, 1, 1, 30, kc('shiro', 2)); hl(c, 1, 4, 30, kc('shiro', 2))
    hl(c, 1, 5, 30, kc('conc', -1)); hl(c, 1, 6, 30, kc('conc', 0))
    rc(c, 2, 7, 28, 22, kc('yoru', -1))                                                                         # 뒤판
    for x0 in (1, 30): vl(c, x0, 5, 26, kc('shiro', 0 if x0 == 1 else -1))
    vl(c, 1, 5, 26, kc('shiro', 1))
    boxes = (('aka', 4), ('sora', 5), ('kii', 4), ('midori', 5), ('pinku', 5), ('daidai', 4))
    x = 2
    for i, (rp, w) in enumerate(boxes):                                                                         # 1단: 상자
        if x + w > 30: break
        hgt = 6 - (i % 2)
        y0 = 14 - hgt
        rc(c, x, y0, w - 1, hgt, kc(rp, 0)); hl(c, x, y0, w - 1, kc(rp, 2)); vl(c, x + (w - 1) // 2, y0, hgt, kc('shiro', 2) if rp != 'kii' else kc('aka', 1))
        hl(c, x, y0 + hgt - 1, w - 1, kc(rp, -2))
        x += w
    hl(c, 2, 14, 28, kc('shiro', 2)); hl(c, 2, 15, 28, kc('conc', 0))
    for (cx, rp) in ((5, 'pinku'), (10, 'kii'), (15, 'sora'), (20, 'midori'), (25, 'aka')):                    # 2단: 공 인형
        ball(c, cx, 19.5, 2.6, rp, 1)
    hl(c, 2, 22, 28, kc('shiro', 2)); hl(c, 2, 23, 28, kc('conc', 0))
    x = 3
    for i in range(8):                                                                                          # 3단: 과자 상자
        rp = ('daidai', 'sora', 'aka', 'midori', 'kii', 'murasaki', 'aka', 'sora')[i]
        rc(c, x, 24, 2, 4, kc(rp, 1)); px(c, x, 24, kc(rp, 2)); px(c, x + 1, 27, kc(rp, -1))
        x += 3
    hl(c, 2, 28, 28, kc('shiro', 2)); rc(c, 1, 29, 30, 2, kc('shiro', -1)); hl(c, 1, 30, 30, kc('yoru', 0))
    outline(c, 0, 0, W, 32)


@R.obj('am-neon-sign', '네온 장식(별·번개)', w=1, kind='hang', hrows=2, tags=GC + ('네온', '장식'),
       place='게임 센터 북쪽 벽면 윗줄 — 의자·낮은 기기 위(키 큰 기기 위에 걸면 기기 꼭대기에 가린다). 둘을 띄워 건다. 글자 대신 모양만.',
       desc='짙은 세로 판 위에 분홍 네온관 별(위)과 청록 네온관 번개(아래)가 빛나는 걸이 장식 1칸 — 관마다 같은 색 낮은 단 번짐, 노란 반짝이 점. 글자·로고 없음.')
def _neon(c):
    rc(c, 1, 2, 14, 27, kc('sumi', 0)); outline(c, 0, 1, 16, 29, kc('tekko', -2)); hl(c, 1, 2, 14, kc('sumi', 1))
    rc(c, 3, 0, 2, 2, kc('tekko', 1)); rc(c, 11, 0, 2, 2, kc('tekko', 1))                                      # 걸쇠
    import math
    cx, cy, R1, R2 = 8, 9.5, 5.5, 2.4
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = R1 if i % 2 == 0 else R2
        pts.append((round(cx + math.cos(a) * r), round(cy + math.sin(a) * r)))
    star = []
    for i in range(10): star += line_pts(*pts[i], *pts[(i + 1) % 10])
    glow_line(c, star, 'neonP')
    bolt = line_pts(10, 17, 6, 22) + line_pts(6, 22, 10, 22) + line_pts(10, 22, 6, 27)
    glow_line(c, bolt, 'neonC')
    for (x, y) in ((3, 4), (13, 15), (3, 24), (12, 27)): px(c, x, y, kc('kii', 2))
    hl(c, 1, 28, 14, kc('sumi', -1))


# ══ 파친코 ═══════════════════════════════════════════════════════════════════
def _island_top(c, y0):
    """섬 윗면: 짙은 나무 갓 3줄 + 앞 가장자리 + 그늘."""
    rc(c, 0, y0, 16, 3, kc('ita', 1)); hl(c, 0, y0, 16, kc('ita', 2)); hl(c, 0, y0 + 2, 16, kc('ita', 3))
    hl(c, 0, y0 + 3, 16, kc('ita', -2))


@R.obj('am-pachinko-n', '파친코 기기', w=1, h=1, up=16, kind='floor', use=('search',), facing='N', tags=PA + ('파친코 기기', '台'),
       place='파친코 섬의 남쪽 줄(또는 북쪽 벽 앞 한 줄) — 가로로 이어 붙여 벽처럼 줄 세운다. 남쪽에 의자(am-pachinko-stool) 한 대씩, 북쪽에는 등 맞댄 뒷면(am-pachinko-back) 줄.', pair=('am-pachinko-stool', 'am-pachinko-back', 'am-pachinko-island-end'),
       desc='파친코 기기 한 대(손님이 남쪽에 앉아 북쪽을 본다) — 섬 윗면 위 빨간 데이터 램프, 금빛 틀 위 분홍·노랑 빛 띠, 둥근 테 안 흰 판에 핀 점과 가운데 색 칸 셋의 액정(숫자 없음), 아래 은구슬이 담긴 받침 접시와 검은 손잡이, 붉은 받침대.')
def _pachinko(c):
    _island_top(c, 1)
    disc(c, 8, 1.6, 2, 1.3, kc('aka', 1)); px(c, 7, 1, kc('aka', 2))                                            # 데이터 램프
    rc(c, 1, 5, 14, 17, kc('kii', 0)); vl(c, 1, 5, 17, kc('kii', 1)); vl(c, 14, 5, 17, kc('kii', -2))            # 금 틀
    for x in range(2, 14): px(c, x, 6, kc('neonP', 1) if x % 3 else kc('kii', 2))
    rc(c, 2, 7, 12, 12, kc('shiro', 1)); hl(c, 2, 7, 12, kc('shiro', 2))                                        # 판
    ring(c, 8, 13, 6.5, 6.4, kc('tekko', 2))                                                                   # 둥근 레일
    for y in range(8, 19):
        for x in range(3, 13):
            if (x + y) % 2 == 0 and ((x - 7.5) ** 2 / 30 + (y - 13) ** 2 / 30) < 1 and not (5 <= x <= 10 and 9 <= y <= 13): px(c, x, y, kc('conc', 1))   # 핀
    rc(c, 5, 9, 6, 5, kc('kon', -1)); hl(c, 5, 9, 6, kc('sora', 2)); outline(c, 4, 8, 8, 7, kc('kii', -1))     # 액정
    for i, rp in enumerate(('aka', 'kii', 'midori')): rc(c, 5 + i * 2, 10, 2, 3, kc(rp, 1)); px(c, 5 + i * 2, 10, kc(rp, 2))
    rc(c, 7, 15, 2, 2, kc('aka', 0)); px(c, 7, 15, kc('aka', 2)); hl(c, 6, 17, 4, kc('kii', 1))                  # 시동 입구 + 입상구
    px(c, 3, 9, kc('neonC', 1)); px(c, 12, 9, kc('neonC', 1)); px(c, 3, 17, kc('neonP', 1)); px(c, 12, 17, kc('neonP', 1))
    rc(c, 1, 19, 14, 3, kc('tekko', 2)); hl(c, 1, 19, 14, kc('tekko', 3))                                       # 받침 접시(윗면)
    medals(c, 2, 20, 9, 1, 11, silver=True)
    hl(c, 1, 22, 14, kc('tekko', -1))
    rc(c, 1, 23, 14, 3, kc('tekko', 0)); disc(c, 12.5, 24, 1.8, 1.6, kc('yoru', -1)); px(c, 12, 23, kc('tekko', 3))   # 아래 접시 + 손잡이
    rc(c, 1, 26, 14, 5, kc('aka', -2)); hl(c, 1, 26, 14, kc('kii', -1)); rc(c, 9, 28, 3, 1, kc('yoru', -2))     # 받침대 + 카드 틈
    hl(c, 1, 30, 14, kc('aka', -2))
    outline(c, 0, 0, 16, 32)


@R.obj('am-pachinko-back', '파친코 섬 뒷면', w=1, h=1, up=8, kind='floor', use=('block',), facing='S', tags=PA + ('파친코 기기', '島'),
       place='파친코 섬의 북쪽 줄 — am-pachinko-n 줄 바로 북쪽에 등을 맞대 같은 길이로. 이 줄 손님은 북쪽 의자(am-pachinko-stool)에 앉아 남쪽을 본다.', pair=('am-pachinko-n', 'am-pachinko-stool'),
       desc='맞은편 파친코 기기 줄의 뒷면 — 같은 나무 섬 윗면, 등 뒤 데이터 램프, 회색 철판 뒤판에 구슬 관 두 줄. 기기 얼굴은 북쪽이라 안 보인다.')
def _pachinko_back(c):
    _island_top(c, 9)
    disc(c, 8, 9.6, 1.8, 1.1, kc('aka', 0))
    rc(c, 1, 13, 14, 18, kc('conc', 0)); vl(c, 1, 13, 18, kc('conc', 1)); vl(c, 14, 13, 18, kc('conc', -2))
    for x in (4, 11): vl(c, x, 13, 17, kc('tekko', 2)); vl(c, x + 1, 13, 17, kc('tekko', 0))                   # 구슬 관
    rc(c, 6, 15, 4, 3, kc('conc', 2)); outline(c, 6, 15, 4, 3, kc('conc', -2))
    hl(c, 1, 30, 14, kc('yoru', 0))
    outline(c, 0, 8, 16, 24)


@R.obj('am-pachinko-stool', '파친코 의자', w=1, h=1, up=0, kind='floor', use=('sit',), tags=PA + ('의자',),
       place='파친코 기기(am-pachinko-n) 바로 남쪽과 섬 뒷면(am-pachinko-back) 바로 북쪽에 기기마다 한 대.', pair=('am-pachinko-n',),
       desc='바닥 레일에 고정된 둥근 파친코 의자 — 감색 비닐 방석, 크롬 기둥, 가로 레일. 등받이가 없어 어느 쪽에서나 앉는다.')
def _pstool(c): _stool(c, 'kon', rail=True)


@R.obj('am-pachinko-island-end', '파친코 섬 끝 판', w=1, h=2, up=8, kind='floor', use=('block',), tags=PA + ('島', '섬 끝'),
       place='파친코 섬(뒷면 줄 + 기기 줄 두 줄)의 서쪽·동쪽 끝에 세로 2칸으로 세운다.', pair=('am-pachinko-n', 'am-pachinko-back', 'am-ball-counter'),
       desc='세로 2칸 파친코 섬 끝 판 — 나무 섬 윗면이 이어지고, 앞면은 금 테 두른 붉은 장식 판에 분홍 네온 기둥과 색 막대 표시(데이터 기록 판, 숫자 없음), 아래 검은 받침.')
def _island_end(c):
    rc(c, 0, 9, 16, 11, kc('ita', 1)); hl(c, 0, 9, 16, kc('ita', 2)); vl(c, 0, 9, 11, kc('ita', 2))
    for y in (12, 16): hl(c, 1, y, 14, kc('ita', 0))
    disc(c, 8, 13.5, 2, 1.3, kc('aka', 1)); px(c, 7, 13, kc('aka', 2))
    hl(c, 0, 19, 16, kc('ita', 3)); hl(c, 0, 20, 16, kc('ita', -2))
    rc(c, 1, 21, 14, 23, kc('aka', -1)); vl(c, 1, 21, 23, kc('aka', 0)); vl(c, 14, 21, 23, kc('aka', -2))
    outline(c, 2, 22, 12, 21, kc('kii', 0))
    glow_line(c, [(4, y) for y in range(24, 41)], 'neonP')
    for i, (rp, n) in enumerate((('kii', 7), ('sora', 5), ('midori', 8), ('aka', 4))):
        hl(c, 7, 26 + i * 4, n - 1, kc(rp, 1)); px(c, 7, 26 + i * 4, kc(rp, 2))
    rc(c, 1, 44, 14, 3, kc('yoru', -1)); hl(c, 1, 44, 14, kc('yoru', 1))
    outline(c, 0, 8, 16, 40)


@R.obj('am-ball-box', '구슬 상자 더미', w=1, h=1, up=8, kind='floor', use=('search',), tags=PA + ('구슬', 'ドル箱'),
       place='파친코 의자 옆 통로 쪽·경품 카운터 앞 구슬 계수기 곁에 하나씩(통로를 막지 않게 섬 끝·벽 곁).', pair=('am-ball-counter', 'am-counter'),
       desc='은구슬이 가득 찬 붉은 플라스틱 구슬 상자 세 개를 조금씩 어긋나게 쌓은 더미 — 맨 위 상자 윗면에 은구슬이 빽빽하고 상자마다 세로 골.')
def _ball_box(c):
    for i, (x0, y0) in enumerate(((2, 25), (3, 19), (2, 13))):
        rc(c, x0, y0, 12, 6, kc('aka', 0)); hl(c, x0, y0, 12, kc('aka', 2)); vl(c, x0, y0, 6, kc('aka', 1)); vl(c, x0 + 11, y0, 6, kc('aka', -2))
        for x in range(x0 + 3, x0 + 11, 3): vl(c, x, y0 + 1, 5, kc('aka', -1))
        hl(c, x0, y0 + 5, 12, kc('aka', -2))
    rc(c, 2, 9, 12, 4, kc('aka', 1)); medals(c, 3, 9, 10, 4, 13, silver=True); hl(c, 2, 9, 12, kc('aka', 2))
    ol_in(c)


@R.obj('am-counter', '경품 카운터', w=1, h=1, up=0, kind='floor', surface=True, use=('counter',), tags=PA + GC + ('카운터', '景品カウンター'),
       place='경품 선반(am-prize-shelf) 앞 한 줄 — 가로로 이어 붙이고 계산기(am-register)를 한 칸 끼운다. 줄 끝 한 칸은 직원 틈. 앞(남쪽)에 손님 자리 2줄.', pair=('am-prize-shelf', 'am-register', 'am-prize-box', 'am-plush'),
       desc='유리 진열 경품 카운터 한 칸 — 금빛 테 두른 유리 윗면 아래로 작은 색 경품이 비치고(사선 반사), 앞면은 짙은 붉은 판에 금 줄. 윗면에 경품·메달 컵을 올린다.')
def _counter(c):
    rc(c, 0, 1, 16, 8, kc('garasu', 1)); hl(c, 0, 1, 16, kc('kii', 1)); vl(c, 0, 1, 8, kc('kii', 1))
    for (x, y, rp) in ((2, 4, 'aka'), (6, 3, 'sora'), (9, 5, 'kii'), (12, 3, 'midori'), (4, 6, 'pinku'), (13, 6, 'daidai')):
        rc(c, x, y, 2, 2, kc(rp, 1)); px(c, x, y, kc(rp, 2))
    for i in range(3): px(c, 9 + i, 4 - i + 2, kc('garasu', 3))
    hl(c, 0, 8, 16, kc('kii', 2)); hl(c, 0, 9, 16, kc('aka', -2))
    rc(c, 0, 10, 16, 5, kc('aka', -1)); hl(c, 0, 12, 16, kc('kii', -1)); vl(c, 0, 10, 5, kc('aka', 0))
    hl(c, 0, 14, 16, kc('yoru', -1))
    hl(c, 0, 0, 16, OL); hl(c, 0, 15, 16, OL)


@R.obj('am-register', '경품 카운터 계산기', w=1, h=1, up=16, kind='floor', use=('counter',), tags=PA + GC + ('카운터', '계산대', 'レジ'),
       place='경품 카운터 줄(am-counter) 가운데 한 칸 — 앞(남쪽)에 손님 자리 2줄을 비운다.', pair=('am-counter', 'am-prize-shelf'),
       desc='유리 진열 카운터 위에 놓인 검은 계산기 — 윗면, 손님 쪽 청록 표시창(숫자 없음)과 색 단추 점, 아래 은빛 동전 받침. 카운터 앞면은 짙은 붉은 판에 금 줄.')
def _register(c):
    rc(c, 0, 17, 16, 8, kc('garasu', 1)); hl(c, 0, 17, 16, kc('kii', 1)); vl(c, 0, 17, 8, kc('kii', 1))          # 카운터 윗면(유리)
    for (x, y, rp) in ((2, 21, 'aka'), (12, 20, 'sora'), (13, 22, 'kii')): rc(c, x, y, 2, 2, kc(rp, 1)); px(c, x, y, kc(rp, 2))
    hl(c, 0, 24, 16, kc('kii', 2)); hl(c, 0, 25, 16, kc('aka', -2))
    rc(c, 0, 26, 16, 5, kc('aka', -1)); hl(c, 0, 28, 16, kc('kii', -1)); vl(c, 0, 26, 5, kc('aka', 0)); hl(c, 0, 30, 16, kc('yoru', -1))
    hl(c, 0, 16, 16, OL); hl(c, 0, 31, 16, OL)
    rc(c, 4, 8, 8, 3, kc('tekko', 2)); hl(c, 4, 8, 8, kc('tekko', 3))                                            # 계산기 윗면
    rc(c, 4, 11, 8, 9, kc('yoru', 0)); vl(c, 4, 11, 9, kc('yoru', 2)); vl(c, 11, 11, 9, kc('yoru', -2))
    rc(c, 5, 12, 6, 2, kc('neonC', 0)); hl(c, 6, 12, 3, kc('neonC', 1))                                         # 표시창
    for (x, rp) in ((5, 'aka'), (7, 'kii'), (9, 'sora')): px(c, x, 15, kc(rp, 2)); px(c, x + 1, 17, kc('tekko', 3))
    rc(c, 3, 20, 10, 3, kc('tekko', 1)); hl(c, 3, 20, 10, kc('tekko', 3)); medals(c, 5, 21, 6, 1, 31)           # 동전 받침
    outline(c, 3, 7, 10, 14)
    outline(c, 2, 19, 12, 5)


@R.obj('am-ashtray-stand', '재떨이 기둥', w=1, h=1, up=8, kind='floor', use=('search',), tags=PA + ('흡연실', '재떨이', '喫煙所'),
       place='흡연실 안 — 벽 곁에 2~3개, 서서 피우는 자리 사이에.', pair=('am-smoke-eater',),
       desc='허리 높이의 은빛 원통 재떨이 기둥 — 위에서 보이는 둥근 접시에 회색 모래와 재 점, 가는 기둥, 둥근 받침.')
def _ashtray(c):
    disc(c, 8, 12, 5.5, 2.8, kc('tekko', 1)); disc(c, 7.7, 11.8, 4.6, 2.1, kc('tekko', 3)); disc(c, 8, 12, 3.5, 1.5, kc('conc', 0))
    px(c, 7, 12, kc('conc', -2)); px(c, 9, 11, kc('conc', 2)); px(c, 6, 11, kc('shiro', 1))
    rc(c, 3, 14, 10, 2, kc('tekko', 0)); hl(c, 3, 15, 10, kc('tekko', -2))
    rc(c, 6, 16, 4, 11, kc('tekko', 1)); vl(c, 6, 16, 11, kc('tekko', 3)); vl(c, 9, 16, 11, kc('tekko', -1))
    disc(c, 8, 28.5, 5, 1.8, kc('tekko', -1)); hl(c, 5, 27, 5, kc('tekko', 1))
    ol_in(c)


@R.obj('am-ball-counter', '구슬 계수기', w=1, h=1, up=8, kind='floor', use=('counter',), tags=PA + ('구슬', '計数機'),
       place='경품 카운터 앞 손님 자리 곁이나 섬 끝 판 옆 — 구슬 상자를 쏟아 세는 기계.', pair=('am-ball-box', 'am-counter'),
       desc='흰 몸통의 구슬 계수기 — 윗면 깔때기 구멍에 은구슬, 앞면 빨간 줄과 청록 빛 표시창(숫자 없음), 영수증 나오는 틈.')
def _ball_counter(c):
    rc(c, 1, 9, 14, 5, kc('shiro', 1)); hl(c, 1, 9, 14, kc('shiro', 2))
    disc(c, 8, 11.5, 4.5, 1.8, kc('yoru', -1)); medals(c, 5, 11, 6, 2, 17, silver=True)
    hl(c, 1, 13, 14, kc('shiro', 2)); hl(c, 1, 14, 14, kc('conc', 0))
    rc(c, 1, 15, 14, 14, kc('shiro', 0)); vl(c, 1, 15, 14, kc('shiro', 1)); vl(c, 14, 15, 14, kc('conc', 1))
    hl(c, 1, 16, 14, kc('aka', 0)); hl(c, 1, 17, 14, kc('aka', -1))
    rc(c, 4, 19, 8, 3, kc('neonC', -1)); hl(c, 5, 20, 5, kc('neonC', 1))
    hl(c, 5, 24, 6, kc('yoru', -2))
    rc(c, 1, 28, 14, 2, kc('conc', -1))
    outline(c, 0, 8, 16, 23)


@R.obj('am-smoke-eater', '공기 청정기(흡연실)', w=1, kind='hang', hrows=2, tags=PA + ('흡연실', '空気清浄機'),
       place='흡연실 북쪽 벽면 윗줄.', pair=('am-ashtray-stand',),
       desc='벽에 매단 흰 공기 청정기 상자 — 윗면과 앞면, 가로 루버 여러 줄, 초록 작동 불. 흡연실 표시.')
def _smoke_eater(c):
    rc(c, 1, 3, 14, 3, kc('shiro', 1)); hl(c, 1, 3, 14, kc('shiro', 2)); hl(c, 1, 5, 14, kc('shiro', 2))
    rc(c, 1, 6, 14, 11, kc('shiro', 0)); vl(c, 1, 6, 11, kc('shiro', 1)); vl(c, 14, 6, 11, kc('conc', 1))
    for y in range(8, 15, 2): hl(c, 3, y, 10, kc('conc', 0)); hl(c, 3, y + 1, 10, kc('shiro', 1))
    px(c, 12, 7, kc('midori', 2))
    hl(c, 1, 16, 14, kc('conc', 0))
    outline(c, 0, 2, 16, 16)


# ══ 탁상 물건 ═══════════════════════════════════════════════════════════════
@R.good('am-medal-cup', '메달 컵', desc='금 메달이 넘치게 담긴 하늘색 플라스틱 컵 하나 — 위에서 보이는 컵 입 위로 메달 더미.')
def _g_cup(c):
    rc(c, 4, 7, 8, 7, kc('sora', 1)); vl(c, 4, 7, 7, kc('sora', 2)); vl(c, 11, 7, 7, kc('sora', -1)); hl(c, 4, 13, 8, kc('sora', -1))
    disc(c, 8, 6.5, 4.5, 2, kc('sora', 2)); disc(c, 8, 6.3, 3.6, 1.4, kc('kii', 1))
    medals(c, 5, 4, 6, 3, 23)
    ol_in(c)


@R.good('am-plush', '공 인형', desc='둥근 공 모양 인형 둘 — 큰 분홍 공과 작은 노란 공(얼굴·동물 모양 없음, 바느질 선 하나).')
def _g_plush(c):
    ball(c, 6.5, 9, 4.5, 'pinku', 0)
    for i in range(5): px(c, 4 + i, 8 + (1 if 0 < i < 4 else 0), kc('pinku', -1))
    ball(c, 12, 11.5, 2.6, 'kii', 1)
    ol_in(c)


@R.good('am-prize-box', '경품 상자', desc='리본을 두른 하늘색 경품 상자 하나 — 위에서 보이는 윗면, 노란 리본 십자(글자 없음).')
def _g_box(c):
    rc(c, 3, 5, 10, 4, kc('sora', 2)); hl(c, 3, 5, 10, kc('sora', 3))
    rc(c, 3, 9, 10, 5, kc('sora', 0)); vl(c, 3, 9, 5, kc('sora', 1))
    vl(c, 8, 5, 9, kc('kii', 2)); hl(c, 3, 7, 10, kc('kii', 2)); px(c, 7, 4, kc('kii', 1)); px(c, 9, 4, kc('kii', 1))
    outline(c, 2, 4, 12, 11)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
