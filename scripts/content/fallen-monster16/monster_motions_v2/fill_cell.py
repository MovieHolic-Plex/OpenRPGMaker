"""한 장에 [대기, 새 자세] 두 자세를 그린 그림에서 새 자세를 잘라, 이미 설치한 시트의 칸 하나를 채운다 (monster-all-20, 2026-11-09).
대기 자세 폭을 그 시트 idle_a 폭에 맞춰 배율을 정하고(unfake mode, 결정적), 시트 idle_a 팔레트를 그대로 입힌다. 바닥 = CELL-4.
  python3 fill_cell.py <two-pose.png> <sheet.png> <cellIndex> <out.png> [--cell 96] [--cols 5]
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
import slice_sheet as ss

def blobs(a):
    op = a[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(op, iterations=6))
    sizes = ndimage.sum(op, lab, range(1, n + 1))
    keep = sorted(np.argsort(sizes)[-2:] + 1, key=lambda l: np.nonzero(lab == l)[1].mean())
    out = []
    for l in keep:
        m = (lab == l) & op; ys, xs = np.nonzero(m); b = a.copy(); b[~m] = 0
        out.append(b[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return out

def main():
    src, sheet_p, idx, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    cell = int(sys.argv[sys.argv.index('--cell') + 1]) if '--cell' in sys.argv else 96
    cols = int(sys.argv[sys.argv.index('--cols') + 1]) if '--cols' in sys.argv else 5
    sheet = Image.open(sheet_p).convert('RGBA')
    idle = sheet.crop((0, 0, cell, cell)); ib = idle.getbbox(); idle_w = ib[2] - ib[0]
    pal = ss.make_palette(idle)
    a = ss.key_alpha(np.array(Image.open(src).convert('RGBA')))
    ref, pose = blobs(a)
    # 생성 그림은 시트보다 밝기·색이 어긋나곤 한다: 같은 그림 속 대기 자세 → 시트 idle_a 의 채널별 평균·표준편차로 새 자세 색을 옮긴다.
    ia = np.array(idle)[np.array(idle)[..., 3] == 255][:, :3].astype(float)
    ra = ref[ref[..., 3] > 0][:, :3].astype(float)
    op = pose[..., 3] > 0
    px = pose[..., :3].astype(float)
    px = (px - ra.mean(0)) / (ra.std(0) + 1e-6) * ia.std(0) + ia.mean(0)
    pose = pose.copy(); pose[..., :3] = np.where(op[..., None], np.clip(px, 0, 255), 0).astype(np.uint8)
    s = ref.shape[1] / idle_w
    r0 = ss.downscale(ref, s, 'f0'); w0 = r0.getbbox()[2] - r0.getbbox()[0]; s = s * w0 / idle_w
    im = ss.apply_palette(ss.downscale(pose, s, 'f1'), pal)
    crop = im.crop(im.getbbox()); w, h = crop.size
    ground = cell - 4
    x = max(0, min(cell - w, round(cell / 2 - w / 2))); y = max(0, ground + 1 - h)
    c = Image.new('RGBA', (cell, cell)); c.paste(crop, (x, y), crop)
    x0, y0 = (idx % cols) * cell, (idx // cols) * cell
    arr = np.array(sheet); arr[y0:y0 + cell, x0:x0 + cell] = np.array(c)
    arr[arr[..., 3] == 0] = 0
    Image.fromarray(arr).save(out)
    print({'scale': round(s, 3), 'wh': [w, h], 'idle_w': idle_w, 'colors': len(pal)})

if __name__ == '__main__':
    main()
