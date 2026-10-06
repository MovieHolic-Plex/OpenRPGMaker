"""Explicit local ASCII choices for the cuff/crystal advisory repair.

No frame transforms, shapes, inferred shading, hole filling or propagation.
Each pose has its own named literal patch. Final pxgrids remain full 96x96 rows.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCHES = {
    'idle_a': '''
54 54 lc
55 53 cln
56 53 ocn
57 54 oo
''',
    'idle_b': '''
54 54 lc
55 53 cln
56 53 ocn
57 54 oo
''',
    'idle_c': '''
54 54 lc
55 53 cln
56 53 ocn
57 54 oo
''',
    'skill_b': '''
33 83 b
34 83 b
35 83 b
36 83 b
37 83 b
38 83 b
39 83 b
40 83 b
41 72 .......igwlbi.........
42 72 .......igwlbi.....igi.
43 72 .......igwlbi....igwgi
44 72 .......igwlbi..igwwlci
45 72 ......iggwlbi.igwwlci.
46 72 ....iggwlci..igwllci..
47 72 ...igwlcbi...gwlbci...
48 72 .iggwlci....iglbci....
49 72 iggwlci.iglgci........
50 72 igwwlccigglci.........
51 72 igwwlci.ici...........
52 72 cgigwlci.ici..........
53 72 lcgigwci..ici.........
54 72 cggoigci...ici........
55 72 cggo.ici....igi.......
56 72 go....ici...igwgi.....
57 72 go.....ici..igwwlci...
58 72 go......ici.igwwwllci.
59 72 go.......iciigwwwlllbi
60 72 ggo.......igwwwwlllcci
61 72 go........igwwwlllcbbi
62 72 igo........igwwllcbbi.
63 72 igo........igwllcbbi..
64 72 .igo........igwlcbi...
65 72 .igo........iglcbi....
66 72 ..igo........igcbi....
67 72 ...igo.......icbi.....
68 72 ....igo.......ibi.....
69 72 .....igo......ii......
70 72 .....igo..............
71 72 ......igo.............
72 72 ......................
57 94 .
58 94 .
59 94 .
62 94 .
''',
}


def apply_patches(frames):
    for name, literal in PATCHES.items():
        grid = frames[name]
        for entry in literal.strip().splitlines():
            y, x, pixels = entry.split()
            y, x = int(y), int(x)
            if name == 'skill_b' and x == 72:
                assert len(pixels) == 22, (name, y, len(pixels))
            grid[y] = grid[y][:x] + pixels + grid[y][x + len(pixels):]


def save_repair():
    frames = {}
    originals = {}
    checkpoint = ROOT / 'checkpoints' / 'cuff-crystals-before'
    checkpoint.mkdir(exist_ok=True)
    for name in PATCHES:
        path = ROOT / ('poses' if name.startswith('idle') else 'actions') / (name + '.pxgrid')
        original = path.read_text()
        originals[name] = (path, original)
        saved = checkpoint / path.name
        if not saved.exists():
            saved.write_text(original)
        frames[name] = original.splitlines()
    apply_patches(frames)
    for name, grid in frames.items():
        path, original = originals[name]
        changed = sum(a != b for a, b in zip(original.splitlines(), grid))
        path.write_text('\n'.join(grid) + '\n')
        print(name, 'changed rows:', changed)


if __name__ == '__main__':
    save_repair()
