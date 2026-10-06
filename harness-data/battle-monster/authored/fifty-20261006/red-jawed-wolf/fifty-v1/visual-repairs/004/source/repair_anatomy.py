"""Hand-chosen native strings for the three anatomy corrections.

No geometry, frame transforms, automatic filling or palette changes.
The full 64x64 pxgrids remain the delivered source of truth.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

DEAD = [
    # Folded hind thigh, inward hock and short rear toes, behind the near foreleg.
    (14, 52, 'BBMBBSS'),
    (14, 53, 'BMMBBSS'),
    (15, 54, 'BMMBSSK'),
    (16, 55, 'BMBSSK'),
    (16, 56, 'BSSK'),
    (13, 57, 'SBBMMBSKK'),
    (12, 58, 'SBMLMMBBSWK'),
    (12, 59, 'KSSBBBBSSSK'),
    # Shoulder plane follows the folded elbow down and forwards into a short paw.
    (24, 51, 'BMMBS'),
    (24, 52, 'BMBBSS'),
    (24, 53, 'BMBSSK'),
    (23, 54, 'BMBSSK'),
    (23, 55, 'BMBBSSK'),
    (24, 56, 'BMMBBSSK'),
    (25, 57, 'BMMBBSSKK'),
    (26, 58, 'SBBMLMMBBSKKKK'),
    (25, 59, 'KSSBBMMBSWKBSWK'),
]

# The wrapped tail bends around the belly; the dark inner edge stops at fur tips.
# Both breathing frames keep these exact anatomy anchors.
SLEEP_TAIL = [
    (9, 49, 'SSB'),
    (8, 50, 'BSSB'),
    (8, 51, 'MBSSB'),
    (9, 52, 'MBSSB'),
    (10, 53, 'MBBSSBB'),
    (12, 54, 'MBBSSSSBB'),
    (15, 55, 'MBBBSSSSBB'),
    (25, 51, 'SK'),
    (25, 52, 'SBMK'),
    (24, 53, 'BMMBK'),
    (22, 54, 'BMMBSK'),
    (21, 55, 'BMMBSK'),
    (19, 56, 'BMMBBSS'),
    (17, 57, 'MMBBBSS'),
    (15, 58, 'MBBBBSS'),
]

SLEEP_FORELEGS = [
    # Broad upper foreleg under the cheek, a bent wrist, then two overlapping paws.
    (29, 51, 'BMMBBS'),
    (29, 52, 'KBMMBS'),
    (29, 53, 'KBMMBSS'),
    (29, 54, 'KBBMMBSSBBBK'),
    (29, 55, 'SKBBMMBSBMMBWK'),
    (29, 56, 'SSKBBMBSKKKKKK'),
    (29, 57, 'SSBMLMMBBSK'),
    (29, 58, 'KBBMLLMMBBSWK'),
    (29, 59, 'KSSBBBBSSKSSK'),
    # A two-pixel closed lid with blue cheek beneath; keep it separate from the nose.
    (37, 42, 'KKB'),
    (38, 43, 'MB'),
]

EDITS = {
    'poses/dead.pxgrid': DEAD,
    'actions/sleep_a.pxgrid': SLEEP_TAIL + SLEEP_FORELEGS,
    'actions/sleep_b.pxgrid': SLEEP_TAIL + SLEEP_FORELEGS,
}

def apply():
    for relative, patches in EDITS.items():
        path = ROOT / relative
        canvas = [list(row) for row in path.read_text(encoding='ascii').splitlines()]
        for x, y, literal in patches:
            canvas[y][x:x + len(literal)] = literal
        path.write_text('\n'.join(''.join(row) for row in canvas) + '\n', encoding='ascii')

if __name__ == '__main__':
    apply()
