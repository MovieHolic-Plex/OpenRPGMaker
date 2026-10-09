# 비행선 갑판 조각: 돛대 둘·조타륜·나침함·승강구 갑판실·사다리 승강구·화물 창 덮개·굴뚝·캡스턴·구명정·통·상자·밧줄 사리·
# 밧줄 걸이·망원경·갑판 등·선미 프로펠러·옆 날개 기관·이물 돛대(제1사장)·탑승 발판·매다는 줄·모래주머니·신호등·깃대·
# 갑판 채광 유리·전성관·통풍 나팔. 손 도트(Pillow), 버들항 나무 WD·놋쇠 BR·쇠 I7·캔버스 CNV·밧줄 ROPE. 3/4, 빛 왼쪽 위.
from as_kit import *
from as_kit import _hash


# ------------------------------------------------------------------ 돛대
def _shroud_pair(cv, xt, yt, xa, xb, yb, side):
    """돛대 줄사다리: 꼭대기(xt,yt)에서 갑판 두 점(xa,yb),(xb,yb)으로 두 줄 + 6px 마다 가로 발판 줄."""
    rope_line(cv, xt, yt, xa, yb, 0, 2); rope_line(cv, xt + side, yt + 2, xb, yb, 0, 3)
    for y in range(yt + 6, yb - 2, 6):
        t = (y - yt) / float(yb - yt)
        x0 = xt + (xa - xt) * t; x1 = xt + side + (xb - xt - side) * t
        line(cv, x0, y, x1, y, ROPE[3])

def mast_main(seed=0):
    """주돛대 5×8(80x128): 놋쇠 고리로 기낭에 닿는 꼭대기, 망대(둥근 바구니), 활대에 말아 묶은 돛, 양쪽 줄사다리, 갑판 칼라. 밑동 1칸만 막힘."""
    W, H = 80, 128; cv = Cv(W, H)
    _shroud_pair(cv, 37, 46, 3, 11, 124, -1)
    _shroud_pair(cv, 43, 46, 77, 69, 124, 1)
    vcyl(cv, 37, 43, 0, 124, WD, cap=0, bands=(8, 9, 86, 87))
    for y in range(0, 4):                                                           # 꼭대기 놋쇠 칼라(기낭 고리)
        for x in range(35, 45): cv.px(x, y, BR[6] if x < 38 else (BR[5] if x < 41 else BR[3]))
    # 망대: 윗면 타원 + 바구니 앞면
    cx, cy = 40, 34
    for y in range(cy, cy + 9):
        for x in range(cx - 13, cx + 13):
            k = cyl_k(x, cx - 13, cx + 13)
            if (x - cx) % 3 == 0: k -= 1
            if y == cy + 8: k = 2
            cv.px(x, y, WD[clamp(k, 1, 6)])
    for x in range(cx - 13, cx + 13): cv.px(x, cy, BR[5] if x < cx else BR[3])
    ellipse_fill(cv, cx, cy, 13, 4.5, lambda x, y, dx, dy, d: (BR[6] if dy < 0 and dx < 0 else BR[4]) if d > .7 else (WD[2] if dy < .2 else WD[3]))
    vcyl(cv, 38, 42, 26, 33, WD, cap=0)
    # 활대 + 말아 묶은 돛
    for x in range(8, 73):
        cv.px(x, 70, WD[5]); cv.px(x, 71, WD[3])
        for y in range(72, 78):
            k = 6 if y == 72 else (5 if y < 75 else (4 if y < 77 else 3))
            if (x - 8) % 7 == 0: k -= 1
            cv.px(x, y, CNV[k])
        if (x - 12) % 12 == 0:
            for y in range(71, 79): cv.px(x, y, ROPE[3]); cv.px(x + 1, y, ROPE[2])
    for x in (8, 72): cv.px(x, 69, BR[5]); cv.px(x, 70, BR[4])
    # 갑판 칼라(네모 받침 + 놋쇠 테)
    for y in range(118, 128):
        for x in range(32, 48):
            k = 5 if y < 121 else (4 if x < 36 else (3 if x < 45 else 2))
            if y == 127: k = 2
            if y == 121: k = 3
            cv.px(x, y, WD[k])
    for x in range(32, 48): cv.px(x, 118, BR[5])
    vcyl(cv, 37, 43, 104, 118, WD, cap=0, bands=(116, 117))
    return fin(cv, .62)

def mast_fore(seed=0):
    """앞돛대 3×7(48x112): 가는 돛대에 망대와 신호 등, 줄사다리 한 쌍, 갑판 칼라. 밑동 1칸만 막힘."""
    W, H = 48, 112; cv = Cv(W, H)
    rope_line(cv, 22, 40, 2, 108, 0, 2); rope_line(cv, 26, 40, 45, 108, 0, 2)
    for y in range(46, 104, 6):
        t = (y - 40) / 68.0
        line(cv, 22 - 20 * t, y, 22, y, ROPE[3]); line(cv, 26, y, 26 + 19 * t, y, ROPE[3])
    vcyl(cv, 22, 27, 0, 108, WD, cap=0, bands=(6, 7, 60, 61))
    for y in range(0, 3):
        for x in range(20, 29): cv.px(x, y, BR[6] if x < 23 else (BR[5] if x < 26 else BR[3]))
    cx, cy = 24, 30
    for y in range(cy, cy + 7):
        for x in range(cx - 10, cx + 10):
            k = cyl_k(x, cx - 10, cx + 10) - (1 if (x - cx) % 3 == 0 else 0)
            if y == cy + 6: k = 2
            cv.px(x, y, WD[clamp(k, 1, 6)])
    ellipse_fill(cv, cx, cy, 10, 3.5, lambda x, y, dx, dy, d: (BR[6] if dy < 0 and dx < 0 else BR[4]) if d > .65 else WD[2])
    # 신호 등(망대 위 놋쇠 등)
    for y in range(18, 27):
        for x in range(28, 35):
            c = BR[5] if x < 30 else BR[3]
            if 20 <= y <= 24 and 29 <= x <= 33: c = EMB[4] if x < 31 else EMB[3]
            cv.px(x, y, c)
    cv.px(31, 17, BR[4]); cv.px(31, 16, BR[2])
    for y in range(102, 112):
        for x in range(17, 32):
            k = 5 if y < 105 else (4 if x < 20 else (3 if x < 29 else 2))
            if y == 111: k = 2
            cv.px(x, y, WD[k])
    for x in range(17, 32): cv.px(x, 102, BR[5])
    return fin(cv, .62)


# ------------------------------------------------------------------ 조타
def helm_wheel(seed=0):
    """조타륜 2×3(32x48): 손잡이 여덟 개 달린 나무 바퀴(정면) + 놋쇠 굴대, 나무 받침 기둥과 받침판. 아랫줄 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(24, 44):
        for x in range(13, 19): cv.px(x, y, WD[clamp(cyl_k(x, 13, 19), 1, 6)])
    for y in range(40, 47):
        for x in range(7, 25):
            k = 5 if y < 42 else (4 if x < 10 else (3 if x < 22 else 2))
            if y == 46: k = 1
            cv.px(x, y, WD[k])
    for x in range(7, 25): cv.px(x, 40, BR[5])
    cx, cy, R = 16, 15, 10.5
    for i in range(8):                                                              # 바퀴살 + 손잡이
        a = i * math.pi / 4 + .2
        for r in range(3, 15):
            x = cx + r * math.cos(a); y = cy + r * math.sin(a)
            k = 5 if math.cos(a) + math.sin(a) < 0 else 3
            if r > 12: k = 6 if math.cos(a) + math.sin(a) < 0 else 4
            cv.px(int(round(x)), int(round(y)), WD[k])
    ring(cv, cx, cy, R + .5, R + .5, 2.5, lambda x, y, dx, dy: WD[6] if dx + dy < -.6 else (WD[5] if dx + dy < .4 else WD[3]))
    ellipse_fill(cv, cx, cy, 3, 3, lambda x, y, dx, dy, d: BR[6] if dx + dy < -.3 else (BR[4] if d < .8 else BR[2]))
    return shadow_under(fin(cv, .62), 16, 46, 10, 2, 70)

def binnacle(seed=0):
    """나침함 1×2(16x32): 나무 기둥 위 놋쇠 둥근 갓(앞에 유리 창), 양옆 팔에 쇠 공 둘. 아랫줄 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(15, 30):
        for x in range(4, 12): cv.px(x, y, WD[clamp(cyl_k(x, 4, 12), 1, 6)])
    for y in range(28, 32):
        for x in range(2, 14): cv.px(x, y, WD[4] if y == 28 else (WD[3] if x < 12 else WD[2]))
    ellipse_fill(cv, 8, 10, 6, 6, lambda x, y, dx, dy, d: BR[6] if (dx < -.2 and dy < -.1) else (BR[5] if dx < .3 else (BR[3] if d < .85 else BR[2])))
    for y in range(9, 13):
        for x in range(6, 11): cv.px(x, y, SKY7[5] if (x == 6 or y == 9) else (GL[2] if x > 8 else SKY7[3]))
    for (bx, k) in ((1, 0), (14, 1)):
        for y in range(13, 17):
            for x in range(bx - 1, bx + 2):
                cv.px(x, y, I7[5] if (x < bx and y < 15) else (I7[4] if y < 16 else I7[2]))
        cv.px(bx + (1 if k == 0 else -1), 16, I7[3])
    return fin(cv, .6)


# ------------------------------------------------------------------ 승강구
def deckhouse(seed=0):
    """승강구 갑판실 3×4(48x64): 널 지붕 윗면(놋쇠 용마루)과 처마 띠, 세로 널 앞벽 가운데 문 — 문 안으로 아래 선실로 내려가는 계단이
    어둠 속으로 이어진다. 문 옆 놋쇠 등, 왼쪽 둥근 창. 아래 2줄 막힘(가운데 아래 칸 = 문, 아래층 이동 이벤트)."""
    W, H = 48, 64; cv = Cv(W, H)
    # 지붕 윗면 (가로 널 4px, 위가 밝다)
    for y in range(4, 28):
        for x in range(1, 47):
            row = (y - 4) // 4; ly = (y - 4) % 4
            k = 5 if y < 16 else 4
            if ly == 3: k -= 2
            if ly == 0: k += 1
            if x < 3: k += 1
            if x > 44: k -= 1
            cv.px(x, y, WD[clamp(k, 1, 6)])
    for x in range(1, 47): cv.px(x, 4, BR[5] if x < 40 else BR[4]); cv.px(x, 5, BR[3])   # 용마루(놋쇠)
    for y in range(28, 32):                                                         # 처마 앞 띠
        for x in range(0, 48): cv.px(x, y, BR[5] if y == 28 else (WD[3] if y < 31 else WD[1]))
    # 앞벽 세로 널
    for y in range(32, 63):
        for x in range(2, 46):
            t = 4 if (x // 5) % 2 else 3
            if x % 5 == 4: t = 2
            if x < 5: t += 1
            if y == 32: t = 1
            if y >= 61: t = 2
            cv.px(x, y, WD[clamp(t, 1, 6)])
    for x0 in (2, 43):                                                              # 모서리 기둥 + 놋쇠 갓
        for y in range(32, 63):
            for x in range(x0, x0 + 3): cv.px(x, y, WD[5] if x == x0 else WD[3])
        cv.px(x0, 33, BR[6]); cv.px(x0 + 1, 33, BR[4]); cv.px(x0 + 2, 33, BR[3])
    # 문: 문틀 + 안쪽 내려가는 계단
    for y in range(35, 64):
        for x in range(15, 33):
            if x < 17 or x > 30 or y < 37:
                cv.px(x, y, WD[5] if (x < 17 and x == 15) or y == 35 else WD[3])
            else:
                d = (63 - y)                                                         # 아래(문턱)일수록 밝은 계단
                step = d // 4
                k = 5 - step
                if (63 - y) % 4 == 3: k -= 1
                c = WD[clamp(k, 1, 6)] if k >= 1 else WVOID[1]
                if k < 1: c = WVOID[0] if (x + y) % 3 else WVOID[1]
                if x in (17, 30) and k >= 1: c = WD[clamp(k - 1, 1, 6)]
                cv.px(x, y, c)
    for y in range(40, 44): cv.px(16, y, BR[4])                                     # 경첩
    for y in range(52, 56): cv.px(16, y, BR[4])
    # 놋쇠 등
    for y in range(38, 47):
        for x in range(35, 41):
            c = BR[5] if x < 37 else BR[3]
            if 40 <= y <= 44 and 36 <= x <= 39: c = EMB[4] if x < 38 else EMB[3]
            cv.px(x, y, c)
    cv.px(37, 37, BR[4]); cv.px(38, 36, BR[2])
    # 둥근 창
    ellipse_fill(cv, 9, 44, 4, 4, lambda x, y, dx, dy, d: (BR[6] if dx + dy < 0 else BR[3]) if d > .45 else (SKY7[5] if dx + dy < 0 else SKY7[3]))
    return shadow_under(fin(cv, .62), 24, 63, 25, 2, 60)

def hatch_ladder(seed=0):
    """사다리 승강구 3×2(48x32): 갑판에 뚫린 네모 구멍(놋쇠 모서리 덧댄 나무 턱) 안쪽 북벽을 따라 기관실로 내려가는 사다리,
    오른쪽에 경첩으로 열어 젖혀 눕힌 널 덮개. 구멍 2×2 막힘(남쪽 바로 앞 칸이 아래층 이동 칸), 덮개 칸은 걷기."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(3, 30):
        for x in range(1, 31):
            inner = 6 <= x <= 25 and 7 <= y <= 24
            if inner:
                d = y - 7
                c = WVOID[0] if d > 10 else (WVOID[1] if d > 5 else WD[1])
                if 8 <= y <= 18 and x in (10, 21): c = WD[4] if y < 12 else (WD[3] if y < 16 else WD[2])
                if 8 <= y <= 19 and (y - 8) % 3 == 0 and 10 < x < 21: c = WD[4] if y < 12 else (WD[3] if y < 16 else WD[2])
                cv.px(x, y, c)
            else:
                k = 6 if (y == 3 or x == 1) else 5
                if y >= 25: k = 4 if y < 27 else (3 if y < 29 else 2)
                if x >= 26 and y < 25: k = 4
                if 4 <= y <= 6 and 5 <= x <= 26: k = 4
                cv.px(x, y, WD[k])
    for (x, y) in ((1, 3), (29, 3), (1, 25), (29, 25)):
        for dy in range(2):
            for dx in range(2): cv.px(x + dx, y + dy, BR[6] if dx == 0 and dy == 0 else BR[4])
    # 덮개 (눕혀 열린 널판)
    for y in range(6, 28):
        for x in range(33, 47):
            k = 5 if (x - 33) % 4 != 3 else 3
            if y == 6 or x == 33: k = 6
            if y >= 26: k = 3 if y == 26 else 2
            cv.px(x, y, WD[k])
    for x in range(34, 46):
        for y in (10, 21): cv.px(x, y, I7[4] if x < 44 else I7[2])
    cv.px(31, 10, I7[3]); cv.px(32, 10, I7[3]); cv.px(31, 21, I7[3]); cv.px(32, 21, I7[3])
    return fin(cv, .62)

def cargo_hatch(seed=0):
    """화물 창 덮개 3×2(48x32, 걷기): 갑판과 높이가 같은 나무 격자 덮개(살 사이 어둠), 둘레 테와 쇠 모서리, 고정 밧줄 고리."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(1, 31):
        for x in range(1, 47):
            if x < 4 or x > 43 or y < 4 or y > 27:
                k = 5 if (x < 4 or y < 4) else 3
                if x == 1 or y == 1: k = 6
                if y == 30 or x == 46: k = 2
                cv.px(x, y, WD[k])
            else:
                lx = (x - 4) % 5; ly = (y - 4) % 5
                if lx == 4 and ly == 4: c = WD[4]
                elif lx == 4: c = WD[4] if ly < 2 else WD[3]
                elif ly == 4: c = WD[5] if lx < 2 else WD[4]
                else: c = WVOID[1] if (lx + ly) % 3 else WD[1]
                cv.px(x, y, c)
    for (x, y) in ((1, 1), (44, 1), (1, 28), (44, 28)):
        for dy in range(3):
            for dx in range(3): cv.px(x + dx, y + dy, I7[5] if dx + dy == 0 else I7[3])
    for (x, y) in ((22, 1), (22, 29)):
        cv.px(x, y, BR[5]); cv.px(x + 1, y, BR[5]); cv.px(x + 2, y, BR[3])
    return fin(cv, .62)


# ------------------------------------------------------------------ 굴뚝·캡스턴
def funnel(seed=0):
    """굴뚝 2×5(32x80): 기관실 화구에서 갑판을 뚫고 오른 쇠 굴뚝(놋쇠 띠 셋, 그을린 테두리 입), 갑판 칼라, 위로 피어오르는 연기. 아랫줄만 막힘."""
    W, H = 32, 80; cv = Cv(W, H)
    vcyl(cv, 8, 24, 26, 74, I7, cap=0, bands=(34, 35, 50, 51, 66, 67))
    for y in range(26, 74):
        if _hash(0, y, 811) < .3: cv.px(23, y, SOOT)
    ellipse_fill(cv, 16, 26, 9, 3.5, lambda x, y, dx, dy, d: (BR[6] if dx < -.2 else BR[4]) if d > .5 else (SOOT if dy > -.2 else (14, 10, 12)))
    ellipse_fill(cv, 16, 75, 12, 4, lambda x, y, dx, dy, d: BR[5] if dy < 0 and dx < 0 else (BR[4] if dy < .3 else BR[2]))
    vcyl(cv, 8, 24, 70, 75, I7, cap=0)
    cv.im = fin(cv, .6); cv.p = cv.im.load()
    sm = [(ST[2]), (ST[3]), (ST[4]), (ST[5])]
    for (cx_, cy_, r, a) in ((15, 21, 4.5, 235), (19, 14, 5.5, 210), (13, 8, 4.5, 170), (21, 4, 3.5, 120)):
        for y in range(int(cy_ - r - 1), int(cy_ + r + 2)):
            for x in range(int(cx_ - r - 1), int(cx_ + r + 2)):
                dx = (x + .5 - cx_) / r; dy = (y + .5 - cy_) / (r * .85); d = dx * dx + dy * dy
                if d > 1 or not (0 <= x < W and 0 <= y < H): continue
                if a < 180 and (x + y) % 2: continue
                lit = -dx * .55 - dy * .65
                t = 3 if lit > .25 else (2 if lit > -.35 else 1)
                if d > .75 and t > 1: t -= 1
                cv.p[x, y] = sm[t] + (a,)
    return cv.im

def capstan(seed=0):
    """캡스턴 2×2(32x32): 밧줄이 감긴 나무 북(세운 원통), 놋쇠 머리 판에 꽂은 손잡이 막대 넷, 아래 놋쇠 멈춤 고리. 아랫줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    cx = 16
    for y in range(12, 28):
        for x in range(8, 24):
            k = cyl_k(x, 8, 24)
            c = WD[clamp(k, 1, 6)]
            if 15 <= y <= 24 and (x * 2 + y) % 6 in (0, 1): c = ROPE[clamp(k, 1, 6)]
            elif 15 <= y <= 24: c = ROPE[clamp(k - 1, 1, 6)]
            cv.px(x, y, c)
    ellipse_fill(cv, cx, 28, 11, 3.5, lambda x, y, dx, dy, d: BR[4] if dy < 0 else BR[2])
    vcyl(cv, 8, 24, 24, 28, WD, cap=0)
    ellipse_fill(cv, cx, 12, 8, 3, lambda x, y, dx, dy, d: BR[6] if dx < -.2 and dy < .2 else (BR[5] if d < .7 else BR[3]))
    for a in (0.3, 1.87, 3.44, 5.01):                                                # 손잡이 막대(윗면 평면)
        for r in range(4, 16):
            x = cx + r * math.cos(a); y = 12 + r * .4 * math.sin(a)
            cv.px(int(round(x)), int(round(y)), WD[6] if math.sin(a) < 0 else WD[4])
            cv.px(int(round(x)), int(round(y)) + 1, WD[2])
    ellipse_fill(cv, cx, 12, 2.5, 1.2, lambda x, y, dx, dy, d: BR[6])
    return shadow_under(fin(cv, .62), 16, 29, 12, 2.5, 60)


# ------------------------------------------------------------------ 구명정
def lifeboat(seed=0):
    """구명정 4×2(64x32): 갑판 받침목 위에 얹은 작은 나무 배 — 둥근 뱃전, 속의 가로 널 셋과 노 한 쌍, 뒤쪽 반은 밧줄로 묶은 캔버스 덮개.
    앞(남) 뱃전 앞면이 보인다. 2줄 막힘."""
    W, H = 64, 32; cv = Cv(W, H)
    cx, cy, rx, ry = 32, 13, 30, 8.5
    def wb(u): return max(0.0, 1 - abs(u) ** 2.4) ** .55
    for x in range(W):
        u = (x + .5 - cx) / rx
        if abs(u) > 1: continue
        w = wb(u); far = cy - ry * w; near = cy + ry * w
        for y in range(int(far), int(near) + 6):
            if y <= near:
                k = 2 if y > far + 1 else 5
                if y > near - 1.5: k = 6 if u < .3 else 5
                cv.px(x, y, WD[k])
            else:                                                                   # 앞 뱃전 앞면(외판 3줄)
                d = y - near
                if d > 5 * w + .5: continue
                k = 4 if d < 2 else (3 if d < 4 else 2)
                if int(d) == 2: k = 2
                cv.px(x, y, WD[k])
    for x0 in (18, 32, 44):                                                         # 가로 널
        for y in range(int(cy - ry * wb((x0 - cx) / rx)) + 2, int(cy + ry * wb((x0 - cx) / rx))):
            cv.px(x0, y, WD[5]); cv.px(x0 + 1, y, WD[4]); cv.px(x0 + 2, y, WD[1])
    for (yy, k) in ((10, 5), (14, 4)):                                              # 노
        line(cv, 22, yy, 52, yy - 1, WD[k])
        for x in range(50, 56): cv.px(x, yy - 1, WD[k]); cv.px(x, yy, WD[k - 1])
    for x in range(4, 30):                                                          # 캔버스 덮개(고물 쪽)
        u = (x + .5 - cx) / rx; w = wb(u)
        for y in range(int(cy - ry * w) + 1, int(cy + ry * w) + 1):
            k = 6 if y < cy - 3 else (5 if y < cy + 2 else 4)
            if x % 7 == 3: k -= 1
            cv.px(x, y, CNV[k])
        if x % 7 == 3:
            for y in range(int(cy - ry * w), int(cy + ry * w) + 2): cv.px(x, y, ROPE[3])
    for xb in (14, 48):                                                             # 받침목
        for y in range(25, 31):
            for x in range(xb - 3, xb + 4): cv.px(x, y, WD[4] if y == 25 else (WD[3] if x < xb + 2 else WD[2]))
    return shadow_under(fin(cv, .62), 32, 29, 28, 2.5, 60)


# ------------------------------------------------------------------ 짐
def barrels_lashed(seed=0):
    """묶은 통 무리 2×2(32x32): 쇠테 두른 나무 통 셋(뒤 둘, 앞 작은 하나)을 밧줄로 묶었다. 아랫줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    barrel(cv, 2, 3, 12, 19, seed); barrel(cv, 16, 2, 12, 19, seed + 1)
    barrel(cv, 9, 13, 12, 18, seed + 2)
    rope_line(cv, 1, 15, 30, 13, 2, 3); rope_line(cv, 1, 16, 30, 14, 2, 2)
    return shadow_under(fin(cv, .62), 16, 30, 15, 2, 60)

def crate_stack(seed=0):
    """짐 상자 더미 2×2(32x32): 큰 상자 위에 작은 상자, 옆에 하나 더 — 쇠 모서리, 짐 그물 밧줄. 아랫줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    wbox(cv, 1, 12, 19, 31, 6, WD, seed)
    wbox(cv, 18, 17, 31, 31, 5, WD, seed + 1)
    wbox(cv, 3, 2, 16, 14, 4, WD, seed + 2)
    for (x0, y0, x1, y1) in ((1, 12, 19, 31), (18, 17, 31, 31), (3, 2, 16, 14)):
        for (x, y) in ((x0, y0), (x1 - 2, y0), (x0, y1 - 2), (x1 - 2, y1 - 2)):
            cv.px(x, y, I7[5]); cv.px(x + 1, y, I7[3]); cv.px(x, y + 1, I7[3]); cv.px(x + 1, y + 1, I7[2])
    for i in range(0, 34, 6):
        line(cv, i, 12, i - 10, 31, lambda x, y: ROPE[3] if (0 <= x < W and 0 <= y < H and cv.p[x, y][3]) else None)
    return shadow_under(fin(cv, .62), 16, 30, 15, 2, 60)

def rope_coil(seed=0):
    """밧줄 사리 1×1(걷기, 바닥 장식): 갑판에 둥글게 사려 놓은 밧줄과 풀린 끝."""
    cv = Cv(16, 16)
    for i, (rx, ry) in enumerate(((6.5, 4.5), (5, 3.4), (3.6, 2.4), (2.2, 1.4))):
        ring(cv, 8, 9, rx, ry, 1.4, lambda x, y, dx, dy, i=i: ROPE[5 - (1 if dy > 0 else 0) - (i % 2)] if dx + dy < 0 else ROPE[3 - (i % 2)])
    cv.px(8, 9, ROPE[1])
    line(cv, 14, 10, 15, 13, ROPE[3]); cv.px(15, 14, ROPE[2])
    return shadow_under(fin(cv, .7), 8, 11, 7, 3, 50)

def pin_rail(seed=0):
    """밧줄 걸이(빌레이 핀 난간) 2×2(32x32): 두 기둥 사이 가로 널에 꽂은 나무 핀, 핀마다 사려 걸어 둔 밧줄. 아랫줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for x0 in (3, 26):
        for y in range(10, 31):
            for x in range(x0, x0 + 3): cv.px(x, y, WD[5] if x == x0 else (WD[4] if x == x0 + 1 else WD[2]))
    for y in range(13, 18):
        for x in range(2, 30): cv.px(x, y, WD[6] if y == 13 else (WD[5] if y < 15 else (WD[3] if y < 17 else WD[2])))
    for x in range(6, 26, 4):
        cv.px(x, 8, WD[6]); cv.px(x + 1, 8, WD[4])
        for y in range(9, 13): cv.px(x, y, WD[5]); cv.px(x + 1, y, WD[3])
        for y in range(18, 21): cv.px(x, y, WD[4])
        ring(cv, x + .5, 23, 2.4, 3.5, 1.2, lambda xx, yy, dx, dy: ROPE[4] if dx < 0 else ROPE[2])
    return shadow_under(fin(cv, .62), 16, 30, 14, 2, 50)

def ballast_sacks(seed=0):
    """모래주머니(바닥짐) 2×1(32x16): 묶은 삼베 자루 셋 — 비행선 고도 맞추기용. 막힘."""
    W, H = 32, 16; cv = Cv(W, H)
    for (cx_, cy_, rx, ry, s) in ((8, 9, 7, 5.5, 0), (23, 9, 7, 5.5, 1), (15, 6, 6.5, 4.8, 2)):
        ellipse_fill(cv, cx_, cy_, rx, ry, lambda x, y, dx, dy, d: ROPE[clamp((5 if dx + dy < -.5 else (4 if dx + dy < .3 else 3)) - (1 if d > .8 else 0) - (1 if _hash(x, y, 821 + s) < .1 else 0), 1, 6)])
        for x in range(int(cx_ - 1), int(cx_ + 2)): cv.px(x, int(cy_ - ry), ROPE[2])
        cv.px(int(cx_), int(cy_ - ry) - 1, ROPE[4])
    return shadow_under(fin(cv, .65), 16, 14, 15, 2, 55)


# ------------------------------------------------------------------ 작은 기구
def telescope(seed=0):
    """망원경 1×2(16x32): 세 다리 나무 받침 위 비스듬히 하늘을 겨눈 놋쇠 망원경(대물렌즈 반짝). 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for (x1, y1, k) in ((2, 31, 4), (14, 31, 3), (8, 30, 5)):
        line(cv, 8, 16, x1, y1, WD[k])
    for t in range(0, 15):
        x = 1 + t * .9; y = 13 - t * .55
        for w in range(-1, 2):
            c = BR[6] if w < 0 else (BR[4] if w == 0 else BR[2])
            if t in (5, 6): c = I7[4] if w < 1 else I7[2]
            cv.px(int(round(x)), int(round(y)) + w, c)
    cv.px(14, 4, SKY7[6]); cv.px(14, 5, GL[3])
    cv.px(7, 15, BR[5]); cv.px(8, 15, BR[3]); cv.px(8, 16, I7[3])
    return fin(cv, .62)

def deck_lantern(seed=0):
    """갑판 등 1×2(16x32): 나무 기둥 위 놋쇠 틀 유리 등(따뜻한 불빛). 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(13, 31):
        for x in range(6, 10): cv.px(x, y, WD[clamp(cyl_k(x, 6, 10), 1, 6)])
    for x in range(4, 12): cv.px(x, 30, WD[3]); cv.px(x, 31, WD[2])
    for y in range(2, 13):
        for x in range(3, 13):
            if y < 4: c = BR[5] if x < 9 else BR[3]
            elif y > 10: c = BR[4] if x < 9 else BR[2]
            elif x in (3, 12, 8): c = BR[4] if x < 9 else BR[2]
            else: c = EMB[4] if (x < 8 and y < 8) else EMB[3]
            cv.px(x, y, c)
    cv.px(7, 1, BR[5]); cv.px(8, 1, BR[3]); cv.px(7, 0, BR[4])
    return fin(cv, .62)

def signal_lamp(seed=0):
    """신호 탐조등 2×2(32x32): 갈래 받침에 얹은 놋쇠 원통 등 — 동쪽(오른쪽) 유리 렌즈가 빛난다. 아랫줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(20, 30):
        for x in range(13, 18): cv.px(x, y, I7[clamp(cyl_k(x, 13, 18), 1, 6)])
    for x in range(8, 24): cv.px(x, 29, I7[4]); cv.px(x, 30, I7[2]); cv.px(x, 31, I7[1])
    for x in (9, 21):
        for y in range(12, 21): cv.px(x, y, I7[4]); cv.px(x + 1, y, I7[2])
    hcyl(cv, 6, 26, 7, 19, BR)
    ellipse_fill(cv, 26, 13, 3, 6.2, lambda x, y, dx, dy, d: (EMB[5] if dx + dy < -.3 else EMB[4]) if d < .6 else BR[3])
    for x in (10, 14, 18): cv.px(x, 7, BR[6]); cv.px(x, 18, BR[1])
    return fin(cv, .6)

def ensign_pole(seed=0):
    """선미 깃대 1×3(16x48): 가는 나무 깃대와 놋쇠 꼭지, 서쪽으로 나부끼는 붉은·크림 두 줄 긴 깃발(무늬·글자 없음). 아랫줄만 막힘."""
    W, H = 16, 48; cv = Cv(W, H)
    for y in range(2, 46): cv.px(12, y, WD[5]); cv.px(13, y, WD[3])
    cv.px(12, 1, BR[6]); cv.px(13, 1, BR[4]); cv.px(12, 0, BR[5])
    for x in range(10, 16): cv.px(x, 46, WD[3]); cv.px(x, 47, WD[2])
    for x in range(0, 12):
        wv = int(round(1.4 * math.sin((12 - x) * .55)))
        hh = 9 - (12 - x) // 3
        for y in range(3, 3 + hh):
            yy = y + wv
            c = RD[4] if y < 3 + hh // 2 else CNV[5]
            if x < 2: c = RD[3] if y < 3 + hh // 2 else CNV[4]
            if (12 - x) % 4 == 0 and y == 3: c = mix(c, (255, 255, 255), .2)
            cv.px(x, yy, c)
    return fin(cv, .62)

def deck_prism(seed=0):
    """갑판 채광 유리 1×1(걷기): 아래 선실로 빛을 들이는 놋쇠 테 네모 유리판 셋."""
    cv = Cv(16, 16)
    for y in range(3, 13):
        for x in range(2, 14):
            c = BR[5] if (y == 3 or x == 2) else (BR[3] if (y == 12 or x == 13) else BR[4])
            cv.px(x, y, c)
    for (x0, k) in ((4, 0), (7, 1), (10, 2)):
        for y in range(5, 11):
            for x in range(x0, x0 + 2):
                c = SKY7[5] if (y < 7 and x == x0) else (SKY7[3] if k != 1 else GL[3])
                cv.px(x, y, c)
    return fin(cv, .7)

def voice_tube(seed=0):
    """전성관 1×2(16x32): 갑판에서 솟아 휘어진 놋쇠 관 끝 나팔 입(조타실 ↔ 기관실 말 전하는 관). 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    vcyl(cv, 6, 10, 12, 30, BR, cap=0, bands=(22,), band_ramp=I7)
    for i in range(6):
        cv.px(6 + i // 2, 12 - i, BR[5]); cv.px(7 + i // 2, 12 - i, BR[5]); cv.px(8 + i // 2, 12 - i, BR[4]); cv.px(9 + i // 2, 12 - i, BR[2])
    ellipse_fill(cv, 11, 5, 4, 3.5, lambda x, y, dx, dy, d: (SOOT if d < .45 else (BR[6] if dx + dy < 0 else BR[3])))
    for x in range(4, 12): cv.px(x, 30, BR[4]); cv.px(x, 31, BR[2])
    return fin(cv, .62)

def vent_cowl(seed=0):
    """통풍 나팔 1×2(16x32): 아래 기관실로 바람을 넣는 놋쇠 통풍관 — 굵은 관 위에 붉게 칠한 속이 보이는 나팔 입이 동쪽(앞)을 향한다. 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    vcyl(cv, 5, 11, 14, 30, BR, cap=0, bands=(26,), band_ramp=I7)
    ellipse_fill(cv, 9, 9, 6, 6.5, lambda x, y, dx, dy, d: (RD[2] if dx > -.1 and d < .55 else (RD[4] if d < .55 else (BR[6] if dx + dy < -.2 else (BR[4] if dx < .4 else BR[2])))))
    for x in range(3, 13): cv.px(x, 30, BR[4]); cv.px(x, 31, BR[2])
    return fin(cv, .62)


# ------------------------------------------------------------------ 하늘 쪽 구조물
def propeller_stern(seed=0):
    """선미 프로펠러 3×4(48x64): 선체 고물에서 나온 쇠 축과 쇠 받침대 끝 놋쇠 머리, 나무 날개 넷(옆에서 보아 위아래로 길게 선 날)과
    도는 자국 호. 하늘 위(본디 막힘)."""
    W, H = 48, 64; cv = Cv(W, H)
    cx, cy = 16, 32
    for y in range(4, 61):                                                          # 도는 자국(옅은 호)
        d = abs(y + .5 - cy) / 28.0
        if d > 1: continue
        xo = int(round(6 * math.sqrt(max(0, 1 - d * d))))
        for x in (cx - xo, cx + xo):
            if (x + y) % 3 == 0: cv.px(x, y, SKY7[6])
    hcyl(cv, cx, 48, 29, 35, I7)
    line(cv, 30, 34, 46, 50, I7[3]); line(cv, 30, 35, 46, 51, I7[2]); line(cv, 31, 34, 47, 50, I7[4])
    for (y0, y1, w) in ((4, 28, 4), (36, 60, 4)):                                   # 위·아래 날개(앞에서 비틀린 면)
        for y in range(y0, y1):
            t = (y - y0) / float(y1 - y0)
            ww = w * (math.sin(math.pi * (t if y0 < cy else 1 - t)) * .5 + .7)
            for x in range(int(cx - ww), int(cx + ww) + 1):
                k = 6 if x < cx - 1 else (5 if x < cx + 1 else 3)
                if (y0 < cy and y < y0 + 2) or (y0 > cy and y > y1 - 3): k -= 1
                cv.px(x, y, WD[k])
            if (y - y0) % 7 == 3: cv.px(int(cx - ww), y, BR[5])
    for (dy, k) in ((-4, 4), (4, 3)):                                               # 앞뒤 날개(끝이 보인다)
        for x in range(cx - 3, cx + 4):
            cv.px(x, cy + dy, WD[k]); cv.px(x, cy + dy + (1 if dy > 0 else -1), WD[k - 1])
    ellipse_fill(cv, cx - 3, cy, 7, 5, lambda x, y, dx, dy, d: BR[6] if (dx < -.2 and dy < 0) else (BR[5] if dy < .2 else (BR[3] if d < .85 else BR[2])))
    for x in range(cx + 2, cx + 6):
        for y in range(cy - 4, cy + 5): cv.px(x, y, BR[3] if y < cy else BR[2])
    return fin(cv, .62)

def wing_engine(seed=0):
    """옆 날개 기관 6×4(96x64): 선체 앞면에서 남쪽(앞)으로 뻗은 짧은 날개(나무 살 위 바랜 캔버스, 놋쇠 앞전·붉은 뒷전) 끝에 매단 놋쇠 기관통,
    동쪽 끝 프로펠러(옆에서 본 위아래 날)와 배기관, 날개 밑 쇠 버팀대. 하늘 위."""
    W, H = 96, 64; cv = Cv(W, H)
    line(cv, 34, 2, 40, 34, I7[3]); line(cv, 35, 2, 41, 34, I7[2]); line(cv, 62, 2, 58, 34, I7[3]); line(cv, 63, 2, 59, 34, I7[2])
    pts = [(12, 1), (84, 1), (76, 33), (22, 33)]
    m = Mk(W, H).poly(pts)
    for y in range(H):
        for x in range(W):
            if not m.at(x, y): continue
            k = 5 if y < 6 else (4 if y < 20 else 3)
            if x % 12 == 6: k -= 1                                                  # 나무 살
            if (x % 12 == 7) and k < 5: k += 1
            c = CNV[k]
            if not m.at(x + 3, y): c = BR[5] if y < 16 else BR[4]                    # 앞전(동쪽) 놋쇠
            if not m.at(x - 3, y): c = RD[3] if y < 20 else RD[2]                    # 뒷전(서쪽) 붉은 띠
            if y < 2: c = BR[3]
            if not m.at(x, y + 1): c = CNV[1]
            cv.px(x, y, c)
    hcyl(cv, 16, 82, 32, 46, BR)
    for x0 in (28, 48, 68):
        for y in range(32, 46):
            for x in (x0, x0 + 1): cv.px(x, y, I7[4] if y < 37 else I7[2])
    for x in range(34, 64, 8):
        for y in range(28, 32): cv.px(x, y, I7[3]); cv.px(x + 1, y, I7[1])
        cv.px(x, 27, SOOT); cv.px(x + 1, 27, SOOT)
    ellipse_fill(cv, 16, 39, 3.5, 7, lambda x, y, dx, dy, d: BR[4] if dx < 0 else BR[2])
    for y in range(14, 64):
        d = abs(y + .5 - 39) / 24.0
        if d <= 1 and (y % 3 == 0): cv.px(90, y, SKY7[6])
    for (y0, y1) in ((16, 35), (43, 63)):
        for y in range(y0, y1):
            for x in range(86, 91): cv.px(x, y, WD[6] if x < 88 else (WD[5] if x < 89 else WD[3]))
    ellipse_fill(cv, 87, 39, 4.5, 5, lambda x, y, dx, dy, d: BR[6] if dx + dy < -.3 else (BR[4] if d < .8 else BR[2]))
    return fin(cv, .62)

def bowsprit(seed=0):
    """이물 장식 돛대(제1사장) 5×2(80x32): 이물 끝에서 동쪽 하늘로 비스듬히 뻗은 나무 돛대, 놋쇠 띠와 끝의 놋쇠 지느러미 장식,
    갑판으로 내려오는 버팀 밧줄. 하늘 위."""
    W, H = 80, 32; cv = Cv(W, H)
    rope_line(cv, 74, 9, 2, 26, 3, 2); rope_line(cv, 60, 13, 4, 6, 1, 3)
    for t in range(0, 70):
        x = 2 + t; y = 22 - t * .16
        for w in range(-2, 2):
            k = 6 if w == -2 else (5 if w == -1 else (4 if w == 0 else 2))
            if t % 18 in (0, 1): k = clamp(k, 2, 6); cv.px(x, int(round(y)) + w, BR[k]); continue
            cv.px(x, int(round(y)) + w, WD[k])
    # 끝 장식: 놋쇠 창끝 + 지느러미 둘
    for i in range(10):
        x = 70 + i; y0 = 11 - i * .16
        hh = 4 - i * .4
        for y in range(int(y0 - hh), int(y0 + hh) + 1): cv.px(x, y, BR[6] if y < y0 else BR[3])
    for (dy, k) in ((-1, 5), (1, 3)):
        for i in range(6):
            cv.px(68 - i, int(round(11 + dy * (3 + i * .8))), BR[k]); cv.px(69 - i, int(round(11 + dy * (3 + i * .8))), BR[k - 1])
    return fin(cv, .62)

def gangway(seed=0):
    """탑승 발판 2×5(32x80, 걷기): 갑판 난간 틈에서 남쪽 아래(부두)로 내려가는 널 경사로 — 가로 미끄럼막이 살, 양쪽 기둥과 늘어진 밧줄 손잡이."""
    W, H = 32, 80; cv = Cv(W, H)
    for y in range(0, 80):
        for x in range(6, 26):
            ly = y % 6
            k = 5 if ly < 4 else (6 if ly == 4 else 2)
            if x < 8: k = 6 if ly != 5 else 3
            if x > 23: k = min(k, 3)
            cv.px(x, y, WD[k])
        cv.px(5, y, WD[2]); cv.px(26, y, WD[1]); cv.px(27, y, WD[2] if y % 2 else WD[1])
    for y0 in (2, 30, 58):
        for x0 in (3, 26):
            for y in range(y0, y0 + 12):
                for x in range(x0, x0 + 3): cv.px(x, y, WD[5] if x == x0 else WD[3])
            cv.px(x0, y0, BR[6]); cv.px(x0 + 1, y0, BR[4]); cv.px(x0 + 2, y0, BR[3])
    for (x0, y0, x1, y1) in ((4, 3, 4, 31), (4, 31, 4, 59), (27, 3, 27, 31), (27, 31, 27, 59)):
        for y in range(y0, y1):
            t = (y - y0) / float(y1 - y0)
            cv.px(x0 + int(round(2 * math.sin(math.pi * t))) * (1 if x0 < 10 else -1), y, ROPE[4])
    return fin(cv, .62)

def cable_drop(seed=0):
    """매다는 줄 1×2(16x32, 하늘 장식): 기낭 바닥 놋쇠 고리에서 갑판 난간까지 내려오는 굵은 밧줄과 놋쇠 죔쇠."""
    cv = Cv(16, 32)
    for y in range(0, 32):
        x = 9 - int(round(y * .12))
        cv.px(x, y, ROPE[4] if y % 3 else ROPE[5]); cv.px(x + 1, y, ROPE[2])
    for y in range(18, 23):
        cv.px(6, y, BR[6] if y < 20 else BR[4]); cv.px(7, y, BR[4]); cv.px(8, y, BR[2])
    return fin(cv, .75)
