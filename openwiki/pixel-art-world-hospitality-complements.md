# Pixel Art World 아이스크림점·목욕탕 보완

2026-09-24. 새 원본2개만 소유하는 hospitality 묶음이다. native/static-complements 및 기존 시설 메타데이터는 수정하지 않는다.

| 파일 | 책임 |
|---|---|
| `tiledata/pixel-art-world/hospitality-complements.json` | 원본 SHA,20완전부품,2장면 계획 |
| `tiledata/pixel-art-world/HOSPITALITY-COMPLEMENTS.md` | 좌표/받침/영업·탈의·욕실 동선과 제외 범위 |
| `scripts/content/prepare-pixel-art-world-hospitality-complements.mjs` | 원본 그림 없이 전체 배열·방/출입구 생성 |
| `src/assets/pixelArtWorldHospitalityComplementsCatalog.json` | 배포 메타데이터 |
| `scripts/content/render-pixel-art-world-hospitality-complements.mjs` | 사용자 원본 SHA/규격/하위 불투명성 확인과 개인 실제 렌더 |
| `src/project/externalTilesetCatalog.ts` | 기존 registry에 추가 |

`paw-icecream-shop`은 ST-Icecream-I01,256×640,32px·8열·160칸이다. `paw-japanese-public-bath`은 ST-Sento-I02,256×1440,32px·8열·360칸이다. 각10부품·1장면이며 기존 prepareExternalTileset 경로에서 실제 PNG SHA/규격/RGBA접지와 AI 문서 계약을 확인한다. 두 파일 준비 결과는4용도·26MD·24이미지다. 원본 픽셀은 번들에 포함하지 않는다.

아이스크림 매장은10×8, 쇼케이스 앞/뒤와 2석의 접근을 분리한다. 목욕탕은11×16, 마른 탈의실과 젖은 욕실 사이 실제 벽 및 한 칸 통로를 가진다. 욕조는 물을 포함해 고정 사각형 전체 차단이다. 판매·직원 제어·착석·입욕·문잠금·성별 운영 이벤트를 자동으로 만드는 기능이 아니다. SC-Door-U01은 별도 문 지원 경로 소유다.

미검토 마사지/드라이어·큰장식콘·소형아이콘·가변욕조 등은 부분 이름 추정으로 등록하지 않는다. 카탈로그 항목 전체가 검토됐다고 읽지 않는다. source/recipe/scene의 정확한 범위와 실제 생성 배열은 위 MD/JSON이 정본이다. 공용 게시와 canonical 설치는 별도 담당 경로에서 수행한다.
