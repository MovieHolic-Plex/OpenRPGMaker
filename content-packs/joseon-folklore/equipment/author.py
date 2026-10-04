#!/usr/bin/env python3
"""Rebuild only this role's pilot records, design and art; ready remains false."""
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def save(name, data):
    (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


# class, contract suffix, name, price, attack/defense/mind/agility, critical, description
SAMPLES = [
    ('warrior','weapon','수련 환도',80,(8,0,0,0),0,'전사의 짧은 외날 검. 공격력 +8.'),
    ('warrior','body','솜누비 철릭',70,(0,6,0,0),0,'허리에 주름 자락을 이은 전사의 누비옷. 방어력 +6.'),
    ('rogue','weapon','호신 단검',70,(5,0,0,3),2,'짧고 날렵한 도적의 호신 칼. 공격력 +5, 민첩 +3, 치명타율 +2%p.'),
    ('rogue','body','먹빛 저고리',60,(0,3,0,3),0,'좁은 소매와 짧은 자락을 갖춘 도적의 저고리. 방어력 +3, 민첩 +3.'),
    ('shaman','weapon','수습 칠성방울',90,(2,0,7,0),0,'일곱 방울을 둥근 테에 단 주술사의 무령. 공격력 +2, 정신력 +7.'),
    ('shaman','body','홍색 무복',65,(0,2,3,0),0,'교차 깃과 주름 자락에 색띠를 단 주술사의 철릭형 무복. 방어력 +2, 정신력 +3.'),
    ('taoist','weapon','백지 접부채',75,(2,0,6,0),0,'대나무 살에 종이를 붙인 도사의 수련 부채. 공격력 +2, 정신력 +6.'),
    ('taoist','body','삼베 도포',65,(0,3,2,0),0,'넓은 소매에 가는 띠를 두른 도사의 긴 도포. 방어력 +3, 정신력 +2.'),
]
FLAGS = ['preemptive','doubleAttack','attackAll','ignoreDodge','preventCriticalHits',
         'increasePhysicalDodge','halfMpCost','negateTerrainDamage','fixedEquipment']
SOURCES = [
    dict(id='hwando',title='환도(環刀) — 한국학중앙연구원 조선왕조실록사전',
         url='https://dh.aks.ac.kr/sillokwiki/index.php/환도(環刀)',
         applied='전사 검의 외날·굽은 칼날·짧은 자루 형태. 장식적인 궁중 운검을 복제하지 않음.'),
    dict(id='knife',title='한국문화사 9권 — 국사편찬위원회',
         url='https://contents.history.go.kr/data/pdf/km/km_009.pdf',
         applied='조선의 장도를 호신·장식 도구로 설명하는 자료를 바탕으로 짧은 호신 칼을 창작. 은장도 유물의 정확한 모양을 복제하지 않음; 도적 전용은 게임 설정.'),
    dict(id='bells',title='무령 — 공유마당 / 국립민속박물관 제공 소장품 설명',
         url='https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=200018&wrtSn=11994602',
         applied='자루 끝의 둥근 테와 일곱 금속 방울을 갖는 칠성방울. 원본 유물 사진 다운로드·복제 없음.'),
    dict(id='fan',title='부채 — 한국민족문화대백과사전',
         url='https://encykorea.aks.ac.kr/Article/E0024573',
         applied='대나무 살·종이 선면·접부채의 형태. 도사 직업의 기력 수련 도구는 창작이며 실제 조선 도사의 제식 장비로 주장하지 않음.'),
    dict(id='cheollik',title='철릭 — 한국민족문화대백과사전',
         url='https://encykorea.aks.ac.kr/Article/E0056124',
         applied='교차 깃, 상의·주름 치마의 허리 연결, 솜을 넣는 구성, 무관용과 붉은 무당복 사용. 32px 가독성을 위한 비율·색띠는 창작 단순화.'),
    dict(id='dopo',title='도포 — 한국민족문화대백과사전',
         url='https://encykorea.aks.ac.kr/Article/E0015901',
         applied='긴 포와 넓은 소매·가는 띠. 게임의 도사 전용 제한은 창작 설정.'),
    dict(id='mugu',title='무구 — 한국민족문화대백과사전',
         url='https://encykorea.aks.ac.kr/Article/E0018941',
         applied='방울·부채 등의 제의 도구 문맥. 영적 데미지나 자동 정화 효과는 장비에 구현하지 않음.'),
]
RATIONALE = {
    'warrior-weapon':('hwando','외날 곡선 검과 작은 둥근 코등이; 십자 가드·서양 양날검 없음.'),
    'warrior-body':('cheollik','남색 솜누비, 교차 깃, 좁은 소매, 허리 이음과 주름 치마; 금속 견갑·흉갑 없음.'),
    'rogue-weapon':('knife','짧은 칼날과 감은 자루·작은 칼목; 도적 무기라는 역할은 창작.'),
    'rogue-body':('cheollik','조선풍 교차 깃·고름을 강조한 짧은 저고리 창작. 철릭과 같은 길이의 포로 오인하지 않도록 짧게 그림; 특정 출토 저고리의 고증 재현은 아님.'),
    'shaman-weapon':('bells','둥근 테에 매달린 일곱 방울, 나무 자루와 붉은 끈; 마법 지팡이로 대체하지 않음.'),
    'shaman-body':('cheollik','붉은 철릭형 무복, 넓은 소매·교차 깃·주름 치마와 세 줄 색띠. 특정 지역 무복의 완전 재현이 아님.'),
    'taoist-weapon':('fan','펼친 백지 접부채, 방사형 대나무 살과 사북·장식끈. 제식 도교 법구라는 주장은 없음.'),
    'taoist-body':('dopo','담백한 백색 긴 도포와 넓은 소매, 가는 청색 띠. 뒤쪽 겹자락은 정면 아이콘에서 보이지 않음.'),
}


def main():
    records, designs = [], []
    for cls, kind, name, price, stats, crit, desc in SAMPLES:
        slug = f'{cls}-{kind}-1'
        equipment_id = f'equip_jf_{cls}_{kind}_1'
        record = dict(id=equipment_id,name=name,imageResourceId=f'jf-icon-{slug}',
                      iconResourceId=f'jf-icon-{slug}',slot='weapon' if kind=='weapon' else 'armor',
                      price=price,description=desc,
                      statBonuses=dict(zip(['attack','defense','mind','agility'],stats)),
                      equippableActorIds=[],equippableClassIds=[f'class_jf_{cls}'],
                      cursed=False,twoHanded=False,accuracy=100,criticalRate=crit,
                      attackElementIds=['element_jf_physical'] if kind=='weapon' else [],
                      stateInflictIds=[],stateInflictionChance=100,
                      effectFlags={f:False for f in FLAGS},elementalDefenseIds=[],
                      stateDefenseIds=[],stateDefenseMode='resist',stateResistanceChance=0)
        records.append(record)
        source,shape = RATIONALE[f'{cls}-{kind}']
        designs.append(dict(id=equipment_id,tier=1,recommendedLevel=1,
                            acquisition={'method':'초반 마을 상점 판매 또는 첫 전직 때 초급 무기·의복 지급',
                                         'region':'초반 마을 (감독자 실제 맵·상점 연결 대기)',
                                         'implemented':False},
                            classId=f'class_jf_{cls}',sourceIds=[source],silhouette=shape,
                            balanceReason='초급 기존 검(+8), 단검(+5/민첩+3), 주문 무기(정신력+7), 의복(방어+3~6)의 기준선을 참조. 실전 수치 검토 대기.',
                            engineEffects={'stats':record['statBonuses'],'accuracyPercent':100,
                                           'criticalBonusPercentagePoints':crit,
                                           'attackElementIds':record['attackElementIds'],
                                           'specialFlags':[]},
                            implementationLimits=['권장 레벨은 설계 메타데이터이며 엔진 장착 최소 레벨 제한이 아님.',
                                                  '아이콘은 메뉴·자료집 그림이다. Actor1의 전투·이동 그림을 바꾸지 않는다.']))
    save('data.json',{'equipment':records})
    save('design.json',dict(packId='joseon-folklore',role='equipment',phase='pilot',
                           engine='current RM2003 / retro2003',authorship='GPT 6.1 sol high; original code pixel art',
                           sampleCount=8,fullTargetCount=36,
                           expansion={'implemented':False,'remainingCount':28,'tiers':[1,5,10,15],
                                      'idPattern':'equip_jf_<warrior|rogue|shaman|taoist>_<weapon|body>_<1|2|3|4>',
                                      'sharedHeadAccessoryCount':4,'requiresSupervisorFollowup':True},
                           economy={'initialGold':80,'weaponPriceRange':[70,90],'bodyPriceRange':[60,70],
                                    'starterSetsGrantRecommended':True,
                                    'note':'80금으로 무기·의복 한 벌을 동시에 살 수 없으므로 감독자가 첫 전직 때 초급 한 벌을 지급하는 구성을 권장. 지급 이벤트·상점 미구현.'},
                           permissionIntegration={'authority':'src/project/equipmentRules.ts:canEquip',
                                                  'rule':'장비의 배우/직업 허용과 클래스의 배우/직업/장비 허용은 OR로 결합된다.',
                                                  'required':'class_jf_*의 equipmentPermissions.actorIds/classIds는 포괄 허용을 비우고 equipmentIds에는 자기 직업 장비만 명시한다. novice는 이 8개를 허용하지 않는다.',
                                                  'actorIdsHardcoded':False},
                           sourcePolicy='아래 자료는 형태 설명 근거만 사용. 제삼자 사진·게임 그림·아이콘 픽셀 복제 없음.',
                           sources=SOURCES,equipment=designs,
                           approval={'userApproved':False,'subjectiveVisualReview':'pending'},
                           canonicalStore={'written':False,'integrationOwner':'supervisor','reason':'사용자가 live SQLite/Supabase 쓰기를 금지한 첫 샘플 산출물 작업'},
                           context={'localProjectSqliteFound':False,'browserIndexedDbAvailable':False,
                                    'prototypeDatabaseReadOnly':True,'originalUserRequest':'현재 메시지·CONTRACT.md·steering.md 기준; AI 기록 저장소는 이 워크트리에 없음'}))
    save('status.json',dict(phase='pilot',ready=False,counts={'equipment':8,'icons':8,'fullTarget':36},
                           reviewFiles=['review/pilot-contact.png','data.json','design.json','assets.json','review/smoke.json','review/visual-review.json'],
                           readinessMeaning='첫 샘플 파일 인계 준비 여부. 사용자 승인·게임 통합·실전 검수 합격을 뜻하지 않음.',
                           userApproved=False,canonicalStoreWritten=False,publicAssetsRegistered=False))
    subprocess.run([sys.executable,str(ROOT/'draw.py')],check=True)
    print('Saved pilot data/design; status.ready=false until saved-file smoke and visual review complete.')


if __name__=='__main__':
    main()
