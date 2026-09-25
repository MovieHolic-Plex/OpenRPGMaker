# Pixel Art World 목조학교·공원 정적 조립 확장

2026-09-24. 기존 외부 PNG 가져오기 경로에 검토된 3개 native32 묶음을 추가한다. 원본 그림은 배포 번들에 넣지 않으며 사용자가 제작자에게 받은 파일을 가져와야 한다.

| 진입 | 역할 |
|---|---|
| `tiledata/pixel-art-world/static-expansion.json` | WI01/WI02/공원의 출처·SHA·35개 부품·5개 장면 저작 계획 |
| `tiledata/pixel-art-world/STATIC-EXPANSION.md` | 원본별 사각형 사전, 투명성·RTP·미지원 경계 |
| `scripts/content/prepare-pixel-art-world-static-expansion.mjs` | 픽셀 없이 부품 배열과 전체 장면 배열 생성; 범위·겹침·받침·접근·문 메타데이터 검증 |
| `src/assets/pixelArtWorldStaticExpansionCatalog.json` | 배포되는 메타데이터 |
| `src/project/externalTilesetCatalog.ts` | 기존 registry 연결 및 타일셋 정의 생성 |
| `src/editor/externalTilesetImport.ts` | 사용자 PNG SHA/크기/접지 확인, AI 문서와 원본·비교·장면 이미지 생성; 기존 구현 재사용 |
| `scripts/content/render-pixel-art-world-static-expansion.mjs` | 사용자 로컬 원본으로만 실제 장면/오류 비교/부품 시트를 gitignored output에 생성 |

새 지원: `paw-wood-school-interior` 13부품·2장면, `paw-wood-school-special` 15부품·2장면, `paw-park` 7부품·1장면. 전부 256×1600px, 32px, 8열×50행이다. 목조 외관은 별개 레이아웃이고 이 확장에는 없다.

생성 순서와 전체 좌표는 `tiledata/pixel-art-world/STATIC-EXPANSION.md` 참조. AI 문서는 원본별 레시피 정상/오류 전체 배열과 장면별 전체 배열·접근칸·실물 그림을 생성한다. 공원 원본은 기존 다중 원본 도시의 의존 소재이므로 기존 도시 청사진 참고 용도도 함께 생긴다. 그 청사진의 합성 번호를 공원 원본 번호로 오인하면 안 된다.

학교 장면은 북쪽 벽과 통행 바닥을 갖춘 실내 조립 표본이다. 남·동·서쪽 외벽/천장이나 문 이벤트는 표본 배열의 일부가 아니다. 실제 건축 맵을 만들 때 별도로 설계한다. 공원 예제의 잔디/흙 경계는 고정 지면 타일이며 자동 연결된 경계가 아니다.

등록 후에도 기존 프로젝트를 자동 수정하지 않는다. 새 원본을 가져오는 동안 문서가 생성되며, 공용 DB 등록 및 정본 콘텐츠 배치는 해당 게시/저장 작업의 책임이다. 원본·가공 픽셀을 Git/public 또는 메타데이터 JSON에 추가하지 않는다.

## 정본·공용 설치 도구

`prepare-pixel-art-world-native-install.mjs <catalog> <prepared-dir> <out>`은 브라우저
`prepareExternalTileset` 결과의 원본 SHA/크기와 최신 scene 본문을 다시 대조한다.
`install-pixel-art-world-shared-host.mjs <host> <library.json> <out>`으로 원본/공용 자료를
호스트 API에 저장하고 같은 대상에서 재로드한다. 원본을 정본에 설치한 뒤
`read-pixel-art-world-host.mjs` → `publish-pixel-art-world-local-library.mjs --publish-local`
순서로 공용 부품과 문서를 갱신한다. 카탈로그에 있어도 정본에 없는 원본은 게시하지 않는다.
