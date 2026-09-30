import os
import sys; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import importlib
mods=[importlib.import_module(m) for m in sys.argv[2].split(',')]
from sheet2 import card,row
S=int(sys.argv[3]) if len(sys.argv)>3 else 5
ims=[]
for m in mods:
    for n,f in m.P.items(): ims.append(card(f().img(),wat=n in m.WATER,S=S)[0])
# wrap rows at 1800 px
rows=[];cur=[];w=0
for i in ims:
    if w+i.width>1800 and cur: rows.append(cur); cur=[]; w=0
    cur.append(i); w+=i.width+8
rows.append(cur)
from PIL import Image
parts=[]
for k,r in enumerate(rows): OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'out'); os.makedirs(OUT,exist_ok=True); row(r,os.path.join(OUT,f'_r{k}.png')); parts.append(Image.open(os.path.join(OUT,f'_r{k}.png')))
H=sum(p.height for p in parts)+8*len(parts); W=max(p.width for p in parts)
out=Image.new('RGBA',(W,H),(27,28,31,255)); y=0
for p in parts: out.paste(p,(0,y)); y+=p.height+8
out.save(sys.argv[1])
