# 50 에이전트 적대적 리뷰 — 이벤트 에디터 × 데이터베이스 (2026-09-20)

- **스쿼드**: 이벤트 에디터 파인더 20 + 데이터베이스 파인더 20 + 적대적 검증관 10 = **50 서브에이전트**
- **모델 실측**: 세션 기록(`~/.omp/agent/sessions/…`) 50개 파일 전부 `zcode/glm-5.3-flash` — 지정 모델 50/50 확인
- **방식**: 1차 발견 40개(스코프 비중복 분할) → 전 항목 검증관 배정(적대적 반박) → 감독자 표본 재검증 6건
- **결과**: 1차 발견 **615건** + 검증관 추가 **15건**. 반박 결과 **실재 607건**(critical 10 / high 100 / medium 272 / low 225), 기각 6, 보류 24, 관리자 표본 재검증 5/6 완전 확인·1/6 단서 부착

---

## 1. 요약

두 영역의 결함 분포가 뚜렷이 다르다.

- **이벤트 에디터(305건)** — "저작은 되는데 게임이 다르게/안 된다"가 핵심. 편집기 폼이 커밋하는 값과 런타임 인터프리터가 읽는 값의 **계약 불일치**(playMovie 토글 반전, setLighting 해석 반전, removeFollower 무음 확대, 조건 행 스왑)와 **M2 명령의 죽은 실행 경로**(기록만 하고 소비자가 없는 7종)가 대표.
- **데이터베이스(310건)** — "편집기가 허용하면 로더가 벽돌"이 핵심. **삭제 가드↔로드 검증의 커버리지 어긋남**(가드가 안 보는 축을 검증은 하드 실패 처리 → 삭제 한 번에 프로젝트 재오픈 불가)이 critical 10건 중 9건. 그리고 **AI 툴의 얕은 병합**(부분 수정이 통째 교체로 작동해 기존 데이터를 조용히 리셋)이 새 결함군으로 확인.

공통 테마 3개는 두 스쿼드가 독립적으로 발견해 교차 확인됐다:

1. **저장 가능 ≠ 로드 가능** — 편집기 쓰기 경로가 로더 불변식을 위반하는 값을 그대로 저장한다.
2. **한국어 저작 ↔ 영어 런타임 정규식** — 상태이상·전투 계약의 언어 분리.
3. **AI 도구가 사람 경로의 가드를 우회** — 사람 삭제는 막히지만 `prune_unused`·`delete_craft_recipe` 등 AI 경로는 통과한다.

---

## 2. 시그니처 결함 10선 (감독자 선별, 교차 중복 병합)

| # | 심각도 | 결함 | 위치 | 항목 |
|---|---|---|---|---|
| 1 | critical | 아이템 삭제 가드가 `crops.seedItemId/harvestItemId` 참조를 안 본다 — 삭제 후 `validateCropRecords` 하드 실패로 재오픈 불가 | `src/editor/databaseReferences.ts:116-167` | DB-03-1 |
| 2 | critical | 생활·날씨·축사 폼이 로더 불변식(정수·범위·FK) 위반 값을 저장 — 예보 일수 `2.5` 입력만으로 재오픈 실패 | `databaseLifeCollectionsView.ts`, `databaseDailyWeatherView.ts:339`, `databaseFarmAnimalsView.ts` | DB-14-1~4 |
| 3 | critical | 상태이상 저작 한국어 ↔ 런타임 영어 정규식: "전투 종료 후 유지"가 역전(전투 종료 시 해제), "행동 불가" 등 제한 5종 중 다수 죽은 필드 | `src/battle/battleStates.ts:102-105`, `databaseStateRecordView.ts:19-20` | DB-04-1/2, DB-09-1, DB-18-2~8 |
| 4 | critical | AI `prune_unused`가 참조 중인 아이템/트룹/적을 «미사용» 오판 삭제; AI 삭제 경로가 사람 삭제 가드를 우회 | `src/editor/tools/refactorTools.ts`, `lifeEconomyTools.ts` | DB-06-3, DB-06-10 |
| 5 | high | playMovie 폼 토글이 런타임 기본값(`wait!==false`)과 반대 표시·저장 — "아니오"를 골라도 대기·스킵 허용 | `commandBodyPage3Native.ts:1004-1075`, `commandCatalog.ts:927-928` | EE-07-2, EE-13-2/3 |
| 6 | high | M2 명령 7종이 저작·피커 노출은 되지만 소비자가 없다(변수 위치 이동·맵 그림 세트·이벤트 플래시·애니메이션 표시·랜덤 전투 빈도·지역 트리거·순간이동 금지) | `src/player/interpreter/m2Runtime.ts` 외 | EE-10-3~8, EE-V3-A1/A2 |
| 7 | high | AI `upsert_*` 얕은 병합 — 미전달 중첩 필드(stats·rewards·equipmentProfile·levelUpRewards)를 통째 교체해 조용히 리셋 | `src/editor/tools/dbTools.ts`, `lifeSystemTools.ts`, `worldCanonTools.ts` | DBV-A1, DB-V3-A2, DB-09-9, DB-14-6~8, DB-11-2 |
| 8 | high | 이벤트 페이지 편집이 데이터를 파괴한다: 페이지 중간 삽입으로 앞 조건 페이지 사망, NPC destinations 1개로 절단, 조건 행 편집 시 스위치 슬롯 서로 교환 | `src/editor/eventPages.ts`, `pageNpcLiving.ts`, `pageConditions.ts` | EE-09-1/3, EE-08-1 |
| 9 | high | AI 제안 «검토 대기» 초안의 수명 계약 붕괴 — 어떤 표면에도 복원되지 않거나, 결정 없이 다음 턴에 통째 적용, undo 표면이 공유 스택 top을 무조건 pop | `src/editor/panels/aiChatPanel.ts` | EE-15-1/2/3, DB-15-1/2 |
| 10 | high | 편집기 폼↔런타임 반전군: 「이벤트 삭제」가 항상 자기 자신을 지우고, setLighting 프리뷰는 ambient를 밝기로 반대 해석, 조명·showPicture 프리뷰는 scale/opacity 미적용 | `commandCatalog.ts`, `commandPreview.ts`, `previewPicture.ts` | EE-10-1, EE-13-1/6 |

**메타 발견(문서-코드 간극)**: 위키의 «보정 완료» 주장 중 최소 4건이 코드에 반영돼 있지 않다 — U04 Native media flags(EE-13-3/4), AI 명령 assist 보정(EE-14-2), 이동 계열 금지 토큰(EE-19-1), `delete_craft_recipe` 가드(DB-06-10). 위키는 날짜가 최신이어도 소스가 이기는 저장소 규칙대로, 이 항목들은 위키 수정 또는 코드 완성이 필요하다.

---

## 3. 방법론과 검증 신뢰도

### 3.1 파이프라인

1. **스코프 분할** — 이벤트 에디터 20개 / 데이터베이스 20개 렌즈(창 셸, 명령 폼, 조건, 인터프리터 계약, 직렬화, 검증, AI, CSS, 성능, 접근성, 용어 … / 30탭 셸, 레코드 모델, 필드 셰이프, 참조 무결성, 탭별 스튜디오, AI×DB, 원격 지속성, 런타임 계약, CSS, 유니코드). 각 파인더는 배정 파일+위키 절만 읽고 스키마(JSON)로 반환.
2. **적대적 검증** — 파인더 4명분씩 배정받은 검증관 10명이 소스를 직접 열어 반박. 판정 3축: `original_claim_status`(upheld/partial/refuted) × `actionable_severity` × `verification_confidence`. 중복은 대표 1건만 생존. 검증관은 같은 스코프에서 빠진 결함을 최대 3건 추가 가능.
3. **감독자 표본 재검증** — critical/high 표본 6건을 소스 직독으로 재확인:

| 표본 | 판정 | 비고 |
|---|---|---|
| DB-03-1 (crop 가드 누락) | ✅ 확인 | items 케이스 16개 축 훑고 crops 누락; `cropReferenceMessage`는 항상 null(별개 축) |
| EE-07-2 (playMovie 반전) | ✅ 확인 | 폼 `cmd.wait === true ? "true":"false"` vs 런타임 `wait !== false` |
| DB-18-3 (유지 역전) | ✅ 확인 | `\b(persist\|keep\|remain)\b` vs 한국어 옵션 |
| DB-14-4 (2.5 저장) | ✅ 확인 | 클램프는 절사 없음, 로더 `assertSafeIntegerInRange` throw |
| EE-10-4 (screenEffects) | ✅ 확인(단서) | Screen Effect 는 `applyScreenEffect`로 수리된 전례가 같은 파일에 있음 — Show Animation/Flash Event 는 미수리 |
| EE-09-2 (호러 조합 벽돌) | ✅ 확인(요지) | 증거 사슬 4단 모두 실재 |

기각 사례 2건(EE-10-9, EE-10-13)은 검증관이 렌더러 실코드를 반증으로 제시해 기각됐다 — 반박이 실제로 작동한다는 표본.

### 3.2 신뢰도 한계 (정직한 노트)

- 파인더와 검증관이 **같은 모델 계열**(glm-5.3-flash)이라 상관 편향이 있다. 반박률 1%는 낮은 편이며, 표본 재검증 6/6이 검증관 판정을 지지해 품질을 보정하지만, 별모델 교차 검증을 돌리면 기각·강등이 더 나올 수 있다.
- 정적 독해 리뷰다. 브라우저 실행 증거(스크린샷·픽셀 계측)는 없다. «미리보기가 그렇게 그린다»류 주장은 실행 QA로 2차 확인을 권한다.
- critical 10건 중 1건(EE-09-2)은 저장은 되지만 "다음 로드 실패"가 원격 저장 경로 기준 재현인지는 실행 확인이 필요하다.

### 3.3 중복 그룹 안내 (카탈로그에서 같은 현상)

- **상태이상 런타임 계약**: DB-04-1, DB-04-2, DB-09-1, DB-09-2, DB-18-1~8, DBV-A3, DB-V5-A1
- **playMovie/showPicture 플래그**: EE-07-2, EE-07-3, EE-13-2, EE-13-3, EE-13-4
- **M2 죽은 명령**: EE-10-3~8, EE-10-10, EE-V3-A1, EE-V3-A2
- **AI upsert 얕은 병합**: DBV-A1, DBV-A2, DB-V3-A2, DB-09-9, DB-11-2, DB-14-6~8, DB-14-10
- **삭제 가드↔검증 어긋남**: DB-03-1~5, DB-06-1~11, DB-08-1, DB-V2-A2
- **지연 적용 초안 수명**: EE-15-1, EE-15-2, DB-15-1, DB-15-2
- **전체 재렌더/포커스 소실**: EE-17-1, EE-17-3, DB-02-1, DB-11-1

---

## 4. 권고 — 수정 우선순위

**P0 (데이터 유실·벽돌 — 이번 주)**
1. 삭제 가드와 로드 검증의 축 목록을 **한 정본으로 통일**(같은 소스에서 generate) — DB-03-1/2/3/4, DB-06-1~9 일괄 소멸.
2. 편집기 쓰기 경로에 로더 불변식 재사용: numberField에 `clampInt` 옵션, 생활·날씨·축사 폼에 저장 전 검증 — DB-14-1~4, DB-14-5.
3. AI `upsert_*`에 깊은 병합(또는 명시적 전체 교체 플래그) 도입 + AI 삭제 경로에 사람 가드 재사용 — DBV-A1, DB-06-3/10.
4. `prune_unused` 참조 수집을 명령 전체 스캔으로(위키 L1347 결함의 재발 방지 계약 준수).

**P1 (기능 정합 — 다음 스프린트)**
5. 상태이상 제한/해제 조건을 enum으로 전환하고 런타임 폴백 정규식 제거 — DB-04-1/2, DB-18-2~8, DB-09-1/2.
6. playMovie/showPicture 플래그 삼중 일치(폼 표시=저장=런타임) + 미리보기에 scale/opacity/ambient 반영 — EE-07-2/3, EE-13-1~6.
7. M2 죽은 명령 7종: 구현 또는 피커에서 «미구현» 배지 — EE-10-3~8. (분류표 `full` 라벨 정정 포함)
8. 페이지 편집 파괴 3종 수정 — EE-08-1, EE-09-1/3.

**P2 (AI 사용성·성능)**
9. 지연 적용 초안의 영속 복원 표면 + 결정 전 자동 적용 금지 + undo 표면의 스택 소유권 검사 — EE-15-1~3, DB-15-1/2.
10. 전체 재렌더 제거(타깃 패치)와 IME 안전 타이핑 — EE-17-1/3, DB-02-1, DB-11-1.

전체 카탈로그는 아래 — 스쿼드 → 파인더 → 심각도 순. 각 항목의 «최종 심각도»는 검증관이 조정한 값이고, `보류(partial)`은 근거 일부만 인정된 항목이다.

---
## 5 이벤트 에디터 카탈로그 — 1차 발견 305건, 실재 299건 (보류 8 포함)

### 5.1 EE-01 — 이벤트 에디터 창 셸/모달

**[EE-01-1] (medium) 서브다이얼로그가 소유 편집기의 해제 계약에 묶여 있지 않아 유령 모달 층으로 남는다**
`src/editor/panels/eventEditor/subdialog.ts` · 최종 medium · 보류 · 확신 high
위치: src/editor/panels/eventEditor/subdialog.ts:45-48, :69-71, :92. openEventSubdialog의 닫힘 경로는 (1) registerModal이 돌려준 close(Esc/닫기 버튼), (2) `backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); })` 뿐이고, 백드롭은 `document.body.append(backdrop)`(92행)으로 편집기 백드롭 **밖**에 붙는다. 소유 편집기가 해제될 때 서브다이얼로그를 닫는 장치가 전혀 없다 — `oprn:event-editor-close` 구독이 grep 상 0건인 반면, 같은 편집기 위에 뜨는 우클릭 메뉴와 검증 종은 명시적으로 구독한다(src/editor/panels/eventEditor/commandListContextMenu.ts:73 `parent?.addEventListener("oprn:event-editor-close", close)`, validationBell.ts:252 동일).  …
> 보류 사유: 핵심은 실측으로 입증된다: subdialog.ts:69-71·92 확인, subdialog에는 oprn:event-editor-close 구독이 0건이고 commandListContextMenu.ts:73·validationBell.ts:252는 구독한다. 그러나 AI 체인지셋 트리거 주장은 반박됨 — applyChangesetToStore.ts:397이 projectSwitch:false를 넘기고 store.ts:780의 `projectSwitch: true, ...(change ?? {})` 스프레드 순서상 이 값이 이겨서 AI …

**[EE-01-2] (medium) 서브다이얼로그 백드롭 클릭이 확인 없이 스테이징된 명령 편집 전체를 폐기한다**
`src/editor/panels/eventEditor/subdialog.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/subdialog.ts:69-71 — `backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });` — 조건 없이 곧장 취소다. 그런데 명령 편집 대화상자는 모든 편집을 스테이징한다: commandEditDialog.ts:31 `let stagedCommand = structuredClone(request.initial);`, 각 입력은 actions.replaceCommand로 stagedCommand만 고치고(89-108행), :159-163 확인(「확인」/「상점 설정 적용」)에서만 `request.onApply(...)`로 반영된다. 즉 확인 전 상태는 드래프트에도 없어 Ctrl+Z 복구가 불가능하다. 상점은 `width: "full"`(commandEditDialog.ts:26-28)로 창을 꽉 채우지만 백드롭 노출 면적이 0이 아니고, wide/narrow 창은 어두운 면이 넓게 보인다. 대조적으로 본편 이벤트 에디터는 같은 상황에서 확인창을 띄운다(modal.ts:241-258 — `eventDraftHasUserChanges`면 "적용하지 않은 변경이 있어요. 버리고 닫을까요?"). 영향: 긴 대사·상점 진열 구성 등을 다 넣어 둔 뒤 창 바깥을 한 번 잘못 누르면 경고 없이 전부 사라진다. 수정 제안: openEventSubdialog에 `isDirty?: () => boolean` 옵션을 두어 백드롭 클릭/Esc 취소 시 dirty면 본편과 같은 showConfirm을 거치게 하거나, 최소한 commandEditDialog에만 취소 확인 계약을 둔다.

**[EE-01-3] (medium) makePopoverEscapable이 재렌더로 detache된 열린 팝오버를 회수하지 못해 문서 리스너·DOM을 누수한다**
`src/editor/panels/eventEditor/content.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/content.ts:585-600 — registerModal/unregisterModal과 `document.addEventListener("pointerdown", onOutsidePointerDown, true)`의 등록·해제이 전부 `details`의 `toggle` 이벤트에 매여 있다(591-599행). 그런데 편집기 본문은 store 갱신마다 통째로 다시 그려진다(modal.ts:348-351 — `renderEventEditorDynamic(staged, ...)` 뒤 `clearChildren(dynamicBody); dynamicBody.append(...)`). 툴바의 [편집]·[도구] 팝오버는 이 다시 그려지는 DOM 안에 있으므로(content.ts:661-684 editTools/toolsMenu, :406 fieldset에 mount), 팝오버가 **열린 채로** store 갱신(Ctrl+Z, AI 체인지셋 적용, 페이지 갱신 등)이 오면 열린 details가 DOM에서 통째로 detach된다. 요소 제거는 toggle을 발화하지 않으므로 unregister도, 문서 리스너 해제도 일어나지 않는다 — 문서 캡처 리스너는 detached details(팝오버 DOM 포함)를 영구 참조해 누수되고, modalStack 엔트리도 pruneDetached가 돌기 전까지 잔류한다. …

**[EE-01-4] (medium) dom.ts field() 라벨이 컨트롤과 연결되지 않아 M2 명령 폼의 텍스트 입력이 접근 이름 없이 렌더된다**
`src/editor/panels/eventEditor/dom.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/dom.ts:5-9 — `const row = el("div", { class: "field" }); row.append(el("label", { text: label }), control);` — 라벨에 `for`가 없고 컨트롤을 감싸지도 않아 연결이 깨져 있다. 이 헬퍼의 유일한 소비자는 M2(기타 명령) 폼이다: commandBodyM2.ts:18 `import { field as fieldRow } from "./dom"`, :106-107 `wrap.append(fieldRow(fieldLabelForSpec(...), controlForField(...)))`. 그런데 M2의 텍스트/숫자/텍스트영역 컨트롤에는 자체 접근 이름이 없다(commandBodyM2.ts:394-401 textControl — `input.type="text"`에 aria-label 없음, :403-414 textareaControl, :416-448 numberControl 동일). 결과: M2 명령 폼의 해당 필드들은 스크린리더에 이름 없이 낭독되고, 라벨을 클릭해도 컨트롤로 포커스가 가지 않는다. 저장소의 정답 패턴은 라벨이 컨트롤을 감싸는 것이다 — conditionForm.ts:601-604 `el("label", { children: [el("span", ...), control] })`, pageHorror.ts:6-7, pageNpcBehavior.ts:9 모두 이렇다. …

**[EE-01-5] (medium) 도움말 모달이 aria-modal=true를 선언하면서 포커스 트랩과 복귀 포커스가 없다**
`src/editor/panels/eventEditor/eventEditorHelp.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/eventEditorHelp.ts:377-407, :453-467. 창은 `role: "dialog", "aria-modal": "true"`(384행)임을 선언하지만 Tab 포함 리스너가 없다 — 문서 전체를 뒤져도 이 파일에 keydown 트랩은 0건이다. 저장소의 같은 역할 모달은 전부 트랩을 갖는다: app 확인창(ui/modal.ts trapTab, 96행 부근 `card.addEventListener("keydown", trapTab)`), 서브다이얼로그(subdialog.ts:72-90 trapFocus, 문서 캡처 + isTopModal 가드), 본편 편집기(modal.ts:929-953 installFocusTrap). 또한 닫기 경로 453-459행 `close()`는 unregister+remove만 하고 열기 트리거(푸터 도움말 버튼)로 포커스를 되돌리지 않아, 닫은 뒤 포커스가 body로 떨어진다(대조: subdialog.ts:49-64의 returnFocus 체계). 덧붙여 354행 `document.querySelector(...)?.remove()`은 기존 도움말을 unregisterModal 없이 제거해 잔여 층을 남긴다(pruneDetached로 지연 정리되긴 함). 영향: 키보드 사용자가 도움말에서 Tab을 누르면 aria-modal을 위반하고 뒤 편집기 본문으로 포커스가 탈출하며, 닫은 뒤 위치를 잃는다. …

저심각도 일괄:
- [EE-01-10] (low) 창 크기조절 핸들이 role=separator인데 값 공개(aria-valuenow 등) 없이 조작된다 — `src/editor/panels/eventEditor/modalResize.ts`
- [EE-01-6] (low) modalStack 문서 캡처 때문에 도달 불가한 죽은 Escape 분기 두 곳(전체화면·커스텀 셀렉트) — `src/editor/panels/eventEditor/modalFullscreen.ts`
- [EE-01-7] (low) 서로 다른 명령 triggerEnding과 ending이 같은 라벨 「엔딩」으로 피커·요약에 나타난다 — `src/editor/panels/eventEditor/options.ts`
- [EE-01-8] (low) renderEventEditorInline이 호출부 없는 죽은 모듈로 남아 있다 — `src/editor/panels/eventEditor/inline.ts`
- [EE-01-9] (low) 커스텀 셀렉트 팝오버가 창 드래그·리사이즈·전체화면 전환에 재배치되지 않아 트리거에서 이탈한다 — `src/editor/panels/eventEditor/customSelect.ts`

### 5.2 EE-02 — 명령 목록·컨텍스트 메뉴·드래그·스테이지드 편집

**[EE-02-1] (high) 공통·전투(트룹) 이벤트 명령 목록에서 빈 분기·「이 분기에 명령 추가」 버튼이 죽은 버튼**
`src/editor/panels/databaseCommandListAdapter.ts` · 최종 high · 확인 · 확신 high
위치·증거: src/editor/panels/eventEditor/commandList.ts:468-482(renderEmptyBranchLine)와 :485-506(renderBranchAddLine)은 options.openCommandPicker 없이도 「이 분기에 명령 추가」 버튼을 항상 렌더하고, 클릭 핸들러가 :477·:501에서 `openCommandPicker?.(containerPath)` 로 **옵셔널 호출**입니다. 그런데 src/editor/panels/databaseCommandListAdapter.ts:107-109 의 renderCommandList 호출은 `{ pickerContext: adapter.pickerContext }` 만 넘기고 openCommandPicker 를 전달하지 않습니다. 이 어댑터의 소비자는 공통 이벤트(src/editor/panels/databaseCommonEventViews.ts:281)와 트룹 전투 이벤트(src/editor/panels/databaseTroopBattleEventPanel.ts:261)입니다. 맵 이벤트 경로는 content.ts:200 이 openCommandPicker 를 넘겨 정상 동작합니다. 더욱이 commandBodyChoices.ts:19-22("Branch bodies stay on the main list")와 :87("각 선택지 본문은 왼쪽 목록에서 고칩니다")이 분기 본문 편집은 목록에서만 한다는 계약을 명시하므로, 이 버튼이 빈 분기(새로 만든 선택지·포크·루프)에 명령을 넣는 **사실상 유일한 눈에 보이는 수단**입니다. …

**[EE-02-2] (high) Input Number 편집면이 렌더 중 스토어를 쓰고(첫 변수 자동 바인딩), 위키가 보증하는 Confirm 차단 검증 훅은 미구현**
`src/editor/panels/eventEditor/commandBodyInputNumber.ts` · 최종 high · 확인 · 확신 high
위키 openwiki/editor-event-command-fixes.md:50 은 "Input Number never picks a variable during render. Its scoped `event-command-validate` hook blocks Confirm for empty/missing destinations and focuses the picker" 라고 기록하지만, (1) `event-command-validate` 는 src 전역 grep 결과 0건으로 미구현이고, (2) 코드는 정반대로 **렌더 중 변수를 고릅니다**. src/editor/panels/eventEditor/commandBodyInputNumber.ts:17-26: `let currentVariableId = cmd.variableId; if (!currentVariableId.trim()) { const first = store.getCurrent().variables[0]?.id ?? ""; if (first) { currentVariableId = first; context.actions.replaceCommand(context.path, { ...cmd, variableId: first }); } }` — 렌더 패스에서 actions.replaceCommand 를 즉시 호출합니다. …

**[EE-02-3] (medium) commandDiff.branchSlots 분기 머리글 6종이 정본(eventCommandBranches) 라벨과 불일치 — AI 스테이지드 프리뷰가 실제 목록과 다른 단어를 보여줌**
`src/editor/panels/eventEditor/commandDiff.ts` · 최종 medium · 확인 · 확신 high
위치·증거: commandDiff.ts:43-44 주석이 "머리글 문구는 commandList.ts 의 renderBranchDropLine 과 같은 말을 쓴다 — …다른 단어를 쓰면 «적용하면 이렇게 된다»는 예측이 깨진다"고 스스로 계약을 규정하는데, branchSlots(:48-104)의 라벨이 정본과 다릅니다. 실측 불일치 6쌍: commandDiff.ts:57 "취소할 때" ↔ eventCommandBranches.ts:79 "취소했을 때"; :67 "반복" ↔ :107 "반복할 내용"; :71 "구매·판매했을 때" ↔ :117 "거래했을 때"; :96 "전투 승리" ↔ :152 "이겼을 때"; :97 "전투 패배" ↔ :155 "졌을 때"; :98 "전투 도망" ↔ :158 "도망쳤을 때". eventCommandBranches.ts:14-16 은 "모든 뷰가 이 문자열만 쓴다. 뷰에서 다시 쓰지 말 것"을 규칙으로 명시합니다. 추가로 취소 분기 노출 조건도 어긋납니다: commandDiff.ts:56 은 `cancelBehavior === "branch"` 일 때만 choiceCancel 슬롯을 만들지만, 정본 eventCommandBranches.ts:62-64·76 은 cancelBranch **배열만 존재해도**(레거시 바이트 보존 케이스) 분기를 보입니다 — 이 데이터에서 AI 스테이지드 프리뷰(stagedDiffView)가 취소 분기 자체를 생략해 프리뷰와 적용 결과·실제 목록이 달라 보입니다. …

**[EE-02-4] (medium) 명령 목록 DnD가 임의 text/plain 드래그(선택 텍스트 등)에도 드롭 가능 표시를 내보이고 드롭은 조용히 무반응**
`src/editor/panels/eventEditor/commandListDragDrop.ts` · 최종 medium · 확인 · 확신 high
위치·증거: commandListDragDrop.ts:92-95 `hasDragData` 는 `types` 에 `application/x-oprn-event-command-path` **또는** `text/plain` 이 있으면 참입니다. 행 핸들러 :40-54 는 dragover에서 페이로드가 실제 명령 경로 JSON 인지 확인하지 않은 채 `data.preventDefault()` + `cmd-drop-before/after` 표시를 하고, 호스트·분기 라인 핸들러 :75-80 도 같습니다(MIME types 수준 확인뿐). 실제 드롭(:59-63, :81-86)은 `readDragPath` 의 JSON 파싱 실패로 `return` 하므로 아무 일도 일어나지 않습니다. 영향: 이벤트 편집기 안 입력란(검색창·문장 프롬프트 등)에서 선택한 텍스트를 드래그해 명령 목록 위로 지나가면 삽입 위치 표시와 move 커서가 뜨고, 놓으면 무반응 — 사용자가 드롭 지원 여부를 신뢰할 수 없게 됩니다. 외부에서 JSON 배열 형태 텍스트를 드롭하면 경로로 파싱되는 2차 위험도 있습니다(:97-106). 수정 제안: dragover 단계에서도 `activeDragPath` 외의 소스는 표시하지 않도록 하거나, text/plain 폴백을 제거하고 전용 MIME 만 수용.

저심각도 일괄:
- [EE-02-10] (low) AI 스테이지드 프리뷰의 분기 머리글 톤이 fork 로 고정 — 실제 목록의 choices/shop 톤과 모양 불일치 — `src/editor/panels/eventEditor/stagedDiffView.ts`
- [EE-02-5] (low) 자기 분기 안 드롭 불변식이 분기 라인(드롭존·빈 분기·추가 줄)에서는 시각적으로 거부되지 않고 조용히 무시됨 — `src/editor/panels/eventEditor/commandListDragDrop.ts`
- [EE-02-6] (low) 드래그 핸들을 눌렀다 드래그 없이 떼면 행이 draggable=true 로 잔존해 텍스트 선택이 드래그로 바뀜 — `src/editor/panels/eventEditor/commandListDragDrop.ts`
- [EE-02-7] (low) 「맵 위 이벤트 부르기」(과 Erase Event) 요약이 원시 이벤트 id를 노출 — 같은 파일의 eventNameForSummary 계약과 불일치 — `src/editor/panels/eventEditor/commandSummary.ts`
- [EE-02-8] (low) 「변수 위치로 이동」 요약이 변수 id(mapVariableId)를 맵 이름 조회에 그대로 투입 — `src/editor/panels/eventEditor/commandSummary.ts`
- [EE-02-9] (low) 선택지 취소 요약이 옵션 수를 반영하지 않아 런타임 동작(취소 무동작)과 다르게 안내 — `src/editor/panels/eventEditor/commandSummary.ts`

### 5.3 EE-03 — 커맨드 피커와 명령 카탈로그 커버리지

**[EE-03-1] (high) 즐겨찾기·최근 사용 섹션이 메인 그리드와 동일한 data-testid·aria-label 버튼을 이중 렌더링한다**
`src/editor/panels/eventEditor/commandPicker.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPicker.ts:503-509. renderPickerPage는 (1) 즐겨찾기 섹션(503-505), (2) 최근 명령 섹션(506-508), (3) 메인 탭 그리드(509)를 같은 DOM에 연속 append한다. 세 곳 모두 renderCommandGrid→renderCommandButton을 태우므로 버튼의 data-testid는 entry.testId 그대로다(671: `button.dataset.testid = entry.testId`). 즉 어떤 명령을 즐겨찾기에 추가하면 그 명령이 속한 탭에서 `command-picker-add-<kind|id>` 버튼과 `command-picker-favorite-<commandId>` 별 버튼이 각 2벌씩 DOM에 존재한다. 이 파일 자체가 그 실패 모드를 문서로 남기고 있다(172-187: "같은 네이티브 종류로 접히는 항목이 둘 이상이면 command-picker-add-<kind> 가 겹쳐 e2e 가 어느 버튼인지 지목할 수 없다(실측 2026-08-28 … Playwright strict mode 위반)"). 또한 (a) 두 벌의 버튼이 동일 aria-label(656: entry.label)을 가져 getByRole name 조회도 모호해지고, (b) commandButtonsOf(456-460)가 quick 섹션 복사본까지 키보드 후보로 넣어 하이라이트/Enter가 어느 쪽을 누를지 DOM 순서에 의존하며, (c) highlightCommand가 부여하는 동적 id(469-470: `event-command-picker-option-<commandId>`)가 두 복사본에서 동일해 중복 id가 누적된다. …

**[EE-03-2] (medium) 피커에서 '소리 정지'(stopAudio 즉시 정지)를 저작할 방법이 없다 — BGM 페이드아웃 별칭만 노출**
`src/editor/panels/eventEditor/commandPicker.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPicker.ts:751-760, 122-136, 148-151. 카탈로그에서 stopAudio kind로 이어지는 행은 "Fadeout BGM"(m2-062) 하나뿐이다(src/project/eventCommands/m2CatalogData.ts:290: `"Fadeout BGM": "stopAudio"`). stopAudio가 CATALOG_NATIVE_KINDS에 있으므로(148-151) DERIVED 항목도 만들어지지 않고, NATIVE_ONLY_LAYOUT(122-136)에도 없다. 결국 피커의 유일한 stopAudio 진입은 "BGM 페이드아웃" 행이고 createCommandFromEntry가 `{kind:"stopAudio", channel:"bgm"}`으로 굽힌다(758-760). 반면 런타임은 channel 없는 stopAudio(전체 즉시 정지)를 실행한다(src/player/interpreter/commandCatalog.ts:620-621: `command.channel === undefined ? { kind: "stopAudio" } : …`), commandSummary도 `채널!==bgm`을 "소리 정지"로 구분한다(src/editor/panels/eventEditor/commandSummary.ts:364), 위키는 이 즉시 정지가 audio-indicator 배너의 유일 해제 경로라고 기록한다(openwiki/editor-event-commands.md:223).  …

**[EE-03-4] (medium) 명령 리스트·스토리보드의 카테고리 비주얼이 피커 그룹과 어긋난다 — 보정 매핑 누락·불일치에 완전성 가드도 없다**
`src/editor/panels/eventEditor/commandCategoryIcons.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/panels/eventEditor/commandCategoryIcons.ts:80-108, 119-121, 141-144. 명령 리스트 행(commandList.ts:120), 플로우 노드(eventScriptModernViews.ts:284), 스토리보드(storyboardView.ts:101)는 commandCategoryVisual(cmd)을 쓰고, 이는 CATEGORY_BY_KIND → 매칭 실패 시 FALLBACK(시스템/고급 ⚙)이다. 그런데 (a) 보정 매핑이 addFollower/removeFollower를 「지도」로 박아 넣었다(93-94: `index.set("addFollower", groupVisual(M2_PICKER_MAP_GROUP))`), 반면 피커 그룹의 정본은 가족 매핑상 「파티」다(src/editor/eventCommands/commandPresentation.ts:46: `follower: M2_PICKER_PARTY_GROUP`). (b) callMapEvent는 「옮기기」로 매핑(90)됐는데 피커에선 controlFlow 가족이라 「흐름」 헤딩 아래 나온다. …

**[EE-03-5] (medium) 검색 input의 combobox ARIA 계약이 불완전하고 결과 변경 시 stale aria-activedescendant가 남는다**
`src/editor/panels/eventEditor/commandPicker.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPicker.ts:334-338, 365-370, 463-475. 검색 input은 `type:"search"`에 aria-label만 있고 role="combobox"·aria-controls·aria-expanded가 없으며(334-338), 결과 컨테이너는 role="tabpanel"/일반 div(568-572)라 listbox가 아니고, 후보 버튼에도 role="option"이 없다(652-670). 그러면서 highlightCommand는 검색창에 aria-activedescendant를 설정한다(471-473) — ARIA 1.2 combobox/listbox 패턴을 만족하지 않는 속성 조합이라 스크린리더가 이를 신뢰할 수 없다. 또한 검색어를 지워 결과가 0이 되거나 재렌더로 대상 노드가 사라져도 highlightCommand는 `const target = buttons[index]; if (!target) return;`(466-467)로 조기 반환해 이전 aria-activedescendant와 부여해둔 id(469-470)를 그대로 남긴다 — 죽은 노드를 가리키는 stale 참조. 위키 delayed-tooltip.md의 유령 툴팁 방지 계약(대상 이탈 시 정리)과 같은 정신의 정리 누락이다. 수정: combobox/listbox/option 역할 세트를 완성하고, 결과 재렌더 시 aria-activedescendant·부여된 id를 명시적으로 클리어한다.

**[EE-03-3] (low) 전투 이벤트 피커의 탭2 동료 로스터가 배지 없이 전투에서 실행되지 않는 addFollower를 원클릭 삽입 제공한다**
`src/editor/panels/eventEditor/commandPicker.ts` · 최종 low · 보류 · 확신 high
위치: src/editor/panels/eventEditor/commandPicker.ts:493-501. `if (page === 2) { wrap.append(renderCompanionRoster(store.getCurrent(), …)) }` — request.context(301-314에서 map/common/troop로 선언)를 전혀 보지 않는다. 로스터 카드 클릭은 `{kind:"addFollower", actorId}`를 즉시 삽입한다(src/editor/panels/eventEditor/companionRoster.ts:123-131). 그러나 전투 실행기는 addFollower/removeFollower를 명시적 unsupported 목록에 넣어 스킵한다(src/battle/battleEvents.ts:885-886, 887-889: "미지원 배틀 커맨드는 반드시 unsupported 로그를 남긴다"), 런타임 지원 계약층도 전투 컨텍스트에서 이 kind에 "전투에서 실행 안 됨" 배지를 부여한다(src/project/eventCommands/runtimeSupport.ts:134, 140). 같은 addFollower를 피커 그리드에서 고르면 이 배지가 붙는데(companionRoster의 onSelect는 renderCommandButton을 우회), 로스터 카드에는 배지·안내가 전혀 없어 정직성 계약을 우회한다. 또한 498의 `onSelect(command as unknown as Command)` 이중 캐스트는 로스터 생성 명령이 newCommand/newM2Command 경로를 우회함을 숨긴다. 수정: context가 troop일 때 로스터를 숨기거나 각 카드에 컨텍스트별 지원 배지/"전투에서 실행 안 됨" 안내를 붙인다.
> 보류 사유: 로스터가 context를 보지 않고 항상 렌더되고(493-501) 카드에 배지가 없으며 전투 미실행 등록(battleEvents.ts:885-889, runtimeSupport.ts:134·140)은 실측됐다. 그러나 «원클릭 즉시 삽입»은 반박됨 — 로스터 onSelect는 두 호출부 모두 openNewEventCommandDialog 편집창을 거친다(content.ts:1020-1024, databaseCommandListAdapter.ts:132-136)고 삽입 후 목록 행에는 지원 배지가 붙는다(commandList.ts:1 …

저심각도 일괄:
- [EE-03-10] (low) 동료 로스터로 삽입한 addFollower는 최근 명령에 기록되지 않는다 — `src/editor/panels/eventEditor/commandPicker.ts`
- [EE-03-11] (low) 버튼마다 localStorage+JSON.parse를 재호출해 검색 타이핑마다 전체 재파싱이 발생한다 — `src/editor/panels/eventEditor/commandPicker.ts`
- [EE-03-6] (low) 검색 결과가 정보 행뿐이면 Enter·키보드 탐색이 조용히 무반응이다 — `src/editor/panels/eventEditor/commandPicker.ts`
- [EE-03-7] (low) playAudio/stopAudio 삽입 의도가 카탈로그 영어 title 문자열 일치 휴리스틱에 의존한다 — `src/editor/panels/eventEditor/commandPicker.ts`
- [EE-03-8] (low) channel 없는 stopAudio의 편집 다이얼로그 제목이 'BGM 페이드아웃'으로 잘못 표시된다(채널 중립 계약 미적용) — `src/editor/panels/eventEditor/commandPicker.ts`
- [EE-03-9] (low) 은퇴·삭제된 명령의 즐겨찾기·최근 사용 기록이 localStorage에 영구 잔류하며 정리되지 않는다 — `src/editor/panels/eventEditor/commandPickerPreferences.ts`

### 5.4 EE-04 — 명령 폼 — 대사·선택지·텍스트·그래픽

**[EE-04-1] (high) 대사·선택지 폼이 글자 하나마다 replaceCommand를 쏜다 — 되돌리기 50칸이 타이핑에 증발**
`src/editor/panels/eventEditor/commandBodyCore.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyCore.ts:207-212 (speaker/body 모두 input·change에 apply 부착), src/editor/panels/eventEditor/commandBodyChoices.ts:112-117 (선택지 텍스트 input마다 replaceCommand). 증거: apply는 즉시 context.actions.replaceCommand를 호출하고, 인스펙터 경로에서 이 액션은 commandToolbarHistory.wrapActions로 감싸진다(src/editor/panels/eventEditor/content.ts:169). recordCommandToolbarChange는 호출마다 past.push(before)로 되돌리기 1칸을 쌓고(src/editor/panels/eventEditor/commandToolbarHistory.ts:135), HISTORY_LIMIT=50 초과분은 shift로 버린다(commandToolbarHistory.ts:35,145). 저장소 emit은 동기이고(src/project/store.ts:1061-1064), 이벤트 편집 모달은 store 변경마다 refresh()로 동적 본문 전체를 다시 그린다(src/editor/panels/eventEditor/modal.ts:371-382,348-351). 같은 저장소의 commandBodyInputNumber.ts:36-38 코멘트가 "replaceCommand 는 되돌리기 이력을 한 칸 쌓는다… 무의미한 «커맨드 교체» 가 쌓이면 안 된다"고 명시한 것과 정면으로 어긋난다. …

**[EE-04-3] (high) 선택지 삭제 시 취소 대상이 같은 분기를 유지하지 않고 «선택지 2»로 조용히 재지향된다 — 위키 U02 인덱스 조정 계약 미구현**
`src/editor/panels/eventEditor/commandBodyChoices.ts` · 최종 high · 확인 · 확신 high
위키 계약(openwiki/editor-event-command-fixes.md:48, U02): "Deleting a choice before the cancel destination adjusts its one-based index to retain the same branch." 실제 코드: src/editor/panels/eventEditor/commandBodyChoices.ts:130-143의 삭제 핸들러는 분기 데이터는 옵션에 붙여 보존하지만 cancelBehavior는 normalizeCancelBehavior(latest.cancelBehavior ?? "disallow", Math.max(1, nextOptions.length))로만 통과시키고, normalizeCancelBehavior(244-249행)는 범위 밖이면 `return count >= 2 ? "choice2" : "choice1"`로 재지향한다. 실증: 옵션 [A,B,C,D] + cancelBehavior "choice4"(=D 분기)에서 A를 삭제하면 같은 D 분기는 이제 3번째이므로 계약상 "choice3"이어야 하지만, 4 > 3이라 폴백 "choice2"(=C 분기)가 저장된다. 런타임(src/player/dialogue.ts:939-948 cancelChoiceIndex, src/player/interpreter/resume.ts:25-27)은 저장된 인덱스를 그대로 실행하므로 Esc를 누르면 저작자가 고른 분기가 아닌 다른 분기가 돌다. 요약·미리보기·라디오는 바뀐 값을 정직하게 보여주므로 저작자는 자기가 바꿨다는 사실 자체를 모른다. …

**[EE-04-4] (medium) 선택지 5개 초과 경고 문구가 런타임과 반대 — 게임은 6개 이상도 전부 표시·실행한다 (A10 잔여 결함)**
`src/editor/panels/eventEditor/commandBodyChoices.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyChoices.ts:77-84 — 경고 문구 "선택지가 N개입니다. 화면에는 처음 5개만 표시하며 나머지 분기는 유지합니다.". 그러나 런타임은 상한이 없다: src/player/interpreter/commandCatalog.ts:474가 options 전부를 전달하고, src/player/dialogue.ts:559-571이 전부 버튼으로 렌더하며, src/player/interpreter/resume.ts:29-31이 전부 실행한다. 2026-09-19 리뷰 A10의 데이터 유실 자체는 readOptionsFromDom의 hidden 보존(commandBodyChoices.ts:285-286)으로 봉합됐지만, 이 경고 문구는 여전히 런타임과 반대말을 하고 폼은 normalizeOptions slice(251-259행)로 6번째 옵션 텍스트를 아예 편집 불가로 숨긴다 — 게임에는 나오는데 에디터에서는 보이지도 고칠 수도 없는 옵션이 존재한다. 추가로 cancelBehavior가 choice6 이상이면 cancelBehaviorsForCount(235-242행)가 choice5까지만 라디오를 만들어 취소 라디오가 하나도 체크되지 않은 채 표시된다. 수정 제안: 문구를 실제 동작("게임에서는 모두 표시·실행됩니다")으로 고치고, 6개 이상 초과분도 읽기 전용 행으로 표시하거나 임포트/AI 생성 시 fork 변환·경고를 남긴다. 런타임 상한을 진짜로 넣을지는 별도 결정이 필요하다.

**[EE-04-5] (medium) 선택지 미리보기가 빈 텍스트 옵션을 걸러서, 게임에는 «선택 가능한 빈 버튼»이 생긴다**
`src/editor/panels/eventEditor/commandPreview.ts` · 최종 medium · 확인 · 확신 high
src/editor/panels/eventEditor/commandPreview.ts:582 `const options = cmd.options.filter((option) => option.text.trim().length > 0)` — 미리보기는 빈 텍스트 선택지를 창에서 생략한다. 런타임은 그렇지 않다: src/player/dialogue.ts:559-571이 모든 옵션을 그대로 버튼으로 만들고(parseDialogueText("")도 빈 버튼), 숫자키·방향키·확인으로 선택·실행된다(527행 n <= options.length). 폼은 빈 값을 의도적으로 보존한다(commandBodyChoices.ts:280 "Preserve typed text including temporary empties") — 즉 한 행을 지웠다가 다시 쓰는 사이에도 명령 데이터에는 빈 옵션이 살아 있다. 영향: 편집 중·임포트 프로젝트 모두에서 미리보기에는 없는 빈 선택 버튼이 게임에 등장해 플레이어가 빈 분기를 고를 수 있다. 미리보기는 "게임 창을 축소해 그린다"는 위키 계약(openwiki/editor-event-commands.md:141-164)을 스스로 깬다. 수정 제안: 미리보기 필터를 제거해 게임과 같게 그리거나(빈 행을 빈 버튼으로 표시), 반대로 런타임 인터프리터에서 빈 텍스트 옵션을 건너뛰는 정규화를 넣고 폼·미리보기·검증기가 그 계약을 공유하게 한다.

**[EE-04-6] (medium) appearanceId로 연결된 changeFace의 활성 얼굴 추적이 resourceId 낡은 값을 쓴다 — 문장 미리보기가 게임과 다른 얼굴을 보여준다**
`src/editor/panels/eventEditor/commandList.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandList.ts:100-105 — changeFace에서 faceState.current는 { resourceId: cmd.resourceId, position, flipHorizontally }만 만든다. appearanceId가 있으면 런타임은 cmd.resourceId를 무시하고 resolveAppearancePortrait로 초상을 해석한다(src/player/interpreter/commandCatalog.ts:444-448). 그런데 폼의 readDraft는 appearanceId 연결 중 비활성된 resource input의 낡은 값을 그대로 저장한다(src/editor/panels/eventEditor/commandBodyCore.ts:527-533 — resource는 linked 시 disabled, 594행). 또 ActiveFace 타입에는 presentation이 없고(src/editor/panels/eventEditor/previewSimulation.ts:53-57), 뒤따르는 문장 표시 LIVE 미리보기·인스펙터 미리보기는 renderFacesetCrop → faceDisplayModeOf(id 접미 휴리스틱)로만 판정한다(src/editor/panels/eventEditor/facesetPreview.ts:118-133, commandPreview.ts:270-274). 런타임 portrait 판정은 face.presentation을 우선한다(src/player/dialogue.ts:950-965).  …

**[EE-04-7] (medium) 문장 길이 한도 힌트가 제어문자(\c[2], \v[1], \n[1]…)를 글자 수로 센다 — 도구를 쓸수록 거짓 초과 경고**
`src/editor/panels/eventEditor/commandBodyCore.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyCore.ts:184-198 — `const maxLine = lines.reduce((m, line) => Math.max(m, line.length), 0)`가 원문 문자열 길이를 그대로 센다. 그런데 같은 폼의 도구들이 눈에 보이지 않는 제어문자를 심는다: 강조는 \c[2]…\c[0] 8자(commandBodyCore.ts:340), 변수 \v[1] 5자, 이름 \n[1] 5자, 대기 \! 1자. 런타임 파서(src/player/dialogue.ts:625-708)는 이들을 문자가 아닌 제어로 소비하고, 미리보기(commandPreview.ts:304-346)는 실제 폭으로 그려 "반각 공백" 배지 등을 해당 위치에 넣는다(openwiki/editor-event-commands.md:112). 영향: 45자 문장에 강조 도구만 적용해도 maxLine이 53이 되어 "권장 길이를 넘김: 1줄 / 최대 53자" 오표시 — 실제 게임 창에는 여유가 있어도 저작자가 문장을 줄이게 만든다. 얼굴 포함 38자 기준(faceAware)도 같은 왜곡을 받는다. 수정 제안: 힌트 계산 전에 parseDialogueText로 제어문자를 걸러 실제 표시 문자만 세거나(예: resolveDialogueText), 세그먼트 텍스트 길이 합으로 계산한다.

저심각도 일괄:
- [EE-04-10] (low) displayTextSettings 폼이 undefined 불린을 false로 렌더해, 편집 한 번에 런타임 기본(true)이 false로 박제된다 — `src/editor/panels/eventEditor/commandBodyCore.ts`
- [EE-04-11] (low) 선택지 프롬프트 미리보기가 제어문자를 해석하지 않는다 — 본문과 같은 창에 원문 \v[1]이 노출된다 — `src/editor/panels/eventEditor/commandPreview.ts`
- [EE-04-8] (low) 인스펙터 편집 컨텍스트가 getCurrentCommand 계약을 이행하지 않는다 (현재는 매 입력 전체 재렌더에 가려진 잠재 위반) — `src/editor/panels/eventEditor/commandInspector.ts`
- [EE-04-9] (low) 알 수 없는 emotion 값이 첫 편집에서 조용히 삭제된다 — `src/editor/panels/eventEditor/commandBodyCore.ts`

### 5.5 EE-05 — 명령 폼 — 이동·경로·장소전환

**[EE-05-1] (medium) «특정 이벤트» 선택 즉시 빈 id 커밋으로 기존 대상(주인공 등)이 조용히 «이 이벤트»로 저장된다**
`src/editor/panels/eventEditor/commandBodyRoute.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyRoute.ts:266-271, 55-59. targetSelect change 핸들러가 값 확정 전에 즉시 apply()를 호출한다: `targetSelect.addEventListener("change", () => { if (targetSelect.value !== "event") eventIdIn.value = ""; ... apply(); renderPreview(); })`. resolvedEventId()는 `targetSelect.value === "event"`일 때 `eventIdIn.value.trim()`을 그대로 돌려주므로(55-59행), «주인공» 상태에서 «특정 이벤트»만 골라도 eventIdIn이 빈 문자열(주인공 선택 시 267행에서 지워짐)이어서 eventId: "" 가 저장된다. "" 는 targetKindOf에서 "this"로 해석되는 정센털(31-32행 `id === "" ? "this" : "event"`)이라, 저장된 명령은 조용히 «이 이벤트 이동»으로 바뀐다. 사용자가 목록에서 이벤트를 고르기 전에 창을 닫으면 주인공 경로가 이 이벤트 경로로 바뀌고, 재열면 targetKindOf("")="this" 때문에 select가 «이 이벤트»로 튕겨 사용자는 자기 선택이 사라진 것조차 볼 수 없다. 미리보기 카드는 targetName("")="이 이벤트"를 보여 select 표시(«특정 이벤트»)와도 어긋난다. 수정 제안: «특정 이벤트» 선택 시점에는 apply를 미루고(targetKind만 UI 상태로 유지), eventId가 비었으면 저장을 «이 이벤트»로 강등하지 말고 직전 target 값을 유지하거나 픽커 상태에 «대상을 고르세요» 경고를 띄울 것.

**[EE-05-2] (medium) routeParameterDrafts 모듈 맵이 경로(인덱스) 키로 이벤트·다이얼로그 사이에 새어 다른 명령에 낡은 파라미터를 주입한다**
`src/editor/panels/eventEditor/commandBodyRoute.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyRoute.ts:18,22-23,205-207. `const routeParameterDrafts = new Map<string, MoveRouteCommandContext>()`가 모듈 수준에서 영원히 유지되고, 키는 `context.path.join(".")`(22행)뿐이다. path는 숫자 인덱스 배열(CommandEditContext.path: number[])이라 이벤트·맵·다이얼로그 세션을 구분하지 못한다. 즉 A 이벤트 «0.5» 경로의 moveEvent에서 효과음/NPC 맵 이동 값을 고쳤으면, 다른 이벤트의 페이지 0 명령 5 moveEvent를 열 때 `routeParameterDrafts.get(parameterKey) ?? inferRouteParameters(cmd.route.moves)`(23행)에 의해 그 낡은 값이 입력칸에 시딩되고, «효과음 재생...»/«NPC 맵 이동...» 버튼을 누르면 그대로 새 단계로 저장된다. 독립 명령 편집 다이얼로그는 path: [] (commandEditDialog.ts:65-66)를 쓰므로 그 경로로 연 모든 moveEvent가 하나의 키를 공유한다. inferRouteParameters의 «명령에서 되읽기» 로직이 사실상 무력화된다. 맵은 삭제되지도 않아 세션 내내 누적된다. 수정 제안: 키에 mapId/eventId/pageId를 포함하거나, 다이얼로그 닫힘 시 해당 키를 삭제하고 스코프를 편집 세션으로 한정할 것.

**[EE-05-3] (medium) Pathfind Move 기록 경로가 실패한 목적지를 authored 고정값(보통 0)으로 대체해 인터프리터의 invalidInput 판정과 불일치한다**
`src/player/interpreter/m2ModernRuntime.ts` · 최종 medium · 확인 · 확신 high
위치: src/player/interpreter/m2ModernRuntime.ts:41-49 (특별 지시 «변수 좌표 폼→런타임 해석 불일치» 추적 결과). executeModernCommand의 "Pathfind Move"는 `const destination = resolveDestination(fields, ...)` 후 실패 시 `x: destination.ok ? destination.x : authored.x.fixedValue, y: ...` 로 기록한다. coordinateAxisSpec의 fixedValue는 없는 키를 0으로 읽는다(coordinateDestination.ts:123-131,136-145). 반면 정식 인터프리터 경로(player/interpreter/commandCatalog.ts:206-215)는 동일 실패를 invalidInput으로 보고하고 이동 단계를 아예 내지 않는다. 즉 변수 축의 변수가 미선택/미설정이거나 고정값이 음수·소수인 명령은 실제로는 움직이지 않으면서 세션 기록에는 «(0,0) 또는 낡은 고정값으로 이동»이라는 그럴듯한 목적지가 남는다. coordinateDestination.ts:5-7 헤더가 «원래 결함 — 값이 없으면 (0,0)으로 조용히 떨어진다»의 재발 방지를 이유로 쓰여 있는데, 기록 표면에서 같은 결함이 부활한 형태다. 기록에는 onFailure/fallback/결과 코드도 전혀 실리지 않아 성공·실패를 구분할 수 없다. 수정 제안: destination 실패 시 fixedValue 대체를 없애고 { failed: true, reason } 형태로 기록하거나 기록 자체를 생략할 것.

**[EE-05-4] (medium) commitAfterPointerGesture 큐가 취소·닫기 이후에도 실행되어 «버린다»는 선택을 덮어쓰고, 낡은 flush 타이머가 다음 제스처의 큐를 배수한다**
`src/editor/panels/eventEditor/commitAfterPointerGesture.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/panels/eventEditor/commitAfterPointerGesture.ts:7-8,16-34. 큐(`queued: (() => void)[]`)는 pointercancel/pointerup 후 setTimeout(flush,0)으로 무조건 비워지고, 취소·파기·언마운트 시 큐를 버리는 API가 없다. 실제 사용처(src/editor/panels/eventEditor/modal.ts:531-535, 이벤트 이름 change → commitAfterPointerGesture(() => updateEvent(...)))에서: 이름을 고치고 «취소»를 누르면 pointerdown(취소) → blur → change → 커밋이 큐에 쌓이고, pointerup 뒤 click으로 requestClose()가 먼저 실행되며, 그다음 0ms 타이머의 flush가 이미 닫히는/파기 대기 중인 다이얼로그에 대해 updateEvent로 이름을 스토어에 기록한다. «취소는 변경을 버린다»는 계약이 깨지고, 파기 확인 대화 상자가 열려 있는 동안에도 데이터가 써진다. 또한 release는 제스처 세대를 추적하지 않아(pointerDown 불리언 하나, 18-25행), 첫 제스처의 flush 타이머가 두 번째 제스처 도중에 실행되어 큐 전체(두 번째 제스처에서 막 쌓인 커밋 포함)를 배수한다 — 모듈이 막으려던 «클릭 성립 전 커밋»이 두 번째 클릭에 재현된다. 수정 제안: flush 전 큐를 무효화하는 cancel() 훅을 두고 다이얼로그 닫힘/파기에서 호출하고, 큐를 제스처 id별로 분리해 낡은 타이머가 새 제스처의 큐를 비우지 못게 할 것.

**[EE-05-5] (medium) 맵·타일셋 부재 시 drawTransferMapPreview가 해결로 끝나 호출자의 .catch 폴백이 도달하지 않고 오래된/빈 캔버스를 무경고로 남긴다**
`src/editor/panels/eventEditor/transferMapPreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/transferMapPreview.ts:38-41. `if (!map || !tileset) return;` — async 함수 안의 조기 return은 Promise를 '해결'로 끝낸다. 호출자 셋 모두 실패 폴백을 .catch에 걸어 두었다(transferPlayerDialog.ts:94-110, mapPointDialog.ts:84-94, previewMoveRoute.ts:63-73). 따라서 맵의 tilesetId가 실종(타일셋 삭제·가져오기 불량)되면 drawTransferFallback의 파란 대체 캔버스+이벤트 마커가 아예 실행되지 않고, 캔버스는 이전 맵의 오래된 그림(또는 빈 캔버스)을 그대로 보여준다. 상태 라벨(예: transfer-player-target, map-point-status)은 새 맵 이름·좌표를 정상적으로 갱신하므로 사용자·AI는 «미리보기가 맞다»고 믿고 좌표를 확정할 수 있다. loadTilesetImage 실패(진짜 reject) 때만 폴백이 살아 있어, 데이터 결함과 네트워크 결함의 처리 경로가 갈라져 있다. 수정 제안: map/tileset 부재 시 `throw`하거나 호출자가 해결값(예: { drawn: false })을 검사해 폴백+상태 경고를 트리거할 것.

저심각도 일괄:
- [EE-05-10] (low) 캔버스 이벤트 마커 폰트에 CSS var()를 대입해 무효 할당으로 조용히 무시된다 — `src/editor/panels/eventEditor/transferMapPreview.ts`
- [EE-05-11] (low) 컨텍스트 명령 버튼이 값 결손 시 null로 조용히 무반응이 되어 죽은 버튼이 된다 — `src/editor/panels/eventEditor/moveRouteCommandCatalog.ts`
- [EE-05-12] (low) 좌표 이동 리치 폼의 라우팅이 title 문자열 단일 비교여서 요약 경로(id 폴백 있음)와 파열점이 다르다 — `src/editor/panels/eventEditor/commandBodyM2Coordinate.ts`
- [EE-05-13] (low) skippable·NPC 이동·줌 배율의 용어가 표면마다 달라 같은 기능을 세 개의 이름으로 부른다 — `src/editor/panels/eventEditor/commandBodyRoute.ts`
- [EE-05-14] (low) 이동 대상 검색 픽커의 combobox 구현이 하이라이트를 스크린리더에 알리지 않고 Space 선택도 불가하다 — `src/editor/panels/eventEditor/moveRouteTargetPicker.ts`
- [EE-05-15] (low) «(직접 입력)» 그래픽 옵션 선택이 조용히 무시되어 셀렉트·원시 입력·미리보기 칩의 표시가 어긋난다 — `src/editor/panels/eventEditor/moveRouteDialogParts.ts`
- [EE-05-6] (low) 페이지 자율 이동 다이얼로그의 미리보기가 skippable·wait를 누락해 «이동 불가 시 건너뜀» 토글이 미리보기에 아무 반영이 없다 — `src/editor/panels/eventEditor/moveRouteDialog.ts`
- [EE-05-7] (low) 주인공(@player) 대상 경로의 맵 오버레이가 편집 중 이벤트 위치를 시작점으로 그려 실제 이동 주체와 다른 궤적을 제시한다 — `src/editor/panels/eventEditor/previewMoveRoute.ts`
- [EE-05-8] (low) 이동 경로 파라미터 숫자칸이 parseInt로 파싱해 좌표 폼의 Number 파싱과 불일치하고 체공 센티널을 조용히 없앤다 — `src/editor/panels/eventEditor/commandBodyRoute.ts`
- [EE-05-9] (low) 맵 포인트 다이얼로그는 열 때는 좌표를 클램프하지 않아 맵 밖 마커가 보이지 않고 범위 밖 좌표가 그대로 확정된다 — `src/editor/panels/eventEditor/mapPointDialog.ts`

### 5.6 EE-06 — 명령 폼 — 상점·경제·가중분기·창고·경험치

**[EE-06-1] (medium) set_shop_stock AI 도구가 첫 shop 커맨드의 itemIds·stock을 통째로 대체해 기존 진열 상품과 가격 오버레이를 유실한다**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:1248-1271. 증거: `existing.itemIds = uniqueStockItemIds(stock); existing.stock = [...stock];`(1254-1255, 페이지 루프라 1265-1266도 동일) — 첫 shop 커맨드를 발견하면 어디서도 병합하지 않고 무조건 교체한다. 루프가 `for (const page of event.pages ?? [])`라 여러 페이지가 각자 shop 커맨드를 갖는 상인(계절별 진열 페이지 등)은 모든 페이지의 상점이 동일한 stock으로 덮인다. 요약 문구는 `상점 재고 N개 설정`(1100)뿐이라 기존 진열이 사라졌다는 사실을 말하지 않는다. 영향: 10개 진열에 계절 가격 1개를 '추가'하려고 set_shop_stock을 부른 AI 세션이 나머지 9개 상품과 priceOverride·priceBySeason·seasons 오버레이를 조용히 전부 삭제한다. 이는 에디터 쪽 계약(shopEditorModel.ts:42-46 withShopItems "preserve every remaining overlay field", shopEditorGoods.ts:148-157 patch의 보존 로직, 위키 editor-event-commands.md L95 "기본으로 돌리면 priceOverride만 제거하고 … 보존한다")과 정면으로 어긋난다. 수정 제안: (1) 기존 stock을 itemId 키로 병합하는 모드를 기본으로 두고 교체는 merge:"replace" 처럼 명시 옵션으로, (2) 최소한 기존 itemIds 중 사라진 상품이 있으면 경고를 결과에 남기고, (3) 여러 페이지 상점 커맨드를 발견하면 첫 것만 고치거나 경고를 낸다.

**[EE-06-2] (medium) set_shop_stock·make_villager의 itemId 검증이 database.items만 보아 장비 상품을 AI가 진열할 수 없다**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:1202-1208. 증거: `if (!project.database.items.some((item) => item.id === itemId)) throw new ToolError(…존재하지 않는 itemId…)` — itemIdArg는 items 배열만 검사한다. 그러나 에디터·런타임은 장비를 정식 진열 상품으로 취급한다: shopEditorModel.ts:27-35 shopCatalogRecords는 `project.database.equipment`를 아이템 뷰로 병합해 "Items and equipment share a display catalog"라고 주석하며, 런타임 goodsIndex(src/player/playSceneShopGoods.ts:121-130)도 equipment를 ShopGoods로 등록하고 shopPrice.ts:67-68도 items→equipment 순으로 가격를 찾는다. 영향: 무기·방패·갑옷·투구·장신구 상점을 set_shop_stock이나 make_villager({shop})로 저작하면 유효한 equipment id임에도 ToolError(item-not-found)로 실패한다. AI는 get_database_records로 확인한 '실존하는' id를 썼는데도 거절되므로 자가수정 루프로도 빠져나오지 못한다. 수정 제안: itemIdArg가 items에 없으면 database.equipment를 폴백 검사하고, 에디터 카탈로그와 같은 기준(items∪equipment)으로 통일한다.

**[EE-06-3] (medium) 명령 폼 스위치·변수 피커가 삭제된 레코드 id를 조용히 「(선택)」으로 떨어뜨린다 — U07 'Missing IDs remain explicit'이 명령 본문에는 미적용**
`src/editor/panels/eventEditor/commandBodyWeightedBranch.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/switchVariablePicker.ts:58-61 — `if (options.keepMissingId && options.selectedId && !list.some(…))` keepMissingId 옵트인 시에만 유령 id를 옵션으로 남긴다. 이 옵트인은 pageConditionControls.ts:35,62(페이지 조건)에서만 쓰이고, 명령 본문 피커는 전부 미지정이다: 가중 분기 결과 변수(commandBodyWeightedBranch.ts:31 databasePicker), 경험치량 변수(commandBodyExp.ts:22-26 variablePicker), 상자 잠금 스위치(commandBodyStorageChest.ts:103). 삭제된 변수를 가리키던 명령을 열면 `select.value = options.selectedId`가 실패해 값이 ""로 떨어지고 트리거는 labelOf("")="(선택)"이 된다(switchVariablePicker.ts:61,63-71). 영향: (a) 가중 분기는 폼엔 '미선택'으로 보이지만 지역 resultVariableId에 유령 id가 살아 있어 런타임이 `session.variables[유령id] = index`(m2ModernRuntime.ts:290)를 계속 쓴다. …

**[EE-06-4] (medium) 상자 잠금 스위치가 삭제된 스위치를 가리키면 어디에도 진단이 없고 상자가 영구히 잠긴다**
`src/editor/panels/eventEditor/commandBodyStorageChest.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyStorageChest.ts:103-106(잠금 스위치 피커), 167(`lockSwitchId.current.trim() ? { lockSwitchId: … } : {}`). 피커는 keepMissingId 미지정이라 삭제된 스위치 id가 화면에선 "(선택)"으로 사라지고(EE-06-3), 그런데 apply()는 지역 값(유령 id)을 계속 다시 저장한다. 검증 공백: src/editor/eventDraftValidator.ts:1115 `case "openChest": return;` — openChest는 참조 검증이 하나도 없어 lockSwitchId가 실존 스위치인지 아무도 따지지 않는다. 런타임: src/project/storageChest.ts:200-201 `if (presentation.lockSwitchId && !getSwitch(session, …)) return { locked: true, reason: "아직 열 수 없습니다." }` — 유령 id는 setSwitch로 켤 방법이 없으니 상 사자는 '아직 열 수 없습니다'만 보는 콘텐츠 봉인 상태에 빠지고 원인(삭제된 스위치)은 편집기·진단 어디에도 안 보인다. 수정 제안: (1) commandBodyStorageChest의 databasePicker에 keepMissingId 부여 또는 유령 표시, (2) eventDraftValidator의 openChest 케이스에서 lockSwitchId/lockItemId 참조 검증 추가(switch→refs.switches, item→refs.items).

**[EE-06-5] (medium) 상자 양식 변경 시 토글 체크박스가 이전 양식 기준값으로 고정되어 새 양식의 시그니처 설정을 조용히 무효화한다**
`src/editor/panels/eventEditor/commandBodyStorageChest.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyStorageChest.ts:97-101(체크박스는 열 때의 resolved(cmd)로 초기화), 145-171(apply의 baseline은 `resolveStorageChest({ template: selectedTemplate })` — 새 양식 기본값만), 181(`template.addEventListener("change", apply)` — 양식이 바뀌어도 체크박스를 재동기화하지 않음). 시나리오: 농장 상자(showIcons=true, allowBulk=true, goldVault=false 기본)를 열어 양식을 '금고'로 바꾸면 goldVault 체크박스는 계속 미체크인데, apply는 `goldVault.checked(false) !== baseline.goldVault(true)`(166)가 참이라 `{ goldVault: false }`를 명시 저장하고, allowBulk도 `checked(true) !== baseline(false)`(163)로 true를 저장한다. 즉 사용자는 '양식: 금고' 하나만 바꿨다고 믿지만 저장된 명령은 금고의 핵심인 골드 금고·대량이동 제한을 농장값으로 덮어쓴 상태고, 역방향(금고→농장)에서는 goldVault:true인 농장 상자가 된다. TEMPLATE_DEFAULTS(storageChest.ts:61-92)가 약속하는 양식 정체성이 폼 상태에 파묻혀 무효화된다. 수정 제안: template change 핸들러에서 baseline=resolveStorageChest({template}) 기준으로 체크박스·capacity 표시를 재동기화(사용자가 명시적으로 건드린 값만 유지)하거나, 양식 변경 시 "기존 개별 설정이 우선합니다" 배지를 보여 준다.

**[EE-06-6] (medium) 창고 「넣을 수 있는 종류」에서 전체 미체크가 '아무것도 불가'가 아니라 '전부 허용'이다 — UI가 정반대로 읽힌다**
`src/editor/panels/eventEditor/commandBodyStorageChest.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyStorageChest.ts:116-120(박스 초기값은 `(cmd.allowedItemTypes ?? []).includes(...)`라 제한 없는 상자는 전부 미체크로 렌더), 153(`allowedBoxes.filter((entry) => entry.box.checked)`), 169(`allowedItemTypes.length > 0 ? { allowedItemTypes } : {}` — 0개면 필드 생략). 런타임 의미는 src/project/storageChest.ts:160 `if (allowed.length === 0) return true;` — 빈 목록=모든 종류 허용이다. 그러나 섹션 UI(242-248)에는 이 규약에 대한 안내가 한 줄도 없어, 제한 없는 상자를 열면 11개 박스가 전부 비어 있고 저작자는 '아무것도 못 넣는 상자'로 읽는다. 반대로 '전부 허용' 의도로 11개를 모두 체크하면 명시적 목록이 저장되어 미래에 추가되는 ItemType이 자동으로 배제된다. 수정 제안: (1) 섹션에 "아무 것도 선택하지 않으면 모든 종류를 넣을 수 있습니다" 힌트 추가, (2) 전체 미체크 시 '모든 종류 허용' 요약 배지 표시, 또는 (3) all-unchecked 상태를 명시적 '제한 없음' 세그먼트로 모델링한다.

**[EE-06-8] (medium) 흥정 경제 카드가 정규화된 값을 보여 주고 원본(raw)을 저장해 표시값≠저장값이 영속한다**
`src/editor/panels/eventEditor/commandBodyShopEconomy.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyShopEconomy.ts:25 `const haggle = normalizeHaggleConfig(latest().economy?.haggle);`(표시는 정규화) vs 66-70 patchHaggle `economy: { …current.economy?.haggle, …patch }`(저장은 raw 병합). 로드 계약은 범위가 더 넓다: src/project/io/shapeCommandFields.ts:725-728 `patience 0..999, insultRatio 0..1, maxDiscount 0..1` — 예컨대 파일에 insultRatio:0.2가 있으면(레거시/AI 작성) 로드는 통과하고 폼은 40(%)으로 보여 주지만, 사용자가 최대 할인율만 고쳐도 patchHaggle은 0.2를 그대로 보존해 저장한다. 런타임은 normalizeHaggleConfig(playSceneShop.ts:324)로 0.4로 읽으니 게임 동작은 화면과 일치하지만, 프로젝트 파일·감사 diff·프로젝트를 읽는 AI 도구는 0.2를 보게 되어 '화면의 40%'와 영속적으로 어긋난다. 또한 numberRow의 빈 입력은 next=undefined로 저장되어(103-108) 런타임 기본값(예: 60%)으로 무음 복귀되는데 이것도 화면에 안내가 없다. 수정 제안: patchHaggle이 merge 후 normalizeHaggleConfig로 재수렴해 저장하거나, 최초 편집 시 정규화된 값을 기준으로 haggle 객체를 재작성하고 범위 밖 보정 사실을 힌트로 표기한다.

**[EE-06-9] (medium) shopServiceKind 로드 검증이 requireString뿐이라 미지원 값이 로드를 통과한 뒤 런타임에서 무음 무시된다**
`src/editor/panels/eventEditor/commandBodyShop.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeCommandFields.ts:362 `if (…shopServiceKind !== undefined) requireString(…)` — 문자열만 확인하고 열거 검증은 없다. 반면 같은 shop 케이스의 형제 필드는 전부 닫힌 집합 검증을 한다: shopType(372-375), quantityMode(368-370), shopUiPreset(376-381), restockPolicy(391-395 — "조용한 오답보다 로드 시점 오류가 낫다"는 주석 388-390). 에디터 폼(commandBodyShop.ts:131-148)이 쓰는 정션은 ""/repair/appraisal/pawn뿐인데, AI나 손 편집으로 "blacksmith" 같은 값을 넣으면 로드가 통과하고 런타임은 어느 분기에도 걸리지 않는다: playSceneShop.ts:78-80(svc==="appraisal"/"repair" 비교), playSceneShopDom.ts:593-597 shopTitle switch(default=일반 상점 제목), 118-124 shopTagline. 결과는 '서비스 상점이 조용히 일반 상점으로 동작'하는 것이고 경고 0건 — 같은 파일 696-699의 검증 철학("haggleEnabled:"yes" … 조용히 꺼진다" 문제)을 shopServiceKind만 적용하지 않은 셈이다. 수정 제안: validateShopCommand의 shop 케이스에 shopServiceKind ∈ {repair,appraisal,pawn} 열거 검증을 추가하고, 알 수 없는 값은 ProjectFormatError로 승격한다.

저심각도 일괄:
- [EE-06-10] (low) 상인 매입 예산 입력이 parseInt라 과학적 표기(1e3)를 1G로 잘라 저장한다 — `src/editor/panels/eventEditor/commandBodyShop.ts`
- [EE-06-11] (low) 상품 직접 가격 입력이 빈/비숫자 입력을 오류 안내 없이 이전 값으로 무음 복귀시킨다 — `src/editor/panels/eventEditor/shopEditorGoods.ts`
- [EE-06-12] (low) 상품 행 렌더마다 startSession(project)으로 전체 플레이 세션을 새로 만든다 — 클릭·편집마다 불필요한 대형 할당 — `src/editor/panels/eventEditor/shopEditorGoods.ts`
- [EE-06-13] (low) 가중 분기 결과 추가의 자동 이름이 기존 라벨과 충돌한다 — 삭제 후 재추가 시 '결과3'이 두 개 — `src/editor/panels/eventEditor/commandBodyWeightedBranch.ts`
- [EE-06-14] (low) 창고 칸 수에 0·음수를 입력하면 무음으로 '무제한'이 되고 입력칸에는 잘못된 값이 그대로 남는다 — `src/editor/panels/eventEditor/commandBodyStorageChest.ts`
- [EE-06-7] (low) 공유 상자 전환 시 빈 이름에 자동 기본값 shared_storage를 써서 무관한 상자들이 하나의 보관함을 몰래 공유한다 — `src/editor/panels/eventEditor/commandBodyStorageChest.ts`

### 5.7 EE-07 — 명령 폼 — M2·변수·루프·Page3·고급·DB조작·필드스폰

**[EE-07-1] (high) removeFollower 폼이 빈 이름을 무음으로 「모두 제거(all:true)」로 변환 커밋한다 — 위키 U06 계약과 정반대**
`src/editor/panels/eventEditor/commandBodyAdvanced.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyAdvanced.ts:518-522 — commit이 `mode.value === "all" || !followerName ? { kind: "removeFollower", all: true } : { kind: "removeFollower", name: followerName }` 로, 이름 모드에서 이름을 비우면(공백 포함) 조용히 `all: true`(모두 제거)로 저장한다. name 입력(L507-512)에는 required·유효성 연계가 없고, 다이얼로그 Confirm 게이트는 validateWeightedBranchForm/validateBattleProcessingForm뿐이다(src/editor/panels/eventEditor/commandEditDialog.ts:160). 그러나 정본 위키 openwiki/editor-event-command-fixes.md:86(U06, 2026-09-06)은 "Empty or whitespace-only individual names remain incomplete; the existing form-validation event blocks Confirm and focuses the name"이라고 기록한다 — 즉 위키의 보정 주장이 코드에 반영돼 있지 않고, U06 회귀 테스트 파일(test/eventCommandRemediation/U06.test.ts)도 소실돼 있다(EE-07-18). 영향: 특정 팔로워 하나를 지우려던 명령이 세션의 팔로워 전원을 지우는 명령으로 저장돼 런타임 의도가 정반대가 된다. …

**[EE-07-2] (high) playMovie 폼의 대기/스킵 토글이 표시·저장 모두 런타임과 반대 — 「아니오」를 골라도 런타임은 대기·스킵 허용**
`src/editor/panels/eventEditor/commandBodyPage3Native.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyPage3Native.ts:1004-1013 — 두 토글 모두 `value: cmd.wait === true ? "true" : "false"` 로 마운트해, wait/skippable이 **생략된**(런타임 기본=true) 명령을 「아니오」로 표시하고 renderCaption(1058-1061)도 "대기 없이 다음 명령 진행"/"건너뛰기 불가"로 거짓 안내한다. commit(1071-1075)은 `...(wait.select.value === "true" ? { wait: true } : {})` — 「아니오」를 고르면 필드를 생략해 저장한다. 그러나 런타임은 src/player/interpreter/commandCatalog.ts:927-928 `wait: command.wait !== false, skippable: command.skippable !== false` 로 생략=true이고, 정본 위키 editor-event-command-fixes.md:70(U04)은 "Play Movie treats omitted wait and skippable as true. Switching either off stores explicit false"라고 못박는다. 이중 반전 결과: (a) 열자마자 표시값이 런타임과 반대, (b) 「아니오」로 확정해도 저장값이 생략이라 런타임은 여전히 대기·스킵허용 — 사용자는 wait=false/skippable=false를 영원히 저작할 수 없다. …

**[EE-07-3] (high) showPicture 네이티브 폼이 waitForPicture 토글 없이 커밋에서 삭제 — 컷신이 심은 대기 플래그가 무관한 편집 한 번에 유실**
`src/editor/panels/eventEditor/commandBodyPage3Native.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyPage3Native.ts:1141-1157 — commit이 `{ kind: "showPicture", pictureId, resourceId, x, y, scale, opacity, rotation, durationMs }`를 **통째로 재구성**해 waitForPicture 키가 없고, 폼에는 waitForPicture 토글 자체가 없다. 그러나 (1) 타입이 `waitForPicture?: boolean`을 갖고(src/project/types/events.ts:402), (2) 런타임이 소비하며(src/player/interpreter/commandCatalog.ts:606-607 `waitForPicture: command.waitForPicture` → RuntimeDomOverlay.waitForPicture 계약), (3) 스키마 카탈로그가 `waitForPicture: f.bool("완료까지 대기", { optional: true })`로 선언하고(src/editor/eventCommands/schema/catalog.ts:528), (4) 컷신 컴파일러가 실제로 심는다(src/editor/cutscene/index.ts:330 `waitForPicture: forceNonBlocking ? false : beat.waitForPicture ?? beat.wait` — 회상 오프닝 프리셋 포함).  …

**[EE-07-5] (high) Change Battle Commands 폼이 정본(target=배우ID)을 「파티 전체」로 마운트하고 첫 편집에 무음 확대, 저장은 폐기된 구형 셰이프로**
`src/editor/panels/eventEditor/commandBodyM2Actor.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyM2Actor.ts:1116-1118 — `value: String(fields.target ?? "party") === "actor" ? "actor" : "party"` — 정본 셰이프(target에 배우 id를 직접 저장)로 저장된 명령(target:"actor_hero")이 "actor" 문자열이 아니므로 무조건 「파티 전체」로 마운트되고, 배우 피커는 구형 필드만 읽는다(`selectedId: String(fields.actorId ?? "")`, L1122-1124). 런타임과 계약 테스트는 정본을 확정한다: src/player/interpreter/m2Runtime.ts:361-365("store the actor ID directly" — target==="actor"일 때만 actorId를 읽음), test/commandContracts/m2Command.contract.test.ts:91(`{ target: "actor_hero", ... }`). commit(1144-1150)은 `target: mode.select.value` — 즉 정본 명령에서 연산/커맨드만 바꿔도 target이 "party"로 덮여 **개인 대상이 파티 전체로 무음 확대**된다. …

**[EE-07-10] (medium) M2 스위치/변수 필드의 이름 카드가 첫 렌더에서 존재하는 레코드도 「목록에 없는 항목」으로 거짓 표시 (U07 위반)**
`src/editor/panels/eventEditor/commandBodyM2.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyM2.ts:655 — `let selectedName = options.value ? `목록에 없는 항목: ${options.value}` : "선택 없음";` — 마운트 시 레코드를 조회하지 않고 항상 부정 라벨로 초기화한다(정확한 해석은 onChange L668-671에서만). 같은 파일의 recordPickerControl(L681)은 `items.find(...)`로 실제 이름을 풀어주는데 스위치/변수 컨트롤만 빠져 있다. 정본 위키 editor-event-command-fixes.md:93(U07): "switch/variable names resolve on first render" — 재검증 결과 미반영. 영향: m2-011/012 계열 명령에서 스위치가 실재하는데도 이름 카드가 「목록에 없는 항목: sw_x」이라 저작자가 참조 깨짐으로 오해하거나, 반대로 깨진 참조를 실재하는 줄 착각할 여지를 만든다. 수정: 마운트 시점에 store에서 이름을 조회해 초기 라벨을 채운다(labelOf 패턴 재사용).

**[EE-07-11] (medium) 「좌표로 이동」 폼이 특정 이벤트 미선택 상태로 target:""을 저장하고, 재오픈하면 「이 이벤트」로 침묵 재해석된다**
`src/editor/panels/eventEditor/commandBodyM2Coordinate.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyM2Coordinate.ts:226-230 — `resolvedTarget()`는 「특정 이벤트」 모드에서 `targetInput.value.trim()`을 그대로 돌려주므로 빈 입력이면 "" 이고, commit(232-253)이 `target: resolvedTarget()`을 즉시 저장한다. target.select의 change 핸들러(300-307)는 세그먼트 선택만으로 commit()을 부르므로, 「특정 이벤트」를 눌렀다가 다른 필드(속도 등)를 고치기만 해도 target:""이 저장된다. 재오픈 시 `targetKindOf("")`(L415-419)는 "this-event"로 재해석해 사용자가 고른 「특정 이벤트」 의도가 「이 이벤트」로 침묵 변환되고, 대상 미선택 경고·Confirm 차단도 없다(픽커 상태 표시 targetStatus만 있음). OPRN-OUT-013 위키(editor-event-commands.md:39-43)가 재사용을 강제하는 eventTargetCatalog 계약(외부 id 거부·정본 값)과도 어긋난다. 수정: 빈 입력 상태의 특정 이벤트 커밋을 막고(경고 + 대상 픽커 포커스), target:"" 저장을 금지한다.

**[EE-07-12] (medium) M2 「애니메이션 표시」 폼도 이벤트 미선택 커밋이 target:""을 저장해 재오픈 시 「주인공」으로 되돌아간다**
`src/editor/panels/eventEditor/commandBodyM2Page3.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyM2Page3.ts:1257-1261 — `target: target.select.value === "player" ? "player" : event.select.value` — 「이벤트」 모드에서 이벤트 미선택이면 target:""이 저장되고, 재오픈 시 targetMode 계산(L1233-1236: `targetRaw === "player" || !targetRaw ? "player" : "event"`)이 빈 값을 「주인공」으로 되돌린다. 맵 이벤트를 대상으로 맞춰둔 애니메이션이 확인 한 번에 주인공 대상으로 바뀐다. 수정: 이벤트 모드에서 빈 선택 커밋을 막거나 유령 id 옵션으로 명시 표시(EE-07-4 수정과 동일 기반).

**[EE-07-13] (medium) showEmote 폼이 「다른 이벤트」 미입력 커밋을 {eventId:""}로 저장해 재오픈 시 「이 이벤트」로 되돌아간다**
`src/editor/panels/eventEditor/commandBodyPage3Native.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyPage3Native.ts:734-760 — emoteTargetKind는 `target.eventId.trim() ? "event" : "self"`로 재해석하고, commit(744-752)은 「다른 이벤트」 모드에서 `target: { eventId: eventId.value.trim() }` — 빈 입력이면 `{eventId:""}`가 저장돼 재오픈 시 「이 이벤트」로 표시된다. EE-07-11/12와 같은 빈-식별자 커밋 가족. 이벤트 지정 폼들의 공통 수정(빈 선택 커밋 금지 + 유령 id 명시)으로 일괄 처리할 것.

**[EE-07-14] (medium) 루프 무한반복 경고가 중첩 루프 내부의 breakLoop를 부모 탈출로 오판해 무한 루프를 숨긴다 (U02 위반)**
`src/editor/panels/eventEditor/commandBodyLoop.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyLoop.ts:41-48, 77-88 — syncWarnings는 `currentBody.some(breakLoop) || walkHasBreak(currentBody)`로 경고를 숨기는데, walkHasBreak가 eventCommandBranches로 **중첩 루프 본문까지** 재귀한다(loopBody 분기 포함 확인: src/editor/eventCommandBranches.ts의 "loopBody" 열거). breakLoop는 가장 가까운 루프만 탈출하므로(위키 editor-event-authoring.md:595 stack.ts 가드 맥락), 안쪽 루프의 break가 있는 바깥 루프는 여전히 무한 반복인데 「반복 탈출이 없습니다」 경고가 숨겨진다. 정본 위키 editor-event-command-fixes.md:46(U02): "Break detection stops at nested loops, whose breaks cannot exit their parent" — 재검증 결과 미반영. 주석(L80-82)은 fork 1레벨 오탐을 고치며 전 분기 재귀로 가면서 중첩 루프 예외를 놓쳤다. 수정: walkHasBreak가 kind==="loop"인 자식 본문으로는 내려가지 않도록 중단점을 둔다.

**[EE-07-15] (medium) 루프 다이얼로그의 텍스트 행 편집이 speaker/emotion/autoAdvance를 소거한다 (U02 위반)**
`src/editor/panels/eventEditor/commandBodyLoop.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyLoop.ts:103-106 — `working[index] = { kind: "text", body: body.value }` — text 명령의 speaker/emotion/autoAdvance 필드(events.ts:267-277에 모두 존재)를 통째로 버린다. 위키 editor-event-command-fixes.md:46(U02): "Loop edits patch the current staged body, preserving unrelated children and text speaker/emotion/autoAdvance" — 형제 보존은 getCurrentLoop 병합(L50-53)으로 되지만, 텍스트 행 자체의 치환은 미반영. forkBranch.ts:108-111도 동일. 또한 루프 다이얼로그의 텍스트 아닌 자식(setSwitch 등)은 배지+삭제만 노출되고 전문 편집기 열기·안내가 없어(U02 "Every child can open the full command editor"와 불일치 — forkBody는 commandBodyCore.ts:933-936에 안내 문구가 있는데 loop에는 없음) 저작자가 루프 안 자식을 다룰 길이 막혀 있다. 수정: `{ ...command, body: body.value }` 스프레드로 보존하고, 자식 행에 전문 편집 열기 또는 안내 문구를 추가한다.

**[EE-07-16] (medium) addFollower의 「모습 직접 정하기」 체크박스가 한 번 켜진 graphic을 끌 수 없다(끄면 저장값 유지, 재오픈 시 되돌아옴)**
`src/editor/panels/eventEditor/commandBodyAdvanced.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyAdvanced.ts:445 — `const graphicEnabled = useGraphic.checked || Boolean(cmd.graphic);` — 이미 graphic이 저장된 명령에서 체크를 해제해도 graphicEnabled가 true로 남아 commit(453-461)이 graphic을 다시 저장한다(입력을 비우면 sprite 없는 잔체 graphic이 저장되기도 함). shouldRerenderCommandForm(commandEditDialog.ts:247+)에 addFollower 규칙이 없어 화면 갱신도 없고, 다시 열면 `useGraphic.checked = Boolean(cmd.graphic)`(L421)으로 체크가 되돌아온다 — 사용자는 커스텀 모습을 끌 수 없다. 참고: 위키 editor-event-command-fixes.md:87(U06)은 removeFollower 계열에서 "The live custom-graphic checkbox is the enable authority. Off removes the saved graphic"라는 반대 계약을 기록 — 형제 폼끼리 토글 의미가 정반대다. 수정: checkbox를 유일한 enable 권위로 삼아 off 시 graphic 키를 제거한다.

**[EE-07-18] (medium) 위키가 가리키는 U02·U04·U05·U06·U07 회귀 커버리지(단위/e2e/시나리오)가 전부 소실 — 정본 계약이 무방비 상태임이 본 리뷰에서 실증됨**
`openwiki/editor-event-command-fixes.md` · 최종 medium · 확인 · 확신 high
위치: openwiki/editor-event-command-fixes.md:51,74,82,89,97 — U02(loop/branch drafts), U04(picture/movie flags), U05(actor/operand drafts), U06(follower removal), U07(stable selections)의 회귀 커버리지로 `test/eventCommandRemediation/U02|U04|U05|U06|U07.test.ts`, `test/e2e/event-command-remediation-U02|U04|U05|U06.spec.ts`, `scripts/qa/runtime/event-command-remediation-u0*.scenario.mjs`를 가리키지만, 실측 glob 결과 test/eventCommandRemediation/에는 U03/U14/U28만 남아 있고 e2e·scenario도 동일하다. U07이 언급한 `setResourcePickerValue`는 src 전체에서 소비처 0개다. 이 결손의 실비용이 이번 리뷰에서 연쇄 확인됐다: 위키가 「수정 완료」라고 기록한 removeFollower 빈 이름 차단(EE-07-1), playMovie false 명시(EE-07-2), waitForPicture 보존(EE-07-3), U05 numeric source 존중(EE-07-7), U02 중첩 break 중단·speaker 보존(EE-07-14/15)이 전부 현재 코드에서 위반 상태다 — 정규 위키는 소스보다 약하므로 날짜 문서의 「커버리지」 주장도 실존 검증 대상이어야 한다. 수정: 위키의 커버리지 절을 실존 파일로 갱신하거나, 삭제된 테스트를 부활해 위 5계약을 다시 못박는다.

**[EE-07-4] (medium) 레코드 픽커 폼들이 삭제된 배우/이벤트 id를 「(선택)」으로 보여 주고, 무관한 필드 편집 커밋이 그 id를 빈 값으로 덮어써 유실한다**
`src/editor/panels/eventEditor/commandBodyM2Actor.ts` · 최종 medium · 확인 · 확신 high
위치(표시): src/editor/panels/eventEditor/recordPicker.ts:96-101 — `select.value = options.selectedId`에서 유령 id는 목록에 없어 select.value가 ""이 되고 카드는 `(주인공 선택)` 같은 placeholder(빈 값 취급)를 보인다. 위치(커밋): src/editor/panels/eventEditor/commandBodyM2Actor.ts:152-158 — `target: target.select.value === "party" ? "party" : actor.select.value` — 저장된 target이 삭제된 배우 id면 targetModeOf(L1184-1188)는 "actor" 모드로 열지만 picker select.value는 ""이라, 능력치 칩 클릭·연산 변경 같은 **무관한 편집 하나로 target이 "" 으로 저장**된다(원본 id 파괴). 같은 커밋 구조가 changeState(319-323), damageProcessing(445-450), changeActorName/Graphic/Faceset/Class 전부와 commandBodyM2Page3.ts의 setEventLocation(381-386), swapEventLocation(430-434), flashEvent(1322-1326), showAnimationM2(1257-1261)에 반복된다. …

**[EE-07-6] (medium) changeState 폼이 없는 상태 id를 첫 상태로 치환해 표시·커밋한다 (U07 「첫 값 금지」 위반)**
`src/editor/panels/eventEditor/commandBodyM2Actor.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyM2Actor.ts:257-261 — `if (currentStateId && !states.some(...)) currentStateId = states[0]?.id ?? "";` — 저장된 상태 id가 DB에서 삭제됐으면 첫 상태로 조용히 치환해 칩을 활성 표시하고, commit(318-324)은 그 값을 그대로 저장한다. 목록에 없던 값이라는 표시도 없다. 정본 위키 editor-event-command-fixes.md:93(U07): "Missing IDs remain explicit rather than becoming the first or empty value" — 이 폼은 정확히 "첫 값"이 된다. 영향: 독 상태가 삭제된 명령을 열고 대상만 바꿔 저장하면 의도치 않은 다른 상태(첫 상태)가 부여된다. 수정: 유령 id는 칩 목록에 「현재 값: <id> (삭제됨)」 행으로 남기고, 사용자가 새 상태를 고를 때만 덮어쓴다.

**[EE-07-7] (medium) valueSourceControls가 명시적 valueSource:"number"를 유령 valueVariableId 하나로 「변수」 모드로 반전 (U05 위반, 2벌 복제 모두)**
`src/editor/panels/eventEditor/commandBodyM2Actor.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandBodyM2Actor.ts:966-970과 그 복제본 commandBodyM2Page3.ts:1778-1782(setEncounterRate) — `String(cmd.fields.valueSource ?? "") === "variable" || Boolean(String(cmd.fields.valueVariableId ?? "").trim()) ? "variable" : "number"`. 두 번째 조건은 valueSource 키가 **없는** 옛 부분 저장본 구제용이지만, valueSource가 **명시적으로 "number"**인 경우에도 유령 valueVariableId가 남아 있으면 폼이 「변수」 모드로 열리고, 첫 편집 커밋(changeParameters L152-158, damageProcessing L445-450, setEncounterRate L1616-1626)이 valueSource:"variable"을 저장해 명시적 숫자 소스를 조용히 뒤집는다. 마운트 직후 프리뷰도 변수 라벨을 보여 준다. 정본 위키 editor-event-command-fixes.md:80(U05): "Change Parameters and Damage Processing honor explicit numeric source even when an inactive variable ID remains" — 재검증 결과 미반영(해당 U05 테스트 파일도 소실, EE-07-18). 수정: 구제 조건을 `cmd.fields.valueSource === undefined && valueVariableId`로 좁혀 명시 number를 존중한다.

**[EE-07-8] (medium) 스키마 operand 폼이 소스 전환 시 타이핑한 숫자를 폐기하고 빈 변수 id({kind:"var", id:""})를 즉시 커밋, 되돌림도 stale 값 복원**
`src/editor/panels/eventEditor/schemaCommandBody.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/schemaCommandBody.ts:275-316 — operand 필드(changeGold/changeItem amount가 유일한 라이브 경로. SCHEMA_RENDERED_KINDS 우선 라우팅, commandBody.ts:31-37)에서 (1) 모드를 「변수」로 바꾸는 순간 `patch({ [key]: useVar ? { kind: "var", id: varOperandId(value) } : asNumber(value) })`(L313)가 valueVariableId **미선택 상태의 {kind:"var", id:""}를 즉시 저장**하고, (2) 원래 숫자였다가 타이핑한 뒤 변수로 전환하면 그 숫자 초안은 버려지고, (3) 변수→숫자로 되돌리면 `asNumber(value)`가 렌더 시점 value를 복원해 사용자가 방금 입력한 숫자가 아니라 **렌더 시점 낡은 값**이 저장된다. commandBodyVariable.ts가 cachedNumber/cachedOperandVariableId로 같은 문제를 풀어둔 것(U07 위키 L592 계열)과 달리 스키마 경로는 초안 보존이 전혀 없다. 영향: 소스 전환만 했는데 확인을 누르면 소지금/아이템 수량이 빈 변수 참조(런타임에서 0/무효)로 확정될 수 있고, 되돌리기 편집도 유실된다. 특별 지시 「operand 초안(draft) 커밋 누락」 해당. 수정: 모드 전환은 표시만 바꾸고 커밋은 값 확정 시점에 하며, 숫자 초안·변수 초안을 캐시해 되돌림 시 복원하고, 빈 id operand의 Confirm을 막는다.

저심각도 일괄:
- [EE-07-17] (low) M2 Show Picture 리치 폼에 카탈로그 선언 필드 scale/opacity 편집칸이 없다(네이티브 폼과 편집 능력 불일치) — `src/editor/panels/eventEditor/commandBodyM2Page3.ts`
- [EE-07-19] (low) forkBranch.ts는 소비처가 없는 데드 모듈 — 낡은 텍스트 치환·stale fork 커밋 패턴을 그대로 품고 있다 — `src/editor/panels/eventEditor/forkBranch.ts`
- [EE-07-20] (low) changeGoldBody/changeItemBody가 스키마 라우팅 우선으로 도달 불가 — 죽은 배선이 testid 계약과 함께 이중 소유된다 — `src/editor/panels/eventEditor/commandBodyDatabase.ts`
- [EE-07-21] (low) setVariable 대상 빈-ID 에러의 마운트 조건이 「프로젝트에 변수 존재 여부」를 봐서 사실상 도달 불가 — 위키 「빈 ID 에러」 주장과 불일치 — `src/editor/panels/eventEditor/commandBodyVariable.ts`
- [EE-07-22] (low) removeLight 「하나만」+빈 이름 커밋이 id:""을 저장 — removeFollower와 빈-값 정책이 상반 — `src/editor/panels/eventEditor/commandBodyPage3Native.ts`
- [EE-07-23] (low) playAudio 폼이 channel/volume/fadeInMs 선택 필드를 편집 시 삭제한다 (렌더 안 한 필드의 무음 소거) — `src/editor/panels/eventEditor/commandBodyAdvanced.ts`
- [EE-07-24] (low) M2 날씨 폼의 parseWeatherValue가 숫자-only 저장값을 날씨 종류로 승격해 kind="0.8" 같은 무효 종류를 만든다 — `src/editor/panels/eventEditor/commandBodyM2Page3.ts`
- [EE-07-25] (low) M2 제네릭 select 필드가 목록에 없는 저장값을 첫 옵션으로 렌더해 표시가 거짓말이 된다 — `src/editor/panels/eventEditor/commandBodyM2.ts`
- [EE-07-26] (low) commandBodyDatabase.ts 4행 import 앞에 BOM(U+FEFF)이 박혀 있다 — `src/editor/panels/eventEditor/commandBodyDatabase.ts`

### 5.8 EE-08 — 이벤트 페이지 조건 편집

**[EE-08-1] (high) 조건 행 편집이 조건을 배열 끝으로 옮겨 스위치 슬롯 0/1 내용이 서로 맞바뀐다**
`src/editor/panels/eventEditor/pageConditions.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/pageConditions.ts:314-325(switchConditionInputs.apply), 동일 패턴 src/editor/panels/eventEditor/pageConditionModel.ts:109-122(toggleSwitchCondition). 증거: apply()가 `const next = withoutNthCondition(params.page.conditions, "switch", params.slot)` 로 슬롯에 해당하는 switch 조건을 **배열에서 떼어낸 뒤** `next.push({ kind: "switch", ... })` 로 **배열 끝에** 다시 붙인다. 그런데 슬롯 배정은 순서 기반이다 — pageConditionModel.ts:23-25 `switchConditionAt(page, slot)` 가 `filter(kind==="switch")[slot]`. 그래서 conditions=[switchA, item, switchB] 상태에서 1행(슬롯 0)의 값 select 만 바꿔도 배열이 [item, switchB, switchA'] 이 되어 재렌더 후 1행이 switchB 를, 2행이 switchA' 을 묶는다. 사용자에게는 방금 편집한 행의 대상이 다른 스위치로 바뀐 것이고, 이어서 «스위치 2» 행을 고치면 전혀 다른 스위치를 고치게 된다(잘못된 저작 유입). 슬롯 1 칩 재활성 경로(toggleSwitchCondition)와 스위치가 3개 이상일 때 고급 목록과의 슬롯 배정도 같은 재배치로 흔들린다. pageConditionLayout.ts:124 의 검증 필드 앵커(event-page-switch-condition-input)도 순서를 따라가므로 검증 벨 이동 대상까지 뒤집힌다. …

**[EE-08-2] (medium) 페이지 조건 타이머 저작 표면에 「부재 타이머=참」 경고가 없다 — 분기 폼 전용 경고가 페이지 표면에서 재발**
`src/editor/panels/eventEditor/pageConditions.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/pageConditions.ts:454-487(timerConditionInputs — 경고 요소 없음), src/editor/panels/eventEditor/conditionForm.ts:622-623(힌트 "타이머 남은 시간이 지정 초 이하인지 검사합니다" — 함정 미언급), src/editor/panels/eventEditor/pageAdvancedConditions.ts:426-433(고급 타이머 행 — 경고 없음). 런타임 3평가기 모두 `(timers[timerId] ?? 0) <= condition.seconds` (src/project/io/pageResolution.ts:69, src/project/session.ts:855-858) 라서 **한 번도 켜지지 않은 타이머도 seconds>=0 이면 참**이다(openwiki/editor-event-authoring.md L749-760: "거짓으로 만드는 유일한 방법은 음수 임계값… 저작 시점 경고로 보이게 두라"). 그런데 이 경고는 분기 폼에만 실렸다: commandBodyCore.ts:966-982 renderForkTimerWarning("…0초 이하 조건은 타이머가 꺼져 있어도 참입니다", 필터 `seconds >= 0`). 페이지 조건 표면은 무경고이고, 검증기도 src/editor/eventDraftValidator.ts:497-512 이 `condition.seconds === 0` 일 때만 condition.timer.always-true 를 낸다 — 60초·30분 이하로 바꾸면 함정이 그대로 남는데(부재 타이머 0 <= 60 → 참) 어디에서도 알려 주지 않는다. …

**[EE-08-3] (medium) 조건 문장이 구역·관계 조건을 「특수 조건 insideLocation/relationshipAtLeast」 로 읽는다 — 내부 토큰 노출**
`src/editor/panels/eventEditor/pageConditionSentence.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/pageConditionSentence.ts:53-97(clauseParts). 증거: case 목록이 switch/variable/selfSwitch/actor/item/gold/timer/timePhase/season/npcActivity/friendshipAtLeast/battleResult/run/all/any/not 뿐이고, **insideLocation 과 relationshipAtLeast 의 case 가 없어** default(93-96행)로 떨어진다: `return [text("특수 조건 "), value(String((condition as { kind: string }).kind))]` → 실제 문장이 "이 페이지는 … 특수 조건 insideLocation 일 때 보입니다." 로 출력된다. 두 조건은 1급 편집 대상이다 — pageConditions.ts:146-171 에 «구역»·«관계» 칩/행이 있고 pageAdvancedConditions.ts:449-460 에 전용 렌더러가 있으며, commandSummary.ts:1126-1131 은 같은 종류를 "구역…"/"관계 … 이상" 으로 정상 문장화한다. default 주석의 전제("RoguelikeRunCondition 등 전용 편집기를 가진 조건")도 두 종류에는 거짓이다. 이는 위키 계약 «조건 문구에 내부 토큰을 넣지 마라»(openwiki/editor-event-authoring.md L792-799, 대상에 pageConditionSentence.ts 명시, 게이트 test/conditionCopyTokens.test.ts) 위반이며, 문장은 «저장 직전에 눈으로 확인할 한 줄»(파일 머리 주석 1-9행)이라 신뢰 표면이 깨진다. …

**[EE-08-4] (medium) 활동·타이머 입력을 비우면 조건이 조용히 삭제된다 — 「비워도 삭제 안 함」 계약·형제 표면과 상반**
`src/editor/panels/eventEditor/pageConditions.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/pageConditions.ts:547-555(npcActivity — `const label = activity.value.trim(); if (label) { next.push(...) }` → 빈 값이면 조건 삭제), 466-475(타이머 — 분·초가 모두 비면 push 생략 → 조건 삭제). 증거·불일치: 같은 조건 종류의 다른 표면은 값을 지킨다 — conditionForm.ts:1017-1019 `onChange({ kind: "npcActivity", activity: activity.value.trim() || cond.activity })`, conditionForm.ts:939·957 타이머는 빈 입력을 0으로 쓰지 삭제하지 않는다. 또한 위키 계약 «참조를 비워도 조건을 삭제하지 않는다»(openwiki/editor-event-authoring.md L770-775)의 정신(인라인 오류 + 값 보존)과도 반대 방향이다. 영향: 사용자가 문장을 고치려 칸을 비웠다가 다시 적으려는 사이 change 가 firing 되어 조건이 통째로 사라지고, 행 체크박스는 재렌더 전까지 체크된 채로 있어 «지웠는데 사라짐» 이 조용히 일어난다. 수정 제안: 두 행 모두 조건Form 쪽 계약(빈 값 → 기존 activity/seconds 유지 또는 0 유지 + 인라인 안내)으로 통일하고, 삭제는 칩/체크박스로만 허용한다.

**[EE-08-5] (medium) 스위치 두 행이 같은 testid·같은 접근성 이름을 가진다 — AI·e2e가 슬롯을 구분 불가**
`src/editor/panels/eventEditor/pageConditions.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/pageConditions.ts:53·63(두 슬롯 모두 `label: "스위치"` — chipLabel 만 "스위치"/"스위치 2" 로 갈린다), 262(`"aria-label": `${label} 조건 사용``), 278(`testid: `event-condition-row-${label}``). 증거·영향: 슬롯 0과 1을 모두 켜면(흔한 구성) DOM 에 `[data-testid="event-condition-row-스위치"]` 가 **두 개** 생긴다. querySelector·getByTestId 계열은 첫 노드만 돌려주므로 e2e와 AI 조수(툴이 testid 로 이 영역을 읽음)는 슬롯 1 행을 전혀 집지 못하고, 접근성 이름 "스위치 조건 사용" 도 두 개로 스크린리더 사용자가 슬롯을 구분할 수 없다. 칩 testid(event-condition-chip-switch1/2)는 유일하지만 행/체크박스는 아니다. 수정 제안: 행 testid 와 aria-label 에 슬롯 식별자를 넣는다 — `event-condition-row-스위치-1`/`-2`(또는 key 기반 `event-condition-row-${spec.key}`)와 aria-label "스위치 1 조건 사용"/"스위치 2 조건 사용".

**[EE-08-7] (medium) compileConditionFromText 가 src 어디에서도 호출되지 않는 죽은 코드 — 위키가 살아있는 폴백 경로로 서술**
`src/editor/panels/eventEditor/conditionCompile.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/conditionCompile.ts:13. 증거: 저장소 전체 grep 에서 `compileConditionFromText` 의 src 내 호출·import 가 **0건**이다(정의 자체와 test/conditionCompile.test.ts, docs·openwiki 언급만 존재). 그런데 위키는 이것을 살아있는 계약으로 서술한다 — openwiki/editor-event-authoring.md L247: "칩(스위치·스위치 2·변수·아이템·주인공)과 고급 조건·`compileConditionFromText` 폴백·빈 `not` 그룹 모두 switchId/variableId/itemId/actorId: """. 파일 헤더 주석(9-12행)도 "AI / quick authoring" 용도라 명시한다. 영향: 자연어→조건 컴파일 기능이 AI 조수·에디터 어디에서도 도달 불가능한 죽은 코드이며, 위키-코드 불일치로 다음 개발자/AI 가 살아있는 경로로 착각하고 의존할 수 있다. 수정 제선: (a) src/ai/assistantSession 또는 이벤트 AI 툴에 실제로 연결해 위키 서술을 사실로 만들거나, (b) 의도적 폐기라면 파일·테스트를 지우고 위키 L247 문구를 정리한다. 둘 중 하나는 반드시 택해야 한다.

저심각도 일괄:
- [EE-08-10] (low) 조건 행의 비활성-행 장치가 도달 불가능한 죽은 분기다 — 위키 «비활성 행 조작 시 자동 활성화» 서술과 표류 — `src/editor/panels/eventEditor/pageConditions.ts`
- [EE-08-6] (low) 조건 요약 배지가 raw 토큰(!, ≥)으로 극성·비교를 그린다 — 내부 토큰 금지 계약(배지 포함) 위반 — `src/editor/panels/eventEditor/pageProps.ts`
- [EE-08-8] (low) 조건 컴파일러가 레코드 이름을 키워드로 가로채고, 이름에 든 off/꺼가 극성을 뒤집는다(잠재) — `src/editor/panels/eventEditor/conditionCompile.ts`
- [EE-08-9] (low) 고급 조건 «종류» select 가 재렌더마다 스위치로 초기화된다 — `src/editor/panels/eventEditor/pageAdvancedConditions.ts`

### 5.9 EE-09 — 페이지 속성·NPC 행동·일정·호러

**[EE-09-2] (critical) 발견 이벤트+물체 상호작용(또는 자동·병렴 트리거) 조합이 편집기에서 무검증으로 저장되고, 다음 로드 때 ProjectFormatError 로 프로젝트가 열리지 않는다**
`src/editor/panels/eventEditor/pageHorror.ts` · 최종 critical · 확인 · 확신 high
증거 사슬: (1) src/editor/panels/eventEditor/pageHorror.ts:48-51 — renderObjectInteraction의 set()은 `interaction` 외에 `movement:{...type:'fixed'}, trigger:{kind:'action'}, priority:'same', overlapForbidden:true` 를 쓰면서 **detectionEncounter 를 확인하거나 지우지 않는다**. (2) src/editor/panels/eventEditor/pageProps.ts:920-931 — 시작 방식 select도 detectionEncounter 호환 검사 없이 `{kind:'auto'|'parallel'}` 로 바꿀 수 있다. (3) 반대 방향 폼인 pageNpcBehavior.ts:48은 `compatible = trigger.kind !== 'auto' && trigger.kind !== 'parallel' && page.interaction === undefined` 로 활성화를 막아 두 폼이 계약을 반씩만 지킨다(특별 지시: 행동 아키타입 폼 정합). (4) JSON 경계는 이 조합을 거부한다: src/project/io/shapeEventFields.ts:465-469 `assert(trigger.kind !== "auto" && trigger.kind !== "parallel" && page.interaction === undefined, "...발견 이벤트는 자동·병렬 실행이나 물체 상호작용과 함께 사용할 수 없습니다. …

**[EE-09-1] (high) 「페이지 추가」가 무조건 페이지를 중간에 삽입해 앞선 조건부 페이지를 죽은 페이지로 만든다(자체 주석·토스트의 안전 약속과 모순)**
`src/editor/eventPages.ts` · 최종 high · 확인 · 확신 high
위치/증거: src/editor/eventPages.ts:132-138 — "// A page appended at the end wins runtime resolution immediately. Insert // before the active page ... so creating a blank page cannot silently change gameplay." 라는 주석과 함께 addEventPage는 조건 0개짜리 새 페이지를 `event.pages.splice(insertionIndex, 0, page)` 로 삽입한다(insertionIndex = 선택 페이지 인덱스, 없으면 length-1, eventPages.ts:135-138). pageProps.ts:386 토스트도 "조건 없는 새 페이지를 기존 승자보다 낮은 우선순위로 추가했어요." 라고 안전을 약속한다. 그러나 런타임 해석기(src/project/io/pageResolution.ts:36-41)는 배열 뒤에서 앞으로 훑어 조건이 맞는 첫 페이지를 반환하므로, 무조건 페이지가 중간에 끼면 **그 앞의 모든 페이지를 가린다** — 프로젝트 자체 교리가 eventPageShadow.ts:8-9에 "조건이 0개인 무조건 페이지는 자기 앞의 모든 페이지를 가린다"로 명시돼 있다. 실제 시나리오: 표준 NPC [P1 무조건 인사, P2 selfSwitch A] 에서 P2 선택 상태로 페이지 추가 → [P1, NEW(무조건), P2] → A가 꺼진 세션에선 기존 P1 대신 빈 NEW가 렌더된다 = 무음 게임플레이 변경. 코드 주석의 안전 약속은 거짓이다. …

**[EE-09-3] (high) NPC 생활 이동 폼이 destinations 배열을 요소 1개로 잘라낸다 — 다중 목적지·switchId 조건 목적지 데이터 유실**
`src/editor/panels/eventEditor/pageNpcLiving.ts` · 최종 high · 확인 · 확신 high
증거: src/project/types/events.ts:523-534 — `NpcLivingDestination { mapId, x, y, direction?, switchId? }`, `NpcLivingMovement { destinations: NpcLivingDestination[], repeat }`. 런타임은 이 배열을 순환한다: src/player/npcLivingTravel.ts:83-88 — `for (let offset = 0; offset < living.destinations.length; offset += 1) { ... if (destination.switchId && context.session.switches[destination.switchId] !== true) continue; ... }` — 즉 다중 목적지 순회와 스위치 조건 목적지가 런타임·저장 계약(shapeEventFields.ts:496-506이 destinations 배열 + switchId 검증)의 정식 기능이다. 그러나 편집기 폼은 pageNpcLiving.ts:30 `page.movement.living?.destinations[0] ?? {...}` 로 첫 행만 렌더하고, pageNpcLiving.ts:52-58의 applyLiving은 컨트롤 하나만 바꿔도(예: 반복 체크박스) `living: { destinations: [{ ...target, direction: targetDirection.value as Dir }] }` 로 **배열 전체를 요소 1개로 재작성**한다. 새 객체에는 switchId 가 없으므로 조건부 목적지의 switchId 도 파기된다. …

**[EE-09-6] (medium) 시야·발견·추격 숫자 입력은 무효값을 조용히 드랍하고 일정 편집기는 클램프한다 — 같은 화면의 숫자 입력 계약이 불일치하고 표시값과 저장값이 어긋난다**
`src/editor/panels/eventEditor/pageNpcBehavior.ts` · 최종 medium · 확인 · 확신 high
증거 1: pageNpcBehavior.ts:11-19 — numberField의 change 핸들러가 `if (input.value !== '' && input.checkValidity() && Number.isInteger(next)) change(next);` 로 유효하지 않은 입력(범위 밖·소수)을 조용히 버린다. 예: 발견 거리에 1000 입력( max 999) → checkValidity 실패 → store 미반영 → 화면 상자에는 1000이 그대로 남아 표시값과 저장값이 갈라진다. 증거 2: pageHorror.ts:35-40 — 문 대기/수색 초 입력도 `if (input.checkValidity() && input.value !== '') set(...)` 로 동일 패턴. step='0.1' 이라 1.55 입력, 60 초 초과 입력 모두 무반응이고 상자에는 입력값이 남는다. 대조: eventScheduleEditor.ts:309-313 clampInput은 `input.value = String(value)` 로 클램프 결과를 화면에 되비춰 계약을 지킨다(주석까지 "클램프 결과가 화면에 보여야 한다"). 같은 이벤트 편집기 안에서 숫자 입력 계약이 둘로 갈라져 있고, 조용히 드랍되는 쪽은 사용자가 자기 입력이 무시됐는지 알 수 없다. 수정 제안: numberField와 pageHorror ms 입력을 clampInput 방식(클램프 후 되비추기)으로 통일하거나 최소한 경고를 표시할 것.

**[EE-09-7] (medium) 생활 이동 맵 연결 폼이 맵 쌍으로만 기존 연결을 찾아 다른 문의 연결을 덮어쓰고, direction·name 을 무음으로 리셋한다**
`src/editor/panels/eventEditor/pageNpcLiving.ts` · 최종 medium · 확인 · 확신 medium
증거: pageNpcLiving.ts:137-139 — `const existing = (project.mapConnections ?? []).find((connection) => connection.from.mapId === mapId && connection.to.mapId === destination.mapId)` — 출발/도착 좌표를 보지 않으므로 같은 맵 쌍 사이에 문이 여러 개면(=MapConnection이 여러 개면) 항상 첫 번째 것만 표시된다. 그 상태에서 「연결 갱신」(pageNpcLiving.ts:202-217)은 `existing.id` 로 그 첫 연결을 통째로 덮어쓴다(`project.mapConnections[existingIndex] = connection` — :254-257) — 이 NPC의 문 좌표가 아니라 **다른 연결의 좌표·플래그를 무음으로 재작성**한다. 덧쓰기 내용도 손실이 있다: :210 `name: ${mapLabel(mapId)} -> ${mapLabel(targetMap.value)}` 는 사용자가 다른 곳에서 지은 연결 이름을 덮어버리고, :211-212 `from: {..., direction: "down"}, to: {..., direction: "down"}` 는 MapConnectionEndpoint.direction(project.ts:523-528, optional)을 기존 값과 무관하게 down 으로 리셋한다. 수정 제안: existing 매칭에 from.x/from.y(이벤트 문 위치)를 포함하고, 갱신 시 좌표·direction·name 은 폼에 없는 기존 필드를 보존한 부분 patch 로 쓸 것.

**[EE-09-11] (low) PAGE_FIELD_LABELS에 passRows·interaction·detectionEncounter가 없어 감사 로그에 영어 필드명이 그대로 새고, 라벨 사상의 존재 이유를 스스로 무너뜨린다**
`src/editor/eventPages.ts` · 최종 low · 보류 · 확신 high
증거: eventPages.ts:625-637 — 주석 "patch 키 → 사람이 읽는 이름. 라벨이 영어 필드명으로 새는 걸 막는다"라며 PAGE_FIELD_LABELS를 정의했는데 name/conditions/graphic/trigger/priority/overlapForbidden/animationType/footprint/movement/commands 10키뿐이고, EventPage의 나머지 patch 키 passRows·interaction·detectionEncounter가 빠져 있다. 실제 누수: (1) pageFootprint.ts:109 — `updateEventPage(..., { footprint, passRows: rows, graphic })` 라벨 생략 → patchFieldCaption(eventPages.ts:640-646)이 "발자국, passRows, 그림"을 기록. (2) pageHorror.ts:48-51 — 5키 패치에서 첫 키 interaction이 그대로 노출("interaction, 이동, 실행 방법 외 2개"). (3) pageNpcBehavior.ts:50-60 — detectionEncounter 패치가 "페이지 속성 변경: … — detectionEncounter"로 기록. 이 파일이 2026-08-29 관측성 감사(:533-544)에서 만든 목적(한국어 감사 로그)에 정면으로 어긋난다. 수정 제안: PAGE_FIELD_LABELS에 passRows: "통행 차단 행", interaction: "물체 동작", detectionEncounter: "플레이어 발견" 을 추가할 것.
> 보류 사유: PAGE_FIELD_LABELS에 3키가 없는 것(626-637)과 2건의 누수는 실측됐다 — pageFootprint.ts:109(라벨 생략→"발자국, passRows, 그림"), pageHorror.ts:48-51(라벨 생략→"interaction, 이동, 실행 방법 외 2개"). 그러나 3번째 주장은 틀렸다: renderDetectionEncounter의 detectionEncounter 패치는 커스텀 라벨 '플레이어 발견 이벤트 설정'을 넘기므로(pageNpcBehavior.ts:50-52,58-60; updateEventP …

저심각도 일괄:
- [EE-09-10] (low) 페이지 추가 감사 라벨의 「(N번째)」가 실제 삽입 위치와 다른 숫자를 적는다 — `src/editor/eventPages.ts`
- [EE-09-12] (low) 밀 수 있는 가구에서 네 방향을 모두 해제해 directions: [] (절대 밀리지 않는 물체)를 저작해도 경고가 없다 — `src/editor/panels/eventEditor/pageHorror.ts`
- [EE-09-13] (low) pursuit만 있고 sight 없는 구버전 추격 페이지에서는 명시적 시야를 추가할 UI 수단이 없다 — 위키의 「추격에는 명시적 시야를 제공한다」가 이 조합에서 미구현 — `src/editor/panels/eventEditor/pageNpcBehavior.ts`
- [EE-09-5] (low) 일정 가림 경고가 "마지막 행으로 옮기세요"라고 지시하지만 일정 행을 옮길 수단이 UI에 전혀 없다 — `src/editor/panels/eventEditor/eventScheduleEditor.ts`
- [EE-09-8] (low) 레거시 루트 커맨드 편집 함수(addCommand/insertCommand/deleteCommand/replaceCommand)에 경계 검사가 없고 파괴 연산이 없는 분기를 생성한다 — 미사용 죽은 코드지만 AI·개발자가 임포트하면 데이터 오염을 낳는 함정 — `src/editor/eventActions.ts`
- [EE-09-9] (low) 일정 편집기의 날짜·시각 상한이 프로젝트 시간제(daysPerSeason·dayEndHour)를 무시해 절대 매칭되지 않는 조건을 저작할 수 있다 — `src/editor/panels/eventEditor/eventScheduleEditor.ts`

### 5.10 EE-10 — 편집기 폼 ↔ 런타임 인터프리터 명령 계약

**[EE-10-1] (high) 「이벤트 삭제」폼이 고른 대상 이벤트를 인터프리터가 버리고 항상 자기 자신을 지운다**
`src/player/interpreter/commandCatalog.ts` · 최종 high · 확인 · 확신 high
위치: src/player/interpreter/commandCatalog.ts:265-267 — `if (entry.title === "Erase Event" ...) return pause("eraseEvent", { kind: "eraseEvent", eventId: state.currentEventId });` 가 author가 고른 fields.eventId 를 완전히 무시하고 항상 실행 중인 이벤트를 지운다. 반면 편집기 폼 src/editor/panels/eventEditor/commandBodyM2.ts:295-331(eraseEventCommandBody)은 `어떤 이벤트` select 로 이벤트 목록까지 보여주고 `updateField(context, cmd, "eventId", target.value)` 로 저장하며, 미리보기 문구는 `previewTitle.textContent = target.value ? `${selected?.name ?? target.value} 지우기` : "이 이벤트 지우기"` 로 「선택한 이벤트를 지운다」고 약속한다. 런타임은 step.eventId 를 받아들일 준비가 돼 있다(src/player/interpreter/types.ts:37 `eraseEvent; eventId?: string`, src/player/playSceneInterpreter.ts:497-498 `eraseRuntimeEvent(scene, step.eventId ?? currentEventId)`). 영향: 저작자가 「다른 이벤트 지우기」를 골라 저장·실행하면 의도와 달리 자기 자신(실행 중 이벤트)이 사라져 이후 명령열·페이지 조건이 전부 무너진다. …

**[EE-10-10] (high) 카메라 컨트롤의 「줌 변경」 모드가 pan 으로 매핑되어 follow 를 끊고 카메라를 고정시킨다**
`src/player/interpreter/commandCatalog.ts` · 최종 high · 확인 · 확신 high
위치: 편집기 옵션 src/project/eventCommands/m2ModernCatalog.ts:3-8 — `CAMERA_MODE_OPTIONS` 에 `{ value: "zoom", label: "줌 변경" }` 이 있다. 그러나 런타임 src/player/interpreter/commandCatalog.ts:1034-1038(cameraControlMode)은 `case "panTo": case "pan": case "zoom": default: return "pan";` 로 zoom 을 pan 으로 떨어뜨린다. playScene 실행 src/player/playSceneCamera.ts:119-139 — pan/fixed 경로는 `scene.cameras.main.stopFollow(); await panToTarget(scene, step.target, ...); scene.session.camera = cameraState("fixed", step);` 이라, target 기본 player 해석(commandCatalog.ts:1042-1055, x=y=0이라 좌표 대상 아님)으로 **플레이어 현재 위치에서 카메라 추적을 끊고 고정**한다. 줌 자체는 적용되지만 즉시 적용(applyCameraZoom, 트윈 없음)이고 durationMs 는 팬에만 쓰인다. 영향: 「줌 변경」 하나를 넣으면 의도치 않게 카메라가 팔로우를 멈춰 이후 플레이어가 화면 밖으로 걸어 나간다. 수정 제안: StepResult cameraControl.mode 에 "zoom" 을 추가해 카메라 유지+줌만 적용(트윈 포함)하거나, 카탈로그 옵션에서 zoom 을 내린다(렌더러 없는 옵션을 내린 Screen Effect blur 선례, m2ModernCatalog.ts:22-25 준수).

**[EE-10-2] (high) 이동 경로 설정의 route.skippable(불가 시 건너뜀)을 인터프리터가 버려 저작·미리보기만 존재한다**
`src/player/interpreter/commandCatalog.ts` · 최종 high · 확인 · 확신 high
위치: src/player/interpreter/commandCatalog.ts:568-575 — `case "moveEvent": return pause("moveEvent", { ..., moves: command.route.moves, repeat: command.route.repeat, wait: command.route.wait === true });` 에서 route.skippable 이 전달되지 않는다. 저작 계약은 존재한다: src/project/types/events.ts:104-105 `// 이동 불가 시 경로를 건너뛸지. skippable?: boolean`. 편집기 폼 src/editor/panels/eventEditor/commandBodyRoute.ts:98-102,213 은 `skippable.checked = cmd.route.skippable === true` 로 체크박스(「막히면 건너뛰기」)를 저장하고(`route: { moves, repeat, wait, skippable }`), 미리보기도 src/editor/panels/eventEditor/previewMoveRoute.ts:40 `if (cmd.route.skippable) badges.append(badge("불가 시 건너뜀"))` 으로 보증한다. 그러나 런타임 StepResult(src/player/interpreter/types.ts:62)에 skippable 필드가 없고 소비자도 없다(grep `route.skippable` — 편집기 3곳뿐). 이동 무버(registerAutonomousMover, playSceneSchedulers.ts:266-268)는 막힌 걸음을 건너뛰는 옵션을 받지 못한다. …

**[EE-10-3] (high) M2 「애니메이션 표시」(m2-054): 폼은 animationId 에 쓰고 런타임은 value 를 읽으며, 기록된 screenEffects 큐를 읽는 렌더러 자체가 없다**
`src/player/interpreter/m2Runtime.ts` · 최종 high · 확인 · 확신 high
위치: 런타임 src/player/interpreter/m2Runtime.ts:260-266 — `if (title === "Show Animation" || title === "Flash Event") { runtime.screenEffects.push({ effect: ... "animation" : "flash", value: fieldString(fields, "value", ""), durationMs: ... }) }` 가 애니메이션 id 를 `value` 키에서 읽는다. 그러나 편집기 폼 src/editor/panels/eventEditor/commandBodyM2Page3.ts:1257-1262(showAnimationM2Body commit)은 `replaceFields(context, cmd, { target: ..., animationId: animation.select.value })` 로 animationId 키에만 쓴다 → value 는 항상 없어 fieldString 이 `[m2] missing field: value` 경고를 내고 빈 값이 기록된다. 결정적으로 runtime.screenEffects 를 읽는 렌더러가 저장소에 없다(screenEffectPlan.ts:4-8 주석이 이 큐에 렌더러가 없던 과거 결함을 인정하고 Screen Effect 만 우회시켰다; grep `.screenEffects` — 읽기 0건). 분류표 src/project/eventCommands/m2RuntimeClassificationData.ts:92 은 m2-054-show-animation 을 `full`(완전 실행)로 부르고, 폼 문구는 「전투 애니메이션을 맵에서 재생합니다」(commandBodyM2Page3.ts:1271)이다. …

**[EE-10-4] (high) M2 「이벤트 플래시」(m2-056): runtime.screenEffects 기록만 하고 아무도 읽지 않아 화면 효과가 0이다**
`src/player/interpreter/m2Runtime.ts` · 최종 high · 확인 · 확신 high
위치: src/player/interpreter/m2Runtime.ts:260-266 — Flash Event 는 `runtime.screenEffects.push({ effect: "flash", value: fieldString(fields, "value", ""), ... })` 만 한다(색 값은 폼이 value 에 기록하므로 여기는 전달된다). 그러나 이 큐를 읽는 코드가 전 저장소에 없다(grep `\.screenEffects` — m2ModernRuntime/m2Runtime/m2RuntimeState 쓰기와 planScreenEffect 주석뿐). screenEffectPlan.ts:4-8 은 같은 큐가 렌더러 없어 픽셀 변화 0.00%였던 실측 결함을 기록하며 Screen Effect 만 실경로로 우회시켰고, Show Animation/Flash Event 는 그대로 남았다. 분류표 m2RuntimeClassificationData.ts:94 은 m2-056-flash-event 를 `full` 로 표시하고 폼 미리보기는 「이벤트 스프라이트를 번쩍입니다」(commandBodyM2Page3.ts:1335)라고 약속한다. 영향: 이벤트 플래시는 실행돼도 화면이 바뀌지 않는다. 수정 제안: target 이벤트 스프라이트에 실제 flash 를 태우는 StepResult(예: showAnimation 의 flash 변환)를 발행하거나, 계약상 미구현이면 분류를 내리고 피커 설명에 「맵 실행에서 아직 효과 없음」을 명시한다.

**[EE-10-5] (high) M2 「랜덤 전투 빈도」(m2-070): 변수 소스가 value 에 변수 id 를 써서 런타임 0 으로 떨어지고, encounter_rate 상태를 읽는 소비자도 없다**
`src/player/interpreter/m2Runtime.ts` · 최종 high · 확인 · 확신 high
두 겹의 결함. (1) 폼 src/editor/panels/eventEditor/commandBodyM2Page3.ts:1616-1625(setEncounterRateBody commit)은 `value: amount.source === "variable" ? amount.variableId : amount.numberValue` 로 변수 소스 선택 시 value 필드에 변수 id 문자열(예: var_3)을 쓴다. 런타임 src/player/interpreter/m2Runtime.ts:181-184는 `runtime.map["encounter_rate"] = { ..., value: String(fieldNumber(fields, "value", 0)) }` 로 valueSource/valueVariableId 를 전혀 읽지 않고(Change Parameters 용 resolveNumericField 를 안 씀) fieldNumber("var_3") → NaN → 폴백 0 이 된다. 폼 미리보기는 「전투 빈도 = 변수 X」라 약속한다. (2) 애초에 runtime.map.encounter_rate 를 읽는 코드가 전 저장소에 없다(grep encounter_rate — 쓰기 1곳뿐) — 고정 숫자를 넣어도 인카운트율은 변하지 않는다. 분류표 m2RuntimeClassificationData.ts:100 은 `full`. 영향: 랜덤 전투 빈도 저작은 100% 무효이며, 변수 소스 시 0(전투 없음)으로 수렴한다. 수정 제안: 런타임이 resolveNumericField(session, fields, "value", 0) 로 값을 읽게 하고, 인카운트율을 실제 인카운트 판정(playScene 인카운터)이 읽게 연결하거나 명령을 비활성화한다.

**[EE-10-6] (high) M2 「맵 그림 세트 변경」(m2-068): tileset_override 를 읽는 렌더러가 없어 지도 그림이 절대 바뀌지 않는다**
`src/player/interpreter/m2Runtime.ts` · 최종 high · 확인 · 확신 high
위치: 런타임 src/player/interpreter/m2Runtime.ts:166-169 — `runtime.map["tileset_override"] = { mapId: "", x: 0, y: 0, value: fieldString(fields, "value", "") }` 만 하고 끝난다. grep tileset_override 결과 소비자 0명(참고로 parallax_override 는 playSceneMapBackground.ts:103-106 이 실제로 읽는다 — 같은 runtime.map 패밀리인데 타일셋만 소비자가 없다). 편집기 폼 src/editor/panels/eventEditor/commandBodyM2Page3.ts:1453-1488(changeTilesetBody)은 타일셋 피커를 주고 미리보기로 「이 맵의 바닥·벽 그림을 다른 세트로 바꿉니다」를 보증한다. 분류표 m2RuntimeClassificationData.ts:98 은 `full`. 영향: 타일셋 교체 저작은 실행돼도 맵이 바뀌지 않는다(런타임 세션 맵 오버라이드 session.mapOverrides 로 연결하면 될 자리). 수정 제안: 맵 렌더러가 m2Runtime.map.tileset_override 를 읽어 tileset 을 대체하거나, 저작 지원 등급을 내리고 문구를 고친다.

**[EE-10-7] (high) M2 「변수 위치로 이동」(m2-037): move_to_variable_location 을 소비하는 곳이 없어 주인공이 이동하지 않는다**
`src/player/interpreter/m2Runtime.ts` · 최종 high · 확인 · 확신 high
위치: 런타임 src/player/interpreter/m2Runtime.ts:110-118 — `runtime.map["move_to_variable_location"] = { mapId, x, y, value: "" }` 만 기록한다. 편집기 폼 src/editor/panels/eventEditor/commandBodyM2Page3.ts:218-291(moveToVariableLocationBody)은 맵/X/Y 변수 피커를 제공하고 미리보기로 「맵·좌표 변수 값을 읽어 주인공을 이동시킵니다」라고 약속한다. grep move_to_variable_location — 읽는 곳 0명. 이 명령은 transfer StepResult 를 발행하지도 않는다(executeM2Command 에 전용 분기 없음 → resumeNext). 분류표 m2RuntimeClassificationData.ts:83 은 `full`. 영향: 「변수 위치로 이동」은 실행돼도 주인공이 한 칸도 움직이지 않는다. 실측됐던 옛 결함(변수 위치 이동이 (0,0)으로 떨어짐)을 고친 공용 좌표 계약(coordinateDestination.ts 머리말)과 달리 이 명령은 계약 자체가 미연결이다. 수정 제안: 기록 대신 transfer StepResult(variable 좌표 해석 포함)를 pause 하거나, 세션 이동 요청 플래그를 playScene 이 소비하게 한다.

**[EE-10-8] (high) M2 「지역 트리거」(m2-207): 스위치가 「밟았을 때」가 아니라 명령 실행 즉시 켜지고, 지역 감시·이벤트 호출 소비자가 없다**
`src/player/interpreter/m2ModernRuntime.ts` · 최종 high · 확인 · 확신 high
위치: 런타임 src/player/interpreter/m2ModernRuntime.ts:265-274(recordRegionTrigger) — `runtime.regions.push(region); if (region.switchId) session.switches[region.switchId] = region.action !== "exit";` 가 명령이 실행되는 **그 순간** 스위치를 켠다. 플레이어가 지역(region)을 밟는 것과 무관하다. 지역 진입 감시는 존재하지 않는다: grep `runtime.regions`/`m2Runtime?.regions` — 읽기 0명(region.push 가 전부). region.eventId(밟으면 이벤트 호출)도 아무가 안 읽는다. 편집기 intent 카드(src/editor/panels/eventEditor/commandBodyM2.ts:153-157)는 「맵에 칠해 둔 지역 번호를 밞았을 때 이벤트를 부르거나 스위치를 켜도록 연결합니다」라고 약속하고, 폼 옵션은 진입/이탈/체류(m2ModernCatalog.ts:59-63)다. 영향: 이벤트가 실행되는 즉시 스위치가 켜져(또는 꺼져) 저작 의도와 정반대 타이밍에 동작하고, 지역 트리거로서의 기능은 없다. 수정 제안: 세션에 보류 트리거로 기록하고 플레이어 좌표 갱신 지점에서 regionHit 판정 후 스위치/이벤트를 발화하거나, 미구현임을 배지로 내린다.

**[EE-10-11] (medium) 탈것 M2 3종(승하차 m2-038·위치 m2-039·모습 m2-026): 기록된 vehicle_* 상태를 읽는 런타임이 아예 없다**
`src/player/interpreter/m2Runtime.ts` · 최종 medium · 확인 · 확신 high
위치: src/player/interpreter/m2Runtime.ts:120-125(vehicle_boarded), 126-135(Set Vehicle Location → runtime.map[`vehicle_${vehicle}`]), 224-228(Change Vehicle Graphic → runtime.system[`vehicle_graphic_${vehicle}`]). grep `vehicle` — src/player 에서 이 파일 하나뿐이다. 즉 런타임에 탈것 시스템 자체가 없고 이 상태를 읽는 곳이 0명이다. 그러나 편집기는 리치 폼을 제공한다: commandBodyM2Page3.ts:293-321(승하차 토글, 「현재 위치의 탈것에 타거나 내립니다」), 323-365(탈것 위치 설정, 「지정 맵 좌표로 탈것을 옮깁니다」), commandBodyM2.ts:128-132(탈것 모습 변경 intent — 「배·비행선 같은 탈것이 맵 위에 그려지는 그림을 바꿉니다」). 분류표 m2RuntimeClassificationData.ts:77,83-84,85 는 셋 모두 `full`. 영향: 탈것 관련 저작 3종은 전부 무효. 수정 제안: 분류를 editor-only/unverified 로 내려 배지·문구를 정직하게 하거나, 탈것 런타임을 만들어 상태를 소비한다.

**[EE-10-12] (medium) M2 순간이동 위치 설정(m2-072)·탈출 위치 설정(m2-074): teleport_point/escape_location 소비자가 없다**
`src/player/interpreter/m2Runtime.ts` · 최종 medium · 확인 · 확신 medium
위치: src/player/interpreter/m2Runtime.ts:185-201 — Set Teleportation Point/Set Escape Location 이 runtime.map.teleport_point/escape_location 에 기록한다. grep teleport_point/escape_location — 소비자 0명(같은 파일의 기록이 유일). 편집기 폼은 genericFieldsFor(src/project/eventCommands/m2Catalog.ts:275-287)의 Location 분기로 target/mapId/x/y 를 제공하고, 분류표 m2RuntimeClassificationData.ts:101,103 은 둘 다 `full`. 한국어 라벨은 「순간이동 위치 설정」(m2CatalogData.ts:242)·「탈출 위치 설정」으로 실제 기능을 약속한다. 영향: RM2K3 의 순간이동/탈출 지점 지정이 플레이에서 무시된다. 수정 제안: 소비자(순간이동·탈출 시 이 좌표를 쓰는 경로)를 연결하거나 분류를 내린다.

**[EE-10-14] (medium) M2 「시스템 그래픽 변경」(m2-029): system_graphic 상태를 읽는 곳이 없다**
`src/player/interpreter/m2Runtime.ts` · 최종 medium · 확인 · 확신 high
위치: src/player/interpreter/m2Runtime.ts:252-255 — `runtime.system["system_graphic"] = fieldString(fields, "value", "")`. grep system_graphic — 소비자 0명. 편집기 폼은 메뉴 모습 리소스 피커(commandBodyM2.ts:851 `{ kind: "resource", label: "메뉴 모습 선택", resourceKinds: new Set(["system", "system2"]) }`)를 제공하고 분류표 m2RuntimeClassificationData.ts:80 은 `full`. 영향: 메뉴 시스템 그래픽 교체 저작이 무효. 수정 제안: 메뉴 렌더러가 system_graphic 을 읽게 하거나 분류를 내린다.

**[EE-10-15] (medium) M2 「다음 전환 연출 정하기」(m2-030): value 를 screen.tint 에 기록해 알 수 없는 값이 흰색 워시로 그려지고, 전환 설정은 어디에도 저장되지 않는다**
`src/player/interpreter/m2Runtime.ts` · 최종 medium · 확인 · 확신 high
위치: 런타임 src/player/interpreter/m2Runtime.ts:256-258 — `if (title === "Change Screen Transition") { runtime.screen.tint = fieldString(fields, "value", "fade"); }` — 다음 전환 방식을 어디에도 저장하지 않고 **현재 화면 색조(tint)에 써넣는다**. parseTintColor(src/player/screen/tintModel.ts:33-49)는 모르는 문자열(예: "fade", "페이드")을 screenColorToRgb 폴백으로 흰색+알파 0.45로 해석하므로 화면에 45% 흰색 워시가 깔린다(commandCatalog.ts:968-977 screenColorToRgb — 모르면 흰색). 편집기 폼은 genericFieldsFor의 Change 분기(src/project/eventCommands/m2Catalog.ts:408-421: target/operation/value)를 쓰고 intent 카드(src/editor/panels/eventEditor/commandBodyM2.ts:133-137)는 「이 명령 자체가 지금 화면을 전환시키지는 않습니다」라 약속하지만 실제로는 즉시 tint 를 오염시킨다. 분류표 m2RuntimeClassificationData.ts:81 은 `full`. 영향: 전환 저작은 무효인데 화면이 오염될 수 있다. 수정 제안: 전환 기본값을 세션에 저장해 transfer/battleProcessing 이 읽게 하거나, 명령을 은퇴(네이티브 transfer.transition 으로 통합)시킨다.

**[EE-10-16] (medium) M2 「컷신 모드」(m2-212): 런타임은 skippable 을 읽는데 카탈로그 스펙에 필드가 없어 M2 경로에선 스킵을 못 켠다**
`src/player/interpreter/m2ModernRuntime.ts` · 최종 medium · 확인 · 확신 high
위치: 런타임 src/player/interpreter/m2ModernRuntime.ts:150-158(recordCutsceneControl) — `beginCutsceneControl(session, undefined, fieldBoolean(fields, "skippable", false))` 로 skippable 을 읽는다. 그러나 카탈로그 스펙 src/project/eventCommands/m2ModernCatalog.ts:220-224 는 action/enabled 두 필드뿐이라 편집기 폼이 skippable 을 저작할 방법이 없다 → M2 경로로 켠 컷신은 항상 스킵 불가(false). 반면 네이티브 cutsceneControl 명령(events.ts:423, commandCatalog.ts:622-625)은 skippable 을 저작할 수 있고 AI 시네마틱 컴파일도 쓴다(src/editor/cutscene/index.ts:178). 영향: 같은 기능이 저작 경로에 따라 스킵 가능성이 달라진다 — 계약 비대칭. 수정 제안: m2-212 스펙에 skippable boolean 필드를 추가한다.

**[EE-10-17] (medium) M2 「체크포인트 저장」(m2-213): slotId·label·restoreOnGameOver 저작값이 실제 저장·복귀 경로에서 무시된다**
`src/player/interpreter/commandCatalog.ts` · 최종 medium · 확인 · 확신 high
위치: 편집기 스펙 src/project/eventCommands/m2ModernCatalog.ts:225-230 — slotId/label/restoreOnGameOver 세 필드를 저작하게 한다. 실제 저장 경로는 src/player/interpreter/commandCatalog.ts:339-342 → src/player/checkpoints.ts:7-10 `saveSessionCheckpoint(project, session)` — 인자에 필드가 전혀 전달되지 않고 단일 체크포인트 맵에 덮어쓴다. restoreOnGameOver 를 읽는 곳은 전 저장소에 없다(grep — 기록과 타입 선언뿐). 슬롯id는 세션 플래그(m2ModernRuntime.ts:168 `session.flags[`checkpoint:${slotId}`]`)만 남는다. 영향: 「게임오버 시 복귀」를 끄거나 슬롯을 나눠도 런타임이 무시한다. 수정 제안: 체크포인트 저장에 slot/label 을 전달하고 게임오버 경로가 restoreOnGameOver 를 판정하게 하거나, 스펙에서 필드를 뺀다.

**[EE-10-18] (medium) M2 「퀘스트 목표」(m2-208): runtime.quests 를 읽는 표면이 없어 퀘스트 상태가 어디에도 나타나지 않는다**
`src/player/interpreter/m2ModernRuntime.ts` · 최종 medium · 확인 · 확신 high
위치: src/player/interpreter/m2ModernRuntime.ts:276-283(recordQuestObjective) — `runtime.quests[questId][objectiveId] = { state, text }` 와 `session.flags[quest:...]` 만 남긴다. grep `m2Runtime?.quests` — 초기화(m2RuntimeState.ts:32)뿐, 퀘스트 UI·목록·조건 판정이 이 상태를 읽지 않는다. 폼(src/project/eventCommands/m2ModernCatalog.ts:193-199)은 questId/objectiveId/state(시작·갱신·완료·실패)/내용을 저작하게 하고 한국어 라벨은 「퀘스트 목표」다. 영향: 퀘스트 목표 상태를 바꿔도 플레이어가 볼 수 있는 표면이 없다(플래그 기반 조건 분기를 직접 짠 저작자만 사용 가능). 수정 제안: 퀘스트 표면(HUD/메뉴)을 연결하거나, 명령 설명에 「플래그 기록 전용, 화면 표시 없음」을 명시한다.

**[EE-10-19] (medium) 레거시 M2 행의 page3 폼(키 입력 m2-067·지형 변경 m2-071·그림 표시/삭제 m2-051/053)이 런타임이 안 읽는 필드 어휘를 쓰고 런타임은 recordFallback no-op**
`src/editor/panels/eventEditor/commandBodyM2Page3.ts` · 최종 medium · 확인 · 확신 high
위치: Key Input Processing(m2-067) — 편집기 폼 src/editor/panels/eventEditor/commandBodyM2Page3.ts:1366-1451(keyInputProcessingBody)이 `replaceFields({ target: variableId, variableId, operation: "set", value: wait.select.value })` 로 쓰고 미리보기는 「누른 키 코드 → 변수」·키캡 코드표(KEY_INPUT_KEYCAPS)까지 보여준다. 그러나 런타임에 이 title 을 처리하는 분기가 없어 src/player/interpreter/m2Runtime.ts:276 recordFallback("No dedicated player surface exists yet; command was recorded safely.") 로 끝난다 — 변수 기록도 입력 대기도 없다. Change Tile(m2-071)도 동일: 폼 commandBodyM2Page3.ts:1656-1711이 target=레이어/value=타일id/mapId/x/y 를 쓰지만(「지정 좌표의 맵 타일을 교체합니다」 약속) 런타임 분기가 없어 recordFallback. Show Picture/Erase Picture(m2-051/053)의 page3 폼(1025-1082, 1084-1224)도 저장된 m2Command 로 열리면 런타임 분기가 없어 무효(upsertPicture 는 Move Picture 만 호출, m2Runtime.ts:48-51).  …

**[EE-10-20] (medium) M2 「조건 대기」(m2-206) 기본 삽입값(switchOn+빈 target+timeout 0)은 그대로 두면 이벤트를 영구 대기시키고 검증기가 target 공백을 검사하지 않는다**
`src/player/interpreter/commandCatalog.ts` · 최종 medium · 확인 · 확신 high
위치: 스펙 기본값 src/project/eventCommands/m2ModernCatalog.ts:179-185 — `{ condition: "switchOn", target: "", value: "", timeoutMs: 0 }`(createDefaultM2Fields 로 삽입 시 그대로 저장). 런타임 src/player/interpreter/m2ModernRuntime.ts:114-128 — `switchOn` → `session.switches[waitState.target] === true` 에서 target="" 이면 session.switches[""] 는 항상 undefined → false. 대기 루프 src/player/interpreter/commandCatalog.ts:178-197 — `if (met || (timeout > 0 && elapsed >= timeout))` 에서 met=false, timeout=0 이므로 `pause("waitUntil", { kind: "wait", ms: 50, allowParallelEvents: true })` 가 영원히 반복되어 이 이벤트의 명령열이 영구 정지한다. 검증기도 못 잡는다: src/editor/eventDraftValidator.ts:1150-1170 M2_REFERENCE_RULES 에 `target` 키에 대한 규칙이 없어(변수/스위치 참조 검사 대상 아님) 빈 target 인 채 치명 오류 게이트를 통과한다. 영향: 초보 저작자가 Wait Until 을 넣고 대상만 안 고르면 이벤트가 조용히 영구 대기한다. …

**[EE-10-21] (medium) M2 「이벤트 위치 설정」(m2-040): 대상 이벤트(target)는 참조 검증 규칙이 없어 비어 있어도 게이트를 통과하고 런타임은 조용히 무시한다**
`src/player/interpreter/m2Runtime.ts` · 최종 medium · 확인 · 확신 high
위치: 폼 src/editor/panels/eventEditor/commandBodyM2Page3.ts:367-408(setEventLocationBody) — 이벤트 피커를 비워 둔 채(commit 시 `target: event.select.value` = "") 저장·적용이 가능하다. 런타임 src/player/interpreter/m2Runtime.ts:553,579-585(relocateM2Events) — `const a = currentLocation(eventA); if (!a) return [];` 로 조용히 [] 반환 → commandCatalog.ts:128-131 `eventIds.length ? pause(...) : resumeNext` 로 아무 일 없이 다음 명령. 검증기도 통과시킨다: src/editor/eventDraftValidator.ts:1150-1170 M2_REFERENCE_RULES 에 eventA/eventB/eventId 는 있지만 Set Event Location 의 필드 키는 `target`(m2Catalog.ts:447-453)이라 규칙이 적용되지 않는다(eventId 키가 아니라 검사 자체가 안 됨). Swap Event Location 은 eventA/eventB 규칙에 걸리는데 Set 만 빠진 비대칭. 영향: 대상 미선택 이벤트 위치 설정이 치명 게이트를 통과하고 실행에서 무시된다. 수정 제안: M2_REFERENCE_RULES 에 target(Set Event Location 한정, eventId 규칙으로)을 추가해 치명 오류로 검사한다.

**[EE-10-22] (medium) M2 「그림 이동」(m2-052): 대기 필드가 스펙에 없어 shouldWaitForPicture 가 항상 false — 이동 시간 동안 대기할 방법이 없다**
`src/player/interpreter/commandCatalog.ts` · 최종 medium · 확인 · 확신 medium
위치: 런타임 src/player/interpreter/commandCatalog.ts:141-148 — `if (picture && shouldWaitForPicture(command.fields)) return pause("showPicture", ...)` 에서 shouldWaitForPicture(commandCatalog.ts:1090-1092)는 `fieldBoolean(fields, "waitForPicture", fieldBoolean(fields, "wait", false))` 를 읽는다. 그러나 Move Picture 카탈로그 스펙(src/project/eventCommands/m2Catalog.ts:516-524)과 리치 폼(commandBodyM2Page3.ts:1037-1046, 1115-1161 pictureBody)에는 waitForPicture/wait 필드가 아예 없어 「이동 시간(ms)」만 저작할 수 있고 shouldWaitForPicture 는 항상 false → 그림이 durationMs 동안 트윈되는 동안 인터프리터는 즉시 다음 명령으로 진행한다. 영향: 「그림 이동 후 대화」 같은 시퀀스 저작이 불가능하고 저작자는 wait 필드의 부재를 알 수 없다. 수정 제안: Move Picture 스펙에 완료까지 대기 boolean 을 추가해 shouldWaitForPicture 로 전달한다.

**[EE-10-23] (medium) M2 「이벤트 생성」(m2-203): 새 이벤트 id 필드(eventId)에 기존 이벤트 선택 픽커가 붙어 id 충돌 저작을 유도하고, 빈 값은 고정 id "spawned-event" 로 겹쳐써진다**
`src/editor/panels/eventEditor/commandBodyM2.ts` · 최종 medium · 확인 · 확신 medium
위치: 스펙 src/project/eventCommands/m2ModernCatalog.ts:151-158 — Spawn Event 의 `eventId`(label 「이벤트 ID」)는 새로 생성될 이벤트의 id인데, 제네릭 폼은 key 규칙으로 src/editor/panels/eventEditor/commandBodyM2.ts:816 `if (spec.key === "eventId") return recordSemantic("이벤트 선택", "이벤트 선택", eventRecords(project))` 를 적용해 **기존 맵 이벤트 목록**에서 고르게 한다. 런타임 src/player/interpreter/m2ModernRuntime.ts:228-240(recordSpawnEvent)은 이 값을 session.spawnedEvents[eventId] 의 키로 쓰므로 기존 이벤트 id 를 고르면 저작 이벤트와 id 충돌(런타임 뷰가 중복)이 나고, 빈 값 기본이면 `eventId: fieldString(fields, "eventId", templateEventId ? `${templateEventId}_spawn` : "spawned-event")` 로 모든 생성이 고정 id "spawned-event" 로 겹쳐 두 번째 스폰이 첫 스폰을 대체한다. Remove Event/Region Trigger 의 eventId 는 기존 이벤트 참조가 맞지만 Spawn Event 만 의미가 반대다. 수정 제안: Spawn Event 의 eventId 필드에는 recordSemantic(eventId) 매핑을 배제하고 자유 텍스트+중복 경고를 준다.

저심각도 일괄:
- [EE-10-24] (low) 변수 조작 폼의 소스 전환 캐시 분기가 뒤집혀 캐시가 전부 죽은 코드가 됐다 — `src/editor/panels/eventEditor/commandBodyVariable.ts`
- [EE-10-25] (low) 맵 스크롤 속도: 폼은 1~무제한을 허용하는데 런타임은 조용히 1~6으로 자른다 — `src/player/interpreter/commandCatalog.ts`
- [EE-10-26] (low) M2 「고급 대화」(m2-209)의 portraitId: text 단계가 버리고 currentFace 만 사용 — `src/player/interpreter/commandCatalog.ts`
- [EE-10-27] (low) 데이터 조회(m2-217)의 target 필드 라벨 「누구에게」는 스위치/변수/아이템 조회에서 오해를 부른다 — `src/project/eventCommands/m2ModernCatalog.ts`
- [EE-10-28] (low) 카메라 컨트롤(m2-201): 인터프리터 StepResult 계약의 wait 필드를 저작 폼이 노출하지 않아 모든 카메라 명령이 강제 블로킹된다 — `src/project/eventCommands/m2ModernCatalog.ts`

### 5.11 EE-11 — 이벤트 데이터 모델·직렬화·마이그레이션

**[EE-11-1] (high) 명령 검증기가 19개 네이티브 kind의 필수 필드를 전혀 검사하지 않고 통과시킨다**
`src/project/io/shapeCommandFields.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/shapeCommandFields.ts:441-442 (`default: return;`), :155-158, :74-78. 증거: validateCommandShape 의 switch 에 case 가 없는 kind 는 전부 무검증 통과다. Command 유니언(src/project/types/events.ts:266-498) 중 text, wait, inputWait, label, gotoLabel, breakLoop, timer, changeTile, callCommonEvent, callMapEvent, changeParty, showPicture, erasePicture, playAudio, stopAudio, setFlag, ending, gameOver, returnToTitle 19종이 case 없이 default 로 통과한다. 게다가 case 가 있는 곳도 부분 누락이다: transfer(:155-158)는 direction/fade 만 보고 타입상 필수인 mapId/x/y(events.ts:313)와 transition(enum)을 검사하지 않고, setVariable(:74-78)은 op를 enum 없이 requireString 만 한다. 영향: `{kind:"text", body:123}`·`{kind:"wait"}`(ms 없음)·`{kind:"transfer", mapId:123}` 같은 프로젝트가 로드를 통과하고 런타임에서 NaN 좌표 전송·빈 대사창·알 수 없는 audio 채널 등으로 조용히 오작동한다. 같은 파일의 selfSwitch/digits/price 같은 필드는 전수 검사하면서 핵심 명령만 빠져 있어 검증기의 fail-closed 표방과 모순된다. …

**[EE-11-2] (high) 트룹 전투 이벤트 페이지(battleEventPages)가 JSON 경계 검증을 완전히 우회한다**
`src/project/io/shapeDatabaseFields.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/shapeDatabaseFields.ts:36-48 (`for (const key of [..."troops"...]) requireArray(...)` 이하 troop 레코드 검증 없음). 증거: validateDatabase 는 database.troops 가 배열인지만 확인하고 개별 troop 의 battleEventPages·conditions·commands 를 전혀 검사하지 않는다. 반면 맵 이벤트(shapeEventFields.validateEventShape:374)와 커먼 이벤트(:24)는 동일한 Command 유니언에 대해 validateCommandArray 를 강제한다. 소비처는 실재한다: src/battle/battleEvents.ts:247 `options.troopRecord.battleEventPages[batch.nextPage++]` 가 조건·명령을 그대로 실행한다. 아이러니하게 AI 툴 계층은 이 위험을 문서화하고 있다 — src/editor/tools/dbTools.ts:486-488 "battleEventPages 는 여기서 받지 않는다 — 자유 객체(additionalProperties:true)로 통과시키면 조건 kind 오타·빈 commands·무한 반복이 무검증으로 저장된다". 툴 우회 경로(수동 JSON 편집, 외부 도구, 구버전 저장본)에서 만들어진 malformed troop 페이지는 로드가 통과되고 전투 중에야 터진다. …

**[EE-11-3] (high) 로드 경계가 이벤트 draft 메타를 무검증 수용 — 다음 정규 저장이 working body를 draft.original로 롤백할 수 있다**
`src/project/io/shapeEventFields.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/shapeEventFields.ts:365-383(validateEventShape 가 draft 를 보지 않음), src/project/io/shape.ts:103-188(normalizeProjectV4 어디서도 draft 를 지우지 않음 — cloneJson 이 알 수 없는 필드를 보존). 증거: 타입은 계약을 분명히 한다 — src/project/types/events.ts:679 `PersistedGameEvent = Omit<GameEvent, "draft">`, 위키 runtime-project-schema.md:901-902 "Open editor drafts ... are never canonical authored output". 그런데 draft 가 실린 project.json(수동 편집, 외부 도구, 비정규 writer)이 로드되면 validateEventShape 가 그대로 수용하고, event.draft.kind==="edit" 인 이벤트는 src/project/eventDrafts.ts:44-47 committedEvents 가 `if (event.draft.original) committed.push(structuredClone(event.draft.original))` 로 동작한다. 영향: 파일 안의 working body 보다 오래된 draft.original 이 다음 정규 저장(autosave 포함)에서 정본이 되어, **새 본문이 조용히 과거 본문으로 롤백**된다. 저장 경계는 전부 draft 를 벗기는 것을 검증했으나(package.ts:32, webExport.ts:48, store.ts:1278, projectCommitLog.ts:129) 입구 경계만 비어 있다. …

**[EE-11-10] (medium) EventPage의 animationType·overlapForbidden·movement.moveIntervalMs가 형제 필드와 달리 무검증이다**
`src/project/io/shapeEventFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeEventFields.ts:449-461 — movement.type 은 6값 enum을 assert 하지만 같은 페이지의 animationType(events.ts:602-508, 6값 enum), overlapForbidden(events.ts:607 boolean), movement.moveIntervalMs(events.ts:597 숫자)는 검사하지 않는다. 같은 파일에서 sightRange/giveUpRange/pathfind(:471-473)는 검사한다. 증거: 이벤트 페이지의 다른 enum(trigger, priority, movement.type)은 전부 검증기가 소유하는데 animationType 만 유일하게 열려 있다. 영향: `animationType:"four-dir"` 같은 값이 로드를 통과하고 런타임 스프라이트 애니메이션 선택이 기본값으로 조용히 떨어지며, `moveIntervalMs:"300"`(문자열)은 추적 간격 산술에서 NaN이 된다. overlapForbidden 은 truthy 판정(canNpcMove)이라 문자열이어도 동작해 차이가 겉으로 안 드러난다. 수정: validatePageShape 에 animationType enum, overlapForbidden requireBoolean, moveIntervalMs 유한수 검사를 추가하라.

**[EE-11-11] (medium) 이벤트 초안 보관함의 원격 변경 감지가 키 순서에 민감한 JSON.stringify 비교를 쓴다**
`src/project/eventDraftVault.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/eventDraftVault.ts:120, :173 (`JSON.stringify(eventWithoutDraft(incoming)) !== JSON.stringify(draft.original)`). 증거: 이 코드베이스는 같은 비교에 키 정렬 정규화를 의무화하고 있다 — src/project/io/serialize.ts:28-32 "Compare loaded project values, not wire bytes: ... JSONB reorders object keys" 위키 runtime-project-schema.md:281-284 "Identity is SHA-256 of serializeForComparison(projectWithoutEventDrafts(...))". draft.original 은 세션 중 에디터 객체에서 찍힌 스냅샷(키 삽입 순서 고정)인 반면 incoming 은 원격/교체 스냅샷이라 키 순서가 다를 수 있다. 영향: 내용이 동일해도 키 순서만 다르면 "remote-change" 충돌로 오판되어 에디터가 불필요한 충돌 해결 UI를 띄우고 로컬 초안을 유지한다(위키 event-draft-vault 절의 conflict 계약 왜곡). 수정: 두 값을 serializeForComparison 수준의 정규화(키 정렬)로 비교하거나 eventDrafts 의 diffValues 를 재사용하라.

**[EE-11-12] (medium) changeLifeSkillExp 검증이 ProjectFormatError 대신 평범한 Error를 던져 오류 분류 계약을 깬다**
`src/project/io/shapeCommandFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeCommandFields.ts:178 (`throw new Error(\`${label}.op must be =, +=, or -=\`)`). 증거: 같은 switch 의 모든 형제 case 는 ProjectFormatError 를 던진다(:34, :101, :126 등). deserialize 는 이 예외를 그대로 밖으로 흘려보내고, 오류 분류 계약은 ProjectFormatError 를 전제한다 — src/project/spatial/persistenceWire.ts:34 `if (error instanceof ProjectFormatError) throw new SpatialPersistenceError("invalid-project", ...)`. 영향: changeLifeSkillExp 의 op 오타가 든 원격 current_json/패키지는 invalid-project 로 분류되지 않아 로드 복구·차단 UI의 형식화된 처리에서 빠진다. 한 줄 수정(`throw new ProjectFormatError(...)`)으로 정리되는 일관성 결함이다.

**[EE-11-13] (medium) shop.shopType 검증 화이트리스트가 ShopType 유니언보다 좁아 타입 계약과 어긋난다**
`src/project/io/shapeCommandFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeCommandFields.ts:372-375 (`if (st !== "normal" && st !== "buyOnly" && st !== "sellOnly") throw ...`). 증거: 타입은 8값 유니언이다 — src/project/types/events.ts:145 `ShopType = "normal" | "buyOnly" | "sellOnly" | "repair" | "appraisal" | "pawn" | "blackMarket" | "consignment"`. 검증기는 blackMarketFlag(:446)·festivalFlag(:447)·shopServiceKind(:362) 등 확장 상점 필드를 검사하면서 정작 shopType 어휘는 3값으로 고정했다. 영향: 타입 계약을 따라 `shopType:"blackMarket"` 을 쓴 프로젝트(AI 저작 포함)는 저장은 되고 로드가 "shopType가 잘못되었습니다"로 깨진다 — 타입이 허용한다고 말하는 값을 검증기가 거부하는 표면 간 모순. 현재 저장소 내 저작물은 3값만 쓰므로 잠재 결함이다. 수정: 둘 중 하나로 정리하라 — ShopType 을 실제 저작 어휘로 축소하거나, 검증기 화이트리스트를 유니언 전체로 넓혀 정합시킨다.

**[EE-11-6] (medium) normalizeShopCommands가 트룹 battleEventPages를 순회하지 않아 정규화 누락**
`src/project/io/shape.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shape.ts:524-529. 증거: 순회가 `for (const event of map.events)` 와 `for (const ce of project.commonEvents ?? [])` 뿐이다. 같은 프로젝트의 레거시 정규화인 rewriteLegacyAdvancedDialogueInProject(src/project/io/rewriteLegacyDialogue.ts:49-51)는 `for (const troop of project.database.troops ?? []) { for (const page of troop.battleEventPages ?? []) walk(page.commands); }` 로 트룹 페이지를 커버한다. 영향: 트룹 전투 이벤트 페이지 안의 구형 shop 명령은 allowSell→shopType 전환, branch 기본값, stock 정렬을 영영 받지 못한다. 같은 저장본의 같은 명령이 맵/커먼과 트룹에서 다른 모양으로 남아 직렬화 왕복 결과가 위치에 따라 달라진다. 수정: normalizeShopCommands 의 순회에 troop battleEventPages 를 추가하라(로드 시점에는 validateDatabase가 트룹을 검사하지 않으므로 방어적 순회 필요).

**[EE-11-7] (medium) 커먼 이벤트 trigger가 enum 검사 없이 requireString만으로 통과된다**
`src/project/io/shapeEventFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeEventFields.ts:23 (`requireString(\`commonEvents[${index}].trigger\`, record.trigger)`). 증거: 타입은 3값 유니언이다 — src/project/types/events.ts:684 `trigger: "none" | "auto" | "parallel"`. 검증기는 문자열이기만 하면 통과시키므로 맵 이벤트 트리거 어휘("action", "touch" 등)를 커먼 이벤트에 쓴 저장본이 로드된다. 소비처는 정확한 값을 기대한다: src/player/playSceneSchedulers.ts:110 `if (event.trigger !== "parallel") return false;`, playSceneMapRuntime.ts:726-730. 영향: AI 툴 스키마는 enum을 강제하지만(dbTools.ts:1262) JSON 경계는 강제하지 않아, 다른 writer 가 쓴 `trigger:"action"` 커먼 이벤트가 로드 후 **영원히 실행되지 않고 아무 진단도 없다**. 같은 검증기에서 conditionSwitchId 는 참조 검증(references.ts:1141-1144)으로 커버되지만 trigger 어휘는 어디서도 검사하지 않는다. 수정: validateCommonEvents 에서 trigger 를 3값 유니언으로 assert 하라(validateTrigger 의 유효 목록 나열 방식을 따르면 AI 가 고칠 단서도 얻는다).

**[EE-11-8] (medium) characterId 스탬프 순회가 battleProcessing 결과 분기를 빠뜨려 호감도 키가 조용히 누락된다**
`src/project/characterIdStamp.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/characterIdStamp.ts:59-62 (switch 가 shop.transactionBranch, inn.notEnoughBranch 까지는 재귀하는데 battleProcessing이 없음). 증거: commandIsSocial 의 case 목록은 setRelationship/changeFriendship/getFriendship/fork/choices/loop/shop/inn/promoteActor/evolveMonster 뿐이고, battleProcessing 의 victoryBranch/defeatBranch/escapeBranch(events.ts:337-339)는 default 로 떨어진다. 같은 파일의 유일한 호출처가 로드 정규화다 — src/project/io/shape.ts:185 `stampCharacterIdsForSocialEvents(project)`. 비교: 중첩 순회의 정본인 rewriteLegacyDialogue.walk는 battleProcessing 세 분기를 명시적으로 커버한다(rewriteLegacyDialogue.ts:28-31). 영향: 전투 승리 보상으로 changeFriendship 을 거는 이벤트는 social 명령이 분기 안에 숨어 있으면 characterId 를 부여받지 못하고, 호감도·선물 키가 조용히 붙지 않는다(빈 npcKey = "이 이벤트" 계약이 성립하려면 characterId 가 필요하다).  …

**[EE-11-9] (medium) GameEvent의 social 옵트인 필드(talkFriendship/socialShop/socialCalendar/characterId/name)가 JSON 경계에서 무검증이다**
`src/project/io/shapeEventFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeEventFields.ts:365-383 — validateEventShape 는 schedule(:375), giftPrefs(:376), giftResponses(:377)는 검사하지만 name/characterId/talkFriendship/socialCalendar/socialShop(events.ts:653-675)은 검사하지 않는다. 증거: 소비처는 타입 모양을 신뢰한다 — shopStock.ts:57 `if (bond < clampFriendship(cfg.minFriendship)) return 1;` 는 minFriendship 이 숫자가 아니면 clampFriendship 이 방어하더라도 의도한 할인이 조용히 사라지고, friendship.ts:157 은 delta 가 숫자가 아니면 기본값으로 떨어뜨린다. 반면 같은 GameEvent 의 giftPrefs(:385-390)와 schedule(:399-410)은 전수 검사한다. 영향: `socialShop:{priceMultiplier:"0.8"}`·`talkFriendship:{delta:"5"}` 같은 저장본이 로드를 통과하고 런타임에서 기능이 **오류도 경고도 없이 꺼진다** — validateShopEconomy 의 자기 증언(shapeCommandFields.ts:696-699 "haggleEnabled: \"yes\" 는 ... 오류도 경고도 없이 조용히 꺼진다. 저작 실수를 로드 지점에서 드러내는 것이 이 검사의 목적이다")과 동일한 실패 양상을 social 필드에서는 방치한다. …

**[EE-11-4] (low) normalizeShopCommands의 stock 고아 정리가 itemIds가 빈 경우 저작 stock 행을 조용히 삭제한다**
`src/project/io/shape.ts` · 최종 low · 보류 · 확신 high
위치: src/project/io/shape.ts:515-521. 증거: `const ids = new Set(cmd.itemIds as string[]); const filtered = (cmd.stock as {itemId:string}[]).filter((e) => ids.has(e.itemId)); ... cmd.stock = ordered.length > 0 ? ordered : undefined;` — itemIds 가 빈 배열이면 ids 가 공집합이라 stock 행 전체가 필터로 삭제되고, ordered 가 비면 stock 필드 자체가 undefined 로 사라진다. stock 이 있는데 itemIds 만 비정상인 저장본(수동 편집·외부 도구)에서 저작 데이터가 로드 한 번에 조용히 사라진다. 같은 코드베이스의 보존 기획 항목은 정반대 원칙을 선언한다 — shapeEventFields.ts:180-182 "이상한 행을 조용하게 버리면 사용자가 보존하기로 결정한 문장이 밝힐 이유 없이 사라진다"(fail-closed). set_shop_stock(eventTools.ts:1234-1236)은 항상 itemIds 를 함께 쓰므로 정상 툴 경로는 안전하지만, 경계 자체가 fail-open 이면 방어선이 없다. 수정: stock 이 배열인데 itemIds 가 배열이 아니거나 빈 경우엔 행을 버리지 말고 로드 오류(또는 lint 진단)로 승격하라.
> 보류 사유: 기계는 정확하다(shape.ts:515-521 — itemIds 빈 배열→ids 공집합→stock 삭제·undefined). 다만 이는 "stock ↔ itemIds 이중기록 해소: stock orphan 제거"라는 명시적 의도 주석이 달린 정합화 경로이고, 정상 툴은 양쪽을 함께 쓰며(set_shop_stock), itemIds가 배열이 아닐 땐 stock이 보존되므로 피해는 이미 비정상인 저장본의 1회 로드로 한정된다. fail-closed 승격 제안 자체는 타당하나 low로 조정.

**[EE-11-5] (low) normalizeShopCommands가 레거시 shop 명령에 분기 기본값을 강제 주입해 구버전 JSON 바이트 안정성을 깬다**
`src/project/io/shape.ts` · 최종 low · 보류 · 확신 high
위치: src/project/io/shape.ts:509-513. 증거: `if (cmd.branchOnTransaction === undefined) cmd.branchOnTransaction = false; if (cmd.transactionBranch === undefined) cmd.transactionBranch = []; ...` — 필드가 **없음(미저작)** 과 **false/빈배열(저작됨)** 을 구분하지 않고 모든 레거시 shop 명령에 4개 필드를 주입한다. 이 코드베이스의 자체 규범은 반대다: shape.ts:231-233(기획 항목) "항목이 하나도 안 남으면 필드 자체를 지워 옛 프로젝트 JSON 이 바이트 그대로 유지되게 한다", 위키 runtime-project-schema.md:669(planningItems) "The field is absent when unauthored, so legacy project JSON stays byte-stable". 영향: 구버전 프로젝트를 한 번 로드해 저장하면 모든 shop 명령이 재기록되어 diff·커밋 로그가 저작 없는 변경으로 오염되고, "분기 없음"이 "빈 분기 있음"으로 의미가 바뀐다. 수정: 주입을 제거하고 읽기 계약(없는 키 = 기본값)으로 통일하라. 위키 editor-event-commands.md:36-38 의 m2-205 모델("없는 키는 전부 기본값으로 읽힌다 — 그것이 곧 마이그레이션이다")이 정확히 이 방식을 정본으로 선언하고 있다.
> 보류 사유: 주입 자체는 사실이다(shape.ts:509-513). 그러나 "레거시 명령에 새 분기 필드 기본값 주입"이라는 의도적 마이그레이션이고, 빈 분기와 부재의 런타임 의미가 동일해 기능 차이가 없으며 바이트 재기록도 최초 로드 1회뿐이다(이후 저장은 안정). byte-stability 위키 계약은 planningItems 규정이라는 점에서 영향 과장 — low로 조정.

저심각도 일괄:
- [EE-11-14] (low) validateMoveRoute가 MoveRoute.wait/skippable 불리언을 검사하지 않는다 — `src/project/io/shapeCommandFields.ts`
- [EE-11-15] (low) 조건 variable/gold의 op가 열거 검사 없이 requireString만으로 통과된다 — `src/project/io/shapeCommandFields.ts`
- [EE-11-16] (low) validatePageShape의 interaction.directions 검사가 잘못된 라벨을 던진다 — `src/project/io/shapeEventFields.ts`
- [EE-11-17] (low) restoreProjectBackup이 형태·참조 검증 없이 프로젝트를 되돌린다 — `src/project/io/backup.ts`

### 5.12 EE-12 — 이벤트 검증·신뢰 루프·미리보기 시뮬레이션

**[EE-12-1] (medium) 미리보기 setFlag 가 런타임에 없는 스위치 기록을 날조해 fork 판정이 실제 플레이와 갈라진다**
`src/editor/panels/eventEditor/previewSimulation.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewSimulation.ts:376-379. 증거: 미리보기의 setFlag 적용은 `state.flags[command.flag] = command.value;` 에 이어 `state.switches[command.flag] = command.value;` 까지 한다(스위치에 플래그를 거울처럼 기록). 그러나 런타임 정본 인터프리터는 `case "setFlag": state.session.flags[command.flag] = command.value; return resumeNext(frame);`(src/player/interpreter/commandCatalog.ts:930-932)로 **flags 만** 쓰고 스위치는 건드리지 않는다. startSession 의 플래그→스위치 보정(session.ts:398-401)은 "레거시 flags도 스위치로 보정"이라 프로젝트 로드 시점 1회뿐이고, 플레이 중 setFlag 경로가 아니다. 영향: `setFlag X` 뒤에 같은 페이지에서 `fork(switch X)` 를 두면 미리보기 흐름은 "조건 충족 → then 실행" 배지를 내지만 실제 플레이는 스위치가 그대로라 else 를 탄다 — 신뢰 루프가 런타임과 반대 판정을 저작자에게 보여주는 저작↔런타임 계약 어긋남. 수정 제안: previewSimulation.applyCommandToState 의 setFlag 는 인터프리터와 동일하게 flags 만 쓰도록 `state.switches[command.flag] = command.value` 행을 삭제한다(혹은 런타임이 플래그→스위치 전파가 정답이라고 판단되면 인터프리터 쪽을 고치고 양쪽 테스트로 고정).

**[EE-12-10] (medium) "로컬 조수에게 묻기" 핸드오프가 warning/info 를 조용히 탈락시켜 경고만 있는 상태에서 빈 진단을 넘긴다**
`src/editor/panels/eventEditor/validationActions.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/validationActions.ts:30-42 — "로컬 조수에게 묻기" 버튼은 `eventValidationDiagnosticReport(validateEventDraft(...), event)` 결과를 prefill 하는데, 그 보고서는 eventValidationDiagnostics.ts:10 `issues: validation.issues.filter(issue => issue.severity === "error")` 로 **error 만** 담는다. 종과 인스펙터 배지는 warning(예: 타이머 항상-참 함정, 스케줄 shadow 경고)을 보여주지만, 조수 손글(UNSENT 핸드오프)과 진단 복사 양쪽 모두 경고가 통째로 빠진 채 나간다. 영향: 사용자는 "검토 항목을 조수에게 넘겼다"고 믿지만(토스트 "진단을 미전송 초안에 추가했습니다", validationActions.ts:41) 경고만 있는 상태에서는 빈 issues[] 가 전달되어 조수가 봐야 할 실제 검토 거리가 사라진다 — 신뢰 루프의 AI 사용성 구멍. 마크다운 헤더의 "오류만 포함합니다"(eventValidationDiagnostics.ts:33)는 조수엔 보이지만 사용자에겐 토스트로 대체되지 않는다. 수정 제안: 진단 보고서에 warning/info 포함 여부 옵션을 두고 묻기 버튼은 warning 도 포함하거나, 경고가 잘렸다는 사실을 토스트로 명시해라.

**[EE-12-11] (medium) insideLocation 조건 판정이 편집 이벤트의 맵이 아닌 editorState.currentMapId 기하로 계산될 수 있다**
`src/editor/panels/eventEditor/conditionEvalPreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/conditionEvalPreview.ts:108-113 — insideLocation 판정은 호출자가 넘긴 mapId 의 기하(resolvePreviewLocations)로 한다. 그런데 유일한 조건 폼 호출자는 commandBodyCore.ts:953 `renderConditionEvalPreview(cmd.condition, editorState.get().currentMapId ?? undefined)` 로 **에디터 현재 맵**을 넘긴다(편집 중 이벤트의 소속 맵과 별개 값). 증거 경로: 이벤트 모달은 최소화돼도 살아 있고(minimize 유지 계약, validationActions.ts:35), editorState.subscribe(refresh)(modal.ts:384)로 재렌더되므로, 최소화 중 다른 맵으로 전환 후 복원하면 fork 조건 미리보기가 **다른 맵의 로케이션 기하**로 충족/불충족을 확정한다. 흐름 보기 쪽은 진짜 호스트 mapId 를 넘긴다(eventScriptModernViews.ts:47,207). 영향: 조건 판정 배지가 지어낸 답이 된다 — previewSimulation.ts:249 주석이 스스로 경고하는 "편집 중인 맵이 아닌 기하로 판정하는 것은 지어낸 답이다" 상태. 수정 제안: 조건 폼 컨텍스트가 편집 이벤트의 mapId(CommandEditContext)를 갖고 그 값을 넘기게 하고, conditionEvalPreview 는 모달 dataset 의 mapId 와 불일치하면 판정 불가로 떨어뜨린다.

**[EE-12-13] (medium) 위키가 계약 소유자로 지목한 test/eventEditorTrustLoop.test.ts 는 quarantine 으로 이동해 기본 게이트에서 빠져 있다**
`openwiki/editor-event-authoring.md` · 최종 medium · 확인 · 확신 high
위치: openwiki/editor-event-authoring.md:262 — "행 CRUD 계약은 test/editorNpcSchedule.test.ts, 기존 bounds/passability 및 focus 계약은 test/eventDraftValidator.test.ts와 test/eventEditorTrustLoop.test.ts가 소유한다." 그러나 test/eventEditorTrustLoop.test.ts 는 존재하지 않고 test/eventEditorTrustLoop.quarantine.test.ts 로 바뀌었으며, vitest.config.ts:24 의 exclude 에 `"test/**/*.quarantine.test.ts"` 가 있어 **기본 게이트(npm test)에서 빠져 있다**(별도 test:quarantine 설정에서만 실행, package.json:104). 같은 파일을 소유자로 지목한 openwiki/editor-event-commands.md:226("Focused coverage: … test/eventEditorTrustLoop.test.ts …")도 함께 만료됐다. 영향: 이벤트 편집기 신뢰 루프(검증 배지 네비게이션·초안 focus 계약)의 회귀 소유자가 기본 스위트에서 실종됐는데 두 위키 페이지는 여전히 그 파일을 계약 소유자로 안내해, 리뷰어·AI가 존재하지 않는 게이트를 근거로 삼는다. 수정 제안: 위키 두 곳의 경로를 quarantine 파일 명칭+실행 조건으로 정정하고, 신뢰 루프 계약(최소한 배지 네비게이션)은 기본 스위트로 복귀시키거나 소유자 테스트를 새로 지정해라.

**[EE-12-15] (medium) 미리보기 시뮬레이션이 선택 때마다 플레이 세션 부트(startSession)를 통째로 재실행한다**
`src/editor/panels/eventEditor/previewSimulation.ts` · 최종 medium · 확인 · 확신 high
위치(증거): src/editor/panels/eventEditor/previewSimulation.ts:160 `const initialState = createPreviewSimState();` → 74-78행 `createPreviewSimState()` 가 호출마다 `startSession(project)` 을 돌린다. startSession 은 placeables·monsterInstances·farmAnimals structuredClone, initializeCollections, initialActorVitals 등 **풀 플레이 세션 부트**(src/project/session.ts:385-493)다. 호출 빈도: 흐름 보기 renderEventPageFlow 가 렌더마다 `simulatePageCommands(...)`(eventScriptModernViews.ts:207, content.ts:318-322에서 호스트 교체)를 부르고, 스토리 보기 flattenScript 도 같다(178-179행). 이 렌더는 modal.ts:384 editorState.subscribe(refresh)로 **순수 UI 선택(페이지 탭·명령 클릭)마다** 재실행된다. 거기에 더해 walk 가 명령 한 칸마다 `cloneState` (structuredClone 다수, 183행)를 수행한다. …

**[EE-12-2] (medium) fork taken 분기의 상태 재적용이 loop 몸통 쓰기와 breakLoop 를 무시해 걷기 결과와 최종 상태가 어긋난다**
`src/editor/panels/eventEditor/previewSimulation.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewSimulation.ts:323-325 — `if (command.kind === "breakLoop" || ... "gotoLabel" || "label") continue;` 와 `const branches = eventCommandBranches(command); if (branches.length > 0) continue;`. 즉 taken 분기의 상태 적용(applyCommandsToState)은 loop 몸통을 **통째로 건너뛰고** breakLoop 를 만나도 **계속 진행**한다. 반면 같은 파일의 walkWithSimulation 은 loop 에 한해 `sharesState` 로 몸통 쓰기를 공유 상태에 실제 적용하고(218-228행 주석 "반복은 몸통이 실제로 실행되므로 state 를 공유하고"), breakLoop 은 `return { broke: true }` 로 뒤 명령 걷기를 끊는다(208-211행). 영향: `fork { loop { setVariable V += 1 } } → 이후 fork(variable V)` 구성에서 흐름 보기 스텝은 V 기록을 보여주지만, 뒤 fork 의 판정 상태에는 그 기록이 없어 같은 화면 안에서 "기록됨"과 "불충족"이 동시에 보인다. breakLoop 뒤 명령도 walk 에선 실행되지 않는데 applyCommandsToState 는 상태에 반영해 뒤 fork 판정을 오염시킨다. 수정 제안: applyCommandsToState 가 walk 와 같은 걷기 규칙(loop 몸통 적용·breakLoop 조기 종료)을 공유하도록 하나의 함수로 합치고, 분기만 clone 전략을 갈린다.

**[EE-12-3] (medium) 같은 조건이 두 미리보기 표면에서 반대 판정을 받는다(fork 는 무조건 unknown, 페이지 조건 미리보기는 판정)**
`src/editor/panels/eventEditor/previewSimulation.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewSimulation.ts:263-273 — conditionNeedsUnsimulatedState 가 timer/timePhase/season/npcActivity/friendshipAtLeast/relationshipAtLeast/battleResult/run 을 무조건 unknown 으로 돌린다. 그러나 conditionEvalPreview.ts:98-104,115-130 은 **같은 startSession 시뮬 상태**(previewSimulation.ts:74-78 createPreviewSimState)에서 timers 에 id 가 있으면( session.ts:411 `timers: { ...(start.timers ?? {}) }`), gameTime 이 있으면(session.ts:406 `initialGameTime`) timer·timePhase·season 을 실제 판정해 "충족/불충족" 배지를 낸다. 영향: 시작 타이머가 정의되었거나 시간제가 켜진 프로젝트에서, 동일한 조건이 fork 미리보기(previewForkFlow 경유)에서는 "판정 불가 → 플레이에서 확인", fork 폼의 조건 판정(conditionEvalPreview)에서는 "충족"으로 서로 다르게 나온다 — 어느 쪽도 정본이라 할 수 없는 모순 표시. 수정 제안: 두 표면이 같은 판정 함수를 공유하게 한다. …

**[EE-12-4] (medium) 조건 판정 미리보기가 런타임이 결정적으로 내는 타이머 판정을 "판정 불가"로 가린다(미탐)**
`src/editor/panels/eventEditor/conditionEvalPreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/conditionEvalPreview.ts:98-100 — `case "timer": if (!Object.hasOwn(session.timers, condition.timerId)) return undefined;` → 미기동 타이머는 "판정 불가" 배지. 그러나 런타임 evalCondition 은 `const remaining = session.timers[condition.timerId] ?? 0; return remaining <= condition.seconds;`(src/project/session.ts:855-857)로 **미기동 타이머를 0초로 읽어 조건을 참 판정**하고, 이것은 의도된 계약으로 문서화돼 있다 — commandBodyCore.ts:962-964 "런타임은 미기동 타이머를 0초로 읽어 `seconds >= 0` 조건이 설정 전부터 참이 된다(의도된 계약). 검증기는 warning을 내지만…", 그리고 폼 경고 문구(commandBodyCore.ts:979) "0초 이하 조건은 타이머가 꺼져 있어도 참입니다". 영향: 런타임이 결정적으로 "충족"을 보장하는(그래서 검증기가 항상-참 함정 경고까지 내는) 조건을 미리보기가 "판정 불가"로 가려 저작자가 함정을 미리보기에서 확인하지 못한다. 판정 불가 노트("플레이 중 상태가 필요해", conditionEvalPreview.ts:49)는 이 경우 사실과 다른 이유를 제시한다. 수정 제안: 타이머는 start 세션 값(없으면 0)으로 판정하고, remaining===0 일 때 "미기동 타이머 0초 기준 충족(항상-참 함정)"임을 노트에 명시해 검증기·폼 경고와 정렬한다.

**[EE-12-5] (medium) 검증 종이 UI 선택만으로도 validateEventDraft 전체 재검사·이슈 행 재구축을 반복한다(L3 계약 미적용)**
`src/editor/panels/eventEditor/validationBell.ts` · 최종 medium · 확인 · 확신 high
위치(표면): src/editor/panels/eventEditor/validationBell.ts:113-116 — refresh 마다 `clearChildren(issues); validation.issues.forEach(...)` 로 목록 전체를 재구축한다. 위키 계약: openwiki/editor-validation.md:3-9 "규칙 감사 배지는 UI 선택만으로 재검사하지 않는다(2026-09-18)" — ruleAuditPanel.clusterRuleIssues 는 프로젝트 참조·lineage·mutation generation 이 같으면 기존 결과를 재사용하도록 고쳐졌다. 증거: 이벤트 편집기 종은 같은 계약을 받지 못했다. modal.ts:384 `const unsubscribeEditor = editorState.subscribe(refresh);` 가 **모든** editorState 변화(페이지 탭 클릭 → editorState.set({selectedEventPageId}), validationBell.ts:126 참조; 명령 선택 등 순수 UI 선택 포함)에 refresh() → renderSurface() → modal.ts:364 `refreshEventValidationBell(header, validateEventDraft(store.getCurrent(), request.mapId, request.eventId))` 를 돌린다. …

**[EE-12-6] (medium) 검증 종이 라이브 리전을 2겹으로 둬 같은 변화를 두 번 알리고, 선택 때마다 재알린다**
`src/editor/panels/eventEditor/validationBell.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/panels/eventEditor/validationBell.ts:43-58 — 카운트 배지(`event-draft-validation-count`)와 심각도 tally(`event-draft-validation-tally`) **둘 다** `role: "status", "aria-live": "polite", "aria-atomic": "true"` 를 달고 있고, refresh 마다 `count.textContent`(107행)와 `tally.textContent`(109행)가 함께 바뀐다. 영향: 스크린리더는 같은 변화에 대해 두 라이브 리전을 연달아 읽는다("7", 이어서 "오류 2 · 경고 5") — 정보가 두 번 들리며, EE-12-5 의 선택 구동 refresh 와 겹치면 사용자가 아무것도 편집하지 않았는데도 반복 안내가 나간다. aria-label(110-111행)이 이미 `검토 필요 N건 · tally` 전체를 담고 있어 summary 한 곳만 살려도 계약(DESIGN.md §5 `오류 N · 경고 N · 안내 N`, 주석 42행)은 유지된다. 수정 제안: 라이브 리전은 tally 하나로 통일하고 카운트 배지는 aria-hidden 또는 summary 라벨에 흡수시킨다. 데이터 변화가 없을 때는 textContent 재대입을 건너뛴다.

**[EE-12-7] (medium) 레코드 사용 힌트가 출현 횟수를 "이벤트 N곳"이라고 보고해 과대계상한다**
`src/editor/panels/eventEditor/recordUsageHint.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/recordUsageHint.ts:23-38 — countRecordReferences 가 `haystack.indexOf(needle)` 로 `"\""+recordId+"\""` 문자열 **출현 횟수**를 전부 세고, recordUsageHint.ts:18 이 그 값을 그대로 `이 ${label}는 이벤트 ${count}곳에서 쓰입니다` 로 렌더한다. 증거: 한 이벤트에서 같은 스위치를 페이지 조건과 setSwitch 명령 등 2곳에 쓰면 JSON 에 id 가 2번 등장하므로 "이벤트 2곳에서 쓰입니다"가 되지만 실제로는 1곳이다. 이벤트당 명령·조건이 많을수록 수 배로 부풀고, 0건 문구(`아직 다른 이벤트에서 쓰이지 않습니다`)도 자기 자신(현재 편집 중 명령)의 사용을 포함해 센다. 영향: 삭제 판단 참고용 안내가 체계적으로 과대계상되어 신뢰를 깎는다. 수정 제안: 프로젝트를 순회해 참조 **이벤트 id 집합** 크기를 세라(명령 트리를 kind별로 훑는 참조 수집기가 이미 존재 — project/commandReferenceValidation.ts 패턴). 최소한 문구를 "N개 사용 지점에서"로 바꿔 의미를 일치시켜라.

**[EE-12-8] (medium) 사용 힌트가 endings·quests·troops 등 이벤트 밖 참조를 못 봐 "쓰이지 않음" 거짓 안내로 삭제 유도**
`src/editor/panels/eventEditor/recordUsageHint.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/recordUsageHint.ts:28 — `const haystack = JSON.stringify(project.maps) + JSON.stringify(project.commonEvents ?? []);` 로 맵 이벤트+공통 이벤트만 센다. 증거: 프로젝트에는 이벤트 밖 스위치/변수 참조가 존재한다 — `endings?: EndingDef[]`(src/project/types/project.ts:662-663, "프로젝트 JSON에 저장된" 엔딩 조건), 실제 출하 콘텐츠 modernNocturneGame.ts:192-195는 `endings: [{ ... conditions: [{ kind: "switch", switchId: MODERN_SWITCH.endingMercy, ... }] }]` 로 스위치를 엔딩 게이트로 쓴다. quests(project.ts:658-659), troops 전투 이벤트(database.ts:734-735), museum 보상(system.museum — openwiki/editor-validation.md:161 "museum reward item/switch/world-unlock/recipe" 전역 참조 검증)도 같은 성격이다. 영향: 엔딩/퀘스트/부대에서만 쓰이는 스위치가 "이 스위치는 아직 다른 이벤트에서 쓰이지 않습니다"로 표시되어, 저작자가 안심하고 레코드를 지우면 엔딩·퀘스트 게이트가 조용히 깨진다. 수정 제안: haystack 에 project.endings/quests/troops/museum 설정(JSON 직렬화)을 추가하거나, 이벤트 밖 참조가 있으면 "엔딩 등 이벤트 밖에서도 쓰입니다" 경고 톤으로 바꿔라.

**[EE-12-9] (medium) 판정 불가(unknown) fork의 양쪽 분기 카드가 "건너뜀"으로 표시돼 자기 판정 문구와 모순된다**
`src/editor/panels/eventEditor/previewForkFlow.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewForkFlow.ts:32-35 — then 카드 skipped = `forkTaken === "else" || forkTaken === "unknown"`, else 카드도 같은 식으로 unknown 을 skipped 에 포함하고, branchCard:56 의 힌트는 `skipped ? "건너뜀"`. 즉 판정 불가 분기의 양쪽 카드가 모두 "건너뜀"을 보여준다. 모순 증거: 같은 컴포넌트의 판정 줄(24행)은 unknown 을 "판정 불가 → 플레이에서 확인"이라 하고, 시뮬레이터 자신도 previewSimulation.ts:188 주석에서 "판정 불가(unknown)면 양쪽 다 skipped — 어느 쪽도 「실행된다」고 단정하지 않는다"라며 실행 여부 단정을 피하도록 설계했다. "건너뜀"은 "이 분기는 실행되지 않는다"는 단정이라 그 계약을 깬다 — 실제 플레이에서는 둘 중 하나가 반드시 실행된다. 영향: 저작자가 unknown 분기를 죽은 분기로 오독한다. 수정 제안: unknown 일 때 힌트를 "판정 불가"(또는 "미판정")로 바꾸고 skipped 스타일과 시각적으로 구분한다(taken/건너뜀/미판정 3상태).

저심각도 일괄:
- [EE-12-12] (low) 조건 요약 문구의 조사 "N와 같을 때"가 대부분의 숫자에서 비문이다 — `src/editor/panels/eventEditor/conditionEvalPreview.ts`
- [EE-12-14] (low) 위키가 인용한 8번 수칙 수정 문구("한 페이지 안을 풍부하게")는 실제 프롬프트에 존재하지 않는다 — `openwiki/editor-event-authoring.md`

### 5.13 EE-13 — 미리보기 표면 — 그림·오디오·무비·스토리보드

**[EE-13-1] (high) 조명(setLighting) 프리뷰가 런타임과 반대로 그린다 — ambient 를 밝기로 해석**
`src/editor/panels/eventEditor/commandPreview.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPreview.ts:1273-1277. 증거: `// ambient 0 = fully dark overlay, ambient 1 = no darkening` 주석과 함께 `overlay.style.opacity = String(1 - ambient);` 를 걸고 라벨은 `어둠 ${100 - pct}%`, 캡션은 `밝기 ${pct}%`(1281행)로 쓴다. 그러나 런타임은 반대다 — src/player/lighting.ts:79-85 `if (params.ambient <= 0) return; ... context.globalAlpha = params.ambient; context.fillStyle = params.color; fillRect(...)`: ambient 가 곧 어둠 오버레이의 알파다. 폼(정본 편집면)도 같다 — commandBodyPage3Native.ts:130 `ambient: clamp01(parseFloat(ambient.value) / 100)`, 149-150 `veil.style.opacity = String(ambientValue)`, `DARK ${pct}%`. 즉 폼에서 「밤(암전 75%)」을 골라 저장한 명령(ambient 0.75)을 명령 프리뷰 카드로 보면 거의 밝은 화면에 「어둠 25% · 밝기 75%」라고 표시된다. 위키(openwiki/editor-event-command-fixes.md:65)도 `ambient`는 어둠의 불투명도라 100이 완전 암전이라고 못박았다. …

**[EE-13-2] (high) playMovie 카드 프리뷰가 생략된 wait/skippable 을 런타임 기본값(=true)과 반대로 표시**
`src/editor/panels/eventEditor/commandPreview.ts` · 최종 high · 확인 · 확신 high
위키 재검증(openwiki/editor-event-command-fixes.md:70) — 「Play Movie treats omitted `wait` and `skippable` as true」가 코드에 미반영. 위치: src/editor/panels/eventEditor/commandPreview.ts:1631-1632 `const meta = [cmd.wait === true ? "끝나면 진행" : "바로 진행"]; if (cmd.skippable === true) meta.push("건너뛰기 허용");`. 런타임 정본은 src/player/interpreter/commandCatalog.ts:927-928 `wait: command.wait !== false, skippable: command.skippable !== false` — 필드가 생략되면 대기·건너뛰기 허용이 기본이다. 그러나 카드 프리뷰는 생략(wait undefined)을 「바로 진행」으로 읽고, 생략된 skippable 에는 「건너뛰기 허용」 배지를 안 붙인다. AI 툴이나 JSON 편집으로 wait/skippable 을 아예 안 쓴 명령에서 저작 UI가 런타임과 정반대의 진행 시나리오를 보여준다. 수정: `cmd.wait !== false ? "끝나면 진행" : "바로 진행"`, `cmd.skippable !== false` 로 기본값 방향을 런타임과 일치.

**[EE-13-3] (high) playMovie 폼이 wait/skippable 「끔」을 저장하지 못한다 — 위키 보정 주장(Native media flags)이 코드에 반영 안 됨**
`src/editor/panels/eventEditor/commandBodyPage3Native.ts` · 최종 high · 확인 · 확신 high
위키 재검증(openwiki/editor-event-command-fixes.md:70) — 「Switching either off stores explicit false」가 현재 코드에 없다. 위치: src/editor/panels/eventEditor/commandBodyPage3Native.ts:1005/1011 시드 `value: cmd.wait === true ? "true" : "false"` (skippable 도 동일) — 생략된 필드를 폼이 「끔」으로 표시하는데 런타임 기본은 「켬」(commandCatalog.ts:927-928 `command.wait !== false`)이라 레거시/AI 작성 명령을 열면 거짓 상태가 보인다. 더 큰 문제는 커밋 1073-1074행: `...(wait.select.value === "true" ? { wait: true } : {})` — 세그먼트를 「끔」으로 두고 커밋하면 wait 필드가 아예 생략되고, 생략은 런타임에서 true 로 읽힌다. 즉 저작자가 「대기 없이 다음 명령 진행」을 골라도 게임에서는 끝날 때까지 대기하며, 명시적 false 를 저장할 수 있는 경로가 이 폼에는 존재하지 않는다. 폼 미리보기 문구(1059-1060행 「대기 없이 다음 명령 진행」)도 같은 거짓말을 반복한다. 영향: 연출 타이밍(영상 끝 → 다음 명령)을 끌 수 없고, UI 표기와 실제 실행이 양쪽으로 어긋남. 수정: 시드는 `cmd.wait !== false ? "true" : "false"`, 커밋은 `...(wait.select.value === "true" ? { wait: true } : { wait: false })` 로 위키 계약대로 명시 false 를 저장.

**[EE-13-4] (high) showPicture 폼 커밋이 waitForPicture 를 조용히 드랍한다 — 위키 보정 주장(U04)이 코드에 반영 안 됨**
`src/editor/panels/eventEditor/commandBodyPage3Native.ts` · 최종 high · 확인 · 확신 high
위키 재검증(openwiki/editor-event-command-fixes.md:69) — 「Show Picture exposes `waitForPicture` and preserves explicit true/false during other field edits」가 현재 코드에 없다. 위치: src/editor/panels/eventEditor/commandBodyPage3Native.ts:1141-1157 showPictureBody 의 commit 은 `{ kind, pictureId, resourceId, x, y, scale, opacity, rotation, durationMs }` 만 replaceCommand 에 넣고 waitForPicture 필드가 없다. src/editor 전역 grep 에서 waitForPicture 는 폼에 한 번도 등장하지 않는다(컷신 프리셋 컴파일러 cutscene/index.ts:330 과 AI용 스키마 카탈로그에만 존재). 그런데 런타임은 이 필드로 동작이 갈린다 — src/player/playSceneInterpreter.ts:521-525 `case "showPicture": showPictureState(...); if (step.waitForPicture === true) { ... }`. 컷신 프리셋(회상 오픈딩 등)이 waitForPicture:true 를 심어 둔 showPicture 를 폼에서 좌표 하나만 고쳐도 필드가 통째로 유실되어 「그림이 다 뜰 때까지 기다림」이 「즉시 다음 명령」으로 바뀐다 — 저작 의도의 조용한 유실(데이터 유실 성격).  …

**[EE-13-6] (high) 공용 showPicture 프리뷰가 scale·opacity 를 전혀 적용하지 않는다 (폼 프리뷰·런타임과 불일치)**
`src/editor/panels/eventEditor/previewPicture.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewPicture.ts:25-31 — url 이 있으면 `el("img", { class: "ecp-picture-img", ... })` 만 marker 에 붙이고, cmd.scale/cmd.opacity 는 50-53행에서 캡션 문자열(`×${cmd.scale}`, `α${cmd.opacity}`)로만 소비한다. 런타임은 둘 다 적용한다: src/player/pictures/pictureTween.ts:101-108 `scale(${transform.scale / 100}) rotate(...)`, `opacity: transform.opacity / 255`, src/player/runtimeDom.ts:639-643 `container.style.transform/left/top/opacity`. 편집 폼의 라이브 마커도 둘 다 적용한다(commandBodyPage3Native.ts:1182-1183 `marker.style.transform = scale(...) rotate(...)`, `marker.style.opacity = clampPct(previewOpacityPercent) / 100`). 게다가 command-preview-2.css:281 `.ecp-picture-img { max-width:100%; max-height:120px }` 가 이미지를 무조건 120px 로 짜르므로 scale 이 시각적으로 전혀 반영될 수 없다. 영향: 같은 명령이 폼 프리뷰에서는 60% 축소·반투명으로 보이는데 명령 카드/인스펙터 프리뷰에서는 원본 크기·불투명 — 두 표면과 게임, 세 곳이 서로 다른 그림을 보여준다. …

**[EE-13-10] (medium) playAudio 프리뷰가 채널·볼륨·페이드인을 전혀 보여주지 않는다**
`src/editor/panels/eventEditor/previewAudio.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewAudio.ts:18-26 — 재생 프리뷰는 `▶` 아이콘 + resourceId + 고정 파형 + loop 배지가 전부다. 그러나 playAudio 명령에는 channel?(events.ts:409, 생략 시 loop 로 bgm/se 유도 — session.ts:777 `state.channel ?? (state.loop ? "bgm" : "se")`), volume?(events.ts:412-413, 트랙 게인), fadeInMs?(events.ts:410-411) 가 있고 런타임이 전부 존중한다. 프리뷰는 loop 하나만 보여주므로 (1) 같은 resourceId 가 BGM 으로 흐르는지 SE 로 한 번 흐르는지 구분 불가(런타임 audio-indicator 배너는 loop 채널만 띄우는 등 채널이 실제 체감 차이를 만든다), (2) volume 20 의 조용한 사운드와 기본 볼륨이 같은 카드로 보인다. 특별 지시 항목(오디오 프리뷰 볼륨)에 정확히 해당. 수정: loop 배지 옆에 채널 배지(생략 시 유도값 표기)와 `볼륨 N%` 배지를 추가.

**[EE-13-11] (medium) movieStage 의 「리소스 종류가 아직 없다」 전제가 만료됐다 — 실영상 표면과 텍스트 카드가 공존**
`src/editor/panels/eventEditor/commandPreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPreview.ts:1621-1622 주석 「진짜 프레임을 보여줄 수 없으니(리소스 종류가 아직 없다)」 + 1623-1635 movieStage 는 `▶ ${cmd.resourceId}` 텍스트 라벨만 그린다. 이 전제는 거짓이 됐다: (1) movie 리소스 종류가 존재한다 — playMoviePreview.ts:39-44 `asset.kind === "movie"` 필터, resourceManagerMediaImport.ts:51-53 업로드 kind:"movie"; (2) 진짜 <video> 재생면이 이미 같은 폴더에 구현돼 폼이 쓰고 있다 — commandBodyPage3Native.ts:1046 `renderMoviePreviewStage(resolveMovieResourceUrl(...))`. 결과: 동일한 playMovie 명령이 편집 폼에서는 실제 영상이 재생되는데 명령 프리뷰 카드에서는 원시 리소스 id 문자열(사람이 읽는 이름 아님, 폼은 humanize/레코드명 표시)만 보인다 — 프리뷰 표면 간 계약 어긋남. 수정: movieStage 가 resolveMovieResourceUrl 로 URL 을 해석해 renderMoviePreviewStage 를 재사용하거나(자동재생 없이 poster/첫 프레임), 최소한 주석과 카드를 삭제하고 리소스 표시명(recordPicker 카탈로그 이름)을 보여주게 교체.

**[EE-13-12] (medium) Change Actor Graphic 프리뷰가 차셋 시트 전체를 64px 아이콘으로 눌러 그린다**
`src/editor/panels/eventEditor/commandPreviewActorBattle.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPreviewActorBattle.ts:553-557 — Change Actor Graphic 의 새 모습을 `deps.icon(resourceId || undefined, ..., 64)` 로 그린다. deps.icon 은 commandPreview.ts:1177-1181 heroIcon 으로 `el("img", { width: 64, height: 64, src: 전체 시트 URL })`. 캐릭터 차셋은 보통 3×4 이상의 시트(예: 288×256)이므로 프리뷰는 시트 전체가 64×64 로 찌그러진 형태다. 런타임은 시트에서 방향·패턴 셀 한 장만 크롭해 보여준다 — 같은 파일군의 정본 렌더러가 그것이다(eventGraphicPreview.ts:46-84 renderEventGraphicElement + applyCharsetFrameCrop, 221행 주석 「미리보기는 RM px 좌표계…」). 영향: 감독이 「맵에서 이렇게 보인다」고 믿고 고르는 표면이 실제 게임 스프라이트와 전혀 다른 그림. 수정: heroIcon 대신 renderEventGraphicPreview/graphic 용 크롭 렌더러(assets/charsetFrameCrop)를 써서 셀 한 장을 그린다.

**[EE-13-13] (medium) m2 Damage Processing 회복 프리뷰가 항상 풀회복으로 그려진다 (런타임은 값만큼 회복)**
`src/editor/panels/eventEditor/commandPreviewActorBattle.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPreviewActorBattle.ts:456 `const after = heal ? vitals.maxHp : vitals.hp - (amount.value ?? 0);`. 런타임 Damage Processing(remove=회복)은 값만큼 회복이다 — src/player/interpreter/m2Runtime.ts:443-450 `const signed = op === "remove" ? amount : -amount; vitals.hp = clampNumber(vitals.hp + signed, 0, vitals.maxHp);`. 카탈로그도 회복에 「값」 필드(기본 10)를 요구한다(m2Catalog.ts:369-382). 그러므로 「HP 회복 10」 명령의 프리뷰는 HP 게이지가 100% 채워진 「완전 회복」처럼 보인다. 데미지 방향(+값)은 정확한데 회복 방향만 거짓. 영향: 회복량 밸런싱을 프리뷰로 하면 실제 회복량을 전혀 알 수 없다. 수정: `const after = heal ? vitals.hp + (amount.value ?? 0) : vitals.hp - (amount.value ?? 0);` 로 런타임 산식과 일치.

**[EE-13-14] (medium) changeTile 프리뷰가 삭제된 mapId 에 시작 맵의 타일셋·이름을 조용히 대입한다**
`src/editor/panels/eventEditor/commandPreviewMapScreen.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPreviewMapScreen.ts:85 `const map = project.maps[cmd.mapId] ?? project.maps[project.startMapId];` — mapId 가 삭제·오타로 못 찾으면 시작 맵으로 조용히 대체하고, 119행 캡션도 `${map?.name || ...}` 로 대체 맵의 이름을 그대로 보여준다. transferStage(commandPreview.ts:697-699)는 같은 상황에서 「맵을 찾을 수 없습니다」 missingCard 를 주는 정본인데 changeTile 은 침묵 대체다. 영향: 리소스 누락 시(특별 지시 항목) 프리뷰가 「시작 맵의 타일셋 그림 + 시작 맵 이름」을 마치 명령 대상처럼 보여줘, 잘못된 mapId 를 가진 명령이 멀쩡해 보인다. 수정: 못 찾으면 missingCard(「맵을 찾을 수 없습니다」)로 폴백하거나, 최소한 캡션에 「대상 맵 없음 — 시작 맵 타일셋으로 표시」를 명시.

**[EE-13-15] (medium) transfer 프리뷰에서 타일셋이 해석되지 않으면 캔버스가 조용히 빈 채로 남는다**
`src/editor/panels/eventEditor/commandPreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/commandPreview.ts:708-716 — `drawTransferMapPreview({...}).catch(() => { drawTransferFallback(...) })` 로 폴백은 프로미스 거부에만 물려 있다. 그러나 transferMapPreview.ts:40-41 `const tileset = map ? request.project.tilesets[map.tilesetId] : undefined; if (!map || !tileset) return;` — 타일셋 정의가 없으면 거부가 아니라 조용한 해결(return)이라 catch 가 발동하지 않고, 701-704행에서 붙인 캔버스는 투명 빈 판 채로 남는다(맵 이름 캡션만 표시). 타일셋 이미지 로드 실패 같은 진성 오류는 loadTilesetImage 가 거부하므로 파란 폴백이 그려지는 것과 대비된다. 영향: 타일셋 누락 맵으로의 이동 프리뷰가 「아무것도 없는 회색 캔버스」가 되고 원인을 알 수 없다(리소스 누락 시 미리보기 지침). 수정: drawTransferMapPreview 가 map/tileset 누락을 거부로 돌리거나, transferStage 에서 미리 `project.tilesets[map.tilesetId]` 를 검사해 missingCard 로 안내.

**[EE-13-16] (medium) showPicture 폼 프리뷰가 해상도를 320×240 으로 하드코딩한다 (공용 프리뷰는 resolvePlayResolution 사용)**
`src/editor/panels/eventEditor/commandBodyPage3Native.ts` · 최종 medium · 확인 · 확신 high
위키 재검증 부산물(openwiki/editor-event-command-fixes.md:58-60의 show-picture-preview-marker 계약 표면). 위치: src/editor/panels/eventEditor/commandBodyPage3Native.ts:1175-1176 `marker.style.left = ${clampPct((px / 320) * 100)}%; top = ${clampPct((py / 240) * 100)}%`, 위치 프리셋도 320×240 고정 좌표(1225-1231행: 중앙 160,120 등). 그러나 플레이 해상도는 저작 가능한 값이다(src/project/playResolution.ts:8-13 최대 1920×1080) — 공용 프리뷰(previewPicture.ts:13-18)는 `resolvePlayResolution(store.getCurrent().system)` 으로 화면비를 따라가며 주석도 「작가가 바꾸면 그 화면비」라고 못박았다. 영향: 640×480 프로젝트에서 폼 프리뷰는 (400,300) 그림을 320×240 격자로 클램프해 우하단에 붙이고 「중앙」 프리셋은 실제 중앙이 아닌 (160,120) 을 저장한다 — 같은 명령이 폼 프리뷰와 카드 프리뷰에서 서로 다른 위치로 보인다. 수정: 폼 프리뷰와 프리셋 좌표도 resolvePlayResolution 기준으로 계산.

**[EE-13-5] (medium) 애니메이션 프리뷰가 런타임의 1.8배 속도로 재생된다 (15fps vs 120ms)**
`src/editor/panels/eventEditor/showAnimationPlayback.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/showAnimationPlayback.ts:20 `export const SHOW_ANIMATION_FRAME_MS = Math.round(1000 / 15);` (≈67ms), 138행 `timer = window.setInterval(tick, SHOW_ANIMATION_FRAME_MS);` — 주석은 「데이터베이스 스테이지와 같은 15fps」. 그러나 실제 런타임 showAnimation 은 프레임당 120ms 다: src/player/playSceneMapAnimations.ts:109 `delay: battleAnimationFrameDurationMs(record)` → src/battle/animationTiming.ts:6/10-12 `BATTLE_ANIMATION_FRAME_MS = 120` (번들 생성 이펙트만 75ms). 같은 시트를 프리뷰에서는 게임보다 약 1.8배(저작 시트)/1.12배(번들) 빠르게 재생한다. 영향: 총 재생 시간도 런타임 `frames × 120ms`(playSceneMapAnimations.ts:53 `battleAnimationDurationMs`)와 프리뷰 `frames × 67ms` 로 어긋나, 대사 타이밍을 애니메이션에 맞추는 감독이 실제 길이를 판단할 수 없다. 특별 지시 축(스케일/좌표/투명도에 더한 재생 속도 불일치). 수정: SHOW_ANIMATION_FRAME_MS 를 런타임 정수(또는 battleAnimationFrameDurationMs(record))에서 가져오고, databaseAnimationPreview.ts:12 의 사본도 같은 출처로 통일.

**[EE-13-7] (medium) 프리뷰가 화면 밖 좌표를 모서리로 클램프해 표시 — 런타임은 클램프 없이 그린다**
`src/editor/panels/eventEditor/previewPicture.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewPicture.ts:23-24 `marker.style.left = ${clampPct((cmd.x / screenW) * 100)}%`, 64-66 `clampPct = Math.max(0, Math.min(100, value))`. 런타임은 좌표를 클램프하지 않는다 — src/player/runtimeDom.ts:640-641 `container.style.left = ${transform.x}px; top = ${transform.y}px` 그대로이며 pictureTween.ts:44-45도 `finiteOr(state.x, 0)` 로 음수/초과값을 그대로 둔다. 예를 들어 화면 밖 유도용 (400, 300) 이나 페이드인 시작용 (-50, -20) 그림은 게임에서 안 보이지만 프리뷰는 화면 우하단/좌상단 모서리에 붙은 그림을 보여준다 — 실제 렌더링과 다른 위치 정보. 수정: 런타임과 동일하게 클램프 없이 배치하되 화면 밖은 마커를 흐리게(혹은 「화면 밖」 라벨) 표시하는 쪽이 정직하다. 최소한 clampPct 를 빼고 overflow:hidden 인 screen 이 잘리게 두면 게임과 동일한 잘림이 보인다.

**[EE-13-9] (medium) stopAudio 프리뷰 문구가 non-BGM 채널에서 런타임 동작과 다르게 말한다**
`src/editor/panels/eventEditor/previewAudio.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/previewAudio.ts:12-14 `text: cmd.channel === "bgm" ? "배경음(BGM)만 페이드아웃합니다" : "재생 중인 소리를 정지합니다"`. 런타임/타입 계약: src/project/types/events.ts:417-419 — 「생략하면 모든 채널 정지. `"bgm"` 은 RM2K3 「BGM 페이드아웃」 — 효과음·환경음은 계속 흐른다」. 즉 else 분기는 bgs·se·me 전부를 흡수하는데, 런타임은 채널 지정 시 그 채널만 끊는다(playSceneInterpreter.ts:544-547 `step.channel === undefined ? stopAudioCommand() : stopAudioChannel(step.channel)`). 특히 se·me 는 원샷 채널이라 src/player/audio/audioEngine.ts:236-244 `stopChannel` 이 `loopTracks.get(channel)` 에 없으면 대기 요청만 지우고 현재 재생은 그대로 흐른다 — 「재생 중인 소리를 정지합니다」는 채널="se" 에서 사실상 거짓. 영향: 감독이 소리 정지 범위를 프리뷰 문구로 판단하면 실제 게임과 다르게 남는다. 수정: 채널별 문구 표(bgm: BGM만 페이드아웃 / bgs: 환경음만 정지 / se·me: 해당 효과만 대기열에서 제거(재생 중인 소리는 계속 흐름) / 생략: 모든 소리 페이드아웃)로 교체.

저심각도 일괄:
- [EE-13-17] (low) describeRuntimeEffect 의 조명 문구 「밝기 N%」가 암전 의미를 반대로 읽게 만든다 — `src/editor/panels/eventEditor/commandPreview.ts`
- [EE-13-18] (low) humanizePictureCaption 의 죽은 삼항 분기 — 두 분기가 동일한 코드 — `src/editor/panels/eventEditor/previewPicture.ts`
- [EE-13-19] (low) renderViewToggle 만 instanceof KeyboardEvent 방어 — 같은 파일의 duck-type 방침과 상충 — `src/editor/panels/eventEditor/storyboardView.ts`
- [EE-13-20] (low) recoverAll 프리뷰가 실제 체력 대신 고정 40% 가짜 before 값을 그린다 — `src/editor/panels/eventEditor/commandPreviewActorBattle.ts`
- [EE-13-21] (low) battleStage 배경 리소스 누락 시 아무 표시 없는 맨 바닥이 된다 — `src/editor/panels/eventEditor/commandPreview.ts`
- [EE-13-8] (low) 프리뷰 캡션이 불투명도를 0~255 원시값으로 표기 (폼 입력은 %) — `src/editor/panels/eventEditor/previewPicture.ts`

### 5.14 EE-14 — 이벤트 AI 모달·어시스트 툴

**[EE-14-1] (high) place_npc가 대사 없는 NPC에 경화된 인사말을 지어내 캐스트 라이터 계약을 위반한다**
`src/editor/tools/eventTools.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:662-683. 2026-09-18 변경으로 pages·dialogue 가 모두 없으면 `pagesArg = [{ lines: [`${name}입니다. 안녕하세요.`] }]` (675행)를 기본으로 깔고, dialogue.text 만 있으면 그대로 옮긴다. 그런데 같은 저장소의 정식 계약은 editor-ai-tools.md L1471-1477 (2026-09-03 캐스트 라이터 계약): "밑그림 npc 자동 배치는 `${name}입니다.` 를 [박았다]… 전부 제거했고", "NPC 를 만드는 툴은 대사가 없으면 text 커맨드 0 인 '대기' 페이지를 만든다. 대체 문구 없음". 같은 파일이 이 계약을 아직 안다 — makeVillager 쪽 villagerPages 주석(1542-1544행) "조건 없는 대사가 없으면 기본 페이지는 대사 없이 만든다 — 인사말을 대신 넣지 않는다", friendshipLines 스키마 설명(899행) "코드는 대사를 지어내지 않는다". 영향: (1) pages 없는 place_npc 호출은 코드 주석이 인정하듯 "한 런에서 4번" 나오는 흔한 경로인데, 호출마다 전부 동일한 경화된 인사가 심긴다 — 사용자가 원래 불던 "npc 대사가 생성할 때마다 비슷하다. 하드코딩이냐?" 회귀. (2) 생성된 페이지에 text 커맨드가 있으므로 AssistantSession.authorPendingNpcCast 의 '대사 없는 NPC' 수집에서 제외되어 캐스트 라이터가 영원히 채우지 않는다. 수정: 기본 페이지를 `{ lines: [] }` (대기 페이지)으로 만들고 dialogue.text → pages[0].lines 치환만 유지하라. 대체 문구가 필요 없다는 것이 이 계약의 요지다.

**[EE-14-2] (high) AI 명령 assist는 m2Command·getFriendship이 포함된 페이지에서 항상 실패하거나 무음 삭제를 유도한다 (위키 L19 보정 주장 재검증)**
`src/ai/eventCommandAssist.ts` · 최종 high · 보류 · 확신 high
위치: src/ai/eventCommandAssist.ts:641-648 (validateAiAuthoringSurfaces), 프롬프트 규약 271-278행 ("7. 최종 목록이므로 바꾸지 않을 기존 커맨드도 그대로 다시 포함한다" / "4. 위 kind 목록에 없는 명령은 만들지 않는다"), 229-232행 (resolveAssistScope: ≤12000자면 "page"). kind 레지스트리는 src/project/commandGuaranteeRegistry.ts:186 (getFriendship) 와 :277 (m2Command) 에서 `ai: false`로 authoringSurfaces 에 "ai"를 안 넣는다. 결과: getFriendship(친밀도 조회)이나 m2Command(m2-205 경로 이동, m2-211 가중 분기 등 Page3 리치 폼 전체)가 이미 들어 있는 페이지는 "page" 스코프에서 모델이 기존 명령을 되출력하는 순간 `m2Command: AI 저작 표면에서 사용할 수 없는 명령입니다` 로 반려되고, 자가수정 3회도 지울 수 없는 기존 명령을 지우라는 오류만 되풀이해 구조적으로 실패한다. 모델이 규약 4를 우선해 빼버리면 반대로 기존 M2 명령이 삭제 diff 로 나온다. 이는 위키 보정 주장 — editor-event-authoring.md:19 "M2 명령은 저장·AI 경계에서 카탈로그 ID, 필드 원시 타입, 선택지 값을 검증한다" (2026-09-19) — 의 재검증 결과로, 실제 AI 경계는 '검증'이 아니라 종류 자체의 전면 거부다. …
> 보류 사유: m2Command 절반은 실측으로 확정 — 레지스트리 277행 ai:false, validateAiAuthoringSurfaces(641-648)가 parseAndValidate(443)에서 최종 목록 전체를 검사하고 page 스코프 규약 7(275행)이 기존 명령 되출력을 요구하므로 반려/무음 삭제 딜레마가 실재한다. 그러나 getFriendship은 ai:false가 아니고(189-193행, guarantee 헬퍼 84행이 "ai"를 추가) AI 저작 표면에 포함되므로 이 절반은 반박된다.

**[EE-14-10] (medium) author_story_arc는 flagId 충돌을 검증하지 않고 기존 플래그·퀘스트를 Object.assign으로 덮어쓴다**
`src/editor/tools/storyArcTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/storyArcTools.ts:49-65, 89. flagId 들은 `${id}-${objective.id}`(49행), `${id}-branch-choice`(51행), `cleanId(twist.flagId)`(65행)로 조립되는데 이들 사이(또는 objective.id 끼리)의 중복 검사가 없다. upsertFlag(89행)는 기존 flag 를 `Object.assign(existing, flag)` 으로 통째로 덮어쓴다. 모델이 twist.flagId 로 목표 flagId 와 같은 값을 주면 그 플래그의 targetId/description 이 반전 스위치로 갈아엎여 70행 선택지와 74행 퀘스트 노드가 서로 다른 스위치를 가리키는 교차 배선이 된다. objective.id 가 서로 같으면 quest 노드 id 도 중복된다(74행). 또 75행은 같은 quest id 가 있으면 `project.quests.filter(…)` 로 기존 퀘스트 그래프를 경고 없이 교체한다. 수정: 조립 후 flagId/quest 노드 id 중복을 검사해 ToolError 로 반려하고, 퀘스트 교체 시에도 "기존 퀘스트 교체" 경고를 남겨라.

**[EE-14-11] (medium) 스토리 플래그 도구가 퀘스트 그래프 참조를 보지 못해 rename/retire·사용처 조회가 틀린다**
`src/editor/tools/storyTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/storyTools.ts — renameStoryFlag 202-212(경고 0건), retireStoryFlag 214-230, findFlagUsage 106-131. 셋 다 사용처를 buildStoryFlagUsageIndex 에서 얻는데 이 인덱스(src/project/storyFlagUsage.ts:89-148)는 맵 이벤트·공통 이벤트·트룹 이벤트만 훑고 project.quests 는 보지 않는다. 반면 퀘스트는 플래그 id 를 직접 참조한다 — questGraph.ts:276-279 `kind === "storyFlag"` → `storyFlagById(project, flagId)` 후 없으면 throw, storyArcTools.ts:74 가 이런 조건을 만들어 둔다. storyFlagById는 기본이 includeRetired:false(storyFlags.ts:21-23)이므로 retire 만으로도 퀘스트 해석이 "storyFlag를 찾을 수 없습니다"로 깨진다. 영향: (1) 퀘스트가 쓰는 플래그를 retire하면 퀘스트 사용처 0건으로 나와 안전하다고 생각했는데 실제로는 퀘스트 그래프가 깨진다. (2) rename 후 모든 퀘스트 completesWhen 이 조용히 단절된다. (3) find_flag_usage 가 AI 에게 불완전한 사용처를 근거로 주어 삭제/retire 판단을 왜곡한다. 수정: 인덱스에 quests(nodes.completesWhen/activatesFlags) 스캔을 추가하고 rename 은 사용처 수를 retire 과 같은 형식으로 경고하라.

**[EE-14-12] (medium) upsert_event의 명령 위치 검증은 위키 계약대로 살아 있다 (검증 기록)**
`src/editor/tools/eventTools.ts` · 최종 없음 · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:506-515 — `trigger.commands` 를 invalid-args 로 거부하고 "명령을 ${path}.commands로 옮기세요" 예시를 돌려준다(509-513행). 이는 editor-ai-tools.md:1517-1522 (2026-09-05) "upsert_event의 event.trigger.commands 또는 event.pages[n].trigger.commands는 invalid-args로 거부한다… 검사는 입력 patch를 병합·정규화하기 전에 수행한다" 와 정확히 일치하고, 병합(538-542행 structuredClone 병합) 전 검사도 지켜져 있다. SimplePage 전용 필드 원자적 거부(518-533행)도 editor-ai-tools.md:1534-1540 (R10) 대로 구현돼 있다. 이 절은 계약이 소스에 살아 있음을 확인했다 — 위 결함군과 달리 재보고 대상이 아니다.

**[EE-14-13] (medium) AI assist의 보강 참조 검증이 정본 분기 순회를 복제하다 battle·shop 실패·승격 분기를 빠뜨린다**
`src/ai/eventCommandAssist.ts` · 최종 medium · 확인 · 확신 high
위치: src/ai/eventCommandAssist.ts:651-685. 이 함수는 io/commandReferenceValidation 이 다루지 않는 changeItem/changeParty 를 보강하는 용도(456-461행 주석, parseAndValidate 461행 호출)인데 순회를 손으로 case 문을 복제해 fork/choices/loop/shop(transactionBranch만)/inn(notEnoughBranch만)으로 제한한다. 정본 순회 eventCommandBranches.ts:33-38 은 shopFailure(failedTransactionBranch), battleVictory/Defeat/Escape, promotionSuccess/Failure, evolutionSuccess/Failure 까지 11종인데 이중 6종이 빠졌다. commandTraversal.ts:88-90 주석이 경고한 "예전에 다섯 벌이 갈라져 상점 실패 분기가 세 곳에서 사라졌다" 의 재발이다. 실질 구멍: changeParty.actorId 는 io 어디에서도 검증되지 않고(commandReferenceValidation.ts 전체에 changeParty case 없음) 보강 검증도 위 분기 안에서는 실행되지 않으므로, 전투 승리 분기의 changeParty(동료 합류 — 극히 자연스러운 저작)가 존재하지 않는 actorId 를 가져도 자가수정 루프가 잡지 못하고 저장된다. 수정: 이 함수의 수동 case 순회를 commandBranches(command) 재귀로 교체하라.

**[EE-14-14] (medium) AI 모달 포커스 트랩이 summary 요소를 빠뜨려 Shift+Tab으로 트랩 밖으로 탈출한다**
`src/editor/panels/eventEditor/eventAiModal.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/panels/eventAiModal.ts:31-33 — 트랩 대상 셀렉터가 `'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'` 인데 summary 는 이 목록에 없다. summary 는 기본 포커스 가능 요소로 도크 최상단(ai-event-assist-summary, aiAssist.ts:589-597)에 있고, 모달 열림 중 배경은 inert 화된다(15-22행) — 그러나 inert 화는 .event-editor-modal-window 내부 6개 표면에 한정되므로, 포인터로 summary 를 클릭해 포커스를 옮긴 뒤 Shift+Tab 을 누르면 트랩이 개입하지 못하고(36-37행은 first/last 컨트롤에서만 preventDefault) 포커스가 이벤트 편집기 바깥 작업 공간으로 탈출한다. 계약: editor-event-authoring.md:39-40 "eventAiModal.ts는 배경 입력 차단, Tab 순환, 닫기 후 포커스 복원을 맡고" — Tab 순환 소유를 스스로 주장하는 모듈의 구멍이다. 수정: 셀렉터에 summary(또는 root 자체 첫/마지막 포커스 가능 노드 탐색)를 포함하거나, 트랩을 keydown 이 아니라 focusin 감시로 root 밖 이탈을 되돌리는 방식으로 바꿔라.

**[EE-14-15] (medium) 회상 오프닝 CTA가 lines 없이 프리셋을 호출해 경화된 샘플 대사를 사용자 페이지에 심는다**
`src/editor/panels/eventEditor/memoryOpeningTemplate.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/eventEditor/memoryOpeningTemplate.ts:13 — `tool.run(draft, { mapId, preset: "memory_opening", eventId })` 로 lines/speaker 를 하나도 넘기지 않는다. script_cutscene_preset 은 lines 가 비면 프리셋 기본 문구를 채운다(src/editor/tools/narrativeHorrorTemplateTools.ts:126-133): memory_opening 기본 `["그날을 기억한다.", "창밖의 달빛."]`, speaker 기본 "나"(124행). 즉 빈 이벤트 CTA(content.ts:953 "회상 오프닝")를 누르면 사용자 프로젝트의 현재 페이지에 특정 작품 톤의 한국어 샘플 대사가 replaceCommands 로 직접 심긴다 — 이벤트 AI 모달 쪽이 "코드가 대사를 지어내지 않는다" 계약(editor-ai-tools.md:1476, eventTools.ts:899)을 지키려는 것과 정면으로 충돌한다. 부수 결함: 8-9행 `if (!tool) return;` 으로 툴이 등록되지 않으면 클릭이 무음 노드op가 된다. 수정: CTA 클릭 시 사용자에게 문구를 물어보는 입력(또는 AI 생성 위임)을 거치게 하고, 최소한 심긴 문구가 프리셋 샘플임을 상태 표시로 알려라. 툴 부재 시에는 toast 로 실패를 알려라.

**[EE-14-3] (medium) place_npc/make_villager가 명시한 id를 상점 역할 병합이 조용히 무시한다**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:713-716 — `const similar = existingNpc ?? (…findNearbySimilarNpc(map, x, y, name, 2)); const shopRole = isShopRoleNpcName(name); const mergeSimilar = Boolean(similar) && (similar?.id === explicitId || shopRole || !explicitId); const id = mergeSimilar ? similar!.id : (explicitId ?? genId("ev_npc"));`. explicitId 를 줬는데 근처(맨해튼 2칸)에 상점 역할 이름(상점 주인/상인/잡화점…, 583-585행 정규식) 이벤트가 있으면 `shopRole` 항목 때문에 명시 id 가 무시되고 기존 이벤트 id 로 병합된다. findNearbySimilarNpc (603-605행) 은 이름이 달라도 "상점 역할 유사"면 무조건 매칭한다. makeVillager 도 동일 (946-950행 `nearbyMatch = Boolean(similar) && (shopRole || !explicitId) ? similar : undefined`). 계약: 도구 설명 624행 "명시 id가 우선한다", editor-ai-tools.md:1577 "같은 명시 ID는 해당 이벤트를 재사용하며… 다른 명시 ID는 의도적 복수 배치다". 영향: 모델은 ev_merchant2 를 만들었다고 믿지만 실제로는 다른 id 의 기존 주인 페이지가 교체되고, 이후 move_event/set_npc_schedule {eventId:"ev_merchant2"} 는 event-not-found 로 되풀이 실패한다. …

**[EE-14-4] (medium) upsert_event는 맵 밖 좌표의 새 이벤트를 오류·경고 없이 통과시킨다**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:548-568. 새 이벤트는 `if (inMapBounds(map, requested.x, requested.y))` (556행) 안에서만 착지 보정을 하고, 범위 밖 좌표면 아무 검사·경고 없이 그대로 저장한다. placeNpc(688-690 "NPC 위치가 맵 밖입니다"), placeBattleBlocker(1804), place_chest(2070), place_storage_chest(2178), place_savepoint(2253), duplicate_event(2451), makeChaseScene(1952) 은 전부 맵 밖에서 ToolError 를 던진다. projectLint 에도 이벤트 좌표 범위 코드가 없다(projectLint.ts 헤더 7-29행: start-position/transfer-bounds 는 있으나 event-position 없음). 영향: 저수준 정본 툴인 upsert_event 로 (9999, 9999) 새 이벤트를 놓으면 도구는 성공 요약(574행)을 돌려주고 AI 는 자기수정할 기회를 잃는다 — 보이지 않는 이벤트가 맵 밖에 남는다. 수정: 새 이벤트 좌표가 inMapBounds 를 벗어나면 place_npc 과 같은 npc-out-of-bounds 형 ToolError 로 통일하라.

**[EE-14-5] (medium) place_battle_blocker·place_chest 등 5개 툴이 명시 id 충돌 시 기존 이벤트를 무음 교체한다**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts — placeBattleBlocker 1808/1838, placeChest 2097/2142, placeStorageChest 2188/2225, placeSavepoint 2264/2292, duplicateEvent 2448/2462 는 모두 `const id = (args.id as string | undefined) ?? genId(…)` 후 `upsertEventIntoMap(map, event)` 를 부른다. upsertEventIntoMap(206-214행)은 같은 id 가 있으면 `map.events[index] = event` 로 통째로 교체하는데 반환값("added"|"modified")을 호출부가 전부 버린다. place_npc/make_villager 는 재사용 시 "근접 유사 NPC 재사용 → id:…" 경고(720행)를 주지만 이 다섯 툴은 교체 사실을 요약·경고 어디에도 내지 않는다. 영향: 모델이 우연히 기존 id(예: 사용자가 손으로 만든 이벤트)를 재사용하면 그 이벤트가 전투 블로커/보물상자/복제본으로 조용히 덮이고, 결과 요약은 "배치/복제"로만 읽힌다. 수정: upsertEventIntoMap 반환값이 "modified"면 `기존 이벤트 'X' 교체` 경고를 warnings 에 추가하거나, 교체가 목적이 아니면 동일 id 존재 시 ToolError 로 거부하라.

**[EE-14-6] (medium) 같은 switch/variable 참조 오류가 툴마다 세 가지 다른 계약으로 처리된다 (ID 권위 위반 포함)**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:306-355 + 호출부 754(placeNpc)/1053(makeVillager). upsert_event 은 이 함수를 부르지 않고(570행 assertEventShape 만), place_npc/make_villager 는 미등록 switchId/variableId 를 `ensureNamedSwitch` 로 실제 레코드를 만들어 버린다(308-334행, 경고 "미등록 switchId 자동 생성"). 같은 참조 오류에 세 가지 계약이 공존한다: event_command_assist=자가수정 반려, upsert_event=커밋 린트 거부(commandReferenceValidation.ts:199-208 setSwitch/setVariable assert), place_npc/make_villager=경고 후 승격. 게다가 자동 생성 순회(336-345행)는 choices/fork/loop 만 재귀하고 shop.transactionBranch/failedTransactionBranch, inn.notEnoughBranch, battleProcessing 승/패/도주 분기, promoteActor/evolveMonster 분기는 건너뛴다 — commandBranches 가 정본으로 여는 11종 분기(eventCommandBranches.ts:33-38) 중 6종이 빠져 같은 명령이 분기 위치에 따라 만들어지기도 하고 안 되기도 한다. 영향: 모델이 지어낸 id("sw_quest_done" 등)가 경고만으로 실제 프로젝트 레코드가 되는 ID 권위 위반이면서, 분기 안에서는 또 무음 누락된다. …

**[EE-14-7] (medium) script_cutscene replace가 이름이 「컷신」인 모든 페이지를 묻지도 않고 지운다**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:2691-2719 — 페이지 이름을 고정 리터럴 "컷신"으로 만들고(2693행), replace 모드에서 `existing.pages.filter((entry) => entry.name !== "컷신")` 로 이름이 같은 페이지를 전부 지운 뒤 새 페이지를 붙인다(2717-2719행). 페이지 식별은 `${eventId}_cutscene_N` id (2692행) 으로도 가능한데 이름을 쓴다. 영향: (1) 사용자가 우연히 "컷신"이라고 이름 붙인 일반 페이지(대사·이벤트 페이지 이름은 자유 문자열)는 이벤트 id 를 지정해 컷신을 심는 순간 내용과 무관하게 삭제되며 경고도 없다. (2) append 로 쌓은 컷신 페이지가 여러 장이면 replace 한 번에 전부 지워진다. memoryOpeningTemplate.ts:15 의 `pages?.find(page => page.name === "컷신")` 도 같은 이름 기반 계약에 의존한다. 수정: 교체 대상은 `${eventId}_cutscene_*` id 접두로 한정하거나, 삭제되는 페이지 목록을 warnings 에 남기라.

**[EE-14-8] (medium) make_villager의 shop 인자가 이미 shop 커맨드가 있는 페이지에 상점 커맨드를 중복 삽입한다**
`src/editor/tools/eventTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/eventTools.ts:1244-1246 `appendShopCommandToPages` 는 모든 페이지에 무조건 `page.commands.push(shopCommandFromStock(stock))` 한다. make_villager 는 authored pages 를 compileSimplePages 로 합성하는데(eventCompile.ts:516 — `commands.push(...normalizeCommands(page.commands…))`, SimplePage 스키마도 commands 허용, schemaShapes.ts:303), 모델이 pages 에 직접 shop 커맨드를 넣으면서 `shop:{stock}` 도 주면 한 페이지에 shop 커맨드가 두 개 쌓인다. 반면 같은 파일의 setShopStockOnEvent(1248-1271)은 findFirstShopCommand 로 기존 커맨드를 수정해 중복을 피한다. 영향: 런타임에서 상점 UI 가 연달아 두 번 열리고, 이후 set_shop_stock 은 첫 shop 만 고치므로 두 번째 커맨드에 옛 재고가 남아 "재고를 바꿨는데 옛 아이템도 팔리는" 상태가 된다. 수정: appendShopCommandToPages 도 findFirstShopCommand 기반 수정-없으면-추가로 통일하라.

**[EE-14-9] (medium) author_story_arc가 목표 스위치를 안내 직후 즉시 true로 세워 퀘스트 노드를 태어나자마자 완료시킨다**
`src/editor/tools/storyArcTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/storyArcTools.ts:69-74. 목표마다 `[textCommand(objective.text), { kind: "setSwitch", switchId: objectiveSwitchIds[index], value: true }]` 로 안내 문구를 보여 준 직후 목표 스위치를 즉시 true 로 세우고(69행), 퀘스트 노드는 `completesWhen: { kind: "storyFlag", flagId: objectiveFlagIds[index], value: true }` (74행)으로 같은 스위치를 완료 조건으로 건다. 영향: 서사 비트 이벤트 한 번 실행으로 모든 튜토리얼 목표 노드가 동시에 즉시 완료된다 — objectives 가 '플레이어가 수행해야 할 목표'가 아니라 '읽으면 끝나는 각주'가 되고, lint_quest/walkthrough/adventure 완료 판정이 공갈 데이터를 보게 된다. 툴 설명(14행)은 "결정론적 튜토리얼 목표… 템플릿"이라고만 하며 즉시 완료 의도는 어디에도 없다. 수정: 목표 스위치 세팅을 스토리 비트에서 빼고, 모델이 실제 목표 달성 이벤트를 후속 툴로 같은 switchId(data.objectiveFlagIds 반환은 flagId 뿐이라 targetId 도 함께 돌려줘야 한다)에 연결하도록 계약을 명시하라.

저심각도 일괄:
- [EE-14-16] (low) make_villager 병합 시 이동 갱신 경고가 approach를 「fixed(제자리)」라고 잘못 말한다 — `src/editor/tools/eventTools.ts`
- [EE-14-17] (low) place_chest는 없는 itemId를 부드러운 경고로 통과시켰다가 커밋 게이트에서 일반 문구로 반려한다 — `src/editor/tools/eventTools.ts`
- [EE-14-18] (low) aiAssist의 hasEventAiStagedDraft/eventAiStagedCommands는 호출부가 없는 죽은 계약이며 주석이 옛 설계를 말한다 — `src/editor/panels/eventEditor/aiAssist.ts`

### 5.15 EE-15 — AI 패널 × 이벤트 흐름 (승인·적용·되돌리기)

**[EE-15-1] (high) 검토 대기로 보류된 지연 적용 초안이 어떤 표면에도 표시·복원되지 않아 이벤트 편집기 AI와 패널 상태를 영구 점유한다**
`src/editor/panels/aiChatPanel.ts` · 최종 high · 확인 · 확신 high
위치·증거: src/editor/panels/aiChatPanel.ts:3448-3449 `if (sendOptions?.eventCommandScope && (turnBusy || proposalApi.pendingProposalMessage !== null)) return { ok:false, error:"조수의 진행 중인 작업이나 검토 중인 초안을 먼저 마무리하세요."… }`. 이 pendingProposalMessage는 databaseAiBar의 deferApply 턴(aiTurnRunner.ts:792-796 → aiChatPanel.ts:1869-1881 holdProposal)이 검토 대기로 넘긴 초안을 표시하는 값이다. 그런데 (1) 이 초안의 유일한 사용자 표면은 DB 모달 안의 카드인데 그 카드는 자기 턴 결과로만 그린다 — databaseAiBar.ts:639 `paintCards(result.pendingProposal ?? null)`(마운트 시 복원 없음, pendingChanges는 477행에서 빈 배열로 시작). (2) 패널 자체는 holdProposal이 pendingProposalMessage를 세워도 변경 카드·적용/버리기 UI를 하나도 렌더하지 않는다(aiChatPanel 전체에서 pendingProposalMessage 사용처는 1772·3031-3033·3056·3448·3483뿐 — 전부 판정/상태용). (3) 브리지의 조회 API `getAiAssistantPendingProposal`(src/editor/aiAssistantBridge.ts:166-168)는 구현만 있고 호출자가 0건이다. …

**[EE-15-2] (high) 검토 대기 중인 DB 지연 적용 초안이 일반 채팅 턴 한 번으로 표면의 결정 없이 통째로 적용된다**
`src/editor/panels/aiChatPanel.ts` · 최종 high · 확인 · 확신 medium
위치·증거: 브리지 계약은 src/editor/aiAssistantBridge.ts:51-55 «턴이 끝나도 초안을 스토어에 적용하지 않는다… 검토 게이트를 가진 표면(DB 검토 오버레이)만 쓴다»인데, 일반 채팅 전송은 이 게이트를 우회한다. aiChatPanel.ts:1771-1774 `if (!opts?.replay && proposalApi.pendingProposalMessage === null) { session.syncBaselineFromStoreIfClean(…) }` — 보류 중엔 기준 동기화를 건너뛰고, assistantSession.ts:1804-1826의 턴 시작 rebase는 `startsGoal = goalAction === "new-goal"`일 때만 일어나는데 일반 채팅 전송은 goalAction을 넘기지 않는다(aiChatPanel.ts:1801-1802, new-goal은 eventCommandScope일 때만). 그래서 세션 초안(turnProposals)에 보류분이 그대로 남은 채 다음 일반 턴이 누적되고, resolveProposalApplyMode(approvalPolicy.ts:37-39)는 callCount만 보므로 apply-now로 판정돼 aiTurnRunner.ts:797-808이 `result.proposedCalls`(보류분+신규 전체)를 deps.applyProposal로 통째로 적용한다. recordApplication(assistantSession.ts:3552-3553)이 적용 시 turnProposals를 비우므로 흔적도 없다. …

**[EE-15-3] (high) AI 되돌리기 표면 3곳이 공유 undo 스택 top을 무조건 pop해 수동 편집을 AI 변경으로 둔갑시키고 «되돌림» 배지를 허위로 찍는다**
`src/editor/panels/aiChatPanel.ts` · 최종 high · 확인 · 확신 high
위치·증거: 패널 버튼은 src/editor/panels/aiChatPanel.ts:2443-2451 — `if (!undoMapEdit()) return; const reverted = getLastAppliedProposalMessage(); if (reverted) { appendBubble("system", `제안 ${reverted.calls.length}건(…)을 되돌렸습니다.`); setAssistantMessageBadge(reverted.assistantBubble, "reverted"); }`. 변경 카드의 onUndo도 동일하게 `noteAiChangeUndone(…); undoMapEdit();`(aiChatPanel.ts:770-776, 799-802)인데 그 직전 주석은 «이 카드는 AI 변경 1건에 1:1로 붙어 … 사람이 직접 그린 타일의 undo와 섞이지 않는다»고 주장한다. 그러나 undoMapEdit은 src/editor/mapEditHistory.ts:260-262 `const previous = undoStack.pop(); if (!previous) return false;` — kind·label 검증 없는 맹팝이다. …

**[EE-15-4] (medium) 새로고침·프로젝트 전환 시 지연 적용(lazy) 초안이 어떤 표면에서도 복원되지 않고 조용히 유실된다**
`src/editor/panels/aiChatPanel.ts` · 최종 medium · 확인 · 확신 high
위치·증거: 보류 초안의 패널 측 실체는 메모리 필드뿐이다 — src/editor/panels/aiChatPanel.ts:1861-1881 `let deferredProposal = { calls, assistantBubble, before, after, summary } | null` (holdProposal이 채움). 세션 측 체크포인트는 내구성이 있다(assistantSession.ts:495-502 proposal-ready 단계에 calls 저장, aiProposalCard.ts:331-336 «적용 전 내구성은 기다려서 확보한다(크래시 복구의 전제)»), 그러나 재시작·프로젝트 전환 뒤 이를 다시 보류 카드로 살리는 경로가 없다: databaseAiBar는 결과로만 그리고(aiChatPanel 판단과 동일 — databaseAiBar.ts:639), getAiAssistantPendingProposal 소비자 0건(aiAssistantBridge.ts:166-168). 프로젝트 전환 위키 기록(openwiki/editor-ai-panel.md:2046 «전환 시 진행 턴을 abort하고 대기 큐를 버리며»)은 턴 기준이고 보류 결정 상태는 다뤄지지 않는다. 영향: 사용자가 «적용»을 누르기로 마음먹었던 AI 작업물이 새로고침 한 번에 검토 불가능한 상태로 사라진다(스토어는 무변환이므로 유실은 AI 산출물 쪽). runOperation은 heldProposalForReview로 살아 있던 것(aiTurnRunner.ts:594)이 새 턴 beginRunOperation에서 회수된다. …

**[EE-15-5] (medium) 이벤트 전용 제안(타일 무변경·다른 맵 대상)의 변경 카드가 대상 맵이 아니라 현재 맵을 렌더해 «지도 그림에 나타나지 않습니다»라고 거짓 말한다**
`src/editor/panels/aiChatPanelHelpers.ts` · 최종 medium · 확인 · 확신 high
위치·증거: src/editor/panels/aiChatPanelHelpers.ts:112-124 proposalPreviewMapId — 타일 변경이 있을 때만 mapIdsReferencedByCall로 대상 맵을 찾고, 그 외(이벤트 전용: place_npc·move_event·upsert_event 등)는 `firstMapWithTileDiff(before, after)`를 반환하는데 이 함수(97-110행)는 lower/upperTiles 비교만 하고 events는 전혀 보지 않아 이벤트 전용 제안에서 항상 null이다. aiProposalCard.ts:326-328 `const completionMapId = proposalPreviewMapId(…) ?? currentHistoryMapId() ?? applyProject.startMapId;` — 즉 사용자가 보고 있는 맵이 카드 맵으로 확정된다(적용 이전에 계산되므로 agentFocus의 맵 전환도 반영 못 한다). emitChangeCard(aiChatPanel.ts:939-942)가 이 mapId로 before/after를 렌더하고, 두 판이 같으면 aiChangePreview.ts:349-350이 wordDiffNote — «이번 변경은 지도 그림에 나타나지 않습니다 — 아래 변경 내역을 확인하세요.»(aiChangePreview.ts:219-221)를 내보낸다. 영향: «다른 맵 입구에 NPC/이벤트 만들어줘» 같은 흔한 위임에서 카드는 실제로 이벤트가 생긴 맵을 그릴 수 있으면서 그리지 않고, 나타나지 않는다는 허위 문장을 말한다. …

**[EE-15-6] (medium) 소유권 상실 후 성공한 적용이 채팅에 아무 흔적도 남기지 않는다 — 중단해도 프로젝트는 바뀌는데 영수증이 없다**
`src/editor/panels/aiProposalCard.ts` · 최종 medium · 확인 · 확신 high
위치·증거: src/editor/panels/aiProposalCard.ts:363 `if (!ownsApply()) return applied.ok ? "applied" : "rejected";`와 379 `if (!ownsApply()) return "applied";` — 소유권 상실(사용자 중단·새 턴 시작·세션 교체) 직후 성공한 적용은 setAssistantMessageBadge(381)·lastAppliedProposalMessage(382)·appendBubble(384)·toast(393)·onApplied(396) 전부 생략된다. 같은 파일 331-342 주석은 prepareCheckpointApply 단계에서 정확히 이 실패 클래스(«삼키면 적용됐는지 모르는 상태를 만든다»)를 의식해 소유권 상실만 예외 아님으로 처리했지만, 적용 성공 이후 영수증 경로에는 같은 보호가 없다. applyProposedProject는 이미 store.replace와 undo 스냅샷을 마쳤다(applyChangesetToStore.ts:384-388). 영향: 사용자가 중단을 눌렀는데 스토어는 바뀌고 채팅에는 어떤 흔적(버블·배지·변경 카드·토스트)도 남지 않는다 — «되돌리기가 유일한 복구» 정책(approvalPolicy.ts:1-8)의 전제인 «무엇이 적용됐는지 볼 수 있다»가 깨진다. 수정 제안: 소유권 상실 + applied.ok일 때도 최소 한 줄의 시스템 버블(«중단/교체와 무관하게 변경 N건이 적용됐습니다»)과 스냅샷 라벨을 남길 것.

**[EE-15-7] (medium) 보류 초안의 이중 상태(deferredProposal vs pendingProposalMessage)가 어긋나 이미 무효가 된 적용·조회가 허위 결과를 낸다**
`src/editor/panels/aiChatPanel.ts` · 최종 medium · 확인 · 확신 high
위치·증거: holdProposal은 둘 다 세운다(src/editor/panels/aiChatPanel.ts:1872-1880 deferredProposal + proposalApi.pendingProposalMessage). 그러나 정산 경로가 갈린다: ① applyProposal은 proposalApi 쪽만 만진다 — aiProposalCard.ts:296 `pendingProposalMessage = { calls, … }`로 **덮어쓰고**, 382-383에서 `lastAppliedProposalMessage = pendingProposalMessage; pendingProposalMessage = null;`. ② applyPendingProposal은 deferredProposal만 지운다(aiChatPanel.ts:1893). ③ discardPendingProposal은 둘 다 지운다(1900-1901). 결과: DB 보류 중에 일반 적용 턴이 지나가면 pendingProposalMessage는 null이 되지만 deferredProposal는 옛 calls·before/after 스냅샷을 계속 들고 있고, 브리지 getPendingProposal(aiChatPanel.ts:3511)은 이미 스토어에 반영된(또는 무관해진) 옛 초안을 계속 노출한다. 이 상태에서 DB «적용»을 누르면 applyProposal의 중복 가드(aiProposalCard.ts:251 `lastAppliedProposalMessage?.calls === calls`) 또는 검수 미승인 가드(244)로 거부되고, DB 바는 databaseAiBar.ts:687 «적용 실패 — …»를 보여준다. …

**[EE-15-8] (medium) 이벤트 어시스트의 mode 결정권이 호스트(고정)와 툴(재판정) 이중화돼 있어 두 게이트가 서로 모순되는 거부를 내고 요청이 교착된다**
`src/editor/panels/eventEditor/aiAssist.ts` · 최종 medium · 확인 · 확신 medium
위치·증거: 호스트는 패널을 열 때 한 번만 정한다 — src/editor/panels/eventEditor/aiAssist.ts:190 `const scope = resolveAssistScope(page);`(렌더 시점) → 432 `mode: scope === "append" ? "append" : "edit"`로 고정 전송. 툴 쪽은 매 호출 새로 판정한다 — src/editor/tools/asyncToolRunner.ts:38-41 `const scope = normalized.mode === "append" ? "append" : resolveAssistScope(page); if (scope === "append" && normalized.mode !== "append") throw … "추가 요청만 mode:'append'로 실행하세요."`. resolveAssistScope는 직렬화 길이 기준(src/ai/eventCommandAssist.ts:229-232). 페이지가 길어지면(수동 편집·직전 append 적용 등으로 도크를 열 때와 달라지면) 첫 게이트가 mode:'append'를 요구하고, 모델이 그대로 따르면 호스트 스코프 게이트가 반대로 거부한다 — src/ai/eventCommandScope.ts:20-22 `(args.mode ?? "edit") !== (scope.mode ?? "edit")` → wrongTarget. 거부 문구는 두 게이트 모두 «이 요청에서는 지정한 이벤트 페이지의 명령만 수정할 수 있습니다. …

저심각도 일괄:
- [EE-15-10] (low) 제거된 승인 흐름의 사체가 위키 정본의 근거로 남아 있다 — proposalSafety 전체와 proposalNeedsExplicitApproval은 호출자 0, requiresApproval 게이트 주석은 허위 — `src/editor/proposalSafety.ts`
- [EE-15-11] (low) 부팅 의도(boot intent) 전송 경로 주석이 폐기된 «proposal-gated» 시절 서술을 남긴다 — `src/editor/panels/aiChatPanel.ts`
- [EE-15-12] (low) 위키 «제안은 승인 없이 바로 적용된다» 항목이 현재 코드의 독립 검수 게이트와 모순된다(문서 미갱신) — `openwiki/editor-ai-panel.md`
- [EE-15-9] (low) applyPendingProposal의 실패 문구가 실제 사유(검수 미승인·중복·소유권 상실)를 가리고 오탈자가 있다 — `src/editor/panels/aiChatPanel.ts`

### 5.16 EE-16 — 이벤트 에디터 CSS·시각 일관성

**[EE-16-1] (high) 푸터 더보기 메뉴가 .event-editor 스코프 전용 토큰(--mk-line/--mk-raised)을 소비해 테두리·배경이 통째로 소실된다**
`src/styles/event/footer.css` · 최종 high · 확인 · 확신 high
위치: src/styles/event/footer.css:99,101 — `.event-editor-footer-more-menu { border: 1px solid var(--mk-line); background: var(--mk-raised); }`. 그런데 --mk-line/--mk-raised는 저장소 전체에서 src/styles/event/shell.css:657,660 (` .event-editor { --mk-line: rgba(42,37,33,.12); --mk-raised: var(--bg-raised); }`) 한 곳에만 선언돼 있다. 푸터는 .event-editor의 자손이 아니다: shell-2.css:339-343 주석 "`.event-editor` 는 모달 **본문**을 감싸는 요소이지 창 전체가 아니다. 실측한 조상 사슬은 `.event-editor-modal-backdrop > .event-editor-modal-window > .event-editor-modal-header`" 이고, modal.ts:299 `windowEl.append(header, body, footer, resizeHandle)` 로 푸터는 body와 형제다. :root(shell.css:832-847)에도 --mk-line/--mk-raised는 없다. 따라서 푸터 더보기(⋯) 메뉴에서 두 var()는 guaranteed-invalid → `border`는 border-style:none으로, `background`는 transparent로 계산되고 box-shadow(footer.css:102)만 남은 투명·무테두 190px 패널이 본문 위에 뜬다. …

**[EE-16-10] (medium) 인라인 스타일 우회 — 루프 본문 카드는 style 문자열로, Page3 조명 무대는 TS 하드컬러 그라디언트로 그려진다**
`src/editor/panels/eventEditor/commandBodyLoop.ts` · 최종 medium · 확인 · 확신 high
(1) src/editor/panels/eventEditor/commandBodyLoop.ts:13-14 `attrs: { style: "border:1px solid var(--border);padding:4px;margin-top:4px;border-radius:3px;" }` — 표현을 src/styles 밖 인라인으로 소유하며, 인라인이므로 dialogs-5.css:475-499의 라운딩 문법 고정(바깥 6px/안쪽 4px)과 shell-2/토큰 체계가 아무리 바뀌어도 이 노드만 3px로 남는다. (2) commandBodyPage3Native.ts:146 `stage.style.background = \`linear-gradient(180deg, #3a4a62, #1c2433)\`` — 어두운 프리뷰 무대의 색을 TS 하드컬러로 넣는데, 같은 종류의 CSS 무대(command-preview-4.css:148)는 `linear-gradient(180deg, #3d4655, #2f3642)`로 값 자체가 다르다(같은 편집기에 두 벌의 '밤 무대' 색). 수정: loop 본문 스타일은 event CSS 버킷(.loop-body-editor 규칙)으로 옮기고, 무대 그라디언트는 공용 클래스+토큰으로 일원화.

**[EE-16-2] (medium) 명령 분류 색이 3벌로 갈라져 같은 카테고리가 목록·피커·인스펙터에서 서로 다른 색으로 보인다**
`src/styles/event/shell.css` · 최종 medium · 확인 · 확신 high
같은 명령 분류가 표면마다 다른 색으로 렌더된다. (1) 목록 레일: shell.css:633-642 `--cmdcat-dialogue: var(--accent); --cmdcat-flow: var(--warning); --cmdcat-map: #0F7490; --cmdcat-screen: #7A3E9D; --cmdcat-system: var(--text-3)` — 주석에 "여섯 색 모두 순백 위 4.5:1 이상"이라는 실측 근거가 있다. (2) 명령 피커: src/styles/event/subdialogs/dialogs-4.css:690-704 `[data-category="dialogue"] { --pick-cat: #3987e5; } … flow #d95926, reward #199e70, map/actor #9085e9, screen/sound #d55181, system #c98500` (팔레트 자체가 다르고 dialogue가 액센트가 아니라 파랑). (3) 인스펙터 최근 항목 거터: src/styles/event/inspector.css:196-206 `--lg-cat: #3987e5/#d95926/#199e70/#9085e9/#d55181/#c98500` — 피커의 3번 체계와 동일. command-list-3.css:956은 "새 색은 만들지 않는다 — 전부 기존 토큰(--cmdcat-*, --control-bg, --danger)이다"라고 정합을 약속했지만 피커·인스펙터는 이를 어긴다. 수정: dialogs-4.css:690-704와 inspector.css:196-206을 --cmdcat-* 참조로 교체하고 2차 채널(사선 텍스처, command-list-2.css:439-443 선례)로만 보조 구분.

**[EE-16-3] (medium) 이벤트 에디터 모든 폼 라벨이 11px+uppercase+자간 — 실측으로 '겹쳐 읽혔다'고 반성한 한글 눌림 패턴이 전역 규칙으로 남아 있다**
`src/styles/event/shell.css` · 최종 medium · 확인 · 확신 high
위치: src/styles/event/shell.css:8-16 `.event-editor label { display:block; font-size: 11px; … text-transform: uppercase; letter-spacing: 0.4px; }`. 같은 스코프의 shell-2.css:213-219도 `.event-editor .field label { … font-size: 11px; }`로 유지한다. 그런데 inspector.css:97-99에는 실측 반성이 있다: "한글 라벨에 mono + uppercase + 자간을 주면 글자가 짓눌려 보인다(실측: '현재 페이지'가 겹쳐 읽혔다). 라벨은 산세리프로 두고 강조는 굵기·색으로만 한다." 또한 문법 고정(dialogs-5.css:443 "글자 12 보조 · 13 본문 · 15 제목")과 읽는/꾸미는 글자 계약(dialogs-5.css:583-584, 꾸미는 글자 최소 12px)에도 어긋난다. 모달 보정 레이어도 이를 못 만진다 — dialogs-5.css:451-462는 button/input/select/summary만 13px로 올리고, command-list-4.css:136-172의 12px 화이트리스트에는 `label`이 없다(legend/small/kbd만 있음). 결과: 이벤트 에디터의 모든 폼 라벨(조건·페이지·그래픽·스케줄 등)이 11px 대문자변환+자간 상태로 출하된다. 수정: shell.css:8-16에서 font-size 12px, text-transform/letter-spacing 제거(굵기·색으로만 강조).

**[EE-16-4] (medium) 12px 보조 글자 고정이 화이트리스트로만 적용돼 서브다이얼로그·폼·미리보기에 8~11.5px 글자가 다수 잔존한다**
`src/styles/event/subdialogs/dialogs-2.css` · 최종 medium · 확인 · 확신 high
보조 글자 12px 문법 고정은 command-list-4.css:135-174(주석 "보조 글자 12px — 세대별 9~11.5px 를 전부 올린다")의 화이트리스트 + `.event-editor-modal-window` 스코프로만 적용된다. 리스트에 없는 표면은 그대로다. 잔존 예시: src/styles/event/subdialogs/dialogs-5.css:331 `.event-character-id-label-text { font: 700 10.5px/1.2 … }`, 같은 파일 :340 일정 삭제 버튼 `font: 650 10.5px/1`; dialogs-2.css:881-882 `content: "안내"` 의사요소 `font: 700 10px/1` — editor-database.md L1396-1400이 실측으로 정한 "의사요소 텍스트도 11px 미만 금지(tinyPseudo)" 교훈 위반; forms-4.css:273-277 상점 구획 라벨 `font: 700 10px/16px … text-transform: uppercase`; command-preview-2.css:304 `.ecp-picture-placeholder-xy { font-size: 9px }`; forms-5.css:587-588 `font: 700 10px/1`; dialogs-3.css:53 `font-size: 10.5px`; command-preview-3.css:198 `.ecp-wait-ticks` 10px; command-preview.css:87-88 좌표 10px. 수정: 12px 상향을 화이트리스트가 아니라 표면 공통(서브다이얼로그/폼/미리보기 포함) 규칙으로 확장하거나, 빌드 게이트(qa-event-editor-ux C7~C11)를 이 파일군까지 확대.

**[EE-16-5] (medium) 행 배경 설계가 3세대(얼룩무늬/깊이 틴트/블록 캔버스 카드) 공존이고 파일 주석이 실제 캐스케이드 승자와 어긋난다**
`src/styles/event/command-list.css` · 최종 medium · 확인 · 확신 high
한 행의 배경이 세 세대 규칙으로 경합한다: (a) command-list.css:286-297 얼룩무늬 — `.cmd-list > .cmd-item:nth-child(odd) > .cmd-head { background-color: var(--event-rm-field) }`(특이도 0,5,0); (b) command-list.css:816-832 깊이 틴트 밴드(0,4,0); (c) command-list-2.css:470-495 블록 캔버스 카드 — `background: color-mix(in srgb, var(--blk-cat) 5%, var(--bg-surface)); border: 1px solid …; border-radius`(0,4,0). 그런데 command-list.css:834-835 주석은 "zebra 줄무늬는 스레드 틴트/레일과 충돌하므로 비활성화(아래 transparent 규칙 없음). part-2.css zebra 특이도는 modern의 depth tint / hover 규칙이 이긴다"라고 주장하지만 실제 캐스케이드에서 (0,5,0) zebra가 (0,4,0) 틴트를 이기므로 주석과 승자가 다르고, 지금은 뒤에 실리는 dialogs-5.css:611-619(0,5,0, `background: transparent; border-color: … transparent`)가 우연히 전부 덮어 "행은 줄이다"(dialogs-5.css:585) 계약이 성립한다. 즉 위키 보정(행=줄)은 반영돼 있으나 기본 시트에 구세대 카드 디자인(command-list-2.css:369-383 주석은 "행을 카드로"라는 반대 정준을 실측 근거와 함께 주장)이 살아 있어 index.css import 순서만 바뀌면 네 변 테두리+틴트 행으로 즉시 회귀한다. …

**[EE-16-6] (medium) 30렌즈 리뷰 C26의 hex 재정의 블록은 제거됐으나 :root 골드 별칭·이중 --mk-accent·미정의 토큰 폴백(폐기된 크림/골드 값)은 잔존한다**
`src/styles/event/shell.css` · 최종 medium · 확인 · 확신 high
docs/2026-09-19-event-editor-30lens-adversarial-review.md C26(shell.css:876-888 hex 재정의 13종) 재검증 결과, 지적된 hex 복사 블록 자체는 현재 shell.css:863-888에서 제거돼 `background: var(--bg-base); color: var(--text-1)` 등 토큰 참조로 회귀했다(수정 반영 확인). 그러나 같은 제안의 나머지는 미반영이다: (1) shell.css:832-847 `:root` alias-collapse 블록 잔존 — :845 `--mk-accent: var(--gold)`가 shell.css:654 `.event-editor { --mk-accent: var(--accent) }`와 이중 정의(주석 "액센트는 셸 토큰 하나로 통일한다… 목업 시절의 황동은…"와 모숭), :840 `--oprn-command-orange: var(--gold)`도 골드 의존. (2) 미정의 토큰+폐기 팔레트 폴백이 실제 렌더를 결정: --text-dim/--bg-elev/--text-on-accent/--text-inverse는 tokens.css에 없고(shell.css:12 `var(--text-dim, unset)` 등), 각 파일의 폴백 리터럴이 구 크림 값(#FFFDF8/#EFE9DC/#2A2521/#5C5348)·구 골드 경고(#d9a441 vs 현 --warning #8A5E00)·갈색 회색(#6B5F52 vs 현 --text-3 #626E89)이라 예: dialogs-3.css:477 `var(--text-on-accent, #2A2521)`, dialogs-4.css:743 `var(--text-inverse, #fff)`.  …

**[EE-16-7] (medium) 등장 조건 모달이 폐기된 웜 브라운 스크림 하드컬러와 하드 z-index를 쓴다 — 같은 편집기의 다른 백드롭은 --bg-scrim 토큰**
`src/styles/event/pages-4.part-2.css` · 최종 medium · 확인 · 확신 high
pages-4.part-2.css:191-199 `.event-condition-modal-backdrop { background: rgb(39 36 28 / 42%); … position: fixed; z-index: 1000; }`, :205 그림자 `rgb(44 37 24 / 28%)`. tokens.css(그리고 TOKENS.md:27)가 제공하는 --bg-scrim `rgba(15, 23, 42, 0.40)`은 같은 에디터의 최상위 백드롭이 이미 쓴다(dialogs-5.css:653 `background: var(--bg-scrim)`). 즉 같은 편집기 안에서 조건 편집 모달만 슬레이트가 아니라 폐기된 크림 테마의 웜 브라운 세계로 떨어진다. z-index도 토큰 스케일(--z-*, tokens.css:114-152) 없이 1000 하드코딩(shell.css:422과 같은 매직 넘버). 수정: --bg-scrim/--shadow-modal 참조로 교체하고 z-index는 --z-* 토큰으로.

**[EE-16-8] (medium) 토큰 값을 hex로 복제한 하드컬러가 여러 표면에 잔존한다(전환 프리뷰 스트립·편집 아이콘·캐릭터 링크 그린·presence 스프라이트)**
`src/styles/event/subdialogs/dialogs-2.css` · 최종 medium · 확인 · 확신 high
토큰의 현재 값을 리터럴로 복제해 토큰 변경 시 자동으로 어긋난다. (1) src/styles/event/subdialogs/dialogs-2.css:47-49 `linear-gradient(90deg, #C6403D 0 25%, #E8D9A8 25% 50%, #18764F 50% 75%, var(--accent) 75%)` — #C6403D=--danger, #18764F=--success, #E8D9A8=--gold-soft(tokens.css:167)의 값 복제. (2) dialogs.css:801-803 편집 아이콘 `linear-gradient(135deg, var(--accent) 0 45%, #E8D9A8 45% 70%, …)` — 폐기된 골드소프트 하드코딩. (3) pages-3.css:596-598 `.event-character-link-control.is-linked .event-character-link-dot { background: #2d9b70; box-shadow: 0 0 0 3px color-mix(in srgb, #2d9b70 18%, transparent); }`와 :679 `color: #2d9b70` — 성공 색인데 var(--success)(#18764F)를 우회한 별개 초록. (4) pages-4.css:276-300 `.presence .sprite` 계열 #9bb07a/#5a3d28/#d7b07a(pageProps.ts:962-967에서 실사용). command-list-3.css:91 스스로 "토큰만 사용(TOKENS.md) — 하드코딩 색 금지"라고 명시한다. 수정: 각 값을 대응 토큰(var(--danger)/var(--success)/var(--gold-soft)/var(--success)) color-mix로 대체.

**[EE-16-9] (low) 비활성 조건 행이 disabled 속성 없이 opacity+pointer-events로만 비활성화돼 키보드로 '비활성' 컨트롤을 수정할 수 있다**
`src/styles/event/command-forms/forms-2.css` · 최종 low · 보류 · 확신 high
위치: src/styles/event/command-forms/forms-2.css:464-469 `.event-condition-row.disabled .self-switch-key, .event-condition-row.disabled .self-switch-value { opacity: 0.5; pointer-events: none; }`. 클래스만 붙는다: pageConditions.ts:274-278 `class: \`event-condition-row${checked ? "" : " disabled"}\`` (주석 "비활성도 컨트롤 자리를 남긴다") — 내부 input/select에 실제 disabled 속성을 대입하는 코드가 없다. 결과: 포인터로는 눌리지 않지만 Tab으로 초점이 가고 값 변경이 가능한 '비활성처럼 보이는' 활성 컨트롤이 된다(스크린리더는 enabled로 안내). 포인터 이벤트로 동작을 막는 CSS 우회는 특별 점검 항목 그 자체다. 수정: 행 상태 동기화 시 자식 컨트롤에 disabled 속성을 실제로 걸고(또는 fieldset disabled), CSS는 모양만 담당.
> 보류 사유: CSS만으로 비활성화(forms-2.css:465-469)·disabled 속성 부재(pageConditions.ts:275)는 사실이나, 266-268행 주석이 「비활성 행의 컨트롤을 만지면 그 행이 켜진다」고 설계를 명시하므로 키보드로 값을 바꾸는 것은 의도된 활성화 경로다. 실제 결함은 pointer-events:none이 이 설계를 포인터에선 막아 입력 계열 간 동작이 갈리고 스크린리더에 비활성처럼 보이는 상태라 low로 하향·부분 인정.

저심각도 일괄:
- [EE-16-11] (low) record-browser-hidden-select가 자기 파일의 가드 주석이 금지한 pointer-events:none을 10줄 아래에서 그대로 선언한다 — `src/styles/event/command-forms/forms-5.css`
- [EE-16-12] (low) 들여쓰기 정준이 18px/28px 두 벌로 남아 있고 주석이 서로 다른 계약을 말한다 — `src/styles/event/command-list.css`
- [EE-16-13] (low) 선택 상태 문법이 뷰마다 다르고 스토리 보기에는 죽은 is-selected 규칙이 남는다 — `src/styles/event/command-list-3.css`
- [EE-16-14] (low) 층( z-index ) 문서가 거짓말을 한다 — '도움말 290 > 에디터 120' 주석과 실제 값(백드롭 1000, --z-modal-overlay 2200), 하드 z-index 잔존 — `src/styles/event/shell.css`
- [EE-16-15] (low) 위키가 가리키는 이벤트 에디터 CSS 경로가 실제로는 존재하지 않는다(재편성 이후 미갱신) — `openwiki/delayed-tooltip.md`

### 5.17 EE-17 — 이벤트 대량 저작 성능·렌더

**[EE-17-1] (high) 스토어 변경 1건마다 이벤트 편집기 본문과 명령 목록이 통째로 재구축되고 프로젝트 전체가 structuredClone 된다**
`src/editor/panels/eventEditor/commandList.ts` · 최종 high · 확인 · 확신 high
위치·증거: (1) src/editor/panels/eventEditor/commandList.ts:54 `clearChildren(host)` 후 :77-86 `commands.forEach(... renderCommandTree ...)` — 목록 전체를 매번 폐기·재구축. (2) src/editor/panels/eventEditor/modal.ts:371-382 `store.subscribe(... refresh())` — 스토어 변경 '무엇이든' 본문 전체 재렌더, :341-351 `renderEventEditorDynamic(staged)` 후 `clearChildren(dynamicBody)`. (3) src/project/store.ts:785-799 `update()` — :787 `const draft: Project = structuredClone(this.current)` (프로젝트 전체 클론) + :789-793 정규화 5종(assertCanonicalReplacement, ensureProjectMapConnections, ensureMapTreeCoversAllMaps, ensureSwitchVariableSlots, removeLegacySpriteReferences) 전부 실행. (4) src/editor/eventPages.ts:376-394 replaceEventPageCommandAt가 이 광역 update()를 쓴다. 영향: 명령 수백 개 이벤트에서 설정 레일 필드 하나 고치기·명령 하나 옮기기마다 O(프로젝트) 클론+정규화 + O(행 수) DOM 재구축(아래 EE-17-2의 행당 리스너 10개 포함)이 매번 실행된다. …

**[EE-17-3] (high) 인스펙터 타이핑이 타자마다 동기 전체 재렌더+폼 재빌드를 일으켜 한글 IME 조합이 깨진다**
`src/editor/panels/eventEditor/commandBodyCore.ts` · 최종 high · 확인 · 확신 high
위치·증거: (1) src/editor/panels/eventEditor/commandBodyCore.ts:207-210 `speaker.addEventListener("input", apply); body.addEventListener("change", apply); body.addEventListener("input", apply);` — apply(:199-206)는 타자마다 `context.actions.replaceCommand(context.path, readDraft())`(:205)를 호출하고 isComposing 검사가 없다. (2) 인스펙터의 replaceCommand는 store를 바로 친다(content.ts:869 → eventPages.ts:376-394 → store.update 즉시 emit). (3) modal.ts:331-351 전체 재렌더 후 commandList.ts:204-208 `if (sameInspectorPath(path, selectedCommandPath())) { ... showCommandInspector(..., preserveSelection: true) }` — 렌더 도중 인스펙터 폼을 commandInspector.ts:275 `host.replaceChildren(head, ...)` 로 통째로 재빌드한다. (4) modal.ts:1054-1087 restoreEventEditorInteraction이 focus()+setSelectionRange만 복원한다 — 입력 요소 자체가 교체됐으므로 IME 조합(compile/preedit) 세션은 복원 불가능하다. …

**[EE-17-2] (medium) 수백 개 명령 목록에 가상화가 없다 — 행마다 리스너 10개씩 전부 마운트된다**
`src/editor/panels/eventEditor/commandList.ts` · 최종 medium · 확인 · 확신 high
위치·증거: src/editor/panels/eventEditor/commandList.ts:110-236 renderCommandItem이 행마다 dataset 6종(:124-130, JSON.stringify(path) 포함) + head 리스너 4종(:200 click, :210 contextmenu, :215 dblclick, :224 keydown) + commandListDragDrop.ts:10-32 enableItemDrag(pointerdown·dragstart·dragend) + :34-70 attachItemDropHandlers(dragover·dragleave·drop) = 행당 10개 리스너, 분기 마커 줄에도 ensureListDropHandlers 2종(commandListDragDrop.ts:75-89). 300개 명령이면 렌더 1패스에 요소 수백 개+리스너 약 3천 개가 새로 만들어지고, EE-17-1 체인 때문에 타이핑마다 반복된다. 반면 하우스 패턴은 이미 있다: src/editor/panels/databaseListVirtualizer.ts:10 `VIRTUALIZATION_THRESHOLD = 80`, :29-47 computeRowWindow — 데이터베이스 목록은 80 초과 시 윈도잉하는데 명령 목록은 임계 자체가 없다. 수정 제안: 명령 행은 참조 동일성(cmd 객체 + depth) 기준으로 DOM 노드를 재사용하거나, 최상위 레벨이라도 windowing을 적용한다(행 높이 가변이므로 createVirtualList의 고정 행 높이를 그대로 쓸 수는 없음 — 실측 높이 캐시를 얹는 형태). 최소한 리스너는 행 위임(delegation: cmdList에 1회 바인딩, data-cmd-path로 타깃 판정)으로 모을 수 있다.

**[EE-17-4] (medium) 명령 편집 1타자마다 되돌리기 스텝이 쌓여 50자 넘은 타이핑의 초반은 복원할 수 없다**
`src/editor/panels/eventEditor/commandToolbarHistory.ts` · 최종 medium · 확인 · 확신 high
위치·증거: src/editor/panels/eventEditor/commandToolbarHistory.ts:87-89 `replaceCommand: (path, command) => { change(() => actions.replaceCommand(path, command), false); }` — 인스펙터 타이핑의 매 input 이벤트가 change()를 탄다. recordCommandToolbarChange(:125-150)는 :130 `const before = cloneCommands(readCommands())` (페이지 명령 트리 전체 structuredClone) → :135 `entry.past.push(before)` (타자 단위 스텝, coalesce 없음) → :141 `if (JSON.stringify(before) === JSON.stringify(readCommands()))` 페이지 전체 문자열화 2회 → :145 `if (entry.past.length > HISTORY_LIMIT) entry.past.shift()` (:35 `const HISTORY_LIMIT = 50`). 영향: 문장 하나(예: 80자)를 인스펙터에서 타이핑하면 초기 30자분의 스텝이 밀려나 버려 Ctrl+Z로 처음 상태에 도달할 수 없고, 복원도 글자 단위로 50번 걸어야 한다. 타자마다 추가로 페이지 클론 1회+JSON.stringify 2회+authoredCommandPaths 2회 문자열화(:146)가 프로젝트 클론(EE-17-1) 위에 얹힌다. …

**[EE-17-5] (medium) 장소 이동 행의 맵 썸네일이 매 렌더마다 전체 맵을 다시 그린다(캐시 없음)**
`src/editor/panels/eventEditor/commandList.ts` · 최종 medium · 확인 · 확신 high
위치·증거: src/editor/panels/eventEditor/commandList.ts:348-373 renderMapThumb16 — 렌더마다 `document.createElement("canvas")`(:352)를 새로 만들고 `drawTransferMapPreview(...)`(:359-364, zoom = 16/(map.height*map.tileSize))를 발사한다. drawTransferMapPreview(src/editor/panels/eventEditor/transferMapPreview.ts:38-55)는 canvas가 ~16px 높이로 잘려 있어도 `drawLayer(context, image, map, tileset, map.lowerTiles)`(:49)·`drawStack(... "lower")`(:50)·upper 동일(:51-52) — drawLayer(:94-119)는 맵 전체 타일을 순회하며 타일마다 drawImage+칩셋 쿼터 조합 판정을 하고, drawStack(:123-127)은 width×height 전 칸을 순회한다. 결과 캐시는 없고(타일셋 이미지 로드만 캐시됨 — src/editor/mapTileDraw.ts:20,166-191), 장소 이동 명령 요약은 commandSummary.ts:168-176 mapThumbParts(:444-447)로 행마다 이 경로를 탄다. fallback도 커넥션 검사 없다: commandList.ts:365-371 `.catch(() => { drawTransferFallback(...) })` — isCurrent 체크(transferMapPreview.ts:43)는 이미지 로드 후 1회뿐이고 fallback은 떼어진 canvas에 그린다. …

**[EE-17-6] (medium) 편집 대화상자에서 날씨·그림·조명·동영상 명령의 연출이 본문 스테이지+우측 프리뷰로 두 벌 렌더된다**
`src/editor/panels/eventEditor/commandEditDialog.ts` · 최종 medium · 확인 · 확신 high
위치·증거: 인스펙터는 본문이 자기 프리뷰를 소유하면 우측 프리뷰를 접는 계약이 있다 — commandInspector.ts:32-35 `BODY_OWNED_PREVIEW_SELECTOR = ['[data-testid="event-command-text-live-preview"]', ".page3-preview-stage", ...]`. 그러나 편집 대화상자는 코드로 showAnimation 하나만 막는다: commandEditDialog.ts:51 `const ownsPreview = stagedCommand.kind === "showAnimation";` (:59-61 `if (ownsPreview) return;`). 그 외 setWeather(showPicture 등 page3 본문)는 우측 `renderPreview()`가 renderCommandPreview를 붙인다(:61), commandPreview.ts:144-149 `setLighting/addLight/removeLight/setWeather/showAnimation/playMovie` 전부 시각 스테이지 렌더러다(summary-only 아님). 본문 쪽 스테이지는 commandBodyPage3Native.ts:575-578(setWeather, testid set-weather-preview-stage), :1167-1170(show-picture-preview-stage), :142-145/:350-353(lighting), playMoviePreview.ts:91-95에서 실재 렌더된다. …

저심각도 일괄:
- [EE-17-10] (low) 이벤트 편집기 아이콘 전용 컨트롤이 지연 툴팁 롤아웃 목록에 한 건도 없다 — `src/editor/delayedTooltipRollout.ts`
- [EE-17-7] (low) 빈 목록 안내 제거 코드가 터미널 명령 행의 편집 힌트를 지워 버린다 — `src/editor/panels/eventEditor/content.ts`
- [EE-17-8] (low) div 로 전환된 조건·움직임 접이식에 닫힌 화살표와 포인터 커서가 남아 눌러도 아무 동작 없다 — `src/editor/panels/eventEditor/content.ts`
- [EE-17-9] (low) 페이지 탭을 드는 중 명령 행에 가짜 삽입 마커가 나타난다 — `src/editor/panels/eventEditor/commandListDragDrop.ts`

### 5.18 EE-18 — 접근성·키보드·포커스

**[EE-18-1] (high) 등장 조건 모달이 aria-modal 다이얼로그인데 포커스 트랩이 없고, 첫 포커스가 「닫기 ×」이며, 닫은 뒤 포커스가 유실된다**
`src/editor/panels/eventEditor/pageProps.ts` · 최종 high · 확인 · 확신 high
위치/증거: pageProps.ts:1148-1207 openConditionsModal. 1156-1159 `role: "dialog", "aria-modal": "true"` 창을 만들고 1205 `registerModal(backdrop, close)` 로 Esc 계층만 참여시킨다. 그러나 (1) 파일 어디에도 Tab 포커스 트랩이 없다(modal.ts:929 installFocusTrap, subdialog.ts:72-90 trapFocus 와 달리, registerModal grep 에서 pageProps 는 1161/1205 두 줄뿐) — aria-modal=true 를 걸어 놓고 Tab 은 뒤에 깔린 이벤트 편집기 본문으로 그대로 걸어 나간다. (2) 1206 `closeButton.focus();` — 열자마자 헤더의 「× 조건 설정 닫기」(1164-1169, text "×")로 포커스. 이 모달은 레일 헤더 버튼(railGroup, pageProps.ts:1108-1144)의 Enter 로 열리므로 키보드 사용자가 정확히 겪는 경로다. subdialog.ts:118-122 의 수정 코멘트가 말하는 2026-09-17 리뷰 P1-10 반패턴(「예전엔 창 전체에서 첫 컨트롤을 잡아 헤더의 닫기 ×에 갔다… Enter 는 창을 닫았다」)을 그대로 반복한다. (3) close(1160-1163)는 `unregisterModal(backdrop); backdrop.remove();` 뿐 — 포커스 복귀 처리가 없어 × 버튼이 DOM 에서 사라지는 순간 포커스가 body 로 떨어진다. 영향: 키보드 사용자는 조건 모달을 벗어나 뒷면 편집기로 Tab 이 새고, 열자마자 Enter 로 창을 닫게 되고, 닫고 나면 포커스를 잃는다. …

**[EE-18-2] (medium) focusFirstDialogControl 의 셀렉터 우선순위가 querySelector 문서 순서 의미론 때문에 전부 죽은 코드 — 이벤트 편집기 열림/복원 포커스가 항상 헤더 이름 필드로 간다**
`src/editor/panels/eventEditor/modal.ts` · 최종 medium · 확인 · 확신 high
위치/증거: modal.ts:954-963 `root.querySelector(".event-editor-modal-body input:not(:disabled), …, button:not(:disabled), input:not(:disabled), …")`. querySelector 의 콤마 목록은 셀렉터 나열 순서가 아니라 문서 순서로 첫 일치를 돌려준다. windowEl.append(header, body, footer, resizeHandle)(modal.ts:299)이고 헤더 첫 자식이 이벤트 이름 input(516-537, class "event-name", disabled 아님)이므로, `.event-editor-modal-body …` 우선 순서는 항상 죽은 코드고 실제로는 매번 헤더의 이름 바꾸기 필드에 포커스가 간다(447 열림 시, 199 최소화 복원 폴백에서도 동일). 같은 기능의 고쳐진 형제 구현 subdialog.ts:118-131 은 「본문의 첫 입력 — 글자 상자·선택기가 있으면 거기」라고 2026-09-17 리뷰 P1-10 수정 코멘트와 함께 aria-hidden·tabindex 필터를 두고 있다. modal.ts 버전에는 aria-hidden/tabindex=-1 필터가 없어 (헤더 이름 input 이 문서 순서상 늘 먼저라 지금은 터지지 않지만) aria-hidden 네이티브 select(customSelect.ts:409-410 이 숨기는 원본)를 집어갈 잠재 결함도 남는다. 영향: 편집기를 열거나 최소화 복원할 때 페이지 본문 첫 필드가 아니라 이름 바꾸기 필드로 떨어진다 — 본문 우선이라는 코드의 선언된 의도와 동작이 어긋난다. …

**[EE-18-3] (medium) 도움말 모달도 aria-modal=true 인데 Tab 트랩이 없고, 닫은 뒤 포커스를 돌려주지 않는다**
`src/editor/panels/eventEditor/eventEditorHelp.ts` · 최종 medium · 확인 · 확신 high
위치/증거: eventEditorHelp.ts:353-468. 384 `role: "dialog", "aria-modal": "true"`, 460 `registerModal(backdrop, () => close())` — Esc 계층만 있다. Tab 트랩은 없어(파일 내 trap/installFocusTrap 부재) Tab 이 도움말 뒤 이벤트 편집기로 나간다. 467 `closeAction.focus();` — 첫 포커스가 푸터 「닫기」 버튼(362-368)이고, 453-459 close() 는 `unregisterModal; observer.disconnect; backdrop.remove();` 뿐이라 닫힌 뒤 포커스 복귀가 없다(닫기 버튼이 사라지며 body 로 낙하). 같은 디렉터리의 모든 다이얼로그(subdialog.ts:72-90, modal.ts:929-953, eventAiModal.ts:29-40)가 트랩을 두는 것과 계약이 어긋난다. 영향: 도움말을 키보드로 열면 Tab/Shift+Tab 이 뒷면 편집기(뒤에 가려진 화면)로 이동하고, 닫고 나면 포커스를 잃어 Tab 이 문서 처음부터 다시 시작된다. 수정 제안: openEventSubdialog 기반으로 바꾸거나 trapFocus+returnFocus 를 추가하고, 첫 포커스는 본문 목차 첫 항목(416-429)으로 옮겨라.

**[EE-18-4] (medium) 명령 피커의 키보드 후보(↑↓ 하이라이트)가 보조기술에 전혀 노출되지 않는다 — 일반 input 에 aria-activedescendant 를 걸고 옵션에는 role/aria-selected 가 없다**
`src/editor/panels/eventEditor/commandPicker.ts` · 최종 medium · 확인 · 확신 high
위치/증거: commandPicker.ts:463-475 highlightCommand — `button.classList.add("keyboard-active")`(시각 CSS 뿐) 후 469-473 `const targetId = …; target.setAttribute("id", targetId); … search?.setAttribute("aria-activedescendant", targetId);`. 그러나 그 search 는 334-338의 `attrs: { type: "search", placeholder: …, "aria-label": "명령 검색" }` 뿐인 일반 input — role=combobox/aria-expanded/aria-controls 도, 목록 쪽 listbox/option 역할도 없다(commandArea 는 326-333 role="tabpanel", 명령 버튼은 652-668에서 role 속성 자체가 없음). ARIA 상 aria-activedescendant 는 combobox/listbox 등 소유 역할에서만 유효하므로 보조기술은 이 속성을 무시하고, ↑↓로 옮겨진 키보드 후보는 화면 색으로만 존재한다(Enter 삽입은 382-387 target.click() 으로 동작하지만 SR 사용자는 무엇이 후보인지 듣지 못한 채 삽입한다). 같은 저장소의 올바른 선례: customSelect.ts:108 트리거에 aria-activedescendant + 179-181 role=option 부여.  …

**[EE-18-5] (medium) 서브다이얼로그 배경 클릭 닫힘이 드래그-릴리스 유령 클릭에 무방비 — 명령 편집 중 창 밖으로 드래그해 놓으면 편집 내용이 통째로 버려진다**
`src/editor/panels/eventEditor/subdialog.ts` · 최종 medium · 확인 · 확신 high
위치/증거: subdialog.ts:69-71 `backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });` — click 만 본다. main modal 은 같은 유령 클릭류를 pointerdown 추적으로 막았다: modal.ts:305-313(「pointerdown 이 캔버스에서 나고… click 이 requestClose 를 호출해 편집기가 즉시 닫힌다」 + backdropPointerStarted 게이트). subdialog 에는 이 게이트가 없어, 명령 편집 창 안에서 mousedown(예: textarea 텍스트 선택, 슬라이더 드래그) 후 창 바깥 배경 위에서 mouseup 하면 click 이 공통 조상인 배경에 떨어져 close() 가 실행된다 — 확인 없이 취소 semantics 로 닫히며 stagedCommand(commandEditDialog.ts:31 클로저)가 통째로 버려진다. 모든 명령 편집/레코드 피커/이동 경로 dialog 가 openEventSubdialog(subdialog.ts:15)을 쓴다. 수정 제안: modal.ts:305-313 과 같이 pointerdown 시작점이 배경일 때만 닫도록 게이트를 두거나, mousedown/target 검사로 교체하라.

**[EE-18-6] (medium) 서브다이얼로그 포커스 트랩의 포커스 가능 목록이 닫힌 <details> 안의 보이지 않는 컨트롤을 포함해, Shift+Tab 시 포커스가 접힌 섹션 속으로 사라질 수 있다**
`src/editor/panels/eventEditor/subdialog.ts` · 최종 medium · 확인 · 확신 medium
위치/증거: subdialog.ts:133-149 focusableControls — 제외 조건이 `child.hidden || aria-hidden=true || .is-hidden`(138)과 `getComputedStyle(child).display === "none"`(139) 뿐이라, 닫힌 <details> 안의 컨트롤은 그대로 트랩의 Tab 링에 들어간다(현대 크롬은 닫힌 details 본문을 display:none 이 아니라 content-visibility 로 숨겨 display 값이 그대로 온다). 실제로 서브다이얼로그 본문에는 닫힘 기본 details 가 있다: commandBodyCore.ts:231-234 `el("details", { class: "event-command-text-advanced" … })`(문장 명령 「고급」), commandBodyRoute.ts:371-374 move-route-parameters-details, npcGraphicPicker.ts:139-142 고급 입력. 포커스는 trapFocus(72-87)가 `last.focus()`(83-86)로 프로그래밍적으로 밀어 넣으므로, 마지막 컨트롤에서 Tab/첫 컨트롤에서 Shift+Tab 시 닫힌 섹션 안으로 포커스가 사라진다. 코드베이스 자신이 이 메커니즘을 명시한다: pageProps.ts:1224-1227 「닫힌 그룹 속 입력에 포커스를 주면 사용자 눈에는 아무 일도 안 일어나는 것으로 보인다」(모지바케 줄, 경로/식별자 기준 해석), validationBell.ts:151-153 은 포커스 전에 조상 details를 open=true 로 열어 회피한다. modal.ts 트랩(936)은 offsetParent 필터로 이를 우회한다 — 두 트랩의 필터가 불일치한다. …

**[EE-18-7] (medium) 등장 조건 모달이 레일 그룹의 실제 DOM body 를 이동시켜 가지고 가고, 닫으면 「언제 보이나요」 그룹이 요약(조건 N개)과 달리 빈 채로 남는다**
`src/editor/panels/eventEditor/pageProps.ts` · 최종 medium · 확인 · 확신 high
위치/증거: railGroup 헤더 클릭(pageProps.ts:1138-1142 `if (spec.slug === "when") { openConditionsModal(body); return; }`)에서 openConditionsModal(1148)은 1181 `el("div", { class: "event-condition-modal-body", children: [body] })` 로 레일 그룹의 body 노드를 모달로 이동(append는 이동)시키고, close(1160-1163)는 `unregisterModal; backdrop.remove();` 뿐이라 body 는 배경과 함께 문서에서 떨어진다. 레일은 modal.ts:341-345 stableRendered 플래그로 세션당 한 번만 그려지고(openEventEditorStable→wrapPageSettingsAsAccordion pageProps.ts:1060/1253), 조건 모달을 닫는 행위 자체는 store 갱신을 일으키지 않아 재렌더가 없다. 결과: 조건이 있던 페이지에서 모달을 열었다 닫으면 「언제 보이나요」 그룹(pageProps.ts:1273, summary `조건 ${conditions.length}개`)은 헤더만 남고 본문이 빈 채로 보인다 — summary 가 말하는 조건 N개와 화면이 어긋나며, 내용은 모달을 다시 열어야만 볼 수 있다. 수정 제안: close 시 body 를 원래 그룹으로 되돌려 넣거나(이동 대신 공유 표시), 모달 본문을 복제/재렌더 기반으로 구성하라.

**[EE-18-10] (low) role 없는 span/div 에 aria-label 을 붙여 접근 이름 계약이 무효인 곳이 여럿이다**
`src/editor/panels/eventEditor/commandList.ts` · 최종 low · 보류 · 확신 medium
위치/증거: (1) commandList.ts:257-262 검사 이슈 배지 `el("span", … attrs: { title: …, "aria-label": "검사 문제 N개" })` — span(role=generic)의 aria-label·title 은 이름 계산에서 무시되어 SR 은 아이콘 뒤 숫자 "N" 만 듣는다. (2) commandBodyM2.ts:757-759 `el("div", { class: "m2-resource-audio-note", attrs: { "aria-label": "오디오 리소스 선택" } })`, 773-775 `.m2-resource-preview` aria-label — role 없는 div라 동일하게 무효. (3) content.ts:287-288 commandCount `el("span", …)`에 `setAttribute("aria-label", "작성한 명령 N개, 분기 안 명령 포함")` — 마찬가지로 generic 에선 이름 속성이 적용되지 않는다. 이 코드베이스의 올바른 선례는 이름이 필요한 비대화형 컨테이너에 role을 부여하는 것이다(facesetPreview.ts:145-148 role="img", eventScriptModernViews.ts:69-73 role="region"). 수정 제안: 배지에는 role="status"(또는 부모에 포함), 미리보기 div 에는 role="img"/"region" 등 알맞은 role 을 부여하고 aria-label 을 유지하라.
> 보류 사유: 세 위치 모두 role 없는 span/div에 aria-label만 붙어 있음은 실측됐다(commandList 257-262, commandBodyM2 756-758/772-774, content 287-288). 다만 'SR이 무효로 취급한다'는 브라우저·SR에 따라 갈리고(Chrome은 generic에도 aria-label을 노출하는 경우가 있음) 정확히는 HTML-AAM상 generic에 aria-label 금지 계약 위반이며, 배지는 텍스트 N을 이미 닫고 있어 피해가 과장됐다 — partial로 조정.

저심각도 일괄:
- [EE-18-11] (low) 전체 보기 Escape 분기가 죽은 코드다 — modalStack 캡처가 Escape 를 먼저 삼켜 도달하지 않는다 — `src/editor/panels/eventEditor/modalFullscreen.ts`
- [EE-18-12] (low) 이동 대상 픽커 combobox의 화살표 하이라이트가 보조기술에 발표되지 않고, aria-selected 를 하이라이트 마커로 오용한다 — `src/editor/panels/eventEditor/moveRouteTargetPicker.ts`
- [EE-18-13] (low) 피커 검색 결과 수 안내가 라이브 영역이 아니어서 결과 개수 변화가 발표되지 않는다(목록 쪽 동일 기능과 불일치) — `src/editor/panels/eventEditor/commandPicker.ts`
- [EE-18-8] (low) 창 크기 조절 핸들(role=separator)에 aria-value* 가 없어 키보드 조작 결과가 보조기술에 읽히지 않는다 — `src/editor/panels/eventEditor/modalResize.ts`
- [EE-18-9] (low) 페이지 이동 경로 썸네일 버튼의 접근 이름이 hover 전용 title 하나뿐이다 — `src/editor/panels/eventEditor/pageMovement.ts`

### 5.19 EE-19 — 한국어 카피·용어 정본 준수

**[EE-19-1] (high) 게이트 밖 이동 계열 표면이 금지 토큰 ON/OFF를 그대로 노출 (위키 보정 미반영)**
`src/editor/panels/eventEditor/moveRouteCommandCatalog.ts` · 최종 high · 확인 · 확신 high
위키 계약(openwiki/editor-event-authoring.md:794-799 «ON/OFF…는 사용자에게 보이면 안 된다. 통일 어휘는 켜짐/꺼짐», 게이트 test/conditionCopyTokens.test.ts:14-15)이 게이트 대상 4파일(commandSummary/conditionForm/pageConditionSentence/pageProps — 전부 켜짐/꺼짐 구현 확인, commandSummary.ts:421-423)에만 반영되고 게이트 밖 이동 계열 표면에 잔존한다. 증거: ① moveRouteCommandCatalog.ts:114 버튼 라벨 `contextCommandButton("스위치 ON...", …)` ② moveRouteCommandCatalog.ts:339-341 `function onOff(value){ return value ? "ON" : "OFF" }` → :245 `방향 고정 ${onOff(...)}`·:247 `통과 ${onOff(...)}`·:249 `애니메이션 ${onOff(...)}`·:253 `스위치 ${command.switchId} ${onOff(command.value)}` — 이 라벨은 commandBodyRoute.ts:231·244, moveRouteDialog.ts:325 에서 그대로 렌더된다 ③ pageMovement.ts:222-224 동일 onOff → :185·:187·:189·:193, 사용처 :129 `moves.map(moveLabel).join(" -> ")`이며 :125 주석 스스로 «「방향 고정 ON」 같은 비이동 명령»이라며 ON 노출을 저작 계약(e2e) 텍스트로 박아 둠 ④ previewMoveRoute.ts:290 `스위치 ${move.value ? "ON" : "OFF"}` + :337 …

**[EE-19-2] (high) 명령 요약 정본 commandSummary가 원시 변수 ID를 문구로 노출 (「주인공 위치 얻기」)**
`src/editor/panels/eventEditor/commandSummary.ts` · 최종 high · 확인 · 확신 high
commandSummary.ts:765-767 `commandLine(labelOf("주인공 위치 얻기"), plainPart("→ "), valuePart(variableId ? `변수 ${variableId}` : "(변수 미지정)"))` — 명령 목록(정본 요약 표면)에 변수의 이름이 아니라 var_ 형태 원시 ID가 그대로 찍힌다. 위키는 «문장·배지·탭 요약·명령 요약이 전부 대상»(editor-event-authoring.md:797-798)이라 명시하고, 같은 파일의 조건 요약은 이미 이름 해석기를 쓴다(:1107 `recordName("switch", condition.switchId)`). 동일 명령의 본문 미리보기도 해석한다(commandBodyM2Page3.ts:198 `주인공 위치 → 변수 ${variableLabel(variableId)}`). 영향: 저작자가 명령 목록에서 «변수 var_8f3k2»를 보고 어떤 변수인지 알 수 없음 — 원시 ID 노출은 2026-09-03 제안서 §6가 «원시 ID 만 보이던 결함»으로 규정한 계열. 수정: :767을 recordName(또는 switchVariableName) 기반 이름 해석으로 교체하고, 미지정 폴백 "(변수 미지정)"은 유지. 게이트 테스트에 `/(^|\s)(var|sw|ev)_[0-9a-f]/` 패턴 검사 추가 권장.

**[EE-19-10] (medium) 메시지 창 설정이 「윈도우」와 「창」을 같은 폼에서 섞어 쓴다**
`src/editor/panels/eventEditor/commandBodyCore.ts` · 최종 medium · 확인 · 확신 high
commandBodyCore.ts:784 `settingsGroup("윈도우 표시 형식", …)`, :791 `settingsGroup("윈도우 위치", …)`(aria-label도 :760 «윈도우 표시 형식»·:766 «윈도우 위치») — 같은 폼의 힌트는 :788 «일반은 창 스킨 배경…», :803 «가림 방지는 플레이어와 겹치면 창 위치를 자동 조정합니다…»(윈도우 위치 설정 그룹의 힌트가 「창 위치」), :578 «대사 창 위에 크게 세웁니다». 또 commandBodyPage3Native.ts:788 «대사창을 열지 않고»(띄어쓰기 없음) vs commandBodyCore.ts:578 「대사 창」(띄어쓰기 있음). 영향: 하나의 설정 폼 안에서 같은 창이 「윈도우」와 「창」 두 이름으로 불려 초보가 윈도우/게임 창(320×240, :284)을 구분하기 어려움. 수정: 사용자 문구는 「창」으로 통일(그룹 제목 「창 표시 형식」/「창 위치」), testid·클래스명은 그대로 두고 라벨만 교체. 띄어쓰기도 통일.

**[EE-19-11] (medium) 사용자 툴팁에 내부 토큰 「fork」 노출**
`src/editor/panels/eventEditor/commandBodyShop.ts` · 최종 medium · 확인 · 확신 high
commandBodyShop.ts:141 `serviceSel.title = "축제·행상은 이벤트 조건(fork)으로 감싸세요 — 이 상점이 닫혔을 때 보이지 않게 됩니다."` — 툴팁(사용자 가시)에 조건 분기의 내부 구현명 fork가 노출된다. 위키는 «조건 문구에 내부 토큰을 넣지 마라»(editor-event-authoring.md:792-799)로 이 계열을 금지하며, fork의 사용자 어휘는 「분기」다(previewForkFlow.ts:24 «조건이 맞을 때 분기 실행», commandBodyCore.ts:909 «그 외 분기 삭제», commandBodyShop.ts:98 스스로 «분기 안의 행동은…»이라 씀). 영향: 같은 개념이 같은 폼에서 fork/분기 두 이름으로 불림. 수정: «…이벤트 조건 분기로 감싸세요…»로 교체하고 fork 표기는 코드 식별자로만 남긴다.

**[EE-19-12] (medium) 동료 추가/제거 명령 힌트가 JSON 필드명(actorId·graphic·all=true)을 그대로 보여준다**
`src/editor/panels/eventEditor/commandBody.ts` · 최종 medium · 확인 · 확신 high
commandBody.ts:57-60 — `case "addFollower": return terminalHint("add-follower-editor", "동료를 세션에 추가합니다. actorId 또는 graphic을 사용합니다.")`, `case "removeFollower": return terminalHint("remove-follower-editor", "동료를 이름으로 제거하거나 all=true로 모두 제거합니다.")`. 이 힌트는 명령 본문 편집기에 그대로 렌더되는 문구인데, 저작자가 UI에서 만질 수 없는 JSON 스키마 필드명(actorId, graphic, all=true)을 그대로 안내한다. 위키가 문장·배지·요약을 내부 토큰 금지 대상으로 지정(editor-event-authoring.md:792-799)하고, task 특별 지시(필드명 노출)에 정확히 해당. 영향: 필드가 없는 단말 명령의 유일한 설명이 개발자 용어라 초보 저작자에게 무의미. 수정: «동료를 세션에 추가합니다. 대상 동료의 그래픽이나 프로필을 지정할 수 없습니다 — 이 명령은 설정 없이 실행됩니다» 식의 행위 중심 문구로 교체.

**[EE-19-13] (medium) 「주인공 위치 얻기」 안내가 단일 변수 피커와 모순되는 의사 토큰(변수_map/변수_x/변수_y)을 노출**
`src/editor/panels/eventEditor/commandBodyM2Page3.ts` · 최종 medium · 확인 · 확신 high
commandBodyM2Page3.ts:198-199 — 미리보기 윗줄은 고른 변수를 이름으로 해석해 보이는데(`line(\`주인공 위치 → 변수 ${variableLabel(variableId)}\`)`) 바로 아랫줄 note가 `note("맵/X/Y를 각각 변수_map / 변수_x / 변수_y 에 기록합니다.")`로 실제 존재하지도 않는 의사 식별자 3개를 노출한다. 위 필드는 단일 「저장 변수」 피커 하나뿐이다(:178-186, :211 fieldBlock("저장 변수", …)) — «각각» 어느 변수에 무엇이 기록되는지 실제 선택값과 연결되지 않아, 저작자가 변수_map/변수_x/변수_y라는 이름의 변수를 만들어야 한다고 오해한다. 위키의 «내부 토큰을 사용자에게 보이면 안 된다» 원칙(조건 문구뿐 아니라 정신적 계약)에도 어긋난다. 영향: 명령의 저장 규약(맵·X·Y 3슬롯)이 사용자 선택값과 어떻게 대응되는지 설명이 아니라 오해를 만든다. 수정: 고른 변수 이름 기준으로 «${name}에 맵 ID를, 그 다음 두 칸에 X·Y 좌표를 기록합니다» 식으로 실제 참조를 말하거나, 맵/X/Y 각각의 피커를 노출해 문구와 데이터 구조를 일치시킨다.

**[EE-19-14] (medium) 탐험 기억(run flag)이 「탐험 기억/플래그/기억」 3중 호칭 + 영문 시드값 flag1 노출**
`src/editor/panels/eventEditor/conditionForm.ts` · 최종 medium · 확인 · 확신 high
① 기본값 시드: conditionForm.ts:437 `case "flag": onChange({ kind: "run", query: "flag", flag: "flag1", value: true })`, commandBodyAdvanced.ts:220 `flag: "flag1"`, commandBodyCore.ts:840 `flag: flag.value.trim() || "flag1"` — 이 flag1은 그대로 사용자 문장에 나른다(pageConditionSentence.ts:140-142 «탐험 기억 「flag1」 켜짐»). 위키가 금지 토큰으로 지정한 timer1/timer2(authoring.md:794)와 같은 계열의 영문 서수 토큰이 기본 시드로 노출된다. ② 3중 호칭: 같은 개념이 select 라벨 「탐험 기억」(commandBodyAdvanced.ts:213, conditionForm.ts:429) vs 필드 라벨 「플래그/플래그 이름」(commandBodyAdvanced.ts:281·291, conditionForm.ts:472·480)로, 그리고 빈값 폴백이 «기억»(commandSummary.ts:1171, pageProps.ts:1472) vs «플래그»(commandPreview.ts:161) vs «(없음)»(conditionEvalPreview.ts:225, pageConditionSentence.ts:141)로 갈라진다. 영향: 저작자가 같은 필드를 폼에서는 플래그, 문장에서는 탐험 기억으로 읽게 되고, 빈값일 때 표면마다 다른 대체어가 뜬다. 수정: 통일 어휘 「탐험 기억」으로 라벨을 맞추고 시드값은 비워 둔 뒤 문구 폴백 «(없음)»으로 통일(게이트 테스트에 flag 서수 토큰 패턴 추가).

**[EE-19-15] (medium) uiCopy 밀도 축(technical)이 무도달 코드가 됐는데 위키·주석은 살아있는 축으로 서술 — editorUiMode 주석은 폐기 용어로 재차 어긋남**
`src/editor/editorUiMode.ts` · 최종 medium · 확인 · 확신 high
editorUiMode.ts:65(BEGINNER_CHROME)·:85(STANDARD_CHROME)·:104(EXPERT_CHROME) 모두 `jargonStyle: "plain"` — getEditorChrome().jargonStyle 을 경유하는 모든 호출(menu.ts:757 headerLabel, commandRegistry.ts:156, databaseModal.ts:673, workspaceBar.ts:72, aiAgentBrief.ts:33)은 항상 plain을 받으므로 uiCopy.ts:35-40의 technical 값(데이터베이스/DB/리소스 보관함/리소스/타일 그림판이 없습니다)은 어떤 모드에서도 도달 불가능하다. 그런데 uiCopy.ts:2-3과 위키(pre-edit-routing L603-612 용어표가 plain/technical 두 열을 모드별 값으로 서술, L596 «headerLabel(key) 가 현재 모드의 jargonStyle 로 그 표를 읽는»)은 이 축이 살아 있는 계약으로 문서화한다 — 문서와 코드의 계약 어긋남이며 AI/신규 유지보수자가 expert 모드에서 「데이터베이스」를 기대하게 만든다. 덧붙여 대조 파일 자체의 주석이 폐기 용어를 재확산 위험으로 광고한다: editorUiMode.ts:29 «plain: 바닥/장식, technical: 하위/상위», :44 «plain: 자료집/바닥/장식, technical: 데이터베이스/하위/상위» — uiCopy.ts:32-33이 2026-09-19에 명시 폐기한 레이어 이름 「덧그림」 계열 표기 「장식」·「하위」를 여전히 용어 예로 든다. …

**[EE-19-3] (medium) 이동 명령 요약 라벨이 스위치·그래픽·맵·효과음의 날 ID를 이름 해석 없이 노출**
`src/editor/panels/eventEditor/moveRouteCommandCatalog.ts` · 최종 medium · 확인 · 확신 high
moveRouteCommandCatalog.ts:253 `스위치 ${command.switchId} ${onOff(...)}`·:259 `그래픽 ${command.spriteId}`·:261 `NPC 맵 이동 ${command.mapId} (...)`·:263 `효과음 ${command.resourceId}`, 그리고 사실상 동일 복사본인 pageMovement.ts:193( switchId)·:199(spriteId)·:201(mapId)·:203(resourceId). 이 라벨들은 이동 경로 다이얼로그 목록(commandBodyRoute.ts:231·244, moveRouteDialog.ts:325)과 페이지 이동 요약(pageMovement.ts:129)에 그대로 렌더된다. commandBodyRoute.ts:60 주석이 «입력한 ID 가 어느 이벤트인지 이름으로 되읽어 준다 — 원시 ID 만 보이던 결함(2026-09-03 제안서 §6)»이라고 고친 표면(대상 이벤트 힌트)과 대비되며, 2026-07-07 이벤트 에디터 리뷰 [높음-2]도 원시 리소스 ID 노출을 지적했다 — 입력 필드는 피커로 바뀌었으나 행 라벨엔 미반영. 참고로 commandSummary.ts:179의 moveRouteSpriteParts는 스프라이트 이름 해석이 이미 가능하다. 영향: tex_easyrpg_charset_people1 같은 내부 리소스 ID가 저작 화면에 그대로 노출. 수정: 두 label 함수에 프로젝트 레코드 이름 해석(스위치/맵/리소스)을 넣고, 유령 참조일 때만 위키 계약대로 `<이름 없는 id> (없음)` 형식으로 표기.

**[EE-19-4] (medium) 이동 명령 라벨 3중 구현이 축약어까지 갈라짐 (방향고정/애니/투명도 vs 방향 고정/애니메이션/불투명도)**
`src/editor/panels/eventEditor/pageMovement.ts` · 최종 medium · 확인 · 확신 high
같은 MoveCommand 유니언에 라벨 함수가 세 벌 있다: pageMovement.ts:154-207(moveLabel), moveRouteCommandCatalog.ts:212-267(moveCommandLabel), previewMoveRoute.ts:281-290(미리보기 배지). 표기 불일치: previewMoveRoute.ts:282 `방향고정`(붙여쓰기)·:286 `애니`·:288 `투명도 ${signed(...)}` vs pageMovement.ts:185 `방향 고정`·:189 `애니메이션`·:191 `불투명도 감소/증가` vs moveRouteCommandCatalog.ts:245-251 풀네임. turnRelative도 pageMovement.ts:177 `회전` vs moveRouteCommandCatalog.ts:329-335 `오른쪽 90도 회전` 등으로 갈라진다. 영향: 동일 이동 단계가 페이지 이동 요약·경로 다이얼로그 목록·미리보기 배지에서 서로 다른 이름으로 보여 대조 저작을 방해하고, 세 벌 유지로 한쪽만 고쳐지는 회귀가 반복됨(EE-19-1의 ON/OFF도 이 사본 구조의 산물). 수정: moveRouteCommandCatalog.moveCommandLabel을 단일 정본으로 삼고 pageMovement.moveLabel·previewMoveRoute 라벨 케이스를 이에 위임(또는 import)하며, 축약어는 uiCopy의 `*Short` 규약처럼 명시적 축약 키로만 허용.

**[EE-19-5] (medium) 같은 맵 위 주인 개념이 「주인공」/「플레이어」로 이중화 — 동일 명령의 요약과 미리보기가 다른 단어를 쓴다**
`src/editor/panels/eventEditor/commandSummary.ts` · 최종 medium · 확인 · 확신 high
같은 값(player 토큰)이 표면마다 다른 단어로 불린다. ① 동일 명령 동일 대상: commandSummary.ts:511 animationTargetSummary `if (target === "player") return "주인공"` vs commandPreview.ts:1677 animationTargetPreview `if (target === "player") return "플레이어"` — 목록 요약은 주인공, 명령 미리보기 배지는 플레이어. addLight도 commandSummary.ts:505 «주인공» vs commandPreview.ts:1671 «플레이어». ② 형제 구현: commandBodyM2Page3.ts:1268-1269(M2 애니메이션 표시) «주인공» vs commandBodyPage3Native.ts:937-938(같은 애니메이션 표시군) «플레이어». ③ 같은 다이얼로그 내 혼용: commandBodyRoute.ts:36 이동 경로 대상 select «주인공» vs moveRouteCommandCatalog.ts:241-243 «플레이어 쪽으로 향함/플레이어 반대로 향함»(:113 버튼도 «플레이어 반대로 향함»), pageMovement.ts:163-165·181-183도 «플레이어 쪽 이동». ④ commandPreview.ts:532 가림 방지 미리보기 title «플레이어». 영향: 저작자가 «주인공»과 «플레이어»를 다른 대상으로 오인할 여지(주인공=DB 액터, 플레이어=맵 토큰으로 읽힘). 수정: 맵 위 토큰은 「주인공」으로 통일(또는 반대)하고, 어느 쪽이든 commandSummary/preview/body가 공유하는 라벨 상수 하나로 뽑아 세 표면이 같은 문자열을 쓰게 한다.

**[EE-19-6] (medium) 소리 재생/정지 명령군 용어 5중화 — 소리/BGM/배경음/음악/오디오 혼용**
`src/editor/panels/eventEditor/commandSummary.ts` · 최종 medium · 확인 · 확신 high
같은 배경음·효과음 대상이 명령 표면마다 다른 이름: ① commandSummary.ts:364 `c.channel === "bgm" ? commandLine("BGM 페이드아웃", valuePart("배경음만")) : commandLine("소리 정지", …)` — 한 줄에 BGM(영문 음차)과 배경음이 병기 ② commandSummary.ts:357 `commandLine("소리 재생", …)` vs commandBodyCore.ts:48 동일 명령 힌트 «현재 재생 중인 오디오를 정지합니다» ③ commandBodyAdvanced.ts:187 «배경음(BGM)만 페이드아웃합니다 — 효과음·환경음은 계속 흐릅니다» ④ commandBodyM2.ts:762 «선택한 음악: ${options.selectedName}»(BGM 지정 화면을 음악이라 부름). 헤더 정본은 음악·효과음(uiCopy.ts:58, 위키 pre-edit-routing L608)인데 명령 군은 그 정본과 무관하게 다섯 갈래. 영향: 초보 용어 정본(plain=일상어) 원칙과 어긋나고, «소리 재생» 명령에서 «음악»을 고르는 식의 난삽한 대응이 생김. 수정: playAudio/stopAudio/fadeAudio 군의 라벨을 「배경음 재생/정지」(또는 정본 「음악」) 하나로 통일하고 영문 음차 BGM은 사용자 문구에서 제거, commandSummary·commandBody·commandPreview가 상수를 공유하게 한다.

**[EE-19-7] (medium) 「커맨드」 잔존 — 명령 개념의 영문 음차 이중화**
`src/editor/panels/eventEditor/commandBodyM2Actor.ts` · 최종 medium · 확인 · 확신 high
사용자 가시 문자열에 「커맨드」(command 음차)가 남아 있다: commandBodyM2Actor.ts:1137 `el("option", { text: "(커맨드 선택)", … })`, :1158 `const picked = commandSel.value || "커맨드 없음"`, :1170 `fieldBlock("커맨드", commandSel)`(설정 명령 인스펙터의 필드 제목), followerPresetPicker.ts:54 «원하는 펫/동행자를 누르면 이벤트 끝에 커맨드가 추가됩니다.». 대조적으로 같은 편집기 전반이 「명령」을 정본으로 쓴다: commandList.ts:71 `(명령 없음)`, commandBodyLoop.ts:60 «명령이 없습니다. 아래에서 추가하세요.», aiAssist.ts:311 «명령 초안», commandSummary 명칭 자체가 명령 요약. 영향: 같은 개념이 두 낱말로 불려 검색(명령 피커 검색)·학습을 방해 — 위키 용어 규칙(동일 개념 용어 이중화 금지 정신) 위반. 수정: 4곳을 「명령」으로 교체(예: «(명령 선택)», «명령 없음», fieldBlock("명령"), «…명령이 추가됩니다»).

**[EE-19-8] (medium) skippable 개념 4중 문구 — 스킵 가능/스킵 허용/건너뛰기 허용/건너뛸 수 있음**
`src/editor/panels/eventEditor/commandSummary.ts` · 최종 medium · 확인 · 확신 high
skippable 개념이 표면마다 다르게 불린다: ① commandSummary.ts:365 컷신 «스킵 가능» vs :362 동영상 «건너뛰기 허용» — 같은 파일 두 명령이 다른 어휘 ② commandBodyPage3Native.ts:1013 aria-label «스킵 허용»·:1090 fieldBlock("스킵 허용")·:1060 «플레이어가 건너뛸 수 있음»/«건너뛰기 불가» — 같은 폼 안에 두 어휘 병존 ③ commandPreview.ts:1632 동영상 미리보기 «건너뛰기 허용»(본문 필드는 「스킵 허용」) ④ eventEditorHelp.ts:260 «스킵 불가 — …(스킵 불가 끔)». 영향: 필드에서 「스킵 허용」을 켜면 목록 요약·미리보기에는 「건너뛰기 허용」으로 나타나 같은 토글이 다른 이름으로 읽힘. 수정: 「건너뛰기 허용」(또는 「스킵 허용」) 한쪽으로 통일해 요약·배지·필드·aria가 상수를 공유하게 한다.

**[EE-19-9] (medium) 폐기된 제3의 표면명 「리소스 관리자」가 사용자 안내 문구에 잔존**
`src/editor/panels/eventEditor/commandBodyPage3Native.ts` · 최종 medium · 확인 · 확신 high
commandBodyPage3Native.ts:1056 `? "프로젝트에 동영상 리소스가 없습니다 — 리소스 관리자에서 동영상을 올린 뒤 고르세요"` — 저작자에게 열어 보라고 가리키는 표면 이름이 「리소스 관리자」인데, 그런 이름의 화면은 없다. 정본은 소재 보관함/리소스 보관함(uiCopy.ts:52 `resourceLibrary: { plain: "소재 보관함", technical: "리소스 보관함" }`, 위키 pre-edit-routing L606)이고, 위키는 «도구 메뉴는 `자료 보관함` 이라는 제3의 이름을 쓰고 있었다… 한 개념에 세 이름이었다»(L49-51)와 폐기 문자열 감사(L619-621)까지 두고 있다. 영향: 빈 상태 안내를 따라가도 「리소스 관리자」를 찾을 수 없어 안내가 무효. 수정: 문구를 «소재 보관함에서 동영상을 올린 뒤 고르세요»로 고치고, 표면 이름은 uiCopy.resourceLibrary 파생값으로 참조하게 한다.

저심각도 일괄:
- [EE-19-16] (low) 이벤트 ID 표면만 해요체(「~했어요/예요」) — 편집기 전반의 합니다체와 혼용 — `src/editor/panels/eventEditor/eventIdReadout.ts`
- [EE-19-17] (low) commandSummary 표기 잡음 — 빈 참조 폴백 3중 상이 + 「실패시」 붙여쓰기 — `src/editor/panels/eventEditor/commandSummary.ts`
- [EE-19-18] (low) TOOL_LABEL의 이벤트 도구 이름 「장면 놓기」 — 이벤트 개념의 제3의 이름이자 다의어 충돌 — `src/editor/uiCopy.ts`
- [EE-19-19] (low) 영문 잔존 칩 「LIVE」와 「페이드 아웃/페이드아웃」 표기 상이 — `src/editor/panels/eventEditor/commandBodyCore.ts`

### 5.20 EE-20 — 맵 위 이벤트 상호작용·배치·검색

**[EE-20-1] (high) 공통 이벤트 검색 결과 클릭이 비동기 모달과의 경합으로 항상 무효다**
`src/editor/panels/mapEventSearchModal.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/mapEventSearchModal.ts:304-308. 증거: `close(); openDatabaseModalLazy("commonEvents"); Array.from(document.querySelectorAll("[data-record-id]")).find((row) => row.dataset.recordId === target.commonEventId)?.click();` — 그런데 src/editor/panels/databaseModalLazy.ts:12은 `void import("@/editor/panels/databaseModal").then(({ openDatabaseModal }) => { openDatabaseModal(initialTab, options); });` 로 동적 import 후 then에서 DOM을 만든다. querySelectorAll은 import 해결 전 동기 실행되므로(모달이 이미 열려 있지 않은 한) 행이 없어 `.click()`이 항상 무효. 영향: 스위치/변수가 아니라 공통 이벤트 검색 결과를 누르면 자료집 모달만 열리고 대상 레코드는 선택되지 않는다(행의 묵시적 약속 "열기" 실패). db-common-event-row는 databaseCommonEventViews.ts:254-255(`testid: db-common-event-row-…, dataset: { recordId: commonEvent.id }`)에 있다. 수정 제안: openDatabaseModalLazy에 `selectRecordId` 옵션(또는 콜백)을 넘겨 모달이 렌더된 then 내부에서 선택하게 하거나, openDatabaseModal이 완료 Promise를 반환하게 하고 그 뒤에 선택한다. …

**[EE-20-2] (high) 맵·이벤트 찾기가 eventDisplayName 정본 계약을 어기고 자체 이름 규칙을 쓴다**
`src/editor/panels/mapEventSearchModel.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/mapEventSearchModel.ts:179-182. 증거: `function eventDisplayName(event: GameEvent): string { const name = event.pages?.find((page) => page.name.trim())?.name ?? ""; return displayName(name, event.id); }` — 정본 src/project/eventDisplayName.ts:33-37은 `event.name` 우선 → 이름 붙은 마지막 페이지(자동 이름 `페이지 N` 제외, :17 AUTO_PAGE_NAME) → ID 순이고, 파일 머리(:1-2)는 "맵 마커·헤더·명령 요약·검색이 같은 규칙을 써야 한다"며 검색을 명시한다. 로컬 복제는 (1) `event.name`을 아예 안 보고 (2) 첫 번째 비어있지 않은 페이지 이름(자동 이름 포함)을 취한다. 영향: name 필드에 저작 이름이 있어도 검색 결과·스위치/변수 참조 목록(recordResults의 :147 `name: eventDisplayName(event)`)이 `페이지 1` 따위로 표시돼 맵 마커와 다른 이름으로 불린다. 2026-09-17 적대적 리뷰 P0-1로 정본이 개정된 바로 그 증상이 검색에 남아 있다. 수정 제안: 로컬 함수를 지우고 `@/project/eventDisplayName`의 eventDisplayName을 import해 쓴다.

**[EE-20-3] (high) AI find_events의 nameContains 검색에 event.name이 빠져 저작 이름으로 NPC를 못 찾는다**
`src/editor/tools/queryTools.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/queryTools.ts:282-294. 증거: `const parts = [event.id, event.characterId ?? ""]; for (const page of eventPages(event)) { parts.push(page.name); … }` — GameEvent.name 필드가 검색 대상에 없다. 그런데 툴 설명(:224)은 "이벤트를 이름/id/대사/커맨드 종류/스위치 참조로 검색한다"고 약속하고, 정본 이벤트 이름은 event.name이다(project/eventDisplayName.ts:5 "편집기 헤더 상자와 place_npc 가 여기에 쓴다"). 즉 AI가 place_npc 등으로 만든 NPC(name 필드 세팅)를 nameContains:"촌장" 으로 찾으면 페이지 이름이 자동 이름(`페이지 1`)뿐이면 한 건도 매치되지 않는다. 영향: AI는 NPC가 없다고 판단해 중복 배치를 시도하기 가장 쉬운 경로가 된다. 수정 제안: parts 맨 앞에 event.name을 추가하고, 정본 규칙을 쓰려면 eventDisplayName(event) 문자열을 함께 넣을 것.

**[EE-20-4] (medium) AI find_events 결과 name 필드가 첫 페이지 자동 이름을 반환한다**
`src/editor/tools/queryTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/queryTools.ts:304-309. 증거: `return { name: pages[0]?.name || event.id, pageCount: pages.length, … }` — (1) `event.name` 무시, (2) 첫 페이지가 자동 이름 `페이지 1`이면 그대로 반환(정본 eventDisplayName.ts:19-21은 자동 이름을 이름으로 치지 않는다). find_events의 각 매치는 이 name을 실어 반환하므로(:273 `...eventCatalogFields(event)`), AI는 편집기가 `촌장`이라 부르는 이벤트를 `페이지 1`로 읽고 사용자에게 그대로 보고한다. 수정 제안: `name: eventDisplayName(event)`(@/project/eventDisplayName)으로 교체.

**[EE-20-5] (medium) 이벤트 삭제 확인·토스트·스냅샷 라벨이 첫 페이지 이름 규칙으로 정본과 갈린다**
`src/editor/eventDeletion.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/eventDeletion.ts:74-78. 증거: `function eventLabel(event …): string { const pageName = event.pages?.[0]?.name?.trim(); if (pageName) return pageName; return event.id; }` — 정본 project/eventDisplayName.ts는 event.name 우선 + 마지막 이름 붙은 페이지(자동 이름 제외)인데, 삭제 확인 대화(:71 `「${label}」 이벤트를 삭제할까요?`), 삭제 토스트(:30), 되돌리기 스냅샷 라벨(:19 `recordProjectSnapshot(\`이벤트 삭제: ${label}\`)`)이 전부 구규칙으로 만든 label을 쓴다. src/editor/eventActions.ts:274의 주석은 "되돌리기 라벨도 화면과 같은 이름을 써야 한다 — 규칙은 eventDisplayName 하나다"라고 못 박았다. 영향: name이 세팅된 NPC를 지울 때 확인창·토스트·감사 로그가 `페이지 1`을 가리켜 무엇을 지우는지 판단을 방해한다. 수정 제안: eventLabel을 eventDisplayName(event) 호출로 교체(중복 제거).

**[EE-20-6] (medium) 삭제 토스트 「복구」가 LIFO undo를 이벤트 전용 복구처럼 동작해 엉뚱한 편집을 되돌린다**
`src/editor/eventDeletion.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/eventDeletion.ts:36-43. 증거: 토스트(7초, :32 durationMs: 7000)의 복구 버튼이 `onClick: () => { if (undoMapEdit()) { toast("이벤트를 복구했습니다.", "ok"); } … }` 인데, src/editor/mapEditHistory.ts:260-262의 undoMapEdit은 `const previous = undoStack.pop(); if (!previous) return false;` 로 스택 top을 무조건 되돌린다. 삭제 뒤 7초 안에 타일 페인트·다른 이벤트 이동 등 새 편집을 하면 복구 버튼은 그 편집을 되돌리면서 "이벤트를 복구했습니다"라고 거짓 보고하고, 삭제된 이벤트는 살아나지 않는다. 이는 위키 editor-observability.md L292-302가 정리한 "되돌리기 스택(휘발·LIFO)과 감사/액션은 다르다" 경계를 토스트 액션이 침범한 사례다. 수정 제안: 삭제 시 스냅샷 서명/마커를 저장해 두고 복구 클릭 시 top이 그 마커인지 확인(아니면 "되돌릴 기록이 사라졌습니다" 안내), 또는 삭제된 이벤트 clone을 들고 있다가 재삽입하는 전용 restore를 쓸 것.

**[EE-20-7] (medium) addEventPage 감사 라벨 「N번째」가 실제 삽입 위치(선택 페이지 앞)와 어긋난다**
`src/editor/eventPages.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/eventPages.ts:108-143. 증거: 라벨용 카운트 `const position = Math.max(pageList(mapId, eventId).length, 1) + 1;`(:111)로 `페이지 추가 (N번째)`를 만들지만, 실제 삽입은 :132-138처럼 "A page appended at the end wins runtime resolution immediately. Insert before the active page (or before the current winner when there is no selection)" — `insertionIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, event.pages.length - 1)` 로 끝이 아니라 선택 페이지/승자 앞이다. 예: 페이지 2개·첫 페이지 선택 상태에서 추가하면 새 페이지는 1번째인데 감사 로그는 `(3번째)`. 이 파일 자체가(:531-544) 라벨 정확성을 감사 로그의 존재 이유로 서술하고, commandMoveCaption(:585-606)은 "로그가 존재하지 않는 #-1로 갔다고 적는" 것을 결함으로 잡았다 — 같은 기준에서 이 라벨도 거짓말이다. 수정 제안: 라벨을 mutator 내 실제 insertionIndex+1로 확정하거나, descriptor를 mutator 결과로 채우는 경로를 둘 것.

**[EE-20-8] (medium) 이벤트 드래그 이동이 드롭 지점 1칸만 검사해 2x2 몸이 다른 이벤트에 겹쳐 놓인다**
`src/editor/DragOperationHandler.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/DragOperationHandler.ts:224-234. 증거: 주석 "끌어다 놓을 칸이 남의 **몸 사각**에 걸리면 거절한다. 앵커만 보던 시절에는 2x2 이벤트의 비앵커 칸으로 다른 이벤트를 밀어 넣을 수 있었다" — 실제 코드는 `findEventCoveringPoint(editorWorkingEvents(map.events).filter((event) => event.id !== operation.eventId), point.x, point.y) !== undefined` 로 **드롭 앵커 점 한 칸**만 남의 몸 사각과 비교한다. 옮기는 이벤트가 2x2이면 비앵커 몸 칸이 다른 이벤트 몸 위에 얹혀도 통과된다. 프로젝트에는 이미 몸 사각 전체 겹침 판정기가 있다(src/project/eventFootprintQuery.ts:68-82 overlappingEventPairs, rectsOverlap 기반). 영향: 배치→이동 사이클에서 겹친 이벤트 쌍이 만들어지고, 사용자에겐 lint 경고(duplicate-event)만 나중에 보인다. 수정 제안: 드롭 전 옮기는 이벤트의 eventBodyRect와 타 이벤트 몸 사각의 rectsOverlap을 검사하도록 교체.

**[EE-20-9] (medium) 검색 결과 열기가 맵을 먼저 전환해 스위치 가드 취소 시 맵만 바뀐 채 남는다**
`src/editor/panels/mapEventSearchModal.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/mapEventSearchModal.ts:293-309. 증거: event 대상 분기 `if (!selectEditorMap(target.mapId)) return; close(); openEventEditorModal(target.mapId, target.eventId);` — selectEditorMap(src/editor/mapSelection.ts:39-44)은 이 시점에 currentMapId를 즉시 바꾼다. 그런데 openEventEditorModal → guardedCloseExistingEventEditorModal(src/editor/panels/eventEditor/modal.ts:90-123)은 기존 편집기에 미적용 변경이 있으면 "버리고 다른 이벤트를 열까요?" 확인을 띄우고 취소(`!discard`) 시 그냥 return한다(:118-119). 취소돼도 검색 모달은 이미 닫혔고(:300 close()) 맵은 이미 바뀌어 있어, "계속 편집"을 고른 사용자의 화면은 맵 B 위에 맵 A 드래프트 편집기가 떠 있는 상태가 된다. modal.ts:135-137 주석도 "Only a successful open takes ownership of the destination"이라고 소유권 규칙을 선언한다. 수정 제안: selectEditorMap을 openEventEditorModal 성공 후로 미루거나, 가드 취소 시 prevMapId로 selectEditorMap을 되돌릴 것.

저심각도 일괄:
- [EE-20-10] (low) 레거시 루트 커맨드 편집 함수 4종이 호출부 없이 죽은 수출이며 replaceCommand는 범위 검사가 없다 — `src/editor/eventActions.ts`
- [EE-20-11] (low) addEvent가 실패를 빈 문자열로 침묵하고 무변경 감사 엔트리를 남긴다 — `src/editor/eventActions.ts`
- [EE-20-12] (low) 편집기 복원 칩이 selectEditorMap의 상한·잠금 가드를 우회해 editorState를 직접 바꾼다 — `src/editor/panels/eventEditor/modal.ts`
- [EE-20-13] (low) 검색 결과 목록이 combobox/listbox 반쪽 계약(aria-selected·activedescendant에 role 부재)으로 a11y가 깨진다 — `src/editor/panels/mapEventSearchModal.ts`
- [EE-20-14] (low) 「선택한 맵」 범위에서 공통 이벤트가 조용히 검색 대상에서 빠지고 안내도 없다 — `src/editor/panels/mapEventSearchModel.ts`
- [EE-20-15] (low) 검색 입력마다 참조 펼침 상태가 초기화되어 참조 탐색 UX가 무너진다 — `src/editor/panels/mapEventSearchModal.ts`
- [EE-20-16] (low) 위키 event-unreachable 절의 회귀 포인터 test/projectLint.test.ts가 존재하지 않고 본 suite에서도 빠졌다 — `openwiki/editor-validation.md`
- [EE-20-17] (low) 이벤트 삭제 확인 문구 상수가 실제 confirm 문구와 다른 죽은 복사본으로 남아 테스트를 오도한다 — `src/editor/eventDeletion.ts`

## 6 데이터베이스 카탈로그 — 1차 발견 310건, 실재 308건 (보류 16 포함)

### 6.1 DB-01 — DB 창 셸·모달·30탭 네비게이션

**[DB-01-1] (high) AI 검토 카드 이동 버튼이 레일에 없는 database 컬렉션 전환에서 tabFor 예외/빈 화면 유발**
`src/editor/panels/databaseModal.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseModal.ts:189-201 — AI 바의 navigate 의존성이 `if (!(collection in database))` 로만 검증한 뒤 `switchDatabaseActiveTab(target as DatabaseTab, body)` 를 호출한다. 그러나 diff 생성기 src/project/databaseRecordDiff.ts:202 는 `const collections = new Set([...Object.keys(beforeDatabase), ...Object.keys(afterDatabase)])` — 즉 database 의 모든 배열 키를 검토 카드 컬렉션으로 만들고, 카드 클릭은 src/editor/panels/databaseAiBar.ts:527 `navigate(change.collection, change.id)` 로 그대로 들어온다. battleAnimations, farmAnimalSpecies, farmBuildingTypes, homeDecorationTypes, fishSpecies, lifeSkills 등은 database 키로는 유효해 가드를 통과하지만 레일 탭이 없다(탭 레지스트리 src/editor/panels/database.ts:126-168 에 animations(143행)만 있고 battleAnimations 키는 없음).  …

**[DB-01-2] (medium) 도크 모드 Ctrl+Z/Y 를 DB 모달 문서 리스너가 선점해 맵 잠금 검사를 우회하고 도크 면계 규약이 무의미해짐**
`src/editor/panels/databaseModal.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseModal.ts:471 `document.addEventListener("keydown", handleHistoryKeyDown);` — handleHistoryKeyDown 본문(242-252행)에는 도크 가드가 없다. 같은 파일의 handleModalKeyDown 은 460행 `if (dockMode) return;` 으로 도크에서 스스로 물러나는데(455-458행 주석: 도크는 모달이 아니다) 히스토리 핸들러만 예외다. 소유권 정본은 src/editor/hotkeys.ts:156 `if (document.querySelector("[data-testid='database-modal']:not(.is-docked)")) return true;` 로 도크는 맵(EditScene)의 몫이다. 실제 순서는 document 버블이 window(Phaser)보다 먼저라 도크 중 Ctrl+Z 를 DB 모달 리스너가 선점하고 handleHistoryHotkey(hotkeys.ts:173-177)가 즉시 preventDefault 하므로 Phaser 는 발화하지 않는다(EditScene.ts 이스케이프 사슬 주석이 전제하는 규약). 결과: (1) EditScene.ts:1386 `if (mid && !canEditMap(mid))` 의 맵 편집 잠금 검사가 통째로 우회된다 — 다른 세션이 잠근 맵 위에서도 undoMapEdit→store.replace 로 잠긴 맵을 되돌려 쓴다. (2) hotkeys.ts:156 의 도크 면계가 죽은 코드가 된다. …

**[DB-01-3] (medium) Escape 계층 게이트가 빨간불 격리 — modalStack 미참여 body 오버레이 5곳이 DB 모달 Esc 계약을 다시 깨뜨림**
`test/modalEscapeLayerGate.quarantine.test.ts` · 최종 medium · 확인 · 확신 high
DB 모달 Esc 소유권은 modalStack 등록으로 지켜진다(databaseModal.ts:610-630 주석: modalStack 은 Escape 소유권의 정본). 이를 기계로 지키던 게이트 test/modalEscapeLayerGate.quarantine.test.ts(헤더 주석: body 에 띄우는 새 오버레이가 modalStack 을 쓰지 않으면 그 위에서 Escape 를 누를 때 바깥 데이터베이스가 대신 닫는다 — 이 버그를 세 번 연속으로 놓쳤다)는 test/QUARANTINE.md:169 에서 assertion 실패로 격리돼 아무것도 게이팅하지 않는다. 정적 재계산으로 red 원인이 확인된다: `document.body.append(` 를 쓰면서 registerModal 이 없는 오버레이가 정확히 5건이다 — src/editor/panels/aiStickyChecklist.ts:361, src/editor/panels/aiWorkStrip.ts:135, src/editor/panels/resourceManagerViews.ts:721(URL 가져오기 backdrop — 모달형 표면), src/editor/projectFolderActions.ts:60(backdrop+modal 통짜 append), src/editor/teamSession.ts:39. 모두 게이트 EXEMPT 목록에도 없어 body 에 오버레이를 붙이는 파일은 modalStack 에 참여하거나 이유와 함께 면제된다 단언이 깨진 상태다. 영향: 이 오버레이가 DB 모달(창 모드)과 공존하는 동안 Esc 를 누르면 스택 최상층인 DB 모달의 requestModalEscape 가 발화해 오버레이가 아니라 DB 모달(더티면 프롬프트)이 반응한다. …

**[DB-01-4] (medium) DB 셸 계약 게이트 4종이 빨간불 격리로 무방비 — databaseStudioV2 는 villages 브레드크럼 기대값이 소스와 어긋난 채 방치**
`test/QUARANTINE.md` · 최종 medium · 확인 · 확신 high
test/QUARANTINE.md(2026-09-13 원장, 이 파일들은 기준선부터 계속 실패했고 아무것도 게이팅하지 않는다)는 DB 셸 계약 테스트를 격리했다: databaseStudioV2.test.ts(113행 — 위키 editor-database.md L1657-1660 이 선택자 깊이·import 순서·스테퍼 flex 계약을 이 테스트가 고정한다고 명시), databaseRadioCustomGuard.test.ts(167행), modalEscapeLayerGate.test.ts(169행), databaseKoreanRtpDefaults.test.ts(176행), databaseSelectChevronGuard.test.ts(177행 — src/styles/database/modern-controls.css:26 이 test/databaseSelectChevronGuard.test.ts 가 그 두 전제를 기계로 고정한다고 전제하는데 무너짐). databaseStudioV2 는 red 지점까지 특정된다: 격리 파일 test/databaseStudioV2.quarantine.test.ts:47의 villages 기대값이 spatialPlaces 인데 소스 정본은 database.ts LEGACY_SPATIAL_ROUTE 의 `villages: "spatialRegions"`(그리고 worldGen: "spatialRegions")로 어긋나 있다 — 기대값이 오래됐든 소스가 틀렸든 둘 중 하나인데 아무도 울지 않는다. 위키가 주장하는 기계적 보장 전체가 현재 무방비다. 수정 제안: villages 기대값을 소스에 맞춰 갱신한 뒤 격리를 해제하고(QUARANTINE.md 재등록 절차 준수), 나머지 4종도 초록으로 고쳐 복귀한다.

**[DB-01-5] (medium) 맵은 더티 세션 소유 밖인데 DB 지금 저장이 맵 충돌에 전면 차단된다**
`src/editor/panels/databaseModalPersistence.ts` · 최종 medium · 확인 · 확신 high
DB 더티 세션은 맵을 소유 밖으로 선언한다: src/editor/panels/databaseModalDirtySession.ts:16-19(도크로 맵을 칠한 뒤 DB 를 되돌려도 맵 편집은 살린다 — 맵은 이 세션의 소유가 아니다), 서명도 맵·mapTree 를 뺀다(58-61행). 그런데 DB 모달 푸터의 「지금 저장」은 src/editor/panels/databaseModalPersistence.ts:24 `store.flush()` 로 프로젝트 전체를 all-or-nothing 확정하고, conflict 결과(store.ts:133 `{ kind: "conflict"; conflicts: mapId+name }`)를 39행 `맵이 다른 세션에서 먼저 바뀌어 저장하지 않았습니다` 로만 보고한다. 도크 모드는 맵 병행 편집을 정식 허용하므로(databaseModalDirtySession.ts:17) 정상 흐름에서 로컬 맵 편집이 존재하고, 팀 세션에서 같은 맵을 타 세션이 먼저 바꾸면 DB 편집은 conflict 와 무관함에도 저장이 전면 차단된다 — applyDatabaseChanges 가 false 를 돌려 saveAndMarkClean(databaseModal.ts:386-402)이 markClean 없이 끝나고 더티 프롬프트의 「저장하고 닫기」(406-408행, saved 때만 close)도 닫기에 실패한다. 사용자에게 풀리는 길은 DB 모달 안에 없다. 수정 제안: DB 모달 저장 경로에 맵을 건너뛰는 flush 스코프 옵션을 두거나, conflict 안내에 DB 편집이 아직 미확정 상태임과 해결 위치(맵 편집 화면/저장 상태바)를 명시한다.

저심각도 일괄:
- [DB-01-6] (low) openDatabaseModalLazy 의 동적 import 실패가 무처리 — 열기 요청이 조용히 사라진다 — `src/editor/panels/databaseModalLazy.ts`
- [DB-01-7] (low) 더티 프롬프트에 포커스 이동·역할 부여가 없어 키보드/스크린리더 사용자가 존재를 모른다 — `src/editor/panels/databaseModal.ts`
- [DB-01-8] (low) 더티 프롬프트의 저장하고 닫기가 실패해도 프롬프트가 푸터에 남아 에러 상태와 겹쳐 보인다 — `src/editor/panels/databaseModal.ts`

### 6.2 DB-02 — 시스템·개요·유틸리티 뷰

**[DB-02-1] (high) 스위치·변수·용어·지형·적 그룹 검색输入이 디바운스 재렌더마다 키보드 포커스를 잃는다**
`src/editor/panels/databaseUtilityViews.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseUtilityViews.ts:204-212(스위치/변수), :550-558(용어); src/editor/panels/databaseUtilityRecordViews.ts:153-161(지형), :468-476(전투 화면 적 그룹). listSearch 의 계약문서(databaseWorkspace.ts:165 '포커스/캐럿 유지는 호출부의 rerender 정책에 맡긴다')대로 이 호출부들은 onInput 에서 setFlagQuery/terrainQuery/troopQuery 갱신 후 rerender() 만 호출하고 포커스 복원을 하지 않는다. database.ts:929-934 commitFocusedControlIn 은 재렌더 직전 document.activeElement.blur() 만 할 뿐 복원은 없으므로, 90ms 디바운스가 터지는 순간 입력 노드가 통째로 교체되며 포커스가 <body> 로 떨어진다. 사람이 한 글자씩 치면 두 번째 글자부터 어디도 안 먹는다. 같은 스코프 안에 정답 패턴이 이미 있다: 레코드 탭 검색은 databaseRecordViews.ts:452-456, 461-468 이 커서 위치까지 복원하고(그리고 oprn-database.spec.ts:90-92 가 toBeFocused 로 고정), 같은 파일 databaseUtilityRecordViews.ts:807-818 의 commandSearchBox 도 restoreFocusAfterRerender("db-battle-command-search") 를 쓴다. 즉 유틸리티 4경로만 규약에서 빠져 있다. …

**[DB-02-2] (medium) 적(monster) 스킬 선택기의 쓰기 경로가 정규화에 의해 조용히 무시된다(읽기/쓰기 계약 어긋남 + 죽은 export)**
`src/editor/panels/databaseBasicRecordFields.ts` · 최종 medium · 보류 · 확신 high
위치: src/editor/panels/databaseBasicRecordFields.ts:150-167. skillPicker 는 enemies 에 대해 쓸 때 updateDatabaseRecord(collection, id, { skillIds: value ? [value] : [] }) 로 skillIds 에만 쓰고(:154), 읽을 때는 selectedSkill 이 actions[0]?.skillId 를 읽는다(:163). 그런데 updateEnemyRecord(src/editor/databaseRecordMutators.ts:143,162)는 패치를 record.skillIds 에 반영한 뒤 normalizeEnemyRecord 로 재정규화하는데, normalizeEnemyRecord(src/project/databaseEnemyTroopRecordModel.ts:21,154-157)는 actions 가 이미 정의돼 있으면(스토어의 모든 EnemyRecord 는 정규화를 거쳐 항상 정의됨) legacy skillIds 를 완전히 무시하고 :40-41 에서 actions 투영으로 skillIds 를 다시 계산한다. 결과: 인스펙터가 actions[0] 의 스킬을 보여 주고, 사용자/AI 가 다른 스킬을 골라도 스토어에는 아무 변화가 없고 다음 렌더에서 선택이 원래 값으로 되돌아온다(조용한 입력 유실). 이 경로는 dbTools.ts 의 AI 툴이 updateDatabaseRecord("enemies", id, { skillIds }) 로 적 스킬을 저작할 때도 동일하게 무시되는 저작↔런타임 계약 어긋남이다. …
> 보류 사유: 쓰기 무시 메커니즘은 실측으로 확정: updateEnemyRecord가 skillIds에 기록한 뒤(databaseRecordMutators.ts:143,162) normalizeEnemyRecord가 actions를 항상 우선하고 skillIds를 actions 투영으로 재계산한다(databaseEnemyTroopRecordModel.ts:21,41,155 — 저장 레코드는 actions가 항상 정의돼 legacy가 절대 폴백되지 않음).  …

**[DB-02-3] (medium) 유틸리티 탭(스위치/변수/지형/적 그룹/전투 명령) 카운트 배지가 검색 필터를 무시한다 — '0행에 N개' 결함 클래스 재발**
`src/editor/panels/databaseUtilityViews.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseUtilityViews.ts:203-232 — renderFlagTab 은 count: named.length(필터 전 개수)를 주는데 rows 는 :195-199 에서 query 로 걸러진다. databaseUtilityRecordViews.ts:152(지형, count: terrains.length), :467(적 그룹, count: troops.length), :711/:780(전투 명령 히어로/힌트, commands.length)도 동일. 검색어를 넣어 0행이 되어도 배지는 '29개'를 말한다. 이 정확한 결함 클래스를 레코드 탭에서는 이미 잡았다: databaseRecordViews.ts:476-482 주석("0행에 29개" 2026-09-01 실측)과 :863-873 recordListFooter 의 visible/total 표기가 그 수정본이다. 유틸리티 패밀리는 같은 규약을 못 받았다. 수정: recordListFooter 처럼 필터 중일 때 `${visibleCount}/${totalCount}개`(title 로 설명)를 쓰게 통일.

**[DB-02-5] (medium) avatarChip 의 얼굴 해상이 project 컨텍스트 없이 호출돼 업로드 얼굴이 전부 빈 칩으로 나온다**
`src/editor/panels/databaseControls.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseControls.ts:375 — const url = resolveAssetResourceUrl(actor.faceResourceId); 다른 모든 패널 호출부는 { project: store.getCurrent() } 또는 { project } 를 넘기는데(예: databaseRecordThumbnails.ts:67, actorRecordControls.ts:39, databaseItemRecordView.ts:552) 이곳만 옵션을 생략했다. resolveAssetResourceUrl(src/assets/generatedAssetResourceResolver.ts:309-310)은 options.project?.assets.uploaded[resourceId]?.dataUrl 를 검사하므로, 업로드된 얼굴 리소스는 여기서 null 이 돼 chip 이 항상 빈 슬롯으로 그려진다. 이 칩 행의 유일한 호출자는 아이템 인스펙터의 '허용 주인공'(databaseItemRecordView.ts:776 avatarChipRow("db-field-item-usable-actors"))이라, 얼굴을 업로드한 프로젝트에서 아이템 사용 주인공 지정 UI 가 얼굴 없는 이름 칩만 보여 준다(리스트 썸네일 같은 레코드의 얼굴은 정상 표시 — 같은 화면에서 표기 불일치). 수정: resolveAssetResourceUrl(actor.faceResourceId, { project: store.getCurrent() }).

**[DB-02-6] (medium) 유틸리티 탭의 모듈 레벨 상태(선택 index·검색어·미리보기 troop)가 프로젝트 전환/모달 재오픈에서 재초기화되지 않는다**
`src/editor/panels/databaseUtilityRecordControls.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseUtilityRecordControls.ts:11 — const selectedUtilityRecords: Partial<Record<UtilityTabId, number>> = {} (모듈 상수, 리셋 export 없음). src/editor/panels/databaseUtilityViews.ts:31-35(switchSearch/selectedSwitchId/variableSearch/selectedVariableId), :516(termSearch/selectedTermGroupId), src/editor/panels/databaseUtilityRecordViews.ts:90-94(terrainQuery/troopQuery/commandQuery/previewTroopId)도 동일. 반면 레코드 탭 세션은 resetDatabaseRecordViewSession 을 갖고 databaseModal.ts:142 이 모달 정리 때 명시 호출한다 — 유틸리티 패밀리만 이 경로에서 누락됐다. 영향: (1) 프로젝트 A 스위치 탭에 입력한 검색어가 프로젝트 B 스위치 탭을 열 때 그대로 적용돼 '목록이 비어 보이는' 오해를 만든다. (2) 지형 선택 index 는 프로젝트마다 길이가 다른데 리셋이 없어 범위 밖 index 가 남고, selectedTerrain/databaseUtilityRecordControls.ts:94-96 은 [0] 으로 폴백하지만 selectedUtilityRecordIndex 를 그대로 읽는 표면(battleCommandCard 의 is-selected 하이라이트, databaseUtilityRecordViews.ts:843)과 어긋난다. …

**[DB-02-13] (low) 시스템 개요 검색에서 '진행 상태' 패널이 필터 대상은 아니면서 searchText 를 달고 있다 — 모순적 no-results**
`src/editor/panels/databaseSystemStudio.ts` · 최종 low · 보류 · 확신 high
위치: src/editor/panels/databaseSystemStudio.ts:233-236 — stateRegistry <details> 는 dataset.searchText: "진행 상태 플래그 변수 조건 스토리" 를 갖지만 class 가 db-system-studio-panel 이라 filterStudio(:541-551)의 셀렉터 .db-system-studio-searchable 에 걸리지 않는다. '진행' 따위로 검색하면 모든 카드는 hidden 이 되고 db-system-studio-no-results("일치하는 설정이 없습니다", :66-72)가 뜨는데, 정작 검색어와 일치하는 '진행 상태와 연결 데이터' 패널은 화면에 펼쳐져 그대로 남는다 — no-results 배너가 자기모순이 된다. searchText 를 달아둔 것부터 이 패널을 검색 대상으로 의도했다는 흔적이다. 수정: details 에 db-system-studio-searchable 클래스를 부여해 필터에 포함하거나 searchText 를 제거.
> 보류 사유: stateRegistry details가 searchText를 달고 있으면서(db-system-studio-state 클래스만, ~234행) filterStudio는 .db-system-studio-searchable만 순회하므로(541-551) 필터 제외 + no-results 배너와의 모순은 실측으로 맞다. 그러나 '패널이 펼쳐져 그대로 남는다'는 과장 — details에 open 속성도, 검색 시 자동 펼침 로직도 없어 기본은 접힌 상태며 화면에는 요약행만 남는다. 배너 자기모순은 성립하므로 partial, low.

**[DB-02-16] (low) resetRequestedSystemSection 이 미사용 dead export — 미소비 시스템 섹션 요청이 무기한 생존해 엉뚉한 착지를 만든다**
`src/editor/panels/databaseSystemView.ts` · 최종 low · 보류 · 확신 high
위치: src/editor/panels/databaseSystemView.ts:119-125 — resetRequestedSystemSection 이 export 돼 있지만 grep 전수에서 호출자가 0 이다. requestSystemSection("startup", ...) 은 databaseUtilityRecordViews.ts:591, databaseLifeUi.ts:188 에서 호출하는데, 이 요청은 renderSystemTab 이 consume 하기 전까지 모듈 상태로 무기한 남는다. 요청 후 시스템 탭을 열지 못한 채 모달이 닫히면(예: 전투 화면 탭에서 버튼 클릭 직후 모달 종료), 다음에 언제/어느 프로젝트에서 시스템 탭을 열든 예고 없이 'startup' 섹션으로 착지하고 지정 필드로 포커스를 쏟는다(:156-158, :184). 수정: 모달 정리 경로에서 resetRequestedSystemSection() 을 호출하거나(호출자가 생김), 요청을 renderSystemTab 1회 소비 + 탭 진입 1회 안에서만 유효하게 만들 것.
> 보류 사유: 생산 코드에 호출자가 없고 요청이 다음 renderSystemTab 소비(156-158,184)까지 모듈 상태로 남는 것은 실측으로 맞다. 그러나 '호출자 0'은 부정확 — 테스트가 resetRequestedSystemSection을 호출한다(test/databaseLifeReadinessNav.test.ts:56,61, test/databaseSystemModern.test.ts:35-57). 즉 죽은 export가 아니라 '프로덕션 정리 경로 부재' 문제이며, 스테일 착지 시나리오 자체는 성립하므로 partial, low.

**[DB-02-4] (low) 워크벤치 선택 요약 모듈(databasePanelSummary)이 완전히 고아다 — 아무도 import 하지 않는다**
`src/editor/panels/databasePanelSummary.ts` · 최종 low · 보류 · 확신 high
위치: src/editor/panels/databasePanelSummary.ts:1-97. grep 전수(src+test)에서 이 모듈의 import 문은 하나도 없다 — DatabaseWorkbenchSummary/activeTabSummary 는 어디서도 소비되지 않는다. 이 요약(recordId/recordName/selectedIndex/totalCount, :6-13)은 '워크벤치 지금 어떤 레코드를 보고 있는가'라는 AI·상태 표면 계약인데, 제공자가 고아가 된 순간 AI 조수는 이 경로로 현재 선택을 읽을 수 없다(계약만 문서화·테스트 id 만 남음). 덧붙여 살아 있었다 해도 결함이 있다: utilityDatabaseSummary(:79-93)는 selectedIndex 가 범위를 벗어나 record 를 database.elements?.[0] 로 폴백하면서도 selectedIndex: record ? index + 1 : undefined 로 원래 index 를 보고한다 — 실제 보여지는 레코드(0번)와 요약(예: 16번)이 어긋난다. 또 갤러리 모드에서는 recordGalleryCard 가 recordTotal 데이터셋을 안 넣어(아래 DB-02-8) totalCount 가 undefined 가 된다. 수정: 실제 소비자(AI 세션/워크벤치 상태 표면)에 연결하거나 모듈째 삭제. 연결한다면 폴백 시 selectedIndex 도 실제 표시 레코드 기준으로 산정.
> 보류 사유: 모듈 고아와 폴백 버그는 실측으로 확정: src+test 전수 grep에서 import가 0개이고, utilityDatabaseSummary는 record를 [index] ?? [0]로 폴백하면서 selectedIndex: index+1을 보고한다(81-92행). 다만 'AI가 현재 선택을 읽을 수 없다'는 영향은 과장 — AI 바에는 selectedDatabaseRecordRef(databaseModal.ts:711-719)라는 살아있는 선택 표면이 있다. 소비자 없는 죽은 모듈+내부 결함이므로 low로 조정.

**[DB-02-8] (low) 갤러리 카드 행에 recordTotal 데이터셋이 없어 요약 계약(totalCount)이 갤러리 모드에서 깨진다**
`src/editor/panels/databaseRecordViews.ts` · 최종 low · 보류 · 확신 high
위치: src/editor/panels/databaseRecordViews.ts:644-649 — recordGalleryCard 의 dataset 은 recordId/recordIndex/recordName 만 넣고 recordTotal 을 빼먹었다. 리스트 행(recordListRow :611)은 recordTotal: String(total) 을 넣는다. 이 데이터셋 조합의 유일한 독자인 activeTabSummary(databasePanelSummary.ts:29-37, numericDataset(activeRow, "recordTotal")) 계약상 갤러리 모드에서는 totalCount 가 undefined 로 나온다 — 같은 탭, 같은 선택인데 보기 전환만으로 요약 계약이 깨진다. 위키가 보증하는 'db-record-row-* 계약을 databaseRecordViews 가 소유한다'(editor-database.md L626)와도 어긋나는 부분 집합. 수정: recordGalleryCard dataset 에 recordTotal 추가.
> 보류 사유: recordGalleryCard dataset에 recordTotal이 없는 것(644-649)과 recordListRow의 recordTotal 포함(611)은 실측으로 맞다. 그러나 유일 독자인 activeTabSummary는 (1) DB-02-4로 확인된 고아 모듈이고 (2) `.db-list-row.active`를 쿼리하므로(29행) gallery card(db-gallery-card)는 애초 셀렉터에 걸리지 않아 recordTotal만 추가해선 계약이 복구되지 않는다 — 영향 서술이 과장.  …

저심각도 일괄:
- [DB-02-10] (low) troopFields 가 button 스타일 전체를 TS 인라인 cssText 로 박제해 src/styles 표현 소유 규약을 우회한다 — `src/editor/panels/databaseBasicRecordFields.ts`
- [DB-02-11] (low) writeTerrain 이 store.update change descriptor 없이 호출된다 — 같은 파일의 writeBattleCommand 와 불일치 — `src/editor/panels/databaseUtilityRecordViews.ts`
- [DB-02-12] (low) avatarChipRow 클릭이 selectedIds 가 아니라 DOM aria-pressed 를 진실원으로 쓴다 — 모델 거부 시 UI가 거짓 상태로 남는다 — `src/editor/panels/databaseControls.ts`
- [DB-02-14] (low) 위키 'System settings workspace' 계약이 10섹션으로 기술하지만 코드는 11섹션(menu 포함)이다 — 위키 낡음 — `openwiki/editor-database.md`
- [DB-02-15] (low) 개요 CTA의 AI 바 열기가 토글 부재 시 아무 피드백 없이 무음 실패한다 — `src/editor/panels/databaseOverviewView.ts`
- [DB-02-17] (low) onRename 의 db-actor-summary-selected 동기화가 존재하지 않는 testid를 찾는 죽은 참조다 — `src/editor/panels/databaseRecordViews.ts`
- [DB-02-18] (low) items/equipment 뷰 모드 계약이 'items' 단일 키로 축소됐다 — equipment 저장 모드는 죽은 키고 토글이 items 상태를 오염시킨다 — `src/editor/panels/databaseRecordViewSession.ts`
- [DB-02-19] (low) 모달 패널 루트 해석 헬퍼 databasePanelRootFrom 이 3벌 복제돼 있다 — 드리프트 리스크 — `src/editor/panels/databaseOverviewView.ts`
- [DB-02-7] (low) 빈 레코드 이름 표기가 identity 블록만 '(미등록)'이고 나머지는 전부 '(이름 없음)' — 표기 불일치 + 고아 콜론 — `src/editor/panels/databaseRecordIdentity.ts`
- [DB-02-9] (low) 비어 있는 import 문이 남아 있다 — import {} from "@/assets/easyrpgRtp" — `src/editor/panels/databaseControls.ts`

### 6.3 DB-03 — 레코드 액션·모델·가상 리스트

**[DB-03-1] (critical) 아이템 삭제 가드가 작물(crop)의 seedItemId·harvestItemId 참조를 못 봐서 삭제 후 프로젝트가 로드 불가가 된다**
`src/editor/databaseActions.ts` · 최종 critical · 확인 · 확신 high
위치: src/editor/databaseActions.ts:385-387 (deleteDatabaseRecord가 databaseReferenceMessage만 통과하면 삭제), src/editor/databaseReferences.ts:116-167 (items 케이스가 farmBuildingTypes·craftRecipes·museum 등 15곳을 훑지만 project.database.crops는 한 번도 안 봄), src/project/io/references.ts:687-688 (validateCropRecords: "seedItemId does not exist" 이슈 push), src/project/databaseRecordModel.ts:96-100 (문서화: "씨앗·수확물이 사라진 작물 행을 남기면 validateProjectReferences가 하드 실패해 프로젝트가 열리지 않는다. 실측(2026-08-29)"). 증거: 기본 DB에는 작물이 있고(농사 저작) crop.seedItemId/harvestItemId는 필수 FK다. 사람이 DB 모달에서 그 씨앗 아이템을 삭제하면 가드는 통과하고 저장되며, 다음 로드에서 참조 검증 하드 실패로 프로젝트가 아예 안 열린다 — 소스 코멘트가 부르는 "경고 없는 삭제 → 다음 로드에서 프로젝트가 안 열림(2026-09-19 리뷰 P0-6)" 패턴의 미수정 잔여.  …

**[DB-03-2] (critical) 적 그룹 삭제 가드가 맵의 encounterTable·fieldSpawns·troopIds 참조를 못 봐서 삭제 후 로드 불가**
`src/editor/databaseReferences.ts` · 최종 critical · 확인 · 확신 high
위치: src/editor/databaseReferences.ts:113-115 ("case \"troops\": if (project.system.initialTroopId === id) ... return commandLocationMessage(...)") — 이 케이스는 시스템 초기 트룹과 이벤트 명령(battleProcessing.troopId, databaseCommandReferences.ts:179-180)만 본다. 그런데 로드 검증기는 src/project/io/references.ts:1159 ("map X: troopIds does not exist"), :1166-1168 ("encounterTable[i].troopId does not exist"), :1170-1171 ("fieldSpawns[i].troopId does not exist")에서 맵 레벨 트룹 참조를 전부 하드 이슈로 보고한다. 맵 인카운터 표/필드 스폰은 1급 저작 데이터(action 데모·ice 확장판이 전부 사용)인데 DB 모달에서 그 트룹을 삭제하면 가드가 무사통과시키고 다음 로드에서 프로젝트가 열리지 않는다. 수정 제안: troops 케이스에 Object.values(project.maps) 순회로 map.troopIds·encounterTable[].troopId·fieldSpawns[].troopId 스캔을 추가(위치 메시지에 맵 이름 포함 — formatLocation 재사용).

**[DB-03-3] (high) 스킬·아이템 삭제 가드가 몬스터 종족(monsterSpecies) 참조를 못 봐서 삭제 후 로드 불가**
`src/editor/databaseReferences.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/databaseReferences.ts:59-70 (skills 케이스: skillTrees→promotions→actors→classes→items→equipment→enemies→commands만 순회, monsterSpecies 없음), :116-167 (items 케이스에도 monsterSpecies 없음). 반면 로드 검증기는 src/project/io/references.ts:667 ("monsterSpecies X: skill does not exist" — skillsByLevel[].skillId), :671 ("evolution itemId does not exist" — 진화 재료 아이템)을 하드 이슈로 처리한다. 즉 몬스터 종족의 레벨 스킬표가 유일 참조인 스킬, 종족 진화 재료가 유일 참조인 아이템을 DB 모달에서 삭제하면 경고 없이 삭제되고 다음 로드에서 프로젝트가 안 열린다. dbTools define 종족 경로(AI)는 스킬/아이템 존재를 요구하지만, 삭제 이후의 역참조는 어느 쪽 가드도 못 본다(커밋 게이트만이 막음 — 사람 경로는 미보호). 수정 제안: skills 케이스에 species.skillsByLevel, items 케이스에 species.evolutions[].requires.itemId 스캔 추가.

**[DB-03-4] (high) 직업 삭제 가드가 다른 직업의 promotions[].toClassId·equipmentPermissions.classIds 참조를 못 보고, presetBrowser는 dangling에 크래시**
`src/editor/databaseReferences.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/databaseReferences.ts:81-91 (classes 케이스: actors.classId → equipment.equippableClassIds → items.usableClassIds → commandLocationMessage만 순회). 같은 프로젝트 내 다른 직업이 이 직업을 가리키는 참조는 안 본다: (a) promotions[].toClassId — 로드 검증기 references.ts:557-558 하드 이슈("promotion toClassId does not exist"), (b) equipmentPermissions.classIds — references.ts:556 하드 이슈. 승급 대상 직업을 DB 모달에서 삭제하면 통과 → 다음 로드 실패. 더해서 런타임 크래시 경로가 이미 존재한다: src/project/io/growthTree/presetBrowser.ts:74 "(klass?.promotions ?? []).map(e => `${project.database.classes.find(c => c.id === e.toClassId)!.name}: ...`" — find 결과에 non-null assertion이라 삭제된 대상이 있으면 프리셋 브라우저에서 해당 직업 열람 시 TypeError. playerGrowthMenu.ts:19-20은 if (!target) continue로 조용히 승급 경로를 유실한다. 소스 코멘트(databaseReferences.ts:88-89)가 스스로 "여기서 빠지면 battleAnimations와 같은 '경고 없는 삭제 → 로드 불가' 경로가 된다"고 인지하고 있으면서 classes→classes 스캔은 빠져 있다. …

**[DB-03-5] (high) 사람 삭제 가드와 AI delete_database_record의 참조 권위가 어긋나 있다 — AI는 stateRates dangler를 만들 수 있고 사람은 브릭 경로가 열려 있다**
`src/editor/databaseActions.ts` · 최종 high · 확인 · 확신 high
위치: 사람 경로 src/editor/databaseActions.ts:385-387 → databaseReferenceMessage; AI 경로 src/editor/tools/dbTools.ts:192-207 (delete_database_record run이 deleteFromCollection 호출, 도구 자체는 참조 검사 없음 — 설명문: "참조가 남아 프로젝트 무결성이 깨지면 커밋 게이트가 거부한다"), :149-168. 그런데 양쪽 검출기 커버리지가 서로 어긋나 있다: (a) stateRates — 사람 가드는 actors/classes/enemies의 stateRates 키를 보고 막는다(databaseReferences.ts:183-188, 자체 코멘트: "여기서 안 보면 삭제된 상태 id가 ... 저장본에 영구 잔류한다")인데 로드 검증기 references.ts에는 stateRates 검사가 전혀 없다 → AI는 커밋 게이트를 통과해 상태를 지우고 dangling stateRates 키를 저장본에 영구 잔류시킨다. (b) 반대로 crops(상기 DB-03-1)는 AI는 게이트에 막히지만 사람은 무사통과 → 로드 불가. databaseReferences.ts:49-50의 자기 규약("두 시스템을 중복 검출기로 분리하지 말 것")이 깨진 상태다. 참고: 위키 openwiki/editor-database.md:1119-1139의 '삭제 가드가 all/any/not 묶음까지 본다' 보정은 소스에 실제 반영돼 있다(databaseCommandReferences.ts:238-244, 342-348 재귀 확인) — 이 asymmetry는 그 잔여 문제다. …

**[DB-03-6] (medium) 가상 리스트가 윈도우 이동마다 가시 행 전체를 무키 teardown/rebuild한다 — 키 안정성 제로**
`src/editor/panels/databaseListVirtualizer.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseListVirtualizer.ts:146-153 — "if (next.start === current.start && next.end === current.end && columns === currentColumns) return; ... rowsHost.replaceChildren(...rendered)" — 윈도우가 1행만 이동해도 화면의 모든 행을 renderRow로 새로 만들어 통째로 교체한다(entering/leaving 행만 다루는 diff 없음, key 개념 없음). renderRow는 매번 새 <button>과 새 썸네일을 만든다(databaseRecordViews.ts:576-577, :606 recordListThumbnail; databaseRecordThumbnails.ts:132-142 imageThumbnail이 호출마다 새 <img>/loadProbe) → 임계값(80)을 넘는 컬렉션에서 스크롤 틱마다 가시 창 전체(overscan 포함 수십 개)의 DOM·img가 폐기·재생성되고, 포인터 아래의 행이 이동 중 파괴되어 hover/active 상태와 클릭 경합이 깨진다. 참고로 정렬/재정렬 액션은 레코드 목록에 존재하지 않아(순서는 원본 project 순서, visibleRecordRows가 originalIndex/visibleIndex를 병행 보존 — databaseRecordViews.ts:491-499) 순서 변경 시의 키 불안정은 없다. 수정 제안: dataset.recordId 키 기반 최소 갱신(남는 행 재배치, 들어오는 행만 생성)으로 전환 — testid가 이미 행별 안정 키 역할을 한다.

**[DB-03-7] (medium) 갤러리 모드가 고정 피치 124px을 쓰는데 CSS 유도 카드 높이(~105px+gap)와 불일치 — 스크롤 지표·윈도우가 깊이에 따라 어긋난다**
`src/editor/panels/databaseRecordViews.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/panels/databaseRecordViews.ts:67 (GALLERY_ROW_HEIGHT = 124), :571 (measureRows: !isGallery → 갤러리는 미측정), :570 코멘트("갤러리 카드는 이름 줄바꿈으로 높이가 달라질 수 있어 기존 고정 피치를 유지한다"). 그러나 CSS는 이름 줄바꿈을 금지한다: src/styles/database/light-theme.css:384 (.db-gallery-name에 white-space: nowrap + text-overflow: ellipsis), :346-360 (카드: padding 8px×2 + grid-template-rows: 48px auto auto + gap 4px×2 + border 1px×2 ≈ 105px), :333-336 (rowsHost gap 8px) → 실측 가능한 균일 pitch는 약 113px인데 가상화는 124px을 가정한다. 결과: 스페이서·스크롤맵·윈도우 계산이 행당 ~11px씩 과대 추정 → 레코드가 많은 갤러리일수록 (a) 목록 끝의 유령 스크롤 여백이 길어지고 (b) 깊은 스크롤에서 실제 보이는 행과 계산 윈도우가 어긋나 overscan(8)으로도 못 덮는 빈 구간이 생긴다. 리스트 모드는 바로 이 결함을 measureRows로 고쳤다는 코멘트가 같은 파일 :566-569에 있다. 수정 제안: 갤러리도 measureRows: true로 통일(카드는 nowrap 덕에 균일 높이 — 자체 CSS 계약 충족)하거나 GALLERY_ROW_HEIGHT를 CSS 기준으로 산출.

저심각도 일괄:
- [DB-03-10] (low) 직업이 하나도 없는 프로젝트에서 주인공 추가 시 classId="" 로 생성되어 저장 후 로드가 하드 실패한다 — `src/editor/databaseActions.ts`
- [DB-03-8] (low) updateDatabaseRecord가 무효 편집에도 유령 실행취소 스냅샷을 남기고, 컬렉션에 따라 부재 레코드 처리가 조용한 no-op vs throw로 갈린다 — `src/editor/databaseActions.ts`
- [DB-03-9] (low) reveal 요청이 필터에 가려진 대상이면 조용히 유실된다 — 삭제 후 2단계 확인 안전장치가 무력화되는 경로 — `src/editor/panels/databaseRecordViews.ts`

### 6.4 DB-04 — DB 타입 모델 3자 대조(타입↔폼↔런타임)

**[DB-04-1] (high) 상태 '제한' 드롭다운(행동 불가 등)은 런타임 정규식이 영어라 새 상태에서 아무 효과가 없다**
`src/project/types/database.ts` · 최종 high · 확인 · 확신 high
위치: src/project/types/database.ts:620(restriction?: string) ↔ src/editor/panels/databaseStateRecordView.ts:20,52-54 ↔ src/battle/battleStates.ts:79-82. 폼은 한국어 선택지 RESTRICTION_OPTIONS=["없음","행동 불가","아군에게 공격 불가","스킬 사용 불가","물리 공격 불가"]를 record.restriction에 기록하지만, 런타임 restrictsActionFrom은 /\b(cannot act|stun|sleep|paraly[sz]ed|immobilized)\b/i (battleStates.ts:81)만 검사해 한국어는 절대 매치되지 않는다. 폼 자체 주석(databaseStateRecordView.ts:124-127)도 "온톨로지 텍스트 파싱 경로는 영어 정규식인데 온톨로지 데이터는 한국어라 사실상 죽어 있다 — '제한: 행동 불가' 드롭다운을 골라도 새 상태는 그대로 행동한다"고 인정한다. 참고로 blocksSkillUseFrom(battleStates.ts:86)은 /스킬 사용 불가/ 한국어 분기를 가지므로 같은 드롭다운에서 '스킬 사용 불가'만 동작하고 '행동 불가'는 죽는 비대칭이다. 영향: 하단에 숨은 '전투 규칙 (Gen1 knob)' 패널(runtimeEffects)을 쓰지 않으면 신규 상태의 행동 봉쇄 저작이 조용히 무시된다. 수정: restrictsActionFrom에 /행동 불가/ 분기를 추가하거나, restriction을 enum(예: "none"|"noAction"|"noSkill"|…)으로 바꿔 타입·폼·런타임이 같은 리터럴을 공유하게 한다.

**[DB-04-2] (high) 해제 조건 '전투 종료 후 유지'는 런타임에서 반대로 전투 종료 시 해제된다**
`src/project/types/database.ts` · 최종 high · 확인 · 확신 high
위치: src/project/types/database.ts:619(removalCondition?: string) ↔ src/editor/panels/databaseStateRecordView.ts:19,47-49 ↔ src/battle/battleStates.ts:102-105. removeOnBattleEndFrom은 !/\b(persist|keep|remain)\b/i.test(value) 로 영어만 검사하는데, 폼의 첫 번째 선택지이자 독 온톨로지의 표준값인 "전투 종료 후 유지"(databaseStateOntology.ts:32)는 매치되지 않아 removeOnBattleEnd=true — 유지가 의미인 선택지가 정확히 반대 동작을 한다. 내장 state_poison만 battleStates.ts:103의 id 하드코딩(false)으로 구원되고, 저작자가 만든 유지형 상태는 모두 전투 종료 시 증발한다. 폼의 만능 구원책은 하단 Gen1 knob의 '전투 종료 시 해제' 체크(databaseStateRecordView.ts:154-156)뿐이다. 수정: 한국어 분기(/유지/)를 추가하거나 removalCondition을 리터럴 enum으로 정규화하고 런타임 파싱을 제거하라.

**[DB-04-3] (high) ClassRecord.stateRates/elementRates는 폼에서 편집되지만 전투 런타임은 배우자·적만 읽어 죽은 필드다**
`src/project/databaseRecordModel.ts` · 최종 high · 확인 · 확신 high
위치: src/project/databaseRecordModel.ts:491-494(normalizeClassRecord가 stateRates 기본 {state_death:"C"}, elementRates 기본값 채워 보존) ↔ src/editor/panels/databaseClassRecordView.ts:674-690(직업 폼이 db-picker-class-state-rate-* 로 등급을 편집·저장) ↔ 런타임 소비처 전무. 전투는 battleStates.ts:120-123(actor?.stateRates ?? enemy?.stateRates)과 battlePredict.ts:100-104,2244-2249(enemy?.elementRates ?? actor?.elementRates)만 읽고 classes 는 어디서도 조회되지 않는다(src 전체 .stateRates/.elementRates 소비 grep 결과 battle·editor·model 뿐). 같은 필드인데 기본값도 3자로 갈린다: 액터 {state_death:"C",state_poison:"C"}(actorModel.ts:168-170), 직업 {state_death:"C"}(databaseRecordModel.ts:491-493), 적 {state_death:"C"}(databaseEnemyTroopRecordModel.ts:50-52). 영향: 저작자·AI가 직업 유효도/속성 유효도를 아무리 바꿔도 전투 결과는 0 변화가 없고, 그 사실을 알리는 UI도 없다. 수정: 직업을 배우자 기본 유효도 폴백으로 런타임에 합성하거나, 필드를 타입에서 제거하고 폼 편집기를 비활성화하라.

**[DB-04-4] (high) ItemRecord.equipmentProfile은 런타임이 읽지 않는 editorOnly 필드인데 타입은 필수고 AI 스키마는 전투 효과처럼 노출한다**
`src/project/types/database.ts` · 최종 high · 확인 · 확신 high
위치: src/project/types/database.ts:300(equipmentProfile: ItemEquipmentProfile — 옵셔널 아님) ↔ src/battle/battleBattlers.ts:304-340(장비 효과는 project.database.equipment 레코드만 합산, item.equipmentProfile 미조회) ↔ src/editor/databaseFieldSupport.ts:82-88(프로젝트 자체 레지스트리가 support:"editorOnly", "저장되는 레거시 ItemRecord 저작 정보입니다. 실제 런타임 장비는 장비 데이터베이스에서 저작합니다"). 그런데 src/editor/tools/dbTools.ts:450,368-394의 upsert_item 스키마는 statBonuses/accuracy/criticalRate/stateInflictIds/effectFlags 등 전투 필드군을 editorOnly 경고 없이 그대로 노출한다 — AI가 무기 아이템에 equipmentProfile.statBonuses.attack=50 을 심으면 저장은 되고 전투는 0 변화다. …

**[DB-04-11] (medium) ItemConsumptionLimit의 "noLimit"은 이름과 달리 '1회용'이고 폼은 noLimit과 1을 같은 문구로 표시한다**
`src/project/types/database.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/types/database.ts:333(type ItemConsumptionLimit = "noLimit" | 1..5) ↔ 런타임 src/project/itemTransitions.ts:147-152(finiteLimit: 1..5만 유한 사용횟수, noLimit→undefined→충전 추적 생략=매회 1개 소모), src/player/playerStatusMenuDetails.ts:597(usesPerCopy = noLimit ? 1 : limit) ↔ 폼 databaseItemRecordView.ts:812(noLimit을 "1"로 표시→'매회 1개 소모'). 즉 noLimit≡1이 실질 의미인데 이름은 '무제한'이고, 진짜 무제한은 consumable:false('소모하지 않음')로만 표현된다. noLimit과 1은 저장값은 다른데 표시·동작이 동일해 저작자/AI가 '무제한 사용' 의도로 noLimit을 고르면 1회용 약이 된다. 수정: 타입 리터럴을 1..5 로 축소(레거시 "noLimit"은 로드 시 1로 정규화)하거나 이름을 singleUse 로 바꿔라.

**[DB-04-12] (medium) upsert_item 스키마의 consumptionLimit은 정수만 허용하는데 저장본에는 "noLimit" 문자열이 있어 AI가 기존 값을 그대로 쓰면 거부된다**
`src/editor/tools/dbTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/dbTools.ts:435(consumptionLimit: integerSchema("1..5 or omitted for noLimit")) ↔ 저장 포맷 src/project/types/database.ts:333과 정규화 databaseRecordModel.ts:916-921(normalizeConsumptionLimit이 "noLimit" 문자열을 정식 값으로 수용, 무효값도 "noLimit"로 반환) — 실제 저장본 전체가 "consumptionLimit": "noLimit"로 직렬화된다(project/fixtures/dew-village-demo.json:35196 등 다수). AI가 DB-is-truth로 저장 JSON을 읽고 값을 보존하려 "noLimit"을 그대로 upsert_item에 넘기면 integerSchema 검증에서 실패한다. 스키마와 영속 포맷이 같은 필드를 서로 다른 타입으로 규정한 계약 어긋남이다. 수정: 스키마를 {anyOf:[integer 1..5, enum:"noLimit"]}으로 넓히거나 저장 포맷을 1..5로 정규화하라.

**[DB-04-13] (medium) upsert_item의 farmTool enum은 hoe/wateringCan 2종뿐 — 타입·정규화는 axe/pickaxe 4종을 수용한다**
`src/editor/tools/dbTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/dbTools.ts:451(farmTool: { type:"string", enum:["hoe","wateringCan"] }) ↔ 타입 src/project/types/database.ts:318(FarmTool = "hoe"|"wateringCan"|"axe"|"pickaxe") ↔ 정규화 databaseRecordModel.ts:571(isFarmTool(record.farmTool) — farmModel.ts:5-9가 4종 수용). AI가 도끼/곡괭이 도구 아이템을 upsert_item 으로 만들면 스키마 검증에서 거부되고, 툴 액션(toolActions) 연계 저작이 AI에게 불가능하다. enum이 타입 확장을 따라가지 못한 stale 계약이다. 수정: enum에 axe·pickaxe를 추가하라.

**[DB-04-14] (medium) normalizeCurve는 길이가 99 미만인 직업 파라미터 커브를 통째로 기본 커브(20+4i)로 교체해 저작값을 조용히 버린다**
`src/project/databaseRecordModel.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/databaseRecordModel.ts:685-688(if (curve && curve.length >= ACTOR_LEVEL_MAX) slice…; else Array.from({length:99},(_,i)=>20+i*4)). ACTOR_LEVEL_MAX=99(actorModel.ts:21). 50레벨용으로 50칸만 저작한 커브나 AI가 짧게 보낸 커브는 검증 실패도 경고도 없이 제네릭 기본 커브로 덮인다 — 데이터 유실이다. 배우자 쪽 actorModel.normalizeCurve는 키별 보간 기본값을 채우는 별도 구현이라 같은 개념 필드에 정규화 계약이 2종이다. 수정: 짧은 커브는 마지막 값으로 연장(clamp)하거나 검증 에러를 내고, 두 normalizeCurve를 하나로 합쳐라.

**[DB-04-15] (medium) clampInteger가 비유한 값(NaN)을 기본값 대신 최솟값으로 바꿔 위력 -9999 같은 극단 레코드를 만든다**
`src/project/databaseRecordModel.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/databaseRecordModel.ts:923-926(if (!Number.isFinite(value)) return min). normalizeSkillRecord 512행 power: clampInteger(record.power ?? 10, -9999, 9999) — 손으로 편집된 JSON의 "power": "abc" → Math.trunc("abc")=NaN → 기본 10이 아니라 -9999가 저장된다. 같은 패턴이 seedParameterBonuses(-50), equipmentProfile 보정(-500), movePriority(-7), ClassPromotionRequirement.atLeast(-999999) 등 음수 하한 필드 전체에 적용된다. 영향: 오타 하나가 즉사급 음수 위력/스탯으로 저장되고, 로드 검증(shapeDatabaseFields.validateDatabase는 행 내부를 검사하지 않음)도 잡지 못한다. 수정: clampInteger에 fallback 인자를 두어 비유한 값은 필드 기본값으로 스왑하라.

**[DB-04-16] (medium) elements/terrains/battleCommands를 빈 배열로 저작하면 정규화가 기본 카탈로그를 되살려 빈 상태를 표현할 수 없다**
`src/project/databaseUtilityRecordModel.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/databaseUtilityRecordModel.ts:13-14(const source = records?.length ? records : defaultElementRecords()), 동일 패턴 28-29(terrains), 50-51(battleCommands) ↔ 호출 src/project/databaseRecordModel.ts:120-122. undefined와 []를 구분하지 않아 저작자가 속성·지형·전투커맨드를 전부 지워 []로 저장하면 다음 normalize/save 라운드트립에서 기본 12+속성·지형·커맨드가 부활한다(의도한 '속성 없음 프로젝트' 불가, AI가 []를 쓰면 조용히 되돌아옴). 검증 쪽 shapeDatabaseFields.ts:72-74는 빈 배열을 그대로 통과시켜 두 계약이 어긋난다. 추가로 16-18행 filter가 id/name 없는 행을 경고 없이 버린다. 수정: undefined만 기본값 채움 대상으로 하고 []는 존중하거나, 빈 카탈로그를 금지한다면 검증에서 hard-fail 하라.

**[DB-04-17] (medium) normalizeTypeChart가 32번째 이후 타입과 그 배율 행·열을 경고 없이 삭제한다**
`src/project/databaseRecordModel.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/databaseRecordModel.ts:275(uniqueCleanIds(chart?.types).slice(0, 32)), 277-283(kept 타입만으로 multipliers 재구성 — 잘린 공격자의 행과 피공격자 열이 함께 소실) ↔ 로드 검증 src/project/io/shapeDatabaseFields.ts:150-154는 개수 상한을 검사하지 않음. 33종 이상 타입표를 손편집/AI로 넣으면 저장 순간 데이터가 조용히 유실되고 validateSystem은 통과한다. 수정: 검증 단계에서 32 초과 시 hard-fail 하거나 상한을 상향하고 폼에 개수 표시를 추가하라.

**[DB-04-5] (medium) ItemRecord.occasionField/occasionBattle/onlyUsableInMenu는 런타임 게이팅이 occasion 단일 출처라 죽은 이중 필드다**
`src/project/types/database.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/types/database.ts:281,291,297-298 ↔ 런타임 게이팅 src/project/itemUsage.ts:26-36(itemAllowsMenu/itemAllowsBattle 모두 item.occasion 만 검사) ↔ 소비처 없음 확인. occasionField와 onlyUsableInMenu는 src/player·src/battle 어디에서도 읽히지 않는다(grep 전수). occasionBattle의 유일한 독자 battleCommandDom.ts:449-450도 449행이 occasion field/never를 먼저 차단하므로 450행(occasionBattle===false 분기)은 도달 불가능한 죽은 논리다. 폼은 databaseItemRecordView.ts:315-318에서 세 값을 occasion 파생값으로 같이 쓰고, AI 스키마(dbTools.ts:441,447-448)는 세 개를 독립 boolean으로 노출해 occasion:"never"+occasionField:true 같은 모순 쌍을 허용한다(정규화 databaseRecordModel.ts:567-568은 키가 이미 있으면 보존하므로 모순이 영속된다). 영향: AI·저작자가 onlyUsableInMenu:true 로 '메뉴 전용'을 만들려 해도 실제 게이팅은 occasion 뿐이라 무시된다. 수정: 파생 3필드를 타입·스키마에서 제거하고 occasion 단일 출처로 정리하라.

**[DB-04-6] (medium) 상태 폼 '상태 유효도'에 표시되는 등급 확률(A:90/B:70/C:50)이 런타임 적용 확률(A:100/B:80/C:60)과 다르다**
`src/project/ontology/databaseStateOntology.ts` · 최종 medium · 확인 · 확신 high
위치: 폼 표시 src/editor/panels/databaseStateRecordView.ts:225-233(value: `${ontology.rates[grade]}%`, readonly) ↔ 표시값 databaseStateOntology.ts:28 DEFAULT_RATES={A:90,B:70,C:50,D:30,E:0} ↔ 런타임 적용 actorModel.ts:33-39 ACTOR_STATE_RATE_PERCENTAGES={A:100,B:80,C:60,D:30,E:0} 를 battleStates.ts:122-123,160-161(stateResistancePercent→chance=(effect.chance×resistance)/100)이 소비. 같은 A–E 등급 개념을 편집기는 50%로, 전투는 60%로 해석한다. 배우자/적 유효도 등급을 고를 때 보이는 유일한 백분위 안내가 틀린 숫자다. 수정: 두 상수 중 하나로 통일하거나 폼 표시를 stateRatePercentage(ACTOR_STATE_RATE_PERCENTAGES)로 바꿔라.

**[DB-04-7] (medium) hpReleaseTurn의 부호 의미가 3자로 갈라진다 — 폼 표시 '+8'(회복)을 다시 입력하면 런타임은 흡수가 아니라 피해 8%로 처리한다**
`src/project/types/database.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/types/database.ts:627-630(hpReleaseTurn 등 number) ↔ 폼 src/editor/panels/databaseStateRecordView.ts:80-93('전투 중(턴당%)' min:-100..100, 표시값은 numericRelease가 온톨로지 텍스트 '+8%'에서 8을 추출, 109-115) ↔ 런타임 src/battle/battleStates.ts:45-51(hpDamagePercentFrom: record→"8" bare 매치→Math.abs → 항상 피해) — 회복은 runtimeEffects.hpHealPercentPerTurn(types/database.ts:640) 전용으로만 가능. 재생(state_regen, 온톨로지 hpTurn "매 턴 최대 HP의 +8%", databaseStateOntology.ts:244)처럼 폼이 +8로 보여주는 값을 재입력하면 record.hpReleaseTurn=8 → 런타임 피해 8%/턴이 되고(명시 runtimeEffects가 있으면 피해+회복 동시 발생), 음수 -6도 abs로 피해 6이라 부호 입력은 아무 의미가 없다. 위키 openwiki/state-system.md:47의 "회복은 음수 피해로 표현하지 않는다" 계약과 폼의 -100~100 허용 범위가 모순된다. 수정: HP 패널 필드를 0..100(피해 전용)으로 제한하거나, 온톨로지 +값 상태의 표시를 '런타임 미사용(참고값)' readonly 로 바꿔라.

**[DB-04-8] (medium) StateRecord.accuracyModifier는 폼은 0..100으로 제한하지만 정규화·AI 툴은 무경계로 통과시켜 런타임 명중 배율이 폭주할 수 있다**
`src/project/types/database.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/types/database.ts:622 ↔ 폼 databaseStateRecordView.ts:56-60(numberField min 0 max 100, 라벨은 '성공률'인데 런타임 의미는 일반공격 명중률 배율) ↔ 정규화 databaseRecordModel.ts:76(optionalNumber로 유한성만 확인, 클램프 없음 — 주석 61-63은 '타입만 정규화'라 명시) ↔ AI 스키마 dbTools.ts:634(accuracyModifier: integerSchema() — 설명·범위 없음) ↔ 런타임 src/battle/runtime.ts:2216-2218(rate *= state.accuracyModifier/100). AI가 accuracyModifier:500 을 upsert_state 로 넣으면 저장되고 일반 공격 명중률이 5배가 된다. 폼 라벨 '성공률'도 실제 단위(명중률 보정 %, 100=변화 없음)와 이름이 어긋난다. 수정: dbTools 스키마에 "0~100, 100=변화 없음" 기술을 넣고 폼 라벨을 '명중률 보정(%)'으로 고치며 normalize에서 상한을 검토하라.

**[DB-04-9] (medium) normalizeStateRecord가 runtimeEffects를 무검증 통과시켜 비객체·비정형 값이 저장본에 영속된다**
`src/project/databaseRecordModel.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/databaseRecordModel.ts:87(...(record.runtimeEffects !== undefined ? { runtimeEffects: record.runtimeEffects } : {})) — 주석(61-63)은 "타입만 정규화한다"고 하지만 runtimeEffects는 타입 검증조차 없다. "string" 같은 비객체도 그대로 저장되고, 이후 런타임 battleStates.ts:65-72의 runtime?.restrictsAction 등 옵셔널 체인이 조용히 undefined로 폴백해 저작값이 소실된다. 숫자 필드(hpDamagePercentPerTurn 등)도 폼은 0..100/스텝 0.05(databaseStateRecordView.ts:136-152)로 제한하지만 정규화는 무제한이다. AI 스키마(dbTools.ts:410-419)도 numberSchema() 무경계. 수정: runtimeEffects에 객체 가드 + 필드별 클램프(또는 화이트리스트 재구성)를 넣어 '단일 정규화 계약' 주석과 실제를 일치시켜라.

**[DB-04-19] (low) 같은 'gold' 필드가 검증 경로별로 상한이 3종으로 갈라진다(bundles 무상한 vs museum P2_COUNT_MAX vs spatial GOLD_MAX)**
`src/project/io/shapeDatabaseFields.ts` · 최종 low · 보류 · 확신 high
위치: src/project/io/shapeDatabaseFields.ts:445(validateBundles — reward.gold: assertNonNegativeNumber, 상한 없음) vs 325(validateBundleReward — museum reward.gold: 0..P2_COUNT_MAX) vs 630(validateSpatialCost — gold: 0..GOLD_MAX). 동일 개념의 경제 수치인데 어느 경로로 들어오느냐에 따라 허용 상한이 달라 무결성 기준이 흔들린다. normalize 쪽(normalizeBundleDefinitions 등)도 경로별 상한 불일치가 그대로 저장된다. 수정: economyValues.GOLD_MAX 단일 상수로 세 경로를 통일하라.
> 보류 사유: 경로별 불일치 자체는 실측: bundles의 reward.gold는 assertNonNegativeNumber(상한 없음, ~445)인 반면 museum은 0..P2_COUNT_MAX(325), spatial은 0..GOLD_MAX(630). 그러나 '상한 3종 갈라짐'은 과장 — P2_COUNT_MAX와 GOLD_MAX는 모두 9_999_999로 동일한 값(p2FoundationRecords.ts:21, economyValues.ts:2)이라 실질 구분은 '무상한 bundles vs 9,999,999' 두 종류이다. …

저심각도 일괄:
- [DB-04-10] (low) 상태 배율 입력은 폼 0..10인데 런타임은 곱셈 합산 후 0.4~2.5로 클램프 — 폼 값이 조용히 잘린다 — `src/editor/panels/databaseStateRecordView.ts`
- [DB-04-18] (low) normalizeSystemRecords는 battleFlow만 기본값(gauge)도 항상 저장해 형제 필드의 omit-when-default 정책을 깬다 — `src/project/databaseRecordModel.ts`
- [DB-04-20] (low) 로드 검증은 actor.initialEquipment 슬롯만 검사하고 database.equipment 행의 slot은 전혀 검사하지 않는다 — `src/project/io/shapeDatabaseFields.ts`
- [DB-04-21] (low) 위키 정본의 StateRecord 위치 포인터(database.ts:562)가 실제(612)로 밀려 있다 — `openwiki/state-system.md`
- [DB-04-22] (low) 속성 kind가 무효하면 정규화가 조용히 'magical'로 바꿔 피해 라우팅(defense→mind)이 뒤집힌다 — `src/project/databaseUtilityRecordModel.ts`
- [DB-04-23] (low) StateRecord의 옵셔널(스파스) 필드들이 폼에서 한 번 건드리면 '상속 해제'가 불가능한 필수 override로 굳는다 — `src/project/types/database.ts`

### 6.5 DB-05 — 필드 셰이프·마이그레이션·백업

**[DB-05-1] (medium) v1→v2 마이그레이션이 sanitize 충돌로 서로 다른 플래그를 같은 스위치 id로 병합한다(조용한 논리 붕괴)**
`src/project/io/migration.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/migration.ts:31-35, src/project/io/guards.ts:37-39. 증거: migrateV1toV2가 `switches = Object.keys(project.flags).map((flag) => { const id = `sw_${sanitize(flag)}`; ... })`로 v1 플래그 이름을 스위치 id로 바꾸는데, sanitize는 `name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) || "x"` — 한글 전부가 `_`로 붕괴되고 24자에서 절단된다. 따라서 같은 길이의 한글 플래그(예: "문열림"과 "불켜짐" → 둘 다 `sw___`), 또는 "gold>=100"과 "gold 100"(→ `sw_gold_100`)이 서로 다른 v1 플래그임에도 동일한 스위치 id로 수렴하고, flagToSwitch 맵은 원래 이름별로 별개 엔트리를 만들지만 id가 같으므로 migrateConditionV1(migration.ts:349-359)·migrateCommandV1(migration.ts:377-382)이 만든 조건·setSwitch가 전부 같은 스위치를 읽고 쓴다. …

**[DB-05-10] (medium) 스위치·변수 정의에는 id 유일성 검사가 없다 — 다른 모든 컬렉션은 중복 id를 검사하는데**
`src/project/io/shapeResourceFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeResourceFields.ts:417-431. 증거: `validateSwitches`는 각 정의에 `requireString(id)`, `requireString(name)`만 수행하고, `validateVariables`도 동일하다. 대조하면 참조 검사기(src/project/io/references.ts)는 훨씬 사소한 컬렉션에도 중복 id 검사를 두고 있다 — endings(349-351), crops(684-686), lifeSkills(701-704), craftRecipes(707-710), itemUpgrades(717-720), sellPrices(728-731), toolActions(734-737). switches/variables는 그 어떤 계층(shape/references/store)에서도 정의 id 중복을 검사받지 않는다(ensureDefinitionSlots—blankProject.ts:60-72—도 기존 defs 중복을 정리하지 않음). 영향: 스위치·변수 정의는 이벤트 조건·setSwitch·스위치 아이템(itemSwitchDefs.ts:30이 id Set으로 판정)·보상 지급(bundles.ts:126)의 1차 키라서, 중복 정의가 들어오면 피커가 같은 id를 두 줄로 보여주고 하나를 지우면 나머지가 남는 등 UI 상태가 어긋난다. DB-05-1의 마이그레이션 충돌도 이 빈틈 때문에 로드에서 잡히지 않는다. 수정 제안: validateSwitches/validateVariables에 seen-Set 중복 assert 추가.

**[DB-05-11] (medium) 구버전 DB 잔재 수복(rateKeys·재생 불가 BGM)이 생성 경로에만 연결돼 있고 로드 경로에는 없다 — 구·신 프로젝트가 서로 다른 상태로 드리프트**
`src/project/io/migration.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/migration.ts:142-149(migrateV3toV4가 하는 일은 얼굴 짝 재작성뿐), src/project/io/shape.ts:76-89(로드 검증·수복 체인에도 DB 잔재 수복 없음). 증거: repairLegacyRateKeys(src/project/defaults/legacyRateKeyRepair.ts:52-57 — "역직렬화는 성공하고... projectLint가 error 35건을 내뿜어 진짜 오류를 덮는다")와 repairUnplayableSystemBgm(src/project/defaults/legacyAudioRepair.ts:39 — 시스템 BGM 슬롯의 재생 불가(MIDI) 참조 교체)은 오직 프로젝트 생성 경로에만 연결돼 있다: blankProject.ts:112,114와 defaultProject.ts:70,72. 로드 정규화 체인(store.ts:1453-1463: mapTreeCoverage, switchVariableSlots, bundledTilesets, interiorPropLayers, legacyRmTileset, legacySpriteRefs, bundledResourceProfiles, databaseIconResources, bundledBattleAnimations)에는 둘 다 없고, deserialize/migrateV3toV4에도 없다. …

**[DB-05-12] (medium) partyActorIds·startActorIds의 죽은 참조가 프로젝트 전체 로드를 막는다 — 코드베이스 고유의 "죽은 참조로 로드를 막지 않는다" 원칙과 충돌**
`src/project/io/shapeDatabaseFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeDatabaseFields.ts:514-526(validateSession은 `requireArray("session.partyActorIds", ...)`로 배열 존재만 확인), src/project/io/references.ts:34-36, 209, 215. 증거: `validateProjectReferences`는 `assert(issues.length === 0, issues.join("\n"))`로 모든 참조 문제를 로드 실패로 전환하며, 그중 `collectExistingIdIssues("session.partyActorIds", ..., actorIds, ...)`(215행)와 `"system.startActorIds"`(209행)가 죽은 액터 참조를 잡는다. 수복(repairProjectReferences)은 transfer/changeTile 등 명령 참조는 pruning으로 살려두면서(references.ts:390-392, 1455-1457) 파티·시작 액터 참조는 정리하지 않는다. 이는 같은 저장소가 스스로 정한 원칙과 충돌한다: shapeReferenceFields.ts:39-41 — "로케이션 ID의 실재 여부는 검사하지 않는다 — 삭제된 구역을 가리키는 저장본이 로드를 막아 버리면 사용자가 고칠 수단이 사라진다. 그 상태는 projectLint의 map-location-missing-ref가 올린다". 영향: DB에서 액터가 삭제된 상태(손편집·AI 생성 JSON·부분 동기화)로 파티 멤버가 남은 프로젝트는 편집기를 열지 못한 채 ProjectFormatError로 죽는다 — 사용자에게는 '고칠 수단이 사라진' 상태 그 자체다. …

**[DB-05-2] (medium) migrateV2toV3가 v2 저장본의 storyFlags(스토리 플래그 정의)를 통째로 누실한다**
`src/project/io/migration.ts` · 최종 medium · 보류 · 확신 medium
위치: src/project/io/migration.ts:96-128, 대조 src/project/io/shape.ts:61. 증거: validateProjectV2는 v2 저장본의 storyFlags를 명시적으로 검증한다 — `validateStoryFlags(data.storyFlags, idSet(data.switches), idSet(data.variables))`(shape.ts:61). 즉 v2 와이어 포맷에 storyFlags가 실려 있음을 로더 자체가 전제한다(스토리 플래그를 도입하던 시절 version 2 저장본이 실존함을 뜻한다 — 이 저장소의 문서화된 관행이 "필드 추가 시 SCHEMA_VERSION 미인상"이기 때문이다. openwiki/runtime-project-schema.md:669 "SCHEMA_VERSION is not bumped"). 그런데 migrateV2toV3는 객체를 필드 나열식으로 새로 만들면서(version, meta, assets, resourceProfiles, tilesets, switches, variables, commonEvents, database, system, session, maps, mapConnections, mapTree, startMapId, startPos, flags) storyFlags를 전달하지 않는다. validateProjectV2가 cloneJson<ProjectV2>(data)(shape.ts:70)로 런타임 객체에 보존해 넘겨도 마이그레이션이 버린다. 영향: v2 저장본을 오늘 열면 스토리 플래그 레지스트리 전체가 조용히 삭제되고, 위키(runtime-project-schema.md:149)대로 로드 직후 마이그레이션 오토세이브가 즉시 v4로 영속화해 복구 불가능한 데이터 유실이다. …
> 보류 사유: migrateV2toV3의 필드 나열식에서 storyFlags 누락(migration.ts:96-128), Project.storyFlags optional(project.ts:665), changeAreas.ts:55·projectLint.ts:592 사용은 실측으로 맞다. 그러나 validateStoryFlags는 'if (value === undefined) return;'(shape.ts:202)로 선택적 검사라 'v2 와이어가 storyFlags를 전제한다'는 전제는 과장이고, v2 시절 파일에 storyFlags가 실렸다 …

**[DB-05-3] (medium) 마이그레이션 사슬 전체가 SCHEMA_VERSION 상수에 경직돼 있어 버전 상승 시 구버전 저장본이 미래 마이그레이션을 조용히 건너뛴다**
`src/project/io/migration.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/migration.ts:99, 147; src/project/io/serialize.ts:57-62. 증거: migrateV2toV3가 "v3 파이프라인" 중간 객체에 `version: SCHEMA_VERSION`(=4)을 스탬프하고, migrateV3toV4도 `upgraded.version = SCHEMA_VERSION`으로 마감한다. serialize의 디스패처는 구버전을 리터럴로(`if (version === 1)`, `version === 2`, `version === 3`) 부르고 현재 버전만 상수로(`if (version === SCHEMA_VERSION) return validateProjectV4(data)`) 부른다. 함수명은 V3toV4/V2toV3/V1toV3로 고정돼 있는데(io.ts:4) 반환 version은 이동하는 상수다. 영향: SCHEMA_VERSION이 5로 오르는 순간 — (a) version 5 저장본은 validateProjectV4만 거치고(v4→v5 마이그레이션 단계가 없어도 통과), (b) version 3 저장본은 migrateV3toV4가 아무 v5 보정 없이 `version: 5`를 스탬프해 내보내고, (c) v1/v2 사슬도 동일 — 즉 구버전 저장본이 미래의 v5 마이그레이션을 전부 건너뛰게 된다. "기본 레코드/필드 보정이 언제 실행되는가"가 버전 상수 값에 기생하는 구조라, 지금은 4로 우연히 맞아 돌아갈 뿐 드리프트가 내재돼 있다. …

**[DB-05-6] (medium) 명령 kind 약 19종이 셰이프 검증을 전혀 받지 않는다(default: return) — 필수 페이로드 garbage가 로드를 통과한다**
`src/project/io/shapeCommandFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeCommandFields.ts:441-443(`default: return;`), src/project/commandKindRegistry.ts:13-93. 증거: validateCommandShape의 switch는 registry의 80종 중 약 61종만 다루고, 나머지는 `default: return`으로 전부 무겁게 통과한다. 미검증 kind: text, wait, inputWait, label, gotoLabel, breakLoop, timer, changeTile, callCommonEvent, callMapEvent, changeParty, showPicture, erasePicture, playAudio, stopAudio, gameOver, ending, returnToTitle, setFlag. 이 중 다수는 타입 모델상 필수 페이로드가 있다 — `showPicture`은 `{ pictureId: string; resourceId: string; x: number; ... }`(src/project/types/events.ts:391-395), `changeParty`는 `{ actorId; action: "add"|"remove" }`(events.ts:376), `callCommonEvent`는 `{ commonEventId: string }`(events.ts:324), `wait`는 `{ ms: number }`(events.ts:285).  …

**[DB-05-7] (medium) changeLifeSkillExp 검증만 ProjectFormatError가 아닌 raw Error를 던져 형식 오류 처리 계약을 깬다**
`src/project/io/shapeCommandFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeCommandFields.ts:178. 증거: `case "changeLifeSkillExp": ... if (command.op !== "=" && ...) throw new Error(`${label}.op must be =, +=, or -=`)` — 이 파일(및 io 전역)의 모든 형식 오류는 ProjectFormatError를 던진다(errors.ts:1-6, guards.ts의 require* 전부), 유일하게 이 줄만 raw Error다. 영향: ProjectFormatError만 골라 우아하게 처리하는 호출부 13곳이 이 오류를 "형식 오류"로 인식하지 못한다 — src/editor/panels/audioDescriptionEditor.ts:201(`if (!(error instanceof ProjectFormatError)) throw error;`), src/editor/tools/applyChangesetToStore.ts:336(같은 패턴 — AI changeset 적용기에서 raw Error는 재던져져 툴 호출이 비정상 종료한다), src/editor/panels/menu.ts:1119-1121(가져오기 실패 토스트가 이유 없이 "가져오기 실패"만 표시), src/player/oprnGameFile.ts:47(플레이어가 "게임 데이터를 읽을 수 없습니다" 접두사를 붙이지 못함) 등. changeLifeSkillExp 명령의 op가 잘못된 프로젝트는 사용자에게 디버깅 불가한 제네릭 실패로 보인다. 수정 제안: `throw new ProjectFormatError(...)`로 교체(한 단어 수정).

**[DB-05-8] (medium) 이벤트 id·이벤트 페이지 id의 중복을 검사하지 않는다 — 같은 파일의 다른 id 컬렉션은 전부 검사하는데**
`src/project/io/shapeEventFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeEventFields.ts:365-383(validateEventShape), 433-491(validatePageShape). 증거: validateEventShape는 `requireString(`${label}.id`, event.id)`로 존재만 보고 같은 맵 안의 이벤트 id 중복을 검사하지 않고, validatePageShape도 `requireString(`${label}.id`, page.id)` 후 페이지 id 중복을 검사하지 않는다. 반면 같은 파일의 다른 id 컬렉션은 전부 유일성을 강제한다 — 맵 명명 로케이션(`assert(!seen.has(locationId), ...: id가 중복입니다", 240행)`, 보존 기획 항목(192행 "id가 중복되었습니다"), 로그라이크 슬롯·선택(147행, 157행). 영향: 중복 이벤트 id는 callMapEvent/이벤트 타깃 해석(callMapEvent는 eventId로 탐색), AI 툴의 이벤트 지정 변경을 모호하게 만들고 첫 번째 매치가 조용히 승자가 된다. 중복 페이지 id는 이벤트 편집기의 페이지 선택·페이지 지정 변경이 엉뚱한 페이지를 고친다. 손편집·AI 생성·레거시 JSON에서 실제로 도달 가능하며 로드는 성공하므로 문제는 훨씬 뒤에서 드러난다. 수정 제안: validateMaps가 맵별 event id Set을, validateEventShape가 페이지 id Set을 돌며 중복 assert를 추가(같은 파일의 기존 패턴 그대로).

**[DB-05-9] (medium) validateMapTree가 루트를 임의의 맵으로 조용히 교체하고 미지 자식을 조용히 버린다(무경고 저작 데이터 재작성)**
`src/project/io/shapeReferenceFields.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/shapeReferenceFields.ts:10-16. 증거: `const fallbackMapId = knownMapIds.values().next().value as string | undefined; const mapId = knownMapIds.has(rawMapId) ? rawMapId : fallbackMapId;` — 저장된 루트 mapId가 maps에 없으면 트리 루트가 JSON 키 순서상 첫 번째 맵으로 조용히 교체되고, `children`에서 `knownMapIds`에 없는 자식은 `.filter((child) => knownMapIds.has(child.mapId))`로 조용히 탈락한다. 어느 쪽도 경고를 내지 않는다. 같은 저장소의 수복 관례는 "고쳤으면 말한다"다 — repairTerms는 `console.warn("[project] 문자열이 아닌 용어 필드 N개를 삭제하고 로드했습니다")`(shapeResourceFields.ts:45-51)를, store 정규화는 appliedNormalizers 라벨로 변경 이력을 남긴다(store.ts:1466-1473). 또한 이 파일 스스로 로케이션 참조에는 "삭제된 구역을 가리키는 저장본이 로드를 막아 버리면 사용자가 고칠 수단이 사라진다"(39-41행)는 원칙을 밝히며 로드 차단을 피하지, 맵 트리에서는 반대로 사용자 몰래 데이터를 고쳐버린다. 영향: 맵 트리(폴더 구조·순서)는 저작 데이터인데, 리모트/손상 저장본에서 루트 교체·자식 탈락이 발생해도 사용자는 프로젝트를 열어보기 전까지 알 수 없고 되돌릴 근거도 없다. 수정 제안: 교체·탈락 건수를 warn으로 출력하거나 수복 리포트에 남기고, 가능하면 원본 rawMapId를 보존해 lint가 진단하게 할 것.

**[DB-05-4] (low) 백업 복구가 검증·정규화·참조 수복·마이그레이션을 전부 우회한다**
`src/project/io/backup.ts` · 최종 low · 보류 · 확신 high
위치: src/project/io/backup.ts:18-23. 증거: `restoreProjectBackup(backup)`은 `backup.schemaVersion !== SCHEMA_VERSION`일 때만 throw하고, 그 외에는 `return deepClone(backup.project)` — deserialize가 하는 일(validateProjectV4 셰이프 검증, normalizeProjectV4 정규화, repairProjectReferences/validateProjectReferences — shape.ts:76-89)을 하나도 하지 않고 프로젝트를 그대로 되돌린다. 반면 저장소 전체가 "디스크에서 읽힌 JSON은 복구를 거쳐야 한다"는 계약 위에 서 있다: 로드 경로에는 repairStoredLoadFoundation(loadRepair.ts:36-45, 아이템/스킬/애니메이션/리소스 프로필 수복)과 store 정규화 체인(store.ts:1453-1463)이 존재한다. 또한 버전 불일치 시 `ProjectFormatError("백업 스키마 버전 불일치")`로 죽는데, deserialize에는 v1/v2/v3 마이그레이션 체인이 있는 반면 백업에는 마이그레이션 경로가 전혀 없다 — 백업이 세션을 넘거나 저장돼 있다면 버전 상승과 동시에 영구 복구 불가능해진다. 영향: 백업 복구로 주입된 프로젝트는 로드 검증을 우회해 store.current로 들어가므로, 복구 시점의 정규화 규칙 변화(신규 필수 필드, 화이트리스트 정규화 등)가 전부 적용 누락된 상태로 편집·저장된다. …
> 보류 사유: restoreProjectBackup이 schemaVersion 비교 외 아무 검증·정규화·수복·마이그레이션 없이 deepClone만 반환하는 것(backup.ts:18-23)과 deserialize 체인(shape.ts:76-89) 대조는 정확하다. 그러나 전역 grep에서 호출부는 test 3곳뿐이므로 'store.current로 주입되어 편집·저장된다'는 영향 서사는 현재 도달 불가 — 실害가 이론적이라 low로 조정.

저심각도 일괄:
- [DB-05-13] (low) elements/terrains/battleCommands는 셰이프 검증에서 옵셔널인데 정규화는 빈 배열을 기본 카탈로그로 되살려 계약이 어긋난다 — `src/project/io/shapeDatabaseFields.ts`
- [DB-05-14] (low) 이벤트 페이지 priority가 문자열 존재만 검사되고 열거값 검사가 없다 — 같은 함수의 movement.type·trigger는 전부 화이트리스트 검사를 받는데 — `src/project/io/shapeEventFields.ts`
- [DB-05-15] (low) maps 레코드 키와 map.id의 불일치를 검사하지 않는다 — 키 기준 해석(idSet/Object.keys)과 id 기준 해석이 갈라진다 — `src/project/io/shapeEventFields.ts`
- [DB-05-5] (low) ProjectBackup API는 프로덕션 호출부가 없는 죽은 계약 — 실제 백업 경로와 표면이 어긋난다(AI 오인 유발) — `src/project/io/backup.ts`

### 6.6 DB-06 — 참조 무결성·검증 유틸

**[DB-06-1] (critical) 이벤트 삭제 시 farmAnimals.eventId 댕글링 — 검증은 하드 게이트인데 수리·삭제 가드 모두 없어 저장/로드 벽돌**
`src/project/io/references.ts` · 최종 critical · 확인 · 확신 high
위치: src/project/io/references.ts:804-806(검증), 862-879(repairFarmAnimalReferences). 검증은 `if (animal.eventId && !eventIds.has(animal.eventId)) issues.push("session.farmAnimals[" + index + "].eventId does not exist: " + animal.eventId)` 로 하드 이슈를 보고하지만, repairFarmAnimalReferences는 speciesId(868행 filter)와 buildingId(withoutFarmAnimalBuilding, 870-878행)만 치유하고 eventId는 손대지 않는다. 반면 맵 삭제 cascade는 이 축을 명시적으로 해제한다(src/project/mapDeletion.ts:188-208, removedFarmAnimalEventIds로 eventId 제거). 그런데 단일 이벤트 삭제엔 cascade가 없다: src/editor/eventActions.ts:64-71 deleteEvent는 `m.events = m.events.filter(...)` 만 하고 확인 대화상자(src/editor/eventDeletion.ts:64-72)에도 농장 동물 언급이 없다. …

**[DB-06-2] (critical) living destination switchId — 로드 검증은 assert하는데 수리는 mapId만 자르고 스위치 삭제 가드는 이 축을 안 봐서 삭제 한 번에 저장/로드 벽돌**
`src/project/io/references.ts` · 최종 critical · 확인 · 확신 high
위치: 검증은 src/project/io/commandReferenceValidation.ts:51-53 `assert(context.switchIds.has(destination.switchId), "page ... living destination switchId does not exist")`. 수리는 src/project/io/references.ts:494-509 repairLivingDestinations인데 `living.destinations.filter((destination) => mapIds.has(destination.mapId))` — mapId 축만 잘라내고 switchId 축은 그대로 둔다. 삭제 가드는 이 참조축을 아예 못 본다: src/editor/databaseCommandReferences.ts:118-143 switchVariableReferencedInProject가 순회하는 것은 commonEvents(conditionSwitchId+commands)·맵 이벤트(조건+commands)·트룹 전투 페이지뿐이고, src/editor/databaseReferences.ts:313-332 switchVariableReferenceMessage도 items/skills/lifeSkills/worldUnlocks/bundles+이벤트 스캔뿐이라 living destinations가 없다. …

**[DB-06-3] (critical) prune_unused(AI 도구)가 참조되는 아이템/트룹/적을 «미사용»으로 오판·삭제 — 데이터 유실 후 저장/로드 전면 차단**
`src/editor/tools/refactorTools.ts` · 최종 critical · 확인 · 확신 high
위치: src/editor/tools/refactorTools.ts:404-419 findUnused + 436-447 apply. 수집기 collectReferences(109-153)의 items 축은 changeItem/shop(itemIds+stock)/enemy dropItemId/세션 인벤토리/조건 item(fork·페이지)·giftPrefs(이벤트만) 뿐이다. 그러나 로드 검증기(src/project/io/references.ts)가 하드 참조로 단unes 아이템 축은 훨씬 많다: crops seed/harvest(687-688), fishSpecies itemId(239), farmAnimalSpecies feed/product(755-760), farmBuildingTypes cost(911-914), homeDecorationTypes placementItemId(923-925), craftRecipes(710-713), itemUpgrades(720-724), sellPrices(731), toolActions(737), shipping(299), bundles(306-307), makers(315-316), seasonalForage(256-259), collections/museum(262-266), promotions requires.itemId(560), monsterSpecies evolution itemId(671), characters giftPrefs(1318-1326).  …

**[DB-06-10] (high) AI 도구 delete_craft_recipe가 UI 삭제 가드(번들·생활기술 보상 참조 차단)를 우회한다 — 위키 L170 주장이 AI 경로에서는 성립하지 않음**
`src/editor/tools/lifeEconomyTools.ts` · 최종 high · 확인 · 확신 high
위키 검증 산출(openwiki/editor-validation.md L170: «editor delete guard도 item/switch와 bundle reward가 참조하는 recipe/worldUnlock 삭제를 같은 범위에서 차단한다» 재검증). UI 가드는 실제로 존재한다: src/editor/panels/databaseLifeCraftingView.ts:1101-1104 «꾸러미 '...'의 보상이 이 제작법을 사용 중입니다», 1179-1183(생활 기술 레벨 보상·bundle reward recipeId 차단). 그러나 같은 삭제를 수행하는 AI 도구 delete_craft_recipe(src/editor/tools/lifeEconomyTools.ts:145-164)는 `draft.system.craftRecipes = next.filter(...)` 전에 bundle reward(recipeIds)·lifeSkill levelUpRewards(recipeId) 참조를 전혀 검사하지 않는다. 영향: AI가 제작법을 삭제하면 도구는 성공을 반환하고, 남은 `system.bundles[].reward.recipeIds`·`lifeSkills[].levelUpRewards[].recipeId` 댕글링이 references.ts:312·323-325 검증에서 하드 이슈가 되어 다음 저장(mapPatch.ts:93)이 실패한다. 사용자 입장에선 «AI가 뭔가 한 뒤 저장이 막힌» 원인 불명 상태가 된다. …

**[DB-06-11] (high) 삭제 가드 스캐너가 shop.failedTransactionBranch와 battleProcessing 3분기를 재귀하지 않는다 — 같은 파일의 스위치/변수 스캐너와 커버리지가 어긋남**
`src/editor/databaseCommandReferences.ts` · 최종 high · 확인 · 확신 high
위키 검증 대상 체인의 추가 결함(openwiki/editor-database.md L1119-1139 섹션 대상 파일). src/editor/databaseCommandReferences.ts에서 데이터베이스 레코드 삭제 가드 commandReferences(150-214)는: shop 케이스(158-162)가 `transactionBranch`만 재귀하고 `failedTransactionBranch`를 빠뜨린다(형제 스캐너 commandReferencesSwitchVariable은 298-300행에서 둘 다 재귀). battleProcessing 케이스(179-180)는 `collection === "troops" && command.troopId === id`만 보고 victory/defeat/escape 분기를 재귀하지 않는다(형제 스캐너 301-304행은 세 분기 모두 재귀). 로드 검증기는 양쪽 다 재귀한다(src/project/io/commandReferenceValidation.ts:241-243, 333-334). 이 파일의 200-203행 주석은 «커버리지가 어긋나면 '경고 없이 삭제 → 다음 로드에서 프로젝트가 안 열림'이 된다(2026-09-19 리뷰 P0-6). 검증기에 케이스를 더할 때 여기에도 같이 더할 것»이라고 스스로 규약을 선언했는데, 케이스가 아니라 분기 재귀에서 그 규약이 깨져 있다. 영향: 스킬·아이템 등이 battleProcessing 결과 분기나 shop 실패 분기 안에서만 참조될 때 삭제가 무경고 통과하고 다음 로드가 assert로 막힌다. 수정 제안: commandReferences의 shop/battleProcessing(및 inn·choices 정합성 점검)에 형제 스캐너와 동일한 분기 재귀를 추가한다.

**[DB-06-4] (high) validateCondition이 all/any/not 재귀도 item/actor 리프 검사도 안 함 — fork·이벤트 조건·엔딩 조건의 댕글링 참조가 로드 검증을 통과**
`src/project/io/commandReferenceValidation.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/commandReferenceValidation.ts:420-433 validateCondition. `if (condition.kind === "switch") ... if (condition.kind === "variable") ...` 외 전부 생략하는데, 432행 주석 «selfSwitch/actor/item/gold/... 조건은 전역 스위치/변수 id를 참조하지 않으므로 검증 생략»은 사실과 다르다. src/project/types/events.ts:59-89의 Condition은 `item`(69행), `actor`(68행), 그리고 `all/any/not`(87-89행)을 포함하고, all/any의 자식은 switch/variable일 수 있다. 이 함수를 쓰는 경로는 세 곳이다: fork 명령(같은 파일 194-198행 `validateCondition(command.condition, ...)`), 맵 이벤트 조건(references.ts:1192-1193), 엔딩 조건(references.ts:352-354). 즉 fork 조건이 `{kind:"item", itemId:"삭제된 id"}`이거나 `{kind:"all", conditions:[{kind:"switch", switchId:"삭제된 id"}]}`여도 로드 검증을 통과한다. …

**[DB-06-5] (high) pruneDanglingCommandRefs가 battleProcessing·promoteActor·evolveMonster·shop.failedTransaction 분기를 재귀하지 않아 벽돌 방지 수리 계약이 반쪽**
`src/project/io/references.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/references.ts:1441-1492. 재귀 처리 분기는 choices(1465-1471)·fork(1473-1475)·loop(1477-1479)·shop transactionBranch(1481-1484)·inn notEnoughBranch(1485-1487)뿐이다. 누락: (1) battleProcessing victoryBranch/defeatBranch/escapeBranch — 검증기는 재귀한다(commandReferenceValidation.ts:241-243); (2) promoteActor/evolveMonster successBranch/failureBranch — 검증기 267-268·308-309행 재귀; (3) shop failedTransactionBranch — 검증기 334행, 수집기(commandReferenceValidation.ts:90)도 커버. 이 분기 안의 callCommonEvent·transfer·changeTile이 삭제된 공통이벤트/맵을 가리켜도 repair가 손대지 않아 `pruned.push(command)`(1489행)로 원본 통과된다. references.ts:390-391 주석 «삭제/미생성 맵을 가리키는 transfer·changeTile과 생활 이동 목적지는 로드를 벽돌내는 대신 여기서 정리한다»는 계약이 battleProcessing·promoteActor·evolveMonster·shop 실패 분기 안에서는 파이다. 영향: 정상 저작으로 만든 분기 안 transfer가 맵 삭제 후 남아, 수리 정책이 있음에도 로드가 assert로 막힌다. …

**[DB-06-6] (high) validatePageCondition·validateBattleEventCondition에 insideLocation·relationshipAtLeast 케이스(전투쪽 item까지)가 없다 — 신규 조건 종류가 로드 검증에서 투명인간**
`src/project/io/commandReferenceValidation.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/commandReferenceValidation.ts:340-369 validatePageCondition. 케이스 목록(switch/variable/actor/item/selfSwitch/gold/timer/timePhase/season/npcActivity/friendshipAtLeast/battleResult/run/all/any/not)에 `insideLocation`과 `relationshipAtLeast`가 없고 default도 없어 두 종류는 조용히 건너뛴다. 두 kind는 타입과 런타임에는 존재한다: types/events.ts:82·84(Condition 멤버, 91행 `EventPageCondition = Condition`), pageResolution.ts:76-84(insideLocation: `if (!location ...) return false`)·91-92(relationshipAtLeast). 즉 locationId가 삭제/오타인 페이지 조건은 로드 검증에서 아무 보고도 없고, 런타임에서 «로케이션 없음=거짓»으로 페이지가 영원히 안 켜진다 — 위키 검증 대상 파일인 src/editor/eventDraftValidator.ts:616-638은 같은 상황을 `condition.insideLocation.missing`(«로케이션 '...' 이 삭제됐습니다»)으로 잡는다고 명시하며 252-253행은 «조용한 실패는 이 저장소가 가장 싫어하는 종류의 결함»이라고 선언한다. relationshipAtLeast도 draft 검증기 592-598행만 있고 로드 검증엔 없다. …

**[DB-06-7] (high) validateCommandReferences가 커맨드 종류 확장을 따라가지 못했다 — equipTool·changeParty·changeLifeSkillExp·callMapEvent·playMovie·spawnFieldEnemy·wait/inputWait·moveEvent 라우트 미검증**
`src/project/io/commandReferenceValidation.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/commandReferenceValidation.ts:139-338 validateCommandReferences. types/events.ts:266-498의 Command 종류 중 다음이 케이스 없이 통과된다. (1) `equipTool`(355행 `itemId?: ItemId`) — 수집기 78-80행은 하드 참조로 모으고 에디터 삭제 가드도 커버(databaseCommandReferences.ts:210-211, 202-203행 주석이 2026-09-19 리뷰 P0-6으로 추가한 케이스)하는데 로드 검증엔 없다. (2) `changeParty`(376행 actorId) — 가드는 186-187행이 커버하고, AI 경로는 별도 보강 검증기로 임시방편 중: src/ai/eventCommandAssist.ts:650-663 주석 «io/commandReferenceValidation이 커버하지 않는 참조 보강(changeItem.itemId / changeParty.actorId)» + 659-663 changeParty 케이스. (3) `changeLifeSkillExp`(344행 skillId) — 가드 194-195행 커버, 로드 검증 없음. (4) `callMapEvent`(325행 eventId)·`playMovie`(390행 resourceId) — showPicture/playAudio는 316-321행에서 검사하는데 이 둘은 미검사.  …

**[DB-06-8] (high) 수리(auto-heal) 정책이 스위치 FK 축을 일부만 복구한다 — 검증하는데 수리하지 않는 축에서 rename_switch 격차가 합쳐져 저장 실패로 직행**
`src/project/io/references.ts` · 최종 high · 확인 · 확신 high
위치: src/project/io/references.ts:358-410 repairProjectReferences. 수리하는 축: transfer/changeTile/callCommonEvent/showEmote(396-398), living destinations mapId(399), 구조물 배치(365), P2 fish/forage/museum(366, 412-467), item.switchId는 ensureItemSwitchDefs로 스위치 정의를 자동 선언(367-369), skill.elementId·elementRates(383-389). 그러나 같은 파일의 검증기가 하드 이슈로 보고하는 아래 축들은 어디서도 수리되지 않는다: promotions requires.switchId/itemId/variableId(559-561), worldUnlocks switchId(300-304), bundle reward switchId/recipeId(308-312), lifeSkill reward switchId/recipeId(320-325), skill effect switchId(571), enemy action switchId(645-647). 예: museum 보상의 댕글링 recipeId는 repairP2References가 보상 전체를 드롭해 치유한다(457-464)는데, 같은 recipeId를 bundle reward가 가리키면(312행 검증만 존재) 치유 없이 assert로 직행한다. …

**[DB-06-9] (high) rename_switch/rename_variable이 그룹 조건·분기 내부·시스템 축을 재기록하지 않아 «성공» 직후 댕글링 스위치/변수가 남는다**
`src/editor/tools/refactorTools.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/refactorTools.ts. rename_switch(172-240)와 rename_variable(287-358)이 재기록하는 것은 정의·세션값·setSwitch/setVariable계 명령·조건 리프·encounter 조건·enemy action 스위치뿐이다. 누락 축: (1) 그룹 조건 — renameConditionSwitch(163-168)·renameConditionVariable(278-284)은 리프만 치환해 all/any/not 안의 스위치·변수와 fork의 복합 조건을 놓친다. 아이러니하게 위키(editor-database.md L1119-1139)가 문서화한 삭제 가드 all/any/not 재귀 수정(같은 저장소 databaseCommandReferences.ts:344-348, 실측 2026-08-29)은 이 도구에는 적용되지 않았다. (2) walkCommands(17-30)가 choices/fork/loop만 재귀하므로 battleProcessing victory/defeat/escape·promoteActor/evolveMonster 성공/실패·shop transaction/failedTransaction·inn notEnough 분기 안의 명령은 수집(collectReferences)과 치환 모두에서 보이지 않는다. (3) 시스템 축 전반 — item.switchId, skill.effect switchId, promotion.requires.switchId, worldUnlocks/bundle reward/museum reward/lifeSkill reward switchId, living destination switchId가 재기록 대상에 없다. …

**[DB-06-12] (medium) shop 명령의 buyback·cartLines·consignments·pawnTickets·appraisalUnidentifiedPool itemId는 수집만 되고 검증·삭제가드 어디서도 검사되지 않는다**
`src/project/io/commandReferenceValidation.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/commandReferenceValidation.ts. 수집기 collectCommandItemReferences의 shop 케이스(81-91)는 `itemIds·stock·buyback·cartLines·consignments·pawnTickets·appraisalUnidentifiedPool`을 전부 하드 참조로 모은다. 검증기 shop 케이스(327-336)는 `requireExistingIds("shop: item", command.itemIds, sellable)`와 `command.stock`만 검사한다. 타입상 이 필드들은 실재한다(types/events.ts:441-450, ShopConsignment 169행 등). 에디터 삭제 가드도 databaseCommandReferences.ts:158-162에서 itemIds+stock만 본다. 영향: 전당포 표·위탁 상품·평가 대상 풀에만 남은 아이템은 삭제 가드를 통과해 지워지고, 로드 검증도 통과한 채 상점 UI·정산 로직에서 undefined 품목으로 조용히 오작동한다(수집기가 load-repair 보존용으로 쓰이는 것과도 계약이 어긋난다 — references.ts 모듈 주석 39-42행 «역직렬화 자체에 실패한다» 계약의 반대 방향). 추가로 ShopConsignment.consignorSwitchId·ShopDonationLedger.lastDonorSwitchId(types/events.ts:169-170)의 스위치 참조는 수집·검증·가드 어디에도 없다. 수정 제안: shop 검증 케이스를 수집기와 동일 필드 집합으로 확장하고 sellable 집합(items∪equipment)으로 일괄 requireExistingIds 처리한다.

**[DB-06-13] (medium) openChest의 lockSwitchId·lockItemId는 수집·검증·삭제가드 어디에도 없다 — 열쇠/스위치 삭제 시 상자가 영구 잠금(무음)**
`src/project/io/commandReferenceValidation.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/commandReferenceValidation.ts — collectCommandItemReferences(73-120)와 validateCommandReferences(139-338) 어디에도 `openChest` 케이스가 없다. 타입은 types/events.ts:356-371 `lockSwitchId?: string; lockItemId?: string`이고, 런타임은 src/project/storageChest.ts:199-206에서 `if (presentation.lockSwitchId && !getSwitch(session, presentation.lockSwitchId)) return { locked: true ... }`, `session.inventory[presentation.lockItemId] ?? 0`으로 판정한다. 즉 잠금 아이템이 삭제되거나 잠금 스위치가 삭제돼도(두 id 모두 수집·검증·삭제 가드 미대상 — databaseReferenceMessage items 케이스와 switchVariableReferenceMessage에 openChest 축 없음) 상자는 영구 잠깐 상태로 조용히 남는다. 저작 도구는 이 필드를 실제로 노출한다(src/editor/panels/eventCommands/schema/catalogExtended.ts:229-230, commandBodyStorageChest.ts:102-111). 수정 제안: collectCommandItemReferences에 openChest.lockItemId를 item 참조로, validateCommandReferences에 lockSwitchId(스위치 집합)·lockItemId(아이템 집합) 케이스를 추가하고 삭제 가드에도 동일 축을 넣는다.

**[DB-06-14] (medium) validateSkillRecords가 actionSkill.itemCost.itemId를 검증하지 않는다 — 수집기는 하드 참조로 모으고 런타임은 탄약으로 소비한다**
`src/project/io/references.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/references.ts:566-574 validateSkillRecords — animationId·elementId·stateEffects·effect.switchId만 검사한다. 그러나 같은 파일 수집기 collectProjectItemReferenceIds:49-52는 `skill.actionSkill?.itemCost?.itemId`를 하드 참조로 수집하고, 타입은 src/project/types/database.ts:267-268 `itemCost?: { itemId: ItemId; amount: number }`(주석 «발사 시 인벤토리에서 소비하는 탄약 아이템. 부족하면 캐스트가 불발한다»), 런타임 소비처는 src/player/playSceneActionCombat.ts:666-669 `if (ammo && (scene.session.inventory[ammo.itemId] ?? 0) < ammo.amount) return;`. 삭제 가드(databaseReferenceMessage items 케이스)에도 itemCost 축이 없어 탄약 아이템 삭제가 허용된 뒤 해당 액션 스킬이 영구히 발사 불발 상태가 된다(에러 없음, MP만 소모 가능). 수집기는 모으는데 검증기가 놓치는 전형적 축 누락. 수정 제안: validateSkillRecords에 `skill.actionSkill?.itemCost?.itemId`에 대한 itemIds 검사를 추가하고, 삭제 가드 items 케이스에도 같은 축을 넣는다.

**[DB-06-16] (medium) monsterSpecies(및 troops·commonEvents) 중복 id 미검사 — 같은 파일의 모든 형제 검증기는 중복 id를 보고한다**
`src/project/io/references.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/io/references.ts:653-675 validateMonsterSpeciesRecords — 진화 사이클(661-665)·스킬(667)·toSpeciesId(670)·진화 itemId(671)·그래픽(673)은 보고하지만 중복 id 검사가 없다. 동일 파일의 모든 형제 검증기는 중복을 보고한다: crops 683-686, lifeSkills 700-704, craftRecipes 706-709, itemUpgrades 716-719, sellPrices 727-731, toolActions 733-736, fishSpecies 231, endings 348-351, farmAnimalSpecies 747-753. shape 계층도 이 컬렉션은 커버하지 않는다(shapeDatabaseFields.ts:75 `requireArray`만 수행 — 형제 fishSpecies는 212행에서 dup assert를 하는데 monsterSpecies는 없음). troops(1132-1138)·commonEvents(1140-1147)도 같은 파일에서 dup 검사가 없다. 영향: 중복 species id가 저장본에 들어오면 speciesIds Set(659행)이 첫 행으로 치우쳐 진화 대상 판정이 모호해지고, giveMonster/evolveMonster 명령(검증 300·306행)이 어느 행을 가리키는지 알 수 없다. 중복 id 방어는 이 프로젝트의 표준 계약(editor-validation.md L166 «중복 ID 방어»)이다. 수정 제안: validateMonsterSpeciesRecords(및 troop/commonEvent 검증기) 앞머리에 collectDuplicateDefinitionIssues를 추가한다.

**[DB-06-15] (low) session.inventory·testPresets의 아이템 키는 하드 참조로 수집만 되고 검증·삭제가드 축에서 빠져 있다**
`src/project/io/references.ts` · 최종 low · 보류 · 확신 medium
위치: src/project/io/references.ts:44-47 — `new Set(Object.keys(project.session.inventory))`와 testPresets inventory 키를 하드 참조로 수집(load-repair 시드 보존에 사용, src/project/persistence/core/loadRepair.ts:51 주석 «시작 인벤토리의 기존 참조를 잃지 않는다»). 그러나 collectProjectReferenceIssues(135-222) 어디에도 session.inventory/testPresets 키→itemIds 대조가 없다. 삭제 가드도 이 축이 없다: databaseReferenceMessage items 케이스(databaseReferences.ts:116-167)에 session.inventory 검사가 없어 시작 인벤토리에만 있는 아이템을 지울 수 있다. 런타임은 이미 이 상태를 알고 있다: src/player/lifeLedger.ts:533 `` `${itemId} (삭제된 항목)` `` 812행 «(삭제된 품목)» 폴백 문자열. 영향: 댕글링 인벤토리 키가 로드를 통과해 UI에 유령 항목이 남고, 수집기의 «보존» 계약과 검증기의 «검출» 계약이 어긋난다. 수정 제안: collectProjectReferenceIssues에 `collectExistingIdIssues("session.inventory", Object.keys(project.session.inventory), itemIds, issues)`(및 testPresets)를 추가하거나, 삭제 가드 items 케이스에 시작 인벤토리 참조 검사를 넣어 어느 한쪽 권위를 확정한다.
> 보류 사유: 사실관계는 실측 — 수집기가 session.inventory·testPresets 키를 모으고(44-47), 검증기·삭제 가드 어디에도 대조가 없으며 lifeLedger.ts:533·812의 '(삭제된 항목)/(삭제된 품목)' 폴백이 실존한다. 그러나 그 폴백은 런타임이 삭제된 아이템 잔존을 의도적으로 우아하게 처리한다는 증거이기도 하다 — 인벤토리 키를 하드 검증하면 오히려 오래된 저장본이 벽돌이 되므로 결함이라기보다 두 계약의 의도적 비대칭에 가깝다.

저심각도 일괄:
- [DB-06-17] (low) 오류 메시지 품질 불균일 — 유효 id 힌트는 2곳에만 있고 언어·종결 규칙이 검증기마다 섞여 AI 소비 계약이 흔들린다 — `src/project/io/references.ts`
- [DB-06-18] (low) validateBattlerAnimationResources는 어디서도 호출되지 않는 죽은 export — `src/project/io/resourceReferenceValidation.ts`
- [DB-06-19] (low) validateOptionalResource의 generated-폴백 경로가 사문(死紋) — easyrpg-monster- 접두는 베이스 마커가 없어 폴백 불가, !isGeneratedPrefix 분기는 항상-던지는 재단언 — `src/project/io/resourceReferenceValidation.ts`
- [DB-06-20] (low) EventPageSession 주석 오타 «조건이만 사용한다» — 계약 문서 문구 훼손 — `src/project/io/pageResolution.ts`

### 6.7 DB-07 — 액터·캐릭터 외형 스튜디오

**[DB-07-1] (high) 밸런스 자동계산이 배우 스탯을 클래스 곡선에서 읽어 실제 전투 모델(actor.parameterCurves)과 어긋난다**
`src/editor/panels/databaseBalanceCompute.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseBalanceCompute.ts:127-132 — `// 배우 스탯은 클래스 곡선에서 읽는다(actorBattlers 와 동일한 '클래스 기반 스탯' 모델).` / `return klass ? klass.parameterCurves : { maxHp: ZERO_CURVE, ... }`. 그러나 실제 전투 모델은 클래스 곡선이 기본이 아니다: src/battle/battleBattlers.ts:182-183 `const curves = usesOverrideCurves && effectiveClass ? effectiveClass.parameterCurves : normalizedActor.parameterCurves;` (클래스 오버라이드 세션이 있을 때만 클래스 곡선), src/battle/battlePredict.ts:77-78 `const curves = normalized.parameterCurves;`. 또한 신규 배우의 곡선은 클래스에서 파생되지 않는다: src/project/actorModel.ts:125-142 createActorRecord은 parameterCurves를 넘기지 않고 normalizeParameterCurves가 고정 기본표(PARAMETER_LEVEL_ONE/NINETY_NINE, actorModel.ts:107-123)로 채운다. …

**[DB-07-2] (medium) 과잉 회복 감지(overhealIssues)의 입력에서 회복 스킬이 누락됐다 — medicine 아이템만 스캔**
`src/editor/panels/databaseBalanceCompute.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseBalanceCompute.ts:236-249 — `for (const item of project.database.items) { if (item.type !== "medicine") continue; const amount = item.hpRecovery.flat + ... }`. 문제 감지의 입력 컬렉션이 items뿐이라, SkillEffect의 회복 계열(src/project/types/database.ts:249 `{ kind: "healing"; statistic: "mind"; affects: "hp" | "mp" }`)은 전혀 스캔되지 않는다. 실제로 기본 배우에게 skill_heal이 지급된다(src/project/defaults/defaultDatabasePartyRecords.ts:138 `defaultSkillId: "skill_heal"`). 영향: 회복량이 수천인 힐 스킬이 있어도 '과잉 회복' 후보 카드는 절대 나오지 않고, medicine 아이템만 점검 대상이 된다 — 대시보드의 3종 휴리스틱 중 하나가 스킬 밸런스를 아예 커버하지 못한다. 수정: detectBalanceIssues에서 `effect.kind === "healing"`인 SkillRecord(기본 공격과 마찬가지로 파티가 쓰는지 여부는 유지)를 같은 OVERHEAL_THRESHOLD 기준으로 함께 스캔하고, 카드 detail에 아이템/스킬 구분을 표기한다.

**[DB-07-3] (medium) 액터 스튜디오 목록 썸네일이 외형(appearance) 연결을 프로젝션하지 않아 연결 배우의 얼굴이 비어 보인다**
`src/editor/panels/databaseActorStudio.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseActorStudio.ts:96 `const thumbnail = recordListThumbnail("actors", actor, project, 36);` — databaseRecordViews.ts:137-139도 원본 레코드를 그대로 넘긴다(`records as ActorRecord[]`). recordListThumbnail → actorThumbnail은 `resolveAssetResourceUrl(record.faceResourceId, ...)`만 본다(src/editor/panels/databaseRecordThumbnails.ts:65-68). 반면 편집 권위 화면인 상세 폼은 `const effective = resolveActorAppearance(store.getCurrent(), actor)`로 프로젝션해 얼굴/캐릭터셋을 그린다(src/editor/panels/actorRecordView.ts:397-401, 569, 583). 외형(appearance) 연결은 정규 흐름이다 — 위키 editor-database.md:288-289 "Actor and event-page selectors retain direct graphics and store only an appearance link". 영향: appearanceId에 face/charset만 연결된 배우는 스튜디오 표에서 썸네일이 전부 '이미지 없음' 슬롯으로 나와, 연결이 살아있어도 깨진 것처럼 보인다(같은 배우의 상세 폼에는 그림이 보임).  …

**[DB-07-4] (medium) 스튜디오 표 행의 aria-selected가 선택 변경 시 갱신되지 않고, 부분 렌더가 role=row에 잘못된 aria-pressed를 세운다**
`src/editor/panels/databaseRecordViews.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseActorStudio.ts:99-103 — 주석 `여기는 role=row 이므로 유효한 상태 속성은 aria-selected 다` + `attrs: { role: "row", type: "button", "aria-selected": String(selected) }`. 그러나 (1) 스튜디오 행 클릭 경로는 CSS 클래스만 만진다: databaseActorStudio.ts:50-55 `candidate.classList.remove("active"); row.classList.add("active"); options.onSelect(actor.id)`. (2) 부분 렌더 공용 경로도 마찬가지: databaseRecordViews.ts:186-199 markActiveRow는 `row.classList.add/remove("active")`와 `row.setAttribute("aria-pressed", String(isActive))`만 수행하고 aria-selected는 건드리지 않는다. 영향: 렌더 후 한 번이라도 선택이 바뀌면, 화면에서 활성(.active)인 행의 aria-selected는 계속 "false"로 남고 이전 행은 "true"로 남아 보조기술이 거짓 선택 상태를 읽는다. 동시에 role="row" 요소에 aria-pressed가 새로 붙는데 aria-pressed는 버튼 역할 전용 속성이라(role=row 허용 아님) ARIA 구조도 더 어긋난다. …

**[DB-07-6] (medium) 보스 exp 컷이 '상위 10%' 주석과 다른 off-by-one이라 보스 과다 지정으로 보스 HP 급증 감지가 무력화된다**
`src/editor/panels/databaseBalanceCompute.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseBalanceCompute.ts:167-172 — 주석 `상위 10% exp 컷: ... ceil(0.9n)-1 번째 값. 이 값 이상이면 보스 후보` / `const index = Math.max(0, Math.ceil(sorted.length * 0.9) - 1);`. 이 값 이상인 적의 수는 n − (ceil(0.9n)−1)개라 n=10에서 2개(20%), n=20에서 3개(15%), n=100에서 11개(11%) — 주석과 반대로 항상 한두 마리가 과잉 지정된다. 극단으로 n≤2면 전원이 보스 후보가 되고, exp가 0으로 미설정된 초기 프로젝트에서는 threshold 0 + `>=` 비교(:100, :256 `enemy.rewards.exp >= bossExp`) 때문에 전 적이 isBoss=true가 된다. 영향: (1) 산점도에서 보스 색이 과다 표시되고 (2) bossHpSpikeIssues(:252-274)는 비보스만 neighbors로 삼으므로(:261 `.filter((other) => ... && !isBoss(other))`) 비보스가 줄어든 만큼 감지가 공회전한다. 수정: 컷을 정확히 상위 10%로 맞추려면 index = Math.ceil(sorted.length * 0.9)로 올리고(해당 인덱스 값 '초과' 기준), exp가 전부 0일 때는 감지를 스킵하는 가드를 둔다.

저심각도 일괄:
- [DB-07-10] (low) 선물 취향에서 같은 아이템을 loved·disliked 등 서로 다른 등급에 동시 등록할 수 있고 편집기는 경고하지 않는다 — `src/editor/panels/databaseCharacterView.ts`
- [DB-07-11] (low) role=grid 표의 직계 자식으로 <p> 빈 상태 안내가 들어가 grid ARIA 구조를 깬다 — `src/editor/panels/databaseActorStudio.ts`
- [DB-07-5] (low) 기본 칭호 "None"이 자리표시 집합에 없어 새 주인공 목록에 'None'이 칭호로 박힌다 — `src/project/actorModel.ts`
- [DB-07-7] (low) 위키 최신 기록(공용 분류 줄 'label · status · quality · attributes')과 코드가 어긋난다 — 얼굴 줄은 label·속성만 표시 — `src/editor/panels/databaseAppearanceSlots.ts`
- [DB-07-8] (low) charset 슬롯 미리보기(graphicPreview)만 그림 로드 실패 피드백이 없어 같은 카드 안 슬롯 간 계약이 불일치 — `src/editor/panels/databaseAppearanceSlots.ts`
- [DB-07-9] (low) 공용 분류 줄이 매핑 행이 없는 기본(번들) 캐릭터셋에도 '업로드 그림' 문구로 오분류한다 — `src/editor/panels/databaseAppearanceSlots.ts`

### 6.8 DB-08 — 몬스터·진영·트룹·전투이벤트

**[DB-08-1] (high) 종족 삭제 가드가 '같은 ID 호환 연결'(legacy) 참조를 검사하지 않아 무경고 연결 유실**
`src/editor/panels/databaseMonsterSpeciesView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseMonsterSpeciesView.ts:397-401(삭제 가드 호출 `const blockedMessage = monsterSpeciesReferenceMessage(id); if (blockedMessage) ...`), src/editor/databaseReferences.ts:197-207(가드 본체: `enemies.filter((record) => record.speciesId === speciesId)` — 명시 speciesId 만 검사, 이후 진화 역참조·이벤트 명령만 추가 검사). 그러나 링크 해석은 src/project/monsterCollection.ts:176-181 처럼 `if (enemy.speciesId) ... return species.find((record) => record.id === enemy.id)` — enemy.speciesId 가 없어도 enemy.id === species.id 면 종족이 연결된다. 편집기 UI는 이 연결을 일급 개념으로 표시한다(src/editor/panels/databaseEnemyRecordView.ts:421-426 `미지정 · ${fallback.name} (같은 ID 호환 연결)`, :447-449 `같은 ID 호환 연결 (저장된 종족 ID 없음)` 칩, databaseMonsterSpeciesView.ts:584 힌트 `같은 ID 호환 연결 제외`). 따라서 종족 id 와 같은 id 의 몬스터가 호환 연결만으로 종족을 쓰고 있으면 삭제 가드가 통과되어 삭제가 허용되고, 해당 몬스터는 경고 없이 포획·성장·타입 연결을 잃고 '종족 미설정' 으로 바뀐다. …

**[DB-08-10] (medium) sliderStepperField 스텝 정규화가 부동소수 오차를 그대로 표시·저장 — 넉백 저항(0..1, step 0.05) 조작 시 0.30000000000000004 같은 값이 저장됨**
`src/editor/panels/databaseControls.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseControls.ts:86-91 — `normalize` 이 `bounds.min + Math.round(offset / bounds.step) * bounds.step` 를 돌려주는데 step 이 소수면 부동소수 곱이 그대로 나온다. 몬스터 '넉백 저항' 이 대상이다: src/editor/panels/databaseEnemyRecordView.ts:1094-1098 `sliderStepperField("넉백 저항", ..., { min: 0, max: 1, step: 0.05 })`. 슬라이더로 0.15/0.3 지점을 고르면 `3*0.05=0.15000000000000002`, `6*0.05=0.30000000000000004` 가 되어 커밋(:102-109 `stepper.value = String(next)`)에 스테퍼 화면에 그대로 표시되고 onInput 으로 저장된다. 저장 후에도 정리되지 않는다 — src/project/actionCombat.ts:138 `out.knockbackResist = clamp01(profile.knockbackResist)` 는 0..1 클램프만 하고 반올림하지 않으므로 프로젝트 JSON 에 0.30000000000000004 가 남는다. 같은 파일의 numberField 스텝퍼는 decimalPlaces 로 이 문제를 이미 처리한다(databaseControls.ts:197-204). 수정: normalize 의 곱셈 결과를 `Number((...).toFixed(적정 자릿수))` 로 스냅하거나 step 을 정수 틱으로 변환해 계산할 것.

**[DB-08-2] (medium) 진행 행렬(전체 관계표) 카드가 셀 클릭 때마다 다시 접혀 연속 편집이 불가능하고 포커스도 유실**
`src/editor/panels/databaseFactionView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseFactionView.ts:420-424(카드 정의 `collapsible: true, collapsed: true`), :524-532(셀 클릭 핸들러 `recordProjectSnapshot(...); replaceFactions(setSparseFactionStance(...)); rerender(); restoreFocusAfterRerender(testid);`). sectionCard 의 접힘 상태는 렌더된 노드에만 존재한다(src/editor/panels/databaseWorkspace.ts:453-477 — `if (options.collapsed) body.setAttribute("hidden", ...)` 별도 세션 저장 없음). 따라서 사용자가 '전체 관계표 (고급)' 를 펼치고 셀을 한 번 순환(-2→-1)시키면 rerender 가 카드 전체를 재생성해 즉시 다시 접힌다. 두 번째 셀을 고치려면 매번 카드를 다시 펼쳐야 한다. 더 심하게, :531 의 `restoreFocusAfterRerender(testid)` 는 rerender 후 같은 testid 셀을 찾아 focus() 하지만 그 셀은 이제 `hidden` 몸통 안이라 focus() 가 실패하고 포커스는 body 로 떨어진다(키보드 사용자는 매 클릭마다 격자 위치를 잃음). 위키 editor-database.md L1146 은 '기본 접힘' 만 명시하지 않았고, 편집 반복이 불가능한 것까지 의도였을 수 없다. 수정: 접힘 상태를 모듈/세션 상태로 보존하거나, 행렬 셀 편집은 rerender 없이 해당 셀만 갱신하도록 변경하고 collapsed 초기값을 마지막 사용 상태로 둘 것.

**[DB-08-3] (medium) 몬스터 폼 '진영 관계와 설정' <details> 가 소속 진영 변경 즉시 닫혀 결과 카드(db-enemy-faction-effective)가 사라짐**
`src/editor/panels/databaseEnemyRecordView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseEnemyRecordView.ts:189-191(`el("details", { class: "db-enemy-faction-details", children: [el("summary", ...) ...factionDetails] })` — open 속성 없음), :221-228(진영 select change → `updateDatabaseRecord(...); rerender();`). factionDetails 안에는 유효 진영 결과 카드(`db-enemy-faction-effective`, :237 `factionConsequence(...)`)와 결손 경고·안내가 전부 들어 있다. 위키 editor-database.md L1156-1158 은 이 카드들이 소속 변경 결과를 보여주는 정면 장치라고 기술하는데, 소속을 바꾸는 순간 rerender 로 details 가 재생성되어 닫히므로 사용자는 방금 선택한 결과(색·태도·출처)를 볼 수 없다. `<details>` 는 재생성 시 open 상태를 잃는다. 수정: details 의 open 상태를 databaseRecordViewSession 같은 레코드별 세션에 두거나, select change 시 rerender 후 해당 details 에 open 을 되돌려줄 것.

**[DB-08-4] (medium) 진영 사용처 카드의 필드 스폰 상속 소속 판정이 런타임과 다름(숨김 멤버 처리 불일치)**
`src/editor/panels/databaseFactionPreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseFactionPreview.ts:61-63 — `const enemyId = troop?.members?.find((member) => member.hidden !== true)?.enemyId ?? troop?.enemyIds[0]; ... return (spawn.factionId ?? enemy?.factionId ?? DEFAULT_ENEMY_FACTION_ID) === factionId;`. 반면 런타임 상속 판정은 src/player/playSceneActionCombat.ts:294-299 `const enemyId = troop?.members?.[0]?.enemyId ?? troop?.enemyIds[0]` — hidden 여부를 보지 않는다. 트룹의 첫 멤버가 숨김(등장 연출 전)이고 둘째 멤버가 다른 진영의 적일 때, 사용처 카드는 스폰을 '둘째 멤버의 진영' 소속으로 분류하지만 실제 전투(스폰.factionId 미지정 시)는 '첫 멤버(숨김)의 진영'으로 판정한다. 위키 editor-database.md L604 가 '기본·상속 소속을 포함한 몬스터/필드 스폰 사용처 이동' 을 이 카드의 존재 이유로 명시하므로, 어긋난 분류는 저작자를 잘못된 진영 카드로 보낸다. 수정: databaseFactionPreview.ts:61 을 `troop?.members?.[0]?.enemyId ?? troop?.enemyIds[0]` 로 런타임과 동일하게 맞출 것.

**[DB-08-5] (medium) upsert_enemy AI 툴 스키마에 factionId·actionProfile 이 없어 UI 가 저작할 수 있는 필드를 AI 는 아예 쓸 수 없음**
`src/editor/tools/dbTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/dbTools.ts:455-473 — enemyRecordSchema 가 id/name/speciesId/monsterResourceId/battleScalePercent/graphicHue/transparent/flying/criticalHit/attackOptions/skillIds/level/stats/rewards/actions/stateRates/elementRates 만 허용. 그러나 프로젝트 타입과 편집기 UI는 `EnemyRecord.factionId`(소속 진영, src/project/databaseEnemyTroopRecordModel.ts:49 정규화, databaseEnemyRecordView.ts:195-275 편집 UI, 진영 탭 사용처 카드)와 `EnemyRecord.actionProfile`(액션 전투: 접촉 데미지·어그로·공격 종류 등, databaseEnemyRecordView.ts:1086-1176)를 사람이 저작할 수 있는 일급 필드로 제공한다. objectSchema 는 additionalProperties:false 이고(src/editor/tools/dbTools.ts:318-322), 검증기는 미허용 키를 '허용되지 않은 인자: {key}' 로 반려한다(src/editor/tools/jsonSchema.ts:249-253). 즉 AI 가 '이 몬스터를 산적 진영에 소속시키고 접촉 데미지를 설정해줘' 를 시도하면 upsert_enemy 가 반려되고, battleEventPages 처럼(databaseTools 는 :874-882 친절한 리다이렉트 에러를 제공) 대체 경로 안내도 없다. …

**[DB-08-6] (medium) 종족 진화 행 편집이 레벨별 스킬 행과 달리 외부 변경(undo) 가드가 없어 엉뚱한 행을 고치거나 편집이 조용히 버려짐**
`src/editor/panels/databaseMonsterSpeciesView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseMonsterSpeciesView.ts:770-775 — `const setEvolution = (updater) => { const live = currentSpecies(record.id, record).evolutions ?? []; const current = live[index] ?? evo; updateSpecies(record.id, { evolutions: live.map((item, i) => (i === index ? updater(current) : item)) }); }`. 행은 렌더 시 index 로 식별되는데 live 가 undo/다른 패널로 짧아지면 (a) index >= live.length → map 이 어느 항목도 고치지 않아 편집이 조용히 버려지고(드롭다운 표시만 바뀌었다가 다음 rerender 에 되돌아감), (b) 목록이 재배열되면 화면의 N번째 행과 live[N] 이 다른 진화를 가리켜 엉뚱한 진화의 toSpeciesId/조건이 덮어인다. 같은 파일의 레벨별 스킬 카드는 정확히 이 결함을 saved-JSON 스냅샷 비교로 잠근다(:681-692 `if (JSON.stringify(live) !== saved) { toast("스킬 목록이 변경되어 새로 표시합니다..."); rerender(); return; }`), 위키 editor-database.md L598 이 그 계약을 명시한다. 진화 행에는 동일 가드가 없어 계약이 절반만 적용됐다. 수정: evolutionsCard 에도 skillsByLevelCard 와 같은 saved 스냅샷 비교+재표시 경로를 둘 것.

**[DB-08-8] (medium) 몬스터 폼 중첩 대화상자(openDialog) 탭 함정에 '포커스가 창 밖(body)이면 되돌려놓는' 격리 조항이 없어 모달 뒤로 탭이 새는 실측 결함이 재발**
`src/editor/panels/databaseEnemyRecordSupport.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseEnemyRecordSupport.ts:123-132 — 탭 함정이 `document.activeElement === dialog || (shift ? first : last)` 일 때만 동작한다. 대화상자 본문의 비포커스 영역을 클릭하면 activeElement 가 body 가 되고, 이 상태의 Tab 은 함정 조건 어디에도 걸리지 않아 문서 순서상 대화상자 뒤(오버레이 이전)의 편집기 컨트롤로 포커스가 나간다. 같은 저장소의 이벤트 편집기 서브다이얼로그는 이 구멍을 막아 두었다: src/editor/panels/eventEditor/subdialog.ts:78-87 `if (!windowEl.contains(document.activeElement)) { event.preventDefault(); (shift ? last : first).focus(); }`. 위키 editor-database.md L588-592 이 openDialog 의 포커스 계약(2026-09-05 실측 수정)을 정본으로 기술하므로 이것은 그 결함군의 재발 격이다. 동일 구멍이 몬스터 소재 편집기에도 있다: src/editor/panels/databaseMonsterResourceEditor.ts:71-77 의 트랩은 first/last 경계만 처리하고 body/dialog 포커스 케이스가 없다. 수정: 두 트랩 모두에 subdialog 의 '포커스가 창 밖이면 안으로 당겨온다' 조항을 추가할 것.

**[DB-08-9] (medium) 트룹 전투 이벤트 '실행 내용' 편집이 commandId 로 매칭해 동일 commandId 중복 명령을 전부 함께 덮어씀(이벤트 편집기의 개별 명령 편집 계약과 불일치)**
`src/editor/panels/databaseTroopBattleEventCommands.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseTroopBattleEventCommands.ts:107-117 — `updateM2Command` 가 `currentPage.commands.map((command) => command.kind === "m2Command" && command.commandId === draft.commandId ? { ...command, fields: {...} } : command)` 로 commandId 가 같은 모든 명령을 한 번에 고친다. 그리고 :24-28/127-129 `findM2Command` 는 첫 일치만 찾아 폼에 보여준다. 중복은 충분히 현실적이다: 커맨드 목록 편집기(src/editor/panels/databaseTroopBattleEventPanel.ts:260-266 → src/editor/panels/databaseCommandListAdapter.ts:105-117)가 이벤트 편집기와 동일한 `openEventCommandPicker`/`renderCommandList` 를 그대로 쓰므로(위키 L572-579 계약상 동일 편집기 재사용이 의도) 사용자가 명령 피커에서 '적 출현' 를 두 번 추가해 enemy-1/enemy-2 차등 등장을 만들 수 있고, '실행 내용' fieldset 의 '적 출현' 텍스트 필드는 첫 명령의 target 을 보여주면서 저장은 두 명령 모두를 같은 target 으로 바꿔버린다(두 번째 등장 연출이 조용히 사라짐). 외부 JSON/AI 임포트로 생긴 중복도 같은 경로로 오염된다. 수정: updateM2Command 는 명령 객체 참조/인덱스로 단일 명령을 고치고, commandId 중복 시 fieldset 에 '중복 명령 N개 — 명령 목록에서 개별 편집' 상태로 잠글 것.

저심각도 일괄:
- [DB-08-11] (low) 트룹 전투 이벤트 '강제 도주' 추가 후 표시되는 입력란이 편집해도 아무것도 하지 않는 죽은 필드 — `src/editor/panels/databaseTroopBattleEventCommands.ts`
- [DB-08-12] (low) 종족 추가 기본 이름이 '새 species' — 한국어 UI 용어(종족)와 어긋남 — `src/editor/panels/databaseMonsterSpeciesView.ts`
- [DB-08-13] (low) 적 배치 미리보기 스프라이트가 role="button" 이지만 탭 불가·키보드 작동 불가 — `src/editor/panels/databaseTroopRecordView.ts`
- [DB-08-14] (low) 몬스터 소재 편집기 목록의 모든 행이 같은 testid(db-monster-resource-row)를 공유 — `src/editor/panels/databaseMonsterResourceEditor.ts`
- [DB-08-15] (low) 적 슬롯 팔레트 클릭이 렌더 시점 인덱스로 live 배열을 직접 써 stale index 시 구멍 배열이 만들어지고 정규화에서 조용히 버려짐 — `src/editor/panels/databaseTroopRecordView.ts`
- [DB-08-16] (low) 진영 관계 카드의 '상대 진영 검색' 입력이 태도 버튼 클릭(즉시 저장+전체 rerender) 때마다 초기화됨 — `src/editor/panels/databaseFactionView.ts`

### 6.9 DB-09 — 스킬·직업·성장곡선·상태이상

**[DB-09-1] (high) 상태이상 런타임 폴백이 영어 정규식인데 저작 폼은 한국어 옵션을 쓴다 — "전투 종료 후 유지"·"행동 불가"가 무시됨**
`src/battle/battleStates.ts` · 최종 high · 확인 · 확신 high
위치: src/battle/battleStates.ts:79-105, src/editor/panels/databaseStateRecordView.ts:19-20. stateBehavior의 폴백 파서는 영어 정규식만 믿는다: removeOnBattleEndFrom은 `return !/\b(persist|keep|remain)\b/i.test(value);`(battleStates.ts:104), restrictsActionFrom은 `/\b(cannot act|stun|sleep|paraly[sz]ed|immobilized)\b/i`(battleStates.ts:81)인데, 저작 폼이 쓰는 값은 전부 한국어다 — REMOVAL_OPTIONS = ["전투 종료 후 유지", "전투 종료", "피격 또는 전투 종료", "즉시 해제", "턴 경과"], RESTRICTION_OPTIONS = ["없음", "행동 불가", "아군에게 공격 불가", "스킬 사용 불가", "물리 공격 불가"](databaseStateRecordView.ts:19-20). 영향: (1) 사용자가 새 상태를 만들고 해제 조건 "전투 종료 후 유지"를 골라도 "유지"는 persist|keep|remain과 불일치 → removeOnBattleEnd=true가 되어 전투 종료 시 상태가 삭제된다(stateBehavior battleStates.ts:72 `runtime?.removeOnBattleEnd ?? removeOnBattleEndFrom(...)` — 기본 시드는 state_deep_poison처럼 runtimeEffects.removeOnBattleEnd=false를 하드코딩해 우회하지만 새 상태엔 없음).  …

**[DB-09-17] (high) 직업 전투 명령 "특수계열"의 "스킬 그룹" 자유 텍스트가 런타임에서는 skill.type 영어 enum과 정확 일치 비교된다 — 한글 그룹명이면 전투 메뉴가 항상 비어 있다**
`src/editor/panels/databaseClassRecordView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseClassRecordView.ts:320-325(`subset = el("input", { ... placeholder: "스킬 그룹" ... })` — 자유 텍스트, 검증·안내 없음) vs src/player/battleCommandDom.ts:421(`if (command?.skillSubsetName) return skill.type === command.skillSubsetName;`). skill.type은 4개 영어 enum 뿐이다(databaseRecordMutators.ts:182-184). 영향: 사용자가 "화염"·"회복계" 같은 자연어 그룹명을 입력하면 해당 명령 선택 시 스킬 목록이 전부 필터링되어 빈 특수계열 메뉴가 되고, 유일하게 동작하는 값("normal"/"teleport"/"escape"/"switch" 영문자)은 어디에도 문서화돼 있지 않다. AI 툴 스키마도 skillSubsetName을 자유 문자열로 허용해 같은 함정에 빠진다. 수정 제안: subset 입력을 skill.type enum select로 바꾸거나("특수계열 = 스킬 종류 필터"라고 라벨링), 런타임 필터를 태그 기반으로 확장할 것.

**[DB-09-2] (high) 상태 HP "전투 중(턴당%)" 필드에 양수를 넣으면 런타임이 회복이 아니라 피해로 해석한다 (부호 계약 반전)**
`src/editor/panels/databaseStateRecordView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseStateRecordView.ts:80-85, src/project/ontology/databaseStateOntology.ts:360, src/battle/battleStates.ts:45-51. 폼은 `numberField("전투 중(턴당%)", ..., { min: -100, max: 100 })`로 음수=피해/양수=회복 관례를 암시한다(온톨로지도 regen을 "매 턴 최대 HP의 +8%"로 표기, databaseStateOntology.ts:244). 그러나 resolvedStateValues가 `hpTurn: record.hpReleaseTurn !== undefined ? \`${record.hpReleaseTurn}\` : base.hpTurn`(360행)으로 숫자를 그대로 문자열화하면 "20"이 되고, hpDamagePercentFrom은 `%`가 없는 bare number를 `Math.abs(Number(bareMatch[1]))`로 처리(battleStates.ts:48-49)해 +20 → 턴당 최대 HP 20% 피해가 된다. 회복 경로(hpHealPercentPerTurn)는 Gen1 knob(runtimeEffects)으로만 존재한다. 또한 온톨로지 텍스트 경로는 양수면 0("양수/무변화 → 0", battleStates.ts:44 주석)이라 regen 계열 표시값(+8)과 런타임(0)도 어긋난다. …

**[DB-09-4] (high) 직업 탭 "상태 유효도"·"속성 유효도" 패널은 저장만 되고 런타임이 절대 읽지 않는다**
`src/editor/panels/databaseClassRecordView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseClassRecordView.ts:111-112(패널), 685-691(updateRate가 `updateDatabaseRecord("classes", ..., { stateRates/elementRates })` 저장). 그러나 런타임 읽기 경로는 전부 actor/enemy만 본다: stateResistancePercent는 `actor?.stateRates?.[stateId] ?? enemy?.stateRates?.[stateId]`(src/battle/battleStates.ts:119-124), elementMultiplierFor는 `enemy?.elementRates ?? actor?.elementRates`(src/player/runtime.ts:2245-2249, src/battle/battlePredict.ts:100-104). 클래스→배틀러 병합 경로도 없음(battleBattlers.ts는 classId로 스킬/장비만 계산, 272-274행). 게다가 normalizeActorRecord가 actor.elementRates에 시드 12속성 "C"를 항상 채우므로(actorModel.ts:286-290) 폴백 조회 구조여도 클래스 등급이 닿을 수 없다. 영향: 사용자가 직업 탭에서 어둠 무효(E)·독 강함(D) 등을 저작해도 전투에 100% 무시되고, 속성 탭 사용처 카드는 "직업 참조 N"으로 이 데이터가 쓰인다고 표시한다(databaseElementsClassic.ts:296,307). 수정 제안: 배틀러 파생 시 effectiveActorClassId의 클래스 rates를 actor rates와 병합(클래스 기본 + 배우 재정의)하거나, 패널을 제거하고 배우별 저작으로 안내.

**[DB-09-6] (high) 승급 순환 참조: 그로스 스튜디오는 차단하지만 클래스 폼과 AI 툴(define_promotion)은 무검증 — 자기 승급·A↔B 순환 생성 가능**
`src/editor/panels/databaseClassRecordView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseClassRecordView.ts:587(recordSelect 옵션에 자기 자신 포함, 필터 없음), 656-658(firstPromotionTarget도 순환 무시), src/editor/tools/dbTools.ts:1207-1229(definePromotion — classId===toClassId 검증 없이 `promotions: [...filter(toClassId!==toClassId), { toClassId, requires }]` 기록), src/project/databaseRecordModel.ts:610-614(normalizePromotions도 자기참조/순환 미검사). 반면 그로스 트리 탭은 동일 연결에 가드가 있다: growthTree/actions.ts:23 `if (wouldCreateCycle(edges, from, to)) return '자기 자신이나 이전 직업으로 돌아가는 순환 경로는 연결할 수 없습니다.'`. 런타임 sessionClass.ts:61-64 promoteActor도 순환 방어가 없어 A→B→A 왕복 승급이 조건만 맞으면 무한 반복된다. 추가 계약 불일치: definePromotion은 requires를 통째로 교체하는 반면 그로스 스튜디오는 `record.requires = { ...record.requires, ...patch }`로 병합한다(growthTree/studio.ts:226-229) — AI가 level만 고치려 Submit 하면 기존 switchId/itemId/requiredSkillIds가 유실된다. …

**[DB-09-8] (high) 직업 스킬 테이블: 스토어가 learnedSkills를 재정렬하는데 편집은 DOM 인덱스로 커밋해 엉뚱한 행을 덮어써 습득 스킬이 유실된다**
`src/editor/panels/databaseClassRecordView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseClassRecordView.ts:459-476(saveSkill은 refresh() 없이 onSummaryChanged만 호출), 749-752(replaceSkill은 index로 map). 그러나 스토어는 매 갱신마다 normalizeLearnedSkills로 learnedSkills를 정렬한다: `sort((left, right) => left.level - right.level || ...)`(src/project/databaseRecordModel.ts:666-672). 디테일 폼은 스토어 변경 시 재렌더되지 않는다(renderDetail은 선택 시에만 호출, databaseRecordViews.ts:97-126; 저장소 subscribe로 폼 재구축 없음 — 스킬 뷰 주석도 "재렌더하면 포커스만 잃는다"는 이유로 의도적으로 재렌더를 피한다, databaseSkillRecordView.ts:382). 실제 유실 시나리오: [Lv5 A, Lv10 B]에서 0행 레벨을 20으로 변경 → 스토어 정렬 [B@10, A@20], DOM은 [A@20, B@10] 유지 → 사용자가 1행(화면상 B)의 스킬 select를 C로 변경 → saveSkill(index 1, {level:10, skillId:C})이 스토어의 1번 항목 A@20을 덮어씀 → 스킬 A 습득 계획이 조용히 소멸. 영향: 클래스 스킬 습득표 데이터 유실(플레이 시 스킬 미습득). 수정 제안: saveSkill이 id 기반(또는 편집 전 entry 식별)으로 대상을 찾게 바꾸고, 정렬이 일어나는 편집 후에는 refresh()를 호출해 DOM을 스토어 순서와 동기화.

**[DB-09-9] (high) AI 툴 upsert_state가 runtimeEffects를 얕은 병합 없이 통째로 교체해 기존 전투 규칙 knob 값을 유실한다 (도구 설명 "전달 필드만 병합" 위반)**
`src/editor/tools/dbTools.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/dbTools.ts:694(mergeRecord은 `{ ...(existing ?? {}), ...patch }` 최상위 얕은 병합), 1238-1248(upsert_state). stateRecordSchema의 example이 `runtimeEffects: { hpDamagePercentPerTurn: 5 }`(1242행)처럼 부분 knob을 예시로 주는데, 기존 state_defense_up의 runtimeEffects가 `{ defenseMultiplier: 2, removeOnBattleEnd: true }`(defaultDatabaseStarterRecords.ts:136)일 때 AI가 `upsert_state { id, runtimeEffects: { hpDamagePercentPerTurn: 5 } }`를 호출하면 defenseMultiplier/removeOnBattleEnd가 통째로 사라진다(정규화도 통과 보존만 한다 — databaseRecordModel.ts:87). 도구 설명문은 "기존 id는 전달 필드만 병합하고 임의 필드는 거부한다"(1240행)고 약속하므로 계약 위반이다. 편집기 뮤테이터는 정확히 이 구멍을 이미 막았다: `record.runtimeEffects = { ...record.runtimeEffects, ...patch.runtimeEffects }`(src/editor/databaseActions.ts:319-326 "부분 패치를 병합한다"). upsert_item은 중첩 captureProfile을 명시 병합하는 반면(dbTools.ts:712-715) upsert_state만 누락됐다. …

**[DB-09-10] (medium) 곡선 없이 만든 새 직업의 폴백 능력치 곡선이 선형 20+i*4라 주인공 기본 곡선(514→5140)과 12배 어긋난다**
`src/project/databaseRecordModel.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/databaseRecordModel.ts:685-688(클래스/공용 normalizeCurve: `return Array.from({ length: ACTOR_LEVEL_MAX }, (_, index) => 20 + index * 4);`) vs src/project/actorModel.ts:274-284(주인용: PARAMETER_LEVEL_ONE/PARAMETER_LEVEL_NINETY_NINE의 2차 곡선 — maxHp 514→5140). 새 직업은 곡선 없이 생성된다: `project.database.classes.push(normalizeClassRecord({ id, name: "새 직업", skillIds: [] }))`(src/editor/databaseActions.ts:99). 영향: 새 직업 Lv1 최대 HP 20, Lv99 412로 시드 직업·주인공 기본값(같은 Lv99 5140)과 약 12배 격차 — 이 직업에 배우를 붙이면 밸런스가 무너지는데 곡선 편집기는 그 값을 정직히 보여줄 뿐 경고가 없다(databaseClassCurveEditors.ts:20-36). 또한 여섯 키(maxHp~agility)가 전부 동일한 20..412 직선이라 "전사/마도사" 구분이 없다. 수정 제안: 클래스 폴백도 actorModel의 파라미터별 기본 곡선(PARAMETER_LEVEL_ONE/NINETY_NINE 2차식)을 재사용해 단일 출처로 통일.

**[DB-09-12] (medium) 속성 개수 축소 시 skill.elementId 잔존 참조가 정리되지 않아 스킬 폼 select가 공란이 되고 런타임은 침묵 속 중립 처리한다**
`src/project/io/references.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseElementsClassic.ts:169-179(applyElementCount → `pruneDanglingElementRates(project)`), src/project/io/references.ts:1404-1415(prune 대상은 `actor/enemy/class elementRates` 세 곳뿐). 스킬의 elementId는 정리되지 않는다. 이후 src/editor/panels/databaseSkillRecordView.ts:405-407의 속성 select는 `record.elementId ?? ""`를 options에 없는 값으로 세팅하며 폴백 옵션도 없어(selectedIndex -1, 빈 칸 표시 — 같은 파일의 stateSelectField는 542-544행에서 폴백 옵션을 추가하는 모범 패턴을 이미 쓴다), 런타임은 `element?.damageMultipliers` 미존재로 중립 1.0을 반환(runtime.ts:2234-2236)하지만 UI는 선택값이 "없음"인지 "유령 참조"인지 구분 불가. 컴포저는 원시 id를 보여준다(databaseSkillComposerModel.ts:107 `|| record.elementId`). 수정 제안: pruneDanglingElementRates가 skill.elementId(및 장비 attackElementIds/elementalDefenseIds)도 scrub하고, 스킬 속성 select에 폴백 옵션+경고를 추가.

**[DB-09-16] (medium) 스킬 종류 "순간 이동(teleport)"·"도주(escape)"는 저작 UI에 동작이 있는 것처럼 제공되지만 런타임에서 아무 행동도 하지 않는다**
`src/editor/panels/databaseSkillRecordView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseSkillRecordView.ts:102(selectLiteral 종류 4옵션), src/editor/databaseRecordMutators.ts:182-184(isSkillType 화이트리스트). 소비처 전수 조사 결과: growthTreeArt.ts:19-20(아이콘), battleCommandDom.ts:421(skillSubset 필터), 라벨(copy)뿐이고 src/battle·src/player에는 전투 행동 분기가 없다(전투 종류 enum은 명령 쪽 RuntimeBattleCommandKind와 별개, battleCommands.ts:4). 즉 사용자/AI가 "도주" 스킬을 만들어 배우에게 주어도 전투 중 사용하면 일반 스킬과 동일하게 effect만 실행되고 도주나 순간이동은 일어나지 않는다. 위키 계약(editor-database.md:1736 "승급 간선은 기존 ClassRecord.promotions"처럼 소유권을 명확히 문서화하는 방식)과 달리 이 2종의 런타임 미구현은 어디에도 기록돼 있지 않다. 수정 제안: 미구현 타입은 옵션에서 숨기거나, 폼 힌트에 "런타임 동작 미연결"을 표기하고 구현 시 escape는 도주 판정, teleport는 필드 이동 경로를 연결.

**[DB-09-3] (medium) 상태 폼의 특수 플래그·애니메이션 번호·MP(턴/걸음)·HP(걸음) 컨트롤은 런타임 소비자가 없는 죽은 저작이다**
`src/editor/panels/databaseStateRecordView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseStateRecordView.ts:61,83-92,204-223,243. (1) "특수" 패널 5개 체크박스(100% 회피/마법 반사/장비 고정/회피 불가/장비 고정 영향 없음)가 쓰는 specialFlags는 editor/project/ontology/types에만 존재하고 src/battle·src/player 소비자가 0건(grep 전수 확인). (2) "맵 이동(걸음당)" HP/MP(hpReleaseStep/mpReleaseStep)와 "MP 전투 중(턴당%)"(mpReleaseTurn)도 resolvedStateValues가 hpMove/mpMove/mpTurn 문자열로 만들 뿐(databaseStateOntology.ts:361-363) 읽는 곳이 없다 — battleStates.stateBehavior는 hpTurn만 해석한다(battleStates.ts:67). (3) "애니메이션 번호" animationIndex(stateRecordView.ts:243, 0~999)도 전투/플레이어 소비자 없음. 영향: 사용자는 RM2k3식 걸음당 MP 감소, 마법 반사 등을 저작했다고 믿지만 게임에서 아무 일도 없고, AI 조수도 upsert_state로 이 필드를 채워도 효과가 없다. 수정 제안: 미구현 필드는 패널에서 제거하거나 "런타임 미구현" 배지로 명시하고, 구현할 계획이라면 stateBehavior/upkeep에 소비 경로를 추가.

**[DB-09-5] (medium) 직업 속성 유효도 행이 하드코딩 12 속성 목록이라 확장 속성의 직업측 내성을 저작할 수 없다 (적 뷰와 이원화)**
`src/editor/panels/databaseClassRecordView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseClassRecordView.ts:29-45(ELEMENT_RATE_LABELS 12종 상수), 673(`source = ... : ELEMENT_RATE_LABELS`). 반면 적 뷰는 `: database.elements ?? []`로 프로젝트 데이터를 권위로 쓰며 그 이유를 주석으로 남긴다(databaseEnemyRecordView.ts:790-796: "속성 행은 하드코딩 목록 대신 프로젝트 데이터를 쓴다 — 런타임(runtime.ts elementMultiplierFor)이 database.elements 를 권위로 본다"). 속성 탭은 확장 가능하다: databaseElementsClassic.ts:124-148의 "+ 추가"·"최대 개수" 대화상자(1~99)와 resizeElementRecords. 요소 주석도 같은 실패 모드를 경고한다(actorModel.ts:53-59 — 시드 표에 없는 속성은 "아무도 ... 저작할 수 없고" 배율이 조기 반환된다). 영향: 사용자가 13번째 속성(예: 기계)을 만들어 스킬에 부여하면, 적은 내성을 저작할 수 있지만 주인공/직업 쪽은 저작 UI 자체가 없어 항상 중립 1.0으로 맞는다. 수정 제안: classRecordView(및 actor 패널)도 database.elements 기반으로 행을 그리되 state_death와 같은 암묵 행만 앞에 고정.

**[DB-09-7] (medium) 승급 행에서 전직을 "(없음)"으로 바꾸면 데이터는 조용히 삭제되는데 DOM 행은 남아 이후 편집이 전부 무시된다**
`src/editor/panels/databaseClassRecordView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseClassRecordView.ts:644-650. `savePromotion`은 `if (!promotion.toClassId) next.splice(index, 1);`로 데이터에서 행을 지우지만 apply()는 refresh()를 호출하지 않으므로(593-607행) 화면에는 지워진 행이 남는다. 이후 사용자가 그 행의 레벨/스위치/아이템을 고쳐도 apply→savePromotion이 또 splice해 저장은 계속 공동이며, 유저는 행이 살아 있다고 믿는다. 실제 시나리오: 승급 추가(기본 toClassId="") → 조건만 입력하다가 실수로 전직을 "(없음)"으로 바꿈 → 행 사라짐(화면엔 보임) → 조건 재입력 아무 효과 없음 → 저장/플레이에선 승급이 없음. 수정 제안: toClassId 공백 시에도 refresh()를 호출해 행을 즉시 제거하고, 제거가 유실을 의미하면 확인 토스트로 알릴 것.

**[DB-09-13] (low) 능력치 곡선 다이얼로그의 레벨 입력 change 핸들러가 빈 칸을 조용히 Lv1로 강제해 — 모듈 스스로 금지한 "원래 Lv1 파괴" 경로가 value 칸과 이중 표준으로 남아 있다**
`src/editor/panels/databaseClassCurveEditors.ts` · 최종 low · 보류 · 확신 medium
위치: src/editor/panels/databaseClassCurveEditors.ts:147-152(`levelInput.addEventListener("change", ...)`가 `activeLevel = clampDialogInteger(dialogInputNumber(levelInput), 1, 99)`로 빈 칸→NaN→1 강제). 같은 다이얼로그의 값 입력 경로는 이 함정을 명시적으로 막았다: 84-92행 "빈 칸·NaN 을 min 으로 폴백하면 보던 값이 Lv1 에 기록되고 원래 Lv1 이 파괴된다... 유효하지 않은 입력은 커밋 대상이 아니다 — 마지막 유효 상태로 되돌리고 이유를 알린다"(토스트+롤백). 그러나 레벨 입력은 같은 invalid 입력에 대해 조용히 1로 세팅되고(clampDialogInteger의 `if (!Number.isFinite(value)) return min;`, 233-235행), 이후 "적용"/"OK"(commitDraft 108-113행이 applyValueToDraft를 먼저 호출)는 levelInput.value="1"을 읽어 그대로 Lv1에 기록한다 — 자문 코멘트가 "고쳤다"고 선언한 시나리오가 레벨 칸 경로로 여전히 도달한다. 수정 제안: 레벨 change 핸들러도 applyValueToDraft와 동일한 검증(무효 시 마지막 activeLevel 복원+토스트)으로 통일.
> 보류 사유: 이중 표준 자체는 사실이다 — 레벨 change 핸들러는 빈 칸을 clampDialogInteger로 조용히 1로 강제·표시를 되쓰고(147-152, 233-235) 값 경로는 롤백+토스트(81-101)를 한다. 그러나 "그대로 Lv1에 기록해 원래 Lv1이 파괴된다"는 종단 주장은 과장: change 핸들러가 syncValueInput으로 값 칸을 Lv1 현재값으로 재동기화하므로(54-57, 150) 즉시 커밋은 같은 값을 되쓰는 no-op이 되고, 파괴가 일어나려면 강제 치환 이후 사용자가 값을 추가 편집해야 한다. …

저심각도 일괄:
- [DB-09-11] (low) 스킬 "사용처" 백링크 내비게이션이 reveal 옵션을 생략해 검색/필터 상태에서는 대상 행이 목록에 노출되지 않는다 — `src/editor/panels/databaseSkillRecordView.ts`
- [DB-09-14] (low) 위키가 주장하는 스킬 애니메이션 수명 메커니즘(activeAnimationStages 폼 단위 WeakMap)은 실제 코드에 존재하지 않는다 (문서-코드 표류) — `openwiki/editor-database.md`
- [DB-09-15] (low) 같은 화면에서 스킬 "종류" 값의 한국어 라벨이 두 체계로 이원화된다 (드롭다운 "장소 이동/탈출" vs 컴포저 칩 "순간 이동/도주") — `src/editor/panels/databaseSkillComposerModel.ts`
- [DB-09-18] (low) 상태 저항 A~E 등급의 한국어 라벨 사다리가 직업 패널과 상태 패널에서 서로 다르다 — `src/editor/panels/databaseClassRecordView.ts`
- [DB-09-19] (low) 직업 상태 유효도 행 생성 시 state_death 중복 필터가 없다 (적 뷰는 같은 패턴에 필터를 둔다) — `src/editor/panels/databaseClassRecordView.ts`
- [DB-09-20] (low) 상태 패널 "상태 유효도" 표는 런타임이 쓰지 않는 온톨로지 값을 readonly <input>으로 보여준다 — 모듈 자문 규약("파생 값은 입력처럼 보이면 안 된다") 위반 — `src/editor/panels/databaseStateRecordView.ts`
- [DB-09-21] (low) 애니메이션 스테이지가 리소스 해석 실패를 "(애니메이션 없음)"으로 표시해 참조 유실과 미지정을 구분하지 못한다 — `src/editor/panels/databaseSkillAnimationStage.ts`

### 6.10 DB-10 — 아이템·장비·인벤토리 카탈로그

**[DB-10-1] (high) 장비 능력치 보정은 음수 저작이 불가한데 기본 카탈로그는 음수 의도 데이터를 배포한다**
`src/editor/panels/databaseEquipmentRecordView.ts` · 최종 high · 확인 · 확신 high
위치·증거: (1) 편집기 폼 — databaseEquipmentRecordView.ts:633-639 statField가 `{ min: 0, max: 9999 }`로 클램프. (2) 정규화 권위 — src/project/databaseRecordModel.ts:716-723 normalizeStatBonuses가 attack/defense/mind/agility 4종 모두 `clampInteger(..., 0, 9999)`. (3) 그러나 기본 카탈로그는 음수를 설계값으로 배포: src/project/defaults/defaultCatalogFillEquipment.ts:53-54 ("성문처럼 두꺼운 판이 타격을 받아 내지만 무거워져 움직임이 크게 둔해집니다." + `agility: -3`), 같은 파일 :78(-1), :119(-3), :162(-1), src/project/defaults/defaultDatabaseEquipmentRecords.ts:93(-1), :187(-1), :201(-1), src/project/defaults/generatedItemRecords.ts:743(-1), :831(-2), :877(-1) 등. 이 레코드들은 정의 시점(normalizeEquipmentRecord 래퍼)과 로드 시점(databaseRecordModel.ts:116 `equipment: database.equipment.map(normalizeEquipmentRecord)`) 모두에서 음수가 0으로 침묵 소실된다. 런타임은 src/battle/battleBattlers.ts:296-299처럼 statBonuses를 그대로 가산하므로 음수가 살아 있으면 적용될 값이다. …

**[DB-10-2] (high) AI 아이템 툴 스키마의 farmTool enum이 FARM_TOOLS 정본과 드리프트 — axe/pickaxe를 AI가 저작 불가**
`src/editor/tools/dbTools.ts` · 최종 high · 확인 · 확신 high
위치·증거: src/editor/tools/dbTools.ts:451 itemRecordSchema에서 `farmTool: { type: "string", enum: ["hoe", "wateringCan"] }` (upsert_item, dbTools.ts:697-698이 사용). 정본은 src/project/farmModel.ts:5 `FARM_TOOLS = ["hoe", "wateringCan", "axe", "pickaxe"]`이고 런타임 규칙도 존재한다 — src/project/toolActions.ts:41-42 `legacy-axe-chop`(axe)/`legacy-pick-mine`(pickaxe). 편집기 패널은 정본 파생을 이미 하고 있으며 databaseItemRecordView.ts:827-829 주석이 이 드리프트를 정확히 경고한다: "하드코딩하면 axe/pickaxe 처럼 런타임 규칙(toolActions legacy-axe-chop/legacy-pick-mine)은 있는데 저작이 불가능한 드리프트가 생긴다". 영향: AI 조수는 도끼·곡괭이 아이템을 스키마 검증 실패로 만들지 못해 UI 저작 표면과 AI 저작 표면이 어긋난다(스코프 특별 지시 축인 AI 사용성 위반). 수정 제안: itemRecordSchema의 farmTool enum을 FARM_TOOLS에서 파생하거나 최소 4값으로 갱신.

**[DB-10-3] (medium) 발동 스킬 있는 특수 아이템에서도 상태 변화 카드가 편집 가능 — 런타임 투영은 해당 값을 폐기**
`src/editor/panels/databaseItemRecordView.ts` · 최종 medium · 확인 · 확신 high
위치·증거: databaseItemRecordView.ts:227 `...(record.type === "medicine" || (record.type === "special" && !record.captureProfile && !record.careProfile) ? [stateEffectsCard(...)] : [])` — activateSkillId/skillId 유무를 검사하지 않아 스킬 발동 특수 아이템에서도 행 추가·확률·부여/해제 편집이 모두 가능. 런타임 권위 src/project/itemUsage.ts:14 `stateEffects: medicine || (special && !item.activateSkillId && !item.skillId && !item.captureProfile && !item.careProfile) ? item.stateEffects : []` — 스킬 있는 특수 아이템의 stateEffects는 메뉴·전투 어디서도 폐기된다. 위키 openwiki/editor-database.md:518도 "stateEffects는 약 또는 발동 스킬 없는 특수 아이템에서 지원한다"고 명시. 카드 힌트(:390 "특수 아이템에 발동 스킬이 있으면 스킬 효과를 사용합니다")로 부분 완화되지만, 편집 가능한 컨트롤이 죽은 값을 쓰게 하고 상단 효과 요약(itemEffectStory는 투영 사용)에는 반영되지 않아 폼↔런타임 불일치. 수정 제안: :227 조건에 `!record.activateSkillId && !record.skillId`를 추가하거나, 스킬 존재 시 카드를 비활성화하고 안내 문구로 대체.

**[DB-10-4] (medium) 카탈로그 목록 스크롤 복원이 죽은 코드 — 재렌더마다 목록이 최상단으로 점프**
`src/editor/panels/databaseInventoryCatalog.ts` · 최종 medium · 확인 · 확신 high
위치·증거: databaseInventoryCatalog.ts:46 `rows.scrollTop = listScrollTopForCollection("items")` — 이 시점 rows는 자식이 0개(행은 :137-180 renderRows가 :201에서 처음 채움)라 스크롤 높이 0으로 설정이 무효. renderRows는 :156에서 현재 scrollTop(=0)을 캡처해 :178 `rows.scrollTop = scrollTop`으로 되돌릴 뿐 세션값을 다시 적용하지 않는다. 스크롤 리스너(:47)는 계속 세션에 저장만 한다. 참고로 같은 화면군의 정합 패턴은 databaseRecordViews.ts:151-153 — "가상 목록 경로와 같은 규약으로 프레임 뒤에 복원한다" `if (restoredStudioScrollTop > 0) scheduleFrame(() => { listEl.scrollTop = restoredStudioScrollTop; })`. 영향: 추가·복제·AI 생성·삭제(refreshAfterMutation → rerender)와 DB 모달 재열기 때마다 통합 카탈로그 목록이 최상단으로 튄다(위키 editor-database.md:513이 .db-catalog-rows를 유일 목록 스크롤로 명시한 계약과도 어긋남). 수정 제안: renderRows 완료 후(또는 scheduleFrame 콜백에서) 세션 scrollTop을 rows에 적용.

**[DB-10-5] (medium) 카탈로그 필터에 가려진 선택 항목이 삭제 가드를 우회해 2클릭 삭제된다**
`src/editor/panels/databaseRecordViews.ts` · 최종 medium · 확인 · 확신 high
위치·증거: 카탈로그는 databaseInventoryCatalog.ts:100에서 공용 `deleteButton(current.collection, rerender)`을 재사용한다. 카탈로그의 가시성은 :140-141처럼 session.filter/session.subtype으로 결정되며, 선택 항목이 필터 밖에 남는 상태는 공식 지원 시나리오다(:181-190 db-catalog-selection-notice가 존재하는 이유). 그러나 deleteButton의 가시성 가드(databaseRecordViews.ts:388 `const isVisible = visibleRecordRows(collection, records).some(...)`)는 :487-496에서 per-collection 세션의 검색어(searchQueryForCollection)·카테고리 필터(effectiveCategoryFilter)만 읽는다 — 카탈로그의 session.filter/subtype은 검사 대상이 아니다. deleteButton 자신의 주석(databaseRecordViews.ts:384-386)은 "그 상태의 2단계 확인은 화면에 없는 레코드를 겨냥한다 — 파괴 동작으로는 허용할 수 없다"고 선언한다. 영향: 예컨대 카탈로그를 '장비' 필터로 좁힌 채 선택된 아이템(목록에 안 보임)에서 삭제 2클릭 시 가드 없이 삭제가 진행된다(카탈로그 검색어만은 세션 키를 공유해 걸린다). 수정 제안: 가드에 카탈로그 세션의 filter/subtype 가시성을 포함하거나, 카탈로그에서는 필터 밖 선택 시 삭제 대신 reveal 안내로 강제 전환.

**[DB-10-6] (medium) 아이템 기본 카드 힌트가 제거된 '종류를 장비로 바꾸기' 경로를 안내하고, 장비형 행에서는 반대 문구와 공존한다**
`src/editor/panels/databaseItemRecordView.ts` · 최종 medium · 확인 · 확신 high
위치·증거: databaseItemRecordView.ts:257 힌트 — "종류를 바꾸면 이전 효과는 보관되며 적용되지 않습니다. 착용할 물건은 목록 아래의 '+ 추가'로 만든 뒤 종류를 장비로 바꾸세요." 그러나 itemTypeField(:267-274)는 `ITEM_TYPES.filter((type) => !isEquipmentItemType(type) || type === record.type)`로 장비 종류를 현재 종류(레거시 행) 외에는 선택지에서 제거하므로 이 지시는 따를 수 없다. 더 심하게, 장비형 레거시 행에서는 basicsCard의 이 힌트(:219에서 basicsCard + equipmentRedirect 동시 렌더)가 equipmentRedirect의 문구와 같은 화면에서 정면으로 상충한다: databaseItemRecordView.ts:535 "이 항목은 이전 형식의 비착용 물품입니다. 장비로 변환되거나 연결되지 않습니다." 위키 openwiki/editor-database.md:520도 "신규 아이템 종류에는 장비형이 없다. 기존 장비형 행만 유지해 비착용 물품임을 안내한다. 실제 장비로 자동 연결·변환하지 않는다"가 정본. 영향: 저작자가 제거된 변환 경로를 찾아 헤매고, 장비형 행에서는 상반된 안내 두 개가 동시 노출된다. 수정 제안: 힌트를 '+ 장비' 버튼 안내로 교체하고, 장비형 행에서는 해당 문장을 노출하지 않도록 분기.

저심각도 일괄:
- [DB-10-7] (low) 장비 효과 스토리·요약 칩이 명중률 0%·치명타율 +0%p를 항상 효과로 표기 — 빈 효과 분기가 도달 불가 — `src/editor/panels/databaseEquipmentRecordView.ts`
- [DB-10-8] (low) 카탈로그 검색 쿼리가 trim 없이 비교된다 — 뒤 공백 하나로 0건 — `src/editor/panels/databaseInventoryCatalog.ts`
- [DB-10-9] (low) 포획 배율 0 입력이 captureProfile을 조용히 삭제하고 토글·카드 표시와 어긋난다 — `src/editor/panels/databaseBasicRecordFields.ts`

### 6.11 DB-11 — 세계관·생성 규칙·마을 하네스

**[DB-11-1] (high) 세계 생성 탭의 텍스트·숫자 입력이 글자 한 개마다 전체 탭 리렌더를 유발해 캐럿/포커스가 소실된다**
`src/editor/panels/databaseWorldGenView.ts` · 최종 high · 확인 · 확신 high
위치/증거: databaseControls.ts:15-18의 textControl은 `input.addEventListener("input", () => onInput(input.value))`로 글자마다 콜백을 부르고, sliderStepperField도 stepper의 input 이벤트마다 commit→onInput을 부른다(databaseControls.ts:111-114). 그런데 databaseWorldGenView.ts는 이 콜백에서 전체 탭 rerender를 건다 — 미리보기 쿼리(145-153 `previewQuery = value; rerender()`), 규칙 이름(477-489→upsertRule→645 rerender), 낱말(511-526), 제외 낱말(527-542), 그리고 수치 stepper(249-254 등 patchWater/patchForest→590/606 rerender). database.ts의 rerender 경로는 renderActiveTab→renderActiveTabUnguarded인데 929-934 `commitFocusedControlIn`이 활성 컨트롤을 `active.blur()` 하고 1000 `body.replaceChildren()`으로 DOM을 통째로 다시 만든다(포커스 복원 없음). 영향: "이 말로 시험해 보기"나 낱말 규칙의 "이런 말이 나오면"에 `강가`를 치려면 첫 글자 `강` 입력 직후 입력칸이 파괴돼 포커스가 body로 떨어진다 — 두 글자째를 못 친다. …

**[DB-11-2] (high) set_world_canon의 법칙(laws) 부분 병합이 전달하지 않은 present/note를 조용히 초기화한다**
`src/editor/tools/worldCanonTools.ts` · 최종 high · 확인 · 확신 high
위치/증거: worldCanonTools.ts:58-63 — `laws`에 낱개 법칙을 넘기면 `return [[key, { present: value.present, note: typeof value.note === "string" ? value.note.trim().slice(0,160) : "" }]]`로 그 법칙 객체를 통째로 재구성한다. `value.present`가 없으면 undefined, `value.note`가 없으면 ""가 된다. 즉 기존 `laws.money = {present:false, note:"금화만 통용"}` 상태에서 AI가 `set_world_canon({canon:{laws:{money:{note:"동화도 통용"}}}})`을 부르면 present:false가 사라져 "없음→미정"이 되고, note만 고치려고 `{present:true}`를 넘기면 기존 note가 ""로 지워진다(compactWorldCanon은 note 빈 법칙을 `{present:true}`만 남긴다). 스칼라 필드는 `raw.status === undefined ? resolved.status : …`(65행)처럼 필드 단위 병합인데 법칙만 객체 치환이라 명백한 비대칭이다. 영향: (1) 툴 description(74행 "기존 값은 전달한 필드만 병합한다")과의 계약 위반, (2) 사람이 DB에서 박아 둔 "없음" 판정이 유실되어 worldCanonPromptSection(src/ai/worldCanonContext.ts:49-53)의 `힘: 없음` 문장이 프롬프트에서 빠지고 AI가 금지 세계관을 자유 발명할 여지를 만든다. …

**[DB-11-3] (medium) 생성 규칙 예시 프리셋 적용이 저자가 만든 낱말 규칙과 내장 규칙 끔 상태를 경고 없이 통째로 지운다**
`src/editor/panels/databaseWorldGenView.ts` · 최종 medium · 확인 · 확신 high
위치/증거: databaseWorldGenView.ts:227-236 — 프리셋 카드 클릭이 `store.update((draft) => { draft.system.worldGen = structuredClone(preset.rules) })`로 system.worldGen을 통째로 교체한다. 그런데 모든 프리셋 규칙(src/project/worldGenPresets.ts:24-29, 36-41 등)은 `{presetId, water, forest, road}`만 담고 keywords와 useBuiltinKeywords는 없다. 영향: 저자가 "낱말 규칙 추가"로 만든 커스텀 규칙(`keywords: [{id:"rule-…", words, landmarks}]`)과 "내장 규칙 쓰기" 끔 토글(`useBuiltinKeywords:false`)이 확인 창·토스트 경고 없이 삭제된다. undo(recordProjectSnapshot)로 복구는 가능하지만 카드 문구(196행 "누르면 그 규칙이 그대로 들어옵니다. 뒤에서 값을 더 만질 수 있습니다.")는 낱말 규칙 소실을 전혀 알려주지 않고, 적용 직후 "내가 만든 규칙" 섹션이 텅 비는 걸 눈치챈 사용자만 손해 본다. world-generation-rules.md L17의 옵트인 희소 저장 계약과도 맞지 않는 유일한 전체 교체 경로다. 수정: `water/forest/road`만 교체하고 `keywords/useBuiltinKeywords`는 기존 값을 유지하거나, 교체 시 낱말 규칙 소실을 토스트로 명시.

**[DB-11-4] (medium) villagePlan의 테마 추론이 VILLAGE_ARCHETYPES 정본의 사본으로 갈라져 있다(목축·채석 누락)**
`src/editor/tools/villagePlan.ts` · 최종 medium · 확인 · 확신 high
위치/증거: authoringData.ts:71-72는 "테마 추론(matchVillageArchetype)과 … 같은 배열을 읽는다. 한쪽만 고쳐서 갈라질 자리를 없앤다"고 못 박았고 실제로 builder.ts:1619-1620의 inferIntentFromTheme는 `matchVillageArchetype(theme)?.values`로 정본을 쓴다. 그러나 villagePlan.ts:614-637의 inferFromTheme는 같은 표를 정규식으로 재구현한 별도 사본이며 이미 어긋나 있다 — (1) farm-rural 원형의 "목축"(authoringData.ts:106 keywords에 포함)이 plan 쪽 정규식(627행 `/농|밭|촌락|farm|rural|목장/`)에는 없고, (2) mine-mountain의 "채석"(113행)이 630행 정규식에 없고, (3) farm-rural의 `plazaLayout:"center"`(108행)가 plan 사본(628행)엔 빠져 있다. 영향: 같은 테마 문장에서 plan_village(normalizeVillagePlan→142행 inferFromTheme)와 author_village(resolveVillageIntent→matchVillageArchetype)가 다른 pathStyle/yardStyle/plazaLayout 기본값을 내놓는다. "목축 마을"은 author_village에선 농촌 원형(광장 가운데)이 적용되지만 plan_village에선 아무 원형도 걸리지 않는다. DB 마을 탭 원형 갤러리 문구(databaseVillageView.ts:1698 "AI 는 테마 문장으로도 같은 원형을 고른다")도 깨진다. …

**[DB-11-5] (medium) MIN_HOUSES/MAX_HOUSES가 파일마다 이중 정의돼 있고 값이 서로 다르다(plan=4 vs build=1)**
`src/editor/tools/villagePlan.ts` · 최종 medium · 확인 · 확신 high
위치/증거: villagePlan.ts:102-105 — "마을 집 수 경계 — plan/build 공유 단일 소스(구버그: plan=12 vs build=32로 파일마다 달라 드리프트)"라는 주석과 함께 `MIN_HOUSES=4, MAX_HOUSES=32`를 정의한다. 그러나 village/constants.ts:79-82에도 `MIN_HOUSES=1, MAX_HOUSES=32`가 별도로 있고, builder.ts:49-58은 constants 쪽을 import한다(1463행 `Math.min(MAX_HOUSES, Math.max(MIN_HOUSES, housesArg))`). 즉 "단일 소스" 주석은 사실이 아니며 MIN은 이미 어긋나 있다(4 vs 1). 영향: plan_village는 집 2채 계획을 4채로 패딩하며 경고(villagePlan.ts:507-523)하는데, author_village 직접 경로는 houses:1을 그대로 받아 1채 마을을 시공한다(1463행). 두 도구가 최소 집 수 계약을 달리한다. 지금은 MAX가 우연히 일치(32)하지만 이 주석이 경고하는 바로 그 드리프트 구조가 살아 있다. 수정: villagePlan의 상수를 village/constants.ts 재수출로 바꾸거나 그 반대로 단일 정의를 만들고, 최솟값 차이(4 vs 1)가 의도라면 주석과 양쪽 스키마 description에 명시.

**[DB-11-6] (medium) presetOverrides가 범위 밖 수치를 '경고 없이 키 삭제'로 버리는데, AI 컨텍스트는 원본 값을 그대로 약속한다**
`src/editor/tools/village/authoringData.ts` · 최종 medium · 확인 · 확신 medium
위치/증거: authoringData.ts:6 헤더는 "저장된 레코드는 신뢰하지 않는다 — 열거형·범위를 여기서 좁히고, 못 쓰는 값은 경고로 흘린다"고 선언한다. 그러나 presetOverrides(350-375행)에서 roadWidth/houseCount/npcCount는 pickInt(345-348행)가 범위 밖이면 `undefined`를 돌려 키째 드롭한다(클램프 아님), roadNaturalness만 클램프한다(357-359행). 경고는 하나도 발생하지 않는다(경고는 villageTemplateCatalog의 형태 id 쪽에만 존재). 설계서 경로는 designContract.ts:33-34에서 npcCount 등을 하드 에러로 잡지만 여기에도 houseCount가 빠져 있다. 영향: 파일로 들어오거나 구버전에서 남은 `roadWidth:4, houseCount:99` 레코드는 씨앗값 폴백으로 조용히 시공되는데, 같은 레코드를 그대로 표시하는 AI 컨텍스트(src/ai/contextBuilder.ts:554-563 `집 ${preset.houseCount}채`, `폭 ${preset.roadWidth}`; 580-581행 "이 id를 쓰면 유저가 정한 값 그대로 시공됩니다")가 모델에 거짓 약속을 한다 — 모델은 유저가 집 99채를 원한 줄 알고 보고하고 실제로는 면적 파생 값(기본 8)이 깔린다. 참고로 DB UI는 optionalNumber에서 클램프 후 저장하므로 UI로만 만든 레코드는 안전하다(그래서 드러나지 않는 결함). 수정: pickInt도 roadNaturalness처럼 클램프하거나, 드롭 시 warnings 반환 경로를 만들어 builder 경고와 AI 컨텍스트 표시를 presetOverrides 값으로 통일.

**[DB-11-7] (medium) "왼쪽에 강" 같은 위치 표현이 대상 구분 없이 숲 배치(forestAnchor)로 적용되어 수역 위치 요청이 무시된다**
`src/editor/tools/villageRequirements.ts` · 최종 medium · 확인 · 확신 high
위치/증거: villageRequirements.ts:75-83 — `const spoken = parseSpatialPhrase(q); const forestAnchor = spoken ? … : undefined;` — 쿼리에서 방향 표현이 보이면 그 대상이 무엇이든 무조건 숲 앵커로 저장한다. parseSpatialPhrase(src/ai/viewRelativeLocation.ts:49-52)는 "왼쪽/서쪽/북쪽" 등을 문장 전체에서 대상 구분 없이 매칭한다. 그리고 buildTerrainConstraintMasks(villageTerrainPass.ts:104-107)는 `requirements.forestAnchor ? resolveSpatialRect(area, requirements.forestAnchor) : sideRect(…forestSide…)`로 앵커가 있으면 forestSide를 무시한다. 영향: (1) "강이 서쪽에 있는 마을" → 강은 기본 서쪽(또는 DB 저작값), 숲도 서쪽(앵커)으로 깔려 물과 숲이 같은 편에 몰린다 — 숲은 물 반대편이 기본이라는 자기 설계 주석(32행 "강 반대편·저작 기본값을 이긴다", 67-69행)과 모순. (2) "북쪽에 호수" → 호수 기본 방향이 북(71-73행)인데 숲도 북쪽 앵커로 붙어 호수 마스크와 겹치고(skipWater로 물 칸 제외) 숲이 호수 테두리에만 남는다. 사용자가 말한 수역 위치는 어디에도 반영되지 않는다(riverSide에는 spoken 앵커 경로가 아예 없다). 수정: 방향 표현의 대상(강/호수/숲)을 구문으로 구분하거나, 수역 랜드마크가 있을 때 앵커를 수역 쪽에 적용하는 우선순위를 정의하고 나머지를 반대편에 배치. 최소한 requirements에 riverAnchor를 두고 마스크 생성에 반영.

**[DB-11-8] (medium) db-village-footprint-large testid가 한 화면에 두 번 렌더될 수 있다(칩셋 없는 프로젝트)**
`src/editor/panels/databaseVillageView.ts` · 최종 medium · 확인 · 확신 high
위치/증거: databaseVillageView.ts:763 — 날개 배치 **인터랙티브 격자**(footprintEditor)가 `dataset: { testid: "db-village-footprint-large" }`를 쓰고, 같은 파일 995행 footprintPreview의 hero 폴백 추상 격자도 `dataset: { testid: options.large ? "db-village-footprint-large" : … }`를 쓴다. houseKitTileset(project)가 없는 프로젝트에서는 hero가 footprintPreview({large:true})로 내려앉는다(1016-1024행, 1011-1012행 주석이 "재료가 없는 프로젝트도 있다"고 명시) — 이때 템플릿 상세 하나에 동일 testid가 두 개(hero의 정적 격자 + 날개 편집 격자) 렌더된다. 같은 파일 1267-1268행은 "testid 조회는 정확 일치이므로 겹치면 조상 div 가 먼저 잡힌다"고 스스로 경고하며 카드 testid를 겹치지 않게 했는데, 여기서는 자기 규칙을 어긴다. 영향: 칩셋 없는 프로젝트에서 querySelector(`[data-testid=db-village-footprint-large]`)·e2e getByTestId가 DOM 순서상 앞선 hero 정적 격자를 잡아, 날개 드래그/키보드 편집을 검증하려던 테스트·QA가 조용히 잘못된 노드를 보게 된다(위키 L1440도 이 testid를 격자 미리보기의 정본 앵커로 기술). 수정: 폴백 미리보기를 `db-village-footprint-hero` 등으로 분리하거나, 인터랙티브 격자에 별도 testid를 부여해 위키 계약과 정렬.

저심각도 일괄:
- [DB-11-10] (low) set_world_canon으로는 이름·전제·시대·기술·본문 스칼라 텍스트를 빈 값으로 지울 수 없다 — `src/editor/tools/worldCanonTools.ts`
- [DB-11-11] (low) 세계관 '없는 것' 항목을 Enter로 추가하면 입력 포커스가 사라져 연속 추가가 안 된다 — `src/editor/panels/databaseWorldCanonFields.ts`
- [DB-11-12] (low) 위키 정본이 더 이상 없는 레일 구조(맵 그룹 첫 탭 '생성 규칙'·마을 탭 위치)와 죽은 testid를 기술한다 — `openwiki/editor-database.md`
- [DB-11-13] (low) 미리보기 나무 산포가 place_props와 다른 거리 규칙을 쓴다(활엽수는 간격 +1 근사 포함) — `src/editor/panels/worldGenPreview.ts`
- [DB-11-9] (low) set_world_canon 스키마가 저장 시 사라지는 유사값 status:"secret"을 여전히 광고한다 — `src/editor/tools/worldCanonTools.ts`

### 6.12 DB-12 — 공간·장소·구조물 저작

**[DB-12-1] (high) 레벨 삭제가 클릭한 레벨뿐 아니라 그 위의 모든 레벨을 몰래 지운다**
`src/editor/panels/databaseFarmSpatialView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseFarmSpatialView.ts:1283 `store.update((project) => { project.database.farmBuildingTypes?.[typeIndex]?.levels.splice(levelIndex); });` — splice에 삭제 개수 인자가 없어 levelIndex부터 배열 끝까지 전부 삭제한다. 이 버튼은 각 레벨 카드마다 하나씩 렌더링되고(같은 파일:753-757 `inlineDeleteButton(..., `Lv.${level.level} 삭제`, ..., true)`), 2단계 확인 문구는 confirmDeleteButton 기본값 「정말 삭제?」(:431, :64-66)뿐이라 여러 레벨이 함께 지워진다고 알려주지 않는다. 건물 유형이 Lv.1~5일 때 Lv.3 삭제를 누르면 Lv.4·5도 소멸한다. 영향: (1) 토스트(:1284)는 단수형 「업그레이드 레벨을 삭제했습니다」로 안내, (2) 삭제된 level을 가리키던 시작 배치(session.farmBuildingPlacements[].level)는 어디서도 보정되지 않아 project/io/references.ts:945-948 `level does not exist on farmBuildingType` 검증 위반이 되고, 다음 로드 시 repairSpatialReferences(references.ts:998-1006, shape.ts:87에서 로드 경로 호출)가 그 배치를 조용히 버린다. 수정 제안: `splice(levelIndex, 1)`로 바꾸고, 상위 레벨을 함께 지우는 정책이 의도라면 확인 문구에 「Lv.N 이상 N단계 삭제」를 명시하고 남은 배치의 level을 1로 클램프할 것.

**[DB-12-2] (high) 자동 배치(findFreePosition)가 유형의 allowedMapIds 제한을 무시한다**
`src/editor/panels/databaseFarmSpatialView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseFarmSpatialView.ts:1215-1233 addBuildingPlacement와 :1235-1252 addDecorationPlacement가 :1254-1266 findFreePosition(project, footprint, orientation)으로 자리를 고르는데, 이 함수는 `Object.values(project.maps)`를 순회하며 canOccupySpatialFootprint만 보고 유형 레코드를 아예 인자로 받지 않는다 — type.allowedMapIds(같은 파일:560, :862에서 편집하는 「허용 맵」 제한)를 전혀 반영하지 않는다. 그런데 런타임·검증 계약은 allowedMapIds를 정본으로 본다: src/project/animalHousing.ts:29-30은 허용 맵 밖 배치의 동물 주거를 undefined로 무시하고, src/project/spatialPlacementTransactions.ts:40/:59, spatialPlacementRestore.ts:26/:37은 mapAllowed 위반 배치를 거부하며, project/io/references.ts:1036-1038은 `mapId is not allowed by type` 이슈를 낸 뒤 repair(참조:998-1006, 로드 시 shape.ts:87)가 배치를 삭제한다. 영향: 유형이 mapB만 허용하는데 mapA에 빈칸이 먼저 있으면 시작 배치가 mapA에 만들어지고, 그 배치에 배정된 동물은 조용히 주거를 잃으며, 다음 로드에서 사용자 승인 없이 배치가 사라진다. …

**[DB-12-3] (high) 배치 수동 편집(X/Y/맵/방향)은 겹침·맵 경계·허용 맵 검증을 전혀 하지 않고, 다음 로드 때 몰래 삭제된다**
`src/editor/panels/databaseFarmSpatialView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseFarmSpatialView.ts:1363-1367 patchBuildingPlacement / :1369-1373 patchDecorationPlacement / :950-953 placementWhereCard의 patch()는 X·Y·맵·방향 변경을 값 그대로 저장한다. X/Y numberField 상한은 :964-965 `{ min: 0, max: 9999 }`로 실제 맵 크기(예: 40×30)와 무관하다. canOccupySpatialFootprint는 이 파일에서 :1261(자동 배치) 한 곳에서만 쓰이므로, 수동 편집으로 맵 밖 좌표·다른 배치와 겹치는 칸·(유형이 삭제된 장식의 :935 `type?.allowedOrientations ?? ORIENTATIONS` 폴백으로 인한 허용 외 회전)이 모두 무검증 저장된다. 이 데이터는 project/io/references.ts:938-967 검증에서 이슈로 플래그되고(shape.ts:87 로드 경로) repairSpatialReferences(references.ts:998-1018)가 조용히 삭제한다 — 사용자에게는 편집이 성공한 것처럼 보이다가 다음 로드에서 배치가 사라진다. 같은 파일 :533 온보딩 문구는 「충돌 영역이 겹치면 배치되지 않습니다」라고 약속하지만 이는 자동 배치에만 참이다. 수정 제안: patch 경로에서 mapId/x/y/orientation 변경 시 canOccupySpatialFootprint+mapAllowed+validCoordinates를 재검사해 거부 토스트를 내고, numberField 상한을 대상 맵 크기로 맞출 것.

**[DB-12-4] (high) register_structure_kit(AI)이 같은 id의 기존 킷을 확인 없이 통째로 덮어써 저작 데이터를 유실한다**
`src/editor/tools/structureKitTools.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/structureKitTools.ts:366-367 `const existing = tileset.structureKits ?? []; tileset.structureKits = [...existing.filter((entry) => entry.id !== kitId), kit];` — 같은 id의 기존 킷을 필터로 제거하고 ai 메타(description·placementRules·tags·role·repeatability·growthAxis), parts, cellHints, layerHome 선언이 없는 알맹이 킷(learnedFrom:"user-paint", :357-365)으로 교체한다. 확인·거부 절차가 없다. 반면 사람 등록 경로는 구조물 서명 중복 등록 차단 계약이 있다: src/editor/harnessSuggestion/structureKitActions.ts:23-25는 같은 서명이면 기존 킷을 재사용하고, 구조물 파일 가져오기도 structureKitFile.ts:369-374 `existingSignatures.has(structureKitSignature(kit))`로 사본이 쌓이지 않게 한다. 이 AI 툴은 그 계약을 전부 우회한다. 영향: 모델이 기존 킷 id를 재사용해 register_structure_kit을 부르면, 사람이 AI 메타 탭에서 공들인 배치 조건·증분 축·칸 힌트가 승인 전파에서 통째로 사라진다. 수정 제안: 사람 경로와 같은 structureKitSignature 중복 판정을 도입하고, id 충돌 시 교체가 아니라 자동 리네임 또는 ToolError(kit-exists)로 막을 것.

**[DB-12-5] (high) upsert_spatial_design의 place 본문 스키마가 도메인 파서 필수 필드를 충족하지 못해 스키마 적합 호출이 항상 실패한다**
`src/editor/tools/spatialToolSchemas.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/spatialToolSchemas.ts:46-47 places 본문은 `{ ...object({ ...spaces.properties, ...groupedPlaces.properties }, Object.keys(base)) }` — required가 id·name·revision·tags·provenance뿐이다. 그러나 런타임 파서는 변형별 필드를 무조건 요구한다: src/project/spatial/guards.ts:133-135(place)는 kind(facility/settlement/natural)·children·layout을, guards.ts:85-88+107(space)는 environment·tilesetId·shape·width·height·floor·wall·objectSlots·ports와(실내는) role을 필수로 파싱하고, references.ts:97은 실외 floorAreas 비어 있음을 거부한다. 즉 스키마가 허용하는 `{id,name,revision,tags,provenance}` 본문은 파서에서 100% 실패한다. …

**[DB-12-6] (medium) list_structure_kits가 rows 없는 malformed 킷에서 ToolError가 아닌 TypeError로 크래시한다**
`src/editor/tools/structureKitTools.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/tools/structureKitTools.ts:111 `rows: kit.rows.map((row) => ({ tiles: [...row.tiles], ... }))` — availableKits(:32-35)는 `kit.kind === "section"`만 걸러 rows 부재를 검사하지 않는다. 타일셋의 structureKits는 사용자 데이터로서 optional(types/base.ts:498-499)이고, 위키 openwiki/editor-database.md L1098은 DB 탭에 「rows 없는 malformed 킷 무크래시」를 명시 계약으로 둔다. 같은 파일이 쓰는 structureKitUnitCells(src/editor/harnessSuggestion/structureKitModel.ts:94-99)는 `kit.rows.length` + `rowDef.tiles[column] ?? TILE.EMPTY`로 방어하는데 list 툴만 방어가 없어 TypeError가 ToolError 밖으로 던져진다. 영향: 과거 저장본·손상 프로젝트에서 list_structure_kits 한 번이 툴 호출을 크래시시켜, DB 탭에서는 열리는 킷 목록을 AI는 아예 읽지 못한다. 수정 제약: `(kit.rows ?? []).map(...)` + 행 정규화로 DB 탭과 같은 무크래시 계약을 맞출 것.

**[DB-12-7] (medium) applyStampStructureKit과 전용 헬퍼 5개가 호출부 없는 죽은 코드이고, 헤더 주석의 「사람 팔레트 시공 엔진」 주장은 거짓이다**
`src/editor/tools/structureKitTools.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/tools/structureKitTools.ts:128 댓글 「사람 팔레트 시공 엔진. 사람 스탬프 경로에서만 부른다」와 applyStampStructureKit(:129-211)은 저장소 전체에서 호출부가 0개다(exported 함수 본문 정의만 검색됨). 실제 사람 스탬프 경로는 TilePaintEngine.ts:162 applyPaletteStamp(킷→paletteStampFromKit, structureKitModel.ts:162-174)와 structurePlacementActions.ts:85의 evaluatePlacementConditions다. toolRegistry.ts:90 주석도 stamp_structure_kit 등록 자체가 제거됐다고 기록한다. 남은 것은 시공 로직의 사본(증분 축 클램프 :134-145, 배치 조건 평가 :169-183, placement 기록 :187-191)이며, 내부 stampKitCells(:230-245)의 repeat 인자는 x축 오프셋만 반복하는 죽은 인자고 호출부(:189)는 항상 1을 넘긴다. 영향: 라이브 경로와 드리프트한 사본이 「시공 엔진」으로 오독되며, 사람 경로 에러 문구·클램프 정책을 고칠 때 이 죽은 코드를 같이 고치는 부담(혹은 잘못된 자신감)을 만든다. 수정 제안: applyStampStructureKit과 전용 헬퍼(absoluteKitParts:214-227, stampKitCells:230-245, resolveKit:257-292, originArg:294-300, repeatArg:302-310)를 삭제하고 사람 경로 단일 정본임을 헤더 주석으로 명시할 것.

**[DB-12-8] (medium) housingImpactNotices가 프로젝트 전환·되돌리기에서 지워지지 않아 다른 프로젝트/과거 상태의 「미배정 N마리」가 흘러나온다**
`src/editor/panels/databaseFarmSpatialView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseFarmSpatialView.ts:85 `const housingImpactNotices = new Map<string, number>();` — :1640/:1676에서 확인 시점에 기록되고 :578-581(`housing:${record.id}`), :687-689(`capacity:${record.id}:${level.level}`)에서 읽혀 「미배정 N마리」 문단을 렌더링한다. 그러나 store.subscribe(:116-118)은 projectSwitch 때 pendingHousingChange만 지우고 이 맵은 건드리지 않는다. 영향: (1) 프로젝트 A에서 farm_building_workshop(기본 템플릿 id라 프로젝트 간 동일 id가 흔함) 주거를 꺼 기록된 「미배정 3마리」가, 프로젝트 B의 같은 id 인스펙터에 그대로 따라온다. (2) 프로젝트 내에서도 확인 직후 Ctrl+Z로 용량·주거를 되돌려도 지워지지 않아 이미 해소된 손실이 계속 표시된다. housingImpactNotices는 만료·무효화 경로가 없는 쓰기 전용 잔존 상태다. 수정 제안: projectSwitch 구독에서 housingImpactNotices.clear()를 추가하고, 렌더 시점에 현재 프로젝트 기준 미배정 수를 재계산해 스태일 노티를 폐기할 것.

**[DB-12-9] (medium) footprint 면적 클램프가 저장값만 고치고 입력 표시를 되쓰지 않아 화면과 저장값이 어긋난다**
`src/editor/panels/databaseFarmSpatialView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseFarmSpatialView.ts:1329-1335 — `if (next.width * next.height > 128) next[axis] = Math.max(1, Math.floor(128 / ...))` 로 저장값을 조용히 고치지만 patchBuildingLevel(..., false)로 structural=false(재렌더 없음)이고 입력 input.value도 되쓰지 않는다. 그런데 databaseControls.ts:127-131의 numberField 계약은 「입력 즉시 클램프하고 클램프된 값을 input.value에 되써서 화면과 저장값이 어긋나지 않게 한다(P4)」다. 영향: 16×16으로 입력하면 numberField는 16(1..16 범위 내)을 되써 화면에 16을 보여주지만 저장값은 8×16이 되고, 같은 카드의 미리보기(:661, :665 preview.update(currentFootprint(...)))는 8×16을 그려 입력칸(16)과 미리보기·저장값이 한 화면에서 어긋난다. 사용자는 클램프가 일어났다는 신호를 입력칸에서 받지 못한다. 수정 제안: 클램프 발생 시 해당 input의 value를 되쓰거나 structural 재렌더를 트리거하고, 면적 한도(128)를 필드 옆 힌트로 노출할 것.

저심각도 일괄:
- [DB-12-10] (low) houseLotTools.ts가 참조 없는 빈 배열 스텁으로 남아 있다 — 위키가 기록한 「빈 배열 스텁 삭제」 청소가 형제 파일에만 적용됐다 — `src/editor/tools/houseLotTools.ts`
- [DB-12-11] (low) place_concept canonical 경로가 name/template/replaceExisting를 조용히 무시하고 비정수 seed를 0으로 뭉갠다 — `src/editor/tools/spatialConceptTools.ts`
- [DB-12-12] (low) edit_spatial_occurrence 스키마가 externalConnections 네 값을 모든 연산에 허용한다고 광고하지만 런타임은 연산별 부분집합만 받는다 — `src/editor/tools/spatialToolSchemas.ts`
- [DB-12-13] (low) list_structure_kits가 존재하지 않는 mapId를 빈 목록 성공 응답으로 포장해 오류를 데이터로 흘린다 — `src/editor/tools/structureKitTools.ts`
- [DB-12-13b] (low) build_house_kit이 doorEvent·banner·fence 요청을 조건 불충족 시 경고 없이 버린다 — `src/editor/tools/houseKitDomain.ts`

### 6.13 DB-13 — 시네마틱·오프닝·배틀 스튜디오·애니메이션

**[DB-13-1] (high) AI list_opening_media(kind:image)가 오프닝 탭의 still 카탈로그가 아니라 아이콘 "image" 카탈로그를 반환한다**
`src/editor/tools/cinematicTools.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/cinematicTools.ts:418 — `const all = listDatabaseResourceOptions(kind as DatabaseResourcePickerKind, project)`가 args.kind("image")를 그대로 카탈로그 kind로 씁니다. 그런데 같은 파일의 검증 경로는 src/editor/tools/cinematicTools.ts:32-35의 `PICKER_KIND = { image: "still", movie: "movie", ... }`를 타고(src/editor/tools/cinematicTools.ts:53-55 catalogIds), set_opening/edit_opening의 저장 검증(normalizeScene → resolveResourceId, cinematicTools.ts:172)은 이 still 카탈로그로 합니다. 결과: (1) 도구 설명 "DB 「오프닝」 탭과 같은 목록에서 반환한다"(cinematicTools.ts:384)은 거짓 — list_opening_media(kind:"image")는 resourceOptions.ts:130-135의 아이콘 우선 "image" 카탈로그(CC0 아이콘·생성 아이템/장비/적)를 돌려주고, 탭 피커의 1순위인 easyrpg 배경화·타이틀 아트(resourceOptions.ts:117-125)와 gameOver 프로필 업로드는 목록에 없습니다. …

**[DB-13-2] (high) 파일로 가져온 배경음악이 music 카탈로그에 잡히지 않고 sound 카탈로그에 잘못 등록된다**
`src/editor/cinematicMediaImport.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/cinematicMediaImport.ts:36 — `const assetKind = kind === "image" ? "picture" : kind === "video" ? "movie" : "sound"`. 배경음악 슬롯 업로드는 src/editor/panels/databaseCinematicMediaActions.ts:167-168에서 music을 `kind: "audio"`로 prepareCinematicUpload에 넘기므로, 생성된 UploadedAsset.kind는 항상 **"sound"**입니다. 커밋 자체는 성공합니다 — applyMedia(databaseCinematicMediaActions.ts:84)는 asset이 있으면 카탈로그 소속 검증을 건너뛰고, :127-134는 resourceProfiles에 kind "music" 프로필을 push하니 musicResourceId는 저장되고 재생도 됩니다. 그러나 카탈로그 라운드트립이 깨집니다: listDatabaseResourceOptions("music")은 audioResourceCatalog.listAudioResources로 위임(resourceOptions.ts:101-106)하고, 거기서 프로필 분기는 `Object.hasOwn(project.assets.uploaded, id)`면 continue(src/assets/audioResourceCatalog.ts:148), 업로드 분기는 `uploaded.kind === kind`만 추가(:151-153)합니다. 업로드 음악은 kind가 "sound"라 music 카탈로그에 영원히 없고, 대신 sound(내레이션 음성·효과음) 카탈로그에 오분류돼 AI list_opening_media(kind:"sound")까지 오염시킵니다. …

**[DB-13-3] (high) 애니메이션 타이밍(SE·플래시·흔들림)은 UI에서 편집이 불가능하고 타이밍 추가는 런타임에 아무 효과 없는 빈 행을 만든다**
`src/editor/panels/databaseAnimationRecordView.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseAnimationRecordView.ts:354-407. 타이밍 테이블은 `el("td", { text: timing.soundResourceId ?? "-" })`(:366), 플래시·흔들림도 text 렌더링(:367-368)이라 기존 타이밍의 frameIndex·사운드·플래시 색/길이·흔들림 power/speed를 전혀 고칠 수 없습니다. "타이밍 추가"는 `const next = [...context.timings, { frameIndex: context.selectedFrameIndex }]`(:399) — soundResourceId·flash·screenShake 없는 빈 레코드인데, 런타임은 이런 타이밍을 무시합니다(src/player/battleAnimationDom.ts:292-293 `record.timings.filter((timing) => timing.soundResourceId || timing.flash || timing.screenShake)`; src/battle/animationTiming.ts:55-63도 flash/shake만 적용). 즉 추가 버튼이 런타임 효과 0짜리 유령 행을 만들고, 폼 헤더의 약속 "프레임과 타이밍을 조정합니다"(:89)와 패널 제목 "SE 및 플래시 타이밍"이 실현되지 않습니다. 스타터 레코드의 flash/shake 시드(defaultDatabaseStarterRecords.ts:163-181)도 UI에서 수정 불가라 사용자는 삭제만 가능합니다. …

**[DB-13-4] (high) AI upsert_battle_animation 도구가 sheet·frames·timings를 기록하지 못한다 — 탭과 같은 저작 데이터라는 설명과 계약 불일치**
`src/editor/tools/dbTools.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/tools/dbTools.ts:1711-1730 — parameters.schema가 `additionalProperties: false`이면서 properties는 id/name/resourceId/scope/position/large뿐입니다. run(:1741-1752)도 이 다섯 필드만 스프레드하므로, AI가 sheet(프레임 폭/높이/열 — 기본 {96,96,5}, databaseAnimationRecordView.ts:21)·frames(셀 레이아웃)·timings(SE/플래시/흔들림)을 넘기면 스키마 거부되고, 설명의 "Database 애니메이션 탭과 같은 저작 데이터"(:1709)는 절반만 참입니다. generic write 도구도 없습니다(update_database_record류 없음, get_database_records는 read — queryTools.ts:705). 영향: AI는 애니메이션 레코드를 만들어도 셀 하나 배치할 수 없고, 4열 시트 등 슬라이싱이 다른 이펙트는 반드시 잘린 채 등록되며, 타이밍은 UI도 못 고치는 데(DB-13-3) AI도 못 쓰는 이중 막힘 — 도메인 전체가 사람/AI 어느 쪽으로도 저작 불가 영역이 됩니다. 수정: upsert_battle_animation 스키마에 sheet·frames(셀 배열)·timings를 추가하고 run에서 normalizeBattleAnimationRecord로 정규화해 저장하거나, 최소한 도구 설명에 "셀/타이밍은 편집기 전용"임을 명시해 AI가 헛된 시도를 하지 않게 합니다.

**[DB-13-10] (medium) 직업 전투 메뉴에서 remove는 커스텀 교체(cmd_change) 푸터를 보존하는데 place/move는 기본값으로 덮어써 경로마다 결과가 달라진다**
`src/editor/panels/databaseBattleCommandStudio.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseBattleCommandStudio.ts:77-83 — remove는 `klass.battleCommands.filter((row) => row.id === "cmd_change" || index++ !== occurrence.index)`로 주석 그대로 "over-cap legacy arrays and footer overrides"(커스텀 이름/종류의 교체 행)를 보존합니다. 그런데 place와 move는 insertCatalogClassCommand/reorderEditableClassCommand를 거치고 둘 다 finalizeCommands로 마무리됩니다(src/editor/databaseClassCommandOrder.ts:84-89: `return [...editable.map(cloneCommand), { id: CHANGE_COMMAND_ID, name: "교체", kind: "switch" }]`). finalizeCommands는 기존 cmd_change 행을 편집 가능 목록에서 걸러 버리고 항상 기본값 {교체, switch}를 새로 붙이므로, 직업 편집기 등에서 작성된 커스텀 교체 행(예: 이름 "도약")은 같은 스튜디오에서 명령을 추가하거나 위/아래로 옮기는 것만으로 조용히 기본 "교체"로 덮여 저장됩니다(remove 직후와 place 직후의 같은 레코드가 달라짐 — 경로별 비대칭). 수정: finalizeCommands가 기존 cmd_change 행의 authored 속성을 보존하도록 바꾸거나(마지막 행 교체 시 기존 행 reuse), remove가 특별 취급하는 오버라이드를 place/move도 동일하게 다룹니다.

**[DB-13-5] (medium) gen1 캡처 프리뷰 수치가 실물 attemptGen1Capture 공식과 어긋난다 — HP 구간에서 최대 7~10%p 오차와 100% 케이스 누락**
`src/editor/panels/databaseCapturePreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseCapturePreview.ts:12-14 — gen1 프로젝트에서 `captureSuccessRate(captureRate, currentHp, 100, 1, { model: "gen1" })`를 쓰는데, 이 단발 접기 공식은 monsterCollection.ts:130-141의 `captureRate * (3 - 2*hpRatio) / 3`입니다. 반면 실제 gen1 전투는 이 함수를 안 탑니다 — src/battle/runtime.ts:1801-1811이 `attemptGen1Capture({ ballClass, maxHp, currentHp, catchRate: round(captureRate*255), majorStatus })`를 쓰고, 확률은 src/battle/gen1/capture.ts:178-184의 hpQuarter=floor(curHp/4) 기반 구간 함수 `w = floor(floor(maxHp*255/hpFactor)/hpQuarter)`로 계산됩니다(w>255면 2단계 없이 자동 포획, capture.ts:67-69). 수치 실측(captureRate 1.0, poke, 무상태, maxHp 100): 만HP 실물 33.6%(표시 33%)는 근접하지만, HP 50% 실물 70.3% vs 표시 67%, HP 10%(hpQuarter=2 → w=1062>255) 실물 **100%(무조건 포획)** vs 표시 93%입니다. …

**[DB-13-6] (medium) updateFrameCells가 refetch 후에도 클램프되지 않은 frameIndex에 써서 프레임 배열에 구멍(sparse hole)을 만들 수 있다**
`src/editor/panels/databaseAnimationRecordView.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/panels/databaseAnimationRecordView.ts:454-460 — `const frames = normalizedFrames(record.frames); frames[frameIndex] = { cells: ... }`가 frameIndex를 refetch한 길이에 대해 클램프 없이 씁니다. frameIndex는 렌더 시점에 클램프된 context.selectedFrameIndex(databaseAnimationRecordView.ts:62)라서, 폼이 열려 있는 동안 다른 경로(AI 세션의 battleAnimations 편집, 되돌리기 등)로 frames가 줄면 `frames[oldIndex] = ...`가 배열 끝을 넘어 씁니다 — updateFrameCells는 셀 자체는 store에서 refetch하면서(:455-457) 인덱스는 refetch하지 않는, 자기 파일의 P2 계약("셀을 읽는 모든 뮤테이션은 이 getter로 store에서 최신 셀을 refetch", :43-45)과 어긋나는 구현입니다. `[...frames]`에 구멍이 남고 스토어 직렬화 시 null 원소가 되며, 세션 내에서도 재생 루프의 `context.frames.length` 모듈로와 renderStageCells가 구멍(undefined).cells를 읽어 TypeError로 이어질 수 있습니다. 수정: `if (frameIndex < 0 || frameIndex >= frames.length) return;` 가드(또는 clampFrameIndex 재적용)를 updateFrameCells와 currentFrameCells 쓰기 경로에 넣습니다.

**[DB-13-7] (medium) 셀 일괄 대화상자가 부분 적용을 막고 빈 칸을 0으로 굳혀 한 번의 클릭에 셀 레이아웃을 덮어쓴다**
`src/editor/panels/databaseAnimationPreview.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseAnimationPreview.ts:163-225. OK 핸들러가 `onApply({ pattern: Number(pattern.value), x: Number(x.value), y: Number(y.value), zoom: Number(zoom.value), opacity: Number(opacity.value) })`(:199-205)로 **다섯 필드를 전부** 보냅니다. 반면 batchApplyCells의 패치 타입은 전부 옵셔널이고 `patch.pattern !== undefined ? ... : cell.pattern`처럼 undefined=유지 계약으로 설계돼 있습니다(src/editor/databaseAnimationCellOps.ts:3-28) — 부분 적용이 가능하게 만들어 놓고 대화상자가 그 계약을 쓰지 않는 것입니다. 결과: (1) 불투명도만 바꾸려 열어도 모든 셀의 pattern/X/Y/확대가 첫 셀(cells[0], :165) 값으로 덮여 레이아웃이 통짜로 파괴될 수 있습니다. (2) 입력을 비우고 OK하면 Number("")=0 — 불투명도 0(셀 실질 삭제), X/Y 0(전부 원점), 확대는 clampInt(0,1,800)=1로 굳습니다. type=number라 중간 상태의 빈 입력은 흔하고, 확인 절차도 없습니다. 수정: 빈 입력은 undefined로 보내 batchApplyCells의 keep 경로를 타게 하고, 모든 필드가 유효할 때만 전체 적용 안내를 유지합니다.

**[DB-13-8] (medium) 인라인 셀 편집과 시트 필드 변경이 스테이지 프리뷰에 전혀 반영되지 않는다**
`src/editor/panels/databaseAnimationRecordView.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseAnimationRecordView.ts:303-344 — cellEditableRow의 updateCell은 `updateFrameCells(...)`만 부르고 rerender하지 않습니다(타이핑 보존 의도, :306-308 주석). 그런데 스테이지 패널과 재생 루프는 전부 렌더 시점 스냅샷을 봅니다: 정지 스테이지는 renderAnimationStagePanel에서 renderStageCells(cellLayer, context, context.selectedFrame, ...)로 한 번 그리고(databaseAnimationPreview.ts:62), 재생 루프도 `context.frames` 클로저를 순회합니다(databaseAnimationPreview.ts:272-279). 시트 폭/높이/열 변경도 마찬가지로 updateAnimationSheet가 store만 고치고(databaseAnimationRecordView.ts:206-210) 스테이지 CSS 변수(--animation-frame-width 등, databaseAnimationPreview.ts:58-60)는 다음 풀 rerender까지 안 바뀝니다. …

**[DB-13-9] (medium) sameRecord(JSON.stringify)가 키 순서에 의존해 같은 미디어 재선택·이미 텍스트인 장면 변환이 무변경 판정을 못 하고 유령 히스토리를 남긴다**
`src/editor/panels/databaseCinematicActionModel.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseCinematicActionModel.ts:61-63 — `sameRecord = JSON.stringify(a) === JSON.stringify(b)`는 키 순서에 의존합니다. 그런데 applyMedia의 장면 미디어 경로는 sceneWithKind로 장면을 재조립합니다(databaseCinematicMediaActions.ts:95 `nextScene = sceneWithKind(scene, slot.kind, resourceId)`), 그 출력 키 순서는 {id, narration, durationMs, narrationAudioResourceId?, kind, resourceId, motion}(databaseCinematicActionModel.ts:43-58)로, 저장본이 가진 순서(예: {id, kind, resourceId, narration, durationMs, motion})와 다릅니다. 따라서 이미 그 값이 설정된 이미지/동영상에 같은 리소스를 다시 선택하거나(:97 `if (!asset && sameRecord(scene, nextScene)) return false;`가 무변경을 못 잡고), 이미 텍스트인 장면에 텍스트 변환을 다시 누르면(databaseCinematicActions.ts:206) sameRecord가 false → commit이 실행되어 실질 no-op인 "미디어 선택"/"텍스트 장면으로 변경" 스냅샷이 히스토리에 쌓이고 상태란에는 "미디어를 설정했습니다"가 뜹니다(되돌리기 한 번이 헛돌고, 편집 활동 로그도 오염). voice 경로의 destructure+재삽입(databaseCinematicMediaActions.ts:91-94)도 저장본 키 순서에 따라 같은 문제가 납니다. …

저심각도 일괄:
- [DB-13-11] (low) list_opening_media의 invalid-kind 오류 문구가 music을 누락했다 — `src/editor/tools/cinematicTools.ts`
- [DB-13-12] (low) 생성 아셋 승격 스크립트가 위키 실측(900s 필요)을 반영하지 않아 재실행 시 같은 타임아웃을 되풀이한다 — `scripts/oprn-generated-assets.mjs`
- [DB-13-13] (low) 인라인 셀 숫자 입력은 일괄 대화상자와 달리 클램프가 없고 빈 입력을 0으로 기록한다 — `src/editor/panels/databaseAnimationRecordView.ts`
- [DB-13-14] (low) 셀 복사 클립보드가 모듈 전역이라 레코드·프로젝트 경계 없이 붙여넣어진다 — `src/editor/panels/databaseAnimationPreview.ts`

### 6.14 DB-14 — 생활·농장·수집·제작·날씨

**[DB-14-1] (critical) 생활 컬렉션 뷰의 무경계·비정수 숫자 입력이 로더 검증을 위반해 프로젝트 재오픈 실패/저장 실패를 만든다**
`src/editor/panels/databaseLifeCollectionsView.ts` · 최종 critical · 확인 · 확신 high
위치: databaseLifeCollectionsView.ts:619 (낚시 기력 소모), :570 (박물관 골드), :560 (최소 기부 개수), :398 (어획 가중치), :399 (최소 숙련도), :352 (낚시 숙련 경험치). 증거: :619은 `numberField("낚시 기력 소모", ..., (energyCost) => setFishingEnergy(energyCost))` 로 bounds 미전달 — numberField의 normalize(databaseControls.ts:151-155)는 bounds가 없으면 `Number.isFinite`만 확인해 -5, 2.5 같은 값을 그대로 저장한다. bounds가 있는 필드도 `Math.min(bounds.max, Math.max(bounds.min, numeric))` 클램프만 하고 정수 절단이 없어 2.5가 통과된다(:570은 `gold > 0 ? gold : undefined`라 2.5가 통과). 이 값들은 store.update로 즉시 저장되는데(store.ts:785-798의 정규화는 mapConnections/스위치 슬롯뿐), 다음 로드에서 shape.ts:112-114의 validateSystem이 normalize(174-175)보다 먼저 shapeDatabaseFields.ts:223 `assertSafeIntegerInRange("system.fishing.energyCost", ..., 0, P2_COUNT_MAX)`, :325 `gold 0..P2_COUNT_MAX`, :316 `minDonations 1..`, :245-246 `weight/minSkillLevel` 정수 검사를 하므로 assert가 던져져 프로젝트가 열리지 않거나 저장 게이트에서 저장이 거부된다. …

**[DB-14-2] (critical) 채집물에서 기본 아이템을 '(계절별 드롭만 사용)'으로 비우면 itemId·seasonalDrops 둘 다 없는 행이 저장되어 로드가 하드 거부된다**
`src/editor/panels/databaseLifeCollectionsView.ts` · 최종 critical · 확인 · 확신 high
위치: databaseLifeCollectionsView.ts:483 `chooserField("기본 아이템", ..., [{ id: "", name: "(계절별 드롭만 사용)" }, ...items], (itemId) => patchEntry(record.id, { itemId: itemId || undefined }))` + :494-498 각 계절 드롭을 "(없음)"으로 바꾸면 seasonalDrops 키를 삭제. 증거: 두 선택을 모두 비우면 sanitize(patchEntry→:900)가 undefined 키를 걷어 `{ id, weight }`만 남는다. 이 행은 저장되지만 다음 로드에서 shapeDatabaseFields.ts:291 `assert(entry.itemId !== undefined || entry.seasonalDrops !== undefined, "...must define itemId or seasonalDrops.")` 가 하드 실패한다. repairFarmAnimalReferences(references.ts:843-880)는 forage를 복구하지 않는다. AI 툴은 같은 상태를 lifeCollectionTools.ts:307-309 `"entries 항목에 itemId 또는 seasonalDrops 중 하나가 필요합니다"` 로 사전 차단한다 — UI만 무가드다. 영향: 채집물 조건을 비우는 평범한 편집으로 프로젝트가 재오픈 불가가 된다. 수정 제안: 마지막 조건을 비우는 시도를 차단(토스트)+행 삭제 유도하거나, 둘 다 비어 있으면 행을 즉시 제거.

**[DB-14-3] (critical) 시작 개체 '표시 이벤트 ID' 자유 텍스트가 존재하지 않는 eventId를 허용하고, 로드 repair가 이를 복구하지 않아 프로젝트 재오픈이 실패한다**
`src/editor/panels/databaseFarmAnimalsView.ts` · 최종 critical · 확인 · 확신 high
위치: databaseFarmAnimalsView.ts:637 `textRow("표시 이벤트 ID", record.eventId ?? "", (value) => patchAnimal(index, { eventId: value || undefined }))` — 자유 텍스트 입력에 존재 검증도 피커도 없다. 증거: 참조 검증은 references.ts:804-805 `if (animal.eventId && !eventIds.has(animal.eventId)) issues.push("session.farmAnimals[i].eventId does not exist")` 로 하드 실패인데, 로드 repair(references.ts:843-880)는 eventId를 전혀 복구하지 않는다(종/축사/배정만 repair). store.update는 eventId를 정규화하지 않고(store.ts:790-793) autosave가 즉시 반영하므로, 오타 하나로 다음 부팅의 validateProjectV4(shape.ts:87-88)가 throw한다. 영향: 시작 개체 탭의 자유 텍스트 한 줄이 프로젝트 전체를 열 수 없게 만든다. 삭제 쪽은 "시작 개체는 참조 제약이 없어 바로 지워집니다"(:652)라고 안내하지만 eventId는 참조 제약이 있다. 수정 제안: 이벤트 피커(select)로 교체하거나 커밋 시 eventIds 존재 검증 + 무효 값 차단 토스트.

**[DB-14-4] (critical) 예보 일수 필드가 비정수(예: 2.5)를 저장하고 로더의 정수 검증에 걸려 재오픈 실패를 만든다**
`src/editor/panels/databaseDailyWeatherView.ts` · 최종 critical · 확인 · 확신 high
위치: databaseDailyWeatherView.ts:339 `numberField("예보 일수", "db-weather-forecast-days", ..., { min: 1, max: 7 })`. 증거: numberField의 bounds 클램프(databaseControls.ts:151-155)는 정수 절단이 없어 2.5를 그대로 저장하고, change 시 `input.value = String(next)`(:181)로 2.5를 화면에도 되쓴다. 로드 시 shapeDatabaseFields.ts:652-654 `assertSafeIntegerInRange("system.dailyWeather.forecastDays", ..., 1, WEATHER_FORECAST_DAYS_MAX)` 가 비정수에 throw한다. DB-14-1과 같은 불변식 클래스(편집기 쓰기 경로에 정규화 부재). 영향: 예보 일수에 소수를 넣는 것만으로 세이브 문서가 검증을 통과하지 못한다. 수정 제안: clampInt 적용(같은 파일의 weight 입력은 이미 :398 `clampInt(...)` 로 올바르다 — 일관성만 맞추면 됨).

**[DB-14-5] (high) 축사 X/Y 입력이 맵 범위 밖 값을 허용하고, 다음 로드에서 repair가 축사를 사용자 동의 없이 삭제한다(조용한 데이터 유실)**
`src/editor/panels/databaseFarmAnimalsView.ts` · 최종 high · 확인 · 확신 high
위치: databaseFarmAnimalsView.ts:517-518 `numberRow("X", record.x, 0, 9999, ...)`, `numberRow("Y", record.y, 0, 9999, ...)` — 맵 크기와 무관한 9999 상한. 증거: 참조 검증은 references.ts:776-779 `position (x,y) is out of bounds for map ...` 을 에러로 수집하지만, 로드 순서상 repair가 먼저 돌아 references.ts:851-856에서 맵 범위 밖 축사를 `filter`로 **조용히 삭제**하고 :872-876 그 안 개체의 배정도 몰래 해제한다. AI 툴은 farmSpatialTools.ts:121-138 `requireMapAndBounds` 로 좌표를 사전 검증하므로 UI만 무가드다. 맵 프리뷰 마커(:554-555)도 100%를 넘는 좌표를 그대로 style에 넣어 화면 밖으로 사라져 사용자가 인지하기 어렵다. 영향: 숫자 실수 한 번이 다음 로드에서 축사+동물 배정의 무통보 손실로 귀결. 수정 제안: numberRow 상한을 현재 맵 width-1/height-1로 동적 클램프하거나 커밋 시 범위 검증 + 토스트.

**[DB-14-6] (high) upsert_life_skill이 기존 스킬의 levelUpRewards를 통째로 지운다(조용한 데이터 유실)**
`src/editor/tools/lifeSystemTools.ts` · 최종 high · 확인 · 확신 high
위치: lifeSystemTools.ts:36-41 `return normalizeLifeSkillRecord({ id, name, skillType, maxLevel })` — levelUpRewards를 전달하지 않아 skillModel.ts:14-21의 기본값 `[]`가 채워지고, :22-26 upsertById + :91 `upsertById(draft.database.lifeSkills ?? [], skill)` 이 기존 레코드를 **통째로 교체**한다. 증거: types/database.ts:751-757 LifeSkillRecord의 유일한 부가 필드가 levelUpRewards이며, 툴 스키마(:73-84)에는 rewards 입력 자체가 없어 모델이 보존할 방법이 없다. 영향: 사람이 생활 기술 탭(databaseLifeCraftingView.ts:477-507)에서 만든 레벨 보상(스위치/제작법 해금)이 AI가 스킬 이름만 고쳐도 조용히 사라진다 — 모델은 "수정" 도구를 쓰는 것이 합리적 기대다. 수정 제안: 기존 레코드를 읽어 필드 병합(partial patch)하거나, 스키마에 levelUpRewards를 노출하고 미전달 시 기존값 유지.

**[DB-14-7] (high) upsert_craft_recipe이 미전달 필드를 기본값으로 리셋해 재료 소실(무료 제작)·골드 비용/해금 요구 소실을 만든다**
`src/editor/tools/lifeEconomyTools.ts` · 최종 high · 확인 · 확신 high
위치: lifeEconomyTools.ts:130-138 — `ingredients: record.ingredients === undefined ? [] : parseIngredients(...)`, goldCost/requiresUnlock은 `!== undefined ? {...}` 조건 스프레드라 미전달 시 **필드가 삭제**되고, :139 `upsertById` 가 기존 레코드를 교체한다. 증거: shapeDatabaseFields.ts:361-362 처럼 requiresUnlock은 저작 데이터인데, 모델이 outputCount만 고치려 레시피를 재전송하면 재료가 비어 '무료 제작'이 되고 requiresUnlock:true였던 레시피는 해금 없이 제작 가능해진다(게이팅 우회). upsert_item_upgrade(:192-199)도 동일 — capability 미전달 시 강화의 범위/에너지 배율이 소실된다. 영향: AI의 사소한 수정 요청이 게임 밸런스를 무음으로 파괴한다. 수정 제선: 기존 레코드 병합 기반 partial patch로 바꾸거나, 교체 시 삭제되는 필드 목록을 summary/warnings에 명시.

**[DB-14-8] (high) upsert_life_system의 가축 종 upsert가 기존 graphic을 지우고 미지정 수치를 기본값으로 리셋한다**
`src/editor/tools/lifeSystemTools.ts` · 최종 high · 확인 · 확신 high
위치: lifeSystemTools.ts:52-60 parseAnimalSpecies가 id/name/feed/product/productCount/productEveryDays/petFriendship만 구성하고 graphic은 전달하지 않으며, :144-148 `upsertById(draft.database.farmAnimalSpecies ?? [], species)` 로 기존 레코드를 교체한다. 증거: types/database.ts:777 `graphic?: EventPageGraphic`, p1FoundationRecords.ts:73-77은 graphic이 들어올 때만 보존. 미지정 productCount/productEveryDays/petFriendship은 :57-59의 기본값(1/1/0)이 기존값을 덮는다. 영향: 동물 탭에서 그래픽을 배선해 둔 종을 AI가 먹이 아이템만 바꾸려 upsert하면 그래픽이 사라지고 생산 주기·친밀도가 초기화된다. 수정 제안: 기존 레코드와 병합(기존값 우선, 전달값만 덮기)하거나 graphic 입력을 스키마에 추가.

**[DB-14-11] (medium) 박물관 보상의 worldUnlockIds/recipeIds는 존재 검증 없이 통과해 파일 헤더의 'id 참조 검증' 계약을 어긴다**
`src/editor/tools/lifeCollectionTools.ts` · 최종 medium · 확인 · 확신 high
위치: lifeCollectionTools.ts:397-402 — parseReward의 worldUnlockIds/recipeIds는 `requireString({ id }, ...)` 로 문자열 검사만 하고 존재 검증이 없다. 증거: 파일 헤더 :3은 "툴은 그 앞에서 id 참조 검증 + 오류 메시지에 유효값 나열을 담당한다"고 선언하며, 같은 프로젝트의 bundle reward 경로(lifeEconomyTools.ts:320-344)는 recipeId/worldUnlockId를 `system.craftRecipes`/`system.worldUnlocks`에서 검증하고 유효 id를 나열한다. 박물관 reward에 존재하지 않는 id를 넣으면 커밋 게이트에서 reference-validation/직렬화 왕복 에러로만 거부되어 모델이 어느 배열 항목을 고쳐야 할지 모른다. 수정 제안: requireKnownId로 통일하고 유효 id 목록을 오류에 포함(동일 파일의 requireKnownId :54-64 재사용).

**[DB-14-12] (medium) set_session_farm_state가 farmAnimals의 eventId를 검증하지 않아 참조 위반이 불투명한 왕복 에러로 반환된다**
`src/editor/tools/farmSpatialTools.ts` · 최종 medium · 확인 · 확신 high
위치: farmSpatialTools.ts:265 `...(optionalId(raw, "eventId") ? { eventId: optionalId(raw, "eventId") } : {})` — 맵/좌표/종/축사는 전부 존재 검증(:256-259)하는데 eventId만 문자열 존재 여부만 확인한다. 증거: references.ts:804-805는 댕글링 eventId를 하드 에러로 수집하므로, 잘못된 eventId는 툴 단계가 아니라 커밋 게이트(projectLint 직렬화 왕복)에서 `직렬화 왕복 실패: session.farmAnimals[0].eventId does not exist: ...` 로 반환된다 — 어느 인자(farmAnimals.upsert[i].eventId)인지 알려주지 않는다. 또한 이 툴은 housingPlacementId 입력을 아예 지원하지 않아(:260-266 buildingId만) 위키가 말하는 배치 기반 주택 배정을 AI가 저작할 수 없다. 수정 제안: eventId 존재 검증(맵 이벤트 id 집합과 대조) + 에러에 인자 경로 표기, housingPlacementId 지원 추가.

**[DB-14-13] (medium) set_session_farm_state의 upsert가 기존 개체를 통째 교체해 buildingId/eventId가 무음 소실된다**
`src/editor/tools/farmSpatialTools.ts` · 최종 medium · 확인 · 확신 high
위치: farmSpatialTools.ts:148-156 `upsertByInstanceId` — 같은 instanceId는 incoming으로 통째 교체. 증거: :358-364에서 farmAnimals 섹션이 기존 배열을 retain 후 upsertByInstanceId로 교체하므로, 모델이 기존 가축의 이름만 고치려 `{ instanceId, speciesId, name }`을 보내면 기존 buildingId/eventId가 소실된다(정합성 검증은 있으나 값 유실은 없다). 묘사(:353)는 "배열별로 독립 upsert/remove"만 말할 뿐 레코드 내 필드가 통째 교체된다는 점을 알려주지 않는다. 영향: AI의 부분 수정 의도가 배정 해제로 이어지고, 재로드 시 repair(references.ts:870-878)와 결합해 배정 상태가 모델이 본 것과 달라진다. 수정 제안: 기존 레코드와 병합하는 partial upsert 또는 설명에 전체 교체 명시.

**[DB-14-14] (medium) 새 날씨 규칙이 명시 intensity 0으로 시작해 '맑음→비' 전환 시 아무 효과 없는 비가 만들어진다**
`src/editor/panels/databaseDailyWeatherView.ts` · 최종 medium · 확인 · 확신 high
위치: databaseDailyWeatherView.ts:217/325 — 새 규칙이 `{ kind: "none", weight: 1, intensity: 0 }` 로 시작해 intensity 0을 **명시 저장**한다. :384 kind 전환은 `patchRule(season, index, { kind })` 로 강도를 건드리지 않는다. 증거: 맑음→비로 바꾸면 명시된 intensity 0이 남고, 런타임 dailyWeather.ts:113은 `intensity: rule.intensity ?? DEFAULT_WEATHER_INTENSITY` 로 명시값을 존중하며, 이 뷰 자신의 effectsCard(:162)도 "비·폭풍이고 강도가 0보다 클 때만 갈아둔 밭이 자동으로 젖습니다"라고 밝힌다 — 즉 강도 0 비는 밭 급수를 영원히 발동시키지 않는다. 위키가 말한 '생략값 0.5 표시' 경계(:379)는 이 경우 적용되지 않는다(값이 생략이 아니라 명시 0이므로). 슬라이더가 0.00을 보여주긴 하지만 아무 경고도 없다. 수정 제안: kind가 none→소비형으로 바뀔 때 intensity가 0(또는 명시 0)이면 DEFAULT_WEATHER_INTENSITY로 리셋하거나 안내 토스트 표시.

**[DB-14-15] (medium) numberControl의 bounds 클램프가 min=0 경계를 무력화해 시작 에너지·하루 회복량을 0으로 설정할 수 없다**
`src/editor/panels/databaseLifeCraftingView.ts` · 최종 medium · 확인 · 확신 high
위치: databaseLifeCraftingView.ts:1325 `const next = bounds ? Math.min(bounds.max, Math.max(bounds.min, positiveInteger(Number(input.value)))) : Number(input.value);` — bounds가 있어도 inner 클램프가 positiveInteger(min 1)라 bounds.min=0이 실제로는 도달 불가다. 증거: :775-776 시작 에너지/하루 회복량이 `boundedInteger(value, 0, max)`(min 0)를 의도하지만 0을 입력하면 positiveInteger(0)=1 → Math.max(0,1)=1로 저장되고 입력도 1로 되쓴다. 필드를 비우면 Number("")=0 → 1로 커밋된다. 영향: '하루 회복량 0(회복 없음)', '시작 에너지 0' 같은 합법적 저작이 불가능하고, 사용자는 0을 넣었는데 1이 저장된다. 수정 제안: 클램프 순서를 `Math.min(max, Math.max(min, trunc(n)))` 로 수정하거나 min=0일 때 positiveInteger 우회.

**[DB-14-16] (medium) 자동 배선 그래픽 작물에서 성장 그래픽 필드 하나만 편집해도 부분 저작 배열로 커밋되어 자동 배선이 소실된다**
`src/editor/panels/databaseCropView.ts` · 최종 medium · 확인 · 확신 high
위치: databaseCropView.ts:638 `const buffer: CropGraphicStage[] = Array.from({ length: rowCount }, ...)` + :640-642 commit이 buffer 전체를 graphicStages로 저장. 증거: graphicStages가 undefined(자동 배선)인 작물에서 사용자가 행 하나(예: 라벨 또는 리소스)만 편집하면 commit이 즉시 발동해 `graphicStages`가 정의된 상태가 되고, farmModel.ts:20-22/43에 따라 이후부터 자동 배선은 영원히 적용되지 않는다. 빈 buffer 행은 normalizeGraphicStages에서 잘려나가 결과적으로 '리소스 없는 1단계(밭에 색 사각형)' 저작이 된다. 의도된 경로는 :653-665의 "이 배선을 고정"(이 배선을 고정) 버튼인데, 직접 편집은 아무 경고 없이 같은 결과를 낸다. 영향: 자동 배선을 쓰던 작물의 그림이 한 글자 타이핑으로 깨진다. 수정 제안: authored===undefined 상태에서의 첫 편집은 자동 배선값으로 buffer를 채운 뒤 시작(고정과 동일)하거나 확인 대화상자 표시.

**[DB-14-17] (medium) 아이템이 없는 프로젝트에서 제작법/강화 추가가 outputItemId "" 레코드를 만들어 로드 검증에 걸린다(형제 뷰는 가드하는데 이 뷰만 무가드)**
`src/editor/panels/databaseLifeCraftingView.ts` · 최종 medium · 확인 · 확신 high
위치: databaseLifeCraftingView.ts:1010 `const itemId = section === "sellPrices" ? sellItemId! : project.database.items[0]?.id ?? "";` — :1023 제작법 `{ ..., outputItemId: itemId }`, :1028 강화 `{ fromItemId: itemId, toItemId: itemId }`. 증거: items가 0개면 outputItemId: "" 로 레코드가 생성되고, shapeDatabaseFields.ts:359 `requireNonBlankString("system.craftRecipes[i].outputItemId")` 가 로드에서 throw한다(repair가 이를 걷지 않음). 형제 뷰는 같은 상황에서 가드한다(databaseLifeCollectionsView.ts:1086-1087, databaseFarmAnimalsView.ts:936-940 "먼저 아이템을 추가하세요" 토스트). amountEditor도 아이템이 없으면 :907-911에서 차단하므로 addRecord만 예외다. 영향: 아이템 없는 프로젝트에서 '+ 추가' 한 번이 재오픈 실패 상태의 문서를 만든다(엣지 전제). 수정 제안: collections/farm 뷰와 동일한 사전 토스트 가드 추가.

**[DB-14-18] (medium) 시스템 값 편집이 enabled:true 설정을 암묵 생성하고 토글 표시와 저장값이 어긋난다**
`src/editor/panels/databaseLifeCollectionsView.ts` · 최종 medium · 확인 · 확신 high
위치: databaseLifeCollectionsView.ts:994 `draft.system.fishing = { ...(draft.system.fishing ?? { enabled: true, spots: [] }), energyCost }`, :1018 `setEligibleItems` 폴백 `{ enabled: true, rewards: [] }`, :1026 `setTrackedItems` 폴백 `{ enabled: true }`. 증거: 사용자가 시스템이 꺼진 상태에서 '낚시 기력 소모' 숫자만 바꿔도 enabled:true인 fishing 설정이 생성되고, setFishingEnergy는 rerender를 호출하지 않아(:992-995) 좌측 '낚시' 토글(:618, `?? false` 표시)은 계속 꺼진 채로 보인다 — 저장값은 켜짐. museum/collections도 동일. 영향: 꺼둔 생활 루프가 값 편집만으로 암묵 활성화되고, 토글 표시와 실제 상태가 다음 재렌더 전까지 어긋난다. 수정 제안: 폴백 생성 시 enabled 기본값을 false로 두거나(토스트로 알림), 값 편집 후에도 rerender해 표시를 동기화.

**[DB-14-19] (medium) 시작 개체 추가가 종 허용·정원 조건을 무시하고 무조건 첫 번째 축사에 배정한다**
`src/editor/panels/databaseFarmAnimalsView.ts` · 최종 medium · 확인 · 확신 high
위치: databaseFarmAnimalsView.ts:978 `draft.session.farmAnimals.push({ instanceId: id, speciesId: species.id, name: "새 동물", buildingId: draft.system.farmAnimalBuildings?.[0]?.id })`. 증거: 같은 파일의 집 피커는 :1100-1103에서 `allowedSpeciesIds.includes(record.speciesId)` 와 정원을 검사해 부적합한 집은 옵션에서 숨기는데, 추가 흐름은 첫 번째 축사를 조건 없이 배정한다 — 첫 축사가 다른 종만 허용하거나 가득 차면 검증기(references.ts:826-837) 위반이지만 로드 repair(:872-876)가 배정을 조용히 해제한다. 영향: 추가 직후 UI는 '배정됨'으로 보이지만 저장→재로드 후 배정이 사라져 사용자 혼란과 무음 상태 변화를 낳는다. 수정 제안: 호환 축사를 찾아 배정하거나(피커 로직 재사용) 배정 안 함으로 생성.

**[DB-14-20] (medium) 어획 규칙 추가가 같은 어종의 중복 행을 허용하고 재로드 시 조용히 하나로 합쳐진다**
`src/editor/panels/databaseLifeCollectionsView.ts` · 최종 medium · 보류 · 확신 medium
위치: databaseLifeCollectionsView.ts:875 `catches: [...spot.catches, { fishId, weight: 1 }]` — 같은 fishId 중복을 막지 않는다. 증거: 로드 정규화 p2FoundationRecords.ts:112-118 `if (!fishId || seen.has(fishId)) return []` 가 뒤 행을 조용히 탈락시키고(shapeDatabaseFields.ts:243은 duplicate fishId를 assert로 하드 거부 — normalize가 먼저 돌면 행이 삭제된다). AI 툴 경로는 configure_fishing에서 즉시 정규화되므로 UI에서만 이중 행이 보인다. 영향: 편집자는 두 어획 규칙을 저작했다고 믿지만 재로드 후 한 행이 사라진다. 수정 제안: addCatch에서 기존 fishId 존재 시 차단 토스트(제작 뷰의 updateSellPrice :1139-1142 선례).
> 보류 사유: addCatch의 중복 fishId 허용(:875)은 실측이지만, 로드 순서 실측(normalizeProjectV4 내 validateSystem→validateFishing의 중복 assert가 shapeDatabaseFields.ts:243, normalizeSystemRecords는 shape.ts:175에 뒤짐)상 재로드는 "조용히 병합"이 아니라 assert throw로 로드 자체가 실패한다 — detail이 두 가능성을 병기한 지점에서 후자가 틀렸고, 실제 영향이 더 심각하므로 medium으로 상향한다.

**[DB-14-9] (medium) upsert_life_system이 dailyWeather를 무정규화 raw clone으로 기록해 커밋이 '직렬화 왕복 실패'로만 불투명 거부된다**
`src/editor/tools/lifeSystemTools.ts` · 최종 medium · 확인 · 확신 high
위치: lifeSystemTools.ts:140-143 `draft.system.dailyWeather = structuredClone(args.dailyWeather) as DailyWeatherConfig` — 값 검증·클램프가 전혀 없다. 증거: 스키마(:103-121)는 enabled/forecastDays/weight/intensity에 min/max도 required도 없어 `weight: 0`, `intensity: 5`, `forecastDays: 99`, enabled 생략, 129개 규칙이 모두 통과한다. 반면 모든 저작 UI(databaseDailyWeatherView.ts:393-405, :654-657)와 로드(databaseRecordModel.ts:231의 normalizeDailyWeatherConfig)는 정규화기를 거친다. 결과적으로 잘못된 인자는 툴 에러가 아니라 커밋 게이트의 직렬화 왕복 검사만 통과해야 걸리는데(toolRunner.ts:168 → projectLint.ts:173-182 `code: "serialize-roundtrip"`), 모델은 어느 인자가 잘못됐는지 필드 단위 안내를 받지 못해 동일 인자 재시도가 반복된다. 영향: AI 사용성·계약 문제(실패는 fail-closed이나 피드백이 불투명), 정규화기와 툴의 이중 기준. 수정 제안: run에서 normalizeDailyWeatherConfig를 적용하고 실패 시 필드별 ToolError(유효 범위 나열) 반환.

**[DB-14-10] (low) configure_fishing/configure_museum의 '부분 패치' 설명과 달리 같은 id 레코드 재전송 시 중첩 페이로드(catches/reward)가 통째로 사라진다**
`src/editor/tools/lifeCollectionTools.ts` · 최종 low · 보류 · 확신 high
위치: lifeCollectionTools.ts:252-253 "부분 패치다 — 보내지 않은 필드는 그대로 두고..." vs :283 `unionById(existing?.spots ?? [], incoming ?? [], ...)` — 같은 id의 spot은 incoming 레코드로 **통째 교체**되고, parseSpot(:236-246)은 기존 레코드를 읽지 않는다. 증거: 모델이 기존 낚시터를 `{ id, mapId, area }`만 재전송해 이동하면 catches가 빈 배열로 교체되고, normalizeFishingSystem(p2FoundationRecords.ts:47-48)은 catches가 비어도 spot을 유지하므로 어획표가 무음으로 사라진다. configure_museum의 rewards(:472, parseMuseumReward :412-429)도 동일 — `{ id, name }`만 보내면 기존 reward 페이로드(gold/itemRewards/switchId)가 소실된다. 영향: 설명 문구가 record-level 교체를 부분 패치로 오인시켜 데이터 유실을 유도. 수정 제안: 같은 id 병합(전달 필드만 덮기)으로 바꾸거나 설명에 "항목 재전송 시 중첩 배열은 전체 교체"를 명시하고 교체 경고를 summary에 추가.
> 보류 사유: 레코드 통째 교체 자체는 사실이지만, 같은 설명문이 "spots 는 같은 id 만 교체하고 기존 낚시터는 유지한다"(lifeCollectionTools.ts:253), "rewards 는 같은 id 만 교체하며"(:435-436), 파일 헤더(:6-7)에 명시적이므로 "부분 패치 설명이 오인을 유도한다"는 전제는 약하다. 중첩 페이로드(catches/reward) 소실 위험은 실재하므로 low로 조정한다.

저심각도 일괄:
- [DB-14-21] (low) 복제는 검색 필터를 해제하지 않아 복제본이 선택된 채 목록에서 보이지 않을 수 있다 — `src/editor/panels/databaseLifeCraftingView.ts`
- [DB-14-22] (low) upsert_life_skill 스키마의 description 속성은 존재하지 않는 필드로 조용히 버려진다 — `src/editor/tools/lifeSystemTools.ts`
- [DB-14-23] (low) 스위치·제작법이 모두 빈 레벨 보상 행을 UI가 허용하고 로드에서 조용히 탈락한다 — `src/editor/panels/databaseLifeCraftingView.ts`
- [DB-14-24] (low) applyAnimalPatch에 도달 불가능한 분기와 no-op 헬퍼가 남아 상호 배타 가드의 실제 경로를 흐린다 — `src/editor/panels/databaseFarmAnimalsView.ts`
- [DB-14-25] (low) 공통 이벤트 상세 히어로의 '공용 이벤트'가 목록·CTA의 '공통 이벤트'와 용어가 갈라진다 — `src/editor/panels/databaseCommonEventViews.ts`
- [DB-14-26] (low) 조건 스위치가 댕글링 id일 때 체크박스는 켜짐인데 셀렉트는 '(없음)'을 보여주고 토글 시 값이 조용히 지워진다 — `src/editor/panels/databaseCommonEventViews.ts`

### 6.15 DB-15 — AI × DB — 생성·검토 오버레이·변경 카드

**[DB-15-1] (high) DB 창 재오픈 시 보류된 검토 초안이 복원되지 않아 재요청이 초안을 조용히 덮어쓴다**
`src/editor/panels/databaseAiBar.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseAiBar.ts:18-31(브리지 import 목록에 getAiAssistantPendingProposal 없음 — 브리지에는 존재, src/editor/aiAssistantBridge.ts:166-168 "export function getAiAssistantPendingProposal"), :590("if (pendingSummary !== null)" — 로컬 UI 상태로만 검토 중 요청 차단), :513-533(paintCards — 마운트 시점 복원 로직 없음, createDatabaseAiBar 마지막은 :768 refreshContext뿐). aiChatPanel.ts:1869-1881 holdProposal은 기존 deferredProposal를 guard 없이 덮어씀("deferredProposal = { ... }"). aiChatPanel.ts:3448("if (sendOptions?.eventCommandScope && (turnBusy || proposalApi.pendingProposalMessage !== null))" — deferApply 전송은 이 차단이 없음). databaseModal.ts:184 — 바가 모달 열림마다 새로 생성되어 pendingSummary가 리셋됨.  …

**[DB-15-2] (high) 검토 오버레이는 database diff만 보여주고 적용은 에디터 전체 초안을 통째로 커밋한다**
`src/editor/panels/databaseAiBar.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseAiBar.ts:521("pendingChanges = diffDatabaseRecords(proposal.before, proposal.after)" — diff는 database 컬렉션만 비교, src/project/databaseRecordDiff.ts:200-201 "beforeDatabase/afterDatabase"), :567("적용 ${pendingChanges.length}건" — 레코드 수만 셈), :176("[컨텍스트] 에디터 전체 요청 · …" — 턴 스코프가 DB에 한정되지 않음을 스스로 표기), :532("cardsHost.hidden = pendingChanges.length === 0" — DB diff가 0이면 카드 숨김, 단 pendingSummary는 "바뀐 레코드 없음"(databaseAiChangeCards.ts:193-201)으로 남아 review phase 유지). 반면 실제 적용은 src/editor/panels/aiProposalCard.ts:281/322/344("const applyProject = proposed; applyProposedProject(applyProject, …)")로 세션 초안 프로젝트 전체(맵·이벤트·월드 포함)를 커밋한다. …

**[DB-15-3] (medium) 적용 실패 사유가 DB 오버레이에서 평문 한 줄로 뭉개진다 — stale-base·검수 미완료 상세는 숨은 채팅 버블로만 간다**
`src/editor/panels/databaseAiBar.ts` · 최종 medium · 확인 · 확신 high
위키 openwiki/editor-database.md:1559-1560은 "그 사이에 기준 프로젝트가 바뀌었으면 stale-base 로 반려되고 사유가 상태줄에 남는다"고 기록하지만, 실제 코드는 상세 사유를 폐기한다. 위치: src/editor/panels/aiChatPanel.ts:1891-1892("const outcome = await applyProposal(pending.calls…); if (outcome !== \"applied\") return \"변경을 적용하지 못했습니다 — 커밋 게이트가 반려했거나 기준 프로젝트가 바뀜습니다.\"" — applyProposedProject가 돌려준 구체적 issue(예: applyChangesetToStore.ts:305 "기준 프로젝트가 변경되었습니다…", :309 "초안을 만든 뒤 프로젝트가 수정되었습니다…")를 버리고 평문 한 줄로 뭉갬. 여기에 오타 "바뀜습니다" 포함). DB 바는 그 한 줄만 받아 databaseAiBar.ts:687("적용 실패 — ${error}")에 찍는다. 또한 초안 검수 미승인 사유는 아예 DB 표면에 오지 않는다 — aiProposalCard.ts:244-247("독립 검수가 승인되지 않았거나 초안이 바뀌어 적용하지 않았습니다." appendBubble → DB 모달 뒤에 가려진 채팅 패널로만). 영향: 검토 중 사용자가 폼을 조금 고치고 적용하면 stale-baseline 반려인데 사유를 모른 채 같은 문장만 재낭독되고, 검수 미완료 초안은 카드만 보인 채 적용이 계속 실패한다. …

**[DB-15-4] (medium) 한 번 실패한 검토 초안의 재적용이 영구히 조용히 거부된다(applyingCalls 오염, 정리 없음)**
`src/editor/panels/aiProposalCard.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/aiProposalCard.ts:236("const applyingCalls = new WeakSet<readonly ProposedCall[]>()"), :277("applyingCalls.add(calls);"), :251("if (!ownsApply() || applyingCalls.has(calls) || lastAppliedProposalMessage?.calls === calls) return \"rejected\";"). 적용 실패 경로(:364-377 — stale-base/stale-baseline/commit-rejected 전부)는 calls를 WeakSet에서 다시 빼는 코드가 없다(WeakSet.delete 미호출). DB 검토 오버레이는 실패 후에도 카드와 「적용」 버튼을 계속 보여주므로(databaseAiBar.ts:565-568, applyButton.disabled=false :684), 사용자가 다시 누르면 :251 가드가 조용히 "rejected"를 돌리고 DB 상태줄엔 뭉갠 문구(DB-15-3)만 반복된다. 영향: 일시적 반려(stale-baseline — 검토 중 폼 편집 한 번으로도 발생) 후 그 초안의 적용은 영구히 죽고, 유일한 복구는 버리기→재요청(토큰 재비용)이다. chat 표면의 제안 재적용도 동일하게 막힌다. 수정 제안: rejected 반환 직전 applyingCalls.delete(calls)(Map으로 전환)하거나, 반려 시 초안을 아예 폐기해 오버레이에서 버튼을 치우고 재요청을 안내하라.

**[DB-15-5] (medium) 생성 대화상자 실행 중 취소(ESC·취소·X)가 확인 없이 즉시 중단 — 76초 그림 생성 비용 통유실**
`src/editor/panels/databaseAiGenerateDialog.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseAiGenerateDialog.ts:294-296("const dismiss = (): void => { controller?.abort(); …"), :398-399(closeButton·headerClose → dismiss), :404("registerModal(overlay, dismiss)" — ESC 포함). src/editor/ui/modalStack.ts:32-36은 ESC 최상위 레이어에서 "event.preventDefault(); event.stopPropagation(); top.close();"로 즉시 closeUi(=dismiss=abort)를 실행한다. 같은 파일 :290("closeButton.textContent = running ? \"취소\" : \"닫기\"") — 실행 중 「취소」 버튼도 확인 없이 즉시 중단. 반면 :400-402 주석은 "실행 중 바깥 클릭은 무시한다 — 76초짜리 그림 생성을 실수로 버리지 않게"라며 바깥 클릭만 정중히 보호한다. 영향: 30초+ 그림 생성 중 ESC 한 번·취소 버튼 한 번 실수로 이미지 생성 비용과 시간이 통째로 유실되고, 진행 단계(정보→그림→등록)도 이미 진행된 만큼의 부분 결과가 없다. 수정 제안: running 중 취소 경로(ESC·취소·X)에 showConfirm("그림 생성을 중단할까요? 지금까지의 생성은 폐기됩니다")을 붙이거나, 그림 단계 완료 후에는 취소해도 정보 레코드라도 등록하는 부분 완료 정책을 둬라.

**[DB-15-6] (medium) AI 생성 아이템의 occasion이 열거형 검증 없이 저장된다 — 벗어난 값이면 런타임에서 어디서도 못 쓰는 조용한 죽음**
`src/editor/aiDatabaseGeneration.ts` · 최종 medium · 확인 · 확신 high
위치(특별 지시 「생성 값이 폼 검증을 통과하는지」 추적): src/editor/aiDatabaseGeneration.ts:55-58(ITEM_FIELDS allowlist에 occasion 포함), :60-63(ITEM_CONTRACT는 "occasion:\"always|battle|field|never\""라는 프롬프트뿐), :155-183(parseGeneratedRecord — 열거형·숫자형 검증 없이 통과). 하위 정규화도 빠져 있다: src/project/databaseRecordModel.ts:544("scope: isItemScope(record.scope) ? record.scope : \"ally\"")와 달리 :551("occasion: record.occasion ?? \"always\"")는 열거형 검증이 없어 "combat" 같은 파생값이 그대로 저장된다. 런타임은 정확 일치만 본다: src/project/itemUsage.ts:26-36("item.occasion !== \"always\" && item.occasion !== \"field\" return false", "occasion !== \"always\" && occasion !== \"battle\" return false") → 무효값 아이템은 메뉴·전투 어디서도 사용 불가가 되고, 완료 카드(databaseAiGenerateDialog.ts:142 "OCCASION_LABEL[item.occasion] ?? item.occasion")는 원시 영문을 그대로 보여준다. …

**[DB-15-7] (medium) 변경 카드에 부분 수용 경로가 전혀 없다 — 레코드 단위 수용·제외 불가, 전체 적용/전체 버리기만 존재**
`src/editor/panels/databaseAiChangeCards.ts` · 최종 medium · 확인 · 확신 medium
위치(특별 지시 「부분 수용 경로」 점검): src/editor/panels/databaseAiChangeCards.ts:153-161 — 레코드 카드가 제공하는 유일 액션은 "이동" 단추("options.onNavigate && change.change !== \"added\""일 때만), 체크박스·제외·단독 적용 없음. src/editor/panels/databaseAiBar.ts:408-441 — 행동 줄은 중단/되돌리기/채팅/지우기/버리기/적용 6개로 전체 적용(:678) 또는 전체 폐기(:709)뿐. aiProposalCard.ts:2-3도 "항목 선택 체크박스 …는 없다"가 정책으로 명시되어 부분 수용은 의도된 미제공이지만, DB 표면은 (1) 에디터 전체 초안을 커밋하는 유일한 검토 지점(DB-15-2)이고 (2) "이동" 누르면 오버레이가 접혀(toast "AI 검토는 그대로 있습니다", :529) 제외 선택지조차 없다. 영향: 여러 레코드 변경 중 1개만 수용하려면 전체 적용 후 되돌리기 또는 전체 폐기 후 재요청(재비용)뿐이다. 수정 제안: 최소한 레코드 카드 단위 체크 해제(제외) → 나머지 적용 경로를 추가하라. 구현은 held calls를 레코드별로 걸러 재구성하거나 diff의 removed/changed 집합에 대응하는 부분 커밋이 필요하다.

**[DB-15-8] (medium) 타일셋 AI 제안 모달 analyze()가 미처리 예외 시 analyzing 락·readOnly·버튼이 영구 잠긴다**
`src/editor/panels/tilesetAiProposalModal.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/tilesetAiProposalModal.ts:76-107 — analyze()가 "analyzing = true(:79), model.answerInput.readOnly = true(:80), setAnalyzingState(... buttons disabled, :83)"로 잠근 뒤 "const result = await controller.analyze(lockedAnswer);(:86)"를 try/catch·finally 없이 기다린다. 잠금 해제(:90-92)은 성공 경로에만 있다. controller.analyze는 기각될 수 있다: src/editor/panels/tilesetAiProposalController.ts:44-53(requestTilesetMapping await) + src/editor/panels/tilesetAiClient.ts:66("throw error" — LlmError/AbortError/TypeError 이외 재기드), 같은 컨트롤러의 recordAiAnalysisRun(:48-53)도 await 대상. 영향: 예기치 못한 예외 한 번이면 분석 버튼·적용 버튼이 영구 disabled, textarea가 readOnly, 상태줄은 "AI가 선택 타일, 배치 예시… 보통 90초 안팎 걸립니다"(:85)에 영구 정체 — 오류 문구조차 없이 모달을 닫아 입력을 버리는 수밖에 없다. 수정 제안: analyze() 본문을 try/catch/finally로 감싸 finally에서 analyzing=false·readOnly 해제·버튼 복구를 보장하고, catch에서 setStatus("error", 사유)를 출력하라.

**[DB-15-11] (low) DB 바 컨텍스트 풋터 주석이 이미 삭제된 INTENT_KEYWORDS/buildSpec 보장을 근거로 댄다(스테일 계약)**
`src/editor/panels/databaseAiBar.ts` · 최종 low · 보류 · 확신 high
위치: src/editor/panels/databaseAiBar.ts:169-173("채팅 파이프라인이 읽는 한 줄 컨텍스트 풋터. buildSpec 정규식과 호환되는 형식이라 바꾸지 않는다 — 탭 라벨(몬스터/아이템…)과 \"DB\" 가 INTENT_KEYWORDS 의 db/battle 강키워드라 도구 노출도 함께 보장된다"). 그러나 INTENT_KEYWORDS 표는 삭제되었다: src/editor/assistantToolMode.ts:11-14("예전에는 여기 221개 키워드 표(INTENT_KEYWORDS)가 … 이제 문장은 모델이 한 번 읽어 선언하고(intentDeclaration)"). buildSpec 쪽 파서(contextFooter.ts:42-44, buildSpec.ts:622-625)는 현재 맵/선택 영역 항목만 읽고 DB 바 푸터의 "에디터 전체 요청" 문자열을 소비하는 코드가 없다. 영향: (1) 주석이 더 이상 사실이 아닌 계약을 보증해 유지보수를 오도하고, (2) DB 바 턴의 database 도구 노출이 모델의 intentDeclaration에 의존하게 되어(선언 실패 시 "끝났지만 답이 비어 있어요" :251로 끝날 수 있음) AI 사용성 계약이 약해졌다. 수정 제안: 주석을 현재 계약(모델 선언 기반)으로 고치고, DB 바 전송 시 scope 인자 또는 강제 도메인 힌트로 database 도메인 노출을 코드 수준에서 보장하라.
> 보류 사유: 주석이 스테일인 것은 실측이다 — INTENT_KEYWORDS 표는 삭제됐고(assistantToolMode.ts:11-14) src/ai에서 "에디터 전체" 문자열을 소비하는 코드가 없다. 그러나 DB 모달이 열려 있으면 computeAssistantToolMode가 UI 도메인으로 "database"를 강제하므로(assistantToolMode.ts:5, :35-42) "database 도구 노출이 intentDeclaration에 의존해 약화됐다"는 두 번째 주장은 틀렸다.

저심각도 일괄:
- [DB-15-10] (low) 추가 레코드 카드의 그림 필드가 「지금/적용 후」 두 장 대신 원시 리소스 id 텍스트 행으로 표기 — `src/editor/panels/databaseAiChangeCards.ts`
- [DB-15-12] (low) DB 바 실행 중 제안 칩·입력이 잠기지 않아 진행 중 입력 초안이 칩 클릭으로 조용히 덮인다 — `src/editor/panels/databaseAiBar.ts`
- [DB-15-13] (low) 완료 카드가 MP 회복 수치를 보여주지 않는다 — MP 아이템 생성의 핵심 수치 검증 불가 — `src/editor/panels/databaseAiGenerateDialog.ts`
- [DB-15-14] (low) 생성 완료 문구의 조사가 「을」로 고정 — 모음 받침 이름에서 문법 오류 — `src/editor/panels/databaseAiGenerateDialog.ts`
- [DB-15-15] (low) aiProposalCard 계약 주석(확인 팝업·취소 분기 없음)이 실제 mapDestruction 확인 모달과 모순 — `src/editor/panels/aiProposalCard.ts`
- [DB-15-16] (low) appearanceTags 스키마에 minItems/maxItems가 없어 1~32개 게이트와 스키마 계약이 어긋난다 — `src/editor/tools/monsterAppearanceTools.ts`
- [DB-15-9] (low) 변경 카드의 before 값 이름 해석이 after 프로젝트 기준 — 제안으로 삭제되는 참조 레코드의 이름이 원시 id로 표기 — `src/editor/panels/databaseAiChangeCards.ts`

### 6.16 DB-16 — 리소스 피커·그래픽 선택·미디어 경로

**[DB-16-1] (high) 피커가 목록에 없는 현재 리소스를 첫 카탈로그 항목으로 조용히 치환한다**
`src/editor/panels/databaseResourcePickerDialog.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseResourcePickerDialog.ts:65-67 — `let selectedId = options.currentId && catalog.some(...) ? options.currentId : catalog[0]?.id ?? options.currentId ?? ""`. 현재 값이 카탈로그에 없으면(카탈로그가 비어있지 않은 한) 아무 안내 없이 `catalog[0]` 이 선택된 채로 열리고, 목록에는 그 항목이 active 로 하이라이트되며 미리보기도 catalog[0] 을 보여 준다. 사용자가 그냥 「선택」(databaseResourcePickerDialog.ts:173-183) 을 누르면 원래 참조가 catalog[0].id(필요시 characterIndex/graphicHue 포함)로 조용히 덮어써진다. 도달 경로가 실재한다: (1) 분할 전 4×4 페이스셋 시트 id 는 '등록만 남고 피커에서는 빠진다'(src/editor/resourceOptions.ts:85-87, matchesGeneratedKind 의 LEGACY_FACESET_SHEET_IDS 제외 — resourceOptions.ts:175)므로 구 저장본 배우의 faceResourceId 로 열면 즉시 재현, (2) 인라인 자유입력(아래 별도 항목)으로 카탈로그 밖 id 를 넣은 뒤 다시 열 때, (3) AI 가 등록한 kind:"title" resourceProfile(dbTools.ts:1362) 처럼 피커 목록에 안 나오는 id. 참고로 music/sound 는 같은 상황에서 selectedId 를 "" 로 지워버려(databaseResourcePickerDialog.ts:91-92) 종류별로도 동작이 갈라진다. …

**[DB-16-3] (high) 인라인 ID 자유입력이 존재 여부 검증 없이 키 입력마다 저작 데이터를 확정한다**
`src/editor/panels/databaseResourcePickerDialog.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseResourcePickerDialog.ts:269-292. `idInput` 은 `aria-hidden="true" tabindex="-1"`(271) 로 숨겨진 자유 텍스트 입력이고, `commitText` 는 `resourceId = idInput.value.trim()`(276) 후 **카탈로그/collectResourceIds 대조 없이** 곧바로 `input.onChange({resourceId, ...})`(278-282) 로 확정한다. 게다가 `idInput.addEventListener("input", commitText)`(285) 탓에 사람이 타이핑하면 키 입력마다 "c", "ca", "cav"… 같은 부분 문자열이 레코드에 커밋되고, 중간에 값을 비우는 순간에도 `{resourceId:""}` 가 확정된다. 대소문자·확장자·경로형 정규화도 전무하다: `Hero`, `hero.png`, `assets/generated/starter/hero-01-battle.png` 같은 입력은 resolveAssetResourceUrl 의 정확일치 테이블(src/assets/generatedAssetResourceResolver.ts:293-315, 317-319, 360-363)에서 전부 실패해 런타임까지 깨진 참조가 된다(런타임이 같은 리졸버를 씀 — src/player/battleFieldDom.ts:665, src/player/titleScreen.ts:182 등).  …

**[DB-16-2] (medium) 이벤트 명령 폼 리소스 피커가 '단일 정본' 목록을 우회해 같은 종류 후보가 표면마다 다르다**
`src/editor/panels/eventEditor/commandBodyM2.ts` · 최종 medium · 보류 · 확신 high
정본 선언: src/editor/resourceOptions.ts:63 — "데이터베이스 피커와 이벤트 명령 폼, 그리고 AI 오프닝 툴이 함께 쓰는 리소스 목록의 단일 정본이다". 그러나 이벤트 M2 명령 폼의 리소스 피커는 자체 목록을 만든다: src/editor/panels/eventEditor/commandBodyM2.ts:585 `resourcePickerItems(project.resourceProfiles, Object.values(project.assets.uploaded), request.semantic.resourceKinds)` — 구현(같은 파일 713-742)은 resourceProfiles + uploaded 만 읽고, 내장 카탈로그(EASYRPG_* / CC0 / builtinGeneratedResourceIds / GENERATED_ASSET_PLAN)를 전혀 포함하지 않는다. 피해: `Change System Graphic`({system,system2}, commandBodyM2.ts:851)와 `Change Parallax Back`/Battleback({backdrop}, 852-859)은 기본 프로젝트에 해당 kind 프로필이 아예 시딩되지 않으므로(src/project/defaults/defaultAssets.ts:232-288 — chipset/charset/picture/faceset 만 시딩) 이벤트로 시스템 그래픽·원경을 바꿀 후보가 사실상 0개다. …
> 보류 사유: M2 resourcePickerItems가 resourceProfiles+uploaded만 읽어 정본 카탈로그(EASYRPG_*/생성/scarloxy)를 우회하는 것은 실측(commandBodyM2.ts:585, :713-742)이고 표면 간 후보집합 괴리는 실재한다. 그러나 "system/system2/backdrop 후보 0개"는 오류다 — defaultResourceProfiles가 EASYRPG_RTP_ASSETS 루프(defaultAssets.ts:292-305, category 식별 매핑 :333-335)로 system  …

**[DB-16-4] (medium) 이벤트 recordPicker 아이콘은 이미지 로드 실패 시 라벨 자리표시자 계약을 어기고 깨진 <img> 를 그대로 둔다**
`src/editor/panels/eventEditor/recordPicker.ts` · 최종 medium · 확인 · 확신 high
위키 계약(openwiki/editor-database.md L1415-1424): 실패한 썸네일은 크기 0/빈 상자가 아니라 라벨 붙은 자리표시자(예: aria-label `… 이미지 불러오기 실패`)여야 하며, 그 정본 구현이 src/editor/panels/databaseRecordThumbnails.ts:177-185 `markDatabaseImageFailed` 다. DB 리소스 피커는 이를 correctly 쓴다(databaseResourcePickerDialog.ts:452-458 img error → resourceFailureVisual, cropVisual probe 503). 그러나 이벤트 쪽 recordPicker 는 같은 계약이 없다: src/editor/panels/eventEditor/recordPicker.ts:513-517 `el("img", { attrs: { src: icon.url, alt: "", ... } })` — error 리스너가 없어 깨진 URL은 브라우저 깨진이미지 글리프/빈 24px 박스로 남고(위키가 말하는 "아무것도 없다" 오독 그 자체), `alt:""`라 접근 가능한 이름도 없다. sheetRect 크롭 아이콘(519-544, background-image 방식)도 error probe 가 없어 깨지면 빈 span 이다. actorPicker/itemPicker(얼굴·아이콘 아이콘)가 전부 이 경로를 쓴다. 수정 제안: image kind 에 `image.addEventListener("error", …)` 로 markDatabaseImageFailed(또는 initialBadge) 폴백을 붙이고 alt 에 레코드 이름을 넣을 것.

**[DB-16-5] (medium) 리졸버 부분문자열 폴백이 종류 불문 오판·실패 은폐를 만든다(라벨 자리표시자 계약 우회)**
`src/assets/generatedAssetResourceResolver.ts` · 최종 medium · 확인 · 확신 high
위치: src/assets/generatedAssetResourceResolver.ts:331-343 — 모든 packaged/업로드 테이블 미스 후 `resourceId.includes("meadow")/includes("slime")/includes("minotaur")/includes("medusa")` 로 **종류(kind) 무관** 몬스터 jpg 를 돌려주고(331-334), `generated-enemy-*` 로 시작하는 모르는 id 는 무조건 `/assets/generated/starter/monster-slime-01.png`(342)로 성공한다. 이 리졸버는 모든 종류 피커 프리뷰가 공유한다(databaseResourcePickerDialog.ts:399 resourceVisual). 결과: (1) 오타/변형 id(예: 캐릭셋 id "slime-hero", 타이틀 id "slime-title")가 실패 자리표시자 대신 엉뚱한 몬스터 그림으로 렌더돼 저작자·AI가 참조 깨짐을 알 수 없고, (2) `generated-enemy-존재하지않는이름` 은 어떤 경우에도 슬라임으로 '성공'해 존재하지 않는 리소스 경로 선택(특별 점검 항목)이 프리뷰·전투 런타임 양쪽에서 은폐된다. 이는 위키의 '실패는 라벨 붙은 자리표시자' 계약(openwiki/editor-database.md L1415-1424)과 정면 충돌이다 — 실패가 실패로 보이지 않는다. 수정 제안: 이 휴리스틱 폴백은 listMonsterResources 소속 id 등 monster 표면으로 한정(호출측 옵트인)하고, 나머지 kind 는 null 을 돌려 자리표시자 경로(databaseResourcePickerDialog.ts:409)로 떨어지게 할 것.

**[DB-16-6] (medium) title 종류 피커 카탈로그가 resourceProfiles(kind:"title")를 누락해 AI가 등록한 타이틀 레이어 id 가 재선택 불가다**
`src/editor/resourceOptions.ts` · 최종 medium · 확인 · 확신 high
정본 카탈로그에서 `case "title"` 은 EASYRPG_TITLE_ASSETS 만 더하고 resourceProfiles 를 읽지 않는다(src/editor/resourceOptions.ts:98-100). 반면 movie 는 프로필을 읽고(77-83), still 도 gameOver 프로필을 읽는다(122-124) — 즉 프로필 참조는 의도된 패턴인데 title 만 빠졌다. 피해가 실재한다: AI 툴은 타이틀 레이어의 불투명 id 를 `draft.resourceProfiles.push({ kind: "title", name: resourceId, assetId: resourceId })` 로 등록하며(src/editor/tools/dbTools.ts:1356-1364, 주석 "register that opaque id just as the title picker does") 그 등록의 유일한 의미는 피커 재노출인데, listDatabaseResourceOptions("title") 은 resourceProfiles 를 보지 않으므로 그 id 는 어떤 title 피커(databaseSystemView.ts:1974-1977 레이어 피커 포함)에도 다시 나오지 않는다. 이후 현재 값이 그 id 인 상태로 피커를 열면 DB-16-1 의 catalog[0] 치환 경로로 바로 연결된다. 수정 제안: title case 에 `for (const profile of project.resourceProfiles) if (profile.kind === "title" && profile.assetId) add(profile.assetId, profile.name || profile.assetId)` 를 추가(movie 케이스와 동일 형태).

**[DB-16-7] (medium) AI upsert_item/upsert_equipment의 imageResourceId/iconResourceId만 참조 검증이 빠져 있다**
`src/editor/tools/dbTools.ts` · 최종 medium · 확인 · 확신 high
upsert_item/upsert_equipment 스키마는 `imageResourceId: stringSchema(), iconResourceId: stringSchema()`(src/editor/tools/dbTools.ts:424-425, 577-578)로 임의 문자열을 받고 run(dbTools.ts:702-720)은 어떤 리소스 검증도 하지 않는다. 같은 파일의 다른 참조는 전부 사전 검증+허용 예시를 돌려준다: 적 skillId/스위치/dropItemId(797-840), 트룹 enemyIds(893-895), species skillId/진화(924-940), 몬스터 그래픽은 ensureMonsterGraphic(src/editor/tools/monsterGraphicAssignment.ts:65-81)가 카탈로그 대조까지 한다. 팜 툴도 graphicResourceId 를 collectResourceIds 대조+제안으로 검증하며(src/editor/tools/farmSpatialTools.ts:92-117), 그 주석(92-95)은 "여기서 막지 않으면 전역 무결성 검사가 '…does not exist' 로 커밋을 거부해 모델이 어느 인자를 고쳐야 할지 모른다"고 명시한다 — 즉 이 갭은 문서화된 실패 모드(2026-09-03 실측, dbTools.ts:784-787)의 미수정 잔여다. AI 가 만든 아이콘 id 는 커밋 전체 반려(스탯 수정까지 날림) 또는 게이트 미커버 필드면 깨진 참조로 저장된다. …

저심각도 일괄:
- [DB-16-8] (low) recordPicker 카드·브라우저가 '설정됐지만 목록에 없는 값'을 (미지정)으로 위장 표시한다 — `src/editor/panels/eventEditor/recordPicker.ts`
- [DB-16-9] (low) DB 리소스 피커 검색 input에 접근 가능한 이름(aria-label)이 없다 — `src/editor/panels/databaseResourcePickerDialog.ts`

### 6.17 DB-17 — DB 저장·원격 지속성·더티 세션

**[DB-17-1] (high) 저장 스킵 위치(fresh/blank)에서 「지금 저장」이 "브라우저에 저장했습니다. 닫아도 안전합니다." 거짓 성공 보장**
`src/editor/panels/databaseModalPersistence.ts` · 최종 high · 확인 · 확신 high
위치: src/editor/panels/databaseModalPersistence.ts:30-33 (`case "saved-local": writeStatus(status, "적용했습니다. 브라우저에 저장했습니다. 닫아도 안전합니다.", "ok"); return true;` + :32 `toast("브라우저에 저장했습니다.", "ok")`). 증거: ?freshProject=1/?blankProject=1 위치에서는 src/project/devProjectPersistence.ts:49-60의 saveDevProjectOverride가 false를 반환해 localStorage 기록이 아예 없고, src/project/store.ts:1276-1282는 그때도 `{ kind: "saved-local" }`을 반환하며 dirty를 일부러 유지한다(주석 "fresh/blank 위치에서는 기록이 스킵되므로(false 반환) dirty를 유지한다(결함 ⑧·⑈)"). store 자체는 이 구분을 안다 — src/project/store.ts:1549-1550의 autoSaveStateForFlushResult는 sessionNotPersisted일 때 nonPersistentSessionAutoSaveState("이 세션은 저장되지 않습니다. 보존하려면 프로젝트를 내보내세요.", :1562-1568)를 쓰지만, DB 모달의 수동 저장 경로는 result.kind만 보고 무조건 안전 문구를 쓴다. DB 모달은 또 `dirtySession.markClean()`(databaseModal.ts:400)으로 모달 더티 프롬프트까지 꺼 버린다. …

**[DB-17-2] (medium) P6 퇴역 후에도 "온라인에 저장했습니다" 문구와 죽은 안내 경로가 실체와 불일치**
`src/editor/panels/databaseModalPersistence.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseModalPersistence.ts:26-29 (`적용하고 온라인에 저장했습니다. 닫아도 안전합니다.`), :42-45 (`온라인 저장 연결이 필요합니다. 상태바의 '온라인 저장'을 확인하세요.`), :46-49. 증거: openwiki/runtime-project-schema.md:77-87 — P6(2026-09-16)로 legacyDbProjectSync·legacyDbProjectConfig 등이 삭제되고 브리지 없는 웹은 메모리 어댑터, 정본은 Electron 로컬 폴더. src/app/mode.ts:109 주석 "P6: 온라인 저장이 없다". 즉 electron 세션의 flush 성공은 로컬 폴더 저장인데 UI는 "온라인에 저장했습니다"라고 보고하고, not-configured 사용자는 "상태바의 '온라인 저장'" 칩을 열어 보라는 안내를 받지만 그 칩의 클릭 핸들러는 src/editor/panels/dbConnectionStatus.ts:10-12에서 `() => undefined`(no-op)이고 연결 설정 모달은 P6에 퇴역해 화면 어디에도 재시도 수단이 없다. 영향: 사용자가 데이터가 어디에 저장됐는지(폴더 vs 온라인) 잘못 이해하고, 연결 필요 상태에서 복구 불가능한 안내를 따라 헤맨다. 수정: 문구를 실제 저장 대상(작업 폴더) 기준으로 고치고, not-configured 안내는 실제 존재하는 경로(시작 화면 폴더 열기/재시작)로 바꾼다. dbConnectionStatus의 no-op 설정도 회수하거나 제거.

**[DB-17-3] (medium) 지연 로드 청크 실패가 완전 무반응 — 예외 핸들러·로딩 표시 없음**
`src/editor/panels/databaseModalLazy.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseModalLazy.ts:12 — `void import("@/editor/panels/databaseModal").then(({ openDatabaseModal }) => { openDatabaseModal(initialTab, options); });` — .catch가 없다. 증거: 청크 로드 실패(재배포 후 stale 해시 404, 오프라인) 시 promise rejection이 무처리로 떨어지고 UI 반응이 전혀 없다. 동일한 무방비 패턴이 다른 동적 진입점에도 반복된다(src/editor/panels/mapLocationLayer.ts:545,554, src/editor/panels/database.ts:1163, src/editor/panels/walkEncounterModal.ts:35-37, src/editor/panels/worldEntries.ts:29, src/editor/panels/structurePlacementContextMenu.ts:202). AI 사용성 축에서도 저작 태스크 "data"가 같은 경로(src/editor/authoringTasks.ts:50 openDatabaseModalLazy)라 실패가 조용하다. 또 chunk 로딩 중 진행 표시가 없어 수 MB 청크에서 클릭이 죽은 것처럼 보인다. 부수: chunk 실패 시 options.onClose(예: walkEncounterModal의 복귀 핸들러)도 영원히 불리지 않는다. 수정: .catch에서 toast("자료집을 불러오지 못했습니다. 다시 시도해 주세요.") + 재시도 가능 상태 유지, 로딩 pending 표시 추가. 나머지 동적 진입점도 databaseModalLazy로 수렴시켜 예외 처리 단일화.

**[DB-17-4] (medium) lazy 진입 API에 준비 완료 훅이 없어 호출자가 모달 오픈 전 DOM 질의를 시도 — 레코드 점프 유실**
`src/editor/panels/databaseModalLazy.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseModalLazy.ts:8-15 — 반환값 없는 fire-and-forget API. 증거: src/editor/panels/mapEventSearchModal.ts:304-308은 `close(); openDatabaseModalLazy("commonEvents");` 직후 **동기적으로** `document.querySelectorAll("[data-record-id]")`에서 target.commonEventId 행을 찾아 click()한다. 그러나 openDatabaseModalLazy는 청크 import가 끌 때까지 모달을 만들지 않으므로 이 질의는 항상 실패(`?.click()` no-op)하고, 검색 결과의 「공용 이벤트로 이동」은 탭만 열릴 뿐 레코드 선택·reveal이 조용히 유실된다. 같은 패턴의 정답 구현이 이미 있다: src/editor/panels/mapLocationLayer.ts:545-549은 행 클릭을 import .then() 콜백 **안**에서 한다. worldManager.ts:187-204는 setSelectedRecordId(세션 기반)를 써서 안전. 영향: 지연 로드 도입(이 파일의 존재 목적)이 기존 직접 호출자의 '연 뒤 즉시 행 조작' 계약을 깼다. 수정: openDatabaseModalLazy가 Promise를 반환하거나 onReady 콜백을 받게 하고, mapEventSearchModal을 그 쪽으로 옮긴다.

**[DB-17-5] (medium) 창 닫기(beforeunload)가 DB 모달 자체 더티 — 미커밋 설정집 카드 — 를 전혀 묻지 않음**
`src/editor/panels/databaseModalDirtySession.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseModalDirtySession.ts:6-10 — 세션은 isDirty()만 노출하고 소비처는 모달 닫기 컨트롤러(src/editor/panels/databaseModal.ts:430-438 `isDirty: () => codexSession.isDirty() || dirtySession.isDirty()`)뿐이다. 증거: 창 닫기 경로는 src/main.ts:60-72가 `store.hasUnsavedChanges()`(store.ts:585-588)만 본다. 그러나 설정집 카드 초안은 commit()되기 전까지 store에 없다(src/editor/panels/worldCodexSession.ts:16-27 — isDirty는 state.editDraft 메모리 기반, commit()이 saveDraft로 store에 반영). 따라서 카드를 스테이징해 둔 채(footer에 "설정집 카드 저장 전"이 떠 있는 상태) 창을 닫으면 store는 clean이라 무경고로 초안이 유실된다. 모달 자체의 닫기(X·Esc·닫기 버튼)는 잡아주지만 창 닫기는 그 계약을 우회한다. 영향: 사용자가 명시적으로 만든 저작물(카드)의 조용한 손실. 수정: store(또는 window 이벤트)에 동기 dirty 공급자 등록 지점을 두고 beforeunload가 모달 더티도 묻게 하거나, codex 초안을 이벤트 드래프트 볼트처럼 세션 저장소에 체크포인트한다.

**[DB-17-6] (medium) 강제 재로드 후에도 DB 모달 더티 세션이 구 스냅샷을 보유 — 「복구하고 닫기」가 재로드 본을 되돌려쓰기**
`src/editor/panels/databaseModalDirtySession.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseModalDirtySession.ts:27-48 — 세션은 생성 시점 스냅샷만 알고 무효화 신호가 없다. 증거: 모달의 store 구독은 `change.projectSwitch`일 때만 세션을 포기한다(src/editor/panels/databaseModal.ts:334-340). 그러나 강제 재로드는 의도적으로 projectSwitch를 올리지 않는다(src/project/store.ts:707-708 주석 "같은 projectId의 원격 저장본을 다시 읽는 경로라 의도적으로 프로젝트 전환 표시를 하지 않는다"). 재로드 후 모달은 열린 채로 refresh되고 dirtySession의 cleanSignature는 여전히 재로드 이전 내용을 가리킨다. 이때 닫기 프롬프트에서 「열 때 상태로 복구하고 닫기」를 고르면 src/editor/panels/databaseModal.ts:410-418이 store.replace(재로드 이전 스냅샷 + 현재 maps) 후 `void store.flush()`까지 실행해 — 재로드로 방금 받아들인 정본(및 그 이후 사용자 편집)을 세션 오픈 시점 내용으로 되돌려 즉시 디스크에 확정한다. 영향: 메뉴의 확인 대화를 통과한 강제 새로고침이 모달 닫기 한 번으로 무의미해진다(되돌려쓰기). 수정: reloadFromRemote가 change에 재로드 표시(또는 projectSwitch)를 실어 모달이 dirty 세션을 폐기·재스냅샷하게 한다. 혹은 모달이 세션 스냅샷의 프로젝트 식별/개정과 current가 어긋나면 복구 대신 재스냅샷한다.

**[DB-17-7] (medium) 증명·스냅샷 읽기(loadForProof/loadSnapshot)가 sha256 CAS 기대값(loadedSha)을 디스크 현재 값으로 조용히 재채택 — 외부 변경 충돌 감지 상실**
`src/project/persistence/electronRepository.ts` · 최종 medium · 확인 · 확신 high
위치: src/project/persistence/electronRepository.ts:130-139 — `snapshotOf`가 읽기 도우미인데 `loadedSha = sha256 ?? null`이라는 쓰기 상태(다음 저장의 expectedSha)를 바꾼다. 이 도우미는 loadProject(:171-177)뿐 아니라 loadSnapshot(:178-182)과 loadForProof(:183-187)에서도 쓰이고, loadForProof는 store.verifyPersistedRevision(src/project/store.ts:915)과 loadProjectFromCanonicalStore(src/project/tileMetadataDb.ts:41-45)에서 세션 도중 호출된다. save()는 `expectedSha: loadedSha`로 CAS를 건다(:188-195). 증거에 의한 영향: 세션 로드(sha X) 후 외부 프로세스(다른 편집기 창, scripts/oprn-store.mjs 등 헤드리스)가 같은 폴더 문서를 sha Y로 바꾸면, 원래라면 다음 풀 저장이 CAS 충돌("프로젝트가 다른 사용자에 의해 변경되었습니다", electron/local-store/store.ts:398-411)로 막혀야 한다. 그러나 그 사이에 증명 읽기 한 번이 끼면 loadedSha=Y로 재채택돼 CAS가 통과하고 세션 내용이 외부 변경을 덮어쓴다(마지막 쓰기 승자 유실). 또한 증명 검증 자체가 외부 변경을 흡수한 읽기로 수행될 수 있다. 수정: snapshotOf에서 loadedSha를 갱신하지 않고 세션 로드(loadProject) 전용 경로에서만 설정하거나, 읽기 시점 sha가 세션 기대값과 다르면 증명 결과에 mismatch 이유를 남기고 CAS 기대값은 보존한다.

저심각도 일괄:
- [DB-17-10] (low) 위키가 삭제된 legacyDbProjectSync.ts를 정본 소스로 계속 지목 — AI가 404 소스와 부활 금지 가드 사이에 갇힘 — `openwiki/runtime-project-schema.md`
- [DB-17-11] (low) Error가 아닌 throw 재던짐 → 저장 흐름 전체가 unhandled rejection, 푸터가 「저장하는 중」에 정체 — `src/editor/panels/databaseModalPersistence.ts`
- [DB-17-12] (low) 프로젝트 전환 토스트의 「저장하지 않은 편집은 이전 프로젝트에 남아 있습니다」가 실제로는 유실될 수 있어 과잉 보장 — `src/editor/panels/databaseModalDirtySession.ts`
- [DB-17-8] (low) 저장 catch-up 루프 조건의 항진식 — canonical 가드가 죽은 코드 — `src/project/store.ts`
- [DB-17-9] (low) 프로젝트 단위 충돌이 "…맵이 다른 세션에서…" 맵 문법에 끼워 문장 파손 — `src/editor/panels/databaseModalPersistence.ts`

### 6.18 DB-18 — DB ↔ 런타임 계약(죽은 필드 사냥)

**[DB-18-1] (high) 도주(escape) 경로는 전투 종료 해제 상태를 지우지 않아 버프·수면이 다음 전투로 이월됨**
`src/battle/runtime.ts` · 최종 high · 확인 · 확신 high
위치/증거: src/battle/runtime.ts:769-776(게이지 흐름 도주 성공)와 1180-1185(strict 상한 스테일메이트)가 `result = "escape"; phase = "resolved"; return;`로 끝나며 clearEndOfBattleStates()를 호출하지 않는다. 같은 함수 안에서도 패배(2461), Gen1 승리(2471), 일반 승리(2483), 이벤트 후 패배(2294)는 모두 clearEndOfBattleStates()를 호출한다. clearEndOfBattleStates(2489-2499)는 battleStates.ts:239-243 clearBattleEndStates로 removeOnBattleEnd 상태를 지운다. 그런데 세션 동기화는 src/player/battleRewardsToSession.ts:35-44가 "승리/도주와 패배 분기 복귀 모두 전투 중 변경된 상태를 유지한다"며 escape에서도 applyBattleStatesToSession(116-124)으로 스냅샷 stateIds를 session.actorStateIds에 그대로 적고, 다음 전투 개시 때 src/player/playSceneBattle.ts:98 `stateIds: scene.session.actorStateIds` → src/battle/battleBattlers.ts:139로 재시딩된다. …

**[DB-18-2] (high) 제한(restriction) 드롭다운 저작이 런타임에서 죽어 있다 — 한국어 값 vs 영어 전용 정규식**
`src/battle/battleStates.ts` · 최종 high · 확인 · 확신 high
위치/증거: src/battle/battleStates.ts:79-82 `restrictsActionFrom`은 `stateId === "state_sleep"` 하드코딩 외에 `/(\b(cannot act|stun|sleep|paraly[sz]ed|immobilized)\b/i`만 검사한다. 그러나 에디터가 저작하는 값은 전부 한국어다 — src/editor/panels/databaseStateRecordView.ts:20 `RESTRICTION_OPTIONS = ["없음", "행동 불가", "아군에게 공격 불가", "스킬 사용 불가", "물리 공격 불가"]`, 52-54에서 이 값을 record.restriction에 그대로 저장. 온톨로지도 한국어(src/project/ontology/databaseStateOntology.ts:58 수면 "행동 불가"). 새 상태(id 비하드코딩)에 제한="행동 불가"를 골라도 runtimeEffects.restrictsAction을 별도로 켜지 않으면 restrictsAction=false라 전투에서 아무 제한이 없다. 에디터 자체가 이 결함을 인지하고 있다: databaseStateRecordView.ts:124-127 "온톨로지 텍스트 파싱 경로(restrictsActionFrom 등)는 영어 정규식인데 온톨로지 데이터는 한국어라 사실상 죽어 있다 — 그래서 위 '제한: 행동 불가' 드롭다운을 골라도 새 상태는 그대로 행동한다." openwiki/runtime-battle.md:543은 "avoiding Korean display-string comparisons as rule authority"를 요구하지만 이 폴백 계층이 바로 그 금지된 비교다. …

**[DB-18-3] (high) 해제 조건 "전투 종료 후 유지"가 런타임에서 역전 — 유지 상태가 전투 종료 시 해제됨**
`src/battle/battleStates.ts` · 최종 high · 확인 · 확신 high
위치/증거: src/battle/battleStates.ts:102-105 `removeOnBattleEndFrom`은 `state_poison` 하드코딩 false 외에 `!/\b(persist|keep|remain)\b/i.test(value)`만 검사하는데, 에디터/온톨로지 값은 한국어다(REMOVAL_OPTIONS[0]="전투 종료 후 유지", src/editor/panels/databaseStateRecordView.ts:19; 온톨로지 state_deep_poison removalCondition="전투 종료 후 유지", 요약 "전투 뒤에도 유지되는 상태입니다" — src/project/ontology/databaseStateOntology.ts:208,227). 한국어에는 persist/keep/remain이 없으므로 state_poison이 아닌 모든 '유지' 상태는 removeOnBattleEnd=true로 역전된다. stateBehavior(battleStates.ts:72)는 `runtime?.removeOnBattleEnd ?? removeOnBattleEndFrom(...)`이므로: (1) 사용자가 해제 조건="전투 종료 후 유지"로 만든 신규 상태는 전투 종료 시 해제돼 저작 의도와 반대로 동작하고, (2) DB-is-truth로 sparse 로드된 state_deep_poison 레코드(runtimeEffects 유실 시 — openwiki/state-system.md:78 "repairLegacyDbCurrentJson no longer backfills")는 온톨로지 id 폴백에서 지속피해 12%는 살아있는데 유지 계약만 깨진 반쪽 상태가 된다. …

**[DB-18-4] (high) hpReleaseTurn 양수 값이 Math.abs로 조용히 '피해'로 역전된다 (+정수 절사 트랩)**
`src/battle/battleStates.ts` · 최종 high · 확인 · 확신 high
위치/증거: src/battle/battleStates.ts:45-51 hpDamagePercentFrom은 문자열 경로에서 "-6%"→6(피해), "+8%"→0(무효)으로 부호를 존중하지만, bare 숫자 경로는 `Math.abs(Number(bareMatch[1]))`로 부호를 버린다. resolvedStateValues(src/project/ontology/databaseStateOntology.ts:360)는 `record.hpReleaseTurn !== undefined ? `${record.hpReleaseTurn}` : base.hpTurn`로 레코드 숫자를 그대로 이 슬롯에 주입하므로, 사용자가 폼(src/editor/panels/databaseStateRecordView.ts:80-81, min -100 max 100)에서 +8(회복 의도)을 넣으면 resolved.hpTurn="8" → bare 경로 → **턴당 최대 HP 8% 피해**로 변환된다. 같은 폼이 안 보여주는 온톨로지 표기 관례는 "매 턴 최대 HP의 +8%"=회복(state_regen, databaseStateOntology.ts:244)이라 관례 자체가 모순된다. 추가로 이 레거시 필드는 정수만 저장돼 6.25가 0으로 뭉개진다 — 에디터 힌트가 자백한다(databaseStateRecordView.ts:162-163 "위 'HP > 전투 중(턴당%)' 필드는 정수 파서를 타서 6.25 가 0 으로 뭉개진다. 소수는 여기로."). 영향: 회복 상태를 만들려던 저작이 피해 상태가 되고, 소수 위력은 무음으로 0이 된다. …

**[DB-18-5] (high) MP 감소 저작 필드(mpReleaseTurn/mpReleaseStep)는 런타임 어디에서도 읽지 않는 죽은 필드**
`src/battle/battleStates.ts` · 최종 high · 확인 · 확신 high
위치/증거: 에디터는 MP 패널로 "전투 중(턴당%)"(mpReleaseTurn)과 "맵 이동(걸음당)"(mpReleaseStep)을 저작한다(src/editor/panels/databaseStateRecordView.ts:87-93), upsert_state 스키마도 받는다(src/editor/tools/dbTools.ts:641-642), normalizeStateRecord도 보존한다(src/project/databaseRecordModel.ts:83-84). 그러나 전투 유지비 처리 runStateUpkeep(src/battle/battleStates.ts:185-212)은 hpDamage/hpHeal만 계산하고 MP는 전혀 다루지 않고, 구조 레이어 StateRuntimeEffects에도 MP 필드가 없다(src/project/types/database.ts:636-645). src 전역 grep에서 mpReleaseTurn/mpReleaseStep/mpTurn/mpMove의 소비자는 src/battle, src/player에 하나도 없다(에디터·모델·온톨로지 표시뿐). 영향: MP 흡수 상태(예: 턴당 MP -10%)를 저작해도 전투에서 아무 일이 없다 — 저장된 데이터는 유효해 보이는 죽은 값. 수정 제안: runStateUpkeep에 mpReleaseTurn 기반 MP tick을 추가하거나(HP와 동일한 clamp 정책), StateRuntimeEffects에 mpDamagePercentPerTurn을 추가하고 폼/툴 스키마를 실제 소비 필드로 한정해 죽은 경로를 제거한다.

**[DB-18-6] (high) hpReleaseStep(맵 이동 걸음당 HP 감소)도 죽은 필드 — 독의 '4걸음마다 HP -1' 광고가 구현 없음**
`src/project/session.ts` · 최종 high · 확인 · 확신 high
위치/증거: 에디터가 "맵 이동(걸음당)" 필드로 hpReleaseStep을 저작한다(src/editor/panels/databaseStateRecordView.ts:83-85), 온톨로지는 독/맹독에 "4걸음마다 HP -1"/"4걸음마다 HP -2"로 기능을 광고한다(src/project/ontology/databaseStateOntology.ts:47,223). 그러나 hpReleaseStep/hpMove의 소비자가 src/player 전역에 없다(필드 이동·걸음 카운트 어디서도 세션 바이탈을 상태 기반으로 깎는 코드가 없음 — src 전역 grep 확인). 결론적으로 독에 걸린 채 맵을 걸어도 HP가 줄지 않는다. RM2K3의 대표 지속피해 시맨틱이 에디터에는 있고 런타임에는 없는 전형적인 저작↔런타임 단절. 부수 일관성 결함: 같은 이유로 필드에서 독이 전혀 갱신되지 않으므로 recoverAll 미비(DB-18-11)와 결합해 '독 상태'는 필드에서는 영원히 무해한 표식이다. 수정 제안: 플레이어 이동 주기에서 session.actorStateIds 기반으로 hpReleaseStep을 소비하는 필드 업킵을 추가하거나, 미구현이면 폼 필드·온톨로지 문구를 제거해 저작을 차단한다.

**[DB-18-7] (high) specialFlags 5종(100% 회피·마법 반사·장비 고정·회피 불가·장비 고정 영향 없음) 전부 런타임 미소비**
`src/battle/battleStates.ts` · 최종 high · 확인 · 확신 high
위치/증거: 폼이 5개 플래그 체크박스를 저작한다 — src/editor/panels/databaseStateRecordView.ts:204 `ALL_FLAGS = ["100% 회피", "마법 반사", "장비 고정", "회피 불가", "장비 고정 영향 없음"]`, 206-223에서 record.specialFlags로 저장, upsert_state도 받는다(dbTools.ts:643), normalizeStateRecord도 보존한다(databaseRecordModel.ts:85). 그러나 src/battle·src/player 어디에도 specialFlags를 읽는 코드가 없다(전역 grep: 에디터/프로젝트 모델뿐). 특히 모순이 선명한 사례: 수면·마비 온톨로지는 specialFlags:["회피 불가"]를 광고한다(databaseStateOntology.ts:60,192) — 그러나 명중 계산 src/battle/runtime.ts:2220 `rate -= Math.max(-20, Math.min(40, (target.agility - user.agility) * 0.5))`은 민첩 회피를 플래그와 무관하게 적용하므로 잠든 대상이 회피로 공격을 피할 수 있다(회피 불가 미적용). '마법 반사', '100% 회피', '장비 고정'도 대응 런타임이 전무하다. 영향: 에디터가 기능을 약속하고 온톨로지가 기본 상태에 부여까지 해 놓았지만 전투 결과는 무관 — 저작 신뢰 붕괴. 수정 제안: 플래그별 런타임 소비(회피 불가→민첩 회피 페널티 무시, 100% 회피→normalAttackHitRate 상한 처리, 장비 고정→장비 변경 메뉴 게이트)를 구현하거나, 미구현 플래그는 폼에서 비활성화하고 라벨로 '미적용'을 명시한다.

**[DB-18-8] (high) 전투 이벤트(트룩 페이지)에서는 액터에게 상태를 부여할 방법이 없다 — Change State(m2-019) 미지원**
`src/battle/battleM2Commands.ts` · 최종 high · 확인 · 확신 high
위치/증거: 에디터는 Change State(m2-019-change-state)를 '주인공' 대상 커맨드로 저작하게 한다(src/editor/panels/eventEditor/commandBodyM2.ts:68-69, src/project/eventCommands/m2Catalog.ts:362-365 target 기본 "party", commandSummary.ts:688). 필드 인터프리터는 실행한다(src/player/interpreter/m2Runtime.ts:464-469). 그러나 전투 이벤트의 m2Command는 executeM2Command(src/battle/battleEvents.ts:740-754) → parseM2BattleCommand(src/battle/battleM2Commands.ts:24-74)뿐이고, 여기는 m2-098~m2-108만 파싱하며 상태 커맨드는 적 전용 m2-100-change-enemy-state뿐이다. m2-019는 default → undefined → handled:false → logUnsupported(battleEvents.ts:753). 분류 데이터도 m2-019를 M2_MAP_COMMON_FULL_IDS에만 넣고 M2_TROOP_FULL_IDS에서 뺀다(src/project/eventCommands/m2RuntimeClassificationData.ts:159,178-190). 그런데 openwiki/runtime-battle.md:374는 "과거의 첫 적/첫 상태 암묵 적용 폴백은 제거했다. …

**[DB-18-10] (medium) 필드 Change State도 database.states 검증 없이 session.actorStateIds에 임의 문자열을 심는다**
`src/player/interpreter/m2Runtime.ts` · 최종 medium · 확인 · 확신 high
위치/증거: src/player/interpreter/m2Runtime.ts:464-469 `if (title === "Change State") { actor.states = applyStringCollection(actor.states, fields); session.actorStateIds[targetActorId] = [...applyStringCollection(...)] }` — context.project(357)에 database.states가 있어 검증이 가능함에도 id 존재를 확인하지 않는다. 프로젝트 불변식은 "삭제된 상태 id는 세션에 심기지 않는다"(openwiki/runtime-battle.md:541)이며, 검증 레이어 references.ts도 state_death 특례 외 존재 검사를 요구한다(src/project/io/references.ts:1366-1367). 이 경로로 심긴 유령 id는 다음 전투에 배틀러 stateIds로 시딩(src/player/playSceneBattle.ts:98 → src/battle/battleBattlers.ts:139)되어 UI에 원문 id 배지로 표시된다(battleFieldDom.ts:1173). 수정 제안: add/remove 모두 database.states 존재 검사를 통과시키고, 미존재 id는 unsupported 로그를 남긴 뒤 세션에 쓰지 않는다.

**[DB-18-11] (medium) Recover All(전투·필드)이 상태 계층과 단절 — 상태를 하나도 해제하지 않고 전투 중 사망자까지 부활시킨다**
`src/battle/battleEvents.ts` · 최종 medium · 확인 · 확신 high
위치/증거: 전투 이벤트 recoverAll은 src/battle/battleEvents.ts:666-671 `for (const actor of resolveActorTargets(...)) { actor.hp = actor.maxHp; actor.mp = actor.maxMp; }` — stateIds를 건드리지 않는다. 필드 recoverAll도 src/project/sessionActorCommands.ts:67-81 `vitals.hp = vitals.maxHp; vitals.mp = vitals.maxMp;`뿐, session.actorStateIds를 비우지 않는다(심지어 commandCatalog.ts:379-384의 Damage Processing이 방금 심은 state_death조차 유지). RM2K3의 전회복(Recover All)은 HP/MP 회복 + 상태이상 해제가 표준이고, 이 저장소에도 상태 해제 수단은 스킬/아이템의 stateEffects remove뿐이라 이벤트 저작자에게는 전투 중 상태 클리어 수단이 없다. 추가 결함: 전투 recoverAll은 hp>0 가드가 없어 KO된 배틀러를 그대로 부활시킨다(hp 0 → maxHp) — resolveOutcome(2458)의 전멸 판정이 트룩 페이지 recover-all 하나로 뒤집힌다. 영향: '회복 이벤트' 저작이 상태를 남기고, 쓰러짐이 이벤트로 소거됨. 수정 제안: 양쪽 recoverAll에 (1) hp 0 대상 제외 또는 의도 명시, (2) stateIds에서 behaviorFor 가능 상태 전량 해제 + 타임라인 stateRemoved(reason:"effect") 기록을 추가한다.

**[DB-18-12] (medium) state_death는 정의 레코드가 없는 상태인데 세션에 스탬프되어 살아있는 배틀러에게 유령 배지를 만든다**
`src/project/session.ts` · 최종 medium · 확인 · 확신 high
위치/증거: src/player/interpreter/commandCatalog.ts:379-384, src/player/playSceneDefeat.ts:15-20, src/player/playSceneActionCombat.ts:595-600이 죽음 처리에서 `states.add("state_death")`로 session.actorStateIds를 오염시킨다. 그러나 database.states에는 state_death 레코드가 없다 — 기본 12상태 시드에 없고(src/project/defaults/defaultDatabaseStarterRecords.ts:120-154), 검증기는 특례로 화이트리스트한다(src/project/io/references.ts:1366-1367,1382-1383 `stateId === "state_death" || ...`). 전투 런타임은 사망을 state가 아니라 hp<=0과 스냅샷 `defeated` 플래그로만 다룬다(src/battle 전역에 state_death 참조 0건, 배틀 UI 배지는 battleFieldDom.ts:1174 `battler.defeated ? [{icon:"death",name:"전투불능"}, ...states]`). 결과: Damage Processing으로 쓰러뜨린 뒤 아이템으로 HP만 회복한 액터는 hp>0인데 session.actorStateIds에 state_death가 남고, 다음 전투 배틀러 stateIds로 시딩되어 살아 있는 배틀러에게 원문 id 배지(battleFieldDom.ts:1159-1160 폴백 `?? stateId`)가 붙는다. …

**[DB-18-13] (medium) accuracyModifier는 원본 레코드 직접 읽기(resolvedStateValues 우회) + 일반 공격에만 적용(스킬 무영향)**
`src/battle/runtime.ts` · 최종 medium · 확인 · 확신 high
위치/증거: 유일한 소비처는 일반 공격 명중률뿐이다 — src/battle/runtime.ts:2216-2219 `for (const stateId of user.stateIds) { const state = options.project.database.states.find(...); if (typeof state?.accuracyModifier === "number") rate *= state.accuracyModifier / 100; }`. (1) resolvedStateValues를 우회해 원본 레코드를 직접 읽는다 — openwiki/state-system.md:85 "resolvedStateValues is the single merge point — both the view and runtime should go through it rather than reading StateRecord fields directly" 위반(sparse 레코드에서 온톨로지 accuracyModifier 폴백이 무시됨, 현재 기본값이 전부 100이라 증상은 잠복). (2) 스킬 명중(combinedSkillHitRate, runtime.ts:2190-2195)에는 전혀 반영되지 않아 명중률 보정 상태가 스킬전에서 무효다. (3) 폼 라벨은 "명중률 보정/성공률"(src/editor/panels/databaseStateRecordView.ts:56-59)로 적용 범위(일반 공격 전용)를 알려주지 않는다. 수정 제안: 소비를 resolvedStateValues 경로로 바꾸고, 스킬 hit 계산에도 적용할지 계약을 정해 폼 문구에 범위를 명시한다.

**[DB-18-14] (medium) 클래스(classes)의 stateRates를 런타임이 읽지 않는다 — 배우/적만 조회**
`src/battle/battleStates.ts` · 최종 medium · 확인 · 확신 high
위치/증거: 상태 저항 조회는 src/battle/battleStates.ts:119-124 `const actor = project.database.actors.find(...); const enemy = project.database.enemies.find(...); const grade = actor?.stateRates?.[stateId] ?? enemy?.stateRates?.[stateId];` — 클래스는 후보 자체가 없다. 그러나 ClassRecord에도 stateRates가 있고(src/project/types/database.ts:106, upsert_class 스키마 dbTools.ts:622 rateMapSchema), 신규 클래스는 state_death C가 시드된다(openwiki/runtime-battle.md:547 "new enemies/classes seed state_death at C"; 시드 로직 src/project/databaseRecordModel.ts:491-493). 즉 에디터에서 '기사 클래스는 즉사 저항 B'를 저작해도 전투 저항 판정은 배우 개인 stateRates(기본 없음→100%)만 본다. RM2K3에서 클래스 유효도는 배우 유효도의 폴백/기반이다. 영향: 클래스 단위 저항 저작이 전면 무효. 수정 제안: stateResistancePercent에서 actor.stateRates → 소속 클래스 stateRates → enemy 순 폴백 체인을 만들거나, 클래스 폼에서 stateRates 편집을 제거한다.

**[DB-18-15] (medium) upsert_state AI 스키마가 런타임에서 무효인 필드·문자열을 그대로 노출해 no-op 저작을 유도한다**
`src/editor/tools/dbTools.ts` · 최종 medium · 확인 · 확신 high
위치/증거: src/editor/tools/dbTools.ts:627-646 stateRecordSchema는 restriction/removalCondition(자유 문자열 — 런타임 정규식과 불일치해 무효, DB-18-2/3), hpReleaseStep/mpReleaseTurn/mpReleaseStep(전면 미소비, DB-18-5/6), specialFlags/lockedParameters(미소비, DB-18-7/16), priority/animationIndex(미소비, DB-18-17/19)를 전부 허용한다. AI는 이 스키마를 보고 'restriction: "행동 불가"' 또는 'mpReleaseTurn: 5'로 상태를 완성했다고 믿지만 전투 결과는 no-op다. 반대로 실제 소비되는 런타임 계약(수면의 회피 불가 같은 특수 플래그, MP 감소)은 schema상 표현 불가. openwiki/state-system.md:118은 dbTools를 'allowed-field guidance'가 있다고 기술하지만 스키마 자체는 죽은 필드를 필터링하지 않는다. 영향: AI 조수가 upsert_state로 만든 상태의 상당수가 조용히 무효 — AI 사용성 축의 핵심 계약 문제. 수정 제안: stateRecordSchema에서 검증된 소비 필드(id/name/gen1MajorStatus/recover*/hpReleaseTurn/runtimeEffects)만 남기고, restriction/removalCondition은 enum 토큰+런타임 정규화로 교체, 미소비 필드는 description에 '미적용' 명시 또는 제거.

**[DB-18-16] (medium) lockedParameters(봉인 파라미터)도 죽은 데이터 — 온톨로지가 수면에 '공격/정신/방어/민첩' 봉인을 광고하지만 능력치에 반영 없음**
`src/battle/battleStates.ts` · 최종 medium · 확인 · 확신 high
위치/증거: 폼은 '고정 항목'으로 온톨로지 값을 표시한다(src/editor/panels/databaseStateRecordView.ts:77 `readonlyControl("고정 항목", ontology.lockedParameters.join(", ") || "없음")`), 수면은 ["공격","정신","방어","민첩"](databaseStateOntology.ts:66), 마비는 ["민첩"](198) — RM2K3에서 봉인 파라미터는 해당 능력치 절반을 의미한다. 그러나 lockedParameters의 소비자는 src 전역에 없고(에디터 표시·스키마·normalize·타입뿐), battleStates의 stateBehavior(battleStates.ts:59-77)와 배율 함수들(252-265)은 봉인을 모른다. 배우/적 능력치 파생(battleBattlers.ts actorDerivedStats)에도 상태 봉인 입력이 없다. 영향: 수면이 '민첩/방어 절반' 같은 RM2K3 부수효과를 가진 것으로 화면에 표시되지만 전투 수치엔 무관. 수정 제안: 봉인 파라미터를 ability 배율 계산에 반영하거나(공격/방어/민첩 ×0.5), 표시에서 제거해 '파생 참고값'임을 명시한다.

**[DB-18-17] (medium) animationIndex(상태 애니메이션 번호)는 편집·저장되지만 부여 시 재생 경로가 없다**
`src/battle/battleStates.ts` · 최종 medium · 확인 · 확신 high
위치/증거: 폼에서 편집 가능한 필드로 저작된다(src/editor/panels/databaseStateRecordView.ts:235-245 numberField("번호", "db-state-animation-index", ...) → update({animationIndex}), dbTools.ts:635, databaseRecordModel.ts:77 보존). 그러나 상태 부여 시 애니메이션을 재생하는 런타임이 없다 — applyStates/applyStateEffects(src/battle/runtime.ts:470-487, battleStates.ts:142-168)는 stateAdded 타임라인 사실만 기록하고 stateId의 animationIndex를 조회하지 않으며, src 전역에서 animationIndex 소비자는 에디터/모델뿐이다. 영향: '상태 적용 시 애니메이션'(openwiki/state-system.md:32의 저작 필드 설명)이 실제로는 재생 불가한 값. 프리뷰 박스(view:242 `text: "상태"`)도 정적 텍스트라 번호가 무엇을 가리키는지조차 보여주지 못한다. 수정 제안: stateAdded 타임라인 소비 계층에서 animationIndex를 재생하거나, 필드를 제거/readonly화한다.

**[DB-18-9] (medium) changeEnemyState는 database.states에 없는 상태 id도 배틀러에 심는다 (다른 적용 경로와 이중 기준)**
`src/battle/battleM2CommandExecutor.ts` · 최종 medium · 확인 · 확신 high
위치/증거: src/battle/battleM2CommandExecutor.ts:47-59의 changeEnemyState는 `enemy.stateIds = [...enemy.stateIds, parsed.stateId]`로 대상 존재만 검사하고 상태 id가 project.database.states에 존재하는지는 검사하지 않는다. 같은 저장소의 다른 상태 적용 경로는 모두 가드한다: 스킬/아이템 applyStateEffects(src/battle/battleStates.ts:151 `if (!behaviorFor(project, effect.stateId)) continue;`), 필드 아이템(add 후보도 database.states 존재 확인, src/player/playerItemUse.ts:230-232; 계약 문구 openwiki/runtime-battle.md:541 "a deleted state id must not be planted"). 삭제된 상태를 참조하던 트룩 이벤트가 남아 있으면 유령 id가 배틀러에 심기고, 배틀 UI는 레코드를 못 찾아 원문 id를 그대로 표시한다(src/player/battleFieldDom.ts:1159-1160 `?.name ?? stateId`, 1173 상태 아이콘 클러스터). 슬라이스 상한 slice(0,4)(1173)라 유령 배지가 실제 상태 배지를 밀어낼 수도 있다. stateTurns는 심어지지만 runStateUpkeep/behaviorFor가 unknown을 무시하므로 로직상은 불능 — 순수 오염. 수정 제약: changeEnemyState에서 database.states에 없는 stateId는 handled:false+unsupported 로그로 거르거나 조용히 skip해 다른 경로와 계약을 맞춘다.

**[DB-18-20] (low) 온톨로지 rates('상태 유효도' 패널)는 어떤 계산에도 참여하지 않는 표시값이며 실제 저항 체계와 척도가 다르다**
`src/project/ontology/databaseStateOntology.ts` · 최종 low · 보류 · 확신 high
위치/증거: 상태 폼의 '상태 유효도' 패널은 온톨로지 rates(A:90/B:70/C:50/D:30/E:0, databaseStateOntology.ts:28; 수면은 A:95...)를 readonly로 보여준다(src/editor/panels/databaseStateRecordView.ts:62,225-233). 그러나 실제 저항 판정은 이 값을 쓰지 않는다 — stateResistancePercent는 배우/적 stateRates 등급을 ACTOR_STATE_RATE_PERCENTAGES(A:100/B:80/C:60/D:40/E:20, src/project/actorModel.ts:33-38)로 환산한다(battleStates.ts:118-124). 즉 같은 A~E 등급이 두 체계에서 서로 다른 백분율을 가리키고, 폼에 표시되는 쪽은 계산에 불참하는 표시 전용값이다. AI/사용자가 '이 상태의 저항표'로 오독하기 쉽다. 수정 제안: 패널에 '표시용 참고치(런타임 저항은 배우/적 유효도 사용)' 출처를 명시하거나, 배우/적 유효도와 동일 척도로 정규화한다.
> 보류 사유: 핵심은 맞다: 유효도 패널(view :225-233)의 온톨로지 rates(A:90/B:70/C:50/D:30/E:0, ontology :28, 수면 A:95:61)는 표시 전용이고 실제 판정은 stateRatePercentage→ACTOR_STATE_RATE_PERCENTAGES(actorModel.ts:33-39, 195-197)를 쓴다. …

저심각도 일괄:
- [DB-18-18] (low) 액터의 지속 상태 턴 카운터는 전투 사이에 영속되지 않는다(몬스터 인스턴스와 비대칭) — `src/project/session.ts`
- [DB-18-19] (low) 상태 priority(우선도)는 저작·저장만 되고 동시 상태 정렬 어디에서도 쓰이지 않는다 — `src/battle/battleStates.ts`
- [DB-18-21] (low) hpDamagePercentForStateExplicit는 src·test 어디에서도 호출하지 않는 죽은 export — `src/battle/battleStates.ts`

### 6.19 DB-19 — DB CSS·시각 일관성·토큰

**[DB-19-1] (high) 가상 목록 윈도잉 수학이 컨테이너 gap(1~2px)을 모델에 못 넣어 긴 목록에서 스크롤 지도·하단 도달이 깨진다**
`src/styles/database/virtual-list.css` · 최종 high · 확인 · 확신 high
위치: src/styles/database/virtual-list.css:7-9, src/styles/database/from-editor-event-editor-legacy-part-1.css:88-91, src/styles/database/workspace-modern.css:128, src/editor/panels/databaseListVirtualizer.ts:74-76·108-118·127-130. 가상화 계약은 "gaps only inside rowsHost (not between the spacers)"(databaseListVirtualizer.ts:74-75)인데, 실제 CSS는 간격을 스크롤러 컨테이너에 둔다: `.db-list { display: grid; gap: 2px }`(from-editor-event-editor-legacy-part-1.css:88-91), `.db-ws-list { ... gap: 1px }`(workspace-modern.css:128). rowsHost는 `display: contents`(virtual-list.css:7-9)라 박스가 없어 getComputedStyle(rowsHost).rowGap이 "normal"→0으로 읽힌다(databaseListVirtualizer.ts:114 `gap = Number.parseFloat(hostStyle.rowGap) || 0`).  …

**[DB-19-10] (medium) 위키(L205-208) 'modern-controls의 중복 스테퍼 크롬은 제거됐다'는 주장이 절반만 참 — W4 프리미티브 크롬이 studio-v2.part-3/4와 이중 소유로 남아 있다**
`src/styles/database/modern-controls.css` · 최종 medium · 확인 · 확신 high
위키 L205-208 재검증: "The earlier duplicate stepper chrome in modern-controls.css is removed; that sheet retains native checkbox/radio/range/select behavior" — 그러나 modern-controls.css는 여전히 W4 프리미티브 크롬(.db-slider-stepper/.db-slider-input/.db-stepper-input/.db-slider-unit :342-364, .db-segmented-pill :368-408, .db-toggle-input :412-459, .db-avatar-chip* :463-513)을 들고 있고, 그중 슬라이더-스테퍼 쌍은 studio-v2.part-4.css:34-56이 같은 클래스를 --db-studio-*로 재소유한다. 값도 어긋난 채 공존한다: min-width 90px(modern-controls:346) vs min-width 0(studio-v2.part-4:48), flex-basis 72px(:354) vs width 64px(:50), border-radius 4px(:352) vs var(--db2-radius-control)=8px(part-3 :67). 승자는 import 순서(index.css:65 vs :92-95)+특이도로만 갈린다 — studio-v2.css:4-8이 '접었다고 선언한' 세대 갈래가 그대로 남은 셈이다. modern-controls의 W4 블록을 삭제하고 네이티브 기준선만 남겨 위키 문장을 다시 참으로 만들어라.

**[DB-19-12] (medium) :root 별칭이 값으로 얼어 붙어 모달 안에 보조 회색 두 세대(#626E89 vs #5C6B7F)가 공존한다**
`src/styles/database/tabs-b-shell-layout.css` · 최종 medium · 확인 · 확신 high
근거: 커스텀 프로퍼티는 선언 요소에서 계산되어 상속되므로 tabs-b-shell-layout.css:5-28의 :root 별칭(--text-muted: var(--text-3) 등)은 :root 시점의 다크… 아니 라이트 전역값(#626E89, tokens.css:49)으로 얼어 붙는다. studio-theme.css:59-77은 --text-3 등 정식 이름만 모달에서 재브리지할 뿐 이 별칭들을 재브리지하지 않고(light-theme.css:80-101도 --text-primary/--accent-* 등 일부만 커버, --text/--text-muted/--text-dim/--bg-panel/--bg-elev/--bg-recessed 누락), 그 결과 같은 모달에서 보조 회색이 두 값으로 공존한다: --db-studio-text-3 #5C6B7F(studio-theme.css:23) vs 얼어 붙은 var(--text-muted) #626E89. 소비자: desktop-record-shell/11-life-authoring.css:357-360(.db-life-card p), :381-384(.db-life-toolbar span), :413-417(.db-life-record-card .field > span — 9px 라벨), :511-515, :556-560; record-thumbs.css:483·491·526(--text-dim 계열은 우연히 일치). 모달 안 배리에이션을 하나로 만들려면 별칭 재브리지를 modal 스코프에서 완성하거나 이 소비자들을 --db-studio-*로 이관해라.

**[DB-19-2] (medium) 좁은 칸(≤120px)에서 CSS가 스테퍼 버튼을 숨겨 마우스로 값을 조절할 방법이 사라진다 — 스테퍼 계약의 존재 이유를 스스로 위반**
`src/styles/database/studio-v2.part-3.css` · 최종 medium · 확인 · 확신 high
위치: src/styles/database/studio-v2.part-3.css:225-229 `@container (max-width: 120px) { ... .db-number-stepper-button { display: none; } }`, 스피너 억제 :177(`appearance: textfield`)·:199-203(`::-webkit-inner/outer-spin-button { appearance: none }`). openwiki/editor-database.md L1358-1361의 계약은 "appearance: none 으로 브라우저 스피너를 먼저 없애면 마우스로 값을 조절할 방법이 사라진다. databaseControls.ts 가 스테퍼 버튼을 붙인 뒤에 스피너를 지운다"다. 그런데 이 규칙은 좁은 칸(120px 이하)에서 스테퍼 버튼을 CSS로 통째로 display:none 하므로, 합성 스테퍼 입력은 스피너도 스테퍼도 없는 '타이핑 전용' 필드로 돌아간다 — 계약이 존재한 이유(마우스 조절 보장)를 정확히 무너뜨린다. 주석("modern-controls 의 계약을 그대로 잇는다", :222)은 지향과 반대된다. 값 살리기가 목적이라면 버튼을 숨기지 말고 28px 버튼을 유지한 채 입력 최소폭만 줄이거나, 숨길 때는 네이티브 스피너를 되살려야 한다.

**[DB-19-4] (medium) 위험·성공·경고 상태색이 같은 모달에 두 값으로 쪼개져 있다(#C6403D vs #B91C1C 등) + muted 토큰 누락**
`src/styles/database/light-theme.css` · 최종 medium · 확인 · 확신 high
위치: src/styles/database/light-theme.css:29-34(--db-light-danger #C6403D / success #18764F / warning #8A5E00 정의) vs src/styles/database/studio-theme.css:39-50(--db-studio-danger #B91C1C / success #0F7A4A / warning #B45309). 위키 L226은 "The shared danger token is #B91C1C"가 정본이라 명시하지만, 같은 모달 안에서 장비 비교 상태는 구값을 쓴다: light-theme.css:622-624 `.db-equipment-comparison-status.is-ineligible { color: var(--db-light-danger) }`(#C6403D), :654-659 gain/loss도 --db-light-success/danger. 반면 삭제·confirming 버튼은 studio-v2.css:455-464 --db-studio-danger(#B91C1C). 경고색도 둘로 갈라진다: light-theme.css:55 `--warning: var(--db-light-warning)`(#8A5E00)을 tabs-a.part-3.css:75-77 dirty-prompt strong이 --status-warning으로 소비하는 반면, 푸터 pending 필은 studio-theme.css:313-315 --db-studio-warning(#B45309).  …

**[DB-19-5] (medium) 위키 W1 계약(L840)이 소스와 어긋난다: light-theme.css는 크림 팔레트 소유자가 아니라 껍데기이고 '마지막 import'도 아니다**
`src/styles/database/light-theme.css` · 최종 medium · 확인 · 확신 high
위키 L840 검증 결과 3개 문장이 모두 현재 소스와 다르다. (1) "light-theme.css defines the cream palette (rgba(248,245,236) family)" — 실제로는 light-theme.css:16-102의 W1 리맵 블록이 철거돼 "/* 배경 계층 */"·"/* 테두리 */"·"/* 텍스트 */"·"/* 액센트 */" 등 섹션 주석(:42-50)만 남고 선언이 0개다(파일 헤더 :7-13의 크림 대비율 표기도 삭제된 값의 허수). 현재 팔레트 정본은 studio-theme.css:12-56의 슬레이트 계열(#F7F8F8/#FFFFFF)이다. (2) "imported last in src/styles/index.css (after dock.css)" — src/styles/index.css는 database/editor-startup-ai.css만 import하고(:28), database/index.css:62의 light-theme 뒤로 sidebar·record-list-modern·modern-controls·studio-theme(:73)·studio-v2(:92-95) 등 60여 시트가 더 온다. (3) "new DB surfaces must consume these scoped tokens" — 신규 표면은 --db-studio-*를 쓰라는 studio-v2.css:15의 규칙이 실제 기준이다. light-theme.css에 남은 실체는 상태색 4개(:29-34)와 브리지(:53-56·80-101)뿐이므로, 파일 헤더를 실태에 맞게 고치고 위키 정본을 studio-theme 소유로 갱신해라. 안 그러면 다음 작업자가 크림 토큰을 여기 추가해 두 팔레트가 다시 갈라진다.

**[DB-19-6] (medium) 위키의 글꼴 바닥 주장(L1386)이 소스와 다르다: max(11.5px, 1em)가 아니라 하드 11.5px 클램프라 위로도 눌러 깎는다**
`src/styles/database/studio-theme.css` · 최종 medium · 확인 · 확신 high
openwiki/editor-database.md L1386은 "작은 글자 바닥은 같은 파일의 font-size: max(11.5px, 1em) 이 런타임에서 처리한다"고 기록하지만, 실제 구현은 studio-theme.css:186 `font-size: 11.5px;` — 상한 클램프다. max()라면 작은 글자만 올려 큰 글자를 보존하겠지만, 지금은 이 선택자 목록에 걸리는 요소 중 의도 크기가 11.5px 초과인 것까지 눌러 내린다. 구체 희생자: light-theme.css:549-554 `.db-effect-story-fact strong { font-size: 12px }` — 바닥 선택자의 `strong:not([class])`(studio-theme.css:183)은 특이도 (0,5,1)(.database-modal-backdrop+.database-modal-window+:has(.db-shared-workspace)+.database-modal-body+:is(strong:not([class])))로 light-theme의 (0,3,1)을 이겨 12px를 11.5px로 깎는다. 위키의 재검증 문장을 소스에 맞게 고치고, 바깥쪽 의도 크기를 보존하려면 max(11.5px, 1em) 형태로 바꿔 상향 전용 바닥으로 만들어라.

**[DB-19-7] (medium) 타일 번호 배지가 어두운 배경 위 어두운 글자(#0F172A on rgba(20,20,18,.82))라 사실상 안 보인다 — 다크 시절 값이 라이트 토큰 전환과 충돌**
`src/styles/database/core.part-3.css` · 최종 medium · 확인 · 확신 high
위치: src/styles/database/core.part-3.css:2-12 `.tileset-ai-question-tile-number { background: rgba(20, 20, 18, 0.82); color: var(--text-1); font-size: 9px }` 및 :23-27 동일 클래스 재정의. 이 규칙은 --text-1이 밝은 크림이던 다크 시절에 쓰기 좋았지만, 현재 tokens.css:47 `--text-1: #0F172A`(거의 검정 잉크)라 거의 검정 배경 위 검정 숫자가 된다. 타일셋 AI 질문 대화상자에서 참조 타일 번호가 사실상 보이지 않는다. 배경을 토큰화된 밝은 면(--db-studio-surface/inset + border)으로 바꾸거나, 어두운 배지를 유지하려면 --db-light-on-accent/--db-studio-on-accent(#FFFFFF) 계열 글자로 바꿔라. 9px 폰트는 DB-19-3과 함께 상향 필요.

**[DB-19-8] (medium) 2026-09-17에 '삭제됐다'는 크림-브라운 스크롤바가 core.part-1.css에 하드컬러로 생존해 있다 (위키 보정 재검증)**
`src/styles/database/core.part-1.css` · 최종 medium · 확인 · 확신 high
재검증 결과: src/styles/database/core.part-1.css:17 `.tileset-db-preview { scrollbar-color: #6d675d #d8d0be; }` — 크림-브라운 스크롤바가 하드코딩으로 남아 있다. light-theme.css:58-62 주석은 "--scrollbar-thumb/-hover 재정의 삭제(2026-09-17): 이 둘만 크림(rgba(42,37,33,*))으로 남아 ... DB 모달 안 스크롤바만 크림-브라운, 바깥은 슬레이트로 갈렸다"며 이 갈라짐을 정확히 고쳤다고 기록하는데, 같은 결함이 타일셋 프리뷰 스크롤러에 그대로 살아 있다(토큰 미사용 하드컬러 + 다크/라이트 일관성 위반). 지우고 tokens.css:170-171의 --scrollbar-thumb/--scrollbar-thumb-hover 슬레이트를 상속시켜라.

**[DB-19-9] (medium) 탭 검색 입력 아이콘이 하드코딩 #94A3B8 — AA 미달로 강등된 바로 그 색이며 studio-v2 자체의 '새 hex 금지' 규칙도 위반**
`src/styles/database/studio-v2.css` · 최종 medium · 확인 · 확신 high
위치: src/styles/database/studio-v2.css:243 `background-image: url("data:image/svg+xml;...stroke='%2394A3B8'...")`(.db-tab-search, @container db-modal ≥800px). 이 파일 자체 규칙 2는 "색은 --db-studio-* 토큰만 소비한다. 새 hex 금지(예산 래칫)"(studio-v2.css:15)인데 데이터 URI라 currentColor를 못 쓴다는 이유로 hex를 박았다. 더 큰 문제는 #94A3B8이 정확히 가독성 때문에 강등된 색이라는 점이다: studio-theme.css:18-23 "예전 값 #94A3B8 은 ... 흰 배경에서 2.56:1" 때문에 텍스트용에서 잘라내고 :28 --db-studio-muted-paint으로 별도 보관한 값이다. 흰 검색 입력 면 위 2.56:1 아이콘은 비텍스트 대비 3:1(WCAG 1.4.11) 미만. 마스크(mask-image: var 아이콘 + mask-color: currentColor)나 인라인 SVG를 TS 아이콘 파이프라인(databaseTabIcons 소유 계약)으로 옮겨 token 색을 따라가게 해라.

**[DB-19-3] (low) 11px 미만 텍스트가 계약(tinyFont=0, "장식 글리프도 예외 없음")과 달리 곳곳에 남아 있다 — 7px·9px·10px 목록**
`src/styles/database/core.part-1.css` · 최종 low · 보류 · 확신 high
openwiki/editor-database.md L1389-1400은 "11px 미만은 0건", "장식 글리프도 예외로 두지 않는다"(셰브론 10→11px)를 실측 계약으로 못박았으나, 소스에는 그 아래 글자가 여럿 남아 있다(대부분 프로브 이후 추가 또는 :has(.db-shared-workspace) 바닥 밖). (1) src/styles/database/actors.css:119-123 `.actor-classic-sheet .actor-sheet-crop::before { content: "이미지 불러오기 실패"; font-size: 9px }` — 기능적 오류 문구가 9px 의사요소 텍스트(tinyPseudo 급 위반). (2) src/styles/database/desktop-record-shell/11-life-authoring.css:413-417 `.db-life-record-card .field > span { font-size: 9px; font-weight: 700 }` — 필드 라벨이 9px. (3) src/styles/database/core.part-2.css:42-59 `.tileset-ai-temp-number { font: 600 9px/1 }`, core.part-3.css:2-12·23-27 타일 번호 9px. (4) src/styles/database/core.part-1.css:157-167 `.tileset-db-cell.mark-star { font-size: clamp(9px, calc(var(--tileset-cell)*0.28), 13px) }` — 32px 칸에서 9px 별표(통행 붓은 2026-09-01 추가라 2026-08-30 프로브 미측정).  …
> 보류 사유: 나열된 인스턴스는 대부분 실측됐다(actors.css:119-130 9px 의사요소 오류문구, 11-life-authoring:412-417 9px, core.part-3:2-12·23-27 9px, mark-star clamp 9px core.part-1:157-167, db-term-revert 10.5px workspace-modern:758-768, rm-tile-cell 9px·10px 캡션, map-parent-sel 10px, passage-cell 10px, 7px ai-result-map-number tabs-a.p …

저심각도 일괄:
- [DB-19-11] (low) 지연 로딩되는 database 레이어 시트가 :root 전역 토큰 21개를 소유한다 — 자기 파일 주석이 밝힌 'DB 선택자 없는 전역 오버라이드' 원칙 위반의 잔재 — `src/styles/database/tabs-b-shell-layout.css`
- [DB-19-13] (low) record-thumbs의 썸네일 행 grid-template-columns(32px 열)는 flex 행 규칙에 눌려 죽은 코드다 — `src/styles/database/record-thumbs.css`
- [DB-19-14] (low) workspace-modern 전체의 var(--x, var(--x)) 자기참조 폴백은 항상 무동작인 죽은 방어 코드다 — `src/styles/database/workspace-modern.css`
- [DB-19-15] (low) DB 스타일에 남은 비토큰 하드컬러 일괄 목록 — `src/styles/database/studio-theme.css`
- [DB-19-16] (low) 애니메이션 스테이지 십자선이 '다른 파일이 어두운 바탕을 칠해 준다'는 암묵 계약에 의존하며 그 바탕색 토큰은 battle-studio 스코프에만 존재한다 — `src/styles/database/record-thumbs.css`

### 6.20 DB-20 — 한국어·유니코드·이름 정합·정렬

**[DB-20-1] (medium) DB 레코드 검색이 NFC/NFD 정규화 없이 toLowerCase만 수행 — 코드베이스의 NFKC 매칭 계약과 어긋남**
`src/editor/panels/databaseControls.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseControls.ts:442-445 — `export function matchesNameOrId(name, id, query) { const normalized = query.toLowerCase(); return name.toLowerCase().includes(normalized) || id.toLowerCase().includes(normalized); }`. trim도, NFC/NFD 정규화도 없다. 한편 같은 코드베이스의 텍스트 매칭 경로는 전부 NFKC 정규화를 쓴다: src/editor/conceptBundleResolve.ts:418-420 (`foldQuery = query.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "")`), src/editor/tools/monsterResourceTools.ts:36-41 (AI 몬스터 검색 툴, 양변 NFKC+trim+lowercase), src/ai/intentDeclaration.ts:133, src/battle/typeChart.ts:44. 즉 AI 툴은 NFKC 규약으로 레코드를 읽는데 사람이 쓰는 DB 목록 검색은 미정규화라, NFD(분해형 자모)가 섞인 이름(수입 JSON·일부 IME/붙여넣기 원문)은 완성형 검색어와 조용히 불일치한다. 영향: 분해형 이름 레코드가 검색·카테고리 필터에서만 '없는 것'처럼 보이고, 편집은 가능해 데이터와 UI가 어긋난다. …

**[DB-20-2] (medium) 한글 초성 검색 부재 — DB 레코드 검색은 완성형 부분문자열만 지원**
`src/editor/panels/databaseControls.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseControls.ts:442-445(위 DB-20-1과 같은 술어). 완성형 부분문자열 일치만 하고 ㄱ~ㅎ 초성만으로 좁히는 검색이 없다. src 전역 grep 결과 초성 검색 코드는 존재하지 않고(유일한 한글 조합 로직은 src/player/nameEntry/hangulTable.ts:5-13, 플레이어 이름 입력용), 레코드 수백 개에 이르는 아이템·스킬·몬스터 목록에서 'ㅁ' 입력으로 무기류만 좁히는 한국어 편집기 표준 UX가 빠져 있다. 영향: 컬렉션 규모가 커질수록 이름 전체를 입력해야 하는 불편이 누적되고, AI 도구(monsterResourceTools의 query 검색)와 사람의 검색 능력이 역전된다. 수정 제안: matchesNameOrId 확장으로 초성 인덱스(가~깋 등 음절의 초성 추출) 비교를 지원하고, 검색창 placeholder/aria-label에 지원 범위를 명시한다.

**[DB-20-3] (medium) 이름 검색 술어가 5곳에서 따로 복제돼 있어 문구 통일 주석과 달리 구현이 계속 갈라짐**
`src/editor/panels/databaseControls.ts` · 최종 medium · 확인 · 확신 high
같은 '이름/ID 부분문자열' 술어가 최소 5곳에서 재구현돼 있다: (1) src/editor/panels/databaseControls.ts:442-445 matchesNameOrId(공용), (2) src/editor/panels/databaseVillageView.ts:2059-2061 `function matches(name, id, query)` 로컬 복제, (3) src/editor/panels/databaseFactionView.ts:82-85 `!name.toLowerCase().includes(query) && !id.toLowerCase().includes(query)` 인라인, (4) src/editor/panels/databaseAppearanceView.ts:67-68 `${record.name} ${record.description} ${record.id}`.toLocaleLowerCase() 인라인(placeholder는 '이름·설명 검색'인데 실제로는 ID도 검색됨 — 술어와 문구 불일치), (5) src/editor/panels/eventEditor/recordPickerPanel.ts:342-354 이름+서수 인라인. databaseRecordViews.ts:441-443 주석은 "같은 동작(matchesNameOrId)에 ... 세 문구가 섞여 있었다"며 문구만 통일했지만 구현 중복은 그대로다. 영향: toLowerCase vs toLocaleLowerCase 등 표현이 이미 갈려 있고, DB-20-1의 정규화 수정을 넣어도 5곳을 모두 고치지 않으면 같은 검색이 탭마다 다르게 동작한다. 수정 제안: appearance(설명 포함)·recordPicker(서수 포함)의 확장을 옵션으로 흡수한 단일 검색 함수로 통합하고 나머지를 삭제한다.

**[DB-20-4] (medium) 이름 필드에는 빈값·공백·중복 가드가 전혀 없고 ID 필드만 가드가 있어 정합 계약이 역전돼 있음**
`src/editor/databaseActions.ts` · 최종 medium · 확인 · 확신 high
이름은 저작 데이터에서 가장 자주 쓰는 필드인데 어떤 경로로도 가드가 없다. (1) src/editor/panels/databaseControls.ts:9-12 textField가 `onInput(input.value)` 원문 커밋, (2) src/editor/panels/databaseRecordViews.ts:875-880 nameField → `updateDatabaseRecord(collection, id, { name: next })`, (3) src/editor/databaseActions.ts:303/333/243 `record.name = patch.name` 원문 대입, (4) 정규화 계약조차 이름은 무소독 — src/project/databaseRecordModel.ts:71/477/510/541/580이 모두 `name: record.name` 통과(주석 61-63행은 "updateDatabaseRecord / upsert_state 모두 이 함수를 거쳐 단일 정규화 계약을 보장한다"고 선언하지만 ID만 cleanIds/cleanOptionalId로 trim된다), src/project/actorModel.ts:151 `name: actor.name`. 반면 같은 폼의 ID 필드는 이중 가드가 있다: src/editor/panels/databaseVillageView.ts:515-516 ("ID 는 비워둘 수 없습니다." + `records.some(entry => entry.id === next)` 중복 검사), databaseFarmSpatialView.ts:1381("ID는 비어 있지 않고 같은 목록에서 고유해야 합니다. …

**[DB-20-5] (medium) 공백만 있는 이름이 '(이름 없음)' 폴백을 우회해 목록 행·신분 패널·썸네일 alt가 빈칸이 됨**
`src/editor/panels/databaseRecordViews.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseRecordViews.ts:614 `el("span", { class: "db-list-name", text: record.name || "(이름 없음)" })`, :655 갤러리 카드 동일, :109 `selectedSummary.textContent = next || "(이름 없음)"`, :209 `nameNode.textContent = name || "(이름 없음)"`, src/editor/panels/databaseRecordIdentity.ts:19 `text: name || "(미등록)"`. 폴백이 falsy 검사라 `" "`은 truthy라 그대로 렌더된다 — 목록에서 해당 행은 보이지 않는 공백이 되어 어떤 레코드인지 식별 불가. 썸네일 접근명도 같다: src/editor/panels/databaseRecordThumbnails.ts:46/50 `${item.name} 썸네일` → alt/aria-label이 " 썸네일", :66 `${record.name} 얼굴`. 행 dataset.recordName(:610/647)과 title(`" (id)"`)도 오염돼 databasePanelSummary.ts:32가 공백 recordName을 그대로 보고한다. 영향: 편집 중 실수로 이름을 공백으로 바꾸면 목록·툴팁·접근명·요약 전부가 무의미한 공백이 된다(DB-20-4로 생성 가능). 수정 제안: `record.name.trim() || "(이름 없음)"` 형태의 공용 displayName() 헬퍼로 6곳을 교체한다.

**[DB-20-6] (medium) AI 엔티티 멘션이 1글자 한국어 이름을 무기록 처리 — '검/칼/약'류 이름이 AI 컨텍스트에서 사라짐**
`src/editor/panels/aiEntityMentions.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/aiEntityMentions.ts:118-119 — `const trimmedName = record.name.trim(); if (trimmedName.length < 2) continue;`. SEARCH_COLLECTIONS(enemies→items→equipment→actors→skills→troops, :35-43)의 모든 레코드 중 1글자 이름은 AI 컨텍스트 멘션 후보에서 영구 제외된다. 한국어 RPG 데이터는 '검', '칼', '약', '돌' 같은 1음절 이름이 흔한데, 이런 레코드는 조수 대화에서 이름으로 언급해도 썸네일 칩·레코드 연결이 아예 붙지 않는다. 추가로 :147-148의 경계 휴리스틱("ASCII 전용 이름은 단어 경계를 요구하고, 한글이 섞인 이름은 부분 문자열로 맞춘다") 때문에 2글자 한국어 일반명사 이름(예: '성장')은 사용자 문장 속 어디서든 오탐 매칭된다. 영향: 한국어 이름 길이 분포에 맞지 않는 휴리스틱이라 AI 사용성이 이름 길이에 따라 랜덤하게 깨진다. 수정 제안: 1글자 배제는 ASCII에만 적용하고(한글 1글자는 허용, 필요하면 충돌 시 후보 나열), 한글도 이름 컬렉션 간 매칭 우선순위로 오탐을 줄인다.

**[DB-20-7] (medium) AI 멘션이 동명 레코드를 우선순위 1개로 무음 병합 — 한쪽 컬렉션 레코드가 이름으로 참조 불가**
`src/editor/panels/aiEntityMentions.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/aiEntityMentions.ts:110/122-127 — `const seenNames = new Set<string>(); ... if (seenIds.has(idKey) || seenNames.has(trimmedName)) { continue; }`. 주석(:101)대로 "중복 레코드(동일 id 또는 동일 name)는 우선순위에 따라 먼저 등장한 것만 보존"하는데, 편집기는 동명 레코드 생성을 막지 않는다(DB-20-4). 배우 '빨간약'과 아이템 '빨간약'이 있으면 SEARCH_COLLECTIONS 순서상 배우만 멘션 가능해지고, 아이템 쪽은 어떤 문구를 써도(이름이 같으므로) AI 컨텍스트에서 참조 불가가 되며 사용자에게 경고도 없다. 영향: 이름이 겹치는 순간 특정 컬렉션의 레코드가 AI 기능(멘션 칩·레코드 연결)에서 조용히 소실 — 저작↔런타임 계약 어긋남의 AI 버전. 수정 제안: 동명 충돌 시 이름 뒤 컬렉션 라벨(예: '빨간약 (아이템)')로 후보를 유지하거나, 이름 필드 저장 시점에 동명 경고로 예방한다(DB-20-4 수정과 연계).

**[DB-20-8] (medium) DB 검색 입력이 80ms 디바운스 뒤 전체 재빌드 + setSelectionRange — 한국어 IME 조합 중 끊김 위험**
`src/editor/panels/databaseRecordViews.ts` · 최종 medium · 확인 · 확신 medium
위치: src/editor/panels/databaseRecordViews.ts:448-457 — input 리스너가 `setSearchQueryForCollection(collection, input.value)` 후 `searchRerenderTimer = window.setTimeout(... 80)`으로 rerender 예약, :461-468 restoreSearchFocus가 `document.querySelector(".db-body .db-search input")`으로 새 입력을 찾아 `next.focus(); next.setSelectionRange(cursor, cursor);`. rerender는 database.ts renderActiveTab → renderRecordTab 전체 재빌드라 검색 input 엘리먼트 자체가 교체된다. 한국어 IME는 자모 조합 상태(미종료 composition)를 input 엘리먼트에 두는데, 타이핑 중 80ms 이상 멈추거나 커서 복원용 setSelectionRange가 호출되면 조합이 강제 종료/유실된다[추정: 브라우저 IME 동작 — 정적 독해 제약으로 실행 검증은 못함. 코드 경로 자체는 사실]. 또 복원 셀렉터가 문서 전역 querySelector라 .db-body 안에 .db-search가 둘 이상 생기는 경로(도크/모달 병행 등)에서 첫 번째 입력으로 포커스가 꽂힌다. 수정 제안: rerender 시 input 노드를 교체하지 않고 목록 영역만 갱신하거나, 조합 중(compositionstart~end)에는 디바운스를 유예하고 커밋 후에 재렌더한다. 복원 셀렉터도 이전 노드 참조 기반으로 바꾼다.

**[DB-20-9] (medium) 아이템 타입·사용시점 라벨이 3벌로 이중화 — AI 생성 결과 카드는 '씨앗'을 보여주고 폼은 '능력치 성장'을 보여줌**
`src/editor/panels/databaseAiGenerateDialog.ts` · 최종 medium · 확인 · 확신 high
위치: src/editor/panels/databaseAiGenerateDialog.ts:106-112 — 자체 ITEM_TYPE_LABEL 맵 `normalGoods: "일반", seed: "씨앗", ...`(weapon/shield/body/head/accessory/switch 키 누락)이, 아이템 폼의 정본 라벨 databaseItemRecordView.ts:67-79 `normalGoods: "일반 물품", seed: "능력치 성장", switch: "장치 작동"` 및 카테고리 칩 databaseRecordViews.ts:77-89(ITEM_TYPE_CHIP_LABELS, 동일 값)와 어긋난다. databaseAiGenerateDialog.ts:141 `ITEM_TYPE_LABEL[item.type] ?? item.type ?? "—"`라서: (1) AI 생성 결과 카드의 '종류' fact가 같은 모달 안의 폼·칩과 다른 말(씨앗 vs 능력치 성장, 일반 vs 일반 물품)로 뜨고, (2) 맵에 없는 타입(switch 등)이면 원문 토큰 "switch"가 사용자 화면에 그대로 노출된다. 또 OCCASION_LABEL(:114-119 "언제나/필드에서")이 databaseControls.ts:497-508 literalLabel("항상/필드")와도 별개 어휘다. 수정 제안: ITEM_TYPE_LABELS(databaseItemRecordView)를 export해 AI 다이얼로그·칩이 같은 상수를 쓰게 하고 fallback도 원문 토큰 대신 라벨 정본을 쓴다.

저심각도 일괄:
- [DB-20-10] (low) 연결 이동 안내 토스트가 이름 대신 내부 ID(uuid 토큰)를 노출 — 이름이 바로 있음에도 — `src/editor/panels/databaseEnemyRecordView.ts`
- [DB-20-11] (low) 빈 이름 표시 문구 4종 혼용 — (미등록)/(이름 없음)/이름 없는 주민/이름 없는 외형·세계 — `src/editor/panels/databaseRecordIdentity.ts`
- [DB-20-12] (low) 같은 DB 모달 안에서 존댓말(합니다체)과 반말(해요체) 혼용 — databaseAiBar는 파일 안에서도 섞임 — `src/editor/panels/databaseAiBar.ts`
- [DB-20-13] (low) 레코드 번호 표기 이중화 — 목록 '#1' vs 신분 패널 '0001:' — `src/editor/panels/databaseRecordViews.ts`
- [DB-20-14] (low) 엔티티 호칭 분열 — '몬스터/전투 몬스터', '주인공/플레이어 캐릭터'가 탭·리스트·토스트 사이에서 갈림 — `src/editor/panels/databaseOverviewView.ts`
- [DB-20-15] (low) 퀵 배틀 버튼이 한글+영문+이모지 병기로 용어 이중화 — '퀵 전투 테스트 (Quick Battle Test)' — `src/editor/panels/databaseBasicRecordFields.ts`
- [DB-20-16] (low) AI 생성 다이얼로그가 제공자 설정 토큰(providerId)을 원문으로 문장에 노출 — `src/editor/panels/databaseAiGenerateDialog.ts`
- [DB-20-17] (low) [재검증 통과] 위키 'Graphic 칩 교정 29건' 주장은 실제 코드에 반영돼 있어 결함 없음 — `src/project/defaults/chipsetLabelCorrections.ts`

## 7. 검증관 추가 발견 (15건 — 검증관이 소스 대조 중 스스로 확인한 항목)

**[DB-V2-A1] (high) rename_variable이 getFriendship.variableId·wait.variableId 케이스를 빠뜨려 '성공' 직후 getFriendship 참조가 댕글링되어 저장·로드가 막힌다**
`src/editor/tools/refactorTools.ts` · 배정 검증관 DB-V2
위치: src/editor/tools/refactorTools.ts:300-326(renameVariableEverywhere의 renameInCommand). 증거: renameInCommand의 케이스는 setVariable·setSwitch value var·changeGold/changeItem/changeExp amount·inputNumber/inputWait·fork뿐이어서 getFriendship과 wait의 variableId를 치환하지 않는다. 그러나 같은 파일의 수집기 addCommandRefs는 getFriendship(72-74행)과 wait/inputWait.variableId(76-79행)를 변수 참조로 세고, getFriendship.variableId는 로드 검증이 하드 assert한다(src/project/io/commandReferenceValidation.ts:211-213 'getFriendship: variableId가 존재하지 않습니다'). 영향: getFriendship 대상 변수를 rename_variable로 바꾸면 도구는 'N곳 치환' 성공을 반환하지만 명령은 옛 id를 가리켜 다음 저장(src/project/persistence/core/mapPatch.ts:93)·로드가 assert로 막힌다(wait.variableId는 검증이 없어 런타임 무음 오류로 남는다). DB-06-9가 지적한 그룹 조건·분기·시스템 축과 달리 walkCommands 도달 범위 안의 명령 케이스 누락이라 별개 결함이다. 제안: renameInCommand에 getFriendship·wait 케이스를 추가하고 치환 수를 수집기 카운트와 대조.

**[DB-V3-A2] (high) upsert_item의 equipmentProfile 부분 패치도 통째 교체돼 능력치·착용 권한이 초기화된다 (captureProfile만 중첩 병합 특례)**
`src/editor/tools/dbTools.ts` · 배정 검증관 DB-V3
위치/증거: dbTools.ts:694(mergeRecord `{...existing, ...patch}` 최상위 얕은 병합)·712-715(captureProfile만 중첩 병합 특례)·699(설명 "전달 필드만 병합"). 그러나 itemRecordSchema의 equipmentProfile(dbTools.ts:450)은 특례 없음 — 기존 장비형 아이템에 `upsert_item { equipmentProfile: { accuracy: 95 } }`를 넘기면 normalizeItemEquipmentProfile(databaseRecordModel.ts:794-812)이 누락 키를 기본값으로 채워 statBonuses 전부 0, equippableActorIds/ClassIds 빈 배열, effectFlags 전부 false로 조용히 초기화됨(배착 권한·능력치 동시 유실). DB-09-9가 지적한 upsert_item의 captureProfile 특례가 이 중첩 필드까지는 막지 못한 누수. 제안: captureProfile과 동일한 중첩 병합을 equipmentProfile에도 적용.

**[DBV-A1] (high) AI upsert_*의 얕은 병합이 중첩 객체(stats/rewards/equipmentProfile 등) 부분 갱신을 전체 대체로 바꿔 조용히 스탯을 리셋한다**
`src/editor/tools/dbTools.ts` · 배정 검증관 DB-V1
위치: src/editor/tools/dbTools.ts:676-693(mergeRecord = {...existing, ...patch} 얕은 병합), :843-860(upsert_enemy run). 도구 설명은 "전달 필드만 병합하고 나머지를 보존한다"지만 이는 최상위 필드 한정이다. AI가 부분 갱신으로 args.enemy.stats = {attack: 30}을 보내면 기존 stats가 통째로 대체되고 normalizeEnemyStats(databaseEnemyTroopRecordModel.ts:121-129)가 누락 키를 기본값(maxHp 10, defense 10, mind 10...)으로 채워 저장된다 — maxHp 40짜리 슬라임이 조용히 10으로 초기화된다. rewards/criticalHit/attackOptions, upsert_item의 equipmentProfile·hpRecovery도 동일. 도구 예시 자체가 부분 stats({maxHp:40, attack:12})를 제시해 모델이 부분 객체를 보내도록 유도한다. upsert_item은 captureProfile에만 심층 병합을 예외 적용해 위험을 인지했으면서 나머지 중첩 객체는 방치했다. 제안: mergeRecord에 중첩 객체 필드(stats/rewards/equipmentProfile 등) 심층 병합을 추가하거나 스키마에서 중첩 객체를 필수 전체 객체로 강제.

**[DB-V2-A2] (medium) items 삭제 가드가 character 프로필 giftPrefs 참조를 검사하지 않는데 로드 검증은 하드 이슈로 본다(가드-검증기 커버리지 어긋남)**
`src/editor/databaseReferences.ts` · 배정 검증관 DB-V2
위치: src/editor/databaseReferences.ts:116-167(databaseReferenceMessage items 케이스)과 그것이 부르는 src/editor/databaseCommandReferences.ts:19-53(commandsReferenceLocations). 증거: items 가드는 farmBuildingTypes·homeDecorationTypes·farmAnimalSpecies·craftRecipes·itemUpgrades·sellPrices·toolActions·shipping·bundles·makers·fishSpecies·seasonalForage·collections·museum·enemies drop과 이벤트 명령·이벤트 giftPrefs(commandsReferenceLocations:32)까지 보지만 project.characters 프로필의 giftPrefs는 어디서도 검사하지 않는다. 반면 로드 검증은 validateCharacterGiftPreferenceReferences를 collectProjectReferenceIssues에서 하드 이슈로 수집한다(src/project/io/references.ts:1198, 1318-1326). 영향: 캐릭터 프로필의 선물 취향에서만 참조되는 아이템 삭제가 무경고 통과하고 다음 저장·로드가 assert로 막는다 — 같은 파일 databaseCommandReferences.ts:200-203이 선언한 '경고 없이 삭제 → 다음 로드에서 프로젝트가 안 열림'(2026-09-19 P0-6) 클래스의 재발. 제안: items 가드(또는 commandsReferenceLocations)에 project.characters giftPrefs 축을 추가한다.

**[DB-V3-A1] (medium) 승급 (없음) 저장 후 형제 행 편집이 인덱스 어긋난 다른 승급을 통째로 덮어쓴다**
`src/editor/panels/databaseClassRecordView.ts` · 배정 검증관 DB-V3
위치/증거: databaseClassRecordView.ts:593-607(apply)·644-650(savePromotion). savePromotion이 toClassId 공백 시 next.splice(index,1)로 데이터 행을 지워도 refresh()가 없어 DOM 행 인덱스가 스토어 어긋남. 이후 사용자가 시프트된 형제 행(예: 화면 row1)을 편집하면 apply()가 promotions?.[index](=어긋난 store 행)를 읽어 toClassId/requires를 그 행 것으로 재구성한 뒤 같은 index에 저장 — 원래 보이던 승급(예: B→X)이 사라지고 뒤 행(예: C→Y)이 편집된 레벨로 복제됨. 영향: 승급 간선 무단 치환 데이터 유실. 제안: savePromotion/remove 후 refresh()로 행-인덱스 정합을 회복하거나 toClassId 기반 식별로 전환.

**[DB-V5-A1] (medium) 회복(+) 상태는 텍스트·레코드 어느 경로로도 런타임에 도달하지 않는다 — hpHealPercentPerTurn이 유일한 소비 경로인데 파싱 계층이 없음**
`src/battle/battleStates.ts` · 배정 검증관 DB-V5
위치·증거: src/battle/battleStates.ts:67-68 — stateBehavior는 피해는 hpDamagePercentFrom(resolved.hpTurn)으로 텍스트/레코드를 파싱하면서 회복은 `runtime?.hpHealPercentPerTurn ?? 0`으로 구조 필드 전용이다. 온톨로지 회복 표기 "매 턴 최대 HP의 +8%"(src/project/ontology/databaseStateOntology.ts:244, state_regen)와 폼의 양수 hpReleaseTurn 입력(src/editor/panels/databaseStateRecordView.ts:80-82, min -100 max 100)은 hpDamagePercentFrom(battleStates.ts:45-51)이 양수를 0으로 버리므로 어느 경로로도 회복이 발생하지 않는다. 시드 state_regen만 runtimeEffects.hpHealPercentPerTurn:8(defaultDatabaseStarterRecords.ts:150)으로 방어돼 있다. 영향: 회복 상태를 저작하면 Gen1 knob을 모르는 저작자(AI 포함)에게 무음 no-op. 제안: resolved.hpTurn의 "+N%"/양수를 hpHealPercentPerTurn 파싱 경로로 연결하거나 폼에서 양수 입력을 회복 knob으로 유도.

**[DBV-A2] (medium) upsert_class.skillIds는 기존 레코드에서 항상 무시된다 — learnedSkills 우선 정규화가 legacy 키를 영구 폐기**
`src/project/databaseRecordModel.ts` · 배정 검증관 DB-V1
위치: src/project/databaseRecordModel.ts:666-667(normalizeLearnedSkills = `skills ?? legacy.map(...)`) + :474-482(normalizeClassRecord가 learnedSkills를 항상 출력), src/editor/databaseRecordMutators.ts:27(updateClassRecord가 skillIds 패치를 기록), src/editor/tools/dbTools.ts:616(classRecordSchema.skillIds), :1168-1176(upsert_class run이 mergeRecord→normalizeClassRecord). 스토어의 모든 ClassRecord는 정규화를 거쳐 learnedSkills가 항상 정의돼 있으므로 `skills ?? legacy`에서 legacy skillIds는 영원히 폴백되지 않는다. AI가 upsert_class로 {skillIds:[...]}를 보내면 요약은 "수정"으로 나오지만 스킬 목록은 무변화이고, updateDatabaseRecord("classes", {skillIds}) 경로도 동일하게 무시된다(스킬 습득은 learnedSkills 필드로만 가능). EnemyRecord의 동일 패턴은 DB-02-2로 보고됐는데 classes 쪽이 빠져 있었다. 제안: upsert_class 스키마에서 skillIds를 제거하거나, skillIds 패치를 learnedSkills로 변환해 병합.

**[EE-V1-A1] (medium) replaceProject의 spread 순서가 projectSwitch 플래그를 호출자가 무효화할 수 있어, AI reset_project 전면 교체 후에도 이벤트 편집기가 열린 채 남는다**
`src/project/store.ts` · 배정 검증관 EE-V1
위치·증거: src/project/store.ts:778-782 — replaceProject는 change를 `{ label: "프로젝트 교체", projectSwitch: true, ...(change ?? {}) }`로 조립하므로 호출자가 넘긴 projectSwitch: false가 스프레드에서 뒤집는다. src/editor/tools/applyChangesetToStore.ts:396-398이 reset_project 적용 시 `{ ...change, projectSwitch: false }`를 명시해 전송한다. 그러나 replaceProject는 계약상 «Full project switch»로 clearEventDraftVault()와 preserveEventDrafts: false(store.ts:742, 751-753)를 무조건 수행하고, modal.ts:371-375의 편집기 store 구독은 `change.projectSwitch || identity 변경`일 때만 닫히므로 이 emit(projectSwitch: false)은 편집기를 닫지 않는다. 영향: AI reset_project로 세계가 통째로 교체돼도 같은 mapId/eventId가 새 프로젝트에 존재하면 이벤트 편집기가 닫히지 않고 이전 프로젝트용 히스토리 키(mapId:eventId:pageId)·클로저로 새 프로젝트를 계속 편집한다. 제안: replaceProject가 projectSwitch를 호출자가 꺼지 못하게 강제하거나, reset 경로는 변경 어노테이션 대신 전용 플래그로 의도를 표현해 modal 구독이 이를 존중하게 한다.

**[EE-V5-A1] (medium) 맵·이벤트 찾기의 매칭 자체가 event.name을 무시한다 — 저작 이름으로 이벤트가 아예 검색되지 않는다**
`src/editor/panels/mapEventSearchModel.ts` · 배정 검증관 EE-V5
위치·증거: matchingEventResults(mapEventSearchModel.ts:100-119)는 matches(query, page.name)(:101)와 matches(query, event.id)(:111)만 조회하고 GameEvent.name을 전혀 보지 않는다. 정본 이벤트 이름은 event.name(project/eventDisplayName.ts:5 «편집기 헤더 상자와 place_npc 가 여기에 쓴다»)이므로, name 필드에 저작 이름을 둔 이벤트는 페이지가 자동 이름(페이지 N)뿐이면 검색 결과에 한 건도 나오지 않는다. 영향: 편집기 찾기에서 저작 이름으로 이벤트를 못 찾는다 — EE-20-2(표시 이름 복제)와 EE-20-3(AI find_events)은 각각 표시·AI 툴을 다루며 이 모달의 매칭 자체는 어느 쪽 수정으로도 해소되지 않는다. 제안: matchingEventResults의 조회 대상에 event.name(또는 eventDisplayName(event))을 추가.

**[DBV-A3] (low) 상태 제한 드롭다운 5종 중 '아군에게 공격 불가'·'물리 공격 불가'는 런타임 소비처가 아예 없다**
`src/editor/panels/databaseStateRecordView.ts` · 배정 검증관 DB-V1
위치: src/editor/panels/databaseStateRecordView.ts:20(RESTRICTION_OPTIONS 5종) ↔ src/battle/battleStates.ts:65-66,79-87. 런타임이 restriction 문자열을 읽는 곳은 restrictsActionFrom(행동 봉쇄)과 blocksSkillUseFrom(스킬 봉쇄) 두 정규식뿐이다. "아군에게 공격 불가"와 "물리 공격 불가"에 대응하는 플래그·소비처는 src/battle 전체에 존재하지 않아(grep 실측 0건) 언어 문제(DB-04-1)를 고쳐도 이 두 선택지는 여전히 어떤 효과도 낼 수 없다. 선택지를 노출하는 폼은 "행동 불가" 드롭다운이 기능한다는 인상을 준다. 제안: 미구현 2종을 선택지에서 제거하거나, 물리 공격 봉쇄 플래그를 runtimeEffects/전투 판정에 추가하고 드롭다운과 연결.

**[EE-V-A1] (low) 라이브 changeGold/changeItem operand 숫자칸이 parseInt로 파싱해 카탈로그가 고쳤다고 명시한 parseInt 결함을 승계 폼에서 되살린다**
`src/editor/panels/eventEditor/schemaCommandBody.ts` · 배정 검증관 EE-V2
위치: schemaCommandBody.ts:292-295. 라이브 경로인 changeGold/changeItem operand 숫자칸이 `clamp(Number.parseInt(input.value, 10) || 0, spec.min)` 으로 파싱해 "1e3"→1, "0.5"→0 으로 잘라 저장한다. 이 스키마 전환이 대체한 구 changeGoldBody 의 parseInt 소실 결함을 catalog.ts:198 주석이 명시하므로(«f.operand 이므로 변수 참조가 보존된다. 기존 changeGoldBody 는 parseInt 로 이를 소실시켰다»), 승계 폼이 같은 파서를 숫자축에 되살리는 것은 마이그레이션 취지와 배치된다(EE-05-8·EE-06-10과 같은 parseInt 가족의 별개 표면). 제안: Math.trunc(Number(v)||0) 로 통일하고 비정수 입력에 경고 표시.

**[EE-V-A2] (low) 타일셋 부재의 '해결' 경로에서 맵 없는 빈 캔버스 위에 궤적만 그려 .catch 폴백 표면과 갈라진다**
`src/editor/panels/eventEditor/previewMoveRoute.ts` · 배정 검증관 EE-V2
위치: previewMoveRoute.ts:69-73, transferMapPreview.ts:41. drawTransferMapPreview 가 tileset 부재로 아무것도 그리지 않고 **해결**하면(EE-05-5의 조기 return 경로) .then 체인의 drawRouteOnMap 이 초기화되지 않은 빈 캔버스 위에 궤적 폴리라인·종점 화살촉을 그려 «맵 없는 오버레이»를 남긴다. 반면 진짜 이미지 로드 실패(.catch)는 오버레이를 통째로 생략한다 — 같은 데이터 결함의 두 양상이 서로 다른 표면을 낸다. 제안: drawTransferMapPreview 해결값에 drawn 플래그를 두거나 .then 에서 실제 드로우 여부를 확인한 뒤 궤적을 그릴 것.

**[EE-V3-A1] (low) M2 「순간이동 금지」(m2-073) access 플래그가 저장·복원되지만 읽는 소비자가 없다**
`src/player/interpreter/m2Runtime.ts` · 배정 검증관 EE-V3
위치/증거: m2Runtime.ts:347-349 accessKey가 "Teleportation On/Off"를 runtime.access.teleportation에 기록하고, saveSlots.ts:237-238·1153-1156이 이 값을 세이브 스냅샷에 저장·복원한다. 그러나 src 전역 grep에서 access.teleportation을 읽는 소비자가 0명이다(escape는 playSceneBattle.ts:82, menu는 playerStatusMenuController.ts:269, save는 autosave.ts:35가 실제 집행 — 이 셋과 달리 teleportation만 미연결). 분류표 m2RuntimeClassificationData.ts:102은 m2-073을 full로 표시한다. 영향: "순간이동 금지" 저작이 게임 동작을 바꾸지 않는다. 제안: 맵 이동·순간이동 경로에서 access.teleportation === false를 검사하거나 m2-073 분류를 내린다.

**[EE-V3-A2] (low) M2 「UI 명령」(m2-214)의 hud·menuPrompt surface는 스펙에 노출되지만 렌더 경로가 없다**
`src/project/eventCommands/m2ModernCatalog.ts` · 배정 검증관 EE-V3
위치/증거: 스펙 m2ModernCatalog.ts:94-99가 UI_SURFACE_OPTIONS로 toast/hud/banner/menuPrompt 4종을 노출하는데, 실제 소비자 zoneFeedback.ts:89-106의 switch는 banner/objectiveChip/checkpoint/toast만 처리하고 hud·menuPrompt는 default로 조용히 버려진다(반대로 objectiveChip·checkpoint는 처리되지만 스펙 옵션엔 없다 — 어휘 불일치). 같은 파일 16행 주석은 "고를 수 있는 옵션은 전부 렌더 경로가 있다"를 테스트 계약으로 선언하는데 이 옵션들은 그 계약에서 빠져 있다. 영향: 표시 위치를 HUD·메뉴 프롬프트로 골라도 화면에 아무것도 안 나온다(toast·banner는 실제 렌더됨 — playSceneZoneFeedback.ts:111-120 경로). 제안: hud·menuPrompt 렌더 경로를 연결하거나 옵션에서 내린다(blur 선례 준수).

**[EE-V5-A2] (low) 전송 행 썸네일이 24×16 표시 크기인데도 맵 전체 해상도 캔버스 백킹 스토어를 행당 새로 할당한다**
`src/editor/panels/eventEditor/commandList.ts` · 배정 검증관 EE-V5
위치·증거: renderMapThumb16(commandList.ts:348-373)은 렌더마다 document.createElement("canvas")로 새 캔버스를 만들고(:352), drawTransferMapPreview의 setupCanvas(transferMapPreview.ts:74-75)가 canvas.width/height를 map.width×tileSize / map.height×tileSize 전체 해상도로 세운다. style 축소(:83-84)는 표시만 할 뿐이라 64×64@32px 맵이면 행마다 약 2048×2048(≈16MB RGBA) 백킹 스토어가 할당되고, EE-17-1 체인으로 재렌더마다 폐기·재할당이 반복된다. 영향: 전송 행이 많은 이벤트에서 GPU/CPU 메모리 채넘이 커지고 대형 맵에서 캔버스 상한 리스크가 있다. 제안: 썸네일 표시 크기(예: 48×32) 백킹으로 캔버스를 만들고 스케일해 그린다(EE-17-5의 모듈 캐시와 별개로 인스턴스 자체의 할당 축소).

## 8. 기각된 항목 (6건 — 적대적 반박이 걸러낸 것)

3건은 스코프 간 중복 병합(대표 항목으로 흡수), 3건은 반박 근거로 실제 기각. 기각도 성과다 — 1차 발견의 과장을 소스가 걸어냈다.

**[DB-16-10] 위키 'Graphic 칩 교정' 절의 4fps 주장이 소스(3fps)와 어긋난다**
`openwiki/editor-database.md` · 1차 심각도 low
기각: 위키의 "4fps 스트립"은 125→155→185→215 세로 소용돌이 스트립을 가리키는데, 그 스트립은 코드에서 waterfallStrip으로 fps: WATERFALL_ANIMATION_FPS=4를 갖는다(chipsetAnimation.ts:16, :36-40, :76-83) — 위키 주장이 소스와 일치한다. finding이 인용한 CHIPSET_ANIMATION_FPS=3은 가로 물결 스트립 전용 상수라 finding 자신의 근거가 결론과 어긋난다.

**[EE-04-2] Input Number 폼이 렌더 시점에 변수를 골라 커밋한다 — 위키 U02 계약("렌더 중 변수 선택 금지 + Confirm 가드") 미반영**
`src/editor/panels/eventEditor/commandBodyInputNumber.ts` · 1차 심각도 high
기각: duplicate of EE-02-2 — 같은 현상(inputNumber 렌더 중 변수 시딩 + event-command-validate 훅 부재, 위키:50 위반)을 같은 파일·같은 근거로 서술한 중복 finding이다. 증거는 모두 사실이나 EE-02-2 쪽이 편집기·검증기·DB 경로까지 더 포괄적이라 대표로 남기고 여기는 배제한다.

**[EE-07-9] switchVariablePicker(databasePicker 경로)가 삭제/유령 스위치·변수 id를 「(선택)」으로 표시하고 패널에도 현재값을 안 넘긴다**
`src/editor/panels/eventEditor/switchVariablePicker.ts` · 1차 심각도 medium
기각: duplicate of EE-06-3 — 같은 현상(switchVariablePicker.ts:58-61 keepMissingId 미전달 + databasePicker 126-138)을 같은 근거로 보고하며, EE-06-3 이 호출처·런타임 파급(m2ModernRuntime.ts:290 등)까지 더 구체적으로 다루므로 대표 판정을 EE-06-3 에 준다.

**[EE-09-4] 필드 몬스터 템플릿(원클릭)이 적용 직후 자체 스위치 미존재 에러로 커밋을 영구 차단하는 교착 상태를 만든다**
`src/editor/panels/eventEditor/fieldMonsterTemplateDialog.ts` · 1차 심각도 high
기각: 핵심 전제가 거짓이다: validateEventDraftBody는 eventDraftValidator.ts:133에서 projectWithEventDraftAuthoredWrites(project, mapId, event.id)를 호출해 pending switch authoredWrites를 working 사본에 적용한 뒤 refs를 만든다(eventDraftAuthored.ts:18-38,53-58). 따라서 템플릿이 참조하는 sw_<eventId>_clear가 refs.switches에 존재해 reference.switch.missing 2건이 발생하지 않고 canCommit=true로 커밋 시 스위치가 생성된다. …

**[EE-10-13] M2 접근 토글(m2-073/075/077/079): access 플래그 중 save(오토세이브)만 집행되고 순간이동·도주·메뉴는 미집행**
`src/player/interpreter/m2Runtime.ts` · 1차 심각도 medium
기각: "save만 집행"은 거짓이다: escape은 전투 도주 판정에서 실제 집행되고(playSceneBattle.ts:82 canEscape && access?.escape !== false), menu는 메뉴 열기를 차단한다(playerStatusMenuController.ts:269, playerStatusMenuModel.ts:222). 실제 미집행은 teleportation 하나뿐이며 그 잔여 커널은 added_findings EE-V3-A1로 분리했다.

**[EE-10-9] M2 「UI 명령」(m2-214): 토스트/배너를 그리는 렌더러가 없는데 기본 제공 프로젝트(iceGrandExpanse)까지 이 명령을 쓴다**
`src/player/interpreter/m2ModernRuntime.ts` · 1차 심각도 high
기각: 핵심 주장이 거짓이다: playSceneZoneFeedback.ts:79-82·111-113·123-133이 session.m2Runtime.ui를 읽고 zoneFeedback.ts:89-103이 banner·toast surface를 실제로 렌더한다. finding이 인용한 29행 주석은 "농사 안내가 m2Runtime.ui에 쓰면 안 된다(중복 제거·직렬화 때문)"는 쓰기 금지 경고지 읽기 부정이 아니다. 잔여 커널(hud·menuPrompt surface 미렌더)은 added_findings EE-V3-A2로 분리했다.

## 9. 에이전트 로스터 (50개 — 전원 zcode/glm-5.3-flash 실측)

| # | ID | 렌즈 | | # | ID | 렌즈 |
|---|---|---|---|---|---|---|
| 1 | EE-01 | 이벤트 에디터 창 셸/모달 | | 26 | DB-06 | 참조 무결성·검증 유틸 |
| 2 | EE-02 | 명령 목록·컨텍스트 메뉴·드래그·스테이지드 편집 | | 27 | DB-07 | 액터·캐릭터 외형 스튜디오 |
| 3 | EE-03 | 커맨드 피커와 명령 카탈로그 커버리지 | | 28 | DB-08 | 몬스터·진영·트룹·전투이벤트 |
| 4 | EE-04 | 명령 폼 — 대사·선택지·텍스트·그래픽 | | 29 | DB-09 | 스킬·직업·성장곡선·상태이상 |
| 5 | EE-05 | 명령 폼 — 이동·경로·장소전환 | | 30 | DB-10 | 아이템·장비·인벤토리 카탈로그 |
| 6 | EE-06 | 명령 폼 — 상점·경제·가중분기·창고·경험치 | | 31 | DB-11 | 세계관·생성 규칙·마을 하네스 |
| 7 | EE-07 | 명령 폼 — M2·변수·루프·Page3·고급·DB조작·필드스폰 | | 32 | DB-12 | 공간·장소·구조물 저작 |
| 8 | EE-08 | 이벤트 페이지 조건 편집 | | 33 | DB-13 | 시네마틱·오프닝·배틀 스튜디오·애니메이션 |
| 9 | EE-09 | 페이지 속성·NPC 행동·일정·호러 | | 34 | DB-14 | 생활·농장·수집·제작·날씨 |
| 10 | EE-10 | 편집기 폼 ↔ 런타임 인터프리터 명령 계약 | | 35 | DB-15 | AI × DB — 생성·검토 오버레이·변경 카드 |
| 11 | EE-11 | 이벤트 데이터 모델·직렬화·마이그레이션 | | 36 | DB-16 | 리소스 피커·그래픽 선택·미디어 경로 |
| 12 | EE-12 | 이벤트 검증·신뢰 루프·미리보기 시뮬레이션 | | 37 | DB-17 | DB 저장·원격 지속성·더티 세션 |
| 13 | EE-13 | 미리보기 표면 — 그림·오디오·무비·스토리보드 | | 38 | DB-18 | DB ↔ 런타임 계약(죽은 필드 사냥) |
| 14 | EE-14 | 이벤트 AI 모달·어시스트 툴 | | 39 | DB-19 | DB CSS·시각 일관성·토큰 |
| 15 | EE-15 | AI 패널 × 이벤트 흐름 (승인·적용·되돌리기) | | 40 | DB-20 | 한국어·유니코드·이름 정합·정렬 |
| 16 | EE-16 | 이벤트 에디터 CSS·시각 일관성 | | 41 | EE-V1 | 적대적 검증관: EE-01, EE-02, EE-03, EE-04 |
| 17 | EE-17 | 이벤트 대량 저작 성능·렌더 | | 42 | EE-V2 | 적대적 검증관: EE-05, EE-06, EE-07, EE-08 |
| 18 | EE-18 | 접근성·키보드·포커스 | | 43 | EE-V3 | 적대적 검증관: EE-09, EE-10, EE-11, EE-12 |
| 19 | EE-19 | 한국어 카피·용어 정본 준수 | | 44 | EE-V4 | 적대적 검증관: EE-13, EE-14, EE-15, EE-16 |
| 20 | EE-20 | 맵 위 이벤트 상호작용·배치·검색 | | 45 | EE-V5 | 적대적 검증관: EE-17, EE-18, EE-19, EE-20 |
| 21 | DB-01 | DB 창 셸·모달·30탭 네비게이션 | | 46 | DB-V1 | 적대적 검증관: DB-01, DB-02, DB-03, DB-04 |
| 22 | DB-02 | 시스템·개요·유틸리티 뷰 | | 47 | DB-V2 | 적대적 검증관: DB-05, DB-06, DB-07, DB-08 |
| 23 | DB-03 | 레코드 액션·모델·가상 리스트 | | 48 | DB-V3 | 적대적 검증관: DB-09, DB-10, DB-11, DB-12 |
| 24 | DB-04 | DB 타입 모델 3자 대조(타입↔폼↔런타임) | | 49 | DB-V4 | 적대적 검증관: DB-13, DB-14, DB-15, DB-16 |
| 25 | DB-05 | 필드 셰이프·마이그레이션·백업 | | 50 | DB-V5 | 적대적 검증관: DB-17, DB-18, DB-19, DB-20 |
