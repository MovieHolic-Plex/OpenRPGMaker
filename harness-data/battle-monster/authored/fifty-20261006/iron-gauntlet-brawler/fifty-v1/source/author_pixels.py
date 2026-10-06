"""Literal chosen horizontal runs. No pose transforms, masks or shading generators.
Each line is x plus an exact pixel string; following lines advance native y by one.
Only transparent padding is supplied when writing the complete 64x64 ASCII grids.
"""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parent
PALETTE = {
 'K':'#171923', 'H':'#242933', 'h':'#46505A',
 'r':'#803844', 'R':'#CA5861',
 'S':'#AE7860', 's':'#D5A17A', 'L':'#F1C598',
 'N':'#243446', 'n':'#38566A', 'B':'#5A7A8C',
 'P':'#544F50', 'p':'#80766B', 'l':'#ADA08A',
 'M':'#566571', 'm':'#92A5AF', 'W':'#DBE8E4', 'E':'#90D6C4'
}
# Each frame is separately specified. No inherited/copied body or translated frames.
FRAMES = {}
FRAMES['idle_a'] = (8, '''
27 KKKKKKKK
24 KHHhhhhHHHHKK
23 KHhhhhhhhhHHHHK
22 KHhhhHHHHHHHHHHHK
22 KHhHHHHHHHHHHHHHHK
22 KHHHHHHHHHHHHHHHHHK
22 KrRRRRRRRRRRRrrrrrK
22 KrRRRRRRrrrrrrrrrrK
22 KHHSSssssssssssSK
23 KHSSsssKKsssKKssK
23 KHSSssLsssssssLsSK
23 KHSSssLsKKsssKsssK
23 KSSsssLssssssLsssssK
24 KSssLLLLsssssssssSK
25 KSssLLLsssssssSSK
26 KSssssssssrrsSK
27 KSSssssssSSSK
29 KSSssssSSK
28 KNNKsssSKNK
25 KBBnnKsSSKnnnK
23 KBBBnBnKsKnNNnnK
21 KssLKNBBnKsnNnnNK
20 KsLLLsKNBnnsNNnnNK
19 KsLLLLssKNBnnNNnnNKKKKKK
18 KsLLLLsssKNBnnNNnnKmWWmmK
18 KsLLssssSKNBnnNNnKmWWWmmMK
18 KssssssSSKNBnnNnKmWWmmmmMK
18 KsssSSSKKNBnnNnKmWmmmMMMK
19 KssSSKKmKNBnnNnKmmmmMMMK
20 KssSKmWWmKBBnnNNKMMMKKK
21 KssKmWWWmmKBBnnNNKsSK
21 KSKmWWWmmmKBBnnNNssSK
22 KmWWmmmmmMKBBnnNNsSK
22 KmWmmmMMMMKBBnnNNsSK
22 KmmmmMMMMMKBBnnNNNK
23 KMMMMMMMKnrRRRRrrK
24 KKKKKKKKrrRRRRrrrrK
25 KllpppppPrRRrrPPppK
24 KllppppppPPPppppppPK
24 KllppppppPPPPpppppPK
24 KlppppppPPK.PppppppPK
23 KlppppppPK..KppppppPK
23 KlpppppPK...KppppppPK
22 KlpppppPK....KppppppPK
22 KlppppPK.....KppppppPK
22 KppppPPK.....KpppppPPK
21 KpppPPK.......KpppPPK
21 KppPPK........KppPPK
21 KHHhHK........KHhhHHK
20 KHhhhHHK.......KHhhhHHK
19 KHhhHHHHK......KHhhhHHHK
19 KHHHHHHHHKK....KHHHHHHHHK
20 KKKKKKKKKK.....KKKKKKKKK
''')

from pose_rows import FRAMES as BASE_ROWS
FRAMES.update(BASE_ROWS)
from action_rows import FRAMES as ACTION_ROWS
FRAMES.update(ACTION_ROWS)

from chosen_revisions import ROWS

def write_sources():
    (ROOT/'palette.json').write_text(json.dumps(PALETTE, indent=2)+'\n')
    for name, (start, literal) in FRAMES.items():
        rows = ['.'*64 for _ in range(64)]
        for y, line in enumerate(literal.strip().splitlines(), start):
            xtext, pixels = line.strip().split(' ', 1)
            x = int(xtext)
            if not (0 <= y < 64 and x >= 0 and x+len(pixels) <= 64):
                raise ValueError((name, x, y, pixels))
            if set(pixels)-set(PALETTE)-{'.'}:
                raise ValueError((name, y, 'unknown symbol'))
            rows[y] = '.'*x + pixels + '.'*(64-x-len(pixels))
        for y, (x, pixels) in ROWS.get(name, {}).items():
            if x+len(pixels)>64: raise ValueError((name,y,'revision exceeds canvas'))
            rows[y] = '.'*x + pixels + '.'*(64-x-len(pixels))
        sub = 'poses' if name in ('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead') else 'actions'
        target = ROOT/sub
        target.mkdir(exist_ok=True)
        (target/(name+'.pxgrid')).write_text('\n'.join(rows)+'\n')

if __name__ == '__main__':
    write_sources()
