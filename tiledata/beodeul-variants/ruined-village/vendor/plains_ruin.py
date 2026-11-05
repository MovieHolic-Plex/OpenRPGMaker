# (동결 사본) 초원 하이로드(plains-highroad) 도우미 — 폐허 마을 지도에서 기존 소품을 다시 쓰려고 복사. 경로만 한 단계 깊게 고쳤다.
# 초원 하이로드 폐허 조각 — 무너진 옛 망루·성벽 잔해. 버들항 성 석재(castle6.ash: 흰 회색 마름돌, 1px 어두운 줄눈,
# 돌마다 다른 톤, 왼쪽·위 밝은 모, 오른쪽·아래 어두운 모, 칩셋 점 질감)를 그대로 쓴다. 3/4 시점(윗면+앞면, 옆면 없음),
# 빛 왼쪽 위, pz.fin 안쪽 윤곽. 결정적(같은 입력 = 같은 그림).
import math
from PIL import Image
import wl                                # noqa: F401  (city_v6 경로·팔레트 등록)
import pz, pv
from castle6 import ash
from roman import ST, mul, mix
from px2 import _hash
from wl import hx, PAL

LEAF = [hx(c) for c in PAL['leaf']]
MOSS = [hx(c) for c in PAL['moss']]
LAWN = [hx(c) for c in ('#3f7a2c', '#4b8232', '#579f35', '#58a035', '#73b83e', '#8fd24a')]
SHADOW = (14, 30, 8)


def _put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(c[:3]) + (a,)


def _h(*k):
    """정수 키 해시 0..1."""
    v = 0
    for i, kk in enumerate(k): v = v * 131 + int(kk) * (7 + i * 13)
    return _hash(v, 3, 9301)


def _tufts(px, W, H, x0, x1, ybase, seed, dens=0.55, hmax=4):
    """밑동 잔풀: 땅에서 솟은 풀잎(왼쪽 밝게). ybase = 땅선."""
    for x in range(x0, x1):
        if _h(x, seed) > dens: continue
        hgt = 1 + int(_h(x, seed, 1) * hmax)
        lean = -1 if _h(x, seed, 2) < 0.3 else (1 if _h(x, seed, 2) > 0.8 else 0)
        for j in range(hgt):
            xx = x + (lean if j >= hgt - 1 and hgt > 2 else 0)
            t = 5 if j >= hgt - 1 else (4 if j > 0 else 2)
            if _h(x, seed, 3) < 0.25: t = min(5, t + 1)
            _put(px, W, H, xx, ybase - j, LAWN[t])


def _chips(px, W, H, pts):
    """잔돌 조각: (x,y,w) 작은 돌 — 윗줄 밝게, 아랫줄 어둡게."""
    for (x, y, w) in pts:
        for i in range(w):
            _put(px, W, H, x + i, y, ST[6] if i < w - 1 else ST[5])
            _put(px, W, H, x + i, y + 1, ST[4] if i < w - 1 else ST[3])
        _put(px, W, H, x - 1, y + 1, ST[3]); _put(px, W, H, x + w, y + 1, ST[2])


def _ivy(px, W, H, root, top, seed, spread=4, alpha_ok=True):
    """담쟁이: 밑동 root(x,y)에서 top 높이까지 기는 줄기 + 잎 덩이. 이미 칠한 돌 위에만 잎을 얹는다."""
    x, y = root
    rng_i = 0
    while y > top:
        rng_i += 1
        y -= 1
        x += (-1 if _h(seed, rng_i) < 0.33 else (1 if _h(seed, rng_i) > 0.7 else 0))
        x = max(1, min(W - 2, x))
        if _h(seed, rng_i, 4) < 0.5 and px[x, y][3] == 255: _put(px, W, H, x, y, LEAF[3])
        if _h(seed, rng_i, 5) < 0.42 + 0.3 * (y - top) / max(1, root[1] - top):
            for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (-1, -1), (1, 1), (-2, 0)):
                if _h(seed, rng_i, dx + 3, dy + 3) < 0.6:
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and (px[xx, yy][3] == 255 or not alpha_ok):
                        t = 5 if dx < 0 or dy < 0 else 3
                        if _h(xx, yy, seed) > 0.8: t = 6
                        _put(px, W, H, xx, yy, LEAF[t])


def _moss(px, W, H, x0, x1, y0, y1, seed, p=0.18):
    for y in range(y0, y1):
        for x in range(x0, x1):
            if 0 <= x < W and 0 <= y < H and px[x, y][3] == 255 and _h(x // 2, y // 2, seed) < p and _h(x, y, seed) < 0.7:
                r, g, b, _ = px[x, y]
                lum = (r + g + b) / 3
                t = 5 if lum > 180 else (4 if lum > 140 else 3)
                _put(px, W, H, x, y, MOSS[t])


# ================================================================ 무너진 망루 (4x7칸)
def watchtower_ruin():
    """앞면이 보이는 둥근 망루 몸통: 아랫부분 온전, 왼쪽·가운데 위가 무너져 마름돌이 계단꼴로 깨졌다.
    깨진 윗선 위로 벽 두께(밝은 윗면)와 안쪽 뒷벽(그늘)이 보여 속이 빈 탑으로 읽힌다. 오른쪽 위만 원래 높이(성가퀴 둘).
    아래 가운데 아치 입구(안쪽 어둠), 오른쪽 화살구멍, 왼쪽 담쟁이, 밑동 잔풀·잔돌."""
    W, H = 64, 112
    R = W / 2.0; ry = 6; bw, bh = 14, 8; NC = 10
    yfoot = H - 2                       # 축 위 앞쪽 땅선
    ybase = yfoot - ry                  # 바닥 타원 중심선
    o = Image.new('RGBA', (W, H)); px = o.load()
    Ztop = (NC + 1) * bh

    def rc(u, z):
        """마름돌 좌표: z(땅에서 높이) → 아래에서 r번째 줄, 그 줄의 돌 번호 c."""
        r = z // bh; X = int(u + 64); off = ((NC - r) % 2) * (bw // 2)
        return r, (X + off) // bw

    def hf(uc):                         # 앞벽 남은 높이(줄 수, 실수): 왼쪽 낮고 오른쪽 온전
        t = min(1.0, max(0.0, (uc + R) / (2 * R)))          # 0 왼쪽 … 1 오른쪽
        if t > 0.62: return NC + 0.4                                              # 온전
        return 3.4 + 6.0 * (t / 0.62) ** 1.5

    def hb(uc):                         # 뒷벽 안쪽 높이: 대체로 높고 왼쪽 끝만 조금 낮다
        t = min(1.0, max(0.0, (uc + R) / (2 * R)))
        return NC + 0.4 - (2.6 * (1 - t) ** 2)

    present = {}

    def alive(r, c, which):
        k = (r, c, which)
        if k in present: return present[k]
        if r < 0: return True
        uc = c * bw - ((NC - r) % 2) * (bw // 2) + bw / 2 - 64          # 돌 가운데 u
        lim = hf(uc) if which == 'f' else hb(uc)
        jit = (_h(r, c, 11 if which == 'f' else 12) - 0.5) * 1.3
        ok = r + 1 <= lim + jit
        if ok and r > 0:               # 받치는 아래 돌이 있어야 한다(떠 있는 돌 금지)
            off = ((NC - r) % 2) * (bw // 2); offb = ((NC - r + 1) % 2) * (bw // 2)
            xl = c * bw - off; cl = (xl + offb) // bw; cr = (xl + bw - 1 + offb) // bw
            ok = alive(r - 1, cl, which) or alive(r - 1, cr, which)    # 반 돌 내밀기까지는 허용
        present[k] = ok
        return ok

    def zmax(u, which):
        z = 0
        while z < Ztop:
            r, c = rc(u, z)
            if not alive(r, c, which): break
            z += 1
        return z

    Ri = R - 5
    for x in range(W):
        d = x + 0.5 - R
        if abs(d) > R - 0.5: continue
        u, cz = pv._wrap(d, R - 0.5)
        yb_front = ybase + ry * cz                     # 앞면 땅선
        zf = zmax(u, 'f')
        ytf = yb_front - zf                            # 앞면 윗선
        k = min(1.12, 0.66 + 0.46 * max(0.0, cz * 0.85 - 0.3 * (d / R)))     # 버들항 원탑(tower6)과 같은 원통 명암
        # --- 안쪽(뒷벽 안면 + 벽 두께 윗면)
        if abs(d) < Ri:
            ui, czi = pv._wrap(d, Ri)
            yb_back = ybase - ry * czi                 # 뒷벽 안쪽 땅선
            zb = zmax(u, 'b')
            ytb = yb_back - zb
            yout_b = ybase - ry * cz - zb              # 뒷벽 바깥 윗선(두께)
            for y in range(int(math.floor(min(yout_b, ytb - 2))), int(math.ceil(ytf - 2))):
                if y < 0: continue
                if y < ytb:                            # 뒷벽 윗면(두께) — 밝다
                    c = ST[6] if (y < ytb - 1 and d < 0) else ST[5]
                    if _h(x, y, 31) > 0.86: c = ST[4]
                else:                                  # 뒷벽 안면: 빛을 받는 오른쪽 안면이 조금 밝다
                    zz = int(yb_back - y)
                    kin = 0.5 + 0.2 * max(0.0, d / Ri)
                    c = mul(ash(int(ui + 200), Ztop - 1 - zz, bw=bw, bh=bh, seed=7), kin)
                _put(px, W, H, x, y, c)
        else:
            zb = zmax(u, 'b')
            ztop = max(zb, zf)                         # 가장자리: 뒷벽 바깥면이 윤곽까지 이어진다
            y_t = ybase - ry * cz - ztop
            for y in range(int(y_t), int(ytf - 2)):
                if y < 0: continue
                if y < y_t + 2: c = ST[6] if d < 0 else ST[5]
                else: c = mul(ash(int(u + 64), Ztop - 1 - int(ybase - ry * cz - y), bw=bw, bh=bh, seed=5), k)
                _put(px, W, H, x, y, c)
        # --- 앞벽 윗면(두께 2~3px): 깨진 돌 윗면
        for j in (3, 2, 1):
            y = int(round(ytf)) - j
            if j == 3 and zf >= NC * bh: c = ST[6] if d < 0 else ST[5]
            elif j == 3: continue
            else: c = ST[6] if (d < 0 and j == 2) else (ST[5] if j == 2 else mix(ST[5], ST[4], 0.5))
            if _h(x, j, 33) > 0.85: c = ST[4]
            _put(px, W, H, x, y, c)
        # --- 앞면(마름돌)
        for y in range(int(round(ytf)), int(math.ceil(yb_front)) + 1):
            z = int(yb_front - y)
            if z < 0: z = 0
            if z < 4:                                   # 비탈진 밑단(굽돌)
                c = mix(ash(int(u + 64), Ztop - 1 - z, bw=bw // 2 + 1, bh=4, seed=3), ST[4], 0.35)
            else:
                c = ash(int(u + 64), Ztop - 1 - z, bw=bw, bh=bh, seed=5)
            _put(px, W, H, x, y, mul(c, k))
    # --- 이끼·담쟁이
    _moss(px, W, H, 0, 40, int(ybase - 30), int(yfoot), 41, 0.22)
    _ivy(px, W, H, (7, int(ybase) + 2), int(ybase - 30), 51)
    _ivy(px, W, H, (58, int(ybase) + 2), int(ybase - 14), 53)
    # --- 아치 입구(안쪽 어둠) + 테 돌
    dw = 14; dh = 25; cxd = R
    for x in range(int(cxd - dw / 2) - 2, int(cxd + dw / 2) + 2):
        d = x + 0.5 - R; u, cz = pv._wrap(d, R - 0.5); yb = ybase + ry * cz
        for z in range(0, dh + 3):
            y = int(round(yb - z))
            dxn = (x + 0.5 - cxd)
            zc = dh - dw / 2                          # 아치 시작 높이
            rr = math.hypot(dxn, max(0.0, z - zc))
            inner = abs(dxn) < dw / 2 and (z < zc or rr < dw / 2)
            ring = (not inner) and (abs(dxn) < dw / 2 + 2) and (z < zc or rr < dw / 2 + 2.2)
            if inner:
                c = ST[0] if z > 3 else ST[1]
                if z <= 1: c = mix(ST[1], ST[2], 0.5)            # 문턱 안쪽 바닥
                if dxn < -dw / 2 + 2 and z > 3: c = ST[1]        # 왼쪽 문설주 안쪽 그늘
                _put(px, W, H, x, y, c)
            elif ring:
                c = ST[6] if dxn < 0 else ST[4]
                if z >= zc and int(math.degrees(math.atan2(z - zc, dxn))) % 30 < 4: c = ST[3]   # 홍예돌 줄눈
                _put(px, W, H, x, y, c)
    # --- 화살구멍(오른쪽 온전한 면)
    for (sx, z0) in ((51, 46),):
        d = sx + 0.5 - R; u, cz = pv._wrap(d, R - 0.5); yb = ybase + ry * cz
        for z in range(z0, z0 + 11):
            y = int(round(yb - z))
            _put(px, W, H, sx, y, ST[0]); _put(px, W, H, sx + 1, y, ST[1])
            _put(px, W, H, sx - 1, y, ST[6]); _put(px, W, H, sx + 2, y, ST[4])
        y = int(round(yb - z0 - 11)); _put(px, W, H, sx, y, ST[6]); _put(px, W, H, sx + 1, y, ST[5])
        y = int(round(yb - z0 + 1))
        for i in range(-1, 3): _put(px, W, H, sx + i, y, ST[6] if i < 1 else ST[5])
    im = pz.fin(o)
    # --- 밑동: 떨어진 돌·잔풀(윤곽 뒤에 얹는다)
    p = im.load()
    _chips(p, W, H, ((1, H - 4, 4), (8, H - 3, 3), (52, H - 4, 3), (58, H - 3, 3)))
    _tufts(p, W, H, 0, 22, H - 2, 61, 0.6, 4)
    _tufts(p, W, H, 42, 64, H - 2, 62, 0.6, 4)
    _tufts(p, W, H, 0, 64, H - 1, 63, 0.35, 2)
    return im


# ================================================================ 성벽 토막
def _curtain(halves, seed, ivy=(), end_l=False, end_r=False):
    """낮은 성벽: 반 돌(8px) 단위 남은 줄 수 halves[i](0~3). 3줄이 다 있으면 갓돌(윗면)을 얹는다.
    깨진 곳은 돌 윗면 두께가 보이고, 0줄은 비워 둔다(잔해 더미를 그 자리에 얹는다)."""
    W = len(halves) * 8; H = 32; NC = 3; bw, bh = 16, 8
    o = Image.new('RGBA', (W, H)); px = o.load()
    yg = 27                                            # 맨 아래 돌 줄의 아랫줄(땅선 위)
    def nrow(x): return halves[max(0, min(len(halves) - 1, x // 8))]
    for x in range(W):
        n = nrow(x)
        if n <= 0: continue
        # 돌 줄 r 은 그 돌이 걸친 두 반칸 중 낮은 쪽 높이까지만(계단꼴로 깨짐)
        top_z = 0
        for r in range(n):
            off = ((NC - 1 - r) % 2) * (bw // 2)
            xl = ((x + off) // bw) * bw - off
            lim = min(nrow(xl), nrow(xl + bw - 1)) if xl >= 0 and xl + bw - 1 < W else n
            if r < lim: top_z = (r + 1) * bh
            else: break
        if top_z == 0: top_z = bh // 2                    # 깨진 끝: 반쯤 남은 굽돌
        full = top_z >= NC * bh and n >= NC
        for z in range(top_z):
            y = yg - z
            c = ash(x + seed * 37, NC * bh - 1 - z, bw=bw, bh=bh, seed=seed)
            _put(px, W, H, x, y, c)
        yt = yg - top_z
        if full:                                       # 갓돌: 윗면 3px + 처마 그늘 1px
            _put(px, W, H, x, yt, ST[3])
            _put(px, W, H, x, yt - 1, ST[5] if _h(x // 5, 1, seed) > 0.3 else mix(ST[5], ST[4], 0.4))
            _put(px, W, H, x, yt - 2, ST[5])
            _put(px, W, H, x, yt - 3, ST[6] if x % 11 != 10 else ST[5])
            if x % 12 == 11: _put(px, W, H, x, yt - 2, ST[4])
        else:                                          # 깨진 윗선: 벽 두께가 보이는 거친 윗면 2px
            _put(px, W, H, x, yt - 1, ST[5] if _h(x, 2, seed) > 0.25 else ST[4])
            _put(px, W, H, x, yt - 2, ST[6] if _h(x, 3, seed) > 0.4 else ST[5])
        # 밑단 굽돌(조금 어둡다)
        _put(px, W, H, x, yg + 1, ST[4]); _put(px, W, H, x, yg + 2, ST[3])
    _moss(px, W, H, 0, W, 16, yg + 3, seed + 3, 0.16)
    for (rx, top) in ivy: _ivy(px, W, H, (rx, yg + 1), top, seed + rx)
    im = pz.fin(o); p = im.load()
    # 땅 그림자(빛 왼쪽 위 → 아래로 짧게)
    for x in range(W):
        if nrow(x) > 0:
            for y in (yg + 3, yg + 4):
                if p[x, y][3] == 0: p[x, y] = SHADOW + (80 if y == yg + 3 else 45,)
    _tufts(p, W, H, 0, W, yg + 3, seed + 9, 0.5, 4)
    _tufts(p, W, H, 0, W, yg + 4, seed + 10, 0.3, 2)
    return im


def ruin_wall_w():
    """서쪽 성벽 토막(7칸): 동쪽 끝은 망루 몸통 뒤로 들어가고, 서쪽 끝은 줄이 계단꼴로 무너져 잔해 더미로 이어진다."""
    return _curtain([0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3], 7, ivy=((22, 12), (70, 6)))


def ruin_wall_e():
    """동쪽 성벽 토막(7칸): 망루에 붙은 쪽은 온전, 가운데가 무너져 터진 틈(잔해 더미 자리), 끝은 한 줄만 남았다."""
    return _curtain([3, 3, 3, 3, 3, 3, 2, 1, 0, 0, 1, 2, 1, 0], 11, ivy=((40, 8), (86, 16)))


# ================================================================ 잔해 더미 · 낱돌 · 계단
def _block(px, W, H, x0, y0, w, h, tone=0, seed=0):
    """떨어진 마름돌 하나: 윗면 2px(밝다), 앞면(점 질감), 오른쪽·아래 어두운 모."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if y - y0 < 2:
                c = ST[6] if (x - x0 < w - 2) else ST[5]
                if y - y0 == 1: c = ST[5] if x - x0 < w - 1 else ST[4]
            else:
                c = ash(x + seed * 13, (y - y0) + 40, bw=64, bh=64, seed=seed)
                if x == x0 + w - 1 or y == y0 + h - 1: c = ST[4]
                if x == x0: c = mix(c, ST[6], 0.4)
            if tone: c = mul(c, 1 + tone * 0.06)
            _put(px, W, H, x, y, c)


def _heap(W, H, blocks, seed, tufts=True):
    o = Image.new('RGBA', (W, H)); px = o.load()
    for (x, y, w, h, t) in sorted(blocks, key=lambda b: b[1] + b[3]):   # 뒤(위) 돌부터
        _block(px, W, H, x, y, w, h, t, seed + x)
    _moss(px, W, H, 0, W, 0, H, seed, 0.12)
    im = pz.fin(o); p = im.load()
    for x in range(W):                                  # 바닥 그림자
        ys = [y for y in range(H) if p[x, y][3] == 255]
        if ys:
            yb = max(ys)
            if yb + 1 < H and p[x, yb + 1][3] == 0: p[x, yb + 1] = SHADOW + (70,)
    if tufts:
        _tufts(p, W, H, 0, W, H - 1, seed + 5, 0.45, 3)
    return im


def rubble_heap():
    """잔해 더미(3x2칸): 무너진 성벽에서 쏟아진 마름돌 더미. 뒤 돌이 위에, 앞 돌이 아래에 쌓였다."""
    B = [(14, 7, 11, 8, 1), (24, 9, 10, 7, 0),
         (5, 13, 12, 8, 0), (16, 14, 13, 8, -1), (29, 14, 11, 8, 0),
         (1, 20, 9, 7, -1), (11, 21, 12, 7, 0), (24, 21, 10, 7, 1), (35, 20, 10, 7, -1)]
    im = _heap(48, 30, B, 71)
    _chips(im.load(), 48, 30, ((44, 25, 3), (2, 27, 2)))
    return im


def rubble_small():
    """잔해 더미 작은 것(2x1칸): 성벽 끝·틈에 남은 마름돌 서너 개."""
    B = [(9, 2, 10, 7, 0), (2, 6, 10, 7, -1), (13, 7, 11, 7, 1), (23, 5, 8, 8, 0)]
    im = _heap(32, 16, B, 81)
    return im


def fallen_block():
    """떨어진 마름돌(1칸): 풀밭에 반쯤 묻힌 깨진 마름돌 하나 — 모서리가 떨어져 나가 윤곽이 거칠고, 앞은 풀이 덮었다."""
    W, H = 16, 16
    o = Image.new('RGBA', (W, H)); px = o.load()
    x0, x1, yt, yb = 2, 13, 5, 12
    for y in range(yt, yb + 1):
        for x in range(x0, x1 + 1):
            # 깨진 모서리: 왼쪽 위·오른쪽 위가 비스듬히 떨어져 나감, 오른쪽 아래 이 빠짐
            if (x - x0) + (y - yt) < 3 or (x1 - x) + (y - yt) < 2 or (x1 - x < 2 and yb - y < 2): continue
            if y - yt < 2 + (1 if x > 9 else 0):                          # 윗면(오른쪽으로 살짝 기울었다)
                c = ST[6] if x < x1 - 2 else ST[5]
                if y - yt == 1 + (1 if x > 9 else 0): c = ST[5]
            else:
                c = ash(x + 5, y + 40, bw=64, bh=64, seed=91)
                if x >= x1 - 1: c = ST[4]
                if x == 6 and y > 8: c = ST[3]                               # 금
            _put(px, W, H, x, y, c)
    _moss(px, W, H, 0, W, 6, 13, 93, 0.3)
    im = pz.fin(o); p = im.load()
    for x in range(3, 15):
        if p[x, 13][3] == 0: p[x, 13] = SHADOW + (70,)
    _chips(p, W, H, ((13, 12, 2),))
    _tufts(p, W, H, 0, 16, 13, 95, 0.4, 4); _tufts(p, W, H, 1, 15, 14, 96, 0.5, 2)
    return im


def ruin_chips():
    """부스러기 돌(1칸, 걷는 장식): 무너진 벽 둘레 풀밭에 흩어진 작은 돌 조각."""
    o = Image.new('RGBA', (16, 16)); px = o.load()
    _chips(px, 16, 16, ((2, 9, 3), (8, 11, 2), (11, 6, 3), (5, 4, 2)))
    _tufts(px, 16, 16, 0, 16, 14, 97, 0.35, 2)
    return o


def ruin_steps():
    """입구 돌계단(2x1칸): 망루 아치 입구 앞 두 단. 윗단 좁고 아랫단 넓다, 오른쪽 모서리가 이 빠졌다."""
    W, H = 32, 16
    o = Image.new('RGBA', (W, H)); px = o.load()
    def step(x0, x1, y0, tread, rise, seed):
        for y in range(y0, y0 + tread + rise):
            for x in range(x0, x1):
                if y - y0 < tread:
                    c = ST[6] if (y == y0 and x < x1 - 2) else ST[5]
                    if x == x1 - 1: c = ST[4]
                else:
                    c = ash(x + seed, (y - y0 - tread) + 3, bw=10, bh=4, seed=seed)
                    c = mul(c, 0.9)
                    if x == x1 - 1: c = ST[3]
                _put(px, W, H, x, y, c)
    step(5, 27, 0, 3, 3, 21)        # 윗단(문턱에 붙음)
    step(1, 31, 6, 3, 4, 23)        # 아랫단
    for (x, y) in ((30, 6), (30, 7), (29, 6), (30, 8)): px[x, y] = (0, 0, 0, 0)   # 이 빠진 모서리
    _moss(px, W, H, 0, 12, 6, 13, 25, 0.25)
    im = pz.fin(o); p = im.load()
    for x in range(1, 31):
        if p[x, 13][3] == 0: p[x, 13] = SHADOW + (75,)
        if p[x, 14][3] == 0: p[x, 14] = SHADOW + (40,)
    _tufts(p, W, H, 0, 4, 13, 27, 0.6, 3); _tufts(p, W, H, 28, 32, 13, 28, 0.6, 3)
    return im
