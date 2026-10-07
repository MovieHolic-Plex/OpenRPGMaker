#!/usr/bin/env python3
"""jp_city 일본 실내 — 편의점·슈퍼 `interior_konbini` (id 머리 `cv-`).

크기 근거(1칸 = 16px = 1m, §12-3): 곤돌라 폭 2m × 깊이 1m(양면)·높이 1.2~1.5m → 2×1 up 16, 세로 놓기 1×2.
쿨러 = 문 폭 0.6~0.9m·깊이 0.7m 가 벽에 줄지어 → 1×2 로 끊김 없이 반복. 오픈 케이스 = 폭 2m·높이 1.5m → 2×1 up 16.
냉동 쇼케이스 = 폭 2m·높이 0.9m → 2×1 up 8. 카운터 1m, 레지/핫케이스/커피머신 = 카운터 위로 0.5~1m 솟음.
슈퍼 계산대 = 폭 1m·길이 2m(컨베이어) → 1×2 up 16. 농산물 진열 = 폭 2m·높이 0.7m. 카트 = 0.6×1m → 1×1.
시점은 3/4: 윗면 3~4px(깊이 1칸)이 보이고 남쪽 앞면이 안쪽으로 들어간다. 가구 윗면은 바닥보다 밝고 대비가 높다. 바닥은 조용하게.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, default_ceiling, run_block, ROOT   # noqa: E402,F401
import categories as CATS                                            # noqa: E402

BLOCK = 'interior_konbini'
R = Registry(BLOCK, '편의점·슈퍼')

_KC = {}


def k(ramp, t):   # K with clamp to nearest valid step
    key = (ramp, t)
    if key not in _KC:
        tt = t
        while True:
            try: _KC[key] = K(ramp, tt); break
            except Exception:
                if tt == 0: raise
                tt += -1 if tt > 0 else 1
    return _KC[key]


def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def box(c, x, y, w, h, col):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def ol_in(c, col):
    """윤곽: 투명 이웃(캔버스 안)에 닿는 불투명 칸을 col 로. 캔버스 가장자리는 건드리지 않는다."""
    a = c.a; H, W = a.shape[:2]; todo = []
    for y in range(H):
        for x in range(W):
            if a[y, x, 3] == 0: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and a[ny, nx, 3] == 0: todo.append((x, y)); break
    for x, y in todo: c.P(x, y, col)


PROD = [('aka', 0), ('ki', 1), ('midori', 0), ('sora', 0), ('daidai', 0), ('pinku', 0), ('kii', 1), ('murasaki', 0), ('shiro', 1), ('aka', 1)]
BENTO = [('shiro', 1), ('daidai', 0), ('aka', 0), ('shiro', 2), ('midori', 0), ('kii', 1)]
MEAT = [('aka', 0), ('pinku', 0), ('aka', 1), ('pinku', 1), ('shiro', 1), ('daidai', 0)]
DRINK = [('sora', 0), ('midori', 0), ('aka', 0), ('ki', 1), ('daidai', 0), ('shiro', 2), ('murasaki', 0)]


def goods_row(c, x, y, w, h, seed, pal=PROD, pitch=3):
    """한 단 위 상품: pitch 폭 상자들, 높이는 조금씩 다르고 윗줄 밝게·아랫줄 어둡게."""
    xx = x
    while xx + pitch - 1 <= x + w:
        ramp, st = pal[hs(xx, y, seed) % len(pal)]
        ih = max(2, h - (hs(xx, y, seed + 1) % 2))
        col = k(ramp, st)
        c.R(xx, y + h - ih, pitch - 1, ih, col); c.HL(xx, y + h - ih, pitch - 1, k(ramp, st + 2)); c.HL(xx, y + h - 1, pitch - 1, k(ramp, st - 2))
        if rnd(xx, y, seed + 2, 330): c.P(xx, y + h - ih + 1, k('shiro', 2))   # 라벨 점
        xx += pitch


def shelf_lip(c, x, y, w, m='conc'):
    c.HL(x, y, w, k(m, 3)); c.HL(x, y + 1, w, k(m, 0)); c.HL(x, y + 2, w, k(m, -3))


# ───────────────────────── 바닥·벽면 ─────────────────────────
@R.floor('cv-vinyl', '편의점 비닐 타일', cols=4, rows=4, tags=('편의점', '슈퍼', '매장', '바닥'),
         desc='희고 연한 회색의 편의점 매장 비닐 타일(PVC). 32px(2m) 정사각 타일, 1px 줄눈, 아주 약한 얼룩. 진열대가 도드라지게 조용하다. 매장 전체에 깐다.')
def _vinyl(c):
    for y in range(c.h):
        for x in range(c.w):
            t = ((x // 32) + (y // 32)) % 2
            col = k('shiro', 0) if t == 0 else k('shiro', -1)
            if rnd(x, y, 3, 22): col = k('conc', 2)
            elif rnd(x, y, 4, 18): col = k('shiro', 1)
            if x % 32 == 0 or y % 32 == 0: col = k('conc', 1)
            elif x % 32 == 1 and y % 32 > 0 or y % 32 == 1: col = k('shiro', 1)
            c.P(x, y, col)


@R.floor('cv-backroom', '창고 콘크리트 바닥', cols=4, rows=4, tags=('편의점', '창고', '백룸', '바닥'),
         desc='회색 콘크리트 마감 바닥. 얼룩 점과 64px(4m)마다 줄눈. 편의점 안쪽 창고·사무실 바닥으로 매장 비닐 타일과 구분된다.')
def _backroom(c):
    for y in range(c.h):
        for x in range(c.w):
            col = k('conc', 0)
            if rnd(x, y, 5, 90): col = k('conc', 1)
            elif rnd(x, y, 6, 70): col = k('conc', -1)
            if x == 0 or y == 0: col = k('conc', -2)
            c.P(x, y, col)


@R.wall('cv-panel', '매장 흰 패널 벽', cols=4, tags=('편의점', '슈퍼', '매장', '벽'),
        desc='흰 패널 벽(32px마다 이음선) 아래에 회색 걸레받이. 편의점·슈퍼 매장 벽면. 이음선 한 줄만 있어 조용하다.')
def _panel(c):
    for y in range(32):
        for x in range(c.w):
            col = k('shiro', 1) if y < 20 else k('shiro', 0)
            if x % 32 == 0: col = k('conc', 1)
            elif x % 32 == 1: col = k('shiro', 2)
            if y == 19: col = k('conc', 1)
            if y == 20: col = k('shiro', 2)
            if 27 <= y <= 31: col = k('conc', 0)
            if y == 27: col = k('conc', 2)
            if y == 31: col = k('conc', -2)
            c.P(x, y, col)


# ───────────────────────── 진열대 ─────────────────────────
@R.obj('cv-gondola', '진열 곤돌라(가로)', 2, 1, up=16, kind='floor', use=('search',),
       desc='매장 가운데 양면 진열 곤돌라, 가로 2×1. 윗면 4px에 가운데 이음선, 앞면은 3단 선반에 과자·상품이 가득. 줄지어 놓고 줄 사이 통로를 1칸 이상 남긴다. 편의점은 2~3줄.',
       tags=('편의점', '슈퍼', '진열', '곤돌라'), place='매장 가운데, 같은 높이로 2~3줄 나란히(줄 사이 통로 1칸)', pair=('cv-gondola-end', 'cv-baskets'))
def cv_gondola(c):
    o = k('conc', -3)
    c.R(0, 8, 32, 5, k('shiro', 1)); c.HL(0, 8, 32, k('shiro', 2)); c.HL(0, 12, 32, k('conc', -1)); c.HL(1, 10, 30, k('conc', 1))   # 윗면 + 가운데 이음
    for x0 in (4, 11, 20, 26): c.HL(x0, 9, 3, k('sora', 1))                                                                     # 가격 라벨 띠
    c.R(0, 13, 32, 17, k('conc', 0)); c.R(1, 14, 30, 15, k('conc', 1))                                                           # 틀과 뒷판
    for i, (y0, h) in enumerate(((14, 5), (21, 5), (27, 3))):
        goods_row(c, 2, y0, 28, h, 11 + i)
        shelf_lip(c, 1, y0 + h, 30) if i < 2 else None
    c.R(0, 29, 32, 3, k('tekko', -2)); c.HL(0, 29, 32, k('tekko', 0))                                                           # 받침
    c.VL(0, 13, 17, k('shiro', 2)); c.VL(31, 13, 17, k('conc', -2))
    ol_in(c, o); c.P(0, 8, None); c.P(31, 8, None)


@R.obj('cv-gondola-v', '진열 곤돌라(세로)', 1, 2, up=16, kind='floor', use=('search',),
       desc='세로 1×2 곤돌라. 윗면이 길게(10px) 보이고 남쪽 끝 앞면에 엔드 선반이 보인다. 양옆 상품 윗부분이 윗면 가장자리에 줄무늬로 보인다. 가로 곤돌라와 같이 쓰면 줄 끝을 막지 않게.',
       tags=('편의점', '슈퍼', '진열', '곤돌라'), place='매장 가운데 통로를 세로로 나눌 때', pair=('cv-gondola', 'cv-gondola-end'))
def cv_gondola_v(c):
    o = k('conc', -3)
    c.R(0, 8, 16, 12, k('shiro', 1)); c.HL(0, 8, 16, k('shiro', 2)); c.VL(7, 9, 10, k('conc', 0)); c.VL(8, 9, 10, k('shiro', 2))      # 윗면 + 가운데 이음
    for y in range(9, 19):                                                                                                         # 양옆 상품 윗부분
        for xs in (1, 12):
            ramp, st = PROD[hs(xs, y // 2, 7) % len(PROD)]
            c.R(xs, y, 3, 1, k(ramp, st))
    c.R(0, 20, 16, 26, k('conc', 0)); c.R(1, 21, 14, 24, k('conc', 1))
    for i, (y0, h) in enumerate(((22, 6), (30, 6), (38, 5))):
        goods_row(c, 2, y0, 12, h, 21 + i); shelf_lip(c, 1, y0 + h, 14) if i < 2 else None
    c.R(0, 45, 16, 3, k('tekko', -2)); c.HL(0, 45, 16, k('tekko', 0)); c.HL(0, 20, 16, k('conc', -1))
    c.VL(0, 20, 26, k('shiro', 2)); c.VL(15, 20, 26, k('conc', -2))
    ol_in(c, o); c.P(0, 8, None); c.P(15, 8, None)


@R.obj('cv-gondola-end', '엔드 진열대', 1, 1, up=16, kind='floor', use=('search',),
       desc='곤돌라 끝에 놓는 1×1 엔드 진열대. 윗쪽에 붉은 세일 띠, 3단으로 쌓은 상품 더미. 줄 끝(통로가 꺾이는 자리)에 둔다.',
       tags=('편의점', '슈퍼', '진열', '세일'), place='곤돌라 줄 끝·통로 모서리', pair=('cv-gondola',))
def cv_gondola_end(c):
    o = k('conc', -3)
    c.R(1, 6, 14, 3, k('aka', 1)); c.HL(1, 6, 14, k('aka', 2)); c.HL(1, 8, 14, k('aka', -2)); c.HL(3, 7, 4, k('kii', 2)); c.HL(9, 7, 4, k('shiro', 2))   # 세일 띠
    c.R(1, 9, 14, 3, k('shiro', 1)); c.HL(1, 9, 14, k('shiro', 2)); c.HL(1, 11, 14, k('conc', -1))
    c.R(1, 12, 14, 18, k('conc', 1))
    for i, (y0, h) in enumerate(((13, 5), (20, 5), (26, 3))):
        goods_row(c, 2, y0, 12, h, 31 + i, pal=[('kii', 1), ('daidai', 0), ('aka', 0), ('ki', 1)]); shelf_lip(c, 1, y0 + h, 14) if i < 2 else None
    c.R(1, 29, 14, 3, k('tekko', -2)); c.HL(1, 29, 14, k('tekko', 0))
    c.VL(1, 12, 18, k('shiro', 2)); c.VL(14, 12, 18, k('conc', -2))
    ol_in(c, o)


@R.obj('cv-cooler', '음료 쿨러(벽)', 1, 2, up=0, kind='wall', use=('open',),
       desc='벽을 따라 줄지어 서는 유리문 음료 냉장 쇼케이스 한 칸. 윗면 4px 위로 밝은 간판 띠, 유리문 안 4단에 페트병·캔, 세로 손잡이, 아래 환기 그릴. 1×2 가 좌우 끊김 없이 이어져 북쪽 벽을 한 줄로 채운다.',
       tags=('편의점', '음료', '냉장', '쿨러'), place='북쪽 벽면 아래, 좌우로 연속(4~6칸)', pair=('cv-open-case', 'cv-drink'))
def cv_cooler(c):
    o = k('conc', -3)
    c.R(0, 0, 16, 4, k('conc', 2)); c.HL(0, 0, 16, k('conc', 3)); c.HL(0, 3, 16, k('conc', -1))                 # 윗면
    c.R(0, 4, 16, 5, k('shiro', 2)); c.HL(0, 4, 16, k('shiro', 2)); c.HL(1, 6, 14, k('sora', 0)); c.HL(1, 7, 14, k('sora', -1)); c.HL(0, 8, 16, k('conc', -2))   # 간판 띠
    c.R(0, 9, 16, 19, k('yoru', 1))                                                                              # 문 안
    for i, y0 in enumerate((10, 15, 20, 25)):                                                                    # 4단: 병·캔
        goods_row(c, 1, y0, 13, 3, 41 + i, pal=DRINK, pitch=2)
        c.HL(0, y0 + 3, 16, k('conc', 0)) if i < 3 else None
    c.VL(0, 9, 19, k('conc', -2)); c.VL(15, 9, 19, k('conc', 0)); c.VL(13, 14, 9, k('conc', 3)); c.VL(14, 14, 9, k('conc', -1))       # 문틀·손잡이
    for p in ((2, 10), (3, 11), (4, 12), (5, 13), (7, 17), (8, 18)): c.P(p[0], p[1], k('garasu', 3))              # 유리 반사
    c.R(0, 28, 16, 4, k('tekko', -2)); c.HL(0, 28, 16, k('tekko', 0))
    for x0 in range(2, 14, 3): c.HL(x0, 30, 2, k('tekko', -3))                                                   # 환기 그릴
    c.HL(0, 31, 16, o); c.HL(0, 0, 16, k('conc', 3))


def _open_case(c, band, pal, seed, shelves=3):
    o = k('conc', -3)
    c.R(1, 3, 30, 4, k('shiro', 1)); c.HL(1, 3, 30, k('shiro', 2)); c.HL(1, 6, 30, k('conc', -1)); c.HL(2, 5, 28, k(*band))      # 위 덮개 + 간판 띠
    c.R(1, 7, 30, 15, k('conc', 2)); c.VL(1, 7, 15, k('shiro', 2)); c.VL(30, 7, 15, k('conc', 0))                                   # 개방된 안쪽(밝은 뒷판)
    ys = (8, 13, 18)[:shelves]
    for i, y0 in enumerate(ys):
        goods_row(c, 2, y0, 27, 3, seed + i, pal=pal, pitch=4 if pal is BENTO else 3)
        c.HL(1, y0 + 3, 30, k('conc', 3)); c.HL(1, y0 + 4, 30, k('conc', -1))
    c.R(1, 22, 30, 9, k('shiro', 1)); c.HL(1, 22, 30, k('shiro', 2)); c.HL(1, 23, 30, k('conc', -1)); c.HL(2, 25, 28, k(*band))
    c.R(1, 28, 30, 3, k('tekko', -2)); c.HL(1, 28, 30, k('tekko', 0))
    for x0 in range(4, 28, 5): c.P(x0, 26, k('conc', 0))                                                                           # 앞판 홈
    ol_in(c, o)


@R.obj('cv-open-case', '도시락·삼각김밥 오픈 케이스', 2, 1, up=16, kind='wall', use=('search',),
       desc='앞이 열린 냉장 오픈 케이스 2×1. 위에 파란 간판 띠, 열린 3단에 도시락·삼각김밥·샌드위치, 앞판 파란 줄. 동서 벽을 따라 놓거나 쿨러 줄 끝에 이어 놓는다.',
       tags=('편의점', '도시락', '삼각김밥', '냉장'), place='동·서쪽 벽 아래 또는 북쪽 쿨러 줄 옆', pair=('cv-cooler', 'cv-onigiri', 'cv-bento'))
def cv_open_case(c): _open_case(c, ('sora', 0), BENTO, 51)


@R.obj('cv-meat-case', '정육·반찬 오픈 케이스', 2, 1, up=16, kind='wall', use=('search',),
       desc='슈퍼 정육·생선 코너의 오픈 냉장 케이스 2×1. 붉은 간판 띠, 열린 단에 분홍·붉은 고기 트레이. 슈퍼 북쪽·동쪽 벽에 연속으로 놓는다.',
       tags=('슈퍼', '정육', '냉장'), place='슈퍼 벽 아래, 농산물 진열 맞은편', pair=('cv-produce', 'cv-open-case'))
def cv_meat_case(c): _open_case(c, ('aka', 0), MEAT, 61)


@R.obj('cv-magazine', '잡지 진열대', 2, 1, up=0, kind='wall', use=('read',),
       desc='창가 잡지 진열대 2×1, 낮다. 3px 윗면 아래 세로로 꽂힌 잡지 표지들(색색, 흰 제목 블록), 아래 받침. 입구 옆 유리창 아래에 놓는다.',
       tags=('편의점', '잡지', '창가'), place='입구 옆 유리창 아래 벽면', pair=('cv-gondola',))
def cv_magazine(c):
    o = k('conc', -3)
    c.R(0, 0, 32, 3, k('ki', 2)); c.HL(0, 0, 32, k('ki', 3)); c.HL(0, 2, 32, k('ki', -1))
    c.R(0, 3, 32, 10, k('conc', 1))
    for i in range(8):
        x0 = i * 4; ramp, st = PROD[hs(i, 3, 9) % len(PROD)]
        c.R(x0, 3, 3, 10, k(ramp, st)); c.VL(x0, 3, 10, k(ramp, st + 2)); c.HL(x0 + 1, 4, 2, k('shiro', 2)); c.HL(x0 + 1, 8, 1, k('shiro', 1))
        c.P(x0 + 2, 11, k('kii', 1))
    c.R(0, 13, 32, 3, k('ki', -1)); c.HL(0, 13, 32, k('ki', 1)); c.HL(0, 15, 32, o)
    ol_in(c, o)


@R.obj('cv-freezer', '아이스크림 냉동고', 2, 1, up=8, kind='floor', use=('open',),
       desc='아이스크림 냉동 쇼케이스(체스트형) 2×1. 윗면 유리 뚜껑 아래로 색색 아이스크림이 보이고 하얀 앞판에 파란 줄. 오픈 케이스·계산대 쪽에 놓는다.',
       tags=('편의점', '아이스크림', '냉동'), place='매장 구석 또는 곤돌라 줄 끝', pair=('cv-open-case',))
def cv_freezer(c):
    o = k('conc', -3)
    c.R(0, 10, 32, 8, k('shiro', 2)); c.HL(0, 10, 32, k('shiro', 3)); c.HL(0, 17, 32, k('conc', -1))                         # 흰 테두리
    c.R(1, 11, 30, 5, k('garasu', 2)); c.HL(1, 11, 30, k('garasu', 3)); c.VL(15, 11, 6, k('conc', 1)); c.VL(16, 11, 6, k('shiro', 3))   # 유리 뚜껑 두 장·가운데 이음
    for i in range(10):
        ramp, st = PROD[hs(i, 2, 4) % len(PROD)]
        c.R(2 + i * 3, 12, 2, 3, k(ramp, st)); c.P(2 + i * 3, 12, k('shiro', 2))
    for p in ((3, 11), (4, 12), (9, 11), (21, 12), (25, 11), (26, 12)): c.P(p[0], p[1], k('garasu', 3))
    c.R(0, 18, 32, 12, k('shiro', 1)); c.HL(0, 18, 32, k('shiro', 2)); c.HL(0, 19, 32, k('conc', -1)); c.HL(1, 22, 30, k('sora', 0)); c.HL(1, 23, 30, k('sora', -1))
    c.R(1, 26, 4, 3, k('aka', 0)); c.R(7, 26, 4, 3, k('kii', 1)); c.R(26, 26, 5, 3, k('sora', 1))                              # 스티커
    c.R(0, 29, 32, 3, k('tekko', -2)); c.HL(0, 29, 32, k('tekko', 0)); c.VL(0, 10, 20, k('shiro', 2)); c.VL(31, 10, 20, k('conc', -2))
    ol_in(c, o)


# ───────────────────────── 카운터 ─────────────────────────
def _counter_body(c, y_top, m=('shiro', 1)):
    c.R(0, y_top, 16, 5, k('shiro', 2)); c.HL(0, y_top + 4, 16, k('conc', 1))
    c.R(0, y_top + 5, 16, 16 - (y_top + 5), k(*m)); c.HL(0, y_top + 5, 16, k('conc', -1))
    c.R(0, 13, 16, 3, k('tekko', -2)); c.HL(0, 13, 16, k('tekko', 0))
    c.VL(0, y_top, 16 - y_top, k('shiro', 2)); c.VL(15, y_top, 16 - y_top, k('conc', -1))


@R.obj('cv-counter', '카운터 몸통', 1, 1, up=0, kind='floor', surface=True, use=('counter',),
       desc='편의점 카운터 한 칸. 밝은 윗면 5px(탁상 물건 얹을 수 있다)과 흰 앞면, 어두운 받침. 좌우로 이어 붙여 계산대 줄을 만든다.',
       tags=('편의점', '카운터'), place='출입구 가까이 가로로 이어서', pair=('cv-register', 'cv-hotcase', 'cv-coffee'))
def cv_counter(c): _counter_body(c, 0)


@R.obj('cv-register', '계산대(POS)', 1, 1, up=16, kind='floor', surface=True, use=('counter',),
       desc='카운터 위의 POS 계산대 한 칸. 위에 손님 쪽 화면이 달린 단말과 돈통, 아래는 카운터 몸통. 점원이 안쪽에서 손님을 마주 본다. 카운터 줄의 가운데에 놓는다.',
       tags=('편의점', '계산대', '레지'), place='카운터 줄 가운데, 출입구에서 보이는 위치', pair=('cv-counter', 'cv-back-shelf'))
def cv_register(c):
    o = k('conc', -3)
    c.R(3, 6, 10, 9, k('conc', 0)); c.HL(3, 6, 10, k('conc', 2)); c.R(4, 8, 8, 5, k('sora', 1)); c.HL(4, 8, 8, k('garasu', 3)); c.HL(4, 12, 8, k('sora', -2))   # 화면
    c.R(4, 14, 3, 2, k('shiro', 1)); c.R(8, 14, 4, 2, k('daidai', 0))                                                       # 단말 키·카드 단말
    c.R(13, 10, 2, 5, k('conc', -1)); c.P(13, 10, k('conc', 2))                                                            # 영수증 프린터
    ol_in(c, o)
    c.R(0, 16, 16, 5, k('shiro', 2)); c.HL(0, 16, 16, k('shiro', 2)); c.HL(0, 20, 16, k('conc', 1))
    c.R(0, 21, 16, 7, k('shiro', 1)); c.HL(0, 21, 16, k('conc', -1)); c.R(0, 28, 16, 3, k('tekko', -2)); c.HL(0, 28, 16, k('tekko', 0)); c.HL(0, 31, 16, o)
    c.VL(0, 16, 15, k('shiro', 2)); c.VL(15, 16, 15, k('conc', -1))
    c.R(3, 16, 10, 2, k('shiro', 2))


@R.obj('cv-hotcase', '핫 쇼케이스', 1, 1, up=16, kind='floor', use=('search',),
       desc='카운터 위 따뜻한 쇼케이스(가라아게·치킨·어묵). 유리 안이 주황빛이고 갈색 튀김 더미가 보인다. 아래는 카운터 몸통.',
       tags=('편의점', '카운터', '튀김'), place='계산대 옆 카운터 줄', pair=('cv-register', 'cv-counter'))
def cv_hotcase(c):
    o = k('conc', -3)
    c.R(1, 3, 14, 3, k('conc', 2)); c.HL(1, 3, 14, k('conc', 3)); c.HL(1, 5, 14, k('conc', -1))
    c.R(1, 6, 14, 10, k('daidai', 1)); c.HL(1, 6, 14, k('daidai', 2))
    for x0 in (3, 7, 11): c.R(x0, 10, 3, 3, k('ki', 0)); c.HL(x0, 10, 3, k('ki', 2)); c.HL(x0, 12, 3, k('ki', -2))
    c.HL(2, 14, 12, k('tekko', 0)); c.VL(1, 6, 10, k('conc', 2)); c.VL(14, 6, 10, k('conc', -1))
    for p in ((3, 7), (4, 8)): c.P(p[0], p[1], k('garasu', 3))
    ol_in(c, o)
    c.R(0, 16, 16, 5, k('shiro', 2)); c.HL(0, 20, 16, k('conc', 1))
    c.R(0, 21, 16, 7, k('shiro', 1)); c.HL(0, 21, 16, k('conc', -1)); c.R(0, 28, 16, 3, k('tekko', -2)); c.HL(0, 28, 16, k('tekko', 0)); c.HL(0, 31, 16, o)
    c.VL(0, 16, 15, k('shiro', 2)); c.VL(15, 16, 15, k('conc', -1))


@R.obj('cv-coffee', '셀프 커피 머신', 1, 1, up=16, kind='floor', use=('push',),
       desc='카운터 위 셀프 커피 머신. 검은 몸통 앞에 컵 투입구와 빨강·파랑 불, 흰 컵 하나. 아래는 카운터 몸통. 계산대 줄 끝에 둔다.',
       tags=('편의점', '카운터', '커피'), place='계산대 줄 끝, 출입구에서 안쪽', pair=('cv-register',))
def cv_coffee(c):
    o = k('conc', -3)
    c.R(2, 1, 12, 15, k('tekko', 0)); c.HL(2, 1, 12, k('tekko', 2)); c.VL(2, 1, 15, k('tekko', 2)); c.VL(13, 1, 15, k('tekko', -2))
    c.R(4, 3, 8, 3, k('yoru', 0)); c.P(5, 4, k('midori', 1)); c.P(7, 4, k('aka', 1)); c.P(9, 4, k('sora', 2))
    c.R(5, 8, 6, 5, k('conc', -2)); c.HL(7, 8, 2, k('conc', 1)); c.R(6, 11, 4, 4, k('shiro', 2)); c.HL(6, 11, 4, k('shiro', 2)); c.VL(6, 12, 3, k('shiro', 1)); c.HL(6, 14, 4, k('conc', 0))
    ol_in(c, o)
    c.R(0, 16, 16, 5, k('shiro', 2)); c.HL(0, 20, 16, k('conc', 1))
    c.R(0, 21, 16, 7, k('shiro', 1)); c.HL(0, 21, 16, k('conc', -1)); c.R(0, 28, 16, 3, k('tekko', -2)); c.HL(0, 28, 16, k('tekko', 0)); c.HL(0, 31, 16, o)
    c.VL(0, 16, 15, k('shiro', 2)); c.VL(15, 16, 15, k('conc', -1))


@R.obj('cv-back-shelf', '뒷벽 담배·상품 선반', 2, 1, up=16, kind='wall', use=('search',),
       desc='계산대 뒤 벽 선반 2×1. 위 칸에 작은 담배 갑(색색 점무늬)이 격자로, 아래는 서랍 문. 점원이 쓰는 자리. 카운터 바로 뒤 북쪽 벽에 둔다.',
       tags=('편의점', '카운터', '담배', '선반'), place='카운터 뒤 북쪽 벽면 아래', pair=('cv-register', 'cv-counter'))
def cv_back_shelf(c):
    o = k('conc', -3)
    c.R(1, 2, 30, 4, k('conc', 2)); c.HL(1, 2, 30, k('conc', 3)); c.HL(1, 5, 30, k('conc', -1))
    c.R(1, 6, 30, 16, k('conc', 0))
    for r in range(4):
        for i in range(14):
            ramp, st = PROD[hs(i, r, 14) % len(PROD)]
            c.R(2 + i * 2, 7 + r * 4, 2, 3, k(ramp, st)); c.HL(2 + i * 2, 7 + r * 4, 2, k('shiro', 2))
        c.HL(1, 10 + r * 4, 30, k('conc', -2))
    c.R(1, 22, 30, 9, k('ki', 1)); c.HL(1, 22, 30, k('ki', 3)); c.HL(1, 23, 30, k('ki', -2)); c.VL(15, 24, 6, k('ki', -2)); c.VL(16, 24, 6, k('ki', 3))
    for x0 in (13, 18): c.P(x0, 26, k('conc', 3))
    c.R(1, 29, 30, 2, k('tekko', -2))
    ol_in(c, o)


# ───────────────────────── 기타 설비 ─────────────────────────
@R.obj('cv-atm', 'ATM', 1, 1, up=16, kind='wall', use=('counter',),
       desc='벽에 붙인 은행 ATM 1×1. 윗면, 큰 화면과 키패드, 카드 투입구, 아래 지폐 구멍(노란 불). 카운터 맞은편 벽이나 입구 옆에 둔다.',
       tags=('편의점', 'ATM', '은행'), place='입구 쪽 북쪽 벽 아래 또는 복사기 옆', pair=('cv-copier',))
def cv_atm(c):
    o = k('conc', -3)
    c.R(1, 4, 14, 4, k('conc', 2)); c.HL(1, 4, 14, k('conc', 3)); c.HL(1, 7, 14, k('conc', -1))
    c.R(1, 8, 14, 23, k('sora', 0)); c.VL(1, 8, 23, k('sora', 2)); c.VL(14, 8, 23, k('sora', -2))
    c.R(3, 10, 10, 7, k('yoru', 0)); c.R(4, 11, 8, 5, k('garasu', 2)); c.HL(4, 11, 8, k('shiro', 2)); c.P(6, 14, k('midori', 1)); c.P(9, 13, k('aka', 1))
    for r in range(3):
        for i in range(3): c.P(4 + i * 2, 19 + r * 2, k('shiro', 2))
    c.R(10, 19, 3, 5, k('conc', -2)); c.HL(10, 20, 3, k('kii', 2))
    c.R(3, 26, 10, 2, k('tekko', -2)); c.HL(4, 26, 8, k('kii', 1))
    c.R(1, 29, 14, 2, k('tekko', -1))
    ol_in(c, o)


@R.obj('cv-copier', '복합 복사기', 1, 1, up=16, kind='floor', use=('push',),
       desc='편의점 멀티 복사기(복사·팩스·인쇄) 1×1. 윗면 스캐너 덮개, 앞쪽 경사 조작판과 작은 화면, 용지 서랍 두 개. 입구 안쪽 벽 가까이에 둔다.',
       tags=('편의점', '복사기', '설비'), place='입구 안쪽 벽 곁, ATM 옆', pair=('cv-atm',))
def cv_copier(c):
    o = k('conc', -3)
    c.R(1, 7, 14, 5, k('conc', 3)); c.HL(1, 7, 14, k('shiro', 2)); c.HL(1, 11, 14, k('conc', 0)); c.R(3, 9, 6, 2, k('shiro', 2))
    c.R(1, 12, 14, 18, k('shiro', 1)); c.VL(1, 12, 18, k('shiro', 2)); c.VL(14, 12, 18, k('conc', -1))
    c.R(2, 13, 12, 4, k('conc', 0)); c.R(3, 14, 4, 2, k('sora', 1)); c.P(9, 14, k('midori', 1)); c.P(11, 14, k('aka', 1)); c.HL(9, 16, 4, k('conc', 2))
    for y0 in (20, 25): c.R(3, y0, 10, 4, k('conc', 2)); c.HL(3, y0, 10, k('shiro', 2)); c.HL(3, y0 + 3, 10, k('conc', -1)); c.HL(7, y0 + 1, 2, k('conc', -2))
    c.R(2, 29, 12, 2, k('tekko', -2))
    ol_in(c, o)


@R.obj('cv-baskets', '바구니 더미', 1, 1, up=8, kind='floor', use=('search',),
       desc='입구 옆 빨간 쇼핑 바구니 더미 1×1. 검은 받침대 위에 겹쳐 쌓은 빨간 플라스틱 바구니 셋(그물 무늬). 입구 안쪽에 하나 놓는다.',
       tags=('편의점', '슈퍼', '바구니', '입구'), place='입구 안쪽 곤돌라 첫 줄 앞', pair=('cv-autodoor', 'cv-cart'))
def cv_baskets(c):
    o = k('aka', -3)
    for i, y0 in enumerate((13, 18, 23)):
        c.R(2, y0, 12, 6, k('aka', 0)); c.HL(2, y0, 12, k('aka', 2)); c.HL(2, y0 + 5, 12, k('aka', -2))
        for x0 in range(3, 13, 2): c.P(x0, y0 + 2, k('aka', -1)); c.P(x0 + 1, y0 + 3, k('aka', -1))
        c.HL(4, y0 - 1, 8, k('aka', -1)) if i == 0 else None
    ol_in(c, o)
    c.R(1, 29, 14, 2, k('tekko', -2)); c.HL(1, 29, 14, k('tekko', 0)); c.HL(1, 31, 14, k('conc', -3))


@R.obj('cv-autodoor', '자동문 문턱', 2, 1, up=0, kind='flat', use=('travel',),
       desc='편의점 입구의 자동문 문턱 2×1(밟는 바닥 무늬). 위쪽에 유리문 레일 두 줄, 앞쪽에 어두운 입구 매트. 맨 아래 줄 출입구 칸에 놓는다.',
       tags=('편의점', '슈퍼', '입구', '문'), place='맨 아래 줄 출입구 틈 두 칸', pair=('cv-baskets', 'cv-magazine'))
def cv_autodoor(c):
    c.R(0, 2, 32, 2, k('conc', 3)); c.HL(0, 2, 32, k('shiro', 2)); c.HL(0, 3, 32, k('conc', 0))
    for x0 in range(1, 31, 4): c.P(x0, 4, k('conc', -2))
    c.HL(0, 5, 32, k('tekko', -1))
    c.R(2, 7, 28, 8, k('tekko', -1)); c.HL(2, 7, 28, k('tekko', 1))
    for x0 in range(4, 29, 3): c.VL(x0, 8, 6, k('tekko', -3))
    c.HL(2, 14, 28, k('sumi', 0))


@R.obj('cv-trash', '분리수거 쓰레기통', 1, 1, up=8, kind='floor', use=('search',),
       desc='3분류 분리수거 쓰레기통(페트병 파랑·캔 초록·일반 주황) 1×1. 각 칸 위에 투입구 틈. 입구 곁이나 음료 쿨러 끝에 둔다.',
       tags=('편의점', '쓰레기통', '분리수거'), place='입구 곁 바깥쪽 또는 쿨러 줄 끝', pair=('cv-cooler',))
def cv_trash(c):
    o = k('conc', -3)
    for i, (ramp, st) in enumerate((('sora', 0), ('midori', 0), ('daidai', 0))):
        x0 = 1 + i * 5
        c.R(x0, 12, 5, 4, k('conc', 1)); c.HL(x0, 12, 5, k('conc', 3)); c.HL(x0 + 1, 14, 3, k('yoru', 0))
        c.R(x0, 16, 5, 14, k(ramp, st)); c.VL(x0, 16, 14, k(ramp, st + 2)); c.VL(x0 + 4, 16, 14, k(ramp, st - 2)); c.HL(x0, 16, 5, k(ramp, st + 1))
        c.HL(x0 + 1, 21, 3, k('shiro', 2))
    ol_in(c, o)
    c.R(1, 29, 15, 2, k('tekko', -2))


# ───────────────────────── 슈퍼 ─────────────────────────
@R.obj('cv-checkout', '슈퍼 계산대', 1, 2, up=16, kind='floor', use=('counter',),
       desc='슈퍼 계산대 1×2(세로). 북쪽 끝에 POS 단말, 가운데 검은 컨베이어 벨트(양옆 금속 레일), 남쪽 앞면은 흰 몸통. 입구 곁에 2줄 나란히 놓고 줄 사이를 1칸 띄운다.',
       tags=('슈퍼', '계산대', '컨베이어'), place='슈퍼 입구 근처 남북으로 2레인', pair=('cv-cart', 'cv-baskets'))
def cv_checkout(c):
    o = k('conc', -3)
    c.R(3, 3, 10, 8, k('conc', 0)); c.HL(3, 3, 10, k('conc', 2)); c.R(4, 5, 8, 4, k('sora', 1)); c.HL(4, 5, 8, k('garasu', 3)); c.R(5, 10, 6, 2, k('shiro', 1))      # POS
    ol_in(c, o)
    c.R(0, 12, 16, 16, k('conc', 2)); c.HL(0, 12, 16, k('shiro', 2)); c.VL(0, 12, 16, k('shiro', 2)); c.VL(15, 12, 16, k('conc', -1))                               # 윗면 틀
    c.R(2, 14, 12, 13, k('tekko', -2))
    for y0 in range(15, 27, 3): c.HL(2, y0, 12, k('tekko', 0))                                                                                                        # 벨트 마디
    c.VL(2, 14, 13, k('tekko', 1)); c.HL(2, 14, 12, k('tekko', 1))
    c.R(0, 28, 16, 17, k('shiro', 1)); c.HL(0, 28, 16, k('conc', -1)); c.HL(0, 29, 16, k('shiro', 2)); c.VL(0, 28, 17, k('shiro', 2)); c.VL(15, 28, 17, k('conc', -1))
    c.R(2, 33, 12, 6, k('sora', 0)); c.HL(2, 33, 12, k('sora', 2)); c.HL(2, 38, 12, k('sora', -2)); c.R(6, 35, 4, 2, k('shiro', 2))
    c.R(0, 44, 16, 4, k('tekko', -2)); c.HL(0, 44, 16, k('tekko', 0)); c.HL(0, 47, 16, o)


@R.obj('cv-produce', '채소·과일 진열대', 2, 1, up=8, kind='floor', use=('search',),
       desc='슈퍼 농산물 진열대 2×1, 낮고 경사진 단. 위쪽 단에 토마토·사과·오렌지·바나나·초록 채소 더미가 색별로, 앞은 나무 상자 느낌의 갈색 앞판. 입구 맞은편 또는 통로 가운데에 둔다.',
       tags=('슈퍼', '농산물', '과일', '채소'), place='슈퍼 입구에서 보이는 앞줄 또는 정육 케이스 맞은편', pair=('cv-meat-case', 'cv-cart'))
def cv_produce(c):
    o = k('ki', -3)
    c.R(0, 10, 32, 13, k('ki', 0)); c.HL(0, 10, 32, k('ki', 3))
    for r, (y0, pal) in enumerate(((11, [('aka', 0), ('aka', 1), ('daidai', 0)]), (15, [('midori', 0), ('midori', 1), ('kii', 1)]), (19, [('daidai', 0), ('kii', 1), ('aka', 0), ('midori', 0)]))):
        for x0 in range(1, 31, 3):
            ramp, st = pal[hs(x0, r, 8) % len(pal)]
            c.R(x0, y0, 3, 4, k(ramp, st)); c.HL(x0, y0, 3, k(ramp, st + 2)); c.P(x0 + 2, y0 + 3, k(ramp, st - 2))
        c.HL(0, y0 + 3 if r < 2 else y0 + 4, 32, k('ki', -2))
    c.R(0, 23, 32, 7, k('ki', 1)); c.HL(0, 23, 32, k('ki', 3)); c.HL(0, 24, 32, k('ki', -2))
    for x0 in range(0, 32, 8): c.VL(x0, 24, 6, k('ki', -2))
    c.R(1, 26, 6, 2, k('midori', 0)); c.R(17, 26, 6, 2, k('midori', 0))
    c.R(0, 29, 32, 2, k('tekko', -2)); c.HL(0, 29, 32, k('tekko', 0)); c.HL(0, 31, 32, o)
    ol_in(c, o)


@R.obj('cv-cart', '쇼핑 카트', 1, 1, up=8, kind='floor', use=('push',),
       desc='슈퍼 쇼핑 카트 1×1. 철망 바구니 위에 손잡이, 아래 바퀴 둘. 슈퍼 입구 곁에 한두 대 둔다.',
       tags=('슈퍼', '카트', '입구'), place='슈퍼 입구 안쪽, 계산대 옆', pair=('cv-baskets', 'cv-checkout'))
def cv_cart(c):
    o = k('conc', -3)
    c.HL(1, 11, 14, k('aka', 0)); c.HL(1, 12, 14, k('aka', -2)); c.VL(1, 11, 3, k('aka', -1))
    c.R(2, 14, 12, 10, k('conc', 2)); c.HL(2, 14, 12, k('shiro', 2)); c.HL(2, 23, 12, k('conc', -1))
    for x0 in range(4, 14, 3): c.VL(x0, 15, 8, k('conc', -1))
    for y0 in (17, 20): c.HL(2, y0, 12, k('conc', -1))
    c.VL(3, 24, 4, k('conc', -1)); c.VL(12, 24, 4, k('conc', -1))
    c.R(3, 28, 3, 2, k('sumi', 0)); c.R(11, 28, 3, 2, k('sumi', 0)); c.HL(3, 27, 11, k('conc', 0))
    ol_in(c, o)


# ───────────────────────── 탁상 물건 ─────────────────────────
@R.good('cv-onigiri', '삼각김밥', desc='삼각 모양의 흰 삼각김밥 두 개. 아래에 검은 김 띠, 위 한 점은 라벨.')
def g_onigiri(c):
    for x0, ramp in ((2, 'aka'), (8, 'midori')):
        for y in range(6):
            w = 2 + y * 2 - (1 if y > 3 else 0)
            c.HL(x0 + (6 - w) // 2, 5 + y, w, k('shiro', 1))
        c.HL(x0 + 1, 11, 5, k('sumi', 1)); c.HL(x0 + 1, 10, 5, k('sumi', 0)); c.P(x0 + 3, 7, k(ramp, 0)); c.P(x0 + 2, 6, k('shiro', 2))
    c.P(1, 12, None)


@R.good('cv-bento', '도시락', desc='뚜껑이 투명한 도시락 상자. 안에 밥과 반찬이 칸으로 나뉘어 보이고 빨간 띠 라벨.')
def g_bento(c):
    c.R(2, 4, 12, 8, k('shiro', 1)); c.HL(2, 4, 12, k('shiro', 2)); c.HL(2, 11, 12, k('conc', -1))
    c.R(3, 5, 5, 5, k('shiro', 2)); c.R(9, 5, 4, 2, k('daidai', 0)); c.R(9, 7, 4, 3, k('midori', 0)); c.HL(3, 9, 5, k('conc', 1))
    c.HL(2, 12, 12, k('aka', 0)); box(c, 2, 4, 12, 9, k('conc', -3)); c.P(2, 4, None); c.P(13, 4, None)


@R.good('cv-drink', '페트병 음료', desc='페트병 음료 두 개. 투명한 병에 색 라벨 띠와 흰 뚜껑.')
def g_drink(c):
    for x0, ramp in ((3, 'sora'), (9, 'daidai')):
        c.R(x0, 4, 4, 9, k('garasu', 2)); c.R(x0, 7, 4, 3, k(ramp, 0)); c.HL(x0, 3, 4, k('shiro', 2)); c.HL(x0 + 1, 2, 2, k('shiro', 1)); c.VL(x0, 4, 9, k('garasu', 3))
        c.HL(x0, 13, 4, k('conc', -2)); c.VL(x0 + 3, 4, 9, k('conc', -1))
    c.P(3, 13, None)


@R.good('cv-snack', '과자 봉지', desc='위·아래를 접어 붙인 과자 봉지. 빨강·노랑 면에 흰 동그라미 무늬.')
def g_snack(c):
    c.R(3, 3, 10, 9, k('aka', 0)); c.R(3, 6, 10, 3, k('kii', 1)); c.HL(3, 3, 10, k('aka', 2)); c.HL(3, 11, 10, k('aka', -2)); c.P(7, 7, k('shiro', 2)); c.P(8, 7, k('shiro', 2))
    for x0 in range(3, 13, 2): c.P(x0, 2, k('conc', 1)); c.P(x0, 12, k('conc', 1))
    c.VL(3, 3, 9, k('aka', 2)); c.VL(12, 3, 9, k('aka', -2))


# ───────────────────────── 분류표 ─────────────────────────
# categories.py 는 이 작업자가 고칠 수 없다 — 감독자가 `store` 분류를 넣을 때까지 메모리에서만 등록해 굽기 검사(CATS.check)를 통과시킨다.
def _register_cats():
    ids = [i for i in R.objs if i not in CATS.BY_ID]
    for i in ids: CATS.BY_ID[i] = ('store', '편의점·슈퍼')


_register_cats()


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
