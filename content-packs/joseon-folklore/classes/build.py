"""Build only classes full artifacts; no project persistence, registration or status write."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
KEYS = ['maxHp', 'maxMp', 'attack', 'defense', 'mind', 'agility']
LEVELS = [1, 3, 5, 8, 12, 16]
# [L1, gain per level]. Lv21..99 repeat Lv20 to satisfy engine normalization.
BLUEPRINT = {
    'novice': ('초보', [120, 36, 30, 18, 28, 28], [14, 3, 3, 2, 3, 2], '직업 선택 전의 균형형. 기본 공격과 물품으로 익힌다.', '기술'),
    'warrior': ('전사', [148, 24, 34, 24, 18, 22], [18, 2, 4, 3, 2, 2], '체력과 방어가 높은 근접 물리 공격수. 단일 공격에서 보호 역할로 성장한다.', '무예'),
    'rogue': ('도적', [116, 28, 30, 17, 20, 36], [15, 3, 4, 2, 2, 3], '민첩이 높은 단일 물리 공격수. 낮은 방어를 독과 행동 순서로 보완한다.', '기습'),
    'shaman': ('주술사', [104, 42, 18, 14, 36, 24], [13, 5, 2, 2, 4, 2], '정신과 기력이 높은 공격 주문 사용자. 불과 냉기에서 광역과 봉인으로 성장한다.', '주술'),
    'taoist': ('도사', [124, 40, 20, 20, 32, 22], [16, 5, 2, 3, 4, 2], '치유와 정화 담당. 중간 체력과 방어로 아군 회복을 이어 간다.', '도술'),
}
EXP = {'base': 15, 'extra': 25, 'acceleration': 5}
COLORS = {'novice': '#776b53', 'warrior': '#b34f32', 'rogue': '#3b7466', 'shaman': '#685499', 'taoist': '#396f91'}

def write_json(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def starter_equipment(role):
    return [f'equip_jf_{role}_{slot}_1' for slot in ['weapon', 'body']]

def equipment_for_role(role):
    return [f'equip_jf_{role}_{slot}_{tier}' for tier in range(1, 5) for slot in ['weapon', 'body']]

def total_exp(level):
    return sum(EXP['base'] + math.floor(EXP['extra'] * (n - 1) ** 0.9) + (n - 2) * EXP['acceleration'] for n in range(2, level + 1))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prototype', type=Path, required=True, help='Read-only prototype-database.json')
    args = parser.parse_args()
    prototype = json.loads(args.prototype.read_text())
    ids = json.loads((HERE.parent / 'ids.json').read_text())
    hero = next(a for a in prototype['actors'] if a['id'] == 'actor_hero')
    assert hero['name'] == '하람'
    assert hero['characterResourceId'] == 'easyrpg-charset-actor1'
    assert hero.get('characterIndex', 0) == 0
    jobs = list(ids['classSkills'])
    classes = []
    roles = []
    for role, (name, start, gains, purpose, command_name) in BLUEPRINT.items():
        curve = {key: [start[i] + gains[i] * min(level - 1, 19) for level in range(1, 100)] for i, key in enumerate(KEYS)}
        skill_ids = ids['classSkills'].get(role, ['skill_attack'])
        learned = [{'level': level, 'skillId': skill} for level, skill in zip(LEVELS if role != 'novice' else [1], skill_ids)]
        equipment = equipment_for_role(role) if role != 'novice' else []
        classes.append({
            'id': ids['classes'][role], 'name': name,
            'options': {'dualWield': False, 'autoBattle': False, 'fixedEquipment': False, 'mightyGuard': False},
            'skillIds': skill_ids,
            'battleCommands': [
                {'id': 'cmd_attack', 'name': '공격', 'kind': 'attack'},
                {'id': 'cmd_skill', 'name': command_name, 'kind': 'skill'},
                {'id': 'cmd_defend', 'name': '방어', 'kind': 'defend'},
                {'id': 'cmd_item', 'name': '물품', 'kind': 'item'},
            ],
            'learnedSkills': learned,
            **({'promotions': [{'toClassId': ids['classes'][job], 'requires': {'level': 1}} for job in jobs]} if role == 'novice' else {}),
            'equipmentPermissions': {'actorIds': [], 'classIds': [], 'equipmentIds': equipment},
            'parameterCurves': curve, 'expCurve': EXP,
            'stateRates': {'state_death': 'C', 'state_poison': 'C'},
            'elementRates': {element: 'C' for element in ids['elements'].values()},
        })
        roles.append({
            'role': role, 'classId': ids['classes'][role], 'name': name, 'purpose': purpose,
            'levelOne': dict(zip(KEYS, start)), 'gainPerLevel': dict(zip(KEYS, gains)),
            'levelTwenty': {key: curve[key][19] for key in KEYS},
            'snapshots': [{'level': level, **{key: curve[key][level - 1] for key in KEYS}} for level in [1, 3, 5, 8, 12, 16, 20]],
            'learning': [{'level': entry['level'], 'skillId': entry['skillId'], 'definitionOwner': 'existing-engine' if role == 'novice' else 'root-skills-source'} for entry in learned],
            'starterEquipmentIds': starter_equipment(role) if role != 'novice' else [],
            'equipmentIds': equipment,
            'equipmentByTier': [] if role == 'novice' else [{'tier': tier, 'recommendedLevel': level, 'equipmentIds': [f'equip_jf_{role}_{slot}_{tier}' for slot in ['weapon', 'body']]} for tier, level in zip(range(1, 5), [1, 5, 10, 15])],
            'equipmentRecommendationLevels': [1, 5, 10, 15],
            'traits': {'dualWield': False, 'mightyGuard': False, 'reason': '직업 역할 차이는 성장곡선에서 만든다. 모든 직업 쌍수·자동전투·장비고정·강화방어 옵션은 false.'},
        })
    write_json('data.json', {'classes': classes})
    design = {
        'packId': ids['packId'], 'phase': 'full', 'engine': {'battleModel': 'rm2k3', 'skin': 'retro2003', 'mpLabel': '기력', 'resource2': False},
        'scope': '완성 5클래스. 성장 1~20, 기술24개 습득 계약, 직업별 무기/의복4등급 권한32개. 전체 기술·적·그림 원본, 배우 곡선·전직 이벤트 교체, 실제 저장은 root 소유다.',
        'roles': roles,
        'balance': {
            'curveRule': 'L1 + (min(level,20)-1) × gainPerLevel; 99개 정수 배열. Lv21~99는 Lv20 반복으로 정규화 폴백을 방지하며 게임 범위가 아니다.',
            'actorMaxLevel': 20, 'classHasMaxLevelField': False,
            'experienceCurve': EXP,
            'experienceOwnership': 'computeActorLevelUp는 class.expCurve 대신 actor.expCurve를 소비한다. 공통 EXP를 모든 배우에 복사해야 한다.',
            'experienceThresholds': [{'level': level, 'totalExp': total_exp(level)} for level in range(1, 21)],
            'prototypeHeroCurveMatchesNovice': all(hero['parameterCurves'][key][:20] == classes[0]['parameterCurves'][key][:20] for key in KEYS),
            'damageRule': 'RM2003 native: power+floor(sourceStat/2), 분산·속성·치명 적용 후 floor(target.defense/2) 차감. 마법도 defense로 차감한다. 하한은 방어 전 피해의 12.5%.',
            'healingRule': 'power+floor(mind/2), 분산 적용. 회복 power와 실제 회복량을 동일하다고 쓰지 않는다.',
            'assumptions': {'row': 'front', 'elementMultiplier': 1, 'variance': 0, 'criticalRate': 0, 'ordinaryEnemyHp': [60, 150], 'earlyBossHp': [500, 800]},
            'levelOneUnequippedBenchmark': {
                'enemy': {'attack': 30, 'defense': 12, 'normalAttackPower': 10},
                'basicAttackDamage': {c['id']: 10 + c['parameterCurves']['attack'][0] // 2 - 6 for c in classes},
                'incomingNormalAttackDamage': {c['id']: 25 - c['parameterCurves']['defense'][0] // 2 for c in classes},
                'warning': '미장비·무상성 기준 설명용 수치다. 장비·skills·monsters 팩 실제 레코드 결합 후 최종 밸런스 확인이 필요하다.',
            },
            'earlyMpCastsAtFullBar': {'warriorAtCost3to7': [3, 8], 'rogueAtCost3to7': [4, 9], 'shamanAtCost5to10': [4, 8], 'taoistAtCost5to9': [4, 8]},
            'noImplicitRoleBonuses': '민첩은 명중/회피 보너스를 자동 지급하지 않는다. 도적의 회피·독, 전사의 보호, 도사의 정화는 skills 담당 실제 효과에만 의존한다.',
            'rankRates': '예약 상태에는 직업별 내성 보너스를 발명하지 않는다. 정의되는 상태 기본 C, 다섯 계약 속성도 C로 시작한다.',
        },
        'promotionRules': {
            'sourceClassId': ids['classes']['novice'], 'requirements': {'level': 1},
            'targets': [ids['classes'][job] for job in jobs], 'advancedClasses': [],
            'cost': {'gold': 0, 'items': []}, 'additionalSwitchesOrVariables': [],
            'confirmation': '선택 직업의 역할·초반 수치를 보여 주고 확정/돌아가기. 확정 때 목적지 ID를 명시한다.',
            'commandExamples': [{'kind': 'promoteActor', 'actorId': hero['id'], 'toClassId': ids['classes'][job]} for job in jobs],
            'cancel': 'promoteActor/changeActorClass를 호출하지 않는다. 초보와 HP/MP/스킬/장비/소지품을 유지한다.',
            'implicitTargetHazard': 'toClassId를 생략하면 첫 조건 충족 경로(전사)를 선택하므로 네 선택지 모두 명시해야 한다.',
            'permanentChoice': '네 직업에 추가 promotions가 없다. 재전직/고급직업은 이 팩 범위가 아니다.',
            'vitalsOnPromotion': '레벨·경험치 유지, HP/MP 회복 없음. 새 최대치가 낮으면 현재치를 상한으로 제한한다.',
            'skillOnPromotion': '현재 레벨까지 초보의 기본 공격을 보존하고 새 직업 습득 목록을 더한다. 이전 직업의 미래 기술은 배우지 않는다.',
        },
        'jobExperience': {
            'availability': '초보 Lv1에서 네 역할 설명과 수치 비교를 무료로 볼 수 있다. 실제 NPC 체험 메뉴/전투 연결은 감독자가 저작한다.',
            'previewOnly': '체험은 원본 세션에 임시 전직하지 않는다. changeActorClass는 습득 기술을 영구 보존하므로 왕복 전직은 취소가 아니다.',
            'isolatedTrialRecipe': ['프로젝트와 세션을 깊은 복제한다.', '복제한 하람에 promoteActor(..., 명시한 target)를 1회 적용한다.', '해당 직업 초급 무기/의복을 복제 인벤토리에서 지급·장착하고 현재 HP/MP를 새 최대치로 채운다. 체험 전용 보급이다.', 'skills 첫 기술과 공격·방어·물품을 1회씩 시험한다. 도사는 다친 연두를 복제한 훈련 동료로 함께 둔다.', '체험 종료/취소 시 복제본을 버린다. 원본 진행을 저장하거나 수입하지 않는다.', '원본에 돌아와 직업 확정 때만 promoteActor를 호출한다.'],
            'persistence': '클래스 담당은 체험 이벤트나 실제 저장 서비스를 수정하지 않는다.',
        },
        'integration': {
            'owner': 'root', 'projectWritesByThisWorker': False,
            'currentHero': {'actorId': hero['id'], 'name': hero['name'], 'classId': hero['classId'], 'characterResourceId': hero['characterResourceId'], 'characterIndex': hero.get('characterIndex', 0)},
            'actorChangesRequired': [
                {'actorId': hero['id'], 'classId': ids['classes']['novice'], 'initialLevel': 1, 'maxLevel': 20, 'parameterCurvesFromClassId': ids['classes']['novice'], 'expCurveFromClassId': ids['classes']['novice'], 'learnedSkills': [{'level': 1, 'skillId': 'skill_attack'}]},
                *[{'actorId': actor_id, 'classId': ids['classes'][job], 'maxLevel': 20, 'parameterCurvesFromClassId': ids['classes'][job], 'expCurveFromClassId': ids['classes'][job]} for actor_id, job in [('actor_scout', 'rogue'), ('actor_mage', 'shaman'), ('actor_cleric', 'taoist')]],
            ],
            'initialClassCurveCaution': '명시적 classOverrides 전에는 actor.parameterCurves를 사용한다. root가 초보 하람과 초기 고정직 동료에게 직업 곡선을 복사한다.',
            'heroInitialEquipment': 'root가 전직 뒤 옛 장비 반환·해제와 해당 직업 초급 장비 지급·장착을 처리한다. promoteActor 자체가 기존 장비를 자동 해제한다고 가정하지 않는다.',
            'actorBattleCommandIds': '빈 목록/생략이면 직업의 한국어 명령을 쓴다. 배우별 battleCommandIds와 전투 이벤트 명령 override는 별도로 우선하므로 감독자가 확인한다.',
            'existingChoiceEvents': '기존 class_hero/class_scout/class_mage/class_cleric 선택 이벤트를 계약 ID로 바꾼다. data.json을 더하는 것만으로 기존 이벤트가 바뀌지는 않는다.',
            'skillDependencies': {'owner': 'root-skills-source', 'requiredIds': [skill for job in jobs for skill in ids['classSkills'][job]]},
            'equipmentDependencies': [e for job in jobs for e in equipment_for_role(job)],
            'equipmentIdSource': '사용자 full 지시의 고정 패턴: equip_jf_<warrior|rogue|shaman|taoist>_<weapon|body>_<1|2|3|4>. ids.json에는 장비 목록이 없으며 기존 equipment 지시와 동일한 패턴을 쓴다.',
            'equipmentPermissionRule': 'canEquip는 actorId/classId/장비ID의 OR다. class.equipmentPermissions.actorIds와 classIds는 빈 목록. 장비 측 equippableActorIds도 비우고 equippableClassIds는 해당 직업만 지정한다. 직업별 equipmentIds는 자기 무기/의복1~4등급만 명시한다. 공유 장비는 EquipmentRecord.equippableClassIds로 허용하며 클래스의 포괄 목록을 채우지 않는다. ItemRecord 장비형이면 원래 필드는 equipmentProfile.equippableClassIds다.',
            'referencesBeforePlay': 'root가 같은 원본에서 관리하는 전체 skills/equipment를 합쳐 기술24개·직업 장비32개 참조를 확인한다. 읽기 전용 pilot prototype의 누락은 full 팩 완료 여부를 뜻하지 않는다. classes 담당은 기술·적·그림 원본을 수정하지 않는다.',
            'engineApiHandoff': {'normalize': 'normalizeClassRecord(record)', 'promotion': 'promoteActor(session, project, actorId, toClassId)', 'promotionEvent': {'kind': 'promoteActor', 'actorId': 'actor_hero', 'toClassId': 'class_jf_<warrior|rogue|shaman|taoist>'}, 'equipment': 'canEquip(project, actor, equipment, classId)', 'classPermissions': 'ClassRecord.equipmentPermissions.{actorIds,classIds,equipmentIds}', 'sharedEquipment': 'EquipmentRecord.equippableClassIds', 'equipmentItem': 'ItemRecord.equipmentProfile.equippableClassIds', 'effectiveClass': 'effectiveActorClassId(project, session, actorId)'},
            'equipmentLevelPolicy': '1/5/10/15는 착용 권장 레벨이며 canEquip에 레벨 조건을 새로 발명하지 않는다. 획득/상점 배치는 root가 정한다.',
        },
        'art': {'purpose': '검토 근거 PNG만. ClassRecord에 그림 필드가 없어 새 sprite나 resourceId를 만들지 않는다.', 'characterSource': 'public/assets/easyrpg/charset/Actor1.png', 'newCharacterSprites': 0, 'previewSampling': 'native 24x32 원본 크롭; 확대는 nearest neighbor만'},
        'approval': {'authorReview': 'REVIEW.md에 실제 PNG 검토 근거를 기록한다.', 'userApproved': False, 'meaningOfReady': 'full 클래스 파일 저장·정규화·순수 전직/장비 권한 smoke 완료. 사용자 승인·실게임 통합·정본 저장 합격이 아니다.'},
    }
    write_json('design.json', design)
    draw_preview(classes, hero)
    outputs = ['data.json', 'design.json', 'actor1-reference.png', 'classes-preview.png']
    write_json('provenance.json', {
        'author': 'GPT 6.1 sol high classes worker; original class parameters and Korean design',
        'dataSource': {'name': 'prototype-database.json', 'sha256': sha(args.prototype), 'access': 'read-only'},
        'fixedContract': {name: sha(HERE.parent / name) for name in ['CONTRACT.md', 'ids.json']},
        'sourceArt': {'path': 'public/assets/easyrpg/charset/Actor1.png', 'sha256': sha(ROOT / 'public/assets/easyrpg/charset/Actor1.png'), 'authors': ['Marina Navarro Travesset (base)', 'VictorSena (edit)'], 'license': 'CC BY 4.0', 'upstreamCommit': '993d88cbc78c658d348bbfa74a3b424d393d27e5', 'newActorSprite': False},
        'artOperation': {'actor1-reference.png': 'Native 288x256 source pixels; source top-left transparency key becomes alpha=0, all foreground RGB unchanged.', 'classes-preview.png': 'Original parameter comparison layout; crop one native 24x32 Actor1 frame, nearest-neighbor enlargement only; source transparency key becomes alpha=0, no recoloring/redrawing.'},
        'generatedFiles': {name: {'sha256': sha(HERE / name), 'bytes': (HERE / name).stat().st_size} for name in outputs},
        'generator': {'path': 'content-packs/joseon-folklore/classes/build.py', 'sha256': sha(Path(__file__))},
    })
    print(json.dumps({'classes': len(classes), 'skillsLinked': 25, 'equipmentPermissionLinks': sum(len(c['equipmentPermissions']['equipmentIds']) for c in classes), 'output': str(HERE)}, ensure_ascii=False))

def draw_preview(classes, hero):
    source = ROOT / 'public/assets/easyrpg/charset/Actor1.png'
    sheet = Image.open(source).convert('RGBA')
    key = sheet.getpixel((0, 0))[:3]
    sheet.putdata([(r, g, b, 0 if (r, g, b) == key else a) for r, g, b, a in (list(sheet.get_flattened_data()) if hasattr(sheet, 'get_flattened_data') else list(sheet.getdata()))])
    sheet.save(HERE / 'actor1-reference.png', optimize=False)
    frame = sheet.crop((24, 0, 48, 32))
    image = Image.new('RGBA', (1272, 956), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    font_path = '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'
    title = ImageFont.truetype(font_path, 27)
    medium = ImageFont.truetype(font_path, 21)
    text = ImageFont.truetype(font_path, 16)
    small = ImageFont.truetype(font_path, 14)
    draw.rectangle((16, 16, 1255, 939), fill='#f7f3e8')
    draw.text((38, 32), '조선 설화 · 완성 직업 5종', font=title, fill='#292a29')
    draw.text((38, 75), '동일 Actor1 유지 / 미장비 수치 / 레벨 1 → 20 / 한국어 전투 명령', font=text, fill='#555650')
    for i, c in enumerate(classes):
        role = list(BLUEPRINT)[i]
        x, y = 38 + i * 244, 118
        color = COLORS[role]
        draw.rectangle((x, y, x + 227, y + 593), fill='#fffdf7', outline='#d1c8b4', width=1)
        draw.rectangle((x, y, x + 227, y + 6), fill=color)
        draw.text((x + 16, y + 22), c['name'], font=medium, fill=color)
        image.alpha_composite(frame.resize((72, 96), Image.Resampling.NEAREST), (x + 16, y + 63))
        draw.text((x + 101, y + 84), '하람', font=text, fill='#383b37')
        draw.text((x + 101, y + 111), '원본 24×32', font=small, fill='#666960')
        draw.text((x + 15, y + 174), '능력치     레벨 1   레벨 20', font=text, fill='#5a5e55')
        for n, (key, label) in enumerate(zip(KEYS, ['체력', '기력', '공격', '방어', '정신', '민첩'])):
            yy = y + 210 + 34 * n
            draw.text((x + 15, yy), label, font=text, fill='#333932')
            draw.text((x + 95, yy), str(c['parameterCurves'][key][0]), font=text, fill='#333932')
            draw.text((x + 170, yy), str(c['parameterCurves'][key][19]), font=text, fill=color)
        draw.line((x + 15, y + 424, x + 212, y + 424), fill='#dad5c7', width=1)
        draw.text((x + 15, y + 440), '공격  ' + c['battleCommands'][1]['name'], font=text, fill='#333932')
        draw.text((x + 15, y + 467), '방어  물품', font=text, fill='#333932')
        draw.text((x + 15, y + 515), '전직: 초보 레벨 1' if role != 'novice' else '전직: 네 직업 중 선택', font=small, fill='#5b6156')
        draw.text((x + 15, y + 542), '습득 1 / 3 / 5 / 8 / 12 / 16' if role != 'novice' else '기본 공격만 습득', font=small, fill='#5b6156')
        draw.text((x + 15, y + 567), '쌍수·강화방어 없음', font=small, fill='#5b6156')
    draw.text((38, 739), '전직 확정: 레벨·경험치 유지 / 체력·기력 회복 없음 / 선택한 직업 ID를 명시', font=text, fill='#3d443c')
    draw.text((38, 775), '무기·의복 1~4등급: 자기 직업만 허용 / 공유 장비는 장비 측 직업 허용 / 전체 기술 정의는 root 소유', font=text, fill='#66522e')
    draw.text((38, 811), '이 PNG는 원본 그림과 실제 data.json 수치를 조립한 검토 자료. 실행 화면·사용자 승인 증거가 아님.', font=small, fill='#5b6156')
    draw.text((38, 859), 'Actor1: Marina Navarro Travesset (base), VictorSena (edit) · EasyRPG RTP · CC BY 4.0', font=small, fill='#666b61')
    draw.text((38, 886), '전경 픽셀 무수정 · 배경 키 투명화 · 배율 3× nearest neighbor · 직업 데이터/검토 레이아웃: classes 담당', font=small, fill='#666b61')
    image.save(HERE / 'classes-preview.png', optimize=False)

if __name__ == '__main__':
    main()
