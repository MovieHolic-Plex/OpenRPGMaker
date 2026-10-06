"""Decode the saved GIFs for visual inspection at 1x and nearest-neighbor 3x."""
from pathlib import Path
from PIL import Image, ImageDraw
from render import MOTIONS
ROOT=Path(__file__).resolve().parent
GROUPS={'combat':['idle','attack','hit','dead'],'actions':['skill','poison','stun','sleep']}
for group,names in GROUPS.items():
    sheet=Image.new('RGB',(1260,1220),'#e7e2d6')
    draw=ImageDraw.Draw(sheet)
    for row,motion in enumerate(names):
        decoded=Image.open(ROOT/'gifs'/(motion+'.gif'))
        pose_names,holds=MOTIONS[motion]
        for col,pose in enumerate(pose_names):
            decoded.seek(col)
            frame=decoded.convert('RGBA')
            x,y=col*210,row*305
            draw.text((x+5,y+3),f'{motion}: {pose}',fill='#222b30')
            draw.text((x+5,y+18),f'{decoded.info["duration"]} ms',fill='#222b30')
            sheet.paste(frame,(x+73,y+38),frame)
            scaled=frame.resize((192,192),Image.Resampling.NEAREST)
            sheet.paste(scaled,(x+9,y+108),scaled)
    sheet.save(ROOT/'previews'/('gif-storyboard-'+group+'.png'))
print('Opened and decoded all eight GIFs into native/3x storyboards.')
