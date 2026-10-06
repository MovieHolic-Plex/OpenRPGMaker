"""Explicit hand-authored sleep_b rows. No frame transforms or inferred pixels."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Each literal starts at x=16; the remaining row area is transparent.
# Head, neck, collar and shoulder were chosen together, row by row.
ROWS = {
    22: '................................',
    23: '.........OOOOOOOO...............',
    24: '.......OIIJJIIIHHHOO............',
    25: '..OOOOOIJJIIIIIHHHHHO...........',
    26: '..OIJIOIJJIIIIHHHHHHHO..........',
    27: '..OIHHOIIIIHHHHHHHHHHHO.........',
    28: '...OHHOIIHHHHHHHFFFFFHO.........',
    29: '...OHHOIHHHHHFPPPPPPPFFO........',
    30: '....OHOIHHHHFPPPPPPPPFFFO.......',
    31: '....OHOIHHHFPPPPPPPPFFFFO.......',
    32: '...OHHHIHHHFFPPPPPPPPFFFO.......',
    33: '...OHIHIHHHFFPPOOFFPOOFFFO......',
    34: '...OHIHHHHHFFPPPPPPFFPFFFO......',
    35: '...OHIHHHHHSFFPPPPFFPPFFFO......',
    36: '...OHIHHHHHSSFFTTTTTTMMMO.......',
    37: '...OHIHHHHHOSFMTMMMMMMNNO.......',
    38: '...OHIHHHHHOSMMMMMMMNNNO........',
    39: '....OHHHHHOOSMMMMMNNNNO.........',
    40: '....OHHHHO..OSMNNNNNNO..........',
    41: '....OHHHO....OSSFFSSO...........',
    42: '.....OOO....OCOSPFSOCO..........',
    43: '............OBLOOSSOCBCO........',
    44: '..........OBLLBBONMOBBBCO.......',
    45: '.........OBLLLBBONNOBBCCCO......',
    46: '........OBLLBBBBCONOBBCCO.......',
    47: '........OBLLBCBBBCNOBBBCCO......',
    48: '.......OBLBBCCBBBBBOBBCOBBCO....',
    49: '.......OBLBCOCBBBBBCBCO.OBBCO...',
}

def repair():
    target = ROOT / 'actions/sleep_b.pxgrid'
    before = ROOT / 'sleep_b_before_breathing_repair.pxgrid'
    if not before.exists():
        before.write_bytes(target.read_bytes())
    rows = target.read_text().splitlines()
    for y, literal in ROWS.items():
        if len(literal) != 32:
            raise ValueError((y, len(literal)))
        rows[y] = '.' * 16 + literal + '.' * 16
    full = '\n'.join(rows) + '\n'
    target.write_text(full)
    # Keep the existing authoring entry point reproducible with these literal rows.
    author_path = ROOT / 'author_rows.py'
    author = author_path.read_text()
    begin = author.index("FRAMES['sleep_b'] = [")
    end = author.index('\ndef write_frames():', begin)
    author_path.write_text(author[:begin] + "FRAMES['sleep_b'] = [(0,0,\"\"\"\n" + full + '\"\"\")]\n' + author[end:])

if __name__ == '__main__':
    repair()
