# 전투 배경 공용 도우미 — 하늘 띠·손 구름·원경 능선·물체 붙이기(그림자 포함)·마감(색 수·불투명).
# 버들항 7단 팔레트 색만 쓴다. 그라데이션·블러·안티앨리어싱 없음, 1x 정수 픽셀.
import os, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VROOT = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(VROOT, '..', '..'))
W, H = 640, 360
HORIZON = 176            # 원경과 바닥이 만나는 줄(대략)
BATTLE = (120, 190, 560, 330)   # 배틀러 자리: 키 큰 물체·밝은 점 금지


def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def h2(x, y, s):
    """정수 좌표 해시 → [0,1). numpy 배열도 받는다."""
    x = np.asarray(x, np.int64); y = np.asarray(y, np.int64)
    v = (x * 374761393 + y * 668265263 + int(s) * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    v = v ^ (v >> 16)
    return (v & 0xFFFF) / 65536.0


def n1(x, sc, seed):
    """1차원 값 잡음(정수 마디 사이 선형) — 능선용."""
    x = np.asarray(x, float) / sc
    i = np.floor(x).astype(np.int64); f = x - i
    a = h2(i, 0, seed); b = h2(i + 1, 0, seed)
    f = f * f * (3 - 2 * f)
    return a * (1 - f) + b * f


def canvas(c=(0, 0, 0)):
    return Image.new('RGBA', (W, H), tuple(c) + (255,))


def sky(img, bands, y1=HORIZON):
    """bands = [(y_end, '#rrggbb'), ...] 위→아래. 띠 경계는 2줄 체크 디더(손 도트 관용)."""
    a = np.array(img)
    y0 = 0
    cols = [hx(c) for _, c in bands]
    for i, (ye, c) in enumerate(bands):
        a[y0:min(ye, y1), :, :3] = hx(c)
        y0 = ye
    # 경계 디더: 경계 위 2줄에 아래 색 체크
    for i in range(len(bands) - 1):
        ye = bands[i][0]; nxt = cols[i + 1]
        for dy, ph in ((-1, 0), (-2, 1)):
            yy = ye + dy
            if 0 <= yy < y1:
                xs = np.arange(W)
                m = ((xs + yy) % 2 == 0) if dy == -1 else ((xs + yy) % 4 == 0)
                a[yy, m, :3] = nxt
    img.paste(Image.fromarray(a, 'RGBA'))


def cloud(img, cx, cy, w, h, ramp, seed=1, flat=False):
    """손 구름 덩이: 윗변은 크고 작은 둥근 혹, 밑변은 납작. ramp = [밑 그늘, 그늘, 몸, 밝음] 4색.
    (cx, cy) = 밑변 가운데, w = 폭, h = 가장 높은 혹 높이."""
    a = np.array(img)
    Y, X = np.mgrid[0:H, 0:W]
    m = np.zeros((H, W), bool)
    rng = np.random.RandomState(seed)
    k = max(3, int(w / max(6, h * 0.9)))
    lobes = []
    for i in range(k):
        t = (i + 0.5) / k
        env = math.sin(math.pi * (0.08 + 0.84 * t)) ** 0.8
        r = max(3.0, h * env * rng.uniform(0.62, 1.0) * (0.55 if flat else 1.0))
        bx = cx - w / 2 + t * w + rng.uniform(-2, 2)
        lobes.append((bx, r))
        m |= ((X - bx) ** 2 + ((Y - (cy - r * 0.55)) * 1.05) ** 2) <= r * r
    m |= (Y <= cy) & (Y >= cy - max(2, h * 0.30)) & (np.abs(X - cx) <= w / 2)
    m &= Y <= cy
    if not m.any(): return
    up = np.roll(m, 1, 0)
    body = m.copy()
    # 혹마다 왼쪽 위가 밝다 — 혹 중심에서 왼위 방향 거리로 밝음/몸/그늘
    tone = np.full((H, W), 2, int)
    for bx, r in lobes:
        by = cy - r * 0.55
        inl = ((X - bx) ** 2 + (Y - by) ** 2) <= r * r
        d = ((X - (bx - r * 0.35)) ** 2 + (Y - (by - r * 0.45)) ** 2) / (r * r)
        tone = np.where(inl & (d < 0.30), np.maximum(tone, 3), tone)
    tone = np.where(Y >= cy - max(1, int(h * 0.16)), 1, tone)          # 밑 그늘 띠
    tone = np.where(Y == cy, 0, tone)
    # 혹 사이 골: 위 혹의 아래 가장자리 1px 그늘
    for bx, r in lobes:
        by = cy - r * 0.55
        ring = (np.abs(np.sqrt((X - bx) ** 2 + (Y - by) ** 2) - r) < 0.6) & (Y > by + r * 0.3) & (Y < cy - 2)
        tone = np.where(ring & body, np.minimum(tone, 1), tone)
    top_edge = m & ~up
    tone = np.where(top_edge & (tone < 3), 3, tone)
    for t in range(4):
        sel = body & (tone == t)
        a[sel, :3] = hx(ramp[t])
    img.paste(Image.fromarray(a, 'RGBA'))


def ridge(img, ybase, amp, cols, seed=1, sc=60, sc2=17, x0=0, x1=W, peaks=None, lit=True, tex=0.0, y_floor=None):
    """원경 능선 실루엣(평평한 몸색 + 왼쪽 사면 밝은 테 + 오른쪽 사면 그늘 면). cols = [윤곽, 그늘, 몸, 밝음].
    peaks = [(x, 높이, 반폭)] 뾰족 산. 반환: 각 x 의 윗선 y."""
    xs = np.arange(W)
    top = ybase - amp * (0.6 * n1(xs, sc, seed) + 0.4 * n1(xs, sc2, seed + 7))
    if peaks:
        for px, ph, hw in peaks:
            d = np.abs(xs - px) / float(hw)
            top = np.minimum(top, ybase - ph * np.clip(1 - d, 0, 1) ** 1.15 - (h2(xs // 3, 3, seed) - 0.5) * 2 * (d < 1))
    top = np.rint(top).astype(int)
    yb = H if y_floor is None else y_floor
    a = np.array(img)
    for x in range(max(0, x0), min(W, x1)):
        t = top[x]
        if t >= yb: continue
        a[t:yb, x, :3] = hx(cols[2])
        l = top[max(0, x - 2)]
        if lit and l > t + 1:                       # 왼쪽 사면 = 밝은 테 2~3px
            a[t:min(yb, t + 2 + int(h2(x, 4, seed) * 2)), x, :3] = hx(cols[3])
        a[t, x, :3] = hx(cols[3] if lit else cols[0])
    # 뾰족 산의 그늘 면: 봉우리에서 오른쪽 아래로 내려가는 등줄기(spine) 오른쪽이 그늘. 등줄기는 1px 씩 흔들린다.
    if lit and peaks:
        for px, ph, hw in peaks:
            pt = int(top[int(np.clip(px, 0, W - 1))])
            for y in range(pt, yb):
                sx = px + (y - pt) * 0.42 + (h2(y // 3, 7, seed + px) - 0.5) * 3
                for x in range(int(sx) + 1, min(W, int(px + hw))):
                    if y > top[x] and tuple(a[y, x, :3]) in (hx(cols[2]), hx(cols[3])):
                        a[y, x, :3] = hx(cols[1])
    if tex > 0:                                     # 잔 점(풀·바위 결) — 몸색 위 그늘 점
        for x in range(max(0, x0), min(W, x1)):
            t = top[x]
            for k in range(3):
                if h2(x, 20 + k, seed) < tex:
                    yy = t + 3 + int(h2(x, 30 + k, seed) * max(1, (yb - t - 4)))
                    if t < yy < yb and tuple(a[yy, x, :3]) == hx(cols[2]): a[yy, x, :3] = hx(cols[1])
    img.paste(Image.fromarray(a, 'RGBA'))
    return top


def shadow_of(img, sprite, x, y, k=(0.52, 0.58, 0.74), ymin=0):
    """버들항 그림자: 물체 알파를 (+6,+3) 옮겨 곱하기(바닥 위에만)."""
    al = np.array(sprite)[:, :, 3] > 128
    a = np.array(img).astype(np.float64)
    hh, ww = al.shape
    for j in range(hh):
        Y = y + 3 + j
        if Y < max(0, ymin) or Y >= H: continue
        row = al[j]
        xs = np.where(row)[0] + x + 6
        xs = xs[(xs >= 0) & (xs < W)]
        a[Y, xs, :3] = np.floor(a[Y, xs, :3] * np.array(k))
    img.paste(Image.fromarray(a.astype(np.uint8), 'RGBA'))


def place(img, sprite, x, ybot, shadow=None, ymin_shadow=HORIZON, flip=False):
    """밑변 왼쪽 (x, ybot) 에 붙인다. 화면 밖은 잘라 붙인다."""
    if flip: sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
    y = ybot - sprite.height
    if shadow is None: shadow = sprite.height >= 40
    if shadow: shadow_of(img, sprite, x, y, ymin=ymin_shadow)
    cx0, cy0 = max(0, -x), max(0, -y)
    sp = sprite.crop((cx0, cy0, sprite.width, sprite.height))
    img.alpha_composite(sp, (max(0, x), max(0, y)))
    return (x, y, x + sprite.width, ybot)


def load_part(slug, name):
    return Image.open(os.path.join(VROOT, slug, 'parts', name + '.png')).convert('RGBA')


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def finish(img, maxc=96):
    """불투명 RGB 로, 색 수 ≤ maxc. 넘으면 디더 없이 줄인다: 중앙 자르기로 무리를 나눈 뒤 무리마다 원래 색 중 가장 많이 쓰인 색 하나만
    남긴다(새 색을 만들지 않는다 — 팔레트 색 그대로), 나머지 색은 가장 가까운 남은 색으로."""
    rgb = img.convert('RGB')
    a = np.array(rgb)
    flat = a.reshape(-1, 3)
    cols, inv, cnt = np.unique(flat, axis=0, return_inverse=True, return_counts=True)
    inv = inv.reshape(-1)
    if os.environ.get('BG_DEBUG'): print('colors before finish', len(cols))
    if len(cols) > maxc:
        q = rgb.quantize(colors=maxc, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        lab = np.array(q).reshape(-1)
        keep = []
        for k in np.unique(lab):
            idx = np.unique(inv[lab == k], return_counts=True)
            keep.append(idx[0][np.argmax(idx[1])])
        kc = cols[np.array(keep)].astype(np.int64)
        c64 = cols.astype(np.int64)
        d = ((c64[:, None, :] - kc[None]) ** 2 * np.array([3, 4, 2])).sum(-1)
        cols = kc[np.argmin(d, 1)]
        a = cols[inv].reshape(a.shape)
    return Image.fromarray(a.astype(np.uint8), 'RGB')


def ncolors(img):
    a = np.array(img.convert('RGB')).reshape(-1, 3)
    return len(np.unique(a, axis=0))


def obj_mask(objs, size=(W, H)):
    """장면 물체 목록 (sorty, x, y, im, shadow) → 물체가 칠한 화소 마스크."""
    m = np.zeros((size[1], size[0]), bool)
    for o in objs:
        x, y, im = o[1], o[2], o[3]
        a = np.array(im)[:, :, 3] > 0
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(size[0], x + im.width), min(size[1], y + im.height)
        if x1 > x0 and y1 > y0: m[y0:y1, x0:x1] |= a[y0 - y:y1 - y, x0 - x:x1 - x]
    return m


def horizon_line(seed=1, base=HORIZON, amp=4, sc=40):
    xs = np.arange(W)
    return np.rint(base + (n1(xs, sc, seed) - 0.5) * 2 * amp + (n1(xs, 9, seed + 3) - 0.5) * 2).astype(int)


def compose(back, scene_img, objs, hz, rim=None, tufts=None, seed=1):
    """back(원경) 위에 장면 렌더를 깐다: 지평선 hz[x] 아래는 장면 전부, 위는 물체 화소만.
    rim = 지평선 1px 테 색, tufts = 지평선 위로 솟는 풀 잔털 색 목록."""
    S = np.array(scene_img.convert('RGBA'))[:H, :W]
    B = np.array(back.convert('RGBA'))
    Y = np.arange(H)[:, None]
    below = Y >= hz[None, :]
    out = np.where(below[..., None], S, B)
    if rim is not None:
        xs = np.arange(W)
        out[hz, xs, :3] = hx(rim) if isinstance(rim, str) else rim
    if tufts:
        xs = np.arange(W)
        for x in xs:
            r = h2(x, 11, seed)
            if r < 0.35:
                L = 1 + int(h2(x, 12, seed) * 3)
                c = tufts[int(h2(x, 13, seed) * len(tufts)) % len(tufts)]
                for k in range(L):
                    yy = hz[x] - 1 - k
                    if yy >= 0: out[yy, x, :3] = hx(c) if isinstance(c, str) else c
    m = obj_mask(objs) & ~below
    out[m] = S[m]
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def auto_layer(sheet, mask, edge_on=True):
    """16변형 오토타일 시트(64x64) + 칸 마스크 → 덧그림 층. 화면 가장자리 밖은 이웃이 있는 것으로 본다(edge_on)."""
    ch, cw = len(mask), len(mask[0])
    def on(x, y):
        if not (0 <= x < cw and 0 <= y < ch): return edge_on
        return bool(mask[y][x])
    lay = Image.new('RGBA', (cw * 16, ch * 16))
    for y in range(ch):
        for x in range(cw):
            if mask[y][x]:
                n = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
                lay.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
    return lay


def shade(im, k=(0.52, 0.58, 0.74), times=1):
    """버들항 그림자 곱하기를 물체 전체에 — 그늘 속 먼 줄."""
    a = np.array(im.convert('RGBA')).astype(np.float64)
    for _ in range(times): a[..., :3] = np.floor(a[..., :3] * np.array(k))
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def blob_mask(cw, ch, cx, cy, rx, ry, seed, jag=0.25):
    """칸 단위 타원 덩이(가장자리 흔들림)."""
    return [[((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + jag * (h2(x, y, seed) - 0.5) * 2 for x in range(cw)] for y in range(ch)]


def blit(dst, im, x, y):
    """화면 밖으로 나간 부분은 잘라 붙인다."""
    x0, y0 = max(0, -x), max(0, -y)
    x1, y1 = min(im.width, dst.width - x), min(im.height, dst.height - y)
    if x1 <= x0 or y1 <= y0: return
    dst.alpha_composite(im.crop((x0, y0, x1, y1)), (x + x0, y + y0))
