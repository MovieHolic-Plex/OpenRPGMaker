#!/usr/bin/env python3
"""jp_city 일본 실내 — 거실·다이닝·부엌(LDK) 블록 interior_ldk.
틀: interior/ikit.py(칸 자르기·그림자·통행·사양 굽기는 틀이 한다). 여기는 그림 함수만.
3/4 시점: 가로면은 윗면(밝게, 위 1px 림)+남쪽 앞면. 빛은 왼쪽 위. 색은 K(램프, 단)만, 반투명 없음.

크기표(1칸 = 16px = 1m, 윗면 T + 앞면 F 가 발밑 칸 높이를 채운다)
  소파 2인   W26 F12 T4 (2×1) · 식탁 W24 F12 T4 (자동 이어붙임, 2×1 = 4인) · 의자 W7 F12 T4
  냉장고 W12 F27 T5 (1×2, 윤곽 포함 14) · 책장·식기장 W14 F28 T4 (1×2)
  주방 붙박이 W16(이음 없이 이어짐) F12 T4 · 화분 W6 F12 · 쓰레기통 W4~6 F10 · 좌탁 W26 F11 T5
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, default_ceiling, run_block, ROOT   # noqa

BLOCK = 'interior_ldk'
R = Registry(BLOCK, 'LDK')


def box(c, x, y, w, h, col):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def ell(c, cx, cy, rx, ry, m, ol=True, hi=True):
    """타원 덩이. 왼쪽 위 밝게, 오른쪽 아래 어둡게, 가장자리 한 줄은 윤곽."""
    def inside(x, y): return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if not inside(x, y): continue
            if ol and not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.P(x, y, K(m, -2)); continue
            t = (x + .5 - cx) / rx * 0.6 + (y + .5 - cy) / ry * 0.8
            c.P(x, y, K(m, (2 if t < -0.5 else 1 if t < -0.1 else -1 if t > 0.5 else 0) if hi else 0))


# ───────────────────────── 부엌: 붙박이 한 줄 (싱크·조리대·가스대) ─────────────────────────
# 세 조각은 같은 윗면 높이(발밑 칸 맨 위 4px)·같은 림·같은 문 리듬(문 7줄 + 발받침 3줄)이라 나란히 놓으면 이음이 이어진다.
def run_top(c, yb):
    c.R(0, yb, 16, 4, K('conc', 1)); c.HL(0, yb, 16, K('conc', 3)); c.HL(0, yb + 3, 16, K('conc', -1))
    c.VL(0, yb + 1, 3, K('conc', 2)); c.VL(15, yb + 1, 3, K('conc', 0))


def run_front(c, yb, doors=2, oven=False):
    c.R(0, yb + 4, 16, 12, K('shiro', 1)); c.HL(0, yb + 4, 16, K('shiro', 2)); c.HL(0, yb + 5, 16, K('shiro', -1))
    c.VL(0, yb + 4, 12, K('shiro', 2)); c.VL(15, yb + 4, 9, K('shiro', -1))
    c.HL(0, yb + 13, 16, K('tekko', 0)); c.R(0, yb + 14, 16, 2, K('tekko', -2))            # 발받침
    if oven:
        c.R(2, yb + 6, 12, 7, K('shiro', 0)); box(c, 2, yb + 6, 12, 7, K('shiro', -1))
        c.R(4, yb + 8, 8, 3, K('yoru', -1)); c.HL(4, yb + 8, 8, K('yoru', 1)); c.HL(3, yb + 7, 10, K('conc', 1))   # 오븐 창·손잡이 막대
        for x in (3, 7, 12): c.P(x, yb + 5, K('conc', -2))                                       # 다이얼
        return
    c.HL(0, yb + 12, 16, K('shiro', -1))
    if doors == 2:
        c.VL(7, yb + 6, 7, K('shiro', -1)); c.VL(8, yb + 6, 7, K('shiro', 2))
        c.VL(5, yb + 7, 2, K('conc', -2)); c.VL(10, yb + 7, 2, K('conc', -2))
    else:
        c.VL(11, yb + 7, 2, K('conc', -2))


@R.obj('kitchen-sink', '싱크대', 1, 1, up=16, kind='wall', surface=True, use=('search',),
       desc='붙박이 주방의 싱크. 윗면 안쪽이 파인 수조와 목이 휜 수전이 벽 쪽으로 솟는다. 조리대·가스대와 같은 높이로 이어진다.',
       tags=('부엌', '주방'), place='북쪽 벽면 아래에 붙여 조리대·가스대와 한 줄로', pair=('kitchen-worktop', 'kitchen-stove'))
def kitchen_sink(c):
    yb = 16
    run_top(c, yb); run_front(c, yb, 2)
    c.HL(0, yb - 2, 16, K('conc', 3)); c.HL(0, yb - 1, 16, K('conc', 0))                            # 뒷턱(벽 앞 물막이)
    c.R(2, yb + 1, 9, 2, K('conc', -2)); c.HL(2, yb + 1, 9, K('conc', -3)); c.HL(2, yb + 2, 9, K('conc', 0))   # 수조
    c.VL(12, yb - 7, 8, K('conc', 2)); c.VL(13, yb - 7, 7, K('conc', -3)); c.HL(8, yb - 8, 6, K('conc', 3))
    c.HL(8, yb - 9, 6, K('conc', -3)); c.VL(8, yb - 7, 2, K('conc', 1)); c.P(8, yb - 5, K('conc', -2))   # 수전 목+주둥이
    c.R(11, yb - 3, 3, 2, K('conc', 0)); c.P(11, yb - 3, K('conc', 3))                              # 손잡이 몸통


@R.obj('kitchen-worktop', '조리대', 1, 1, up=16, kind='wall', surface=True, use=('search',),
       desc='붙박이 주방의 조리대(작업 공간). 싱크·가스대와 윗면 높이·림·문 리듬이 같아 한 줄로 이어 붙인다.',
       tags=('부엌', '주방'), place='북쪽 벽면 아래, 싱크와 가스대 사이', pair=('kitchen-sink', 'kitchen-stove'))
def kitchen_worktop(c):
    yb = 16
    run_top(c, yb); run_front(c, yb, 2)
    c.HL(0, yb - 2, 16, K('conc', 3)); c.HL(0, yb - 1, 16, K('conc', 0))
    c.HL(3, yb + 1, 10, K('conc', 2)); c.HL(3, yb + 2, 6, K('conc', 0))                              # 도마 자리 결


@R.obj('kitchen-stove', '가스대·후드', 1, 1, up=32, kind='wall', surface=True, use=('search',),
       desc='붙박이 주방의 2구 레인지. 윗면에 화구 두 개, 앞면은 오븐 문·다이얼, 위로 벽면에 후드와 굴뚝이 솟는다.',
       tags=('부엌', '주방'), place='북쪽 벽면 아래(벽면 2줄 안에 후드), 싱크 옆', pair=('kitchen-sink', 'kitchen-worktop'))
def kitchen_stove(c):
    yb = 32
    c.R(0, yb, 16, 4, K('yoru', -1)); c.HL(0, yb, 16, K('conc', 2)); c.HL(0, yb + 3, 16, K('conc', -1))
    c.VL(0, yb + 1, 3, K('conc', 2)); c.VL(15, yb + 1, 3, K('conc', 0))
    for bx in (2, 9):                                                                              # 화구 2개
        c.HL(bx + 1, yb + 1, 4, K('conc', 0)); c.HL(bx, yb + 2, 6, K('conc', -1)); c.HL(bx + 2, yb + 1, 2, K('yoru', -3))
    run_front(c, yb, oven=True)
    c.HL(1, yb - 2, 14, K('conc', 3)); c.HL(1, yb - 1, 14, K('conc', 0))                           # 뒷턱
    c.R(5, 3, 6, 10, K('tekko', 0)); c.VL(5, 3, 10, K('tekko', 2)); c.VL(10, 3, 10, K('tekko', -2)); c.HL(4, 2, 8, K('tekko', 3))   # 굴뚝
    for y, x0, x1 in ((13, 3, 12), (14, 2, 13), (15, 2, 13), (16, 1, 14), (17, 1, 14)):          # 후드 사다리꼴
        c.HL(x0, y, x1 - x0 + 1, K('tekko', 1)); c.P(x0, y, K('tekko', 3)); c.P(x1, y, K('tekko', -2))
    c.HL(1, 18, 14, K('tekko', -1)); c.HL(1, 19, 14, K('tekko', -3)); c.HL(2, 20, 12, K('tekko', -2))   # 후드 밑단
    for x in range(4, 12, 2): c.P(x, 19, K('conc', 0))                                              # 필터 홈


# ───────────────────────── 부엌 수납·쓰레기 ─────────────────────────
@R.obj('fridge', '냉장고', 1, 2, up=0, kind='wall', use=('open',),
       desc='2도어 냉장고(위 냉동·아래 냉장). 윗면 4px가 보이고 오른쪽에 세로 손잡이, 앞면은 안쪽으로 들어간다.',
       tags=('부엌', '주방'), place='북쪽 벽면 아래, 붙박이 줄 끝', pair=('kitchen-worktop',))
def fridge(c):
    o = K('conc', -3)
    c.R(2, 0, 12, 4, K('shiro', 2)); c.HL(2, 0, 12, K('shiro', 2)); c.HL(2, 3, 12, K('shiro', -1))
    c.R(2, 4, 12, 28, K('shiro', 1)); c.VL(2, 4, 28, K('shiro', 2)); c.VL(3, 6, 25, K('shiro', 2)); c.VL(13, 4, 28, K('shiro', -1))
    c.HL(2, 4, 12, K('shiro', 2)); c.HL(2, 5, 12, K('shiro', -1))
    c.HL(2, 14, 12, K('conc', -2)); c.HL(2, 15, 12, K('shiro', 2))                                  # 냉동/냉장 이음
    c.R(3, 29, 10, 3, K('tekko', -2)); c.HL(3, 29, 10, K('tekko', 0))                               # 발받침
    for y0, h in ((8, 4), (19, 8)):                                                                 # 손잡이
        c.VL(11, y0, h, K('conc', -2)); c.VL(10, y0, h, K('conc', 2))
    c.VL(1, 1, 31, o); c.VL(14, 1, 31, o); c.HL(2, 0, 12, o); c.P(1, 0, None)


@R.obj('microwave-rack', '레인지 선반', 1, 2, up=16, kind='wall', surface=True, use=('search',),
       desc='철제 레인지 선반. 맨 위에 전자레인지가 얹히고 중간·아래 칸에 밥솥 상자·바구니가 들어 있다(탁상 전자레인지 대신 쓴다).',
       tags=('부엌', '주방'), place='북쪽 벽면 아래, 냉장고 옆', pair=('fridge',))
def microwave_rack(c):
    m = 'tekko'
    for y0 in (19, 31, 43):                                                                          # 선반 3단 (윗면+앞 테두리)
        c.R(1, y0, 14, 3, K(m, 2)); c.HL(1, y0, 14, K(m, 3)); c.HL(1, y0 + 2, 14, K(m, -1))
    c.R(1, 21, 2, 27, K(m, 0)); c.VL(1, 19, 29, K(m, 2)); c.R(13, 21, 2, 27, K(m, -1)); c.VL(14, 19, 29, K(m, -2))   # 기둥
    c.HL(1, 47, 14, K(m, -3)); c.P(1, 47, K(m, -3))
    # 전자레인지(맨 위)
    c.R(3, 10, 10, 9, K('shiro', 1)); c.HL(3, 10, 10, K('shiro', 2)); c.HL(3, 11, 10, K('shiro', -1)); box(c, 3, 10, 10, 9, K('conc', -3))
    c.R(4, 12, 6, 5, K('yoru', -1)); c.HL(4, 12, 6, K('yoru', 1)); c.VL(11, 12, 5, K('conc', -2)); c.P(12, 13, K('conc', 1))
    # 중간 칸: 밥솥 상자·바구니
    c.R(4, 24, 5, 7, K('shiro', 0)); box(c, 4, 24, 5, 7, K('conc', -3)); c.HL(4, 24, 5, K('shiro', 2)); c.P(6, 26, K('aka', 0))
    c.R(10, 26, 3, 5, K('ki', 0)); box(c, 10, 26, 3, 5, K('ki', -3)); c.HL(10, 26, 3, K('ki', 2))
    # 아래 칸: 바구니 두 개
    c.R(4, 37, 4, 6, K('sora', 0)); box(c, 4, 37, 4, 6, K('sora', -2)); c.HL(4, 37, 4, K('sora', 2))
    c.R(9, 38, 4, 5, K('midori', 0)); box(c, 9, 38, 4, 5, K('midori', -2)); c.HL(9, 38, 4, K('midori', 2))


@R.obj('cupboard', '식기장', 1, 2, up=0, kind='wall', use=('open',),
       desc='유리문 식기장. 위쪽 유리 안에 접시·그릇이 보이고 아래는 나무 문 수납. 윗면 4px·앞면은 안쪽으로 들어간다.',
       tags=('부엌', '다이닝'), place='북쪽 벽면 아래, 냉장고 옆이나 식탁 쪽 벽', pair=('dining',))
def cupboard(c):
    m = 'ki'; o = K(m, -3)
    c.R(2, 0, 12, 4, K(m, 2)); c.HL(2, 0, 12, K(m, 3)); c.HL(2, 3, 12, K(m, -1))
    c.R(2, 4, 12, 28, K(m, 1)); c.VL(2, 4, 28, K(m, 3)); c.VL(13, 4, 28, K(m, -1))
    c.HL(2, 4, 12, K(m, 3)); c.HL(2, 5, 12, K(m, -2))
    # 유리문(위)
    c.R(4, 7, 8, 13, K('garasu', 1)); box(c, 4, 7, 8, 13, K(m, -2)); c.VL(7, 8, 11, K(m, -2)); c.VL(8, 8, 11, K(m, 2))
    for x0 in (5, 9):                                                                               # 접시 쌓임 + 그릇
        c.HL(x0, 10, 2, K('shiro', 2)); c.HL(x0, 11, 2, K('sora', 0)); c.HL(x0, 15, 2, K('shiro', 2)); c.HL(x0, 16, 2, K('shiro', -1))
        c.R(x0, 17, 2, 2, K('daidai', 0)); c.P(x0, 17, K('daidai', 2))
    c.P(5, 8, K('garasu', 3)); c.P(10, 9, K('garasu', 3))                                           # 유리 반사
    # 아래 문
    c.HL(2, 21, 12, K(m, -2)); c.HL(2, 22, 12, K(m, 2))
    c.VL(7, 23, 6, K(m, -2)); c.VL(8, 23, 6, K(m, 2)); c.VL(5, 24, 2, K('conc', -2)); c.VL(10, 24, 2, K('conc', -2))
    c.R(3, 29, 10, 3, K('tekko', -2)); c.HL(3, 29, 10, K('tekko', 0))
    c.VL(1, 1, 31, o); c.VL(14, 1, 31, o); c.HL(2, 0, 12, o)


@R.obj('trash-bins', '분리수거함', 1, 1, up=0, kind='floor', use=('search',),
       desc='분리수거용 쓰레기통 세 개(파랑·초록·노랑 뚜껑). 부엌 구석에 놓는다.',
       tags=('부엌',), place='부엌 줄 끝이나 문 옆 바닥')
def trash_bins(c):
    for x0, m in ((1, 'sora'), (6, 'midori'), (11, 'kii')):
        c.R(x0, 6, 4, 3, K(m, 2)); c.HL(x0, 6, 4, K(m, 2)); box(c, x0, 6, 4, 3, K(m, -2)); c.HL(x0 + 1, 7, 2, K(m, 2))     # 뚜껑 윗면
        c.R(x0, 9, 4, 6, K(m, 0)); c.VL(x0, 9, 6, K(m, 2)); c.VL(x0 + 3, 9, 6, K(m, -1)); c.HL(x0, 14, 4, K(m, -2))
        c.HL(x0, 9, 4, K(m, -1)); c.P(x0 + 1, 11, K('shiro', 2))                                                           # 뚜껑 밑 그늘·표시 점


# ───────────────────────── 다이닝 ─────────────────────────
@R.table('dining', '식탁', desc='나무 식탁 자동 이어붙임. 윗면에 밝은 림, 앞 테두리 3px, 양 끝에만 다리. 2×1 = 4인.', tags=('다이닝', '식탁'))
def dining(c, w, h):
    W, H = w * 16, h * 16; m = 'ki'
    ty1 = H - 10                                                                                    # 윗면 마지막 줄
    c.R(0, 1, W, ty1, K(m, 2)); c.HL(0, 1, W, K(m, 3))
    for y in range(4, ty1, 4):                                                                      # 나뭇결(16 주기 → 이음 반복 가능)
        for x in range(0, W, 16): c.HL(x + (3 if (y // 4) % 2 else 9), y, 5, K(m, 1))
    c.R(0, ty1 + 1, W, 3, K(m, -1)); c.HL(0, ty1 + 1, W, K(m, 1)); c.HL(0, ty1 + 3, W, K(m, -3))      # 앞 테두리
    c.VL(0, 2, ty1 + 2, K(m, 3)); c.VL(W - 1, 2, ty1 + 2, K(m, 0))
    c.P(0, 1, None); c.P(W - 1, 1, None)                                                            # 윗면 모서리 한 점 깎기
    for x0 in (1, W - 3):                                                                           # 다리 (양 끝만)
        c.R(x0, H - 6, 2, 6, K(m, -1)); c.VL(x0, H - 6, 6, K(m, 1)); c.VL(x0 + 1, H - 6, 6, K(m, -3))


def chair(c, d):
    """식탁 의자. 발밑 칸은 아래 16줄(위 16줄 = 등받이가 솟는 부분)."""
    m = 'ki'; yb = 16
    def seat_s(x0, x1):
        c.R(x0, yb + 3, x1 - x0 + 1, 4, K(m, 2)); c.HL(x0, yb + 3, x1 - x0 + 1, K(m, 3)); c.R(x0, yb + 7, x1 - x0 + 1, 2, K(m, -1)); c.HL(x0, yb + 8, x1 - x0 + 1, K(m, -3))
    if d == 's':                        # 남쪽을 봄: 등받이가 좌석 뒤(북쪽)로 솟고 앞면이 보인다
        c.R(4, 6, 8, 10, K(m, 0)); box(c, 4, 6, 8, 10, K(m, -3)); c.HL(5, 7, 6, K(m, 3)); c.HL(5, 11, 6, K(m, -1)); c.HL(5, 13, 6, K(m, -1))
        seat_s(4, 11)
        for x in (4, 10): c.R(x, yb + 9, 2, 6, K(m, -1)); c.VL(x, yb + 9, 6, K(m, 1))
    elif d == 'n':                      # 등을 보임: 등받이 뒷면이 좌석을 가린다
        c.R(4, 7, 8, 3, K(m, 2)); c.HL(4, 7, 8, K(m, 3)); box(c, 4, 7, 8, 3, K(m, -3)); c.HL(5, 8, 6, K(m, 3))
        c.R(4, 10, 8, 10, K(m, 0)); c.VL(4, 10, 10, K(m, 2)); c.VL(11, 10, 10, K(m, -2)); c.HL(4, 19, 8, K(m, -3)); c.HL(5, 14, 6, K(m, -1)); c.HL(5, 17, 6, K(m, -1))
        c.VL(3, 10, 10, K(m, -3)); c.VL(12, 10, 10, K(m, -3))
        for x in (4, 10): c.R(x, yb + 5, 2, 10, K(m, -1)); c.VL(x, yb + 5, 10, K(m, 1))
    else:                               # 옆 모습 L자: e = 등받이 서쪽, w = 등받이 동쪽
        e = d == 'e'
        bx = 3 if e else 11                                                                          # 등받이 기둥 x(2폭)
        c.R(bx, 6, 2, 14, K(m, 0)); c.VL(bx if e else bx + 1, 6, 14, K(m, 2 if e else -1)); c.HL(bx, 5, 2, K(m, 3)); c.VL(bx - 1, 6, 14, K(m, -3)); c.VL(bx + 2, 6, 14, K(m, -3))
        sx0, sx1 = (3, 12) if e else (3, 12)
        c.R(sx0, yb + 3, sx1 - sx0 + 1, 3, K(m, 2)); c.HL(sx0, yb + 3, sx1 - sx0 + 1, K(m, 3)); c.R(sx0, yb + 6, sx1 - sx0 + 1, 2, K(m, -1)); c.HL(sx0, yb + 7, sx1 - sx0 + 1, K(m, -3))
        for x in (sx0, sx1 - 1): c.R(x, yb + 8, 2, 7, K(m, -1)); c.VL(x, yb + 8, 7, K(m, 1))


for _d, _ko, _fd in (('s', '남쪽', '남'), ('n', '북쪽', '북'), ('e', '동쪽', '동'), ('w', '서쪽', '서')):
    def _reg(d=_d, ko=_ko, fd=_fd):
        @R.obj('chair-dining-' + d, '식탁 의자(%s 향)' % fd, 1, 1, up=16, kind='floor', use=('sit',), facing=d.upper(),
               desc='식탁 의자. %s을 보고 앉는다. %s' % (ko, {'s': '등받이가 좌석 뒤로 솟고 앞면이 보인다.', 'n': '등받이 뒷면이 보인다.', 'e': '옆모습 L자(등받이 서쪽).', 'w': '옆모습 L자(등받이 동쪽).'}[d]),
               tags=('다이닝', '식탁'), place='식탁 %s에 붙여' % {'s': '북쪽 변(식탁을 보고 남향)', 'n': '남쪽 변(식탁을 보고 북향)', 'e': '서쪽 변', 'w': '동쪽 변'}[d], pair=('dining',))
        def f(c): chair(c, d)
    _reg()


# ───────────────────────── 거실 ─────────────────────────
def sofa_m(): return 'kon'


@R.obj('sofa-s', '소파(남향)', 2, 1, up=16, kind='floor', use=('sit',), facing='S',
       desc='2인 소파. 남쪽(화면 아래)을 보고 앉는다. 등받이 쿠션이 좌석 뒤로 솟고 팔걸이 둘이 양 끝에 선다.',
       tags=('거실',), place='TV 맞은편, 북쪽 TV보드를 보게(소파가 남쪽을 보면 TV는 남쪽)', pair=('low-table', 'tv-board'))
def sofa_s(c):
    m = sofa_m(); o = K(m, -2)
    c.R(6, 5, 20, 3, K(m, 2)); c.HL(6, 5, 20, K(m, 3)); c.R(6, 8, 20, 12, K(m, 0)); c.VL(6, 8, 12, K(m, 1)); c.VL(25, 8, 12, K(m, -1))   # 등받이 윗면+앞면
    c.HL(7, 12, 18, K(m, -1)); c.VL(16, 8, 12, K(m, -1)); box(c, 6, 5, 20, 15, o)
    c.R(6, 19, 20, 4, K(m, 2)); c.HL(6, 19, 20, K(m, 3)); c.VL(16, 19, 4, K(m, 0))                                                      # 좌석 윗면
    c.R(6, 23, 20, 5, K(m, 0)); c.HL(6, 23, 20, K(m, 1)); c.HL(6, 27, 20, K(m, -2)); c.VL(16, 23, 5, K(m, -1)); c.VL(6, 23, 5, K(m, 1))   # 좌석 앞면
    for x0 in (2, 26):                                                                                                                 # 팔걸이
        c.R(x0, 13, 4, 16, K(m, 0)); c.HL(x0, 13, 4, K(m, 3)); c.HL(x0, 14, 4, K(m, 2)); c.VL(x0, 14, 15, K(m, 1)); c.VL(x0 + 3, 14, 15, K(m, -1)); box(c, x0, 13, 4, 16, o)
    for x in (4, 27): c.R(x, 29, 2, 2, K('tekko', -2))                                                                                 # 다리
    c.HL(4, 29, 24, K(m, -2))


@R.obj('sofa-n', '소파(북향)', 2, 1, up=16, kind='floor', use=('sit',), facing='N',
       desc='2인 소파. 북쪽(화면 위)을 보고 앉는다. 등받이 뒷면과 윗면이 보이고 좌석은 가려진다.',
       tags=('거실',), place='방 가운데 북쪽 가구를 마주 보게 띄워 놓기', pair=('low-table',))
def sofa_n(c):
    m = sofa_m(); o = K(m, -2)
    c.R(3, 6, 26, 4, K(m, 2)); c.HL(3, 6, 26, K(m, 3)); c.R(3, 10, 26, 18, K(m, 0)); c.VL(3, 10, 18, K(m, 1)); c.VL(28, 10, 18, K(m, -1))
    c.HL(4, 14, 24, K(m, -1)); c.VL(16, 10, 18, K(m, -1)); c.HL(3, 27, 26, K(m, -2)); box(c, 3, 6, 26, 22, o)
    c.R(1, 12, 3, 16, K(m, 0)); c.VL(1, 12, 16, K(m, 1)); c.HL(1, 12, 3, K(m, 3)); box(c, 1, 12, 3, 16, o)                              # 팔걸이 옆면(뒤로 튀어나옴)
    c.R(28, 12, 3, 16, K(m, -1)); c.HL(28, 12, 3, K(m, 2)); box(c, 28, 12, 3, 16, o)
    for x in (4, 26): c.R(x, 29, 2, 2, K('tekko', -2))


def sofa_side(c, east):
    """1×2 옆보기 소파. east = 동쪽을 봄(등받이 서쪽). 발밑 칸 = 아래 32줄."""
    m = sofa_m(); o = K(m, -2)
    bx0, bx1 = (2, 5) if east else (10, 13)                                      # 등받이 세로띠 x
    sx0, sx1 = (6, 13) if east else (2, 9)                                       # 좌석
    c.R(sx0, 22, sx1 - sx0 + 1, 22, K(m, 2)); c.HL(sx0, 22, sx1 - sx0 + 1, K(m, 3)); c.HL(sx0, 32, sx1 - sx0 + 1, K(m, 0)); c.HL(sx0, 33, sx1 - sx0 + 1, K(m, 3))   # 좌석 윗면(길게)·쿠션 이음
    c.R(sx0, 44, sx1 - sx0 + 1, 2, K(m, 0)); c.HL(sx0, 45, sx1 - sx0 + 1, K(m, -2))                                                                                  # 좌석 앞면
    c.R(bx0, 14, bx1 - bx0 + 1, 31, K(m, 0)); c.R(bx0, 14, bx1 - bx0 + 1, 3, K(m, 3)); c.VL(bx0, 17, 28, K(m, 1)); c.VL(bx1, 17, 28, K(m, -1)); box(c, bx0, 14, bx1 - bx0 + 1, 31, o)
    c.R(sx0, 18, sx1 - sx0 + 1, 5, K(m, 0)); c.HL(sx0, 18, sx1 - sx0 + 1, K(m, 3)); c.HL(sx0, 22, sx1 - sx0 + 1, K(m, -2))                                                 # 북쪽 팔걸이
    c.R(sx0, 40, sx1 - sx0 + 1, 5, K(m, 0)); c.HL(sx0, 40, sx1 - sx0 + 1, K(m, 3)); c.HL(sx0, 41, sx1 - sx0 + 1, K(m, 2)); c.HL(sx0, 44, sx1 - sx0 + 1, K(m, -2))             # 남쪽 팔걸이(앞)
    c.VL(sx0 if east else sx1, 19, 26, K(m, -2)); c.R(3 if east else 12, 46, 2, 2, K('tekko', -2)); c.R(11 if east else 3, 46, 2, 2, K('tekko', -2))


for _e, _ko in ((True, 'e'), (False, 'w')):
    def _regs(east=_e, ko=_ko):
        @R.obj('sofa-' + ko, '소파(%s향)' % ('동' if east else '서'), 1, 2, up=16, kind='floor', use=('sit',), facing=ko.upper(),
               desc='2인 소파 옆모습(1×2). %s쪽을 보고 앉는다. 등받이 세로띠가 %s쪽, 좌석 윗면이 길게 보인다.' % ('동' if east else '서', '서' if east else '동'),
               tags=('거실',), place='방 %s쪽 벽에 등받이를 대고' % ('서' if east else '동'), pair=('low-table',))
        def f(c): sofa_side(c, east)
    _regs()


@R.obj('low-table', '좌탁', 2, 1, up=0, kind='floor', surface=True,
       desc='거실 낮은 탁자. 윗면이 넓게 보이고 짧은 다리. 위에 리모컨·머그 같은 탁상 물건을 놓는다.',
       tags=('거실',), place='소파와 TV보드 사이', pair=('sofa-s', 'rug'))
def low_table(c):
    m = 'ki'
    c.R(2, 2, 28, 7, K(m, 2)); c.HL(2, 2, 28, K(m, 3)); c.VL(2, 3, 6, K(m, 3)); c.VL(29, 3, 6, K(m, 0)); c.P(2, 2, None); c.P(29, 2, None)
    for x in range(4, 28, 8): c.HL(x + 2, 5, 4, K(m, 1))
    c.R(2, 9, 28, 2, K(m, -1)); c.HL(2, 9, 28, K(m, 1)); c.HL(2, 10, 28, K(m, -3))
    for x in (3, 27): c.R(x, 11, 2, 3, K(m, -1)); c.VL(x, 11, 3, K(m, 1)); c.VL(x + 1, 11, 3, K(m, -3))


@R.obj('tv-board', 'TV보드', 2, 1, up=16, kind='wall', surface=True,
       desc='낮은 TV보드와 위에 얹힌 평면 TV. 화면이 벽면 쪽으로 솟는다. 앞면은 문 둘, 윗면은 4px.',
       tags=('거실',), place='북쪽 벽면 아래, 소파를 마주 보게', pair=('sofa-s', 'low-table'))
def tv_board(c):
    yb = 16; m = 'ki'
    c.R(0, yb, 32, 4, K(m, 2)); c.HL(0, yb, 32, K(m, 3)); c.HL(0, yb + 3, 32, K(m, -1)); c.VL(0, yb + 1, 3, K(m, 3))
    c.R(0, yb + 4, 32, 12, K(m, 1)); c.HL(0, yb + 4, 32, K(m, 3)); c.HL(0, yb + 5, 32, K(m, -2)); c.VL(0, yb + 4, 12, K(m, 3)); c.VL(31, yb + 4, 9, K(m, -1))
    c.HL(0, yb + 13, 32, K('tekko', 0)); c.R(0, yb + 14, 32, 2, K('tekko', -2))
    for x0 in (2, 17):                                                                              # 문 둘 + 손잡이
        c.R(x0, yb + 6, 13, 7, K(m, 0)); box(c, x0, yb + 6, 13, 7, K(m, -2)); c.HL(x0 + 1, yb + 7, 11, K(m, 2)); c.P(x0 + 11, yb + 9, K('conc', 1)); c.P(x0 + 11, yb + 10, K('conc', -2))
    c.R(4, 2, 24, 13, K('yoru', -2)); box(c, 3, 1, 26, 15, K('tekko', -2)); c.HL(4, 2, 24, K('tekko', 0))                       # 화면 + 테두리
    for i in range(5): c.P(6 + i, 11 - i, K('yoru', 1)); c.P(7 + i, 11 - i, K('yoru', 0))                                         # 유리 반사
    c.R(13, yb - 1, 6, 1, K('tekko', -1)); c.HL(11, yb, 10, K('tekko', 0))                                                         # 받침


@R.obj('rug', '러그', 3, 2, kind='flat', desc='거실 카펫. 붉은 테두리와 연한 안쪽 마름모 무늬. 걸어 지나간다.',
       tags=('거실',), place='소파·좌탁 밑에 깔기', pair=('sofa-s', 'low-table'))
def rug(c):
    W, H = 48, 32
    c.R(1, 1, W - 2, H - 2, K('aka', 0)); box(c, 1, 1, W - 2, H - 2, K('aka', -2))
    c.HL(2, 2, W - 4, K('aka', 2)); c.R(4, 4, W - 8, H - 8, K('kinari', 1)); box(c, 4, 4, W - 8, H - 8, K('aka', -1))
    for i in range(7):                                                                                # 마름모 줄
        cx = 8 + i * 5
        for dx, dy in ((0, -2), (-1, -1), (1, -1), (-2, 0), (2, 0), (-1, 1), (1, 1), (0, 2)): c.P(cx + dx, 16 + dy, K('aka', 0 if i % 2 else 1))
    for x in range(3, W - 3, 3): c.P(x, 0, K('aka', 1)); c.P(x, H - 1, K('aka', 1))                    # 술
    c.P(1, 1, None); c.P(W - 2, 1, None); c.P(1, H - 2, None); c.P(W - 2, H - 2, None)


@R.obj('houseplant', '화분', 1, 1, up=16, kind='floor', desc='잎 큰 관엽 화분. 갈색 화분에 초록 잎 덩이.', tags=('거실', '다이닝'), place='구석이나 소파 옆')
def houseplant(c):
    for cx, cy, rx, ry, mm in ((8, 13, 5, 5, 'midori'), (5, 18, 4, 4, 'midori'), (11, 17, 4, 4, 'midori'), (8, 21, 4, 3, 'midori')): ell(c, cx, cy, rx, ry, mm)
    c.P(7, 12, K('midori', 2)); c.P(6, 17, K('midori', 2))
    c.R(5, 25, 6, 5, K('daidai', -1)); c.HL(5, 25, 6, K('daidai', 1)); c.VL(5, 26, 4, K('daidai', 1)); c.VL(10, 26, 4, K('daidai', -2)); c.HL(5, 30, 6, K('daidai', -2)); c.HL(6, 25, 4, K('soil', 0))
    c.VL(8, 22, 3, K('midori', -2))


@R.obj('bookshelf', '책장', 1, 2, up=0, kind='wall', surface=False, use=('read',),
       desc='나무 책장. 위 윗면 4px, 앞면은 안으로 들어가고 선반 4칸에 색색 책등이 꽂혀 있다.',
       tags=('거실', '서재'), place='북쪽 벽면 아래')
def bookshelf(c):
    m = 'ki'; o = K(m, -3)
    c.R(2, 0, 12, 4, K(m, 2)); c.HL(2, 0, 12, K(m, 3)); c.HL(2, 3, 12, K(m, -1))
    c.R(2, 4, 12, 28, K(m, 1)); c.VL(2, 4, 28, K(m, 3)); c.VL(13, 4, 28, K(m, -1)); c.HL(2, 4, 12, K(m, 3)); c.HL(2, 5, 12, K(m, -2))
    spines = ['aka', 'sora', 'midori', 'kii', 'murasaki', 'daidai', 'kinari', 'kon', 'aka', 'midori', 'sora', 'kii']
    for r, y0 in enumerate((6, 12, 18, 24)):
        c.R(4, y0, 8, 5, K(m, -3)); c.HL(4, y0, 8, K(m, -2))                                         # 칸 속(어둡게)
        x = 4; n = r * 3
        while x < 12:
            wd = 1 if (n + r) % 3 else 2; hh = 4 - ((n * 7 + r) % 2)
            if x + wd > 12: break
            c.R(x, y0 + 5 - hh, wd, hh, K(spines[n % len(spines)], 0)); c.P(x, y0 + 5 - hh, K(spines[n % len(spines)], 2)); x += wd; n += 1
        c.HL(3, y0 + 5, 10, K(m, 2)); c.HL(3, y0 + 6, 10, K(m, -1))                                  # 선반 판
    c.R(3, 29, 10, 3, K('tekko', -2)); c.HL(3, 29, 10, K('tekko', 0))
    c.VL(1, 1, 31, o); c.VL(14, 1, 31, o); c.HL(2, 0, 12, o)


@R.obj('floor-lamp', '스탠드 조명', 1, 1, up=16, kind='floor', use=('light',),
       desc='갓이 달린 플로어 스탠드. 따뜻한 갓과 가는 기둥, 둥근 받침.', tags=('거실',), place='소파 옆 구석')
def floor_lamp(c):
    for y, x0, x1 in ((5, 6, 9), (6, 5, 10), (7, 5, 10), (8, 4, 11), (9, 4, 11), (10, 4, 11), (11, 3, 12)):
        c.HL(x0, y, x1 - x0 + 1, K('kinari', 1)); c.P(x0, y, K('kinari', 2)); c.P(x1, y, K('kinari', -1))
    c.HL(6, 4, 4, K('kinari', 2)); c.HL(3, 12, 10, K('kinari', -2)); c.HL(4, 13, 8, K('kinari', -1))                                  # 갓 밑 그늘
    c.VL(8, 14, 12, K('tekko', 1)); c.VL(9, 14, 12, K('tekko', -2))
    c.R(5, 27, 6, 3, K('tekko', 0)); c.HL(5, 27, 6, K('tekko', 2)); c.HL(5, 29, 6, K('tekko', -3)); c.P(4, 28, K('tekko', -2)); c.P(11, 28, K('tekko', -2))


@R.obj('cushion-floor', '방석', 1, 1, kind='flat', desc='바닥 방석(자부통). 팥빛 갈색 천에 가운데 술 한 점, 꿰맨 테두리. 좌탁 둘레에 놓는다 — 감색 방석(zabuton)의 짝 색.',
       tags=('거실', '다다미'), place='좌탁 둘레 바닥')
def cushion_floor(c):
    col = lambda s: K('renga', s)                                                       # 팥빛 갈색 — 감색 zabuton 과 색으로 구분된다
    top, hl, lo = col(-1), col(0), col(-2)
    # 윗면(위에서 본 둥근 정사각) → 앞면 두께 2px → 윤곽. 네 귀는 한 칸씩 깎는다.
    c.R(3, 3, 10, 7, top)                                                               # 윗면
    c.R(3, 10, 10, 2, lo)                                                               # 앞면(두께 2px)
    c.HL(3, 2, 10, OL); c.HL(3, 12, 10, OL); c.VL(2, 3, 9, OL); c.VL(13, 3, 9, OL)      # 윤곽
    for (x, y) in ((3, 3), (12, 3)): c.P(x, y, lo)                                      # 윗귀는 어둡게 눌러 둥글게
    c.HL(4, 3, 8, col(1)); c.VL(3, 4, 5, hl)                                            # 빛 왼쪽 위 테
    # 꿰맨 테두리: 안쪽으로 2칸 들여 점선(한 칸 건너, 한 색)
    for x in range(5, 11, 2): c.P(x, 5, hl); c.P(x, 8, hl)
    for y in (6, 7): c.P(4, y, hl); c.P(11, y, hl)
    c.R(7, 6, 2, 2, col(2)); c.P(8, 7, hl)                                              # 가운데 술(房) 한 점 — 2×2, 오른쪽 아래만 어둡게


# ───────────────────────── 탁상 물건 (윗면 칸 안, 바닥선 y≈7) ─────────────────────────
@R.good('rice-cooker', '밥솥', desc='둥근 전기밥솥. 흰 몸통에 둥근 뚜껑과 작은 표시 점.')
def g_rice_cooker(c):
    c.R(4, 2, 8, 6, K('shiro', 1)); c.HL(4, 2, 8, K('shiro', 2)); c.VL(4, 3, 5, K('shiro', 2)); c.VL(11, 3, 5, K('shiro', -1)); c.HL(4, 7, 8, K('shiro', -2))
    c.R(5, 0, 6, 2, K('conc', 1)); c.HL(5, 0, 6, K('conc', 3)); c.P(8, 4, K('aka', 0)); c.P(9, 4, K('midori', 0)); box(c, 3, 1, 10, 8, K('conc', -3)); c.P(3, 1, None); c.P(12, 1, None)


@R.good('kettle', '주전자', desc='전기 주전자. 둥근 몸통, 주둥이와 손잡이.')
def g_kettle(c):
    ell(c, 7, 4, 4, 3.5, 'conc'); c.HL(5, 0, 4, K('tekko', 1)); c.VL(11, 1, 4, K('tekko', -1)); c.P(10, 1, K('tekko', -1)); c.P(10, 5, K('tekko', -1)); c.P(2, 3, K('conc', 1)); c.P(1, 2, K('conc', 2)); c.P(6, 2, K('conc', 3))


@R.good('microwave', '전자레인지', desc='탁상 전자레인지. 흰 상자에 검은 창과 오른쪽 손잡이.')
def g_microwave(c):
    c.R(2, 1, 12, 7, K('shiro', 1)); c.HL(2, 1, 12, K('shiro', 2)); c.HL(2, 2, 12, K('shiro', -1)); box(c, 2, 1, 12, 7, K('conc', -3))
    c.R(3, 3, 7, 4, K('yoru', -1)); c.HL(3, 3, 7, K('yoru', 1)); c.VL(12, 3, 4, K('conc', -2)); c.P(11, 3, K('conc', 1))


@R.good('plates', '접시 쌓기', desc='흰 접시 세 장 쌓음.')
def g_plates(c):
    for i, y in enumerate((5, 3, 1)):
        c.R(3, y, 10, 3, K('shiro', 1)); c.HL(3, y, 10, K('shiro', 2)); c.HL(4, y + 1, 8, K('sora', 0)); c.HL(3, y + 2, 10, K('shiro', -2)); c.P(3, y, None); c.P(12, y, None)
    c.HL(4, 8, 8, K('conc', -1))


@R.good('fruit-bowl', '과일 그릇', desc='나무 그릇에 귤과 사과가 담김.')
def g_fruit_bowl(c):
    ell(c, 6, 2.5, 2.2, 2.2, 'daidai'); ell(c, 10, 2.5, 2.2, 2.2, 'aka'); ell(c, 8, 1.5, 2, 2, 'kii')
    c.R(3, 4, 10, 3, K('ki', 0)); c.HL(3, 4, 10, K('ki', 2)); c.HL(4, 7, 8, K('ki', -2)); c.VL(3, 5, 2, K('ki', 1)); c.VL(12, 5, 2, K('ki', -2))


@R.good('remote', '리모컨', desc='검은 리모컨. 단추 점 두 줄.')
def g_remote(c):
    c.R(5, 4, 6, 4, K('yoru', -1)); c.HL(5, 4, 6, K('yoru', 1)); c.HL(5, 7, 6, K('yoru', -3)); c.P(6, 5, K('aka', 0)); c.P(8, 5, K('conc', 1)); c.P(9, 6, K('conc', 1)); c.P(6, 6, K('conc', 1))


@R.good('newspaper', '신문', desc='접힌 신문. 회색 줄무늬(글자 없음).')
def g_newspaper(c):
    c.R(2, 3, 12, 5, K('kinari', 2)); c.HL(2, 3, 12, K('kinari', 2)); box(c, 2, 3, 12, 5, K('kinari', -2)); c.P(2, 3, None)
    c.HL(4, 4, 4, K('conc', 0)); c.HL(9, 4, 3, K('conc', 0)); c.HL(4, 6, 8, K('conc', 1)); c.R(10, 5, 2, 1, K('conc', -1))


@R.good('laptop', '노트북', desc='열린 노트북. 위로 선 어두운 화면과 밝은 본체.')
def g_laptop(c):
    c.R(4, 0, 8, 4, K('yoru', -2)); box(c, 3, 0, 10, 5, K('tekko', -1)); c.P(5, 1, K('yoru', 1)); c.P(6, 2, K('yoru', 0))
    c.R(2, 5, 12, 3, K('conc', 1)); c.HL(2, 5, 12, K('conc', 3)); c.HL(2, 7, 12, K('conc', -2)); c.HL(4, 6, 8, K('conc', -1))


@R.good('mug', '머그컵', desc='손잡이 달린 푸른 머그컵.')
def g_mug(c):
    c.R(5, 2, 5, 5, K('sora', 1)); c.VL(5, 2, 5, K('sora', 2)); c.VL(9, 2, 5, K('sora', -1)); c.HL(5, 2, 5, K('sora', 3)); c.HL(5, 6, 5, K('sora', -2))
    c.HL(6, 3, 3, K('ki', -1)); c.VL(10, 3, 3, K('sora', 0)); c.P(11, 4, K('sora', 0)); c.P(10, 5, K('sora', -2))


# ───────────────────────── (선택) 주방 아일랜드 ─────────────────────────
@R.table('kcounter', '주방 카운터', one_row=True, desc='한 줄짜리 아일랜드 카운터. 흰 상판과 문 달린 몸통이 칸마다 이어진다.', tags=('부엌', '주방'))
def kcounter(c, w, h):
    W = w * 16; yb = 0
    c.R(0, 1, W, 5, K('conc', 1)); c.HL(0, 1, W, K('conc', 3)); c.HL(0, 6, W, K('conc', -1)); c.VL(0, 2, 5, K('conc', 3)); c.VL(W - 1, 2, 5, K('conc', 0))
    c.R(0, 7, W, 9, K('shiro', 1)); c.HL(0, 7, W, K('shiro', 2)); c.HL(0, 8, W, K('shiro', -1)); c.HL(0, 13, W, K('tekko', 0)); c.R(0, 14, W, 2, K('tekko', -2))
    c.VL(0, 7, 6, K('shiro', 2)); c.VL(W - 1, 7, 6, K('shiro', -1))
    for x in range(0, W, 16):
        c.VL(x + 7, 9, 4, K('shiro', -1)); c.VL(x + 8, 9, 4, K('shiro', 2)); c.VL(x + 5, 9, 2, K('conc', -2)); c.VL(x + 10, 9, 2, K('conc', -2))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
