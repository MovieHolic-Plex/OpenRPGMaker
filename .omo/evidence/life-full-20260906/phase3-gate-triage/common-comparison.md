# Phase3 completed-pair common comparison

This report compares the saved `run-w9sTgj` pair only. It is not gate approval. No tests, builds, browsers, network calls, or product changes were performed for this analysis.

## Outcome

- Both sides completed 113 files / 1251 cases. Current: **1088 pass / 163 fail**. Exact base: **1089 pass / 162 fail**.
- All **162 shared failures** were compared against the complete saved human FAIL bodies, including every printed expected/received value, not just the truncated JSON headlines. **158 are root-only equal** (the same count as JSON); four differ only as explicitly documented below. After those narrow, source-justified mappings, no unexplained assertion-body difference remains.
- Of the **219 original failures**, **162 fail both** and **57 pass both**. All are mapped below and in JSON. The 57 are **unexplained non-reproductions, not proven fixes**. Historical Phase2 statuses among them: 53 passed, 4 failed. All 162 shared failures also have historical failed status; status alone does not establish cause.
- The only status delta is `storePersistence > skips remote flush when there are no unsaved changes` (original/base passed, current failed). It is mapped in JSON but intentionally left to the parent without diagnosis.
- Supplemental case-attributed console comparison found **four differences**: two current-only edit-activity messages, one warning-order change, and one build elapsed-time difference. These are not silently normalized away.

## Method and evidence contract

`common-comparison.json` is the detailed evidence index. Each CF/BP entry identifies file, full name, occurrence, original/current/base/history JSON pointers, stdout result lines, and (for failures) complete human-body byte offsets, line ranges and SHA-256 hashes. Long received project/source strings were compared in full in memory; no headline, length cap, or display truncation was used for equality. Original evidence was not rewritten. The body references retain all printed values without duplicating multi-megabyte strings into this report.

Normalize the longer `/home/main/z-project/rpg-zzu-life-full-p3-base-compare` root first, then `/home/main/z-project/rpg-zzu-life-full-p3`, to `<ROOT>`. Preserve all other values. Strip only reporter terminal case counters and trailing blank separators when selecting human bodies; preserve cause sections, unnumbered separators, source frames and whitespace within the body. Per-case raw and normalized hashes remain available.

Consecutive FAIL headers would share the following diagnostic body; they must not be mistaken for empty failures. The exact saved pair contains **no grouped bodies**: all 163 current and 162 base FAIL headers map to distinct nonempty bodies. All 1251 stdout result lines per side match JSON statuses. This is a content/mapping check, not a rerun.

## Four explicit human diagnostic differences

### S1 - CF001, CF002

Only current playSceneMapRuntime stack locations 658:27 -> 657:27 and 564:3 -> 563:3, plus displayed frame labels 656..660 -> 655..659, are mapped to base coordinates. Raw values retained.

Current inserts syncForageWarnings(scene) at line 504 (base next statement is runtimeDom.syncMissingResourceError at 504). The failing registry read and surrounding function body are byte-identical shifted one line; current 658/base 657. Import text also changes without adding an import line. No blanket line-number removal.

### S2 - CF066

Only offender coordinates src/player/playSceneMovement.ts:68 -> :67 and :157 -> :156 mapped to base coordinates, in both assertion message and actual received list. These are actual value-string differences, retained in the raw diff.

Current adds the interactWithLifeField import at line 44 before the two unchanged comments. The rest of the function additions are below those comments. Detector test lines 188..201 constructs each offender as relative path, index+1, label and line.trim().slice(0,120); six offenders, labels and clipped text agree after these two coordinate mappings.

### S3 - CF134

Only entries[0].at inside the one received edit-activity request body is mapped to <RUN_AT>: current 2026-09-06T17:10:07.941Z; base 2026-09-06T17:24:51.145Z. No other timestamps, counters, request values, IDs or expected values normalized.

Unchanged test/storePersistence.test.ts:11..35 uses fake timers without a fixed system time; unchanged src/editor/editActivityLog.ts:214,223,239 builds at from Date.now() via toISOString(). Both human diagnostics show one POST /__oprn/edit-activity with seq 0, scope project, label null, origin human, generation 1 and reason 사람이 편집. Same failed no-fetch expectation, not proof that a LegacyDb write occurred.

### Raw root-normalized diff: CF001

`test/actionDebounceFootprint.test.ts` - __oprnDebug 스냅샷이 두 사각을 실어 보낸다 3x3 + passRows 1 이면 몸 사각과 통행 사각이 다르게 실린다

```diff
--- base (root-normalized)
+++ current (root-normalized)
@@ -1,11 +1,11 @@
 TypeError: Cannot read properties of undefined (reading 'registry')
- ❯ syncCutsceneHudVisibility src/player/playSceneMapRuntime.ts:657:27
-    655|   readonly session: PlaySceneContext["session"];
-    656| }): void {
-    657|   const host = scene.game.registry.get("dialogueHost");
+ ❯ syncCutsceneHudVisibility src/player/playSceneMapRuntime.ts:658:27
+    656|   readonly session: PlaySceneContext["session"];
+    657| }): void {
+    658|   const host = scene.game.registry.get("dialogueHost");
        |                           ^
-    658|   if (!isCutsceneHudHost(host)) return;
-    659|   host.classList.toggle(CUTSCENE_HUD_HIDDEN_CLASS, isCutsceneHudHidden…
- ❯ syncRuntimeState src/player/playSceneMapRuntime.ts:563:3
+    659|   if (!isCutsceneHudHost(host)) return;
+    660|   host.classList.toggle(CUTSCENE_HUD_HIDDEN_CLASS, isCutsceneHudHidden…
+ ❯ syncRuntimeState src/player/playSceneMapRuntime.ts:564:3
  ❯ captureScene test/actionDebounceFootprint.test.ts:139:5
  ❯ test/actionDebounceFootprint.test.ts:145:19
```

### Raw root-normalized diff: CF002

`test/actionDebounceFootprint.test.ts` - __oprnDebug 스냅샷이 두 사각을 실어 보낸다 발자국 저작이 없으면 두 사각이 앵커 한 칸으로 같다 — 항등

```diff
--- base (root-normalized)
+++ current (root-normalized)
@@ -1,11 +1,11 @@
 TypeError: Cannot read properties of undefined (reading 'registry')
- ❯ syncCutsceneHudVisibility src/player/playSceneMapRuntime.ts:657:27
-    655|   readonly session: PlaySceneContext["session"];
-    656| }): void {
-    657|   const host = scene.game.registry.get("dialogueHost");
+ ❯ syncCutsceneHudVisibility src/player/playSceneMapRuntime.ts:658:27
+    656|   readonly session: PlaySceneContext["session"];
+    657| }): void {
+    658|   const host = scene.game.registry.get("dialogueHost");
        |                           ^
-    658|   if (!isCutsceneHudHost(host)) return;
-    659|   host.classList.toggle(CUTSCENE_HUD_HIDDEN_CLASS, isCutsceneHudHidden…
- ❯ syncRuntimeState src/player/playSceneMapRuntime.ts:563:3
+    659|   if (!isCutsceneHudHost(host)) return;
+    660|   host.classList.toggle(CUTSCENE_HUD_HIDDEN_CLASS, isCutsceneHudHidden…
+ ❯ syncRuntimeState src/player/playSceneMapRuntime.ts:564:3
  ❯ captureScene test/actionDebounceFootprint.test.ts:139:5
  ❯ test/actionDebounceFootprint.test.ts:158:19
```

### Raw root-normalized diff: CF066

`test/detsukuruBrandStrings.test.ts` - 탈-쯔구르: 출하 문자열 src 안에 RPG Maker 계보 표현이 남아 있지 않다

```diff
--- base (root-normalized)
+++ current (root-normalized)
@@ -1,8 +1,8 @@
 AssertionError: 금지 표현 6건:
 src/player/input.ts:228 [RPG Maker 제품명] * 보관하는 경로는 없다 — RPG Maker 처럼 걷는 중에 온 탭은 그 프레임에 소비되고 버려진다.
 src/player/input.ts:341 [RPG Maker 제품명] // 매 프레임 호출. 엣지 이벤트 갱신. RPG Maker 의 Input.update 처럼 「지금 눌림」을 읽고, 프레임 사이에
-src/player/playSceneMovement.ts:67 [RPG Maker 제품명] * 주인공 이동의 논리 프레임. RPG Maker 는 걸음을 시간이 아니라 프레임으로 가른다(MV: 2^speed/256
-src/player/playSceneMovement.ts:156 [RPG Maker 제품명] * RPG Maker 의 Game_Player.update 한 프레임: 안 걷고 있으면 입력(또는 강제 루트)으로 걸음을 시작하고,
+src/player/playSceneMovement.ts:68 [RPG Maker 제품명] * 주인공 이동의 논리 프레임. RPG Maker 는 걸음을 시간이 아니라 프레임으로 가른다(MV: 2^speed/256
+src/player/playSceneMovement.ts:157 [RPG Maker 제품명] * RPG Maker 의 Game_Player.update 한 프레임: 안 걷고 있으면 입력(또는 강제 루트)으로 걸음을 시작하고,
 src/player/playSceneTypes.ts:173 [RPG Maker 제품명] /** 이번 걸음에서 지나간 논리 프레임. 걸음은 round(moveDurationMs / 틱) 프레임에 정확히 끝난다(RPG Maker 식). */
 src/player/runtimeDebugPanel.ts:20 [구 저장 키 접두사 rpg-zzu] // 구 접두사 `rpg-zzu:` 로 직접 쓰면 부팅 시 migrateLegacyStorageKeys 가 새 접두사로: expected [ …(6) ] to deeply equal []
 
@@ -13,8 +13,8 @@
 + [
 +   "src/player/input.ts:228 [RPG Maker 제품명] * 보관하는 경로는 없다 — RPG Maker 처럼 걷는 중에 온 탭은 그 프레임에 소비되고 버려진다.",
 +   "src/player/input.ts:341 [RPG Maker 제품명] // 매 프레임 호출. 엣지 이벤트 갱신. RPG Maker 의 Input.update 처럼 「지금 눌림」을 읽고, 프레임 사이에",
-+   "src/player/playSceneMovement.ts:67 [RPG Maker 제품명] * 주인공 이동의 논리 프레임. RPG Maker 는 걸음을 시간이 아니라 프레임으로 가른다(MV: 2^speed/256",
-+   "src/player/playSceneMovement.ts:156 [RPG Maker 제품명] * RPG Maker 의 Game_Player.update 한 프레임: 안 걷고 있으면 입력(또는 강제 루트)으로 걸음을 시작하고,",
++   "src/player/playSceneMovement.ts:68 [RPG Maker 제품명] * 주인공 이동의 논리 프레임. RPG Maker 는 걸음을 시간이 아니라 프레임으로 가른다(MV: 2^speed/256",
++   "src/player/playSceneMovement.ts:157 [RPG Maker 제품명] * RPG Maker 의 Game_Player.update 한 프레임: 안 걷고 있으면 입력(또는 강제 루트)으로 걸음을 시작하고,",
 +   "src/player/playSceneTypes.ts:173 [RPG Maker 제품명] /** 이번 걸음에서 지나간 논리 프레임. 걸음은 round(moveDurationMs / 틱) 프레임에 정확히 끝난다(RPG Maker 식). */",
 +   "src/player/runtimeDebugPanel.ts:20 [구 저장 키 접두사 rpg-zzu] // 구 접두사 `rpg-zzu:` 로 직접 쓰면 부팅 시 migrateLegacyStorageKeys 가 새 접두사로",
 + ]
```

### Raw root-normalized diff: CF134

`test/storePersistence.test.ts` - Project store remote persistence does not write to LegacyDb before the canonical project has loaded

```diff
--- base (root-normalized)
+++ current (root-normalized)
@@ -7,7 +7,7 @@
     Array [
       "/__oprn/edit-activity",
       Object {
-        "body": "{"entries":[{"seq":0,"at":"2026-09-06T17:24:51.145Z","scope":"project","label":null,"origin":"human","generation":1,"reason":"사람이 편집"}]}",
+        "body": "{"entries":[{"seq":0,"at":"2026-09-06T17:10:07.941Z","scope":"project","label":null,"origin":"human","generation":1,"reason":"사람이 편집"}]}",
         "headers": Object {
           "Content-Type": "application/json",
         },
```

## Supplemental console differences

Case-labeled logs are compared in their recorded order, separately from FAIL values. These labels identify reporter attribution, not proven async ownership.

### CF008 - stdout

`test/agentBlueprintTurnEnd.test.ts` - 중단·오류로 끝난 턴의 청사진 정산 턴이 오류로 끝나도 남은 제안은 적용되므로 그 칸은 done 으로 확정된다

Unresolved current-only [edit-activity] (unlabeled project) log under this reporter-attributed case; assertion body remains identical. No normalization or causal inference.

```diff
--- base console
+++ current console
@@ -0,0 +1 @@
+[edit-activity] (라벨 없음: project)
```

### CF012 - stdout

`test/agentBlueprintTurnEnd.test.ts` - 중단·오류로 끝난 턴의 청사진 정산 쓰기 제안 0건으로 끝난 턴은 진행을 하나도 남기지 않는다

Unresolved current-only [edit-activity] (unlabeled project) log under this reporter-attributed case; assertion body remains identical. No normalization or causal inference.

```diff
--- base console
+++ current console
@@ -0,0 +1 @@
+[edit-activity] (라벨 없음: project)
```

### CF020 - stderr

`test/aiChatPanelUxRepairs.test.ts` - 진행 상태와 중단 AssistantSession은 AbortSignal을 LLM 호출에 전달하고 중단 결과로 종료한다

Same three complete log bodies in a different order: edit-activity mirror URL-parse warning precedes two LegacyDb fetch warnings in current, follows them in base. Order retained; relation to common timeout unresolved.

```diff
--- base console
+++ current console
@@ -1,3 +1,4 @@
+[edit-activity] 디스크 미러 실패 (/__oprn/edit-activity: Failed to parse URL from /__oprn/edit-activity) — output/edit-activity/ 가 갱신되지 않는다.
 [ai-conversation] LegacyDb mirror failed: TypeError: fetch failed
     at node:internal/deps/undici/undici:15845:13
     at processTicksAndRejections (node:internal/process/task_queues:103:5)
@@ -24,4 +25,3 @@
     hostname: 'dbserver'
   }
 }
-[edit-activity] 디스크 미러 실패 (/__oprn/edit-activity: Failed to parse URL from /__oprn/edit-activity) — output/edit-activity/ 가 갱신되지 않는다.
```

### CF116 - stdout

`test/playerRuntimeCss.test.ts` - exported player runtime CSS detects an omitted required import in a disposable built entry

Only reported build elapsed time differs: base 286ms, current 241ms; emitted file names and sizes agree. Retained, not normalized. This is existing test output, not a build performed for this report.

```diff
--- base console
+++ current console
@@ -5,4 +5,4 @@
 computing gzip size...
 output/assets/entry-D6gl8e6Q.css  282.83 kB │ gzip: 43.98 kB
 output/assets/entry-D6PB1oVm.js     0.00 kB │ gzip:  0.02 kB
-✓ built in 286ms
+✓ built in 241ms
```

## Restricted-environment and reporter limitations

- Three full FAIL bodies include `getaddrinfo EAI_AGAIN dbserver`: the storePersistence DB-unavailable case and both unsavedChangesGuard failures. Their full cause/serialized-error sections agree, but that does not prove inherited product behavior or a functioning remote integration.
- The live region AI case receives `false` on both sides. The associated complete `LIVE_RESULT` logs also agree: `ok/applied=false`, no tool calls/changes/events, and failure to parse `/v1/chat/completions`. This is not a successful network exercise, nor evidence that the sandbox alone caused the application URL/configuration failure.
- The AbortSignal case times out at 15000ms on both sides; matching timeout text is not a cause diagnosis.
- Both runs report **two identical unhandled errors**: invalid `Response` status 204 in `mapEditLockScratchSession.test.ts:74`, and worker `onTaskUpdate` timeout. Vitest warns these may create false-positive tests. Complete case counts do not remove that warning.
- Cleanup evidence records no cleanup errors, clean product statuses and a retained locked base worktree; private caches/tmp were already removed. This analysis did not alter them.
- Human matcher elisions, omitted properties, and code-frame ellipses remain unobservable. The brand detector clips each offending source line to 120 characters by design. Equality is of all available printed diagnostic bytes, not unseen runtime objects.
- Associated console chunks are bounded by blank lines/reporter markers; unlabeled/global prelude logs and passing-test logs are not claimed to be semantically identical across whole streams.
- The supplied original/history JSON has `STACK_TRACE_ERROR` first headlines for 56 of the 57 original-fail/both-pass cases; one autosave case instead records an actual call-count mismatch. Those original messages are preserved per case, not interpreted as a common cause. Original verbose output is outside the bounded input set.

## All shared failures (162)

Each row is original **failed -> current failed / base failed**, occurrence 1. `equal` means the complete human body is root-only equal, not cause-proven inherited. `S1/S2/S3` refers to the exact normalization above. Ranges are inclusive lines in the indicated side's `run-w9sTgj/{side}/stderr.txt`; the JSON gives byte bounds and hashes. `outside=yes` means outside the recorded baseline file list, not a causal classification.

| ID | File / full case name | Outside | Current full body | Base full body | Comparison |
|---|---|---|---|---|---|
| CF001 | `test/actionDebounceFootprint.test.ts`<br>__oprnDebug 스냅샷이 두 사각을 실어 보낸다 3x3 + passRows 1 이면 몸 사각과 통행 사각이 다르게 실린다 | no | 1196-1206 | 1219-1229 | S1 |
| CF002 | `test/actionDebounceFootprint.test.ts`<br>__oprnDebug 스냅샷이 두 사각을 실어 보낸다 발자국 저작이 없으면 두 사각이 앵커 한 칸으로 같다 — 항등 | no | 1211-1221 | 1234-1244 | S1 |
| CF003 | `test/actorBattleAuthoringSurface.test.ts`<br>actor and battle command previews are authoring surfaces previews a face change as a faceset crop, not a summary fallback | no | 1226-1242 | 1249-1265 | equal |
| CF004 | `test/actorCombatCommandBodies.test.ts`<br>actor combat command modern bodies modernizes damage processing presets | no | 1247-1254 | 1270-1277 | equal |
| CF005 | `test/actorCombatCommandBodies.test.ts`<br>actor combat command modern bodies modernizes actor graphic/faceset/class forms | no | 1259-1266 | 1282-1289 | equal |
| CF006 | `test/actorCombatCommandBodies.test.ts`<br>actor combat command modern bodies modernizes recover all / enter hero name / promote | no | 1271-1278 | 1294-1301 | equal |
| CF007 | `test/agentBlueprintTurnEnd.test.ts`<br>중단·오류로 끝난 턴의 청사진 정산 시공 중 중단하면 짓던 칸이 planned 로 되돌아간다 — 저장소가 안 바뀌었는데 완료를 찍지 않는다 | no | 1283-1294 | 1306-1317 | equal |
| CF008 | `test/agentBlueprintTurnEnd.test.ts`<br>중단·오류로 끝난 턴의 청사진 정산 턴이 오류로 끝나도 남은 제안은 적용되므로 그 칸은 done 으로 확정된다 | no | 1299-1309 | 1322-1332 | equal |
| CF009 | `test/agentBlueprintTurnEnd.test.ts`<br>중단·오류로 끝난 턴의 청사진 정산 정상 종료 + 적용에서만 저장소가 바뀝고 밑그림이 물러난다 | no | 1314-1324 | 1337-1347 | equal |
| CF010 | `test/agentBlueprintTurnEnd.test.ts`<br>중단·오류로 끝난 턴의 청사진 정산 일부만 지은 계획도 적용된 턴이 끝나면 물러나고, 다음 턴이 되살리지 않는다 | no | 1329-1339 | 1352-1362 | equal |
| CF011 | `test/agentBlueprintTurnEnd.test.ts`<br>중단·오류로 끝난 턴의 청사진 정산 전송이 던지지 않고 정상 반환한 중단도 정산된다 — 제안이 남아 있어도 적용에 닿지 않는다 | no | 1344-1355 | 1367-1378 | equal |
| CF012 | `test/agentBlueprintTurnEnd.test.ts`<br>중단·오류로 끝난 턴의 청사진 정산 쓰기 제안 0건으로 끝난 턴은 진행을 하나도 남기지 않는다 | no | 1360-1371 | 1383-1394 | equal |
| CF013 | `test/aiActivityLiveRow.test.ts`<br>AI 도구 라이브 활동 행 성공한 조회 도구는 완료 행을 남기지 않고 턴 종료 시 캔버스 칩 상태도 지운다 | yes | 1376-1383 | 1399-1406 | equal |
| CF014 | `test/aiActivityLiveRow.test.ts`<br>AI 도구 라이브 활동 행 다음 도구 시작은 이전 예약을 먼저 확정하고 턴 종료는 마지막 예약까지 비운다 | yes | 1388-1395 | 1411-1418 | equal |
| CF015 | `test/aiAssistantAfterUx.test.ts`<br>Assistant After UX contracts folds header undo/export actions under 작업 so the idle-view menu hugs | no | 1400-1416 | 1423-1439 | equal |
| CF016 | `test/aiAssistantAfterUx.test.ts`<br>Assistant After UX contracts shows at most one 적용됨 badge across message and composer row | no | 1421-1437 | 1444-1460 | equal |
| CF017 | `test/aiChatObservability.test.ts`<br>병합 추론 원문 전체 열람 (V3C ②) 도구 사이 추론이 한 블록으로 병합돼도 각 추론의 원문 전체가 아이템으로 남고 토글은 횟수를 표시한다 | yes | 1442-1456 | 1465-1479 | equal |
| CF018 | `test/aiChatObservability.test.ts`<br>실시간 고스트 프리뷰 연결 채팅 턴의 성공한 쓰기 tool_call 뒤 세션 draft diff 고스트를 발행한다 | yes | 1461-1486 | 1484-1509 | equal |
| CF019 | `test/aiChatPanelTransportError.test.ts`<br>transport failure paints recovery CTA and keeps Send mounted refused fetch: is-turn-running cleared, system error bubble + ai-error-open-settings, ai-send stays disabled with ai-abort visible | yes | 1491-1505 | 1514-1528 | equal |
| CF020 | `test/aiChatPanelUxRepairs.test.ts`<br>진행 상태와 중단 AssistantSession은 AbortSignal을 LLM 호출에 전달하고 중단 결과로 종료한다 | no | 1510-1518 | 1533-1541 | equal |
| CF021 | `test/aiPlacementCutsceneCheckpoint.test.ts`<br>script_cutscene 통행 가능 착지 물 위 기존 action 컷신에 playerTouch 페이지를 더하면 이벤트를 통행 가능 칸으로 옮긴다 | no | 1523-1537 | 1546-1560 | equal |
| CF022 | `test/aiPlacementCutsceneCheckpoint.test.ts`<br>체크포인트·컷신 기존 이벤트 재사용 이미 있는 체크포인트/컷신 이벤트는 재사용하고 복제하지 않는다 | no | 1542-1556 | 1565-1579 | equal |
| CF023 | `test/aiProposalCardUxd.test.ts`<br>AI 변경 즉시 적용 reset_project가 포함된 턴은 확인 없이 바로 적용한다 | no | 1561-1577 | 1584-1600 | equal |
| CF024 | `test/aiProposalCardUxd.test.ts`<br>AI 변경 즉시 적용 안전 분류 불통과와 완성도 경고도 적용을 막지 않는다 | no | 1582-1598 | 1605-1621 | equal |
| CF025 | `test/aiSelectionChipScope.test.ts`<br>대기 상태에서도 선택 칩은 보인다 idle 패널에서 has-selection-scope 칩 호스트의 사용 display 는 none 이 아니다 | yes | 1603-1614 | 1626-1637 | equal |
| CF026 | `test/aiSelectionChipScope.test.ts`<br>컴포저 힌트는 숨을 때 자리를 비운다 입력 포커스가 없을 때 힌트의 사용 display 는 none 이다(visibility:hidden 은 156px 를 먹었다) | yes | 1619-1629 | 1642-1652 | equal |
| CF027 | `test/appStorageMigration.test.ts`<br>저장 키 접두사 회귀 src 안에 구 저장 키 접두사가 남아 있지 않다 | no | 1633-1650 | 1656-1673 | equal |
| CF028 | `test/authorHouseFacade.test.ts`<br>author_house canonical facade builds one exterior-only house with exact target and change evidence | no | 1655-1679 | 1678-1702 | equal |
| CF029 | `test/authorHouseFacade.test.ts`<br>author_house canonical facade keeps a domain clearance warning in the shared construction outcome | no | 1684-1708 | 1707-1731 | equal |
| CF030 | `test/authorHouseFacade.test.ts`<br>author_house canonical facade blocks 'invalid wing' atomically with a selected route | no | 1713-1727 | 1736-1750 | equal |
| CF031 | `test/authorHouseFacade.test.ts`<br>author_house canonical facade rolls back a zero-placement yard shortfall | no | 1732-1743 | 1755-1766 | equal |
| CF032 | `test/autosaveStatus.test.ts`<br>autosave status keeps autosave state out of the map-focused editor statusbar | no | 1748-1757 | 1771-1780 | equal |
| CF033 | `test/autotileGroupPersistence.test.ts`<br>오토타일 그룹 직렬화 왕복 구버전(오토타일 필드 없음) 프로젝트가 그대로 로드된다 | no | 1762-1776 | 1785-1799 | equal |
| CF034 | `test/autotileGroupPersistence.test.ts`<br>오토타일 그룹 직렬화 왕복 오토타일 그룹이 있는 프로젝트가 왕복 후 보존된다 | no | 1781-1795 | 1804-1818 | equal |
| CF035 | `test/autotileGroupPersistence.test.ts`<br>오토타일 그룹 뮤테이션 그룹 추가/기본값 시드/삭제가 동작한다 | no | 1800-1814 | 1823-1837 | equal |
| CF036 | `test/battleElementAdversarialFixes.test.ts`<br>B2: element kind magical routes defense through mind (gen1 전용) predictSkillDamage uses mind defense for magical element, defense for physical | no | 1819-1833 | 1842-1856 | equal |
| CF037 | `test/changeExpCommandBody.test.ts`<br>changeExp modern form + variable operand 폼에 대상/연산/경험치 소스/변수 피커를 노출한다 | no | 1838-1852 | 1861-1875 | equal |
| CF038 | `test/changeExpCommandBody.test.ts`<br>changeExp modern form + variable operand 경험치 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다 | no | 1857-1864 | 1880-1887 | equal |
| CF039 | `test/changeExpCommandBody.test.ts`<br>changeExp modern form + variable operand 대상 주인공 모드에서 actorId 를 저장한다 | no | 1869-1876 | 1892-1899 | equal |
| CF040 | `test/changePartyCommandBody.test.ts`<br>changeParty command body UX explains membership-only scope and offers follow-up commands | no | 1881-1888 | 1904-1911 | equal |
| CF041 | `test/clusterRulePlacement.test.ts`<br>hard cluster rule placement paint_tiles가 침엽수 하단(290) 단독 칠하기를 상단(260) 동반 배치로 보정한다 | no | 1893-1907 | 1916-1930 | equal |
| CF042 | `test/clusterRulePlacement.test.ts`<br>hard cluster rule placement 동반 타일 위치에 같은 타일이 이미 있으면 재배치를 허용한다(멱등) | no | 1912-1926 | 1935-1949 | equal |
| CF043 | `test/clusterRulePlacement.test.ts`<br>hard cluster rule placement paint_tiles가 활엽수 하단 좌측(292)에서 2x2 전체를 원자 배치한다 | no | 1931-1945 | 1954-1968 | equal |
| CF044 | `test/clusterRulePlacement.test.ts`<br>hard cluster rule placement scatter_object가 침엽수를 1x2 원자 풋프린트로 배치하고 summary에 동반 타일을 표시한다 | no | 1950-1964 | 1973-1987 | equal |
| CF045 | `test/clusterRulePlacement.test.ts`<br>hard cluster rule placement scatter_object가 활엽수를 source_rect 기반 2x2 원자 풋프린트로 배치한다 | no | 1969-1983 | 1992-2006 | equal |
| CF046 | `test/commandKindCoverage.test.ts`<br>commandKindRegistry — 레지스트리 sanity MINIMAL_COMMANDS가 COMMAND_KINDS를 빠짐없이 커버한다 | no | 1988-2012 | 2011-2035 | equal |
| CF047 | `test/commandKindCoverage.test.ts`<br>command kind별 shape 검증 커버리지 playMovie: 최소 인스턴스가 validateCommandArray를 통과한다 | no | 2017-2031 | 2040-2054 | equal |
| CF048 | `test/commandKindCoverage.test.ts`<br>condition 7종 — fork/페이지 조건 serialize→deserialize 왕복 모든 condition kind가 fork 커맨드 조건 + 이벤트 페이지 조건으로 왕복 보존된다 | no | 2036-24879 | 2059-24902 | equal |
| CF049 | `test/commentCommandBody.test.ts`<br>comment command UX renders dedicated comment editor with color select and preview | no | 24884-24898 | 24907-24921 | equal |
| CF050 | `test/commentCommandBody.test.ts`<br>comment command UX Ctrl+/ inserts a comment command via shortcut | no | 24903-24911 | 24926-24934 | equal |
| CF051 | `test/databaseItemInspector.test.ts`<br>database item inspector form weapon type shows an equipment-tab door instead of the legacy equipment form | yes | 24916-24927 | 24939-24950 | equal |
| CF052 | `test/databaseKoreanRtpDefaults.test.ts`<br>database Korean localization and EasyRPG RTP defaults keeps database editor chrome in readable Korean | no | 24932-29274 | 24955-29297 | equal |
| CF053 | `test/databaseNavMode.test.ts`<br>database navigation by editor mode 그룹 헤더가 안에 든 탭 이름과 레코드 합계를 알려준다 — 라벨 텍스트는 그대로 | yes | 29279-29290 | 29302-29313 | equal |
| CF054 | `test/databaseRadioCustomGuard.test.ts`<br>database radio custom guard radio 제외 없는 bare input 결합이 없다 | yes | 29295-29311 | 29318-29334 | equal |
| CF055 | `test/databaseSidebarKeyboard.test.ts`<br>database sidebar keyboard navigation pins Tab focus order: sidebar DOM order = overview entry + TAB_GROUPS order | yes | 29316-29344 | 29339-29367 | equal |
| CF056 | `test/databaseSidebarKeyboard.test.ts`<br>database sidebar keyboard navigation keeps every sidebar tab reachable in sequence when walked with Tab-style focus | yes | 29349-29377 | 29372-29400 | equal |
| CF057 | `test/databaseSidebarNav.test.ts`<br>database sidebar navigation keeps all registered tab testids, including the unified inventory catalog | yes | 29382-29396 | 29405-29419 | equal |
| CF058 | `test/databaseTabIcons.test.ts`<br>database tab icons covers every rail tab, overview included | yes | 29401-29415 | 29424-29438 | equal |
| CF059 | `test/databaseTabIcons.test.ts`<br>database tab icons renders the icon as the first child while the label owns textContent | yes | 29420-29434 | 29443-29457 | equal |
| CF060 | `test/defaultAdventureGame.test.ts`<br>sample adventure demo (이슬 마을의 종) ships the editor-authored dew village fixture, not the old lantern village | no | 29439-29450 | 29462-29473 | equal |
| CF061 | `test/defaultAdventureGame.test.ts`<br>sample adventure demo (이슬 마을의 종) starts in a decorated village map with path and water, not a bare grass pad | no | 29455-29462 | 29478-29485 | equal |
| CF062 | `test/defaultAdventureGame.test.ts`<br>sample adventure demo (이슬 마을의 종) includes quest NPCs and aftermath dialogue | no | 29467-29481 | 29490-29504 | equal |
| CF063 | `test/defaultDatabase.test.ts`<br>default database starter party builds a coherent RTP-backed six actor roster with a four member starting party | no | 29486-29580 | 29509-29603 | equal |
| CF064 | `test/defaults.test.ts`<br>createBlankProject maps bundled chipset terrain, priority, and passability by atlas index | no | 29585-29596 | 29608-29619 | equal |
| CF065 | `test/demoTeach.test.ts`<br>buildDemonstrationMessage 최종 그리드·붓질 순서·설명·해석 지침(교정 툴 안내)을 담는다 | no | 29601-29639 | 29624-29662 | equal |
| CF066 | `test/detsukuruBrandStrings.test.ts`<br>탈-쯔구르: 출하 문자열 src 안에 RPG Maker 계보 표현이 남아 있지 않다 | no | 29644-29671 | 29667-29694 | S2 |
| CF067 | `test/devShowcaseProjects.test.ts`<br>local dev project URL overrides keeps the legacy freshProject URL on the sample adventure (32+ e2e specs rely on it) | no | 29676-29687 | 29699-29710 | equal |
| CF068 | `test/devShowcaseProjects.test.ts`<br>local dev project URL overrides keeps the sample adventure behind an explicit example URL flag | no | 29692-29703 | 29715-29726 | equal |
| CF069 | `test/emberQuestGame.test.ts`<br>emberQuestGame 전투 5종이 몬스터 5종을 모두 사용한다 | no | 29708-29727 | 29731-29750 | equal |
| CF070 | `test/eventCommandPickerHandoff.test.ts`<br>command picker hands off to the edit dialog closes the map event picker before the edit dialog opens | no | 29732-29739 | 29755-29762 | equal |
| CF071 | `test/eventEditorCommandLabels.test.ts`<br>event editor command labels has one display option for every command kind | no | 29744-29768 | 29767-29791 | equal |
| CF072 | `test/eventEditorCommitProbe.baseline.test.ts`<br>이벤트 편집기 커밋 프로브 축 (1) 컨트롤 조작 → 저장 커맨드 스냅샷이 기준선과 같다 | no | 29773-29797 | 29796-29820 | equal |
| CF073 | `test/eventEditorCommitProbe.baseline.test.ts`<br>no-commit 래칫 무커밋 컨트롤 집합이 허용 목록과 정확히 일치한다 | no | 29802-29819 | 29825-29842 | equal |
| CF074 | `test/eventEditorFormSurface.baseline.test.ts`<br>이벤트에디터 폼 표면 스냅샷 기준선과 일치한다 | no | 29824-29848 | 29847-29871 | equal |
| CF075 | `test/eventEditorInteractionSurface.baseline.test.ts`<br>이벤트에디터 상호작용 후 폼 표면 스냅샷 기준선과 일치한다 | no | 29853-29877 | 29876-29900 | equal |
| CF076 | `test/eventEditorM2Surface.baseline.test.ts`<br>M2 명령 폼 표면 스냅샷 기준선과 일치한다 | yes | 29882-29902 | 29905-29925 | equal |
| CF077 | `test/eventEditorPortalSurface.baseline.test.ts`<br>포털(피커/모달) 표면 스냅샷 기준선과 일치한다 | yes | 29907-29927 | 29930-29950 | equal |
| CF078 | `test/eventEditorTrustLoop.test.ts`<br>event editor trust loop routes quick command 'command-add-show-animation' to the active page | no | 29932-29948 | 29955-29971 | equal |
| CF079 | `test/eventEditorTrustLoop.test.ts`<br>event editor trust loop navigates fatal event-position and schedule issues to editable controls | no | 29953-30888 | 29976-30911 | equal |
| CF080 | `test/eventEditorTrustLoop.test.ts`<br>event editor trust loop restores focus to the parent editor when a subdialog opener rerenders away | no | 30893-30903 | 30916-30926 | equal |
| CF081 | `test/eventEditorTrustLoop.test.ts`<br>event editor trust loop restores focus, caret, open details, and scroll across reactive rerenders | no | 30908-30915 | 30931-30938 | equal |
| CF082 | `test/eventEditorUiDensity.test.ts`<br>event editor UI density uses Korean name label and hides disabled page actions | no | 30920-30927 | 30943-30950 | equal |
| CF083 | `test/eventEditorUiDensity.test.ts`<br>event editor UI density defaults secondary settings and tools closed while keeping trigger and add command visible | no | 30932-30946 | 30955-30969 | equal |
| CF084 | `test/eventEditorUiDensity.test.ts`<br>event editor UI density shows active condition badges with switch id/ON-OFF, expands conditions on demand | no | 30951-30965 | 30974-30988 | equal |
| CF085 | `test/eventEditorUiDensity.test.ts`<br>event editor UI density expands movement section for nested movement controls without burying trigger | no | 30970-30984 | 30993-31007 | equal |
| CF086 | `test/eventEditorUiDensity.test.ts`<br>event editor UI density keeps inactive condition rows visible but faded (RM-style, no collapsing) | no | 30989-30996 | 31012-31019 | equal |
| CF087 | `test/fontFamilyTokenGuard.test.ts`<br>폰트 토큰 가드 소비지점 CSS 의 모든 font-family 가 역할 토큰까지 도달한다 | no | 31001-31017 | 31024-31040 | equal |
| CF088 | `test/forestDensity.test.ts`<br>plant_tree_clusters 기본(dense)이 선언한 커버리지에 닿고 그 지대를 실제로 막는다 | yes | 31022-31029 | 31045-31052 | equal |
| CF089 | `test/forestDensity.test.ts`<br>place_props density — 모델이 실제로 닿는 라이브 툴 활엽수 density=dense 가 count 없이도 숲을 만든다 | yes | 31034-31041 | 31057-31064 | equal |
| CF090 | `test/gen1DemoContent.test.ts`<br>Scarloxy Gen1 authored content authors persistent major statuses, finite PP, a Poke Ball, and trainer semantics | yes | 31046-31053 | 31069-31076 | equal |
| CF091 | `test/genrePackReceiptCli.test.ts`<br>verify:genre-packs CLI combines valid evidence files with actual authored/runtime readiness and keeps monster blocked | no | 31058-31498 | 31081-31521 | equal |
| CF092 | `test/houseKitDomainSeam.test.ts`<br>HouseKit domain seam keeps one exhaustive public kit list and a safe HouseKit module size | no | 31503-31510 | 31526-31533 | equal |
| CF093 | `test/houseLotTools.test.ts`<br>yard decor materials are buildable resolves every yard tag to a concrete material | no | 31515-31531 | 31538-31554 | equal |
| CF094 | `test/houseLotTools.test.ts`<br>yard decor materials are buildable builds a lot whose yard uses the sign tag | no | 31536-31550 | 31559-31573 | equal |
| CF095 | `test/interiorAutotile.test.ts`<br>interior wall-frame autotile harness (Option B: no house wall-frame store group) cream wall placed on a dark-mass wall cell does not bleed onto exterior void (오두막 (1,6) 회귀) | no | 31555-31566 | 31578-31589 | equal |
| CF096 | `test/interiorWallFrameQuarterComposition.test.ts`<br>interior dark-wall quarter composition (Option B: store 366 only) house whole tiles (428/397/105/430/233/257) are never quarter-composed | no | 31571-31612 | 31594-31635 | equal |
| CF097 | `test/interiorWallFrameQuarterComposition.test.ts`<br>interior dark-wall quarter composition (Option B: store 366 only) does not invent quarters on deep void | no | 31617-31658 | 31640-31681 | equal |
| CF098 | `test/io.test.ts`<br>serialize → deserialize 왕복 빈 프로젝트가 동일하게 복원된다 | no | 31663-31677 | 31686-31700 | equal |
| CF099 | `test/koreanLocalizationDefaults.test.ts`<br>Korean default localization and EasyRPG RTP defaults ships RTP-backed early battle defaults with valid enemy, troop, and animation references | no | 31682-31696 | 31705-31719 | equal |
| CF100 | `test/layerRouting.m1.test.ts`<br>소품(울타리)이 하위 지면을 지우지 않는다 모든 울타리 타일이 지면을 보존한다 | no | 31701-31715 | 31724-31738 | equal |
| CF101 | `test/mapEditCommands.test.ts`<br>map edit commands replaces mixed transparent prop objects on the selected upper layer | no | 31720-31734 | 31743-31757 | equal |
| CF102 | `test/mapEditCommands.test.ts`<br>map edit commands keeps a single upper tile when painting transparent props repeatedly | no | 31739-31753 | 31762-31776 | equal |
| CF103 | `test/modalEscapeLayerGate.test.ts`<br>Escape 계층 게이트 body 에 오버레이를 붙이는 파일은 modalStack 에 참여하거나 이유와 함께 면제된다 | yes | 31758-31774 | 31781-31797 | equal |
| CF104 | `test/modalEscapeLayerGate.test.ts`<br>Escape 계층 게이트 이번에 고친 표면들은 면제가 아니라 실제로 등록한다 | yes | 31779-31795 | 31802-31818 | equal |
| CF105 | `test/modeTransitions.test.ts`<br>mode transitions mounts play when a newer same-mode request overlaps an in-flight switch | no | 31800-31809 | 31823-31832 | equal |
| CF106 | `test/monsterCollection.test.ts`<br>monster collection core blocks uncapturable troops and excludes captured enemies from EXP | no | 31814-31828 | 31837-31851 | equal |
| CF107 | `test/monsterCollection.test.ts`<br>monster collection core simulateBattle strict script captures a weakened slime and fails at full HP | no | 31833-31847 | 31856-31870 | equal |
| CF108 | `test/noLocalProjectDb.test.ts`<br>canonical project persistence has no local DB fallback does not reference IndexedDB SQLite or local JSON fallback in runtime source | yes | 31852-31868 | 31875-31891 | equal |
| CF109 | `test/pkmnBalanceB6.test.ts`<br>batch 6 · same-tier matchups sit in the 0.6~0.9 win-rate band aqualing L5 vs troop_slime | no | 31873-31880 | 31896-31903 | equal |
| CF110 | `test/pkmnBalanceB6.test.ts`<br>batch 6 · same-tier matchups sit in the 0.6~0.9 win-rate band leafling L5 vs troop_slime | no | 31885-31892 | 31908-31915 | equal |
| CF111 | `test/pkmnBalanceB6.test.ts`<br>batch 6 · same-tier matchups sit in the 0.6~0.9 win-rate band sparkit L5 vs troop_slime wins most but its band cell is L11 vs slime pair | no | 31897-31904 | 31920-31927 | equal |
| CF112 | `test/pkmnBalanceB6.test.ts`<br>batch 6 · same-tier matchups sit in the 0.6~0.9 win-rate band aqualing L26 vs troop_dragon (boss at recommended level) | no | 31909-31916 | 31932-31939 | equal |
| CF113 | `test/pkmnBalanceB6.test.ts`<br>batch 6 · battle length lands in the 3~10 turn window same-tier fights average 3~10 actor decisions | no | 31921-31928 | 31944-31951 | equal |
| CF114 | `test/pkmnBalanceB6.test.ts`<br>batch 6 · progression ladder sanity overleveled sweeps, underleveled loses (levels are felt) | no | 31933-31940 | 31956-31963 | equal |
| CF115 | `test/pkmnBalanceB6.test.ts`<br>batch 6 · progression ladder sanity L1 stats still equal species baseStats exactly (save backward-compat) | no | 31945-31959 | 31968-31982 | equal |
| CF116 | `test/playerRuntimeCss.test.ts`<br>exported player runtime CSS detects an omitted required import in a disposable built entry | no | 31964-31978 | 31987-32001 | equal |
| CF117 | `test/pokemonChipsetPreset.test.ts`<br>헤드리스 장면 조립 — 잔디 맵 + 흙길 + 키큰풀 구역 프리셋 material 라벨로 fill_region 을 태워 잔디/흙길/키큰풀을 실제 배치한다 | no | 31983-31997 | 32006-32020 | equal |
| CF118 | `test/quickAuthoringPreviewIdentity.test.ts`<br>quick-authoring preview identity empty text body previews a sample sentence instead of '...' | no | 32002-32009 | 32025-32032 | equal |
| CF119 | `test/quickAuthoringPreviewIdentity.test.ts`<br>quick-authoring preview identity wait preview is a timeline with one duration label, not a duplicated card | no | 32014-32021 | 32037-32044 | equal |
| CF120 | `test/regionAiHouseTreeNpc.probe.test.ts`<br>region AI house/tree/npc probe live region task LLM: 집과 나무 1개 npc 배치 | no | 32026-32040 | 32049-32063 | equal |
| CF121 | `test/regionTaskCssTokens.test.ts`<br>region-task.css cool-white token contract 순수 흰색 #fff/#ffffff 리터럴이 없다 (포커스 링) | no | 32045-32062 | 32068-32085 | equal |
| CF122 | `test/regionTaskCssTokens.test.ts`<br>region-task.css cool-white token contract hex 리터럴이 하나도 없다 (모든 색은 var(--token)) | no | 32067-32087 | 32090-32110 | equal |
| CF123 | `test/rm2003DatabaseUtilityRecords.test.ts`<br>RM2003 database utility records ships first-class elements, terrains, and global battle commands | no | 32092-32113 | 32115-32136 | equal |
| CF124 | `test/rm2003DatabaseUtilityRecords.test.ts`<br>RM2003 database utility records normalizes malformed utility records into RPG2003-safe defaults | no | 32118-32174 | 32141-32197 | equal |
| CF125 | `test/roleNameComparisonGate.test.ts`<br>A-2 게이트 — 역할 이름 비교 잔여 허용 목록 밖에서 타일 역할 이름을 직접 비교하지 않는다 | yes | 32179-32196 | 32202-32219 | equal |
| CF126 | `test/scarloxyPokemonDemo.test.ts`<br>Scarloxy 포켓몬풍 데모 프로젝트 팩 몬스터 16종이 종으로 등록되고 배틀러 이미지가 해석된다 | no | 32201-32215 | 32224-32238 | equal |
| CF127 | `test/scatterObject.test.ts`<br>scatter_object 빈 영역에 요청 개수만큼 원자적으로 배치하고 최소 간격을 지킨다 | no | 32220-32234 | 32243-32257 | equal |
| CF128 | `test/scatterObject.test.ts`<br>scatter_object 문법 없는 2타일 prop 그룹은 가로가 아니라 위/아래 세로 한 쌍으로 배치한다 | no | 32239-32258 | 32262-32281 | equal |
| CF129 | `test/scatterObject.test.ts`<br>scatter_object defaultLayer:lower prop 그룹도 잔디 바탕으로 여러 그루가 한 스탬프에 묶이지 않는다 | no | 32263-32277 | 32286-32300 | equal |
| CF130 | `test/scatterObject.test.ts`<br>scatter_object 수관은 upper·밑동은 lower 로 찍고, 물 위에는 나무를 올리지 않는다 | no | 32282-32301 | 32305-32324 | equal |
| CF131 | `test/scatterObject.test.ts`<br>scatter_object 시작칸, 이벤트칸, transfer 목적지를 보호하고 부족 수량을 반환한다 | no | 32306-32313 | 32329-32336 | equal |
| CF132 | `test/scatterObject.test.ts`<br>scatter_object 영역이 포화되면 가능한 만큼만 배치하고 조용히 성공하지 않는다 | no | 32318-32325 | 32341-32348 | equal |
| CF133 | `test/setGroupLayout.test.ts`<br>set_group_layout 세로 위/아래 구성을 저장하고 샘플에서 위 칸 260, 아래 칸 290으로 배치한다 | no | 32330-32344 | 32353-32367 | equal |
| CF134 | `test/storePersistence.test.ts`<br>Project store remote persistence does not write to LegacyDb before the canonical project has loaded | no | 32349-32375 | 32372-32398 | S3 |
| CF135 | `test/storePersistence.test.ts`<br>Project store remote persistence does not auto-save local dev showcase projects to LegacyDb | no | 32380-32390 | 32403-32413 | equal |
| CF136 | `test/storePersistence.test.ts`<br>Project store remote persistence always creates a new fresh project instead of reloading local dev overrides | no | 32395-32405 | 32418-32428 | equal |
| CF137 | `test/storePersistence.test.ts`<br>Project store remote persistence saves and reloads local edits for dev showcase projects without LegacyDb | no | 32410-32420 | 32433-32443 | equal |
| CF138 | `test/storePersistence.test.ts`<br>Project store remote persistence reports why DB persistence is unavailable for local dev showcase projects | no | 32425-32439 | 32448-32462 | equal |
| CF139 | `test/storePersistence.test.ts`<br>Project store remote persistence does not create a DB project when the selected project row is missing | no | 32443-32450 | 32466-32473 | equal |
| CF140 | `test/teamWorkflowUi.test.ts`<br>team workflow UI renders topbar identity and allows label edits from the identity menu | no | 32486-32499 | 32478-32491 | equal |
| CF141 | `test/tileFlowApprovalExpansion.test.ts`<br>T1 — v3 프리미티브는 스펙 게이트 제외 승인 어휘가 있으면 set_build_spec 없이 build_wall이 성공한다 | no | 32504-32511 | 32496-32503 | equal |
| CF142 | `test/tileFlowApprovalExpansion.test.ts`<br>T2 — 승인 시 패턴 파츠 자동 생성 불변식 autotile_3x3 승인은 8-이웃 variantMap 오토타일 그룹을 등록하고 내장 폴백(흙길/모래)을 승계한다 | no | 32516-32530 | 32508-32522 | equal |
| CF143 | `test/tileGrafts.test.ts`<br>프로젝트 전체 무결성 두 모드 graft(411 덮어쓰기 + 480 확장)를 가진 프로젝트가 왕복 무손실이다 | no | 32535-32549 | 32527-32541 | equal |
| CF144 | `test/tileLayerClassification.test.ts`<br>tileLayerHome — 홈 레이어 판정 불투명 mixed 소품(441)은 양쪽 레이어를 허용한다 | no | 32554-32565 | 32546-32557 | equal |
| CF145 | `test/tileLayerClassification.test.ts`<br>tileVisibleOnLayer — 팔레트 레이어별 노출 불투명 mixed 타일(441)은 양쪽 팔레트에, 투명 칩(FLOWERS)은 상위에만 보인다 | no | 32570-32584 | 32562-32576 | equal |
| CF146 | `test/tilesetHarness.test.ts`<br>EasyRPG Combined Town tileset harness seeds castle map modules (roof deck, wall face, round tower) from map_castle_keep gold | no | 32589-32603 | 32581-32595 | equal |
| CF147 | `test/tilesetPaletteT1a.test.ts`<br>tileset palette AX tools T1a contextBuilder includes tile vocabulary digest with slot counts and low confidence count | no | 32608-32916 | 32600-32908 | equal |
| CF148 | `test/tilesetPaletteT1a.test.ts`<br>tileset palette AX tools T1a proposal summaries include palette preset counts | no | 32921-32932 | 32913-32924 | equal |
| CF149 | `test/tilesetPaletteT1a.test.ts`<br>tileset palette placement parameters T1a scatter_object uses preset tiles deterministically | no | 32937-32951 | 32929-32943 | equal |
| CF150 | `test/tilesetWave2Undo.test.ts`<br>tileset wave2 undo wiring the full-sheet passage modal's cell click records an undo snapshot | no | 32956-32966 | 32948-32958 | equal |
| CF151 | `test/toolCatalog.test.ts`<br>toolCatalog docs/tool-catalog.md가 레지스트리와 동기화되어 있다 | no | 32971-33064 | 32963-33056 | equal |
| CF152 | `test/unsavedChangesGuard.test.ts`<br>store.hasUnsavedChanges devProject 모드: 변경→true, flush(로컬 기록)→false | no | 33069-33083 | 33061-33075 | equal |
| CF153 | `test/unsavedChangesGuard.test.ts`<br>store.hasUnsavedChanges freshProject(저장 스킵) 모드: flush가 saved-local이어도 미저장으로 남는다 | no | 33087-33101 | 33079-33093 | equal |
| CF154 | `test/uxcEditorShell.test.ts`<br>UXC D30 새 이벤트 모달 상태 새 이벤트 모달 제목과 취소 안내에 자동 저장/복구 상태를 표시한다 | no | 33105-33116 | 33097-33108 | equal |
| CF155 | `test/viteConfig.test.ts`<br>vite dev server config binds the dev server to IPv6 localhost as well as IPv4 | no | 33121-33829 | 33113-33821 | equal |
| CF156 | `test/commandContracts/coverage.test.ts`<br>commandContracts 커버리지 — kind별 계약 파일 setRelationship: 계약 테스트 파일이 존재한다 | no | 33834-33848 | 33826-33840 | equal |
| CF157 | `test/commandContracts/coverage.test.ts`<br>commandContracts 커버리지 — kind별 계약 파일 playMovie: 계약 테스트 파일이 존재한다 | no | 33853-33867 | 33845-33859 | equal |
| CF158 | `test/commandContracts/coverage.test.ts`<br>commandContracts 커버리지 — kind별 계약 파일 openSaveMenu: 계약 테스트 파일이 존재한다 | no | 33872-33886 | 33864-33878 | equal |
| CF159 | `test/commandContracts/coverage.test.ts`<br>commandContracts 커버리지 — kind별 계약 파일 spawnFieldEnemy: 계약 테스트 파일이 존재한다 | no | 33891-33905 | 33883-33897 | equal |
| CF160 | `test/commandContracts/coverage.test.ts`<br>commandContracts 커버리지 — kind별 계약 파일 despawnFieldEnemy: 계약 테스트 파일이 존재한다 | no | 33910-33924 | 33902-33916 | equal |
| CF161 | `test/commandContracts/evolveMonster.contract.test.ts`<br>evolveMonster 계약 아이템 진화: 성공 시 요구 아이템을 1개 소모한다 | no | 33929-33943 | 33921-33935 | equal |
| CF162 | `test/commandContracts/registry.test.ts`<br>native command guarantee registry has one valid guarantee for every command and condition | no | 33948-33982 | 33940-33974 | equal |

## All original-fail / both-pass cases (57)

Each row is original **failed -> current passed / base passed**, occurrence 1, and remains an **unresolved non-reproduction**. Pass references are line numbers in each side's `stdout.txt`; exact JSON/history mappings and original full failureMessages are in the JSON artifact. No row is certified fixed or inherited.

| ID | File / full case name | Outside | Current pass line | Base pass line | Historical Phase2 |
|---|---|---|---|---|---|
| BP001 | `test/authorVillageFacade.test.ts`<br>author_village settlement scale and winter builds a deterministic 100x100 snow city with the requested population | yes | 1222 | 1210 | passed |
| BP002 | `test/autosaveStatus.test.ts`<br>autosave status notifies pending, saving, and saved around the 4 second autosave debounce | no | 9757 | 9728 | passed |
| BP003 | `test/autosaveStatus.test.ts`<br>autosave status retries with exponential backoff after an autosave error without another update | no | 9761 | 9732 | passed |
| BP004 | `test/commitEditActivityAttachment.test.ts`<br>커밋 row 에 실리는 편집 행위 기록 AI 적용 커밋의 patch_json 에 그 행위가 origin·라벨과 함께 실린다 | yes | 1709 | 1662 | passed |
| BP005 | `test/commitEditActivityAttachment.test.ts`<br>커밋 row 에 실리는 편집 행위 기록 두 번째 커밋은 첫 커밋이 이미 실은 엔트리를 다시 싣지 않는다 | yes | 1710 | 1678 | passed |
| BP006 | `test/databaseActions.test.ts`<br>Database actions creates, edits, duplicates, deletes, and exports every database collection | yes | 1377 | 1365 | passed |
| BP007 | `test/databaseBattleCommandsTab.test.ts`<br>battle commands tab copy and class door drops RM2003 path copy, keeps catalog fields, and labels kinds in Korean | yes | 10326 | 10304 | passed |
| BP008 | `test/databaseModalDirtySession.test.ts`<br>database modal dirty session discards a session-only edit even when the undo stack was already saturated at MAX_HISTORY before the session opened | yes | 10097 | 10072 | passed |
| BP009 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard lazy compute: charts container is empty before idle callback, populated after flush | yes | 1282 | 1270 | passed |
| BP010 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard curve chart renders two non-empty SVG paths with gridlines and Lv1..Lv50 labels | yes | 1286 | 1274 | passed |
| BP011 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard scatter chart draws one circle per enemy with a <title> tooltip and boss styling | yes | 1290 | 1278 | passed |
| BP012 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard renders issue cards matching the detector output with jump buttons | yes | 1294 | 1282 | passed |
| BP013 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard jump button switches to the target tab via switchDatabaseActiveTab (G006) | yes | 1298 | 1286 | passed |
| BP014 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard attack-stagnation jump opens the classes tab, not skills | yes | 1302 | 1290 | passed |
| BP015 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard curve section shows a visible HP/attack legend | yes | 1306 | 1294 | passed |
| BP016 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard AI 분석 button dispatches the modal's database-ai-toggle click (aria-expanded) | yes | 1310 | 1298 | passed |
| BP017 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard clean project shows empty-state cards instead of blank canvases | yes | 1314 | 1302 | passed |
| BP018 | `test/databaseOverviewDashboard.test.ts`<br>database overview dashboard empty project renders empty states without NaN paths | yes | 1318 | 1306 | failed |
| BP019 | `test/databaseOverviewTab.test.ts`<br>database overview tab shell empty project renders chips with 0 counts without crashing | yes | 9225 | 9196 | passed |
| BP020 | `test/databaseOverviewTab.test.ts`<br>database overview tab shell default open tab after modal open is the stored last tab, NOT overview unless stored | yes | 9229 | 9200 | passed |
| BP021 | `test/databaseOverviewTab.test.ts`<br>database overview tab shell persists across hard reload: stored 'overview' lands on the overview tab | yes | 9233 | 9204 | passed |
| BP022 | `test/databaseOverviewTab.test.ts`<br>database overview tab shell setDatabaseActiveTab('overview') + renderDatabasePanel renders the overview tab | yes | 9237 | 9208 | passed |
| BP023 | `test/databaseOverviewTab.test.ts`<br>database overview tab shell stat chips are buttons that switch to the matching tab (G006) | yes | 9241 | 9212 | passed |
| BP024 | `test/databaseOverviewTab.test.ts`<br>database overview tab shell databaseTabLabel resolves the overview label for the AI footer | yes | 9245 | 9216 | passed |
| BP025 | `test/databaseViewToggle.test.ts`<br>database per-collection view mode session clicking db-view-toggle-gallery on items flips state to gallery and persists across re-render and localStorage re-read | no | 9774 | 9745 | failed |
| BP026 | `test/databaseViewToggle.test.ts`<br>database per-collection view mode session toggle buttons exist with correct aria-pressed and active class | no | 9778 | 9749 | failed |
| BP027 | `test/databaseViewToggle.test.ts`<br>database per-collection view mode session elements/terrain/utility tabs never render the view toggle | no | 9779 | 9750 | failed |
| BP028 | `test/databaseVillageView.test.ts`<br>데이터베이스 「마을」탭 — 그림 내장 갤러리에서 고른 형태가 규약을 통과한다 | yes | 155 | 158 | passed |
| BP029 | `test/editorProjectE2EBridge.test.ts`<br>mounted project E2E bridge denies missing/wrong capability before invoking either remote store method | yes | 9948 | 9919 | passed |
| BP030 | `test/editorProjectE2EBridge.test.ts`<br>mounted project E2E bridge maps authorized initialization and reload to the mounted singleton with exact proof | yes | 9949 | 9923 | passed |
| BP031 | `test/editorProjectE2EBridge.test.ts`<br>mounted project E2E bridge cleanup removes only the bridge and remount consumes no stale capability | yes | 9953 | 9927 | passed |
| BP032 | `test/editorProjectE2EBridge.test.ts`<br>mounted project E2E bridge does not install without WebDriver | yes | 9954 | 9928 | passed |
| BP033 | `test/eventEditorModal.test.ts`<br>RPG Maker style event editor entry points removes the new-event modal when cancel discards its draft | yes | 546 | 546 | passed |
| BP034 | `test/horrorExperienceQa.test.ts`<br>automated horror experience QA runs multiple player-behavior scenarios and gives the complete prototype a strong pass | yes | 9712 | 9683 | passed |
| BP035 | `test/horrorMysteryPrototype.test.ts`<br>horror mystery playable prototype 빈 프로젝트로 퇴행하면 세 개의 Interior 칩셋 장면 계약이 깨진다 | yes | 9144 | 9115 | passed |
| BP036 | `test/loadNewRemoteProject.test.ts`<br>store.loadNewRemoteProject — welcome genre remote branch keeps remote persistence on, mints a new project id, and does not disable DB | yes | 10215 | 10193 | passed |
| BP037 | `test/manualCommitDiff.test.ts`<br>수동 저장 커밋 summary 는 실제 diff 다 타일을 칠하고 저장하면 summary 가 '시스템' 이 아니라 타일 변경을 담는다 | yes | 9884 | 9851 | passed |
| BP038 | `test/mapClipboardFeedback.test.ts`<br>맵 클립보드 피드백 선택 영역 없이 복사하면 false와 안내 토스트를 반환한다 | yes | 10417 | 10395 | passed |
| BP039 | `test/mapEditLockScratchSession.test.ts`<br>스크래치 세션(원격 저장 비활성)의 맵 편집 락 remotePersistenceEnabled=false 세션은 락을 취득하지 않고 idle을 유지한다 | yes | 10105 | 10080 | passed |
| BP040 | `test/moveRouteCatalogPersistence.test.ts`<br>이동 경로 팔레트 persistence BREAK: 팔레트의 모든 명령이 하나씩 serialize→deserialize 를 통과한다 | yes | 10099 | 10074 | passed |
| BP041 | `test/regionRightDragNotifications.test.ts`<br>selectTileRegion 통지량 같은 사각형을 다시 넣으면 통지하지 않는다 | yes | 10311 | 10289 | passed |
| BP042 | `test/regionSelectionPastePreview.test.ts`<br>북여넣기 미리보기 모드 movePastePreview로 위치 갱신 | yes | 9185 | 9156 | passed |
| BP043 | `test/regionSelectionPastePreview.test.ts`<br>clearSelection / clearSelectionRegion clearSelectionRegion이 선택 영역을 빈 칸으로 | yes | 9200 | 9171 | passed |
| BP044 | `test/regionSelectionPastePreview.test.ts`<br>copySelection 피드백 개선 복사 토스트에 크기 정보 포함 | yes | 9210 | 9181 | passed |
| BP045 | `test/regionSelectionPastePreview.test.ts`<br>renderSelectionActionChips — 복사/붙여넣기/지우기/해제 버튼 AI 작업이 첫 버튼이고, 크기 텍스트는 바에 없다 | yes | 9211 | 9182 | passed |
| BP046 | `test/regionSelectionPastePreview.test.ts`<br>renderSelectionActionChips — 복사/붙여넣기/지우기/해제 버튼 클립보드가 있으면 붙여넣기 버튼이 나타난다 | yes | 9212 | 9183 | passed |
| BP047 | `test/regionSelectionPastePreview.test.ts`<br>renderSelectionActionChips — 복사/붙여넣기/지우기/해제 버튼 클립보드가 없으면 붙여넣기 버튼이 없다 | yes | 9213 | 9184 | passed |
| BP048 | `test/storeEventDraftPreserve.test.ts`<br>store preserves open event drafts across remote autosave keeps a new event draft after map-patch save returns a draft-stripped project | yes | 10408 | 10386 | passed |
| BP049 | `test/storeFlushShaEvidence.test.ts`<br>Project store flush sha256 evidence 전체 저장 경로: saveProjectToLegacyDb 의 sha256 이 flush 결과(saved.sha256)로 흘러든다 | yes | 10227 | 10205 | passed |
| BP050 | `test/legacyDbProjectSync.test.ts`<br>LegacyDb project sync preserves concurrent saves from separate editors touching different maps | yes | 22 | 22 | passed |
| BP051 | `test/legacyDbProjectSync.test.ts`<br>LegacyDb project sync preserves concurrent map tree additions from separate editors | yes | 23 | 23 | passed |
| BP052 | `test/toolHostileArgs.test.ts`<br>쓰기 툴 적대적 인자 스윕 empty 인자에 어떤 툴도 크래시하거나 읽을 수 없는 실패를 남기지 않는다 | yes | 10239 | 10217 | passed |
| BP053 | `test/uxcLoadFailure.test.ts`<br>UXC D01 프로젝트 로드 실패 폴백 오류 원문을 숨기고 안전한 복구 방법과 예제/새 프로젝트 CTA를 제공한다 | yes | 9973 | 9947 | passed |
| BP054 | `test/uxcLoadFailure.test.ts`<br>UXC D01 프로젝트 로드 실패 폴백 예제 프로젝트 폴백은 저장본을 폐기하지 않고 메모리 프로젝트로 부팅한다 | yes | 9974 | 9948 | passed |
| BP055 | `test/uxcLoadFailure.test.ts`<br>UXC D01 프로젝트 로드 실패 폴백 새 프로젝트 폴백도 기존 저장본을 폐기하지 않는다 | yes | 9975 | 9949 | passed |
| BP056 | `test/villageBuilder.test.ts`<br>build_village 스케치가 이긴 집 배치는 격자 열에 서지 않는다 | yes | 44 | 44 | passed |
| BP057 | `test/villageBuilder.test.ts`<br>build_village 대로·진입로가 집 footprint 내부를 침범하지 않는다 | yes | 46 | 46 | passed |

## Unresolved handoff to parent

- **U1 (two current-only console logs):** Current has an additional unlabeled-project edit-activity log under each of two agentBlueprintTurnEnd failures. No source explanation established; full assertion values still agree.
- **U2 (timeout and ordered console warnings):** Same 15000ms timeout, but edit-activity/LegacyDb warning order differs. Do not identify the common timeout cause from matching error text.
- **U3 (57 original-fail/both-pass cases):** No attribution of original failure/non-reproduction to Phase3 fix, environment, timing, or contamination is established.
- **U4 (causal attribution and restricted coverage):** Common failure signatures establish paired observation only. Network-restricted failures, original sentinels, matcher elisions and two unhandled errors constrain gate conclusions.

The only additional console value difference outside U1/U2 is the already-saved CSS fixture build duration (286ms base versus 241ms current); file names/sizes agree. No code behavior is inferred from that elapsed time. All four assertion-body differences are explained only to the extent stated in S1-S3; broader causation and final Phase3 approval remain open.

## Parent-owned status delta update

The parent reports completed, identical exit-0 controlled public-queue probes on both exact heads (`audit-queue-current/result.json`, `audit-queue-base/result.json`, `audit-candidate-conclusion.json`). Its reported conclusion is existing audit-queue observer contamination: `store.flush` returns saved without a request at flush, then the timer sends `/__oprn/edit-activity` to the replacement observer at 1500ms; the existing reset prevents that on both. This is parent-supplied evidence, not independently re-diagnosed here. The parent limits it to the controlled probe, not a complete prior-test replay, and says the original test remains flaky. It is not an unresolved child investigation and does not classify any of the 162 shared failures or 57 non-reproductions.

## Artifact validation

Input SHA-256 values, 1251-key alignment, all 219 original-failure mappings, all current/base FAIL headers, all stdout status lines, full-body comparisons and the four explicit deltas were checked while deriving these artifacts. Every original failed case appears exactly once as CF or BP. The original input hashes were rechecked before writing. No test/build validator was run because this task explicitly prohibits new executions of those surfaces.
