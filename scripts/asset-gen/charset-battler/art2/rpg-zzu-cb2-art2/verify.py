"""실제 원화·배포 시트·GIF를 다시 열어 도트 계약을 확인한다."""
from pathlib import Path
import hashlib
import json
import sys
sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paint import OWNED, HERE, LIGHT
from cb_lib import CAST_TYPES, POSES, SRC_DIR, OUT_DIR, CAST_DIR, palette
from PIL import Image

report={}
for cid in OWNED:
 root=Path(SRC_DIR)/cid; base=set(palette(cid)); cells={}; silhouettes=set(); extras=[]
 cast_sheet=Image.open(Path(CAST_DIR)/f'{cid}.png').convert('RGBA')
 battle_sheet=Image.open(Path(OUT_DIR)/f'{cid}.png').convert('RGBA')
 assert cast_sheet.size==(144,336)
 assert battle_sheet.size==(144,384)
 for row,(ct,_) in enumerate(CAST_TYPES):
  for step in (1,2,3):
   key=f'cast_{ct}_{step}'
   im=Image.open(root/f'{key}.png').convert('RGBA')
   assert im.size==(48,48),(cid,key,'크기')
   pixels=list(im.get_flattened_data())
   assert {c[3] for c in pixels}<={0,255},(cid,key,'알파')
   assert im.getbbox()[3]==45,(cid,key,im.getbbox())
   extra={c[:3] for c in pixels if c[3]}-base
   assert len(extra)<=6,(cid,key,'추가색',len(extra))
   extras.append(len(extra))
   packed=cast_sheet.crop(((step-1)*48,row*48,step*48,(row+1)*48))
   assert packed.tobytes()==im.tobytes(),(cid,key,'시트 대응')
   silhouettes.add(hashlib.sha256(im.getchannel('A').tobytes()).hexdigest())
   cells[key]={'last_row':44,'extra_colors':len(extra),'sha256':hashlib.sha256(im.tobytes()).hexdigest()}
 assert len(silhouettes)==21,(cid,'중복 실루엣')
 battle_extras=set(); bounds={}
 for pid,col,row,_ in POSES:
  im=Image.open(root/f'{pid}.png').convert('RGBA')
  assert im.size==(48,48)
  bounds[pid]=list(im.getbbox())
  battle_extras.update({p[:3] for p in im.get_flattened_data() if p[3]}-base)
  assert {p[3] for p in im.get_flattened_data()}<={0,255}
  assert im.getbbox()[3]==45,(cid,pid,im.getbbox())
  assert battle_sheet.crop((col*48,row*48,(col+1)*48,(row+1)*48)).tobytes()==im.tobytes()
 for a,b in zip(('cast_charge','cast_raise','cast_release'),(1,2,3)):
  assert Image.open(root/f'{a}.png').tobytes()==Image.open(root/f'cast_arcane_{b}.png').tobytes()
 gif=Image.open(root/'_cast.gif'); durations=[]
 assert gif.n_frames==3 and gif.size==(1344,208)
 for n in range(gif.n_frames):
  gif.seek(n);durations.append(gif.info['duration'])
 assert durations==[160,160,160]
 # 기존 보고서의 '걷기 원본 보존'과 배포 해시도 현재 결과로 갱신한다.
 legacy=json.loads((root/'_validation.json').read_text())
 legacy.update(redrawn=[pid for pid,*_ in POSES if pid!='front'],preserved_source_frames=['front'],
  extra_colors=sorted(battle_extras),bounds=bounds,
  sheet_sha256=hashlib.sha256((Path(OUT_DIR)/f'{cid}.png').read_bytes()).hexdigest(),
  revision='시전 2차: 무기 보유 걷기, 비전 공통 시전',cast_validation='_cast_validation.json')
 (root/'_validation.json').write_text(json.dumps(legacy,ensure_ascii=False,indent=2)+'\n')
 summary={'cast_cells':21,'battle_cells':24,'unique_cast_silhouettes':len(silhouettes),'max_extra_colors_per_cell':max(extras),'gif_ms':durations,'cells':cells}
 (root/'_cast_validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 report[cid]={k:v for k,v in summary.items() if k!='cells'}
 print(cid,'시전21·전투24·알파·y44·추가색≤6·시트셀·GIF160ms 통과')
(HERE/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
