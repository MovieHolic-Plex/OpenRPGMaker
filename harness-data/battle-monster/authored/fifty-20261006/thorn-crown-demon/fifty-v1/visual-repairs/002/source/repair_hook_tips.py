"""Direct fingertip correction after opening the first repair PNG.

Separate three staggered hooked digits with open, authored spaces.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPANS = '''56 67 OSSPPLLLPPPSSOPLLPPSSO.
57 67 .OSPLLLPPPSSO.OSPLPSSO.
58 67 .OSPLLPPLLPPSSO.OSSOO..
59 67 .OSPLLPPLLLPPSSO.......
60 67 ..OSPLLPPLLPPSSOO......
61 67 ..OSPLPPO.SPLPPSSO.....
62 67 ...OSPLPO.OSPLPSSO.....
63 67 ...OSPLPPSSO.OSSO......
64 67 ....OSPLLPSSO..OO......
65 67 .....OSPPSSO...........
66 67 ......OOSSO............'''

if __name__ == '__main__':
    path = ROOT / 'poses/attack.pxgrid'
    rows = [list(row) for row in path.read_text().splitlines()]
    for line in SPANS.splitlines():
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        for offset, symbol in enumerate(pixels):
            rows[y][x + offset] = symbol
    path.write_text('\n'.join(''.join(row) for row in rows) + '\n')
    text = (ROOT / 'authored_rows.txt').read_text()
    before, section = text.split('[attack]\n', 1)
    attack, after = section.split('[recover]\n', 1)
    (ROOT / 'authored_rows.txt').write_text(
        before + '[attack]\n' + attack + SPANS + '\n[recover]\n' + after)
