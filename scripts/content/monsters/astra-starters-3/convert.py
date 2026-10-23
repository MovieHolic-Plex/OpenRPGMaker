"""raw lineup (magenta bg) -> per-creature cutouts, Option A 64px sprite, Option B 128px smooth."""
import sys, collections
from PIL import Image, ImageFilter
import numpy as np

def cutout(path):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    d = np.sqrt((a[...,0]-255)**2 + a[...,1]**2 + (a[...,2]-255)**2)
    near = d < 130
    bg = np.zeros((H, W), bool)
    q = collections.deque()
    for x in range(W):
        for y in (0, H-1):
            if near[y,x] and not bg[y,x]: bg[y,x]=True; q.append((y,x))
    for y in range(H):
        for x in (0, W-1):
            if near[y,x] and not bg[y,x]: bg[y,x]=True; q.append((y,x))
    while q:
        y,x = q.popleft()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny,nx=y+dy,x+dx
            if 0<=ny<H and 0<=nx<W and near[ny,nx] and not bg[ny,nx]: bg[ny,nx]=True; q.append((ny,nx))
    mask = Image.fromarray((~bg*255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))  # erode 2px: drop magenta fringe
    rgba = im.convert('RGBA'); rgba.putalpha(mask)
    import scipy.ndimage as ndi
    m = np.asarray(mask) > 0
    lab, n = ndi.label(m)
    sizes = ndi.sum(m, lab, range(1, n+1))
    big = sorted(range(1, n+1), key=lambda i: -sizes[i-1])[:3]
    cents = {i: ndi.center_of_mass(m, lab, i)[1] for i in range(1, n+1)}
    big = sorted(big, key=lambda i: cents[i])
    owner = {}
    for i in range(1, n+1):
        if sizes[i-1] < 30: continue
        owner[i] = min(big, key=lambda b: abs(cents[b]-cents[i]))
    out=[]
    arr = np.asarray(rgba).copy()
    for b in big:
        keep = np.isin(lab, [i for i,o in owner.items() if o == b])
        a2 = arr.copy(); a2[...,3] = np.where(keep, arr[...,3], 0)
        c = Image.fromarray(a2, 'RGBA'); out.append(c.crop(c.getbbox()))
    return out

def sprite64(c, box=56, canvas=64, colors=40):
    k = box / max(c.size); w, h = max(1,round(c.width*k)), max(1,round(c.height*k))
    s = c.resize((w,h), Image.LANCZOS)
    rgb = s.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    al = s.split()[3].point(lambda v: 255 if v >= 110 else 0)
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    spr = q.convert('RGBA'); spr.putalpha(al)
    C = Image.new('RGBA', (canvas, canvas), (0,0,0,0)); C.alpha_composite(spr, ((canvas-w)//2, canvas-1-h))
    px = C.load(); add = {}
    for y in range(canvas):
        for x in range(canvas):
            if px[x,y][3]: continue
            nb = [px[x+dx,y+dy] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<canvas and 0<=y+dy<canvas and px[x+dx,y+dy][3]]
            if nb:
                r = sum(p[0] for p in nb)//len(nb); g = sum(p[1] for p in nb)//len(nb); b = sum(p[2] for p in nb)//len(nb)
                add[(x,y)] = (int(r*.32), int(g*.32), int(b*.38)+8, 255)
    for k2,v in add.items(): px[k2] = v
    return C

def smooth128(c, box=120, canvas=128):
    k = box / max(c.size); w, h = round(c.width*k), round(c.height*k)
    s = c.resize((w,h), Image.LANCZOS)
    C = Image.new('RGBA', (canvas, canvas), (0,0,0,0)); C.alpha_composite(s, ((canvas-w)//2, canvas-1-h)); return C

if __name__ == '__main__':
    for tag in sys.argv[1:]:
        parts = cutout(f'/tmp/astra-s3/raw/{tag}.png')
        for i, (el, c) in enumerate(zip(['grass','fire','water'], parts)):
            c.save(f'/tmp/astra-s3/out/{tag}-{el}-cut.png')
            sprite64(c).save(f'/tmp/astra-s3/out/{tag}-{el}-a64.png')
            smooth128(c).save(f'/tmp/astra-s3/out/{tag}-{el}-b128.png')
        print(tag, [p.size for p in parts])
