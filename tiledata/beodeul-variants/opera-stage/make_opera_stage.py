# 버들항 웨이브 2 — 극장(opera-stage): 무대와 객석·무대 뒤와 분장실·천장 대들보 통로. 다시 돌리면 같은 그림이 나온다.
#   python3 make_opera_stage.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png
# 한 맵(88×46)에 세 구역: 객석+무대 홀(x0~47, y0~35) · 무대 뒤·분장실(x48~79, y0~23, 무대 오른쪽 날개 통로로 이어짐) ·
# 천장 대들보 통로(x48~87, y26~45, 무대 뒤 벽 사다리 ↔ 통로 승강구로 오르내림). 박스석(2층)은 로비 큰 계단 ↔ 박스석 계단 구멍으로 잇는다.
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from os_kit import *
from os_kit import _hash
import os_kit as K
import os_stage as A1, os_hall as A2, os_back as A3, os_auto as AU
import os_fix as FX                                   # 보정 패스(2026-10-08): 땅 덩이 오토타일 셋·무대 널 변형·좌석·막 변형·빛줄기
import dcheck
assert OUT.endswith('opera-stage')

kit = Kit('opera-stage', '극장 — 무대와 객석·무대 뒤·천장 대들보 통로')
S = {}
SOFT = set()
def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img

# ---------------------------------------------------------------- 조각 등록 (새로 그린 것만)
# 무대
obj('drape_tied_left', A1.drape_tied(), '걷힌 붉은 막(왼쪽)', '금 막대에 걸린 진홍 벨벳 막이 왼쪽으로 걷혀 허리에서 금줄·술로 묶이고 아래로 퍼져 바닥에 고인 것(2×7).', '2×7칸, 아랫줄만 막힘(위 6줄은 걷기+가림). 무대 바닥 왼쪽 앞 모서리(무대 앞판 바로 위 줄)에 둔다. 오른쪽에는 drape_tied_right 를 대칭으로. 무대 가운데 금지.', soft=True)
obj('drape_tied_right', hflip(A1.drape_tied()), '걷힌 붉은 막(오른쪽)', '같은 막을 오른쪽으로 걷어 묶은 것(2×7).', '2×7칸, 아랫줄만 막힘. 무대 오른쪽 앞 모서리에 drape_tied_left 와 짝으로.', soft=True)
obj('valance_swag', A1.valance_swag(), '막 위 주름 띠', '평평한 벨벳 띠 아래로 두 자락이 처진 진홍 주름 띠와 금 술·방울(3×1, 가로로 이어 붙임).', '3×1칸 장식(벽 앞면 맨 윗줄 위, 걷기 무관). 무대 뒤벽 앞면 맨 윗줄을 따라 무대 폭만큼 3칸씩 이어 붙인다. 양 끝은 걷힌 막 꼭대기가 덮는다.', brows=0, kind='decal')
obj('backdrop_landscape', A1.backdrop_landscape(), '배경 그림판(낮)', '나무 막대에 건 캔버스에 붓으로 칠한 산·언덕·강·둥근 나무와 해(12×3, 글자 없음).', '12×3칸 장식(벽 앞면 위, 앞면 3줄 필요). 무대 뒤벽(검은 막 앞면) 가운데에 하나. 무대 위 소품이 아래를 조금 가려도 된다.', brows=0, kind='decal')
obj('backdrop_night', A1.backdrop_landscape(night=True), '배경 그림판(밤)', '같은 산·강 그림을 밤빛으로 칠한 판 — 달과 별(12×3).', '12×3칸 장식(벽 앞면 위). 밤 장면 무대에서 backdrop_landscape 대신. 한 무대에 하나만.', brows=0, kind='decal')
obj('footlight', A1.footlight(), '각광', '무대 턱에 얹은 놋쇠 조개 덮개 등(1×1).', '1칸 장식(무대 앞판 앞면 위). 무대 앞판을 따라 3~4칸 간격으로, 계단·프롬프터 덮개 자리는 건너뛴다. 빛무리와 함께.', brows=0, kind='decal')
obj('stage_steps', A1.stage_steps(), '무대 계단', '객석 바닥에서 무대 앞판을 넘어 무대로 오르는 짙은 나무 계단 세 단, 금 코판(2×2).', '2×2칸, 걷기. 무대 앞판 줄의 2칸을 바닥으로 열고, 그 칸과 바로 위 무대 끝 줄에 걸쳐 놓는다. 무대 양 끝 가까이 하나씩, 앞(남) 1칸 비움.', brows=0, kind='walk')
obj('prompter_hood', A1.prompter_hood(), '프롬프터 덮개', '무대 앞 가운데 바닥의 반구 나무 덮개와 금 테(2×1).', '2×1칸, 막힘 1줄. 무대 맨 앞 줄 한가운데 하나.')
obj('stage_lamp', A1.stage_lamp(), '무대 조명등', '세 다리 받침 멍에에 걸린 검은 원통 조명, 렌즈가 빛난다(1×2).', '1×2칸, 아랫줄만 막힘. 무대 날개·무대 뒤 벽가에 1~2개, 무대 쪽으로 향하게. 빛무리와 함께.', soft=True)
obj('tree_flat', A1.tree_flat(), '나무 배경판', '합판을 오려 칠한 둥근 나무와 뒤 버팀대·모래주머니(2×3).', '2×3칸, 아랫줄만 막힘. 무대 위 장면 소품으로 1~2개(대칭 금지, 높이를 엇갈리게), 무대 뒤 창고에서는 벽가에 기대 둔다.', soft=True)
obj('castle_flat', A1.castle_flat(), '성 배경판', '합판을 오려 칠한 톱니 성벽 탑 둘과 아치 문·깃발, 뒤 버팀대(3×3).', '3×3칸, 아랫줄만 막힘. 무대 한쪽 뒤편에 장면 배경으로, 또는 무대 뒤 창고 벽가에.', soft=True)
obj('stage_trapdoor', A1.stage_trapdoor(), '무대 함정문', '무대 널 사이 네모 덮개와 쇠 경첩·손잡이 고리(2×2).', '2×2칸 바닥 장식(걷기, 아래층 무대 밑 이동 이벤트에 쓴다). 무대 가운데 뒤편에 하나, 배경판·막과 2칸 띄운다.', brows=0, kind='decal')
obj('prop_throne', A1.prop_throne(), '소품 옥좌', '금칠 나무 옥좌 — 볏 장식 진홍 등받이와 팔걸이, 낮은 단(2×3).', '2×3칸, 아랫줄만 막힘. 무대 장면의 중심(성·궁전 장면)에 하나, 앞에 조명 웅덩이.', soft=True)
obj('arch_flat', A1.arch_flat(), '주랑 배경판', '합판을 오려 칠한 크림 돌 기둥 셋·아치 둘, 아치 너머 칠한 하늘과 정원(4×3).', '4×3칸, 아랫줄만 막힘. 무대 뒤편 장면 배경으로 배경 그림판 앞에, 또는 무대 뒤 창고 벽가에.', soft=True)
obj('set_rock', A1.set_rock(), '소품 바위', '종이 반죽으로 빚어 칠한 둥근 바위 둘과 이끼 붓 자국(2×2).', '2×2칸, 아랫줄만 막힘. 무대 앞쪽 양옆·배경판 발치에 1~2개(좌우 뒤집어 쓴다), 통로를 막지 않게.', soft=True)
obj('light_pool', A1.light_pool(), '조명 웅덩이', '위 조명이 무대 바닥에 떨어뜨린 따뜻한 타원 빛(3×2, 반투명).', '3×2칸 바닥 장식(걷기). 무대 위 배우 자리·배경판 앞에 1~3개, 서로 겹치지 않게.', brows=0, kind='decal')
# 오케스트라
obj('grand_piano', A1.grand_piano(), '그랜드 피아노', '검은 옻칠 날개 몸통에 비스듬히 세운 뚜껑과 금빛 현, 앞 건반(3×3).', '3×3칸, 아래 2줄 막힘(뚜껑 줄은 걷기+가림). 오케스트라 자리 한쪽 끝에 하나.', brows=2)
obj('music_chair', A1.music_chair(), '보면대 의자', '나무 의자와 앞의 쇠 보면대(악보는 줄만)(1×1).', '1칸, 막힘 1줄. 오케스트라 자리에 2~3개씩 어긋나게(일렬 금지), 지휘대를 향해 반원으로.')
obj('conductor_podium', A1.conductor_podium(), '지휘대', '벨벳 덮은 둥근 낮은 단과 금 손잡이 난간(1×1).', '1칸, 막힘 1줄. 오케스트라 난간 가운데 틈 곁, 객석 통로 끝에 하나.')
obj('timpani', A1.timpani(), '팀파니', '구리 솥 모양 북 둘과 북채(2×2).', '2×2칸, 아랫줄만 막힘. 오케스트라 자리 피아노 반대쪽 끝.', soft=True)
# 객석
obj('seat_row4', A2.seat_row4(), '객석 좌석 4석', '뒤에서 본 진홍 벨벳 좌석 넷 — 금테 둥근 등받이 머리, 놋쇠 번호판 자리, 사이 팔걸이(4×2).', '4×2칸, 아랫줄 4칸 막힘(등받이 머리가 위 줄로 4px 올라온다 — 위 줄은 걷기+가림). 2칸 간격 줄로 무대를 향해 깐다. 줄 사이 1칸은 걷는 통로.', soft=True)
obj('seat_row4b', A2.seat_row4b(), '객석 좌석 4석(흰 장갑)', '같은 줄인데 한 자리 등받이에 흰 장갑과 장미 한 송이가 걸쳐 있다(4×2).', '4×2칸, seat_row4 와 같다. 한 블록에 한두 번만 섞어 반복을 깬다.', soft=True)
obj('seat_row3_end_left', A2.seat_row3_endL(), '객석 좌석 3석(왼쪽 끝)', '좌석 셋과 왼쪽 끝 금 머리 짙은 나무 기둥, 발치 통로 등(3×2).', '3×2칸, 아랫줄 막힘. 블록 왼쪽(통로 쪽) 끝에.', soft=True)
obj('seat_row3_end_right', A2.seat_row3_endR(), '객석 좌석 3석(오른쪽 끝)', '좌석 셋과 오른쪽 끝 기둥·통로 등(3×2).', '3×2칸, 아랫줄 막힘. 블록 오른쪽(통로 쪽) 끝에.', soft=True)
obj('seat_row2', A2.seat_row2(), '객석 좌석 2석', '좌석 둘(2×2).', '2×2칸, 아랫줄 막힘. 줄 길이를 맞추거나 블록 폭을 줄일 때.', soft=True)
# 박스석
obj('box_chair', A2.box_chair(), '박스석 팔걸이 의자', '볏 장식 금테 높은 등받이의 단추 누빈 벨벳 팔걸이 의자(뒤에서 본다)(1×2).', '1×2칸, 아랫줄만 막힘. 박스 하나에 2개를 난간 쪽으로 나란히(무대를 향해), 뒤 통로 1칸 비움.', soft=True)
obj('box_divider', A2.box_divider(), '박스석 칸막이', '박스 사이 낮은 벽 — 금 갓돌, 금 판 테 벨벳 앞면, 가운데 늘어진 자락(3×2).', '3×2칸, 아랫줄 막힘(위 줄 걷기+가림). 박스석 단을 3~4줄마다 가로로 나눈다. 벽 쪽 1칸은 비워 박스끼리 뒤 통로로 잇는다.', soft=True)
obj('box_pilaster', A2.box_pilaster(), '박스석 금 기둥', '난간 줄 위에 서는 가는 금 기둥과 금 띠(1×4).', '1×4칸, 아랫줄만 막힘. 박스석 난간 줄의 칸막이 자리마다 하나.', soft=True)
obj('sconce_gold', A2.sconce_gold(), '금 벽등', '소용돌이 금 팔 위 젖빛 유리 튤립 갓 둘(1×1).', '1칸 장식(앞면 위, 가운데 줄). 객석·로비 벽 앞면에 4~6칸 간격. 빛무리와 함께.', brows=0, kind='decal')
obj('chandelier', A2.chandelier(), '큰 샹들리에', '금 줄기에 달린 금 고리 둘·초·수정 방울(4×3, 천장 걸개).', '4×3칸 위층 걸개(걷기+가림, 막힘 없음). 객석 한가운데 통로 위에 하나. 다른 샹들리에와 6칸 이상 띄운다. 빛무리와 함께.', brows=0, kind='decal')
obj('chandelier_small', A2.chandelier_small(), '작은 샹들리에', '금 고리 하나에 초와 수정 방울(2×2, 천장 걸개).', '2×2칸 위층 걸개(걷기+가림). 로비·박스석 위에 4칸 이상 간격으로.', brows=0, kind='decal')
# 로비
obj('marble_column', A2.marble_column(), '대리석 기둥', '금박 머리판·크림 대리석 원통·금 띠 받침(1×3).', '1×3칸, 아랫줄만 막힘. 로비 문 양옆에 쌍으로, 통로와 1칸 띄운다.', soft=True)
obj('potted_palm', A2.potted_palm(), '종려 화분', '놋쇠 띠 화분에서 부채처럼 휜 깃 잎(2×2).', '2×2칸, 아랫줄 가운데만 막힘. 로비 모서리·기둥 곁에.', soft=True)
obj('rope_barrier', A2.rope_barrier(), '벨벳 줄 기둥', '놋쇠 기둥 둘 사이 처진 진홍 벨벳 줄(2×1).', '2×1칸, 막힘 1줄. 매표소 줄·출입 통로 가장자리를 따라 이어 놓는다(통로를 막지 않게).')
obj('ticket_booth', A2.ticket_booth(), '매표소', '줄무늬 차양 지붕과 금 창살 아치 창의 짙은 나무 작은 집, 놋쇠 종(3×3).', '3×3칸, 아래 2줄 막힘. 로비 북쪽 벽가 한쪽에, 앞 1칸 비우고 벨벳 줄을 둔다.', brows=2)
obj('lobby_bench', A2.lobby_bench(), '벨벳 긴 의자', '단추 누빈 진홍 방석과 금 다리(2×1).', '2×1칸, 막힘 1줄. 로비 벽가·기둥 사이에.')
obj('urn_pedestal', A2.urn_pedestal(), '꽃 항아리 받침', '대리석 받침 위 금 항아리와 꽃 다발(1×2).', '1×2칸, 아랫줄만 막힘. 문·계단 양옆에 쌍으로.', soft=True)
obj('hall_door', A2.hall_door(), '객석 문틀', '벽을 뚫은 2칸 통로를 두른 금 문틀, 위 박공 머리와 등, 안으로 열어젖힌 붉은 가죽 문짝(4×3).', '4×3칸, 걷기(가운데 2열은 통로, 양옆 열은 벽 앞면 위). 로비와 객석 사이 벽(윗면 1줄 + 앞면 2줄)을 2칸 폭으로 뚫은 자리에 놓는다.', brows=0, kind='walk')
obj('entrance_rug', A2.entrance_rug(), '입구 깔개', '금실 테두리 진홍 깔개와 금 마름모(2×1).', '2×1칸 바닥 장식(걷기). 맵 출입구 칸 바로 안쪽.', brows=0, kind='decal')
obj('coat_check', A2.coat_check(), '외투 보관대', '대리석 계산대 뒤 놋쇠 막대에 걸린 외투·모자(3×2).', '3×2칸, 아래 2줄 막힘. 로비 벽가 매표소 반대쪽에.', brows=2)
obj('frame_painting', A2.frame_painting(), '액자 그림', '금 액자 속 초승달과 물결(1×2, 글자 없음).', '1×2칸 장식(앞면 2줄 위). 로비 벽 앞면에 벽등 사이로.', brows=0, kind='decal')
obj('grand_stair_up', A2.grand_stair_up(), '큰 계단 오름', '진홍 깔개를 놋쇠 막대로 누른 대리석 계단 네 단, 양옆 난간벽(2×2).', '2×2칸, 걷기(맨 윗줄 = 위층 박스석 이동 칸). 로비 북쪽 벽 앞면 바로 아래 바닥 위에, 그 위 앞면에 stair_arch. 위층 같은 열에 grand_stair_down.', brows=0, kind='walk')
obj('stair_arch', A2.stair_arch(), '계단 아치', '벽을 뚫은 둥근 아치 안으로 계단이 위층 빛 속으로 이어진다(2×2).', '2×2칸 장식(앞면 2줄 위). grand_stair_up 바로 위 앞면에 같은 열로.', brows=0, kind='decal')
obj('grand_stair_down', A2.grand_stair_down(), '큰 계단 내림', '박스석 바닥에 뚫린 계단 구멍 — 금 갓 난간 사이 진홍 깔개 계단이 남쪽 아래로 어두워진다(2×2).', '2×2칸, 걷기(맨 아랫줄 = 아래층 로비 이동 칸). 박스석 단 남쪽 끝 바닥 위에. 아래층 grand_stair_up 과 같은 열.', brows=0, kind='walk')
# 무대 뒤·분장실
obj('costume_rack', A3.costume_rack(), '의상 걸이', '바퀴 달린 쇠관 틀에 진홍 드레스·푸른 외투·금 망토·초록 윗옷(2×2).', '2×2칸, 아랫줄만 막힘. 무대 뒤·분장실 벽가에 1~2개(나란히 두되 높이를 엇갈리게).', soft=True)
obj('costume_trunk', A3.costume_trunk(), '의상 상자', '뚜껑을 젖혀 연 여행 상자에서 넘친 벨벳 자락과 금 왕관(2×2).', '2×2칸, 아랫줄만 막힘(젖힌 뚜껑 줄은 걷기+가림). 분장실·창고 벽가에.', soft=True)
obj('hat_stand', A3.hat_stand(), '모자 걸이', '세 다리 나무 기둥에 높은 모자·깃털 모자·깃털 목도리(1×2).', '1×2칸, 아랫줄만 막힘. 분장실 구석에 하나.', soft=True)
obj('vanity_mirror', A3.vanity_mirror(), '분장 거울 화장대', '전구가 둘린 거울과 분 통·붓·향수병이 놓인 화장대(2×2).', '2×2칸, 아랫줄만 막힘. 분장실 북쪽 벽 앞면 바로 아래 줄에 x 를 맞춰 2~3개, 거울 줄은 벽 앞면 위. 앞에 dressing_stool.', soft=True)
obj('folding_screen', A3.folding_screen(), '병풍 가리개', '꽃 넝쿨 비단 세 폭 가리개에 걸쳐 둔 드레스(2×3).', '2×3칸, 아랫줄만 막힘. 분장실 구석에 하나.', soft=True)
obj('dressing_stool', A3.dressing_stool(), '둥근 분장 의자', '벨벳 방석 낮은 둥근 의자(1×1).', '1칸, 막힘 1줄. 화장대 앞 칸에.')
obj('flat_stack', A3.flat_stack(), '배경판 더미', '벽에 기대 세운 배경판 넷(뒤 틀·캔버스, 맨 앞 판 칠한 끝)(3×3).', '3×3칸, 3줄 전부 막힘(벽에 기댄다). 무대 뒤 창고 북쪽 벽 앞면 바로 아래에.', brows=3)
obj('rope_pinrail', A3.rope_pinrail(), '밧줄 걸이 난간', '벽 나무 난간의 쐐기못에 8자로 맨 밧줄이 위로 뻗고, 감은 밧줄 다발(3×2).', '3×2칸 장식(앞면 2줄 이상 위). 무대 날개·무대 뒤 벽 앞면에. 아래 바닥에 rope_coil·모래주머니.', brows=0, kind='decal')
obj('pulley_block', A3.pulley_block(), '도르래', '쇠 갈고리에 매단 나무 도르래와 밧줄(1×1).', '1칸 장식(앞면 위). 밧줄 걸이 난간 곁 벽 앞면 위쪽에.', brows=0, kind='decal')
obj('prop_crate', A3.prop_crate(), '소품 상자', '소품 칼 자루와 종이 꽃이 꽂힌 나무 상자(1×1).', '1칸, 막힘 1줄. 창고 벽가에 2~3개 덩이로.')
obj('prop_shelf', A3.prop_shelf(), '소품 선반', '왕관·잔·투구·랜턴·과일 그릇·두루마리가 놓인 세 단 선반(2×3).', '2×3칸, 아래 2줄 막힘. 창고 벽가에, 앞 1칸 비움.', brows=2)
obj('sandbag_pile', A3.sandbag_pile(), '모래주머니 더미', '캔버스 모래주머니 셋(1×1).', '1칸, 막힘 1줄. 밧줄 걸이·평형추 곁에.')
obj('wall_ladder', A3.wall_ladder(), '벽 사다리', '벽을 따라 천장 통로로 오르는 나무 사다리, 위는 어둠 속 승강구(1×3).', '1×3칸 장식(앞면 3줄 위). 무대 뒤 북쪽 벽 앞면에, 발치 바닥 칸이 위층 이동 칸. 위층 같은 이동 짝에 ladder_hatch.', brows=0, kind='decal')
# 천장 대들보 통로
obj('hanging_spot', A3.hanging_spot(), '매단 조명', '통로 난간 관에 죔쇠로 단 검은 원통 조명(위에서 본 모습)(1×1).', '1칸 장식(통로 옆 깊이 칸 위, 막힘). 대들보 통로 가장자리 바로 바깥 깊이 칸에, 아래 남쪽으로 빛 기둥·조명 웅덩이.', brows=0, kind='decal')
obj('batten_drop', A3.batten_drop(), '배경막 막대', '쇠관에 말아 올린 캔버스 배경막(1×1, 가로로 이어 붙임).', '1칸 장식(깊이 칸 위). 깊이를 가로로 가로질러 3칸 이상 이어 붙인다. 통로와 겹치는 칸은 통로가 덮는다.', brows=0, kind='decal')
obj('beam_span', A3.beam_span(), '대들보', '무대 위를 가로지르는 굵은 지붕 들보의 윗면과 앞면 두께, 쇠 띠(1×1, 가로로 이어 붙임).', '1칸 장식(깊이 칸 위, 걷기 아님). 깊이를 벽에서 벽까지 가로질러 이어 붙인다. 통로가 그 위를 지난다.', brows=0, kind='decal')
obj('counterweight_arbor', A3.counterweight_arbor(), '평형추 틀', '안내 레일 사이 쇠 틀에 쌓은 평형추와 위로 오르는 쇠줄(1×3).', '1×3칸, 아랫줄만 막힘. 대들보 통로 북쪽 벽(하역 회랑) 벽가에 2~4개, 1칸씩 띄워 늘어놓는다.', soft=True)
obj('rope_coil', A3.rope_coil(), '밧줄 사리', '바닥에 둥글게 사린 삼 밧줄(1×1).', '1칸 바닥 장식(걷기). 밧줄 걸이·감는 틀 곁에 1~2개.', brows=0, kind='decal')
obj('spot_winch', A3.spot_winch(), '감는 틀', 'A자 받침 사이 밧줄 감긴 나무 북과 손잡이 바퀴(2×2).', '2×2칸, 아래 2줄 막힘. 통로 끝 작은 받침대·무대 뒤 벽가에.', brows=2)
obj('hanging_ropes', A3.hanging_ropes(), '늘어진 밧줄', '아래 무대로 늘어진 밧줄 둘과 모래주머니(1×2).', '1×2칸 장식(깊이 칸 위). 통로 곁 깊이에 2~3곳 흩어서.', brows=0, kind='decal')
obj('ladder_hatch', A3.ladder_hatch(), '승강구 사다리', '통로 바닥 구멍 속으로 내려가는 사다리 꼭대기(2×1).', '2×1칸, 걷기(아래층 이동 칸). 하역 회랑 바닥 한쪽 끝에. 아래층 wall_ladder 발치와 짝.', brows=0, kind='walk')

# 보정 패스(2026-10-08) 새 조각
obj('seat_row4_hat', FX.seat_row4_hat(), '객석 좌석 4석(높은 모자)', '같은 좌석 줄인데 한 자리 등받이 머리에 검은 비단 높은 모자가 얹혀 있고 지팡이가 기대 있다(4×2).', '4×2칸, seat_row4 와 같다(아랫줄 막힘). 한 객석에 2~3번만, 같은 줄에 두 번 쓰지 않는다.', soft=True)
obj('seat_row4_shawl', FX.seat_row4_shawl(), '객석 좌석 4석(레이스 숄)', '한 자리 등받이에 크림 레이스 숄 자락이 걸쳐 늘어지고 접은 부채가 꽂혀 있다(4×2).', '4×2칸, seat_row4 와 같다. 한 객석에 2~3번만, 앞쪽 줄에.', soft=True)
obj('seat_row4_program', FX.seat_row4_program(), '객석 좌석 4석(안내 책자)', '팔걸이 머리 두 곳에 접은 진홍 표지 안내 책자, 등받이에 오페라 안경(4×2, 글자 없음).', '4×2칸, seat_row4 와 같다. 뒤쪽 줄에 섞어 반복을 깬다.', soft=True)
obj('valance_swag_crest', FX.valance_swag_crest(), '막 위 주름 띠 가운데 판', '주름 띠 가운데 금 방패 판에 희극·비극 두 탈(눈·입 모양만, 글자 없음)(3×1).', '3×1칸 장식. valance_swag 를 무대 폭만큼 이어 붙인 띠의 한가운데 한 칸 자리를 이것으로 바꾼다. 한 무대에 하나.', brows=0, kind='decal')
obj('curtain_leg', FX.curtain_leg(), '다리막(곧은 세로 막)', '무대 날개 입구를 가리는 곧게 늘어진 진홍 벨벳 세로 막, 위 주름 머리띠·아래 금 술 단(1×5).', '1×5칸, 아랫줄만 막힘(위 4줄은 걷기+가림). 무대와 날개 통로가 만나는 입구 한쪽에 1개, 통로 폭을 2칸 이상 남긴다.', soft=True)
obj('drape_puddle', FX.drape_puddle(), '바닥에 고인 막 자락', '큰 막 발치에서 넘쳐 바닥에 고인 진홍 벨벳 자락과 금 술 끝(2×1).', '2×1칸 바닥 장식(걷기, 낮은 천). 걷힌 막(drape_tied_*)·다리막 발치 바로 옆 무대 바닥에.', brows=0, kind='decal')
obj('spot_beam', FX.spot_beam(), '스포트라이트 빛줄기', '천장 조명교에서 비스듬히 내리꽂혀 아래 빛 웅덩이에 닿는 반투명 빛 원뿔 — 가장자리 밝은 띠, 속 먼지(3×5).', '3×5칸 위층 덧그림(걷기+가림, 막힘 없음). 아래 끝이 autotile-spotlight-pool 덩이 윗변 1칸 위에 닿게. 한 무대에 1~2개(모든 웅덩이에 달지 않는다).', brows=0, kind='decal')

def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower')
ground('stage-boards', 'op_stage', '짙은 무대 널', '동서로 누운 짙은 6px 널, 줄마다 어긋난 마디·못·반들거림 3×3 표본.', '무대·날개 통로·오케스트라 자리 바닥. 3×3 이어 붙여도 이음새가 없다.')
ground('stage-boards-worn', 'op_stage2', '밟혀 닳은 무대 널', '짙은 무대 널과 같은 줄에 두 번째 이음·배우 동선대로 닳아 반들거리는 결·긁힘·무대 위치 표시 노랑 테이프 L 자·튄 물감 점 3×3 표본.', '무대 한가운데(배우가 서는 곳)에 덩이로. 가장자리·날개는 ground-stage-boards. 둘은 널 줄이 맞아 이웃해도 이음새가 없다.')
ground('marble-lobby', 'op_marble', '로비 대리석', '크림 대리석 두 톤 바둑판, 판마다 다른 맥, 네 판이 만나는 점 검은 마름모 상감 3×3 표본.', '극장 로비·현관. 진홍 깔개와 함께.')
ground('hall-parquet', 'op_parquet', '객석 쪽마루', '마호가니 널을 8px 칸마다 가로·세로로 번갈아 짠 바구니 쪽마루 3×3 표본.', '객석·박스석·분장실 바닥. 좌석 줄 밑에 깔린다.')
kit.add('face_hall_3h', face_sample('op_hall', 3, 3), 'wall', '객석 벽 앞면(3줄)', '금 처마 몰딩·붉은 꽃 벽지·금 띠·짙은 나무 징두리 판·걸레받이(3칸 폭 표본).', '객석·로비·분장실 천장 밑에 2~3줄. 무늬는 칸 x 로 이어진다.', 0, role='wall')
kit.add('face_drape_3h', face_sample('op_drape', 3, 3), 'wall', '무대 뒤벽 검은 가림막(3줄)', '걸쇠 막대에서 세로 주름으로 늘어진 검은 벨벳 막(3칸 폭 표본).', '무대 바닥 북쪽 벽 앞면 3줄. 그 위에 배경 그림판·주름 띠.', 0, role='wall')
kit.add('face_brick_3h', face_sample('op_back', 3, 3), 'wall', '무대 뒤 벽돌 벽(3줄)', '어긋 쌓은 벽돌, 아래는 검게 칠한 띠(3칸 폭 표본).', '무대 뒤·날개 통로·대들보 통로 북쪽 벽 앞면 3줄.', 0, role='wall')
kit.add('face_apron_1h', face_sample('op_apron', 3, 1), 'wall', '무대 앞판(1줄)', '무대 바닥 남쪽 끝의 금 턱과 짙은 나무 들어간 판(3칸 폭 표본).', '무대 바닥과 객석 바닥 사이 1줄(막힘). 그 위에 footlight, 2칸을 열어 stage_steps.', 0, role='wall')
kit.add('face_boxfront_1h', face_sample('op_box', 3, 1), 'wall', '박스석 앞면(1줄)', '벨벳 쿠션 턱·금 알 무늬 띠·크림 판 금 소용돌이(3칸 폭 표본).', '박스석 단 남쪽 끝 바로 아래 1줄(막힘).', 0, role='wall')
kit.add('ceiling_hall', ceiling_sample(K.hall_ceiling), 'wall', '객석 천장', '어두운 천장 + 크림 회벽 몰딩 띠와 금 턱(3×3 표본).', '객석·로비 벽 너머. 열린 칸에 닿은 쪽만 밝은 띠.', 0, role='wall')
kit.add('ground-flyspace', K.abyss_sample(), 'wall', '대들보 아래 무대 깊이', '천장 통로에서 내려다본 10m 아래 무대 — 절반 크기로 눌린 짙은 널과 먼지(3×3 표본).', '대들보 통로 맵에서 통로가 아닌 칸 전부(막힘). 조명 웅덩이는 지도가 더한다.', 0, role='wall')
CS = AU.carpet_sheet(); RS = AU.rail_sheet(); WS = AU.catwalk_sheet()
kit.add('autotile-carpet-crimson', CS, 'autotile', '진홍 통로 깔개', '진홍 윤곽·금실 두 줄·짙은 띠 테두리, 속은 잔 금점 16변형. 끝은 금 술.', '폭 2칸으로 입구에서 객석 가운데 통로를 지나 무대 앞까지. 박스석 바닥 전체. 걷기.', 0, layer='lower', role='terrain')
kit.add('autotile-gilt-rail', RS, 'autotile', '금 난간', '벨벳 감싼 손잡이 + 금 난간동자, 끝·모서리 금 공 머리 기둥 16변형.', '박스석 단 가장자리·오케스트라 자리 남쪽을 두른다. 모든 변형 막힘. 출입 틈은 끝에만.', 1, layer='upper', role='fence')
SPS, SHS, PES = FX.sheets()
kit.add('autotile-spotlight-pool', SPS, 'autotile', '스포트라이트 빛 웅덩이', '무대 널 위 반투명 따뜻한 빛 덩이 16변형(위 1·오른쪽 2·아래 4·왼쪽 8): 바깥 점 번짐 → 주황 테 → 밝은 초점 테 → 고른 크림 빛과 드문 먼지 반짝. 널 결이 비친다.', '아래층 투명 덧그림, 걷기. 배우 자리·옥좌·배경판 앞에 2×2~4×3 덩이로, 줄마다 폭을 바꿔 둥글고 울퉁불퉁하게(네모 금지). 무대에 2~4개, 서로 2칸 이상 띄운다. 웅덩이 하나에는 위에 spot_beam 을 달아도 된다. autotile-stage-shadow 와 겹치지 않게.', 0, layer='lower', role='terrain')
kit.add('autotile-stage-shadow', SHS, 'autotile', '무대 어둠', '반투명 짙은 남보라 그늘 덩이 16변형: 속은 고른 어둠, 가장자리 3단 바둑 점 번짐. 아래 바닥이 비친다.', '아래층 투명 덧그림, 걷기. 무대 뒤 구석·날개 입구·막 뒤·오케스트라 자리(무대 아래)·무대 뒤 창고 벽가에 3~8칸 덩이로. 빛 웅덩이 곁에 두면 명암이 산다. 통로 깔개·로비에는 쓰지 않는다.', 0, layer='lower', role='terrain')
kit.add('autotile-rose-petals', PES, 'autotile', '무대에 던진 장미 꽃잎', '커튼콜에 객석에서 던진 진홍·분홍 장미 꽃잎과 드문 초록 잎 16변형: 속은 흩은 꽃잎, 가장자리로 갈수록 성기고 작다. 바닥이 사이로 보인다.', '아래층 투명 덧그림, 걷기. 무대 앞쪽(무대 앞판 바로 위 1~2줄) 가운데에 4~10칸 길쭉한 덩이 하나. 공연 뒤 장면에만.', 0, layer='lower', role='terrain')
kit.add('autotile-catwalk', WS, 'autotile', '대들보 통로 널', '길 방향 널, 열린 쪽에 쇠 관 난간·발판 턱·남쪽 들보 두께 16변형.', '무대 깊이 칸 위에 폭 1~2칸으로 깔아 걷는 길을 만든다(걷기). 하역 회랑 바닥과 이웃으로 친다.', 0, layer='lower', role='terrain')

# ---------------------------------------------------------------- 지도
W_, H_ = 88, 46
class OMap(KMap):
    def __init__(s, *a):
        super().__init__(*a); s.abyss = set(); s.cface = {}; s.lights = []; s.walkov = []
    def compute_faces(s):
        super().compute_faces()
        for c in list(s.face):
            if c in s.abyss: del s.face[c]
        for c, v in s.cface.items(): s.face[c] = v
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
                    im.alpha_composite(K.op_face_tile(sty, x, n - k, capL, capR, n * T), P)
                elif (x, y) in s.abyss:
                    t = new()
                    ledge = s.inb(x, y - 1) and s.fl[y - 1][x] is not None and (x, y - 1) not in s.walkcells
                    for yy in range(T):
                        for xx in range(T):
                            X = x * T + xx; Y = y * T + yy
                            c = K.abyss_px(X, Y)
                            if ledge and yy < 6: c = (WD[5], WD[3], WD[3], WD[2], (16, 14, 26), mix(c, (8, 6, 14), .6))[yy]
                            t.putpixel((xx, yy), tuple(c) + (255,))
                    im.alpha_composite(t, P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face or (xx, yy) in s.abyss)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    sd = int(_hash(x, y, 4) * 4)
                    im.alpha_composite(K.hall_ceiling(o8, sd) if (x < 48 and y < 36) else AK.wood_ceiling(o8, sd), P)
        for (x, y, img) in s.under_decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for cells, sheet, nb in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(nb, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for (px_, py_, img) in s.lights: im.alpha_composite(img, (int(px_), int(py_)))
        for cells, sheet in s.over:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

m = OMap(W_, H_, 'opera-stage')
m.walkcells = set(); m.under_decals = []
BAD = []
def R(x0, y0, x1, y1, kind, wh=3, sty='op_hall'):
    m.floor(x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
def P(name, x, y, block=None, layer=1, check=True, img=None):
    """조각을 (x, y)(= 왼쪽 아래 칸)에 놓는다. block 이 없으면 메타의 brows 로 발자국을 잰다."""
    img = img or S[name]
    br = kit.meta[name]['brows']
    if block is None:
        block = [] if br == 0 else foot(img, br, 10, name in SOFT)
    if check:
        for (bx, by) in block:
            c = (x + bx, y + by)
            if not (m.inb(*c) and m.fl[c[1]][c[0]] is not None and c not in m.blocked): BAD.append((name, x + bx, y + by))
    m.props_add(x, y, img, block, layer)
def DEC(name, x, y, img=None, need_face=True):
    img = img or S[name]; m.compute_faces(); w = -(-img.width // T); h = -(-img.height // T)
    if need_face:
        for j in range(h):
            for i in range(w):
                if (x + i, y + j) not in m.face: BAD.append((name + '@face', x + i, y + j))
    m.decal(x, y, img)
def FD(name, x, y, img=None): m.decal(x, y, img or S[name])
def glowc(cx, cy, col=(255, 190, 110), size=56, a=60): m.glow_at(cx + .5, cy + .5, glow(size, col, a))
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]

# ======== 객석+무대 홀 (x0~47, y0~35) ========
R(8, 7, 39, 12, 'op_stage', 3, 'op_drape')                  # 무대 바닥(뒤벽 = 검은 가림막 3줄)
R(40, 8, 49, 11, 'op_stage', 3, 'op_back')                  # 무대 오른쪽 날개 통로 → 무대 뒤
R(6, 14, 41, 27, 'op_parquet', 3, 'op_hall')                # 객석 바닥
R(1, 14, 6, 26, 'op_parquet', 3, 'op_hall'); R(41, 14, 46, 26, 'op_parquet', 3, 'op_hall')   # 박스석 단(2층) 서·동
R(12, 14, 35, 15, 'op_stage', 3, 'op_hall')                 # 오케스트라 자리
for x in range(8, 40): m.wh[14][x] = 1; m.sty[14][x] = 'op_apron'          # 무대 앞판 1줄(y13)
STAGE_WORN = {(x, y) for y in range(8, 13) for x in range(12, 36)} - {(12, 8), (13, 8), (34, 8), (35, 8), (12, 12), (35, 12), (35, 11)} | {(x, 7) for x in range(17, 30)}
for (x, y) in STAGE_WORN: m.fl[y][x] = 'op_stage2'                           # 보정: 무대 한가운데 = 밟혀 닳은 널
for x in (10, 11, 36, 37): R(x, 13, x, 13, 'op_stage', 1, 'op_apron')       # 무대 계단 자리
R(6, 28, 7, 30, 'op_parquet', 1); R(40, 28, 41, 30, 'op_parquet', 1); R(23, 28, 24, 30, 'op_parquet', 1)   # 객석 ↔ 로비 문 통로
R(1, 31, 46, 34, 'op_marble', 2, 'op_hall')                 # 로비
R(23, 35, 24, 35, 'op_marble', 1)                           # 바깥 출입 칸
for x in list(range(1, 7)) + list(range(41, 47)): m.cface[(x, 27)] = ('op_box', 1, 1)   # 박스석 단 앞면

# ======== 무대 뒤·분장실 (x48~79, y0~23) ========
R(50, 6, 65, 17, 'as_engine', 3, 'op_back')                     # 무대 뒤 창고(16×12)
m.cut(50, 17, 3, 1); m.cut(63, 16, 3, 2)
R(66, 10, 67, 11, 'as_engine', 2, 'op_back')                    # 분장실 문 통로
R(68, 6, 75, 14, 'op_parquet', 3, 'op_hall')                # 분장실(8×9)
m.cut(75, 14, 1, 1)

# ======== 천장 대들보 통로 (x48~87, y26~45) ========
R(50, 29, 86, 30, 'as_engine', 3, 'op_back')                    # 하역 회랑(북쪽 벽가 고정 바닥)
R(50, 41, 53, 44, 'as_engine', 1, 'op_back')                    # 서쪽 조명 받침대
CW = set()
for y in range(31, 44): CW.add((56, y)); CW.add((68, y))
for y in range(31, 41): CW.add((80, y))
for x in range(56, 81): CW.add((x, 37))
for x in range(54, 69): CW.add((x, 43))
for (x, y) in CW: m.fl[y][x] = 'plank'; m.wh[y][x] = 1; m.sty[y][x] = 'op_back'
m.walkcells = set(CW)
for y in range(31, 45):
    for x in range(50, 87):
        if m.fl[y][x] is None: m.abyss.add((x, y))
m.compute_faces()

# ---------------- 무대
DEC('backdrop_landscape', 18, 4)
_val = new(32 * T, T)
for i in range(0, 32, 3): _val.alpha_composite(S['valance_swag'] if i != 15 else S['valance_swag_crest'], (i * T, 0))
m.decal(8, 4, _val)
P('drape_tied_left', 8, 12); P('drape_tied_right', 38, 12)
P('stage_steps', 10, 13, block=[]); P('stage_steps', 36, 13, block=[])
P('prompter_hood', 23, 12, block=[(0, 0), (1, 0)])
P('castle_flat', 11, 9); P('tree_flat', 33, 8); P('tree_flat', 30, 10); P('arch_flat', 17, 8)
P('prop_throne', 23, 9); FD('stage_trapdoor', 19, 11)

P('set_rock', 32, 12); P('set_rock', 14, 12, img=hflip(S['set_rock'])); P('stage_lamp', 37, 9); P('sandbag_pile', 37, 8)
P('stage_lamp', 16, 10); FD('rope_coil', 12, 12); FD('drape_puddle', 10, 11); FD('drape_puddle', 36, 11, img=hflip(S['drape_puddle'])); P('set_rock', 17, 11, img=hflip(S['set_rock'])); P('sandbag_pile', 20, 12); P('tree_flat', 26, 8, img=hflip(S['tree_flat'])); P('sandbag_pile', 28, 8); P('stage_lamp', 21, 8); FD('rope_coil', 22, 7)
# 보정: 둥근 반투명 타원 다섯 → 땅 덩이 오토타일(빛 웅덩이 셋·어둠·꽃잎), 가운데 웅덩이 위 빛줄기
def blob(rows, x0, y0):
    return {(x0 + i, y0 + j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch == 'X'}
POOL_C = blob([".XXXX.", "XXXXXX", "XXXXX.", ".XXX.."], 21, 8)          # 옥좌 앞 가운데
POOL_L = blob(["XXX.", "XXXX", ".XX."], 14, 10)                         # 성 배경판 앞
POOL_R = blob([".XX", "XXX", "XX."], 30, 9)                             # 나무 배경판 앞
SHADE = blob(["XXX", "XX.", "X.."], 8, 7) | blob(["..XX", ".XXX", "..XX"], 36, 7) | blob(["XXXXXXXX..", ".XXXXXXXXX", "..XXXXX..."], 40, 8) \
      | blob(["XXX", "XX."], 12, 14) | blob([".XX", "XXX"], 33, 14) | blob(["XXXX.....XXX", "XX.......XX."], 50, 6) | blob(["XXX", "XX."], 63, 6)
SHADE -= {(x, y) for (x, y) in SHADE if m.fl[y][x] is None}
PETALS = blob(["...XXXX....", ".XXXXXXXXX.", "XXXX...XXXX"], 18, 10) - POOL_C
PETALS = {c for c in PETALS if c[1] <= 12}
m.under.append((SHADE, SHS, SHADE)); m.under.append((PETALS, PES, PETALS))
for pool in (POOL_C, POOL_L, POOL_R): m.under.append((pool, SPS, pool))
m.overlays.append((22 * T, 4 * T - 4, S['spot_beam']))
P('urn_pedestal', 7, 14); P('urn_pedestal', 40, 14)
for x in (13, 17, 21, 26, 30, 34): m.decal(x, 13, S['footlight']); glowc(x, 12.7, (255, 200, 120), 40, 60)
P('stage_lamp', 9, 9); P('stage_lamp', 39, 8)
m.glow_at(24, 9, glow(120, (255, 210, 150), 34))
# 오케스트라 자리: 피아노(서)·보면대 반원·팀파니(동), 남쪽 금 난간과 가운데 지휘대
P('grand_piano', 12, 15)
for (x, y) in ((16, 15), (18, 14), (20, 15), (22, 14), (26, 14), (28, 15), (30, 14), (31, 15), (24, 14)): P('music_chair', x, y)
P('potted_palm', 38, 16, block=[(1, 0)]); P('potted_palm', 8, 16, block=[(1, 0)], img=hflip(S['potted_palm']))
P('timpani', 33, 15)
rail_pit = {(x, 16) for x in range(12, 23)} | {(x, 16) for x in range(25, 36)}
P('conductor_podium', 23, 16, check=False)
m.over.append((rail_pit, RS))
for c in rail_pit: m.blocked.add(c)
# ---------------- 객석: 좌석 줄(블록 둘), 가운데 통로 깔개, 샹들리에
ROWS = [18, 20, 22, 24, 26]
LEFT = [('seat_row3_end_left', 3), ('seat_row4', 4), ('seat_row4b', 4), ('seat_row3_end_right', 3)]
LEFT2 = [('seat_row3_end_left', 3), ('seat_row4b', 4), ('seat_row4', 4), ('seat_row3_end_right', 3)]
MID = [('seat_row4', 'seat_row4_shawl'), ('seat_row4_hat', 'seat_row4'), ('seat_row4b', 'seat_row4'), ('seat_row4', 'seat_row4_program'),
       ('seat_row4_program', 'seat_row4b'), ('seat_row4', 'seat_row4_hat'), ('seat_row4_shawl', 'seat_row4'), ('seat_row4b', 'seat_row4_program'),
       ('seat_row4', 'seat_row4b'), ('seat_row4_program', 'seat_row4')]                    # 보정: 4석 변형 다섯을 블록·줄마다 다르게
for i, y in enumerate(ROWS):
    for bj, x0 in enumerate((8, 26)):
        a_, b_ = MID[i * 2 + bj]
        order = [('seat_row3_end_left', 3), (a_, 4), (b_, 4), ('seat_row3_end_right', 3)]
        x = x0
        for (n, w) in order:
            P(n, x, y, block=[(dx, 0) for dx in range(w)]); x += w
carpet = {(x, y) for x in (23, 24) for y in range(17, 35)}
m.under.append((carpet, CS, carpet))
m.overlays.append(((22 * T), 19 * T + 6, S['chandelier'])); m.glow_at(24, 21.5, glow(110, (255, 220, 160), 40))
for (x, y) in ((7, 12), (40, 12)): DEC('sconce_gold', x, y); glowc(x, y, size=40, a=50)
# ---------------- 박스석(서·동): 난간·칸막이·금 기둥·의자·계단 구멍·작은 샹들리에
box_carpet = set()
for (bx, rx, cx_) in ((1, 6, 1), (41, 41, 46)):
    rail = {(rx, y) for y in range(14, 27)}
    m.over.append((rail, RS))
    for c in rail: m.blocked.add(c)
    xs = [x for x in range(bx, bx + 6) if x != rx]
    box_carpet |= {(x, y) for x in xs for y in range(14, 27)}
    inner = [x for x in xs if x != cx_]                    # 칸막이·의자 3열(뒤 통로 열 cx_ 제외)
    x0 = min(inner)
    for yd in (17, 21): P('box_divider', x0, yd, block=[(dx, 0) for dx in range(3)])
    for yp in (17, 21): P('box_pilaster', rx, yp, block=[], check=False)
    near = [x for x in inner if abs(x - rx) <= 2]
    for yc in (15, 19, 23):
        for x in near: P('box_chair', x, yc)
    sx = inner[0] if rx == 6 else inner[-2]
    P('grand_stair_down', sx, 26, block=[])
m.under.append((box_carpet, CS, box_carpet))
for (x, y) in ((2, 15), (43, 15)): m.overlays.append((x * T, y * T - 8, S['chandelier_small'])); glowc(x + .5, y + .2, (255, 220, 160), 44, 40)
# ---------------- 로비
for (x, y) in ((22, 30), (5, 30), (39, 30)): P('hall_door', x, y, block=[], check=False)
for (sx, ) in ((2,), (44,)):
    P('grand_stair_up', sx, 32, block=[]); DEC('stair_arch', sx, 29)
FD('entrance_rug', 23, 34)
P('ticket_booth', 9, 32, block=[(dx, -dy) for dx in range(3) for dy in range(2)])
P('rope_barrier', 9, 34); P('rope_barrier', 13, 33)
P('coat_check', 32, 32, block=[(dx, -dy) for dx in range(3) for dy in range(2)])
P('marble_column', 20, 33); P('marble_column', 27, 33)
P('lobby_bench', 15, 34); P('lobby_bench', 37, 34)
P('potted_palm', 18, 34, block=[(1, 0)]); P('potted_palm', 28, 34, block=[(0, 0)])
P('urn_pedestal', 4, 32); P('urn_pedestal', 43, 32); P('urn_pedestal', 8, 31); P('urn_pedestal', 39, 31)
for x in (14, 17, 30, 35): DEC('frame_painting', x, 29)
for x in (12, 20, 27, 42): DEC('sconce_gold', x, 29); glowc(x, 29, size=40, a=50)
for x in (13, 34): glowc(x + .5, 32, (255, 220, 160), 64, 36)

# ======== 무대 뒤 소품 ========
# 날개 통로(x40~49): 밧줄 걸이·도르래·모래주머니·밧줄 사리·조명등
DEC('rope_pinrail', 42, 6); DEC('pulley_block', 46, 5)
P('sandbag_pile', 43, 8); P('sandbag_pile', 44, 8); FD('rope_coil', 45, 8)
P('curtain_leg', 40, 11); P('stage_lamp', 48, 8); P('costume_rack', 41, 11); P('prop_crate', 47, 11); P('prop_crate', 48, 11); P('sandbag_pile', 49, 8); P('prop_crate', 44, 11); FD('rope_coil', 46, 11); P('prop_crate', 49, 11); P('sandbag_pile', 46, 8)
# 창고(x50~65): 북쪽 벽 = 밧줄 걸이·도르래·벽 사다리, 벽가에 기대 둔 배경판들, 가운데 의상 걸이·소품
DEC('rope_pinrail', 51, 4); DEC('pulley_block', 54, 3); DEC('pulley_block', 58, 3)
DEC('wall_ladder', 63, 3)
P('tree_flat', 50, 8, block=[(0, 0), (1, 0), (0, -1), (1, -1), (0, -2), (1, -2)])
P('flat_stack', 52, 8, block=BX(3, 3))
P('castle_flat', 55, 8, block=BX(3, 3))
P('arch_flat', 58, 8, block=BX(4, 3))
P('prop_shelf', 64, 13, block=BX(2, 2)); P('prop_crate', 65, 14); P('prop_crate', 64, 14); P('prop_crate', 65, 15)
P('spot_winch', 50, 12, block=BX(2, 2)); FD('rope_coil', 50, 13); FD('rope_coil', 52, 9)
P('costume_rack', 53, 14); P('costume_rack', 56, 15); P('costume_trunk', 59, 16)
P('stage_lamp', 58, 12); P('stage_lamp', 61, 11); glowc(58, 11, size=48, a=40); glowc(61, 10, size=48, a=40)
P('prop_throne', 53, 11)
P('sandbag_pile', 62, 15); P('sandbag_pile', 61, 16); P('sandbag_pile', 51, 16)
P('prop_crate', 56, 11); P('prop_crate', 62, 9); P('costume_trunk', 60, 10); FD('rope_coil', 57, 12); P('prop_crate', 55, 17); FD('rope_coil', 52, 15); P('sandbag_pile', 52, 12); P('sandbag_pile', 64, 10)
# 분장실(x68~75)
P('vanity_mirror', 68, 6, block=[(0, 0), (1, 0)], check=False); P('vanity_mirror', 71, 6, block=[(0, 0), (1, 0)], check=False)
for x in (69, 72): glowc(x, 5, (255, 236, 190), 52, 46)
P('dressing_stool', 69, 7); P('dressing_stool', 72, 7)
P('folding_screen', 74, 13); P('hat_stand', 74, 8); P('costume_trunk', 68, 14)
P('costume_rack', 70, 12); DEC('sconce_gold', 74, 4); FD('entrance_rug', 70, 9)
P('lobby_bench', 71, 14); P('urn_pedestal', 75, 10)

# ======== 대들보 통로 소품 ========
DEC('rope_pinrail', 59, 27); DEC('rope_pinrail', 81, 27); DEC('pulley_block', 63, 26); DEC('pulley_block', 79, 26)
P('ladder_hatch', 51, 30, block=[])
for x in (70, 72, 74, 76): P('counterweight_arbor', x, 29)
P('sandbag_pile', 65, 30); P('sandbag_pile', 66, 29); FD('rope_coil', 61, 30); FD('rope_coil', 85, 29)
P('spot_winch', 51, 44, block=BX(2, 2)); FD('rope_coil', 53, 41)
for y in (33, 40):
    for x in range(50, 87):
        if (x, y) in m.abyss: m.under_decals.append((x, y, S['beam_span']))
for (y, xa, xb) in ((35, 50, 86), (41, 70, 86)):
    for x in range(xa, xb + 1):
        if (x, y) in m.abyss: m.under_decals.append((x, y, S['batten_drop']))
SPOTS = [(55, 33), (57, 39), (67, 35), (69, 41), (79, 34), (81, 38), (61, 36), (75, 36)]
for (x, y) in SPOTS:
    FD('hanging_spot', x, y)
    K.POOLS.append((x * T + 8, (y + 4) * T + 8, 34, 20))
for (x, y) in ((59, 31), (73, 38), (84, 32), (64, 41)): FD('hanging_ropes', x, y)
m.under.append((CW, WS, CW | {(x, y) for y in (29, 30) for x in range(50, 87)} | {(x, y) for y in range(41, 45) for x in range(50, 54)}))
for (x, y) in SPOTS:                                                                 # 빛 기둥(조명 → 아래 무대 웅덩이)
    cone = new(48, 72); p = cone.load()
    for yy in range(72):
        hw = 3 + yy * .22
        for xx in range(48):
            if abs(xx - 24) <= hw and (xx + yy) % 2 == 0: p[xx, yy] = (255, 226, 160, 56 if yy < 50 else 40)
    m.lights.append((x * T + 8 - 24, y * T + 14, cone))
for c in m.abyss: m.blocked.add(c)
if BAD: print('배치 오류', BAD)

# ---------------------------------------------------------------- 통행: 층 이동 고리를 더한 BFS
LINKS = [((2, 31), (2, 26)), ((3, 31), (3, 26)), ((44, 31), (44, 26)), ((45, 31), (45, 26)), ((63, 6), (51, 30)), ((63, 6), (52, 30))]
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
ENT = (23, 35)
m.render()
reach = bfs_all(ENT)
WP = {'입구': (23, 35), '로비 매표소 앞': (10, 33), '객석 가운데 통로': (23, 22), '무대 위 가운데': (21, 10), '무대 계단(서)': (10, 12), '오케스트라 자리': (24, 15),
      '박스석 서(맨 앞)': (3, 14), '박스석 동(맨 앞)': (44, 14), '날개 통로': (45, 10), '무대 뒤 창고': (58, 14), '분장실': (71, 10), '벽 사다리 발치': (63, 6),
      '하역 회랑': (69, 30), '대들보 교차 통로': (68, 37), '동쪽 통로 끝': (80, 40), '서쪽 조명 받침대': (51, 42)}
wp_res = {k: dict(at=[x, y], reach=(x, y) in reach, steps=reach.get((x, y))) for k, (x, y) in WP.items()}
walk_total = sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
emp = dcheck.emptiness(m)
def emp_zone(x0, x1, y0, y1):
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals + m.under_decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    vals = []
    for yy in range(y0, max(y0, y1 - 15) + 1):
        for xx in range(x0, max(x0, x1 - 20) + 1):
            e = sum(1 for y in range(yy, min(H_, yy + 15)) for x in range(xx, min(W_, xx + 20)) if m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked)
            vals.append((round(e / 300.0, 3), (xx, yy)))
    vals.sort(reverse=True)
    return dict(max=vals[0][0], at=vals[0][1], over40=sum(1 for v in vals if v[0] > .4), windows=len(vals), top=[v[1] for v in vals[:8]])
EMPZ = {'홀': emp_zone(0, 48, 0, 36), '무대 뒤': emp_zone(48, 80, 0, 24), '대들보 통로': emp_zone(48, 88, 26, 46)}
print('empty by zone', EMPZ)
if os.environ.get('EMPDBG'):
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals + m.under_decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    for y in range(H_):
        print(''.join('.' if (m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked) else ('#' if m.fl[y][x] is not None else ' ') for x in range(W_)))
data = m.export(OUT, ENT, (24, 9), {}, extra=dict(emptiness=emp, emptiness_by_zone=EMPZ, kind='opera-stage',
                zones={'객석+무대 홀': [0, 0, 47, 35], '무대 뒤·분장실': [48, 0, 79, 23], '천장 대들보 통로': [48, 26, 87, 45]},
                stair_links=[[list(a), list(b)] for a, b in LINKS], waypoints_with_stairs=wp_res,
                reach_all_with_stairs=len(reach), walkable_cells=walk_total, unreached_cells=walk_total - len(reach)))
print('walk', walk_total, 'reached', len(reach), 'unreached', walk_total - len(reach), [(x, y) for y in range(H_) for x in range(W_) if m.is_walk(x, y) and (x, y) not in reach][:10])
print('wp', {k: (v['reach'], v['steps']) for k, v in wp_res.items()})
print('parts', kit.save())
_pm = json.load(open(os.path.join(OUT, 'partmeta.json')))
for _n in ('autotile-spotlight-pool', 'autotile-stage-shadow', 'autotile-rose-petals'): _pm[_n]['passable'] = True
json.dump(_pm, open(os.path.join(OUT, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
FX.check_sheet(os.path.join(OUT, 'check-autotile.png'))

# ---------------------------------------------------------------- 비교 시트: 같은 2배율로 [기준 | 극장]
from PIL import ImageDraw, ImageFont
V = os.path.join(OUT, '..')
render = m.img
_ff = [f for f in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf') if os.path.exists(f)]
_font = ImageFont.truetype(_ff[0], 14) if _ff else None
cw, ch = 208, 160
def ref(path, box): return Image.open(os.path.join(V, path)).convert('RGBA').crop(box)
# 보정 패스(2026-10-08): [이전 판(웨이브 2 커밋 cac9a6915c) | 새 판] — 달라진 곳만 같은 2배율로. 맨 아래 줄은 버들항 기준(탑 내부 서재) 대조.
import subprocess, io
_old = Image.open(io.BytesIO(subprocess.run(['git', 'show', 'cac9a6915c:tiledata/beodeul-variants/opera-stage/render-1x.png'], cwd=OUT,
                  capture_output=True, check=True).stdout)).convert('RGBA')
TI = 'tower-interior/render-1x.png'
def both(lab, box): return [('이전 · ' + lab, _old.crop(box)), ('새 · ' + lab, render.crop(box))]
rows = [
    both('무대 가운데: 빛 웅덩이·빛줄기·닳은 널·꽃잎·주름 띠 가운데 판', (290, 44, 290 + cw, 44 + ch)),
    both('무대 왼쪽: 그늘·빛 웅덩이·오케스트라 어둠', (110, 90, 110 + cw, 90 + ch)),
    both('무대 오른쪽·날개: 다리막·날개 어둠', (520, 70, 520 + cw, 70 + ch)),
    both('객석 왼쪽 블록: 좌석 변형(숄·책자)', (130, 270, 130 + cw, 270 + ch)),
    both('객석 오른쪽 블록: 좌석 변형(높은 모자·책자)', (420, 270, 420 + cw, 270 + ch)),
    [('버들항 기준 · 탑 내부 서재', ref(TI, (34 * 16 + 40, 40, 34 * 16 + 40 + cw, 40 + ch))), ('새 · 무대 뒤 창고 그늘', render.crop((800, 60, 800 + cw, 60 + ch)))],
]
sheet = Image.new('RGBA', (2 * (cw * 2 + 8) + 8, len(rows) * (ch * 2 + 26) + 4), (24, 22, 30, 255)); dr = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for i, (lab, t) in enumerate(row):
        x = 8 + i * (cw * 2 + 8); y = 4 + r * (ch * 2 + 26)
        sheet.alpha_composite(t.resize((cw * 2, ch * 2), Image.NEAREST), (x, y + 20))
        dr.text((x, y + 2), lab, fill=(230, 226, 236, 255), font=_font)
sheet.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))
