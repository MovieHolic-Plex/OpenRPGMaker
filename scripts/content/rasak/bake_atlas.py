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
#   N1.. animation sheets (Fantasy/Animations, MZ character sheets '!'/'$'): one object per character, every 48px cell
#        stores its frames consecutively and gets one animationStrip; the section's `characters[].grid` maps cells to strip bases
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


def anim_characters(sheet, rel):
    """RPG Maker MZ 캐릭터 시트('!'·'$' 접두어) → 캐릭터마다 반복 재생 프레임 원점 목록.
    '$' = 3열×4줄 한 캐릭터, 아니면 12열×8줄 = 캐릭터 8개(각 3열×4줄).
    아래 방향 줄의 3프레임이 움직이면 0,1,2,1 로 되풀이하고(불꽃·물결·날갯짓),
    줄 안은 같고 줄끼리 다르면 네 줄이 단계라 가운데 열을 위→아래로 되풀이한다(깜빡이는 빛·도는 풍차).
    어느 쪽도 아니면 정지 그림 하나."""
    h, w = sheet.shape[:2]
    single = '$' in Path(rel).name
    cols, rows = (3, 4) if single else (12, 8)
    cw, ch = w // cols, h // rows
    out = []
    for k in range(1 if single else 8):
        bx = 0 if single else (k % 4) * cw * 3
        by = 0 if single else (k // 4) * ch * 4
        F = [[sheet[by + r * ch:by + (r + 1) * ch, bx + f * cw:bx + (f + 1) * cw].astype(int) for f in range(3)] for r in range(4)]
        if not any(F[r][f][:, :, 3].any() for r in range(4) for f in range(3)):
            continue

        def d(a, b):
            m = (a[:, :, 3] > 0) | (b[:, :, 3] > 0)
            return float(np.abs(a - b)[m].mean()) if m.any() else 0.0
        inrow = max(d(F[0][0], F[0][1]), d(F[0][1], F[0][2]))
        across = max(d(F[0][1], F[r][1]) for r in (1, 2, 3))
        if inrow > 3:
            frames, mode = [(bx + f * cw, by) for f in (0, 1, 2, 1)], 'row'
        elif across > 3:
            frames, mode = [(bx + cw, by + r * ch) for r in range(4)], 'rows'
        else:
            frames, mode = [(bx + cw, by)], 'still'
        out.append({'character': k, 'cw': cw, 'ch': ch, 'frames': frames, 'mode': mode})
    return out


def bake_anim(atlas, sheet, rel, fps):
    """애니메이션 시트 한 장 → 캐릭터마다 물체 하나. 캐릭터 칸(cw×ch)을 48 배수로(위·양옆 투명 덧대기, 밑변은 칸 경계) 맞춰
    48 칸으로 쪼개고, 칸마다 프레임을 연속으로 저장해 strip 하나를 단다. grid[y][x] = 그 칸 strip 의 첫 프레임(-1 = 빈 칸)."""
    atlas.pad_row()
    chars = []
    for c in anim_characters(sheet, rel):
        cw, ch, frames = c['cw'], c['ch'], c['frames']
        cols, rows = -(-cw // T), -(-ch // T)
        padx = (cols * T - cw) // 2
        pads = []
        for fx, fy in frames:
            p = np.zeros((rows * T, cols * T, 4), np.uint8)
            p[rows * T - ch:, padx:padx + cw] = sheet[fy:fy + ch, fx:fx + cw]
            pads.append(p)
        grid = []
        for y in range(rows):
            row = []
            for x in range(cols):
                cells = [p[y * T:(y + 1) * T, x * T:(x + 1) * T] for p in pads]
                if all(blank(t) for t in cells):
                    row.append(-1)
                    continue
                base = len(atlas.tiles)
                for f, t in enumerate(cells):
                    atlas.add(t.copy(), {'slot': 'N', 'file': rel, 'character': c['character'], 'x': x, 'y': y, 'frame': f})
                if len(cells) > 1:
                    atlas.strips.append({'baseTile': base, 'frames': len(cells), 'fps': fps})
                row.append(base)
            grid.append(row)
        chars.append({'character': c['character'], 'mode': c['mode'], 'frames': len(frames), 'size': [cols, rows], 'grid': grid})
    return chars


def pad_sheet(sheet):
    """B..E 와 같은 16열×16줄(256칸) 판으로 덧댄다 — 작은 시트(새집 3×7칸)도 plain() 의 칸 번호 규칙을 그대로 쓴다."""
    out = np.zeros((16 * T, 16 * T, 4), np.uint8)
    h, w = sheet.shape[:2]
    out[:min(h, 16 * T), :min(w, 16 * T)] = sheet[:16 * T, :16 * T]
    return out


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
    # 애니 시트는 그림자 **뒤**에 둔다 — 앞에 두면 그림자·합성 칸 번호가 밀려 기존 맵(pNN 재현·예제)이 틀어진다.
    atlas.pad_row()
    # 그림자 뒤 일반 물체 시트(tailSheets): 기존 번호를 밀지 않고 시트를 더할 때(새집 시트 2026-09-27). 슬롯 이름 T1..
    for i, rel in enumerate(bundle.get('tailSheets', [])):
        path = src / rel
        digest = sha256(path)
        if known.get(rel) and known[rel] != digest:
            raise SystemExit(f'{rel}: sha256 differs from the pack this bundle was written for ({digest})')
        start = (len(atlas.tiles) + COLS - 1) // COLS * COLS
        bake_slot(atlas, f'T{i + 1}', pad_sheet(load(path)), bundle.get('waterFps', 4))
        used.append({'slot': f'T{i + 1}', 'file': rel, 'sha256': digest, 'start': start, 'end': len(atlas.tiles)})
    anim_root = src.parent / 'Animations'
    for i, rel in enumerate(bundle.get('animSheets', [])):
        path = anim_root / rel
        digest = sha256(path)
        if known.get('Animations/' + rel) and known['Animations/' + rel] != digest:
            raise SystemExit(f'{rel}: sha256 differs from the pack this bundle was written for ({digest})')
        start = len(atlas.tiles) + (-len(atlas.tiles)) % COLS
        chars = bake_anim(atlas, load(path), rel, bundle.get('animFps', 6))
        used.append({'slot': f'N{i + 1}', 'file': 'Animations/' + rel, 'sha256': digest, 'start': start, 'end': len(atlas.tiles), 'characters': chars})
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
