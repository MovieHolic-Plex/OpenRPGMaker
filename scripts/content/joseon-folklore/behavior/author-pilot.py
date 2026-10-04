"""Deterministic authored AI data; writes only the behavior content folder."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'content-packs/joseon-folklore/behavior'
IDS=json.loads((ROOT/'content-packs/joseon-folklore/ids.json').read_text())
def save(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def action(skill,priority,condition):
    return dict(skillId=IDS['enemySkills'][skill] if skill else '',priority=priority,condition=condition,
                switchOnAfterAction={'enabled':False},switchOffAfterAction={'enabled':False})
def turn(start,interval):return dict(kind='turn',start=start,interval=interval)
def hp(lo,hi):return dict(kind='hp',minPercent=lo,maxPercent=hi)
PILOT=[('wild-boar','tusk-charge',2,3,80),('straw-dokkaebi','straw-club',2,2,70),
       ('maiden-ghost','sorrow-cry',2,3,80),('bronze-dokkaebi','bronze-smash',2,4,80)]
rows=[]
for slug,skill,start,interval,priority in PILOT:
    actions=[action('',1,{'kind':'always'}),action(skill,priority,turn(start,interval))]
    if slug=='bronze-dokkaebi':actions.append(action(skill,95,hp(0,40)))
    rows.append(dict(enemyId=IDS['enemies'][slug],actions=actions,skillIds=[a['skillId'] for a in actions if a['skillId']]))
save('data.json',{'enemyActions':rows})
# Requirements are integration assertions, not authored SkillRecords or DB mutations.
requirements=[]
for key,name,scope,power,stat,charge in [
 ('tusk-charge','엄니 돌진','enemy',24,'attack',1),
 ('straw-club','짚 방망이','enemy',18,'attack',0),
 ('sorrow-cry','서러운 곡성','enemy',20,'mind',1),
 ('bronze-smash','청동 내려치기','allEnemies',28,'attack',1)]:
    requirements.append(dict(skillId=IDS['enemySkills'][key],fixtureName=name,scope=scope,chargeTurns=charge,
        fixturePower=power,fixtureStatistic=stat,fixtureMpCost=0,
        requiredEffect={'kind':'damage','affects':'hp'},
        note='skills 담당 정본과 대조 필요. 위력/기력은 샘플 실행용 제안이며 behavior가 기술을 등록하지 않는다.'))
normal=[
 ('field-rat','들쥐',1,2,'poison-bite',3,3,'독 물기는 3+3n; 기본 공격은 나머지 차례.',
  '독에 걸리면 해독약/도사의 정화. 독 부여는 해당 기술의 실제 state_poison 효과를 확인한 뒤 사용.'),
 ('wild-boar','산멧돼지',2,4,'tusk-charge',2,3,'2+3n에서 돌진을 준비하고 다음 자기 차례에 단일 물리 피해.',
  '예고를 본 뒤 HP가 낮은 동료를 회복하거나 방어. 도적은 다음 발동 전 처치에 집중.'),
 ('cave-bat','굴박쥐',2,4,'wing-flurry',2,3,'날개 연타 2+3n; 실제 hitSequence를 skills 담당이 제공할 때만 다타격으로 설명.',
  '한 대상에 몰리는 피해를 회복하고 우선 처치. 장면 이동으로 회피할 수 있다고 약속하지 않는다.'),
 ('straw-dokkaebi','짚도깨비',3,5,'straw-club',2,2,'짝수 전투 차례의 곤봉, 홀수의 기본 공격. 모으기 없음.',
  '주기 공격 직전 방어/회복. 이번 샘플에는 불 약점이나 넘어뜨림을 구현하지 않는다.'),
 ('lantern-wisp','등불귀',4,6,'ghost-fire',2,3,'도깨비불 2+3n. 불 속성은 기술과 적 속성 레코드가 제공할 때만 활성.',
  '정의된 불 저항 장비를 확인하고 집중 공격. 실체 없는 횃불 끄기 기믹은 없음.'),
 ('maiden-ghost','처녀귀신',4,6,'sorrow-cry',2,3,'2+3n 곡성 준비, 다음 자기 차례 단일 mind 기반 마법 HP 피해.',
  '예고 중 회복/방어. 주술사는 피해, 도사는 HP 관리. 대화/성불로 전투를 끝내는 조건은 없음.'),
 ('drowned-ghost','물귀신',6,8,'drowning-hand',2,3,'끌어당기는 손 2+3n; 기술의 실제 효과만 설명.',
  '피해 대상 회복/방어. 젖음·이동 제한은 예약 상태에 없으므로 만들지 않는다.'),
 ('grave-ghoul','무덤귀',7,9,'grave-grasp',2,2,'무덤 손아귀 짝수 차례, 기본 공격 나머지.',
  '연속 피해를 줄이도록 먼저 처치. 부활 방해·즉사는 없음.'),
 ('fox-spirit','여우령',8,11,'fox-charm',2,4,'여우 홀림 2+4n. state_jf_fox_charm만 참조 가능; 실제 restriction 검토 전 동료 공격을 약속하지 않음.',
  '정화 기술이 이 상태를 실제 remove하는지 확인하고 사용. 무조건 해제 설명은 금지.'),
 ('stone-dokkaebi','돌도깨비',10,13,'stone-crush',2,3,'돌 내리찍기 2+3n, 기본 공격 나머지.',
  '발동 예고는 chargeTurns가 실제 있는 경우만. 전사는 방어, 주술사는 기력 피해로 공략.'),
 ('bamboo-specter','대숲귀',12,15,'bamboo-whip',2,2,'대나무 채찍 짝수 차례; allEnemies 또는 area는 실제 기술을 확인해야 함.',
  '대상 범위를 확인해 단일/파티 회복 선택. 지형 이동이나 줄 끊기는 현재 규칙에 없음.'),
 ('masked-bandit','탈쓴 산적',14,17,None,None,None,'기본 공격만. 별도 산적 기술 슬롯이 없으므로 가짜 훔치기/연막 기술을 추가하지 않는다.',
  '공격받는 동료를 회복하고 집중 공격. 기본 공격의 낮은 HP 표적 선택을 고려.')]
outlines=[]
for slug,name,lo,hi,skill,start,interval,summary,response in normal:
    outlines.append(dict(slug=slug,enemyId=IDS['enemies'][slug],name=name,role='normal',recommendedLevel=[lo,hi],
       authoredInPilot=slug in [p[0] for p in PILOT],skillIds=[IDS['enemySkills'][skill]] if skill else [],
       plannedCondition=turn(start,interval) if skill else {'kind':'always'},
       priority=next((p[4] for p in PILOT if p[0]==slug),80) if skill else 1,
       behaviour=summary,playerResponse=response))
bosses=[
 dict(slug='bronze-dokkaebi',name='청동도깨비',recommendedLevel=[5,8],authoredInPilot=True,
      skillIds=[IDS['enemySkills']['bronze-smash']],hpThreshold=40,
      phases=[{'hp':'40% 초과','effect':'2+4n에서 전체 내려치기 준비; 그 외 기본 공격.'},
              {'hp':'0~40%','effect':'HP 조건 행동이 주기 외에도 내려치기를 선택하므로 준비/발동 반복. 모으기 1은 유지.'}],
      playerResponse='전체 예고를 보면 모두 방어하거나 부상자를 먼저 회복. HP 40%를 넘기기 전 회복을 마친다. 주술사/도적은 예고 중 마무리 피해.'),
 dict(slug='bride-wraith',name='혼례 원귀',recommendedLevel=[11,14],authoredInPilot=False,
      skillIds=[IDS['enemySkills']['sorrow-cry'],IDS['enemySkills']['drowning-hand']],hpThreshold=50,
      phases=[{'hp':'50% 초과','effect':'곡성 2+4n; 기본 공격은 항상 후보.'},
              {'hp':'0~50%','effect':'HP 단독 조건의 drowning-hand 우선순위 95를 추가하여 다른 기술을 더 자주 선택. charge/scope는 실제 기술 계약 후 고정.'}],
      playerResponse='곡성 피해와 손아귀 피해 대상을 먼저 치료. 예고 없이 광역 공격한다고 쓰지 않는다.'),
 dict(slug='mountain-tiger',name='산군',recommendedLevel=[17,20],authoredInPilot=False,
      skillIds=[IDS['enemySkills']['poison-bite']],hpThreshold=35,
      phases=[{'hp':'35% 초과','effect':'기본 공격만.'},
              {'hp':'0~35%','effect':'HP 단독 조건의 poison-bite 우선순위 95를 추가. 영물의 독 송곳니라는 창작 설정; 기술은 들쥐와 공유.'}],
      playerResponse='상태 부여가 실제 있으면 정화와 해독약을 준비. 독 제거 여부가 검증되기 전 설명은 피해 기술로 한정.',
      limitation='고정 ID에 산군 전용 포효/발톱이 없다. 기존 기술 슬롯 공유는 감독자 검토 대상이며 새 ID를 발명하지 않는다.')]
for b in bosses:b.update(enemyId=IDS['enemies'][b['slug']],role='boss')
outlines.extend(bosses)
pilotDesign=[]
for (slug,skill,start,interval,priority),row in zip(PILOT,rows):
    record=next(x for x in outlines if x['slug']==slug)
    pilotDesign.append(dict(enemyId=row['enemyId'],name=record['name'],skillId=IDS['enemySkills'][skill],
        conditions=row['actions'],cycle={'basis':'combatConditionMet에 전달되는 전투 차례 turn+1','start':start,'interval':interval,
        'release':'chargeTurns=1이면 준비 다음 자기 차례에 발동; 발동 시 행동 조건을 재평가하지 않음'},
        hpChange=record.get('phases',[]),playerResponse=record['playerResponse'],
        reactionPolicy='없음. reactions의 차례 밖 반격은 chargeTurns를 우회하므로 예고 기술을 연결하지 않는다.'))
save('design.json',dict(packId=IDS['packId'],phase='pilot',battleModel='rm2k3',battleUiStyle='retro2003',
    coverage={'authored':4,'plannedNormals':12,'plannedBosses':3},
    engineContract={
      'conditions':'always/turn/hp/mp/status/allies/switch 중 행동당 하나. 복합 and 없음.',
      'priority':'1~100. 선택 점수는 priority*10+효용. 확률이나 절대 우선권 아님. HP 낮은 표적 마무리 효용 +1000 때문에 주기 기술이 밀릴 수 있음.',
      'basicAttack':'skillId 빈 문자열은 현재 엔진의 실제 기본 공격; skillIds에서 제외.',
      'turns':'strict는 전투 라운드, gauge는 전투 사이클. 개별 적 행동 횟수가 아니며 충전/민첩/행동불가로 실제 발동 간격은 달라진다.',
      'ranges':'HP 조건은 실수 백분율의 양끝 포함. 40.01%는 낮은 HP 조건 밖; 40%는 안.',
      'warning':'실제 SkillRecord.chargeTurns와 charging 스냅숏/charge 타임라인. 행동표 자체에 예고 필드나 가짜 단계명이 없음.',
      'targeting':'기본 공격과 단일 기술은 피해 효용으로 살아 있는 표적 선택. 예고 문장은 표적 id를 보여주지 않으므로 특정 한 명만 방어하라고 약속하지 않음.',
      'response':'방어는 피해를 절반으로 줄임. 예고가 파티 전원의 조작 차례를 보장하지 않음(gauge 민첩 순서). 치명적 상태로 행동불가면 발동 차례가 밀릴 수 있으나 자동 취소로 설명하지 않음.',
      'fallback':'기술 누락/기력 부족/봉인/쿨다운이면 기본 공격 후보. 이미 준비한 기술의 발동도 실제 엔진 사용가능 검사에 따른다.',
      'hpPhase':'청동은 새 능력치/면역/변신 없음. HP 조건으로 전체 기술을 더 자주 선택하는 실제 행동 변화만.',
    },pilot=pilotDesign,rosterOutline=outlines,skillRequirements=requirements,
    limitations=[
      'skills 담당의 실제 4기술은 이 체크아웃에 없음. 스모크의 기술은 위 requirements로 만든 메모리 fixture이며 실제 통합 검증이 아님.',
      '몬스터 stats/최종 포즈/직업/아이템/기술 밸런스는 다른 담당 소유. 통합 후 감독자가 실제 레코드로 재검증해야 함.',
      '예고 준비/발동 기록과 방어 감소는 실제 엔진으로 검사; PNG는 행동 검토판이며 출하 게임 화면이 아님.',
      '일반 9종과 보스 2종은 설계 윤곽만. 파일럿 네 종 이후 작업은 후속 지시를 기다림.',
      'live SQLite, Supabase, public registry에는 쓰지 않았음. ready는 파일럿 산출물 준비이며 사용자 승인/정본 게임 저장/배포 완료가 아님.'
    ]))
print('authored: 4 enemyActions, 12 normal + 3 boss outlines; data/design saved')
