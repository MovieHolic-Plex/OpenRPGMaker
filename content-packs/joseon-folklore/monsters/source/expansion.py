#!/usr/bin/env python3
"""Wave 2 native database records; independent of the original fifteen enemies."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
IDS = json.loads((ROOT.parent / 'ids.json').read_text())
ROWS = [
    ('venom-toad', '독두꺼비', 2, [85, 9, 12, 8, 12, 11], [18, 8, 30], 'ghost-ash', 'poison-spit', 1, 3),
    ('mortar-rabbit', '방아토끼', 3, [98, 9, 15, 7, 8, 18], [24, 10, 35], 'straw-knot', 'pestle-strike', 1, 3),
    ('jangseung-spirit', '장승귀', 5, [180, 12, 22, 20, 16, 8], [48, 19, 40], 'stone-core', 'guardian-quake', 1, 4),
    ('earthen-jar-fiend', '옹기귀', 4, [130, 12, 17, 16, 12, 9], [32, 13, 35], 'broken-jade', 'lid-guard', 1, 4),
]


def action(skill_id='', start=None, interval=None):
    return dict(skillId=skill_id, priority=80 if skill_id else 1,
                condition=dict(kind='turn', start=start, interval=interval) if skill_id else dict(kind='always'),
                switchOnAfterAction=dict(enabled=False), switchOffAfterAction=dict(enabled=False))


def skill(slug, name, scope, power, cost, choreography, description, statistic=None, state=None, chance=100):
    record = dict(id=IDS['enemySkills'][slug], name=name, description=description, scope=scope, power=power,
                  type='normal', mpCost=dict(flat=cost, percentMax=0), successRate=100, variance=0,
                  hitRate=100, criticalRate=0, retroChoreographyId=choreography,
                  effect=dict(kind='damage', statistic=statistic, affects='hp') if statistic else dict(kind='support'))
    if statistic:
        record['elementId'] = IDS['elements']['spirit' if statistic == 'mind' else 'physical']
    if state:
        record['stateEffects'] = [dict(stateId=state, chance=chance, operation='add')]
    return record


def main():
    enemies, troops = [], []
    for slug, name, level, stats, reward, drop, skill_slug, start, interval in ROWS:
        enemy = dict(id=IDS['enemies'][slug], name=name, level=level,
                     monsterResourceId=f'jf-enemy-{slug}', graphicHue=0, transparent=False, flying=False,
                     criticalHit=dict(enabled=False, oneIn=30), attackOptions=dict(normalAttacksMiss=False),
                     stats=dict(zip(['maxHp', 'maxMp', 'attack', 'defense', 'mind', 'agility'], stats)),
                     rewards=dict(exp=reward[0], gold=reward[1], dropItemId=IDS['materials'][drop], dropRatePercent=reward[2]),
                     actions=[action(), action(IDS['enemySkills'][skill_slug], start, interval)],
                     skillIds=[IDS['enemySkills'][skill_slug]], stateRates={'state_death': 'C'}, elementRates={})
        enemies.append(enemy)
        troops.append(dict(id='troop_jf_' + slug.replace('-', '_'), name=name+' · 단독',
                           enemyIds=[enemy['id']], members=[dict(enemyId=enemy['id'], x=88, y=140, hidden=False)],
                           autoAlign=True, uncapturable=True, previewBackgroundResourceId='battle-scenery-forest',
                           battleEventPages=[]))
    skills = [
        skill('poison-spit', '독침뱉기', 'enemy', 14, 3, 'chor_jf_poison_spit',
              '기력 3. 상대 하나 정신 피해14, 독45%. 제자리에서 볼을 부풀려 독을 뱉는다.', 'mind', 'state_poison', 45),
        skill('pestle-strike', '공이찍기', 'enemy', 20, 3, 'chor_jf_pestle_strike',
              '기력 3. 상대 하나 물리 피해20. 뛰어들어 방아 공이를 내려친 뒤 돌아온다.', 'attack'),
        skill('guardian-quake', '장승울림', 'allEnemies', 18, 4, 'chor_jf_guardian_quake',
              '기력 4. 상대 전체 물리 피해18. 뿌리 발로 땅을 내려찍어 균열을 보낸다.', 'attack'),
        skill('lid-guard', '뚜껑닫기', 'self', 0, 4, 'chor_jf_lid_guard',
              '기력 4. 자기 쇠숨100%: 물리 방어 계산1.6배, 세 번째 자기 차례에 해제. 뚜껑을 닫고 버틴다.',
              state=IDS['states']['iron-breath']),
    ]
    choreographies = [
        dict(id='chor_jf_poison_spit', name='독침뱉기 · 독물 포물선', description='제자리 사격과 실제 표적의 독물 타격.',
             sourceId='skill_mon_acid_spit', motion='shoot', weight='light', tint='poison',
             layers=[dict(sheet='mon_acid_blob', anchor='projectile'), dict(sheet='mon_acid_splash', anchor='target')]),
        dict(id='chor_jf_pestle_strike', name='공이찍기 · 도약 강타', description='준비 → 도약 접근 → 공이 강타 → 복귀.',
             sourceId='skill_mon_body_slam', motion='lunge', weight='normal', screen=dict(shake=1),
             movement=dict(pattern='jump', anticipationMs=280, travelMs=350, recoveryMs=420, jumpHeight=36),
             layers=[dict(sheet='mon_slam_hit', anchor='target', scale=0.7)]),
        dict(id='chor_jf_guardian_quake', name='장승울림 · 뿌리 강타', description='뿌리 발의 강타가 실제 파티 전체에 전달된다.',
             sourceId='skill_mon_quake_stomp', motion='stomp', weight='heavy', screen=dict(shake=3),
             layers=[dict(sheet='mon_quake_crack', anchor='allTargets', scale=0.8)]),
        dict(id='chor_jf_lid_guard', name='뚜껑닫기 · 옹기 방어', description='제자리 자기 방어. 피해 효과나 돌진은 없다.',
             sourceId='skill_mon_shell_guard', motion='buff', weight='light',
             layers=[dict(sheet='mon_shell_barrier', anchor='user', scale=0.8)]),
    ]
    data = dict(enemies=enemies, troops=troops, skills=skills, skillChoreographies=choreographies)
    (ROOT/'expansion.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(dict(enemies=len(enemies), skills=len(skills), choreographies=len(choreographies))))


if __name__ == '__main__':
    main()
