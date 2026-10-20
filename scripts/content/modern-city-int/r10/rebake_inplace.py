# Redraw R10 / R10b / R11 / R13 props in place: each prop's art is drawn again and its 16x16 cells are pasted over the
# exact chipset tiles already registered in modernCityRoomSpec.json (cells [x, y, tile, layer]). Tile indices,
# passability and kit registration never move, so later appends (R11 after R10b, R13 after R11) keep their numbers.
# A redraw may leave a registered cell empty (pasted as transparent) but must not paint a cell that was never
# registered - those pixels would be lost, so the script fails loudly and lists them.
# Run: python3 scripts/content/modern-city-int/r10/rebake_inplace.py [--check]
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'r11')); sys.path.insert(0, os.path.join(HERE, '..', 'r13'))
sys.path.insert(0, os.path.join(HERE, '..', 'r14'))
from PIL import Image
import bake_r10, bake_r10b, bake_r11, bake_r13
import dept as D
import stairs as ST

# Older sprites (not in any R10/R11 PROPS list) redrawn with the same kit: (id, kind, h, art).
# R14 stairs: every stair / escalator is a real 3/4 flight (stringers, handrails, treads + risers, landing opening).
LEGACY = [
    ('escalator-pair-up', 'wall', 1, ST.escalator_up),
    ('escalator-pair-down', 'wall', 1, ST.escalator_down),
    ('stairs-pair-up-stone', 'wall', 1, ST.stone_pair_up),
    ('stairs-pair-down-stone', 'wall', 1, ST.stone_pair_down),
    ('stairs-up-wall-wood', 'wall', 1, ST.wall_wood_up),
    ('stairs-up-wall-stone', 'wall', 1, ST.wall_stone_up),
    ('stairs-up-grand', 'wall', 1, ST.grand_up),
    ('mci-stairs-up', 'wall', 1, ST.mci_up),
    ('mci-stairs-down', 'floor', 2, ST.mci_down),
    ('dept-luxury-island', 'floor', 2, D.luxury_island),
    ('dept-glass-showcase', 'floor', 1, D.glass_showcase),
]

REPO = HERE.rsplit('/scripts/', 1)[0]
PNG = f'{REPO}/public/assets/modern-city/modern-city-chipset.png'
RS = f'{REPO}/src/assets/modernCityRoomSpec.json'
TPR = 48


def origin_row(kind, h, rows):
    return 0 if kind in ('hang', 'flat', 'door') else -(rows - h)


def main():
    check = '--check' in sys.argv
    sheet = Image.open(PNG).convert('RGBA')
    rs = json.load(open(RS))
    blank = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    lost, changed = [], 0
    legacy = [(pid, kind, h, None, None, None, None, fn) for pid, kind, h, fn in LEGACY]
    lists = [(bake_r10.PROPS, bake_r10.GOODS), (bake_r10b.PROPS, []), (bake_r11.PROPS, []), (bake_r13.PROPS, []), (legacy, [])]
    for props, goods in lists:
        for p in props:
            pid, kind, h, fn = p[0], p[1], p[2], p[7]
            img = fn(); rows = img.height // 16
            top = origin_row(kind, h, rows)
            have = {(c[0], c[1]): c[2] for c in rs['objects'][pid]['cells']}
            for ry in range(rows):
                for x in range(img.width // 16):
                    cell = img.crop((x * 16, ry * 16, x * 16 + 16, ry * 16 + 16))
                    t = have.get((x, top + ry))
                    if t is None:
                        if cell.getbbox(): lost.append(f'{pid} ({x},{top + ry})')
                        continue
                    xy = ((t % TPR) * 16, (t // TPR) * 16)
                    if sheet.crop((*xy, xy[0] + 16, xy[1] + 16)).tobytes() != cell.tobytes(): changed += 1
                    sheet.paste(blank, xy); sheet.paste(cell, xy)
        for gid, _ko, fn in goods:
            t = rs['goods'][gid]; xy = ((t % TPR) * 16, (t // TPR) * 16)
            img = fn()
            if sheet.crop((*xy, xy[0] + 16, xy[1] + 16)).tobytes() != img.tobytes(): changed += 1
            sheet.paste(blank, xy); sheet.paste(img, xy)
    if lost:
        sys.exit('redraw paints unregistered cells (would be lost):\n  ' + '\n  '.join(lost))
    if not check: sheet.save(PNG, optimize=True)
    print(('would change' if check else 'changed'), changed, 'tiles')
    # r16 (2026-10-20): 3/4 + 화풍으로 다시 그린 격자가 정본이다 — 코드 그림이 그것을 되돌리지 않게 끝에서 다시 붙인다.
    sys.path.insert(0, os.path.join(HERE, '..', 'r16'))
    import rebake as r16
    r16.apply(check)


if __name__ == '__main__':
    main()
