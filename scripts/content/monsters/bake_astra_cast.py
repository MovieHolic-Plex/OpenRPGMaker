"""아스트라 호라이즌 등장인물 흉상·전신을 char-gen 결과에서 GBA 도트 그림으로 굽는다.
  python3 scripts/content/monsters/bake_astra_cast.py <cid>=<char-gen set JOB 폴더> ...
- 입력: `set finalize` 의 out/bust-<표정>.png · out/full-<표정>.png(고해상, GBA 대사 초상 화풍으로 그리게 한 그림).
- 흉상: 대사 상자 그림 칸의 원래 격자 44x46(화면에서 2배 = 88x92, 맵·64x64 전투 그림과 같은 화소 크기).
  1) 머리·어깨를 칸 비율로 자른다(가로 가운데 = 머리, 배율 1.3, 머리 위 12% 를 잘라 얼굴을 키운다).
  2) 4배 크기(176x184)로 상자 축소 뒤 mean-shift 로 부드러운 명암을 평평한 셀 면으로 합친다(윤곽은 남는다).
  3) 그 인물 모든 표정에서 k-means(Lab) 13색(머리카락은 3톤으로 줄이고 머리·피부 경계에 어두운 선) + 눈동자·입속·흰색 = 최대 16색. 칩 색에 가까운 색은 칩 색으로 붙인다.
  4) 4x4 칸마다 팔레트 다수결(흐린 평균 축소가 아니다), 어두운 선이 25% 이상이면 선이 이긴다. 외톨이 화소는 이웃 색으로.
  5) 실루엣 가장자리는 같은 색 계열의 가장 어두운 색(선택적 윤곽).
  6) 눈·눈썹·입 손질: astra_cast_cleanup.json 의 얼굴 좌표(고해상 원본에서 읽음)에 표정별 작은 도장(EYES·MOUTHS·BROWS)을 찍는다 —
     44x46 에서는 눈·입이 한두 칸 흙탕이 되므로 손으로 다시 찍는다. 흉상은 기본 그림 한 장에서 줄이고 표정마다 얼굴 도장만 바꾼다(머리·옷이 표정마다 흔들리지 않게). 표정 그림은 전신에 쓴다.
- 전신: 키 84 격자(같은 방법), 전신 카드(card-base.png) = 대사 상자 두 겹 테두리 + 전신 2배.
- 다시 그리지 않는다(자르기·색 고정·다수결·윤곽·눈/입 몇 화소 손질만). 표정은 KEEP 에 적은 것만 — src/assets/astraCast.ts 와 같아야 한다.
- 출처: public/assets/emerald-monster/cast/provenance.json (원본·결과 화소 해시, 손질 목록)."""
import hashlib, json, os, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/emerald-monster/cast'
EXPR = ['base', 'happy', 'sad', 'angry', 'surprised']
KEEP = {cid: EXPR for cid in ('hero', 'mom', 'professor', 'naru', 'nurse', 'yurim')}
KEEP['muyeong'] = EXPR + ['serious']  # 옛 저장본이 muyeong_bust_serious 를 가리킨다 — 빼면 그 프로젝트가 안 열린다
BUST = (44, 46)
FULL_H = 84   # 전신 원래 격자(카드에서 2배 = 168, 맵·흉상과 같은 화소 크기)
COLOURS = 16
SHIFT_SP, SHIFT_SR = 6, 28
ZOOM_DEFAULT, TOP_DEFAULT = 1.3, 0.12   # 얼굴을 키운다(머리카락 덩어리 위쪽을 조금 잘라 낸다) — 눈이 4칸 넘게 서게
ZOOM = {}
TOP = {}
CLEANUP_FILE = Path(__file__).with_name('astra_cast_cleanup.json')


def sha(im): return hashlib.sha256(np.array(im.convert('RGBA')).tobytes()).hexdigest()


def _lab(c):
    c = np.asarray(c, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def palette(px, chip_cols, n=COLOURS, reserve_de=22):
    """<= n colours from opaque pixels px (N,3): chip key colours present in the picture first (median of the real pixels near
    them), then farthest-point growth in Lab weighted by sqrt(cluster size)."""
    px = px.astype(int); L = _lab(px)
    res = []
    for hx in chip_cols:
        k = np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)])
        m = np.linalg.norm(L - _lab(k), axis=1) < reserve_de
        if m.sum() >= 40 and len(res) < n - 5:
            med = np.median(px[m], axis=0).astype(int)
            if all(np.linalg.norm(_lab(med) - _lab(r)) > 9 for r in res):
                res.append(med)
    pal = list(res)
    cols, cnt = np.unique((px // 8) * 8 + 4, axis=0, return_counts=True)
    Lc = _lab(cols)
    while len(pal) < n:
        Lp = _lab(np.array(pal)) if pal else None
        dist = np.min(np.linalg.norm(Lc[:, None] - Lp[None], axis=2), axis=1) if pal else np.full(len(cols), 1e3)
        i = (dist * np.sqrt(cnt)).argmax()
        if dist[i] < 7: break
        near = np.linalg.norm(Lc - Lc[i], axis=1) < 9
        pal.append(np.average(cols[near], axis=0, weights=cnt[near]).astype(int))
    return np.array(pal)


def nearest(img_rgb, pal):
    Lp = _lab(pal)
    flat = _lab(img_rgb.reshape(-1, 3))
    idx = np.empty(len(flat), int)
    for s in range(0, len(flat), 200000):
        idx[s:s + 200000] = np.linalg.norm(flat[s:s + 200000, None] - Lp[None], axis=2).argmin(1)
    return idx.reshape(img_rgb.shape[:2])


def prefilter(im, size):
    """box to 4x the target, then mean-shift flattening (merges soft shading into flat cel areas, keeps edges)."""
    import cv2
    W, H = size
    a = np.array(im.resize((W * 4, H * 4), Image.BOX))
    rgb = np.ascontiguousarray(a[..., :3])
    flat = cv2.pyrMeanShiftFiltering(rgb, SHIFT_SP, SHIFT_SR)
    a = a.copy(); a[..., :3] = flat
    return a


def kpalette(px, keys, n=COLOURS, snap=12):
    """k-means in Lab over opaque (already flattened) pixels -> n colours; a centre near a chip key colour snaps to it
    (identity colours stay exact); the darkest centre is pushed to a line colour."""
    from sklearn.cluster import KMeans
    L = _lab(px.astype(int))
    km = KMeans(n_clusters=n, n_init=4, random_state=0).fit(L)
    pal = []
    for k in range(n):
        m = km.labels_ == k
        pal.append(np.median(px[m], axis=0).astype(int))
    pal = np.array(pal)
    kk = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in keys]) if keys else np.zeros((0, 3), int)
    if len(kk):
        for i in range(n):
            d = np.linalg.norm(_lab(kk) - _lab(pal[i]), axis=1)
            if d.min() < snap: pal[i] = kk[d.argmin()]
    lu = np.array([lum(p) for p in pal]); j = lu.argmin()
    if lu[j] > 45: pal[j] = (pal[j] * 0.45).astype(int)
    return pal


def reduce(im, size, pal, dark_share=0.16):
    """im RGBA (already cropped to the target aspect) -> (size) index grid by majority vote; -1 = transparent.
    The source is first brought to 4x the target with a box filter (merges fine strands into their lock), then each 4x4 cell
    votes among palette colours."""
    W, H = size
    a = prefilter(im, size)
    idx = nearest(a[..., :3], pal)
    op = a[..., 3] >= 128
    dark = {i for i, p in enumerate(pal) if lum(p) < 60}
    out = np.full((H, W), -1, int)
    h, w = op.shape
    for y in range(H):
        y0, y1 = int(y * h / H), max(int(y * h / H) + 1, int((y + 1) * h / H))
        for x in range(W):
            x0, x1 = int(x * w / W), max(int(x * w / W) + 1, int((x + 1) * w / W))
            o = op[y0:y1, x0:x1]
            if o.mean() < 0.5: continue
            v = idx[y0:y1, x0:x1][o]
            cnt = np.bincount(v, minlength=len(pal))
            d = [i for i in dark if cnt[i] >= dark_share * len(v)]
            out[y, x] = max(d, key=lambda i: cnt[i]) if d else cnt.argmax()
    return out


def smooth(g, pal, keep=None, passes=2):
    """flat cel areas: a pixel whose colour no 4-neighbour shares takes the colour most of its 8 neighbours have.
    Dark line pixels and `keep` (bool mask, e.g. eyes/mouth) are left alone."""
    H, W = g.shape
    dark = np.array([lum(p) < 60 for p in pal])
    for _ in range(passes):
        out = g.copy()
        for y in range(H):
            for x in range(W):
                v = g[y, x]
                if v < 0 or dark[v] or (keep is not None and keep[y, x]): continue
                n8 = [g[yy, xx] for yy in (y-1, y, y+1) for xx in (x-1, x, x+1) if (yy, xx) != (y, x) and 0 <= yy < H and 0 <= xx < W and g[yy, xx] >= 0]
                if n8.count(v) <= 1 and n8:
                    best = max(set(n8), key=n8.count)
                    if n8.count(best) >= 3: out[y, x] = best
        g = out
    return g


def lone_pixels(g):
    """a pixel whose 8 neighbours are (almost) all one other colour takes that colour - specks and dots inside flat areas."""
    H, W = g.shape
    out = g.copy()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            v = g[y, x]
            if v < 0: continue
            n8 = [g[yy, xx] for yy in (y - 1, y, y + 1) for xx in (x - 1, x, x + 1) if (yy, xx) != (y, x)]
            if v in n8: continue
            best = max(set(n8), key=n8.count)
            if best >= 0 and n8.count(best) >= 6: out[y, x] = best
    return out


def despeckle(g):
    """lone transparent holes inside the figure filled, lone opaque specks outside removed."""
    A = g >= 0
    pad = np.pad(A, 1).astype(int)
    nb = sum(np.roll(np.roll(pad, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1))[1:-1, 1:-1] - A
    g = g.copy(); g[A & (nb <= 1)] = -1
    return g


def outline(g, pal):
    """selective outline: silhouette edge pixels -> the darkest palette colour of their own hue family, unless already dark."""
    def hue(c):
        c = np.array(c, float) / 255; mx, mn = c.max(), c.min()
        if mx - mn < 1e-6: return -1
        r, gg, b = c
        hh = ((gg - b) / (mx - mn)) % 6 if mx == r else ((b - r) / (mx - mn) + 2 if mx == gg else (r - gg) / (mx - mn) + 4)
        return hh * 60
    pl = [lum(p) for p in pal]
    dark = [i for i, p in enumerate(pal) if pl[i] < 70] or [int(np.argmin(pl))]
    A = g >= 0
    pad = np.pad(A, 1)
    edge = A & ~(pad[2:, 1:-1] & pad[:-2, 1:-1] & pad[1:-1, 2:] & pad[1:-1, :-2])
    out = g.copy()
    for y, x in zip(*np.where(edge)):
        c = pal[g[y, x]]
        if lum(c) < 75: continue
        h = hue(c)
        out[y, x] = min(dark, key=lambda i: (min(abs(hue(pal[i]) - h), 360 - abs(hue(pal[i]) - h)) if h >= 0 and hue(pal[i]) >= 0 else 90) + pl[i] * .3)
    return out


def to_image(g, pal):
    H, W = g.shape
    out = np.zeros((H, W, 4), np.uint8)
    m = g >= 0
    out[m, :3] = pal[g[m]]; out[m, 3] = 255
    return Image.fromarray(out, 'RGBA')


def crop_box(im, zoom, top=0.0):
    """crop window of the bust picture: (x0, y0, cw, ch) in picture pixels. zoom = picture width / window width;
    top = share of the window height skipped above the head top (crops the hair mass so the face gets bigger)."""
    bx = im.getbbox() or (0, 0, im.width, im.height)
    w, h = bx[2] - bx[0], bx[3] - bx[1]
    iw, ih = BUST[0] - 2, BUST[1] - 1
    cw = w / zoom; ch = cw * ih / iw
    if ch > h: ch = h; cw = ch * iw / ih
    a = np.array(im.crop(bx))[: int(h * 0.45), :, 3] >= 128
    cx = np.nonzero(a)[1].mean() if a.any() else w / 2
    x0 = min(max(cx - cw / 2, 0), w - cw)
    y0 = min(top * ch, h - ch)
    return bx[0] + x0, bx[1] + y0, cw, ch


def crop_bust(im, zoom, top=0.0):
    x0, y0, cw, ch = crop_box(im, zoom, top)
    return im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch)))


def grid_to_src(gx, gy, box):
    x0, y0, cw, ch = box
    return x0 + (gx - 1) / (BUST[0] - 2) * cw, y0 + (gy - 1) / (BUST[1] - 1) * ch


def src_to_grid(sx, sy, box):
    x0, y0, cw, ch = box
    return 1 + (sx - x0) / cw * (BUST[0] - 2), 1 + (sy - y0) / ch * (BUST[1] - 1)


def move_landmarks(spec, read_box, box):
    """landmarks read on one crop of a picture -> the same face points on another crop of it (eye stamps keep their size)."""
    def mv(x, y):
        sx, sy = grid_to_src(x + 0.5, y + 0.5, read_box)
        gx, gy = src_to_grid(sx, sy, box)
        return int(np.floor(gx)), int(np.floor(gy))
    out = dict(spec)
    eyes = []
    for (x, y, w) in spec['eyes']:
        cx, cy = mv(x + (w - 1) / 2, y + 1)      # eye centre-ish, then back to the stamp's top-left
        eyes.append([int(round(cx - (w - 1) / 2)), cy - 1, w])
    out['eyes'] = eyes
    out['mouth'] = list(mv(*spec['mouth']))
    return out


def place(g, size):
    """index grid -> canvas `size`, bottom-centred (1 px margin left/right/top for the outline)."""
    W, H = size
    out = np.full((H, W), -1, int)
    h, w = g.shape
    x0 = (W - w) // 2
    out[H - h:, x0:x0 + w] = g
    return out


def apply_cleanup(g, pal, edits):
    """edits: [[x, y, colour]] with colour = palette index, '#rrggbb' (nearest palette entry) or null (transparent)."""
    for x, y, c in edits:
        if c is None: g[y, x] = -1
        elif isinstance(c, str):
            k = np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)])
            g[y, x] = int(np.linalg.norm(_lab(pal) - _lab(k), axis=1).argmin())
        else: g[y, x] = int(c)
    return g


# ---------------------------------------------------------------------------------------------- eyes and mouth (hand cleanup)
# At 44x46 the reduction keeps hair, face shape and clothes, but eyes and mouths dissolve into one or two muddy cells. They are
# redrawn by hand from small fixed GBA-style stamps at landmarks read off the hi-res picture (astra_cast_cleanup.json):
# eye = top-left of the lash row, width 3 (near eye) or 2 (far eye); mouth = centre. Letters: D line, K pupil, I iris,
# W white, T mouth inside, M lip line, . leave.
EYES = {
    'open':      ['DDD', 'IKW', 'IKI', 'III', '.I.'],
    'happy':     ['...', '.D.', 'DDD', 'D.D'],
    'sad':       ['.DD', 'IKW', 'IKI', 'III', '...'],
    'angry':     ['DDD', 'DDD', 'IKI', 'III', '...'],
    'surprised': ['DDD', 'WIW', 'WKW', 'WIW', '.W.'],
    'serious':   ['DDD', 'DDD', 'IKI', 'III', '...'],
}
MOUTHS = {  # (dx0, dy0) of the stamp's top-left relative to the mouth centre, rows
    'base':      (-1, 0, ['MMM']),
    'happy':     (-2, 0, ['DDDD', 'DTTD', '.DD.']),
    'sad':       (-2, 0, ['.MMM.', 'M...M']),
    'angry':     (-2, 0, ['DDDD', 'DWWD']),
    'surprised': (-1, -1, ['.DD.', 'DTTD', '.DD.'][0:3]),
    'serious':   (-2, 0, ['DDDD']),
}
MOUTHS['surprised'] = (-2, -1, ['.DD.', 'DTTD', '.DD.'])
BROWS = {  # rows above the lash row for the inner, middle, outer brow pixel (None = no brow stamp)
    'base': (2, 2, 2), 'happy': (3, 3, 3), 'sad': (3, 2, 1), 'angry': (1, 2, 3), 'surprised': (3, 3, 3), 'serious': (1, 1, 1),
}
EYES4 = {   # near eye when the face is big enough for a 4-wide eye
    'open':      ['DDDD', 'IKKW', 'IKKI', 'IIII', '.II.'],
    'happy':     ['....', '.DD.', 'DDDD', 'D..D', '....'],
    'sad':       ['.DDD', 'IKKW', 'IKKI', 'IIII', '....'],
    'angry':     ['DDDD', 'DDDD', 'IKKI', 'IIII', '....'],
    'surprised': ['DDDD', 'WIIW', 'IKKI', 'WIIW', '.WW.'],
    'serious':   ['DDDD', 'DDDD', 'IKKI', 'IIII', '....'],
}
SCLERA_EYES4 = {   # inside a dark mask: the eye hole shows the expression (slanted lids instead of brows); near eye, inner corner = right
    'open':      ['WIIW', 'WKKW', 'WIIW', '....'],
    'happy':     ['.WW.', 'W..W', '....', '....'],
    'sad':       ['..WW', '.WIW', 'WKKW', '....'],      # inner corner raised, lid falls toward the outer corner
    'angry':     ['WW..', 'WIW.', 'WKKW', '....'],      # inner corner pressed down
    'surprised': ['WWWW', 'WIIW', 'WKKW', 'WIIW'],
    'serious':   ['....', '....', 'WKKW', '....'],      # narrowed to a slit
}
SCLERA_EYES = {  # eyes inside a dark mask: white must show around the iris
    'open': ['WIW', 'WKW', 'WIW'], 'happy': ['.W.', 'W.W', '...'], 'sad': ['W..', 'WI.', 'WKW'], 'angry': ['..W', '.IW', 'WKW'],
    'surprised': ['WWW', 'WIW', 'WKW', 'WIW'], 'serious': ['...', '...', 'WKW'],
}
EYE_FOR = {'base': 'open', 'happy': 'happy', 'sad': 'sad', 'angry': 'angry', 'surprised': 'surprised', 'serious': 'serious'}


def _nearest_idx(pal, hx):
    k = np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)])
    return int(np.linalg.norm(_lab(pal) - _lab(k), axis=1).argmin())


def is_skin(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return r > 170 and g > 110 and b > 70 and r > b + 35 and r >= g


def hair_ids(pal, hair_hex, de=22):
    """palette entries that belong to the hair (near one of the chip's hair colours)."""
    if not hair_hex: return set()
    hk = _lab(np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in hair_hex]))
    L = _lab(pal)
    return {i for i in range(len(pal)) if np.linalg.norm(hk - L[i], axis=1).min() < de and lum(pal[i]) >= 40}


def flatten_hair(g, pal, hair, tones=3, passes=4):
    """hair as GBA cel areas: at most `tones` hair colours (the most used ones; the rest go to the nearest by lightness),
    then single-pixel strands and specks inside the hair melt into their neighbours."""
    if not hair: return g
    g = g.copy()
    used = [(int((g == i).sum()), i) for i in hair]
    keep = [i for n, i in sorted(used, reverse=True)[:tones] if n]
    if not keep: return g
    for i in hair:
        if i not in keep:
            g[g == i] = min(keep, key=lambda k: abs(lum(pal[k]) - lum(pal[i])))
    H, W = g.shape
    for _ in range(passes):
        out = g.copy()
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                v = g[y, x]
                if v not in keep: continue
                n8 = [g[yy, xx] for yy in (y - 1, y, y + 1) for xx in (x - 1, x, x + 1) if (yy, xx) != (y, x)]
                hn = [n for n in n8 if n in keep]
                if n8.count(v) <= 3 and len(hn) >= 6:
                    out[y, x] = max(set(hn), key=hn.count)
        g = out
    return g


def hair_line(g, pal, hair):
    """dark 1 px line where hair meets skin (bangs and side locks), like the trainer sprites' interior contour."""
    if not hair: return g
    dark = min(hair, key=lambda i: lum(pal[i]))
    if lum(pal[dark]) > 70:
        lu = np.array([lum(p) for p in pal]); dark = int(lu.argmin())
    skin = {i for i, p in enumerate(pal) if is_skin(p)}
    H, W = g.shape
    out = g.copy()
    for y in range(H):
        for x in range(W):
            if g[y, x] not in hair: continue
            for yy, xx in ((y + 1, x), (y, x - 1), (y, x + 1), (y - 1, x)):
                if 0 <= yy < H and 0 <= xx < W and g[yy, xx] in skin:
                    out[y, x] = dark; break
    return out


def stamp_face(g, pal, spec, expr, shift=(0, 0)):
    """redraws eyes, brows and mouth of one expression on index grid g (in place); returns the list of changed pixels."""
    H, W = g.shape
    dx, dy = shift
    lu = np.array([lum(p) for p in pal])
    col = {'D': int(lu.argmin()), 'K': int(lu.argmin()), 'W': int(lu.argmax()),
           'I': _nearest_idx(pal, spec['iris']), 'T': _nearest_idx(pal, spec.get('mouthInside', '#c8504a')),
           'M': _nearest_idx(pal, spec.get('lip', '#8a4a3a'))}
    skin_ids = [i for i, p in enumerate(pal) if is_skin(p)]
    (lx, ly, lw), (rx, ry, rw) = spec['eyes']
    mx, my = spec['mouth']
    lx, rx, mx = lx + dx, rx + dx, mx + dx
    ly, ry, my = ly + dy, ry + dy, my + dy
    changed = []
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H and g[y, x] != c:
            changed.append([int(x), int(y)]); g[y, x] = c
    # 1) clear old feature remnants: dark/iris cells mostly surrounded by skin -> the face's main skin tone
    x0, x1 = min(lx, rx) - 1, max(lx + lw, rx + rw) + 1
    y0, y1 = min(ly, ry) - 3, my + 3
    box = g[max(0, y0):y1, max(0, x0):x1]
    sk = [v for v in box.ravel() if v in skin_ids]
    base_skin = max(set(sk), key=sk.count) if sk else None
    if base_skin is not None:
        for y in range(max(1, y0), min(H - 1, y1)):
            for x in range(max(1, x0), min(W - 1, x1)):
                v = g[y, x]
                if v < 0 or v in skin_ids: continue
                n8 = [g[yy, xx] for yy in (y - 1, y, y + 1) for xx in (x - 1, x, x + 1) if (yy, xx) != (y, x)]
                if sum(n in skin_ids for n in n8) >= 4: put(x, y, base_skin)
    # 1b) the eye boxes themselves become clean skin (bangs and hair lines that fell over the eyes are pushed off them)
    if base_skin is not None and not spec.get('sclera'):
        for ex, ey, ew in ((lx, ly, lw), (rx, ry, rw)):
            for y in range(ey + 1, ey + (6 if ew == 4 else 5)):      # with a 1 px skin frame left, right and below
                for x in range(ex - 1, ex + ew + 1):
                    if 0 <= y < H and 0 <= x < W and g[y, x] >= 0: put(x, y, base_skin)
    # 2) glasses rims: sides and bottom only (the lash row is the top), plus the bridge
    if spec.get('glasses'):
        gc = _nearest_idx(pal, spec['glasses'])
        for ex, ey, ew in ((lx, ly, lw), (rx, ry, rw)):
            eh = 5 if ew == 4 else 4
            for y in range(ey, ey + eh):
                put(ex - 1, y, gc); put(ex + ew, y, gc)
            for x in range(ex, ex + ew):
                put(x, ey + eh, gc)
        for x in range(lx + lw + 1, rx - 1):
            put(x, ly + 1, gc)
    # 3) brows (only on skin, never over hair or a mask)
    if spec.get('brows', True):
        b_in, b_mid, b_out = BROWS[expr]
        for ex, ey, ew, inner_right in ((lx, ly, lw, True), (rx, ry, rw, False)):
            xs = list(range(ex, ex + ew))
            heights = {2: [b_out, b_in], 3: [b_out, b_mid, b_in], 4: [b_out, b_mid, b_mid, b_in]}[ew]
            if not inner_right: heights = heights[::-1]
            for x, hgt in zip(xs, heights):
                y = ey - hgt
                if 0 <= y < H and g[y, x] in skin_ids + ([base_skin] if base_skin is not None else []):
                    put(x, y, col['D'])
    # 4) eyes (the far eye uses the first two columns, mirrored so the highlight sits on the same side)
    rows = (SCLERA_EYES if spec.get('sclera') else EYES)[EYE_FOR[expr]]
    if expr not in ('happy',) and not spec.get('sclera'):   # thick upper lid: the lash runs one pixel past the outer corner
        lift = 1 if expr == 'sad' else 0
        put(lx - 1, ly + 1 + lift, col['D']); put(rx + rw, ry + 1 + lift, col['D'])
    rows4 = (SCLERA_EYES4 if spec.get('sclera') else EYES4)[EYE_FOR[expr]]
    for ex, ey, ew in ((lx, ly, lw), (rx, ry, rw)):
        for j, row in enumerate(rows4 if ew == 4 else rows):
            if ew == 4:
                for i, ch in enumerate(row):
                    if ch != '.': put(ex + i, ey + j, col[ch])
                    elif spec.get('sclera'): put(ex + i, ey + j, col['D'])
                    elif expr == 'happy' and base_skin is not None: put(ex + i, ey + j, base_skin)
                continue
            cells = row if ew == 3 else row[:2]
            for i, ch in enumerate(cells):
                if ch != '.': put(ex + i, ey + j, col[ch])
                elif spec.get('sclera'): put(ex + i, ey + j, col['D'])
                elif expr == 'happy' and base_skin is not None: put(ex + i, ey + j, base_skin)
    # 5) mouth
    ox, oy, rows = MOUTHS[expr]
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.': put(mx + ox + i, my + oy + j, col[ch])
    return changed


def source(job, kind, e):
    """finalized picture (out/<kind>-<e>.png); before finalize, the current expression attempt (for previews only)."""
    f = job / 'out' / f'{kind}-{e}.png'
    if f.exists() or os.environ.get('ASTRA_CAST_PREVIEW') != '1': return f
    cur = json.loads((job / 'expr' / e / 'current.json').read_text())['attempt']
    return job / 'expr' / e / cur / f'{kind}.png'


def bake_character(cid, job, cleanup):
    jj = json.loads((job / 'job.json').read_text())
    keys = [c for part in ('hair', 'top', 'bottom', 'shoes', 'skin') for c in jj.get('materials', {}).get(part, [])[:3]]
    spec = cleanup[cid]
    zoom, top = ZOOM.get(cid, ZOOM_DEFAULT), TOP.get(cid, TOP_DEFAULT)
    size = (BUST[0] - 2, BUST[1] - 1)
    srcs = {e: Image.open(source(job, 'bust', e)).convert('RGBA') for e in KEEP[cid]}
    crops = {e: crop_bust(im, zoom, top) for e, im in srcs.items()}
    read = spec.get('read', {'zoom': 1.15, 'top': 0.0})
    flat = {e: prefilter(c, size) for e, c in crops.items()}
    # one palette per character over all its busts: 13 k-means cel tones + iris, mouth inside, white (<= 16 colours)
    sample = np.concatenate([f[f[..., 3] >= 128][::5, :3] for f in flat.values()])
    pal = kpalette(sample, keys, n=COLOURS - 3)
    extra = [spec['iris'], spec.get('mouthInside', '#c8504a'), '#f8f8f0']
    for hx in extra:
        k = np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)])
        if np.linalg.norm(_lab(pal) - _lab(k), axis=1).min() > 8: pal = np.vstack([pal, k])
    nbase = COLOURS - 3          # the reserved iris / mouth / white entries are only used by the hand stamps
    hair = hair_ids(pal[:nbase], spec.get('hair', []))
    pics, log = {}, {}
    # the bust is reduced once from the base picture; every expression is that bust with its own face stamps, so hair and
    # clothes stay still when the face changes mid-dialogue (like the face-swap portraits of the era). The expression pictures
    # from char-gen give the full figures.
    b0 = KEEP[cid][0]
    base_grid = reduce(crops[b0], size, pal[:nbase])
    base_grid = flatten_hair(base_grid, pal, hair)
    base_grid = place(despeckle(lone_pixels(smooth(base_grid, pal))), BUST)
    base_grid = hair_line(outline(base_grid, pal), pal, hair)
    here = move_landmarks(spec, crop_box(srcs[b0], read['zoom'], read.get('top', 0.0)), crop_box(srcs[b0], zoom, top))
    for e in KEEP[cid]:
        g = base_grid.copy()
        changed = stamp_face(g, pal, here, e)
        g = apply_cleanup(g, pal, spec.get('edits', {}).get(e, []))
        log[e] = {'stampedPixels': len(changed)}
        pics[f'bust-{e}.png'] = (to_image(g, pal), source(job, 'bust', e))
        full = Image.open(source(job, 'full', e)).convert('RGBA'); full = full.crop(full.getbbox())
        fh = FULL_H - 2; fw = max(1, round(full.width * fh / full.height))
        fg = place(outline(despeckle(smooth(flatten_hair(reduce(full, (fw, fh), pal[:nbase]), pal, hair), pal)), pal), (fw + 2, FULL_H))
        pics[f'full-{e}.png'] = (to_image(fg, pal), source(job, 'full', e))
    return pics, pal, log


if __name__ == '__main__':
    cg = os.environ.get('CHARGEN_DIR', str(Path.home() / 'char-gen-public'))
    CHARGEN = os.environ.get('CHARGEN_COMMIT') or subprocess.run(['git', '-C', cg, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() or None
    cleanup = json.loads(CLEANUP_FILE.read_text()) if CLEANUP_FILE.exists() else {}
    prov_path = OUT / 'provenance.json'
    prov = json.loads(prov_path.read_text()) if prov_path.exists() else {}
    prov.setdefault('cast', {})
    for arg in sys.argv[1:]:
        cid, job = arg.split('=', 1); job = Path(job)
        dst = OUT / cid; dst.mkdir(parents=True, exist_ok=True)
        for old in dst.glob('*.png'): old.unlink()
        pics, pal, log = bake_character(cid, job, cleanup)
        rec = {'from': str(job / 'out'), 'charGen': CHARGEN, 'palette': ['#%02x%02x%02x' % tuple(p) for p in pal],
               'cleanup': cleanup.get(cid, {}), 'stamps': log, 'pictures': {}}
        for name, (im, srcf) in pics.items():
            im.save(dst / name, optimize=True)
            rec['pictures'][name] = {'size': list(im.size), 'sourceSha256': sha(Image.open(srcf)), 'pixelSha256': sha(im)}
        fb = Image.open(dst / 'full-base.png').convert('RGBA')
        fb2 = fb.resize((fb.width * 2, fb.height * 2), Image.NEAREST)
        card = Image.new('RGBA', (fb2.width + 24, fb2.height + 20), (0x48, 0x70, 0x68, 255))
        card.paste((0xa8, 0xc0, 0xa0, 255), (4, 4, card.width - 4, card.height - 4))
        card.paste((0xe8, 0xf0, 0xd8, 255), (8, 8, card.width - 8, card.height - 8))
        card.alpha_composite(fb2, ((card.width - fb2.width) // 2, card.height - 8 - fb2.height))
        card.save(dst / 'card-base.png', optimize=True)
        rec['pictures']['card-base.png'] = {'size': list(card.size), 'pixelSha256': sha(card)}
        prov['cast'][cid] = rec
        print(cid, 'colours', len(pal), 'card', card.size)
    prov_path.write_text(json.dumps(prov, ensure_ascii=False, indent=1) + '\n')
