# 데이터베이스 UI/UX 적대적 리뷰 (2026-09-19)

편집기 데이터베이스(DB) UI·UX를 GLM 5.3 flash 서브에이전트 **10개 관점**(IA·탐색 / 폼·입력 / 목록·테이블 / 시각·CSS / 피드백·상태 / 접근성·키보드 / 데이터 유실·동시성 / 에디터 일관성 / 성능·응답성 / 카피·용어)으로 적대적으로 리뷰하고, 감독자가 통합·필터링해 남긴 문서다.

## 방법과 신뢰 표기

- 에이전트 10개는 READ-ONLY로 진행했다(테스트·게이트·stash·파일 쓰기 금지 — 루트 AGENTS.md 하드 룰 준수). 총 ~80건의 후보 결함이 수집됐다.
- **감독자 검증 단계에서 후보의 핵심 근거를 소스에서 직접 재확인했다.** 표기 기준:
  - **[직접]** — 감독자가 해당 파일·줄을 직접 읽어 확인 (P0 전부와 P1 대부분).
  - **[에이전트]** — 에이전트가 제시한 file:line 인용을 통합 과정에서 정합성 검토해 채택. 재현 필요하면 수정 전에 해당 줄부터 다시 읽을 것.
  - **[INFERENCE]** — 구조는 확인했으나 결론이 추론인 부분. 착수 전 실측이 필요하다.
- 라인 번호는 2026-09-19 워크트리 기준. 코드가 움직이면 줄보다 심볼·문자열로 다시 찾는다.

### 2차 재검증 (2026-09-19, 같은 날 후속)

P0 8건을 감독자가 소스에서 **다시** 끝까지 이어 확인했고, 그 과정에서 4곳의 과장을 교정했다(P0-1 표기·P0-2 문장·P0-4 가림 범위·P0-5 ellipsis·P0-8 수치·분류). 8건 모두 **코드 사실관계는 유지**됐다. 새로 추가된 것:

- **P0-1은 브라우저 실측으로 확정됐다** — 크로미움에서 `field()` 구조를 그대로 재현해 캡션 클릭이 첫 라디오/칩을 발화함을 확인(아래 표). 프로브: `.playwright-mcp/probe-field-label.mjs`(gitignore, 일회용 — dev 서버 불필요, `setContent`만 쓴다).
- **P0-6은 삭제→저장→로드 체인 전 구간이 이어졌다** — 가드 null → 삭제 진행 → `repairProjectReferences`가 명령은 안 건드림 → `collectProjectReferenceIssues:1145,1194`가 `validateCommands` 수집 → `commandReferenceValidation.ts:322` assert → `validateProjectReferences`가 throw. **추론 구간 없음.**
- **P0-7의 전체 프로젝트 범위도 확정** — `serialize()`(`io/serialize.ts:24`)는 맵 포함 프로젝트 전문 `JSON.stringify`다. 따라서 `isDirty()`·`discard()`가 맵을 포함하는 것은 구현상 필연이다.

**범위**: `src/editor/panels/database*.ts`(약 85개), `src/editor/database*.ts`, `src/styles/database/**`.

---

## P0 — 즉시 수정 권고

### P0-1. `field()` 감싸기 라벨이 첫 번째 라디오/칩을 은닉 발화한다 [직접 + 브라우저 실측]

`databaseControls.ts:384-391`의 `field()`는 컨트롤을 `for` 없는 `<label>`로 감싼다. HTML 라벨 활성화 규칙상 "라벨 안 첫 labelable 자손"에 synthetic click이 전달되는데, button도 labelable이므로:

- `segmentedControl`(`:274-290`)은 라디오 그룹째로 `field()`로 감싼다 → 「대상」 캡션 텍스트 클릭만으로 **첫 라디오가 체크**되어 데이터가 바뀐다.
- `avatarChipRow`(`:327-352`)은 칩 `<button>` 행을 `field()`로 감싼다 → 캡션 클릭이 **첫 배우 칩의 onToggle**을 발화해 `usableActorIds`를 쓴다.
- 같은 파일의 `numericField`는 이 함정을 이미 알고 회피한다(`:376-377` 주석 "a wrapping label activates the first stepper button") — 회피 규약이 존재하는데 두 컨트롤에만 미적용.

**실측 (2026-09-19, 크로미움 + `setContent`, 소스 DOM 구조 그대로 재현):**

| 케이스 | `label.control` 판정 | 캡션 클릭 결과 |
|---|---|---|
| 세그먼티드, 현재값 = **둘째** 옵션 | `INPUT[radio] value=ally` | `onInput("ally")` 발화 + 라디오 뒤집힘 — **은닉 데이터 변경** |
| 세그먼티드, 현재값 = **첫째** 옵션 | `INPUT[radio] value=ally` | 발화 없음 (이미 체크라 change 미발생) |
| 아바타 칩 행 | `BUTTON[button]` | `onToggle("a1", true)` 발화 — **현재값 무관하게 항상** |
| `numericField` 회피 구조 (대조군) | (연결 없음) | 발화 없음 — 회피 규약이 실제로 듣는다 |
| `field()`로 감싼 스테퍼 (대조군) | `BUTTON[button]` | 스테퍼 버튼 클릭 발화 — `:376` 주석의 전제가 재현됨 |

즉 **세그먼티드는 "현재 선택이 첫 옵션이 아닐 때만" 터지고, 칩은 조건 없이 매번 터진다.** 칩이 더 나쁘다(첫 칩이 이미 선택돼 있으면 캡션 클릭이 그것을 꺼버린다).

피해 경로: `databaseItemRecordView.ts:296`(약 계열 '대상'), `:771-774`(허용 주인공 칩) 등 세그먼트·칩 전반.

**수정 시 주의 — `field()`를 일괄로 바꾸면 안 된다.** `toggleSwitch`(`:292-311`)와 단일 input 필드는 같은 래퍼를 쓰지만 거기서는 "캡션 클릭 = 컨트롤 활성화"가 **의도된 동작**이다. 고쳐야 할 것은 컨트롤이 여럿인 그룹(`segmentedControl`·`avatarChipRow`) 둘뿐이고, 방법은 `numericField`와 같은 캡션+`for`/`aria-labelledby` 구조다(위 표의 대조군이 그 구조가 옳음을 보인다).

### P0-2. DB 모달만 modalStack 미등록 — 포커스 트랩 부재, opener 복원 가드 부재 [직접]

- `databaseModal.ts` 전체에서 `registerModal|modalStack|isTopModal|hasOpenModalLayer` **0건**(grep 확인). Escape는 자체 document 리스너(`:410`)로 처리한다. — 단, 이 문장을 "층 인식이 전무하다"로 읽지 말 것: 실제 ESC 핸들러인 `editorModalDirtyState.ts:63`에는 `hasOpenModalLayer()` 가드가 **있다**. 빠진 것은 (a) 자신을 스택에 **등록**하는 것과 (b) Tab 트랩, (c) 아래 opener 복원 가드다.
- 창 모드는 `role="dialog" aria-modal="true"`를 선언(`:220`)하면서 Tab 경계 처리가 없다 → 포커스가 모달 밖(탑바·맵 툴바)으로 샌다. 같은 저장소 규약: 이벤트 에디터 `eventEditor/modal.ts:272`(registerModal)·`:913-932`(installFocusTrap), DB 내부 대화상자들(`databaseEnemyRecordSupport.ts:123-132`, `databaseMonsterResourceEditor.ts:71-77`)은 모두 이행. **셸인 DB 모달만 빠져 있다.**
- opener 복원(`:342-345`)은 열려 있는 다른 모달 층 판단 없이 포커스를 되돌린다. 이벤트 에디터(`modal.ts:419-421`)는 `hasOpenModalLayer()` 가드가 있다.
- 도크 모드 주석(`:488-490` "도크는 모달이 아니다 — 포커스를 가두지 않고")이 창 모드는 가둬야 한다는 전제를 스스로 밝히고도 구현이 없다.

수정: 창 모드에서 `registerModal` + Tab 트랩, opener 복원에 층 가드. `editorModalDirtyState.ts:69-73`의 하드코딩 셀렉터 방어(`tileset-tile-context-menu` 등)와 `modalStack.ts:96-98`의 "DB 모달 등 자체 리스너" 예외 docstring은 이 부채의 증거다.

### P0-3. 도크 모드에서 ESC·단축키 소유권이 양방향으로 깨진다 [직접]

도크는 같은 backdrop 노드에 `is-docked` 클래스만 토글한다(`databaseModal.ts:471-483` — testid/DOM 존재 유지). 그런데:

- (a) **DB 쪽**: document 수준 ESC 핸들러(`editorModalDirtyState.ts:61-74`)에 dockMode 가드가 없어, 포커스가 맵에 있어도 Esc 한 번에 `requestClose("escape")` → dirty면 프롬프트, 아니면 **도크 패널이 통째로 닫힌다**.
- (b) **맵 쪽**: `escapeToPan.ts:57-69`가 `.database-modal-backdrop`의 **존재**만 검사하고(`:102` 무조건 defer-to-owner) 도크 중 Esc로 화면 밀기 진입/선택 해제가 영원히 불가.
- (c) **단축키**: `hotkeys.ts:74`(일반 가드)·`:151`(히스토리 키)도 testid 존재만 보므로 도크 중 맵 도구·레이어 단축키가 전면 침묵한다.

도크의 설계 의도는 "맵 캔버스를 그대로 조작 가능한 보조 패널"(`:397`, `:470`, `dock.css:1-9` 포인터 통과)인데, 키보드로는 모달이냐 비모달이냐를 한쪽으로만 살린다. 수정: docked면 `controller.handleKeyDown` 조기 반환 + ESC/hotkey 판정에 `.is-docked` 배제. 근본 fix는 P0-2의 registerModal 이행.

### P0-4. 저장 실패·비활성 세션에서도 푸터는 영구히 "자동 저장됨" [직접]

- `databaseWorkbench.ts:25-28` — `databaseFooterStatusText()`는 인자 없는 상수 함수(`return "자동 저장됨"`). 모달은 열릴 때 1회 기록한다(`databaseModal.ts:412-417`).
- `databaseModal.ts` 전체에 `subscribeAutoSave` **0건**(grep). store는 autosave 실패 시 error 상태를 발행하지만(`store.ts:1219-1220`) 구독자는 톱바(`menu.ts:396-400`)와 이벤트 편집기(`eventEditor/modal.ts:378-381`)뿐이다.
- 창·최대화 모드에서는 backdrop이 뷰포트 전체를 덮으므로(`tabs-a.part-1.css:297-305` fixed inset:0) 톱바의 autosave 칩이 가려진다 — **그 동안 사용자의 유일한 저장 상태 채널이 거짓말을 한다.** (도크 모드는 backdrop이 투명·포인터 통과라 `dock.css:9` 톱바 칩이 보인다 — 가림은 창 모드 한정이고, 푸터가 거짓말하는 것 자체는 세 모드 공통이다.)
- autosave가 아예 없는 세션(load-failed 폴백·shared-demo 등, `store.ts:1048-1055` 분기)에서는 열리는 순간부터 허위다. `DATABASE_APPLY_BUTTON_HINT`(`databaseWorkbench.ts:32-33`, "편집은 이미 자동으로 반영됩니다")도 같은 전제를 깐다.
- 같은 저장 모델을 쓰는 이벤트 편집기는 자체 푸터에서 autosave 상태를 구독해 반영한다 — 부재가 아니라 DB 모달의 누락.

### P0-5. 푸터 상태 pill에 오류 변형이 없다 — "적용 실패"도 성공 녹색 [직접]

- `studio-theme.css:294-306` — `.database-footer-status`에 `--db-studio-success(-muted)`를 `!important`로 고정 + `max-width:60% + nowrap + ellipsis`. 코드베이스 전체에서 이 요소의 error/danger 변형 rule은 **존재하지 않는다**(스타일 전체 grep 확인).
- `studio-v2.css:185-188` — 상태 점이 `currentColor`(=success 녹색)로 항상 렌더.
- `databaseModalPersistence.ts:17-36`의 실패 문구들("…저장하지 않았습니다", "적용 실패. 메시지를 확인하세요.")은 전부 같은 녹색 pill에 뜬다. 충돌 메시지의 맵 이름 목록은 ellipsis로 잘린다 — CSS(`nowrap`+`max-width:60%`+`ellipsis`, 주석은 "never clipped")는 직접 확인했고, 실제 문구가 60%를 넘는지는 문구 길이에 달렸다[INFERENCE].
- 실패 유일한 색 피드백은 일시적 토스트뿐. 수정: 상태 kind별 변형 클래스 + success 고정 제거.

### P0-6. 삭제 가드가 이벤트 명령 참조를 모른다 — 로드 불가 프로젝트를 저장할 수 있다 [직접]

삭제 시점 참조 검사와 로드 시점 검증기의 커버리지가 어긋나 있다:

- `databaseReferences.ts:97-107` — `battleAnimations`은 actors/classes/skills/items 필드만 검사하고 **`commandLocationMessage` 없이 `return null`** (비교: troops `:110`, equipment `:95`, items `:161`은 모두 호출).
- `databaseCommandReferences.ts`의 command 스위치에 `showAnimation`·`enterHeroName`·`addFollower`·`equipTool` 케이스가 없다(에이전트 근거 `:150-203`).
- 로드 검증기는 하드페일: `commandReferenceValidation.ts:322-324`(showAnimation assert), `:311-314`(enterHeroName assert). `references.ts:34-37` — `validateProjectReferences`는 assert(issues)다.
- 결과: `showAnimation`만이 참조하는 애니메이션을 DB에서 삭제하면 **참조 경고 0건으로 정상 저장**되고, 다음 세션 로드에서 `validateProjectV4` assert 실패로 **프로젝트 전체가 열리지 않는다.** 주인공(enterHeroName/addFollower로만 참조)도 동일. `equipTool`로만 참조되는 아이템은 어디서도 검출되지 않는 dangling 참조로 남는다. `pruneDanglingCommandRefs`(`references.ts:1441-1492`)는 showAnimation을 복구 대상에 넣지 않는다.
- 삭제 UI(`databaseRecordViews.ts:374-412`)는 가드 메시지가 null이면 2클릭 삭제를 그대로 진행한다.

수정: 삭제 가드 스위치를 로드 검증기와 같은 출처(공유 카탈로그)로 맞춘다. 가드·검증기 커버리지 차이를 계약 테스트로 잠그는 것을 권한다.

### P0-7. "열 때 상태로 되돌리고 닫기"가 DB가 아니라 프로젝트 전체를 되돌리고 undo 히스토리까지 절단한다 [직접]

- `databaseModalDirtySession.ts:13-25` — 스냅샷·서명·discard가 모두 **전체 프로젝트** 단위다. `discard()` = `store.replace(structuredClone(snapshot))` + `truncateMapEditHistoryFromMarker(...)`.
- 프롬프트 문구는 "DB 상태로 복구"라고 약속한다(`databaseModal.ts:590`), 버튼도 "열 때 상태로 되돌리고 닫기"(`:567`).
- 도크 모드는 맵 병행 편집을 정식 허용한다(P0-3 참조). 즉 정상 흐름: 도크 열고 → 맵 타일 칠함 → DB 편집 안 했어도 `isDirty()`가 true(전체 서명) → 닫기 → Discard → **맵 편집 전부 소멸 + 해당 undo 엔트리 절단으로 Ctrl+Z 복구 불가**(`mapEditHistory.ts:296-307`).
- 모달의 aiBar로 적용한 AI 맵 변경도 같은 discard에 함께 소멸한다.

수정: discard 범위를 DB 스코프로 한정하거나, 프로젝트 전체 복원임을 문구·경고로 명시 + 히스토리 절단 제거. dirty 판정도 DB 스코프 서명으로 좁힐 것.

### P0-8. 마젠타 크로마키가 썸네일 렌더마다 캔버스 전처리+PNG 재인코딩을 반복한다 [직접 — 단 P1 강등 권고]

> **분류 주의**: 이 항목만 정확성 버그가 아니라 **성능 결함**이고, 아래 임팩트 수치는 측정된 값이 아니다. 구조(가드 무효화·캐시 누락)는 확정이므로 고치되, 우선순위는 P1이 적절하다.


- `chromaKey.ts:26-54` — `applyMagentaChromaKey`의 스킵 가드는 `image.dataset.chromaKeyed`, 즉 **요소 단위**다. 그런데 `databaseRecordThumbnails.ts:136-141`(`imageThumbnail`)은 렌더마다 새 `<img>`를 만들고 무조건 적용한다(주석은 "Equipment icons + enemy battlers"인데 실제로는 전 컬렉션 `<img>` 썸네일에 적용).
- 요소가 매번 새로우므로 가드는 한 번도 적중하지 않고, 보이는 행마다 `getImageData` GPU readback + 픽셀 루프 + `canvas.toDataURL("image/png")` 전 비용을 낸다. 마젠타 픽셀 0개인 투명 PNG/JPG도 조기 종료 없이 전 비용. JPG는 PNG data URL로 교체돼 오히려 커진다.
- 같은 파일의 배경 경로는 이미 해결돼 있다: `getAutoKeyedDataUrl` + `autoKeyedUrlCache`(`:98-108`, URL 단위 메모이제이션). **`<img>` 경로만 빠져 있어 의도와 누락이 구분된다.**
- 임팩트[INFERENCE — 미측정]: 스크롤 윈도우 이동·검색·커밋 리렌더마다 보이는 행 전부 재인코딩. 뷰포트 20~40행이면 커밋 한 번에 수십~수백 ms 스톨로 **추정**한다(프로파일 근거 없음 — 착수 전 실측할 것). 출하 단일 HTML 빌드(에셋이 data URL)에서는 문자열 체급까지 커진다.

수정: URL 키 캐시로 통일(원본 URL → 처리 결과 dataURL Map 공유).

---

## P1 — 빠른 수정 권고

### 목록·레코드

- **P1-1. 주인공 탭 기본 뷰가 가상화를 우회한다** [에이전트] — `databaseRecordViews.ts:135-151`은 actors+list 모드에서 `renderActorStudioList`를 쓰고, `databaseActorStudio.ts:48-58`은 윈도잉 없이 전 행 DOM+썸네일을 append한다(`:94-96` 행마다 `recordListThumbnail`). 기본 뷰가 list인 것은 `databaseRecordViewSession.ts:153-181`. enemies 경로에서 완성된 가상화 계약(`databaseListVirtualizer.ts`)을 주인공 탭이 우회한다.
- **P1-2. 가상화 행 피치 계약이 enemies 1컬렉션에서만 실측된다** [직접] — `databaseListVirtualizer.ts:9` `DEFAULT_ROW_HEIGHT = 24`, `measureRows`는 옵트인(`:76`, `:108-119`). 호출부는 `databaseRecordViews.ts:563` `measureRows: collection === "enemies"` 단 한 곳. 나머지 8컬렉션 리스트는 pitch=24 고정인데 실제 행은 36px+gap(04-modern-records.css:331-344)이라 스크롤 지도가 어긋난다(스크롤바 점프·행 순간이동, 임계값 80 초과 대량 DB에서 발동). 갤러리 pitch 124px 하드코딩(`:66-70` `GALLERY_ROW_HEIGHT`)도 실제 카드 피치(≈98~113px+gap+inset)와 불일치. 수정: `measureRows` 전 컬렉션 확대(구현된 계약 재사용).
- **P1-3. 삭제 후 선택이 뷰포트 밖 첫 레코드로 점프한다** [직접] — `databaseRecordViews.ts:410` `setSelectedRecordId(collection, records[0]?.id)` — reveal 없음. 스크롤은 기존 위치 복원(`:574-586`) → 활성 행 시야 밖, 다음 [삭제] 2단계 확인의 대상이 **화면에 없는 레코드**다. 수정: 삭제 후 `reveal: true` 경로 재사용(교차탭 점프는 이미 이 경로를 쓴다).
- **P1-4. [+ 추가]/[복제]가 reveal 없이 끝에 추가된다 — 필터 하에선 목록에서 완전 소실** [직접] — `:230-247` 두 핸들러 모두 reveal 없음. 신규 아이템 기본 type은 `normalGoods`(`databaseRecordModel.ts:913`)이라 '무기'/'약' 칩 필터가 켜진 아이템 탭에서는 목록에 아예 안 보인다(matchesCategoryFilter 탈락, `:473`). 수정: CRUD 3곳에 `{reveal:true}` + reveal 시 카테고리 필터 초기화(reveal 경로는 검색어만 지운다, `databaseRecordViewSession.ts:101-108`).
- **P1-5. 필터가 선택 레코드를 가려도 삭제는 그 보이지 않는 레코드를 겨냥한다** [직접] — 선택은 `records` 전체에서 find(`:93,173`), 삭제 타깃도 세션 선택(`:375`). list↔detail 상태 불일치 + 파괴 동작의 시야 밖 타깃. 수정: 가려진 선택에 배지 또는 삭제 arm 전 가시성 확인.
- **P1-6. 액터 스튜디오 스크롤 복원이 DOM 부착 전에 실행돼 항상 no-op** [직접] — `databaseRecordViews.ts:149` `listEl.scrollTop = ...` → `:176` `host.append(workspace)`(부착은 그 후). 미부착 요소 scrollTop 대입은 무시됨 → 주인공 탭 스크롤 복원 매번 실패. 가상 경로는 `scheduleFrame`으로 부착 후 복원한다(`:576-585`) — 같은 패턴으로 이동.

### 폼·입력

- **P1-7. numberField는 빈 입력을 매 keystroke 0/min으로 커밋한다(화면은 빈 칸)** [직접] — `databaseControls.ts:172-180` — `Number("") === 0`이 isFinite를 통과 → `onInput(0/min)`. rewrite 조건의 `input.value !== ""` 가드(`:175`) 때문에 화면은 빈 칸 유지 → blur에서야 "0"으로 덮인다. 형제 컨트롤인 sliderStepperField는 빈 input을 무시한다(`:105-107`) — 같은 제스처가 컨트롤에 따라 다른 결과. 피해: 가격 필드 전체삭제→0 커밋(`databaseBasicRecordFields.ts:32,76`), 최소 기부 개수 0 커밋이 보상 조건 소거(`databaseLifeCollectionsView.ts:560`).
- **P1-8. sliderStepperField가 초기 표시를 스텝에 스냅하지만 커밋은 안 한다 — 표시값 ≠ 저장값이 렌더 시점부터 발생** [직접] — `databaseControls.ts:92-95` 표시만 normalize, `onInput` 호출 없음. 모델 계층은 clamp만 하므로(`databaseRecordModel.ts:702-703`) 스텝 배수가 아닌 저장값(percentMax=33, 스텝 5)은 슬라이더에 35로 보이는데 store에는 33 — 아무 입력이나 하면 첫 커밋이 33→35를 조용히 다시 쓴다. 함수 자기 문서(`:63-65` "화면과 저장값이 어긋나지 않게")와 정반대.
- **P1-9. 곡선 다이얼로그의 NaN/빈 값이 피드백 없이 폴백한다** [직접] — `databaseClassCurveEditors.ts:80-89` — 레벨을 비우고 적용하면 `clampDialogInteger(...,1,99)`가 1로 폴백해 **보던 값이 curve[0](Lv1)에 기록**되고 기존 Lv1 값은 파괴된다. 경험치 다이얼로그도 빈 칸 OK→0 확정(에이전트 근거 `databaseClassExperienceCurveEditor.ts:48-50,95-99,175-183`). 어디에도 invalid 피드백 UI가 없다.

### 피드백·상태

- **P1-10. projectSwitch만 유일하게 dirty 프롬프트를 우회한다** [직접] — `databaseModal.ts:311-314` — `change.projectSwitch → close()` 직행(다른 모든 닫기는 requestClose 경유). 편집하다가 모달이 이유 없이 사라진 것처럼 보이고 안내가 0이다. store 측 `reconnectRemotePersistence`도 dirty 가드 없이 current를 교체한다(`store.ts:604-627` — 다른 메서드 둘은 가드 있음; 단, 이 메서드의 프로덕션 호출부는 확인되지 않았다[INFERENCE]).
- **P1-11. 레코드 편집 undo는 Ctrl+Z로 동작하지만 모달 어디에도 노출되지 않는다 — 프롬프트의 "되돌리기"는 전혀 다른(더 파괴적인) 연산이다** [직접] — Ctrl+Z/Y는 살아 있다(`:228-235`), 버튼·안내는 0(푸터 `:435-459`에 없음). 같은 DB의 전투 명령 스튜디오는 가시 undo+status 피드백을 갖춘 전례(`databaseBattleCommandStudio.ts:185-186`). 닫기 프롬프트의 "되돌리기"(`:567`,`:590`)는 세션 전체 복원+히스토리 절단(P0-7)을 가리켜 Ctrl+Z와 범위가 다른데 같은 낱말을 쓴다(`docs/terminology/product-terminology.md:42` shell.undo=되돌리기와도 충돌). 수정: undo 버튼/안내 노출 + 프롬프트 용어 분리(예: "열 때 상태로 복구").
- **P1-12. in-flight flush 진행 중의 Discard가 원격에는 되돌리기 전 내용을 기록한다** [에이전트] — `store.ts:1259-1270` persist는 submit 시점 프로젝트를 고정 전송, discard 이후에도 이전 내용이 저장된다. 로컬 되돌림 상태의 원격 반영은 discard가 건 4초 자동저장(`:218`)에 의존하는데 그 전에 탭을 닫으면 「버린」 내용이 원격 정본으로 확정된다. `dirtySinceLastPersist=true` 경고는 남지만 사용자는 방금 되돌렸기에 경고를 남기지 않을 개연성이 높다. 수정: discard 시 진행 중 flush 취소 또는 완료 후 재 flush 보장.
- **P1-13. 편집 중 재렌더 보류 창에서 캡처된 레코드 객체 합성 patch가 외부 변경을 조용히 덮어쓴다** [직접(보류 창)+에이전트(피해 경로)] — 재렌더 보류는 `databaseModal.ts:250-254,316-320`(400ms grace `:273`). 보류 창 동안 AI 적용(store.replace)·undo가 일어나면 렌더 클로저의 `actor`/`record`가 stale이고, `{ ...actor.critical, enabled }` 같은 합성 patch(`actorRecordView.ts:459-463`, `databaseAdvancedRecordViews.ts:27-31`)는 AI가 바꾼 필드를 옛 값으로 되돌린다. 같은 파일 안에 store 재조회 헬퍼(`actorRecordBattlePanels.ts:158-160` currentActor)라는 정답 규약이 이미 있다. 수정: 합성 patch 계열을 전부 current 재조회로.

### 접근성·일관성

- **P1-14. 탭 레일 a11y 3결함** [직접/에이전트] — (a) 아코디언 그룹 헤더가 `div`+onclick(`database.ts:480-511`)이라 키보드로 그룹을 펼칠 수 없고, `aria-expanded`는 role 없는 div에 붙어 효력 없음(`:316-317`). 접힘 상태가 localStorage에 저장되므로(`:297-303`) 키보드 사용자는 이전 세션에 접힌 그룹의 탭에 영구 도달 불가(검색 2차 결과 우회만 가능 `:731-740,818`). (b) 활성 탭이 `.active` 클래스뿐 — `database.ts` 전체에 aria-current/aria-selected/aria-pressed **0건**(grep), 맵 패널 `mapProps.ts:105-107`은 aria-current="location"을 쓴다. (c) 카운트 배지는 `content: attr(data-count)`인데(`sidebar.css:487-492`) `aria-label=탭이름`(`database.ts:812-818`)이 접근명을 독점해 배지 숫자가 AT에 소거된다 — 같은 화면 필터 칩은 `${label} ${count}개` 규약(`databaseRecordViews.ts:758-761`).
- **P1-15. ESC가 최대화(전체 화면) 창을 복원 없이 곧장 닫는다** [에이전트] — 이벤트 에디터는 첫 ESC가 fullscreen 복원만 한다(`eventEditor/modal.ts:262-271`). DB는 최대화 진입이 버튼·더블클릭뿐(`databaseModal.ts:398-405`)이고 ESC는 곧장 `requestClose("escape")` → dirty 없으면 즉시 닫힘. 최대화는 전면 fixed(`:613-619`)라 '전체 화면에서 ESC 한 번 = DB 통째로 닫힘'. 전체화면 버튼도 단축키·aria-pressed 신호가 없다(비교: `modal.ts:634-637`).
- **P1-16. 선택 가능한 목록 행의 상태 문법 3종** [직접] — 맵 트리 `role=treeitem+aria-selected+roving tabindex`(`mapList.ts:385-402`), DB 대다수 `button+aria-pressed`(`databaseRecordViews.ts:600-603`), 액터 스튜디오 `role=row+aria-selected`(`databaseActorStudio.ts:97-103` — 99-101 주석이 스스로 분열을 기록). 같은 `.db-list-row` 클래스를 공유하는 두 렌더러가 다른 상태 속성을 세운다.

### 정보구조·카피

- **P1-17. spatialSpaces(「장소 편집」)는 자유 텍스트 검색이 유일한 진입로다** [직접] — 레일 그룹에서 제외(`database.ts:191`), 부모(장소) 탭 관련 편집 바에서 명시 제외(`:1203-1206`), 셸 내부 전환기 없음(`spatialStage.ts:114-243`). 정보구조 스스로 spatialPlaces를 부모로 선언(`:197`)해 놓고 그 부모에서 오는 링크만 막아 자기모순. 형제 facet `terrain`은 링크가 살아 있어(`:1199-1206`) 형제 간 처우도 불일치. 검색 alias(`:707`)로만 발견된다.
- **P1-18. 같은 목적지가 표면마다 다른 이름으로 불린다** [직접] — 카탈로그 라벨 vs 검색 alias vs 워크스페이스 섹션이 이명: 「오토타일 설정」/「자동 연결 구성」/「자동 연결」(`database.ts:145,700`+`tilesetUsageGuide.ts:44`), 「미분류 모아보기」/「타일 설명…」/「타일 설명」(`:146,701`+`:45`). 토스트가 가리키는 「구조물 탭」은 실존하지 않는다(`structurePlacementContextMenu.ts:202-204` vs 레일 「오브젝트」/카탈로그 「부품 보관함」). 개요 통계 칩 「몬스터」·「장비」·「등장인물」은 도착 탭 레일 라벨(전투 몬스터/아이템·장비/주민 관계)과 다르다(`databaseOverviewView.ts:35,36,94` + `database.ts:131,138`). tilesetAutotile/tilesetUnlabeled는 크럼브에서 자기 이름을 버려(`databaseTabPath:239`) 검색 진입 시 위치 확인이 불가하다.
- **P1-19. DB 창 제목이 jargonStyle 시스템을 우회한다 — 초보 모드에서 자료집↔데이터베이스 분열** [에이전트] — `databaseModal.ts:208`(h2 "데이터베이스" 하드코딩) vs `uiCopy.ts:37` 정본(`plain: "자료집"`) — 명령 팔레트는 `uiLabel`을 실제로 소비한다(`commandRegistry.ts:156`). 도움말 문서는 [자료집]을 말한다(`helpModal.ts:190`). 토스트에도 하드코딩(`databaseCharacterView.ts:162`). 뷰 산문 5곳에 스키마 식별자 `characterId` 원문 노출도 동일 계열(`databaseCharacterView.ts:60,61,346,368,787`; 대조: 적 탭은 「진영 ID」로 한국어화 `databaseEnemyRecordView.ts:241`).
- **P1-20. DB 푸터 "도움말" 버튼이 도움말을 열지 않는다** [직접] — `databaseModal.ts:454-459` — 클릭 결과가 동어반복 토스트("데이터베이스에서 레코드와 시스템 설정을 조정합니다.") 전부, testid도 없다. 실제 DB 도움말 문서는 존재한다(`helpModal.ts:181-190`). 수정: helpModal의 DB 섹션을 열게 한다.
- **P1-21. 안내가 존재하지 않는 '+ 장비' 버튼을 가리킨다** [직접] — `databaseItemRecordView.ts:257`(기본 카드 안내) — 실제 라벨은 공용 툴바의 `"+ 추가"`(`databaseRecordViews.ts:227`). 같은 제품의 다른 안내는 정확히 인용한다(`databaseRecordViews.ts:542` "아래 '+ 추가'로").
- **P1-22. 상태 0개일 때 '+ 상태 추가'가 이유 없이 무음 비활성화된다 (스킬·아이템·주민 3곳)** [에이전트] — `databaseSkillRecordView.ts:483-497`, `databaseItemRecordView.ts:366-380`, `databaseCharacterView.ts:704-707` — disabled만 있고 이유 없음. 코드베이스 자신의 원칙("잠금은 `disabledReason`을 같이 준다", `databaseControls.ts:26-29`)과 정상 사례(`databaseEnemyRecordView.ts:768,825-832` "[상태] 탭에서 상태를 먼저 만드세요.")가 이미 있다.
- **P1-23. studio-theme.css가 모달 크롬 전체를 `!important`로 점거해 후행·선행 시트를 침묵시킨다** [직접] — `studio-theme.css:248-253,278-292` — 창·헤더·푸터 크롬이 `!important`. 피해: `05-dense-workbenches.css:46-50` sticky 푸터는 `position: static !important`(`:290`)에 사사(`:291` z-index:3은 static에 무효 선언), `enemies.part-2.css:19-25`·`desktop.css:105-110` 구세대 창 크롬 전부 사사. 시트 스스로 래칫을 기록한다(`:344` "!important 개수는 그대로다(예산 래칫)", `studio-v2.css:12-14`). 수정: !important를 떼고 문서 순서로 승부 + 이미 사사한 구세대 규칙 삭제.
- **P1-24. 같은 인터랙션에 두 가지 빨강·경고 — 토큰 밖 rgba 리터럴이 게이트 사각지대로 살아있다** [직접] — `workspace-modern.css:571` 배경은 Tailwind red-600 틴트(rgba(220,38,38,.1)), 테두리·글자는 스튜디오 danger(#B91C1C) — 한 요소 안에서 색 패밀리 분열. `:676-684` notice-warn/bad도 rgba 리터럴(180,83,9 / 220,38,38). 같은 의도를 `studio-v2.css:36,1138`은 `color-mix(var(--db-studio-danger))`로 수행. `check-css-budget.mjs`의 hexLiterals 게이트는 rgba를 못 잡는다(스크립트명 그대로 hex 한정). 월드 lint 항목은 배경(올리브)+글자(앰버) 혼용(`from-editor-world-panel.css:663-666`). 수정: color-mix 치환 + light-theme 크림 시대 `--danger-muted/--warning-muted` 오버라이드(`light-theme.css:30,53`) 정리.

---

## P2 · P3 — 계획 수정·정리 (컴팩트 목록)

### 폼·입력
- **P2** 곡선 다이얼로그 2종(`db-class-*-dialog`)이 `document.body`에 붙고 Tab 트랩 없음(`databaseClassCurveEditors.ts:144-145`, `databaseClassExperienceCurveEditor.ts:130-131`; registerModal의 keydown은 Escape뿐 `modalStack.ts:28-37`) — 표준 `ui/modal.ts:96-115`에는 trapTab이 있다.
- **P2** 죽은 2세대 폼 함수군(`itemFields/enemyFields/troopFields/animationFields/skillPicker`, `databaseBasicRecordFields.ts`)이 외부 호출자 0으로 잔존 — 내부에 데이터 파괴 경로(learnedSkills 통째 단일화 `:153`, classes 읽기/쓰기/정규화 3자 모순 `:154,162`)를 품는다. 재배선 시 발화 예정 함정. 삭제 권장.

### 목록·성능
- **P2** 검색/칩 리렌더가 선택 레코드의 디테일 폼까지 통째 재구축(`databaseRecordViews.ts:173,429-434`).
- **P2** `restoreFocusAfterRerender`가 커밋마다 8프레임 전역 `[data-testid]` 스캔(`databaseWorkspace.ts:205-224`).
- **P2** 적 탭 가상 목록이 스크롤마다 write→read 강제 동기 layout(`databaseListVirtualizer.ts:104-119,156-159`).
- **P2** `autoKeyedUrlCache` 무제한 성장(키/값 모두 data URL 전문, `chromaKey.ts:98-142`).
- **P2** 얼굴/애니메이션 썸네일 이중 `<img>` 로드(`databaseRecordThumbnails.ts:75,126,168-175`).
- **P3** `database.ts:525-528` 헤더 ResizeObserver에 disconnect 부재(누수 단정은 불가 — GC 가능성 배제 못 함).

### 피드백
- **P2** `applyDatabaseChanges`의 non-Error 재던지기 + 호출부 3곳 전부 rejection 미소비(`databaseModal.ts:366-368,389,448-451`) → "변경 내용을 저장하는 중입니다." 영구 정체 가능. 트리거 조건은 추정[INFERENCE]이지만 구조적 구멍은 실증 [에이전트].
- **P2** 유틸리티 탭 선택 상태줄이 죽은 경로 — `db-workbench-status` testid 요소가 코드베이스에 존재하지 않음(생성부 0건, grep 확인; 소비부만 `databaseUtilityRecordControls.ts:124-128`).
- **P3** AI 바 「이동 →」이 유효하지 않은 컬렉션에서 조용히 무시됨(`databaseModal.ts:180-189`; 같은 실패의 다른 경로는 footerStatus/toast 관례).

### 접근성
- **P2** inspectorTabs가 role=tab/tablist만 선언하고 방향키·roving tabindex·tabpanel 연결 없음(`databaseWorkspace.ts:365-409`).
- **P2** dirty 프롬프트가 결정 대화상자인데 role=alertdialog·포커스 진입·라이브 영역 모두 없음(`databaseModal.ts:426-429,559-570`; 표준은 `databaseEnemyRecordSupport.ts:136`).
- **P2** 리소스 피커 검색 input이 placeholder 전용 라벨링 — 형제 검색 input 전부 aria-label을 쓰는데 이 파일만 빠짐(`databaseResourcePickerDialog.ts:74-78`).
- **P2** segmented radiogroup에 접근명 없음 + 외부 감싸기 라벨과 내부 pill 라벨의 중첩 label(`databaseControls.ts:273-290`).

### 시각·CSS
- **P2** sidebar.css 도크 48px 규칙(`:592-595`)이 두 레짐 모두에서 도달 불가한 죽은 코드 — 자기 파일의 !important 220px/56px 규칙(`:92-95,172-184`)에 항상 사사. `.db-tab` 34px/32px 이중 지오메트리도 공존(`:97-105` vs `:443-462`).
- **P2** 가독성 바닥 11.5px가 40여 개 클래스 화이트리스트(`studio-theme.css:139-187`)로만 강제 — 화이트리스트 밖 라이브 11px 토글·10.5px 버튼·9px 배지 4곳 이상(`workspace-modern.css:354-362,756-766`, `core.part-2.css:48`), 같은 파일이 자기 WCAG 하한 선언(`:26-32`)과 모순.
- **P2** 같은 모달 내부를 `@container(db-modal)`과 `@media(뷰포트)` 두 축이 제어 — 브레이크포인트 14종 공존, 동일 블록 수동 복제(sidebar.css 5곳, workspace-modern.css:694-706; 과거 드리프트 사고 전례 주석 `sidebar.css:115-116`).
- **P2** 트룹스 목록 행 — 두 세대 규칙이 절반씩 승리해 활성 마커와 텍스트가 같은 x(10px)에 겹침(`desktop.css:288-314` vs `studio-v2.css:366-371,1581-1585`).
- **P3** 크림 시대 색이 죽은 규칙(actors.css:1149-1150, 03-class-panels:514-515)과 라이브 규칙(core.part-2.css:44-48)으로 분류돼 잔존, 탭마다 다른 백드롭 스크림(tabs-a.part-1.css:298 vs enemies.part-2.css:15-17).
- **P3** DB 모달 백드롭 z-index 900 하드코딩 — z-사다리 SoT `--z-app-modal: 2600`과 계약 기술 불일치(tokens.css:129,146-152; tabs-a.part-1.css:304).

### 데이터 유실
- **P2** 상태(states) 삭제 가드가 actors/classes/enemies의 `stateRates` 참조를 검사하지 않는다 [직접] — `databaseReferences.ts:163-176` states 케이스는 stateEffects/items/equipment만 보고 `commandLocationMessage`도 호출하지 않는다. `stateRates`는 실제 등급 데이터(`types/database.ts:53,106,430`)라 삭제된 상태 id 키가 저장본에 영구 잔류. P0-6과 같은 뿌리의 states 인스턴스.

### IA
- **P2** 같은 탭 이동 경로마다 상태 보존 계약이 다르다 [에이전트] — 레일 클릭은 캐시 재활용(`database.ts:820-829,944-950`), 프로그램 점프(개요 칩·AI 카드)는 `forceFresh`로 캐시 통째 폐기→스크롤 리셋(`:531-540,940-943`), 맵 그룹은 레일 클릭이어도 항상 evict. 개요 칩이 「해당 탭」이라 부르는(`databaseOverviewView.ts:125`) 목적지로 보내놓고 돌아오는 길의 상태가 사라진다.
- **P2** 「게임 개요」의 클릭 가능한 요약은 전투 9컬렉션뿐 [에이전트] — `STAT_COLLECTIONS`(`databaseOverviewView.ts:30-40`) 전부 전투 측. 생활 7탭/맵 5탭/시스템 8탭의 저작량은 개요에서 0처럼 보인다.
- **P3** 첫 화면(기본 탭 actors, `database.ts:1165-1173`)과 개요의 자기 서술(「시작 지점」, `databaseOverviewView.ts:92-96`)이 서로 다른 답을 준다. `setDatabaseActiveTab("overview")` 호출부가 코드베이스에 없다.
- **P3** 크럼브가 「시스템 › 시스템」을 출력 — 그룹명과 탭명 동일어(`database.ts:161,192` + `databaseModal.ts:70-85`).
- **P3** 활성 탭 localStorage 저장(`database.ts:434-435,392`)만 try/catch 없음 — setItem 예외 시 탭 전환 자체가 중단된다(같은 파일 `:297-303`은 이미 방호).

### 일관성
- **P2** 동명 컨트롤 팩토리 3개 시그니처 — `textControl`이 (label,value,testid?) / (label,testid,value) / (label,testid,value)로 갈라져 있다(`databaseControls.ts:15-20` / `actorRecordControls.ts:138-141` / `databaseLifeCraftingView.ts:1313-1317`). 부수로 db-field-* 규약 부재 필드: 시스템 탭 타이틀 화면 문구 5개(`databaseSystemView.ts:1523-1775`), 캐릭터 뷰 2곳(`databaseCharacterView.ts:548-551,759-762`).
- **P3** 모달 창 닫기(X) 글리프 이중 소유 — 동일 path 데이터 복제(`databaseModal.ts:60` vs `editorIcons.ts:87`), 렌더 체계도 분리(.ee-icon vs .database-modal-icon).
- **P3** 「⋯ 더 보기」 오버플로 마크업 3종 공존(details/summary `spatialStage.ts:199,379` / 플레인 button `databaseCharacterGraphicsView.ts:231` / sectionCard 접힘 `databaseEnemyRecordView.ts:372-376`; 공용 부품 `toolbarOverflow.ts:28-36`는 클래식 툴바 전용).

### 기능 공백 (결함 아님 — 기록용)
- 레코드 목록 정렬 UI가 없다(저장 순서 고정, `databaseRecordViews.ts:461-479`).

---

## 카피·용어 일관성 (P1-2건 제외 나머지, 표로 압축)

원칙은 코드 자신이 선언한다: "라벨은 한 곳에서만 정의한다… 문자열을 새로 적으면 다시 갈라진다"(`uiCopy.ts:86-87`). 아래는 그 원칙 위반의 실측 목록 [에이전트]:

| # | 위치 | 비대칭 |
|---|---|---|
| C1 | `databaseItemRecordView.ts:806-811` vs `:158-162` | 같은 소모 상태가 「매회 1개 소모」/「사용할 때 1개 소비」로 동시 렌더 (+소모/소비, 한 개/1개 혼용) |
| C2 | `databaseSkillRecordView.ts:325` / `databaseControls.ts:410-411` / `database.ts:138` | enemies가 몬스터/적/전투 몬스터/enemy 4명칭 분열 — "enemy로 전투" 형태소 혼용 5곳(`databaseEnemyRecordView.ts:166-317`) |
| C3 | `databaseCharacterView.ts:658-660` vs `:744-749` | 같은 선물 키가 「좋아하는 선물 (loved)」/「loved 반응」/「이미 선물함」 3표기 |
| C4 | `databaseSkillRecordView.ts:153` + `databaseControls.ts:427,528` | 급소율 드롭다운에 「일반」과 영어 원문 「high」가 나란히 노출(literalLabel 미등록→원문 반환) |
| C5 | `databaseMonsterSpeciesView.ts:109-111` + `databaseCopy.ts:19-22` | 같은 복제 동작에 복제/복사/사본 3낱말 (적 탭은 「행 복사」) |
| C6 | `databaseMonsterSpeciesView.ts:294` / `databaseCropView.ts:157` vs `databaseEnemyRecordView.ts:498` | 탐색 실패 토스트가 「해당 탭」이라며 탭명을 숨김 — 같은 실패의 다른 뷰는 탭명+레코드까지 말함 |
| C7 | `databaseSkillRecordView.ts:111` / `databaseSystemView.ts:905` | 사용자 노출 문자열에 개발 용어 「클램프」「tick」 무설명 |
| C8 | `databaseControls.ts:402-531` vs `databaseItemRecordView.ts:67-79,273` | selectLiteral 단일 라벨 표(literalLabel)가 `ITEM_TYPE_LABELS`에 의해 렌더 후 DOM 재작성으로 덮어씀 — seed/switch 라벨이 이미 양쪽에서 불일치 |
| C9 | `databaseAiBar.ts:348,364,455` vs `delayedTooltipRollout.ts:31-36` | 같은 조수가 톱바에선 「조수」, DB 창에선 「AI 어시스턴트」 — 용어집 정본(조수) 위반 |

---

## 통합(중복 제거) 기록

동일 결함을 여러 관점이 잡은 쌍 — 문서에서 하나로 합쳤다:

1. 포커스 트랩 부재: A11Y 렌즈 A11Y-01 ≡ 일관성 렌즈 C1 → P0-2.
2. 도움말 토스트 스텁: 카피 COPY-01 ≡ 일관성 C8 → P1-20.
3. 도달 불가능한 두 번째 빈 상태 블록(`databaseRecordViews.ts:494-531` 살아있음 / `536-554` 도달 불가, role="status"+testid `db-list-empty`가 죽은 경로에만 존재 — CSS 주석(`desktop-record-shell/14-party-ux-fixes.css:149-152`)도 죽은 경로 전제): 성능 렌즈가 발견→일관성 렌즈가 직접 검증·수용, 목록 렌즈 F6과 동일 → 아래 "정리"로 수록. **P3 정리: 536-554 삭제 또는 494 분기와 병합해 role=status 이관, CSS 주석 갱신.**
4. "되돌리기" 이중 의미: 카피 COPY-03 ≡ 피드백 F4 후반 → P1-11.
5. `field()` 래퍼 라벨: 폼 FORM-01 ≡ 접근성 A11Y-06/07 → P0-1.
6. AI 바 무반응 이동: 피드백 F7 ≡ IA-10 → P3.
7. 성능 렌즈↔목록 렌즈는 hub 메시지로 상호 검증을 이미 수행(레코드: 두 에이전트 트랜스크립트).

## 기각·보류

- **기각** — 탭 카운트 주석 어긋남(주석 「29개」 vs 실제 49개): 사용자 노출 0건의 코드 코멘트. (에이전트 스스로 보고에서 제외했고 통합에서도 유지.)
- **보류** — perf 렌즈의 `database.ts:525-528` ResizeObserver disconnect 부재: 관찰 대상-옵저버 GC 순환이 브라우저에서 수거 가능한지 검증 불가 → P3로만 기록.
- **보류** — 피드백 F5( non-Error 재던지기)의 실제 트리거 조건: store 내부 구현 의존적[INFERENCE] → 구멍 자체는 P2로 채택하되 트리거 명증이 선행.
- **기각 아님, 분류 이동** — 「정렬 기능 부재」: 코드 결함이 아니라 기능 공백이므로 별도 섹션으로.

## 감독자가 확인한 "클린" 판정 (오보 방지용)

10개 에이전트가 의도적으로 공격했으나 결함으로 입증되지 않은 항목 — 회귀 시 이 목록부터 다시 확인:

- **undo 커버리지**: DB의 모든 쓰기 경로(update/add/duplicate/delete/시스템 뷰/생활·종족·농장 뷰/worldCanon/세계관 카드)가 recordProjectSnapshot/recordCoalescedSnapshot을 통과 — undo 불가 편집 경로 없음 [에이전트, databaseActions.ts:85,154,236,350,388 등].
- **복제 안전성**: `duplicateInto`는 structuredClone 깊은 복사(`databaseCopy.ts:9`) — 사본-원본 공유 참조 없음.
- **AI 적용 경로**: stale-base 게이트(`aiProposalCard.ts:280,369-371`), 파괴적 맵 변경 확인 모달(`:259-276`) 존재 — AI-vs-폼 충돌은 반려로 처리.
- **프로젝트 전환 유출 없음**: projectSwitch 시 모달 즉시 닫힘(`databaseModal.ts:311-314`), flush는 lineage 불일치 시 결과 불채택(`store.ts:1296`).
- **flush 실패 시 모달 유지**: 열림 유지·markClean 안 함(`databaseModal.ts:359-361`), autosave 재시도/healthCheck 존재.
- **입력 재렌더 가드**: 편집 중/400ms grace 재렌더 보류+pending flush(`databaseModal.ts:250-320` — 직접 확인), 검색 디바운스 80ms/90ms 존재(`databaseRecordViews.ts:429-434` — 직접 확인).
- **타이머/리스너 누수 부재**: searchRerenderTimer 단일 리셋, ARMED_DELETE disarm, graceFlushTimer clear, document keydown close에서 remove — 모두 직접 확인.
- **썸네일 실패 대체 견고**: error 핸들러+1×1 probe+공용 플레이스홀더(`databaseRecordThumbnails.ts:137,168-185` — 직접 확인).
- **저수준 프리미티브 a11y 양호**: 네이티브 button+aria-pressed(레코드 행/칩/토글), numberField 라벨 for/id 회피, 리스트 썸네일 role=img+aria-label, 중첩 다이얼로그는 registerModal+Tab 트랩 준수, :focus-visible 링 정비 [에이전트, 검증 인용 포함].
- **빈 상태 원인·대처의 모범 사례 존재**: 검색 결과 없음+「필터 지우기」 CTA(`databaseRecordViews.ts:494-531` — 직접 확인), 적 뷰 결손 noticeBar(`databaseEnemyRecordView.ts:239-255`) — P1-22 등은 "이 모범과의 대비"로 입증된다.

## 권고 순위 (수정 착수 순서)

1. **P0-6 + P2(stateRates) — 단독 1순위.** 나머지 7건은 UX 손상이지만 이것만이 **사용자 저장본을 복구 불가로 만든다**(삭제 시 경고 0 → 다음 로드에서 프로젝트가 안 열림). 가드·검증기 커버리지를 공유 출처로 수렴 + 계약 테스트로 잠근다.
2. **P0-7 + P1-11 + P1-12** — discard 범위/용어/flush 직렬화를 한 번에. 도크 모드가 맵 병행 편집을 정식 허용하는 이상(`dock.css:9`) 맵 편집 소실은 예외가 아니라 정상 흐름에서 난다.
3. **P0-2 + P0-3 + P1-15** — DB 모달을 modalStack으로 이관하면 세 건이 함께 닫힌다(트랩·ESC 소유권·최대화 복원).
4. **P0-4 + P0-5** — autosave 상태 구독을 DB 모달 푸터에 연결(이벤트 편집기 구현이 그대로 전례) + 오류 변형 클래스.
5. **P0-1 + P1-7/8/9** — 컨트롤 프리미티브 일괄(numericField 회피 규약을 **segmented/chip 둘에만** 적용 — `toggleSwitch`는 건드리지 말 것, 빈 입력 커밋 규약 통일).
6. **P0-8(P1로 강등) + P1-1/2** — 썸네일 URL 캐시 + 가상화 measureRows 전 컬렉션 + 액터 스튜디오 편입. 착수 전 재인코딩 비용을 한 번 실측할 것.
7. 나머지 P1(CSS·IA·카피)은 표면 단위 배치 작업으로.
