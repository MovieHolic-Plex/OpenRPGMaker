# 투기장 지하 대기실·복도(실내 한 장) + 실내 조각.
# 벽 = 버들항 성 마름돌(castle6.ash)을 지하 조도로 낮춘 앞면 3줄(천장 띠 밑), 바닥 = 칩셋 판석(192,176)을 어둡게 + 횃불 빛 둥근 번짐.
# 쇠창살 = 16변형 오토타일(위층, 막힘), 감방 문 = 별도 조각. 계단 = 북쪽 벽을 파고 오르는 돌계단(바닥 위, 2칸 폭).
import math
from vc_base import *
from px2 import _hash
import wl
from wl import N_, E_, S_, W_, autotile_composed
import vc_props as VP
IR = [hx(c) for c in PAL['iron']]

# ================================================================ 실내 재질 화소
def ceil_px(X, Y):
    c = mul(flag_px(X, Y), 0.26)
    return mix(c, ST[1], 0.55)
def face_px(X, z, H=48):
    """벽 앞면(z=0 바닥, 위로): 맨 아래 받침 3px, 위 돌림띠 4px, 가운데 마름돌. 지하라 어둡다."""
    k = 0.44 + 0.10 * (z / H)
    if z < 3: return mul(ST[2] if z == 0 else ST[3], 0.75)
    if z >= H - 4: return mul((ST[4], ST[5], ST[3], ST[2])[H - 1 - z], 0.6)
    return ash(X, z, k, 16, 8, 61)
def floor_px(X, Y):
    return mul(flag_px(X, Y), 0.52)

# ================================================================ 표본
def ground_flag():
    o = Image.new('RGBA', (48, 48)); px = o.load()
    for y in range(48):
        for x in range(48): px[x, y] = floor_px(x, y) + (255,)
    return o
def face_vault():
    o = Image.new('RGBA', (48, 48)); px = o.load()
    for y in range(48):
        for x in range(48): px[x, y] = face_px(x, 47 - y) + (255,)
    return o
def ceiling_vault():
    o = Image.new('RGBA', (48, 48)); px = o.load()
    for y in range(48):
        for x in range(48):
            c = ceil_px(x, y)
            if y == 47: c = mul(ST[3], 0.8)
            px[x, y] = c + (255,)
    return o

# ================================================================ 쇠창살 오토타일(위층, 막힘)
def bars_cell(n):
    c = Cv(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    # 기둥(가운데): 윗면 + 앞면
    for x in (o + 6, o + 7, o + 8):
        c.set(x, o, 'iron', 6 if x == o + 6 else 5)
        for y in range(o + 1, o + 15): c.set(x, y, 'iron', 5 if x == o + 6 else (4 if x == o + 7 else 2))
        c.set(x, o + 15, 'iron', 1)
    # 남북 팔: 위 가로대 윗면 띠(2px)
    if hasN:
        for y in range(0, o): c.set(o + 6, y, 'iron', 5); c.set(o + 7, y, 'iron', 4); c.set(o + 8, y, 'iron', 2)
    if hasS:
        for y in range(o + 1, 32): c.set(o + 6, y, 'iron', 5); c.set(o + 7, y, 'iron', 4); c.set(o + 8, y, 'iron', 2)
    xs = []
    if hasW: xs += list(range(0, o + 6))
    if hasE: xs += list(range(o + 9, 32))
    for x in xs:
        c.set(x, o, 'iron', 6); c.set(x, o + 1, 'iron', 4)                    # 위 가로대(윗면 + 앞)
        c.set(x, o + 12, 'iron', 5); c.set(x, o + 13, 'iron', 2)              # 아래 가로대
        if (x - o - 7) % 3 == 0:                                              # 세로 창살
            for y in range(o + 2, o + 15): c.set(x, y, 'iron', 5 if y < o + 12 else 4)
            c.set(x, o + 15, 'iron', 1)
        elif (x - o - 7) % 3 == 1:
            for y in range(o + 2, o + 12): c.set(x, y, 'iron', 2)
    if not (hasW or hasE or hasN or hasS):
        for x in range(o + 2, o + 13):
            c.set(x, o + 1, 'iron', 6); c.set(x, o + 2, 'iron', 3)
    return c.img()
def iron_bars(): return autotile_composed(bars_cell)

def cell_door(open_=False):
    """감방 쇠창살 문(16x16, 위층): 창살 넷 + 가로대 + 자물쇠. open_ = 반쯤 열림(걷기)."""
    c = Cv(16, 16)
    for x in range(0, 16): c.set(x, 0, 'iron', 6); c.set(x, 1, 'iron', 4); c.set(x, 12, 'iron', 5); c.set(x, 13, 'iron', 2)
    if open_:
        for x in (0, 1, 14, 15):
            for y in range(2, 15): c.set(x, y, 'iron', 5 if x in (0, 14) else 3)
        for y in range(2, 14): c.set(4, y, 'iron', 5); c.set(5, y, 'iron', 2)
        c.set(5, 7, 'gold', 5)
    else:
        for x in range(1, 16, 3):
            for y in range(2, 15): c.set(x, y, 'iron', 5 if y < 12 else 4); c.set(x + 1, y, 'iron', 2) if y < 12 else None
        for (x, y, t) in ((7, 6, 5), (8, 6, 4), (7, 7, 4), (8, 7, 3), (7, 8, 3)): c.set(x, y, 'gold', t)
    return c.img()

# ================================================================ 실내 소품
def wall_torch():
    """벽 횃불(16x32, 벽 앞면에 거는 것): 쇠 받침 + 나무 자루 + 불꽃 + 벽에 번진 빛."""
    o = Image.new('RGBA', (16, 32)); px = o.load()
    for y in range(4, 30):
        for x in range(16):
            d = math.hypot((x + 0.5 - 8) / 8, (y - 13) / 13)
            if d < 1: px[x, y] = (255, 190, 90, int(70 * (1 - d)))
    c = C(16, 32, seed=821); c.group(1); c.new()
    for y in range(14, 22): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    c.new()
    for x in range(5, 11): c.tone(x, 21, 'iron', 5); c.tone(x, 22, 'iron', 2)
    c.tone(7, 23, 'iron', 4); c.tone(8, 23, 'iron', 2); c.tone(7, 24, 'iron', 3)
    o.alpha_composite(F(c))
    VP._flame(o, 8, 7, ["...6...", "..565..", ".45654.", ".34543.", "..343.", "...2.."])
    return o

def chains_wall():
    """벽 사슬과 족쇄(16x32, 벽 앞면 장식)."""
    c = C(16, 32, seed=822)
    for x0 in (4, 11):
        c.new(); c.tone(x0, 4, 'iron', 6); c.tone(x0 + 1, 4, 'iron', 3)
        for k in range(10):
            y = 6 + k * 2; x = x0 + (k % 2)
            c.tone(x, y, 'iron', 5); c.tone(x, y + 1, 'iron', 3)
        c.new()
        for (dx, dy) in ((-1, 0), (0, -1), (1, -1), (2, 0), (2, 1), (1, 2), (0, 2), (-1, 1)): c.tone(x0 + dx, 27 + dy, 'iron', 5 if dy < 1 else 3)
    return F(c)

def straw_bed():
    """짚 잠자리(32x16 바닥 장식): 흩어진 짚 더미 + 거친 천."""
    c = C(32, 16, seed=823); c.shadow(16, 13, 13, 1.8, 50)
    c.new(); c.ellipsoid(16, 9, 13.5, 4.8, 'rope', amb=0.3, bump=0.6, bsc=1.8)
    for i in range(40):
        x = int(3 + _hash(i, 1, 824) * 26); y = int(4 + _hash(i, 2, 824) * 9)
        if c.m[y][x]: c.tone(x, y, 'gold', 4 + (i % 2)); c.tone(x + 1, y, 'rope', 3)
    c.new()
    for y in range(6, 12):
        for x in range(14, 27):
            if ((x - 20) / 6.5) ** 2 + ((y - 9) / 3.2) ** 2 < 1: c.tone(x, y, 'hide', 4 if y < 9 else 3)
    return F(c)

def bench_wood():
    """나무 긴 의자(32x16): 상판 윗면 + 앞면 + 다리. 아랫줄 막힘."""
    c = C(32, 16, seed=825); c.shadow(16, 13.8, 14, 1.4, 70)
    for x0 in (3, 26):
        c.new()
        for y in range(8, 14): c.tone(x0, y, 'wood', 4); c.tone(x0 + 1, y, 'wood', 2); c.tone(x0 + 2, y, 'wood', 2)
    c.new(); c.box(1, 3, 30, 4, 3, 'wood', top=0.98, front=0.6)
    for x in range(1, 31, 10): c.tone(x, 4, 'wood', 3)
    return F(c)

def bucket():
    c = C(16, 16, seed=826); c.shadow(8, 13.5, 5, 1.2, 70)
    c.new(); c.cylinder(8, 7, 13, 4.6, 'wood', cap=True, capry=1.8, amb=0.25)
    for y in (9, 12):
        for x in range(3, 13):
            if c.m[y][x]: c.tone(x, y, 'iron', 4 if x < 8 else 3)
    for x in range(5, 12): c.tone(x, 7, 'teal', 3)
    c.new(); c.line(3, 7, 8, 2, 'iron', 4); c.line(8, 2, 13, 7, 'iron', 3)
    return F(c)

def barrel():
    """나무 통(16x32 패딩): 쇠 테 셋, 윗면 뚜껑. 밑줄 막힘."""
    c = C(16, 24, seed=827); c.shadow(8, 21.6, 6.5, 1.5, 80)
    c.new(); c.cylinder(8, 6, 21, 6.4, 'wood', cap=True, capry=2.4, amb=0.25)
    for y in (9, 14, 19):
        for x in range(1, 15):
            if c.m[y][x]: c.tone(x, y, 'iron', 4 if x < 8 else 3)
    for x in range(4, 12): c.tone(x, 6, 'wood', 3)
    return F(c)

def crate():
    c = C(16, 16, seed=828); c.shadow(8, 14, 7, 1.4, 70)
    c.new(); c.box(1, 2, 14, 4, 9, 'wood', top=1.0, front=0.6)
    for y in range(6, 15): c.tone(1, y, 'wood', 5); c.tone(14, y, 'wood', 2)
    c.line(2, 7, 13, 14, 'wood', 3); c.line(2, 6, 13, 6, 'wood', 6)
    return F(c)

def stairs_up():
    """북쪽 벽을 파고 오르는 돌계단(32x64): 맨 아래 단은 바닥 줄(4번째 칸 줄), 위로 갈수록 어둡다. 양옆 벽 뺨.
    걷기: 아래 두 칸 줄은 걷기(계단 입구), 위는 벽 속(이벤트로 경기장 쇠창살 문과 잇는다)."""
    w, h = 32, 64
    o = Image.new('RGBA', (w, h)); px = o.load()
    steps = 9
    for y in range(h):
        for x in range(w):
            if x < 3 or x > w - 4:                                      # 벽 뺨(앞면 결)
                c = mul(face_px(x + 37, (h - 1 - y) % 48), 0.95 if x < 3 else 0.75)
                if x in (2, w - 3): c = mul(ST[2], 0.8)
            else:
                f = y / h
                s = int(y / (h / steps))
                ly = y - s * (h / steps)
                light = 0.30 + 0.62 * f
                if ly < 2.2: c = mul(ST[5], light)                       # 디딤 앞 모(밝음)
                elif ly < 4.4: c = mul(flag_px(x, y), light * 0.92)        # 디딤 윗면
                else: c = mul(ST[3], light * 0.85)                        # 챌면
            px[x, y] = tuple(c) + (255,)
    for y in range(0, 10):                                              # 위쪽은 어둠으로 사라진다
        for x in range(3, w - 3):
            r, g, b, a = px[x, y]; t = y / 10.0
            px[x, y] = (int(r * t * 0.6), int(g * t * 0.6), int(b * t * 0.7), 255)
    return o

def table_tools():
    """작업대(32x32): 나무 상판 위 투구 하나·칼 하나·숫돌·천. 아랫줄 막힘, 상판 걷기+가림."""
    c = C(32, 32, seed=829); c.shadow(16, 29.5, 14, 1.6, 80)
    c.group(1)
    for x0 in (3, 27):
        c.new()
        for y in range(20, 30): c.tone(x0, y, 'wood', 4); c.tone(x0 + 1, y, 'wood', 2)
    c.new(); c.box(1, 13, 30, 6, 4, 'wood', top=0.98, front=0.6)
    c.group(2); c.new(); c.ellipsoid(9, 12, 4.2, 3.8, 'iron', amb=0.3, bias=0.08)
    for x in range(6, 12): c.tone(x, 13, 'dark', 1)
    c.new(); c.line(14, 15, 28, 13, 'iron', 6); c.line(14, 16, 28, 14, 'iron', 3); c.tone(13, 15, 'gold', 5); c.tone(13, 16, 'gold', 3)
    c.new()
    for x in range(20, 27): c.tone(x, 17, 'cloth', 4); c.tone(x, 18, 'cloth', 3)
    return F(c)

# ================================================================ 실내 한 장
RW, RH = 40, 10
DOORS = [(3, 7), (8, 7), (13, 7)]
STAIR_X = 35
BLOCK_SE = [(x, y) for x in range(33, 39) for y in (8,)]      # 복도: 동쪽은 남쪽 벽 덩이가 올라와 좁아진다

def room():
    """반환 (RGBA 이미지 RW*16 x RH*16, 통행 rows, 표시 marks(로컬 칸), 소품 위층 목록 [(img,x,y,sorty)])."""
    Wp, Hp = RW * 16, RH * 16
    o = Image.new('RGBA', (Wp, Hp), (0, 0, 0, 255)); px = o.load()
    walk = [[False] * RW for _ in range(RH)]
    blk = set(BLOCK_SE)
    def is_ceil(cx, cy):
        return cy == 0 or cy == RH - 1 or cx == 0 or cx == RW - 1 or (cx, cy) in blk
    for cy in range(RH):
        for cx in range(RW):
            kind = 'floor'
            if is_ceil(cx, cy): kind = 'ceil'
            elif 1 <= cy <= 3: kind = 'face'
            for j in range(16):
                for i in range(16):
                    X, Y = cx * 16 + i, cy * 16 + j
                    if kind == 'ceil':
                        c = ceil_px(X, Y)
                        if j == 15 and not is_ceil(cx, cy + 1) and cy + 1 < RH and cy + 1 > 3: c = mul(ST[3], 0.75)
                        if cy == 0 and j == 15 and 0 < cx < RW - 1: c = mul(ST[3], 0.75)
                        if j == 0 and cy > 0 and not is_ceil(cx, cy - 1): c = mul(ST[4], 0.7)
                        if i == 15 and cx + 1 < RW and not is_ceil(cx + 1, cy): c = mul(ST[3], 0.7)
                        if i == 0 and cx > 0 and not is_ceil(cx - 1, cy): c = mul(ST[2], 0.8)
                    elif kind == 'face':
                        z = (3 - cy) * 16 + (15 - j)
                        c = face_px(X, z)
                    else:
                        c = floor_px(X, Y)
                        if cy == 4 and j < 3: c = mul(c, 0.55 + 0.15 * j)                 # 벽 발치 그늘
                        if cx == 1 and i < 3: c = mul(c, 0.7 + 0.1 * i)
                        if (cx, cy - 1) in blk and j < 2: c = mul(c, 0.7)
                    px[X, Y] = tuple(int(v) for v in c) + (255,)
            walk[cy][cx] = (kind == 'floor')
    TORCH = [(3, 2), (8, 2), (13, 2), (19, 2), (25, 2), (31, 2), (38, 2)]
    A = np.array(o).astype(np.float64)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    glow = np.zeros((Hp, Wp))
    for (tx, ty) in TORCH:
        gx, gy = tx * 16 + 8, 4 * 16 + 6
        d = np.hypot((X - gx) / 70.0, (Y - gy) / 46.0)
        glow = np.maximum(glow, np.clip(1 - d, 0, 1))
    g = glow[..., None]
    A[:, :, :3] = A[:, :, :3] * (1 + 0.42 * g) + np.array([26, 12, -4]) * g
    o = Image.fromarray(np.clip(A, 0, 255).astype(np.uint8), 'RGBA')
    st = stairs_up(); o.alpha_composite(st, (STAIR_X * 16, 1 * 16))
    for cy in (3, 4):
        for cx in (STAIR_X, STAIR_X + 1): walk[cy][cx] = True
    ups = []
    def put_up(im, cx, cy, block, dx=0, dy=0):
        x = cx * 16 + dx; y = (cy + 1) * 16 - im.height + dy
        ups.append((im, x, y, (cy + 1) * 16))
        for (i, j) in block:
            if 0 <= cy + j < RH and 0 <= cx + i < RW: walk[cy + j][cx + i] = False
    BAR = [[False] * RW for _ in range(RH)]
    for x in range(1, 16): BAR[7][x] = True
    for y in range(4, 8): BAR[y][5] = True; BAR[y][10] = True; BAR[y][16] = True
    BAR[7][16] = True
    for (dx, dy) in DOORS: BAR[dy][dx] = False
    sheet = iron_bars()
    def on(x, y): return 0 <= x < RW and 0 <= y < RH and (BAR[y][x] or (x, y) in DOORS or (y < 4 and x in (5, 10, 16)))
    for y in range(RH):
        for x in range(RW):
            if not BAR[y][x]: continue
            n = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            cell = sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
            ups.append((cell, x * 16, y * 16, y * 16 + 16)); walk[y][x] = False
    for i, (dx, dy) in enumerate(DOORS):
        ups.append((cell_door(open_=(i == 1)), dx * 16, dy * 16, dy * 16 + 16))
        walk[dy][dx] = (i == 1)
    for (tx, ty) in TORCH:
        o.alpha_composite(wall_torch(), (tx * 16, 1 * 16 + 4))
    for x in (1, 6, 12, 22, 29):
        o.alpha_composite(chains_wall(), (x * 16, 2 * 16))
    import vc_veldt as VV
    put_up(straw_bed(), 1, 6, [])
    put_up(bucket(), 4, 4, [(0, 0)])
    put_up(straw_bed(), 6, 5, [])
    put_up(VV.bones_scatter(), 8, 6, [])
    put_up(straw_bed(), 12, 6, [])
    put_up(bucket(), 14, 4, [(0, 0)])
    put_up(VP.weapon_rack(), 18, 4, [(0, 0), (1, 0)])
    put_up(VP.armor_stand(), 20, 4, [(0, 0)], dx=2)
    put_up(VP.armor_stand(), 21, 4, [(0, 0)], dx=5)
    put_up(VP.shields_stack(), 23, 4, [(0, 0), (1, 0)], dx=4)
    put_up(VP.weapon_rack(), 26, 4, [(0, 0), (1, 0)], dx=2)
    put_up(table_tools(), 29, 4, [(0, 0), (1, 0)], dx=2)
    put_up(VP.grindstone(), 31, 5, [(0, 0), (1, 0)], dx=6)
    put_up(bench_wood(), 19, 7, [(0, 0), (1, 0)])
    put_up(bench_wood(), 24, 8, [(0, 0), (1, 0)])
    put_up(VP.training_dummy(), 22, 8, [(0, 0)], dx=3)
    put_up(VP.training_dummy(), 28, 7, [(0, 0)], dx=-2)
    put_up(barrel(), 1, 8, [(0, 0)])
    put_up(barrel(), 2, 8, [(0, 0)], dx=2)
    put_up(crate(), 3, 8, [(0, 0)], dx=3)
    put_up(VP.spear_barrel(), 31, 8, [(0, 0)])
    put_up(crate(), 30, 8, [(0, 0)], dx=-4)
    put_up(VP.brazier(), 34, 5, [(0, 0)])
    put_up(VP.brazier(), 37, 5, [(0, 0)], dx=4)
    put_up(barrel(), 38, 7, [(0, 0)])
    put_up(VP.shields_stack(), 33, 7, [(0, 0), (1, 0)], dy=0)
    marks = {'stairs_top': (STAIR_X, 3), 'stairs_foot': (STAIR_X, 5), 'hall': (24, 6), 'cell_open': (8, 5), 'west_end': (5, 8), 'corridor_end': (37, 6)}
    return o, walk, marks, ups

def grindstone_(): return VP.grindstone()
