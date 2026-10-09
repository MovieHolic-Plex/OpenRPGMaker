# 황폐 필드 구조물: 반쯤 땅에 박혀 기운 옛 망루 · 기울어 가라앉은 옛 회당 · 부서진 돌다리 · 무너진 담 토막 · 기둥 · 잔해.
# 석재는 버들항 성 마름돌(castle6.ash: 돌마다 톤, 왼·위 밝은 모, 오른·아래 어두운 모, 1px 줄눈)과 초원 하이로드 「무너진 망루」
# (vendor/plains_ruin.py 동결 사본)를 그대로 그린 뒤, 밝기 순서로 바랜 붉은 마름돌 램프(rstone)에 옮긴다. 풀빛은 바랜 풀로.
# 3/4: 윗면 + 앞면, 옆면 없음. 빛 왼쪽 위. 기울기는 회전이 아니라 열·줄 밀기(화소 그대로).
import os, sys, math
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'vendor'))
from ww_base import C, P, RGB, R7, F, put, hash2, smooth, _hash, blank, pad16, shear_down, shear_right
import terrain
from castle6 import ash
import plains_ruin as PR
from ww_pieces import tufts, chips

ST_L = np.array([0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2] for c in terrain.ST])


def stone_rgb(c, mat='rstone', k=0.0):
    """버들항 마름돌 색 한 점 → mat 램프(밝기 가장 가까운 단 + k)."""
    l = 0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    t = int(np.argmin(np.abs(ST_L - l)))
    return RGB(mat, max(0, min(6, t + k)))


def bas(X, Y, bw=16, bh=8, seed=0, k=0.0, mat='rstone'):
    return stone_rgb(ash(X, Y, 1.0, bw, bh, seed), mat, k)


def recolor_ruin(im, mat='rstone'):
    """초원 하이로드 폐허 그림 → 황폐 재료: 돌은 밝기 단 그대로 mat 램프, 풀·이끼·담쟁이는 바랜 풀·검붉은 덩굴, 그림자는 검붉게."""
    a = np.array(im.convert('RGBA')).astype(np.int64)
    rgb = a[..., :3]; al = a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    l = 0.30 * r + 0.59 * g + 0.11 * b
    green = (g > r + 6) & (g > b + 2) & (al == 255)
    shadow = (al > 0) & (al < 255)
    t = np.abs(l[..., None] - ST_L[None, None, :]).argmin(-1)
    out = P(mat)[t].astype(np.int64)
    gt = np.clip(((l - 30) / 160 * 5).round().astype(int) + 1, 1, 6)
    dg = P('drygr')[gt]
    dv = P('deadw')[np.clip(gt, 1, 5)]
    plant = np.where((hash2(np.arange(a.shape[1])[None, :] // 2, np.arange(a.shape[0])[:, None] // 2, 77) > 0.5)[..., None], dg, dv)
    out = np.where(green[..., None], plant, out)
    out = np.where(shadow[..., None], np.array((26, 10, 8)), out)
    o = np.dstack([out, al]).astype(np.uint8)
    return Image.fromarray(o, 'RGBA')


def earth_mound(im, ybase, depth_l, depth_r, seed=1, dust=True, extra=6):
    """그림 밑을 붉은 흙 둔덕이 덮는다(왼쪽 depth_l px, 오른쪽 depth_r px 묻힘). 둔덕 윗모 밝게, 잔돌·재·마른 풀.
    ybase = 원래 땅선(그림 좌표). 돌려주는 그림은 아래로 extra px 늘어난다."""
    W, H = im.size
    o = blank(W, H + extra); o.alpha_composite(im, (0, 0)); px = o.load()
    RD = R7('rdirt'); DU = R7('dust')
    cols = [x for x in range(W) if any(px[x, y][3] for y in range(H))]
    if not cols: return o
    xa, xb = cols[0] - 2, cols[-1] + 2
    for x in range(max(0, xa), min(W, xb + 1)):
        f = (x - xa) / max(1, xb - xa)
        d = depth_l + (depth_r - depth_l) * f
        bump = 2.2 * math.sin(f * math.pi * 3 + seed) + 1.2 * math.sin(x / 2.7 + seed)
        edge = min(f, 1 - f) * (xb - xa)
        rise = max(0, min(d + bump, edge * 1.4))
        top = int(round(ybase - rise)); low = int(ybase + 2 + 2 * math.sin(f * math.pi))
        for y in range(top, min(H + extra, low + 1)):
            k = y - top
            c = RD[5] if k == 0 else (RD[4] if k < 3 else RD[3])
            if dust and k < 3 and _hash(x, y, seed + 3) > 0.62: c = DU[5 if k == 0 else 4]
            put(px, W, H + extra, x, y, c)
        put(px, W, H + extra, x, top - 1, RD[1])
        if low + 1 < H + extra: put(px, W, H + extra, x, low + 1, RD[1])
    for i in range(int((xb - xa) / 5)):                                      # 둔덕 위 잔돌(옛 마름돌 조각)
        x = int(xa + 2 + _hash(i, 1, seed + 5) * (xb - xa - 4)); y = int(ybase - 1 + _hash(i, 2, seed + 5) * 4)
        chips(px, W, H + extra, ((x, y, 2 + (i % 2)),), 'rstone')
    tufts(px, W, H + extra, xa, xb, int(ybase + 2), seed + 7, 0.25, 3)
    return o


# ================================================================ 앵커: 반쯤 묻혀 기운 옛 망루
def sunken_tower():
    """반쯤 땅에 박혀 기운 옛 망루(5x7): 초원 하이로드 「무너진 망루」와 같은 둥근 마름돌 몸통 — 위가 계단꼴로 무너져 벽 두께와 안쪽 뒷벽이
    보이고 오른쪽 위만 원래 높이(성가퀴 둘). 땅이 꺼지며 몸통이 오른쪽으로 기울었고, 밑동은 붉은 흙 둔덕에 묻혀 아치 입구가 윗부분만 남았다.
    벽면에 위에서 아래로 갈라진 금. 덮인 칸 아래 4줄 막힘(몸통), 위는 걷기+가림."""
    base = recolor_ruin(PR.watchtower_ruin())                                # 64x112
    a = np.array(base)
    a = a[:100]                                                              # 밑 12px 가 땅에 묻힌다
    im = Image.fromarray(a, 'RGBA')
    px = im.load()
    for (x, y) in [(40 - k // 3 + (k % 5 == 0), 30 + k) for k in range(46)]:  # 갈라진 금(지그재그)
        if 0 <= x < 64 and 0 <= y < 100 and px[x, y][3] == 255:
            put(px, 64, 100, x, y, RGB('rstone', 0)); put(px, 64, 100, x + 1, y, RGB('rstone', 5))
    im = shear_right(im, 0.07)                                               # 위가 오른쪽으로 기운다
    W0, H0 = im.size
    can = blank(80, 112); can.alpha_composite(im, (4, 112 - 8 - H0))
    can = earth_mound(can, 112 - 8, 8, 13, seed=31, extra=0)
    return can


# ================================================================ 앵커: 기울어 가라앉은 옛 회당
def tilted_hall():
    """기울어 가라앉은 옛 회당(6x5): 가로로 긴 마름돌 앞벽, 왼쪽은 처마돌(윗면 보임)과 깨진 박공 일부가 남았고 오른쪽 위는 계단꼴로 무너져
    벽 두께와 안쪽 뒷벽이 보인다. 가운데 아치 문간(어둠), 양옆 아치 창, 벽 기둥. 땅이 꺼지며 오른쪽이 가라앉아 기울었다,
    밑은 붉은 흙 둔덕에 묻혔고 금이 갔다. 앞벽 아래 3줄 막힘(문간 칸은 막힘 — 들어갈 수 없다), 위는 걷기+가림."""
    W, H = 96, 72
    im = blank(W, H); px = im.load()
    x0, x1, yg = 4, 92, 66                       # 앞벽 왼·오른 끝, 땅선
    full = 20                                   # 온전한 벽 윗선(처마돌 밑)
    def htop(x):                                # 앞벽 남은 윗선 y (작을수록 높다)
        f = (x - x0) / (x1 - x0)
        if f < 0.55: return full
        g = (f - 0.55) / 0.45
        step = int(g * 4) * 7 + int(_hash(int(g * 4), 1, 41) * 3)
        return full + 6 + step
    # 뒷벽 안면(무너진 오른쪽: 앞벽 위로 보이는 안쪽 벽, 어둡게) — 앞벽보다 먼저 그린다
    for x in range(x0 + 2, x1 - 2):
        ht = htop(x)
        if ht <= full: continue
        back = full - 6 + int(4 * ((x - x0) / (x1 - x0) - 0.55) * 4) + int(_hash(x // 6, 2, 42) * 3)
        for y in range(back, ht):
            if y == back or y == back + 1: c = RGB('rstone', 5 if y == back else 4)          # 뒷벽 윗면
            else: c = bas(x + 37, y, 16, 8, 43, -2)
            put(px, W, H, x, y, c)
    # 앞벽(마름돌)
    for x in range(x0, x1):
        ht = htop(x)
        for y in range(ht, yg + 1):
            c = bas(x, y, 16, 8, 44, 0)
            if y >= yg - 3: c = bas(x, y, 8, 4, 45, -0.6)                       # 굽돌
            put(px, W, H, x, y, c)
        if ht > full:                                                          # 깨진 윗선 = 벽 두께 윗면 2px
            put(px, W, H, x, ht, RGB('rstone', 6 if _hash(x, 3, 46) > 0.4 else 5)); put(px, W, H, x, ht + 1, RGB('rstone', 5))
    # 왼쪽 처마돌(윗면 3px + 앞 2px) + 깨진 박공
    xc = int(x0 + (x1 - x0) * 0.55)
    for x in range(x0 - 2, xc + 2):
        for (dy, t) in ((-5, 6), (-4, 6), (-3, 5), (-2, 4), (-1, 3), (0, 2)):
            put(px, W, H, x, full + dy, RGB('rstone', t if x < xc else t - 1))
        if (x - x0) % 8 == 7: put(px, W, H, x, full - 1, RGB('rstone', 1))
    for x in range(x0 + 6, xc - 2):                                            # 박공(삼각, 왼쪽은 남고 오른쪽 위가 깨졌다)
        apex = (x0 + 6 + xc - 2) / 2
        ytop = full - 6 - int((1 - abs(x - apex) / ((xc - x0 - 8) / 2)) * 16)
        if x > apex + 4: ytop = max(ytop, full - 6 - 6 + int(_hash(x // 3, 5, 47) * 4))
        for y in range(ytop, full - 5):
            c = bas(x + 11, y, 12, 6, 48, -0.4)
            if y == ytop: c = RGB('rstone', 6)
            elif y == ytop + 1: c = RGB('rstone', 5)
            put(px, W, H, x, y, c)
    # 벽 기둥(앞벽보다 1단 밝은 세로 띠, 오른쪽 모 어둡게)
    for (bx) in (x0 + 2, 30, 60, x1 - 7):
        for y in range(max(full, htop(bx)) + 2, yg - 2):
            for x in range(bx, bx + 5):
                c = bas(x, y, 5, 8, 49, 0.6 if x < bx + 3 else -0.4)
                if x == bx + 4: c = RGB('rstone', 2)
                put(px, W, H, x, y, c)
    # 문간·창(아치, 속 어둠) + 테 돌
    def arch(cx, top, w, bot, broken=False):
        r = w / 2
        for y in range(top - 2, bot + 1):
            for x in range(int(cx - r) - 2, int(cx + r) + 3):
                dx = x + 0.5 - cx; zc = top + r
                inner = abs(dx) < r and (y >= zc or math.hypot(dx, zc - y - 0.5) < r)
                ring = (not inner) and abs(dx) < r + 2 and (y >= zc or math.hypot(dx, zc - y - 0.5) < r + 2)
                if inner:
                    c = RGB('abyss', 1 if y < bot - 3 else 2)
                    if dx < -r + 2: c = RGB('abyss', 0)
                    put(px, W, H, x, y, c)
                elif ring and px[x, y][3]:
                    put(px, W, H, x, y, RGB('rstone', 6 if dx < 0 else 4))
    arch(46, 34, 15, yg - 1)
    arch(18, 30, 9, 50); arch(76, 34, 9, 52)
    for (cx, sy) in ((18, 51), (76, 53)):                                      # 창턱
        for x in range(int(cx - 6), int(cx + 6)): put(px, W, H, x, sy, RGB('rstone', 6)); put(px, W, H, x, sy + 1, RGB('rstone', 3))
    # 금(오른쪽 위 깨진 곳 → 문간)
    x, y = 70, htop(70) + 2
    while y < 40:
        put(px, W, H, x, y, RGB('rstone', 0)); put(px, W, H, x + 1, y, RGB('rstone', 5))
        y += 1; x -= 1 if _hash(y, 1, 51) > 0.45 else 0
    im = F(im, 0.66)
    im = recolor_dust_top(im)
    im = shear_down(im, 0.085)                                                 # 오른쪽이 가라앉는다
    Wn, Hn = im.size
    can = blank(96, Hn + 4); can.alpha_composite(im, (0, 0))
    can = earth_mound(can, yg + 4, 6, 14, seed=53, extra=6)
    return can


def recolor_dust_top(im):
    """돌 윗면(위가 빈 밝은 화소)에 재가 앉는다."""
    a = np.array(im); h, w = a.shape[:2]
    DU = P('dust')
    for y in range(1, h):
        for x in range(w):
            if a[y, x, 3] == 255 and a[y - 1, x, 3] == 0 and _hash(x, y, 55) > 0.45:
                a[y, x, :3] = DU[5]
                if y + 1 < h and a[y + 1, x, 3] == 255 and _hash(x, y, 56) > 0.5: a[y + 1, x, :3] = DU[4]
    return Image.fromarray(a, 'RGBA')


# ================================================================ 앵커: 부서진 돌다리 (깊은 골을 남북으로 건넌다)
def broken_bridge(rows=7):
    """부서진 옛 돌다리(3 x rows): 깊은 골을 남북으로 건너는 마름돌 판석 다리. 양옆 낮은 난간(갓돌), 북쪽 머리에 다리 기둥 둘(동쪽 것은 부러졌다).
    가운데 판석이 무너져 뚫린 자리를 생존자들이 나무 널을 가로로 대고 밧줄로 묶어 메웠다, 서쪽 난간 한 토막이 떨어져 나갔다, 금·잔돌.
    걷기(가운데 칸). 다리 끝은 골 양쪽 땅 한 줄씩에 얹힌다."""
    W, H = 48, rows * 16
    im = blank(W, H); px = im.load()
    x0, x1 = 3, 45
    OW = R7('oldwood')
    gapy0, gapy1 = int(H * 0.46), int(H * 0.46) + 13                           # 뚫린 자리(널로 메움)
    railgap = (int(H * 0.30), int(H * 0.62))                                  # 서쪽 난간 떨어진 토막
    for y in range(H):
        for x in range(x0, x1):
            west = x < x0 + 5; east = x >= x1 - 5
            if west or east:
                if west and railgap[0] <= y < railgap[1]:
                    if x < x0 + 2: continue
                    put(px, W, H, x, y, RGB('rstone', 2 if x == x0 + 2 else 3))   # 깨진 난간 밑동
                    continue
                e = (x - x0) if west else (x1 - 1 - x)
                t = 1 if e == 0 else (6 if e == 1 else (5 if e == 2 else (4 if e == 3 else 2)))
                if y % 14 == 13 and e > 0: t = 2                                  # 갓돌 이음
                put(px, W, H, x, y, RGB('rstone', t))
            else:
                c = bas(x - x0 + 3, y + 5, 14, 10, 61, -0.4)
                if hash2(x // 5, y // 4, 62) < 0.25: c = bas(x - x0 + 3, y + 5, 14, 10, 61, -1.4)
                put(px, W, H, x, y, c)
    for y in range(gapy0, gapy1):                                             # 무너진 자리: 가장자리 깨진 판석 + 아래 어둠
        for x in range(x0 + 5, x1 - 5):
            j0 = int(_hash(x // 2, 1, 63) * 3); j1 = int(_hash(x // 2, 2, 63) * 3)
            if gapy0 + j0 <= y < gapy1 - j1: put(px, W, H, x, y, RGB('abyss', 1))
    for k in range(4):                                                        # 가로 댄 나무 널 넷(사이로 어둠이 보인다)
        yy = gapy0 - 2 + k * 4
        xa = x0 + 4 + int(_hash(k, 3, 64) * 3); xb = x1 - 4 - int(_hash(k, 4, 64) * 3)
        for x in range(xa, xb):
            for dy, t in ((0, 5), (1, 4), (2, 2)):
                put(px, W, H, x, yy + dy, OW[t - (1 if (x + k * 5) % 13 == 0 else 0)])
        for xr in (x0 + 7, x1 - 8):                                          # 밧줄 감은 자리
            put(px, W, H, xr, yy, RGB('rope', 5)); put(px, W, H, xr, yy + 1, RGB('rope', 3)); put(px, W, H, xr + 1, yy + 1, RGB('rope', 4))
    for (sx, sy, L) in ((20, 10, 9), (29, int(H * 0.72), 11), (14, int(H * 0.8), 6)):   # 금
        for i in range(L):
            x = sx + (i // 3) * (1 if sx < 24 else -1); y = sy + i
            put(px, W, H, x, y, RGB('rstone', 1))
    for i in range(40):                                                        # 판석 위 잔돌·재
        x = int(x0 + 6 + _hash(i, 1, 65) * (x1 - x0 - 12)); y = int(_hash(i, 2, 65) * H)
        if not (gapy0 - 2 <= y < gapy1 + 2): put(px, W, H, x, y, RGB('dust', 4 + (i % 3 == 0)))
    for y in range(H):                                                        # 동쪽 그림자(골 위, 반투명)
        for x in range(x1, W):
            if px[x, y][3] == 0: px[x, y] = (6, 2, 4, 120 if x == x1 else 70)
    im = F(im, 0.66); px = im.load()
    # 북쪽 머리 다리 기둥(서: 온전, 동: 부러짐) — 윤곽 뒤에 얹는다(위로 튀어나온 키 큰 부분은 걷기+가림)
    out = blank(W, H + 16); out.alpha_composite(im, (0, 16)); q = out.load()
    for (bx, top, broken) in ((1, 0, False), (39, 7, True)):
        for y in range(top, 30):
            for x in range(bx, bx + 8):
                if y < top + 3: c = RGB('rstone', 6 if x < bx + 6 else 5)          # 윗면
                else:
                    c = bas(x + 3, y, 8, 5, 66, 0.4 if x < bx + 3 else -0.6)
                    if x == bx + 7: c = RGB('rstone', 2)
                if broken and y < top + 3 and _hash(x, 1, 67) > 0.5: c = RGB('rstone', 4)
                put(q, W, H + 16, x, y, c)
        for x in range(bx, bx + 8): put(q, W, H + 16, x, top - 1, RGB('rstone', 1)); put(q, W, H + 16, x, 30, RGB('rstone', 1))
        for y in range(top, 31): put(q, W, H + 16, bx - 1, y, RGB('rstone', 1)); put(q, W, H + 16, bx + 8, y, RGB('rstone', 1))
    return out


# ================================================================ 무너진 담 토막 · 잔해 · 기둥
def ruin_wall_long():
    """무너진 담 토막(6x2): 바랜 붉은 마름돌 낮은 담, 가운데가 무너져 터진 틈과 계단꼴로 깨진 윗선, 양끝은 줄이 줄어 잔해로 끝난다."""
    return recolor_dust_top(recolor_ruin(PR._curtain([0, 1, 2, 3, 3, 3, 3, 2, 1, 0, 1, 2, 3, 3, 3, 2, 1, 1], 17)))


def ruin_wall_short():
    """짧은 담 토막(4x2): 한쪽은 온전한 갓돌, 다른 쪽은 계단꼴로 무너져 잔해로 끝난다."""
    return recolor_dust_top(recolor_ruin(PR._curtain([3, 3, 3, 3, 3, 2, 2, 1, 1, 0], 23)))


def rubble_heap():
    """잔해 더미(3x2): 무너진 벽에서 쏟아진 바랜 마름돌 더미, 윗면에 재."""
    return recolor_dust_top(recolor_ruin(PR.rubble_heap()))


def rubble_small():
    """작은 잔해 더미(2x1): 담 끝·틈에 남은 마름돌 서너 개."""
    return recolor_dust_top(recolor_ruin(PR.rubble_small()))


def fallen_block():
    """떨어진 마름돌(1칸): 붉은 흙에 반쯤 묻힌 깨진 마름돌 하나."""
    return recolor_ruin(PR.fallen_block())


def ruin_chips():
    """부스러기 돌(1칸 장식, 걷기): 폐허 둘레 흙에 흩어진 작은 마름돌 조각."""
    return recolor_ruin(PR.ruin_chips())


def broken_pillar():
    """부러진 기둥(1x3): 네모 받침 위 홈 판 둥근 돌기둥, 위가 비스듬히 부러져 깨진 윗면이 보인다, 윗면에 재. 밑동 1칸 막힘, 위 칸 걷기+가림."""
    c = C(16, 48, seed=871); c.shadow(8, 45.6, 7, 1.6, 90)
    c.new(); c.box(1, 40, 14, 2, 6, 'rstone', top=0.95, front=0.5)
    c.new(); c.cylinder(8, 12, 40, 5.0, 'rstone', cap=False, amb=0.25)
    for y in range(12, 40):                                                  # 홈
        for x in (5, 8, 11):
            if _hash(x, y // 6, 872) > 0.15: c.darken(x, y, 1)
    c.new()
    for x in range(3, 14):                                                   # 비스듬히 부러진 윗면(왼쪽이 높다)
        yt = 9 + int((x - 3) * 0.55) + int(_hash(x, 1, 873) * 2)
        for y in range(yt, 13 + int((x - 3) * 0.3)):
            c.tone(x, y, 'rstone', 6 if y == yt else 5)
        if _hash(x, 2, 873) > 0.5: c.tone(x, yt, 'dust', 5)
    im = F(c); px = im.load()
    chips(px, 16, 48, ((1, 46, 2), (12, 46, 2)), 'rstone')
    return im


def fallen_column():
    """쓰러진 기둥 토막(3x1): 땅에 누운 돌기둥 마디 셋, 마디 사이가 벌어졌고 끝 단면이 보인다. 2줄 막힘이 아니라 몸통 1줄 막힘."""
    c = C(48, 16, seed=874); c.shadow(24, 13.8, 22, 1.8, 80)
    for (xa, xb, cy) in ((2, 15, 9), (17, 30, 9.5), (32, 45, 9)):
        c.new(); c.hcyl(xa, xb, cy, 4.6, 'rstone', amb=0.28, endcap='L', capmat='rstone')
        for x in range(xa + 2, xb, 4):
            for y in range(6, 13): c.darken(x, y, 1) if _hash(x, y, 875) > 0.3 else None
    im = F(c); px = im.load()
    for (x, y) in ((6, 4), (12, 5), (23, 5), (38, 4)): put(px, 48, 16, x, y, RGB('dust', 5))
    return im


def ruin_steps():
    """옛 돌계단 토막(2x1): 묻힌 회당 앞에 남은 두 단, 모서리가 깨졌다. 걷기."""
    return recolor_ruin(PR.ruin_steps())
