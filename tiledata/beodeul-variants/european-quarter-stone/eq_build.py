# 석조 유럽 시가지 건물 키트 — eq_facade 문법으로 조립. 모든 건물의 층 높이·창 높이·처마선이 같은 상수에서 나온다.
# 옆 건물과 어깨를 맞대고 줄지어 세울 수 있게 양 옆 벽이 곧게 끝난다(맨사르드 끝면만 살짝 비스듬).
from eq_facade import *

SHUT_G = R7('#0b120f', '#14201a', '#1e2c25', '#283830', '#33463c', '#41574a', '#56705e')   # 회록 덧창
SHUT_B = R7('#0b0e14', '#141a24', '#1e2633', '#283343', '#344155', '#435268', '#5a6b82')   # 회청 덧창

def _upper(f, k, bays, kind='sash', box=(), shut=None, lit=(), hood=None):
    for b in bays: f.window(b, k, kind, box=(b in box), shut=shut, lit=((k, b) in lit), hood=hood)

def grand_hotel(seed=3):
    """4층 + 맨사르드, 8베이: 벽기둥 둘, 2·3층 철 발코니 두 쌍, 1층 가운데 줄무늬 차양 진열창, 양옆 쌍여닫이 문, 왕관 간판."""
    f = Facade(8, 4, seed=seed); f.fill_wall()
    for x in (16 * 2 - 2, 16 * 6 - 2): f.pilaster(x)
    for k in (1, 2, 3): _upper(f, k, range(8), 'sash' if k == 3 else 'french', lit=((3, 2),), hood='pedi' if k == 1 else None)
    for k in (1, 2): f.balcony(1, 3, k); f.balcony(4, 6, k)
    f.cornice(); f.mansard(dormers=(1, 2, 5, 6), chimneys=((0, 4), (7, 4)))
    f.window(0, 0); f.window(7, 0)
    f.shopfront(2, 5); f.awning(2, 5); f.door(1); f.door(6)
    f.sign(6 * 16 + 6, f.y_gf + 3, 'crown'); f.lamp(16 - 4, f.y_gf + 8); f.lamp(7 * 16 - 2, f.y_gf + 8)
    f.drainpipe(8 * 16 - 5)
    return f.done()

def hotel_wing(seed=5):
    """호텔 곁채 4층 + 맨사르드, 4베이: 큰 호텔과 처마선이 같다. 2층 긴 발코니, 1층 창 넷(아래 철창)."""
    f = Facade(4, 4, seed=seed); f.fill_wall()
    for k in (1, 2, 3): _upper(f, k, range(4), 'french' if k == 1 else 'sash')
    f.balcony(0, 3, 1)
    f.cornice(); f.mansard(dormers=(1, 2), chimneys=((3, 6),))
    for b in range(4): f.window(b, 0, box=(b in (0, 3)))
    f.drainpipe(3)
    return f.done()

def inn(seed=11):
    """여관 3층 + 맨사르드, 6베이: 가운데 쌍문(양옆 벽등), 침대 그림 간판(글자 없음), 창가 화분, 2층 발코니 하나."""
    f = Facade(6, 3, seed=seed, base_ramp=ASH_W); f.fill_wall()
    _upper(f, 1, range(6), 'sash', box=(0, 1, 4, 5), hood='flat')
    _upper(f, 2, range(6), 'sash', lit=((2, 2),))
    f.balcony(2, 3, 1)
    f.cornice(); f.mansard(dormers=(0, 2, 3, 5), chimneys=((1, 4), (4, 6)))
    for b in (0, 1, 4, 5): f.window(b, 0, box=True)
    f.door(2, wide=2); f.lamp(2 * 16 - 6, f.y_gf + 9); f.lamp(4 * 16, f.y_gf + 9)
    f.sign(4 * 16 + 10, f.y_gf + 2, 'bed')
    f.drainpipe(6 * 16 - 5)
    return f.done()

def cafe(seed=17):
    """카페 3층 + 맨사르드, 5베이: 1층 전체 줄무늬 차양 + 진열창, 오른쪽 문, 찻잔 간판, 2층 발코니."""
    f = Facade(5, 3, seed=seed, base_ramp=ASH_D); f.fill_wall()
    _upper(f, 1, range(5), 'french', hood='pedi')
    _upper(f, 2, range(5), 'sash', box=(1, 3))
    f.balcony(0, 4, 1)
    f.cornice(); f.mansard(dormers=(0, 2, 4), chimneys=((3, 2),))
    f.shopfront(0, 3); f.door(4, kind='single'); f.awning(0, 4)
    f.sign(4 * 16 + 6, f.y_gf - 12, 'cup')
    return f.done()

def shop(seed, bays, icon, A, B_, storeys=3, roof='mansard', door_b=None, ramp=None, hood=None):
    f = Facade(bays, storeys, roof=roof, seed=seed, base_ramp=ramp); f.fill_wall()
    for k in range(1, storeys):
        _upper(f, k, range(bays), 'sash', box=tuple(b for b in range(bays) if (b + k + seed) % 3 == 0), shut=SHUT_B if seed % 2 else None, hood=hood if k == 1 else None)
    f.cornice()
    if roof == 'mansard': f.mansard(dormers=tuple(range(0, bays, 2)) if bays > 3 else (1,), chimneys=((bays - 1, 5),))
    else: f.hip(chimneys=((1, 2),))
    d = bays - 1 if door_b is None else door_b
    rest = [b for b in range(bays) if b != d]
    f.shopfront(min(rest), max(rest)) if rest == list(range(min(rest), max(rest) + 1)) else None
    f.door(d, kind='single'); f.awning(min(rest), max(rest), A, B_)
    f.sign(d * 16 + 6 if d else 10, f.y_gf - 12, icon)
    return f.done()

def bakery(): return shop(21, 4, 'loaf', AWN_G, AWN_C, ramp=ASH_W, hood='flat')
def apothecary(): return shop(22, 4, 'bottle', SHUT_B, AWN_C, roof='hip', door_b=0)
def cobbler(): return shop(25, 3, 'boot', AWN_R, AWN_R, door_b=2, ramp=ASH_D)

def townhouse_narrow(seed=31):
    """좁은 4층 타운하우스 + 맨사르드, 3베이: 창마다 작은 쇠 난간, 계단 위 문, 굴뚝."""
    f = Facade(3, 4, seed=seed, base_ramp=ASH_W); f.fill_wall()
    for k in (1, 2, 3):
        _upper(f, k, range(3), 'french' if k < 3 else 'sash')
        if k < 3:
            for b in range(3): f.balconette(b, k)
    f.cornice(); f.mansard(dormers=(1,), chimneys=((0, 2), (2, 6)))
    f.window(0, 0); f.window(2, 0, box=True); f.door(1, kind='single')
    f.drainpipe(3 * 16 - 5)
    return f.done()

def townhouse_wide(seed=33):
    """넓은 3층 타운하우스, 5베이, 우진각 슬레이트 지붕 + 굴뚝 둘: 회록 덧창, 가운데 문 위 작은 발코니."""
    f = Facade(5, 3, roof='hip', seed=seed, base_ramp=ASH_D); f.fill_wall()
    for k in (1, 2): _upper(f, k, range(5), 'sash', shut=SHUT_G, box=(1, 3) if k == 1 else (), hood='flat' if k == 1 else None)
    f.balconette(2, 1)
    f.cornice(); f.hip(chimneys=((1, 2), (3, 8)))
    for b in (0, 1, 3, 4): f.window(b, 0, shut=SHUT_G)
    f.door(2)
    return f.done()

def townhouse_corner(seed=37):
    """모퉁이 3층 타운하우스 + 맨사르드, 4베이: 왼쪽 끝 벽기둥, 2층 긴 발코니, 1층 문 둘(가게 겸)."""
    f = Facade(4, 3, seed=seed); f.fill_wall(); f.pilaster(14)
    _upper(f, 1, range(4), 'french'); _upper(f, 2, range(4), 'sash', box=(2,))
    f.balcony(1, 3, 1)
    f.cornice(); f.mansard(dormers=(1, 3), chimneys=((0, 3),))
    f.door(0, kind='single'); f.window(1, 0, box=True); f.window(2, 0, box=True); f.door(3, kind='single')
    return f.done()

def low_shop(seed=41):
    """낮은 2층 가게 + 맨사르드, 4베이: 1층 진열창 넷 위 바랜 붉은 차양, 가위 간판(재봉사)."""
    f = Facade(4, 2, seed=seed, base_ramp=ASH_W); f.fill_wall()
    _upper(f, 1, range(4), 'sash', box=(0, 3))
    f.cornice(); f.mansard(dormers=(1, 2), chimneys=((3, 4),))
    f.shopfront(0, 2); f.door(3, kind='single'); f.awning(0, 2, AWN_R, AWN_R)
    f.sign(3 * 16 + 6, f.y_gf - 12, 'scissor')
    return f.done()

def warehouse(seed=51):
    """붉은 벽돌 창고 2층, 6베이, 우진각 지붕: 2베이 짐 문(널문), 위층 짐 받는 문과 도르래 들보, 작은 창."""
    f = Facade(6, 2, roof='hip', base_ramp=BRICK, seed=seed)
    f.fill_wall()
    # 벽돌 결: 마름돌 대신 4x2 벽돌 줄눈
    for y in range(f.y_wall, f.base - 2):
        for x in range(2, f.W - 2):
            j = (y - f.y_wall); off = 4 if (j // 3) % 2 else 0
            if j % 3 == 2 or (x + off) % 8 == 0: f.P(x, y, BRICK[1])
            elif H(x // 8, j // 3, seed) > 0.8: f.P(x, y, BRICK[4])
            else: f.P(x, y, BRICK[3] if (x + j) % 7 else BRICK[2])
    for b in (0, 1, 4, 5): f.window(b, 1, h=14)
    f.cornice(); f.hip(chimneys=((4, 6),))
    # 위층 짐 문 + 도르래 들보
    x0 = 2 * 16 + 6; y0 = f.storey_top(1) + 6
    for y in range(y0, y0 + 22):
        for x in range(x0, x0 + 20): f.P(x, y, WOOD[3] if (x - x0) % 4 else WOOD[1])
    for x in range(x0 - 2, x0 + 22): f.P(x, y0 - 1, TRIM[4]); f.P(x, y0 - 2, TRIM[5])
    for x in range(x0 + 8, x0 + 12):
        for y in range(y0 - 12, y0 - 2): f.P(x, y, WOOD[4] if x < x0 + 10 else WOOD[2])
    for y in range(y0 - 3, y0 + 6): f.P(x0 + 10, y, IRON[4])
    f.P(x0 + 9, y0 + 6, IRON[5]); f.P(x0 + 11, y0 + 6, IRON[3])
    # 1층 큰 짐 문(2베이) + 창
    xd = 2 * 16 + 2; yt = f.y_gf + 6
    for y in range(yt, f.base - 2):
        for x in range(xd, xd + 28):
            c = WOOD[3] if (x - xd) % 4 else WOOD[1]
            if abs(x - xd - 14) < 1: c = WOOD[1]
            if (y - yt) in (3, 14, 25): c = IRON[3]
            f.P(x, y, c)
    for x in range(xd - 2, xd + 30): f.P(x, yt - 1, TRIM[5]); f.P(x, yt - 2, TRIM[3])
    for b in (0, 1, 5): f.window(b, 0, h=14)
    f.door(4, kind='single', step=False)
    return f.done()

def passage_arch(seed=61):
    """길이 건물 밑으로 지나가는 3층 아치 통로 건물 + 맨사르드, 3베이: 1층 가운데가 뚫린 반원 아치(걷기)."""
    f = Facade(3, 3, seed=seed, base_ramp=ASH_D); f.fill_wall()
    for k in (1, 2): _upper(f, k, range(3), 'sash', box=(1,) if k == 1 else (), hood='pedi' if k == 1 else None)
    f.cornice(); f.mansard(dormers=(1,), chimneys=((2, 6),))
    f.window(0, 0, h=14); f.window(2, 0, h=14)
    cx = 24; r = 10; yt = f.y_gf + 6
    for y in range(yt, f.base + 1):
        for x in range(cx - r - 3, cx + r + 3):
            inside = (abs(x + 0.5 - cx) <= r) and (y >= yt + r or (x + 0.5 - cx) ** 2 + (y - yt - r) ** 2 <= r * r)
            ring = (abs(x + 0.5 - cx) <= r + 3) and (y >= yt + r or (x + 0.5 - cx) ** 2 + (y - yt - r) ** 2 <= (r + 3) ** 2)
            if inside:
                d = y - yt
                c = ASH[0] if d < r + 6 else (ASH[1] if d < r + 14 else COB[2])
                if y >= f.base - 6: c = COB[2] if (x + y) % 3 else COB[3]
                f.P(x, y, c)
            elif ring:
                k = int(math.degrees(math.atan2(y - yt - r, x + 0.5 - cx))) // 18
                f.P(x, y, TRIM[5] if k % 2 else TRIM[3])
    for y in range(yt, yt + 4): f.P(cx, y - 2, TRIM[6]); f.P(cx + 1, y - 2, TRIM[4])
    return f.done()

def court_gate(seed=71):
    """안마당 돌담과 쇠 대문(3칸 폭, 2칸 높이): 담 갓돌, 가운데 쇠창살 쌍문, 양옆 돌기둥과 등."""
    W, Hh = 48, 40; im, px = mk(W, Hh)
    t = wall_tones(W, Hh, seed)
    for y in range(12, Hh):
        for x in range(W): put(px, W, Hh, x, y, ASH[t[y, x]])
    for x in range(W): put(px, W, Hh, x, 12, TRIM[6]); put(px, W, Hh, x, 13, TRIM[4]); put(px, W, Hh, x, 14, ASH[1])
    for (x0) in (0, W - 8):
        for y in range(2, Hh):
            for x in range(x0, x0 + 8): put(px, W, Hh, x, y, TRIM[5] if x == x0 else TRIM[3] if x < x0 + 6 else TRIM[1])
        for x in range(x0 - 1, x0 + 9): put(px, W, Hh, x, 2, TRIM[6]); put(px, W, Hh, x, 3, TRIM[4])
        for x in range(x0 + 2, x0 + 6):
            for y in (0, 1): put(px, W, Hh, x, y, AMBER[5] if y == 1 else IRON[4])
    for y in range(14, Hh - 1):
        for x in range(10, W - 10):
            put(px, W, Hh, x, y, (0, 0, 0, 0)[:3], 0)
            if (x - 10) % 3 == 0 or y in (16, 27, Hh - 3): put(px, W, Hh, x, y, IRON[4] if (x - 10) % 3 == 0 else IRON[3])
    for x in range(10, W - 10, 3): put(px, W, Hh, x, 13, IRON[5]); put(px, W, Hh, x, 12, IRON[3])
    for y in range(14, Hh - 1): put(px, W, Hh, W // 2, y, IRON[2])
    return fin(im)

def fountain_wall(seed=81):
    """벽 분수(2칸 폭, 3칸 높이): 돌 벽감에 사자머리 대신 단순한 물주둥이, 아래 돌 수반에 물."""
    W, Hh = 32, 48; im, px = mk(W, Hh)
    for y in range(4, 34):
        for x in range(2, 30):
            c = ASH[3] if (x + (y // 4) * 3) % 8 else ASH[2]
            if (y % 4) == 3: c = ASH[2]
            put(px, W, Hh, x, y, c)
    for y in range(8, 30):
        for x in range(8, 24):
            if (x + 0.5 - 16) ** 2 + ((y - 16) * 1.0) ** 2 <= 64 or y >= 16: put(px, W, Hh, x, y, ASH[1] if y > 12 else ASH[2])
    for x in range(1, 31): put(px, W, Hh, x, 3, TRIM[6]); put(px, W, Hh, x, 4, TRIM[4])
    for y in range(18, 34): put(px, W, Hh, 16, y, PUD[5] if y % 3 else PUD[6]); put(px, W, Hh, 15, y, PUD[4])
    for x in range(13, 19): put(px, W, Hh, x, 17, TRIM[5]); put(px, W, Hh, x, 18, TRIM[3])
    for y in range(32, 46):
        for x in range(1, 31):
            c = TRIM[4] if y < 35 else TRIM[3] if x < 26 else TRIM[2]
            if y in (32,): c = TRIM[6]
            if 34 <= y < 38 and 3 <= x < 29: c = PUD[3] if (x + y) % 5 else PUD[5]
            put(px, W, Hh, x, y, c)
    for x in range(2, 30): put(px, W, Hh, x, 46, ASH[1])
    return fin(im)
