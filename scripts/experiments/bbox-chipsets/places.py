"""bbox-chipsets places: chipset, Korean user request (as the editor user would type it), catalog selection, judge anchors.
Anchors = that chipset's own existing example maps (rendered by render_refs.mts into <RUNS>/refs/<place>-<n>.png)."""
PLACES = {
    "jp-house": {"tileset": "jp_city", "request": "일본 단독주택 1층 실내를 만들어 줘. 현관, 거실 겸 부엌, 다다미방, 욕실이 있는 집이야.",
                 "rooms": "genkan,hall,washitsu,ldk,kitchen,bath,toilet,dressing", "query": "집 주택 다다미 거실 부엌 식탁 house home", "max": 70,
                 "kind": "실내 방 하나", "anchors": ["jpx:house-1f", "jpx:hiraya", "jpx:mokuchin"]},
    "konbini": {"tileset": "modern_city", "request": "도시 길가의 편의점 내부를 만들어 줘. 계산대와 진열대, 음료 냉장고가 있는 곳이야.",
                "rooms": "konbini,backroom", "query": "편의점 진열 냉장 계산대 konbini store shelf", "max": 60,
                "kind": "실내 방 하나", "anchors": ["mcx:konbini", "mcx:cafe", "mcx:bank"]},
    "wz-class": {"tileset": "wizarding_world", "request": "마법 학교의 마법약 교실을 만들어 줘. 학생들이 솥 앞에서 실습하고, 교수가 앞에서 가르치는 곳이야.",
                 "rooms": "", "query": "교실 마법약 책상 칠판 솥 교탁 책 의자 classroom desk", "max": 60,
                 "kind": "실내 방 하나", "anchors": ["wzr:wz-space-potions", "wzr:wz-space-library", "wzr:wz-space-shared-common"]},
    "joseon-yard": {"tileset": "joseon_baram", "request": "조선 양반가의 안마당을 만들어 줘. 대문으로 들어와 사랑채와 안채가 마당을 둘러싼 집이야.",
                    "mode": "outdoor", "rooms": "", "query": "기와 대문 담 마당 장독 우물 나무 정자 사당 연못 꽃 화분 돌 판석 풀 흙길 행랑 항아리 평상 굴뚝", "max": 70, "kind": "야외 장소 하나", "anchors": ["crop:jv20-compound", "crop:jv20-compound-wide"]},
}
