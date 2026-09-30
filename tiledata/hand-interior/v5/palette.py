# Fixed master palette for hand-pixelled OPRN objects: 11 ramps x 6 steps + a shared outline.
# Ramps hue-shift: shadows go cool (toward purple/blue), highlights go warm (toward yellow). Values are spread wide so
# objects have real contrast next to the chipset (chipset object luma p10/p50/p90 = 36/80/207).
# Every material in px2.PAL is re-pointed onto one of these ramps (tone 0 = the ramp's darkest = outline).
OUT='#140c1c'
RAMPS={
 'wood':   ['#310f00','#431d00','#603408','#744c2a','#885a26','#aa7a08'],
 'roofw':  ['#3a1428','#582840','#863736','#a8552f','#c27536','#e09a50'],
 'roofc':  ['#141230','#201e45','#2e2b66','#3f3a8c','#524cb1','#7a74d6'],
 'stone':  ['#1b2230','#2b3243','#4a5266','#747b8f','#9ca2b2','#c8ccd6'],
 'plaster':['#51283d','#703f57','#9e8d83','#bcaaa0','#d9d2be','#ecd6c6'],
 'straw':  ['#3a2410','#6c4a18','#a07424','#cfa33a','#eed06a','#fbeeaa'],
 'red':    ['#2c0c1c','#5a1426','#8e2030','#c43a36','#e8684c','#f8a07a'],
 'leaf':   ['#0e2418','#1a4024','#2c622c','#4a8a34','#72b040','#a8d664'],
 'water':  ['#0c2430','#164a54','#217078','#3a9a96','#6cc8b8','#b6ecdc'],
 'glass':  ['#101c3c','#1c3a78','#3466b4','#6aa0dc','#b4dcf4','#eef8ff'],
 'moss':   ['#1c2418','#34402a','#4e5e38','#6c7c48','#8e9c5c','#b8c47c'],
}
# CHIP ramps: every colour is one the chipset itself uses (sampled from its barrel/door, roofs, statue, plaster, banner,
# fire, trees, water and window tiles). The chipset draws a material with 3-5 colours, so ramps repeat on purpose.
# Window glass is the chipset's teal, not blue; tone 0 (outline) is the chipset's own darkest for that family.
RAMPS_CHIP={
 'wood':   ['#312210','#452a17','#633712','#6f4725','#885a26','#b77541'],
 'roofw':  ['#562945','#582840','#863736','#c27536','#cd7121','#ec9900'],
 'roofc':  ['#201e45','#2e2b66','#2e2b66','#524cb1','#7e7a8b','#cbc6e5'],
 'stone':  ['#2b3934','#3e403d','#595b58','#929491','#c4c6c3','#dee0dd'],
 'plaster':['#51283d','#9e8d83','#bcaaa0','#d9d2be','#ecd6c6','#f7fdff'],
 'straw':  ['#431d00','#714210','#845c1f','#aa7a08','#fbc10d','#ecdb95'],
 'thatch': ['#452a17','#714210','#845c1f','#aa7a08','#b77541','#ecdb95'],   # rope, hay, thatch: the chipset's duller browns, not banner gold
 'red':    ['#562945','#9e2514','#a40100','#dd2912','#e0482a','#ec9900'],
 'leaf':   ['#143a27','#205030','#4b8232','#58a035','#73b83e','#8fd24a'],
 'water':  ['#143a27','#1c4a44','#21584e','#3fa2ae','#7d98a2','#a7d4db'],
 'glass':  ['#071528','#212d42','#3fa2ae','#3fa2ae','#a7d4db','#f7fdff'],
 'moss':   ['#1c2626','#143a27','#205030','#595513','#4b8232','#9d9c33'],
}
OUT_CHIP={'thatch':'#312210','wood':'#1b1024','roofw':'#2b203f','roofc':'#1b1024','stone':'#1c2626','plaster':'#2b203f','straw':'#312210',
 'red':'#2b203f','leaf':'#071528','water':'#071528','glass':'#071528','moss':'#071528'}
MAP={'wood':'wood','bark':'wood','dirt':'wood','rope':'thatch','gold':'straw','fire':'straw',
     'cloth':'roofw','clay':'roofw','slate':'roofc','shroom':'roofc',
     'stone':'stone','iron':'stone','dark':'stone','mstone':'stone',
     'plaster':'plaster','cream':'plaster','bone':'plaster','stem':'plaster',
     'red':'red','pink':'red','leaf':'leaf','lily':'leaf','emer':'leaf','moss':'moss',
     'teal':'water','cryst':'glass'}
def _mix(a,b,t):
    a=[int(a[i:i+2],16) for i in (1,3,5)]; b=[int(b[i:i+2],16) for i in (1,3,5)]
    return '#%02x%02x%02x'%tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
import os
CHIPPAL=os.environ.get('PAL_CHIP','1')=='1'
def ramp7(name):
    if CHIPPAL: return [OUT_CHIP[name]]+RAMPS_CHIP[name]
    if name=='thatch': name='straw'
    # tone 0 (the outline) is the ramp's own darkest pushed toward OUT: a coloured outline like the chipset's trees,
    # not one shared black line around everything
    r=RAMPS[name]; return [_mix(r[0],OUT,0.45)]+r
def apply():
    import px2
    px2.PIXEL_NOISE=1.0; px2.GRAIN_SCALE=1.0; px2.GRAIN_AMP=1.0    # the chipset props carry a 1px speckle
    for mat,rn in MAP.items(): px2.PAL[mat]=ramp7(rn)
    px2.PAL['dark']=[OUT,'#140c1c','#1e1628','#24222e','#2e2c3a','#3c3c4c','#4a4a5a'] if not CHIPPAL else \
        ['#071528','#071528','#1b1024','#1c2626','#2b203f','#2b3934','#3e403d']
def colours():
    R=RAMPS_CHIP if CHIPPAL else RAMPS
    return sorted(set([OUT]+[c for r in R.values() for c in r]+(list(OUT_CHIP.values()) if CHIPPAL else [])))
