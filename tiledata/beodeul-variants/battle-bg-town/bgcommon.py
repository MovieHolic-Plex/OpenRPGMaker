# 전투 배경 공용 도구(이 폴더 전용) — 하늘 띠·손 구름·원경 능선·조각 붙이기·그림자·색 줄이기·검사.
# 640x360, 위 0~165 하늘·원경, 지평선 165~185, 아래 185~340 전투 바닥, 맨 아래 20px 은 HUD 가림.
# 그라데이션·블러·안티앨리어싱 없음: 하늘은 단색 띠 3~5개, 구름은 정수 화소 타원 덩이(밝은 윗모·어두운 밑줄).
import math, os
import numpy as np
from PIL import Image

W, H = 640, 360
HERE = os.path.dirname(os.path.abspath(__file__))


def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def h2(x, y, s):
    """결정적 정수 해시 → 0..1"""
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def new(col=(0, 0, 0)):
    return Image.new('RGBA', (W, H), tuple(col) + (255,))


def sky(im, bands):
    """bands = [(y_end, '#hex'), ...] 위에서 아래로. 띠 경계는 4~9px 마다 1px 계단(손으로 찍은 띠)."""
    px = im.load(); y0 = 0
    for i, (y1, c) in enumerate(bands):
        rgb = hx(c) + (255,)
        for x in range(W):
            step = 1 if (i > 0 and ((x // (5 + i % 3)) % 2 == 0)) else 0
            for y in range(max(0, y0 - step), min(H, y1)):
                px[x, y] = rgb
        y0 = y1


def cloud(im, cx, cy, w, h, seed, cols=('#f7fdff', '#dbe8ee', '#a9bccb')):
    """손 구름 덩이: 정수 타원 4~6개 합집합, 밑변은 평평. 윗모 1px 밝게, 밑 2줄 그늘."""
    hi, mid, sh = (hx(c) + (255,) for c in cols)
    n = 4 + int(h2(seed, 1, 7) * 3)
    blobs = []
    for k in range(n):
        t = (k + 0.5) / n
        bx = cx - w / 2 + t * w + (h2(seed, k, 3) - 0.5) * w * 0.12
        rx = w / n * (0.75 + h2(seed, k, 4) * 0.5)
        ry = h * (0.45 + 0.55 * math.sin(math.pi * t) * (0.7 + h2(seed, k, 5) * 0.3))
        blobs.append((bx, rx, ry))
    m = np.zeros((h + 2, w + 8), bool)
    ox, base = int(cx - w / 2) - 4, cy
    for (bx, rx, ry) in blobs:
        for yy in range(m.shape[0]):
            y = base - yy
            for xx in range(m.shape[1]):
                x = ox + xx
                if ((x + 0.5 - bx) / rx) ** 2 + ((y + 0.5 - base) / max(1, ry)) ** 2 <= 1.0 and y <= base:
                    m[yy, xx] = True
    px = im.load()
    for yy in range(m.shape[0]):
        for xx in range(m.shape[1]):
            if not m[yy, xx]: continue
            x, y = ox + xx, base - yy
            if not (0 <= x < W and 0 <= y < H): continue
            above = yy + 1 < m.shape[0] and m[yy + 1, xx]
            c = mid
            if not above: c = hi
            elif yy <= 1: c = sh
            elif yy == 2 and h2(x, y, seed) < 0.5: c = sh
            px[x, y] = c


def ridge(im, ybase, amp, cols, seed, x0=0, x1=W, step=3, period=(97, 41, 19)):
    """원경 능선(산·언덕·나무 줄 실루엣): 높이를 step px 마다 계단으로. cols=(면, 윗모, 아랫그늘)."""
    face, top, low = (hx(c) + (255,) for c in cols)
    px = im.load(); ph = [h2(seed, i, 1) * 6.28 for i in range(3)]
    for x in range(x0, x1):
        xs = (x // step) * step
        v = sum(math.sin(xs / p * 6.28 / 3 + ph[i]) * (1.0 / (i + 1)) for i, p in enumerate(period))
        top_y = int(ybase - amp * (0.55 + 0.45 * v / 1.83))
        for y in range(max(0, top_y), min(H, ybase)):
            c = face
            if y == top_y: c = top
            elif y >= ybase - 2: c = low
            px[x, y] = c


def paste(im, spr, x, ybot, flip=False):
    """조각을 왼쪽 아래 기준으로 붙인다(바닥 줄 = ybot-1)."""
    if flip: spr = spr.transpose(Image.FLIP_LEFT_RIGHT)
    spr = spr.convert('RGBA')
    a = np.array(spr)[..., 3]; a = np.where(a >= 128, 255, 0).astype(np.uint8)   # 알파는 0/255 로만
    s2 = np.array(spr); s2[..., 3] = a; spr = Image.fromarray(s2, 'RGBA')
    im.alpha_composite(spr, (int(x), int(ybot - spr.height)))
    return (int(x), int(ybot - spr.height), int(x) + spr.width, int(ybot))


def cast_shadow(im, spr, x, ybot, dx=-5, depth=7, k=0.70, tint=(30, 34, 58)):
    """버들항식 그림자: 조각 아래 몇 줄의 실루엣을 왼쪽 아래로 밀어 땅을 어둡게(파란 회색 쪽)."""
    a = np.array(spr.convert('RGBA'))[..., 3] > 127
    hh, ww = a.shape
    foot = np.zeros(ww, bool)
    for r in range(max(0, hh - 6), hh): foot |= a[r]
    arr = np.array(im).astype(np.float64)
    t = np.array(tint, float)
    for d in range(depth):
        y = int(ybot + d)
        if y >= H: break
        for xx in np.nonzero(foot)[0]:
            X = int(x + xx + dx - d // 2)
            if 0 <= X < W:
                arr[y, X, :3] = arr[y, X, :3] * k + t * (1 - k)
    im.paste(Image.fromarray(arr.astype(np.uint8), 'RGBA'))


def darken_rows(im, y0, y1, k):
    arr = np.array(im).astype(np.float64); arr[y0:y1, :, :3] *= k
    im.paste(Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA'))


def put_ground(im, rgb, y0, mask=None):
    """rgb: (H-y0, W, 3) 배열을 y0 부터 깐다(mask 가 있으면 그 화소만)."""
    arr = np.array(im)
    region = arr[y0:, :, :3]
    if mask is None: region[:] = rgb[:H - y0]
    else: region[mask[:H - y0]] = rgb[:H - y0][mask[:H - y0]]
    arr[..., 3] = 255
    im.paste(Image.fromarray(arr, 'RGBA'))


def tile_img(tex, w, h):
    t = np.array(tex.convert('RGB'))
    ry, rx = -(-h // t.shape[0]), -(-w // t.shape[1])
    return np.tile(t, (ry, rx, 1))[:h, :w]


def jag_mask(w, h, y_edge_fn):
    """y_edge_fn(x) 아래(y >= edge)인 화소 True."""
    m = np.zeros((h, w), bool)
    for x in range(w): m[max(0, int(y_edge_fn(x))):, x] = True
    return m


def _kmeans_palette(rgb, n, iters=24):
    """색 n 개 팔레트: 고유 색을 (화소 수)^0.5 로 가중한 k-평균(멀리 떨어진 색부터 씨앗). 넓은 면이 팔레트를 독차지하지 않고
    작은 등불·창 색이 살아남으며, 넓은 잔디·판석의 미세한 결 단도 여러 개가 남는다. 결정적."""
    cols = rgb.getcolors(1 << 22)
    cnt = np.array([c for c, _ in cols], np.float64); C = np.array([p for _, p in cols], np.float64)
    w = cnt ** 0.5
    seeds = [int(np.argmax(cnt))]
    d = ((C - C[seeds[0]]) ** 2).sum(1)
    for _ in range(n - 1):
        k = int(np.argmax(d * w)); seeds.append(k); d = np.minimum(d, ((C - C[k]) ** 2).sum(1))
    P = C[seeds].copy()
    for _ in range(iters):
        lab = ((C[:, None, :] - P[None]) ** 2).sum(2).argmin(1)
        for j in range(n):
            m = lab == j
            if m.any(): P[j] = (C[m] * w[m, None]).sum(0) / w[m].sum()
    lab = ((C[:, None, :] - P[None]) ** 2).sum(2).argmin(1)
    P = np.rint(P).astype(np.uint8)
    lut = {tuple(int(v) for v in C[i]): tuple(int(v) for v in P[lab[i]]) for i in range(len(C))}
    return lut


def finish(im, n=96):
    """불투명 + 색 n 개 이하(디더 없음, 가중 k-평균 팔레트)."""
    rgb = im.convert('RGB')
    cnt = len(rgb.getcolors(1 << 22) or [])
    if cnt > n:
        lut = _kmeans_palette(rgb, n)
        a = np.array(rgb); flat = a.reshape(-1, 3)
        keys = flat[:, 0].astype(np.int64) << 16 | flat[:, 1].astype(np.int64) << 8 | flat[:, 2]
        uk, inv = np.unique(keys, return_inverse=True)
        mapped = np.array([lut[(int(k >> 16), int(k >> 8 & 255), int(k & 255))] for k in uk], np.uint8)
        rgb = Image.fromarray(mapped[inv].reshape(a.shape), 'RGB')
    return rgb


def check(path):
    im = Image.open(path)
    a = im.convert('RGBA').getchannel('A').getextrema()
    cols = len(im.convert('RGB').getcolors(1 << 20))
    ok = im.size == (W, H) and a == (255, 255) and cols <= 96
    return ok, im.size, a, cols
