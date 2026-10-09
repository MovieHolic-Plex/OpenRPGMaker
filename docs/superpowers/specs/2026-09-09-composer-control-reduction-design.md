# 컴포저 컨트롤 축소 — 자율성 다이얼 하나로

2026-09-09

## 문제

지시줄에 컨트롤이 세 개인데 서로 겹친다.

| 컨트롤 | 실제로 정하는 것 | 중복 |
|---|---|---|
| 모드 3칩 (지시/질문/계획) | ask 레일, planOnly | `질문` → 의도 분석이 이미 승격(`assistantSession.ts:2639`) · `계획` → 다이얼 `confirm` 과 동일 처리(`:2886`) |
| 자율성 4단계 | agentMode, budgetCap, planOnly, **reasoningEffort** | — |
| 추론 강도 셀렉트 | reasoningEffort | 자율성이 이미 매핑(`autonomyLevels.ts:33-37`), 다이얼 변경 시 함께 저장(`aiChatPanel.ts:2456-2457`) |

`autonomyLevels.ts` 의 레벨 프리셋이 추론 강도와 계획-전용을 이미 결정하므로, 나머지 두 컨트롤은 같은 노브를 두 번 노출한 것이다.

## 목표

컨트롤을 3개 → 1개(자율성 다이얼)로 줄인다. 사용자 동기는 UI 축소이며, 플래너 동작 변경은 이 작업의 범위가 아니다.

## 비목표

- **"모든 프롬프트에 반드시 플랜"은 하지 않는다.** 플래너의 `direct` 판정을 코드가 거부하던 경로는 2026-09-03 에 의도적으로 제거됐다(`assistantSession.ts:3072`: 「이 마을에 상인 하나 추가해줘」가 마을 통째 · 93초 · 맵 3장). 계획이 생기면 Ralph 재주입 + 볼륨 계약 + acceptance + 산출물 게이트가 전부 붙고 1항목 계획도 교착 경로(`workPlan.ts:206`, 실측 173회 재주입)를 탄다. UI 축소에 필요하지 않으므로 분리한다.
- `composerMode` → `turnPolicy` 개명. 79곳 + 30여 테스트 파일 대공사이며 이번 목표에 불필요하다.

## 접근 — `composerMode` 를 유도값으로 남긴다

`ComposerMode` 타입과 세션의 16곳 ask 게이트를 **그대로 두고 공급자만 UI → 패널 유도로 바꾼다.**

대안이었던 (B) 개명과 (C) 게이트가 `autonomy()` 를 직접 읽기는 모두 세션을 건드린다. (C)는 특히 `autonomyLevel` 미지정 레거시 경로가 실재해서(`orchestrationEnabled()` 가 "미지정 config 는 종래 판정 그대로"를 명시 보존, `:4676`) 기본값 분기가 16곳에 흩어진다. 회귀 표면이 가장 작은 (A)를 택한다.

`assistantSession.ts` 는 한 줄도 바꾸지 않는다. 이것이 접근이 맞다는 검증 기준이기도 하다 — 세션 레벨 ask 레일 테스트가 무변경으로 통과해야 한다.

## 1. 자율성 레벨 확장 (`src/ai/autonomyLevels.ts`)

`AUTONOMY_LEVEL_IDS` 에 `readonly` 를 맨 앞에 추가하고 `AutonomyResolution` 에 `readOnly: boolean` 을 넣는다.

| 레벨 | 라벨 | agentMode | budgetCap | planOnly | readOnly |
|---|---|---|---|---|---|
| `readonly` (신규) | 읽기 전용 | chat | 4 | false | **true** |
| `confirm` | 확인 | chat | 6 | true | false |
| `balanced` | 균형 | auto | 16 | false | false |
| `autonomous` | 자율 | auto | 32 | false | false |
| `max` | 최대 | auto | 48 | false | false |

`readonly` 의 `planOnly` 는 false 다 — `ask` 레일은 플래너를 스킵하므로(`assistantSession.ts:2974` `"composer:ask"`) 계획이 애초에 생기지 않고, 실행할 수 없는 계획을 남기면 안 된다.

`budgetCap` 은 4다. `autonomyLevels.test.ts` 가 예산의 **단조 증가와 유일성**을 검증하므로 `confirm`(6)과 값을 겹칠 수 없다.

`isAutonomyLevel`(`llmClient.ts:95`)은 `AUTONOMY_LEVEL_IDS` 를 참조하므로 자동 확장된다. 기존 저장값 4개는 그대로 유효하고, 파싱 기본값 `"balanced"`(`llmClient.ts:268`)는 유지한다. 두 곳의 "4단계" 주석을 5단계로 고친다.

## 2. 컴포저 UI 축소 (`src/editor/panels/aiComposer.ts`)

제거: `modeChips` 옵션 · `modeSegment` · `setMode` · `COMPOSER_MODES`/`COMPOSER_MODE_LABEL` import · `reasoningSelect` · `onReasoningChange` · `initialReasoning`.

`syncEffort(autonomy, reasoning)` → `syncEffort(autonomy)`.

남는 컨트롤은 자율성 셀렉트 1개(5단계). 모드 표시는 `modelChipLabel()`(`aiChatPanel.ts:2406`)이 이미 레벨 라벨을 싣고 있어 그것이 유일한 표시기가 된다.

## 3. 세션 유도 배선 (`src/editor/panels/aiChatPanel.ts`)

```ts
const derivedComposerMode = (): ComposerMode =>
  resolveAutonomy(currentAutonomyLevel()).readOnly ? "ask" : "do";
```

| 위치 | 지금 | 바뀜 |
|---|---|---|
| `:502` | `let composerMode = "do"` | 제거 → 유도 함수 |
| `:1671` | `composerMode === "plan"` | `resolveAutonomy(level).planOnly` (아래 주의) |
| `:1679-1680` | `composerMode` | `derivedComposerMode()` |
| `:1317-1318` | 컨텍스트 꼬리 `ask`/`plan` 절 | `readOnly`/`planOnly` 기준 |
| `:755` | `composerShell.setMode(runtime.composerMode)` | setMode 호출만 제거. `runtime.composerMode` 는 세션에 계속 전달(체크포인트 직렬화 계약 유지) |
| `:1728` | `userResume` 시 `composerMode = "do"` 리셋 | **삭제** |

`aiTurnRunner.ts:728,753` 은 `runOpts.composerMode` 로 받으므로 무변경.

### `:1671` planPreview 의 실제 파급 (설계 중 정정)

설계 초안은 이 줄을 "세션이 `:2886` 에서 이미 OR 처리하므로 동작 동일"이라고 적었다. **세션 동작은
같지만 패널 동작은 다르다.** 예전에는 다이얼 `confirm` 이 `planPreview` 를 켜지 않아서, 세션이
`finishPlanOnlyTurn` 으로 턴을 끝낼 것을 알면서도 패널은 `autonomous: true` 로 자율 런 표면
(「자율 실행 예산 0/6」)을 띄우고 드라이버를 무장했다. 반대로 「계획」 칩은 껐다 — 세션이 동일하게
처리하는 두 경로의 패널 표면이 갈라져 있었다.

통합 결과: planOnly 레벨의 **계획 턴**에는 자율 런 표면이 뜨지 않는다. 실행되지 않을 런의
진행률을 보여주는 표면이 사라지는 것이므로 개선으로 본다. 활성 미완료 계획이 있는 「계속」 턴은
`planPreview` 가 false 이므로 종전대로다.

부수 확인: 다이얼은 레벨 프리셋의 `agentMode` 를 함께 저장하므로(`confirm` → `"chat"`)
`confirm` + `agentMode:"auto"` 는 UI 로 만들 수 없는 조합이다. 그 조합을 픽스처로 쓰던 두
테스트(`aiAutonomyRunSurface`)는 `autonomous`(cap 32) 로 옮겨 분모-클램프 계약을 그대로 지키고,
planOnly 의 새 계약은 별도 테스트로 명시했다.

### `:1728` 삭제 근거

지금은 모드가 턴 단위라 「계속」이 `do` 로 리셋해도 무해했다. 다이얼은 **지속 설정**이므로 「계속」이 사용자의 읽기 전용 설정을 몰래 해제하면 안 된다. `readonly` 에서 「계속」은 읽기를 계속하는 뜻이다.

### `ComposerMode` union 의 `"plan"`

**남긴다.** 세션 5곳(`:2886`, `:2976`, `:3050`, `:3063`, `:3076`)이 분기하고 있어 지우면 "세션 무변경" 전제가 깨진다. 공급자만 사라지므로 `composerMode.ts` 주석에 "패널은 더 이상 공급하지 않음 — 자율성 `confirm` 로 흡수" 를 명시하고 실제 제거는 별도 작업으로 둔다.

## 4. 안전성

`ask` 는 프롬프트 힌트가 아니라 하드 레일이다 — 세션 16곳에서 쓰기 툴 스키마 미노출 + 호출 거부 + 초안 불변 + acceptance/volume/드라이버 차단. 이 레일을 지우지 않고 트리거만 옮기는 것이 이 설계의 핵심이다.

- 의도 분석이 `mode=question` 을 내면 `:2639` 가 자동으로 ask 레일을 건다 (종전과 동일).
- 사용자가 `readonly` 를 고르면 의도 분석이 `mode=create` 를 내도 ask 레일이 이긴다. 읽기 전용으로 두고 "집 지어줘" 하면 아무것도 만들지 않고 조회 툴로만 답한다. **사용자 명시 설정이 분류기보다 우선한다** — 이 레벨의 존재 이유다.
- 오분류로 쓰기가 들어가도 `src/editor/mapEditHistory.ts` 의 undo 스택으로 되돌릴 수 있고, `balanced` 미만에서는 자동 적용 자체가 없다(`milestoneAutoApply = opts.autonomous === true`, `:2356`).

## 5. 테스트

**신규 (실패부터)**
- `resolveAutonomy("readonly")` 매핑 · `isAutonomyLevel("readonly")` · 기존 4레벨 `readOnly:false` 회귀
- 다이얼 `readonly` 선택 후 전송 → `sendUserMessage` 옵션에 `composerMode:"ask"`
- 다이얼 `confirm` → planPreview 로 `autonomous:false`
- 「계속」이 자율성 레벨을 바꾸지 않는다 (`:1728` 삭제를 못박는 회귀)

**무변경으로 통과해야 하는 것 (접근 A 의 검증 기준)** — 실측 결과: 통과
- `test/aiComposerModeSession.test.ts` 6/6 무변경 통과. `assistantSession.ts` 를 한 줄도 안 고쳤으므로 A 가 옳았다. 깨졌다면 C 를 골라야 한다는 신호였다.

**갱신한 테스트**
`aiChatPanelComposerMode`(재작성) · `aiComposerEffort`(추론 셀렉트 계약 제거) · `aiComposerDeck` · `aiComposerEffortPanel` · `aiAutonomyRunSurface` · `aiAutonomyDialSettings` · `aiDeckCss` · `aiSettingsEntryParity` · `aiContinueUserAction`(계약 반전) · `aiRetryWorkPlanLifecycle`(케이스 축을 레벨로) · `e2e/ai-composer-mode.spec.ts` · `e2e/ai-ui-audit-fixes.spec.ts` · `aiContinueReachability.mjs` · `aiContinueNegativeSurface.mjs`

**검증 결과**
- 영향 범위 16개 파일 106 테스트 통과. `composerMode`/`autonomyLevel`/`ai-composer` 를 언급하는 전체 테스트 스윕도 통과.
- `tsc -p tsconfig.app.json`: 내가 만진 파일에 새 오류 없음. `aiChatPanel.ts(287x)` 2건은 HEAD 에도 있는 기존 오류로, 스태시 A/B 로 확인했다.
- `.mjs` 브라우저 증거 스크립트 2개(`aiContinueReachability`, `aiContinueNegativeSurface`)와 e2e 2개는 **실행하지 않았다** — 라이브 dev 서버 + Playwright + `EVIDENCE_DIR` 이 필요하다. 선택자·계약만 기계적으로 맞췄다.
- `npm run gates` 의 "새로 실패" 집계는 baseline 이 오래돼 과보고하므로 쓰지 않고, 영향 파일을 직접 재실행했다.
