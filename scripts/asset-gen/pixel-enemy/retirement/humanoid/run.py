"""Generate, losslessly reload and document the 27 humanoid/boss replacements."""
import sys,json,hashlib
from pathlib import Path
sys.dont_write_bytecode=True
from PIL import Image,ImageDraw
from art import draw,NAMES
ROOT=Path(__file__).resolve().parents[5]
OUT=ROOT/'public/assets/generated/pixel-enemies';QA=ROOT/'verify-shots/legacy-monsters/humanoid'
OUT.mkdir(parents=True,exist_ok=True);QA.mkdir(parents=True,exist_ok=True)
entries=json.loads((Path(__file__).parent/'species.json').read_text());catalog=[];reports=[];framesall=[]
for e in entries:
 slug=e['slug'];frames=[draw(slug,n).im for n in NAMES];cell=frames[0].width
 sheet=Image.new('RGBA',(cell*3,cell*3))
 for i,im in enumerate(frames):sheet.paste(im,(i%3*cell,i//3*cell))
 path=OUT/(slug+'.png');sheet.save(path)
 with Image.open(path) as reloaded:assert reloaded.convert('RGBA').tobytes()==sheet.tobytes()
 colors={v for _,v in sheet.getcolors(cell*cell*9) if v[3]};alpha=sorted(set(sheet.getchannel('A').tobytes()))
 hashes=[hashlib.sha256(im.tobytes()).hexdigest() for im in frames]
 bounds=[im.getbbox() for im in frames]
 errors=[]
 if len(colors)>16:errors.append('palette')
 if alpha!=[0,255]:errors.append('alpha')
 if len(set(hashes))<9:errors.append('duplicate frames')
 for n,b in zip(NAMES,bounds):
  if not b or b[0]<1 or b[1]<1 or b[2]>cell-1 or b[3]>cell-3:errors.append(f'{n}: bounds {b}')
 report=dict(slug=slug,cell=cell,colors=len(colors),alpha=alpha,uniqueFrames=len(set(hashes)),frames={n:dict(bbox=b,sha256=h) for n,b,h in zip(NAMES,bounds,hashes)},sheetSha256=hashlib.sha256(path.read_bytes()).hexdigest(),errors=errors)
 # Validate lossless 2x pose-cycle timing and decoded frame appearance.
 cycle=[0,1,2,1,0,1,2,1,3,4,5,6,7,8];ms=[200]*8+[320,220,360,260,420,1200];gif=[]
 for fi in cycle:
  bg=Image.new('RGBA',(cell,cell),'#202840');bg.alpha_composite(frames[fi]);gif.append(bg.convert('RGB').resize((cell*2,cell*2),Image.Resampling.NEAREST))
 gp=QA/(slug+'-cycle.gif');gif[0].save(gp,save_all=True,append_images=gif[1:],duration=ms,loop=0,disposal=2,optimize=False)
 with Image.open(gp) as dec:
  assert dec.n_frames==len(cycle)
  for fi,expected in enumerate(gif):
   dec.seek(fi);assert dec.info['duration']==ms[fi] and dec.convert('RGB').tobytes()==expected.tobytes()
 report['cycleDurationMs']=sum(ms);report['cycleFrames']=len(cycle)
 reports.append(report);print(slug,cell,'colors',len(colors),'errors',errors)
 board=Image.new('RGBA',sheet.size,'#202840');board.alpha_composite(sheet);board=board.convert('RGB').resize((cell*6,cell*6),Image.Resampling.NEAREST)
 d=ImageDraw.Draw(board)
 for i,n in enumerate(NAMES):
  xx=i%3*cell*2;yy=i//3*cell*2;d.rectangle((xx,yy,xx+cell*2-1,yy+cell*2-1),outline='#505970');d.text((xx+3,yy+3),n,fill='#ffffff')
 board.save(QA/(slug+'-poses.png'))
 framesall.append((slug,frames))
 motion='stomp'
 if slug in ['leafling-01','sparkit-01','aqualing-01']:motion='float'
 elif slug.startswith('dragon-') or slug=='hydra-three':motion='breath'
 elif slug in ['harpy-01','angel-fallen','roc-giant','phoenix-rebirth','wyvern-cliff','imp-mischief']:motion='swoop'
 elif slug in ['salamander-01','salamander-flame','centaur-plains','kobold-digger']:motion='dash'
 elif slug=='mage-rogue':motion='shoot'
 catalog.append(dict(resourceId=e['resourceId'],path='assets/generated/pixel-enemies/'+slug+'.png',cell=cell,motion=motion,idleFrameMs=200))
(Path(__file__).parent/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n');(QA/'validation.json').write_text(json.dumps(reports,indent=2)+'\n')
# Every frame can be inspected together at actual integer 2x.
for page in range(3):
 selected=framesall[page*9:page*9+9];board=Image.new('RGB',(9*196,9*216),'#202840');d=ImageDraw.Draw(board)
 for row,(slug,frames) in enumerate(selected):
  d.text((5,row*216+3),slug,fill='white')
  for col,im in enumerate(frames):
   comp=Image.new('RGBA',im.size,'#202840');comp.alpha_composite(im);up=comp.convert('RGB').resize((im.width*2,im.height*2),Image.Resampling.NEAREST)
   board.paste(up,(col*196+(196-up.width)//2,row*216+20));d.text((col*196+4,row*216+202),NAMES[col],fill='#adb5ca')
 board.save(QA/f'all-poses-{page+1}.png')
contact=Image.new('RGB',(6*208,5*220),'#202840');d=ImageDraw.Draw(contact)
for i,(slug,frames) in enumerate(framesall):
 im=frames[0];comp=Image.new('RGBA',im.size,'#202840');comp.alpha_composite(im);up=comp.convert('RGB').resize((im.width*2,im.height*2),Image.Resampling.NEAREST);x=i%6*208;y=i//6*220;contact.paste(up,(x+(208-up.width)//2,y+10));d.text((x+8,y+204),slug,fill='white')
contact.save(QA/'idle-contact.png')
if any(r['errors'] for r in reports):raise SystemExit(1)
