"""Apply hand-selected native row spans; no inferred art or frame transforms.

Coordinates are zero based. The original four grids are kept inside source.
Final deliverables remain complete 64 x 64 literal ASCII .pxgrid files.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
# These strings are the actual chosen fur clusters, not a generation rule.
EDITS = {
    'windup': [
        (34, 34, 'OBLLLL'),
        (35, 32, 'BBLLLLLL'),
        (36, 28, 'BLLLLLLLLLLBB'),
        (37, 28, 'BLLLLLLLBBBBB'),
        (38, 27, 'BBLLLLLBBBBBB'),
        (39, 28, 'BLLLLLBBBBBB'),
        (40, 28, 'BLLLLBBBBBBB'),
        (41, 30, 'LLBBBBBBB'),
    ],
    'move': [
        (34, 35, 'OBLLLLL'),
        (35, 33, 'BBLLLLLBBB'),
        (36, 30, 'BLLLLLLLBBBBB'),
        (37, 28, 'BBLLLLLLBBBBBB'),
        (38, 29, 'BLLLLLLBBBBBB'),
        (39, 31, 'BLLLLBBBBBB'),
        (40, 33, 'LLBBBBBB'),
        (41, 34, 'LBBBBB'),
    ],
    'attack': [
        (34, 36, 'OBLLLLL'),
        (35, 34, 'BBLLLLLLBB'),
        (36, 31, 'BLLLLLLLLBBBB'),
        (37, 29, 'BBLLLLLLLBBBBB'),
        (38, 30, 'BLLLLLLLBBBBB'),
        (39, 32, 'BLLLLLBBBBB'),
        (40, 34, 'LLBBBBBB'),
        (41, 35, 'LBBBBB'),
    ],
    'recover': [
        (34, 35, 'OBLLLLB'),
        (35, 32, 'BBLLLLBBB'),
        (36, 28, 'BLLLLLLLLBBBBB'),
        (37, 28, 'BLLLLLLBBBBBB'),
        (38, 28, 'BLLLLBBBBBBBB'),
        (39, 30, 'BLLLBBBBBB'),
        (40, 31, 'LLBBBBB'),
    ],
}

def apply():
    archive = ROOT / 'revisions' / 'duplicate-face-before' / 'poses'
    archive.mkdir(parents=True, exist_ok=True)
    log = ['# Duplicate-face repair: explicit shoulder/neck row replacements.']
    for name, spans in EDITS.items():
        path = ROOT / 'poses' / f'{name}.pxgrid'
        if not (archive / path.name).exists():
            shutil.copyfile(path, archive / path.name)
        rows = path.read_text().splitlines()
        log.append('@ ' + name)
        for y, x, pixels in spans:
            rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
            log.append(f'{y} {x} {pixels}')
        path.write_text('\n'.join(rows) + '\n')
    corrections = ROOT / 'author_corrections.txt'
    marker = log[0]
    old = corrections.read_text()
    if marker not in old:
        corrections.write_text(old.rstrip() + '\n' + '\n'.join(log) + '\n')

if __name__ == '__main__':
    apply()
