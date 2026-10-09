# 대나무 숲 계곡 — 내보낼 조각 목록(이름, 그리는 함수, kind, 한글 이름, 설명, 놓는 법, 막는 아랫줄, 층, 역할, 걷기).
# 팩 하나로 닫힌다: 맨 바탕 표본(ground-*) · 땅 덩이 오토타일(autotile-*) · 건물·다리·폭포 · 식생 · 소품을 모두 이 폴더에 둔다.
import ek_props as EP
import bv_build as B, bv_props as P, bv_ground as G

_T = '키 큰 부드러운 물체: 맨 아랫줄(밑동)만 막히고 위 칸은 걷기 + 위층(가림). '
_S = '단단한 몸통: 아랫줄이 막히고 윗면은 걷기 + 위층. '
_D = '땅 장식: 걷기 + 사람 아래. '
_BLD = '건물: 앞면 벽 줄이 막히고 지붕 칸은 걷기 + 위층(뒤로 지나가면 가린다), 문 칸은 걷기. 문 앞 한 칸은 비운다. '
_AT = '16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸 0). 아래층 투명 덧그림(밑 땅이 보인다). '

PARTS = [
    # ---------------------------------------------------------------- 맨 바탕 표본 (3x3, 이음새 없음)
    ('ground-valley-grass', lambda: G.ground_grass(None), 'floor', '계곡 풀밭', '버들항 칩셋 잔디 그대로의 맨 바탕 풀 3x3. 이 장소의 기본 땅.',
     '걷기. 지도 전체를 먼저 이 풀로 칠한 뒤 아래 오토타일 덩이를 얹는다.', 0, None, 'terrain', True),
    ('ground-grass-sprig', lambda: G.ground_grass('sprig'), 'floor', '고사리 새순 풀', '풀 위에 고사리 새순·잔 풀 포기가 돋은 변화 바닥 3x3.',
     '걷기. 빈터·길가 풀에 섞어 깐다(같은 풀밭 안에서 칸마다 섞으면 단조롭지 않다).', 0, None, 'terrain', True),
    ('ground-grove-shade', lambda: G.ground_grass('shade'), 'floor', '대숲 그늘 풀', '대숲 밑 그늘진 풀(짙은 풀 점 + 떨어진 대나무 잎 몇) 3x3.',
     '걷기. 대숲 덩이 밑동 둘레에 깐다. 빛 드는 빈터에는 쓰지 않는다.', 0, None, 'terrain', True),
    ('ground-dirt', G.ground_dirt, 'floor', '다진 흙', '칩셋 흙(16,224) 결 + 잔 자갈 점의 다진 흙 마당 3x3. 오솔길 오토타일 속과 같은 결이라 이어진다.',
     '걷기. 집 앞 마당 한가운데. 가장자리는 autotile-leaf-trail 로 감싸 풀과 들쭉날쭉하게 잇는다.', 0, None, 'terrain', True),
    ('ground-leaf-litter', G.ground_litter, 'floor', '대나무 잎 땅', '마른 대나무 잎이 겹겹이 쌓인 대숲 바닥 3x3(autotile-bamboo-litter 의 속 칸과 같은 결).',
     '걷기. 넓은 대숲 속을 통째로 덮을 때. 풀과 맞닿는 곳은 오토타일로.', 0, None, 'terrain', True),
    ('ground-flagstone', G.ground_flag, 'floor', '화강암 판석', '크기가 제각각인 회색 화강암 판석(줄눈에 이끼) 3x3. 정자 앞 마당·감실 터.',
     '걷기. 2~3줄 넓이로 건물 앞에만. 길 전체를 판석으로 깔지 않는다(죽림 오솔길은 흙).', 0, None, 'terrain', True),
    ('ground-pebble-shore', G.ground_pebble, 'floor', '물가 자갈', '작은 강돌(희게 바랜 윗면) + 틈의 모래 흙 3x3. 개울 기슭·징검다리 끝.',
     '걷기. 개울 둑 바깥 1~3칸, 줄마다 폭을 바꿔 들쭉날쭉하게.', 0, None, 'terrain', True),
    # ---------------------------------------------------------------- 땅 덩이 오토타일
    ('autotile-stream', G.autotile_stream, 'autotile', '개울 물(강돌 둑)', '둥근 강돌 둑(돌 틈 이끼 · 물 닿는 줄 물때)으로 둘러싼 개울 16변형. 북쪽 둑은 돌 앞면이 물로 내려가며 그늘, '
     '가장자리 칸에 흐름 줄·물가 거품. 물은 버들항 운하 물 톤.',
     _AT + '모든 변형 막힘(물). 폭 2~4칸 띠로 굽이치게 칠하고(줄마다 한 칸씩 어긋나게), 위쪽 끝은 폭포 밑 웅덩이(3x3 이상 덩이)로. '
     '건너는 곳에 stone_bridge·bamboo_bridge·stepping_stones. 직선·직각 둑 금지.', 1, 'lower', 'water', False),
    ('autotile-bamboo-litter', G.autotile_litter, 'autotile', '대나무 잎 깔린 땅', '마른 대나무 잎 켜(볏짚·누런 올리브) 덩이 16변형. 가장자리는 잎이 듬성해지며 풀 위로 흩어진다.',
     _AT + '걷기. 대숲 덩이 밑동 둘레에 3~12칸 덩이로. 오솔길·물가는 피한다.', 0, 'lower', 'terrain', True),
    ('autotile-moss', G.autotile_moss, 'autotile', '이끼 덩이', '두툼한 이끼 방석 16변형: 북·서 끝 빛 테, 남쪽 끝은 방석 두께(앞면 2px) + 밑 흙 그늘, 홀씨 점.',
     _AT + '걷기. 개울 둑 곁·바위 둘레·감실 터에 2~8칸 덩이로. 큰 판으로 깔지 않는다.', 0, 'lower', 'terrain', True),
    ('autotile-leaf-trail', G.autotile_trail, 'autotile', '낙엽 깔린 오솔길', '칩셋 흙 결 오솔길 16변형: 대나무 잎·붉은 낙엽이 드문드문, 끝은 풀이 먹어 든 들쭉날쭉 + 삐친 풀 포기 + 자갈.',
     _AT + '걷기. 폭 2칸으로 굽이치게 이어 그리고(lay_path), 다리 끝·문 앞에 닿게. 마당은 ground-dirt 둘레를 이것으로 감싼다.', 0, 'lower', 'terrain', True),
    ('autotile-bamboo-rail', G.autotile_rail, 'autotile', '대나무 난간 울타리', '낮은 대나무 울타리 16변형: 대 기둥 + 가로대 둘 + 새끼 매듭, 남북 이웃은 위에서 본 가로대 줄.',
     '16변형 오토타일(위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8), 위층 투명. 모든 변형 막힘. 마당 둘레에 한 줄로, 드나드는 곳 2칸은 비우고 bamboo_gate.', 1, 'upper', 'fence', False),
    # ---------------------------------------------------------------- 건물·구조물(앵커)
    ('hermit_hut', B.hermit_hut, 'object', '은자의 초가', '두툼한 초가 지붕 · 막돌 기단 · 세로 대나무 벽 + 흰 흙벽 둥근 달 창 · 반쯤 연 널문 · 대 난간 툇마루. 계곡의 중심 앵커.',
     _BLD + '아래 2줄 막힘, 문 칸(왼쪽에서 셋째 칸)만 걷기. 앞에 다진 흙 마당, 둘레 대 울타리.', 2, None, 'building', False),
    ('hut_shed', B.hut_shed, 'object', '초가 헛간', '외쪽 초가 지붕 + 대 기둥 셋 + 트인 속에 쌓은 장작·대 다발. 초가 곁에.', _BLD + '아래 2줄 막힘.', 2, None, 'building', False),
    ('pavilion', B.pavilion, 'object', '죽림 정자', '막돌 기단 + 가운데 돌계단 · 주칠 기둥 넷 · 낮은 난간 · 처마 끝이 들린 회청 기와 모임지붕. 폭포 웅덩이 곁의 쉼터 앵커.',
     _BLD + '기단 아래 2줄 막힘, 가운데 계단·마루 칸(왼쪽에서 셋째 열) 걷기. 앞에 판석 마당 2줄과 돌등 둘.', 2, None, 'building', False),
    ('stone_bridge', lambda: B.stone_bridge(5), 'object', '돌 아치 다리', '반원 아치 돌다리(동서) 5x3칸: 가운데 줄 판돌 바닥, 위 줄 북쪽 돌 난간, 아래 줄 남쪽 난간 + 쐐기돌 아치 앞면.',
     '가운데 줄만 걷기, 위·아래 줄 막힘. 개울 폭 + 양쪽 둑 1칸씩을 덮게 놓는다(폭이 넓으면 stone_bridge 함수의 w 를 늘린다). 양 끝에 오솔길.', 1, None, 'building', False),
    ('bamboo_bridge', lambda: B.bamboo_bridge(4), 'object', '죽교(대나무 다리)', '남북으로 놓아 묶은 굵은 대 바닥 + 북쪽 대 난간(동서) 4x2칸.',
     '아랫줄(바닥)만 걷기. 윗줄 난간은 물 위라 막힘. 좁은 개울(2~3칸)에. 양 끝 오솔길.', 0, None, 'building', False),
    ('waterfall', B.waterfall, 'object', '작은 폭포', '겹친 이끼 바위 벼랑 가운데로 떨어지는 물줄기 + 밑 물보라 4x4칸.',
     '칸 전부 막힘. 개울 맨 위 끝, 바로 남쪽에 개울 오토타일 웅덩이. 양옆에 바위·바위 소나무.', 4, None, 'building', False),
    ('bamboo_gate', B.bamboo_gate, 'object', '사립문', '대 기둥 둘 + 반쯤 열린 대 살문 2x2칸.', '문 칸 둘 걷기. 대 울타리가 끊긴 2칸에 끼운다.', 0, None, 'prop', True),
    ('stone_steps', lambda: EP.stone_steps(3, 2, seed=8), 'object', '돌계단', '막돌 볼 사이 화강암 돌계단 3x2칸(바닥 위 — 시트 모양 그대로).',
     '걷기(계단). 높은 땅·기단 앞에. 계단 양옆은 막는다.', 0, None, 'prop', True),
    # ---------------------------------------------------------------- 대나무·식생
    ('bamboo_thicket', lambda: P.bamboo_thicket(seed=101, w=4, h=7), 'tree', '빽빽한 대숲 덩이', '줄기 열둘 + 잎 덩이 세 겹(뒤 어둡게 · 앞 처진 잎 다발) 4x7칸. 대숲을 메우는 큰 덩이.',
     _T + '밑동 4칸 막힘. 2~3줄 간격으로 엇갈려 겹쳐 놓아 빽빽하게, 수관이 길·개울 앞 4줄을 덮지 않게. 빈터를 군데군데 남긴다.', 1, None, 'tree', False),
    ('bamboo_thicket_b', lambda: P.bamboo_thicket(seed=104, w=3, h=6), 'tree', '대숲 덩이(작은)', '3x6칸 대숲 덩이(줄기 아홉). 큰 덩이 사이 틈을 메운다.', _T + '밑동 3칸 막힘.', 1, None, 'tree', False),
    ('bamboo_clump', lambda: P.bamboo_clump(seed=201, n=5, w=2, h=5), 'tree', '대나무 덤불', '줄기 다섯 + 처진 잎 다발 2x5칸. 대숲 가장자리·길가.', _T + '밑동 2칸 막힘.', 1, None, 'tree', False),
    ('bamboo_single', lambda: P.bamboo_single(seed=301), 'tree', '홀로 선 대나무', '굵은 줄기 하나 + 꼭대기 잎 다발 1x5칸. 빈터 가장자리에 드문드문.', _T + '밑동 1칸 막힘.', 1, None, 'tree', False),
    ('bamboo_young', lambda: EP.bamboo_young(seed=401), 'tree', '어린 대나무', '가는 줄기 둘 + 잎 줄 1x3칸. 덤불 가장자리를 부드럽게 끝낼 때.', _T + '밑동 1칸 막힘.', 1, None, 'tree', False),
    ('bamboo_shoots', P.bamboo_shoots, 'decal', '죽순', '껍질 겹친 죽순 셋 1x1칸.', _D + '대숲 밑·빈터 가장자리에 하나씩.', 0, None, 'decal', True),
    ('bamboo_stumps', P.bamboo_stumps, 'decal', '대 그루터기', '비스듬히 잘린 대 셋(속 빈 마구리) 1x1칸.', _D + '베어 낸 자리(헛간 곁·길가).', 0, None, 'decal', True),
    ('fallen_bamboo', P.fallen_bamboo, 'object', '쓰러진 대나무', '땅에 누운 굵은 대 둘 + 마른 잎 3x1칸.', _S + '칸 전부 막힘(넘어가지 못한다). 길 위에 놓지 않는다.', 1, None, 'prop', False),
    ('bamboo_bundle', P.bamboo_bundle, 'object', '대나무 다발', '베어 묶어 세워 둔 장대 다발 2x3칸.', _T + '밑동 2칸 막힘. 헛간·울타리 곁.', 1, None, 'prop', False),
    ('fern', P.fern, 'decal', '고사리 덤불', '깃꼴 잎 여섯 1x1칸.', _D + '길가·대숲 그늘·물가에 2~4개 덩이.', 0, None, 'decal', True),
    ('reeds', P.reeds, 'tree', '물가 갈대', '가는 잎 줄기 + 이삭 1x2칸.', _T + '밑동 1칸 막힘. 개울 둑 바로 곁에 2~3개.', 1, None, 'tree', False),
    ('maple_red', P.maple_red, 'tree', '단풍나무', '가는 줄기 + 붉은 단풍 잎 덩이 3x4칸. 대숲 속 붉은 점.', _T + '밑동 가운데 1칸 막힘. 한 화면에 하나둘만.', 1, None, 'tree', False),
    ('cliff_pine', P.cliff_pine, 'tree', '바위 위 소나무', '이끼 바위 덩이 위에 굽은 소나무 4x5칸.', _S + '바위 아랫줄 4칸 막힘. 폭포·물가 곁 앵커.', 1, None, 'tree', False),
    # ---------------------------------------------------------------- 바위·물가
    ('boulder', lambda: P.boulder(seed=2), 'object', '이끼 바위', '윗면 이끼 + 앞면 돌 결 둥근 바위 2x2칸.', _S + '아랫줄 2칸 막힘.', 1, None, 'prop', False),
    ('boulder_wide', lambda: P.boulder(seed=5, w=3, h=2, mossy=.6), 'object', '넓은 이끼 바위', '이끼가 두툼한 넓은 바위 3x2칸.', _S + '아랫줄 3칸 막힘.', 1, None, 'prop', False),
    ('rock_pair', P.rock_pair, 'object', '물가 바위 무리', '큰 바위 + 작은 돌 둘 + 밑 자갈 3x2칸.', _S + '아랫줄 3칸 막힘. 폭포·웅덩이 곁.', 1, None, 'prop', False),
    ('rock_flat', P.rock_flat, 'object', '너럭바위', '넓고 낮은 평평한 바위 2x1칸(앉는 바위).', '칸 막힘(앉기 이벤트). 물가·빈터.', 1, None, 'prop', False),
    ('rock_small', P.rock_small, 'object', '작은 돌', '이끼 점 작은 돌 1x1칸.', '칸 막힘. 길가·물가에 드문드문.', 1, None, 'prop', False),
    ('river_rock', P.river_rock, 'decal', '물속 바위', '젖은 바위 머리 + 흰 물살 테 1x1칸. 개울·웅덩이 물 칸 위에.', '물 칸 위 장식(물이라 원래 막힘).', 0, None, 'decal', False),
    ('stepping_stones', P.stepping_stones, 'decal', '징검다리 돌', '납작한 큰 돌 + 둘레 물살 1x1칸. 물 칸 위에 얹는다.',
     '이 조각을 얹은 물 칸은 걷기로 연다. 좁은 개울(3칸 안팎)을 가로질러 한 줄로, 양 끝에 물가 자갈.', 0, None, 'decal', True),
    # ---------------------------------------------------------------- 사람 손이 닿은 소품
    ('stone_lantern', lambda: P.stone_lantern(seed=1), 'object', '돌등', '두 단 받침 · 네모 불집 · 들린 갓 · 보주 1x2칸(대륙풍).', _T + '밑동 1칸 막힘. 정자 앞·감실 터 양쪽에 짝으로.', 1, None, 'prop', False),
    ('lantern_pole', lambda: P.lantern_pole(seed=1), 'object', '장대 등롱', '대 장대 + 걸이 + 주홍 종이 등(글자 없음) 1x2칸.', _T + '밑동 1칸 막힘. 사립문 양옆·쉼터.', 1, None, 'prop', False),
    ('lantern_pole_off', lambda: P.lantern_pole(seed=7, lit=False), 'object', '장대 등롱(꺼짐)', '불 꺼진 장대 등롱 1x2칸.', _T + '밑동 1칸 막힘.', 1, None, 'prop', False),
    ('stone_table', P.stone_table, 'object', '돌 탁자와 의자', '둥근 돌 탁자 + 북 모양 돌 의자 둘 + 찻잔 2x2칸.', _S + '아랫줄 2칸 막힘. 물가 쉼터.', 1, None, 'prop', False),
    ('go_rock', P.go_rock, 'object', '바둑판 바위', '너럭바위 윗면에 판 금 + 흰·검은 돌 몇 알 2x1칸(글자 없음).', '칸 막힘. 쉼터·정자 곁.', 1, None, 'prop', False),
    ('water_pipe', P.water_pipe, 'object', '대 물대롱과 돌 물확', '대 기둥 위로 건너간 홈통 + 떨어지는 물줄기 + 둥근 돌 물확 2x2칸.', _S + '아랫줄 2칸 막힘. 초가 마당.', 1, None, 'prop', False),
    ('firewood_rack', P.firewood_rack, 'object', '장작 더미', '마구리가 보이게 쌓은 장작 + 짚 거적 2x1칸.', '칸 막힘. 헛간·집 옆.', 1, None, 'prop', False),
    ('basket', lambda: P.basket(seed=1), 'object', '대바구니', '대오리로 엮은 둥근 바구니 1x1칸.', '칸 막힘.', 1, None, 'prop', False),
    ('basket_herb', lambda: P.basket(seed=2, kind='herb'), 'object', '약초 바구니', '약초 잎이 담긴 대바구니 1x1칸.', '칸 막힘.', 1, None, 'prop', False),
    ('herb_rack', P.herb_rack, 'object', '약초 채반 걸이', '대 기둥 + 장대 + 매단 약초 다발 + 바닥 채반 둘 2x2칸.', _S + '아랫줄 2칸 막힘. 은자의 마당.', 1, None, 'prop', False),
    ('clay_jars', P.clay_jars, 'object', '옹기 항아리', '짙은 갈색 유약 항아리 둘 1x1칸.', '칸 막힘. 집 벽 곁에 둘셋.', 1, None, 'prop', False),
    ('incense_burner', P.incense_burner, 'object', '세발 향로', '청동 세발 향로 + 향 연기 한 줄 1x1칸.', '칸 막힘. 감실·비석 앞.', 1, None, 'prop', False),
    ('tea_brazier', P.tea_brazier, 'object', '화로와 주전자', '흙 화로 숯불 + 쇠 주전자 1x1칸.', '칸 막힘. 집 앞·정자 안.', 1, None, 'prop', False),
    ('stone_stele', P.stone_stele, 'object', '돌비석(글자 없음)', '위가 둥근 판돌 + 받침 1x2칸.', _T + '밑동 1칸 막힘. 감실 터·갈림길.', 1, None, 'prop', False),
    ('stone_shrine', P.stone_shrine, 'object', '돌 감실', '앞이 빈 돌 상자 + 돌 지붕 + 받침 1x2칸.', _T + '밑동 1칸 막힘. 대숲 속 빈터, 앞에 판석·향로.', 1, None, 'prop', False),
    ('training_post', P.training_post, 'object', '수련 나무 기둥', '새끼 감은 굵은 통나무 1x2칸.', _T + '밑동 1칸 막힘. 마당 가장자리에 둘셋.', 1, None, 'prop', False),
    ('leaf_pile', P.leaf_pile, 'decal', '낙엽 더미', '마른 대나무 잎 + 붉은 단풍 잎 소복이 1x1칸.', _D + '대숲 밑·길가에 드문드문.', 0, None, 'decal', True),
    ('mist_bank', lambda: P.mist_bank(seed=3, w=3), 'decal', '안개 띠', '밝은 회청 단색 체크 디더 안개 3x1칸(반투명·번짐 없음).',
     '위층 장식, 걷기. 웅덩이·개울 위에 낮게, 한 화면 2~3덩이.', 0, 'upper', 'decal', True),
    ('mist_wisp', lambda: P.mist_bank(seed=8, w=2), 'decal', '안개 조각', '작은 안개 조각 2x1칸.', '위층 장식, 걷기. 안개 띠 곁에.', 0, 'upper', 'decal', True),
]
