#!/usr/bin/env python3
"""jp_city 실내 — 패밀리 레스토랑(ファミレス)·규동 체인(牛丼屋) 묶음 `interior_famires`. id 접두 `fr-`.
  python3 scripts/content/jp-city/blocks/interior_famires.py   # selftest + tiledata/jp-city/blocks/interior_famires/_all-x3.png
음식점 가구 `fd-`(interior_food.py) 화풍을 따른다: 굵은 윤곽, 윗면 1px 밝은 테, 앞면 아래 어두운 띠, 빛 왼쪽 위.
바닥(나무 쪽마루·주방 타일·규동집 갈색 타일), 벽(크림 벽 + 나무 허리판 + 그림 액자), 박스석(높은 등받이 벤치 두 방향·탁자·칸막이 화분),
드링크 바·수프 바·디저트 냉장 진열·계산대·대기 의자·아이 의자·주방 내주는 창, 규동집 ㄷ자 카운터·스툴·소고기 냄비·밥 보온통, 탁상 물건.
색은 modern3 램프 K(램프, 단) 만. 글자·상표·사람 없음(메뉴는 색 띠, 버튼은 색 점).

크기(§12-3, 1칸 = 1m):
  박스석 벤치 2인 1.2×0.6×1.1m(등받이 높이) → 2×1칸, 앞면 F 18 → 등받이가 16px 위로 솟는다(up 16).
  북향 벤치는 등받이 뒷면만 보이고 1칸 안에 든다(up 0 — 위로 솟으면 북쪽 탁자 칸 4층을 차지해 탁상 물건이 못 올라간다).
  박스석 탁자 1.2×0.7×0.72m → 2×1(4인은 1×2·2×2도 된다). 칸막이 화분 1.2×0.25×1.2m → 2×1, 화분 잎이 위로 16px.
  드링크 바 2.4×0.6×0.9m(디스펜서 0.7m) → 3×1, wall, 디스펜서가 벽면 아랫줄을 덮는다(up 16).
  수프 바·디저트 진열·계산대 0.8×0.6×1.0~1.3m → 1×1, up 16. 대기 의자 1.6×0.4×0.45m → 2×1, up 4.
  아이 의자 0.5×0.5×0.95m → 1×1, up 0(16px 안). 내주는 창 1.6m 폭 → 2×1, wall, 열린 창이 벽면 두 줄을 덮는다(up 32).
  규동 ㄷ자 카운터 폭 0.6m(아무 크기 탁자) · 스툴 0.35m·0.7m 높이 → 1×1 up 0 · 소고기 냄비대·밥 보온통 → 1×1 wall up 16.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa
import categories as CATS                           # noqa

BLOCK = 'interior_famires'
R = Registry(BLOCK, '패밀리 레스토랑·규동집')


def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def box(c, x, y, w, h, col):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def ell(c, cx, cy, rx, ry, m, ol=True, hi=True, olc=None):
    def inside(x, y): return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if not inside(x, y): continue
            if ol and not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.P(x, y, olc if olc is not None else K(m, -2)); continue
            t = (x + .5 - cx) / rx * 0.6 + (y + .5 - cy) / ry * 0.8
            c.P(x, y, K(m, (2 if t < -0.5 else 1 if t < -0.1 else -1 if t > 0.5 else 0) if hi else 0))


def bev(c, x, y, w, h, m, t=0, olc=None):
    """윤곽 + 면 + 왼·위 밝은 변 + 오른·아래 어두운 변."""
    box(c, x, y, w, h, olc if olc is not None else K(m, t - 3))
    c.R(x + 1, y + 1, w - 2, h - 2, K(m, t))
    c.HL(x + 1, y + 1, w - 2, K(m, t + 1)); c.VL(x + 1, y + 1, h - 2, K(m, t + 1))
    c.HL(x + 1, y + h - 2, w - 2, K(m, t - 1)); c.VL(x + w - 2, y + 2, h - 3, K(m, t - 1))


def O(id_, ko, **kw):
    kw.setdefault('cat', 'famires'); kw.setdefault('cat_ko', '패밀리 레스토랑')
    return R.obj(id_, ko, **kw)


def counter_body(c, x, y, w, top='kinari', front='ita', doors=True, ft=0):
    """카운터·진열대 몸체(16행): 윗면 5행(밝은 테) + 앞 가장자리 + 들어간 앞판 + 굽."""
    c.R(x, y, w, 5, K(top, 1)); c.HL(x, y, w, K(top, 2)); c.VL(x, y, 5, K(top, 2)); c.HL(x, y + 4, w, K(top, -1))
    c.R(x, y + 5, w, 10, K(front, ft)); c.HL(x, y + 5, w, K(front, ft + 1)); c.HL(x, y + 6, w, K(front, ft - 2))
    c.VL(x, y + 5, 10, K(front, ft + 1)); c.VL(x + w - 1, y + 5, 10, K(front, ft - 3))
    if doors:
        for dx in range(2, w - 2, 7):
            ww = min(5, w - 2 - dx)
            if ww < 3: continue
            c.R(x + dx, y + 8, ww, 5, K(front, ft - 1)); box(c, x + dx, y + 8, ww, 5, K(front, ft - 3)); c.HL(x + dx + 1, y + 8, ww - 2, K(front, ft - 2))
    c.HL(x, y + 15, w, K(front, -3))


# ───────────────────────── 바닥 ─────────────────────────
@R.floor('fr-floor', '패밀리 레스토랑 나무 쪽마루', cols=4, rows=4, tags=('패밀리 레스토랑', '음식점', '객석'),
         desc='따뜻한 밝은 갈색 나무 쪽마루(パーケット) — 한 칸(16px) 네모마다 8px 널 두 장이 가로·세로로 번갈아 놓인다(바구니 짜임). 쪽 가장자리 1px 줄눈, 톤 차는 한 단계뿐이라 조용하다.')
def _(c):
    for ty in range(0, c.h, 16):
        for tx in range(0, c.w, 16):
            tone = 0
            c.R(tx, ty, 16, 16, K('yuka', tone))
            if ((tx // 16) + (ty // 16)) % 2:
                c.HL(tx, ty + 7, 15, K('yuka', -1))                         # 가로 널 두 장
                for k in range(2):
                    if rnd(tx, ty + k, 4, 500): c.HL(tx + 2 + hs(tx, ty + k, 5) % 6, ty + 2 + k * 8, 4, K('yuka', tone + 1))
            else:
                c.VL(tx + 7, ty, 15, K('yuka', -1))                         # 세로 널 두 장
                for k in range(2):
                    if rnd(tx + k, ty, 6, 500): c.VL(tx + 2 + k * 8, ty + 2 + hs(tx + k, ty, 7) % 6, 4, K('yuka', tone + 1))
            c.HL(tx, ty + 15, 16, K('yuka', -1)); c.VL(tx + 15, ty, 16, K('yuka', -1))


@R.floor('fr-kitchen-floor', '레스토랑 주방 미끄럼 방지 타일', cols=4, rows=4, tags=('주방', '패밀리 레스토랑', '규동'),
         desc='주방 바닥 — 푸른 회색 8px 타일 + 짙은 줄눈, 타일마다 미끄럼 방지 오돌토돌 점(한 단 어둡게)이 성기게 박혀 있다.')
def _(c):
    for ty in range(0, c.h, 8):
        for tx in range(0, c.w, 8):
            t = hs(tx // 8, ty // 8, 11) % 5
            c.R(tx, ty, 8, 8, K('tairu', -1 if t else 0))
            c.HL(tx, ty, 7, K('tairu', 0)); c.VL(tx, ty, 7, K('tairu', 0))
            c.HL(tx, ty + 7, 8, K('tairu', -3)); c.VL(tx + 7, ty, 8, K('tairu', -3))
            for (dx, dy) in ((2, 2), (5, 3), (3, 5)):
                c.P(tx + dx, ty + dy, K('tairu', -2))


@R.floor('fr-gyudon-floor', '규동집 갈색 타일', cols=4, rows=4, tags=('규동', '음식점', '가게'),
         desc='짙은 밤색 8px 정사각 타일 + 더 짙은 줄눈. 타일 톤은 한 단계 안에서 고르게 섞이고 왼쪽 위 모서리가 1px 밝다(오래 닦인 체인점 바닥).')
def _(c):
    for ty in range(0, c.h, 8):
        for tx in range(0, c.w, 8):
            t = hs(tx // 8, ty // 8, 21) % 6
            b = (0, -1, 0, 0, -1, 0)[t]
            c.R(tx, ty, 8, 8, K('soil', b))
            c.HL(tx, ty, 7, K('soil', b + 1)); c.VL(tx, ty, 7, K('soil', b + 1))
            c.HL(tx, ty + 7, 8, K('soil', -2)); c.VL(tx + 7, ty, 8, K('soil', -2))
            if t == 2: c.P(tx + 4, ty + 3, K('soil', b - 1))


# ───────────────────────── 벽 ─────────────────────────
@R.wall('fr-wall', '패밀리 레스토랑 크림 벽 + 나무 허리판', cols=4, tags=('패밀리 레스토랑', '음식점', '객석'),
        desc='따뜻한 크림색 벽(아주 옅은 얼룩) + 나무 몰딩 + 세로 판넬 허리판 + 짙은 굽도리. 네 칸(64px)마다 나무 액자 하나 — 하늘·초록 언덕·노란 해의 풍경(사람·글자 없음).')
def _(c):
    W = c.w
    c.R(0, 0, W, 19, K('kinari', 1))
    for y in range(19):
        for x in range(W):
            if rnd(x, y, 31, 40): c.P(x, y, K('kinari', 0))
    # 액자(64px 마다 하나, x 22..41)
    fx, fy, fw, fh = 22, 4, 20, 12
    c.R(fx, fy, fw, fh, K('ita', -1)); box(c, fx, fy, fw, fh, K('ita', -3)); c.HL(fx + 1, fy, fw - 2, K('ita', 1)); c.VL(fx, fy + 1, fh - 2, K('ita', 0))
    ix, iy, iw, ih = fx + 2, fy + 2, fw - 4, fh - 4
    c.R(ix, iy, iw, 4, K('sora', 1)); c.HL(ix, iy, iw, K('sora', 2))
    c.R(ix, iy + 4, iw, ih - 4, K('midori', 0))
    for x in range(iw):
        hgt = 1 + (2 if 3 <= x <= 9 else 1 if 10 <= x <= 13 else 0)
        c.VL(ix + x, iy + 4 - hgt, hgt, K('midori', 1))
    c.R(ix + 11, iy + 1, 2, 2, K('kii', 2)); c.P(ix + 13, iy + 1, K('kii', 1))
    c.HL(ix, iy + ih - 1, iw, K('midori', -1))
    c.HL(fx + 1, fy + fh, fw - 1, K('kinari', -1))                                 # 액자 밑 그림자
    c.VL(fx + fw, fy + 1, fh, K('kinari', -1))
    # 몰딩 + 허리판 + 굽도리
    c.HL(0, 19, W, K('ita', 2)); c.HL(0, 20, W, K('ita', 0)); c.HL(0, 21, W, K('ita', -2))
    c.R(0, 22, W, 7, K('ita', 1))
    for x in range(0, W, 8):
        c.VL(x, 22, 7, K('ita', -1)); c.VL(x + 1, 22, 7, K('ita', 2))
        c.R(x + 3, 24, 3, 3, K('ita', 0)); c.HL(x + 3, 24, 3, K('ita', -1))
    c.R(0, 29, W, 3, K('ita', -2)); c.HL(0, 29, W, K('ita', -1)); c.HL(0, 31, W, K('ita', -3))


# ───────────────────────── 탁자 ─────────────────────────
@R.table('fr-booth-table', '박스석 탁자', desc='패밀리 레스토랑 박스석·4인석 탁자. 아주 밝은 나뭇결 판(라미네이트, 바닥보다 두 단 밝다) + 짙은 나무 테두리 + 앞 가장자리 띠, 양 끝 굵은 다리. 아무 크기(2×1·1×2·2×2).',
         tags=('탁자', '패밀리 레스토랑', '박스석'))
def _(c, w, h):
    W, H = w * 16, h * 16
    ty1 = H - 6                                                                     # 윗면 끝
    c.R(0, 0, W, ty1, K('ita', -2))                                                # 테두리
    c.R(1, 1, W - 2, ty1 - 2, K('yuka', 2))
    c.HL(1, 1, W - 2, K('shiro', 1)); c.VL(1, 1, ty1 - 2, K('shiro', 1))
    for y in range(3, ty1 - 1, 3):
        for x in range(2, W - 2, 12):
            c.HL(x + (2 if (y // 3) % 2 else 6), y, 4, K('yuka', 1))
    c.HL(1, ty1 - 2, W - 2, K('yuka', 0)); c.VL(W - 2, 2, ty1 - 3, K('yuka', 0))
    c.HL(0, 0, W, K('ita', -1))
    c.R(0, ty1, W, 3, K('ita', -1)); c.HL(0, ty1, W, K('ita', 1)); c.HL(0, ty1 + 2, W, K('ita', -3))   # 앞 가장자리
    for x0 in (2, W - 5):
        c.R(x0, ty1 + 3, 3, 3, K('tekko', -1)); c.VL(x0, ty1 + 3, 3, K('tekko', 1))


@R.table('fr-u-counter', '규동집 ㄷ자 카운터', desc='규동 체인의 ㄷ자 카운터 조각. 윗면은 밝은 나무 판(손님 쪽 둥근 앞날), 앞판은 주황 판넬 + 짙은 굽. 가로 한 줄 + 양 끝에서 세로로 꺾인 1×N 으로 ㄷ자를 이어 붙인다. 아무 크기.',
         tags=('카운터', '규동', '가게'))
def _(c, w, h):
    W, H = w * 16, h * 16
    ty1 = H - 8
    c.R(0, 0, W, ty1, K('yuka', 1)); c.HL(0, 0, W, K('yuka', 2)); c.VL(0, 0, ty1, K('yuka', 2))
    c.HL(0, 1, W, K('ita', -1))                                                    # 안쪽(직원 쪽) 턱
    for y in range(4, ty1, 5):
        for x in range(0, W, 16): c.HL(x + (3 if (y // 5) % 2 else 9), y, 4, K('yuka', 0))
    c.VL(W - 1, 0, ty1, K('yuka', -1))
    c.R(0, ty1, W, 2, K('yuka', -1)); c.HL(0, ty1, W, K('yuka', 2))                # 둥근 앞날
    c.R(0, ty1 + 2, W, 5, K('daidai', 0)); c.HL(0, ty1 + 2, W, K('daidai', -2)); c.HL(0, ty1 + 3, W, K('daidai', 1))
    for x in range(0, W, 8): c.VL(x + 7, ty1 + 3, 4, K('daidai', -1))
    c.HL(0, ty1 + 7, W, K('ita', -3))


# ───────────────────────── 박스석 ─────────────────────────
VINYL = 'aka'


@O('fr-booth-s', '박스석 벤치(남향)', w=2, h=1, up=16, kind='floor', use=('sit',), facing='S',
   tags=('패밀리 레스토랑', '박스석', '의자'),
   desc='패밀리 레스토랑 박스석 2인 벤치(남쪽을 보고 앉음). 짙은 붉은 비닐 높은 등받이(세로 누빔 셋)가 좌석 뒤로 16px 솟고, 위에 나무 갓, 앞에 방석 윗면과 나무 받침. 탁자 북쪽 칸에.')
def _(c):
    W = 32
    c.R(1, 1, W - 2, 3, K('ita', 1)); c.HL(1, 1, W - 2, K('ita', 2)); c.HL(1, 3, W - 2, K('ita', -2)); box(c, 0, 0, W, 5, K('ita', -3))   # 나무 갓
    c.R(1, 5, W - 2, 15, K(VINYL, 0)); c.VL(0, 5, 15, OL); c.VL(W - 1, 5, 15, OL)
    c.HL(1, 5, W - 2, K(VINYL, 1)); c.VL(1, 5, 15, K(VINYL, 1)); c.VL(W - 2, 5, 15, K(VINYL, -2))
    for x in (11, 21):
        c.VL(x, 6, 13, K(VINYL, -2)); c.VL(x + 1, 6, 13, K(VINYL, 1))                     # 누빔 줄
    for x in (6, 16, 26): c.P(x, 11, K(VINYL, -1)); c.P(x, 12, K(VINYL, -2))           # 누빔 단추
    c.HL(1, 19, W - 2, K(VINYL, -2))                                                    # 등받이 밑 그늘
    c.R(1, 20, W - 2, 6, K(VINYL, 1)); c.HL(1, 20, W - 2, K(VINYL, 2)); c.HL(1, 25, W - 2, K(VINYL, -1))   # 방석 윗면
    c.VL(0, 20, 7, OL); c.VL(W - 1, 20, 7, OL); c.VL(16, 21, 4, K(VINYL, 0))
    c.R(0, 26, W, 2, K(VINYL, -1)); c.HL(0, 27, W, K(VINYL, -2))                        # 방석 앞날
    c.R(0, 28, W, 4, K('ita', -1)); c.HL(0, 28, W, K('ita', 0)); c.HL(0, 31, W, OL); c.VL(0, 28, 4, OL); c.VL(W - 1, 28, 4, OL)


@O('fr-booth-n', '박스석 벤치(북향)', w=2, h=1, up=0, kind='floor', use=('sit',), facing='N',
   tags=('패밀리 레스토랑', '박스석', '의자'),
   desc='패밀리 레스토랑 박스석 2인 벤치(북쪽 탁자를 보고 앉음). 남쪽에서는 높은 등받이의 붉은 비닐 뒷면(세로 누빔 둘)이 칸을 채우고, 맨 위에 붉은 등받이 윗날과 나무 갓이 보인다. 탁자 남쪽 칸에(위로 솟지 않아 탁자 위 물건을 가리지 않는다).')
def _(c):
    W = 32
    c.R(1, 0, W - 2, 3, K(VINYL, 1)); c.HL(1, 0, W - 2, K(VINYL, 2)); box(c, 0, 0, W, 4, OL); c.HL(1, 2, W - 2, K(VINYL, -1))
    c.R(1, 3, W - 2, 2, K('ita', 1)); c.HL(1, 3, W - 2, K('ita', 2)); c.HL(1, 4, W - 2, K('ita', -2))      # 갓
    c.R(1, 5, W - 2, 9, K(VINYL, -1)); c.VL(0, 3, 13, OL); c.VL(W - 1, 3, 13, OL)
    c.VL(1, 5, 9, K(VINYL, 0)); c.VL(W - 2, 5, 9, K(VINYL, -2))
    for x in (11, 21): c.VL(x, 6, 7, K(VINYL, -2)); c.VL(x + 1, 6, 7, K(VINYL, 0))                       # 뒷면 누빔 줄
    c.HL(1, 5, W - 2, K(VINYL, -2))                                                                      # 갓 밑 그늘
    c.R(0, 14, W, 2, K('ita', -2)); c.HL(0, 15, W, OL)


@O('fr-booth-divider', '박스석 칸막이 화분', w=2, h=1, up=16, kind='floor', use=('block',),
   tags=('패밀리 레스토랑', '박스석', '칸막이', '화분'),
   desc='등을 맞댄 박스석 사이 낮은 나무 칸막이(2×1). 칸막이 위 긴 화분 상자에 초록 관엽 잎이 위로 솟아 옆 자리와 시선을 가른다. 박스석 북향 벤치와 다음 남향 벤치 사이 줄에.')
def _(c):
    W = 32
    # 잎(위 칸) — 둥근 잎 덩이 셋
    for cx, cy, r in ((7, 9, 5.5), (16, 7, 6.5), (25, 9, 5.5), (11, 13, 4.5), (21, 13, 4.5)):
        ell(c, cx, cy, r, r * 0.85, 'midori', olc=K('midori', -2))
    for (x, y) in ((6, 6), (15, 4), (24, 6), (10, 11), (20, 11)): c.P(x, y, K('midori', 2)); c.P(x + 1, y, K('midori', 2))
    for (x, y) in ((9, 10), (18, 9), (27, 11), (13, 15)): c.P(x, y, K('ki', -2))
    # 화분 상자(칸막이 위)
    c.R(1, 16, W - 2, 5, K('kinari', 0)); box(c, 0, 16, W, 5, K('kinari', -2)); c.HL(1, 16, W - 2, K('kinari', 2))
    c.HL(1, 17, W - 2, K('soil', -1))                                                                     # 흙
    # 칸막이 판(앞면)
    c.R(1, 21, W - 2, 9, K('ita', 0)); c.VL(0, 21, 10, OL); c.VL(W - 1, 21, 10, OL)
    c.HL(1, 21, W - 2, K('ita', -2)); c.HL(1, 22, W - 2, K('ita', 1))
    for x in range(5, W - 2, 6): c.VL(x, 23, 6, K('ita', -1))
    c.HL(0, 30, W, K('ita', -3)); c.HL(0, 31, W, OL)


# ───────────────────────── 드링크 바·수프 바·디저트 ─────────────────────────
@O('fr-drink-bar', '드링크 바', w=3, h=1, up=16, kind='wall', use=('open',),
   tags=('패밀리 레스토랑', '드링크 바', '음료'),
   desc='셀프 드링크 바(3×1, 벽 앞 첫 바닥 줄). 흰 카운터 위에 은색 음료 디스펜서 둘(색 버튼 줄·노즐·아래 받침), 커피 머신, 뒤집어 쌓은 컵 탑과 얼음 통. 버튼은 색 점뿐 — 글자 없음. 앞에 손님이 설 한 줄을 비운다.')
def _(c):
    W = 48; yb = 16
    # 디스펜서 둘(x 1..16, 17..30): 윗면 4px + 앞면 들어간 패널
    for x0, cols in ((1, ('aka', 'daidai', 'kii', 'midori')), (17, ('sora', 'murasaki', 'pinku', 'shiro'))):
        c.R(x0, 2, 15, 3, K('conc', 2)); c.HL(x0, 2, 15, K('conc', 3)); box(c, x0 - 1, 1, 17, 18, OL)
        c.HL(x0, 4, 15, K('conc', 0))
        c.R(x0, 5, 15, 13, K('conc', 1)); c.VL(x0, 5, 13, K('conc', 3)); c.VL(x0 + 14, 5, 13, K('conc', -1))
        c.R(x0 + 1, 6, 13, 4, K('sumi', 0)); c.HL(x0 + 1, 6, 13, K('sumi', -1))                          # 버튼 띠
        for i, m in enumerate(cols):
            c.R(x0 + 2 + i * 3, 7, 2, 2, K(m, 1)); c.P(x0 + 2 + i * 3, 7, K(m, 2))
        c.R(x0 + 1, 11, 13, 6, K('conc', -2)); c.HL(x0 + 1, 11, 13, K('conc', -3))                     # 노즐 칸(들어감)
        for i in range(4): c.VL(x0 + 3 + i * 3, 11, 2, K('tekko', 1))
        c.HL(x0 + 1, 16, 13, K('tekko', 0))                                                             # 받침 철망
    # 커피 머신 + 컵 탑 + 얼음 통(x 33..46)
    c.R(34, 4, 7, 14, K('sumi', 1)); box(c, 33, 3, 9, 16, OL); c.HL(34, 4, 7, K('sumi', 1)); c.HL(34, 3, 7, K('conc', 0))
    c.R(35, 6, 5, 3, K('sora', -1)); c.HL(35, 6, 5, K('sora', 1))                                     # 화면(색만)
    c.R(36, 12, 3, 5, K('sumi', -1)); c.P(37, 12, K('tekko', 1))
    for i in range(3):                                                                                   # 뒤집은 컵 탑
        c.R(43, 9 + i * 3, 4, 3, K('garasu', 2)); c.HL(43, 9 + i * 3, 4, K('shiro', 1)); c.P(46, 10 + i * 3, K('garasu', 0))
    c.R(42, 6, 5, 3, K('shiro', 1)); box(c, 42, 6, 5, 3, K('conc', -2))
    # 카운터
    counter_body(c, 0, yb, W, top='shiro', front='kinari', ft=0)
    c.R(4, yb + 1, 8, 2, K('garasu', 1)); c.HL(4, yb + 1, 8, K('shiro', 2))                           # 컵 물빠짐 판
    c.R(20, yb + 1, 8, 2, K('garasu', 1)); c.HL(20, yb + 1, 8, K('shiro', 2))
    c.R(41, yb, 6, 4, K('sora', 0)); box(c, 41, yb, 6, 4, K('conc', -2)); c.P(42, yb + 1, K('shiro', 2)); c.P(44, yb + 2, K('shiro', 2))   # 얼음
    box(c, 0, yb, W, 16, OL)


@O('fr-soup-bar', '수프 바', w=1, h=1, up=16, kind='floor', use=('open',),
   tags=('패밀리 레스토랑', '수프 바', '드링크 바'),
   desc='셀프 수프 바(1×1) — 작은 흰 카운터 위에 검은 수프 보온 냄비(둥근 뚜껑·국자)와 수프 그릇 더미. 드링크 바 앞이나 옆, 사방에서 닿는 자리에.')
def _(c):
    yb = 16
    c.R(2, 6, 12, 9, K('tekko', -1)); c.VL(2, 6, 9, K('tekko', 1)); c.VL(3, 6, 9, K('tekko', 0)); c.VL(13, 6, 9, K('tekko', -3))   # 냄비 몸통
    c.VL(1, 6, 9, OL); c.VL(14, 6, 9, OL); c.HL(2, 15, 12, OL)
    ell(c, 8, 5.5, 6.5, 2.6, 'tekko', olc=OL)                                                          # 둥근 뚜껑
    c.R(7, 2, 2, 2, K('tekko', 2)); c.P(7, 2, K('tekko', 3))
    c.HL(3, 9, 10, K('tekko', -2)); c.R(6, 11, 4, 2, K('daidai', 0)); c.P(6, 11, K('daidai', 2))        # 손잡이 띠·표시등
    c.VL(12, 0, 5, K('tekko', 2)); c.P(13, 0, K('tekko', 1))                                            # 국자 손잡이
    counter_body(c, 0, yb, 16, top='shiro', front='kinari', doors=False)
    for i in range(2): c.R(9, yb - 1 + i * 2, 6, 2, K('shiro', 2 - i)); c.HL(9, yb + i * 2, 6, K('conc', 1))   # 그릇 더미
    c.R(3, yb + 8, 10, 5, K('kinari', -1)); box(c, 3, yb + 8, 10, 5, K('kinari', -2))
    box(c, 0, yb, 16, 16, OL)


@O('fr-dessert-case', '디저트 냉장 진열장', w=1, h=1, up=16, kind='floor', use=('open',),
   tags=('패밀리 레스토랑', '디저트', '진열', '계산대'),
   desc='계산대 옆 작은 디저트 냉장 진열장(1×1). 불 켜진 유리 칸 두 단에 파르페 잔·조각 케이크·푸딩, 아래는 은색 냉장 몸통과 통풍 줄. 계산대 곁에.')
def _(c):
    yb = 16
    c.R(1, 1, 14, 2, K('conc', 1)); c.HL(1, 1, 14, K('conc', 3)); box(c, 0, 0, 16, 32, OL)
    c.R(1, 3, 14, 17, K('garasu', 2)); c.VL(1, 3, 17, K('shiro', 2)); c.HL(1, 3, 14, K('mado', 1))     # 불 켜진 안쪽
    # 위 단: 파르페 잔 둘
    for x in (3, 9):
        c.R(x + 1, 4, 3, 2, K('shiro', 2)); c.P(x + 2, 4, K('aka', 1))
        c.R(x + 1, 6, 3, 3, K('pinku', 0)); c.HL(x + 1, 7, 3, K('kii', 1)); c.HL(x + 1, 8, 3, K('soil', -1))
        c.P(x + 2, 9, K('garasu', 0)); c.HL(x + 1, 10, 3, K('garasu', 0))
    c.HL(1, 11, 14, K('conc', 0)); c.HL(1, 12, 14, K('garasu', 1))
    # 아래 단: 조각 케이크 + 푸딩
    c.R(3, 14, 5, 3, K('shiro', 1)); c.HL(3, 14, 5, K('shiro', 2)); c.HL(3, 16, 5, K('kii', 0)); c.P(4, 13, K('aka', 1))
    c.R(10, 14, 3, 3, K('kii', 1)); c.HL(10, 14, 3, K('soil', -1)); c.HL(10, 16, 3, K('kii', -1))
    c.HL(1, 18, 14, K('conc', 0)); c.HL(1, 19, 14, K('garasu', 0))
    c.R(1, 20, 14, 2, K('conc', 1)); c.HL(1, 20, 14, K('shiro', 1))                                     # 앞 유리틀 윗면
    c.R(1, 22, 14, 9, K('conc', 0)); c.VL(1, 22, 9, K('conc', 2)); c.VL(14, 22, 9, K('conc', -2))
    for y in (25, 27): c.HL(3, y, 10, K('conc', -2))                                                   # 통풍 줄
    c.HL(1, 30, 14, K('tekko', -2))


@O('fr-register', '패밀리 레스토랑 계산대', w=1, h=1, up=16, kind='floor', use=('counter',),
   tags=('패밀리 레스토랑', '계산', '입구'),
   desc='입구 옆 작은 계산 카운터(1×1). 윗면에 금전 등록기(초록 점 화면)와 둥근 유리 사탕 통(알록달록 사탕), 앞판은 나무. 입구 바로 옆, 손님 쪽 두 줄을 비운다.')
def _(c):
    yb = 16
    c.R(2, 6, 8, 7, K('conc', 1)); box(c, 1, 5, 10, 9, OL); c.HL(2, 6, 8, K('conc', 3))
    c.R(3, 7, 6, 2, K('sumi', 0)); c.HL(4, 7, 3, K('midori', 1))                                         # 화면
    for q in range(3): c.P(3 + q * 2, 11, K('conc', 3))
    ell(c, 12.5, 9.5, 3, 4, 'garasu', olc=K('garasu', -2), hi=False)                                   # 사탕 통
    for (x, y, m) in ((11, 9, 'aka'), (13, 10, 'kii'), (12, 11, 'midori'), (14, 8, 'pinku'), (11, 12, 'sora')): c.P(x, y, K(m, 1))
    c.R(11, 4, 4, 2, K('aka', 0)); c.HL(11, 4, 4, K('aka', 2))                                          # 뚜껑
    counter_body(c, 0, yb, 16, top='kinari', front='ita', doors=False, ft=0)
    c.R(3, yb + 8, 10, 5, K('ita', -1)); box(c, 3, yb + 8, 10, 5, K('ita', -3)); c.P(7, yb + 10, K('tekko', 1))
    box(c, 0, yb, 16, 16, OL)


@O('fr-waiting-bench', '대기 의자', w=2, h=1, up=4, kind='floor', use=('sit',),
   tags=('패밀리 레스토랑', '대기', '입구', '의자'),
   desc='입구 안쪽 대기 의자(2×1) — 붉은 비닐 방석을 얹은 등받이 없는 긴 의자, 은색 다리. 자리가 나기를 기다리는 손님용. 입구 옆 벽을 따라.')
def _(c):
    W = 32
    c.R(1, 1, W - 2, 6, K(VINYL, 1)); c.HL(1, 1, W - 2, K(VINYL, 2)); c.VL(1, 1, 6, K(VINYL, 2))
    box(c, 0, 0, W, 9, OL)
    c.VL(16, 2, 4, K(VINYL, 0)); c.HL(1, 6, W - 2, K(VINYL, -1))
    c.R(1, 7, W - 2, 2, K(VINYL, -1)); c.HL(1, 8, W - 2, K(VINYL, -2))                                 # 방석 앞날
    c.R(1, 9, W - 2, 2, K('tekko', 0)); c.HL(1, 9, W - 2, K('tekko', 2))                                # 철 틀
    for x in (2, 14, 26):
        c.R(x, 11, 3, 8, K('tekko', 1)); c.VL(x, 11, 8, K('tekko', 3)); c.VL(x + 2, 11, 8, K('tekko', -2))
    c.HL(1, 19, W - 2, K('yuka', -2))


@O('fr-kids-chair', '아이 의자', w=1, h=1, up=0, kind='floor', use=('sit',), facing='N',
   tags=('패밀리 레스토랑', '아이', '의자'),
   desc='탁자 끝에 붙이는 높은 아이 의자(1×1, 북쪽 탁자를 본다). 남쪽에서 연한 나무 등판 뒷면과 앞으로 내민 흰 식판 끝, 길게 벌어진 네 다리와 발판이 보인다.')
def _(c):
    c.R(4, 0, 8, 2, K('kinari', 2)); c.HL(5, 0, 6, K('shiro', 2)); box(c, 3, 0, 10, 2, OL)                 # 식판 끝(북쪽으로 내밂)
    c.R(4, 2, 8, 6, K('yuka', 1)); box(c, 3, 2, 10, 7, OL); c.HL(4, 2, 8, K('yuka', 2)); c.VL(4, 3, 5, K('yuka', 2))
    c.HL(5, 5, 6, K('yuka', -1))                                                                         # 등판 가로 살
    c.R(3, 9, 10, 2, K('yuka', 0)); c.HL(3, 9, 10, K('yuka', 2)); c.HL(3, 10, 10, K('yuka', -2))         # 좌판 앞날
    for x, dx in ((3, 0), (11, 1)):
        for y in range(11, 16): c.P(x - (y - 11) // 3 if dx == 0 else x + (y - 11) // 3, y, K('ita', -1))
        for y in range(11, 16): c.P(x + 1 - (y - 11) // 3 if dx == 0 else x + 1 + (y - 11) // 3, y, K('yuka', 0))
    c.HL(4, 13, 8, K('yuka', -1))                                                                        # 발판
    c.P(1, 15, OL); c.P(2, 15, OL); c.P(13, 15, OL); c.P(14, 15, OL)


@O('fr-pass-window', '주방 내주는 창', w=2, h=1, up=32, kind='wall', use=('counter',),
   tags=('패밀리 레스토랑', '주방', '내주는 창'),
   desc='주방 칸막이 벽에 뚫린 요리 내주는 창(2×1, 칸막이 벽 앞 첫 바닥 줄). 은색 창틀 안으로 어두운 주방과 주황 보온 램프 띠가 보이고, 은색 선반 위에 김 나는 접시 둘. 직원 문 옆에.')
def _(c):
    W = 32
    # 창틀(벽면 두 줄 높이 안: y 2..31)
    c.R(1, 3, W - 2, 26, K('tekko', -2)); box(c, 0, 2, W, 28, OL)
    c.HL(1, 3, W - 2, K('conc', 2)); c.VL(1, 3, 26, K('conc', 2)); c.VL(W - 2, 3, 26, K('conc', -1))
    c.R(3, 5, W - 6, 22, K('yoru', -2))                                                                # 주방 안(어둠)
    c.R(3, 5, W - 6, 2, K('sumi', -1))
    c.R(5, 7, W - 10, 2, K('daidai', 1)); c.HL(5, 7, W - 10, K('kii', 2))                               # 보온 램프
    for x in range(6, W - 6, 4): c.P(x, 9, K('daidai', 0)); c.P(x, 11, K('daidai', -1))                 # 램프 빛
    c.R(3, 18, W - 6, 1, K('tekko', -1))
    c.R(4, 12, 5, 5, K('kawara', -1)); c.HL(4, 12, 5, K('kawara', 0))                                   # 안쪽 기구 그림자
    c.R(23, 13, 5, 4, K('kawara', -1))
    # 접시 둘(선반 위)
    for x0 in (6, 18):
        ell(c, x0 + 4, 24, 4.5, 2.2, 'shiro', olc=K('conc', -1))
        c.R(x0 + 2, 22, 5, 2, K('daidai', -1)); c.HL(x0 + 2, 22, 5, K('daidai', 1)); c.P(x0 + 6, 22, K('midori', 1))
        for i, (dx, dy) in enumerate(((3, 20), (4, 18), (3, 16))): c.P(x0 + dx, dy, K('shiro', 0))   # 김
    c.R(1, 27, W - 2, 2, K('conc', 1))
    # 선반(발밑 칸): 은색 윗면 + 앞판
    yb = 32
    c.R(0, yb, W, 5, K('conc', 2)); c.HL(0, yb, W, K('conc', 3)); c.HL(0, yb + 4, W, K('conc', 0))
    c.R(0, yb + 5, W, 10, K('conc', 0)); c.HL(0, yb + 5, W, K('conc', -2)); c.VL(0, yb + 5, 10, K('conc', 1)); c.VL(W - 1, yb + 5, 10, K('conc', -2))
    c.VL(16, yb + 6, 8, K('conc', -1)); c.HL(0, yb + 15, W, K('tekko', -2)); box(c, 0, yb, W, 16, OL)


# ───────────────────────── 규동집 ─────────────────────────
@O('fr-counter-stool', '규동집 카운터 의자', w=1, h=1, up=0, kind='floor', cat='gyudon', cat_ko='규동집', use=('sit',),
   tags=('규동', '카운터', '스툴'),
   desc='ㄷ자 카운터 둘레의 둥근 스툴(1×1). 갈색 비닐 방석 + 은색 기둥 하나 + 둥근 받침. 카운터 바로 바깥 칸에 빈틈없이 줄지어 놓는다.')
def _(c):
    c.R(7, 8, 2, 6, K('conc', 1)); c.VL(7, 8, 6, K('conc', 3)); c.VL(8, 8, 6, K('conc', -1))
    ell(c, 8, 14, 5, 1.6, 'conc', olc=K('tekko', -2), hi=False)
    ell(c, 8, 5, 6, 3.6, 'soil', olc=OL)
    c.HL(5, 3, 4, K('soil', 2)); c.HL(3, 7, 10, K('soil', -2))
    c.HL(4, 8, 8, K('tekko', -1))


@O('fr-gyu-pot', '규동 소고기 냄비대', w=1, h=1, up=16, kind='wall', cat='gyudon', cat_ko='규동집', use=('open',),
   tags=('규동', '주방'),
   desc='규동집 주방 북쪽 벽 줄의 넓적한 소고기·양파 조림 냄비(갈색 국물에 고기 결·흰 양파) + 김, 아래는 은색 곤로대. 밥 보온통 옆에.')
def _(c):
    yb = 16
    for i, (x, y) in enumerate(((4, 4), (9, 2), (12, 5))):
        c.P(x, y, K('shiro', 1)); c.P(x + 1, y - 1, K('shiro', 0)); c.P(x, y - 2, K('shiro', 0))
    c.R(1, 8, 14, 7, K('conc', 1)); box(c, 0, 7, 16, 9, OL); c.HL(1, 8, 14, K('conc', 3))                # 냄비 테
    c.R(2, 9, 12, 5, K('soil', -1)); c.HL(2, 9, 12, K('soil', 0))                                         # 국물
    for (x, y) in ((3, 10), (6, 11), (9, 10), (11, 12), (4, 12)): c.HL(x, y, 2, K('renga', 0))          # 고기 결
    for (x, y) in ((5, 10), (8, 12), (12, 10)): c.P(x, y, K('kinari', 2))                               # 양파
    c.VL(14, 4, 5, K('tekko', 1)); c.P(15, 4, K('tekko', 2))                                              # 국자
    c.R(0, yb, 16, 4, K('conc', 2)); c.HL(0, yb, 16, K('conc', 3)); c.HL(0, yb + 3, 16, K('conc', -1))
    c.R(0, yb + 4, 16, 11, K('conc', 0)); c.VL(0, yb + 4, 11, K('conc', 2)); c.VL(15, yb + 4, 11, K('conc', -2))
    c.R(3, yb + 6, 10, 3, K('tekko', -2)); c.P(5, yb + 7, K('daidai', 1)); c.P(10, yb + 7, K('daidai', 1))   # 불 창
    c.VL(8, yb + 10, 4, K('conc', -1)); c.HL(0, yb + 15, 16, K('tekko', -2))


@O('fr-rice-jar', '밥 보온통', w=1, h=1, up=16, kind='wall', cat='gyudon', cat_ko='규동집', use=('open',),
   tags=('규동', '주방', '밥'),
   desc='규동집 주방 북쪽 벽 줄의 은색 업소용 밥 보온통 둘(둥근 뚜껑·주황 표시등)과 주걱, 아래는 수납장. 소고기 냄비대 옆에.')
def _(c):
    yb = 16
    for x0 in (1, 8):
        c.R(x0, 4, 7, 12, K('conc', 1)); box(c, x0, 3, 7, 13, OL)
        c.HL(x0 + 1, 4, 5, K('conc', 3)); c.VL(x0 + 1, 5, 10, K('conc', 2)); c.VL(x0 + 5, 5, 10, K('conc', -1))
        c.R(x0 + 2, 2, 3, 1, K('tekko', 0)); c.HL(x0 + 1, 7, 5, K('conc', -1))
        c.P(x0 + 3, 11, K('daidai', 1))
    c.VL(14, 10, 6, K('kinari', 1)); c.R(14, 8, 2, 3, K('kinari', 2))                                      # 주걱
    counter_body(c, 0, yb, 16, top='conc', front='conc', doors=True, ft=0)
    box(c, 0, yb, 16, 16, OL)


# ───────────────────────── 탁상 물건 ─────────────────────────
@R.good('fr-call-button', '호출 버튼', desc='패밀리 레스토랑 탁자 위 호출 버튼(흰 받침에 붉은 둥근 단추) + 접어 세운 작은 메뉴판(색 띠만).')
def _(c):
    c.R(2, 1, 6, 8, K('kinari', 1)); box(c, 2, 1, 6, 8, K('ita', -2)); c.HL(3, 3, 4, K('aka', 0)); c.HL(3, 5, 4, K('midori', 0)); c.HL(3, 7, 3, K('kii', 0))
    c.HL(2, 9, 6, K('kinari', -2))
    c.R(9, 5, 6, 4, K('shiro', 1)); box(c, 9, 5, 6, 4, K('conc', -2)); c.HL(10, 5, 4, K('shiro', 2))
    c.R(11, 4, 2, 2, K('aka', 1)); c.P(11, 4, K('aka', 2)); c.HL(9, 9, 6, K('conc', -1))


@R.good('fr-tea-pot', '찻주전자와 찻잔', desc='규동집 카운터 위 셀프 차 — 갈색 플라스틱 찻주전자(뚜껑·주둥이) + 흰 찻잔 하나.')
def _(c):
    ell(c, 6, 5, 4, 3.5, 'soil', olc=K('soil', -2))
    c.R(4, 1, 4, 2, K('soil', 1)); c.HL(4, 1, 4, K('soil', 2)); c.P(5, 0, K('soil', 0)); c.P(6, 0, K('soil', 0))
    c.P(10, 4, K('soil', 0)); c.P(11, 3, K('soil', 0))
    c.R(11, 6, 4, 3, K('shiro', 1)); c.HL(11, 6, 4, K('shiro', 2)); c.HL(11, 7, 4, K('midori', -1)); c.HL(11, 9, 4, K('conc', -1))


@R.good('fr-gyudon', '규동 한 그릇', desc='주황 테두리 덮밥 그릇에 흰 밥 위 갈색 소고기·양파, 붉은 초생강 한 점, 옆에 미소국 그릇.')
def _(c):
    ell(c, 6.5, 5, 5.5, 3.6, 'daidai', olc=K('daidai', -2))
    c.R(3, 3, 8, 3, K('soil', 0)); c.HL(3, 3, 8, K('soil', 1)); c.HL(4, 4, 2, K('renga', 0)); c.HL(8, 5, 2, K('renga', 0)); c.P(6, 4, K('kinari', 2))
    c.P(10, 3, K('aka', 1)); c.P(9, 2, K('aka', 2))
    c.HL(3, 8, 7, K('daidai', -2))
    ell(c, 13, 6, 2.5, 2, 'aka', olc=K('aka', -2), hi=False); c.HL(12, 5, 2, K('soil', -1))


@R.good('fr-condiment', '규동 양념 통', desc='카운터 위 양념 — 붉은 초생강 통(뚜껑), 시치미 작은 원통, 간장병.')
def _(c):
    c.R(1, 3, 6, 6, K('aka', 0)); box(c, 1, 3, 6, 6, K('aka', -2)); c.HL(2, 4, 4, K('aka', 2)); c.R(1, 1, 6, 2, K('shiro', 1)); c.HL(1, 1, 6, K('shiro', 2))
    c.R(8, 4, 3, 5, K('kii', 0)); c.VL(8, 4, 5, K('kii', 2)); c.R(8, 2, 3, 2, K('aka', 1)); c.HL(8, 9, 3, K('kii', -2))
    c.R(12, 3, 3, 6, K('renga', -2)); c.VL(12, 3, 6, K('renga', 0)); c.R(12, 1, 3, 2, K('aka', 0)); c.HL(12, 9, 3, K('sumi', 0))


# 놓는 법(조수가 읽는 placementRules)
PLACE = {
    'fr-booth-s': '박스석 탁자 바로 북쪽 칸(남쪽 탁자를 본다). 창가·벽을 따라 남향 벤치 — 탁자 — 북향 벤치를 세로로 쌓고, 다음 박스석과는 칸막이 화분 한 줄을 사이에 둔다. 벤치 동쪽(또는 서쪽) 끝에 2칸 통로가 닿아야 앉을 수 있다.',
    'fr-booth-n': '박스석 탁자 바로 남쪽 칸(북쪽 탁자를 본다). 위로 솟지 않으니 탁자 위 물건과 겹치지 않는다.',
    'fr-booth-divider': '등을 맞댄 두 박스석 사이 줄(북향 벤치 바로 남쪽, 다음 남향 벤치 바로 북쪽)에 같은 폭으로.',
    'fr-drink-bar': '객석 쪽 북쪽 벽(또는 주방 칸막이 벽) 바로 아래 첫 바닥 줄, 3칸. 앞에 손님이 설 두 줄을 비우고 수프 바를 곁에 둔다.',
    'fr-soup-bar': '드링크 바 앞이나 곁 바닥 한 칸(사방에서 닿는 섬처럼).',
    'fr-dessert-case': '계산대 바로 옆(입구 쪽), 손님 쪽 칸을 비운다.',
    'fr-register': '입구 바로 옆 맨 아래 벽 줄 — 손님 쪽(입구 쪽) 두 칸을 비운다. 곁에 디저트 진열장, 입구 반대쪽에 대기 의자.',
    'fr-waiting-bench': '입구 안쪽 벽을 따라(계산대 맞은편), 출입구 칸을 막지 않게.',
    'fr-kids-chair': '탁자 남쪽 끝 칸(북쪽 탁자를 본다) — 4인 탁자 곁에 하나.',
    'fr-pass-window': '주방 칸막이 벽의 객석 쪽 첫 바닥 줄(2칸), 주방 직원 문 바로 옆.',
    'fr-counter-stool': '규동집 ㄷ자 카운터 바깥 칸에 한 줄로(카운터를 본다). 의자 뒤 1칸 통로를 남긴다.',
    'fr-gyu-pot': '규동집 주방 북쪽 벽 줄(카운터 안쪽에서 닿는 곳), 밥 보온통 옆.',
    'fr-rice-jar': '규동집 주방 북쪽 벽 줄, 소고기 냄비대 옆.',
}
for _id, _t in PLACE.items(): R.objs[_id]['place'] = _t


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
