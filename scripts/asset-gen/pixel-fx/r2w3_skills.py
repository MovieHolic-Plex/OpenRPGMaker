"""p2·p3 스킬 목록(정본) — 직업 8개 × 스킬 8개. 레이어는 시트 키만 적고, frame·frames·anchor 는 시트 등록값(REG)에서 채운다.
r2w3_emit.py 가 이 목록으로 src/assets/retroRosterSkills/p2.ts·p3.ts 를 쓴다.
스킬 규칙: 레벨 1·3·5·7·10·12·16·22, 마지막은 finisher, motion 은 직업당 4종 이상, 주된 층은 이 스킬 전용의 새 시트."""
import importlib, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import lib_r2w3 as L

LV = [1, 3, 5, 7, 10, 12, 16, 22]


def S(slug, name, motion, desc, *layers):
    return dict(slug=slug, name=name, motion=motion, desc=desc, layers=list(layers))


CLASSES = [
    dict(batch='p2', classId='class_gypsy', ck='gypsy', chip='people2-3', name='방랑 점술사', mod='r2w3_gypsy', skills=[
        S('tarot_flick', '타로 던지기', 'shoot', '타로 카드를 부채질하듯 날려 적을 벤다', 'gypsy_card', 'gypsy_card_hit'),
        S('crystal_gaze', '수정구의 환영', 'cast', '수정구를 띄워 환영 광선을 쏘고 산산이 부순다', 'gypsy_crystal'),
        S('curse_card', '저주 카드', 'cast', '검은 카드를 내리꽂아 해골 독기로 저주한다', 'gypsy_curse'),
        S('wheel_fortune', '운명의 수레바퀴', 'cast', '황금 수레바퀴를 돌려 모든 적의 운을 뒤튼다', 'gypsy_wheel'),
        S('veil_dance', '베일 춤', 'buff', '베일 리본과 금화를 휘감아 몸을 가볍게 한다', 'gypsy_dance'),
        S('lovers_charm', '연인의 매혹', 'cast', '붉은 하트와 보랏빛 하트가 얽혀 적의 마음을 사로잡는다', 'gypsy_lovers'),
        S('card_storm', '카드 회오리', 'spin', '카드 수십 장이 회오리로 적진을 갈아 버린다', 'gypsy_cardstorm'),
        S('star_prophecy', '별의 점괘', 'finisher', '「별」 카드를 세워 하늘의 별빛을 쏟아붓는 필살기', 'gypsy_fate_sky', 'gypsy_fate_hit'),
    ]),
    dict(batch='p2', classId='class_sword_dancer', ck='sword_dancer', chip='people2-4', name='검무사', mod='r2w3_sdancer', skills=[
        S('twin_dance', '쌍검무', 'flurry', '두 자루 검이 엇갈리며 초승달 궤적을 그린다', 'sdance_twin'),
        S('crescent_step', '초승달 걸음', 'dash-strike', '한 걸음에 파고들며 거대한 초승달로 가른다', 'sdance_crescent'),
        S('ribbon_whirl', '리본 회전', 'spin', '리본과 검날이 겹겹이 돌며 모든 적을 벤다', 'sdance_ribbon'),
        S('sword_wave', '검기 날리기', 'shoot', '초승달 검기를 날려 적을 가른다', 'sdance_wave', 'sdance_wave_hit'),
        S('mirror_step', '잔영 걸음', 'blink-strike', '잔영을 남기며 사라졌다가 X자로 벤다', 'sdance_blur', 'sdance_cross'),
        S('sword_rhythm', '검무 박자', 'buff', '북 장단에 맞춘 검무로 아군 전체의 기세를 올린다', 'sdance_rhythm'),
        S('moon_waltz', '월광 왈츠', 'leap-strike', '보름달을 등지고 뛰어올라 쌍검을 내려꽂는다', 'sdance_moon'),
        S('hundred_petals', '백화요란', 'finisher', '꽃잎과 검날의 폭풍 속에서 화면을 가르는 필살기', 'sdance_petal_sky', 'sdance_petal_hit'),
    ]),
    dict(batch='p2', classId='class_gambler', ck='gambler', chip='people2-5', name='도박사', mod='r2w3_gambler', skills=[
        S('dice_throw', '주사위 던지기', 'shoot', '주사위를 굴려 적에게 꽂는다. 눈이 클수록 아프다', 'gambler_dice', 'gambler_dice_hit'),
        S('slot_spin', '슬롯 머신', 'cast', '거대한 슬롯을 돌려 별 세 개를 맞추면 대폭발', 'gambler_slot'),
        S('coin_toss', '동전 세례', 'dash-strike', '금화 한 줌을 뿌리며 파고들어 후려친다', 'gambler_coin'),
        S('poker_face', '포커페이스', 'buff', '패를 펼쳐 표정을 숨기고 회피를 높인다', 'gambler_bluff'),
        S('all_in', '올인', 'leap-strike', '칩 더미를 통째로 걸고 뛰어올라 내려찍는다', 'gambler_allin'),
        S('ace_card', '에이스 카드', 'cast', '숨겨 둔 에이스 카드 한 장으로 빛의 일격을 낸다', 'gambler_ace'),
        S('double_or_nothing', '두 배 아니면 빈손', 'flurry', '동전 앞뒤에 걸고 연타를 몰아친다', 'gambler_coin_flip'),
        S('jackpot', '잭팟', 'finisher', '릴이 777 로 멈추고 금화 폭포가 쏟아지는 필살기', 'gambler_jackpot_sky', 'gambler_jackpot_hit'),
    ]),
    dict(batch='p2', classId='class_seraph', ck='seraph', chip='people2-6', name='천사', mod='r2w3_seraph', skills=[
        S('feather_dart', '성깃 화살', 'shoot', '하얀 깃털을 화살처럼 날려 적을 꿰뚫는다', 'seraph_feather', 'seraph_feather_hit'),
        S('holy_spear', '성창 강림', 'cast', '하늘에서 성창이 내리꽂히고 빛기둥이 솟는다', 'seraph_spear'),
        S('angel_heal', '천상의 치유', 'cast', '날개를 펴 깃털 빛으로 아군 전체를 치유한다', 'seraph_heal'),
        S('chain_of_light', '빛의 사슬', 'cast', '성스러운 사슬로 적을 휘감아 움직임을 묶는다', 'seraph_bind'),
        S('wing_veil', '날개 장막', 'buff', '금빛 날개로 아군을 감싸 방어를 높인다', 'seraph_veil'),
        S('divine_smite', '천벌', 'leap-strike', '빛기둥과 함께 내려꽂혀 십자 충격파를 일으킨다', 'seraph_smite'),
        S('resurrection', '부활의 기적', 'cast', '순백의 날개와 앙크가 쓰러진 아군을 일으킨다', 'seraph_revive'),
        S('last_judgment', '최후의 심판', 'finisher', '천사의 날개 아래 성창 아홉 자루를 내리는 필살기', 'seraph_judgment_sky', 'seraph_judgment_hit'),
    ]),
    dict(batch='p2', classId='class_fairy', ck='fairy', chip='people2-7', name='요정', mod='r2w3_fairy', skills=[
        S('sparkle_dust', '반짝 가루', 'shoot', '반짝이는 빛가루를 날려 적을 쏜다', 'fairy_dust', 'fairy_dust_hit'),
        S('vine_snare', '덩굴 속박', 'cast', '땅에서 덩굴이 솟아 적을 휘감고 꽃을 피운다', 'fairy_vines'),
        S('firefly_swarm', '반딧불 무리', 'cast', '반딧불 떼가 적진을 에워싸며 쏘아 댄다', 'fairy_swarm'),
        S('healing_pollen', '치유 꽃가루', 'buff', '꽃가루를 흩뿌려 아군 전체를 감싸 치유한다', 'fairy_pollen'),
        S('sleepy_song', '졸음 노래', 'cast', '졸음 방울과 Z 가 피어올라 적을 재운다', 'fairy_lullaby'),
        S('blossom_ray', '꽃잎 광선', 'flurry', '거대한 꽃이 피며 꽃잎 광선을 연달아 쏜다', 'fairy_bloom'),
        S('pixie_dash', '요정 돌진', 'dash-strike', '빛가루 꼬리를 끌며 적의 품으로 파고든다', 'fairy_dash', 'fairy_dash_hit'),
        S('forest_hymn', '숲의 성가', 'finisher', '깊은 숲과 반딧불이 깨어나 모든 적을 덮치는 필살기', 'fairy_grove_sky', 'fairy_grove_hit'),
    ]),
    dict(batch='p2', classId='class_king', ck='king', chip='people3-0', name='국왕', mod='r2w3_king', skills=[
        S('scepter_throw', '홀 투척', 'shoot', '황금 홀을 던져 적의 머리 위에 왕관 문장을 새긴다', 'king_scepter', 'king_scepter_hit'),
        S('royal_decree', '왕명', 'buff', '두루마리 왕명을 펼쳐 아군 전체의 힘을 북돋는다', 'king_decree'),
        S('war_banner', '군기 게양', 'buff', '왕가의 군기를 높이 세워 아군을 고무한다', 'king_banner'),
        S('guard_charge', '근위대 창격', 'cast', '근위대의 창끝이 하늘에서 적진에 쏟아진다', 'king_guard'),
        S('tribute_seal', '조공 인장', 'cast', '금화 비와 왕가 인장이 적을 짓누른다', 'king_tribute'),
        S('majesty', '왕의 위광', 'buff', '왕관과 인장의 위광으로 아군의 사기를 끌어올린다', 'king_aura'),
        S('crown_fall', '왕관 강하', 'leap-strike', '거대한 왕관이 떨어져 충격파로 적을 밀어낸다', 'king_crown_drop'),
        S('realm_decree', '왕국의 칙령', 'finisher', '성벽과 깃발이 솟고 왕관이 내려앉는 필살기', 'king_realm_sky', 'king_realm_hit'),
    ]),
    dict(batch='p2', classId='class_merchant', ck='merchant', chip='people3-1', name='상인', mod='r2w3_merchant', skills=[
        S('coin_fling', '금화 던지기', 'shoot', '금화를 손가락으로 튕겨 적에게 박아 넣는다', 'merchant_coin', 'merchant_coin_hit'),
        S('abacus_smash', '주판 내려치기', 'leap-strike', '거대한 주판이 떨어져 구슬이 딸깍이며 적을 짓누른다', 'merchant_abacus'),
        S('fair_scale', '공정한 저울', 'cast', '저울이 기울며 적의 힘을 깎아 낸다', 'merchant_scale'),
        S('binding_contract', '구속 계약서', 'cast', '붉은 인장 계약서가 적을 사슬로 옭아맨다', 'merchant_contract'),
        S('hard_bargain', '흥정의 방벽', 'buff', '금화 고리가 몸을 돌며 받는 피해를 깎는다', 'merchant_haggle'),
        S('powder_keg', '화약 자루', 'shoot', '화약 자루를 던져 적진을 폭파한다', 'merchant_bomb', 'merchant_bomb_hit'),
        S('bazaar_rush', '바자르 대방출', 'spin', '노점 세 곳에서 상품이 쏟아져 적진을 휩쓴다', 'merchant_market'),
        S('vault_opening', '금고 개방', 'finisher', '거대한 금고가 열리고 금화와 보석이 폭포처럼 쏟아지는 필살기', 'merchant_vault_sky', 'merchant_vault_hit'),
    ]),
    dict(batch='p2', classId='class_noble', ck='noble', chip='people3-2', name='귀족', mod='r2w3_noble', skills=[
        S('triple_thrust', '삼단 찌르기', 'dash-strike', '레이피어로 눈 깜짝할 새 세 번 찌른다', 'noble_thrust'),
        S('glove_challenge', '결투 신청', 'shoot', '흰 장갑을 던져 적을 도발하고 약점을 드러낸다', 'noble_gauntlet'),
        S('rose_toss', '장미 던지기', 'shoot', '가시 장미를 날려 꽃잎과 함께 적을 벤다', 'noble_rose', 'noble_rose_hit'),
        S('family_crest', '가문의 긍지', 'buff', '가문 문장을 드높여 아군 전체의 방어를 올린다', 'noble_crest'),
        S('parry_stance', '받아넘기기', 'buff', '레이피어로 원을 그려 공격을 흘리고 반격한다', 'noble_parry'),
        S('noble_order', '귀족의 명령', 'cast', '레이피어로 가리켜 아군 전체를 재촉해 속도를 올린다', 'noble_command'),
        S('checkmate', '체크메이트', 'leap-strike', '체스판을 펼치고 킹 말을 떨어뜨려 적을 짓누른다', 'noble_checkmate'),
        S('grand_duel', '귀족의 결투', 'finisher', '가문 깃발 아래 수십 번의 찌르기로 적진을 꿰뚫는 필살기', 'noble_duel_sky', 'noble_duel_hit'),
    ]),
    # ── p3: 스킬 하나당 새 시트 최대 1장(나머지는 기존 시트 재사용). 새 시트 16장은 r2w3_p3.py ──
    dict(batch='p3', classId='class_princess', ck='princess', chip='people3-3', name='공주', mod='r2w3_p3', skills=[
        S('prayer', '기도', 'cast', '두 손을 모아 기도해 아군 하나를 치유한다', 'cleric_heal'),
        S('star_wand', '별빛 지팡이', 'cast', '별 지팡이에서 빛의 탄을 쏘아 적을 친다', 'mage_missile_orb', 'mage_missile_hit'),
        S('royal_slap', '공주의 따귀', 'dash-strike', '달려가 따귀를 올려 적을 비틀거리게 한다', 'guard_bash'),
        S('blessing_song', '축복의 노래', 'buff', '맑은 노래로 아군 전체의 힘을 북돋는다', 'bard_hymn', 'cleric_blessing'),
        S('purify_tear', '정화의 눈물', 'cast', '눈물 한 방울로 아군의 상태이상을 씻어낸다', 'cleric_purify'),
        S('rose_barrier', '장미 결계', 'buff', '장미 덩굴 결계로 아군 전체를 감싸 지킨다', 'princess_rose_barrier'),
        S('miracle', '왕가의 기적', 'cast', '왕가의 기도로 쓰러진 아군을 일으킨다', 'cleric_revive'),
        S('grand_chorus', '축복의 대합창', 'finisher', '티아라가 강림하고 꽃비가 쏟아져 아군 전체를 치유하는 필살기', 'princess_hymn_sky', 'cleric_mass_heal'),
    ]),
    dict(batch='p3', classId='class_archmage', ck='archmage', chip='people3-4', name='대마법사', mod='r2w3_p3', skills=[
        S('flare', '플레어', 'cast', '지팡이 끝의 불덩이를 날려 크게 터뜨린다', 'mage_fireball_orb', 'mage_fire_burst'),
        S('frost_lance', '빙창', 'cast', '얼음 창을 날려 적을 얼린다', 'ranger_frost_arrow', 'mon_frost_burst'),
        S('thunder_chain', '뇌격 연쇄', 'cast', '번개가 적에서 적으로 튄다', 'mage_chain_bolt'),
        S('elemental_prism', '원소 프리즘', 'cast', '수정 프리즘에서 네 원소 광선이 갈라져 내리꽂힌다', 'archmage_prism'),
        S('arcane_ward', '비전 장벽', 'buff', '푸른 마법진 방벽을 두른다', 'mage_mana_shield'),
        S('blink', '순간이동 일격', 'blink-strike', '순간이동으로 적 앞에 나타나 지팡이로 후려친다', 'scout_shadow_puff', 'guard_bash'),
        S('meteor_swarm', '메테오 스웜', 'cast', '운석 무리를 모든 적에게 떨어뜨린다', 'mage_meteor_rock', 'mage_meteor_blast'),
        S('grand_fusion', '원소 대융합', 'finisher', '네 원소를 한 점에 모아 백색 폭발을 일으키는 필살기', 'archmage_elements_sky', 'mage_star_hit'),
    ]),
    dict(batch='p3', classId='class_heavy_knight', ck='heavy_knight', chip='people3-5', name='중갑병', mod='r2w3_p3', skills=[
        S('shield_charge', '방패 돌격', 'dash-strike', '방패를 앞세워 돌진해 적을 밀쳐낸다', 'guard_charge', 'hero_dust'),
        S('provoke', '도발', 'buff', '방패를 두드려 적의 시선을 끈다', 'guard_taunt'),
        S('iron_wall', '철벽 방진', 'buff', '방패를 겹쳐 아군 전체를 지키는 방진을 짠다', 'guard_barrier'),
        S('mace_crush', '철퇴 분쇄', 'leap-strike', '뛰어올라 철퇴로 내려찍어 땅을 가른다', 'heavy_knight_mace_crush'),
        S('counter_stance', '반격 태세', 'buff', '방패를 세우고 반격 자세를 취한다', 'guard_counter'),
        S('shield_bash', '방패 강타', 'dash-strike', '방패 모서리로 쳐서 적을 기절시킨다', 'guard_bash'),
        S('earthquake', '대지 진동', 'leap-strike', '온몸의 무게로 땅을 찍어 모든 적을 흔든다', 'guard_quake', 'guard_quake_ring'),
        S('bulwark_march', '철갑 진격', 'finisher', '탑방패의 벽을 세워 적진을 밀어붙이는 필살기', 'heavy_knight_bulwark_sky', 'guard_fortress_slam'),
    ]),
    dict(batch='p3', classId='class_mercenary', ck='mercenary', chip='people3-6', name='용병', mod='r2w3_p3', skills=[
        S('cleave', '내려베기', 'dash-strike', '도끼로 정수리부터 크게 내려벤다', 'mon_cleave_arc'),
        S('axe_throw', '도끼 던지기', 'shoot', '도끼를 회전시켜 던져 적을 찍는다', 'mercenary_axe_spin', 'ranger_power_hit'),
        S('battle_cry', '전장의 함성', 'buff', '전장에서 단련된 함성으로 아군 공격력을 올린다', 'hero_warcry'),
        S('whirl_axe', '회전 도끼', 'spin', '적진 한가운데서 도끼를 휘돌려 모두를 벤다', 'hero_whirl'),
        S('veteran_eye', '노련한 눈', 'buff', '전장 경험으로 빈틈을 읽어 회피와 급소율을 높인다', 'scout_afterimage'),
        S('ground_split', '대지 가르기', 'leap-strike', '뛰어올라 도끼로 땅을 쪼개 모든 적에게 균열을 보낸다', 'mon_quake_crack', 'hero_meteor_impact'),
        S('berserk_chop', '난도질', 'flurry', '도끼를 쉴 새 없이 휘둘러 연속으로 찍는다', 'scout_flurry'),
        S('warlord', '전장의 군주', 'finisher', '쌍도끼가 X 자로 화면을 가르는 필살기', 'mercenary_warlord_sky', 'mon_cleave_arc'),
    ]),
    dict(batch='p3', classId='class_dragoon', ck='dragoon', chip='people3-7', name='용기사', mod='r2w3_p3', skills=[
        S('lance_thrust', '창 찌르기', 'dash-strike', '창을 곧게 내질러 적을 꿰뚫는다', 'hero_pierce'),
        S('jump', '점프', 'leap-strike', '하늘 높이 뛰어올라 창을 수직으로 내리꽂는다', 'dragoon_dive'),
        S('dragon_breath', '용의 숨결', 'cast', '창끝에 용의 불꽃을 모아 적을 태운다', 'ninja_fire_breath'),
        S('lance_throw', '투창', 'shoot', '창을 던져 적을 꿰뚫는다', 'ranger_arrow', 'mon_spear_pierce'),
        S('dragon_spirit', '용혼', 'buff', '용의 기운을 둘러 공격력을 끌어올린다', 'hero_flame_aura'),
        S('sweeping_lance', '창 휘두르기', 'spin', '창을 크게 돌려 모든 적을 쓸어낸다', 'hero_whirl'),
        S('high_jump', '하이 점프', 'leap-strike', '더 높이 뛰어 떨어지는 힘으로 적진을 흔든다', 'hero_meteor_trail', 'hero_meteor_impact'),
        S('dragon_ascent', '용기사의 비상', 'finisher', '푸른 용의 날개 아래 빛의 창을 떨어뜨리는 필살기', 'dragoon_dragon_sky', 'hero_brave_burst'),
    ]),
    dict(batch='p3', classId='class_villager', ck='villager', chip='people4-0', name='마을 청년', mod='r2w3_p3', skills=[
        S('club_swing', '몽둥이질', 'dash-strike', '뛰어가 몽둥이로 힘껏 후려친다', 'guard_bash'),
        S('sling_stone', '돌팔매', 'shoot', '돌멩이를 던져 적의 머리를 맞힌다', 'mon_rock_burst'),
        S('deep_breath', '심호흡', 'buff', '숨을 고르고 기운을 되찾아 HP를 회복한다', 'monk_meditate'),
        S('pebble_storm', '돌팔매 세례', 'shoot', '돌멩이를 한 움큼씩 던져 모든 적에게 퍼붓는다', 'villager_pebbles'),
        S('wild_swing', '막무가내 휘두르기', 'flurry', '몽둥이를 막무가내로 휘둘러 여러 번 때린다', 'monk_fist_flurry'),
        S('cheer_up', '힘내자', 'buff', '마을 노래로 아군 전체의 기운을 북돋는다', 'bard_notes_red'),
        S('dash_tackle', '몸통 박치기', 'dash-strike', '온몸으로 들이받아 적을 쓰러뜨린다', 'guard_charge', 'hero_dust'),
        S('village_mob', '마을 총출동', 'finisher', '마을 사람들이 몰려나와 온갖 것을 퍼붓는 필살기', 'villager_mob_sky', 'mon_rock_burst'),
    ]),
    dict(batch='p3', classId='class_tribal', ck='tribal', chip='people4-1', name='부족 전사', mod='r2w3_p3', skills=[
        S('boomerang', '부메랑', 'shoot', '부메랑을 던져 적을 치고 되돌려 받는다', 'tribal_boomerang', 'ranger_arrow_hit'),
        S('war_howl', '전쟁 함성', 'buff', '부족의 함성으로 아군 전체의 공격력을 올린다', 'mon_howl_ring'),
        S('beast_claw', '맹수 발톱', 'dash-strike', '맹수처럼 파고들어 할퀸다', 'druid_claw'),
        S('vine_trap', '덩굴 덫', 'cast', '땅에 숨긴 덩굴 덫으로 모든 적을 묶는다', 'druid_roots'),
        S('spin_throw', '회전 투척', 'spin', '몸을 돌려 부메랑 여럿을 던져 모든 적을 벤다', 'samurai_wind_hit'),
        S('war_dance', '전투 춤', 'buff', '북소리에 맞춘 춤으로 몸을 달군다', 'bard_notes_red'),
        S('leap_smash', '도약 강타', 'leap-strike', '높이 뛰어 부메랑으로 내려찍는다', 'monk_rising_kick'),
        S('spirit_call', '조상신의 부름', 'finisher', '토템과 독수리 정령을 불러 적진을 휩쓰는 필살기', 'tribal_spirit_sky', 'druid_tree_hit'),
    ]),
    dict(batch='p3', classId='class_fortune_teller', ck='fortune_teller', chip='people4-2', name='점성술사', mod='r2w3_p3', skills=[
        S('star_bolt', '별빛 탄', 'cast', '별 지팡이에서 빛의 탄을 쏜다', 'mage_missile_orb', 'mage_star_hit'),
        S('moon_ray', '월광', 'cast', '은빛 달빛 기둥을 적에게 내린다', 'druid_moonbeam'),
        S('horoscope', '별점', 'buff', '황도 12궁을 돌려 아군 전체의 운을 올린다', 'fortune_teller_zodiac'),
        S('gravity_star', '중력성', 'cast', '검은 별을 떨어뜨려 적을 짓누른다', 'mage_gravity'),
        S('dream_star', '꿈별', 'cast', '잔잔한 별노래로 모든 적을 재운다', 'bard_notes_blue'),
        S('star_step', '별의 걸음', 'blink-strike', '별빛으로 사라졌다 나타나 지팡이로 찌른다', 'scout_shadow_puff', 'mage_missile_hit'),
        S('meteor', '운석 낙하', 'cast', '하늘에서 운석을 불러 모든 적에게 떨어뜨린다', 'mage_meteor_rock', 'mage_meteor_blast'),
        S('heaven_collapse', '천궁 붕괴', 'finisher', '별자리를 그린 뒤 별똥별 비를 쏟아붓는 필살기', 'fortune_teller_meteor_sky', 'mage_star_hit'),
    ]),
]


def load_all():
    for cl in CLASSES:
        importlib.import_module(cl['mod'])


def find(class_id):
    return next(c for c in CLASSES if c['classId'] == class_id)


def build_class(class_id, argv):
    cl = find(class_id)
    load_all()
    keys = []
    for sk in cl['skills']:
        keys += [k for k in sk['layers'] if k not in keys and k in L.REG]
    return L.make_class(cl['batch'], cl['ck'], keys, cl['skills'], cl['chip'], argv)
