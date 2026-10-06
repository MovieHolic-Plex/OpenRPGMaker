"""Exact native PNG/GIF encoding of authored grids. No new art or tweening."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,html
ROOT=Path(__file__).resolve().parent
P=json.loads((ROOT/'palette.json').read_text())
POSES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
SCENES=[
 ('idle',['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
 ('attack',['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
 ('hit',['idle_a','hit','idle_a'],[700,180,900]),
 ('dead',['idle_a','hit','dead'],[700,150,1700]),
 ('skill',['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
 ('poison',['poison_a','poison_b'],[420,420]),
 ('stun',['stun_a','stun_b'],[300,300]),
 ('sleep',['sleep_a','sleep_b'],[650,650])]
OUT=ROOT/'preview';OUT.mkdir(exist_ok=True)
G=OUT/'motions';G.mkdir(exist_ok=True)
color=[(0,0,0)]+[tuple(bytes.fromhex(value[1:])) for value in P.values()]
lookup={symbol:i+1 for i,symbol in enumerate(P)};lookup['.']=0
flat=[component for rgb in color for component in rgb];flat += [0]*(768-len(flat))
indexed={};rgba={};facts={}
for name in POSES+ACTIONS:
 path=ROOT/('poses' if name in POSES else 'actions')/(name+'.pxgrid')
 rows=path.read_text().splitlines()
 if len(rows)!=128 or any(len(row)!=128 for row in rows):raise ValueError(name)
 frame=Image.new('P',(128,128));frame.putpalette(flat)
 frame.putdata([lookup[s] for row in rows for s in row]);frame.info['transparency']=0
 indexed[name]=frame;rgba[name]=frame.copy().convert('RGBA');rgba[name].save(OUT/(name+'.png'))
 pixels=[(x,y) for y,row in enumerate(rows) for x,s in enumerate(row) if s!='.']
 facts[name]={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
              'rgbaSha256':hashlib.sha256(rgba[name].tobytes()).hexdigest(),
              'bounds':[min(x for x,y in pixels),min(y for x,y in pixels),max(x for x,y in pixels),max(y for x,y in pixels)],
              'inkPixels':len(pixels)}
for filename,names in [('poses-3x3.png',POSES),('actions-3x3.png',ACTIONS),('suite-3x6.png',POSES+ACTIONS)]:
 sheet=Image.new('RGBA',(384,(len(names)//3)*128))
 for i,n in enumerate(names):sheet.paste(rgba[n],((i%3)*128,(i//3)*128))
 sheet.save(OUT/filename)
timing=[]
for scene,seq,durations in SCENES:
 path=G/(scene+'.gif')
 indexed[seq[0]].save(path,save_all=True,append_images=[indexed[n] for n in seq[1:]],duration=durations,loop=0,transparency=0,disposal=2,optimize=False)
 strip=Image.new('RGB',(len(seq)*256,288),'#21324b');d=ImageDraw.Draw(strip)
 decoded_facts=[]
 with Image.open(path) as gif:
  if gif.n_frames!=len(seq):raise ValueError((scene,'frame count'))
  for i,(n,ms) in enumerate(zip(seq,durations)):
   gif.seek(i);decoded=gif.convert('RGBA')
   if decoded.tobytes()!=rgba[n].tobytes() or gif.info.get('duration')!=ms:raise ValueError((scene,i,'pixel/time roundtrip'))
   # Diagnostic display reads the encoded GIF, never substitutes a source PNG.
   d.text((i*256+5,5),n+' / '+str(ms)+'ms',fill='#edf2e7')
   big=decoded.resize((256,256),Image.Resampling.NEAREST)
   strip.paste(big,(i*256,26),big)
   decoded_facts.append({'pose':n,'durationMs':ms})
 strip.save(G/(scene+'-decoded.png'))
 timing.append({'name':scene,'sequence':seq,'durationsMs':durations,'gifSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'readback':decoded_facts})
 print(scene,'GIF saved and read back',len(seq),'frames',sum(durations),'ms')
(OUT/'pixels.json').write_text(json.dumps({'cell':128,'colors':len(P),'frames':facts,'gifReadback':timing},indent=2)+'\n')
(G/'timing.json').write_text(json.dumps(timing,indent=2)+'\n')
# Source-only review page: eight genuine native GIFs and all current stills.
page='''<!doctype html><meta charset="utf-8"><title>월상빙룡 · 원본 후보</title>
<style>body{font:16px system-ui;background:#18263b;color:#ebf2e8;margin:28px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}figure{margin:0;background:#243951;padding:12px}img{image-rendering:pixelated;width:256px;height:256px;max-width:100%;object-fit:contain}figcaption{margin-bottom:8px}.still{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.still img{width:128px;height:128px}a{color:#a9e1ef}@media(max-width:1000px){main{grid-template-columns:repeat(2,1fr)}.still{grid-template-columns:repeat(3,1fr)}}</style>
<h1>월상빙룡 · 원본 후보</h1><p>128px 리터럴 픽셀 18자세. 실제 GIF 8종. 독립 검수와 사용자 선택 전.</p><main>'''
for name,seq,ds in SCENES:page+='<figure><figcaption>'+html.escape(name)+'</figcaption><img src="motions/'+name+'.gif"></figure>'
page+='</main><h2>원본 1배</h2><section class="still">'
for name in POSES+ACTIONS:page+='<figure><figcaption>'+name+'</figcaption><img src="'+name+'.png"></figure>'
page+='</section>'
(OUT/'review.html').write_text(page)
