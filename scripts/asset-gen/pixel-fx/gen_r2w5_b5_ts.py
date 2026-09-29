"""b5(Monster3 8) 묶음 파일 src/assets/retroRosterSkills/b5.ts 를 표에서 생성한다. 규칙·검사는 gen_r2w5_b3_ts.emit 과 같다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_r2w5_b3_ts import emit

CLASSES = [
    ('siren', '세이렌', 'monster3-0', 48, 'swoop', 150, [
        ('talon', '발톱 급습', 1, 'dash-strike', '날아들어 새 발톱으로 할퀸다', ['mon_claw_rake:t:64:8']),
        ('song', '유혹의 노래', 3, 'cast', '달콤한 노랫소리가 적 전원을 잠재운다', ['bard_notes_blue:at:64:10']),
        ('shriek', '고음 파열', 5, 'shoot', '귀를 찢는 고음을 쏘아 친다', ['bard_sonic_wave:p:32:4', 'bard_sonic_hit:t:64:8']),
        ('charm', '매혹', 7, 'cast', '분홍 음표로 적을 홀려 한편을 치게 한다', ['siren_charm:t:64:10']),
        ('feather', '깃털 폭풍', 10, 'spin', '날개를 휘돌려 깃털 칼날을 흩뿌린다', ['mon_gale_screen:s:128:8', 'scout_knife_hit:at:64:8']),
        ('tide', '밀물의 노래', 12, 'cast', '바닷물이 밀려와 적진을 삼킨다', ['mon_wave_screen:s:128:10', 'ninja_splash:at:64:8']),
        ('hymn', '바다의 찬가', 16, 'buff', '잔잔한 노래가 아군 전체를 치유한다', ['bard_hymn:aa:64:10']),
        ('aria', '침몰의 아리아', 22, 'finisher', '폭풍 바다 위 거대한 노래가 배를 가라앉히는 필살기', ['siren_aria_sky:s:128:12', 'bard_sonic_hit:at:64:8']),
    ]),
    ('lamia', '라미아', 'monster3-1', 64, 'dash', 200, [
        ('fang', '독니', 1, 'dash-strike', '뱀처럼 몸을 뻗어 독니를 박는다', ['mon_sting:t:64:8']),
        ('coil', '휘감기', 3, 'dash-strike', '긴 꼬리로 적을 휘감아 조인다', ['lamia_coil:t:64:10']),
        ('tail', '꼬리 채찍', 5, 'spin', '꼬리를 크게 휘둘러 적진을 후려친다', ['monk_whirl_kick:at:64:10']),
        ('venom', '독 안개', 7, 'cast', '독 안개를 퍼뜨려 적 전원을 중독시킨다', ['mon_spore_cloud:at:64:10']),
        ('gaze', '석화의 눈', 10, 'cast', '뱀의 눈으로 노려봐 몸을 굳힌다', ['mon_gaze_screen:s:128:8', 'weaken:at:64:8']),
        ('shed', '허물 벗기', 12, 'buff', '낡은 허물을 벗고 새 비늘로 회복한다', ['druid_regrowth:u:64:10']),
        ('spit', '독액 뱉기', 16, 'shoot', '산성 독액을 뱉어 적을 녹인다', ['mon_acid_blob:p:32:4', 'witch_poison_hit:t:64:8']),
        ('serpent', '대사(大蛇) 강림', 22, 'finisher', '거대한 뱀의 혼이 똬리를 틀어 적을 조이는 필살기', ['lamia_serpent_sky:s:128:12', 'mon_bandage_wrap:at:64:10']),
    ]),
    ('wraith_mage', '망령술사', 'monster3-2', 48, 'float', 240, [
        ('soul_bolt', '영혼탄', 1, 'shoot', '창백한 영혼 덩이를 쏘아 보낸다', ['witch_drain_orb:p:32:4', 'mon_ray_hit:t:64:8']),
        ('drain', '영혼 흡수', 3, 'cast', '적의 영혼을 빨아 제 기운으로 삼는다', ['wraith_mage_drain:t:64:10']),
        ('curse', '망령의 저주', 5, 'cast', '해골 저주로 적의 힘을 깎는다', ['mon_curse_skull:t:64:10']),
        ('veil', '어둠의 장막', 7, 'buff', '검은 장막을 둘러 마법을 막는다', ['witch_mirror:u:64:10']),
        ('frost', '명계의 냉기', 10, 'cast', '명계의 찬 기운이 적 전원을 얼린다', ['mon_frost_burst:at:64:8']),
        ('grasp', '망자의 손', 12, 'spin', '영혼들을 소용돌이치게 해 적진을 휘감는다', ['mon_dark_crater:at:64:10']),
        ('wail', '망령의 곡소리', 16, 'cast', '망령의 울음이 하늘을 덮고 적을 떨게 한다', ['mon_wail_sky:s:128:8', 'witch_nightmare_hit:at:64:8']),
        ('requiem', '영혼 수확제', 22, 'finisher', '수많은 영혼을 불러 모아 터뜨리는 필살기', ['wraith_mage_harvest_sky:s:128:12', 'mon_dark_burn:at:64:8']),
    ]),
    ('succubus', '서큐버스', 'monster3-3', 48, 'swoop', 140, [
        ('claw', '손톱 할퀴기', 1, 'dash-strike', '날아들어 긴 손톱으로 할퀸다', ['mon_backstab_slash:t:64:8']),
        ('kiss', '입맞춤', 3, 'shoot', '하트를 날려 적을 홀린다', ['succubus_kiss:p:32:4', 'sleep:t:64:8']),
        ('drain', '흡정', 5, 'cast', '적의 생기를 빨아 제 체력을 채운다', ['witch_drain_beam:t:64:10']),
        ('whip', '꼬리 채찍', 7, 'flurry', '뾰족한 꼬리로 연달아 찌른다', ['scout_flurry:t:64:10']),
        ('bats', '박쥐 떼', 10, 'cast', '박쥐 떼를 불러 적 전원을 물게 한다', ['witch_bat_swarm:at:64:10']),
        ('allure', '매혹의 향기', 12, 'cast', '분홍 안개가 적 전원을 흐리게 한다', ['weaken:at:64:8']),
        ('dance', '밤의 무도', 16, 'spin', '날개를 펴고 빙글 돌며 적진을 벤다', ['samurai_petals:s:128:8', 'mon_backstab_slash:at:64:8']),
        ('eclipse', '달그림자 연회', 22, 'finisher', '검은 달 아래 매혹의 연회를 여는 필살기', ['witch_sabbath_sky:s:128:12', 'witch_sabbath_hit:at:64:10']),
    ]),
    ('mound', '개미귀신', 'monster3-4', 64, 'stomp', 340, [
        ('snap', '턱 물기', 1, 'dash-strike', '흙더미 속 집게 턱으로 덥석 문다', ['mon_devour_jaws:t:64:10']),
        ('sand', '모래 뿌리기', 3, 'shoot', '모래 덩이를 뱉어 눈을 가린다', ['mon_smoke_bomb:p:32:4', 'mon_smoke_cloud:t:64:8']),
        ('shell', '흙 껍질', 5, 'buff', '흙을 두껍게 덮어 방어를 굳힌다', ['mon_shell_barrier:u:64:8']),
        ('pit', '모래 늪', 7, 'cast', '적 발밑을 모래 늪으로 바꿔 끌어당긴다', ['mound_pit:at:64:10']),
        ('burrow', '땅속 습격', 10, 'leap-strike', '땅속으로 파고들었다가 적 밑에서 솟구친다', ['earth:t:64:8']),
        ('boulder', '바위 토하기', 12, 'shoot', '삼킨 바위를 토해 던진다', ['mon_boulder:p:32:4', 'mon_rock_burst:t:64:8']),
        ('quake', '지반 붕괴', 16, 'leap-strike', '몸을 들썩여 땅을 무너뜨린다', ['mon_quake_crack:at:64:10']),
        ('maw', '대지의 아가리', 22, 'finisher', '사막이 통째로 거대한 아가리가 되어 삼키는 필살기', ['mound_maw_sky:s:128:12', 'mon_rock_burst:at:64:8']),
    ]),
    ('red_dragon_pal', '새끼 화룡', 'monster3-5', 64, 'breath', 260, [
        ('bite', '물어뜯기', 1, 'dash-strike', '작은 송곳니로 힘껏 문다', ['mon_fang_bite:t:64:8']),
        ('ember', '불씨 뱉기', 3, 'shoot', '입에서 불씨를 톡 뱉는다', ['mage_fireball_orb:p:32:4', 'fire:t:64:8']),
        ('breath', '화염 브레스', 5, 'cast', '숨을 모아 불길을 길게 뿜는다', ['mon_fire_breath:s:128:10', 'mon_burn:at:64:8']),
        ('scale', '용린', 7, 'buff', '빛나는 비늘 방패를 세워 방어를 굳힌다', ['guard_holy_shield:u:64:10']),
        ('tail', '꼬리 휘두르기', 10, 'spin', '꼬리를 휘둘러 적진을 후려친다', ['monk_whirl_kick:at:64:10']),
        ('wing', '날개 돌풍', 12, 'leap-strike', '날아올라 날개 바람과 함께 내리찍는다', ['hero_meteor_impact:t:128:10']),
        ('pillar', '화염 기둥', 16, 'cast', '적 전원의 발밑에서 불기둥이 솟는다', ['mon_flame_pillar:at:64:10']),
        ('dragon', '화룡 각성', 22, 'finisher', '어미 용의 혼이 깨어나 불바다를 만드는 필살기', ['red_dragon_pal_awaken_sky:s:128:12', 'mage_meteor_blast:at:64:10']),
    ]),
    ('flame_spirit', '업화', 'monster3-6', 48, 'float', 160, [
        ('flare', '불꽃 튀기', 1, 'dash-strike', '불꽃 몸으로 부딪쳐 태운다', ['mage_fire_burst:t:64:10']),
        ('fireball', '화염구', 3, 'shoot', '몸에서 떼어 낸 불덩이를 던진다', ['ranger_fire_arrow:p:32:4', 'ranger_fire_hit:t:64:8']),
        ('heat', '열기', 5, 'buff', '불꽃을 키워 공격을 끌어올린다', ['hero_flame_aura:u:64:6']),
        ('burn', '작열', 7, 'cast', '적 전원을 뜨거운 불꽃으로 감싼다', ['mon_burn:at:64:8']),
        ('whirl', '불꽃 회오리', 10, 'spin', '불꽃 소용돌이가 되어 적진 발밑을 태운다', ['mon_flame_pillar:at:64:10']),
        ('hellfire', '지옥불', 12, 'cast', '보라 불꽃으로 적을 저주한다', ['mon_hex_flame:at:64:10']),
        ('meteor', '불비', 16, 'cast', '하늘에서 불타는 돌을 쏟아붓는다', ['mage_meteor_rock:p:32:4', 'mage_meteor_blast:at:64:10']),
        ('nova', '업화 폭발', 22, 'finisher', '몸을 태양처럼 부풀려 터뜨리는 필살기', ['flame_spirit_nova_sky:s:128:12', 'mon_burn:at:64:8']),
    ]),
    ('demon_general', '마장군', 'monster3-7', 64, 'stomp', 300, [
        ('cleave', '암흑 베기', 1, 'dash-strike', '보랏빛 대검으로 크게 벤다', ['mon_cleave_arc:t:64:10']),
        ('dark_wave', '암흑파', 3, 'shoot', '검을 휘둘러 암흑 검기를 날린다', ['samurai_wind_wave:p:32:4', 'mon_dark_burn:t:64:8']),
        ('command', '마군 호령', 5, 'buff', '호령으로 아군의 사기를 끌어올린다', ['mon_howl_ring:aa:64:8']),
        ('aura', '마기 해방', 7, 'buff', '몸에서 검은 마기를 뿜어 힘을 올린다', ['mon_demon_aura:u:64:8']),
        ('rush', '마검 연참', 10, 'flurry', '대검으로 쉴 새 없이 벤다', ['samurai_moon:t:64:10']),
        ('whirl', '회전 대검', 12, 'spin', '대검을 크게 돌려 적진을 쓸어 벤다', ['hero_whirl:at:64:10']),
        ('crater', '마계 강하', 16, 'leap-strike', '뛰어올라 대검으로 땅을 꿰뚫는다', ['mon_dark_crater:at:64:10']),
        ('apocalypse', '종말의 검', 22, 'finisher', '하늘을 가르는 거대한 암흑 대검이 떨어지는 필살기', ['demon_general_doom_sky:s:128:12', 'mon_dark_crater:at:64:10']),
    ]),
]

if __name__ == '__main__':
    emit('b5', 'Monster3 8', CLASSES)

