import sys, numpy as np
from PIL import Image
from scipy import ndimage
def key(src, dst):
    im = Image.open(src).convert('RGBA'); a = np.array(im).astype(float)
    if a[...,3].min() < 250:  # already transparent
        out = np.array(im)
    else:
        rgb = a[...,:3]
        d = np.sqrt((rgb[...,0]-255)**2 + rgb[...,1]**2 + (rgb[...,2]-255)**2)
        bg = d < 110
        lab, _ = ndimage.label(bg)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:,0], lab[:,-1]]))) - {0}
        bg = np.isin(lab, list(edge))
        # 머리카락 사이처럼 가장자리와 안 이어진 마젠타 섬도 지운다(디자인에 분홍 물건이 없다)
        bg |= d < 95
        # soften: alpha ramps over a 2px band outside the hard mask
        dist = ndimage.distance_transform_edt(~bg)
        alpha = np.clip(dist/1.5, 0, 1)
        alpha[bg] = 0
        # despill magenta on edge pixels
        out = np.array(im)
        near = ((dist < 8) | ((out[...,2].astype(int) > out[...,1].astype(int) + 12) & (out[...,0].astype(int) > out[...,1].astype(int) + 12))) & ~bg
        r, g, b = out[...,0].astype(float), out[...,1].astype(float), out[...,2].astype(float)
        spill = np.clip(np.minimum(r, b) - g - 20, 0, None)
        out[...,0] = np.where(near, np.clip(r - spill*0.95, 0, 255), r)
        out[...,2] = np.where(near, np.clip(b - spill*0.95, 0, 255), b)
        out[...,3] = (alpha*255).astype(np.uint8)
        mag = (out[...,2].astype(int) > out[...,1].astype(int) + 10) & (out[...,0].astype(int) > out[...,1].astype(int) + 10) & (np.abs(out[...,0].astype(int) - out[...,2].astype(int)) < 90)
        # 곱슬머리 사이 어두운 보라 포켓(마젠타가 어둡게 물든 곳)은 투명으로
        out[...,3] = np.where(mag, 0, out[...,3])
    o = Image.fromarray(out.astype(np.uint8), 'RGBA')
    bb = o.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    o = o.crop(bb); o.save(dst); return o.size
if __name__ == '__main__':
    import glob, os
    os.makedirs('cut', exist_ok=True)
    for f in sorted(glob.glob('../asset-gen-tmp/professor/r1/*.png')):
        n = os.path.basename(f)[:-4]
        print(n, key(f, f'cut/{n}.png'))
