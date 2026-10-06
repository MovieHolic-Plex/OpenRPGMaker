#!/usr/bin/env python3
"""Pinned original-source fidelity gate. No aesthetic score or background credit."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, hashlib, json

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'scripts/asset-gen/pokemon-characters/references/brendan-walking.png'
SOURCE_SHA='f33ec07a5fd17f4422455f8bc55cd3d3522fa65c3bf740ecbdc00da705eaa0d1'
MAPPING={'up':[5,1,6], 'right':[7,2,8], 'down':[3,0,4], 'left':[7,2,8]}
MINIMUM=.95
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def clean(im):
 im=im.convert('RGBA'); im.putdata([p if p[3] else (0,0,0,0) for p in im.get_flattened_data()]); return im
def compare(a,b):
 assert a.size==b.size==(16,32)
 pairs=list(zip(clean(a).get_flattened_data(),clean(b).get_flattened_data()))
 union=sum(bool(x[3] or y[3]) for x,y in pairs)
 assert union>0, 'Empty foreground cannot pass'
 exact=sum(x==y and bool(x[3] or y[3]) for x,y in pairs)
 intersection=sum(bool(x[3] and y[3]) for x,y in pairs)
 return {'foregroundUnion':union,'exactForegroundPixels':exact,'mismatchedForegroundPixels':union-exact,'exactRatio':exact/union,'silhouetteIoU':intersection/union}
def reference():
 assert sha(SOURCE)==SOURCE_SHA,'Pinned reference SHA changed'
 s=Image.open(SOURCE);assert s.mode=='P' and s.size==(144,32) and s.getpixel((0,0))==0
 s.info['transparency']=0;s=clean(s)
 atlas=Image.new('RGBA',(48,128))
 for row,(direction,seq) in enumerate(MAPPING.items()):
  for col,index in enumerate(seq):
   f=s.crop((index*16,0,(index+1)*16,32))
   if direction=='right':f=f.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   atlas.paste(f,(col*16,row*32))
 return atlas
def evaluate(sheet):
 assert sheet.size==(48,128),'Native48x128 only; no resize/alignment permitted'
 ref=reference();poses=[]
 for row,direction in enumerate(MAPPING):
  for col,phase in enumerate(['stepA','idle','stepB']):
   box=(col*16,row*32,(col+1)*16,(row+1)*32)
   result=compare(ref.crop(box),sheet.crop(box))
   poses.append({'direction':direction,'phase':phase,**result,'pass':result['exactRatio']>=MINIMUM and result['silhouetteIoU']>=MINIMUM})
 return poses
def controls(sheet):
 cases={}
 cases['blank']=Image.new('RGBA',sheet.size)
 shifted=Image.new('RGBA',sheet.size);shifted.paste(sheet,(1,0));cases['shift-one-pixel']=shifted
 recolored=sheet.copy();recolored.putdata([(255,0,255,255) if p[3] else p for p in sheet.get_flattened_data()]);cases['recolor']=recolored
 wrong=sheet.copy();wrong.paste(sheet.crop((0,64,48,96)),(0,0));cases['wrong-direction']=wrong
 missing=sheet.copy();missing.paste(Image.new('RGBA',(16,32)),(0,0));cases['single-missing-pose']=missing
 extra=sheet.copy();extra.paste((255,0,255,255),(0,0,16,8));cases['extra-ink']=extra
 results=[{'case':name,'rejected':not all(p['pass'] for p in evaluate(im))} for name,im in cases.items()]
 assert all(r['rejected'] for r in results),'Adversarial control passed'
 return results
def main():
 p=argparse.ArgumentParser();p.add_argument('--sheet',type=Path,required=True);p.add_argument('--gif',type=Path,required=True);p.add_argument('--adapter',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
 sheet=clean(Image.open(a.sheet));poses=evaluate(sheet);assert all(x['pass'] for x in poses),'At least one pose below95%'
 gif=Image.open(a.gif);assert gif.size==(68,32) and gif.n_frames==4 and gif.info.get('loop')==0
 decoded=[]
 for n,phase in enumerate([0,1,2,1]):
  gif.seek(n);actual=clean(gif);expected=Image.new('RGBA',(68,32))
  for row in range(4):expected.paste(sheet.crop((phase*16,row*32,(phase+1)*16,(row+1)*32)),(row*17,0))
  assert actual.tobytes()==expected.tobytes(),f'GIF pixels/phase/gutters changed: {n}'
  assert gif.info['duration']==130,'Expected130ms approximation of original8tick normal walking'
  decoded.append({'frame':n,'phase':phase,'durationMs':130,'exactSheetPixels':True})
 if a.adapter:
  adapter=clean(Image.open(a.adapter));assert adapter.size==(72,128)
  expected=Image.new('RGBA',(72,128))
  for row in range(4):
   for col in range(3):expected.paste(sheet.crop((col*16,row*32,(col+1)*16,(row+1)*32)),(col*24+4,row*32))
  assert adapter.tobytes()==expected.tobytes(),'Adapter must add only transparent4px gutters'
 a.out.mkdir(parents=True,exist_ok=True)
 record={'mode':'reference-fidelity','pass':True,'minimumRequiredPerPose':MINIMUM,'minimumExactRatio':min(x['exactRatio'] for x in poses),'minimumSilhouetteIoU':min(x['silhouetteIoU'] for x in poses),'sourceSha256':SOURCE_SHA,'sourceUrl':'https://github.com/pret/pokeemerald/blob/master/graphics/object_events/pics/people/brendan/walking.png','sheetSha256':sha(a.sheet),'gifSha256':sha(a.gif),'implementationSha256':sha(__file__),'independentlyAuthored':False,'measurement':'Exact normalized RGBA at fixed native coordinates / union of reference and candidate foreground. Transparent in both is excluded. No resizing or alignment. Every pose must independently pass.','poses':poses,'gifFrames':decoded,'adversarialControls':controls(sheet)}
 (a.out/'quality-gate.json').write_text(json.dumps(record,indent=2)+'\n')
 contact=Image.new('RGB',(410,4*150),'#e8e5d9');d=ImageDraw.Draw(contact);ref=reference()
 for row,direction in enumerate(MAPPING):
  d.text((8,row*150+5),direction+'  original / applied',fill='#283b4a')
  for x,atlas in [(8,ref),(210,sheet)]:
   im=atlas.crop((0,row*32,48,(row+1)*32)).resize((192,128),Image.Resampling.NEAREST);contact.paste(im,(x,row*150+22),im)
 contact.save(a.out/'comparison.png');print(json.dumps(record))
if __name__=='__main__':main()
