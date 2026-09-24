# 레트로 동네·목욕탕 외관 — native32 2원본

사용자 원본 PNG를 Git/public에 배포하지 않는다. exact-SHA 원본에서 raw41객체와
추가 whole합성4개, 실제 compact 장소2개를 로컬 생성한다. 원본400칸 전체를 학습한 것은 아니다.

| 팩 | 원본 | SHA256 |
|---|---|---|
| paw-retrotown-sento | ST-Sento-E01.png | bfdd46ba076a119f84cb7c98940a0fc6488d133b07c21f0bf0676915fa421ee0 |
| paw-retrotown-rtown | ST-RTown-E01.png | 4d94f4a63f6ead17ea390203601245df12da8278feb10a6d9dac1063d952e26c |

둘 다256×1600/native32/8×50/400칸. B/P/Y 색변형처럼 취급하지 않는다.
공통 정원·목조 부품도 각 파일에서 자르고, Sento의 입구/간판/굴뚝과 RTown의 상점문/우편함을 분리한다.
retrotown-exteriors-comparison.json은 whole-object별 원본 RGBA hash와 Sento 대비 일치를 기록한다.
PNG파일 SHA와 RGBA hash는 다르며, alpha0의 숨은 RGB도 비교에 포함한다.

## 실제로 읽은 근거

현재 정본 project `6ae74f7a-23a2-449b-8171-5afb5dff532b`, revision54,
SHA `7eb798d6ef461e9b6997bb30df439bb4fae65bd4c457e113e2fcb7743d80cb6f`에서
주택가 타일 참고문서를 새로 export했다. read-first와 문/창/어닝의 전체 MD·정상오류 그림,
실제 원본시트를 열었다. 새 두 원본과 확대32격자, 전체객체 연락표도 직접 보았다.

[공식 페이지](https://yms.main.jp/dotartworld/page2/tile-retrotown01.html)는
Sento 외관의 목욕탕/여관과 RTown의 목조 공동주택을 구분한다. 기본 목욕탕 간판은宝湯,
여관은月光館이다. 아래 실제 샘플을 직접 열어 지붕→벽→전면 순서와 출입구 결합을 확인했다.
샘플 속 RTP 캐릭터/다른 시트 자동문/자판기는 가져오지 않았다.

- `https://yms.main.jp/dotartworld/sozai/tileset/smp_modern01/smp-town01.jpg` 목욕탕 전체.
- `.../smp-town05.jpg` 곡선 지붕·간판·노렌의 실제 근접 배치.
- `.../smp-town06.jpg` 목조 공동주택 외벽과 출입구.
- `.../smp-town07.jpg` 기와·전면 처마·줄무늬 차양·유리문 상점.

## 좌표·받침·범위

raw recipe.sourceRect는 0기준32px 칸이며 tiles는 `tile=y*8+x`의 전체 행우선 배열이다.
composites.parts.sourceRect와offset은 **원본 픽셀**, compiled composite.sourceRect/tiles는
**원본400칸 뒤의 파생 atlas 칸**이다. 파생 y50 이후를 원본 PNG에서 자르지 않는다.

공통 raw15: 백벽+목조하부/기둥, 차양덧문창, 차양종이창, 가로격자창, 작은환기창,
대나무, 전체정원수, 석등, 너구리상, 화분4종, 항아리2종.
Sento 별도raw6: 전체곡선입구, 宝湯간판, 月光館간판, 굴뚝, 물통, 닫힌격자문.
RTown 별도raw5: 유리문2열, 분재와목재받침, 우편함2열, 쓰레기통, 火の用心안내.
火の用心은 상점명이 아니다. 같은(4,26)화분도 Sento는붉은꽃/RTown은잎으로 다르다.

- standing: 전체 밑동은 하위 보도/지면 위. 실제 마지막 불투명 픽셀을 검사한다.
- wall-mounted: 창·우편함·간판은 목재 벽/지붕 받침에 붙인다. 바닥에 늘어놓지 않는다.
- building-part: 벽기둥·문틀·굴뚝은 건물 결합용. 단독 정상/오류 그림은 whole 경계 비교이며
  독립 지상가구 배치 승인이 아니다. 객체 문서에 실제 전체건물 도해도 넣었다.
- 전체 건물: 정적 upper+solid. 투명 여백을 보행 통로로 추정하지 않는다.

## 완전 합성4개

원본을 리사이즈/반전/재도색하지 않고 source-over 복사만 한다.
전체 parts 목록과 원본 SHA, 레이어 순서는 layout JSON 및 객체 소유 MD에 있다.

### Sento 전체8×11

목조벽 먼저: 양끝 기둥과 가운데 몸통, 마지막30행의 밑동을 보존한다.
지붕은 마루와 회색면 `(2,34)/(2,35)/(2,36)` → 전면 `(6,37)` → 처마밑동 `(4,37)` 순서로
8열을 잇는다. 가로셀 반복은 이 검토된 평면에만 적용하며 원본 곡선지붕을 늘리지 않는다.
굴뚝 `(2,47)1×3` 전체를 위쪽에 놓고, 곡선입구 `(4,43)4×4` 전체를 중앙에,
宝湯간판 `(6,47)2×1` 전체를 곡선지붕 아래에 합성한다.
위쪽2행의 투명영역은 굴뚝의 높이 투영이며 보행/넓은 활동마당이 아니다.

### RTown 전체6×8

같은 계열 기와의 회색면/앞처마를 짧게 구성하고, 목조벽/밑동 위에 전체유리문틀과
옆종이창, 원본 줄무늬 차양셀을 잇는다. 문틀 원본 `(0,1504,128,80)`을
canvas `(0,176)`에 놓아80px 전체 밑동이 건물의256px 하단에 닿는다.
원본 줄무늬 차양은32px 셀 그대로 반복하며 글자를 새로 그리지 않는다.

### RTown 문틀2개 — 잘못된 타일 경계 수정

원본을 단순32칸 사각으로 자르면 다른 객체가 섞인다.

| 객체 | 정상 원본 픽셀 사각 | 잘못된 사각 | 독립 돌 |
|---|---|---|---|
| 상점 전면 | (0,1504)128×80 | (0,1504)128×96 = tile(0,47)4×3 | 상대y80..94 |
| 종이문 | (0,1376)64×68 | (0,1376)64×96 = tile(0,43)2×3 | 상대y71..85 |

전체문틀의 문턱/밑동/좌우기둥은 정상 사각 안에 모두 있다. 문틀을 자르는 것이 아니라
별개의 느슨한 디딤돌을 분리한다. 각각128×96/64×96의 투명 canvas에 그대로 붙여 atlas에추가한다.
두 객체의 tile 및 object-owned 문서에 **전체문틀 정상 / 돌까지 포함한 경계 오류** 실제그림을
별도로 넣었다. 일반 조각누락/막힌접근 비교도 유지한다. 원본400칸은 그대로여서 돌 자체가삭제되지않는다.

## 작은 장소와 출입 계약

| 장소 | 크기 | 실제 구성·접근 |
|---|---|---|
| retrotown-sento-entry | 10×13 | 건물(1,0)8×11, 물통(0,9), 작은화분(9,10). 남쪽(5,12)→문앞(5,11)/(4,11), 물통앞(0,11), 화분앞(9,11) |
| retrotown-rtown-entry | 8×10 | 건물(1,0)6×8, 좌화분(0,6), 우쓰레기통(7,6). 남쪽(3,9)→문앞(3,8)/(2,8), 양옆(0,8)/(7,8) |

상점의 최초 건물x0안은 좌우1칸 여백으로 수정했다. 지붕 왼쪽 각 원본셀과 합성결과의
RGBA 차이0을 별도 확인했다. 불필요한 면적/장식을 추가하지 않고 문앞2칸 보도만 남겼다.

**ST-Sento-I02 탈의/욕실 내부 장소는 연결 후보일 뿐이다.** 이 지원에 자동문·영업·실내전이·
도시연결 이벤트는 없다. doorways/approachCells는 그림과 지상 접근 위치이며 실행이벤트가 아니다.
정본에 연결할 때 root가 실내 도착칸과 귀환 이벤트를 별도 저작·런타임 검증해야 한다.

## 준비와 공용 배포

```bash
node scripts/content/prepare-pixel-art-world-retrotown-exteriors.mjs
node scripts/content/prepare-pixel-art-world-retrotown-exterior-browser.mjs http://127.0.0.1:PORT src/assets/pixelArtWorldRetrotownExteriorsCatalog.json /absolute/user-png-directory output/paw-retrotown-exteriors/prepared
node scripts/content/prepare-pixel-art-world-native-install.mjs src/assets/pixelArtWorldRetrotownExteriorsCatalog.json output/paw-retrotown-exteriors/prepared output/paw-retrotown-exteriors/install
```

Catalog raw41과 Layout final45/scenes2를 함께 사용한다. 최종 tileset.structureKits의 객체 소유 문서,
`scene-<id>`의 장소 소유 MD/이미지와 정확한 lower/upper/placements/rooms/doorways/approachCells를
공용 projection으로 넘긴다. 타일 문서만 달고 장소/객체 문서를 등록했다고 하지 않는다.
원본400 prefix + 추가후 Sento488/RTown512칸. 원본 다운로드 버튼은 공식 페이지를 연다.
공용 등록과 정본 저장·재로드는 root 전담이며 prepare는 저장증거가 아니다.

실제browser importer: exactSHA/shape, 원본400 RGBA prefix, 문서schema, 실제발접지, 하위불투명,
장면전체배열 및45개 객체자료 확인. 실제 collision.canMove: 접근10곳 왕복,
목욕탕20도달칸/56방향간선, 상점16도달칸/44방향간선. 이것은 엔진데이터 경로관찰이며
player 이벤트/실내전이 QA가 아니다. 부모가 최종2PNG를 커밋 전에 직접보고 진행 승인했다.
DB쓰기·gates·vitest·typecheck를 실행하지 않았다.
