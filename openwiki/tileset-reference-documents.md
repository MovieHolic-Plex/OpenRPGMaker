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
미작성 레거시 문서에는 기본값을 심지 않는다. JSON/OPRN/SQLite/Supabase tileset JSON 왕복에서 유지한다.
Supabase 별도 테이블 마이그레이션은 필요 없다. `src/project/webExport.ts`는 게임 실행에 필요 없는
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
