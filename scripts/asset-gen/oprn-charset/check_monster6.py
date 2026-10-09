"""Monster6 걷기 칩 검사: 크기 288x256, 알파 0/255, 캐릭터당 ≤16색, 빈 칸 없음, 같은 방향 3패턴이 서로 다름, 몸 높이 18~30."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
a = np.array(Image.open(ROOT / 'public/assets/generated/charsets/Monster6.png').convert('RGBA'))
bad = []
if a.shape[:2] != (256, 288): bad.append(f'size {a.shape}')
if not set(np.unique(a[:, :, 3])) <= {0, 255}: bad.append('alpha')
for i in range(8):
    bx, by = i % 4 * 72, i // 4 * 128
    blk = a[by:by + 128, bx:bx + 72]
    cols = {tuple(c) for c in blk[blk[:, :, 3] > 0][:, :3]}
    if len(cols) > 16: bad.append(f'char{i} colors {len(cols)}')
    for r in range(4):
        cells = [blk[r * 32:r * 32 + 32, c * 24:c * 24 + 24] for c in range(3)]
        for c, cell in enumerate(cells):
            ys = np.nonzero(cell[:, :, 3])[0]
            if len(ys) == 0: bad.append(f'char{i} r{r}c{c} empty'); continue
            hgt = ys.max() - ys.min() + 1
            if not 18 <= hgt <= 30 or ys.max() > 30: bad.append(f'char{i} r{r}c{c} h{hgt} bottom{ys.max()}')
            xs = np.nonzero(cell[:, :, 3])[1]
            if xs.min() == 0 or xs.max() == 23 or ys.min() == 0: bad.append(f'char{i} r{r}c{c} touches edge')
        for p, q in ((0, 1), (1, 2), (0, 2)):
            if np.array_equal(cells[p], cells[q]): bad.append(f'char{i} r{r} c{p}==c{q}')
    print(f'char{i}: {len(cols)} colors')
print('OK' if not bad else '\n'.join(bad))
sys.exit(1 if bad else 0)
