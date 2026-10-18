# R11 signature props (west-facing driver cab + 11 facility categories) - 2026-10-18 21:17 user directive
# 「왜 방을 사각형으로만 만드냐」「지하철 운전실이 왜 저따구냐 - 왼쪽으로 진행방향을 잡았으면 왼쪽을 봐야하는 거 아니냐」「84개 실내 다 만들어」.
# Drawing lives in p_cab_edu_med.py / p_food_fun_home_pub.py / p_trans_jp_misc.py (r10/lib.py 3/4 top-view rules);
# tile-strip + registration reuse r10/bake_r10.bake (same cell rules, append-only).
# Run: python3 scripts/content/modern-city-int/r11/bake_r11.py
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'r10'))
sys.path.insert(0, HERE)
import bake_r10
from bake_r10 import bake
import p_cab_edu_med as A, p_food_fun_home_pub as B, p_trans_jp_misc as C

bake_r10.CAT_KO.update({'amuse': '오락시설', 'public': '공공시설', 'jp': '일본 전통', 'hotel': '숙박시설', 'industry': '공장·창고', 'service': '미용·세탁·부동산', 'transport': '교통시설', 'art': '미술관'})

# (id, kind, h, ko, desc, tags, use, art, cat, facing)
PROPS = [
    # -- driver cab facing WEST + station-side seat
    ('train-cab-front-w', 'floor', 8, '운전실 앞면(서향 유리·제어대)', '서쪽 끝을 따라 앞유리(선로가 터널 입구로 모이는 모습)가 있고 그 뒤에 계기·ATS 모니터·마스콘 손잡이를 둔 제어대 - 진행 방향(서쪽)을 본다.', ['전동차', '운전실'], ['block'], A.cab_front_w, 'station', 'W'),
    ('train-cab-seat-w', 'floor', 1, '기관사 의자(서향)', '쿠션이 제어대 쪽(서쪽), 높은 등받이가 동쪽 칸막이 쪽에 선 남색 의자.', ['전동차', '운전실', '의자'], ['sit'], A.cab_seat_w, 'station', 'W'),
    # -- 교육
    ('school-blackboard', 'hang', 0, '칠판(3칸)', '나무 틀 녹색 칠판, 분필 글씨와 분필받이.', ['학교', '교실', '칠판'], ['read'], A.blackboard, 'campus', None),
    ('school-piano', 'wall', 1, '업라이트 피아노', '악보대와 건반·페달이 보이는 검은 피아노.', ['학교', '음악', '피아노'], ['block'], A.piano_upright, 'campus', None),
    ('dorm-bunk-bed', 'floor', 2, '2층 침대', '동쪽에 사다리, 윗단에 파란 이불을 만 기숙사 침대.', ['기숙사', '침대'], ['sleep'], A.bunk_bed, 'campus', None),
    ('kinder-play-mat', 'flat', 1, '유치원 알파벳 매트(3×2)', '빨강·노랑·초록·파랑 퍼즐 매트.', ['유치원', '매트'], ['walk'], A.play_mat, 'campus', None),
    ('kinder-cubby', 'wall', 1, '유치원 사물함 칸', '칸마다 가방이나 인형이 든 나무 사물함.', ['유치원', '사물함'], ['search'], A.cubby_shelf, 'campus', None),
    # -- 의료
    ('clinic-dental-chair', 'floor', 1, '치과 진료 의자(가로)', '머리를 서쪽에 둔 눕힌 청록 의자, 무영등 팔과 가글 그릇.', ['치과', '의자', '병원'], ['block'], A.dental_chair, 'hospital', None),
    ('clinic-psych-couch', 'floor', 1, '정신과 상담 긴 의자', '베개와 담요를 얹은 크림색 긴 의자, 휴지 상자.', ['정신과', '병원', '상담'], ['sit'], A.psych_couch, 'hospital', None),
    ('clinic-herb-cabinet', 'wall', 1, '한약 서랍장(3칸)', '놋쇠 손잡이 서랍이 빼곡한 나무 장, 위에 말린 약초.', ['한의원', '약재'], ['search'], A.herb_cabinet, 'hospital', None),
    ('clinic-acupuncture-bed', 'floor', 1, '침구·마사지 침대', '얼굴 구멍 베개, 말아 둔 수건과 뜸 쟁반.', ['한의원', '침대'], ['sleep'], A.acupuncture_bed, 'hospital', None),
    ('clinic-vet-table', 'floor', 1, '동물병원 진찰대', '얼룩 고양이를 올린 스테인리스 진찰대, 저울 접시.', ['동물병원', '진료'], ['block'], A.vet_table, 'hospital', None),
    ('clinic-pet-kennels', 'wall', 1, '입원 케이지 벽', '철망 케이지 두 단 - 졸린 개와 고양이.', ['동물병원', '케이지'], ['block'], A.pet_kennels, 'hospital', None),
    ('clinic-pharmacy-shelf', 'wall', 1, '약국 약장(3칸)', '색색 약 상자와 병, 위에 초록 십자 간판.', ['약국', '약'], ['search'], A.pharmacy_shelf, 'hospital', None),
    # -- 상점
    ('shop-peg-wall', 'wall', 1, '100엔숍 걸이벽', '잡화를 건 구멍판과 노란 100 깃발.', ['100엔숍', '잡화'], ['search'], A.peg_wall, 'store', None),
    ('shop-stationery-rack', 'floor', 1, '문구 진열대', '펜통·파스텔 공책 탑·테이프·인주를 올린 기울어진 선반.', ['문구점', '문구'], ['search'], A.stationery_rack, 'store', None),
    ('shop-laptop-table', 'floor', 1, '전자제품 체험대', '푸른 화면이 켜진 노트북 셋과 태블릿, 가격표.', ['전자제품', '노트북'], ['search'], A.laptop_table, 'store', None),
    ('shop-used-shelf', 'floor', 1, '중고 선반', '장난감·램프·라디오·카세트에 손글씨 가격표.', ['중고상점', '선반'], ['search'], A.used_goods_shelf, 'store', None),
    ('shop-flower-cooler', 'wall', 1, '꽃 냉장 쇼케이스', '서리 낀 유리문 뒤 장미·튤립·해바라기 양동이.', ['꽃집', '냉장'], ['search'], A.flower_cooler, 'store', None),
    ('shop-drug-gondola', 'floor', 1, '드럭스토어 곤돌라', '분홍·초록 화장품 상자와 병, 프로모 띠.', ['드럭스토어', '곤돌라'], ['search'], A.drug_gondola, 'store', None),
    # -- 음식점
    ('food-sushi-case', 'floor', 1, '스시 카운터 진열장(3칸)', '편백 틀 유리 진열장에 니기리가 줄지었고 위에 칼 꽂이와 간장 접시.', ['스시', '카운터'], ['block'], B.sushi_case, 'food', None),
    ('food-grill-table', 'floor', 2, '야키니쿠 불판 식탁(2×2)', '둥근 숯불판, 고기 접시, 집게와 천장에서 내려온 덕트.', ['야키니쿠', '식탁'], ['block'], B.grill_table, 'food', None),
    ('food-bento-counter', 'floor', 1, '도시락 카운터(3칸)', '따뜻한 유리 속 도시락 상자, 금전 쟁반과 손글씨 메뉴판.', ['도시락', '카운터'], ['block'], B.bento_counter, 'food', None),
    ('food-fastfood-counter', 'floor', 1, '패스트푸드 주문 카운터(3칸)', '빨강·노랑 앞판, 메뉴 패널, 트레이와 튀김기, 음료 컵.', ['패스트푸드', '카운터'], ['block'], B.fastfood_counter, 'food', None),
    ('food-ticket-machine', 'floor', 1, '라멘 식권기', '사진 버튼 줄과 동전 투입구, 식권 나오는 곳.', ['라멘', '식권'], ['block'], B.meal_ticket_machine, 'food', None),
    ('food-drink-bar', 'wall', 1, '셀프 드링크 바', '네 색 음료 노즐과 컵 꽂이, 물받이.', ['패밀리 레스토랑', '음료'], ['block'], B.drink_dispenser, 'food', None),
    # -- 오락
    ('amuse-pachinko-island', 'floor', 1, '파친코 섬(4칸)', '번쩍이는 기계 넷과 은색 구슬 받침, 앞 푹신한 스툴.', ['파친코', '기계'], ['block'], B.pachinko_island, 'amuse', None),
    ('amuse-bowling-lane', 'floor', 2, '볼링 레인(6×2)', '단풍나무 마루 화살표·도트, 양쪽 검은 거터, 서쪽 파울 라인.', ['볼링', '레인'], ['block'], B.bowling_lane, 'amuse', None),
    ('amuse-bowling-pins', 'floor', 2, '볼링 핀 데크', '삼각형으로 선 열 개 핀, 검은 핀세터 후드.', ['볼링', '핀'], ['block'], B.bowling_pins, 'amuse', None),
    ('amuse-bowling-return', 'floor', 1, '볼 리턴·점수 의자', '반짝이는 볼이 놓인 리턴 아치와 곡선 벤치, 점수 모니터.', ['볼링', '리턴'], ['block'], B.bowling_return, 'amuse', None),
    ('amuse-speaker-stack', 'floor', 1, 'PA 스피커', '큰 콘과 혼 트위터가 달린 검은 스피커.', ['라이브하우스', '음향'], ['block'], B.speaker_stack, 'amuse', None),
    ('amuse-mixing-desk', 'floor', 1, '믹싱 콘솔', '페이더 줄과 노브 띠, 빛나는 미터 브리지.', ['라이브하우스', '음향'], ['block'], B.mixing_desk, 'amuse', None),
    ('amuse-pool-table', 'floor', 2, '당구대(3×2)', '초록 라사, 삼각 랙 공, 큐볼과 기대 둔 큐.', ['당구', '오락'], ['block'], B.pool_table, 'amuse', None),
    # -- 주거
    ('home-futon', 'flat', 1, '개어 편 이불(2×2)', '파란 시키부톤, 접힌 흰 이불, 메밀 베개.', ['집', '다다미', '이불'], ['walk'], B.futon_set, 'home', None),
    ('home-tatami-h', 'flat', 1, '다다미 두 장(가로 4×2)', '골풀 무늬에 초록 천 테두리 다다미 두 장.', ['집', '다다미'], ['walk'], B.tatami_h, 'home', None),
    ('home-tatami-v', 'flat', 1, '다다미 두 장(세로 2×4)', '앞뒤로 이은 다다미 두 장.', ['집', '다다미'], ['walk'], B.tatami_v, 'home', None),
    ('home-chabudai', 'floor', 1, '차부다이(둥근 낮은 상)', '칠기 상판에 찻주전자·잔·센베 쟁반.', ['집', '다다미', '식탁'], ['block'], B.chabudai, 'home', None),
    # -- 공공
    ('pub-service-window', 'floor', 1, '시청 민원 창구(4칸)', '유리 칸막이와 번호 창구판, 직원마다 호출 표시등.', ['시청', '구청', '창구'], ['block'], B.service_window, 'public', None),
    ('pub-ticket-dispenser', 'floor', 1, '번호표 발급기(관공서)', '찢는 번호표, 큰 버튼, 빨간 호출 표시.', ['시청', '번호표'], ['read'], B.ticket_dispenser, 'public', None),
    ('pub-atm', 'wall', 1, 'ATM', '카드 투입구·키패드·화면·지폐 구멍이 있는 파랑·흰 기기.', ['은행', 'ATM'], ['read'], B.atm_unit, 'public', None),
    ('pub-fire-truck', 'floor', 3, '소방차(4×3)', '남쪽을 보고 선 빨간 소방차, 지붕 사다리와 호스 릴.', ['소방서', '차량'], ['block'], B.fire_truck, 'public', None),
    ('pub-fire-locker', 'wall', 1, '방화복 사물함', '주황 방화복·헬멧·장화가 걸린 회색 사물함.', ['소방서', '사물함'], ['search'], B.fire_locker, 'public', None),
    ('pub-vault-door', 'wall', 1, '금고문', '바퀴 손잡이와 볼트, 타임록 다이얼이 달린 둥근 강철문.', ['은행', '금고'], ['block'], B.vault_door, 'public', None),
    ('pub-mail-sort', 'floor', 1, '우편 분류대(3칸)', '편지 더미·소포 저울·칸 선반·빨간 우편 자루.', ['우체국', '분류'], ['block'], B.mail_sort_table, 'public', None),
    # -- 교통
    ('tr-checkin-counter', 'floor', 2, '공항 체크인 카운터(4칸)', '모니터와 수하물 벨트, 항공사 색 띠와 태그 프린터.', ['공항', '체크인'], ['block'], C.checkin_counter, 'transport', None),
    ('tr-baggage-belt', 'floor', 2, '수하물 컨베이어(4×2)', '고무 벨트 위를 도는 여행 가방들.', ['공항', '수하물'], ['block'], C.baggage_belt, 'transport', None),
    ('tr-xray-lane', 'floor', 1, '보안 검색 X선 레인(3칸)', '고무 막 터널, 롤러 컨베이어, 회색 바구니와 조작 모니터.', ['공항', '검색'], ['block'], C.xray_lane, 'transport', None),
    ('tr-flight-board', 'hang', 0, '출발 안내 전광판(3칸)', '검은 판 위 호박색 편명 줄과 초록 정시 표시.', ['공항', '안내'], ['read'], C.flight_board, 'transport', None),
    ('tr-fuel-pump', 'floor', 2, '주유기 섬(2×2)', '빨강·흰 주유기 둘과 노즐 걸이, 노란 볼라드.', ['주유소', '주유기'], ['block'], C.fuel_pump, 'transport', None),
    ('tr-bus-bay', 'floor', 2, '버스 승강장 쉼터(2×2)', '유리 지붕 아래 벤치, 노선 표지와 노란 범퍼 띠.', ['버스터미널', '승강장'], ['block'], C.bus_bay_sign, 'transport', None),
    # -- 숙박
    ('hotel-capsule-pods', 'wall', 1, '캡슐 포드(3칸·2단)', '롤 블라인드가 반쯤 열린 흰 캡슐 두 단과 번호 등.', ['캡슐호텔', '침대'], ['sleep'], C.capsule_pods, 'hotel', None),
    ('hotel-key-rack', 'hang', 0, '열쇠 보드', '번호 놋쇠 갈고리와 태그 달린 열쇠, 종.', ['호텔', '접수'], ['read'], C.key_rack, 'hotel', None),
    # -- 일본 전통
    ('jp-rock-bath', 'floor', 3, '노천 바위탕(4×3)', '바위로 둘린 김 오르는 청록 물, 나무 통과 수건.', ['온천', '바위탕'], ['block'], C.rock_bath, 'jp', None),
    ('jp-buddha-altar', 'floor', 2, '본존불 제단(3×2)', '연꽃대 위 금빛 부처, 붉은 칠 단, 향로와 꽃병·초.', ['사찰', '불상'], ['block'], C.buddha_altar, 'jp', None),
    ('jp-incense-burner', 'floor', 1, '사찰 향로', '청동 솥에 붉게 타는 향과 연기.', ['사찰', '향'], ['block'], C.incense_burner, 'jp', None),
    ('jp-tea-hearth', 'flat', 1, '다실 화로(2×2)', '다다미에 판 화로, 철 주전자와 찻사발·차선.', ['다도실', '화로'], ['walk'], C.tea_hearth, 'jp', None),
    ('jp-shoji-screen', 'wall', 1, '쇼지 문(3칸)', '나무 격자에 흰 종이를 바른 쇼지, 빛이 비친다.', ['다다미 주택', '쇼지'], ['block'], C.shoji_screen, 'jp', None),
    ('jp-tokonoma', 'wall', 1, '도코노마', '이케바나 꽃병, 붓글씨 족자와 향 접시.', ['다도실', '도코노마'], ['block'], C.tokonoma, 'jp', None),
    ('jp-torii', 'floor', 2, '도리이(3×2)', '붉은 기둥 둘과 검은 가사기 보, 돌 밑동.', ['신사', '도리이'], ['block'], C.torii_gate, 'jp', None),
    # -- 기타 (미용·세탁·공장·미술·부동산)
    ('svc-washer-row', 'wall', 1, '코인세탁 세탁기 줄(3칸)', '파랑 패널 드럼 세탁기 셋과 위 세제 자판 선반.', ['세탁소', '세탁기'], ['block'], C.washer_row, 'service', None),
    ('svc-dryer-stack', 'wall', 1, '2단 건조기', '둥근 창 건조기 두 단, 보풀망과 열 다이얼.', ['세탁소', '건조기'], ['block'], C.dryer_stack, 'service', None),
    ('ind-conveyor', 'floor', 1, '공장 컨베이어(4칸)', '롤러 벨트 위 골판지 상자, 노란 가드 레일과 모터.', ['공장', '컨베이어'], ['block'], C.conveyor_line, 'industry', None),
    ('ind-lathe', 'floor', 1, 'CNC 선반', '스핀들 창과 초록 화면 주황 패널, 냉각수통.', ['공장', '기계'], ['block'], C.lathe_machine, 'industry', None),
    ('ind-forklift', 'floor', 2, '지게차(2×2)', '노란 카운터밸런스 지게차, 포크 위 나무 팔레트.', ['창고', '지게차'], ['block'], C.pallet_jack_forklift, 'industry', None),
    ('svc-barber-chair', 'floor', 1, '이발소 의자', '붉은 가죽 크롬 의자, 유압 기둥과 발판.', ['미용실', '이발소', '의자'], ['sit'], C.barber_chair, 'service', None),
    ('svc-salon-basin', 'floor', 1, '샴푸대', '리클라이닝 의자와 도기 세면대, 수전.', ['미용실', '샴푸'], ['block'], C.salon_basin, 'service', None),
    ('svc-salon-mirror', 'wall', 1, '미용실 거울대', '테두리 거울과 가위·빗·드라이어 선반.', ['미용실', '거울'], ['block'], C.salon_mirror, 'service', None),
    ('svc-listing-board', 'hang', 0, '부동산 매물 게시판(3칸)', '평면도·사진·주황 가격표를 붙인 유리 보드.', ['부동산', '매물'], ['read'], C.listing_board, 'service', None),
    ('svc-arcade-shopfront', 'wall', 1, '지하상가 점포 전면(3칸)', '줄무늬 어닝과 마네킹 쇼윈도, 간판.', ['지하상가', '쇼윈도'], ['block'], C.shop_arcade_front, 'service', None),
    ('art-plinth', 'floor', 1, '유리 큐브 좌대', '조명 유리 케이스 속 작은 조각.', ['미술관', '박물관', '좌대'], ['block'], C.gallery_plinth, 'art', None),
    ('art-installation', 'floor', 2, '설치 미술(2×2)', '색 아크릴 판 고리와 떠 있는 구체, 흰 원반 바닥.', ['미술관', '설치'], ['block'], C.installation_art, 'art', None),
]

if __name__ == '__main__':
    bake(PROPS, [], 'train-cab-front-w', 'r11')
