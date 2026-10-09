# 버들항 웨이브 2 — 탑 내부·계단 던전(tower-interior). 다시 돌리면 같은 그림이 나온다.
#   python3 make_tower_interior.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png (+ ~/claude-viz 시각 페이지)
# 한 맵(100×26)에 탑의 세 층을 나란히 놓는다: 1층 홀(x0~31) · 중간층 서재/기계실(x34~65) · 꼭대기 방과 발코니(x68~99).
# 층 사이는 계단 한 쌍(직선 오름 ↔ 직선 내림, 나선 오름 ↔ 나선 내림)으로 잇는다 — 두 계단은 각 층 안에서 같은 칸 자리에 있다.
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from ti_kit import *
from ti_kit import _hash
import ti_art1 as A1, ti_art2 as A2, ti_art3 as A3
import dcheck
assert OUT.endswith('tower-interior')

kit = Kit('tower-interior', '탑 내부·계단 던전')
S = {}
SOFT = set()
def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img

# ---------------------------------------------------------------- 조각 등록 (새로 그린 것만)
# 1층 홀
obj('stair_straight_up', A1.stair_straight_up(), '직선 석조 오름 계단', '양옆 낮은 난간벽 사이로 북쪽을 향해 오르는 마름돌 계단 8단(4×4). 위로 갈수록 밟판이 밝아 오르는 방향이 읽힌다.', '4×4칸, 가운데 2열 걷기(맨 윗줄 = 위층 이동 칸), 양옆 난간 열 막힘. 방 북쪽 벽 앞면 바로 아래 바닥 위에 놓고, 그 위 벽 앞면에 stair_arch_up 을 붙인다. 계단 앞 2칸은 비우고 카펫을 계단 밑에서 끝낸다. 위층에는 같은 칸 자리에 stair_straight_down.', brows=0, kind='walk')
obj('stair_arch_up', A1.stair_arch_up(), '계단 아치(벽 앞면)', '벽 앞면에 뚫린 넓은 아치 안으로 계단 끝이 어둠 속으로 이어진다(4×3).', '4×3칸 장식(앞면 위, 앞면 3줄 필요). stair_straight_up 바로 위 벽 앞면에 같은 열로 붙인다. 계단 없이 쓰지 않는다.', brows=0, kind='decal')
obj('stair_straight_down', A1.stair_straight_down(), '직선 석조 내림 계단', '바닥에 뚫린 계단 구멍 — 양옆 낮은 난간벽, 남쪽 입구, 북쪽으로 내려갈수록 어둠에 잠기는 8단(4×4).', '4×4칸, 가운데 2열 걷기(맨 아랫줄 = 도착·출발 칸), 양옆 난간 열 막힘. 바닥 위, 북쪽 벽 앞면 아래에 둔다. 아래층의 stair_straight_up 과 같은 칸 자리에 짝으로.', brows=0, kind='walk')
obj('arch_window_tall', A1.arch_window_tall(), '높은 아치 창', '마름돌 틀·돌 문설주·납 띠의 낮 하늘 유리 창, 아래 창턱(2×3).', '2×3칸 장식(앞면 위, 앞면 3줄 필요). 홀 북쪽 벽에 3칸 이상 간격으로, 창 아래 바닥에 window_light 를 같은 열에서 시작해 얹는다.', brows=0, kind='decal')
obj('window_light', A1.window_light(), '창빛 무늬', '창에서 들어와 남동쪽으로 비스듬히 퍼지는 엷은 빛줄기와 바닥에 떨어진 창살 십자 무늬(3×5, 반투명).', '3×5칸 바닥 장식(걷기, 반투명). 왼쪽 열을 arch_window_tall 왼쪽 열에 맞추고 창 바로 아래 줄에서 시작한다. 소품 밑에 깔리며 카펫 위에 겹쳐도 된다.', brows=0, kind='decal')
obj('pillar_grey', A1.pillar_grey(), '홀 둥근 기둥', '둥근 머리판 윗면·홈 새긴 원통·두 단 받침의 밝은 회색 기둥(1×3).', '1×3칸, 아랫줄만 막힘(위 2줄은 걷기+가림). 카펫 양옆에 좌우 대칭 열로, 세로 간격 4칸. 카펫과 2칸 이상 띄운다.', soft=True)
obj('knight_statue', A1.knight_statue(), '기사 석상', '네모 받침 위 칼끝을 짚고 방패를 든 돌 기사(2×3).', '2×3칸, 받침 줄(아래 1줄 2칸)만 막힘. 계단·문 양옆에 쌍으로 마주 보게. 방 가운데 단독 금지.', soft=True)
obj('brazier_iron', A1.brazier_iron(), '쇠 화로', '세 다리 쇠 받침의 둥근 그릇에서 타오르는 불(1×2).', '1×2칸, 아랫줄만 막힘. 입구·계단 양옆에 쌍으로. 빛무리와 함께.', soft=True)
obj('wall_sconce', A1.wall_sconce(), '벽 촛대', '쇠 받침 팔과 접시 위 굵은 초(1×1).', '1칸 장식(앞면 위, 가운데 줄). 벽 앞면에 4~6칸 간격, 창·깃발 사이에. 빛무리와 함께.', brows=0, kind='decal')
obj('doormat_slate', A1.doormat_slate(), '입구 깔개', '금실 테두리 슬레이트 보라 깔개(2×1).', '2×1칸 바닥 장식(걷기). 맵 출입구 칸 바로 안쪽, 카펫 끝에.', brows=0, kind='decal')
obj('locked_door', A1.locked_door(), '잠긴 문', '벽 앞면 속 아치 문틀, 쇠띠 두른 나무 쌍여닫이에 금 자물쇠와 X자 쇠사슬(2×3).', '2×3칸. 앞면 3줄을 뚫은 2칸 폭 통로 자리에 놓는다(통로 칸은 바닥). 아랫줄 2칸 막힘 — 열쇠 이벤트로 연다. 문 앞 1칸은 비우고 함정·소품을 두지 않는다.', brows=1, kind='object')
obj('trap_plate', A1.trap_plate(), '압력판', '살짝 꺼진 네모 판 둘레 홈과 쇠 테(1×1).', '1칸 바닥 장식(걷기, 함정 이벤트). 통로에 2~3개를 어긋나게, 가시 함정과 섞는다. 문 앞·계단 칸 금지.', brows=0, kind='decal')
obj('trap_spikes', A1.trap_spikes(), '가시 함정', '구멍에서 솟은 쇠 가시 여덟(1×1).', '1칸 바닥 장식(걷기, 피해는 이벤트). 한 줄 일렬 금지 — 체크무늬처럼 건너뛰게 2~4칸, 옆에 trap_holes.', brows=0, kind='decal')
obj('trap_holes', A1.trap_holes(), '가시 구멍', '가시가 들어간 작은 구멍들(1×1).', '1칸 바닥 장식(걷기). trap_spikes 앞뒤 칸에 섞어 함정 범위를 암시한다.', brows=0, kind='decal')
obj('stone_bench', A1.stone_bench(), '돌 벤치', '두 다리 받침 위 두꺼운 마름돌 좌판(2×1).', '2×1칸, 막힘 1줄. 홀 옆벽을 따라 기둥 사이에, 마주 보는 쌍으로. 카펫 옆 칸 금지.')
obj('treasure_chest', A1.treasure_chest(), '보물 상자', '둥근 나무 뚜껑·쇠띠·금 자물쇠(1×1).', '1칸, 막힘 1줄. 보물실 벽가에 2~3개 덩이로. 문 앞 금지.')
obj('weapon_rack_grey', A1.weapon_rack_grey(), '무기 걸이', '창 셋·검 둘과 푸른 방패를 건 나무 틀(2×2).', '2×2칸, 아래 2줄 막힘. 경비실 북쪽 벽 앞면 바로 아래에.', brows=2)
obj('guard_table', A1.guard_table(), '경비 탁자', '잔·빵·주사위가 놓인 널 탁자와 둥근 의자 둘(2×2).', '2×2칸, 아래 2줄 막힘(의자 줄 포함). 경비실 가운데, 둘레 한 칸 비움.', brows=2)
obj('armor_steel', A1.armor_steel(), '판금 갑옷 장식', '받침 위 은빛 갑옷, 푸른 깃·허리띠, 앞에 짚은 검(1×2).', '1×2칸, 아랫줄만 막힘. 경비실·보물실 문 곁에 하나씩 또는 마주 보는 쌍.', soft=True)
# 중간층 서재
obj('bookcase_tall', A2.bookcase_tall(), '큰 책장', '윗면 갓판과 선반 4단의 빛깔 책등, 아래 서랍 띠의 키 큰 책장(2×3).', '2×3칸, 아랫줄 2칸만 막힘(위 2줄은 걷기+가림). 북쪽 벽 앞면에 등을 붙여 2~3개씩 잇되 창이나 촛대로 끊는다.', soft=True)
obj('bookcase_low', A2.bookcase_low(), '낮은 책장', '윗면에 눕힌 책·펼친 책, 앞면 선반 2단(2×2).', '2×2칸, 아래 2줄 막힘. 서재 가운데에 두세 개를 어긋나게(일렬 금지) 놓아 통로 2칸을 남긴다.', brows=2)
obj('reading_desk', A2.reading_desk(), '독서 책상', '펼친 책·잉크병과 깃펜·작은 촛대가 놓인 서랍 책상과 의자(2×2).', '2×2칸, 아래 2줄 막힘. 창 아래·책장 앞 빈자리에 1~2개, 의자 쪽(남)은 통로를 둔다.', brows=2)
obj('lectern', A2.lectern(), '독서대', '기울어진 판 위 펼친 두꺼운 책과 붉은 책갈피(1×2).', '1×2칸, 아랫줄만 막힘. 서재 구석·제단 곁에 하나.', soft=True)
obj('candle_stand', A2.candle_stand(), '세 갈래 촛대', '바닥에 세우는 쇠 촛대와 초 셋(1×2).', '1×2칸, 아랫줄만 막힘. 책상·독서대 곁, 방 모서리에. 빛무리와 함께.', soft=True)
obj('book_pile', A2.book_pile(), '책 더미', '엇갈려 쌓은 책 다섯 권(1×1).', '1칸 바닥 장식(걷기). 책장·책상 발치에 1~2개, 통로 한가운데 금지.', brows=0, kind='decal')
obj('scroll_rack', A2.scroll_rack(), '두루마리 선반', '마름모 칸마다 말린 두루마리를 꽂은 나무 선반(2×2).', '2×2칸, 아래 2줄 막힘. 서재 벽가에 하나.', brows=2)
obj('library_ladder', A2.library_ladder(), '책장 사다리', '책장 앞에 기대 세운 나무 사다리(1×3).', '1×3칸 위층 장식(걷기+가림). bookcase_tall 의 한 칸에 겹쳐 세운다. 단독 금지.', brows=0, kind='decal')
# 중간층 기계실
obj('wall_gear', A2.wall_gear(), '벽 톱니바퀴', '벽에 박은 큰 놋쇠 톱니와 맞물린 작은 쇠 톱니, 받침대(3×3).', '3×3칸 장식(앞면 위, 앞면 3줄 필요). 기계실 북쪽 벽 가운데, 아래 바닥에 clock_engine 이나 winch 를 둔다.', brows=0, kind='decal')
obj('clock_engine', A2.clock_engine(), '시계 톱니 기계', '쇠 틀 윗면에 누운 놋쇠 톱니 셋이 맞물리고 앞면에 추·피스톤(3×3).', '3×3칸, 아래 2줄 막힘(맨 윗줄 걷기+가림). 기계실 한가운데 앵커로 하나, 둘레 한 칸씩 비운다.', brows=2)
obj('floor_gear', A2.floor_gear(), '바닥 톱니판', '바닥 틈에 반쯤 묻혀 도는 누운 큰 톱니(2×2).', '2×2칸, 전체 막힘(틈에 끼면 다친다). 기계 곁에 1~2개, 통로를 막지 않게.', brows=2)
obj('lever_post', A2.lever_post(), '레버 받침', '돌 받침 위 붉은 손잡이 쇠 레버와 놋쇠 눈금 판(1×2).', '1×2칸, 아랫줄만 막힘(조사 이벤트). 기계 앞·벽가에 하나.', soft=True)
obj('winch', A2.winch(), '쇠사슬 도르래', '나무 틀 두 기둥 사이 사슬 북과 손잡이 바퀴, 위로 오르는 사슬(2×2).', '2×2칸, 아래 2줄 막힘. 벽가·계단 곁에.', brows=2)
obj('steam_pipe', A2.steam_pipe(), '증기관', '바닥을 따라가는 굵은 놋쇠 관과 바퀴 밸브·압력계(3×1).', '3×1칸, 막힘 1줄. 벽 앞면 아래 줄을 따라 놓아 기계와 잇는다. 통로를 가로지르지 않는다.')
obj('gear_crate', A2.gear_crate(), '톱니 상자', '예비 톱니가 쌓인 뚜껑 열린 나무 상자(1×1).', '1칸, 막힘 1줄. 기계실 구석에 1~3개 덩이로.')
obj('counterweight', A2.counterweight(), '시계 추', '천장에서 내려온 사슬 끝 쇠 추와 놋쇠 원판(1×3).', '1×3칸 장식(앞면 위, 앞면 3줄 필요). wall_gear 곁 벽 앞면에.', brows=0, kind='decal')
# 꼭대기 방
obj('spiral_stair_up', A3.spiral_stair_up(), '나선 오름 계단', '둥근 낮은 벽 안 가운데 기둥을 돌아 오르는 쐐기 계단 10단, 마지막 단은 위층 바닥 턱 밑으로 사라진다(3×3).', '3×3칸. 아래 가운데 칸(입구)만 걷기 = 위층 이동 칸, 나머지 막힘. 방 모서리 바닥 위, 입구(남) 앞 1칸 비움. 위층 같은 칸 자리에 spiral_stair_down.', brows=3, kind='walk')
obj('spiral_stair_down', A3.spiral_stair_down(), '나선 내림 계단', '둥근 구멍 둘레 낮은 벽, 가운데 기둥을 돌아 어둠으로 내려가는 쐐기 계단(3×3).', '3×3칸. 아래 가운데 칸(입구)만 걷기 = 아래층 이동 칸, 나머지 막힘. 아래층 spiral_stair_up 과 같은 칸 자리에 짝으로.', brows=3, kind='walk')
obj('altar_summit', A3.altar_summit(), '꼭대기 제단', '금테 푸른 천을 드리운 마름돌 제단과 은 그릇, 양 끝 굵은 초(3×2).', '3×2칸, 아래 2줄 막힘. 꼭대기 방 북쪽 벽(장미창) 바로 아래 가운데. 앞 2칸 비움.', brows=2)
obj('crystal_pedestal', A3.crystal_pedestal(), '수정구 받침', '홈 새긴 돌기둥 위 금 발톱에 얹은 빛나는 푸른 수정구(1×2).', '1×2칸, 아랫줄만 막힘. rune_ring 한가운데 하나. 푸른 빛무리와 함께.', soft=True)
obj('rose_window', A3.rose_window(), '장미창', '둥근 마름돌 틀 속 여덟 갈래 돌살과 푸른·금·붉은 빛 유리(3×3).', '3×3칸 장식(앞면 위, 앞면 3줄 필요). 꼭대기 방 북쪽 벽 가운데 하나.', brows=0, kind='decal')
obj('balcony_arch', A3.balcony_arch(), '발코니 아치', '탑 바깥벽에 뚫린 넓은 아치 문 — 윗줄은 벽 윗면 띠(4×3).', '4×3칸, 걷기(윗줄은 걷기+가림). 방과 발코니 사이 벽(윗면 1줄 + 앞면 2줄)을 4칸 폭으로 뚫은 자리에 놓는다.', brows=0, kind='walk')
obj('rune_ring', A3.rune_ring(), '마법 고리', '바닥에 박은 금 두 겹 원과 여덟 푸른 보석, 엇갈린 사각 둘(3×3, 글자 없음).', '3×3칸 바닥 장식(걷기). 꼭대기 방 한가운데, 가운데 칸에 crystal_pedestal.', brows=0, kind='decal')
obj('crystal_cluster', A3.crystal_cluster(), '마력 수정 무리', '바닥 틈에서 솟은 푸른 수정 기둥 셋(1×2).', '1×2칸, 아랫줄만 막힘. 꼭대기 방 모서리에 1~2개, 덩이로.', soft=True)
obj('floor_candles', A3.floor_candles(), '바닥 초 무리', '높이가 다른 굵은 초 셋과 녹아내린 촛농(1×1).', '1칸 바닥 장식(걷기). 마법 고리·제단 둘레에 대각으로 4개, 통로 한가운데 금지. 빛무리와 함께.', brows=0, kind='decal')
obj('astral_table', A3.astral_table(), '별 관측 탁자', '짙은 나무 탁자 위 놋쇠 궤도 셋의 천구 모형과 펼친 별 지도(2×2).', '2×2칸, 아래 2줄 막힘. 꼭대기 방·천문실 벽가에 하나, 둘레 한 칸 비움.', brows=2)
obj('stone_urn', A3.stone_urn(), '돌 항아리 고사리', '둥근 돌 항아리에 늘어진 고사리(1×2).', '1×2칸, 아랫줄만 막힘. 홀 모서리·계단참 곁에 쌍으로. 창 아래에 두면 좋다.', soft=True)
obj('armchair', A3.armchair(), '안락의자', '슬레이트 보라 천 등받이·나무 팔걸이 의자(1×1).', '1칸, 막힘 1줄. 서재 책장 앞·독서대 곁에 하나씩. 통로 막지 않게.')
obj('planter_box', A3.planter_box(), '돌 화분', '네모 돌 화분에 풀 포기와 흰·노란 꽃(2×1).', '2×1칸, 막힘 1줄. 발코니 난간 안쪽, 모서리에.')

def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower')
ground('tower-flag', 'tw_flag', '탑 판석', '밝은 회색 24×16 마름돌을 반장씩 어긋나게 깐 판석(줄눈·점·잔금) 3×3 표본.', '탑 복도·곁방·발코니 기본 바닥. 3×3 이어 붙여도 이음새가 없다.')
ground('hall-tile', 'tw_hall', '홀 마름모 상감 바닥', '두 톤 정사각 마름돌 바둑판, 모서리마다 슬레이트 보라 마름모 상감 3×3 표본.', '1층 홀처럼 넓은 격식 있는 방. 카펫과 함께.')
ground('summit-mosaic', 'tw_mosaic', '꼭대기 방 모자이크', '잔 마름돌에 금빛 줄눈과 금 점이 박힌 따뜻한 회색 바닥 3×3 표본.', '꼭대기 방·제단실.')
ground('iron-plate', 'tw_iron', '기계실 쇠판', '리벳 박은 쇠판과 미끄럼 방지 돌기, 기름 얼룩 3×3 표본.', '기계실·톱니 기계 둘레.')
kit.add('face_tower_3h', face_sample('tower', 3, 3), 'wall', '탑 벽 앞면(3줄)', '버들항 성 마름돌을 두 단 어둡게 한 쌓은 돌 벽 앞면과 아래 걸레받이 띠, 3칸 폭 표본.', '방 천장 밑에 3줄. 모든 방 북쪽 벽에 필수. 바닥보다 어둡다.', 0, role='wall')
kit.add('face_tower_2h', face_sample('tower', 3, 2), 'wall', '탑 벽 앞면(2줄)', '같은 돌, 2줄 높이(복도·발코니 바깥벽).', '복도 천장 밑, 발코니에서 본 바깥벽에 2줄.', 0, role='wall')
kit.add('ceiling_tower', ceiling_sample(), 'wall', '탑 천장', '어두운 천장 + 밝은 회색 벽 윗면 띠, 모서리 포함 3×3 표본.', '방·복도 바깥(벽 너머). 열린 칸에 닿은 쪽만 밝은 띠.', 0, role='wall')
kit.add('ledge_balcony', A3.ledge_sample(), 'wall', '발코니 턱과 하늘', '발코니 판 앞면(마름돌 띠 + 까치발 돌) 아래로 구름 낀 하늘, 3×3 표본.', '발코니 바닥 남쪽 끝 바로 아래 줄에 턱, 그 아래·옆은 하늘(막힘).', 0, role='wall')
CS = A3.carpet_sheet(); BS = A3.balustrade_sheet(); PS = A3.pit_sheet()
kit.add('autotile-carpet-slate', CS, 'autotile', '슬레이트 보라 카펫', '금실 테두리·안쪽 짙은 띠·작은 금 마름모의 슬레이트 보라 카펫 16변형(위 1·오른쪽 2·아래 4·왼쪽 8). 끝은 술.', '폭 2칸 직선으로 입구에서 계단·제단까지. 걷기. 계단·제단 앞 한 칸에서 끝낸다.', 0, layer='lower', role='terrain')
kit.add('autotile-balustrade', BS, 'autotile', '돌 난간', '갓돌 윗면 + 항아리 모양 난간동자, 끝·모서리 네모 기둥 16변형.', '발코니·계단참 가장자리를 두른다. 모든 변형 막힘. 출입 틈은 아치 쪽에만.', 1, layer='upper', role='fence')
kit.add('autotile-pit', PS, 'autotile', '함정 구덩이', '바닥이 꺼진 어두운 구멍 — 북쪽 가장자리에 안벽 앞면, 남쪽에 바닥 턱 16변형.', '함정 통로 한가운데 2×2~3×2, 양옆에 1칸 이상 지나갈 길을 남긴다. 모든 변형 막힘.', 1, layer='lower', role='terrain')

BANNER = RM.banner_hanging('shroom', 26)      # 버들항 원본 깃발(다시 내보내지 않음)

# ---------------------------------------------------------------- 지도
W_, H_ = 100, 26
OX = (0, 34, 68)
class TMap(KMap):
    def __init__(s, *a):
        super().__init__(*a); s.sky = set(); s.outer = set(); s.lights = []; s.pits = set()
    def compute_faces(s):
        super().compute_faces()
        for (x, y, k, n) in s.outer: s.face[(x, y)] = ('tower', k, n)
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if s.fl[y][x]:
                    im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), P)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(dlib.face_tile(sty, None, n - k, int(_hash(x, y, 3) * 6), capL, capR, n * T), P)
                elif (x, y) in s.sky:
                    t = new()
                    for yy in range(T):
                        for xx in range(T):
                            X = x * T + xx; Y = y * T + yy
                            c = None
                            if s.inb(x, y - 1) and s.fl[y - 1][x] and (x, y - 1) not in s.sky: c = A3.ledge_px(X, yy)
                            if c is None: c = A3.sky_px(X, Y)
                            t.putpixel((xx, yy), tuple(c) + (255,))
                    im.alpha_composite(t, P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face or (xx, yy) in s.sky)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(dlib.ceiling(o8, int(_hash(x, y, 4) * 4), False), P)
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for (px_, py_, img) in s.lights: im.alpha_composite(img, (int(px_), int(py_)))
        for cells, sheet in s.over:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

m = TMap(W_, H_, 'tower-interior')
BAD = []
def R(f, x0, y0, x1, y1, kind, wh=3):
    """층 f 의 지역 칸 좌표로 바닥 사각형을 연다(x1·y1 포함)."""
    m.floor(OX[f] + x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, 'tower')
def CUT(f, x0, y0, w=1, h=1): m.cut(OX[f] + x0, y0, w, h)

def P(name, f, x, y, block=None, layer=1, check=True):
    """조각을 층 f 의 지역 칸 (x, y)(= 왼쪽 아래 칸)에 놓는다. block 이 없으면 메타의 brows 로 발자국을 잰다."""
    img = S[name]; X = OX[f] + x
    br = kit.meta[name]['brows']
    if block is None:
        block = [] if br == 0 else foot(img, br, 10, name in SOFT)
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
def FD(name, f, x, y):
    m.decal(OX[f] + x, y, S[name])
def LIGHT(f, x, y, img, dx=0):
    """창빛을 바닥 칸 안으로만 잘라 얹는다(벽·천장 위에 빛이 번지지 않게). dx = 픽셀 단위 가로 밀기."""
    X0 = (OX[f] + x) * T + dx; o = img.copy(); p = o.load()
    for yy in range(o.height):
        for xx in range(o.width):
            cx_, cy_ = (X0 + xx) // T, y + yy // T
            if not (m.inb(cx_, cy_) and m.fl[cy_][cx_] is not None): p[xx, yy] = (0, 0, 0, 0)
    m.lights.append((X0, y * T, o))
def glowc(f, cx, cy, col=(255, 170, 90), size=56, a=60): m.glow_at(OX[f] + cx + .5, cy + .5, glow(size, col, a))
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]

# ======== 1층 홀 (f=0) ========
R(0, 11, 6, 20, 16, 'tw_hall')                      # 큰 홀(10×11)
for (x, y) in ((11, 16), (20, 16)): CUT(0, x, y)
R(0, 14, 17, 17, 20, 'tw_flag'); R(0, 15, 21, 16, 21, 'tw_flag', 1)   # 현관과 남쪽 출입구(아래 틈 = 밖으로 나가는 칸)
R(0, 3, 9, 8, 16, 'tw_flag'); R(0, 9, 13, 10, 14, 'tw_flag', 2)     # 서쪽 경비실 + 문 없는 통로
CUT(0, 3, 16); CUT(0, 8, 9)
R(0, 23, 10, 28, 19, 'tw_flag'); R(0, 21, 13, 22, 14, 'tw_flag', 2) # 동쪽 함정 회랑 + 통로
CUT(0, 28, 19); CUT(0, 23, 19); CUT(0, 23, 10)
R(0, 24, 2, 28, 5, 'tw_flag', 2); R(0, 25, 6, 26, 9, 'tw_flag', 1)  # 보물실(잠긴 문 너머)과 문 통로
CUT(0, 24, 2); CUT(0, 28, 2)

# ======== 중간층 (f=1) ========
R(1, 12, 6, 19, 11, 'tw_flag')                      # 계단참(아래층 계단 도착)
R(1, 3, 6, 9, 18, 'plank')                          # 서재(7×13)
CUT(1, 3, 18)
R(1, 22, 6, 28, 18, 'tw_iron')                      # 기계실(7×13)
CUT(1, 28, 18)
R(1, 10, 9, 11, 10, 'tw_flag', 2); R(1, 20, 9, 21, 10, 'tw_flag', 2)   # 계단참 ↔ 서재·기계실 통로
R(1, 10, 16, 21, 18, 'tw_flag', 3)                  # 남쪽 회랑(서재 ↔ 기계실, 고리 동선)

# ======== 꼭대기 (f=2) ========
R(2, 6, 6, 24, 14, 'tw_mosaic')                     # 꼭대기 방(19×9, 북서 모서리를 깎는다)
for (x, y, w, h) in ((6, 6, 2, 1), (6, 7, 1, 1)): CUT(2, x, y, w, h)
R(2, 11, 18, 19, 20, 'tw_flag', 2)                  # 발코니
R(2, 14, 15, 16, 17, 'tw_mosaic', 2)                # 발코니 아치 통로
# 꼭대기 층은 탑 꼭대기: 방·발코니를 두른 벽 윗면 띠(1~2칸) 바깥은 모두 하늘. 탑 바깥벽(앞면 2줄 y16~17, x5~25)은 발코니에서 본 벽.
for y in range(15, H_):
    for x in range(OX[2], OX[2] + 32):
        lx = x - OX[2]
        if m.fl[y][x] is None and y in (16, 17) and 5 <= lx <= 25: m.outer.add((x, y, y - 15, 2))
m.compute_faces()
_solid = {(x, y) for y in range(H_) for x in range(OX[2], OX[2] + 32) if m.fl[y][x] is not None or (x, y) in m.face}
for y in range(H_):
    for x in range(OX[2] - 1, OX[2] + 33):
        if not m.inb(x, y) or m.fl[y][x] is not None or (x, y) in m.face: continue
        near = any((x + dx, y + dy) in _solid for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if y >= 18 or not near: m.sky.add((x, y))
m.compute_faces()

# ---------------- 1층 소품
carpet = {(OX[0] + x, y) for x in (15, 16) for y in range(10, 21)}
m.under.append((carpet, CS))
STAIR_BLK = [(0, 0), (0, -1), (0, -2), (0, -3), (3, 0), (3, -1), (3, -2), (3, -3)]
P('stair_straight_up', 0, 14, 9, block=STAIR_BLK)
DEC('stair_arch_up', 0, 14, 3)
WL_FLIP = S['window_light'].transpose(Image.FLIP_LEFT_RIGHT)
for x in (11, 19): DEC('arch_window_tall', 0, x, 3)
LIGHT(0, 11, 7, S['window_light']); LIGHT(0, 17, 7, WL_FLIP, dx=-4)          # 두 창빛이 카펫 쪽으로 모인다(좌우 대칭)
for x in (13, 18): m.decal(OX[0] + x + .12, 3.12, BANNER)
for (x, y) in ((13, 12), (18, 12), (13, 16), (18, 16)): P('pillar_grey', 0, x, y)
P('knight_statue', 0, 12, 9); P('knight_statue', 0, 18, 9)
for (x, y) in ((14, 19), (17, 19)): P('brazier_iron', 0, x, y); glowc(0, x, y - 1)
FD('doormat_slate', 0, 15, 21)
for (x, y) in ((11, 12), (20, 12)): P('armor_steel', 0, x, y)
for (x, y) in ((11, 7), (20, 7)): P('candle_stand', 0, x, y); glowc(0, x, y - 1)
for (x, y) in ((14, 17), (17, 17), (11, 15), (20, 15)): P('stone_urn', 0, x, y)

# 서쪽 경비실
P('weapon_rack_grey', 0, 3, 10, block=BX(2, 2)); DEC('wall_sconce', 0, 6, 7); glowc(0, 6, 7, size=40, a=50)
P('guard_table', 0, 4, 14, block=BX(2, 2))
P('armor_steel', 0, 7, 11); P('brazier_iron', 0, 8, 16)
P('treasure_chest', 0, 3, 15)
FD('book_pile', 0, 7, 15)
# 동쪽 함정 회랑과 보물실
pit = {(OX[0] + x, y) for x in (25, 26, 27) for y in (13, 14)}
m.under.append((pit, PS)); m.pits |= pit
for c in pit: m.blocked.add(c)
for (n, x, y) in (('trap_spikes', 24, 17), ('trap_holes', 25, 17), ('trap_spikes', 26, 18), ('trap_holes', 27, 18), ('trap_spikes', 28, 17),
                  ('trap_plate', 24, 11), ('trap_plate', 28, 12), ('trap_holes', 28, 15), ('trap_spikes', 24, 15), ('trap_plate', 26, 16), ('trap_holes', 23, 12), ('trap_spikes', 23, 18)): FD(n, 0, x, y)
P('locked_door', 0, 25, 9, block=[(0, 0), (1, 0)], check=False)
m.hidden |= {(OX[0] + 25, 9), (OX[0] + 26, 9)}                         # 열쇠로 여는 문: 통행 검사에서는 열린 것으로 본다
for x in (24, 28): DEC('wall_sconce', 0, x, 8); glowc(0, x, 8, size=40, a=50)
for (x, y) in ((24, 3), (28, 3), (27, 5)): P('treasure_chest', 0, x, y)
P('crystal_cluster', 0, 24, 5); glowc(0, 24, 4, (120, 170, 255), 48, 50)

# ---------------- 중간층 소품
P('stair_straight_down', 1, 14, 9, block=STAIR_BLK)
for x in (12, 19): DEC('wall_sconce', 1, x, 4); glowc(1, x, 4, size=40, a=50)
P('brazier_iron', 1, 12, 11); P('brazier_iron', 1, 19, 11); glowc(1, 12, 10); glowc(1, 19, 10)
P('stone_urn', 1, 12, 7); P('stone_urn', 1, 19, 7)
# 서재: 북쪽 벽 책장(창으로 끊음)·가운데 낮은 책장(어긋나게)·책상·독서대·두루마리 선반
P('bookcase_tall', 1, 3, 6, block=[(0, 0), (1, 0)])
DEC('arch_window_tall', 1, 5, 3); LIGHT(1, 5, 6, S['window_light'])
P('bookcase_tall', 1, 7, 6, block=[(0, 0), (1, 0)])
m.decal(OX[1] + 8, 4, S['library_ladder'])
P('reading_desk', 1, 5, 10, block=BX(2, 2)); P('candle_stand', 1, 7, 9); glowc(1, 7, 8)
P('bookcase_low', 1, 3, 13, block=BX(2, 2)); P('bookcase_low', 1, 7, 14, block=BX(2, 2))
P('scroll_rack', 1, 4, 17, block=BX(2, 2))
P('lectern', 1, 9, 12); P('candle_stand', 1, 3, 9); glowc(1, 3, 8); P('reading_desk', 1, 7, 18, block=BX(2, 2))
P('armchair', 1, 6, 15); P('armchair', 1, 9, 9); P('candle_stand', 1, 6, 13); glowc(1, 6, 12); FD('book_pile', 1, 3, 11)
FD('book_pile', 1, 8, 16)
for (x, y) in ((6, 12), (9, 17), (3, 15)): FD('book_pile', 1, x, y)
# 남쪽 회랑
for x in (13, 18): DEC('wall_sconce', 1, x, 14); glowc(1, x, 14, size=40, a=50)
P('armor_steel', 1, 13, 17); P('armor_steel', 1, 18, 17)
for x in (10, 20): P('stone_bench', 1, x, 18, block=[(0, 0), (1, 0)])
FD('trap_plate', 1, 15, 17); FD('trap_holes', 1, 16, 16)
# 기계실: 벽 톱니·추, 가운데 시계 기계, 바닥 톱니판, 도르래·레버·증기관·상자, 북서 모서리 나선 계단
P('spiral_stair_up', 1, 22, 8, block=[(dx, -dy) for dx in range(3) for dy in range(3) if not (dx == 1 and dy == 0)], check=False)
DEC('wall_gear', 1, 25, 3); DEC('counterweight', 1, 28, 3)
P('steam_pipe', 1, 25, 6, block=[(0, 0), (1, 0), (2, 0)])
P('clock_engine', 1, 24, 12, block=[(dx, -dy) for dx in range(3) for dy in range(2)])
P('floor_gear', 1, 22, 15, block=BX(2, 2))
P('winch', 1, 27, 9, block=BX(2, 2))
P('lever_post', 1, 27, 14); P('gear_crate', 1, 28, 17); P('gear_crate', 1, 27, 17); P('gear_crate', 1, 28, 16)
P('steam_pipe', 1, 23, 18, block=[(0, 0), (1, 0), (2, 0)])
glowc(1, 25, 13, (255, 150, 70), 72, 40)

# ---------------- 꼭대기 소품
DEC('rose_window', 2, 14, 3)
m.glow_at(OX[2] + 15.5, 6.5, glow(96, (150, 190, 255), 46))
P('altar_summit', 2, 14, 8, block=BX(3, 2))
P('spiral_stair_down', 2, 22, 8, block=[(dx, -dy) for dx in range(3) for dy in range(3) if not (dx == 1 and dy == 0)])
FD('rune_ring', 2, 14, 10); P('crystal_pedestal', 2, 15, 11); m.glow_at(OX[2] + 15.5, 10.4, glow(64, (120, 170, 255), 70))
for (x, y) in ((10, 9), (20, 9), (10, 13), (20, 13)): P('pillar_grey', 2, x, y)
for (x, y) in ((12, 8), (18, 8)): P('candle_stand', 2, x, y); glowc(2, x, y - 1)
P('astral_table', 2, 6, 9, block=BX(2, 2)); P('crystal_cluster', 2, 7, 14); P('crystal_cluster', 2, 24, 13)
for (x, y) in ((9, 8), (7, 11)): FD('book_pile', 2, x, y)
for (x, y) in ((7, 13), (24, 12)): m.glow_at(OX[2] + x + .5, y + .2, glow(40, (120, 170, 255), 40))
P('lectern', 2, 8, 11)
for (x, y) in ((13, 9), (17, 9), (13, 13), (17, 13)): FD('floor_candles', 2, x, y); glowc(2, x, y, size=32, a=50)
P('stone_urn', 2, 22, 13); P('crystal_cluster', 2, 21, 11)
m.glow_at(OX[2] + 21.5, 10.2, glow(40, (120, 170, 255), 40))
P('bookcase_tall', 2, 8, 6, block=[(0, 0), (1, 0)]); P('bookcase_tall', 2, 19, 6, block=[(0, 0), (1, 0)])
FD('book_pile', 2, 10, 7)
DEC('wall_sconce', 2, 9, 4); DEC('wall_sconce', 2, 21, 4); glowc(2, 9, 4, size=40, a=50); glowc(2, 21, 4, size=40, a=50)
P('brazier_iron', 2, 12, 14); P('brazier_iron', 2, 18, 14); glowc(2, 12, 13); glowc(2, 18, 13)
# 발코니: 아치·난간(오토타일)·화분
P('balcony_arch', 2, 14, 17, block=[])
rail = {(OX[2] + x, 20) for x in range(11, 20)} | {(OX[2] + 11, y) for y in range(18, 20)} | {(OX[2] + 19, y) for y in range(18, 20)}
m.over.append((rail, BS))
for c in rail: m.blocked.add(c)
P('planter_box', 2, 12, 18, block=[(0, 0), (1, 0)]); P('planter_box', 2, 17, 18, block=[(0, 0), (1, 0)])
if BAD: print('배치 오류', BAD)

# ---------------------------------------------------------------- 통행: 층 이동 고리를 더한 BFS
LINKS = [((OX[0] + 15, 6), (OX[1] + 15, 9)), ((OX[0] + 16, 6), (OX[1] + 16, 9)), ((OX[1] + 23, 8), (OX[2] + 23, 8))]
def bfs_all(start):
    from collections import deque
    adj = {}
    for a, b in LINKS: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = {start: 0}; q = deque([start])
    while q:
        c = q.popleft()
        nb = [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)] + adj.get(c, [])
        for n in nb:
            if n not in seen and m.is_walk(*n): seen[n] = seen[c] + 1; q.append(n)
    return seen
ENT = (OX[0] + 15, 21)
m.render()
reach = bfs_all(ENT)
WP = {'1층 입구': (0, 15, 21), '1층 홀 가운데': (0, 15, 14), '오름 계단 위': (0, 15, 6), '경비실': (0, 5, 12), '함정 회랑': (0, 26, 18), '보물실(잠긴 문 너머)': (0, 26, 4),
      '중간층 도착': (1, 15, 9), '서재 안쪽': (1, 5, 8), '서재 남쪽': (1, 6, 16), '남쪽 회랑': (1, 15, 17), '기계실': (1, 26, 15), '나선 계단 입구(중간층)': (1, 23, 8),
      '꼭대기 도착': (2, 23, 8), '제단 앞': (2, 15, 9), '수정구 곁': (2, 14, 12), '발코니': (2, 15, 19)}
wp_res = {k: dict(at=[OX[f] + x, y], floor=f, reach=(OX[f] + x, y) in reach, steps=reach.get((OX[f] + x, y))) for k, (f, x, y) in WP.items()}
hid = set(m.hidden); m.hidden = set(); reach_nohid = bfs_all(ENT); m.hidden = hid
walk_total = sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
emp = dcheck.emptiness(m)
def emp_floor(f):
    """층마다(그 층 32칸 안에서만) 20×15 창 빈 바닥 비율 — 다른 층 칸이 섞이지 않게 잘라 잰다."""
    import copy
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    vals = []
    for y0 in range(0, H_ - 15 + 1, 1):
        for x0 in range(OX[f], OX[f] + 32 - 20 + 1, 1):
            e = sum(1 for y in range(y0, y0 + 15) for x in range(x0, x0 + 20) if m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked)
            vals.append((round(e / 300.0, 3), (x0 - OX[f], y0)))
    vals.sort(reverse=True)
    return dict(max=vals[0][0], at_local=vals[0][1], over40=sum(1 for v in vals if v[0] > .4), windows=len(vals))
EMPF = {f: emp_floor(f) for f in range(3)}
print('empty by floor', EMPF)
if os.environ.get('EMPDBG'):
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    f = int(os.environ['EMPDBG'])
    for y in range(H_):
        print(''.join('.' if (m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked) else ('#' if m.fl[y][x] is not None else ' ') for x in range(OX[f], OX[f] + 32)))
FIN = (OX[2] + 15, 10)
data = m.export(OUT, ENT, (OX[0] + 15, 6), {}, extra=dict(emptiness=emp, emptiness_by_floor=EMPF, kind='tower-interior', floors={'1층 홀': [OX[0], OX[0] + 31], '중간층 서재·기계실': [OX[1], OX[1] + 31], '꼭대기 방·발코니': [OX[2], OX[2] + 31]},
                                                       stair_links=[[list(a), list(b)] for a, b in LINKS], waypoints_with_stairs=wp_res,
                                                       reach_all_with_stairs=len(reach), walkable_cells=walk_total, unreached_cells=walk_total - len(reach),
                                                       vault_reachable_without_key=(OX[0] + 26, 4) in reach_nohid))
print('walk', walk_total, 'reached', len(reach), 'unreached', walk_total - len(reach))
print('wp', {k: (v['reach'], v['steps']) for k, v in wp_res.items()})
print('empty', emp)
print('parts', kit.save())

# ---------------------------------------------------------------- 비교 시트: 같은 2배율로 [버들항 기준 | 탑 내부]
from PIL import ImageDraw, ImageFont
REF = os.path.join(OUT, '..', '..', 'beodeul-city', 'render', 'city6_base.png')
REF2 = os.path.join(OUT, '..', 'dark-fortress', 'render-1x.png')
render = m.img
_ff = [f for f in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf') if os.path.exists(f)]
_font = ImageFont.truetype(_ff[0], 14) if _ff else None
cw, ch = 208, 160
rows = [
    [('버들항 성 석재 (city6_base)', Image.open(REF).convert('RGBA').crop((0, 0, cw, ch))), ('1층 홀 계단·창', render.crop((168, 32, 168 + cw, 32 + ch))), ('1층 함정 회랑·잠긴 문', render.crop((352, 112, 352 + cw, 112 + ch)))],
    [('마왕성 알현실 (기준, 웨이브 1)', Image.open(REF2).convert('RGBA').crop((344, 64, 344 + cw, 64 + ch))), ('중간층 서재·내림 계단', render.crop((OX[1] * T + 40, 40, OX[1] * T + 40 + cw, 40 + ch))), ('중간층 기계실·나선 계단', render.crop((OX[1] * T + 330, 40, OX[1] * T + 330 + cw, 40 + ch)))],
    [('버들항 성 석재 (city6_base 계단)', Image.open(REF).convert('RGBA').crop((0, 300, cw, 300 + ch))), ('꼭대기 방 장미창·제단', render.crop((OX[2] * T + 144, 32, OX[2] * T + 144 + cw, 32 + ch))), ('꼭대기 발코니·하늘', render.crop((OX[2] * T + 136, 220, OX[2] * T + 136 + cw, 220 + ch)))],
]
sheet = Image.new('RGBA', (3 * (cw * 2 + 8) + 8, len(rows) * (ch * 2 + 26) + 4), (24, 22, 30, 255)); dr = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for i, (lab, t) in enumerate(row):
        x = 8 + i * (cw * 2 + 8); y = 4 + r * (ch * 2 + 26)
        sheet.alpha_composite(t.resize((cw * 2, ch * 2), Image.NEAREST), (x, y + 20))
        dr.text((x, y + 2), lab, fill=(230, 226, 236, 255), font=_font)
sheet.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))

# ---------------------------------------------------------------- 시각 검증 페이지(저장소 밖)
try:
    VIZ = os.path.expanduser('~/claude-viz'); os.makedirs(VIZ, exist_ok=True)
    QA = [l.strip() for l in open(os.path.join(OUT, 'qa.txt'))] if os.path.exists(os.path.join(OUT, 'qa.txt')) else ['(QA 기록은 plan.md 참고)']
    fl_t = SAMPLES['tw_flag'].crop((0, 0, 16, 16))
    shape_c = {(x, y) for x in range(2, 4) for y in range(2, 9)} | {(x, y) for x in range(4, 8) for y in range(6, 8)}
    shape_r = {(x, 6) for x in range(2, 10)} | {(2, y) for y in range(2, 6)} | {(9, y) for y in range(3, 6)}
    shape_p = {(x, y) for x in range(2, 5) for y in range(2, 4)} | {(5, 3)}
    autos = [('autotile-carpet-slate (슬레이트 카펫)', CS, SAMPLES['tw_hall'].crop((0, 0, 16, 16)), shape_c), ('autotile-balustrade (돌 난간)', BS, fl_t, shape_r), ('autotile-pit (함정 구덩이)', PS, fl_t, shape_p)]
    crops = [('1층 홀 — 계단·창빛·석상', (160, 32, 352, 224), 3), ('1층 함정 회랑·잠긴 문·보물실', (352, 0, 480, 336), 2), ('중간층 서재', (OX[1] * T + 40, 80, OX[1] * T + 168, 304), 2),
             ('중간층 기계실', (OX[1] * T + 340, 60, OX[1] * T + 480, 304), 2), ('꼭대기 방', (OX[2] * T + 90, 40, OX[2] * T + 420, 260), 2), ('발코니', (OX[2] * T + 160, 230, OX[2] * T + 340, 340), 3)]
    plan = '탑 내부 3층을 한 맵(100×26)에: 1층 홀(입구→카펫→직선 오름 계단, 서쪽 경비실, 동쪽 함정 회랑→잠긴 문→보물실) · 중간층(계단참 내림 계단, 서쪽 서재, 동쪽 기계실의 나선 오름 계단, 남쪽 회랑) · 꼭대기 방(장미창·제단·수정구, 나선 내림 계단, 남쪽 발코니와 하늘).'
    sz = gc_page.build_page(os.path.join(VIZ, 'beodeul-wave-tower-interior.html'), '버들항 웨이브 2 — 탑 내부·계단 던전', 'tower-interior', render, data['grid'], crops, kit, autos, QA, plan,
                            extra_sections=[('비교 시트 (같은 2배율)', '<img src="%s">' % png_uri(Image.open(os.path.join(OUT, 'compare-ref.png')).convert('RGBA')))])
    print('page bytes', sz)
except Exception as e:
    print('page skipped', e)
