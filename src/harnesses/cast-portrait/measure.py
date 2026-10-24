"""Measurements for cast portraits. Pure functions over one RGBA image; no generation, no resizing."""
import numpy as np
from PIL import Image

LUM = np.array([.299, .587, .114])


def arr(im):
    return np.array(im.convert('RGBA')).astype(int)


def opaque(a):
    return a[..., 3] >= 128


def colours(a):
    op = opaque(a)
    return len({tuple(p) for p in a[op][:, :3]})


def partial_alpha(a):
    """pixels that are neither fully transparent nor fully opaque (a clean bust has none)."""
    return int(((a[..., 3] > 0) & (a[..., 3] < 255)).sum())


def edge_mask(op):
    pad = np.pad(op, 1)
    inner = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    return op & ~inner


def outline_dark_ratio(a, cut=90):
    """share of silhouette edge pixels drawn dark (the cast's coloured outline: darkest shade of the adjacent region).
    Edges on the bottom row are the cut, not an outline, so they do not count."""
    op = opaque(a); e = edge_mask(op); e[-1, :] = False
    lum = a[..., :3] @ LUM
    return float(((lum < cut) & e).sum() / max(1, e.sum()))


def frame(a):
    op = opaque(a); ys, xs = np.where(op)
    h, w = op.shape
    top = int(ys.min())
    bottom_cover = float(op[-1].mean())          # shoulders run off the bottom edge
    side_touch = bool(op[:, 0].any() or op[:, -1].any())
    band = op[top: top + max(1, int((h - 1 - top) * .45))]
    cols = np.where(band.any(0))[0]
    head_w = int(cols.max() - cols.min() + 1)
    head_side = bool(band[:, 0].any() or band[:, -1].any())
    head_cx = float((cols.max() + cols.min() + 1) / 2)
    return dict(top=top, bottomCover=round(bottom_cover, 3), sideTouch=side_touch, headTouchesSide=head_side, headWidth=head_w,
                headCentreOffset=round(head_cx - w / 2, 1), fill=round(float(op.mean()), 3))


def eyes(a):
    """the two open eyes: features inside the skin span of each face row (rows 30-66% of the height) that hold both a
    near-white pixel (eye white / highlight) and a dark pixel (lash / pupil). Returns ((w, h, top, bottom) left, right) or None."""
    from scipy import ndimage
    h, w = a.shape[:2]
    op = opaque(a); lum = a[..., :3] @ LUM
    cen = a[int(h * .45):int(h * .62), int(w * .40):int(w * .60)]
    cols, cnt = np.unique(cen[cen[..., 3] >= 128][:, :3], axis=0, return_counts=True)
    if not len(cols): return None
    skin_c = cols[cnt.argmax()]
    skin = op & (np.sqrt(((a[..., :3] - skin_c) ** 2).sum(-1)) < 45)
    feat = np.zeros_like(skin)
    for y in range(int(h * .30), int(h * .66)):
        xs = np.where(skin[y])[0]
        if len(xs) < 2: continue
        feat[y, xs.min() + 1:xs.max()] = ~skin[y, xs.min() + 1:xs.max()]
    lab, n = ndimage.label(feat)
    comps = []
    for i in range(1, n + 1):
        m = lab == i; ys, xs = np.where(m)
        if len(ys) < 4 or not (lum[m] > 200).any() or not (lum[m] < 90).any(): continue
        comps.append((len(ys), int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())))
    L = [c for c in comps if (c[1] + c[2]) / 2 < w / 2]; R = [c for c in comps if (c[1] + c[2]) / 2 >= w / 2]
    if not L or not R: return None
    l, r = max(L), max(R)
    def hist(c):
        blk = a[c[3]:c[4] + 1, c[1]:c[2] + 1]; m = blk[..., 3] >= 128
        cols, cnt = np.unique(blk[m][:, :3], axis=0, return_counts=True)
        return {'#%02x%02x%02x' % tuple(k): int(n) for k, n in zip(cols, cnt)}
    return (l[2] - l[1] + 1, l[4] - l[3] + 1, l[3], l[4], hist(l)), (r[2] - r[1] + 1, r[4] - r[3] + 1, r[3], r[4], hist(r))


def eye_colour_gap(e):
    """pixels that differ between the two eyes' colour counts (iris 4 px wide on one side and 3 on the other shows up here)."""
    hl, hr = e[0][4], e[1][4]
    return sum(abs(hl.get(k, 0) - hr.get(k, 0)) for k in set(hl) | set(hr))


def eyes_symmetric(e, tol_w=2, tol_h=1, tol_y=1, tol_colour=2):
    if e is None: return None
    (lw, lh, lt, lb, _), (rw, rh, rt, rb, _) = e
    return (abs(lw - rw) <= tol_w and abs(lh - rh) <= tol_h and abs(lt - rt) <= tol_y and abs(lb - rb) <= tol_y
            and eye_colour_gap(e) <= tol_colour)


def eye_symmetry(a, box=(0.22, 0.30, 0.78, 0.62)):
    """mirror agreement of the dark/light features inside the upper face box, about the face's own centre column.
    1.0 = perfectly mirrored. Catches one-eye-bigger, a winking eye, glasses on one side, a smear on one cheek."""
    h, w = a.shape[:2]
    y0, y1, x0, x1 = int(h * box[1]), int(h * box[3]), int(w * box[0]), int(w * box[2])
    reg = a[y0:y1]
    op = opaque(reg)
    lum = reg[..., :3] @ LUM
    rows_op = op[:, x0:x1]
    cols = np.where(rows_op.any(0))[0] + x0
    # centre of the skin-ish area (opaque, mid luminance, warm): fall back to the box centre
    skin = op & (lum > 120) & (reg[..., 0] > reg[..., 2])
    sc = np.where(skin[:, x0:x1].any(0))[0] + x0
    cx = (sc.min() + sc.max() + 1) / 2 if len(sc) else (x0 + x1) / 2
    half = int(min(cx - x0, x1 - cx))
    l0 = int(round(cx - half)); r1 = int(round(cx + half))
    feat = op & ((lum < 90) | (lum > 225))
    left = feat[:, l0:int(round(cx))]
    right = feat[:, int(round(cx)):r1][:, ::-1]
    n = min(left.shape[1], right.shape[1])
    left, right = left[:, -n:], right[:, -n:]
    inter = (left & right).sum(); union = (left | right).sum()
    return round(float(inter / max(1, union)), 3)


def measure(im):
    a = arr(im)
    m = dict(size=list(im.size), colours=colours(a), partialAlpha=partial_alpha(a),
             cornersTransparent=bool(a[0, 0, 3] == 0 and a[0, -1, 3] == 0),
             outlineDark=round(outline_dark_ratio(a), 3), mirrorScore=eye_symmetry(a))
    e = eyes(a)
    m['eyes'] = [list(e[0][:4]), list(e[1][:4])] if e else None
    m['eyeColourGap'] = eye_colour_gap(e) if e else None
    m['eyesSymmetric'] = eyes_symmetric(e)
    m.update(frame(a))
    return m


def face_only_violation(base, other, box=(0.22, 0.30, 0.78, 0.80)):
    """pixels outside the face box that differ between the base and an expression (face-only edits leave them equal)."""
    b, o = arr(base), arr(other)
    if b.shape != o.shape: return -1
    h, w = b.shape[:2]
    diff = (np.abs(b - o).sum(-1) > 0)
    m = np.ones_like(diff); m[int(h * box[1]):int(h * box[3]), int(w * box[0]):int(w * box[2])] = False
    return int((diff & m).sum())
