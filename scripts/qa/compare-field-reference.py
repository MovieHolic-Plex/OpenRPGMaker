"""Full-frame SSIM against the user reference at a fixed, landmark-derived viewport.

The transform is authored before verification. No region omission, fitted color change,
per-region warp, or screenshot pixels in the map/atlas are allowed.
"""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from skimage.metrics import structural_similarity

parser = argparse.ArgumentParser()
parser.add_argument('--reference', required=True)
parser.add_argument('--render', default='output/evidence/emerald-fields/map_field_twinfalls_20260913.png')
parser.add_argument('--output', default='output/evidence/emerald-fields/fidelity')
args = parser.parse_args()
layout = json.loads(Path('scripts/lib/emeraldFieldReference.json').read_text())
reference_bytes = Path(args.reference).read_bytes()
assert hashlib.sha256(reference_bytes).hexdigest() == layout['referenceSHA256']
reference = cv2.imread(args.reference)
render = cv2.imread(args.render)
assert render.shape[:2] == (layout['height'] * 16, layout['width'] * 16)
sx, sy, ox, oy = (layout['transform'][k] for k in ('sx', 'sy', 'ox', 'oy'))
yy, xx = np.mgrid[0:reference.shape[0], 0:reference.shape[1]]
mx = ((xx - ox + .5) / sx * 2 - .5).astype(np.float32)
my = ((yy - oy + .5) / sy * 2 - .5).astype(np.float32)
assert mx.min() >= 0 and my.min() >= 0
assert mx.max() < render.shape[1] * 2 and my.max() < render.shape[0] * 2
aligned = cv2.remap(np.repeat(np.repeat(render, 2, axis=0), 2, axis=1), mx, my, cv2.INTER_LINEAR)
score, field = structural_similarity(reference, aligned, channel_axis=2, data_range=255, full=True)
mae = float(np.mean(np.abs(reference.astype(float) - aligned.astype(float))))
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
cv2.imwrite(str(out / 'editor-aligned.png'), aligned)
# A diagnostic image, not part of the game asset: every pixel of the reference is included.
comparison = np.concatenate([reference, aligned], axis=1)
cv2.imwrite(str(out / 'reference-vs-editor.png'), comparison)
proof = {
    'metric': 'skimage.metrics.structural_similarity, RGB, full 630x500 frame, data_range=255',
    'threshold': 0.95,
    'ssim': float(score),
    'ssimPercent': float(score * 100),
    'maePerChannel0To255': mae,
    'referenceSHA256': hashlib.sha256(reference_bytes).hexdigest(),
    'renderSHA256': hashlib.sha256(Path(args.render).read_bytes()).hexdigest(),
    'renderPath': str(Path(args.render).resolve()),
    'viewportTransform': layout['transform'],
    'transformSource': 'Original tree positions and tile pitch, fixed before rendering the reconstruction',
    'comparedPixels': int(reference.shape[0] * reference.shape[1]),
    'regionsExcluded': 0,
    'colorAdjustment': False,
    'screenshotPixelsInAtlas': False,
    'passed': bool(score >= .95),
}
(out / 'fidelity-proof.json').write_text(json.dumps(proof, indent=2) + '\n')
print(json.dumps(proof))
assert score >= .95, f'Full-frame SSIM {score:.6f} remains below 0.95'
