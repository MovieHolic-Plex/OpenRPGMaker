# 증기 도시 조각 목록: (이름, 그림 함수, kind, 한글 이름, 설명, 놓는 법, brows, layer, role). 지도와 내보내기가 같은 그림을 쓴다.
from functools import lru_cache
import sc_build as B, sc_props as P, sc_ground as G, sc_auto as AU

# 집 정의: 이름 → (rowhouse 인자, 문 칸, 막힘 줄)
HOUSES = {
    'house_brick_3':        (dict(wc=3, storeys=2, seed=11, door=1, pipes=((40, 'brass', -1),), lit=((0, 1),)), 1, 4),
    'house_brick_copper_4': (dict(wc=4, storeys=2, seed=21, door=1, roof='copper', pipes=((6, 'rust', 1),), gauge_at=(36, 40), lit=((0, 3),)), 1, 4),
    'house_brick_balcony_5': (dict(wc=5, storeys=2, seed=14, door=2, balcony=True, pipes=((24, 'brass', 1),), lit=((0, 0),)), 2, 4),
    'house_mansard_verd_4': (dict(wc=4, storeys=2, seed=13, door=2, roof='verd', pipes=((58, 'brass', -1),), lit=((0, 1),)), 2, 4),
    'shop_awning_red_4':    (dict(wc=4, storeys=2, seed=15, door=1, shop=True, awning='redl', lit=((1, 0), (1, 3), (0, 2))), 1, 4),
    'shop_awning_verd_3':   (dict(wc=3, storeys=2, seed=16, door=1, roof='copper', shop=True, awning='verd', lit=((1, 2),)), 1, 4),
    'tenement_copper_4':    (dict(wc=4, storeys=3, seed=12, door=1, roof='copper', pipes=((6, 'rust', 1), (58, 'brass', -1)), gauge_at=(20, 70), lit=((1, 2),)), 1, 6),
    'tenement_slate_5':     (dict(wc=5, storeys=3, seed=17, door=3, balcony=True, pipes=((40, 'brass', 1),), lit=((0, 1), (2, 4))), 3, 6),
}


@lru_cache(None)
def house(name): return B.rowhouse(**HOUSES[name][0])


HKO = {'house_brick_3': ('벽돌 줄집(3칸 2층, 검은 슬레이트)', '그을린 붉은 벽돌 + 아치 창 + 층 돌림띠, 오른쪽 벽을 타고 처마 밑으로 들어가는 놋쇠 관, 벽돌 굴뚝과 김.'),
       'house_brick_copper_4': ('구리 지붕 벽돌집(4칸 2층)', '구리 모임지붕(녹청 줄), 왼쪽 벽을 타는 구리 관, 벽 계기 상자(압력계·밸브), 나무 아치 문.'),
       'house_brick_balcony_5': ('무쇠 발코니 벽돌집(5칸 2층)', '2층 앞을 가로지르는 검은 무쇠 발코니, 가운데 놋쇠 관, 넓은 검은 슬레이트 지붕.'),
       'house_mansard_verd_4': ('녹청 망사르드 벽돌집(4칸 2층)', '녹청 구리 망사르드 지붕(지붕창 넷, 구리 테 몰딩), 오른쪽 놋쇠 관, 벽돌 몸채.'),
       'shop_awning_red_4': ('붉은 줄무늬 차양 가게(4칸 2층)', '1층 큰 진열창(무쇠 틀 + 호박빛, 놋쇠 띠) + 붉은·흰 줄무늬 차양, 2층 벽돌 아치 창. 간판 글자 없음.'),
       'shop_awning_verd_3': ('녹청 차양 가게(3칸 2층, 구리 지붕)', '1층 진열창 + 녹청·흰 줄무늬 차양, 구리 모임지붕. 간판 글자 없음.'),
       'tenement_copper_4': ('구리 지붕 공동주택(4칸 3층)', '3층 벽돌 공동주택, 양쪽 벽을 타는 구리·놋쇠 관, 벽 계기 상자, 구리 모임지붕.'),
       'tenement_slate_5': ('발코니 공동주택(5칸 3층)', '3층 벽돌 공동주택, 2층 무쇠 발코니, 검은 슬레이트 지붕, 놋쇠 관 하나.')}


def _house_rows():
    out = []
    for n, (kw, d, br) in HOUSES.items():
        ko, desc = HKO[n]
        rules = ('발자국: 앞면 아래 %d줄 막힘, 문 칸(왼쪽에서 %d번째, 맨 아랫줄)만 걷기 — 실내로 가는 문. 지붕·굴뚝 칸 걷기+가림. '
                 '놓을 땅: 집 앞(남쪽)에 ground-brick-walk 보도 1~2줄, 그 앞 젖은 자갈 차도. 줄집은 옆집과 벽을 붙여 한 줄로(폭·지붕·층을 섞고 '
                 '같은 집 둘 나란히 금지). 피할 곳: 문 앞 칸은 비운다, 관 아래 소품 금지.') % (br, d + 1)
        out.append((n, (lambda n=n: house(n)), 'object', ko, desc, rules, br, None, 'building'))
    return out


PARTS = _house_rows() + [
    ('clock_tower', B.clock_tower, 'object', '시계탑(5x14칸)',
     '도시의 중심 앵커. 2층 벽돌 받침(모서리 돌·아치 창·놋쇠/구리 관) 위로 벽돌 몸통(톱니 둥근 장식 창), 돌 시계 단의 큰 놋쇠 시계판(숫자 없음, 바늘 둘), '
     '종 다락(아치 셋, 가운데 놋쇠 종), 녹청 줄 구리 뾰족 지붕 + 놋쇠 꼭대기 장식. 물러난 단마다 3/4 윗면이 보인다.',
     '발자국: 받침 아래 3줄 막힘, 아치 문(가운데 칸, 맨 아랫줄)만 걷기 — 탑 안으로. 위 11줄 걷기+가림. 놓을 땅: 시계탑 광장(ground-plaza-flag) 북쪽 가운데, '
     '앞(남)에 분수나 기념비를 3칸 이상 띄워 둔다. 지도에 하나.', 3, None, 'building'),
    ('boiler_house', B.boiler_house, 'object', '보일러 집(증기 펌프장, 8x9칸)',
     '둥근 벽돌 굴뚝 둘(무쇠 띠·갓·증기), 검은 슬레이트 박공 + 마룻대 환기 탑(루버에서 김), 높은 벽돌 홀(큰 아치 창 둘에 호박빛), 가운데 아치 겹 무쇠 문, '
     '앞 왼쪽 누운 구리 보일러 통 + 놋쇠 관, 오른쪽 계기 상자·밸브 바퀴.',
     '발자국: 앞면 아래 4줄 막힘, 문 2칸(왼쪽에서 4·5번째, 맨 아랫줄) 걷기. 위 걷기+가림. 놓을 땅: 공장 구역 ground-iron-plate 마당 북쪽, 앞에 증기 기관·관·통. '
     '피할 곳: 문 앞 2칸 비움.', 4, None, 'building'),
    ('coal_hopper', B.coal_hopper, 'object', '석탄 깔때기(4x6칸)',
     '무쇠 다리 넷 위 리벳 검은 철판 상자(윗면 석탄 산), 아래로 좁아지는 깔때기와 구리 미끄럼 홈.',
     '발자국: 다리 밑동 맨 아랫줄의 양 끝 칸만 막힘, 깔때기 밑(가운데 2칸)은 걷기 — 석탄 마차가 들어가 선다. 놓을 땅: 석탄 마당(ground-cinder-yard), '
     '둘레에 autotile-coal-dust 덩이·석탄 더미. 피할 곳: 길 한가운데.', 1, None, 'building'),
    ('coal_shed', B.coal_shed, 'object', '석탄 창고(6x5칸, 앞이 열림)',
     '골판 함석 박공 지붕(녹 줄), 그을린 벽돌 뒤 벽, 열린 앞 칸 셋(나무 기둥·무쇠 보) 안에 석탄 산.',
     '발자국: 아래 2줄 막힘(칸 안은 석탄), 지붕 걷기+가림. 놓을 땅: 석탄 마당 북쪽, 앞에 마차·자루·석탄 가루 덩이. 피할 곳: 길 쪽으로 열린 칸을 막지 않는다.', 2, None, 'building'),
    ('steam_tank', B.steam_tank, 'object', '증기 저장 탱크(3x6칸)',
     '세운 리벳 검은 철 원통 + 놋쇠 띠 둘, 둥근 지붕의 안전 밸브(김), 사다리, 압력계.',
     '발자국: 아래 2줄 막힘, 위 걷기+가림. 놓을 땅: 보일러 집 옆·철판 마당 가장자리, 둘이면 높이를 달리(일렬 금지).', 2, None, 'building'),
    ('brick_chimney', B.brick_chimney, 'object', '홀로 선 공장 굴뚝(2x8칸)',
     '네모 석재 받침 위 둥근 벽돌 굴뚝(무쇠 띠), 꼭대기 갓과 증기·연기.',
     '발자국: 받침 아래 1줄 막힘, 위 걷기+가림. 놓을 땅: 공장 구역 건물 뒤·옆. 한 구역에 1~2개, 키를 달리.', 1, None, 'building'),
    # ---- 소품
    ('gas_lamp', P.gas_lamp, 'object', '가스등(1x3칸)', '검은 무쇠 기둥 + 놋쇠 꼭지 호박빛 등 + 사다리 걸이 가로대.',
     '발자국: 밑동 칸만 막힘, 위 걷기+가림. 놓을 땅: 보도 가장자리(차도 쪽) 5~8칸 간격, 양쪽 엇갈려. 피할 곳: 문 앞·모퉁이 한가운데.', 1, None, 'prop'),
    ('gas_lamp_double', P.gas_lamp_double, 'object', '쌍 가스등(2x3칸)', '굵은 무쇠 기둥 + 휜 가로 팔 양 끝 등 둘.',
     '발자국: 밑동 가운데 칸(왼쪽 칸)만 막힘. 놓을 땅: 광장 모서리·큰 길 교차점. 한 광장에 2~4개.', 1, None, 'prop'),
    ('street_clock', P.street_clock, 'object', '거리 시계(1x3칸)', '무쇠 기둥 위 놋쇠 둥근 시계(숫자 없음).',
     '발자국: 밑동만 막힘. 놓을 땅: 보도 모퉁이·역 앞·광장 입구. 지도에 1~3개.', 1, None, 'prop'),
    ('steam_vent', P.steam_vent, 'object', '증기 배출구(1x2칸)', '땅에 박힌 놋쇠 창살 상자 + 위로 솟는 흰 김.',
     '발자국: 아래 칸 막힘(뜨겁다), 김 칸 걷기+가림. 놓을 땅: 차도 가장자리·공장 마당·보일러 집 앞, 2~3개를 3칸 이상 띄워 덩이로.', 1, None, 'prop'),
    ('vent_floor', P.vent_floor, 'decal', '바닥 증기 창살(1x1)', '자갈에 박힌 놋쇠 테 창살과 새어 나오는 김 한 줌.',
     '걷기, 사람 아래. 놓을 땅: 차도·보도 아무 데나 드문드문(5칸 이상 간격).', 0, None, 'decal'),
    ('manhole_brass', P.manhole_brass, 'decal', '놋쇠 테 맨홀(1x1)', '무쇠 뚜껑 + 동심 홈 + 놋쇠 테. 글자 없음.',
     '걷기, 사람 아래. 놓을 땅: 차도 가운데 줄 8~12칸 간격.', 0, None, 'decal'),
    ('drain_grate', P.drain_grate, 'decal', '도랑 창살(1x1)', '연석 옆 무쇠 가로 창살.', '걷기, 사람 아래. 놓을 땅: 보도 연석 바로 아래 차도 칸.', 0, None, 'decal'),
    ('standpipe', P.standpipe, 'object', '증기 세움관(1x2칸)', '땅에서 솟아 꺾여 다시 들어가는 구리 관 + 놋쇠 밸브 바퀴 + 압력계.',
     '발자국: 아래 칸 막힘. 놓을 땅: 건물 벽 앞 보도·공장 마당 가장자리.', 1, None, 'prop'),
    ('pipe_hump', P.pipe_hump, 'object', '땅을 넘는 관(2x1칸)', '자갈에서 올라와 낮게 넘어가 다시 땅으로 들어가는 놋쇠 관.',
     '발자국: 두 칸 막힘(낮은 걸림). 놓을 땅: 공장 마당·뒷골목. 길을 막지 않게 가장자리에.', 1, None, 'prop'),
    ('pipe_arch', P.pipe_arch, 'object', '길 위 관 다리(6x3칸)', '양쪽 무쇠 기둥(가새) 위 굵은 구리 관 + 가는 놋쇠 관 + 가운데 밸브와 김.',
     '발자국: 양 끝 기둥 밑동 칸(왼쪽 1번째·오른쪽 6번째, 맨 아랫줄)만 막힘 — 관 아래로 지나간다. 위 줄 걷기+가림. 놓을 땅: 차도를 가로질러 공장과 건물 사이.', 1, None, 'prop'),
    ('coal_cart', P.coal_cart, 'object', '석탄 마차(3x2칸)', '나무 짐칸 위 석탄 산, 무쇠 테 살 바퀴 둘, 앞으로 뻗은 끌채(말 없음).',
     '발자국: 아래 1줄 3칸 막힘, 윗줄 걷기+가림. 놓을 땅: 석탄 깔때기 밑·석탄 마당 입구·차도 가장자리. 끌채는 길 쪽.', 1, None, 'prop'),
    ('coal_heap', P.coal_heap, 'object', '석탄 더미(2x2칸)', '쏟아 쌓은 석탄 산과 흘러내린 덩이.',
     '발자국: 아래 1줄 막힘. 놓을 땅: 석탄 마당, 둘레에 autotile-coal-dust 를 1~2칸 번지게. 크기·간격을 달리(일렬 금지).', 1, None, 'prop'),
    ('coal_sacks', P.coal_sacks, 'object', '석탄 자루(2x1칸)', '삼베 자루 셋, 묶은 목 위로 석탄.', '발자국: 칸 막힘. 놓을 땅: 마차 곁·창고 벽 앞.', 1, None, 'prop'),
    ('coal_barrow', P.coal_barrow, 'object', '석탄 손수레(1x1)', '무쇠 통 + 바퀴 하나 + 손잡이.', '발자국: 칸 막힘. 놓을 땅: 석탄 더미 곁·보일러 집 앞.', 1, None, 'prop'),
    ('oil_barrels', P.oil_barrels, 'object', '기름통 무리(2x2칸)', '검은 무쇠 통 둘 + 구리 통 하나(놋쇠 테).',
     '발자국: 아래 1줄 막힘. 놓을 땅: 공장 마당 벽 앞, 곁에 autotile-oil-slick 작은 덩이.', 1, None, 'prop'),
    ('crates_brass', P.crates_brass, 'object', '짐 상자 더미(2x2칸)', '놋쇠 모서리 쇠를 댄 나무 상자 셋.',
     '발자국: 아래 1줄 막힘. 놓을 땅: 가게 뒤·창고 앞·부두 쪽 길가.', 1, None, 'prop'),
    ('iron_bench', P.iron_bench, 'object', '무쇠 벤치(2x1칸)', '나무 널 앉음판·등판 + 무쇠 다리.', '발자국: 칸 막힘. 놓을 땅: 광장 가장자리·가로수 사이, 길을 등지고.', 1, None, 'prop'),
    ('bollard_iron', P.bollard_iron, 'object', '무쇠 말뚝(1x1)', '둥근 머리 + 놋쇠 띠.', '발자국: 칸 막힘. 놓을 땅: 광장 입구·보도 모퉁이에 2~3개 띄워.', 1, None, 'prop'),
    ('steam_hydrant', P.steam_hydrant, 'object', '증기 소화전(1x1)', '놋쇠 몸통 + 양옆 마개 + 무쇠 받침.', '발자국: 칸 막힘. 놓을 땅: 보도 차도 쪽 가장자리.', 1, None, 'prop'),
    ('pillar_box', P.pillar_box, 'object', '우편 기둥(1x2칸)', '붉은 도장 무쇠 원통 + 둥근 갓 + 투입구(글자 없음).', '발자국: 밑동만 막힘. 놓을 땅: 보도 모퉁이.', 1, None, 'prop'),
    ('poster_column', P.poster_column, 'object', '광고 기둥(1x3칸)', '둥근 기둥에 그림 벽보(톱니·비행선 실루엣·줄무늬, 글자 없음) + 구리 둥근 지붕.',
     '발자국: 밑동만 막힘. 놓을 땅: 광장 가장자리·큰 길 모퉁이. 지도에 1~3개.', 1, None, 'prop'),
    ('gear_scrap', P.gear_scrap, 'object', '버린 톱니 더미(2x1칸)', '녹슨 톱니 둘 + 쇠막대·나사.', '발자국: 칸 막힘. 놓을 땅: 공장 마당 구석·뒷골목.', 1, None, 'prop'),
    ('wheel_lean', P.wheel_lean, 'object', '기댄 마차 바퀴(1x1)', '무쇠 테 나무 살 바퀴.', '발자국: 칸 막힘. 놓을 땅: 벽 앞·마차 곁.', 1, None, 'prop'),
    ('steam_fountain', P.steam_fountain, 'object', '증기 분수(3x3칸)', '둥근 석재 수반 안 김 서린 물, 가운데 놋쇠 기둥(톱니 고리)에서 흰 김.',
     '발자국: 아래 2줄 막힘, 김 칸 걷기+가림. 놓을 땅: 시계탑 광장 가운데(탑 앞 3칸 이상 띄워). 둘레 2칸 비움.', 2, None, 'prop'),
    ('gear_monument', P.gear_monument, 'object', '톱니 기념비(2x3칸)', '계단 두 단 석재 받침 위 세운 큰 놋쇠 톱니 + 맞물린 검은 톱니.',
     '발자국: 받침 아래 1줄 막힘. 놓을 땅: 광장 모서리·대로 끝. 지도에 하나.', 1, None, 'prop'),
    ('steam_engine', P.steam_engine, 'object', '증기 기관(3x2칸)', '누운 구리 실린더 + 피스톤 + 검은 무쇠 플라이휠 + 짧은 굴뚝 김, 석재 받침.',
     '발자국: 아래 1줄 막힘. 놓을 땅: 보일러 집 앞·공장 마당. 관(pipe_hump·standpipe)과 이어 둔다.', 1, None, 'prop'),
    ('water_tower', P.water_tower, 'object', '급수탑(2x4칸)', '무쇠 다리 위 리벳 철 물탱크(구리 원뿔 갓) + 내려오는 구리 급수관.',
     '발자국: 맨 아랫줄 막힘, 위 걷기+가림. 놓을 땅: 석탄 마당·공장 구역 가장자리. 지도에 1~2개.', 1, None, 'prop'),
    ('kiosk', P.kiosk, 'object', '신문 판매대(2x3칸)', '구리 둥근 지붕 + 팔각 무쇠 몸통(호박빛 진열창, 글자 없음) + 판매 턱.',
     '발자국: 아래 2줄 막힘, 지붕 걷기+가림. 놓을 땅: 광장 가장자리·큰 길 보도. 앞(남) 1칸 비움.', 2, None, 'prop'),
    ('tree_grate', P.tree_grate, 'tree', '무쇠 창살 가로수(2x3칸)', '둥근 활엽수 수관 + 줄기 + 무쇠 나무 창살 받침.',
     '발자국: 줄기 칸(아래 1줄 왼쪽 칸)만 막힘, 수관 걷기+가림. 놓을 땅: 넓은 보도·광장 가장자리 4~6칸 간격(줄 맞춤 금지).', 1, None, 'tree'),
    # ---- 바닥 표본(3x3칸, 이음새 없음)
    ('ground-wet-cobble', G.ground_wet_cobble, 'floor', '젖은 검은 자갈(차도)', '버들항 둥근 돌 결을 그을음 낀 검은 회색으로, 젖은 돌 윗면 빛 점.',
     '맨 바탕: 차도·골목 전체를 먼저 이것으로 칠한다(길 = 이 표본을 이어 붙인 띠, 폭 2~4칸). 이어 붙여도 이음새 없음.', 0, 'lower', 'terrain'),
    ('ground-brick-walk', G.ground_brick_walk, 'floor', '벽돌 보도', '바구니 짜임 붉은 벽돌 포장(8x8 블록마다 가로·세로 벽돌 번갈아).',
     '집·가게 앞 1~2줄 보도. 차도보다 한 단 높다 — 차도와 만나는 남쪽 가장자리에 연석(ground-curb-edge 를 본보기로).', 0, 'lower', 'terrain'),
    ('ground-plaza-flag', G.ground_plaza_flag, 'floor', '시계탑 광장 판석', '젖은 회색 큰 판석(판마다 결 위치를 옮김, 드문 금).',
     '광장 속. 가장자리에 연석. 시계탑·분수·기념비를 이 위에 놓는다.', 0, 'lower', 'terrain'),
    ('ground-iron-plate', G.ground_iron_plate, 'floor', '리벳 검은 철판 마당', '16px 철판(모서리 리벳) + 여섯에 하나 배수 창살 판.',
     '공장·보일러 집 앞 마당. 자갈 차도와 같은 높이(턱 없음).', 0, 'lower', 'terrain'),
    ('ground-cinder-yard', G.ground_cinder_yard, 'floor', '석탄 마당 다진 재', '칩셋 흙 결을 검은 회색 재로, 석탄 알갱이(윗왼 빛).',
     '석탄 깔때기·석탄 더미가 있는 마당. 위에 autotile-coal-dust 덩이를 번지게.', 0, 'lower', 'terrain'),
    ('ground-curb-edge', G.ground_curb_edge, 'floor', '보도-차도 연석 본보기', '위 2칸 벽돌 보도, 아래 1칸 젖은 자갈, 경계 회색 연석 2px + 아래 그늘.',
     '보도 남쪽 가장자리 줄에 이 모양(보도 칸 아래 끝 연석)을 따른다. 3x3 그대로 이어 붙이면 가로 연석 줄이 된다.', 0, 'lower', 'terrain'),
    # ---- 땅 덩이 오토타일(16변형)
    ('autotile-oil-slick', AU.oil_sheet, 'autotile', '기름 번짐(걷기)', '젖은 자갈 위 반투명 남보라 기름 막 + 가장자리 무지개 띠(1px), 남·서 빛 테.',
     '붓으로 불규칙 덩이(2~6칸, 코·홈이 있게)로 칠한다. 사각형 채우기 금지. 놓을 땅: 차도·철판 마당·기름통 곁. 걷기, 사람 아래.', 0, 'lower', 'terrain'),
    ('autotile-steam-puddle', AU.puddle_sheet, 'autotile', '증기 고인 물(막힘)', '젖은 테 → 북쪽 패인 둑 그늘 → 김 서린 회청 물 + 물 위 흰 김 줄.',
     '붓으로 덩이(3~10칸)를 칠한다. 막힘(물). 놓을 땅: 증기 배출구·보일러 집 둘레·광장 낮은 곳. 길을 끊지 않게 가장자리에.', 0, 'lower', 'water'),
    ('autotile-coal-dust', AU.coal_sheet, 'autotile', '석탄 가루 덩이(걷기)', '성긴 알갱이 가장자리 + 속 가루 결 + 석탄 덩이(윗왼 빛).',
     '석탄 더미·깔때기·마차 둘레에 번지게(2~8칸 덩이). 걷기, 사람 아래.', 0, 'lower', 'terrain'),
    ('autotile-iron-railing', AU.railing_sheet, 'autotile', '검은 무쇠 난간(막힘)', '놋쇠 공 머리 기둥 + 창살(아래 가로대 고리 장식) + 석재 받침.',
     '선으로 칠한다(마당 둘레·광장 화단·물가). 모든 칸 막힘, 드나드는 곳은 비워 둔다.', 1, 'upper', 'fence'),
]
