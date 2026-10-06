"""Explicit native head edits and palette variants on adopted Brendan walking poses.
Derived original-game pixels, not wholly independently authored character art.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,json,hashlib
ROOT=Path(__file__).resolve().parents[4]
SOURCE=ROOT/'scripts/asset-gen/pokemon-characters/references/brendan-walking.png'
PIN='f33ec07a5fd17f4422455f8bc55cd3d3522fa65c3bf740ecbdc00da705eaa0d1'
# Explicit full-width rows, final native coordinates. '.' is transparent.
# Hair has a round skull and connected bangs; caps have a flat crown/brim.
HEADS={
 'hair':{
  'down':[(4,'55555555'),(3,'5999999995'),(3,'59EEE99995'),(2,'5999EEE99995'),(2,'F5999999955F'),(2,'F5999999955F'),(2,'F8111111118F'),(2,'F8111111118F')],
  'up':[(4,'55555555'),(3,'5999999995'),(3,'59EEE99995'),(2,'599EEE999995'),(2,'F5999999995F'),(2,'F5999999995F'),(2,'F5999999995F'),(2,'F8999999998F')],
  'left':[(4,'5555555'),(3,'599999995'),(2,'59EEE99995'),(2,'59EE9999995'),(2,'F599999995F'),(2,'F599999995F'),(2,'F911188995F'),(2,'F111188885F')]},
 'cap':{
  'down':[(4,'55555555'),(3,'5999999995'),(3,'59EEEE9995'),(2,'599EEEE99995'),(2,'F9999999999F'),(2,'FBBBBBBBBBBF'),(2,'FBAAAAAAAABF'),(2,'F5888888885F')],
  'up':[(4,'55555555'),(3,'5999999995'),(3,'59EEEE9995'),(2,'599EEEE99995'),(2,'F9999999999F'),(2,'FBBBBBBBBBBF'),(2,'FBAAAAAAAABF'),(2,'F8889999888F')],
  'left':[(4,'5555555'),(3,'599999995'),(3,'59EEE9995'),(2,'599EEEE9995'),(2,'F999999999F'),(1,'FBBBBBBBBBBF'),(1,'FBAAAAAAAABF'),(2,'F888888899F')]},
 'brim':{
  'down':[(4,'55555555'),(3,'5999999995'),(3,'59EEEE9995'),(2,'599EEEE99995'),(2,'F9999999999F'),(1,'FBBBBBBBBBBBBF'),(1,'FAAAAAAAAAAAAF'),(2,'F5888888885F')],
  'up':[(4,'55555555'),(3,'5999999995'),(3,'59EEEE9995'),(2,'599EEEE99995'),(2,'F9999999999F'),(1,'FBBBBBBBBBBBBF'),(1,'FAAAAAAAAAAAAF'),(2,'F8889999888F')],
  'left':[(4,'5555555'),(3,'599999995'),(3,'59EEE9995'),(2,'599EEEE9995'),(2,'F999999999F'),(0,'FBBBBBBBBBBBBF'),(0,'FAAAAAAAAAAAAF'),(2,'F888888899F')]}}

def main():
 p=argparse.ArgumentParser();p.add_argument('--seed',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();seed=json.loads(a.seed.read_text());assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==PIN
 s=Image.open(SOURCE);assert s.mode=='P' and s.size==(144,32);palette=s.getpalette();background=ROOT/'verify-shots/pokemon-hero-reference-fidelity/runtime-walking.png';results=[]
 for item in seed['candidates']:
  folder=a.out/item['role']/item['variant'];folder.mkdir(parents=True,exist_ok=True)
  pal=[tuple(palette[i*3:i*3+3]) for i in range(16)]
  for index,color in item['palette'].items():pal[int(index,16)]=tuple(bytes.fromhex(color))
  atlas=Image.new('RGBA',(48,128))
  for row,(direction,seq) in enumerate([('up',[5,1,6]),('right',[7,2,8]),('down',[3,0,4]),('left',[7,2,8])]):
   for col,index in enumerate(seq):
    raw=s.crop((index*16,0,(index+1)*16,32));view='left' if direction=='right' else direction
    # Original bob preserved. Each patch row is authored explicitly; no shape tracing.
    top=10 if col==1 else 11
    for y in range(top,top+8):
     for x in range(16):raw.putpixel((x,y),0)
    for offset,(x,text) in enumerate(HEADS[item['head']][view]):
     assert x>=0 and x+len(text)<=16
     for dx,ch in enumerate(text):raw.putpixel((x+dx,top+offset),0 if ch=='.' else int(ch,16))
    frame=Image.new('RGBA',(16,32));frame.putdata([(*pal[v],255) if v else (0,0,0,0) for v in raw.get_flattened_data()])
    if direction=='right':frame=frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    atlas.paste(frame,(col*16,row*32))
  atlas.save(folder/'charset.png');colors=sorted({p[:3] for p in atlas.get_flattened_data() if p[3]});assert len(colors)<=15
  lookup={c:i+1 for i,c in enumerate(colors)};gifpal=[0,0,0]+[v for c in colors for v in c];gifpal+=[0]*(768-len(gifpal));frames=[]
  for phase in [0,1,2,1]:
   frame=Image.new('RGBA',(68,32))
   for row in range(4):frame.paste(atlas.crop((phase*16,row*32,(phase+1)*16,(row+1)*32)),(row*17,0))
   indexed=Image.new('P',frame.size);indexed.putpalette(gifpal);indexed.putdata([lookup[p[:3]] if p[3] else 0 for p in frame.get_flattened_data()]);frames.append(indexed)
  frames[0].save(folder/'walk.gif',save_all=True,append_images=frames[1:],loop=0,duration=130,transparency=0,disposal=2,optimize=False)
  # Placement mockup with existing original hero retained for scale comparison.
  context=Image.open(background).convert('RGBA').resize((480,360),Image.Resampling.NEAREST);new=atlas.crop((16,64,32,96)).resize((32,64),Image.Resampling.NEAREST);context.alpha_composite(new,(235,252));context.save(folder/'context.png')
  meta={k:item[k] for k in ['role','label','variant','description']};meta['sourceNote']='브렌던 원본 몸·걷기에서 머리 행과 팔레트를 수정한 파생 후보. 완전 신규 원화 아님.'
  (folder/'candidate.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
  (folder/'recipe.json').write_text(json.dumps({'sourceSha256':PIN,'sourceUrl':'https://github.com/pret/pokeemerald/blob/master/graphics/object_events/pics/people/brendan/walking.png','originalArtwork':'Nintendo / Game Freak / Creatures','method':'explicit-native-head-row-edits-and-palette-substitution','seed':item,'headRows':HEADS[item['head']],'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'resizingAuthoredPixels':False,'mapContext':'Placement mockup. Existing hero above; candidate below. Not runtime QA.'},ensure_ascii=False,indent=2)+'\n')
  (folder/'origin.txt').write_text(meta['sourceNote']+' Source original artwork Nintendo/Game Freak/Creatures; source hash and exact head/palette edits recorded in recipe.json. No raster reduction or automatic body pose transformation.\n')
  results.append(str(folder))
 print(json.dumps(results))
if __name__=='__main__':main()
