"""Read saved GIFs and make labeled native/nearest-neighbor diagnostic panels.
Does not draw or correct sprite pixels.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
import json,hashlib
ROOT=Path(__file__).resolve().parent
P=json.loads((ROOT/'palette.json').read_text())
POSES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
FAMILIES=[POSES[:6],POSES[6:]+ACTIONS[:3],ACTIONS[3:]]
for page,names in enumerate(FAMILIES,1):
    for bg_name,bg_color in [('light',(239,232,217)),('dark',(37,38,49)),('checker',None)]:
        sheet=Image.new('RGB',(3*208,2*224),bg_color or (190,194,200))
        draw=ImageDraw.Draw(sheet)
        for i,n in enumerate(names):
            im=Image.open(ROOT/'previews'/f'{n}.png').convert('RGBA')
            tile=Image.new('RGBA',(64,64),(*bg_color,255) if bg_color else (0,0,0,255))
            if bg_color is None:
                tile.putdata([(174,180,186,255) if (x//8+y//8)%2 else (211,215,218,255) for y in range(64) for x in range(64)])
            tile.alpha_composite(im)
            x,y=i%3*208,i//3*224
            sheet.paste(tile.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(x+8,y+24))
            draw.text((x+8,y+6),n,fill='white' if bg_name=='dark' else 'black')
        sheet.save(ROOT/'previews'/f'page-{page}-{bg_name}-3x.png')
motion_report={}
SEQUENCES={
'idle':['idle_a','idle_b','idle_c','idle_b'],
'attack':['idle_a','windup','move','attack','recover','idle_a'],
'hit':['idle_a','hit','recover','idle_a'],
'dead':['hit','dead'],
'skill':['idle_a','skill_a','skill_b','skill_c','idle_a'],
'poison':['poison_a','poison_b'],
'stun':['stun_a','stun_b'],
'sleep':['sleep_a','sleep_b']}
for page,motions in enumerate([['idle','attack','hit','dead'],['skill','poison','stun','sleep']],1):
    sheet=Image.new('RGB',(6*200,4*220),(37,38,49));draw=ImageDraw.Draw(sheet)
    native=Image.new('RGB',(6*80,4*90),(37,38,49));nd=ImageDraw.Draw(native)
    for y,m in enumerate(motions):
        gif=Image.open(ROOT/'previews'/f'{m}.gif')
        durations=[]
        mismatches=[]
        for x,cel in enumerate(ImageSequence.Iterator(gif)):
            frame=cel.convert('RGBA')
            expected=Image.open(ROOT/'previews'/f'{SEQUENCES[m][x]}.png').convert('RGBA')
            mismatches.append(sum(1 for a,b in zip(frame.getdata(),expected.getdata()) if a[3]!=b[3] or (a[3] and a[:3]!=b[:3])))
            bg=Image.new('RGBA',(64,64),(37,38,49,255));bg.alpha_composite(frame)
            durations.append(cel.info.get('duration'))
            sheet.paste(bg.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(x*200+4,y*220+23))
            draw.text((x*200+4,y*220+5),f'{m} {x+1} / {durations[-1]}ms',fill='white')
            native.paste(bg.convert('RGB'),(x*80+8,y*90+20))
            nd.text((x*80+2,y*90+4),f'{m} {x+1}',fill='white')
        motion_report[m]={'frames':gif.n_frames,'holdsMs':durations,'size':list(gif.size),'pixelDifferencesFromPNG':mismatches}
    sheet.save(ROOT/'previews'/f'gif-readback-{page}-3x.png')
    native.save(ROOT/'previews'/f'gif-readback-{page}-1x.png')
report={'paletteColors':len(P),'frames':{},'motions':motion_report}
for name in POSES+ACTIONS:
    directory='poses' if name in POSES else 'actions'
    path=ROOT/directory/f'{name}.pxgrid';rows=path.read_text().splitlines()
    ink=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.']
    report['frames'][name]={'rows':len(rows),'rowWidths':sorted(set(map(len,rows))),
                          'inkBounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],
                          'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(ROOT/'previews'/'readback.json').write_text(json.dumps(report,indent=2)+'\n')
print('Read all 8 GIFs; diagnostic panels saved.')
