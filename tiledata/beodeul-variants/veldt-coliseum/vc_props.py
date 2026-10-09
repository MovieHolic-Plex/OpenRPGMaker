# 투기장 소품(앞마당·경기장·대기실 공용) — 무기 걸이·갑옷 받침·방패 더미·허수아비·화로·깃대·노점·돌 의자·창 통·승리 기둥·숫돌.
# 손 도트(px2.C + pz.fin), 버들항 팔레트. 사람 얼굴·글자·문장 없음(단색 천·금 테만). 결정적.
import math
from vc_base import *
from px2 import _hash
FLAME = [hx(c) for c in PAL['flame']]

def _flame(im, cx, y0, rows=None, seed=0):
    px = im.load()
    rows = rows or ["...6...", "..565..", ".45654.", ".34543.", "2345432", ".23432."]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.': continue
            x = cx - len(r) // 2 + i; y = y0 + j
            if 0 <= x < im.width and 0 <= y < im.height: px[x, y] = FLAME[int(ch) - 1] + (255,)

def _sword(c, x, y0, L, hilt='gold'):
    for y in range(y0, y0 + L): c.tone(x, y, 'iron', 6 if y < y0 + 2 else 5); c.tone(x + 1, y, 'iron', 3)
    c.tone(x, y0 - 1, 'iron', 6)
    for dx in (-2, -1, 0, 1, 2, 3): c.tone(x + dx, y0 + L, hilt, 5 if dx < 1 else 3)
    for y in range(y0 + L + 1, y0 + L + 4): c.tone(x, y, 'wood', 4); c.tone(x + 1, y, 'wood', 2)
    c.tone(x, y0 + L + 4, hilt, 5); c.tone(x + 1, y0 + L + 4, hilt, 3)

def weapon_rack():
    """무기 걸이(32x32): 나무 틀 + 가로대 둘, 칼 둘·창 둘·도끼 하나. 밑줄 2칸 막힘."""
    c = C(32, 32, seed=801); c.shadow(16, 29.5, 14, 1.8, 80)
    c.group(1)
    for x0 in (2, 28):
        c.new()
        for y in range(8, 30): c.tone(x0, y, 'wood', 5); c.tone(x0 + 1, y, 'wood', 3)
        c.tone(x0, 7, 'wood', 6); c.tone(x0 + 1, 7, 'wood', 4)
    c.new()
    for x in range(1, 31): c.tone(x, 10, 'wood', 5); c.tone(x, 11, 'wood', 3)
    for x in range(2, 30): c.tone(x, 22, 'wood', 4); c.tone(x, 23, 'wood', 2)
    for x in range(2, 30): c.tone(x, 28, 'wood', 3)
    c.group(2)
    for (x, top) in ((7, 0), (23, 2)):                                     # 창(위로 솟는다)
        c.new()
        for y in range(top + 4, 29): c.tone(x, y, 'wood', 5); c.tone(x + 1, y, 'wood', 3)
        for (dx, dy, t) in ((0, 0, 6), (0, 1, 6), (1, 1, 4), (-1, 2, 5), (0, 2, 6), (1, 2, 4), (2, 2, 3), (0, 3, 5), (1, 3, 3)):
            c.tone(x + dx, top + dy, 'iron', t)
    c.new(); _sword(c, 12, 8, 13); c.new(); _sword(c, 17, 9, 12, 'gold')
    c.new()                                                                 # 도끼(오른쪽 기둥 곁)
    for y in range(13, 28): c.tone(26, y, 'wood', 4); c.tone(27, y, 'wood', 2)
    for (dx, dy) in ((-3, 0), (-3, 1), (-3, 2), (-2, -1), (-2, 0), (-2, 1), (-2, 2), (-2, 3), (-1, 0), (-1, 1), (-1, 2)):
        c.tone(26 + dx, 14 + dy, 'iron', 6 if dx == -3 else (5 if dx == -2 else 4))
    return F(c)

def armor_stand():
    """갑옷 받침(16x32): 십자 막대에 흉갑, 닫힌 투구(눈 틈만, 얼굴 없음)와 붉은 깃털. 밑동 1칸 막힘."""
    c = C(16, 32, seed=802); c.shadow(8, 29.6, 5.5, 1.4, 80)
    c.group(1); c.new()
    for y in range(12, 30): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    for x in range(4, 12): c.tone(x, 29, 'wood', 3); c.tone(x, 30, 'wood', 2)
    c.group(2); c.new(); c.ellipsoid(8, 17, 5.2, 5.6, 'iron', amb=0.25, bias=0.05)            # 흉갑
    for y in range(13, 22): c.tone(8, y, 'iron', 6 if y < 16 else 4)
    c.new(); c.ellipsoid(3, 13.5, 2.2, 1.8, 'iron', amb=0.3); c.new(); c.ellipsoid(13, 13.5, 2.2, 1.8, 'iron', amb=0.3)   # 어깨
    c.new()
    for x in range(4, 13): c.tone(x, 22, 'red', 3); c.tone(x, 23, 'red', 2)                  # 허리 띠
    c.group(3); c.new(); c.ellipsoid(8, 7.5, 3.6, 4.0, 'iron', amb=0.28, bias=0.08)           # 투구
    for x in range(6, 11): c.tone(x, 8, 'dark', 1)                                             # 눈 틈
    c.tone(8, 10, 'dark', 2); c.tone(8, 11, 'dark', 2)
    c.group(4); c.new()
    for k in range(6):                                                                         # 깃털 장식
        c.tone(8 + (k // 2), 3 - k // 2, 'red', 5 if k < 3 else 4); c.tone(9 + (k // 2), 3 - k // 2, 'red', 3)
    return F(c)

def shields_stack():
    """둥근 방패 더미(32x16): 나무 방패 셋이 기대어 있다(쇠 테·가운데 쇠 돌기, 반쪽 칠). 밑줄 막힘."""
    c = C(32, 16, seed=803); c.shadow(16, 13.6, 14, 1.6, 70)
    for (cx, cy, r, col) in ((8, 9, 6.4, 'red'), (24, 9, 6.4, 'shroom'), (16, 10, 5.8, 'wood')):
        c.new()
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05)
                if d > r: continue
                if d > r - 1.3: c.tone(x, y, 'iron', 5 if x < cx else 3); continue
                t = 5 if x < cx - 1 else (4 if x < cx + 2 else 3)
                c.tone(x, y, col if (x < cx) != (col == 'wood') else 'wood', t)
        c.tone(int(cx), int(cy), 'iron', 6); c.tone(int(cx) + 1, int(cy), 'iron', 3); c.tone(int(cx), int(cy) + 1, 'iron', 3)
    return F(c)

def training_dummy():
    """짚 허수아비 표적(16x32): 기둥 + 짚단 몸 + 팔 막대 + 자루 머리(얼굴 없음), 칼자국. 밑동 1칸 막힘."""
    c = C(16, 32, seed=804); c.shadow(8, 29.6, 4.6, 1.3, 70)
    c.group(1); c.new()
    for y in range(18, 30): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    c.group(2); c.new()
    for x in range(0, 16): c.tone(x, 12, 'wood', 5); c.tone(x, 13, 'wood', 3)
    c.group(3); c.new(); c.cylinder(8, 11, 21, 4.4, 'rope', cap=True, capry=1.8, amb=0.3)
    for y in (13, 18):
        for x in range(4, 13): c.tone(x, y, 'bark', 3) if c.m[y][x] else None
    c.line(6, 15, 10, 17, 'bark', 2)
    for (x, y) in ((3, 14), (13, 15), (4, 20), (12, 19)): c.tone(x, y, 'gold', 5)
    c.group(4); c.new(); c.ellipsoid(8, 6.5, 3.6, 3.8, 'cloth', amb=0.3, bias=-0.05)          # 자루 머리(얼굴 없음)
    for x in range(5, 12): c.tone(x, 9, 'rope', 3); c.tone(x, 10, 'rope', 2)
    c.line(6, 4, 10, 8, 'rope', 4)                                                                   # 묶은 끈
    c.tone(8, 2, 'rope', 4); c.tone(9, 1, 'rope', 5); c.tone(7, 1, 'rope', 5)
    return F(c)

def brazier():
    """세발 화로(16x32): 쇠 다리 셋 + 사발 + 타오르는 불. 밑동 1칸 막힘, 불·사발 칸은 걷기+가림."""
    c = C(16, 32, seed=805); c.shadow(8, 29.6, 6, 1.5, 90)
    c.group(1)
    for (x0, t) in ((2, 5), (13, 3), (8, 4)):
        c.new(); c.line(8, 16, x0, 30, 'iron', t); c.line(8 + (1 if x0 >= 8 else 0), 16, x0 + 1, 30, 'iron', 2)
    c.group(2); c.new()
    for y in range(11, 17):
        for x in range(1, 15):
            dx = (x + 0.5 - 8) / 7.0; dy = (y + 0.5 - 12.5) / 4.2
            if dx * dx + dy * dy <= 1 and y >= 12: c.tone(x, y, 'iron', 5 if dx < -0.3 else (4 if dx < 0.4 else 3))
    for x in range(2, 14): c.tone(x, 11, 'iron', 6 if x < 8 else 5); c.tone(x, 12, 'dark', 1) if 3 < x < 13 else None
    for x in range(2, 14):
        if (x + 1) % 3 == 0: c.tone(x, 14, 'gold', 4)
    im = F(c)
    _flame(im, 8, 3, ["...6...", "..565..", ".45654.", ".34543.", "2345432", "1234321", ".23332.", "..121.."])
    px = im.load()
    for (x, y) in ((5, 1), (11, 2), (9, 0)): px[x, y] = FLAME[5] + (255,)
    return im

def banner_tall():
    """키 큰 걸개 기둥(16x48): 나무 기둥 + 쇠 가로대 + 긴 단색 걸개(금 테). 밑동 1칸 막힘, 위는 걷기+가림."""
    o = Image.new('RGBA', (16, 48))
    c = C(16, 48, seed=806); c.shadow(8, 45.6, 4.5, 1.3, 80)
    c.group(1); c.new()
    for y in range(3, 46): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    c.tone(7, 2, 'gold', 6); c.tone(8, 2, 'gold', 4); c.tone(7, 1, 'gold', 5)
    for x in range(1, 15): c.tone(x, 5, 'iron', 5); c.tone(x, 6, 'iron', 3)
    o.alpha_composite(F(c))
    b = roman.banner_hanging('red', 30)
    o.alpha_composite(b, (2, 7))
    return o

def booth():
    """앞마당 노점(48x48): 나무 계산대 + 붉은·크림 줄무늬 차양(기둥 둘), 위에 단지·작은 상자. 계산대 줄 막힘, 차양은 걷기+가림."""
    c = C(48, 48, seed=807); c.shadow(24, 44.6, 21, 2.6, 90)
    c.group(1)
    for x0 in (3, 43):
        c.new()
        for y in range(12, 44): c.tone(x0, y, 'wood', 5); c.tone(x0 + 1, y, 'wood', 3)
    c.group(2); c.new(); c.box(4, 28, 40, 5, 11, 'wood', top=0.95, front=0.6)                   # 계산대
    for x in range(4, 44):
        if (x - 4) % 8 == 7:
            for y in range(33, 44): c.tone(x, y, 'wood', 2)
    c.group(3)
    for (x, col, r) in ((10, 'cloth', 3.2), (16, 'cloth', 2.6), (33, 'cream', 3.0)):           # 단지
        c.new(); c.ellipsoid(x, 26, r, r * 1.1, col, amb=0.3, bias=0.05); c.tone(x, 23, 'dark', 1)
    c.new(); c.box(22, 22, 8, 3, 4, 'wood', top=1.0, front=0.62)                               # 작은 상자(쇠 테)
    for y in range(22, 29): c.tone(26, y, 'gold', 4)
    c.group(4); c.new()
    for y in range(4, 15):                                                                      # 차양(앞으로 기운 천, 줄무늬)
        f = (y - 4) / 10.0
        for x in range(1, 47):
            band = ((x - 1) // 6) % 2
            t = (5 if y < 9 else 4) if band == 0 else (6 if y < 9 else 5)
            c.tone(x, y, 'red' if band == 0 else 'cream', t)
    for x in range(1, 47):
        dd = 15 + (1 if (x - 1) % 6 in (2, 3) else 0)
        c.tone(x, dd, 'red' if ((x - 1) // 6) % 2 == 0 else 'cream', 3); c.tone(x, 3, 'wood', 5)
    return F(c)

def bench_stone():
    """돌 의자(32x16): 판석 상판 + 다리 둘. 아랫줄 막힘."""
    c = C(32, 16, seed=808); c.shadow(16, 13.6, 14, 1.6, 70)
    for x0 in (4, 24):
        c.new(); c.box(x0, 8, 5, 1, 5, 'stone', top=0.9, front=0.5)
    c.new(); c.box(1, 3, 30, 5, 3, 'stone', top=0.98, front=0.62)
    for x in range(1, 31, 7): c.tone(x, 4, 'stone', 4)
    return F(c)

def spear_barrel():
    """창 꽂은 통(16x32): 나무 통 + 쇠 테 + 창 셋. 밑줄 막힘."""
    c = C(16, 32, seed=809); c.shadow(8, 29.5, 6.5, 1.5, 80)
    c.group(1)
    for (x, top) in ((5, 2), (8, 0), (11, 4)):
        c.new()
        for y in range(top + 4, 22): c.tone(x, y, 'wood', 5); c.tone(x + 1, y, 'wood', 3)
        for (dx, dy, t) in ((0, 0, 6), (0, 1, 6), (1, 1, 4), (-1, 2, 5), (0, 2, 6), (1, 2, 4), (0, 3, 5)): c.tone(x + dx, top + dy, 'iron', t)
    c.group(2); c.new(); c.cylinder(8, 19, 29, 6.2, 'wood', cap=True, capry=2.4, amb=0.25)
    for y in (22, 27):
        for x in range(1, 15):
            if c.m[y][x]: c.tone(x, y, 'iron', 4 if x < 8 else 3)
    for y in range(17, 22):
        for x in range(3, 14):
            if c.m[y][x] and (x - 8) ** 2 / 25 + (y - 19) ** 2 / 4 < 0.6: c.tone(x, y, 'dark', 1)
    return F(c)

def victor_column():
    """승리 기둥(16x48): 마름돌 받침 + 둥근 기둥 + 꼭대기에 투구와 엇갈린 칼(돌). 밑동 1칸 막힘, 위는 걷기+가림."""
    c = C(16, 48, seed=810); c.shadow(8, 45.6, 7, 1.7, 90)
    c.group(1); c.new(); c.box(1, 36, 14, 3, 8, 'stone', top=0.98, front=0.6)
    c.new(); c.cylinder(8, 13, 36, 4.6, 'stone', cap=True, capry=1.8, amb=0.25)
    for y in range(14, 36, 3): c.tone(6, y, 'stone', 4); c.tone(10, y, 'stone', 3)                 # 홈
    c.new(); c.box(2, 10, 12, 2, 2, 'stone', top=1.0, front=0.6)
    c.group(2)
    for (x0, x1) in ((3, 12), (12, 3)):                                                              # 엇갈린 칼
        c.new(); c.line(x0, 9, x1, 1, 'iron', 5); c.line(x0 + 1, 9, x1 + 1, 1, 'iron', 3)
    c.new(); c.ellipsoid(8, 5.5, 3.6, 3.4, 'gold', amb=0.3, bias=0.05)
    for x in range(6, 11): c.tone(x, 6, 'dark', 1)
    c.tone(8, 1, 'red', 5); c.tone(8, 2, 'red', 4); c.tone(9, 1, 'red', 3)
    return F(c)

def grindstone():
    """숫돌 바퀴(32x32): 나무 틀 + 돌 바퀴 + 손잡이 + 물통. 아랫줄 막힘."""
    c = C(32, 32, seed=811); c.shadow(16, 29.5, 13, 1.8, 80)
    c.group(1)
    for x0 in (6, 22):
        c.new()
        for y in range(14, 30): c.tone(x0, y, 'wood', 5); c.tone(x0 + 1, y, 'wood', 3)
    c.new()
    for x in range(4, 26): c.tone(x, 27, 'wood', 4); c.tone(x, 28, 'wood', 2)
    c.group(2); c.new()
    for y in range(5, 27):
        for x in range(6, 25):
            dx = (x + 0.5 - 15) / 8.6; dy = (y + 0.5 - 16) / 10.6
            r = dx * dx + dy * dy
            if r <= 1:
                t = 5 if (dx < -0.2 and dy < 0.3) else (4 if dx < 0.35 else 3)
                if r > 0.78: t = 3 if dx < 0 else 2                                                    # 바퀴 테
                if r < 0.05: t = 1                                                                     # 굴대
                elif r < 0.12: t = 5
                if _hash(x, y, 813) > 0.9: t = max(2, t - 1)
                c.tone(x, y, 'stone', t)
    c.group(3); c.new()
    for x in range(15, 29): c.tone(x, 16, 'iron', 4)
    for y in range(12, 17): c.tone(29, y, 'wood', 5); c.tone(30, y, 'wood', 3)
    c.group(4); c.new(); c.cylinder(26, 22, 28, 3.4, 'wood', cap=True, capry=1.4, amb=0.25)
    c.tone(26, 22, 'teal', 5); c.tone(25, 22, 'teal', 4)
    return F(c)

def chariot_broken():
    """부서진 전차(48x32): 앞이 둥근 나무 상자 + 큰 바퀴 하나(살 여덟), 떨어진 바퀴 하나, 부러진 끌채. 아랫줄 막힘."""
    c = Cv(48, 32)
    for y in range(8, 22):
        for x in range(8, 30):
            d = ((x + 0.5 - 19) / 11.0) ** 2 + ((y - 8) / 16.0) ** 2
            if y > 8 and d > 1: continue
            t = 5 if y < 10 else (4 if x < 16 else 3)
            if y >= 14 and (x - 8) % 5 == 0: t = 2
            c.set(x, y, 'wood', t)
    for x in range(9, 29): c.set(x, 8, 'gold', 5); c.set(x, 9, 'gold', 3)
    for y in range(9, 22): c.set(8, y, 'gold', 4)
    cx, cy, r = 19.5, 22.5, 8.2
    for y in range(13, 32):
        for x in range(10, 30):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r - 1.8 < d <= r: c.set(x, y, 'wood', 5 if x + 0.5 < cx else 3)
            elif d <= 1.8: c.set(x, y, 'iron', 4)
            else:
                ang = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
                if d < r - 1.8 and min(abs(((ang * 8 / math.pi) % 2) - 1), 1) > 0.82: c.set(x, y, 'wood', 4)
    for k in range(0, 14): c.set(30 + k, 18 - k // 3, 'wood', 5); c.set(30 + k, 19 - k // 3, 'wood', 3)
    for y in range(24, 31):
        for x in range(33, 47):
            dx = (x + 0.5 - 40) / 6.6; dy = (y + 0.5 - 27.5) / 3.2; rr = dx * dx + dy * dy
            if 0.45 < rr <= 1.0: c.set(x, y, 'wood', 5 if dy < 0 else 3)
            elif rr <= 0.1: c.set(x, y, 'iron', 4)
    im = c.img()
    sh = Image.new('RGBA', (48, 32)); p = sh.load()
    for y in range(26, 32):
        for x in range(4, 46):
            if ((x - 24) / 21.0) ** 2 + ((y - 29.5) / 2.6) ** 2 < 1: p[x, y] = (30, 26, 8, 70)
    sh.alpha_composite(im); return sh

def sand_marks():
    """경기장 모래의 쓸린 자국·발자국(16x16 땅 장식)."""
    o = Image.new('RGBA', (16, 16)); px = o.load()
    S = [hx(x) for x in PAL['sandA']]
    for x in range(1, 15):
        y = 5 + int(round(math.sin(x / 2.5) * 1.2))
        px[x, y] = S[2] + (200,); px[x, y + 1] = S[5] + (200,)
    for (x, y) in ((3, 11), (8, 12), (12, 10)):
        px[x, y] = S[2] + (210,); px[x + 1, y] = S[2] + (210,); px[x, y + 1] = S[3] + (200,)
    return o

def dropped_shield():
    """모래에 떨어진 방패와 부러진 창(32x16 땅 장식)."""
    c = C(32, 16, seed=812); c.shadow(12, 12, 9, 2.0, 60)
    c.new()
    for y in range(4, 15):
        for x in range(3, 22):
            d = ((x + 0.5 - 12) / 8.6) ** 2 + ((y + 0.5 - 9.5) / 4.8) ** 2
            if d > 1: continue
            t = 3 if d > 0.72 else (5 if x < 11 else 4)
            c.tone(x, y, 'iron' if d > 0.72 else 'red', t)
    c.tone(12, 9, 'iron', 6); c.tone(13, 9, 'iron', 3)
    c.new(); c.line(18, 13, 31, 7, 'wood', 5); c.line(18, 14, 31, 8, 'wood', 3)
    c.tone(31, 6, 'iron', 5); c.tone(30, 6, 'iron', 6)
    return F(c)
