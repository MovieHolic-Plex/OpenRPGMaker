> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# 타일셋 참고문서 — 프로젝트 데이터

## 사용자 경로와 정본

**자료집(데이터베이스) → 맵 → 타일 → 타일셋 선택 → AI 참고문서(첫 화면) → 용도(마을 등) → MD / 이미지**.
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
현재 용도 ID는 `diverse-villages-households-v5`, 문서33개/이미지21개/실제 타일 사전207개다.
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
기하와 defaultAssets 생성자가 공유한다. 새 프로젝트/기존 프로젝트에 등록하며 AI 문서는 forest_harmony를 공유한다.
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
