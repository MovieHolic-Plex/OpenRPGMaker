"""Explicit native pixel strings, selected individually for each existing pose.

Each entry is y, x, literal replacement. No geometry, generated shading,
frame transforms, pixel propagation, tracing or automatic filling.
Outputs are complete ASCII rows; the pre-edit grids are preserved separately.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
BASE = ROOT / 'revisions/before-anatomy-leaf'

PATCHES = {
    'poses/hit': '''
24 37 oo
25 35 olhjo
26 35 oljlljgo
27 35 olsoo.ogso
28 36 oo...ogjso
29 37 o...ogjgso
30 35 oljjjjjgso
31 32 oljjgggsooo
32 30 jjlljgso
33 31 ojgso
49 18 jg
50 19 jg
51 20 jg
52 20 jg
53 20 jg
54 20 jg
55 20 jg
52 28 jj
53 29 jj
54 30 jj
55 31 jj
56 31 jj
57 31 jj
51 9 jj
52 8 jj
54 9 j
55 10 j
56 11 j
57 12 j
''',
    'actions/skill_b': '''
18 62 c
19 59 tccc
20 57 tcwwlc
21 56 cwwllct
22 55 cwjcct
23 55 cct
35 57 tcc
36 55 ccwwct
37 56 cwwllct
38 56 .tcwllc
39 58 .tccw
40 60 .tc
48 12 jg
49 13 jg
50 14 jg
51 15 jg
52 16 jg
53 17 jg
54 18 jg
55 19 jg
56 20 jg
50 32 jj
51 32 jj
52 33 jj
53 33 jj
54 33 jj
55 33 jj
56 33 jj
49 7 jj
50 6 jj
51 5 jj
52 5 j
54 7 j
55 8 j
56 9 j
57 10 j
''',
    'poses/idle_a': '''
49 18 jg
50 19 jg
51 20 jg
52 20 jg
53 20 jg
54 20 jg
55 20 jg
56 19 jg
57 19 jj
51 28 jj
52 28 jj
53 29 jj
54 30 jj
55 31 jj
56 31 jj
57 31 jj
51 9 jj
52 8 jj
54 9 j
55 10 j
56 11 j
57 12 j
58 12 j
''',
    'poses/idle_b': '''
49 18 jg
50 19 jg
51 20 jg
52 20 jg
53 20 jg
54 20 jg
55 20 jg
56 19 jg
57 19 jj
51 28 jj
52 28 jj
53 29 jj
54 30 jj
55 31 jj
56 31 jj
57 31 jj
51 9 jj
52 8 jj
54 9 j
55 10 j
56 11 j
57 12 j
58 12 j
''',
    'poses/idle_c': '''
49 18 jg
50 19 jg
51 20 jg
52 20 jg
53 20 jg
54 20 jg
55 20 jg
56 19 jg
57 19 jj
51 28 jj
52 28 jj
53 29 jj
54 30 jj
55 31 jj
56 31 jj
57 31 jj
51 9 jj
52 8 jj
54 9 j
55 10 j
56 11 j
57 12 j
58 12 j
''',
    'poses/windup': '''
48 20 jg
49 21 jg
50 21 jg
51 21 jg
52 21 jg
53 21 jg
54 20 jg
55 20 jj
51 26 jj
52 27 jj
53 28 jj
54 29 jj
55 30 jj
56 30 jj
57 30 jj
50 9 jj
51 8 jj
52 7 jj
54 8 j
55 9 j
56 10 j
57 11 j
58 11 j
''',
    'poses/move': '''
48 12 jg
49 13 jg
50 14 jg
51 15 jg
52 16 jg
53 17 jg
54 18 jg
55 19 jg
56 20 jj
50 29 jj
51 30 jj
52 30 jj
53 31 jj
54 33 jj
55 33 jj
56 33 jj
50 6 jj
51 5 jj
52 4 jj
54 5 j
55 6 j
56 7 j
57 8 j
58 9 j
''',
    'poses/attack': '''
48 13 jg
49 14 jg
50 15 jg
51 16 jg
52 17 jg
53 18 jg
54 19 jg
55 20 jg
56 21 jj
50 30 jj
51 31 jj
52 32 jj
53 33 jj
54 35 jj
55 36 jj
56 36 jj
50 7 jj
51 6 jj
52 5 jj
54 6 j
55 7 j
56 8 j
57 9 j
58 10 j
''',
    'poses/recover': '''
49 19 jg
50 20 jg
51 21 jg
52 21 jg
53 21 jg
54 21 jg
55 21 jg
56 20 jg
57 20 jj
51 29 jj
52 29 jj
53 30 jj
54 31 jj
55 32 jj
56 32 jj
57 32 jj
51 10 jj
52 9 jj
54 10 j
55 11 j
56 12 j
57 13 j
58 13 j
''',
    'actions/skill_a': '''
48 19 jg
49 20 jg
50 21 jg
51 21 jg
52 21 jg
53 21 jg
54 21 jg
55 20 jg
56 20 jj
50 28 jj
51 29 jj
52 29 jj
53 29 jj
54 30 jj
55 31 jj
56 31 jj
50 10 jj
51 9 jj
52 8 jj
54 9 j
55 10 j
56 11 j
57 12 j
58 12 j
''',
    'actions/skill_c': '''
49 18 jg
50 19 jg
51 20 jg
52 20 jg
53 20 jg
54 20 jg
55 20 jg
56 19 jg
57 19 jj
51 28 jj
52 28 jj
53 29 jj
54 30 jj
55 31 jj
56 31 jj
57 31 jj
51 9 jj
52 8 jj
54 9 j
55 10 j
56 11 j
57 12 j
58 12 j
''',
    'actions/poison_a': '''
49 19 jg
50 20 jg
51 21 jg
52 21 jg
53 21 jg
54 21 jg
55 21 jg
56 20 jg
57 20 jj
51 28 jj
52 29 jj
53 30 jj
54 31 jj
55 32 jj
56 32 jj
57 32 jj
51 10 jj
52 9 jj
54 10 j
55 11 j
56 12 j
57 13 j
58 13 j
''',
    'actions/poison_b': '''
49 19 jg
50 20 jg
51 21 jg
52 21 jg
53 21 jg
54 21 jg
55 21 jg
56 20 jg
57 20 jj
51 28 jj
52 29 jj
53 30 jj
54 31 jj
55 32 jj
56 32 jj
57 32 jj
51 10 jj
52 9 jj
54 10 j
55 11 j
56 12 j
57 13 j
58 13 j
''',
    'actions/stun_a': '''
49 19 jg
50 20 jg
51 21 jg
52 21 jg
53 21 jg
54 21 jg
55 21 jg
56 20 jg
57 20 jj
52 31 jj
53 32 jj
54 32 jj
55 33 jj
56 33 jj
57 33 jj
58 32 jj
51 10 jj
52 9 jj
54 10 j
55 11 j
56 12 j
57 13 j
58 13 j
''',
    'actions/stun_b': '''
49 19 jg
50 20 jg
51 21 jg
52 21 jg
53 21 jg
54 21 jg
55 21 jg
56 20 jg
57 20 jj
52 31 jj
53 32 jj
54 32 jj
55 33 jj
56 33 jj
57 33 jj
58 32 jj
51 10 jj
52 9 jj
54 10 j
55 11 j
56 12 j
57 13 j
58 13 j
''',
    'actions/sleep_a': '''
55 17 gg
56 17 jg
57 18 jg
58 20 jj
56 9 jj
57 9 jg
58 10 j
58 13 jj
58 15 j
59 18 jj
59 30 jj
56 33 jg
58 33 jg
59 33 jg
''',
    'actions/sleep_b': '''
55 17 gg
56 17 jg
57 18 jg
58 20 jj
56 9 jj
57 9 jg
58 10 j
58 13 jj
58 15 j
59 18 jj
59 30 jj
56 33 jg
58 33 jg
59 33 jg
''',
}

records = {}
for name, text in PATCHES.items():
    original = (BASE / (name + '.pxgrid')).read_text(encoding='ascii').splitlines()
    rows = [list(row) for row in original]
    for entry in text.splitlines():
        if not entry.strip():
            continue
        y_text, x_text, pixels = entry.split()
        y, x = int(y_text), int(x_text)
        rows[y][x:x + len(pixels)] = list(pixels)
    final = [''.join(row) for row in rows]
    (ROOT / (name + '.pxgrid')).write_text('\n'.join(final) + '\n', encoding='ascii')
    records[name] = sum(a != b for old, new in zip(original, final)
                        for a, b in zip(old, new))

(ROOT / 'preview/anatomy-leaf-changes.json').write_text(
    json.dumps({'description': 'Actual source pixel differences; no verdict.',
                'pixelsChangedFromPreservedDraft': records}, indent=2) + '\n')
print(json.dumps(records, indent=2))
