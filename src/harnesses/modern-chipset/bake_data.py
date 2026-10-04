"""bake_tileset.py 의 이름·설명 표(한국어). 새 에셋이 들어오면 여기에 한 줄을 더하면 이름이 붙고, 없으면 영문 이름이 그대로 쓰인다."""

# 땅 시트(v1002-121948:A) 16칸 — compose_town._build 의 put(T[..]) 호출에서 읽은 뜻
GROUND = [
    # (칸 번호, 라벨, 그룹, tileMeta.role, 태그, 설명)
    (0, '아스팔트', 'road', 'terrain', ['road', '도로', '아스팔트'], '도로 바닥(남색 아스팔트). 차선·횡단보도 아래에 깐다. 도로 구간 6칸 폭이 기본.'),
    (1, '아스팔트(얼룩)', 'road', 'terrain', ['road', '도로', '아스팔트'], '아스팔트 변형(밝은 얼룩). 도로 바닥에 12% 정도 섞어 반복 티를 줄인다.'),
    (2, '차선 점선(가로, 구형)', 'road', 'path', ['road', '도로', '차선'], '가로 점선 중앙선이 구워진 칸. 지금 도시는 노란 이중선 오버레이를 쓴다 — 점선 차선이 필요할 때만.'),
    (3, '차선 점선(세로, 구형)', 'road', 'path', ['road', '도로', '차선'], '세로 점선 중앙선이 구워진 칸. 지금 도시는 노란 이중선 오버레이를 쓴다.'),
    (4, '횡단보도(가로 도로 위, 줄 가로)', 'crosswalk', 'path', ['road', 'crosswalk', '횡단보도'], '가로(동서) 도로를 가로지르는 횡단보도. 줄이 차 진행과 평행한 가로줄. 세로 방향으로 6칸 이어 깐다.'),
    (5, '횡단보도(세로 도로 위, 줄 세로)', 'crosswalk', 'path', ['road', 'crosswalk', '횡단보도'], '세로(남북) 도로를 가로지르는 횡단보도. 세로줄. 가로 방향으로 6칸 이어 깐다.'),
    (6, '보도 포석', 'sidewalk', 'terrain', ['walk', 'sidewalk', '보도'], '보도 바닥(청회색 포석). 건물 앞·연석 안쪽 어디나 깐다.'),
    (7, '보도 포석(얼룩)', 'sidewalk', 'terrain', ['walk', 'sidewalk', '보도'], '보도 변형. 7칸에 한 번 정도 섞어 반복 티를 줄인다.'),
    (8, '연석(남쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '보도 아래쪽 끝 연석 — 이 칸 남쪽(아래)이 도로. 가로 도로의 북쪽 보도 줄에 깐다.'),
    (9, '연석(북쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '보도 위쪽 끝 연석 — 이 칸 북쪽(위)이 도로. 가로 도로의 남쪽 보도 줄에 깐다.'),
    (10, '연석(동쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '보도 오른쪽 끝 연석 — 이 칸 동쪽(오른쪽)이 도로. 세로 도로의 서쪽 보도 줄에 깐다.'),
    (11, '연석(서쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '보도 왼쪽 끝 연석 — 이 칸 서쪽(왼쪽)이 도로. 세로 도로의 동쪽 보도 줄에 깐다.'),
    (12, '연석 모서리(남동쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '교차로 북서쪽 보도 모서리(둥근 연석). 도로가 남동쪽.'),
    (13, '연석 모서리(남서쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '교차로 북동쪽 보도 모서리. 도로가 남서쪽.'),
    (14, '연석 모서리(북동쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '교차로 남서쪽 보도 모서리. 도로가 북동쪽.'),
    (15, '연석 모서리(북서쪽이 도로)', 'curb', 'edge', ['curb', '연석', 'walk'], '교차로 남동쪽 보도 모서리. 도로가 북서쪽.'),
]
# 녹지 시트(v1002-184242:A) 8칸 — compose_town 공원 땅
GREEN = [
    (0, '공원 잔디', 'green', 'terrain', ['grass', 'green', '잔디', '공원'], 'park', '공원·녹지 바닥 잔디. 공원 안쪽을 채운다.'),
    (1, '공원 잔디(변형)', 'green', 'terrain', ['grass', 'green', '잔디', '공원'], 'park', '잔디 변형(풀 무늬). 25% 정도 섞는다.'),
    (2, '꽃밭', 'green', 'detail', ['grass', 'green', '꽃밭', '공원'], 'park', '잔디 위 꽃밭 칸. 직사각 화단으로 모아 깐다. 걸을 수 있다.'),
    (3, '벽돌 포장(밝음)', 'plaza', 'path', ['plaza', 'green', '광장', '공원'], 'park', '공원 분수 둘레·광장 벽돌 포장. 3·4번을 체크무늬로 번갈아 깐다.'),
    (4, '벽돌 포장(어두움)', 'plaza', 'path', ['plaza', 'green', '광장', '공원'], 'park', '벽돌 포장 짝. 체크무늬로 3번과 번갈아 깐다.'),
    (5, '공원 길(모래)', 'green', 'path', ['path', 'green', '공원길', '공원'], 'park', '공원 안 십자길·동서길 모래 길.'),
    (6, '연못 물', 'water', 'terrain', ['water', 'pond', '연못', '공원'], 'solid', '연못 물면(아래 가장자리 포말). 막힘. 연못 둘레 안쪽에 깐다.'),
    (7, '생울타리', 'hedge', 'edge', ['fence', 'hedge', '생울타리', '공원'], 'solid', '공원 둘레 생울타리(짙은 녹색 덩이). 막힘. 공원 입구(문) 자리만 비운다.'),
]

# 건물 계열 한국어 이름 (에셋 JSON 의 name)
BUILDING_KO = {
    'bld_tower10': '유리 오피스 타워(10층)', 'bld_tower10b': '벽돌 주거 타워(10층)', 'bld_mid4': '민트 4층 사무·상가', 'bld_low3': '3층 상가주택',
    'bld_hotel': '호텔(7층)', 'bld_conv': '편의점', 'bld_row': '2층 연립주택(4호)', 'bld_parking': '주차 건물', 'bld_shop': '상점(2층)',
    'bld_office': '사무소(4층)', 'bld_apartment': '아파트(5층)', 'bld_house': '단독주택(2층)', 'bld_cafe': '카페(2층)', 'bld_mid6': '6층 중층 건물',
    'bld_bank': '은행', 'bld_school': '학교', 'bld_hospital': '병원(6층)', 'bld_dept': '백화점(5층)', 'bld_warehouse': '창고',
    'bld_apt_balcony': '발코니 아파트(8층)', 'bld_house_modern': '현대식 주택', 'bld_izakaya': '이자카야', 'bld_neon4': '네온 4층 상가',
    'bld_office_wide': '대형 오피스(7층)', 'bld_slim': '슬림 빌딩(9층)', 'bld_bakery': '빵집', 'bld_police': '경찰서', 'bld_fire': '소방서',
    'bld_post': '우체국', 'bld_gas': '주유소', 'bld_gas_v2': '주유소(대형 캐노피)', 'bld_fire_escape': '비상계단 아파트(5층)',
    'bld_balcony2': '발코니 아파트(5층)', 'bld_parking_v2': '주차 건물(4층)',
}
WALL_KO = {'cream': '크림 벽', 'rose': '장미빛 벽', 'sage': '세이지 벽', 'gray': '회색 벽', 'tan': '황갈색 벽', 'slate': '슬레이트 벽', 'ochre': '황토 벽', 'plum': '자두색 벽'}
ROOF_KO = {'teal': '청록 지붕', 'navy': '남색 지붕', 'brick': '벽돌색 지붕', 'sage': '세이지 지붕', 'lgray': '밝은 회색 지붕'}

# 소품: 이름 → (한국어, 그룹, 키 큰 소품 여부, 놓는 곳)
PROP_GROUPS = {
    'light': '가로등·전신주', 'signal': '신호등·보행 신호', 'transit': '정류장·지하철', 'street': '보도 설비', 'shopfront': '가게 앞 설비',
    'work': '공사·안전 설비', 'bike': '자전거·이륜차', 'tree': '가로수·식물', 'park': '공원 시설', 'sign': '입간판·표지',
}
PROPS = {
    'lamp': ('가로등', 'light', True, '보도 연석 쪽에 같은 줄 간격 4칸 이상. 문 앞·횡단보도 접점에는 두지 않는다.'),
    'park_lamp': ('공원 가로등', 'light', True, '공원 길가·광장 가장자리.'),
    'pole': ('전신주', 'light', True, '보도 연석 쪽. 이웃 전신주와 90~420px 거리면 전선을 그린다.'),
    'signal': ('신호등', 'signal', True, '교차로 네 모서리 보도에 하나씩(좌우 거울 칸 번갈아).'),
    'ped_signal_r': ('보행 신호기(적색)', 'signal', True, '횡단보도 끝 보도 가장자리.'),
    'ped_signal_g': ('보행 신호기(녹색)', 'signal', True, '횡단보도 끝 보도 가장자리.'),
    'busstop': ('버스 정류장 표지', 'transit', True, '정류장 연석 쪽 보도.'),
    'bus_shelter': ('버스 정류장 지붕(큰)', 'transit', False, '보도 연석 쪽, 정류장 자리.'),
    'shelter': ('정류장 쉼터', 'transit', False, '보도 연석 쪽, 정류장 자리.'),
    'subway': ('지하철 입구', 'transit', False, '보도. 지하철 표지와 한 쌍.'),
    'subway_sign': ('지하철 표지 기둥', 'transit', True, '지하철 입구 옆 보도.'),
    'bench2': ('정류장 벤치', 'transit', False, '정류장 쉼터 곁 보도.'),
    'bollard': ('볼라드', 'street', False, '보도 가장자리·차도 경계.'),
    'hydrant': ('소화전', 'street', False, '보도 연석 쪽. 연석 주차 자리 앞에는 두지 않는다.'),
    'trash': ('쓰레기통', 'street', False, '건물 벽 쪽 보도.'),
    'recycle3': ('분리수거함(3통)', 'street', False, '건물 벽 쪽 보도.'),
    'bench': ('벤치', 'street', False, '건물 벽 쪽 보도·공원.'),
    'planter': ('화분', 'street', False, '건물 벽 쪽 보도.'),
    'mailbox_red': ('우체통(빨강)', 'street', False, '보도 연석 쪽·건물 입구 곁.'),
    'postbox': ('우편함', 'street', False, '건물 벽 쪽 보도.'),
    'phone': ('공중전화', 'street', False, '보도 건물 벽 쪽.'),
    'meter': ('주차 미터기', 'street', False, '연석 쪽 보도, 연석 주차 줄 곁.'),
    'vending': ('자판기', 'shopfront', False, '건물 벽 쪽 보도. 문 앞은 비운다.'),
    'vending2': ('자판기(큰)', 'shopfront', False, '건물 벽 쪽 보도. 문 앞은 비운다.'),
    'kiosk': ('매점', 'shopfront', False, '보도 넓은 곳·광장.'),
    'newsstand': ('신문 가판대', 'shopfront', False, '보도 넓은 곳·정류장 곁.'),
    'stall': ('노점', 'shopfront', False, '상점가 보도 넓은 곳·광장.'),
    'terrace': ('테라스 자리', 'shopfront', False, '카페·식당 앞 보도.'),
    'signboard': ('입간판', 'sign', False, '가게 문 곁 보도.'),
    'board_a': ('입간판 A', 'sign', False, '가게 문 곁 보도.'),
    'board_b': ('입간판 B', 'sign', False, '가게 문 곁 보도.'),
    'fence': ('공사 펜스', 'work', False, '공사 구역 둘레. 가로로 이어 깐다.'),
    'barrier': ('차단봉', 'work', False, '공사 구역·도로 막음.'),
    'cone': ('삼각콘', 'work', False, '공사 구역·도로 막음.'),
    'hoarding': ('공사 가림막', 'work', False, '공사 구역 둘레.'),
    'sand': ('모래 포대', 'work', False, '공사 구역.'),
    'trashbags': ('쓰레기 봉투', 'work', False, '건물 벽 쪽 보도 모퉁이(그림이 약하니 드물게).'),
    'boxes': ('상자', 'work', False, '건물 벽 쪽 보도·공사 구역.'),
    'bike': ('자전거', 'bike', False, '보도 건물 벽 쪽.'),
    'bike_row': ('자전거 거치대(3대)', 'bike', False, '보도 건물 벽 쪽.'),
    'moto': ('오토바이', 'bike', False, '보도 건물 벽 쪽·연석 주차 줄.'),
    'tree': ('가로수(기본)', 'tree', True, '보도 연석 쪽(같은 줄 4칸 이상)·공원. 수관이 건물·차도를 덮는 자리는 피한다.'),
    'street_tree': ('가로수', 'tree', True, '보도 연석 쪽(같은 줄 4칸 이상)·공원.'),
    'conifer': ('침엽수', 'tree', True, '공원·보도.'),
    'blossom': ('벚나무', 'tree', True, '공원·보도.'),
    'ginkgo': ('은행나무', 'tree', True, '공원·보도.'),
    'hedge': ('생울타리(가로)', 'tree', False, '보도 가장자리·공원 둘레. 가로로 이어 깐다.'),
    'hedge_v': ('생울타리(세로)', 'tree', False, '보도 가장자리·공원 둘레. 세로로 이어 깐다.'),
    'bigpot': ('큰 화분', 'tree', False, '건물 입구 곁·보도.'),
    'shrub': ('관목', 'tree', False, '보도 가장자리·화단 곁.'),
    'fountain': ('분수', 'park', False, '공원 한가운데 광장(벽돌 포장 위).'),
    'pond': ('연못', 'park', False, '공원 한가운데(벽돌 둘레 안쪽).'),
}

# 차량: 이름 → (한국어, 그룹)
VEHICLES = {
    'sedan': ('승용차', 'car'), 'car2': ('낮은 지붕 세단', 'car'), 'taxi': ('택시', 'car'), 'car_front': ('승용차(정면)', 'car'), 'car_back': ('승용차(뒷면)', 'car'),
    'truck': ('트럭', 'truck'), 'van': ('밴', 'truck'), 'bus': ('버스', 'bus'),
    'ambulance': ('구급차', 'emergency'), 'firetruck': ('소방차', 'emergency'), 'police': ('경찰차', 'emergency'), 'scooter': ('스쿠터', 'bike'),
}
VEHICLE_GROUPS = {'car': '승용차·택시', 'truck': '트럭·밴', 'bus': '버스', 'emergency': '응급·공공 차량', 'bike': '스쿠터'}
COLOR_KO = {'silver': '은색', 'white': '흰색', 'navy': '남색', 'red': '빨강', 'black': '검정', 'beige': '베이지', 'green': '녹색', 'ochre': '황토색', 'teal': '청록'}
