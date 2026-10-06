from pathlib import Path
import json
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
pal=json.loads((R/'palette.json').read_text()); colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()};colors['.']=(0,0,0,0)
frames={}
for folder in ('poses','actions'):
 for p in sorted((R/folder).glob('*.pxgrid')):
  rr=p.read_text().splitlines()
  assert len(rr)==96 and all(len(r)==96 for r in rr),p
  im=Image.new('RGBA',(96,96));im.putdata([colors[c] for r in rr for c in r]);frames[p.stem]=im
  out=R/'preview';out.mkdir(exist_ok=True);im.save(out/(p.stem+'.png'))
  assert not any(c!='.' for r in [rr[0],rr[-1]] for c in r)
  assert all(r[0]=='.' and r[-1]=='.' for r in rr)
  assert all(c=='.' for r in rr[93:] for c in r)
  if p.stem=='idle_a':assert any(c!='.' for c in rr[92])
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for theme,bg in [('light',(225,221,205)),('dark',(27,30,43)),('checker',None)]:
 sheet=Image.new('RGB',(6*288,3*320),(48,49,57));d=ImageDraw.Draw(sheet)
 for i,n in enumerate(order):
  if n not in frames:continue
  tile=Image.new('RGB',(96,96),bg or (180,181,184))
  if bg is None:
   pix=tile.load()
   for y in range(96):
    for x in range(96):pix[x,y]=(208,209,211) if (x//8+y//8)%2 else (157,158,162)
  tile.paste(frames[n],mask=frames[n].getchannel('A'))
  x=(i%6)*288;y=(i//6)*320
  sheet.paste(tile.resize((288,288),Image.Resampling.NEAREST),(x,y+24));d.text((x+8,y+5),n,fill='white')
 sheet.save(R/'preview'/('contact-'+theme+'.png'))
# True 1x native sheet, alternating light/dark backgrounds.
sheet=Image.new('RGB',(576,324),(210,207,195));d=ImageDraw.Draw(sheet)
for i,n in enumerate(order):
 if n not in frames:continue
 x=i%6*96;y=i//6*108
 sheet.paste(frames[n],(x,y+12),frames[n]);d.text((x,y),n,fill=(30,30,40))
sheet.save(R/'preview'/'native.png')
motions={'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),'attack':(['idle_a','windup','move','attack','recover','idle_a'],[220,280,140,180,240,280]),'hit':(['idle_a','hit','recover','idle_a'],[300,280,220,300]),'dead':(['idle_a','hit','dead'],[240,180,1100]),'skill':(['skill_a','skill_b','skill_c','idle_a'],[380,260,320,320]),'poison':(['poison_a','poison_b'],[450,450]),'stun':(['stun_a','stun_b'],[480,480]),'sleep':(['sleep_a','sleep_b'],[700,850])}
# Fixed lossless palette: transparent slot zero, all 18 original RGB colors.
pp=[0,0,0]+[v for color in colors.values() if color[3] for v in color[:3]];pp+= [0]*(768-len(pp))
for n,(ns,ms) in motions.items():
 if not all(f in frames for f in ns):continue
 ims=[]
 for f in ns:
  im=Image.new('P',(96,96));im.putpalette(pp)
  lookup={rgba:j+1 for j,rgba in enumerate(v for v in colors.values() if v[3])};lookup[(0,0,0,0)]=0
  im.putdata([lookup[v] for v in frames[f].get_flattened_data()]);im.info['transparency']=0;ims.append(im)
 ims[0].save(R/'preview'/(n+'.gif'),save_all=True,append_images=ims[1:],duration=ms,loop=0,transparency=0,disposal=2,optimize=False)
print('Rendered',len(frames),'literal frames')
# Native transparent runtime and complete-action sheets, pure packing of exact pixels.
for name,names,cols in [('poses-sheet',order[:9],3),('suite-sheet',order,3)]:
 sheet=Image.new('RGBA',(cols*96,((len(names)+cols-1)//cols)*96))
 for i,n in enumerate(names):sheet.paste(frames[n],((i%cols)*96,(i//cols)*96))
 sheet.save(R/'preview'/(name+'.png'))
# GIF readback: original colours and timing; diagnostic only, no asset changes.
receipts={}
for n,(ns,ms) in motions.items():
 with Image.open(R/'preview'/(n+'.gif')) as gif:
  compared=[]
  for i,f in enumerate(ns):
   gif.seek(i);actual=gif.convert('RGBA');duration=gif.info['duration']
   equal=actual.tobytes()==frames[f].tobytes()
   compared.append({'frame':f,'durationMs':duration,'exactRgba':equal})
  receipts[n]=compared
(R/'preview'/'gif-readback.json').write_text(json.dumps(receipts,indent=2)+'\n')
print('GIF readback:',sum(len(v) for v in receipts.values()),'displayed frames, exact:',all(f['exactRgba'] for v in receipts.values() for f in v))
# Storyboard comes from decoded GIF frames, not an approximation of the animations.
story=Image.new('RGB',(1152,8*224),(39,42,55));sd=ImageDraw.Draw(story)
for row,(n,(ns,ms)) in enumerate(motions.items()):
 sd.text((8,row*224+3),n,fill=(246,229,191))
 with Image.open(R/'preview'/(n+'.gif')) as gif:
  for j,f in enumerate(ns):
   gif.seek(j);tile=Image.new('RGB',(96,96),(222,218,203));im=gif.convert('RGBA');tile.paste(im,mask=im.getchannel('A'))
   story.paste(tile.resize((192,192),Image.Resampling.NEAREST),(j*192,row*224+18))
   sd.text((j*192+4,row*224+211),f+' '+str(ms[j])+'ms',fill=(246,229,191))
story.save(R/'preview'/'gif-storyboard.png')
