#!/usr/bin/env python3
"""월드맵 설계 데모 5단계 — 손 도트 애니메이션 12프레임.

효과 7종 + 구름 겹침층:
  해안 파도(4프레임 주기) / 바다 반짝임 / 용암 일렁임(4) / 독늪·늪 기포(6) /
  폭포(4) / 화산 연기(12, 화면엔 6컷씩) / 마을 굴뚝 연기(12) / 구름·구름 그림자(연속 이동)
프레임은 4단계 지도(design-1x-v5b.png) 위에 픽셀 단위로 얹는다. 반투명은 4x4 베이어 디더로
표현해 도트 그림 결을 지킨다(진짜 알파 블렌딩을 쓰지 않는다).
"""
import sys, json, math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
N = 12                      # 전체 주기(프레임 수)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], float) / 16 + 1 / 32


def hs(x, y, s=0):
    """파이썬 정수 해시 → 0..1 (위치 고정 난수)."""
    n = (int(x) * 374761393 + int(y) * 668265263 + int(s) * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n ^= n >> 16
    return (n & 0xFFFF) / 65535.0


def hmap(H, W, s=0):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.uint64)
    n = (xx * np.uint64(374761393) + yy * np.uint64(668265263) + np.uint64(s * 2246822519 & 0xFFFFFFFF)) & np.uint64(0xFFFFFFFF)
    n = ((n ^ (n >> np.uint64(13))) * np.uint64(1274126177)) & np.uint64(0xFFFFFFFF)
    n ^= n >> np.uint64(16)
    return (n & np.uint64(0xFFFF)).astype(float) / 65535.0


def load():
    import make_map_v5 as M5
    M, ic, meta = M5.build_v5()
    base = np.array(Image.open(HERE / 'design-1x-v5b.png').convert('RGB'), np.uint8)
    return M, ic, base


def dpaint(img, x, y, col, alpha):
    """(x,y) 한 점을 alpha(0..1)만큼 디더로 칠한다."""
    if 0 <= y < img.shape[0] and 0 <= x < img.shape[1] and alpha > BAYER[y & 3, x & 3]:
        img[y, x] = col


def puff(img, cx, cy, r, pal, alpha, seed, tex=0.12):
    """울퉁불퉁한 연기 덩이 하나. pal=(밝음, 중간, 어두움). 윗왼쪽에서 빛을 받는다."""
    R = int(r + 3)
    for y in range(int(cy) - R, int(cy) + R + 1):
        for x in range(int(cx) - R, int(cx) + R + 1):
            dx, dy = x + .5 - cx, y + .5 - cy
            d = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            rr = r * (1 + .17 * math.sin(3 * ang + seed) + .10 * math.sin(5 * ang + 2.1 * seed))
            if d > rr:
                continue
            t = (-.55 * dx - .85 * dy) / max(r, 1)
            k = 0 if t > .30 else (2 if t < -.38 or d > rr - 1.0 and t < 0 else 1)
            if hs(x, y, int(seed * 10)) < tex:
                k = min(2, max(0, k + (1 if hs(x, y, 7) < .5 else -1)))
            dpaint(img, x, y, pal[k], alpha)


# ─── 해안 파도 · 반짝임 ────────────────────────────────────────────────
def water_masks(base, G):
    Gpx = np.kron(G, np.ones((16, 16), np.int16))
    r, g, b = [base[..., i].astype(int) for i in range(3)]
    wat = (b > r + 28) & (g > r - 2) & (b - g < 100) & (b > 90)
    sea_near = ndi.binary_dilation(Gpx == 0, iterations=10)
    return Gpx, wat, sea_near


def fx_waves(img, f, wat, sea_near, dist, hx):
    band = [6.2, 4.3, 2.4, 1.3][f % 4]
    prev = [1.3, 6.2, 4.3, 2.4][f % 4]
    m = wat & sea_near
    ring = m & (np.abs(dist - band) < .62)
    trail = m & (np.abs(dist - prev) < .55) & (prev > band)
    cov = np.where(dist < 3, .92, .66)
    hot = ring & (hx < cov)
    img[hot] = np.where((dist[hot] < 3)[:, None], [226, 244, 250], [176, 214, 236])
    tr = trail & (hx > .55) & (hx < .8)
    img[tr] = [132, 184, 222]
    # 해안에 닿는 프레임: 물가 첫 줄이 잠깐 밝아진다
    if f % 4 == 3:
        e = m & (dist < 1.7) & (hx < .7)
        img[e] = [232, 246, 252]


def fx_sparkle(img, f, wat):
    H, W = wat.shape
    cs = 8
    for cy in range(0, H, cs):
        for cx in range(0, W, cs):
            if hs(cx, cy, 91) > .22:
                continue
            ph = int(hs(cx, cy, 92) * N)
            if (f - ph) % N not in (0, 1):
                continue
            px = cx + int(hs(cx, cy, 93) * cs)
            py = cy + int(hs(cx, cy, 94) * cs)
            if py < H and px < W and wat[py, px]:
                img[py, px] = [236, 248, 255]
                if (f - ph) % N == 0 and px + 1 < W and wat[py, px + 1]:
                    img[py, px + 1] = [170, 214, 240]


# ─── 용암 ──────────────────────────────────────────────────────────────
def fx_lava(img, f, base, Gpx):
    r, g, b = [base[..., i].astype(int) for i in range(3)]
    lava = (Gpx == 2) & (r > 130) & (b < 110) & (r > g + 40)
    H, W = lava.shape
    yy, xx = np.mgrid[0:H, 0:W]
    ph = 2 * math.pi * (f % 4) / 4
    w = np.sin(xx * .62 + yy * .41 - ph) + .6 * np.sin(xx * .23 - yy * .71 + ph * 2)
    lvl = np.where(w > .5, 1, np.where(w < -.6, -1, 0))
    add = np.zeros((H, W, 3), int)
    add[lvl == 1] = [70, 70, 20]
    add[lvl == -1] = [-70, -40, 0]
    img[lava] = np.clip(img[lava].astype(int) + add[lava], 0, 255)
    # 불티: 용암 위로 잠깐 떴다 지는 점
    ys, xs = np.nonzero(lava)
    for cy in range(0, H, 10):
        for cx in range(0, W, 10):
            if hs(cx, cy, 71) > .12 or not lava[min(cy + 4, H - 1), min(cx + 4, W - 1)]:
                continue
            p = int(hs(cx, cy, 72) * N)
            k = (f - p) % N
            if k < 3:
                x, y = cx + 4, cy + 4 - k
                if lava[y, x]:
                    img[y, x] = [255, 236, 140] if k == 0 else [255, 176, 70]


# ─── 기포 ──────────────────────────────────────────────────────────────
def fx_bubbles(img, f, base, G):
    H, W = G.shape
    for ty in range(H):
        for tx in range(W):
            gt = int(G[ty, tx])
            if gt not in (3, 19):
                continue
            if hs(tx, ty, 41) > (.55 if gt == 3 else .30):
                continue
            ox = 3 + int(hs(tx, ty, 42) * 10)
            oy = 4 + int(hs(tx, ty, 43) * 9)
            ph = int(hs(tx, ty, 44) * 6)
            s = (f + ph) % 6
            x, y = tx * 16 + ox, ty * 16 + oy
            bg = base[y, x].astype(int)
            rim = np.clip(bg + 62, 0, 255)
            fil = np.clip(bg + 26, 0, 255)
            sh = np.clip(bg * .55, 0, 255).astype(int)
            hi = np.clip(bg + 120, 0, 255)
            if s == 0:
                img[y, x] = fil
            elif s == 1:
                img[y - 1:y + 1, x:x + 2] = rim
                img[y, x] = fil
            elif s == 2:
                img[y - 1:y + 2, x - 1:x + 2] = rim
                img[y, x] = sh
                img[y - 1, x - 1] = hi
            elif s == 3:
                img[y - 1:y + 2, x - 1:x + 2] = rim
                img[y, x] = fil
                img[y - 1, x - 1] = hi
                img[y + 1, x + 1] = sh
            elif s == 4:          # 터짐: 네 점이 퍼진다
                for dx, dy in ((-2, -1), (2, -1), (-1, 2), (2, 2)):
                    img[y + dy, x + dx] = rim


# ─── 폭포 ──────────────────────────────────────────────────────────────
WF = (23 * 16, 29 * 16)      # 절벽 면 타일(23,29) 왼쪽 위 — 아래가 강 머리(23,30)


def fx_waterfall(img, f):
    x0, y0 = WF
    light, mid, dark, white = (170, 220, 246), (96, 162, 224), (52, 110, 186), (244, 252, 255)
    for c in range(10):
        x = x0 + 3 + c
        off = int(hs(c, 3, 5) * 8)
        for yl in range(16):
            y = y0 + yl
            v = (yl + 2 * f + off) % 8
            if c in (0, 9):
                col = dark
            elif v < 3:
                col = white
            elif v < 5:
                col = light
            else:
                col = mid
            img[y, x] = col
    # 윗 입술(물이 넘는 곳)과 아래 튀는 물보라
    for c in range(10):
        img[y0, x0 + 3 + c] = light if (c + f) % 3 else white
    for c in range(-1, 11):
        for k in range(5):
            if hs(c, k, 60 + f) < (.62 - .1 * k):
                x, y = x0 + 3 + c, y0 + 16 + k - 1
                img[y, x] = white if k < 2 else (200, 232, 248)
    for k in range(2):
        img[y0 + 14 - 2 * (f % 2), x0 + 2 + 11 * k] = (220, 240, 250)


# ─── 연기 ──────────────────────────────────────────────────────────────
VOLC = (77 * 16 + 16, 16 * 16 + 4)       # 화구 위치(실측 후 조정)


def fx_volcano(img, f):
    pal_hot = ((226, 158, 104), (190, 110, 70), (120, 66, 52))
    pal_ash = ((176, 164, 160), (124, 114, 114), (82, 74, 80))
    ex, ey = VOLC
    out = []
    for k in range(6):
        p = ((f - 2 * k) % N) / N
        out.append((p, k))
    for p, k in sorted(out, reverse=True):
        x = ex + p * 26 + 5 * math.sin(p * 5.5 + k * 1.7)
        y = ey - p * 58
        r = 3.6 + p * 12
        a = min(1, p / .08) * (1 - max(0, p - .5) / .5) ** 1.4
        pal = pal_hot if p < .14 else pal_ash
        puff(img, x, y, r, pal, a * 1.02, seed=k * 1.3 + 1, tex=.1)


CHIMNEYS = {}


def fx_chimney(img, f, pts):
    pal = ((236, 236, 240), (188, 188, 202), (142, 142, 162))
    for (ex, ey, sc) in pts:
        for k in range(4):
            p = ((f - 3 * k) % N) / N
            x = ex + p * 6 * sc + 1.2 * sc * math.sin(p * 8 + k)
            y = ey - p * 22 * sc
            r = (1.5 + p * 3.4) * sc
            a = min(1, p / .12) * (1 - max(0, p - .45) / .55) ** 1.3
            puff(img, x, y, max(r, 1.1), pal, a * 1.02, seed=k + ex * .01, tex=.05)


# ─── 구름 ──────────────────────────────────────────────────────────────
def make_clouds(W, H, seed=3):
    """가로로 이어지는 구름·그림자 RGBA 층. 구름은 납작한 바닥의 몽글 덩이, 그림자는 바닥을 밀어 그린다."""
    rng = np.random.default_rng(seed)
    mask = np.zeros((H, W), bool)
    yy, xx = np.mgrid[0:H, 0:W]
    n_cl = 13
    spots = [(int(rng.uniform(0, W)), int(rng.uniform(80, H - 80))) for _ in range(n_cl)]
    for cx, cy in spots:
        k = int(rng.integers(4, 8))
        span = int(rng.uniform(70, 150))
        rmax = 0
        circles = []
        for i in range(k):
            ox = (i / (k - 1) - .5) * span
            r = rng.uniform(14, 28) * (1 - abs(i / (k - 1) - .5) * 0.9)
            oy = -r * .35 + rng.uniform(-4, 4)
            circles.append((ox, oy, r))
            rmax = max(rmax, r)
        base_y = cy + rmax * .55
        for ox, oy, r in circles:
            for dx in (-W, 0, W):
                d = np.hypot(xx - (cx + ox + dx), yy - (cy + oy))
                mask |= (d < r) & (yy < base_y + 0.02 * (xx - cx) ** 2 / 400)
    # 가장자리 잔 물결
    mask = ndi.binary_opening(mask, iterations=1)
    up = np.zeros_like(mask)
    up[1:] = mask[:-1]
    # 윗면은 흰색, 바닥 쪽 3줄은 푸른 회색
    dist_below = np.zeros((H, W), int)
    for y in range(H - 2, -1, -1):
        dist_below[y] = np.where(mask[y], dist_below[y + 1] + 1, 0)
    # dist_below: 아래로 이어진 칸 수 → 바닥에서 위로 가려면 위쪽부터 세야 하므로 다시 계산
    depth = np.zeros((H, W), int)   # 구름 안에서 "아래로 남은 칸 수"
    for y in range(H - 2, -1, -1):
        depth[y] = np.where(mask[y], depth[y + 1] + 1, 0)
    bnd = mask & ~ndi.binary_erosion(mask, iterations=1)
    cl = np.zeros((H, W, 4), np.uint8)
    body = mask
    tone = np.where(depth <= 3, 2, np.where(depth <= 6, 1, 0))
    cols = np.array([[252, 253, 255], [226, 234, 246], [194, 208, 230]])
    cl[body, :3] = cols[tone[body]]
    bay = np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]
    a = np.where(bnd, 96, 168)
    # 안쪽에서 가장자리로 갈수록 디더로 성기게 — 테두리에서 한 겹 더 빼서 흩뿌림
    ring2 = ndi.binary_dilation(bnd, iterations=1) & mask & ~bnd
    a = np.where(ring2, 142, a)
    cl[..., 3] = np.where(body, a, 0)
    cl[bnd & (bay > .55), 3] = 0          # 가장자리 일부를 걷어내 들쑥날쑥하게
    # 그림자: 같은 모양을 오른쪽 아래로 밀고 디더 (불투명도 낮게)
    sh_mask = np.roll(np.roll(mask, 34, axis=1), 30, axis=0)
    sh = np.zeros((H, W, 4), np.uint8)
    sh[..., :3] = (18, 32, 70)
    sh[..., 3] = np.where(sh_mask & (bay < .55), 88, 0)
    return Image.fromarray(cl), Image.fromarray(sh)


# ─── 프레임 조립 ───────────────────────────────────────────────────────
CHIM_OFFS = {       # 이름 → [(x, y, 크기)] 굴뚝 원점(아이콘 왼쪽 위 기준 지도 픽셀). 지붕 오른쪽 어깨를 눈으로 잡았다.
    '강가 마을': [(41, 8, 1), (41, 24, 1)],
    '동쪽 항구': [(41, 8, 1), (41, 24, 1)],
    '고원 마을': [(19, 8, 1)],
    '사막 촌락': [(19, 8, 1)],
    '정글 마을': [(19, 8, 1)],
    '오아시스 촌락': [(19, 8, 1)],
    '남섬 마을': [(19, 8, 1)],
    '사바나 마을': [(17, 36, .55), (50, 37, .55), (23, 41, .55)],
}


def chimneys(ic):
    out = []
    for name, offs in CHIM_OFFS.items():
        x, y, w, h = ic[name]
        for ox, oy, sc in offs:
            out.append((x * 16 + ox, y * 16 + oy, sc))
    return out


def build_frames():
    M, ic, base = load()
    G = M.G
    Gpx, wat, sea_near = water_masks(base, G)
    dist = ndi.distance_transform_edt(wat)
    H, W = wat.shape
    hx = hmap(H, W, 5)
    chim = chimneys(ic)
    frames = []
    for f in range(N):
        img = base.copy()
        fx_waves(img, f, wat, sea_near, dist, hx)
        fx_sparkle(img, f, wat)
        fx_lava(img, f, base, Gpx)
        fx_bubbles(img, f, base, G)
        fx_waterfall(img, f)
        fx_chimney(img, f, chim)
        fx_volcano(img, f)
        frames.append(img)
    return base, frames, ic, chim


def diff_layer(base, fr):
    m = np.any(base != fr, axis=2)
    out = np.zeros(base.shape[:2] + (4,), np.uint8)
    out[..., :3] = fr
    out[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(out)


def composite_clouds(frame, cl, sh, shift):
    im = Image.fromarray(frame).convert('RGBA')
    s = shift % im.width
    for layer in (sh, cl):
        a = Image.new('RGBA', im.size, (0, 0, 0, 0))
        a.paste(layer, (s, 0))
        a.paste(layer, (s - im.width, 0))
        im = Image.alpha_composite(im, a)
    return im.convert('RGB')


def save_gif(frames_rgb, path, scale=3, ms=160):
    fr = [Image.fromarray(f) if isinstance(f, np.ndarray) else f for f in frames_rgb]
    fr = [f.resize((f.width * scale, f.height * scale), Image.NEAREST) for f in fr]
    pal = fr[0].quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in fr]
    q[0].save(path, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=False, disposal=1)


if __name__ == '__main__':
    out = HERE / 'anim-v5'
    out.mkdir(exist_ok=True)
    base, frames, ic, chim = build_frames()
    Image.fromarray(base).save(out / 'base.png')
    for f, fr in enumerate(frames):
        diff_layer(base, fr).save(out / f'diff{f:02d}.png', optimize=True)
        Image.fromarray(fr).save(out / f'full{f:02d}.png')
    cl, sh = make_clouds(base.shape[1], base.shape[0])
    cl.save(out / 'clouds.png', optimize=True)
    sh.save(out / 'cloudshadow.png', optimize=True)
    print('frames', len(frames), 'chimneys', len(chim))
