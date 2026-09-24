# 공용 화장실과 개인방 native32 보완

2026-09-24. 기존 학교·공원 묶음과 분리한 원본 3개, 검토된 고정 부품 47개, 장면 3개다. 카탈로그 06·09의 이 원본을 지원하며 시트 전체의 모든 소품·방향·이벤트를 검토했다는 뜻은 아니다.

원본은 제작자에게서 사용자가 받은 개인 파일만 쓴다. `native-complements.json`이 출처·SHA·사각형·받침·방/출입구·배치 계획의 정본이고 생성된 `src/assets/pixelArtWorldNativeComplementsCatalog.json`은 메타데이터만 배포한다. 기존 `prepareExternalTileset`가 정확한 사용자 PNG를 확인한 뒤 원본, 47개 정상/오류 그림, 장면 그림과 전체 배열 MD를 만든다. Git/public에 원본·가공 픽셀을 싣지 않는다.

[개인방 제작자 페이지](https://yms.main.jp/dotartworld/page2/tile-rooms01.html)는 단일 원룸과 가구·주방의 방향 변형을 소개한다. 남녀 구분은 원작의 이름이며 인물의 사용을 제한하지 않는다. 같은 크기라도 실제 책장/책상/냉장고가 달라 두 원본을 각각 검토했다. [화장실 제작자 페이지](https://yms.main.jp/dotartworld/page2/tile-toilet01.html)는 여러 시설·학교 변형을 한 시트에 제공한다. 웹 문구의 256×1600과 달리 현재 확인한 원본은 256×1376이며 SHA와 디코딩 크기가 등록 기준이다. 같은 이름의 샘플게임 구판과 바꿔 쓰지 않는다.

## 좌표·구조·접근 계약

0기준 32px 칸, 8열, ID=`y*8+x`. `sourceRect`는 완전한 고정 부품의 사각형이며 픽셀 좌표는 32배다. `supportCells`는 부품 원점 기준이다. standing 밑동은 통행 바닥, wall-mounted 지정 지점은 벽이 받친다. 부품의 투명 여백도 보수적으로 상위 solid다. 방의 벽면은 원본의 벽 타일이며 목재 바닥을 벽처럼 쓰지 않는다.

장면은 같은 원본만 사용하는 컷어웨이다. 별도 XP 천장·닫힌 문 개폐·전이·취침·앉기·조리·시설 이용 이벤트가 생기지는 않는다. `rooms`는 실제 같은 높이의 구획이고 `doorways`는 연결된 실제 빈 통로를 뜻한다. 원룸은 단일 방, 화장실은 측면 칸막이와 문이 열린 구조 표본이다. 실제 화장실의 잠금·사생활을 제공하는 완성 게임 기능으로 간주하지 않는다.

단일 부품 비교는 조각 표본이며 벽/상판 설치의 완성 장면을 대신하지 않는다. 동·서향 부품의 AI 예제 접근은 각각 오른쪽/왼쪽 테두리, 북·남향은 위/아래다. 원본의 방향 그림을 사용하며 좌우 반전으로 대신하지 않는다.

## 생성과 개인 검토

```sh
node scripts/content/prepare-pixel-art-world-native-complements.mjs
node scripts/content/render-pixel-art-world-native-complements.mjs /absolute/user-png-directory
```

생성기는 범위·상위 겹침·받침·바닥/상위 충돌·접근 BFS·필수 통로·방 구획·실제 출입 틈을 확인한다. 렌더러는 원본 SHA/규격, 모든 하위 타일 불투명성을 확인하고 `output/paw-native-complements/rendered/`에 실제 장면·부품 시트·고의 오류 비교와 전체 배열을 만든다. 이 개인 출력은 소재 공개 배포용이 아니다. 브라우저 준비 함수는 실제 디코딩 RGBA의 밑동을 추가 확인한다.

현재 정본에서 내보낸 기존 paw-home AI 문서와 그림의 접지·통로 계약을 참조했으며 ST-Town-I01의 번호는 이 자료에 복사하지 않았다. 원룸 장면은 독립 예제로 기존 주택 맵을 교체하지 않는다. 공용 등록·정본 실제 배치·저장 재로드는 별도 작업이며 이 메타데이터 변경만으로 완료를 주장하지 않는다.


## paw-personal-room-male

`ST-Room-I01.png` · 256×1120px · 8열×35행 · 280칸.

SHA-256: `455f8b8a61b90c8473f5c08fe88d74646e8028f756bd24ec08b9c6cbc176ef31`

원본 32px·8열·35행. 제작자 원룸 소재의 남성 테마다. 성별은 원작의 시트 구분이며 사용 인물을 제한하지 않는다. 다른 버전의 좌표를 통째로 복사하지 않는다. 팔레트 tRNS 투명을 보존한다. 청록 투명 키를 불투명 바닥으로 바꾸지 않는다. 책장3×3, 책상3×2, 냉장고1×2(원본 y=24)다. 이 고정 사전·장면만 검토했으며 대각선 하단 회색 부품, 미검토 소품, 좌우 방향 주방은 포함하지 않는다. 방은 이 원본의 벽면 타일로 닫힌 컷어웨이이며 천장 자동타일을 합성한 건물이 아니다. 남쪽 출입 틈의 전이와 고정 문 그림의 개폐는 별도 이벤트다. 벽 부착물의 개별 비교 그림은 부품 배열 표본이며 실제 받침은 완성 장면을 따른다. 원본·가공 소재 재배포 금지; Git/public에는 픽셀을 넣지 않는다.

| 부품 ID | 이름 | x,y,w,h | 설치·방향 |
|---|---|---|---|
| `personal-m-window` | 세로 2칸 창문 | 0,7,2,2 | wall-mounted · south |
| `personal-m-clock` | 벽시계 | 0,9,1,1 | wall-mounted · south |
| `personal-m-door` | 갈색 고정문 | 0,29,1,2 | wall-mounted · south |
| `personal-m-bed` | 단일 침대 · 첫 번째 침구 | 6,11,1,3 | standing · south |
| `personal-m-bed-alt` | 단일 침대 · 두 번째 침구 | 7,11,1,3 | standing · south |
| `personal-m-wardrobe` | 높은 옷장 | 0,10,1,3 | standing · south |
| `personal-m-drawers` | 2칸 서랍장 | 1,11,2,2 | standing · south |
| `personal-m-bookcase` | 3칸 책장 | 1,16,3,3 | standing · south |
| `personal-m-desk` | 정면 책상 | 1,19,3,2 | standing · south |
| `personal-m-chair-back` | 회전의자 · 등받이 뒷면 | 7,14,1,1 | standing · north |
| `personal-m-chair-front` | 회전의자 · 정면 | 6,14,1,1 | standing · south |
| `personal-m-chair-left` | 회전의자 · 왼쪽 방향 | 6,15,1,1 | standing · west |
| `personal-m-chair-right` | 회전의자 · 오른쪽 방향 | 7,15,1,1 | standing · east |
| `personal-m-table` | 낮은 정사각 테이블 | 3,10,3,3 | standing · south |
| `personal-m-table-rug` | 러그와 낮은 테이블 | 3,13,3,3 | standing · south |
| `personal-m-kitchen` | 정면 싱크대와 가스레인지 | 6,24,2,2 | standing · south |
| `personal-m-fridge` | 정면 냉장고 | 5,24,1,2 | standing · south |

장면 `personal-m-studio` (12×12): 12×12 컷어웨이 원룸. 북쪽 3행 벽17/25/33, 서쪽24·동쪽26 벽면 한 열, 남쪽33 벽면 한 행으로 둘러싼다. 이것은 원본 벽면을 그대로 쓴 경계이며 목재 바닥을 벽으로 바꾸거나 별도 천장 소재를 포함한 것이 아니다. 남쪽(6,11)의 실제 열린 문턱에서 (6,10)으로 들어오며 x=6,y=5..11과 가로 y=6,x=2..9를 비운다. 1개의 실제 원룸 안에서 북서 취침·북중앙 작업·북동 책장·남동 조리·남서 휴식을 배치한다. 창(4,0)과 시계(9,1)는 벽 부착물. 모든 가구 밑동은 바닥1에 둔다. 책장(8,3)3×3, 책상(4,3)3×2, 냉장고(7,8)1×2를 사용한다. 상위 사각형 전체는 통행 차단이며 의자(5,5)에 앉는 이벤트는 없다. 남쪽 실제 통행 틈을 doorways로 설명하며 별도 고정문 레시피를 여기 겹쳐 통로를 막지 않는다. 방 밖 장소·전이 이벤트·천장 자동 연결은 별도 저작한다.

## paw-personal-room-female

`ST-Room-I02.png` · 256×1120px · 8열×35행 · 280칸.

SHA-256: `b94a5703252be70960bf3bbd6626a9a96d57f7c8c8efc2c2db9d00d13cd206f5`

원본 32px·8열·35행. 제작자 원룸 소재의 여성 테마다. 성별은 원작의 시트 구분이며 사용 인물을 제한하지 않는다. 다른 버전의 좌표를 통째로 복사하지 않는다. RGBA alpha76 그림자를 보존한다. 책장2×3, 책상2×2, 냉장고1×2다. 이 고정 사전·장면만 검토했으며 대각선 하단 회색 부품, 미검토 소품, 좌우 방향 주방은 포함하지 않는다. 방은 이 원본의 벽면 타일로 닫힌 컷어웨이이며 천장 자동타일을 합성한 건물이 아니다. 남쪽 출입 틈의 전이와 고정 문 그림의 개폐는 별도 이벤트다. 벽 부착물의 개별 비교 그림은 부품 배열 표본이며 실제 받침은 완성 장면을 따른다. 원본·가공 소재 재배포 금지; Git/public에는 픽셀을 넣지 않는다.

| 부품 ID | 이름 | x,y,w,h | 설치·방향 |
|---|---|---|---|
| `personal-f-window` | 세로 2칸 창문 | 0,7,2,2 | wall-mounted · south |
| `personal-f-clock` | 벽시계 | 0,9,1,1 | wall-mounted · south |
| `personal-f-door` | 갈색 고정문 | 0,29,1,2 | wall-mounted · south |
| `personal-f-bed` | 단일 침대 · 첫 번째 침구 | 6,11,1,3 | standing · south |
| `personal-f-bed-alt` | 단일 침대 · 두 번째 침구 | 7,11,1,3 | standing · south |
| `personal-f-wardrobe` | 높은 옷장 | 0,10,1,3 | standing · south |
| `personal-f-drawers` | 2칸 서랍장 | 1,11,2,2 | standing · south |
| `personal-f-bookcase` | 2칸 책장 | 0,16,2,3 | standing · south |
| `personal-f-desk` | 정면 책상 | 1,19,2,2 | standing · south |
| `personal-f-chair-back` | 회전의자 · 등받이 뒷면 | 7,14,1,1 | standing · north |
| `personal-f-chair-front` | 회전의자 · 정면 | 6,14,1,1 | standing · south |
| `personal-f-chair-left` | 회전의자 · 왼쪽 방향 | 6,15,1,1 | standing · west |
| `personal-f-chair-right` | 회전의자 · 오른쪽 방향 | 7,15,1,1 | standing · east |
| `personal-f-table` | 낮은 정사각 테이블 | 3,10,3,3 | standing · south |
| `personal-f-table-rug` | 러그와 낮은 테이블 | 3,13,3,3 | standing · south |
| `personal-f-kitchen` | 정면 싱크대와 가스레인지 | 6,24,2,2 | standing · south |
| `personal-f-fridge` | 정면 냉장고 | 5,23,1,2 | standing · south |

장면 `personal-f-studio` (12×12): 12×12 컷어웨이 원룸. 북쪽 3행 벽17/25/33, 서쪽24·동쪽26 벽면 한 열, 남쪽33 벽면 한 행으로 둘러싼다. 이것은 원본 벽면을 그대로 쓴 경계이며 목재 바닥을 벽으로 바꾸거나 별도 천장 소재를 포함한 것이 아니다. 남쪽(6,11)의 실제 열린 문턱에서 (6,10)으로 들어오며 x=6,y=5..11과 가로 y=6,x=2..9를 비운다. 1개의 실제 원룸 안에서 북서 취침·북중앙 작업·북동 책장·남동 조리·남서 휴식을 배치한다. 창(4,0)과 시계(9,1)는 벽 부착물. 모든 가구 밑동은 바닥1에 둔다. 책장(8,3)2×3, 책상(4,3)2×2, 냉장고(7,8)1×2를 사용한다. 상위 사각형 전체는 통행 차단이며 의자(5,5)에 앉는 이벤트는 없다. 남쪽 실제 통행 틈을 doorways로 설명하며 별도 고정문 레시피를 여기 겹쳐 통로를 막지 않는다. 방 밖 장소·전이 이벤트·천장 자동 연결은 별도 저작한다.

## paw-public-restroom

`ST-Toilet-I01.png` · 256×1376px · 8열×43행 · 344칸.

SHA-256: `a5deca7b104a16b86e8a27ea80f890497fba84fc99c04b22f0b744c19a5813be`

실파일256×1376px,32px·8열·43행·344칸. 제작자 페이지의256×1600 표기는 실제 파일과 다르므로 SHA와 디코딩 규격을 우선한다. 예전 sample-map-xp03 안의 같은 파일명은 SHA가 다르고 지원 원본이 아니다. RGBA alpha76 그림자를 보존한다. 4가지 시설/학교/목조 변형 중 이 사전의 흰색 구조와 고정 세면 설비만 검토했다. 목조/세로방향 칸막이 확장·문 스프라이트는 별도다. 칸막이 정면 레시피는 구조 부품이며 사각 점유가 차단된다. 통행 가능한 화장실 예제에서는 열린 남쪽 틈을 유지한다. 개별 정상/오류 그림은 조각 비교이며 거울의 실제 벽 받침은 전체 장면을 따른다. 원본·가공 소재 재배포 금지; Git/public에는 픽셀을 넣지 않는다. 원본(1,8)..(2,10)의 양면 설비/중앙 벽 조합은 단일 바닥형 변기로 단정할 수 없어 이번 사전에서 제외했다.

| 부품 ID | 이름 | x,y,w,h | 설치·방향 |
|---|---|---|---|
| `restroom-toilet-open` | 양변기 · 뚜껑 열림 | 3,8,1,2 | standing · south |
| `restroom-toilet-closed` | 양변기 · 뚜껑 닫힘 | 4,8,1,2 | standing · south |
| `restroom-urinal` | 벽면 소변기 | 0,8,1,3 | wall-mounted · south |
| `restroom-squat-horizontal` | 바닥형 변기 · 가로 | 0,11,2,1 | standing · east |
| `restroom-sinks` | 흰색 세면대 3칸 | 5,22,3,2 | standing · south |
| `restroom-mirror` | 세면대 위 가로 거울 | 5,16,3,1 | wall-mounted · south |
| `restroom-utility-sink` | 깊은 청소용 싱크 | 5,14,1,2 | standing · south |
| `restroom-partition` | 흰색 칸막이 측면 3칸 | 0,12,1,3 | standing · south |
| `restroom-closed-front` | 흰색 칸막이와 닫힌 문 전면 | 0,15,2,2 | standing · south |
| `restroom-bucket` | 빈 청소 양동이 | 4,0,1,1 | standing · south |
| `restroom-wet-bucket` | 물 양동이 | 4,1,1,1 | standing · south |
| `restroom-mop` | 대걸레 | 6,8,1,2 | standing · south |
| `restroom-broom` | 빗자루 | 5,8,1,2 | standing · south |

장면 `restroom-two-stalls` (12×8): 12×8칸 컷어웨이 화장실. 북쪽48/56 두 행 벽과 좌우48·남쪽56 벽면으로 감싸고 남쪽(5,7)..(6,7)은 두 칸 열린 출입 틈이다. 흰색 3칸 측면 칸막이를 (1,2),(4,2),(7,2)에 전체 배치해 변기 칸 두 개와 세면 공간을 나눈다. 변기(2,2)/(5,2)의 밑동은 바닥1이며 각각 남쪽(2,4)/(5,4)에서 접근한다. 3칸 세면대(8,2)는 바닥 위, 거울(8,1)은 북쪽 벽에 붙인다. 세면대 남쪽 y=4와 공동 통로 y=5가 연결된다. 청소도구(1,5)/(2,5)는 서남 모서리로 모아 입구 x=5..6을 비운다. 열린 칸막이 끝을 doorways로 표현하며 닫힌 문 전면 레시피를 겹치지 않는다. 이 장면은 문이 열린/제거된 구조·통행 표본으로 개인실 잠금/개폐/이용 이벤트는 별도다. 남쪽 공동 구역의 빈칸은 입구에서 각 시설로 이동하고 방향을 바꾸는 동선이다. 원본 벽면 경계이며 별도 XP천장·개폐 스프라이트는 포함하지 않는다.
