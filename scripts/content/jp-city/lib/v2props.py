from v2core import *
from v2temple import tile_roof, _eave_shadow, _plinth, chochin, pillar

def _seam(c, o, y1=None):
    """좌우 이음 칸: 가장자리 열의 자동 어두운 윤곽을 걷어 낸다(가로로 이어 붙일 때 이중선·검은 기둥 방지). 위·아래 모서리는 윤곽 유지."""
    y1 = c.h - 1 if y1 is None else y1
    for x in (0, c.w - 1):
        for y in range(1, y1):
            if c.a[y, x, 3] and c.a[y - 1, x, 3] and c.a[y + 1, x, 3]: o.a[y, x] = c.a[y, x]
    return o
def wall_tsuiji():
    """築地塀 1x2칸: 기와 덮개(윗면+앞) + 흙벽(단색 + 2px 옅은 줄 2개, 왼쪽 밝음·오른쪽 어두움) + 기단. 좌우는 이음용으로 윤곽을 걷음."""
    c = Cv(16, 32)
    c.R(0, 3, 16, 3, K('tairu', 4)); c.HL(0, 3, 16, K('tairu', 6))
    c.R(0, 6, 16, 5, K('tairu', 0))
    for i in range(0, 16, 4): c.VL(i, 6, 5, K('tairu', 2)); c.VL(i + 3, 6, 5, K('tairu', -2))
    c.HL(0, 11, 16, K('tairu', -3))
    c.R(0, 12, 16, 16, K('kinari', 0)); c.HL(0, 12, 16, K('kinari', -1))
    c.R(0, 19, 16, 2, K('kinari', 1))
    c.VL(0, 13, 15, K('kinari', 1)); c.VL(15, 13, 15, K('kinari', -1)); c.HL(1, 27, 15, K('kinari', -1))
    c.R(0, 28, 16, 3, K('conc', 2)); c.HL(0, 28, 16, K('conc', 4)); c.HL(0, 30, 16, K('conc', -1))
    return _seam(c, ink2(c, ext=False), 30)
def wall_block():
    """블록 담 1x1: 8x4 벽돌 2줄(4px 어긋남), 벽돌마다 왼위 밝음·오른아래 어두움, 줄눈은 어두운 1px. 16px 주기로 이어진다."""
    c = Cv(16, 16)
    c.R(0, 1, 16, 2, K('conc', 5)); c.HL(0, 1, 16, K('shiro', 4)); c.HL(0, 3, 16, K('conc', 0))
    c.R(0, 4, 16, 8, K('conc', -1))                                  # 줄눈 바탕
    def brick(x0, y0):
        xa, xb = max(x0, 0), min(x0 + 7, 16)                      # 벽돌 면 7px + 오른쪽 줄눈 1px
        c.R(xa, y0, xb - xa, 3, K('conc', 4))
        c.HL(xa, y0, xb - xa, K('shiro', 4))
        if x0 >= 0: c.VL(x0, y0, 3, K('shiro', 3))
        c.HL(xa, y0 + 2, xb - xa, K('conc', 2))
        if x0 + 7 <= 16: c.VL(x0 + 6, y0 + 1, 2, K('conc', 2))
    for x0 in (0, 8): brick(x0, 4)
    for x0 in (-4, 4, 12): brick(x0, 8)
    c.R(0, 12, 16, 4, K('conc', 2)); c.HL(0, 12, 16, K('conc', 4)); c.HL(0, 14, 16, K('conc', 1)); c.HL(0, 15, 16, K('conc', -2))
    return _seam(c, ink2(c, ext=False), 15)
def wall_hedge():
    """생울타리 1x2칸: 둥근 잎 군집(지름 7px)이 16px 주기로 엇갈려 쌓인다(좌우 끝 열이 이어짐). 3톤, 밝은 쪽은 왼쪽 위."""
    c = Cv(16, 32)
    c.R(0, 14, 16, 17, K('midori', -2))
    def blob(cx, cy, r=3.9):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                dx, dy = x + .5 - cx, y + .5 - cy; d = dx * dx + dy * dy
                if d > r * r: continue
                if dx + dy > r * .55: t = -2 if dx + dy > r * 1.05 else -1
                elif (dx + 1.1) ** 2 + (dy + 1.1) ** 2 < 3.2: t = 2
                elif dx + dy < -r * .3: t = 1
                else: t = 0
                c.P(x, y, K('midori', t))
    for (cy, xs) in ((10, (4, 12)), (15, (0, 8)), (20, (4, 12)), (25, (0, 8))):
        for cx in xs:
            for wrap in (-16, 0, 16): blob(cx + wrap, cy)
    c.R(0, 29, 16, 2, K('midori', -2)); c.HL(0, 31, 16, K('soil', -1))
    return _seam(c, ink2(c, ext=False), 31)
def wall_board():
    c = Cv(16, 32)
    c.R(0, 8, 16, 3, K('ita', 3)); c.HL(0, 8, 16, K('ita', 5))
    c.R(0, 11, 16, 18, K('ita', 0))
    for x in range(0, 16, 4): c.VL(x, 11, 18, K('ita', 1)); c.VL(x + 3, 11, 18, K('ita', -2))
    c.HL(0, 11, 16, K('ita', -2)); c.HL(0, 12, 16, K('ita', -1))
    c.R(0, 29, 16, 2, K('hodo', -1))
    return ink2(c, ext=False)
def gate_iron(open_=False):
    """철문 1x2칸: 기둥 2개(왼위 밝음) + 어두운 살대/가로대 + 전폭 아랫단. 열린 문은 사선으로 접힌 살대 문짝."""
    c = Cv(16, 32)
    for x in (0, 14):
        c.R(x, 7, 2, 23, K('tekko', 2)); c.VL(x, 7, 23, K('tekko', 4)); c.HL(x, 6, 2, K('tekko', 5)); c.VL(x + 1, 8, 22, K('tekko', 0))
    c.R(2, 29, 12, 1, K('daidai', 0))
    c.HL(0, 30, 16, K('hodo', -1))
    if not open_:
        c.R(2, 11, 12, 15, K('tekko', -3))
        for x in range(3, 14, 2): c.VL(x, 11, 15, K('tekko', 4)); c.VL(x + 1, 11, 15, K('tekko', 1)) if x + 1 < 14 else None
        c.HL(2, 10, 12, K('tekko', 5)); c.HL(2, 11, 12, K('tekko', 2)); c.HL(2, 26, 12, K('tekko', 3)); c.HL(2, 27, 12, K('tekko', 0))
        c.R(10, 17, 3, 4, K('tekko', -3)); c.R(11, 18, 2, 2, K('daidai', 3)); c.P(11, 18, K('kii', 4))
    else:
        c.R(2, 10, 9, 18, K('tekko', -3))                               # 열린 문짝: 윤곽 있는 사각 프레임(경첩은 왼쪽 기둥 쪽)
        c.R(3, 11, 7, 16, K('tekko', -1)); c.HL(3, 11, 7, K('tekko', 5)); c.HL(3, 26, 7, K('tekko', 3))
        for x in (4, 6, 8): c.VL(x, 12, 14, K('tekko', 4)); c.VL(x + 1, 12, 14, K('tekko', 0)) if x == 8 else None
        c.R(2, 10, 3, 3, K('tekko', 5)); c.HL(2, 10, 3, K('tekko', 6)); c.R(2, 25, 3, 3, K('tekko', 5)); c.HL(2, 25, 3, K('tekko', 6))     # 경첩 머리: 문짝 모서리에 붙임
    return ink2(c, ext=False)
def stone_stairs(w=8, h=4):
    """오르는 돌계단(정사영 3/4): 전폭 직사각 단(윗면 2px 밝음 + 앞면 3px 어두움), 양옆 1칸 폭 측벽(왼쪽 밝음·오른쪽 어두움), 맨 아래 2px 접지 그림자."""
    W, H = 16 * w, 16 * h; c = Cv(W, H)
    n = (H - 4) // 5; xl, xr = 16, W - 16                          # 계단 영역 [xl, xr)
    for k in range(n):
        y = 5 * k
        c.R(xl, y, xr - xl, 2, K('conc', 3)); c.HL(xl, y, xr - xl, K('shiro', 4))              # 윗면(밝음) 2px
        c.R(xl, y + 2, xr - xl, 3, K('conc', -1)); c.HL(xl, y + 4, xr - xl, K('conc', -2))     # 앞면 3px(마지막 줄은 그림자)
        c.R(xr - 3, y, 3, 5, K('conc', -2)); c.R(xr - 3, y, 3, 2, K('conc', 0))               # 오른쪽 측벽이 드리운 그림자
    c.R(xl, 5 * n, xr - xl, H - 2 - 5 * n, K('conc', 3)); c.HL(xl, 5 * n, xr - xl, K('shiro', 4))   # 맨 아래 바닥
    for x0, lit in ((0, True), (xr, False)):                         # 측벽: 윗면(슬래브 줄눈) + 아래 앞쪽 끝면
        face, jn = (K('conc', 3), K('conc', 0)) if lit else (K('conc', -1), K('conc', -3))
        c.R(x0, 0, 16, H - 2, face)
        for y in range(7, H - 10, 8): c.HL(x0, y, 16, jn)
        for y in range(0, H - 10, 8):
            xj = x0 + (5 if (y // 8) % 2 == 0 else 11); c.VL(xj, y, 7, jn)
        c.R(x0, H - 9, 16, 7, K('conc', 1) if lit else K('conc', -2)); c.HL(x0, H - 9, 16, K('shiro', 4) if lit else K('conc', 0))   # 측벽 앞쪽 끝면
        c.VL(x0, 0, H - 2, K('shiro', 4) if lit else K('conc', -1))
        c.VL(x0 + 15 if lit else x0, 0, H - 2, K('conc', -3))                                  # 계단 쪽 안쪽 가장자리 윤곽
    c.R(0, H - 2, W, 2, K('hodo', -2))                                                        # 접지 그림자 2px
    return ink2(c, ext=False)
def iron_stair(flip=False):
    """외부 철제 계단 2x4칸(지그재그): 층 참 4개(윗면 1px 하이라이트+앞면 2px) + 층 사이 사선 한 줄기(어두운 옆판 + 밝은 디딤 선) + 연속 1px 난간 + 접지 그림자."""
    c = Cv(32, 64)
    def plate(x, y, w):
        c.R(x, y, w, 2, K('tekko', 5)); c.HL(x, y, w, K('tekko', 6)); c.R(x, y + 2, w, 2, K('tekko', 0))
    for k in range(4): plate(3, 12 + k * 14, 26)
    for k in range(3):
        y0 = 16 + k * 14; y1 = y0 + 10; left = k % 2 == 0
        for j in range(11):                                      # 사선 한 줄기: 한 칸에 2px 가로, 1px 세로
            x = (5 + j * 2) if left else (25 - j * 2); y = y0 + j
            c.R(x, y, 4, 3, K('tekko', 3 if j % 2 == 0 else 1)); c.HL(x, y, 4, K('tekko', 6 if j % 2 == 0 else 4)); c.HL(x, y + 2, 4, K('tekko', -2))
            c.P(x + (4 if left else -1), y - 5, K('tekko', 3)) if j % 2 == 0 else None     # 난간 기둥(4px 간격)
        for j in range(11):                                      # 연속 난간선
            x = (5 + j * 2) if left else (25 - j * 2)
            c.HL(x + (2 if left else 0), y0 + j - 5, 3, K('tekko', 2))
    c.HL(3, 61, 26, K('tekko', -3)); c.HL(5, 62, 24, K('tekko', -3))
    out = ink2(c, ext=True)
    if flip: out.a[:] = out.a[:, ::-1]
    return out
def neon_stack(h=8, seed=0):
    """세로 간판 적층 2칸 x h칸: 간판 최대 4장, 틀 색 3종, 흰 바탕에 굵은(2px 연속선) 한자 1자(중복 없음), 기둥이 간판 뒤로 지나 바닥에 선다."""
    H = 16 * h; c = Cv(32, H)
    cols = {1: ('aka', 'sora', 'kii'), 2: ('midori', 'daidai', 'murasaki'), 3: ('sora', 'aka', 'kii'), 4: ('kii', 'midori', 'aka')}.get(seed, ('aka', 'sora', 'kii'))
    chars = {1: '酒茶湯宿', 2: '寿花薬夢', 3: '遊笑花', 4: '茶寿宿湯'}.get(seed, '酒茶湯宿')
    n = min(len(chars), 4, (H - 1 - 20) // 25)
    gap = max(0, min(8, (H - 1 - 25 * n - 24) // max(n - 1, 1)))
    c.R(14, 0, 4, H - 3, K('tekko', 2)); c.VL(14, 0, H - 3, K('tekko', 4)); c.VL(17, 0, H - 3, K('tekko', 0))        # 기둥
    for k in range(n):
        y = 1 + k * (25 + gap); col = cols[k % 3]
        c.R(3, y, 26, 2, K(col, 3)); c.HL(3, y, 26, K('shiro', 4))                                                    # 윗면
        c.R(3, y + 2, 26, 22, K(col, 1)); c.VL(3, y + 2, 22, K(col, 3)); c.VL(28, y + 2, 22, K(col, -1)); c.HL(3, y + 23, 26, K(col, -2))
        c.R(6, y + 4, 20, 18, K('shiro', 3)); c.VL(25, y + 4, 18, K('shiro', 1)); c.HL(6, y + 21, 20, K('shiro', 1))
        g = glyph(chars[k])
        for yy, xx in zip(*np.nonzero(g)):
            c.P(7 + xx, y + 5 + yy, K(col, -2)); c.P(8 + xx, y + 5 + yy, K(col, -2))                                  # 가로 2px 굵기(획 연속)
    c.R(10, H - 3, 12, 3, K('tekko', 2)); c.HL(10, H - 3, 12, K('tekko', 4)); c.HL(10, H - 1, 12, K('tekko', -1))        # 받침
    return ink2(c, ext=False)
def barricade(n=3):
    """이동식 방책: 판 바깥 1px 어두운 갈색 윤곽, 밝은 노랑 윗면 2px, 앞면은 45도 노랑·검정 사선 줄무늬, 다리 2개."""
    c = Cv(16 * n, 16)
    for k in range(n):
        x = k * 16
        c.R(x + 1, 1, 14, 9, K('soil', -2))                                                   # 바깥 윤곽(위·좌·우·아래)
        c.R(x + 2, 2, 12, 2, K('kii', 3)); c.HL(x + 2, 2, 12, K('shiro', 4))                  # 윗면 밝은 노랑 2px
        for j in range(4, 9):                                                                 # 앞면: 45도 사선 줄무늬(주기 8)
            for i in range(2, 14): c.P(x + i, j, K('sumi', 1) if (i + j) % 8 < 4 else K('kii', 2))
        c.VL(x + 2, 4, 5, K('kii', 3)); c.HL(x + 2, 8, 12, K('kii', 0))                       # 왼쪽 밝은 단 / 아래 어두운 단
        for lx in (x + 2, x + 11): c.R(lx, 10, 4, 4, K('tekko', 3)); c.VL(lx, 10, 4, K('tekko', 5)); c.VL(lx + 3, 10, 4, K('tekko', 0)); c.HL(lx - 1, 14, 6, K('hodo', -1))
        c.HL(x + 5, 11, 6, K('tekko', 2))
    return ink2(c, ext=False)
def cone():
    c = Cv(16, 16)
    for j in range(10):
        w = 1 + j // 2
        for i in range(-w, w + 1):
            col = K('daidai', 3 if i < 0 else 2 if i == 0 else 1)
            if j in (4, 5): col = K('shiro', 4 if i < 0 else 3)
            c.P(8 + i, 3 + j, col)
    c.R(3, 12, 10, 3, K('daidai', 1)); c.HL(3, 12, 10, K('daidai', 3)); c.HL(3, 14, 10, K('daidai', -1))
    return ink2(c)
def rack(kind=0):
    """옷걸이 랙 2x2칸: 윗 가로대 + 걸린 옷 5벌(색 3종) + 다리 + 바닥 그림자."""
    rng = random.Random(kind * 11 + 4); c = Cv(32, 32)
    c.R(2, 8, 28, 2, K('tekko', 4)); c.HL(2, 8, 28, K('tekko', 6))
    for x in (3, 27): c.R(x, 10, 2, 20, K('tekko', 2)); c.VL(x, 10, 20, K('tekko', 4))
    c.R(2, 28, 28, 2, K('tekko', 2)); c.HL(2, 28, 28, K('tekko', 4)); c.HL(2, 30, 28, K('hodo', -1))
    cols = [('sora', 1), ('aka', 1), ('kii', 2)] if kind % 2 == 0 else [('pinku', 2), ('midori', 1), ('kon', 2)]
    for k in range(5):
        col, t = cols[k % 3]; x = 5 + k * 5
        c.R(x, 10, 5, 14 + (k % 2) * 3, K(col, t)); c.VL(x, 10, 14 + (k % 2) * 3, K(col, min(t + 1, 2))); c.VL(x + 4, 10, 14 + (k % 2) * 3, K(col, t - 1)); c.P(x + 2, 9, K('tekko', 6))
    return ink2(c)
def record_wagon():
    c = Cv(32, 32)
    c.R(2, 13, 28, 3, K('ita', 4)); c.HL(2, 13, 28, K('ita', 6)); c.R(26, 13, 4, 3, K('ita', 2))              # 상판 윗면(왼쪽이 밝음)
    cols = ['aka', 'sora', 'kii', 'midori']
    for k in range(4):
        h = 6 + (k % 3) * 2
        c.R(5 + k * 6, 13 - h, 5, h, K(cols[k], 1)); c.VL(5 + k * 6, 13 - h, h, K(cols[k], 3)); c.VL(9 + k * 6, 13 - h, h, K(cols[k], -1)); c.HL(5 + k * 6, 13 - h, 5, K('shiro', 4))
    c.R(2, 16, 28, 10, K('ita', 0)); c.VL(2, 16, 10, K('ita', 2)); c.VL(29, 16, 10, K('ita', -2)); c.HL(2, 25, 28, K('ita', -3))
    for x in (9, 16, 23): c.VL(x, 17, 8, K('ita', -2))
    for x in (7, 24): wheel(c, x, 28, 3)
    return ink2(c)
def theatre_front(w=8):
    """소극장 정면 띠: 처마(밝은 윗면 2px + 어두운 앞면 1px) + 전구 줄 + 어두운 벽 판 + 포스터 묶음(판 중앙, 굵은 한자 1자, 흰 바탕, 디더 없음)."""
    W, H = 16 * w, 48; c = Cv(W, H)
    c.R(0, 1, W, 2, K('tekko', 5)); c.HL(0, 1, W, K('tekko', 6)); c.HL(0, 3, W, K('tekko', 0))
    c.R(0, 4, W, 8, K('aka', -1)); c.HL(0, 4, W, K('aka', 1)); c.HL(0, 11, W, K('aka', -3))
    for x in range(3, W - 3, 8): c.R(x, 6, 3, 3, K('kii', 4)); c.P(x, 6, K('shiro', 4))
    c.R(0, 12, W, 34, K('tekko', -2)); c.HL(0, 12, W, K('tekko', 0)); c.HL(0, 45, W, K('hodo', -1))
    chars = '祭笑舞夢'
    n = max(1, (W + 6) // 30); x0 = (W - (n * 24 + (n - 1) * 6)) // 2
    for k in range(n):
        x = x0 + k * 30; pc = ['aka', 'sora', 'kii', 'midori', 'murasaki'][k % 5]
        c.R(x, 16, 24, 28, K(pc, 0)); c.HL(x, 16, 24, K(pc, 3)); c.VL(x, 16, 28, K(pc, 2)); c.VL(x + 23, 16, 28, K(pc, -1)); c.HL(x, 43, 24, K(pc, -2))
        c.R(x + 2, 18, 20, 24, K('shiro', 3)); c.VL(x + 21, 18, 24, K('shiro', 1)); c.HL(x + 2, 41, 20, K('shiro', 1))
        g = glyph(chars[k % len(chars)])
        for yy, xx in zip(*np.nonzero(g)):
            c.P(x + 3 + xx, 22 + yy, K(pc, -2)); c.P(x + 4 + xx, 22 + yy, K(pc, -2))
    return ink2(c, ext=False)
