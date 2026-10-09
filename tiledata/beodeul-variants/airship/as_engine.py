# 비행선 기관실 조각: 보일러·벽 톱니 바퀴·플라이휠 기관·추진축·압력계·밸브 손잡이·석탄 더미·작업대·벽 사다리·연료 통·
# 공구 걸이·바닥 쇠창살. 손 도트, 쇠 I7·놋쇠 BR·불씨 EMB·석탄 COAL·나무 WD. 3/4, 빛 왼쪽 위.
# 톱니 정면 그리기는 tower-interior 의 _gear_face(읽기만)를 쓴다.
from as_kit import *
from as_kit import _hash
from ti_art2 import _gear_face


def boiler(seed=0):
    """증기 보일러 4×4(64x64): 리벳 줄 박은 누운 큰 쇠 원통(놋쇠 띠 셋) 위 증기 돔·안전밸브·압력계, 아래 벽돌 화실과 빨갛게 타는 화구 문,
    재 받이. 앵커 물체. 아래 2줄 막힘."""
    W, H = 64, 64; cv = Cv(W, H)
    # 화실(벽돌 + 쇠 테)
    for y in range(34, 63):
        for x in range(6, 58):
            row = (y - 34) // 4; ly = (y - 34) % 4; off = (row % 2) * 4
            c = RD[2] if ((x + off) // 8) % 3 else mix(RD[2], RD[1], .5)
            if ly == 3 or (x + off) % 8 == 7: c = (60, 34, 36)
            if x < 9: c = mix(c, RD[4], .25)
            if x > 54: c = mul(c, .7)
            cv.px(x, y, c)
    for y in range(34, 63):
        for x in (6, 7, 56, 57): cv.px(x, y, I7[4] if x in (6, 56) else I7[2])
    for x in range(6, 58): cv.px(x, 62, I7[1]); cv.px(x, 63, I7[0])
    # 화구 문
    for y in range(40, 58):
        for x in range(22, 42):
            edge = x in (22, 41) or y in (40, 57)
            if edge: c = I7[4] if (x == 22 or y == 40) else I7[2]
            else:
                c = EMB[3] if (x + y) % 3 else EMB[4]
                if (x - 23) % 4 == 0: c = I7[1]                                     # 화격자
                if y > 52: c = EMB[2] if (x + y) % 2 else EMB[1]
            cv.px(x, y, c)
    for x in range(26, 38): cv.px(x, 38, I7[5]); cv.px(x, 39, I7[3])
    # 누운 쇠 원통
    hcyl(cv, 2, 62, 8, 36, I7)
    for xb in (14, 32, 50):
        for y in range(8, 36):
            t = (y - 8) / 28.0
            k = 5 if t < .3 else (4 if t < .6 else 3)
            cv.px(xb, y, BR[k + 1 if k < 6 else 6]); cv.px(xb + 1, y, BR[k]); cv.px(xb + 2, y, BR[k - 1])
    for x in range(4, 60, 4):                                                        # 리벳 줄
        cv.px(x, 12, I7[6]); cv.px(x, 30, I7[5])
    for y in range(8, 36): cv.px(2, y, I7[3]); cv.px(61, y, I7[1])
    # 증기 돔 + 안전밸브
    vcyl(cv, 20, 30, 0, 10, BR, cap=2)
    ellipse_fill(cv, 25, 1.5, 5, 1.5, lambda x, y, dx, dy, d: BR[6])
    for y in range(1, 9): cv.px(40, y, BR[4]); cv.px(41, y, BR[2])
    cv.px(39, 0, BR[6]); cv.px(40, 0, BR[5]); cv.px(41, 0, BR[3])
    # 압력계
    ellipse_fill(cv, 49, 21, 5, 5, lambda x, y, dx, dy, d: (BR[5] if dx + dy < 0 else BR[3]) if d > .55 else CNV[6])
    line(cv, 49, 21, 51, 18, RD[3]); cv.px(49, 21, I7[1])
    return shadow_under(fin(cv, .6), 32, 63, 30, 2, 70)

def wall_gear_train(seed=0):
    """벽 톱니 바퀴 3×3(48x48, 벽 앞면 장식): 볼트 박은 나무 판에 단 큰 놋쇠 톱니·맞물린 쇠 톱니·작은 놋쇠 톱니와 감긴 사슬."""
    cv = Cv(48, 48)
    for y in range(2, 46):
        for x in range(2, 46):
            c = WD[3] if (x // 6) % 2 else WD[2]
            if x in (2, 3) or y in (2, 3): c = WD[4]
            if x > 43 or y > 43: c = WD[1]
            cv.px(x, y, c)
    for (x, y) in ((5, 5), (42, 5), (5, 42), (42, 42)): cv.px(x, y, I7[5])
    _gear_face(cv, 18, 20, 12, 12, BR, seed, spokes=6, phase=.3)
    _gear_face(cv, 36, 14, 6.5, 8, I7, seed + 1, spokes=3, phase=.1)
    _gear_face(cv, 34, 36, 5, 7, BR, seed + 2, spokes=3, phase=.6)
    for t in range(0, 22):                                                           # 사슬
        y = 22 + t; x = 30 + (1 if t % 2 else 0)
        cv.px(x, y, I7[4] if t % 2 else I7[2])
    return fin(cv, .55)

def flywheel_engine(seed=0):
    """플라이휠 기관 3×3(48x48): 쇠 받침대 위 크게 선 플라이휠(놋쇠 테·바퀴살 여섯)과 오른쪽 누운 증기 실린더, 둘을 잇는 크랭크 막대. 아래 2줄 막힘."""
    W, H = 48, 48; cv = Cv(W, H)
    for y in range(34, 47):                                                          # 받침대
        for x in range(1, 47):
            c = I7[4] if y == 34 else (I7[3] if x < 4 else (I7[2] if x < 44 else I7[1]))
            if y == 46: c = I7[0]
            if y == 40 and x % 6 == 2: c = I7[5]
            cv.px(x, y, c)
    for x in range(1, 47): cv.px(x, 35, I7[5] if x < 30 else I7[4])
    hcyl(cv, 26, 46, 18, 32, BR)
    for x0 in (30, 40):
        for y in range(18, 32): cv.px(x0, y, I7[4] if y < 24 else I7[2])
    ellipse_fill(cv, 46, 25, 2, 7, lambda x, y, dx, dy, d: BR[2])
    _gear_face(cv, 15, 20, 13, 1, I7, seed, spokes=6, phase=0)                        # 플라이휠(톱니 없는 바퀴)
    ring(cv, 15, 20, 14.5, 14.5, 2.3, lambda x, y, dx, dy: BR[6] if dx + dy < -.5 else (BR[4] if dx + dy < .5 else BR[2]))
    line(cv, 15, 20, 27, 25, I7[5]); line(cv, 15, 21, 27, 26, I7[3])                 # 크랭크 막대
    ellipse_fill(cv, 15, 20, 2.5, 2.5, lambda x, y, dx, dy, d: BR[6] if dx + dy < 0 else BR[3])
    return shadow_under(fin(cv, .6), 24, 46, 23, 2, 70)

def driveshaft(seed=0):
    """추진축 4×1(64x16): 바닥을 따라 동서로 누운 쇠 축과 놋쇠 축받이 둘, 가운데 이음 테. 이어 붙여 선미 프로펠러까지. 막힘."""
    W, H = 64, 16; cv = Cv(W, H)
    hcyl(cv, 0, 64, 6, 12, I7, ends=False)
    for x0 in (8, 46):
        for y in range(3, 16):
            for x in range(x0, x0 + 10):
                k = 6 if (y == 3 or x == x0) else (5 if x < x0 + 6 else 3)
                if y >= 13: k = 2 if y < 15 else 1
                cv.px(x, y, BR[k])
        cv.px(x0 + 1, 13, I7[5]); cv.px(x0 + 8, 13, I7[5])
    for y in range(4, 14):
        for x in (30, 31, 32, 33): cv.px(x, y, I7[5] if x == 30 else (I7[4] if x < 33 else I7[2]))
    return fin(cv, .6)

def pressure_gauge(seed=0):
    """압력계 1×1(벽 앞면 장식): 놋쇠 테 흰 눈금판과 붉은 바늘, 아래로 내려가는 관."""
    cv = Cv(16, 16)
    for y in range(11, 16): cv.px(7, y, BR[4]); cv.px(8, y, BR[2])
    ellipse_fill(cv, 8, 7, 6, 6, lambda x, y, dx, dy, d: (BR[6] if dx + dy < -.3 else (BR[4] if dx + dy < .5 else BR[2])) if d > .55 else CNV[6])
    for a in range(0, 360, 45):
        cv.px(int(round(8 + 3.3 * math.cos(math.radians(a)))), int(round(7 + 3.3 * math.sin(math.radians(a)))), CNV[2])
    line(cv, 8, 7, 10, 5, RD[3]); cv.px(8, 7, I7[1])
    return fin(cv, .7)

def valve_wheel(seed=0):
    """밸브 손잡이 1×1(벽 앞면 장식): 가로 관에 단 붉은 쇠 손바퀴(바퀴살 넷)."""
    cv = Cv(16, 16)
    for x in range(0, 16): cv.px(x, 11, BR[5]); cv.px(x, 12, BR[4]); cv.px(x, 13, BR[2])
    for y in range(7, 11): cv.px(8, y, I7[3])
    ring(cv, 8, 6, 5.8, 5, 1.6, lambda x, y, dx, dy: RD[4] if dx + dy < 0 else RD[2])
    line(cv, 3, 6, 13, 6, RD[3]); line(cv, 8, 2, 8, 10, RD[3])
    cv.px(8, 6, BR[6])
    return fin(cv, .65)

def coal_pile(seed=0):
    """석탄 더미 2×2(32x32): 화구 곁에 쌓은 검은 석탄 덩이(모난 반짝임)와 꽂아 둔 삽, 흩어진 부스러기. 아랫줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(8, 31):
        for x in range(1, 31):
            hgt = 30 - 20 * math.exp(-((x - 15) / 10.0) ** 2)
            if y < hgt: continue
            gx, gy = x // 3, (y + (x // 3) % 2) // 3
            h = _hash(gx, gy, 901)
            lx = x % 3; ly = (y + (x // 3) % 2) % 3
            k = 2 if h < .5 else 3
            if lx == 0 and ly == 0: k += 2
            elif lx == 2 or ly == 2: k -= 1
            if y > 28: k -= 1
            cv.px(x, y, COAL[clamp(k, 0, 5)])
    for t in range(0, 17):                                                           # 삽
        x = 22 - t * .35; y = 4 + t
        cv.px(int(round(x)), int(y), WD[5]); cv.px(int(round(x)) + 1, int(y), WD[3])
    for y in range(20, 26):
        for x in range(13, 19): cv.px(x, y, I7[4] if x < 16 else I7[2])
    for (x, y) in ((3, 30), (28, 29), (30, 31)): cv.px(x, y, COAL[3])
    return shadow_under(fin(cv, .7), 16, 30, 15, 2, 55)

def workbench(seed=0):
    """작업대 2×2(32x32): 바이스 단 두꺼운 널 작업대 위 스패너·망치·기름통, 앞 서랍과 다리. 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 16):
        for x in range(0, 32): cv.px(x, y, WD[6] if (y == 4 or x == 0) else (WD[5] if x < 30 else WD[4]))
    for y in range(1, 9):                                                            # 바이스
        for x in range(2, 9): cv.px(x, y, I7[5] if y < 3 else (I7[4] if x < 6 else I7[2]))
    line(cv, 1, 4, 10, 4, I7[3])
    line(cv, 12, 9, 20, 7, I7[5]); cv.px(11, 9, I7[4]); cv.px(12, 10, I7[4]); cv.px(20, 6, I7[4]); cv.px(21, 7, I7[4])   # 스패너
    line(cv, 13, 13, 19, 12, WD[3]); cv.px(19, 11, I7[4]); cv.px(20, 11, I7[4]); cv.px(20, 12, I7[2])               # 망치
    vcyl(cv, 24, 29, 6, 13, BR, cap=1); line(cv, 28, 7, 31, 4, BR[4])                  # 기름통
    for y in range(16, 31):
        for x in range(0, 32):
            c = WD[4] if x < 2 else (WD[3] if x < 30 else WD[2])
            if y == 16: c = WD[5]
            if 18 <= y <= 22 and 4 <= x <= 27: c = WD[2] if y in (18, 22) or x in (4, 27, 15, 16) else WD[3]
            if y >= 23 and 3 < x < 28: c = WVOID[2]
            if y == 30: c = WD[1]
            cv.px(x, y, c)
    cv.px(9, 20, BR[6]); cv.px(22, 20, BR[6])
    return shadow_under(fin(cv, .62), 16, 30, 15, 2, 55)

def wall_ladder(seed=0):
    """벽 사다리 1×3(16x48, 벽 앞면 장식): 기관실 북벽을 타고 천장 승강구(위 갑판 사다리 구멍)까지 오르는 나무 사다리, 꼭대기에 하늘빛."""
    W, H = 16, 48; cv = Cv(W, H)
    for y in range(0, 7):
        for x in range(1, 15): cv.px(x, y, SKY7[4] if (x + y) % 3 else SKY7[5]) if 3 <= x <= 12 and y >= 1 else cv.px(x, y, WD[2])
    for y in range(0, 48):
        cv.px(3, y, WD[5]); cv.px(4, y, WD[3]); cv.px(11, y, WD[5]); cv.px(12, y, WD[3])
    for y in range(4, 46, 5):
        for x in range(5, 11): cv.px(x, y, WD[5]); cv.px(x, y + 1, WD[2])
    return fin(cv, .62)

def fuel_tank(seed=0):
    """연료 통 1×2(16x32): 놋쇠 띠 두른 세운 쇠 통과 기름 눈금 유리관, 아래 꼭지. 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    vcyl(cv, 2, 14, 4, 29, I7, cap=0, bands=(8, 9, 24, 25))
    ellipse_fill(cv, 8, 4, 6, 2.5, lambda x, y, dx, dy, d: I7[6] if dx < 0 else I7[4])
    for y in range(11, 23): cv.px(11, y, (60, 52, 30) if y > 15 else SKY7[4])
    cv.px(4, 26, BR[5]); cv.px(3, 27, BR[4]); cv.px(3, 28, BR[2])
    for x in range(1, 15): cv.px(x, 29, I7[2]); cv.px(x, 30, I7[1])
    return fin(cv, .62)

def tool_rack(seed=0):
    """공구 걸이 2×1(벽 앞면 장식): 못 박은 널판에 건 스패너 셋과 망치·톱."""
    W, H = 32, 16; cv = Cv(W, H)
    for y in range(1, 15):
        for x in range(1, 31): cv.px(x, y, WD[4] if y == 1 else (WD[3] if x < 29 else WD[2]))
    for (x, ln) in ((5, 9), (9, 11), (13, 8)):
        for y in range(3, 3 + ln): cv.px(x, y, I7[5]); cv.px(x + 1, y, I7[3])
        cv.px(x - 1, 3, I7[4]); cv.px(x + 2, 3, I7[4])
    for y in range(3, 13): cv.px(19, y, WD[5])
    for x in range(17, 23): cv.px(x, 3, I7[4]); cv.px(x, 4, I7[2])
    for y in range(3, 13):
        for x in range(25, 28): cv.px(x, y, I7[5] if x == 25 else I7[3])
    return fin(cv, .62)

def floor_grate(seed=0):
    """바닥 쇠창살 2×2(32x32, 걷기): 축 도랑을 덮은 쇠 격자 — 틈 아래로 어둠 속 놋쇠 관이 비친다."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(32):
        for x in range(32):
            if x < 2 or x > 29 or y < 2 or y > 29:
                c = I7[5] if (x < 2 or y < 2) else I7[2]
            elif (x - 2) % 4 == 3 or (y - 2) % 4 == 3:
                c = I7[4] if (y - 2) % 4 == 3 else I7[3]
            else:
                c = BR[2] if 12 <= y <= 18 else WVOID[0]
                if y == 12: c = BR[4]
            cv.px(x, y, c)
    return cv.im
