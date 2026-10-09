"""묶음 m4(Monster4 숲·요괴 8명) 스킬 표 정본 → src/assets/retroRosterSkills/m4.ts.

재사용 층은 키만 적는다 — anchor·frame·frames 는 기존 정의(retroClassSkills·retroMonsterSkills·retroRosterSkills/*.ts)에서
그대로 읽어 온다(다르게 적을 수 없다). 새 시트(NEW)는 스킬당 최대 1장, 규격은 lib_nm4.SHEETS 가 정본.
검사: 레이어 키마다 PNG 가 있고 크기가 frame×frames × frame 인지, 직업당 8개·레벨·마지막 finisher·motion 4종 이상.

    python3 scripts/asset-gen/pixel-fx/gen_nm4_ts.py
"""
import re
import sys
from pathlib import Path

from PIL import Image

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ROOT = HERE.parents[2]
OUT_TS = ROOT / 'src/assets/retroRosterSkills/m4.ts'
FX = ROOT / 'public/assets/generated/pixel-fx'
from lib_nm4 import SHEETS  # noqa: E402

LEVELS = [1, 3, 5, 7, 10, 12, 16, 22]
CLASSES = [
    ('treant', 'monster4-0', 48, 'stomp', 320),
    ('mushroom', 'monster4-1', 48, 'hop', 220),
    ('kappa', 'monster4-2', 48, 'dash', 180),
    ('kitsune', 'monster4-3', 48, 'float', 200),
    ('tanuki', 'monster4-4', 48, 'hop', 240),
    ('golem_moss', 'monster4-5', 48, 'stomp', 360),
    ('sprite_ice', 'monster4-6', 48, 'float', 160),
    ('mandrake', 'monster4-7', 48, 'hop', 200),
]

# (뜻, 이름, motion, 설명, [레이어 키 | (키, anchor)])
SKILLS = {
    'treant': [
        ('branch_lash', '가지 채찍', 'dash-strike', '굵은 가지 팔로 적을 후려친다', ['druid_claw']),
        ('root_bind', '뿌리 휘감기', 'cast', '땅속 뿌리가 솟아 적을 휘감아 묶는다', ['treant_roots']),
        ('bark_skin', '나무껍질', 'buff', '두꺼운 나무껍질로 몸을 덮어 방어를 올린다', ['druid_bark']),
        ('stomp', '고목 발구르기', 'leap-strike', '뛰어올라 뿌리 발로 땅을 울린다', ['guard_quake']),
        ('taunt', '숲의 위압', 'buff', '잎을 곤두세워 적의 시선을 끈다', ['guard_taunt']),
        ('thorn_spin', '가시 회전', 'spin', '가시 돋친 가지를 휘돌려 적진을 쓸어 친다', ['druid_thorn']),
        ('sap_heal', '수액 치유', 'cast', '달콤한 수액으로 아군 전체를 치유한다', ['druid_regrowth', 'cleric_mass_heal']),
        ('ancient_forest', '태고의 숲', 'finisher', '땅에서 거대한 고목 숲이 솟아 적을 짓누르는 필살기', ['treant_forest_sky', 'druid_roots']),
    ],
    'mushroom': [
        ('cap_bump', '갓 박치기', 'dash-strike', '통통한 빨간 갓으로 들이받는다', ['mon_slam_hit']),
        ('heal_spore', '치유 포자', 'cast', '금빛 포자를 뿌려 아군 하나를 치유한다', ['mushroom_spores']),
        ('sleep_spore', '수면 포자', 'cast', '보라 포자 구름으로 적 전원을 잠재운다', ['mon_spore_cloud']),
        ('purify', '정화의 균사', 'cast', '하얀 균사가 아군의 상태이상을 걷어낸다', ['cleric_purify']),
        ('poison_puff', '독버섯 연기', 'shoot', '독 포자 덩이를 쏘아 적을 중독시킨다', ['mon_acid_blob', 'poison']),
        ('ring_dance', '버섯 고리 춤', 'spin', '빙글빙글 돌며 버섯 고리를 피워 적을 흩뜨린다', ['fairy_bloom']),
        ('mass_bloom', '포자 만개', 'buff', '포자가 활짝 피어 아군 전체를 치유한다', ['heal']),
        ('fairy_ring', '요정의 버섯 고리', 'finisher', '숲 전체에 버섯 고리가 피어 적을 잠재우고 아군을 살리는 필살기', ['mushroom_ring_sky', 'sleep']),
    ],
    'kappa': [
        ('sumo_butt', '스모 박치기', 'dash-strike', '접시 머리를 앞세워 힘껏 들이받는다', ['mon_slam_hit']),
        ('water_gun', '물대포', 'shoot', '입으로 센 물줄기를 쏘아 맞힌다', ['kappa_water_jet', 'ninja_splash']),
        ('shell_guard', '등딱지 방어', 'buff', '등딱지에 몸을 숨겨 방어를 올린다', ['mon_shell_barrier']),
        ('palm_flurry', '손바닥 연타', 'flurry', '물갈퀴 손바닥으로 빠르게 연달아 친다', ['monk_whirl_kick']),
        ('river_dive', '강물 다이빙', 'leap-strike', '높이 뛰어 물을 튀기며 떨어진다', ['ninja_splash']),
        ('cucumber', '오이 간식', 'buff', '좋아하는 오이를 먹고 기운을 차린다', ['grandma_herb']),
        ('whirlpool', '소용돌이', 'cast', '적진에 물소용돌이를 일으켜 휩쓴다', ['mon_wave_screen', 'ninja_splash']),
        ('kappa_flood', '갓파 대홍수', 'finisher', '접시의 물을 쏟아 강물이 적을 쓸어 가는 필살기', ['kappa_flood_sky', 'ninja_splash']),
    ],
    'kitsune': [
        ('fox_claw', '여우 발톱', 'dash-strike', '날렵하게 뛰어들어 발톱으로 할퀸다', ['cat_claw']),
        ('foxfire', '여우불', 'cast', '푸른 여우불을 날려 적을 태운다', ['kitsune_foxfire', 'oni_warrior_ghostfire_hit']),
        ('illusion', '환술', 'cast', '환영을 보여 적의 눈을 속인다', ['dancer_charm']),
        ('clone', '분신', 'buff', '꼬리마다 분신을 만들어 회피를 올린다', ['ninja_clone_smoke']),
        ('tail_spin', '꼬리 휘돌리기', 'spin', '아홉 꼬리를 휘둘러 적진을 쓸어 친다', ['hero_whirl']),
        ('fox_wedding', '여우비', 'cast', '해 뜬 날 비를 내려 아군 전체를 치유한다', ['heal']),
        ('spirit_shrine', '여우 신사', 'buff', '신사의 여우 혼을 불러 마력을 모은다', ['shrine_maiden_fox']),
        ('nine_tails', '구미 염화', 'finisher', '아홉 꼬리의 여우불이 원을 그려 적을 불사르는 필살기', ['kitsune_ninefire_sky', 'oni_warrior_ghostfire_hit']),
    ],
    'tanuki': [
        ('belly_bump', '배치기', 'dash-strike', '둥근 배로 퉁 튕겨 낸다', ['mon_slam_hit']),
        ('leaf_shuriken', '나뭇잎 표창', 'shoot', '머리의 나뭇잎을 표창처럼 던진다', ['tanuki_leaf', 'scout_knife_hit']),
        ('belly_drum', '배 두드리기', 'buff', '배를 둥둥 두드려 아군의 기운을 북돋는다', ['bard_notes_red']),
        ('disguise', '둔갑', 'buff', '연기 속에서 바위로 둔갑해 공격을 흘린다', ['ninja_clone_smoke']),
        ('lucky_coin', '행운의 동전', 'shoot', '금화를 튕겨 맞히고 운을 끌어온다', ['merchant_coin', 'merchant_coin_hit']),
        ('smoke_trick', '연기 장난', 'cast', '둔갑 연기를 퍼뜨려 적 전원의 눈을 가린다', ['scout_smoke']),
        ('kettle_drop', '가마솥 낙하', 'leap-strike', '가마솥으로 둔갑해 위에서 떨어진다', ['mon_slam_hit']),
        ('great_transform', '대둔갑', 'finisher', '거대한 너구리로 둔갑해 나뭇잎 폭풍을 일으키는 필살기', ['tanuki_transform_sky', 'scout_knife_hit']),
    ],
    'golem_moss': [
        ('rock_fist', '바위 주먹', 'dash-strike', '무거운 바위 주먹으로 내려친다', ['mon_rock_burst']),
        ('earth_wall', '대지 방벽', 'buff', '땅에서 이끼 돌벽을 세워 아군 전체를 지킨다', ['golem_moss_wall']),
        ('boulder', '바위 던지기', 'shoot', '몸의 바위를 떼어 던진다', ['mage_meteor_rock', 'mon_rock_burst']),
        ('moss_regen', '이끼 재생', 'buff', '이끼가 자라 금 간 몸을 메운다', ['druid_regrowth']),
        ('quake', '지진', 'leap-strike', '뛰어올라 땅을 내려찍어 모든 적을 흔든다', ['golem_pal_quake']),
        ('stone_guard', '돌의 수호', 'buff', '돌 방패로 아군을 감싸 지킨다', ['guard_barrier']),
        ('rune_pulse', '룬 파동', 'cast', '가슴의 룬이 빛나 적 전원을 밀어낸다', ['guard_quake_ring', 'earth']),
        ('mountain_fall', '산사태', 'finisher', '산이 무너져 바위 가시가 적을 뒤덮는 필살기', ['golem_moss_landslide_sky', 'mon_quake_crack']),
    ],
    'sprite_ice': [
        ('ice_shard', '얼음 조각', 'shoot', '뾰족한 얼음 조각을 쏘아 맞힌다', ['mon_frost_orb', 'mon_frost_burst']),
        ('freeze', '빙결', 'cast', '적 하나를 얼음 속에 가둔다', ['sprite_ice_freeze']),
        ('wing_slap', '눈꽃 날개치기', 'dash-strike', '날아들어 눈꽃 날개로 후려친다', ['mon_claw_rake']),
        ('frost_armor', '서리 갑옷', 'buff', '서리 결정으로 몸을 둘러 방어를 올린다', ['mage_mana_shield']),
        ('blizzard', '눈보라', 'cast', '모든 적 위에 눈보라와 얼음 기둥을 내린다', ['mage_blizzard', 'mage_snow']),
        ('ice_spin', '얼음 회오리', 'spin', '빙글 돌며 얼음 조각을 흩뿌린다', ['dragonewt_frost']),
        ('snow_blessing', '눈의 축복', 'buff', '하얀 눈이 내려 아군 전체를 치유한다', ['heal']),
        ('absolute_zero', '절대영도', 'finisher', '세상을 얼리는 거대한 눈꽃이 피어 적을 얼리는 필살기', ['sprite_ice_zero_sky', 'mon_frost_burst']),
    ],
    'mandrake': [
        ('root_kick', '뿌리 발차기', 'dash-strike', '잔뿌리 다리로 걷어찬다', ['mon_tusk_hit']),
        ('scream', '비명', 'cast', '귀를 찢는 비명으로 적 전원을 기절시킨다', ['mandrake_scream']),
        ('herb', '약초', 'cast', '잎을 떼어 아군 하나를 치유한다', ['grandma_herb']),
        ('leaf_blessing', '잎사귀 축복', 'buff', '잎을 흔들어 아군 전체의 힘을 북돋는다', ['cleric_blessing']),
        ('shriek_wave', '고음파', 'shoot', '날카로운 음파를 쏘아 친다', ['bard_sonic_wave', 'bard_sonic_hit']),
        ('uproot', '뿌리 뽑기', 'spin', '땅에서 뛰쳐나와 뒹굴며 적진을 친다', ['druid_roots']),
        ('toxic_sap', '독 수액', 'cast', '쓴 독 수액을 뿌려 적의 힘을 깎는다', ['weaken']),
        ('death_wail', '죽음의 울음', 'finisher', '땅에서 뽑혀 나온 만드라고라의 대비명이 적을 쓰러뜨리는 필살기', ['mandrake_wail_sky', 'mon_screech_ring']),
    ],
}


def known_layers():
    out = {}
    files = [ROOT / 'src/assets/retroClassSkills.ts', ROOT / 'src/assets/retroMonsterSkills.ts']
    files += sorted(p for p in (ROOT / 'src/assets/retroRosterSkills').glob('*.ts') if p.name != 'm4.ts')
    for f in files:
        for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', f.read_text(encoding='utf8')):
            out.setdefault(m.group(1), (m.group(2), int(m.group(3)), int(m.group(4))))
    return out


def main():
    known = known_layers()
    errs = []
    lines = []
    for cls, chip, *_ in CLASSES:
        rows = SKILLS[cls]
        if len(rows) != 8:
            errs.append(f'{cls}: {len(rows)} skills')
        if rows[-1][2] != 'finisher':
            errs.append(f'{cls}: last not finisher')
        if len({r[2] for r in rows}) < 4:
            errs.append(f'{cls}: motions < 4')
        name = {'treant': '트렌트', 'mushroom': '버섯 요정', 'kappa': '갓파', 'kitsune': '구미호', 'tanuki': '너구리 둔갑사',
                'golem_moss': '이끼 골렘', 'sprite_ice': '얼음 요정', 'mandrake': '만드라고라'}[cls]
        lines.append(f'    // ── {name} ({chip}) ──')
        for lv, (mean, title, motion, desc, layers) in zip(LEVELS, rows):
            if motion == 'blink-strike':
                errs.append(f'{cls}_{mean}: blink-strike')
            new = [k for k in layers if k in SHEETS]
            if len(new) > 1:
                errs.append(f'{cls}_{mean}: new sheets {new}')
            parts = []
            for k in layers:
                if k in SHEETS:
                    s = SHEETS[k]
                    spec = (s['anchor'], s['frame'], s['frames'])
                    if not k.startswith(cls + '_'):
                        errs.append(f'{k}: new key needs {cls}_ prefix')
                elif k in known:
                    spec = known[k]
                else:
                    errs.append(f'{k}: unknown layer')
                    continue
                png = FX / f'{k}.png'
                if not png.exists():
                    errs.append(f'{k}: png missing')
                else:
                    sz = Image.open(png).size
                    if sz != (spec[1] * spec[2], spec[1]):
                        errs.append(f'{k}: png {sz} != {spec[1] * spec[2]}x{spec[1]}')
                parts.append(f'{{ key: "{k}", anchor: "{spec[0]}", frame: {spec[1]}, frames: {spec[2]} }}')
            lines.append(f'    {{ id: "skill_{cls}_{mean}", classId: "class_{cls}", actorId: "actor_{cls}", name: "{title}", level: {lv}, '
                         f'motion: "{motion}", description: "{desc}", layers: [{", ".join(parts)}] }},')
    pp = [f'    {{ chip: "{chip}", cell: {cell}, motion: "{mo}", idleFrameMs: {ms}, rows: 5 }},' for _, chip, cell, mo, ms in CLASSES]
    ts = ('// 묶음 m4 — 3차 로스터(OPRN 자체 제작 Monster4 걷기 칩 8명: 숲·요괴). 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석.\n'
          '// 생성: python3 scripts/asset-gen/pixel-fx/gen_nm4_ts.py (표를 고치고 다시 돌린다). 새 이펙트 시트: scripts/asset-gen/pixel-fx/lib_nm4.py + <키>.py.\n'
          '// 걷기 칩: scripts/asset-gen/oprn-charset/monster4.py, 전투 15칸: scripts/asset-gen/party-pixel/monster4-<i>.py (칩 × 1, 셀 48).\n'
          'import type { RetroRosterBatch } from "@/assets/retroRoster";\n\n'
          'export const BATCH: RetroRosterBatch = {\n  skills: [\n' + '\n'.join(lines) + '\n  ],\n  partyPixel: [\n' + '\n'.join(pp) + '\n  ]\n};\n')
    if errs:
        print('\n'.join(errs))
        sys.exit(1)
    OUT_TS.write_text(ts, encoding='utf8')
    print('wrote', OUT_TS.relative_to(ROOT), sum(len(v) for v in SKILLS.values()), 'skills')


if __name__ == '__main__':
    main()
