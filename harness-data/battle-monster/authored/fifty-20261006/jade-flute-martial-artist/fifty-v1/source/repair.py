"""Explicit review repair spans, in native zero-based (y, x, pixels).

Only the three cited action grids are touched. No generated silhouettes or
frame transforms. Final deliverables remain full literal 64x64 ASCII grids.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

REPAIRS = {
    # Restore the old interior mouth to skin; shade the lips at the jade inlet.
    'skill_a': [(23, 36, 'ssSSH')],
    'skill_b': [(23, 34, 'ssSSH')],
    # A nod/exhalation: recut crown, tilt front eyelid/nose, lower the chin,
    # compress the neckline, relax the shoulder and widen the front sleeve.
    # Kneeling legs, hands and lowered flute retain their original support.
    'sleep_b': [
        (22, 28, '.OOOOOOOO.'),
        (23, 26, '.OhhhhHHHHHOO'),
        (28, 24, 'OJGGggggggGGGHHHO'),
        (33, 26, 'OSsLLHHHsssssssSO'),
        (34, 27, 'OsLLLSSssHHHssSO'),
        (35, 27, 'OSsLLsssssssssssO'),
        (36, 28, 'OsLLssssssssLLsSO'),
        (37, 28, 'OSssssssssssssSO'),
        (38, 29, 'OSSsssssssSSsSO'),
        (39, 30, 'OSSssssssssssO'),
        (40, 31, 'OOSSSssssSSO'),
        (41, 32, 'OSsLLssssSO'),
        (42, 29, '..OCWsLLssSCOO'),
        (43, 27, '.OCWWssSCWWWcCO.'),
        (44, 25, '.OCWWccCWWWWccCCO'),
        (45, 24, '.OCWWWccCWWWcccCWcO'),
        (46, 23, '.OCWWWccCWWWccCCWWcO'),
        (47, 22, '.OCWccOCcCWWWccCCWWcO'),
        (48, 22, 'OCWccOOCccCWWccCCCWWcO'),
    ],
}

for name, spans in REPAIRS.items():
    path = ROOT / 'actions' / (name + '.pxgrid')
    rows = path.read_text().splitlines()
    for y, x, pixels in spans:
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    path.write_text('\n'.join(rows) + '\n')
