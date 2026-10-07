# 일본 도시 — 일본 가게·공공 실내 장소 19곳

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **10041칸**, 16px 칸, 시트 768×3360px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

**가져오기**: `import_region_reference({id:"<장소 id>"})` → 새 맵. **거리 건물 문과 바로 잇기**: `link_jp_city_interior({door:{x,y}, width, place:"<장소 id>"})` 한 번 —
door = 거리 건물 문 칸(`build_jp_city_building` 결과 `data.doors` 의 첫 칸, 같은 줄 문 칸 수 = width). 장소를 새 맵으로 가져와 문 앞 접근칸(문 바로 아래)에 들어가는 발판, 실내 맨 아래 출입구 틈에 나오는 발판(나오면 문 앞 한 줄 아래)을 만든다.
직접 짓거나 고쳐 지으려면 `build_hand_interior_room({tileset:"jp_city", …})` — 각 예제 문서의 「입력」이 그대로 인자다(가구 id 는 `list_hand_interior_parts({tileset:"jp_city", category})`: 분류 store·food·shop·sento·laundry·koban·clinic·veranda·apartment·oldhouse).
출입구는 언제나 **맨 아래 줄 틈**(자동문 cv-autodoor·셔터 sh-shutter·현관 문턱 genkan-door·철문 h2-genkan-door-steel). 손님 동선은 입구 → 진열 → 출구 가까운 계산대, 직원 동선은 카운터 줄 끝 틈 → 주방·뒷방.

| 장소 id | 이름 | 종류 | 예제 문서 | 짜임 |
|---|---|---|---|---|
| `jp-city-konbini-14x13` | 일본 편의점(コンビニ) 실내 | 편의점 | `jp-interior-ex-konbini` | 자동문 입구 → 창가 잡지대 · 가운데 섬 진열대 줄 · 북쪽 벽 음료 냉장고 · 개방형 도시락 냉장 · 입구 옆 계산대(계산기·핫스낵·커피) + 뒤 담배 선반 · 칸막이 너머 뒷방. |
| `jp-city-supermarket-16x14` | 일본 동네 슈퍼 실내 | 동네 슈퍼 | `jp-interior-ex-supermarket` | 입구 옆 계산대 레인·카트·바구니 → 채소 경사 진열대 · 벽 냉장 진열(정육·생선) · 가운데 섬 진열대·냉동고. |
| `jp-city-ramen-8x9` | 일본 라멘집 실내 | 라멘집 | `jp-interior-ex-ramen` | 입구 옆 식권기·물 서버 → L자 카운터 + 스툴 → 카운터 안쪽 주방 줄(육수 솥·면 삶는 칸·조리대·개수대·냉장고). |
| `jp-city-izakaya-12x10` | 일본 이자카야 실내 | 이자카야 | `jp-interior-ex-izakaya` | 카운터 + 스툴 · 다다미 좌석 단(좌탁·신발 벗는 단) · 테이블석 · 술병 선반 · 붉은 초롱 · 노렌 너머 주방. |
| `jp-city-sushi-10x9` | 일본 초밥집 실내 | 초밥집 | `jp-interior-ex-sushi` | 카운터 위 유리 생선 진열 케이스 · 카운터 의자 · 계산대. |
| `jp-city-kissaten-9x9` | 일본 킷사텐(찻집) 실내 | 킷사텐(찻집) | `jp-interior-ex-kissaten` | 짙은 나무 바닥 · 2인 탁자와 의자 · 카운터(케이크 유리장·사이펀·커피 머신·계산대) + 스툴 · 원두 병 선반. |
| `jp-city-bakery-9x14` | 일본 동네 빵집 실내 | 빵집 | `jp-interior-ex-bakery` | 셔터 걷은 입구 → 쟁반·집게 대 → 빵 진열대·벽 빵 선반 → 입구 가까운 계산대 · 칸막이 너머 오븐 있는 뒷방. |
| `jp-city-bookstore-9x14` | 일본 동네 서점 실내 | 서점 | `jp-interior-ex-bookstore` | 벽 책장 · 가운데 평대·양면 책장 · 계산대 · 뒷방. |
| `jp-city-pharmacy-9x14` | 일본 동네 약국 실내 | 약국 | `jp-interior-ex-pharmacy` | 벽 약 선반·가운데 양면 선반 · 상담 카운터·계산대 · 뒷방. |
| `jp-city-florist-9x14` | 일본 동네 꽃집 실내 | 꽃집 | `jp-interior-ex-florist` | 입구까지 나온 꽃 양동이 단 · 유리문 꽃 냉장고 · 포장 작업대 · 화분 · 계산대. |
| `jp-city-yaoya-9x14` | 일본 채소가게(八百屋) 실내 | 채소가게 | `jp-interior-ex-yaoya` | 입구 쪽으로 나온 경사 채소 진열대·과일 상자 · 얼음 위 생선 진열대 · 계산대. |
| `jp-city-barber-9x14` | 일본 동네 이발소 실내 | 이발소 | `jp-interior-ex-barber` | 거울 앞 이발 의자 줄(거울을 본다) · 샴푸대 · 대기 벤치 · 이발소 기둥 · 계산대. |
| `jp-city-sento-14x13` | 일본 공중목욕탕(센토) 실내 | 목욕탕(센토) | `jp-interior-ex-sento` | 현관·신발장 → 반다이(높은 계산대) → 탈의실(바구니 선반·로커·체중계·안마의자·병우유 냉장고) → 칸막이 문 → 욕장(씻는 자리 줄·의자, 북쪽 큰 욕조, 뒤 벽 후지산 그림). |
| `jp-city-laundry-9x8` | 일본 코인세탁(コインランドリー) 실내 | 코인세탁 | `jp-interior-ex-laundry` | 벽 세탁기·건조기 줄 · 가운데 개는 탁자 · 입구 옆 벤치·세제 자판기·동전 교환기. |
| `jp-city-koban-11x8` | 일본 파출소(交番) 실내 | 파출소(交番) | `jp-interior-ex-koban` | 입구 책상·의자 · 동네 지도판 · 철제 캐비닛 · 경찰 자전거 · 옆문 안쪽 사무실. |
| `jp-city-clinic-14x8` | 일본 동네 의원(내과) 실내 | 동네 의원 | `jp-interior-ex-clinic` | 입구 → 접수 카운터 → 대기 소파 → 옆문 안쪽 진찰실(의사 책상·진찰대·커튼·약품장·신장계). |
| `jp-city-mansion-2ldk-15x20` | 일본 맨션 2LDK 실내(베란다) | 맨션 2LDK | `jp-interior-ex-mansion-2ldk` | 공용 복도 → 철문 현관·신발장 → 복도(화장실·욕실) → LDK(대면 키친·식탁·소파·TV) + 방 2(침실·아이방) → 유리 미닫이 → 남쪽 베란다(빨래 장대·실외기·난간 한 줄). |
| `jp-city-mokuchin-8x8` | 일본 목조 아파트(木造アパート) 6조 한 칸 | 목조 아파트 한 칸 | `jp-interior-ex-mokuchin` | 작은 현관 → 옛 싱크·작은 냉장고 → 다다미 6조(고타쓰·행거·골판지) · 창가 이불 말림. |
| `jp-city-hiraya-15x14` | 일본 단층 옛집(平屋) 실내 | 단층 옛집(平屋) | `jp-interior-ex-hiraya` | 현관 → 다다미방 2~3칸(장지문) + 이로리 방 + 부엌 → 남쪽 엔가와 툇마루·디딤돌. |

## 없는 것
점원·손님 NPC(Actor1 캐릭터를 이벤트로 놓는다), 가게 이벤트(계산·주문). 간판·메뉴판·가격표에 글자는 없다(색 띠·점).
