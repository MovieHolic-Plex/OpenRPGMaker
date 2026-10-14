#!/usr/bin/env python3
"""modern_city 실내 조각 등록 — 바닥·벽면·천장·문·창·벽걸이·가구·탁자·탁상 물건. id 머리 `mci-`(키트는 `mc-in-<id>`).

등록(치수·종류·쓰임·설명·관문 종류)은 이 파일, 그림은 art_shell.py · art_furn.py · art_small.py(코드 손 도트).
틀은 mkit.Registry(jp_city 실내 틀과 같은 굽기 계약, 팔레트만 modern_city 시트 램프).

  python3 scripts/content/modern-city-int/pieces.py          # selftest + 미리보기 tiledata/modern-city/interior/_all-x3.png
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from mkit import Registry, default_ceiling      # noqa: E402
import art_shell as S                            # noqa: E402
import art_furn as F                             # noqa: E402
import art_small as G                            # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'modern-city', 'interior')
R = Registry('mci', '도쿄풍 현대 실내')

CAT = {
    'office': '사무실', 'store': '편의점·상점', 'home': '집·아파트', 'bath': '욕실·화장실', 'cafe': '카페·식당', 'hospital': '병원',
    'bank': '은행', 'lobby': '로비·엘리베이터', 'station': '역 대합실', 'warehouse': '창고', 'window': '창', 'wallhang': '벽걸이',
    'door': '문', 'stairs': '계단', 'decor': '장식',
}

# ── 바닥 ──
R.floor('mci-carpet-office', '사무실 카펫 타일(청회색)', cols=2, rows=2, tags=('사무실', '회의실', 'office'),
        desc='16px 판마다 결 방향이 바뀌는 청회색 카펫 타일. 사무층·회의실·은행 뒷사무실.')(S.floor_carpet_office)
R.floor('mci-stone-lobby', '로비 대리석(크림 판)', cols=4, rows=2, tags=('로비', '은행', '호텔', 'lobby'),
        desc='엇갈린 32×16 크림 대리석 판, 사선 결·반사. 빌딩 로비·은행 객장·엘리베이터 홀.')(S.floor_stone_lobby)
R.floor('mci-vinyl-store', '매장 흰 비닐 타일', cols=2, rows=2, tags=('편의점', '매장', '약국', 'store'),
        desc='16px 흰 비닐 타일과 회색 줄눈. 편의점·작은 매장·약국.')(S.floor_vinyl_store)
R.floor('mci-wood-oak', '아파트 마루(밝은 참나무)', cols=4, rows=1, lay='rowShift', tags=('아파트', '집', '거실', 'home'),
        desc='높이 4px 판이 엇갈리는 밝은 참나무 마루. 아파트 거실·방.')(S.floor_wood_oak)
R.floor('mci-wood-dark', '카페 짙은 마루(헤링본)', cols=2, rows=2, tags=('카페', '식당', '바', 'cafe'),
        desc='헤링본으로 짠 짙은 호두색 마루. 카페·식당·바.')(S.floor_wood_dark)
R.floor('mci-vinyl-hospital', '병원 연녹 시트 바닥', cols=2, rows=2, tags=('병원', '병동', '진료실', 'hospital'),
        desc='연한 세이지 녹색 시트 바닥(덩이 얼룩·용접 줄). 병동·진료실·병원 복도.')(S.floor_vinyl_hospital)
R.floor('mci-tile-concourse', '지하 통로 화강암 판', cols=2, rows=2, tags=('역', '지하철', '대합실', 'station'),
        desc='두 톤 번갈아 놓인 회색 화강암 판. 지하철 대합실·지하 통로.')(S.floor_tile_concourse)
R.floor('mci-concrete', '창고 콘크리트', cols=4, rows=4, tags=('창고', '주차장', '기계실', 'warehouse'),
        desc='얼룩진 콘크리트와 64px 줄눈. 창고·하역장·기계실.')(S.floor_concrete)
R.floor('mci-tile-small', '주방·욕실 작은 흰 타일', cols=2, rows=2, tags=('욕실', '주방', '화장실', 'bath'),
        desc='8px 흰 타일. 욕실·화장실·업소 주방.')(S.floor_tile_small)

# ── 벽면 ──
R.wall('mci-wall-office', '사무실 벽(밝은 회색)', cols=2, tags=('사무실', '병원', 'office'), desc='밝은 회색 칠 벽 + 가는 몰딩 + 짙은 걸레받이.')(S.wall_office)
R.wall('mci-wall-lobby', '로비 석재 판벽', cols=2, tags=('로비', '은행', 'lobby'), desc='베이지 석재 판 + 황동 띠 + 짙은 석재 걸레받이.')(S.wall_lobby)
R.wall('mci-wall-store', '편의점 벽(흰 패널·빨강 띠)', cols=2, tags=('편의점', '매장', 'store'), desc='흰 패널에 빨강 띠 한 줄.')(S.wall_store)
R.wall('mci-wall-home', '집 벽(크림 벽지·나무 몰딩)', cols=2, tags=('아파트', '집', 'home'), desc='크림 줄무늬 벽지 + 나무 허리 몰딩 + 나무 걸레받이.')(S.wall_home)
R.wall('mci-wall-hospital', '병원 벽(흰 칠·세이지 허리판·손잡이 난간)', cols=2, tags=('병원', '병동', 'hospital'), desc='흰 칠 위, 세이지 허리판, 회색 손잡이 난간.')(S.wall_hospital)
R.wall('mci-wall-brick', '카페 벽돌 벽', cols=2, tags=('카페', '식당', 'cafe'), desc='드러낸 붉은 벽돌 + 짙은 나무 걸레받이.')(S.wall_brick)
R.wall('mci-wall-tile', '지하 통로 타일 벽(청록 띠)', cols=2, tags=('역', '지하철', 'station'), desc='흰 직사각 타일 + 청록 띠.')(S.wall_tile)
R.wall('mci-wall-metal', '창고 골판 철벽', cols=2, tags=('창고', 'warehouse'), desc='골판 철판 위 + 시멘트 블록 허리.')(S.wall_metal)
R.ceiling('default', '천장 띠(숯색 격자)', desc='실내에 닿는 막힌 칸. 숯색 판 + 실내 쪽 회색 몰딩.')(default_ceiling)


def obj(id_, ko, fn, w=1, h=1, up=0, kind='floor', cat='office', gate='low_furniture', **kw):
    R.obj(id_, ko, w=w, h=h, up=up, kind=kind, cat=cat, cat_ko=CAT[cat], gate=gate, **kw)(fn)


# ── 문 ──
obj('mci-door-wood', '열린 나무 문', S.door_wood, kind='door', cat='door', gate='structure', use=('travel',), tags=('문', '집', '사무실'),
    place='가로 칸막이의 1칸 틈', desc='짙은 나무 문틀, 왼쪽으로 열린 문짝. 집·사무실 방 사이.')
obj('mci-door-glass', '열린 유리 자동문', S.door_glass, kind='door', cat='door', gate='structure', use=('travel',), tags=('문', '로비', '편의점', '은행'),
    place='가로 칸막이의 1칸 틈(건물 입구·로비)', desc='은색 틀 유리 자동문이 양옆으로 열려 있다.')
obj('mci-door-steel', '열린 철문', S.door_steel, kind='door', cat='door', gate='structure', use=('travel',), tags=('문', '창고', '계단실'),
    place='가로 칸막이의 1칸 틈(창고·뒷방·계단실)', desc='회청 철 문틀, 안으로 열린 철문, 위 초록 표시등.')
obj('mci-door-hospital', '열린 병원 미닫이', S.door_hospital, kind='door', cat='door', gate='structure', use=('travel',), tags=('문', '병원'),
    place='가로 칸막이의 1칸 틈(병실·진료실)', desc='흰 틀, 오른쪽으로 밀린 연녹 미닫이(작은 유리창).')
obj('mci-sidedoor-wood', '열린 옆문(나무)', S.sidedoor_wood, kind='sidedoor', cat='door', gate='structure', use=('travel',), tags=('문',),
    place='세로 칸막이 3줄 틈의 통로 칸', desc='세로 칸막이 끝에 단 나무 문틀과 열린 문짝.')

# ── 창·벽걸이 ──
obj('mci-window-city', '도시가 보이는 큰 창', S.window_city, w=2, kind='hang', cat='window', gate='wall_mounted', use=('light',), tags=('창', '사무실', '아파트'),
    place='북쪽 벽면 윗줄, 두 칸', desc='은색 틀 너머 빌딩 실루엣과 불 켜진 창 점. 사무층·고층 아파트.')
obj('mci-window-blind', '블라인드 창', S.window_blind, w=2, kind='hang', cat='window', gate='wall_mounted', use=('light',), tags=('창', '사무실', '병원'),
    place='북쪽 벽면 윗줄, 두 칸', desc='반쯤 내린 흰 가로 블라인드와 아래 하늘.')
obj('mci-window-curtain', '커튼 창', S.window_curtain, w=2, kind='hang', cat='window', gate='wall_mounted', use=('light',), tags=('창', '집', '카페'),
    place='북쪽 벽면 윗줄, 두 칸', desc='나무 틀 창과 양옆에 묶은 장미색 커튼.')
obj('mci-wall-clock', '벽시계', S.wall_clock, kind='hang', cat='wallhang', gate='wall_mounted', tags=('시계',), place='벽면 윗줄', desc='흰 판 둥근 벽시계, 숫자 없음.')
obj('mci-tv-wall', '벽걸이 TV', S.tv_wall, w=2, kind='hang', cat='wallhang', gate='wall_mounted', tags=('TV', '병원', '대기실'), place='벽면 윗줄, 두 칸',
    desc='얇은 검은 테 평면 TV와 막대 스피커. 대기실·병실.')
obj('mci-art-frame', '추상화 액자', S.art_frame, w=2, kind='hang', cat='wallhang', gate='wall_mounted', tags=('그림', '로비', '집'), place='벽면 윗줄, 두 칸',
    desc='나무 액자 속 주황·청록 색 덩이 추상화.')
obj('mci-whiteboard', '화이트보드', S.whiteboard, w=2, kind='hang', cat='wallhang', gate='wall_mounted', use=('read',), tags=('사무실', '회의실'),
    place='회의실·사무실 벽면 윗줄', desc='은색 틀 화이트보드에 막대 그래프와 선(글자 없음).')
obj('mci-ac-wall', '벽걸이 에어컨', S.ac_wall, w=2, kind='hang', cat='wallhang', gate='wall_mounted', tags=('에어컨', '집', '사무실'), place='벽면 윗줄',
    desc='흰 벽걸이 에어컨, 바람 날개 틈과 초록 불빛.')
obj('mci-menu-board', '카페 메뉴 칠판', S.menu_board, w=2, kind='hang', cat='wallhang', gate='wall_mounted', use=('read',), tags=('카페',),
    place='카운터 뒤 벽면 윗줄', desc='나무 틀 칠판에 분필 줄과 컵 그림(글자 없음).')
obj('mci-notice-board', '코르크 게시판', S.notice_board, kind='hang', cat='wallhang', gate='wall_mounted', use=('read',), tags=('게시판',),
    place='벽면 윗줄', desc='색 종이 넷이 꽂힌 코르크 판.')
obj('mci-route-map', '노선도 판', F.route_map, w=2, kind='hang', cat='station', gate='wall_mounted', use=('read',), tags=('역', '지하철'),
    place='대합실 벽면 윗줄', desc='색 노선 선과 역 점(글자 없음).')

# ── 사무실 ──
obj('mci-desk-pc', '사무 책상(화면 남향)', F.desk_pc, w=2, up=14, cat='office', facing='S', surface=True, use=('search',), tags=('사무실', '책상'),
    place='남쪽에 의자 mci-chair-office-n', pair=('mci-chair-office-n',), desc='회색 상판에 켜진 모니터 둘·자판·서류. 앉는 사람은 남쪽.')
obj('mci-desk-pc-back', '사무 책상(화면 북향)', F.desk_pc_back, w=2, up=12, cat='office', facing='N', surface=True, use=('search',), tags=('사무실', '책상'),
    place='북쪽에 의자 mci-chair-office-s', pair=('mci-chair-office-s',), desc='모니터 뒤판이 보이는 책상. 앉는 사람은 북쪽.')
obj('mci-chair-office-s', '사무용 의자(남향)', F.chair_office_s, up=8, cat='office', gate='seat', use=('sit',), facing='S', tags=('의자', '사무실'),
    place='책상 북쪽', desc='남색 쿠션 회전의자. 앉는 판이 보인다.')
obj('mci-chair-office-n', '사무용 의자(북향)', F.chair_office_n, up=8, cat='office', gate='seat', use=('sit',), facing='N', tags=('의자', '사무실'),
    place='책상 남쪽', desc='등받이가 앞을 가리는 회전의자.')
obj('mci-partition', '사무 칸막이', F.partition, w=2, up=10, cat='office', gate='frame', tags=('사무실', '칸막이'), place='책상 줄 사이',
    desc='알루미늄 윗 레일과 청회색 천 판.')
obj('mci-copier', '복합기', F.copier, up=12, cat='office', gate='box', use=('search',), tags=('사무실', '편의점'), place='벽가·통로 끝',
    desc='넓은 윗면(덮개·조작판), 앞면 용지함 셋.')
obj('mci-server-rack', '서버 랙 둘', F.server_rack, w=2, up=16, kind='wall', cat='office', gate='tall_furniture', tags=('사무실', '서버실'),
    place='북쪽 벽 앞', desc='철망 앞문 속 장비와 초록·노랑 불빛.')
obj('mci-filing', '낮은 서류 캐비닛', F.filing, w=2, up=6, kind='wall', cat='office', gate='low_furniture', surface=True, use=('search',), tags=('사무실', '은행'),
    place='북쪽 벽 앞', desc='서랍 두 단, 위에 화분과 서류 더미.')
obj('mci-coffee-station', '탕비 카운터', F.coffee_station, w=2, up=14, kind='wall', cat='office', gate='low_furniture', tags=('사무실', '탕비실'),
    place='북쪽 벽 앞', desc='커피 머신·정수기·컵이 놓인 카운터.')
obj('mci-reception', '접수 카운터', F.reception, w=3, up=10, cat='lobby', gate='low_furniture', use=('counter',), tags=('로비', '병원', '사무실', '접수'),
    place='입구를 마주 보게, 뒤에 직원 자리 1줄', desc='나무 앞판에 금속 띠, 위에 모니터·화분·종.')
obj('mci-plant-tall', '키 큰 화분', F.plant_tall, up=16, cat='decor', gate='organic', tags=('화분', '로비', '사무실'), place='구석·문 옆',
    desc='고무나무 잎 덩이와 흰 원통 화분.')
obj('mci-shelf-office', '서류철 서가', F.shelf_office, w=2, up=16, kind='wall', cat='office', gate='tall_furniture', use=('read', 'search'), tags=('사무실', '집'),
    place='북쪽 벽 앞', desc='세 단에 색 서류철이 꽂힌 나무 서가.')

# ── 편의점 ──
obj('mci-gondola', '진열대(양면)', F.gondola, w=2, up=10, cat='store', gate='tall_furniture', use=('search',), tags=('편의점', '매장', '진열'),
    place='매장 가운데 줄, 앞뒤 통로 1칸', desc='세 단 포장 상품과 윗판 상품 윗면.')
obj('mci-gondola-v', '세로 진열대', F.gondola_v, h=2, up=8, cat='store', gate='tall_furniture', use=('search',), tags=('편의점', '매장', '진열'),
    place='남북 통로 사이 섬', desc='남북으로 긴 진열 섬. 윗면 양쪽 상품 줄.')
obj('mci-cooler', '음료 냉장고', F.cooler, w=2, up=16, kind='wall', cat='store', gate='tall_furniture', use=('search',), tags=('편의점', '냉장'),
    place='북쪽 벽을 따라 이어서', desc='유리문 둘 속 밝은 칸에 병 줄.')
obj('mci-freezer', '아이스크림 냉동고', F.freezer, w=2, up=8, cat='store', gate='container', use=('search',), tags=('편의점', '냉동'),
    place='계산대 앞·벽가', desc='미닫이 유리 뚜껑 너머 위에서 보이는 상품 상자.')
obj('mci-counter-register', '계산대', F.counter_register, w=3, up=10, cat='store', gate='low_furniture', use=('counter',), tags=('편의점', '계산'),
    place='입구 옆, 뒤에 점원 자리 1줄', desc='회색 상판 위 계산기·핫스낵 유리장, 흰 앞판에 빨강 띠.')
obj('mci-magazine', '잡지 진열대', F.magazine_rack, w=2, up=4, kind='wall', cat='store', gate='low_furniture', use=('read',), tags=('편의점', '잡지'),
    place='창가·벽 앞', desc='낮은 경사 선반 두 단에 색 표지(글자 없음).')
obj('mci-atm', 'ATM', F.atm, up=12, kind='wall', cat='bank', gate='box', use=('counter',), tags=('편의점', '은행', 'ATM'),
    place='북쪽 벽 앞', desc='차양 아래 켜진 화면·숫자판·카드 구멍.')
obj('mci-basket-stack', '장바구니 더미', F.basket_stack, up=6, cat='store', gate='container', tags=('편의점', '바구니'),
    place='입구 안쪽', desc='빨강 바구니 아가리와 손잡이.')

# ── 집 ──
obj('mci-bed-double', '더블 침대', F.bed_double, w=2, h=2, up=10, cat='home', gate='low_furniture', use=('sleep', 'save'), tags=('집', '침실', '호텔'),
    place='머리를 북쪽 벽에', desc='나무 머리판, 흰 베개 둘, 청록 체크 이불.')
obj('mci-bed-single', '싱글 침대', F.bed_single, h=2, up=10, cat='home', gate='low_furniture', use=('sleep', 'save'), tags=('집', '침실'),
    place='머리를 북쪽 벽에', desc='나무 머리판, 흰 베개, 청록 체크 이불.')
obj('mci-sofa', '3인 소파', F.sofa3, w=3, up=10, cat='home', gate='seat', use=('sit',), facing='S', tags=('집', '거실', '로비', '대기실'),
    place='거실·로비, 앞에 탁자', desc='남색 3인 소파, 쿠션 셋.')
obj('mci-armchair', '1인 안락의자', F.armchair, up=10, cat='home', gate='seat', use=('sit',), facing='S', tags=('집', '거실', '카페'),
    place='소파 옆', desc='장미색 1인 안락의자.')
obj('mci-coffee-table', '거실 탁자', F.coffee_table, w=2, up=0, cat='home', gate='low_furniture', surface=True, tags=('집', '거실', '로비'),
    place='소파 남쪽 1칸 앞', desc='낮은 나무 탁자 위 잡지·컵.')
obj('mci-tv-stand', 'TV 장', F.tv_stand, w=2, up=16, kind='wall', cat='home', gate='low_furniture', tags=('집', '거실'),
    place='북쪽 벽 앞', desc='낮은 나무 장 위 평면 TV와 작은 화분.')
obj('mci-kitchen', '부엌 조리대', F.kitchen, w=3, up=16, kind='wall', cat='home', gate='low_furniture', use=('counter',), tags=('집', '부엌', '카페'),
    place='북쪽 벽 앞', desc='위 찬장, 개수대·도마·인덕션 상판, 아래 문짝.')
obj('mci-fridge', '냉장고', F.fridge, up=16, kind='wall', cat='home', gate='tall_furniture', use=('open',), tags=('집', '부엌'),
    place='북쪽 벽 앞, 조리대 옆', desc='위 냉동실·아래 냉장실 회색 냉장고.')
obj('mci-wardrobe', '옷장', F.wardrobe, w=2, up=16, kind='wall', cat='home', gate='tall_furniture', use=('open',), tags=('집', '침실'),
    place='북쪽 벽 앞', desc='나무 문짝 둘과 아래 서랍.')
obj('mci-chair-wood-s', '나무 의자(남향)', F.chair_wood_s, up=8, cat='home', gate='seat', use=('sit',), facing='S', tags=('의자', '식탁', '카페'),
    place='식탁 북쪽', desc='등받이가 북쪽인 나무 의자.')
obj('mci-chair-wood-n', '나무 의자(북향)', F.chair_wood_n, up=8, cat='home', gate='seat', use=('sit',), facing='N', tags=('의자', '식탁', '카페'),
    place='식탁 남쪽', desc='등받이가 남쪽 앞을 가리는 나무 의자.')
obj('mci-rug', '거실 깔개', F.rug, w=3, h=2, kind='flat', cat='home', gate='flat', use=('walk',), tags=('집', '거실'),
    place='소파 앞 바닥', desc='남색 테두리 크림 깔개.')
obj('mci-toilet', '양변기', F.toilet, up=4, kind='wall', cat='bath', gate='container', tags=('화장실', '욕실'), place='북쪽 벽 앞',
    desc='벽에 붙은 물탱크와 위에서 보이는 변기.')
obj('mci-washbasin', '세면대', F.washbasin, up=16, kind='wall', cat='bath', gate='container', tags=('화장실', '욕실'), place='북쪽 벽 앞',
    desc='벽 거울, 흰 대야, 아래 나무장.')

# ── 카페 ──
obj('mci-cafe-table', '카페 원탁', F.cafe_table, up=4, cat='cafe', gate='low_furniture', surface=True, tags=('카페', '식당'),
    place='좌우에 카페 의자', desc='둥근 대리석 상판과 받침대.')
obj('mci-cafe-chair-e', '카페 의자(동향)', F.cafe_chair_e, up=6, cat='cafe', gate='seat', use=('sit',), facing='E', tags=('카페', '의자'),
    place='원탁 서쪽', desc='나무 앉는 판과 서쪽 등받이.')
obj('mci-cafe-chair-w', '카페 의자(서향)', F.cafe_chair_w, up=6, cat='cafe', gate='seat', use=('sit',), facing='W', tags=('카페', '의자'),
    place='원탁 동쪽', desc='나무 앉는 판과 동쪽 등받이.')
obj('mci-bar-stool', '높은 둥근 의자', F.bar_stool, up=2, cat='cafe', gate='seat', use=('sit',), tags=('카페', '바'),
    place='카운터 남쪽', desc='장미색 둥근 방석과 쇠 기둥.')
obj('mci-pastry-case', '진열 냉장 케이스', F.pastry_case, w=2, up=4, cat='cafe', gate='low_furniture', use=('counter',), tags=('카페', '빵집'),
    place='카운터 옆', desc='유리 윗면 속 케이크 셋과 나무 아랫장.')

# ── 병원 ──
obj('mci-hosp-bed', '병원 침대', F.hosp_bed, h=2, up=10, cat='hospital', gate='low_furniture', use=('sleep', 'heal'), tags=('병원', '병실'),
    place='머리를 북쪽 벽에, 옆 협탁', desc='회색 머리판, 흰 매트, 연녹 담요, 옆 난간.')
obj('mci-curtain', '병상 칸막이 커튼', F.hosp_curtain, w=2, up=12, cat='hospital', gate='frame', tags=('병원', '병실'),
    place='침대 사이', desc='천장 레일에 걸린 주름 커튼.')
obj('mci-iv-stand', '링거 걸대', F.iv_stand, up=14, cat='hospital', gate='column', tags=('병원', '병실'),
    place='침대 머리 옆', desc='수액 팩과 바퀴 받침.')
obj('mci-bedside', '침대 옆 협탁', F.bedside, up=8, cat='hospital', gate='low_furniture', surface=True, tags=('병원', '집'),
    place='침대 옆', desc='흰 윗면에 물컵·꽃병, 서랍 둘.')
obj('mci-wait-bench', '대기 의자(셋)', F.wait_bench, w=3, up=12, cat='hospital', gate='seat', use=('sit',), facing='S', tags=('병원', '은행', '대합실'),
    place='접수 앞', desc='쇠 들보에 이은 청록 플라스틱 의자 셋.')
obj('mci-med-cart', '약품 카트', F.med_cart, up=8, cat='hospital', gate='low_furniture', surface=True, tags=('병원', '간호'),
    place='벽가', desc='위 쟁반 약병과 색 서랍 넷.')

# ── 은행·로비 ──
obj('mci-teller', '은행 창구', F.teller, w=3, up=14, cat='bank', gate='low_furniture', use=('counter',), tags=('은행', '창구'),
    place='객장을 마주 보게, 뒤에 직원 자리', desc='석재 카운터 위 유리 칸막이와 서류 받침.')
obj('mci-stanchion', '줄 세우기 기둥', F.stanchion, up=12, cat='bank', gate='column', tags=('은행', '로비', '대기줄'),
    place='창구 앞 줄 끝', desc='금속 기둥과 붉은 띠 줄.')
obj('mci-elevator', '엘리베이터 문', F.elevator, w=2, up=16, kind='wall', cat='lobby', gate='wall_mounted', use=('travel',), tags=('로비', '엘리베이터'),
    place='북쪽 벽 앞(벽면을 덮는다)', desc='스테인리스 문 두 짝, 위 층 표시 불빛, 옆 단추.')
obj('mci-security-gate', '출입 보안 게이트', F.security_gate, w=2, up=8, cat='lobby', gate='low_furniture', use=('gate',), tags=('로비', '사무실'),
    place='로비 입구 안쪽', desc='판독기 몸통 둘 사이 유리 날개.')
obj('mci-planter', '긴 화분 상자', F.planter, w=2, up=2, cat='decor', gate='container', tags=('로비', '화분'),
    place='벽가·입구 옆', desc='회색 상자 위 관목 셋.')
obj('mci-mailboxes', '우편함', F.mailboxes, w=2, up=16, kind='wall', cat='lobby', gate='tall_furniture', use=('open',), tags=('아파트', '로비'),
    place='북쪽 벽 앞', desc='작은 문 4×4 격자.')

# ── 역 ──
obj('mci-ticket-gate', '개찰구', F.ticket_gate, w=2, up=4, cat='station', gate='low_furniture', use=('gate',), tags=('역', '지하철'),
    place='대합실 가로줄, 여러 개 이어', desc='판독 패드가 빛나는 몸통 둘과 빨강 날개.')
obj('mci-ticket-machine', '발권기', F.ticket_machine, w=2, up=16, kind='wall', cat='station', gate='tall_furniture', use=('counter',), tags=('역', '지하철'),
    place='북쪽 벽 앞', desc='켜진 화면과 동전·지폐 구멍.')
obj('mci-bench-metal', '금속 벤치', F.bench_metal, w=2, up=0, cat='station', gate='seat', use=('sit',), tags=('역', '대합실', '병원'),
    place='벽가·기둥 옆', desc='구멍 뚫린 금속 앉는 판.')
obj('mci-tactile', '점자 블록', F.tactile, kind='flat', cat='station', gate='flat', use=('walk',), tags=('역', '점자'),
    place='통로 따라 줄로', desc='노란 점자 블록.')
obj('mci-stairs-up', '오르는 계단', F.stairs_up, w=2, up=16, kind='wall', cat='stairs', gate='structure', stairs='up', use=('travel',), tags=('계단',),
    place='북쪽 벽 앞 첫 바닥 줄', desc='북쪽 벽 속으로 오르는 회색 계단.')
obj('mci-stairs-down', '내려가는 계단', F.stairs_down, w=2, h=2, up=0, cat='stairs', gate='structure', stairs='down', use=('travel',), tags=('계단', '지하철'),
    place='바닥 가운데·구석(2×2)', desc='난간 테 안으로 어두워지는 단.')

# ── 창고 ──
obj('mci-rack', '창고 선반', F.rack, w=3, up=16, kind='wall', cat='warehouse', gate='tall_furniture', use=('search',), tags=('창고',),
    place='북쪽 벽 앞', desc='주황 기둥·파랑 들보, 두 단 골판지 상자.')
obj('mci-pallet', '팔레트 상자 더미', F.pallet_boxes, up=6, cat='warehouse', gate='box', use=('search',), tags=('창고', '상자'),
    place='창고 바닥', desc='나무 팔레트 위 상자 셋.')
obj('mci-drums', '드럼통 둘', F.drums, up=6, cat='warehouse', gate='round_body', tags=('창고', '기계실'),
    place='구석', desc='파랑·빨강 드럼통.')

# ── 탁자 ──
R.table('mci-t-meeting', '회의 탁자(흰 상판)', desc='회색 흰 상판 회의 탁자.', tags=('사무실', '회의실'))(G.t_meeting)
R.table('mci-t-wood', '나무 식탁·탁자', desc='나무 상판 식탁·카페 긴 탁자.', tags=('집', '카페'))(G.t_wood)
R.table('mci-t-counter', '카운터(베이지 앞판)', desc='앞판이 막힌 카운터(카페·은행·약국).', tags=('카페', '은행', '매장'))(G.t_counter)

# ── 탁상 물건 ──
R.good('mci-g-laptop', '노트북', desc='켜진 노트북.')(G.g_laptop)
R.good('mci-g-coffee', '머그잔 둘', desc='커피 머그 둘.')(G.g_coffee)
R.good('mci-g-papers', '서류 더미', desc='집게 꽂은 서류 더미.')(G.g_papers)
R.good('mci-g-phone', '사무 전화기', desc='단추 격자 사무 전화기.')(G.g_phone)
R.good('mci-g-register', '계산 단말', desc='작은 화면 계산 단말과 카드기.')(G.g_register)
R.good('mci-g-espresso', '에스프레소 머신', desc='작은 은색 커피 머신.')(G.g_espresso)
R.good('mci-g-cake', '케이크 접시', desc='접시 위 케이크 조각 둘.')(G.g_cake)
R.good('mci-g-vase', '꽃병', desc='세 송이 꽃병.')(G.g_vase)
R.good('mci-g-books', '책 더미', desc='엇갈려 쌓은 책 셋.')(G.g_books)


# ═══════════════ 3/4 관문에서 뺀 조각 ═══════════════
# 네 번(처음 + 다시 그림 3회) 그려도 object-gate(gemini-3.8-flash ×4 과반)가 「정면 입면도」로 떨어뜨린 조각.
# 기준을 낮추지 않고 뺀다 — 굽지 않으며, 예제 방·조수 사전에도 없다(그림 함수는 art_v2.py 에 이력으로 남는다).
DROPPED = {
    'mci-chair-office-n': '북향 사무 의자 — 등받이 뒷면이 입면도로 읽힘(남향 의자 + 뒤판 책상 줄로 대신)',
    'mci-chair-wood-n': '북향 나무 의자 — 같은 이유(식탁은 남향 의자 + 양 끝 카페 의자로)',
    'mci-partition': '사무 칸막이 — 얇은 판이 입면도로 읽힘',
    'mci-curtain': '병상 칸막이 — 얇은 판',
    'mci-stanchion': '줄 세우기 기둥 — 가는 기둥',
    'mci-drums': '드럼통 — 뚜껑 타원이 안 읽힘',
    'mci-copier': '복합기 — 4회 불합격',
    'mci-server-rack': '서버 랙 — 4회 불합격',
    'mci-gondola-v': '세로 진열대 — 4회 불합격(가로 진열대로 대신)',
    'mci-atm': 'ATM — 4회 불합격',
    'mci-ticket-machine': '발권기 — 4회 불합격',
    'mci-g-espresso': '탁상 에스프레소 머신 — 4회 불합격',
    'mci-g-cake': '탁상 케이크 — 4회 불합격',
    'mci-sidedoor-wood': '옆문 — 조립 방 그림(세로 칸막이)이 「칸막이 윗면 없음」으로 불합격. 세로 칸막이 틈은 문 없이 연다',
}
for _k in DROPPED:
    R.objs.pop(_k, None); R.goods.pop(_k, None)


# ═══════════════ 미리보기 ═══════════════
def piece_images():
    """[(id, 이름, RGBA 배열, 관문 종류)] — 등록 순서(바닥 → 벽면 → 가구 → 탁자 → 탁상)."""
    out = []
    for id_, f in R.floors.items(): out.append((id_, f['ko'], R.floor_period(id_), 'terrain'))
    for id_, w in R.walls.items(): out.append((id_, w['ko'], R.wall_period(id_), 'terrain'))
    for id_, o in R.objs.items(): out.append((id_, o['ko'], R.obj_image(id_)[0], o['gate']))
    for id_, t in R.tables.items(): out.append((id_, t['ko'], R.table_image(id_, 3, 2), 'low_furniture'))
    for id_, g in R.goods.items(): out.append((id_, g['ko'], R._canvas(g['draw'], 16, 16), g['gate']))
    return out


def preview(path, scale=3, only=None, cols=640):
    import numpy as np
    from PIL import Image, ImageDraw
    items = [p for p in piece_images() if only is None or p[0] in only]
    x = y = 6; rowh = 0; place = []
    for id_, ko, a, k in items:
        h, w = a.shape[:2]
        if x + w + 6 > cols: x, y, rowh = 6, y + rowh + 16, 0
        place.append((x, y, a, id_)); x += w + 10; rowh = max(rowh, h)
    H = y + rowh + 16
    sheet = Image.new('RGBA', (cols, H), (40, 44, 54, 255))
    for (x0, y0, a, id_) in place: sheet.alpha_composite(Image.fromarray(a, 'RGBA'), (x0, y0 + 10))
    big = sheet.resize((cols * scale, H * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for (x0, y0, a, id_) in place: d.text((x0 * scale, y0 * scale), id_[4:], fill=(200, 210, 225, 255))
    os.makedirs(os.path.dirname(path), exist_ok=True); big.save(path)
    return path, len(items)


if __name__ == '__main__':
    bad = R.selftest()
    b = R.build()
    print('칸 %d · 바닥 %d · 벽면 %d · 천장 %d · 가구 %d · 탁자 %d · 탁상 %d · 실패 %d' % (
        len(b['cells']), len(R.floors), len(R.walls), len(R.ceils), len(R.objs), len(R.tables), len(R.goods), len(bad)))
    for m in bad[:20]: print('  ✗', m)
    print(preview(os.path.join(OUT, '_all-x3.png')))
