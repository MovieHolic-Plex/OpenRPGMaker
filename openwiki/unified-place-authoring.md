# 장소 통합 — 구현 및 검증 (2026-09-14)

사용자/AI가 사용하는 저작 분류는 오브젝트·장소·지역·세계다. 방·마당·건물은 모두 장소다.
기존 `library.spaces`와 동결 스냅샷의 키·ID는 저장 호환 구현으로 유지한다.
새 공개 계약에 별도 space 분류를 요구하지 않는다.

## 저작 계약

- 장소 목록·검색·선택에 기존 방/마당/건물을 함께 표시한다. 옛 편집 경로는 장소 하위로
  연결하며 선택한 설계/배치의 ID와 뒤로 가기 상태를 보존한다.
- 새 장소에서 실내·실외·건물을 만든다. 건물은 첫 실내를 포함하며 방 추가·층 추가,
  기존 장소 가져오기, 하위 원본 열기, 층 변경, 구성에서 빼기, 출입 연결 편집을 제공한다.
- 직접 타일과 재료를 칠하는 구성은 같은 지도의 배치다. 「건물로 묶기」는 원래 장소를
  첫 방으로 재사용하는 새 건물을 초안에 만든다. 그 안의 실내 방/층은 각각 별도 지도다.
  문·계단은 명시적인 포트와 연결로 저작한다. 그림이나 포함 관계만으로 연결하지 않는다.
- 두 내부 장소 종류는 같은 재료 목록에서 선택한다. 자기/상위 장소는 제외하고,
  도메인에서도 전체 포함 그래프의 순환을 거부한다. 같은 지도는 타일셋·범위·0층 제약을 따른다.
- 배치 수정은 발급된 초안/미리보기/적용과 기존 소유권 검증을 따른다. 실패한 방 추가는
  이전 초안과 미리보기를 보존하며, 배치된 건물 수정이 원본 레시피를 덮지 않는다.
- AI list/get/upsert/build/context와 legacy concept 발견은 단일 place 계약을 사용한다.
  구형 space 입력은 도구 스키마 검증 전에 호환 변환한다. 직접 구성 타일/재료와 지역의
  직접 장소 참조도 get→upsert→build→save/load에서 보존한다.
- 도구 스키마 증가로 최신 검수 이미지가 먼저 잘리던 요청 예산 처리를 수정했다.
  이전 대화를 먼저 줄이며, 최신 이미지도 예산에 들어가지 않으면 제거한다.
- 현재 root에 직접 구성이 있을 때만 한 캔버스로 시공한다. 하위 방/지역의 그림 때문에
  건물의 층별 지도나 지역·세계 개요 지도를 한 장으로 평탄화하지 않는다.

## 검증 근거

| 범위 | 검사 |
| --- | --- |
| 단일 목록·원본/배치 열기·부모 카메라 복귀 | `test/spatialUnifiedPlaces.test.ts` 6건, `scripts/capture-unified-places.mjs` |
| 생성·취소·검증 실패·적용 | `test/spatialNewPlace.test.ts`, `scripts/capture-new-place.mjs` |
| 방/층 추가·원본 보존·실패 원자성·층 변경/제거·출입 연결 수정/삭제 | `test/spatialPlaceRooms.test.ts` 6건, 기존 `spatialPlacePlacedUi.test.ts` |
| 그림 보존·별도 지도·양방향 연결·재로드·수동 편집 보호 | `test/spatialPlaceComposedFloors.test.ts` 2건, 기존 `spatialPlaceCompiler.test.ts` |
| 같은 지도 재료·중첩·순환 거부·undo·개요 분리 | `test/spatialCompositionWorkspace.test.ts` 4건, `test/spatialMixedComposition.test.ts` 6건 |
| AI 공개 계약·구형 입력·직접 구성/지역 경로 왕복 | `test/spatialPlaceContract.test.ts` 7건, 기존 `spatialTools.test.ts`/`spatialAiContext.test.ts` |
| 지역 편집/탐색 | `test/spatialGeographyActions.test.ts` 23건, 기존 `spatialGeographyCompiler.test.ts` |
| 실제 플레이어 층 왕복 | `npm run qa:runtime -- --scenario unified-place-floors`: 5비트 통과, 런타임 오류 0 |

편집기 캡처는 1440px/1024px에서 실내·실외·건물 생성, 건물로 묶기, 방/층 추가와 적용을
검사한다. 추적 증거는 `.omo/evidence/unified-place-authoring/`에 둔다. 런타임은 전용
`player.html` 하네스를 사용한다. 테스트 fixture만 사용했으며 실제 사용자 프로젝트나
원격 저작 콘텐츠를 만들거나 수정하지 않는다. 기존 원격 저장 경로는 유지한다.

## 최종 판정

코드·위키·편집기 증거를 커밋·push하고 PR #807에 모았다.
전체 `npm run gates`는 21,903건 통과 / 11건 실패로 exit 1이었다.
타입·CSS·브라우저·surface 게이트는 통과했다. 기존 실패/재실행 통과 항목을 분류하고,
새 공개 참조 기대값과 최신 검수 이미지 보존을 보완했다.
보완 후 관련 5파일 92건과 앱 타입 검사가 통과했다. 전체를 다시 전량 실행한 것은 아니다.
실패별 근거와 후속 판정은 `.omo/evidence/unified-place-authoring/verification.md`에 기록했다.
