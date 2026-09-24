# 목조학교·공원 정적 조립 확장

확인일: 2026-09-24. 세 원본의 검토된 부분만 지원한다. 시트 전체나 자동 연결·문 애니메이션 지원을 뜻하지 않는다.

`static-expansion.json`은 출처·SHA·원본 좌표·받침·배치 계획의 정본이다. 생성기 `scripts/content/prepare-pixel-art-world-static-expansion.mjs`가 원본 그림 없이 완성 배열을 `src/assets/pixelArtWorldStaticExpansionCatalog.json`으로 만든다. 카탈로그는 기존 `prepareExternalTileset` 경로에 연결되며, 사용자가 정확한 PNG를 가져올 때 원본과 조립 그림 및 AI MD를 생성한다. Git/public에는 소재 그림을 넣지 않는다. 원본·가공 소재의 재배포 제한은 제작자 이용 조건을 따른다.

모든 좌표는 0기준 칸, ID=`y*8+x`; 픽셀 좌표는 32배다. 사각형 전체를 같은 순서로 배치한다. 바닥은 하위, 투명 부품은 상위, 받침·통행은 별도 필드다. 검토 밖 타일은 통행 차단으로 시작한다. 장면 MD에는 전체 lowerTiles/upperTiles, 접근칸, 출입구 메타데이터가 포함된다. 문 그림과 doors는 실행 이벤트가 아니다.

목조 내부 배치의 재사용 근거는 제작자의 내부 레이아웃 동일 설명과 실제 두 원본의 시각 검토다. 목조 외관은 이 범위에 없고 현대 외관 좌표를 적용하지 않는다. WI01은 반투명 그림자, WI02는 팔레트 tRNS 투명을 그대로 디코딩한다. 특수실의 실험대·의자는 갈색이며 현대판 색 이름을 쓰지 않는다. 원본에 포함되지 않은 XP RTP 벽은 사용하지 않는다.

공원은 기존 도시 조립과 같은 원본이지만 여기의 모래밭은 원본 3×3 고정 사각형이다. 도시의 가운데 칸을 반복한 4×3 조립과 구분한다. 잔디0·흙2를 반복한 예제이며 매끈한 지면 경계, 지붕, 등나무 받침은 별도 자동타일 작업이다.

## 생성 및 개인 실물 검토

```sh
node scripts/content/prepare-pixel-art-world-static-expansion.mjs
node scripts/content/render-pixel-art-world-static-expansion.mjs /absolute/user-png-directory
```

두 번째 명령은 사용자 원본 3개가 같은 폴더에 있을 때만 실행한다. SHA와 디코딩 크기, 모든 하위 타일의 불투명성을 확인하고 gitignored `output/paw-static-expansion/rendered/`에 5개 장면, 정상/오류 비교, 전체 배열과 부품 시트를 만든다. 이 출력은 공유·공개 배포하지 않는다. 실제 가져오기는 추가로 RGBA 밑동 접지 및 참고문서 계약을 확인한다.

이번 확인은 생성기, 실제 원본 렌더, 브라우저의 prepareExternalTileset와 카탈로그 표시까지다. 저장 프로젝트 변경·실행 이벤트·모델의 배치 성공률·모든 미검토 타일은 확인 범위가 아니다. 공용 DB 등록과 정본 배치는 별도 담당 작업이다.

## paw-wood-school-interior

원본: `ST-Schl-WI01.png` · 256×1600px · 32px · 8열×50행 · 400칸.

SHA-256: `3375238abee35db986b562fdd06f0f75dba6d61949218212d9d8e3a0bf1fb37d`

[제작자 페이지](https://yms.main.jp/dotartworld/page2/tile-schoolw01.html) · [이용 조건](https://yms.main.jp/dotartworld/page1/rule.html)

목조학교 전용 32px·8열 원본. 0기준 tile=y*8+x. 제작자는 현대 학교 내부와 같은 배치를 명시하지만 원본 SHA는 별도이며 외관 좌표는 재사용하지 않는다. RGBA alpha76 그림자를 보존한다. 이 팩의 고정 부품과 전체 장면 배열만 검토했다. 계단/음악실/미술실 및 사전 밖 타일은 미검토. 공식 목조 복도 예시의 XP RTP 벽은 포함하지 않는다. 목조 문 스프라이트 SC-Door-SchlW01/02와 어두운 창 변형은 별도 원본이다. 이 고정 문 그림은 개폐 애니메이션/전이 이벤트가 아니다. 사용자 파일에서 AI 원본·정상/오류·장면 그림을 생성하며 Git/public 배포 번들에는 원본 픽셀을 넣지 않는다. 부품별 정상/오류 그림은 조각·배열 비교용이다. 벽 부착물과 상판 소품의 실제 설치 받침은 별도 완성 장면의 lowerTiles와 supportCells/supportTileIds를 따른다.

| 부품 ID | 이름 | 원본 사각형 x,y,w,h | 설치 |
|---|---|---|---|
| `wood-school-blackboard` | 목조 · 정면 3칸 칠판 | 0,25,3,2 | wall-mounted |
| `wood-school-grid-board` | 목조 · 정면 격자 칠판 | 3,25,2,2 | wall-mounted |
| `wood-school-notice` | 목조 · 학급 게시판 | 3,28,1,1 | wall-mounted |
| `wood-school-window` | 목조 · 교실 3칸 창문과 창 아래 벽 | 0,8,3,3 | wall-mounted |
| `wood-school-student-desk` | 목조 · 학생용 책상 | 0,31,1,2 | standing |
| `wood-school-chair-back` | 목조 · 학생 의자 · 등받이 뒷면 | 5,31,1,1 | standing |
| `wood-school-chair-front` | 목조 · 학생 의자 · 정면 | 4,31,1,1 | standing |
| `wood-school-lectern` | 목조 · 교사용 교탁 | 4,27,1,2 | standing |
| `wood-school-shoe-locker` | 목조 · 신발장 3칸 | 2,18,3,2 | standing |
| `wood-school-cleaning-locker` | 목조 · 청소도구함 | 5,21,1,2 | standing |
| `wood-school-clock` | 목조 · 벽시계 | 7,17,1,1 | wall-mounted |
| `wood-school-plant` | 목조 · 화분 | 7,34,1,2 | standing |
| `wood-school-classroom-door` | 목조 · 학교 실내문 · 정면 고정문 | 6,8,1,3 | wall-mounted |

장면: `wood-school-classroom-north` (14×13), `wood-school-hallway` (19×9).

## paw-wood-school-special

원본: `ST-Schl-WI02.png` · 256×1600px · 32px · 8열×50행 · 400칸.

SHA-256: `488bc886b47f74d32df66383c049a30c8d38151d3fefa12571010ae0c8c22418`

[제작자 페이지](https://yms.main.jp/dotartworld/page2/tile-schoolw01.html) · [이용 조건](https://yms.main.jp/dotartworld/page1/rule.html)

목조학교 전용 32px·8열 원본. 0기준 tile=y*8+x. 제작자는 현대 학교 내부와 같은 배치를 명시하지만 원본 SHA는 별도이며 외관 좌표는 재사용하지 않는다. 팔레트 tRNS index0 투명을 보존하고 청록색을 바닥으로 칠하지 않는다. 이 팩의 고정 부품과 전체 장면 배열만 검토했다. 계단/음악실/미술실 및 사전 밖 타일은 미검토. 공식 목조 복도 예시의 XP RTP 벽은 포함하지 않는다. 목조 문 스프라이트 SC-Door-SchlW01/02와 어두운 창 변형은 별도 원본이다. 이 고정 문 그림은 개폐 애니메이션/전이 이벤트가 아니다. 사용자 파일에서 AI 원본·정상/오류·장면 그림을 생성하며 Git/public 배포 번들에는 원본 픽셀을 넣지 않는다. 부품별 정상/오류 그림은 조각·배열 비교용이다. 벽 부착물과 상판 소품의 실제 설치 받침은 별도 완성 장면의 lowerTiles와 supportCells/supportTileIds를 따른다.

| 부품 ID | 이름 | 원본 사각형 x,y,w,h | 설치 |
|---|---|---|---|
| `wood-special-window` | 목조 · 특별교실 3칸 창과 창 아래 벽 | 0,5,3,3 | wall-mounted |
| `wood-special-medical-cabinet` | 목조 · 의약품 수납장과 위 화분 | 6,8,2,3 | standing |
| `wood-special-scale` | 목조 · 보건실 체중계 | 3,9,1,2 | standing |
| `wood-special-bed` | 목조 · 가로 진찰 침대 | 5,14,2,2 | standing |
| `wood-special-screen` | 목조 · 진찰실 가림막 | 3,16,2,2 | standing |
| `wood-special-eye-chart` | 목조 · 시력표 | 4,27,1,2 | wall-mounted |
| `wood-special-worktable` | 목조 · 갈색 독립 실험대 | 0,42,3,2 | standing |
| `wood-special-stool` | 목조 · 갈색 실험용 의자 | 5,33,1,1 | standing |
| `wood-special-skeleton` | 목조 · 전신 골격 표본 | 1,14,1,3 | standing |
| `wood-special-bookcase` | 목조 · 과학 자료 책장 | 2,18,3,2 | standing |
| `wood-special-microscope` | 목조 · 현미경 | 2,44,1,1 | countertop |
| `wood-special-specimen` | 목조 · 원통 표본병 | 0,44,1,1 | countertop |
| `wood-special-test-tubes` | 목조 · 시험관대 | 0,46,1,1 | countertop |
| `wood-special-plant` | 목조 · 실내 화분 | 7,34,1,2 | standing |
| `wood-special-counter-front` | 목조 · 붙박이 실험대 4칸 전면 | 4,43,4,1 | standing |

장면: `wood-school-nurse-compact` (11×11), `wood-school-lab-compact` (13×11).

## paw-park

원본: `ST-Park-E01.png` · 256×1600px · 32px · 8열×50행 · 400칸.

SHA-256: `4becd0ccc997e22003dc8a0f6fb8a6cc12379d14c004d9f744d9b4d0b07ad62e`

[제작자 페이지](https://yms.main.jp/dotartworld/page2/tile-park01.html) · [이용 조건](https://yms.main.jp/dotartworld/page1/rule.html)

32px·8열 공원 원본. 기존 city-kits와 같은 원본에서 그네·미끄럼틀·벤치·등·나무 화단을 확인했다. 작은 모래놀이터는 여기서는 원본 3×3 고정 조립이며 city-kits의 가운데 반복 4×3 변형과 다르다. 잔디0/흙2는 하위 반복 지면이며 자동 경계를 만들지 않는다. 고정 부품은 상위 전체 사각 점유를 막는다. 나무 수관 아래 통과, 그네/미끄럼틀 애니메이션, 정자·등나무 시렁·공중화장실은 이 사전 범위 밖이다. 별도 오토타일이 필요한 시렁 받침/화단/화장실 지붕을 이 시트에 포함했다고 간주하지 않는다. 정자 지붕의 가변 폭은 지원하지 않는다. alpha76 그림자를 보존한다. 원본 소재 재배포 금지. 부품별 정상/오류 그림은 조각·배열 비교용이다. 벽 부착물과 상판 소품의 실제 설치 받침은 별도 완성 장면의 lowerTiles와 supportCells/supportTileIds를 따른다.

| 부품 ID | 이름 | 원본 사각형 x,y,w,h | 설치 |
|---|---|---|---|
| `park-swings` | 그네 | 0,43,3,3 | standing |
| `park-slide` | 미끄럼틀 | 3,43,5,3 | standing |
| `park-bench-front` | 벤치 · 정면 | 3,39,2,2 | standing |
| `park-bench-back` | 벤치 · 뒷면 | 3,41,2,2 | standing |
| `park-lamp` | 가로등 | 7,39,1,4 | standing |
| `park-sandpit-compact` | 작은 모래놀이터 · 원본 3칸 | 0,39,3,3 | standing |
| `park-tree-planter` | 원형 화단과 나무 | 4,21,4,6 | standing |

장면: `park-play-and-rest` (24×20).
