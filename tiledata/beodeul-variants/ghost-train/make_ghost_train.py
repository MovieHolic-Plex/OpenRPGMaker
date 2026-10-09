# 버들항 웨이브 2 — 유령 열차(ghost-train). 다시 돌리면 같은 그림이 나온다.
#   python3 make_ghost_train.py  → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png
# 한 맵 64×40: 위 28줄 = 안개 낀 숲 속 간이역(야외, bd5.Scene — 버들항 칩셋 풀·참나무·흙길), 아래 12줄 = 열차 안 두 방(객차 안 · 기관실, KMap).
# 실내는 같은 열차의 안쪽이라 걸어서 이어지지 않는다 — 객차 문·운전실 계단 칸과 실내 문 깔개 칸을 LINKS 로 잇는다.
import os, sys, json, math, random
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from gt_base import *
from gt_base import _hash, vnoise
import gt_auto as AU, gt_train as TR, gt_station as SN, gt_inside as IN
import dlib
from collections import deque
assert OUT.endswith('ghost-train')

# ================================================================ 조각 등록 (새로 그린 것만)
PT = FB.Parts(OUT)
S = {}
def part(name, img, kind, ko, desc, rules, brows=None, **kw):
    S[name] = img
    PT.add(name, img, kind, ko, desc, rules, brows, **kw)
    return PT.imgs[name]
SKY = '맵 위에 서 있는 물체 — 지붕·윗부분 칸은 걷기 + 캐릭터를 가린다(위층).'
# --- 열차
part('loco_ghost', TR.locomotive(), 'object', '유령 증기 기관차',
     '동쪽을 향한 증기 기관차(11×6): 운전실 지붕 윗면 + 바랜 초록 앞벽(창 속 화실의 푸른 빛과 얼굴 없는 기관사 인영), 검은 보일러(놋쇠 띠·증기 돔·모래 돔·안전판·기적), '
     '연기 상자와 굴뚝(입에서 푸른 유령불), 앞 헤드램프(동쪽으로 푸른 흰빛 렌즈), 붉은 완충 들보와 완충기, 붉은 동륜 셋과 연결 막대, 화실 밑 재받이 틈의 푸른 빛.',
     '11×6칸. 맨 아랫줄(바퀴)을 동서 철로(autotile-rail) 줄에 맞춘다. 아래 3줄(앞벽·바퀴) 막힘, 위 3줄(지붕·보일러 윗부분·굴뚝)은 걷기+가림. '
     '앞(동쪽) 철로 위 3~8칸에 헤드램프 빛무리, 굴뚝 위에 ghost_smoke. 서쪽 끝에 tender_ghost 를 바로 붙인다. 운전실 계단(서쪽 1~2칸) 앞 플랫폼 칸이 기관실 문.', 3)
part('tender_ghost', TR.tender(), 'object', '탄수차', '석탄을 쌓은 윗면(덩이마다 빛)과 물 넣는 뚜껑, 바랜 초록 칠·놋쇠 테 앞면, 작은 바퀴 셋(5×6).',
     '5×6칸. 기관차 서쪽에 바로 붙이고 맨 아랫줄을 철로 줄에. 아래 3줄 막힘, 위 3줄 걷기+가림.', 3)
part('car_spirit', TR.carriage('a'), 'object', '객차(인영이 비치는 객차)',
     '가로로 놓인 목재 객차(10×6): 타르 칠한 지붕 윗면(늑재·통풍구), 버들항 나무 결 니스칠 세로 널 앞벽, 놋쇠 틀 창 일곱(얼굴 없는 희미한 인영 셋·푸른 빛 하나·커튼 하나), '
     '양 끝 문(작은 창·놋쇠 손잡이), 바랜 초록 아래 판과 금빛 테, 걸음판, 대차 둘.',
     '10×6칸. 맨 아랫줄(대차)을 철로 줄에. 아래 3줄(앞벽·대차) 막힘, 위 3줄(지붕) 걷기+가림. 객차 사이에 car_gangway 한 칸. 문(양 끝 1~2번째 칸) 앞 플랫폼 칸이 객차 안으로 가는 문.', 3)
part('car_ruined', TR.carriage('b'), 'object', '객차(무너진 객차)',
     '같은 객차의 오래 버려진 변형: 지붕에 뚫린 구멍(부러진 널)과 이끼 덩이, 깨진 창 셋(모서리에만 남은 유리 조각), 벽을 타는 덩굴(10×6).',
     '10×6칸. car_spirit 과 같은 발자국. 한 열차에 하나만(같은 객차를 일렬로 반복하지 않는다).', 3)
part('car_rear', TR.carriage('c'), 'object', '끝 객차(발코니)', '서쪽 끝에 놋쇠 난간 발코니와 붉은 꼬리등이 달린 마지막 객차(10×6), 창 일곱(인영 둘·푸른 빛 하나).',
     '10×6칸. 열차 맨 끝(서쪽). 발코니 칸(맨 서쪽 1칸 아래 3줄)도 막힘.', 3)
part('car_gangway', TR.gangway(), 'object', '객차 연결부', '두 객차 사이: 지붕 덮개 + 세로 주름 가죽 통로 + 맞닿은 완충기 둘과 늘어진 사슬 연결기·제동 호스(1×6).',
     '1×6칸. 객차와 객차(또는 객차와 탄수차) 사이 한 칸, 맨 아랫줄을 철로 줄에. 아래 3줄 막힘.', 3)
part('ghost_smoke', TR.ghost_smoke(), 'decal', '굴뚝 연기', '굴뚝에서 서쪽(뒤)으로 흘러가며 커지는 회청 연기 덩이 넷(반투명, 아래 푸른 빛) 4×3칸.',
     '4×3칸 위층 덧그림(걷기). 오른쪽 아래 끝을 굴뚝 입 바로 위에 맞춘다. 지붕·숲 위로 겹쳐도 된다.', 0)
# --- 플랫폼·역
part('bench_platform', SN.bench(), 'object', '플랫폼 벤치', '주철 다리·말린 팔걸이와 널 등받이(북쪽, 앞면) + 널 앉는 판 윗면(2×2).',
     '2×2칸, 아랫줄만 막힘. 플랫폼 위 등받이를 선로 쪽(북)으로, 가로등·시간표 사이에 띄엄띄엄(일렬 금지).', 1)
part('bench_broken', SN.bench(True), 'object', '부서진 벤치', '등받이 널 하나가 빠지고 앉는 판이 부러진 벤치(2×2).', '2×2칸, 아랫줄만 막힘. 벤치 둘 중 하나쯤.', 1)
part('timetable_board', SN.timetable(), 'object', '시간표 판(글자 없음)', '작은 지붕을 덧댄 흰 판 — 칸을 나눈 줄과 길이가 다른 빈 막대만 있고 글자는 없다, 빛바랜 얼룩, 나무 두 기둥(2×3).',
     '2×3칸, 아랫줄만 막힘(두 기둥). 플랫폼 가운데 계단 곁이나 역사 벽 앞.', 1)
part('gas_lamp_ghost', SN.gas_lamp(True), 'object', '가스등(푸른 유령불)', '주철 기둥(굽도리·고리·사다리 걸이) 위 사각 유리 등 속 푸른 흰 불꽃(1×3).',
     '1×3칸, 맨 아래 1칸만 막힘(위 2칸 걷기+가림). 플랫폼 가장자리에 6~9칸 간격, 등 둘레에 푸른 빛무리.', 1)
part('gas_lamp_dead', SN.gas_lamp(False), 'object', '꺼진 가스등', '유리가 깨지고 조금 기운 꺼진 가스등(1×3).', '1×3칸, 맨 아래 1칸만 막힘. 켜진 등 사이 하나쯤.', 1)
part('station_clock', SN.station_clock(), 'object', '멈춘 역 시계', '주철 기둥 위 양면 둥근 시계 — 흰 판에 눈금 열둘과 멈춘 바늘 둘, 숫자 없음, 놋쇠 테(1×3).',
     '1×3칸, 맨 아래 1칸만 막힘. 플랫폼 가운데 하나.', 1)
part('luggage_pile', SN.luggage_pile(), 'object', '버려진 짐 더미', '나무 궤 + 가죽 가방 둘 + 둥근 모자 상자(2×2).', '2×2칸, 아랫줄 막힘. 벤치·객차 문 곁에 1~2무리.', 1)
part('luggage_trolley', SN.trolley(), 'object', '짐수레', '널 바닥 + 쇠 테 큰 바퀴 둘 + 손잡이, 위에 가방 둘(2×2).', '2×2칸, 아랫줄 막힘. 플랫폼 끝·역사 곁.', 1)
part('water_tower', SN.water_tower(), 'object', '급수탑', '쇠 다리 넷 위 둥근 나무 물통(쇠테 셋) + 원뿔 지붕 윗면 + 동쪽으로 뻗은 급수관 팔과 늘어진 가죽 호스, 사다리, 주춧돌(3×5).',
     '3×5칸, 맨 아랫줄 막힘(다리·주춧돌), 위 4줄 걷기+가림. 오른쪽(동) 1칸 바깥에 급수관이 걸리므로 그 칸에 철로를 둔다.', 1)
part('signal_semaphore', SN.semaphore(), 'object', '완목 신호기', '격자 쇠 기둥 + 사다리, 꼭대기 동쪽으로 뻗은 붉은 완목(흰 띠)과 안경판 속 푸른 유령빛, 돌 받침(2×5).',
     '2×5칸, 맨 아래 왼쪽 1칸(받침)만 막힘. 철로 바로 북쪽 곁, 열차 앞(동)쪽.', 1)
part('crossing_sign', SN.crossing_sign(), 'object', '건널목 표지', '흰 바탕·붉은 테 X자 판(글자 없음) + 둥근 경고등 둘(하나는 푸른 유령빛) + 종, 줄무늬 기둥(1×3).',
     '1×3칸, 맨 아래 1칸만 막힘. 건널목 길 양옆, 철로 북쪽과 남쪽에 하나씩 엇갈려.', 1)
part('crossing_gate', SN.crossing_gate(), 'object', '건널목 차단기', '받침 기둥·평형추 + 붉은·흰 줄무늬 차단 막대(내려옴)와 끝 등(3×2). 좌우 뒤집어 반대쪽에 쓴다.',
     '3×2칸, 기둥 칸만 막힘. 막대는 길 위를 가로지르는 위층(지나갈 수 있다 — 막으려면 이벤트로).', 1)
part('crossing_planks', SN.crossing_planks(), 'decal', '건널목 깔판', '철로 칸 위 덧그림: 레일 사이와 바깥에 레일 방향으로 깐 널, 레일 머리는 보인다(1×1).',
     '1칸 덧그림(걷기). 길이 철로를 가로지르는 칸마다(가로 철로용).', 0)
part('buffer_stop', SN.buffer_stop(), 'object', '선로 끝 막이', '휘어 올린 레일 받침 + 붉은 각목 들보(흰 띠) + 완충기 둘(1×2). 서쪽을 향한다 — 동쪽을 향할 때는 좌우 뒤집기.',
     '1×2칸, 아랫줄 막힘. 철로 끝 칸(autotile-rail 1·2·4·8번) 위.', 1)
part('handcar', SN.handcar(), 'object', '수동 궤도차', '작은 바퀴 넷 위 널 바닥 + 가운데 A자 틀과 시소 손잡이(2×2).', '2×2칸, 아랫줄 막힘. 곁선 철로 위.', 1)
part('telegraph_pole', SN.telegraph_pole(), 'object', '전신주', '결 있는 나무 기둥 + 가로 팔 둘 + 유리 애자(1×5).', '1×5칸, 맨 아래 1칸만 막힘. 철로를 따라 10~14칸 간격, 숲 가장자리.', 1)
part('telegraph_wire', SN.telegraph_wire(), 'decal', '전신선', '애자 사이에 처진 두 가닥 줄(4×1, 위층 덧그림).', '4×1칸 위층. 전신주 가로 팔 높이에 이어 붙인다(전신주 사이 거리에 맞춰 늘이거나 여러 장).', 0)
part('point_lever', SN.point_lever(), 'object', '선로 전환기', '쇠 받침 위 무게추 손잡이 + 꼭대기 사각 등(푸른 렌즈)(1×2).', '1×2칸, 아랫줄 막힘. 갈래·교차 철로 곁 1칸.', 1)
part('lever_frame', SN.lever_frame(), 'object', '신호 손잡이 틀', '널 받침 위 쇠 틀에 꽂힌 긴 손잡이 다섯(붉은·검은 칠, 둘은 당겨 기움)(2×2).', '2×2칸, 아랫줄 막힘. 신호기·전환기 가까이 철로 곁.', 1)
part('ghost_wisp_a', SN.wisp(0), 'decal', '도깨비불', '푸른 흰빛 알과 위로 흔들리는 꼬리(1×1, 덧그림).', '1칸 위층 덧그림(걷기). 숲 가장자리·플랫폼 끝·객차 창 곁에 2~5개 흩어서, 빛무리와 함께.', 0)
part('ghost_wisp_b', SN.wisp(1.7), 'decal', '도깨비불(꼬리 반대)', '꼬리가 반대로 휜 도깨비불(1×1).', '1칸 위층. ghost_wisp_a 와 섞는다.', 0)
part('lost_hat', SN.lost_hat(), 'decal', '떨어진 모자와 우산', '둥근 챙 모자 + 접힌 검은 우산(1×1, 바닥 장식).', '1칸 바닥 장식(걷기). 플랫폼·좌석 위·문 앞에 하나둘.', 0)
part('platform_face', SN.platform_face(), 'wall', '플랫폼 앞면', '앞 턱 아래 세로 널 막이 + 굵은 기둥, 밑동을 먹은 이끼·잡풀(3×1).',
     '플랫폼(autotile-platform) 남쪽 끝 줄 바로 아래 한 줄(막힘). 계단 자리만 platform_steps.', 1, role='wall')
part('platform_steps', SN.platform_steps(), 'walk', '플랫폼 계단', '남쪽으로 내려가는 널 디딤 셋과 양옆 기둥(2×1).', '2×1칸 걷기. platform_face 줄의 계단 자리에(앞 1칸 비움).', 0)
part('platform_ramp', SN.platform_ramp(), 'walk', '플랫폼 끝 경사로', '플랫폼 서쪽 끝에서 땅으로 내려가는 널 경사로(위 3칸 널 윗면 + 맨 아래 세모 앞면)(1×4). 동쪽 끝은 좌우 뒤집기.',
     '1×4칸 걷기(맨 아래 세모 칸도 걷기). 플랫폼 끝 열 바로 바깥에.', 0)
# --- 실내
part('seat_bay', IN.seat_bay(True), 'object', '마주 보는 좌석(창 쪽)', '서·동 높은 등받이(나무 윗면 + 벨벳 남쪽 면) 사이 붉은 벨벳 방석 둘과 발 디딜 틈, 북쪽 창 아래 작은 접이 탁자·촛대(3×2).',
     '3×2칸. 양 끝 열(방석·등받이) 2줄 막힘, 가운데 열(발 디딜 틈)은 걷기. 객차 안 북쪽 벽에 붙여 동서로 이어 놓는다(좌석 줄은 일렬이 맞다).', 2)
part('seat_bay_aisle', IN.seat_bay(False), 'object', '마주 보는 좌석(통로 남쪽)', '탁자 없는 같은 좌석 칸(3×2) — 통로 남쪽 줄.', '3×2칸. seat_bay 와 같은 발자국, 통로 남쪽 줄에.', 2)
part('ghost_passenger', IN.ghost_passenger(), 'decal', '유령 승객', '얼굴 없는 반투명 청회 인영(앉은 모습)(1×2, 위층).', '1×2칸 위층 덧그림. 좌석 방석 칸 위에 몇 명만(빈자리가 더 많게).', 0)
part('car_window_in', IN.car_window(), 'decal', '객차 창(안쪽)', '놋쇠 틀 속 안개 낀 바깥(희미한 나무 그림자·도깨비불), 창턱, 묶은 커튼(1×3, 벽 앞면 장식).',
     '1×3칸 벽 앞면 장식(앞면 3줄). 좌석 칸마다 발 디딜 틈 위 벽에.', 0)
part('luggage_rack', IN.luggage_rack(), 'decal', '짐 선반', '놋쇠 받침의 그물 선반 위 가방·모자 상자·우산(3×1, 벽 앞면 장식).', '3×1칸 벽 앞면 맨 윗줄(크림 띠). 좌석 칸 위마다(몇 칸은 비운다).', 0)
part('car_door_in', IN.car_door(), 'decal', '객차 끝 문', '니스칠 문짝 + 서리 유리 창(희미한 푸른 빛) + 놋쇠 손잡이(1×3, 벽 앞면 장식).', '1×3칸 벽 앞면 장식. 객차 안 동·서 끝(다음 칸으로 가는 문 — 이벤트).', 0)
part('swing_lamp_l', IN.swing_lamp(-1), 'object', '흔들리는 램프(서쪽으로)', '천장에서 늘어진 사슬 끝 놋쇠 갓 기름 램프 — 유리 등피 속 푸른 불꽃, 서쪽으로 흔들린 모습(1×2).',
     '1×2칸 위층(걷기+가림). 통로 줄 위에 4~6칸 간격, 흔들린 방향을 번갈아.', 0)
part('swing_lamp_r', IN.swing_lamp(1), 'object', '흔들리는 램프(동쪽으로)', '같은 램프가 동쪽으로 흔들린 모습(1×2).', '1×2칸 위층. swing_lamp_l 과 번갈아.', 0)
part('backhead', IN.backhead(), 'decal', '보일러 뒤판(기관실)', '둥근 강철 뒤판 — 가운데 열린 화실 문 속 푸른 유령불, 압력계 둘(눈금만), 수면계 유리관, 가감 밸브 손잡이, 놋쇠 관, 양 위 둥근 안경 창(4×3).',
     '4×3칸 벽 앞면 장식(기관실 북쪽 벽 앞면 3줄 가운데). 화실 문 앞 1칸 비움, 바닥에 푸른 빛무리.', 0)
part('cab_coal', IN.cab_coal(), 'object', '기관실 석탄 더미', '탄수차 쪽에서 쏟아진 석탄과 꽂아 둔 삽(2×2).', '2×2칸, 아랫줄 막힘. 기관실 서쪽 끝(탄수차 쪽) 벽가.', 1)
part('driver_seat', IN.driver_seat(), 'object', '기관사 접이 의자', '쇠 받침 위 둥근 나무 앉는 판(1×1).', '1칸 막힘. 기관실 동쪽 창가.', 1)
part('brake_stand', IN.brake_stand(), 'object', '제동 손잡이', '쇠 기둥 위 놋쇠 손바퀴(1×2).', '1×2칸, 아랫줄만 막힘. 기관사 자리 곁.', 1)
part('reverser_lever', IN.reverser(), 'object', '역전기 손잡이', '톱니 반원 틀 위로 비스듬히 선 긴 손잡이(1×2).', '1×2칸, 아랫줄만 막힘. 보일러 뒤판 오른쪽 곁.', 1)
# --- 바닥·벽 표본·오토타일
part('ground-ballast', AU.ground_ballast(), 'floor', '자갈 도상 바닥', '따뜻한 회색 자갈 알갱이(왼쪽 위 밝고 틈 어둡다), 기름 먹은 자리·드문 잡풀·녹 조각 3×3 표본.', '철로 둘레·역 마당 바닥. 풀과 만나는 가장자리는 들쭉날쭉하게 덩이로.', 0, layer='lower')
part('ground-platform', AU.ground_platform(), 'floor', '플랫폼 널', '버들항 칩셋 세로 널 결을 비바람에 바랜 회갈색으로, 젖은 이끼 얼룩 3×3 표본.', '플랫폼 윗면 안쪽. 가장자리는 autotile-platform.', 0, layer='lower')
part('ground-carriage', AU.ground_carriage(), 'floor', '객차 바닥', '열차 길이 방향 니스칠 4px 널 + 가운데 바랜 붉은 통로 깔개(놋쇠 가장자리 실) 3×3 표본.', '객차 안 바닥. 깔개 줄을 통로 줄에 맞춘다.', 0, layer='lower')
part('face_carriage_3h', IN.face_sample('gt_car'), 'wall', '객차 안 벽 앞면(3줄)', '처마 몰딩·크림 칠 띠(짐 선반 자리)·니스칠 판벽(창 자리)·놋쇠 허리 띠·세로 널 굽도리 3칸 폭 표본.', '객차 안 천장 밑 3줄. 창·짐 선반·문은 덧그림.', 0, role='wall')
part('face_cab_3h', IN.face_sample('gt_cab'), 'wall', '기관실 벽 앞면(3줄)', '리벳 박은 강철판(32×16 엇갈림, 줄눈 녹 번짐) + 놋쇠 띠 + 바랜 초록 칠 아래 판 3칸 폭 표본(미래 폐허 기계 재질 규약).', '기관실 천장 밑 3줄. 가운데에 backhead.', 0, role='wall')
RS = AU.rail_sheet(); FS = AU.fog_sheet(); PS = AU.plat_sheet()
part('autotile-rail', RS, 'autotile', '철로', '자갈 도상 + 침목(8px 마다, 버들항 나무 결) + 레일(강철 머리·녹 옆면·그림자) 16변형: 곧은 길·곡선(4분원)·갈래·교차·끝·토막.',
     '걷는 땅 위에 깐다(걷기). 열차·궤도차는 철로 줄에 바퀴를 맞춘다. 끝 칸에는 buffer_stop, 건널목 칸에는 crossing_planks.', 0, layer='lower', role='terrain')
part('autotile-fog', FS, 'autotile', '안개 번짐', '반투명 청회 안개(위로 밝은 결·옅게 흐르는 띠) 16변형 — 이웃이 없는 쪽은 디더로 사라진다.',
     '위층 덧그림(걷기, 가림). 숲 가장자리·철로가 숲으로 사라지는 곳·플랫폼 끝에 덩이로(길 한가운데는 비운다).', 0, layer='upper', role='terrain')
part('autotile-platform', PS, 'autotile', '플랫폼 바닥', '바랜 널 바닥 16변형: 북쪽(선로 쪽) 밝은 끝 각목 + 바랜 안전선, 남쪽 앞 턱 각목, 동·서 끝 각목, 바깥 모서리 쇠 덮개.',
     '플랫폼 윗면(걷기). 남쪽 끝 줄 아래에 platform_face, 끝 열 바깥에 platform_ramp.', 0, layer='lower', role='terrain')

# ================================================================ 야외 (64×28)
W, H = 64, 40
HO = 28                                                                       # 야외 줄 수
s = B5.Scene('ghost-train', W, HO, seed=81)
rng = random.Random(8101)
TRACK_Y = 15
# --- 철로 칸
RAIL = set((x, TRACK_Y) for x in range(W))
BRX = 58                                                                      # 숲에서 내려와 본선을 가로지르는 옛 지선
RAIL |= {(BRX, y) for y in range(0, 21)}
RAIL |= {(x, 21) for x in range(49, BRX + 1)}                                 # 곁선(남쪽으로 꺾여 서쪽 끝 막이)
# --- 길(흙길): 서쪽 건널목 길(북쪽 끝 ↔ 남쪽 끝), 남쪽 오솔길(역사 앞), 가운데 계단으로 오르는 길
ROAD = set()
for y in range(0, HO):
    if y != TRACK_Y: ROAD |= {(2, y), (3, y)}
for x in range(4, 31): ROAD.add((x, 26))
for y in range(20, HO): ROAD |= {(29, y), (30, y)}
for (x, y) in ROAD: s.track[y][x] = True
# --- 플랫폼
PX0, PX1, PY0, PY1 = 14, 46, 16, 18                                           # 윗면 칸(포함)
PLAT = {(x, y) for x in range(PX0, PX1 + 1) for y in range(PY0, PY1 + 1)}
FACE_Y = PY1 + 1
STEPS = [(29, FACE_Y)]                                                        # 계단 2칸(29·30)
# --- 역 마당 자갈(철로 둘레, 들쭉날쭉한 덩이)
YARD = set()
for y in range(8, 23):
    for x in range(W):
        e = vnoise(x * 1.0, y * 1.0, 3, 811)
        if 9 <= y <= 14 and e > .18: YARD.add((x, y))                          # 열차 뒤(북쪽) 자갈 길
        if y in (15,): YARD.add((x, y))
        if 16 <= y <= 22 and x >= 47 and e > .25 - (0 if x > 50 else .1): YARD.add((x, y))
        if 16 <= y <= 17 and x <= 13 and e > .35: YARD.add((x, y))
for (x, y) in list(YARD):
    if (x, y) in ROAD: YARD.discard((x, y))
s.reserve(0, 9, W - 1, 15)                                                    # 철로·열차·뒤 자갈 길: 나무 금지
s.reserve(PX0 - 1, PY0, PX1 + 1, FACE_Y)

def put_obj(name, cx, cy, block='bottom', img=None, **k):
    im = img if img is not None else S[name]
    s.at(im, cx, cy, block=block, **k)
    s.reserve(cx, cy - (-(-im.height // 16)) + 1, cx + (-(-im.width // 16)) - 1, cy)
BLK = lambda w, h: [(i, -j) for i in range(w) for j in range(h)]

# --- 열차 (서쪽 끝 객차 x6 → 기관차 x44..54)
TX = 6
train = [('car_rear', 10), ('car_gangway', 1), ('car_ruined', 10), ('car_gangway', 1), ('car_spirit', 10), ('car_gangway', 1), ('tender_ghost', 5), ('loco_ghost', 11)]
CAR_AT = {}
x = TX
for nm, w in train:
    put_obj(nm, x, TRACK_Y, block=BLK(w, 3))
    CAR_AT.setdefault(nm, x); x += w
LOCO_X = CAR_AT['loco_ghost']
# --- 플랫폼 위 소품(선로 쪽 줄은 비우고, 덩이로)
put_obj('gas_lamp_ghost', 16, 17, block=[(0, 0)])
put_obj('bench_platform', 18, 18)
put_obj('luggage_pile', 21, 18)
put_obj('gas_lamp_dead', 24, 17, block=[(0, 0)])
put_obj('timetable_board', 26, 18, block=[(0, 0), (1, 0)])
put_obj('station_clock', 32, 17, block=[(0, 0)])
put_obj('gas_lamp_ghost', 34, 17, block=[(0, 0)])
put_obj('bench_broken', 36, 18)
put_obj('luggage_trolley', 40, 18)
put_obj('gas_lamp_ghost', 43, 17, block=[(0, 0)])
put_obj('luggage_pile', 44, 18)
# --- 플랫폼 앞면·계단·경사로 (그림은 overlay 로 깔고 막힘만 여기서)
for x in range(PX0, PX1 + 1):
    if not any(sx <= x <= sx + 1 for sx, _ in STEPS): s.block[FACE_Y][x] = True
# --- 역사(버들항 통나무 집 키트) + 등 오두막
s.kit('bd-out-house-plank', 17, 20)
s.reserve(16, 20, 25, 25)
s.kit('bd-out-cabin-small', 36, 21)
s.reserve(35, 21, 40, 24)
# --- 서쪽 건널목
put_obj('crossing_gate', 4, 17, img=flip(S['crossing_gate']), block=[(2, 0)])
put_obj('crossing_gate', 0, 13, block=[(0, 0)])
put_obj('crossing_sign', 4, 13, block=[(0, 0)])
put_obj('crossing_sign', 1, 18, block=[(0, 0)])
# --- 북쪽 자갈 길: 전신주(숲 가장자리)·손잡이 틀·신호기
for px_ in (9, 21, 33, 45):
    put_obj('telegraph_pole', px_, 9, block=[(0, 0)])
put_obj('signal_semaphore', 56, 14, block=[(0, 0)])
put_obj('lever_frame', 52, 9)
put_obj('point_lever', 59, 14)
# --- 동쪽 마당: 급수탑·곁선·끝 막이·궤도차·석탄·드럼통
put_obj('water_tower', 55, 20, block=[(0, 0), (2, 0)])
put_obj('buffer_stop', 48, 21, img=flip(S['buffer_stop']))
put_obj('handcar', 51, 21)
FR = os.path.join(VAR, 'future-ruins', 'parts'); AS = os.path.join(VAR, 'airship', 'parts')
def ext(path): return Image.open(path).convert('RGBA')
COAL_PILE = ext(os.path.join(AS, 'coal_pile.png')); DRUM = ext(os.path.join(FR, 'drum_single.png'))
put_obj('coal', 60, 19, img=COAL_PILE)
put_obj('drum', 62, 19, img=DRUM); put_obj('drum', 61, 23, img=DRUM)
put_obj('luggage_trolley', 49, 18)
# --- 숲: 북쪽 띠(y 0~8) · 남쪽(역사·오두막 둘레) — 버들항 참나무·덤불 + 깊은 숲 전나무
FIR = {n: P5.ALL[n]() for n in ('fir_m', 'fir_m2', 'fir_l', 'fir_s')}
FIRW = {'fir_m': 2, 'fir_m2': 2, 'fir_l': 3, 'fir_s': 2}
def free_col(x, y, w, h):
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y - j
            if not (0 <= xx < W and 0 <= yy < HO): return False
            if (xx, yy) in ROAD or (xx, yy) in RAIL: return False
    return True
def fir(sx, x, y):
    n = rng.choice(list(FIR)); w = FIRW[n]
    if not free_col(x, y, w, 3): return False
    ok = s.put(FIR[n], x, y, fw=w)
    if ok: s.canopies.append((x * 16, (y + 1) * 16 - FIR[n].height, FIR[n].width, FIR[n].height))
    return ok
def oak(kind, w, h):
    def f(sx, x, y):
        if not free_col(x, y, w, h): return False
        return s.put_tree(kind, x, y)
    return f
OA, OB, BC, BD = oak('oakA', 4, 5), oak('oakB', 3, 4), oak('bushC', 2, 2), oak('bushD', 3, 3)
def forest(cells, makers, tries=2):
    order = sorted(cells); rng.shuffle(order)
    for (x, y) in order:
        if not s.cell_free(x, y): continue
        for _ in range(tries):
            if rng.choice(makers)(s, x, y): break
NORTH = [(x, y) for y in range(1, 9) for x in range(W)]
SOUTH = [(x, y) for y in range(20, HO) for x in range(W) if not (y >= 26 and 4 <= x <= 30)]
forest(NORTH, [fir, fir, fir, OA, OB, BC, fir])
forest(SOUTH, [fir, OA, OB, BC, BD, fir])
# 낮은 덮개: 고사리·버섯·통나무(그늘 숲)
FERN = [P5.ALL['fern_' + k]() for k in 'abc']; TOAD = [P5.ALL['toadstools_' + k]() for k in 'abc']
LOG, STUMP = P5.ALL['log_fallen'](), P5.ALL['stump']()
order2 = [(x, y) for y in range(HO) for x in range(W)]; rng.shuffle(order2)
for (x, y) in order2:
    if (x, y) in ROAD or (x, y) in RAIL or (x, y) in YARD or (x, y) in PLAT or not s.cell_free(x, y): continue
    r = rng.random()
    if r < .30: s.put(FERN[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4))
    elif r < .38: s.put(TOAD[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4))
    elif r < .41: s.put(STUMP, x, y, block=True)
    elif r < .43 and x + 1 < W and s.cell_free(x + 1, y): s.put(LOG, x, y, fw=2, block=True)

# ================================================================ 실내 (64×12, 맵의 y 28..39)
class IMap(AK.KMap):
    pass
im_ = IMap(W, H - HO, 'ghost-train-in')
im_.ceil_fn = AK.wood_ceiling
AK.mk_floor('gt_carfloor', lambda X, Y: AU.carriage_floor_px(X, Y, aisle=(16, 32)))
STEEL_FLOOR = ext(os.path.join(FR, 'ground-steelplate.png'))
dlib.FLOORS['gt_cabfloor'] = lambda cx, cy: STEEL_FLOOR.crop((cx % 3 * 16, cy % 3 * 16, cx % 3 * 16 + 16, cy % 3 * 16 + 16))
CX0, CX1 = 3, 34                                                              # 객차 안 바닥 x
im_.floor(CX0, 4, CX1 - CX0 + 1, 5, 'gt_carfloor', 3, 'gt_car')
im_.floor(31, 9, 2, 1, 'gt_carfloor', 3, 'gt_car')                            # 남쪽 출입구(문 깔개)
KX0, KX1 = 40, 51
im_.floor(KX0, 4, KX1 - KX0 + 1, 4, 'gt_cabfloor', 3, 'gt_cab')
im_.floor(46, 8, 1, 1, 'gt_cabfloor', 3, 'gt_cab')                            # 기관실 계단 자리
BAD = []
def IP(name, x, y, block=None, img=None):
    img = img if img is not None else S[name]
    if block is None:
        br = PT.meta.get(name, {}).get('brows', 0) or 0
        block = [] if br == 0 else [(i, -j) for i in range(img.width // 16) for j in range(br)]
    for (bx, by) in block:
        c = (x + bx, y + by)
        if not (im_.inb(*c) and im_.fl[c[1]][c[0]] is not None and c not in im_.blocked): BAD.append((name, c))
    im_.props_add(x, y, img, block, 1)
def IDEC(name, x, y, img=None):
    im_.decal(x, y, img if img is not None else S[name])
# 좌석 칸: 북쪽 줄(창 쪽) x4..27, 남쪽 줄(통로 남쪽) — 한두 칸은 짐·빈자리로 바꿔 일렬을 깬다
SB = [(i, -j) for i in (0, 2) for j in (0, 1)]
NB = [4, 7, 10, 13, 16, 19, 22, 25]
for k, bx in enumerate(NB):
    IP('seat_bay', bx, 5, block=SB)
    IDEC('car_window_in', bx + 1, 1)
    if k not in (2, 5): IDEC('luggage_rack', bx, 1)
for k, bx in enumerate(NB):
    if k == 6:
        IP('luggage_pile', bx, 8); continue
    IP('seat_bay_aisle', bx, 8, block=SB)
for (gx, gy) in ((4, 4), (14, 4), (17, 7), (23, 7), (26, 4)):                   # 유령 승객 몇 명(빈자리가 더 많게)
    IDEC('ghost_passenger', gx + (0 if gx % 2 else 0), gy - 1)
IDEC('lost_hat', 11, 7); IDEC('lost_hat', 20, 4)
for k, lx in enumerate((6, 12, 18, 24, 30)):                                  # 통로 위 흔들리는 램프
    IP('swing_lamp_l' if k % 2 == 0 else 'swing_lamp_r', lx, 6, block=[])
IDEC('car_door_in', 34, 1); IDEC('car_door_in', 3, 1)
IP('luggage_trolley', 29, 5); IP('luggage_pile', 33, 8)
IDEC('car_window_in', 31, 1); IDEC('luggage_rack', 28, 1)
# 기관실: 뒤판(화실 문), 석탄 더미(서쪽 = 탄수차 쪽), 기관사 자리(동쪽)
IDEC('backhead', 44, 1)
IP('cab_coal', 40, 7); IP('cab_coal', 40, 5, block=[(0, 0)])
IP('reverser_lever', 48, 5); IP('brake_stand', 50, 5); IP('driver_seat', 51, 6)
IDEC('ghost_passenger', 49, 5)
IP('drum', 51, 4, img=DRUM)
if BAD: print('실내 배치 오류', BAD)
INR = im_.render()

# ================================================================ 야외 렌더 + 덧그림 + 합성
def rail_mask(cells, x, y):
    def on(xx, yy): return (xx, yy) in cells or not (0 <= xx < W and 0 <= yy < HO)
    m = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
    if (x, y) == (49, 21): m &= ~8                                            # 곁선 서쪽 끝(막이)
    if y == 0 and x == BRX: m |= 1
    return m
def amask(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)
# 자갈 덩이(가장자리 들쭉날쭉): 칸 마스크를 화소로 늘리고 가장자리를 잡음으로 깎는다
GB = AU.ground_ballast()
yard_im = new(W * 16, HO * 16); yp = yard_im.load(); gb = GB.load()
for (cx, cy) in YARD | RAIL:
    if cy >= HO: continue
    for yy in range(16):
        for xx in range(16):
            X, Y = cx * 16 + xx, cy * 16 + yy
            nb = lambda dx, dy: ((cx + dx, cy + dy) in YARD or (cx + dx, cy + dy) in RAIL)
            d = 99
            if not nb(-1, 0): d = min(d, xx)
            if not nb(1, 0): d = min(d, 15 - xx)
            if not nb(0, -1): d = min(d, yy)
            if not nb(0, 1): d = min(d, 15 - yy)
            if d < 99 and d < 2 + 3 * vnoise(X, Y, 3, 812): continue
            yp[X, Y] = gb[X % 48, Y % 48]
s.overlays.append((yard_im, 0, 0))
rail_im = new(W * 16, HO * 16)
for (x, y) in RAIL:
    rail_im.alpha_composite(FB.cell_of(RS, rail_mask(RAIL, x, y)), (x * 16, y * 16))
for x in (2, 3): rail_im.alpha_composite(S['crossing_planks'], (x * 16, TRACK_Y * 16))
s.overlays.append((rail_im, 0, 0))
plat_im = new(W * 16, HO * 16)
for (x, y) in PLAT: plat_im.alpha_composite(FB.cell_of(PS, amask(PLAT, x, y)), (x * 16, y * 16))
for x in range(PX0, PX1 + 1, 3):
    plat_im.alpha_composite(S['platform_face'].crop((0, 0, min(48, (PX1 + 1 - x) * 16), 16)), (x * 16, FACE_Y * 16))
for sx, sy in STEPS: plat_im.alpha_composite(S['platform_steps'], (sx * 16, sy * 16))
plat_im.alpha_composite(S['platform_ramp'], ((PX0 - 1) * 16, PY0 * 16))
plat_im.alpha_composite(flip(S['platform_ramp']), ((PX1 + 1) * 16, PY0 * 16))
s.overlays.append((plat_im, 0, 0))
OUTR = s.render()
OUTR = ghost_grade(OUTR, .85)
# 덧그림(색 고르기 뒤): 안개 → 연기 → 빛무리 → 도깨비불 → 전신선
FOGC = set()
fz = B5.value_noise(8121, W, HO, 6)
for y in range(HO):
    for x in range(W):
        if (x, y) in PLAT or (x, y) in ROAD and 10 < y < 24: continue
        band = (y <= 9 and fz[y][x] > .42) or (y >= 22 and fz[y][x] > .5) or ((x <= 1 or x >= 62) and 9 <= y <= 21) or (19 <= y <= 21 and fz[y][x] > .62)
        if band: FOGC.add((x, y))
for (x, y) in FOGC: OUTR.alpha_composite(FB.cell_of(FS, amask(FOGC, x, y)), (x * 16, y * 16))
OUTR.alpha_composite(S['ghost_smoke'], ((LOCO_X + 10) * 16 - 64 + 6, (TRACK_Y - 5) * 16 - 48 + 2))
def gl(px_, py_, size, col, a, squash=1.0):
    g = glow(size, col, a, squash); OUTR.alpha_composite(g, (int(px_ - g.width / 2), int(py_ - g.height / 2)))
GC = (150, 205, 255)
gl((LOCO_X + 11) * 16 + 4, (TRACK_Y - 4) * 16 + 2, 44, GC, 120)               # 헤드램프
for i in range(6):                                                             # 헤드램프 빛줄기(철로 위로 뻗는다)
    gl((LOCO_X + 12) * 16 + i * 14, TRACK_Y * 16 + 6, 34 + i * 6, GC, 70 - i * 9, .45)
gl((LOCO_X + 9) * 16 + 14, (TRACK_Y - 5) * 16 + 6, 34, GC, 90)               # 굴뚝 불
gl((LOCO_X + 2) * 16 + 10, (TRACK_Y) * 16 + 2, 36, GC, 80, .6)               # 화실 밑
for lx in (16, 34, 43):
    gl(lx * 16 + 8, (PY0 - 1) * 16 + 10, 56, GC, 70); gl(lx * 16 + 8, (PY0 + 1) * 16 + 8, 60, GC, 40, .5)
for (wx, wy) in ((22, 12), (12, 24), (47, 7), (8, 6), (41, 25), (61, 9)):
    OUTR.alpha_composite(S['ghost_wisp_a' if (wx + wy) % 2 else 'ghost_wisp_b'], (wx * 16, wy * 16))
    gl(wx * 16 + 8, wy * 16 + 10, 40, GC, 60)
for car in ('car_spirit', 'car_rear'):                                         # 창 속 푸른 빛
    cx0 = CAR_AT[car]
    for wx in TR.WIN_X:
        gl(cx0 * 16 + wx + 5, (TRACK_Y - 5) * 16 + 32 + TR.OY + 7, 18, GC, 28)
WIRE = S['telegraph_wire']
for a, b in ((9, 21), (21, 33), (33, 45)):
    seg = WIRE.resize(((b - a) * 16, 16), Image.NEAREST)
    OUTR.alpha_composite(seg, (a * 16 + 8, (9 - 4) * 16 + 10 - 8))
# 실내 빛무리
IG = INR.copy()
def igl(px_, py_, size, col, a, squash=1.0):
    g = glow(size, col, a, squash); IG.alpha_composite(g, (int(px_ - g.width / 2), int(py_ - g.height / 2)))
for k, lx in enumerate((6, 12, 18, 24, 30)): igl(lx * 16 + 8, 6 * 16 + 4, 64, GC, 60); igl(lx * 16 + 8, 6 * 16 + 12, 70, GC, 30, .45)
igl(46 * 16, 3 * 16 + 4, 70, GC, 110); igl(46 * 16, 5 * 16, 80, GC, 55, .5)
FULL = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
FULL.alpha_composite(OUTR, (0, 0)); FULL.alpha_composite(IG, (0, HO * 16))

# ================================================================ 통행 격자 + BFS (층 이동 LINKS)
wg = s.walk_grid()
WALK = [[False] * W for _ in range(H)]
for y in range(HO):
    for x in range(W): WALK[y][x] = bool(wg[y][x])
for y in range(H - HO):
    for x in range(W): WALK[HO + y][x] = im_.is_walk(x, y)
CAR_A = CAR_AT['car_spirit']
LINKS = [((CAR_A + 9, PY0), (31, HO + 9)), ((CAR_A + 8, PY0), (32, HO + 9)),
         ((LOCO_X, PY0), (46, HO + 8)), ((LOCO_X + 1, PY0), (46, HO + 8))]
def bfs(start):
    adj = {}
    for a, b in LINKS: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = {start: 0}; q = deque([start])
    while q:
        c = q.popleft()
        for n in [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)] + adj.get(c, []):
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and WALK[n[1]][n[0]]:
                if (n[1] >= HO) != (c[1] >= HO) and n not in adj.get(c, []): continue
                seen[n] = seen[c] + 1; q.append(n)
    return seen
ENT = (30, HO - 1)
reach = bfs(ENT)
WP = {'남쪽 입구': ENT, '플랫폼 계단 위': (29, PY1), '플랫폼 서쪽 끝': (PX0, PY0 + 1), '플랫폼 동쪽 끝': (PX1, PY0 + 1),
      '객차 문 앞': (CAR_A + 9, PY0), '기관실 계단 앞': (LOCO_X, PY0), '역사 문 앞': (23, 26), '건널목 북쪽': (2, 12), '건널목 남쪽': (2, 18),
      '북쪽 숲길 끝': (2, 0), '열차 뒤 자갈 길': (30, 9), '신호기 곁': (57, 13), '급수탑 곁': (54, 20), '곁선 끝 막이 앞': (49, 22), '지선 북쪽(숲)': (BRX, 2),
      '객차 안 문 깔개': (31, HO + 9), '객차 안 통로 서쪽': (5, HO + 6), '객차 안 좌석 틈': (11, HO + 5), '기관실 화실 문 앞': (46, HO + 4), '기관사 자리 곁': (50, HO + 6)}
wp_res = {k: dict(at=list(v), reach=v in reach, steps=reach.get(v)) for k, v in WP.items()}
walk_total = sum(1 for y in range(H) for x in range(W) if WALK[y][x])
unreached = sorted((x, y) for y in range(H) for x in range(W) if WALK[y][x] and (x, y) not in reach)
print('walk', walk_total, 'reached', len(reach), 'unreached', len(unreached), unreached[:30])
print('wp fail', {k: v['at'] for k, v in wp_res.items() if not v['reach']} or 'all reached')

# 빈 바닥(20×15 창): 걷는 칸 중 물체·덧그림·길·철로·자갈·플랫폼에 덮이지 않은 칸
cov = s.coverage()
COVER = set()
for y in range(HO):
    for x in range(W):
        if cov[y][x] >= .25 or (x, y) in ROAD or (x, y) in RAIL or (x, y) in YARD or (x, y) in PLAT or (x, y) in FOGC: COVER.add((x, y))
for (x, y, img, w, h, layer) in im_.props:
    for dy in range(-(-img.height // 16)):
        for dx in range(-(-img.width // 16)): COVER.add((x + dx, HO + y - dy))
for (x, y, img) in im_.decals:
    for dy in range(max(1, -(-img.height // 16))):
        for dx in range(max(1, -(-img.width // 16))): COVER.add((int(x) + dx, HO + int(y) + dy))
def empt():
    vals = []
    for y0 in range(0, H - 15 + 1):
        for x0 in range(0, W - 20 + 1):
            e = sum(1 for y in range(y0, y0 + 15) for x in range(x0, x0 + 20) if WALK[y][x] and (x, y) not in COVER)
            vals.append((round(e / 300.0, 3), (x0, y0)))
    vals.sort(reverse=True)
    return dict(max=vals[0][0], at=vals[0][1], over40=sum(1 for v in vals if v[0] > .4), mean=round(sum(v[0] for v in vals) / len(vals), 3))
EMP = empt()
print('empty', EMP)

# ================================================================ 저장
FULL.convert('RGB').save(os.path.join(OUT, 'render-1x.png'))
FULL.resize((W * 32, H * 32), Image.NEAREST).convert('RGB').save(os.path.join(OUT, 'render-2x.png'))
grid = dict(name='ghost-train', width=W, height=H, tile=16, legend={'1': '걷는다', '0': '막힘(벽·열차·물체·천장)'},
            regions={'야외 간이역': [0, HO - 1], '실내(객차 안·기관실)': [HO, H - 1]},
            entrance=list(ENT), floor_links=[[list(a), list(b)] for a, b in LINKS], waypoints=wp_res,
            walkable_cells=walk_total, reached_cells=len(reach), unreached_cells=len(unreached), emptiness=EMP,
            grid=[''.join('1' if WALK[y][x] else '0' for x in range(W)) for y in range(H)])
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False, indent=1)
print('parts', PT.finish('유령 열차 (ghost-train)'))
