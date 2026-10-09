"""Explicit authored replacement rows; source gait and feet remain the pinned template."""
import json
from pathlib import Path
P=Path(__file__).parent
spec=json.loads((P/'template.json').read_text())
spec['paletteOverrides']={'1':'#ffd5b4','2':'#efb78b','3':'#cd8568','4':'#784a43','5':'#efd09a','6':'#c19a61','7':'#6d503d','8':'#7db3a6','9':'#498579','A':'#295455','B':'#b08053','C':'#69513e','D':'#323139','E':'#f2e7cf','F':'#24222d'}
FRONT=['.....AAAAAA.....','....A888888A....','...A88888899A...','..A8899999999A..','..A99EEEEE999A..','..DC211112CCD...','..D21111112CD...','..D322F11F223D..','..4332F22F2334..','...43CC22CC34...']
BACK=['.....AAAAAA.....','....A888888A....','...A88888899A...','..A8899999999A..','..A99EEEEE999A..','..A9999999999A..','..DA999999A9AA..','...DAAAAADD9A...','...DDCCCCDD9A...','....DDDDDD.A....']
LEFT=['.....AAAAAA.....','...AA888889A....','..A888888999A...','..A8899999999A..','..A99EEEE9999A..','..D1111DD999AA..','..411112D9999A..','..422F23DD99AA..','..422F233DD9A...','..4CC22234D9A...','...443334DD.A...']
BODY={
'down_idle':['...CB622226BC...','..CB5E4444E5BC..','..CB65EEEE56BC..','.424C65EE56C424.','.434C655556C434.','..4DC666666CD4..','...DCE6666ECD...'],
'down_stepA':['..4CB622226C....','.42BC644446BC...','.43BC5EEEE68C...','..44C655556CC...','...4C655554224..','...DC666664334..'],
'down_stepB':['....C622226BC4..','...CB644446CB24.','...C86EEEE5CB34.','...CC655556C44..','..422455556C4...','..433466666CD...'],
'up_idle':['...CBEEEEEABC...','..CB5EEEEAE5BC..','..CB65EEEA56BC..','.42BC655556CB24.','.434C65EE56C434.','..4DC666666CD4..','...DCE6666ECD...'],
'up_stepA':['..4CBEEEEABC....','.42BC6EEEAEBC...','.43BC5EEEAE8C...','..44C655556CC...','...4C65EE54224..','...DC666664334..'],
'up_stepB':['....CBEEEABC4...','...CB6EEEAEBC24.','...C85EEEAEBC34.','...CC655556C44..','..42245EE56C4...','..433466666CD...'],
'left_idle':['....C6EE5CD.....','....C6EE56BC....','....65CC6CBC....','....EE4226BC....','....664334BC....','....6CC44CCD....'],
'left_stepA':['.....C6E5CD.....','....C6EE56BC....','....65CC6CBC....','....E42246BC....','....643346BCD...'],
'left_stepB':['.....C6E5CD.....','....C6EE56BC....','....65CC6CBC....','....6654224C....','....6CC4334C7...']}
patches=[]
for pose in ['stepA','idle','stepB']:
 for direction,head in [('up',BACK),('down',FRONT),('left',LEFT)]:
  name=direction+'_'+pose;y=11 if pose=='idle' else 12
  rows=head+BODY[name]
  assert y+len(rows)==28,(name,y,len(rows))
  for row in rows:assert len(row)==16,(name,len(row),row)
  patches.append({'frame':name,'y':y,'rows':rows})
  if direction=='left':
   # The pinned source right-facing view is the same native left pose mirrored.
   patches.append({'frame':'right_'+pose,'y':y,'rows':[row[::-1] for row in rows]})
spec['patches']=patches;spec['design']='청록 두건과 뒤 매듭, 콧수염, 가죽 작업 조끼와 짧은 모래색 앞치마';spec['editSource']='author.py literal authored head and garment rows at original pose offsets; original mirrored side-view contract; protected source foot rows unchanged.'
(P/'template.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
meta=json.loads((P/'candidate.json').read_text());meta.update(author='Codex GPT-6',description=spec['design'],identity='머리의 둥근 앞머리를 두건과 매듭으로 교체. 얼굴에 콧수염. 셔츠·긴 앞치마를 가죽 조끼·작업 앞치마로 재설계.',sourceNote='에메랄드 mart_employee의 보행·접지를 판형으로 유지하고 Codex가 머리·얼굴·몸통의 픽셀 행을 다시 저작한 파생 후보입니다. 원작 기반임을 명시합니다.',collection='merchant-redesign-v2',base='mart_employee-merchant-v2')
(P/'candidate.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
