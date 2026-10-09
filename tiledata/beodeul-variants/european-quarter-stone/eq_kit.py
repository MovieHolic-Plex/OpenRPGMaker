# 석조 유럽 시가지 키트 목록 — 조각 이름 → (그리기 함수, 메타). 내보내기(parts/*.png · partmeta.json · parts.md)와 지도가 같이 쓴다.
from eq_base import *
import eq_build as BD, eq_props as PR, eq_ground as GR

ROAD_RULE = '3x3 이어 붙여도 이음새가 없다.'
K = {}
def k(name, fn, kind, ko, desc, rules, brows=0, role=None, layer=None):
    m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules, 'brows': brows}
    if role: m['role'] = role
    if layer: m['layer'] = layer
    if kind == 'autotile': m['passable'] = role != 'fence'
    K[name] = (fn, m)

# ---------------------------------------------------------------- 맨 바탕 표본(아래층, 걷기)
k('ground-setts', lambda: GR.ground_sample('ground-setts'), 'floor', '회색 포석 거리',
  '버들항 회색 자갈 칸의 잔 돌·줄눈 결을 그대로 어둡고 차분한 회색으로 옮긴 차도 포석.',
  '거리(차도)·골목의 기본 바닥. 맨 먼저 넓게 깐다. 보도는 그 위에 autotile-sidewalk 로 덧그린다. ' + ROAD_RULE, 0, 'terrain', 'lower')
k('ground-wetsetts', lambda: GR.ground_sample('ground-wetsetts'), 'floor', '젖은 포석',
  '같은 포석을 두 단 어둡게, 돌 윗면에 흐린 하늘빛 맺힘, 틈에 고인 물.',
  '비 온 뒤 거리·건물 그늘 골목·분수 둘레. 차도 일부를 덩이로 바꿔 깐다(경계는 autotile-puddle 로 부드럽게). ' + ROAD_RULE, 0, 'terrain', 'lower')
k('ground-flagstone', lambda: GR.ground_sample('ground-flagstone'), 'floor', '보도 판석',
  '24x16 큰 회색 판석이 줄마다 반 엇갈린 보도·현관 앞 바닥, 낮은 대비.',
  '건물 앞 보도·카페 테라스·현관 앞. 차도와 만나는 가장자리는 autotile-sidewalk(연석)로 끝낸다. ' + ROAD_RULE, 0, 'terrain', 'lower')
k('ground-gravel', lambda: GR.ground_sample('ground-gravel'), 'floor', '안마당 자갈',
  '버들항 흙 칸 결을 회갈로, 그 위 잔 자갈 알. 뒤뜰·마구간 앞·공원 길.',
  '건물 뒤 안마당·공원 산책길·창고 앞. 거리 바닥과 섞지 말고 담·쇠 난간 안쪽에. ' + ROAD_RULE, 0, 'terrain', 'lower')
k('ground-fanplaza', lambda: GR.ground_sample('ground-fanplaza'), 'floor', '부채꼴 포석 광장',
  '부채꼴 돌 줄이 비늘처럼 겹친 광장 포석(24x12 주기), 부채 테두리 돌은 한 단 밝다.',
  '분수·기념탑 광장 한 곳에만(넓게 8x6~16x10). 둘레는 차도 포석. ' + ROAD_RULE, 0, 'terrain', 'lower')

# ---------------------------------------------------------------- 16변형 오토타일
k('autotile-puddle', GR.autotile_puddle, 'autotile', '빗물 웅덩이',
  '포석 위 빗물 웅덩이 덩이: 흐린 하늘을 비춘 짙은 물(빛 줄), 젖어 검어진 포석 물가, 바깥 물방울 자국.',
  '차도·광장 낮은 곳에 3~12칸 덩이 2~4곳. 붓으로 둥글게 칠한다(사각 채우기 금지). 걷기.', 0, 'terrain', 'upper')
k('autotile-leaves', GR.autotile_leaves, 'autotile', '떨어진 낙엽 더미',
  '갈색·누른 잎이 겹쳐 쌓인 덩이, 가장자리로 갈수록 성겨져 흩어진다.',
  '가로수·공원 나무 밑, 담 밑·계단 모퉁이에 2~8칸 덩이. 나무 없는 곳에 두지 않는다. 걷기.', 0, 'terrain', 'upper')
k('autotile-slush', GR.autotile_slush, 'autotile', '녹는 눈 덩이',
  '회백 눈 덩이(군데군데 녹은 구멍), 회갈로 더러워진 눈 테와 바깥 젖은 자국.',
  '늦겨울 판에서 그늘진 골목·연석가·광장 구석에 덩이로. 해가 드는 차도 한가운데는 피한다. 걷기.', 0, 'terrain', 'upper')
k('autotile-sidewalk', GR.autotile_sidewalk, 'autotile', '보도 연석',
  '보도 둘레 연석: 속은 투명(밑 판석이 비친다), 이웃 없는 쪽만 밝은 연석 2화소 + 턱 그늘, 모퉁이는 둥글게.',
  '먼저 보도 칸에 ground-flagstone 을 깔고 같은 칸에 이 붓을 칠한다(건물 줄 앞 2~3칸 폭, 교차로 모퉁이 둥글게). 걷기.', 0, 'terrain', 'upper')
k('autotile-ironrail', GR.autotile_ironrail, 'autotile', '검은 쇠 난간',
  '돌 받침 위 검은 쇠 난간(살 끝 공), 모서리·끝은 네모 기둥.',
  '안마당·공원·테라스 둘레를 한 줄로 두른다(막힘). 드나드는 곳은 비워 두거나 court-gate 를 둔다.', 0, 'fence', 'upper')

# ---------------------------------------------------------------- 건물(위 칸 걷기+가림, 아래 brows 줄 막힘)
B_RULE = '문 앞 1칸은 보도(autotile-sidewalk)로 비운다. 옆 건물과 어깨를 붙여 줄 세우고(같은 건물 연달아 금지) 높이가 다른 건물을 섞는다.'
k('grand-hotel', BD.grand_hotel, 'object', '대형 호텔', '4층 + 맨사르드(다락창 넷), 8칸 폭: 벽기둥, 2·3층 철 발코니 두 쌍, 1층 줄무늬 차양 진열창과 쌍문 둘, 왕관 그림 간판, 벽등.',
  '아래 2줄 막힘. 거리 끝·광장 정면에 하나(앵커). 양옆에 hotel-wing 을 붙여 큰 덩어리로. ' + B_RULE, 2, 'building')
k('hotel-wing', BD.hotel_wing, 'object', '호텔 곁채', '4층 + 맨사르드, 4칸 폭: 호텔과 처마선이 같고 2층 긴 발코니, 1층 창가 화분.',
  '아래 2줄 막힘. grand-hotel 옆에 붙인다(좌우 뒤집어도 된다). ' + B_RULE, 2, 'building')
k('inn', BD.inn, 'object', '여관', '3층 + 맨사르드, 6칸 폭, 따뜻한 회갈 돌: 가운데 쌍문과 양옆 벽등, 침대 그림 간판(글자 없음), 창가 화분, 2층 작은 발코니.',
  '아래 2줄 막힘. 광장·큰길 교차로 곁. 문 앞에 sign-standing·벤치. ' + B_RULE, 2, 'building')
k('cafe', BD.cafe, 'object', '카페', '3층 + 맨사르드, 5칸 폭, 그을린 짙은 돌: 1층 전체 검붉은·크림 줄무늬 차양과 진열창, 찻잔 간판, 2층 긴 발코니.',
  '아래 2줄 막힘. 앞 보도 3칸에 parasol-table·cafe-table·chalkboard 를 덩이로(일렬 금지). ' + B_RULE, 2, 'building')
k('bakery', BD.bakery, 'object', '빵집', '3층 + 맨사르드, 4칸 폭: 병록·크림 줄무늬 차양, 진열창, 빵 그림 간판, 창가 화분.',
  '아래 2줄 막힘. 상점가 줄에. ' + B_RULE, 2, 'building')
k('apothecary', BD.apothecary, 'object', '약방', '3층, 4칸 폭, 우진각 슬레이트 지붕: 회청 차양과 덧창, 약병 그림 간판, 왼쪽 문.',
  '아래 2줄 막힘. 상점가 줄에. ' + B_RULE, 2, 'building')
k('cobbler', BD.cobbler, 'object', '구둣방', '3층 + 맨사르드, 3칸 폭, 그을린 돌: 붉은 민무늬 차양, 장화 그림 간판, 오른쪽 문.',
  '아래 2줄 막힘. 좁은 틈·골목 어귀에. ' + B_RULE, 2, 'building')
k('low-shop', BD.low_shop, 'object', '낮은 재봉 가게', '2층 + 맨사르드, 4칸 폭: 진열창 위 바랜 붉은 차양, 가위 그림 간판.',
  '아래 2줄 막힘. 높은 건물 사이에 두어 지붕선을 끊는다. ' + B_RULE, 2, 'building')
k('townhouse-narrow', BD.townhouse_narrow, 'object', '좁은 타운하우스', '4층 + 맨사르드, 3칸 폭: 창마다 작은 쇠 난간, 외짝 문, 굴뚝 둘.',
  '아래 2줄 막힘. 주택가 줄에 2~3채 섞어(같은 것 연달아 두지 말고 사이에 다른 집). ' + B_RULE, 2, 'building')
k('townhouse-wide', BD.townhouse_wide, 'object', '넓은 타운하우스', '3층, 5칸 폭, 우진각 슬레이트 지붕과 굴뚝 둘: 회록 덧창, 가운데 문 위 작은 난간.',
  '아래 2줄 막힘. 주택가·공원 앞. ' + B_RULE, 2, 'building')
k('townhouse-corner', BD.townhouse_corner, 'object', '모퉁이 타운하우스', '3층 + 맨사르드, 4칸 폭: 왼쪽 벽기둥, 2층 긴 발코니, 1층 문 둘(가게 겸 집).',
  '아래 2줄 막힘. 교차로 모퉁이(왼쪽이 길 쪽). ' + B_RULE, 2, 'building')
k('warehouse', BD.warehouse, 'object', '벽돌 창고', '2층, 6칸 폭, 바랜 붉은 벽돌과 우진각 지붕: 2칸 짐 문, 위층 짐 받는 문과 도르래 들보.',
  '아래 2줄 막힘. 뒷골목·안마당 끝. 앞에 crates-stack·barrels-stack·barrel-cart. ' + B_RULE, 2, 'building')
k('passage-arch', BD.passage_arch, 'object', '아치 통로 건물', '3층 + 맨사르드, 3칸 폭: 1층 가운데가 뚫린 반원 아치로 길이 건물 밑을 지난다.',
  '아래 2줄 중 가운데 칸은 걷는다(통로) — 양옆 칸만 막힘. 큰길에서 뒷골목·안마당으로 들어가는 자리에. ' + B_RULE, 2, 'building')
K['passage-arch'][1]['openCells'] = [[1, 0], [1, 1]]
k('court-gate', BD.court_gate, 'object', '안마당 돌담 쇠 대문', '3칸 폭: 양옆 돌기둥(등 얹음)과 쇠창살 쌍문, 갓돌.',
  '아래 1줄 중 양옆 기둥 칸만 막힘, 가운데 칸은 대문(걷기 — 잠그려면 문 이벤트로 막는다). autotile-ironrail 줄의 틈 자리에.', 1, 'prop')
K['court-gate'][1]['openCells'] = [[1, 0]]

# ---------------------------------------------------------------- 거리 소품
P_RULE = '일렬로 늘어놓지 말고 2~3개씩 덩이로.'
k('lamp-double', PR.lamp_double, 'object', '쌍등 가로등', '검은 쇠 기둥 꼭대기 가로 팔에 유리 등 둘(1x3칸).', '맨 아래 1칸만 막힘, 위는 걷기+가림. 보도 가장자리 6~8칸 간격, 교차로 모퉁이.', 1, 'prop')
k('lamp-single', PR.lamp_single, 'object', '홑등 가로등', '가는 쇠 기둥 위 유리 등 하나(1x3칸).', '맨 아래 1칸만 막힘. 골목·공원 길.', 1, 'prop')
k('street-clock', PR.street_clock, 'object', '거리 시계 기둥', '쇠 기둥 위 둥근 시계(숫자 없음, 1x3칸).', '맨 아래 1칸만 막힘. 광장 모퉁이에 하나.', 1, 'prop')
k('advert-column', PR.advert_column, 'object', '광고 기둥', '바랜 색 종이가 붙은 원통 기둥, 아연 둥근 지붕(1x3칸, 글자 없음).', '맨 아래 1칸만 막힘. 교차로 보도에 하나.', 1, 'prop')
k('tree-street', PR.tree_street, 'tree', '가로수', '짙은 잎 수관, 곧은 줄기, 밑동 쇠 격자 덮개(2x3칸).', '맨 아래 1줄만 막힘, 수관은 걷기+가림. 보도 따라 4~6칸 간격(모두 같은 간격 금지), 밑에 autotile-leaves.', 1, 'prop')
k('tree-planter', PR.tree_planter, 'tree', '화분 가로수', '네모 돌 화분에 심은 동그란 작은 나무(2x3칸).', '맨 아래 1줄 막힘. 카페 테라스 양 끝·호텔 현관 옆.', 1, 'prop')
k('tree-bare', PR.tree_bare, 'tree', '겨울 가로수', '잎 진 가는 가지 나무, 밑동 쇠 격자(2x3칸).', '맨 아래 1줄 막힘. 늦겨울 판·autotile-slush 와 함께.', 1, 'prop')
k('parasol-table', PR.parasol_table, 'object', '파라솔 식탁', '둥근 병록 쇠 식탁과 의자 둘, 위에 검붉은·크림 줄무늬 파라솔(2x3칸).', '아래 1줄 막힘(식탁), 파라솔은 걷기+가림. 카페 앞 보도에 2~3개 엇갈리게.', 1, 'prop')
k('parasol-table-green', PR.parasol_table_g, 'object', '초록 파라솔 식탁', '병록·크림 줄무늬 파라솔 식탁(2x3칸).', '아래 1줄 막힘. 붉은 파라솔과 섞어서.', 1, 'prop')
k('cafe-table', PR.cafe_table, 'object', '작은 카페 식탁', '파라솔 없는 둥근 쇠 식탁과 의자 둘, 찻잔(2x2칸).', '아래 1줄 막힘. 파라솔 식탁 사이·차양 밑.', 1, 'prop')
k('cafe-chair', PR.cafe_chair, 'object', '쇠의자', '병록 등받이 쇠의자(1칸).', '1칸 막힘. 식탁 곁에 하나씩만.', 1, 'prop')
k('chalkboard', PR.chalkboard, 'object', '세움 칠판', '나무 A자 틀 칠판, 분필 찻잔 그림(글자 없음, 1칸).', '1칸 막힘. 카페·빵집 문 옆.', 1, 'prop')
k('sign-standing', PR.sign_standing, 'object', '여관 세움 간판', '쇠 기둥에 매단 침대 그림 나무 판(1x2칸).', '맨 아래 1칸 막힘. 여관 문 옆 보도.', 1, 'prop')
k('bench-iron', PR.bench_iron, 'object', '쇠 다리 벤치', '나무 널 등받이 벤치, 검은 쇠 팔걸이(2칸).', '1줄 막힘. 광장·공원 가장자리, 가로수 밑.', 1, 'prop')
k('flower-planter', PR.flower_planter, 'object', '돌 화단 상자', '긴 돌 화분에 제라늄(2칸).', '1줄 막힘. 호텔 현관·광장 가장자리.', 1, 'prop')
k('bollard', PR.bollard, 'object', '쇠 말뚝', '검은 쇠 말뚝(1칸).', '1칸 막힘. 보도와 광장 경계에 2~4개 간격 두고.', 1, 'prop')
k('barrel', PR.barrel, 'object', '나무 통', '쇠테 두른 나무 통(1칸).', '1칸 막힘. 가게·여관 옆에 2~3개 덩이.', 1, 'prop')
k('barrels-stack', PR.barrels_stack, 'object', '통 더미', '눕힌 통 셋을 쌓은 더미(2x2칸).', '아래 1줄 막힘. 창고·여관 뒷문.', 1, 'prop')
k('barrel-cart', PR.barrel_cart, 'object', '술통 손수레', '두 바퀴 수레에 눕힌 통 둘(2x2칸).', '아래 1줄 막힘. 창고 짐 문 앞.', 1, 'prop')
k('crate', PR.crate, 'object', '나무 상자', 'X 버팀목 나무 상자(1칸).', '1칸 막힘. 가게 옆·창고 앞.', 1, 'prop')
k('crates-stack', PR.crates_stack, 'object', '상자 더미', '상자 셋과 자루 하나(2x2칸).', '아래 1줄 막힘. 창고·시장 좌판 뒤.', 1, 'prop')
k('handcart', PR.handcart, 'object', '손수레', '자루 둘 실은 외바퀴 손수레(2칸).', '1줄 막힘. 시장·뒷골목.', 1, 'prop')
k('flower-cart', PR.flower_cart, 'object', '꽃 수레', '꽃 양동이 넷 실은 나무 수레(2x2칸).', '아래 1줄 막힘. 광장·보도 모퉁이에 하나.', 1, 'prop')
k('market-stall', PR.market_stall, 'object', '시장 좌판', '병록·크림 줄무늬 천막 지붕, 과일·채소 진열대(3x2칸).', '아래 1줄 막힘, 천막은 걷기+가림. 광장 가장자리에 2~3개 엇갈리게.', 1, 'prop')
k('carriage', PR.carriage, 'object', '검은 마차', '상자형 차체, 큰 바퀴, 마부석과 끌채(3x2칸, 말 없음).', '아래 1줄 막힘. 호텔 앞 차도·마차 정류장.', 1, 'prop')
k('fountain', PR.fountain, 'object', '광장 분수', '둥근 돌 수반과 가운데 기둥 윗 접시에서 떨어지는 물줄기(3x3칸).', '아래 2줄 막힘. ground-fanplaza 광장 가운데 하나(앵커).', 2, 'prop')
k('monument', PR.monument, 'object', '기념 오벨리스크', '계단 받침 위 대좌와 뾰족 돌기둥, 꼭대기 청동 공(2x4칸).', '아래 1줄 막힘, 위는 걷기+가림. 광장 한쪽·교차로 섬.', 1, 'prop')
k('water-pump', PR.water_pump, 'object', '쇠 손 펌프', '휜 손잡이 쇠 펌프와 돌 물받이(1x2칸).', '아래 1칸 막힘. 안마당·뒷골목.', 1, 'prop')
k('horse-trough', PR.horse_trough, 'object', '돌 물통', '물 고인 긴 돌 여물통(2칸).', '1줄 막힘. 마차 정류장·여관 앞.', 1, 'prop')
k('snow-heap', PR.snow_heap, 'object', '치운 눈더미', '연석가에 밀어 둔 회백 눈 무더기(2칸).', '1줄 막힘. 늦겨울 판 연석가·모퉁이.', 1, 'prop')
k('stone-steps', PR.stone_steps, 'decal', '문 앞 돌계단', '세 단 돌계단(2칸, 걷기).', '걷는 장식. 문 앞 보도 칸 위.', 0, 'prop')

# ---------------------------------------------------------------- 바닥 덧그림(걷기)
k('drain-grate', PR.drain_grate, 'decal', '빗물 쇠살대', '길가 네모 빗물 쇠살대(1칸).', '걷는 장식. 연석 바로 옆 차도에 8~12칸 간격.', 0, 'prop')
k('manhole', PR.manhole, 'decal', '맨홀 뚜껑', '둥근 쇠 뚜껑(1칸).', '걷는 장식. 차도 가운데 화면당 1~2개.', 0, 'prop')
k('leaves-scatter', PR.leaves_scatter, 'decal', '흩어진 낙엽', '갈색·누른 잎 열 장(1칸).', '걷는 장식. 낙엽 덩이 둘레·가로수 밑.', 0, 'prop')
k('puddle-small', PR.puddle_small, 'decal', '작은 웅덩이', '둥근 빗물 고임(2x1칸).', '걷는 장식. 차도·광장 낮은 곳.', 0, 'prop')
k('cellar-hatch', PR.cellar_hatch, 'decal', '지하실 덧문', '보도에 붙은 두 쪽 나무 판문(2칸).', '걷는 장식(이벤트로 지하 입구). 여관·창고 앞 보도.', 0, 'prop')
k('pigeons', PR.pigeons, 'decal', '비둘기', '땅을 쪼는 비둘기 둘(1칸).', '걷는 장식. 광장·분수 둘레 2~3곳.', 0, 'prop')
k('papers', PR.papers, 'decal', '날린 종이', '바람에 날린 종이 쪼가리(1칸, 글자 없음).', '걷는 장식. 골목·광고 기둥 밑.', 0, 'prop')

_CACHE = {}
def img(name):
    if name not in _CACHE: _CACHE[name] = pad16(K[name][0]())
    return _CACHE[name]
