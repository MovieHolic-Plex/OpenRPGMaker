# 버들항 웨이브 3 — 최종 탑(final-tower). 다시 돌리면 같은 그림이 나온다.
#   python3 make_final_tower.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png
# 한 맵(116×30)에 탑의 세 층을 나란히 놓는다: 하부 잔해 더미 층(x0~39) · 중간 기계·뼈 층(x42~81) · 최상부 핵 방(x84~115, 32×28).
# 1층 ↔ 2층 = 화물 승강기(두 층 같은 칸 자리), 2층 ↔ 3층 = 오름 계단 ↔ 허공 도착 단의 내림 계단.
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from ft_base import *
from ft_base import _hash
import ft_debris as DB, ft_props1 as A1, ft_props2 as A2, ft_props3 as A3, ft_void as FV, ft_auto as AU
import ft_wave5 as W5, ft_wave5b as B5, ft_wave5c as C5   # 웨이브 5 보정 패스: 땅 덩이 오토타일 3 · 바닥 변형 5 · 바닥 장식 5
import dcheck
assert OUT.endswith('final-tower')

kit = Kit('final-tower', '최종 탑')
S = {}
SOFT = set()
def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img

# ================================================================ 조각 등록 (새로 그린 것만)
# --- 하부 잔해 더미 층
obj('rubble_mound', A1.rubble_mound(), '거대한 잔해 더미', '부서진 강철판·마름돌·뼈·갈비·관·톱니·유리가 쌓인 두 봉우리 언덕(16×9). 남쪽 기슭에서 강철 디딤판 길이 비스듬히 올라 꼭대기 틈을 넘고, 꼭대기에 철골 둘이 솟았다.',
    '16×9칸. 아래 6줄이 발자국(막힘), 디딤판 길 칸(조각 안 (7~8,8)·(7~8,7)·(8~9,6)·(9~10,5)·(10~11,4)·(8~11,3)·(8~9,2~0))만 걷기, 위 3줄은 걷기+가림. 방을 가로지르는 허리(양쪽이 벽 덩이) 자리에 꽉 채워 놓아 반드시 길로 넘게 한다. 길 아래 끝 앞 2칸·위 끝 뒤 2칸은 비운다. 맵당 1개 앵커.', brows=6)
obj('rubble_heap', A1.rubble_heap(), '잔해 무더기', '강철판·마름돌·뼈·관이 쌓인 낮은 언덕과 비스듬히 박힌 철골(4×3).', '4×3칸, 아래 2줄 막힘. 방 모서리·벽가에 1~2개, 잔해 오토타일 위에 올려 덩이로 잇는다. 통로 한가운데 금지.', brows=2)
obj('bone_heap', A1.rubble_heap(seed=27, kinds=DB.KINDS[:1] + [('bone', .5), ('rib', .2), ('vert', .2), ('stone', .2)]), '뼈 무더기', '긴 뼈·갈비·척추 마디가 엉켜 쌓인 낮은 무더기(4×3, 얼굴·해골 없음).', '4×3칸, 아래 2줄 막힘. 납골 곁방·더미 기슭에 하나. 흩어진 뼈(bone_scatter)를 둘레에 2~3개.', brows=2)
obj('rubble_small', A1.rubble_small(), '작은 잔해', '판 조각·마름돌·뼈 하나씩 쌓인 작은 더미(2×2).', '2×2칸, 아랫줄 막힘. 큰 더미·무더기 곁에 이어 붙여 덩이를 키운다(일렬 금지).', brows=1)
obj('bone_scatter', A1.bone_scatter(), '흩어진 뼈', '바닥에 흩어진 긴 뼈 둘·갈비 하나·척추 마디 둘(2×1).', '2×1칸 바닥 장식(걷기, 사람 아래). 더미·무더기 둘레에 2~4개, 통로 한가운데 금지.', brows=0, kind='decal')
obj('plate_scatter', A1.plate_scatter(), '흩어진 판 조각', '깨진 강철판 둘·유리 조각·나사(2×1).', '2×1칸 바닥 장식(걷기). 기계 잔해 곁·잔해 오토타일 가장자리에.', brows=0, kind='decal')
obj('giant_rib_fallen', A1.giant_rib_fallen(), '쓰러진 거대 갈비뼈', '바닥에 누운 거대한 휜 갈비뼈(관절 혹·부러진 단면·결 줄)와 깔린 판 조각(4×2).', '4×2칸, 아랫줄 막힘. 방 가장자리·더미 기슭에 하나. 다른 뼈 장식과 함께.', brows=1)
obj('girder_bent', A1.girder_bent(), '휜 철골', '가운데가 꺾여 휜 H 형강 둘과 깔린 마름돌(3×2).', '3×2칸, 아랫줄 막힘. 더미 곁·무너진 벽가.', brows=1)
obj('machine_wreck', A1.machine_wreck(), '부서진 기계 몸통', '환풍 창살·판 줄눈·리벳의 강철 상자, 뜯긴 모서리로 쏟아진 전선·관, 꺼진 표시등(3×3).', '3×3칸, 아래 2줄 막힘. 벽가·더미 곁. 둘레 한 칸 비움.', brows=2)
obj('glass_vat_broken', A1.glass_vat_broken(), '깨진 유리 통', '강철 받침·뚜껑 사이 유리 원통, 앞이 깨져 비었고 바닥에 탁한 액이 흘렀다(2×3, 안은 빈 통).', '2×3칸, 아랫줄 막힘. 배양실 벽가에 2~3개를 간격 두고(일렬 금지, 하나는 뒤집어).', brows=1, soft=True)
obj('cable_tangle', A1.cable_tangle(), '엉킨 전선', '바닥을 기는 굵은 전선 셋, 끊긴 끝에 청록 불꽃(2×1).', '2×1칸 바닥 장식(걷기). 기계·승강기 곁.', brows=0, kind='decal')
obj('lift_platform', A1.lift_platform(), '화물 승강기 바닥 판', '경고 띠 두른 강철 격자 판, 뒤 두 모서리 안내 기둥과 도르래 줄(4×4).', '4×4칸, 걷기(가운데 2열 위쪽 칸 = 층 이동 칸). 방 북쪽 벽 앞면 바로 아래 바닥 위에 두고, 그 위 벽 앞면에 lift_shaft_face 를 같은 열로. 위층에도 같은 칸 자리에 하나 더.', brows=0, kind='walk')
obj('lift_shaft_face', A1.lift_shaft_face(), '승강로(벽 앞면)', '벽 앞면에 뚫린 어두운 승강로 — 안내 레일·보강재·줄·도르래 틀, 청록 층 표시등(4×3, 글자 없음).', '4×3칸 장식(앞면 위, 앞면 3줄 필요). lift_platform 바로 위 벽 앞면에 같은 열로만.', brows=0, kind='decal')
obj('call_post', A1.call_post(), '승강기 호출 기둥', '강철 기둥 위 청록 버튼 상자와 경고 띠(1×2).', '1×2칸, 아랫줄만 막힘. 승강기 판 오른쪽 옆 한 칸.', soft=True)
# --- 중간 기계·뼈 층
obj('rib_arch', A2.rib_arch(), '갈비 아치', '강철 신을 신은 두 거대 갈비뼈가 휘어 올라 리벳 강철 머릿판(보라 등)으로 맞물린 아치, 가운데 H 형강 버팀보(6×5).', '6×5칸, 양 끝 기둥 밑동 칸만 막힘(가운데 4칸 걷기, 위 줄 걷기+가림). 6칸 폭 회랑에 세로 4칸 간격으로 2~3개를 이어 세운다(마지막 하나는 rib_arch_broken).', brows=1, soft=True)
obj('rib_arch_broken', A2.rib_arch(seed=205, broken=True), '부서진 갈비 아치', '오른쪽 갈비가 허리에서 부러져 버팀보가 비스듬히 처진 아치, 떨어진 뼈 토막(6×5).', '6×5칸, 양 끝 밑동 칸만 막힘. 아치 줄의 끝이나 무너진 곳에 하나.', brows=1, soft=True)
obj('rib_pillar', A2.rib_pillar(), '갈비 기둥', '강철 신에서 솟아 앞으로 휜 뼈 기둥, 강철 띠 둘, 끝에 매단 청록 등(1×3).', '1×3칸, 아랫줄만 막힘. 회랑 양옆에 어긋나게, 빛무리와 함께.', soft=True)
obj('girder_post', A2.girder_post(), '철골 기둥', '바닥에 박힌 H 형강 기둥, 엉겨 붙은 척추 마디, 찢긴 꼭대기(1×3).', '1×3칸, 아랫줄만 막힘. 회랑·기계실 벽가, 갈비 기둥과 번갈아.', soft=True)
obj('core_vessel_on', A2.core_vessel(on=True), '핵 파이프 용기(밝음)', '경고 띠 받침단 위 유리 원통 속 보라 핵 구슬, 강철 고리 셋, 뚜껑에서 천장으로 솟은 굵은 관 셋(관 속 빛 창), 바닥으로 꺾인 놋쇠 관 둘(5×10).', '5×10칸, 아래 3줄 막힘, 위 7줄 걷기+가림(벽 앞면·천장 위로 겹쳐 관이 천장으로 사라진다). 북쪽 벽 앞면 바로 아래 바닥에. core_vessel_dim 과 번갈아 맥동. 맵당 1개 앵커.', brows=3)
obj('core_vessel_dim', A2.core_vessel(on=False), '핵 파이프 용기(어두움)', '같은 용기의 어두운 프레임(핵 구슬이 줄고 빛이 약하다).', 'core_vessel_on 과 같은 자리·같은 발자국. 0.4~0.6초 간격으로 번갈아 보여 맥동시킨다.', brows=3)
obj('pipe_riser', A2.pipe_riser(), '솟은 굵은 관', '바닥 받침에서 천장으로 사라지는 굵은 관 둘(보라 빛 창)(2×5).', '2×5칸, 아랫줄만 막힘(위 4줄은 벽 앞면 위로 겹친다). 핵 용기 양옆·벽가에.', soft=True)
obj('conduit_run', A2.conduit_run(), '핵 도관', '강철 안장 받침 위 굵은 관, 보라 빛이 흐르는 유리 창 셋, 곁의 놋쇠 관(4×2).', '4×2칸, 아랫줄 막힘. 핵 용기에서 방 밖으로 이어지듯 벽가를 따라. 통로를 가로지르지 않는다.', brows=1)
obj('flesh_mass', A2.flesh_mass(), '유기 덩이', '쓰러진 관을 감싸 엉긴 검붉은 둥근 덩이들과 판에 붙은 힘줄(3×2, 추상 — 눈·얼굴 없음).', '3×2칸, 아랫줄 막힘. 기계 곁·벽가에 드물게(층마다 2~3개). 덩이끼리 붙여 두지 않는다.', brows=1)
obj('flesh_small', A2.flesh_small(), '작은 유기 덩이', '바닥 틈에 엉긴 작은 덩이와 힘줄(1×1).', '1칸, 막힘. 큰 유기 덩이 곁이나 갈비 기둥 밑에.', brows=1)
obj('flesh_wall', A2.flesh_wall(), '벽 유기 덩이', '벽판 아래 줄눈에서 번져 오른 검붉은 덩이 띠와 줄눈 따라 뻗은 힘줄(2×2).', '2×2칸 장식(앞면 위, 앞면 2~3줄의 아래쪽). 벽 앞면 6~10칸 간격, 바닥 유기 덩이 위쪽 벽에.', brows=0, kind='decal')
obj('console_dead', A2.console_dead(), '조작대', '기운 판의 강철 조작대, 청록 막대 화면(글자 없음)·단추·레버(2×2).', '2×2칸, 아래 2줄 막힘. 핵 용기·승강기를 바라보는 자리에, 앞 한 칸 비움.', brows=2)
obj('machine_cabinet', A2.machine_cabinet(), '기계 함', '키 큰 강철 함, 깜빡이는 청록·호박 표시등 줄, 통풍구(2×3).', '2×3칸, 아래 2줄 막힘. 벽 앞면 바로 아래에 1~3개를 틈 두고.', brows=2)
obj('vent_glow', A2.vent_glow(), '빛나는 바닥 환기구', '강철 틀 창살 아래 보라 빛(1×1).', '1칸 바닥 장식(걷기). 기계실 바닥에 드문드문 3~5칸 간격.', brows=0, kind='decal')
obj('cable_hang', A2.cable_hang(), '늘어진 전선 다발', '천장에서 벽을 타고 늘어진 굵은 전선 셋, 끝에서 청록 불꽃(1×3).', '1×3칸 장식(앞면 위, 앞면 3줄). 벽 앞면에 6~8칸 간격.', brows=0, kind='decal')
obj('spine_lamp', A2.spine_lamp(), '척추 등', '강철 받침 위 척추 마디를 쌓은 기둥, 꼭대기 갓 아래 청록 등(1×3).', '1×3칸, 아랫줄만 막힘. 입구·계단 양옆에 쌍으로, 빛무리와 함께.', soft=True)
obj('stair_up', A2.stair_up(), '오름 계단', '강철 디딤판 8단, 양옆에 갈비뼈를 박은 강철 난간벽(4×4).', '4×4칸, 가운데 2열 걷기(맨 윗줄 = 위층 이동 칸), 양옆 난간 열 막힘. 방 북쪽 벽 앞면 바로 아래 바닥 위, 그 위 벽 앞면에 stair_arch. 위층에 stair_down 짝.', brows=0, kind='walk')
obj('stair_arch', A2.stair_arch(), '계단 아치(벽 앞면)', '벽 앞면을 뚫은 강철 틀 개구부와 어둠 속 계단 끝, 리벳 들보·갈비 버팀·보라 등(4×3).', '4×3칸 장식(앞면 위, 앞면 3줄 필요). stair_up 바로 위 같은 열.', brows=0, kind='decal')
# --- 최상부 핵 방
obj('core_altar_on', A3.core_altar(on=True), '핵 제단(밝음)', '세 단 둥근 돌 단(동심 고리 판석·보라 빛 상감 고리·앞 계단) 위 뼈 발톱 넷이 받쳐 든 떠 있는 핵 구슬과 엇갈린 강철·놋쇠 고리(8×7, 얼굴 없음).', '8×7칸, 아래 3줄 막힘(맨 아랫줄 가운데 계단 2칸 걷기 = 조사 자리), 위 4줄 걷기+가림. 최상부 방 북쪽 벽 앞면 아래 가운데, 앞 3칸 비움. core_altar_dim 과 번갈아 맥동. 맵당 1개 앵커.', brows=3)
obj('core_altar_dim', A3.core_altar(on=False), '핵 제단(어두움)', '같은 제단의 어두운 프레임.', 'core_altar_on 과 같은 자리·같은 발자국으로 번갈아.', brows=3)
obj('conduit_pylon', A3.conduit_pylon(), '도관 기둥', '위로 가늘어지는 리벳 강철 기둥, 꼭대기 위 떠 있는 보라 결정, 밑동 갈비 버팀(1×4).', '1×4칸, 아랫줄만 막힘. 제단 양옆에 대칭 쌍으로, 제단과 2칸 띄운다.', soft=True)
obj('pipe_organ_wall', A3.pipe_organ_wall(), '관·뼈 벽 장식', '천장에서 내려온 굵기 다른 세로 관 일곱(보라 빛 창)과 관을 묶은 휜 갈비뼈 두 줄, 강철 받침 띠(6×3).', '6×3칸 장식(앞면 위, 앞면 3줄 필요). 제단 바로 뒤 북쪽 벽 가운데에 하나.', brows=0, kind='decal')
obj('stair_down', A3.stair_down(), '내림 계단', '바닥에 뚫린 계단 구멍, 갈비뼈 난간 낮은 벽, 북쪽으로 내려갈수록 어둠과 보라 빛에 잠기는 강철 디딤판(4×4).', '4×4칸, 가운데 2열 걷기(맨 아랫줄 = 도착·출발 칸), 양옆 막힘. 아래층 stair_up 의 짝. 남쪽 앞 2칸 비움.', brows=0, kind='walk')
obj('void_rift', A3.void_rift(), '허공 틈', '바닥이 찢겨 드러난 허공(별·성운), 북쪽 깨진 안벽, 보라 빛 새는 들쭉날쭉한 금(3×2).', '3×2칸, 모든 칸 막힘. 넓은 바닥이나 부유 조각 한가운데를 피해 가장자리 쪽에, 둘레 1칸은 걷게 남긴다.', brows=2)
obj('void_rift_small', A3.void_rift(seed=447, w=2, h=1), '허공 틈(작음)', '작은 허공 틈(2×1).', '2×1칸, 막힘. 바닥 균열 끝·제단 둘레에.', brows=1)
obj('core_lamp', A3.core_lamp(), '핵 화로', '세 다리 강철 받침 그릇의 보라 불길(1×2).', '1×2칸, 아랫줄만 막힘. 방 모서리·다리 끝 양옆에 쌍으로, 빛무리와 함께.', soft=True)
obj('void_girder', A3.void_girder(), '허공에 뜬 철골', '비스듬히 떠도는 H 형강 토막과 부스러기(2×2).', '2×2칸 허공 장식(허공 칸 위에만, 통행에 영향 없음). 부유 조각 사이 허공에 드문드문.', brows=0, kind='decal')
obj('void_bone', A3.void_bone(), '허공에 뜬 갈비뼈', '떠도는 휜 갈비 한 대와 척추 마디(2×1).', '2×1칸 허공 장식. 허공 칸 위에만.', brows=0, kind='decal')
obj('void_slab', A3.void_slab(), '허공에 뜬 먼 바닥 조각', '깨진 돌판·강철 갑판·늘어진 철근의 작은 조각(2×2, 밟을 수 없는 먼 조각).', '2×2칸 허공 장식. 허공 칸 위에만, 걷는 조각과 1칸 이상 띄운다.', brows=0, kind='decal')
obj('bridge_girder_v', A3.bridge_girder_v(), '철골 다리(남북)', '허공을 건너는 H 형강 윗 플랜지(리벳 두 줄)(1×1 이어 붙임).', '1칸 폭, 걷기. 부유 조각 사이 허공 칸에 남북으로 이어 붙인다(2~4칸). 양 끝은 바닥 칸에 닿게.', brows=0, kind='walk')
obj('bridge_girder_h', A3.bridge_girder_h(), '철골 다리(동서)', '윗 플랜지 윗면과 아래로 보이는 웨브·아랫 플랜지(1×1 이어 붙임).', '1칸 폭, 걷기. 허공 칸에 동서로 이어 붙인다. 양 끝은 바닥 칸에 닿게.', brows=0, kind='walk')
fa, _ = FV.fragment_piece((3, 2), seed=31)
obj('float_fragment', fa, '부유 바닥 조각', '허공 쪽으로 깨진 핵 방 바닥 판(3×2)과 아래에 매달린 두께 띠·강철 갑판·깨진 돌 뿌리·철근(3×4).', '3×4칸, 위 2줄 걷기(바닥), 아래 2줄 막힘(밑면이 허공 칸에 걸친다). 허공 위에 두고 철골 다리로 잇는다. 큰 조각은 autotile-voidbreak 로 칠한다.', brows=0, kind='walk')

# --- 바닥·벽·천장 표본, 오토타일
def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower')
ground('tower-slab', 'ft_slab', '탑 판석', '청보라 돌 판석(줄마다 어긋난 마디, 닳은 얼룩, 드문 뼛가루·발광 티끌) 3×3 표본.', '하부 층·곁방 기본 바닥. 3×3 이어 붙여도 이음새가 없다.')
ground('steel-deck', 'ft_plate', '강철 갑판', '16×16 강철판(줄눈 홈·모서리 리벳·긁힘·옅은 녹) 3×3 표본.', '기계 층·승강기 둘레·작업장 바닥.')
ground('grate', 'ft_grate', '격자 바닥', '강철 틀 안 가로 살, 살 사이 어둠에 드문 청록 빛 3×3 표본.', '회랑·기계실 통로. 넓게 깔지 말고 통로 폭만.')
ground('core-tile', 'ft_core', '핵 방 바닥', '짙은 청보라 판(윤나는 사선 반사), 판 교차점마다 짧은 보라 빛 상감 3×3 표본.', '최상부 방·제단 둘레·부유 조각.')
kit.add('face_ftstone_3h', face_sample('ftstone', 3, 3), 'wall', '탑 돌 벽 앞면(3줄)', '청보라 마름돌 벽 앞면, 줄눈에 드물게 새는 보라 빛, 아래 리벳 강철 걸레받이(3칸 폭 표본).', '하부·최상부 방 천장 밑에 3줄. 바닥보다 어둡다.', 0, role='wall')
kit.add('face_ftmech_3h', face_sample('ftmech', 3, 3), 'wall', '강철 벽 앞면(3줄)', '32×16 강철 외장판(반 장 엇갈림, 리벳 6px 간격, 리벳 밑 녹물 줄), 아래 바닥 턱(3칸 폭 표본).', '중간 기계 층 방 천장 밑에 3줄.', 0, role='wall')
kit.add('face_ftmech_2h', face_sample('ftmech', 3, 2), 'wall', '강철 벽 앞면(2줄)', '같은 강철판, 2줄 높이(통로).', '통로·곁 통로 천장 밑에 2줄.', 0, role='wall')
kit.add('ceiling_ft', ceiling_sample(), 'wall', '탑 천장', '어두운 청보라 천장 + 밝은 벽 윗면 띠(모서리 포함 3×3 표본).', '방·복도 바깥(벽 너머). 열린 칸에 닿은 쪽만 밝은 띠.', 0, role='wall')
kit.add('void_underside', C5.underside_part(), 'wall', '깨진 밑면', '위 줄 = autotile-voidbreak 남쪽 칸 [왼 끝·가운데·오른 끝], 아래 줄 = 그 밑 허공 칸에 매달린 강철 갑판·깨진 돌 뿌리·철근(3×2 표본, 위 칸 두께 띠 밑에 끊김 없이 붙는다).', '허공으로 깨진 바닥(autotile-voidbreak 의 아래 이웃 없는 칸) 바로 아래 허공 칸에 아래 줄을 붙인다: 왼쪽에 같은 남쪽 칸이 없으면 왼 끝, 오른쪽에 없으면 오른 끝, 둘 다 있으면 가운데. 걷기 아님.', 0, role='wall')
RS = C5.rubble_sheet(); CS = C5.crack_sheet(); VS = C5.voidbreak_sheet(); US_STRIP = C5.underside_strip()   # 잔해·허공 깨짐 = 적대 검수 보정 판(ft_wave5c)
kit.add('autotile-rubble', RS, 'autotile', '잔해 가장자리', '바닥 위에 덧그리는 잘게 부서진 판·마름돌·부스러기, 이웃 없는 쪽은 성기고 들쭉날쭉한 가장자리 16변형(위 1·오른쪽 2·아래 4·왼쪽 8). 16px 주기라 넓게 깔면 반복이 보이니 3~12칸 덩이로.', '잔해 더미·무더기 둘레, 무너진 방 구석에 덩이로(일렬 금지). 걷기, 사람 아래. 큰 조각은 rubble_small·plate_scatter 를 얹는다.', 0, layer='lower', role='terrain')
kit.add('autotile-glowcrack', CS, 'autotile', '발광 균열', '바닥 판 사이로 갈라진 검은 금과 그 속에서 새는 보라 빛 16변형(이웃 쪽 가장자리 가운데로 이어진다, 외톨이는 세 갈래 별 금).', '핵 용기·제단 둘레에서 바깥으로 뻗는 한 줄기(가지 1~2) 3~10칸. 걷기. 넓은 면을 채우지 않는다.', 0, layer='lower', role='terrain')
kit.add('autotile-voidbreak', VS, 'autotile', '허공 ↔ 바닥 깨진 가장자리', '허공 위 핵 방 바닥 16변형: 이웃 없는 쪽은 허공으로 들쭉날쭉 깨지고(위쪽 깨짐은 밝은 모), 아래가 없으면 돌판 두께 띠. 바깥은 투명(허공 바탕이 비친다).', '허공 바탕 위에 부유 바닥·무너진 방 가장자리로. 걷기. 남쪽 가장자리 아래 허공 칸에는 void_underside 를 붙인다.', 0, layer='lower', role='terrain')
# --- 웨이브 5 보정: 시그니처 땅 덩이 오토타일(16변형, 위층 투명 덧그림)
MS = C5.mana_sheet(); PS = C5.pool_sheet(); DS = C5.dust_sheet()
kit.add('autotile-mana-seep', MS, 'autotile', '마력 번짐', '바닥 판에 스며든 보라 마력이 고인 덩이 16변형(위 1·오른쪽 2·아래 4·왼쪽 8): 바깥은 성긴 보라 알갱이로 번지고, 경계 안 1px 짙은 테, 안으로 갈수록 밝고 짙은 반투명 빛(판 줄눈이 비친다), 드문 빛 알갱이. 가장자리는 둥글고 울퉁불퉁.',
    '아래층 투명 덧그림, 걷기. 핵 용기·핵 제단 앞, 발광 균열(autotile-glowcrack)이 시작되는 자리에 3~12칸 덩이로(균열을 그 위에 겹친다). 줄마다 폭을 바꿔 둥글게, 네모·일렬 금지. 층마다 1~2덩이.', 0, layer='lower', role='terrain')
kit.add('autotile-dark-pool', PS, 'autotile', '어둠 웅덩이', '바닥이 꺼진 자리에 고인 검보라 액 16변형: 북쪽 둑은 꺼진 바닥 앞면(밝은 모 + 돌 앞면 2px + 그늘), 남·동·서 둑은 젖은 턱 + 보라 반사 띠, 수면에 짧은 가로 반사, 둘레 밖으로 젖은 얼룩이 번진다.',
    '아래층 투명 덧그림, 모든 변형 막힘(액체). 깨진 유리 통·기계 몸통 밑, 무너진 방 구석에 2~8칸 덩이로(통로 한가운데 금지, 둘레 1칸은 걷게). 줄마다 폭을 바꿔 둥글게.', 0, layer='lower', role='water')
kit.add('autotile-bone-dust', DS, 'autotile', '뼛가루 쌓인 바닥', '상아 뼛가루가 바닥에 쌓인 낮은 더미 16변형: 가장자리는 군집 알갱이로 성겨 바닥이 비치고, 안은 바람결 능선(밝음)·골(어두움), 남쪽 가장자리 앞 모 그늘 1px.',
    '아래층 투명 덧그림, 걷기. 납골 곁방·뼈 무더기·쓰러진 거대 갈비 둘레에 3~10칸 덩이로, 위에 bone_scatter 를 2~3개 얹는다. 잔해 오토타일과 겹치지 않게 옆에 붙인다.', 0, layer='lower', role='terrain')
for _n, _p in (('autotile-mana-seep', True), ('autotile-dark-pool', False), ('autotile-bone-dust', True)): kit.meta[_n]['passable'] = _p
# --- 웨이브 5 보정: 바닥 변형(같은 줄눈 격자 — 칸 단위로 섞어 깐다)
ground('tower-slab-worn', 'ft_slab_worn', '닳고 금 간 판석', '탑 판석과 같은 줄눈(8px 줄·어긋난 마디)에 판 셋 중 하나꼴로 1px 금, 깨진 모서리, 줄눈에 낀 뼛가루, 그을음 번짐 3×3 표본.', '탑 판석(ground-tower-slab)과 칸 단위로 섞는다(줄눈이 이어진다). 더미·무더기·뼈 둘레, 통행이 잦은 곳에 3~8칸 덩이로. 걷기.')
ground('tower-slab-big', 'ft_slab_big', '큰 마름돌 길', '24×16 큰 청보라 마름돌(줄마다 반 장 어긋남, 윗·왼 빛 모, 아래·오른 그늘 줄눈, 마모 홈) 3×3 표본.', '입구에서 주요 지점으로 이어지는 2~4칸 폭 길 띠로만(줄눈 격자가 판석과 달라 경계가 칸 선에 생긴다 — 길 가장자리로 쓴다). 걷기.')
ground('steel-deck-tread', 'ft_plate_tread', '미끄럼 방지 강철판', '강철 갑판과 같은 16px 판·모서리 리벳, 판 안에 사선 쌍 돌기(4px 격자, 줄마다 엇갈림) 3×3 표본.', '승강기 앞·계단 앞·조작대 앞 작업 자리에 2~6칸 띠로. 강철 갑판과 칸 단위로 섞는다. 걷기.')
ground('steel-deck-rust', 'ft_plate_rust', '녹슨·덧댄 갑판', '강철 갑판과 같은 판 줄눈에 번진 녹과, 판 하나 걸러 덧댄 작은 판(용접 줄·리벳 넷) 3×3 표본.', '유기 덩이·관·잔해 곁, 방 구석에 3~8칸 덩이로(넓게 깔지 않는다). 강철 갑판과 섞는다. 걷기.')
ground('core-tile-cracked', 'ft_core_cracked', '깨진 핵 방 바닥', '핵 방 바닥과 같은 24px 판에 판마다 거미줄 금(마디 둘레 보라 빛)·깨져 내려앉은 모서리·그을린 결 3×3 표본.', '허공 쪽 깨진 가장자리·허공 틈·부유 조각 가장자리에 핵 방 바닥과 섞어 2~3칸 폭으로. 걷기.')
# --- 웨이브 5 보정: 바닥 장식
obj('floor_hatch', B5.floor_hatch(), '점검 해치', '바닥에 묻힌 강철 뚜껑: 어두운 테, 경첩 둘, 손잡이 막대, 모서리 경고 칠(1×1).', '1칸 바닥 장식(걷기, 사람 아래). 기계 층 바닥에 방마다 1~2개, 벽가·기계 함 앞.', brows=0, kind='decal')
obj('drain_grate', B5.drain_grate(), '배수구', '둥근 강철 테 안 방사 살, 살 사이 고인 검보라 액, 둘레 젖은 얼룩(1×1).', '1칸 바닥 장식(걷기). 판석 홀·웅덩이 곁에 드문드문.', brows=0, kind='decal')
obj('floor_sigil', B5.floor_sigil(), '바닥 상감 원', '판석에 새긴 두 겹 고리와 여덟 눈금, 홈에 고인 보라 빛, 군데군데 이 빠짐(2×2, 글자·얼굴 없음).', '2×2칸 바닥 장식(걷기). 길 띠 가운데·부유 조각 가운데에 층마다 하나. 다른 장식과 겹치지 않는다.', brows=0, kind='decal')
obj('slab_broken', B5.slab_broken(), '깨져 들뜬 판석', '판석 셋이 금 따라 조각나 꺼진 구멍 위에 어긋나 얹혔다 — 검은 틈·들린 모 빛·부스러기(2×1).', '2×1칸 바닥 장식(걷기). 판석 홀의 더미·무더기 곁, 닳은 판석 덩이 안에.', brows=0, kind='decal')
obj('hazard_paint', B5.hazard_paint(), '바닥 경고 칠', '바닥에 칠한 노랑·검정 사선 띠, 벗겨지고 긁혔다(2×1, 글자 없음).', '2×1칸 바닥 장식(걷기). 승강기 판 앞에 가로로 2개 이어 붙여 선을 긋는다. 다른 곳에는 쓰지 않는다.', brows=0, kind='decal')

# ================================================================ 지도
W_, H_ = 116, 30
OX = (0, 42, 84)
STYLE = ('ftstone', 'ftmech', 'ftstone')

class FMap(KMap):
    def __init__(s, *a):
        super().__init__(*a); s.void = set(); s.lights = []; s.rubble = set(); s.cracks = set(); s.vb_cells = {}; s.us_cells = {}
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                Pp = (x * T, y * T)
                if s.fl[y][x]: im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), Pp)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(dlib.face_tile(sty, None, n - k, int(_hash(x, y, 3) * 6), capL, capR, n * T), Pp)
                elif (x, y) in s.void: im.alpha_composite(VOIDBG.crop((x * T, y * T, x * T + T, y * T + T)), Pp)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(ft_ceiling(o8, int(_hash(x, y, 4) * 4)), Pp)
        # 최상부 층: 허공에 닿는 바닥 칸은 시트(autotile-voidbreak)의 칸으로, 그 밑 허공 칸에는 void_underside 아래 줄을 붙인다
        #   (스토어 팩을 받은 사람이 같은 칸을 같은 규칙으로 깔면 이 그림이 그대로 나온다 — 전역 좌표 층을 따로 그리지 않는다)
        for (x, y), msk in s.vb_cells.items():
            im.paste(VOIDBG.crop((x * T, y * T, x * T + T, y * T + T)), (x * T, y * T))
            im.alpha_composite(atile_img(VS, msk), (x * T, y * T))
        for (x, y), col in s.us_cells.items():
            im.alpha_composite(US_STRIP.crop((col * T, 0, col * T + T, T)), (x * T, y * T))
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for (px_, py_, img) in s.lights: im.alpha_composite(img, (int(px_), int(py_)))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

m = FMap(W_, H_, 'final-tower')
BAD = []
def R(f, x0, y0, x1, y1, kind, wh=3):
    m.floor(OX[f] + x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, STYLE[f])
def CUT(f, x0, y0, w=1, h=1): m.cut(OX[f] + x0, y0, w, h)
def P(name, f, x, y, block=None, layer=1, check=True, img=None):
    img = img or S[name]; X = OX[f] + x
    br = kit.meta[name]['brows']
    if block is None: block = [] if br == 0 else foot(img, br, 10, name in SOFT)
    if check:
        for (bx, by) in block:
            c = (X + bx, y + by)
            if not (m.inb(*c) and m.fl[c[1]][c[0]] is not None and c not in m.blocked): BAD.append((name, f, x + bx, y + by))
    m.props_add(X, y, img, block, layer)
def DEC(name, f, x, y, img=None):
    img = img or S[name]; m.compute_faces(); w = -(-img.width // T); h = -(-img.height // T)
    for j in range(h):
        for i in range(w):
            if (OX[f] + x + i, y + j) not in m.face: BAD.append((name + '@face', f, x + i, y + j))
    m.decal(OX[f] + x, y, img)
def FD(name, f, x, y, img=None): m.decal(OX[f] + x, y, img or S[name])
def VD(name, f, x, y):
    img = S[name]
    for j in range(img.height // T):
        for i in range(img.width // T):
            if (OX[f] + x + i, y + j) not in m.void: BAD.append((name + '@void', f, x + i, y + j))
    m.decal(OX[f] + x, y, img)
def glowc(f, cx, cy, col=CYAN[4], size=48, a=55): m.glow_at(OX[f] + cx + .5, cy + .5, dlib_glow(size, col, a))
import dprops as _D
def dlib_glow(size, col, a): return _D.glow(size, col, a)
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]
def cells(f, pts): return {(OX[f] + x, y) for (x, y) in pts}
def rect(x0, y0, x1, y1): return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}

# ---------------------------------------------------------------- 1층: 하부 잔해 더미 층 (x0~39)
R(0, 8, 5, 31, 12, 'ft_plate')                       # 북쪽 하역장(승강기)
for (x, y, w, h) in ((8, 5, 2, 1), (8, 6, 1, 1), (31, 5, 1, 2), (30, 5, 1, 1)): CUT(0, x, y, w, h)
R(0, 13, 13, 26, 18, 'ft_slab')                      # 허리(잔해 더미가 꽉 막는다, 더미는 양옆 벽 덩이에 한 칸씩 걸친다)
R(0, 6, 19, 33, 25, 'ft_slab')                       # 남쪽 홀
for (x, y, w, h) in ((6, 25, 2, 1), (6, 24, 1, 1), (33, 24, 1, 2), (32, 25, 1, 1)): CUT(0, x, y, w, h)
R(0, 18, 26, 21, 29, 'ft_slab')                      # 입구 통로(아래 끝 = 맵 출입)
R(0, 1, 15, 4, 22, 'ft_slab'); R(0, 5, 20, 5, 21, 'ft_slab', 2)   # 서쪽 납골 곁방 + 통로
CUT(0, 1, 22)
R(0, 34, 5, 38, 12, 'ft_slab'); R(0, 32, 8, 33, 9, 'ft_slab', 2)  # 동쪽 배양실 + 통로
CUT(0, 38, 5); CUT(0, 38, 12)
# ---------------------------------------------------------------- 2층: 중간 기계·뼈 층 (x42~81)
R(1, 14, 5, 26, 10, 'ft_plate')                      # 승강기 도착 하역장
CUT(1, 14, 5); CUT(1, 26, 5)
R(1, 16, 11, 23, 21, 'ft_grate')                     # 갈비 아치 회랑(8칸 폭)
R(1, 4, 22, 35, 26, 'ft_slab')                       # 남쪽 홀
CUT(1, 4, 26); CUT(1, 35, 26); CUT(1, 35, 22)
R(1, 1, 6, 11, 21, 'ft_plate')                       # 서쪽 핵 용기실
R(1, 3, 13, 9, 17, 'ft_grate')                       # 용기 앞 격자(아래층 빛)
CUT(1, 1, 6); CUT(1, 11, 6)
R(1, 29, 6, 37, 21, 'ft_plate')                      # 동쪽 계단 기계실
CUT(1, 37, 6); CUT(1, 37, 21); CUT(1, 29, 6)
# ---------------------------------------------------------------- 3층: 최상부 핵 방 (x84~115, 32×28: y1~28)
R(2, 4, 5, 27, 14, 'ft_core')                        # 핵 방(남쪽이 허공으로 깨졌다)
for (x, y) in ((4, 14), (5, 14), (6, 14), (4, 13), (10, 14), (11, 14), (21, 14), (22, 14), (26, 14), (27, 14), (27, 13), (25, 14), (4, 5), (27, 5)): CUT(2, x, y)
FRAG_A = rect(10, 22, 17, 26) - {(17, 22), (17, 26), (10, 26)}       # 도착 단(내림 계단)
FRAG_B = rect(14, 17, 19, 19) - {(14, 17), (19, 19)}                  # 가운데 조각
FRAG_C = rect(3, 20, 7, 22) - {(3, 20)}            # 서쪽 곁 조각
FRAG_D = rect(22, 17, 26, 20) - {(26, 17), (22, 20)}                  # 동쪽 곁 조각
for c in FRAG_A | FRAG_B | FRAG_C | FRAG_D:
    R(2, c[0], c[1], c[0], c[1], 'ft_core'); m.wh[c[1]][OX[2] + c[0]] = 0          # 부유 조각: 위에 벽 앞면이 없다
BRIDGES_V = [(16, 20), (16, 21), (17, 15), (17, 16)]                 # 철골 다리(남북)
BRIDGES_H = [(8, 22), (9, 22), (20, 18), (21, 18)]                   # 철골 다리(동서)
for (x, y) in BRIDGES_V + BRIDGES_H: m.br[y][OX[2] + x] = True
m.compute_faces()
_solid = {(x, y) for y in range(H_) for x in range(OX[2], W_) if m.fl[y][x] is not None or (x, y) in m.face}
for y in range(H_):
    for x in range(OX[2] - 1, W_):
        if not m.inb(x, y) or m.fl[y][x] is not None or (x, y) in m.face: continue
        near = any((x + dx, y + dy) in _solid and (x + dx, y + dy)[1] <= 12 for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if x >= OX[2] and (y >= 13 or not near): m.void.add((x, y))
VOIDBG = FV.void_bg(W_, H_, seed=19)
m.compute_faces()

# ---------------------------------------------------------------- 웨이브 5: 바닥 변형을 칸 단위로 섞는다(같은 줄눈 격자라 이음새 없음)
from dlib import vnoise as _vn
def VARY(f, x0, y0, x1, y1, src, dst, thr, seed, sc=3.0):
    for y in range(y0, y1 + 1):
        for x in range(OX[f] + x0, OX[f] + x1 + 1):
            if m.inb(x, y) and m.fl[y][x] == src and _vn(x, y, sc, seed) > thr: m.fl[y][x] = dst
def SETF(f, pts, dst, src=None):
    for (x, y) in pts:
        X = OX[f] + x
        if m.fl[y][X] is not None and (src is None or m.fl[y][X] == src): m.fl[y][X] = dst
# 1층: 입구 통로 → 남쪽 홀 → 더미 길 아래까지 큰 마름돌 길(4칸 폭, 홀에서 한 칸씩 넓어졌다 좁아진다), 홀·허리·곁방은 닳은 판석 덩이
SETF(0, rect(18, 22, 21, 29) | rect(17, 20, 22, 21) | rect(18, 19, 21, 19), 'ft_slab_big')
VARY(0, 0, 13, 39, 29, 'ft_slab', 'ft_slab_worn', .56, 811)
SETF(0, rect(1, 15, 4, 22) - {(4, 15), (1, 15)}, 'ft_slab_worn', 'ft_slab')
SETF(0, rect(16, 9, 23, 11), 'ft_plate_tread')                                        # 승강기 앞 작업 자리
VARY(0, 8, 5, 31, 12, 'ft_plate', 'ft_plate_rust', .6, 813)
VARY(0, 34, 5, 38, 12, 'ft_slab', 'ft_slab_worn', .45, 815)
# 2층: 승강기 앞·계단 앞 미끄럼 방지판, 녹슨 판 덩이, 남쪽 홀 닳은 판석
SETF(1, rect(16, 9, 23, 10), 'ft_plate_tread')
SETF(1, rect(30, 10, 35, 12), 'ft_plate_tread')
VARY(1, 0, 5, 39, 21, 'ft_plate', 'ft_plate_rust', .6, 821)
VARY(1, 0, 22, 39, 26, 'ft_slab', 'ft_slab_worn', .5, 823)
# 3층: 허공 쪽(남쪽) 가장자리와 부유 조각 가장자리는 깨진 판
for y in range(1, 29):
    for x in range(OX[2], W_):
        if m.fl[y][x] != 'ft_core': continue
        lx = x - OX[2]
        edge = any(m.inb(x + dx, y + dy) and m.fl[y + dy][x + dx] is None and (x + dx, y + dy) in m.void for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if (edge and _vn(x, y, 2.0, 831) > .32) or (y >= 12 and lx < 26 and _vn(x, y, 3.0, 833) > .58): m.fl[y][x] = 'ft_core_cracked'

# ================================================================ 1층 배치
MX, MY = 12, 18                                       # 잔해 더미 왼쪽 아래 칸
P('rubble_mound', 0, MX, MY, block=[(dx, dy) for (dx, dy) in A1.mound_block() if m.fl[MY + dy][MX + dx] is not None])
mound_path = {(MX + cx, MY - (A1.MOUND_H - 1 - cy)) for (cx, cy) in A1.MOUND_PATH}
P('lift_platform', 0, 18, 8, block=[])
DEC('lift_shaft_face', 0, 18, 2)
P('call_post', 0, 22, 8); glowc(0, 22, 6, size=36, a=55)
P('machine_wreck', 0, 9, 9, block=BX(3, 2))
P('girder_bent', 0, 25, 7, block=[(0, 0), (1, 0), (2, 0)])
P('rubble_small', 0, 28, 11)
FD('cable_tangle', 0, 14, 7); FD('plate_scatter', 0, 23, 10); FD('plate_scatter', 0, 10, 11)
for x in (11, 28): DEC('cable_hang', 0, x, 2)
# 동쪽 배양실
P('glass_vat_broken', 0, 34, 7); P('glass_vat_broken', 0, 37, 8, img=flipx(S['glass_vat_broken']))
P('console_dead', 0, 35, 12, block=BX(2, 2))
FD('plate_scatter', 0, 34, 10)
# 남쪽 홀
P('giant_rib_fallen', 0, 7, 21, block=[(0, 0), (1, 0), (2, 0), (3, 0)])
P('rubble_heap', 0, 29, 23, block=[(dx, -dy) for dx in range(4) for dy in range(2)])
P('rubble_small', 0, 9, 24)
P('girder_bent', 0, 23, 25, block=[(0, 0), (1, 0), (2, 0)])
for (x, y) in ((17, 25), (22, 25)): P('spine_lamp', 0, x, y); glowc(0, x, y - 2)
for (x, y) in ((11, 22), (26, 21), (14, 24), (30, 25)): FD('bone_scatter', 0, x, y)
FD('plate_scatter', 0, 23, 21)
FD('floor_sigil', 0, 19, 22)                                                          # 길 띠 가운데 상감 원
FD('drain_grate', 0, 12, 23); FD('slab_broken', 0, 23, 23); FD('slab_broken', 0, 13, 20)
for x in (18, 20): FD('hazard_paint', 0, x, 10)                                       # 승강기 앞 경고 선
FD('floor_hatch', 0, 26, 10)
# 서쪽 납골 곁방
P('bone_heap', 0, 1, 16, block=[(dx, -dy) for dx in range(4) for dy in range(2)])
FD('bone_scatter', 0, 2, 19); FD('bone_scatter', 0, 1, 21)
# 웨이브 5 땅 덩이(1층): 납골 곁방·홀 서쪽 뼛가루, 배양실 깨진 통 밑 어둠 웅덩이
DUST = cells(0, [(1, 19), (1, 20), (2, 20), (3, 20), (4, 19), (4, 20), (1, 21), (2, 21), (3, 21), (5, 20), (5, 21)])
DUST |= cells(0, [(7, 23), (8, 23), (7, 24), (8, 24), (8, 25), (9, 25), (10, 25), (11, 24), (11, 25), (12, 25), (12, 24)])
POOL = cells(0, [(36, 9), (37, 9), (38, 9), (38, 10)])
MANA = set()
# 잔해 덧그림(1층): 더미 기슭·구석 덩이
RUB = set()
RUB |= cells(0, [(x, 19) for x in range(11, 29) if x not in (19, 20)] + [(x, 20) for x in (13, 14, 15, 16, 23, 24, 25, 26)] + [(x, 21) for x in (14, 15, 24)])
RUB |= cells(0, [(x, y) for (x, y) in rect(26, 20, 32, 25) if (x + y) % 7 != 0 and not (x == 26 and y > 23)])
RUB |= cells(0, [(x, 12) for x in range(12, 28) if x not in (20, 21)] + [(x, 11) for x in (13, 14, 15, 24, 25, 26)])
RUB |= cells(0, list(rect(6, 19, 10, 22) - {(6, 19), (10, 22)}))
RUB |= cells(0, list(rect(1, 17, 4, 18)) + [(2, 19), (3, 19)])
RUB -= DUST
RUB |= cells(0, [(9, 6), (10, 6), (11, 6), (9, 7), (12, 7), (12, 8)])
RUB = {c for c in RUB if m.fl[c[1]][c[0]] is not None}
# ================================================================ 2층 배치
P('lift_platform', 1, 18, 8, block=[]); DEC('lift_shaft_face', 1, 18, 2)
P('call_post', 1, 22, 8); glowc(1, 22, 6, size=36, a=55)
P('machine_cabinet', 1, 14, 8, block=[(0, 0), (1, 0), (0, -1), (1, -1)])
P('pipe_riser', 1, 24, 7)
DEC('flesh_wall', 1, 16, 3); DEC('cable_hang', 1, 25, 2)
FD('cable_tangle', 1, 15, 9)
P('console_dead', 1, 23, 10, block=BX(2, 2))
for x in (18, 20): FD('hazard_paint', 1, x, 10)
# 갈비 아치 회랑
for y in (13, 17): P('rib_arch', 1, 17, y, block=[(0, 0), (5, 0)])
P('rib_arch_broken', 1, 17, 21, block=[(0, 0), (5, 0)])
P('rib_pillar', 1, 16, 15); glowc(1, 16, 12, size=36); P('girder_post', 1, 23, 15)
P('girder_post', 1, 16, 19); P('rib_pillar', 1, 23, 19); glowc(1, 23, 16, size=36)
P('flesh_small', 1, 23, 12); P('flesh_small', 1, 16, 11)
# 핵 용기실(서)
P('core_vessel_on', 1, 4, 11, block=[(dx, -dy) for dx in range(5) for dy in range(3)])
P('pipe_riser', 1, 2, 9); P('pipe_riser', 1, 9, 9, img=flipx(S['pipe_riser']))
P('console_dead', 1, 3, 15, block=BX(2, 2)); P('console_dead', 1, 7, 16, block=BX(2, 2))
P('conduit_run', 1, 1, 20, block=[(0, 0), (1, 0), (2, 0), (3, 0)])
P('flesh_mass', 1, 8, 20, block=[(0, 0), (1, 0), (2, 0)])
P('machine_cabinet', 1, 10, 13, block=[(0, 0), (1, 0), (0, -1), (1, -1)])
P('machine_cabinet', 1, 1, 14, block=[(0, 0), (1, 0), (0, -1), (1, -1)])
P('rib_pillar', 1, 11, 18); glowc(1, 11, 15, size=36); P('girder_post', 1, 1, 17)
FD('bone_scatter', 1, 4, 19); FD('plate_scatter', 1, 9, 17); FD('cable_tangle', 1, 5, 12)
CRK = set()
CRK |= cells(1, [(6, 12), (6, 13), (7, 13), (7, 14), (6, 14)])                       # 용기 밑에서 갈라져 남쪽 홀로 뻗는 금
CRK |= cells(1, [(5, 17), (5, 18), (6, 18), (6, 19), (6, 20), (7, 20), (7, 21), (7, 22), (8, 22), (8, 23)])
m.glow_at(OX[1] + 6.5, 7.5, dlib_glow(96, VIOL[4], 50))
# 남쪽 홀
P('conduit_run', 1, 5, 24, block=[(0, 0), (1, 0), (2, 0), (3, 0)])
P('flesh_mass', 1, 27, 26, block=[(0, 0), (1, 0), (2, 0)])
P('console_dead', 1, 32, 24, block=BX(2, 2))
P('spine_lamp', 1, 15, 23); glowc(1, 15, 21); P('spine_lamp', 1, 24, 23); glowc(1, 24, 21)
P('rubble_small', 1, 11, 26); P('girder_bent', 1, 29, 23, block=[(0, 0), (1, 0), (2, 0)])
FD('bone_scatter', 1, 17, 26); FD('plate_scatter', 1, 10, 23)
FD('drain_grate', 1, 25, 25); FD('slab_broken', 1, 20, 23); FD('floor_hatch', 1, 10, 10); FD('floor_hatch', 1, 35, 13)
MANA |= cells(1, [(4, 12), (5, 12), (6, 12), (7, 12), (8, 12), (5, 13), (6, 13), (7, 13), (8, 13), (5, 14), (6, 14), (9, 13)])
POOL |= cells(1, [(31, 24), (30, 25), (31, 25), (32, 25), (33, 25), (30, 26), (31, 26), (32, 26), (33, 26)])
DUST |= cells(1, [(16, 25), (17, 25), (15, 26), (16, 26), (18, 26), (19, 26)])
# 계단 기계실(동)
P('stair_up', 1, 31, 9, block=[(0, 0), (0, -1), (0, -2), (0, -3), (3, 0), (3, -1), (3, -2), (3, -3)])
DEC('stair_arch', 1, 31, 3)
P('spine_lamp', 1, 30, 9); glowc(1, 30, 7); P('spine_lamp', 1, 35, 9); glowc(1, 35, 7)
P('machine_cabinet', 1, 29, 14, block=[(0, 0), (1, 0), (0, -1), (1, -1)]); P('machine_cabinet', 1, 36, 14, block=[(0, 0), (1, 0), (0, -1), (1, -1)])
P('flesh_mass', 1, 32, 17, block=[(0, 0), (1, 0), (2, 0)])
P('girder_post', 1, 29, 19); P('rib_pillar', 1, 37, 19); glowc(1, 37, 16, size=36)
P('console_dead', 1, 34, 21, block=BX(2, 2))
DEC('flesh_wall', 1, 35, 4); DEC('cable_hang', 1, 30, 3)
RUB |= {c for c in cells(1, [(4, 22), (5, 22), (4, 23), (34, 26), (11, 25), (12, 25), (10, 26), (12, 26)]) if m.fl[c[1]][c[0]]}
CRK |= cells(1, [(33, 13), (33, 14), (32, 14), (32, 15), (31, 15), (31, 16), (30, 16), (30, 17)])        # 계단 앞에서 갈라진 금
RUB |= {c for c in cells(1, [(35, 10), (36, 10), (36, 11), (37, 11), (36, 17), (37, 17), (36, 18), (37, 16), (25, 22), (26, 22), (26, 23), (27, 22), (21, 26), (22, 26), (23, 26)]) if m.fl[c[1]][c[0]]}
FD('bone_scatter', 1, 34, 16); FD('plate_scatter', 1, 30, 11)
# ================================================================ 3층 배치
P('core_altar_on', 2, 12, 13, block=A3.altar_block())
DEC('pipe_organ_wall', 2, 13, 2)
P('conduit_pylon', 2, 9, 12); P('conduit_pylon', 2, 22, 12)
for (x, y) in ((9, 9), (22, 9)): glowc(2, x, y, VIOL[4], 40, 60)
P('core_lamp', 2, 5, 7); P('core_lamp', 2, 26, 7); glowc(2, 5, 6, VIOL[4], 44); glowc(2, 26, 6, VIOL[4], 44)
P('void_rift_small', 2, 24, 13, block=[(0, 0), (1, 0)])
for x in (6, 25): DEC('cable_hang', 2, x, 2)
DEC('flesh_wall', 2, 9, 3); DEC('flesh_wall', 2, 21, 3, img=flipx(S['flesh_wall']))
CRK |= cells(2, [(15, 14), (14, 14), (14, 13), (13, 14)])
CRK |= cells(2, [(17, 14), (18, 13), (18, 14), (19, 14)])
CRK |= cells(2, [(11, 13), (10, 13), (9, 13), (8, 13), (8, 12)])                                       # 제단에서 서쪽 허공 틈으로
P('void_rift', 2, 5, 12, block=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)])
RUB |= {c for c in cells(2, [(5, 6), (6, 6), (7, 6), (5, 8), (5, 9), (6, 9), (23, 6), (24, 6), (25, 6), (24, 9), (25, 9), (25, 10), (26, 11), (26, 12)]) if m.fl[c[1]][c[0]]}
FD('bone_scatter', 2, 19, 10); FD('plate_scatter', 2, 10, 6); FD('bone_scatter', 2, 21, 7)
CRK |= cells(2, [(20, 13), (21, 13), (22, 13)] + [(23, 13), (23, 12), (24, 12)])                       # 동쪽으로
CRK |= cells(2, [(8, 7), (9, 7), (9, 8), (10, 8)])
# 도착 단
P('stair_down', 2, 12, 25, block=[(0, 0), (0, -1), (0, -2), (0, -3), (3, 0), (3, -1), (3, -2), (3, -3)])
P('core_lamp', 2, 10, 25); glowc(2, 10, 24, VIOL[4], 40); P('core_lamp', 2, 17, 25); glowc(2, 17, 24, VIOL[4], 40)
# 가운데 조각
FD('plate_scatter', 2, 18, 18); FD('bone_scatter', 2, 14, 19)
FD('floor_sigil', 2, 15, 17)
MANA |= cells(2, [(12, 14), (13, 14), (14, 14), (15, 14), (16, 14), (17, 14), (18, 14), (19, 14), (20, 14), (11, 13), (20, 13), (21, 13)])
DUST |= cells(2, [(4, 20), (5, 20), (6, 20), (7, 20), (7, 21)])
# 서쪽 곁 조각: 쓰러진 거대 갈비 + 핵 화로
P('giant_rib_fallen', 2, 3, 22, block=[(0, 0), (1, 0), (2, 0), (3, 0)])
P('core_lamp', 2, 6, 21); glowc(2, 6, 20, VIOL[4], 40)
# 동쪽 곁 조각: 꺼져 가는 조작대(저장 자리)
P('console_dead', 2, 23, 19, block=BX(2, 2))
P('flesh_small', 2, 26, 19)
# 허공 장식
for (n, x, y) in (('void_girder', 1, 15), ('void_bone', 20, 27), ('void_bone', 1, 26), ('void_slab', 0, 18)):
    VD(n, 2, x, y)
for (x, y) in BRIDGES_V: m.decal(OX[2] + x, y, S['bridge_girder_v'])
for (x, y) in BRIDGES_H: m.decal(OX[2] + x, y, S['bridge_girder_h'])
# 허공에 뜬 먼 조각 하나를 autotile-voidbreak 시트로 깐다(밟을 수 없는 장식 — 시트가 지도에서 어떻게 이어지는지 보인다):
# 둥근 덩이 + 동쪽으로 1칸 폭 꼬리 + 홀로 칸 하나
ISLE = cells(2, [(24, 23), (25, 23), (23, 24), (24, 24), (25, 24), (26, 24), (23, 25), (24, 25), (25, 25), (26, 25), (27, 25), (28, 25), (24, 26), (25, 26), (28, 26), (30, 23)])
for c in ISLE:
    if c not in m.void: BAD.append(('isle@void',) + c)
if BAD: print('배치 오류', BAD)

MANA = {c for c in MANA if all(m.inb(c[0] + dx, c[1] + dy) and m.fl[c[1] + dy][c[0] + dx] is not None for dx in (-1, 0, 1) for dy in (-1, 0, 1))}   # 허공·깨진 가장자리에 닿는 칸은 뺀다(번짐이 허공으로 넘치지 않게)
DUST = {c for c in DUST if m.fl[c[1]][c[0]] is not None}
POOL = {c for c in POOL if m.fl[c[1]][c[0]] is not None}
for c in POOL:
    if c in m.blocked: BAD.append(('pool@blocked',) + c)
    m.blocked.add(c)
m.under.append((DUST, DS)); m.under.append((MANA, MS)); m.under.append((POOL, PS))
m.under.append((CRK, CS))
m.under.insert(0, (RUB, RS))                                                           # 잔해는 세 층 모두 시트 칸으로 조립
# 허공 깨짐: 3층 바닥 칸 중 허공(다리 아님)에 닿는 칸 → 시트 칸, 이웃 있음 = 바닥·벽·다리
def _solid(x, y): return m.inb(x, y) and not ((x, y) in m.void and not m.br[y][x])
for y in range(H_):
    for x in range(OX[2], W_):
        if m.fl[y][x] is None: continue
        msk = (1 if _solid(x, y - 1) else 0) | (2 if _solid(x + 1, y) else 0) | (4 if _solid(x, y + 1) else 0) | (8 if _solid(x - 1, y) else 0)
        if msk == 15: continue
        m.vb_cells[(x, y)] = msk
        if not msk & 4:
            def _edge(xx): return m.inb(xx, y) and m.fl[y][xx] is not None and not _solid(xx, y + 1)
            l, r = _edge(x - 1), _edge(x + 1)
            m.us_cells[(x, y + 1)] = 1 if (l and r) else (0 if r else (2 if l else 1))
m.under.append((ISLE, VS))
for c in ISLE:                                                                         # 허공에 뜬 장식 조각도 같은 밑면
    if (c[0], c[1] + 1) not in ISLE:
        l, r = (c[0] - 1, c[1]) in ISLE and (c[0] - 1, c[1] + 1) not in ISLE, (c[0] + 1, c[1]) in ISLE and (c[0] + 1, c[1] + 1) not in ISLE
        m.us_cells[(c[0], c[1] + 1)] = 1 if (l and r) else (0 if r else (2 if l else 1))
for _S in (RUB, CRK, MANA, DUST): _S -= set(m.vb_cells)                                # 깨진 가장자리 칸에는 덧그림을 얹지 않는다(허공 위로 번지지 않게)

# ================================================================ 통행: 층 이동 고리를 더한 BFS
LINKS = [((OX[0] + 19, 6), (OX[1] + 19, 6)), ((OX[0] + 20, 6), (OX[1] + 20, 6)),
         ((OX[1] + 32, 6), (OX[2] + 13, 25)), ((OX[1] + 33, 6), (OX[2] + 14, 25))]
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
ENT = (OX[0] + 19, 29)
m.render()
reach = bfs_all(ENT)
WP = {'1층 입구': (0, 19, 29), '남쪽 홀': (0, 19, 22), '더미 길 아래': (0, 19, 18), '더미 꼭대기': (0, 21, 15), '북쪽 하역장': (0, 15, 9), '승강기(1층)': (0, 19, 6),
      '배양실': (0, 36, 10), '납골 곁방': (0, 2, 20),
      '승강기(2층)': (1, 19, 6), '갈비 회랑': (1, 19, 16), '남쪽 홀(2층)': (1, 19, 24), '핵 용기 앞': (1, 6, 13), '계단 기계실': (1, 33, 16), '오름 계단 위': (1, 32, 6),
      '도착 단(3층)': (2, 13, 25), '가운데 조각': (2, 16, 18), '서쪽 곁 조각': (2, 5, 20), '동쪽 곁 조각': (2, 25, 18), '핵 방': (2, 15, 9), '제단 앞(계단)': (2, 15, 13)}
wp_res = {k: dict(at=[OX[f] + x, y], floor=f, reach=(OX[f] + x, y) in reach, steps=reach.get((OX[f] + x, y))) for k, (f, x, y) in WP.items()}
walk_total = sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
unreached = [(x, y) for y in range(H_) for x in range(W_) if m.is_walk(x, y) and (x, y) not in reach]

def emp_floor(f):
    used = set(RUB) | set(CRK) | MANA | DUST | POOL
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    vals = []
    span = 40 if f < 2 else 32
    for y0 in range(0, H_ - 15 + 1):
        for x0 in range(OX[f], OX[f] + span - 20 + 1):
            e = sum(1 for y in range(y0, y0 + 15) for x in range(x0, x0 + 20) if m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked)
            vals.append((round(e / 300.0, 3), (x0 - OX[f], y0)))
    vals.sort(reverse=True)
    return dict(max=vals[0][0], at_local=vals[0][1], over40=sum(1 for v in vals if v[0] > .4), windows=len(vals))
EMPF = {f: emp_floor(f) for f in range(3)}
FIN = (OX[2] + 15, 13)
data = m.export(OUT, ENT, FIN, {}, extra=dict(kind='final-tower', emptiness_by_floor=EMPF,
               floors={'하부 잔해 더미 층': [OX[0], OX[0] + 39], '중간 기계·뼈 층': [OX[1], OX[1] + 39], '최상부 핵 방': [OX[2], OX[2] + 31]},
               level_links=[[list(a), list(b)] for a, b in LINKS], waypoints_with_links=wp_res,
               reach_all_with_links=len(reach), walkable_cells=walk_total, unreached_cells=len(unreached), void_cells=len(m.void)))
print('walk', walk_total, 'reached', len(reach), 'unreached', len(unreached), unreached[:20])
print('wp', {k: (v['reach'], v['steps']) for k, v in wp_res.items() if not v['reach']} or 'all reached', 'final steps', wp_res['제단 앞(계단)']['steps'])
print('empty', EMPF)
print('parts', kit.save())
