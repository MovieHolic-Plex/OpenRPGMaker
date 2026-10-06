"""Literal native-pixel repair of the collapsed right branch shoulder.

Each replacement row is chosen explicitly. No shape generation or frame
transformation. Run only this patch against the existing full source grids.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
# 0-based (x, y, literal palette indices). The existing white tuft at
# x83-94, y103-114 overlaps the lower edge; its pixels remain unchanged.
PATCHES = [
    (84, 100, "BLLBBSSK"),
    (84, 101, "LLHHLLBBSSK"),
    (84, 102, "BLHHHLLBBSSK"),
    (89, 103, "SLHHLLBBSSK"),
    (91, 104, "SLHHLLBBSSK"),
    (92, 105, "SLHHLLBBSSK"),
]


def main():
    archive = ROOT / 'history' / 'before-dead-branch-repair'
    if not archive.exists():
        archive.mkdir(parents=True)
        for folder in ['poses', 'actions']:
            shutil.copytree(ROOT / folder, archive / folder)
        for name in ['palette.json', 'AUTHORING.md', 'TIMING.md']:
            shutil.copyfile(ROOT / name, archive / name)
    path = ROOT / 'poses' / 'dead.pxgrid'
    rows = [list(row) for row in path.read_text().splitlines()]
    for x, y, literal in PATCHES:
        rows[y][x:x + len(literal)] = list(literal)
    path.write_text('\n'.join(''.join(row) for row in rows) + '\n')


if __name__ == '__main__':
    main()
