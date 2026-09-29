"""src/assets/retroRosterSkills/b4.ts 생성기 — 묶음 b4(Monster2 8명)의 스킬 64개·비인간형 시트 규격 표.
표를 고치고 `python3 gen_b4_skills.py` 로 다시 쓴다. 이펙트 생성기(pixel-fx/<key>.py)는 이 파일이 쓴 b4.ts 를 계약으로 읽는다."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'src/assets/retroRosterSkills/b4.ts'
LEVELS = [1, 3, 5, 7, 10, 12, 16, 22]

# classKey(=classId 에서 class_ 뺀 것), (chip, cell, motion, idleFrameMs), skills
# skill: (idSuffix, name, motion, description, [(layerKey, anchor, frame, frames)...])
CLASSES = [
    ('harpy_pal', ('monster2-0', 48, 'swoop', 120), [
        ('feather_dart', '깃털 표창', 'shoot', '날개에서 뽑은 깃털 한 장을 날려 적을 꿰뚫는다',
         [('harpy_pal_feather', 'projectile', 32, 4), ('harpy_pal_feather_hit', 'target', 64, 6)]),
        ('talon_dive', '급강하 발톱', 'leap-strike', '높이 솟았다 내리꽂히며 발톱으로 세 줄을 긋는다',
         [('harpy_pal_talon', 'target', 64, 8)]),
        ('wing_flurry', '날개 연타', 'flurry', '날개로 빠르게 후려쳐 바람 칼날을 흩뿌린다',
         [('harpy_pal_wingbeat', 'target', 64, 8)]),
        ('feather_rain', '깃털 소나기', 'cast', '하늘 가득 깃털을 뿌려 모든 적에게 쏟아붓는다',
         [('harpy_pal_featherfall', 'allTargets', 64, 10)]),
        ('shriek', '고음 비명', 'cast', '귀를 찢는 비명이 음파 고리로 퍼져 적을 어지럽힌다',
         [('harpy_pal_shriek', 'allTargets', 64, 8)]),
        ('wind_veil', '바람 장막', 'buff', '깃털 회오리로 몸을 감싸 회피를 끌어올린다',
         [('harpy_pal_veil', 'user', 64, 10)]),
        ('cyclone_wing', '회오리 날갯짓', 'spin', '적진 위에서 회전하며 깃털 회오리로 모두를 휘감는다',
         [('harpy_pal_cyclone', 'allTargets', 64, 10)]),
        ('feather_storm', '깃털 폭풍', 'finisher', '하늘을 뒤덮는 깃털 폭풍을 일으키는 필살기',
         [('harpy_pal_storm', 'screen', 128, 12), ('harpy_pal_storm_hit', 'allTargets', 64, 8)]),
    ]),
    ('gargoyle_pal', ('monster2-1', 64, 'swoop', 260), [
        ('stone_claw', '돌 발톱', 'dash-strike', '석화한 발톱으로 파고들어 돌조각이 튀도록 긁는다',
         [('gargoyle_pal_claw', 'target', 64, 8)]),
        ('stone_skin', '석화 피부', 'buff', '몸 위로 돌 껍질이 굳어 방어를 높인다',
         [('gargoyle_pal_skin', 'user', 64, 8)]),
        ('dive_bomb', '급강하 폭격', 'leap-strike', '하늘에서 곤두박질쳐 땅을 부수며 내리꽂는다',
         [('gargoyle_pal_dive', 'target', 64, 9)]),
        ('petrify_gaze', '석화의 눈길', 'cast', '노란 눈빛이 닿은 적을 돌로 굳혀 움직임을 막는다',
         [('gargoyle_pal_gaze', 'target', 64, 10)]),
        ('wing_wall', '돌 날개 방벽', 'buff', '돌 날개를 펼쳐 아군 전체 앞에 방벽을 세운다',
         [('gargoyle_pal_wingwall', 'allAllies', 64, 10)]),
        ('tail_sweep', '꼬리 후려치기', 'dash-strike', '돌 꼬리로 지면을 쓸어 적을 날려 보낸다',
         [('gargoyle_pal_tail', 'target', 64, 8)]),
        ('rockfall', '낙석', 'cast', '천장에서 바위 덩이를 쏟아 모든 적을 깔아뭉갠다',
         [('gargoyle_pal_rockfall', 'allTargets', 64, 10)]),
        ('cathedral_fall', '성당 붕괴', 'finisher', '고딕 첨탑과 아치가 무너져 내리는 필살기',
         [('gargoyle_pal_cathedral', 'screen', 128, 12), ('gargoyle_pal_cathedral_hit', 'allTargets', 64, 8)]),
    ]),
    ('vampire', ('monster2-2', 48, 'float', 200), [
        ('fang_bite', '송곳니 물기', 'dash-strike', '스르르 다가가 목덜미를 송곳니로 문다',
         [('vampire_fang', 'target', 64, 8)]),
        ('blood_claws', '핏빛 손톱', 'flurry', '붉게 물든 손톱으로 연속해서 할퀸다',
         [('vampire_claws', 'target', 64, 8)]),
        ('bat_swarm', '박쥐 떼', 'cast', '박쥐 떼가 몰려가 모든 적을 물어뜯는다',
         [('vampire_bats', 'allTargets', 64, 10)]),
        ('blood_orb', '핏빛 구슬', 'cast', '농축한 피를 구슬로 던져 터뜨린다',
         [('vampire_bloodorb', 'projectile', 32, 4), ('vampire_bloodburst', 'target', 64, 8)]),
        ('mist_form', '안개 변신', 'buff', '붉은 안개로 흩어져 공격을 흘려보낸다',
         [('vampire_mist', 'user', 64, 10)]),
        ('life_drain', '생명 흡수', 'cast', '적의 생기를 붉은 흐름으로 빨아들여 되찾는다',
         [('vampire_drain', 'target', 64, 10)]),
        ('blood_spikes', '피의 창', 'cast', '땅에서 핏빛 창이 솟아 모든 적을 꿰뚫는다',
         [('vampire_bloodspikes', 'allTargets', 64, 10)]),
        ('blood_moon', '붉은 달의 밤', 'finisher', '핏빛 보름달이 떠오르고 박쥐 떼가 밤을 덮는 필살기',
         [('vampire_bloodmoon', 'screen', 128, 12), ('vampire_moonbite', 'target', 64, 8)]),
    ]),
    ('demon_knight', ('monster2-3', 48, 'dash', 300), [
        ('demon_slash', '마검 일섬', 'dash-strike', '검은 마검으로 붉은 반월을 그리며 벤다',
         [('demon_knight_slash', 'target', 64, 8)]),
        ('blade_awaken', '마검 각성', 'buff', '마검이 붉은 불꽃을 두르며 공격력을 끌어올린다',
         [('demon_knight_awaken', 'user', 64, 8)]),
        ('hell_thrust', '지옥 찌르기', 'dash-strike', '창처럼 곧게 찔러 적의 등 뒤까지 꿰뚫는다',
         [('demon_knight_thrust', 'target', 64, 8)]),
        ('dark_flame_spin', '흑염 회전베기', 'spin', '검은 불꽃을 끌며 회전해 모든 적을 벤다',
         [('demon_knight_flamespin', 'allTargets', 64, 10)]),
        ('thunder_smash', '낙뢰 내려찍기', 'leap-strike', '뛰어올라 붉은 번개와 함께 내려찍는다',
         [('demon_knight_smash', 'target', 64, 10)]),
        ('slash_wave', '마력 참격파', 'cast', '검을 휘둘러 붉은 초승달 참격을 날린다',
         [('demon_knight_wave', 'projectile', 32, 4), ('demon_knight_wave_hit', 'target', 64, 8)]),
        ('cross_hack', '십자 난도질', 'flurry', '눈 깜짝할 새 십자 참격을 겹쳐 새긴다',
         [('demon_knight_x', 'target', 64, 10)]),
        ('sword_release', '마검 해방', 'finisher', '봉인이 풀린 마검이 붉은 거대 참격을 내리치는 필살기',
         [('demon_knight_release', 'screen', 128, 12), ('demon_knight_release_hit', 'target', 64, 10)]),
    ]),
    ('golem_pal', ('monster2-4', 64, 'stomp', 320), [
        ('clay_fist', '돌주먹', 'dash-strike', '점토 주먹으로 내리쳐 흙먼지를 일으킨다',
         [('golem_pal_fist', 'target', 64, 8)]),
        ('clay_armor', '점토 갑옷', 'buff', '몸에 흙을 덧발라 단단히 굳힌다',
         [('golem_pal_clay', 'user', 64, 8)]),
        ('earth_slam', '대지 내려찍기', 'leap-strike', '땅을 내려쳐 균열이 적진으로 내달린다',
         [('golem_pal_quake', 'allTargets', 64, 10)]),
        ('boulder_toss', '바위 투척', 'cast', '몸에서 뜯어낸 바윗덩이를 던져 부순다',
         [('golem_pal_boulder', 'projectile', 32, 4), ('golem_pal_boulder_hit', 'target', 64, 8)]),
        ('sand_wall', '모래 방벽', 'buff', '모래 소용돌이가 아군 전체를 감싼다',
         [('golem_pal_sandwall', 'allAllies', 64, 10)]),
        ('rolling_crush', '구르기', 'spin', '몸을 말아 굴러가며 적을 짓뭉갠다',
         [('golem_pal_roll', 'target', 64, 10)]),
        ('earth_pillars', '지반 융기', 'cast', '발밑에서 흙기둥이 솟구쳐 모든 적을 들어 올린다',
         [('golem_pal_pillars', 'allTargets', 64, 10)]),
        ('landslide', '산사태', 'finisher', '산 하나가 무너져 내리는 듯한 필살기',
         [('golem_pal_avalanche', 'screen', 128, 12), ('golem_pal_avalanche_hit', 'allTargets', 64, 8)]),
    ]),
    ('dragonewt', ('monster2-5', 64, 'breath', 260), [
        ('dragon_claw', '용의 발톱', 'dash-strike', '비늘 발톱으로 깊게 세 번 할퀸다',
         [('dragonewt_claw', 'target', 64, 8)]),
        ('flame_breath', '화염 브레스', 'shoot', '가슴 가득 숨을 모아 화염을 토해낸다',
         [('dragonewt_flame', 'projectile', 32, 4), ('dragonewt_flame_hit', 'target', 64, 10)]),
        ('tail_spin', '꼬리 회전', 'spin', '굵은 꼬리를 휘돌려 모든 적을 쓸어낸다',
         [('dragonewt_tailspin', 'allTargets', 64, 8)]),
        ('scale_harden', '비늘 경화', 'buff', '비늘이 금속처럼 굳어 방어를 높인다',
         [('dragonewt_scales', 'user', 64, 8)]),
        ('venom_breath', '독무 브레스', 'shoot', '녹색 독안개를 내뿜어 중독시킨다',
         [('dragonewt_venom', 'target', 64, 10)]),
        ('wing_crash', '날개 급습', 'leap-strike', '날개를 펼쳐 치솟았다 어깨로 들이받는다',
         [('dragonewt_wingcrash', 'target', 64, 8)]),
        ('frost_breath', '서리 브레스', 'cast', '차가운 숨결로 모든 적을 얼음 속에 가둔다',
         [('dragonewt_frost', 'allTargets', 64, 10)]),
        ('dragon_inferno', '용염 대폭발', 'finisher', '용의 불길이 전장을 태우는 필살기',
         [('dragonewt_inferno', 'screen', 128, 12), ('dragonewt_inferno_hit', 'allTargets', 64, 8)]),
    ]),
    ('oni_warrior', ('monster2-6', 64, 'dash', 180), [
        ('twin_slash', '쌍도 연참', 'flurry', '두 자루 곡도로 번갈아 빠르게 벤다',
         [('oni_warrior_twinslash', 'target', 64, 8)]),
        ('oni_charge', '귀신 돌진', 'dash-strike', '붉은 잔상을 끌며 곧장 파고들어 벤다',
         [('oni_warrior_charge', 'target', 64, 8)]),
        ('oni_roar', '오니의 함성', 'buff', '귀신 같은 함성이 퍼져 아군의 사기를 올린다',
         [('oni_warrior_roar', 'user', 128, 10)]),
        ('demon_whirl', '귀문 회전베기', 'spin', '푸른 귀화를 두르고 회전해 모든 적을 벤다',
         [('oni_warrior_whirl', 'allTargets', 64, 10)]),
        ('sky_smash', '도깨비 낙참', 'leap-strike', '뛰어올라 두 칼을 겹쳐 내리찍는다',
         [('oni_warrior_skysmash', 'target', 64, 9)]),
        ('ghost_fire', '귀화 날리기', 'cast', '칼끝에서 푸른 귀화를 날려 태운다',
         [('oni_warrior_ghostfire', 'projectile', 32, 4), ('oni_warrior_ghostfire_hit', 'target', 64, 8)]),
        ('blood_x', '피갈이 X참', 'dash-strike', '가로지르며 X자로 베어 핏빛 궤적을 남긴다',
         [('oni_warrior_bloodx', 'target', 64, 10)]),
        ('night_parade', '백귀야행', 'finisher', '수많은 귀신이 등불을 들고 행진하며 전장을 쓸어내는 필살기',
         [('oni_warrior_parade', 'screen', 128, 12), ('oni_warrior_parade_hit', 'allTargets', 64, 8)]),
    ]),
    ('dark_lord', ('monster2-7', 64, 'shoot', 240), [
        ('dark_orb', '암흑 구체', 'shoot', '손끝에서 키운 암흑 구체를 쏘아 터뜨린다',
         [('dark_lord_orb', 'projectile', 32, 4), ('dark_lord_orb_hit', 'target', 64, 8)]),
        ('shadow_chains', '어둠의 사슬', 'cast', '그림자 사슬이 솟아 적을 옭아맨다',
         [('dark_lord_chains', 'target', 64, 10)]),
        ('mana_ward', '마력 방벽', 'buff', '육각 마법진 방벽이 몸을 둘러싼다',
         [('dark_lord_ward', 'user', 64, 10)]),
        ('blood_pact', '피의 계약', 'cast', '적에게 계약 문양을 새겨 생기를 빼앗는다',
         [('dark_lord_pact', 'target', 64, 10)]),
        ('abyss_maw', '심연의 아가리', 'cast', '발밑에 검은 구멍이 열려 모든 적을 삼킨다',
         [('dark_lord_abyss', 'allTargets', 64, 10)]),
        ('hell_bolt', '지옥 번개', 'cast', '보랏빛 붉은 번개 기둥을 내리꽂는다',
         [('dark_lord_hellbolt', 'target', 64, 8)]),
        ('dark_meteor', '암흑 유성우', 'cast', '어둠에 물든 운석을 모든 적에게 떨어뜨린다',
         [('dark_lord_meteor', 'allTargets', 64, 10)]),
        ('total_eclipse', '종말의 어둠', 'finisher', '하늘을 검게 물들이는 개기 일식의 필살기',
         [('dark_lord_eclipse', 'screen', 128, 12), ('dark_lord_eclipse_hit', 'allTargets', 64, 8)]),
    ]),
]


def main():
    lines = []
    for ck, _, skills in CLASSES:
        assert len(skills) == 8, ck
        assert len({s[2] for s in skills}) >= 4, ck
        for lv, (sid, name, motion, desc, layers) in zip(LEVELS, skills):
            assert (motion == 'finisher') == (lv == 22), (ck, sid)
            ls = ', '.join(f'{{ key: "{k}", anchor: "{a}", frame: {fr}, frames: {n} }}' for k, a, fr, n in layers)
            lines.append(f'    {{ id: "skill_{ck}_{sid}", classId: "class_{ck}", actorId: "actor_{ck}", name: "{name}", level: {lv}, motion: "{motion}", '
                         f'description: "{desc}", layers: [{ls}] }},')
    pp = ', '.join(f'{{ chip: "{c}", cell: {cell}, motion: "{m}", idleFrameMs: {ms} }}' for _, (c, cell, m, ms), _ in CLASSES)
    pp_lines = [f'    {{ chip: "{c}", cell: {cell}, motion: "{m}", idleFrameMs: {ms} }},' for _, (c, cell, m, ms), _ in CLASSES]
    text = ('// 묶음 b4 — Monster2 8명(하피·가고일·흡혈귀·마기사·흙 골렘·용인·오니 무사·마족 공작)의 스킬 64개와 전투 도트 규격.\n'
            '// 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석, 스킬 형식은 retroClassSkills.ts(RetroClassSkill).\n'
            '// 이 파일은 scripts/asset-gen/party-pixel/gen_b4_skills.py 가 쓴다 — 표를 고치고 그 스크립트를 다시 돌려라.\n'
            '// 전투 도트: public/assets/generated/party-pixel/<chip>.png (셀 48·64, 왼쪽을 본다). 이펙트: public/assets/generated/pixel-fx/<key>.png.\n'
            'import type { RetroRosterBatch } from "@/assets/retroRoster";\n\n'
            'export const BATCH: RetroRosterBatch = {\n  skills: [\n' + '\n'.join(lines) + '\n  ],\n  partyPixel: [\n' + '\n'.join(pp_lines) + '\n  ]\n};\n')
    OUT.write_text(text, encoding='utf8')
    n_layers = sum(len(s[4]) for _, _, sk in CLASSES for s in sk)
    print('wrote', OUT, len(lines), 'skills', n_layers, 'layers')


if __name__ == '__main__':
    main()
