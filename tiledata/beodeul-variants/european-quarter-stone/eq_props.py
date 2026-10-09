# 석조 유럽 시가지 거리 소품 — 버들항 px2 캔버스(C: 3/4 입체 셰이딩·잔결·색 윤곽)에 이 장소 램프를 재료로 등록해 그린다.
# 모두 3/4 시점(윗면 + 앞면), 빛 왼쪽 위, 16px 칸, 왼쪽 아래 기준. 사람·글자·상표 없음.
from eq_base import *
from px2 import C, PAL, GRAIN
import eq_facade as FA

def _hexr(R): return ['#%02x%02x%02x' % tuple(c) for c in R]
for _n, _R, _g in (('e_iron', IRON, (0.05, 2)), ('e_wood', WOOD, (0.10, 1.2)), ('e_bark', BARK, (0.16, 1.4)), ('e_ash', ASH, (0.10, 2.2)),
                   ('e_trim', TRIM, (0.08, 2.2)), ('e_awr', AWN_R, (0.06, 1.6)), ('e_awc', AWN_C, (0.06, 1.6)), ('e_awg', AWN_G, (0.05, 2)),
                   ('e_leaf', LEAF, (0.22, 1.6)), ('e_amber', AMBER, (0.0, 2)), ('e_glass', GLASS, (0.02, 2)), ('e_brick', BRICK, (0.10, 1.8)),
                   ('e_flower', FLOWR, (0.08, 1.6)), ('e_water', PUD, (0.03, 2)), ('e_cob', COB, (0.12, 2)), ('e_snow', SNOW, (0.06, 2)),
                   ('e_zinc', ZINC, (0.05, 2)), ('e_leafy', LEAFY, (0.12, 1.6)), ('e_leaff', LEAFF, (0.12, 1.6))):
    PAL[_n] = _hexr(_R); GRAIN[_n] = _g

def done(c, k=0.62): return fin(c.img(outline=True), k) if False else pz.fin(c, k)

# ---------------------------------------------------------------- 가로등
def lamp_double(seed=1):
    """쌍등 가로등(1x3칸): 검은 쇠 기둥(밑 받침 두툼), 꼭대기 가로 팔에 유리 등 둘(호박빛), 등 지붕 뾰족."""
    c = C(16, 48, seed); c.group(1)
    c.box(5, 40, 6, 2, 5, 'e_iron'); c.box(6, 36, 4, 1, 4, 'e_iron')
    for y in range(12, 37): c.tone(7, y, 'e_iron', 4); c.tone(8, y, 'e_iron', 2)
    for x in range(1, 15): c.tone(x, 11, 'e_iron', 4); c.tone(x, 12, 'e_iron', 2)
    c.tone(7, 9, 'e_iron', 5); c.tone(8, 9, 'e_iron', 3); c.tone(7, 10, 'e_iron', 4); c.tone(8, 10, 'e_iron', 2)
    for lx in (1, 11):
        for y in range(4, 10):
            for x in range(lx, lx + 4): c.tone(x, y, 'e_amber', 5 if y < 7 else 4)
        c.tone(lx, 5, 'e_amber', 6)
        for x in range(lx - 1, lx + 5): c.tone(x, 3, 'e_iron', 3); c.tone(x, 10, 'e_iron', 2)
        for x in range(lx, lx + 4): c.tone(x, 2, 'e_iron', 4)
        c.tone(lx + 1, 1, 'e_iron', 5); c.tone(lx + 2, 1, 'e_iron', 3); c.tone(lx + 1, 0, 'e_iron', 4)
        for y in range(4, 10): c.tone(lx - 1, y, 'e_iron', 2); c.tone(lx + 4, y, 'e_iron', 1)
    return done(c)

def lamp_single(seed=2):
    """홑등 가로등(1x3칸): 가는 쇠 기둥, 꼭대기 육각 유리 등 하나, 기둥 중간 고리 장식."""
    c = C(16, 48, seed); c.group(1)
    c.box(5, 41, 6, 2, 4, 'e_iron')
    for y in range(13, 42): c.tone(7, y, 'e_iron', 4); c.tone(8, y, 'e_iron', 2)
    for x in (6, 9): c.tone(x, 26, 'e_iron', 4 if x == 6 else 2); c.tone(x, 27, 'e_iron', 3 if x == 6 else 1)
    for y in range(4, 12):
        for x in range(5, 11): c.tone(x, y, 'e_amber', 5 if y < 8 else 4)
    c.tone(6, 5, 'e_amber', 6); c.tone(6, 6, 'e_amber', 6)
    for x in range(4, 12): c.tone(x, 3, 'e_iron', 4); c.tone(x, 12, 'e_iron', 2)
    for x in range(5, 11): c.tone(x, 2, 'e_iron', 3)
    c.tone(7, 1, 'e_iron', 5); c.tone(8, 1, 'e_iron', 3); c.tone(7, 0, 'e_iron', 4)
    for y in range(4, 12): c.tone(4, y, 'e_iron', 3); c.tone(11, y, 'e_iron', 1); c.tone(8, y, 'e_iron', 2)
    return done(c)

# ---------------------------------------------------------------- 통·상자
def barrel(seed=3):
    """나무 통(1칸): 둥근 몸통, 쇠테 둘, 윗면 뚜껑 판자."""
    c = C(16, 16, seed); c.group(1)
    c.cylinder(8, 4, 14, 5.5, 'e_wood', capry=2.4)
    for y in (6, 12):
        for x in range(2, 14): c.tone(x, y, 'e_iron', 3 if x < 9 else 2)
    for y in range(3, 15):
        for x in (5, 11): c.darken(x, y, 1)
    return done(c)

def barrels_stack(seed=4):
    """눕힌 통 셋을 쌓은 더미(2x2칸): 아래 둘 위 하나, 마구리 면(나이테)이 앞을 본다."""
    c = C(32, 32, seed); c.group(1)
    for (cx, cy) in ((9, 24), (22, 24), (15.5, 13)):
        c.new(); rx, ry = 6.5, 6.5
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry; r = dx * dx + dy * dy
                if r > 1: continue
                ring = math.sqrt(r)
                t = 5 if ring < 0.35 else 4 if ring < 0.7 else 3
                if 0.78 < ring < 0.92: t = 1
                if dx + dy < -0.6 and ring > 0.92: t = 5
                if dx + dy > 0.6 and ring > 0.92: t = 2
                c.tone(x, y, 'e_wood', t if ring <= 0.78 or ring >= 0.92 else 1)
                if 0.78 < ring < 0.92: c.tone(x, y, 'e_iron', 3)
        c.tone(int(cx) - 1, int(cy) - 1, 'e_wood', 6)
    return done(c)

def crate(seed=5):
    """나무 상자(1칸): 윗면 판자, 앞면 X 버팀목."""
    c = C(16, 16, seed); c.group(1)
    c.box(2, 3, 12, 4, 8, 'e_wood')
    for i in range(8):
        c.tone(3 + i * 10 // 8, 7 + i, 'e_wood', 5); c.tone(12 - i * 10 // 8, 7 + i, 'e_wood', 4)
    for x in range(2, 14): c.tone(x, 7, 'e_wood', 2)
    for y in range(7, 15): c.tone(2, y, 'e_wood', 5); c.tone(13, y, 'e_wood', 2)
    for x in range(2, 14, 4):
        for y in range(3, 7): c.darken(x, y, 1)
    return done(c)

def crates_stack(seed=6):
    """상자 셋 더미(2x2칸): 아래 둘, 위 하나는 비스듬히 얹힘, 맨 위에 자루 하나."""
    c = C(32, 32, seed); c.group(1)
    for (x0, y0) in ((1, 17), (16, 17), (8, 5)):
        c.box(x0, y0, 14, 4, 9, 'e_wood')
        for i in range(9):
            c.tone(x0 + 1 + i * 12 // 9, y0 + 4 + i, 'e_wood', 5); c.tone(x0 + 12 - i * 12 // 9, y0 + 4 + i, 'e_wood', 4)
        for x in range(x0, x0 + 14): c.tone(x, y0 + 4, 'e_wood', 2)
        for y in range(y0 + 4, y0 + 13): c.tone(x0, y, 'e_wood', 5); c.tone(x0 + 13, y, 'e_wood', 2)
    c.ellipsoid(19, 4, 4, 3, 'e_awc', amb=0.3)
    return done(c)

def barrel_cart(seed=7):
    """술통 손수레(2x2칸): 두 바퀴 수레에 눕힌 통 둘, 손잡이 막대."""
    c = C(32, 32, seed); c.group(1)
    c.box(2, 14, 24, 5, 4, 'e_wood')
    for (cx) in (9, 20):
        c.hcyl(cx - 4, cx + 4, 11, 4.5, 'e_wood', endcap='L', capmat='e_wood')
        for y in range(7, 16): c.tone(cx - 2, y, 'e_iron', 3); c.tone(cx + 3, y, 'e_iron', 2)
    for x in range(25, 31): c.tone(x, 15 - (x - 25) // 2, 'e_wood', 4); c.tone(x, 16 - (x - 25) // 2, 'e_wood', 2)
    c.new()
    for (cx, cy) in ((8, 25), ):
        for y in range(18, 32):
            for x in range(2, 15):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if 5.2 < d <= 6.6: c.tone(x, y, 'e_iron', 4 if x < cx else 2)
                elif d < 1.6: c.tone(x, y, 'e_iron', 5)
                elif d <= 5.2 and (int(math.degrees(math.atan2(y + 0.5 - cy, x + 0.5 - cx))) % 60) < 12: c.tone(x, y, 'e_wood', 3)
    for y in range(18, 30): c.tone(22, y, 'e_wood', 4); c.tone(23, y, 'e_wood', 2)
    return done(c)

# ---------------------------------------------------------------- 나무
def _tree_crown(c, cx, cy, rx, ry, seed):
    for k in range(9):
        a = k * 0.7 + seed; ox = math.cos(a) * rx * 0.45; oy = math.sin(a) * ry * 0.35
        c.ellipsoid(cx + ox, cy + oy, rx * 0.55, ry * 0.55, 'e_leaf', amb=0.22, bump=0.5, bsc=2.0)
    c.ellipsoid(cx - rx * 0.15, cy - ry * 0.2, rx * 0.6, ry * 0.6, 'e_leaf', amb=0.3, bump=0.55, bsc=2.0, bias=0.05)

def tree_street(seed=8):
    """가로수(2x3칸): 짙은 잎 덩이 수관(덩이마다 빛 왼쪽 위), 곧은 줄기, 밑동 쇠 격자 덮개."""
    c = C(32, 48, seed); c.group(1)
    for y in range(26, 44):
        for x in range(14, 18): c.tone(x, y, 'e_bark', 4 if x == 14 else 3 if x < 17 else 1)
    c.group(2); _tree_crown(c, 16, 15, 14, 13, seed)
    c.group(3); c.new()
    for y in range(42, 47):
        for x in range(8, 24):
            t = 3 if (x + y) % 3 else 1
            if y in (42, 46) or x in (8, 23): t = 4 if y == 42 else 2
            c.tone(x, y, 'e_iron', t)
    for y in range(43, 46):
        for x in range(14, 18): c.tone(x, y, 'e_bark', 2)
    return done(c)

def tree_planter(seed=9):
    """화분 가로수(2x3칸): 네모 돌 화분에 심은 동그란 작은 나무, 화분 테 밝은 돌."""
    c = C(32, 48, seed); c.group(1)
    for y in range(24, 38):
        for x in range(15, 17): c.tone(x, y, 'e_bark', 4 if x == 15 else 2)
    c.group(2); _tree_crown(c, 16, 14, 12, 12, seed + 3)
    c.group(3); c.box(7, 36, 18, 4, 7, 'e_trim')
    for x in range(8, 24): c.tone(x, 37, 'e_bark', 2); c.tone(x, 38, 'e_bark', 3)
    for x in range(7, 25): c.tone(x, 36, 'e_trim', 6); c.tone(x, 40, 'e_trim', 2)
    return done(c)

def tree_bare(seed=10):
    """겨울 가로수(2x3칸): 잎 진 가는 가지가 위로 퍼진 나무, 밑동 쇠 격자."""
    c = C(32, 48, seed); c.group(1)
    for y in range(22, 44):
        for x in range(15, 17): c.tone(x, y, 'e_bark', 4 if x == 15 else 2)
    import random; r = random.Random(seed)
    def br(x, y, a, L, w):
        if L < 2: return
        for i in range(int(L)):
            xx = x + math.cos(a) * i; yy = y + math.sin(a) * i
            if 0 <= int(xx) < 32 and 0 <= int(yy) < 48:
                c.tone(int(xx), int(yy), 'e_bark', 4 if w > 2 else 3)
                if w > 3: c.tone(int(xx) + 1, int(yy), 'e_bark', 2)
        nx = x + math.cos(a) * L; ny = y + math.sin(a) * L
        br(nx, ny, a - 0.38 - r.random() * 0.25, L * 0.74, w - 1); br(nx, ny, a + 0.38 + r.random() * 0.25, L * 0.74, w - 1)
        if w >= 3: br(nx, ny, a + (r.random() - 0.5) * 0.3, L * 0.6, w - 2)
    br(15.5, 34, -math.pi / 2, 10, 5)
    for y in range(42, 47):
        for x in range(8, 24):
            t = 3 if (x + y) % 3 else 1
            if y in (42, 46) or x in (8, 23): t = 4 if y == 42 else 2
            c.tone(x, y, 'e_iron', t)
    return done(c)

# ---------------------------------------------------------------- 카페 가구
def _table_round(c, cx, cy, rx=5.5):
    c.new()
    for y in range(int(cy - 3), int(cy + 3)):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / 2.6
            if dx * dx + dy * dy <= 1: c.tone(x, y, 'e_awg', 5 if dy < -0.2 else 4 if dy < 0.5 else 3)
    for x in range(int(cx - rx), int(cx + rx) + 1): c.tone(x, int(cy + 2.6), 'e_awg', 1)
    for y in range(int(cy + 3), int(cy + 9)): c.tone(int(cx), y, 'e_iron', 4); c.tone(int(cx) + 1, y, 'e_iron', 2)
    for x in range(int(cx) - 3, int(cx) + 5): c.tone(x, int(cy + 9), 'e_iron', 3)
def _chair(c, x0, y0, face='r'):
    c.new()
    for y in range(y0, y0 + 6): c.tone(x0 + (0 if face == 'r' else 4), y, 'e_awg', 4)   # 등받이
    for x in range(x0, x0 + 5): c.tone(x, y0 + 6, 'e_awg', 5); c.tone(x, y0 + 7, 'e_awg', 3)
    for y in range(y0 + 8, y0 + 12): c.tone(x0, y, 'e_iron', 3); c.tone(x0 + 4, y, 'e_iron', 2)
    for y in range(y0, y0 + 6, 2): c.tone(x0 + (1 if face == 'r' else 3), y, 'e_awg', 2)

def parasol_table(seed=11, A='e_awr', B='e_awc'):
    """파라솔 식탁(2x3칸): 둥근 병록 쇠 식탁, 양옆 쇠의자 둘, 위에 바랜 검붉은·크림 줄무늬 파라솔(우산살 끝 술), 가운데 대."""
    c = C(32, 48, seed); c.group(1)
    for y in range(12, 36): c.tone(16, y, 'e_iron', 4); c.tone(17, y, 'e_iron', 2)
    c.group(2); _table_round(c, 16.5, 34, 7); _chair(c, 2, 31, 'r'); _chair(c, 25, 31, 'l')
    c.tone(13, 32, 'e_trim', 6); c.tone(14, 32, 'e_trim', 4); c.tone(19, 33, 'e_glass', 5)
    c.group(3); c.new()
    cx, cy = 16.5, 9
    for y in range(0, 16):
        for x in range(0, 32):
            dx = x + 0.5 - cx; dy = (y + 0.5 - cy) * 1.9
            r = math.hypot(dx, dy)
            if r > 15.5 or y > 14: continue
            if y > cy + 3 and r > 14: continue
            ang = math.atan2(dy, dx); seg = int((ang + math.pi) / (math.pi / 4)) % 2
            mat = A if seg == 0 else B
            t = 5 if (dx < 0 and dy < 0) else 4 if dy < 2 else 3
            if r > 13.8: t = 2
            c.tone(x, y, mat, t)
    for x in range(1, 32, 4): c.tone(x, 13, A, 2); c.tone(x, 14, A, 1)
    c.tone(16, 1, 'e_iron', 5); c.tone(17, 1, 'e_iron', 3); c.tone(16, 0, 'e_iron', 4)
    return done(c)

def parasol_table_g(seed=12): return parasol_table(seed, 'e_awg', 'e_awc')

def cafe_table(seed=13):
    """작은 카페 식탁(2x2칸): 둥근 병록 쇠 식탁과 의자 둘(파라솔 없음), 식탁 위 찻잔."""
    c = C(32, 32, seed); c.group(1)
    _table_round(c, 16.5, 18, 6.5); _chair(c, 3, 15, 'r'); _chair(c, 24, 15, 'l')
    c.tone(14, 16, 'e_trim', 6); c.tone(15, 16, 'e_trim', 4); c.tone(18, 17, 'e_trim', 5)
    return done(c)

def cafe_chair(seed=14):
    """쇠의자 한 개(1칸): 병록 등받이 의자."""
    c = C(16, 16, seed); c.group(1); _chair(c, 5, 2, 'r'); return done(c)

def chalkboard(seed=15):
    """세움 칠판(1칸): 나무 A자 틀, 검은 판에 분필 찻잔 그림과 물결 줄(글자 아님)."""
    c = C(16, 16, seed); c.group(1); c.new()
    for y in range(1, 15):
        for x in range(3, 13):
            t = 1
            if x in (3, 12) or y in (1, 11): t = 4 if (x == 3 or y == 1) else 2
            c.tone(x, y, 'e_wood' if t != 1 else 'e_iron', t)
    for y in range(11, 16): c.tone(3, y, 'e_wood', 3); c.tone(12, y, 'e_wood', 2)
    for (x, y) in ((6, 3), (7, 3), (8, 3), (6, 4), (8, 4), (9, 4), (6, 5), (7, 5), (8, 5)): c.tone(x, y, 'e_snow', 5)
    for x in range(5, 11): c.tone(x, 7 + (x % 2), 'e_snow', 4); c.tone(x, 9 + ((x + 1) % 2), 'e_snow', 3)
    return done(c)

def bench_iron(seed=16):
    """쇠 다리 나무 벤치(2칸): 널 셋 등받이, 앉는 판, 검은 쇠 팔걸이·다리."""
    c = C(32, 16, seed); c.group(1); c.new()
    for y in range(1, 7):
        for x in range(3, 29): c.tone(x, y, 'e_wood', 4 if y % 2 else 2)
    for x in range(3, 29): c.tone(x, 8, 'e_wood', 5); c.tone(x, 9, 'e_wood', 4); c.tone(x, 10, 'e_wood', 2)
    for x0 in (2, 28):
        for y in range(1, 15): c.tone(x0, y, 'e_iron', 4 if x0 == 2 else 2)
        c.tone(x0 + (1 if x0 == 2 else -1), 7, 'e_iron', 3)
    for x0 in (5, 26):
        for y in range(11, 15): c.tone(x0, y, 'e_iron', 3)
    return done(c)

def flower_planter(seed=17):
    """돌 화단 상자(2칸): 긴 돌 화분에 제라늄·잎."""
    c = C(32, 16, seed); c.group(1)
    c.box(1, 7, 30, 3, 6, 'e_trim')
    for x in range(1, 31): c.tone(x, 7, 'e_trim', 6)
    c.group(2)
    for k in range(9):
        cx = 3 + k * 3.3; c.ellipsoid(cx, 6, 2.6, 2.4, 'e_leaf', amb=0.3, bump=0.4)
    for k in range(7):
        x = 4 + k * 4 + (k % 2); y = 3 + (k % 3)
        c.tone(x, y, 'e_flower', 5); c.tone(x + 1, y, 'e_flower', 4); c.tone(x, y + 1, 'e_flower', 3); c.tone(x - 1, y, 'e_flower', 6)
    return done(c)

def bollard(seed=18):
    """쇠 말뚝(1칸): 검은 쇠 기둥, 둥근 머리, 테 하나."""
    c = C(16, 16, seed); c.group(1); c.cylinder(8, 4, 14, 2.8, 'e_iron', capry=1.4)
    for x in range(5, 12): c.tone(x, 7, 'e_iron', 5)
    return done(c)

def advert_column(seed=19):
    """광고 기둥(1x3칸): 굵은 원통에 바랜 색 종이(무늬 색 덩이만, 글자 없음), 위 아연 둥근 지붕과 꼭지."""
    c = C(16, 48, seed); c.group(1)
    c.cylinder(8, 12, 44, 6.2, 'e_awg', capry=2.4, cap=False)
    for (y0, y1, m) in ((15, 22, 'e_awc'), (24, 30, 'e_awr'), (32, 38, 'e_awc')):
        for y in range(y0, y1):
            for x in range(2, 14):
                if c.m[y][x] and H(x // 3, y // 2, seed) > 0.25: c.tone(x, y, m, 4 if x < 7 else 3 if x < 11 else 2)
    c.ellipsoid(8, 10, 7.4, 4, 'e_zinc', amb=0.3)
    for x in range(1, 16): c.tone(x, 12, 'e_zinc', 2)
    c.tone(8, 5, 'e_zinc', 6); c.tone(8, 4, 'e_zinc', 5); c.tone(8, 3, 'e_iron', 4)
    c.box(1, 42, 14, 2, 4, 'e_trim')
    return done(c)

def fountain(seed=20):
    """광장 분수(3x3칸): 둥근 돌 수반(테 밝은 돌·물 비침), 가운데 받침 기둥과 작은 윗 접시에서 떨어지는 물줄기."""
    c = C(48, 48, seed); c.group(1)
    cx, cy = 24, 32
    c.new()
    for y in range(18, 46):
        for x in range(0, 48):
            dx = (x + 0.5 - cx) / 22; dy = (y + 0.5 - cy) / 11
            r = dx * dx + dy * dy
            if r <= 1:
                if r > 0.74: c.tone(x, y, 'e_trim', 6 if dy < 0 else 4 if dy < 0.5 else 3)
                else:
                    t = 3 if (y + (x // 5)) % 4 else 5
                    c.tone(x, y, 'e_water', t if dy > -0.4 else 2)
    for y in range(32, 47):
        for x in range(2, 46):
            dx = (x + 0.5 - cx) / 22; r_top = 1 - dx * dx
            if r_top <= 0: continue
            yb = cy + 11 * math.sqrt(r_top)
            if yb <= y <= yb + 4 and c.m[y][x] is None: c.tone(x, y, 'e_trim', 3 if dx < 0 else 2)
    c.group(2); c.cylinder(24, 14, 32, 2.8, 'e_trim', capry=1.2)
    c.new()
    for y in range(10, 15):
        for x in range(14, 35):
            dx = (x + 0.5 - 24) / 10; dy = (y + 0.5 - 12) / 2.4
            if dx * dx + dy * dy <= 1: c.tone(x, y, 'e_trim', 6 if dy < 0 else 3)
    for y in range(4, 11): c.tone(24, y, 'e_trim', 5); c.tone(25, y, 'e_trim', 3)
    c.tone(24, 3, 'e_trim', 6)
    for x in (15, 33):
        for y in range(14, 30): c.tone(x + (1 if x < 24 else -1) * ((y - 14) // 6), y, 'e_water', 6 if y % 3 else 5)
    return done(c)

def carriage(seed=21):
    """검은 마차(3x2칸, 말 없음): 상자형 차체(옆 창 하나·문 테), 앞뒤 큰 바퀴, 마부석과 끌채."""
    c = C(48, 32, seed); c.group(1); c.new()
    for y in range(3, 20):
        for x in range(10, 38):
            t = 3
            if y < 6: t = 5 if y == 3 else 4
            if x in (10, 37): t = 2
            c.tone(x, y, 'e_iron', t)
    for y in range(7, 13):
        for x in range(14, 22): c.tone(x, y, 'e_glass', 2 if y > 8 else 4)
    for y in range(7, 19): c.tone(26, y, 'e_iron', 5); c.tone(33, y, 'e_iron', 1)
    for x in range(26, 34): c.tone(x, 7, 'e_iron', 5); c.tone(x, 18, 'e_iron', 1)
    c.tone(31, 13, 'e_amber', 5)
    for x in range(9, 39): c.tone(x, 2, 'e_iron', 2); c.tone(x, 20, 'e_iron', 1)
    for x in range(2, 10): c.tone(x, 14, 'e_iron', 4); c.tone(x, 15, 'e_iron', 2)
    for x in range(0, 6): c.tone(x, 19 + x // 3, 'e_wood', 4)
    for y in range(8, 15): c.tone(5, y, 'e_iron', 3)
    c.tone(4, 8, 'e_amber', 5); c.tone(5, 7, 'e_amber', 4)
    for (wx, R) in ((15, 7.5), (34, 8.5)):
        cy = 31 - R
        for y in range(int(cy - R) - 1, 32):
            for x in range(int(wx - R) - 1, int(wx + R) + 2):
                d = math.hypot(x + 0.5 - wx, y + 0.5 - cy)
                if R - 1.6 < d <= R: c.tone(x, y, 'e_wood', 4 if x < wx else 2)
                elif d < 1.6: c.tone(x, y, 'e_iron', 5)
                elif d <= R - 1.6 and (int(math.degrees(math.atan2(y + 0.5 - cy, x + 0.5 - wx)) + 360) % 45) < 9: c.tone(x, y, 'e_wood', 3)
    return done(c)

def handcart(seed=22):
    """손수레(2칸): 판자 짐칸에 자루 둘, 바퀴 하나, 손잡이."""
    c = C(32, 16, seed); c.group(1)
    c.box(3, 4, 20, 3, 5, 'e_wood')
    c.ellipsoid(9, 4, 4, 3, 'e_awc', amb=0.3); c.ellipsoid(16, 3, 4, 3, 'e_awc', amb=0.3, bias=-0.05)
    for x in range(22, 31): c.tone(x, 8 - (x - 22) // 3, 'e_wood', 4); c.tone(x, 9 - (x - 22) // 3, 'e_wood', 2)
    cx, cy, R = 12, 11, 4.5
    for y in range(6, 16):
        for x in range(6, 19):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if R - 1.3 < d <= R: c.tone(x, y, 'e_wood', 4 if x < cx else 2)
            elif d < 1.2: c.tone(x, y, 'e_iron', 4)
    for y in range(9, 15): c.tone(4, y, 'e_wood', 3)
    return done(c)

def flower_cart(seed=23):
    """꽃 수레(2x2칸): 나무 수레 위 꽃 양동이 넷(붉은·누른·흰 꽃), 바퀴 둘."""
    c = C(32, 32, seed); c.group(1)
    c.box(2, 16, 28, 4, 6, 'e_wood')
    for x in range(2, 30): c.tone(x, 16, 'e_wood', 5)
    c.group(2)
    for k, (cx, m) in enumerate(((7, 'e_flower'), (13, 'e_leafy'), (19, 'e_snow'), (25, 'e_flower'))):
        c.cylinder(cx, 12, 17, 2.8, 'e_zinc', capry=1.2)
        for j in range(5):
            c.ellipsoid(cx - 2 + (j * 7 % 5), 8 + (j * 3 % 4), 1.8, 1.6, 'e_leaf' if j % 2 else m, amb=0.35)
    for (wx) in (8, 24):
        cy, R = 26, 5.2
        for y in range(19, 32):
            for x in range(wx - 6, wx + 7):
                d = math.hypot(x + 0.5 - wx, y + 0.5 - cy)
                if R - 1.4 < d <= R: c.tone(x, y, 'e_wood', 4 if x < wx else 2)
                elif d < 1.3: c.tone(x, y, 'e_iron', 4)
    return done(c)

def market_stall(seed=24):
    """시장 좌판(3x2칸): 줄무늬 천막 지붕(앞으로 늘어진 술), 나무 진열대에 사과·배추·빵 바구니."""
    c = C(48, 32, seed); c.group(1)
    for x0 in (2, 44):
        for y in range(6, 30): c.tone(x0, y, 'e_wood', 4); c.tone(x0 + 1, y, 'e_wood', 2)
    c.box(3, 17, 42, 5, 8, 'e_wood')
    for x in range(3, 45): c.tone(x, 22, 'e_wood', 2)
    c.group(2)
    for (cx, m) in ((9, 'e_flower'), (16, 'e_leaf'), (23, 'e_leafy'), (30, 'e_flower'), (37, 'e_leaff')):
        for j in range(5): c.ellipsoid(cx - 3 + j * 1.5, 17 + (j % 2), 1.7, 1.5, m, amb=0.3)
        for x in range(cx - 4, cx + 4): c.tone(x, 19, 'e_wood', 3)
    c.group(3); c.new()
    for y in range(0, 10):
        for x in range(0, 48):
            st = (x // 4) % 2
            m = 'e_awg' if st == 0 else 'e_awc'
            t = 5 - y // 3
            if y >= 8 and x % 4 == 3: continue
            c.tone(x, y, m, max(2, t))
    return done(c)

def street_clock(seed=25):
    """거리 시계탑 기둥(1x3칸): 검은 쇠 기둥 위 둥근 시계(흰 판, 바늘 둘, 숫자 없음)."""
    c = C(16, 48, seed); c.group(1)
    c.box(4, 42, 8, 2, 4, 'e_iron')
    for y in range(14, 43): c.tone(7, y, 'e_iron', 4); c.tone(8, y, 'e_iron', 2)
    c.new()
    for y in range(1, 14):
        for x in range(1, 15):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 7.5)
            if d <= 6.5: c.tone(x, y, 'e_iron', 4 if x < 8 else 2) if d > 5 else c.tone(x, y, 'e_trim', 6 if d < 4 else 5)
    for y in range(4, 8): c.tone(8, y, 'e_iron', 1)
    for x in range(8, 11): c.tone(x, 8, 'e_iron', 1)
    c.tone(8, 0, 'e_iron', 5)
    return done(c)

def water_pump(seed=26):
    """쇠 손 펌프(1x2칸): 검은 쇠 몸통, 위로 휜 손잡이, 주둥이, 밑에 돌 받침과 물받이."""
    c = C(16, 32, seed); c.group(1)
    c.cylinder(7, 8, 24, 3, 'e_iron', capry=1.3)
    c.tone(7, 5, 'e_iron', 5); c.tone(7, 6, 'e_iron', 4)
    for i in range(6): c.tone(9 + i, 9 - i // 2, 'e_iron', 4); c.tone(9 + i, 10 - i // 2, 'e_iron', 2)
    for x in range(1, 5): c.tone(x, 14, 'e_iron', 4); c.tone(x, 15, 'e_iron', 2)
    c.box(1, 24, 13, 3, 4, 'e_trim')
    for x in range(2, 13): c.tone(x, 25, 'e_water', 4 if x % 3 else 6)
    c.tone(2, 17, 'e_water', 5); c.tone(2, 19, 'e_water', 4); c.tone(2, 21, 'e_water', 5)
    return done(c)

def horse_trough(seed=27):
    """돌 물통(2칸): 긴 돌 여물통에 고인 물(하늘 비침)."""
    c = C(32, 16, seed); c.group(1)
    c.box(1, 3, 30, 5, 7, 'e_trim')
    for y in range(4, 8):
        for x in range(3, 29): c.tone(x, y, 'e_water', 3 if (x + y * 3) % 7 else 5)
    for x in range(1, 31): c.tone(x, 3, 'e_trim', 6); c.tone(x, 8, 'e_trim', 4)
    return done(c)

def monument(seed=28):
    """기념 오벨리스크(2x4칸): 계단 받침 위 네모 대좌(앞면 빈 돌판), 뾰족한 돌기둥(왼쪽 밝음·오른쪽 그늘), 꼭대기 청동 공."""
    c = C(32, 64, seed); c.group(1)
    c.box(2, 52, 28, 4, 6, 'e_trim'); c.box(6, 44, 20, 3, 6, 'e_trim'); c.box(9, 34, 14, 3, 8, 'e_ash')
    for y in range(39, 44):
        for x in range(12, 20): c.tone(x, y, 'e_trim', 4 if y > 39 else 6)
    c.new()
    for y in range(6, 35):
        w = 3 + (y - 6) * 3 / 28
        for x in range(int(16 - w), int(16 + w) + 1):
            c.tone(x, y, 'e_trim', 5 if x < 15 else 4 if x < 17 else 2)
    c.ellipsoid(16, 4, 2.4, 2.4, 'e_leafy', amb=0.35)
    return done(c)

def sign_standing(seed=29):
    """세움 간판 기둥(1x2칸): 쇠 기둥에 매단 나무 판, 침대 그림(여관 표시, 글자 없음)."""
    c = C(16, 32, seed); c.group(1)
    for y in range(2, 30): c.tone(2, y, 'e_iron', 4); c.tone(3, y, 'e_iron', 2)
    for x in range(2, 15): c.tone(x, 3, 'e_iron', 4)
    c.box(1, 28, 5, 2, 3, 'e_iron')
    c.new()
    for y in range(6, 15):
        for x in range(4, 15): c.tone(x, y, 'e_wood', 4 if y == 6 else 2 if y == 14 else 3)
    for j, row in enumerate(FA.ICONS['bed']):
        for i, ch in enumerate(row):
            if ch in '#+': c.tone(6 + i, 8 + j, 'e_amber', 5 if ch == '#' else 3)
    for x in (6, 12): c.tone(x, 4, 'e_iron', 3); c.tone(x, 5, 'e_iron', 3)
    return done(c)

def snow_heap(seed=30):
    """치운 눈더미(2칸): 연석가에 밀어 둔 회백 눈 무더기, 아래는 더러운 회갈."""
    c = C(32, 16, seed); c.group(1)
    for k, (cx, cy, rx, ry) in enumerate(((9, 9, 8, 5), (19, 8, 9, 6), (26, 11, 5, 3.5))):
        c.ellipsoid(cx, cy, rx, ry, 'e_snow', amb=0.4, bump=0.3)
    for x in range(1, 31):
        for y in range(11, 16):
            if c.m[y][x]: c.tone(x, y, 'e_snow', 1 if y > 12 else 2)
    for x in range(1, 31):
        for y in range(2, 13):
            if c.m[y][x] and H(x, y, seed) > 0.9: c.tone(x, y, 'e_cob', 4)
    return done(c)

def stone_steps(seed=31):
    """문 앞 돌계단(2칸, 걷기): 세 단, 단마다 윗면 밝고 앞면 그늘."""
    c = C(32, 16, seed); c.group(1); c.new()
    for k in range(3):
        y0 = 2 + k * 4; x0 = 6 - k * 2; x1 = 26 + k * 2
        for x in range(x0, x1):
            c.tone(x, y0, 'e_trim', 6); c.tone(x, y0 + 1, 'e_trim', 5); c.tone(x, y0 + 2, 'e_trim', 3); c.tone(x, y0 + 3, 'e_trim', 2)
    return done(c)

# ---------------------------------------------------------------- 바닥 덧그림(걷기)
def _decal(W=16, Hh=16): return Image.new('RGBA', (W, Hh))
def drain_grate(seed=32):
    """길가 빗물 쇠살대(1칸): 네모 쇠 테, 가로살, 틈 속 검은 물."""
    im = _decal(); px = im.load()
    for y in range(4, 12):
        for x in range(3, 13):
            c = IRON[1] if (y % 2 == 0) else IRON[4]
            if x in (3, 12) or y in (4, 11): c = IRON[5] if (x == 3 or y == 4) else IRON[2]
            put(px, 16, 16, x, y, c)
    return im
def manhole(seed=33):
    """둥근 쇠 맨홀 뚜껑(1칸): 무늬 동심원 둘, 모서리 녹."""
    im = _decal(); px = im.load()
    for y in range(16):
        for x in range(16):
            d = math.hypot((x + 0.5 - 8), (y + 0.5 - 8) * 1.25)
            if d <= 6.5:
                c = IRON[4] if d > 5.6 else IRON[3] if (int(d * 1.5) % 2) else IRON[2]
                if d > 5.6 and x + y > 16: c = IRON[1]
                put(px, 16, 16, x, y, c)
    return im
def leaves_scatter(seed=34):
    """흩어진 낙엽(1칸): 갈색·누른 잎 열 장."""
    im = _decal(); px = im.load()
    for k in range(11):
        x = int(H(k, 1, seed) * 14) + 1; y = int(H(k, 2, seed) * 14) + 1; R = LEAFY if k % 2 else LEAFF
        put(px, 16, 16, x, y, R[4]); put(px, 16, 16, x + 1, y, R[3]); put(px, 16, 16, x, y + 1, R[2])
    return im
def puddle_small(seed=35):
    """작은 빗물 웅덩이(2x1칸): 둥근 물에 하늘 빛 줄 둘."""
    im = _decal(32, 16); px = im.load()
    for y in range(16):
        for x in range(32):
            d = ((x + 0.5 - 16) / 13) ** 2 + ((y + 0.5 - 8) / 5.5) ** 2 + (H(x // 3, y // 2, seed) - 0.5) * 0.18
            if d <= 1:
                c = PUD[2] if d < 0.75 else COB[1]
                if d < 0.6 and y in (6, 9) and 8 < x < 24 and (x + y) % 3: c = PUD[5]
                put(px, 32, 16, x, y, c)
    return im
def cellar_hatch(seed=36):
    """지하실 나무 덧문(2칸, 땅에 붙은 판문): 두 쪽 널문, 쇠 경첩·고리."""
    im = _decal(32, 16); px = im.load()
    for y in range(2, 15):
        for x in range(3, 29):
            c = WOOD[3] if (x - 3) % 4 else WOOD[1]
            if x in (15, 16): c = WOOD[1]
            if y in (2,): c = TRIM[5]
            if y == 14: c = WOOD[1]
            put(px, 32, 16, x, y, c)
    for (x, y) in ((6, 5), (6, 11), (25, 5), (25, 11)):
        for i in range(4): put(px, 32, 16, x + i - (0 if x < 16 else 3), y, IRON[4])
    put(px, 32, 16, 14, 8, IRON[5]); put(px, 32, 16, 17, 8, IRON[5])
    return im
def pigeons(seed=37):
    """땅을 쪼는 비둘기 둘(1칸)."""
    im = _decal(); px = im.load()
    for (bx, by, f) in ((3, 6, 0), (9, 10, 1)):
        body = [(1, 1), (2, 1), (3, 1), (4, 1), (1, 2), (2, 2), (3, 2), (4, 2), (2, 3), (3, 3)]
        for (x, y) in body: put(px, 16, 16, bx + x, by + y, ASH[5] if y == 1 else ASH[4])
        hx_ = bx + (0 if f == 0 else 5); put(px, 16, 16, hx_, by + 1 + f, ASH[3]); put(px, 16, 16, hx_, by + f, ASH[4])
        put(px, 16, 16, bx + 2, by + 4, AMBER[4]); put(px, 16, 16, bx + 3, by + 4, AMBER[3])
        put(px, 16, 16, bx + 5 - 5 * f, by + 2, ASH[2])
    return im
def papers(seed=38):
    """바람에 날린 종이 쪼가리(1칸, 글자 없음)."""
    im = _decal(); px = im.load()
    for k in range(3):
        x0 = int(H(k, 1, seed) * 11) + 1; y0 = int(H(k, 2, seed) * 11) + 1
        for y in range(3):
            for x in range(4): put(px, 16, 16, x0 + x, y0 + y, AWN_C[5] if y == 0 else AWN_C[4])
        put(px, 16, 16, x0 + 3, y0 + 2, AWN_C[2])
    return im
