# 등불 수향 마을 — 내보낼 조각 목록(이름, 그리는 함수, kind, 한글 이름, 설명, 놓는 법, 막는 아랫줄, 층, 역할, 걷기(오토타일만)).
# 이 팩 하나로 닫힌다: 바닥 표본·오토타일·건물·소품이 모두 이 목록에 있다(다른 장소 조각을 참조하지 않는다).
import lr_build as B, lr_props as P, lr_ground as G

_T = '키 큰 부드러운 물체: 맨 아랫줄(밑동)만 막히고 위 칸은 걷기 + 위층(가림). '
_S = '단단한 몸통: 아랫줄이 막히고 윗면은 걷기 + 위층. '
_BLD = '건물: 앞면 벽 아래 2줄이 막히고 지붕 칸은 걷기 + 위층(뒤로 지나가면 가린다), 문 칸은 걷기. 문 앞 한 칸은 길로 비운다. '
_W = '물 위 물체: autotile-canal 물 칸 위에만 둔다(물이라 원래 막힘). 둑·다리 끝에 걸치지 않게, 배끼리 2칸 띄운다. '

PARTS = [
    # ---- 앵커·건물
    ('inn', B.inn, 'object', '2층 목조 객잔', '주칠 기둥·나무 판벽·격자창, 활짝 연 두 짝 문 위 글자 없는 편액, 1층 처마 밑 홍등 넷, 2층 주칠 난간 툇마루 + 빙렬 장지, 팔작지붕 — 마을 중심 앵커.',
     _BLD + '8x8칸, 문 = 아래줄 가운데 2칸(왼쪽에서 4·5번째). 장터 광장 가장자리에, 앞에 ground-brick 마당 3~4줄 + 홍등 기둥·화분·술독.', 2, None, 'building'),
    ('teahouse', B.teahouse, 'object', '물가 찻집(정자)', '사방이 트인 정자식 찻집: 주칠 기둥 넷·낮은 난간·처마 밑 그물 살 띠, 안에 찻상과 둥근 창, 처마 끝이 크게 휜 팔작지붕, 앞 널 마루 툇단.',
     '6x6칸. 앞 기둥 칸과 뒤 줄만 막히고 가운데 아래 4칸 걷기. 툇단(아래줄)을 연못·운하 북쪽 둑에 붙여 물을 내려다보게 둔다. 옆에 버드나무.', 2, None, 'building'),
    ('house_white_4a', lambda: B.house_white(4, 1, 3), 'object', '흰 벽 민가(4칸 단층)', '흰 회벽 + 아래 회청 벽돌 띠, 검은 기와 맞배 지붕, 양 끝 계단식 마두벽, 돌 문틀 두 짝 문, 격자창.',
     _BLD + '4x6칸, 문 = 아래줄 3번째 칸. 운하 둑 거리·골목을 향해 줄 세우되 집 사이 1칸씩 띄우거나 버드나무·대숲을 끼운다.', 2, None, 'building'),
    ('house_white_5a', lambda: B.house_white(5, 1, 14), 'object', '흰 벽 민가(5칸 단층)', '5칸 폭 흰 벽 민가(같은 규칙, 창 둘).', _BLD + '5x6칸, 문 = 가운데 칸.', 2, None, 'building'),
    ('house_white_6a', lambda: B.house_white(6, 1, 23), 'object', '흰 벽 민가(6칸 단층)', '6칸 폭 흰 벽 민가(창 넷).', _BLD + '6x6칸, 문 = 왼쪽에서 4번째 칸.', 2, None, 'building'),
    ('house_white_3a', lambda: B.house_white(3, 1, 6, gable_steps=1), 'object', '흰 벽 작은 집(3칸)', '3칸 폭 작은 흰 벽 집, 마두벽 한 단.', _BLD + '3x6칸, 문 = 가운데 칸. 큰 집 사이 틈·골목 끝에.', 2, None, 'building'),
    ('house_white_5b', lambda: B.house_white(5, 2, 4), 'object', '흰 벽 2층집(5칸)', '2층 흰 벽 집: 2층 빙렬 창 줄 + 1·2층 사이 작은 기와 차양, 마두벽 세 단.', _BLD + '5x7칸, 문 = 가운데 칸. 큰 거리 북쪽 줄에.', 2, None, 'building'),
    ('house_white_6b', lambda: B.house_white(6, 2, 13), 'object', '흰 벽 2층집(6칸)', '6칸 폭 2층 흰 벽 집.', _BLD + '6x7칸, 문 = 왼쪽에서 4번째 칸. 큰길 끝(T자 길 맞은편)에 두면 길 끝이 막혀 보이지 않는다.', 2, None, 'building'),
    ('house_white_canal', lambda: B.house_white(6, 2, 5, canal=True), 'object', '물가 2층집(문 없음)', '운하에 바로 붙은 2층집: 문 대신 창 줄, 아래 화강암 기단 한 줄이 더 있다.',
     '건물: 아래 2줄 막힘(문 없음 — 뒤쪽 골목에서 들어간다고 본다). 기단 줄을 운하 북쪽 둑 칸에 맞춰 물가에 줄 세운다.', 2, None, 'building'),
    ('arch_bridge', lambda: B.arch_bridge(6), 'object', '아치 돌다리', '가운데가 솟은 무지개 돌다리(동서로 건넌다): 돌 난간 남북 둘 + 디딤 돌계단 + 남쪽 앞면 반원 아치(쐐기돌 테, 속 어둠·물 비침).',
     '6x5칸. 남북으로 흐르는 4칸 폭 운하 위, 양 끝 1칸씩 둑에 걸친다. 걷기 = 위에서 2·3번째 줄(동서 2칸 폭 길과 같은 줄), 1번째 줄(북 난간)·4·5번째 줄(남 난간·아치 앞면) 막힘.', 0, None, 'building'),
    ('stone_bridge_ns', lambda: B.stone_bridge_ns(6), 'object', '남북 돌다리', '동서 운하를 남북으로 건너는 판석 다리 3칸 폭: 디딤판(가운데 솟아 밝다) + 양쪽 돌 난간.',
     '3x6칸, 칸 전부 걷기. 4줄 운하 + 양쪽 둑 1줄씩을 덮게 놓고, 양 끝에 판석 길을 잇는다.', 0, None, 'building'),
    ('plank_bridge_ew', lambda: B.plank_bridge_ew(6), 'object', '널다리(동서)', '좁은 물길 위 널다리: 통나무 받침 + 가로 널 + 북쪽 대나무 손잡이.',
     '6x2칸, 칸 전부 걷기. 남북 물길(4칸 폭) 어귀를 동서로 건너는 둑 거리 이음에.', 0, None, 'building'),
    ('dock', lambda: B.dock(4, 2), 'object', '나무 부두(북쪽 둑)', '운하 북쪽 둑에서 남으로 내민 나무 부두: 남북 널 + 테 각목 + 남쪽 앞면 말뚝 셋 + 계선주 둘.',
     '4x3칸(위 2줄 걷기, 앞면 1줄은 물 칸에 걸쳐 막힘). 북쪽 둑에 붙여 물 위에. 옆 물 칸에 배.', 0, None, 'building'),
    ('dock_south', lambda: B.dock(4, 2, seed=9, face=False), 'object', '나무 잔교(남쪽 둑)', '운하 남쪽 둑에서 북으로 내민 잔교(앞면은 북쪽이라 안 보인다 — 널만).',
     '4x2칸, 칸 전부 걷기. 남쪽 둑 물 칸 2줄 위에, 뒤에 ground-dock 판잣길을 잇는다.', 0, None, 'building'),
    ('canal_steps', lambda: B.canal_steps(3), 'object', '물가 돌계단', '둑에서 물로 내려가는 화강암 계단 셋(빨래·배 타는 곳), 맨 아래 단 젖은 이끼.',
     '3x2칸. 운하 북쪽 둑 줄(윗줄)과 물 첫 줄(아랫줄)에 걸쳐 놓는다. 걷기 = 윗줄 전부 + 아랫줄 가운데. 둘레에 autotile-wet-flagstone.', 0, None, 'building'),
    ('paifang', B.paifang, 'object', '패루(마을 문)', '주칠 기둥 넷 + 돌 받침·북 돌, 주칠 들보 셋과 글자 없는 편액, 공포 띠, 기와 지붕 셋(가운데 높다) — 마을 들머리 앵커.',
     '6x6칸. 가운데 2칸(3·4번째)만 지나간다, 아래줄 기둥 칸 막힘. 큰길 끝(맵 가장자리 들머리)에, 양옆에 돌사자.', 1, None, 'building'),
    # ---- 장터
    ('cloth_stall', P.cloth_stall, 'object', '포목점 천막', '쪽빛·찻빛 줄무늬 차양 + 판대 위 천 필 더미(쪽빛·주칠·찻빛·흰 무명) + 늘어뜨린 천 두 폭.',
     _S + '4x3칸, 판대 줄(아래 1줄) 막힘. 장터 광장 가장자리에 다른 노점과 1칸씩 띄워 한 줄로(앞 2줄은 손님 자리로 비운다).', 1, None, 'prop'),
    ('food_stall', P.food_stall, 'object', '찐빵 노점', '찻빛 차양 + 대나무 찜기 석 단(김) + 그릇.', _S + '3x3칸, 아래 1줄 막힘.', 1, None, 'prop'),
    ('lantern_stall', P.lantern_stall, 'object', '등 노점', '주칠 차양 + 매단 종이 등 다섯 + 접은 등 더미.', _S + '3x3칸, 아래 1줄 막힘.', 1, None, 'prop'),
    ('tea_stall', P.tea_stall, 'object', '찻물 노점', '숯 화로 위 무쇠 주전자(김) + 찻잔 쟁반 + 작은 쪽빛 차양.', _S + '2x2칸, 아래 1줄 막힘.', 1, None, 'prop'),
    ('umbrella_stand', P.umbrella_stand, 'object', '기름종이 우산 진열', '활짝 편 주칠·쪽빛 우산 둘 + 접은 우산 꽂은 대 통.', _S + '2x2칸, 아래 1줄 막힘. 우산 가게 앞·노점 줄 끝.', 1, None, 'prop'),
    ('hand_cart', P.hand_cart, 'object', '손수레', '바퀴 하나 나무 손수레, 짐칸에 자루·천 짐.', _S + '2x2칸, 아래 1줄 막힘. 노점 옆·부두 앞.', 1, None, 'prop'),
    ('dye_rack', P.dye_rack, 'object', '염색 천 말림대', '높은 대나무 틀에 늘어뜨린 쪽빛·흰 무명·찻빛 천 여섯 폭 + 아래 물 함지 — 염색 마당 앵커.',
     '4x5칸, 아래 1줄 막힘(천 사이는 지나갈 수 없다), 위 칸 걷기 + 위층. 물가 가까운 풀밭에 둘~셋을 1칸 띄워 엇갈리게, 둘레에 물독·빨래 장대.', 1, None, 'prop'),
    # ---- 배
    ('sampan', P.sampan, 'object', '오봉선(거적 지붕 배)', '동서로 누운 나룻배, 가운데 검은 대나무 거적 반원통 지붕, 고물에 노.', _W + '4x2칸. 좌우 뒤집어 써도 된다.', 0, None, 'prop'),
    ('skiff', P.skiff, 'object', '거룻배', '지붕 없는 작은 배(바구니·장대).', _W + '3x2칸. 부두·계단 옆 물 칸에.', 0, None, 'prop'),
    ('boat_ns', P.boat_ns, 'object', '나룻배(남북)', '남북으로 누운 나룻배, 찻빛 거적 지붕. 남북 운하용.', _W + '2x4칸. 4칸 폭 남북 운하 가운데 2칸에.', 0, None, 'prop'),
    # ---- 나무·풀
    ('willow', P.willow, 'tree', '버드나무', '굽은 줄기 + 버들잎 수관 + 길게 늘어진 가지 줄 — 운하 둑의 상징 나무.',
     _T + '3x5칸, 밑동 칸 = 아래줄 가운데. 운하·연못 둑 거리 가장자리에 4~8칸 간격으로 엇갈리게(일렬 금지), 좌우 뒤집어 섞는다.', 1, None, 'tree'),
    ('willow_b', lambda: P.willow(7, flip_=True), 'tree', '버드나무(다른 모양)', '줄기 굽음·가지 길이가 다른 버드나무(좌우 뒤집음).', _T + '3x5칸, 밑동 = 아래줄 가운데.', 1, None, 'tree'),
    ('plum_tree', P.plum_tree, 'tree', '매화나무', '비틀린 검은 가지 + 분홍 꽃 덩이.', _T + '2x3칸, 아래줄 2칸 막힘. 사당 앞·찻뜰·집 뒤뜰.', 1, None, 'tree'),
    ('bamboo_clump', P.bamboo_clump, 'tree', '대나무 덤불', '줄기 넷 + 마디마다 처진 잎 다발.', _T + '2x4칸, 아래줄 2칸 막힘. 집 뒤·모퉁이에 덩이로.', 1, None, 'tree'),
    ('bush_round', P.bush_round, 'tree', '둥근 덤불', '버들항 덤불 잎 결의 작은 둥근 덤불.', '1x1칸 막힘. 집 사이·길가에 2~3개 덩이로.', 1, None, 'tree'),
    ('reed_clump', P.reed_clump, 'tree', '갈대 포기', '가는 잎 열 줄기 + 누런 이삭.', _T + '1x2칸, 밑동 칸 막힘. 연못·운하 둑 가장자리.', 1, None, 'tree'),
    # ---- 등·깃발
    ('lantern_post', P.lantern_post, 'object', '홍등 기둥', '나무 기둥 + 구부린 팔에 매단 둥근 붉은 등(금 술), 돌 받침.',
     _T + '1x3칸, 밑동 칸 막힘. 길 양쪽에 짝으로 마주 세우고 그 사이 공중에 lantern_string.', 1, None, 'prop'),
    ('lantern_string', P.lantern_string, 'decal', '홍등 줄', '처진 줄에 매단 작은 붉은 등 다섯.',
     '4x1칸, 걷기 + 위층(맨 위). 홍등 기둥 둘(또는 처마 끝) 사이 기둥 꼭대기 높이에 덮어 그린다 — 길 위를 가로지른다.', 0, None, 'decal'),
    ('wine_flag', P.wine_flag, 'object', '술집 깃발', '대나무 장대에 매단 흰 바탕·붉은 테 깃발(글자 없음).', _T + '1x3칸, 밑동 막힘. 객잔·주막 문 옆.', 1, None, 'prop'),
    # ---- 소품
    ('water_jar', P.water_jar, 'object', '물독', '옥빛 유약 큰 독 + 나무 뚜껑.', _S + '1x2칸, 아래 1줄 막힘. 집 문 옆·염색 마당.', 1, None, 'prop'),
    ('water_jar_open', lambda: P.water_jar(3, lid=False), 'object', '물 담긴 독', '뚜껑 없는 갈색 독(속 물).', _S + '1x2칸.', 1, None, 'prop'),
    ('wine_jars', P.wine_jars, 'object', '술독 무더기', '붉은 천 덮개 작은 독 셋.', '2x1칸 막힘. 객잔 앞·부두 짐 자리.', 1, None, 'prop'),
    ('tea_table', P.tea_table, 'object', '찻상과 걸상', '둥근 나무 탁자 + 찻주전자·잔 + 돌 걸상 둘.', _S + '2x2칸, 탁자 아래 2칸 막힘. 찻집 앞·찻뜰에 2~3개 엇갈리게.', 1, None, 'prop'),
    ('bench', P.bench, 'object', '나무 긴 의자', '앉는 판 + 다리 둘.', '2x1칸 막힘. 물가·다리 끝·광장 가장자리.', 1, None, 'prop'),
    ('steamer_baskets', P.steamer_baskets, 'object', '찜기·소쿠리', '쌓은 대나무 찜기 + 기댄 소쿠리.', '1x1칸 막힘. 노점 옆.', 1, None, 'prop'),
    ('cloth_sacks', P.cloth_sacks, 'object', '곡식 자루', '묶은 자루 넷.', '2x1칸 막힘. 부두·노점·창고 앞.', 1, None, 'prop'),
    ('crates', P.crates, 'object', '짐 상자', '쌓은 나무 상자 둘.', _S + '1x2칸, 아래 1줄 막힘.', 1, None, 'prop'),
    ('well_cn', P.well_cn, 'object', '돌 우물', '팔각 화강암 우물 테 + 나무 도르래 틀 + 두레박.', _S + '2x2칸, 아래 1줄 막힘. 광장 한쪽·골목 갈림길, 둘레에 autotile-wet-flagstone.', 1, None, 'prop'),
    ('stone_lion', P.stone_lion, 'object', '돌사자', '네모 받침 위에 앉은 돌사자(일반형), 앞발에 공.', _T + '1x2칸, 받침 칸 막힘. 패루·객잔 문 양옆에 짝으로(오른쪽은 stone_lion_flip).', 1, None, 'prop'),
    ('stone_lion_flip', lambda: P.stone_lion(flip_=True), 'object', '돌사자(뒤집음)', '돌사자 좌우 뒤집은 판(짝의 오른쪽).', _T + '1x2칸.', 1, None, 'prop'),
    ('mooring_post', P.mooring_post, 'object', '계선 말뚝', '굵은 나무 말뚝 + 감긴 밧줄.', '1x1칸 막힘. 배가 있는 물가 둑 칸에.', 1, None, 'prop'),
    ('lotus_basin', P.lotus_basin, 'object', '연꽃 수반', '화강암 둥근 수반 + 연잎 셋 + 분홍 꽃.', _S + '2x2칸, 아래 1줄 막힘. 객잔·광장·찻뜰 마당 가운데.', 1, None, 'prop'),
    ('incense_burner', P.incense_burner, 'object', '청동 향로', '세 다리 청동 향로 + 향 연기 두 줄.', _S + '2x2칸, 아래 1줄 막힘. 사당 앞마당, 양옆에 돌사자.', 1, None, 'prop'),
    ('laundry_pole', P.laundry_pole, 'object', '빨래 장대', '대나무 버팀 둘 + 장대에 넌 옷가지·천.', '3x2칸, 버팀 밑동 두 칸 막힘(가운데 칸 걷기 + 위층). 집 옆·염색 마당.', 1, None, 'prop'),
    ('potted_pine', P.potted_pine, 'object', '분재 화분', '회청 네모 화분 + 구부린 소나무 분재.', '1x1칸 막힘. 객잔·찻집 문 양옆.', 1, None, 'prop'),
    ('firewood', P.firewood, 'object', '장작 더미', '쌓은 장작.', '칸 막힘. 집 뒤·부엌 옆.', 1, None, 'prop'),
]

GROUND = [
    ('ground-grass', '잔디(바탕)', '버들항 잔디 + 짧은 풀잎 끝. 맵 전체 아래층 바탕으로 먼저 칠한다.', '걷기. 맵 전체 바탕(paint_tiles fill).'),
    ('ground-grass-meadow', '들풀', '버들항 들풀 + 클로버. 마을 가장자리·둑 풀밭 덩이.', '걷기. 바탕 위에 3~8칸 덩이로(직사각 금지).'),
    ('ground-grass-shade', '그늘 풀', '버들항 그늘 풀 + 떨어진 버들잎. 버드나무·대숲 밑.', '걷기. 나무 무리 밑에 덩이로.'),
    ('ground-dirt', '흙 골목', '칩셋 흙 + 작은 자갈. 집 뒤 골목·염색 마당 길.', '걷기. 1~2칸 폭 뒷골목.'),
    ('ground-flagstone', '화강암 판석 길', '가로로 긴 회색 화강암 판석(판 줄 16 주기, 톤 48 주기). 큰길·운하 둑 거리·장터 광장.',
     '걷기. 길 칸에 칠한 뒤 같은 칸에 autotile-flagstone-curb 를 덧칠하면 풀과 닿는 쪽에 연석이 선다.'),
    ('ground-flagstone-moss', '이끼 낀 판석', '판석 줄눈에 이끼 — 물가·다리 끝·오래된 뒷길(ground-flagstone 과 판 줄이 같다).', '걷기. 물가·찻뜰 길.'),
    ('ground-brick', '회청 벽돌 마당', '바구니 짜기로 깐 회청 벽돌. 객잔·부잣집 앞마당.', '걷기. 건물 앞 3~4줄 마당.'),
    ('ground-dock', '부두 판잣길', '남북 널 나무 바닥(못 자리·젖은 얼룩). 물가 판잣길·부두 앞.', '걷기. 운하 남쪽 둑 1~2줄.'),
]

AUTOS = [
    ('autotile-canal', G.autotile_canal, '운하 물(막돌 둑)', '버들항 운하 물 톤 + 들쭉날쭉한 화강암 막돌 둑(북쪽 둑은 돌 앞면이 물로 내려간다), 모서리 칸에 갈대 포기 — 시그니처 땅 덩이.',
     '아래층 투명 덧그림, 모든 변형 막힘(물). 운하는 3~4칸 폭 띠로(1칸 폭 금지), 둑이 곧게 줄 서지 않게 곳곳에 한 칸씩 부풀리고, 연못은 둥근 덩이로. 다리·부두·배는 위에 조각으로.', 1, 'lower', 'water', False),
    ('autotile-wet-flagstone', G.autotile_wetflag, '젖은 석판', 'ground-flagstone 과 같은 판 줄의 젖어 어두운 판석 + 판 틈 고인 물 + 작은 빗물 웅덩이(하늘 비침). 가장자리는 마른 판과 섞인다.',
     '아래층 투명 덧그림, 걷기. 판석 길 위 물가 계단·부두·우물 둘레에 2~6칸 덩이로(길 전체에 칠하지 않는다). 흙 위에 칠하면 젖은 디딤판 길.', 0, 'lower', 'terrain', True),
    ('autotile-lotus', G.autotile_lotus, '연잎 덩이', '홈 난 둥근 연잎이 빽빽한 덩이 + 분홍 연꽃·봉오리(잎 사이로 밑 물이 보인다).',
     '위층 투명 덧그림, 막힘. autotile-canal 물 칸 위, 둑에서 한 칸 띄운 안쪽에 3~10칸 덩이로(연못에 둘, 넓은 운하 끝에 하나). 배 길은 비운다.', 1, 'upper', 'water', False),
    ('autotile-flagstone-curb', G.autotile_curb, '판석 길 연석', 'ground-flagstone 과 같은 판 줄 + 이웃 없는 쪽 긴 화강암 연석(빛 윗면 + 그늘), 틈에 풀 포기.',
     '아래층 투명 덧그림, 걷기. 판석 길·광장 칸 전부에 덧칠한다(길 이음 — 붓·lay_path 로 칠하면 풀과 닿는 가장자리에만 연석이 선다).', 0, 'lower', 'terrain', True),
]
