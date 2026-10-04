#!/usr/bin/env python3
"""Reproduce full15 database inputs and design notes; never connects to a DB."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
IDS = json.loads((ROOT.parent/'ids.json').read_text())

# maxHp/maxMp/attack/defense/mind/agility, exp/gold/drop chance.
FULL = [
    ('field-rat', '들쥐', 1, [65,0,12,6,6,14], [10,5,35], 'rat-tail'),
    ('wild-boar', '산멧돼지', 2, [110,0,14,10,8,12], [22,9,35], 'boar-tusk'),
    ('straw-dokkaebi', '볏짚 도깨비', 3, [140,0,18,12,10,10], [35,13,45], 'straw-knot'),
    ('maiden-ghost', '처녀귀신', 5, [145,20,17,8,23,16], [42,17,40], 'ghost-ash'),
    ('cave-bat', '굴박쥐', 2, [85,0,14,7,10,20], [18,8,35], 'bat-wing'),
    ('lantern-wisp', '도깨비불', 4, [125,20,20,8,24,15], [32,12,40], 'ghost-ash'),
    ('drowned-ghost', '물귀신', 8, [220,28,34,16,32,17], [75,25,40], 'broken-jade'),
    ('grave-ghoul', '묘지귀물', 10, [280,12,40,24,16,12], [95,32,40], 'ghost-ash'),
    ('fox-spirit', '여우요괴 · 희귀', 12, [360,42,45,22,40,32], [150,55,55], 'fox-fur'),
    ('stone-dokkaebi', '돌 도깨비 · 강적', 13, [480,20,54,36,18,16], [185,65,60], 'stone-core'),
    ('bamboo-specter', '대숲귀물', 15, [420,38,50,28,42,24], [165,50,50], 'bamboo-heart'),
    ('masked-bandit', '복면산적', 17, [510,24,62,32,26,36], [210,75,45], 'rusted-token'),
    ('bronze-dokkaebi', '청동 도깨비', 6, [680,24,46,18,14,14], [210,120,100], 'bronze-shard'),
    ('bride-wraith', '신부 원귀', 12, [1400,80,86,26,42,24], [650,350,100], 'broken-jade'),
    ('mountain-tiger', '산군 호랑이', 19, [2600,48,120,40,36,38], [1400,800,100], 'tiger-claw'),
]

# General12, boss3. Every row now has its own native artwork/database records.
ROSTER = [
    ('field-rat','들쥐','normal',[1,2],'논둑','rat-tail','낮은 쥐 몸통과 길게 휜 꼬리'),
    ('wild-boar','산멧돼지','normal',[2,4],'산기슭','boar-tusk','등의 강모·굽·위로 휘는 두 엄니'),
    ('cave-bat','굴박쥐','normal',[2,5],'산굴','bat-wing','날개막과 접힌 발·큰 귀'),
    ('straw-dokkaebi','볏짚 도깨비','normal',[3,6],'폐방앗간','straw-knot','볏짚 망토·새끼줄 매듭·갈래뿔·나무 방망이'),
    ('lantern-wisp','도깨비불','normal',[4,7],'버려진 장터','ghost-ash','푸른 불꽃·옆으로 튀어나온 불 얼굴·분리된 불티'),
    ('maiden-ghost','처녀귀신','normal',[5,8],'옛 마을 폐허','ghost-ash','풀어진 가르마 머리·흰 저고리·고름·넓은 치마'),
    ('drowned-ghost','물귀신','normal',[7,10],'나루 아래','broken-jade','젖은 조선 포와 상투·늘어진 젖은 소매'),
    ('grave-ghoul','묘지귀물','normal',[8,12],'고분 언덕','ghost-ash','해진 조선 포·굽은 등·긴 손톱'),
    ('fox-spirit','여우요괴 · 희귀','normal',[10,14],'달맞이 숲','fox-fur','여우 주둥이·서로 다른 세 꼬리·옥 목장식'),
    ('stone-dokkaebi','돌 도깨비 · 강적','normal',[10,15],'채석터','stone-core','돌 몸·깨진 외뿔·돌 방망이'),
    ('bamboo-specter','대숲귀물','normal',[12,17],'대숲 산길','bamboo-heart','대나무 마디·잎 관·뿌리 발·휘어지는 가지 팔'),
    ('masked-bandit','복면산적','normal',[14,18],'산성 길목','rusted-token','조선 바지저고리·머리띠·복면·환도와 칼집'),
    ('bronze-dokkaebi','청동 도깨비','boss',[5,7],'청동 종각','bronze-shard','큰 뿔·금속 엄니·구름무늬 배·붉은 허리천·청동 방망이'),
    ('bride-wraith','신부 원귀','boss',[11,14],'폐가 혼례방','broken-jade','족두리·녹색 원삼·붉은 치마·긴 혼례 소매·옥 비녀'),
    ('mountain-tiger','산군 호랑이','boss',[18,20],'산 정상 사당','tiger-claw','굵은 호랑이 몸통·줄무늬·갈기·큰 앞발'),
]


def save(name, value):
    (ROOT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def main():
    enemies=[];troops=[]
    full_by_slug={p[0]:p for p in FULL}
    cave={'cave-bat','grave-ghoul','stone-dokkaebi','bronze-dokkaebi'}
    flying={'cave-bat','lantern-wisp','maiden-ghost','drowned-ghost','bride-wraith'}
    for entry in ROSTER:
        slug,name,level,stats,reward,drop=full_by_slug[entry[0]]
        enemy=dict(id=IDS['enemies'][slug],name=name,level=level,monsterResourceId=f'jf-enemy-{slug}',
            graphicHue=0,transparent=False,flying=slug in flying,
            criticalHit=dict(enabled=False,oneIn=30),attackOptions=dict(normalAttacksMiss=False),
            skillIds=['skill_attack'],stats=dict(zip(['maxHp','maxMp','attack','defense','mind','agility'],stats)),
            rewards=dict(exp=reward[0],gold=reward[1],dropItemId=IDS['materials'][drop],dropRatePercent=reward[2]),
            actions=[dict(skillId='skill_attack',priority=50,condition=dict(kind='always'),
                          switchOnAfterAction=dict(enabled=False),switchOffAfterAction=dict(enabled=False))],
            stateRates={'state_death':'C'},elementRates={})
        enemies.append(enemy)
        troops.append(dict(id='troop_jf_'+slug.replace('-','_'),name=name+' · 단독',
            enemyIds=[enemy['id']],members=[dict(enemyId=enemy['id'],x=88,y=140,hidden=False)],
            autoAlign=True,uncapturable=True,previewBackgroundResourceId='battle-scenery-'+('cave' if slug in cave else 'forest'),battleEventPages=[]))
    save('data.json',dict(enemies=enemies,troops=troops))
    full_by_slug={p[0]:p for p in FULL}
    future_skills={'field-rat':'poison-bite','wild-boar':'tusk-charge','cave-bat':'wing-flurry',
                  'straw-dokkaebi':'straw-club','lantern-wisp':'ghost-fire','maiden-ghost':'sorrow-cry',
                  'drowned-ghost':'drowning-hand','grave-ghoul':'grave-grasp','fox-spirit':'fox-charm',
                  'stone-dokkaebi':'stone-crush','bamboo-specter':'bamboo-whip','bronze-dokkaebi':'bronze-smash'}
    lore={
        'wild-boar':'버려진 밭을 뒤지던 산짐승. 독이나 주술 없이 엄니로 위협한다.',
        'straw-dokkaebi':'추수 뒤 남은 볏짚과 새끼줄에 장난스러운 기운이 붙었다. 몸이 곡식 묶음인 창작 도깨비.',
        'maiden-ghost':'마을을 떠나지 못하는 이름 없는 원혼. 흰 저고리와 치마를 입고 풀어진 머리를 드리운 창작 귀신.',
        'bronze-dokkaebi':'종각의 오래된 청동에 붙은 수호 도깨비. 뿔·방망이·붉은 천과 금속 구름무늬가 큰 실루엣을 이룬다.',
        'field-rat':'논둑 곡식을 훔치는 작은 들쥐. 휜 꼬리와 분홍 귀를 가진 보통 산짐승.',
        'cave-bat':'산굴의 날개막 짐승. 한쪽 날개를 크게 펼치고 아군 쪽으로 급강하한다.',
        'lantern-wisp':'장터에 남은 푸른 도깨비불. 종이 등롱 몸체 없이 불꽃과 불티만으로 드러나는 창작 귀물.',
        'drowned-ghost':'나루를 떠나지 못하는 상투 튼 원혼. 젖은 포와 맨발·해초·늘어진 소매로 드러난다.',
        'grave-ghoul':'고분의 흙을 뒤집어쓴 굽은 귀물. 해진 포와 긴 손톱으로 땅을 긁는다.',
        'fox-spirit':'세 갈래 꼬리가 부채처럼 펼쳐지는 여우요괴. 달맞이 숲의 희귀 강적이며 옥 목장식을 찼다.',
        'stone-dokkaebi':'채석터의 깨진 외뿔 도깨비. 바위 팔과 돌 방망이를 든 희귀 강적. 사람 얼굴 같은 돌 가면을 지녔다.',
        'bamboo-specter':'대나무 마디가 몸을 이루는 귀물. 뿌리로 걷고 잎 달린 가지 팔을 휘두른다.',
        'masked-bandit':'바지저고리와 복면을 갖춘 산성의 산적. 짧은 환도와 칼집으로 몸을 지킨다.',
        'bride-wraith':'족두리와 녹색 원삼·붉은 치마를 입은 신부 원귀. 긴 소매와 옥 비녀가 고유한 실루엣을 이룬다.',
        'mountain-tiger':'정상 사당을 지키는 산군 호랑이. 굵은 줄무늬·흰 갈기·큰 발과 엄니를 가진 후반 우두머리.',
    }
    records=[]
    for slug,name,kind,levels,region,drop,art in ROSTER:
        r=dict(id=IDS['enemies'][slug],slug=slug,name=name,kind=kind,recommendedPartyLevels=levels,
               region=region,dropMaterialId=IDS['materials'][drop],artDirection=art,
               implementation='full',rarity='rare-elite' if slug in ['fox-spirit','stone-dokkaebi'] else 'unique-boss' if kind=='boss' else 'common',
               encounterGuidance='단독 고유 보스, 반복 잔무리에 섞지 않음' if kind=='boss' else '희귀 강적 단독 또는 선택 전투; 낮은 레벨 잔무리에 섞지 않음' if slug in ['fox-spirit','stone-dokkaebi'] else '해당 권장 레벨 지역의 일반 조우')
        if slug in full_by_slug:
            p=full_by_slug[slug]
            r.update(authoredEnemyLevel=p[2],description=lore[slug],
                acquisition=dict(kind='battle-victory-drop',ratePercent=p[4][2],quantity=1),
                currentBehavior='skill_attack only: damage/attack/hp; no special debuffs, counters or charge mechanics',
                plannedBehaviorSkillId=IDS['enemySkills'][future_skills[slug]] if slug in future_skills else None,
                behaviorOwner='behavior worker replaces actions; skills worker defines reserved skill',
                cell=96 if kind=='boss' else 64,
                sheetSource=f'assets/{slug}.png',portraitSource=f'assets/portraits/{slug}.png',
                poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'])
        records.append(r)
    save('design.json',dict(packId='joseon-folklore',phase='full',engine='rm2k3 / retro2003',
        scope=dict(targetGeneral=12,targetBosses=3,implementedGeneral=12,implementedBosses=3),
        records=records,
        balance=dict(status='actual rm2k3 damage probe against captured 1–20 class/equipment curves; integrated battle still pending',
                     initialEnemyHpRange=[65,145],earlyBossHp=680,bossHp=[680,1400,2600],
                     bossOrder=['bronze-dokkaebi','bride-wraith','mountain-tiger'],
                     bossPartyLevelBands=[[5,7],[11,14],[18,20]],
                     safetyIntent='single-target basic fallback only; no scripted party wipe or unavoidable one-hit attack',
                     limitations='Damage/TTK depends on final class growth, equipment, skills and behavior; supervisor must verify after integration.'),
        drops=dict(implementation='legacy single dropItemId/dropRatePercent; one unit; all3 bosses guaranteed',
                   materialDefinitionsOwner='consumables worker; references are reserved in ids.json'),
        troopIdPolicy='ids.json reserves no troop IDs; deterministic troop_jf_<enemy slug with underscores>',
        resourceDelivery=dict(staging='all files in this monsters folder only',
                              publicCopyOwner='supervisor',registrationOwner='supervisor',
                              runtimeRegistered=False,canonicalProjectWritten=False),
        provenance=dict(author='GPT 6.1 sol high monsters worker',
                        method='Original native-coordinate Python/Pillow code dots',
                        importedArtwork=False,imageGenerationAPI=False,
                        inspiration='original fantasy interpretations of broadly known Joseon clothing and folklore motifs; no historical reconstruction or commercial game tracing'),
        review=dict(authorViewedAllNativeSheets=True,userApproval=False,
                    pilotUserViewed=True,fullUserApproval=False,
                    evidence='review/VISUAL-REVIEW.md; exact PNG hashes in review/art-manifest.json')))
    print(json.dumps(dict(enemies=len(enemies),troops=len(troops),implementedRoster=len(records)),ensure_ascii=False))


if __name__=='__main__':main()
