#!/usr/bin/env python3
"""Reproduce pilot database inputs and design notes; never connects to a DB."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
IDS = json.loads((ROOT.parent/'ids.json').read_text())

# maxHp/maxMp/attack/defense/mind/agility, exp/gold/drop chance.
PILOT = [
    ('wild-boar', '산멧돼지', 2, [110,0,14,10,8,12], [22,9,35], 'boar-tusk'),
    ('straw-dokkaebi', '볏짚 도깨비', 3, [140,0,18,12,10,10], [35,13,45], 'straw-knot'),
    ('maiden-ghost', '처녀귀신', 5, [145,20,17,8,23,16], [42,17,40], 'ghost-ash'),
    ('bronze-dokkaebi', '청동 도깨비', 6, [680,24,25,18,14,10], [210,120,100], 'bronze-shard'),
]

# General12, boss3. Only the four PILOT entries have artwork/database records.
ROSTER = [
    ('field-rat','들쥐','normal',[1,2],'논둑','rat-tail','낮은 쥐 몸통과 길게 휜 꼬리'),
    ('wild-boar','산멧돼지','normal',[2,4],'산기슭','boar-tusk','등의 강모·굽·위로 휘는 두 엄니'),
    ('cave-bat','굴박쥐','normal',[2,5],'산굴','bat-wing','날개막과 접힌 발·큰 귀'),
    ('straw-dokkaebi','볏짚 도깨비','normal',[3,6],'폐방앗간','straw-knot','볏짚 망토·새끼줄 매듭·갈래뿔·나무 방망이'),
    ('lantern-wisp','등불 혼령','normal',[4,7],'버려진 장터','ghost-ash','종이 등롱 안 불빛과 분리된 불꼬리'),
    ('maiden-ghost','처녀귀신','normal',[5,8],'옛 마을 폐허','ghost-ash','풀어진 가르마 머리·흰 저고리·고름·넓은 치마'),
    ('drowned-ghost','물귀신','normal',[7,10],'나루 아래','broken-jade','젖은 조선 포와 상투·늘어진 젖은 소매'),
    ('grave-ghoul','무덤 아귀','normal',[8,12],'고분 언덕','ghost-ash','해진 조선 포·굽은 등·흙 묻은 손'),
    ('fox-spirit','여우 혼령','normal',[9,13],'달맞이 숲','fox-fur','여우 주둥이와 여러 갈래 꼬리·동물 몸'),
    ('stone-dokkaebi','돌 도깨비','normal',[10,15],'채석터','stone-core','돌 몸·깨진 외뿔·돌 방망이'),
    ('bamboo-specter','대숲 요괴','normal',[12,17],'대숲 산길','bamboo-heart','대나무 마디·잎·휘어지는 가지 팔'),
    ('masked-bandit','탈 쓴 산적','normal',[14,18],'산성 길목','rusted-token','조선 바지저고리·탈·짧은 환도'),
    ('bronze-dokkaebi','청동 도깨비','boss',[5,7],'청동 종각','bronze-shard','큰 뿔·금속 엄니·구름무늬 배·붉은 허리천·청동 방망이'),
    ('bride-wraith','원혼 신부','boss',[11,14],'폐가 혼례방','broken-jade','족두리·원삼·긴 혼례 소매·비녀'),
    ('mountain-tiger','산군 호랑이','boss',[18,20],'산 정상 사당','tiger-claw','굵은 호랑이 몸통·줄무늬·갈기·큰 앞발'),
]


def save(name, value):
    (ROOT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def main():
    enemies=[];troops=[]
    for slug,name,level,stats,reward,drop in PILOT:
        enemy=dict(id=IDS['enemies'][slug],name=name,level=level,monsterResourceId=f'jf-enemy-{slug}',
            graphicHue=0,transparent=False,flying=slug=='maiden-ghost',
            criticalHit=dict(enabled=False,oneIn=30),attackOptions=dict(normalAttacksMiss=False),
            skillIds=['skill_attack'],stats=dict(zip(['maxHp','maxMp','attack','defense','mind','agility'],stats)),
            rewards=dict(exp=reward[0],gold=reward[1],dropItemId=IDS['materials'][drop],dropRatePercent=reward[2]),
            actions=[dict(skillId='skill_attack',priority=50,condition=dict(kind='always'),
                          switchOnAfterAction=dict(enabled=False),switchOffAfterAction=dict(enabled=False))],
            stateRates={'state_death':'C'},elementRates={})
        enemies.append(enemy)
        troops.append(dict(id='troop_jf_'+slug.replace('-','_'),name=name+' · 단독',
            enemyIds=[enemy['id']],members=[dict(enemyId=enemy['id'],x=88,y=140,hidden=False)],
            autoAlign=True,uncapturable=True,previewBackgroundResourceId='battle-scenery-forest',battleEventPages=[]))
    save('data.json',dict(enemies=enemies,troops=troops))
    pilot_by_slug={p[0]:p for p in PILOT}
    future_skills={'wild-boar':'tusk-charge','straw-dokkaebi':'straw-club','maiden-ghost':'sorrow-cry','bronze-dokkaebi':'bronze-smash'}
    lore={
        'wild-boar':'버려진 밭을 뒤지던 산짐승. 독이나 주술 없이 엄니로 위협한다.',
        'straw-dokkaebi':'추수 뒤 남은 볏짚과 새끼줄에 장난스러운 기운이 붙었다. 몸이 곡식 묶음인 창작 도깨비.',
        'maiden-ghost':'마을을 떠나지 못하는 이름 없는 원혼. 흰 저고리와 치마를 입고 풀어진 머리를 드리운 창작 귀신.',
        'bronze-dokkaebi':'종각의 오래된 청동에 붙은 수호 도깨비. 뿔·방망이·붉은 천과 금속 구름무늬가 큰 실루엣을 이룬다.',
    }
    records=[]
    for slug,name,kind,levels,region,drop,art in ROSTER:
        r=dict(id=IDS['enemies'][slug],slug=slug,name=name,kind=kind,recommendedPartyLevels=levels,
               region=region,dropMaterialId=IDS['materials'][drop],artDirection=art,
               implementation='pilot' if slug in pilot_by_slug else 'planned-only')
        if slug in pilot_by_slug:
            p=pilot_by_slug[slug]
            r.update(authoredEnemyLevel=p[2],description=lore[slug],
                acquisition=dict(kind='battle-victory-drop',ratePercent=p[4][2],quantity=1),
                currentBehavior='skill_attack only: damage/attack/hp; no special debuffs, counters or charge mechanics',
                plannedBehaviorSkillId=IDS['enemySkills'][future_skills[slug]],
                behaviorOwner='behavior worker replaces actions; skills worker defines reserved skill',
                cell=96 if kind=='boss' else 64,
                sheetSource=f'assets/{slug}.png',portraitSource=f'assets/portraits/{slug}.png',
                poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'])
        records.append(r)
    save('design.json',dict(packId='joseon-folklore',phase='pilot',engine='rm2k3 / retro2003',
        scope=dict(targetGeneral=12,targetBosses=3,implementedGeneral=3,implementedBosses=1),
        records=records,
        balance=dict(status='provisional; no integrated party battle measured',
                     initialEnemyHpRange=[110,145],earlyBossHp=680,
                     bossOrder=['bronze-dokkaebi','bride-wraith','mountain-tiger'],
                     bossPartyLevelBands=[[5,7],[11,14],[18,20]],
                     safetyIntent='single-target basic fallback only; no scripted party wipe or unavoidable one-hit attack',
                     limitations='Damage/TTK depends on final class growth, equipment, skills and behavior; supervisor must verify after integration.'),
        drops=dict(implementation='legacy single dropItemId/dropRatePercent; one unit; bronze guaranteed',
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
                    evidence='review/VISUAL-REVIEW.md; exact PNG hashes in review/art-manifest.json')))
    print(json.dumps(dict(enemies=len(enemies),troops=len(troops),plannedRoster=len(records)),ensure_ascii=False))


if __name__=='__main__':main()
