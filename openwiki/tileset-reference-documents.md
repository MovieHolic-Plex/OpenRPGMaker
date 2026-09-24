> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# 타일셋 참고문서 — 프로젝트 데이터

## 공용 SQLite 지역 참고문서 조회 (2026-09-24)

`shared-content`에 저장된 지역과 옛 `shared-tile-references.spatial`은 서로 다른 저장 경로다.
기존 조회가 옛 `SHARED_REGION_REFERENCES` 배열만 읽어 새 공용 도시의 MD/이미지를 찾지 못했다.
`sharedSpatialReferences.sharedRegionReferences()`는 호출 시 두 카탈로그를 ID로 합치고
현재 공용 콘텐츠를 우선한다. 지역 갤러리·AI 지역 목록·지역 문서 조회가 이 함수를 공유한다.
지역의 전체 타일 배열도 현재 라이브러리의 `sharedRegionSnapshot`을 먼저 읽는다.
두 endpoint의 부팅 순서나 옛 공간 자료 초기화로 새 지역을 지우지 않는다.
문서의 저장 여부만으로 완료를 판단하지 말고 `read_spatial_reference`의 지역 MD/이미지와
`read_region_reference`의 전체 행을 실제로 읽어 확인한다.

## 사용자 다운로드형 타일셋 지원 (2026-09-24)

욕실·체육관 native 2팩의 원본/완전체/객체 AI 문서와 준비 경로는 [별도 지침](pixel-art-world-bath-gym.md)을 따른다.
이자카야·일본식 방의 원본 보존/3층 합성/객체·장소 문서는 [일본식 실내 지침](pixel-art-world-japanese-interiors.md)을 따른다.
저택 내부5판본의 객체 비교/전체 가구/보석상/상판 조립은 [저택 내부 지침](pixel-art-world-mansion-interiors.md)을 따른다.
저택 외관3판본의 지붕/전체건물/장식발코니 경계는 [외관 지침](pixel-art-world-mansion-exteriors.md)을 따른다.

자료집 → 맵 → 타일 → **외부 타일셋 다운로드**에서 Pixel Art World 도서관·사무실,
도시 상가·주택가, 학교 내장·외관·특별실, 의원·편의점·식당·주택 내부까지 11팩을 지원한다. 다운로드는 제작자 페이지를 열고, 사용자가 받은 PNG를
가져올 때 SHA-256 + 디코딩 치수를 확인한다. 원본/샘플 그림은 앱에 번들하지 않는다.
공용 메타데이터는 `tiledata/pixel-art-world/catalog.json` →
`scripts/content/prepare-pixel-art-world-references.mjs` → `src/assets/pixelArtWorldCatalog.json`.
기존·새 프로젝트 모두 같은 카탈로그를 사용하지만, 원본을 가져오기 전에는 타일셋을 만들지 않는다.

`src/editor/externalTilesetImport.ts`가 사용자 PNG에서 조립/오류 비교 그림을 만들고
원본 1 MD/PNG + 부품당 1 MD/PNG를 `referenceDocuments`에 넣는다.
도시 사거리(28×27), 작은 교실(14×13), 현관·복도(19×9), 도서관·사무실·시설 내부 등 scene은
별도 용도마다 전체 배열 1 MD + 실제 합성 1 PNG를 추가한다. 따라서 조수의 기존 문서·이미지
선행 읽기 계약을 그대로 사용한다. 타일 번호·칸/픽셀 좌표·lower/upper 전체 배열,
통행/접근칸·크레딧을 포함한다. 이 그림은 사용자 프로젝트에서만 생성·보관한다.
등록은 한 번의 snapshot + store.update로 undo/dirty/저장 경로를 공유한다.
비동기 준비 중 프로젝트 lineage/저장 대상 변경 또는 대화상자 닫기는 등록을 취소한다.
단, 이미 asset 저장이 시작된 경우 참조되지 않는 파일은 저장소의 자산 정리 대상이 될 수 있다.

시트 전체의 의미 분석은 아니다. 명시된 완성 장면과 검토 부품에 조립 배열을 제공한다. 검토된 가구는 upper·차단,
바닥은 lower·통과, 나머지는 미검토·차단이다. `externalRecipeExample`과
`validateExternalRecipeExample`은 고정 가구 예제의 구조와 접근칸만 다룬다.
범위·원본 판본·자료 생성 절차: [pixel-art-world](../tiledata/pixel-art-world/README.md),
[도시](../tiledata/pixel-art-world/URBAN.md), [학교](pixel-art-world-school.md).
도시·학교 메타데이터는 각각 `prepare-pixel-art-world-urban.mjs` / `prepare-pixel-art-world-school.mjs`로 생성한다.
`ExternalTileScene`은 전체 배열·접근칸·통행/홈 레이어를 명시하며 가져오기 전에 검증한다.

[도시 50×50](../tiledata/pixel-art-world/CITY-50.md)은 여러 사용자 원본을 조합하는 별도 청사진이다.
`prepare-pixel-art-world-city.mjs` → `pixelArtWorldCity.json`에는 픽셀 없이 원본 해시·합성 번호 사전·전체 배열·출입구를 싣는다.
관련 도시 팩을 가져오면 `pixelArtWorldCityGuide`가 5 MD와 현재 사용자 원본 이미지를 추가한다.
번호는 현재 시트가 아닌 합성 atlas 전용이다. 다른 원본이나 시설 이벤트를 자동 설치하지 않는다.
`author-pixel-art-world-city.mjs`는 로컬 원본으로 12맵을 만들고,
`save-pixel-art-world-city.mjs`는 새 사용자 SQLite 프로젝트에 저장·재오픈한다.
저작 결과 그림은 사용자 프로젝트에만 존재한다. 자료집의 다운로드 방식이나 소재 번들 정책은 바뀌지 않는다.

### 공간 설계·실제 발판 검사

공유 설계 근거는 `tiledata/pixel-art-world/MAPPING-RESEARCH.md`이며
`prepare-pixel-art-world-layout-guidance.mjs` → `pixelArtWorldLayoutGuidance.json`으로 번들한다.
모든 해당 PNG 가져오기에서 공통 설계 MD를 추가한다. Tiled 2026 청사진 분리,
DPLAN의 문 연결 관계, COHO의 도시 계층과 RPG Maker의 실무 지침을 구별해 기록한다.
논문 모델을 구현하거나 미학을 자동 검증했다는 의미는 아니다.

`ExternalTileRecipe.placementKind`는 standing/wall-mounted/countertop을 구분하고
`supportCells`는 조각 내부의 지지 위치다. 가져오기 준비 중 `externalTileGrounding.ts`가
standing의 실제 불투명 최하단 픽셀과 scene 바닥을 대조해 벽 위 가구를 거절한다.
완전한 조각인지, 용도에 맞는 공간인지는 PNG 검토가 따로 필요하다.
`ExternalTileScene.rooms/doorways/ceilingCells`는 주택 방/문/천장 경계를,
`doors`는 학교 복도와 각 실의 문/접근 좌표를 보존한다.
학교는 거리→현관·복도→각 실→복도로 전이하며 입구 선택 메뉴를 사용하지 않는다.

## 사용자 경로와 정본

**자료집(데이터베이스) → 맵 → 타일 → 타일셋 선택 → AI 참고문서 탭 → 용도(마을 등) → MD / 이미지**.
(2026-09-23 부터 타일셋의 첫 화면은 「통행·레이어」다. AI 참고문서는 네 번째 탭.)
저장소의 `openwiki/slates-*.md`는 연구 출처다. 현재 프로젝트의 저작 지침 정본은
`project.tilesets[id].referenceDocuments`이며, 문서 본문과 PNG/JPEG/WebP 바이트를 프로젝트에 보관한다.
로컬 HTML 서버·옛 대화·외부 이미지 URL이 없어도 읽힌다. 모든 AI 모델이 같은 자료를 쓴다.

- 용도 추가/이름·설명 편집/삭제. 용도마다 여러 MD 문서와 이미지.
- MD 직접 편집·미리보기와 MD/이미지 다중 파일 가져오기. 이미지 설명 편집.
- `![설명](image:<id>)`, 같은 용도의 파일명, 유일한 상대 경로 basename을 첨부 이미지로 해석한다.
- 원격 이미지는 자동 요청하지 않는다. HTML은 기존 안전한 Markdown 렌더러에서 텍스트로 표시한다.
- 삭제는 확인 후 수행하며 `recordProjectSnapshot` + `store.update`를 통해 undo·dirty·자동 저장을 공유한다.
- 파생 아틀라스는 `referenceSourceTilesetId`로 원본의 자료를 공유한다. 한 단계만 허용한다.
  공유 화면의 수정은 원본에 반영된다고 표시한다. 자체 문서가 있거나 다른 타일셋이 참조하는 원본은
  원본 선택을 바꿀 수 없다. 끊어진 참조·자기 참조·연쇄/순환 참조는 로드에서 거부한다.

## 타일 화면 구성 (2026-09-21)

`tilesetSettingsPanel.ts`가 전용 타일 목록과 작업대를 렌더한다. `spatialShell.ts`는 tiles 요청을
이 화면에 위임한다. 장소용 설계/배치 모드·인스턴스 관리 메뉴를 타일 화면에 재사용하지 않는다.
왼쪽 타일 목록에 16/32px 규격과 참고문서 수를 표시하고 이름/ID 검색을 제공한다.
첫 내부 탭은 **AI 참고문서**다. 이후 사용자가 고른 내부 탭은 세션에서 유지한다.
용도 선택 → 문서/이미지 목록 → 읽기 영역으로 이동하며, 읽기 영역만 독립 스크롤한다.
그림은 확대 대화상자로 볼 수 있다. `용도 관리`, `MD 편집`, 이미지의 `설명 편집`으로 저작 폼을 연다.
이름·그래픽·투명색은 별도 **설정** 탭에 둔다.

정리한 화면:
- AI 응답 JSON 붙여넣기/선택 드래그 → 제거. `tilesetAiQuestionEditor.ts` 삭제.
- 별도 AI 타일셋 분석 작업실 런처 → 제거. AI 작업은 공통 AI 어시스턴트 진입을 사용한다.
- 생성 감사 레일·AI 재감사·팔레트 프리셋 보조 편집창 → 제거. `tilesetCheckerSummary.ts` 삭제.
- 통행/레이어/지형, 자동 연결, 수동 타일 설명/그룹, 그래픽 설정은 유지한다.

기존 메타데이터·그룹·팔레트 프리셋·통행 배열과 참고문서 데이터는 삭제/변환하지 않는다.
분석 모델/파서 및 기존 호환성 테스트가 참조하는 옛 모달 모듈은 별도로 남아 있지만,
출하 타일 UI에서 호출하지 않으며 전용 작업실 CSS도 로드하지 않는다.
일부 UI 테스트의 옛 런처 기대값과 파서 import 경로를 새 계약에 맞췄다. 테스트 실행은 하지 않았다.

## 저장 계약

`src/project/tilesetReferences.ts`: 용도/MD/이미지 타입과 한도·검증·문서 소유자 해석·내용 revision.
`TilesetDef.referenceDocuments?`와 `referenceSourceTilesetId?`는 선택 필드다.
미작성 레거시 문서에는 기본값을 심지 않는다. JSON/OPRN/SQLite/LegacyDb tileset JSON 왕복에서 유지한다.
LegacyDb 별도 테이블 마이그레이션은 필요 없다. `src/project/webExport.ts`는 게임 실행에 필요 없는
참고문서와 공유 포인터만 내보내기 사본에서 제외한다. 편집 프로젝트 원본은 보존한다.

용도 32개, 용도당 MD 64개·이미지 256개, MD 120,000자, 이미지 4MB 제한.
ID는 중복 불가. 업로드 이미지는 실제 디코딩 후 반영한다. MD와 이미지는 한 번의 변경으로 가져온다.
UI 저장 성공 문구는 원격 저장 영수증이 아니다. 원격 완료는 기존 footer와 store flush 결과로 판단한다.

## AI 선행 읽기 계약

1. `list_tileset_references(tilesetId)`로 용도를 고른다.
2. `list_tileset_references(tilesetId, categoryId, offset)`로 자료 ID를 20개씩 조회한다.
3. 각 MD를 `read_tileset_reference(tilesetId, categoryId, documentId, offset)`로 읽는다.
   6,000자 단위이며 `nextOffset: null`까지 조회한다.
4. 각 그림을 같은 도구의 `imageId`로 조회한다. 실제 이미지 입력이 전달된다.
5. **다음 모델 응답에서** 타일 쓰기를 한다. 용도가 여러 개면 `referencePurpose: <categoryId>`를 지정한다.
   한 개면 자동 선택한다. 선택 용도의 모든 문서/그림이 필요하다. 다른 용도는 필요에 따라 추가 조회한다.

강제 경계는 실제 조수 `scripts/lib/piAgentRuntime.ts` + `src/ai/piAgent/toolAdapter.ts`이며
`PiTilesetReferenceGate`를 실행당 하나 생성해 초기·발견·fallback 도구 모두에 공유한다.
`onPayload`로 최종 제공자 요청을 관찰하고 성공한 assistant `message_end`에서만 읽기 증거를 적립한다.
Responses/Chat Completions/Anthropic/Gemini의 실제 tool result와 image 구조를 확인한다.
텍스트 잘림, 이미지 미지원/누락, 제공자 오류, 같은 응답의 조회+쓰기는 통과하지 않는다.
내용 revision에는 그림 바이트도 들어가므로 수정하면 이전 읽기 증거는 무효다.
레거시 AssistantSession도 정확한 본문 전달과 imageDelivery 영수증을 사용한다.

`TILESET_REFERENCE_WRITERS`는 맵 생성·변형/타일 배치/집·마을/공간 적용 계열의 명시적 목록이다.
새 배치 도구를 추가하면 이 목록도 갱신한다. 목적은 키워드 추측 대신 도구의 `referencePurpose`로 선언한다.
선행 읽기 **거부**는 그중 모델이 타일을 직접 고르는 `TILESET_REFERENCE_TILE_CHOOSERS`(타일 번호·재질 어휘·팔레트·조립법 ID)에만 걸린다(2026-09-24).
빈 맵 생성·크기/복제/이동·결정론 파이프라인·세션 전진은 코드가 타일을 고르므로 문서를 읽어도 결과가 같다 —
보스방 `create_map` 하나에 34건 읽기를 요구하던 비용을 없앴다. 이 도구들의 `referencePurpose`는 받기만 하고 무시한다.
이 장치는 자료의 **전달**을 확인한다. 이해도·배치 품질을 자동 보장하지 않는다.
저수준 `runTool`, 직접 JSON/SQL/파일 편집까지 모델 요청을 관찰할 수는 없다. 외부 코딩 에이전트는
AGENTS의 동일 읽기 절차를 따르고, 프로젝트를 읽어 아래 exporter로 실제 그림을 열어야 한다.

## Slates 이관

프로젝트 `rpg-zzu-slates32-38e6`, 원본 타일셋 `slates_32`.
파생 Slates 7개가 원본 자료를 공유한다. 4용도, **14 MD / 109 이미지**:
마을 5/23, 구조 표본 1/40, 타일 사전 2/46, 조립 레시피 6/0.
원작 Ivan Voirol / CC BY 4.0 표기를 유지한다. 원본 MD의 PNG 링크를 저장된 이미지 ID로 이관했다.
6개 모듈 JSON은 생략 없이 MD 코드 블록으로 보존하며 연산 필드의 짧은 키 대응을 문서에 적었다.

이관: `scripts/content/seed-tileset-references.mjs` (입력은 새 원격 snapshot).
원격 저장: `scripts/content/save-tileset-references.mjs` (source SHA 비교 후 CAS + 실제 reload).
외부 에이전트용 추출: `scripts/content/export-tileset-references.mjs <project.json> <tilesetId> <new-directory>`.
이 추출물은 전달용 사본이다. 수정은 UI의 프로젝트 정본에 반영한다.

## 확인 자료와 범위

`verify-shots/tileset-references/`: 실제 DB UI, 편집/업로드 관찰, 제공자 전달 형식별 차단/허용 관찰,
저장 영수증. `scripts/qa/capture-tileset-references.mjs`는 브라우저에서 실제 모듈을 호출한다.
유료 LLM 호출이나 새 마을 생성은 하지 않는다. gates/vitest/전체 typecheck는 실행하지 않았다.

## Castle2 성채 학습 이관

성채 프로젝트 `castle-fortress-city-20260921` 및 SQLite
`b4706a77-9a38-4dcc-a89d-36244da53967`의 `opengameart_castle`에
구도·조립·비교 개선 3용도, 20 MD / 19 이미지를 저장했다.
`castle_courtyard_harbor`는 원본을 공유한다. 전체 성채와 3개 공용 장소의 독립
저장본 및 칩셋 포함 다운로드에도 자료를 포함한다. 다른 기존 프로젝트를 일괄 수정하지 않는다.
원본/반려/수정 비교, 16구역 분석, 부품 JSON, 개선1 석조 관리소 최종 선택과 돌다리
사용 제외를 보존했다. `tiledata/castle-tiles-rpgs/ai-references/README.md`와
`scripts/content/register-castle-references.mjs` 참조. 저장소 연구 기록만 읽는 것으로
현재 프로젝트의 참고문서 선행 읽기를 대신하지 않는다.

## 숲마을 공용 자료 (2026-09-21)

`forest_high_cliff_river`의 `village` 용도에 배치/공용 저장 안내 2 MD와 선별 마을
전체 사진 7개를 보관한다. `shared_forest_village_objects`의 `village-props` 용도는
19개 소품의 16px·6열 조립/금지 목록 1 MD와 시트 이미지 1개다.
프로젝트 `oprn-hill-forest-harmony-20260918-a4e1`은 **로컬 SQLite가 편집 정본**이며,
`apply-shared-village-references.mjs`가 에디터 store.update/flush 경로로 문서만 추가하고
SQLite 및 새로 연 에디터에서 다시 읽는다. 원본 29개 맵의 타일 배열은 변경하지 않는다.

공용 장소 7개의 문서 포함 스냅샷은 `oprn-place-organic-*-v2`, 소품 원격 보존본은
`oprn-shared-forest-village-objects-v2`다. 기존 v1 원격 스냅샷을 덮어쓰지 않는다.
신규 프로젝트는 공용 소품 번들의 문서를 받으며, 기존 번들에 문서가 없을 때만
`ensureSharedVillageObjectReferences`가 보충한다. 사용자 문서나 공유 포인터는 보존한다.
`tiledata/tilesets/forest_high_cliff_river/shared-library/`는 저작 원문과 선정 기록,
`src/assets/sharedVillageReferences.json`은 배포용 MD/이미지 묶음이다.

## 공용 forest_harmony 참고문서 보충 (2026-09-22)

`src/assets/forestHarmonyTileset.json.referenceDocuments`에 `forest-public-village`
용도를 배포한다. **숲마을 · 거리별 잔디** 공용 타일 자체에 2 MD / 8 이미지가 들어가며,
새 프로젝트의 `defaultTilesets()`만으로 사용할 수 있다. 파생 프로젝트용 문서만
등록했던 누락을 보완한다. 공용 원본 시트와 확장판 예시를 명시적으로 구별한다.
`ensureForestHarmonyReferences`는 같은 bundled 이미지의 기존 타일셋에 없는 용도만
추가하고, 기존 동일 ID 문서·다른 사용자 용도·문서 공유 포인터·업로드 타일셋은 보존한다.

저작 원문: `tiledata/tilesets/forest_harmony/references/VILLAGE.md`.
준비: `scripts/content/prepare-forest-public-references.mjs`.
SQLite 저장/재로드: `register-forest-public-references.mjs` (대상 호스트가 중단된 폴더에서
공식 local-store API 사용; 실행 중 DB 직접 수정 금지).
신규/기존 SQLite 프로젝트의 실제 배포 UI 증거: `verify-shots/forest-public-references/`.

### Castle2 공용 기본 제공 수정

`src/assets/sharedCastleReferences.json`에 3용도 / 20 MD / 19 이미지를 공용 번들로 포함한다.
`createCastleTileset()`이 새 프로젝트마다 독립 편집 가능한 사본을 넣는다.
`ensureBundledTilesets()`도 문서 필드가 없는 기존 기본 Castle2에만 보충한다.
작성한 문서(빈 배열 포함), 공유 포인터, 다른 이미지로 바꾼 타일셋은 보존한다.
특정 성채 프로젝트나 공용 장소 다운로드를 가져와야 하는 조건은 없다.
새 빈 프로젝트의 타일 → 성채 · OpenGameArt → AI 참고문서에서 확인한다.

## 실행형 부품·조립·검증 자료

공용 성채 및 `forest_harmony`의 `tile-assembly-executable` 용도에 성채 14개,
숲 마감/몸통 3개의 사전을 제공한다. `src/assets/tileAssemblyCatalog.json`은 원본 셀 좌표,
마스크와 lower/upper 배열을 보관한다. `scripts/content/build-tile-assembly-catalog.mjs`로
현재 실측 부품/공용 숲 previewMap에서 재생성한다.

읽기 도구: `get_tile_assembly_part`, `preview_forest_strip`, `validate_tile_assembly`.
실행 구현은 `src/project/tileAssemblyGuide.ts`. 남향 숲 띠는 높이6, 폭6*N+2(N>=2)만
지원한다. 임의 다각형 숲이나 자동 이미지 인식이 아니다. 검증은 명시한 계획과 실제 맵을
비교해 뿌리·줄기·반대쪽 마감·접근이 막힌 입구의 좌표를 반환한다. 출입구는 지정한 인접
칸에서 엔진 canMove와 보수적 이벤트 점유로 확인하며 전체 경로/전송 이벤트는 별도다.

입력·계획·출력 배열·완성 이미지·네 오류 사례는 `tiledata/castle-tiles-rpgs/executable/`.
등록은 `scripts/content/publish-executable-tile-guides.mjs`(공용 출하 자료) 및
`register-executable-tile-guides.mjs`(실행 중 SQLite 호스트의 CAS 저장 API)다.
기존 사용자 문서는 보존하고 빠진 용도만 공용 칩셋에 보충한다.

## 공용 숲 실행 조립법 (2026-09-22)

`forest_harmony`의 `forest-executable-v1` 카테고리는 추상적인 미감 설명을 보완하는
정확한 10개 부품 배열, 입력/정답 배열, 원본 16px 조립 그림 3개를 담는다.
정본은 `tiledata/tilesets/forest_harmony/recipes/`이고 생성은
`node scripts/content/prepare-forest-executable-references.mjs`이다.
`inspect_forest_recipe` / `stamp_forest_recipe`는 `src/project/forestRecipes.ts`의
결정론적 조립기를 사용한다. 쓰기 도구는 기존 참고문헌 읽기 게이트를 통과해야 한다.
지원 범위는 온전한 기존 패턴 7종과 폭 `6N+2`, 높이 6인 반복 숲이다.
현재 칩셋/부품이 원본과 달라지면 거절한다. 사각형 전체의 두 레이어를 쓰므로 -1도
지우기이며 투명 병합이 아니다. 기존 이벤트는 항상 보호한다.
`checkPlaced`는 조립 결과와 실제 배열의 차이를 좌표별로 반환한다.
`accessPoints`가 있을 때만 타일 통행 BFS를 수행하며 이벤트 조건/미적 품질을 보증하지 않는다.
저가 모델의 실제 성공률은 아직 측정하지 않았다.
SQLite 저장은 호스트를 종료한 후 `register-forest-executable-references.mjs <projectDir...>`로
공식 store API를 사용한다. 사용자 문서와 맵은 보존하며 저장 후 재로드한다.

### 상세 공용 조립 계약 (public-assembly-v2)

사용자 기준은 `tiledata/AI-REFERENCE-CONTRACT.md`이며 AGENTS에서 필수로 연결한다.
`prepare-public-tile-recipes.mjs`가 6개 건물/가구/숲/울타리/동굴 조립 카탈로그와
기존 레이어 메타 설명 정정표를 만들고, `render-public-recipe-references.mjs`가
정확한 배열을 합성해 정상6/오류8 그림과 실제 검증 결과를 만든다.
`embed-public-tile-recipes.mjs`가 19문서/14그림을 공용 정의에 넣는다.
`publicTileRecipes.ts`는 원점+recipeId로 원자적 배치와 의미별 오류 좌표를 제공한다.
접근칸은 카탈로그에 내장되고 외부 맵 입출구는 entryPoints로 명시한다.
동굴893은 retro_world 413의 투명 이식 및 하위 받침652를 사용한다.
기존 플레이 그래픽의 레이어 priority는 유지하며 어긋난 설명99개를 정정한다.

## 이슬여울 마을 장식 표본 (2026-09-22)

`dewbank-village-v1` / **이슬여울 · 25종 장식 조립**은 승인된 88×60 마을을
`forest_harmony`와 `shared_forest_village_objects`의 공용 참고문서에 제공한다.
정본은 `tiledata/tilesets/forest_harmony/dewbank-village/`: 24 MD, 실제 타일 이미지 9장,
25종 부품·85개 배치·225개 사용 타일 결합 사전, 하위/상위 전체 배열, 8개 문/접근칸.
다른 칩셋에서 2610번을 고정 소품 번호로 쓰면 안 된다. 원본 그림+칸으로 이식하고
빈 행부터 배정한다. 3행 굽이숲 몸통과 기존 6행 forest-repeat 레이어 규칙을 구분한다.

- `scripts/content/build-dewbank-references.mjs`: 커밋된 표본/MD/그림에서 번들 자료집 재생성.
- `scripts/content/render-dewbank-evidence.mjs`: 표본의 정상 및 5가지 실제 변조를 렌더링;
  `DEWBANK_DEV_URL`로 현재 워크트리 Vite 주소 지정. 저장소/원본 프로젝트는 변경하지 않는다.
- `scripts/content/validate-dewbank-village.mjs <project.json> [mapId]`: 읽기 전용 표본 비교.
  정확한 88×60 배열/이식 결합과 엔진 타일 도달성만 확인하고 오류 좌표를 반환한다.
  임의 마을 미학/이벤트 실행을 판정하는 도구가 아니다. 결과는 최대128개+전체 오류 수.
- `scripts/content/register-dewbank-references.mjs`: 관련 공용 다운로드에 보충.
  `--project-dir <offline-folder>` 또는 `--host <url> --project-id <id>`로 SQLite 저장·재로드.
  `--host <url> --all-host-projects`는 기본 프로젝트와 호스트 목록의 관련 프로젝트 모두에
  추가한다. 기존 같은 ID의 사용자 문서는 보존하고 맵 불변 및 SHA CAS를 확인한다.

새 프로젝트는 두 번들 팩토리에서 즉시 제공한다. 기존 프로젝트는 번들 타일셋 보충 경로가
빠진 카테고리만 추가한다. 사용자 업로드/공유 원본 포인터/편집 문서는 덮어쓰지 않는다.
등록 및 SQLite 재로드 영수증과 실제 참고문서 컴포넌트 화면은 해당 폴더의 `ai-references/`에 있다.

## 다양한 마을의 번들 소유 참고문서 (2026-09-23)

`tiledata/forest-villages/diverse/` → `scripts/content/prepare-diverse-village-references.mjs` →
`src/assets/sharedDiverseVillageReferences.json` → `forestHarmony.ts` 생성자/ensure 경로.
현재 용도 ID는 `diverse-villages-trunks-v12`(문서52개/이미지30개)과 `concept-villages-v3`(문서27개/이미지3개)이다.
완성 맵 3개, 지형 입력과 집·소품 좌표, 모든 두 레이어 배열, 절벽 이식·숲 조립·문앞 접근을 포함한다.
잘린 뿌리·빠진 줄기·반대 외곽·잘못된 레이어·막힌 입구의 정상/오류 그림과 좌표 반환 예제가 있다.
자동 검사는 이 동결 표본과의 비교이며 임의 마을용 미적 판정기가 아니다.

이미지는 원본을 source에 보존하고 번들용만 긴 변 820px/128색으로 줄인다. 새 프로젝트 생성 시
바로 가지며, `ensureBundledTilesets` → `ensureForestHarmonyReferences`로 기존 프로젝트의 빠진
용도만 채운다. 기존 저자 문서/공유 포인터/다른 이미지의 동명 칩셋은 건드리지 않는다.
지역 다운로드에도 새 용도가 포함된다. 원격 행 등록만으로 배포 완료를 주장하지 않는다.
새/기존 프로젝트 배포, 다운로드 직렬화 왕복, 실제 문서 화면 근거는 `verify-shots/village-diversity/`.


### 절벽 조립 교정 (2026-09-23)

‘큰 폭포 아래 마을’의 실제 상위 배열을 기준으로 세 마을을 revision2로 교정했다.
얇은 둘레 띠 대신 굽은 윗선·반복 면·같은 윤곽의 밑단을 사용하고 좌우 사선 원본231/232를 구분한다.
암벽은 upper, 계단은 lower+upper 비움이다. 높이에 맞춘 계단 양끝과 문앞 연결을 확인한다.
`src/project/defaults/forestHarmony.ts`는 `previous-reference.json`의 revision과 정확히 같은
미편집 v1만 교체한다. 사용자 수정본/공유 포인터는 보존하고 새 용도를 제공한다.
정확한 원본 배열과 픽셀 일치·8종 오류·SQLite 재로드 근거는
`tiledata/forest-villages/diverse/cliff-source.json`, `verify-shots/village-cliff-repair/`에 있다.

### 잔디 경계 개정3 (2026-09-23)

사용자 확정은 기존 바닥240 유지다. 504/505의 사선 및498/499/528/529/619의 잔디 픽셀만
그 바닥에 맞춘다. 기존 아틀라스를 덮어쓰지 않고 공용 `forest_harmony_grass_joins`
(16px·9열·9칸)을 추가했다. 생성기는 `prepare-forest-grass-joins.mjs`, 실제 치수는 bundled
기하와 defaultAssets 생성자가 공유한다. 그림 파일은 이식을 위해 번들에 남긴다. 이 시트를 타일셋으로 쓰는 맵이 없으면 타일 목록에는 올리지 않는다. AI 문서는 forest_harmony를 공유한다.
사선은 lower+받침240, 모서리/암벽은 upper다. 상위 소품과 바닥 그림은 유지한다.
미편집 v1/v2 문서만 내용 revision 일치로 교체하고 편집본은 보존하면서 개정3을 추가한다.
세 지역 revision3, 10종 오류 예제 및 grass-backing 검사. 근거 `verify-shots/village-grass-joins/`.

### 굽은 지형·입구 개정4 (2026-09-23)

3개 공용 지역 revision4. 504–559–505를 완전한 /—\ 조립으로 만들고, 중간 충돌을 건너뛰지 않는다.
바닥240을 유지한 파생 시트는10열10칸으로 늘고, 기존9칸 정의는 저자 메타데이터를 보존하며9번559만 추가한다.
절벽의 골·돌출부와 계단 평탄부를 분리하고, 숲은 plateau 전체 제외를 없애 군집/빈터 밀도장을 적용한다.
맵 가장자리 폭3·깊이5 출입구를 도로에 연결해 모두 검사한다. 12종 오류에 마감 누락·막힌 맵 출입구가 포함된다.
공용 AI 자료는 v1/v2/v3 중 미편집 배포본만 교체하며 저자 편집본·공유 포인터는 보존한다.
연구의 적용 범위와 재현 수식은 `tiledata/forest-villages/diverse/research-layout.md`,
정본 revision10 저장/재로드 및 화면 증거는 `verify-shots/winding-villages/`.

### 생활 마당 개정5 (2026-09-23)

무작위 중앙 소품과 집 주변 산개를 제거했다. `village-household-props.mjs`는 집별 ownerId와
주거/텃밭/작업·보관/약초 묶음을 좌우 벽에서1칸 떨어진 마당에2–4개씩 배치한다.
큰 묶음→같은 용도의 좁은 묶음→배치 생략 순서이며 중앙으로 밀어내지 않는다.
완전한 묶음 접근 검증, 허수아비-채소밭 동반 조건, 마당 밖 소품 좌표 검사를 추가했다.
숲·절벽·개별 나무·길·집 배열은 그대로다. 지역 revision5 / 참고문서 v5,
33 MD·21 이미지·14종 오류. 정본 revision11 저장/재조회와 근거는 `verify-shots/household-props/`.

### 사용 목적 개정6 (2026-09-23)

‘집 옆’만으로 배치 목적을 대신하지 않는다. 집 순번 n%4의 묶음 교대를 제거했다.
prop-programs.json에 집별 role/activity/reason과 부품별 purpose/anchor/compact를 저작한다.
기존 밭 돌보기는 실제 밭, 어업 준비는 실제 부두, 목재/완제품 상자는 작업대에 연결한다.
검사에서 실제 기준 대상의 전체 타일과 거리, 소유자의 활동, 접근 가능성을 확인한다.
원형의 꽃 등 필요 없는 장식은 활동에 자동 동반하지 않는다. 활동을 바꾸는 fallback도 없다.
지역 revision6, 공용 문서 v6(33 MD/22이미지), 정본 revision12 저장/재조회.
좌표 검사15종과 활동/세탁/부두/기존 밭/작업대 변조5종의 근거: `verify-shots/prop-purpose/`.

### 공동 공간·정원 개정7 (2026-09-23)

집의 작업 소품 이외에 공동 급수·공지·길 안내·정원·환대·영역 구분을 명시한다.
`civic-programs.json`의 장소별 anchor/purpose/near를 `village-civic-props.mjs`가 완전한 부품으로 배치한다.
우물·실제 밭·부두·길·집과의 관계, 부품 사이 거리, 실제 기준 대상의 배열, 사용칸을 검사한다.
벽등만 빈 상위+하위 벽42..47을 허용하고 문 열 ±1을 피한다. 일반 소품 하위240은 유지한다.
산촌18·절벽18·포구24개 추가, 세 마을 전체25종 사용. 하위와 기존 상위 타일을 보존했다.
지역 revision7 / 공용 AI 용도 civic-v7(38 MD·25이미지·18종 오류), 정본 revision13 재오픈 전체 일치.
새/기존 프로젝트 공급과 저자 편집 보존·브라우저 근거는 `verify-shots/village-civic/` 및 `verify-shots/village-diversity/`.
이는 외관 저작이며 상점·우편·NPC 생활 이벤트·동적 조명은 추가하지 않았다.

### 계단 대지 개정8 (2026-09-23)

사용자 판정: 절벽에 높이가 없다. 원인은 모양이 아니라 **닫힘**이었다 — V자·톱니 끝을 돌아 윗단으로 걸어갈 수 있어
절벽이 둔덕이 아니라 들판의 홈으로 보였다. 참고(큰 폭포 아래 마을)는 절벽이 숲에서 숲까지 이어져 계단으로만 오른다.
- `author-diverse-villages.mjs`: 절벽 각 끝 바깥 4열을 숲 강제 칸 + 길 경로 차단(`cliffs[i].left/right:"open"`로 해제,
  `leftFrom/rightFrom`로 시작 행). 끝에서 「모든 계단을 막으면 윗단 칸에 닿지 않는다」를 단언한다.
- 검증기 `terrace-without-stairs`: 같은 판정을 열린 절벽 끝 좌표로 보고. 고장 예시는 솔바람 서쪽 끝 숲 제거(19종째).
- 윤곽: 솔바람 V자 둘→한 줄+계단3, 층바위 톱니→수평 굽이, 갈대물굽이 오른쪽 끝을 북쪽 숲까지 봉쇄+계단2.
- 문: 1×2 문 위 칸 359→329(같은 시트 바로 위 완전 검정). 문 이벤트 없이 출입구로 읽힌다. 23채.
- 소품: 기본 시트의 온전한 소품 8종을 `extra-parts.json`으로 civic 부품에 추가(벤치·술통·오크통·모닥불·이정표·장작·과일 좌판·3×2 노점).
  전망 쉼터·계단 길잡이·장터·불자리·선착장 짐터·땔감 21곳 46개. 지형이 옮겨 겹친 보존 나무는 자르지 않고 뺀다.
- 지역 revision8 / 공용 AI 용도 `diverse-villages-terrace-v8`(42 MD·26이미지·19종 오류), 정본 revision16 재오픈 전체 일치.
  미편집 civic-v7 은 `previous-reference.json` 기록으로 교체, 저자 편집본은 보존. 근거 `verify-shots/village-terrace/`.
- 후속 판정: 과일 바구니는 사과가 시트보다 큰 배율이라 제외(`extra-parts.json` oversized → 부품 목록에서 제거). 층바위 동굴 입구 삭제.

### 강과 폭포 개정9 (2026-09-23)

네 번째 지역 「두 폭포 강마을」(88×72). 북쪽 숲에서 나온 폭4 강이 한가운데를 흐르고, 숲에서 숲까지 이은 두 줄 절벽에서
폭포로 떨어져 소를 이룬 뒤 남쪽으로 빠진다. 단마다 다리 하나(3개), 절벽마다 양 강둑 계단(4개).
- 비취 대계곡(World 칩셋) 물·물가 = 숲마을 lake_47 과 같은 그림(RGB 비교; RGBA `getbbox` 는 알파만 봐서 거의 전부 「같음」으로 나온다 — 주의).
  폭포 World123·다리 World102/103 만 `tex_easyrpg_chipset_world` 에서 이식(`riverTiles`), 기존 102/103(통나무 벽) 재사용 금지.
- `author-diverse-villages.mjs`: `river{width,points,pools}` 가로 붓, 절벽 교차 열 → 윗선 물 + 면 폭포, 폭포 칸을 오토타일 이웃에 포함(둑 없음),
  맵 밖으로 나가는 강은 가장자리 둑 없음. `bridges` 는 2행, 양 끝 뭍 단언, 끝을 길에 연결, 길 칠하기에서 제외.
- 검증기 `waterfall-gap` 추가(20종). 폭포는 번들 칩셋에 애니메이션이 없어 정지 그림.
- 같은 개정: 과일 바구니는 사과 배율이 커서 부품 목록에서 제거, 층바위 동굴 삭제.
- 지역 revision9 / `diverse-villages-river-v9`(51 MD·28 이미지), 정본 revision18 재오픈 일치. 근거 `verify-shots/village-river/`.

### 컨셉 마을 3종 · 창문 개정10 (2026-09-23)

비취 대계곡 방식의 강·폭포 위에 마을마다 다른 랜드마크를 통째로 세운 지역 3개. 「지역」과 「장소」 두 곳에 모두 나온다(두 폭포 강마을도 장소에 추가).
- 종탑 언덕 교구마을(80×64): 윗단에 스테인드글라스 교회, 외곽에 울타리 친 묘지, 폭포 하나와 소.
- 여울성 나루(100×92): 맨 윗단에 작은 성(42×33) — 「왕궁이 있는 이중 성벽 도시」 내성을 x=49.5 축으로 대칭화하고 같은 열·행만 빼서 줄인 것.
  두 겹 성벽·보행로412·테두리18~20/78/80/108~110·벽면51/81·둥근 탑138~143·층층 궁. 첫 판(성벽 조각을 정면도처럼 쌓은 것)은 사용자 판정으로 폐기. 동쪽 강 폭포 둘, 다리 둘.
- 안개못 폐촌(80×64): 울타리 친 못과 섬 위 석상, 폐가 여섯(깨진 창88·벽 덩굴), 못지기 집 하나(덧문86), 외곽의 잊힌 묘지.
- 랜드마크: `tiledata/forest-villages/diverse/landmarks.json`. 건물(교회 7×9, 성 42×33)은 두 레이어 배열 통째, 마당(묘지·울타리 못)은 울타리 고리
  378/379/380·양옆408·438/439…409/410(호수마을 울타리 마당 조립) + 입구 공백 + 내용물. 영역이 하나라도 겹치면 저작 중단. 문앞·마당 입구는 길 뼈대에 연결되고 접근칸으로 검사.
- 창문 규칙: 집마다 한 종류(`houses[i][3]` = 85·86·87). 84 스테인드글라스는 교회, 88 깨진 창은 폐가 전용. 검사 `mixed-windows`, 랜드마크 막힘 `landmark-sealed`(22종).
- 칩셋 라벨: 84·86·88과 성 조각(윗면21·보행로412·테두리18~20/78/80/108~110·벽면51/81·탑138~143/24/25/54/55·궁 지붕49·정문448/478·안뜰248/276~338·화살 구멍28), 깃발179/209, 덩굴265/295가 원래 라벨·설명이 비어 있었다(이슬여울 집이 쓰던 85/87만 「창문」).
  `tile-labels.json` → 번들 `forestHarmonyTileset.json`과 저작 칩셋. 기존 프로젝트는 `ensureForestHarmonyReferences`가 비어 있는 라벨(또는 설명 없는 「창문」)만 채운다.
- 분류는 둘: `diverse-villages-windows-v10`(52 MD·30 이미지) + `concept-villages-v1`(26 MD·3 이미지). 한 분류당 문서 64개 한도(`REFERENCE_LIMITS`) 때문에 나눴다. (나무 몸통 개정으로 v11·v2, 아래)
- 장소 카드는 `DIVERSE_VILLAGE_PLACES`(id `…-place-W×H`, `regionReferenceId`로 같은 스냅숏을 읽는다).
- 지역 revision10, 정본 revision20 재오픈 일치. 근거 `verify-shots/village-concept/`.

### 판타지 장소 11곳 · 상점·성 내부·마왕성 (2026-09-23)

「장소」에만 나오는 완성 사례 11개(지형·배치만, 문 이동·NPC·상점 이벤트 없음). 정본은 `tiledata/rpg-places/`, 별도 로컬 정본 `.oprn-projects/rpg-places-20260923`.
- 실내(tibo_interior_expanded): 무기점·방어구점·도구점(16×13)·대장간(18×14)·왕좌의 방(24×22)·성 복도(30×11)·마법사 탑 한 층(20×18).
  벽·천장·문은 `interiorRoomPipeline`의 plan→floor→walls 단계 그대로(자동 가구 단계는 안 씀). Tibo 시트 0~479칸은 실내 칩셋과 같은 그림이라 번호를 공유하고,
  소품은 Tibo `structureKits`를 id로 찍는다. 벽걸이는 벽면 윗줄, 키 큰 가구는 맨 윗행을 벽면 아랫줄에, 가게는 카운터 325·326…·327로 상인 쪽/손님 쪽을 가른다.
- 던전(easyrpg_chipset_dungeon): 성 지하 감옥(28×18)·마왕성 왕좌의 방(30×26). 「무너진 납골당」 조립 — 공허 430 + abyss-gray 오토타일, 벽면 22/52 두 줄.
  앱 렌더러는 맵 가장자리 바깥을 공허로 치지 않아 맵 둘레에도 테두리가 그려진다(파이썬 시험 렌더와 유일한 차이).
- 외관(forest_harmony): 상점가(62×15, 여울성 나루 아랫단 집 셋 + 간판·대장간 마당)·폐성(50×38, 여울성의 성 조립을 그대로 두고 바닥·장식만).
  대장간 마당의 화덕·모루 등은 Tibo 칸을 이 맵 타일셋 2730~에 이식. 폐성은 벽을 뚫지 않는다(뚫은 판은 오류 예시 그림).
- 간판 라벨: 627 「청록 화살표 벽표지」→「무기점 간판 — 칼」, 628 방패(방어구점), 629 항아리(도구점). 기존 프로젝트는 옛 라벨 그대로일 때만 바꾼다(`tiledata/rpg-places/sign-labels.json`).
- 분류 셋, 타일셋마다 하나: `fantasy-interiors-v1`(19 MD·7 이미지) → tibo, `fantasy-dungeon-rooms-v1`(8·2) → dungeon, `fantasy-exteriors-v1`(9·3) → forest_harmony.
  `ensureRpgPlaceReferences`가 새 번들 타일셋 생성과 로드 보강 두 경로에서 한 번 넣는다.
- 장소 항목 `FANTASY_PLACE_REFERENCES`(생성 파일), 스냅숏은 한 파일 `regionReferences/fantasy-places.json`(AI 읽기에 필요한 통행·우선순위만 담은 얇은 타일셋).
- 순서: `author-rpg-places.mjs`(통행 검사 포함) → `render-rpg-places.mjs`(dev 서버) → `prepare-rpg-places-references.mjs` → `save-rpg-places.mjs` → `prepare-rpg-places-regions.mjs` → `scripts/qa/capture-rpg-places.mjs`. 근거 `verify-shots/rpg-places/`.

### 기후 마을 · 설원·화산 (2026-09-23)

번들 칩셋 둘 + 「장소」 완성 사례 6개(지형만). 정본 `tiledata/climate-villages/`(README에 재생성 순서), 로컬 정본 `.oprn-projects/climate-villages-20260923`.
- 칩셋: 다양한 마을 타일셋(forest_harmony + 이식, 2730칸)을 한 장으로 구운 뒤 화소만 다시 칠했다(`build-climate-chipsets.py`). 칸 번호·통행·오토타일이 숲마을과 같아
  숲마을 조립·문서를 그대로 쓰고, 숲마을 맵은 tilesetId만 바꾸면 기후판이 된다. 이식은 없다(구워져 있음).
  - `forest_harmony_snow`(2868칸): 잔디→눈, 수관·지붕에 눈, 물은 그대로. 2730~는 물 138칸의 얼음 사본(걸을 수 있음, 폭포 사본만 불통), 오토타일 `forest_harmony_ice_47`.
  - `forest_harmony_volcano`(2730칸): 잔디→재, 잎 그을림, 물 칸 전부 용암(통행 불가 그대로), 나무다리 2701·2702→현무암 다리.
  - 물 판정은 색이 아니라 물 칸 번호 집합이다(색으로 하면 파란 지붕·청회색 성벽이 용암이 된다).
- 타일셋 데이터 `src/assets/climateVillageTilesets.json`(공유 base + 기후별 라벨·얼음 patch), 생성자 `src/project/defaults/climateVillages.ts`.
- 장소: 설원 솔바람 산촌·종탑 언덕 교구·얼어붙은 안개못(못 통째로 얼음 사본), 화산 두 폭포 용암 강마을·잿빛 여울성·용암못 폐촌(화산 봉우리 858/859/888/889 + 918/919/948/949 한 쌍).
- 분류 `climate-snow-villages-v1`(18 MD·3 이미지)·`climate-volcano-villages-v1`(22·3), `ensureClimateVillageReferences`가 한 번만 넣는다(나무 몸통 개정으로 v2, 아래).
- 근거 `verify-shots/climate-villages/`(자료집 카드·AI 행 읽기·내려받기 일치, 편집기 캔버스 실제 로드).

### 사막·가을 기후 + 마을 사이 필드 (2026-09-23)

- 기후 칩셋 둘 추가(`build-climate-chipsets.py`, 설원·화산 시트는 바이트 동일): `forest_harmony_desert`(모래·사암 절벽·마른 덤불·흙빛 지붕, 물은 오아시스 그대로),
  `forest_harmony_autumn`(금빛 풀·단풍 숲·노란 활엽수·붉은 덤불). 둘 다 2730칸, 번호·통행은 숲마을과 같다.
  사막·가을은 숲을 칠하므로 수관 이식(2550~2596)·숲 줄기 조립·layerBacking 잔디까지 칠한다.
- 기후 마을 넷 추가: 사암 층바위 협곡마을·모래 물굽이 포구(나무 → 야자·선인장), 가을 두 폭포 강마을·가을 종탑 언덕 교구(시트만). 분류 `climate-desert-villages-v1`·`climate-autumn-villages-v1`.
  기후 편집은 `scripts/content/lib/climate-edits.mjs`(얼리기·화산 봉우리·사막 식물)로 모았다.
- 마을 사이 필드 7곳(「장소」, placeKind natural, 지형만): 숲 필드 셋(숲속 세 갈래길·여울 건너 벼랑길·두 단 고갯길)과 기후 필드 넷.
  정본 `tiledata/field-routes/`(README에 순서), 로컬 정본 `.oprn-projects/field-routes-20260923`. 출구마다 맞닿는 마을 입구(`meets`)를 적었다.
  분류 `field-routes-{forest,snow,volcano,desert,autumn}-v1`, `ensureFieldRouteReferences`가 번들 타일셋 다섯에 한 번만 넣는다(나무 몸통 개정으로 v2, 아래).
  숲 필드는 이식 포함 forest_harmony(2730칸)로 그렸으니 내려받기의 타일셋을 함께 쓴다.
- 비용: 새 프로젝트 JSON 22.3MB → 25.4MB, 생성 시간 약 +55ms(기후 타일셋 둘 + 필드 문서).

### 나무 몸통 개정 — 잘린 줄기 없애기 (2026-09-23)

숲 윤곽 붓(`forestContour.paintContouredForest`)이 깐 줄기가 반쯤 잘려 보였다. 원인 둘:
- 옛 4칸 마감(LEFT+BODY첫열, BODY둘째열+RIGHT)은 끝 열이 몸통 반쪽이다. 승인된 절벽마을은 그 반쪽을 옆 칸 1617 등으로 덮었는데 붓은 덮개 없이 썼다.
- 밑변 폭이 4·짝수8+가 아니면 span 8 조각이 옆 수관(아래로 이어지는 열) 밑으로 밀려 들어가, 그 수관 외곽 칸의 투명한 가장자리로 몸통이 반만 보였다.

고침(`forestTrunkTiles.ts`): 줄기는 **밑변과 정확히 같은 폭**. w≥6은 LEFT 3열 + BODY 교대 w-6열 + RIGHT 3열(w=6은 LEFT+RIGHT),
w=5 LEFT3+RIGHT 뒤2, w=4 LEFT 앞2+RIGHT 뒤2, w=3 LEFT 앞2+RIGHT 끝, w=2 LEFT 첫+RIGHT 끝(시트를 눈으로 확인). 폭 1만 조립이 없어
`fitBottomEdges`가 그 열 밑변을 이웃 열 높이로 한 칸 올리거나 내린다(바꾸는 칸이 적은 쪽, 같으면 올림). 레거시 격자 숲(`forestGroves`)도 같은 후보를 쓴다.
- 이미 그린 맵은 `scripts/content/refit-forest-trunks.mjs <catalog>`(`refitForestTrunks`)로 제자리 재맞춤 — 수관은 그대로, 바뀌는 밑변만 한 칸. 문앞·입구·이벤트 칸은 보호.
- 다시 맞춘 것: 다양한 마을 7(개정11, 정본 revision21), 기후 마을 10, 필드 7. 옛 결함 필드당 잘린 칸 75~90 + 반쪽 끝 26~34, 마을당 30~50 → 0.
  손으로 마감한 옛 참고 맵(절벽마을·마을 10종·폭포 등)은 건드리지 않았다.
- 분류: `diverse-villages-trunks-v11`·`concept-villages-v2`, `climate-*-villages-v2`, `field-routes-*-v2`. 옛 id 는 정확히 배포본 그대로일 때만 은퇴
  (`tiledata/{forest-villages/diverse,climate-villages,field-routes}/previous-reference.json`, 기록은 `scripts/content/record-previous-references.mjs`). 고친 사본은 남는다.
- 지역 revision: 다양한 마을 11, 기후·필드 2.
- 2026-09-24 후속(사용자: 「여전히 이상함」): 폭 2 조립(LEFT 첫 열+RIGHT 끝 열)은 닫히지만 수관 계단 끝에 가는 뿌리 하나가 매달린 모양이라 뺐다.
  최소 폭 3, 폭 1·2 밑변은 이웃 열 높이로 합친다. 분류 `diverse-villages-trunks-v12`·`concept-villages-v3`·`climate-*-villages-v3`·`field-routes-*-v3`, 지역 revision 다양한 마을 12·기후/필드 3.

