"""Three hand-authored identity revisions on pinned gait templates.
Explicit rows and exact replacements only; no random geometry or pixel fitting.
"""
from pathlib import Path
import json,sys
P=Path(__file__).resolve().parent;H=P.parents[1];sys.path.insert(0,str(H/'lib'))
from template import base,replay
DESIGNS={
'professor':{
'palette':{'5':'#eee6d5','6':'#b1b5b5','7':'#596374','8':'#ce9464','9':'#905550','A':'#503949','B':'#e3e3d4','C':'#a0abae','D':'#454a58','E':'#fff3da','F':'#292936'},
'front':['.....DDDDDD.....','...DD111111DD...','..DBB111111BBD..','.DBBB211112BBBD.','..DBCD1111DCBD..','.DBD1D1111D1DBD.','DD1D7EE77EE7D1DD','.42D7F2772F7D24.','..433242242334..','..7D32222223D7..'],
'back':['.....DDDDDD.....','...DD111111DD...','..DB11111111BD..','.DBB21111112BBD.','..DBB221122BBD..','.DBBBBCCCCBBBBD.','DDBBBCCCCCCBBBDD','.DDBBBCCCCBBBDD.','..DDDBBBBBBDDD..','..FFDDDDDDDDFF..'],
'left':['.....DDDDDD.....','....D111111DD...','...D1111111BBD..','..DD211111BBBCD.','..D22111DBBBBCD.','..D111DDBBBCDDD.','..47E7F3DCCDDDDD','..47F713DDDDDD..','..422423D23FDF..','...43333D23FF...'],
'rules':[('DC3333CD','E633336E'),('EEDDDDEE','EEA55AEE'),('6EE33EE6','6EE99EE6'),('E9449E','E9559E'),('FFFFFF','EEE55E'),('55555555','55E66E55'),('A8E7EEE57','A8E6E8857'),('A8E777E57','A8E6E8857'),('A877EEE57','A866E8857')],
'name':'해명 v2 · 안경 박사','design':'둥근 이마와 흰 옆머리, 테 안경, 긴 연구복 안의 자주색 조끼'},
'ranger':{
'palette':{'5':'#d77752','6':'#a45042','7':'#654539','8':'#99b275','9':'#637f51','A':'#334b3d','B':'#d39a5d','C':'#976341','D':'#4b3c34','E':'#eee1bd','F':'#282f32'},
'front':['......DDDD......','....DDDBBBDD....','...DDBBBBBBCD...','..DBBBBCBBBBCD..','..DBBCC1111BCD..','.DDBBC111111CDD.','.DCCB1111111CCD.','.4D221111112DD4.','.43C22F11F22C34.','..4332F22F2334..','...4333223334...'],
'back':['......DDDD......','....DDDBBBDD....','...DDBBBBBBCD...','..DBBBBCBBBBCD..','..DBBBCCCCBBCD..','.DDBBCCCCCCBCDD.','.DCCBBCCCCBBCCD.','.DDCCBBBBBBCCDD.','.FDCCCCCCCCDCDF.','..FDDCCCCCCDDF..','...FDDDDDDDDF...'],
'left':['......DDDD......','....DDDBBBDD....','...DDBBBBBBCD...','..DBBBBCBBBBCD..','..DBBBCCBBBBCD..','..D1111BCBBBCD..','..41111DCCCCCD..','..411112DDCCDD..','..411F23DDCCCD..','..422F23D13CDD..','...433333234DF..'],
'rules':[('44333344','A555555A'),('99444499','9E5665E9'),('944333344D','95A5555A9D'),('D443333449','D9A5555A59'),('9944449','9E56659'),('9444499','95566E9'),('FFDDDDFF','55555555'),('FFFF','5555'),('98888889','98E99E89'),('9888889','98E9E89'),('988889','98EE89'),('A894488A','A895588A'),('A899448A','A89EE58A'),('A844988A','A855E88A'),('FF43349F','A943349F')],
'name':'솔찬 v2 · 적갈색 머리 레인저','design':'챙모자를 벗은 적갈색 머리, 짧은 주황 목수건, 주머니가 있는 숲색 조끼'},
'captain':{
'palette':{'5':'#e2bd68','6':'#a88648','7':'#6b5146','8':'#78909f','9':'#465e79','A':'#283950','B':'#d8d7c5','C':'#959c9c','D':'#4b505a','E':'#f4ead5','F':'#252d3c'},
'front':['.....AAAAAA.....','...AAEEEEEEAA...','..AEEEEE5EEEEA..','..AEEEE555EEEA..','..A9999999999A..','.AAAAA9999AAAAA.','..4C22111122C4..','.43422111122434.','.4342FF11FF2434.','..43CC2222CC34..'],
'back':['.....AAAAAA.....','...AAEEEEEEAA...','..AEEEEEEEEEEA..','..AEEEEEEEEEEA..','..A9999999999A..','..ACCBBBBBBCCA..','..DCCCCCCCCCCD..','.4DDCCCCCCCCDD4.','.4DDDCCCCCCDDD4.','..FDDDDDDDDDDF..'],
'left':['.....AAAAAA.....','...AAEEEEEEAA...','..AEEEEEEEEEEA..','..AEEEEEEEEE9A..','.AA9999999999A..','.AAAAAEEE99CCD..','..411123CCCCCD..','..411FF3CCCCDD..','..422223C13DDD..','...43CC3C234DF..','....4CCCCCDDF...'],
'body':{
'down_idle':['.A955CC33CC559A.','A9988E4444E8899A','A998EEEAAEEE899A','A965AE8AA8EA569A','43A95AE88EA59734','.7D99E5665E99D7.','..DCC999999CCD..'],
'down_stepA':['.A955CC33CC559A.','A9988E4444E889A.','A998EEEAAEEE99A.','.AA5AE8AA8EA334.','..A95AE88EA5424.','..D99E5665E5434.'],
'up_idle':['.A155BBBBBB551A.','A9988EEEEEE8899A','A99889999998899A','A96998888889969A','43A9999999999D34','.7D9955555599D7.','..DCC999999CCD..'],
'up_stepA':['.A155BBBBBB551A.','A9988EEEEEE889A.','A9988999999889A.','.AA998888889A34.','..A999999999424.','..D995555559434.'],
'left_idle':['.....559998A....','....AA99599AA...','....A9855EE9A...','....AE2223EEA...','....A9533759A...','.....DC77CCCD...'],
'left_stepA':['.....559998A....','....AA99599AA...','....A9855EE9A...','...DAE2223EEA...','..FDA9533759A...'],
'left_stepB':['.....559998A....','....AA99599AA...','....A9855EE9A...','....AE2223EEA...','....CE9533759A..']},
'name':'해준 v2 · 제복 선장','design':'넓은 챙과 금장 문장의 선장모, 회색 수염, 금빛 단추와 소매 장식의 긴 항해복'}
}
for role,design in DESIGNS.items():
 old=json.loads((H/'examples'/role/'template.json').read_text());record,palette,frames=base(old['templateId']);patches=[]
 for direction in ['up','down','left']:
  head=design[{'up':'back','down':'front','left':'left'}[direction]]
  for pose in ['stepA','idle','stepB']:
   name=direction+'_'+pose;start=11 if pose=='idle' else 12;rows=frames[name].copy();rows[start:start+len(head)]=head
   if 'body' in design:
    body=design['body'].get(name)
    if body is None:body=[r[::-1] for r in design['body'][direction+'_stepA']]
    rows[start+len(head):28]=body
   else:
    for y in range(max(21,start+len(head)),28):
     for a,b in design['rules']:
      assert len(a)==len(b),(role,a,b)
      rows[y]=rows[y].replace(a,b)
   assert len(rows)==32,(name,len(rows))
   for y in range(start,28):
    assert len(rows[y])==16,(role,name,y,len(rows[y]),rows[y])
    patches.append({'frame':name,'y':y,'rows':[rows[y]]})
   if direction=='left':
    for y in range(start,28):patches.append({'frame':'right_'+pose,'y':y,'rows':[rows[y][::-1]]})
 spec={'version':1,'templateId':old['templateId'],'templateSourceSha256':record['sha256'],'paletteOverrides':design['palette'],'patches':patches,'protectedRows':[28,29,30,31],'design':design['design'],'editSource':'author.py explicit rows and exact clothing-string replacements at original pose offsets. Original mirrored side-view contract retained.'}
 replay(spec)
 folder=P/role;folder.mkdir(exist_ok=True);(folder/'template.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
 meta=json.loads((H/'examples'/role/'candidate.json').read_text());meta.update(variant=design['name'],description=design['design'],identity=design['design']+' · 원작 보행과 발 접지 유지',collection='identity-wave-2',base=role+'-identity-v2',sourceNote='에메랄드 '+old['templateId']+'의 몸·보행을 판형으로 사용하고 머리·얼굴·옷을 명시적 픽셀 행으로 수정한 파생 캐릭터입니다.',author='Codex GPT-6')
 (folder/'candidate.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print(role,'ready')
