# Pixel Art World 현대 주택 사용자 PNG 지원

공용 메타데이터 정본은 `tiledata/pixel-art-world/home.json`, 생성기는
`scripts/content/prepare-pixel-art-world-home.mjs`, 번들은 `src/assets/pixelArtWorldHomeCatalog.json`이다.
원본 `ST-Town-I01.png`는 사용자가 제작자 페이지에서 받아 가져온다. 그림은 Git·public에 넣지 않는다.
공용 외부 타일셋 목록에서 이 별도 번들을 합쳐 제공한다.

12×11 주택은 작은 주방·거실·침실, 9개 검토 가구를 포함한다.
정확한 ID/칸·픽셀 좌표/전체 배열/배치/통행 계약은 [HOME.md](../tiledata/pixel-art-world/HOME.md).
남쪽 문(6,10), 북향 스폰(6,9), 침실 열린 입구(7,8). 실제 이동/문/수면 이벤트는 별도다.

4와 11만 통과, 벽/목재는 하위 차단, 모든 가구는 상위 차단이다. 그림 생성 단계에서 모든 하위
원본 픽셀 alpha255를 확인하고, 생성기는 출입→모든 접근의 4방향 연결과 겹침을 확인한다.
로컬 그림 생성: `node scripts/content/render-pixel-art-world-home.mjs /사용자/원본폴더`.
`output/paw-home/report.json` 및 실제 PNG를 읽는다. 정본 저장 증거와 혼동하지 않는다.
