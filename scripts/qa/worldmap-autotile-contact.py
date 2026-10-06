"""Raw atlas review sheet; explicitly not a native editor screenshot."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2]
sheet=json.loads((root/'src/assets/worldmapAuthoringSheet.json').read_text())
atlas=Image.open(root/'public/assets/worldmap-icons/worldmap-authoring.png').convert('RGBA')
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
dirs=[(0,-1,1),(1,0,2),(0,1,4),(-1,0,8),(1,-1,16),(1,1,32),(-1,1,64),(-1,-1,128)]
def canonical(n):
 for d,a,b in [(16,1,2),(32,2,4),(64,4,8),(128,8,1)]:
  if not(n&a and n&b): n &= ~d
 return n
masks=sorted(set(canonical(n) for n in range(256)))
def tile(n):return atlas.crop(((n%12)*16,(n//12)*16,(n%12+1)*16,(n//12+1)*16))
for id in ['grass-sea','river-grass','forest-any','mountain-any','snowmountain-any']:
 b=next(b for b in sheet['brushes'] if b['id']=='worldmap-brush-'+id)
 canvas=Image.new('RGB',(8*112,6*116),(27,33,40));draw=ImageDraw.Draw(canvas)
 for i,m in enumerate(masks):
  occupied={(1,1)}|{(1+dx,1+dy) for dx,dy,bit in dirs if m&bit}
  card=Image.new('RGBA',(48,48))
  for y in range(3):
   for x in range(3):
    base=tile(0 if b['background']=='sea' else 1)
    if (x,y) in occupied:
     mask=sum(bit for dx,dy,bit in dirs if(x+dx,y+dy)in occupied)
     art=tile(b['variantMap'][str(mask)])
     if b['layer']=='upper':base.alpha_composite(art)
     else:base=art
    card.paste(base,(x*16,y*16))
  xx=(i%8)*112+6;yy=(i//8)*116+18
  canvas.paste(card.resize((96,96),Image.Resampling.NEAREST),(xx,yy))
  draw.text((xx,yy-14),f'mask {m:02x}',fill=(224,232,239))
 canvas.save(out/(id+'-47.png'))
print({'masks':len(masks),'families':5,'out':str(out)})
