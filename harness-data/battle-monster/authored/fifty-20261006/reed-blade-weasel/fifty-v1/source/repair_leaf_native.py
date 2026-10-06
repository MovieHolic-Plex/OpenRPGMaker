"""Apply explicitly authored ASCII clusters to the preserved incoming draft.
No body transforms, geometry, automatic shading, or connectivity repair.
Coordinates are zero based. Final files contain complete literal 64px rows.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCHES = {
    'poses/windup.pxgrid': '''
29 25 g
30 25 glg
31 26 ghllg
32 26 glhllg
33 27 glhllg
34 28 glhllg
35 29 glhllg
36 30 glhllg
37 31 glhllg
38 32 glhlg
39 33 glhlg
40 33 glhlg
41 34 glhg
42 35 glg
43 41 OttbbO
43 35 glg
44 38 OttttbbO
44 36 g
45 36 OetttbsO
46 36 ObbssOO
53 44 O
54 43 ...
55 43 .....
56 43 ......
57 43 ......
58 43 .....
59 42 ...
60 42 ..
''',
    'poses/attack.pxgrid': '''
42 62 g
43 59 .ghg
44 48 tbbO.....glhllg
45 46 bttbO...glhhlllg
46 46 Otttbgglhlllg
47 45 Otttggllgg....
48 46 ObttO...........
49 57 ......
50 56 .......
51 55 .......
52 54 .......
53 53 .......
54 53 ......
55 54 .....
56 55 ....
57 56 ..
''',
    'actions/skill_b.pxgrid': '''
35 56 .v
36 56 ..v
37 56 ...gv
38 56 ..glgv
39 56 .glhlgv
40 55 .glhllgv
41 55 glhllg.v
42 55 glhlg..v
43 52 ..glhg....v
44 51 ..glg......v
45 48 ttttgg.......v.
46 45 tttttO........vc.
''',
}

def main():
    for relative, data in PATCHES.items():
        rows = [list(row) for row in
                (ROOT / 'before-leaf-repair' / relative).read_text().splitlines()]
        for record in data.strip().splitlines():
            sy, sx, run = record.split()
            y, x = int(sy), int(sx)
            rows[y][x:x + len(run)] = list(run)
        (ROOT / relative).write_text('\n'.join(''.join(row) for row in rows) + '\n')

if __name__ == '__main__':
    main()
