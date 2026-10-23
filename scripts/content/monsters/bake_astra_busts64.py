"""아스트라 호라이즌 대사 흉상 2판(2026-10-23 사용자 「NPC 포트레잇 징그럽다」) — 64x64 원래 격자, 화면 2배(128x128).
  python3 scripts/content/monsters/bake_astra_busts64.py <raw 폴더>
- 원본: char-gen 이미지 엔진(command → 비공개 codex 이미지 경로)에 「실제 저해상 도트 초상(48x48 격자로 그려라)」 브리프로 그리게 한 그림.
  후보는 인물마다 4장을 눈가림 판정단(Opus 3 + Argon 1)이 순위를 매겨 다수결로 골랐다(감독 위임). raw 폴더: <base>.png, <base>-<표정>-t<n>.png (어느 시도를 쓰는지는 TRY).
- 왜 64x64 인가: 1판 44x46 은 눈이 2~3화소라 얼굴이 죽어 보였다(눈가림 진단 4명 공통 원인: 줄여 만든 반실사 얼굴·작은 눈·얼룩). 64x64 는
  전투 트레이너 그림과 같은 원래 격자라 같은 화소 크기로 선다(src/player/bustPixelate.ts BUST_LARGE_SIZE).
- 과정(다시 그리지 않는다): 그림 엔진이 그린 화소 격자를 찾아(가장자리 주기) 칸마다 안쪽 절반의 최빈색으로 원래 격자를 되살림 → 배경 제거 →
  머리 위 1화소 여백·가로는 머리 가운데로 64x64 를 자름(격자가 76 칸 넘으면 최빈 축소) → 표정은 고른 그림을 엔진이 고친 판에서 얼굴 상자 안의
  바뀐 화소만 옮김(머리·옷은 기본 그대로, 표정 바꿀 때 흔들리지 않음) → 인물마다 모든 표정이 같은 16색 팔레트.
- 출처·해시: public/assets/emerald-monster/cast/provenance-busts64.json."""
import hashlib, json, os, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/emerald-monster/cast'
N = 64
PICK = {'hero': 'hero-nat1', 'mom': 'mom-sml6', 'professor': 'professor-sml4', 'nurse': 'nurse-nat4',
        'naru': 'naru-nat3', 'yurim': 'yurim-nat8', 'muyeong': 'muyeong-sml8'}
EXPR = ['happy', 'sad', 'angry', 'surprised']
EXTRA = {'muyeong': ['serious']}
# 표정마다 쓸 편집본(raw 의 <base>-<이름>.png). 슬픔·화남은 1차 판정에서 약하다는 지적을 받아 강한 지시로 다시 뽑은 t2/t3 중 고른 것.
# 무영의 serious 는 엄한 표정 — 약한 화남 편집본(angry-t1)이 판정단 기준 base 와 가장 잘 구별된다.
TRY = {
    'hero': {'sad': 'sad-t3', 'angry': 'angry-t2'},
    'mom': {'sad': 'sad-t3', 'angry': 'angry-t3'},
    'professor': {'sad': 'sad-t2', 'angry': 'angry-t3'},
    'nurse': {'sad': 'sad-t3', 'angry': 'angry-t2'},
    'naru': {'sad': 'sad-t2', 'angry': 'angry-t2'},
    'yurim': {'sad': 'sad-t3', 'angry': 'angry-t2'},
    'muyeong': {'sad': 'sad-t3', 'angry': 'angry-t3', 'serious': 'angry-t1'},
}


def edit_name(cid, e):
    return TRY.get(cid, {}).get(e, f'{e}-t1')


def sha(im): return hashlib.sha256(np.array(im.convert('RGBA')).tobytes()).hexdigest()


def lab(c):
    c = np.asarray(c, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def key(im):
    """flat background (magenta or black) connected to the border -> transparent, with a 2 px fringe close to it."""
    a = np.array(im.convert('RGB')).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    d = np.sqrt(((a - np.median(border, 0)) ** 2).sum(-1))
    cand = (d < 60).astype(np.uint8)
    _, lab_ = cv2.connectedComponents(cand, connectivity=4)
    edge = set(np.unique(np.concatenate([lab_[0], lab_[-1], lab_[:, 0], lab_[:, -1]]))) - {0}
    bg = np.isin(lab_, list(edge)) & (cand > 0)
    bg |= (cv2.dilate(bg.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2) > 0) & ~bg & (d < 110)
    return Image.fromarray(np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')


def _period(sig, lo=8, hi=48):
    s = sig - sig.mean(); ac = np.correlate(s, s, 'full')[len(s) - 1:]; ac = ac / ac[0]
    best = max(range(lo, hi + 1), key=lambda p: ac[p] + 0.25 * ac[min(len(ac) - 1, 2 * p)])
    res = []
    for p in np.arange(best - 1.5, best + 1.51, 0.05):
        bv, bp = -1, 0
        for ph in np.arange(0, p, 0.5):
            v = sig[np.round(np.arange(ph, len(sig) - 1, p)).astype(int)].mean()
            if v > bv: bv, bp = v, ph
        res.append((bv, p, bp))
    v, p, ph = max(res)
    return p, ph


def grid(raw):
    a = np.array(raw.convert('RGB')).astype(float)
    out = []
    for axis in (1, 0):
        g = np.abs(np.diff(a, axis=axis)).sum(2); s = (g > 40).sum(1 - axis).astype(float)
        p, ph = _period(s)
        if p > 24:   # a doubled period: the half step also sits on edges
            on = s[np.round(np.arange(ph - 1, len(s) - 1, p)).astype(int)].mean()
            half = s[np.round(np.arange(ph + p / 2 - 1, len(s) - 1, p)).astype(int)].mean()
            if half > 0.45 * on: p = p / 2
        out.append((p, ph + 1))
    p = (out[0][0] + out[1][0]) / 2
    return (p, out[0][1]), (p, out[1][1])


def native(path):
    raw = Image.open(path); (px, phx), (py, phy) = grid(raw)
    a = np.array(key(raw)).astype(int)
    xs = np.arange(phx - px * np.floor(phx / px), a.shape[1] - 1, px); ys = np.arange(phy - py * np.floor(phy / py), a.shape[0] - 1, py)
    o = np.zeros((len(ys) - 1, len(xs) - 1, 4), np.uint8)
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]
            blk = a[int(y0 + (y1 - y0) * .25):int(np.ceil(y1 - (y1 - y0) * .25)), int(x0 + (x1 - x0) * .25):int(np.ceil(x1 - (x1 - x0) * .25))].reshape(-1, 4)
            if (blk[:, 3] > 128).mean() < 0.5: continue
            blk = blk[blk[:, 3] > 128][:, :3]
            _, inv, cnt = np.unique(blk // 16, axis=0, return_inverse=True, return_counts=True)
            o[j, i, :3] = np.median(blk[inv.ravel() == cnt.argmax()], 0); o[j, i, 3] = 255
    # leftover magenta specks
    r, g, b, al = (o[..., k].astype(int) for k in range(4))
    mg = (al > 128) & (r > 205) & (b > 190) & (g < 90)
    for y, x in zip(*np.where(mg)):
        nb = [tuple(o[yy, xx, :3]) for yy in range(y - 1, y + 2) for xx in range(x - 1, x + 2)
              if 0 <= yy < o.shape[0] and 0 <= xx < o.shape[1] and not mg[yy, xx] and o[yy, xx, 3] > 128]
        if len(nb) >= 5: o[y, x, :3] = max(set(nb), key=nb.count)
        else: o[y, x, 3] = 0
    return Image.fromarray(o)


def mode_resize(n, f):
    a = np.array(n).astype(int); h, w = a.shape[:2]; tw, th = round(w * f), round(h * f)
    o = np.zeros((th, tw, 4), np.uint8)
    for j in range(th):
        for i in range(tw):
            blk = a[int(j / f):max(int(j / f) + 1, int(np.ceil((j + 1) / f - 1e-6))), int(i / f):max(int(i / f) + 1, int(np.ceil((i + 1) / f - 1e-6)))].reshape(-1, 4)
            opq = blk[blk[:, 3] > 128]
            if len(opq) * 2 < len(blk): continue
            cols, cnt = np.unique(opq[:, :3], axis=0, return_counts=True)
            dk = np.where(((cols @ np.array([.299, .587, .114])) < 70) & (cnt * 2 >= len(opq)))[0]
            o[j, i, :3] = cols[dk[cnt[dk].argmax()] if len(dk) else cnt.argmax()]; o[j, i, 3] = 255
    return Image.fromarray(o)


def place(n, f=None, fixed=None):
    a = np.array(n); op = a[..., 3] > 128; ys, _ = np.where(op); top, bot = ys.min(), ys.max()
    if f is None: f = (1.0 if n.size[0] <= 76 else 65.0 / n.size[0]) if n.size[0] >= 56 else min(1.25, 60 / (bot - top + 1))
    m = mode_resize(n, f) if f < 0.999 else n
    a = np.array(m); op = a[..., 3] > 128; ys, _ = np.where(op); top = ys.min()
    band = op[top: top + max(1, int((ys.max() - top) * .45))]; cols = np.where(band.any(0))[0]
    x0 = int(round((cols.min() + cols.max() + 1) / 2 - N / 2)); y0 = int(min(top - 1, ys.max() - (N - 1)))
    if fixed: x0, y0 = fixed
    big = Image.new('RGBA', (m.width + 400, m.height + 400)); big.alpha_composite(m, (200, 200))
    return big.crop((x0 + 200, y0 + 200, x0 + 200 + N, y0 + 200 + N)), dict(f=f, x0=x0, y0=y0)


def face_only(base_n, edit_n):
    """align the edited picture to the base (shift search) and take only the changed pixels inside the face box."""
    from scipy.ndimage import binary_dilation
    b = np.array(base_n).astype(int); e = np.array(edit_n).astype(int); H, W = b.shape[:2]
    if abs(e.shape[0] - H) > 3: raise SystemExit(f'expression grid {e.shape[:2]} differs from the base {b.shape[:2]}')
    best = None
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            sh = np.zeros_like(b)
            ys0, ys1, xs0, xs1 = max(0, dy), min(H, e.shape[0] + dy), max(0, dx), min(W, e.shape[1] + dx)
            sh[ys0:ys1, xs0:xs1] = e[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
            d = (np.abs(sh[..., :3] - b[..., :3]).sum(-1) > 60) | ((sh[..., 3] > 128) != (b[..., 3] > 128))
            if best is None or d.mean() < best[0]: best = (d.mean(), sh)
    sh = best[1]
    diff = (np.abs(sh[..., :3] - b[..., :3]).sum(-1) > 60) & (sh[..., 3] > 128) & (b[..., 3] > 128)
    lu = lambda a: a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
    diff &= ~((lu(b) < 95) & (lu(sh) < 95))   # line colour drift (glasses frame, outline) keeps the base colour
    box = np.zeros_like(diff); box[int(H * .30):int(H * .80), int(W * .22):int(W * .78)] = True
    m = binary_dilation(diff & box, iterations=1) & box
    o = b.copy(); o[m] = sh[m]
    return Image.fromarray(o.astype(np.uint8))


def shared_palette(ims, n=16):
    from sklearn.cluster import KMeans
    px = np.concatenate([np.array(i)[np.array(i)[..., 3] > 128][:, :3] for i in ims]).astype(int)
    cols, cnt = np.unique(px, axis=0, return_counts=True)
    if len(cols) <= n: return ims
    km = KMeans(n_clusters=n, n_init=8, random_state=0).fit(lab(cols), sample_weight=np.sqrt(cnt))
    cen = np.array([np.average(cols[km.labels_ == k], axis=0, weights=cnt[km.labels_ == k]) for k in range(n)]).astype(int)
    lut = {tuple(c): cen[l] for c, l in zip(cols, km.labels_)}
    out = []
    for im in ims:
        a = np.array(im).astype(int)
        for y, x in zip(*np.where(a[..., 3] > 128)): a[y, x, :3] = lut[tuple(a[y, x, :3])]
        out.append(Image.fromarray(a.astype(np.uint8)))
    return out


def main(raw_dir):
    raw_dir = Path(raw_dir); prov = {'source': 'char-gen image engine (command -> private codex image route, gpt-image), low-res pixel-art portrait brief; candidates ranked by a blind panel (3 Opus + 1 Argon), majority pick under the user\'s delegation', 'size': [N, N], 'shownAt': '2x (128x128)', 'cast': {}}
    for cid, base in PICK.items():
        bn = native(raw_dir / f'{base}.png'); b64, info = place(bn)
        names, ims = ['base'], [b64]
        for e in EXPR + EXTRA.get(cid, []):
            en = native(raw_dir / f'{base}-{edit_name(cid, e)}.png')
            names.append(e); ims.append(place(face_only(bn, en), info['f'], fixed=(info['x0'], info['y0']))[0])
        ims = shared_palette(ims)
        (OUT / cid).mkdir(parents=True, exist_ok=True)
        pics = {}
        for nm, im in zip(names, ims):
            im.save(OUT / cid / f'bust-{nm}.png', optimize=True)
            src = raw_dir / (f'{base}.png' if nm == 'base' else f'{base}-{edit_name(cid, nm)}.png')
            pics[f'bust-{nm}.png'] = {'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(), 'pixelSha256': sha(im)}
        prov['cast'][cid] = {'base': base, 'nativeGrid': list(bn.size), 'place': {k: float(v) for k, v in info.items()}, 'pictures': pics}
        print(cid, base, bn.size, info)
    (OUT / 'provenance-busts64.json').write_text(json.dumps(prov, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/astra-qa/castg2/raw'))
