# Pixel Art World 학교 사용자 PNG 지원

공용 정본은 `tiledata/pixel-art-world/school.json`, 생성기는
`scripts/content/prepare-pixel-art-world-school.mjs`, 실행 번들은
`src/assets/pixelArtWorldSchoolCatalog.json`이다. 외부 타일셋 공용 카탈로그에서 별도 번들을 합친다.
좌표·SHA·조립 배열만 배포하고, 제작자 그림은 사용자가 직접 다운로드해 가져올 때 로컬로 처리한다.

학교 내장/외관/특별교실 원본 3개를 검증한다. 35개 부품과 조밀한 교실·보건실·과학실 배열 3개가 있으며,
[원본 판본·부품 사전·조립 순서·오류 그림 생성 계약](../tiledata/pixel-art-world/SCHOOL.md)을 읽는다.
학교 교실은 14×13, 보건실은 11×11, 과학실은 13×11이다. 모든 특별교실이나 완성 외관 건물 전체를 지원하는 것으로 표시하지 않는다.

`scenePlans`는 저작용 압축 사전이며, 런타임 `scenes`는 width/height, lowerTiles/upperTiles 전체 배열,
placements, approachCells, notes, lowerTileIds, passableTiles를 갖는다. importer는 가져온 이미지에서
완성 그림과 참고 MD를 생성해야 하며 metadata JSON에 그림/dataURL을 넣지 않는다.

바닥 6만 통과하고 벽·목재 테두리·모든 상위 부품은 차단한다. 상위라는 이유로 통행 허용하지 않는다.
같은 원본 ID에 lower/upper가 충돌하면 안 된다. 생성기는 전체 배열과 출입→접근 경로를 확인한다.
과학실의 불투명 상판340..343만 하위차단이고 투명 전면348..351은 바닥 위 상위차단이다.
로컬 그림 생성기는 모든 하위 원본 픽셀 alpha255를 확인한다. `approachCells[0]`은 남쪽 문,
`approachCells[1]`은 권장 북향 스폰이며 report에 좌표를 남긴다.
예제는 저장 브리지 없는 fixture이며 프로젝트 정본 저장 완료로 보고하면 안 된다.

로컬 증거 생성: `node scripts/content/render-pixel-art-world-school.mjs /사용자/원본폴더`.
`output/paw-school/`의 정상/오류 방 3개, 내장/외관/특별교실 실제 부품 그림과 report를 먼저 읽는다.
원본/파생 그림은 Git·public·배포 번들에 추가하지 않는다.
