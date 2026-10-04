#!/usr/bin/env python3
"""Rebuild this role's complete 36 records, design and art; ready remains false."""
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


UPGRADES = {
    'warrior': {
        'weapon': [('장정 환도',200,(14,0,0,0),0),('은장 환도',460,(21,0,0,0),0),('청옥 환도',900,(29,0,0,0),0)],
        'body': [('덧배자 철릭',170,(0,10,0,0),0),('겹누비 철릭',390,(0,15,0,0),0),('청띠 사냥철릭',740,(0,21,0,0),0)],
    },
    'rogue': {
        'weapon': [('쇠날 단검',180,(10,0,0,4),3),('청동장식 단검',410,(16,0,0,6),4),('청옥 호신단검',820,(23,0,0,8),5)],
        'body': [('먹빛 배자옷',160,(0,6,0,4),0),('밤길 겹포',350,(0,10,0,6),0),('청띠 행려포',680,(0,14,0,8),0)],
    },
    'shaman': {
        'weapon': [('오색끈 칠성방울',220,(3,0,12,0),0),('은빛 칠성방울',480,(4,0,18,0),0),('청옥자루 칠성방울',940,(5,0,25,0),0)],
        'body': [('오색띠 무복',180,(0,5,5,0),0),('흰소매 홍무복',380,(0,8,8,0),0),('청옥띠 홍무복',720,(0,12,11,0),0)],
    },
    'taoist': {
        'weapon': [('산수 접부채',200,(3,0,11,0),0),('구름 접부채',450,(4,0,17,0),0),('청죽 접부채',900,(5,0,24,0),0)],
        'body': [('겹삼베 도포',170,(0,6,4,0),0),('남선 흰도포',370,(0,10,6,0),0),('청옥띠 수련도포',700,(0,14,9,0),0)],
    },
}
SHARED = [('head',1,'말총 망건',50,(0,1,0,1),1,'headwear'),
          ('head',2,'대나무 삿갓',300,(0,5,1,0),10,'headwear'),
          ('accessory',1,'매듭 향낭',160,(0,1,2,0),5,'accessories'),
          ('accessory',2,'청옥 노리개',620,(0,0,5,2),15,'accessories')]
SOURCES.extend([
    dict(id='headwear',title='망건·복식 — 한국민족문화대백과사전',
         url='https://encykorea.aks.ac.kr/Article/E0017844',
         additionalUrl='https://encykorea.aks.ac.kr/Article/E0023690',
         applied='말총 머리띠의 그물눈·끈·관자와 여행·농민복의 삿갓 형태. 정확한 신분별 제식 고증 대신 직업 공용 창작 장비로 단순화.'),
    dict(id='accessories',title='장신구·노리개 — 한국민족문화대백과사전',
         url='https://encykorea.aks.ac.kr/Article/E0048637',
         additionalUrl='https://encykorea.aks.ac.kr/Article/E0012731',
         applied='향료 주머니와 매듭·옥 몸체·술을 가진 노리개 형태. 노리개의 역사적 여성 장신구 문맥을 인정하고 게임에서는 성별·직업 공용으로 확장; 향의 약효나 주술적 효과는 구현하지 않음.'),
])
STATS_KO = ['공격력','방어력','정신력','민첩']


def stat_description(stats,crit=0):
    text=', '.join(f'{name} +{value}' for name,value in zip(STATS_KO,stats) if value)
    return text+(f', 치명타율 +{crit}%p' if crit else '')+'.'


def main():
    records, designs = [], []
    entries = [(cls,kind,1,name,price,stats,crit,desc) for cls,kind,name,price,stats,crit,desc in SAMPLES]
    for cls,categories in UPGRADES.items():
        for tier in [2,3,4]:
            for kind in ['weapon','body']:
                name,price,stats,crit=categories[kind][tier-2]
                entries.append((cls,kind,tier,name,price,stats,crit,
                                f'{name}. '+stat_description(stats,crit)))
    for kind,index,name,price,stats,level,source in SHARED:
        entries.append(('shared',kind,index,name,price,stats,0,
                        f'네 직업이 함께 쓰는 {name}. '+stat_description(stats)))
    for cls, kind, tier, name, price, stats, crit, desc in entries:
        slug = f'{cls}-{kind}-{tier}'
        equipment_id = f'equip_jf_{cls}_{kind}_{tier}'
        class_ids=[f'class_jf_{role}' for role in UPGRADES] if cls=='shared' else [f'class_jf_{cls}']
        level=[1,5,10,15][tier-1] if cls!='shared' else next(row[5] for row in SHARED if row[:2]==(kind,tier))
        record = dict(id=equipment_id,name=name,imageResourceId=f'jf-icon-{slug}',
                      iconResourceId=f'jf-icon-{slug}',slot={'weapon':'weapon','body':'armor','head':'helmet','accessory':'accessory'}[kind],
                      price=price,description=desc,
                      statBonuses=dict(zip(['attack','defense','mind','agility'],stats)),
                      equippableActorIds=[],equippableClassIds=class_ids,
                      cursed=False,twoHanded=False,accuracy=100,criticalRate=crit,
                      attackElementIds=['element_jf_physical'] if kind=='weapon' else [],
                      stateInflictIds=[],stateInflictionChance=100,
                      effectFlags={f:False for f in FLAGS},elementalDefenseIds=[],
                      stateDefenseIds=[],stateDefenseMode='resist',stateResistanceChance=0)
        records.append(record)
        if cls=='shared':
            source='headwear' if kind=='head' else 'accessories'
            shape={'shared-head-1':'말총 그물눈 머리띠와 관자·양쪽 당줄.',
                   'shared-head-2':'원추형 대나무 삿갓, 엮은 살·낮은 넓은 챙과 턱끈.',
                   'shared-accessory-1':'주머니 입구의 매듭 고리와 붉은 향낭·짧은 술.',
                   'shared-accessory-2':'옥 몸체·고리·매듭·긴 붉은 술을 가진 단작 노리개.'}[slug]
        else:
            source,shape=RATIONALE[f'{cls}-{kind}']
            if tier>1:
                details={
                    'warrior-weapon':['굽은 쇠날과 나무 자루·금빛 작은 코등이.','은빛 코등이·청색 자루·붉은 장식끈.','청옥 끝장식과 붉은 끈을 갖춘 고급 외날검.'],
                    'warrior-body':['철릭 위에 갈색 직물 덧배자.','겹여밈과 여러 줄 누비 주름.','청색 가장자리와 트인 사냥 자락·청옥 허리띠.'],
                    'rogue-weapon':['짧은 곡선 칼날과 작은 칼목.','짧은 쇠날·청색 감은 자루·청동장식.','짧은 호신 칼날과 청옥 끝장식·짧은 붉은 끈.'],
                    'rogue-body':['짧은 저고리 위에 먹빛 배자.','길어진 좁은 소매 겹포와 세로 자락.','청색 매듭과 갈라진 행려포 자락.'],
                    'shaman-weapon':['일곱 방울을 테에 연결하고 여러 색 끈을 단 자루.','일곱 은빛 방울·청옥 자루장식·삼색 끈.','일곱 금빛 방울·넓은 테·청옥 자루와 삼색 끈.'],
                    'shaman-body':['홍색 주름 자락과 오색 허리띠.','흰색 소맷단을 늘린 넓은 소매 홍무복.','교차 금빛 깃 장식과 청옥 허리띠의 홍무복.'],
                    'taoist-weapon':['접선 선면에 창작 산 능선 문양.','접선 선면에 창작 구름 문양·붉은 장식끈.','접선 선면에 창작 청죽 문양·청옥과 붉은 끈.'],
                    'taoist-body':['겹삼베의 긴 곧은 자락과 가는 청띠.','남색 깃 가장자리와 밑단을 댄 흰 도포.','소매 청색 장식·청옥 허리띠와 긴 자락.'],
                }
                shape=details[f'{cls}-{kind}'][tier-2]
        designs.append(dict(id=equipment_id,tier=tier if cls!='shared' else None,recommendedLevel=level,
                            acquisition={'method':'첫 전직 초급 한 벌 지급 제안 또는 권장 단계 지역 상점 판매',
                                         'region':{1:'초반 마을',5:'외곽 장터',10:'산길 거점',15:'후반 읍성'}[level]+' (권장 구간; 실제 맵·상점 연결 대기)',
                                         'implemented':False},
                            classIds=class_ids,sourceIds=[source],silhouette=shape,
                            balanceReason='초급 기준선을 유지하고 등급 상승마다 주 능력 +4~8, 보조 능력 +1~3 정도로 증가. 최대 검 공격+29, 주문 무기 정신+25; 특수 효과 폭증 없음. 실전 밸런스 검토 대기.',
                            engineEffects={'stats':record['statBonuses'],'accuracyPercent':100,
                                           'criticalBonusPercentagePoints':crit,
                                           'attackElementIds':record['attackElementIds'],
                                           'specialFlags':[]},
                            implementationLimits=['권장 레벨은 설계 메타데이터이며 엔진 장착 최소 레벨 제한이 아님.',
                                                  '아이콘은 메뉴·자료집 그림이다. Actor1의 전투·이동 그림을 바꾸지 않는다.']))
    save('data.json',{'equipment':records})
    save('class-links.json',{f'class_jf_{role}':{
        'actorIds':[],'classIds':[],
        'equipmentIds':[r['id'] for r in records if f'class_jf_{role}' in r['equippableClassIds']]
    } for role in UPGRADES})
    rows=['# 장비 36종 목록','',
          '생성 원본: `author.py`. 권장 레벨은 설계값이며 엔진 장착 최소레벨이 아니다. 클래스별 성장 단계는 1/5/10/15.',
          '', '| ID | 이름 | 권장 레벨 | 가격 | 능력 보정 |',
          '| --- | --- | ---: | ---: | --- |']
    for record,detail in zip(records,designs):
        rows.append(f"| {record['id']} | {record['name']} | {detail['recommendedLevel']} | {record['price']} | {stat_description(tuple(record['statBonuses'].values()),record['criticalRate'])} |")
    (ROOT/'catalog.md').write_text('\n'.join(rows)+'\n')
    save('design.json',dict(packId='joseon-folklore',role='equipment',phase='full',
                           engine='current RM2003 / retro2003',authorship='GPT 6.1 sol high; original code pixel art',
                           equipmentCount=36,preservedPilotCount=8,fullTargetCount=36,
                           expansion={'implemented':True,'remainingCount':0,'tiers':[1,5,10,15],
                                      'idPattern':'equip_jf_<warrior|rogue|shaman|taoist>_<weapon|body>_<1|2|3|4>',
                                      'sharedIds':[f'equip_jf_shared_{kind}_{index}' for kind,index,*_ in SHARED],
                                      'sharedHeadAccessoryCount':4,'requiresSupervisorFollowup':False},
                           economy={'initialGold':80,'weaponPriceRange':[70,940],'bodyPriceRange':[60,740],
                                    'starterSetsGrantRecommended':True,
                                    'note':'80금으로 무기·의복 한 벌을 동시에 살 수 없으므로 감독자가 첫 전직 때 초급 한 벌을 지급하는 구성을 권장. 지급 이벤트·상점 미구현.'},
                           permissionIntegration={'authority':'src/project/equipmentRules.ts:canEquip',
                                                  'rule':'장비의 배우/직업 허용과 클래스의 배우/직업/장비 허용은 OR로 결합된다.',
                                                  'required':'class_jf_*의 equipmentPermissions.actorIds/classIds는 포괄 허용을 비우고 equipmentIds에는 자기 직업 8개와 공유 4개만 명시한다. novice는 이 36개를 허용하지 않는다.',
                                                  'actorIdsHardcoded':False},
                           palette={'outline':'#242535','steel':['#567780','#97b6be','#edf6e8'],
                                    'gold':['#765033','#c9913c','#ffe5a2'],
                                    'clothFamilies':{'warrior':'남색·갈색 직물','rogue':'먹빛·회보라·청색 끈','shaman':'홍색·오색 띠','taoist':'백색·옅은 청록·남색 깃'},
                                    'tierOnlyRecolour':False},
                           pilotPreservation='review/pilot-baseline.json의 초급 8개 레코드와 PNG 해시를 그대로 유지.',
                           sourcePolicy='아래 자료는 형태 설명 근거만 사용. 제삼자 사진·게임 그림·아이콘 픽셀 복제 없음.',
                           sources=SOURCES,equipment=designs,
                           approval={'userApproved':False,'subjectiveVisualReview':'pending'},
                           canonicalStore={'written':False,'integrationOwner':'supervisor','reason':'사용자가 DB 쓰기를 금지한 공용 팩 산출물 작업'},
                           context={'localProjectSqliteFound':False,'browserIndexedDbAvailable':False,
                                    'prototypeDatabaseReadOnly':True,'originalUserRequest':'현재 메시지·CONTRACT.md·steering.md 기준; AI 기록 저장소는 이 워크트리에 없음'}))
    save('status.json',dict(phase='full',ready=False,counts={'equipment':36,'icons':36,'weapons':16,'bodies':16,'heads':2,'accessories':2,'fullTarget':36},
                           reviewFiles=['review/full-contact.png','review/warrior-full.png','review/rogue-full.png','review/shaman-full.png','review/taoist-full.png','review/shared-full.png','data.json','design.json','assets.json','class-links.json','catalog.md','review/smoke.json','review/visual-review.json','review/reproducibility.json','review/pilot-baseline.json','README.md','HANDOFF.md'],
                           readinessMeaning='전체 파일 인계 준비 여부. 사용자 승인·게임 통합·실전 검수 합격을 뜻하지 않음.',
                           userApproved=False,canonicalStoreWritten=False,publicAssetsRegistered=False))
    subprocess.run([sys.executable,str(ROOT/'draw.py')],check=True)
    print('Saved full 36 data/design; status.ready=false until saved-file smoke and visual review complete.')


if __name__=='__main__':
    main()
