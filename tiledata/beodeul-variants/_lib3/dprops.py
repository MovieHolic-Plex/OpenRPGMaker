# 버들항 변형 3 — 던전 소품. 전부 손 도트(Pillow). 3/4 시점: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위, 1칸 = 16px.
from dlib import *
from dlib import _hash, vnoise, _h2

IRON = [(14, 16, 24), (32, 36, 48), (58, 64, 80), (94, 102, 120), (140, 148, 166), (190, 198, 212)]
COP = [(40, 22, 20), (84, 46, 30), (128, 74, 40), (176, 108, 54), (214, 148, 80), (240, 190, 120)]
VER = [(16, 44, 40), (30, 76, 66), (52, 116, 98), (86, 156, 130), (140, 200, 170)]
FL = [(158, 37, 20), (221, 41, 18), (236, 153, 0), (251, 193, 13), (255, 236, 150)]
BONE = [PL[1], PL[2], PL[3], PL[4], PL[5]]
CLOTH = [RD[0], RD[1], RD[2], RD[3], RD[4]]
GLOW = {'warm': (255, 176, 70), 'blue': (110, 210, 200), 'pale': (200, 220, 255), 'red': (255, 90, 60)}

def _fin(cv, k=.62): return pz.fin(cv.im, k)

def shadow(im, cx, cy, rx, ry, a=80):
    """발밑 그림자: 이미 그려진 그림 뒤로 알파 점을 깐다."""
    sh = new(im.width, im.height); p = sh.load()
    for y in range(im.height):
        for x in range(im.width):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: p[x, y] = (10, 8, 16, a)
    sh.alpha_composite(im); return sh

def glow(size, color, a=70, cx=None, cy=None, r=None):
    im = new(size, size); p = im.load(); cx = size / 2 if cx is None else cx; cy = size / 2 if cy is None else cy
    r = r or size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + .5 - cx, y + .5 - cy) / r
            if d < 1:
                k = (1 - d) ** 1.6
                aa = int(a * k)
                # 두 단으로 끊어 도트 느낌을 유지
                aa = (aa // 10) * 10
                if aa > 0: p[x, y] = tuple(color) + (aa,)
    return im

# ---------------------------------------------------------------- 벽 장식 (앞면 위에 얹는다)
def arch_opening(w=2, h=2, fill='dark', seed=0, rim=True):
    """벽에 뚫린 아치. fill: dark(어둠) / water(수로 출구) / bars(쇠창살)."""
    W, H = w * T, h * T; cv = Cv(W, H); R = W / 2.0
    def inside(x, y, sh):
        xx = x + .5; yy = y + .5
        if xx < sh or xx > W - sh or yy > H: return False
        if yy < R:
            return math.hypot(xx - R, yy - R) <= R - sh
        return True
    for y in range(H):
        for x in range(W):
            if inside(x, y, 0) and not inside(x, y, 3):
                ang = math.atan2(R - (y + .5), (x + .5) - R) if y < R else (math.pi / 2 if x < R else math.pi / 2)
                seg = int((ang if y < R else 0) / (math.pi / 8))
                k = 4 if seg % 2 else 3
                if x < 3: k += 1
                if x >= W - 3: k -= 1
                if y < R and abs(ang - math.pi / 2) < math.pi / 16: k = 5      # 쐐기돌
                if _hash(x, y, seed + 3) < .07: k += 1 if _hash(y, x, 4) < .5 else -1
                if y == 0 and abs(x - R) < 2: k = 5
                cv.px(x, y, ST[max(1, min(6, k))])
            elif inside(x, y, 3):
                t = y / max(1, H)
                c = mix(DK, ST[0], min(1, t * 1.2))
                if _hash(x, y, seed + 6) < .06: c = mix(c, ST[1], .5)
                cv.px(x, y, c)
    if fill == 'water':
        for y in range(H - 5, H):
            for x in range(3, W - 3):
                c = WSEW[1] if y < H - 3 else WSEW[2]
                if _hash(x, y, seed + 9) > .8: c = WSEW[4]
                cv.px(x, y, c)
        # 가운데 물살
        for x in range(4, W - 4):
            if _hash(x, 1, seed + 11) > .6: cv.px(x, H - 6, mix(WSEW[3], ST[0], .3))
    elif fill == 'bars':
        for x in range(4, W - 3, 3):
            for y in range(int(R * .3) if False else 2, H - 1):
                if inside(x, y, 3):
                    cv.px(x, y, IRON[4] if True else None); cv.px(x + 1, y, IRON[2])
        for yy in (int(R) + 1, H - 6):
            for x in range(3, W - 3):
                cv.px(x, yy, IRON[3]); cv.px(x, yy + 1, IRON[1])
    # 3/4: 벽에 붙은 장식이지만 윗면·앞면을 갖는다 — 아치 테두리 맨 위에 밝은 윗면 한 줄, 문턱은 윗면(밝음)+앞면(어두움)
    for y in range(H):
        for x in range(W):
            if inside(x, y, 0) and not inside(x, y - 1, 0):
                cv.px(x, y, ST[6] if not (x < 2 or x >= W - 2) else ST[5])
    for x in range(2, W - 2):
        cv.px(x, H - 2, ST[5]); cv.px(x, H - 1, ST[1])
    return cv.im

def door(w=1, h=2, kind='wood', seed=0, ajar=False):
    W, H = w * T, h * T; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            edge = x < 2 or x >= W - 2 or y < 3
            if edge:
                k = 4 if not (x >= W - 2) else 3
                if y < 3: k = 5 if y == 0 else 4
                cv.px(x, y, ST[k])
            else:
                if kind == 'wood':
                    c = WD[3] if (x % 4) else WD[1]
                    if x % 4 == 1: c = WD[4]
                    if y in (H // 4, H - H // 4 - 1): c = IRON[2] if x % 4 else IRON[1]
                    if _hash(x, y, seed) < .05: c = WD[2]
                elif kind == 'iron':
                    c = IRON[2] if (x % 3) else IRON[1]
                    if x % 3 == 0: c = IRON[3]
                    if y % 5 == 0: c = IRON[1]
                    if _hash(x, y, seed) < .05: c = IRON[4]
                elif kind == 'dark':
                    c = DK if y < H - 2 else ST[0]
                cv.px(x, y, c)
    if kind == 'wood':
        cv.px(W - 5, H // 2 + 1, IRON[5]); cv.px(W - 5, H // 2 + 2, IRON[3])          # 손잡이 고리
    if kind == 'iron':
        cv.px(W - 5, H // 2, COP[4]); cv.px(W - 5, H // 2 + 1, COP[2])
    for x in range(W): cv.px(x, H - 1, ST[1])
    return cv.im

def secret_door(w=1, h=2, seed=0):
    """비밀문: 평범한 앞면 돌 위에 숨은 이음매 한 줄과 한 개 다른 돌 — 밝은 눈에만 보인다."""
    W, H = w * T, h * T; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            if x in (1, W - 2) and 2 < y < H - 1: cv.px(x, y, mix(ST[3], ST[1], .55))
            if y == 2 and 1 <= x <= W - 2: cv.px(x, y, mix(ST[3], ST[1], .55))
    # 손 닿는 자리의 닳은 돌
    for (x, y) in ((W - 5, H // 2), (W - 4, H // 2), (W - 5, H // 2 + 1), (W - 4, H // 2 + 1)):
        cv.px(x, y, ST[5] if y == H // 2 else ST[4])
    return cv.im

def torch_wall():
    cv = Cv(16, 16)
    for y in range(9, 15): cv.px(7, y, IRON[3]); cv.px(8, y, IRON[1])
    for x in range(5, 11): cv.px(x, 8, IRON[4] if x < 8 else IRON[2])
    cv.px(5, 7, IRON[3]); cv.px(10, 7, IRON[2])
    for y, (a, b) in enumerate([(7, 8), (6, 9), (6, 9), (5, 10), (6, 9), (7, 8)]):
        for x in range(a, b + 1): pass
    body = [(7, 3, FL[3]), (8, 3, FL[3]), (6, 4, FL[2]), (7, 4, FL[3]), (8, 4, FL[4]), (9, 4, FL[2]),
            (6, 5, FL[1]), (7, 5, FL[2]), (8, 5, FL[3]), (9, 5, FL[1]), (6, 6, FL[0]), (7, 6, FL[1]), (8, 6, FL[1]), (9, 6, FL[0]),
            (7, 2, FL[2]), (7, 7, FL[0]), (8, 7, FL[0])]
    for x, y, c in body: cv.px(x, y, c)
    return cv.im

def pipe_h(elbow=None, seed=0, leak=False):
    """벽 앞면을 가로지르는 구리 관. elbow: None / 'down'(오른쪽에서 꺾여 바닥으로)"""
    cv = Cv(16, 16)
    for x in range(0, 16):
        for y in range(5, 11):
            k = {5: 5, 6: 4, 7: 4, 8: 3, 9: 2, 10: 1}[y]
            cv.px(x, y, COP[k])
        if _hash(x, 1, seed) < .1: cv.px(x, 6, COP[5])
    if elbow == 'down':
        for y in range(5, 16):
            for x in range(9, 15):
                k = 4 if x < 11 else (3 if x < 13 else 2)
                cv.px(x, y, COP[k])
    for x in (0, 1): [cv.px(x, y, COP[2]) for y in range(4, 12)]                     # 플랜지
    for y in range(4, 12): cv.px(7, y, COP[4]); cv.px(8, y, COP[1])
    if leak:
        for y in range(11, 16):
            if y % 2: cv.px(4, y, WSEW[4])
            cv.px(3, y, WSEW[2]) if y > 12 else None
    return cv.im

def manifold(w=3):
    """방 한복판을 가로지르는 큰 관 + 밸브들. 위 = 관 윗면, 앞 = 관 앞면."""
    W = w * T; cv = Cv(W, 32)
    for x in range(0, W):
        for y in range(8, 22):
            k = {8: 5, 9: 5, 10: 4, 11: 4, 12: 4, 13: 3, 14: 3, 15: 3, 16: 2, 17: 2, 18: 2, 19: 1, 20: 1, 21: 1}[y]
            cv.px(x, y, COP[k])
        if _hash(x, 2, 7) < .09: cv.px(x, 10, COP[5])
    for jx in range(8, W, 16):
        for y in range(7, 23): cv.px(jx, y, COP[4]); cv.px(jx + 1, y, COP[2])
    for lx in (4, W - 5):
        for y in range(22, 30):
            cv.px(lx, y, IRON[3]); cv.px(lx + 1, y, IRON[2]); cv.px(lx + 2, y, IRON[1])
        for x in range(lx - 1, lx + 4): cv.px(x, 30, IRON[2])
    for vx in range(W // 2 - 8, W // 2 + 9, 16):                                       # 손잡이 바퀴 밸브
        for y in range(2, 8): cv.px(vx + 8, y, IRON[3]) if False else None
    vx = W // 2
    for y in range(3, 8): cv.px(vx, y, IRON[3]); cv.px(vx + 1, y, IRON[1])
    for x in range(vx - 5, vx + 7): cv.px(x, 3, RD[4] if x < vx else RD[2])
    for x in range(vx - 3, vx + 5): cv.px(x, 2, RD[3]); cv.px(x, 4, RD[2])
    return shadow(_fin(cv), W / 2, 30, W / 2 - 1, 1.8)

def niche(kind='skull', seed=0):
    """묘 벽감 (앞면에 판 감실). 16x16."""
    cv = Cv(16, 16)
    for y in range(2, 15):
        for x in range(2, 14):
            if y < 5 and (x < 2 + (4 - y) - 1 + 1 or x > 13 - (4 - y) - 1) and False: continue
            edge = x in (2, 13) or y == 2
            cv.px(x, y, ST[5] if (edge and (x < 8 or y == 2)) else (ST[3] if edge else (DK if y < 8 else ST[0])))
    for x in (3, 4): cv.px(x, 3, ST[4])
    for x in range(3, 13): cv.px(x, 14, ST[2])
    if kind == 'skull':
        for (x, y, k) in [(6, 8, 4), (7, 8, 4), (8, 8, 4), (9, 8, 3), (5, 9, 3), (6, 9, 4), (7, 9, 4), (8, 9, 4), (9, 9, 3), (10, 9, 2),
                          (6, 10, 3), (7, 10, 4), (8, 10, 3), (9, 10, 2), (6, 11, 2), (7, 11, 3), (8, 11, 3), (9, 11, 2)]: cv.px(x, y, BONE[k - 1])
        cv.px(6, 9, DK); cv.px(9, 9, DK); cv.px(7, 11, DK); cv.px(8, 11, DK)
        for x in range(4, 12):                     # 아래 정강이뼈
            cv.px(x, 12, BONE[2]); cv.px(x, 13, BONE[1])
    elif kind == 'shroud':
        for y in range(7, 14):
            for x in range(3, 13):
                k = 4 if x < 7 else (3 if x < 10 else 2)
                cv.px(x, y, BONE[k - 1] if y > 7 else BONE[3])
        for x in range(3, 13): cv.px(x, 10, BONE[1] if x % 3 else BONE[2])                # 감은 천
        cv.px(4, 9, BONE[3]); cv.px(5, 8, BONE[4])
    elif kind == 'urn':
        for y in range(8, 14):
            w = {8: 2, 9: 4, 10: 5, 11: 5, 12: 4, 13: 3}[y]
            for x in range(8 - w // 2 - 1, 8 + (w + 1) // 2 - 1 + 1):
                cv.px(x, y, TRV[4] if x < 7 else (TRV[3] if x < 9 else TRV[2]))
        for x in (6, 7, 8, 9): cv.px(x, 7, TRV[5] if x < 8 else TRV[3])
    return cv.im

def chains(seed=0):
    cv = Cv(16, 16)
    for y in range(0, 12):
        if y % 2 == 0: cv.px(5, y, IRON[4]); cv.px(6, y, IRON[2])
        else: cv.px(5, y, IRON[2]); cv.px(6, y, IRON[3]); cv.px(4, y, IRON[1]) if False else None
    for y in range(0, 9):
        if y % 2 == 0: cv.px(11, y, IRON[4]); cv.px(12, y, IRON[2])
        else: cv.px(11, y, IRON[2]); cv.px(12, y, IRON[3])
    for x in range(3, 9): cv.px(x, 12, IRON[3] if x < 6 else IRON[1]); cv.px(x, 13, IRON[2] if x < 6 else IRON[1])       # 수갑 고리
    for x in range(9, 15): cv.px(x, 10, IRON[3] if x < 12 else IRON[1]); cv.px(x, 11, IRON[2] if x < 12 else IRON[1])
    cv.px(4, 12, DK); cv.px(7, 12, DK); cv.px(10, 10, DK); cv.px(13, 10, DK)
    for (x, y) in ((5, 0), (6, 0), (11, 0), (12, 0)): cv.px(x, y, IRON[4])
    return cv.im

def banner_cult(seed=0):
    """교단 깃발 (벽에 걸린 어두운 자주 천, 눈 문양)."""
    cv = Cv(16, 32)
    for y in range(1, 30):
        for x in range(3, 13):
            k = 3 if x < 7 else (2 if x < 10 else 1)
            tail = y > 26 and (x < 4 + (y - 26) or x > 11 - (y - 26)) and False
            cv.px(x, y, RD[k] if y % 9 else RD[k - 1] if k > 0 else RD[0])
    for x in range(2, 14): cv.px(x, 0, WD[5]); cv.px(x, 1, WD[2])
    for y in range(26, 30):                 # 제비꼬리
        for x in range(3, 13):
            if abs(x - 7.5) < (y - 25) * 1.1: cv.px(x, y, (0, 0, 0, 0)[:0] or None) if False else None
    # 눈 문양
    for (x, y) in ((5, 12), (6, 11), (7, 10), (8, 10), (9, 11), (10, 12), (9, 13), (8, 14), (7, 14), (6, 13)): cv.px(x, y, GD[5])
    cv.px(7, 12, GD[6]); cv.px(8, 12, GD[6]); cv.px(7, 13, DK); cv.px(8, 13, DK) if False else None
    for y in range(17, 24): cv.px(7, y, GD[4]); cv.px(8, y, GD[3])
    return cv.im

# ---------------------------------------------------------------- 바닥 소품
def fallen_column(w=2, style='temple', seed=0):
    """쓰러진 기둥 (가로로 누운 원통: 윗면 + 앞면, 옆에 깨진 단면)."""
    W = w * T; cv = Cv(W, 16)
    R = TRV if style == 'temple' else ST
    for x in range(2, W - 1):
        for y in range(4, 14):
            k = {4: 6, 5: 5, 6: 5, 7: 4, 8: 4, 9: 3, 10: 3, 11: 2, 12: 2, 13: 1}[y]
            if x % 7 == 3 and y in (7, 8, 9): k = max(1, k - 1)
            if _hash(x, y, seed + 5) < .05: k += 1
            cv.px(x, y, R[max(1, min(6, k))])
    for x in (W - 3, W - 2, W - 1):
        for y in range(5, 13): cv.px(x, y, R[3] if x < W - 1 else R[1])
    for y in range(4, 14): cv.px(1, y, R[4]); cv.px(2, y, R[5])
    for x in range(W - 6, W - 1):                                                          # 깨진 파편
        cv.px(x, 13 if x % 2 else 14, R[2]); cv.px(x, 14, R[1])
    return shadow(_fin(cv), W / 2, 13, W / 2 - 2, 2)

def barrel(seed=0):
    cv = Cv(16, 16)
    for y in range(3, 15):
        hw = 5 + (1 if 6 <= y <= 11 else 0)
        for x in range(8 - hw, 8 + hw):
            k = 5 if x < 8 - hw + 2 else (4 if x < 8 else (3 if x < 8 + hw - 2 else 2))
            if y in (6, 11): k = 1 if x % 2 else 2
            if y in (6, 11) and IRON: cv.px(x, y, IRON[3] if x < 8 else IRON[1]); continue
            cv.px(x, y, WD[k])
    for y in range(1, 5):
        for x in range(3, 13):
            if ((x - 7.5) / 5.5) ** 2 + ((y - 3) / 2.4) ** 2 <= 1: cv.px(x, y, WD[6] if x < 8 else WD[5])
    cv.px(5, 2, WD[6]); cv.px(6, 2, WD[6])
    return shadow(_fin(cv), 8, 14, 7, 2)

def crate(seed=0, stack=1):
    H = 16 + (stack - 1) * 8; cv = Cv(16, H)
    for s in range(stack):
        y0 = H - 16 - s * 8 + (0 if s == 0 else 0)
        for y in range(y0 + 2, y0 + 15 if s == 0 else y0 + 10):
            for x in range(1, 15):
                top = y < y0 + 7
                k = 5 if top else 3
                if x < 3: k += 0 if top else 1
                if x > 12: k -= 1
                if top and y % 3 == 0: k -= 1
                cv.px(x, y, WD[max(1, min(6, k))])
        for i in range(12):
            cv.px(2 + i, y0 + 8 + (i * 6) // 12, WD[1]); cv.px(13 - i, y0 + 8 + (i * 6) // 12, WD[2])
        for x in range(1, 15): cv.px(x, y0 + 7, WD[2])
    return shadow(_fin(cv), 8, H - 1, 7, 1.8)

def coffin(seed=0):
    """돌 관 (석관) 32x16: 뚜껑 윗면 + 앞면, 뚜껑에 십자무늬가 아닌 돌 능선."""
    cv = Cv(32, 24)
    for y in range(3, 22):
        for x in range(1, 31):
            top = y < 14
            k = 5 if top else 3
            if top:
                if x in (2, 3) or y == 3: k = 6
                if 8 < x < 24 and y in (8, 9): k = 4                           # 뚜껑 능선
                if x > 27: k = 4
            else:
                if x < 3: k = 4
                if x > 28: k = 2
                if y > 19: k = 2
            if _hash(x, y, seed + 2) < .05: k += 1 if _hash(y, x, 9) < .5 else -1
            cv.px(x, y, ST[max(1, min(6, k))])
    for x in range(1, 31): cv.px(x, 14, ST[2])
    for (x, y) in ((5, 8), (6, 8), (5, 9)): cv.px(x, y, ST[6])
    return shadow(_fin(cv), 16, 22, 15, 2)

def sarcophagus(seed=0):
    return coffin(seed)

def bones(seed=0, n=1):
    cv = Cv(16, 16)
    pieces = [((3, 11), (9, 12)), ((6, 9), (12, 12)), ((4, 13), (11, 14))]
    for (a, b) in pieces[:1 + n]:
        for t in range(0, 11):
            x = a[0] + (b[0] - a[0]) * t // 10; y = a[1] + (b[1] - a[1]) * t // 10
            cv.px(x, y, BONE[4] if t % 3 else BONE[3]); cv.px(x, y + 1, BONE[1])
        cv.px(a[0] - 1, a[1], BONE[3]); cv.px(a[0] - 1, a[1] - 1, BONE[4]); cv.px(b[0] + 1, b[1] + 1, BONE[3]); cv.px(b[0] + 1, b[1], BONE[4])
    return cv.im

def bone_heap(seed=0):
    """뼈 무더기 (32x16): 정강이뼈와 두개골이 쌓인 덩이."""
    cv = Cv(32, 24)
    for y in range(6, 22):
        for x in range(2, 30):
            d = ((x - 15.5) / 14) ** 2 + ((y - 15) / 8) ** 2
            if d <= 1:
                r = _hash(x, y, seed + 21); k = 4 if r < .3 else (3 if r < .6 else 2)
                if y < 12: k += 1
                if x > 22: k -= 1
                if r > .9: k = 1
                cv.px(x, y, BONE[max(0, min(4, k))])
    for (x0, y0, ln) in ((4, 12, 9), (14, 9, 10), (10, 17, 11), (18, 14, 8)):
        for t in range(ln):
            cv.px(x0 + t, y0 + t // 3, BONE[4]); cv.px(x0 + t, y0 + t // 3 + 1, BONE[1])
        cv.px(x0 - 1, y0 - 1, BONE[4]); cv.px(x0 - 1, y0, BONE[3])
    for (x0, y0) in ((7, 9), (19, 8), (13, 13), (24, 13)):
        for (dx, dy, k) in [(1, 0, 4), (2, 0, 5), (3, 0, 4), (0, 1, 3), (1, 1, 4), (2, 1, 5), (3, 1, 4), (4, 1, 3), (0, 2, 3), (1, 2, 4), (2, 2, 4), (3, 2, 3), (4, 2, 2), (1, 3, 3), (2, 3, 3), (3, 3, 2)]:
            cv.px(x0 + dx, y0 + dy, BONE[k - 1])
        cv.px(x0 + 1, y0 + 2, DK); cv.px(x0 + 3, y0 + 2, DK)
    return shadow(_fin(cv, .7), 16, 21, 14, 2)

def altar_cult(seed=0):
    """교단 제단 (32x32, 3/4): 검은 돌 윗면(밝음) + 붉은 제단보 + 촛불 / 앞면은 한 단 어두운 돌 + 늘어진 천 + 눈 문양."""
    cv = Cv(32, 32)
    slab(cv, 2, 12, 30, 30, 8, ST, seed)                                        # 윗면 8행 + 앞면 10행
    for y in range(13, 20):                                                     # 윗면 위의 붉은 제단보 (윗면 = 밝은 붉음)
        for x in range(5, 27):
            k = 5
            if _hash(x, y, seed + 8) < .08: k -= 1
            cv.px(x, y, RD[max(1, min(len(RD) - 1, k))])
    for x in range(5, 27): cv.px(x, 19, RD[1])                                  # 천 앞 가장자리 그림자
    for y in range(20, 28):                                                     # 앞으로 늘어진 천 (앞면 = 한 단 어둡다)
        for x in range(7, 25):
            k = 2 if (x + y) % 5 else 1
            cv.px(x, y, RD[k])
    for x in range(7, 25): cv.px(x, 27, RD[1])
    for (x, y) in ((11, 23), (12, 22), (13, 22), (14, 22), (15, 22), (16, 22), (17, 22), (18, 22), (19, 23), (18, 24), (17, 25), (16, 25), (15, 25), (14, 25), (13, 25), (12, 24)):
        cv.px(x, y, GD[5])                                                      # 눈 문양
    cv.px(15, 23, GD[6]); cv.px(16, 23, GD[6]); cv.px(15, 24, DK); cv.px(16, 24, DK)
    for cx, h in ((8, 5), (16, 7), (24, 5)):                                    # 촛불 셋: 윗면 위
        for y in range(12 - h, 14):
            cv.px(cx, y, BONE[4]); cv.px(cx + 1, y, BONE[2])
        cv.px(cx, 12 - h - 1, FL[3]); cv.px(cx, 12 - h - 2, FL[2]); cv.px(cx + 1, 12 - h - 1, FL[1])
    return shadow(_fin(cv), 16, 30, 15, 2)

def altar_stone(seed=0):
    """돌 제단(신전) 32x32: 트래버틴 판 + 앞면 부조."""
    cv = Cv(32, 32)
    for y in range(10, 30):
        for x in range(2, 30):
            top = y < 18
            k = 5 if top else 4
            if top and (y == 10 or x == 2): k = 6
            if not top and x < 4: k = 5
            if not top and x > 27: k = 3
            if y > 27: k = 2
            if y in (18,): k = 3
            if _hash(x, y, seed + 6) < .05: k += 1 if _hash(y, x, 4) < .5 else -1
            cv.px(x, y, TRV[max(1, min(6, k))])
    for x in range(6, 26):                              # 앞면 부조 줄
        cv.px(x, 22, TRV[2]); cv.px(x, 25, TRV[2])
    for x in range(8, 25, 4):
        for y in range(22, 26): cv.px(x, y, TRV[2]); cv.px(x + 1, y, TRV[5])
    for x in range(12, 21): cv.px(x, 13, TRV[3])       # 윗면 홈
    for y in range(12, 15): cv.px(12, y, TRV[3]); cv.px(20, y, TRV[3])
    return shadow(_fin(cv), 16, 30, 15, 2)

def straw_bed(seed=0):
    """짚 침상 (16x16, 3/4): 짚 윗면(밝음, 위 7행) + 나무 틀 앞면(어둡다) + 머리맡 담요."""
    cv = Cv(16, 16)
    for y in range(3, 11):                                                      # 윗면: 짚
        for x in range(1, 15):
            r = _hash(x, y, seed + 3)
            k = 5 if r < .55 else (6 if r < .8 else 4)
            if y == 3 or x == 1: k = 6
            if y >= 9: k = 4 if r < .6 else 3
            cv.px(x, y, GD[k])
    for x in range(3, 13, 3): cv.px(x, 6, GD[3]); cv.px(x + 1, 7, GD[3])       # 짚 결
    for y in range(4, 9):                                                       # 담요 (윗면 위, 머리맡 오른쪽 아님 — 왼쪽)
        for x in range(2, 7):
            cv.px(x, y, ST[5] if y < 7 else ST[4])
    for x in range(2, 7): cv.px(x, 8, ST[3])
    for y in range(11, 15):                                                     # 앞면: 나무 틀
        for x in range(1, 15):
            k = 3 if x < 3 else (2 if x < 13 else 1)
            if y == 11: k = 1
            if y == 14: k = 1
            if _hash(x, y, seed + 9) < .1: k += 1
            cv.px(x, y, WD[max(1, min(len(WD) - 1, k))])
    return shadow(_fin(cv, .7), 8, 14, 7, 2, 50)

def rack(seed=0):
    """고문대 (32x32 → 2x2): 나무틀에 누운 널판, 두 끝에 바퀴와 밧줄."""
    cv = Cv(32, 32)
    for y in range(8, 24):
        for x in range(3, 29):
            top = y < 16
            k = 5 if top else 3
            if top and y % 4 == 0: k = 4
            if x < 5: k += 1
            if x > 26: k -= 1
            if not top and y > 21: k = 2
            cv.px(x, y, WD[max(1, min(6, k))])
    for x in (4, 27):                                                                      # 다리
        for y in range(24, 31): cv.px(x, y, WD[3]); cv.px(x + 1, y, WD[2])
    for x in (5, 26):
        for y in range(24, 31): cv.px(x, y, WD[2]) if False else None
    for cx in (3, 28):                                                                     # 굴림 바퀴
        for a in range(0, 360, 20):
            r = math.radians(a); cv.px(int(cx + math.cos(r) * 3), int(9 + math.sin(r) * 3), IRON[4] if a < 200 else IRON[2])
        cv.px(cx, 9, IRON[5])
    for x in range(6, 27, 4): cv.px(x, 8, ST[3] if False else IRON[2]); cv.px(x, 15, IRON[1]) if False else None
    for x in range(8, 12):                                                                 # 묶인 밧줄
        cv.px(x, 9, GD[3]); cv.px(x, 10, GD[2])
    for x in range(20, 24): cv.px(x, 9, GD[3]); cv.px(x, 10, GD[2])
    for x in range(10, 22): cv.px(x, 12, RD[2]) if False else None
    for y in range(11, 15):                                                                # 얼룩
        for x in range(13, 19):
            if _hash(x, y, seed + 8) < .3: cv.px(x, y, RD[1])
    return shadow(_fin(cv), 16, 30, 14, 2)

def anvil_table(seed=0):
    """고문 도구 탁자 (32x16): 탁자 위에 집게·톱·펜치."""
    cv = Cv(32, 24)
    for y in range(6, 22):
        for x in range(1, 31):
            top = y < 12
            k = 5 if top else 3
            if top and y == 6: k = 6
            if not top and (x < 4 or x > 27): k = 2
            if not top and y > 18 and 4 <= x <= 27: continue
            cv.px(x, y, WD[max(1, min(6, k))])
    for x in range(3, 8): cv.px(x, 8, IRON[4]); cv.px(x, 9, IRON[2])
    for x in range(11, 19): cv.px(x, 8, IRON[3]) if False else None
    for x in range(10, 20): cv.px(x, 9, IRON[4] if x % 2 else IRON[2])                     # 톱
    for x in range(22, 28): cv.px(x, 7 + (x % 2), IRON[3]); cv.px(x, 9, IRON[2])
    cv.px(14, 7, RD[3]); cv.px(15, 7, RD[2])
    return shadow(_fin(cv), 16, 22, 14, 2)

# ---------------------------------------------------------------- 다리·계단·바닥 그림
def grate_floor(seed=0):
    cv = Cv(16, 16)
    for y in range(2, 14):
        for x in range(2, 14):
            cv.px(x, y, DK)
    for x in range(2, 14):
        cv.px(x, 2, IRON[3]); cv.px(x, 13, IRON[1])
    for y in range(2, 14): cv.px(2, y, IRON[4]); cv.px(13, y, IRON[1])
    for x in range(4, 13, 3):
        for y in range(3, 13): cv.px(x, y, IRON[4] if True else None); cv.px(x + 1, y, IRON[2])
    for y in range(3, 13):
        if y % 2 == 0 and False: pass
    return cv.im

def bridge_tile(direction='ns', kind='stone'):
    """물 위 다리 한 칸. ns = 남북으로 건너는 다리 (좌우에 난간)."""
    cv = Cv(16, 16)
    if direction == 'ns':
        for y in range(16):
            for x in range(16):
                if 2 <= x <= 13:
                    k = 5 if x < 4 else (4 if x < 11 else 3)
                    if y % 5 == 0: k -= 1
                    if kind == 'wood': cv.px(x, y, WD[max(2, k - 0)] if y % 5 else WD[1])
                    else: cv.px(x, y, ST[max(2, k)] if y % 5 else ST[2])
        for y in range(16):
            cv.px(1, y, ST[5] if kind == 'stone' else WD[5]); cv.px(0, y, ST[3] if kind == 'stone' else WD[3])
            cv.px(14, y, ST[2] if kind == 'stone' else WD[2]); cv.px(15, y, ST[1] if kind == 'stone' else WD[1])
    else:
        for y in range(16):
            for x in range(16):
                if 2 <= y <= 13:
                    k = 5 if y < 5 else (4 if y < 11 else 3)
                    if x % 5 == 0: k -= 1
                    if kind == 'wood': cv.px(x, y, WD[max(2, k)] if x % 5 else WD[1])
                    else: cv.px(x, y, ST[max(2, k)] if x % 5 else ST[2])
        for x in range(16):
            cv.px(x, 1, ST[5] if kind == 'stone' else WD[5]); cv.px(x, 0, ST[3] if kind == 'stone' else WD[3])
            cv.px(x, 14, ST[2] if kind == 'stone' else WD[2]); cv.px(x, 15, ST[1] if kind == 'stone' else WD[1])
    return cv.im

def stairs_down(direction='s'):
    """바닥에서 아래로 내려가는 계단 1칸 (시트 그림처럼 바닥 위에, 올려 그린 계단이 아니라 내려가는 홈)."""
    cv = Cv(16, 16)
    for y in range(16):
        b = y // 4
        for x in range(16):
            if 1 <= x <= 14:
                k = [5, 4, 3, 2][b] if y % 4 else [6, 5, 4, 3][b] if False else [5, 4, 3, 2][b]
                if y % 4 == 0: k = [6, 5, 4, 3][b]
                if y % 4 == 3: k = max(0, k - 1)
                cv.px(x, y, ST[max(1, min(6, k))] if y % 4 != 3 else ST[max(0, [3, 2, 1, 0][b])])
    for y in range(16): cv.px(0, y, ST[1]); cv.px(15, y, ST[1])
    return cv.im

def stairs_up_face(w=1):
    """벽 앞면 밑에서 올라가는 계단: 앞면 한 칸을 차지하는 그림 (올라가는 오르막, 어두운 위쪽)."""
    W = w * T; cv = Cv(W, 32)
    for y in range(32):
        b = y // 8
        for x in range(1, W - 1):
            if y < 6: cv.px(x, y, mix(DK, ST[0], y / 6.0)); continue
            k = [2, 3, 4, 5][min(3, b - 0)]
            if y % 8 == 0: k = min(6, k + 1)
            if y % 8 == 7: k = max(1, k - 2)
            cv.px(x, y, ST[k])
    for y in range(32): cv.px(0, y, ST[4]); cv.px(W - 1, y, ST[1])
    return cv.im

def mosaic_medallion(r=3, seed=0):
    """모자이크 원형 문양 (2r+1 칸 정사각). 바닥 그림."""
    N = (2 * r + 1) * T; cv = Cv(N, N); c = N / 2.0
    P1 = [(20, 46, 78), (34, 82, 124), (60, 130, 170), (200, 170, 70), (236, 210, 130), (236, 226, 200), (140, 40, 44), (190, 70, 60)]
    for y in range(N):
        for x in range(N):
            d = math.hypot(x + .5 - c, y + .5 - c); a = math.atan2(y + .5 - c, x + .5 - c)
            R = N / 2.0
            if d > R - 1: continue
            tess = ((x // 2) + (y // 2)) % 2
            if d > R - 4: col = P1[6] if ((x // 2) + (y // 2)) % 2 == 0 else P1[7]
            elif d > R - 6: col = P1[3] if tess else P1[4]
            elif d > R - 10:
                seg = int((a + math.pi) / (2 * math.pi) * 16) % 2
                col = P1[1] if seg else P1[0]
                if tess and d > R - 8: col = P1[2] if seg else P1[1]
            elif d > R - 14: col = P1[5] if tess else P1[4]
            else:
                # 가운데: 여덟 갈래 별
                st = int((a + math.pi) / (2 * math.pi) * 16)
                inner = (R - 14)
                spike = abs(((a + math.pi) / (2 * math.pi) * 8 % 1) - .5) * 2
                if d < inner * (0.35 + 0.65 * (1 - spike)): col = P1[6] if st % 2 == 0 else P1[3]
                else: col = P1[0] if tess else P1[1]
                if d < 5: col = P1[3] if tess else P1[4]
            if x % 2 == 0 and y % 2 == 0: col = mul(col, 1.08)
            elif x % 2 == 1 and y % 2 == 1: col = mul(col, .88)
            if _hash(x, y, seed + 3) > .97: col = mul(col, .8)
            cv.px(x, y, col)
    # 낡아 깨진 자리 (투명 구멍 대신 흙색으로)
    for y in range(N):
        for x in range(N):
            if cv.p[x, y][3] and vnoise(x, y, 7, seed + 9) > .8 and _hash(x, y, seed + 10) < .8:
                cv.px(x, y, TRV[2] if _hash(x, y, 11) < .6 else TRV[3])
    return cv.im

def glow_moss(kind='floor', seed=0):
    """발광 이끼 무늬. floor: 바닥 얼룩 / wall: 벽 얼룩."""
    cv = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            n = vnoise(x, y, 4, seed + 41) * .75 + _hash(x, y, seed + 42) * .25
            if n > .62:
                k = 0 if n < .7 else (1 if n < .78 else 2)
                cv.px(x, y, [(24, 120, 120), (54, 190, 170), (160, 250, 210)][k])
    return cv.im

def glow_mushroom(seed=0):
    cv = Cv(16, 16)
    for (cx, base, h) in ((5, 14, 5), (10, 14, 7), (7, 14, 3)):
        for y in range(base - h, base): cv.px(cx, y, (170, 210, 200));
        for dx in range(-2, 3):
            cv.px(cx + dx, base - h - (1 if abs(dx) < 2 else 0), (60, 200, 180) if dx < 1 else (30, 140, 140))
        cv.px(cx, base - h - 2, (170, 250, 220))
    return shadow(_fin(cv, .78), 8, 14, 7, 1.6, 50)

# ---------------------------------------------------------------- 동굴
def stalagmite(size=1, seed=0):
    """석순. size 1 = 16x24, 2 = 16x32."""
    H = 16 + size * 8 + 8 if size == 1 else 40
    H = 24 if size == 1 else 32
    cv = Cv(16, H)
    for y in range(2, H - 1):
        t = (y - 2) / (H - 3.0)
        hw = 2 + int(t * 5.4)
        for x in range(8 - hw, 8 + hw):
            k = 5 if x < 8 - hw + 2 else (4 if x < 8 - 1 else (3 if x < 8 + hw - 2 else 2))
            if _hash(x, y, seed + 4) < .08: k += 1 if _hash(y, x, 5) < .5 else -1
            cv.px(x, y, mix(ST[max(1, min(6, k))], (110, 86, 78), .35))
    for x in range(8 - 1, 8 + 1): cv.px(x, 2, ST[5])
    return shadow(_fin(cv), 8, H - 2, 7.5, 2)

def rock_pillar(h=2, seed=0):
    """천장까지 닿는 바위 기둥: 위는 천장색으로 이어지고 아래 뿌리가 넓다. 16 x 16h (넓게 24?)."""
    H = h * T; W = 24; cv = Cv(W, H)
    for y in range(0, H - 1):
        t = y / (H - 1.0)
        hw = 6 + int(t * t * 4)
        for x in range(12 - hw, 12 + hw):
            k = 5 if x < 12 - hw + 3 else (4 if x < 12 - 1 else (3 if x < 12 + hw - 3 else 2))
            n = vnoise(x, y * .6, 4, seed + 5)
            if n > .7: k += 1
            if n < .3: k -= 1
            if y < 5: cv.px(x, y, CE[2] if (x + y) % 2 else CE[3]); continue
            cv.px(x, y, mix(ST[max(1, min(6, k))], (112, 88, 80), .4))
    for x in range(12 - 10, 12 + 10):
        if cv.p[x, H - 2][3] == 0: cv.px(x, H - 2, mix(ST[2], (112, 88, 80), .4)) if False else None
    return shadow(_fin(cv, .6), 12, H - 2, 10, 2.2)

def boat(seed=0):
    """작은 노 젓는 배 (32x16 → 뭍에 올려 둔 것): 앞면 + 안쪽."""
    cv = Cv(32, 24)
    for x in range(2, 30):
        yy = 6 + int(((x - 16) / 14.0) ** 2 * 5)
        for y in range(yy, yy + 12 - int(((x - 16) / 14.0) ** 2 * 6)):
            top = y < yy + 3
            k = 2 if top else (3 if y < yy + 6 else 4)
            if top and x % 4 == 0: k = 1
            if y == yy: k = 2
            cv.px(x, y, WD[k] if not top else WD[1 if (x % 4 == 0) else 2])
    for x in range(3, 29):
        yy = 6 + int(((x - 16) / 14.0) ** 2 * 5)
        cv.px(x, yy, WD[6]); cv.px(x, yy + 1, WD[5])
    for y in range(11, 19):
        for x in range(4, 28):
            yy = 6 + int(((x - 16) / 14.0) ** 2 * 5)
            if y > yy + 3 and y < yy + 11 - int(((x - 16) / 14.0) ** 2 * 6) and False: pass
    return shadow(_fin(cv), 16, 21, 14, 2)

def fish_net(seed=0):
    cv = Cv(16, 16)
    for y in range(3, 15):
        for x in range(1, 15):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0: cv.px(x, y, GD[4] if (x + y) % 2 else GD[3])
    for x in range(1, 15): cv.px(x, 3, WD[3])
    for (x, y) in ((3, 12), (9, 13), (12, 10)): cv.px(x, y, (200, 200, 190))
    return _fin(cv, .8)

def vines(seed=0, h=2):
    cv = Cv(16, h * T)
    for x in (3, 8, 12):
        ln = int((0.4 + _hash(x, 2, seed) * .55) * h * T)
        for y in range(0, ln):
            cv.px(x + (1 if y % 6 < 3 else 0), y, LF[2] if y % 4 else LF[3])
            if y % 5 == 2: cv.px(x - 1, y, LF[4]); cv.px(x + 2, y, LF[3])
    return cv.im

def tree_ruin(seed=0):
    """폐허 마당에 자란 어린 사이프러스 (roman.cypress 재사용)."""
    import roman
    im = roman.cypress(rows=3, seed=seed)
    return im if hasattr(im, 'convert') else im.img() if hasattr(im, 'img') else im

# ================================================================ 3/4 재작업 (view34) — 윗면 + 앞면 원통/상자
def cyl(cv, cx, cy, rx, ry, h, ramp, top_ramp=None, seed=0, grain=.06, top_fill=True, rim=None):
    """3/4 원통: 위 타원(윗면, 밝음) + 앞면(빛 왼쪽 위 → 오른쪽으로 갈수록 어두움) + 아래 타원 호.
    cy = 윗면 타원 중심, h = 앞면 높이(px). 윗면 k=6/5, 앞면 k=5..2."""
    tr = top_ramp or ramp
    for y in range(int(cy - ry - 1), int(cy + h + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            xx, yy = x + .5, y + .5
            in_top = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
            in_bot = ((xx - cx) / rx) ** 2 + ((yy - cy - h) / ry) ** 2 <= 1
            in_mid = abs(xx - cx) <= rx and cy <= yy <= cy + h
            if in_top and top_fill:
                t = (xx - cx) / rx
                k = 6 if (t < -.1 and yy < cy + ry * .3) else 5
                if _hash(x, y, seed + 1) < grain: k -= 1
                cv.px(x, y, tr[max(1, min(len(tr) - 1, k))])
            elif in_mid or in_bot:
                t = (xx - cx) / rx
                k = 4 if t < -.72 else (5 if t < -.2 else (4 if t < .28 else (3 if t < .66 else 2)))
                if yy > cy + h - 1 and in_bot: k -= 1                       # 아래 호 안쪽 어두움
                if _hash(x, y, seed + 2) < grain: k += 1 if _hash(y, x, seed + 3) < .5 else -1
                cv.px(x, y, ramp[max(1, min(len(ramp) - 1, k))])

def slab(cv, x0, y0, x1, y1, top, ramp, seed=0, grain=.06):
    """3/4 상자: 윗면 top 행 + 앞면. 윗면 k=6/5, 앞면 k=4(왼)→2(오른), 맨 아래 한 줄 k=1."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if y < y0 + top: k = 6 if (y == y0 or x == x0) else 5
            else:
                k = 4 if x < x0 + 2 else (3 if x < x1 - 2 else 2)
                if y == y0 + top: k = max(1, k - 1)
                if y == y1 - 1: k = 1
            if _hash(x, y, seed + 4) < grain: k += 1 if _hash(y, x, seed + 5) < .5 else -1
            cv.px(x, y, ramp[max(1, min(len(ramp) - 1, k))])

def column(h=2, style='sewer', broken=0, seed=0):
    """h칸 높이 원기둥: 머리 윗면(타원) + 앞면 원통 음영 + 받침 윗면/앞면. broken>0 = 윗면이 깨진 그루터기."""
    H = h * T; cv = Cv(16, H)
    R = TRV if style == 'temple' else [DK, ST[1], ST[2], ST[3], ST[4], ST[5], ST[6]]
    slab(cv, 2, H - 10, 14, H - 1, 4, R, seed)                                         # 받침: 윗면 4행 + 앞면 5행
    top_y = 5 if not broken else H - broken * T + 1
    cyl(cv, 8, H - 8, 5, 2.0, 0, R, seed=seed)                                         # 기둥 밑동이 받침 윗면에 앉는다 (아래 호)
    # 기둥 몸통 (원통): 위 끝 top_y+3 에서 밑동까지
    for y in range(top_y + 3, H - 7):
        for x in range(3, 13):
            t = (x + .5 - 8) / 5.0
            k = 4 if t < -.72 else (5 if t < -.2 else (4 if t < .25 else (3 if t < .62 else 2)))
            if x in (6, 9) and y % 2 == 0: k = max(1, k - 1)                           # 세로 홈
            if _hash(x, y, seed + 2) < .05: k += 1 if _hash(y, x, 3) < .5 else -1
            cv.px(x, y, R[max(1, min(6, k))])
    if not broken:
        cyl(cv, 8, 3.2, 7.4, 3.0, 3, R, seed=seed)                                     # 머리: 윗면 타원 + 앞면 3행
        for x in range(2, 14): cv.px(x, 7, R[1])                                       # 머리 밑 그림자 한 줄
    else:
        for x in range(3, 13):                                                         # 깨진 윗면: 타원에 들쭉날쭉한 앞 가장자리
            t = (x + .5 - 8) / 5.0
            cut = int(_hash(x, 7, seed + 9) * 2)
            cv.px(x, top_y + 2, R[6] if t < 0 else R[5])
            cv.px(x, top_y + 3 + cut, R[2])
            cv.px(x, top_y + 1, R[5] if x not in (3, 12) else None) if 4 <= x <= 11 else None
        for x in range(5, 11):
            cv.px(x, top_y, R[6] if x < 8 else R[5])
        cv.px(6, top_y + 2, R[1]); cv.px(9, top_y + 1, R[1])                           # 균열
        cv.px(11, H - 10, R[4]); cv.px(2, H - 11, None)
    return shadow(_fin(cv), 8, H - 1, 8, 2)

def ruined_wall(w=2, seed=0):
    """서 있는 낮은 폐허 벽 조각 (w칸 x 32px): 4px 블록 단으로 이가 빠진 윗면(두께 띠 4행) + 앞면 돌쌓기."""
    W = w * T; cv = Cv(W, 32)
    tops = [4 + int(_hash(i, 1, seed + 3) * 4) * 2 for i in range(W // 4)]
    for x in range(W):
        top = tops[x // 4]
        if x >= W - 4: top += 8                                                        # 오른쪽 끝은 더 무너져 낮다
        for y in range(top, 32):
            if y < top + 4:
                k = 6 if (y == top) else 5
                c = TRV[k] if (x % 4 or y > top) else TRV[4]
                if y == top + 3: c = TRV[4]
                cv.px(x, y, c)
            elif y == top + 4:
                cv.px(x, y, TRV[1])                                                    # 윗면과 앞면을 끊는 어두운 선
            else:
                c = ash(x, y - top - 5, seed + 7, TRV[3], TRV[1], k=1.0)
                if y == 31: c = TRV[1]
                cv.px(x, y, c)
    for x in range(W):
        if _hash(x, 5, seed + 6) < .22: cv.px(x, 31, LF[3])
    return shadow(_fin(cv), W / 2, 30, W / 2 - 1, 2)

def bucket(seed=0):
    """양동이: 윗면 타원(쇠테 + 물) + 앞면 위가 넓은 통 + 쇠띠 + 손잡이 호."""
    cv = Cv(16, 16)
    for y in range(8, 14):                                                             # 앞면: 위가 넓고 아래로 좁아짐
        hw = 5 - (y - 8) // 3
        for x in range(8 - hw, 8 + hw):
            t = (x + .5 - 8) / hw
            cv.px(x, y, WD[4 if t < -.3 else (3 if t < .3 else 2)])
    for x in range(4, 12): cv.px(x, 12, IRON[3] if x < 8 else IRON[1])                # 아래 쇠띠
    for x in range(5, 11): cv.px(x, 10, IRON[2] if x >= 8 else IRON[3])
    cv.ell(8, 8, 5, 2.2, lambda x, y: IRON[5] if x < 8 else IRON[4])                   # 윗면 테두리
    cv.ell(8, 8.2, 3.6, 1.3, lambda x, y: WSEW[3] if x < 8 else WSEW[2])              # 윗면 물
    cv.px(6, 8, WSEW[5])
    for (x, y) in ((4, 6), (3, 5), (4, 4), (5, 3), (6, 3), (7, 3), (8, 3), (9, 3), (10, 3), (11, 4), (12, 5), (11, 6)):
        cv.px(x, y, IRON[4] if x < 8 else IRON[2])                                    # 세운 손잡이 호
    return shadow(_fin(cv), 8, 14, 5, 1.6, 60)

def brazier(seed=0):
    """화로: 윗면 타원(쇠 테두리 + 숯) + 그릇 앞면 + 세 발 + 불꽃."""
    cv = Cv(16, 16)
    for (x, y0, y1) in ((4, 12, 16), (11, 12, 16)):
        for y in range(y0, y1): cv.px(x, y, IRON[1]); cv.px(x + 1, y, IRON[2]) if False else None
    cv.px(7, 14, IRON[1]); cv.px(8, 14, IRON[1]); cv.px(7, 15, IRON[1])
    cyl(cv, 8, 8.5, 6.2, 2.4, 3, IRON, seed=seed)                                      # 그릇
    cv.ell(8, 8.5, 5.0, 1.8, lambda x, y: IRON[2])                                     # 안쪽 벽
    cv.ell(8, 8.7, 4.3, 1.4, lambda x, y: FL[0] if (x + y) % 3 else FL[1])             # 숯
    cv.px(7, 8, FL[2]); cv.px(9, 9, FL[2])
    for (x, y, c) in [(7, 3, FL[3]), (8, 3, FL[3]), (6, 4, FL[2]), (7, 4, FL[4]), (8, 4, FL[3]), (9, 4, FL[2]), (5, 5, FL[1]), (6, 5, FL[2]), (7, 5, FL[3]),
                      (8, 5, FL[3]), (9, 5, FL[2]), (10, 5, FL[1]), (6, 6, FL[1]), (7, 6, FL[2]), (8, 6, FL[2]), (9, 6, FL[1]), (7, 7, FL[0]), (8, 7, FL[0]),
                      (7, 2, FL[2]), (8, 2, FL[1])]: cv.px(x, y, c)
    return _fin(cv)

def candles(n=3, seed=0):
    """촛불: 촛농 받침(타원 윗면 + 앞 테두리) 위에 원기둥 초 — 초마다 윗면 한 줄 + 불꽃."""
    cv = Cv(16, 16)
    cv.ell(8, 12.5, 7, 2.6, lambda x, y: RD[3] if (x + y) % 5 else RD[2])
    for x in range(2, 14):
        if ((x + .5 - 8) / 7) ** 2 <= 1: cv.px(x, 14, RD[1])
    spots = [(4, 11, 5), (8, 10, 7), (11, 12, 4), (6, 13, 3)][:n]
    for x, yb, h in sorted(spots, key=lambda s: s[1]):
        for yy in range(yb - h, yb):
            cv.px(x, yy, BONE[4]); cv.px(x + 1, yy, BONE[2])
        cv.px(x, yb - h, BONE[4] if False else BONE[4]); cv.px(x + 1, yb - h, BONE[3])
        cv.px(x, yb - h - 1, BONE[4]); cv.px(x + 1, yb - h - 1, BONE[3])                # 윗면 두 행
        cv.px(x, yb - h - 2, FL[3]); cv.px(x, yb - h - 3, FL[2])
    return _fin(cv, .8)

def lantern_post(seed=0):
    """등불 기둥: 바닥 원반(윗면 타원) + 가는 원기둥 + 등갓(윗면 타원 + 앞면) + 유리."""
    cv = Cv(16, 32)
    cyl(cv, 8, 28.5, 4.5, 1.8, 1, IRON, seed=seed)
    for y in range(9, 28):
        cv.px(7, y, IRON[4]); cv.px(8, y, IRON[2])
    cv.hline(5, 11, 9, IRON[5]); cv.hline(5, 11, 10, IRON[2])                          # 받침판
    for y in range(11, 17):                                                            # 유리
        for x in range(5, 11):
            cv.px(x, y, FL[3] if x < 8 else FL[2])
        cv.px(4, y, IRON[3]); cv.px(11, y, IRON[1])
    cv.px(6, 12, FL[4]); cv.px(7, 12, FL[4])
    cyl(cv, 8, 6.5, 5.6, 2.4, 2, IRON, seed=seed)                                      # 갓
    return shadow(_fin(cv, .7), 8, 30, 5, 1.5)

def _skull(cv, x, y, seed=0):
    """해골 하나 (6x7): 정수리 윗면 → 이마/눈구멍 → 광대/이빨."""
    for dx in (1, 2, 3, 4): cv.px(x + dx, y, BONE[4] if dx < 3 else BONE[3])
    for dx in range(0, 6): cv.px(x + dx, y + 1, BONE[4] if dx < 2 else (BONE[3] if dx < 4 else BONE[2]))
    for dx in range(0, 6): cv.px(x + dx, y + 2, BONE[3] if dx < 3 else BONE[2])
    for dx in range(0, 6): cv.px(x + dx, y + 3, BONE[3] if dx < 3 else BONE[2])
    cv.px(x + 1, y + 3, DK); cv.px(x + 2, y + 3, DK); cv.px(x + 4, y + 3, DK)
    cv.px(x + 1, y + 2, DK) if False else None
    cv.px(x + 3, y + 4, DK)
    for dx in (1, 2, 3, 4): cv.px(x + dx, y + 4, BONE[2] if dx % 2 else BONE[1])
    for dx in (1, 2, 3, 4): cv.px(x + dx, y + 5, BONE[1])

def skulls(n=2, seed=0):
    cv = Cv(16, 16)
    cv.ell(8, 12, 7, 3, lambda x, y: BONE[2] if _hash(x, y, seed + 2) < .7 else BONE[1])   # 뼛조각 바닥 (윗면)
    _skull(cv, 2, 6, seed); _skull(cv, 8, 7, seed + 1)
    if n >= 3: _skull(cv, 5, 3, seed + 2)
    for (x, y) in ((1, 13), (13, 12), (6, 14)): cv.px(x, y, BONE[4]); cv.px(x + 1, y, BONE[3])
    return shadow(_fin(cv, .78), 8, 14, 7, 1.8, 55)
def valve_wheel(seed=0):
    """바닥에서 솟은 배관 + 밸브 바퀴: 바퀴는 수평 고리(윗면 타원 + 살)."""
    cv = Cv(16, 32)
    cyl(cv, 8, 26, 4.5, 1.8, 2, COP, seed=seed)                                        # 플랜지 받침
    cyl(cv, 8, 12, 3.0, 1.2, 13, COP, seed=seed + 1)                                   # 기둥
    for y in range(3, 14):                                                             # 바퀴 고리: 바깥 타원 - 안쪽 타원 (구멍은 투명)
        for x in range(0, 16):
            o = ((x + .5 - 8) / 7.2) ** 2 + ((y + .5 - 8) / 3.0) ** 2
            i = ((x + .5 - 8) / 5.0) ** 2 + ((y + .5 - 8) / 1.7) ** 2
            if o <= 1 and i > 1: cv.px(x, y, RD[5] if (y < 8 and x < 9) else (RD[4] if y < 9 else RD[2]))
    for x in range(1, 15):                                                             # 앞 두께 한 줄
        if ((x + .5 - 8) / 7.2) ** 2 + ((10.5 - 8) / 3.0) ** 2 <= 1.15 and cv.p[x, 10][3] == 0: cv.px(x, 11, RD[1])
    for (x, y) in ((8, 6), (8, 10), (5, 8), (11, 8)): cv.px(x, y, RD[3])             # 살
    cv.ell(8, 8, 1.6, 1.0, lambda x, y: COP[5])                                        # 허브
    return shadow(_fin(cv), 8, 29, 6, 1.8)

def cage_hanging(seed=0):
    """매달린 새장: 고리 + 뚜껑 윗면(타원) + 창살 앞면 + 바닥 호."""
    cv = Cv(16, 32)
    for y in range(0, 5): cv.px(8, y, IRON[3]); cv.px(7, y, IRON[1]) if y == 0 else None
    cv.ell(8, 5.5, 2, 1, lambda x, y: IRON[4])
    cv.ell(8, 9, 6, 2.6, lambda x, y: IRON[5] if x < 8 else IRON[4])                   # 뚜껑 윗면
    for y in range(9, 26):
        for x in range(2, 14):
            inb = ((x + .5 - 8) / 6) ** 2 + ((y + .5 - 25) / 2.6) ** 2 <= 1 or y < 25
            if not inb: continue
            xb = (x - 2) % 3 == 0 or x in (2, 13)
            if xb: cv.px(x, y, IRON[4] if x < 8 else IRON[2])
            else: cv.px(x, y, (10, 8, 14))
    cv.hline(2, 14, 22, IRON[3]); cv.hline(2, 14, 23, IRON[1])                         # 가로 테
    cv.ell(8, 25, 6, 2.6, lambda x, y: IRON[2] if y > 25 else IRON[1])                 # 바닥 호
    for (x, y, k) in [(6, 19, 4), (7, 19, 4), (5, 20, 3), (6, 20, 4), (7, 20, 4), (8, 20, 3), (6, 21, 2)]: cv.px(x, y, BONE[k - 1])
    return shadow(_fin(cv), 8, 29, 6, 1.5, 45)

def iron_maiden(seed=0):
    """강철 처녀: 둥근 윗면(타원) + 두 쪽 문이 만나는 이음선 + 리벳 + 둥근 받침."""
    cv = Cv(16, 32)
    for y in range(6, 29):
        for x in range(3, 13):
            t = (x + .5 - 8) / 5.0
            k = 4 if t < -.7 else (5 if t < -.15 else (4 if t < .3 else (3 if t < .65 else 2)))
            if x == 7 and y > 7: k = 1                                                 # 이음선
            cv.px(x, y, IRON[max(1, min(5, k))])
    cv.ell(8, 6, 5, 2.6, lambda x, y: IRON[5] if x < 8 else IRON[4])                   # 머리 윗면
    cv.ell(8, 6, 3, 1.3, lambda x, y: IRON[4] if x < 8 else IRON[3])
    for y in range(11, 26, 5):
        for x in range(3, 13): cv.px(x, y, IRON[3] if x < 8 else IRON[1])
    for (x, y) in ((5, 13), (10, 13), (5, 18), (10, 18)): cv.px(x, y, COP[3])
    cv.px(6, 11, RD[3]); cv.px(6, 12, RD[2]); cv.px(9, 21, RD[2])
    cyl(cv, 8, 28.5, 6, 1.8, 1, IRON, seed=seed)
    return shadow(_fin(cv), 8, 31, 6.5, 1.8)

def dock_post(seed=0):
    """부두 말뚝: 둥근 머리(타원 윗면) + 밧줄 감김 + 원통 몸통."""
    cv = Cv(16, 24)
    cyl(cv, 8, 6, 3.6, 1.6, 15, WD, seed=seed, grain=.08)
    for x in range(4, 12):                                                             # 밧줄 감김
        if ((x + .5 - 8) / 3.6) ** 2 <= 1:
            cv.px(x, 11, GD[4] if x < 8 else GD[3]); cv.px(x, 12, GD[3] if x % 2 else GD[2]); cv.px(x, 13, GD[2])
    for y in (16, 19):
        for x in range(5, 11):
            if x % 2 == 0: cv.px(x, y, WD[1])
    return shadow(_fin(cv), 8, 22, 6, 1.6)

def driftwood(seed=0):
    """유목: 가로로 누운 통나무 — 윗면 띠(밝음 3행) + 앞면 음영, 꺾인 가지는 잘린 윗면이 보인다."""
    cv = Cv(32, 16)
    for x in range(2, 30):
        y0 = 7 + int(math.sin(x * .3) * 1.4)
        for i, y in enumerate(range(y0, y0 + 7)):
            k = 6 if i == 0 else (5 if i < 3 else (4 if i == 3 else (3 if i == 4 else (2 if i == 5 else 1))))
            if _hash(x, y, seed + 6) < .07: k += 1 if _hash(y, x, 2) < .5 else -1
            if i in (3, 4) and x % 9 == 4: k = 1                                       # 껍질 틈
            cv.px(x, y, WD[max(1, min(6, k))])
    for (bx, by) in ((6, 4), (21, 4)):                                                 # 가지 그루터기
        for y in range(by + 1, by + 4): cv.px(bx, y, WD[3]); cv.px(bx + 1, y, WD[2])
        cv.px(bx, by, WD[6]); cv.px(bx + 1, by, WD[5])
    return shadow(_fin(cv, .72), 16, 14, 13, 1.6, 55)

def rubble(seed=0, style='sewer'):
    """돌무더기: 돌마다 윗면(밝음) + 앞면, 뒤→앞 순서."""
    cv = Cv(16, 16); R = TRV if style == 'temple' else ST
    stones = [(2, 8, 5, 5), (8, 6, 4, 5), (10, 9, 4, 4), (5, 10, 5, 4), (12, 6, 2, 3)]
    for i, (x0, y0, w, h) in enumerate(sorted(stones, key=lambda s: s[1] + s[3])):
        slab(cv, x0, y0, x0 + w, y0 + h, 2, R, seed + i, grain=.1)
    return shadow(_fin(cv, .7), 8, 13, 7, 2, 60)
