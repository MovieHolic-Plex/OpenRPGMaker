# 버들항 웨이브 — 기계 공장 + 지하 연구소(machine-factory). 다시 돌리면 같은 그림이 나온다.
#   python3 make_machine_factory.py  → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png
# 한 맵(97×40)에 두 층을 나란히: 공장 층(x0~55, 56×40) · 지하 연구소 층(x57~96, 40×32 — y4~35).
# 층 사이는 승강기 짝과 철 계단 짝으로 잇는다(LINKS): 공장 승강기 앞 ↔ 연구소 승강기 앞, 공장 내림 계단 ↔ 연구소 오름 계단.
# 기계 재질은 future-ruins 「기계 재질 규약」(fr_base 램프·fr_mat 톤 캔버스·판 줄눈·리벳·관·녹)을 그대로 쓴다(mf_kit 참조).
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from mf_kit import *
from mf_kit import _hash
import mf_auto as AU, mf_factory as MF, mf_lab as ML, mf_doors as MD
from gc_ext import autotile_mask, atile_img
import dcheck
assert OUT.endswith('machine-factory')

kit = Kit('machine-factory', '기계 공장 + 지하 연구소')
S = {}; SOFT = set()
def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img
FWALL = '벽 앞면 장식(앞면 3줄 필요) — 막힘 계산과 상관없다.'
BELT = '컨베이어(autotile-conveyor) 칸 위에 얹는 위층 물체 — 막힘은 컨베이어가 한다.'

# ---------------------------------------------------------------- 조각 (새로 그린 기계 조각만 — future-ruins 조각은 맵에서 쓰기만 한다)
# 앵커 ② 보일러실
obj('boiler_big', MF.boiler_big(), '대형 증기 보일러', '콘크리트 받침 위 강철 화실(호박빛 화구 창살 문)과 누운 큰 강철 드럼(이음 테 셋·볼트·리벳 줄), 증기 돔·안전밸브·뒤 벽으로 가는 증기관, 앞 압력계 셋과 수위 유리관, 오른쪽 붉은 급수 펌프 기둥(6×5).',
    '6×5칸, 아래 2줄 막힘(위 3줄 걷기+가림). 보일러실 북쪽 벽에 등을 대고(윗줄이 벽 앞면에 겹친다) 앞(남) 2칸 비움. 곁에 pressure_tank·steam_stack·벽 gauge_board.', 2)
obj('piston_engine', MF.piston_engine(), '쌍 피스톤 기관', '강철 크랭크실(둥근 점검 창 둘) 위 굵은 실린더 둘과 반들거리는 피스톤 막대·크로스헤드, 옆 놋쇠 플라이휠과 크랭크 축(4×4).',
    '4×4칸, 아래 2줄 막힘. 보일러 동쪽 1~2칸 띄워, 벽 앞. 둘레 통로 1칸.', 2)
obj('gear_works', MF.gear_works(), '대형 톱니 기계', '강철 받침틀 앞에 선 큰 쇠 톱니(바퀴살 다섯)와 맞물린 놋쇠 톱니·작은 쇠 톱니·사슬, 위 붉은 감속기 상자, 바퀴 밸브(4×4).',
    '4×4칸, 아래 2줄 막힘. 보일러실 벽 앞, 피스톤 기관 곁에 덩이로(일렬 금지 — 앞뒤로 1줄 어긋나게).', 2)
obj('pressure_tank', MF.pressure_tank(), '압력 탱크', '둥근 지붕 강철 원통(이음 테 둘·리벳 줄), 앞 압력계와 놋쇠 꼭지, 다리 셋, 안전밸브(2×3).', '2×3칸, 밑동 줄만 막힘(위 2줄 걷기+가림). 보일러 곁에 둘씩, 한 줄 어긋나게.', 1, soft=True)
obj('pressure_tank_red', MF.pressure_tank(seed=4, mat='paint'), '압력 탱크(붉은 도장)', '같은 압력 탱크를 바랜 붉은 도장으로 칠하고 녹이 번진 변형(2×3).', '2×3칸, 밑동 줄만 막힘. 강철 탱크와 섞어 한 덩이에 하나.', 1, soft=True)
obj('steam_stack', MF.steam_stack(), '증기관 기둥', '바닥 받침에서 벽 위로 오르는 굵은 세로 강철관(이음 테·볼트)과 붉은 바퀴 밸브, 이음에서 새는 김(1×3).', '1×3칸, 밑동만 막힘. 벽 앞면 바로 아래, 보일러·탱크 곁.', 1, soft=True)
obj('gauge_board', MF.gauge_board(), '압력계 판', '볼트 박은 강철판에 압력계 셋(숫자 없음)과 표시등 둘, 아래로 내려가는 가는 관(2×1).', '2×1칸. ' + FWALL + ' 보일러·기관 뒤 벽 가운데 줄.', 0, kind='decal')
obj('valve_manifold', MF.valve_manifold(), '밸브 묶음', '가로 굵은 관에서 내려온 가지 관 셋, 가지마다 붉은 바퀴 밸브(3×1).', '3×1칸. ' + FWALL + ' 앞면 아래 줄.', 0, kind='decal')
obj('breaker_box', MF.breaker_box(), '배전함', '회색 철 함(번개 세모 무늬, 글자 없음), 붉은 레버 손잡이, 위로 오르는 전선관(1×2).', '1×2칸. ' + FWALL + ' 앞면 아래 두 줄.', 0, kind='decal')
obj('cable_bundle', MF.cable_bundle(), '전선 다발', '천장에서 늘어진 고무 전선 다섯 가닥이 벽을 타고 내려와 강철 받침에 묶여 바닥 관으로 들어간다(1×3).', '1×3칸. ' + FWALL + ' 제어반·배전함 곁.', 0, kind='decal')
# 앵커 ① 컨베이어 라인
obj('hopper_feeder', MF.hopper_feeder(), '투입 호퍼', '넓은 강철 깔때기(속 부품 더미)·경고 띠 테두리·네 다리, 아래 배출구가 벨트 위로(2×3).', '2×3칸. 컨베이어 줄 서쪽 첫 두 칸 위(맨 아랫줄 = 컨베이어 줄). ' + BELT, 0)
obj('stamping_press', MF.stamping_press(), '찍기 프레스', '벨트를 사이에 둔 기둥 넷이 받친 강철 들보·유압 실린더·찍기 머리, 기둥 경고 띠, 붉은 등(3×3).', '3×3칸. 맨 아랫줄을 가로 컨베이어 줄 3칸에 맞춘다. ' + BELT + ' 둘레 바닥에 autotile-hazardline.', 0)
obj('assembly_arm', MF.assembly_arm(), '조립 로봇 팔', '볼트 박은 둥근 받침 위 노란 도장 회전대·아래팔·강철 팔꿈치·숙인 윗팔과 집게(얼굴·눈 없음, 2×3).', '2×3칸, 밑동 줄만 막힘. 가로 컨베이어 바로 북쪽(또는 남쪽) 줄에 집게가 벨트 쪽으로. 둘 이상이면 좌우 뒤집기 섞기, 둘레 경고선.', 1, soft=True)
obj('assembly_arm_l', MF.assembly_arm(seed=2, mirror=True), '조립 로봇 팔(왼쪽)', '같은 조립 팔을 좌우로 뒤집어 집게가 서쪽을 향한다(2×3).', '2×3칸, 밑동 줄만 막힘. assembly_arm 과 마주 보게.', 1, soft=True)
obj('scanner_arch', MF.scanner_arch(), '검사 문틀', '컨베이어 위 낮은 강철 문틀, 들보 아래 청록 빛 띠가 벨트로 떨어진다(2×2).', '2×2칸. 맨 아랫줄을 가로 컨베이어 2칸에. ' + BELT, 0)
obj('crate_belt', MF.crate_belt(), '벨트 위 상자', '벨트 윗면 높이에 앉은 작은 붉은 강철 상자(1×1).', '1칸. ' + BELT + ' 3~5칸 간격, 일정하지 않게.', 0)
obj('crate_belt_steel', MF.crate_belt(seed=3, mat='steel'), '벨트 위 상자(강철)', '같은 크기 회색 강철 상자(1×1).', '1칸. ' + BELT + ' 붉은 상자와 섞어.', 0)
obj('parts_tray', MF.parts_tray(), '벨트 위 부품 판', '낮은 강철 쟁반에 담긴 놋쇠 톱니 셋과 볼트(1×1).', '1칸. ' + BELT + ' 조립 팔 앞 칸에.', 0)
obj('crate_stack', MF.crate_stack(), '강철 상자 더미', '경고 띠 두른 강철 짐 상자 셋(위 하나 붉은 도장), 판 줄눈·리벳(2×2).', '2×2칸, 아랫줄 막힘. 라인 끝·벽가에 깔판·수레와 덩이로.', 1)
obj('parts_bin', MF.parts_bin(), '부품 통', '윗면 열린 강철 통에 담긴 놋쇠 톱니·볼트 더미, 앞 경고 띠(1×1).', '1칸 막힘. 조립 팔·작업 자리 곁 1~2개.', 1)
obj('pallet_load', MF.pallet_load(), '짐 깔판', '나무 깔판 위 띠로 묶은 강철 상자 둘(2×1).', '2×1칸 막힘. 라인 끝 출하 자리·승강기 앞 벽가.', 1)
obj('hand_cart', MF.hand_cart(), '손수레', '강철 판 바닥 수레(바퀴 둘)와 노란 손잡이, 실린 상자(1×1).', '1칸 막힘. 깔판·상자 곁.', 1)
obj('gear_scrap', MF.gear_scrap(), '흩어진 부품', '바닥에 떨어진 작은 놋쇠 톱니 둘·볼트·기름 자국(1×1).', '1칸 바닥 장식(걷기). 기계·라인 곁에 드물게.', 0, kind='decal')
# 앵커 ④ 제어실
obj('control_wall', ML.control_wall(), '제어반 벽', '볼트 박은 큰 강철판: 위 화면 셋(막대·파형·꺼짐, 글자 없음), 압력계 둘·단추 줄·레버 셋·표시등 띠, 아래 열린 점검 문 속 색 전선 다발(4×3).',
    '4×3칸. ' + FWALL + ' 제어실 북쪽 벽 가운데. 앞(남) 1칸 띄워 console_desk.', 0, kind='decal')
obj('monitor_bank', ML.monitor_bank(), '감시 화면 묶음', '강철 틀에 매단 작은 화면 넷(하나 꺼짐)과 늘어진 전선(2×2).', '2×2칸. ' + FWALL + ' 앞면 위 두 줄.', 0, kind='decal')
obj('console_desk', ML.console_desk(), '조작 책상', '비스듬한 조작판 윗면(화면 둘·단추 줄·레버), 강철 앞면(통풍구), 아래 경고 띠(3×2).', '3×2칸, 아랫줄 막힘(윗면 줄 걷기+가림). 제어반 앞 1칸 띄워, 앞(남)에 operator_chair.', 1)
obj('operator_chair', ML.operator_chair(), '조작자 의자', '검은 쿠션 바퀴 의자(등받이 북쪽)(1×1).', '1칸 막힘. 조작 책상 바로 남쪽.', 1)
obj('server_rack', ML.server_rack(), '서버 선반', '검은 강철 장 안 가로 칸 일곱과 칸마다 다른 표시등 줄, 위 전선 다발(2×3).', '2×3칸, 아랫줄만 막힘. 북쪽 벽에 등을 대고 2~3개 붙여(하나는 1칸 어긋나게).', 1, soft=True)
# 앵커 ③ 배양관
obj('culture_tube', ML.culture_tube(), '유리 배양관', '강철 받침(표시등 줄) 위 유리 원통 속 밝은 초록 배양액·거품, 가운데 흐린 그림자(형체 없음), 위 뚜껑에서 천장으로 오르는 관(2×3).',
    '2×3칸, 밑동 줄만 막힘(위 2줄 걷기+가림). 2~4개를 1칸 간격 덩이로, 줄마다 반 칸 어긋나게. 앞에 tube_pod, 사이에 cable_floor.', 1, soft=True)
obj('culture_tube_dim', ML.culture_tube_dim(), '배양관(옅은 그림자)', '액이 조금 줄고 그림자가 옅은 배양관(2×3).', '2×3칸, 밑동 줄만 막힘. culture_tube 와 섞어.', 1, soft=True)
obj('culture_tube_empty', ML.culture_tube_empty(), '빈 배양관', '바닥에 액만 조금 남은 빈 유리관(어두운 유리·빛줄)(2×3).', '2×3칸, 밑동 줄만 막힘. 줄 끝·구석에 하나.', 1, soft=True)
obj('culture_tube_broken', ML.culture_tube_broken(), '깨진 배양관', '앞 유리가 들쭉날쭉 깨져 속이 어둡고 액이 빠진 관, 받침 표시등 하나만 붉게(2×3).', '2×3칸, 밑동 줄만 막힘. 한 맵에 하나, 바로 앞(남)에 tube_spill.', 1, soft=True)
obj('tube_spill', ML.tube_spill(), '흘러나온 배양액', '초록 웅덩이(액면 빛)와 흩어진 유리 조각(2×2).', '2×2칸 바닥 장식(걷기). 깨진 배양관 바로 남쪽.', 0, kind='decal')
obj('tube_pod', ML.tube_pod(), '배양관 조작대', '세운 강철 받침 위 비스듬한 조작판(초록 파형 화면·단추 줄)(1×2).', '1×2칸, 아랫줄 막힘. 배양관 앞(남) 곁.', 1, soft=True)
obj('cable_floor', ML.cable_floor(), '바닥 전선 다발', '굵기 다른 고무 전선 넷이 바닥을 따라 구불구불(2×1, 가로로 이어 붙는다).', '2×1칸 바닥 장식(걷기). 배양관·분석 기계·조작대 사이를 잇는다.', 0, kind='decal')
obj('specimen_shelf', ML.specimen_shelf(), '표본 선반', '강철 선반 두 단의 초록 액 병·유리병·상자(2×2).', '2×2칸, 아랫줄 막힘. 연구실 벽가.', 1)
obj('lab_bench', ML.lab_bench(), '실험대', '흰 판 윗면 강철 실험대: 원심 분리기·시험관 꽂이·플라스크·기구, 앞 서랍 줄(3×2).', '3×2칸, 2줄 막힘. 연구실 가운데, 둘레 1칸 통로.', 2)
obj('cold_cabinet', ML.cold_cabinet(), '냉장 보관함', '키 큰 흰 판 함(문 둘·서리 낀 창), 냉각 창살·청록 등(2×3).', '2×3칸, 아랫줄만 막힘. 북쪽 벽에 등을 대고.', 1, soft=True)
obj('analysis_machine', ML.analysis_machine(), '분석 기계', '흰 판 몸체, 위 화면(막대 무늬), 가운데 둥근 유리 창 속 초록 빛 시료, 냉각 관·단추 줄·경고 띠 받침(3×3).', '3×3칸, 아래 2줄 막힘. 배양관 덩이 곁 벽 앞, 전선으로 잇는다.', 2)
# 앵커 ⑤ 입구
obj('elevator_closed', MD.elevator_closed(), '승강기 문(닫힘)', '경고 띠 두른 두꺼운 강철 틀, 미닫이 두 짝(작은 창), 위 갈매기 화살 표시등, 호출 단추 판(3×3).',
    '3×3칸. ' + FWALL + ' 바로 아래 가운데 바닥 칸 = 승강기 이동 칸(비워 둔다). 앞 1~2칸에 autotile-hazardline.', 0, kind='decal')
obj('elevator_open', MD.elevator_open(), '승강기 문(열림)', '같은 틀, 문짝이 기둥 속으로 밀리고 불 켜진 승강기 칸(흰 뒷벽·손잡이 봉·천장 등·철판 바닥)(3×3).', '3×3칸. ' + FWALL + ' 도착 층에. 아래 가운데 바닥 칸 = 이동 칸.', 0, kind='decal')
obj('blast_gate', MD.blast_gate(), '방폭 철문(열림)', '벽을 뚫은 2칸 통로 위 문틀: 경고 띠 기둥 둘, 끌어올린 두꺼운 철문 판과 들보, 붉은 경보등, 바닥 문 홈(4×4).',
    '4×4칸 위층. 벽(천장 띠 1줄 + 앞면 3줄)을 뚫은 2칸 통로에 가운데 두 열을 맞춘다: 양옆 열 = 벽, 가운데 아래 2줄 = 통로(걷기), 위 2줄 = 걷기+가림.', 0, kind='walk')
obj('steel_door', MD.steel_door(), '잠긴 방폭 철문', '둥근 모 두꺼운 철문 판(리벳·보강 띠), 붉은 바퀴 손잡이, 경고 띠 틀, 꺼진 등(2×3).', '2×3칸. ' + FWALL + ' 열리지 않는 문 — 장식 또는 잠긴 문 이벤트(문 아래 칸).', 0, kind='decal')
obj('alarm_on', MD.alarm_on(), '경보등(켜짐)', '벽 받침 위 철망 씌운 붉은 돔이 빛나고 양옆 빛살(1×1).', '1칸. ' + FWALL + ' 승강기·철문 곁 앞면 맨 위 줄. alarm_off 와 교대(두 프레임).', 0, kind='decal')
obj('alarm_off', MD.alarm_off(), '경보등(꺼짐)', '같은 경보등, 어두운 붉은 유리(1×1).', '1칸. alarm_on 과 같은 자리 교대 프레임.', 0, kind='decal')
obj('stair_down', MD.stair_down(), '내림 철 계단', '바닥 구멍(경고 띠 턱) 안 북쪽으로 어둠 속 내려가는 강철 디딤판 일곱 단, 양옆 노란 난간(2×3).', '2×3칸 걷기(맨 윗줄 = 아래층 이동 칸). 바닥 위, 둘레 1칸 비움. 아래층 stair_up 과 짝.', 0, kind='walk')
obj('stair_up', MD.stair_up(), '오름 철 계단', '위로 갈수록 밝아지는 강철 디딤판 여섯 단, 양옆 노란 손잡이 관(2×3).', '2×3칸 걷기(맨 윗줄 = 위층 이동 칸). 북쪽 벽 앞면 바로 아래 바닥 위, 그 위 벽에 stair_well.', 0, kind='walk')
obj('stair_well', MD.stair_well(), '벽 계단 입구', '벽을 뚫은 강철 문틀(경고 띠 상인방) 안으로 계단이 위로, 꼭대기 흰 빛(2×3).', '2×3칸. ' + FWALL + ' stair_up 바로 위 같은 열에만.', 0, kind='decal')

def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower')
ground('checkerplate', 'mf_plate', '공장 체크 철판', '규약 강철판(16×16 = 한 칸, 모서리 리벳 넷) 위 엇갈린 낟알 돌기(미끄럼 막이), 드문 녹 번짐·기름 얼룩 3×3 표본.', '공장 바닥 전부. 기계 둘레·통로는 autotile-hazardline 으로 구획.')
ground('grating', 'mf_grate', '격자 통로 그레이팅', '2px 강철 띠 가로·세로 엮음, 틈 사이 아래층 어둠과 흐린 관, 16px 마다 받침 보 3×3 표본.', '구덩이를 건너는 통로·기계 둘레 발판. 통로 양옆은 autotile-rail.')
ground('labtile', 'mf_lab', '연구소 바닥 판', '차가운 회백 비닐 판(16×16) 줄눈·잔 점·가는 긁힘 3×3 표본.', '지하 연구소 방 바닥. 승강기 앞은 체크 철판.')
kit.add('face_conc_3h', face_sample('mf_conc', 3, 3), 'wall', '콘크리트 벽 앞면(3줄)', '노출 콘크리트 벽판(32×16 엇갈림·거푸집 구멍·물 자국) + 강철 걸레받이(리벳·경고 띠) 3칸 폭 표본.', '공장 방 천장 밑 3줄. 바닥보다 어둡다.', 0, role='wall')
kit.add('face_pipe_3h', face_sample('mf_pipe', 3, 3), 'wall', '관 벽 앞면(3줄)', '콘크리트 앞 가로 관 셋(굵은 강철 지름 12·놋쇠·강철 지름 6, 이음 테 16px)·받침쇠, 칸에 따라 세로 관 3칸 폭 표본.', '보일러실·기관실 천장 밑 3줄.', 0, role='wall')
kit.add('face_lab_3h', face_sample('mf_lab', 3, 3), 'wall', '연구소 벽 앞면(3줄)', '차가운 흰 외장판(판 줄눈 규약)·가운데 청록 띠·아래 걸레받이 3칸 폭 표본.', '연구소 방 천장 밑 3줄.', 0, role='wall')
kit.add('ceiling_steel', ceiling_sample(), 'wall', '공장 천장(벽 윗면)', '어두운 속 + 콘크리트 두께 띠 + 강철 모 앵글(리벳), 모서리 포함 3×3 표본.', '공장 방·복도 바깥(벽 너머) 모든 칸.', 0, role='wall')
kit.add('ceiling_lab', ceiling_sample(True), 'wall', '연구소 천장(벽 윗면)', '흰 판 두께 띠 + 모 앵글, 모서리 포함 3×3 표본.', '연구소 방 바깥 모든 칸.', 0, role='wall')
kit.add('ground-pit', pit_sample(), 'wall', '기계 구덩이', '북쪽 가장자리 = 바닥판 두께 + 안쪽 콘크리트 벽, 그 아래 어둠 속 아래층 관·보(3×3 표본).', '걸을 수 없는 구덩이. 건너는 길은 ground-grating + autotile-rail, 둘레 바닥에 autotile-hazardline.', 0, role='wall')
CS = AU.conveyor_sheet(); RS = AU.rail_sheet(); HS = AU.hazard_sheet()
kit.add('autotile-conveyor', CS, 'autotile', '컨베이어', '3/4 고무 벨트(가로살) + 올리브 강철 테, 남쪽 끝 틀 앞면과 롤러 축 머리, 끝 드럼, 꺾인 칸 = 롤러 옮김판 16변형.',
        '한 줄로 칠한다(폭 1칸). 모든 변형 막힘. 위에 crate_belt·parts_tray·hopper_feeder·stamping_press·scanner_arch 를 얹는다. 꺾임은 한 번 이하, 끝은 벽에서 1칸 띄운다.', 1, layer='upper', role='fence')
kit.add('autotile-rail', RS, 'autotile', '격자 통로 난간', '바랜 노랑 손잡이 관 + 가운데 관 + 8px 마다 강철 기둥 + 발 막이 판, 끝·모서리 머리 기둥 16변형.', '구덩이 위 통로 양옆·구덩이 둘레 한 줄. 모든 변형 막힘. 통로 끝(바닥과 만나는 칸)은 비운다.', 1, layer='upper', role='fence')
kit.add('autotile-hazardline', HS, 'autotile', '바닥 경고선', '구역 바깥 가장자리에 노랑·검정 사선 띠(폭 3px, 벗겨짐), 속 칸은 투명 16변형.', '걷는 바닥 위 구역(기계 앞·승강기 앞·구덩이 둘레·프레스 둘레)을 네모나 덩이로 칠한다. 걷기, 사람 아래.', 0, layer='lower', role='terrain')

# ---------------------------------------------------------------- future-ruins 조각(재사용 — 다시 내보내지 않는다)
FRP = os.path.join(OUT, '..', 'future-ruins', 'parts')
def fr(name): return Image.open(os.path.join(FRP, name + '.png')).convert('RGBA')
for n, br, soft in (('drum_single', 1, False), ('cable_reel', 1, False), ('floor_vent', 0, False), ('pipe_run', 1, False), ('girder_pile', 1, False),
                    ('vent_fan', 1, False), ('rust_machine', 2, False), ('signal_post_on', 1, True), ('toxic_drums', 1, False), ('oil_stain', 0, False),
                    ('glass_shards', 0, False), ('rubble_small', 1, False)):
    S['fr:' + n] = fr(n); kit.meta.setdefault('_reuse', {})
    REUSE_BROWS = globals().setdefault('REUSE_BROWS', {}); REUSE_BROWS['fr:' + n] = br
    if soft: SOFT.add('fr:' + n)
kit.meta.pop('_reuse', None)

# ---------------------------------------------------------------- 지도
W_, H_ = 97, 40
LABX = 57
class FMap(KMap):
    def __init__(s, *a):
        super().__init__(*a); s.pit = set()
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if (x, y) in s.pit:
                    nb = lambda dx, dy: (x + dx, y + dy) in s.pit
                    im.alpha_composite(pit_tile(nb(0, -1), nb(1, 0), nb(0, 1), nb(-1, 0), x * T, y * T), P)
                elif s.fl[y][x]:
                    im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), P)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(dlib.face_tile(sty, None, n - k, int(_hash(x, y, 3) * 6), capL, capR, n * T), P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face or (xx, yy) in s.pit)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(mf_ceiling(o8, int(_hash(x, y, 4) * 4), x >= LABX - 1), P)
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(round(x * T)), int(round(y * T))))
        for cells, sheet in s.over:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

m = FMap(W_, H_, 'machine-factory')
BAD = []
def brows_of(name): return REUSE_BROWS[name] if name in REUSE_BROWS else kit.meta[name]['brows']
def P(name, x, y, block=None, layer=1, check=True):
    """조각을 칸 (x, y)(= 왼쪽 아래 칸)에 놓는다. block 이 없으면 메타 brows 로 발자국을 잰다."""
    img = S[name]; br = brows_of(name)
    if block is None: block = [] if br == 0 else foot(img, br, 10, name in SOFT)
    if check:
        for (bx, by) in block:
            c = (x + bx, y + by)
            if not (m.inb(*c) and m.fl[c[1]][c[0]] is not None and c not in m.blocked): BAD.append((name, x + bx, y + by))
    m.props_add(x, y, img, block, layer)
def FD(name, x, y): m.decal(x, y, S[name])
def DEC(name, x, y):
    img = S[name]; m.compute_faces(); w = -(-img.width // T); h = -(-img.height // T)
    for j in range(h):
        for i in range(w):
            if (int(x) + i, int(y) + j) not in m.face: BAD.append((name + '@face', x + i, y + j))
    m.decal(x, y, img)
def glowc(cx, cy, col=(255, 176, 90), size=48, a=55): m.glow_at(cx + .5, cy + .5, glow(size, col, a))
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]
def R_(x0, y0, x1, y1, kind='mf_plate', sty='mf_conc', wh=3): m.floor(x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
CONV = set(); RAIL = set(); HAZ = set()
def conv(cells):
    for c in cells: CONV.add(c); m.blocked.add(c)
def hz(x0, y0, x1, y1, skip=()):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x, y) not in skip: HAZ.add((x, y))

# ======== 공장 층 (x 0~55)
# 북쪽 큰 방: 보일러실(서) + 기계 구덩이와 격자 통로(동). 바닥 y4~14, 벽 앞면 y1~3(관 벽).
R_(2, 4, 34, 14, sty='mf_pipe')
for (x, y) in ((2, 4), (2, 14), (34, 14), (3, 14)): m.cut(x, y, 1, 1)
# 기계 구덩이 x24~32 y6~12, 격자 통로 y9 (난간 y8·y10 위 구덩이 칸)
PIT = {(x, y) for x in range(24, 33) for y in range(6, 13)} - {(24, 6), (32, 12), (32, 6)}
WALK = {(x, 9) for x in range(23, 34)}
for c in PIT:
    m.fl[c[1]][c[0]] = None
m.pit = PIT - WALK
for (x, y) in WALK: m.fl[y][x] = 'mf_grate'; m.wh[y][x] = 3; m.sty[y][x] = 'mf_pipe'
for c in m.pit: m.blocked.add(c)
RAIL |= {(x, 8) for x in range(24, 33)} | {(x, 10) for x in range(24, 33)}
# 제어실 x37~47 y4~12 (콘크리트 벽), 구덩이 통로가 2칸 문으로 이어진다
R_(37, 4, 47, 12)
R_(34, 9, 36, 10)                                                                   # 구덩이 통로 → 제어실 문
for (x, y) in ((47, 12), (37, 12)): m.cut(x, y, 1, 1)
# 계단 앞 방 x50~53 y5~13
R_(50, 5, 53, 13)
R_(48, 7, 49, 8)                                                                    # 제어실 ↔ 계단 앞 방
# 컨베이어 홀 x2~40 y19~31 (콘크리트 벽), 북쪽 방과 문 둘
R_(2, 19, 40, 31)
for (x, y) in ((2, 19), (2, 31), (40, 31), (40, 19)): m.cut(x, y, 1, 1)
R_(9, 15, 10, 18, sty='mf_conc'); R_(20, 15, 21, 18, sty='mf_conc')
# 승강기 홀 x43~53 y19~29, 컨베이어 홀과 문(x41~42 y23~24), 제어실과 문(x45~46 → 아니고 철문 통로 x51~52)
R_(43, 19, 53, 29)
R_(41, 23, 42, 24)
m.cut(53, 29, 1, 1); m.cut(43, 29, 1, 1)
R_(51, 14, 52, 18)                                                                  # 방폭 철문 통로(계단 앞 방 ↔ 승강기 홀)
# 남쪽 입구 복도
R_(14, 32, 16, 39)

# ---- 보일러실 기계
P('boiler_big', 3, 8, block=[(dx, -dy) for dx in range(6) for dy in range(2)])
glowc(5.3, 6.9, (255, 150, 60), 72, 70)
DEC('gauge_board', 10, 2); DEC('valve_manifold', 17, 3)
P('piston_engine', 10, 9, block=[(dx, -dy) for dx in range(4) for dy in range(2)])
P('gear_works', 15, 8, block=[(dx, -dy) for dx in range(4) for dy in range(2)])
P('pressure_tank', 19, 13); P('pressure_tank_red', 21, 11)
P('steam_stack', 9, 6); P('steam_stack', 22, 5)
P('fr:pipe_run', 3, 12, block=[(0, 0), (3, 0)])
P('fr:drum_single', 7, 12); P('fr:drum_single', 8, 13); P('fr:toxic_drums', 2, 13)
P('fr:cable_reel', 13, 13)
FD('gear_scrap', 14, 11); FD('fr:floor_vent', 17, 12); FD('fr:oil_stain', 9, 11)
hz(9, 10, 14, 10); hz(3, 9, 8, 9)
glowc(10.5, 1.8, (255, 190, 110), 40, 40); glowc(18.5, 2.8, (255, 190, 110), 40, 40)
# ---- 구덩이 둘레
hz(23, 5, 33, 5); hz(23, 13, 33, 13); hz(23, 6, 23, 8); hz(23, 10, 23, 12); hz(33, 6, 33, 8); hz(33, 10, 33, 12)
P('fr:girder_pile', 25, 14, block=[(0, 0), (1, 0), (2, 0)]); P('fr:signal_post_on', 23, 4); P('fr:signal_post_on', 33, 14)
P('fr:drum_single', 31, 4); P('fr:cable_reel', 28, 5)
DEC('breaker_box', 25, 2); DEC('cable_bundle', 27, 1); DEC('alarm_off', 30, 1); DEC('gauge_board', 31, 2)
# ---- 제어실 (앵커 ④)
DEC('control_wall', 39, 1); DEC('monitor_bank', 44, 1); DEC('cable_bundle', 38, 1); DEC('cable_bundle', 43, 1); DEC('breaker_box', 46, 2)
P('console_desk', 39, 6); P('operator_chair', 40, 7); P('operator_chair', 42, 8)
P('console_desk', 43, 10); P('operator_chair', 44, 11)
P('server_rack', 37, 7); P('server_rack', 46, 6)
P('fr:cable_reel', 38, 11); FD('cable_floor', 41, 9); FD('cable_floor', 38, 9)
glowc(41, 2.2, (120, 220, 200), 72, 45)
# ---- 계단 앞 방 (내림 계단)
P('stair_down', 51, 8, block=[])
DEC('alarm_on', 50, 2); DEC('alarm_on', 53, 2); DEC('steel_door', 52, 2) if False else None
P('fr:drum_single', 50, 11); P('fr:drum_single', 53, 12); P('crate_stack', 52, 13); P('hand_cart', 50, 13)
glowc(50, 2.4, (255, 80, 60), 44, 55); glowc(53, 2.4, (255, 80, 60), 44, 55)
hz(50, 9, 53, 10)
# ---- 컨베이어 홀 (앵커 ①)
LA = [(x, 22) for x in range(4, 27)] + [(26, y) for y in range(23, 27)] + [(x, 26) for x in range(27, 38)]
LB = [(x, 29) for x in range(5, 23)]
conv(LA); conv(LB)
P('hopper_feeder', 4, 22, block=[]); P('stamping_press', 10, 22, block=[]); P('scanner_arch', 18, 22, block=[])
for x in (7, 15, 21, 24): P('crate_belt' if x % 2 else 'crate_belt_steel', x, 22, block=[])
P('crate_belt', 26, 24, block=[]); P('crate_belt_steel', 30, 26, block=[]); P('crate_belt', 35, 26, block=[])
P('parts_tray', 9, 29, block=[]); P('parts_tray', 16, 29, block=[]); P('crate_belt_steel', 20, 29, block=[]); P('crate_belt', 6, 29, block=[])
P('assembly_arm', 7, 28); P('assembly_arm_l', 13, 28); P('assembly_arm', 17, 28)
P('parts_bin', 11, 28); P('parts_bin', 19, 28)
hz(9, 23, 13, 23); hz(6, 27, 20, 27, skip={(7, 27), (8, 27), (13, 27), (14, 27), (17, 27), (18, 27)})
# 라인 끝 출하 자리
P('pallet_load', 38, 28); P('crate_stack', 38, 25); P('hand_cart', 36, 28); P('crate_stack', 33, 30)
P('pallet_load', 30, 30); P('fr:drum_single', 39, 30); P('fr:drum_single', 40, 29)
P('crate_stack', 29, 20); P('fr:cable_reel', 33, 21); P('pallet_load', 35, 20)
# 서쪽 벽가 · 남쪽
P('crate_stack', 2, 25); P('fr:drum_single', 2, 27); P('fr:drum_single', 3, 28); P('hand_cart', 4, 26)
P('fr:toxic_drums', 24, 31); P('parts_bin', 22, 31); P('pallet_load', 3, 31)
P('fr:rust_machine', 9, 31, block=[(dx, -dy) for dx in range(4) for dy in range(2)])
FD('gear_scrap', 23, 25); FD('fr:oil_stain', 12, 25); FD('fr:floor_vent', 30, 23); FD('gear_scrap', 18, 31)
hz(13, 30, 17, 31)
DEC('gauge_board', 4, 17); DEC('breaker_box', 12, 17); DEC('cable_bundle', 13, 16); DEC('alarm_off', 16, 16); DEC('valve_manifold', 24, 18)
DEC('breaker_box', 31, 17); DEC('cable_bundle', 33, 16); DEC('gauge_board', 36, 17)
P('steam_stack', 27, 19); P('steam_stack', 6, 19)
for gx in (5, 15, 25, 35): glowc(gx, 16.5, (255, 190, 110), 40, 35)
# ---- 승강기 홀 (앵커 ⑤)
DEC('elevator_closed', 44, 16); DEC('alarm_on', 47, 16); DEC('alarm_on', 43, 16)
P('blast_gate', 50, 18, block=[])
hz(44, 19, 46, 20); hz(51, 19, 52, 20)
P('crate_stack', 48, 20); P('pallet_load', 43, 23); P('hand_cart', 49, 22)
P('fr:signal_post_on', 47, 21); P('crate_stack', 52, 23); P('fr:drum_single', 53, 21); P('fr:drum_single', 43, 21)
P('fr:cable_reel', 50, 27); P('pallet_load', 44, 28); P('crate_stack', 47, 27); P('fr:drum_single', 53, 26)
FD('gear_scrap', 46, 25); FD('fr:oil_stain', 50, 24)
glowc(47, 16.4, (255, 80, 60), 52, 60); glowc(43, 16.4, (255, 80, 60), 52, 60); glowc(45, 17.4, (255, 200, 120), 56, 40)
# 남쪽 입구 복도
P('fr:signal_post_on', 14, 34); P('fr:drum_single', 16, 36)
hz(14, 37, 16, 39)

# ======== 지하 연구소 층 (x 57~96, y 4~35)
# 배양관 홀 x59~93 y8~18 (연구소 벽), 도착 방 x59~71 y24~33, 연구실 x75~94 y24~33
R_(59, 8, 93, 18, 'mf_lab', 'mf_lab')
for (x, y) in ((59, 8), (93, 8), (59, 18), (93, 18), (92, 18)): m.cut(x, y, 1, 1)
R_(59, 24, 71, 33, 'mf_lab', 'mf_lab'); R_(60, 24, 64, 26, 'mf_plate_lab', 'mf_lab')
R_(75, 24, 94, 33, 'mf_lab', 'mf_lab')
for (x, y) in ((59, 33), (94, 33), (94, 24)): m.cut(x, y, 1, 1)
R_(65, 19, 66, 23, 'mf_plate_lab', 'mf_lab')                                         # 방폭 철문 통로
R_(86, 19, 87, 23, 'mf_lab', 'mf_lab')                                               # 연구실 통로
R_(72, 28, 74, 29, 'mf_lab', 'mf_lab')                                               # 도착 방 ↔ 연구실
# ---- 도착 방
DEC('elevator_open', 60, 21); DEC('alarm_on', 59, 21); DEC('alarm_on', 63, 21)
P('stair_up', 69, 26, block=[]); DEC('stair_well', 69, 21)
P('blast_gate', 64, 23, block=[])
hz(60, 24, 62, 25); hz(65, 24, 66, 25)
P('cold_cabinet', 67, 26); P('fr:drum_single', 59, 28); P('crate_stack', 59, 31); P('specimen_shelf', 62, 33)
P('hand_cart', 64, 31); P('fr:cable_reel', 70, 32); P('pallet_load', 66, 33); P('fr:drum_single', 71, 29)
FD('cable_floor', 66, 28)
glowc(59, 21.4, (255, 80, 60), 48, 55); glowc(63, 21.4, (255, 80, 60), 48, 55); glowc(61, 22.5, (220, 240, 255), 56, 45)
# ---- 배양관 홀 (앵커 ③)
TUBES = [('culture_tube', 61, 11), ('culture_tube_dim', 64, 11), ('culture_tube', 62, 15), ('culture_tube_empty', 65, 15),
         ('culture_tube', 70, 11), ('culture_tube', 73, 11), ('culture_tube_dim', 71, 15), ('culture_tube_broken', 76, 15),
         ('culture_tube', 79, 11), ('culture_tube_dim', 82, 11)]
for (n, x, y) in TUBES:
    P(n, x, y); glowc(x + .5, y - 1.2, (120, 230, 120), 44, 40 if 'empty' not in n and 'broken' not in n else 0)
FD('tube_spill', 76, 16)
P('tube_pod', 67, 12); P('tube_pod', 75, 12); P('tube_pod', 68, 16); P('tube_pod', 84, 12)
FD('cable_floor', 66, 13); FD('cable_floor', 74, 13); FD('cable_floor', 69, 17); FD('cable_floor', 81, 13); FD('cable_floor', 85, 14)
P('analysis_machine', 87, 10, block=[(dx, -dy) for dx in range(3) for dy in range(2)])
P('server_rack', 91, 10); P('specimen_shelf', 85, 17); P('cold_cabinet', 90, 15); P('fr:drum_single', 80, 17)
P('crate_stack', 60, 18); P('fr:glass_shards', 78, 17, block=[]) if False else FD('fr:glass_shards', 78, 17)
DEC('monitor_bank', 67, 5); DEC('cable_bundle', 69, 5); DEC('cable_bundle', 77, 5); DEC('monitor_bank', 84, 5); DEC('alarm_off', 75, 5); DEC('breaker_box', 90, 6)
DEC('steel_door', 61, 5)
hz(86, 11, 90, 11)
# ---- 연구실
P('server_rack', 76, 26); P('server_rack', 78, 26); P('server_rack', 80, 27)
DEC('monitor_bank', 83, 21); DEC('cable_bundle', 82, 21); DEC('breaker_box', 93, 22)
P('cold_cabinet', 88, 26); P('cold_cabinet', 91, 26); P('specimen_shelf', 93, 30)
P('lab_bench', 77, 31); P('lab_bench', 83, 29); P('lab_bench', 88, 32)
P('console_desk', 82, 25); P('operator_chair', 83, 26)
P('fr:drum_single', 75, 33); P('specimen_shelf', 75, 29); P('fr:cable_reel', 93, 28)
FD('cable_floor', 79, 28); FD('cable_floor', 85, 26)
glowc(83, 21.6, (120, 220, 200), 56, 40)
if BAD: print('배치 오류', BAD)
m.under.append((HAZ, HS)); m.over.append((CONV, CS)); m.over.append((RAIL, RS))
for c in RAIL: m.blocked.add(c)

# ---------------------------------------------------------------- 통행: 층 이동 고리를 더한 BFS
LINKS = [((45, 19), (61, 24)), ((51, 6), (69, 24)), ((52, 6), (70, 24))]
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
ENT = (15, 39)
m.render()
reach = bfs_all(ENT)
WP = {'남쪽 입구': ENT, '컨베이어 홀': (15, 25), '프레스 앞': (11, 23), '라인 끝 출하': (34, 28), '보일러 앞': (6, 10), '톱니 기계 앞': (17, 9),
      '격자 통로 가운데': (28, 9), '제어반 앞': (41, 5), '계단 앞 방': (51, 10), '내림 계단 위': (51, 6), '승강기 앞(공장)': (45, 19),
      '연구소 승강기 앞': (61, 24), '연구소 계단 위': (69, 24), '방폭 철문 통로': (65, 20), '배양관 홀': (68, 14), '깨진 배양관 앞': (77, 17),
      '분석 기계 앞': (88, 12), '연구실': (85, 31)}
wp_res = {k: dict(at=list(v), reach=v in reach, steps=reach.get(v)) for k, v in WP.items()}
walk_total = sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
def used_cells():
    used = set(HAZ)
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    return used
USED = used_cells()
def emp_region(x0, x1, y0=0, y1=H_):
    vals = []
    for ys in range(y0, y1 - 15 + 1):
        for xs in range(x0, x1 - 20 + 2):
            e = sum(1 for y in range(ys, ys + 15) for x in range(xs, xs + 20) if m.is_walk(x, y) and (x, y) not in USED)
            vals.append((round(e / 300.0, 3), (xs, ys)))
    vals.sort(reverse=True)
    return dict(max=vals[0][0], at=vals[0][1], mean=round(sum(v[0] for v in vals) / len(vals), 3), over40=sum(1 for v in vals if v[0] > .4))
EMPR = {'공장': emp_region(0, 56), '연구소': emp_region(LABX, W_, 4, 36)}
print('empty by region', EMPR)
data = m.export(OUT, ENT, (88, 12), {}, extra=dict(kind='machine-factory', emptiness_by_region=EMPR,
        regions={'공장 층': [0, 55], '지하 연구소 층': [LABX, W_ - 1]},
        floor_links=[[list(a), list(b)] for a, b in LINKS], waypoints_with_links=wp_res,
        reach_all_with_links=len(reach), walkable_cells=walk_total, unreached_cells=walk_total - len(reach)))
print('walk', walk_total, 'reached', len(reach), 'unreached', walk_total - len(reach))
print('wp', {k: (v['reach'], v['steps']) for k, v in wp_res.items() if not v['reach']} or 'all reached')
print('parts', kit.save())
if os.environ.get('UNREACH'):
    print(sorted(c for c in ((x, y) for y in range(H_) for x in range(W_) if m.is_walk(x, y)) if c not in reach))

# ---------------------------------------------------------------- 비교 시트: 같은 2배율로 [기준 | 기계 공장]
from PIL import ImageDraw, ImageFont
VAR = os.path.join(OUT, '..')
REF_FR = os.path.join(VAR, 'future-ruins', 'render-1x.png')
REF_AS = os.path.join(VAR, 'airship', 'render-1x.png')
REF_TI = os.path.join(VAR, 'tower-interior', 'render-1x.png')
REF_C6 = os.path.join(VAR, '..', 'beodeul-city', 'render', 'city6_base.png')
render = m.img
_ff = [f for f in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf') if os.path.exists(f)]
_font = ImageFont.truetype(_ff[0], 14) if _ff else None
cw, ch = 208, 160
def rc(path, box): return Image.open(path).convert('RGBA').crop(box)
CR = [
    [('미래 폐허 공장 마당 (기계 재질 기준)', rc(REF_FR, (848, 240, 848 + cw, 240 + ch))), ('보일러실: 보일러·피스톤·톱니', render.crop((16, 16, 16 + cw, 16 + ch))), ('구덩이 격자 통로·난간', render.crop((336, 32, 336 + cw, 32 + ch)))],
    [('비행선 기관실 (웨이브 2 기준)', rc(REF_AS, (101 * 16 + 16, 40, 101 * 16 + 16 + cw, 40 + ch))), ('컨베이어 라인: 호퍼·프레스·검사 문틀', render.crop((32, 288, 32 + cw, 288 + ch))), ('제어실: 제어반 벽·조작 책상', render.crop((584, 8, 584 + cw, 8 + ch)))],
    [('탑 내부 기계실 (웨이브 2 기준)', rc(REF_TI, (34 * 16 + 330, 40, 34 * 16 + 330 + cw, 40 + ch))), ('승강기 홀: 승강기·방폭 철문·경보등', render.crop((672, 232, 672 + cw, 232 + ch))), ('배양관 홀', render.crop((952, 72, 952 + cw, 72 + ch)))],
    [('버들항 city6_base (석재)', rc(REF_C6, (300, 200, 300 + cw, 200 + ch))), ('연구소 도착 방: 승강기(열림)·계단', render.crop((936, 312, 936 + cw, 312 + ch))), ('연구실: 서버·실험대', render.crop((1200, 360, 1200 + cw, 360 + ch)))],
]
sheet = Image.new('RGBA', (3 * (cw * 2 + 8) + 8, len(CR) * (ch * 2 + 26) + 4), (24, 22, 30, 255)); dr = ImageDraw.Draw(sheet)
for r, row in enumerate(CR):
    for i, (lab, t) in enumerate(row):
        x = 8 + i * (cw * 2 + 8); y = 4 + r * (ch * 2 + 26)
        sheet.alpha_composite(t.resize((cw * 2, ch * 2), Image.NEAREST), (x, y + 20))
        dr.text((x, y + 2), lab, fill=(230, 226, 236, 255), font=_font)
sheet.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))
