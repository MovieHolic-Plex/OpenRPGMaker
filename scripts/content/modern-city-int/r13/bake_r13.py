# R13 jumbo centerpieces (3x3 .. 6x4 footprints) - 2026-10-18 23:54 user: 「대형 오브젝트들이 별로 없네 . 흠 .... 이건 좀 아쉽네.」
# Drawing lives in jumbo.py (r10/lib.py 3/4 top-view rules); tile strip + registration reuse r10/bake_r10.bake
# (append-only after R11, same cell rules: h = solid footprint rows, taller art rises into passable overhang rows).
# Later redraws go through r10/rebake_inplace.py, which pastes over the registered tiles without moving indices.
# Run: python3 scripts/content/modern-city-int/r13/bake_r13.py
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'r10'))
sys.path.insert(0, HERE)
import bake_r10
from bake_r10 import bake
import jumbo as J

bake_r10.CAT_KO.update({'amuse': '오락시설', 'transport': '교통시설'})

# (id, kind, h, ko, desc, tags, use, art, cat, facing)
PROPS = [
    ('jumbo-hosp-mri', 'floor', 3, 'MRI 촬영 장치(4×3)', '깊은 원통 보어에 파란 LED 링, 덮개 판독창, 보어로 밀려 들어가는 쿠션 환자 침대와 받침.', ['병원', '영상', '대형'], ['block'], J.hosp_mri_gantry, 'hospital', None),
    ('jumbo-hosp-surgical-rig', 'floor', 3, '수술대·무영등 세트(3×3)', '천장 붐에서 두 갈래 관절 팔로 내려온 LED 무영등 아래 파란 드레이프 수술대, 팔 받침과 기구 필드.', ['병원', '수술실', '대형'], ['block'], J.hosp_surgical_rig, 'hospital', None),
    ('jumbo-hosp-nurse-command', 'floor', 3, '원형 간호사 스테이션(5×3)', '호두나무 접수 턱을 두른 곡면 데스크, 모니터 셋, 차트 꽂이, 호출 표시판, 매단 안내판.', ['병원', '간호', '대형'], ['counter'], J.hosp_nurse_command, 'hospital', None),
    ('jumbo-sento-grand-bath', 'floor', 4, '대형 온탕·열탕(6×4)', '히노키 테두리와 판자 앞면, 파란 모자이크 타일 바닥, 물속 계단 자리, 나무 물꼭지, 칸막이 너머 열탕, 피어오르는 김.', ['목욕탕', '탕', '대형'], ['block'], J.sento_grand_bath, 'bath', None),
    ('jumbo-sento-mural', 'hang', 0, '목욕탕 대형 타일 벽화(6×2)', '타일 줄눈 위에 그린 후지산, 소나무 해안, 말려 오르는 파도와 붉은 해.', ['목욕탕', '벽화', '대형'], None, J.sento_mural_grand, 'bath', None),
    ('jumbo-dept-perfume-rotunda', 'floor', 4, '원형 화장품 카운터·향수 탑(4×4)', '금 테 대리석 원형 카운터와 핑크 래커 앞면, 둘레의 테스터·향수병, 가운데 조명 유리 향수 탑과 금관.', ['백화점', '화장품', '향수', '대형'], ['search'], J.dept_perfume_rotunda, 'dept', None),
    ('jumbo-dept-fountain', 'floor', 3, '아트리움 분수(3×3)', '대리석 수반과 물결, 2단 돌 그릇 기둥, 수반으로 떨어지는 물줄기, 바닥 동전.', ['백화점', '분수', '대형'], ['block'], J.dept_fountain_grand, 'dept', None),
    ('jumbo-mart-seafood-island', 'floor', 3, '수산 아일랜드 쇼케이스(5×3)', '곡면 유리 덮개 아래 얼음 위 고등어·도미·연어 토막·대게·조개·문어, 빨간 간판과 파란 LED 띠, 펜던트 등.', ['마트', '수산', '대형'], ['search'], J.mart_seafood_island, 'store', None),
    ('jumbo-mart-promo-pyramid', 'floor', 3, '특판 피라미드 아일랜드(3×3)', '3단 원형 나무 단에 캔 피라미드와 상자 상품, 크롬 기둥 위 빨간 SALE 별 간판.', ['마트', '특판', '대형'], ['search'], J.mart_promo_pyramid, 'store', None),
    ('jumbo-arcade-dance-stage', 'wall', 3, '댄스 리듬 게임 스테이지(4×3)', '네온 마키, 화면 둘과 스피커 탑, 안전 바 아래 발판 둘(화살표 4개씩 점등).', ['게임센터', '리듬게임', '대형'], ['block'], J.arcade_dance_stage, 'amuse', None),
    ('jumbo-arcade-airhockey', 'floor', 3, '4인용 에어하키(4×3)', '공기 구멍 흰 판과 파란 선·중앙 원, 빨간 범퍼, 네 변 골문, 퍽과 말렛 넷, 점수판.', ['게임센터', '에어하키', '대형'], ['block'], J.arcade_airhockey, 'amuse', None),
    ('jumbo-arcade-racing-twin', 'wall', 3, '2인 레이싱 시뮬레이터(4×3)', '체크무늬 RACE 마키 아래 3면 화면 콕핏 둘, 빨간 버킷 시트·핸들·페달, 가운데 동전 포드.', ['게임센터', '레이싱', '대형'], ['block'], J.arcade_racing_twin, 'amuse', None),
    ('jumbo-bakery-deck-oven', 'wall', 3, '3단 데크 오븐(4×3)', '스테인리스 후드, 벽돌 마감 몸체, 빵이 익는 유리문 3단, 온도 다이얼, 기대 둔 나무 필.', ['빵집', '오븐', '대형'], ['search'], J.bakery_deck_oven, 'food', None),
    ('jumbo-izakaya-u-bar', 'floor', 3, 'ㄷ자 야키토리 카운터(5×3)', '숯불 그릴 구덩이를 두른 히노키 ㄷ자 카운터, 꼬치·연기·타레 항아리, 자리마다 접시·사케·맥주잔, 위 배기 후드.', ['이자카야', '카운터', '대형'], ['counter'], J.izakaya_u_bar, 'food', None),
    ('jumbo-rest-banquet-round', 'floor', 3, '원형 연회 테이블(3×3)', '바닥까지 늘어진 흰 식탁보, 유리 회전판의 요리, 8인 자리, 높은 꽃장식.', ['식당', '연회', '대형'], ['block'], J.rest_banquet_round, 'food', None),
    ('jumbo-school-stage-board', 'wall', 2, '강단·파노라마 칠판(6×2)', '참나무 틀 3폭 녹색 칠판(도식·필기), 분필 홈, 앞 단 코와 가운데 교탁을 둔 참나무 강단.', ['학교', '강의실', '칠판', '대형'], ['read'], J.school_stage_board, 'campus', None),
    ('jumbo-council-oval-table', 'floor', 3, '타원형 회의 탁자(5×3)', '녹색 가죽 상감 참나무 타원 상판, 명패·서류·구스넥 마이크·물병·노트북.', ['학생회', '회의', '대형'], ['search'], J.council_oval_table, 'campus', None),
    ('jumbo-office-boardroom', 'floor', 3, '임원 회의 탁자(5×3)', '스모크 유리 가운데 판을 둔 레이스트랙 호두나무 상판, 회의용 스피커폰, 노트북·가죽 폴더·커피잔.', ['사무실', '회의', '대형'], ['search'], J.office_boardroom_table, 'office', None),
    ('jumbo-gym-apparatus', 'floor', 3, '체조 기구 존(4×3)', '겹친 파란 착지 매트, 흰 가죽 뜀틀, 구름판, 강철 받침 평균대.', ['체육관', '체조', '대형'], ['block'], J.gym_apparatus_zone, 'campus', None),
    ('jumbo-roof-cooling-tower', 'floor', 3, '옥상 냉각탑(4×3)', 'FRP 루버 몸체, 팬이 보이는 원통 배기구, 안전망 사다리, 급·환수 배관.', ['옥상', '설비', '대형'], ['block'], J.roof_cooling_tower, 'office', None),
    ('jumbo-roof-water-tower', 'floor', 3, '옥상 고가 물탱크(3×3)', '띠를 두른 강철 원통과 원뿔 뚜껑, 가새 다리 넷, 사다리, 노란 펜스 받침.', ['옥상', '설비', '대형'], ['block'], J.roof_water_tower, 'office', None),
    ('jumbo-station-ticket-office', 'floor', 3, '역 매표소 부스(5×3)', '녹색 지붕과 매표소 간판, 역무원 셋이 앉은 매표 창구 셋, 요금표, 양 끝 터치스크린 발매기.', ['역', '매표', '대형'], ['counter'], J.station_ticket_office, 'station', None),
    ('jumbo-park-box-truck-e', 'floor', 3, '택배 탑차(5×3·동향)', '파란 띠와 로고 흰 화물칸, 뒤 셔터, 짙은 앞유리 운전석, 복륜 뒷바퀴.', ['주차장', '차량', '대형'], ['block'], J.park_box_truck_e, 'transport', 'E'),
    ('jumbo-home-sectional', 'floor', 3, 'ㄱ자 소파·러그 세트(4×3)', '킬림 무늬 러그, 등·좌석 쿠션과 쿠션 베개를 올린 ㄱ자 패브릭 소파, 머그·잡지·리모컨을 둔 원형 탁자.', ['집', '거실', '소파', '대형'], ['block'], J.home_sectional_set, 'home', None),
    ('jumbo-lobby-tree-bench', 'floor', 3, '올리브나무 원형 벤치(3×3)', '참나무 원형 벤치가 두른 돌 화분, 지붕처럼 솟은 올리브나무, 흙 속 업라이트.', ['로비', '휴게', '대형'], ['block'], J.lobby_tree_bench, 'lobby', None),
]

if __name__ == '__main__':
    bake(PROPS, [], 'jumbo-hosp-mri', 'r13')
