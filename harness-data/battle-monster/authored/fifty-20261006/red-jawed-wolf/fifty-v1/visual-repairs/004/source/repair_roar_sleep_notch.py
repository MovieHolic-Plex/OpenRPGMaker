"""Explicit native ASCII pixel patches; no shapes or frame transforms.

The delivered pxgrids contain complete literal 64x64 rows.
Coordinates are zero based. All unmentioned pixels are preserved.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

ROAR = [
    # Remove the third competing outer stroke. Retain the rising upper branch.
    (54, 26, '..........'),
    (54, 27, '..........'),
    (54, 28, '..........'),
    # Fangs above a dark mouth. Single hot root starts at x40/y31.
    (37, 29, 'KWWWKKRCOFOOOCCR...........'),
    (37, 30, 'KKKrRCOFOOCCR.............'),
    (37, 31, 'KrCFFOOCCR.................'),
    (37, 32, 'KKrCOFFOCCR................'),
    (37, 33, 'KKKrRCOFFOCCR..............'),
    # Closed dark lower-jaw edge separates red throat from the outgoing roar.
    (34, 34, 'RRrKKKKRCOFFOOCCR.............'),
    (34, 35, 'RCrK....RCOFFOOCCR............'),
    (34, 36, 'CCrK.....RCOFOOOCCR...........'),
    (34, 37, 'CCrK......RCOFOOOCCR..........'),
    (34, 38, 'CCrK.......RCOFOOOCCR.........'),
    (34, 39, 'RrK.........RCOFOOOCCR........'),
    (34, 40, 'rK...........RCOFOOOCCR.......'),
    (39, 41, '.........RCOFOOOCCR......'),
    (39, 42, '..........RCOFOOOCCR.....'),
    (39, 43, '............RCOFOOOCCR...'),
    (39, 44, '..............RCOFOOCCR..'),
    (39, 45, '................RCOCCR...'),
    (39, 46, '..................RCR....'),
]

# Both frames share the same curved haunch and curled tail, without moving
# the head, closed lid, folded forelegs, paws, or baseline.
HAUNCH = [
    (8, 33, '...KKMLLMMMMBBBBBBBBBBBSS'),
    (8, 34, '.KKMLLLLMMMMBBBBBBBBBBBSS'),
    (6, 35, '..KMLLHLLMMMMBBBBBBBSBBSS'),
    (6, 36, '.KMLLLMMMMMBBBBBBBBBSSBSS'),
    (6, 37, 'KMLLMMMMBBBBBBBBBBBBSSBSS'),
    (6, 38, 'KMLMMMBBBBBBBBBBBBBBSSBSS'),
    (6, 39, 'KMLMMBBBBBBBBBBBBBBSSBBSS'),
    (6, 40, 'KMMMBBBBBBBBBBBBBBBSSBBSS'),
    (6, 41, 'KMMBBBBBBBBBBBBBBBSSBBBSS'),
    (6, 42, '.KMMBBBBBBBBBBBBBSSBBBBSS'),
    (6, 43, '.KMMBBBBBBBBBBBBSSBBBBBSS'),
    (6, 44, 'KBBMMBBBBBBBBBBSSBBBBBBSS'),
    (6, 45, 'KBBMMBBBBBBBBBSSBBBBBBBSS'),
    (5, 46, 'KMBMMBBBBBBBBSSBBBBBBBSSS'),
    (5, 47, 'KMBMMBBBBBBBSSBBBBBBBBSSS'),
    (4, 48, 'KMBBMMBBBBSSSBBBBBBBSSSSS'),
    # A tucked hind hock below the haunch, with separate short toes.
    (8, 49, 'BSSBBMMBBSSSSBBBBSSSS'),
    (9, 50, 'BSSBMLMMBSSWKSBBBSSS'),
    (10, 51, 'BSSBBBBSSKKKSSBBSSS'),
    (11, 52, 'BBSSSSSSSSSSBBBSSS'),
]

TAIL = [
    # Tail flows around the belly, not along the whole diagonal back.
    (3, 50, 'KMLMMB'),
    (3, 51, 'KMLLMMB'),
    (2, 52, 'KMLLLMMBB'),
    (2, 53, 'KMLLMMMBBSSSSSSSSSBBMMBSSK'),
    (2, 54, 'KMLMMMMMBBSSSSSSBBMMLMBSK'),
    (3, 55, 'KMMMMMMMMBBSSBBMMMLMMBSK'),
    (4, 56, 'KMMMMMMMMBBBBMMMLMMBSSK'),
    (5, 57, 'KMMBBBBBBBBBMMBMMBBSSK'),
    (6, 58, 'KBBBBBBBBBBBBBBBBSSSSK'),
    (7, 59, 'KSSSSSSSSSSSSSSSSSSSK'),
]

EDITS = {
    'poses/idle_a.pxgrid': [(17, 31, 'K'), (16, 32, 'K'), (16, 33, 'K')],
    'poses/idle_b.pxgrid': [(17, 30, 'K')],
    'poses/idle_c.pxgrid': [(17, 31, 'K'), (16, 32, 'K'), (16, 33, 'K')],
    'actions/skill_b.pxgrid': ROAR,
    'actions/sleep_a.pxgrid': HAUNCH + TAIL,
    'actions/sleep_b.pxgrid': HAUNCH + TAIL,
}

def apply():
    for relative, patches in EDITS.items():
        path = ROOT / relative
        rows = [list(row) for row in path.read_text(encoding='ascii').splitlines()]
        for x, y, pixels in patches:
            if x + len(pixels) > 64:
                raise ValueError((relative, x, y, len(pixels)))
            rows[y][x:x + len(pixels)] = pixels
        path.write_text('\n'.join(''.join(row) for row in rows) + '\n', encoding='ascii')

if __name__ == '__main__':
    apply()
