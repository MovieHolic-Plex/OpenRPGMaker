"""담당 에셋만 읽어 원본·색·격자·GIF 계약을 확인하고 근거를 남긴다."""
from pathlib import Path
import sys, json, hashlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from draw import OWNED, EXTRA, MOTIONS, LIB
sys.path.insert(0, str(LIB))
from PIL import Image, ImageChops
from cb_lib import POSES, SRC_DIR, OUT_DIR, palette, place, walk_frame
from baseline import make as baseline

reports={}
for cid in OWNED:
 folder=Path(SRC_DIR)/cid
 original=baseline(cid)
 allowed=set(palette(cid))
 actual=set(); unchanged=[]; changed=[]; boxes={}
 sheet=Image.open(Path(OUT_DIR)/(cid+'.png')).convert('RGBA')
 assert sheet.size==(144,384)
 for pid,col,row,_ in POSES:
  im=Image.open(folder/(pid+'.png')).convert('RGBA')
  assert im.size==(48,48), (cid,pid,'크기')
  assert set(im.getchannel('A').get_flattened_data())<={0,255}, (cid,pid,'알파')
  assert im.getbbox()[3]-1==44, (cid,pid,'바닥')
  assert im.tobytes()==sheet.crop((48*col,48*row,48*(col+1),48*(row+1))).tobytes(), (cid,pid,'시트 좌표')
  actual|={c[:3] for c in im.get_flattened_data() if c[3]}
  (unchanged if im.tobytes()==original[pid].tobytes() else changed).append(pid)
  boxes[pid]=list(im.getbbox())
 extra=actual-allowed
 assert extra<=set(EXTRA) and len(extra)<=6, (cid,'추가색',extra)
 assert set(unchanged)=={'walk_a','walk_b','walk_c','front'}, (cid,'기준선 잔존',unchanged)
 for name,pattern in [('walk_a',0),('walk_b',1),('walk_c',2)]:
  assert Image.open(folder/(name+'.png')).tobytes()==place(walk_frame(cid,'left',pattern)).tobytes()
 assert Image.open(folder/'front.png').tobytes()==place(walk_frame(cid,'down',1)).tobytes()
 seq=[pid for _,names in MOTIONS for pid in names]
 gif=Image.open(folder/'_motion.gif'); strip=Image.open(folder/'_motion.png').convert('RGB')
 assert gif.n_frames==len(seq)==16
 assert gif.info['loop']==0
 assert strip.size==(3072,212)
 for i,pid in enumerate(seq):
  gif.seek(i)
  assert gif.info['duration']==120
  frame=gif.convert('RGB')
  assert ImageChops.difference(frame,strip.crop((192*i,0,192*(i+1),212))).getbbox() is None
  canvas=Image.new('RGB',(192,192),(39,43,55))
  raw=Image.open(folder/(pid+'.png')).resize((192,192),Image.Resampling.NEAREST)
  canvas.paste(raw,(0,0),raw)
  # 바닥 안내선은 원본 투명 공간에만 있으므로 캐릭터 픽셀을 별도로 비교한다.
  rendered=frame.crop((0,20,192,212))
  for y in range(192):
   for x in range(192):
    if raw.getpixel((x,y))[3]:assert canvas.getpixel((x,y))==rendered.getpixel((x,y))
 report={'character':cid,'poses':24,'redrawn':changed,'preserved_source_frames':unchanged,
  'extra_colors':sorted(list(extra)),'alpha':[0,255],'last_opaque_row':44,
  'sheet_size':[144,384],'sheet_sha256':hashlib.sha256((Path(OUT_DIR)/(cid+'.png')).read_bytes()).hexdigest(),
  'motion_frames':seq,'motion_duration_ms':120,'motion_scale':4,'motion_filter':'nearest',
  'bounds':boxes,'runtime_qa':'미실행: 아트 저작 역할 범위 밖','canonical_project_write':'미실행: 감독 통합 대상'}
 (folder/'_validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 reports[cid]=report
 print(cid, '통과: 새 자세20 + 원본4, 48px/3x8, y44, 알파0/255, 추가색',len(extra),'GIF16칸×120ms')
(Path(__file__).resolve().parent/'validation.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
