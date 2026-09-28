"""b1(Animal 8) 묶음 파일 src/assets/retroRosterSkills/b1.ts 를 표에서 생성한다.
표를 고치고 `python3 scripts/asset-gen/pixel-fx/gen_r2w5_b1_ts.py` 를 다시 돌리면 TS 가 갱신된다.
스킬 8개 = 레벨 1·3·5·7·10·12·16·22(마지막은 motion finisher). 새 이펙트 시트 키는 <classKey>_<뜻>.
레이어 표기: key:anchor:frame:frames (anchor 약어 t=target u=user at=allTargets aa=allAllies s=screen p=projectile)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
A = {'t': 'target', 'u': 'user', 'at': 'allTargets', 'aa': 'allAllies', 's': 'screen', 'p': 'projectile'}

# (classKey, classId 접미, 한글 이름, chip, cell, partyMotion, idleMs) + 스킬 8개
# 스킬: (이름 id, 한글 이름, level, motion, 설명, [레이어...])
CLASSES = [
    ('dog', 'animal-0', 48, 'dash', 170, [
        ('bite', '물어뜯기', 1, 'dash-strike', '송곳니로 적을 덥석 물어뜯는다', ['dog_bite:t:64:8']),
        ('bark', '우렁찬 짖음', 3, 'cast', '짖는 소리의 충격파로 적의 기세를 꺾는다', ['dog_bark_wave:p:32:4', 'dog_bark_hit:t:64:8']),
        ('loyal', '충성 맹세', 5, 'buff', '주인을 지키겠다는 충성심이 아군 전체를 감싼다', ['dog_loyal:aa:64:10']),
        ('scratch', '앞발 긁기', 7, 'flurry', '앞발로 정신없이 할퀴어 흙먼지를 일으킨다', ['dog_scratch:t:64:8']),
        ('tackle', '덮치기', 10, 'leap-strike', '높이 뛰어올라 온몸으로 덮쳐 눕힌다', ['dog_tackle:t:64:9']),
        ('tail_whirl', '꼬리 돌개바람', 12, 'spin', '꼬리를 휘돌려 흙바람으로 적진을 쓸어낸다', ['dog_whirl:at:64:10']),
        ('bone', '뼈다귀 투척', 16, 'shoot', '물고 있던 뼈다귀를 빙글 돌려 던진다', ['dog_bone:p:32:4', 'dog_bone_hit:t:64:8']),
        ('howl', '달빛 포효', 22, 'finisher', '보름달 아래 늑대의 혼을 불러 울부짖는 필살기', ['dog_howl_sky:s:128:12', 'dog_howl_hit:at:64:8']),
    ]),
    ('cat', 'animal-1', 48, 'dash', 150, [
        ('claw', '냥냥 할퀴기', 1, 'flurry', '재빠른 앞발로 여러 번 할퀸다', ['cat_claw:t:64:8']),
        ('jab', '고양이 잽', 3, 'dash-strike', '앞발 잽으로 톡톡 두들겨 정신을 빼놓는다', ['cat_jab:t:64:8']),
        ('afterimage', '잔상 회피', 5, 'buff', '잔상을 남기며 몸놀림을 가볍게 한다', ['cat_afterimage:u:64:8']),
        ('hairball', '털뭉치 발사', 7, 'shoot', '뭉친 털을 뱉어 적의 눈앞에서 터뜨린다', ['cat_hairball:p:32:4', 'cat_hairball_hit:t:64:8']),
        ('hiss', '하악질', 10, 'cast', '날카로운 하악질에 적 전체의 기가 꺾인다', ['cat_hiss:at:64:8']),
        ('pounce', '낙하 급습', 12, 'leap-strike', '높은 곳에서 뛰어내려 발톱으로 낚아챈다', ['cat_pounce:t:64:10']),
        ('nine_lives', '아홉 목숨', 16, 'buff', '아홉 개의 영혼이 감싸 체력을 되살린다', ['cat_nine_lives:u:64:12']),
        ('frenzy', '고양이 광란', 22, 'finisher', '달밤에 수십 발톱이 화면을 가르는 필살기', ['cat_frenzy_sky:s:128:12', 'cat_frenzy_hit:at:64:8']),
    ]),
    ('rooster', 'animal-2', 48, 'swoop', 200, [
        ('peck', '쪼기 연타', 1, 'flurry', '부리로 쉴 새 없이 쪼아 댄다', ['rooster_peck:t:64:8']),
        ('dawn', '새벽 울음', 3, 'buff', '새벽을 여는 울음으로 아군 전체의 기력을 깨운다', ['rooster_dawn:aa:64:10']),
        ('wing_gust', '날개 후려치기', 5, 'spin', '날개를 펼쳐 회오리를 일으켜 적진을 쓸어낸다', ['rooster_gust:at:64:9']),
        ('spur', '며느리발톱 차기', 7, 'dash-strike', '뾰족한 며느리발톱으로 걷어찬다', ['rooster_spur:t:64:8']),
        ('egg', '달걀 폭탄', 10, 'shoot', '갓 낳은 달걀을 던져 노른자를 터뜨린다', ['rooster_egg:p:32:4', 'rooster_egg_burst:t:64:8']),
        ('comb', '붉은 볏 세우기', 12, 'buff', '볏을 활활 세워 투지를 불태운다', ['rooster_comb:u:64:10']),
        ('flame_crow', '불꽃 울음', 16, 'cast', '불타는 울음소리가 적진을 휩쓴다', ['rooster_flame_crow:at:64:10']),
        ('sunrise', '일출', 22, 'finisher', '떠오르는 태양과 함께 우는 필살기', ['rooster_sunrise:s:128:12', 'rooster_sunrise_hit:at:64:8']),
    ]),
    ('sheep', 'animal-3', 48, 'dash', 240, [
        ('ram', '박치기', 1, 'dash-strike', '뿔 달린 머리로 힘껏 들이받는다', ['sheep_ram:t:64:8']),
        ('wool_guard', '털 방어', 3, 'buff', '두툼한 털을 부풀려 방어를 단단히 한다', ['sheep_wool_guard:u:64:10']),
        ('count', '양 세기', 5, 'cast', '울타리를 넘는 양의 환영으로 적을 재운다', ['sheep_count:t:64:12']),
        ('wool_ball', '털뭉치 투척', 7, 'shoot', '뭉친 털을 던져 푹신하게 터뜨린다', ['sheep_wool_ball:p:32:4', 'sheep_wool_hit:t:64:8']),
        ('baa', '매에에', 10, 'cast', '귀를 찢는 울음으로 적 전체를 어지럽힌다', ['sheep_baa:at:64:8']),
        ('roll', '털공 구르기', 12, 'spin', '몸을 말아 굴러 적진을 짓누른다', ['sheep_roll:at:64:10']),
        ('cloud', '구름 이불', 16, 'cast', '포근한 구름이 아군 전체를 치유한다', ['sheep_cloud:aa:64:10']),
        ('dream', '꿈나라 행진', 22, 'finisher', '무수한 양이 꿈의 하늘을 가로지르는 필살기', ['sheep_dream_sky:s:128:12', 'sheep_dream_hit:at:64:8']),
    ]),
    ('cow', 'animal-4', 64, 'stomp', 320, [
        ('gore', '뿔 받기', 1, 'dash-strike', '뿔로 받아 적을 들어 올린다', ['cow_gore:t:64:8']),
        ('milk', '신선한 우유', 3, 'cast', '갓 짠 우유가 튀어 아군 하나를 치유한다', ['cow_milk:t:64:10']),
        ('ruminate', '되새김 휴식', 5, 'buff', '느긋이 되새김하며 방어를 굳힌다', ['cow_ruminate:u:64:10']),
        ('stomp', '발굽 짓밟기', 7, 'leap-strike', '육중한 발굽으로 땅을 굴러 적을 짓밟는다', ['cow_stomp:at:64:10']),
        ('milk_jet', '우유 물총', 10, 'shoot', '우유를 세차게 뿜어 적을 밀어낸다', ['cow_jet:p:32:4', 'cow_jet_hit:t:64:8']),
        ('tail_whip', '꼬리 채찍', 12, 'spin', '굵은 꼬리를 휘둘러 적진을 후려친다', ['cow_tail:at:64:8']),
        ('pasture', '푸른 목장', 16, 'cast', '들꽃 핀 목장의 기운이 아군 전체를 치유한다', ['cow_pasture:aa:64:12']),
        ('stampede', '대돌진', 22, 'finisher', '뿔 달린 무리가 흙먼지를 일으키며 쓸어버리는 필살기', ['cow_stampede_sky:s:128:12', 'cow_stampede_hit:at:64:8']),
    ]),
    ('horse', 'animal-5', 64, 'dash', 170, [
        ('charge', '질주 박치기', 1, 'dash-strike', '전속력으로 달려 가슴으로 들이받는다', ['horse_charge:t:64:8']),
        ('kick', '뒷발 걷어차기', 3, 'leap-strike', '뛰어올라 두 뒷발로 걷어찬다', ['horse_kick:t:64:8']),
        ('gallop', '질풍 갈기', 5, 'buff', '바람을 가르는 기세로 몸놀림이 빨라진다', ['horse_gallop:u:64:8']),
        ('neigh', '전장의 울음', 7, 'cast', '길게 우는 소리가 아군의 사기를 북돋는다', ['horse_neigh:aa:64:10']),
        ('trample', '발굽 연타', 10, 'flurry', '앞발굽으로 쉴 새 없이 짓밟는다', ['horse_trample:t:64:8']),
        ('whirl', '회전 질주', 12, 'spin', '적진을 빙글 돌며 발굽으로 쓸어낸다', ['horse_whirl:at:64:10']),
        ('thunder_mane', '뇌운 갈기', 16, 'cast', '번개를 두른 갈기가 적 전체를 내리친다', ['horse_thunder_mane:at:64:8']),
        ('pegasus', '천마 강림', 22, 'finisher', '빛의 날개를 편 천마가 하늘에서 내달리는 필살기', ['horse_pegasus_sky:s:128:12', 'horse_pegasus_hit:at:64:8']),
    ]),
    ('tiger', 'animal-6', 64, 'dash', 170, [
        ('claw', '발톱 베기', 1, 'dash-strike', '굵은 발톱으로 세 줄기를 그으며 벤다', ['tiger_claw:t:64:8']),
        ('roar', '맹수의 포효', 3, 'cast', '포효의 충격파가 적 전체를 움츠러들게 한다', ['tiger_roar:at:64:8']),
        ('instinct', '사냥 본능', 5, 'buff', '줄무늬가 타오르며 공격 본능이 깨어난다', ['tiger_instinct:u:64:10']),
        ('fang', '송곳니 물기', 7, 'flurry', '송곳니로 물고 놓지 않아 거듭 문다', ['tiger_fang:t:64:9']),
        ('pounce', '매복 덮치기', 10, 'leap-strike', '몸을 낮췄다 튀어올라 온몸으로 덮친다', ['tiger_pounce:t:64:10']),
        ('whirl', '회전 발톱', 12, 'spin', '몸을 비틀어 회전하며 발톱으로 적진을 벤다', ['tiger_whirl:at:64:10']),
        ('bolt', '백호 뇌격', 16, 'shoot', '줄무늬 번개 덩어리를 쏘아 보낸다', ['tiger_bolt:p:32:4', 'tiger_bolt_hit:t:64:8']),
        ('king', '호왕 강림', 22, 'finisher', '거대한 호랑이 혼이 포효하며 적진을 찢는 필살기', ['tiger_king_sky:s:128:12', 'tiger_king_hit:at:64:8']),
    ]),
    ('lion', 'animal-7', 64, 'dash', 180, [
        ('swipe', '발톱 후려치기', 1, 'dash-strike', '황금빛 앞발로 힘껏 후려친다', ['lion_swipe:t:64:8']),
        ('roar', '왕의 포효', 3, 'cast', '왕의 포효가 적 전체를 얼어붙게 한다', ['lion_roar:at:64:10']),
        ('mane', '갈기 곤두세우기', 5, 'buff', '갈기를 불꽃처럼 세워 위엄을 높인다', ['lion_mane:u:64:10']),
        ('maul', '물어 흔들기', 7, 'flurry', '덥석 물고 사납게 흔들어 뜯는다', ['lion_maul:t:64:8']),
        ('pounce', '사냥 도약', 10, 'leap-strike', '멀리서 도약해 앞발로 짓누른다', ['lion_pounce:t:64:10']),
        ('sun_slash', '태양 발톱', 12, 'shoot', '초승달 모양 황금 검기를 날려 보낸다', ['lion_sunwave:p:32:4', 'lion_sunwave_hit:t:64:8']),
        ('pride', '무리의 호령', 16, 'buff', '무리를 이끄는 호령으로 아군 전체가 힘을 얻는다', ['lion_pride:aa:64:10']),
        ('king', '백수의 왕', 22, 'finisher', '태양 관을 쓴 사자왕이 나타나는 필살기', ['lion_king_sky:s:128:12', 'lion_king_hit:at:64:8']),
    ]),
]
LEVELS = [1, 3, 5, 7, 10, 12, 16, 22]
NAMES = {'dog': '충견', 'cat': '고양이', 'rooster': '수탉', 'sheep': '양', 'cow': '젖소', 'horse': '군마', 'tiger': '호랑이', 'lion': '사자'}


def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')


def main():
    lines = []
    lines.append('// 묶음 b1(Animal 8) — 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석, 스킬 형식은 retroClassSkills.ts(RetroClassSkill).')
    lines.append('// 생성: scripts/asset-gen/pixel-fx/gen_r2w5_b1_ts.py (표를 고치고 다시 돌린다). 이펙트 시트 그림: scripts/asset-gen/pixel-fx/r2w5_<동물>.py + <키>.py.')
    lines.append('import type { RetroRosterBatch } from "@/assets/retroRoster";')
    lines.append('')
    lines.append('export const BATCH: RetroRosterBatch = {')
    lines.append('  skills: [')
    for key, chip, cell, pm, ms, skills in CLASSES:
        assert [s[2] for s in skills] == LEVELS, key
        assert skills[-1][3] == 'finisher' and len({s[3] for s in skills}) >= 4, key
        lines.append(f'    // ── {NAMES[key]} ({chip}) ──')
        for name, kr, lv, motion, desc, layers in skills:
            ls = []
            for L in layers:
                k, a, fr, n = L.split(':')
                ls.append(f'{{ key: "{k}", anchor: "{A[a]}", frame: {fr}, frames: {n} }}')
            lines.append(f'    {{ id: "skill_{key}_{name}", classId: "class_{key}", actorId: "actor_{key}", name: "{esc(kr)}", level: {lv}, motion: "{motion}", description: "{esc(desc)}", layers: [{", ".join(ls)}] }},')
    lines.append('  ],')
    lines.append('  partyPixel: [')
    for key, chip, cell, pm, ms, skills in CLASSES:
        lines.append(f'    {{ chip: "{chip}", cell: {cell}, motion: "{pm}", idleFrameMs: {ms} }},')
    lines.append('  ]')
    lines.append('};')
    (ROOT / 'src/assets/retroRosterSkills/b1.ts').write_text('\n'.join(lines) + '\n', encoding='utf8')
    n = sum(len(c[5]) for c in CLASSES)
    keys = {L.split(':')[0] for c in CLASSES for s in c[5] for L in s[5]}
    print('skills', n, 'fx sheets', len(keys))


if __name__ == '__main__':
    main()
