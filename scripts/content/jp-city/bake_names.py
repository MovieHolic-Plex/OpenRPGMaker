"""bake_jp.py 의 한국어 이름표 — 카탈로그(jp_shopstreet16.catalog.json)의 영문·로마자 이름을 칸 이름표·그룹·키트 이름으로 옮긴다.
그림도 통행도 여기서 정하지 않는다(말만 담당)."""
import re

WALL = {'kinari': '아이보리', 'shiro': '흰색', 'conc': '콘크리트 회색', 'hodo': '청회색'}
FLOOR_KIND = {'slide': '미닫이창', 'veranda': '베란다', 'koushi': '격자창', 'pairs': '쌍창', 'ribbon': '띠창', 'curtain': '유리 커튼월',
              'balcony': '발코니', 'tile': '타일벽', 'blank': '민벽'}
COLOR = {'aka': '빨강', 'sora': '하늘색', 'kii': '노랑', 'midori': '초록', 'white': '흰색', 'silver': '은색', 'black': '검정', 'red': '빨강',
         'blue': '파랑', 'taxi': '택시', 'green': '초록', 'navy': '남색', 'y': '황색 줄', 'g': '녹색 줄', 'b': '하늘색 줄'}
ROOF_A = {'plain': '평지붕', 'ac': '실외기 옥상', 'stair': '계단탑 옥상'}
ROOF_B = {'plain': '기물 없음', 'tank': '물탱크', 'cyl': '원통 탱크'}

BAND_SPECIAL = {
    'terrace': ('셋백 테라스 띠', 'roof'), 'eave': ('처마 띠', 'roof'), 'eave.slate': ('슬레이트 처마 띠', 'roof'),
    'roof.tile': ('기와 지붕 띠', 'roof'), 'roof.slate': ('슬레이트 지붕 띠', 'roof'), 'roof.hip': ('기와 모임지붕 띠', 'roof'),
    'roof.hip.slate': ('슬레이트 모임지붕 띠', 'roof'),
    'roofsign.aka': ('옥상 간판 (빨강)', 'prop'), 'roofsign.sora': ('옥상 간판 (하늘색)', 'prop'), 'roofsign.kii': ('옥상 간판 (노랑)', 'prop'),
    'gr.izakaya': ('이자카야 1층', 'building'), 'gr.konbini.0': ('편의점 1층 (A)', 'building'), 'gr.konbini.1': ('편의점 1층 (B)', 'building'),
    'gr.garage': ('차고·셔터 1층', 'building'), 'gr.machiya': ('마치야(전통 상가) 1층', 'building'),
    'gr.shutter.aka': ('셔터 점포 1층 (빨강 차양)', 'building'), 'gr.shutter.sora': ('셔터 점포 1층 (하늘색 차양)', 'building'),
    'gr.shutter.kii': ('셔터 점포 1층 (노랑 차양)', 'building'),
    'gr.glass.aka': ('유리 점포 1층 (빨강 차양)', 'building'), 'gr.glass.sora': ('유리 점포 1층 (하늘색 차양)', 'building'),
    'gr.glass.kii': ('유리 점포 1층 (노랑 차양)', 'building'),
}


def band_ko(bid):
    """(한국어 이름, 그룹 role)"""
    if bid in BAND_SPECIAL: return BAND_SPECIAL[bid]
    p = bid.split('.')
    if p[0] == 'fl': return (f'{WALL[p[2]]} {FLOOR_KIND[p[1]]} 층 띠', 'wall')
    if p[0] == 'roof' and len(p) == 3: return (f'옥상 띠 · {ROOF_A[p[1]]}, {ROOF_B[p[2]]}', 'roof')
    raise KeyError(bid)


PART_RE = re.compile(r'^(L|R0|R1|F|M(\d+)\.c(\d+))\.r(\d+)$')


def band_part_ko(part):
    m = PART_RE.match(part)
    if not m: return part
    k, v, c, r = m.group(1), m.group(2), m.group(3), int(m.group(4))
    row = f'{r + 1}번째 줄'
    if k == 'L': return f'왼쪽 끝 · {row}'
    if k == 'R0': return f'오른쪽 끝 첫째 칸 · {row}'
    if k == 'R1': return f'오른쪽 끝 둘째 칸 · {row}'
    if k == 'F': return f'채움 칸 · {row}'
    return f'몸통 변형 {int(v) + 1} · {int(c) + 1}열 · {row}'


DECO_KO = {
    'fe': '비상계단', 'fe_end': '비상계단 (맨 윗층 끝)', 'wallad.aka': '벽 광고 (빨강)', 'wallad.sora': '벽 광고 (하늘색)',
    'ac.0': '에어컨 실외기 A', 'ac.1': '에어컨 실외기 B', 'pipe': '외벽 배관', 'laundry': '베란다 빨래',
    'sunshade.sora': '차양 (하늘색)', 'sunshade.aka': '차양 (빨강)', 'sunshade.kii': '차양 (노랑)',
    'inuyarai': '개막이(犬矢来) 울타리', 'mushiko': '무시코창(격자 환기창)',
    'rtext.ramen': '옥상 글자 「ラーメン」', 'rtext.izakaya': '옥상 글자 「居酒屋」', 'rtext.karaoke': '옥상 글자 「カラオケ」', 'rtext.pachinko': '옥상 글자 「パチンコ」',
    'door.lattice': '격자문', 'door.auto': '자동문', 'door.lobby': '로비 유리문', 'door.steel': '철문', 'door.cafe': '카페 문',
    'door.noren': '노렌(포렴) 문', 'door.rollup': '롤업 셔터문', 'door.machiya': '마치야 격자 현관', 'door.house': '주택 현관문',
}
SHOP = {'izakaya': '이자카야', 'yakkyoku': '약국', 'sushi': '초밥집', 'yakiniku': '야키니쿠집', 'kissa': '찻집', 'sento': '대중목욕탕',
        'ramen': '라멘집', 'bento': '도시락집', 'shika': '치과', 'kissaten': '깃사텐', 'sakaya': '술 가게', 'shokudo': '식당', 'tempura': '튀김집'}


def deco_ko(did):
    if did in DECO_KO: return DECO_KO[did]
    p = did.split('.')
    if p[0] == 'sign_h': return f'가로 간판 ({COLOR[p[1]]})'
    if p[0] == 'vstack': return f'세로 간판 적층 ({COLOR[p[1]]})'
    if p[0] == 'vsign' and p[1] == 'mark': return f'세로 간판 · 표식 ({COLOR[p[2]]})'
    if p[0] == 'vsign': return f'세로 간판 · {SHOP[p[1]]}'
    if p[0] == 'plate' and p[1] == 'mark': return f'간판판 · 표식 ({COLOR[p[2]]})'
    if p[0] == 'plate': return f'간판판 · {SHOP[p[1]]}'
    if p[0] == 'board': return f'입간판판 · {SHOP[p[1]]}'
    if p[0] == 'vision': return f'대형 영상 화면 {int(p[1]) + 1}'
    if p[0] == 'mural': return f'외벽 벽화 {int(p[1]) + 1}'
    if p[0] == 'facade_ad': return f'외벽 광고 {int(p[1]) + 1}'
    raise KeyError(did)


def deco_role(did):
    return 'building' if did.startswith('door.') else 'prop'


STREET_KO = {
    'sw': ('보도 포석', 'sidewalk'), 'sw_tactile': ('점자블록 줄 보도', 'sidewalk'), 'sw_shade': ('건물 그늘 보도', 'sidewalk'),
    'tactile_dot': ('점자블록 경고(점)', 'sidewalk'), 'tactile_bar': ('점자블록 안내(선)', 'sidewalk'),
    'road_n': ('도로 위쪽 가장자리', 'road'), 'road_c': ('도로 아스팔트', 'road'), 'road_dash': ('도로 중앙 점선', 'road'),
    'road_s': ('도로 아래쪽 가장자리', 'road'), 'manhole': ('맨홀', 'road'),
    'stop_c': ('정지선 가운데', 'road'), 'stop_n': ('정지선 위끝', 'road'), 'stop_s': ('정지선 아래끝', 'road'),
    'lane_n': ('생활도로 위쪽 가장자리', 'lane'), 'lane_c': ('생활도로 아스팔트', 'lane'), 'lane_s': ('생활도로 아래쪽 가장자리', 'lane'),
    'lane_stop': ('생활도로 정지선', 'lane'),
    'lot': ('주차장 바닥', 'lot'), 'lot_line': ('주차 칸 구분선', 'lot'), 'lot_stop': ('주차 정지턱', 'lot'), 'lot_num': ('주차 번호 칸', 'lot'),
    'cw_n': ('횡단보도 세로줄 위끝', 'crosswalk'), 'cw_m': ('횡단보도 세로줄 가운데', 'crosswalk'), 'cw_s': ('횡단보도 세로줄 아래끝', 'crosswalk'),
    'vz_n': ('횡단보도 세로줄(남북 건넘) 위끝', 'crosswalk'), 'vz_c': ('횡단보도 세로줄(남북 건넘) 가운데', 'crosswalk'), 'vz_s': ('횡단보도 세로줄(남북 건넘) 아래끝', 'crosswalk'),
    'zeb_n': ('횡단보도 가로줄 위끝', 'crosswalk'), 'zeb_c': ('횡단보도 가로줄 가운데', 'crosswalk'), 'zeb_s': ('횡단보도 가로줄 아래끝', 'crosswalk'),
    'zeb_d-3': ('비스듬한 횡단보도 −3', 'crosswalk'), 'zeb_d-2': ('비스듬한 횡단보도 −2', 'crosswalk'), 'zeb_d-1': ('비스듬한 횡단보도 −1', 'crosswalk'),
    'zeb_d0': ('비스듬한 횡단보도 0', 'crosswalk'), 'zeb_d1': ('비스듬한 횡단보도 +1', 'crosswalk'), 'zeb_d2': ('비스듬한 횡단보도 +2', 'crosswalk'),
    'zeb_d3': ('비스듬한 횡단보도 +3', 'crosswalk'),
    'guard': ('가드레일(도로 위 얹기)', 'guard'),
    'gravel': ('자갈 맨흙', 'ground'), 'pave_a': ('판석 A', 'ground'), 'pave_b': ('판석 B', 'ground'), 'lawn': ('잔디', 'ground'),
    'sando': ('참배길 포석', 'ground'), 'sando_b': ('참배길 포석 변형', 'ground'), 'plant_strip': ('화단 띠(흙+새싹)', 'ground'),
    'rail': ('선로(자갈 위 레일)', 'rail'), 'water': ('물', 'water'), 'quay': ('호안 석축', 'water'),
}
STREET_CAT = {
    'sidewalk': ('보도·점자블록', '건물 앞 보도. 점자블록 줄은 보도 위에 한 줄로 이어 깐다.', 'terrain'),
    'road': ('도로·정지선', '차도 바닥과 정지선·맨홀. 가로로 위·가운데·아래 가장자리를 쌓아 도로 폭을 만든다.', 'terrain'),
    'lane': ('생활도로', '보도 없는 좁은 도로. 위·가운데·아래 줄을 쌓아 깐다.', 'terrain'),
    'lot': ('주차장', '코인 주차장 바닥. 구분선·정지턱을 칸마다 번갈아 깐다.', 'terrain'),
    'crosswalk': ('횡단보도', '도로 위. 줄이 차 진행과 평행한 쪽을 골라 위끝·가운데·아래끝을 이어 깐다.', 'terrain'),
    'guard': ('가드레일', '차도와 보도 사이. 투명 칸이라 도로 위에 얹는다(막힘).', 'fence'),
    'ground': ('땅·잔디·판석·참배길', '공원·신사·골목 바닥.', 'terrain'),
    'rail': ('선로', '불투명 바닥. 건널 때는 건널목 말고 건너게 두지 않는다.', 'terrain'),
    'water': ('물·호안', '물은 막힘, 호안 석축은 걸을 수 있다.', 'water'),
}


def street_ko(name):
    return STREET_KO[name]


# ---- 소품(props) 이름·분류
PROP_CATS = [  # (이름 접두/일치, 분류 id)
    (('car.', 'van.', 'bus', 'ad_truck', 'ricksha_cart'), 'vehicle'),
    (('train', 'catenary_pole', 'viaduct6'), 'train'),
    (('kaminarimon', 'hozomon', 'pagoda5', 'honden', 'sanmon6', 'nakamise', 'censer', 'chozuya', 'lantern_post', 'stone_lantern', 'string_lanterns4', 'wall.tsuiji'), 'shrine'),
    (('arch_', 'metro_exit', 'station_gate', 'guard_tunnel', 'omoide_gate'), 'gate'),
    (('neon_stack', 'blade_sign', 'akiba_neon', 'led_tower', 'gacha_wall', 'tin_stall', 'shop_cover', 'theatre_front8'), 'storefront'),
    (('tree.', 'wall.hedge'), 'green'),
    (('wall.', 'gate.'), 'wall'),
    (('stairs_', 'yuyake_stairs', 'iron_stair'), 'stairs'),
    (('slide', 'swing', 'sandbox'), 'play'),
    (('cat.',), 'animal'),
]
PROP_CAT_KO = {
    'vehicle': ('차량', 'prop', '도로·주차 자리 위 정차 차량(걸어 지나감 — 아래 줄은 바퀴 그림이 바닥 쪽).'),
    'train': ('열차·고가·선로 시설', 'prop', '선로 위 열차, 고가 정면, 가선 기둥. 열차는 걸어 지나갈 수 있는 장식 그림이다.'),
    'shrine': ('절·신사·참배길 건축', 'building', '신사·절 경내 건물과 참배길 시설.'),
    'gate': ('아치·출입구·터널', 'building', '가운데가 뚫린 아치·역 출입구·터널 입구(뚫린 칸은 걸어 지나감).'),
    'storefront': ('점포·간판 구조물', 'building', '상점가·번화가의 점포·세로 간판·네온·가림막.'),
    'green': ('가로수·생울타리', 'prop', '줄기 칸만 막힘. 수관은 사람 위에 그려진다.'),
    'wall': ('담·문', 'fence', '집 담·판자 담·철문.'),
    'stairs': ('계단', 'prop', '돌계단·철제 외부 계단.'),
    'play': ('놀이터', 'prop', '미끄럼틀·그네·모래판.'),
    'animal': ('고양이', 'prop', '앉은 고양이·식빵 자세 고양이·처마 위 목각 고양이.'),
    'street': ('거리 시설', 'prop', '자판기·신호기·표지·전봇대·벤치·볼라드·자전거 등 거리 소품.'),
}
BUILDING_PROPS = ('kaminarimon', 'hozomon', 'pagoda5', 'honden', 'sanmon6', 'nakamise', 'tin_stall', 'metro_exit', 'station_gate', 'theatre_front8',
                  'led_tower', 'omoide_gate', 'guard_tunnel', 'arch_', 'viaduct6', 'gacha_wall', 'neon_stack', 'akiba_neon', 'vent_tower')


def prop_cat(name):
    for prefixes, cat in PROP_CATS:
        if any(name == p or name.startswith(p) for p in prefixes): return cat
    return 'street'


def prop_role(name):
    return 'building' if any(name.startswith(p) for p in BUILDING_PROPS) else 'prop'


def prop_variant_ko(name):
    """name 의 변형 꼬리(색·반전·번호)를 말로."""
    m = re.match(r'^(train\d+|train8)_([ygb])$', name)
    if m: return COLOR[m.group(2)]
    parts = name.split('.')
    if len(parts) < 2: return ''
    out = []
    for tok in parts[1:]:
        flip = tok.endswith('_r'); t = tok[:-2] if flip else tok
        w = COLOR.get(t) or (f'{int(t) + 1}번' if t.isdigit() else t)
        out.append(w + (' 반전' if flip else ''))
    return ' '.join(out)


def classify_name(nm):
    """칸 이름 → (종류, 세부). 종류: band | deco | prop | street. 영역 id 는 호출자가 안다."""
    if nm.startswith('st.'): return 'street', nm[3:]
    if nm.startswith('prop.'): return 'prop', nm
    if nm.startswith('deco.'): return 'deco', nm
    return 'band', nm
