# 폐허 마을 소품 — px2.C(칩셋 7단 램프 + 결) 와 버들항 돌·나무 색으로 손 도트. 3/4 시점(윗면+앞면), 빛 왼쪽 위. 결정적.
from rv_base import *
import plains_pieces as PP           # 초원 하이로드의 가지 그리기(limb)를 같은 결로 다시 쓴다(그림은 새로 그린다)
from plains_pieces import limb

def F(c): return pz.fin(c)

def _ground_shadow(im, cx, cy, rx, ry, a=70):
    o = Image.new('RGBA', im.size); p = o.load()
    for y in range(im.height):
        for x in range(im.width):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1: p[x, y] = SHADOW + (a,)
    o.alpha_composite(im); return o

# ================================================================ 마른 우물
def well_dry():
    """마른 우물(2x3칸): 둥근 돌 우물통(물 없이 어둠 + 거미줄), 왼쪽 기둥만 서 있고 오른쪽 기둥은 부러져 가로대가 비스듬히 떨어졌다. 끊긴 두레박줄."""
    c = C(32, 48, seed=601); c.shadow(16, 44, 15, 3, 90)
    c.group(1); c.new(); c.cylinder(16, 30, 42, 13.5, 'stone', cap=True, capry=5.2, amb=0.28)
    for y in range(28, 44):                                       # 돌 줄눈(가로 단 + 엇갈린 세로)
        for x in range(2, 30):
            if c.m[y][x] == 'stone' and y > 30:
                if (y - 31) % 4 == 3: c.darken(x, y, 1)
                elif (x + ((y - 31) // 4) * 3) % 7 == 0: c.darken(x, y, 1)
    c.group(2); c.new()                                           # 우물 속: 어둠
    for y in range(27, 34):
        for x in range(5, 28):
            if ((x + 0.5 - 16) / 10.5) ** 2 + ((y + 0.5 - 30.2) / 3.4) ** 2 < 1: c.tone(x, y, 'dark', 1 if y < 31 else 2)
    c.group(3); c.new()
    for y in range(8, 32): c.tone(4, y, 'wood', 5); c.tone(5, y, 'wood', 3)              # 남은 왼 기둥
    c.tone(4, 7, 'wood', 6); c.tone(5, 7, 'wood', 4)
    c.group(4); c.new()
    for y in range(22, 32): c.tone(27, y, 'wood', 5); c.tone(28, y, 'wood', 3)           # 부러진 오른 기둥(그루터기)
    c.tone(27, 21, 'wood', 6); c.tone(28, 20, 'wood', 6); c.tone(28, 21, 'wood', 4)
    c.group(5); c.new()
    for k in range(26):                                           # 떨어진 가로대: 왼 기둥 꼭대기에서 오른쪽 아래로
        x = 5 + k; y = 9 + int(k * 0.62)
        c.tone(x, y, 'wood', 5); c.tone(x, y + 1, 'wood', 3)
    c.group(6); c.new()
    for y in range(10, 25): c.tone(12 + (y - 10) // 7, y, 'rope', 4)                     # 끊긴 두레박줄
    im = F(c); p = im.load()
    cobweb(p, 32, 48, 6, 28, 4, 3, 'tl'); cobweb(p, 32, 48, 26, 28, 3, 4, 'tr')
    tufts(p, 32, 48, 0, 32, 47, 7, 0.5, 4, 0.6)
    return im

def bucket_tipped():
    """쓰러진 두레박(1칸): 쇠테 두른 나무 통이 옆으로 누웠다."""
    c = C(16, 16, seed=602); c.shadow(8, 13.4, 7, 1.6, 70)
    c.new(); c.hcyl(2, 12, 9, 4.0, 'wood', amb=0.25, endcap='R', capmat='dark')
    for x in (4, 10):
        for y in range(5, 14): c.tone(x, y, 'iron', 3) if c.m[y][x] else None
    c.new(); c.tone(13, 9, 'dark', 1); c.tone(13, 10, 'dark', 2)
    return F(c)

# ================================================================ 수레·시장
def cart_overturned():
    """뒤집힌 수레(3x2칸): 짐칸이 엎어져 밑판(가로 널 + 굴대 받침 둘)이 위를 보고, 떨어진 바퀴 하나가 기대 섰다. 쏟아진 건초."""
    cv = wl.Cv(48, 32)
    for y in range(8, 16):                                        # 엎어진 짐칸 밑판(윗면)
        for x in range(6, 40):
            t = 5 if (y - 8) % 3 != 2 else 3
            if H(x, y, 3) > 0.9: t -= 1
            cv.set(x, y, 'wood', t)
    for bx in (13, 31):                                           # 굴대 받침
        for y in range(7, 16): cv.set(bx, y, 'wood', 3); cv.set(bx + 1, y, 'wood', 2)
        cv.set(bx, 6, 'wood', 4)
    for y in range(16, 25):                                       # 짐칸 옆판(앞면)
        for x in range(6, 40):
            t = 4 if y < 18 else 3
            if (x - 6) % 7 == 6: t = 2
            cv.set(x, y, 'wood', t)
    for x in range(6, 40): cv.set(x, 25, 'wood', 1)
    for y in range(18, 25):                                       # 깨진 옆판 구멍
        for x in range(20, 25): cv.m[y][x] = ('dark', 1 if y > 19 else 2)
    cx, cy, r = 41.5, 20.5, 6.6                                   # 기대 선 바퀴(살 넷 중 하나 부러짐)
    for y in range(12, 30):
        for x in range(34, 48):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r - 1.9 < d <= r: cv.set(x, y, 'bark', 5 if (x + 0.5 < cx and y + 0.5 < cy) else (3 if x + 0.5 > cx else 4))
            elif d <= 1.6: cv.set(x, y, 'iron', 4)
    for (dx, dy) in ((0, -1), (1, 0), (0, 1)):
        for k in range(2, 5): cv.set(int(cx - 0.5 + dx * k), int(cy - 0.5 + dy * k), 'bark', 4)
    for x in range(0, 14):                                        # 쏟아진 건초
        for y in range(25, 31):
            if ((x - 6) / 7.0) ** 2 + ((y - 28) / 2.6) ** 2 < 1 and H(x, y, 4) > 0.2: cv.set(x, y, 'rope', 5 if H(x, y, 5) > 0.5 else 4)
    im = cv.img()
    return _ground_shadow(im, 24, 28, 22, 3, 70)

def _stripe(x, seed=0): return 'red' if (x // 4 + seed) % 2 == 0 else 'cream'

def stall_tattered():
    """찢어진 노점(3x3칸): 기둥 넷 위 줄무늬 차양이 찢겨 구멍이 나고 자락이 늘어졌다. 텅 빈 판대 위에 깨진 항아리 하나."""
    cv = wl.Cv(48, 48)
    for (x0, y0, y1) in ((4, 10, 44), (42, 10, 44)):             # 앞 기둥
        for y in range(y0, y1): cv.set(x0, y, 'wood', 5); cv.set(x0 + 1, y, 'wood', 3)
    for (x0, y0, y1) in ((6, 6, 30), (40, 6, 30)):               # 뒤 기둥(짧게 보임)
        for y in range(y0, y1): cv.set(x0, y, 'wood', 4); cv.set(x0 + 1, y, 'wood', 2)
    for y in range(4, 16):                                        # 차양 윗면(경사): 줄무늬, 찢긴 구멍 둘
        for x in range(3, 45):
            hole = ((x - 16) / 5.0) ** 2 + ((y - 9) / 3.0) ** 2 < 1 or ((x - 33) / 3.5) ** 2 + ((y - 12) / 2.4) ** 2 < 1
            if hole: continue
            mat = _stripe(x)
            t = 5 if y < 8 else (4 if y < 12 else 3)
            if mat == 'cream': t = min(6, t + 1) - 1
            if H(x, y, 11) > 0.92: t -= 1
            cv.set(x, y, mat, t)
    for x in range(3, 45):                                        # 앞 자락: 들쭉날쭉 늘어진 헝겊
        ln = 2 + int(H(x // 2, 12) * 4) + (5 if 8 <= x <= 11 or 36 <= x <= 38 else 0)
        for y in range(16, 16 + ln):
            cv.set(x, y, _stripe(x), 3 if y < 18 else 2)
    for y in range(28, 34):                                       # 판대 윗면 + 앞면
        for x in range(6, 42): cv.set(x, y, 'wood', 5 if y < 30 else (4 if y < 32 else 3))
    for y in range(34, 44):
        for x in range(6, 42):
            t = 3 if (x - 6) % 6 else 1
            cv.set(x, y, 'wood', t)
    for y in range(36, 44):                                       # 판대 앞판 빠진 널
        for x in range(25, 30): cv.m[y][x] = ('dark', 1)
    for (x, y, t) in ((16, 25, 4), (17, 25, 5), (15, 26, 4), (16, 26, 3), (17, 26, 3), (18, 26, 2), (15, 27, 3), (16, 27, 3), (17, 27, 2), (19, 27, 3), (20, 27, 2)):
        cv.set(x, y, 'clay', t)                                   # 깨진 항아리
    im = cv.img()
    return _ground_shadow(im, 24, 44, 21, 3, 70)

def stall_collapsed():
    """무너진 노점(3x2칸): 기둥이 꺾여 차양 천이 판대 위로 주저앉았다. 천 밑으로 굴러 나온 바구니와 사과."""
    cv = wl.Cv(48, 32)
    for y in range(14, 24):                                       # 판대(기울었다)
        for x in range(4, 40):
            yy = y + (x - 4) // 12
            cv.set(x, yy, 'wood', 5 if y < 16 else (3 if (x - 4) % 6 else 1))
    for x in range(2, 44):                                        # 주저앉은 차양 천: 판대를 덮고 처진 주름
        top = 8 + int(3 * math.sin(x / 6.0)) + (x // 14)
        bot = 18 + int(2 * math.sin(x / 4.0 + 1)) + (x // 10)
        for y in range(top, bot):
            mat = _stripe(x, 1)
            f = (y - top) / max(1, bot - top)
            t = 5 if f < 0.3 else (4 if f < 0.7 else 2)
            if mat == 'cream': t = max(2, t)
            cv.set(x, y, mat, t)
    for k in range(18):                                           # 꺾인 기둥
        cv.set(40 + k // 3, 4 + k, 'wood', 5); cv.set(41 + k // 3, 4 + k, 'wood', 3)
    for (bx, by) in ((6, 25), (30, 26)):                          # 바구니
        for y in range(by, by + 5):
            for x in range(bx, bx + 7):
                cv.set(x, y, 'rope', 5 if y == by else (4 if (x + y) % 2 else 3))
    for (x, y) in ((15, 27), (20, 28), (24, 26), (37, 28)):        # 굴러 나온 사과
        cv.set(x, y, 'red', 4); cv.set(x + 1, y, 'red', 3); cv.set(x, y - 1, 'red', 5)
    im = cv.img()
    return _ground_shadow(im, 22, 29, 21, 3, 70)

def crate_broken():
    """부서진 나무 상자(1칸): 윗판이 빠지고 앞판이 쪼개져 널이 벌어졌다."""
    c = C(16, 16, seed=611); c.shadow(8, 14, 7, 1.6, 70)
    c.new(); c.box(2, 3, 12, 4, 8, 'wood', top=0.85, front=0.55)
    for y in range(4, 7):
        for x in range(4, 12): c.tone(x, y, 'dark', 2)            # 속이 보인다(윗판 없음)
    for y in range(7, 15):
        c.tone(6, y, 'wood', 2); c.tone(10, y, 'wood', 2)
    for (x, y) in ((8, 8), (8, 9), (9, 10), (9, 11)): c.tone(x, y, 'dark', 1)    # 쪼개진 금
    c.new()
    for k in range(9): c.tone(12 + k // 4, 6 + k, 'wood', 5)                     # 벌어진 널 한 장
    return F(c)

def barrel_tipped():
    """누운 술통(2x1칸): 쇠테 두 줄, 통널 하나가 빠져 속이 보인다."""
    c = C(32, 16, seed=612); c.shadow(16, 13.6, 14, 1.8, 70)
    c.new(); c.hcyl(4, 25, 8, 5.4, 'wood', amb=0.25, endcap='R', capmat='wood')
    for x in (9, 20):
        for y in range(3, 14): c.tone(x, y, 'iron', 3) if c.m[y][x] else None
    for x in range(12, 18): c.tone(x, 6, 'dark', 1); c.tone(x, 7, 'dark', 2)
    c.new()
    for x in range(26, 31): c.tone(x, 13, 'wood', 4)             # 빠진 통널
    return F(c)

def barrel_broken():
    """깨진 선 술통(1x2칸): 위 통널 몇 장이 부러져 들쭉날쭉, 속은 어둡다."""
    c = C(16, 24, seed=613); c.shadow(8, 21.5, 7, 1.6, 70)
    c.new(); c.cylinder(8, 8, 20, 6.2, 'wood', cap=False, amb=0.25)
    for y in range(6, 12):
        for x in range(1, 15):
            cut = 7 + int(H(x // 2, 9) * 5)
            if y < cut and c.m[y][x]: c.m[y][x] = None
    for x in range(3, 13): c.tone(x, 9 + int(H(x // 2, 9) * 2), 'dark', 1)
    for y in (13, 18):
        for x in range(1, 15): c.tone(x, y, 'iron', 3) if c.m[y][x] else None
    return F(c)

def sack_torn():
    """찢어진 곡식 자루(1칸): 옆이 터져 낟알이 땅에 쏟아졌다."""
    c = C(16, 16, seed=614); c.shadow(7, 13.4, 6, 1.6, 70)
    c.new(); c.ellipsoid(7, 9, 5.2, 4.6, 'cream', amb=0.25, bump=0.3)
    c.new(); c.ellipsoid(6, 4.6, 2.4, 1.6, 'cream', amb=0.3)
    for (x, y) in ((9, 9), (10, 10), (10, 11)): c.tone(x, y, 'dark', 2)
    c.new()
    for (x, y) in ((11, 12), (12, 13), (13, 12), (12, 14), (14, 14), (11, 14), (13, 13)): c.tone(x, y, 'gold', 4 if (x + y) % 2 else 5)
    return F(c)

def bench_broken():
    """부러진 나무 의자(2x1칸): 다리 하나가 꺾여 앉는 판이 땅에 비스듬히 닿았다."""
    c = C(32, 16, seed=615); c.shadow(16, 13.6, 13, 1.5, 70)
    c.new()
    for x in range(3, 29):
        y = 5 + int((x - 3) * 0.2)
        c.tone(x, y, 'wood', 6); c.tone(x, y + 1, 'wood', 5); c.tone(x, y + 2, 'wood', 3)
    c.new()
    for y in range(8, 14): c.tone(5, y, 'wood', 4); c.tone(6, y, 'wood', 2)
    for (x, y) in ((24, 13), (26, 14), (28, 14)): c.tone(x, y, 'wood', 4)
    return F(c)

# ================================================================ 죽은 나무·마른 풀
def dead_tree_large():
    """잎 없는 큰 고목(3x4칸): 굵게 뒤틀린 줄기와 옹이 구멍, 위로 갈라진 앙상한 가지. 밑동에 마른 풀."""
    c = C(48, 64, seed=621); c.shadow(24, 61, 15, 3, 90)
    c.group(1)
    limb(c, [(24, 63), (23, 52), (25, 40), (24, 30)], [5.4, 4.2, 3.4, 2.8], 'bark', 3)
    limb(c, [(19, 62), (14, 63)], [2.2, 1.2], 'bark', 4); limb(c, [(29, 62), (35, 63)], [2.2, 1.2], 'bark', 5)    # 뿌리
    limb(c, [(24, 34), (15, 26), (9, 17), (4, 9)], [2.4, 1.8, 1.2, 0.8], 'bark', 6)
    limb(c, [(25, 30), (31, 21), (37, 13), (42, 6)], [2.4, 1.8, 1.2, 0.8], 'bark', 7)
    limb(c, [(24, 30), (23, 18), (25, 8), (24, 2)], [2.0, 1.5, 1.0, 0.6], 'bark', 8)
    limb(c, [(15, 26), (19, 17), (18, 10)], [1.1, 0.8, 0.5], 'bark', 9)
    limb(c, [(31, 21), (28, 12)], [1.0, 0.6], 'bark', 10)
    limb(c, [(9, 17), (12, 10)], [0.8, 0.5], 'bark', 11); limb(c, [(37, 13), (35, 6)], [0.8, 0.5], 'bark', 12)
    limb(c, [(4, 9), (1, 5)], [0.6, 0.4], 'bark', 13); limb(c, [(42, 6), (45, 3)], [0.6, 0.4], 'bark', 14)
    for (x, y) in ((22, 46), (23, 47), (22, 47), (23, 48), (22, 48)): c.tone(x, y, 'dark', 1)   # 옹이 구멍
    c.tone(21, 46, 'bark', 6); c.tone(21, 47, 'bark', 5)
    for (x, y) in ((25, 55), (26, 50), (23, 38)): c.tone(x, y, 'bark', 2)
    im = F(c); p = im.load()
    tufts(p, 48, 64, 12, 36, 63, 41, 0.55, 5, 0.8)
    return im

def dead_tree_crooked():
    """기운 고목(2x3칸): 왼쪽으로 기운 줄기, 꼭대기가 부러져 쪼개진 끝, 가지 하나에 까마귀가 앉았다."""
    c = C(32, 48, seed=622); c.shadow(16, 45.4, 9, 2.0, 80)
    c.group(1)
    limb(c, [(17, 47), (16, 38), (13, 28), (10, 18), (9, 12)], [3.4, 2.8, 2.2, 1.8, 1.6], 'bark', 3)
    limb(c, [(13, 28), (20, 22), (26, 18), (30, 16)], [1.4, 1.1, 0.8, 0.6], 'bark', 4)
    limb(c, [(10, 18), (5, 12), (3, 6)], [1.1, 0.8, 0.5], 'bark', 5)
    limb(c, [(15, 35), (22, 31)], [1.0, 0.6], 'bark', 6)
    for (x, y) in ((8, 11), (10, 11), (9, 10)): c.tone(x, y, 'bark', 6)                  # 부러진 끝(밝은 속살)
    c.tone(9, 9, 'bark', 5); c.tone(11, 10, 'bark', 4)
    c.group(2); c.new(); c.ellipsoid(25, 14.5, 2.6, 1.9, 'dark', amb=0.35, bias=0.05)      # 까마귀
    c.tone(28, 14, 'dark', 3); c.tone(29, 14, 'gold', 4); c.tone(23, 13, 'dark', 6); c.tone(22, 14, 'dark', 2); c.tone(26, 13, 'cream', 5)
    c.tone(24, 17, 'dark', 2); c.tone(26, 17, 'dark', 2)
    im = F(c); p = im.load()
    tufts(p, 32, 48, 8, 26, 47, 42, 0.55, 4, 0.8)
    return im

def dead_sapling():
    """마른 어린 나무(1x2칸): 가는 줄기에 잔가지 몇 개."""
    c = C(16, 32, seed=623); c.shadow(8, 29.6, 4.4, 1.2, 70)
    limb(c, [(8, 31), (8, 22), (7, 12), (8, 5)], [1.6, 1.2, 0.9, 0.5], 'bark', 3)
    limb(c, [(8, 20), (12, 14), (13, 9)], [0.8, 0.6, 0.4], 'bark', 4)
    limb(c, [(7, 15), (3, 10)], [0.7, 0.4], 'bark', 5)
    im = F(c); p = im.load(); tufts(p, 16, 32, 3, 13, 31, 43, 0.6, 3, 0.8)
    return im

def stump_burnt():
    """불탄 그루터기(1칸): 숯이 된 윗면에 갈라진 금, 둘레에 재."""
    c = C(16, 16, seed=624); c.shadow(8, 13.4, 6.4, 1.6, 80)
    c.new(); c.cylinder(8, 6, 13, 5.4, 'char', cap=True, capry=2.8, amb=0.3)
    for (x, y) in ((6, 5), (7, 6), (8, 6), (10, 5), (9, 7)): c.tone(x, y, 'char', 1)
    c.tone(7, 5, 'fire', 4)
    c.new()
    for (x, y) in ((2, 13), (3, 14), (13, 13), (12, 14), (14, 14)): c.tone(x, y, 'ash', 4)
    return F(c)

def dead_bush():
    """마른 가시덤불(1칸): 잎이 다 떨어진 잔가지 엉킴, 밑동에 마른 풀."""
    c = C(16, 16, seed=625); c.shadow(8, 13.6, 7, 1.4, 70)
    for k, (a, b) in enumerate((((8, 14), (3, 5)), ((8, 14), (13, 4)), ((8, 14), (8, 2)), ((7, 13), (1, 9)), ((9, 13), (15, 9)), ((5, 9), (8, 6)), ((11, 8), (9, 5)))):
        limb(c, [a, b], [0.9, 0.4], 'bark', 20 + k)
    for (x, y) in ((3, 5), (13, 4), (8, 2), (1, 9), (15, 9)): c.tone(x, y, 'hay', 5)
    im = F(c); p = im.load(); tufts(p, 16, 16, 2, 14, 15, 44, 0.7, 4, 0.9)
    return im

def _blades(c, specs, mat):
    for (x, h, dx, t0) in specs:
        c.new()
        for k in range(h):
            xx = x + int(round(dx * k / max(1, h - 1))); yy = 15 - k
            c.tone(xx, yy, mat, t0 if k < h * 0.5 else min(5, t0 + 1) if k < h - 1 else 6)
            if k < h * 0.5: c.tone(xx + 1, yy, mat, 2 if k < 2 else max(2, t0 - 1))

def drygrass_a():
    """마른 풀 포기(1칸): 누렇게 시든 키 큰 풀."""
    c = C(16, 16, seed=631)
    _blades(c, [(2, 10, -2, 3), (5, 13, 1, 4), (7, 8, -1, 3), (9, 12, 2, 4), (12, 9, 2, 3), (14, 7, 1, 3)], 'hay')
    return c.img(False)

def drygrass_b():
    """마른 풀밭 덩이(2x1칸): 시든 풀과 아직 푸른 풀이 섞였다."""
    c = C(32, 16, seed=632)
    _blades(c, [(2, 9, -1, 3), (5, 12, 1, 4), (8, 14, -2, 4), (11, 10, 2, 3), (17, 15, -1, 4), (20, 11, 2, 3), (23, 13, 1, 4), (29, 10, 1, 3)], 'hay')
    _blades(c, [(14, 11, 1, 3), (26, 8, -1, 3)], 'leaf')
    return c.img(False)

def weeds_crack():
    """돌 틈 잡초(1칸): 포석 틈을 따라 돋은 낮은 잡초와 민들레 잎."""
    c = C(16, 16, seed=633)
    _blades(c, [(3, 5, -1, 3), (5, 7, 1, 4), (8, 4, 0, 3), (11, 6, 1, 4), (13, 4, 0, 3)], 'leaf')
    for (x, y) in ((6, 14), (7, 13), (9, 14), (10, 13), (8, 14)): c.tone(x, y, 'leaf', 4)
    c.tone(8, 9, 'gold', 5)
    return c.img(False)

def nettles():
    """쐐기풀 덤불(1칸, 걷기): 길을 먹어 들어온 짙은 잡초 덩이."""
    c = C(16, 16, seed=634)
    _blades(c, [(1, 8, 1, 3), (3, 11, -1, 3), (5, 13, 1, 4), (7, 9, 0, 3), (9, 12, 1, 4), (11, 10, -1, 3), (13, 12, 1, 4), (15, 7, -1, 3)], 'leaf')
    for (x, y) in ((4, 4), (9, 5), (13, 4), (6, 7)): c.tone(x, y, 'leaf', 6); c.tone(x + 1, y + 1, 'leaf', 2)
    return c.img(False)

def ivy_ground():
    """땅을 기는 덩굴(2x1칸, 걷기): 무너진 돌·길가를 덮은 덩굴 잎 줄기."""
    c = C(32, 16, seed=635)
    for k in range(2):
        y0 = 9 + k * 3
        for x in range(1, 31):
            y = y0 + int(2 * math.sin(x / 4.0 + k * 2))
            c.tone(x, y, 'leaf', 2)
            if x % 3 == k:
                c.tone(x, y - 1, 'leaf', 4); c.tone(x + 1, y - 1, 'leaf', 5); c.tone(x + 1, y - 2, 'leaf', 3)
    return c.img(False)

# ================================================================ 까마귀·거미줄·허수아비
def _crow(c, x, y, peck=False, flip=False):
    s = -1 if flip else 1
    c.new(); c.ellipsoid(x, y, 2.8, 2.0, 'dark', amb=0.35, bias=0.08)
    if peck:
        c.tone(x + 3 * s, y + 2, 'dark', 3); c.tone(x + 4 * s, y + 3, 'gold', 3)
    else:
        c.tone(x + 3 * s, y - 1, 'dark', 3); c.tone(x + 3 * s, y - 2, 'dark', 4); c.tone(x + 4 * s, y - 2, 'gold', 4)
        c.tone(x + 2 * s, y - 2, 'cream', 5)
    c.tone(x - 3 * s, y, 'dark', 2); c.tone(x - 4 * s, y + 1, 'dark', 1)
    c.tone(x - 1, y - 1, 'dark', 6)
    c.tone(x - 1, y + 2, 'dark', 2); c.tone(x + 1, y + 2, 'dark', 2)

def crows_ground():
    """까마귀 두 마리(1칸, 걷는 장식): 땅을 쪼는 것과 고개 든 것."""
    c = C(16, 16, seed=641)
    _crow(c, 5, 10, peck=True); _crow(c, 11, 7, flip=True)
    im = F(c)
    return _ground_shadow(im, 8, 13, 7, 1.4, 60)

def crow_post():
    """까마귀 앉은 말뚝(1x2칸): 부러진 울타리 말뚝 꼭대기에 까마귀."""
    c = C(16, 32, seed=642); c.shadow(8, 29.6, 3.4, 1.2, 70)
    c.group(1); c.new()
    for y in range(12, 30): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    c.tone(7, 11, 'wood', 6); c.tone(8, 11, 'wood', 4)
    for y in range(18, 21): c.tone(9, y, 'wood', 4); c.tone(10, y + 1, 'wood', 3)              # 레일 부러진 토막
    c.group(2); _crow(c, 8, 8)
    return F(c)

def cobweb_big():
    """큰 거미줄(1칸, 위층 덧그림): 벽 모서리·문간·창에 거는 반투명 거미줄."""
    im = Image.new('RGBA', (16, 16)); p = im.load()
    cobweb(p, 16, 16, 0, 0, 14, 5, 'tl', a=120)
    return im

def cobweb_pair():
    """늘어진 거미줄(1칸, 위층 덧그림): 두 기둥 사이에 처진 거미줄과 작은 거미."""
    im = Image.new('RGBA', (16, 16)); p = im.load()
    cobweb(p, 16, 16, 0, 0, 9, 6, 'tl', a=110); cobweb(p, 16, 16, 15, 0, 9, 7, 'tr', a=110)
    for (x, y) in ((8, 6), (7, 7), (9, 7), (8, 7)): put(p, 16, 16, x, y, DK[1])
    for y in range(0, 6): put(p, 16, 16, 8, y, (236, 240, 242), 120)
    return im

def scarecrow_tattered():
    """누더기 허수아비(1x2칸): 기울어진 십자 막대에 찢긴 옷과 터진 짚, 머리 자루가 한쪽으로 처졌다."""
    c = C(16, 32, seed=643); c.shadow(8, 29.6, 4.4, 1.2, 70)
    c.group(1); c.new()
    for y in range(9, 30): c.tone(7 + (30 - y) // 10, y, 'bark', 5); c.tone(8 + (30 - y) // 10, y, 'bark', 3)
    c.group(2); c.new()
    for x in range(1, 16): c.tone(x, 13 + (x - 8) // 5, 'bark', 5); c.tone(x, 14 + (x - 8) // 5, 'bark', 3)
    c.group(3); c.new()
    for y in range(14, 24):
        for x in range(4, 13):
            if y > 20 and (x + y) % 3 == 0: continue                                           # 찢긴 자락
            c.tone(x, y, 'cloth', 4 if x < 8 else 3)
    for (x, y) in ((6, 17), (10, 19), (7, 21)): c.tone(x, y, 'dark', 2)                       # 구멍
    for (x, y) in ((1, 15), (0, 16), (15, 15), (14, 17), (5, 24), (11, 24), (8, 25)): c.tone(x, y, 'hay', 5)
    c.group(4); c.ellipsoid(10, 9, 3.0, 3.2, 'cream', amb=0.4, bias=-0.05)
    c.tone(9, 9, 'dark', 1); c.tone(11, 10, 'dark', 1)
    c.group(5); c.poly([(11, 2), (6, 7), (14, 7)], 'bark', 0.45)
    return F(c)

# ================================================================ 마을 입구·길가
def notice_torn():
    """찢긴 게시판(2x2칸): 두 기둥 위 지붕널이 반쯤 빠졌고, 빈 종이 쪼가리가 바람에 찢겨 달렸다(글씨 없음)."""
    cv = wl.Cv(32, 32)
    for x0 in (3, 27):
        for y in range(6, 31): cv.set(x0, y, 'wood', 5); cv.set(x0 + 1, y, 'wood', 3)
    for y in range(3, 7):
        for x in range(1, 31):
            if x > 20 and y < 5: continue
            cv.set(x, y, 'wood', 5 if y == 3 else 3)
    for y in range(8, 22):
        for x in range(5, 27): cv.set(x, y, 'wood', 4 if (x // 4) % 2 else 3)
    for (x0, y0, w, h, t) in ((7, 10, 6, 7, 6), (15, 9, 5, 5, 5), (18, 15, 7, 5, 6)):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if (x - x0) + (y0 + h - 1 - y) < 2 and (x0 == 18): continue
                cv.set(x, y, 'cream', t if y > y0 else 6)
        for y in range(y0 + h, y0 + h + 3):
            if H(x0, y, 4) > 0.3: cv.set(x0 + 1 + (y - y0 - h), y, 'cream', 4)        # 찢겨 늘어진 끝
    im = cv.img()
    return _ground_shadow(im, 16, 30, 13, 2, 60)

def lamppost_bent():
    """휜 가로등(1x3칸): 쇠 기둥이 위쪽에서 앞으로 꺾여 고개 숙였고, 유리 깨진 빈 등이 거꾸로 매달렸다."""
    c = C(16, 48, seed=651); c.shadow(6, 45.6, 4, 1.3, 80)
    c.group(1); c.new()
    for y in range(14, 46): c.tone(5, y, 'iron', 4); c.tone(6, y, 'iron', 2)
    for (x, y, t) in ((4, 45, 3), (7, 45, 2), (3, 46, 2), (8, 46, 2), (4, 30, 5), (4, 31, 3)): c.tone(x, y, 'iron', t)
    c.group(2); c.new()
    pts = [(5, 14), (5, 12), (6, 10), (7, 9), (8, 8), (9, 8), (10, 9), (11, 10), (11, 11)]          # 꺾인 목
    for (x, y) in pts: c.tone(x, y, 'iron', 4); c.tone(x + 1, y, 'iron', 2) if y > 9 else c.tone(x, y + 1, 'iron', 2)
    c.group(3); c.new()
    for y in range(12, 19):                                                                   # 거꾸로 매달린 등
        for x in range(9, 14):
            edge = x in (9, 13) or y in (12, 18)
            c.tone(x, y, 'iron', 3 if edge else 1)
    c.tone(10, 14, 'cryst', 4); c.tone(12, 16, 'cryst', 3); c.tone(11, 19, 'iron', 4)
    return F(c)

def gate_post_ruin():
    """마을 어귀 문기둥 둘과 떨어진 문 들보(5x3칸): 왼 돌기둥은 온전(머리돌), 오른 기둥은 허리에서 부러졌다. 이름 판(글씨 지워짐)이 쇠사슬 하나로 기울어 매달렸다."""
    W, Hh = 80, 48
    o = Image.new('RGBA', (W, Hh)); px = o.load()
    import plains_ruin as PR
    def pier(x0, top, broken=False):
        for y in range(top, Hh - 2):
            for x in range(x0, x0 + 10):
                c = castle6.ash(x * 3, y, bw=10, bh=6, seed=9)
                if x == x0: c = mix(c, ST[6], 0.35)
                if x >= x0 + 8: c = mul(c, 0.75)
                put(px, W, Hh, x, y, c)
        if broken:
            for x in range(x0, x0 + 10):
                cut = top + int(H(x // 2, 5) * 4)
                for y in range(top, cut): put(px, W, Hh, x, y, (0, 0, 0), 0)
                put(px, W, Hh, x, cut, ST[6]); put(px, W, Hh, x, cut + 1, ST[5])
        else:
            for x in range(x0 - 2, x0 + 12):                         # 머리돌(윗면 + 앞면)
                for y in range(top - 6, top):
                    put(px, W, Hh, x, y, ST[6] if y < top - 4 else (ST[4] if x < x0 + 10 else ST[3]))
    pier(4, 14); pier(66, 26, broken=True)
    for k in range(64):                                             # 떨어진 들보: 왼 기둥 머리에서 오른쪽 땅으로
        x = 10 + k; y = 9 + int(k * 0.52)
        if y >= Hh - 3: break
        for j, t in ((0, 5), (1, 4), (2, 2)): put(px, W, Hh, x, y + j, WD[t])
    for y in range(12, 25): put(px, W, Hh, 24 + (y - 12) // 6, y, ST[3])  # 사슬
    for y in range(25, 34):                                         # 기운 이름 판
        for x in range(18, 36):
            yy = y + (x - 18) // 5
            put(px, W, Hh, x, yy, WD[5] if y == 25 else (WD[4] if (x + y) % 7 else WD[3]))
        put(px, W, Hh, 18, y, WD[2])
    im = fin(o); p = im.load()
    PR._chips(p, W, Hh, ((62, 44, 4), (52, 45, 3), (72, 45, 3)))
    tufts(p, W, Hh, 0, W, Hh - 1, 51, 0.5, 4, 0.6)
    return im

def fence_fallen():
    """쓰러진 울타리 토막(2x1칸, 걷기): 기둥째 넘어져 풀밭에 누운 나무 울타리 한 칸."""
    c = C(32, 16, seed=661)
    for y0 in (6, 10):
        c.new()
        for x in range(2, 30): c.tone(x, y0 + (x // 9), 'wood', 5); c.tone(x, y0 + 1 + (x // 9), 'wood', 3)
    for x0 in (5, 24):
        c.new()
        for k in range(4): c.tone(x0 + k, 4 + k * 2, 'wood', 4); c.tone(x0 + k, 5 + k * 2, 'wood', 2)
    im = F(c); p = im.load(); tufts(p, 32, 16, 0, 32, 15, 62, 0.4, 3, 0.4)
    return im

# ================================================================ 불탄 잔해·종·기와
def beams_charred():
    """숯 들보 더미(2x1칸): 불에 탄 서까래가 엇갈려 쌓였고 틈에 남은 불씨."""
    c = C(32, 16, seed=671); c.shadow(16, 13.6, 14, 1.8, 80)
    for (y, x0, x1, b) in ((8, 2, 26, 0.0), (10, 6, 30, 0.05), (6, 10, 24, -0.05)):
        c.new(); c.hcyl(x0, x1, y, 2.2, 'char', amb=0.3, bias=b)
    c.new()
    for (x, y) in ((12, 8), (20, 10), (17, 7)): c.tone(x, y, 'fire', 4); c.tone(x + 1, y, 'fire', 3)
    for (x, y) in ((3, 12), (28, 13), (8, 13)): c.tone(x, y, 'ash', 4)
    return F(c)

def bell_fallen():
    """떨어진 종(2x2칸): 종탑에서 떨어져 옆으로 누운 청동 종 — 입이 앞(오른쪽 아래)을 보고, 테가 깨지고 녹(청록)이 슬었다. 흙에 반쯤 박혔다."""
    c = C(32, 32, seed=672); c.shadow(16, 27, 14, 3, 90)
    c.new()
    # 누운 종 몸: 왼쪽 위 정수리 → 오른쪽 아래 입. 축을 따라 반지름이 커진다
    ax, ay, bx, by = 7.0, 10.0, 22.0, 20.0
    L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L
    for y in range(0, 32):
        for x in range(0, 32):
            t = ((x + 0.5 - ax) * ux + (y + 0.5 - ay) * uy) / L
            if t < 0 or t > 1: continue
            d = (-(x + 0.5 - ax) * uy + (y + 0.5 - ay) * ux)
            r = 4.0 + 5.2 * t ** 1.4
            if abs(d) > r: continue
            f = (d + r) / (2 * r)                                     # 0 = 위쪽(빛), 1 = 아래쪽
            tt = 5 if f < 0.25 else (4 if f < 0.5 else (3 if f < 0.78 else 2))
            if t > 0.9: tt = 5 if f < 0.5 else 3                      # 테
            if H(x // 2, y // 2, 3) > 0.72 and t < 0.88: c.tone(x, y, 'verd', tt)
            else: c.tone(x, y, 'bronze', tt)
    for y in range(14, 30):                                       # 종 입(속 어둠): 테 안 타원
        for x in range(16, 32):
            dx = (x + 0.5 - 23.4) / 3.2; dy = (y + 0.5 - 21.6) / 5.6
            q = dx * 0.8 + dy * 0.6; w_ = -dx * 0.6 + dy * 0.8
            if (q / 0.9) ** 2 + (w_ / 1.0) ** 2 < 0.7: c.tone(x, y, 'dark', 1)
    for (x, y) in ((4, 8), (5, 7), (6, 7), (5, 9)): c.tone(x, y, 'bronze', 4)                   # 고리
    for k in range(8): c.tone(14 + k // 2, 12 + k, 'dark', 1)                                    # 금
    c.new()
    for x in range(2, 31):                                        # 흙 둔덕
        y = 26 + int(1.5 * math.sin(x / 4.0))
        c.tone(x, y, 'dirt', 4 if x % 3 else 5); c.tone(x, y + 1, 'dirt', 3)
    return F(c)

def tile_debris():
    """기와 조각 더미(2x1칸, 걷는 장식): 지붕에서 떨어져 깨진 기와와 판자 부스러기."""
    c = C(32, 16, seed=673)
    for i in range(14):
        x = 2 + int(H(i, 1) * 27); y = 6 + int(H(i, 2) * 8)
        c.new()
        for k in range(3 + i % 2):
            c.tone(x + k, y, 'clay', 5 if k == 0 else 4); c.tone(x + k, y + 1, 'clay', 2)
    for (x, y) in ((6, 12), (7, 12), (8, 12), (9, 13), (10, 13)): c.tone(x, y, 'wood', 4)
    return F(c)

def ash_scatter():
    """재와 숯 부스러기(1칸, 걷는 장식): 불탄 자리 둘레에 흩어진 재."""
    c = C(16, 16, seed=674)
    for i in range(18):
        x = int(H(i, 1, 9) * 15); y = int(3 + H(i, 2, 9) * 12)
        c.new(); c.tone(x, y, 'ash', 3 + i % 3)
        if i % 3 == 0: c.tone(x + 1, y, 'char', 2)
    return c.img(False)

# ================================================================ 묘지·지하 입구
def _headstone(px, W, Hh, x0, x1, ytop, ybot, seed, round_top=True, jag=None):
    """창백한 마름돌(묘지 담과 같은 돌) 비석: 둥근 머리, 윗면 두께 2화소(밝게), 앞면, 오른쪽 모 그늘."""
    cx = (x0 + x1) / 2.0; r = (x1 - x0) / 2.0
    for x in range(x0, x1):
        top = ytop
        if round_top:
            dx = (x + 0.5 - cx) / r; top = ytop + int(round(r * (1 - math.sqrt(max(0, 1 - dx * dx))) * 0.8))
        if jag: top = max(top, jag[x - x0])
        for y in range(top, ybot):
            if y < top + 2: c = ST[6] if x < cx else ST[5]
            else:
                c = castle6.ash(x * 3 + seed, y, bw=20, bh=20, seed=seed)
                if x == x0: c = mix(c, ST[6], 0.3)
                if x >= x1 - 2: c = mul(c, 0.78)
            put(px, W, Hh, x, y, c)

def tomb_cracked():
    """금 간 비석(1칸): 둥근 머리 창백한 돌 비석, 앞면에 새긴 십자, 가운데를 가른 금, 밑동 이끼·마른 풀."""
    W_, H_ = 16, 16; o = Image.new('RGBA', (W_, H_)); px = o.load()
    for x in range(2, 15): put(px, W_, H_, x, 14, SHADOW, 70)
    _headstone(px, W_, H_, 3, 13, 1, 14, 3)
    for y in range(4, 10): put(px, W_, H_, 8, y, ST[2])                       # 새긴 십자
    for x in range(6, 11): put(px, W_, H_, x, 6, ST[2])
    for k, (x, y) in enumerate(((10, 2), (10, 3), (11, 4), (10, 5), (11, 6), (11, 7), (12, 8))): put(px, W_, H_, x, y, ST[1])   # 금
    im = fin(o); p_ = im.load()
    import plains_ruin as PR
    PR._moss(p_, W_, H_, 3, 13, 9, 14, 81, 0.35)
    tufts(p_, W_, H_, 1, 15, 15, 82, 0.6, 3, 0.6)
    return im

def tomb_broken():
    """부러진 비석(1칸): 윗동이 비스듬히 부러져 앞 풀밭에 누웠다 — 서 있는 아랫동의 깨진 단면이 밝다."""
    W_, H_ = 16, 16; o = Image.new('RGBA', (W_, H_)); px = o.load()
    for x in range(1, 15): put(px, W_, H_, x, 14, SHADOW, 70)
    jag = [3, 3, 4, 4, 5, 6, 6, 7, 6]
    _headstone(px, W_, H_, 2, 11, 1, 13, 5, jag=jag)
    for x in range(9, 15):                                                     # 누운 윗동(윗면 넓게 보인다)
        for y in range(11, 15):
            c = ST[6] if y == 11 else (ST[5] if y < 13 else ST[3])
            put(px, W_, H_, x, y, c)
    im = fin(o); p_ = im.load()
    tufts(p_, W_, H_, 0, 16, 15, 83, 0.55, 3, 0.6)
    return im

def cross_crooked():
    """기운 나무 십자(1x2칸): 흙 봉분에 꽂힌 나무 십자가가 오른쪽으로 기울었다."""
    c = C(16, 32, seed=683); c.shadow(8, 29, 7, 1.6, 70)
    c.group(1); c.new()
    for x in range(1, 15):
        t = 4 if x < 8 else 3
        for y in range(25, 30):
            if ((x - 8) / 7.0) ** 2 + ((y - 29) / 4.0) ** 2 < 1: c.tone(x, y, 'dirt', t + (1 if y == 25 else 0))
    c.group(2); c.new()
    for k in range(20):
        x = 7 + k // 5; y = 26 - k
        c.tone(x, y, 'wood', 5); c.tone(x + 1, y, 'wood', 3)
    for k in range(10):
        x = 4 + k; y = 13 + k // 4
        c.tone(x, y, 'wood', 5); c.tone(x, y + 1, 'wood', 3)
    return F(c)

def crypt_entrance():
    """지하 묘소 입구(3x3칸): 뒤쪽 작은 돌 문간(박공 갓돌 윗면이 보인다, 아치 속 어둠)으로 땅 밑 계단이 내려간다.
    계단은 앞(남)에서 뒤로 내려가며 디딤판이 한 단마다 어두워진다. 좌우 낮은 난간 돌은 윗면 띠 + 앞 끝 마구리 면."""
    W, Hh = 48, 48
    o = Image.new('RGBA', (W, Hh)); px = o.load()
    def stone(x, y, k=1.0, s=13): return mul(castle6.ash(x * 2 + 5, y, bw=12, bh=6, seed=s), k)
    # 문간 앞면(y 12..27) + 갓돌 박공(윗면 + 처마)
    for x in range(6, 42):
        for y in range(12, 28):
            c = stone(x, y, 0.95)
            if x < 8: c = mix(c, ST[6], 0.3)
            if x > 39: c = mul(c, 0.75)
            put(px, W, Hh, x, y, c)
    for x in range(4, 44):
        g = 9 * (1 - abs(x + 0.5 - 24) / 20.0)
        top = int(10 - g)
        for y in range(top, 12):
            c = ST[6] if y == top else (ST[5] if x < 24 else ST[4])
            put(px, W, Hh, x, y, c)
        put(px, W, Hh, x, 12, ST[2]); put(px, W, Hh, x, 13, mul(stone(x, 13), 0.6))
    for y in range(15, 28):                                       # 아치 문 속 어둠
        for x in range(15, 33):
            dx = abs(x + 0.5 - 24); z = 28 - y
            if dx < 8.5 and (z < 7 or math.hypot(dx, z - 7) < 8.5): put(px, W, Hh, x, y, DK[1] if z > 1 else DK[2])
            elif dx < 10 and (z < 7 or math.hypot(dx, z - 7) < 10): put(px, W, Hh, x, y, ST[6] if x < 24 else ST[3])
    for x in range(16, 24, 3):                                    # 왼짝 쇠창살 문(열려 비스듬)
        for y in range(16, 28): put(px, W, Hh, x - (28 - y) // 5, y, ST[2])
    for x in range(13, 24): put(px, W, Hh, x, 19, ST[2]); put(px, W, Hh, x, 24, ST[2])
    # 내려가는 계단(문간 밑으로): 앞쪽 디딤판이 밝고 뒤로 갈수록 어둡다
    rows = [(42, 4, 0.92), (37, 4, 0.76), (32, 4, 0.58), (28, 3, 0.4)]
    for (y0, tread, k) in rows:
        for y in range(y0 - tread, y0 + 1):
            for x in range(11, 37):
                if y == y0: c = mul(ST[2], k)                         # 디딤판 앞 모(그늘)
                elif y == y0 - tread: c = mul(ST[6], k)
                else: c = mul(stone(x, y, 1.0, 17), k)
                put(px, W, Hh, x, y, c)
    for y in range(28, 46):                                       # 좌우 난간 돌: 윗면 띠 + 앞 끝 마구리
        for (x0, lit) in ((6, True), (37, False)):
            for x in range(x0, x0 + 5):
                if y < 41:
                    c = ST[6] if (lit and x == x0) else (ST[5] if lit else ST[4])
                    if (y - 28) % 6 == 5: c = ST[3]
                else:
                    c = stone(x, y, 0.85 if lit else 0.7)
                    if y == 45: c = ST[2]
                put(px, W, Hh, x, y, c)
    im = fin(o); p = im.load()
    cobweb(p, W, Hh, 15, 16, 5, 7, 'tl')
    import plains_ruin as PR
    PR._moss(p, W, Hh, 0, W, 4, Hh, 85, 0.16)
    tufts(p, W, Hh, 0, 11, Hh - 2, 86, 0.6, 4, 0.6); tufts(p, W, Hh, 37, W, Hh - 2, 87, 0.6, 4, 0.6)
    return im

def grave_wall(halves, seed, ivy=()):
    """묘지 담 토막: 초원 하이로드 성벽 토막과 같은 그리기(반 돌 단위로 남은 줄 수)로, 낮게 무너진 묘지 돌담."""
    import plains_ruin as PR
    return PR._curtain(halves, seed, ivy=ivy)
def grave_wall_long(): return grave_wall([2, 3, 3, 3, 3, 2, 2, 3, 3, 3, 3, 3], 23, ivy=((30, 10),))
def grave_wall_broken(): return grave_wall([3, 3, 2, 1, 0, 0, 1, 1, 2], 29, ivy=((8, 12),))
def grave_wall_end(): return grave_wall([3, 3, 3, 2, 1, 0], 31)

def fog_bank():
    """안개 덩이(3x2칸, 위층 반투명): 광장·묘지 바닥에 낮게 깔린 회백색 안개."""
    W, Hh = 48, 32
    im = Image.new('RGBA', (W, Hh)); p = im.load(); FG = R('fog')
    for y in range(Hh):
        for x in range(W):
            d = ((x + 0.5 - 24) / 23.0) ** 2 + ((y + 0.5 - 18) / 12.0) ** 2
            n = vnoise(x, y, 6.0, 91) * 0.6 + vnoise(x, y, 3.0, 92) * 0.4
            v = (1 - d) * 0.9 + (n - 0.5) * 0.9
            if v <= 0.05: continue
            a = int(min(150, v * 190)) // 10 * 10
            t = 5 if y < 16 else 4
            if (x + y) % 2 == 0 and a < 40: continue
            p[x, y] = FG[t] + (a,)
    return im

def fog_small():
    """작은 안개(2x1칸, 위층 반투명)."""
    W, Hh = 32, 16
    im = Image.new('RGBA', (W, Hh)); p = im.load(); FG = R('fog')
    for y in range(Hh):
        for x in range(W):
            d = ((x + 0.5 - 16) / 15.0) ** 2 + ((y + 0.5 - 9) / 6.5) ** 2
            v = (1 - d) * 0.9 + (vnoise(x, y, 4.0, 93) - 0.5) * 0.8
            if v <= 0.05: continue
            a = int(min(140, v * 180)) // 10 * 10
            if (x + y) % 2 == 0 and a < 40: continue
            p[x, y] = FG[5] + (a,)
    return im

def crops_dead():
    """시든 밭이랑(2x1칸, 걷는 장식): 흙 이랑 두 줄에 말라 꺾인 작물 대."""
    c = C(32, 16, seed=691)
    for k, y0 in enumerate((6, 13)):
        c.new()
        for x in range(0, 32):
            c.tone(x, y0, 'dirt', 5 if (x + k) % 5 else 4); c.tone(x, y0 + 1, 'dirt', 2)
        for x in range(2 + k * 2, 31, 4):
            hgt = 3 + int(H(x, k, 5) * 3)
            for j in range(hgt):
                xx = x + (1 if j == hgt - 1 and H(x, k, 6) > 0.5 else 0)
                c.tone(xx, y0 - 1 - j, 'hay', 3 if j < 2 else 5)
            c.tone(x - 1, y0 - 2, 'hay', 4)
    return c.img(False)

def rubble_church():
    """교회 돌 잔해 더미(3x2칸): 무너진 박공 어깨에서 쏟아진 분홍빛 마름돌 — 초원 하이로드 잔해 더미와 같은 쌓기, 교회 돌 색."""
    import plains_ruin as PR
    im = PR.rubble_heap().copy(); p = im.load(); tex = pj.tex('sto.wall', 48, 32).load()
    for y in range(im.height):
        for x in range(im.width):
            r, g_, b, a = p[x, y]
            if a < 200 or g_ > r + 8: continue                    # 풀 잔털은 그대로
            l = (0.3 * r + 0.59 * g_ + 0.11 * b) / 255.0
            t = tex[x % 48, y % 32][:3]; tl = lum(t) / 255.0 or 1
            k = l / max(0.3, tl)
            p[x, y] = mul(t, min(1.35, k * 0.95)) + (a,)
    return im
