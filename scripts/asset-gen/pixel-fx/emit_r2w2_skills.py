"""retro2003 2차 로스터 묶음 스킬표 → src/assets/retroRosterSkills/<batch>.ts 생성기 (r2w2: a3, p1).

    python3 scripts/asset-gen/pixel-fx/emit_r2w2_skills.py [a3 p1]

표가 정본이 아니라 **생성된 .ts 가 계약**이다(이펙트 생성기가 .ts 를 읽어 frame·frames·anchor 를 검사한다).
스킬 8개 = 레벨 1·3·5·7·10·12·16·22(22 는 motion finisher). 직업마다 motion 4종 이상, 주된 층은 스킬 고유의 새 시트.
layers 항목: (key, anchor, frame, frames).  partyPixel 은 사람형이라 비운다.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'src/assets/retroRosterSkills'
LEVELS = [1, 3, 5, 7, 10, 12, 16, 22]

# batch -> [(classId, classKey, [(name_id, 한글 이름, motion, 설명, [(layerKey, anchor, frame, frames), ...]), ...×8])]
BATCHES = {}

BATCHES['a3'] = [
 ('class_berserker', 'berserker', [
  ('rage_smash', '분노의 일격', 'dash-strike', '양손 도끼를 머리 위로 들었다 내리찍어 적을 쪼갠다', [('berserker_smash', 'target', 64, 8)]),
  ('blood_roar', '피의 함성', 'buff', '핏발 선 함성으로 광기를 끌어올려 공격력을 높인다', [('berserker_roar', 'user', 64, 8)]),
  ('axe_whirl', '회전 도끼', 'spin', '도끼를 쥔 채 적진 한가운데서 팽이처럼 돌며 벤다', [('berserker_whirl', 'allTargets', 64, 10)]),
  ('leap_crash', '도약 강타', 'leap-strike', '높이 뛰어올라 땅이 갈라지도록 내려찍는다', [('berserker_crash', 'target', 64, 9)]),
  ('rend', '살점 베기', 'flurry', '도끼날로 세 번 할퀴듯 찢어 출혈을 입힌다', [('berserker_rend', 'target', 64, 8)]),
  ('frenzy', '광란', 'buff', '핏줄이 터질 듯한 분노에 잠겨 공격을 크게 올린다', [('berserker_frenzy', 'user', 64, 10)]),
  ('axe_throw', '투척 도끼', 'shoot', '빙글빙글 도는 도끼를 던져 멀리서 찍는다', [('berserker_axe_spin', 'projectile', 32, 4), ('berserker_axe_hit', 'target', 64, 8)]),
  ('massacre', '학살의 폭풍', 'finisher', '핏빛 폭풍 속에서 닥치는 대로 쪼개는 필살기', [('berserker_doom', 'screen', 128, 12), ('berserker_doom_hit', 'target', 64, 8)]),
 ]),
 ('class_gunner', 'gunner', [
  ('shot', '조준 사격', 'shoot', '한 발을 정확히 쏘아 적의 급소를 맞힌다', [('gunner_bullet', 'projectile', 32, 4), ('gunner_bullet_hit', 'target', 64, 6)]),
  ('rapid_fire', '연사', 'shoot', '손이 안 보일 만큼 빠르게 세 발을 잇달아 쏜다', [('gunner_burst', 'projectile', 32, 4), ('gunner_pocks', 'target', 64, 8)]),
  ('snipe', '저격', 'shoot', '조준선으로 한 점을 좁혀 한 발로 꿰뚫는다', [('gunner_scope', 'target', 64, 10)]),
  ('butt_strike', '개머리판 타격', 'dash-strike', '총을 거꾸로 쥐고 달려들어 개머리판으로 후려친다', [('gunner_butt', 'target', 64, 8)]),
  ('grenade', '수류탄', 'shoot', '포물선으로 던진 수류탄이 적진 한복판에서 터진다', [('gunner_grenade_spin', 'projectile', 32, 4), ('gunner_grenade_blast', 'allTargets', 64, 10)]),
  ('flare', '신호탄', 'buff', '하늘에 신호탄을 쏘아 올려 아군의 명중을 높인다', [('gunner_flare', 'screen', 128, 10)]),
  ('spin_fire', '회전 난사', 'spin', '한 바퀴 돌며 사방으로 탄환을 뿌린다', [('gunner_spinfire', 'allTargets', 64, 10)]),
  ('volley', '마탄의 일제사격', 'finisher', '하늘을 가르는 탄막을 내리꽂는 필살기', [('gunner_volley', 'screen', 128, 12), ('gunner_volley_hit', 'target', 64, 8)]),
 ]),
 ('class_dancer', 'dancer', [
  ('ribbon_lash', '리본 채찍', 'flurry', '긴 리본을 휘감아 여러 번 후려친다', [('dancer_ribbon', 'target', 64, 8)]),
  ('charm', '매혹의 눈짓', 'cast', '한 번 던진 눈짓으로 적을 홀려 넋을 빼놓는다', [('dancer_charm', 'target', 64, 8)]),
  ('war_dance', '전투의 춤', 'buff', '북소리에 맞춰 춤추며 아군 전체의 공격을 올린다', [('dancer_wardance', 'allAllies', 64, 10)]),
  ('pirouette', '회전무', 'spin', '부채를 펼친 채 빙글 돌아 적진에 꽃바람을 일으킨다', [('dancer_pirouette', 'allTargets', 64, 10)]),
  ('moon_waltz', '달빛 왈츠', 'buff', '달빛 아래 왈츠로 아군 전체의 몸을 가볍게 한다', [('dancer_waltz', 'allAllies', 64, 10)]),
  ('afterimage', '잔상무', 'blink-strike', '잔상만 남기고 사라졌다 적 뒤에서 나타나 벤다', [('dancer_afterimage', 'target', 64, 8)]),
  ('fire_fan', '불꽃 부채', 'cast', '불을 머금은 부채를 휘저어 초승달 불꽃을 날린다', [('dancer_fanwave', 'projectile', 32, 4), ('dancer_fanburn', 'target', 64, 8)]),
  ('grand_ball', '천상의 무도회', 'finisher', '무대 조명과 꽃비 속에서 펼치는 필살의 춤', [('dancer_curtain', 'screen', 128, 12), ('dancer_grand_glow', 'allAllies', 64, 8)]),
 ]),
 ('class_alchemist', 'alchemist', [
  ('acid_flask', '산성 플라스크', 'shoot', '초록 약병을 던져 적을 녹이는 산성 액을 뿌린다', [('alchemist_flask', 'projectile', 32, 4), ('alchemist_acid_splash', 'target', 64, 8)]),
  ('elixir', '회복 영약', 'cast', '거품이 이는 푸른 영약을 아군에게 끼얹어 치유한다', [('alchemist_elixir', 'target', 64, 8)]),
  ('bomb', '연금 폭탄', 'shoot', '심지가 타는 검은 폭탄을 던져 폭발시킨다', [('alchemist_bomb_fuse', 'projectile', 32, 4), ('alchemist_bomb_blast', 'target', 64, 10)]),
  ('transmute', '등가 교환', 'buff', '금빛 연성진을 그려 아군의 방어를 새로 빚어낸다', [('alchemist_transmute', 'allAllies', 64, 10)]),
  ('vial_barrage', '연속 투척', 'flurry', '색색의 약병을 한 손에 쥐고 줄줄이 던져 깨뜨린다', [('alchemist_vials', 'target', 64, 10)]),
  ('stimulant', '촉진제', 'buff', '끓어오르는 붉은 약을 마셔 몸을 달군다', [('alchemist_stimulant', 'user', 64, 8)]),
  ('toxic_cloud', '독무', 'cast', '보랏빛 독 안개를 적진 전체에 피워 올린다', [('alchemist_toxic', 'allTargets', 64, 10)]),
  ('philosopher', '현자의 돌', 'finisher', '붉은 돌이 깨어나 연성진을 타고 폭주하는 필살기', [('alchemist_stone', 'screen', 128, 12), ('alchemist_stone_hit', 'target', 64, 8)]),
 ]),
 ('class_summoner', 'summoner', [
  ('imp_call', '불의 정령', 'cast', '소환진에서 불정령을 불러내 적에게 부딪히게 한다', [('summoner_imp', 'target', 64, 8)]),
  ('ward_spirit', '수호령', 'buff', '빛의 수호령을 불러 아군 전체를 날개로 감싼다', [('summoner_ward', 'allAllies', 64, 10)]),
  ('thunderbird', '천둥새', 'cast', '번개를 두른 새를 불러 적을 향해 급강하시킨다', [('summoner_thunderbird', 'target', 64, 10)]),
  ('hellhound', '지옥견', 'cast', '소환진에서 뛰쳐나온 지옥의 사냥개가 적을 물어뜯는다', [('summoner_hound', 'target', 64, 8)]),
  ('spirit_lance', '정령 창', 'shoot', '창 모양의 정령을 날려 꿰뚫는다', [('summoner_lance', 'projectile', 32, 4), ('summoner_lance_hit', 'target', 64, 8)]),
  ('sylph', '바람 요정', 'buff', '바람 요정 무리를 불러 아군의 상처를 씻어 준다', [('summoner_sylph', 'allAllies', 64, 10)]),
  ('golem_fist', '거인의 주먹', 'leap-strike', '소환진 위로 솟은 바위 거인의 주먹이 내리찍는다', [('summoner_golem', 'target', 64, 10)]),
  ('dragon_call', '용신 강림', 'finisher', '하늘의 문이 열려 용신이 내려와 모든 것을 삼키는 필살기', [('summoner_dragon', 'screen', 128, 12), ('summoner_dragon_hit', 'allTargets', 64, 8)]),
 ]),
 ('class_squire', 'squire', [
  ('overhead', '내려베기', 'dash-strike', '검을 크게 들어 곧게 내려친다', [('squire_chop', 'target', 64, 8)]),
  ('shield_up', '방패 들기', 'buff', '작은 방패를 곧추세워 방어를 올린다', [('squire_shield', 'user', 64, 8)]),
  ('triple_cut', '삼연격', 'flurry', '연습한 대로 세 번 빠르게 벤다', [('squire_combo', 'target', 64, 8)]),
  ('brave_shout', '용기의 외침', 'buff', '깃발을 치켜들고 외쳐 아군의 사기를 올린다', [('squire_courage', 'allAllies', 64, 10)]),
  ('leap_cut', '도약 베기', 'leap-strike', '뛰어올라 몸무게를 실어 내리벤다', [('squire_leap', 'target', 64, 9)]),
  ('shield_rush', '방패 돌진', 'dash-strike', '방패를 앞세워 부딪쳐 적을 휘청이게 한다', [('squire_rush', 'target', 64, 8)]),
  ('spin_cut', '회전 베기', 'spin', '제자리에서 한 바퀴 돌며 주변의 적을 벤다', [('squire_whirl', 'allTargets', 64, 10)]),
  ('knighting', '기사 서임', 'finisher', '빛의 검이 어깨에 내려앉아 기사로 다시 태어나는 필살기', [('squire_knighting', 'screen', 128, 12), ('squire_knighting_hit', 'target', 64, 8)]),
 ]),
 ('class_flower_girl', 'flower_girl', [
  ('petal_heal', '꽃잎 치유', 'cast', '분홍 꽃잎이 아군을 감싸 돌며 상처를 낫게 한다', [('flower_girl_petal_heal', 'target', 64, 8)]),
  ('bouquet_toss', '꽃다발 던지기', 'shoot', '꽃다발을 던져 적 앞에서 꽃잎으로 터뜨린다', [('flower_girl_bouquet', 'projectile', 32, 4), ('flower_girl_bouquet_hit', 'target', 64, 8)]),
  ('aroma', '향기', 'buff', '향기로운 바람이 아군 전체를 감싸 기운을 북돋운다', [('flower_girl_aroma', 'allAllies', 64, 10)]),
  ('thorn_vine', '가시 덩굴', 'cast', '장미 덩굴이 땅에서 솟아 적을 옭아맨다', [('flower_girl_thorn', 'target', 64, 8)]),
  ('sunflower', '해바라기', 'buff', '해바라기가 활짝 피어 아군 전체를 따뜻하게 치유한다', [('flower_girl_sunflower', 'allAllies', 64, 10)]),
  ('petal_storm', '꽃보라', 'spin', '꽃잎 회오리로 적진 전체를 휘감아 벤다', [('flower_girl_storm', 'allTargets', 64, 10)]),
  ('wreath', '화관', 'cast', '꽃 화관을 씌워 아군 하나를 지키고 되살린다', [('flower_girl_wreath', 'target', 64, 10)]),
  ('full_bloom', '만개', 'finisher', '온 들판이 한꺼번에 피어나 아군을 살리고 적을 쓸어내는 필살기', [('flower_girl_bloom', 'screen', 128, 12), ('flower_girl_bloom_glow', 'allAllies', 64, 8)]),
 ]),
 ('class_swordsman', 'swordsman', [
  ('flash_slash', '일섬', 'dash-strike', '눈 깜빡할 새 파고들어 한 줄기 빛으로 벤다', [('swordsman_flash', 'target', 64, 8)]),
  ('thrust_flurry', '연속 찌르기', 'flurry', '검끝이 잔상을 그릴 만큼 빠르게 수없이 찌른다', [('swordsman_thrusts', 'target', 64, 8)]),
  ('sword_wave', '검압', 'shoot', '휘두른 검에서 초승달 검기가 날아간다', [('swordsman_wave', 'projectile', 32, 4), ('swordsman_wave_hit', 'target', 64, 8)]),
  ('afterimage_cut', '잔영 베기', 'blink-strike', '잔영을 남기고 사라졌다 적의 등 뒤에서 벤다', [('swordsman_ghost', 'target', 64, 8)]),
  ('whirl_edge', '회전참', 'spin', '검을 수평으로 돌려 사방의 적을 한 번에 벤다', [('swordsman_whirl', 'allTargets', 64, 10)]),
  ('focus', '심안', 'buff', '숨을 고르고 눈을 감아 치명타의 길을 본다', [('swordsman_focus', 'user', 64, 8)]),
  ('thunder_edge', '낙뢰검', 'leap-strike', '검에 번개를 받아 뛰어내리며 내려친다', [('swordsman_thunder', 'target', 64, 9)]),
  ('grand_slash', '천상 연참', 'finisher', '수십 갈래 검격이 하늘 가득 그물을 치는 필살기', [('swordsman_grand', 'screen', 128, 12), ('swordsman_grand_hit', 'target', 64, 8)]),
 ]),
]

BATCHES['p1'] = []  # 아래 p1 표는 p1 단계에서 채운다.


def emit(batch):
    rows = []
    for class_id, key, skills in BATCHES[batch]:
        assert len(skills) == 8, (class_id, len(skills))
        motions = {s[2] for s in skills}
        assert len(motions) >= 4, (class_id, motions)
        assert skills[-1][2] == 'finisher'
        for lv, (nid, name, motion, desc, layers) in zip(LEVELS, skills):
            ls = ', '.join('{ key: "%s", anchor: "%s", frame: %d, frames: %d }' % l for l in layers)
            rows.append('    { id: "skill_%s_%s", classId: "%s", actorId: "actor_%s", name: "%s", level: %d, motion: "%s", description: "%s", layers: [%s] },'
                        % (key, nid, class_id, key, name, lv, motion, desc, ls))
    body = '\n'.join(rows)
    text = f'''// 묶음 {batch} — 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석, 스킬 형식은 retroClassSkills.ts(RetroClassSkill).
// scripts/asset-gen/pixel-fx/emit_r2w2_skills.py 가 생성한다(표 수정 → 재생성). 이펙트 그림은 public/assets/generated/pixel-fx/<key>.png.
import type {{ RetroRosterBatch }} from "@/assets/retroRoster";

export const BATCH: RetroRosterBatch = {{
  skills: [
{body}
  ],
  partyPixel: [],
}};
'''
    (OUT / f'{batch}.ts').write_text(text, encoding='utf8')
    print(batch, len(rows), 'skills')


if __name__ == '__main__':
    for b in (sys.argv[1:] or ['a3']):
        if BATCHES[b]:
            emit(b)
