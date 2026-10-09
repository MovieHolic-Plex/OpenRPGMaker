# 녹청 지붕 저택가 키트 목록 — 조각 이름 → (그리기 함수, 메타). 메타 형식은 앞 장소 partmeta.json 과 같다
# (kind·ko·desc·rules·brows·role·layer·passable). brows = 막히는 아랫줄 수(키 큰 부드러운 물체 1, 단단한 몸통 1~2, 건물 벽 2~3).
from vq_base import *
import vq_ground as GR, vq_auto as AU, vq_houses as HS
import vq_props as P1, vq_props2 as P2

def M(kind, ko, desc, rules, brows=None, role=None, layer=None, passable=None):
    m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
    if brows is not None: m['brows'] = brows
    if role: m['role'] = role
    if layer: m['layer'] = layer
    if passable is not None: m['passable'] = passable
    return m

BLD = '아래 {b}줄(1층 벽·문)만 막힘, 위 벽·지붕 칸은 걷기+가림(뒤로 지나간다). 문 앞 1칸은 ground-flagstone 보도로 비운다. '
K = {
 # ---------------------------------------------------------------- 맨 바탕 표본(3x3, 48 주기)
 'ground-cobble': (lambda: GR.ground_sample('ground-cobble'), M('floor', '둥근 자갈 광장', '누른 회색 둥근 자갈(돌마다 위·왼 빛, 아래·오른 그늘, 밝은 줄눈) — 버들항 자갈 칸 잔결을 섞은 저택가 기본 바닥.', '광장·큰길·마차길의 기본 바닥. 맨 먼저 넓게 깐다. 3x3 이어 붙여도 이음새가 없다. 잔디와 만나는 경계는 autotile-cobblepath 로 덮는다.', 0, 'terrain', 'lower')),
 'ground-flagstone': (lambda: GR.ground_sample('ground-flagstone'), M('floor', '크림 보도 판석', '크림색 큰 판석(줄 12px, 판 길이 섞임, 위·왼 모 밝게, 드문 금) — 건물 앞 보도·현관 앞마당.', '집 앞 1~2칸 보도 띠, 저택 현관 앞마당, 분수 둘레. 자갈 광장과 곧은 경계로 만나도 된다(연석 느낌). 3x3 이어 붙여도 이음새가 없다.', 0, 'terrain', 'lower')),
 'ground-wetstone': (lambda: GR.ground_sample('ground-wetstone'), M('floor', '젖은 각석 골목', '비 갠 뒤 청회 각석(6x6, 둥근 모), 줄눈에 고인 물·윗모 하늘빛 맺힘 — 그늘진 뒷골목·마차 차고 앞.', '건물 사이 좁은 골목, 북쪽 그늘 길, 마차 차고 앞마당. autotile-puddle 을 위에 얹으면 더 젖어 보인다. 3x3 이어 붙여도 이음새가 없다.', 0, 'terrain', 'lower')),
 'ground-lawn': (lambda: GR.ground_sample('ground-lawn'), M('floor', '저택 정원 잔디', '버들항 잔디 칸 결을 늦겨울 짙은 녹으로, 초원 점·마른 풀 덩이·드문 작은 흰 꽃 — 철책 안 정원.', '철책·회양목으로 둘러친 정원 속, 가로수 밑 띠. 자갈길은 autotile-cobblepath, 남은 눈은 autotile-slush 로 덮는다.', 0, 'terrain', 'lower')),
 'ground-gravel': (lambda: GR.ground_sample('ground-gravel'), M('floor', '정원 자갈길', '버들항 흙 칸 결을 누른 회색 잔자갈로, 잔돌 점(윗점 밝게·아랫점 그늘) — 정원 산책길·마당.', '정원 안 산책길·화단 사이·마구간 마당. 잔디와의 경계는 곧게 두지 말고 덩이 둘레에 이끼·눈 오토타일을 얹는다. 3x3 이어 붙여도 이음새가 없다.', 0, 'terrain', 'lower')),
 # ---------------------------------------------------------------- 16변형 오토타일
 'autotile-puddle': (lambda: AU.sheet('autotile-puddle'), M('autotile', '젖은 자갈 웅덩이', '자갈 바닥에 고인 얕은 빗물 덩이 16변형(위1·오른2·아래4·왼8): 흐린 하늘을 비춘 물(가로 빛 줄·빗방울 고리), 물가는 젖어 짙은 자갈 머리, 바깥은 물기 번진 돌 틈. 가장자리 둥글고 울퉁불퉁.', '아래층, 걷기(얕은 물). ground-cobble·ground-wetstone 위 2~8칸 덩이(사각형·일렬 금지). 길 낮은 곳·가로등 밑·분수 둘레·문 앞을 피한 보도 가장자리.', 0, 'terrain', 'lower', True)),
 'autotile-moss': (lambda: AU.sheet('autotile-moss'), M('autotile', '돌 틈 이끼', '그늘진 돌 바닥을 덮은 이끼 깔개 16변형: 촘촘한 이끼 덩이(빛 점·포자 대), 가장자리로 갈수록 성겨져 돌 틈 점으로 흩어진다.', '아래층, 걷기. 건물 북쪽 그늘·담 밑·우물·분수 둘레·뒷골목 판석 위에 3~10칸 덩이. 광장 한가운데·문 앞은 피한다.', 0, 'terrain', 'lower', True)),
 'autotile-slush': (lambda: AU.sheet('autotile-slush'), M('autotile', '녹는 눈', '늦겨울 그늘에 남은 녹는 눈 덩이 16변형: 회백 눈(굳은 결·섞인 자갈 점), 가장자리는 질척한 회색 물기로 얇아지고 바깥엔 녹은 물 점.', '아래층, 걷기. 담·건물 북쪽 그늘, 정원 잔디 구석, 길가에 2~12칸 덩이(참고 그림처럼 길 가장자리를 따라 길게 남은 눈). 가로등·문 앞은 피한다.', 0, 'terrain', 'lower', True)),
 'autotile-cobblepath': (lambda: AU.sheet('autotile-cobblepath'), M('autotile', '잔디 위 자갈길', '정원·뒷골목 잔디 위 둥근 자갈길 16변형: 속은 ground-cobble 과 같은 결, 가장자리는 자갈이 성겨지며 흙이 드러나고 잔디가 먹어 든다.', '아래층, 걷기. 잔디(ground-lawn) 위 길 이음 — 폭 2~3칸으로 굽게 그린다. 광장(ground-cobble)과 만나는 끝은 광장 칸까지 1칸 겹쳐 칠한다.', 0, 'terrain', 'lower', True)),
 'autotile-ironrail': (lambda: AU.sheet('autotile-ironrail'), M('autotile', '돌 받침 쇠 난간', '낮은 크림 돌 받침(갓돌) 위 검은 쇠 난간 16변형: 동서로 이으면 앞에서 본 살 난간, 남북으로 이으면 윗면(갓돌 줄 + 살 점), 칸마다 공 머리 쇠 기둥.', '위층, 막힘(모든 칸). 정원·저택 앞마당 둘레, 광장과 아래 단 사이 경계. 출입은 garden-gate 를 끼운다(난간 줄을 1칸 비우고 문을 세운다).', 0, 'fence', 'upper', False)),
 'autotile-hedge': (lambda: AU.sheet('autotile-hedge'), M('autotile', '다듬은 회양목 울', '네모로 다듬은 회양목 울 16변형: 밝은 잎 윗면, 남쪽 끝은 앞면 그늘이 보여 두께가 선다.', '아래층 그림이지만 막힘. 정원 안 화단 둘레·길 가장자리에 폭 1칸 줄로(덩이로 채우지 않는다). 출입구는 1칸 비운다.', 0, 'wall', 'lower', False)),
 # ---------------------------------------------------------------- 건물(앵커)
 'mansion-grand': (HS.mansion_grand, M('object', '녹청 지붕 대저택', '8칸 폭 3층 크림 석조 대저택: 가파른 녹청 모임지붕에 뾰족 다락창 넷, 양 끝 굴뚝, 열린 덧문 창 줄, 2층 쇠 발코니, 가운데 아치 채광창 큰 문, 꽃상자.', BLD.format(b=3) + '광장 북쪽 앵커 하나. 문은 3·4열 사이 — 문 앞에 stoop-steps 와 판석 마당 3~4칸.', 3, 'building')),
 'townhouse-narrow': (HS.townhouse_narrow, M('object', '좁은 4층 타운하우스', '3칸 폭 4층 좁은 집: 덧문 창·꽃상자, 가운데 쌍문, 다락창 하나, 벽돌 굴뚝.', BLD.format(b=2) + '거리 줄에 키 다른 집과 섞는다(같은 집 연달아 금지).', 2, 'building')),
 'townhouse-balcony': (HS.townhouse_balcony, M('object', '발코니 타운하우스', '4칸 폭 3층: 2층을 두른 쇠 발코니, 1층 문 + 작은 가게 진열창, 다락창 둘.', BLD.format(b=2) + '광장 둘레·큰길 모퉁이.', 2, 'building')),
 'shop-awning': (HS.shop_awning, M('object', '줄무늬 차양 가게', '5칸 폭 2층 가게집: 1층 진열창 넷 + 유리문 위 녹색·크림 줄무늬 차양, 2층 덧문 창, 다락창 둘(간판 글자 없음).', BLD.format(b=2) + '광장·큰길 가. 차양 앞 1~2칸은 보도로 비우고 화분·벤치를 둔다.', 2, 'building')),
 'coach-house': (HS.coach_house, M('object', '마차 차고', '5칸 폭 2층 마차 차고: 아치 마차 문 + 옆 작은 문, 둥근 다락창, 한쪽 박공 끝.', BLD.format(b=2) + '저택 옆·뒷골목. 마차 문(1·2열) 앞은 ground-wetstone 마당 3칸 이상, carriage 를 세워 둔다.', 2, 'building')),
 'house-gable-end': (HS.house_gable_end, M('object', '박공 끝 집', '박공이 길을 향한 4칸 폭 2층 집: 위에서 본 남북 용마루 두 경사 + 앞 박공 삼각벽(둥근 다락창) — 집의 옆모습이 보이는 3/4 건물.', BLD.format(b=2) + '모임지붕 집 사이에 끼워 지붕 선을 바꾼다. 모퉁이·골목 끝.', 2, 'building')),
 'mansion-turret': (HS.mansion_turret, M('object', '둥근 탑 저택', '7칸 폭: 왼쪽 모퉁이 3층 둥근 탑(원뿔 녹청 지붕) + 오른쪽 3층 몸채(덧문·발코니 창·꽃상자·쌍문·다락창 둘).', BLD.format(b=2) + '광장 모퉁이·정원 저택 앵커. 탑 쪽이 길 모퉁이를 향하게.', 2, 'building')),
 'townhouse-pair': (HS.townhouse_pair, M('object', '높이 다른 두 채 집', '6칸 폭: 왼쪽 3층(다락창) + 오른쪽 4층(덧문·꽃상자·둥근 다락창)이 벽을 맞댄 집, 사이 벽돌 굴뚝.', BLD.format(b=2) + '거리 줄 사이에 넣어 처마선을 들쭉날쭉하게.', 2, 'building')),
 # ---------------------------------------------------------------- 조립 조각
 'roof-end-left': (HS.roof_end_left, M('object', '녹청 지붕 서쪽 끝', '모임지붕 서쪽 끝(2칸 폭, 높이 3칸 + 처마 코니스): 서 끝 삼각 빛면 + 추녀마루 동판.', '새 집 조립: roof-end-left + roof-span×n + roof-end-right 를 한 줄로 잇고 그 아래에 wall-bay 를 층마다 붙인다. 막지 않음(위층, 걷기+가림).', 0, 'building')),
 'roof-span': (HS.roof_span, M('object', '녹청 지붕 몸', '모임지붕 가운데 한 칸(16px 주기로 이어진다): 뒤 경사·마룻대·앞 경사·처마 물받이·코니스.', '지붕 끝 둘 사이에 원하는 칸 수만큼 잇는다. 다락창(dormer-*)은 처마선 위에 얹는다. 막지 않음.', 0, 'building')),
 'roof-end-right': (HS.roof_end_right, M('object', '녹청 지붕 동쪽 끝', '모임지붕 동쪽 끝(2칸 폭): 동 끝 삼각 그늘면 + 추녀마루.', 'roof-span 줄의 오른쪽 끝. 막지 않음.', 0, 'building')),
 'wall-bay-window': (lambda: HS.wall_bay('H'), M('object', '벽 칸 · 덧문 연 창', '크림 마름돌 벽 한 칸·한 층(16x32): 상인방·창턱 돌 + 양쪽으로 접힌 회록 덧문.', '지붕 조각 아래 층마다 이어 붙인다(위층용). 벽 칸은 1층이면 막힘 2줄, 위층은 가림.', 2, 'wall')),
 'wall-bay-shutter': (lambda: HS.wall_bay('S'), M('object', '벽 칸 · 덧문 닫힌 창', '크림 마름돌 벽 한 칸·한 층: 닫힌 회록 겹살 덧문.', '창 칸 사이에 섞어 리듬을 바꾼다(같은 칸 연달아 셋 이상 금지).', 2, 'wall')),
 'wall-bay-flower': (lambda: HS.wall_bay('F'), M('object', '벽 칸 · 꽃상자 창', '크림 마름돌 벽 한 칸·한 층: 유리창 + 창턱 아래 붉은 제라늄 꽃상자.', '2층 창 줄에 드문드문.', 2, 'wall')),
 'wall-bay-balcony': (lambda: HS.wall_bay('B'), M('object', '벽 칸 · 쇠 난간 창', '크림 마름돌 벽 한 칸·한 층: 키 큰 창 + 창 앞 작은 쇠 난간.', '2층(귀족층) 창 줄.', 2, 'wall')),
 'wall-bay-door': (lambda: HS.wall_bay('D', True), M('object', '벽 칸 · 쌍문(1층)', '크림 마름돌 1층 한 칸: 누른 받침돌 + 돌 문틀 + 위 채광 유리 쌍문.', '1층 줄에 하나. 문 앞 1칸은 보도. 아래 2줄 막힘(문 칸은 이동 이벤트 자리).', 2, 'wall')),
 'wall-bay-shop': (lambda: HS.wall_bay('s', True), M('object', '벽 칸 · 가게 진열창(1층)', '크림 마름돌 1층 한 칸: 받침돌 + 나무 틀 진열창(병·빵 그림 기호).', '1층 가게 줄. 위에 차양을 원하면 shop-awning 을 쓴다.', 2, 'wall')),
 'wall-bay-ground': (lambda: HS.wall_bay('w', True), M('object', '벽 칸 · 1층 창', '크림 마름돌 1층 한 칸: 받침돌 + 유리창.', '1층 줄의 기본 칸.', 2, 'wall')),
 'dormer-point': (HS.dormer_point, M('object', '뾰족 다락창', '녹청 작은 박공 지붕 + 크림 앞면 + 겹살 덧문 창(지붕 앞 경사에 얹는다).', '지붕(roof-span·집 지붕)의 처마선 바로 위, 창 칸 중심에 맞춰 얹는다. 막지 않음. 한 지붕에 2~4개, 간격 2칸 이상.', 0, 'building')),
 'dormer-round': (HS.dormer_round, M('object', '둥근 황소눈 다락창', '동판 덮개 아치 속 둥근 유리창(지붕 앞 경사에 얹는다).', '뾰족 다락창 사이 가운데에 하나. 막지 않음.', 0, 'building')),
 'chimney-stone': (HS.chimney_stone, M('object', '크림 돌 굴뚝', '갓돌·연통 구멍 둘·마름돌 앞면 굴뚝(지붕 뒤 경사에서 솟는다).', '지붕 끝 가까이 마룻대 위에 얹는다. 막지 않음.', 0, 'building')),
 'chimney-brick': (HS.chimney_brick, M('object', '벽돌 굴뚝', '갓돌·연통 구멍 둘·바랜 벽돌 굴뚝.', '집 사이 맞벽 위·지붕 끝. 막지 않음.', 0, 'building')),
 # ---------------------------------------------------------------- 담·문
 'garden-gate': (P2.garden_gate, M('object', '정원 쇠 대문(닫힘)', '돌 문기둥 둘(항아리 머리) 사이 둥근 고리 무늬 쌍 쇠문.', 'autotile-ironrail 줄에 3칸을 비우고 세운다. 아래 1줄 막힘(가운데 칸은 문 이벤트 자리).', 1, 'fence')),
 'garden-gate-open': (lambda: P2.garden_gate(True), M('object', '정원 쇠 대문(열림)', '양쪽으로 활짝 연 쇠 대문과 돌 문기둥.', '난간 줄 출입구. 양 끝 문기둥 칸만 막힘(가운데 1칸 걷기) — 지도에서 기둥 칸을 막고 가운데를 비운다.', 1, 'fence')),
 'gatepost': (P2.gatepost, M('object', '돌 문기둥', '네모 크림 돌 기둥 + 갓돌 + 항아리 화분 머리.', '난간·회양목 줄 끝, 정원 입구 양쪽. 밑 1줄 막힘.', 1, 'fence')),
 # ---------------------------------------------------------------- 거리 소품
 'lamp-triple': (lambda: P1.lamp_post(3), M('object', '세 등 가로등', '검은 쇠 가로등: 계단 받침 + 마디 기둥 + 꼭대기 큰 등 하나와 양쪽 휜 팔 끝 작은 등 둘(낮: 흐린 유리).', '광장·저택 앞 보도 모퉁이. 밑 1줄 막힘(위 칸은 걷기+가림). 4~6칸 간격, 일렬 금지.', 1, 'prop')),
 'lamp-single': (lambda: P1.lamp_post(1), M('object', '가로등', '검은 쇠 기둥 위 등 머리 하나.', '거리 가장자리·골목. 밑 1줄 막힘.', 1, 'prop')),
 'lamp-wall': (P1.lamp_wall, M('object', '벽 등', '쇠 까치발에 매단 등(벽에 붙인다).', '집 문 옆 벽 위(1층 창 높이). 막지 않음(벽 앞 덧그림).', 0, 'prop')),
 'street-clock': (P1.street_clock, M('object', '거리 시계', '쇠 기둥 위 둥근 시계(눈금 점·바늘, 숫자 없음).', '광장 모퉁이 하나. 밑 1줄 막힘.', 1, 'prop')),
 'carriage': (P1.carriage, M('object', '세워 둔 마차', '닫힌 사륜 마차: 짙은 녹청 칠 몸채(누른 테·유리창·문), 짐 난간 지붕, 큰 뒷바퀴·작은 앞바퀴, 마부석, 앞 끌채(말 없음).', '마차 차고 앞·저택 현관 앞 자갈. 아래 1줄(바퀴) 막힘. 끌채가 길 쪽을 향하게.', 1, 'prop')),
 'handcart': (P1.handcart, M('object', '짐 손수레', '판자 짐칸 + 큰 바퀴 하나 + 손잡이 둘의 손수레.', '가게 옆·골목. 아래 1줄 막힘.', 1, 'prop')),
 'wheelbarrow': (P1.wheelbarrow, M('object', '외바퀴 수레', '쇠 통 외바퀴 수레.', '정원·마구간 마당. 1칸 막힘.', 1, 'prop')),
 'well-stone': (P1.well_stone, M('object', '쇠 아치 돌 우물', '둥근 크림 돌 우물(갓돌 고리·어두운 물) 위 쇠 아치·도르래·두레박.', '뒷골목 작은 마당·정원 구석. 아래 1줄 막힘. 둘레에 autotile-moss·puddle 덩이.', 1, 'prop')),
 'fountain': (P1.fountain, M('object', '광장 분수', '낮은 둥근 돌 수반(녹청 그림자 물·물결 줄) + 가운데 기둥 위 작은 접시 + 솟는 물줄기.', '광장 한가운데 앵커. 아래 2줄 막힘. 둘레 1칸은 ground-flagstone 고리.', 2, 'prop')),
 'trough': (P1.trough, M('object', '말 물통', '돌 물통(물 + 쇠 꼭지).', '마차 차고·우물 옆. 1줄 막힘.', 1, 'prop')),
 'street-tree': (P1.street_tree, M('tree', '가로수', '둥근 보리수 수관 + 밑변과 같은 폭 줄기 + 밑동 둥근 쇠 덮개.', '보도·정원 가장자리. 밑 1줄(줄기)만 막힘, 수관 칸은 걷기+가림. 3~5칸 간격, 일렬 금지(정원에선 덩이).', 1, 'tree')),
 'topiary-cone': (P1.topiary_cone, M('tree', '원뿔 주목 화분', '돌 화분 위 원뿔로 다듬은 주목.', '현관 양옆 한 쌍, 정원 길가. 밑 1줄 막힘.', 1, 'tree')),
 'urn-planter': (P1.urn_planter, M('object', '돌 항아리 화분', '굽 달린 돌 항아리 + 둥근 관목과 붉은 꽃.', '계단·문기둥 옆, 분수 둘레. 1칸 막힘.', 1, 'prop')),
 'planter-box': (P1.planter_box, M('object', '긴 돌 화단', '크림 돌 상자 화단 + 잎과 붉은 꽃.', '가게 앞·가로등 옆 보도(참고 그림처럼). 1줄 막힘.', 1, 'prop')),
 'hedge-short': (P1.hedge_short, M('object', '회양목 덤불', '네모로 다듬은 짧은 회양목 덤불(2칸).', '정원 길 끝·벤치 뒤. 1줄 막힘. 긴 줄은 autotile-hedge.', 1, 'prop')),
 'bench-iron': (P1.bench_iron, M('object', '쇠 다리 벤치', '나무 널 등받이·앉는 판 + 소용돌이 쇠 다리.', '광장 가장자리·정원 길가·가로수 밑. 1줄 막힘.', 1, 'prop')),
 'flower-cart': (P1.flower_cart, M('object', '꽃 수레', '바퀴 둘 나무 수레 위 꽃 양동이 셋(붉은·누른·흰).', '광장 가 가게 앞. 아래 1줄 막힘.', 1, 'prop')),
 'barrel': (P2.barrel, M('object', '나무 통', '쇠 테 두른 나무 통.', '가게 옆·골목·마차 차고. 1칸 막힘. 2~3개 덩이로.', 1, 'prop')),
 'barrel-stack': (P2.barrel_stack, M('object', '통 무더기', '통 둘 위에 눕힌 통 하나.', '골목 끝·창고 앞. 아래 1줄 막힘.', 1, 'prop')),
 'crates': (P2.crates, M('object', '나무 상자', '큰 상자 위 작은 상자.', '가게 뒤·손수레 옆. 1칸 막힘.', 1, 'prop')),
 'sacks': (P2.sacks, M('object', '자루', '묶은 삼베 자루 셋.', '손수레·가게 옆. 1칸 막힘.', 1, 'prop')),
 'bollard': (P2.bollard, M('object', '쇠 말뚝', '둥근 머리 검은 쇠 말뚝.', '보도와 마차길 경계에 2~3칸 간격. 1칸 막힘.', 1, 'prop')),
 'notice-column': (P2.notice_column, M('object', '광고 기둥', '녹청 돔 갓을 쓴 원통 기둥 + 바랜 종이 세 장(글자 없음).', '광장 모퉁이·큰길 갈림. 밑 1줄 막힘.', 1, 'prop')),
 'monument-column': (P2.monument_column, M('object', '기념 기둥', '계단 받침 위 크림 원기둥 + 녹청 동판 구.', '광장 축 끝·정원 원형 마당 가운데 앵커. 아래 2줄 막힘.', 2, 'prop')),
 'snow-heap': (P2.snow_heap, M('object', '치워 쌓은 눈 더미', '녹는 눈 덩이(회백, 녹은 물기·섞인 자갈 점).', '길 가장자리·담 밑. 1줄 막힘. 주변에 autotile-slush 덩이.', 1, 'prop')),
 'firewood': (P2.firewood, M('object', '장작 더미', '마구리가 보이는 쌓인 통나무 + 위 덮은 널.', '집 벽·마차 차고 옆에 붙여. 1줄 막힘.', 1, 'prop')),
 # ---------------------------------------------------------------- 바닥 덧그림(걷기)
 'stoop-steps': (P2.stoop_steps, M('decal', '현관 돌계단', '문 앞 낮은 돌계단 셋(윗면 밝게).', '큰 문 바로 앞 칸(걷기). 집 문 열에 맞춘다.', 0, 'decal')),
 'puddle-small': (P2.decal_puddle, M('decal', '작은 물웅덩이', '흐린 하늘을 비춘 납작한 작은 물.', '자갈·각석 위 드문드문(걷기). 큰 덩이는 autotile-puddle.', 0, 'decal')),
 'leaves-wet': (P2.decal_leaves, M('decal', '젖은 낙엽', '누른·갈색 잎 흩어짐.', '가로수 밑·벤치 둘레(걷기).', 0, 'decal')),
 'manhole': (P2.decal_manhole, M('decal', '맨홀 뚜껑', '둥근 쇠 뚜껑.', '큰길 가운데·광장 가장자리 한두 곳(걷기, 하수도 입구 이벤트 자리).', 0, 'decal')),
 'drain-grate': (P2.decal_drain, M('decal', '빗물받이 창살', '보도 끝 네모 쇠 창살.', '보도와 길 경계(걷기).', 0, 'decal')),
 'moss-crack': (P2.decal_mosscrack, M('decal', '돌 틈 이끼 금', '꺾인 금 줄 따라 이끼 점.', '판석·각석 위(걷기).', 0, 'decal')),
 'cellar-hatch': (P2.decal_hatch, M('decal', '지하 저장고 덧문', '보도 위 나무 쌍문(쇠 경첩).', '가게·선술집 앞 보도(걷기, 지하로 내려가는 이벤트 자리).', 0, 'decal')),
}

_IMG = {}
def img(name):
    if name not in _IMG: _IMG[name] = K[name][0]()
    return _IMG[name]
