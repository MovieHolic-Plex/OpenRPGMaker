"""담당 원화·합성 시트·동작 확인판의 픽셀 계약을 직접 검사한다."""
import sys, json, hashlib
from pathlib import Path
from PIL import Image
sys.dont_write_bytecode=True
from draw import IDS, HERE, SEQUENCES, EXTRA
from cb_lib import POSES, SRC_DIR, OUT_DIR, palette, place, walk_frame, validate

reports={}
for cid in IDS:
 directory=Path(SRC_DIR)/cid
 sheet=Image.open(Path(OUT_DIR)/f'{cid}.png').convert('RGBA')
 assert sheet.size==(144,384)
 used=set(); images={}
 for pid,col,row,_ in POSES:
  im=Image.open(directory/f'{pid}.png').convert('RGBA');images[pid]=im
  assert im.size==(48,48)
  assert {p[3] for p in im.getdata()}<={0,255},(cid,pid,'알파')
  assert im.getbbox()[3]==45,(cid,pid,'기준선')
  assert not validate(cid,pid,im),(cid,pid,'공용 검사')
  assert sheet.crop((col*48,row*48,col*48+48,row*48+48)).tobytes()==im.tobytes(),(cid,pid,'합성')
  used.update(p[:3] for p in im.getdata() if p[3])
 extra=used-set(palette(cid))
 assert extra<=set(EXTRA) and len(extra)<=6,(cid,'색')
 for pid,p in [('walk_a',0),('walk_b',1),('walk_c',2)]:
  assert images[pid].tobytes()==place(walk_frame(cid,'left',p)).tobytes()
 assert images['front'].tobytes()==place(walk_frame(cid,'down',1)).tobytes()
 order=sum(SEQUENCES,[])
 gif=Image.open(directory/'_motion.gif');strip=Image.open(directory/'_motion.png').convert('RGB')
 assert gif.n_frames==16 and gif.size==(192,192)
 assert strip.size==(3072,216)
 for i,pid in enumerate(order):
  gif.seek(i)
  assert gif.info['duration']==120
  enlarged=images[pid].resize((192,192),Image.Resampling.NEAREST)
  expected=Image.new('RGB',(192,192),(38,42,51));expected.paste(enlarged,(0,0),enlarged)
  assert gif.convert('RGB').tobytes()==expected.tobytes(),(cid,i,'GIF')
  assert strip.crop((i*192,24,i*192+192,216)).tobytes()==expected.tobytes(),(cid,i,'확인판')
 reports[cid]={'poses':24,'groundY':44,'additionalColors':sorted(extra),'alpha':[0,255],
  'sheetSize':[144,384],'gifFrames':16,'gifDurationMs':120,'gifScale':4,
  'walkAndFront':'source pixels unchanged','sheetSha256':hashlib.sha256(sheet.tobytes()).hexdigest(),
  'rawPixelsAndSheetAndMotion':'pass'}
(HERE/'audit.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
print('6명 × 24칸 = 144 원화: 크기/알파/발 기준선/색/합성 일치 통과')
print('6 GIF × 16칸: 순서/120ms/nearest 4배/PNG 픽셀 일치 통과')
