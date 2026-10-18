# R10 일상 공간 소품 125종 굽기(append-only) - 2026-10-18 사용자 「마트나 백화점에서는 파는 물건이나 진열대를 더 다양화해라.
# 지하철 내부도 더 바꿔라 … 탑 3/4 뷰 이거 하네싱 지키면서 오브젝트를 한 100개쯤 더 늘려라」.
# 그림은 mart.py · dept.py · train.py · home.py(lib.py 의 3/4 윗면+앞면+1px 테 규칙)에 있고, 여기서는 칩셋 끝에 타일을 붙이고
# modernCityTileset.json(통과·우선·메타 + structureKits)과 modernCityRoomSpec.json(objects · goods)에 등록한다.
# 칸 규칙(R9 와 같음): floor/wall 은 그림 맨 아랫줄이 발 디딘 줄(y 0..h-1), 그 위 줄은 y<0 으로 올라간다(지나갈 수 있음).
# hang 은 벽면 두 줄(y 0·1), flat 은 바닥(2층). 다시 구우면 이미 있으면 끝낸다.
# 실행: python3 scripts/content/modern-city-int/r10/bake_r10.py
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import mart as M, dept as D, train as T, home as H
from lib import mirror

REPO = os.path.abspath(__file__).rsplit('/scripts/', 1)[0]
PNG = f'{REPO}/public/assets/modern-city/modern-city-chipset.png'
TS = f'{REPO}/src/assets/modernCityTileset.json'
RS = f'{REPO}/src/assets/modernCityRoomSpec.json'
SH = f'{REPO}/src/assets/modernCitySheet.json'

CAT_KO = {'store': '매장·마트', 'commercial': '상업·공공', 'dept': '백화점', 'station': '역 대합실', 'home': '집·아파트',
          'bath': '목욕탕·온천', 'office': '사무실', 'campus': '학교·대학', 'food': '카페·식당', 'hospital': '병원', 'lobby': '로비·엘리베이터'}
PLACE = {'wall': '북쪽 벽면 앞 첫 바닥 줄', 'floor': '실내 배치', 'hang': '벽면 윗줄', 'flat': '바닥에 깔기', 'door': '가로 칸막이의 1칸 틈'}

# (id, kind, h, ko, desc, tags, use, art, cat, facing, extra)
PROPS = [
    # ── 마트·편의점 상품 진열 (41)
    ('mart-fruit-apple', 'floor', 1, '사과 매대', '비스듬한 나무 상자 매대에 빨강·초록 사과를 수북이 쌓고 앞면에 가격표.', ['마트', '청과', '과일'], ['search'], M.fruit_apple, 'store', None),
    ('mart-fruit-banana', 'floor', 1, '바나나 매대', '나무 상자 매대 위 노란 바나나 송이 줄.', ['마트', '청과', '과일'], ['search'], M.fruit_banana, 'store', None),
    ('mart-fruit-orange', 'floor', 1, '오렌지 매대', '나무 상자 매대 위 오렌지 피라미드.', ['마트', '청과', '과일'], ['search'], M.fruit_orange, 'store', None),
    ('mart-fruit-watermelon', 'floor', 1, '수박 매대', '나무 상자 매대 위 줄무늬 수박과 반 자른 수박.', ['마트', '청과', '과일'], ['search'], M.fruit_watermelon, 'store', None),
    ('mart-veg-pyramid', 'floor', 1, '채소 피라미드 매대(3칸)', '세 칸 나무 매대 - 양배추·당근 단·토마토 피라미드.', ['마트', '청과', '채소'], ['search'], M.veg_pyramid, 'store', None),
    ('mart-veg-wall', 'wall', 1, '채소 냉장 벽 매대', '안개 분무 조명 아래 잎채소·브로콜리·파프리카 단.', ['마트', '청과', '채소', '냉장'], ['search'], M.veg_wall, 'store', None),
    ('mart-egg-tower', 'floor', 1, '달걀 탑 매대', '계단식 나무 받침에 흰·갈색 달걀판.', ['마트', '청과', '달걀'], ['search'], M.egg_stand, 'store', None),
    ('mart-flower-buckets', 'floor', 1, '꽃 양동이 매대', '계단 받침 위 튤립·장미·해바라기 양동이 셋.', ['마트', '꽃'], ['search'], M.flower_buckets, 'store', None),
    ('mart-scale-station', 'floor', 1, '청과 계량대', '전자 저울과 비닐봉지 롤을 올린 작은 스테인리스 대.', ['마트', '청과'], ['search'], M.scale_counter, 'store', None),
    ('mart-meat-showcase', 'wall', 1, '정육 대면 쇼케이스(3칸)', '굽은 유리 너머 붉은 고기 트레이 줄, 흰 받침.', ['마트', '정육', '냉장'], ['search'], M.meat_showcase, 'store', None),
    ('mart-fish-ice', 'floor', 1, '선어 얼음 매대(3칸)', '부순 얼음 위 통생선·연어 필레·조개, 스테인리스 앞판.', ['마트', '수산', '얼음'], ['search'], M.fish_ice, 'store', None),
    ('mart-sashimi-case', 'floor', 1, '회·초밥 낮은 냉장 매대', '검은 트레이에 연어·참치·초밥 팩을 올린 기울어진 열린 윗면.', ['마트', '수산', '냉장'], ['search'], M.salmon_tray, 'store', None),
    ('mart-bread-rack', 'wall', 1, '포장 빵 철망 선반', '철망 선반 세 단에 식빵·번 봉지.', ['마트', '베이커리', '빵'], ['search'], M.bread_rack, 'store', None),
    ('mart-baguette-basket', 'floor', 1, '바게트 바구니', '낮은 받침 위 바게트·롤빵을 꽂은 등나무 바구니.', ['마트', '베이커리', '빵'], ['search'], M.baguette_basket, 'store', None),
    ('mart-cake-showcase', 'wall', 1, '케이크 쇼케이스', '나무 받침 유리 진열장 두 단에 홀케이크와 조각 케이크.', ['마트', '베이커리', '케이크'], ['search'], M.cake_showcase, 'store', None),
    ('mart-donut-case', 'wall', 1, '도넛 셀프 진열장', '기울어진 유리문 속 분홍·초코·설탕 도넛 단.', ['마트', '베이커리', '도넛'], ['search'], M.donut_case, 'store', None),
    ('mart-dairy-open', 'wall', 1, '유제품 오픈 쇼케이스', '파란 간판 아래 우유팩·요구르트·치즈가 줄지은 열린 냉장 단.', ['마트', '유제품', '냉장'], ['search'], M.dairy_open, 'store', None),
    ('mart-drink-open', 'wall', 1, '음료 오픈 쇼케이스', '빨간 간판 아래 탄산·주스 페트병이 색색으로 선 열린 냉장 단.', ['마트', '음료', '냉장'], ['search'], M.drink_open, 'store', None),
    ('mart-liquor-fridge', 'wall', 1, '소주·맥주 냉장고', '유리문 둘 속 초록 소주병·호박색 맥주·은색 캔.', ['마트', '주류', '냉장'], ['search'], M.liquor_case, 'store', None),
    ('mart-gondola-ramen', 'floor', 1, '라면 곤돌라(빨강)', '빨강·주황 라면 봉지와 컵라면이 세 단에 선 곤돌라.', ['마트', '곤돌라', '라면'], ['search'], M.g_ramen, 'store', None),
    ('mart-gondola-snack', 'floor', 1, '과자 곤돌라(노랑)', '노랑·주황 과자 봉지 곤돌라.', ['마트', '곤돌라', '과자'], ['search'], M.g_snack, 'store', None),
    ('mart-gondola-tea', 'floor', 1, '차·음료 곤돌라(초록)', '초록 녹차 페트와 차 상자 곤돌라.', ['마트', '곤돌라', '음료'], ['search'], M.g_tea, 'store', None),
    ('mart-gondola-water', 'floor', 1, '생수 곤돌라(파랑)', '파란 라벨 생수병 줄과 아래 단 묶음 팩.', ['마트', '곤돌라', '음료'], ['search'], M.g_water, 'store', None),
    ('mart-gondola-cereal', 'floor', 1, '시리얼 곤돌라(보라)', '보라·노랑 시리얼 상자 곤돌라.', ['마트', '곤돌라', '시리얼'], ['search'], M.g_cereal, 'store', None),
    ('mart-gondola-cans', 'floor', 1, '통조림 곤돌라', '은색 뚜껑 통조림이 색 라벨별로 선 곤돌라.', ['마트', '곤돌라', '통조림'], ['search'], M.g_cans, 'store', None),
    ('mart-gondola-detergent', 'floor', 1, '세제 곤돌라', '청록·분홍 세제 통과 섬유유연제 곤돌라.', ['마트', '곤돌라', '생활'], ['search'], M.g_detergent, 'store', None),
    ('mart-gondola-household', 'floor', 1, '생활용품 곤돌라', '휴지·키친타월 묶음과 칫솔 걸이 곤돌라.', ['마트', '곤돌라', '생활'], ['search'], M.g_household, 'store', None),
    ('mart-freezer-dumpling', 'floor', 1, '냉동 만두 평대', '흰 냉동 평대 유리 뚜껑 속 만두·냉동식품 봉지.', ['마트', '냉동'], ['search'], M.frozen_dumpling, 'store', None),
    ('mart-freezer-icecream', 'floor', 1, '아이스크림 평대', '유리 뚜껑 평대 속 색색 아이스크림 콘·바.', ['마트', '냉동', '아이스크림'], ['search'], M.ice_cream_chest, 'store', None),
    ('mart-sample-cart', 'floor', 1, '시식 코너 카트', '줄무늬 파라솔 아래 핫플레이트와 이쑤시개 시식 컵.', ['마트', '시식'], ['search'], M.sample_cart, 'store', None),
    ('mart-sale-endcap', 'floor', 1, '특가 엔드캡 매대', '박스 탑과 장대 위 노란 특가 판.', ['마트', '특가', '진열'], ['search'], M.sale_endcap, 'store', None),
    ('mart-sale-banner', 'hang', 0, '특가 현수막', '노란 가격 폭발 무늬가 찍힌 빨간 벽걸이 현수막.', ['마트', '특가'], None, M.price_banner, 'store', None),
    ('mart-rice-pallet', 'floor', 1, '쌀 포대 팔레트', '나무 팔레트 위 크림색 10kg 쌀 포대 두 단.', ['마트', '쌀', '창고'], ['search'], M.rice_sacks, 'store', None),
    ('mart-candy-bins', 'floor', 1, '벌크 사탕 통', '기울어진 투명 통에 색색 사탕과 국자.', ['마트', '과자'], ['search'], M.candy_bins, 'store', None),
    ('mart-self-checkout', 'floor', 1, '셀프 계산대 키오스크', '터치 화면 기둥·스캐너 유리·카드 단말·봉투 선반.', ['마트', '계산대'], ['counter'], M.self_checkout, 'store', None),
    ('mart-cart-bay', 'floor', 1, '카트 보관대', '빨간 손잡이 스테인리스 카트 넷이 포개진 보관 줄.', ['마트', '카트'], ['block'], M.cart_row, 'store', None),
    ('mart-basket-stacker', 'floor', 1, '장바구니 스태커', '바퀴 달린 받침에 파랑·주황 장바구니를 높이 쌓았다.', ['마트', '장바구니'], ['block'], M.basket_stacker, 'store', None),
    ('konbini-hot-snack', 'floor', 1, '핫스낵 온장고', '불 켜진 유리 상자 속 치킨·고로케·핫도그.', ['편의점', '핫스낵'], ['search'], M.hot_snack_case, 'store', None),
    ('konbini-oden', 'floor', 1, '오뎅 조리대', '칸 나뉜 스테인리스 냄비에 무·달걀·어묵, 위 뚜껑 걸이.', ['편의점', '오뎅'], ['search'], M.oden_pot, 'store', None),
    ('konbini-copier', 'wall', 1, '편의점 복합기', '크림색 복사기 - 뚜껑·터치 패널·동전 투입구.', ['편의점', '복사기'], ['block'], M.copy_machine, 'store', None),
    ('konbini-magazine-rack', 'wall', 1, '잡지 랙', '창가 기울어진 선반에 색색 잡지 표지와 만화책.', ['편의점', '잡지'], ['read'], M.magazine_rack, 'store', None),
    # ── 백화점 부티크·명품 (28)
    ('dept-mannequin-suit', 'floor', 1, '마네킹(남성 정장)', '둥근 받침 위 남색 정장·흰 셔츠·빨간 넥타이 남성 마네킹.', ['백화점', '패션', '마네킹'], ['block'], D.mannequin_suit, 'dept', None),
    ('dept-mannequin-dress', 'floor', 1, '마네킹(드레스)', '빨간 플레어 이브닝 드레스 여성 마네킹.', ['백화점', '패션', '마네킹'], ['block'], D.mannequin_dress, 'dept', None),
    ('dept-mannequin-coat', 'floor', 1, '마네킹(트렌치코트)', '벨트·스카프를 맨 카멜 트렌치코트 마네킹.', ['백화점', '패션', '마네킹'], ['block'], D.mannequin_coat, 'dept', None),
    ('dept-mannequin-casual', 'floor', 1, '마네킹(캐주얼)', '줄무늬 니트와 청바지 여성 마네킹.', ['백화점', '패션', '마네킹'], ['block'], D.mannequin_casual, 'dept', None),
    ('dept-mannequin-kids', 'floor', 1, '마네킹(아동)', '노란 우비와 책가방을 멘 작은 아동 마네킹.', ['백화점', '아동', '마네킹'], ['block'], D.mannequin_kids, 'dept', None),
    ('dept-rack-warm', 'floor', 1, '원형 행거(빨강·주황)', '둥근 받침 원형 행거에 따뜻한 색 옷이 둘러 걸렸다.', ['백화점', '패션', '행거'], ['search'], D.rack_warm, 'dept', None),
    ('dept-rack-cool', 'floor', 1, '원형 행거(파랑)', '원형 행거에 파랑·남색 셔츠와 재킷.', ['백화점', '패션', '행거'], ['search'], D.rack_cool, 'dept', None),
    ('dept-rack-mono', 'floor', 1, '원형 행거(흑백)', '원형 행거에 검정·회색·흰 옷.', ['백화점', '패션', '행거'], ['search'], D.rack_mono, 'dept', None),
    ('dept-rack-pastel', 'floor', 1, '원형 행거(파스텔)', '원형 행거에 분홍·민트·라벤더 원피스.', ['백화점', '패션', '행거'], ['search'], D.rack_pastel, 'dept', None),
    ('dept-handbag-vitrine', 'wall', 1, '명품 가방 유리 진열장', '불 켜진 유리 칸마다 가죽 가방 하나, 황동 틀.', ['백화점', '명품', '가방'], ['search'], D.handbag_case, 'dept', None),
    ('dept-watch-case', 'floor', 1, '시계 쇼케이스', '검은 옻칠 진열대 유리 윗면에 쿠션 위 시계 줄, 황동 테.', ['백화점', '명품', '시계'], ['search'], D.watch_case, 'dept', None, {'surface': True}),
    ('dept-jewelry-island', 'floor', 1, '주얼리 원형 아일랜드', '흰 받침 위 유리 링 상판, 벨벳 위 목걸이·반지.', ['백화점', '보석'], ['search'], D.jewelry_island, 'dept', None),
    ('dept-cosmetic-island', 'floor', 1, '화장품 테스트 아일랜드', '흰 카운터 위 립스틱·팔레트 테스터 트레이와 타원 거울.', ['백화점', '화장품'], ['search'], D.cosmetic_island, 'dept', None),
    ('dept-perfume-wall', 'wall', 1, '향수 브랜드 벽', '백라이트 선반에 호박색·장미색·투명 향수병.', ['백화점', '화장품', '향수'], ['search'], D.perfume_wall, 'dept', None),
    ('dept-nail-bar', 'wall', 1, '네일 컬러 바', '층층 벽 선반에 무지개 매니큐어 병.', ['백화점', '화장품', '네일'], ['search'], D.nail_bar, 'dept', None),
    ('dept-skincare-counter', 'floor', 1, '스킨케어 카운터', '민트 카운터 위 크림 병·펌프와 브랜드 조명판.', ['백화점', '화장품'], ['counter'], D.skincare_counter, 'dept', None),
    ('dept-shoe-wall', 'wall', 1, '구두 월 디스플레이', '흰 선반 칸마다 하이힐·로퍼·부츠 한 켤레.', ['백화점', '구두'], ['search'], D.shoe_wall, 'dept', None),
    ('dept-sneaker-wall', 'wall', 1, '스니커즈 월', '조명 큐브마다 색색 운동화.', ['백화점', '구두', '운동화'], ['search'], D.sneaker_wall, 'dept', None),
    ('dept-shoe-bench', 'floor', 1, '구두 시착 벤치', '구둣주걱과 발 거울을 둔 가죽 오토만.', ['백화점', '구두'], ['sit'], D.shoe_bench, 'dept', None),
    ('dept-fitting-curtain', 'wall', 1, '탈의실 커튼 부스', '벨벳 커튼을 친 번호판 탈의실, 안에 의자.', ['백화점', '패션', '탈의실'], ['block'], D.fitting_curtain, 'dept', None),
    ('dept-info-desk', 'floor', 1, '백화점 안내 데스크(3칸)', '금 테 흰 곡선 데스크, i 표지판과 안내 책자 꽂이.', ['백화점', '안내'], ['counter'], D.info_desk, 'dept', None),
    ('dept-accessory-wall', 'wall', 1, '잡화 훅 벽', '타공판 훅에 벨트·지갑·소가죽 잡화.', ['백화점', '잡화'], ['search'], D.bag_hook_wall, 'dept', None),
    ('dept-hat-stand', 'floor', 1, '모자 진열대', '층층 둥근 받침에 페도라·베레·밀짚모자.', ['백화점', '잡화', '모자'], ['search'], D.hat_stand, 'dept', None),
    ('dept-eyewear-tower', 'floor', 1, '선글라스 회전 진열대', '흰 기둥에 선글라스 줄과 작은 거울.', ['백화점', '잡화', '안경'], ['search'], D.sunglasses_stand, 'dept', None),
    ('dept-tie-case', 'floor', 1, '넥타이·커프스 쇼케이스', '유리 윗면 속 말아 둔 넥타이 격자.', ['백화점', '남성', '잡화'], ['search'], D.tie_case, 'dept', None),
    ('dept-knit-table', 'floor', 1, '니트·스카프 평대', '낮은 나무 탁자에 색색 개어 둔 스웨터·스카프 더미.', ['백화점', '패션'], ['search'], D.scarf_table, 'dept', None),
    ('dept-gift-wrap', 'floor', 1, '선물 포장 카운터', '포장지 롤 걸이·리본·포장한 상자를 올린 카운터.', ['백화점', '선물'], ['counter'], D.gift_wrap, 'dept', None),
    ('dept-vip-sofa', 'floor', 1, 'VIP 라운지 러브시트', '금 다리 크림 가죽 2인 소파(남향).', ['백화점', '라운지', '소파'], ['sit'], D.vip_sofa, 'dept', 'S'),
    # ── 전동차·역 (27)
    ('train-seat7-green-s', 'wall', 1, '7인석 롱시트 초록(남향)', '북쪽 벽 초록 모켓 7인석 - 자리 구분 홈 여섯, 양 끝 스테인리스 칸막이, 남쪽 통로를 본다.', ['지하철', '전동차', '좌석'], ['sit'], T.seat7_green_s, 'station', 'S'),
    ('train-seat7-green-n', 'floor', 1, '7인석 롱시트 초록(북향)', '남쪽 벽 초록 모켓 7인석 - 등받이와 창턱 레일이 보이고 북쪽 통로를 본다.', ['지하철', '전동차', '좌석'], ['sit'], T.seat7_green_n, 'station', 'N'),
    ('train-seat7-blue-s', 'wall', 1, '7인석 롱시트 파랑(남향)', '북쪽 벽 파랑 모켓 7인석(서울 지하철풍) - 자리 구분 홈, 스테인리스 칸막이.', ['지하철', '전동차', '좌석'], ['sit'], T.seat7_blue_s, 'station', 'S'),
    ('train-seat7-blue-n', 'floor', 1, '7인석 롱시트 파랑(북향)', '남쪽 벽 파랑 모켓 7인석 - 등받이가 보이고 북쪽을 본다.', ['지하철', '전동차', '좌석'], ['sit'], T.seat7_blue_n, 'station', 'N'),
    ('train-priority-pink-s', 'wall', 1, '노약자석 분홍(남향)', '객차 끝 북쪽 벽 분홍 모켓 3인 노약자석과 위 노약자 표지.', ['지하철', '전동차', '좌석', '노약자석'], ['sit'], T.priority_pink_s, 'station', 'S'),
    ('train-priority-orange-n', 'floor', 1, '노약자석 주황(북향)', '객차 끝 남쪽 벽 주황 모켓 3인 노약자석과 표지.', ['지하철', '전동차', '좌석', '노약자석'], ['sit'], T.priority_orange_n, 'station', 'N'),
    ('train-window-blind', 'hang', 0, '객차 창(롤 블라인드)', '은색 창틀 속 반쯤 내린 롤 블라인드와 바깥 도시 풍경, 위 광고 액자.', ['지하철', '전동차', '창'], ['light'], T.window_blind, 'station', None),
    ('train-window-tunnel', 'hang', 0, '객차 창(터널)', '어두운 터널 유리에 비친 천장 조명, 블라인드 걷음, 작은 스티커.', ['지하철', '전동차', '창'], ['light'], T.window_tunnel, 'station', None),
    ('train-route-strip', 'hang', 0, '노선도 띠·광고 카드', '현재 역을 빨강으로 찍은 노선 띠, 아래 노선 스티커와 광고 카드.', ['지하철', '전동차', '노선도'], ['read'], T.route_strip, 'station', None),
    ('train-lcd-dual', 'hang', 0, '듀얼 LCD 행선 모니터', '출입문 위 검은 베젤 두 화면 - 다음 역 안내와 광고.', ['지하철', '전동차', '모니터'], ['read'], T.lcd_dual, 'station', None),
    ('train-door-steel', 'hang', 0, '스테인리스 양문 출입문', '키 큰 창 달린 스테인리스 미닫이문, 문 끝 노란 띠와 손끼임 주의 스티커.', ['지하철', '전동차', '문'], None, T.door_steel, 'station', None),
    ('train-luggage-rack', 'hang', 0, '선반·광고 액자', '가방·신문을 올린 크롬 선반과 아래 광고 액자 셋.', ['지하철', '전동차', '선반', '광고'], None, T.luggage_rack, 'station', None),
    ('train-extinguisher', 'hang', 0, '객차 소화기함', '객차 끝 벽에 묻은 빨간 글자 소화기함.', ['지하철', '전동차', '안전'], None, T.extinguisher, 'station', None),
    ('train-emergency-cock', 'hang', 0, '비상 코크함', '노랑·검정 경고 띠와 빨간 손잡이가 있는 비상 문 열림 함.', ['지하철', '전동차', '안전'], None, T.emergency_cock, 'station', None),
    ('train-sos-intercom', 'hang', 0, '비상 인터폰', '스피커 망과 빨간 호출 단추 스테인리스 판.', ['지하철', '전동차', '안전'], None, T.sos_intercom, 'station', None),
    ('train-wheelchair-space', 'wall', 1, '휠체어 공간', '접이식 보조 의자·가로 손잡이·파란 휠체어 표지가 있는 객차 끝 벽.', ['지하철', '전동차', '휠체어'], ['block'], T.wheelchair_space, 'station', None),
    ('train-hanging-ad', 'floor', 1, '중조 광고', '천장 레일에 집게로 매단 양면 광고 - 지나갈 수 있고 승객 머리 위에 그려진다.', ['지하철', '전동차', '광고'], ['walk'], T.hanging_ad, 'station', None),
    ('train-ceiling-ac', 'floor', 1, '천장 에어컨 루버', '천장 라인 디퓨저 루버와 양옆 형광등 - 지나갈 수 있다.', ['지하철', '전동차', '천장'], ['walk'], T.ceiling_ac, 'station', None),
    ('train-door-sill', 'flat', 1, '출입문 문턱 안전 띠', '스테인리스 문턱 홈과 그 안쪽 노란 점 경고 띠.', ['지하철', '전동차', '문', '바닥'], ['walk'], T.door_sill, 'station', None),
    ('train-stanchion', 'floor', 1, '스테인리스 수직 봉', '둥근 바닥판과 손 높이 파란 매듭이 있는 바닥-천장 봉.', ['지하철', '전동차', '손잡이'], ['block'], T.stanchion, 'station', None),
    ('train-cab-windshield', 'hang', 0, '운전실 전면 유리창', '와이퍼 자국 유리 너머 터널 입구로 모이는 선로와 신호등, 위 행선 표시.', ['지하철', '전동차', '운전실', '창'], ['light'], T.cab_window, 'station', None),
    ('train-cab-desk', 'floor', 1, '운전대 계기판(3칸)', '속도·압력계, 주간 제어기 T 손잡이, ATS 모니터, 시각표 꽂이가 있는 검은 경사 콘솔(북향).', ['지하철', '전동차', '운전실'], ['block'], T.cab_desk, 'station', 'N'),
    ('station-name-sign', 'hang', 0, '승강장 역명판', '이 역 이름 띠, 앞뒤 역 화살표, 노선 색 띠.', ['역', '지하철', '표지'], ['read'], T.station_sign, 'station', None),
    ('station-timetable', 'hang', 0, '역 시각표', '평일·휴일 색 머리 아래 출발 분 격자.', ['역', '지하철', '시각표'], ['read'], T.timetable, 'station', None),
    ('station-ic-charger', 'wall', 1, '교통카드 충전기', '터치 화면·카드 투입구·지폐 투입구가 있는 초록 단말.', ['역', '지하철', '교통카드'], ['counter'], T.ic_charger, 'station', None),
    ('station-coin-lockers', 'wall', 1, '코인 로커', '번호 붙은 스테인리스 사물함 칸과 아래 큰 짐 칸.', ['역', '지하철', '사물함'], ['open'], T.coin_lockers, 'station', None),
    ('station-platform-edge', 'flat', 1, '승강장 끝 점자 띠', '흰 가장자리 띠와 노란 점자 줄.', ['역', '지하철', '바닥', '점자'], ['walk'], T.platform_edge, 'station', None),
    # ── 집·학교·사무 일상 (27 + 탁상 2)
    ('home-genkan-shoes', 'flat', 1, '현관 신발들', '현관 턱에 나란히 벗어 둔 운동화 두 켤레와 로퍼.', ['집', '현관', '신발'], ['walk'], H.shoe_pile, 'home', None),
    ('home-umbrella-stand', 'floor', 1, '우산꽂이', '빨강·남색·투명 우산을 꽂은 스테인리스 통.', ['집', '현관'], ['block'], H.umbrella_stand, 'home', None),
    ('home-shoe-cabinet', 'wall', 1, '현관 신발장', '루버 문 나무 신발장, 위에 열쇠 접시와 작은 화분.', ['집', '현관', '신발'], ['open'], H.shoe_cabinet, 'home', None),
    ('home-school-bag', 'floor', 1, '책가방', '바닥에 둔 빨간 란도셀 - 은색 잠금쇠.', ['집', '학생', '가방'], ['walk'], H.school_bag, 'home', None),
    ('home-washing-machine', 'wall', 1, '드럼 세탁기', '흰 몸통, 다이얼 띠, 거품 보이는 둥근 문.', ['집', '세탁'], ['block'], H.washing_machine, 'home', None),
    ('home-laundry-basket', 'floor', 1, '빨래 바구니', '갠 수건과 줄무늬 셔츠가 담긴 등나무 바구니.', ['집', '세탁'], ['search'], H.laundry_basket, 'home', None),
    ('home-drying-rack', 'floor', 1, '실내 빨래 건조대', '수건·티셔츠·양말을 집게로 넌 크롬 건조대.', ['집', '세탁'], ['block'], H.drying_rack, 'home', None),
    ('home-vanity-sink', 'wall', 1, '욕실 세면대·거울', '나무 수납장 위 흰 세면기, 선반 달린 거울, 칫솔 컵과 비누.', ['집', '욕실'], ['block'], H.vanity_sink, 'bath', None),
    ('home-ofuro', 'floor', 2, '욕조(2×2)', '김 오르는 물을 채운 깊은 흰 욕조, 끝에 말아 둔 덮개와 급탕 리모컨.', ['집', '욕실'], ['block'], H.bathtub, 'bath', None),
    ('home-bath-stool', 'floor', 1, '목욕 의자·바가지', '타일 바닥 위 플라스틱 목욕 의자와 노란 바가지.', ['집', '욕실', '목욕탕'], ['block'], H.bath_stool, 'bath', None),
    ('home-appliance-rack', 'wall', 1, '전자레인지·밥솥 랙', '위 칸 전자레인지, 아래 칸 밥솥 - 작은 집 가전 탑.', ['집', '부엌', '가전'], ['block'], H.microwave_shelf, 'home', None),
    ('home-sink-counter', 'wall', 1, '개수대·식기건조대', '스테인리스 개수대와 수도꼭지, 접시·컵을 세운 식기건조대, 아래 찬장.', ['집', '부엌'], ['block'], H.dish_rack, 'home', None),
    ('home-dining-set', 'floor', 2, '차려진 식탁(2×2)', '밥공기 넷·된장국·가운데 구이 접시·간장병을 차린 가족 식탁.', ['집', '부엌', '식탁'], ['block'], H.dining_table4, 'home', None, {'surface': True}),
    ('home-kotatsu', 'floor', 2, '코타츠(2×2)', '체크 이불 위 네모 나무 상판, 귤 그릇과 리모컨.', ['집', '거실'], ['block'], H.kotatsu, 'home', None),
    ('home-floor-lamp', 'floor', 1, '스탠드 조명', '대리석 받침·가는 기둥·따뜻한 드럼 갓.', ['집', '거실', '조명'], ['light'], H.floor_lamp, 'home', None),
    ('home-electric-fan', 'floor', 1, '선풍기', '파란 날개 둥근 망, 목, 둥근 받침.', ['집', '거실', '가전'], ['block'], H.electric_fan, 'home', None),
    ('home-wall-ac', 'hang', 0, '벽걸이 에어컨', '흰 실내기·루버·파란 상태 등.', ['집', '가전'], None, H.wall_ac, 'home', None),
    ('home-cat-bed', 'floor', 1, '고양이 방석', '둥근 분홍 방석에 몸을 만 주황 고양이.', ['집', '거실', '고양이'], ['block'], H.cat_bed, 'home', None),
    ('home-laptop-desk', 'wall', 1, '노트북 책상', '벽을 보는 나무 책상에 펼친 노트북·머그·스탠드.', ['집', '공부', '책상'], ['search'], H.laptop_desk, 'home', None),
    ('home-low-shelf', 'wall', 1, '거실 낮은 장식장', '만화책 줄·가족 사진 액자·작은 스피커를 둔 낮은 장(서가 아님).', ['집', '거실'], ['search'], H.bookshelf_low, 'home', None),
    ('home-monstera', 'floor', 1, '몬스테라 화분', '흰 화분의 갈라진 잎 큰 몬스테라.', ['집', '화분'], ['block'], H.potted_monstera, 'home', None),
    ('home-zabuton', 'flat', 1, '방석 둘과 찻쟁반', '보라·청록 방석 둘 사이 찻잔 쟁반 - 밟고 지나간다.', ['집', '다다미', '방석'], ['walk'], H.floor_cushions, 'home', None),
    ('school-teacher-podium', 'floor', 1, '교사 교탁', '출석부와 분필 상자를 올린 나무 교탁.', ['학교', '교실'], ['read'], H.teacher_podium, 'campus', None),
    ('school-cleaning-locker', 'wall', 1, '청소 도구함', '환기 홈 회색 철제 함, 기댄 빗자루와 쓰레받기.', ['학교', '교실', '청소'], ['open'], H.cleaning_locker, 'campus', None),
    ('office-water-cooler', 'wall', 1, '정수기', '흰 받침 위 파란 물통, 온·냉수 꼭지, 종이컵 꽂이.', ['사무실', '정수기'], ['heal'], H.water_cooler, 'office', None),
    ('office-copier', 'wall', 1, '사무용 복합기', '회색 몸통·스캐너 덮개·터치 패널·출력 용지·용지 서랍.', ['사무실', '복사기'], ['block'], H.copier, 'office', None),
    ('office-whiteboard-stand', 'floor', 1, '이동식 화이트보드', '마커 낙서·포스트잇·마커 받침이 있는 바퀴 달린 화이트보드.', ['사무실', '회의', '학교'], ['read'], H.whiteboard_stand, 'office', None),
]
GOODS = [
    ('mci-g-rice-cooker', '밥솥', H.rice_cooker),
    ('mci-g-toaster', '토스터', H.toaster),
]


def main():
    bake(PROPS, GOODS, 'mart-fruit-apple', 'r10')


def bake(PROPS, GOODS, sentinel, tag):
    sheet = Image.open(PNG).convert('RGBA')
    ts = json.load(open(TS)); rs = json.load(open(RS))
    cols = ts['tilesPerRow']; assert cols == 48
    if sentinel in rs['objects']:
        sys.exit('already baked')
    PASS = {'up': True, 'down': True, 'left': True, 'right': True}
    SOLID = {'up': False, 'down': False, 'left': False, 'right': False}
    new_tiles, kits, spec, goods = [], {}, {}, {}

    def add(img, passable, meta):
        new_tiles.append((img, passable, meta))
        return ts['count'] + len(new_tiles) - 1

    def meta(label, desc, tags, solid):
        return {'label': label, 'description': desc, 'role': 'prop', 'passage': 'solid' if solid else 'passable', 'defaultLayer': 'upper',
                'tags': ['modern-city', '실내', *tags], 'source': 'bundled-default', 'confidence': 'high', 'repeatability': 'fixed', 'layerBacking': 'none'}

    ids = [p[0] for p in PROPS]
    assert len(ids) == len(set(ids)), 'duplicate id'
    for p in PROPS:
        pid, kind, h, ko, desc, tags, use, fn, cat, facing = p[:10]
        extra = p[10] if len(p) > 10 else {}
        assert pid not in rs['objects'], pid
        img = fn(); w, rows = img.width // 16, img.height // 16
        assert img.width % 16 == 0 and img.height % 16 == 0, (pid, img.size)
        if kind == 'hang': top, h, up = 0, 0, 0
        elif kind == 'flat': top, up = 0, 0; h = rows
        elif kind == 'door': top, h, up = 0, 0, 0
        else: top = -(rows - h); up = (rows - h) * 16
        layer = 2 if kind == 'flat' else 3
        cells, krows = [], []
        for ry in range(rows):
            y = top + ry; ups = []
            for x in range(w):
                im = img.crop((x * 16, ry * 16, x * 16 + 16, ry * 16 + 16))
                if not im.getbbox(): ups.append(-1); continue
                solid = kind in ('floor', 'wall') and y >= 0 and 'walk' not in (use or [])
                t = add(im, SOLID if solid else PASS, meta(f'{ko} ({x},{y})', desc, tags, solid))
                cells.append([x, y, t, 2 if kind == 'door' and y == rows - 1 else layer]); ups.append(t)
            krows.append({'tiles': [-1] * w, 'upperTiles': ups})
        kid = f'mc-in-{tag}-{pid}'
        kits[kid] = {'id': kid, 'kind': 'section', 'name': ko, 'width': w, 'height': rows, 'tileSize': 16, 'rows': krows, 'learnedFrom': 'modern-city-interior',
                     'ai': {'description': desc, 'placementRules': PLACE[kind], 'tags': ['modern-city', '실내', CAT_KO[cat], *tags], 'role': 'prop',
                            'repeatability': 'fixed', 'layerHome': 'upper', 'themes': ['현대 도시'], 'origin': 'ai', 'confidence': 'high',
                            'snap': 'floor', 'anchor': {'dx': 0, 'dy': -top}}}
        spec[pid] = {'ko': ko, 'kind': kind, 'desc': desc, 'tags': tags, 'place': PLACE[kind], 'category': cat, 'category_ko': CAT_KO[cat],
                     'cells': cells, 'w': w, 'h': h, 'up': up, **({'use': use} if use else {}), **({'facing': facing} if facing else {}), **extra}
    for gid, ko, fn in GOODS:
        assert gid not in rs['goods'], gid
        img = fn(); assert img.size == (16, 16), gid
        goods[gid] = add(img, PASS, meta(ko, f'탁상 물건 - {ko}', ['부엌', '탁상'], False))

    n0 = ts['count']; n = n0 + len(new_tiles)
    rows = (n + cols - 1) // cols
    out = Image.new('RGBA', (cols * 16, max(sheet.height, rows * 16)), (0, 0, 0, 0)); out.paste(sheet, (0, 0))
    for i, (im, *_r) in enumerate(new_tiles):
        t = n0 + i; out.paste(im, ((t % cols) * 16, (t // cols) * 16))
    out.save(PNG, optimize=True)
    for im, p, m in new_tiles:
        ts['passability'].append(p); ts['priority'].append('upper'); ts['terrain'].append(0); ts['tileMeta'].append(m)
    ts['count'] = n
    ts['structureKits'].extend(kits.values())
    rs['objects'].update(spec); rs['goods'].update(goods)
    dump = lambda o, ea=False: json.dumps(o, ensure_ascii=ea, separators=(',', ':'))
    open(TS, 'w').write(dump(ts) + '\n'); open(RS, 'w').write(dump(rs, True) + '\n')
    open(SH, 'w').write('{"count": %d,"tilesPerRow": %d}\n' % (n, cols))
    print('baked', len(spec), 'objects +', len(goods), 'goods,', len(new_tiles), 'tiles', n0, '->', n, 'sheet', out.size)


if __name__ == '__main__':
    main()
