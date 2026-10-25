"""line sheet (alpha or magenta bg) -> 3 stage cutouts + quick 64px preview (screening only; final art goes through the harness import)."""
import sys, glob, os, json
import numpy as np, scipy.ndimage as ndi
from PIL import Image, ImageFilter
RAW = os.path.expanduser('~/astra-starters-wip/s4/raw'); OUT = os.path.expanduser('~/astra-starters-wip/s4/out')

def fg_mask(im):
    a = np.asarray(im.convert('RGBA')).astype(int)
    alpha = a[..., 3]
    if (alpha < 128).mean() > 0.2:
        m = alpha >= 128
    else:
        d = np.sqrt((a[..., 0]-255)**2 + a[..., 1]**2 + (a[..., 2]-255)**2)
        m = d >= 130
    m = ndi.binary_erosion(m, iterations=2)
    # drop magenta-tinted fringe pixels
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m &= ~((r > 180) & (b > 180) & (g < 110))
    return m

def split(path):
    im = Image.open(path).convert('RGBA'); m = fg_mask(im)
    lab, n = ndi.label(m); sizes = ndi.sum(m, lab, range(1, n+1))
    cx = ndi.center_of_mass(m, lab, range(1, n+1))
    big = sorted(sorted(range(1, n+1), key=lambda i: -sizes[i-1])[:3], key=lambda i: cx[i-1][1])
    arr = np.asarray(im).copy(); parts = []
    owner = {i: min(big, key=lambda b: abs(cx[b-1][1]-cx[i-1][1])) for i in range(1, n+1) if sizes[i-1] >= 40}
    for b in big:
        keep = np.isin(lab, [i for i, o in owner.items() if o == b])
        a2 = arr.copy(); a2[..., 3] = np.where(keep, 255, 0)
        c = Image.fromarray(a2, 'RGBA'); parts.append(c.crop(c.getbbox()))
    return parts

def sprite64(c, box, canvas=64, colors=20):
    k = box / max(c.size); w, h = max(1, round(c.width*k)), max(1, round(c.height*k))
    s = c.resize((w, h), Image.BOX)
    al = s.split()[3].point(lambda v: 255 if v >= 128 else 0)
    q = s.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGBA'); q.putalpha(al)
    C = Image.new('RGBA', (canvas, canvas)); C.alpha_composite(q, ((canvas-w)//2, canvas-1-h)); return C

if __name__ == '__main__':
    meta = {}
    for p in sorted(glob.glob(f'{RAW}/*.png')):
        tag = os.path.basename(p)[:-4]; parts = split(p)
        hs = [c.height for c in parts]; top = max(max(c.size) for c in parts)
        meta[tag] = [c.size for c in parts]
        for st, c in enumerate(parts, 1):
            c.save(f'{OUT}/{tag}-s{st}-cut.png')
            # keep relative size within the line: stage 3 fills 56, smaller stages scale with it (min 38)
            box = max(38, round(56 * max(c.size) / top))
            sprite64(c, box).save(f'{OUT}/{tag}-s{st}-64.png')
    json.dump(meta, open(f'{OUT}/meta.json', 'w'))
    print(json.dumps(meta))
