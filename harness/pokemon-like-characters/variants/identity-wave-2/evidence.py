"""Decode real submitted GIFs to compare the old and new walking cels."""
from pathlib import Path
import json,argparse,os
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent;H=P.parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--data',type=Path,default=Path(os.environ.get('POKEMON_HARNESS_DATA',str(H/'.data'))));args=parser.parse_args();data=args.data
ids=json.loads((data/'waves/identity-wave-2.json').read_text())['candidateIds']
queued=[{'id':id,'role':json.loads((data/'candidates'/id/'package.json').read_text())['role']} for id in ids]
oldids=json.loads((data/'waves/full-cast-v1.json').read_text())['candidateIds']
pairs=[]
for item in queued:
 role=item['role'];old=next(x for x in oldids if x.startswith(role+'-'));pair=[]
 for id in [old,item['id']]:
  g=Image.open(data/'candidates'/id/'walk.gif');frames=[]
  for n in range(g.n_frames):g.seek(n);frames.append(g.convert('RGBA').copy())
  pair.append(frames)
 pairs.append(pair)
 # All four actual new GIF phases, no reconstructed/tweened poses.
 decoded=Image.new('RGBA',(68,128),'#e8e5d9')
 for n,f in enumerate(pair[1]):decoded.alpha_composite(f,(0,n*32))
 decoded.resize((340,640),Image.Resampling.NEAREST).save(P/(role+'-decoded.png'))
frames=[]
for n in range(4):
 im=Image.new('RGBA',(384,436),'#e8e5d9');draw=ImageDraw.Draw(im);draw.fontmode='1'
 for c,item in enumerate(queued):
  draw.text((c*128+18,2),item['role'].upper(),fill='#283b4a');draw.text((c*128+12,16),'V1',fill='#283b4a');draw.text((c*128+76,16),'V2',fill='#283b4a')
  for side in range(2):
   for direction in range(4):
    tile=pairs[c][side][n].crop((direction*17,0,direction*17+16,32))
    im.alpha_composite(tile.resize((48,96),Image.Resampling.NEAREST),(c*128+side*64+8,34+direction*100))
 frames.append(im)
colors=sorted({p[:3] for f in frames for p in f.get_flattened_data()});assert len(colors)<=256
pal=[v for c in colors for v in c]+[0]*(768-3*len(colors));lookup={c:i for i,c in enumerate(colors)};indexed=[]
for f in frames:
 g=Image.new('P',f.size);g.putpalette(pal);g.putdata([lookup[p[:3]] for p in f.get_flattened_data()]);indexed.append(g)
indexed[0].save(P/'comparison.gif',save_all=True,append_images=indexed[1:],duration=130,loop=0,disposal=2,optimize=False)
frames[1].save(P/'comparison.png')
print('Encoded native GIF comparison without color quantization:',len(colors),'colors')
