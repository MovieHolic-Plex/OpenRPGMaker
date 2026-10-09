# 목골 구시가 키트 목록 — 조각 이름 → (그리기 함수, 메타). 내보내기(parts/*.png · partmeta.json · parts.md)와 지도가 같이 쓴다.
from eq_props import *
import eq_ground as GR, eq_auto as AU, eq_build as BD

K = {}
def k(name, fn, kind, ko, desc, rules, brows=0, role=None, layer=None):
    m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules, 'brows': brows}
    if role: m['role'] = role
    if layer: m['layer'] = layer
    if kind == 'autotile': m['passable'] = role != 'fence'
    K[name] = (fn, m)
_IMG = {}
def img(name):
    if name not in _IMG: _IMG[name] = K[name][0]()
    return _IMG[name]

SEAM = '3x3 이어 붙여도 이음새가 없다.'
# ---------------------------------------------------------------- 맨 바탕 표본(아래층, 걷기)
def _g(n): return lambda: grade(GR.ground_sample(n))
k('ground-brickpave', _g('ground-brickpave'), 'floor', '붉은 벽돌 포장', '위에서 본 바구니 짜임 붉은 벽돌(가로 둘·세로 둘 번갈아), 벽돌마다 단이 다르고 몇 장은 닳아 흙빛.',
  '큰길·광장 바닥의 속. 길 가장자리(연석)는 autotile-brickstreet 로 덮는다. ' + SEAM, 0, 'terrain', 'lower')
k('ground-cobble', _g('ground-cobble'), 'floor', '회색 자갈길', '버들항 자갈 칸 결 그대로 따뜻한 회색 돌로, 돌 틈은 흙빛, 몇 돌은 갈색이 돈다.',
  '건물 앞 보도·골목·마당·벽돌 거리 바깥 바닥. 마을의 기본 바닥으로 넓게 깔아도 된다. ' + SEAM, 0, 'terrain', 'lower')
k('ground-dirt', _g('ground-dirt'), 'floor', '다져진 흙길', '버들항 흙길 칸 결을 바랜 갈색으로, 닳은 밝은 점과 작은 조약돌.',
  '뒷골목·뒷마당·대장간 마당·성벽 밖 길. ' + SEAM, 0, 'terrain', 'lower')
k('ground-lawn', _g('ground-lawn'), 'floor', '잔디', '버들항 잔디 칸 그대로(초원 점 무늬 드문드문, 흰 들꽃 점).',
  '정원·성당 마당·광장 가 잔디밭·마을 바깥. 꽃밭(autotile-flowerbed)을 위에 덩이로. ' + SEAM, 0, 'terrain', 'lower')
k('ground-setts', _g('ground-setts'), 'floor', '광장 큰 포석', '한 칸에 두 줄 엇갈린 사암빛 회색 큰 포석, 위·왼 모 밝음, 줄눈 한 줄.',
  '광장 한가운데·성당 앞·길드 홀 앞마당(건물 앞 4~10칸 폭). 이끼 덩이(autotile-mossy)를 구석에. ' + SEAM, 0, 'terrain', 'lower')

# ---------------------------------------------------------------- 16변형 오토타일
def _a(n): return lambda: AU.autotile(n)
k('autotile-brickstreet', _a('autotile-brickstreet'), 'autotile', '연석 두른 벽돌 거리',
  '붉은 벽돌 포장 길 16변형(위 1·오른 2·아래 4·왼 8): 속은 ground-brickpave 결, 이웃 없는 쪽은 황갈 사암 연석 띠(바깥 모서리 둥글게).',
  '아래층, 걷기. 길 붓(lay_path)으로 폭 3~5칸 큰길·광장 둘레. 자갈·흙·잔디 위 어디에나. 연석은 만든 길이라 곧다.', 0, 'terrain', 'lower')
k('autotile-puddle', _a('autotile-puddle'), 'autotile', '비 고인 웅덩이',
  '얕은 빗물 웅덩이 16변형: 흐린 하늘을 비춘 회청 물(가로 반사 줄·빛점), 젖어 거뭇한 테, 바깥 튄 물 자국. 가장자리 들쭉날쭉.',
  '아래층, 걷기. 벽돌·자갈 길 낮은 곳·배수관 밑·우물가에 2~6칸 덩이(사각·일렬 금지). 문 앞 칸은 피한다.', 0, 'terrain', 'lower')
k('autotile-mossy', _a('autotile-mossy'), 'autotile', '이끼 낀 포석',
  '돌 줄눈과 모서리로 번진 이끼 덩이 16변형: 속은 이끼가 돌을 덮고 가장자리로 갈수록 줄눈만 따라 가늘게 남는다(돌 표면 투명).',
  '아래층, 걷기. 광장 구석·성당 그늘·우물 둘레·담 밑의 포석·자갈 위에 3~10칸 덩이. 큰길 한가운데는 피한다.', 0, 'terrain', 'lower')
k('autotile-flowerbed', _a('autotile-flowerbed'), 'autotile', '꽃밭',
  '잔디 위 꽃밭 덩이 16변형: 짙은 흙 테, 속은 잎 덤불 위 빨강·노랑·보라·흰 꽃송이, 테 밖으로 잎이 비죽.',
  '아래층, 걷기. ground-lawn 위 정원·광장 화단·성당 마당에 3~12칸 덩이(둥글게, 사각 금지).', 0, 'terrain', 'lower')
k('autotile-leaves', _a('autotile-leaves'), 'autotile', '가로수 밑 낙엽',
  '마른 갈색·황갈 잎이 흩어진 깔개 16변형, 속은 촘촘하고 가장자리로 갈수록 성기다.',
  '아래층, 걷기. 가로수·광장 나무 밑 2~6칸, 길 가장자리 바람 모인 자리. 길 전체에 깔지 않는다.', 0, 'terrain', 'lower')

# ---------------------------------------------------------------- 건물(위층 지붕 칸 걷기+가림, 벽 줄 막힘)
_BI = {}
def _b(n):
    def f():
        if n not in _BI: _BI[n] = BD.BUILDINGS[n][0]()
        return _BI[n][0]
    return f
def binfo(n):
    if n not in _BI: _BI[n] = BD.BUILDINGS[n][0]()
    return _BI[n][1]
for n, (fn, ko, desc) in BD.BUILDINGS.items():
    _BI[n] = fn(); inf = _BI[n][1]
    br = inf['brows']
    if n == 'archway':
        rules = '아래 1줄의 양쪽 기둥 칸만 막힘(가운데 2칸 아치는 걷기, 위층 방은 가림). 골목·거리 끝을 가로질러 놓고 양옆에 집을 바짝 붙인다.'
    else:
        d = inf['door']
        rules = (f'아래 {br}줄(벽) 막힘, 지붕·처마 칸은 걷기+가림. 문은 왼쪽에서 {d}번째 칸(0부터) 맨 아랫줄 — 문 앞 1칸은 길(자갈·벽돌)로 비운다. '
                 '길을 따라 이웃 집과 옆벽을 맞대 촘촘히 잇는다(틈 0~1칸). 높이·폭이 다른 집을 섞어 지붕선이 들쭉날쭉하게.')
    k(n, _b(n), 'object', ko, desc, rules, br, 'building')

# ---------------------------------------------------------------- 나무
k('street-tree', street_tree, 'tree', '가로수(벽돌 받침)', '짙은 활엽수(3x4칸)와 줄기 밑 원형 벽돌 받침·흙.',
  '밑 1줄(받침·줄기)만 막힘, 수관은 걷기+가림. 큰길 연석 안쪽을 따라 4~6칸 간격(정확히 일렬 금지 — 간격을 흔든다), 광장 모퉁이.', 1, 'tree')
k('tree-round', tree_round, 'tree', '둥근 정원 나무', '버들항 둥근 덤불 나무(3x3칸).', '밑 1줄 막힘. 뒷마당·성당 마당·정원에 2~3그루 덩이.', 1, 'tree')
k('shrub', shrub, 'tree', '덤불', '버들항 작은 덤불(2x2칸).', '밑 1줄 막힘. 담 밑·건물 모퉁이·꽃밭 가.', 1, 'tree')

# ---------------------------------------------------------------- 거리 소품
def o(name, fn, ko, desc, rules, brows=1, kind='object', role='prop'): k(name, fn, kind, ko, desc, rules, brows, role)
o('fountain', G(pf.fountain), '광장 분수', '버들항 3단 돌 분수(3x3칸, 물 받이 둥근 못).', '광장 한가운데 앵커. 아래 2줄 막힘, 둘레 1칸은 비워 걷게. 둘레에 벤치·가로등.', 2)
o('well-roofed', well_stone, '지붕 우물', '갈색 기와 지붕을 얹은 돌 우물(2x2칸, 두레박).', '작은 광장·골목 교차점·뒷마당. 아래 1줄 막힘.', 1)
o('lamp-double', G(pz.lamp_double), '쌍 가로등', '쇠 기둥 위 양쪽 등 둘(2x3칸).', '밑 1줄만 막힘. 광장 모퉁이·큰길 교차점.', 1)
o('lamp-single', G(pf.lamppost), '가로등', '쇠 기둥 등 하나(1x2칸).', '밑 1줄만 막힘. 연석 안쪽 6~8칸 간격, 문 앞 피함.', 1)
o('lamp-crook', G(pz.lamp_crook), '굽은 가로등', '머리가 굽어 등이 매달린 쇠 가로등(1x3칸).', '밑 1줄만 막힘. 골목 입구·다리 방 아치 옆.', 1)
o('bench', G(pz.bench_park), '광장 벤치', '등받이 나무 벤치(2x1칸).', '1줄 막힘. 분수·가로수를 향해, 길 가장자리.', 1)
o('bench-plain', G(pi.bench), '나무 벤치', '등받이 없는 나무 벤치(2x1칸).', '1줄 막힘. 가게 앞·여관 앞.', 1)
o('parasol-table', G(pz.parasol_table), '파라솔 식탁', '줄무늬 파라솔 아래 둥근 식탁(2x2칸).', '아래 1줄 막힘(파라솔은 가림). 여관·빵집 앞 길가에 2~3개 덩이.', 1)
o('table-mugs', G(pz.table_mugs), '술잔 놓인 야외 식탁', '긴 나무 식탁과 의자, 위에 술잔(2x2칸).', '아래 1줄 막힘. 여관 앞·광장 가.', 1)
o('stall-red', stall('red', ['bread', 'cheese', 'jug']), '빵·치즈 좌판', '붉은 줄무늬 차양 시장 좌판(3x3칸), 빵·치즈·항아리.', '아래 1줄(계산대) 막힘, 차양은 가림. 광장 가장자리에 2~4개 줄을 흔들어.', 1)
o('stall-green', stall('green', ['cabbage', 'apple', 'pumpkin']), '채소 좌판', '녹색 줄무늬 차양 좌판(3x3칸), 양배추·사과·호박.', '아래 1줄 막힘. 광장 가장자리.', 1)
o('stall-blue', stall('blue', ['cloth', 'herb', 'flower']), '천·약초 좌판', '청색 줄무늬 차양 좌판(3x3칸), 천·약초·꽃.', '아래 1줄 막힘. 광장·큰길 넓은 곳.', 1)
o('flower-cart', G(pz.flower_cart), '꽃 수레', '꽃 화분을 실은 나무 수레(2x2칸).', '아래 1줄 막힘. 광장·꽃집 앞.', 1)
o('veg-cart', G(pz.veg_cart), '채소 수레', '채소 상자를 실은 수레(2x2칸).', '아래 1줄 막힘. 시장 가·빵집 뒤.', 1)
o('wagon', G(pf.cart), '짐마차', '큰 바퀴 둘 달린 짐마차(3x2칸), 짐 자루.', '아래 1줄 막힘. 길 가장자리·마구간·여관 마당. 문 앞 피함.', 1)
o('handcart', handcart, '손수레', '판자 짐칸에 자루를 실은 외바퀴 손수레(2x1칸).', '1줄 막힘. 가게 뒤·골목.', 1)
o('barrels', G(pf.barrels), '통 더미', '나무 통 셋을 쌓은 더미(2x2칸).', '아래 1줄 막힘. 여관·대장간 옆, 골목 구석.', 1)
o('rain-barrel', G(pl.rainbarrel), '빗물 통', '쇠테 나무 통 하나(1칸).', '1줄 막힘. 배수관 밑·뒷문 옆.', 1)
o('crates', G(pi.crates), '상자 더미', '나무 상자 셋을 쌓은 더미(2x2칸).', '아래 1줄 막힘. 가게 뒤·좌판 옆.', 1)
o('crate-apples', G(lambda: pz.open_crate('apple')), '사과 상자', '뚜껑 없는 사과 상자(1칸).', '1줄 막힘. 좌판·빵집 앞.', 1)
o('sacks', G(pi.sacks), '곡식 자루', '묶은 자루 둘(1칸).', '1줄 막힘. 빵집·방앗간 앞.', 1)
o('woodpile', G(pi.woodpile), '장작 더미', '쌓은 장작(2x1칸).', '1줄 막힘. 대장간·빵집 화덕 옆, 뒷마당.', 1)
o('goods-pile', G(pz.goods_pile), '짐 더미', '자루·상자·통을 덮개로 묶은 짐(2x2칸).', '아래 1줄 막힘. 여관 마당·마차 옆.', 1)
o('anvil', G(pf.anvil), '모루', '쇠 모루(1칸).', '1줄 막힘. 대장간 화덕 앞.', 1)
o('trough', G(pi.trough), '물 구유', '나무 물 구유(2x1칸).', '1줄 막힘. 여관 마당·대장간.', 1)
o('noticeboard', G(pi.noticeboard), '게시판', '지붕 달린 나무 게시판(2x2칸), 붙인 종이(글자 없음).', '아래 1줄 막힘. 광장·길드 홀 앞.', 1)
o('signpost', G(pl.signpost), '이정표', '나무 화살 판 이정표(1x2칸, 글자 없음).', '밑 1줄 막힘. 교차로 모퉁이.', 1)
o('banner-pole', G(pf.banner_pole), '깃대', '붉은 깃발 단 깃대(1x3칸, 문장만).', '밑 1줄 막힘. 길드 홀·성당 앞 양쪽.', 1)
o('flowerbox-long', G(pz.flowerbox_long), '긴 화분 상자', '꽃을 심은 긴 나무 상자(2x1칸).', '1줄 막힘. 가게 진열창 앞·벤치 옆.', 1)
o('planter-round', G(pz.planter_round), '둥근 화분', '돌 화분 하나(1칸).', '1줄 막힘. 문 옆 한 쌍.', 1)
o('door-pots', G(pz.door_pots), '문 옆 화분', '작은 화분 무리(1칸).', '1줄 막힘. 문 옆(문 앞 칸은 비운다).', 1)
o('flower-tub-red', flower_tub('red'), '붉은 꽃 통', '쇠테 반쪽 통에 붉은 꽃(1칸).', '1줄 막힘. 여관·빵집 문 옆, 광장 벤치 끝.', 1)
o('flower-tub-yellow', flower_tub('yel'), '노란 꽃 통', '쇠테 반쪽 통에 노란 꽃(1칸).', '1줄 막힘. 문 옆·창 밑.', 1)
o('bollard', bollard, '돌 말뚝', '둥근 머리 사암 말뚝(1칸).', '1줄 막힘. 광장 입구·연석 모퉁이에 2~4개(틈을 두어 사람은 지나게).', 1)
o('brick-wall', brick_wall(3), '낮은 벽돌 담', '갓돌 얹은 낮은 붉은 벽돌 담(3x1칸).', '1줄 막힘. 정원·성당 마당·뒷마당 둘레, 이어 붙여 쓴다. 끝은 wall-pillar.', 1, role='wall')
o('wall-pillar', wall_pillar, '담 끝 기둥', '공 장식 얹은 벽돌 기둥(1x2칸).', '밑 1줄 막힘. 담 끝·마당 입구 양쪽.', 1, role='wall')
o('downpipe', downpipe, '배수관', '처마 깔때기 머리·쇠 관·고정 띠·꺾인 발과 물받이 돌(1x4칸).', '벽 덧그림(막힘 없음, 위에 그린다): 두 집이 맞닿은 벽 이음매나 집 모퉁이 벽 위, 밑동을 건물 맨 아랫줄에 맞춘다. 밑에 빗물 통·웅덩이.', 0)
for kind_, ko_ in (('bread', '빵'), ('mug', '술잔'), ('bed', '침대'), ('anvil', '모루'), ('key', '열쇠'), ('herb', '약초'), ('boot', '장화'), ('cloth', '옷')):
    o(f'wall-sign-{kind_}', wall_sign(kind_), f'벽 걸이 간판({ko_})', f'벽에서 나온 쇠 막대에 매단 나무 판, {ko_} 그림 기호(글자 없음, 1칸).',
      '벽 덧그림(막힘 없음): 가게 문 옆 1층 위쪽 벽에 찍는다. 문 바로 위는 피한다.', 0)
for kind_, ko_ in (('bread', '빵'), ('mug', '술잔'), ('bed', '침대'), ('anvil', '모루')):
    o(f'sign-board-{kind_}', sign_board(kind_), f'세운 그림 간판({ko_})', f'나무 기둥 둘 위 판에 {ko_} 그림 기호(1x2칸, 글자 없음).', '밑 1줄 막힘. 가게 문 옆 길가(문 앞 칸은 비운다).', 1)

# 막힘 예외: 다리 방 아치는 맨 아랫줄의 양쪽 기둥 칸만 막는다(가운데 통로 걷기).
BLOCKMASK = {'archway': lambda i, j, wc: i in (0, wc - 1)}
