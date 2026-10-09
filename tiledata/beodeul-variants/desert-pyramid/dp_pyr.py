# 사막 피라미드·고분 조각 — 계단식 사암 피라미드, 마스타바 무덤, 흙무덤(고분), 오벨리스크, 석상, 기둥, 잔해.
# 석재 = 버들항 성 마름돌(castle6.ash) 구조를 사암 램프로 바꾼 dp_art.sash. 3/4 시점(윗면+앞면, 옆면 없음), 빛 왼쪽 위,
# pz.fin 안쪽 윤곽. 결정적(같은 입력 = 같은 그림).
import math
from PIL import Image
import dp_art as A
from dp_art import SS, SA, BR, sash, mix, mul, hx, PAL
import pz
from px2 import _hash, C

SHADOW = (40, 22, 10)


def _put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(c[:3]) + (a,)


def _h(*k):
    v = 0
    for i, kk in enumerate(k): v = v * 131 + int(kk) * (7 + i * 13)
    return _hash(v, 3, 9301)


def _top(x, y, seed, lit=True):
    """윗면(디딤·평지붕) 판석: 가로로 긴 판, 줄눈 옅게, 모래 점."""
    c = sash(x, y, bw=20, bh=5, seed=seed)
    c = mix(c, SS[5], 0.45 if lit else 0.1)
    if _h(x, y, seed) < 0.06: c = SA[5]
    return c


def _sand_heap(px, W, H, cx, cy, rx, ry, seed, lit_side=-1):
    """쌓인 모래 더미(반 타원): 왼쪽 위 밝게, 오른쪽 아래 어둡게, 마루에 잔물결 한 줄."""
    for y in range(int(cy - ry), int(cy) + 1):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            jag = (_h(x, seed) - 0.5) * 0.12
            if dx * dx + dy * dy > 1 + jag: continue
            nz = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
            lum = 0.55 + 0.45 * (-0.55 * dx - 0.65 * dy + 0.75 * nz)
            t = 6 if lum > 0.98 else (5 if lum > 0.8 else (4 if lum > 0.55 else 3))
            if _h(x, y, seed + 1) > 0.93: t = max(2, t - 1)
            if _h(x, y, seed + 2) > 0.97: t = min(6, t + 1)
            _put(px, W, H, x, y, SA[t])


# ================================================================ 계단식 피라미드 (24x12칸)
def pyramid():
    """계단식 사암 피라미드: 6단. 단마다 앞면(마름돌 3~5줄, 위 1px 처마 그늘)과 밝은 디딤 윗면이 보이고, 양옆은 디딤이
    계단꼴로 물러난다. 맨 아랫단 가운데에 어두운 입구(문설주·두꺼운 상인방), 그 위로 꼭대기까지 가운데 계단과 난간.
    오른쪽 위 3단이 무너져 거친 속 돌(심석)이 드러나고, 떨어진 마름돌이 오른쪽 디딤과 밑동에 흩어졌다. 밑동엔 모래가 쌓였다."""
    W, H = 384, 196
    o = Image.new('RGBA', (W, H)); px = o.load()
    NT = 6; rh = [30, 18, 18, 18, 18, 18]; td = 10; ss = 27
    yb = H - 4
    tiers = []
    y = yb
    for i in range(NT):
        x0, x1 = i * ss, W - i * ss
        fb = y; ft = fb - rh[i]
        tiers.append((x0, x1, ft, fb))
        y = ft - td
    top_y = y - 6
    # ---- 윗면(디딤·옆 물러남·꼭대기 평대)
    for i in range(NT):
        x0, x1, ft, fb = tiers[i]
        ytop = (tiers[i + 1][2] - td) if i + 1 < NT else top_y
        for yy in range(ytop, ft):
            for x in range(x0, x1):
                if i + 1 < NT:
                    nx0, nx1, nft, nfb = tiers[i + 1]
                    if nx0 <= x < nx1 and yy >= nft: continue
                lit = x < W / 2
                c = sash(x, yy, bw=24, bh=5, seed=11 + i)
                c = mix(c, SS[5], 0.72 if lit else 0.45)
                if _h(x, yy, 13 + i) < 0.05: c = SA[5]
                if yy == ft - 1: c = SS[6] if lit else SS[5]                     # 디딤 앞 모(밝다)
                if x == x0: c = SS[6]
                elif x >= x1 - 2: c = SS[3]
                if i + 1 < NT and yy == ytop and not (tiers[i + 1][0] <= x < tiers[i + 1][1]): c = SS[5]
                _put(px, W, H, x, yy, c)
    # ---- 앞면(마름돌): 바탕은 디딤보다 한 단 어둡다
    for i in range(NT):
        x0, x1, ft, fb = tiers[i]
        for yy in range(ft, fb + 1):
            for x in range(x0, x1):
                z = fb - yy
                c = mul(sash(x + i * 5, 200 - z, bw=18 if i else 20, bh=9 if i else 10, seed=21 + i), 0.94)
                if x == x0: c = SS[5]
                if x >= x1 - 3: c = mul(c, 0.85)
                if yy == ft: c = SS[2]                                          # 디딤 밑 처마 그늘
                elif yy == ft + 1: c = mix(c, SS[3], 0.5)
                if i == 0 and z < 3: c = mix(SS[3], SS[2], 0.4) if z == 0 else SS[3]   # 굽돌 그늘
                _put(px, W, H, x, yy, c)
    # ---- 가운데 계단(단 1 ~ 꼭대기) + 양 난간
    cx = W // 2; sw = 22; bw_ = 6
    ys = tiers[1][3]; ye = top_y + 2
    for yy in range(ye, ys + 1):
        k = (ys - yy)
        for x in range(cx - sw - bw_, cx + sw + bw_):
            dx = x - cx
            if abs(dx) < sw:
                ph = k % 4
                if ph < 2: c = SS[6] if (dx < 0 and ph == 0) else SS[5]
                else: c = SS[3] if ph == 2 else SS[2]
                if _h(x, yy, 31) > 0.93: c = mix(c, SA[4], 0.6)
                if dx > sw - 3: c = mul(c, 0.85)
            else:
                u = (abs(dx) - sw)
                c = SS[6] if u < 2 else (SS[5] if u < 4 else SS[3])
                if dx > 0: c = mix(c, SS[3], 0.35)
            _put(px, W, H, x, yy, c)
    # ---- 무너진 오른쪽 위: 겉돌(단 3~5)이 떨어져 나가 계단꼴 깨진 윗선 + 거친 심석
    xa, xb = cx + sw + bw_ + 34, tiers[2][1] - 6          # 무너진 폭(가운데 계단 오른쪽부터 단 2 끝 앞까지)
    ytop_a = tiers[4][2] - 6; ytop_b = tiers[2][2] - 4           # 깨진 윗선 높이: 왼쪽 높고 오른쪽 낮다
    cut = {}
    x = xa; yc = ytop_a
    while x < xb:
        stepw = 6 + int(_h(x, 401) * 9)
        t = (x - xa) / max(1, xb - xa)
        yc = int(ytop_a + (ytop_b - ytop_a) * (t ** 0.8) + (_h(x, 402) - 0.5) * 8)
        for xx in range(x, min(xb, x + stepw)): cut[xx] = yc + (1 if _h(xx, 403) > 0.8 else 0)
        x += stepw
    floor_y = tiers[2][2]                                   # 심석 아래끝 = 단 2 앞면 윗선
    for xx, yc in cut.items():
        for yy in range(0, yc):
            if 0 <= yy < H: px[xx, yy] = (0, 0, 0, 0)
        for yy in range(yc, floor_y):
            if px[xx, yy][3] == 0: continue
            d = yy - yc
            c = sash(xx * 3 // 4 + 11, yy + 5, bw=9, bh=6, seed=47)
            c = mul(c, 0.8 if _h(xx // 9, yy // 6, 48) > 0.3 else 0.7)
            if d == 0: c = SS[6] if _h(xx, 404) > 0.3 else SS[5]
            elif d == 1: c = SS[5]
            elif d == 2: c = SS[3]
            _put(px, W, H, xx, yy, c)
    # 무너진 자리 오른쪽 끝 너머(단 3~5 의 남은 오른쪽 옆 디딤)도 같은 높이로 깎는다
    for xx in range(xb, W):
        for yy in range(0, min(H, tiers[2][2] - td)):
            if px[xx, yy][3] and yy < tiers[2][2] - td: px[xx, yy] = (0, 0, 0, 0)
    # ---- 입구(맨 아랫단 가운데)
    x0, x1, ft, fb = tiers[0]
    dw, dh = 30, 24
    dx0 = cx - dw // 2; dy1 = fb - 1; dy0 = dy1 - dh
    for yy in range(dy0 - 7, dy1 + 1):
        for x in range(dx0 - 6, dx0 + dw + 6):
            inner = dx0 <= x < dx0 + dw and yy >= dy0
            if inner:
                d = yy - dy0
                c = SS[0] if d > 3 else mix(SS[0], SS[1], 0.5)
                if x < dx0 + 3 and d > 2: c = SS[1]
                if yy >= dy1 - 1: c = mix(SS[1], SA[2], 0.5)
            elif yy < dy0:
                u = yy - (dy0 - 7)
                c = SS[6] if u == 0 else (SS[5] if u < 3 else (SS[4] if u < 6 else SS[2]))
                if u in (3, 4) and (x - dx0) % 6 == 0: c = SS[3]
            else:
                left = x < dx0
                u = (dx0 - 1 - x) if left else (x - dx0 - dw)
                c = SS[6] if (left and u == 5) else (SS[5] if left else (SS[4] if u < 4 else SS[3]))
                if (yy - dy0) % 8 == 7: c = SS[3]
            _put(px, W, H, x, yy, c)
    for pxl in (cx - 70, cx + 44):                          # 입구 양옆 새김 판(기하 띠 — 글자 아님)
        for yy in range(ft + 7, fb - 6):
            for x in range(pxl, pxl + 26):
                u = x - pxl; v = yy - (ft + 7)
                if u in (0, 25) or v in (0, fb - 6 - ft - 8): c = SS[3]
                elif (u + v) % 6 == 0 and 3 < u < 22: c = SS[3]
                elif u == 1 or v == 1: c = SS[5]
                else: continue
                _put(px, W, H, x, yy, c)
    im = pz.fin(o)
    p = im.load()
    # ---- 무너진 돌: 깨진 윗선 아래 디딤(단 2·1)과 오른쪽 밑동
    rb = [(xa + 8, tiers[2][2] - 8, 12, 8), (xa + 24, tiers[2][2] - 10, 14, 9), (xa + 44, tiers[2][2] - 7, 10, 7),
          (xa + 14, tiers[1][2] - 9, 13, 9), (xa + 36, tiers[1][2] - 8, 11, 8), (xb - 2, tiers[1][2] - 8, 12, 8),
          (xb + 6, tiers[0][2] - 9, 13, 9), (W - 34, yb - 10, 14, 10), (W - 18, yb - 7, 11, 7), (W - 50, yb - 6, 9, 6)]
    for k, (bx, by, w2, h2) in enumerate(rb): _block(p, W, H, bx, by, w2, h2, 300 + k)
    _sand_heap(p, W, H, 18, yb + 2, 34, 16, 71)
    _sand_heap(p, W, H, 70, yb + 3, 22, 8, 72)
    _sand_heap(p, W, H, W - 30, yb + 2, 30, 12, 73)
    _sand_heap(p, W, H, cx - 34, yb + 2, 14, 5, 74)
    _sand_heap(p, W, H, cx + 36, yb + 2, 12, 4, 75)
    for i in range(1, 4):                                   # 디딤 위 모래(왼쪽 단에 몰린다)
        x0, x1, ft, fb = tiers[i]
        _sand_heap(p, W, H, x0 + 16 + i * 3, ft - 1, 15, 4, 80 + i)
    for x in range(W):
        for yy in range(yb, H):
            if p[x, yy][3] == 0:
                p[x, yy] = SHADOW + (90 if yy <= yb + 1 else 50,)
                break
    return im


def pyramid_door_cols():
    """입구 칸(이미지 왼쪽 위 기준 칸 열): 24칸 중 11,12 열이 문."""
    return (11, 12)


def _block(px, W, H, x0, y0, w, h, seed):
    """떨어진 사암 마름돌 하나: 윗면 2px(밝다), 앞면(점 질감), 오른쪽·아래 어두운 모, 모서리 이 빠짐."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if (x == x0 and y == y0) or (x == x0 + w - 1 and y == y0) or (x == x0 + w - 1 and y == y0 + 1 and _h(seed, 1) > 0.5): continue
            if y - y0 < 2: c = SS[6] if (x - x0 < w - 2 and y == y0) else SS[5]
            else:
                c = sash(x + seed * 13, (y - y0) + 40, bw=64, bh=64, seed=seed)
                if x >= x0 + w - 2: c = SS[3]
                if y == y0 + h - 1: c = SS[2]
                if x == x0: c = mix(c, SS[6], 0.4)
            _put(px, W, H, x, y, c)
    for x in range(x0 - 1, x0 + w + 1): _put(px, W, H, x, y0 + h, SS[0]) if 0 <= x < W and px[x, min(H - 1, y0 + h)][3] == 0 else None
    for y in range(y0, y0 + h):
        for x in (x0 - 1, x0 + w):
            if 0 <= x < W and 0 <= y < H and px[x, y][3] == 0: _put(px, W, H, x, y, SS[0])
    for x in range(x0, x0 + w):
        if 0 <= y0 - 1 < H and px[x, y0 - 1][3] == 0: _put(px, W, H, x, y0 - 1, SS[0])


# ================================================================ 마스타바(네모 무덤)
def _mastaba(W, H, face_h, top_d, door, seed, damage=False, bury=0):
    o = Image.new('RGBA', (W, H)); px = o.load()
    yb = H - 3; ft = yb - face_h; tt = ft - top_d
    for yy in range(tt, ft):
        for x in range(1, W - 1):
            lit = x < W * 0.55
            ry = (yy - tt) // 7; rx = (x + (ry % 2) * 13) // 26
            c = SS[5] if lit else mix(SS[5], SS[4], 0.5)
            if (yy - tt) % 7 == 6 or (x + (ry % 2) * 13) % 26 == 0: c = mix(c, SS[3], 0.6)
            elif _h(rx, ry, seed + 2) > 0.7: c = mix(c, SS[6], 0.35)
            if _h(x, yy, seed + 4) > 0.96: c = SS[3]
            if _h(x // 3, yy // 2, seed + 3) < 0.10: c = SA[5]
            if yy == ft - 1: c = SS[6] if lit else SS[5]
            if yy == tt: c = SS[5]
            if x <= 2: c = SS[6]
            if x >= W - 3: c = SS[3]
            _put(px, W, H, x, yy, c)
    for yy in range(ft, yb + 1):
        z = yb - yy
        for x in range(1, W - 1):
            c = sash(x + seed * 3, 300 - z, bw=16, bh=7, seed=seed)
            if x <= 2: c = mix(c, SS[6], 0.5)
            if x >= W - 4: c = mul(c, 0.85)
            if yy == ft: c = SS[3]
            if yy == ft + 1: c = mix(c, SS[3], 0.4)
            if z < 3: c = mix(c, SS[3], 0.4)
            _put(px, W, H, x, yy, c)
    # 거짓 문(겹 테 벽감) 또는 진짜 입구
    cx = W // 2
    if door == 'niche':
        for k, (hw, tone) in enumerate(((9, 5), (7, 3), (5, 2), (3, 1))):
            for yy in range(ft + 4 + k * 2, yb - 1):
                for x in range(cx - hw, cx + hw):
                    c = SS[tone]
                    if k == 0 and x == cx - hw: c = SS[6]
                    _put(px, W, H, x, yy, c)
    elif door == 'open':
        dw, dh = 14, min(face_h - 6, 18)
        for yy in range(yb - dh - 4, yb):
            for x in range(cx - dw // 2 - 3, cx + dw // 2 + 3):
                inner = cx - dw // 2 <= x < cx + dw // 2 and yy >= yb - dh
                if inner:
                    d = yy - (yb - dh)
                    c = SS[0] if d > 2 else SS[1]
                    if x < cx - dw // 2 + 2: c = SS[1]
                elif yy < yb - dh: c = SS[6] if yy == yb - dh - 4 else (SS[5] if yy < yb - dh - 1 else SS[3])
                else: c = SS[5] if x < cx else SS[3]
                _put(px, W, H, x, yy, c)
    if damage:                                              # 오른쪽 위 모서리가 깨져 나갔다
        for yy in range(tt, ft + 14):
            for x in range(W - 26, W):
                lim = W - 26 + int((yy - tt) * 1.4) + int((_h(x // 4, yy // 4, seed) - 0.5) * 6)
                if x > lim + 10 and yy < ft + 12: px[x, yy] = (0, 0, 0, 0)
                elif x > lim + 7 and px[x, yy][3]: _put(px, W, H, x, yy, SS[5])
    im = pz.fin(o); p = im.load()
    for x in range(W):
        if p[x, H - 2][3] == 0: p[x, H - 2] = SHADOW + (80,)
    if bury:
        _sand_heap(p, W, H, W * 0.22, H - 2, W * 0.34, bury, seed + 5)
        _sand_heap(p, W, H, W * 0.86, H - 2, W * 0.2, bury * 0.6, seed + 6)
    if damage:
        _block(p, W, H, W - 14, H - 11, 10, 8, seed + 7)
        _block(p, W, H, W - 24, tt + 6, 9, 6, seed + 8)
    return im


def mastaba_a():
    """마스타바 무덤(5x4칸): 낮고 납작한 사암 무덤. 평평한 지붕, 앞면 가운데 어두운 입구. 고분 터의 큰 무덤."""
    return _mastaba(80, 64, 28, 22, 'open', 101, bury=7)


def mastaba_b():
    """작은 마스타바(4x3칸): 앞면에 겹 테 거짓 문(벽감), 오른쪽 위 모서리가 깨져 마름돌이 떨어졌다. 모래에 반쯤 묻혔다."""
    return _mastaba(64, 48, 22, 16, 'niche', 111, damage=True, bury=9)


# ================================================================ 흙무덤(고분)
def tumulus():
    """흙무덤 고분(6x4칸): 둥글게 쌓은 모래·자갈 봉분(높은 돔 — 왼쪽 위 밝고 오른쪽 아래 어둡다, 꼭대기에 둘레돌 몇 개,
    마른 풀 몇 포기), 앞 가운데 두 문기둥+덮개돌 돌 입구(어둠)와 짧은 돌벽 널길."""
    W, H = 96, 64
    o = Image.new('RGBA', (W, H)); px = o.load()
    cx0, gy = 48, 60                                   # 봉분 밑 가운데·땅선
    rx, rh, rd = 45, 40, 9                             # 반폭·높이·앞으로 나온 밑 타원
    for y in range(gy - rh, gy + 1):
        for x in range(cx0 - rx, cx0 + rx + 1):
            dx = (x + 0.5 - cx0) / rx
            if abs(dx) > 1: continue
            ytop = gy - rd * math.sqrt(1 - dx * dx) * 0 - (rh - rd) * (1 - dx * dx) ** 0.75 - rd * math.sqrt(1 - dx * dx)
            if y < ytop: continue
            ybot = gy - rd * (1 - math.sqrt(1 - dx * dx)) * 0.0
            v = (y - ytop) / max(1.0, gy - ytop)       # 0 꼭대기 … 1 밑
            nx = dx; ny = -(1 - v) * 0.9 + 0.2
            lum = 0.6 + 0.5 * (-0.55 * nx - 0.65 * ny * 0.6 + 0.3)
            t = 6 if lum > 1.0 else (5 if lum > 0.82 else (4 if lum > 0.62 else 3))
            if v > 0.86: t = max(2, t - 1)
            if _h(x, y, 121) > 0.9: t = max(2, t - 1)
            if _h(x, y, 122) > 0.95: t = min(6, t + 1)
            c = SA[t]
            if _h(x // 2, y // 2, 123) > 0.93: c = BR[3] if _h(x, y, 124) > 0.5 else BR[5]   # 자갈
            _put(px, W, H, x, y, c)
    for (x, y) in ((40, 25), (48, 23), (56, 25), (34, 28), (62, 28)):           # 꼭대기 둘레돌
        _block(px, W, H, x, y, 5, 4, 125 + x)
    DR = [hx(v) for v in PAL['dry']]
    for (tx, ty) in ((20, 40), (70, 36), (78, 50), (28, 52), (58, 31), (12, 54)):
        for j in range(4):
            for dx in (-1, 0, 1):
                if _hash(tx + dx, j, 125) < 0.7: _put(px, W, H, tx + dx * (j // 2 + 1), ty - j, DR[5 if dx < 0 else 3])
    # 돌 입구: 널길 낮은 벽(양쪽) + 문기둥 + 덮개돌
    cx = 48; yb = 61
    for x in range(cx - 14, cx + 14):
        for yy in range(yb - 22, yb + 1):
            u = x - (cx - 14)
            if 9 <= u < 19:
                if yy >= yb - 16: c2 = SS[0] if yy < yb - 3 else mix(SS[1], SA[2], 0.6)
                else: continue
            elif u < 4 or u >= 24:
                if yy < yb - 8: continue
                c2 = sash(x, yy, bw=8, bh=5, seed=127)
                if yy == yb - 8: c2 = SS[6] if u < 4 else SS[5]
            else:
                if yy < yb - 22 + 4: continue
                c2 = SS[5] if u < 6 else (SS[4] if u < 9 else (SS[4] if u < 21 else SS[3]))
                if u in (4, 19): c2 = SS[6] if u == 4 else SS[5]
                if (yy - yb) % 7 == 0: c2 = SS[3]
            _put(px, W, H, x, yy, c2)
    for x in range(cx - 12, cx + 12):
        for yy in range(yb - 22, yb - 15):
            u = yy - (yb - 22)
            c2 = SS[6] if u == 0 else (SS[5] if u < 3 else (SS[4] if u < 5 else SS[2]))
            if x >= cx + 10: c2 = mul(c2, 0.82)
            _put(px, W, H, x, yy, c2)
    im = pz.fin(o); p = im.load()
    for x in range(W):
        if p[x, 62][3] == 0 and p[x, 60][3]: p[x, 62] = SHADOW + (80,)
    return im


# ================================================================ 오벨리스크·석상·기둥
def _shaft(px, W, H, x0, ybase, w0, w1, hgt, seed, notch=True):
    """사각 기둥(오벨리스크 몸통): 아래 w0 → 위 w1 로 좁아진다. 앞면만(왼쪽 1px 밝은 모·오른쪽 2px 어두운 모)."""
    cx = x0 + w0 / 2
    for z in range(hgt):
        y = ybase - z
        w = w0 + (w1 - w0) * z / hgt
        xl = int(round(cx - w / 2)); xr = int(round(cx + w / 2))
        for x in range(xl, xr):
            c = SS[4] if _h(x, z // 3, seed) > 0.25 else mix(SS[4], SS[5], 0.5)
            if x == xl: c = SS[6]
            elif x == xl + 1: c = SS[5]
            elif x >= xr - 2: c = SS[3]
            if notch and z % 9 in (3,) and xl + 2 < x < xr - 3 and _h(z, seed) > 0.3: c = SS[3]     # 새김 홈(기하 무늬)
            if notch and z % 9 == 6 and x == int(cx) and _h(z, seed, 1) > 0.4: c = SS[3]
            if _h(x, y, seed + 1) > 0.95: c = mix(c, SA[5], 0.6)
            _put(px, W, H, x, y, c)
    return xl, xr


def obelisk():
    """오벨리스크(1x4칸): 받침돌 위 좁아지는 사각 몸통, 꼭대기 피라미드꼴 머리(왼쪽 밝고 오른쪽 그늘). 새김 홈 띠."""
    W, H = 16, 64
    o = Image.new('RGBA', (W, H)); px = o.load()
    for yy in range(H - 8, H - 2):              # 받침
        for x in range(1, 15):
            u = yy - (H - 8)
            c = SS[6] if u == 0 else (SS[5] if u < 2 else (SS[4] if x < 12 else SS[3]))
            _put(px, W, H, x, yy, c)
    xl, xr = _shaft(px, W, H, 3, H - 9, 10, 7, 46, 131)
    ty = H - 9 - 46
    for k in range(6):                          # 머리
        y = ty - k
        a = int(round(3.5 * (1 - k / 6))); cx = (xl + xr) // 2
        for x in range(cx - a - 1, cx + a + 1):
            _put(px, W, H, x, y, SS[6] if x < cx else SS[4])
    im = pz.fin(o); p = im.load()
    for x in range(2, 16):
        if p[x, H - 2][3] == 0: p[x, H - 2] = SHADOW + (80,)
    return im


def obelisk_buried():
    """반쯤 묻혀 기운 오벨리스크(2x3칸): 모래 더미에 밑이 묻혀 오른쪽으로 기울었다. 머리 한쪽이 깨졌다."""
    W, H = 32, 48
    o = Image.new('RGBA', (W, H)); px = o.load()
    ang = math.radians(14)
    for z in range(40):
        for u in range(-5, 5):
            w = 5 - z * 1.5 / 40
            if abs(u + 0.5) > w: continue
            x = int(round(9 + u * math.cos(ang) + z * math.sin(ang))); y = int(round(H - 6 - z * math.cos(ang) + u * math.sin(ang) * 0.3))
            c = SS[4]
            if u <= -int(w): c = SS[6]
            elif u >= int(w) - 1: c = SS[3]
            if z % 9 == 3 and abs(u) < w - 2: c = SS[3]
            if z > 36 and u > 0: continue                      # 깨진 머리
            _put(px, W, H, x, y, c); _put(px, W, H, x + 1, y, c) if u == int(w) - 1 else None
    im = pz.fin(o); p = im.load()
    _sand_heap(p, W, H, 12, H - 2, 13, 9, 141)
    _sand_heap(p, W, H, 24, H - 2, 7, 4, 142)
    return im


def obelisk_fallen():
    """쓰러져 두 동강 난 오벨리스크(4x1칸): 윗면(밝다)과 앞면이 보이게 옆으로 누웠다, 오른쪽 끝에 머리, 가운데 깨진 틈."""
    W, H = 64, 16
    o = Image.new('RGBA', (W, H)); px = o.load()
    for x in range(2, 60):
        if 33 <= x <= 35: continue
        t = (x - 2) / 58.0
        hh = int(round(9 - t * 2)); top = 3
        if x > 54:
            k = x - 54; hh = max(2, hh - k); top = 3 + k // 2
        for y in range(top, top + hh):
            u = y - top
            c = SS[6] if u == 0 else (SS[5] if u < 3 else (SS[4] if u < hh - 2 else SS[3]))
            if u >= 3 and x % 9 == 4 and u < hh - 2: c = SS[3]
            if x in (32, 36): c = SS[2] if u > 2 else SS[4]
            _put(px, W, H, x, y + 2, c)
    im = pz.fin(o); p = im.load()
    for x in range(2, 60):
        if p[x, 14][3] == 0: p[x, 14] = SHADOW + (80,)
    _sand_heap(p, W, H, 6, 15, 8, 4, 151)
    return im


def _head(px, W, H, cx, top, sc=1.0, seed=0, worn=0.0):
    """석상 머리: 둥근 정수리 + 어깨까지 퍼지는 머리두건 자락(가로 줄무늬) + 가운데 닳은 얼굴 면(테두리만, 이목구비 없음)
    + 턱 아래 수염 토막. 빛 왼쪽 위: 왼쪽 자락 밝고 오른쪽 자락 그늘."""
    hw = 6.5 * sc; flap = 14 * sc
    for y in range(int(top), int(top + flap) + 1):
        v = (y - top) / flap
        if v < 0.42: w = hw * math.sqrt(max(0.0, 1 - ((0.42 - v) / 0.42) ** 2 * 0.8))
        else: w = hw + (v - 0.42) / 0.58 * 4.0 * sc
        for x in range(int(round(cx - w)), int(round(cx + w)) + 1):
            u = (x + 0.5 - cx) / max(1.0, w)
            t = 5 if u < -0.4 else (4 if u < 0.4 else 3)
            if int(y - top) % max(2, int(round(2 * sc))) == 1: t -= 1               # 두건 가로 줄무늬
            if v < 0.1 and u < 0.2: t = 6
            if _h(x, y, seed) < worn * 0.15: t = max(2, t - 1)
            _put(px, W, H, x, y, SS[max(1, t)])
    fx0, fx1 = int(round(cx - 3.6 * sc)), int(round(cx + 3.6 * sc)); fy0, fy1 = int(top + 3.6 * sc), int(top + 10.5 * sc)
    for y in range(fy0 - 1, fy1 + 1):
        for x in range(fx0 - 1, fx1 + 2):
            if y == fy0 - 1 or x == fx0 - 1 or x == fx1 + 1: c = SS[2]              # 얼굴 테(두건 안쪽 그늘)
            else:
                u = (x + 0.5 - cx) / (3.6 * sc)
                c = SS[6] if u < -0.5 else (SS[5] if u < 0.4 else SS[4])
                if _h(x, y, seed + 1) < 0.06 + worn * 0.12: c = SS[3]
            _put(px, W, H, x, y, c)
    for y in range(fy1 + 1, fy1 + 1 + int(3 * sc)):                                 # 수염 토막
        for x in range(int(cx - 1.3 * sc), int(cx + 1.3 * sc) + 1):
            _put(px, W, H, x, y, SS[4] if x <= cx else SS[3])
    return top + flap


def guardian_seated():
    """모래에 허리까지 묻힌 앉은 수호 석상(2x3칸): 머리두건 늘어진 머리(얼굴은 닳아 없다), 어깨·팔, 무릎 위 두 손, 밑은 모래 더미."""
    W, H = 32, 48
    o = Image.new('RGBA', (W, H)); px = o.load()
    cx = 16
    # 몸통·팔(앞면): 어깨 y16, 무릎 윗면 y31
    for y in range(16, 42):
        for x in range(7, 26):
            u = x - 7
            if y < 19 and (u < 2 or u > 16): continue
            t = 4
            if u < 3: t = 5 if u > 0 else 6                 # 왼팔(빛)
            elif u > 15: t = 3                              # 오른팔(그늘)
            elif u in (3, 15): t = 3                        # 팔과 몸 사이 홈
            if 31 <= y <= 33: t = 6 if y == 31 else 5       # 무릎 윗면(손 얹은 곳)
            if y == 34: t = 3
            _put(px, W, H, x, y, SS[t])
    for hx0 in (8, 19):                                      # 두 손(무릎 위)
        for y in range(28, 32):
            for x in range(hx0, hx0 + 5): _put(px, W, H, x, y, SS[6 if (x == hx0 or y == 28) else 4])
    _head(px, W, H, cx, 3, 1.0, 161, 0.3)
    im = pz.fin(o); p = im.load()
    _sand_heap(p, W, H, 14, H - 1, 17, 12, 163)
    _sand_heap(p, W, H, 27, H - 1, 6, 5, 164)
    return im


def guardian_head():
    """모래에 목까지 묻힌 거대한 석상 머리(2x2칸): 조금 기울었다. 머리두건 자락, 닳아 없어진 얼굴, 오른쪽 자락이 깨졌다."""
    W, H = 32, 32
    o = Image.new('RGBA', (W, H)); px = o.load()
    _head(px, W, H, 15, 2, 1.6, 171, 0.6)
    for y in range(12, 26):                                 # 오른쪽 자락 깨짐
        for x in range(25, 32):
            if x - 25 > (y - 12) * 0.5 + _h(y, 172) * 2: px[x, y] = (0, 0, 0, 0)
    im = pz.fin(o)
    im = im.rotate(-6, resample=Image.NEAREST, center=(15, 28))
    p = im.load()
    _sand_heap(p, W, H, 15, H - 1, 16, 7, 173)
    _sand_heap(p, W, H, 4, H - 1, 5, 3, 174)
    return im


def beast_statue():
    """엎드린 짐승 수호상(2x2칸): 받침돌 위 앞발을 뻗고 엎드린 사자 꼴(옆모습, 왼쪽 보기), 갈기 줄, 꼬리. 광장 길목 한 쌍."""
    W, H = 32, 32
    c = C(W, H, seed=181)
    c.new(); c.box(1, 22, 30, 3, 6, 'sstone', top=0.98, front=0.6)            # 받침
    c.new(); c.ellipsoid(19, 17, 10, 5.5, 'sstone', amb=0.24, bias=0.0)        # 몸
    c.new(); c.ellipsoid(9, 12, 5.5, 6, 'sstone', amb=0.26, bias=0.05)         # 머리·갈기
    c.new(); c.box(2, 18, 10, 2, 3, 'sstone', top=1.0, front=0.7)              # 앞발
    c.new(); c.ellipsoid(6, 13, 2.8, 3, 'sstone', amb=0.3, bias=0.08)          # 주둥이
    for (x, y) in ((10, 8), (12, 10), (11, 13), (13, 15), (12, 6)): c.tone(x, y, 'sstone', 3)
    c.line(28, 17, 30, 13, 'sstone', 4); c.tone(30, 12, 'sstone', 5)
    im = pz.fin(c); p = im.load()
    for x in range(1, 31):
        if p[x, 30][3] == 0: p[x, 30] = SHADOW + (80,)
    return im


def column_broken():
    """부러진 사암 기둥(1x2칸): 세로 홈, 위가 깨져 들쭉날쭉, 밑 받침. 광장 둘레에 홀로 서 있다."""
    W, H = 16, 32
    o = Image.new('RGBA', (W, H)); px = o.load()
    for yy in range(H - 6, H - 2):
        for x in range(1, 15): _put(px, W, H, x, yy, SS[6] if yy == H - 6 else (SS[5] if x < 12 else SS[3]))
    for yy in range(4, H - 6):
        for x in range(3, 13):
            top = 4 + int(_h(x, 191) * 5) + (3 if x > 9 else 0)
            if yy < top: continue
            u = x - 3
            c = SS[5] if u < 2 else (SS[4] if u < 7 else SS[3])
            if u in (2, 5, 8): c = SS[3] if u != 8 else SS[2]
            if yy == top: c = SS[6]
            _put(px, W, H, x, yy, c)
    im = pz.fin(o); p = im.load()
    for x in range(1, 16):
        if p[x, H - 2][3] == 0: p[x, H - 2] = SHADOW + (80,)
    return im


def column_drums():
    """쓰러진 기둥 토막(2x1칸): 굴러 떨어진 원통 토막 둘, 잘린 면(동심 테)이 보인다."""
    W, H = 32, 16
    c = C(W, H, seed=201)
    c.hcyl(4, 15, 9, 5, 'sstone', amb=0.25, endcap='R', capmat='sstone')
    c.hcyl(18, 28, 10, 4.5, 'sstone', amb=0.25, endcap='L', capmat='sstone')
    for x in (7, 10, 13, 21, 24, 27): c.tone(x, 7, 'sstone', 3)
    c.shadow(16, 14.5, 14, 1.4, 80)
    return pz.fin(c)


def stela():
    """둥근 머리 묘비석(1x2칸): 테두리 새김(기하 띠, 글자 없음), 밑은 모래에 묻혔다."""
    W, H = 16, 32
    o = Image.new('RGBA', (W, H)); px = o.load()
    for yy in range(6, H - 3):
        for x in range(3, 13):
            if yy < 10 and math.hypot(x + 0.5 - 8, yy - 10) > 5.2: continue
            u = x - 3
            c = SS[5] if u < 2 else (SS[4] if u < 8 else SS[3])
            if u == 0: c = SS[6]
            if 2 <= u <= 7 and yy in (12, 18, 24): c = SS[3]
            if u in (2, 7) and 11 < yy < 26: c = SS[3]
            _put(px, W, H, x, yy, c)
    im = pz.fin(o); p = im.load()
    _sand_heap(p, W, H, 8, H - 1, 8, 4, 211)
    return im


def sand_block():
    """떨어진 사암 마름돌(1칸): 모서리 이 빠진 돌 하나, 밑에 모래가 조금 쌓였다."""
    W, H = 16, 16
    o = Image.new('RGBA', (W, H)); px = o.load()
    _block(px, W, H, 2, 4, 12, 9, 221)
    _sand_heap(px, W, H, 4, 15, 5, 2, 222)
    return o


def rubble_sand():
    """사암 잔해 더미(3x2칸): 무너진 마름돌이 쌓인 더미, 사이사이 모래."""
    W, H = 48, 32
    o = Image.new('RGBA', (W, H)); px = o.load()
    B = [(14, 6, 12, 8, 1), (25, 8, 11, 8, 2), (5, 13, 12, 8, 3), (17, 14, 13, 8, 4), (31, 14, 11, 8, 5),
         (1, 21, 10, 7, 6), (12, 22, 12, 7, 7), (25, 21, 11, 7, 8), (37, 21, 10, 7, 9)]
    for (x, y, w, h, s) in sorted(B, key=lambda b: b[1] + b[3]): _block(px, W, H, x, y, w, h, 230 + s)
    _sand_heap(px, W, H, 8, H - 1, 9, 4, 241)
    _sand_heap(px, W, H, 40, H - 1, 8, 3, 242)
    for x in range(W):
        if px[x, H - 1][3] == 0 and px[x, H - 2][3]: px[x, H - 1] = SHADOW + (70,)
    return o
