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

BATCHES['p1'] = [
 ('class_scholar', 'scholar', [
  ('page_cut', '책장 베기', 'cast', '펼친 책에서 날카로운 책장이 날아가 적을 벤다', [('scholar_pages', 'target', 64, 8)]),
  ('analyze', '약점 간파', 'cast', '돋보기 조준선으로 적의 약점을 찾아 방어를 낮춘다', [('scholar_analyze', 'target', 64, 10)]),
  ('lecture', '지식의 강의', 'buff', '떠다니는 글자로 아군 전체의 마법을 북돋는다', [('scholar_runes', 'allAllies', 64, 10)]),
  ('book_smack', '두꺼운 책 강타', 'dash-strike', '두꺼운 사전으로 적의 머리를 내려친다', [('scholar_smack', 'target', 64, 8)]),
  ('formula', '공식 폭발', 'cast', '공중에 적은 수식이 빛나며 적 전체에서 터진다', [('scholar_formula', 'allTargets', 64, 10)]),
  ('study', '밤샘 공부', 'buff', '책을 넘기며 집중해 마력을 끌어모은다', [('focus', 'user', 64, 8)]),
  ('ink_blot', '먹물 폭탄', 'cast', '먹물이 번져 적의 눈을 가린다', [('scholar_ink', 'target', 64, 8)]),
  ('grand_library', '대도서관', 'finisher', '하늘에 책장이 열리며 지식의 빛이 쏟아지는 필살기', [('scholar_library', 'screen', 128, 12), ('mage_star_hit', 'allTargets', 64, 8)]),
 ]),
 ('class_miner', 'miner', [
  ('pick_strike', '곡괭이 찍기', 'dash-strike', '곡괭이 끝으로 적을 힘껏 찍는다', [('miner_pick', 'target', 64, 8)]),
  ('dig', '땅굴 기습', 'blink-strike', '땅속으로 파고들었다가 적 발밑에서 튀어나온다', [('miner_burrow', 'target', 64, 10)]),
  ('rockfall', '낙석', 'cast', '천장을 때려 바위를 모든 적 위에 떨어뜨린다', [('miner_rockfall', 'allTargets', 64, 10)]),
  ('lantern', '광산 등불', 'buff', '등불을 밝혀 아군의 명중을 올린다', [('miner_lantern', 'allAllies', 64, 8)]),
  ('ore_throw', '광석 던지기', 'shoot', '캐낸 광석 덩이를 던져 맞힌다', [('mon_boulder', 'projectile', 32, 4), ('mon_rock_burst', 'target', 64, 8)]),
  ('tunnel_quake', '갱도 진동', 'leap-strike', '뛰어올라 곡괭이를 땅에 박아 모든 적을 흔든다', [('mon_quake_crack', 'allTargets', 64, 10)]),
  ('gem_find', '보석 발견', 'buff', '반짝이는 보석을 캐내 힘을 얻는다', [('miner_gem', 'user', 64, 8)]),
  ('dynamite', '다이너마이트', 'finisher', '갱도를 통째로 날려 버리는 폭파 필살기', [('miner_blast', 'screen', 128, 12), ('mage_meteor_blast', 'allTargets', 64, 10)]),
 ]),
 ('class_farmer', 'farmer', [
  ('fork_thrust', '쇠스랑 찌르기', 'dash-strike', '쇠스랑 세 갈래로 적을 꿰찌른다', [('farmer_fork', 'target', 64, 8)]),
  ('harvest', '수확', 'spin', '낫질하듯 크게 휘둘러 모든 적을 벤다', [('farmer_harvest', 'allTargets', 64, 10)]),
  ('seed_spit', '씨앗 흩뿌리기', 'shoot', '한 줌 씨앗을 뿌려 적에게 따끔하게 박는다', [('farmer_seeds', 'target', 64, 8)]),
  ('hay_bale', '건초 더미', 'buff', '건초를 쌓아 아군을 푹신하게 감싸 방어를 올린다', [('farmer_hay', 'allAllies', 64, 10)]),
  ('turnip', '순무 뽑기', 'leap-strike', '거대한 순무를 뽑아 적에게 내려친다', [('farmer_turnip', 'target', 64, 10)]),
  ('sunlight', '햇볕 쬐기', 'buff', '햇살을 받아 기운을 되찾는다', [('heal', 'user', 64, 8)]),
  ('scarecrow', '허수아비', 'cast', '허수아비를 세워 적들을 겁주어 약하게 만든다', [('farmer_scarecrow', 'allTargets', 64, 8)]),
  ('bumper_crop', '대풍년', 'finisher', '황금 밀밭이 물결치며 적을 휩쓰는 필살기', [('farmer_wheat', 'screen', 128, 12), ('druid_tree_hit', 'allTargets', 64, 10)]),
 ]),
 ('class_elder', 'elder', [
  ('cane_rap', '지팡이 꿀밤', 'dash-strike', '지팡이로 적의 이마를 딱 때린다', [('elder_rap', 'target', 64, 8)]),
  ('wisdom', '노인의 지혜', 'buff', '옛 이야기로 아군 전체의 정신을 맑게 한다', [('elder_wisdom', 'allAllies', 64, 10)]),
  ('scold', '호통', 'cast', '버럭 호통을 쳐 적 전체를 움츠러들게 한다', [('elder_scold', 'allTargets', 64, 8)]),
  ('bless', '마을의 축복', 'cast', '두 손을 모아 아군 하나를 치유한다', [('cleric_heal', 'target', 64, 10)]),
  ('ancestor', '조상의 영혼', 'cast', '조상의 혼령을 불러 적을 꾸짖게 한다', [('elder_spirit', 'target', 64, 10)]),
  ('elder_calm', '느긋한 숨', 'buff', '느긋하게 숨을 골라 방어를 올린다', [('elder_calm', 'user', 64, 8)]),
  ('revive', '되살림', 'cast', '쓰러진 아군을 흔들어 깨워 일으킨다', [('elder_revive', 'target', 64, 12)]),
  ('village_oath', '마을의 맹세', 'finisher', '마을 사람들의 소원이 빛기둥이 되어 적을 누르는 필살기', [('elder_oath', 'screen', 128, 12), ('cleric_judgment_hit', 'allTargets', 64, 8)]),
 ]),
 ('class_grandma', 'grandma', [
  ('herb_heal', '약초 찜질', 'cast', '약초를 덮어 아군 하나를 치유한다', [('grandma_herb', 'target', 64, 10)]),
  ('ladle_whack', '국자 후려치기', 'dash-strike', '국자로 적을 따끔하게 후려친다', [('grandma_ladle', 'target', 64, 8)]),
  ('broth', '보양탕', 'cast', '김이 나는 탕약을 아군 전체에 돌린다', [('grandma_broth', 'allAllies', 64, 10)]),
  ('knit', '뜨개 그물', 'cast', '털실을 풀어 적을 얽어맨다', [('grandma_yarn', 'target', 64, 10)]),
  ('moxa', '뜸', 'buff', '따끈한 뜸으로 몸을 데워 상태이상을 막는다', [('grandma_moxa', 'user', 64, 8)]),
  ('scold_pot', '냄비 뚜껑', 'shoot', '냄비 뚜껑을 원반처럼 던진다', [('grandma_lid', 'target', 64, 8)]),
  ('lullaby', '자장가', 'cast', '옛 자장가로 적 전체를 졸게 한다', [('sleep', 'allTargets', 64, 8)]),
  ('grand_feast', '할머니의 잔칫상', 'finisher', '한 상 가득 차린 음식으로 아군을 완전히 회복시키는 필살기', [('grandma_feast', 'screen', 128, 12), ('cleric_mass_heal', 'allAllies', 64, 10)]),
 ]),
 ('class_gunslinger', 'gunslinger', [
  ('quick_draw', '속사', 'shoot', '눈 깜짝할 새 뽑아 한 발을 쏜다', [('gunslinger_bullet', 'projectile', 32, 4), ('ranger_arrow_hit', 'target', 64, 6)]),
  ('fan_hammer', '팬 해머', 'flurry', '공이를 연거푸 쳐 여섯 발을 쏟아붓는다', [('gunslinger_fan', 'target', 64, 10)]),
  ('trick_shot', '도탄 사격', 'shoot', '벽을 맞고 튄 탄이 모든 적을 스친다', [('gunslinger_ricochet', 'allTargets', 64, 8)]),
  ('hat_tip', '모자 인사', 'buff', '모자챙을 내리고 집중해 치명타를 올린다', [('gunslinger_hat', 'user', 64, 8)]),
  ('pistol_whip', '권총 손잡이 치기', 'dash-strike', '다가가 권총 손잡이로 후려친다', [('mon_slam_hit', 'target', 64, 8)]),
  ('dust_devil', '모래 회오리', 'blink-strike', '모래바람 속으로 사라졌다 뒤에서 쏜다', [('gunslinger_dust', 'target', 64, 8)]),
  ('dead_eye', '데드아이', 'shoot', '시간이 느려진 듯 표적을 겨눠 급소를 꿰뚫는다', [('gunslinger_deadeye', 'target', 64, 10)]),
  ('high_noon', '하이 눈', 'finisher', '해가 머리 위에 뜬 순간 모든 적을 쏘는 필살기', [('gunslinger_noon', 'screen', 128, 12), ('gunner_volley_hit', 'allTargets', 64, 8)]),
 ]),
 ('class_butler', 'butler', [
  ('knife_throw', '은식기 투척', 'shoot', '은 나이프를 소매에서 꺼내 던진다', [('butler_knife', 'projectile', 32, 4), ('scout_knife_hit', 'target', 64, 8)]),
  ('tea_time', '티타임', 'cast', '향긋한 홍차를 대접해 아군 하나를 치유한다', [('butler_tea', 'target', 64, 10)]),
  ('service', '완벽한 시중', 'buff', '아군 전체의 옷매무새를 가다듬어 민첩을 올린다', [('butler_service', 'allAllies', 64, 10)]),
  ('vanish', '그림자 시중', 'blink-strike', '눈에 띄지 않게 사라졌다 적 뒤에서 찌른다', [('butler_vanish', 'target', 64, 8)]),
  ('cutlery', '식기 난무', 'flurry', '포크와 나이프를 연거푸 휘두른다', [('butler_cutlery', 'target', 64, 10)]),
  ('bow', '정중한 인사', 'buff', '깊이 고개 숙여 적의 공격을 흘려 넘길 태세를 갖춘다', [('scout_afterimage', 'user', 64, 8)]),
  ('silver_rain', '은빛 비', 'cast', '은 식기를 하늘에서 모든 적에게 쏟는다', [('butler_silver_rain', 'allTargets', 64, 10)]),
  ('final_service', '마지막 시중', 'finisher', '촛불이 꺼진 순간 수백 자루 은식기가 적을 꿰는 필살기', [('butler_final', 'screen', 128, 12), ('scout_assassin_hit', 'target', 64, 8)]),
 ]),
 ('class_priest_monk', 'priest_monk', [
  ('chant', '염불', 'cast', '낮은 염불로 아군 하나를 치유한다', [('priest_monk_chant', 'target', 64, 10)]),
  ('staff_strike', '석장 치기', 'dash-strike', '금고리 석장으로 적을 내려친다', [('priest_monk_staff', 'target', 64, 8)]),
  ('vajra', '금강신', 'buff', '금빛 몸이 되어 방어를 크게 올린다', [('priest_monk_vajra', 'user', 64, 10)]),
  ('bead_toss', '염주 던지기', 'shoot', '염주알을 흩뿌려 적을 맞힌다', [('priest_monk_beads', 'target', 64, 8)]),
  ('purify', '정화', 'cast', '향 연기로 아군 전체의 상태이상을 씻어낸다', [('priest_monk_incense', 'allAllies', 64, 10)]),
  ('palm', '장타', 'flurry', '손바닥에 기를 모아 연거푸 친다', [('monk_fist_flurry', 'target', 64, 10)]),
  ('bell', '범종', 'cast', '커다란 종소리가 적 전체를 울린다', [('priest_monk_bell', 'allTargets', 64, 10)]),
  ('nirvana', '열반', 'finisher', '연꽃이 피며 부처의 손이 내려앉는 필살기', [('priest_monk_lotus', 'screen', 128, 12), ('cleric_mass_heal', 'allAllies', 64, 10)]),
 ]),
]


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
    for b in (sys.argv[1:] or ['a3', 'p1']):
        if BATCHES[b]:
            emit(b)
