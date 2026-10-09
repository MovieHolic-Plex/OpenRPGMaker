# 사막 필드 소품·식생 — 대추야자, 우물, 상인 천막, 낙타 쉼터, 선인장, 마른 덤불, 뼈, 바위, 모래 언덕 능선, 발굴터.
# px2.C 볼륨 페인터(픽셀 법선 + 재질 결, 7단 램프) + 손 좌표. 3/4 시점(윗면+앞면), 빛 왼쪽 위, pz.fin 윤곽. 결정적.
import math
from PIL import Image
import dp_art as A
from dp_art import SS, SA, BR, sash, mix, mul, hx, PAL
import pz
from px2 import _hash, C
from dp_pyr import _put, _h, _sand_heap, _block, SHADOW

def F(c): return pz.fin(c)
def RP(m): return [hx(v) for v in PAL[m]]

def _gshadow(im, cx, cy, rx, ry, a=80):
    p = im.load(); W, H = im.size
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if 0 <= x < W and 0 <= y < H and ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and p[x, y][3] == 0:
                p[x, y] = SHADOW + (a,)
    return im

# ================================================================ 대추야자
def _palm(W, H, base, height, lean, fronds, seed, trunk_w=4):
    """줄기: 마디(3px마다 어두운 띠) 굽은 줄기, 왼쪽 밝게. 잎: 꼭대기에서 퍼지는 깃털 잎(리브 + 아래로 처진 잎 띠),
    왼쪽 위 잎 밝게, 아래·오른쪽 잎 어둡게. 대추 송이(갈색 알)."""
    c = C(W, H, seed=seed)
    bx, by = base
    pts = []
    for i in range(height + 1):
        f = i / height
        pts.append((bx + lean * f * f, by - i))
    c.group(1); c.new()
    for i, (x, y) in enumerate(pts):
        w3 = trunk_w + (1 if i < 3 else 0)
        for k in range(w3):
            xi = int(round(x - w3 / 2 + k))
            t = 6 if k == 0 else (5 if k == 1 else (4 if k < w3 - 1 else 2))
            if i % 3 == 0: t -= 1
            c.tone(xi, int(y), 'bark', max(1, t))
    fx, fy = pts[-1]
    c.group(2)
    order = sorted(fronds, key=lambda f: -math.sin(math.radians(f[0])))     # 뒤(위쪽) 잎 먼저
    for (a, L, dr) in order:
        c.new()
        ar = math.radians(a); dx, dy = math.cos(ar), math.sin(ar)
        back = dy < -0.3
        for s_ in range(L):
            t = s_ / L
            x = fx + dx * s_; y = fy + dy * s_ * 0.6 + dr * t * t * 1.6
            if s_ > 1 and s_ % 3 == 0:                      # 깃털 잎 끝(리브 위로 짧은 잎)
                c.tone(int(round(x)), int(round(y)) - 1, 'palm', 6 if (dx < 0.2 or dy < -0.5) else 4)
            lit = (dx < 0.2 and not back) or dy < -0.6
            base_t = (5 if lit else 3) if not back else 4
            c.tone(int(round(x)), int(round(y)), 'palm', base_t + (1 if s_ < 3 else 0))
            # 잎 띠: 리브 아래로 1~3px 늘어진 잎(끝으로 갈수록 짧다)
            hang = int(round((1 - t) * 3.4 + 1.0))
            for k in range(1, hang + 1):
                tt = base_t - (1 if k > 1 else 0) - (1 if (s_ + k) % 3 == 0 else 0)
                c.tone(int(round(x)), int(round(y)) + k, 'palm', max(1, tt))
    # 대추 송이
    c.group(3); c.new()
    for (ox, oy) in ((-3, 3), (-2, 4), (2, 3), (3, 4), (-1, 5), (1, 5)):
        c.tone(int(fx) + ox, int(fy) + oy, 'cloth', 3 if ox > 0 else 4)
    c.tone(int(fx), int(fy) - 1, 'palm', 6)
    im = F(c)
    return _gshadow(im, bx + 3, by + 0.5, 6, 1.8, 90)

FR_A = [(-172, 21, 10), (-150, 22, 8), (-122, 16, 5), (-95, 11, 2), (-65, 16, 5), (-36, 22, 8), (-8, 21, 10), (24, 16, 9), (156, 16, 9), (80, 9, 6), (110, 9, 6)]
FR_B = [(-176, 19, 9), (-146, 19, 7), (-110, 13, 3), (-75, 14, 4), (-40, 19, 7), (-8, 19, 9), (28, 14, 8), (150, 14, 8), (95, 8, 5)]

def palm_tall():
    """키 큰 대추야자(3x5칸): 살짝 오른쪽으로 굽은 마디 줄기, 깃털 잎 열 갈래, 대추 송이. 밑동 1칸만 막힘."""
    return _palm(48, 80, (22, 76), 50, 4, FR_A, 501)

def palm_lean():
    """기운 대추야자(3x5칸): 물가 쪽으로 크게 기운 줄기(왼쪽), 잎이 한쪽으로 쏠렸다."""
    return _palm(48, 80, (32, 76), 44, -12, FR_B, 502)

def palm_short():
    """작은 대추야자(3x4칸): 짧고 굵은 줄기, 낮게 퍼진 잎. 큰 야자 사이 덩이를 채운다."""
    return _palm(48, 64, (24, 60), 26, 2, FR_B, 503, trunk_w=5)

def palm_young():
    """어린 야자 덤불(2x2칸): 줄기 없이 땅에서 바로 퍼지는 잎 뭉치(뒤 잎 어둡고 앞·왼쪽 잎 밝게). 물가·우물 곁."""
    c = C(32, 32, seed=504)
    fx, fy = 16, 24
    fr = [(-150, 12, 2, 3), (-120, 13, 1, 3), (-90, 12, 0, 3), (-60, 13, 1, 3), (-30, 12, 2, 3),
          (-170, 14, 5, 5), (-140, 14, 4, 5), (-105, 12, 2, 5), (-75, 12, 2, 4), (-40, 14, 4, 4), (-10, 14, 5, 4), (175, 10, 5, 5), (10, 10, 5, 4)]
    for (a, L, dr, bt) in fr:
        c.new(); ar = math.radians(a); dx, dy = math.cos(ar), math.sin(ar)
        for s_ in range(L):
            t = s_ / L; x = fx + dx * s_; y = fy + dy * s_ * 0.85 + dr * t * t * 1.4
            tt = bt + (1 if dx < -0.3 else 0) - (1 if dx > 0.4 else 0)
            c.tone(int(round(x)), int(round(y)), 'palm', min(6, tt + (1 if s_ % 3 == 0 else 0)))
            for k in range(1, int((1 - t) * 2.4 + 1.5)):
                c.tone(int(round(x)), int(round(y)) + k, 'palm', max(1, tt - k))
    im = F(c)
    return _gshadow(im, 17, 28, 11, 2.4, 80)

def reeds():
    """물가 갈대(1칸): 가는 잎과 이삭, 왼쪽 잎 밝게. 오아시스 못 가장자리 덩이로."""
    c = C(16, 24, seed=511)
    for (x0, hgt, lean, t) in ((3, 16, -2, 5), (6, 20, 0, 4), (9, 17, 2, 4), (12, 13, 3, 3), (5, 11, -3, 5), (10, 10, 1, 3)):
        c.new()
        for j in range(hgt):
            x = x0 + lean * (j / hgt) ** 2
            c.tone(int(round(x)), 23 - j, 'reed', t if j < hgt - 3 else t + 1)
        c.tone(int(round(x0 + lean)), 23 - hgt, 'dry', 4); c.tone(int(round(x0 + lean)), 24 - hgt, 'dry', 3)
    return F(c)

# ================================================================ 우물·물통
def well():
    """오아시스 돌우물(2x3칸): 사암 둥근 테(윗면 밝게, 안쪽 어두운 물), 나무 두 기둥 + 가로대, 도르래·밧줄·두레박."""
    W, H = 32, 48
    c = C(W, H, seed=521)
    c.shadow(17, 45, 14, 2.6, 90)
    c.group(1); c.cylinder(16, 33, 43, 13, 'sstone', capry=5.5, amb=0.22)
    c.group(2); c.new()
    for y in range(29, 38):                     # 안쪽 물
        for x in range(5, 28):
            if ((x + 0.5 - 16) / 10.0) ** 2 + ((y + 0.5 - 33) / 3.6) ** 2 <= 1:
                c.tone(x, y, 'oasis', 1 if y < 32 else (2 if x > 18 else 3))
    c.tone(11, 33, 'oasis', 5); c.tone(12, 33, 'oasis', 4)
    for x in range(3, 30):                      # 테 돌 줄눈
        if x % 6 == 0:
            for y in range(37, 44):
                if c.m[y][x] == 'sstone': c.tone(x, y, 'sstone', 2)
    for y in range(40, 41):
        for x in range(3, 30):
            if c.m[y][x] == 'sstone': c.tone(x, y, 'sstone', 3)
    c.group(3); c.new()
    for y in range(6, 38):                      # 기둥 둘
        c.tone(4, y, 'wood', 5); c.tone(5, y, 'wood', 3)
        c.tone(27, y, 'wood', 4); c.tone(28, y, 'wood', 2)
    c.new()
    for x in range(2, 31):                      # 가로대
        c.tone(x, 6, 'wood', 6 if x < 16 else 5); c.tone(x, 7, 'wood', 4); c.tone(x, 8, 'wood', 2)
    c.new(); c.ellipsoid(16, 11, 3, 3, 'wood', amb=0.3)        # 도르래
    c.new()
    for y in range(12, 25): c.tone(16, y, 'rope', 4)
    c.new(); c.box(13, 24, 7, 2, 5, 'wood', top=0.9, front=0.55)   # 두레박
    c.tone(13, 26, 'iron', 3); c.tone(19, 26, 'iron', 3)
    return F(c)

def trough():
    """돌 물통(2x1칸): 낙타·말에 물 먹이는 사암 구유, 윗면 테 안쪽에 물."""
    W, H = 32, 16
    c = C(W, H, seed=531); c.shadow(16, 14, 15, 1.5, 80)
    c.new(); c.box(1, 3, 30, 5, 7, 'sstone', top=0.95, front=0.58)
    c.new()
    for y in range(5, 8):
        for x in range(4, 28): c.tone(x, y, 'oasis', 2 if y == 5 else (4 if x < 10 else 3))
    c.tone(6, 6, 'oasis', 6)
    return F(c)

# ================================================================ 천막
def _poly(c, pts, fn):
    ys = [p[1] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        xs = []
        for i in range(len(pts)):
            (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
            if (y1 <= y + 0.5 < y2) or (y2 <= y + 0.5 < y1): xs.append(x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(int(round(a)), int(round(b))): fn(x, y)

def _goods(c, x0, x1, y, seed):
    """좌판 위 물건: 항아리·천 두루마리·과일 바구니·향신료 더미가 번갈아."""
    x = x0
    k = 0
    while x < x1 - 3:
        kind = int(_hash(k, 1, seed) * 4)
        if kind == 0:   # 항아리
            c.new(); c.ellipsoid(x + 2, y - 2.5, 2.4, 3, 'cloth', amb=0.3); c.tone(x + 2, y - 6, 'cloth', 2); x += 6
        elif kind == 1:  # 천 두루마리
            m = ('indigo', 'red', 'teal')[k % 3]
            c.new(); c.hcyl(x, x + 5, y - 2, 2.2, m, amb=0.3, endcap='L', capmat=m); x += 7
        elif kind == 2:  # 과일 바구니
            c.new(); c.box(x, y - 3, 6, 1, 3, 'rope', top=0.9, front=0.55)
            for i in range(3): c.tone(x + 1 + i * 2, y - 4, 'red' if i % 2 else 'gold', 5)
            x += 7
        else:            # 향신료 더미
            m = ('gold', 'red', 'cloth')[k % 3]
            c.new(); c.ellipsoid(x + 3, y - 1.5, 3, 2, m, amb=0.3, bias=0.05); x += 7
        k += 1

def merchant_tent(stripe=('red', 'cream'), W=64, seed=541):
    """상인 천막: 네 기둥 위 줄무늬 차양(윗면이 보이게 앞으로 처진 지붕, 끝단 물결 술), 아래 나무 좌판 + 물건, 뒤 천벽."""
    H = 48
    c = C(W, H, seed=seed)
    c.shadow(W / 2 + 2, H - 3, W / 2 - 2, 3, 80)
    m1, m2 = stripe
    # 뒤 천벽(그늘진 안쪽)
    c.group(1); c.new()
    for y in range(14, 38):
        for x in range(4, W - 4): c.tone(x, y, m2, 2 if y > 20 else 3)
    # 좌판(나무): 윗면 + 앞면
    c.group(2); c.new(); c.box(5, 32, W - 10, 3, 9, 'wood', top=0.92, front=0.5)
    for x in range(8, W - 8, 10):
        for y in range(36, 44): c.tone(x, y, 'wood', 2)
    _goods(c, 7, W - 7, 33, seed)
    # 기둥
    c.group(3); c.new()
    for (x, y0) in ((3, 10), (W - 5, 10)):
        for y in range(y0, 45): c.tone(x, y, 'wood', 5); c.tone(x + 1, y, 'wood', 3)
    # 차양: 윗면(위에서 보이는 줄무늬, 뒤쪽 높고 앞쪽 낮다) + 앞 술
    c.group(4); c.new()
    for y in range(2, 16):
        for x in range(1, W - 1):
            band = ((x - 1) // 6) % 2
            mat = m1 if band == 0 else m2
            t = 5 if y < 6 else (4 if y < 12 else 3)
            if x < 6: t += 1
            if x > W - 6: t -= 1
            c.tone(x, y, mat, max(1, min(6, t)))
    for x in range(1, W - 1):                   # 물결 술
        band = ((x - 1) // 6) % 2
        dip = 2 if (x % 6) in (2, 3) else (1 if (x % 6) in (1, 4) else 0)
        for y in range(16, 17 + dip): c.tone(x, y, m1 if band == 0 else m2, 3)
    im = F(c)
    return im

def merchant_tent_a(): return merchant_tent(('red', 'cream'), 64, 541)
def merchant_tent_b(): return merchant_tent(('indigo', 'cream'), 48, 542)

def nomad_tent():
    """유목민 검은 천막(5x3칸): 낮은 봉우리 셋인 염소털 천막, 앞이 걷혀 안쪽 깔개와 방석이 보인다, 버팀줄과 말뚝."""
    W, H = 80, 48
    c = C(W, H, seed=551)
    c.shadow(41, 44, 37, 3.4, 90)
    c.group(1); c.new()
    for y in range(18, 40):                     # 안쪽 그늘 + 깔개
        for x in range(8, W - 8):
            if y > 30: c.tone(x, y, 'red', 3 if (x // 3 + y) % 4 else 4)
            else: c.tone(x, y, 'wool', 1)
    for x in range(10, W - 10):
        c.tone(x, 31, 'gold', 4 if x % 4 else 5)
    for (x0, m) in ((14, 'indigo'), (30, 'teal'), (50, 'gold')):   # 방석
        c.new(); c.ellipsoid(x0 + 5, 33, 5, 2.5, m, amb=0.3)
    # 지붕: 봉우리 셋, 처진 천
    c.group(2); c.new()
    peaks = [(16, 6), (40, 3), (64, 6)]
    for x in range(2, W - 2):
        yt = 20
        for (px_, py_) in peaks:
            yt = min(yt, py_ + abs(x - px_) * 0.42 + 3.2 * math.sin(abs(x - px_) * 0.2) ** 2)
        for y in range(int(yt), 20):
            v = (y - yt) / max(1, 20 - yt)
            t = 4 if v < 0.25 else 3
            if x < 20: t += 1
            if (x % 8) == 0: t -= 1
            c.tone(x, y, 'wool', max(1, t))
    for x in range(2, W - 2):                   # 앞 처마(걷어 올린 자락)
        c.tone(x, 20, 'wool', 2); c.tone(x, 21, 'wool', 3 if x % 5 else 2)
    c.group(3); c.new()
    for (x) in (6, 40, 74):
        for y in range(20, 42): c.tone(x, y, 'wood', 4); c.tone(x + 1, y, 'wood', 2)
    im = F(c); p = im.load()
    RO = RP('rope')
    for (x0, y0, x1, y1) in ((3, 16, 0, 40), (77, 16, 79, 40)):
        n = 26
        for i in range(n):
            x = int(round(x0 + (x1 - x0) * i / n)); y = int(round(y0 + (y1 - y0) * i / n))
            _put(p, W, H, x, y, RO[3])
    return im

def dig_tent():
    """발굴대 천막(3x3칸): 누런 캔버스 삼각 천막, 앞이 열려 안에 상자와 등이 보인다. 피라미드 앞 발굴터."""
    W, H = 48, 48
    c = C(W, H, seed=561); c.shadow(25, 44, 21, 3, 80)
    c.group(1); c.new()
    _poly(c, [(24, 6), (6, 40), (42, 40)], lambda x, y: c.tone(x, y, 'canvas', 4 if x < 24 else 3))
    c.new()
    _poly(c, [(24, 16), (14, 40), (34, 40)], lambda x, y: c.tone(x, y, 'canvas', 1 if abs(x - 24) < 2 + (y - 16) * 0.3 else 2))
    c.new(); c.box(18, 33, 8, 2, 5, 'wood', top=0.9, front=0.55)
    c.new(); c.tone(28, 34, 'fire', 5); c.tone(28, 35, 'fire', 4); c.tone(28, 33, 'iron', 3)
    for y in range(17, 41):                     # 펄럭이는 입구 자락
        c.tone(int(24 - 2 - (y - 16) * 0.42), y, 'canvas', 6); c.tone(int(24 + 2 + (y - 16) * 0.42), y, 'canvas', 3)
    c.group(2); c.new()
    for x in range(6, 43): c.tone(x, 40, 'canvas', 2)
    c.tone(24, 4, 'wood', 4); c.tone(24, 5, 'wood', 4)
    im = F(c); p = im.load(); RO = RP('rope')
    for i in range(14):
        _put(p, W, H, 6 - i // 3, 30 + i, RO[3]); _put(p, W, H, 42 + i // 3, 30 + i, RO[2])
    return im

# ================================================================ 낙타·쉼터
def camel_lying():
    """엎드린 낙타(2x2칸): 다리를 접고 배를 땅에 댄 채 쉬는 낙타(옆모습, 왼쪽 보기). 몸 위 혹과 깔개, 앞으로 뻗은 목과 고개."""
    W, H = 32, 32
    c = C(W, H, seed=571); c.shadow(17, 29, 14, 2.2, 90)
    c.group(1)
    c.new(); c.ellipsoid(19, 23, 11.5, 5.2, 'camel', amb=0.22)                 # 몸(납작)
    c.new(); c.ellipsoid(20, 17, 6.5, 4.2, 'camel', amb=0.24, bias=0.03)       # 혹
    c.new()
    for i in range(9):                                                       # 목: 몸 앞에서 앞으로 나갔다가 위로
        x = 10 - i * 0.7; y = 22 - i * (0.6 if i < 3 else 1.9)
        c.ellipsoid(x, y, 2.9, 2.6, 'camel', amb=0.25, bias=0.03)
    c.new(); c.ellipsoid(4.2, 7.5, 4.0, 2.8, 'camel', amb=0.28, bias=0.06)     # 머리
    c.tone(1, 8, 'camel', 1); c.tone(4, 6, 'camel', 1); c.tone(6, 4, 'camel', 3); c.tone(6, 5, 'camel', 4)
    c.group(2); c.new()
    for x in range(14, 27):                                                  # 깔개
        for y in range(15, 20):
            if c.m[y][x]: c.tone(x, y, 'red' if (x // 3) % 2 else 'indigo', 4 if y < 17 else 3)
    for x in range(14, 27):
        if c.m[20][x]: c.tone(x, 20, 'gold', 4)
    c.group(3); c.new()
    for (x0) in (9, 24):                                                     # 접은 앞·뒷다리(배 밑)
        for x in range(x0, x0 + 6): c.tone(x, 27, 'camel', 4 if x < x0 + 3 else 3); c.tone(x, 28, 'camel', 2)
    return F(c)

def camel_standing():
    """서 있는 낙타(3x2칸): 짐 싣는 안장(줄무늬 자루 두 개), 긴 다리 넷, 목을 든 옆모습(왼쪽 보기)."""
    W, H = 48, 40
    c = C(W, H, seed=581); c.shadow(26, 37, 16, 2.2, 90)
    c.group(1)
    for (lx, t) in ((15, 4), (19, 3), (33, 4), (37, 3)):                         # 다리
        c.new()
        for y in range(22, 37): c.tone(lx, y, 'camel', t); c.tone(lx + 1, y, 'camel', t - 1)
        c.tone(lx, 37, 'camel', 1); c.tone(lx + 1, 37, 'camel', 1)
    c.new(); c.ellipsoid(27, 19, 14, 6.5, 'camel', amb=0.22)
    c.new(); c.ellipsoid(27, 12, 7, 5, 'camel', amb=0.24, bias=0.03)
    c.new()
    for i in range(11):
        x = 13 - i * 0.6; y = 18 - i * 1.15
        c.ellipsoid(x, y, 2.6, 2.3, 'camel', amb=0.25, bias=0.02)
    c.new(); c.ellipsoid(6, 5.5, 4, 2.8, 'camel', amb=0.28, bias=0.05); c.tone(3, 5, 'camel', 1)
    c.new(); c.ellipsoid(40, 17, 1.5, 4, 'camel', amb=0.3)                       # 꼬리
    c.group(2)
    for (bx, m) in ((17, 'teal'), (31, 'red')):                                # 짐 자루
        c.new(); c.ellipsoid(bx + 3, 17, 4.5, 5.5, m, amb=0.25)
        for y in range(12, 23):
            if c.m[y][bx + 3] == m and y % 3 == 0:
                for x in range(bx, bx + 7):
                    if c.m[y][x] == m: c.tone(x, y, 'cream', 4)
    c.new()
    for x in range(20, 35): c.tone(x, 9, 'rope', 4); c.tone(x, 10, 'red', 3)
    return F(c)

def hitch_rail():
    """낙타 매는 말뚝 난간(3x1칸): 기둥 셋에 가로대, 매어 놓은 밧줄 고리."""
    W, H = 48, 16
    c = C(W, H, seed=591); c.shadow(24, 14.5, 22, 1.3, 70)
    for x0 in (3, 22, 42):
        c.new()
        for y in range(2, 14): c.tone(x0, y, 'wood', 5); c.tone(x0 + 1, y, 'wood', 3)
        c.tone(x0, 1, 'wood', 6); c.tone(x0 + 1, 1, 'wood', 4)
    c.new()
    for x in range(2, 46): c.tone(x, 4, 'wood', 5); c.tone(x, 5, 'wood', 4); c.tone(x, 6, 'wood', 2)
    for x in (10, 30):
        for y in range(7, 11): c.tone(x + (y % 2), y, 'rope', 4)
    return F(c)

def cargo_pile():
    """짐 더미(2x1칸): 줄무늬 짐 자루·둥근 꾸러미·작은 상자, 밧줄로 묶였다. 낙타 쉼터·천막 곁."""
    W, H = 32, 16
    c = C(W, H, seed=601); c.shadow(16, 14, 15, 1.6, 80)
    c.new(); c.box(18, 4, 11, 3, 8, 'wood', top=0.92, front=0.55)
    c.new(); c.ellipsoid(10, 9, 8, 5, 'teal', amb=0.25)
    for x in range(3, 18):
        if c.m[7][x] == 'teal': c.tone(x, 7, 'cream', 4)
        if c.m[11][x] == 'teal': c.tone(x, 11, 'cream', 3)
    c.new(); c.ellipsoid(24, 4, 5, 3, 'red', amb=0.3)
    for y in range(2, 14): c.tone(23, y, 'rope', 4) if c.m[y][23] else None
    return F(c)

def jars():
    """물 항아리 둘(1칸): 흙빛 큰 항아리와 작은 항아리, 입구 테."""
    c = C(16, 24, seed=611); c.shadow(8, 22, 7.5, 1.5, 80)
    c.new(); c.ellipsoid(6, 15, 5, 6.5, 'cloth', amb=0.25); c.new(); c.ellipsoid(6, 8, 2.6, 1.2, 'cloth', amb=0.4, bias=0.1)
    c.tone(5, 8, 'cloth', 1); c.tone(6, 8, 'cloth', 1)
    c.new(); c.ellipsoid(12, 18, 3.4, 4, 'sstone', amb=0.25); c.tone(12, 14, 'sstone', 1)
    for x in range(2, 11):
        if c.m[13][x]: c.tone(x, 13, 'cloth', 2)
    return F(c)

def crates():
    """나무 상자 더미(2x2칸): 큰 상자 둘 위에 작은 상자, 널빤지·쇠띠. 발굴터·천막 곁."""
    W, H = 32, 32
    c = C(W, H, seed=621); c.shadow(16, 30, 15, 1.6, 80)
    for (x0, y0, w, d, h) in ((2, 15, 14, 4, 11), (16, 16, 13, 4, 10), (8, 5, 12, 4, 9)):
        c.new(); c.box(x0, y0, w, d, h, 'wood', top=0.92, front=0.52)
        for x in range(x0, x0 + w):
            c.tone(x, y0 + d + h // 2, 'wood', 2)
        for y in range(y0 + d, y0 + d + h): c.tone(x0 + w // 2, y, 'wood', 3)
        c.tone(x0 + 1, y0 + d + 1, 'iron', 4); c.tone(x0 + w - 2, y0 + d + 1, 'iron', 3)
    return F(c)

def rug():
    """깔개(2x1칸, 걷는 장식): 붉은 바탕에 쪽빛·금빛 테두리 무늬 깔개, 끝에 술."""
    W, H = 32, 16
    o = Image.new('RGBA', (W, H)); p = o.load()
    R_, I_, G_ = RP('red'), RP('indigo'), RP('gold')
    for y in range(3, 14):
        for x in range(2, 30):
            u, v = x - 2, y - 3
            if u in (0, 27) or v in (0, 10): c = I_[3]
            elif u in (1, 26) or v in (1, 9): c = G_[4]
            elif (u + v) % 6 == 0 or (u - v) % 6 == 0: c = G_[3] if 4 < u < 23 else R_[3]
            else: c = R_[4] if (u + v) % 2 else R_[3]
            p[x, y] = c + (255,)
    for y in range(3, 14, 2): p[1, y] = G_[5] + (255,); p[30, y] = G_[4] + (255,)
    return o

# ================================================================ 사막 식생
def cactus_column():
    """기둥 선인장(1x2칸): 세로 골(밝은 골·어두운 골 번갈아), 가시 점, 꼭대기 꽃눈. 모래 위 홀로·작은 덩이."""
    W, H = 16, 32
    c = C(W, H, seed=631); c.shadow(9, 30, 5, 1.3, 80)
    c.new(); c.cylinder(8, 6, 29, 4.6, 'cactus', capry=2.2, amb=0.25)
    for y in range(6, 29):
        for x in (6, 9):
            if c.m[y][x]: c.tone(x, y, 'cactus', 3)
        if y % 4 == 0:
            for x in (4, 8, 11):
                if c.m[y][x]: c.tone(x, y, 'cream', 5)
    c.tone(8, 3, 'red', 5); c.tone(7, 4, 'red', 4)
    return F(c)

def cactus_branch():
    """가지 선인장(2x3칸): 굵은 몸통에 좌우로 꺾여 올라간 팔 둘, 세로 골·가시. 바위 곁 사막 길잡이."""
    W, H = 32, 48
    c = C(W, H, seed=641); c.shadow(17, 46, 7, 1.6, 90)
    c.group(1); c.new(); c.cylinder(16, 8, 45, 5, 'cactus', capry=2.4, amb=0.25)
    c.group(2); c.new()
    c.hcyl(5, 12, 26, 2.8, 'cactus', amb=0.25); c.new(); c.cylinder(6, 14, 26, 3, 'cactus', capry=1.6, amb=0.25)
    c.group(3); c.new()
    c.hcyl(20, 26, 20, 2.6, 'cactus', amb=0.25); c.new(); c.cylinder(26, 10, 20, 2.8, 'cactus', capry=1.5, amb=0.25)
    for y in range(8, 45):
        for x in (14, 17):
            if c.m[y][x] == 'cactus': c.tone(x, y, 'cactus', 3)
        if y % 4 == 1:
            for x in (11, 16, 20, 4, 8, 24, 28):
                if 0 <= x < W and c.m[y][x]: c.tone(x, y, 'cream', 5)
    return F(c)

def cactus_barrel():
    """통 선인장(1칸): 둥근 통 모양, 세로 골, 꼭대기 붉은 꽃."""
    c = C(16, 16, seed=651); c.shadow(8, 14, 6, 1.3, 80)
    c.new(); c.ellipsoid(8, 9, 5.5, 5, 'cactus', amb=0.25)
    for y in range(4, 14):
        for x in (5, 8, 11):
            if c.m[y][x]: c.tone(x, y, 'cactus', 3)
    c.tone(7, 4, 'red', 5); c.tone(8, 4, 'red', 4); c.tone(8, 3, 'gold', 5)
    return F(c)

def scrub():
    """마른 덤불(1칸): 잎 거의 없는 잿빛 갈색 잔가지 뭉치(뒤 가지 어둡고 앞·왼쪽 가지 밝게), 끝에 마른 잎 몇. 바위 곁·길가."""
    c = C(16, 16, seed=661); c.shadow(8, 14.5, 7, 1.3, 70)
    for layer, (n, rad, tb) in enumerate(((7, 6.5, 4), (8, 5.5, 5))):
        for i in range(n):
            a = math.radians(-170 + i * 160 / (n - 1) + layer * 7); L = rad * (0.7 + _hash(i, layer, 661) * 0.35)
            c.new()
            for s_ in range(int(L) + 1):
                x = 8 + math.cos(a) * s_; y = 14 + math.sin(a) * s_ * 0.85
                t = tb + (1 if math.cos(a) < -0.2 else 0) - (1 if math.cos(a) > 0.4 else 0)
                c.tone(int(round(x)), int(round(y)), 'dry', max(1, min(6, t)))
            ex = int(round(8 + math.cos(a) * L)); ey = int(round(14 + math.sin(a) * L * 0.85))
            c.tone(ex, ey, 'dry', 6 if math.cos(a) < 0 else 4)
            if _hash(i, 9, 661) > 0.6: c.tone(ex, ey - 1, 'reed', 4)
    return c.img(False)

def dry_tuft():
    """마른 풀 포기(1칸, 걷는 장식): 누런 풀잎 몇 가닥. 모래·암반 가장자리에 덩이로."""
    o = Image.new('RGBA', (16, 16)); p = o.load(); D = RP('dry')
    for (x0, hgt, lean) in ((5, 6, -2), (7, 8, -1), (8, 7, 1), (10, 5, 2), (6, 4, -3), (11, 3, 3)):
        for j in range(hgt):
            x = int(round(x0 + lean * (j / hgt) ** 1.5)); y = 14 - j
            p[x, y] = (D[5] if lean < 0 else D[3]) + (255,)
        p[int(round(x0 + lean)), 14 - hgt] = D[6 if lean < 0 else 4] + (255,)
    for x in range(4, 13): p[x, 15] = SHADOW + (60,)
    return o

def tumbleweed():
    """굴러온 회전초(1칸, 걷는 장식): 마른 가지가 엉킨 공(가지 사이로 바닥이 비친다), 바람 맞는 쪽(왼쪽 위) 밝다."""
    c = C(16, 16, seed=671); c.shadow(8, 14.2, 6, 1.2, 60)
    for i in range(26):
        a = _hash(i, 1, 671) * 6.283; r = 2 + _hash(i, 2, 671) * 4
        x = 8 + math.cos(a) * r; y = 9 + math.sin(a) * r * 0.9
        x2 = 8 + math.cos(a + 1.2) * r * 0.8; y2 = 9 + math.sin(a + 1.2) * r * 0.75
        c.new(); c.line(x, y, x2, y2, 'dry', 6 if (x < 8 and y < 9) else 4)
    return c.img(False)

# ================================================================ 뼈·바위
def skull():
    """뿔 달린 짐승 머리뼈(1칸, 걷는 장식): 모래에 반쯤 묻힌 소·영양 머리뼈, 굽은 뿔 둘."""
    o = Image.new('RGBA', (16, 16)); p = o.load(); B = RP('bone')
    rows = ["..1..........1..", ".12..........21.", ".13...1111...31.", "..34.155541.43..", "...4155565514...",
            "....15665551....", "....15355351....", ".....155551.....", ".....145541.....", "......1441......", ".......11......."]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.': p[i, j + 3] = B[int(ch)] + (255,)
    for x in range(4, 13): p[x, 14] = SA[5] + (255,) if x % 3 else SA[4] + (255,)
    return o

def ribcage():
    """짐승 갈비뼈(2x1칸): 모래 위로 솟은 굽은 갈비 줄, 등뼈. 낙타 길가·사막 깊은 곳."""
    W, H = 32, 16
    o = Image.new('RGBA', (W, H)); p = o.load(); B = RP('bone')
    for x in range(3, 29): _put(p, W, H, x, 12, B[3]); _put(p, W, H, x, 11, B[5] if x % 3 else B[4])
    for k, x0 in enumerate(range(6, 27, 4)):
        hgt = 8 - abs(k - 2) * 1
        for j in range(hgt):
            x = x0 - int(j * 0.35); y = 11 - j
            _put(p, W, H, x, y, B[5]); _put(p, W, H, x + 1, y, B[3])
    im = pz.fin(o); q = im.load()
    for x in range(2, 30): _put(q, W, H, x, 13, SA[3]); _put(q, W, H, x, 14, SA[4]) if x % 2 else None
    return im

def sand_boulder():
    """사암 바위(2x2칸): 바람에 깎여 둥근 사암 덩이, 가로 결(지층) 두 줄, 밑에 모래가 쌓였다."""
    W, H = 32, 32
    c = C(W, H, seed=681); c.shadow(17, 28, 14, 2.4, 90)
    c.new(); c.ellipsoid(16, 19, 14, 9.5, 'sstone', amb=0.2, bump=0.45, bsc=3.4)
    c.new(); c.ellipsoid(11, 15, 7, 5, 'sstone', amb=0.22, bias=0.08, bump=0.4)
    for (y0, a) in ((19, 0.6), (24, 0.4)):
        for x in range(3, 30):
            y = int(y0 + math.sin(x / 5.0) * 0.8)
            if c.m[y][x] == 'sstone' and _hash(x, y0, 681) < 0.8: c.tone(x, y, 'sstone', 2)
    im = F(c); p = im.load()
    _sand_heap(p, W, H, 8, 30, 8, 3, 683)
    return im

def rock_spire():
    """바람 깎은 바위 기둥(2x3칸, 후두): 넓은 돌무더기 밑동 위로 위로 갈수록 가늘어지는 붉은 사암 기둥, 그 꼭대기에 더 단단한
    밝은 덮개돌(윗면이 보이는 납작한 판)이 얹혔다. 가로 지층 띠, 왼쪽 밝고 오른쪽 그늘. 사막 깊은 곳의 길잡이."""
    W, H = 32, 48
    o = Image.new('RGBA', (W, H)); px = o.load()
    cx = 15.5
    def half(y):
        if y >= 38: return 7 + (y - 38) * 0.8                    # 밑동 비탈
        return 3.2 + (38 - y) * -0.0 + (y - 12) * 0.14           # 위로 갈수록 가늘다(목 3.2)
    for y in range(12, 46):
        hw = half(y) + (_h(y // 2, 761) - 0.5) * 1.4
        xc = cx + (38 - min(y, 38)) * 0.05
        for x in range(int(round(xc - hw)), int(round(xc + hw)) + 1):
            u = (x + 0.5 - (xc - hw)) / max(1.0, 2 * hw)
            t = 5 if u < 0.25 else (4 if u < 0.6 else (3 if u < 0.85 else 2))
            band = (y + int(math.sin(x / 3.0))) % 4
            if band == 0: t = max(1, t - 1)
            if _h(x, y, 762) > 0.94: t = max(1, t - 1)
            _put(px, W, H, x, y, BR[t])
    # 덮개돌: 납작한 판(윗면 4px 밝게 + 앞면 4px), 기둥보다 넓게 튀어나옴
    for y in range(4, 13):
        for x in range(6, 27):
            dx = (x + 0.5 - 16.5) / 10.5
            if abs(dx) > 1 - (0.25 if y in (4, 12) else 0): continue
            if y < 8: c = SS[6] if (x < 14 and y < 6) else SS[5]
            elif y == 8: c = SS[3]
            else: c = SS[4] if x < 13 else (SS[3] if x < 22 else SS[2])
            if _h(x, y, 763) > 0.92: c = SS[3]
            _put(px, W, H, x, y, c)
    for x in range(9, 24): _put(px, W, H, x, 13, BR[1])          # 덮개돌 밑 그늘
    im = pz.fin(o); q = im.load()
    for (bx, by, w, h) in ((2, 41, 5, 4), (25, 42, 6, 4), (21, 44, 4, 3)):
        for yy in range(by, by + h):
            for xx in range(bx, bx + w):
                _put(q, W, H, xx, yy, BR[5] if yy == by else (BR[4] if xx < bx + w - 1 else BR[2]))
    _gshadow(im, 18, 46, 13, 1.8, 90)
    return im

def sand_boulder_s():
    """작은 사암 바위(1칸): 둥근 사암 돌 하나, 가로 결 한 줄. 큰 바위 곁·절벽 밑에 섞는다."""
    c = C(16, 16, seed=771); c.shadow(9, 14, 7, 1.4, 80)
    c.new(); c.ellipsoid(8, 9.5, 6.5, 5, 'sstone', amb=0.2, bump=0.4, bsc=3.0)
    for x in range(2, 14):
        y = 10 + int(math.sin(x / 3.0) * 0.6)
        if c.m[y][x] == 'sstone' and _hash(x, 1, 771) < 0.7: c.tone(x, y, 'sstone', 2)
    return F(c)

def pebbles():
    """잔돌(1칸, 걷는 장식): 붉은 사암 잔돌 몇 개. 암반 가장자리·길가."""
    o = Image.new('RGBA', (16, 16)); p = o.load()
    for (x, y, w) in ((3, 10, 3), (8, 12, 2), (11, 7, 3), (6, 5, 2)):
        for i in range(w):
            _put(p, 16, 16, x + i, y, BR[5] if i < w - 1 else BR[4]); _put(p, 16, 16, x + i, y + 1, BR[3] if i < w - 1 else BR[2])
        _put(p, 16, 16, x + w, y + 1, SA[2]); _put(p, 16, 16, x - 1, y + 1, BR[2])
    return o

def pot_shards():
    """깨진 토기 조각(1칸, 걷는 장식): 무덤 앞·발굴터 둘레에 흩어진 붉은 토기 조각."""
    o = Image.new('RGBA', (16, 16)); p = o.load(); Cl = RP('cloth')
    for (x, y, sh) in ((3, 9, "4432"), (9, 11, "543"), (10, 5, "432"), (5, 4, "54")):
        for i, ch in enumerate(sh):
            _put(p, 16, 16, x + i, y, Cl[int(ch)]); _put(p, 16, 16, x + i, y + 1, Cl[max(1, int(ch) - 2)])
    _put(p, 16, 16, 4, 8, Cl[5])
    return o

# ================================================================ 모래 언덕 능선(걷는 바닥 장식, 큼)
def _dune(W, H, crest, seed):
    """모래 언덕: 바람 맞는 쪽(왼쪽 위 비탈) 밝게, 날카로운 마루선(밝은 1px + 어두운 1px), 바람 그늘 비탈(오른쪽 아래) 어둡고
    잔물결 줄. 가장자리는 바탕 모래(4단)로 녹아든다(윤곽 없음). crest = [(x,y)...] 마루선 꺾은선."""
    o = Image.new('RGBA', (W, H)); p = o.load()
    def cy_at(x):
        for (x0, y0), (x1, y1) in zip(crest, crest[1:]):
            if x0 <= x <= x1: return y0 + (y1 - y0) * (x - x0) / max(1, x1 - x0)
        return None
    for x in range(W):
        cy = cy_at(x)
        if cy is None: continue
        fall = min(1.0, min(x - crest[0][0], crest[-1][0] - x) / 14.0)     # 양 끝으로 갈수록 낮아진다
        up = 3 + 7 * fall; dn = 6 + 12 * fall
        for y in range(int(cy - up), int(cy + dn) + 1):
            if not (0 <= y < H): continue
            if y < cy:           # 바람 맞는 비탈(밝다): 마루 가까울수록 밝다
                v = (cy - y) / up
                t = 5 if v < 0.55 else 4
                if v > 0.8 and _h(x, y, seed) > 0.5: continue           # 바탕과 섞여 사라진다
                if t == 4 and _h(x, y, seed + 1) > 0.6: continue
            elif y < cy + 1.2:
                t = 6
            elif y < cy + 2.2:
                t = 2
            else:                # 바람 그늘 비탈(어둡다) + 잔물결
                v = (y - cy) / dn
                t = 3
                if ((y - cy) + math.sin(x / 6.0) * 1.2) % 5 < 1: t = 4 if v < 0.7 else 3
                if v > 0.72 and _h(x, y, seed + 2) > (1 - v) * 3: continue
                if v > 0.55 and t == 3 and _h(x, y, seed + 3) > 0.7: t = 4
            if _h(x, y, seed + 4) > 0.97: t = min(6, t + 1)
            _put(p, W, H, x, y, SA[t])
    return o

def dune_ridge_l():
    """큰 모래 언덕 능선(6x3칸, 걷는 바닥 장식): 굽은 마루선, 밝은 바람받이 비탈과 어두운 그늘 비탈. 맵 가장자리·빈 사막."""
    return _dune(96, 48, [(2, 26), (20, 18), (44, 14), (66, 19), (86, 13), (94, 16)], 701)

def dune_ridge_s():
    """작은 모래 언덕 능선(4x2칸, 걷는 바닥 장식). 큰 능선 사이·암반 둘레."""
    return _dune(64, 32, [(2, 14), (22, 9), (40, 11), (62, 8)], 702)

# ================================================================ 발굴터
def shovel():
    """모래에 꽂힌 삽(1x2칸): 나무 자루와 쇠 삽날, 밑에 파낸 모래 더미."""
    W, H = 16, 32
    o = Image.new('RGBA', (W, H)); p = o.load(); Wd = RP('wood'); I = RP('iron')
    for j in range(20):
        x = 7 + j // 8; y = 22 - j
        _put(p, W, H, x, y, Wd[5]); _put(p, W, H, x + 1, y, Wd[3])
    for x in range(6, 12): _put(p, W, H, x, 3, Wd[5] if x < 9 else Wd[3])
    for y in range(22, 27):
        for x in range(5, 11): _put(p, W, H, x, y, I[5] if x < 7 else (I[4] if x < 9 else I[3]))
    im = pz.fin(o); q = im.load()
    _sand_heap(q, W, H, 8, 31, 8, 5, 711)
    return im

def rope_coil():
    """밧줄 사리와 등(1칸): 감아 놓은 밧줄과 작은 기름등. 발굴터 장식."""
    c = C(16, 16, seed=721); c.shadow(8, 14, 7, 1.2, 70)
    c.new(); c.ellipsoid(6, 11, 5, 3, 'rope', amb=0.3)
    c.new(); c.ellipsoid(6, 10.5, 2.2, 1.2, 'rope', amb=0.2, bias=-0.3)
    c.new(); c.box(11, 7, 4, 1, 5, 'iron', top=0.9, front=0.55); c.tone(12, 9, 'fire', 5); c.tone(13, 9, 'fire', 4)
    return F(c)

def dig_pit():
    """발굴 구덩이(2x2칸): 네모나게 판 깊은 구덩이 — 남쪽을 보는 안쪽 뒤 벽은 빛을 등져 어둡고(모래 지층), 바닥은 뒤로 갈수록
    그늘, 반쯤 드러난 마름돌 하나. 테두리는 파낸 모래 둔덕으로 땅에 녹아든다(윤곽 없음). 막힘."""
    W, H = 32, 32
    o = Image.new('RGBA', (W, H)); p = o.load()
    x0, x1, y0, y1 = 5, 27, 8, 23
    for y in range(y0, y1):
        for x in range(x0, x1):
            jag = int(_h(x, 752) * 2)
            if y < y0 + jag: continue
            cdx = min(x - x0, x1 - 1 - x); cdy = min(y - y0, y1 - 1 - y)
            if cdx + cdy < 3: continue
            if y < y0 + 5:                       # 뒤 벽 지층(그늘)
                c = SA[1] if (y - y0) % 2 == 0 else SA[0]
                if y == y0 + jag: c = SA[2]
            else:                                # 바닥: 뒤 어둡고 앞 밝게
                v = (y - y0 - 5) / (y1 - y0 - 5)
                c = SA[0] if v < 0.3 else (SA[1] if v < 0.7 else SA[2])
                if _h(x, y, 754) > 0.9: c = SA[3]
                if 10 <= x <= 19 and y0 + 8 <= y <= y0 + 12:
                    c = SS[4] if y > y0 + 8 else SS[5]
                    if x == 19 or y == y0 + 12: c = SS[2]
            if x == x0: c = SA[1]
            if x == x1 - 1: c = mix(c, SA[3], 0.5)
            _put(p, W, H, x, y, c)
    _sand_heap(p, W, H, 8, 9, 8, 4, 731)
    _sand_heap(p, W, H, 24, 9, 7, 3, 732)
    _sand_heap(p, W, H, 22, 30, 10, 6, 733)
    _sand_heap(p, W, H, 6, 28, 5, 4, 734)
    for x in range(x0, x1):                      # 앞 테(밝은 모래 윗면 한 줄)
        _put(p, W, H, x, y1, SA[5] if _h(x, 753) > 0.3 else SA[6])
    return o

def wheelbarrow():
    """외바퀴 수레(2x1칸): 흙을 실은 나무 수레, 앞 바퀴, 두 손잡이. 발굴터."""
    W, H = 32, 16
    c = C(W, H, seed=741); c.shadow(16, 14.5, 14, 1.2, 70)
    c.new(); c.box(8, 3, 16, 3, 6, 'wood', top=0.9, front=0.5)
    c.new(); c.ellipsoid(16, 4, 7, 2, 'sand', amb=0.3, bias=0.05)
    c.new(); c.ellipsoid(6, 11, 3, 3, 'wood', amb=0.3); c.tone(6, 11, 'iron', 3)
    c.new()
    for x in range(24, 31): c.tone(x, 9 + (x - 24) // 3, 'wood', 4)
    for x in (12, 21):
        for y in range(12, 15): c.tone(x, y, 'wood', 3)
    return F(c)


def campfire_ring():
    """야영 모닥불(2x2칸): 사암 돌을 둥글게 두른 화덕, 마른 가지 불, 재. 카라반 야영 자리·낙타 쉼터 곁."""
    W, H = 32, 32
    c = C(W, H, seed=781); c.shadow(16, 27, 13, 2.6, 90)
    for i in range(9):
        a = i / 9 * 6.283; x = 16 + math.cos(a) * 10; y = 22 + math.sin(a) * 4.6
        c.new(); c.ellipsoid(x, y, 3.0, 2.5, 'sstone', amb=0.2, bump=0.4)
    c.new(); c.ellipsoid(16, 22, 7.5, 3, 'dark', amb=0.3, bias=-0.1)
    for (x0, y0, x1, y1) in ((10, 24, 21, 19), (11, 19, 22, 24)):
        c.new()
        for kk in range(0, 2): c.line(x0, y0 + kk, x1, y1 + kk, 'dry', (4, 2)[kk])
    im = F(c); px = im.load()
    FL = [hx(v) for v in PAL['flame']]
    rows = ["....6....", "...565...", "..56765..", ".4567654.", ".3456543.", "234565432", ".2344432."]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.': px[12 + i, 12 + j] = FL[int(ch) - 1] + (255,)
    for (x, y) in ((11, 9), (20, 8), (15, 6)): px[x, y] = FL[5] + (255,)
    return im
