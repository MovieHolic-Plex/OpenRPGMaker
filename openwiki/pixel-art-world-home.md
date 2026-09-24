# Pixel Art World 현대 주택 사용자 PNG 지원

## 도시의 서로 다른 두 주택 (2026-09-24 후속)

도시 정본의 중복된 16×18 주택 두 채는 `compact-homes.json`의 13×16/13×15 평면으로 다시 저작했다.
첫 집은 북쪽 침실·주방과 남쪽 거실, 두 번째 집은 서쪽 거실과 동쪽 침실·주방이다.
각각 분리 침실과 침대 발치 통로를 유지하며, 장/침대 밑동은 바닥4/11에 닿는다.
`revise-pixel-art-world-homes.mjs`는 기존 합성 아틀라스의 SHA를 확인하고 실제 `canMove`로
24개 접근/출구를 확인한 뒤 정본 CAS용 패치를 만든다. 도시 입구의 전이 좌표도 함께 바꾼다.
`save-pixel-art-world-patch.mjs`로 저장·재로드한 뒤 공용 게시기를 다시 실행한다.
공용 장소 문서는 각 집의 방·문·가구·전체 배열과 그림을 포함한다.

아래 14×16은 기존 원본 가져오기용 기본 표본이다. 도시의 두 완성 집과 크기/원점을 혼용하지 않는다.

공용 메타데이터 정본은 `tiledata/pixel-art-world/home.json`, 생성기는
`scripts/content/prepare-pixel-art-world-home.mjs`, 번들은 `src/assets/pixelArtWorldHomeCatalog.json`이다.
원본 `ST-Town-I01.png`는 사용자가 제작자 페이지에서 받아 가져온다. 그림은 Git·public에 넣지 않는다.
공용 외부 타일셋 목록에서 이 별도 번들을 합쳐 제공한다.

14×16 주택은 실제 벽·문으로 분리된 주방·거실·침실, 12개 검토 가구를 포함한다.
정확한 ID/칸·픽셀 좌표/전체 배열/배치/통행 계약은 [HOME.md](../tiledata/pixel-art-world/HOME.md).
남쪽 문(6,15), 북향 스폰(6,14), 침실 문(10,6..9), 주방 문(5..6,6..9).
`ceilingCells`는 별도 사용자 WallA01의 XP47 천장으로 치환하는 벽 상단이다.
도시 저작기가 원본을 함께 읽어 실제 천장 연결과 문 전이를 만든다. 수면 이벤트는 별도다.

4와 11만 통과, 실제 벽은 하위 차단, 모든 가구는 상위 차단이다. 이전 목재1/2 가짜 칸막이는 제거했다.
standing 가구는 실제 불투명 밑동이 바닥에 닿아야 한다. 창·시계는 wall-mounted다.
그림 생성 단계에서 모든 하위
원본 픽셀 alpha255를 확인하고, 생성기는 출입→모든 접근의 4방향 연결과 겹침을 확인한다.
로컬 그림 생성: `node scripts/content/render-pixel-art-world-home.mjs /사용자/원본폴더`.
`output/paw-home/report.json` 및 실제 PNG를 읽는다. 정본 저장 증거와 혼동하지 않는다.

두 집 실제 player.html 관찰: 각각 접근점11개를 방문하고 총126회 이동, 도시 action 진입과
touch 귀환2쌍을 확인했다. 실행 사본의 두 주택 및 도시 map 전체가 정본revision28 재로드와
정확히 일치한다. 공용 장소 참고문서도 이 배열과 방/가구/접근점으로 다시 게시했다.
