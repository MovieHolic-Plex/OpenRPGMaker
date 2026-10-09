# 버들항 장르 웨이브 6 — 시계탑 내부 던전(clockwork-tower, 장르 steampunk). 다시 돌리면 같은 그림이 나온다.
#   python3 make_clockwork_tower.py  → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png, check-autotile.png
# 「장소 팩」 전용(공용 시트에 굽지 않는다): 이 폴더 하나로 닫힌다 — 바닥 표본 5·벽 앞면 3·천장·오토타일 5·물체·벽 장식·바닥 장식.
# 재질은 machine-factory(mf_kit → future-ruins 기계 재질 규약)를 읽기만 하고 ck_base 에서 벽돌·녹청·참나무 램프를 더한다.
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from ck_base import *
from ck_base import _hash
import ck_props1 as P1, ck_props2 as P2, ck_props3 as P3, ck_auto as AU
from gc_ext import autotile_mask, atile_img
assert OUT.endswith('clockwork-tower')

kit = Kit('clockwork-tower', '시계탑 내부 던전')
S = {}; SOFT = set()
def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img
FWALL = '벽 앞면 장식(앞면 3줄 필요) — 막힘 계산과 상관없다.'
FLOORD = '바닥 장식(걷기, 사람 아래).'

# ---------------------------------------------------------------- 바닥 표본 · 벽 · 천장 (맨 바탕 — 맵을 칠하는 첫 단계)
def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower', role='terrain')
ground('gear-deck', 'ck_deck', '톱니 바닥판', '24×16 검은 무쇠 리벳 판(줄마다 반장 엇갈림)을 놋쇠 이음 띠로 묶고, 판 몇 장에 새긴 톱니 장미 무늬, 모서리 놋쇠 리벳 3×3 표본.',
       '기계실·톱니 대전당 바닥 전부. 사람이 다니는 길은 ground-gear-deck-worn 을 칸 단위로 섞는다(같은 줄눈).')
ground('gear-deck-worn', 'ck_deck_worn', '닳은 톱니 바닥판', '같은 리벳 판, 놋쇠 이음이 닳아 밝고 판 가운데가 반들반들, 기름 얼룩이 넓다 3×3 표본.',
       '문과 문, 계단과 기계 사이 통로 칸(길). 톱니 바닥판과 칸 경계 그대로 섞어 길을 낸다.')
ground('oak-plank', 'ck_plank', '참나무 널 바닥', '기름 먹인 짙은 참나무 가로 널(폭 8px, 길이 24·48 엇갈림), 결 줄, 널 끝 놋쇠 못 머리 3×3 표본.',
       '꼭대기 문자판 방·종 방·작업실 바닥. 기계 둘레 1~2칸은 톱니 바닥판으로 바꾼다.')
ground('brick-floor', 'ck_brick', '벽돌 바구니 짜임 바닥', '붉은 갈색 벽돌 둘씩 가로·세로로 번갈아 눕힌 바구니 짜임, 회색 모르타르 줄눈 3×3 표본.',
       '탑 1층 현관·창고 바닥. 현관에서 안쪽 문까지 길은 같은 벽돌에 autotile-rust-puddle·brass-dust 덩이를 드물게.')
ground('brass-grating', 'ck_grate', '놋쇠 격자 통로', '1px 놋쇠 띠 가로(빛 받은 윗변)·무쇠 세로 띠 4px 간격, 틈 사이로 아래 어둠과 흐린 톱니 줄, 16px 마다 받침 보 3×3 표본.',
       '톱니 구덩이(autotile-gear-pit)를 건너는 통로 칸. 통로 양옆 한 줄은 autotile-brass-rail.')
kit.add('face-brick-3h', face_sample('ck_brick', 3, 3), 'wall', '벽돌 벽 앞면(3줄)', '반장 쌓기 붉은 벽돌 벽, 위 놋쇠 갓 몰딩 띠, 아래 참나무 징두리 판(놋쇠 못 줄)·그을음 줄 3칸 폭 표본.',
        '현관·문자판 방 천장 밑 3줄. 바닥보다 어둡다.', 0, role='wall')
kit.add('face-copper-pipe-3h', face_sample('ck_pipe', 3, 3), 'wall', '구리관 벽 앞면(3줄)', '벽돌 벽 앞 가로 구리관(지름 8, 녹청 점, 이음 테 16px)과 가는 놋쇠 관, 무쇠 받침쇠, 칸에 따라 세로 구리관 3칸 폭 표본.',
        '보일러·관이 많은 방 천장 밑 3줄(진자 갱도·현관 한쪽).', 0, role='wall')
kit.add('face-riveted-mech-3h', face_sample('ck_mech', 3, 3), 'wall', '리벳 기계 벽 앞면(3줄)', '검은 무쇠 리벳 판(32×16 엇갈림)·놋쇠 이음 띠·아래 참나무 징두리 3칸 폭 표본.',
        '톱니 대전당 천장 밑 3줄. 큰 벽 톱니(great-gear-wall)를 이 벽에 단다.', 0, role='wall')
kit.add('ceiling-oak-beam', ceiling_sample(), 'wall', '천장(벽 윗면)', '어두운 속 + 기름 먹인 참나무 들보 두께 띠 + 놋쇠 모 앵글(리벳 점), 모서리 포함 3×3 표본.',
        '방·복도 바깥(벽 너머) 모든 칸. 방과 방 사이에는 이 천장 띠가 1줄 이상 있어야 한다.', 0, role='wall')

# ---------------------------------------------------------------- 오토타일 (땅 덩이 셋 + 구조 둘)
OS = AU.autotile_oil(); DS = AU.autotile_dust(); RS_ = AU.autotile_rust(); PS = AU.autotile_pit(); BRS = AU.rail_sheet()
kit.add('autotile-oil-slick', OS, 'autotile', '기름 번짐', '기계에서 샌 따뜻한 갈흑 기름막(얇은 곳은 밑 바닥 판이 비친다), 칸마다 다른 짧은 무지개 막, 북서쪽 테 안 호박빛 반사, 두껍게 고인 테와 젖은 반투명 띠·튄 방울 16변형.',
        '기계(톱니 기관·피스톤 펌프·기름통) 곁 바닥에 2~6칸 불규칙 덩이로(사각 채우기 금지). 걷기(사람 아래). 바닥 표본 어디에나.', 0, layer='lower', role='terrain')
kit.add('autotile-brass-dust', DS, 'autotile', '놋쇠 가루', '톱니가 갈려 쌓인 금빛 가루막과 낟알 점·작은 줄밥 더미, 가장자리로 갈수록 성긴 낟알 16변형.',
        '큰 톱니·탈진기·작업대 밑과 둘레 바닥에 2~8칸 덩이로. 걷기(사람 아래). 참나무 널·톱니 바닥판 위.', 0, layer='lower', role='terrain')
kit.add('autotile-rust-puddle', RS_, 'autotile', '녹물 덩이', '새는 구리관 밑에 고인 얕은 주황 갈색 녹물(잔물결·반사 줄), 마른 녹 테와 바깥 바닥에 번진 녹 얼룩 16변형.',
        '구리관 기둥·보일러·벽 세로 관 바로 아래 바닥에 2~5칸 덩이로. 얕은 물이라 걷기(사람 아래).', 0, layer='lower', role='terrain')
kit.add('autotile-gear-pit', PS, 'autotile', '톱니 구덩이', '바닥이 뚫린 기계 갱: 북쪽 = 놋쇠 테 + 3/4 로 보이는 벽돌 속 벽, 속 = 어둠 속 세로 굴대·가로 축·깊은 톱니 이빨 줄, 서·동·남 = 놋쇠 테 16변형.',
        '막힘(떨어짐). 바닥 위에 4~40칸 덩이로 칠하고 건너는 길은 ground-brass-grating + autotile-brass-rail. 속 칸에 pit-gears·pendulum 을 얹는다.', 0, layer='lower', role='wall')
kit.add('autotile-brass-rail', BRS, 'autotile', '놋쇠 난간', '놋쇠 손잡이 관 + 가운데 관 + 8px 마다 무쇠 기둥 + 참나무 발 막이 판, 끝·모서리 = 둥근 놋쇠 머리 기둥 16변형.',
        '톱니 구덩이 둘레·격자 통로 양옆 한 줄. 모든 변형 막힘. 통로 끝(바닥과 만나는 칸)은 비운다.', 1, layer='upper', role='fence')

# ---------------------------------------------------------------- 앵커 조각
obj('clock-dial', P1.clock_dial(), '시계 문자판 뒷면', '탑 밖 문자판을 안에서 본 둥근 호박빛 유리창: 열두 갈래 놋쇠 납대, 시 표지 열두 덩이(글자 없음), 굵은 놋쇠 테와 리벳, 가운데 굴대와 뒤집혀 보이는 검은 바늘 둘(3×3).',
    '3×3칸. ' + FWALL + ' 문자판 방 북쪽 벽 가운데 하나. 아래 바닥 2칸 앞에 clock-escapement.', 0, kind='decal')
obj('clock-dial-dim', P1.clock_dial(1, lit=False), '시계 문자판 뒷면(흐림)', '같은 문자판, 해가 들지 않는 어두운 유리(3×3).', '3×3칸. ' + FWALL + ' 다른 벽 면에 두 번째 문자판으로.', 0, kind='decal')
obj('great-gear-wall', P1.great_gear_wall(), '큰 벽 톱니', '벽에 반쯤 박힌 큰 놋쇠 톱니(바퀴살 다섯)와 맞물린 쇠 톱니·작은 놋쇠 톱니, 굴대 받침 판(4×3).',
    '4×3칸. ' + FWALL + ' 톱니 대전당 북쪽 벽, 둘이면 6칸 이상 떼고 하나는 좌우 뒤집기.', 0, kind='decal')
obj('clock-escapement', P1.escapement(), '대형 탈진기', '참나무 받침 위 무쇠 틀 기둥 둘·들보, 가운데 톱날 이빨 탈진 바퀴와 위 닻 모양 앵커, 옆 작은 톱니 둘·사슬(4×4).',
    '4×4칸, 아래 2줄 막힘(위 2줄 걷기+가림). 문자판 방 가운데, 문자판 바로 남쪽 1~2칸 띄워. 둘레 바닥에 autotile-brass-dust.', 2)
obj('pendulum', P1.pendulum(), '거대한 진자', '벽에 박은 무쇠 걸쇠 판에서 내려온 놋쇠 막대(마디 고리 둘) 끝 큰 놋쇠 추 원판(2×6).',
    '2×6칸 장식(걷기 무관). 위 1~2줄 = 톱니 구덩이 북쪽 벽 앞면, 아래 = 구덩이 속 칸. 막힘은 구덩이가 한다. pendulum-swing 과 교대 두 프레임.', 0, kind='decal')
obj('pendulum-swing', P1.pendulum(1, .2), '거대한 진자(흔들림)', '같은 진자가 오른쪽으로 기운 자리(2×6).', '2×6칸. pendulum 과 같은 자리 교대 프레임.', 0, kind='decal')
obj('great-bell', P1.great_bell(), '시계탑 큰 종', '참나무 종틀(기둥 둘·들보·버팀 사선·놋쇠 띠쇠) 아래 매달린 청동 종(가로 테 셋, 입 속 어둠, 추 끝)(3×4).',
    '3×4칸, 기둥 밑동 두 칸만 막힘(종 아래 가운데 칸은 걷기+가림). 문자판 방 서쪽, 둘레 1칸 비움. 곁에 chime-rack.', 1, block=None)
obj('winding-drum', P1.winding_drum(), '태엽 드럼', '무쇠 받침 위 누운 참나무 드럼(감긴 사슬)·양 끝 놋쇠 원판·놋쇠 크랭크 바퀴와 손잡이, 위로 풀려 나간 사슬(3×2).',
    '3×2칸, 아랫줄 막힘. 벽 앞(사슬이 벽 추 counterweights 쪽으로). 진자 갱도·문자판 방.', 1)
obj('gear-train', P1.gear_train(), '톱니 기관', '리벳 무쇠 상자 윗면에 누운 놋쇠 톱니 셋이 맞물리고 앞면에 선 톱니 둘·점검 창(4×3).',
    '4×3칸, 아래 2줄 막힘(윗면 줄 걷기+가림). 톱니 대전당 벽 앞·구덩이 곁. 둘레 바닥에 oil-slick·brass-dust 덩이.', 2)
obj('clockwork-door', P1.clockwork_door(), '태엽 장치 문(닫힘)', '무쇠 테 판 안 둥근 금고 문(톱니 고리·빗장 넷·가운데 놋쇠 바퀴), 양옆 작은 톱니가 잠금 사슬을 문다(3×3).',
    '3×3칸. ' + FWALL + ' 잠긴 문 — 아래 가운데 바닥 칸에 문 이벤트. 열리면 clockwork-gate 로 바꾼다.', 0, kind='decal')
obj('clockwork-gate', P1.clockwork_gate(), '태엽 장치 문(열림)', '벽을 뚫은 2칸 통로 양옆 놋쇠 띠 무쇠 기둥(톱니), 위 상인방 속 반 톱니, 문짝 테는 왼쪽 기둥 속으로, 바닥 문 홈(4×4).',
    '4×4칸 위층. 벽(천장 띠 1줄 + 앞면 3줄)을 뚫은 2칸 통로에 가운데 두 열을 맞춘다: 양옆 열 = 벽, 가운데 아래 2줄 = 통로(걷기), 위 2줄 = 걷기+가림.', 0, kind='walk')
obj('stair-up', P1.stair_up(), '놋쇠 난간 오름 계단', '참나무 디딤판 여섯 단(디딤 모 놋쇠 띠, 위로 갈수록 밝게)과 양옆 놋쇠 난간(기둥 머리 공)(2×3).',
    '2×3칸 걷기(맨 윗줄 = 위층 이동 칸). 북쪽 벽 앞면 바로 아래 바닥 위, 그 위 벽에 stair-well. 위층 stair-down 과 짝.', 0, kind='walk')
obj('stair-down', P1.stair_down(), '놋쇠 난간 내림 계단', '바닥에 뚫린 놋쇠 턱 구멍 안 북쪽으로 어둠 속 내려가는 참나무 디딤판, 양옆 놋쇠 난간(2×3).',
    '2×3칸 걷기(맨 윗줄 = 아래층 이동 칸). 바닥 위, 둘레 1칸 비움. 아래층 stair-up 과 짝.', 0, kind='walk')
obj('stair-well', P1.stair_well(), '벽 계단 입구', '벽돌 벽을 뚫은 놋쇠 아치 테 안으로 위층 계단이 오르고 꼭대기에 등불 빛(2×3).', '2×3칸. ' + FWALL + ' stair-up 바로 위 같은 열에만.', 0, kind='decal')
