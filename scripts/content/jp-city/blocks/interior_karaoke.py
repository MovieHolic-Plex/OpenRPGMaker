#!/usr/bin/env python3
"""jp_city 일본 실내 — 노래방(カラオケボックス)·만화 카페(漫画喫茶·ネットカフェ). id 머리 `kr-`.
  python3 scripts/content/jp-city/blocks/interior_karaoke.py     # selftest + tiledata/jp-city/blocks/interior_karaoke/_all-x3.png

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 외곽선 1px, 팔레트 modern3 만. 글자·숫자·상표·로고·사람·캐릭터 없음.
빛나는 화면(노래방 화면·PC 모니터·태블릿)은 색 덩이·가로 띠·빛 번짐(같은 램프의 밝은 단)으로만.
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (ceil(up/16) + h)*16, hang = w*16 × hrows*16, door = 16×32.

크기(§12-3 공식, 1칸 = 1m):
  프런트 카운터 1.0m 높이·0.6m 깊이 → F 11 + T 5 = 16(한 칸, 위로 안 솟음, 상판에 탁상 물건) · 레지 단말 0.4m 솟음(up 16)
  드링크 바 1.6m 폭 × 0.6m × 1.6m(디스펜서 머리 포함) → 2칸, F 26 T 4(up 16, 벽 붙이)
  노래방 소파 좌판 0.4m·등받이 0.8m, 깊이 0.7m → 한 칸 안(up 0, 낮은 L자 조각) · 낮은 탁자 0.45m → F 6 + 윗면
  대형 화면 2.4m × 1.4m 벽걸이 → 걸이 3칸 · 스피커 0.4×0.35×1.1m → F 18 T 4(up 16, 벽 붙이) · 마이크 스탠드 1.5m → up 16
  미러볼 지름 0.4m(천장에서 사슬로) → 걸이 1칸
  만화 서가 1.8m(벽) → F 28 T 4(2칸 폭, up 16) · 양면 서가 1.5m → F 22 T 6(up 16)
  개인 부스 1m × 2m, 칸막이 1.4m → 발밑 1×2, 칸막이가 위 칸으로 솟음(up 16) · 리클라이닝 의자 등받이 1.1m(up 8)
  PC 책상 0.9m 폭 · 모니터 0.4m 솟음(up 8) · 소프트아이스크림 기계 0.5m 폭 1.6m(받침 포함, up 16)

분류는 interior/categories.py(karaoke·mangacafe).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_karaoke'
R = Registry(BLOCK, '노래방·만화 카페')

KR, KR_KO = 'karaoke', '노래방'
MC, MC_KO = 'mangacafe', '만화 카페'
TK = ('노래방', 'カラオケ')
TM = ('만화 카페', '漫画喫茶', '넷카페')


# ── 도우미 ────────────────────────────────────────────────────────────────────
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


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def ring(c, cx, cy, r, col):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) ** .5
            if r - 1.0 < d <= r: px(c, x, y, col)


def tall_box(c, x, y, w, h, ramp, t=0, top=4):
    """벽 붙은 키 큰 가구 몸통: 윗면 top px(밝음) + 앞 가장자리 하이라이트 1행 + 앞면. (x,y) = 윗면 왼위."""
    rc(c, x, y, w, top, kc(ramp, t + 2)); hl(c, x, y, w, kc(ramp, t + 1))
    hl(c, x, y + top, w, kc(ramp, t + 3))
    rc(c, x, y + top + 1, w, h - top - 1, kc(ramp, t))
    vl(c, x, y + top + 1, h - top - 1, kc(ramp, t + 1)); vl(c, x + w - 1, y + top + 1, h - top - 1, kc(ramp, t - 1))
    outline(c, x, y, w, h)


def eave(c, x, y, w, ramp, t=0):
    """키 큰 가구 윗면 바로 밑 처마 그림자 2px."""
    hl(c, x + 1, y, w - 2, kc(ramp, t - 2)); hl(c, x + 1, y + 1, w - 2, kc(ramp, t - 1))


SPINE = (('aka', 0), ('sora', 0), ('kii', 0), ('midori', 0), ('pinku', 0), ('shiro', 0), ('kon', 1), ('daidai', 0),
         ('murasaki', 1), ('sora', 1), ('aka', 1), ('midori', -1), ('kinari', 0), ('garasu', 1))


def spines(c, x, y, w, h, seed, gap_every=0):
    """만화책 등 줄: 1px 폭 등을 빽빽이(2권마다 색이 바뀐다), 등마다 위 1px 밝은 머리, 가끔 1px 낮은 권·빈 틈."""
    i = 0
    while i < w:
        r, t = SPINE[hs(i // 2 + x, y, seed) % len(SPINE)]
        short = hs(i, y, seed + 3) % 7 == 0
        if gap_every and hs(i, y, seed + 9) % gap_every == 0:
            i += 1; continue
        top = y + (1 if short else 0)
        vl(c, x + i, top, h - (top - y), kc(r, t))
        px(c, x + i, top, kc(r, t + 2))
        if (i % 2) == 1: px(c, x + i, y + h - 2, kc(r, t - 1))        # 둘째 권 아래쪽 띠(같은 시리즈 묶음)
        if hs(i, y, seed + 5) % 5 == 0: px(c, x + i, y + h // 2, kc('shiro', 1))  # 등 가운데 작은 흰 띠(글자 아님)
        i += 1


# ══ 바닥·벽면 ═════════════════════════════════════════════════════════════════
@R.floor('kr-corridor', '노래방 복도 카펫(짙은 감색 + 유도등 점)', cols=4, rows=2, tags=TK + ('복도',),
         desc='짙은 감색 루프 카펫에 성긴 결 점, 드문드문 바닥에 박힌 작은 노란·청록 유도등 점(둘레 1px 빛 번짐). 노래방 복도·로비 바닥.')
def _kr_corridor(c):
    W, H = c.w, c.h
    rc(c, 0, 0, W, H, kc('kon', -1))
    for y in range(H):
        for x in range(W):
            if rnd(x, y, 1, 34): px(c, x, y, kc('kon', -2))
            elif rnd(x, y, 2, 8): px(c, x, y, kc('kon', 0))
    for y in range(0, H, 4):                                                     # 루프 결(아주 옅은 가로 줄)
        for x in range(W):
            if (x + y // 4) % 6 == 0: px(c, x, y, kc('kon', -2))
    for (x, y, col) in ((13, 9, 'kii'), (45, 25, 'neonC'), (29, 1, 'neonC'), (61, 17, 'kii')):   # 유도등 점 4개 / 64×32
        px(c, x, y, kc(col, 1)); px(c, x + 1, y, kc(col, 0))
        for (dx, dy) in ((-1, 0), (2, 0), (0, -1), (1, -1), (0, 1), (1, 1)): px(c, x + dx, y + dy, kc('kon', 0))


@R.floor('kr-room-floor', '노래방 방 카펫(보라 마름모 무늬)', cols=2, rows=2, tags=TK + ('노래방 방', '파티룸'),
         desc='짙은 보라 카펫에 한 단 밝은 보라 마름모 테두리 무늬가 16px 마다 이어지고, 마름모 가운데 분홍 점. 노래방 방 안 바닥.')
def _kr_room_floor(c):
    W, H = c.w, c.h
    rc(c, 0, 0, W, H, kc('murasaki', -1))
    for y in range(H):
        for x in range(W):
            if rnd(x, y, 7, 60): px(c, x, y, kc('murasaki', -2))
    for y in range(H):                                                           # 마름모(16px 주기)
        for x in range(W):
            lx, ly = x % 16, y % 16
            d = abs(lx - 7.5) + abs(ly - 7.5)
            if 6.5 <= d < 7.5: px(c, x, y, kc('murasaki', 0))
    for (x, y) in ((7, 7), (23, 23), (23, 7), (7, 23)):
        px(c, x, y, kc('pinku', -1)); px(c, x + 1, y, kc('pinku', -1)); px(c, x, y + 1, kc('pinku', -2)); px(c, x + 1, y + 1, kc('pinku', -2))
    for (x, y) in ((0, 0), (16, 16), (16, 0), (0, 16)):                          # 마름모 꼭짓점 사이 작은 점
        px(c, x, y, kc('murasaki', -2))


@R.wall('kr-wall', '방음 벽(짙은 보라 누빔 패드)', cols=2, tags=TK + ('노래방 방', '복도'),
        desc='노래방 방음 벽 — 짙은 보라 누빔 패드가 마름모로 눌려 있고 눌린 자리마다 단추 점, 허리 높이에 청록 간접등 한 줄, 아래 검은 걸레받이.')
def _kr_wall(c):
    W = c.w
    rc(c, 0, 0, W, 32, kc('murasaki', -1))
    for y in range(0, 20):                                                       # 누빔(8px 마름모)
        for x in range(W):
            lx, ly = (x + (4 if (y // 8) % 2 else 0)) % 8, y % 8
            d = abs(lx - 3.5) + abs(ly - 3.5)
            if d >= 3.5: px(c, x, y, kc('murasaki', -2))
            elif d < 1.5 and lx < 4 and ly < 4: px(c, x, y, kc('murasaki', 0))   # 패드 왼위 볼록한 빛
    for y in range(0, 20, 8):
        for x in range(4 if (y // 8) % 2 else 0, W, 8): px(c, x, y, kc('sumi', 0))   # 단추 점
    hl(c, 0, 20, W, kc('sumi', 0)); hl(c, 0, 21, W, kc('neonC', 0)); hl(c, 0, 22, W, kc('neonC', -1))   # 간접등 줄
    rc(c, 0, 23, W, 6, kc('murasaki', -2))
    for x in range(0, W, 8): vl(c, x, 23, 6, kc('sumi', 1))                      # 아래 판 이음
    hl(c, 0, 23, W, kc('murasaki', 0))
    rc(c, 0, 29, W, 3, kc('yoru', -3)); hl(c, 0, 29, W, kc('yoru', -1)); hl(c, 0, 31, W, kc('sumi', -1))   # 걸레받이


@R.floor('kr-cafe-floor', '만화 카페 회색 카펫 타일', cols=2, rows=2, tags=TM,
         desc='회색 카펫 타일 16px 판 — 판마다 결 방향이 엇갈리고(가로·세로 점 줄) 이음선이 아주 옅다. 만화 카페·넷카페 서가·부스 통로 바닥.')
def _kr_cafe_floor(c):
    for by in (0, 1):
        for bx in (0, 1):
            horiz = (bx + by) % 2 == 0
            rc(c, bx * 16, by * 16, 16, 16, kc('hodo', 1))
            for y in range(16):
                for x in range(16):
                    gx, gy = bx * 16 + x, by * 16 + y
                    if (y % 3 == 1 if horiz else x % 3 == 1) and rnd(gx, gy, 11, 520): px(c, gx, gy, kc('hodo', 0))
                    elif rnd(gx, gy, 12, 30): px(c, gx, gy, kc('hodo', 2))
    hl(c, 0, 0, 32, kc('hodo', 0)); vl(c, 0, 0, 32, kc('hodo', 0)); hl(c, 0, 16, 32, kc('hodo', 0)); vl(c, 16, 0, 32, kc('hodo', 0))


@R.wall('kr-cafe-wall', '만화 카페 벽(크림 + 짙은 나무 허리판)', cols=2, tags=TM,
        desc='위는 크림색 벽지, 허리 아래는 짙은 나무 판(세로 널), 그 사이 밝은 나무 띠. 만화 카페 벽.')
def _kr_cafe_wall(c):
    W = c.w
    rc(c, 0, 0, W, 15, kc('kinari', 1))
    for y in range(15):
        for x in range(W):
            if rnd(x, y, 21, 30): px(c, x, y, kc('kinari', 0))
    for x in (0, 16): vl(c, x, 0, 15, kc('kinari', 0))
    hl(c, 0, 15, W, kc('yuka', 2)); hl(c, 0, 16, W, kc('yuka', 1)); hl(c, 0, 17, W, kc('ita', -1))   # 허리 띠
    rc(c, 0, 18, W, 11, kc('ita', 0))
    for x in range(0, W, 4): vl(c, x, 18, 11, kc('ita', -1)); vl(c, x + 1, 18, 11, kc('ita', 1))       # 세로 널
    rc(c, 0, 29, W, 3, kc('ita', -2)); hl(c, 0, 29, W, kc('ita', 0)); hl(c, 0, 31, W, kc('ita', -3))


# ══ 노래방 — 프런트·드링크 바 ═════════════════════════════════════════════════
def _front_body(c, y0):
    """프런트 카운터 몸통 16px(y0 부터): 밝은 대리석 상판 5px + 앞 가장자리 + 검은 광택 앞판에 분홍 네온 띠."""
    rc(c, 0, y0, 16, 5, kc('conc', 2)); hl(c, 0, y0, 16, kc('conc', 3)); hl(c, 0, y0 + 1, 16, kc('shiro', 1))
    for x in (3, 11): px(c, x, y0 + 3, kc('conc', 1)); px(c, x + 1, y0 + 2, kc('conc', 1))            # 대리석 결
    hl(c, 0, y0 + 5, 16, kc('shiro', 2))                                                             # 앞 가장자리 하이라이트
    hl(c, 0, y0 + 6, 16, kc('conc', -1))
    rc(c, 0, y0 + 7, 16, 8, kc('yoru', -2)); hl(c, 0, y0 + 7, 16, kc('yoru', 0))                      # 검은 광택 앞판
    hl(c, 0, y0 + 9, 16, kc('neonP', 1)); hl(c, 0, y0 + 10, 16, kc('neonP', -1))                      # 네온 띠
    for x in range(1, 16, 5): px(c, x, y0 + 12, kc('yoru', 0))                                        # 앞판 반사 점
    hl(c, 0, y0 + 15, 16, OL)


@R.obj('kr-front', '노래방 프런트 카운터', w=1, h=1, up=0, kind='floor', cat=KR, cat_ko=KR_KO, surface=True, use=('counter',),
       tags=TK + ('프런트', '카운터', '접수', '만화 카페'), place='입구 안쪽 — 가로로 이어 붙여 직원 쪽(북)과 손님 쪽(남)을 가른다. 줄 끝 한 칸은 직원 길로 비운다',
       pair=('kr-front-register', 'kr-menu', 'kr-remote'),
       desc='프런트 카운터 한 칸 — 밝은 대리석 상판에 검은 광택 앞판, 앞판에 분홍 네온 띠 한 줄. 좌우로 3~4칸 이어 붙이고 앞(남쪽) 두 줄은 손님 자리로 비운다. 상판에 메뉴판·리모컨 바구니를 놓는다. 만화 카페 접수대에도 쓴다.')
def _kr_front(c): _front_body(c, 0)


@R.obj('kr-front-register', '프런트 레지(단말·마이크 바구니)', w=1, h=1, up=16, kind='floor', cat=KR, cat_ko=KR_KO, use=('counter',),
       tags=TK + ('프런트', '레지', '접수', '만화 카페'), place='프런트 카운터 줄 가운데 한 칸 — 손님 쪽 두 줄을 비운다', pair=('kr-front',),
       desc='프런트 카운터 위의 계산 단말 칸 — 세운 화면(하늘빛, 글자 없음)과 돈통, 옆에 대여 마이크 두 개가 든 바구니. 아래는 프런트 카운터 몸통. 직원이 북쪽에서 손님을 마주 본다.')
def _kr_register(c):
    rc(c, 1, 4, 8, 7, kc('tekko', -2)); outline(c, 0, 3, 10, 9)                                       # 세운 화면
    rc(c, 1, 4, 8, 6, kc('sora', 1)); hl(c, 1, 4, 8, kc('sora', 2)); hl(c, 2, 6, 5, kc('shiro', 2)); hl(c, 2, 8, 3, kc('shiro', 1))
    rc(c, 4, 12, 2, 2, kc('tekko', -1))
    rc(c, 1, 14, 9, 2, kc('tekko', 0)); hl(c, 1, 14, 9, kc('tekko', 2))                               # 단말 받침
    rc(c, 10, 9, 6, 6, kc('ita', 0)); hl(c, 10, 9, 6, kc('ita', 2)); outline(c, 10, 9, 6, 6)          # 마이크 바구니
    for (x, col) in ((11, 'shiro'), (13, 'tekko')):
        rc(c, x, 6, 2, 3, kc(col, 1)); px(c, x, 6, kc(col, 2)); vl(c, x, 9, 3, kc('sumi', 0)); vl(c, x + 1, 9, 3, kc('sumi', 1))
    _front_body(c, 16)
    rc(c, 2, 16, 7, 2, kc('tekko', 1)); hl(c, 2, 16, 7, kc('tekko', 2))                               # 단말 다리가 상판에 앉은 자리


@R.obj('kr-drink-bar', '드링크 바', w=2, h=1, up=16, kind='wall', cat=KR, cat_ko=KR_KO, use=('search',),
       tags=TK + ('드링크 바', '음료', '만화 카페'), place='로비·복도 끝의 북쪽 벽 바로 아래(손님이 앞에 서는 자리 한 줄을 비운다)',
       pair=('kr-glass', 'kr-ice-cream'),
       desc='벽에 붙은 셀프 드링크 바 2칸 — 위 은색 디스펜서 넷(빨강·주황·초록·노랑 색 패널, 글자 없음)과 꼭지, 물받이, 왼쪽에 엎어 쌓은 컵 더미, 아래 흰 수납장. 노래방·만화 카페 로비에 하나.')
def _kr_drink(c):
    W = 32
    tall_box(c, 0, 1, W, 31, 'tekko', 1, top=4)                                                       # 몸통(은색)
    eave(c, 0, 6, W, 'tekko', 1)
    for i, col in enumerate(('aka', 'daidai', 'midori', 'kii')):                                     # 디스펜서 머리 넷
        x = 7 + i * 6
        rc(c, x, 8, 5, 6, kc(col, 1)); hl(c, x, 8, 5, kc(col, 2)); vl(c, x + 4, 8, 6, kc(col, -1))
        px(c, x + 1, 10, kc('shiro', 2)); rc(c, x + 1, 12, 3, 1, kc(col, 0))                           # 색 패널의 빛(글자 아님)
        outline(c, x - 1, 7, 7, 8, kc('tekko', -2))
        rc(c, x + 2, 15, 1, 3, kc('tekko', -1)); px(c, x + 2, 15, kc('tekko', 2))                       # 꼭지
    for k in range(4):                                                                                # 왼쪽 컵 더미(엎은 컵 4단)
        y = 9 + k * 2
        rc(c, 2, y, 4, 2, kc('garasu', 2)); px(c, 2, y, kc('shiro', 2)); px(c, 5, y + 1, kc('garasu', 0))
    outline(c, 1, 8, 6, 10, kc('tekko', -2))
    rc(c, 1, 18, 30, 3, kc('tekko', -1)); hl(c, 1, 18, 30, kc('tekko', 3))                             # 물받이·상판
    for x in range(8, 31, 2): px(c, x, 19, kc('tekko', -3))                                           # 물받이 구멍
    rc(c, 1, 21, 30, 9, kc('shiro', 1)); hl(c, 1, 21, 30, kc('shiro', 2)); hl(c, 1, 22, 30, kc('conc', 0))   # 수납장
    vl(c, 16, 22, 8, kc('conc', 0)); px(c, 14, 25, kc('tekko', 2)); px(c, 18, 25, kc('tekko', 2))
    vl(c, 1, 21, 9, kc('shiro', 2)); vl(c, 30, 21, 9, kc('conc', 0))
    rc(c, 1, 30, 30, 1, kc('tekko', -2))
    outline(c, 0, 1, W, 31)


@R.obj('kr-ice-cream', '소프트아이스크림 기계', w=1, h=1, up=16, kind='wall', cat=MC, cat_ko=MC_KO, use=('push',),
       tags=TM + ('드링크 바', '아이스크림', '노래방'), place='드링크 바 옆, 북쪽 벽 바로 아래',
       pair=('kr-drink-bar',),
       desc='셀프 소프트아이스크림 기계 — 은색 몸통 위 윗면, 앞에 손잡이 레버 둘과 꼭지, 아래 물받이, 옆에 콘 꽂이(콘 두 개). 드링크 바 옆에 하나.')
def _kr_ice(c):
    tall_box(c, 1, 2, 14, 21, 'tekko', 1, top=4)
    eave(c, 1, 7, 14, 'tekko', 1)
    rc(c, 3, 9, 10, 4, kc('shiro', 2)); hl(c, 3, 9, 10, kc('shiro', 2)); rc(c, 4, 10, 3, 2, kc('pinku', 1)); rc(c, 8, 10, 3, 2, kc('kinari', 2))   # 맛 패널(분홍·바닐라)
    outline(c, 2, 8, 12, 6, kc('tekko', -2))
    for x in (5, 10):                                                                                 # 레버
        vl(c, x, 13, 4, kc('tekko', 3)); px(c, x, 13, kc('aka', 1)); px(c, x - 1, 13, kc('aka', 0))
    rc(c, 6, 17, 4, 2, kc('tekko', -1)); px(c, 7, 19, kc('shiro', 2)); px(c, 8, 19, kc('kinari', 2))  # 꼭지 + 짜인 아이스크림
    rc(c, 3, 20, 10, 2, kc('tekko', -2)); hl(c, 3, 20, 10, kc('tekko', 2))                            # 물받이
    rc(c, 2, 23, 12, 8, kc('shiro', 1)); hl(c, 2, 23, 12, kc('shiro', 2)); vl(c, 13, 23, 8, kc('conc', 0)); outline(c, 1, 22, 14, 10)   # 받침장
    vl(c, 8, 24, 6, kc('conc', 0)); px(c, 7, 27, kc('tekko', 2)); px(c, 9, 27, kc('tekko', 2))
    rc(c, 0, 13, 2, 7, kc('garasu', 1)); px(c, 0, 13, kc('shiro', 2))                                 # 콘 꽂이 통
    px(c, 0, 12, kc('yuka', 2)); px(c, 1, 12, kc('yuka', 1)); px(c, 1, 11, kc('yuka', 2))


@R.obj('kr-rental-shelf', '대여품 선반(마이크·탬버린·코스튬)', w=2, h=1, up=16, kind='wall', cat=KR, cat_ko=KR_KO, use=('search',),
       tags=TK + ('프런트', '대여', '직원'), place='프런트 카운터 뒤 북쪽 벽 바로 아래(직원 쪽)', pair=('kr-front', 'kr-front-register'),
       desc='프런트 뒤 벽 선반 2칸 — 윗단에 무선 마이크 바구니 줄, 가운데 단에 탬버린·마라카스, 아랫단에 접어 쌓은 색색 코스튬 봉투(글자 없음). 윗면과 처마 그늘.')
def _kr_rental(c):
    W = 32
    tall_box(c, 0, 1, W, 31, 'ita', 0, top=4)
    eave(c, 0, 6, W, 'ita', 0)
    for y0 in (8, 15, 22):
        rc(c, 1, y0, 30, 6, kc('ita', -2)); hl(c, 1, y0 + 6, 30, kc('ita', 2))
    for i in range(5):                                                                                # 마이크 바구니 줄
        x = 2 + i * 6
        rc(c, x, 11, 5, 3, kc('kon', 0)); hl(c, x, 11, 5, kc('kon', 1))
        for k in range(2): rc(c, x + 1 + k * 2, 9, 1, 3, kc('tekko', 2)); px(c, x + 1 + k * 2, 9, kc('shiro', 2))
    for i, col in enumerate(('aka', 'kii', 'sora', 'aka')):                                          # 탬버린·마라카스
        x = 3 + i * 7
        if i % 2 == 0: ring(c, x + 2, 18, 2.4, kc(col, 0)); px(c, x + 1, 17, kc('kii', 2)); px(c, x + 3, 19, kc('kii', 2))
        else: disc(c, x + 2, 17, 1.6, 1.6, kc(col, 1)); vl(c, x + 2, 18, 3, kc('ita', 1)); disc(c, x + 4, 18, 1.4, 1.4, kc(col, 0))
    for i in range(6):                                                                                # 코스튬 봉투
        ramp = ('pinku', 'sora', 'kii', 'midori', 'murasaki', 'aka')[i]
        x = 2 + i * 5
        rc(c, x, 23, 4, 5, kc(ramp, 0)); hl(c, x, 23, 4, kc(ramp, 2)); vl(c, x + 3, 24, 4, kc(ramp, -1)); px(c, x + 1, 25, kc('shiro', 1))
    hl(c, 1, 31, 30, OL)


# ══ 노래방 — 방 ══════════════════════════════════════════════════════════════
@R.obj('kr-room-door', '노래방 방 문(작은 유리창, 열림)', kind='door', cat=KR, cat_ko=KR_KO, use=('travel', 'open'),
       tags=TK + ('노래방 방', '파티룸', '문'), place='복도와 방 사이 가로 칸막이의 1칸 틈 칸(방마다 하나)',
       desc='두꺼운 방음 문이 안쪽(동쪽 기둥)으로 열려 붙어 있다 — 짙은 보라 문짝에 세로로 긴 작은 유리창(방 안 분홍빛이 비친다)과 은색 레버 손잡이, 검은 문틀, 바닥에 철 문턱. 가운데로 바닥이 보이고 지나간다.')
def _kr_door(c):
    for x0, f in ((0, 1), (13, -1)):                                                                  # 검은 문틀 기둥
        rc(c, x0, 0, 3, 32, kc('yoru', -1)); vl(c, x0 + (0 if f > 0 else 2), 0, 32, kc('yoru', 1 if f > 0 else -3))
        vl(c, x0 + (2 if f > 0 else 0), 4, 28, kc('yoru', -3 if f > 0 else 0))
    rc(c, 0, 0, 16, 4, kc('yoru', -1)); hl(c, 0, 0, 16, kc('sumi', -1)); hl(c, 0, 1, 16, kc('yoru', 1)); hl(c, 0, 3, 16, kc('sumi', -1))
    hl(c, 3, 4, 10, kc('neonP', 0))                                                                   # 문 위 작은 사용중 등(색 띠)
    rc(c, 7, 5, 6, 25, kc('murasaki', -1)); vl(c, 7, 5, 25, kc('murasaki', 1)); vl(c, 8, 5, 25, kc('murasaki', 0))   # 열린 문짝(두꺼운 판)
    vl(c, 12, 5, 25, kc('murasaki', -2)); hl(c, 7, 5, 6, kc('murasaki', 1))
    rc(c, 9, 8, 2, 9, kc('pinku', 0)); px(c, 9, 8, kc('pinku', 2)); px(c, 10, 12, kc('neonC', 1)); outline(c, 8, 7, 4, 11, kc('sumi', 0))   # 세로 유리창
    rc(c, 9, 19, 3, 1, kc('tekko', 3)); px(c, 9, 20, kc('tekko', 1))                                  # 레버
    rc(c, 3, 29, 10, 3, kc('tekko', 1)); hl(c, 3, 29, 10, kc('tekko', 3)); hl(c, 3, 31, 10, kc('tekko', -2))   # 문턱


SOFA = 'aka'


def _cushion_top(c, x, y, w, h):
    """위에서 본 좌판(밝음) — 왼위 테 밝게, 오른아래 한 단 어둡게."""
    rc(c, x, y, w, h, kc(SOFA, 1)); hl(c, x, y, w, kc(SOFA, 2)); vl(c, x, y, h, kc(SOFA, 2))
    hl(c, x, y + h - 1, w, kc(SOFA, 0)); vl(c, x + w - 1, y, h, kc(SOFA, 0))


@R.obj('kr-sofa-n', '노래방 소파 조각(북향 — 남쪽 줄)', w=1, h=1, up=0, kind='floor', cat=KR, cat_ko=KR_KO, use=('sit',), facing='N',
       tags=TK + ('노래방 방', '소파', '파티룸'), place='방 남쪽 줄 — 화면(북쪽 벽)을 보고 가로로 이어 붙인다. 양 끝은 모서리 조각(kr-sofa-sw·kr-sofa-se)',
       pair=('kr-sofa-e', 'kr-sofa-w', 'kr-sofa-sw', 'kr-sofa-se'),
       desc='빨강 비닐 노래방 소파의 한 칸 — 북쪽(화면)을 보고 앉는다. 위에 좌판 윗면, 남쪽에 낮은 등받이 윗날과 등받이 뒷면. 가로로 이어 붙이면 이음새 없이 긴 소파가 된다.')
def _kr_sofa_n(c):
    _cushion_top(c, 0, 1, 16, 7)
    vl(c, 0, 1, 7, kc(SOFA, 0)); vl(c, 15, 1, 7, kc(SOFA, -1))                                        # 쿠션 이음
    px(c, 7, 4, kc(SOFA, 0)); px(c, 8, 4, kc(SOFA, 0))                                                # 단추
    hl(c, 0, 0, 16, kc(SOFA, -2))                                                                     # 좌판 앞 가장자리(북쪽, 그늘)
    rc(c, 0, 8, 16, 3, kc(SOFA, 2)); hl(c, 0, 8, 16, kc('pinku', 2)); hl(c, 0, 10, 16, kc(SOFA, 0))   # 등받이 윗날
    rc(c, 0, 11, 16, 4, kc(SOFA, -1)); hl(c, 0, 11, 16, kc(SOFA, 0))                                  # 등받이 뒷면
    for x in (4, 11): vl(c, x, 12, 2, kc(SOFA, -2))                                                   # 뒷면 박음질
    hl(c, 0, 15, 16, OL)


def _side_run(c, back_left):
    """세로로 이어지는 소파 조각(위에서 본 것): 등받이 띠(벽 쪽) + 좌판. 위아래 이음새 없음."""
    bx = 0 if back_left else 11
    sx = 5 if back_left else 0
    rc(c, bx, 0, 5, 16, kc(SOFA, 0)); vl(c, bx + (1 if back_left else 3), 0, 16, kc(SOFA, 2))          # 등받이 윗날
    vl(c, bx + (0 if back_left else 4), 0, 16, OL)
    vl(c, bx + (3 if back_left else 1), 0, 16, kc(SOFA, -1))                                          # 등받이 안쪽 면(그늘)
    _cushion_top(c, sx, 0, 11, 16)
    hl(c, sx, 0, 11, kc(SOFA, 1)); hl(c, sx, 15, 11, kc(SOFA, -1))                                    # 위아래 쿠션 이음
    px(c, sx + 5, 7, kc(SOFA, 0)); px(c, sx + 5, 8, kc(SOFA, 0))
    ex = 15 if back_left else 0
    vl(c, ex, 0, 16, kc(SOFA, -2))                                                                    # 좌판 앞 가장자리(방 쪽)


@R.obj('kr-sofa-e', '노래방 소파 조각(동향 — 서쪽 줄)', w=1, h=1, up=0, kind='floor', cat=KR, cat_ko=KR_KO, use=('sit',), facing='E',
       tags=TK + ('노래방 방', '소파', '파티룸'), place='방 서쪽 벽을 따라 세로로 이어 붙인다(동쪽 탁자를 본다). 남쪽 끝은 kr-sofa-sw',
       pair=('kr-sofa-n', 'kr-sofa-sw', 'kr-table'),
       desc='빨강 비닐 노래방 소파의 한 칸 — 동쪽(탁자)을 보고 앉는다. 위에서 본 서쪽 등받이 띠와 좌판, 위아래로 이음새 없이 이어진다.')
def _kr_sofa_e(c): _side_run(c, True)


@R.obj('kr-sofa-w', '노래방 소파 조각(서향 — 동쪽 줄)', w=1, h=1, up=0, kind='floor', cat=KR, cat_ko=KR_KO, use=('sit',), facing='W',
       tags=TK + ('노래방 방', '소파', '파티룸'), place='방 동쪽 벽을 따라 세로로 이어 붙인다(서쪽 탁자를 본다). 남쪽 끝은 kr-sofa-se',
       pair=('kr-sofa-n', 'kr-sofa-se', 'kr-table'),
       desc='빨강 비닐 노래방 소파의 한 칸 — 서쪽(탁자)을 보고 앉는다. 위에서 본 동쪽 등받이 띠와 좌판, 위아래로 이음새 없이 이어진다.')
def _kr_sofa_w(c): _side_run(c, False)


def _corner(c, west):
    """ㄷ자 소파 남쪽 모서리: 옆 줄 등받이 띠가 남쪽 등받이와 만나고, 남쪽에 등받이 뒷면."""
    _cushion_top(c, 0, 1, 16, 7)
    bx = 0 if west else 11
    rc(c, bx, 0, 5, 11, kc(SOFA, 0)); vl(c, bx + (1 if west else 3), 0, 11, kc(SOFA, 2)); vl(c, bx + (3 if west else 1), 0, 8, kc(SOFA, -1))
    vl(c, bx + (0 if west else 4), 0, 15, OL)
    sx = 5 if west else 0
    _cushion_top(c, sx, 0, 11, 8); hl(c, sx, 0, 11, kc(SOFA, 1))
    vl(c, 15 if west else 0, 0, 8, kc(SOFA, -2))
    rc(c, 0, 8, 16, 3, kc(SOFA, 2)); hl(c, 0, 8, 16, kc('pinku', 2)); hl(c, 0, 10, 16, kc(SOFA, 0))   # 남쪽 등받이 윗날
    rc(c, bx, 8, 5, 3, kc(SOFA, 2)); hl(c, bx, 8, 5, kc('pinku', 2))
    rc(c, 0, 11, 16, 4, kc(SOFA, -1)); hl(c, 0, 11, 16, kc(SOFA, 0))
    vl(c, 6 if west else 9, 12, 2, kc(SOFA, -2))
    hl(c, 0, 15, 16, OL)
    if west: vl(c, 0, 8, 8, OL)
    else: vl(c, 15, 8, 8, OL)


@R.obj('kr-sofa-sw', '노래방 소파 모서리(남서)', w=1, h=1, up=0, kind='floor', cat=KR, cat_ko=KR_KO, use=('sit',),
       tags=TK + ('노래방 방', '소파', '파티룸'), place='ㄷ자 소파의 남서 모서리 — 위로 kr-sofa-e, 동쪽으로 kr-sofa-n 이 이어진다',
       pair=('kr-sofa-e', 'kr-sofa-n'),
       desc='ㄷ자 빨강 소파의 남서 모서리 한 칸 — 서쪽 등받이 띠가 남쪽 등받이와 만나 꺾이고, 남쪽에 등받이 뒷면이 보인다.')
def _kr_sofa_sw(c): _corner(c, True)


@R.obj('kr-sofa-se', '노래방 소파 모서리(남동)', w=1, h=1, up=0, kind='floor', cat=KR, cat_ko=KR_KO, use=('sit',),
       tags=TK + ('노래방 방', '소파', '파티룸'), place='ㄷ자 소파의 남동 모서리 — 위로 kr-sofa-w, 서쪽으로 kr-sofa-n 이 이어진다',
       pair=('kr-sofa-w', 'kr-sofa-n'),
       desc='ㄷ자 빨강 소파의 남동 모서리 한 칸 — 동쪽 등받이 띠가 남쪽 등받이와 만나 꺾이고, 남쪽에 등받이 뒷면이 보인다.')
def _kr_sofa_se(c): _corner(c, False)


@R.table('kr-table', '노래방 낮은 탁자', desc='짙은 나무 낮은 탁자 — 윗면 밝은 테, 앞 가장자리와 짧은 다리. 아무 크기로 이어 붙인다. 위에 메뉴판·리모컨·잔·탬버린을 놓는다.',
         tags=TK + ('노래방 방', '탁자'))
def _kr_table(c, w, h):
    W, H = w * 16, h * 16
    ty1 = H - 6
    rc(c, 0, 1, W, ty1 - 1, kc('ita', 1))
    for y in range(3, ty1, 3):                                                                        # 나뭇결(성김)
        for x in range(0, W, 16): hl(c, x + (2 if (y // 3) % 2 else 9), y, 4, kc('ita', 0))
    hl(c, 0, 1, W, kc('ita', 3)); vl(c, 0, 1, ty1 - 1, kc('ita', 3))                                  # 윗면 테
    vl(c, W - 1, 1, ty1 - 1, kc('ita', -1))
    hl(c, 0, ty1, W, kc('ita', 2))                                                                    # 앞 가장자리 하이라이트
    rc(c, 0, ty1 + 1, W, 2, kc('ita', -1)); hl(c, 0, ty1 + 2, W, kc('ita', -2))
    hl(c, 0, 0, W, OL); vl(c, 0, 0, H - 2, OL); vl(c, W - 1, 0, H - 2, OL); hl(c, 0, ty1 + 3, W, OL)
    for x0 in (1, W - 3): rc(c, x0, ty1 + 3, 2, 3, kc('ita', -2)); px(c, x0, ty1 + 3, kc('ita', 0))


@R.obj('kr-screen', '노래방 대형 화면', w=3, kind='hang', hrows=2, cat=KR, cat_ko=KR_KO, use=('light',),
       tags=TK + ('노래방 방', '화면', '파티룸'), place='방 북쪽 벽면 윗줄 가운데(소파가 바라보는 벽)', pair=('kr-speaker', 'kr-mic-stand'),
       desc='벽에 건 대형 화면 3칸 — 검은 테 안에 감색·보라·분홍 가로 띠 배경과 빛 줄기, 아래에 가사 띠 두 줄(글자 없이 흰·분홍 막대가 반쯤 칠해진 것). 테 둘레 벽에 보라 빛 번짐. 사람·글자 없음.')
def _kr_screen(c):
    W = 48
    for x in range(W):                                                                                # 벽 위 빛 번짐(테 둘레 1px)
        px(c, x, 1, kc('murasaki', 0)); px(c, x, 27, kc('murasaki', 0))
    vl(c, 0, 1, 27, kc('murasaki', 0)); vl(c, W - 1, 1, 27, kc('murasaki', 0))
    rc(c, 1, 2, W - 2, 25, kc('sumi', -1))                                                            # 테
    hl(c, 1, 2, W - 2, kc('yoru', 0))
    x0, y0, x1, y1 = 3, 4, W - 3, 24
    bands = (('kon', -1), ('kon', 0), ('murasaki', -1), ('murasaki', 0), ('pinku', -1), ('pinku', 0))
    for y in range(y0, y1):                                                                           # 배경 띠(위 어둡고 아래로 밝게)
        b = bands[min(len(bands) - 1, (y - y0) * len(bands) // (y1 - y0))]
        hl(c, x0, y, x1 - x0, kc(*b))
    for i in range(9):                                                                                # 빛 줄기(사선)
        px(c, 30 - i, 5 + i, kc('neonC', 0)); px(c, 31 - i, 5 + i, kc('neonC', 1) if i % 3 == 0 else kc('kon', 1))
        px(c, 36 + (i // 2), 5 + i, kc('murasaki', 1))
    disc(c, 14, 10, 4, 3, kc('pinku', 1)); disc(c, 13, 9, 2, 1.5, kc('pinku', 2)); px(c, 12, 8, kc('shiro', 2))   # 둥근 빛 덩이(보케)
    disc(c, 38, 13, 2.5, 2, kc('neonC', 0)); px(c, 37, 12, kc('neonC', 1))
    for (x, y) in ((8, 6), (22, 7), (41, 6), (26, 12)): px(c, x, y, kc('shiro', 2))                   # 반짝 점
    rc(c, 6, 17, 34, 2, kc('shiro', 2)); rc(c, 6, 17, 19, 2, kc('neonP', 1))                          # 가사 띠 1(반쯤 칠해짐)
    rc(c, 10, 21, 30, 2, kc('shiro', 1)); hl(c, 6, 19, 34, kc('sumi', 0)); hl(c, 10, 23, 30, kc('sumi', 0))
    px(c, x1 - 3, y0 + 1, kc('midori', 1))                                                            # 구석 작은 불(글자 아님)
    rc(c, 18, 27, 12, 3, kc('tekko', -1)); hl(c, 18, 27, 12, kc('tekko', 1)); outline(c, 17, 27, 14, 4)   # 벽 받침대
    outline(c, 1, 2, W - 2, 25)


@R.obj('kr-speaker', '노래방 스피커', w=1, h=1, up=16, kind='wall', cat=KR, cat_ko=KR_KO, use=('switch',),
       tags=TK + ('노래방 방', '스피커', '파티룸'), place='방 북쪽 벽 바로 아래, 화면 양옆(한두 개)', pair=('kr-screen', 'kr-mic-stand'),
       desc='검은 바닥형 스피커 — 윗면이 보이는 검은 상자, 앞에 큰 우퍼·작은 트위터 원과 파란 전원 불. 화면 양옆 벽 앞에 선다.')
def _kr_speaker(c):
    tall_box(c, 2, 8, 12, 23, 'yoru', -1, top=4)
    eave(c, 2, 13, 12, 'yoru', -1)
    ring(c, 8, 24, 4.5, kc('tekko', 0)); disc(c, 8, 24, 3.5, 3.5, kc('sumi', 0)); disc(c, 8, 24, 1.5, 1.5, kc('yoru', 0)); px(c, 7, 23, kc('tekko', 2))   # 우퍼
    ring(c, 8, 17, 2.2, kc('tekko', 1)); px(c, 8, 17, kc('yoru', 1))                                  # 트위터
    px(c, 12, 15, kc('sora', 2)); px(c, 11, 29, kc('yoru', 1))
    hl(c, 3, 30, 10, kc('sumi', 0))


@R.obj('kr-speaker-hang', '벽걸이 스피커', w=1, kind='hang', hrows=2, cat=KR, cat_ko=KR_KO, use=('switch',),
       tags=TK + ('노래방 방', '스피커'), place='작은 방 북쪽 벽면 윗줄 구석(화면 옆) — 바닥 자리가 모자란 방에',
       desc='천장 밑 벽 구석에 브래킷으로 단 검은 스피커 — 아래로 기울어 앞면의 우퍼·트위터 원이 보이고, 밑에 브래킷 팔. 바닥을 차지하지 않는다.')
def _kr_speaker_hang(c):
    rc(c, 7, 0, 2, 3, kc('tekko', 0)); vl(c, 7, 0, 3, kc('tekko', 2))                                  # 브래킷 팔
    rc(c, 3, 3, 10, 3, kc('yoru', 1)); hl(c, 3, 3, 10, kc('yoru', 2))                                  # 윗면(기울어 보임)
    rc(c, 3, 6, 10, 14, kc('yoru', -2)); vl(c, 3, 6, 14, kc('yoru', 0)); vl(c, 12, 6, 14, kc('sumi', 0))
    outline(c, 2, 3, 12, 18)
    ring(c, 8, 15, 3.5, kc('tekko', 0))
    disc(c, 8, 15, 2.5, 2.5, kc('sumi', 0)); px(c, 7, 14, kc('tekko', 1))
    ring(c, 8, 9, 1.8, kc('tekko', 1)); px(c, 8, 9, kc('yoru', 1))
    px(c, 11, 7, kc('sora', 2))
    hl(c, 3, 21, 10, kc('murasaki', -2))                                                              # 벽에 진 그림자


@R.obj('kr-mic-stand', '마이크 스탠드', w=1, h=1, up=16, kind='floor', cat=KR, cat_ko=KR_KO, use=('push',),
       tags=TK + ('노래방 방', '마이크', '파티룸'), place='화면 앞 빈 바닥(노래하는 자리) — 소파·탁자와 한 칸 띄운다', pair=('kr-screen', 'kr-speaker'),
       desc='은색 마이크 스탠드 — 둥근 무거운 받침 위로 가는 봉, 꼭대기에 기울어진 무선 마이크(둥근 망 머리), 받침에 감긴 검은 줄. 노래하는 자리에 하나.')
def _kr_mic(c):
    disc(c, 8, 28, 5, 2.2, kc('tekko', -1)); disc(c, 7.5, 27.5, 4, 1.5, kc('tekko', 1)); px(c, 6, 27, kc('tekko', 3))   # 받침
    vl(c, 8, 9, 19, kc('tekko', 2)); vl(c, 9, 9, 19, kc('tekko', -1))                                  # 봉
    rc(c, 7, 17, 4, 2, kc('tekko', -2)); px(c, 7, 17, kc('tekko', 1))                                  # 높이 조절 마디
    for i in range(4): px(c, 9 + i, 8 - i, kc('tekko', 0))                                            # 기울인 홀더 팔
    rc(c, 11, 2, 3, 5, kc('yoru', 0)); vl(c, 11, 2, 5, kc('yoru', 1))                                  # 마이크 몸통
    disc(c, 12.5, 1.8, 2.3, 1.8, kc('tekko', 1)); px(c, 12, 1, kc('tekko', 3)); px(c, 13, 2, kc('tekko', -1))   # 둥근 망 머리
    for (x, y) in ((4, 29), (3, 28), (3, 27), (4, 26), (5, 26)): px(c, x, y, kc('sumi', 0))           # 감긴 줄
    hl(c, 4, 30, 9, kc('murasaki', -2))


@R.obj('kr-mirror-ball', '미러볼', w=1, kind='hang', hrows=2, cat=KR, cat_ko=KR_KO, use=('light',),
       tags=TK + ('노래방 방', '파티룸', '조명'), place='파티룸 북쪽 벽면 윗줄(화면 옆) — 천장에서 사슬로 내려온 것처럼 건다',
       desc='천장 띠에서 사슬로 매단 미러볼 — 은빛 작은 거울 조각 격자와 반짝이, 둘레 벽에 청록·노랑 빛 점이 흩어진다.')
def _kr_ball(c):
    for y in range(0, 7): px(c, 8, y, kc('tekko', 2 if y % 2 else 0))                                 # 사슬
    disc(c, 8, 13, 5.5, 5.5, kc('tekko', 0))
    for y in range(7, 20):
        for x in range(2, 15):
            if c.a[y, x, 3] and ((x // 2) + (y // 2)) % 2 == 0:
                px(c, x, y, kc('tekko', 2) if (x < 8 and y < 13) else kc('tekko', 1))
            if c.a[y, x, 3] and (x % 2 == 0 or y % 2 == 0): px(c, x, y, kc('tekko', -1) if x > 9 or y > 15 else kc('conc', 1))
    for (x, y) in ((5, 10), (6, 9), (9, 15), (4, 13)): px(c, x, y, kc('shiro', 2))                    # 반짝
    px(c, 6, 11, kc('neonC', 1)); px(c, 10, 11, kc('neonP', 1))
    outline_round = [(x, y) for y in range(6, 21) for x in range(1, 16) if c.a[y, x, 3] and not c.a[y, x + 1, 3] and x > 8]
    for (x, y) in outline_round: px(c, x, y, kc('tekko', -2))
    for (x, y, col) in ((1, 4, 'neonC'), (14, 3, 'kii'), (2, 24, 'kii'), (13, 27, 'neonC'), (15, 20, 'neonP'), (0, 18, 'neonP')):   # 벽에 흩어진 빛 점
        px(c, x, y, kc(col, 1))


@R.obj('kr-poster', '노래방 홍보 포스터', w=1, kind='hang', hrows=2, cat=KR, cat_ko=KR_KO, use=('read',),
       tags=TK + ('복도', '로비', '게시'), place='복도·로비 벽면 윗줄(방문 사이)',
       desc='액자에 넣은 홍보 포스터 한 장 — 짙은 남색 바탕에 은빛 마이크 그림과 분홍·노랑 빛 줄, 아래 색 띠(글자·로고·사람 없음).')
def _kr_poster(c):
    rc(c, 3, 3, 10, 17, kc('kon', -1)); outline(c, 2, 2, 12, 19, kc('tekko', 1)); hl(c, 2, 2, 12, kc('tekko', 3))
    for i in range(5): px(c, 4 + i, 4 + i, kc('neonP', 0)); px(c, 11 - i, 4 + i, kc('kii', 1))        # 빛 줄
    disc(c, 8, 9, 2, 2, kc('tekko', 2)); px(c, 7, 8, kc('shiro', 2))                                  # 마이크 머리
    rc(c, 7, 11, 2, 4, kc('tekko', 0)); px(c, 7, 11, kc('tekko', 2))
    rc(c, 4, 16, 8, 2, kc('pinku', 1)); hl(c, 4, 18, 6, kc('kii', 1))
    hl(c, 3, 21, 10, kc('murasaki', -2))


# ══ 만화 카페 ════════════════════════════════════════════════════════════════
@R.obj('kr-manga-shelf', '만화책 서가(벽)', w=2, h=1, up=16, kind='wall', cat=MC, cat_ko=MC_KO, use=('read', 'search'),
       tags=TM + ('서가', '만화'), place='북쪽 벽 바로 아래 — 좌우로 이어 붙여 벽 한 면을 채운다. 앞 한 줄은 통로',
       pair=('kr-manga-island', 'kr-manga-stack'),
       desc='벽에 붙은 밝은 나무 만화책 서가 2칸 — 윗면과 처마 그늘 아래 5단에 얇은 책등이 빽빽이(두세 권씩 같은 색 시리즈, 가끔 낮은 권), 글자 없음.')
def _kr_manga_shelf(c):
    W = 32
    tall_box(c, 0, 1, W, 31, 'yuka', 1, top=4)
    eave(c, 0, 6, W, 'yuka', 1)
    for r in range(5):
        y = 8 + r * 5
        rc(c, 1, y, 30, 4, kc('yuka', -2))
        spines(c, 2, y, 28, 4, 30 + r, gap_every=0 if r % 2 else 11)
        hl(c, 1, y + 4, 30, kc('yuka', 2))                                                            # 선반 판 앞날
    vl(c, 15, 7, 24, kc('yuka', 0)); vl(c, 16, 7, 24, kc('yuka', 2))                                  # 가운데 칸막이
    hl(c, 1, 31, 30, OL)


@R.obj('kr-manga-island', '만화책 양면 서가', w=2, h=1, up=16, kind='floor', cat=MC, cat_ko=MC_KO, use=('read', 'search'),
       tags=TM + ('서가', '만화'), place='서가 줄 — 바닥 가운데에 가로로 놓고 남북 양쪽을 통로로(줄 사이 1~2칸)',
       pair=('kr-manga-shelf', 'kr-manga-stack'),
       desc='바닥에 홀로 선 양면 만화책 서가 2칸 — 위에서 반대쪽 책 머리가 보이는 윗면, 남쪽 면 4단에 빽빽한 책등, 아래 받침. 줄지어 놓아 서가 통로를 만든다.')
def _kr_manga_island(c):
    W = 32
    rc(c, 0, 4, W, 6, kc('yuka', 2)); hl(c, 0, 4, W, kc('yuka', 1))                                   # 윗면(위판)
    spines(c, 2, 5, 28, 3, 77)                                                                        # 위판 사이로 보이는 북쪽 면 책 머리
    hl(c, 1, 8, 30, kc('yuka', 2))
    hl(c, 0, 10, W, kc('kinari', 2))                                                                  # 앞 가장자리 하이라이트
    eave(c, 0, 11, W, 'yuka', 1)
    for r in range(4):
        y = 13 + r * 4
        rc(c, 1, y, 30, 3, kc('yuka', -2))
        spines(c, 2, y, 28, 3, 50 + r, gap_every=13 if r == 2 else 0)
        hl(c, 1, y + 3, 30, kc('yuka', 1))
    rc(c, 1, 29, 30, 2, kc('ita', -1)); hl(c, 1, 29, 30, kc('ita', 0))                                # 받침
    vl(c, 1, 11, 18, kc('yuka', 2)); vl(c, 30, 11, 18, kc('yuka', -1)); vl(c, 15, 12, 17, kc('yuka', 0))
    outline(c, 0, 4, W, 28)


BOOTH = 'tekko'


def _booth(c, door_south):
    """개인 부스 1×2(위로 16 솟음, 캔버스 16×48). 칸막이 = 짙은 청회색 판, 윗날 밝음.
    door_south: 남쪽(카메라 쪽)에 문 — 앞면에 문짝이 보인다. 아니면 북쪽에 문(안쪽 면으로 보인다), 남쪽은 막힌 등판."""
    m = BOOTH
    # 뒤(북) 칸막이 윗날 + 안쪽 면
    rc(c, 0, 0, 16, 3, kc(m, 2)); hl(c, 0, 0, 16, kc(m, 3)); hl(c, 0, 2, 16, kc(m, 0))
    rc(c, 1, 3, 14, 9, kc(m, -1)); hl(c, 1, 3, 14, kc(m, -2))
    # 옆 칸막이 윗날(위에서 본 얇은 판, 이웃 부스와 합쳐 2px 벽)
    rc(c, 0, 0, 1, 31, kc(m, 2)); rc(c, 15, 0, 1, 31, kc(m, 1))
    # 바닥(부스 안, 카펫보다 한 단 어둡게)
    rc(c, 1, 12, 14, 18, kc('hodo', 0))
    if door_south:
        rc(c, 2, 5, 12, 6, kc('yoru', -1)); rc(c, 3, 6, 10, 4, kc('garasu', 0)); hl(c, 3, 6, 10, kc('sora', 1)); px(c, 4, 7, kc('neonC', 0))   # 모니터(뒤 벽에 붙음)
        hl(c, 4, 8, 6, kc('sora', 0))
        rc(c, 1, 11, 14, 4, kc('yuka', 1)); hl(c, 1, 11, 14, kc('yuka', 2)); hl(c, 1, 14, 14, kc('yuka', -1))   # 책상 상판
        rc(c, 4, 12, 7, 2, kc('shiro', 1)); hl(c, 4, 12, 7, kc('shiro', 2))                           # 키보드
        rc(c, 3, 17, 10, 7, kc('yoru', 0)); hl(c, 3, 17, 10, kc('yoru', 1)); outline(c, 2, 16, 12, 9)  # 의자 등받이(북쪽 화면을 봄)
        rc(c, 5, 15, 6, 1, kc('yoru', -1))
        # 앞(남) 칸막이: 윗날 + 앞면 문
        rc(c, 0, 26, 16, 3, kc(m, 2)); hl(c, 0, 26, 16, kc(m, 3)); hl(c, 0, 28, 16, kc(m, 1))
        rc(c, 0, 29, 16, 19, kc(m, 0)); vl(c, 0, 29, 19, kc(m, 1)); vl(c, 15, 29, 19, kc(m, -1))
        rc(c, 3, 30, 10, 17, kc(m, -1)); outline(c, 2, 29, 12, 19, kc(m, -2))                         # 문짝(들어간 면)
        hl(c, 3, 30, 10, kc(m, -2)); vl(c, 3, 31, 15, kc(m, 0))
        rc(c, 5, 32, 6, 3, kc('shiro', 1)); hl(c, 5, 32, 6, kc('shiro', 2))                           # 자리 표지판(색 판, 글자 없음)
        rc(c, 10, 38, 2, 3, kc('tekko', 3)); px(c, 10, 40, kc('tekko', 1))                            # 손잡이
        hl(c, 1, 47, 14, OL)
    else:
        rc(c, 3, 3, 10, 9, kc('ita', 0)); vl(c, 3, 3, 9, kc('ita', 2)); vl(c, 12, 3, 9, kc('ita', -2))   # 북쪽 문 안쪽 면(나무 문짝)
        hl(c, 3, 3, 10, kc('ita', 1)); rc(c, 5, 5, 6, 2, kc('shiro', 1)); hl(c, 5, 5, 6, kc('shiro', 2))   # 자리 표지판(색 판, 숫자 없음)
        rc(c, 10, 8, 2, 1, kc('tekko', 3)); hl(c, 3, 11, 10, kc('ita', -3))                           # 손잡이 · 문 밑 그늘
        rc(c, 4, 13, 8, 5, kc('kon', 0)); hl(c, 4, 13, 8, kc('kon', 1)); vl(c, 4, 13, 5, kc('kon', 1)); outline(c, 3, 12, 10, 7)   # 남쪽을 보는 의자 좌판
        rc(c, 5, 18, 6, 2, kc('kon', -1)); hl(c, 4, 19, 8, OL)
        rc(c, 1, 21, 14, 5, kc('yuka', 1)); hl(c, 1, 21, 14, kc('yuka', 2)); rc(c, 4, 22, 7, 2, kc('shiro', 1))   # 책상 + 키보드
        rc(c, 3, 24, 10, 3, kc('yoru', -1)); hl(c, 3, 24, 10, kc('yoru', 0)); px(c, 12, 25, kc('neonC', 0))   # 모니터 뒷면(남쪽 칸막이에 붙음)
        # 앞(남) 칸막이 = 막힌 등판
        rc(c, 0, 27, 16, 3, kc(m, 2)); hl(c, 0, 27, 16, kc(m, 3)); hl(c, 0, 29, 16, kc(m, 1))
        rc(c, 0, 30, 16, 18, kc(m, 0)); vl(c, 0, 30, 18, kc(m, 1)); vl(c, 15, 30, 18, kc(m, -1))
        for y in (36, 42): hl(c, 1, y, 14, kc(m, -1)); hl(c, 1, y + 1, 14, kc(m, 1))                  # 판 이음
        hl(c, 1, 47, 14, OL)


@R.obj('kr-booth', '개인 부스(문 남쪽)', w=1, h=2, up=16, kind='floor', cat=MC, cat_ko=MC_KO, use=('sit',), facing='N',
       tags=TM + ('부스', '개인실'), place='북쪽 벽 바로 아래나 부스 줄 — 가로로 이어 붙이고 문이 보는 남쪽 한 줄은 통로(2줄)로 비운다',
       pair=('kr-booth-n', 'kr-pc-desk'),
       desc='넷카페 개인 부스 한 칸(1×2) — 짙은 청회색 칸막이 안에 모니터 책상과 검은 의자가 위로 보이고, 남쪽 앞면에 들어간 문짝·자리 표지판(색 판, 숫자 없음)·손잡이. 가로로 이어 붙이면 칸막이가 이어진다.')
def _kr_booth(c): _booth(c, True)


@R.obj('kr-booth-n', '개인 부스(문 북쪽)', w=1, h=2, up=16, kind='floor', cat=MC, cat_ko=MC_KO, use=('sit',), facing='S',
       tags=TM + ('부스', '개인실'), place='부스 줄을 등 맞대어 두 줄로 놓을 때 남쪽 줄 — 문이 북쪽 통로를 본다. 남쪽은 막힌 등판',
       pair=('kr-booth',),
       desc='넷카페 개인 부스 한 칸(1×2) — 문이 북쪽에 있어 위에서 문 안쪽 면이 보이고, 안에 남쪽을 보는 의자와 모니터 책상, 남쪽 앞면은 막힌 칸막이 등판. kr-booth 줄과 등을 맞대어 둔다.')
def _kr_booth_n(c): _booth(c, False)


@R.obj('kr-reclining-seat', '리클라이닝 의자(북향)', w=1, h=1, up=8, kind='floor', cat=MC, cat_ko=MC_KO, use=('sit',), facing='N',
       tags=TM + ('오픈석', '의자'), place='오픈석 — PC 책상(kr-pc-desk) 바로 남쪽에 붙여 책상을 보게 놓는다',
       pair=('kr-pc-desk',),
       desc='검은 가죽 리클라이닝 의자 — 뒤에서 본 높은 등받이와 머리 받침, 양옆 팔걸이 윗면, 아래 둥근 받침. 북쪽 PC 책상을 본다.')
def _kr_recliner(c):
    m = 'yoru'
    rc(c, 1, 12, 3, 10, kc(m, 0)); hl(c, 1, 12, 3, kc(m, 2)); outline(c, 0, 11, 5, 12)               # 왼 팔걸이
    rc(c, 12, 12, 3, 10, kc(m, -1)); hl(c, 12, 12, 3, kc(m, 1)); outline(c, 11, 11, 5, 12)            # 오른 팔걸이
    rc(c, 4, 1, 8, 6, kc(m, 0)); hl(c, 4, 1, 8, kc(m, 2)); outline(c, 3, 0, 10, 7)                    # 머리 받침
    rc(c, 3, 7, 10, 16, kc(m, -1)); vl(c, 4, 8, 14, kc(m, 1)); vl(c, 11, 8, 14, kc(m, -2)); outline(c, 2, 6, 12, 18)   # 등받이 뒷면
    for y in (12, 17): hl(c, 4, y, 8, kc(m, -2))                                                       # 박음질
    hl(c, 3, 7, 10, kc(m, 1))
    rc(c, 6, 24, 4, 3, kc('tekko', -1)); disc(c, 8, 28.5, 5, 1.8, kc('tekko', 0)); hl(c, 4, 28, 6, kc('tekko', 2))   # 받침


@R.obj('kr-pc-desk', 'PC 책상', w=1, h=1, up=8, kind='floor', cat=MC, cat_ko=MC_KO, use=('read',),
       tags=TM + ('오픈석', 'PC'), place='오픈석 줄 — 가로로 이어 놓고 바로 남쪽에 리클라이닝 의자', pair=('kr-reclining-seat',),
       desc='밝은 나무 PC 책상 한 칸 — 상판 뒤쪽에 하늘빛 화면 모니터(글자 없음)와 받침, 앞에 흰 키보드·마우스, 양옆 칸막이 낮은 판. 가로로 이어 놓는다.')
def _kr_pc_desk(c):
    rc(c, 2, 0, 12, 9, kc('yoru', -1)); outline(c, 1, 0, 14, 10)                                      # 모니터
    rc(c, 3, 1, 10, 7, kc('sora', 0)); hl(c, 3, 1, 10, kc('sora', 1)); rc(c, 4, 3, 5, 1, kc('shiro', 1)); rc(c, 4, 5, 7, 1, kc('neonC', -1))
    px(c, 12, 7, kc('midori', 1))
    rc(c, 7, 10, 2, 2, kc('tekko', -1))
    rc(c, 0, 12, 16, 9, kc('yuka', 1)); hl(c, 0, 12, 16, kc('yuka', 2))                                # 상판
    rc(c, 3, 14, 8, 3, kc('shiro', 1)); hl(c, 3, 14, 8, kc('shiro', 2)); hl(c, 4, 15, 6, kc('conc', 1))   # 키보드
    rc(c, 12, 15, 2, 2, kc('shiro', 1)); px(c, 12, 15, kc('shiro', 2))                                # 마우스
    hl(c, 0, 20, 16, kc('yuka', 2)); rc(c, 0, 21, 16, 2, kc('yuka', -1))                              # 앞 가장자리
    rc(c, 1, 23, 2, 8, kc('yuka', -2)); rc(c, 13, 23, 2, 8, kc('yuka', -2)); vl(c, 1, 23, 8, kc('yuka', 0))   # 다리판
    hl(c, 3, 30, 10, kc('hodo', -1))
    vl(c, 0, 8, 15, kc('yuka', 0)); vl(c, 15, 8, 15, kc('yuka', -2))                                  # 옆 칸막이 낮은 판
    px(c, 0, 8, kc('yuka', 2)); px(c, 15, 8, kc('yuka', 1))
    hl(c, 0, 23, 16, OL)


@R.obj('kr-shower-door', '샤워실 문(반투명 유리, 열림)', kind='door', cat=MC, cat_ko=MC_KO, use=('travel', 'open'),
       tags=TM + ('샤워실', '문'), place='샤워실과 통로 사이 가로 칸막이의 1칸 틈 칸',
       desc='흰 문틀에 반투명 유리 문짝이 동쪽 기둥 쪽으로 열려 붙은 샤워실 문 — 유리에 비친 흰 사선, 은색 손잡이, 바닥 물막이 턱. 가운데로 바닥이 보이고 지나간다.')
def _kr_shower_door(c):
    for x0, f in ((0, 1), (13, -1)):
        rc(c, x0, 0, 3, 32, kc('shiro', 1)); vl(c, x0 + (0 if f > 0 else 2), 0, 32, kc('shiro', 2 if f > 0 else -1))
        vl(c, x0 + (2 if f > 0 else 0), 4, 28, kc('conc', 0 if f > 0 else 2))
    rc(c, 0, 0, 16, 4, kc('shiro', 1)); hl(c, 0, 0, 16, kc('conc', -1)); hl(c, 0, 1, 16, kc('shiro', 2)); hl(c, 0, 3, 16, kc('conc', 0))
    rc(c, 9, 4, 4, 26, kc('garasu', 2)); vl(c, 9, 4, 26, kc('shiro', 1)); vl(c, 12, 4, 26, kc('garasu', 1))   # 반투명 유리 문짝
    for y in range(6, 28, 2): px(c, 10 + (y // 2) % 2, y, kc('shiro', 1))                             # 김 서린 결
    for i in range(4): px(c, 10, 8 + i, kc('shiro', 2))
    rc(c, 9, 16, 1, 4, kc('tekko', 3))
    rc(c, 3, 29, 10, 3, kc('shiro', 1)); hl(c, 3, 29, 10, kc('shiro', 2)); hl(c, 3, 31, 10, kc('conc', -1))   # 물막이 턱


# ══ 탁상 물건 ═════════════════════════════════════════════════════════════════
@R.good('kr-menu', '노래방 메뉴판', desc='펼친 코팅 메뉴판 — 두 쪽에 음식 사진 같은 주황·빨강·노랑 덩이와 회색 줄(글자 없음).')
def _g_menu(c):
    rc(c, 1, 5, 14, 9, kc('shiro', 2)); outline(c, 0, 4, 16, 11, kc('kon', 0)); vl(c, 8, 5, 9, kc('conc', 0))
    disc(c, 4, 8, 2, 1.6, kc('daidai', 1)); px(c, 3, 7, kc('kii', 2)); disc(c, 12, 8, 2, 1.6, kc('aka', 1)); px(c, 11, 7, kc('daidai', 2))
    hl(c, 2, 11, 5, kc('conc', 1)); hl(c, 10, 11, 4, kc('conc', 1)); hl(c, 2, 12, 3, kc('conc', 1)); hl(c, 10, 12, 5, kc('conc', 1))
    hl(c, 1, 15, 14, kc('ita', -2))


@R.good('kr-remote', '노래방 리모컨(곡 넣는 태블릿)', desc='곡을 고르는 검은 태블릿(덴모쿠) — 밝은 청록·하늘 화면에 색 칸 격자(글자 없음), 옆에 작은 펜.')
def _g_remote(c):
    rc(c, 2, 3, 12, 10, kc('yoru', -1)); outline(c, 1, 2, 14, 12)
    rc(c, 3, 4, 10, 8, kc('sora', 1)); hl(c, 3, 4, 10, kc('neonC', 1))
    for j in range(2):
        for i in range(3): rc(c, 4 + i * 3, 6 + j * 3, 2, 2, kc(('pinku', 'kii', 'midori')[(i + j) % 3], 1))
    hl(c, 13, 13, 2, kc('tekko', 2)); px(c, 12, 14, kc('tekko', 0))
    hl(c, 2, 14, 12, kc('ita', -2))


@R.good('kr-glass', '음료 잔', desc='얼음이 든 키 큰 유리잔 — 주황 음료와 흰 얼음 점, 꽂힌 빨대.')
def _g_glass(c):
    rc(c, 5, 5, 6, 9, kc('garasu', 2)); outline(c, 4, 4, 8, 11, kc('garasu', -1))
    rc(c, 5, 8, 6, 6, kc('daidai', 1)); hl(c, 5, 8, 6, kc('daidai', 2)); px(c, 6, 9, kc('shiro', 2)); px(c, 9, 10, kc('shiro', 1))
    vl(c, 5, 5, 9, kc('shiro', 2))
    for i in range(5): px(c, 9 + (i // 3), 1 + i, kc('aka', 1))                                        # 빨대
    hl(c, 4, 15, 8, kc('ita', -2))


@R.good('kr-tambourine', '탬버린', desc='빨강 테두리 탬버린 — 둥근 테에 노란 금속 방울 짝이 돌아가며 박혀 있고 가운데 흰 막.')
def _g_tamb(c):
    disc(c, 8, 9, 6, 4.5, kc('aka', 0)); disc(c, 8, 8.5, 4.5, 3, kc('shiro', 2)); hl(c, 5, 6, 5, kc('shiro', 2))
    ring(c, 8, 9, 6.2, kc('aka', -1))
    for (x, y) in ((3, 8), (13, 8), (8, 4), (8, 13), (4, 12), (12, 12)):
        px(c, x, y, kc('kii', 2)); px(c, x + 1, y, kc('kii', 0))
    hl(c, 4, 14, 9, kc('ita', -2))


@R.good('kr-manga-stack', '만화책 더미', desc='쌓아 둔 만화책 네 권 — 권마다 다른 색 표지 가장자리와 흰 종이 단면.')
def _g_manga(c):
    for i, col in enumerate(('aka', 'sora', 'kii', 'midori')):
        y = 12 - i * 3; x = 3 + (i % 2)
        rc(c, x, y, 10, 3, kc('shiro', 1)); hl(c, x, y, 10, kc(col, 1)); vl(c, x, y, 3, kc(col, 0)); hl(c, x, y + 2, 10, kc('conc', 0))
        vl(c, x + 9, y, 3, kc(col, -1))
    hl(c, 2, 15, 12, kc('ita', -2))


def build(): return R.build()


def selftest(): return R.selftest()


if __name__ == '__main__':
    bad = run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK))
    sys.exit(1 if bad else 0)
