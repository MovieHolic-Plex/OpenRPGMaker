from pathlib import Path
from PIL import Image, ImageDraw
import json
R=Path(__file__).parent; P=json.loads((R/'palette.json').read_text()); out=R/'progress'
poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
actions=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
ims={}
for folder,names in [('poses',poses),('actions',actions)]:
 for name in names:
  rows=(R/folder/(name+'.pxgrid')).read_text().splitlines()
  if len(rows)!=128 or set(map(len,rows))!={128}:raise ValueError(name+' dimensions')
  im=Image.new('RGBA',(128,128)); ink=[]
  for y,row in enumerate(rows):
   for x,s in enumerate(row):
    if s!='.':
     im.putpixel((x,y),tuple(bytes.fromhex(P[s][1:]))+(255,));ink.append((x,y))
  box=(min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink))
  print(name,box,'ink',len(ink))
  im.save(out/(name+'.png'));ims[name]=im
  im.resize((512,512),Image.Resampling.NEAREST).save(out/(name+'-4x.png'))
for n,names in [('idle',poses[:3]),('attack',poses[3:6]),('recovery',poses[6:]),('skill',actions[:3]),('poison-stun',actions[3:7]),('sleep',actions[7:])]:
 sheet=Image.new('RGB',(512*len(names),540),'#28313d');d=ImageDraw.Draw(sheet)
 for i,name in enumerate(names):
  im=ims[name].resize((512,512),Image.Resampling.NEAREST);sheet.paste(im,(512*i,22),im);d.text((512*i+12,6),name,fill='#fff0cf')
 sheet.save(out/(n+'-sheet.png'))
# Diagnostics are nearest enlargements of decoded literal rows, never art sources.
clips={'idle':(poses[:3],[300,300,300]),'attack':(['idle_a','windup','move','attack','recover','idle_a'],[350,280,120,150,240,350]),'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[350,450,180,320,350]),'poison':(['poison_a','poison_b'],[420,420]),'stun':(['stun_a','stun_b'],[360,360]),'sleep':(['sleep_a','sleep_b'],[650,650]),'dead':(['hit','dead'],[180,1100])}
for name,(frames,holds) in clips.items():
 gs=[]
 for f in frames:
  bg=Image.new('RGBA',(128,128),'#28313d');bg.alpha_composite(ims[f]);gs.append(bg.convert('RGB').resize((1024,1024),Image.Resampling.NEAREST))
 gs[0].save(out/(name+'-8x.gif'),save_all=True,append_images=gs[1:],duration=holds,loop=0,disposal=2,optimize=False)
