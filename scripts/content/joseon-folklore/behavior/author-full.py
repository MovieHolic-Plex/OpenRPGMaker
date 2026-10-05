"""Full AI tables. Skill effects are read verbatim from another role, never invented."""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'content-packs/joseon-folklore/behavior'
ap=argparse.ArgumentParser()
ap.add_argument('--skills',type=Path,default=ROOT/'content-packs/joseon-folklore/skills/data.json')
ap.add_argument('--monsters',type=Path,default=ROOT/'content-packs/joseon-folklore/monsters/data.json')
args=ap.parse_args();ids=json.loads((ROOT/'content-packs/joseon-folklore/ids.json').read_text())
def save(name,value):(OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
skills=json.loads(args.skills.read_text());monsters=json.loads(args.monsters.read_text()) if args.monsters.exists() else {'enemies':[]}
actual={r['id']:r for r in skills['skills']};monsterById={r['id']:r for r in monsters['enemies']}
missing=[v for v in ids['enemySkills'].values() if v not in actual]
def turn(s,i):return {'kind':'turn','start':s,'interval':i}
def hp(lo,hi):return {'kind':'hp','minPercent':lo,'maxPercent':hi}
def mp(lo,hi):return {'kind':'mp','minPercent':lo,'maxPercent':hi}
def state(id,present):return {'kind':'status','stateId':id,'present':present}
def allies(lo,hi):return {'kind':'allies','min':lo,'max':hi}
def act(key,p,c):return {'skillId':ids['enemySkills'][key] if key else '', 'priority':p,'condition':c,'switchOnAfterAction':{'enabled':False},'switchOffAfterAction':{'enabled':False}}
normal=[
 ('field-rat','들쥐',1,'poison-bite',72,turn(3,4),'독 물기의 실제 상태 효과에 맞춰 해독/정화. 기술 미저장 시 효과를 가정하지 않는다.'),
 ('wild-boar','산멧돼지',3,'tusk-charge',80,turn(1,3),'첫 전투 차례부터 1+3n에 돌진 준비. 실제 chargeTurns=1 예고 후 방어/단일 회복. 준비 다음 자기 차례에 단일 HP 피해.'),
 ('cave-bat','굴박쥐',3,'wing-flurry',75,allies(1,99),'동료가 있는 동안 기술 선택. 박쥐를 먼저 처치하거나 동료를 처치하면 기본 공격만 남는다.'),
 ('straw-dokkaebi','짚도깨비',4,'straw-club',70,turn(2,2),'짝수 전투 차례 직전 방어/회복. 기절/모으기 효과 없음.'),
 ('lantern-wisp','등불귀',5,'ghost-fire',76,mp(45,100),'기력45% 이상에서만 도깨비불. 실제 비용 소모로 범위 아래가 되면 기본 공격으로 전환.'),
 ('maiden-ghost','처녀귀신',5,'sorrow-cry',85,turn(1,4),'첫 전투 차례부터 1+4n에 모으기1 예고 후 전체 귀봉50%: 기본 공격·아이템 허용, HP 피해 없음. 준비 중 회복하고 봉인 후 정화/정화부로 기술 사용을 회복.'),
 ('drowned-ghost','물귀신',7,'drowning-hand',83,hp(0,50),'HP50% 아래의 손아귀에 대비하여 피해 대상을 회복. 실제 기술 효과 외 이동구속을 발명하지 않음.'),
 ('grave-ghoul','무덤귀',8,'grave-grasp',78,state('state_poison',True),'자신이 독에 걸리면 무덤저주 선택. 실제 효과는 단일 여우홀림55%(공격0.75배). 독 부여 시 이 반응을 고려하고 집중 처치.'),
 ('fox-spirit','여우령',10,'fox-charm',88,mp(70,100),'기력70% 이상에서 홀림. 실제 여우홀림은 공격력0.75배이며 동료 공격/명령 강제 아님.'),
 ('stone-dokkaebi','돌도깨비',12,'stone-crush',82,allies(0,0),'마지막 살아 있는 동료가 되면 내리찍기 선택. 먼저 돌도깨비를 처치해 마지막 조건을 피한다.'),
 ('bamboo-specter','대숲귀',14,'bamboo-whip',77,state('state_poison',False),'자신이 독에 걸리지 않았을 때 채찍 선택. 도적의 실제 독칼로 독을 부여하면 기술 조건이 꺼지고 기본 공격은 유지. 무덤귀는 반대로 독에 걸리면 저주를 사용.'),
 ('masked-bandit','탈쓴 산적',16,'straw-club',78,turn(1,3),'1+3n에 짚방망이를 사용. HP30% 아래에서는 독 물기 재사용; 실제 이름/효과를 그대로 표시.')]
boss_specs=[
 ('bronze-dokkaebi','청동도깨비',6,[('bronze-smash',80,turn(2,4)),('bronze-smash',95,hp(0,40))],40,
  '초반: 2+4n 전체 공격 준비. HP40% 이하에서 주기 밖에도 준비/발동 반복. 예고를 보면 전사 방어, 도사 회복, 도적·주술사는 처치 가능한 때 피해. 진입 전에 파티 HP 정비.'),
 ('bride-wraith','혼례 원귀',12,[('sorrow-cry',70,turn(1,4)),('bronze-smash',85,turn(4,6)),('bronze-smash',98,hp(0,55))],55,
  '중반: 귀봉 예고와 긴 주기 전체 강타. HP55% 이하에서 전체 강타 준비 빈도 증가. 귀봉은 기술만 막으므로 정화부/기본 공격 사용 가능. 전체 피해 예고 중 도사 회복/파티 방어. 실제 청동강타 이름·효과·연출을 재사용.'),
 ('mountain-tiger','산군',18,[('stone-crush',80,turn(2,3)),('poison-bite',60,hp(0,70)),('bronze-smash',85,turn(5,5)),('bronze-smash',98,hp(0,35))],35,
  '후반: 주기 돌내리찍기, HP70% 아래 독 물기로 기본 차례를 대체, HP35% 아래 전체 강타 준비 빈도 증가. 실제 독 제거 수단을 준비하고 전체 예고 중 방어/회복. 기존 기술명을 그대로 표시하며 새 포효/발톱/즉사를 발명하지 않는다.')]
roster=[];rows=[]
for i,(slug,name,level,key,p,c,response) in enumerate(normal):
 actions=[act(None,1,{'kind':'always'}),act(key,p,c)]
 if slug=='masked-bandit':actions.append(act('poison-bite',92,hp(0,30)))
 rows.append({'enemyId':ids['enemies'][slug],'actions':actions,'skillIds':[a['skillId'] for a in actions if a['skillId']]})
 roster.append({'slug':slug,'enemyId':ids['enemies'][slug],'name':name,'role':'normal','recommendedLevel':level,
  'playerResponse':response,'hpThreshold':None,'primaryCondition':c,
  'scenarioStats':{'maxHp':max(90,100+i*9),'maxMp':60,'attack':14+i*2,'defense':10+i,'mind':12+i*2,'agility':30+i}})
for slug,name,level,spec,threshold,response in boss_specs:
 actions=[act(None,1,{'kind':'always'})]+[act(*s) for s in spec]
 rows.append({'enemyId':ids['enemies'][slug],'actions':actions,'skillIds':[a['skillId'] for a in actions if a['skillId']]})
 roster.append({'slug':slug,'enemyId':ids['enemies'][slug],'name':name,'role':'boss','recommendedLevel':level,
  'playerResponse':response,'hpThreshold':threshold,'primaryCondition':actions[1]['condition'],
  'scenarioStats':{'maxHp':{'bronze-dokkaebi':680,'bride-wraith':1600,'mountain-tiger':2800}[slug],
   'maxMp':120,'attack':{'bronze-dokkaebi':25,'bride-wraith':34,'mountain-tiger':48}[slug],
   'defense':20,'mind':35,'agility':35}})
for record,row in zip(roster,rows):
 record['actions']=row['actions'];record['skillContracts']=[]
 for id in dict.fromkeys(row['skillIds']):
  s=actual.get(id)
  record['skillContracts'].append({'skillId':id,'sourcePresent':s is not None,
   **({'name':s['name'],'scope':s['scope'],'effect':s['effect'],'power':s['power'],'mpCost':s['mpCost'],
      'chargeTurns':s.get('chargeTurns',0),'stateEffects':s.get('stateEffects',[]),'description':s.get('description',''),
      'hitSequence':s.get('hitSequence'),'elementId':s.get('elementId'),'cooldownTurns':s.get('cooldownTurns',0)} if s else {})})
 record['currentMonsterRecord']=monsterById.get(record['enemyId'])
 if record['currentMonsterRecord']:
  original=record['currentMonsterRecord']['stats']
  record['scenarioStats']=dict(original)
  costs=[s['mpCost'].get('flat',0) for s in record['skillContracts'] if s['sourcePresent']]
  if record['scenarioStats']['maxMp']==0 and max(costs+[0])>0:
   record['scenarioStats']['maxMp']=max(costs)*4
  record['scenarioStatOverrides']={k:v for k,v in record['scenarioStats'].items() if v!=original[k]}
 record['integrationRequirements']={'basicAttackAlwaysCandidate':True,
  'requiredMaximumMpForOneUse':max([s['mpCost'].get('flat',0) for s in record['skillContracts'] if s['sourcePresent']]+[0]),
  'stats':'Actual monster stats; declared MP-only override in 0-MP cases for positive AI probes. sourceStats probes keep original MP. No other-role record is patched.',
  'pendingSkillIds':[s['skillId'] for s in record['skillContracts'] if not s['sourcePresent']]}
save('data.json',{'enemyActions':rows})
save('skills-source.json',{'sourcePath':str(args.skills),'sha256':sha(args.skills),'purpose':'read-only original input snapshot for reproducible runtime evidence, NOT registration data','records':skills})
save('monsters-source.json',{'sourcePath':str(args.monsters),'sha256':sha(args.monsters) if args.monsters.exists() else None,'purpose':'read-only source snapshot; no cross-role mutations','records':monsters})
save('design.json',{'packId':ids['packId'],'phase':'full','battleModel':'rm2k3','battleUiStyle':'retro2003',
 'counts':{'normals':12,'bosses':3,'enemyActions':15,'actionPatterns':sum(len(r['actions']) for r in rows)},
 'roster':roster,'skillSource':{'path':str(args.skills),'sha256':sha(args.skills),'missingIds':missing},
 'engineContract':{'conditions':'one existing condition per action, no and/phase/new switch or state',
  'priority':'priority*10+utility; not probability or absolute priority. Finishing target damage may add1000.',
  'basic':'skillId empty string always priority1; runtime basic fallback remains legal after MP depletion or sealing',
  'turn':'strict round versus gauge cycle; chargeTurns counts subsequent OWN turns. Different agility can change wall time/party opportunities.',
  'hp':'inclusive real percent, comparisons after authored HP/MP changes; pending charged action keeps old choice',
  'warning':'Only real source chargeTurns. All bosses reuse actual bronze-smash name/scope/cost/effect. No fake AI fixture skills.',
  'responses':'defend halves HP damage; support state does not cause HP damage and guarding does not remove a seal. Do not claim dialogue/terrain avoids attacks.',
  'reactions':'none; out-of-turn reactions bypass charge, so do not reuse charged attacks there.'},
 'limits':['All skills sourced from skills/data.json; missing IDs are blockers, not manufactured records.',
  'Full AI runtime can use declared enemy/party scenario stats; actual monster-source compatibility checked separately and reported.',
  'source PNGs are references; own board is a behavior visualization, not shipped-player evidence.',
  'root performs enemy merge, public registration, final gameplay balance and canonical save/reload. No DB writes here.']})
print(json.dumps({'enemyActions':15,'missingRealSkills':missing,'skillSha256':sha(args.skills)},ensure_ascii=False))
