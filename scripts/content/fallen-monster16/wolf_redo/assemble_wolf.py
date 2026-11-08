
# wolf-redo-scratch: assemble 4x4 sheet (cells 0-8 + 11; 9,10,12,13,14,15 empty) and diff against the old sheet.
import base64, io, json, re, sys
import numpy as np
from PIL import Image
out, ts, dst = sys.argv[1], sys.argv[2], sys.argv[3]
C = 96
ORDER = {0: 'idle_a', 1: 'idle_b', 2: 'idle_c', 3: 'windup', 4: 'move', 5: 'attack', 6: 'move', 7: 'hit', 8: 'dead', 11: 'skill'}
sheet = Image.new('RGBA', (C * 4, C * 4))
for i, n in ORDER.items():
    sheet.alpha_composite(Image.open(f'{out}/{n}.png'), ((i % 4) * C, (i // 4) * C))
new = np.array(sheet); new[new[..., 3] == 0] = 0
m = re.search(r'resourceId: "generated-enemy-wolf-dire".*?sheet: "data:image/png;base64,([^"]+)"', open(ts).read())
old = np.array(Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')); old[old[..., 3] == 0] = 0
cell = lambda a, i: a[(i // 4) * C:(i // 4 + 1) * C, (i % 4) * C:(i % 4 + 1) * C]
equal = [(i, j) for i in range(16) for j in range(16) if (cell(new, i)[..., 3] > 0).any() and np.array_equal(cell(new, i), cell(old, j))]
same_px = int(sum(((cell(new, i)[..., 3] > 0) & (cell(new, i) == cell(old, i)).all(-1)).sum() for i in range(16)))
assert not equal, equal
assert set(np.unique(new[..., 3])) <= {0, 255}
for i in (9, 10, 12, 13, 14, 15):
    assert not (cell(new, i)[..., 3] > 0).any(), i
Image.fromarray(new).save(dst)
info = {'equalCells': equal, 'samePixelsAtSamePosition': same_px, 'colors': int(len(np.unique(new[new[..., 3] == 255][:, :3], axis=0))),
        'cells': {i: list(Image.fromarray(cell(new, i)).getbbox()) for i in ORDER}}
print(json.dumps(info))
