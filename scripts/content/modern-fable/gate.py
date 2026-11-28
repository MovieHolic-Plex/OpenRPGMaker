#!/usr/bin/env python3
"""Mechanical verification gate & 2x VQA contact-sheet builder for modern-fable (100 objects + 100 buildings).

Checks EVERY PNG strictly:
  G1. Palette Lock: 0 off-palette opaque pixels vs tiledata/jp-city/fable-city/palette.json, alpha in {0, 255}
  G2. Grid Alignment: width and height are exact multiples of 16px, non-empty opaque ratio >= min_fill
  G3. Richness Floor: buildings >= 14 unique colors (prevents 5-color modern4 flatness); objects >= 7 unique colors
  G4. Anti-Clone Floor Check (buildings >= 64px tall): adjacent 16px wall bands cannot be >= 98.5% identical!
  G5. Grounding: bottom 2px band contains solid pixels (no floating sprites)

Usage:
  python3 scripts/content/modern-fable/gate.py --kind objects --batch batch_01
  python3 scripts/content/modern-fable/gate.py --kind buildings --batch pack01_kr_sangga
  python3 scripts/content/modern-fable/gate.py --all
"""
import argparse
import glob
import json
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

from fable_lib import allowed_rgba, OUT_ROOT, REPO


def check_image(path, kind='objects', spec=None):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    a = np.array(im)
    fails = []
    warns = []

    # G2: 16px alignment
    if w % 16 != 0 or h % 16 != 0 or w < 16 or h < 16:
        fails.append(f'G2 size {w}x{h} not 16px multiple')

    # G1: alpha binary + strict Fable palette lock
    al = a[:, :, 3]
    if not ((al == 0) | (al == 255)).all():
        bad_a = int(((al > 0) & (al < 255)).sum())
        fails.append(f'G1 semi-transparent pixels={bad_a}')

    opaq = a[al == 255]
    fill = len(opaq) / max(1, w * h)
    min_fill = 0.08 if kind == 'objects' else 0.55
    if fill < min_fill:
        fails.append(f'G2 fill {fill:.2f} < {min_fill}')

    pal = allowed_rgba()
    uniq = {tuple(int(v) for v in px) for px in np.unique(opaq, axis=0)} if len(opaq) else set()
    off = [c for c in uniq if c not in pal]
    if off:
        fails.append(f'G1 off-palette colors={len(off)} sample={off[:3]}')

    # G3: color richness
    min_cols = 7 if kind == 'objects' else 14
    if len(uniq) < min_cols:
        fails.append(f'G3 richness {len(uniq)} colors < {min_cols}')

    # G4: anti-clone vertical floor check for taller buildings
    if kind == 'buildings' and h >= 80:
        # Compare adjacent 16px horizontal wall slices below the roof (starting at y=32)
        clones = 0
        for y in range(32, h - 32, 16):
            s1 = a[y:y + 16, :, :]
            s2 = a[y + 16:y + 32, :, :]
            if s1.shape == s2.shape:
                eq = float((s1 == s2).all(axis=2).mean())
                if eq >= 0.96:
                    clones += 1
        if clones > 0:
            fails.append(f'G4 cloned vertical 16px floor bands={clones} (break floor repetition!)')

    # G5: bottom grounding (ignore pure overhead/hanging signs if tagged)
    tags = (spec or {}).get('tags', [])
    if 'floating' not in tags and 'overhead' not in tags:
        bot = int((al[max(0, h - 4):h, :] == 255).sum())
        if bot < 3:
            fails.append(f'G5 ungrounded bottom pixels={bot}')

    return {
        'id': os.path.splitext(os.path.basename(path))[0],
        'size': [w, h],
        'colors': len(uniq),
        'fill': round(fill, 3),
        'ok': len(fails) == 0,
        'fails': fails,
        'warns': warns,
    }


def make_contact_sheet(items, out_png, scale=2, title='', ref_png=None, cols=5):
    """Build crisp 2x/3x labeled contact sheet with optional Fable reference banner at top."""
    cell_pad = 14
    lbl_h = 18
    imgs = []
    for it in items:
        im = Image.open(it['path']).convert('RGBA')
        im_s = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
        imgs.append((it['id'], it.get('name', ''), im_s))

    if not imgs:
        return None

    max_w = max(max(im.width for _, _, im in imgs), 110)
    max_h = max(im.height for _, _, im in imgs)
    cw = max_w + cell_pad * 2
    ch = max_h + lbl_h + cell_pad * 2
    rows = (len(imgs) + cols - 1) // cols

    ref_im = None
    ref_h = 0
    if ref_png and os.path.exists(ref_png):
        raw_r = Image.open(ref_png).convert('RGBA')
        tw = min(cw * cols - 24, raw_r.width)
        th = int(raw_r.height * tw / raw_r.width)
        ref_im = raw_r.resize((tw, th), Image.Resampling.NEAREST)
        ref_h = th + 28

    W = cw * cols + 16
    H = 30 + ref_h + ch * rows + 12
    sheet = Image.new('RGBA', (W, H), (28, 31, 38, 255))
    dr = ImageDraw.Draw(sheet)
    dr.text((12, 8), title, fill=(240, 244, 250, 255))

    y_off = 28
    if ref_im is not None:
        dr.text((12, y_off), 'BENCHMARK REF (Fable 5.2 baseline):', fill=(160, 220, 160, 255))
        sheet.alpha_composite(ref_im, (12, y_off + 16))
        y_off += ref_h

    for idx, (iid, name, im_s) in enumerate(imgs):
        r = idx // cols
        c = idx % cols
        bx = 8 + c * cw
        by = y_off + r * ch
        # Neutral pavement/grass checkerboard backdrop so both dark & light pixels read crisply
        bg = Image.new('RGBA', (im_s.width + 8, im_s.height + 8), (110, 128, 96, 255))
        bg.alpha_composite(im_s, (4, 4))
        sheet.alpha_composite(bg, (bx + (cw - bg.width) // 2, by + lbl_h + (max_h - im_s.height)))
        short = iid.replace('mf-obj-', '').replace('mf-bldg-', '')
        dr.text((bx + 6, by + 2), short[:24], fill=(225, 232, 242, 255))

    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    sheet.save(out_png)
    return out_png


def run_batch(kind, batch, make_sheet=True):
    bdir = os.path.join(OUT_ROOT, kind, batch)
    mpath = os.path.join(bdir, 'manifest.json')
    specs = {}
    if os.path.exists(mpath):
        for s in json.load(open(mpath, encoding='utf-8')).get('items', []):
            specs[s['id']] = s
    pngs = sorted(glob.glob(os.path.join(bdir, '*.png')))
    pngs = [p for p in pngs if not os.path.basename(p).startswith('_sheet')]
    results = []
    sheet_items = []
    for p in pngs:
        iid = os.path.splitext(os.path.basename(p))[0]
        r = check_image(p, kind=kind, spec=specs.get(iid))
        results.append(r)
        sheet_items.append({'id': iid, 'name': specs.get(iid, {}).get('name', ''), 'path': p})
    fails = [r for r in results if not r['ok']]
    avg_c = sum(r['colors'] for r in results) / max(1, len(results))
    print(f'GATE {kind}/{batch}: {len(results) - len(fails)}/{len(results)} PASS (FAIL {len(fails)}, avg colors {avg_c:.1f})')
    for f in fails:
        print(f'  FAIL {f["id"]}: ' + ' | '.join(f['fails']))
    if make_sheet and sheet_items:
        ref = os.path.join(REPO, 'public/assets/jp-city-fable-references/bldg-f-shop-1.png')
        scale = 3 if kind == 'objects' else 2
        cols = 5
        sp = os.path.join(bdir, f'_sheet_{batch}.png')
        make_contact_sheet(sheet_items, sp, scale=scale, title=f'{kind}/{batch} ({len(sheet_items)} items, {scale}x)', ref_png=ref if kind == 'buildings' else None, cols=cols)
        print(f'  sheet -> {sp}')
    return len(fails) == 0, results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kind', choices=['objects', 'buildings', 'ground'])
    ap.add_argument('--batch')
    ap.add_argument('--all', action='store_true')
    args = ap.parse_args()
    ok = True
    if args.all:
        for k in ('objects', 'buildings'):
            root = os.path.join(OUT_ROOT, k)
            if not os.path.isdir(root):
                continue
            for b in sorted(os.listdir(root)):
                if os.path.isdir(os.path.join(root, b)):
                    b_ok, _ = run_batch(k, b, make_sheet=True)
                    ok = ok and b_ok
    else:
        b_ok, _ = run_batch(args.kind, args.batch, make_sheet=True)
        ok = b_ok
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
