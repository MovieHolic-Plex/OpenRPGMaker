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

def _veh_mods():
    """3/4 깊이 그림(2026-10-20)의 정본은 vehicles/cars.py · heavy.py(움직이는 스프라이트). 정지 소품도 같은 그림을 쓴다."""
    import os, sys
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vehicles')
    if d not in sys.path: sys.path.insert(0, d)
    import cars, heavy
    return cars, heavy


def _as_cv(a, flip=False):
    """정지 소품 칸 자르기(build.reg_prop)는 16 배수 높이를 가정한다 → 위쪽을 투명으로 채워 16 배수로(밑변 = 발 그대로)."""
    h = -(-a.shape[0] // 16) * 16
    c = Cv(a.shape[1], h); c.a[h - a.shape[0]:] = a[:, ::-1] if flip else a
    return c


def car(color='white', kind='sedan', flip=False):
    """80x64 정지 차 소품(그림 80x56 + 위 투명 8). 진행 방향 오른쪽(flip 이면 왼쪽). 3/4 깊이판: 지붕 윗면 ≈35%, 보닛·트렁크 윗면 6줄, 바퀴 아래 절반."""
    cars, _ = _veh_mods()
    tone = cars.CAR_TONE[color]
    a = cars._van_side(tone) if kind == 'van' else cars._sedan_side(tone, taxi=(color == 'taxi'))
    return _as_cv(a, flip)


def bus(flip=False, stripe='aka'):
    """9칸 x 4칸 (144x64) 정지 버스 소품 = 움직이는 버스 옆 프레임(지붕 윗면 22줄). flip 이면 서쪽행(문 있는 면)."""
    _, heavy = _veh_mods()
    return _as_cv(heavy.bus_side(not flip, False, band=stripe))


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
