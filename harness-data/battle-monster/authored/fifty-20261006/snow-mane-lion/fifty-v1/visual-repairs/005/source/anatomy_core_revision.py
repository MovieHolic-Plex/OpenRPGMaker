"""Apply explicitly authored, pose-specific ASCII runs; no generated anatomy."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
SNAP = ROOT / 'before-anatomy-core-repair'
# Every line is y, x, literal replacement pixels. Coordinates are native 0-based.
RUNS = {
 'idle_a': '''
88 96 mddso
89 95 mmbddso
90 94 dmmbbddso
91 94 dmmbbddso
92 94 dmbbbbddso
93 94 dmbbbbddso
94 94 dmbbbbddso
95 92 osdmbbbbddso..
96 93 sdmbbbbbddso
97 93 sddbbbbbbddso
''',
 'idle_b': '''
88 96 mddso
89 95 mmbddso
90 94 dmmbbddso
91 94 dmmbbddso
92 94 dmbbbbddso
93 94 dmbbbbddso
94 94 dmbbbdddso
95 92 osdmbbbbddso..
96 93 sdmbbbbbddso
97 93 sddbbbbbbddso
''',
 'idle_c': '''
88 96 mddso
89 95 mmbddso
90 94 dmmbbddso
91 94 dmmbbddso
92 94 dmbbbbddso
93 94 dmbbbdddso
94 94 dmbbbbddso
95 92 osdmbbbbddso..
96 93 sdmmbbbbddso
97 93 sddbbbbbbddso
''',
 'skill_a': '''
89 99 ddso
90 94 dmmbbddso
91 94 dmmbbddso
92 94 dmbbbbddso
93 94 dmbbbbddso
94 94 dmbbbbddso
95 92 osdmbbbbddso..
96 92 osdmbbbbddso..
97 92 osddbbbbddso..
48 66 wmbddmwwwwww
49 66 mbdsTTsdmwww
50 66 bdTCCCTsdmww
51 66 dsTCiiiCsdmw
52 66 dsTCiiiCsdmw
53 66 mdTCiiCTsdmw
54 66 bdsTCCTsdmww
55 66 mbdsTTsdmwww
56 66 dmbdsddmwwww
57 67 dmdmbmwwwww
''',
 'skill_c': '''
88 96 mddso
89 95 mmbddso
90 94 dmmbbddso
91 94 dmmbbddso
92 94 dmbbbbddso
93 94 dmbbbdddso
94 94 dmbbbbddso
95 92 osdmbbbbddso..
96 92 osdmbbbbddso..
97 92 osddbbbbddso..
''',
 'stun_a': '''
92 95 dmbbbbddso..
93 94 dmbbbbbddso..
94 93 sdmbbbbbddso...
95 92 osdmbbbbbddso..
96 92 osddmbbbbddso..
97 92 osddbbbbddso...
98 92 osddbbbbddso...
93 107 .
94 108 .
''',
 'stun_b': '''
92 95 ddmbbbbddso..
93 94 ddmbbbbbddso..
94 93 sddmbbbbbddso...
95 92 osddmbbbbddso..
96 92 osddmbbbbddso..
97 92 osddbbbbddso...
98 92 osddbbbbddso...
93 108 .
94 109 .
''',
 'sleep_a': '''
110 49 wwwbbdddddd
111 49 wwwbbmddddd
112 49 wwwwbbmdddd
113 49 wwwwbbmdddd
114 49 wwwbbmmdddddssso..
115 49 wwbbmmddddddso....
116 49 wbbmmddddddso.....
117 49 bmdddddddsso......
118 49 mddddsssso........
119 49 mddssbbmdso.......
120 49 ddsmwwbbmdso......
121 49 dsmwhwwwbbmdso....
122 49 smwhhwwwwbbddso...
123 49 sbbwbowwbohbdso...
124 49 .ooooooooooooo....
''',
 'sleep_b': '''
110 49 wwwbbdddddd
111 49 wwwbbmddddd
112 49 wwwwbbmddddd
113 49 wwwwbbmddddd
114 49 wwwbbmmmddddssso..
115 49 wwbbmmmdddddso....
116 49 wbbmmmdddddso.....
117 49 bmdddddddsso......
118 49 mddddsssso........
119 49 mddssbbmdso.......
120 49 ddsmwwbbmdso......
121 49 dsmwhwwwbbmdso....
122 49 smwhhwwwwbbddso...
123 49 sbbwbowwbohbdso...
124 49 .ooooooooooooo....
''',
}

if __name__ == '__main__':
    symbols = set(json.loads((ROOT / 'palette.json').read_text())) | {'.'}
    for name, literal in RUNS.items():
        folder = 'poses' if (SNAP / 'poses' / (name + '.pxgrid')).exists() else 'actions'
        rows = [list(r) for r in (SNAP / folder / (name + '.pxgrid')).read_text().splitlines()]
        for line in literal.strip().splitlines():
            y, x, pixels = line.split()
            y, x = int(y), int(x)
            assert set(pixels) <= symbols and 0 <= x and x + len(pixels) <= 128
            rows[y][x:x + len(pixels)] = pixels
        (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(''.join(r) for r in rows) + '\n')
        (ROOT / 'repairs' / ('anatomy-core-' + name + '.runs')).write_text(literal.strip() + '\n')
        print(name, 'literal coordinate edits saved')
