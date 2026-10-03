"""3/4 시점 탈것 v3: 옆면 + 윗면. 바퀴=속찬 원반+허브(휠 아치 오목), 유리는 지붕 폭 안, 열차는 대차+레일."""
import random
from parts_tokyo import *
from v2core import ink2

CAR_BODY2 = {'white': ('shiro', 3), 'silver': ('conc', 3), 'black': ('tekko', 0), 'red': ('aka', 1), 'blue': ('sora', 1), 'taxi': ('kii', 2), 'green': ('midori', 1), 'navy': ('kon', 1)}
from v2core import wheel as _w2
def _wheel(c, x, y, r=5):
    _w2(c, x, y, r)
def _arch(c, x, y, r, col):
    """휠 아치: 바퀴 위를 반원으로 파낸 어두운 오목 + 위쪽 가장자리 한 줄 밝게."""
    for yy in range(-r - 1, 1):
        for xx in range(-r - 1, r + 1):
            if (xx + .5) ** 2 + yy * yy <= (r + 1) ** 2: c.P(x + xx, y + yy, K('tekko', -2))

def car(color='white', kind='sedan', flip=False):
    """80x48. 진행 방향 오른쪽. 위=윗면(트렁크·지붕·보닛), 아래=옆면. 윗면은 앞면보다 한 단 밝고 경계에 어두운 접힘선."""
    c = Cv(80, 48); ramp, t = CAR_BODY2[color]
    n5 = len(RAMPS[ramp]) == 5; mx = 2 if n5 else 3
    if color == 'black': t = -1                                                           # 윗면·앞면 명도 차를 확보
    t = min(t, mx - 1)                                                                    # 윗면(t+1)이 항상 한 단 더 밝다
    bod = K(ramp, t); top = K(ramp, t + 1); topE = K(ramp, t + 2); lo = K(ramp, t - 1); dk = K(ramp, t - 2)
    glass = K('garasu', 2); glass_hi = K('garasu', 4); gdk = K('garasu', 0)
    if kind == 'van':
        # 화물칸 윗면(넓음) / 캐빈 지붕(낮고 좁음) / 앞면. 캐빈 앞유리는 앞으로 기운 사다리꼴.
        c.R(5, 11, 51, 9, top); c.HL(6, 11, 49, topE); c.VL(5, 12, 8, topE); c.HL(5, 19, 51, lo)                             # 화물칸 윗면
        c.R(57, 16, 18, 5, top); c.HL(58, 16, 14, topE); c.HL(57, 20, 18, lo); c.P(74, 16, None)                              # 캐빈 지붕 윗면
        c.R(5, 20, 51, 19, bod); c.VL(5, 21, 17, top); c.VL(55, 21, 17, lo)                                                     # 화물칸 앞면
        c.R(56, 21, 19, 18, bod); c.VL(74, 22, 16, lo); c.VL(56, 21, 18, lo)                                                    # 캐빈 앞면 (56 은 칸 경계선)
        for j in range(9):                                                                                                     # 앞유리·문 창: 오른쪽 아래로 기운다
            c.HL(58, 22 + j, 9 + (j + 1) // 2 + 2, glass)
        c.R(58, 22, 11, 2, glass_hi); c.VL(64, 22, 9, bod); c.VL(65, 22, 9, lo)
        for x in (9, 24, 39): c.R(x, 24, 9, 5, glass); c.R(x, 24, 9, 2, glass_hi)                                              # 화물칸 창 3개
        for x in (20, 35, 50): c.VL(x, 21, 17, lo)                                                                             # 칸 단위 규칙 이음
        c.R(70, 31, 4, 3, K('kii', 3)); c.R(5, 29, 3, 3, K('aka', 1)); c.R(5, 35, 70, 3, K('tekko', 1)); c.HL(5, 35, 70, K('tekko', 3))
        wx = (17, 62)
    else:
        # 옆면 몸통 + 숄더라인
        c.R(4, 27, 70, 12, bod); c.VL(4, 28, 11, top); c.VL(73, 28, 11, lo); c.HL(4, 38, 70, dk)
        c.HL(5, 29, 68, top); c.R(4, 33, 70, 2, lo)
        # 트렁크·보닛 윗면 (앞면 위에 한 단 밝은 면 + 어두운 접힘선)
        for (x0, w, ch) in ((5, 16, 1), (53, 21, 2)):
            c.R(x0, 22, w, 5, top); c.HL(x0 + 1, 22, w - 2, topE); c.HL(x0, 26, w, lo)
        c.HL(4, 27, 70, lo)
        # 캐빈: 지붕 윗면 4px(앞쪽 줄은 앞면색), 유리는 사다리꼴(A필러 경사)
        c.R(24, 9, 26, 3, top); c.HL(25, 9, 24, topE); c.HL(24, 12, 26, bod)
        for j in range(15):
            xs = 26 - j // 3; xe = 49 + j // 3
            c.HL(xs, 13 + j, xe - xs, glass)
        c.R(26, 13, 24, 2, glass_hi); c.VL(37, 13, 14, bod); c.VL(38, 13, 14, lo)
        for j in range(3): c.HL(48 - j, 9 + j, 3 + j, lo)                                                                        # 지붕 오른쪽 어두운 사선
        c.R(70, 29, 3, 3, K('kii', 3)); c.R(4, 29, 2, 3, K('aka', 1)); c.R(66, 33, 6, 2, lo)
        if color == 'taxi':
            c.R(33, 4, 10, 5, K('shiro', 3)); c.HL(33, 4, 10, K('shiro', 4)); c.R(34, 6, 8, 2, K('aka', 2)); c.VL(42, 5, 4, K('conc', 0))
        wx = (17, 60)
    if kind == 'van': c.R(5, 39, 70, 2, K('sumi', 0))
    else: c.R(4, 39, 70, 2, K('sumi', 0))
    for x in wx:
        _arch(c, x, 38, 6, K('sumi', 1)); _wheel(c, x, 40, 5)
    out = ink2(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out

def bus(flip=False, stripe='aka'):
    """9칸 x 4칸 (144x64). 지붕(한 단 밝은 윗면)과 옆면(한 단 어두움) 사이 접힘선, 앞=넓은 앞유리+행선 표시+전조등, 뒤=후미창."""
    c = Cv(144, 64)
    SH, SB = K('shiro', 2), K('shiro', 1)                                                                                   # 지붕(밝음) / 옆면
    c.R(2, 6, 138, 11, SH); c.HL(3, 6, 136, K('shiro', 2)); c.VL(2, 7, 10, SH); c.VL(139, 7, 10, K('shiro', 0)); c.HL(2, 16, 138, K('conc', 1))
    for x in (16, 62, 102): c.R(x, 9, 20, 5, K('conc', 2)); c.HL(x, 9, 20, K('shiro', 2)); c.HL(x, 13, 20, K('conc', 0)); c.VL(x + 19, 10, 4, K('conc', 1))
    c.R(2, 17, 138, 35, SB); c.VL(2, 18, 34, K('shiro', 2)); c.VL(139, 18, 34, K('conc', 0)); c.HL(2, 51, 138, K('conc', 0)); c.HL(2, 17, 138, K('conc', 2))
    c.R(2, 40, 138, 5, K(stripe, 1)); c.HL(2, 40, 138, K(stripe, 2)); c.HL(2, 44, 138, K(stripe, -1))                       # 줄무늬: 양 끝까지 직선
    for k in range(6):
        x = 8 + k * 16; c.R(x, 22, 13, 14, K('garasu', 2)); c.R(x, 22, 13, 3, K('garasu', 4)); c.VL(x + 12, 22, 14, K('garasu', 0))
    c.R(105, 22, 14, 26, K('garasu', 2)); c.VL(112, 22, 26, K('tekko', 2)); c.R(105, 22, 14, 3, K('garasu', 4)); c.HL(105, 47, 14, K('tekko', 1))        # 승강문
    # 앞(오른쪽): 넓고 높은 앞유리, 행선 표시, 전조등
    c.R(122, 20, 16, 18, K('garasu', 3)); c.R(122, 20, 16, 3, K('garasu', 4)); c.VL(122, 20, 18, K('conc', 0)); c.VL(129, 23, 15, K('garasu', 1)); c.HL(122, 37, 16, K('conc', 0))
    c.R(124, 10, 14, 4, K('tekko', -2)); c.HL(124, 10, 14, K('tekko', 0)); c.HL(126, 12, 8, K('kii', 2))
    c.R(133, 41, 5, 3, K('kii', 3)); c.HL(133, 41, 5, K('kii', 2))
    # 뒤(왼쪽): 세로 후미등
    c.R(3, 24, 3, 9, K('aka', 0)); c.VL(3, 24, 9, K('aka', 2)); c.R(3, 41, 2, 3, K('aka', -1))
    c.R(2, 51, 138, 4, K('tekko', 1))
    for x in (28, 96):
        _arch(c, x, 51, 8, K('sumi', 1)); _wheel(c, x, 54, 7)
    out = ink2(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out

def train(n=10, stripe='midori'):
    """n칸 x 4칸: 지붕 윗면(밝음, 에어컨) + 옆면(창은 칸 사이 벽 사이, 띠는 끊김 없음) + 대차 박스 + 레일 윗면."""
    c = Cv(16 * n, 64); W = c.w
    c.R(1, 5, W - 2, 10, K('shiro', 4)); c.HL(1, 5, W - 2, K('shiro', 4)); c.VL(1, 6, 9, K('shiro', 4)); c.VL(W - 2, 6, 9, K('shiro', 2)); c.HL(1, 14, W - 2, K('conc', 3))
    for x in range(10, W - 30, 54): c.R(x, 7, 24, 5, K('conc', 4)); c.HL(x, 7, 24, K('shiro', 4)); c.HL(x, 11, 24, K('conc', 1))
    c.R(1, 15, W - 2, 34, K('shiro', 2)); c.VL(1, 16, 33, K('shiro', 3)); c.VL(W - 2, 16, 33, K('conc', 1)); c.HL(1, 15, W - 2, K('shiro', 4)); c.HL(1, 48, W - 2, K('conc', 1))
    for k, x in enumerate(range(5, W - 24, 36)):
        c.R(x, 20, 12, 14, K('garasu', 2)); c.R(x, 20, 12, 3, K('garasu', 4)); c.VL(x + 11, 20, 14, K('garasu', 0))
        c.R(x + 15, 20, 12, 14, K('garasu', 2)); c.R(x + 15, 20, 12, 3, K('garasu', 4)); c.VL(x + 26, 20, 14, K('garasu', 0))
    c.R(1, 38, W - 2, 4, K(stripe, 1)); c.HL(1, 38, W - 2, K(stripe, 3)); c.HL(1, 41, W - 2, K(stripe, -1))
    for x in range(34, W - 2, 36): c.VL(x, 16, 32, K('conc', 1)); c.VL(x + 1, 16, 32, K('shiro', 3))              # 차량 이음 (창 사이 벽에만)
    c.R(1, 49, W - 2, 4, K('tekko', 1)); c.HL(1, 49, W - 2, K('tekko', 3))
    for x in range(8, W - 20, 36):                                                                                          # 대차 박스
        c.R(x, 53, 26, 5, K('tekko', -2)); c.HL(x, 53, 26, K('tekko', 1)); _wheel(c, x + 5, 57, 3); _wheel(c, x + 21, 57, 3)
    c.R(0, 59, W, 2, K('hodo', 4)); c.HL(0, 59, W, K('shiro', 3)); c.HL(0, 61, W, K('hodo', -1))                           # 레일 윗면
    return ink2(c)

def ad_truck(flip=False):
    """6칸 x 4칸 (96x64): 광고 적재함(2색 띠 반복, 하단은 바퀴 위) + 운전실(지붕 윗면·경사 앞유리·문선)."""
    c = Cv(96, 64)
    c.R(2, 6, 64, 9, K('shiro', 2)); c.HL(3, 6, 62, K('shiro', 2)); c.VL(2, 7, 8, K('shiro', 2)); c.HL(2, 14, 64, K('conc', 1))
    c.R(2, 15, 64, 35, K('shiro', 1)); c.VL(2, 16, 34, K('shiro', 2)); c.VL(65, 16, 34, K('conc', 0))
    c.R(6, 18, 56, 22, K('sora', 0))
    for i in range(0, 56, 8): c.R(6 + i, 18, 4, 22, K('sora', 1))                                  # 칸 단위 반복 세로 띠
    c.R(6, 31, 56, 5, K('pinku', 1)); c.HL(6, 31, 56, K('pinku', 2)); c.R(6, 36, 56, 4, K('sora', -1))
    # 운전실: 지붕 윗면 + 앞면. 앞유리는 오른쪽 아래로 기운 사다리꼴
    c.R(69, 22, 20, 6, K('tekko', 3)); c.HL(70, 22, 18, K('tekko', 4)); c.HL(69, 27, 20, K('tekko', 1))
    c.R(88, 28, 6, 6, K('tekko', 3)); c.HL(88, 28, 6, K('tekko', 4)); c.HL(88, 33, 6, K('tekko', 1))          # 후드 윗면
    c.R(68, 28, 20, 22, K('tekko', 2)); c.R(88, 34, 6, 16, K('tekko', 2)); c.VL(68, 28, 22, K('tekko', 4)); c.VL(93, 34, 16, K('tekko', 0))
    for j in range(11): c.HL(72, 30 + j, 10 + j // 3, K('garasu', 2))
    c.R(72, 30, 11, 2, K('garasu', 4)); c.VL(78, 30, 11, K('tekko', 2))
    c.VL(70, 29, 21, K('tekko', 0)); c.VL(87, 40, 10, K('tekko', 0))                                    # 문선(양쪽)
    c.R(90, 43, 3, 3, K('kii', 3))                                                                      # 전조등
    c.R(2, 50, 92, 4, K('tekko', 0)); c.HL(2, 50, 92, K('tekko', 3))
    for x in (16, 78):
        _arch(c, x, 50, 8, K('sumi', 1)); _wheel(c, x, 54, 7)
    out = ink2(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out
