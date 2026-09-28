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
        keys += [k for k in sk['layers'] if k not in keys]
    return L.make_class(cl['batch'], cl['ck'], keys, cl['skills'], cl['chip'], argv)
