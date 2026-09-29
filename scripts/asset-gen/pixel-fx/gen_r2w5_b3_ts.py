"""b3(Monster1 8) 묶음 파일 src/assets/retroRosterSkills/b3.ts 를 표에서 생성한다(b5 도 emit 을 빌려 쓴다).
표를 고치고 python3 scripts/asset-gen/pixel-fx/gen_r2w5_b3_ts.py 를 다시 돌린다. 규칙은 gen_r2w5_b1_ts.py 와 같다:
레벨 1·3·5·7·10·12·16·22, 마지막 finisher, motion 최소 4종, 비인간형 몸이라 blink-strike 금지, 새 시트는 스킬당 최대 1장(<classKey>_<뜻>).
재사용 시트는 실제 PNG 크기와 frame·frames 를 대조한다."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
A = {'t': 'target', 'u': 'user', 'at': 'allTargets', 'aa': 'allAllies', 's': 'screen', 'p': 'projectile'}
LEVELS = [1, 3, 5, 7, 10, 12, 16, 22]
BODY_MOTIONS = {'dash-strike', 'leap-strike', 'flurry', 'spin', 'cast', 'shoot', 'buff', 'finisher'}

CLASSES = [
    ('slime_pal', '슬라임', 'monster1-0', 48, 'hop', 220, [
        ('tackle', '몸통 박치기', 1, 'dash-strike', '말랑한 몸을 통째로 부딪친다', ['guard_bash:t:64:8']),
        ('acid', '산성 방울', 3, 'shoot', '몸에서 떼어 낸 산성 방울을 뱉는다', ['mon_acid_blob:p:32:4', 'mon_acid_splash:t:64:8']),
        ('jelly_wall', '젤리 방벽', 5, 'buff', '몸을 부풀려 탱글한 젤리 막을 두른다', ['slime_pal_jelly:u:64:10']),
        ('absorb', '흡수', 7, 'cast', '적의 기운을 빨아들여 제 몸을 채운다', ['mon_drain:t:64:10']),
        ('split', '분열', 10, 'buff', '몸을 둘로 나눠 분신이 공격을 받아낸다', ['ninja_clone_smoke:u:64:6']),
        ('press', '대점프 짓누르기', 12, 'leap-strike', '높이 뛰어올라 적진 위로 떨어진다', ['guard_quake:at:64:10']),
        ('mend', '치유 점액', 16, 'cast', '맑은 점액이 아군 전체의 상처를 덮는다', ['heal:aa:64:8']),
        ('king', '킹 슬라임', 22, 'finisher', '동료 슬라임이 모여 왕관 쓴 거대 슬라임이 되는 필살기', ['slime_pal_king_sky:s:128:12', 'mon_acid_splash:at:64:8']),
    ]),
    ('demon', '붉은 악마', 'monster1-1', 48, 'swoop', 150, [
        ('trident', '삼지창 찌르기', 1, 'dash-strike', '삼지창으로 날카롭게 찌른다', ['hero_pierce:t:64:8']),
        ('hellfire', '지옥불', 3, 'cast', '손바닥 위 불덩이를 던져 터뜨린다', ['mage_fireball_orb:p:32:4', 'mage_fire_burst:t:64:10']),
        ('pact', '악마의 계약', 5, 'buff', '피의 계약서에 서명해 힘을 끌어올린다', ['demon_pact:u:64:10']),
        ('pillar', '화염 기둥', 7, 'cast', '적 전원의 발밑에서 불기둥을 솟구치게 한다', ['mon_flame_pillar:at:64:10']),
        ('dive', '급강하 찌르기', 10, 'leap-strike', '날아올랐다가 거꾸로 내리꽂는다', ['hero_rising:t:64:9']),
        ('hex', '저주의 불꽃', 12, 'cast', '보라 불꽃으로 적 전원을 저주한다', ['mon_hex_flame:at:64:10']),
        ('gale', '날개 열풍', 16, 'spin', '날개를 휘돌려 뜨거운 바람으로 적진을 태운다', ['mon_gale_screen:s:128:8', 'mon_burn:at:64:8']),
        ('inferno', '연옥의 문', 22, 'finisher', '지옥문을 열어 불길을 쏟아붓는 필살기', ['demon_inferno_sky:s:128:12', 'mon_dark_burn:at:64:8']),
    ]),
    ('ogre_kid', '꼬마 오거', 'monster1-2', 48, 'stomp', 300, [
        ('club', '몽둥이 휘두르기', 1, 'dash-strike', '큰 몽둥이로 힘껏 후려친다', ['mon_slam_hit:t:64:8']),
        ('smash', '내려찍기', 3, 'leap-strike', '뛰어올라 몽둥이로 땅째 내려찍는다', ['monk_earth_palm:t:128:10']),
        ('tantrum', '떼쓰기', 5, 'flurry', '주먹을 마구 휘둘러 두들긴다', ['monk_fist_flurry:t:64:10']),
        ('rock', '바위 던지기', 7, 'shoot', '주운 바위를 번쩍 들어 던진다', ['mon_boulder:p:32:4', 'mon_rock_burst:t:64:8']),
        ('whirl', '회전 몽둥이', 10, 'spin', '몽둥이를 든 채 빙글빙글 돌며 적진을 친다', ['hero_whirl:at:64:10']),
        ('guts', '배짱', 12, 'buff', '배를 두드리며 함성을 질러 힘을 올린다', ['hero_warcry:u:128:10']),
        ('quake', '땅 울리기', 16, 'leap-strike', '발을 구르고 뛰어 땅을 갈라 놓는다', ['mon_quake_crack:at:64:10']),
        ('giant', '거인의 한 방', 22, 'finisher', '거인 조상의 그림자가 몽둥이를 내리치는 필살기', ['ogre_kid_giant_sky:s:128:12', 'guard_fortress_slam:at:64:8']),
    ]),
    ('ghost_pal', '유령', 'monster1-3', 48, 'float', 200, [
        ('chill', '서늘한 손길', 1, 'dash-strike', '차가운 손으로 스쳐 기운을 빼앗는다', ['weaken:t:64:8']),
        ('possess', '빙의', 3, 'cast', '적의 몸에 스며들어 잠시 조종한다', ['ghost_pal_possess:t:64:10']),
        ('fade', '투명화', 5, 'buff', '몸을 흐리게 해 공격을 흘려보낸다', ['scout_afterimage:u:64:8']),
        ('grudge', '원한의 저주', 7, 'cast', '해골 저주로 적의 힘을 깎는다', ['mon_curse_skull:t:64:10']),
        ('wail', '통곡', 10, 'cast', '구슬픈 울음이 적 전원을 떨게 한다', ['mon_wail_sky:s:128:8', 'mon_screech_ring:at:64:8']),
        ('wisp', '도깨비불', 12, 'shoot', '푸른 도깨비불을 날려 얼린다', ['mon_frost_orb:p:32:4', 'mon_frost_burst:t:64:8']),
        ('siphon', '영혼 흡수', 16, 'cast', '적의 영혼을 빨아 제 힘으로 바꾼다', ['mon_drain:t:64:10']),
        ('parade', '백귀야행', 22, 'finisher', '유령 행렬이 밤하늘을 가로지르는 필살기', ['ghost_pal_parade_sky:s:128:12', 'witch_nightmare_hit:at:64:8']),
    ]),
    ('skeleton_pal', '해골병', 'monster1-4', 48, 'dash', 200, [
        ('slash', '뼈 베기', 1, 'dash-strike', '날 세운 뼈로 크게 벤다', ['mon_cleave_arc:t:64:10']),
        ('bone_throw', '뼈 던지기', 3, 'shoot', '제 갈비뼈를 뽑아 빙글 던진다', ['dog_bone:p:32:4', 'dog_bone_hit:t:64:8']),
        ('rebuild', '재조립', 5, 'buff', '흩어진 뼈를 다시 맞춰 몸을 추스른다', ['ninja_log_puff:u:64:8']),
        ('bone_arrow', '뼈 화살', 7, 'shoot', '뼈 화살을 날려 꿰뚫는다', ['mon_bone_arrow:p:32:4', 'mon_arrow_hit:t:64:8']),
        ('rattle', '해골 연타', 10, 'flurry', '달각거리며 쉴 새 없이 두들긴다', ['scout_flurry:t:64:10']),
        ('whirl', '뼈 회오리', 12, 'spin', '뼈를 흩뿌리며 회전해 적진을 벤다', ['hero_whirl:at:64:10']),
        ('death_curse', '죽음의 저주', 16, 'cast', '해골 저주로 적을 쇠약하게 한다', ['mon_curse_skull:t:64:10']),
        ('legion', '해골 군단', 22, 'finisher', '땅에서 해골 병사들이 일어나 화살을 퍼붓는 필살기', ['skeleton_pal_legion_sky:s:128:12', 'mon_arrow_hit:at:64:8']),
    ]),
    ('zombie_pal', '좀비', 'monster1-5', 48, 'stomp', 340, [
        ('bite', '물어뜯기', 1, 'dash-strike', '달려들어 이빨로 물어뜯는다', ['mon_fang_bite:t:64:8']),
        ('rot', '썩은 숨', 3, 'cast', '썩은 숨결을 뿜어 적 전원을 괴롭힌다', ['mon_rot_cloud:at:64:10']),
        ('claw', '할퀴기', 5, 'flurry', '손톱으로 마구 할퀸다', ['mon_claw_rake:t:64:8']),
        ('undying', '불사', 7, 'buff', '쓰러져도 다시 일어나는 끈질김으로 버틴다', ['cleric_revive:u:64:12']),
        ('pounce', '덮치기', 10, 'leap-strike', '몸을 던져 덮치고 물어뜯는다', ['mon_devour_jaws:t:64:10']),
        ('plague', '역병', 12, 'cast', '독한 역병을 퍼뜨린다', ['poison:at:64:8']),
        ('grave', '무덤 손', 16, 'cast', '땅을 가르고 무덤의 손들이 적을 붙잡는다', ['mon_quake_crack:at:64:10']),
        ('horde', '좀비 떼', 22, 'finisher', '땅을 뚫고 좀비 무리가 밀려드는 필살기', ['zombie_pal_horde_sky:s:128:12', 'mon_rot_cloud:at:64:10']),
    ]),
    ('reaper', '사신', 'monster1-6', 48, 'float', 220, [
        ('scythe', '낫 베기', 1, 'dash-strike', '커다란 낫으로 X자를 긋는다', ['mon_scythe_x:t:64:10']),
        ('harvest', '영혼 수확', 3, 'cast', '적의 영혼 일부를 거둬 간다', ['mon_drain:t:64:10']),
        ('mark', '사신의 표식', 5, 'cast', '해골 표식을 새겨 적을 죽음에 가깝게 한다', ['reaper_mark:t:64:10']),
        ('shadow', '그림자 베기', 7, 'flurry', '그림자처럼 스며들어 거듭 벤다', ['scout_backstab:t:64:8']),
        ('death_spin', '죽음의 회전', 10, 'spin', '낫을 크게 돌려 적진을 쓸어 벤다', ['mon_cleave_arc:at:64:10']),
        ('aura', '명계의 기운', 12, 'buff', '검은 기운을 둘러 힘을 올린다', ['mon_demon_aura:u:64:8']),
        ('dread', '공포', 16, 'cast', '텅 빈 눈으로 노려봐 적 전원을 얼어붙게 한다', ['mon_gaze_screen:s:128:8', 'weaken:at:64:8']),
        ('doom', '즉사의 낫', 22, 'finisher', '거대한 달 앞에서 낫이 내려오는 필살기', ['reaper_doom_sky:s:128:12', 'mon_scythe_x:at:64:10']),
    ]),
    ('minotaur_pal', '수인 전사', 'monster1-7', 64, 'stomp', 300, [
        ('axe', '도끼 내려치기', 1, 'dash-strike', '큰 도끼를 머리 위에서 내려친다', ['mon_cleave_arc:t:64:10']),
        ('horn', '뿔 돌진', 3, 'dash-strike', '뿔을 앞세워 흙먼지를 일으키며 들이받는다', ['mon_tusk_hit:t:64:8', 'mon_charge_dust:u:64:6']),
        ('rage', '광포', 5, 'buff', '콧김을 뿜으며 몸이 붉게 달아오른다', ['hero_flame_aura:u:64:6']),
        ('split_earth', '대지 가르기', 7, 'leap-strike', '뛰어올라 도끼로 땅을 갈라 적진을 흔든다', ['mon_quake_crack:at:64:10']),
        ('pummel', '난타', 10, 'flurry', '주먹과 도끼 자루로 연달아 두들긴다', ['monk_fist_flurry:t:64:10']),
        ('whirl', '회전 도끼', 12, 'spin', '도끼를 든 채 회전해 모두를 벤다', ['hero_whirl:at:64:10']),
        ('bellow', '황소 포효', 16, 'cast', '땅을 울리는 포효로 적 전원을 움츠러들게 한다', ['mon_roar_ring:at:64:8']),
        ('labyrinth', '미궁의 분노', 22, 'finisher', '미궁의 벽이 무너지며 도끼가 떨어지는 필살기', ['minotaur_pal_labyrinth_sky:s:128:12', 'guard_fortress_slam:at:64:8']),
    ]),
]


def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')


def emit(batch, title, classes):
    fx = ROOT / 'public/assets/generated/pixel-fx'
    lines = [f'// 묶음 {batch}({title}) — 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석, 스킬 형식은 retroClassSkills.ts(RetroClassSkill).',
             f'// 생성: scripts/asset-gen/pixel-fx/gen_r2w5_{batch}_ts.py (표를 고치고 다시 돌린다). 새 이펙트 시트 그림: scripts/asset-gen/pixel-fx/r2w5_<직업 키>.py + <키>.py.',
             '// 비인간형 몸이므로 motion 은 dash-strike·leap-strike·flurry·spin·cast·shoot·buff·finisher 만 쓴다(런타임이 몬스터 몸 동작에 매핑).',
             'import type { RetroRosterBatch } from "@/assets/retroRoster";', '', 'export const BATCH: RetroRosterBatch = {', '  skills: [']
    new = set()
    for key, kr, chip, cell, pm, ms, skills in classes:
        assert [s[2] for s in skills] == LEVELS, key
        assert skills[-1][3] == 'finisher' and len({s[3] for s in skills}) >= 4, key
        lines.append(f'    // ── {kr} ({chip}) ──')
        for name, skr, lv, motion, desc, layers in skills:
            assert motion in BODY_MOTIONS, (key, name, motion)
            ls = []
            fresh = 0
            for L in layers:
                k, a, fr, n = L.split(':')
                png = fx / f'{k}.png'
                if k.startswith(key + '_'):
                    fresh += 1
                    new.add(k)
                elif png.exists():
                    w, h = Image.open(png).size
                    assert (w, h) == (int(fr) * int(n), int(fr)), (k, (w, h), fr, n)
                else:
                    raise SystemExit(f'{k}: 재사용 시트가 없다')
                ls.append(f'{{ key: "{k}", anchor: "{A[a]}", frame: {fr}, frames: {n} }}')
            assert fresh <= 1, (key, name, '새 시트는 스킬당 1장')
            lines.append(f'    {{ id: "skill_{key}_{name}", classId: "class_{key}", actorId: "actor_{key}", name: "{esc(skr)}", level: {lv}, motion: "{motion}", description: "{esc(desc)}", layers: [{", ".join(ls)}] }},')
    lines += ['  ],', '  partyPixel: [']
    for key, kr, chip, cell, pm, ms, skills in classes:
        lines.append(f'    {{ chip: "{chip}", cell: {cell}, motion: "{pm}", idleFrameMs: {ms} }},')
    lines += ['  ]', '};']
    (ROOT / f'src/assets/retroRosterSkills/{batch}.ts').write_text('\n'.join(lines) + '\n', encoding='utf8')
    missing = sorted(k for k in new if not (fx / f'{k}.png').exists())
    print(batch, 'skills', sum(len(c[6]) for c in classes), 'new sheets', len(new), 'not drawn yet', missing)


if __name__ == '__main__':
    emit('b3', 'Monster1 8', CLASSES)

