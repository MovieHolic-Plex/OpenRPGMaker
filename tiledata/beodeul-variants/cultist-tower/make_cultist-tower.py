# 버들항 웨이브 4 — 신도의 탑(cultist-tower). 다시 돌리면 같은 그림이 나온다.
#   python3 make_cultist-tower.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png
# 한 맵(92×34)에 다섯 판을 나란히: 탑 바깥 마당(x0~29) · 1층 홀(x32~61, y0~16) · 2층 기도실·감방(x32~61, y17~33) ·
# 3층 서고(x62~91, y0~16) · 꼭대기 의식실(x62~91, y17~33). 층 사이는 나선 계단 쌍(오름 ↔ 내림)이 같은 지역 칸 자리에 있다.
# 바깥 탑 문 칸 ↔ 1층 홀 남쪽 입구 칸은 출입 이벤트 짝(LINKS)이다.
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from ct_kit import *
from ct_kit import _hash
import ct_out as O, ct_in1 as A, ct_in2 as B
import dcheck
from PIL import ImageDraw, ImageFont
assert OUT.endswith('cultist-tower')

kit = Kit('cultist-tower', '신도의 탑 — 교단 나선 계단 탑(바깥·홀·기도실·감방·서고·의식실)')
S = {}
SOFT = set()
def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img

# ---------------------------------------------------------------- 조각 등록 (새로 그린 것만)
# 바깥
obj('cult_tower', O.cult_tower(), '교단 탑(바깥)', '3/4 원통 탑 — 앞으로 휘어 감긴 그을린 마름돌 줄눈, 나선으로 오르는 보라빛 창 넷, 내민 돌받침 구멍 띠, 흉벽 고리와 지붕 판석 위 보라 불 화로·갈라진 꼬리 교단 깃발, 앞면 보라 휘장 둘(눈 문장), 쇠띠 아치 문과 문 위 문장 돌판(7×14).',
    '7×14칸. 몸통 아래 11줄(칠해진 칸) 막힘, 맨 아래 가운데 문 칸(가운데 열)은 걷기 = 탑 안 이동 칸. 위 3줄(흉벽·지붕)은 걷기+가림. 문 앞(남)에 tower_steps, 둘레 2칸은 길·마당으로 비운다. 마당 북쪽 가운데에 하나.', brows=11)
obj('tower_steps', O.tower_steps(), '탑 입구 돌계단', '문 앞에 반원으로 퍼진 세 단 돌계단, 양 끝 해골 받침돌(4×2).', '4×2칸, 걷기(양 끝 받침돌만 장식). cult_tower 문 바로 아래 두 줄에 문과 가운데를 맞춰 놓는다. 앞에서 흙길이 시작한다.', brows=0, kind='walk')
obj('stone_altar_out', O.stone_altar_out(), '바깥 돌 제단', '두 기둥 위 두꺼운 마름돌 판, 검붉은 천·쇠사슬 둘·해골 둘·녹은 초(3×2).', '3×2칸, 아래 2줄 막힘. 선돌 고리 한가운데, 앞에 sigil_stone. 길에서 2칸 이상 띄운다.', brows=2)
obj('standing_stone', O.standing_stone(), '선돌', '위가 둥글게 깎인 길쭉한 돌기둥, 앞면에 새긴 나선 홈과 보라 점(1×3).', '1×3칸, 아랫줄만 막힘(위는 걷기+가림). 제단 둘레에 5~7개를 고리로(같은 간격 금지), 부러진 선돌을 섞는다.', soft=True)
obj('standing_stone_broken', O.standing_stone(3, broken=True), '부러진 선돌', '허리에서 부러진 선돌(1×2).', '1×2칸, 아랫줄만 막힘. 선돌 고리 사이에 1~2개.', soft=True)
obj('skull_pike', O.skull_pike(), '해골 말뚝', '땅에 박은 깎은 말뚝 끝 해골과 감은 보라 끈(1×2).', '1×2칸, 아랫줄만 막힘. 길가에 2~4칸 간격으로 어긋나게(양쪽 번갈아), 길 칸 금지.', soft=True)
obj('cult_banner_pole', O.cult_banner_pole(), '교단 깃대', '쇠 머리 깃대에 늘어진 보라 깃발(검붉은 테, 눈 문장), 밑동 돌 무지(1×4).', '1×4칸, 아랫줄만 막힘. 탑 계단 양옆에 쌍으로, 또는 마당 입구에.', soft=True)
obj('ash_tree', O.ash_tree(3), '잿빛 고목', '잎 없는 비틀린 잿빛 줄기와 앙상한 가지, 가지 윗면 재, 밑동 마른 풀(2×3).', '2×3칸, 줄기 칸만 막힘(위는 걷기+가림). 2~5그루 덩이로, 큰 고목과 섞고 일렬 금지.', soft=True)
obj('ash_tree_b', O.ash_tree(6), '잿빛 고목(반대로 기움)', '줄기가 반대로 기운 잿빛 고목(2×3).', '2×3칸, 줄기 칸만 막힘. ash_tree 와 섞어 덩이로.', soft=True)
obj('ash_tree_big', O.ash_tree(4, True), '큰 잿빛 고목', '굵게 뒤틀려 셋으로 갈라진 큰 잿빛 고목, 줄기 틈(3×4).', '3×4칸, 줄기 칸만 막힘. 덩이 가운데에 한 그루.', soft=True)
obj('gibbet_cage', O.gibbet_cage(), '매단 쇠우리', '굽은 나무 기둥 팔에 사슬로 매단 둥근 빈 쇠창살 우리, 바닥 뼈 조각(2×3).', '2×3칸, 기둥 칸만 막힘(우리는 걷기+가림). 길 곁 마당 가장자리에 1~2개.', soft=True)
obj('bone_cairn', O.bone_cairn(), '해골 돌무덤', '둥근 돌 셋을 쌓고 꼭대기에 해골, 둘레 뼈 조각(1×1).', '1칸, 막힘 1줄. 길 갈림목·제단 둘레에 하나씩.')
obj('sigil_stone', O.sigil_stone(), '땅 문장석', '땅에 박힌 둥근 판석, 새긴 두 겹 고리와 나선, 검붉은 홈(2×2, 글자 없음).', '2×2칸 바닥 장식(걷기). 바깥 제단 앞에 하나.', brows=0, kind='decal')
obj('dead_grass', O.dead_grass(), '마른 풀 포기', '잿빛 바랜 풀잎 몇 포기와 잔돌(1×1).', '1칸 바닥 장식(걷기). 고목 밑동·바위 곁에 2~4개씩 덩이로, 길 칸 금지.', brows=0, kind='decal')
obj('dead_grass_b', O.dead_grass(7), '마른 풀 포기(돌 없음)', '잔돌 없는 마른 풀잎 포기(1×1).', '1칸 바닥 장식(걷기). dead_grass 와 섞는다.', brows=0, kind='decal')
obj('rocks_ash', O.rocks_ash(), '잿빛 돌 무리', '크고 작은 모난 잿빛 돌 셋(1×1).', '1칸, 막힘 1줄. 고목 덩이 가장자리·마당 구석에.')
obj('bone_scatter_out', O.bone_scatter_out(), '흩어진 뼈', '긴 뼈 둘·갈비 조각·작은 해골(2×1).', '2×1칸 바닥 장식(걷기). 제단·쇠우리 곁에 1~2개.', brows=0, kind='decal')
# 1층 홀
obj('cult_tapestry', A.cult_tapestry(), '교단 휘장', '금 막대에 건 보라 천, 검붉은 테두리 띠, 가운데 큰 눈 문장, 아래 금 술(2×3, 글자·종교 상징 없음).', '2×3칸 장식(벽 앞면 위, 앞면 3줄 필요). 홀·기도실·의식실 북쪽 벽에 쌍으로, 제단 양옆.', brows=0, kind='decal')
obj('hall_altar', A.hall_altar(), '홀 제단', '두 단 마름돌 제단, 앞으로 드리운 검붉은 천과 눈 문장, 위에 해골·검은 그릇·굵은 초 넷(3×2).', '3×2칸, 아래 2줄 막힘. 홀 북쪽 벽 앞면 바로 아래 가운데, 앞 1칸 비우고 깔개를 거기서 끝낸다.', brows=2)
obj('skull_candelabra', A.skull_candelabra(), '해골 촛대', '쇠 세 갈래 촛대 기둥, 받침 위 해골, 보라 불꽃 초 셋(1×2).', '1×2칸, 아랫줄만 막힘. 제단·계단·문 양옆에 쌍으로, 방 모서리에. 보라 빛무리와 함께.', soft=True)
obj('skull_candle', A.skull_candle(), '해골 초', '바닥에 놓은 해골 위 녹아내린 초, 보라 불꽃(1×1).', '1칸 바닥 장식(걷기). 벽가·의자 끝·계단 곁에 흩어 둔다, 통로 한가운데 금지.', brows=0, kind='decal')
obj('wall_mask', A.wall_mask(), '벽 가면(흰)', '쇠못에 걸린 표정 없는 흰 의식 가면(1×1).', '1칸 장식(벽 앞면 가운데 줄). 홀·서고 벽에 2~3개를 높이를 엇갈리게.', brows=0, kind='decal')
obj('wall_mask_red', A.wall_mask(red=True), '벽 가면(검붉은)', '검붉게 칠한 표정 없는 의식 가면(1×1).', '1칸 장식(벽 앞면). wall_mask 와 섞는다.', brows=0, kind='decal')
obj('mask_rack', A.mask_rack(), '가면 걸이', '짙은 나무 틀 가로대 둘에 걸린 흰·검붉은·보라 가면 다섯(2×2).', '2×2칸, 아래 2줄 막힘. 홀·기도실 벽가에 하나.', brows=2)
obj('robe_rack', A.robe_rack(), '두건 겉옷 걸이', '쇠관 틀에 걸린 검은 두건 겉옷 둘과 보라 겉옷(빈 옷, 사람 없음)(2×2).', '2×2칸, 아랫줄만 막힘. 홀 벽가·입구 곁에 하나.', soft=True)
obj('cult_pew', A.cult_pew(), '신도 긴 의자', '그을린 짙은 나무 좌판과 낮은 등받이, 다리 셋, 펼친 기도서(3×1).', '3×1칸, 막힘 1줄. 제단을 향해 2칸 간격 줄로 깔개 양쪽에, 깔개 옆 1칸은 통로로 비운다.')
obj('kneel_cushion', A.kneel_cushion(), '무릎 방석', '금 술 달린 낡은 보라 방석(1×1).', '1칸 바닥 장식(걷기). 제단·우상 앞에 2~4개를 어긋나게.', brows=0, kind='decal')
obj('ritual_urn', A.ritual_urn(), '의식용 항아리', '검은 유약 큰 항아리, 검붉은 띠와 눈 문장, 밀랍 봉인(1×2).', '1×2칸, 아랫줄만 막힘. 벽가·제단 곁에 1~2개(작은 항아리와 덩이로).', soft=True)
obj('ritual_urn_small', A.ritual_urn(small=True), '작은 의식 항아리', '밀랍 봉한 작은 검은 항아리(1×1).', '1칸, 막힘 1줄. 큰 항아리 곁·선반 아래에 1~2개.')
obj('brazier_purple', A.brazier_purple(), '보라 불 화로', '세 다리 검은 쇠 받침 그릇에서 타오르는 보라 불(1×2).', '1×2칸, 아랫줄만 막힘. 입구·계단 양옆에 쌍으로. 보라 빛무리와 함께.', soft=True)
obj('sconce_purple', A.sconce_purple(), '보라 벽 촛대', '쇠 벽판과 접시에 굵은 검은 초, 보라 불꽃(1×1).', '1칸 장식(벽 앞면 가운데 줄). 4~6칸 간격, 휘장 사이. 빛무리와 함께.', brows=0, kind='decal')
obj('chains_wall', A.chains_wall(), '벽 쇠사슬', '벽 고리에서 늘어진 쇠사슬 둘과 수갑 고리(1×2).', '1×2칸 장식(벽 앞면 2줄 위). 감방 뒤벽·기둥 앞면에.', brows=0, kind='decal')
obj('chain_floor', A.chain_floor(), '바닥 쇠사슬', '바닥 쇠고리에서 구불구불 늘어진 사슬과 족쇄(2×1).', '2×1칸 바닥 장식(걷기). 감방 안·의식실 제단 곁에.', brows=0, kind='decal')
# 2층 감방·기도실
obj('cell_gate', A.cell_gate(), '감방 쇠창살 문', '위아래 가로 띠 사이 굵은 창살 넷, 자물쇠 판(1×2).', '1×2칸, 걷기(잠긴 문 이벤트). 감방 앞 쇠창살 줄(autotile-ironbars)의 한 칸을 비우고 그 칸에 놓는다.', brows=0, kind='walk')
obj('straw_pile', A.straw_pile(), '짚 더미', '감방 바닥의 눅눅한 짚 더미(2×1).', '2×1칸 바닥 장식(걷기). 감방 안 한쪽에.', brows=0, kind='decal')
obj('cell_bucket', A.cell_bucket(), '감방 양동이', '쇠테 낡은 나무 양동이(1×1).', '1칸, 막힘 1줄. 감방 구석에.')
obj('cell_bones', A.cell_bones(), '감방 뼈', '벽가에 쌓인 해골 하나와 긴 뼈 둘(1×1).', '1칸 바닥 장식(걷기). 감방 하나에 하나만.', brows=0, kind='decal')
obj('plank_bed', A.plank_bed(), '널 침상', '짧은 다리 나무 침상과 해진 담요(2×1).', '2×1칸, 막힘 1줄. 감방 뒤벽에 붙여서.')
obj('prayer_idol', A.prayer_idol(), '기도실 우상 돌기둥', '두 단 받침 위 뿔 장식 검은 돌기둥, 앞면에 빛나는 큰 눈, 공물 그릇과 초(2×3, 사람 형상 아님).', '2×3칸, 받침 줄만 막힘(위는 걷기+가림). 기도실 북쪽 벽 아래 가운데, 앞에 무릎 방석.', soft=True)
obj('offering_bowl', A.offering_bowl(), '공물 그릇', '짧은 돌 받침 위 넓은 쇠 그릇, 검붉은 꽃잎과 뼈 조각(1×1).', '1칸, 막힘 1줄. 우상·제단 양옆에.')
# 3층 서고
obj('forbidden_bookcase', B.forbidden_bookcase(), '금서 책장', '그을린 나무 키 큰 책장, 선반 4단 금서, X자 쇠사슬과 자물쇠, 꼭대기 해골(2×3).', '2×3칸, 아랫줄 2칸만 막힘(위 2줄 걷기+가림). 북쪽 벽 앞면에 등을 붙여 2~3개씩, 휘장·가면으로 끊는다.', soft=True)
obj('chained_bookcase_low', B.chained_bookcase_low(), '낮은 금서 책장', '윗면에 펼친 검은 책·쌓은 책·초, 앞면 선반 2단과 쇠사슬(2×2).', '2×2칸, 아래 2줄 막힘. 서고 가운데에 어긋나게(일렬 금지), 통로 2칸.', brows=2)
obj('grimoire_lectern', B.grimoire_lectern(), '마도서 독서대', '기울어진 판에 쇠사슬로 묶은 펼친 검은 마도서, 보라로 빛나는 쪽(1×2, 글자 없음).', '1×2칸, 아랫줄만 막힘. 서고 한가운데 하나, 둘레에 바닥 초. 보라 빛무리와 함께.', soft=True)
obj('ritual_table', B.ritual_table(), '의식 도구 탁자', '검붉은 천 덮은 탁자, 굽은 단검 둘·검은 그릇·해골·초·작은 병(2×2).', '2×2칸, 아래 2줄 막힘. 서고·의식실 벽가에 하나, 둘레 한 칸 비움.', brows=2)
obj('jar_shelf', B.jar_shelf(), '항아리 선반', '두 단 나무 선반에 표본 병·밀랍 항아리·두개골(2×2).', '2×2칸, 아래 2줄 막힘. 서고 벽가에.', brows=2)
obj('cauldron', B.cauldron(), '보라 가마솥', '짧은 다리 검은 쇠솥에 끓는 보라 물약과 거품, 밑 숯불(2×2).', '2×2칸, 아래 2줄 막힘. 서고 구석·의식 준비실에 하나. 보라 빛무리와 함께.', brows=2)
obj('scroll_heap', B.scroll_heap(), '두루마리 더미', '엇갈려 쌓인 누런 두루마리 넷과 검붉은 끈(1×1).', '1칸 바닥 장식(걷기). 책장·탁자 발치에 1~2개.', brows=0, kind='decal')
# 꼭대기 의식실
obj('magic_circle', B.magic_circle(), '큰 원형 마법진', '바닥에 새긴 세 겹 고리(검붉은 홈 + 보라로 빛나는 테), 고리 사이 점 띠, 바깥 작은 원 여섯, 안으로 감기는 나선 셋과 가운데 눈(7×7, 글자·별 모양 없음).',
    '7×7칸 바닥 장식(걷기). 의식실 한가운데 높은 제단 앞에 하나, 둘레에 바닥 초. 보라 빛무리와 함께.', brows=0, kind='decal')
obj('high_altar', B.high_altar(), '높은 제단', '세 단 돌계단 단 위 검은 돌 제단, 보라 천과 큰 눈 문장, 해골·단검·피 그릇·굵은 초 넷, 단 양 끝 해골(4×3).', '4×3칸, 아래 2줄 막힘(맨 윗줄 걷기+가림). 의식실 북쪽 벽 앞면 바로 아래 가운데, 위 벽에 crimson_window.', brows=2)
obj('brazier_big', B.brazier_big(), '큰 보라 화로', '돌 받침 위 넓은 쇠 그릇의 큰 보라 불(2×2).', '2×2칸, 아랫줄만 막힘. 높은 제단 양옆에 쌍으로. 보라 빛무리와 함께.', soft=True)
obj('floor_candles', B.floor_candles(), '바닥 초 무리', '높이가 다른 검은·흰 초 셋과 고인 촛농, 보라 불꽃(1×1).', '1칸 바닥 장식(걷기). 마법진 둘레에 대각으로 4~6개, 통로 한가운데 금지.', brows=0, kind='decal')
obj('crimson_window', B.crimson_window(), '검붉은 둥근 창', '굵은 돌테 둥근 창, 여섯 갈래 돌살 사이 검붉은·보라 유리와 가운데 눈(3×3).', '3×3칸 장식(벽 앞면 위, 앞면 3줄 필요). 의식실 북쪽 벽 가운데, 높은 제단 위.', brows=0, kind='decal')
obj('spiral_stair_cult_up', B.spiral_up(), '교단 나선 오름 계단', '둥근 돌 받침단 위 가운데 기둥을 감아 오르는 쐐기 단 8개와 보라 깔개, 마지막 단은 위층으로 뚫린 어둠으로, 받침 앞 해골 초 둘(3×4).',
    '3×4칸. 아래 가운데 칸(입구)만 걷기 = 위층 이동 칸, 나머지 막힘. 방 모서리 바닥 위, 입구 앞 1칸 비움. 위층 같은 칸 자리에 spiral_stair_cult_down.', brows=4, kind='walk')
obj('spiral_stair_cult_down', B.spiral_down(), '교단 나선 내림 계단', '둥근 구멍 둘레 낮은 돌벽, 보라 깔개 깐 쐐기 단이 기둥을 돌아 어둠으로 내려간다(3×3).',
    '3×3칸. 아래 가운데 칸(입구)만 걷기 = 아래층 이동 칸, 나머지 막힘. 아래층 spiral_stair_cult_up 과 같은 칸 자리에 짝으로.', brows=3, kind='walk')

# 바닥·벽·오토타일
EXG_C = O.ground_sample('crack'); EXG_H = O.ground_sample('hard')
kit.add('ground-ash-cracked', EXG_C, 'floor', '잿빛 갈라진 땅', '칩셋 점박이 흙을 재빛 회갈색 램프로 옮기고(밝기 순서 그대로) 주기 48 로 감긴 갈라진 틈과 틈 밑 밝은 턱을 낸 3×3 표본.', '교단 탑 마당·황폐한 언덕 기본 바닥. 3×3 이어 붙여도 이음새 없다.', 0, layer='lower')
kit.add('ground-ash-hard', EXG_H, 'floor', '잿빛 다져진 흙', '칩셋 고운 모래흙을 같은 램프로 옮긴 다져진 땅과 잔돌 점 3×3 표본.', '마당 가운데·길 둘레 다져진 자리. 갈라진 땅과 덩이로 섞는다.', 0, layer='lower')
kit.add('ground-cult-flag', SAMPLES['ct_flag'].copy(), 'floor', '교단 탑 판석', '그을린 회갈색 24×16 마름돌 반장 어긋나게, 돌마다 톤·위 모 밝게, 그을음 얼룩·촛농 점·드문 금 3×3 표본.', '탑 홀·기도실·감방 복도 기본 바닥.', 0, layer='lower')
kit.add('ground-ritual', SAMPLES['ct_ritual'].copy(), 'floor', '의식실 바닥', '두 톤 큰 정사각 판에 검붉게 밴 줄눈과 얼룩, 판 모서리마다 박은 보라 돌 3×3 표본.', '꼭대기 의식실·제단실.', 0, layer='lower')
kit.add('face_cult_3h', face_sample_ct(3, 3), 'wall', '교단 탑 벽 앞면(3줄)', '버들항 성 마름돌을 그을린 회갈색으로 두 단 어둡게 한 쌓은 돌 벽 앞면, 천장 밑 촛불 그을음, 아래 걸레받이 띠(3칸 폭 표본).', '방 천장 밑에 3줄. 모든 방 북쪽 벽에 필수. 바닥보다 어둡다.', 0, role='wall')
kit.add('face_cult_2h', face_sample_ct(3, 2), 'wall', '교단 탑 벽 앞면(2줄)', '같은 돌, 2줄 높이(감방 칸막이·통로).', '감방 칸막이 앞면·좁은 통로 천장 밑에 2줄.', 0, role='wall')
kit.add('ceiling_cult', ceiling_sample(), 'wall', '탑 천장', '어두운 천장 + 벽 윗면 띠, 모서리 포함 3×3 표본.', '방·복도 바깥(벽 너머). 열린 칸에 닿은 쪽만 밝은 띠.', 0, role='wall')
CS_ = B.carpet_sheet(); BS_ = A.bars_sheet(); TS_ = O.trail_sheet()
kit.add('autotile-cult-carpet', CS_, 'autotile', '교단 보라 깔개', '검붉은 테·금 점 띠·안쪽 짙은 보라 줄의 보라 깔개 16변형(위 1·오른쪽 2·아래 4·왼쪽 8), 끝은 술.', '폭 2칸 직선으로 입구에서 제단 앞까지. 걷기. 제단 앞 1칸에서 끝낸다.', 0, layer='lower', role='terrain')
kit.add('autotile-ironbars', BS_, 'autotile', '감방 쇠창살', '위아래 가로 띠와 끝 뾰족한 굵은 세로 창살, 끝·모서리 네모 쇠기둥 16변형.', '감방 앞을 가로로 막는다. 모든 변형 막힘. 감방마다 한 칸을 비우고 cell_gate.', 1, layer='upper', role='fence')
kit.add('autotile-ash-trail', TS_, 'autotile', '잿빛 흙길', '칩셋 고운 모래흙을 재빛으로 옮긴 밟아 다진 흙길, 가장자리 들쭉날쭉한 어두운 테 16변형.', '탑 계단에서 마당 출구까지 폭 2칸, 굽이를 두고 갈림길은 제단·쇠우리로. 걷기.', 0, layer='lower', role='terrain')

# ---------------------------------------------------------------- 지도
W_, H_ = 92, 34
PAN = {'E': (0, 0), 1: (32, 0), 2: (32, 17), 3: (62, 0), 4: (62, 17)}
EXT_W, EXT_H = 30, 34

class TMap(KMap):
    def __init__(s, *a):
        super().__init__(*a); s.lights = []; s.tints = []
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P_ = (x * T, y * T)
                if s.fl[y][x]:
                    im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), P_)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(dlib.face_tile(sty, None, n - k, int(_hash(x, y, 3) * 6), capL, capR, n * T), P_)
                elif x < 32:
                    im.alpha_composite(Image.new('RGBA', (T, T), dlib.VOID[0] + (255,)), P_)      # 판 사이 칸막이(바깥 마당 옆은 띠 없이)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return xx >= 32 and s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(dlib.ceiling(o8, int(_hash(x, y, 4) * 4), False), P_)
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(round(x * T)), int(round(y * T))))
        for (px_, py_, img) in s.lights: im.alpha_composite(img, (int(px_), int(py_)))
        for cells, sheet in s.over:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (int(round(x * T)), (y + 1) * T - img.height))
        for (box, col, a) in s.tints:                                                         # 방 전체 조명 색(의식실 보라·검붉은)
            x0, y0, x1, y1 = box; ov = Image.new('RGBA', ((x1 - x0) * T, (y1 - y0) * T), tuple(col) + (a,))
            reg = im.crop((x0 * T, y0 * T, x1 * T, y1 * T))
            im.paste(Image.alpha_composite(reg, ov), (x0 * T, y0 * T))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

m = TMap(W_, H_, 'cultist-tower')
BAD = []
def gx(f, x): return PAN[f][0] + x
def gy(f, y): return PAN[f][1] + y
def ROWS(f, spec, kind, wh=3):
    """spec = {행: (x0, x1)} 지역 칸 좌표(포함)로 바닥을 연다."""
    for y, (x0, x1) in spec.items(): m.floor(gx(f, x0), gy(f, y), x1 - x0 + 1, 1, kind, wh, 'cult')
def R(f, x0, y0, x1, y1, kind, wh=3): m.floor(gx(f, x0), gy(f, y0), x1 - x0 + 1, y1 - y0 + 1, kind, wh, 'cult')
def CUT(f, x, y, w=1, h=1): m.cut(gx(f, x), gy(f, y), w, h)

def P(name, f, x, y, block=None, layer=1, check=True, img=None):
    """조각을 판 f 의 지역 칸 (x, y)(= 왼쪽 아래 칸)에 놓는다. block 이 없으면 메타의 brows 로 발자국을 잰다."""
    img = img or S[name]; X = gx(f, x); Y = gy(f, y)
    br = kit.meta[name]['brows']
    if block is None:
        block = [] if br == 0 else foot(img, br, 10, name in SOFT)
    if check:
        for (bx, by) in block:
            c = (X + bx, Y + by)
            if not (m.inb(*c) and m.fl[c[1]][c[0]] is not None and c not in m.blocked): BAD.append((name, f, x + bx, y + by))
    m.props_add(X, Y, img, block, layer)
def DEC(name, f, x, y, img=None):
    """벽 앞면 장식: 모든 칸이 앞면이어야 한다."""
    img = img or S[name]; m.compute_faces(); w = -(-img.width // T); h = -(-img.height // T)
    for j in range(h):
        for i in range(w):
            c = (int(gx(f, x)) + i, gy(f, y) + j)
            if c not in m.face: BAD.append((name + '@face', f, x + i, y + j))
    m.decal(gx(f, x), gy(f, y), img)
def FD(name, f, x, y, img=None):
    """바닥 장식: 모든 칸이 바닥이어야 한다."""
    img = img or S[name]; w = -(-img.width // T); h = -(-img.height // T)
    for j in range(h):
        for i in range(w):
            cx_, cy_ = int(gx(f, x) + i), int(gy(f, y) + j)
            if not (m.inb(cx_, cy_) and m.fl[cy_][cx_] is not None): BAD.append((name + '@floor', f, x + i, y + j))
    m.decal(gx(f, x), gy(f, y), img)
def glowc(f, cx, cy, col=(190, 120, 255), size=56, a=55): m.glow_at(gx(f, cx) + .5, gy(f, cy) + .5, glow(size, col, a))
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]
STAIR_UP_BLK = [(dx, -dy) for dx in range(3) for dy in range(4) if not (dx == 1 and dy == 0)]
STAIR_DN_BLK = [(dx, -dy) for dx in range(3) for dy in range(3) if not (dx == 1 and dy == 0)]
PURP = (176, 110, 250); CRIMG = (230, 70, 70)

# ======== 바깥 마당 (E) — 칩셋 흙 재색칠 땅을 판 전체 화소로 한 장 그린다(16px 반복이 안 남게)
R('E', 0, 0, EXT_W - 1, EXT_H - 1, 'ct_ext', 1)
_dark = np.zeros((EXT_H * T, EXT_W * T))
_yy, _xx = np.mgrid[0:EXT_H * T, 0:EXT_W * T]
_dark += np.clip(1 - np.hypot((_xx - 16 * 15.5) / 90.0, (_yy - 16 * 15.2) / 30.0), 0, 1) * .9        # 탑 발치 그늘(남동쪽으로)
_dark += np.clip(1 - np.hypot((_xx - 16 * 5.5) / 70.0, (_yy - 16 * 21.5) / 50.0), 0, 1) * .7         # 제단 고리 둘레
EXT = Image.fromarray(ground_ash(EXT_W * T, EXT_H * T, 17, dark=_dark).astype(np.uint8)).convert('RGBA')
dlib.FLOORS['ct_ext'] = lambda cx, cy: EXT.crop((cx * T, cy * T, cx * T + T, cy * T + T))

# 흙길: 탑 계단 → 남쪽 출구(굽이), 갈림길 서쪽 제단·동쪽 쇠우리
trail = set()
def tr(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): trail.add((x, y))
tr(14, 15, 17, 22); tr(13, 14, 23, 27); tr(14, 15, 28, 33); tr(13, 13, 22, 22)
tr(9, 12, 21, 22); tr(15, 19, 26, 27); tr(16, 16, 25, 25)
m.under.append((trail, TS_))

# 탑과 계단
TOWER_BLK = [b for b in foot(S['cult_tower'], 11, 10, False) if b != (3, 0)]
P('cult_tower', 'E', 11, 14, block=TOWER_BLK)
m.decal(12.5, 15, S['tower_steps']); STEP_BLK = [(12, 16), (16, 16)]
# 탑 창·화로 빛
for (wx, wy) in ((11 + 1.6, 14 - 2.4), (11 + 3.0, 14 - 4.5), (11 + 4.3, 14 - 6.6), (11 + 5.4, 14 - 8.6)): m.glow_at(wx, wy, glow(28, PURP, 45))
m.glow_at(14.0, 2.4, glow(64, PURP, 60))
for (x, y) in ((10, 17), (18, 17)): P('cult_banner_pole', 'E', x, y)
# 제단 고리(서쪽)
P('stone_altar_out', 'E', 4, 21)
FD('sigil_stone', 'E', 4.5, 22)
for (n, x, y) in (('standing_stone', 2, 19), ('standing_stone', 7, 18), ('standing_stone_broken', 9, 20), ('standing_stone', 1, 23),
                  ('standing_stone', 8, 25), ('standing_stone_broken', 4, 26), ('standing_stone', 5, 18)):
    P(n, 'E', x, y)
FD('bone_scatter_out', 'E', 2, 24); P('bone_cairn', 'E', 10, 23); P('skull_pike', 'E', 7, 23)
m.glow_at(5.5, 20.5, glow(48, PURP, 40))
# 해골 말뚝(길가, 번갈아)
for (x, y) in ((12, 19), (16, 21), (12, 25), (16, 29), (13, 31), (17, 24)): P('skull_pike', 'E', x, y)
# 쇠우리(동쪽 갈림)
P('gibbet_cage', 'E', 20, 26); P('gibbet_cage', 'E', 23, 24, img=hflip(S['gibbet_cage']))
FD('bone_scatter_out', 'E', 21, 28); P('bone_cairn', 'E', 18, 25); P('rocks_ash', 'E', 24, 27)
# 고목 덩이
TREES = [('ash_tree_big', 1, 7), ('ash_tree', 4, 5), ('ash_tree_b', 6, 9), ('ash_tree', 2, 12), ('ash_tree_b', 8, 4), ('ash_tree', 0, 16),
         ('ash_tree_big', 23, 8), ('ash_tree', 21, 4), ('ash_tree_b', 26, 5), ('ash_tree', 20, 11), ('ash_tree_b', 26, 12), ('ash_tree', 23, 15),
         ('ash_tree_big', 25, 21), ('ash_tree', 27, 25), ('ash_tree_b', 22, 31), ('ash_tree', 26, 30), ('ash_tree_big', 19, 33),
         ('ash_tree', 1, 30), ('ash_tree_b', 4, 33), ('ash_tree_big', 7, 31), ('ash_tree', 10, 28), ('ash_tree_b', 0, 27)]
for (n, x, y) in TREES: P(n, 'E', x, y)
for (x, y) in ((3, 2), (9, 1), (18, 2), (27, 1), (10, 12), (19, 14), (28, 17), (21, 19), (1, 20), (11, 33), (27, 33), (8, 15), (24, 1)): P('rocks_ash', 'E', x, y)
GR = [(2, 8), (5, 6), (7, 10), (3, 13), (9, 5), (1, 17), (22, 5), (24, 9), (27, 6), (21, 12), (27, 13), (24, 16), (26, 22), (28, 26), (23, 32),
      (27, 31), (2, 31), (5, 32), (8, 32), (11, 29), (1, 28), (20, 33), (6, 27), (10, 26), (3, 18), (8, 22), (19, 21), (22, 22), (18, 30),
      (11, 16), (19, 17), (0, 4), (6, 1), (12, 0), (17, 0), (20, 1), (29, 3), (29, 9), (28, 20), (16, 32), (10, 20), (25, 29), (6, 15), (25, 18)]
for i, (x, y) in enumerate(GR):
    if (x, y) in trail: continue
    FD('dead_grass' if i % 3 else 'dead_grass_b', 'E', x, y)
for (x, y) in ((13, 18), (17, 18)): P('bone_cairn', 'E', x - (1 if x < 15 else -1), y + 1) if False else None

# ======== 1층 홀 (f=1) — 둥근 방(행 4~13), 남쪽 입구(14~15, 14~15)
ROWS(1, {4: (8, 21), 5: (5, 24), 6: (3, 26), 7: (3, 26), 8: (3, 26), 9: (3, 26), 10: (3, 26), 11: (3, 26), 12: (5, 24), 13: (8, 21)}, 'ct_flag')
R(1, 14, 14, 15, 15, 'ct_flag', 1)
carpet = {(gx(1, x), gy(1, y)) for x in (14, 15) for y in range(7, 16)}
m.under.append((carpet, CS_))
P('spiral_stair_cult_up', 1, 5, 8, block=STAIR_UP_BLK)
P('hall_altar', 1, 13, 5, block=BX(3, 2))
for x in (10, 18): DEC('cult_tapestry', 1, x, 1)
for x in (12, 17): DEC('sconce_purple', 1, x, 2); glowc(1, x, 2, size=40, a=50)
for (n, x, y) in (('wall_mask', 6, 3), ('wall_mask_red', 23, 3), ('wall_mask', 8, 2), ('wall_mask_red', 21, 1)): DEC(n, 1, x, y)
for (x, y) in ((11, 5), (17, 5)): P('skull_candelabra', 1, x, y); glowc(1, x, y - 1)
for (x, y) in ((12, 6), (17, 6)): FD('kneel_cushion', 1, x, y)
for (x, y) in ((10, 8), (10, 10), (17, 8), (17, 10)): P('cult_pew', 1, x, y, img=A.cult_pew(x * 3 + y))
for (x, y) in ((12, 13), (17, 13)): P('brazier_purple', 1, x, y); glowc(1, x, y - 1)
P('robe_rack', 1, 3, 10); P('mask_rack', 1, 24, 10, block=BX(2, 2))
P('ritual_urn', 1, 23, 7); P('ritual_urn_small', 1, 24, 7); P('ritual_urn', 1, 3, 12 - 0) if False else None
P('skull_candelabra', 1, 25, 8); glowc(1, 25, 7)
P('ritual_urn', 1, 5, 12); P('ritual_urn_small', 1, 6, 12); P('ritual_urn_small', 1, 23, 12)
for (x, y) in ((8, 6), (21, 6), (9, 12), (20, 12), (3, 8), (26, 9), (8, 9), (21, 11)): FD('skull_candle', 1, x, y); glowc(1, x, y, size=28, a=45)
FD('chain_floor', 1, 6, 10)
FD('kneel_cushion', 1, 12, 11, img=S['kneel_cushion']); FD('kneel_cushion', 1, 17, 12)

# ======== 2층 (f=2) — 서쪽 기도실(2~13, 5~14) · 동쪽 감방 복도(16~27, 6~14)와 북쪽 감방 셋 · 통로(14~15, 10~11)
ROWS(2, {5: (4, 11), 6: (2, 13), 7: (2, 13), 8: (2, 13), 9: (2, 13), 10: (2, 13), 11: (2, 13), 12: (2, 13), 13: (2, 13), 14: (4, 11)}, 'ct_flag')
ROWS(2, {6: (16, 27), 7: (16, 27), 8: (16, 27), 9: (16, 27), 10: (16, 27), 11: (16, 27), 12: (16, 27), 13: (16, 27), 14: (17, 27)}, 'ct_flag')
R(2, 14, 10, 15, 11, 'ct_flag', 2)
for x0 in (17, 20, 23): R(2, x0, 4, x0 + 1, 5, 'cell', 2)                               # 감방 셋(2×2), 칸막이 19·22 — 앞면 2줄
P('spiral_stair_cult_down', 2, 5, 8, block=STAIR_DN_BLK)
P('prayer_idol', 2, 8, 7); m.glow_at(gx(2, 9), gy(2, 5) + .2, glow(56, PURP, 60))
for x in (10, 12): P('offering_bowl', 2, x, 6) if x == 10 else P('offering_bowl', 2, 11, 6)
DEC('cult_tapestry', 2, 11, 2); DEC('sconce_purple', 2, 8, 3) if False else None
for (x, y) in ((7, 9), (10, 9), (8, 10), (11, 10)): FD('kneel_cushion', 2, x, y)
P('cult_pew', 2, 6, 12, img=A.cult_pew(5)); P('cult_pew', 2, 10, 13, img=A.cult_pew(9))
P('brazier_purple', 2, 2, 10); glowc(2, 2, 9); P('brazier_purple', 2, 13, 8); glowc(2, 13, 7)
P('mask_rack', 2, 2, 13, block=BX(2, 2)); P('ritual_urn', 2, 12, 13); P('ritual_urn_small', 2, 13, 12) if False else None
for (x, y) in ((3, 7), (12, 11), (5, 14), (9, 14)): FD('skull_candle', 2, x, y); glowc(2, x, y, size=28, a=45)
DEC('wall_mask', 2, 3, 4); DEC('wall_mask_red', 2, 12, 4)
# 감방
bars = {(gx(2, x), gy(2, 6)) for x in range(16, 26) if x not in (18, 21, 24)}
m.over.append((bars | {(gx(2, x), gy(2, 6)) for x in (18, 21, 24)}, BS_)) if False else m.over.append((bars, BS_))
for c in bars: m.blocked.add(c)
for x in (18, 21, 24):
    P('cell_gate', 2, x, 6, block=[]); m.hidden.add((gx(2, x), gy(2, 6)))
P('plank_bed', 2, 17, 4, block=[(0, 0), (1, 0)]); FD('straw_pile', 2, 20, 5); P('cell_bucket', 2, 21, 4)
FD('cell_bones', 2, 23, 5); FD('chain_floor', 2, 23, 4)
for x in (17, 21, 24): DEC('chains_wall', 2, x, 2)
for x in (19, 22): DEC('sconce_purple', 2, x, 3)
# 감방 복도
P('spiral_stair_cult_up', 2, 24, 14, block=STAIR_UP_BLK)
for (x, y) in ((17, 9), (27, 8)): P('brazier_purple', 2, x, y); glowc(2, x, y - 1)
P('ritual_table', 2, 20, 10, block=BX(2, 2)); P('cell_bucket', 2, 27, 11); P('ritual_urn', 2, 16, 13)
FD('chain_floor', 2, 18, 12); FD('straw_pile', 2, 21, 13); FD('cell_bones', 2, 26, 7); FD('skull_candle', 2, 23, 8)
P('robe_rack', 2, 17, 14 - 0) if False else P('robe_rack', 2, 19, 14)
P('ritual_urn_small', 2, 22, 14); FD('skull_candle', 2, 16, 11)

# ======== 3층 서고 (f=3) — 둥근 방(행 4~14), 동남 모서리를 넓혀 내림 계단
ROWS(3, {4: (8, 21), 5: (5, 24), 6: (3, 26), 7: (3, 26), 8: (3, 26), 9: (3, 26), 10: (3, 26), 11: (3, 26), 12: (3, 26), 13: (5, 27), 14: (8, 27)}, 'plank')
P('spiral_stair_cult_down', 3, 24, 14, block=STAIR_DN_BLK)
P('spiral_stair_cult_up', 3, 21, 8, block=STAIR_UP_BLK)
for x in (8, 10, 15, 17): P('forbidden_bookcase', 3, x, 6, block=[(0, 0), (1, 0)], img=B.forbidden_bookcase(x))
DEC('cult_tapestry', 3, 12.5, 1); DEC('wall_mask', 3, 6, 3); DEC('wall_mask_red', 3, 20, 2); DEC('sconce_purple', 3, 19, 2)
P('jar_shelf', 3, 3, 8, block=BX(2, 2)); P('ritual_table', 3, 25, 11, block=BX(2, 2))
P('grimoire_lectern', 3, 14, 10); m.glow_at(gx(3, 14) + .5, gy(3, 8) + .8, glow(64, PURP, 70))
for (x, y) in ((12, 9), (16, 9), (12, 11), (16, 11)): FD('floor_candles', 3, x, y); glowc(3, x, y, size=28, a=45)
P('chained_bookcase_low', 3, 5, 12, block=BX(2, 2), img=B.chained_bookcase_low(1))
P('chained_bookcase_low', 3, 9, 14, block=BX(2, 2), img=B.chained_bookcase_low(2))
P('chained_bookcase_low', 3, 19, 13, block=BX(2, 2), img=B.chained_bookcase_low(3))
P('cauldron', 3, 3, 11, block=BX(2, 2)) if False else P('cauldron', 3, 7, 9, block=BX(2, 2)); glowc(3, 8, 8, size=48, a=50)
for (x, y) in ((3, 9), (13, 13), (18, 7), (26, 8), (11, 12), (6, 13), (22, 10)): FD('scroll_heap', 3, x, y)
P('skull_candelabra', 3, 12, 6); glowc(3, 12, 5); P('ritual_urn', 3, 26, 9) if False else P('ritual_urn', 3, 24, 9)
P('ritual_urn_small', 3, 3, 12); P('ritual_urn_small', 3, 17, 14)
FD('book_pile_x', 3, 0, 0) if False else None
FD('skull_candle', 3, 22, 12); FD('skull_candle', 3, 4, 7)

# ======== 꼭대기 의식실 (f=4) — 둥근 방(행 4~14)
ROWS(4, {4: (8, 21), 5: (5, 24), 6: (3, 26), 7: (3, 26), 8: (3, 26), 9: (3, 26), 10: (3, 26), 11: (3, 26), 12: (3, 26), 13: (5, 24), 14: (8, 21)}, 'ct_ritual')
P('spiral_stair_cult_down', 4, 21, 8, block=STAIR_DN_BLK)
P('high_altar', 4, 12, 6, block=[(dx, -dy) for dx in range(4) for dy in range(2)])
DEC('crimson_window', 4, 12.5, 1); m.glow_at(gx(4, 14), gy(4, 2.5), glow(80, CRIMG, 50))
for x in (8, 18): DEC('cult_tapestry', 4, x, 1)
P('brazier_big', 4, 9, 6); P('brazier_big', 4, 17, 6)
for x in (10, 18): m.glow_at(gx(4, x), gy(4, 4.6), glow(80, PURP, 70))
FD('magic_circle', 4, 10.5, 7.6); m.glow_at(gx(4, 14), gy(4, 11.1), glow(120, PURP, 46))
for (x, y) in ((9, 8), (19, 8), (8, 11), (20, 11), (9, 14), (19, 14)): FD('floor_candles', 4, x, y); glowc(4, x, y, size=30, a=50)
for (x, y) in ((5, 8), (24, 11)): P('skull_candelabra', 4, x, y); glowc(4, x, y - 1)
P('ritual_table', 4, 3, 11, block=BX(2, 2)); P('ritual_urn', 4, 25, 13 - 1) if False else P('ritual_urn', 4, 23, 13)
P('ritual_urn_small', 4, 22, 12); FD('chain_floor', 4, 5, 13); FD('chain_floor', 4, 22, 9)
P('mask_rack', 4, 25, 9, block=BX(2, 2)) if False else P('offering_bowl', 4, 24, 7)
for (x, y) in ((3, 7), (6, 6), (25, 7), (6, 12), (23, 6)): FD('skull_candle', 4, x, y)
DEC('wall_mask', 4, 6, 3); DEC('wall_mask_red', 4, 23, 3); DEC('chains_wall', 4, 4, 4) if False else DEC('chains_wall', 4, 5, 2)
P('robe_rack', 4, 3, 9)
m.tints.append(((gx(4, 2), gy(4, 0), gx(4, 28), gy(4, 16)), (110, 30, 120), 34))
m.tints.append(((gx(3, 0), gy(3, 0), gx(3, 30), gy(3, 17)), (40, 20, 60), 22))
m.tints.append(((gx(1, 0), gy(1, 0), gx(2, 30), gy(2, 17)), (40, 20, 60), 22))

if BAD: print('배치 오류', BAD)

# ---------------------------------------------------------------- 통행: 출입·층 이동 고리를 더한 BFS
for c in STEP_BLK: m.blocked.add(c)
LINKS = [((14, 14), (gx(1, 14), gy(1, 15))), ((gx(1, 6), gy(1, 8)), (gx(2, 6), gy(2, 8))),
         ((gx(2, 25), gy(2, 14)), (gx(3, 25), gy(3, 14))), ((gx(3, 22), gy(3, 8)), (gx(4, 22), gy(4, 8)))]
def bfs_all(start):
    from collections import deque
    adj = {}
    for a, b in LINKS: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = {start: 0}; q = deque([start])
    while q:
        c = q.popleft()
        for n in [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)] + adj.get(c, []):
            if n not in seen and m.is_walk(*n): seen[n] = seen[c] + 1; q.append(n)
    return seen
ENT = (14, 33)
m.render()
reach = bfs_all(ENT)
WP = {'마당 남쪽 출입구': ('E', 14, 33), '바깥 제단 앞': ('E', 5, 23), '쇠우리 곁': ('E', 19, 27), '탑 문': ('E', 14, 14),
      '1층 입구': (1, 14, 15), '홀 제단 앞': (1, 14, 6), '1층 나선 계단 입구': (1, 6, 8),
      '2층 도착': (2, 6, 8), '기도실 우상 앞': (2, 9, 9), '감방 A': (2, 18, 5), '감방 B': (2, 21, 5), '감방 C': (2, 24, 5), '2층 나선 계단 입구': (2, 25, 14),
      '3층 도착': (3, 25, 14), '마도서 앞': (3, 14, 11), '3층 나선 계단 입구': (3, 22, 8),
      '꼭대기 도착': (4, 22, 8), '마법진 한가운데': (4, 14, 11), '높은 제단 앞': (4, 14, 7)}
wp_res = {k: dict(at=[gx(f, x), gy(f, y)], panel=str(f), reach=(gx(f, x), gy(f, y)) in reach, steps=reach.get((gx(f, x), gy(f, y)))) for k, (f, x, y) in WP.items()}
hid = set(m.hidden); m.hidden = set(); reach_nohid = bfs_all(ENT); m.hidden = hid
walk_total = sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
unreached = [(x, y) for y in range(H_) for x in range(W_) if m.is_walk(x, y) and (x, y) not in reach]

def used_cells():
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((int(x) + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    return used
def emp_panel(f):
    """판마다(그 판 안에서만) 20×15 창 빈 바닥 비율 — 다른 판 칸이 섞이지 않게 잘라 잰다. 흙길·깔개는 빈 바닥으로 센다."""
    used = used_cells(); x0p, y0p = PAN[f]; wpn = EXT_W if f == 'E' else 30; hpn = EXT_H if f == 'E' else 17
    vals = []
    for y0 in range(y0p, y0p + hpn - 15 + 1):
        for x0 in range(x0p, x0p + wpn - 20 + 1):
            e = sum(1 for y in range(y0, y0 + 15) for x in range(x0, x0 + 20) if m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked)
            vals.append((round(e / 300.0, 3), (x0 - x0p, y0 - y0p)))
    vals.sort(reverse=True)
    return dict(max=vals[0][0], at_local=vals[0][1], over40=sum(1 for v in vals if v[0] > .4), windows=len(vals))
EMPF = {str(f): emp_panel(f) for f in PAN}
print('empty by panel', EMPF)
if os.environ.get('EMPDBG'):
    f = os.environ['EMPDBG']; f = f if f == 'E' else int(f); used = used_cells(); x0p, y0p = PAN[f]
    for y in range(y0p, y0p + (34 if f == 'E' else 17)):
        print(''.join('.' if (m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked) else ('#' if m.fl[y][x] is not None else ' ') for x in range(x0p, x0p + 30)))

# 키 큰 물체 걷기 규약 검사: 부드러운 물체는 맨 아랫줄만 막힌다
soft_violation = []
for (x, y, img, w, h, layer) in m.props:
    pass
data = m.export(OUT, ENT, (gx(4, 14), gy(4, 11)), {}, extra=dict(
    kind='cultist-tower', panels={'바깥 마당': [0, 29, 0, 33], '1층 홀': [32, 61, 0, 16], '2층 기도실·감방': [32, 61, 17, 33], '3층 서고': [62, 91, 0, 16], '꼭대기 의식실': [62, 91, 17, 33]},
    emptiness_by_panel=EMPF, emptiness=dcheck.emptiness(m), stair_links=[[list(a), list(b)] for a, b in LINKS], waypoints_with_links=wp_res,
    reach_all_with_links=len(reach), walkable_cells=walk_total, unreached_cells=len(unreached), unreached_list=unreached[:40],
    cells_reachable_without_gate_keys=sum(1 for k in ('감방 A', '감방 B', '감방 C') if (gx(2, WP[k][1]), gy(2, WP[k][2])) in reach_nohid)))
print('walk', walk_total, 'reached', len(reach), 'unreached', len(unreached), unreached[:20])
print('wp', {k: (v['reach'], v['steps']) for k, v in wp_res.items()})
print('parts', kit.save())

# ---------------------------------------------------------------- 비교 시트: 같은 2배율로 [버들항 기준 | 신도의 탑]
REF = os.path.join(OUT, '..', '..', 'beodeul-city', 'render', 'city6_base.png')
REFT = os.path.join(OUT, '..', 'tower-interior', 'render-1x.png')
REFW = os.path.join(OUT, '..', 'wasteland-world', 'render-1x.png')
REFD = os.path.join(OUT, '..', 'dark-fortress', 'render-1x.png')
render = m.img
_ff = [f for f in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf') if os.path.exists(f)]
_font = ImageFont.truetype(_ff[0], 14) if _ff else None
cw, ch = 208, 176
def pc(f, x, y): return render.crop((PAN[f][0] * T + x, PAN[f][1] * T + y, PAN[f][0] * T + x + cw, PAN[f][1] * T + y + ch))
rows = [
    [('버들항 성 석재·원탑 (city6_base)', Image.open(REF).convert('RGBA').crop((240, 0, 240 + cw, ch))), ('탑 바깥: 원통 탑·계단·깃대', render.crop((112, 40, 112 + cw, 40 + ch))), ('바깥 제단 고리·고목', render.crop((0, 260, cw, 260 + ch)))],
    [('황폐 필드 땅·고목 (기준, 웨이브 2)', Image.open(REFW).convert('RGBA').crop((760, 120, 760 + cw, 120 + ch))), ('1층 홀: 제단·휘장·긴 의자', pc(1, 120, 8)), ('2층 감방·쇠창살', pc(2, 250, 20))],
    [('탑 내부 서재 (기준, 웨이브 2)', Image.open(REFT).convert('RGBA').crop((34 * 16 + 40, 40, 34 * 16 + 40 + cw, 40 + ch))), ('3층 서고: 금서 책장·마도서', pc(3, 100, 20)), ('2층 기도실 우상', pc(2, 20, 30))],
    [('마왕성 의식실 (기준, 웨이브 1)', Image.open(REFD).convert('RGBA').crop((Image.open(REFD).width - 400, 40, Image.open(REFD).width - 400 + cw, 40 + ch))), ('꼭대기 의식실: 마법진·높은 제단', pc(4, 120, 20)), ('나선 계단 쌍(1층 오름·2층 내림)', render.crop((PAN[1][0] * T + 40, 40, PAN[1][0] * T + 40 + cw, 40 + ch)))],
]
sheet = Image.new('RGBA', (3 * (cw * 2 + 8) + 8, len(rows) * (ch * 2 + 26) + 4), (24, 22, 30, 255)); dr = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for i, (lab, t) in enumerate(row):
        x = 8 + i * (cw * 2 + 8); y = 4 + r * (ch * 2 + 26)
        sheet.alpha_composite(t.resize((cw * 2, ch * 2), Image.NEAREST), (x, y + 20))
        dr.text((x, y + 2), lab, fill=(230, 226, 236, 255), font=_font)
sheet.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))
