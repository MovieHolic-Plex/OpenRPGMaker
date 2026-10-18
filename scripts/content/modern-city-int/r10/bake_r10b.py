# R10b 종합병원(50×50, 3층)·엘리베이터 소품 굽기(append-only) - 2026-10-18 19:18 사용자 「침대가 세로형만 있네. 가로형은 왜 없는거지」
# 「수술실도 엉망」「대기실이 더 넓어야함」「엘리베이터 내부 이런 것도 좀 구현하면 좋을거같기도」.
# 그림은 hosp.py, 칩셋 붙이기·등록은 bake_r10.bake(같은 3/4 윗면+앞면+1px 테 규칙, 같은 칸 규칙).
# 실행: python3 scripts/content/modern-city-int/r10/bake_r10b.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hosp as P
from bake_r10 import bake

PROPS = [
    # ── 병상·병동 (8)
    ('mci-hosp-bed-e', 'floor', 1, '병원 침대(가로·머리 서쪽)', '머리판을 서쪽 벽에 댄 가로 병상 - 베개, 민트 담요, 앞 난간과 바퀴.', ['병원', '병실', '침대'], ['sleep', 'heal'], P.hosp_bed_e, 'hospital', 'E'),
    ('mci-hosp-bed-w', 'floor', 1, '병원 침대(가로·머리 동쪽)', '머리판을 동쪽 벽에 댄 가로 병상 - 베개, 민트 담요, 앞 난간과 바퀴.', ['병원', '병실', '침대'], ['sleep', 'heal'], P.hosp_bed_w, 'hospital', 'W'),
    ('hosp-stretcher', 'floor', 1, '응급 이송 침대(가로)', '흰 시트와 갠 담요를 올린 크롬 난간 들것, 긴 다리와 바퀴.', ['병원', '응급'], ['sleep'], P.hosp_stretcher, 'hospital', None),
    ('hosp-icu-pod', 'floor', 2, '중환자실 병상(2×2)', '등받이를 세운 병상, 인공호흡기 탑, 천장 붐에 매단 생체 모니터.', ['병원', '중환자실', '침대'], ['sleep', 'heal'], P.icu_pod, 'hospital', None),
    ('hosp-iv-pump', 'floor', 1, '수액 펌프 걸대', '식염수 팩을 건 걸대에 초록 표시 수액 펌프, 다섯 바퀴 받침.', ['병원', '병실', '수액'], ['block'], P.iv_pump, 'hospital', None),
    ('hosp-curtain-track', 'floor', 1, '천장 레일 커튼(3칸)', '크롬 천장 레일에 매달린 민트 주름 커튼 - 다인실 병상 사이 칸막이.', ['병원', '병실', '커튼'], ['block'], P.curtain_track, 'hospital', None),
    ('hosp-crash-cart', 'floor', 1, '응급 카트', '서랍 붙은 빨간 카트, 위에 제세동기와 패들.', ['병원', '응급', '중환자실'], ['search'], P.crash_cart, 'hospital', None),
    ('hosp-triage-desk', 'floor', 1, '문진·혈압 측정대', '흰 카운터 위 자동 혈압계·체온계·손 소독제.', ['병원', '로비', '문진'], ['counter'], P.triage_desk, 'hospital', None),
    # ── 수술실 (6)
    ('hosp-op-table', 'floor', 1, '수술대(가로·3칸)', '청록 수술포를 덮은 환자, 서쪽 머리와 수술 모자, 팔 받침, 검은 기둥 받침.', ['병원', '수술실'], ['block'], P.op_table, 'hospital', None),
    ('hosp-surgical-lamp', 'floor', 1, '천장 수술 무영등(2칸)', '천장 마운트에서 두 갈래로 뻗은 둥근 무영등 - 수술대 위에 그려지고 아래로 지나간다.', ['병원', '수술실', '조명'], ['walk'], P.surgical_lamp, 'hospital', None),
    ('hosp-anesthesia', 'floor', 1, '마취기', '모니터를 올린 마취기 - 유량계 관, 검은 벨로스, 아래 파란 산소·초록 아산화질소 통.', ['병원', '수술실'], ['block'], P.anesthesia_machine, 'hospital', None),
    ('hosp-vitals-bank', 'wall', 1, '생체 모니터 뱅크', '벽에 건 심전도·산소포화도 모니터 둘과 의료 가스 콘센트 줄.', ['병원', '수술실', '중환자실'], ['read'], P.vitals_bank, 'hospital', None),
    ('hosp-mayo-stand', 'floor', 1, '멸균 기구대(메이요)', '파란 멸균포 쟁반 위 메스·겸자·거즈, 외다리 받침.', ['병원', '수술실'], ['search'], P.mayo_stand, 'hospital', None),
    ('hosp-scrub-sink', 'wall', 1, '수술 손 세척대(2칸)', '긴 스테인리스 세척조, 무릎으로 여는 거위목 수전 둘, 솔 함과 타이머.', ['병원', '수술실'], ['block'], P.scrub_sink, 'hospital', None),
    # ── 영상의학 (4)
    ('hosp-ct-scanner', 'floor', 2, 'CT 촬영기(3×2)', '파란 링 불빛 흰 도넛 갠트리와 동쪽으로 빠지는 환자 테이블.', ['병원', '영상의학', 'CT'], ['block'], P.ct_scanner, 'hospital', None),
    ('hosp-xray-table', 'floor', 1, 'X선 촬영대(3칸)', '천장 기둥에 단 X선 관구 아래 촬영 테이블과 버키 트레이.', ['병원', '영상의학', 'X선'], ['block'], P.xray_table, 'hospital', None),
    ('hosp-xray-console', 'wall', 1, 'X선 조작실 콘솔', '납유리 창 아래 노출 조작판·다이얼·손 스위치.', ['병원', '영상의학'], ['read'], P.xray_console, 'hospital', None),
    ('hosp-film-viewer', 'hang', 0, 'X선 판독 라이트박스', '흉부 필름 두 장을 건 벽 라이트박스.', ['병원', '영상의학', '진료실'], ['read'], P.film_viewer, 'hospital', None),
    # ── 로비·접수 (6)
    ('hosp-ticket-dispenser', 'floor', 1, '번호표 발급기', '빨간 머리 LED 번호와 표 나오는 홈, 흰 받침.', ['병원', '로비', '접수'], ['read'], P.ticket_dispenser, 'hospital', None),
    ('hosp-number-display', 'hang', 0, '호출 번호 전광판', '검은 LED 판에 빨간 번호와 초록 창구 화살표.', ['병원', '로비', '접수'], ['read'], P.number_display, 'hospital', None),
    ('hosp-wait-row-s', 'floor', 1, '대기 의자 3연석(남향)', '가로 빔에 이어 붙인 파란 플라스틱 의자 셋 - 남쪽을 본다.', ['병원', '로비', '대기실', '의자'], ['sit'], P.wait_row_s, 'hospital', 'S'),
    ('hosp-wait-row-n', 'floor', 1, '대기 의자 3연석(북향)', '파란 의자 셋을 등받이 쪽에서 본 모습 - 북쪽 접수대를 본다.', ['병원', '로비', '대기실', '의자'], ['sit'], P.wait_row_n, 'hospital', 'N'),
    ('hosp-wheelchair-bay', 'floor', 1, '휠체어 보관소(2칸)', '접어 둔 휠체어 둘과 위 파란 휠체어 표지.', ['병원', '로비', '휠체어'], ['block'], P.wheelchair_bay, 'hospital', None),
    ('hosp-floor-directory', 'hang', 0, '층별 안내판', '남색 판에 3층 수술·2층 병동·1층 접수·약국을 색 띠로 적었다.', ['병원', '로비', '엘리베이터', '안내'], ['read'], P.floor_directory, 'lobby', None),
    # ── 엘리베이터 카·홀 (6)
    ('elev-car-door', 'door', 0, '엘리베이터 카 문(안쪽)', '가운데로 갈라지는 헤어라인 스테인리스 문 두 짝과 문턱 홈.', ['엘리베이터', '문'], ['travel'], P.elev_car_door, 'lobby', None),
    ('elev-mirror-wall', 'hang', 0, '엘리베이터 거울 벽(3칸)', '카 안쪽 벽 전면 거울과 아래 둥근 스테인리스 핸드레일.', ['엘리베이터'], None, P.elev_mirror_wall, 'lobby', None),
    ('elev-wood-panel', 'hang', 0, '엘리베이터 목재 벽판·핸드레일', '호두나무 무늬 벽판에 스테인리스 핸드레일과 정원 표시판.', ['엘리베이터'], None, P.elev_wood_panel, 'lobby', None),
    ('elev-button-panel', 'hang', 0, '엘리베이터 조작반', '층 버튼 두 줄(3층 불 켜짐), 열림·닫힘·비상벨·인터폰.', ['엘리베이터'], ['switch'], P.elev_button_panel, 'lobby', None),
    ('elev-floor-led', 'hang', 0, '층 표시 LED', '검은 판에 빨간 3과 초록 위 화살표.', ['엘리베이터'], ['read'], P.elev_floor_led, 'lobby', None),
    ('elev-hall-lantern', 'hang', 0, '승강장 호출 버튼·홀 랜턴', '위·아래 홀 랜턴과 호출 단추 판.', ['엘리베이터', '로비'], ['switch'], P.elev_hall_lantern, 'lobby', None),
]

if __name__ == '__main__':
    bake(PROPS, [], 'mci-hosp-bed-e', 'r10b')
