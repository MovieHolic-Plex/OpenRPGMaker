#!/usr/bin/env python3
"""Check that no 8x8 window of the replaced (unknown-licence) tree art is back in a Beodeul sheet.

The old art is read from git history at run time (the parent of the redraw commit 431380e25); no old image is stored.
Old windows = 8x8 windows (stride 4, four flips, at least 24 opaque pixels and 3 colours) inside every 16px cell the
redraw changed in the listed sheets, minus windows that the redraw commit itself still has (kept ground, bark, outline). Each target file is scanned at every 1px offset; a hit is an exact RGBA window match.
  python3 scripts/content/beodeul-redraw/old_lineage_check.py [file.png ...]     (default: the shipped tree/forest sheets)
"""
import io, subprocess, sys, json
from pathlib import Path
import numpy as np
from PIL import Image
R = Path(__file__).resolve().parents[3]
OLD = '431380e25^1'; NEW = '431380e25'
SHEETS = ['public/assets/beodeul-city/beodeul-city-chipset.png', 'public/assets/beodeul-nature/chipset.png',
          'public/assets/beodeul-ground/chipset.png', 'public/assets/beodeul-warm-trees/chipset.png',
          'scripts/content/lib/city_v6/assets/jungle-chipset-v6.png']
GROUPS = [f'public/assets/beodeul-ground/woodland-{k}.png' for k in ('north', 'north-open', 'west', 'east')] + \
         [f'public/assets/beodeul-warm-trees/grove-{k}.png' for k in ('north', 'north-open', 'west', 'east')] + \
         [f'public/assets/beodeul-warm-trees/tree-{k}.png' for k in ('03a8f7', '3e8732', '1a786c')]
W = 8
def git_png(rev, p):
    b = subprocess.run(['git', '-C', str(R), 'show', f'{rev}:{p}'], capture_output=True).stdout
    return np.array(Image.open(io.BytesIO(b)).convert('RGBA')) if b else None
M1, M2 = np.uint64(0x9E3779B97F4A7C15), np.uint64(0xC2B2AE3D27D4EB4F)
def hashes(a):
    """64-bit hash of every 8x8 RGBA window (top-left at [y, x]); exact windows hash equal."""
    v = a.astype(np.uint32); px = (v[..., 0] << 24 | v[..., 1] << 16 | v[..., 2] << 8 | v[..., 3]).astype(np.uint64)
    px = (px + np.uint64(1)) * M1
    with np.errstate(over='ignore'):
        r = np.zeros((px.shape[0], px.shape[1] - W + 1), np.uint64)
        for i in range(W): r = r * M2 + px[:, i:i + r.shape[1]]
        h = np.zeros((px.shape[0] - W + 1, r.shape[1]), np.uint64)
        for j in range(W): h = h * M1 + r[j:j + h.shape[0]]
    return h
def ok(win):
    op = win[..., 3] > 0
    return op.sum() >= 24 and len(np.unique(win[op].reshape(-1, 4), axis=0)) >= 3
old, kept = set(), set()
for p in SHEETS + GROUPS:
    a, b = git_png(OLD, p), git_png(NEW, p)
    if a is None: continue
    if b is not None: kept |= set(hashes(b).ravel().tolist())     # in the redraw commit itself = accepted, not old lineage
    if b is not None and a.shape == b.shape:
        diff = (a != b).any(-1)
        mask = np.zeros(a.shape[:2], bool)
        for y in range(0, a.shape[0], 16):
            for x in range(0, a.shape[1], 16):
                if diff[y:y + 16, x:x + 16].any(): mask[y:y + 16, x:x + 16] = True
    else:
        mask = np.ones(a.shape[:2], bool)
    for f, m in ((a, mask), (a[:, ::-1], mask[:, ::-1]), (a[::-1], mask[::-1]), (a[::-1, ::-1], mask[::-1, ::-1])):
        f = np.ascontiguousarray(f); m = np.ascontiguousarray(m)
        H = hashes(f)
        for y in range(0, H.shape[0], 4):
            for x in range(0, H.shape[1], 4):
                if m[y:y + W, x:x + W].all() and ok(f[y:y + W, x:x + W]): old.add(int(H[y, x]))
old -= kept
targets = sys.argv[1:] or SHEETS + GROUPS
report = {}
for p in targets:
    H = hashes(np.array(Image.open(p if Path(p).is_absolute() else R / p).convert('RGBA')))
    report[p] = int(np.isin(H.ravel(), np.fromiter(old, np.uint64, len(old))).sum())
print(json.dumps(dict(oldWindows=len(old), hits=report, total=sum(report.values()))))
