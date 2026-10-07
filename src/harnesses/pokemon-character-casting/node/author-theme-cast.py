"""Theme cast (desert / snow / coast) as explicit edits on pinned Emerald walking templates.

Rules live in harness-data/pokemon-character-casting/templates/<wave>/cast.json and are
literal, author-chosen operations on the original pose rows:
  {"sub": [old, new]}          literal pixel-substring replacement (same as author-cast-wave.py)
  {"map": {"C": "5", ...}}     palette-index remap inside the selected rows/columns
Optional selectors: "dirs" (up / down / side), "rel" [lo, hi] rows relative to the pose's top ink
row (handles the walking bob), "cols" [lo, hi] (side columns are written for the left view).
Side rules are applied to the left view as written and mirrored onto the right view, which keeps
the source's left/right reflection contract. Rows 28..31 (feet/legs) are never edited. No pose is
synthesized, traced or generated; template.py replays the result and enforces its own checks.
"""
import argparse,hashlib,json,subprocess,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from template import base,replay,atlas,DIRECTIONS,POSES

ROOT=Path(__file__).resolve().parents[4]
TEMPLATES=ROOT/'harness-data/pokemon-character-casting/templates'
TILES=ROOT/'public/assets/emerald-monster/tiles'
# Ground tiles for the theme placement mockup and the review sheet (sheet, tile x, tile y).
GROUNDS={
 'desert':[('climate.png',15,74)],
 'snow':[('climate.png',0,28)],
 'coast':[('coast.png',0,0),('coast.png',10,0)],
}

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def top_row(rows):
 return next(y for y,line in enumerate(rows) if line.strip('.'))

def selected(rule,direction):
 dirs=rule.get('dirs')
 if not dirs:return True
 return ('side' if direction in ('left','right') else direction) in dirs

def apply_rule(rule,line,direction,y,top):
 if y>=28:return line
 lo,hi=rule.get('rel',[-99,99])
 if not lo<=y-top<=hi:return line
 mirror=direction=='right'
 if 'sub' in rule:
  old,new=rule['sub'];assert len(old)==len(new),(old,new)
  if mirror:old,new=old[::-1],new[::-1]
  return line.replace(old,new)
 if 'map' in rule:
  c0,c1=rule.get('cols',[0,15])
  if mirror:c0,c1=15-c1,15-c0
  return ''.join(rule['map'].get(ch,ch) if c0<=x<=c1 else ch for x,ch in enumerate(line))
 raise ValueError('unknown rule '+json.dumps(rule))

def expand(item):
 record,palette,frames=base(item['template']);patches=[];edited={}
 for frame,rows in frames.items():
  direction=frame.split('_')[0];top=top_row(rows);out=list(rows)
  for rule in item['rules']:
   if not selected(rule,direction):continue
   out=[apply_rule(rule,line,direction,y,top) for y,line in enumerate(out)]
  edited[frame]=out
  for y,(a,b) in enumerate(zip(rows,out)):
   if a!=b:
    assert y<28,'feet rows are protected'
    patches.append({'frame':frame,'y':y,'rows':[b]})
 for pose in POSES:
  assert edited['right_'+pose]==[r[::-1] for r in edited['left_'+pose]],'right view must mirror left view'
 return record,patches,palette,frames,edited

def ground(theme,size):
 im=Image.new('RGBA',size);tiles=[]
 for sheet,tx,ty in GROUNDS[theme]:
  tiles.append(Image.open(TILES/sheet).convert('RGBA').crop((tx*16,ty*16,tx*16+16,ty*16+16)))
 for y in range(0,size[1],16):
  for x in range(0,size[0],16):
   t=tiles[0] if len(tiles)==1 else tiles[0] if y<size[1]//2 else tiles[1]
   im.paste(t,(x,y))
 return im

def context(theme,charset,out):
 """480x360 theme placement mockup: Emerald ground tiles at 2x, character at 2x (mockup, not runtime)."""
 small=ground(theme,(240,180));im=small.resize((480,360),Image.Resampling.NEAREST)
 down=charset.crop((16,64,32,96)).resize((32,64),Image.Resampling.NEAREST)
 im.alpha_composite(down,(235,252));im.save(out)

def ground_record(theme):
 return [{'sheet':'public/assets/emerald-monster/tiles/'+s,'tile':[x,y],'sheetSha256':sha(TILES/s)} for s,x,y in GROUNDS[theme]]

def preview(rows,out):
 """Review sheet: per candidate original vs edited idle (4 dirs) at 4x, all 12 edited poses at 2x, 1x on theme ground."""
 S=4;W=16*4*S*2+32+56+80;H=32*S+60;sheet=Image.new('RGBA',(W,H*len(rows)),(30,34,44,255));d=ImageDraw.Draw(sheet)
 font=ImageFont.load_default()
 for f in ('/usr/share/fonts/truetype/nanum/NanumGothic.ttf','/usr/share/fonts/truetype/nanum/NanumSquareB.ttf'):
  if Path(f).exists():font=ImageFont.truetype(f,11);break
 for i,(item,original,edited) in enumerate(rows):
  y0=i*H;g=ground(item['theme'],(W,H-14));sheet.paste(g,(0,y0+14))
  d.rectangle((0,y0,W,y0+13),fill=(30,34,44,255))
  d.text((4,y0+2),f"{item['role']}  [{item['theme']}]  template {item['template']}  — {item['name']}",fill=(255,255,255,255),font=font)
  def idle(im,dirrow):return im.crop((16,dirrow*32,32,dirrow*32+32))
  order=[2,3,0,1]# down, left, up, right
  x=6
  for src in (original,edited):
   for r in order:
    t=idle(src,r).resize((16*S,32*S),Image.Resampling.NEAREST);sheet.alpha_composite(t,(x,y0+20));x+=16*S
   x+=16
  sheet.alpha_composite(edited,(x,y0+20));x+=56
  for k,r in enumerate(order):sheet.alpha_composite(idle(edited,r),(x+k*18,y0+20))
  for k,r in enumerate(order):sheet.alpha_composite(idle(original,r),(x+k*18,y0+60))
 sheet.save(out)

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--wave',default='theme-cast-v1');p.add_argument('--render',action='store_true')
 p.add_argument('--only');p.add_argument('--preview',type=Path);p.add_argument('--dry',action='store_true')
 a=p.parse_args();dest=TEMPLATES/a.wave;cast=json.loads((dest/'cast.json').read_text())
 items=[];errors=[];previews=[]
 for item in cast['items']:
  if a.only and item['role'] not in a.only.split(','):continue
  role=item['role']
  try:
   record,patches,palette,source_frames,edited=expand(item)
   if a.preview:
    final_palette={**palette,**item['palette']};previews.append((item,atlas(palette,source_frames),atlas(final_palette,edited)))
   spec={'version':1,'templateId':item['template'],'templateSourceSha256':record['sha256'],'paletteOverrides':item['palette'],'patches':patches,'protectedRows':[28,29,30,31],'design':item['design'],'editSource':f"author-theme-cast.py rules from templates/{a.wave}/cast.json (literal substrings and explicit index remaps at original pose rows); source right view mirrors left."}
   original,image,audit=replay(spec)
   if a.dry:print(role,'ok',min(x['headIndexEdits'] for x in audit['frames']),min(x['clothingIndexEdits'] for x in audit['frames']),flush=True);continue
   folder=dest/role;folder.mkdir(exist_ok=True)
   (folder/'template.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
   meta={'role':role,'label':item['label'],'variant':item['name']+' · '+item['themeLabel']+' 판형 수정','description':item['design'],'identity':item['design']+' · 원작 체형과 발 교대 유지','collection':a.wave,'base':item['template']+'-'+role+'-'+a.wave,'templateId':item['template'],'theme':item['theme'],'themeGround':ground_record(item['theme']),'sourceNote':'에메랄드 '+item['template']+' 원작을 판형으로 삼아 Claude가 '+item['themeLabel']+' 테마에 맞게 머리·복장 부분과 팔레트를 수정한 파생 캐릭터입니다. 원작의 몸·얼굴·걷기를 유지했습니다.'}
   (folder/'candidate.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
   if a.render:
    r=subprocess.run([sys.executable,str(Path(__file__).with_name('render-template.py')),'--spec',str(folder/'template.json'),'--candidate',str(folder/'candidate.json'),'--out',str(folder)],capture_output=True,text=True)
    if r.returncode:raise ValueError(r.stderr[-2000:])
    context(item['theme'],Image.open(folder/'charset.png').convert('RGBA'),folder/'context.png')
    # render-template.py is shared with full-cast-v1 (its hash is in their recipes), so authorship is corrected here.
    recipe=json.loads((folder/'recipe.json').read_text())
    recipe['author']='Claude (Opus 5.5) theme edits on original Emerald '+item['template']+' artwork'
    recipe['themeContext']={'theme':item['theme'],'ground':ground_record(item['theme']),'producer':'author-theme-cast.py','producerSha256':sha(__file__),'castSha256':sha(dest/'cast.json')}
    (folder/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
    (folder/'origin.txt').write_text('Emerald '+item['template']+' template derivative ('+item['theme']+' theme). Original artwork Nintendo / Game Freak / Creatures. Claude (Opus 5.5) authored head/clothing row edits and palette choices listed in recipe.json; original body/gait/face retained. Context image is a ground-tile placement mockup, not runtime QA. Not independently drawn from scratch.\n')
   items.append({'role':role,'label':item['label'],'name':item['name'],'theme':item['theme'],'template':item['template'],'bundle':str(folder.relative_to(ROOT)),'headEditsMin':min(x['headIndexEdits'] for x in audit['frames']),'clothesEditsMin':min(x['clothingIndexEdits'] for x in audit['frames'])})
   print(role+' ready',flush=True)
  except Exception as e:
   errors.append({'role':role,'error':str(e)});print(role+' FAILED '+str(e),flush=True)
   if a.dry and 'edited' in dir():
    for f in edited:
     h=sum(x!=y for r in range(10,21) for x,y in zip(edited[f][r],source_frames[f][r]));c=sum(x!=y for r in range(21,28) for x,y in zip(edited[f][r],source_frames[f][r]))
     if h<4 or c<2:print('  ',f,'head',h,'clothes',c)
 if a.preview and previews:preview(previews,a.preview)
 if not a.dry and not a.only:
  (dest/'manifest.json').write_text(json.dumps({'wave':a.wave,'label':cast['label'],'items':items,'errors':errors,'scope':cast['scope']},ensure_ascii=False,indent=2)+'\n')
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
