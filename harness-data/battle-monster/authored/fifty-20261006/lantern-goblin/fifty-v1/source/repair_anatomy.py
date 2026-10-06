"""Hand-chosen native clusters for the five supplied rework observations.

Coordinates are zero-based. Each tuple is (x, y, literal palette symbols).
No geometry synthesis, frame transforms, inferred shading or hole filling.
Apply after the earlier grip/outlet corrections in repair_pixels.py.
"""
from pathlib import Path

PATCHES = {
    'actions/sleep_a.pxgrid': [
        # Upper-arm highlight rolls into a bent red elbow. The black edge
        # follows its exterior; the forearm interior meets actual skin.
        (53, 75, 'LSRK'),
        (53, 76, 'LSSRK'),
        (53, 77, 'LSSSLLSSK'),
        (53, 78, 'SSRSKLLSSK'),
        (54, 79, 'KRRKKLLSSK'),
        (54, 80, 'KKKK'),
    ],
    'actions/sleep_b.pxgrid': [
        # Same elbow anatomy at rest, with the existing shoulder/hand breath.
        (53, 75, 'LSRK'),
        (53, 76, 'LSSRK'),
        (53, 77, 'LSSSLLSSK'),
        (53, 78, 'SSRSKLLSSK'),
        (54, 79, 'KRRKKLLSSK'),
        (54, 80, 'KKKK'),
        # Gold fastening stays gold in both cels, including its dark borders.
        (43, 75, 'YK'),
        (43, 76, 'YK'),
        (42, 77, 'KYK'),
        # Small chest expansion: widen the connected blue highlight from
        # x39 into x40. Keep the original raised shoulder and folded hand.
        (39, 73, 'BBN'),
        (39, 74, 'BBN'),
        (39, 75, 'BBN'),
    ],
    'poses/dead.pxgrid': [
        # Trouser hip shows above the foreground lantern, then bends down
        # its right edge. Warm brown cloth joins the red calf and bare heel.
        (63, 79, 'KKK'),
        (63, 80, 'VUTTK'),
        (63, 81, 'VUTTTTDK'),
        (69, 82, 'TTTDK'),
        (70, 83, 'TTTDK'),
        (70, 84, 'UTTDK'),
        (71, 85, 'TTDSK'),
        (71, 86, 'TDLLL'),
        (71, 87, 'DLLL'),
        (71, 88, 'RSSS'),
        (71, 89, 'KRSS'),
        (71, 90, 'KRSS'),
    ],
    'actions/skill_b.pxgrid': [
        # A distinct gold/dark upper lip caps a two-row luminous mouth.
        # The bail's right post x73 and the gripping hand remain intact.
        (74, 48, 'KGKK'),
        (72, 49, 'GGYWWFW'),
        (69, 50, 'GYFWWWWFFWW'),
        # Lower lip closes the paper shell below the mouth; the existing
        # air gap at x77 and the three rightward branches remain authored.
        (73, 51, 'GGTK.OF'),
    ],
}


def patch_rows(rows, changes):
    for x, y, pixels in changes:
        for dx, symbol in enumerate(pixels):
            rows[y][x + dx] = symbol


if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    for relative, changes in PATCHES.items():
        path = root / relative
        rows = [list(row) for row in path.read_text().splitlines()]
        patch_rows(rows, changes)
        path.write_text('\n'.join(''.join(row) for row in rows) + '\n')
        print('Wrote literal anatomy/emission clusters:', relative)
