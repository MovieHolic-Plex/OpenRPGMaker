# Bake one Rasak (RPG Maker MZ) tileset bundle into a single OPRN custom atlas.
#
# The Rasak pack may be linked but not redistributed, so this runs on the
# user's own download and writes outside the repository:
#   python3 scripts/content/rasak/bake_atlas.py --source <extracted>/Fantasy/Tileset \
#       --bundle nature_field --out ~/third-party-assets/rasak/baked
# Bundles (which sheets fill MZ slots A1..E) live in tiledata/rasak-fantasy/bundles.json.
#
# Atlas layout, 96 tiles per row (keeps big bundles under 8192px), every section starts on a fresh row:
#   A1  per present kind: shape*4 + frame   (water frames 0,1,2,1; waterfall 0,1,2)
#   A2  per present kind: 48 shapes        A3  per present kind: 16 shapes
#   A4  per present kind: floor 48 shapes, wall 16 shapes
#   A5  n (MZ order)                 B..E n (MZ order: left 8 columns first)
#   X1.. extra object sheets beyond MZ's four (same order as B..E); OPRN has no 4-sheet cap
#   S1.. whole-building pictures (Special_Buildings): padded on the right/top to 48px, row-major, fully
#        transparent cells are not stored; the section's `grid` maps [y][x] to the atlas index (-1 = blank)
#   Autotile kinds whose source block is fully transparent are skipped; the manifest lists kinds.
#   shadow  15 synthetic MZ auto-shadow quarter masks (bits 1..15)
# manifest.json maps every atlas index back to its MZ tileId.
import argparse, hashlib, json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mz_autotile as mz

T = mz.T
COLS = 96
SLOTS = ['A1', 'A2', 'A3', 'A4', 'A5', 'B', 'C', 'D', 'E']
MZ_BASE = {'A1': 2048, 'A2': 2816, 'A3': 4352, 'A4': 5888, 'A5': 1536, 'B': 0, 'C': 256, 'D': 512, 'E': 768}
# MZ darkens shadowed pixels to round(c/2); alpha 127 reproduces that under (a*s + (255-a)*d + 127)//255.
SHADOW_ALPHA = 127


def load(path):
    return np.array(Image.open(path).convert('RGBA'))


def blank(tile):
    return not tile[:, :, 3].any()


class Atlas:
    def __init__(self):
        self.tiles, self.entries, self.strips = [], [], []

    def pad_row(self):
        while len(self.tiles) % COLS:
            self.add(np.zeros((T, T, 4), np.uint8), None)

    def add(self, tile, entry):
        if entry is not None and blank(tile):
            entry = {**entry, 'empty': True}
        self.tiles.append(tile)
        self.entries.append(entry)
        return len(self.tiles) - 1


def block_empty(sheet, bx, by, w, h):
    y0, x0 = int(by * T), int(bx * T)
    region = sheet[y0:y0 + int(h * T), x0:x0 + int(w * T)]
    return region.size == 0 or not region[:, :, 3].any()


def plain(sheet, n, slot):
    if slot == 'A5':
        tx, ty = n % 8, n // 8
    else:
        tx, ty = n % 8 + (n // 128) * 8, (n % 128) // 8
    return sheet[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T]


def bake_slot(atlas, slot, sheet, fps):
    atlas.pad_row()
    if slot == 'A1':
        for kind in mz.a1_kinds():
            bx0, by0, table, axis = mz.a1_block(kind, 0)
            if block_empty(sheet, bx0, by0, 2, 1 if table is mz.WATERFALL else 3):
                continue
            base = len(atlas.tiles)
            for shape in range(48):
                frames = 4 if axis == 'x' else 3 if axis == 'y' else 1
                for f in range(4):
                    if shape >= len(table):
                        atlas.add(np.zeros((T, T, 4), np.uint8), None)
                        continue
                    bx, by, table, _ = mz.a1_block(kind, min(f, frames - 1))
                    tile = mz.compose(sheet, table[shape], bx, by)
                    atlas.add(tile, {'slot': 'A1', 'kind': kind, 'shape': shape, 'frame': f,
                                     'mzTileId': MZ_BASE['A1'] + kind * 48 + shape})
                if shape < len(table) and frames > 1 and not blank(atlas.tiles[base + shape * 4]):
                    atlas.strips.append({'baseTile': base + shape * 4, 'frames': frames, 'fps': fps})
    elif slot in ('A2', 'A3'):
        kinds, per = (32, 48) if slot == 'A2' else (32, 16)
        block = mz.a2_block if slot == 'A2' else mz.a3_block
        for kind in range(kinds):
            bx, by, table = block(kind)
            if block_empty(sheet, bx, by, 2, 3 if slot == 'A2' else 2):
                continue
            for shape in range(per):
                atlas.add(mz.compose(sheet, table[shape], bx, by),
                          {'slot': slot, 'kind': kind, 'shape': shape, 'mzTileId': MZ_BASE[slot] + kind * 48 + shape})
    elif slot == 'A4':
        for kind in range(48):
            bx, by, table = mz.a4_block(kind)
            if block_empty(sheet, bx, by, 2, 2 if table is mz.WALL else 3):
                continue
            for shape in range(len(table)):
                atlas.add(mz.compose(sheet, table[shape], bx, by),
                          {'slot': 'A4', 'kind': kind, 'shape': shape, 'wall': table is mz.WALL,
                           'mzTileId': MZ_BASE['A4'] + kind * 48 + shape})
    else:
        count = 128 if slot == 'A5' else 256
        for n in range(count):
            entry = {'slot': slot, 'n': n}
            if slot in MZ_BASE:
                entry['mzTileId'] = MZ_BASE[slot] + n
            atlas.add(plain(sheet, n, slot).copy(), entry)


def bake_building(atlas, sheet, rel):
    h, w = sheet.shape[:2]
    cols, rows = -(-w // T), -(-h // T)
    padded = np.zeros((rows * T, cols * T, 4), np.uint8)
    padded[rows * T - h:, :w] = sheet  # 밑변을 칸 경계에 붙인다(위·오른쪽에 투명 덧대기)
    grid = []
    for y in range(rows):
        row = []
        for x in range(cols):
            tile = padded[y * T:(y + 1) * T, x * T:(x + 1) * T]
            row.append(-1 if blank(tile) else atlas.add(tile.copy(), {'slot': 'S', 'file': rel, 'x': x, 'y': y}))
        grid.append(row)
    return grid


def bake_shadows(atlas):
    atlas.pad_row()
    for bits in range(1, 16):
        tile = np.zeros((T, T, 4), np.uint8)
        for i in range(4):
            if bits & (1 << i):
                tile[(i // 2) * 24:(i // 2) * 24 + 24, (i % 2) * 24:(i % 2) * 24 + 24, 3] = SHADOW_ALPHA
        atlas.add(tile, {'slot': 'shadow', 'bits': bits})


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True, help='extracted Fantasy/Tileset folder of the user download')
    ap.add_argument('--bundle', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--bundles', default=str(Path(__file__).resolve().parents[3] / 'tiledata/rasak-fantasy/bundles.json'))
    args = ap.parse_args()
    bundles = json.loads(Path(args.bundles).read_text())
    bundle = next(b for b in bundles['bundles'] if b['id'] == args.bundle)
    src = Path(os.path.expanduser(args.source))
    known = bundles.get('sourceSha256', {})
    atlas = Atlas()
    used = []
    sheets = [(slot, bundle['sheets'].get(slot)) for slot in SLOTS]
    sheets += [(f'X{i + 1}', rel) for i, rel in enumerate(bundle.get('extraSheets', []))]
    for slot, rel in sheets:
        if not rel:
            continue
        path = src / rel
        digest = sha256(path)
        if known.get(rel) and known[rel] != digest:
            raise SystemExit(f'{rel}: sha256 differs from the pack this bundle was written for ({digest})')
        start = (len(atlas.tiles) + COLS - 1) // COLS * COLS
        bake_slot(atlas, slot, load(path), bundle.get('waterFps', 4))
        used.append({'slot': slot, 'file': rel, 'sha256': digest, 'start': start, 'end': len(atlas.tiles)})
    for i, rel in enumerate(bundle.get('buildingSheets', [])):
        path = src / rel
        digest = sha256(path)
        if known.get(rel) and known[rel] != digest:
            raise SystemExit(f'{rel}: sha256 differs from the pack this bundle was written for ({digest})')
        start = len(atlas.tiles)
        grid = bake_building(atlas, load(path), rel)
        used.append({'slot': f'S{i + 1}', 'file': rel, 'sha256': digest, 'start': start, 'end': len(atlas.tiles),
                     'size': [len(grid[0]), len(grid)], 'grid': grid})
    shadow_start = (len(atlas.tiles) + COLS - 1) // COLS * COLS
    bake_shadows(atlas)
    atlas.pad_row()
    rows = len(atlas.tiles) // COLS
    img = np.zeros((rows * T, COLS * T, 4), np.uint8)
    for i, tile in enumerate(atlas.tiles):
        img[(i // COLS) * T:(i // COLS + 1) * T, (i % COLS) * T:(i % COLS + 1) * T] = tile
    out = Path(os.path.expanduser(args.out)) / bundle['id']
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img).save(out / 'atlas.png', optimize=True)
    manifest = {'bundle': bundle['id'], 'name': bundle['name'], 'tileSize': T, 'tilesPerRow': COLS,
                'count': len(atlas.tiles), 'sections': used, 'shadowStart': shadow_start,
                'shadowAlpha': SHADOW_ALPHA, 'animationStrips': atlas.strips, 'entries': atlas.entries}
    (out / 'manifest.json').write_text(json.dumps(manifest))
    print(json.dumps({'bundle': bundle['id'], 'count': len(atlas.tiles), 'size': [COLS * T, rows * T],
                      'strips': len(atlas.strips), 'sections': [(u['slot'], u['file']) for u in used]}))


if __name__ == '__main__':
    main()
