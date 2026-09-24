# Pixel Art World 학교 사용자 PNG 지원

공용 정본은 `tiledata/pixel-art-world/school.json`, 생성기는
`scripts/content/prepare-pixel-art-world-school.mjs`, 실행 번들은
`src/assets/pixelArtWorldSchoolCatalog.json`이다. 외부 타일셋 공용 카탈로그에서 별도 번들을 합친다.
좌표·SHA·조립 배열만 배포하고, 제작자 그림은 사용자가 직접 다운로드해 가져올 때 로컬로 처리한다.

학교 내장/외관/특별교실 원본 3개를 검증한다. 36개 부품과 현관 복도·교실·보건실·과학실 배열 4개가 있으며,
[원본 판본·부품 사전·조립 순서·오류 그림 생성 계약](../tiledata/pixel-art-world/SCHOOL.md)을 읽는다.
학교 교실은 14×13, 보건실은 11×11, 과학실은 13×11이다. 모든 특별교실이나 완성 외관 건물 전체를 지원하는 것으로 표시하지 않는다.

`scenePlans`는 저작용 압축 사전이며, 런타임 `scenes`는 width/height, lowerTiles/upperTiles 전체 배열,
placements, approachCells, notes, lowerTileIds, passableTiles를 갖는다. importer는 가져온 이미지에서
완성 그림과 참고 MD를 생성해야 하며 metadata JSON에 그림/dataURL을 넣지 않는다.

바닥 6만 통과하고 북쪽 벽·모든 상위 부품은 차단한다. 목재 바닥1/2를 벽처럼 쓴 좌우/남쪽 띠는 제거했다.
실제 외벽은 저작기가 배열 바깥에 천장/벽으로 둘러싼다. 문/스폰 좌표는 유지한다.
같은 원본 ID에 lower/upper가 충돌하면 안 된다. 생성기는 전체 배열과 출입→접근 경로를 확인한다.
과학실의 불투명 상판340..343만 하위차단이고 투명 전면348..351은 바닥 위 상위차단이다.
로컬 그림 생성기는 모든 하위 원본 픽셀 alpha255를 확인한다. `approachCells[0]`은 남쪽 문,
`approachCells[1]`은 권장 북향 스폰이며 report에 좌표를 남긴다.
예제는 저장 브리지 없는 fixture이며 프로젝트 정본 저장 완료로 보고하면 안 된다.

로컬 증거 생성: `node scripts/content/render-pixel-art-world-school.mjs /사용자/원본폴더`.
`output/paw-school/`의 정상/오류 실내 4개, 내장/외관/특별교실 실제 부품 그림과 report를 먼저 읽는다.
원본/파생 그림은 Git·public·배포 번들에 추가하지 않는다.

접지 수정(2026-09-24): 수납장(8,1), 체중계(6,2), 과학실 책장(1,2)로 옮겨 실제 밑동을
scene 바닥 y=3에 놓았다. 체중계 접근(6,4), 책장 접근(2,4). 이전 위치는 밑동 전체가 벽 안에
있는데도 경로 검사만 통과했던 오류였다. recipe의 `placementKind`/`supportCells`로 standing은
통과 바닥, wall-mounted는 wallTileIds, countertop은 supportTileIds의 상판이 받치는지 생성 단계에서
확인한다. 원본 픽셀의 밑동/완성 그림 검토도 필요하다. 상세 정정 좌표·실측은 SCHOOL.md에 있다.

현관 복도 `school-hallway`는 19×9, 남쪽 출입(9,8), 북향 스폰(9,7)이다. `doors`는
`{sceneId,x,y,approach:{x,y}}` 배열이며 x/y는 북쪽 문의 맨아래 그림 칸이다. 교실(4,2),
보건실(9,2), 과학실(14,2), 각 접근은 바로 남쪽 y=3이다. 닫힌 문은 차단 상태이므로
저작기는 문 앞 조사/접촉 이벤트를 연결하고 각 방의 출구를 복도의 해당 접근으로 돌린다.
`requiredClearRects`로 y3..5의3칸복도, `requiredDoorTargets`로 세 목적지를 확인한다.
논리 그래프 원칙과 벽 높이/용도 근거는 SCHOOL.md의 DPLAN/공식 가이드 링크를 따른다.
연구 알고리즘 구현이나 단일 축척 학교 평면의 비겹침 증명으로 보고하지 않는다.

## 4층 학교 / 실제 방 구조 (2026-09-24)

새 연속 평면 정본은 `tiledata/pixel-art-world/school-building-layout.json`과
`school-building-parts.json`, 지침은 `SCHOOL-BUILDING.md`다.
`prepare-pixel-art-world-school-building.mjs`가 `pixelArtWorldSchoolBuilding.json`에
65×39 네 층, 닫힌 방 경계 28개, 16교실·192석, 특별/관리실8개, 화장실4개와
전체 하위/상위 배열을 생성한다. 문을 막았을 때 복도로 새는 경로가 없어야 한다.
북쪽 세 방과 남쪽 세 방 사이에 4칸 복도를 두고 방 출입은 같은 맵의 보행이다.
동서 계단은 1↔2↔3↔4층 12방향 전이이며 4층에는 상행 계단이 없다.
하행 뒤는 벽으로 막고 세면대는 칸막이 벽 앞에 설치한다.

`pixelArtWorldSchoolBuildingGuide`를 외부 PNG importer에 연결해 학교 원본을 가져오는
모든 프로젝트에 공용 지침·원본 사전·네 층 전체 배열을 제공한다. 합성 번호는 해당
atlas 전용이며, 현재 원본 한 장의 tile 번호로 사용하면 안 된다. 의존 원본을 모두
확보한 뒤 사용자 로컬에서 완성 층 이미지를 조립한다. 그림은 배포하지 않는다.

`author-pixel-art-world-school-building.mjs <정본에서 읽은 portable.json> <개인 원본 폴더>`는
기존 네 개 학교 맵을 네 층으로 교체하고 도시 출입문을 연결한다. 기존 다른 시설은 보존한다.
공간 설계 library의 4개 space에 `interiorLayout.rooms/doorways`를 기록하며 시설 place에는
층 번호와 6개 양방향 계단 연결을 기록한다. `save-pixel-art-world-school-building.mjs`는
작업 시작 시 SHA가 같은 정본만 백업 후 저장·재로드한다. 실행 중 호스트에 직접 쓰지 않는다.
직접 플레이어 관찰은 `scripts/qa/pixel-art-world-school-building-capture.mjs`.

다운로드 카탈로그 정본: `tiledata/pixel-art-world/download-catalog/`. 32항목 조사 결과,
직접 파일512개, CSV874행(아카이브 내부 이미지 포함). 실패·배포 종료·샘플 게임을 분리했다.
CSV와 해시만 공유하고 원본/ZIP은 사용자 개인 다운로드 폴더에만 둔다.
