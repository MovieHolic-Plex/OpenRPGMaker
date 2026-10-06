"""Literal cluster authoring. No geometry, pose transforms, or shading algorithms.
Each row below is hand chosen. Unchanged fabric/head clusters can be explicitly
reused; changed regions have independent literal rows. Output is full 96x96 ASCII.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PALETTE={
'K':'#171922','H':'#292B3B','h':'#51516A',
'S':'#AD7D81','s':'#E0BAB1','L':'#FFE3C9',
'P':'#432741','p':'#77415E','V':'#AA6C82',
'T':'#173E43','t':'#24666A','u':'#4C9891','U':'#87B9A7',
'g':'#885735','G':'#D2A35D','r':'#771F42','R':'#C53F59','e':'#F49489'}
FRAMES={}
class Ink(list):
    """Explicit short coordinate strings, layered onto existing literal rows."""
    pass
def block(y,x,rows):
    return [(y+i,x,row) for i,row in enumerate(rows.strip('\n').splitlines())]
def frame(name,*clusters):
    canvas=[list('.'*96) for _ in range(96)]
    for cluster in clusters:
        for y,x,row in cluster:
            assert 0<=x and x+len(row)<=96,(name,y,x,len(row))
            if isinstance(cluster,Ink): canvas[y][x:x+len(row)]=list(row)
            else: canvas[y]=list('.'*x+row+'.'*(96-x-len(row)))
    FRAMES[name]=[''.join(row) for row in canvas]
# First resolved standing silhouette. Head 23px; visible skin is a small 3/4 face.
HEAD=block(9,32,"""
........KKKKK
.......KHhhHHK
......KHhhhhHHK
......KHHhhHHHK.........GG
.....KHHHHHHHHKK.....GGGg
....KHHhhhhHHHHHKKGGGgg
...KHhhhhhhhHHHHHGgg
..KHHhhhhHHHHHHHHHHK
..KHhhhHHHHHHHHHHHHHK
.KHhhhHHHHHssssssSHHK
.KHhhHHHHHLLLssssssHK
.KHhHHHHHLLLLsssssssK
.KHHHHHHHLLLsssssSSsK
.KHHHHHHHLLLssKssssssK
.KHHHHHHHLLsssssKsLsK
.KHHHHHHHLLsssssssssK
.KHHHHHHHLLsssssssSK
.KHHHHHHHSssSSsssSK
.KHHHHHHHHSsssRssK
.KHHHHHHHHKssssSK
.KHHhHHHHHKSSssK
.KHHhHHHHHHKSSK
.KHHhHHHHHHKssK
.KHHHHHHHHKKssSK
..KHHHHHHKPLssSPK
..KHHHHHKPVLssSPpK
""")
TORSO=block(35,16,"""
................KKHHHHKPVLsSPppPK
.............KKKpVKKKKPVVLSPppppPKKK
...........KKpVVVVVVVVVVVLSPppppppppKK
..........KpVVVVVVVVVVVVVLSPpppppppppPK
.........KpVVVVVVVppVVVVVLLSPpppppppppPK
........KpVVVVVVppppVVVVLLLSPppppppppppPK
.......KpVVVVVVpppppVVVLLLpSPppppppppppPK
......KpVVVVVVppppppVVLpppppSPpppVVVppppPK
.....KpVVVVVVpppppppVLpppppppSPppVVVVppppPK......g
....KpVVVVVVppppppppVppppppppppPppVVVpppKsssKggGGGg
...KpVVVVVVppppppppVVppppppppppPPppVVppKLLssGGGGGggg
..KpVVVVVVpppppppppVppppppppppPPPKppppKLLssSGGGggg
..KpVVVVVppppppppppVpppppppppPPPPPKppppKssSKggg
.KpVVVVVppppppppppVVppppppppPPPPPPKppppPKKK..r
.KpVVVVpppppppppppVppppppppPPPPPPPKppppPPK..r
.KpVVVppppppppppppVppppppppPPPPPPPKppppPPK.r
.KpVVppppppppppppVVppppppPPPPPPPPPKpppPPPK.r
.KpVpppppppppppppVpppppPPPPPPPPPPPKppPPPK.r
.KppppppppppppppVppppPPPPPggGGgggKKppPPK..r
.KpppppppppppppVVppPPPPPggGGGGggggKPPPPrRRr
.KppppppppppppVVppPPPPKKGgggggggKKPPPPrReRRr
.KppppppppppVVVppPPPKKttuuuuutTTTKKKPrReRRr
..KpppppppVVVppPPPKKttuUUUuuutTTTTTKKssReRRr
..KpppppVVVVppPPPKttuUUUUUuuutTTTTTTKLLsRRr
...KppVVVVppPPPPKttuUUUUUuuuuttTTTTTTKssrr
....KpVpppPPPPPKttuuUUUUuuuuttTTTTTTTKKK
.....KggGGgggPKttuuUUUUuuuuttTTTTTTTTTK
......KgggggPKttuuuUUUuuuuttTTTTTTTTTTTK
""")
SKIRT=block(63,20,"""
..........KttuuuUUUuuuuuttTTTTTTTTTTTK
.........KttuuuuUUuuuuuuttTTTTTTTTTTTTK
.........KttuuuuUUuuuuuuttTTTTTTTTTTTTK
........KttuuuuuUuuuuuutttTTTTTTTTTTTTK
........KttuuuuuuuuuuuutttTTTTTTTTTTTTTK
.......KttuuuuuuuuuuuuttttTTTTTTTTTTTTTK
.......KttuuuuuuuuuuuuttttTTTTTTTTTTTTTK
......KttuuuuuuuuuuuuutttttTTTTTTTTTTTTTK
......KttuuuuuuuuuuuuutttttTTTTTTTTTTTTTK
.....KttuuuuuuutuuuuttuuuttTTTTTTTTTTTTTK
.....KttuuuuuuttuuuutuuuuttTTTTTTTTTTTTTK
....KttuuuuuutttuuuutuuuutttTTTTTTTTTTTTK
....KttuuuuuutttuuuutuuuuutttTTTTTTTTTTTK
...KttuuuuuuttttuuuutuuuuutttTTTTTTTTTTTTK
...KttuuuuuuttttuuuutuuuuuttttTTTTTTTTTTTK
..KttuuuuuutttttuuuutuuuuutttttTTTTTTTTTTK
..KttuuuuuutttttuuuutuuuuutttttTTTTTTTTTTK
.KttuuuuuuttttttuuuutuuuuttTTttTTTTTTTTTTK
.KttuuuuttTTttttuuuutuuuttTTTtttTTTTTTTTTK
KttuuuttTTTTttttuuutttttTTTTTTtttTTTTTTTTK
KttuuttTTTTTttttuutttttTTTTTTTttttTTTTTTTK
KttuuttTTTTTTtttuutttTTTTTTTTTttttTTTTTTTK
KttttTTTTTTTTTttttttTTTTTTTTTTTtttTTTTTTTK
.KTTTTTTTTTTTTTTKKKKTTTTTTTTTTTTTKKKKKKK
..KKKKKKKKKKKKKK....KKKKKKKKKKKKKK
""")
FEET=block(88,20,"""
.............KLLssK........KLLssK
.............KLLssK........KLLssK
............KHHssSK.......KHHssSK
...........KHHHHHHHK......KHHHHHHHK
...........KKKKKKKKK......KKKKKKKKK
""")
def save():
    (ROOT/'poses').mkdir(exist_ok=True)
    (ROOT/'actions').mkdir(exist_ok=True)
    (ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    for name,rows in FRAMES.items():
        folder='poses' if name in ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'] else 'actions'
        (ROOT/folder/(name+'.pxgrid')).write_text('\n'.join(rows)+'\n')
if __name__=='__main__': save()
