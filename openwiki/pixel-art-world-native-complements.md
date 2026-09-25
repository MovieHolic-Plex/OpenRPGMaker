# Pixel Art World 개인방·공중화장실 native32 보완

2026-09-24. 카탈로그 06·09의 독립 원본 3개를 기존 사용자 PNG 가져오기에 등록한다. 기존 학교/공원·주택 메타데이터는 변경하지 않는다.

| 파일 | 책임 |
|---|---|
| `tiledata/pixel-art-world/native-complements.json` | 출처/SHA, 48부품, 3장면의 저작 계획 |
| `tiledata/pixel-art-world/NATIVE-COMPLEMENTS.md` | 전체 좌표 사전, 원본별 차이, 제외·출입·벽면 계약 |
| `scripts/content/prepare-pixel-art-world-native-complements.mjs` | 원본 없이 전체 타일 배열 및 방/출입구 메타데이터 생성 |
| `src/assets/pixelArtWorldNativeComplementsCatalog.json` | 배포 메타데이터 |
| `src/project/externalTilesetCatalog.ts` | registry와 4방향 부품 접근 예제 |
| `scripts/content/render-pixel-art-world-native-complements.mjs` | 원본 SHA/크기/바닥 불투명성 확인, 개인 실제 렌더와 오류 비교 |

`paw-personal-room-male` / `paw-personal-room-female`은 각각 256×1120px·17부품·11×11 원룸이다. `paw-public-restroom`은 실제 256×1376px·14부품·15×9 차폐 두 칸/세면 공간이다. 웹 표기의 화장실 높이를 코드에 복사하지 않는다. 개인방 두 시트는 크기가 같아도 책장/책상 크기, 냉장고의 원본 행, 투명성 방식이 다르다.

기존 `prepareExternalTileset`를 그대로 통해 SHA/이미지규격/RGBA접지/AI문서 계약을 확인한다. 성공 시 사용자 파일에서 6참고용도·57MD·54이미지가 생성된다. 원본·비교·장면 픽셀은 사용자 개인 저장 경로에만 있고 Git/public 번들에는 없다. 남녀 원룸은 기존 home5/6의 대체 작업과 분리된 장면이다.

`externalRecipeExample`은 이제 east/west에서도 실제 앞 방향에 접근칸을 둔다. 기존에는 north 외의 방향을 모두 south로 취급했다. 다른 부품의 sourceRect/배열은 바뀌지 않는다. 새로 생성하는 관련 AI 예제만 올바른 방향을 따른다.

room/doorway는 실제 비어 있는 칸과 연결 구획이며 이벤트를 뜻하지 않는다. 남·동·서 경계는 원본 벽면을 사용한 컷어웨이로, XP 천장을 조립했다고 표현하지 않는다. 화장실 문닫기/잠금, 원룸 전이·취침·조리 등은 별도 저작이다. 공용 publisher와 정본 설치/저장 재로드는 별도 담당 경로를 사용한다.

## 사용자 로컬 공용 등록 경로

`prepare-pixel-art-world-native-browser.mjs <dev URL> <catalog.json> <사용자 PNG 폴더> <비공개 출력>`은
실제 `prepareExternalTileset`를 호출한다. 서버 레지스트리와 입력 카탈로그의 일치를 먼저 확인하고,
사용자 파일에서 참고 MD·부품/장면 그림을 만든다. 출력 자체는 정본 저장이 아니다.
`prepare-pixel-art-world-native-install.mjs`로 설치 자료를 만들고
`install-pixel-art-world-shared-host.mjs`로 원본 정의를 저장·재로드한다.

그 정본을 `read-pixel-art-world-host.mjs`로 다시 읽은 뒤
`publish-pixel-art-world-local-library.mjs`가 세 원본의 부품과 전체 장면을 로컬 공용 SQLite에 등록한다.
장면은 전체 배열·방 구획·접근칸·출입구·실제 그림을 가진 **장소 조립 자료**이며 실행 맵과 구분한다.
장소의 출입 포트만으로 전이/문 상태 이벤트가 생성되지 않는다.
그림은 사용자 로컬 저장소에만 두고 Git에는 이 경로와 좌표 메타데이터만 남긴다.

원룸 두 장면은 입구와 작업/주방/수면 영역의 위치를 서로 다르게 저작했다. 화장실은 원본(2,17)3×2 막힌 전면 패널을 추가하여 남동 입구에서 변기를 직시하지 않으며 서쪽 칸은 오른쪽 틈, 가운데 칸은 왼쪽 틈으로 들어와 변기 앞으로 꺾는다. 남쪽은 한 줄 통로다. 잠금 이벤트를 구조 차폐와 혼동하지 않는다.
