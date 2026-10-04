"""Native cluster authoring from the selected 64x64 grids. No transforms or RNG.
Every output pose is preserved as a full literal 64x64 ASCII pxgrid.
Cluster cut/paste moves native pixels; replacement rows are hand authored.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent.parent
PREV=ROOT.parent
NAMES=['wild-boar','straw-dokkaebi','maiden-ghost']
POSES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']

def load(n): return [list(r) for r in (PREV/'source'/f'{n}.pxgrid').read_text().splitlines()]
def clone(g): return [r[:] for r in g]
def blank(): return [list('.'*64) for _ in range(64)]
def patch(g,x,y,raw):
    for dy,row in enumerate(raw.strip('\n').splitlines()):
        for dx,s in enumerate(row):
            if s!=' ':g[y+dy][x+dx]=s
    return g

def part(g,x0,y0,x1,y1):
    return [[g[y][x] for x in range(x0,x1)] for y in range(y0,y1)]
def stamp(g,p,x,y):
    for dy,row in enumerate(p):
        for dx,s in enumerate(row):
            if s!='.' and 0<=x+dx<64 and 0<=y+dy<64:g[y+dy][x+dx]=s
    return g

def clear(g,x0,y0,x1,y1):
    for y in range(y0,y1):
        for x in range(x0,x1):g[y][x]='.'
    return g

def move(g,x0,y0,x1,y1,dx,dy):
    p=part(g,x0,y0,x1,y1);clear(g,x0,y0,x1,y1);stamp(g,p,x0+dx,y0+dy);return g

def save(n,p,g):
    path=ROOT/'source'/n/f'{p}.pxgrid';path.parent.mkdir(exist_ok=True)
    assert len(g)==64 and all(len(r)==64 for r in g)
    palette=json.loads((ROOT/'source'/n/'palette.json').read_text())
    assert not (set(''.join(''.join(r) for r in g))-set(palette)-{'.'})
    path.write_text('\n'.join(''.join(r) for r in g)+'\n')

IDLE={}
for n in NAMES:
    target=ROOT/'source'/n; target.mkdir(exist_ok=True)
    (target/'palette.json').write_text((PREV/'source'/f'{n}.palette.json').read_text())
    IDLE[n]=load(n)
# Boar: break the uninterrupted highlight bands; separate far haunch from belly.
g=IDLE['wild-boar']
patch(g,20,27,'''MLHLLMM
MMHLMBB
MLMMBBB
MMBBMMM''')
patch(g,30,29,'''BBMMML
BSMLMM
BSMMMM
SMMMBB
SMMBBM''')
patch(g,23,46,'''ODSSMM
.OBMMB
..SMBB
..SBB.
..SBBO
..OKKO
...OO.''')
# Tusk emerges upward against the muzzle, 3px white cluster, shadow at root.
patch(g,43,38,'''TTP
TTP
CTN
CTN
TTT
CTO''')
# Dokkaebi: far temple shaded, near brow angled, small nose at right.
g=IDLE['straw-dokkaebi']
patch(g,27,22,'''BSSMMSSBB
BDKBMKKMB
BSEBMMLLM
BBMMMLLMB
BBMMMLMBS
BSSTTMBS.''')
# Shoulder coat rewritten into hanging uneven straw bundles, same footprint.
patch(g,14,30,'''.....abcdccbbaSSSSabbccddba....
....abddccbbbbaaaabbccddcba....
...abddccbbccbbbccbbddcccba....
..abcdcbbccddbbcddbbcccbcbba...
.abcdcbccbdddbbcddcbccbbcbba...
SbcddbbcbdddbbcddcbccbbbaSS...
MLbccbbcbdcbbccdcbbccbbaMMBS..
LLMbbccbbcbbaccbbacccbaMMLMBS.
LLMBabccbcbbaaccbaacbaaMMLLMBS
MMLBBSabbcaabbaaabaabaSSMMMLBS
MMMBBS..abba.abba.aaba.SMMBBBS
.SMBBS...aa..aa...aa...SBBBS..
..SSS..................SSS...''')
# Restore sash exposed between irregular fringes.
patch(g,22,41,'''ORrrrrrrrRO
ORrrRrrrrRO
OSRrrrrRRO.''')
# Small dark boundaries at shoulders, not an outline around every straw strand.
patch(g,17,35,'Sb\nSM\nML')
# Ghost: replace rigid fold bands with broad interrupted fabric planes.
g=IDLE['maiden-ghost']
patch(g,34,39,'''HHBMHS
HHLMLS
HHLLMS
HHLHLS
HHHLMS
HHHLMS
HHLHLS
HHHLMS
HHLLMS
HHLHLS
HHHLMS
HHLHLS
HLMMHS
LMMHMS
LMLHMS''')
# Two small hands emerge clear of cuffs, with deliberate one-pixel finger gaps.
patch(g,19,35,'''SMB....
SMBaabS
Sabccab
.Sb.b.O
..O.O..''')
patch(g,40,33,'''MSO....
SbbaDO.
abcc.aO
Sbb.aO.
.O.O...''')
# Break near skirt's perfect repeated highlight diagonal, retain bright left fold.
patch(g,25,43,'''TTHHML
THHLHH
HHMLHH
HHMLHH
THHMLH
TTHMLH
THHLHH''')
for n,g in IDLE.items():save(n,'idle_a',g)

# BOAR -----------------------------------------------------------------
n='wild-boar';base=IDLE[n]
g=clone(base)
move(g,29,22,45,34,0,-1)
stamp(g,part(base,29,33,45,34),29,33)
patch(g,31,31,'MMBB\nMLMB');save(n,'idle_b',g)
g=clone(base)
move(g,16,25,30,32,0,1)
stamp(g,part(base,16,25,30,26),16,25)
patch(g,38,35,'DKKB\nSBBB');patch(g,29,43,'SMBB');save(n,'idle_c',g)

def boarbody(back_xy,front_xy):
    g=blank()
    stamp(g,part(base,8,22,32,48),*back_xy)
    stamp(g,part(base,32,22,50,46),*front_xy)
    return g

g=boarbody((9,24),(32,26))
# Draw underside/legs instead of moving the idle foot row.
patch(g,19,47,'''OSSSDDSSSMBBDSSBBO
OSBMBDDDMMBBDSSBBO
.OSMMBODMMBBD.SBBBO
..OSMBBDMBBBO.SBMBO
...OSMMBBBBO..SBMBO
...OSMMMBO....SBMBO
..OSMMMBO.....SBMMBO
..OKKKKKO.....OKKKKO
...OOOOO.......OOOO''');save(n,'windup',g)

g=boarbody((8,21),(33,22))
patch(g,18,44,'''OSSSSDSSSMBBSSSBBO
OSBMMBDSSMBBBSSBBO
.SBMBBBDDBBBSSBBBO
..SBMMBO.DDBB.SBBBO
.SBMMBO...DBBO.SBMBO
SBMMBO....DBBO..SBMMBO
SBMBO.....DBBO...SBMMBO
SMBO......DBBO....SBMMBO
MBO.......DBBO.....SBMMBO
KO........OKKO......SBMMBO
O..........OO........SKKKKO
......................OOOO''')
# Rear leg extending backward, kept within cell and independent of belly.
patch(g,12,49,'''...OSMMBO
..OSMMBO.
.OSMMBO..
OSMMBO...
OKKKO....
.OOO.....''');save(n,'move',g)

g=boarbody((9,23),(35,26))
patch(g,29,40,'''SMMBBSS
SMBBSSS
SBBBSSS
SBBBSSS
SSSSSSS''')
patch(g,19,47,'''OSSSDDSSMMBBDSSBBBO
OSBMMBDDMBBBDSSBBBO
.SBMMBODMBBD..SBBBO
..SBMMBDMBBO..SBMMBO
...SBMBBBO.....SBMMBO
....SBMBO.......SBMMBO
...SBMMBO........SBMMBO
..SBMMBO..........SBMMBO
..SKKKKO...........SKKKKO
...OOOO.............OOOO''');save(n,'attack',g)

g=boarbody((8,24),(32,24))
patch(g,17,47,'''OSSSSDSSSMBBSSSSBBO
OSBMMBDSSMBBDSSBBBO
.OSMBBBDDMBBBD.SBBO
..OSMMBDMBBD.SBMBO.
...OSMMBBBBO.SBMBO.
..OSMMMBO...OSMMBO.
..OKKKKKO...OKKKKKO
...OOOOO.....OOOOO.''');save(n,'recover',g)

g=boarbody((9,24),(30,24))
patch(g,19,48,'''OSSSDDSSSMBBDSSBBO
OSBMBDDDMMBBDSSBBO
.OSMMBODMMBBD.SBBBO
..OSMBBDMBBBO.SBMBO
...OSMMBBBBO..SBMBO
...OSMMMBO....SBMBO
..OSMMMBO.....SBMMBO
..OKKKKKO.....OKKKKO
...OOOOO.......OOOO''')
patch(g,36,36,'DKKB\nSBBB');save(n,'hit',g)

g=blank()
patch(g,10,43,'''........SS.SSSSSSS..................
.....SSSMLSMMLLMMSSSSSS.............
...SSMLLLMMLLMMMMMLLMMBBSS..........
..SMLLHLLLMMMMMMLLMMMMBBBBS.........
.SMLLHHLMMLLMMMMLMMMBBBBBBSS........
.SMLLMMMMLLLMBMMMLMBBBSLMBBO.......
SMLLMMBBBMMMBBSMLMMMBBBSLMBBO.......
SMMLMMMBBMLLMMBBSMLLMMMMBLBBBO......
SMMBBMMMMLLMBBBSMMMMMBBBBBBBBBO.....
OSMMBMMMLLMMBBBBSSMMBBMMBBSSBBO.....
.OSMMBBSMMLMMMBBBSSSMMBBSSBBBO......
..OSMMBBBSMMMLBBSSSSSSSSSSSSO......
...OSSSSSSSSSSSSOOBBMBOOSBBBO......
.....OOOOOOO.....OKKKKO.OKKKO.......
..................OOO...OOO........''')
stamp(g,part(base,35,34,50,45),38,44)
patch(g,41,45,'DKK\nSBB');save(n,'dead',g)

# DOKKAEBI --------------------------------------------------------------
n='straw-dokkaebi';base=IDLE[n]
g=clone(base)
move(g,23,14,39,29,0,-1)
stamp(g,part(base,26,28,36,29),26,28)
move(g,43,22,54,31,0,-1)
patch(g,46,30,'CbC');patch(g,20,31,'ddcc');save(n,'idle_b',g)
g=clone(base)
patch(g,32,23,'KKMB\nBBMB')
move(g,21,38,30,41,1,0)
patch(g,21,38,'b\na\na');move(g,43,22,54,30,-1,0)
patch(g,46,30,'CbC');save(n,'idle_c',g)

def dbody(hxy,txy):
    g=blank();stamp(g,part(base,23,14,39,29),*hxy)
    torso=part(base,12,29,42,44)
    # Remove the old club's shaft from the extracted coat/arm region.
    for row in torso:
        for x,s in enumerate(row):
            if s=='C':row[x]='.'
    stamp(g,torso,*txy)
    return g

def dlegs(g,x=18,y=44):
    stamp(g,part(base,18,44,40,55),x,y)
    return g

g=dbody((23,15),(12,30));dlegs(g)
clear(g,34,30,43,44)
patch(g,34,24,'''...SSSS..
..SMLMBS.
.SMLLMBS.
.SMLMMBS.
.SMMMBBS.
.SMMBBS..
.SMLMBS..
SMLLMBBS.
SMLMMBBS.
SMMMBBS..
.SBBBS...
..SSS....''')
# Irregular club head and doubled shaft, raised above the near shoulder.
patch(g,32,4,'''...CCC..
..CbbbC.
.CbcdbbC
CbdccbbC
CbddbbSC
CbcbbSSC
.CbbSSC.
..CSSC..
..CbC...
..CbC...
..CbC...
..CbC...
..CbC...
..CbC...
..CbC...
..CbC...
..CbC...
..CbC...
..CbC...''')
patch(g,34,22,'SMMS\nMLMB\nMMBS');save(n,'windup',g)

g=dbody((24,13),(13,28))
# Existing club upper part is translated as a separate rigid pixel cluster.
stamp(g,part(base,43,22,54,37),44,24)
patch(g,40,37,'CbC\nCbC\nCbC')
patch(g,17,43,'''......OSBMMBBBSSO...........
.....OSMLMMBBBBSSO..........
....OSMLMMBBSSBBBSO.........
...OSMLMMBBS.SBBMBSO........
..OSMLMMBBS..SBBMMBSO.......
.OSMLMMBBS....SBBMMBSO......
OSMLMMBBS......SBBMMBSO.....
OSMMMBBS........SBBMMBSO....
.OSMBBBS.........SBBMMBSO...
..OSMMBO..........SBBMBSO..
..OSMMBO...........SBBMBSO.
.OSMMMBO...........OSBBMBO.
OSMLMMBBO..........OSBMMMBO
OKKKKKKKO..........OKKKKKKO
.OOOOOOO............OOOOOO''');save(n,'move',g)

g=dbody((25,15),(15,30));dlegs(g,18,45)
clear(g,34,32,46,44)
patch(g,34,31,'''...SSSSSSS.........
..SMLLLLMBS........
.SMLHHLLMMBSS......
SMLLLMMMLLMMBSS....
SMMMLLMMMLLMMMBSS..
.SBBMMMMBBMMMLMBS..
..SSBBBBBSSMMMLBS..
....SSSS...SBBBS...
............SSS....''')
patch(g,45,34,'''......CCCCC.
.....CbbbbbC
CCCCCbcddbbC
bbbbbbcddbbC
CCCCCbcccbbC
.....CbbbSSC
......CSSSC.
.......CCC..''')
patch(g,46,36,'MLM\nMBB\nSSS');save(n,'attack',g)

g=dbody((23,16),(12,31));dlegs(g,18,46)
clear(g,36,37,43,46)
patch(g,35,36,'''..SSS..
.SMLMBS
SMLLMBS
SMLMMBS
SMMMBBS
.SBBBS.
..SSS..''')
patch(g,40,42,'''CbC......
.CbC.....
..CbC....
...CbC...
....CbC..
...CbbbC.
..CbcdcbC
..CbddbbC
..CbccSSC
...CbSSC.
....CCC..''');save(n,'recover',g)

g=dbody((19,15),(10,30));dlegs(g,17,45)
patch(g,28,24,'KKMB\nBBMB')
clear(g,33,35,43,45)
patch(g,33,34,'''SSS......
MLMBS....
MLLMBS...
MMLMMBS..
BBMMMBBS.
.SBBBBS..
..SSSS...''')
patch(g,38,40,'''CbC..........
.CbC.........
..CbC........
...CbC.......
....CbC.CCC..
.....CbCbbbC.
......CbcdcbC
......CbddbbC
.......CbSSC.
........CCC..''');save(n,'hit',g)

g=blank()
patch(g,14,44,'''......aaaabbbbaaa...........
....aabbccddccbbbaa........
...abccddccbbbccddcbaa.....
..abddccbbcccbbccddcba.....
.Sbcddbbccddbbcddcbccba....
SMLbccbcdddbbcddcbccbaSS...
SMLLMBabbccbbccbbcbaaMLMBS.
SMMLBBSSabbcaabbbaaaMMLMBS.
.SMMBBS..aaa.aaa..SSMMBBS..
..SBBBS..ORrrrrrrRO.SBBBS..
...SSS..OSBBMMBBBSSO.SSS...
.......OSMMBBSSSBBBO......
......OKKKKKO..OKKKKO.....
.......OOOOO....OOOO......''')
stamp(g,part(base,23,14,39,29),23,32)
patch(g,32,41,'KKMB\nBBMB')
# Dropped club rests as its own native cluster, no scenery added.
patch(g,39,54,'''............CCCC..
...........CbbbbC.
CCCCCCCCCCCbcddbbC
bbbbbbbbbbbccdbSSC
CCCCCCCCCCCCbbSSC.
............CCCC..''');save(n,'dead',g)

# MAIDEN GHOST -----------------------------------------------------------
n='maiden-ghost';base=IDLE[n]
g=clone(base)
move(g,17,27,25,39,-1,-1)
patch(g,24,34,'BS\nBS\nDS')
move(g,39,29,47,38,1,-1)
patch(g,40,37,'SOO');patch(g,26,27,'BSS');save(n,'idle_b',g)
g=clone(base)
move(g,25,25,29,36,-1,0)
patch(g,28,25,'DH\nSH\nSH\nSH\nSH\nSH\nSH\nSH\nSH\nSH\nSH')
move(g,40,33,48,38,1,0)
patch(g,34,19,'KK\nBB');save(n,'idle_c',g)

def ghostbody(head_xy=(25,12),torso_xy=(24,25),skirt_xy=(19,39)):
    g=blank()
    stamp(g,part(base,19,39,43,57),*skirt_xy)
    torso=part(base,24,25,41,40)
    stamp(g,torso,*torso_xy)
    stamp(g,part(base,25,12,39,25),*head_xy)
    # Remove surviving tiny cuff/hand fragments before authored pose arms.
    clear(g,40,30,47,39)
    return g

def ghosthair(g,x=24,y=25):
    hair=part(base,24,25,31,39)
    for row in hair:
        for i,c in enumerate(row):
            if c not in 'ODSBM':row[i]='.'
    stamp(g,hair,x,y)
    return g

g=ghostbody((25,13),(24,26),(19,39))
patch(g,22,27,'''...OSLHHS.........
..OSLHTTHS........
.OSLHTTTHHS.......
OSLHTTHHLLHS......
OSLHHHHLLHHHS.....
.OSMMLLLHHTTHS....
..OSMLLHHTTHMS....
...OSLLHTTHMSaabO.
....OSHHHMSabccaO.
.....OSSSSSbbaOO..
..........OOO.....''')
patch(g,38,27,'''SLHHS......
LHTTHS.....
LHTTHLSDO..
HLHTHHMSDO.
HLHHTHLMSDO
LHHTHLMMSDO
HHLHMMSbbDO
LLMMSabccaO
SSSSSbbaOO.
....OOO....''')
ghosthair(g,24,26);save(n,'windup',g)

g=ghostbody((27,11),(26,24),(19,39))
# Flowing chima rewritten with a left trailing hem, no skew/rescale.
clear(g,12,39,46,59)
patch(g,13,38,'''............OSLHTTHHMLHHHS....
...........OSLHTTHHMLHHHHLSDO.
..........OSLHTTHHMLHHHHHLSDO.
.........OSLHTTHHMLHHHHHLMSDO.
........OSLHTTHHMLHHHHHHLMSDO.
.......OSLHTTHHMLHHHHHHHLMSDO.
......OSLHTTHHMLHHHHHHHMLSDO..
.....OSLHTTHHMLHHHHHHHHMLSDO..
....OSLHTTHHMLHHHHHHHHHLMSDO..
...OSLHTHHMLHHHHHHHHHHMLMSDO..
..OSLHHHMLHHHHHHHHHHHMLMLSDO..
.OSLHHHMLHHHHHHHHHHHLMLMSDO...
OSLHHHMLHHHHHHHHHHHLMLMSDO....
OSLLLMLHHHHHHHHHHLLLMLMSDO....
.OSSSLLLLHHHHHLLLLLLMLSDO.....
....OSSSSSLLLLLLSSSSSDO......
..........OOOOOO...OOO.......''')
patch(g,22,26,'''...OSLHHS.....
..OSLHTTHS....
.OSLHTTTHHS...
OSLHTTHHLLHS..
OSLHHHHLLHHS..
.OSMMLLLHHHS..
..OSMLLHHTHS..
...OSLLHTHMS..
....OSHHMSaabO
.....OSSabccaO
.......SbbaOO.
........OOO...''')
patch(g,39,25,'''SLHHS......
LHTTHS.....
LHTTHLSDO..
HLHTHHMSDO.
HLHHTHLMSDO
LHHTHLMMSDO
HHLHMMSbbDO
LLMMSabccaO
SSSSSbbaOO.
....OOO....''')
ghosthair(g,24,24)
patch(g,32,24,'HLbbH');save(n,'move',g)

g=ghostbody((26,12),(25,25),(19,39))
# Far arm reaches across the torso. Near arm reaches farther right.
patch(g,28,27,'''OSLHHHHSSS..................
SLHTTTHHHHLSSS..............
LHTTTTHHHHHHLHSS............
LHTTTHHLHHHHHLHHS...........
LHTTHHLLHHHHHLLHHS.........
SLHHHMLLHHHHHLLLHMSaabO....
.OSLLMMMLHHHLLLMMMSabcc.aO.
..OSSSSSLLLLLLMMSSSb.b.aO..
.......OSSSSSSSS....O.OO...''')
patch(g,39,26,'''SLHHHSSS............
LHTTHHHHLSSS........
HTTTTHHHHHHLSS......
HTTTHHLLHHHHLHSS....
HTTHHLLHHHHHLLHMSabO
LHHHMLHHHHLLLMMSaccaO
LHHMMLHHLLLLMSSSb.bO
SLLMMLLLLLMSSS...OO.
.OSSSSSSSSS.........''')
ghosthair(g,24,25);save(n,'attack',g)

g=ghostbody((25,13),(24,26),(19,40))
patch(g,20,29,'''...OSLHHS..
..OSLHTTHS.
.OSLHTTTHHS
OSLHTTHHLLS
OSLHHHHLLHS
.OSMMLLLHHS
..OSMLLHHTS
...OSLLHTHS
....OSHHMSS
.....OSMaabO
......Oabcc.aO
.......Sb.bO
........OOO''')
patch(g,39,29,'''SLHHS.....
LHTTHS....
LHTTHLSDO.
HLHTHHMSDO
HLHHTHLMSD
LHHTHLMMSO
HHLHMMSDO.
LLMMSDO...
SSSSSbbDO.
...abcc.aO
...Sb.bO..
....OOO...''')
ghosthair(g,24,26);save(n,'recover',g)

g=ghostbody((22,14),(22,27),(18,40))
patch(g,15,25,'''.......OSLHHS.
......OSLHTTHS
.....OSLHTTTHS
....OSLHTTHHLS
...OSLHHHHLLHS
..OSMMLLLHHHMS
.OSMLLHHTTHMS.
OSLLHTTTHMS...
OSHHHMMSaabO..
.OSSSabcc.aO..
.....Sb.bO....
......OOO.....''')
patch(g,34,25,'''....OSLHHS...
...OSLHTTHS..
..OSLHTTTHHS.
.OSLHTTHHLLHS
OSLHHHHLLHHS.
.OSMMLLLHHHS.
..OSMLLHHTHS.
...OSLLHTHMS.
....OSHHMSS..
.....OSaabO..
.....abcc.aO.
.....Sb.bO...
......OOO....''')
ghosthair(g,21,27);patch(g,31,21,'KK\nBB');save(n,'hit',g)

g=blank()
patch(g,22,33,'''........OOOOO..........
......OOSSSDDOO........
.....OSBBSSSDDDO.......
.....OBMBSSSbbDO.......
....OSBBSSDbbbaDO......
....OBBSSDDbKKbDO......
....OBSSDDDbbbaDO......
....OBSDDDDaRbaDO......
....OBSDDDDSSbaDO......
...OSBSDDDLLbbSDDO.....
..OSMBSDSHLHLLHLSDO....
.OSLHBSDSHLHLLHLHSDO...
OSLHHLBSDSHHLHLHHHSDO..
OSLHHLBSDSHLHLLHHHLSDO.
.OSMMLBSDSHLHLLLHMMSSO.
..OSbbDDSHLHLHLHMSSbbO.
...ObOOSLHHHMLHHLMObO..
......OSLHHHMLHHLLMSDO.
.....OSLHHMLHHHHLLMSDO.
....OSHHHMLHHHHLLMLSDO.
...OSLHHMLHHHHLLLMLSDO.
...OSLLLMMHHLLLMLMSDO..
....OSSSLLLSSSMLSSDO...
.....OOO..OOO..OOO.....''');save(n,'dead',g)

# ONE CONTACT-SHEET CORRECTION PASS -------------------------------------
def authored(n,p):return [list(r) for r in (ROOT/'source'/n/f'{p}.pxgrid').read_text().splitlines()]
# Close torn shoulder joins introduced by the different native cluster offsets.
g=authored('wild-boar','move')
patch(g,29,24,'''SSSSSS.
MLMMBSS
MMMMMBB
MMLMMBB
BBMMMBB
BSMMMLB
BSMLLMB
BSMMMMB
SMMMBBB
SMMBBBB
SMLLMB B
SMLMMB B
SMLMBB B
SMMBBB B
SMMMBB B
SMBBBB B
SBBBBB B
SBBSSS S
SSSSSS S
SSSSSS S
SSSSSS S''')
save('wild-boar','move',g)
g=authored('wild-boar','attack')
patch(g,30,26,'''SSSSSSS
MMMLMBB
MMLMMBB
MLMMMBB
BBMMMLB
BSMMMLB
BSMLLMB
BSMMMMB
SMMMBBB
SMMBBBB
SMLLMB B
SMLMMB B
SMLMBB B
SMMBBB B
SMMMBB B
SMBBBB B
SBBBBB B
SBBSSS S
SSSSSS S
SSSSSS S
SSSSSS S
SSSSSS S''')
save('wild-boar','attack',g)
# Rebuild the moving dokkaebi's right arm and reconnect the shaft to its grip.
g=authored('straw-dokkaebi','move')
clear(g,40,33,55,40)
patch(g,37,33,'''SSSS...
MLMMBS.
MLLMBS.
MMLMBS.
MMMLBS.
SMMBBS.
.SBBBS.
..SSS..''')
patch(g,40,32,'''....CbC
...CbC.
..CbC..
.CbC...
CbC....
MLMS...
MMBS...''')
save('straw-dokkaebi','move',g)
# Smooth the unintended waist seam while retaining hand-authored shirt folds.
g=authored('maiden-ghost','windup')
stamp(g,part(IDLE['maiden-ghost'],28,37,41,41),28,37)
ghosthair(g,24,26)
save('maiden-ghost','windup',g)
g=authored('maiden-ghost','move')
stamp(g,part(IDLE['maiden-ghost'],28,37,41,40),30,36)
ghosthair(g,24,24)
save('maiden-ghost','move',g)
# Contract correction inside the same pose-review pass: shorten the ghost reach
# with NEW literal arm rows, keeping the original torso centered near x32.
g=ghostbody((26,12),(25,25),(19,39))
patch(g,27,29,'''OSLHHHSSS...............
SLHTTHHHHLSS............
LHTTTHHHHHLHSS..........
LHTTHHLHHHHLLHHS........
LHTHHLLHHHLLLHMSaabO....
SLHHMLLHHLLLMMMSabcc.aO.
.OSLMMLLLLLMMSSSb.b.aO..
..OSSSSSSSSSS....O.OO...''')
patch(g,35,26,'''SLHHHSSS...........
LHTTHHHHLSS........
HTTTTHHHHHLSS......
HTTTHHLLHHHLHSS....
HTTHHLLHHHHLLHMSabO
LHHHMLHHHLLLMMSaccaO
LHHMMLHLLLLMSSSb.bO
SLLMMLLLLMSSS...OO.
.OSSSSSSSSS........''')
ghosthair(g,24,25);save('maiden-ghost','attack',g)
