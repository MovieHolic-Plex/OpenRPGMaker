"""Explicit chosen replacement runs for the two requested native clusters.

The old rows are preserved in rework-before. No pose transforms or filling.
After applying these runs, author_rows.py stores complete literal final rows.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent

# Each attack string replaces the old right-side tail beginning at x=38.
# Dots after the chosen run remove the old horizontal reach and hanging bell.
ATTACK = {
    29: 'LLBO',
    30: 'HLLBOO',
    31: 'HHLLLBO',
    32: 'HLLLLLBO',
    33: 'LHLLLBBBO',
    34: 'BLHLLLBBBO',
    35: 'BBLHLLLBBBO',
    36: 'CBLHLLLLBCCO',
    37: 'O.BLHLLLBBCCO',
    38: 'O..OLHLLBBCCO',
    39: 'O...OLLLBCCO',
    40: 'O....OLBCCOhhO',
    41: 'O.....OCCOhhhkO',
    42: 'CO.....OOhkkksOO',
    43: 'LCCO.....OkkssOnngOO',
    44: 'LCCCO.....OssOmnYggYO',
    45: 'LLCCCO.....OOmngYgnYO',
    46: 'LLCCCO......OmnngnnYOgnO',
    47: 'LLCCCCO......OmmnnnmYO',
    48: 'LLCCCCO.......OmmmmnYO',
    49: 'LLCCCO.........OOOOOO',
    50: 'LLCCO',
}

# Replacement box x=8..32, y=36..57. The rest of the fallen robe,
# folded legs, sandals, lowered hand and floor bell remains literal original.
# Crown, ear, oblique eyelids, lowered nose/jaw and short neck are chosen anew.
DEAD = {
    36: '',
    37: '',
    38: '',
    39: '.....OOOOOOOO',
    40: '...OOhhhhhhhhkkOO',
    41: '..OhhhhhhhhhhhhkkO',
    42: '.OhhhhhhhhhhhhhkkkO',
    43: 'OhhhhhhhhhhhhhkkkkO',
    44: 'OhhhhhhhhhhhhkkkkkkO',
    45: 'OhhhhhhhhhkkkkkkkkkO',
    46: 'OhhhhhkkkskkkkkkkkkkO',
    47: 'OhhhkkssOskkkkkkkkkkkO',
    48: 'OhhkkshOkskkeekkkkkkkkO',
    49: 'OkkksksOkskkkkkkkkkkkkO',
    50: '.OkksskksskkkkeekkkkkkkOL',
    51: '..OssskkkkkkkkkkkkhhksOsk',
    52: '...OssskkkkkkkkkkkkskkssH',
    53: '....OssskkkkkkskkkksOHrrL',
    54: '......OssskkkssskksOLrRrL',
    55: '........OOsskkssskksOrRrB',
    56: '........OOHssssssOOLrrRBB',
    57: '......OOhhHLLOOOOLBrrRBBB',
}

def apply():
    for name, runs, x, width in [('attack', ATTACK, 38, 26), ('dead', DEAD, 8, 25)]:
        rows = (ROOT/'rework-before'/(name+'.pxgrid')).read_text().splitlines()
        for y, pixels in runs.items():
            if len(pixels) > width:
                raise ValueError((name, y, len(pixels), width))
            rows[y] = rows[y][:x] + pixels.ljust(width, '.') + rows[y][x+width:]
        (ROOT/'poses'/(name+'.pxgrid')).write_text('\n'.join(rows)+'\n')
        author = ROOT/'author_rows.py'
        code = author.read_text()
        full_literal = "ART['"+name+"'] = (0, 0, '''\n"+'\n'.join(rows)+"\n''')"
        code = re.sub(r"ART\['"+name+r"'\] = \(\d+, \d+, '''.*?'''\)", lambda m: full_literal, code, count=1, flags=re.S)
        author.write_text(code)

if __name__ == '__main__':
    apply()
