"""기존 키트 소품·문 재작업(게이트 지적 반영): 외곽 윤곽, 자판기 오인 제거, 떠 있는 부품 접합."""
from v2core import *
import props as P0
from jp5 import roadsign as roadsign_fn

def _step(c, x, w):
    c.R(x, 44, w, 2, K('hodo', 5)); c.HL(x, 44, w, K('hodo', 6)); c.HL(x, 45, w, K('hodo', -1))
def _fin(c): return ink2(c, ext=False, edge=3)

def door_steel():
    """철제 방화문: 한 장 문짝 + 문틀 + 왼쪽 경첩 2개 + 오른쪽 레버 + 아랫 킥플레이트. 슬롯/투입구 모양 없음."""
    c = Cv(32, 48)
    c.R(4, 11, 24, 33, K('tekko', 0)); c.VL(4, 11, 33, K('tekko', 3)); c.HL(4, 11, 24, K('tekko', 3))
    c.R(6, 13, 20, 31, K('hodo', 2)); c.VL(6, 13, 31, K('hodo', 4)); c.VL(25, 13, 31, K('hodo', 0)); c.HL(6, 13, 20, K('hodo', 4))
    c.R(11, 16, 10, 8, K('garasu', 1)); c.R(11, 16, 10, 2, K('garasu', 3)); c.HL(11, 23, 10, K('tekko', 1)); c.VL(11, 16, 8, K('tekko', 2))     # 망입 유리창
    for y in (18, 36): c.R(5, y, 2, 4, K('tekko', 4)); c.P(5, y, K('shiro', 3))                                                                      # 경첩
    c.R(21, 29, 4, 2, K('shiro', 3)); c.R(23, 29, 2, 5, K('shiro', 2)); c.P(21, 29, K('shiro', 4))                                                    # 레버
    c.R(7, 38, 18, 5, K('hodo', 1)); c.HL(7, 38, 18, K('hodo', 3)); c.HL(7, 43, 18, K('tekko', -1))                                                   # 킥플레이트
    _step(c, 2, 28); return _fin(c)
def door_rollup():
    c = Cv(32, 48)
    c.R(1, 11, 30, 33, K('hodo', 0)); c.R(3, 13, 26, 31, K('tekko', -3))
    for j in range(13, 43, 3): c.HL(3, j, 26, K('tekko', 3)); c.HL(3, j + 1, 26, K('tekko', 1)); c.HL(3, j + 2, 26, K('tekko', -1))
    c.R(3, 38, 26, 5, K('kii', 2)); c.HL(3, 38, 26, K('kii', 4)); c.HL(3, 42, 26, K('kii', 0))               # 하단 손잡이 바
    c.R(22, 34, 4, 4, K('shiro', 3)); c.P(23, 35, K('tekko', -2))                                          # 자물쇠 하나
    c.R(1, 44, 30, 2, K('hodo', 5)); c.HL(1, 44, 30, K('hodo', 6)); c.HL(1, 45, 30, K('hodo', -1)); return _fin(c)
def door_house():
    c = Cv(32, 48)
    c.R(4, 8, 24, 3, K('ita', -2)); c.HL(4, 8, 24, K('ita', 1))                                              # 문 위 처마판
    c.R(6, 11, 20, 33, K('ita', -3)); c.R(8, 13, 16, 30, K('ita', 0)); c.VL(8, 13, 30, K('ita', 2)); c.VL(23, 13, 30, K('ita', -2))
    c.R(11, 15, 3, 14, K('garasu', 1)); c.HL(11, 15, 3, K('garasu', 3)); c.R(18, 15, 3, 14, K('garasu', 1))
    for j in (31, 37): c.R(10, j, 12, 1, K('ita', -2)); c.HL(10, j + 1, 12, K('ita', 2))
    c.R(20, 26, 2, 5, K('kii', 3))
    c.R(14, 11, 4, 2, K('shiro', 3)); c.HL(14, 11, 4, K('shiro', 4))                                                                    # 문등: 차양 바로 아래 문 위 중앙(문틀 안)
    c.R(24, 20, 2, 4, K('tekko', 1)); c.HL(24, 20, 2, K('tekko', 3)); c.P(25, 22, K('shiro', 3))                                       # 인터폰: 오른쪽 문틀 기둥 안(x24~25)
    _step(c, 4, 24); return _fin(c)
def door_cafe():
    c = Cv(32, 48)
    c.R(4, 11, 24, 33, K('ita', -3)); c.R(6, 13, 20, 30, K('ita', 1)); c.VL(6, 13, 30, K('ita', 3)); c.VL(25, 13, 30, K('ita', -1)); c.HL(6, 13, 20, K('ita', 3))
    c.R(9, 15, 14, 14, K('mado', 1)); c.R(9, 15, 14, 3, K('mado', 0)); c.VL(16, 15, 14, K('ita', -1))
    for q in range(5): c.P(11 + q, 25 - q, K('mado', 4))
    c.R(9, 31, 14, 10, K('ita', 0)); c.HL(9, 31, 14, K('ita', 2)); c.HL(9, 40, 14, K('ita', -2))
    c.R(22, 27, 2, 4, K('kii', 3)); c.P(23, 27, K('kii', 4))
    for j in range(8):
        for i in range(8):
            d = (i - 3.5) ** 2 + (j - 3.5) ** 2
            if d <= 14: c.P(12 + i, 17 + j, K('aka', 2) if d > 8 else K('shiro', 3))
    _step(c, 3, 26); return _fin(c)
def door_lattice():
    from paint import door_cells
    c = Cv(32, 48); door_cells(c, 32)
    c.R(14, 29, 2, 5, K('kii', 3)); c.R(17, 29, 2, 5, K('kii', 3)); c.VL(15, 14, 29, K('tekko', -2)); c.VL(16, 14, 29, K('tekko', -2))
    return _fin(c)

def garbage_net():
    """쓰레기 집하: 철망 틀(앞면 격자 철망) 위에 흰 봉투 덩이 3개를 올리고 노란 그물을 덮는다. 윗면(덩이·그물)과 앞면(철망)이 나뉜다. 32x16, 윤곽은 rp(ink2)가 입힘."""
    c = Cv(32, 16)
    for (cx, cy, rx, ry) in ((9, 6, 6.2, 4.6), (17, 5, 6.6, 5.2), (24, 6.5, 5.4, 4.2)):
        ellipse(c, cx, cy, rx, ry, K('shiro', 2), K('shiro', 4), K('conc', 1))
    for j in range(1, 10):                                              # 노란 그물: 덩이 위에 규칙적인 직교 격자
        for i in range(3, 30):
            if c.a[j, i, 3] and (i % 4 == 1 or j % 3 == 0): c.P(i, j, K('kii', 3) if c.a[j, i, 0] > 150 else K('kii', 1))
    c.R(2, 9, 28, 5, K('tekko', -3))                                    # 앞면: 어두운 바탕 + 철망 격자
    for x in range(5, 29, 4): c.VL(x, 10, 4, K('tekko', 3))
    for y in (11, 13): c.HL(3, y, 26, K('tekko', 2))
    c.HL(2, 9, 28, K('tekko', 6)); c.R(2, 9, 2, 5, K('tekko', 4)); c.R(28, 9, 2, 5, K('tekko', 1)); c.HL(2, 14, 28, K('tekko', 0))     # 윗 가로대·기둥
    return c

def bike_rack():
    """자전거 거치대 32x16: 초록 거치 구역 슬래브(윗면 2px + 앞면) 위에 독립 U자 거치대 4개(닫힌 외곽 없음)."""
    c = Cv(32, 16)
    c.R(1, 10, 30, 2, K('midori', 3)); c.HL(1, 10, 30, K('midori', 4)); c.R(1, 12, 30, 2, K('midori', -1)); c.HL(1, 13, 30, K('midori', -2))
    for x in (2, 9, 16, 23):
        c.HL(x + 1, 3, 4, K('tekko', 5)); c.VL(x, 4, 7, K('tekko', 5)); c.VL(x + 5, 4, 7, K('tekko', 2)); c.P(x + 1, 4, K('tekko', 3)); c.P(x + 4, 4, K('tekko', 2))
        c.R(x - 1, 10, 3, 1, K('tekko', 3)); c.R(x + 4, 10, 3, 1, K('tekko', 0))                   # 발판
    return c

def lobby():
    """아파트 공용현관(오른쪽 우편함 패널 제거 — 자판기 인상 완화): 알루미늄 유리 여닫이 + 작은 인터폰 하나."""
    c = Cv(32, 48)
    c.R(2, 11, 28, 33, K('conc', 2)); c.HL(2, 11, 28, K('conc', 4)); c.VL(29, 11, 33, K('conc', -1))
    c.R(4, 13, 18, 31, K('conc', 4)); c.VL(4, 13, 31, K('shiro', 4)); c.VL(21, 13, 31, K('conc', 0))
    c.R(6, 15, 14, 28, K('garasu', 1)); c.R(6, 15, 14, 4, K('garasu', 0)); c.VL(6, 15, 28, K('garasu', 3))
    for q in range(8): c.P(8 + q, 31 - q, K('garasu', 4))
    c.R(6, 33, 14, 1, K('conc', 4)); c.R(18, 28, 2, 8, K('shiro', 4)); c.R(7, 41, 12, 2, K('conc', 1))
    c.R(24, 22, 4, 6, K('tekko', 1)); c.HL(24, 22, 4, K('tekko', 3)); c.P(25, 23, K('midori', 3)); c.P(26, 25, K('shiro', 3))
    _step(c, 1, 30); return _fin(c)

def _remap(a, pairs):
    src = a.copy()
    for (f, t) in pairs:
        m = (src[..., 3] > 0) & (src[..., 0] == rgb(f)[0]) & (src[..., 1] == rgb(f)[1]) & (src[..., 2] == rgb(f)[2])
        a[m, :3] = rgb(t)

def _clear(a, mask_color=None, x0=0, x1=None, y0=0, y1=None, col=None):
    x1 = a.shape[1] if x1 is None else x1; y1 = a.shape[0] if y1 is None else y1
    sub = a[y0:y1, x0:x1]
    m = sub[..., 3] > 0
    if col is not None: m &= (sub[..., 0] == rgb(col)[0]) & (sub[..., 1] == rgb(col)[1]) & (sub[..., 2] == rgb(col)[2])
    sub[m] = 0

def apply(B):
    """build 모듈 B 에 재등록."""
    for k, f in (('steel', door_steel), ('rollup', door_rollup), ('house', door_house), ('cafe', door_cafe), ('lattice', door_lattice), ('lobby', lobby)):
        B.reg_deco(f'door.{k}', f())
    def rp(name, cv, cols, desc, outline=True):
        o = ink2(cv, ext=True, edge=3) if outline else cv
        B.reg_prop(name, o, cols, desc)
    for col in ('aka', 'sora', 'midori'):                                 # 자판기: 한 칸 내려 맨 윗줄에 윤곽 자리 확보, 모서리 잡티 제거
        cv = Cv(32, 32); P0.vending2(cv, 6, 30, col)
        a = np.zeros_like(cv.a); a[1:] = cv.a[:-1]; cv.a[:] = a
        cv.a[1, 6] = 0                                                     # 윗면 왼쪽 위로 튀어나온 외톨이 픽셀
        rp(f'vending.{col}', cv, (0, 1), '자판기')
    for col in ('sora', 'midori', 'aka'):
        cv = Cv(32, 32); P0.bike2(cv, 2, 24, col)
        _remap(cv.a, [(K(col, -2), K(col, 0)), (K(col, -1), K(col, 1)), (K(col, 0), K(col, 2)), (K(col, 1), K(col, 2))])      # 프레임을 윤곽보다 두 단 밝게
        cv.HL(23, 7, 6, K('tekko', 5))                                      # 앞바구니 윗면 1px 하이라이트
        cv.R(4, 26, 24, 2, K('hodo', -1))                                  # 접지 그림자 실선
        o = ink2(cv, ext=True, edge=3)                                     # 안쪽 잉크로 다시 어두워진 프레임 선을 윤곽보다 밝게 되돌린다
        _remap(o.a, [(K(col, -2), K(col, 0)), (K(col, -1), K(col, 1))])
        B.reg_prop(f'bike.{col}', o, (), '자전거(마마차리)')
    cv = Cv(32, 80); roadsign_fn(cv, 16, 78)
    for (px_, py_) in ((26, 22), (8, 22), (17, 31), (17, 13)): cv.a[py_, px_] = 0                  # 원판 밖으로 튀어나온 외톨이 픽셀 4개
    cv.R(14, 76, 6, 2, K('hodo', 4)); cv.HL(14, 76, 6, K('hodo', 6)); cv.HL(14, 78, 6, K('hodo', -1))    # 기둥 받침
    rp('roadsign', cv, (1,), '도로 표지')
    rp('curve_mirror', B.__dict__['curve_mirror'](), (0,), '커브미러'); rp('post_box', B.__dict__['post_box'](), (0,), '우체통')
    sig = B.__dict__['signal2'](); sig.R(22, 59, 1, 3, K('tekko', 2)); rp('signal', sig, (1,), '신호기')
    pole = B.__dict__['pole_tall'](); _clear(pole.a, x0=30, x1=32, y0=48, y1=80, col=K('conc', -2))   # 변압기 옆 긴 선: 변압기 하단 높이에서 끊는다
    rp('utility_pole', pole, (1,), '전봇대')
    rp('stop_sign', B.__dict__['stop_sign'](), (0,), '일시정지 표지'); rp('bike_rack', bike_rack(), (0, 1), '자전거 거치대')
    for c_ in ('aka', 'sora', 'midori'): rp(f'nobori.{c_}', B.__dict__['nobori'](c_), (0,), '幟')
    rp('garbage_net', garbage_net(), (0, 1), '쓰레기 집하')
    pl = B.__dict__['planter']()
    for x in range(3, 29):
        if pl.a[6, x, 3]: pl.P(x, 6, K('midori', 2))
    _remap(pl.a, [(K('tairu', -1), K('tairu', 1))])                         # 앞면 남색을 한 단 밝게
    rp('planter', pl, (0, 1), '화단'); rp('pot', B.__dict__['pot'](), (0,), '화분'); rp('bench', B.__dict__['bench'](), (0, 1), '벤치'); rp('bollard', B.__dict__['bollard'](), (0,), '볼라드')
