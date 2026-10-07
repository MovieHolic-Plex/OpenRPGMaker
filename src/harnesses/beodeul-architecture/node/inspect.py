from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,sys
from gable import gable_mask
ROOT=Path(__file__).resolve().parents[4]
data=json.loads((ROOT/'src/assets/beodeulArchitectureCatalog.json').read_text());folder=ROOT/'public/assets/beodeul-architecture'
sheet=Image.open(folder/'chipset.png').convert('RGBA');assert sheet.size==(256,data['count'])
report=[]
for b in data['buildings']:
 im=Image.open(folder/(b['concept']+'.png')).convert('RGBA');original=Image.open(folder/(b['concept']+'-native.png')).convert('RGBA')
 assert im.size==(b['width']*16,b['height']*16)
 assert b['doorCount']==1 and len([p for p in b['parts'] if p['kind']=='entrance'])==1
 assert not b['perspective']['sideRequired']
 assert im.getchannel('A').tobytes()==original.getchannel('A').tobytes()
 mask=gable_mask(original) if b['concept']=='stone' else Image.new('L',im.size)
 if b['concept']=='stone':assert mask.tobytes()==Image.open(folder/b['gableCorrection']['mask']).tobytes()
 for y in range(64 if b['concept']=='stone' else 48):
  for x in range(im.width):
   if not mask.getpixel((x,y)):assert im.getpixel((x,y))==original.getpixel((x,y)),('native roof differs',b['concept'],x,y)
 changed=0;diff=Image.new('RGBA',im.size)
 for y in range(im.height):
  for x in range(im.width):
   if im.getpixel((x,y))!=original.getpixel((x,y)):
    changed+=1;assert mask.getpixel((x,y)) or any(x0<=x<x1 and y0<=y<y1 for x0,y0,x1,y1 in b['edits']);diff.putpixel((x,y),(255,50,60,255))
 # Retention outside the explicitly approved gable wall mask remains the previous contract.
 nonroofchanged=sum(im.getpixel((x,y))!=original.getpixel((x,y)) and not mask.getpixel((x,y)) for y in range(im.height) for x in range(im.width))
 assert nonroofchanged<=im.width*im.height*(0.20 if b['concept']=='stone' else 0.14)
 assembled=Image.new('RGBA',im.size)
 for y,row in enumerate(b['rows']):
  for x,n in enumerate(row):
   if n>=0:assembled.paste(sheet.crop((n%16*16,n//16*16,n%16*16+16,n//16*16+16)),(x*16,y*16))
 assert assembled.tobytes()==im.tobytes()
 report.append(dict(id=b['id'],sha256=hashlib.sha256(im.tobytes()).hexdigest(),silhouettePreserved=True,changedPixels=changed,preservedPixelRatio=1-changed/(im.width*im.height)))
 if '--review' in sys.argv:
  out=ROOT/'qa-runs/harnesses/beodeul-architecture';out.mkdir(parents=True,exist_ok=True)
  board=Image.new('RGBA',(im.width*3+16,im.height),(90,138,57,255));board.alpha_composite(original,(0,0));board.alpha_composite(im,(im.width+8,0));board.alpha_composite(diff,(im.width*2+16,0))
  board.resize((board.width*3,board.height*3),Image.Resampling.NEAREST).save(out/(b['concept']+'-review.png'))
# Verify common ground source arrays, alpha and unchanged historical slots as well as architecture.
ground=json.loads((ROOT/'src/assets/beodeulGroundCatalog.json').read_text())
groundsheet=Image.open(ROOT/'public/assets/beodeul-ground/chipset.png').convert('RGBA')
groundproof=json.loads((ROOT/'tiledata/beodeul-ground/lighting-inspection.json').read_text())
assert hashlib.sha256(groundsheet.crop((0,0,128,224)).tobytes()).hexdigest()==groundproof['original112Hash']
assert groundsheet.size==(128,ground['count']//8*16)
for r in ground['recipes']:
 if not (r.get('lighting') or r.get('hamlet') or r.get('woodland')):continue
 im=Image.open(ROOT/'public/assets/beodeul-ground'/r['id'].replace('bdg-','').__add__('.png')).convert('RGBA')
 assembled=Image.new('RGBA',im.size)
 for y,row in enumerate(r['rows']):
  for x,n in enumerate(row):
   if n>=0:assembled.paste(groundsheet.crop((n%8*16,n//8*16,n%8*16+16,n//8*16+16)),(x*16,y*16))
 assert assembled.tobytes()==im.tobytes()
 if r.get('hamlet') and r['layer']==1:assert im.getchannel('A').getextrema()==(255,255) and not r['blocked']
 if r['layer']==2 and r.get('lighting'):assert im.getchannel('A').getextrema()[1]<=128 and not r['blocked']
proof=dict(stage='review' if '--review' in sys.argv else 'validate',mechanicalPass=True,visualVerdict='requires actual image review',buildings=report)
(ROOT/'harness-data/beodeul-architecture/inspection.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(buildings=len(report),mechanicalPass=True,visualVerdict=proof['visualVerdict'])))

hamletproof=json.loads((ROOT/"tiledata/beodeul-ground/hamlet-inspection.json").read_text())
assert hashlib.sha256(groundsheet.crop((0,0,128,608)).tobytes()).hexdigest()==hamletproof["original304Hash"]
woodlandproof=json.loads((ROOT/'tiledata/beodeul-ground/woodland-inspection.json').read_text())
assert hashlib.sha256(groundsheet.crop((0,0,128,736)).tobytes()).hexdigest()==woodlandproof['original368Hash']
