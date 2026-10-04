# 움직이는 기물(12프레임)의 「바뀌는 화소」 표: candidates/<slug>/anim-mask.png(흰 화소 = 프레임끼리 다른 화소)
# + anim-region-x6.png(v5 첫 프레임 6배 위에 그 자리를 자홍으로). 3/4 재작도 작업자는 이 자리를 v5 그대로 둔다.
#   python3 scripts/content/hand-interior-pick/anim_mask.py "bread oven" [...]
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CAND, objects_by_id, slug, v5_atlas  # noqa: E402
from PIL import Image  # noqa: E402
import numpy as np  # noqa: E402

for i in sys.argv[1:]:
    o = objects_by_id()[i]; a = o['atlas']; A = v5_atlas(); d = os.path.join(CAND, slug(i))
    F = np.stack([np.array(A.crop((a['x'] + k * a['w'], a['y'], a['x'] + (k + 1) * a['w'], a['y'] + a['h']))) for k in range(a['frames'])])
    m = (F != F[0]).any(axis=(0, 3))
    Image.fromarray((m * 255).astype('uint8')).save(os.path.join(d, 'anim-mask.png'))
    r = F[0].copy(); r[m] = (255, 0, 255, 255)
    Image.fromarray(r).resize((a['w'] * 6, a['h'] * 6), Image.NEAREST).save(os.path.join(d, 'anim-region-x6.png'))
    ys, xs = np.nonzero(m)
    print(i, a['frames'], 'frames', int(m.sum()), 'px', 'bbox', [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if m.any() else None)
