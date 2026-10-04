# 곶 등대 — 바다로 뻗은 곶(바깥) + 등대 안쪽 3개 층. 다시 돌리면 같은 그림.  python3 make_headland-lighthouse.py
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4
from c4 import *
import pa, pf, pz, pboat, kits7_manor as K, interior
from interior_demo import rugset, lit

W, H = 48, 42
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = HERE
P = c4.Parts()

# ------------------------------------------------------------ 지형 (E 높이 1=곶 위, 0=아래)
E = np.zeros((H, W), int)
E[0:13, :] = 1
# 곶: 좌우가 들쭉날쭉 (칸 단위 어긋남) — 목에서 끝으로 갈수록 넓어지는 물방울 모양
_HW = {13: 6, 14: 6, 15: 5, 16: 5, 17: 6, 18: 6, 19: 5, 20: 5, 21: 5, 22: 6, 23: 6, 24: 7, 25: 7, 26: 8, 27: 8, 28: 9, 29: 9, 30: 9, 31: 8, 32: 8, 33: 7}
_CL = {13: 26, 14: 26, 15: 27, 16: 27, 17: 27, 18: 26, 19: 26, 20: 26, 21: 27, 22: 27, 23: 27, 24: 26, 25: 26, 26: 26, 27: 26, 28: 27, 29: 27, 30: 27, 31: 27, 32: 27, 33: 27}
for y, hw in _HW.items():
    c = _CL[y]
    E[y, c - hw: c + hw] = 1
KIND = {'sea': 0, 'grass': 1, 'sand': 2, 'rocky': 3, 'flag': 4, 'wet': 5}
NAMES = {0: 'sea', 1: 'grass', 2: 'sand', 3: 'rocky', 4: 'flag'}
kind = np.zeros((H, W), int)
kind[E == 1] = 1
cy_, cx_ = np.mgrid[0:H, 0:W]
FAC = np.zeros((H, W), bool)
Fc = terrain.faces(E.tolist())
for y in range(H):
    for x in range(W):
        if Fc[y][x]: FAC[y, x] = True
kind[FAC] = 3
def ell(cx, cy, rx, ry, seed):
    n = noise(H, W, 3.0, seed)
    return (((cx_ - cx) / rx) ** 2 + ((cy_ - cy) / ry) ** 2) < (0.85 + 0.35 * n)
wb = ell(7, 17.5, 8.2, 5.0, 11) & (cy_ >= 16) & ~FAC & (E == 0)
eb = ell(41, 17.0, 6.2, 4.0, 12) & (cy_ >= 16) & ~FAC & (E == 0)
kind[wb | eb] = 2
out, fin = paint_ground(kind, NAMES, seed=7, jitter=2.0)
Hp, Wp = H * 16, W * 16
# 곶 위 칸은 물이 넘어오지 못하게 풀로 되돌린다
Y, X = np.mgrid[0:Hp, 0:Wp]
ecell = E[Y // 16, X // 16] == 1
bad = (fin == 0) & ecell
if bad.any():
    g = PAINT['grass'](X, Y, 17); out[bad] = g[bad]; fin[bad] = 1
fac_px = FAC[Y // 16, X // 16]
bad = (fin == 0) & fac_px
out[bad] = PAINT['rocky'](X, Y, 19)[bad]; fin[bad] = 3
PLZ = ((X - 27 * 16) / 92.0) ** 2 + ((Y - 30.4 * 16) / 62.0) ** 2 < 1 + (noise(Hp, Wp, 5, 41) - .5) * .25
PLZ &= ecell & (fin == 1)
_f = PAINT['flag'](X, Y, 43)
out[PLZ] = _f[PLZ]; fin[PLZ] = 4
water = fin == 0
out = shore(out, water, ~water, seed=5)
# 젖은 모래: 물가 5px
from scipy.ndimage import distance_transform_edt as edt
dw = edt(~water)
wet = (fin == 2) & (dw < 6 + noise(Hp, Wp, 4, 8) * 2)
out[wet] = PAINT['wetsand'](X, Y, 23)[wet]
# 길 (픽셀 단위)
def polymask(pts, r, seed):
    m = np.zeros((Hp, Wp), bool)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
        d = np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy))
        m |= d < r + (noise(Hp, Wp, 6, seed) - .5) * 6
    return m
PATH = [(392, 0), (392, 120), (384, 190), (374, 250), (370, 330), (372, 400), (380, 450), (400, 500), (420, 540)]
pm = polymask(PATH, 12, 31) & ecell & (fin == 1)
SPUR = [(521, 140), (512, 160), (470, 168), (405, 172)]        # 관리인 집 문 앞에서 큰길로
pm |= polymask(SPUR, 7, 32) & ecell & (fin == 1)
STAIRP = [(136, 205), (140, 175)]                   # 서쪽 계단으로 가는 샛길
pm |= polymask([(392, 150), (300, 170), (200, 190), (136, 200)], 7, 33) & ecell & (fin == 1)
pm |= polymask([(398, 150), (500, 176), (580, 192), (632, 200)], 7, 34) & ecell & (fin == 1)
dirt = PAINT['dirt'](X, Y, 29)
out[pm] = dirt[pm]
# 길 가장자리 풀 잔털
edge = pm & ~(edt(pm) > 2)
out[edge & (noise(Hp, Wp, 2, 30) > .55)] = LF[3]
ground = to_image(np.concatenate([out, np.full((Hp, Wp, 1), 255)], -1)) if False else Image.fromarray(np.dstack([out.astype(np.uint8), np.full((Hp, Wp), 255, np.uint8)]))

# 절벽 얼굴(지형기) 위에 얹기 — 발치 풀 잔털을 어두운 바위로
STAIRS = [(8, 13, 2), (39, 13, 2)]
tr = terrain.render(E.tolist(), None, STAIRS, [], 0)
a = np.array(tr)
for cell in [(x, y) for y in range(H) for x in range(W) if FAC[y, x]]:
    cx, cy = cell; k = Fc[cy][cx]
    for ly in range(16):
        fy = ly + (k - 1) * 16
        if fy >= 43:
            for lx in range(16):
                px_ = cx * 16 + lx; py_ = cy * 16 + ly
                if a[py_, px_, 3] and tuple(a[py_, px_, :3]) == tuple(LF[2]):
                    a[py_, px_, :3] = (46, 52, 40) if fy >= 46 else (74, 60, 50)
ground.alpha_composite(Image.fromarray(a))
# 절벽 발치에 물이 닿으면 거품 줄 (얼굴 아래줄 물쪽)
base = ground

S = Scene(W, H)
S.base = base
# 통행: 바다·절벽 막힘, 계단만 열림
S.walk[:] = True
S.walk[fin[8::16, 8::16] == 0] = False
S.walk[FAC] = False
for (sx, sy, sw) in STAIRS:
    S.walk[sy:sy + 3, sx:sx + sw] = True
S.walk[E == 0] &= (kind[E == 0] != 0)          # 바다 칸
# 바위 칸(rocky)은 걷지 못한다 (절벽 어깨)
S.walk[(kind == 3) & (E == 0) & ~FAC] = False
for (sx, sy, sw) in STAIRS:
    S.walk[sy:sy + 3, sx:sx + sw] = True

def tree(name, cx, foot, block=True):
    x, y, w, h = c4_TREES[name]
    im = CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
    S.put(im, cx * 16 - im.width // 2, foot - im.height, 'tree', foot=foot)
    if block: S.block(int(cx) - 1, int((foot - 8) // 16), int(cx), int((foot - 8) // 16))
c4_TREES = {'oakA': (224, 512, 4, 5), 'oakB': (288, 512, 3, 4), 'bushC': (336, 512, 2, 2), 'bushD': (368, 512, 3, 3), 'bushE': (368, 560, 2, 2)}
def bush(name, cx, foot, block=True):
    x, y, w, h = c4_TREES[name]
    im = CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
    S.put(im, cx * 16 - im.width // 2, foot - im.height, 'bush', foot=foot)
    if block: S.block(int(cx - w / 2 + .5), int((foot - 8) // 16))
def prop(im, px, py, name='', block=True, foot=None):
    """px,py = 발밑 중앙(픽셀)"""
    if hasattr(im, 'img'): im = im.img(True) if callable(im.img) else im.img
    im = im.convert('RGBA')
    S.put(im, px - im.width // 2, py - im.height, name, foot=foot if foot else py)
    if block:
        S.block((px - im.width // 2) // 16, (py - 1) // 16 - (0 if im.height <= 16 else 0), (px + im.width // 2 - 1) // 16, (py - 1) // 16)

# ------------------------------------------------------------ 등대 (손 도트)
def lighthouse():
    """3/4 원통 등대: 받침·몸통·전망대·등방·지붕 모두 위 타원(윗면)+앞면 원통 음영. 빛은 왼쪽 위."""
    Wd, Hd = 96, 288
    im = np.zeros((Hd, Wd, 4), np.uint8)
    cx = Wd // 2; foot = Hd - 6
    RY = 0.28
    def put(x, y, c):
        if 0 <= x < Wd and 0 <= y < Hd: im[y, x] = tuple(c[:3]) + (255,)
    def cyl_tone(u):                      # 원통 앞면: 왼쪽 밝고 오른쪽 어둡다
        v = 0.5 - u * 0.55
        return 5 if v > .85 else 4 if v > .5 else 3 if v > .22 else 2
    def ell_top(cx_, cy_, r, col, ry=None):   # 윗면 타원 (균일 한 톤 — 평평한 면)
        ry = ry if ry is not None else r * RY
        for y in range(int(cy_ - ry) - 1, int(cy_ + ry) + 2):
            for x in range(int(cx_ - r) - 1, int(cx_ + r) + 2):
                if ((x + .5 - cx_) / r) ** 2 + ((y + .5 - cy_) / ry) ** 2 <= 1: put(x, y, col)
    # ---- 치수 (발 기준)
    R0, PH = 36, 26                     # 받침 반지름·앞면 높이
    ry0 = int(R0 * RY)                  # 10
    yb = foot - ry0                     # 받침 바닥 타원 중심
    yp = yb - PH                        # 받침 윗면 타원 중심
    hw0, hw1 = 27, 18                   # 몸통 아래/위 반지름
    SH = 172
    yg = yp - SH                        # 전망대 윗면 중심 (= 몸통 꼭대기)
    # ---- 1. 받침 (돌 원통: 앞면 26 + 윗면 타원 고리)
    for x in range(cx - R0, cx + R0 + 1):
        u = (x + .5 - cx) / R0
        if abs(u) > 1: continue
        d = R0 * RY * math.sqrt(1 - u * u)
        for y in range(int(yp - 0), int(yb + d) + 1):
            top_edge = yp + d
            if y < top_edge: continue          # 윗면 타원은 아래에서 따로
            tone = cyl_tone(u)
            k = y - int(yp)
            if k % 7 == 6: tone = max(1, tone - 1)                               # 줄눈
            if ((x + (0 if (k // 7) % 2 else 6)) // 12 + k // 7) % 4 == 0 and (x % 12 == 0) and k % 7 != 6: tone = max(1, tone - 1)
            if u > .9: tone = 1
            put(x, y, ST[tone])
    ell_top(cx, yp, R0, ST[6])                # 받침 윗면(밝고 평평)
    for x in range(cx - R0, cx + R0 + 1):       # 윗면 테두리 (앞쪽 가장자리 하이라이트)
        u = (x + .5 - cx) / R0
        if abs(u) >= 1: continue
        d = R0 * RY * math.sqrt(1 - u * u)
        put(x, int(yp + d), ST[6] if u < .4 else ST[5])
    # ---- 2. 몸통 (빨강/흰 띠, 곡선 띠, 아래가 넓다)
    def hw_at(y): 
        t = min(1.0, max(0.0, (y - yg) / (yp - yg)))
        return hw1 + (hw0 - hw1) * t
    for x in range(cx - hw0, cx + hw0 + 1):
        u0 = (x + .5 - cx) / hw0
        if abs(u0) > 1: continue
        ybot = yp + hw0 * RY * math.sqrt(1 - u0 * u0)
        for y in range(int(yg), int(ybot) + 1):
            hw = hw_at(y)
            if abs(x + .5 - cx) > hw: continue
            u = (x + .5 - cx) / hw
            ye = y - hw * RY * math.sqrt(max(0, 1 - u * u))
            band = int((ye - yg + 400) // 28) % 2
            tone = cyl_tone(u)
            if u > .93: tone = 1
            if band == 0: c = RD[max(1, min(5, tone))]
            else: c = PL[max(2, min(6, tone + 1 if tone < 5 else 6))]
            put(x, y, c)
    # 좁은 창(슬릿) + 아래 문턱
    for wy in (yp - 34, yp - 88, yp - 140):
        for dy in range(-6, 7):
            for dx in (-1, 0, 1):
                if abs(dy) == 6 and dx != 0: continue
                put(cx + dx - 2, wy + dy, ST[0] if (abs(dx) == 1 or abs(dy) == 6) else (7, 21, 40))
        put(cx - 2, wy - 2, (63, 162, 174)); put(cx - 2, wy - 3, (167, 212, 219))
        for dx in range(-3, 2): put(cx + dx - 2, wy + 7, ST[6])
    # ---- 3. 문 (받침 앞 가운데 아치)
    dx0, dw, dh = cx - 6, 12, 22
    top = foot - dh - 1
    for y in range(top, foot):
        for x in range(dx0, dx0 + dw):
            if y - top < 6:
                yy = 6 - (y - top); xx = abs(x + .5 - cx)
                if xx * xx + yy * yy > 40: continue
            c = WD[3] if (x - dx0) % 4 else WD[2]
            if x == dx0 or x == dx0 + dw - 1 or y == top: c = WD[1]
            put(x, y, c)
    for y in range(foot - 12, foot - 10): put(cx + 3, y, (251, 193, 13))
    for x in range(dx0 - 1, dx0 + dw + 1): put(x, foot, ST[6])          # 문턱
    # ---- 4. 전망대 (원통 접시: 윗면 타원 + 앞 두께 8)
    GR = 34; gry = GR * RY
    for x in range(cx - GR, cx + GR + 1):
        u = (x + .5 - cx) / GR
        if abs(u) > 1: continue
        d = gry * math.sqrt(1 - u * u)
        for y in range(int(yg + d), int(yg + d) + 8):
            tone = cyl_tone(u) - 1
            if y - int(yg + d) >= 6: tone = 1
            put(x, y, ST[max(1, tone)] if abs(u) < .94 else ST[1])
    # 뒤쪽 난간(등방 뒤)
    RR = 31; rry = RR * RY; rh = 13
    posts = [a for a in range(0, 360, 15)]
    def rail_back():
        for a in posts:
            s = math.sin(math.radians(a))
            if s >= 0: continue                            # 뒤쪽 반(위)
            px = int(round(cx + RR * math.cos(math.radians(a)))); py = int(round(yg + rry * s))
            for k in range(rh): put(px, py - k, WD[2])
        for i in range(0, 181):
            a = math.radians(180 + i)
            put(int(round(cx + RR * math.cos(a))), int(round(yg - rh + rry * math.sin(a))), WD[3])
    ell_top(cx, yg, GR, ST[6])                               # 전망대 윗면
    ell_top(cx, yg, GR - 3, ST[5])                           # 안쪽 바닥 (한 칸 어두운 띠로 테두리)
    for y in range(int(yg - gry), int(yg + gry) + 2):         # 테두리는 윗면과 같은 톤 유지 — 안쪽 원형 타일 무늬만
        pass
    ell_top(cx, yg, GR - 3, ST[6])
    rail_back()
    # ---- 5. 등방 (유리 원통 + 윗테 타원)
    LR = hw1 - 3; ly0 = yg - 32
    for x in range(cx - LR, cx + LR + 1):
        u = (x + .5 - cx) / LR
        if abs(u) > 1: continue
        d = LR * RY * math.sqrt(1 - u * u)
        for y in range(int(ly0), int(yg + d) + 1):
            v = 0.5 - u * 0.5
            c = (167, 212, 219) if v > .85 else (63, 162, 174) if v > .35 else (33, 45, 66)
            put(x, y, c)
    for y in range(int(ly0 + 6), int(yg - 6)):                # 불빛 (가운데 노랑)
        for x in range(cx - 7, cx + 8):
            r = math.hypot((x - cx) / 7, (y - (ly0 + yg) / 2) / 11)
            if r < 1: put(x, y, SR[5] if r < .55 else SR[4])
    for mx in (-LR, -LR // 2, 0, LR // 2, LR):                # 창살 세로
        for y in range(int(ly0), int(yg + LR * RY * math.sqrt(max(0, 1 - (mx / LR) ** 2))) + 1):
            put(cx + mx, y, ST[2] if mx <= 0 else ST[1])
    for yy in (ly0 + 14,):                                     # 가로 창살은 앞으로 휜다
        for x in range(cx - LR, cx + LR + 1):
            u = (x + .5 - cx) / LR
            put(x, int(yy + LR * RY * math.sqrt(max(0, 1 - u * u))), ST[3])
    # 등방 바닥 테 (앞 곡선)
    for x in range(cx - LR - 1, cx + LR + 2):
        u = (x + .5 - cx) / (LR + 1)
        if abs(u) > 1: continue
        d = (LR + 1) * RY * math.sqrt(1 - u * u)
        put(x, int(yg + d), ST[2]); put(x, int(yg + d) + 1, ST[1])
    # 앞쪽 난간 (등방 앞)
    for a in posts:
        s = math.sin(math.radians(a))
        if s < 0: continue
        px = int(round(cx + RR * math.cos(math.radians(a)))); py = int(round(yg + rry * s))
        for k in range(rh): put(px, py - k, WD[2] if px > cx else WD[4])
    for i in range(0, 181):
        a = math.radians(i)
        put(int(round(cx + RR * math.cos(a))), int(round(yg - rh + rry * math.sin(a))), WD[5] if math.cos(a) < .2 else WD[3])
    for i in range(0, 181):                                    # 난간 밑 받침대
        a = math.radians(i)
        put(int(round(cx + RR * math.cos(a))), int(round(yg + rry * math.sin(a))), WD[1])
    # ---- 6. 지붕 (원뿔 + 처마 타원, 윗면은 작은 꼭지)
    cr = LR + 5; ch = 30; yl = ly0
    for k in range(ch):
        y = yl - k; hw = cr * (1 - k / ch) ** 0.9
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - cx) / max(1, hw)
            v = 0.45 - u * 0.6
            tone = 5 if v > .82 else 4 if v > .48 else 3 if v > .2 else 2
            if (x + k * 2) % 6 == 0 and hw > 3: tone = max(1, tone - 1)
            put(x, y, RD[tone])
    for x in range(cx - cr, cx + cr + 1):                      # 처마: 앞 곡선 아래로 두께 3
        u = (x + .5 - cx) / cr
        if abs(u) > 1: continue
        d = int(cr * RY * math.sqrt(1 - u * u))
        for k in range(d + 3):
            tone = cyl_tone(u) if k < d + 1 else 1
            put(x, yl + 1 + k - 1, RD[max(1, min(5, tone))] if k < d + 1 else RD[1])
    tip = yl - ch
    for k in range(9): put(cx, tip - k, ST[2])
    put(cx - 1, tip - 8, SR[4]); put(cx, tip - 9, SR[5]); put(cx + 1, tip - 8, SR[4])
    for k in range(0, 8, 2): put(cx + 1 + k, tip - 5, WD[5])
    img = Image.fromarray(im)
    return finish(img)

def finish(img):
    """윤곽: 투명 옆의 색 픽셀 안쪽에 어두운 테를 두른다 (바깥 테)."""
    a = np.array(img); al = a[..., 3] > 0
    Hh, Ww = al.shape
    padded = np.pad(al, 1)
    nb = padded[:-2, 1:-1] | padded[2:, 1:-1] | padded[1:-1, :-2] | padded[1:-1, 2:]
    edge = nb & ~al
    out = np.zeros((Hh + 2, Ww + 2, 4), np.uint8)
    out[1:-1, 1:-1] = a
    e2 = np.pad(edge, 1)
    # 테를 한 칸 넓힌 캔버스에 그리기 위해 edge 는 원 캔버스 안에서만 - 캔버스에 여백이 있으니 충분
    a[edge] = (*ST[0], 255)
    return Image.fromarray(a)

LH = lighthouse()
P.add('lighthouse', LH, '손 도트 등대 — 돌 받침·붉은/흰 곡선 띠·좁은 창·아치 문·갤러리 난간·유리 등방·원뿔 지붕 (96×312)')
LH_FOOT = 32 * 16 + 8 + 6      # 타워 발 y (px), 스프라이트 하단 = foot+6 여백
LH_CX = 27 * 16
S.put(LH, LH_CX - LH.width // 2, LH_FOOT - LH.height + 6, 'lighthouse', foot=LH_FOOT + 20)
S.block(25, 31, 28, 32)           # 받침(±34px)

# ------------------------------------------------------------ 소품 배치 헬퍼
def pp(obj, cx, foot, name='', bl='foot', shrink=0):
    """obj(C 또는 Image)를 발밑 중앙(cx,foot)px 에 놓는다. bl='foot' 이면 맨 아랫줄 셀들을 막는다."""
    im = pz.fin(obj) if hasattr(obj, 'img') else obj.convert('RGBA')
    x = int(cx - im.width // 2); y = int(foot - im.height)
    S.put(im, x, y, name, foot=foot)
    if bl == 'foot':
        cy = (foot - 1) // 16
        S.block((x + shrink) // 16, cy, (x + im.width - 1 - shrink) // 16, cy)
    elif bl:
        S.block(*bl)
    return im
def cellp(cx, cy): return cx * 16 + 8, cy * 16 + 16          # 셀 (cx,cy) 아랫변 중앙

# 관리인 집 — 박공 2층 (창은 벽 가운데)
HOUSE = c4.house('sto', 5, 'lwdwr', 2, chimney=3)
hx_, hf_ = 30 * 16, 8 * 16 + 14
S.put(HOUSE, hx_, hf_ - HOUSE.height, 'house', foot=hf_)
S.block(hx_ // 16, hf_ // 16 - 1, (hx_ + HOUSE.width - 1) // 16, hf_ // 16 - 1)
S.marks['keeper_door'] = (hx_ // 16 + 2, hf_ // 16)
# 텃밭 (집 왼쪽)
for cx, cy in ((36, 10), (37, 10), (38, 10), (36, 11), (37, 11), (38, 11)):
    S.put(pz.fin(K.flower_patch()), cx * 16, cy * 16, 'bed', foot=cy * 16 + 6)
S.put(pz.fin(K.hedge_run(3)), 36 * 16, 12 * 16 - 4 - 16, 'hedge', foot=12 * 16 - 2)
S.block(36, 11, 38, 11)
# 마당 소품
pp(pf.barrels(), 35 * 16 + 4, 8 * 16 + 14, 'barrels', shrink=0)
pp(pf.cart(), 42 * 16, 8 * 16 + 10, 'cart')
# 나무 덩이 (자연 덩어리, 길 비켜서)
for nm, cx, foot in (('oakA', 3.5, 150), ('oakB', 6.5, 120), ('bushD', 9.5, 160), ('bushE', 1.5, 180),
                     ('oakA', 14.5, 60), ('bushC', 12.5, 110), ('oakB', 18, 95),
                     ('oakA', 41.5, 62), ('oakB', 45, 104), ('bushD', 43.5, 170), ('bushC', 46, 150),
                     ('oakA', 40, 140), ('bushE', 34.5, 24), ('oakB', 30, 30), ('bushC', 5, 60)):
    if nm.startswith('oak'): tree(nm, cx, foot)
    else: bush(nm, cx, foot)
# 절벽 위 바위
for cx, cy in ((13, 12), (17, 12), (35, 12), (45, 12), (19, 10)):
    pp(pa.boulder(), cx * 16 + 8, cy * 16 + 14, 'boulder')
# 바다 바위 (파도 부서지는 자리)
for cx, cy in ((14, 27), (12, 31), (38, 28), (40, 33), (9, 36), (43, 37), (30, 40), (17, 38)):
    pp(pa.boulder(), cx * 16 + 8, cy * 16 + 12, 'seaboulder')
# 곶 끝 — 깃대·벤치·등롱
pp(pz.flagpole(0), 22 * 16, 32 * 16 + 4, 'flagpole')
pp(pz.bench_park(), 31 * 16 + 8, 32 * 16, 'bench')
pp(pz.lamp_crook() if hasattr(pz, 'lamp_crook') else pz.lamp_double(), 23 * 16, 29 * 16 + 4, 'lamp')
pp(pz.mooring_bollard(), 24 * 16 + 8, 33 * 16 + 6, 'bollard')
# 서쪽 만: 그물 건조대·상자·노 젓는 배
pp(pz.net_rack(), 5 * 16, 19 * 16, 'net')
pp(pboat.boat('rowboat', 0), 12 * 16, 24 * 16 + 4, 'rowboat', bl=(10, 23, 13, 23))
pp(pz.fish_barrel(), 8 * 16, 21 * 16, 'fishbarrel')
pp(pz.anchor(), 2 * 16, 22 * 16, 'anchor')
# 동쪽 모래: 상자·계선주
pp(pz.mooring_bollard(), 44 * 16, 20 * 16, 'bollard2')


# 북쪽 풀밭 보강 — 길가 등롱·벤치·꽃밭·덤불 덩이 (빈 풀밭 메우기가 아니라 길 어귀와 낭떠러지 가장자리에 용도를 준다)
pp(pz.lamp_crook(), 23 * 16 + 4, 10 * 16 + 14, 'lamppost')
pp(pz.bench_park(), 20 * 16, 11 * 16 + 4, 'bench2')
for cx, cy in ((17, 5), (18, 5), (17, 6), (18, 6)):
    S.put(pz.fin(K.flower_patch(cx + cy)), cx * 16, cy * 16, 'bed', foot=cy * 16 + 6)
S.block(17, 5, 18, 6)
for cx, cy in ((28, 5), (29, 5), (28, 4)):
    S.put(pz.fin(K.flower_patch(cx * 3)), cx * 16, cy * 16, 'bed', foot=cy * 16 + 6)
S.block(28, 4, 29, 5)
for nm, cx, foot in (('bushC', 21, 60), ('bushE', 22.5, 92), ('bushD', 12, 26), ('bushC', 15.5, 26), ('bushD', 37, 28), ('bushE', 33, 96)):
    bush(nm, cx, foot)
for cx, cy in ((21, 3), (13, 8), (14, 4)):
    pp(pa.boulder(), cx * 16 + 8, cy * 16 + 14, 'boulder')
pp(pz.stones(), 9 * 16, 11 * 16 + 4, 'stones') if False else None
tree('oakA', 13.5, 108); tree('oakB', 16.5, 150)
for cx, cy in ((2, 17), (9, 18), (17, 19), (12, 17)):
    pp(pa.stones(), cx * 16 + 8, cy * 16 + 14, 'beachstones', bl=None)
# 낭떠러지 가장자리 낮은 울타리 (풀 얹은 덤불 울타리), 계단 사이
S.put(pz.fin(K.hedge_run(4)), 10 * 16, 12 * 16 - 4 - 16, 'hedge', foot=12 * 16 - 2); S.block(10, 11, 13, 11)
S.put(pz.fin(K.hedge_run(4)), 20 * 16 + 8, 12 * 16 - 4 - 16, 'hedge', foot=12 * 16 - 2); S.block(20, 11, 23, 11)
# 동쪽 모래: 어구 (서쪽과 짝)
pp(pz.fish_crates(), 43 * 16, 19 * 16 + 6, 'fishcrates')
pp(pz.net_rack(), 46 * 16, 19 * 16, 'net2')
pp(pz.fish_barrel(), 41 * 16, 18 * 16 + 8, 'fishbarrel2')
pp(pz.fish_crates(), 3 * 16, 20 * 16 + 12, 'fishcrates2')
pp(pz.laundry_line(64, 3, 10), 34 * 16 + 8, 8 * 16 + 4, 'laundry', bl=(32, 7, 35, 7))

# ------------------------------------------------------------ 표식·통행 검사
S.marks['tower_door'] = (27, 33)
S.open_(26, 33, 28, 33)
marks = {'entrance': (24, 0), 'tower_door': S.marks['tower_door'], 'keeper_door': S.marks['keeper_door'],
         'stair_west': (8, 15), 'stair_east': (39, 15), 'tip': (26, 33), 'west_beach': (7, 19), 'east_beach': (42, 17)}
ok, n = S.bfs(marks['entrance'], {k: v for k, v in marks.items() if k != 'entrance'})
print('BFS', ok, n)

out = S.compose()
import hl_interior
strip, floors, fwalks = hl_interior.build_all(P)
# 아래에 안쪽 3개 층을 나란히 (8px 띠로 구분)
full = Image.new('RGBA', (W * 16, H * 16 + 8 + strip.height), (10, 8, 14, 255))
full.paste(out, (0, 0)); full.paste(strip, (0, H * 16 + 8))
full = full.convert('RGB')
os.makedirs(os.path.join(HERE, '..', '_out-4'), exist_ok=True)
c4.save_pair(full, OUT)

# 빈 바닥 통계 (한 화면 20x15)
dec = ~S.walk.copy()
for _, img, x, y, nm in S.objs:
    if nm in ('bed',): pass
    dec[max(0, y // 16):min(H, (y + img.height - 1) // 16 + 1), max(0, x // 16):min(W, (x + img.width - 1) // 16 + 1)] = True
pmc = np.asarray(pm).reshape(H, 16, W, 16).mean(axis=(1, 3)) > 0.35       # 길 칸도 「있는 것」
dec |= pmc
print('빈칸 최악', c4.empty_stats(S, dec))

# 통행 격자 (바깥 + 층별)
grid = {'w': W, 'h': H, 'walk': [''.join('.' if v else '#' for v in r) for r in S.walk],
        'legend': '. 걸음 / # 막힘', 'marks': {k: list(v) for k, v in marks.items()}, 'bfs_from_entrance': ok,
        'interior_floors': {'note': '안쪽 3층은 이미지 아래 띠(y=%dpx~)에 16x14칸씩 나란히. 1층 출구 = 아래 중앙(8,13)' % (H * 16 + 8),
                            'floors': [{'name': nm, 'w': 16, 'h': 14, 'walk': [''.join('.' if v else '#' for v in r) for r in w_]}
                                       for nm, w_ in zip(('1층 저장고', '2층 관리인 방', '3층 등방'), fwalks)]}}
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False)
md, cnt, cells = P.save(os.path.join(OUT, 'parts'), '곶 등대')
open(os.path.join(OUT, 'parts.md'), 'w').write(md)
print('parts', cnt, cells)
