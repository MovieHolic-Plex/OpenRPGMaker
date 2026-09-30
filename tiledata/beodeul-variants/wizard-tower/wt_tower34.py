# 마법사의 탑 3/4 원통 — 둥근 윗면 고리(처마 석반) + 앞면 원통 음영 + 남색 원뿔 지붕. 손 도트(좌표 계산), 빛 왼쪽 위.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4
from c4 import ST, WD, SR
import pz

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
IN = [rgb(x) for x in ('#141a3a', '#1f2b5e', '#2f4a8f', '#4470bd', '#6e9fdb', '#a9cbf0', '#e3f0ff')]
def cool(c): return (int(c[0] * .90), int(c[1] * .95), min(255, int(c[2] * 1.04 + 8)))
SB = [cool(c) for c in ST]          # 푸른 회석 램프 (7단)
RY = 0.28

def tower(Wd=96, Hd=236):
    im = np.zeros((Hd, Wd, 4), np.uint8)
    cx = Wd // 2; foot = Hd - 6
    def put(x, y, c):
        if 0 <= x < Wd and 0 <= y < Hd: im[y, x] = tuple(c[:3]) + (255,)
    def tone_u(u):                              # 원통 앞면: 왼쪽 밝고 오른쪽 어둡다 (1..5)
        v = .5 - u * .55
        return 5 if v > .85 else 4 if v > .5 else 3 if v > .22 else 2
    def ell_top(cx_, cy_, r, col_fn, ry=None):
        ry = ry if ry is not None else r * RY
        for y in range(int(cy_ - ry) - 1, int(cy_ + ry) + 2):
            for x in range(int(cx_ - r) - 1, int(cx_ + r) + 2):
                uu = (x + .5 - cx_) / r; vv = (y + .5 - cy_) / ry
                if uu * uu + vv * vv <= 1: put(x, y, col_fn(uu, vv))
    # 치수
    R0, PH = 30, 14                              # 받침 반지름, 앞면 높이
    yb = foot - int(R0 * RY)                     # 받침 바닥 타원 중심
    yp = yb - PH                                 # 받침 윗면 중심
    hw0, hw1 = 25, 22                            # 몸통 반지름 아래/위
    SH = 120
    ye_ = yp - SH                                # 몸통 꼭대기(처마 석반 아래 중심)
    # 1. 받침 (돌 원통)
    for x in range(cx - R0, cx + R0 + 1):
        u = (x + .5 - cx) / R0
        if abs(u) > 1: continue
        d = R0 * RY * math.sqrt(1 - u * u)
        for y in range(int(yp + d), int(yb + d) + 1):
            t = tone_u(u); k = y - int(yp + d)
            if k == 6: t = max(1, t - 1)
            if (x + (6 if k < 6 else 0)) % 12 == 0 and k != 6: t = max(1, t - 1)
            if u > .9: t = 1
            put(x, y, SB[t])
    ell_top(cx, yp, R0, lambda uu, vv: SB[6] if uu * uu + vv * vv < .86 else SB[5])
    # 2. 몸통 (푸른 회석, 가로 줄눈은 곡선, 나무 띠 2개도 곡선)
    def hw_at(y): t = min(1., max(0., (y - ye_) / (yp - ye_))); return hw1 + (hw0 - hw1) * t
    bands = (ye_ + 38, ye_ + 82)
    for x in range(cx - hw0, cx + hw0 + 1):
        u0 = (x + .5 - cx) / hw0
        if abs(u0) > 1: continue
        ybot = yp + hw0 * RY * math.sqrt(1 - u0 * u0)
        for y in range(int(ye_), int(ybot) + 1):
            hw = hw_at(y)
            if abs(x + .5 - cx) > hw: continue
            u = (x + .5 - cx) / hw
            yc = y - hw * RY * math.sqrt(max(0, 1 - u * u))         # 곡선 기준 높이
            t = tone_u(u)
            row = int((yc - ye_) // 8)
            if int(yc - ye_) % 8 == 7: t = max(1, t - 1)             # 줄눈
            elif (int(x + (4 if row % 2 else 0)) % 10 == 0): t = max(1, t - 1)   # 세로 줄눈
            if u > .93: t = 1
            c = SB[t]
            for b in bands:
                if 0 <= yc - b < 4:
                    c = WD[max(1, min(5, t + (1 if yc - b < 1.5 else 0)))] ; 
            put(x, y, c)
    # 창 (아치, 원통 위 위치: u 에 따라 폭 줄고 옆으로 간다)
    def window(u, wy, glow=False):
        hw = hw_at(wy); xc = cx + u * hw
        sc = math.sqrt(1 - u * u); w = max(3, int(round(9 * sc)))
        x0 = int(round(xc - w / 2))
        for yy in range(wy - 12, wy + 6):
            for xx in range(x0, x0 + w):
                if yy - (wy - 12) < 4:
                    r = w / 2.0; dy = 4 - (yy - (wy - 12))
                    if ((xx + .5 - xc) ** 2) + dy * dy * (r * r / 16.) > r * r + .5: continue
                edge = xx == x0 or xx == x0 + w - 1 or yy == wy - 12
                if edge: put(xx, yy, WD[1])
                else: put(xx, yy, (SR[5] if glow else IN[3]) if xx < xc else (SR[4] if glow else IN[2]))
        for xx in range(x0 - 1, x0 + w + 1): put(xx, wy + 6, SB[6])      # 창턱
    window(-.40, ye_ + 26, glow=True); window(.42, ye_ + 26)
    window(0.0, ye_ + 66); window(-.62, ye_ + 66); window(.62, ye_ + 66)
    # 문 (받침 윗 몸통 밑, 앞 가운데): 아치 남색 문
    foot_d = yp + int(hw0 * RY) - 1; dw, dh = 14, 26
    dx0 = cx - dw // 2
    for y in range(foot_d - dh, foot_d + PH + 3):
        for x in range(dx0, dx0 + dw):
            top = foot_d - dh
            if y - top < 7:
                yy = 7 - (y - top); xx = abs(x + .5 - cx)
                if xx * xx + yy * yy > 49 + 3: continue
            col = IN[2] if (x - dx0) < dw // 2 else IN[3]
            if x == dx0 or x == dx0 + dw - 1 or y == top or x - dx0 == dw // 2: col = IN[1] if x - dx0 != dw // 2 else IN[0]
            put(x, y, col)
    for y in range(foot_d - dh + 8, foot_d + PH + 3, 7):
        for x in range(dx0 + 1, dx0 + dw - 1): put(x, y, ST[2])
    put(cx - 2, foot_d - 6, SR[5]); put(cx + 2, foot_d - 6, SR[5])
    for x in range(dx0 - 2, dx0 + dw + 2): put(x, foot_d - dh - 1, SB[5])
    for x in range(dx0 - 2, dx0 + dw + 2): put(x, foot_d + PH + 3, SB[6])        # 문턱
    # 초승달
    for y in range(-4, 5):
        for x in range(-4, 5):
            d1 = math.hypot(x, y); d2 = math.hypot(x - 2, y)
            if d1 <= 4.2 and d2 > 3.6: put(cx + x, foot_d - dh - 11 + y, SR[5] if x + y < 2 else SR[4])
    # 3. 처마 석반 (윗면 타원 고리 + 앞 두께 5)
    GR = 31
    for x in range(cx - GR, cx + GR + 1):
        u = (x + .5 - cx) / GR
        if abs(u) > 1: continue
        d = GR * RY * math.sqrt(1 - u * u)
        for y in range(int(ye_ + d), int(ye_ + d) + 6):
            t = tone_u(u) - 1
            if y - int(ye_ + d) >= 4: t -= 1
            put(x, y, SB[max(1, t)] if abs(u) < .95 else SB[1])
    ell_top(cx, ye_, GR, lambda uu, vv: SB[6] if uu < .35 else SB[5])
    # 4. 원뿔 지붕: 석반 윗면 안쪽에 앉는다 (밑 반지름 23), 높이 70
    CR = 23; cy0 = ye_; apex = cy0 - 76
    for y in range(apex, int(cy0 + CR * RY) + 1):
        for x in range(cx - CR, cx + CR + 1):
            u = (x + .5 - cx) / CR
            if abs(u) > 1: continue
            base = cy0 + CR * RY * math.sqrt(1 - u * u)                  # 밑 타원 앞 호
            if y > base: continue
            # 원뿔 측면 경계: 꼭대기에서 밑으로 폭이 늘어난다
            frac = (y - apex) / max(1, (cy0 - apex))
            half = CR * min(1.0, frac)
            if abs(x + .5 - cx) > half + .3: continue
            uu = (x + .5 - cx) / max(1.0, half)
            t = tone_u(uu)
            row = int((y - apex) // 5)
            sh = int((x + (2 if row % 2 else 0)) // 4)
            if (y - apex) % 5 == 4: t = max(1, t - 1)                    # 기와 줄
            elif (x + (2 if row % 2 else 0)) % 4 == 0: t = max(1, t - 1)
            if uu > .9: t = 1
            put(x, y, IN[max(1, min(4, t))] if t < 5 else IN[4])
    # 별
    def star(sx, sy, r, col=SR[5]):
        for k in range(-r, r + 1): put(sx + k, sy, col); put(sx, sy + k, col)
        if r >= 2: put(sx, sy, SR[6])
    star(cx - 4, apex + 34, 2); star(cx + 10, apex + 50, 1); star(cx - 12, apex + 52, 1)
    star(cx + 6, apex + 24, 1); star(cx - 3, apex + 14, 1)
    # 꼭대기 금 첨탑 (한 줄 기둥 + 작은 구)
    for y in range(apex - 8, apex + 2): put(cx, y, SR[3])
    put(cx, apex - 9, SR[5]); put(cx - 1, apex - 9, SR[4]); put(cx + 1, apex - 9, SR[2]); put(cx, apex - 10, SR[6])
    return pz.fin(Image.fromarray(im))

if __name__ == '__main__':
    t = tower(); print(t.size)
    bg = Image.new('RGBA', t.size, (110, 150, 90, 255)); bg.alpha_composite(t.convert('RGBA'))
    bg.resize((t.width * 3, t.height * 3), Image.NEAREST).save(os.path.join(HERE, '..', '_out-4', 'q', 'wt_new.png'))
