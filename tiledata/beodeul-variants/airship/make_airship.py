# 버들항 웨이브 2 — 비행선 갑판 + 내부(airship). 다시 돌리면 같은 그림이 나온다.
#   python3 make_airship.py  → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png(이전 판 render-prev-1x.png | 새 판), check-autotile.png
# 한 맵(134×32)에 비행선의 세 층을 나란히 놓는다: 갑판과 하늘(x0~65) · 선실층(x67~99) · 기관실(x101~133).
# 층 사이는 계단·사다리 짝으로 잇는다(LINKS): 갑판실 문 ↔ 선실 오름 계단, 선실 내림 승강구 ↔ 기관실 오름 계단, 기관실 벽 사다리 ↔ 갑판 사다리 승강구.
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from as_kit import *
from as_kit import _hash
import as_env as EV, as_deck as AD, as_cabin as AC, as_engine as AE, as_auto as AU, as_bow as AB
import as_blob as BL, as_rig as RG     # 보정 패스(WAVE-BRIEF-4): 땅 덩이 오토타일 · 기낭 윗면·로프·고정부
import dcheck
from gc_map import KMap, foot
from gc_ext import autotile_mask, atile_img
assert OUT.endswith('airship')

kit = Kit('airship', '비행선 갑판 + 내부')
S = {}; SOFT = set()
def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img
SKYR = '하늘 칸 위(본디 막힘)에 놓는다 — 막힘 계산과 상관없다.'

# ---------------------------------------------------------------- 조각 등록 (새로 그린 것만)
# 기낭·하늘 구조물
obj('envelope_tail', EV.envelope_tail(), '기낭 꼬리', '서쪽으로 가늘어지는 캔버스 기낭 끝 — 길이 방향 박음질 이음이 끝으로 모이고, 위로 선 꼬리 지느러미와 남쪽(앞)으로 뻗은 수평 지느러미(나무 살, 붉은 뒷전), 바닥 그물·놋쇠 고리(8×10).',
    '8×10칸. 갑판 북쪽 난간 위 하늘(난간에서 2~3줄 위)에 바닥을 맞추고 envelope_body 왼쪽 끝에 바로 붙인다. ' + SKYR, 1)
obj('envelope_body', EV.envelope_body(), '기낭 몸통', '위에서 비스듬히 본 둥근 캔버스 천 덩이: 길이 방향 고어 이음 일곱 줄(위·아래로 촘촘), 64px 마다 불룩한 둘레 이음, 아래 짐 띠와 삼 밧줄 그물, 바닥 놋쇠 고리 넷(8×10).',
    '8×10칸, 가로로 몇 개든 이어 붙인다(128px 주기, 이음매 없음). 꼬리 + 몸통 3~5 + 코. 바닥 고리 아래 cable_drop 을 내려 난간에 잇는다. ' + SKYR, 1)
obj('envelope_body_patched', EV.envelope_body_patched(), '기낭 몸통(덧댄 천)', '같은 기낭 몸통에 누런 새 천 조각 둘을 굵은 박음질로 덧대 기운 변형(8×10).',
    '8×10칸. envelope_body 와 섞어 이을 때 한 기낭에 하나만(일렬 반복 금지). ' + SKYR, 1)
obj('envelope_nose', EV.envelope_nose(), '기낭 코', '동쪽으로 둥글게 닫히는 기낭 끝, 놋쇠 코 덮개와 계류 고리(6×10).', '6×10칸. envelope_body 오른쪽 끝에 붙인다. 이물(뱃머리) 쪽. ' + SKYR, 1)
obj('cable_drop', AD.cable_drop(), '매다는 줄', '기낭 바닥 놋쇠 고리에서 갑판 난간까지 내려오는 굵은 밧줄과 놋쇠 죔쇠(1×2).', '1×2칸 하늘 장식. 기낭 바닥 고리 바로 아래, 북쪽 난간 위 하늘 줄에 고리마다 하나씩.', 0, kind='decal')
obj('propeller_stern', AD.propeller_stern(), '선미 프로펠러', '고물에서 나온 쇠 축과 버팀대 끝 놋쇠 머리, 옆에서 보아 위아래로 길게 선 나무 날개와 도는 자국 호(3×4).', '3×4칸. 갑판 서쪽 끝(고물) 바로 바깥 하늘, 오른쪽 끝을 갑판 가장자리에 맞추고 세로 가운데를 갑판 가운데 줄보다 1~2줄 아래로. ' + SKYR, 1)
obj('wing_engine', AD.wing_engine(), '옆 날개 기관', '선체 앞면에서 남쪽으로 뻗은 짧은 캔버스 날개(놋쇠 앞전·붉은 뒷전·나무 살) 끝에 매단 놋쇠 기관통과 동쪽 프로펠러, 배기관, 쇠 버팀대(6×4).',
    '6×4칸. 윗줄을 선체 앞면 맨 윗줄에 걸치고 나머지는 남쪽 하늘. 갑판 한가운데 조금 앞(동)쪽에 하나. ' + SKYR, 1)
obj('bowsprit', AD.bowsprit(), '이물 장식 돛대', '이물 끝에서 동쪽 하늘로 비스듬히 뻗은 나무 돛대와 놋쇠 띠, 끝의 놋쇠 창끝·지느러미 장식, 버팀 밧줄(5×2).', '5×2칸. 왼쪽 아래 끝을 이물 꼭짓점 칸 바로 동쪽에 붙인다. ' + SKYR, 1)
obj('gangway', AD.gangway(), '탑승 발판', '갑판 난간 틈에서 남쪽 아래 부두로 내려가는 널 경사로 — 미끄럼막이 살, 양쪽 기둥과 늘어진 밧줄 손잡이(2×5).',
    '2×5칸 걷기. 남쪽 난간을 2칸 비운 틈 바로 아래 선체 앞면·하늘 위에 놓고(그 칸들은 걷기), 아래 끝을 부두 널(갑판 오토타일)에 닿게.', 0, kind='walk')
# 갑판 위
obj('mast_main', AD.mast_main(), '주돛대', '놋쇠 고리로 기낭 바닥에 닿는 나무 돛대 — 둥근 망대, 활대에 말아 묶은 돛, 양쪽 줄사다리, 네모 갑판 칼라(5×8).',
    '5×8칸, 밑동 가운데 1칸만 막힘(줄사다리 발치와 위 칸은 걷기+가림). 갑판 세로 가운데 줄, 꼭대기가 기낭 바닥에 닿게. 앞돛대와 15칸 이상 띄운다.', 1, soft=True)
obj('mast_fore', AD.mast_fore(), '앞돛대', '가는 나무 돛대에 작은 망대와 놋쇠 신호 등, 줄사다리 한 쌍, 갑판 칼라(3×7).', '3×7칸, 밑동 가운데 1칸만 막힘. 주돛대보다 이물 쪽, 갑판 가운데 줄.', 1, soft=True)
obj('helm_wheel', AD.helm_wheel(), '조타륜', '손잡이 여덟 달린 나무 조타 바퀴(정면)와 놋쇠 굴대, 나무 받침 기둥·받침판(2×3).', '2×3칸, 아랫줄 막힘(위 2줄 걷기+가림). 고물 갑판, 승강구 갑판실 앞(동)쪽. 앞 1칸 비움(키잡이 자리). 곁에 binnacle·voice_tube.', 1, soft=True)
obj('binnacle', AD.binnacle(), '나침함', '나무 기둥 위 놋쇠 둥근 갓과 유리 창, 양옆 쇠 공 둘(1×2).', '1×2칸, 아랫줄만 막힘. 조타륜 바로 옆(동쪽) 한 칸.', 1, soft=True)
obj('voice_tube', AD.voice_tube(), '전성관', '갑판에서 솟아 휘어진 놋쇠 관 끝 나팔 입 — 조타 자리와 기관실을 잇는 말 전하는 관(1×2).', '1×2칸, 아랫줄만 막힘. 조타륜 곁 1~2칸 안.', 1, soft=True)
obj('deckhouse', AD.deckhouse(), '승강구 갑판실', '널 지붕(놋쇠 용마루)과 처마 띠, 세로 널 앞벽 가운데 문 — 문 안으로 아래 선실로 내려가는 계단이 어둠 속에 보인다. 문 옆 놋쇠 등, 둥근 창(3×4).',
    '3×4칸, 아래 2줄 막힘(가운데 아래 칸 = 문: 부딪히면 아래 선실로 이동하는 이벤트, 문 앞 1칸 비움). 고물 쪽 북쪽 난간 앞. 선실층의 stair_wood_up 과 짝.', 2)
obj('hatch_ladder', AD.hatch_ladder(), '사다리 승강구', '갑판에 뚫린 네모 구멍(놋쇠 모서리 덧댄 나무 턱) 안 북벽을 따라 기관실로 내려가는 사다리, 오른쪽에 열어 눕힌 널 덮개(3×2).',
    '3×2칸. 구멍 2×2 막힘(구멍 바로 북쪽 칸이 아래층 이동 이벤트 칸), 덮개 칸은 걷기. 이물 쪽 갑판. 기관실 wall_ladder 와 짝.', 2)
obj('cargo_hatch', AD.cargo_hatch(), '화물 창 덮개', '갑판과 높이가 같은 나무 격자 덮개(살 사이 어둠), 둘레 테·쇠 모서리·밧줄 고리(3×2).', '3×2칸 바닥 장식(걷기). 두 돛대 사이 갑판 가운데. 둘레에 짐(통·상자)을 덩이로.', 0, kind='decal')
obj('funnel', AD.funnel(), '굴뚝', '기관실 화구에서 갑판을 뚫고 오른 쇠 굴뚝(놋쇠 띠 셋, 그을린 입), 갑판 칼라, 피어오르는 연기(2×5).', '2×5칸, 아랫줄만 막힘(위는 걷기+가림). 이물 쪽, 기관실 보일러 바로 위 자리. 난간과 1칸 띄운다.', 1, soft=True)
obj('capstan', AD.capstan(), '캡스턴', '밧줄 감긴 나무 북과 놋쇠 머리 판에 꽂은 손잡이 막대 넷, 놋쇠 멈춤 고리(2×2).', '2×2칸, 아랫줄 막힘. 갑판 가운데, 돛대·승강구 사이 빈자리. 둘레 1칸 비움.', 1)
obj('lifeboat', AD.lifeboat(), '구명정', '갑판 받침목 위 작은 나무 배 — 둥근 뱃전, 가로 널 셋과 노 한 쌍, 고물 반은 밧줄로 묶은 캔버스 덮개(4×2).', '4×2칸, 2줄 막힘. 북쪽 난간 바로 앞에 배 길이를 동서로. 하나 또는 띄워서 둘.', 2)
obj('barrels_lashed', AD.barrels_lashed(), '묶은 통 무리', '쇠테 두른 나무 통 셋을 밧줄로 묶은 무리(2×2).', '2×2칸, 아랫줄 막힘. 난간 곁·화물 창 둘레에 상자와 섞어 덩이로.', 1)
obj('crate_stack', AD.crate_stack(), '짐 상자 더미', '쇠 모서리 상자 셋을 쌓고 짐 그물 밧줄을 씌운 더미(2×2).', '2×2칸, 아랫줄 막힘. 화물 창·승강구 곁에 통과 섞어.', 1)
obj('ballast_sacks', AD.ballast_sacks(), '모래주머니', '묶은 삼베 바닥짐 자루 셋 — 비행선 높이 맞추기용(2×1).', '2×1칸 막힘. 난간 안쪽 발치에 1~2무리, 일렬 금지.', 1)
obj('rope_coil', AD.rope_coil(), '밧줄 사리', '갑판에 둥글게 사려 놓은 밧줄과 풀린 끝(1×1).', '1칸 바닥 장식(걷기). 돛대·캡스턴·밧줄 걸이 발치에 1~2개.', 0, kind='decal')
obj('pin_rail', AD.pin_rail(), '밧줄 걸이', '두 기둥 사이 가로 널에 꽂은 빌레이 핀마다 사려 걸어 둔 밧줄(2×2).', '2×2칸, 아랫줄 막힘. 돛대 곁(줄사다리 발치 밖)이나 난간 안쪽.', 1)
obj('telescope', AD.telescope(), '망원경', '세 다리 나무 받침 위 하늘을 겨눈 놋쇠 망원경(1×2).', '1×2칸, 아랫줄만 막힘. 이물 쪽 난간 곁 하나.', 1, soft=True)
obj('deck_lantern', AD.deck_lantern(), '갑판 등', '나무 기둥 위 놋쇠 틀 유리 등(1×2).', '1×2칸, 아랫줄만 막힘. 난간 안쪽 6~10칸 간격, 승강구 곁. 빛무리와 함께.', 1, soft=True)
obj('signal_lamp', AD.signal_lamp(), '신호 탐조등', '갈래 받침 위 놋쇠 원통 등, 동쪽 유리 렌즈가 빛난다(2×2).', '2×2칸, 아랫줄 막힘. 이물 끝 갑판에 하나.', 1)
obj('ensign_pole', AD.ensign_pole(), '선미 깃대', '가는 나무 깃대와 놋쇠 꼭지, 서쪽으로 나부끼는 붉은·크림 긴 깃발(무늬·글자 없음, 1×3).', '1×3칸, 아랫줄만 막힘. 고물 모서리 난간 안쪽 하나.', 1, soft=True)
obj('vent_cowl', AD.vent_cowl(), '통풍 나팔', '아래 기관실로 바람을 넣는 놋쇠 통풍관, 붉게 칠한 나팔 입이 동쪽을 향한다(1×2).', '1×2칸, 아랫줄만 막힘. 굴뚝·사다리 승강구 곁에 1~2개.', 1, soft=True)
obj('deck_prism', AD.deck_prism(), '갑판 채광 유리', '아래 선실로 빛을 들이는 놋쇠 테 네모 유리판 셋(1×1).', '1칸 바닥 장식(걷기). 선실 바로 위 갑판에 3~5칸 간격으로 흩어서.', 0, kind='decal')
# 선실층
obj('stair_wood_up', AC.stair_wood_up(), '오름 나무 계단', '양옆 난간 기둥 사이 놋쇠 코 댄 디딤판 여섯 단이 북쪽 벽 안으로 오른다(2×3).',
    '2×3칸 걷기(맨 윗줄 = 위층 이동 칸). 방 북쪽 벽 앞면 바로 아래 바닥 위에 놓고 그 위 벽 앞면에 stair_opening. 계단 앞 1칸 비움.', 0, kind='walk')
obj('stair_opening', AC.stair_opening(), '계단 입구(벽)', '선실 벽을 뚫은 네모 문틀 안으로 계단이 위 승강구로 이어지고 꼭대기에 하늘빛(2×3).', '2×3칸 벽 앞면 장식(앞면 3줄 필요). stair_wood_up 바로 위 같은 열에만.', 0, kind='decal')
obj('hatch_stair_down', AC.hatch_stair_down(), '내림 계단 승강구', '바닥에 뚫린 놋쇠 테 네모 구멍 안 북쪽으로 어둠 속 아래층으로 내려가는 계단(2×2).', '2×2칸 걷기(맨 아랫줄 = 아래층 이동 칸). 복도 끝 바닥 위, 둘레 1칸 비움. 아래층 stair_wood_up 과 짝.', 0, kind='walk')
obj('bunk_bed', AC.bunk_bed(), '이층 침대', '북쪽 벽에 붙인 나무 틀 이층 침대 — 위 칸 붉은 담요, 아래 칸 크림 담요와 베개, 놋쇠 기둥 머리, 작은 사다리(2×3).', '2×3칸, 아랫줄만 막힘(위 2줄은 벽 앞면에 겹친다). 선원실 북쪽 벽에 1칸 띄워 둘.', 1, soft=True)
obj('bed_captain', AC.bed_captain(), '선장 침대', '놋쇠 머리 공 단 나무 머리판, 크림 베개 둘, 슬레이트 보라 누비 담요(2×2).', '2×2칸, 2줄 막힘. 선장실 북쪽 벽 바로 아래.', 2)
obj('chart_table', AC.chart_table(), '해도 탁자', '펼친 하늘 해도(구름 섬과 항로 점선, 글자 없음)·놋쇠 디바이더·나침반·문진이 놓인 큰 나무 탁자(3×2).', '3×2칸, 2줄 막힘. 해도실 한가운데 앵커, 둘레 1칸 비움.', 2)
obj('sea_chest', AC.sea_chest(), '뱃사람 궤', '둥근 뚜껑·쇠띠 나무 궤와 놋쇠 자물쇠(1×1).', '1칸 막힘. 침대 발치·벽가에 1~3개.', 1)
obj('porthole', AC.porthole(), '현창', '볼트 박은 둥근 놋쇠 테 속 구름 낀 하늘 유리(1×1).', '1칸 벽 앞면 장식(가운데 줄). 바깥 쪽 벽에 3~4칸 간격.', 0, kind='decal')
obj('stern_window', AC.stern_window(), '고물 창', '아치 머리 세 칸 유리창 — 놋쇠 창살 너머 하늘과 구름, 아래 창턱(3×2).', '3×2칸 벽 앞면 장식(앞면 3줄 중 위 2줄). 선장실 벽 가운데 하나.', 0, kind='decal')
obj('wall_lantern', AC.wall_lantern(), '벽 등', '쇠 갈고리에 건 놋쇠 틀 유리 등(1×1).', '1칸 벽 앞면 장식. 4~6칸 간격, 빛무리와 함께.', 0, kind='decal')
obj('instrument_cabinet', AC.instrument_cabinet(), '기구 진열장', '유리문 속 선반에 놋쇠 육분의·작은 천구·병·두루마리·책을 둔 키 큰 나무 장(2×3).', '2×3칸, 아랫줄만 막힘. 해도실·선장실 북쪽 벽에 등을 붙여.', 1, soft=True)
obj('captain_desk', AC.captain_desk(), '선장 책상', '항해 일지·잉크병·깃펜, 초록 갓 놋쇠 등이 놓인 마호가니 서랍 책상(2×2).', '2×2칸, 2줄 막힘. 선장실 창 아래, 앞(남)에 chair_cabin.', 2)
obj('barrel_single', AC.barrel_single(), '나무 통', '쇠테 둘 두른 세운 통(1×1).', '1칸 막힘. 복도·기관실 구석에 1~3개 덩이로.', 1)
obj('rug_cabin', AC.rug_cabin(), '선실 깔개', '금빛 테 짙은 붉은 직물 깔개, 가운데 마름모, 양 끝 술(3×2).', '3×2칸 바닥 장식(걷기). 선장실·해도실 가운데.', 0, kind='decal')
obj('wall_chart', AC.wall_chart(), '벽 해도', '네 모서리 못 박은 하늘 해도(구름 섬·항로 점선, 글자 없음, 2×1).', '2×1칸 벽 앞면 장식. 해도실·복도 벽.', 0, kind='decal')
obj('globe_stand', AC.globe_stand(), '지구의', '세 다리 받침 위 놋쇠 자오환 속 푸른 바다·녹갈색 땅의 지구의(1×2).', '1×2칸, 아랫줄만 막힘. 선장실·해도실 모서리.', 1, soft=True)
obj('chair_cabin', AC.chair_cabin(), '선실 의자', '붉은 방석, 놋쇠 징 박은 등받이(북)의 나무 의자(1×1).', '1칸 막힘. 책상·탁자 남쪽 곁.', 1)
obj('galley_stove', AC.galley_stove(), '주방 쇠 화덕', '벽에 붙인 검은 쇠 화덕 — 화구 위 구리 냄비·주전자, 빨간 불 문과 오븐 문, 벽을 타고 오르는 연통(2×3).', '2×3칸, 아랫줄만 막힘(위 2줄은 벽 앞면에 겹친다). 식당·주방 북쪽 벽 아래, 곁에 통·궤.', 1, soft=True)
obj('mess_table', AC.mess_table(), '식당 긴 탁자', '빵·주석 잔·그릇·촛불이 놓인 널 탁자와 앞의 긴 걸상(3×2).', '3×2칸, 2줄 막힘. 식당 가운데, 둘레 1칸 비움.', 2)
obj('pot_shelf', AC.pot_shelf(), '냄비 걸이', '널 선반 위 병·자루, 아래 갈고리에 건 구리 냄비 둘과 국자(2×1).', '2×1칸 벽 앞면 장식. 화덕 곁 벽.', 0, kind='decal')
# 기관실
obj('boiler', AE.boiler(), '증기 보일러', '리벳 줄 박은 누운 큰 쇠 원통(놋쇠 띠 셋) 위 증기 돔·안전밸브·압력계, 아래 벽돌 화실과 빨갛게 타는 화구 문(4×4).', '4×4칸, 아래 2줄 막힘. 기관실 북쪽 벽 앞 앵커, 앞(남) 2칸 비우고 곁에 석탄 더미.', 2)
obj('wall_gear_train', AE.wall_gear_train(), '벽 톱니 바퀴', '볼트 박은 나무 판의 큰 놋쇠 톱니·맞물린 쇠 톱니·작은 놋쇠 톱니와 사슬(3×3).', '3×3칸 벽 앞면 장식(앞면 3줄 필요). 기관실 북쪽 벽, 플라이휠 기관 위쪽.', 0, kind='decal')
obj('flywheel_engine', AE.flywheel_engine(), '플라이휠 기관', '쇠 받침대 위 크게 선 플라이휠(놋쇠 테·바퀴살 여섯)과 누운 증기 실린더, 크랭크 막대(3×3).', '3×3칸, 아래 2줄 막힘. 보일러 동쪽, 왼쪽(서)에 driveshaft 를 이어 선미로.', 2)
obj('driveshaft', AE.driveshaft(), '추진축', '바닥을 따라 동서로 누운 쇠 축과 놋쇠 축받이 둘, 가운데 이음 테(4×1).', '4×1칸 막힘. 플라이휠 기관 왼쪽에서 서쪽 벽까지 같은 줄로 이어 붙인다(축은 일렬이 맞다). 위아래 1칸씩 통로.', 1)
obj('pressure_gauge', AE.pressure_gauge(), '압력계', '놋쇠 테 흰 눈금판과 붉은 바늘, 아래로 내려가는 관(1×1).', '1칸 벽 앞면 장식. 보일러·관 곁 벽에 1~2개.', 0, kind='decal')
obj('valve_wheel', AE.valve_wheel(), '밸브 손잡이', '가로 관에 단 붉은 쇠 손바퀴(1×1).', '1칸 벽 앞면 장식(아래 줄). 관 오토타일이 벽에 닿는 곳.', 0, kind='decal')
obj('coal_pile', AE.coal_pile(), '석탄 더미', '화구 곁에 쌓은 검은 석탄 덩이와 꽂아 둔 삽, 부스러기(2×2).', '2×2칸, 아랫줄 막힘. 보일러 서쪽 곁, 벽가.', 1)
obj('workbench', AE.workbench(), '작업대', '바이스 단 두꺼운 널 작업대 위 스패너·망치·기름통, 서랍(2×2).', '2×2칸, 2줄 막힘. 기관실 벽가, 위 벽에 tool_rack.', 2)
obj('wall_ladder', AE.wall_ladder(), '벽 사다리', '기관실 북벽을 타고 천장 승강구까지 오르는 나무 사다리, 꼭대기에 하늘빛(1×3).', '1×3칸 벽 앞면 장식(앞면 3줄). 바로 아래 바닥 칸이 위 갑판 hatch_ladder 로 오르는 이동 칸 — 비워 둔다.', 0, kind='decal')
obj('fuel_tank', AE.fuel_tank(), '연료 통', '놋쇠 띠 두른 세운 쇠 통과 기름 눈금 유리관, 꼭지(1×2).', '1×2칸, 아랫줄만 막힘. 보일러·기관 곁에 둘씩 덩이로.', 1, soft=True)
obj('tool_rack', AE.tool_rack(), '공구 걸이', '못 박은 널판에 건 스패너 셋과 망치·톱(2×1).', '2×1칸 벽 앞면 장식. 작업대 바로 위.', 0, kind='decal')
obj('floor_grate', AE.floor_grate(), '바닥 쇠창살', '축 도랑을 덮은 쇠 격자 — 틈 아래 어둠 속 놋쇠 관(2×2).', '2×2칸 바닥 장식(걷기). 추진축·관 곁 통로에.', 0, kind='decal')

obj('deck_bow', AB.bow_image(), '갑판 이물(뱃머리)', '칸 계단 없이 화소 곡선으로 좁아지는 갑판 끝 — 곡선을 따라 도는 난간(놋쇠 손잡이·나무 난간동자), 끝 기둥, 아래로 말려 드는 선체 앞면(10×14).',
    '10×14칸. 왼쪽 위 칸을 갑판 북쪽 난간 줄 끝 바로 동쪽에 붙인다(갑판 10줄 폭과 맞는다). 갑판 윗면 안쪽 칸만 걷기 — 곡선 난간 둘레 칸과 선체·하늘 칸은 막힘(굽기 뒤 통행을 맞춘다).', 0, kind='walk')
def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower')
ground('airdeck', 'as_deck', '비행선 갑판 널', '버들항 잔교 결의 4px 널이 배 길이(동서)로 눕고 24px 마디가 줄마다 어긋나는 갑판 3×3 표본(못·햇볕 바램·타르 얼룩).', '갑판·부두 바닥. 가장자리는 autotile-deck-edge 로 하늘과 만난다.')
ground('cabin-boards', 'as_cabin', '선실 마호가니 널', '윤낸 붉은 8px 널, 마디 어긋남·못·광택 점 3×3 표본.', '선실·선장실·복도 바닥.')
ground('engine-boards', 'as_engine', '기관실 기름 먹은 널', '그을린 짙은 6px 널 위 48px 마다 리벳 박은 쇠 띠(보), 기름 얼룩 3×3 표본.', '기관실·창고 바닥.')
kit.add('face_cabin_3h', face_sample('as_cabin', 3, 3), 'wall', '선실 벽 앞면(3줄)', '세로 널 판벽 + 놋쇠 몰딩 띠 + 굽도리 판 + 걸레받이 3칸 폭 표본.', '선실 방 천장 밑 3줄(복도는 2줄). 바닥보다 어둡다.', 0, role='wall')
kit.add('face_ribs_3h', face_sample('as_ribs', 3, 3), 'wall', '기관실 벽 앞면(3줄)', '가로 외판 위 32px 마다 굽은 늑골(쇠 무릎·리벳)과 그을음 3칸 폭 표본.', '기관실 천장 밑 3줄.', 0, role='wall')
kit.add('ceiling_wood', ceiling_sample(), 'wall', '나무 천장', '어두운 속 + 위 갑판 널 두께 띠(열린 쪽만 밝다), 모서리 포함 3×3 표본.', '실내 방·복도 바깥(벽 너머).', 0, role='wall')
kit.add('face_hull', hull_sample(), 'wall', '선체 앞면', '갑판 남쪽 가장자리 아래 3줄: 놋쇠 걸레받이 띠, 외판, 놋쇠 띠, 64px 마다 놋쇠 현창, 아래로 말려 어두워지는 배 밑 3×3 표본.', '갑판 남쪽 끝 칸 바로 아래 3줄(막힘). 그 아래는 하늘.', 0, role='wall')
kit.add('sky_clouds', sky_sample(), 'wall', '구름 하늘', '세 단 하늘과 둥근 덩이 적운 3×3 표본.', '갑판 밖 모든 칸(막힘). 아래쪽으로 갈수록 구름을 늘린다.', 0, role='wall')
DS = AU.deck_edge_sheet(); RS = AU.rail_sheet(); PS = AU.pipe_sheet()
kit.add('autotile-deck-edge', DS, 'autotile', '갑판 가장자리', '하늘 위에 칠하는 갑판 널 16변형: 북쪽 밝은 턱, 서쪽 빛 받는 모, 동쪽 그늘 모, 남쪽 놋쇠 띠 두른 갑판 두께, 바깥 모서리 둥글게.',
        '하늘(막힘) 위에 칠해 걷는 갑판·부두를 만든다. 남쪽 끝 줄 아래 3줄에는 face_hull. 갑판 둘레 한 줄에는 autotile-rail.', 0, layer='lower', role='terrain')
kit.add('autotile-rail', RS, 'autotile', '갑판 난간', '놋쇠 손잡이 띠 + 나무 난간동자, 끝·모서리 놋쇠 머리 기둥 16변형.', '갑판 둘레 맨 바깥 한 줄. 모든 변형 막힘. 탑승 발판 자리만 2칸 비운다.', 1, layer='upper', role='fence')
PUDS, OILS, COALS = BL.puddle_sheet(), BL.oil_sheet(), BL.coal_sheet()
BLOBR = '붓으로 불규칙한 덩이(혹·만·코)를 칠한다 — 사각형 채우기 금지, 1칸 외톨이·1칸 폭 띠 금지(3칸 이상 덩이). 위층 투명 덧그림이라 밑 바닥 결이 비친다.'
kit.add('autotile-deck-puddle', PUDS, 'autotile', '갑판 빗물 웅덩이', '갑판 널에 고인 얕은 빗물 16변형(위 1·오른 2·아래 4·왼 8): 젖어 짙어진 널 테(반투명), 북·서 안쪽 둑 그늘과 남·동 안쪽 밝은 물빛 테, 하늘이 비친 반투명 물(널 이음이 비친다)과 바람 잔물결 줄. 칸 모서리 들어감을 줄여 오목한 모서리에도 네모 혹이 없다.',
        '걷기(얕은 빗물 — 깊이 없음). 갑판·부두 널 위, 돛대·구명정·갑판실 발치의 빈 널에 2~3덩이. ' + BLOBR, 0, layer='lower', role='terrain')
kit.add('autotile-oil-slick', OILS, 'autotile', '기름때·타르 번짐', '널 위로 번진 검갈색 기름·타르 16변형: 한 톤 속에 드문 무지갯빛 결(보라·청록), 빛 받는 북·서 가 한 줄, 반투명 스민 가장자리와 둘레에 튄 방울.',
        '걷기. 갑판 굴뚝·통풍 나팔·사다리 승강구 곁, 기관실 플라이휠·추진축·연료 통 둘레·통로에. ' + BLOBR, 0, layer='lower', role='terrain')
kit.add('autotile-coal-dust', COALS, 'autotile', '석탄 가루', '기관실 화구·석탄 더미 둘레에 쏟아진 석탄 가루 16변형: 짙은 잿가루 속 알갱이와 덩이 석탄알(윗면 빛 한 점), 반투명 얇은 가루 테, 칸 밖 드문 부스러기.',
        '걷기. 보일러 화구 앞·coal_pile 둘레(더미 밑까지 덮어도 된다). ' + BLOBR, 0, layer='lower', role='terrain')
for _n in ('autotile-deck-puddle', 'autotile-oil-slick', 'autotile-coal-dust'): kit.meta[_n]['passable'] = True
_deckbg = lambda x, y: mk(lambda xx, yy: deck_px((x * 16 + xx) % 48, (y * 16 + yy) % 48))
_engbg = lambda x, y: dlib.floor_tile('as_engine', x, y)
BL.check_sheet(os.path.join(OUT, 'check-autotile.png'), [('autotile-deck-puddle (on deck)', PUDS, _deckbg),
    ('autotile-oil-slick (on deck)', OILS, _deckbg), ('autotile-oil-slick (on engine boards)', OILS, _engbg), ('autotile-coal-dust (on engine boards)', COALS, _engbg)])
kit.add('autotile-pipe', PS, 'autotile', '놋쇠 관', '곧은 관·꺾인 관·세 갈래·네 갈래 이음쇠, 끝은 붉은 손바퀴 밸브 16변형.', '기관실 벽 앞면 아래 줄·보일러에서 기관까지 이어 깐다. 모든 변형 막힘. 통로를 가로지르지 않는다.', 1, layer='upper', role='fence')

# ---- 보정 패스(2026-10-08): 기낭 윗면·그물·고정부 덧그림 + 시그니처 땅 덩이 오토타일
RIGR = '기낭 조각 대신 그 칸에 놓는다(같은 칸에 겹쳐 놓아도 같은 그림). 하늘 칸 위(본디 막힘) — 막힘 계산과 상관없다.'
obj('envelope_rigging_tail', RG.rigged_tail(), '그물 씌운 기낭 꼬리', '그물·등마루를 갖춘 완성 기낭 꼬리: envelope_tail 위에 원통 곡면을 따라 위·아래로 촘촘해지는 삼 밧줄 마름모 그물(등마루 너머 먼 쪽 줄은 옅게), 꼬리 굵은 곳에서 시작하는 등마루 널 통로와 먼 쪽 놋쇠 난간(8×10). 혼자 써도 줄이 기낭 윤곽에서 끝난다.',
    '8×10칸. envelope_tail ' + RIGR + ' 오른쪽에 envelope_rigging(몸통)을 잇는다.', 1)
obj('envelope_rigging', RG.rigged_body(), '그물 씌운 기낭 몸통', '그물·등마루를 갖춘 완성 기낭 몸통: 3/4 윗면 등마루(위 윤곽보다 안쪽)를 따라 놓인 널 통로·놋쇠 난간 기둥·처진 밧줄 손잡이, 등마루에서 짐 띠까지 마름모 삼 밧줄 그물(줄 밑 그늘), 짐 띠의 놋쇠 죔쇠(그물 V 꼭지), 죔쇠에서 바닥 고리까지 매달기 줄과 놋쇠 심(8×10, 128px 주기).',
    '8×10칸, 가로로 몇 개든 이어 붙인다. envelope_body ' + RIGR + ' 매달기 줄 자리 = 바닥 고리 = cable_drop 자리(32px 마다).', 1)
obj('envelope_rigging_patched', RG.rigged_body_patched(), '그물 씌운 기낭 몸통(덧댄 천)', '그물·등마루를 갖춘 완성 기낭 몸통의 덧댄 천 변형(envelope_body_patched + 같은 그물·등마루, 8×10).',
    '8×10칸. envelope_rigging 과 섞어 이을 때 한 기낭에 하나만(일렬 반복 금지). envelope_body_patched ' + RIGR, 1)
obj('envelope_rigging_nose', RG.rigged_nose(), '그물 씌운 기낭 코', '그물·등마루를 갖춘 완성 기낭 코: 코 쪽으로 오므라드는 그물, 등마루 통로 끝 기둥, 죔쇠·매달기 줄 둘, 놋쇠 코 덮개(6×10).', '6×10칸. envelope_nose ' + RIGR, 1)
obj('envelope_valve', RG.valve(), '기낭 가스 밸브', '등마루 통로 위 가스 빼는 놋쇠 밸브 — 둥근 덮개 윗면 타원과 앞면 띠, 볼트 테, 꼭대기 당김줄 고리, 통로에 진 그늘(1×1).',
    '1칸 하늘 장식(덧그림). envelope_rigging 의 등마루 통로 위, 바닥을 통로 앞 끝에 맞춘다. 한 기낭에 2~3개, 같은 간격 금지. ' + SKYR, 0, kind='decal')

# ---------------------------------------------------------------- 지도
W_, H_ = 134, 32
OXC, OXE = 67, 101
class AMap(KMap):
    def __init__(s, *a):
        super().__init__(*a); s.deck = set(); s.gang = set(); s.hull = {}; s.sky = set(); s.lights = []; s.bowbox = set(); s.bow = None
    def compute_faces(s):
        super().compute_faces()
        for k in [k for k in s.face if k[0] < 66]: del s.face[k]
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        dk = s.deck | s.gang
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if (x, y) in s.bowbox:
                    im.alpha_composite(mk(lambda xx, yy: sky_px(x * T + xx, y * T + yy)), P)
                elif (x, y) in s.deck:
                    nb = lambda dx, dy: (x + dx, y + dy) in dk or not s.inb(x + dx, y + dy)
                    N, E, S_, W = nb(0, -1), nb(1, 0), nb(0, 1), nb(-1, 0)
                    t = new(); t.alpha_composite(mk(lambda xx, yy: sky_px(x * T + xx, y * T + yy)))
                    t.alpha_composite(AU.deck_edge_cell(0, N, E, S_, W, lambda X, Y: deck_px(X % 48, Y % 48), x * T, y * T))
                    im.alpha_composite(t, P)
                elif (x, y) in s.hull:
                    n, H = s.hull[(x, y)]
                    stern = (x - 1, y) not in s.hull                                   # 고물 끝: 배 밑이 둥글게 말려 든다
                    def hp(xx, yy, n=n, H=H, x=x, y=y, stern=stern):
                        Y = n * T + yy
                        if stern and Y > 18 and xx < int(((Y - 18) / 30.0) ** 1.6 * 14): return sky_px(x * T + xx, y * T + yy)
                        if stern and xx == 0: return WD[5] if Y < 18 else WD[2]
                        return hull_px(x * T + xx, Y, H)
                    im.alpha_composite(mk(hp), P)
                elif (x, y) in s.sky or (x, y) in s.gang:
                    im.alpha_composite(mk(lambda xx, yy: sky_px(x * T + xx, y * T + yy)), P)
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
                        return s.inb(xx, yy) and xx >= 66 and (s.open(xx, yy) or (xx, yy) in s.face)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(wood_ceiling(o8, int(_hash(x, y, 4) * 4)), P)
        if s.bow: im.alpha_composite(s.bow[2], (s.bow[0] * T, s.bow[1] * T))
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(round(x * T)), int(round(y * T))))
        for (px_, py_, img) in s.lights: im.alpha_composite(img, (int(px_), int(py_)))
        for cells, sheet in s.over:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

m = AMap(W_, H_, 'airship')
BAD = []
def P(name, x, y, block=None, layer=1, check=True):
    """조각을 칸 (x, y)(= 왼쪽 아래 칸)에 놓는다. block 이 없으면 메타 brows 로 발자국을 잰다."""
    img = S[name]; br = kit.meta[name]['brows']
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
def glowc(cx, cy, col=(255, 190, 110), size=48, a=55): m.glow_at(cx + .5, cy + .5, glow(size, col, a))
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]

# ======== 갑판 (x 0~65): 고물(서) x6 → 이물(동) x58, 갑판 세로 y14~23(난간 포함), 선체 앞면 y24~26, 부두 y29~31
BOWX, BOWY = 50, 14
for x in range(6, 50):
    for y in range(14, 24): m.deck.add((x, y))
BOWIMG = AB.bow_image(BOWX * T, BOWY * T)
m.bow = (BOWX, BOWY, BOWIMG)
BOWBLK = set()
for j in range(AB.BH):
    for i in range(AB.BW):
        c = (BOWX + i, BOWY + j); m.bowbox.add(c)
        if AB.bow_deck((i, j)):
            m.deck.add(c)
            if not AB.bow_walk((i, j)): BOWBLK.add(c)
for x in range(8, 18):
    for y in range(29, 32): m.deck.add((x, y))                                       # 부두(남쪽 맵 끝 너머로 이어진다)
m.gang = {(x, y) for x in (12, 13) for y in range(24, 29)}
for (x, y) in m.deck | m.gang:
    m.fl[y][x] = 'as_gang' if (x, y) in m.gang else 'as_deck'; m.wh[y][x] = 0
for (x, y) in list(m.deck):
    if (x, y) in m.bowbox: continue
    if y < 29 and (x, y + 1) not in m.deck:
        for n in range(3):
            if (x, y + 1 + n) not in m.deck: m.hull[(x, y + 1 + n)] = (n, 48)
for y in range(H_):
    for x in range(66):
        if (x, y) not in m.deck and (x, y) not in m.hull and (x, y) not in m.gang and (x, y) not in m.bowbox: m.sky.add((x, y))
# 난간: 갑판 둘레 한 줄(부두·탑승 발판 틈 제외)
rail = set()
for (x, y) in m.deck:
    if y >= 29 or (x, y) in m.bowbox: continue
    if any((x + dx, y + dy) not in m.deck for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and (x, y) not in ((12, 23), (13, 23)): rail.add((x, y))
m.over.append((rail, RS))
for c in rail | BOWBLK: m.blocked.add(c)

# 기낭·매다는 줄 (하늘)
P('envelope_tail', 4, 11, block=[], check=False)
for i, nm in enumerate(('envelope_body', 'envelope_body_patched', 'envelope_body', 'envelope_body', 'envelope_body')):
    P(nm, 12 + i * 8, 11, block=[], check=False)
P('envelope_nose', 52, 11, block=[], check=False)
P('envelope_rigging_tail', 4, 11, block=[], check=False)                            # 그물 씌운 완성 조각을 같은 칸에(기낭 조각 위에 겹쳐도 같은 그림)
for i in range(5): P('envelope_rigging_patched' if i == 1 else 'envelope_rigging', 12 + i * 8, 11, block=[], check=False)
P('envelope_rigging_nose', 52, 11, block=[], check=False)
_YR = 2 * T + int(round(RG.ECY - RG.RIDGE * RG.ER))                                  # 등마루 통로 앞 끝(px)
for _vx in (12 * T + 92, 28 * T + 44, 44 * T + 100): m.overlays.append((_vx - 8, _YR + 3 - 16, S['envelope_valve']))
for i in range(5):
    for rx in (16, 48, 80, 112):
        gx = (12 + i * 8) * T + rx
        if 9 <= (gx - 9) / 16.0 <= 54: m.decal((gx - 9) / 16.0, 12, S['cable_drop'])
for rx in (16, 48): m.decal((52 * T + rx - 9) / 16.0, 12, S['cable_drop'])
P('propeller_stern', 3, 22, block=[], check=False)
P('wing_engine', 30, 27, block=[], check=False)
P('bowsprit', 59, 19, block=[], check=False)
P('gangway', 12, 28, block=[], check=False)

# 고물 갑판: 승강구 갑판실·조타·깃대
P('deckhouse', 9, 17, block=[(0, 0), (2, 0), (0, -1), (1, -1), (2, -1)])
P('ensign_pole', 7, 21)
P('helm_wheel', 14, 20); P('binnacle', 16, 20); P('voice_tube', 13, 18)
glowc(10.5, 16.2, size=40, a=45)
P('deck_lantern', 7, 17); glowc(7, 15.6, size=40, a=50)
P('ballast_sacks', 9, 22, block=[(0, 0), (1, 0)])
P('barrels_lashed', 17, 17)
FD('deck_prism', 18, 20); FD('deck_prism', 11, 20)
# 주돛대 둘레
P('mast_main', 22, 19, block=[(2, 0)])
P('pin_rail', 19, 22); FD('rope_coil', 21, 20); FD('rope_coil', 27, 18)
P('lifeboat', 28, 16, block=BX(4, 2))
P('capstan', 34, 22)
FD('cargo_hatch', 28, 19)
P('crate_stack', 26, 22); P('barrels_lashed', 32, 22)
FD('rope_coil', 33, 20); FD('deck_prism', 24, 22)
P('deck_lantern', 33, 16); glowc(33, 14.6, size=40, a=50)
# 앞돛대·이물
P('mast_fore', 39, 18, block=[(1, 0)])
P('pin_rail', 37, 22); FD('rope_coil', 41, 19)
P('crate_stack', 36, 16)
P('funnel', 46, 18); P('vent_cowl', 44, 16); P('vent_cowl', 49, 17)
P('hatch_ladder', 43, 22, block=[(0, 0), (1, 0), (0, -1), (1, -1)])
P('ballast_sacks', 47, 22, block=[(0, 0), (1, 0)])
P('signal_lamp', 53, 19); P('telescope', 55, 18)
P('deck_lantern', 51, 21); glowc(51, 19.6, size=40, a=50)
FD('rope_coil', 52, 17); FD('deck_prism', 40, 21)
# 부두(남쪽 끝): 계류 말뚝 대신 통·상자
P('barrel_single', 9, 31); P('barrel_single', 10, 31); P('crate_stack', 15, 31); P('deck_lantern', 17, 29); glowc(17, 27.6, size=40, a=50); P('deck_lantern', 8, 29); glowc(8, 27.6, size=40, a=50)
FD('rope_coil', 16, 29)

# ======== 선실층 (x 67~99): 북쪽 줄 = 선장실(서)·해도실(가운데)·선원실(동), 가운데 복도, 남쪽 줄 = 식당·주방(서)·창고(동, 내림 승강구)
def RC(x0, y0, x1, y1, kind='as_cabin', wh=3, sty='as_cabin'): m.floor(OXC + x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
C = lambda x: OXC + x
RC(2, 6, 8, 11); RC(11, 6, 18, 11); RC(21, 6, 28, 11)                             # 북쪽 방 셋(7·8·8 × 6)
RC(2, 15, 28, 16, wh=2)                                                           # 복도(벽 2줄)
for lx in (5, 14, 15, 24): RC(lx, 12, lx, 14, wh=2)                                # 방 ↔ 복도 문(선장실·선원실 1칸, 해도실 2칸)
RC(2, 21, 12, 25); RC(15, 21, 28, 25)                                             # 남쪽 방 둘
for lx in (7, 8, 20, 21): RC(lx, 17, lx, 20, wh=3)                                 # 복도 ↔ 남쪽 방 문
for (lx, ly) in ((2, 6), (28, 6), (2, 25), (28, 25), (12, 25)): m.cut(C(lx), ly, 1, 1)
# 해도실: 오름 계단(위 = 갑판실), 해도 탁자, 진열장 둘, 지구의
P('stair_wood_up', C(14), 8, block=[]); DEC('stair_opening', C(14), 3)
P('chart_table', C(14), 11, block=BX(3, 2)); P('chair_cabin', C(17), 11); P('chair_cabin', C(13), 10)
P('instrument_cabinet', C(11), 6); P('instrument_cabinet', C(16), 6); P('globe_stand', C(18), 9)
P('sea_chest', C(11), 11); P('chair_cabin', C(13), 11); P('barrel_single', C(18), 6); P('barrel_single', C(13), 6); P('barrel_single', C(8), 6)
DEC('wall_chart', C(12), 3); DEC('wall_lantern', C(18), 4); glowc(C(18), 4.6, size=40, a=50)
# 선장실: 고물 창 아래 책상, 침대, 깔개, 궤
DEC('stern_window', C(3), 3)
P('bed_captain', C(2), 8, block=BX(2, 2)); P('captain_desk', C(6), 8, block=BX(2, 2)); P('chair_cabin', C(6), 9)
P('sea_chest', C(4), 8); P('globe_stand', C(8), 11); P('barrel_single', C(2), 11); P('sea_chest', C(3), 11)
FD('rug_cabin', C(3), 9); DEC('wall_lantern', C(7), 4); glowc(C(7), 4.6, size=40, a=50)
# 선원실: 이층 침대 둘, 궤, 깔개, 의자
P('bunk_bed', C(21), 6); P('bunk_bed', C(24), 6); P('sea_chest', C(23), 6); P('sea_chest', C(26), 6)
P('sea_chest', C(27), 6); P('barrel_single', C(28), 10); P('barrel_single', C(21), 11); P('barrel_single', C(22), 11)
P('chair_cabin', C(27), 11); FD('rug_cabin', C(21), 8); P('mess_table', C(25), 10, block=BX(3, 2)); P('sea_chest', C(28), 11)
DEC('porthole', C(27), 4); DEC('wall_lantern', C(26), 4); glowc(C(26), 4.6, size=36, a=40)
# 복도: 벽 등·현창·해도, 짐 몇
for lx in (9, 19): DEC('wall_lantern', C(lx), 13); glowc(C(lx), 13.6, size=40, a=50)
DEC('wall_chart', C(11), 13); DEC('porthole', C(3), 13); DEC('porthole', C(26), 13)
P('barrel_single', C(2), 16); P('sea_chest', C(3), 16); P('ballast_sacks', C(10), 16, block=[(0, 0), (1, 0)])
P('barrel_single', C(17), 15); P('crate_stack', C(26), 16); P('barrel_single', C(28), 16); P('sea_chest', C(13), 16)
FD('rope_coil', C(22), 15); FD('rug_cabin', C(15), 15)
# 식당·주방(남서): 화덕, 냄비 걸이, 긴 탁자 둘(어긋나게)
P('galley_stove', C(2), 21, block=[(0, 0), (1, 0)]); DEC('pot_shelf', C(4), 18); DEC('pot_shelf', C(10), 18)
P('mess_table', C(4), 23, block=BX(3, 2)); P('mess_table', C(8), 25, block=BX(3, 2))
P('barrel_single', C(4), 21); P('barrel_single', C(5), 21); P('barrel_single', C(12), 21)
P('chair_cabin', C(2), 23); P('sea_chest', C(9), 21); P('crate_stack', C(10), 23); P('sea_chest', C(2), 24)
DEC('wall_lantern', C(6), 19); glowc(C(6), 19.6, size=40, a=50); glowc(C(2.5), 19.6, (255, 140, 60), 48, 45)
# 창고(남동): 짐 더미와 아래 기관실로 내려가는 승강구
P('hatch_stair_down', C(25), 25, block=[])
P('crate_stack', C(15), 22); P('crate_stack', C(17), 25); P('barrels_lashed', C(15), 25); P('ballast_sacks', C(18), 22, block=[(0, 0), (1, 0)])
P('barrel_single', C(22), 21); P('barrel_single', C(23), 21); P('crate_stack', C(27), 22); P('barrels_lashed', C(21), 25)
P('sea_chest', C(28), 24); P('barrel_single', C(19), 25); FD('rope_coil', C(20), 23); FD('rope_coil', C(24), 23)
DEC('wall_lantern', C(25), 19); glowc(C(25), 19.6, size=40, a=50)

# ======== 기관실 (x 101~133): 북쪽 줄 = 보일러실(서)·계단방(동), 남쪽 줄 = 축 통로(서)·짐칸(동)
def RE(x0, y0, x1, y1, kind='as_engine', wh=3, sty='as_ribs'): m.floor(OXE + x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
E = lambda x: OXE + x
RE(2, 6, 15, 11); RE(16, 8, 18, 9, wh=2); RE(19, 6, 27, 11)                        # 보일러실 14×6, 통로, 계단방 9×6
RE(2, 16, 14, 20); RE(15, 18, 17, 19, wh=2); RE(18, 16, 27, 20)                   # 축 통로 13×5, 통로, 짐칸 10×5
for lx in (8, 23, 24): RE(lx, 12, lx, 15, wh=3)                                    # 위아래 줄 사이 문
for (lx, ly) in ((2, 6), (27, 6), (27, 20)): m.cut(E(lx), ly, 1, 1)
# 보일러실: 보일러(앵커)·석탄·연료 통·작업대, 벽 톱니, 벽을 따라 도는 놋쇠 관
P('boiler', E(4), 7, block=[(dx, -dy) for dx in range(4) for dy in range(2)])
glowc(E(5.5), 6.2, (255, 140, 60), 72, 60)
P('coal_pile', E(2), 10); P('fuel_tank', E(8), 8); P('fuel_tank', E(9), 9)
DEC('pressure_gauge', E(3), 4); DEC('valve_wheel', E(9), 5); DEC('wall_gear_train', E(11), 3)
pipe = {(E(x), 6) for x in range(10, 16)} | {(E(15), 7)}
m.over.append((pipe, PS))
for c in pipe: m.blocked.add(c)
P('workbench', E(11), 9, block=BX(2, 2)); P('barrel_single', E(13), 8); P('barrel_single', E(14), 11)
P('coal_pile', E(5), 11); P('fuel_tank', E(10), 11); P('crate_stack', E(12), 11)
# 계단방(동): 오름 계단(위 = 선실 창고 승강구), 벽 사다리(위 = 갑판 사다리 승강구), 공구 걸이
P('stair_wood_up', E(20), 8, block=[]); DEC('stair_opening', E(20), 3)
DEC('wall_ladder', E(25), 3); DEC('pressure_gauge', E(22), 4)
P('fuel_tank', E(19), 9); P('crate_stack', E(26), 11); P('barrel_single', E(27), 8); P('barrel_single', E(27), 9)
P('workbench', E(22), 11, block=BX(2, 2)); P('coal_pile', E(19), 11)
DEC('valve_wheel', E(27), 5)
# 축 통로(남서): 플라이휠 기관 + 서쪽 벽(선미)으로 가는 추진축, 바닥 쇠창살, 벽 관
P('flywheel_engine', E(11), 19, block=[(dx, -dy) for dx in range(3) for dy in range(2)])
P('driveshaft', E(3), 19, block=[(dx, 0) for dx in range(4)]); P('driveshaft', E(7), 19, block=[(dx, 0) for dx in range(4)])
FD('floor_grate', E(4), 17); FD('floor_grate', E(8), 17)
P('fuel_tank', E(14), 20); P('barrel_single', E(2), 17); P('fuel_tank', E(13), 16)
DEC('pressure_gauge', E(12), 14); DEC('valve_wheel', E(5), 15); DEC('tool_rack', E(10), 13)
pipe3 = {(E(x), 16) for x in range(2, 8)} | {(E(x), 16) for x in range(9, 13)}
m.over.append((pipe3, PS))
for c in pipe3: m.blocked.add(c)
# 짐칸(남동)
P('crate_stack', E(18), 17); P('crate_stack', E(20), 20); P('barrels_lashed', E(22), 17); P('ballast_sacks', E(25), 16, block=[(0, 0), (1, 0)])
P('barrel_single', E(27), 16); P('crate_stack', E(25), 20); P('barrels_lashed', E(23), 20); P('sea_chest', E(27), 18)
P('barrel_single', E(18), 19); FD('rope_coil', E(25), 18); DEC('tool_rack', E(19), 13); DEC('wall_lantern', E(26), 14)
glowc(E(26), 14.6, size=40, a=45); glowc(E(9), 14.6, size=40, a=45); glowc(E(22), 4.6, size=40, a=45)
# 땅 덩이(보정 패스): 갑판 빗물 둘·굴뚝 곁 기름때 / 기관실 화구 앞 석탄 가루·통로 기름 샘
def CELLS(rows): return {(x, y) for y, xs in rows.items() for x in xs}
PUD_A = CELLS({16: range(12, 16), 17: range(13, 16)})                                # 난간 띠에서 한 줄 띄운 작은 웅덩이
PUD_B = CELLS({18: range(34, 38), 19: range(33, 38), 20: range(34, 37)})
OIL_D = CELLS({19: range(45, 48), 20: range(45, 48), 21: range(45, 48)})                      # 굴뚝 밑 둥근 기름 덩이(돌출 없이)
COAL_E = CELLS({9: range(E(4), E(7)), 10: range(E(2), E(8)), 11: range(E(2), E(9))})        # 두 석탄 더미 밑동을 감싸고 앞으로 쏟아진 가루
OIL_E = CELLS({17: (E(13),), 18: range(E(13), E(17)), 19: range(E(13), E(16))})
for cells, sheet in ((PUD_A, PUDS), (PUD_B, PUDS), (OIL_D, OILS), (COAL_E, COALS), (OIL_E, OILS)):
    for c in cells:
        if m.fl[c[1]][c[0]] is None or c in rail: BAD.append(('blob', c))
    m.under.append((cells, sheet))
if BAD: print('배치 오류', BAD)

# ---------------------------------------------------------------- 통행: 층 이동 고리를 더한 BFS
LINKS = [((10, 18), (C(14), 6)), ((10, 18), (C(15), 6)),
         ((C(25), 25), (E(20), 6)), ((C(26), 25), (E(21), 6)),
         ((E(25), 6), (44, 20))]
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
ENT = (12, 31)
m.render()
reach = bfs_all(ENT)
WP = {'부두 입구': (12, 31), '탑승 발판 위': (12, 24), '조타륜 앞': (15, 21), '갑판실 문 앞': (10, 18), '주돛대 곁': (25, 20), '화물 창': (29, 20),
      '앞돛대 곁': (41, 20), '사다리 승강구 앞': (44, 20), '이물 끝': (56, 19),
      '선실 계단 위': (C(14), 6), '해도 탁자 앞': (C(15), 9), '선장실': (C(4), 10), '선원실': (C(24), 9), '복도': (C(15), 16), '식당': (C(8), 22), '창고 승강구': (C(25), 25),
      '기관실 오름 계단': (E(20), 6), '보일러 앞': (E(7), 10), '벽 사다리 밑': (E(25), 6), '축 통로': (E(6), 18), '플라이휠 곁': (E(14), 19), '짐칸': (E(24), 18)}
wp_res = {k: dict(at=list(v), reach=v in reach, steps=reach.get(v)) for k, v in WP.items()}
walk_total = sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
emp = dcheck.emptiness(m, stride=1)
def emp_region(x0, x1):
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    vals = []
    for y0 in range(0, H_ - 15 + 1):
        for xs in range(x0, x1 - 20 + 2):
            e = sum(1 for y in range(y0, y0 + 15) for x in range(xs, xs + 20) if m.is_walk(x, y) and (x, y) not in used)
            vals.append((round(e / 300.0, 3), (xs, y0)))
    vals.sort(reverse=True)
    return dict(max=vals[0][0], at=vals[0][1], over40=sum(1 for v in vals if v[0] > .4))
EMPR = {'갑판': emp_region(0, 65), '선실층': emp_region(OXC, OXC + 32), '기관실': emp_region(OXE, OXE + 32)}
print('empty by region', EMPR)
data = m.export(OUT, ENT, (15, 21), {}, extra=dict(kind='airship', emptiness=emp, emptiness_by_region=EMPR,
        regions={'갑판·하늘': [0, 65], '선실층': [OXC, OXC + 32], '기관실': [OXE, OXE + 32]},
        floor_links=[[list(a), list(b)] for a, b in LINKS], waypoints_with_links=wp_res,
        reach_all_with_links=len(reach), walkable_cells=walk_total, unreached_cells=walk_total - len(reach)))
print('walk', walk_total, 'reached', len(reach), 'unreached', walk_total - len(reach))
print('wp', {k: (v['reach'], v['steps']) for k, v in wp_res.items() if not v['reach']} or 'all reached')
print('parts', kit.save())
if os.environ.get('UNREACH'):
    print(sorted(c for c in ((x, y) for y in range(H_) for x in range(W_) if m.is_walk(x, y)) if c not in reach))

# ---------------------------------------------------------------- 비교 시트(보정 패스): 같은 2배율로 [이전 판 | 새 판] — 달라진 곳만
# 웨이브 2 의 [버들항 기준 | 비행선] 비교는 그 판 커밋(c2ee834b60 이전)의 compare-ref.png 에 남아 있다.
from PIL import ImageDraw, ImageFont
render = m.img
PREV = os.path.join(OUT, 'render-prev-1x.png')                                     # 보정 전 렌더(2026-10-08 오토타일 감사 보정 직전 판)
prev = Image.open(PREV).convert('RGBA') if os.path.exists(PREV) else render
_ff = [f for f in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf') if os.path.exists(f)]
_font = ImageFont.truetype(_ff[0], 14) if _ff else None
cw, ch = 300, 150
# 적대 검수 보정(2026-10-08, beodeul-kits/qa/airship.md): 이전 판 = 검수 받은 판(fd8215efcb) 렌더. 땅 덩이 셋 + 그물 낱개 조각.
# 웨이브 5 보정 전·후 비교는 7b92693efd, 빗물 윤곽 감사 보정 전·후는 fd8215efcb 의 compare-ref.png.
CR = [('고물·가운데 갑판: 빗물 웅덩이(회청 판 → 하늘 비친 물, 작게·난간에서 띄움)', (160, 220)), ('앞갑판: 빗물·굴뚝 밑 기름때(짐승 모양 구멍 → 둥근 얼룩)', (500, 250)),
      ('보일러실: 석탄 가루(알 격자·그을음 그림자 → 더미 밑동 가루)', (OXE * T + 8, 90))]
sheet = Image.new('RGBA', (2 * (cw * 2 + 8) + 8, len(CR) * (ch * 2 + 26) + 4), (24, 22, 30, 255)); dr = ImageDraw.Draw(sheet)
for r, (lab, (x0, y0)) in enumerate(CR):
    for i, (tag, src) in enumerate((('이전', prev), ('새 판', render))):
        x = 8 + i * (cw * 2 + 8); y = 4 + r * (ch * 2 + 26)
        sheet.alpha_composite(src.crop((x0, y0, x0 + cw, y0 + ch)).resize((cw * 2, ch * 2), Image.NEAREST), (x, y + 20))
        dr.text((x, y + 2), tag + ' — ' + lab, fill=(230, 226, 236, 255), font=_font)
# 마지막 줄: 그물 코·꼬리 조각을 혼자 하늘에 놓았을 때 — 이전(덧그림만, 줄이 허공에서 끊긴다) | 새 판(완성 조각)
def _alone(tail, nose):
    o = Image.new('RGBA', (cw, ch), (120, 160, 214, 255)); o.alpha_composite(tail.crop((0, 0, 128, 150)), (8, 0)); o.alpha_composite(nose.crop((0, 0, 96, 150)), (156, 0)); return o
y = 4 + len(CR) * (ch * 2 + 26)
sheet2 = Image.new('RGBA', (sheet.width, sheet.height + ch * 2 + 26), (24, 22, 30, 255)); sheet2.alpha_composite(sheet, (0, 0)); dr = ImageDraw.Draw(sheet2)
for i, (tag, t_, n_) in enumerate((('이전', RG.rigging_tail(), RG.rigging_nose()), ('새 판', RG.rigged_tail(), RG.rigged_nose()))):
    x = 8 + i * (cw * 2 + 8)
    sheet2.alpha_composite(_alone(t_, n_).resize((cw * 2, ch * 2), Image.NEAREST), (x, y + 20))
    dr.text((x, y + 2), tag + ' — envelope_rigging_tail·_nose 낱개(혼자 놓기)', fill=(230, 226, 236, 255), font=_font)
sheet2.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))
if os.environ.get('EMPDBG'):
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    x0 = int(os.environ['EMPDBG'])
    print('    ' + ''.join(str((x - x0) % 10) for x in range(x0, x0 + 33)))
    for y in range(H_):
        print('%3d ' % y + ''.join('.' if (m.is_walk(x, y) and (x, y) not in used) else ('#' if m.is_walk(x, y) or m.fl[y][x] is not None else ' ') for x in range(x0, min(W_, x0 + 33))))
