"""Explicit sign grids and selected roof palette replacements for review only.
No game image tracing, generated geometry, noise or texture resampling.
"""
from pathlib import Path
import json,hashlib,sys
from PIL import Image,ImageDraw
from native_author import ROOT,native,render_native
SOURCE=ROOT/'harness-data/beodeul-building-review'
# Each authored sign is 16x24 native pixels. Wooden backing and iron bracket.
BACK=[
'................','..DDDDDDDDDD....','..Hd........D...','..H.........D...',
'..d.........D...','..D.........D...','..D.........D...',
'..DDDDDDDDDDDD..','..DHhhhhhhhhHD..','..DhmmnmmmnmhD..',
'..DhmnmmnmmmhD..','..DhmmmmnmmmhD..','..DhmmnmmmmnhD..','..DhmmmmmmnmhD..',
'..DhmmmnmmmmhD..','..DhmmmmnmmmhD..','..DhmmnmmnmmhD..','..DhmmmmmnmmhD..',
'..DhmmnmmnmmhD..','..DhmmmnnmmmhD..','..DhmmnmmmmnhD..','..DhhhhhhhhhhD..',
'...DDDDDDDDDD...','................']
PAL={'.':(0,0,0,0),'D':(30,21,10,255),'d':(68,44,25,255),'H':(188,170,160,255),'h':(122,74,34,255),'m':(69,42,23,255),'n':(99,55,18,255),'w':(236,214,198,255),'s':(188,170,160,255),'t':(40,70,90,255),'l':(66,105,119,255),'g':(236,219,149,255),'r':(137,52,55,255)}
GLYPHS={
'bed':['........','w.......','wss.....','wsswwwww','wwwwwwww','wsssssws','w......w','........'],
'bread':['........','..gggg..','.ggsggg.','ggsgsggg','gggggggg','gggggggg','.ssssss.','........'],
'bottle':['..ssss..','...ww...','..w..w..','.w....w.','.wllllw.','.wlltlw.','.wllllw.','..wwww..'],
'book':['........','wwwwwwww','wssswwsw','wssswssw','wssswwsw','wssswssw','wwwwwwww','...ww...'],
'scales':['...g....','gggggggg','g..g...g','g..g...g','ss.g..ss','ss.g..ss','...g....','..ggg...'],
'shield':['wwwwwwww','wssssssw','wssggssw','wssggssw','.ssggss.','.ssggss.','..ssss..','...ss...'],
'sack':['..ssss..','...ww...','..gggg..','.gggggg.','ggsggggg','gggggggg','sggggggs','.ssssss.'],
'quill':['.....ww.','....wws.','...wws..','..wws...','.wws....','..s.....','.s......','s.......'],
'anvil':['wwwwwwww','..ssss..','...ss...','...ss...','..ssss..','.ssssss.','wwwwwwww','........'],
'key':['..ggg...','.g...g..','.g...g..','..gggggg','......g.','.....gg.','........','........']}
# Roof colors are deliberately selected from the original copper shingle ramps.
# Detailed highlight/seam pixels remain at their original coordinates.
COPPER=['c67832','c27536','ecdb95','863736','893437','ab4144','582840','562945','6b3356','532224','502120','542025','341826','36182b']
SLATE=['627a93','5d748b','d4ddd3','3d4d68','414963','657c96','283344','273344','394763','242e3b','222d3b','263243','1c2532','202737']
OLIVE=['989058','948a54','e0d4a0','625d3d','64583d','a79b64','3c3c32','3c3c34','55513b','30332b','2f332b','34362b','252a25','292b26']
GOLD=['c7a057','c09950','f1deb0','87643f','8c6440','b38b51','514337','4d4035','786045','43362e','46382d','42342d','302b26','332b28']
def rgba(hex):return tuple(bytes.fromhex(hex))+(255,)
def bake_sign(name):
 rows=[list(r) for r in BACK];assert all(len(r)==16 for r in rows)
 for y,row in enumerate(GLYPHS[name]):
  for x,c in enumerate(row):
   if c!='.':rows[11+y][4+x]=c
 im=Image.new('RGBA',(16,24))
 for y,row in enumerate(rows):
  for x,c in enumerate(row):im.putpixel((x,y),PAL[c])
 return im,[''.join(row) for row in rows]
def main():
 seed=json.loads((SOURCE/'seed.json').read_text());records=[]
 stored={r['id']:r for r in json.loads((SOURCE/'round3-detail-sources.json').read_text())} if (SOURCE/'round3-detail-sources.json').exists() else {}
 specs={1:('bed',(112,64),'T자 붉은 기와 여관','여관',None),2:('key',(64,80),'쌍박공 황동 기와 여관','여관','gold'),3:('bread',(76,64),'기와 차양과 마루가 있는 빵집','빵집',None),4:('bottle',(0,64),'올리브 지붕 약방과 옆채','약방','olive'),5:('book',(0,104),'푸른 첨탑 마법사 거처','마법사',None),6:('scales',(144,96),'넓은 박공과 옆채의 회관','회관',None),7:('bed',(96,64),'안마당과 두 날개의 큰 여관','여관',None),8:('shield',(64,96),'청회색 주거동이 붙은 무기점','무기점','slate'),9:('sack',(36,72),'둥근 지붕의 제분소','제분소',None),10:('quill',(144,96),'황동 지붕과 돌출 박공의 서점','서점','gold')}
 for item in seed['candidates']:
  if not item['id'].startswith('r3-'):continue
  n=int(item['id'].rsplit('-',1)[1]);symbol,at,name,role,ramp=specs[n];prior=stored.get(item['id']);parts=prior['baseParts'] if prior else item['components'];im=render_native({**item,'components':parts})
  chosen=[]
  if prior:
   for transfer in prior.get('nativePixelTransfers',[]):
    pixels=native(transfer['source'])
    for x,y,sx,sy in transfer['pixels']:im.putpixel((x,y),pixels.getpixel((sx,sy)))
   for x,y,color in prior.get('pixelEdits',[]):im.putpixel((x,y),tuple(color))
   at=tuple(prior['signAt'])
  if n==9:name='원뿔 기와 탑의 제분소'
  if prior:
   mapping={(tuple(bytes.fromhex(k)) if len(k)==8 else rgba(k)):(tuple(bytes.fromhex(v)) if len(v)==8 else rgba(v)) for k,v in prior['roofMapping'].items()}
   for x,y in prior['changedCoordinates']:im.putpixel((x,y),mapping[im.getpixel((x,y))]);chosen.append([x,y])
  elif ramp:
   mapping={rgba(a):rgba(b) for a,b in zip(COPPER,{'slate':SLATE,'olive':OLIVE,'gold':GOLD}[ramp])}
   rectangles={2:[(0,0,144,80)],4:[(0,0,112,64)],8:[(96,0,160,64)],10:[(48,0,160,64)]}[n]
   for x1,y1,x2,y2 in rectangles:
    for y in range(y1,y2):
     for x in range(x1,x2):
      color=im.getpixel((x,y))
      if color in mapping:im.putpixel((x,y),mapping[color]);chosen.append([x,y])
  base_name='review-'+item['id']+'-roof';base_path=ROOT/'public/assets/beodeul-architecture'/(base_name+'.png');im.save(base_path)
  sign,rows=bake_sign(symbol);sign_name='review-sign-'+symbol;sign_path=ROOT/'public/assets/beodeul-architecture'/(sign_name+'.png');sign.save(sign_path)
  original_parts=parts;item['components']=[dict(source='arch:'+base_name,rect=[0,0,item['width'],item['height']],at=[0,0],replace=False),dict(source='arch:'+sign_name,rect=[0,0,16,24],at=list(at),replace=False)]
  item.update(name=name,role=role,sign=symbol,roofPalette=ramp or 'native',nativeAssetHashes={base_name:hashlib.sha256(base_path.read_bytes()).hexdigest(),sign_name:hashlib.sha256(sign_path.read_bytes()).hexdigest()})
  records.append({**(prior or {}),**dict(id=item['id'],baseParts=original_parts,roofMapping=prior['roofMapping'] if prior else {bytes(rgba(k)).hex():bytes(rgba(v)).hex() for k,v in zip(COPPER,{'slate':SLATE,'olive':OLIVE,'gold':GOLD}.get(ramp,COPPER))},changedCoordinates=chosen,signRows=rows,signAt=at,signPalette={k:bytes(v).hex() for k,v in PAL.items()})})
 (SOURCE/'round3-detail-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n');(SOURCE/'seed.json').write_text(json.dumps(seed,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
