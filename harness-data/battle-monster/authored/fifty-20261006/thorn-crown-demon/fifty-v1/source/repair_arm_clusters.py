"""Explicit, pose-specific native pixel spans for the two review observations.

Only the named row strings are written. No frame transforms or shape tools.
The pre-repair originals are preserved separately in before-arm-repair/.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Each line is native y, native x, literal palette symbols.
PATCHES = {
    'idle_a': '''44 56 DSPPSS
45 56 DSPPPS
46 55 DSPPPS
47 55 DSPPPS
48 54 DSPPPS
49 54 DSPPPS
50 53 DSPPPS
51 53 DSPPSS
52 53 DSPPSS
53 53 DSPPSS
54 53 DSPPSS
55 52 DSPPPSS
56 52 DSPPLPS
57 53 DSPPLPS
58 54 DSPPPS
59 55 DSPPPS
60 55 DSPPPS
61 56 DSPPPS
62 56 DSPPPS
63 56 DSPPPS
64 55 SPPPS
65 56 SPPPS
66 58 SPPS
67 58 SPPS
68 56 SPPLPSS''',
    'idle_b': '''44 57 DSPPSS
45 57 DSPPPS
46 56 DSPPPS
47 56 DSPPPS
48 55 DSPPPS
49 55 DSPPPS
50 54 DSPPPS
51 54 DSPPSS
52 54 DSPPSS
53 54 DSPPSS
54 54 DSPPSS
55 53 DSPPPSS
56 53 DSPPLPS
57 54 DSPPLPS
58 55 DSPPPS
59 56 DSPPPS
60 56 DSPPPS
61 57 DSPPPS
62 57 DSPPPS
63 57 DSPPPS
64 56 SPPPS
65 57 SPPPS
66 59 SPPS
67 59 SPPS
68 57 SPPLPSS''',
    'idle_c': '''45 55 DSPPSS
46 55 DSPPPS
47 54 DSPPPS
48 54 DSPPPS
49 53 DSPPPS
50 53 DSPPPS
51 52 DSPPPS
52 52 DSPPSS
53 52 DSPPSS
54 52 DSPPSS
55 52 DSPPSS
56 51 DSPPPSS
57 51 DSPPLPS
58 52 DSPPLPS
59 53 DSPPPS
60 54 DSPPPS
61 54 DSPPPS
62 55 DSPPPS
63 55 DSPPPS
64 54 SPPPS
65 55 SPPPS
66 57 SPPS
67 58 SPPS
68 56 SPPLPSS''',
    'attack': '''49 65 LLPPPPSS
50 65 LLLPPPPSS
51 65 LLPPLPPPPSS
52 65 PP
52 67 PPPPPPLLLLPPSSOO.......
53 65 PP
53 67 PPPLLLLLLLPPSSOO.......
54 65 PP
54 67 SSPPLLLLLLPPPPPSSOO....
55 65 SS
55 67 DDSSPPLLLPPPPPLLLPSSOO.
56 67 OSSPPLLPPOOSPLPPPSSOO..
57 67 .OSPLLPPSO.OSPLPPPSSO..
58 67 .OSPLLPPSO.OSPLPSSO...
59 67 .OSPLLPPLPSSOOOPSSO...
60 67 ..OSPLLLPPPSSOO.OO....
61 67 ...OSPLPPPPSSO........
62 67 ....OSPLPSSSO.........
63 67 .....OOSSSO...........''',
}

def apply():
    text = (ROOT / 'authored_rows.txt').read_text()
    sections = {}
    order = []
    current = None
    for line in text.splitlines():
        if line.startswith('['):
            current = line[1:-1]
            order.append(current)
            sections[current] = []
        elif current and line and not line.startswith('#'):
            sections[current].append(line)
    for name, block in PATCHES.items():
        path = ROOT / 'poses' / (name + '.pxgrid')
        rows = [list(row) for row in path.read_text().splitlines()]
        for line in block.splitlines():
            y, x, symbols = line.split()
            y, x = int(y), int(x)
            for offset, symbol in enumerate(symbols):
                rows[y][x + offset] = symbol
        path.write_text('\n'.join(''.join(row) for row in rows) + '\n')
        # Preserve the original spans and append only these authored corrections.
        sections[name].extend(block.splitlines())
    (ROOT / 'authored_rows.txt').write_text(
        '# Explicit native row spans; arm review corrections appended per pose.\n'
        + ''.join('[' + name + ']\n' + '\n'.join(sections[name]) + '\n'
                  for name in order))

if __name__ == '__main__':
    apply()
