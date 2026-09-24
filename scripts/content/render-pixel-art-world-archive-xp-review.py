"""Private source/composition contact sheets. No pixel output enters the repository."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2];prepared=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve()
if root/'output' not in out.parents:raise ValueError('Private output under output/ required')
out.mkdir(parents=True,exist_ok=True)
catalog=json.loads((root/'src/assets/pixelArtWorldArchiveAutotiles.json').read_text());proof=json.loads((prepared/'preparation-proof.json').read_text());paths={p['sha256']:p['filename']for p in proof['sourceFiles']};font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
for page in range((len(catalog['sources'])+11)//12):
 sheet=Image.new('RGB',(690,1200),'#eee');draw=ImageDraw.Draw(sheet)
 for j,source in enumerate(catalog['sources'][page*12:page*12+12]):
  x=j%3*230+10;y=j//3*300+8;draw.text((x,y),f"{source['index']:02d} "+source['filenames'][0],font=font,fill='black');im=Image.open(paths[source['sha256']]).convert('RGBA');bg=Image.new('RGBA',im.size);bd=ImageDraw.Draw(bg)
  for yy in range(0,128,8):
   for xx in range(0,96,8):bd.rectangle((xx,yy,xx+7,yy+7),fill='#666'if(xx//8+yy//8)%2 else'#999')
  bg.alpha_composite(im);sheet.paste(bg.resize((192,256),Image.Resampling.NEAREST),(x,y+24));draw.text((x,y+280),source['sha256'][:12],font=font,fill='black')
 sheet.save(out/f'sources-{page:02}.png')
for page in range((len(catalog['packs'])+11)//12):
 sheet=Image.new('RGB',(840,840),'#ddd');draw=ImageDraw.Draw(sheet)
 for j,pack in enumerate(catalog['packs'][page*12:page*12+12]):
  x=j%3*280;y=j//3*210;draw.text((x+4,y+3),pack['filename']+' '+pack['sha256'][:6],font=font,fill='black');im=Image.open(prepared/(pack['id']+'-sample.png'));sheet.paste(im,(x+6,y+24));draw.text((x+4,y+192),pack['defaultLayer']+'/'+pack['passage']+'/'+pack['shapePolicy'],font=font,fill='black')
 sheet.save(out/f'assemblies-{page:02}.png')
print('Prepared67 original sources and65 complete arrays as12 private contact sheets.')
