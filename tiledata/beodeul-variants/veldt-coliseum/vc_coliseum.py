# 투기장(콜로세움) 외피 — 3/4 시점 타원 원형 경기장. 높이장(heightfield)을 먼 줄(북)부터 가까운 줄(남)로 칠하는 화가 알고리즘:
#   땅 점 (gx, gy) 높이 h → 화면 (gx, gy - h). 앞(남) 줄이 낮으면 그 차이만큼 앞면(세로 벽)을 칠한다. 옆면은 없다(3/4 규약).
# 구역(타원 정규 반지름 ρ):
#   ρ∈[ρs,1]  외벽 윗길(갓돌, 높이 HW). 남쪽 반은 바깥 앞면(아치 2단 + 위층 attic, 버들항 성 마름돌), 북쪽 반은 안쪽 난간 면.
#   ρ∈[ρa,ρs] 관중석 계단(N 단, 디딤 윗면 + 챌면). 5단째는 넓은 통로 단(출입구 어둠 구멍).
#   ρ<ρa      경기장 — 외피에서는 비운다(투명). 바닥은 ground-arena-sand 로 아래층에 깐다. 북쪽 경계에 경기장 담(podium) 앞면.
# 북쪽 가운데: 지도자 발코니(덮개 지붕·기둥 둘·좌석 둘) + 그 아래 경기장 담의 쇠창살 문(지하 대기실로).
# 남쪽 가운데: 큰 정문 아치(문길 2칸, 걷기 + 가림). 윗길 둘레에 깃대.
import math
from vc_base import *
from v6pieces import GOLD as GOLDR
from px2 import _hash, vnoise

W, H = 512, 416
CX, RX, RY = 255.5, 246.0, 148.0
HW = 88; HS = 82; HP = 28; TOP = 18
CY = TOP + HW + RY                     # 254
RHO_S, RHO_A, NT = 0.955, 0.56, 10
PER = 30.0                             # 아치 주기(호 길이 px)
RR = math.sqrt((RX * RX + RY * RY) / 2)

def rho_th(gx, gy):
    dx = (gx + 0.5 - CX) / RX; dy = (gy + 0.5 - CY) / RY
    return math.hypot(dx, dy), math.atan2(dx, dy)          # θ=0 남쪽, +동

def tier_of(r):
    t = (r - RHO_A) / (RHO_S - RHO_A)
    return max(0, min(NT - 1, int(t * NT)))

def height(gx, gy):
    r, th = rho_th(gx, gy)
    if r > 1.0: return None, None
    if r >= RHO_S: return HW, 'rim'
    if r >= RHO_A:
        k = tier_of(r)
        return int(round(HP + (k + 1) * (HS - HP) / NT)), 'seat%d' % k
    return 0, 'arena'

def gate_open(u, z):
    """남쪽 정문 아치 안(문길): |u|<19, 위는 반원(기둥머리 z=26, 반지름 19)."""
    if abs(u) >= 19: return False
    if z <= 26: return True
    return math.hypot(u, z - 26) < 19

def arch_cell(w, z, z0, spring, rad=8.5):
    """아치 한 칸: w = 주기 안 위치(0..PER), z0 = 단 바닥. 반환 'open'/'jamb'/'pier'/None"""
    c = PER / 2
    d = abs(w - c)
    if z < z0: return None
    if z <= spring:
        if d < rad: return 'open'
        if d < rad + 2: return 'jamb'
    else:
        e = math.hypot(d, z - spring)
        if e < rad: return 'open'
        if e < rad + 2.4: return 'vous'
    return None

def outer_face(u, z, cz, sx):
    """바깥 앞면 색: u 호 길이(남쪽 0), z 높이(0=땅), cz 정면도(1=정면), sx 왼쪽(-1)~오른쪽(+1)."""
    k = 0.70 + 0.42 * max(0.0, cz * 0.85 - 0.30 * sx)
    k = min(1.10, k)
    w = (u + PER / 2) % PER
    X = int(u + 4000); Y = int(z)
    if abs(u) < 25 and z < 50:                                   # 정문
        if gate_open(u, z):
            d = 0.30 + 0.18 * (1 - min(1, z / 44.0))
            c = mul(ST[2], 0.62 + 0.35 * d)
            if z > 30 and (int(u + 40) % 5 == 2 or int(z) % 5 == 1) and z > 34: c = mul(ST[3], 0.9)      # 들어 올린 쇠창살
            if z < 3: c = mul(sand_px(X, Y), 0.55)
            if abs(u) > 16 and z < 26: c = mul(ST[3], 0.8 if u < 0 else 0.55)                        # 문길 안 옆벽(두께)
            return c
        e = math.hypot(u, max(0, z - 26))
        if e < 24.5 and z > 20:                                   # 아치돌(방사 줄눈)
            ang = math.degrees(math.atan2(z - 26, u)); c = ST[6] if u < 0 else ST[5]
            if int(ang + 360) % 13 < 2 or e > 23.5: c = ST[3]
            if 22.5 < e < 23.5: c = ST[4]
            return mul(c, k)
        if abs(u) < 23 and z < 26:                                # 문설주
            c = ST[6] if u < 0 else ST[4]
            if abs(u) > 21.5: c = ST[3]
            return mul(c, k)
    if z < 6:                                                     # 받침 띠
        c = ST[2] if z < 1 else (ST[5] if z >= 5 else mix(ash(X, Y, 1, 12, 4, 3), ST[4], 0.3))
        return mul(c, k)
    for (z0, sp, ztop) in ((6, 24, 36), (40, 56, 68)):
        if z0 <= z < ztop:
            a = arch_cell(w, z, z0, sp)
            if a == 'open':
                d = abs(w - PER / 2)
                c = ST[2]                                                          # 회랑 안쪽 벽
                if z < z0 + 3: c = mix(ST[2], ST[3], 0.6)                          # 회랑 바닥
                elif d < 5.5 and (z < sp - 1 or math.hypot(d, z - sp + 1) < 5.5): c = mul(ST[1], 0.85)   # 안쪽 아치(더 깊은 어둠)
                if w < PER / 2 - 6.5 and z >= z0 + 3: c = mix(ST[2], ST[3], 0.5)   # 안쪽 왼 기둥 두께(빛)
                return mul(c, 0.92)
            if a == 'jamb': return mul(ST[4] if w > PER / 2 else ST[6], k)
            if a == 'vous':
                ang = math.degrees(math.atan2(z - sp, w - PER / 2)); c = ST[6] if w < PER / 2 else ST[5]
                if int(ang + 360) % 18 < 3: c = ST[3]
                return mul(c, k)
            pil = min(w, PER - w)                                         # 반기둥(주기 경계)
            if pil < 3.2:
                c = ST[6] if w > PER - 3.2 and w < PER - 1.6 else (ST[5] if w > PER - 3.2 else (ST[4] if pil > 1.2 else ST[3]))
                if z >= ztop - 3: c = ST[6] if z == ztop - 1 else ST[5]               # 기둥머리
                if z < z0 + 2: c = ST[5]
                return mul(c, k)
            cc = ash(X, Y - z0, 1, 16, 8, 11 + z0)
            if z < z0 + 9 and _hash(X // 14, int(z) // 6, 91) > 0.7: cc = mix(cc, SANDA[4], 0.28)   # 아래 단 흙먼지
            return mul(cc, k)
    if 36 <= z < 40 or 68 <= z < 72:                              # 돌림띠(내민 처마): 맨 아래 그늘
        j = int(z) % 4 if z < 40 else int(z - 68)
        j = int(z - (36 if z < 40 else 68))
        c = (ST[2], ST[4], ST[5], ST[6])[j]
        if j == 1 and int(u + 4000) % 6 == 0: c = ST[3]              # 받침돌 줄
        return mul(c, k)
    if z < HW:                                                    # 위층(attic): 작은 네모 창 + 마름돌, 맨 위 갓돌
        if z >= HW - 3: return mul(ST[6] if z >= HW - 1 else ST[5], k)
        if 77 <= z <= 83 and abs(w - PER / 2) < 3 and int((u + PER / 2) // PER) % 2 == 0:
            return mul(ST[1], 0.9) if z < 83 else mul(ST[6], k)
        if z < 74 and abs(w) < 2 and int((u + PER / 2) // PER) % 2 == 1:        # 깃대 받침 돌
            return mul(ST[5], k)
        return mul(ash(X, Y - 72, 1, 16, 8, 77), k)
    return mul(ST[6], k)

def build_shell():
    o = Image.new('RGBA', (W, H)); px = o.load()
    hf = [[None] * W for _ in range(H)]
    tg = [[None] * W for _ in range(H)]
    for gy in range(H):
        for gx in range(W):
            hf[gy][gx], tg[gy][gx] = height(gx, gy)
    lab = {}     # 화면 화소 → 종류 (가림·통행 계산에 쓴다)
    src = np.full((H, W), -1, np.int32)   # 화면 화소 → 그 화소를 만든 땅 줄 gy (깊이 정렬용)
    for gy in range(H):
        for gx in range(W):
            h = hf[gy][gx]
            if h is None: continue
            tag = tg[gy][gx]
            r, th = rho_th(gx, gy)
            hn = hf[gy + 1][gx] if gy + 1 < H else None
            hn_v = 0 if hn is None else hn
            sx = (gx + 0.5 - CX) / RX
            # ---- 윗면
            sy = gy - h
            if tag != 'arena':
                if tag == 'rim':
                    edge_out = r > 0.993; edge_in = r < RHO_S + 0.008
                    u = th * RR
                    c = flag_px(int(u * 1.0 + 900), gy, 1.0)
                    c = mix(c, ST[5], 0.35)
                    if int(u + 900) % 11 == 0: c = ST[3]
                    if edge_out: c = ST[6] if th > -1.6 and th < 1.6 else ST[5]
                    if edge_in: c = ST[3]
                    put(px, W, H, gx, sy, c); lab[(gx, sy)] = 'rim'
                    if 0 <= sy < H: src[sy, gx] = gy
                else:
                    k = int(tag[4:])
                    rin = RHO_A + k * (RHO_S - RHO_A) / NT; rout = RHO_A + (k + 1) * (RHO_S - RHO_A) / NT
                    u = th * RR * r
                    base = mix(ST[5], roman.CRM[4], 0.45)
                    if k % 2 == 1: base = mul(base, 0.93)
                    if k == 4: base = mix(flag_px(int(u) + 500, gy), ST[4], 0.4)      # 넓은 통로 단
                    c = base
                    if k != 4 and int(u + 2000) % 9 == 0: c = ST[4]                     # 좌석 칸 줄
                    north = abs(th) > math.pi / 2
                    near_edge = (r - rin) * RY < 1.1 if north else (rout - r) * RY < 1.1
                    far_edge = (rout - r) * RY < 1.0 if north else (r - rin) * RY < 1.0
                    if near_edge: c = ST[6]
                    elif far_edge: c = mix(base, ST[3], 0.6)
                    if _hash(gx, gy, 5) > 0.93: c = mix(c, ST[4], 0.5)
                    put(px, W, H, gx, sy, c); lab[(gx, sy)] = 'seat'
                    if 0 <= sy < H: src[sy, gx] = gy
            # ---- 앞면 (앞 줄이 낮을 때)
            if h > hn_v and tag != 'arena':
                cz = math.sqrt(max(0.0, 1 - sx * sx))
                for y in range(sy + 1, gy - hn_v + 1):
                    z = gy - y
                    if tag == 'rim' and hn is None:                         # 바깥 앞면(남쪽 반)
                        c = outer_face(th * RR, z, cz, sx)
                        lab[(gx, y)] = 'gate' if (abs(th * RR) < 19 and gate_open(th * RR, z)) else 'outer'
                    elif tag == 'rim':                                       # 안쪽 난간 면(북쪽 반)
                        kk = 0.78 + 0.18 * sx
                        c = mul(ash(int(th * RR * RHO_S + 3000), z, 1, 10, 4, 21), kk)
                        if z == HW - 1: c = ST[6]
                        lab[(gx, y)] = 'parapet'
                    elif hn == 0:                                           # 경기장 담(podium) 앞면
                        kk = 0.80 + 0.16 * sx
                        u = th * RR * RHO_A
                        c = mul(ash(int(u + 3000), z, 1, 12, 6, 31), kk)
                        if z >= HP - 2: c = ST[6] if z == HP - 1 else ST[5]
                        if z < 2: c = ST[2]
                        if 6 < z < 20 and int(u + 3000) % 46 < 2: c = ST[3]
                        lab[(gx, y)] = 'podium'
                    else:                                                   # 관중석 챌면
                        kk = 0.74 + 0.20 * sx
                        k = int(tag[4:])
                        u = th * RR * r
                        c = mul(ash(int(u + 3000), z, 1, 10, 6, 41 + k), kk * 0.80)
                        if y == sy + 1: c = mul(ST[3], kk)
                        if k == 5 and int(u + 3000) % 64 < 7 and z < h - 1:            # 통로 출입구(어둠)
                            c = ST[1]
                        lab[(gx, y)] = 'riser'
                    put(px, W, H, gx, y, c)
                    if 0 <= y < H: src[y, gx] = gy
    o.src = src
    return o, lab

def ground_y(th, r=1.0):
    return CY + RY * r * math.cos(th), CX + RX * r * math.sin(th)

def balcony():
    """지도자 발코니: 경기장 담 위로 내민 귀빈석. 앞면(마름돌 + 쇠창살 문 + 걸개 둘) · 바닥(판석, 난간) · 기둥 둘 · 덮개(붉은 천 + 금 술)."""
    w, h = 80, 104
    o = Image.new('RGBA', (w, h)); px = o.load()
    base = h - 1; fz = 46                    # 앞면 높이(땅 → 귀빈석 바닥)
    for y in range(base - fz, base + 1):
        z = base - y
        for x in range(4, w - 4):
            c = ash(x, z, 1, 12, 6, 51)
            if x < 6: c = mix(c, ST[6], 0.5)
            if x > w - 7: c = mul(c, 0.78)
            if z < 2: c = ST[2]
            if z > fz - 4: c = (ST[6], ST[5], ST[4], ST[2])[fz - z] if fz - z < 4 else c
            put(px, w, h, x, y, c)
    # 쇠창살 문(가운데, 폭 26, 높이 26) — 지하 대기실로
    gx0, gx1 = w // 2 - 13, w // 2 + 13; sp = 16
    for y in range(base - 30, base + 1):
        z = base - y
        for x in range(gx0 - 3, gx1 + 3):
            d = abs(x + 0.5 - w / 2)
            inside = (z <= sp and d < 13) or (z > sp and math.hypot(d, z - sp) < 13)
            ring = (z <= sp and 13 <= d < 15.5) or (z > sp and 13 <= math.hypot(d, z - sp) < 16)
            if inside:
                c = mix(ST[1], ST[2], 0.25 if z > 3 else 0.6)
                if (int(x - gx0) % 4 == 1 and z > 1) or (z % 7 == 3):
                    c = roman.ramp('iron')[3 if int(x - gx0) % 4 == 1 else 2]
                put(px, w, h, x, y, c)
            elif ring:
                ang = math.degrees(math.atan2(z - sp, x + 0.5 - w / 2)) if z > sp else 0
                c = ST[6] if x < w / 2 else ST[4]
                if z > sp and int(ang + 360) % 15 < 3: c = ST[3]
                put(px, w, h, x, y, c)
    # 귀빈석 바닥(판석 윗면 깊이 14) + 앞 난간(낮은 돌 난간 + 작은 기둥)
    fy = base - fz
    for y in range(fy - 14, fy):
        for x in range(4, w - 4): put(px, w, h, x, y, mix(flag_px(x, y), ST[5], 0.3))
    for x in range(4, w - 4):
        for j in range(7):
            y = fy - 1 - j
            if j in (0, 6): c = ST[6] if j == 6 else ST[3]
            elif (x - 4) % 6 in (2, 3): c = ST[5] if (x - 4) % 6 == 2 else ST[4]
            else: c = None
            if j == 5: c = ST[5]
            if c is not None: put(px, w, h, x, y, c)
    # 좌석 둘(등받이: 금 테 + 붉은 천) — 사람 없음
    for cx_ in (w // 2 - 11, w // 2 + 5):
        for y in range(fy - 26, fy - 7):
            for x in range(cx_, cx_ + 7):
                e = x in (cx_, cx_ + 6) or y == fy - 26
                c = GOLDR[4] if e and x == cx_ else (GOLDR[3] if e else (roman.ramp('red')[4] if x < cx_ + 3 else roman.ramp('red')[3]))
                if y < fy - 24 and x in (cx_, cx_ + 6): continue
                put(px, w, h, x, y, c)
        for x in range(cx_ - 1, cx_ + 8): put(px, w, h, x, fy - 8, GOLDR[5]); put(px, w, h, x, fy - 7, GOLDR[2])
    # 기둥 둘(앞 모서리)
    for x0 in (6, w - 11):
        for y in range(fy - 40, fy - 6):
            for x in range(x0, x0 + 5):
                c = (ST[6], ST[6], ST[5], ST[4], ST[3])[x - x0]
                put(px, w, h, x, y, c)
        for x in range(x0 - 1, x0 + 6): put(px, w, h, x, fy - 41, ST[6]); put(px, w, h, x, fy - 40, ST[4])
    o = pz.fin(o)
    # 덮개: 붉은 천 지붕(뒤로 기운 윗면) + 앞 장막(물결 술)
    R = roman.ramp('red'); G = GOLDR
    c = C(w, h, seed=611); c.group(1)
    top = fy - 62
    for y in range(top, fy - 44):
        f = (y - top) / 18.0
        x0 = int(10 - 8 * f); x1 = int(w - 10 + 8 * f)
        for x in range(x0, x1):
            t = 5 if (x - x0) % 10 < 5 else 4
            if y == top: t = 6
            c.tone(x, y, 'red', t)
    for x in range(2, w - 2):                                  # 앞 장막(물결)
        dd = 3 + int(2 * (0.5 + 0.5 * math.sin((x - 2) * math.pi / 8)))
        for j in range(dd):
            c.tone(x, fy - 44 + j, 'red', 3 if j < dd - 1 else 2)
        c.tone(x, fy - 44, 'gold', 5)
        if (x - 2) % 8 == 4: c.tone(x, fy - 44 + dd, 'gold', 4)
    c.new(); c.tone(w // 2, top - 3, 'gold', 6); c.tone(w // 2, top - 2, 'gold', 4); c.tone(w // 2 - 1, top - 2, 'gold', 5); c.tone(w // 2, top - 1, 'gold', 3)
    o.alpha_composite(F(c))
    # 걸개 둘(쇠창살 문 양옆, 단색)
    for bx in (12, w - 24):
        b = roman.banner_hanging('red', 26)
        o.alpha_composite(b, (bx, base - fz + 6))
    return o

def pennant_pole(col='red', seed=0):
    """윗길 깃대: 쇠 깃대 + 단색 삼각기(바람에 동쪽으로)."""
    w, h = 16, 32
    c = C(w, h, seed=620 + seed); c.group(1); c.new()
    for y in range(4, 31): c.tone(4, y, 'iron', 5); c.tone(5, y, 'iron', 3)
    c.tone(4, 3, 'gold', 6); c.tone(5, 3, 'gold', 4)
    c.group(2); c.new()
    for j in range(7):
        L = int(10 * (1 - j / 7 * 0.6))
        for i in range(L):
            yy = 5 + j + int(round(math.sin((i + seed) / 2.6) * 0.8))
            t = 5 if j < 2 else (4 if j < 5 else 3)
            if i > L - 3: t -= 1
            c.tone(6 + i, yy, col, t)
    c.group(3); c.new(); c.tone(3, 30, 'stone', 4); c.tone(6, 30, 'stone', 3)
    return F(c)

def coliseum_layers():
    """외피를 땅 줄(16px)마다 잘라 깊이 정렬용 조각으로: [(img, x, y, sorty)] (외피 원점 기준)."""
    shell, lab = build_shell()
    src = shell.src; shell = pz.fin(shell, 0.70)                 # 버들항 소품과 같은 안쪽 윤곽
    A = np.array(shell)
    out = []
    for b in range(0, H // 16 + 1):
        m = (src // 16 == b) & (A[:, :, 3] > 0)
        if not m.any(): continue
        ys, xs = np.where(m); y0, y1 = ys.min(), ys.max() + 1; x0, x1 = xs.min(), xs.max() + 1
        a = A[y0:y1, x0:x1].copy(); a[~m[y0:y1, x0:x1]] = 0
        out.append((Image.fromarray(a, 'RGBA'), int(x0), int(y0), (b + 1) * 16))
    return out, lab

def coliseum_extras():
    """깃대·발코니·정문 걸개: [(img, x, y, sorty)]."""
    ex = []
    for i, a in enumerate((-160, -132, -104, 104, 132, 160, 180, -78, -52, -26, 26, 52, 78)):
        th = a * math.pi / 180
        col = 'red' if i % 2 == 0 else 'shroom'
        gy, gx = ground_y(th, (RHO_S + 1) / 2)
        p = pennant_pole(col, int(abs(a)) % 7)
        ex.append((p, int(gx) - 4, int(gy - HW) - p.height + 2, int(gy) + 1))
    b = balcony(); gy_p = CY - RY * RHO_A
    ex.append((b, int(CX - b.width / 2), int(gy_p - b.height + 2), (int(gy_p) // 16 + 1) * 16 + 1))
    for du in (-30, 30):
        th = du / RR; gy, gx = ground_y(th)
        ex.append((roman.banner_hanging('red', 22), int(gx - 6), int(gy - 66), int(gy) + 1))
    return ex

def coliseum():
    lay, lab = coliseum_layers()
    im = Image.new('RGBA', (W, H))
    for (img, x, y, sy) in sorted(lay + coliseum_extras(), key=lambda t: t[3]):
        im.alpha_composite(img, (max(0, x), max(0, y)))
    return im, lab

def coliseum_old():
    shell, lab = build_shell()
    im = Image.new('RGBA', (W, H))
    # 깃대(북쪽 반 → 외피 뒤, 남쪽 반 → 외피 위): 윗길 점에 꽂는다
    poles_back, poles_front = [], []
    for i, th in enumerate([a * math.pi / 180 for a in (-160, -132, -104, 104, 132, 160, 180)]):
        poles_back.append((th, 'red' if i % 2 == 0 else 'shroom'))
    for i, th in enumerate([a * math.pi / 180 for a in (-78, -52, -26, 26, 52, 78)]):
        poles_front.append((th, 'red' if i % 2 else 'shroom'))
    im.alpha_composite(shell)
    for th, col in poles_back + poles_front:
        gy, gx = ground_y(th, (RHO_S + 1) / 2)
        p = pennant_pole(col, int(th * 10) % 7)
        x = int(gx) - 4; y = int(gy - HW) - p.height + 2
        im.alpha_composite(p, (max(0, x), max(0, y)))
    # 지도자 발코니: 북쪽 경기장 담 가운데
    b = balcony()
    gy_p = CY - RY * RHO_A
    im.alpha_composite(b, (int(CX - b.width / 2), int(gy_p - b.height + 2)))
    # 정문 위 걸개 둘(2층 아치 사이)
    for du in (-30, 30):
        th = du / RR; gy, gx = ground_y(th)
        bnr = roman.banner_hanging('red', 22)
        im.alpha_composite(bnr, (int(gx - 6), int(gy - 66)))
    return im, lab

def walk_mask(cells_w, cells_h):
    """외피의 칸 통행(지도 칸 기준, 외피 왼쪽 위 = (0,0)): '#' 막힘, '.' 걷기(경기장 모래·정문 문길), 'G' 북쪽 쇠창살 문(이벤트)."""
    rows = []
    for cy in range(cells_h):
        row = ''
        for cx in range(cells_w):
            gx, gy = cx * 16 + 8, cy * 16 + 8
            r, th = rho_th(gx, gy)
            if r > 1.0: ch = ' '
            elif r < RHO_A - 0.035: ch = '.'
            else: ch = '#'
            # 정문 문길: 가운데 두 칸(x 15·16), 외벽 → 경기장
            if cx in (15, 16) and gy > CY and r <= 1.0: ch = '.'
            rows.append if False else None
            row += ch
        rows.append(row)
    # 북쪽 쇠창살 문 앞 칸
    gy_p = CY - RY * RHO_A
    gyc = int(gy_p // 16)
    rows[gyc] = rows[gyc][:15] + 'GG' + rows[gyc][17:]
    return rows

def arcade_segment(n=3):
    """곧은 아치 벽 조각(n칸 폭 × 6칸): 콜로세움 외벽과 같은 2단 아치 + 위층. 담·경기장 앞면을 곧게 이어 쓸 때."""
    w = n * 16; h = HW + 8
    o = Image.new('RGBA', (w, h)); px = o.load()
    for x in range(w):
        for z in range(HW):
            u = x - w / 2 + PER / 2 + 40
            c = outer_face(u + 200, z, 1.0, (x - w / 2) / w * 0.4)
            put(px, w, h, x, h - 1 - z, c)
        for j in range(8):                       # 윗길 갓돌(윗면 8px)
            y = h - 1 - HW - j
            c = mix(flag_px(x, j), ST[5], 0.35) if j not in (0, 7) else (ST[3] if j == 7 else ST[6])
            put(px, w, h, x, y, c)
    return pz.fin(o)
