"""Decode saved GIFs into labelled diagnostic filmstrips; never edits art."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
for path in sorted((ROOT/'preview'/'motions').glob('*.gif')):
    gif=Image.open(path)
    out=Image.new('RGB',(gif.n_frames*128,148),'#F1E8D5')
    d=ImageDraw.Draw(out)
    for i in range(gif.n_frames):
        gif.seek(i);im=gif.convert('RGBA')
        d.text((i*128+3,3),str(i+1)+' '+str(gif.info['duration'])+'ms',fill='#142934')
        out.paste(im,(i*128,20),im)
    out.save(ROOT/'preview'/'motions'/(path.stem+'-strip-native.png'))
    out.resize((out.width*2,out.height*2),Image.Resampling.NEAREST).save(ROOT/'preview'/'motions'/(path.stem+'-strip.png'))
# Contact sheets on all three backgrounds, all 18 current native source images.
names=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for bg in ['light','dark','checker']:
    sheet=Image.new('RGB',(6*128,3*148),'#F1E8D5' if bg=='light' else '#252C3A')
    d=ImageDraw.Draw(sheet)
    for i,n in enumerate(names):
        x=i%6*128;y=i//6*148
        if bg=='checker':
            for yy in range(y+20,y+148,8):
                for xx in range(x,x+128,8):
                    d.rectangle((xx,yy,xx+7,yy+7),fill='#9199A5' if (xx//8+yy//8)%2 else '#717986')
        im=Image.open(ROOT/'preview'/(n+'.png'));sheet.paste(im,(x,y+20),im)
        d.text((x+2,y+2),n,fill='#142934' if bg=='light' else '#FFF0BE')
    sheet.save(ROOT/'preview'/('all-native-'+bg+'.png'))
    sheet.resize((1536,888),Image.Resampling.NEAREST).save(ROOT/'preview'/('all-'+bg+'.png'))
# Harness-compatible 3x3 pose sheet and an independent 3x3 action sheet.
for sheet_name,items in [('poses',names[:9]),('actions',names[9:])]:
    sheet=Image.new('RGBA',(384,384))
    for i,n in enumerate(items):sheet.paste(Image.open(ROOT/'preview'/(n+'.png')),(i%3*128,i//3*128))
    sheet.save(ROOT/'preview'/(sheet_name+'-sheet.png'))
