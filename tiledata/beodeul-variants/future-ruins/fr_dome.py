# 미래 폐허 앵커 ① — 반쯤 무너진 유리 돔(앞면 철골 골조 + 깨진 유리 + 콘크리트 받침 고리 + 앞 출입구 현관).
# 3/4 투영: 화면 (x, q*y - z), q = 0.5 (버들항 원통 윗면 타원 ry ≈ 0.45~0.5 rx 와 같은 눌림). 빛은 왼쪽 위(북서·위).
# 화소마다 반구와 시선의 두 교점을 구한다: 큰 근 = 바깥 앞면, 작은 근 = 뒤쪽 안벽(안에서 본 면).
# 앞면 유리판이 빠졌거나 무너진 자리에서는 뒤 안벽을, 안벽 교점이 땅 밑이면 안 바닥(잔해)을 그린다.
import math
import numpy as np
from fr_mat import *
from fr_base import _hash

Q = 0.5
LV = np.array([-0.55, -0.45, 0.70]); LV = LV / np.linalg.norm(LV)
HV = LV + np.array([0, 0.75, 0.45]); HV = HV / np.linalg.norm(HV)


def dome(R=80, hb=18, seed=3, collapse=(0.42, 0.78, 0.50, 0.36)):
    """R: 반지름 px, hb: 받침 고리(드럼) 높이 px. collapse = (중심 경도, 중심 위도, 경도 폭, 위도 폭) 무너진 구멍."""
    top = int(math.ceil(R * math.sqrt(1 + Q * Q))) + hb + 3
    Wd = 2 * R + 16; Hd = top + int(Q * R) + 3
    cx = Wd / 2.0; cy = top
    tc = TC(Wd, Hd, seed)
    NPHI, NTH = 20, 4
    dphi = 2 * math.pi / NPHI; dth = (math.pi / 2) / NTH
    c_phi, c_th, w_phi, w_th = collapse

    def pane_of(phi, th): return (int((phi + math.pi) / dphi) % NPHI, min(NTH - 1, int(th / dth)))

    def pane_state(i, j):
        """0 = 성한 유리, 1 = 금 간 유리, 2 = 빠진 유리, 3 = 무너짐(리브까지 없음).
        무너짐은 화면 공간의 들쭉날쭉한 「물린 자리」(오른쪽 위)로 정한다: 판 가운데가 그 안에 비치면 앞이든 뒤든 무너진다."""
        phi = (i + .5) * dphi - math.pi; th = (j + .5) * dth
        x = R * math.cos(th) * math.cos(phi); y = R * math.cos(th) * math.sin(phi); z = R * math.sin(th)
        sx, sy = x, Q * y - z
        h = _hash(i, j, seed + 1)
        r = math.hypot((sx - c_phi * R) / (w_phi * R), (sy + c_th * R) / (w_th * R))
        if r < 1.0 + 0.5 * (h - .5): return 3
        if r < 1.5 and h < .55: return 2
        if h < .07 and j < NTH - 1: return 2
        if h < .2: return 1
        return 0

    STATE = {(i, j): pane_state(i, j) for i in range(NPHI) for j in range(NTH)}
    # 무너진 칸의 리브: 굵은 경선 몇 개만 짧게 남는다(부러진 끝)
    def rib_survives(i, j, th):
        if STATE[(i, j)] != 3: return True
        h = _hash(i, j, seed + 6)
        return (i % 2 == 0) and th < (j + h * 0.8) * dth

    def hit(sx, sy):
        a2 = 1 + Q * Q; b = -2 * Q * sy; c = sy * sy + sx * sx - R * R
        disc = b * b - 4 * a2 * c
        if disc < 0: return None
        out = []
        for root in ((-b + math.sqrt(disc)) / (2 * a2), (-b - math.sqrt(disc)) / (2 * a2)):
            y = root; z = Q * y - sy
            out.append((sx, y, z))
        return out

    kind = np.zeros((Hd, Wd), np.int8); pid = np.full((Hd, Wd), -1, np.int32); PT = np.zeros((Hd, Wd, 3))
    for py in range(Hd):
        for px_ in range(Wd):
            h2 = hit(px_ + .5 - cx, py + .5 - (cy - hb))
            if h2 is None: continue
            (x, y, z), (xb, yb, zb) = h2
            if z < 0: continue
            phi = math.atan2(y, x); th = math.asin(max(-1, min(1, z / R)))
            i, j = pane_of(phi, th)
            st = STATE[(i, j)]
            kind[py, px_] = (1, 1, 4, 5)[st]; pid[py, px_] = i * 10 + j; PT[py, px_] = (x, y, z)
    # 리브 판정(앞면 칸끼리 경계)
    def is_rib(px_, py):
        me = pid[py, px_]
        for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            xx, yy = px_ + dx, py + dy
            if 0 <= xx < Wd and 0 <= yy < Hd and kind[yy, xx] in (1, 4, 5) and pid[yy, xx] != me: return True
        return False

    for py in range(Hd):
        for px_ in range(Wd):
            kd = kind[py, px_]
            if kd == 0: continue
            x, y, z = PT[py, px_]
            n = np.array([x, y, z]) / R
            d = float(n @ LV)
            th = math.asin(max(-1, min(1, z / R))); phi = math.atan2(y, x)
            i, j = pane_of(phi, th)
            rib = is_rib(px_, py)
            if rib and (kd != 5 or rib_survives(i, j, th)):
                k = 1.6 + max(0, d) * 4.6
                tc.px(px_, py, 'steel', clamp(round(k), 1, 6)); continue
            if kd == 1:                                            # 유리
                refl = 0.55 * (z / R) - 0.35 * (x / R) + 0.55 * max(0, d)
                k = 1.6 + refl * 3.2 + (_hash(i, j, seed + 9) - .5) * 1.1
                sp = float(n @ HV)
                if sp > 0.975: k = 6
                elif sp > 0.94: k = max(k, 5)
                fth = (th / dth) % 1.0; fphi = ((phi + math.pi) / dphi) % 1.0
                if j == 0:                                         # 아래 단: 먼지·이끼로 탁하다(아래로 갈수록 짙게)
                    k -= 0.8 * (1 - fth)
                    if vnoise(px_, py, 3, seed + 5) * 0.9 + _hash(px_, py, seed + 6) * 0.25 > 0.62 + 0.5 * fth:
                        tc.px(px_, py, 'sick', clamp(2 + round(_hash(py, px_, 1) * 2.2), 1, 6)); continue
                if STATE[(i, j)] == 1:                             # 때 낀 유리: 한 단 탁하고 위에서 흘러내린 줄
                    k -= 0.7
                    if _hash(int(fphi * 9), i * 7 + j, seed + 15) < .3 and fth < .8: k -= 0.6
                tc.px(px_, py, 'glass', clamp(round(k), 1, 6)); continue
            # 빠진 칸·무너진 칸: 뒤쪽을 본다
            h2 = hit(px_ + .5 - cx, py + .5 - (cy - hb))
            xb, yb, zb = h2[1]
            if zb >= 0:                                            # 뒤 안벽(안에서 본 유리·리브, 어둡다)
                thb = math.asin(max(-1, min(1, zb / R))); phib = math.atan2(yb, xb)
                ib, jb = pane_of(phib, thb)
                if STATE[(ib, jb)] == 3: continue                  # 뒤까지 무너졌다 → 너머 땅이 보인다(투명)
                fb = ((phib + math.pi) / dphi) % 1.0; tb = (thb / dth) % 1.0
                if fb < 0.07 or tb < 0.06: tc.px(px_, py, 'steel', 1)
                else: tc.px(px_, py, 'glass', 1 + (1 if (zb / R > .45 and _hash(ib, jb, seed + 3) > .4) else 0))
            else:                                                  # 안 바닥(잔해: 콘크리트 덩이·유리 조각)
                # 바닥 점 = 시선이 z=0 과 만나는 곳
                gx = px_ + .5 - cx; gy = (py + .5 - (cy - hb)) / Q
                v = vnoise(gx, gy, 4, seed + 12) + 0.35 * vnoise(gx, gy, 1.5, seed + 14)
                v2 = vnoise(gx - 1.5, gy - 3, 4, seed + 12) + 0.35 * vnoise(gx - 1.5, gy - 3, 1.5, seed + 14)
                mat = 'conc'
                if v > .78: k = 3 if v2 < v - .04 else 2          # 잔해 덩이 윗면(왼쪽 위 빛)
                elif v > .6: k = 2
                else: k = 1; mat = 'dark'
                if _hash(px_, py, seed + 13) < .012: tc.px(px_, py, 'glass', 5); continue
                tc.px(px_, py, mat, k)
    # 유리판마다 손 도트 테: 리브 바로 아래·오른쪽 1px 은 밝게(빛 받은 유리 모), 리브 바로 위·왼쪽 1px 은 어둡게
    G = tc.m == MID['glass']; R_ = tc.m == MID['steel']
    up = np.roll(R_, 1, 0); lf = np.roll(R_, 1, 1); dn = np.roll(R_, -1, 0); rt = np.roll(R_, -1, 1)
    hi = G & (up | lf) & (tc.t < 6); lo = G & (dn | rt) & ~hi
    tc.t = np.where(hi, np.minimum(tc.t + 1, 6), np.where(lo, np.maximum(tc.t - 1, 1), tc.t))
    # 판 안 잔 반사 점(손 도트 결): 판마다 왼쪽 위 모서리 근처 짧은 빛 두 점
    Yy, Xx = np.mgrid[0:Hd, 0:Wd]
    sp = G & (hash2(Xx // 2, Yy // 2, seed + 40) > .99) & ~hi & (tc.t >= 3)
    tc.t = np.where(sp, np.minimum(tc.t + 2, 6), tc.t)
    # 무너진 가장자리: 부러진 리브 끝 녹·유리 날 반짝임
    for py in range(1, Hd - 1):
        for px_ in range(1, Wd - 1):
            if kind[py, px_] != 1: continue
            if any(kind[py + dy, px_ + dx] == 5 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g = tc.get(px_, py)
                if g and g[0] == 'steel': tc.px(px_, py, 'rust', 4)
                elif g: tc.px(px_, py, 'glass', 6 if _hash(px_, py, seed + 8) < .45 else 5)
    # 구멍 안으로 휘어 늘어진 철골 둘
    for (f0, f1, sag) in (((0.25, -0.88), (0.68, -0.30), 9), ((0.48, -0.74), (0.86, -0.12), 6)):
        x0 = cx + R * f0[0]; y0 = cy - hb + R * f0[1]; x1 = cx + R * f1[0]; y1 = cy - hb + R * f1[1]
        nn = int(abs(x1 - x0) + abs(y1 - y0)) * 2
        for s in range(nn):
            f = s / nn; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f + sag * 4 * f * (1 - f)
            if 0 <= int(y) < Hd and 0 <= int(x) < Wd and kind[int(y), int(x)] == 5:
                tc.px(x, y, 'steel', 4 if f < .4 else 3); tc.px(x, y + 1, 'steel', 1)
    # ---- 받침 고리(콘크리트 드럼)
    for py in range(Hd):
        for px_ in range(Wd):
            sx = px_ + .5 - cx
            if abs(sx) > R: continue
            yb = Q * math.sqrt(max(0, R * R - sx * sx)); ytop = yb - hb; sy = py + .5 - cy
            if not (ytop <= sy <= yb): continue
            u = (sx + R) / (2 * R)
            k = 5 if u < .2 else (4 if u < .62 else (3 if u < .9 else 2))
            fy = sy - ytop
            ang = math.acos(max(-1, min(1, sx / R)))
            seg = int(ang / (math.pi / 12))
            if fy < 1: k = 6
            elif fy < 3: k = 5
            elif fy < 4: k = 2
            elif fy >= hb - 1: k = 1
            elif fy >= hb - 3: k -= 1
            else:
                e = abs(ang - round(ang / (math.pi / 12)) * (math.pi / 12)) * math.sqrt(max(1, R * R - sx * sx))
                if e < 0.7: k = 2
                elif e < 1.6 and ang > round(ang / (math.pi / 12)) * (math.pi / 12): k += 1
            mat = 'conc'
            if fy > hb * .45 and _hash(seg, int(fy // 3), seed + 21) < .18: mat = 'sick'; k = clamp(k - 1, 2, 4)
            tc.px(px_, py, mat, clamp(k, 1, 6))
    # ---- 출입구 현관(강철 상자: 윗면 + 앞면, 열린 문, 위 경고 띠, 녹)
    vw, vtop, vfront = 34, 7, 24
    vx0 = int(cx - vw / 2); vy1 = Hd; vy0 = vy1 - vtop - vfront
    box(tc, vx0, vy0, vx0 + vw, vy1, vtop, 'steel', base=3, seed=seed + 30)
    panels(tc, vx0 + 1, vy0 + 1, vx0 + vw - 1, vy0 + vtop, 'steel', 4, 16, 6, face='top', rivets=False, seed=seed + 31)
    hazard(tc, vx0, vy0 + vtop, vx0 + vw, vy0 + vtop + 3, seed=seed + 32)
    dx0, dx1 = vx0 + 7, vx0 + vw - 7
    for y in range(vy0 + vtop + 5, vy1):
        for x in range(dx0, dx1):
            tc.px(x, y, 'dark', 1 if y > vy0 + vtop + 12 else 2)
    for x in range(dx0, dx1):                                      # 반쯤 내려온 셔터 날
        for y in range(vy0 + vtop + 5, vy0 + vtop + 11):
            tc.px(x, y, 'steel', (4 if (y - vy0) % 2 else 3) - (1 if x >= dx1 - 2 else 0))
        tc.px(x, vy0 + vtop + 11, 'steel', 1)
    for y in range(vy0 + vtop + 5, vy1):                           # 문틀
        tc.px(dx0 - 1, y, 'steel', 1); tc.px(dx1, y, 'steel', 5)
    for (lx, col) in ((vx0 + 3, 'cyan'), (vx0 + vw - 5, 'redl')):  # 문 옆 표시등(하나는 꺼짐)
        tc.px(lx, vy0 + vtop + 8, col, 5); tc.px(lx + 1, vy0 + vtop + 8, col, 4); tc.px(lx, vy0 + vtop + 9, col, 3); tc.px(lx + 1, vy0 + vtop + 9, col, 2)
    rustify(tc, vx0, vy0, vx0 + vw, vy1, amount=.25, seed=seed + 4)
    tc.grain(.05, mats=('conc', 'steel', 'rust'))
    return tc.fin(.62)
