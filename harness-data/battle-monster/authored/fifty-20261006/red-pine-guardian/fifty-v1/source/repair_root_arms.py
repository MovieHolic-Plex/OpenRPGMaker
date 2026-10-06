"""Chosen ASCII rows: bent lifted root, two folded sleeping branch arms.

No geometry generator, frame transforms, shading synthesis or automatic fill.
Sleep records replace complete rows; move records overwrite literal short runs.
Canonical deliverables remain the full 96 x 96 .pxgrid files.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

MOVE = '''
79 40 krrrssssrrrbbko..............
80 40 okrrssrrrbbko...............
81 40 .okrrssrrbbko...............
82 40 ..okrrssrrbko...............
83 40 ...okrrssrrbko..............
84 40 ....okrrssrrssrrbko.........
85 40 .....okrrsshhssrrssrbko.....
86 40 ......okrrssrrbbkrrssrrbko..
87 40 .......okrrbko..okrrsbko....
88 40 ........okkko.....okko......
89 40 ...........................
90 40 ...........................
91 40 ...........................
'''

SLEEP_A = '''
58 39 orshhssrrrbbbbko
59 37 okrrshhssrrrbbkkrrbko
60 35 okrrsshhssrrrbbkkrrssrbko
61 33 okrrssrrkshhssrrbbkrrsshsrbko
62 32 orssrrbbkshhssrrbbkrrsshhssrbko
63 31 orssrbko.orshssrrbbko.orsshhssrbko
64 30 orssrbko..orshssrrbbko..orshhssrbko
65 29 orssrbko...orshssrrbbko...orshssrbko
66 28 orssrbko....orshssrrbbko...orshssrbko
67 28 orshssrbko..orshssrrbbko..orshssrbko
68 29 orshhssrbko.orshssrrbbko.orshssrbko
69 30 orsshhssrbkorshssrrbbkokrshhssrbko
70 31 okrrsshhssrbkkrrrbbkkrrshhssrbko
71 33 okrrsshhssrrbkrrbbkkrrshhssrbko
72 35 okrrssrssrrbkkbbkkrrssshsrbko
73 36 okrrssrrbkrrrbbkkrrssrbko
74 35 okrrbbkkkrrrbbkkrrbbkkko
75 33 okrrssrrrbbrrrrrbbrrrrbbko
76 31 okrrssrrbbrrrrrbbbrrrssrrbko
77 29 okrrssrrbbrrrbbbbrrrsshhssrbko
78 28 orsshssrrbbrrrrbbrrrsshhssrrbko
79 27 orsshssrrbbbkkkbbkkrrsshhssrrbko
80 28 okrrssrrrbbkkrrsshhssrrbbko
81 29 orsshssrrrbbbkkrrsshhssrrrbbo
82 28 orshhssrrrbbbko.krrsshhssrrbbbo
83 28 orshssrrrbbko...okrrsshhssrrbbbo
84 29 orsshssrrbko.....okrrsshhssrrbbko
85 30 orsshssrrbko.......okrrsshhssrbko
86 29 okrrsssssrbko......okrrshhssrbko
87 27 okrrsssssrrbko......orshhssrbko
88 25 okrrsshhssrrrbko......orshhssrbko
89 23 okrrsshhssrrrrbko......orshhssrrbkoo
90 21 okrrshhssrrsrrbbko.....okrrsshhssrrrbkoo
91 20 orsshsrrbsrrrbbbko.....orsssrrbrrrssrrbko
92 21 ookkkkkkkkkkkkkko.....ookkkkkkkkkkkkkko
'''

SLEEP_B = '''
58 38 orshhhssrrrrbbbbko
59 37 okrrshhhssrrrbbkkrrbko
60 35 okrrsshhhssrrrbbkkrrssrbko
61 33 okrrssrrkshhhssrbbkrrsshsrbko
62 32 orssrrbbkshhhssrbbkrrsshhssrbko
63 31 orssrbko.orshhssrbbko.orsshhssrbko
64 30 orssrbko..orshhssrbbko..orshhssrbko
65 29 orssrbko...orshhssrbbko...orshssrbko
66 28 orssrbko....orshhssrbbko...orshssrbko
67 28 orshssrbko..orshhssrbbko..orshssrbko
68 29 orshhssrbko.orshhssrbbko.orshssrbko
69 30 orsshhssrbkorshhssrbbkokrshhssrbko
70 31 okrrsshhssrbkkrrrbbkkrrshhssrbko
71 33 okrrsshhssrrbkrrbbkkrrshhssrbko
72 35 okrrssrssrrbkkbbkkrrssshsrbko
73 36 okrrssrrbkrrrbbkkrrssrbko
74 35 okrrbbkkkrrrbbkkrrbbkkko
75 33 okrrssrrrbbrrrrrbbrrrrbbko
76 31 okrrssrrbbrrrrrbbbrrrssrrbko
77 29 okrrssrrbbrrrbbbbrrrsshhssrbko
78 28 orsshssrrbbrrrrbbrrrsshhssrrbko
79 27 orsshssrrbbbkkkbbkkrrsshhssrrbko
80 28 okrrssrrrbbkkrrsshhssrrbbko
81 29 orsshssrrrbbbkkrrsshhssrrrbbo
82 28 orshhssrrrbbbko.krrsshhssrrbbbo
83 28 orshssrrrbbko...okrrsshhssrrbbbo
84 29 orsshssrrbko.....okrrsshhssrrbbko
85 30 orsshssrrbko.......okrrsshhssrbko
86 29 okrrsssssrbko......okrrshhssrbko
87 27 okrrsssssrrbko......orshhssrbko
88 25 okrrsshhssrrrbko......orshhssrbko
89 23 okrrsshhssrrrrbko......orshhssrrbkoo
90 21 okrrshhssrrsrrbbko.....okrrsshhssrrrbkoo
91 20 orsshsrrbsrrrbbbko.....orsssrrbrrrssrrbko
92 21 ookkkkkkkkkkkkkko.....ookkkkkkkkkkkkkko
'''


def apply(selected=None):
    records = [('poses', 'move', MOVE, False),
               ('actions', 'sleep_a', SLEEP_A, True),
               ('actions', 'sleep_b', SLEEP_B, True)]
    for group, name, block, full_row in records:
        if selected is not None and name not in selected:
            continue
        path = ROOT / group / (name + '.pxgrid')
        rows = path.read_text(encoding='ascii').splitlines()
        for record in block.strip().splitlines():
            ys, xs, pixels = record.split()
            y, x = int(ys), int(xs)
            if full_row:
                rows[y] = '.' * x + pixels + '.' * (96 - x - len(pixels))
            else:
                rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
        path.write_text('\n'.join(rows) + '\n', encoding='ascii')


if __name__ == '__main__':
    apply()
