# 유령 열차 — 실내 두 방: 객차 안(좌석 줄·짐 선반·흔들리는 램프·창)과 기관실(화실 문 속 푸른 유령불·압력계·석탄).
# 벽 앞면 스타일 둘을 dlib.face_px 에 끼운다(as_kit 과 같은 방식, 공용 파일은 그대로). 3/4: 덩이 = 윗면 + 남쪽 면, 빛 왼쪽 위.
import math
from gt_base import *
from gt_base import _hash, vnoise
from gt_train import tc_img, wheel, hband
from gt_station import vpost, suitcase
import dlib

# ---------------------------------------------------------------- 벽 앞면: 객차 안 / 기관실
def car_face(X, Y, H):
    """객차 안 벽(높이 H): 위 처마 몰딩 → 크림 칠 띠(짐 선반 자리) → 니스칠 판벽(창 자리) → 놋쇠 허리 띠 → 세로 널 굽도리 → 걸레받이."""
    if Y < 2: return VARN[5] if Y == 0 else VARN[3]
    if Y < 12:                                                                # 크림 띠
        k = 5 if (X // 24 + Y // 6) % 2 == 0 else 4
        if X % 24 in (0, 23): k = 3
        if Y == 11: k = 2
        return CREAM[k]
    if Y < H - 17:                                                            # 판벽(가로 넓은 판, 사각 테)
        px_ = X % 32; py = Y - 12
        k = 4
        if px_ in (0, 31): k = 2
        elif px_ in (1,): k = 5
        g = AK.grain((X * 2) % 48, (Y * 3) % 48) - 3
        if g >= 2: k += 1
        elif g <= -2: k -= 1
        return VARN[clamp(k, 1, 6)]
    ly = Y - (H - 17)
    if ly == 0: return BR[5]
    if ly == 1: return BR[3]
    if ly == 2: return VARN[2]
    if ly >= 14: return VARN[2] if ly < 16 else VARN[1]
    b = X // 4; lx = X % 4
    k = 3 + (1 if _hash(b, 0, 951) < .3 else 0)
    if lx == 3: k = 1
    elif lx == 0: k += 1
    return VARN[clamp(k, 1, 6)]

_CABW = None
def _cab_wall():
    """기관실 벽 앞면 바탕(256×48): 리벳 박은 강철판(미래 폐허 규약 32×16 엇갈림) + 아래 바랜 초록 칠 띠 + 놋쇠 띠."""
    global _CABW
    if _CABW is None:
        tc = TC(256, 48, 7)
        FM.panels(tc, 0, 0, 256, 32, 'steel', base=3, pw=32, ph=16, stagger=True, face='front', seed=7, vary=1)
        FM.panels(tc, 0, 32, 256, 48, 'green', base=3, pw=32, ph=16, stagger=False, face='front', seed=8, vary=1, rivets=False)
        for x in range(256): tc.px(x, 31, 'brass', 4); tc.px(x, 32, 'brass', 2)
        FM.rustify(tc, 0, 0, 256, 32, amount=.25, seed=9)
        _CABW = np.array(tc.img().convert('RGB'))
    return _CABW
def cab_face(X, Y, H):
    a = _cab_wall()
    return tuple(int(v) for v in a[min(47, int(Y * 48 / max(1, H))) if H != 48 else Y, X % 256])

dlib.FACE_BASE['gt_car'] = VARN[3]
dlib.FACE_BASE['gt_cab'] = STEEL[3]
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style == 'gt_car': c = car_face(X, Y, H); ramp = VARN
    elif style == 'gt_cab': c = cab_face(X, Y, H); ramp = STEEL
    else: return _prev_face(style, X, Y, H, seed, capL, capR)
    if Y == 2: c = mul(c, .7)
    elif Y == 3: c = mul(c, .84)
    elif Y == 4: c = mul(c, .93)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .55)
    if capL and X % 16 == 0: c = mix(c, ramp[6], .3)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

def face_sample(style, w=3, h=3):
    return AK.compose_(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))

# ---------------------------------------------------------------- 객차 안 벽 장식
def car_window(seed=0):
    """객차 창 1×3칸(벽 앞면 장식): 놋쇠 틀 속 안개 낀 바깥(희미한 나무 그림자·떠도는 도깨비불), 아래 창턱, 옆에 묶은 커튼."""
    tc = TC(16, 48, seed)
    x0, x1, y0, y1 = 2, 14, 12, 31
    for y in range(y0, y1):
        for x in range(x0, x1):
            edge = x in (x0, x1 - 1) or y in (y0, y1 - 1)
            if edge: tc.px(x, y, 'brass', 4 if (x == x0 or y == y0) else 2); continue
            v = (y - y0) / (y1 - y0)
            k = 5 if v < .3 else (4 if v < .7 else 3)
            tree = vnoise(x * 3 + seed * 7, 0, 3, seed + 3) > .62 and v > .25
            tc.px(x, y, 'fogc', k - (2 if tree else 0))
    tc.px(9, 18, 'ghost', 6); tc.px(8, 18, 'ghost', 5); tc.px(9, 17, 'ghost', 4)
    for x in range(x0 + 1, x1 - 1): tc.px(x, 21, 'brass', 3)                    # 가운데 창살
    for x in range(1, 15): tc.px(x, 31, 'varn', 5); tc.px(x, 32, 'varn', 2)      # 창턱
    for y in range(12, 30):                                                     # 묶은 커튼(오른쪽)
        w = 2 if 18 < y < 22 else 3
        for x in range(14 - w + 1, 16): tc.px(x, y, 'carp', 3 if x < 15 else 2)
    return tc_img(tc)

def luggage_rack(seed=0):
    """짐 선반 3×1칸(벽 앞면 장식, 크림 띠 위): 놋쇠 받침 셋에 걸린 그물 선반 위 가방·모자 상자·우산."""
    tc = TC(48, 16, seed)
    for x in range(0, 48):
        tc.px(x, 11, 'brass', 5); tc.px(x, 12, 'brass', 3); tc.px(x, 14, 'brass', 2)
        if x % 3 == 0: tc.px(x, 13, 'brass', 3)
    for bx in (2, 23, 45):
        for y in range(11, 16): tc.px(bx, y, 'brass', 4)
    suitcase(tc, 3, 4, 13, 7, 2, 'drab', seed)
    suitcase(tc, 18, 6, 9, 5, 2, 'carp', seed + 1)
    for y in range(3, 11):                                                      # 모자 상자
        for x in range(30, 39):
            if y < 5: tc.px(x, y, 'cream', 5 if x < 34 else 4)
            else: tc.px(x, y, 'cream', 4 if x < 33 else 3)
    tc.hline(30, 39, 6, 'carp', 3)
    tc.line(40, 10, 46, 3, 'soot', 3)
    return tc_img(tc)

def car_door(seed=0):
    """객차 끝 문 1×3칸(벽 앞면 장식): 니스칠 문짝 + 서리 유리 창(희미한 푸른 빛) + 놋쇠 손잡이, 문턱."""
    tc = TC(16, 48, seed)
    for y in range(4, 47):
        for x in range(1, 15):
            edge = x in (1, 14) or y == 4
            k = 2 if edge else 4
            if x == 2 and not edge: k = 5
            if x == 13 and not edge: k = 3
            tc.px(x, y, 'varn', k)
    for y in range(7, 21):
        for x in range(4, 12):
            edge = x in (4, 11) or y in (7, 20)
            tc.px(x, y, 'brass' if edge else 'ghost', (4 if (x == 4 or y == 7) else 2) if edge else (3 if y < 12 else 2))
    tc.rect(11, 27, 13, 31, 'brass', 5); tc.px(12, 30, 'brass', 2)
    for (yy) in (24, 36):
        for x in range(4, 12): tc.px(x, yy, 'varn', 3); tc.px(x, yy + 7, 'varn', 5)
    return tc_img(tc)

def swing_lamp(lean=0, seed=0):
    """흔들리는 기름 램프 1×2칸(천장에 매단 위층 물체): 사슬 + 놋쇠 갓 + 유리 등피 속 푸른 불꽃. lean = -1/0/1 흔들린 쪽."""
    tc = TC(16, 32, seed)
    bx = 8 + lean * 3
    for i in range(16):                                                         # 사슬(천장 → 램프)
        x = int(round(8 + (bx - 8) * i / 15)); y = i
        tc.px(x, y, 'brass', 4 if i % 2 else 2)
    for y in range(16, 19):
        for x in range(bx - 4 + (18 - y), bx + 5 - (18 - y)): tc.px(x, y, 'brass', 5 if x < bx else 3)
    for y in range(19, 26):
        for x in range(bx - 3, bx + 4):
            d = math.hypot(x + .5 - bx, y + .5 - 22.5)
            if d < 3.6: tc.px(x, y, 'ghost', 6 if d < 1.2 else (5 if d < 2.4 else 4))
    tc.rect(bx - 2, 26, bx + 3, 28, 'brass', 3); tc.px(bx - 2, 26, 'brass', 5)
    tc.px(bx, 29, 'brass', 2)
    return tc_img(tc)

def seat_bay(table=True, seed=0):
    """마주 보는 좌석 한 칸(3×2칸): 서·동 높은 등받이(윗면 + 남쪽 면) 사이 붉은 벨벳 방석 둘, 가운데 발 디딜 틈,
    table = 북쪽 창 아래 작은 접이 탁자(촛대 받침)."""
    W, H = 48, 32
    tc = TC(W, H, seed)
    def block(x0, x1, fy0, fy1, h, top_mat, face_mat, top_k=5, face_k=3):
        for y in range(fy0 - h, fy1):
            for x in range(x0, x1):
                if y < fy1 - h:                                                 # 윗면
                    k = top_k + (1 if (x == x0 or y == fy0 - h) else 0) - (1 if x >= x1 - 1 else 0)
                    tc.px(x, y, top_mat, clamp(k, 1, 6))
                else:                                                           # 남쪽 면
                    k = face_k + (1 if x == x0 else 0) - (1 if x >= x1 - 1 else 0) - (1 if y == fy1 - 1 else 0)
                    tc.px(x, y, face_mat, clamp(k, 1, 6))
    fy0, fy1 = 10, 31
    # 방석(낮다)
    block(5, 16, fy0, fy1, 4, 'carp', 'carp', 4, 2)
    block(32, 43, fy0, fy1, 4, 'carp', 'carp', 4, 2)
    for (sx0, sx1) in ((5, 16), (32, 43)):                                      # 방석 단추·이음
        for y in (12, 18, 24):
            tc.px((sx0 + sx1) // 2, y, 'carp', 2); tc.px((sx0 + sx1) // 2 + 1, y - 1, 'carp', 5)
    # 등받이(높다): 나무 틀 윗면 + 벨벳 남쪽 면
    block(0, 5, fy0, fy1, 10, 'varn', 'carp', 5, 3)
    block(43, 48, fy0, fy1, 10, 'varn', 'carp', 5, 3)
    for (ex) in (0, 43):
        for y in range(fy1 - 10, fy1): tc.px(ex if ex == 0 else 47, y, 'varn', 2 if ex else 4)
    if table:                                                                   # 북쪽 접이 탁자 + 촛대
        block(19, 29, 4, 12, 7, 'varn', 'varn', 5, 3)
        for y in range(12, 20): tc.px(24, y, 'varn', 2)
        tc.rect(22, 0, 25, 2, 'brass', 4); tc.px(23, -1 if False else 0, 'ghost', 6)
    tc.grain(.03, seed, mats=('carp',))
    return tc_img(tc)

def ghost_passenger(seed=0):
    """앉은 유령 승객 1×2칸(위층 덧그림): 얼굴 없는 반투명 청회 인영 — 둥근 머리, 처진 어깨, 무릎 위 손."""
    tc = TC(16, 32, seed)
    for y in range(32):
        for x in range(16):
            head = ((x + .5 - 8) / 3.4) ** 2 + ((y + .5 - 7) / 3.8) ** 2 <= 1
            body = 11 <= y <= 26 and abs(x + .5 - 8) <= 3.2 + (y - 11) * .28
            if head or body:
                k = 5 if (x < 7 and y < 9) else (4 if x < 9 else 3)
                if body and y > 22: k -= 1
                tc.px(x, y, 'spirit', k, 150 if not head else 175)
    im = tc.img()
    return im

# ---------------------------------------------------------------- 기관실
def backhead(seed=0):
    """보일러 뒤판 4×3칸(기관실 북쪽 벽 장식): 둥근 강철 뒤판, 가운데 열린 화실 문 속 푸른 유령불, 압력계 둘(눈금만),
    수면계 유리관, 가감 밸브 손잡이, 놋쇠 관, 양쪽 위 둥근 안경 창(안개)."""
    W, H = 64, 48
    tc = TC(W, H, seed)
    cx = 32
    for y in range(2, 48):                                                      # 둥근 뒤판(위가 둥근 아치)
        for x in range(4, 60):
            r = math.hypot((x + .5 - cx) / 28.0, (max(0, 26 - y)) / 24.0)
            if r > 1: continue
            k = FM.cyl_k((x - 4 + .5) / 56) - 1
            if y > 40: k -= 1
            tc.px(x, y, 'soot', clamp(k, 1, 6))
    for y in range(4, 46):                                                      # 뒤판 테(리벳)
        for x in range(4, 60):
            r = math.hypot((x + .5 - cx) / 28.0, (max(0, 26 - y)) / 24.0)
            if .9 < r <= 1: tc.px(x, y, 'steel', 4 if x < cx else 2)
            if .9 < r <= .95 and (x + y) % 5 == 0: tc.px(x, y, 'steel', 6)
    # 화실 문(열림): 아치 구멍 속 푸른 불 + 경첩 쪽 문짝
    for y in range(28, 44):
        for x in range(25, 40):
            r = math.hypot((x + .5 - 32.5) / 7.5, (max(0, 32 - y)) / 5.0)
            if r > 1: continue
            if r > .82: tc.px(x, y, 'steel', 3); continue
            fl = vnoise(x, y * 1.6, 3, seed + 3)
            k = 6 if (y > 36 and fl > .45) else (5 if fl > .4 else (4 if y > 32 else 3))
            tc.px(x, y, 'ghost', k)
    for y in range(29, 44):
        for x in range(40, 45): tc.px(x, y, 'steel', 4 if x == 40 else 3)       # 열어 젖힌 문짝
    tc.px(42, 34, 'brass', 5)
    # 압력계 둘
    for (gx, gy) in ((16, 12), (48, 12)):
        for y in range(gy - 6, gy + 7):
            for x in range(gx - 6, gx + 7):
                d = math.hypot(x + .5 - gx, y + .5 - gy)
                if d > 5.8: continue
                if d > 4.6: tc.px(x, y, 'brass', 5 if (x < gx and y < gy) else 3); continue
                tc.px(x, y, 'cream', 6 if d < 3 else 5)
        for i in range(8):
            a = -2.4 + i * .68
            tc.px(int(round(gx - .5 + math.cos(a) * 3.4)), int(round(gy - .5 + math.sin(a) * 3.4)), 'soot', 3)
        tc.line(gx, gy, gx + 2, gy - 3, 'redl', 3)
    # 수면계(세로 유리관)
    for y in range(16, 30):
        tc.px(53, y, 'glass', 5 if y < 22 else 3); tc.px(54, y, 'glass', 4 if y < 22 else 2)
    tc.rect(52, 14, 56, 16, 'brass', 4); tc.rect(52, 30, 56, 32, 'brass', 4)
    # 가감 밸브 손잡이(가운데 위)
    tc.rect(29, 14, 36, 19, 'brass', 3); tc.hline(29, 36, 14, 'brass', 5)
    tc.line(36, 16, 46, 21, 'steel', 5); tc.line(36, 17, 46, 22, 'steel', 2)
    # 놋쇠 관(뒤판을 가로지르는 가는 관 + 밸브)
    FM.pipe_h(tc, 8, 28, 24, 4, mat='brass', step=12)
    FM.pipe_h(tc, 37, 50, 24, 4, mat='brass', step=12)
    for (vx) in (12, 44): tc.rect(vx - 1, 20, vx + 2, 23, 'redl', 4)
    # 안경 창(둥근 앞 창) 둘
    for (wx) in (8, 56):
        for y in range(1, 11):
            for x in range(wx - 5, wx + 6):
                d = math.hypot(x + .5 - wx, y + .5 - 5.5)
                if d > 4.8: continue
                if d > 3.6: tc.px(x, y, 'brass', 4 if (x < wx and y < 5) else 2); continue
                tc.px(x, y, 'fogc', 5 if y < 5 else 4)
    return tc_img(tc)

def cab_coal(seed=0):
    """기관실 석탄 더미 2×2칸: 탄수차 문에서 쏟아진 석탄(덩이마다 빛) + 꽂아 둔 삽."""
    W, H = 32, 28
    tc = TC(W, H, seed)
    for y in range(4, 28):
        for x in range(0, 32):
            top = 4 + 10 * ((x - 16) / 16.0) ** 2 + 3 * vnoise(x, 0, 4, seed + 1)
            if y < top: continue
            cell = _hash(x // 3 + (y // 3) * 7, y // 3, seed + 11)
            k = 2 if cell < .5 else 3
            if x % 3 == 0 and y % 3 == 0: k = 5 if cell > .55 else 4
            if y > 24: k -= 1
            tc.px(x, y, 'coal', clamp(k, 1, 6))
    tc.line(20, 2, 24, 16, 'varn', 4); tc.line(21, 2, 25, 16, 'varn', 2)        # 삽 자루
    tc.rect(23, 15, 29, 21, 'steel', 4); tc.hline(23, 29, 15, 'steel', 5)        # 삽 날
    return tc_img(tc)

def driver_seat(seed=0):
    """기관사 접이 의자 1×1칸: 벽 쇠 받침 위 둥근 나무 앉는 판."""
    tc = TC(16, 16, seed)
    for y in range(3, 10):
        for x in range(2, 14):
            dx = (x + .5 - 8) / 6; dy = (y + .5 - 6.5) / 3.4
            if dx * dx + dy * dy <= 1: tc.px(x, y, 'varn', 5 if (dx < 0 and dy < 0) else 4)
    for x in range(3, 13): tc.px(x, 10, 'varn', 2)
    vpost(tc, 7, 11, 16, 2, 'soot', 3)
    tc.line(4, 15, 7, 11, 'soot', 3)
    return tc_img(tc)

def brake_stand(seed=0):
    """제동 손잡이 기둥 1×2칸: 쇠 기둥 + 위에서 본 놋쇠 손바퀴(바퀴살 넷)."""
    tc = TC(16, 30, seed)
    tc.rect(4, 26, 12, 30, 'soot', 3); tc.hline(4, 12, 26, 'soot', 4)
    vpost(tc, 7, 9, 26, 2, 'soot', 4)
    for y in range(2, 11):
        for x in range(1, 15):
            dx = (x + .5 - 8) / 6.5; dy = (y + .5 - 6) / 3.6
            d = dx * dx + dy * dy
            if .55 < d <= 1: tc.px(x, y, 'brass', 5 if dy < 0 else 3)
            elif d <= .55 and (abs(dx) < .18 or abs(dy) < .25): tc.px(x, y, 'brass', 4)
    return tc_img(tc)

def reverser(seed=0):
    """역전기 손잡이 1×2칸: 톱니 반원 틀 위로 비스듬히 선 긴 손잡이(놋쇠 쥐개)."""
    tc = TC(16, 30, seed)
    tc.rect(3, 22, 13, 30, 'soot', 3); tc.hline(3, 13, 22, 'soot', 4)
    for i in range(9):                                                          # 톱니 반원
        a = math.pi + i * math.pi / 8
        tc.px(int(round(8 + math.cos(a) * 5)), int(round(22 + math.sin(a) * 4)), 'steel', 4)
    tc.line(8, 22, 12, 4, 'steel', 5); tc.line(9, 22, 13, 4, 'steel', 2)
    tc.rect(11, 1, 15, 5, 'brass', 5)
    return tc_img(tc)
