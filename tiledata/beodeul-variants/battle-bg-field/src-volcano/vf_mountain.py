# 분화구 산(crater_mountain)과 연기 기둥(smoke_column). 3/4(사선 투영: 화면 y = 땅 y - 높이) 높이장을 광선으로 훑어
# 보이는 면을 찾고, 법선 · 빛(왼쪽 위, px2 와 같은 방향)으로 명암을 낸 뒤 7단 램프로 양자화한다.
# 산 앞면: 높이(등고선)를 따라 휘는 지층 띠(현무암 · 응회암 · 재층) + 꼭대기에서 아래로 갈라지는 골(능선 결) +
# 분화구 테두리(안쪽 벽은 용암 빛을 받아 붉다) + 앞쪽 테두리 틈에서 흘러내린 용암 줄기(아래로 갈수록 식어 껍질) + 불씨.
import math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from vf_base import P, hash2, smooth, LAV, F, put, RGB

LX, LY, LZ = -0.55, -0.65, 0.75
_n = math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= _n; LY /= _n; LZ /= _n


def _vn1(t, sc, seed):
    """1차원 값 잡음(배열)."""
    f = t / sc; i0 = np.floor(f).astype(np.int64); u = f - i0; u = u * u * (3 - 2 * u)
    a = hash2(i0, 0, seed); b = hash2(i0 + 1, 0, seed)
    return a * (1 - u) + b * u


def crater_mountain(Wc=18, Hc=12, seed=31, Rx=136.0, Ry=54.0, Hh=100.0):
    # (전투 배경용 확장: 밑동 타원·높이를 인자로 — 기본값은 원 지도와 같다)
    W, H = Wc * 16, Hc * 16
    cx = W / 2.0
    rc = 0.25                     # 분화구 반지름(정규화)
    Yc = H - Ry - 2               # 밑동 중심의 화면 y(높이 0)
    D = 22.0                      # 분화구 깊이

    def surf(xw, yw):
        rho0 = np.sqrt((xw / Rx) ** 2 + (yw / Ry) ** 2)
        th = np.arctan2(yw / Ry, xw / Rx)
        # 밑동 가장자리를 들쭉날쭉하게(골짜기 끝이 땅으로 번진다)
        rho = rho0 * (1 + (_vn1(th * 9.0, 1.0, seed + 3) - 0.5) * 0.10)
        s = np.clip((1 - rho) / (1 - rc), 0, 1)
        z = Hh * s ** 1.55
        # 능선·골: 각도 방향 잡음, 아래로 갈수록 깊다
        ridge = (_vn1(th * 17.0 + rho * 4.0, 1.0, seed + 5) - 0.5) * 2 + (_vn1(th * 43.0 - rho * 6.0, 1.0, seed + 6) - 0.5) * 0.9
        amp = 5.5 * (0.55 + 0.9 * _vn1(th * 5.0, 1.0, seed + 7))
        z = z + ridge * amp * np.clip((rho - rc) / 0.30, 0, 1) * np.clip((1 - rho) / 0.35, 0, 1)
        # 분화구
        inside = rho < rc
        zc = Hh - D * np.clip(1 - (rho / rc) ** 3, 0, 1)
        z = np.where(inside, zc, z)
        z = np.where(rho >= 1.0, -1.0, z)
        return z, rho, th

    def zbase(xw, yw):
        rho0 = np.sqrt((xw / Rx) ** 2 + (yw / Ry) ** 2)
        return Hh * np.clip((1 - rho0) / (1 - rc), 0, 1) ** 1.55

    sy, sx = np.mgrid[0:H, 0:W].astype(np.float64)
    xw = sx + 0.5 - cx
    hitz = np.full((H, W), -1.0); hity = np.zeros((H, W))
    done = np.zeros((H, W), bool)
    for z in np.arange(Hh + 2, -0.01, -0.5):
        yw = sy + 0.5 - Yc + z
        zs, _, _ = surf(xw, yw)
        hit = (~done) & (zs >= z) & (zs >= 0)
        hitz[hit] = z; hity[hit] = yw[hit]; done |= hit
    solid = done
    yw = hity
    zs, rho, th = surf(xw, yw)
    e = 0.7
    zx1, _, _ = surf(xw + e, yw); zx0, _, _ = surf(xw - e, yw)
    zy1, _, _ = surf(xw, yw + e); zy0, _, _ = surf(xw, yw - e)
    gx = (zx1 - zx0) / (2 * e); gy = (zy1 - zy0) / (2 * e)
    gx = np.clip(gx, -6, 6); gy = np.clip(gy, -6, 6)
    nl = np.sqrt(gx * gx + gy * gy + 1)
    nx, ny, nz = -gx / nl, -gy / nl, 1 / nl
    sh = 0.16 + 0.84 * np.clip(nx * LX + ny * LY + nz * LZ, 0, 1)
    gr = (hash2(sx, sy, seed + 9) - 0.5) * 0.10 + (smooth(W, H, 3, seed + 10) - 0.5) * 0.16
    tone = np.clip(np.rint(0.4 + (sh + gr) * 5.6), 1, 6).astype(int)

    # 지층: 등고선(높이) 띠. 경계는 각도 방향으로 출렁인다
    wob = (_vn1(th * 7.0, 1.0, seed + 11) - 0.5) * 7 + (_vn1(th * 19.0, 1.0, seed + 12) - 0.5) * 3
    zb = zbase(xw, yw)
    zz = zb + wob
    BT = 15.0
    band = np.floor(zz / BT).astype(int)
    bh = hash2(band, 0, seed + 30)
    kind = np.where(bh < 0.34, 1, np.where(bh < 0.52, 2, 0))                 # 0 현무암 1 응회암 2 재층 (띠마다 무작위, 두께 같지 않게)
    kind = np.where((zz % BT) > BT * (0.55 + 0.4 * hash2(band, 1, seed + 31)), 0, kind)
    kind = np.where(hitz > Hh - 6, 2, kind)                                    # 꼭대기 테두리 = 밝은 재
    rgb = np.zeros((H, W, 3), np.int64)
    pb, pt, pa = P('basalt'), P('tuff'), P('vash')
    rgb[:] = pb[tone]
    rgb = np.where((kind == 1)[..., None], pt[np.clip(tone, 1, 5)], rgb)
    rgb = np.where((kind == 2)[..., None], pa[np.clip(tone + 1, 2, 6)], rgb)
    # 띠 경계 화소: 아래 띠 꼭대기 1px 어둡게(틈)
    bnd = solid & (np.floor((zz + 1.2) / BT) != band) & (rho > rc + 0.02) & (kind != 0)
    rgb = np.where(bnd[..., None], np.where((tone >= 4)[..., None], pb[2], pb[1]), rgb)

    # 분화구 안: 용암 바닥 + 붉게 비친 안벽
    inside = solid & (rho < rc)
    lav_floor = inside & (rho < rc * 0.62)
    wall = inside & ~lav_floor
    glow = np.clip(1 - (rho / rc), 0, 1)
    rgb = np.where(wall[..., None], np.where((glow > 0.30)[..., None], np.array(LAV[1]), pt[np.clip(tone, 1, 4)]), rgb)
    lt = np.where(hash2(sx // 2, sy, seed + 13) > 0.6, 4, 3)
    lt = np.where(hash2(sx, sy, seed + 14) > 0.93, 5, lt)
    lt = np.where(hash2(sx // 3, sy // 2, seed + 15) < 0.18, 1, lt)
    lv = np.array(LAV)[np.clip(lt, 0, 5)]
    rgb = np.where(lav_floor[..., None], lv, rgb)

    # 앞쪽 테두리 틈에서 흘러내린 용암 줄기: 각도 th0 근처의 골을 따라
    th0 = 1.30 + (_vn1(rho * 14.0, 1.0, seed + 22) - 0.5) * 0.30 + (rho - rc) * 0.35
    dth = np.angle(np.exp(1j * (th - th0)))
    wid = (0.06 + 0.07 * _vn1(rho * 22, 1.0, seed + 16)) * (1.0 - 0.35 * np.clip((rho - rc) / 0.5, 0, 1))
    stream = solid & (np.abs(dth) < wid) & (rho >= rc - 0.01) & (rho < 0.80)
    sk = np.clip((rho - rc) / (0.80 - rc), 0, 1)                    # 0 위(뜨거움) .. 1 아래(식음)
    hot = stream & (hash2(sx // 2, sy // 3, seed + 17) > sk * 1.05)
    edge = stream & ~ndi.binary_erosion(stream)
    srgb = np.where(hot[..., None], np.array(LAV)[np.clip(np.rint(4.6 - sk * 2.6 + (hash2(sx, sy, seed + 18) - 0.5)).astype(int), 1, 5)],
                    np.array([(48, 18, 18)]) + 0 * rgb)
    srgb = np.where((stream & ~hot & (hash2(sx, sy // 2, seed + 19) > 0.72))[..., None], np.array(LAV[2]), srgb)
    srgb = np.where(edge[..., None], np.array(LAV[1]), srgb)
    rgb = np.where(stream[..., None], srgb, rgb)
    # 줄기 곁 붉은 빛(1~3px)
    near = solid & ~stream & ndi.binary_dilation(stream, iterations=3) & (rho > rc)
    rgb = np.where((near & (hash2(sx, sy, seed + 20) < 0.5))[..., None], (rgb * 0.6 + np.array(LAV[2]) * 0.4).astype(np.int64), rgb)

    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255); out[..., 3] = np.where(solid, 255, 0)
    im = Image.fromarray(out, 'RGBA')
    im = F(im, 0.6)
    px = im.load()
    # 테두리 윗선(뒤쪽 테두리 꼭대기) 밝게
    for x in range(W):
        for y in range(H):
            if px[x, y][3]:
                if (hitz[y, x] > Hh - 3) and rho[y, x] >= rc: put(px, W, H, x, y, RGB('vash', 6) if hash2(x, y, 3) > 0.3 else RGB('vash', 5))
                break
    # 밑동: 굴러 떨어진 현무암 덩이 몇 개(땅과 잇는다)
    rng = np.random.default_rng(seed)
    for i in range(9):
        a = math.pi * rng.uniform(0.04, 0.96)
        if abs(a - math.pi / 2) < 0.22: a += 0.5 if a > math.pi / 2 else -0.5          # 앞 가운데(신전 자리) 비움
        k = rng.uniform(0.80, 0.99)
        bx = cx + math.cos(a) * Rx * k; by = Yc + math.sin(a) * Ry * k
        n = int(rng.integers(1, 4))
        for j in range(n):
            r = rng.uniform(1.8, 4.6) if j else rng.uniform(3.0, 5.6)
            ox, oy = (rng.uniform(-6, 6), rng.uniform(-2, 3)) if j else (0, 0)
            px_, py_ = bx + ox, by + oy
            for yy in range(int(py_ - r) - 1, int(py_ + r) + 2):
                for xx in range(int(px_ - r * 1.3) - 1, int(px_ + r * 1.3) + 2):
                    dx = (xx + 0.5 - px_) / (r * 1.3); dy = (yy + 0.5 - py_) / r
                    d = dx * dx + dy * dy
                    if d <= 1 and 0 <= xx < W and 0 <= yy < H:
                        t = 0 if d > 0.78 else (5 if (dx < -0.25 and dy < -0.15) else (2 if dx > 0.3 or dy > 0.4 else 3))
                        if t and hash2(xx, yy, seed + 40) > 0.9: t -= 1
                        put(px, W, H, xx, yy, RGB('basalt', t))
    # 불씨: 분화구 위로 튀는 점
    for i in range(26):
        x = int(cx - 30 + hash2(i, 1, seed + 21) * 60); y = int(2 + hash2(i, 2, seed + 21) * 26)
        if px[x, y][3] == 0:
            put(px, W, H, x, y, LAV[5] if i % 3 else LAV[4])
            if i % 4 == 0: put(px, W, H, x, y + 1, LAV[3])
    return im


def smoke_column(Wc=4, Hc=5, seed=41):
    """분화구 위로 오르는 연기 기둥: 크기 제각각 연기 뭉치가 휘며 오른다(위로 갈수록 크고 밝다, 빛 왼쪽 위),
    밑동은 분화구 빛을 받아 붉다. 뭉치 위치는 결정적 난수."""
    W, H = Wc * 16, Hc * 16
    from vf_base import C
    c = C(W, H, seed=seed)
    rng = np.random.default_rng(seed)
    puffs = []
    for i in range(34):
        f = rng.random() ** 0.85                                   # 0 = 밑(분화구), 1 = 꼭대기
        wdt = 2.0 + f * 13.0
        x = W * 0.40 + math.sin(f * 2.4 + 0.5) * 6 + f * 9 + rng.normal() * wdt * 0.55
        y = H - 6 - f * (H - 18) + rng.uniform(-2, 2)
        r = 2.4 + f * 6.5 + rng.uniform(0, 2.2)
        x = min(W - r - 1, max(r + 1, x)); y = max(r * 0.8 + 1, y)
        puffs.append((x, y, r, f))
    for k, (x, y, r, f) in enumerate(sorted(puffs, key=lambda p: p[1] + p[2] * 0.8)):   # 밑이 위쪽인 뭉치 먼저 → 아래 뭉치가 앞을 덮는다
        c.group(1)                                                 # 한 무리: 안쪽 윤곽 없이 명암으로만 뭉치를 가른다
        c.ellipsoid(x, y, r, r * 0.84, 'smoke', amb=0.36, bump=0.7, bsc=2.2, bias=0.12 * f - 0.06)
    im = F(c, 0.72)
    a = np.array(im); lab, n = ndi.label(a[..., 3] > 0)
    if n > 1:                                                       # 떨어진 작은 뭉치는 지운다(한 덩이 연기)
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = 1 + int(np.argmax(sizes))
        a[(lab != keep) & (lab > 0)] = 0; im = Image.fromarray(a, 'RGBA').copy()
    px = im.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if not a: continue
            k = (y - (H - 22)) / 22.0
            if k > 0 and hash2(x, y, seed + 2) < k * 0.8:
                L = LAV[2] if k > 0.6 else LAV[1]
                px[x, y] = (int(r * 0.5 + L[0] * 0.5), int(g * 0.6 + L[1] * 0.4), int(b * 0.6 + L[2] * 0.4), a)
    return im
