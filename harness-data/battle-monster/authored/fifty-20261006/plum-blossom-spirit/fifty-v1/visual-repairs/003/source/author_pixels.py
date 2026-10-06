"""Chosen native pixel strings. No masks, tracing, transforms or automatic repairs.

The unchanged anatomy is retained between poses; every changed run is explicit.
Running this authoring record only writes inside its own source directory.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT / 'palette.json').read_text())
FRAMES = {}

def rows(grid, x, y, text):
    for dy, line in enumerate(text.strip('\n').splitlines()):
        if not line: continue
        assert x >= 0 and x + len(line) <= 96, (x,y+dy,line)
        assert set(line) <= set(PAL) | {'.'}, line
        grid[y+dy][x:x+len(line)] = list(line)

def new():
    return [list('.' * 96) for _ in range(96)]

base = new()
# Head: pinned bun, dark swept hair, adult cheek and modest rightward eyes.
rows(base, 37, 18, '''
......OHHHHO
.....OHhhHHHO
.....OhhhhHHO
....OHhhHHHHRPPO
...OHHhHHHHRPPYYRO
..OHHhhHHHHHHHHHHO
.OHhhhhHHHHHHHHHHHO
OHhhhHHHHHHHHHHHHHHO
OHhhHHHHHaaaabbbbaHO
OHhHHHHHaaabbbbbbaHO
OHHHHHHAaabbbbbbbbaO
OHHHHHHAaAabbbbAAaaO
OHHHHHHAaOabbbOOabaO
OHHHHHHAaaabbbbbbaabO
OHHHHHHAaaabbbbbaaaO
OHHHHHHAAaabbbbaaaO
.OHHHHHHAaaaAaaaAO
.OHHHHHHHAAaaaaAO
..OHHHHHHOAAAAAO
..OHHHHHHOAaaAO
...OHHHHHOAabAO
....OHHHHOAabAO
.....OHHOCaabACO
''')
# Upper robe / crossed collar. Continuous neck into the garment.
rows(base, 30, 41, '''
............OCCaabACCO
..........OCWWCaabACccCO
.........OCWWWcCAACcWcccCO
........OCWWWccWCCWWcccccCO
.......OCWWWcccWWWWcccccccCO
.......OCWWcccWWWWccccccccCO
......OCWWccccWWWWcccccccccCO
......OCWWccccWWWWcccccCCcccCO
......OCWWcccWWWWccccCC.CcccCO
......OCWcccWWWWcccccCO..CcccCO
......OCWcccWWWWcccccCO...CcccCO
......OCWccWWWWccccccCO....CcccCO
......OCcccWWWWccccccCO.....CAAaO
......OCcccWWWWcccccCCO......AabaO
......OCcccWWWWccccCCCO.......AaaO
.......OCccWWWccccCCCO........OAO
........OCccWWcccCCCO
.........ORrrrrrrrrRO
.........ORPPPrrrrrRO
.........ORPrRRRrrrRO
''')
# Back hand with red sash tassel.
rows(base, 34, 53, '''
OCccCO
OCcCAO
.OAabO
.OabaO
..OAAO
..ORPO
..ORPO
...ORO
''')
# Broad layered silk skirt: left lit pleats, dark right overlap.
rows(base, 26, 61, '''
.............ORPPrRRrrrRRO
............ORPPPrRRrrrrRRO
............OrPPPrrRrrrrrRO
...........ORPPPPrrRrrrrrRRO
..........ORPPPPPrrRRrrrrrRRO
..........ORPPPPrrrRRrrrrrrRRO
.........ORPPPPPrrrRRrrrrrrRRO
........ORPPPPPrrrrRRrrrrrrrRRO
.......ORPPPPPrrrrrRRRrrrrrrrRRO
.......ORPPPPPrrrrrRRRrrrrrrrRRO
......ORPPPPPrrrrrrRRRrrrrrrrrRRO
......ORPPPPrrrrrrrRRRRrrrrrrrRRO
.....ORPPPPPrrrrrrrRRRRrrrrrrrRRO
.....ORPPPPrrrrrrrrRRRRrrrrrrrRRO
....ORPPPPPrrrrrrrrRRRRRrrrrrrrRRO
....ORPPPPrrrrrrrrrRRRRRrrrrrrrRRO
...ORPPPPPrrrrrrrrrRRRRRrrrrrrrRRO
...ORPPPPrrrrrrrrrrRRRRRrrrrrrrRRO
..ORPPPPPrrrrrrrrrrRRRRRRrrrrrrrRRO
..ORPPPPrrrrrrrrrrrRRRRRRrrrrrrrRRO
.ORPPPPPrrrrrrrrrrrRRRRRRrrrrrrrRRO
.ORPPPPrrrrrrrrrrrrRRRRRRrrrrrrrRRO
ORPPPPPrrrrrrrrrrrrRRRRRRRrrrrrrrRRO
ORPPPPrrrrrrrRRRRRRRRRRRRRRrrrrrrRO
ORPPPPrrrrRRRrrrrrrRRRrrrrrRRrrrrRO
.ORPPrrRRRrrrrrrrrrRRRrrrrrrrRRrRO
..ORRRRrrrRRRRRRRRRRRRRRRRRRRRRO
...OOOOOOO...OCCCCCO..OCCCCCO
.............OCccCO..OCccCO
.............OHHHHO..OHHHHHO
.............OhhhHHO.OhhhhHHO
.............OHHHHHO.OHHHHHHO
''')
# Rear plum branch: fork, bark, tiny flowers, green sepals. Hand flower is separate below.
rows(base, 22, 34, '''
.......pF
......pFFp
.......Yp....OB
....OB.BO...OB
.....OBBO..OB
......OBBOOB
.......OBBO
..pF....OBBO
.pFFp....OBBO
..pYp.....OBBO
...G.......OBBO
............OBBO
.............OBBO
..............OBBO
...............OBBO
................OBBO
.................OBBO
''')
# Flower stem meets actual fingers at (69,55); five petals around pollen.
rows(base, 67, 42, '''
.....pFp
.....FFF
..pFpFFpFp
..FFpYYpFF
...ppYYpp
....pFFp
.....FF
.....GB
....gBO
....BBO
...BBO
..BBO
.AabO
.AaaO
..AAO
''')
# Explicit elbow and forearm correction: cuff now reaches the flower grip.
rows(base, 56, 51, '''
CccWWcccCO.....BBO
.CccWWcccCAAaBBO.
.OCccWWcccAabaBO.
..OCCCCCCAaabAAO.
...OOOOOOOAAAAO..
................
''')
# Woven plum motif follows the left upper fold, not a sparkling contour.
rows(base, 40, 72, '''
rPpPr
PPFPP
pFYFp
PPFPr
rPpRr
''')
FRAMES['idle_a'] = base

def variant(name):
    grid = [r[:] for r in base]
    FRAMES[name] = grid
    return grid

def band(grid, x, y, text):
    """Replace individually authored row bands; dots only clear the old rows."""
    lines = text.strip('\n').splitlines()
    for dy in range(len(lines)):
        grid[y+dy] = list('.' * 96)
    rows(grid,x,y,text)

g = variant('idle_b')
# Rising breath opens the lit collar and raises the hand by changing its joints.
rows(g, 42, 43, '''
WWWcCAACcWWcc
WWWccWCCWWWcc
WWcccWWWWWccc
''')
rows(g, 56, 51, '''
CccWWWccCAaabBBO
.CccWWcccAabaBBO.
.OCccWWcccAAAAO..
..OCCCCCCAAAAO...
...OOOOOOOOOOO...
................
''')
rows(g, 69, 42, '''
...pFFp..
...FFFp..
pFpFFpFp.
FFpYYpFF.
.ppYYpp..
..pFFp...
...FF....
''')
rows(g, 45, 83, '''
rrrrRRRRRRRRrrrr
rrrrrRRRrrrrrRRr
''')

g = variant('idle_c')
# Exhale: lower wrist, petal silhouette curls and sleeve shadow closes.
rows(g, 46, 44, '''
cWCCWWccccc
cccWWWccccc
cccWWWccccC
''')
rows(g, 56, 51, '''
CccWccccCO.....BBO
.CccWccccCO...BBO.
.OCccccccCAAaBBO.
..OCCCCCCAabaAAO.
...OCCCCCCAAAAO..
....OOOOOOOOOO..
''')
rows(g, 69, 42, '''
....pFp..
...pFFp..
pFpFFpFp.
FFpYYpFF.
.ppYYpp..
..pFFp...
...FF....
''')
rows(g, 40, 73, '''
PrFPPr
pFYFPr
PrFPrR
''')

g = variant('windup')
# Both elbows bend inward; blossom gathered at the waist.
band(g, 28, 41, '''
...OBBO.......OCCaabACCO
....OBBO....OCWWCaabACccCO
.....OBBO..OCWWWcCAACcWcccCO
......OBBOOCWWWccWCCWWcccccCO
.......OBCWWWcccWWWWccccccccCO
.......OCWWcccWWWWcccccccccccCO
......OCWWccccWWWWccccccCCcccCO
......OCWWWcccWWWWccccCC..CcccCO
......OCWWWWcccWWccccCC....CcccCO
......OCWWWWWcccWWcccCO....CccCO
.......OCWWWWcccWccccCO...CccCO
........OCWWWWcccccCCCO..CccCO
.........OCWWWWccCCCCCpFpCccCO
..........OCWWWcCCCppFFFpCcCO
...........OCWCCAabFFpYpFFCO
............OCAababppYppAO
............ORAAaaabpFpAAO
............ORPPRAAaBBAAO
............ORPrRRRBBRRO
............ORPrrrrBRRRO
''')
band(g, 27, 61, '''
.............ORPPrRRrrrRRO
............ORPPPrRRrrrrRRO
...........ORPPPPrrRrrrrrrRRO
..........ORPPPPPrrRRrrrrrrRRO
.........ORPPPPPrrrRRrrrrrrrRRO
........ORPPPPPrrrrRRrrrrrrrrRRO
.......ORPPPPPrrrrrRRRrrrrrrrrRRO
......ORPPPPPrrrrrrRRRrrrrrrrrrRRO
......ORPPPPrrrrrrrRRRrrrrrrrrrRRO
.....ORPPPPPrrrrrrrRRRRrrrrrrrrRRO
.....ORPPPPrrrrrrrrRRRRrrrrrrrrRRO
....ORPPPPPrrrrrrrrRRRRRrrrrrrrRRO
....ORPPPpPrrrrrrrrRRRRRrrrrrrrRRO
...ORPPPPFPrrrrrrrrRRRRRrrrrrrrrRRO
...ORPPPpYFprrrrrrrRRRRRrrrrrrrrRRO
..ORPPPPPFPrrrrrrrrRRRRRRrrrrrrrRRO
..ORPPPPpPrrrrrrrrrRRRRRRrrrrrrrRRO
.ORPPPPPrrrrrrrrrrrRRRRRRrrrrrrrRRO
.ORPPPPrrrrrrrrrrrrRRRRRRRrrrrrrrRO
ORPPPPPrrrrrrrrrrrrRRRRRRRRrrrrrrRO
ORPPPPrrrrrrrrRRRRRRRRRRRRRRrrrrRO
ORPPPPrrrrrRRRrrrrrrRRRrrrrrrRRrRO
.ORPPrrrRRRrrrrrrrrrRRRrrrrrrrRRO
..ORRRRRrrrRRRRRRRRRRRRRRRRRRRO
...OOOOOOOOOOCCCCCO..OCCCCCO
............OCccCO...OCccCO
............OCcCO....OCccCO
...........OHHHO.....OHHHHO
..........OhhhHO.....OhhhHHO
.........OhhhHO......OhhhhHHO
.........OHHHO.......OHHHHHHO
.....................OHHHHHHO
''')

g = variant('move')
# Forward step: torso stretches toward right, skirt opens over a bent front knee.
band(g, 29, 41, '''
..OBBO........OCCaabACCO
...OBBO.....OCWWCaabACcccCO
....OBBO...OCWWWcCAACcWWcccCO
.....OBBO.OCWWWccWCCWWWcccccCO
......OBBOCWWWcccWWWWWcccccccCO
.......OCWWcccWWWWWcccccccccccCO
......OCWWccccWWWWWccccCCCccccCO
......OCWWcccWWWWWccccCC..CccccCO
.....OCWWWcccWWWWccccCC....CcccCO
.....OCWWcccWWWWcccccCO.....CcccCO
.....OCWWccWWWWccccccCO......CcccCO
.....OCWccWWWWccccCCCO.......CcccCO
.....OCccWWWWccccCCCO........CAabAO
......OCcWWWWcccCCCO.........AabbAO
.......OCWWWWccCCCO..........OAaaO
........OCWWcccCCCO...........OAO
.........ORrrrrrrRRO
.........ORPPPrrrrRRO
.........ORPrRRRrrrRRO
..........ORPrrrrrrRRO
''')
# Outstretched flower grip, joined to forearm by the cream cuff.
rows(g, 59, 49, '''
.CccWWcccCO.....pFp
..CccWWcccCO....FFF
...CccWcccCO.pFpFFpFp
....CcccccCAabFFpYYpFF
.....OCCCCCAbabppYYpp
......OCCCCAAAAOpFFp
.......OOOOOAAO.BFF
...............BBO
''')
band(g, 25, 61, '''
...............ORPPrRRrrrrRRO
..............ORPPPrRRrrrrrRRO
.............ORPPPPrrRRrrrrrrRRO
............ORPPPPPrrRRrrrrrrrRRO
...........ORPPPPPrrrRRrrrrrrrrRRO
..........ORPPPPPrrrrRRrrrrrrrrrRRO
.........ORPPPPPrrrrrRRRrrrrrrrrrRRO
........ORPPPPPrrrrrrRRRrrrrrrrrrrRRO
.......ORPPPPPrrrrrrrRRRRrrrrrrrrrrRRO
......ORPPPPPrrrrrrrrRRRRrrrrrrrrrrRRO
.....ORPPPPPrrrrrrrrrRRRRRrrrrrrrrrrRO
....ORPPPPPrrrrrrrrrrRRRRRRrrrrrrrrrRO
...ORPPPPPrrrrrrrrrrrRRRRRRRrrrrrrrrRO
..ORPPPPpPrrrrrrrrrrrRRRRRRRRrrrrrrRO
.ORPPPPPFPrrrrrrrrrrrRRRRRRRRRrrrrRO
ORPPPPpFYFprrrrrrrrrrRRRRRRRRRRrrRO
ORPPPPPPFPrrrrrrrrrrrRRRRRRRRRRRRO
.ORPPPPpPrrrrrrrrrrrrRRRRRRRRRRO
..ORPPPPrrrrrrrrRRRRRRROCCCCCRO
...ORPPrrrRRRRRRrrrrROCccccCCO
....ORRRRRrrrrrrrrrRO.CccccCO
.....ORrrrrrrrrrRRO..CcccCCO
......ORrrrrrRRRO....CccCCO
.......ORRRRRO.....OCccCCO
........OCCCO.....OCccCCO
........OCcCO.....OCccCO
........OCcCO.....OCccCO
........OHHHO.....OHHHHO
.......OhhhHO.....OhhhhHHO
......OhhhHO......OhhhhhHHO
......OHHHO.......OHHHHHHHO
..................OHHHHHHHO
''')

g = variant('attack')
# Contact: shoulder leads, elbow extends, wrist drives a flowering switch.
band(g, 28, 41, '''
...OBBO.......OCCaabACCCO
....OBBO....OCWWCaabACWWWCO
.....OBBO..OCWWWcCAACWWWWWCCO
......OBBOOCWWWccWCCWWWWWWcccCO
.......OBCWWWcccWWWWWWWccccccccCO
.......OCWWcccWWWWWWcccccccccccccCO
......OCWWccccWWWWccccCCCCCccccccccCO
......OCWWcccWWWWccccCC...OCCCCcccccccCO
......OCWWccWWWWcccccCO.....OOCCCCccccccCO
......OCWccWWWWccccccCO........OOCCCCcccCAAabBO
......OCccWWWWccccCCCO............OOCCCCAabbBBO
.......OCWWWWccccCCCO...............OOOAAaaBO
........OCWWWWccCCCO...................OAAO
.........OCWWcccCCCO
..........ORrrrrrrRRO
..........ORPPPrrrrRRO
..........ORPrRRRrrrRRO
...........ORPrrrrrrRRO
...........ORPPrRRrrrrRRO
...........ORPPrRRrrrrrRRO
''')
# Bark extends from the enclosed palm; blossom crown points to the opponent.
rows(g, 75, 38, '''
.......pFFp
.......FFFF
....pFpFFpFFp
....FFpYYpFFF
.....ppYYppF
......pFFp
.......FF
......gBO
.....gBBO
....gBBO
...gBBO
..gBBO
.BBO
BBO
''')
band(g, 23, 61, '''
..................ORPPrRRrrrrrRRO
.................ORPPPrRRrrrrrrRRO
................ORPPPPrrRRrrrrrrRRO
...............ORPPPPPrrRRrrrrrrrRRO
..............ORPPPPPrrrRRrrrrrrrrRRO
.............ORPPPPPrrrrRRrrrrrrrrrRRO
............ORPPPPPrrrrrRRRrrrrrrrrrRRO
...........ORPPPPPrrrrrrRRRRrrrrrrrrrrRRO
..........ORPPPPPrrrrrrrRRRRrrrrrrrrrrrRO
.........ORPPPPPrrrrrrrrRRRRRrrrrrrrrrrRO
........ORPPPPPrrrrrrrrrRRRRRRrrrrrrrrrRO
.......ORPPPPPrrrrrrrrrrRRRRRRRrrrrrrrrRO
......ORPPPPpPrrrrrrrrrrRRRRRRRRrrrrrrrRO
.....ORPPPPPFPrrrrrrrrrRRRRRRRRRrrrrrrRO
....ORPPPPpFYFprrrrrrrrRRRRRRRRRRrrrrRO
...ORPPPPPPPFPrrrrrrrrRRRRRRRRRRRrrrRO
..ORPPPPPPPpPrrrrrrrrrRRRRRRRRRRRRRRO
.ORPPPPPPrrrrrrrrrrrrRRRRRRRRRRRRRO
ORPPPPPrrrrrrrrRRRRRRRRRROCCCCCCO
ORPPPPrrrrrRRRRrrrrrrrRO.CccccCCO
.ORPPrrRRRRrrrrrrrrrRO...CcccccCO
..ORRRRrrrrrrrrrrrRO.....CccccCO
...ORrrrrrrrrrrRRO.......CcccCO
....ORrrrrrRRRO.........OCccCO
.....ORRRRRO...........OCccCO
......OCCCO...........OCccCO
......OCcCO...........OCccCO
......OHHHO...........OHHHHO
.....OhhhHO...........OhhhhHHO
....OhhhHO............OhhhhhHHHO
....OHHHO.............OHHHHHHHHHO
......................OHHHHHHHHHO
''')

g = variant('recover')
# Elbow draws down; petals return at hip, skirt folds behind planted front foot.
band(g, 28, 41, '''
...OBBO.......OCCaabACCO
....OBBO....OCWWCaabACccCO
.....OBBO..OCWWWcCAACcWcccCO
......OBBOOCWWWccWCCWWcccccCO
.......OBCWWWcccWWWWccccccccCO
.......OCWWcccWWWWcccccccccccCO
......OCWWccccWWWWccccCCcccccCO
......OCWWcccWWWWccccCC.CcccccCO
......OCWWccWWWWcccccCO..CcccccCO
......OCWccWWWWccccccCO...CccccCO
......OCccWWWWccccCCCO....CccccCO
.......OCWWWWccccCCCO.....CccccCO
........OCWWWWccCCCO......CccccCO
.........OCWWcccCCCO.......CcccCO
..........ORrrrrrrRRO......CAabAO
..........ORPPPrrrrRRO.....AabbAO
..........ORPrRRRrrrRRO....OAAAOB
...........ORPrrrrrrRRO......BBO
...........ORPPrRRrrrrRRO...BBO
...........ORPPrRRrrrrrRRO.BBO
''')
rows(g, 64, 60, '''
..BBO
.BBO
BBO
BO
GpFp
pFFFp
FFYFF
pFFp
.pp
''')
band(g, 25, 69, '''
..........ORPPPPPrrrrRRRrrrrrrrrRRO
.........ORPPPPPrrrrrRRRRrrrrrrrrRRO
........ORPPPPPrrrrrrRRRRrrrrrrrrRRO
.......ORPPPPPrrrrrrrRRRRrrrrrrrrrRRO
......ORPPPPpPrrrrrrrRRRRRrrrrrrrrRRO
.....ORPPPPPFPrrrrrrRRRRRRrrrrrrrRRO
....ORPPPPpFYFprrrrrRRRRRRrrrrrrrRRO
...ORPPPPPPPFPrrrrrrRRRRRRRrrrrrrRRO
..ORPPPPPPPpPrrrrrrrRRRRRRRrrrrrrRRO
.ORPPPPPPrrrrrrrrrrrRRRRRRRRrrrrrRRO
.ORPPPPPrrrrrrrrrrrrRRRRRRRRrrrrrRO
ORPPPPPrrrrrrrrRRRRRRRRRRRRRrrrrRO
ORPPPPrrrrrRRRRrrrrrrRRRrrrrrRRrRO
.ORPPrrRRRRrrrrrrrrrrRRRrrrrrrRRO
..ORRRRrrrrRRRRRRRRRRRRRRRRRRRO
...OOOOOOOOOCCCCCO...OCCCCCO
...........OCccCO...OCcccCO
...........OCccCO...OCccCO
...........OCcCO....OCccCO
...........OHHHO....OHHHHO
..........OhhhHO....OhhhhHHO
.........OhhhhHO....OhhhhhHHO
.........OHHHHHO....OHHHHHHHO
...................OHHHHHHHO
''')

g = variant('hit')
# Brow tightens, head cheek recoils; near shoulder drops and wrist goes limp.
rows(g, 45, 28, '''
AAabbbbbbbaO
AaAabbbAAAaO
AaOabbbOAaaO
AaaabbbbbaabO
AAaabbbbbaaO
HAAaabbAaAO
HHAAaaaaAO
HHHAAAAAO
''')
band(g, 28, 41, '''
...OBBO......OCCaabACCO
....OBBO...OCWWCaabACccCO
.....OBBO.OCWWWcCAACcWcccCO
......OBBOCWWWccWCCWWccccCO
.......OCWWWcccWWWWcccccccCO
......OCWWcccWWWWccccccccccCO
.....OCWWccccWWWWcccccccccccCO
....OCWWccccWWWWccccCCCCccccCO
....OCWccccWWWWccccCC...CcccCO
....OCWcccWWWWcccccCO....CcccCO
....OCcccWWWWccccCCCO....CcccCO
.....OCccWWWWcccCCCO.....CcccCO
......OCccWWWccCCCO......CcccCO
.......OCccWWcCCCO.......CcccCO
........ORrrrrrRRO.......CccCO
........ORPPPrrrRRO......CccCO
........ORPrRRRrrRRO.....CAaAO
.........ORrrrrrrrRRO....AabAO
.........ORPPrRRrrrRRO...OAAO
.........ORPPrRRrrrrRRO....BBO
''')
rows(g, 60, 60, '''
..BBO
...BBO
....BBO
.....BBO
......BG
.....pFp
....pFFFp
....FFYFF
.....pFp
''')
band(g, 26, 69, '''
......ORPPPPPrrrrRRRrrrrrrrrRRO
.....ORPPPPPrrrrrRRRrrrrrrrrRRO
....ORPPPPPrrrrrrRRRRrrrrrrrRRO
...ORPPPPPrrrrrrrRRRRrrrrrrrRRO
...ORPPPpPrrrrrrrRRRRRrrrrrrrRRO
..ORPPPPPFPrrrrrrRRRRRrrrrrrrRRO
..ORPPPpFYFprrrrrRRRRRrrrrrrrRRO
.ORPPPPPPFPrrrrrrRRRRRRrrrrrrRRO
.ORPPPPPpPrrrrrrrRRRRRRrrrrrrRRO
ORPPPPPrrrrrrrrrrRRRRRRrrrrrrRRO
ORPPPPrrrrrrrrrrrRRRRRRRrrrrrRRO
ORPPPPrrrrrrrrrrrRRRRRRRrrrrrRRO
.ORPPPPrrrrrrrrrrRRRRRRRrrrrrRO
..ORPPrrrRRRRRRRRRRRRRRRRrrRO
...ORRRRRrrrrrrrrRRRrrrrrRRRO
....ORrrrrRRRRRRRRRRRRRRRRO
.....OOOOOOCCCCCO..OCCCCCO
...........OCccCO..OCcccCO
...........OCccCO..OCccCO
...........OHHHHO..OCccCO
..........OhhhhHO..OHHHHO
.........OhhhhhHO..OhhhhHHO
.........OHHHHHHO..OhhhhhHHO
..................OHHHHHHHO
''')

g = new()
FRAMES['dead'] = g
# Fresh collapsed silhouette, separate folded legs, closed eye and fallen flower.
rows(g, 15, 68, '''
.....OHHHHO
...OHHhhHHHHO
..OHhhhhHHHHHO....................ORRRRO
.OHhhhHHHHHHHHO.................ORrrrrRRRO
OHhhHHHHHaaaabbO..............ORrrrPPPrrrRRO
OHhHHHHHaaabbbbaO...........ORrrrPPPPrrrrrrRRO
OHHHHHHAaAbbbbbbaO........ORrrrPPPPPrrrrrrrrrRRO
OHHHHHHAaaAAbbbbaO......ORrrrrPPPPPrrrrrRRrrrrrRRO
OHHHHHHAaaaabbbbaOCWCCORrrrrrPPPPPrrrrrRRRRrrrrrrRO
OHHHHHHAAaAaaaAaOCWWWCCrrrPPPPPPPrrrrrRRRRRRrrrrrrRO
OHHHHHHHAAAAAAOCWWWWWccCRPPPPPPrrrrrrRRRRRRRRrrrrrrRO
.OHHHHHHHHAAACWWWWcccCCCrrrrrrrrrrRRRRRRRRRRRRrrrrrrRO
..OHHHHHHHOACWWWcccCCCCCrRRRRRRRRRRRRRRRRRRRRRRRrrrrrRO
..OHHHHHHOOCWWWccCCCCCCrrrrrrrRRRRRRRRRRRRRRRRRRRRrrrRO
...OHHHHHO.CWWWcCCCccCCrrrrrrrrrrRRRRRRRRRRRRRRRRRRrrRO
....OHHHHO..CWWcCCccCAAabrrrrrrrrRRRRRRRRRRRRRRRRRRrrRO
.....OHHO....CCCcccCAabbaORRRRRRRRRRRRRRROCCCCCOCCCCCO
......OO.....OCCCCCCAAAAO.OOOOOOOOOOOOOOOOHHHHOHHHHHHO
..............OOOOOOAAO.................OhhhHOhhhhhHHO
...............................OBBO.....OHHHHOHHHHHHO
..............................OBBO.........OOOOOOOOOO
.............................OBBO...pFp
............................OBBO...pFFFp
...........................OBBO....FFYFF
..........................OBBO......pp
''')
# Fallen hairpin stays attached to the bun, rear twig lies across the floor.
rows(g, 21, 77, 'HRPPYRO')
rows(g, 27, 90, 'OBBOOBBOOBBO')
rows(g, 31, 89, 'pFp')
rows(g, 30, 88, 'pFFFp')

# Individually located grip repairs after opening the nine-pose contact sheet.
g = FRAMES['recover']
rows(g, 56, 59, '...')
rows(g, 55, 60, '...')
rows(g, 59, 58, 'BBO')
rows(g, 60, 59, 'BBO')
rows(g, 60, 60, '.BBO.....')
rows(g, 61, 61, '.BBO....')
rows(g, 62, 62, '.BBO...')
rows(g, 63, 63, '.BG...')
g = FRAMES['hit']
rows(g, 60, 60, '.....')
rows(g, 56, 61, 'OBBO......')
rows(g, 58, 62, 'OBBO......')
rows(g, 60, 63, 'OBBO.....')
rows(g, 62, 64, 'OBBG')

g = variant('skill_a')
# Gathering: forward sleeve bends upward and the other hand cradles the flower.
band(g, 28, 41, '''
...OBBO.......OCCaabACCO............pFp
....OBBO....OCWWCaabACccCO.......pFpFFFp
.....OBBO..OCWWWcCAACcWcccCO......FFpPPpFF
......OBBOOCWWWccWCCWWcccccCO......ppPPpp
.......OBCWWWcccWWWWccccccccCO.....pFFp
.......OCWWcccWWWWccccccCcccCO....AabGB
......OCWWccccWWWWcccccC.CcccCO..AabbBO
......OCWWWcccWWWWccccCC..CcccCOAabbBO
......OCWWWWcccWWccccCC...CccCAAabbAO
......OCWWWWWcccWWcccCO..CccCAAaaAO
.......OCWWWWWcccccccCO.CccWCAAAAO
........OCWWWWWccccCCCCCccWWWCOOO
.........OCWWWWWccCCCCCccWWWCO
..........OCWWWCCAabAAccWWWCO
...........OCWCCAbbbAAAWWWCO
............OCCCAaabAAACCCO
............ORrOAAAACCCCO
............ORPPPrrOOOOO
............ORPrRRRrrrRO
............ORPrrrrrrRRO
''')
# Pink nucleus, five petals and small leaking scent curls chosen individually.
rows(g, 62, 34, '''
......pFp
......FFF
...pFpFFpFp
...FFpPPpFF
....ppPPpp
.....pFFp
......FF
......GB
.....gBO
''')
rows(g, 76, 30, '''
.pF
pF
.p
''')
rows(g, 60, 30, '''
p
pF
.Fp
''')

g = variant('skill_b')
# Cast: large flower is held at shoulder height; fingers enclose the wood.
band(g, 28, 41, '''
...OBBO.......OCCaabACCO...........pFp
....OBBO....OCWWCaabACWWWCO.......pFFFp
.....OBBO..OCWWWcCAACWWWWWCCO...pFFpPPpFFp
......OBBOOCWWWccWCCWWWWWWcccCO..FFpPPpFF
.......OBCWWWcccWWWWWWWccccccccCAAabpFFp
.......OCWWcccWWWWWWcccccccccccAabbBFF
......OCWWccccWWWWccccCCCCCccccAAaaBBO
......OCWWcccWWWWccccCC...OCCCCCAAABBO
......OCWWccWWWWcccccCO.....OOCCCOOO
......OCWccWWWWccccccCO
......OCccWWWWccccCCCO
.......OCWWWWccccCCCO
........OCWWWWccCCCO
.........OCWWcccCCCO
..........ORrrrrrrRRO
..........ORPPPrrrrRRO
..........ORPrRRRrrrRRO
...........ORPrrrrrrRRO
...........ORPPrRRrrrrRRO
...........ORPPrRRrrrrrRRO
''')
# Three native, differently shaped petal rays. Roots start at the hand blossom.
rows(g, 70, 20, '''
...................pF
..................pFF
.................pFFF
................pFFFF
...............pFFFFp
..............pFFFFp
.............pFFFFp
............pFFFpp
...........pFFFp
..........pFFFp
.........pFFFp
........pFFFp
.......pFFp
......pFFp
.....pFFp
....pFFp
...pFFp
..pFFp
.pFFp
pFFp
FFp
''')
rows(g, 73, 39, '''
..............pppp
...........ppFFFFFFp
........ppFFFFFFFFFFp
.....ppFFFFFFFFFFFFp
..ppFFFFFFFFFFFFpp
pFFFFFFpppppppp
FFpppp
p
''')
rows(g, 73, 47, '''
pFp
.pFFp
..pFFFp
...pFFFFp
....pFFFFFp
.....pFFFFFFp
......pFFFFFFFp
.......pFFFFFFFFp
........pFFFFFFFFp
.........pFFFFFFFp
..........pFFFFFp
...........pFFpp
............pp
''')
# Sleeve/hand boundary is preserved after the rightward effect roots.
rows(g, 64, 45, 'CAAabGB')
rows(g, 65, 46, 'AabbBBO')
rows(g, 65, 47, 'AAaaBBO')

g = variant('skill_c')
# Recovery: shoulders close, near wrist hangs, opened petals fall from its flower.
band(g, 28, 41, '''
...OBBO.......OCCaabACCO
....OBBO....OCWWCaabACccCO
.....OBBO..OCWWWcCAACcWcccCO
......OBBOOCWWWccWCCWWcccccCO
.......OBCWWWcccWWWWccccccccCO
.......OCWWcccWWWWcccccccccccCO
......OCWWccccWWWWccccCCcccccCO
......OCWWcccWWWWccccCC.CccccCO
......OCWWccWWWWcccccCO..CccccCO
......OCWccWWWWccccccCO...CccccCO
......OCccWWWWccccCCCO....CccccCO
.......OCWWWWccccCCCO.....CcccCO
........OCWWWWccCCCO......CcccCO
.........OCWWcccCCCO......CcccCO
..........ORrrrrrrRRO.....CccCO
..........ORPPPrrrrRRO....CccCO
..........ORPrRRRrrrRRO...CAaAO
...........ORPrrrrrrRRO...AabAO
...........ORPPrRRrrrrRRO.OAAOB
...........ORPPrRRrrrrrRRO..BBO
''')
rows(g, 57, 61, '''
..BBO
...BBO
....BG
...pFp
..pFPFp
...pFF
....p
''')
rows(g, 72, 50, '''
..pF
.pFFp
pFFp
.pp
''')
rows(g, 83, 62, '''
..pp
.pFF
pFFp
.pp
''')
rows(g, 73, 72, '''
.p
pFp
pFF
.p
''')
rows(g, 66, 79, '''
pFp
.FF
..p
''')

g = variant('poison_a')
# Sickness: near palm touches the jaw, far arm supports the aching abdomen.
rows(g, 45, 29, '''
AaAabbbbAAaaO
AaAabbbbAaaaO
AaaabbbbbbaaO
AaaabbbbAaaO
AAaaaAbbAaO
HAAaaAAaaO
HHAAAAAAO
''')
band(g, 28, 41, '''
...OBBO.......OCCaabACCO
....OBBO....OCWWCaabACccCO
.....OBBO..OCWWWcCAACcWcccCO
......OBBOOCWWWccWCCWWcccccCO
.......OBCWWWcccWWWWcccccAabAO
.......OCWWcccWWWWccccccAabbaO
......OCWWccccWWWWccccCCAabAAO
......OCWWcccWWWWccccCC.AAACCO
......OCWWWWccWWccccCC..CWWccCO
.......OCWWWWccWccccCO.CWWWccCO
........OCWWWWcccccCCOCWWWccCO
.........OCWWWWccCCC.CWWWccCO
..........OCWWWWCCCOCWWWccCO
...........OCWWWCCAabWWWccCO
............OCWCCAabbCCCCO
............ORrCAaabACCCO
............ORPrAAAAOOO
............ORPPPrrrrRRO
............ORPrRRRrrrRO
............ORPrrrrrrRRO
''')
# Lowered blossom stalk is clasped by the belly hand, not floating beside it.
rows(g, 50, 55, '''
AabBBO
AaabBO
AAAABO
...BBO
....BBO
.....BG
....pFp
...pFFFp
...FFYFF
....ppp
''')
# Sick shoulder volume and upper skirt compress toward abdomen.
rows(g, 39, 65, '''
ORPPrrrRRrrrrrRRO
ORPrrrRRRrrrrrrRRO
rPPrrrRRRrrrrrrRRO
''')
# Toxic bubbles: hollow green clusters, no letters.
rows(g, 65, 27, '''
..GG
.GggG
Gg..gG
Gg..GG
.GGGG
''')
rows(g, 75, 39, '''
.GG
GggG
G.GG
.GG
''')
rows(g, 69, 60, '''
.GGG
Gg.gG
G..GG
.GGG
''')

g = variant('poison_b')
# Second pain pulse: mouth hand presses inward, lower sleeve and belly sink.
rows(g, 45, 29, '''
AaAAbbbbAAaaO
AaAAabbbAAaaO
AaaabbbbbbaaO
AAaabbbAAaaO
AAaaaAAbAaO
HAAaaaaaaO
HHAAAAAAO
''')
band(g, 28, 41, '''
...OBBO.......OCCaabACCO
....OBBO....OCWWCaabACccCO
.....OBBO..OCWWWcCAACcWcccCO
......OBBOOCWWWccWCCWWccccCO
.......OBCWWWcccWWWWccccAabAO
.......OCWWcccWWWWccccCAabbaO
......OCWWccccWWWWccccCAabAAO
......OCWWcccWWWWccccCCAAACCO
......OCWWWWccWWccccCC.CWWccCO
.......OCWWWWccWccccCOCWWWccCO
........OCWWWWcccccCCCWWWccCO
.........OCWWWWccCCOCWWWccCO
..........OCWWWWCCOCWWWccCO
...........OCWWWCCCCWWWccCO
............OCWWCCAabCCCO
............ORrCCAabbCCO
............ORPrCAaabCO
............ORPPPAAAARO
............ORPrRRRrrrRO
............ORPrrrrrrRRO
''')
rows(g, 51, 56, '''
AabBBO
AaabBO
AAAABO
...BBO
....BBO
.....BG
....pFp
...pFFFp
...FFYFF
....ppp
''')
rows(g, 40, 65, '''
rPPrrrRRrrrrrRRO
PPrrrrRRRrrrrrrRRO
PrrrrrRRRrrrrrrRRO
''')
rows(g, 74, 23, '''
..GGG
.GgggG
Gg...gG
G....GG
.GGGGG
''')
rows(g, 68, 44, '''
.G
GgG
.G
''')
rows(g, 76, 56, '''
.GGG
Ggg.G
G..gG
.GGG
''')

g = variant('stun_a')
# Drooping head is redrawn, including the cheek plane and short weary eyelids.
band(g, 36, 18, '''
.
.
.
.....OHHHHO
....OHhhHHHO
...OHhhhHHHHRPPO
..OHhhhhHHHRPPYRO
.OHhhhHHHHHHHHHHO
OHhhhHHHHHHHHHHHHO
OHhhHHHHHaaaabbbbHO
OHhHHHHHaaabbbbbbaO
OHHHHHHAaabbbbbbbbaO
OHHHHHHAaAabbbbAAaaO
OHHHHHHAaaAAbbAAabaO
OHHHHHHAaaabbbbbbaabO
OHHHHHHAaaabbbbbaaaO
.OHHHHHAAaabbbbaaaO
.OHHHHHHAAaaaAaaaO
..OHHHHHHHAAaaaaO
...OHHHHHHHAAAAO
....OHHHHHHAAAO
.....OHHHHOAAO
......OHHOAaAO
''')
band(g, 28, 41, '''
...OBBO.......OCCaAaACCO
....OBBO....OCWWCaAaACccCO
.....OBBO..OCWWWcCAACcWcccCO
......OBBOOCWWWccWCCWWcccccCO
.......OBCWWWcccWWWWccccccccCO
.......OCWWcccWWWWcccccccccccCO
......OCWWccccWWWWccccCCcccccCO
......OCWWcccWWWWccccCC.CcccCO
......OCWWccWWWWcccccCO..CcccCO
......OCWccWWWWccccccCO...CccCO
......OCccWWWWccccCCCO....CccCO
......OCccWWWWcccCCCO.....CccCO
......OCccWWWccCCCO......CccCO
......OCccWWcCCCO........CccCO
......OCcCOrrrrRRO.......CccCO
......OCcCOPrRRRRO.......CccCO
......CAaAOPrRRRrrRO.....CccCO
......AabAOPrRRRrrrRRO...CAaAO
......OAAO.PPrRRrrrrRRO..AabAO
...........PPrRRrrrrrRRO.OAAOB
''')
rows(g, 55, 61, '''
...BBO
....BBO
.....BBO
......BG
.....pFp
....pFFFp
....FFYFF
.....pp
''')
rows(g, 63, 14, '''
...Y
...Y
.YYYWW
..YWY
...Y
''')
rows(g, 28, 21, '''
..Y
..WY
YYWYY
..Y
..Y
''')

g = variant('stun_b')
# The head rests farther forward; shoulder/cuff and far hand also sag.
band(g, 36, 18, '''
.
.
.
.
.....OHHHHO
....OHhhHHHO
...OHhhhHHHHRPPO
..OHhhhhHHHRPPYRO
.OHhhhHHHHHHHHHHO
OHhhhHHHHHHHHHHHHO
OHhhHHHHHaaaabbbbHO
OHhHHHHHaaabbbbbbaO
OHHHHHHAaabbbbbbbbaO
OHHHHHHAaAAabbbAAAaO
OHHHHHHAaaAAbbAAabaO
OHHHHHHAaaabbbbbbaabO
.OHHHHHAAaabbbbbaaaO
.OHHHHHHAAaabbbbaaO
..OHHHHHHAAaaaAaaO
...OHHHHHHHAAaaaO
....OHHHHHHHAAAO
.....OHHHHHAAAO
......OHHHOAaAO
''')
band(g, 28, 41, '''
...OBBO.......OCCAaaACCO
....OBBO....OCWWCAaaACccCO
.....OBBO..OCWWWcCAACcWcccCO
......OBBOOCWWWccWCCWWcccccCO
.......OBCWWWcccWWWWccccccccCO
.......OCWWcccWWWWcccccccccccCO
......OCWWccccWWWWccccCCcccccCO
......OCWWcccWWWWccccCC.CcccCO
......OCWWccWWWWcccccCO..CcccCO
......OCWccWWWWccccccCO...CccCO
......OCccWWWWccccCCCO....CccCO
......OCccWWWWcccCCCO.....CccCO
......OCccWWWccCCCO......CccCO
......OCccWWcCCCO........CccCO
......OCccCOrrrRRO.......CccCO
......OCccCOPrRRRRO......CccCO
......OCcCOPrRRRrrRO.....CccCO
......CAaAOPPrRRrrrRRO...CccCO
......AabAOPPrRRrrrrRRO..CAaAO
......OAAO.PPrRRrrrrrRRO.AabAO
''')
rows(g, 55, 61, '''
..OAAOB
.....BBO
......BBO
.......BG
......pFp
.....pFFFp
.....FFYFF
......pp
''')
rows(g, 73, 22, '''
..Y
..WY
YYWYY
..Y
..Y
''')
rows(g, 31, 11, '''
...Y
...Y
.YYWWY
..YWY
...Y
''')

g = new()
FRAMES['sleep_a'] = g
# Seated sleeping head; lid uses short warm shadow clusters, separated from nose.
rows(g, 37, 43, '''
......OHHHHO
.....OHhhHHHO
.....OhhhhHHO
....OHhhHHHHRPPO
...OHHhHHHHRPPYYRO
..OHHhhHHHHHHHHHHO
.OHhhhhHHHHHHHHHHHO
OHhhhHHHHHHHHHHHHHHO
OHhhHHHHHaaaabbbbaHO
OHhHHHHHaaabbbbbbaHO
OHHHHHHAaabbbbbbbbaO
OHHHHHHAaAabbbbAAaaO
OHHHHHHAaaAAbbAAabaO
OHHHHHHAaaabbbbbbaabO
OHHHHHHAaaabbbbbaaaO
OHHHHHHAAaabbbbaaaO
.OHHHHHHAaaaAaaaAO
.OHHHHHHHAAaaaaAO
..OHHHHHHOAAAAAO
..OHHHHHHOAaaAO
...OHHHHHOAabAO
....OHHHHOAabAO
.....OHHOCaabACO
''')
rows(g, 25, 66, '''
................OCCaabACCO
..............OCWWCaabACccCO
.............OCWWWcCAACcWcccCO
............OCWWWccWCCWWcccccCO
...........OCWWWcccWWWWcccccccCO
..........OCWWcccWWWWccccccccccCO
..........OCWWccccWWWWccccCCccccCO
.........OCWWWccccWWWccccCC.CcccCO
.........OCWWWWccccWWcccCC..CcccCO
..........OCWWWWcccccccCC..CcccCO
...........OCWWWWccccCCCO.CcccCO
............OCWWWCCAabCCCCcccCO
...........ORrCCCCAabbAAAaCCCCRO
.........ORrrrRRRCAaabAabAACRrrRRO
.......ORrrPPPrrrrAAAAOAAAORrrrrrrRRO
.....ORrrPPPPPrrrrrRRRRRRRRRrrrrrrrRRO
...ORrrPPPPPPPrrrrrRRRRRRRRRRRrrrrrrrRRO
..ORrrPPPPpPrrrrrrrRRRRRRRRRRRRrrrrrrrRRO
.ORrrPPPPPFPrrrrrrrRRRRRRRRRRRRRrrrrrrRRO
ORrrPPPPpFYFprrrrrrRRRRRRRRRRRRRrrrrrrrRO
ORrrPPPPPPFPrrrrrrrRRRRRRRRRRRRRrrrrrrrRO
ORrrPPPPPpPrrrrrrrrRRRRRRRRRRRRRrrrrrrrRO
.ORrrrrrrrrrrrrRRRRRRRRRRRRRRRRRrrrrrrRO
..ORrrRRRRRRRRRrrrrrRRRRRRRRRRRRRRrrRO
...ORRRrrrrrrrRRRRRRRRRRRRRRRRRRRRRO
....OOOOOOCCCCCOOOOOOOOOOCCCCCOOOOO
..........OHHHHO.........OHHHHHO
''')
# Two visible tucked feet at ground level; a lowered stem lies across lap.
rows(g, 35, 92, 'OHHHHHO........OHHHHHHO')
rows(g, 56, 79, 'AABBO')
rows(g, 59, 80, 'OBBO')
rows(g, 61, 81, 'OBBO')
rows(g, 64, 82, 'BGpFp')
rows(g, 66, 83, 'pFFFp')
rows(g, 66, 84, 'FFYFF')
rows(g, 67, 85, 'ppp')
rows(g, 22, 63, '''
...pFp
..pFFFp
...pYp....OB
....B....OB
.....OBBOB
......OBBO
.......OBBO
........OBBO
.........OBBO
..........OBBO
''')

g = new()
FRAMES['sleep_b'] = g
# Retain the seated anatomy, then author its shallow breath and relaxed closed lids.
for y in range(96):
    g[y] = FRAMES['sleep_a'][y][:]
rows(g, 45, 54, '''
AaAabbbbAAaaO
AaaAAbbAAabaO
AaaabbbbbbaabO
''')
rows(g, 42, 68, '''
WWcCAACcWWcc
WWccWCCWWWcc
WcccWWWWWccc
WcccWWWWWccc
''')
rows(g, 42, 73, '''
WWccccWWWcccCC
WWWccccWWccCC
WWWWccccccCC
''')
rows(g, 49, 77, '''
CAabCCCCCccCO
CAabbAAAaCCCO
CAaabAabAACRr
''')
rows(g, 46, 87, 'rrrrrRRRRRRRRRRRRRRR')
rows(g, 67, 83, 'FFFp')
rows(g, 67, 84, 'FYFF')

# Second visual pass: remove the duplicated gathering bloom and connect its stem.
g = FRAMES['skill_a']
rows(g, 58, 42, '.........gBO.........')
rows(g, 58, 43, '........BBO..........')
rows(g, 58, 44, '.......BBO...........')
rows(g, 58, 45, '......AabBO..........')
rows(g, 58, 46, '.....AabbAO..........')
rows(g, 58, 47, 'CO..AabAAO...........')
rows(g, 58, 48, 'CCCAabbAO............')
g = FRAMES['skill_b']
# Three ray roots explicitly connect to petal edges (not to empty space).
rows(g, 65, 40, 'ppFFFp')
rows(g, 66, 41, 'pFFFp')
rows(g, 69, 44, 'pFFFpp')
rows(g, 71, 45, 'FFFp')
rows(g, 71, 46, 'pFFp')
rows(g, 71, 47, 'pFFp')
rows(g, 71, 48, 'pFFFp')

g = FRAMES['poison_a']
# Fingers touch the lower cheek; wrist and ivory cuff reach the raised elbow.
rows(g, 52, 35, '''
.AabO
.AabO
..AabO
..AabO
..AAAO
..CCCO
..CccCO
..CccCO
..CccCO
''')
g = FRAMES['poison_b']
rows(g, 52, 35, '''
.AaaO
.AabO
..AabO
..AaaO
..AAAO
..CCCO
..CccCO
..CccCO
..CccCO
''')

g = FRAMES['sleep_a']
# Short horizontal eyelids, no resting black pupil cluster.
rows(g, 45, 54, 'aaabbbbbbaa')
rows(g, 45, 55, 'aAAbbbAAaba')
g = FRAMES['sleep_b']
rows(g, 44, 54, 'AaaabbbbbbaaO.')
rows(g, 44, 55, 'AaAAbbbAAabaO.')
rows(g, 44, 56, 'AaaabbbbbbaabO.')
# Replace the entire breath band to keep one pair of connected hands.
band(g, 25, 68, '''
.............OCWWWcCAACcWWcccCO
............OCWWWccWCCWWWcccccCO
...........OCWWWcccWWWWWcccccccCO
..........OCWWcccWWWWWccccccccccCO
..........OCWWccccWWWWWccccCCccccCO
.........OCWWWccccWWWWccccCC.CcccCO
.........OCWWWWccccWWWcccCC..CcccCO
..........OCWWWWccccWWccCC..CcccCO
...........OCWWWWcccccCCO.CcccCO
............OCWWWCCAabCCCCcccCO
...........ORrCCCCAabbAAAaCCCCRO
.........ORrrrRRRCAaabAabAACRrrAABBO
''')
# Breathing row replacement had erased the rear twig; restore its actual fork.
g = FRAMES['sleep_b']
rows(g, 28, 68, 'OBBO')
rows(g, 29, 69, 'OBBO')
rows(g, 30, 70, 'OBBO')
rows(g, 31, 71, 'OBBO')
rows(g, 32, 72, 'OBBO')
g = FRAMES['stun_a']
rows(g, 24, 34, '''
...pFp....OB
..pFFFp..OB
...pYp..OB
....B.OB
.....OBBO
......OBBO
.......OBBO
''')
g = FRAMES['stun_b']
rows(g, 24, 35, '''
...pFp....OB
..pFFFp..OB
...pYp..OB
....B.OB
.....OBBO
......OBBO
.......OBBO
''')

# Current hit correction is kept as a separate explicit native-row record.
# Applying it here prevents rebuilding the original authoring record from
# silently restoring the superseded upright hit. Other poses are retained.
from repair_hit import apply_hit_repair
apply_hit_repair(FRAMES['hit'])

# Two later observed defects: duplicated casting palm and unsupported corpse.
from repair_hand_ground import apply_hand_ground_repair
apply_hand_ground_repair(FRAMES)

def save():
    for name, grid in FRAMES.items():
        sub = 'poses' if name in ('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead') else 'actions'
        (ROOT/sub/name).with_suffix('.pxgrid').write_text('\n'.join(''.join(r) for r in grid)+'\n')
        im = Image.new('RGBA',(96,96))
        for y, line in enumerate(grid):
            for x, ch in enumerate(line):
                if ch != '.':
                    im.putpixel((x,y),tuple(bytes.fromhex(PAL[ch][1:]))+(255,))
        im.save(ROOT/'png'/f'{name}.png')

if __name__ == '__main__':
    save()
