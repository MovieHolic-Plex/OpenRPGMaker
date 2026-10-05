"""Explicit final grip/effect repairs to the recovered original skill grids."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def patch(name, runs):
    path = ROOT / 'actions' / (name + '.pxgrid')
    rows = [list(row) for row in path.read_text().splitlines()]
    for line in runs.strip().splitlines():
        x, y, pixels = line.split()
        x, y = int(x), int(y)
        rows[y][x:x + len(pixels)] = list(pixels)
    path.write_text('\n'.join(''.join(row) for row in rows) + '\n')


# The offhand knife now rises from its real guard into the charged knot.
# Clear the abandoned downward extra blade, retaining the torso and hands.
patch('skill_a', '''
41 39 ............
40 40 ............
40 41 ............
40 42 ............
40 43 ............
40 44 ............
40 45 ............
45 37 KVV
46 36 KVV
47 35 KVVPQP
48 34 KVQWQ
49 33 PQWP
50 32 PP
19 57 OHHJJHHO
19 58 OHHHHHHO
19 59 OHOOOOOO
31 58 OHJJHHHO
31 59 OHOOOOOO
19 60 OOOOOOOO
31 60 OOOOOOOO
''')


# Restore the face that a recovered turquoise tail overlapped. Both tails
# are now outside the face, connected to the outer ends of the short cuts.
# Keep the low dash, both wrists, folds, braid and soles of the original.
patch('skill_b', '''
30 24 OHHHHHTUUUUUUUUUTO
31 25 OHHHHTUUUVOUUVOUTO
31 26 OHHHHTUUUTTUUTTTTO
31 27 OHHHHTUUUTTUUTTTTO
30 28 OHJHHHTTTTUUUTTTSO
28 29 OHJHHHOSDEEEFFETTSO
26 30 OHJHHO..DEEEFFFEESO
48 25 ...............
48 26 ...............
48 27 ...............
48 28 ...............
47 29 ................
46 30 .................
46 31 .................
45 32 ..................
44 33 ...................
43 34 ....................
42 35 .....................
44 36 ...................
46 37 .................
47 38 ................
46 39 .................
45 40 ..................
42 41 .....................
43 42 ....................
43 43 ....................
43 44 ....................
43 45 ....................
43 46 ....................
42 47 .....................
40 48 .......................
39 49 ........................
38 50 .........................
57 25 Q
56 26 PQ
55 27 PWQ
54 28 PWVQ
53 29 PVWVQ
52 30 PQWVQ
51 31 PQWVQ
50 32 PQWVQ
49 33 PQWVQ
48 34 PVWVQ
47 35 OVWK
44 36 OVWKVVQ
46 37 KVWWQP
47 38 OKVWWQP
44 39 KVV.QWWQP
41 40 OVWK..PQWWQP
44 41 .......PQWVQP
45 42 ........PWVQP
46 43 ........PWQP
47 44 ........PQP
48 45 ........PQ
49 46 ........Q
58 27 GI
59 28 FI
60 29 FI
60 30 GI
59 31 GI
57 32 FGI
55 33 FGI
54 34 GI
58 44 GI
58 45 FGI
57 46 FGI
55 47 FGI
53 48 GI
52 47 I
''')
