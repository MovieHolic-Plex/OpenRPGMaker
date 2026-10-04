> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

## 여러 게임 오버의 실행과 미리보기 (2026-09-23)

`showGameOverScreen(message?,gameOverId?)`는 `resolveGameOverSettings`로 선택한 설정을 고정하고,
`playGameOverPresentation`에 재시도/회복/타이틀 콜백을 전달한다. 화면 연출과 결과는 별개다.
`menu`는 체크포인트 재시도/타이틀, `recover`는 진행 유지·전원 회복·지점 귀환,
`title`은 메시지 유지 시간 이후 타이틀 자동 복귀다. 각 정의의 시퀀스·배경·음악·시간을 사용한다.
전경/병렬 인터프리터 모두 ID를 전달한다. 회복은 선택한 정의의 좌표를 사용한다.

트룹 이벤트가 명시한 `gameOverId`는 `BattleEventStateSnapshot.gameOverRequest`로 필드 호스트에 전달한다.
명시적 항목 실행은 canLose 전투에서도 해당 종단 흐름을 실행하고 호출자의 뒷 명령을 재개하지 않는다.
ID 없는 기존 트룹 명령의 canLose 규칙은 유지한다. 일반 전멸은 프로젝트 기본 정의를 사용하며,
기본 정의에 메시지가 있으면 일반 패배 문구로 덮어쓰지 않는다.

`createTerminalSurface`는 DOM 입력·타이머·detach·부모 abort를 소유한다. 게임에서는
`createTerminalScene`이 Phaser shutdown/destroy 및 기존 오디오 정리를 덧씌운다.
에디터 미리보기는 DOM 소유자만 사용하며 게임 세션이나 전역 오디오를 종료하지 않는다.


## 장르별 패배와 엔딩 흐름 (2026-09-22)

`system.gameOver.presentation`은 `classic`(생략 시 기본), `horror`, `blackout` 중 하나다.
장르 이름으로 추측하거나 전체 프로젝트를 자동 변경하지 않는다. DB → 게임 오버의
「연출과 결과」 또는 `set_game_over`로 명시한다.

- `classic`: 필드 암전 → 결과 그림 → 선택지. 기존 배경/문구/시퀀스를 보존한다.
- `horror`: 900ms 암전 → 750ms 정적 → 글자 등장 → 1500ms 뒤 재시도/타이틀.
  저작 배경이 없으면 검은 화면과 절제된 글자만 쓴다. 클래식 묘비 그림을 강제하지 않는다.
- `blackout`: 암전 → 패배 문장(2200ms) → 회복 장소에서 800ms 밝아짐.
  `gameOver.recovery?: {mapId,x,y}`를 지정하며, 생략 시 체크포인트 **좌표**, 그것도 없으면
  시작 좌표를 쓴다. `defeatRecovery.ts`는 현재 세션을 복제해 파티 HP/MP·몬스터 HP/상태/PP를
  회복하고 위치와 음악만 교체한다. 현재 변수·스위치·인벤토리·돈·경험치를 롤백하지 않는다.
  체크포인트 재시도는 기존 스냅숏 복원이며 별개다. 존재하지 않거나 통행 불가능한 귀환 위치는
  무한 암전 대신 재시도/타이틀 메뉴로 복구한다. 마지막 병원 기록이나 금전 패널티를 자동 추측하지 않는다.

`terminalScene.ts`가 세 흐름과 엔딩의 입력·타이머·DOM 수명을 소유한다. 결과를 읽는 동안
확정키를 차단하고, 선택지가 나타난 뒤 새 입력을 받는다. 교체·shutdown·destroy·DOM 분리 시
타이머, 메뉴, 음악을 해제한다. `game-over-screen`/`ending-screen` 경계는 전환 중에도 유지해서
맵 시뮬레이션이 먼저 재개되지 않게 한다. 모션 감소 설정은 이동/페이드를 없애되 읽는 시간을 보존한다.

`EndingDef.presentation` 및 `ending` 명령의 `presentation`은 선택적
`{tone?: "warm"|"dark", credits?: string, backgroundResourceId?: string, musicResourceId?: string}`이다.
`triggerEnding`은 기존 조건/우선순위/에필로그를 그대로 실행하고 선택된 엔딩의 presentation을
마지막 핸드오프로 넘긴다. 엔딩별 설정은 `define_ending`, 직접 명령의 분위기/크레딧은 이벤트
편집기에서 저작한다. 엔딩은 암전 → 제목/본문(최소 1800ms, 확인으로 진행) → 저작 크레딧 →
THE END → 타이틀 순서다. 크레딧은 자동 스크롤/완주 또는 새 확인 입력으로 끝나며,
모션 감소에서는 PgUp/PgDn으로 읽는다. 전용 음악은 에필로그 화면부터 최종 화면까지 유지된다.
크레딧이 없으면 해당 단계만 생략한다. 엔딩도 전체 인터프리터 스택과 병렬 후속 명령을 종료한다.

실제 player.html 녹화/검증: `docs/reviews/2026-09-22-terminal-flows/README.md`.
재현: `scripts/qa/runtime/terminal-flows.probe.mjs`. 메모리 fixture이며 프로젝트 콘텐츠 배포가 아니다.

## Opening and game-over cinematics (2026-09-06)

- Persisted opt-in fields are `system.opening?: CinematicSequence` and
  `system.gameOver?: GameOverSettings`; see `runtime-project-schema.md` for strict
  normalization/validation. No event-movie or ending behavior is repurposed.
- `src/player/cinematicSequence.ts` exports
  `playCinematicSequence({ host, project, sequence, signal })` returning
  `{ done: Promise<"completed" | "skipped" | "aborted">, teardown() }`.
  It is DOM-only and receives the project explicitly, so editor preview can use
  the same player without a Phaser scene, global store or runtime session.
  Disabled/empty/missing sequences leave the host untouched. `teardown` and abort
  are idempotent; detached hosts also abort via a MutationObserver.
- Confirm is Z/Enter/Space (not the legacy field E alias); Escape skips only an
  authored skippable sequence. Window capture consumes the whole key event before
  title/menu/Phaser handlers and ignores repeated confirm/skip/retry and IME actions.
  ArrowUp/Down scroll narration by 24 logical pixels; PageUp/Down scroll 90% of its
  visible height, and Home/End reach either end. Scrolling accepts OS repeat and
  assigns scrollTop synchronously (browser-clamped), never advancing or falling
  through to gameplay. A scrolling hint appears only for measured overflow;
  a scene-owned ResizeObserver updates it on layout changes and disconnects on
  cleanup, without polling or extra timers. Pointer interaction cannot advance.
  Text is native textContent. Image motion is transform/opacity
  only and has both JS and CSS reduced-motion paths; GIF/WebP use native images.
- Image/text duration 0 waits for confirm. Positive duration advances exactly
  once, including after media errors. Video `ended` advances naturally; positive
  duration is its maximum. Video and narration pause, lose their sources and
  call load() on advance, skip, error, abort or teardown. Old media events and
  late play() rejections cannot affect a later scene. Blocked autoplay exposes
  R retry and confirm continuation. Initial video loading and each R retry show
  continuation and arm a fresh 10-second load deadline, cancelled by successful
  playback or cleanup. Native `waiting`/unbuffered `stalled` events expose immediate
  confirm continuation without releasing media; `playing` clears that status and
  disables video continuation again. Buffered `stalled` alone does not unlock
  healthy playback. There is no post-start playback-duration cap: only an authored
  positive duration limits healthy video. Initial/retry waiting retains its load
  deadline; repeated waiting events never extend it. Missing/broken video remains
  continuable even when unskippable. Stall RED/GREEN and fault-injected exported
  player evidence: `output/evidence/cinematics-stall.md`.
- `player.ts` runs opening before preflight/map boot for title New Game, normal
  autoStartRun and fresh restart. Loaded sessions, startOverride/test-here and
  selected-event tests bypass it. stopGame cancels opening, and its controller
  identity gates the async handoff; teardown also cancels pending title confirm.
  Existing load/save/checkpoint paths remain separate from fresh-run opening.
- `playSceneOverlays.ts` keeps `game-over-screen` mounted around both sequence and
  terminal menu. Existing movement/time/minimap/shell consumers therefore stay
  blocked without changing their selectors. It releases held input on entry;
  per-host replacement plus scene shutdown/destroy detach playback, terminal
  cursor listeners and DOM. Authored labels/background apply; an event message
  takes precedence over the configured default, including explicit empty text.
  Retry remains conditional on hasCheckpoint. The default terminal is now an opaque
  full-stage scene, not the field's window skin: bundled `easyrpg-game-over-game-over`
  art, small text choices below its center, and keyboard hints (`runtime/gameOver.css`).
  The art is an implicit web-export dependency even when no project setting/profile
  references it. Authored backgrounds/text/labels still override defaults; the built-in
  art's baked-in title is not duplicated, and image failure reveals the text fallback.
  A black scene remains behind sequence teardown, so completing a cinematic cannot
  expose the field/HUD. Entry stops shared field audio; checkpoint applySession owns
  audio restoration. Long body copy scrolls with PgUp/PgDn independently of menu arrows.
  `interpreter/resume.ts` terminates the whole stack on the gameOver handoff (including
  killPlayer and nested common-event callers); it must never advance post-terminal commands.
  Foreground completion callbacks are suppressed for this outcome. Parallel scheduling
  stops when the terminal opens, including asynchronous continuations in the same session.
  Actual player/GIF evidence: `docs/reviews/2026-09-22-game-over/README.md`;
  reproducible probe: `scripts/qa/runtime/game-over-scene.probe.mjs`.
- `runtime/playSurface.css` owns cinematic presentation in the shared `playerRuntime.css` closure
  (exported player and editor). Uploaded video MIME resolution uses the existing
  generatedAssetResourceResolver; no movie-command fallback behavior changed.
- Proof: `cinematicSequence`, `playerCinematics`, `cinematicSettings` and the
  existing title/checkpoint/defeat/run-controls tests. Run
  `npm run qa:runtime -- --scenario cinematic-sequences` for actual `player.html`
  behavior, not the editor shell. Its fixture generator uses a blank map and one
  checkpoint/kill command pair, never a demo or remote DB project. The 5KB WebM
  is a synthetic 32x24 color frame; narration is generated silent PCM WAV.
  Scenario transitions subscribe to DOM/media events before actions and use
  bounded deadlines, not sleeps/polling. It proves rejected autoplay/retry,
  native ended, media errors, reduced motion, no input fallthrough, repeat,
  checkpoint retry, repeated game over and host cleanup. Read SUMMARY.md first.
  Evidence and the separately reproduced baseline CSS omission failure are in
  `output/evidence/cinematics-p1/runtime.md`.
## Recovery ledger and scheduled failure ownership (2026-09-09)

The player record menu exposes the recovery tab while `session.lifeRecovery.claims` remain, even when the authored life packages are disabled. Rows display exact claim items and unresolved details without simulating a collection transaction. Explicit activation uses `collectLifeRecoveryClaim`; unknown items and inventory-cap refusals retain the complete claim and inventory. Last action outcomes are presentation state, not persisted recovery rights.

Date-transition failures retain their stage, source/problem ID and recovery entry. The existing menu controller opens the recovery tab when claims remain; the error cursor releases its listeners before opening, dismissal, replacement or clear. `observeScheduledTimeTransition` starts an operation-local task factory and accepts an acknowledgement only after that operation presents its failure. Scheduled sleep/advance and nested forced-sleep callers forward it, so their structured errors survive while unpresented failures still get fresh fallback rather than inheriting stale diagnostics.

Regression coverage: `lifeRecoveryLedgerUi.test.ts`, `scheduledTimeDiagnostics.test.ts` and the real-clock `makerClockIntegration.test.ts` adapter. The actual player proves valid three-claim collection/refusal; malformed date failures are separately tested through real scheduler/module and browser keyboard boundaries, not represented as valid saved gameplay.

## Task10 field input and exact forage dates (2026-09-06)

`src/player/playSceneMovement.ts` resolves ordinary action input **per coordinate**: action event -> storage chest -> generated forage -> authored fishing spot -> farming. It exhausts the front coordinate before trying the player's feet in the same order. This isn't a global event-first pass: front fishing or farming beats an underfoot event. Existing hiding/pushable event handling and event debounce remain ahead of life actions.

The real input path and `src/testing/sceneTestRunner.ts` share `src/player/lifeFieldInteraction.ts:interactWithLifeField`, calling actual `collectForageAt` and `attemptFishingCatch` transactions. Both use `farmIntentForHand` for farming. An explicit forage owner or fishing region consumes input on success **or refusal**; only `unhandled` falls through. Stale forage can't fall through to overlapping fish, and a front refusal can't trigger feet events/crops. Real refusal shows feedback without changing session owners, inventory, energy or RNG. `updatePlayScene` permits an action-combat swing only when `!interacted`, so consumed refusal isn't an attack. Runner chest `open` logging proves consumed dispatch, not storage transfer or rendered UI completion.

`src/project/fishing.ts` separates region membership from catch eligibility. It checks integer map bounds and species/season/time/weather/skill conditions, then uses the shared tool resolver **only if a fish action row exists**. There's no invented rod requirement without one. Authored itemId-before-kind rules and `requiresFarmable` apply. Rewards, collection counts, energy and enabled automatic XP commit on a draft. Disabled/omitted progression skips automatic XP without bypassing fishing skill qualification, preserving task6 and task8 behavior.

Successful real pickup/catch clears the action target key, refreshes runtime surfaces and synchronizes state. `src/player/playScenePlaceables.ts` draws generated forage with the existing EasyRPG Object2 gem marker (character index 6); forage entries have no authored graphics field. The read-only `resolveForageAt` hides expired/disabled forage, while in-bounds stale/missing definitions retain the fallback marker and `forage:<areaId>/<entryId>` missing-resource warning. `syncForageWarnings` also runs after event-only rebuilds in `playSceneMapRuntime.ts`, so clearing the shared warning set doesn't lose the warning. Rendering neither repairs nor collects an owner.

`src/project/seasonalForage.ts` accepts positive safe-integer years, valid seasons and integer days within `daysPerSeasonOf(project)`. Its private ordinal converts **each component before arithmetic**: `((BigInt(year) - 1n) * 4n + BigInt(seasonIndex)) * BigInt(daysPerSeason) + BigInt(day)`. Ordering, age and cadence stay exact even at year `9007199254740991`; computing a Number ordinal first would already lose adjacent days. Collection rejects future spawn dates, different seasons, or `age >= despawnAfterDays`. Generation rejects duplicate/backward cursors and uses `(ordinal - 1n) % BigInt(spawnEveryDays ?? 1) === 0n`. There's no arbitrary year cap, persisted BigInt, new save field or schema version: dates remain numeric components and saved cursor/spawn keys remain strings. These forage rules don't relax maker-clock validation.

See the task10 evidence scope in `openwiki/testing.md`. Existing task6 XP, task7 regrowth, task8 tool and task9 maker-clock contracts below remain in force.

## QA-only life observation (2026-09-06)

`buildLifeRuntimeSnapshot` in `src/player/runtimeDom.ts` copies the current `farmPlots`, `energy`, `makerInstances`, `farmAnimals`, `farmBuildingPlacements`, and `lifeRecovery` owners. The existing runtime DOM snapshot, `__oprnDebug.readState()`, and headless runner final state share it. Reads do not advance deadlines, reconcile records, collect claims, or fill missing optional owners. Plot remaining time and linked-housing fields are not implemented by this increment and are not synthesized; later owner extensions can travel in the same detached copies.

Each instrumented PlayScene owns its RuntimeDomOverlay and its increasing `actionReceipt`. `handleAction` records the actual synchronous dispatch result and ordered farm attempts (including ignored/rejected outcomes), then synchronizes the mirror before emitting `oprn:action` on the scene's overlay host. `handled` means input consumption, **not** completion of an asynchronous NPC/chest event or acceptance of every life action. The counter never enters PlaySession or SaveSnapshot. A new scene starts without a receipt. Normal exported-player boot keeps the existing QA capability off: no debug hooks/mirrors, no action collection or event emission. See `openwiki/testing.md` for prearmed observation and executable evidence.

### Audio QA capability and shell lifetime (2026-09-06)

The same explicit `qaInstrumentation === true` capability also owns `__oprnAudioState` and `__oprnAudioObserved`. `renderPlayer` configures the existing audio singleton **before title audio**, passing the capability through `getAudioEngine` to construction or reconfiguration; shell teardown revokes it. Omitted/false boots publish neither global, including after an enabled shell is replaced. Ordinary `getAudioEngine()` consumers do not change the capability. Stop-channel/stop-all, map changes and return-to-title do not end the shell's observation lifetime. Revocation drops the engine's observation array and deletes only publications still identical to its owned function/array; it does not stop playback, change controls, or disable the public `audioStateSnapshot()` API. A later opt-in begins a fresh resource list. This is the existing single-player shell/singleton, not a new multi-player ownership framework.

The resource list records **requests**, including queued requests; it is not proof of decoding or audible output. Normal `playBootDiagnostics` and `runtimeJuice` globals retain their production diagnostic/feedback owners. Do not blanket-delete `__oprn*`. Editor-only audio probes must explicitly opt in when they consume the QA globals; normal editor audio controls still use public engine APIs.

## Save5 session boundary (2026-09-06)

This section supersedes the historical schemaVersion 3 / mutual-reader-compatibility statements below. The shared writer now produces Save5; the reader accepts Save4 and Save5 and upgrades only in memory. Project version remains 4. Manual/autosave keys insert `v5:` after `save-slot:` while retaining the namespace. Missing new keys alone enable legacy fallback; corrupt new keys never silently resume older progress. Legacy raw bytes remain untouched on reads, writes, and quota failures.

`src/player/checkpoints.ts` stores snapshots in a `WeakMap<PlaySession, SaveSnapshot>`, not browser storage: there is no existing checkpoint disk key to version or migrate. Checkpoints inherit Save5 through the shared writer and restore an independent session. They are intentionally not serialized inside normal slots. A failed checkpoint construction leaves the prior checkpoint intact.

Autosave policy is unchanged: save-access/map/cutscene gates and the five-second debounce still apply. Task4 catches typed life-reconciliation failure during `performAutosave` construction, warns and returns `null`; unrelated construction exceptions still propagate. Storage failure also warns and returns `null`; `maybeAutosave` returns false. Neither failure consumes the debounce window. Only a successful write updates its timestamp. A failed save preserves the prior disk slot and current live actions independently; it does not undo an already collected claim. Tests: `test/lifeSaveVersion.test.ts`, `autosave.test.ts`, P0/P1/P2 session persistence, `checkpointEndingRuntime.test.ts`.

## Life recovery primitives and maker evidence (2026-09-06)

Plan47/48 (2026-09-07): new incompatible building conversions with paid gold partition payable item batches from exactly one empty-item unresolved claim containing the original placement/receipt. Gold is evidence only, never credited. Collecting an item batch removes its ID without touching that evidence or rewinding sequence. Legacy mixed building claims with nonzero gold or unrecognized receipt retain their individual original record under a fresh empty-item claim when collected; no cross-claim historical deduplication or inferred payout is performed. Capacity/sequence/whole-recovery byte checks include retained evidence and refuse atomically. Gold-free item receipt behavior and voluntary building demolition (no refund or claim) remain unchanged.

New public decoration placement still requires and consumes one `placementItemId`, now frozen as runtime `recoveryItem:{itemId,count:1}`. The shared Save5 parser rejects malformed present proof; unknown item IDs remain valid evidence. Content incompatibility recovers the frozen item, not the current type cost, and unknown items require definition restoration plus explicit collection. Ordinary reclaim also uses frozen proof after type changes/removal; the pre-existing missing-proof ordinary legacy reclaim path remains compatible. Starting/legacy missing-proof records acquire no proof and are preserved as unresolved originals when incompatible. Project4 and Save4-to-Save5 policy are unchanged; transient live readers/context are not serialized. Focused conservation coverage: `test/spatialRecoveryRights.test.ts`, plus retained H1/H2/housing/placement regressions.

Task3 introduces optional runtime `PlaySession.lifeRecovery`: `{nextSequence, claims}`. `src/project/lifeRecovery.ts` owns deterministic `recovery:N` IDs, draft-atomic source removal/claim creation and explicit `collectLifeRecoveryClaim` payout/removal. It checks 4096 claims, 64 distinct items per claim, safe positive item counts capped by ITEM_QUANTITY_MAX, 64 KiB UTF-8 unresolved JSON and 8 MiB total recovery JSON. Large proven quantities split; capacity or validation failure changes neither owner nor sequence. Unknown items retain raw source evidence and cannot pay until the item is defined and the player explicitly collects. Empty/unproven evidence never pays. The exported save-boundary predicate rejects rather than trims malformed/excess records.

`moveLifeRecoverySource` reads the actual named session owner, not caller-supplied quantities. Shipping and incomplete bundle records supply their own amounts; completed bundle receipts reject refunds. Maker cancellation accepts an explicit cutoff in the ORIGINAL job time basis and selects completed outputs or proven unfinished inputs. Unfinished legacy jobs without a frozen contract remain unresolved even when a current maker definition exists: its inputs are not historical payment evidence. Missing legacy definitions and old spatial/animal records become unresolved evidence, not guessed refunds. Task4 now wires automatic reconciliation, partial donation excess and claim persistence across all shared Save5 boundaries. Ledger UI remains a later task.

New maker jobs copy inputs actually consumed, promised outputs, duration and resolved `{dayStartHour,dayEndHour,daysPerSeason}`. Definition edits affect only the next job; legacy jobs without contracts still use the current definition. New contracts survive the existing compatible maker save path and are checked by `isMakerInstancesRecord`. Runtime spatial state types add optional `paymentReceipt:{gold,items}` and decoration `recoveryItem`; start/legacy placements invent neither. Payment capture and spatial refund policy are not wired by this foundation increment. Tests: `test/lifeRecovery.test.ts`, `test/p0Makers.test.ts`.

## Lossless life snapshot reconciliation (2026-09-06)

`src/project/lifeStateReconciliation.ts` owns `parseLifeState` and pure `reconcileLifeState` (also exported from `lifeRecovery.ts`). The shared writer clones live state, restores persistent placeables/plots/chests before checking spatial placements, reconciles animals, then shipping/bundles/makers. Apply validates a separate draft and commits only by returning that draft. Compatible makers are synchronized at restored game time only after reconciliation. Natural game minutes, authored time advances, and set-time also synchronize through the existing clock/day authorities; ledger rendering never advances jobs. Cancellations use each frozen job's original calendar before normalizing the restored date to current settings.

Unknown legacy records and rejected placements/animals/placeables retain complete unresolved JSON with zero inferred payout. A recognizable placeable prefix does not authorize dropping opaque fields: unsupported fields such as legacy paid/oldJob data cause whole-record quarantine before reconstruction. The shared life parser rejects an invalid farm-plot collection before any lossy projection; one malformed neighbor cannot erase valid persistent occupancy and permit a colliding placement. This same rejection protects writer/autosave and the whole-day draft. Runtime animal limits quarantine excess saved owners instead of dropping the suffix; explicitly empty saved animals/placements do not resurrect authored starts. Runtime spatial payment/decor receipts survive the codec; payment capture, linked housing and spatial receipt payout remain later spatial transaction work. Missing legacy homes still follow the existing explicit legacy-building compatibility path, not inferred spatial links.

Disabled/deleted/ineligible shipping becomes claims before filtering. Incomplete bundle contribution5 against requirement2 retains progress2 and claims only3; completed/reward-applied IDs remain tombstones even when definitions vanish, as do dormant region/recipe rights. Saving never pays claims. Re-reading/re-saving a reconciled session cannot reissue consumed owners, and successful receipt never rewinds `nextSequence`.

Numeric contribution parsing and retained/excess accumulation use own-key dictionaries: JSON keys such as `__proto__`, `constructor`, and `toString` are not invalid item IDs. The immediate claim transfer uses own inventory counts and safe inventory accumulation/normalization so a successful receipt cannot erase a reserved-key stack. Unknown IDs still retain their complete original source in unresolved claims with no automatic or guessed payout. `test/lifeRecoveryRecordKeys.test.ts` covers exact raw JSON, compatible and excess contributions, unknown evidence, existing stacks, retry conservation, and rollback; task30 evidence includes the actual writer -> Storage reader -> apply -> repeated reconciliation/roundtrip probe.

Finite-use cursors use the same own-key numeric dictionaries in both inventory transition accumulators and the Storage cursor parser. Explicit shipping claim3 collection onto inventory1 preserves the oldest copy's own charge2, including `__proto__`; normalization, writer, reader and apply retain that cursor. Fresh ordinary/reserved-name limit5 consumables record numeric charges1..4 and deplete on successful use5. FIFO tail removal, limits and failed-transaction rollback remain unchanged. The record-key regression and task30 `finite-use/` public Storage probe cover these cases without inferring missing charges or changing the save schema.

Both manual and automatic readers reject duplicate JSON keys before last-key-wins parsing can erase a claim owner. Malformed counts, claim bounds, unsafe sequences and oversized raw/total evidence reject the load without modifying its disk bytes. Recovery failures report typed source kind/ID; the day transition's `recovery` stage runs on the same whole-day draft, so any later stage failure also discards its claims and calendar changes. Tests: `test/lifeRecoveryPersistence.test.ts`, P0/P1/P2 persistence/day tests, `test/lifeRecovery.test.ts`; public Storage/import probe under task4 evidence. Full51 player/editor journeys are not covered by these module contracts.

## Esc 메뉴 작업 프레임 (2026-09-05)

이 절이 아래의 edge-dock / 상단 파티 고정 / 하위 창 숨김 설명을 대체한다.

- `playerStatusMenu.ts` 는 320×240 논리 스테이지 안에 단일 프레임을 그린다. 가장자리에서 맵은
  계속 보이고, 헤더(위치·소지금·시간), 좌측 여섯 메뉴, 우측 작업 본문, 하단 조작 안내를 분리한다.
  파티 개요는 파티 그룹에만 나온다. 아이템 대상은 해당 행 안에 얼굴·현재 HP/MP·예상 회복량을
  표시하고, 장비 능력치 비교는 후보 옆 설명 영역에 둔다.
- 메인 단계에서도 본문 미리보기는 보인다(`inert`로 입력만 막는다). ↑↓/WS는 목록,
  →/D는 본문 진입, ←/A는 메뉴로 포커스 복귀, Enter/Z는 결정, Esc/X는 기존 한 단계 취소다.
  좌우키가 목록의 위아래 이동을 대신하지 않는다. 영역 간 이동·다시 열기에서 커서를 유지한다.
- `playerStatusMenuDetailRenderer.updateStatusMenuDetailSelection` 이 커서 이동 때 설명 영역만
  갱신한다. 목록 DOM·스크롤·포커스를 보존한다. 페이지 이동 때도 명령 레일 DOM은 보존한다.
- `playerItemUse.menuItemUnavailableReason` / `previewMenuItemTarget` 는 실제 실행의
  `activeItemEffects`, 사용 장소, 대상 제한, 회복·상태 효과 판정을 공유한다. 미리보기는 세션과
  난수 상태를 바꾸지 않는다. 사용 불가 항목도 커서로 설명을 읽을 수 있고 결정 시 이유를 보여준다.
  회복약 사용 후 수량이 남으면 대상과 커서를 유지하며, 마지막 한 개를 쓰면 목록으로 돌아간다.
- `src/player/playerStatusMenuMotion.ts` 가 Esc 전용 모션과 시간을 소유한다. 열기 180ms, 닫기 120ms,
  본문 전환 120ms, 커서 80ms, 수치 220ms. 일반 title/shop juice의 루트 변형을 적용하지 않는다.
  닫기는 최종 opacity 0을 유지하고 Animation.finished 뒤 해당 요소만 제거한다. 이전 메뉴의
  완료 콜백이 다시 연 메뉴를 지우면 안 된다. closing 표시는 필드 입력 소유권을 즉시 반환한다.
  모션 감소에서는 이동 없이 40ms 페이드만 쓴다.
- 검증: `npm run qa:runtime -- --scenario esc-menu`,
  `npx playwright test --config playwright.runtime.config.ts test/runtime/esc-menu.spec.ts`.
  전용 시나리오는 과거 QA 프로젝트의 사본에서 회복약 종류를 medicine으로 명시한다.
  과거 item-runtime-qa-v3.json의 normalGoods 회복약은 저장된 회복 필드가 있어도 사용할 수 없다.
  이것은 테스트 입력 보정이며 저작 게임이나 원격 프로젝트를 변경하지 않는다.

# Runtime Sessions & State

## 아이템 종류 전환과 실행 효과 (2026-09-05)

`src/project/itemUsage.ts`는 보관된 ItemRecord와 현재 종류의 활성 효과를 구분한다. `playerItemUse`와 `battle/runtime`은 활성 투영만 사용하며, `itemAllowsMenu`/`itemAllowsBattle`은 사용 시점과 지원 종류를 함께 검사한다. 이전 책의 learnedSkillId가 약으로 바꾼 뒤 학습을 실행하거나, 일반 물품이 이전 회복 효과를 실행하면 회귀다. 부활은 필드 전용이며 포획은 특수 아이템의 전투 사용 조건을 따른다. 특수 아이템의 스킬 없는 상태 부여는 유지한다. 저장 스키마는 그대로라 이전 종류로 돌아가면 보관된 설정을 다시 편집할 수 있다. UI는 미지원 특수 아이템의 배우·직업 제한을 제공하지 않는다.

장비 상태 방어는 resist 행만 집계한다. 기존 inflict 행 하나가 다른 장비의 저항을 끄지 않으며, 편집기에서 명시적으로 저항으로 전환할 수 있다. 테스트: `itemEquipmentAuthoringTrust`, `itemRuntimeUsability`, `equipmentCatalogRuntimeAxes`.

필드 메뉴 대상 판정은 `playerItemUse.canUseMenuItemOnActor`를 사용한다. HP/MP 회복뿐 아니라 상태 해제·부여, 책·씨앗, 배우·현재 직업 제한을 실제 사용 경로와 같이 판정하며, 미리보기는 RNG나 소지품을 바꾸지 않는다. `playerStatusMenuDetails`는 `activeItemEffects`를 적용한 뒤 대상 화면을 선택한다. 책·씨앗은 저장된 scope가 `none`이어도 파티원을 고르고, 일반 물품은 보관된 회복/돌봄 설정으로 대상 화면을 열지 않는다. 스위치 아이템은 이전 종류의 아군 scope가 남아 있어도 대상 선택 없이 바로 장치를 작동한다. 과거 HP/MP 전용 판정은 체력이 가득 찬 파티원의 해독·강화까지 모두 막았다. 회귀: `test/playerMenuItemTargets.test.ts`, `test/runtime/status-menu-adversarial.spec.ts`.


Session state, save slots, farming, friendship, calendar, lighting, weather, field spawns, and NPC schedules.

## Roguelike run kernel and field rooms (Phase 0–3, 2026-08-24)

- `PlaySession.roguelikeRun` is optional runtime-only state, not authored project data. Version 1 stores `{ version, runId, seed, floor, status, flags, roomResetCounts, roomEventGenerationKeys, currentRoomId? }`; status is `active | completed | failed | abandoned`. `roomEventGenerationKeys` is saved so loading in the same room generation does not resurrect consumed one-shot events; old v1 saves without it normalize to `{}`. The pure authority is `src/project/roguelikeRun.ts`.
- `runControl` event commands own the lifecycle: `start`, `advance`, `end`, `setFlag`, and `resetRoom`. Start normalizes the seed to uint32 and the floor to 1–9999; advance is forward-only (minimum +1) and clamps at 9999. When start omits `seed`, the interpreter consumes the session `misc` RNG stream, so save/load still controls the random sequence. Mutating commands are no-ops once no active run exists.
- `resetRoom` increments `roomResetCounts[roomId]`; an omitted id uses `GameMap.roguelikeRoom.roomId` when configured and otherwise the current map id. Play mode and `run_scene_test` consume the generation key `{ runId, seed, floor, roomId, resetCount }` and rebuild field-spawn runtime whenever it changes. Start, floor advance, run end, and room reset therefore refresh field encounters, action-combat enemy HP/projectiles, and eligible authored event runtime surfaces at the same boundary.
- Optional `GameMap.roguelikeRoom` assigns deterministic encounter slots to existing `fieldSpawns`. Each slot chooses one floor-eligible choice by seeded weighted selection; spawns not named by any slot remain always active. Identical run seed/floor/room/reset inputs produce the same selection. During an active run, field-spawn kills are room-generation state and do not write permanent `killedFieldSpawns` survival progress.
- Phase 3 resets each `roguelikeRoom` map's authored event self switches and `Erase Event` membership when its room generation changes, then rebuilds event positions, auto/parallel/page-route state, graphics overrides, and autonomous movers in both play mode and `run_scene_test`. `resetEventState:false` preserves those event states. It deliberately does **not** reset global switches, inventory, storage-chest contents, map tiles, or other session systems; use self-switch/`Erase Event` one-shot pages for conventional regenerating room loot.
- `run` conditions support active/inactive, floor comparison, boolean run flags, and terminal result. The evaluator is shared by interpreter forks, page resolution, story explanation, and troop-condition evaluation.
- Save snapshots preserve and normalize the optional run state. Legacy saves omit it safely; malformed or unknown versions are dropped instead of entering live session state.

## P1 daily-weather transition authority (2026-08-25)

- `startSession` resolves the initial calendar day's deterministic weather after the session RNG seed exists and mirrors it to `m2Runtime.screen.weather`, so the first playable frame and the weather render layer agree.
- `transitionToNextDay` runs `shipping → calendar → dailyWeather → rainWatering → farm → energy → makers → animals` on its cloned draft. `applyDailyWeatherForDate` resolves the destination day, `waterFarmPlotsForDailyWeather` waters rain/storm plots for that exact day key, and only then may `syncFarmPlotsToDate` grow crops. Disabling the package clears both `PlaySession.dailyWeather` and the Phaser screen target (`none`).
- The receipt includes `weather` and `wateredPlots`. Any later stage failure discards the whole draft, including weather, visual state, watering, and growth.
- Forecast calls remain pure and never populate a save field or consume `session.rng.streams`; current-day weather alone is saved.
- Focused integration coverage: `test/p1DayTransitionIntegration.test.ts`, `test/p1WeatherCalendar.test.ts`, `test/p1WeatherDayTransition.test.ts`, plus the P0 transition rollback/control-flow suites.
- `lifeCalendarHudLines` derives compact runtime HUD lines from the same session/project authority: year/season/day/time, current weather, the authored number of future forecast days, and the nearest reachable character/event birthday. Birthdays beyond a custom `daysPerSeason` are omitted. `playSceneMapRuntime.syncRuntimeState` publishes these lines and `RuntimeDomOverlay` renders them as a bounded multiline glass panel.

## Event audio state (U14)

- `playAudioCommand` forwards optional channel, normalized per-track `volume` and `fadeInMs` through the engine's unlock queue. Gain remains independent of user group-volume changes and survives loop-channel save parsing/resume. Omitted gain means 1, including same-track ordinary play and map entry; the engine resets an earlier layer gain without restarting the element, matching the omitted gain saved in session state. Explicit gains retain their prior meaning.
- `BattleAudioSession.fieldBgm` retains the complete immutable `AudioTrackState`, including loop and volume. Battle exit restores that same track to both the engine and session, including volume 0 and same-track battles. Engine restore explicitly targets BGM, so a saved loop flag cannot redirect the request to SE.
- Blocking and parallel scene consumers preserve the channel; native battle callbacks also carry playback options and the optional stop channel. A BGM-only stop leaves BGS/ME/SE session state and playback untouched.
- System-audio overrides belong to `session.m2Runtime.system`, with only `system_audio:field`, `:battle`, `:defeat` and `:escape` persisted in the optional save `systemAudio` record. No project record is mutated, and old saves may omit it. The battle DOM/juice path receives its owning audio session explicitly; there is no module-global result override or enter/exit cleanup dependency.
- Field overrides replace only the project fallback, never an explicit map/ancestor custom track or silence. Battle entry and result cues resolve their corresponding session override at consumption time. This repair does not expand unsupported M2 troop-command execution or unrelated battle result lifecycles.

## Session state & life-sim
- **NPC 시간표 스로틀은 초과분을 이월한다 (2026-08-30, PR #286).** `npcSchedules.ts:59-61` 은 누산기를 0 으로 리셋하지 않고 `min(elapsed - TICK, TICK - 1)` 로 이월한다. 0 리셋은 실효 주기를 `ceil(TICK/frameMs) × frameMs` 로 늘려 프레임이 길어질 때 최대 2배가 된다(frameMs 99 → **198ms**) — 그 상황이 바로 이 스로틀이 겨냥한 큰 맵·다수 NPC 다. 이월은 한 주기 미만으로 잘라 오래 멈춘 뒤 몰아 돌지 않게 한다.
- **erase 된 이벤트는 시간표 재구성에서 빠진다 (2026-08-30, PR #286).** 공유 판정 `runtimeEventGone(session, mapId, eventId)`(`project/runtimeEventState.ts:253`, 세션의 `erasedEventIds`/`removedEventIds` 를 본다)를 `npcSchedules.ts:87` 이 건너뛰기 조건으로 쓴다. 이게 없으면 지워진 NPC 를 매 점검마다 다시 만들려 해서 이벤트 레이어가 100ms 주기로 파괴·재생성을 반복했다. `registerScheduleRoute` 도 mover 를 못 만들면 `false` 를 돌려 "바뀐 것 없음" 을 정직하게 보고한다.
- **막힌 걸음 재시도는 계산된 경로에만 적용된다 (2026-08-30, PR #286).** `AutonomousMover.retryBlockedSteps`(런타임 전용, 세이브에 없음)가 `true` 일 때만 막힌 걸음을 소비하지 않고 다시 시도한다(`playSceneAutonomous.ts:278`). A* 로 계산한 경로는 **절대 방향 배열**이라 한 걸음을 잃으면 이후 전부 밀리기 때문이다. 작가가 쓴 이동 경로는 대상이 아니다 — `playScenePageMoveRoutes.ts:109` 가 `movement.type === "living"` 에만 켠다. 영구 정지를 막기 위해 `MAX_BLOCKED_STEP_RETRIES = 8` 을 넘기면 걸음을 소비한다. 즉 **완전 제거가 아니라 상한 있는 완화**이고, 0.6초 이상 막히면 밀림이 다시 생긴다.
- **Discrete relationship state (2026-08-30):** `src/project/relationshipState.ts` is the authority for `single | dating | engaged | married`, an ordered enum kept independent of the `friendship` number. The session field is `relationships`, keyed by the same social key as friendship (`resolveSocialKey`, so an event without a linked `characterId` is fail-closed), and an absent key derives `single` rather than being stored. `setRelationship` is the only mutator command; it executes in both the interpreter (`commandCatalog.ts`) and the battle executor (`battleEvents.ts`), and `relationships` is listed in `BATTLE_CONDITION_SESSION_STATE_FIELDS` so the play-to-battle bridge is contract-checked. The condition `relationshipAtLeast` compares by rank, so "at least dating" is authorable the way `friendshipAtLeast` already is.
- **전투 write-back 은 부분집합이다.** 전투 실행자는 `state.relationshipWrites` 에 자신이 쓴 키만 모으고 `BattleEventStateSnapshot.relationships` 는 그 부분집합만 싣는다. 관계 지도 전체를 실으면 전투 중 맵 경로에서 지운 관계를 write-back 이 되살린다 — `setRelationshipState` 가 `single` 을 **삭제**로 처리하기 때문에 `flags`/`timers` 와 달리 병합만으로는 안전하지 않다. `applyBattleEventStateToSession` 도 직접 대입이 아니라 `setRelationshipState` 를 지나므로 전투에서 `single` 로 되돌리면 항목이 삭제되고, 맵 경로와 저장 정규화기(`single` 을 저장하지 않음)와 어긋나지 않는다. 계약 테스트는 `test/relationshipBattleWriteBack.test.ts` 이며 손으로 만든 스냅숏이 아니라 실제 `createBattleRuntime` 을 지난다.
- Because a string enum has no `clamp` analogue, `normalizeRelationships` **drops** out-of-enum entries on load instead of passing them through: an unknown value would make `relationshipRank` return `-1` and turn every at-least comparison true. `getRelationshipState` defends again on read, so the guard is deliberately doubled. Saves are additive-optional at all four boundaries (`saveSlots.ts` type / writer / parser / apply) with no `SCHEMA_VERSION` bump, so existing saves open as `single`.
- **P0 life-sim runtime (2026-08-24):** optional authored `system.energy`, `system.shipping`, `system.bundles`, `system.worldUnlocks`, and `system.makers` initialize matching `PlaySession` state without forcing the package on legacy projects. Pure rule authorities are `src/project/energy.ts`, `shipping.ts`, `bundles.ts`, `lifeSkillProgress.ts`, and `makers.ts`; PlayScene and menu integrations call them instead of duplicating their rules. Shipping settles a `dayKey` exactly once through `resolveSellPrice`, caps gold at `GOLD_MAX`, retains bounded immutable summaries, and treats an empty queue as a real exact-once settlement. Bundle completion consumes partial contributions atomically and applies gold/item/switch/region/recipe rewards once. Maker deadlines use the monotonic playable-day index from `absoluteGameMinutes`; processing/ready deadlines are absolute minutes and survive a mid-process save.
- `src/player/dayTransition.ts` owns the atomic next-day receipt. The fixed order is prior-day shipping settlement -> calendar advance -> farm growth -> new-day energy restoration -> maker advancement. Manual sleep, forced midnight, ordinary clock crossings, event `advanceTime`, and `sceneTestRunner` day boundaries all route through this authority. An authored `energy.restorePerDay: 0` is a successful no-op and cannot abort the remaining stages. `PlaySession.dayTransitionLastDayKey` makes a repeated source-day request fail closed and is preserved by manual slots, autosaves, and checkpoints. A stale shipping/maker record aborts the draft without changing live session state; maker-disabled projects skip absolute-minute calculation, while an enabled maker package turns absolute-minute overflow into an atomic `{ok:false, reason:"makers"}` receipt instead of throwing. Scene callers expose a `day-transition-error` overlay instead of refreshing or fading as though sleep succeeded. A throwing `onDayEnd` hook restores the pre-hook session, refreshes/syncs the restored error surfaces, and fades back in. Blocking event interpretation stops at a failed sleep. Parallel time commands keep their Promise on the process and resume the interpreter only after success; false/rejected results stop that process on the current active page, skip later commands, and retain the visible error surface. Other fire-and-forget paths also observe failures instead of producing unhandled rejections.
- P0 session fields are `energy`, `shippingQueue` / `shippingLastSettledDayKey` / `shippingHistory`, `dayTransitionLastDayKey`, `bundleContributions` / `completedBundleIds` / `bundleRewardAppliedIds`, `unlockedRegionIds`, `unlockedRecipeIds`, and `makerInstances`. `startSession` initializes empty progress for legacy projects and authored initial energy when enabled. Manual slots, autosaves, and checkpoints all use `createSaveSnapshot` / `applySaveSnapshot`, so these fields plus the pre-existing `lifeSkills` and shop economy fields share one persistence path. Legacy schema-v3 snapshots may omit every additive field. Save writer/parser/direct-apply sanitize gold, loyalty spend, sold/bought counts, and mileage through the shared safe-integer `0..GOLD_MAX` contract; malformed required gold becomes `0` and malformed optional ledger entries are dropped. Save parsing also removes zero-count shipping rows, non-canonical transition day keys, non-safe-integer `gameTime` fields, and arithmetically inconsistent settlement histories; history entries must satisfy `subtotal=count*unitPrice`, capped total aggregation, and `credited <= total`. Snapshot create/apply additionally discard a normalized `gameTime` whose project-specific `absoluteGameMinutes` would exceed the safe-integer range, leaving `startSession`'s initial clock as the load fallback. Applying a snapshot retains `dayTransitionLastDayKey` only when it is the immediately preceding calendar day under the current project's `daysPerSeason`; current/future/non-adjacent poison cursors are discarded. Applying also filters shipping queues, bundle progress/completion, unlock ids, and maker instances against the current authored definitions, so deleting a definition cannot revive stale runtime state. Shipping withdrawal repeats the same item/allow-list eligibility check as deposit before returning inventory.
- **P1 weather/animal session foundation (2026-08-25):** `startSession` converts each authored `project.session.farmAnimals` row into `PlaySession.farmAnimals[instanceId]` with zero friendship/progress/ready count while retaining name and optional event/building ids. `PlaySession.dailyWeather` stores one resolved day only. Both fields round-trip through manual save, autosave, and checkpoint snapshots; save writer, parser, and direct apply reject non-canonical day keys, unknown weather kinds, non-finite/unsafe counters, over-cap friendship/counts, mismatched record keys, and unknown current-project species. Applying a timed save recomputes current weather from the restored seed/date instead of trusting a stale saved `dayKey`; untimed compatible saves preserve their single normalized weather row. Animal restore uses stable authored/saved order and unassigns capacity overflow rather than loading an invalid herd.
- `src/project/dailyWeather.ts` is the P1 daily-weather authority. `resolveDailyWeatherForDate` hashes only the normalized session seed plus `calendarDayKey`, then samples the current season's bounded weighted rules with a local PRNG; it never reads or advances `session.rng.streams`. `dailyWeatherForecast` derives the next `forecastDays` days (tomorrow first), respects authored `daysPerSeason` across season/year boundaries, and stores nothing. Missing/disabled packages return no forecast, while an enabled empty/all-invalid/all-zero table resolves to `{kind:"none", intensity:0}`. `applyDailyWeatherForDate` writes only that one resolved date to `PlaySession.dailyWeather` and clears stale state when the package is disabled.
- `src/player/farmingWeather.ts` owns the narrow weather-to-farming handoff. `waterFarmPlotsForDailyWeather` waters eligible non-dead tilled plots only when the resolved weather is positive-intensity rain/storm and its `dayKey` exactly matches the destination date. Day-transition integration must call `applyDailyWeatherForDate` and this helper after calendar advance but before `syncFarmPlotsToDate`; stale saved weather is a no-op. The helper is intentionally separate from `dayTransition.ts` until the integration owner updates the transition receipt/stage contract.
- **P1 farm-animal runtime authority (2026-08-25):** `src/project/farmAnimals.ts` is the deterministic session-only authority for compatible building assignment/moves, feed, pet, daily production, and ready-product collection. Every operation validates species/building/item references plus the complete live herd before mutation. Assignment excludes the moving animal from destination capacity; feed consumes the species feed item before stamping its canonical day receipt; pet clamps friendship to 1000; both reject a repeated/future day and late care after that day's production cursor. Daily advance preflights the whole pending herd, requires both same-day feed and pet receipts to advance cadence, pauses progress on missed care, stamps `lastAdvancedDayKey` exactly once, and rejects any product-count overflow without advancing another animal. Collection preflights the destination stack and commits inventory plus `readyProductCount=0` together. Empty authored arrays are a successful no-op package. `dayTransition.ts` runs this as the final `animals` stage for the source-day care key, after makers; failure discards the complete draft and reports `{reason:"animals", stage:"animals"}`. PlayScene care UI is a separate surface.
- Farm interactions simulate the full target area on a session draft, then charge `ceil(successfulTiles * energyMultiplier)` and award 10 XP per successful crop harvest, rock mine, or tree chop to the matching authored life skill. Insufficient energy or invalid life-skill progress commits no tile, placeable, inventory, energy, or XP mutation. `system.itemUpgrades[].capability` supplies the equipped upgraded tool's centered `areaWidth` / `areaHeight` and energy multiplier; legacy/no-capability tools remain 1x1 / 1.0. `system.craftRecipes[].requiresUnlock:true` gates both `canCraft` and `craftRecipe` on `session.unlockedRecipeIds`.
- The optional status-menu record command `생활 장부` is visible when at least one life-sim package is authored. Legacy P0/P1 projects keep the keyboard/pointer-accessible `출하`, `꾸러미`, `생활 기술`, `가공 설비`, and `동물 돌봄` tabs; authored P2 projects append `수집 도감` and `박물관`. The collection tab summarizes discovered/shipped/caught/donated state with the generated `foraging-card.png`; museum actions invoke `donateMuseumItem`, so inventory consumption, collection state, and all newly qualified exact-once rewards commit atomically. Long names wrap; empty/deleted-definition rows remain readable and non-mutating.
- P2 runtime authorities are `fishing.ts`, `seasonalForage.ts`, `collections.ts`, and `museum.ts`. Fishing preview never consumes RNG; a successful catch commits the dedicated fishing cursor, energy, inventory, caught/discovered counters, and XP together. Daily forage placement is statelessly derived from seed + day key, stored as generated placeables, cleaned at season/expiry boundaries, and advanced inside the canonical day transition. Shipment settlement is the only authority that increments shipped counts; donation receipts prevent reward replay.

- Session state is the mutable play save for a running game. It includes switches, variables, timers, inventory, party state, positions, flags, and other runtime-only values; `src/project` data should be treated as the source project definition, not the live session.
- Calendar/clock is an **optional** authored package on `system.timeSystem` (Database → 시간 시스템, or `configure_time_system`). If omitted or `enabled:false`, play mode must not tick a wall clock, render the time HUD as live calendar, or treat time conditions as enabled behavior. When enabled, fields define the **clock primitive only** (not a forced life-sim day loop): `minutesPerRealSecond` (flow rate), `dayStartHour` / `dayEndHour` (day boundary for rollover/sleep), optional `daysPerSeason` (1–99, default 28) for calendar length, optional `forceSleep` and `onDayEnd` common event. Runtime state is `PlaySession.gameTime` `{ minute, hour, day, season, year }`. Helpers: `resolveTimeSystem`, `daysPerSeasonOf`, `calendarDayKey`, `advanceGameTime` / `sleepGameTimeUntilMorning`. Legacy saves without `gameTime` initialize to year 1 spring day 1 at `dayStartHour` when time is on; modern save slots preserve `gameTime` exactly. Consumers (NPC schedule, farm day tick, daily gift/talk keys, seasonal shop) **opt into** this clock when present — they are not a mandatory DayLoop OS.

- **Authoring tools (opt-in, not a forced Stardew loop):** `system.toolActions` optional tool→world rules (default legacy hoe till / wateringCan water when absent). `session.equippedToolItemId` prefers equipped hand tool then inventory. `system.craftRecipes` pure craft API (`craftRecipe`). `session.chests` / `session.placeables` for chest storage and placed objects. `system.itemUpgrades` + `system.sellPrices` for upgrade rows and sell table. `make_villager` accepts `talkFriendship` and `friendshipUnlock` (D0 friendship pages). All packages no-op when empty/omitted. Runtime: farm interact resolves till/water via toolActions (strict hand when `equippedToolItemId` set); chop/mine harvest placeables kind tree/rock. Event commands `craftRecipe`, `applyItemUpgrade`, `equipTool`, `openChest` run pure APIs / UI. Storage chests: action-key on chest tile or `openChest` opens dual-pane deposit/withdraw UI (`playSceneChest`).
- Tool rules are ordered complete replacement tables, with four legacy defaults only when absent/empty. `resolveToolUseOnTile` validates integer map bounds, gives a row's `itemId` priority over its kind, and resolves empty conditions only against valid non-consumable farm tools. `toolRuleRequiresFarmable` is shared with the editor: omitted till/water restrictions are true; explicit false releases only the region restriction. Farming reuses terrain and static spatial occupancy authorities, so walls, chests, placements (including nonblocking decorations), unrelated placeables and overlapping assets still refuse. The target tree/rock itself is the only placeable occupancy exemption. Wide tools apply only to safe cells and remain draft-atomic for energy/XP failure. Held tools resolve authored till/water/harvest actions at each tile while preserving the legacy empty-hand cascade and seed planting region requirement. Mature crops must satisfy authored harvest rules if any exist; without harvest rules legacy harvesting remains. Task8's fish proof covers this same resolver only: task10 owns fishing/forage input and catch integration. Live-body placement safety remains the separately assigned task12 boundary.
- Task12 plot occupancy: `canOccupySpatialFootprint` in `src/project/spatialOccupancy.ts` includes actual `session.farmPlots` records. `interactWithFarmPlotSingle` in `src/player/farming.ts` removes only its target plot from a temporary occupancy view before calling that authority, preserving access for water/harvest while other plots and assets still reserve space. The session's plot records are not deleted by this preflight.

- NPC schedules are authored project data on `GameEvent.schedule`, while live activity and route progress live on `PlaySession.npcActivities` and `PlaySession.npcScheduleStates`. When `timeSystem` is enabled, `src/player/npcSchedules.ts` resolves the matching entry by `timePhase`, `hourRange`, `season`, and `dayRange`; there is no weekday support because `GameTime` does not model weekdays. Same-map targets walk through the existing autonomous mover/pathfinding, offscreen cross-map changes can relocate immediately through `eventLocations`, and visible-map exits route to an edge before relocation. Page conditions can consume the current activity through `npcActivity`.
- NPC friendship is runtime session state on `PlaySession.friendship?: { [npcKey]: 0..1000 }`. Social keys come from pure `resolveSocialKey(event, explicitNpcKey)` in `src/project/socialKey.ts`: explicit `npcKey` → trimmed `GameEvent.characterId` → **null** (never `event.id`). Self paths for `changeFriendship` / `getFriendship` / `friendshipAtLeast` hard-gate when null (no-op / 0 / false). Multi-map copies share one friendship slot when they share `characterId`. Activity stays event-scoped on `session.npcActivities[eventId]`. Save slots preserve `friendship`, `dailyGifts`, and `dailyTalks`. On project load, social events missing `characterId` are stamped `characterId = event.id` once (`stampCharacterIdsForSocialEvents` in validate). Presentation helpers live in `src/project/friendship.ts`: pure `friendshipTier` / optional `friendshipTierLabel` / `formatFriendshipFeedback` (gift dialogue suffix) and status-menu list helpers. Successful gifts append a short feedback line such as `호감 +80 (0/10)`. The status menu command / tool `relationships` (관계) lists only keys present in `session.friendship` with tier bars; when `project.characters[key].displayName` is set it shows that label instead of the raw key; empty state is `알려진 관계가 없습니다.` No dual-key/`event.id` social fallback.
- **Friendship milestone pattern (D0):** authors unlock story beats with existing page conditions only — no engine milestone runtime. Typical stack: low pages unrestricted; a higher page with `friendshipAtLeast { value:N }` (empty npcKey → this event's characterId) runs unlock dialogue once, then `setSelfSwitch A`; a follow-up page can use `selfSwitch A` (+ optional same friendship gate) for permanent lines. Activity remains event-scoped; social keys still only via `resolveSocialKey`.
- Gifts are enabled only when `system.giftSystem === true`. `isGiftableEvent(project, event)` requires **resolved** gift prefs/responses **and** a resolvable social key (`characterId`). Resolution helpers in `src/project/characterProfiles.ts`: `resolveGiftPrefs` / `resolveGiftResponses` use event-local fields when present, else `project.characters[characterId]` profile defaults (full object replace, no field merge). Action interaction shows the talk/gift/cancel menu, consumes one inventory item, applies loved +80, liked +45, neutral +20, or disliked -20, then records `dailyGifts[socialKey]` for the current `GameTime` day. The source stack must satisfy `isPositiveItemQuantity`, and `giveGiftToNpc` commits friendship plus the daily receipt only after the one-item debit succeeds; invalid/empty stacks leave the whole session unchanged. Without `gameTime`, the daily key is `"no-time"`. Battle empty-npcKey friendship remains fail-closed (no phantom map event). Opt-in talk friendship (`GameEvent.talkFriendship?: true | { delta? }`, default delta +10) is independent of gifts: action talk path calls `trySocialTalk` once per interaction, writes `dailyTalks[socialKey]` via `giftDayKey`, and appends `formatFriendshipFeedback` on success — never on the gift path.
- **Birthday gift multiplier:** `resolveBirthday(project, event)` prefers `event.socialCalendar.birthday` when set, else `project.characters[characterId].birthday` (day 1–28). When `session.gameTime` matches that season+day, `giveGiftToNpc` multiplies the preference Δ by `BIRTHDAY_GIFT_MULTIPLIER` (2) **before** `changeFriendship`. Without `gameTime` there is **no** birthday bonus (documented policy). Non-matching days keep base loved/liked/neutral/disliked deltas.
- **Identity package (Phase F, opt-in):** optional `project.characters?: Record<characterId, CharacterProfile>` with `displayName?`, `birthday?`, `giftPrefs?`, `giftResponses?`. No forced migration and no character-scoped schedule. Event fields always override profile defaults when present. Load/shape validates the optional map; gift item refs on profiles are checked like event giftPrefs.
- **Social shop discount bridge:** optional `GameEvent.socialShop?: { minFriendship: number; priceMultiplier: number }` on the merchant event. `resolveShopStock(project, session, command, merchantEvent)` applies the multiplier to buy prices when `resolveSocialKey(merchantEvent)` is non-null and `session.friendship[key] >= minFriendship`. No `characterId` ⇒ no discount. Omitted `socialShop` or insufficient bond leaves prices unchanged. Stock seasonal rules still run first; discount then scales resolved/DB prices (floor, min 0). Sell prices are not discounted.
- Shop commands can keep legacy `itemIds` behavior or author `stock?: [{ itemId, seasons?, priceOverride?, priceBySeason? }]`. When `timeSystem` is enabled, runtime shop resolution filters stock to the current season and applies `priceBySeason[currentSeason]` before `priceOverride`; when `timeSystem` is off, all authored stock entries are visible. Omitted `stock` must continue to use `itemIds` exactly as before.
- **Shop haggling / shopkeeper (2026-08-30):** `ShopEconomyConfig.haggleEnabled` turns the shop item confirm into a threshold haggle (`src/project/haggle.ts`). Verdicts are deterministic from `(itemId, merchantKey, dayKey, attemptIndex)`. Broken visits stick in `PlaySession.shopHaggleState` for that day. `economy.shopkeeperEnabled` runs `playShopkeeper`: a customer queue generated from the same hash, shelf stock in `shopShelf`, reputation in `shopReputation`, inverted `playerSells` core. Loyalty / dynamic markup / closing sale stack in `resolvePricedShopStock`. Restock uses `shouldRestock` + `shopLastRestockDayKey` / `shopMerchantGold`. Pawn sells write `shopPawnTickets`.
- **Shop merchant gold:** optional `shop.merchantGold` (default **100** via `resolveShopMerchantGold` / `DEFAULT_SHOP_MERCHANT_GOLD` in `shopStock.ts`). Each shop visit starts with that budget. Player **sell** to shop requires `merchantGold >= sellPrice*count` (sell price is half item price); on success merchant gold decreases. Player **buy** from shop increases merchant gold by the paid amount. Runtime UI shows remaining merchant gold in the gold panel (`shop-merchant-gold`). Editor field: `shop-merchant-gold` in `commandBodyCommerce.ts`. Not unlimited — omit field still means 100G, not infinite.
- Farming uses authored crop data plus session tile state. `database.crops[]` records define `{ id, name, seedItemId, harvestItemId, harvestCount, stages[{days}], seasons, regrow?, graphicStages? }`; item records can mark simple possession-only tools with `farmTool:"hoe"|"wateringCan"`. Map farmability is authored as `GameMap.farmableArea?: Rect[]`; do not write tilled/watered/crop state into tile layers or map overrides.
- **Stardew life demo (2026-08-24):** `createFarmingDemoProject()` authors the `별빛 농장 마을` loop: eight crops across spring/summer/fall, time + bed + seed/produce/ore shop, five `characterId`-backed residents with birthdays and loved/liked/disliked gift profiles, and a mine with bat/golem field-spawn lanes whose enemies reference valid species and item drops. The canonical remote demo id is `rpg-zzu-stardew-demo`; `npm run content:stardew:save` creates it through `saveProjectToLegacyDb`, reloads it, revalidates the contract, and writes `output/evidence/stardew/stardew-legacyDb.json`. Do not point this command at another demo id unless the caller explicitly sets the dedicated `OPRN_STARDEW_PROJECT_ID` override.
- Runtime life QA uses the current `window.__oprnDebug` / `window.__oprnInput` hooks, not the removed `__rpgzzu*` aliases. Hand-slot tests must resolve tools/seeds by the rendered item name because slots follow database item order and are not a stable fixed numeric contract. During non-empty dialogue, `runtime/touchpad.css` hides the virtual pad so choice buttons receive pointer input; the dialogue/choice surface itself remains touchable. The time HUD uses `--runtime-window-text` rather than editor `--text-1` so it stays legible over the dark clock background.
- Crop growth graphics are **derived at read time, never persisted**. `cropGraphicStages(crop)` (`src/project/farmModel.ts`) returns authored `graphicStages` verbatim when the key is present, and only when the key is absent resolves `crop_<slug>` (or `harvestItemId` `item_<slug>`) to the registered sprite `farming-crop-<slug>` in `FARMING_CROP_SPRITE_ASSETS`, emitting one stage per growth stage with `frame` clamped to `frameCount - 1` (extra stages repeat the last frame; `projectLint` warns with `opt-in:crop-stages-exceed-sprite-frames`, and skips crops that author their own stages). `normalizeCropRecord` **must not** write inferred stages into the record — serialize would bake unauthored art into the author's project and a slug collision would attach engine art permanently. `graphicStages: []` is the explicit "no art" opt-out and survives normalization. Consumers must call `cropGraphicStages`, not `crop.graphicStages`: `projectBundledTextureKeys` resolves derived ids the same way so the sheet still loads.
- **The last crop graphic is reserved for the harvest-ready stage.** `cropGraphicIndexForStage(graphicCount, growthStageCount, stage)` (`src/project/farmModel.ts`) picks the frame, not a plain `min(stage, len - 1)` clamp: when a crop ships as many graphics as growth stages (the demo potato: 2 stages, 2 frames), clamping makes the last *growing* stage and the *ready* stage the same picture — measured in a browser run, day 1 (not harvestable) and day 2 (harvestable) were pixel-identical (0/3120px), so the player sees a ripe-looking crop that refuses to be harvested. Growing stages therefore stop one frame short and only `stage >= crop.stages.length` gets the final frame. When the author supplies more graphics than growth stages (N+1) that wiring is honored as-is; a single graphic has nothing to reserve and is always used. `renderCropMarker` in `playSceneFarming.ts` must route through it.
- Live farm tiles are stored on `PlaySession.farmPlots?: { [mapId]: { [x,y]: FarmPlotState } }`, where each plot keeps `tilled`, `watered`, optional `cropId`, `plantedDay`, `stage`, `dead`, and `growthDays`. Save slots preserve this state and legacy saves may omit it. Play map rendering composes till/water/crop overlays from session state over the authored map: `renderFarmOverlays` draws tilled soil as the real `builtin_farmland` autotile (shaped from a synthetic view over the tilled plot set — 밭 상태는 세션 전용이므로 맵 타일 데이터를 쓰지 않는다, `map.lowerTiles` is never mutated), watered soil as a single translucent dark tint on top, and crops as their sprite stage (no debug text labels).
- Farm action handling is deterministic: action on farmable tiles performs hoe tilling if the player owns a hoe item, plants the first in-order crop whose seed item is owned and season-valid, waters with a watering-can item, or harvests a ready crop. Harvest grants the normal inventory item, so existing shop selling handles crops as ordinary `ItemRecord`s.
- **"손에 든 것" 은 보유분만이다.** `heldToolItemId` (`src/project/toolActions.ts`) is the single definition: `equippedToolItemId` counts only while `inventory[id] > 0`, matching the hand-slot HUD (`handSlotEntries`). `farmIntentForHand`, `handSeedCrop`, `resolveEquippedOrInventoryToolItemId`, and `ruleMatchesInventory` all route through it — otherwise planting the last seed leaves a stale equipped id that shows 「빈 손」 while still forcing a plant intent and blocking every tool resolution (water/till silently fail).
- Intent-driven farm interaction (`interactWithIntent`) resolves in a fixed order: plots that only a hoe can fix (`dead`, or a `cropId` missing from the database) are handled first — `till` clears them, every other intent returns `plot-needs-clearing` / `missing-crop` whose copy points at the hoe; then a **ready crop is harvested regardless of what is in hand** (`farmIntentForHand` never emits `harvest`, so keying strictly on intent soft-locks the plot behind the empty hand); then the intent itself runs. Plant on an untilled plot reports `plot-needs-tilling`, not `missing-hoe` — the player may own the hoe.
- Runtime overlay draws only in-bounds plots of the current map: `renderFarmOverlays` skips session plot keys outside `map.width`/`map.height` so a shrunken map does not paint stale soil off-grid.
- Field key handling: `isInputCapturingSurfaceActive` (`src/player/keyBindings.ts`) owns the list of play-stage surfaces that swallow keys (`dialogue-box`, `runtime-choices`, `runtime-input-number`, `runtime-name-entry`). Name entry **must** stay in that list — it types into a hidden input without `preventDefault`, so digits would reach the global handler and re-equip the hand slot mid-name. Do not re-implement the selector in a surface.
- Demo item overrides merge, never replace: `upsertDemoItems` (`defaultProject.ts`) applies a partial patch on top of the existing catalog record, so demo-authored fields (name/price/`farmTool`) win while CC0 catalog art (`iconResourceId`/`imageResourceId`) and descriptions survive. Wholesale replacement blanks item icons in shops and inventory.
- The zone-feedback toast line prefers a live `m2Runtime.ui` toast over the scene-local transient farm message (`zoneFeedback.resultFrom`). A checkpoint toast appears once and expires on `nowMs`; a farm ignore reason is re-triggerable by pressing the action key again, so the rare message wins the line.
- Daily farm growth runs through the day-end/sleep path after the optional `system.timeSystem.onDayEnd` hook and uses the next morning season for death checks. Watered living crops gain one `growthDays` and recompute `stage`; unwatered crops do not grow; all watered flags reset; out-of-season crops become `dead`. `advanceCropGrowth {days}` is the debug/event command / tool that applies the same crop-growth loop without moving the calendar.
- Monster collection session state lives on `PlaySession.monsterInstances`, `monsterParty`, and `monsterBox`. `monsterParty` is capped at six instance ids, overflow routes to `monsterBox`, and legacy saves that omit all three fields must load as empty collections. Monster instances store deterministic IVs, level/EXP/friendship, optional nickname, species id, `caughtAt`, plus optional `currentHp`, `stateIds`, `stateTurns`, `skillIds`, and `skillPp`; battle exit and capture write the live HP/status/move/PP snapshot back instead of healing or rehydrating it away. `pendingSkillIds` holds fifth-and-later learned moves until the player explicitly replaces one of the active four or rejects the pending move; the field status-menu monster detail exposes both actions. Recovery centers restore HP, clear major status, and refill finite PP. All fields are optional so legacy saves remain loadable, and save slots preserve them structurally.
- `PlaySession.actorSkillPp` is the save-compatible PP map for the legacy non-monster actor fallback under `battleModel:"gen1"`. `playSceneBattle` passes it into `actorBattlers`, battle exit writes it back, and save parsing validates/roundtrips it. Monster-party PP remains authoritative on each `MonsterInstance.skillPp`.
- Gen1 field poison is persistent session behavior, not a map effect: `applyGen1FieldPoisonStep` runs after a completed player tile step, ticks every fourth monster-party step, deals 1 HP to poisoned party monsters, and stops at 1 HP rather than fainting them. `PlaySession.monsterFieldPoisonSteps` stores the modulo counter across save/load; non-Gen1 projects and empty parties do not advance it.
- Out-of-battle monster care is data-driven: optional `ItemRecord.careProfile` (`feed`|`toy`, `friendshipDelta`, optional `expDelta`) and optional `system.monsterCare` (`stepsPerTick` default 50, `walkFriendship`/`walkExp` default 1, `dailyCareCap` default 30). `applyCareItem` targets party monsters only (box rejected), requires an `isPositiveItemQuantity` source stack, and consumes one inventory item before committing friendship/EXP; a rejected or failed debit leaves inventory and monster state unchanged. Successful friendship is clamped via `clampFriendship` (0..1000). `applyWalkCareTicks` accumulates `PlaySession.monsterCareSteps` and, every `stepsPerTick` player tile steps (hooked after `recordFollowerPlayerStep` in movement), grants walk friendship/exp to each party monster while under the daily walk-friendship cap tracked in `PlaySession.monsterCareDaily` by `giftDayKey` (calendar day or `no-time`). Both care counters round-trip through save slots.
- Session RNG is runtime state. `PlaySession.rng` stores one session seed plus derived `encounter`, `battle`, `movement`, and `misc` stream states from `src/util/rng.ts`; gameplay code should consume it through `nextSessionRandom(session, stream)` so save/load resumes the sequence. Legacy saves without `rng` are accepted and assigned a new compatible RNG state during load.
- Stream ownership: random encounters and troop picks use `encounter`; battle damage variance, hit/critical rolls, escape, state rolls, and drops use `battle`; autonomous NPC random move/turn route choices use `movement`; miscellaneous runtime commands such as weighted branch selection use `misc`.
- `GameMap.encounterTable` is the authored hunting encounter table. When present, it takes priority over legacy `troopIds`; entries use integer `weight` plus optional switch, variable `atLeast`, party-level, tile-rect `region`, `timePhase`, and `season` conditions. Runtime filtering uses the player's current tile, party's highest level, and optional calendar state, then consumes the existing `encounter` RNG stream for weighted troop selection.
- `GameMap.fieldSpawns` is authored field-monster spawn data. `src/player/fieldSpawns.ts` creates runtime-only event instances with deterministic fixed-step respawn, passable-cell scanning inside `area`, optional chase movement, and contact battle handoff. Spawn runtime state is intentionally not written to save snapshots; load/map entry starts from initial spawns again.
- **Action combat package (opt-in, 2026-07-20):** See the dedicated authority page **`openwiki/runtime-action-combat.md`**. Key contract: `system.actionCombat { enabled, ... }` + per-map `GameMap.actionCombat: true` routes field-spawn contact to real-time action combat instead of `runFieldSpawnEventBattle`. Schema lives in `src/project/types/database.ts` (`SystemActionCombat`, `EnemyRecord.actionProfile`), normalization/resolution in `src/project/actionCombat.ts` (`isActionCombatMap` requires BOTH system enabled and map opt-in). Pure rules layer lives in `src/battle/action/{attackWindow,combatMath,contact,dodge,guard,hitbox,hitstop,kiting,knockback,simulate,skillSlots,stagger}.ts`. Scene glue: `src/player/playSceneActionCombat.ts` (Space buffered swing, Shift stamina dodge, C hold guard, Q skill cast, Tab/E slot cycle, contact damage on closing movement, enemy windup/dash/projectile state machine, stagger, 1-tile knockback, death beat, and HUD updates). Dedicated demo project: `rpg-zzu-action-demo` via `createActionCombatDemoProject` in `src/project/defaults/actionCombatDemoProject.ts`.
- **Autosave (2026-08-21):** a dedicated autosave slot lives beside the 3 manual slots under key `"{ns}:save-slot:auto"` (`autosaveKey` / `readAutosave` / `writeAutosave` in `src/player/saveSlots.ts`; `SaveSlotIndex` stays `1|2|3`). Snapshots reuse `createSaveSnapshot` (schemaVersion 3) plus optional top-level `savedBy: "manual"|"auto"` and `autosaveTrigger: "transfer"|"battleVictory"` — known-field-pick parsing keeps old/new saves mutually loadable. Triggers are PlayScene-only hooks: map transfer completion (`playSceneMapCommands.transferTo`, after session coords/map commit, before `fireAutoTriggers`) and battle victory (`playSceneBattle`, right after `applyBattleRewardsToSession`); `sceneTestRunner`/`walkthroughRunner` call the reward function directly and never autosave. Policy is the pure `shouldAutosave` in `src/player/autosave.ts`: skip when `m2Runtime.access.save === false` (Change Save Access), skip during cutscene input lock, and debounce 5s (`AUTOSAVE_DEBOUNCE_MS`); `performAutosave` swallows storage quota failures (warn only). The title menu shows "이어하기" (id `resume`, testid `title-resume-game`) only when a parsable autosave exists and `titleScreen.menuVisibility.resume !== false`; the load panel renders a read-only autosave card (`save-slot-auto`) on top — loadable, never an overwrite target.
- Save-slot persistence is a four-boundary codec: `createSaveSnapshot` -> JSON storage -> `parseSessionRecord` -> `applySaveSnapshot`. A field is not persistent unless it crosses all four boundaries. In addition to core party state, schemaVersion 3 preserves shop loyalty/trade/mileage/pawn/restock state, actor battle-command overrides, life-skill progress, actor nickname/faceset overrides, and Change Save Access flags. These remain optional so older schemaVersion 3 saves still load.
- `PlaySession.erasedEventIds` is runtime-only Erase Event state. It filters page resolution, sprites, triggers, and collision while the current map session is active, is included in save snapshots, is preserved when applying a saved session, and is cleared on normal map load/re-entry so authored `Project` event data remains unchanged.
- Runtime actor overrides live on `PlaySession`, not on project database records. `actorCharacterResourceIds` stores Change Actor Graphic charset overrides for the lead/player sprite path, `actorNicknames` and `actorFaceResourceIds` store Change Actor Nickname/Faceset overrides (a face override is one standalone face resource id; `actorFaceIndices` is removed, and a legacy save slot still holding it is mapped through `faceIdForSheetCell` on load), `actorBattleCommands` stores battle-menu overrides, `actorParamBonuses` stores Change Parameters permanent deltas by actor/parameter, and `actorStateIds` stores Change State field states. These fields are included in save slots and are passed into battle actor construction together with `actorLevels`, `actorVitals`, `actorNames`, and `partyActorIds`.
- Party-style field followers live on `PlaySession.followers` plus `followerTrail`. `addFollower` accepts an `actorId` or explicit page graphic (`kind: "actor"`), `removeFollower` removes actor followers by name or all actors (monster train entries are preserved), and PlayScene renders followers outside the event list so they never block movement or become action/touch investigation targets. `monsterParty` is the SSOT for overworld monster train followers: `syncMonsterPartyFollowers` rebuilds `kind: "monster"` entries after give/move and save load, with trail order actors first then party order. Species may author optional `graphic.fieldCharsetId` / `fieldGraphic` (default `tex_easyrpg_charset_monster1`). Transfer/retry/load paths place followers near the player, while normal player movement records previous player tiles so followers inherit the trail in RM2003 party order. Save slots preserve both the follower list and trail.
- **팔로워 스프라이트는 슬롯(논리 좌표)과 화면 좌표가 분리돼 있다 (2026-09-20).** 슬롯은 궤적 재생이라 플레이어 걸음 완료 시점에만 바뀌지만, 화면 좌표는 `updatePlayScene` 이 매 렌더 프레임 부르는 `updateFollowerSpriteMotion` 이 직전 슬롯 → 이번 슬롯 사이를 걷기 주기와 같은 시간으로 이어 그린다(걷기 프레임 0→1→2→1, 멈추면 idle 프레임). 이 분리가 없으면 팔로워가 칸에서 칸으로 스냅 이동한다 — "뒤에서 쫓아오는 몬스터" 가 유일하게 뚝뚝 끊기는 원인이었다. 슬롯 갱신(`syncFollowerSprites`)은 여전히 걸음 완료·맵 로드·refresh 지점에서만 불린다. 증거: `npm run qa:runtime -- --scenario follower-chase` + `scripts/qa/runtime/follower-frames.probe.mjs`(QA_OUT_DIR 로 프레임 샷 분리, 걷는 동안 스프라이트 x 가 타일 사이값이어야 한다). 픽스처는 8MB 라 커밋하지 않고 `build-follower-qa-fixture.mts` 로 생성한다.
- 동료(액터 팔로워) 전역 규칙은 `system.companions: CompanionConfig` 에 산다 — `gap`(동료 사이 간격, 칸)·`maxCompanions`(동시 추종 상한)·`overflow`(`reject` 기본 / `replaceOldest`). 생략하면 기존 동작(간격 1칸·무제한)이 그대로 유지되고 세이브 마이그레이션도 필요 없다. 추종은 경로탐색이 아니라 `followerTrail` 재생이므로 간격은 인덱스 매핑으로 표현된다: index 번째 동료는 `trail[(index + 1) * gap - 1]` 을 읽는다(`followerPositions(session, config)`). 궤적 버퍼가 `MAX_FOLLOWER_TRAIL_POINTS`(64)칸이라 `gap * maxCompanions` 가 64를 넘으면 뒷사람이 플레이어 칸에 겹치므로 `configure_companion_rules` 가 저작 시점에 거부한다. `resetFollowerTrailNearPlayer(session, map, config)` 는 `gap` 만큼 길게 궤적을 깔아 맵 진입 직후 겹침을 막는다. 인원 상한은 **액터 동료만** 센다 — 몬스터 열차는 `monsterParty` 가 SSOT 이고 `syncMonsterPartyFollowers` 가 상한과 충돌하면 안 된다. `addFollowerToSession` 은 상한 초과 시 `reject` 면 `null` 을 돌려주고 `replaceOldest` 면 가장 먼저 붙은 액터 동료를 밀어낸다.
- 동료 대형은 `system.companions.formation` 이다. `"line"`(기본)은 궤적 승계, `"beside"` 는 플레이어 사방 인접 칸에 붙어 다닌다 — 인접 칸이 4개뿐이므로 앞 4명만 옆에 서고 나머지는 일렬로 떨어지며(`lineIndex = index - slots.length`), `gap` 은 무시된다. `beside` 슬롯은 `FollowerWorld({project, map})` 를 받은 호출부에서 `inBounds` + `isPassable` 로 걸러진다 — 일렬은 플레이어가 밟은 칸만 쓰므로 필요 없지만, 옆에 세우는 순간 강·벽 위에 동료가 서는 게 가능해진다. `clearOnTransfer: true` 면 맵 이동 시 액터 동료를 해제한다(런타임 `transferTo` 와 `sceneTestRunner` 의 transfer 스텝이 같은 게이트를 쓴다).
- `adjacentFollowerCandidates` 는 **인접 4칸만** 돌려준다. 이전에는 마지막 원소로 플레이어 칸 자체를 폴백으로 넣고 있었고, 그 때문에 `beside` 5번째 동료가 플레이어 위에 겹쳐 안 보였다(궤적 초기화도 5칸마다 플레이어 칸을 깔았다). 겹침 폴백이 필요한 자리는 `resetFollowerTrailNearPlayer` 의 out-of-bounds 분기뿐이다.
- 추종 회귀는 `test/companionRules.test.ts`(간격 수학·상한 정책·대형·프레임)와 `test/e2e/companion-follow-runtime.spec.ts` 가 함께 고정한다. e2e 는 인페이지에서 `applyToolToStore` 로 `add_companion`(autorun) 2건 + `configure_companion_rules {gap:4}` 를 적용하고, 테스트 플레이에서 12칸 걸은 뒤 `runtime-state-json` 의 `followerTrail` 로 간격을 단정하며 `reports/shots/companion/gap4-follow.png` 를 남긴다. **워크트리에서 돌릴 때는 `DEV_SERVER_PORT` 를 자기 dev 서버 포트로 지정해야 한다** — playwright 는 `PLAYWRIGHT_BASE_URL` 을 무시하고 기본 9173 을 재사용하는데, 그 포트를 메인 레포 서버가 잡고 있으면 다른 코드베이스를 검증하게 된다(실측: 등록한 툴이 "알 수 없는 툴" 로 나왔다).
- 동료 그래픽의 `pattern` 은 "0~3 패턴"이 아니라 **시트 프레임 인덱스**다. 런타임이 `resolveEventSpriteTexture` → `charsetIdleFrameIndex` → `decodeCharsetFrameIndex` 로 characterIndex 를 역산하므로, 원시 숫자를 손으로 넣으면 캐릭터가 0번으로 고정된다(실측: 편집기 "강아지 펫" 프리셋이 `pattern: 1` 이라 고양이 프리셋과 똑같은 animal 시트 0번을 렌더했고, 애초에 번들 charset 에는 개가 없다). 어떤 저작 경로도 `charsetFollowerGraphic(textureKey, characterIndex)` 를 우회하지 않는다.
- **크로노 트리거식 필드 (2026-09-26).** `system.companions.fromParty: true` 면 `syncPartyFollowers`(`src/project/followers.ts`)가 `partyActorIds.slice(1, system.activeSlots ?? 4)` 를 `source:"party"` 동료로 맞춘다. 새 게임·불러오기(`PlayScene.create`, `saveSlots` 복원)·`changeParty`·`refreshRuntimeSurfaces` 마다 멱등으로 다시 부르고, 저작 `addFollower` 로 이미 붙은 배우는 중복하지 않는다. 플래그가 없으면 파티 파생 동료가 없으므로 옛 프로젝트는 그대로다.
- 액터 동료 그림은 주인공 스프라이트와 같은 규칙이다: 외형 세트 → `characterResourceId` + `characterIndex` → `defaultActorCharacterResourceId` → 기본 주민 시트. 예전에는 `characterIndex` 를 버리고 걷기 그림 없는 배우를 조용히 null 로 떨궜다. 여전히 못 붙이면(배우 없음·상한 reject) `console.warn` 에 이유를 남긴다.
- `changeParty` 의 `action:"lead"` 는 그 배우를 `partyActorIds[0]` 으로 옮긴다(없으면 합류시키며 앞에 세운다). 이벤트가 끝나며 부르는 `refreshRuntimeSurfaces` 가 주인공 그림과 동료를 다시 맞춘다. 전투 쪽(`src/battle/battleEvents.ts`)은 `lead` 를 모른다 — 전투 이벤트에서는 무시된다.
- **한 방향 턱.** `TilesetDef.ledgeDirections: Record<타일, Dir>`. `collision.canMove` 는 턱 칸에 정해진 방향이 아닌 진입을 막고, 주인공이 정해진 방향으로 들어서면 `tryStartLedgeHop`(`playSceneMovement.ts`)이 기존 점프 연출(`jumpHop`)로 2칸 넘는다. 착지 칸이 막혔으면 넘지 않는다. 체공 상태의 `via` 칸을 동료 궤적에 끼워 동료가 한 칸씩 따라온다. 저작은 `set_tile_rules {entries:[{tile, ledge}]}`. 증거: `node scripts/runtime-qa.mjs --scenario ct-field`.
- Runtime lighting lives on `PlaySession.lighting` as `{ ambient, color?, sources }` and is included in save slots/checkpoint snapshots. Maps can author `defaultLighting`, which is applied on map entry/transfer and persists until another map default or explicit command / tool changes it. `LightSource.at` may be a fixed tile, `"player"`, or `{eventId}`; player/event/follower/chase positions are resolved at render/test time, and `flicker` uses deterministic fixed-step math rather than RNG.
- Play mode draws lighting through `src/player/playSceneLighting.ts` using one reusable `CanvasTexture` mask image above the scene. The mask recomposes only when the lighting signature changes and cuts simple radial light holes from the ambient darkness; wall/line-of-sight occlusion is intentionally out of scope for the Phase 6a lighting layer.
- Day/night phase tint is owned by `src/player/playSceneTime.ts` and layered below the Phase 6a darkness mask rather than being added into lighting ambient. Time advances on a fixed timestep from `minutesPerRealSecond`, pauses during menu, battle, and cutscene lock, and can force `sleepUntilMorning` at `dayEndHour` when `forceSleep` is enabled.
- Runtime weather is stored in the existing `PlaySession.m2Runtime.screen.weather` string and normalized by `src/player/weather/weatherModel.ts`. Native `setWeather` supports `none`, `rain`, `storm`, `snow`, and `fog` with optional intensity/transition; save slots preserve the current weather string, and map transfer keeps it until another command / tool or authored map default changes it.
- Play mode draws Phaser weather in `src/player/playSceneWeather.ts` below the Phase 6a darkness mask. As of 2026-09-21, fog uses three seamless, independently drifting noise layers from `weather/fogTexture.ts` (256² texture generated once per texture manager, linear filtering, no asset dependency/per-frame texture upload). Opacity scales continuously to zero; no rounded-rectangle bands or opaque base veil remain. Screen-space weather compensates camera zoom, while cloud shadows remain world-anchored. Rain/storm and snow use deterministic index-hashed positions, varied depth/speed/size/opacity; storm retains the existing flash timing. Layer objects are scene-owned and references clear on shutdown. Weather commands and saved state are unchanged.
- Visual QA: `WEATHER_QA_KIND=fog npm run qa:runtime -- --scenario weather-quality` (also cloud/rain/snow/storm); optional `WEATHER_QA_ZOOM=0.5`. The scenario uses an existing test map with a transient weather-only event, captures two motion frames, then clears non-cloud weather. This is a rendering fixture, not authored game content. See `verify-shots/runtime-qa/weather-after/SUMMARY.md` and the comparison evidence in `.omo/evidence/weather-quality/`.
- Map-target battle animations are transient runtime effects from `showAnimation` and are intentionally not serialized. `src/player/playSceneMapAnimations.ts` reuses battle animation records/resources on a map overlay above events and below darkness; event targets capture the start tile/pixel position and do not track a moving event after playback begins.

## Editorial title screen (2026-08-26)

- `src/player/titleScreen.ts` renders the game-start surface with the stable editorial root `rm-title-screen-editorial`, the kicker `A NEW ADVENTURE`, and the subtitle `이야기가 시작되는 곳`. Keep the authored title/menu/resource behavior intact while preserving this calmer story-opening composition; do not restore the oversized crest, technical key-help copy, or saturated RM-style menu chrome.
- **오프닝 효과 층 (2026-09-25):** 키아트 위 WebGL 효과(빛내림·알갱이·칼날 반사·물결·안개)와 로고/메뉴 질감, AI 키아트 생성·비전 맞춤은 [title-opening-effects.md](title-opening-effects.md).
- Focused structure coverage lives in `test/titleScreen.test.ts`. Browser acceptance must open the actual test-play window and inspect the rendered title surface rather than relying on the System-tab preview alone.


## playerTouch trigger contract (2026-08-20)
- playerTouch(및 touch) 맵 이벤트는 세 경로로 발동한다: ① **밟기** — 플레이어가 이벤트 타일로 걸어 들어감(`playSceneMovement.ts`의 이동 완료 → `fireTouchTriggers`; 헤드리스는 `sceneTestRunner.ts`의 `movePlayerOneStep`), ② **부딪힘** — priority "same"(차단형) 이벤트에 이동이 막히며 접촉(`firePlayerTouchEvent`), ③ **transfer 연계** — 전이 착지 타일의 touch 이벤트(착지 즉시 재발동 위험은 lint `transfer-retrigger`가 경고). 저작 계약: **playerTouch 이벤트는 밟을 수 있는 타일에 놓아야 한다(priority "below" 권장)** — 플레이어 이동은 지형 통행성(`canMove`)에서 먼저 막히므로, 통행 불가 타일 위의 밟기형(priority≠"same") 페이지는 영구 미발동이다(RM2K3 정합 동작이라 런타임은 고치지 않음). 이 함정은 lint `playerTouch-impassable`(warning, `src/project/lint/projectLint.ts`)이 검출한다. 회귀 스펙: `test/emberQuestGame.test.ts`의 잿불 마을 동문 걷기 전이 케이스(2026-07-07 크리틱 #19 오탐 종결 증거).
- **대각선 이동은 목적지까지 검사한다(2026-08-27 코너컷 수정):** 플레이어 대각 입력은 `resolveDiagonalStep`(`src/player/input.ts`)이 판정하며, 양쪽 직교 칸이 열린 것만으로는 부족하고 `canStep(x, y)` 로 **대각선 목적지**까지 열려야 대각 이동이 성립한다. 호출부(`playSceneMovement.ts` `tryStartMove`)의 `canStep` 은 대각 델타를 받으면 NPC 쪽 `canNpcMove`(`playSceneAutonomousMapActions.ts`)와 같은 L자 2구간 판정 — 중간 칸(가로 또는 세로) → 목적지 구간을 `canMove` 로 확인한다. 목적지가 막히면 열린 직교로 미끄러지고 둘 다 막히면 제자리 회전만 한다. 이 검사가 빠지면 두 직교가 열린 벽 모서리에서 통행 불가 타일로 들어가는 코너컷 버그가 난다(회귀 스펙: `test/movement.test.ts`).

## Selected-event runtime sandbox (2026-07-30)
- `eventTestSandbox.ts` starts from `projectWithoutEventDrafts(liveProject)` and injects only the selected event’s current working body with draft metadata removed. Other open edits remain at their canonical originals and unrelated new drafts are absent.
- Spawn selection prefers passable, unoccupied cells in stable down/left/right/up order, then scans deterministic Chebyshev rings starting at radius 1 so free diagonals cannot be skipped. A non-cardinal or last-resort event-cell start returns a user-visible diagnostic instead of silently claiming a safe spawn.
- Ordinary test play still flushes canonical authored data before boot, then runs against a `projectWithoutEventDrafts()` read-only snapshot. This prevents active or crash-recovered working drafts from leaking into full-game runtime while leaving those drafts intact when the player closes.
- `openSelectedEventTestModal` must not call `store.flush()`. It exposes the sandbox through `beginReadOnlyProjectSnapshot`, creates a copied `PlaySession`, and calls `renderPlayer` with `initialEventTestId`; `PlayScene.runInitialEventTestWhenReady` then enters the normal `runEvent`/interpreter path. Teardown completes while the sandbox is visible, then releases it and returns to the unchanged editor draft. Coverage: `test/eventTestSandbox.test.ts` and `test/selectedEventTestModal.test.ts`.

## P2 spatial runtime and saves (2026-08-25)

- **Linked-home Life Ledger (2026-09-08):** `lifeLedger.ts:animalEntries` exposes per-animal legacy/placement assignment targets. Activation calls `assignFarmAnimalToBuilding` or `assignFarmAnimalToHousingPlacement`, rechecking current existence, species and destination occupancy (excluding the moving animal). Full/species-invalid linked targets show their refusal state; stale targets cannot bypass core checks. Reassignment replaces only the exclusive home reference, retaining friendship, production, ready products and daily feed/pet receipts, so moving does not permit duplicate daily care. Missing-home feed/pet rows disclose `unassigned`; ready-product collection remains available through `collectFarmAnimalProduct` without a home.
- Occupied-building demolition shows the affected animal count before mutation and requires a second activation. The four-second arm belongs to the live `PlaySession` identity and current menu-open lifetime: same-context rerenders retain it, but expiry, session replacement or `playerStatusMenuControllerDom.ts` menu close via `invalidateLifeLedgerConfirmationContext` requires a fresh arm. `spatialPlacementTransactions.ts:removeFarmBuilding` removes the placement and its linked references, not the animals or their care/production state; voluntary demolition gives no refund.
- Coverage: `test/animalHousingAuthoringUi.test.ts` and `test/animalHousingConfirmationLifecycle.test.ts`. Recorded native player attempt1 [PLAYER-QA.json](../.omo/evidence/life-full-20260906/13/final-publication-candidate/PLAYER-QA.json) covers assignment/refusal, retained care, assigned/unassigned collection, demolition lifetime and Save1 -> actual divergence of both home references -> Load1 -> Save3 restoration. Its fixed project/Save5 input is distinct from editor attempt8; ready products came from that input, not newly demonstrated production. The bounded [source binding](../.omo/evidence/life-full-20260906/13/final-publication-candidate/SOURCE-BINDING.json) identifies tested files; these scoped results do not establish whole-Phase4 or all-51 completion.

- `spatialPlacementTransactions.ts` is the mutation authority for build/move/upgrade/remove and decoration place/move/rotate/remove. It preflights map permission, rotated footprint bounds/passability/collision, safe gold, aggregated item costs, inventory overflow, and stale IDs before committing. Decoration placement consumes exactly one linked item; removal returns exactly one or fails with zero mutation.
- `spatialOccupancy.ts` includes both P2 runtime collections and treats legacy placeables/chests as occupied single cells, while never converting them into P2 records. Moving/rotating/upgrading excludes only the target instance from collision checks.
- Save wire parsing is bounded in `saveSlotSpatialValidation.ts`; `spatialPlacementRestore.ts` then applies project-aware type/map/level/orientation/collision checks for both parsed saves and direct checkpoints. An explicitly saved `{}` is authoritative and keeps a cleared layout empty. A legacy save that omits a field retains its authored `startSession` placement.
- The Life Ledger adds the stable `spaces` tab (`life-ledger-tab-spaces`) with summaries `life-ledger-space-building-<instanceId>` / `life-ledger-space-decoration-<instanceId>` and safe upgrade/rotation actions. It uses `/assets/farming/life-ui/decorating-card.png`.
- Authored `system.playerFootprint` / `playerPassRows` now survive Project normalization and public IO; `resolvePlayerBody` retains the full authored body separately from movement passage. New games still initialize `farmPlots: {}`: `ProjectSession` has no authored starting-plot contract. The Task12 producer-r3 native fixture creates plot `7,9` by actual hoe tilling, not by extending the Project schema. Its raw Save5 slot contains three building owners, the rug owner with its frozen recovery item, and that plot; Load-menu receipts show matching building owners and the rug UI id. The unchanged-source producer-r4 supplement records a table rotating down to left at `(7,9)` and moving to `(5,6)`, with both resulting owners read from actual menu Save slots. A separate remotely reloaded last-exit fixture refuses construction at `(0,3)` without moving foot `(1,2)`, spending gold/items or changing owners. These fill the three r3 gaps without relabeling its failed attempts. The r4 Save observations are not a new Load-restoration proof. Producer-r5 separately walks DOWN onto a nonblocking 2x1 rug at `(7,9)`: destination passage x7..9/y9 intersects both rug cells. Save slot1 records foot `(8,9)`; after moving the live foot to `(8,10)` and rug to `(7,11)`, menu Load restores foot `(8,9)` and rug `(7,9)`. A newly saved slot2 retains matching building/decor owners, recovery item, gold500, potion7 and hoe1. This corrects the old r3 traversal label without rewriting its evidence; independent post-commit native acceptance remains separate.
- Farm building and decoration overlays resolve `graphicResourceId` / facing variants through `resolveSpatialGraphicTexture`. Referenced EasyRPG pictures (including the editor default `easyrpg-picture-cloud`) load under that catalog id via `loadBundledAssets`; event charset mapping is unchanged. After public placement mutations, tile overlays rebuild only through `refreshRuntimeSurfaces` (`renderTiles` + `renderPlaceableOverlays`), not `refreshRuntimeEntities`.


## 공포 게임 제작 기능 (2026-09-05)

선택적 `session.horror`와 `eventLocations`로 추격·가구·은신 상태를 세이브에 보존한다. 데이터·런타임·저작·검증 계약은 [horror-authoring.md](horror-authoring.md) 참조.

### 메뉴 PR 통합 검증 (2026-09-05)

Esc 메뉴의 대상 유지·회복량 미리보기와 메뉴 입력 회귀 수정을 함께 적용한다. 대상 버튼의 사용 가능 여부는 `canUseMenuItemOnActor`를 따르고, 스위치 아이템은 남은 ally scope와 무관하게 바로 사용한다. 메뉴를 다시 열 때는 표시되는 레일 명령과 내부 명령을 동기화한다. `status-menu-adversarial.spec.ts`는 사용 뒤 유지되는 대상 화면에서 HP·잔량을 확인한 후 취소로 목록에 돌아오며, OS 키 반복 차단과 효과의 저장→로드→재저장을 계속 검사한다.


#593 후속 커밋은 선택 행에 공통 규칙과 같은 `border-radius: 3px`, `margin: 0`, `min-height: 0` 및 `bottom: auto`를 명시한다. 따라서 CSS 실사용 기준선은 상점 PR의 원래 기준선을 유지하며 메뉴의 속성 누락 검사는 통과한다.

## Game menu designs and information ownership (2026-09-18)

`system.menuUiStyle` now accepts eight registry IDs: `workbench`, `party-first`,
`party-first-warm`, `hub`, `sheet`, `classic`, `journal`, `ribbon`. Missing/unknown
values still resolve to workbench; normalization omits the explicit default.
Classic uses separate blue windows; journal uses a paper palette with the landing
rail on the right; ribbon uses four party cards and a six-column bottom rail.
They share the existing detail controller and authored/runtime state boundaries.

- `playerStatusMenu.ts` omits the decorative side party on pages with item facts,
  equipment stat comparisons or tabs. Effect/eligibility/consumption information
  is machine-derived and must not be replaced by an authored description/footer.
- The legacy `status-menu-party` panel belongs to the party submenu (or workbench
  preview). It must not also mount on a skin's own landing overview/strip.
- `adoptStatusMenuPanel` preserves focused rail buttons while updating their label
  and summary text. Inventory kinds and party health must reflect the current
  session after item use. Hub system summaries receive the real wait-mode value.
- `focusMenuArea` passes the skin's column count when refreshing footer copy;
  returning with Left must not advertise Right-to-enter for a grid rail.
- Shared skin presentation is in `src/styles/runtime/statusMenuSkins.css`; new
  editor previews are actual player captures in `public/assets/ui/menu-skins/`.

Browser proof: `node scripts/qa/runtime/menu-design.probe.mjs` uses
`startPlayerQaServer` / `player.html` with the export store shim. Read
`verify-shots/runtime-qa/menu-design/SUMMARY.md` first. Each of eight designs is
exercised with real keyboard input, movement, item depletion/healing, skill tabs,
equipment comparisons, wait toggle, save/load, and three viewport sizes. The
fixture is a detached existing engine test project, not newly authored content.
Review record: `docs/reviews/2026-09-18-menu-design.md`.

### Four era-inspired menu windows (2026-09-18 follow-up)

The registry now has **12** skins. New stable IDs: `retro-2000`, `retro-2003`,
`classic-xp`, `classic-vx`. Their labels describe era and appearance; existing IDs
and the workbench default are unchanged. `statusMenuLegacySkins.css` is imported
by the shared runtime CSS closure, so editor play and shipping player agree.

- 2000: opaque cobalt, square silver frame, right commands and numerical vitals.
- 2003: teal/slate, beveled frame, right commands and inset vitality meters.
- XP: translucent slate windows, left commands, walking characters and numbers.
- VX: violet translucent windows, left commands, portrait rows and coloured meters.

The optional registry `partyArt: "character"` uses `resolvePlayerSpriteResource`
for each party member, `resolveActorAppearance` and the session character override,
then the canonical `applyCharsetFrameCrop` (down-facing idle frame). Resource URLs
use `resolveAssetResourceUrl`; no external skin images or standalone sprite crop
math is introduced. Failure to resolve an image falls back to the existing face.

Numeric HP/MP rows need enough room for the fourth actor. Browser checks bound
both vital lines to their own row, not only to the whole stage. Proof:
`OPRN_MENU_QA_OUT=verify-shots/runtime-qa/menu-eras node scripts/qa/runtime/menu-design.probe.mjs retro-2000 retro-2003 classic-xp classic-vx`.
Read that directory's `SUMMARY.md` first. Previews are actual player captures at
`public/assets/ui/menu-skins/<id>.png`. Details: `docs/reviews/2026-09-18-menu-eras.md`.

## Player options, inventory views and honest shop services (feature16, 2026-09-21)

- ESC → 시스템 → 설정 opens `src/player/playerOptionsDetail.ts` through the existing keyboard-owned
  detail controller in every menu skin. Semantic buttons use `player-option-*` test IDs.
  BGM/SE ±10%, dialogue slow/normal/fast, and **ESC menu motion only** are device preferences;
  this is not a global flash-reduction promise. OS reduced-motion still takes precedence.
- `src/player/playerPreferences.ts` uses `oprn:player-preferences:v1`, independent of project namespaces,
  sessions and save slots. Invalid values default/clamp; failed Storage writes retain the
  in-memory setting and report that persistence failed. Audio singleton creation reads these
  values; options immediately call `AudioEngine.setVolume` for both groups. Menu cue volume
  also follows SE. Dialogue applies the speed multiplier to default and authored `\s[n]`
  delays, preserving explicit pauses and manual page advance.
- Inventory view state belongs to each menu controller, never `session.inventory`. At the
  end of the item list, `inventory-filter` cycles all / field-usable types / equipment / other;
  `inventory-sort` cycles authored / Korean name / descending quantity. From the first action,
  Up twice reaches filtering. Actor eligibility is still decided by actual item-use logic.
  Unknown positive stacks remain visible in all/other. Controls survive empty results;
  the controller clamps the cursor and retains the activated control across list rebuilds.
  All twelve skins share these buttons, item targeting and keyboard ownership.
- The split shop no longer duplicates buy/sell navigation with fake upgrade/exchange actions.
  Existing real `shop-tab-buy` / `shop-tab-sell` handle supported modes; buy-only and sell-only
  shops cannot show the other service. No crafting, cart, transaction or save schema was added.
- Parent-owned validation: `npm test -- test/feature16Player*.test.ts` and
  `npm run qa:runtime -- --scenario feature16-player`. The scenario interacts with the real
  `player.html` shell using keys, captures settings/filtered inventory/split shop, and derives
  a detached test fixture via `test/fixtures/feature16Player.mjs`. No DB content writes.
  Read `verify-shots/runtime-qa/feature16-player/SUMMARY.md` first. Tests and browser captures
  are prepared here, not executed by the feature worktree agent.

## 도트 비교 상점 — 상점 UI 기본값 (2026-09-27)

- 명령에 `shopUiPreset` 이 없으면 `"pixel"` 이다(`src/project/shopUiPresets.ts` 의 `DEFAULT_SHOP_UI_PRESET`).
  예전 암묵 기본값 `classic` 은 상세·파티 창을 숨겨 장비를 사도 무엇이 오르는지 안 보였다.
  `"classic"` 을 **명시적으로 저장한** 명령은 그대로 classic 이다. 프리셋 목록·로드 검증·편집기 선택지는
  모두 `SHOP_UI_PRESETS` 한 곳을 본다(예전에는 세 곳에 문자열 배열이 따로 있었다).
- 표현: 도트 글꼴(`--runtime-pixel-font`) + 여러 장의 창 + ▶ 커서. 스타일은 `shop.css` 끝의
  `.runtime-shop-preset-pixel` 블록이 소유한다. 320×240 급(≤460px 또는 ≤360px 높이)에서는 한 장의 표면으로 합친다.
- 배치는 RM2003 상점(EasyRPG `Window_ShopParty`)을 따른다: 왼쪽 목록, 오른쪽 위 **파티 창**, 그 아래 **비교 창**,
  아래 **설명 창**(설명 + 보유/장착 수)과 **소지금 창**. 격자는 `.runtime-shop-items-shell` 의 CSS grid 가 소유하고
  (`.runtime-shop-main` 은 `display: contents`), 글자·행 높이·간격은 `--play-scale` 배율을 따른다.
  상단 바와 프롬프트 창은 이 프리셋에서 **시각적으로만** 숨긴다(탭·결정·수량 입력·키 힌트는 포커스 링과 테스트 계약이라 DOM 에 남는다).
  목록 행에는 비교 표시를 두지 않는다(행마다 ▲▼ 네 칸을 달았던 첫 판은 읽기 어려워 걷어 냈다).
- 수치의 원천은 기존 `previewShopEquipment` 하나다. `src/player/shopPartyFit.ts` 가 그것을 표시로 바꾼다:
  - `partyFit` → 파티 카드의 동료별 판정과 두 줄(`lines`, 절댓값 큰 순 최대 두 능력치. 예: 방어 +7 / 민첩 −2).
    장착 불가·장비 고정은 한 줄 사유, 같은 장비는 「장착 중」.
  - `bestFitActorId` → 비교 창의 기준 동료. 파티 카드나 상세 창에서 동료를 직접 고르면(`comparisonPinned`) 그 선택을 유지한다.
  - `recoveryPreview` → 회복 아이템이면 파티원별 현재 HP/MP 와 사용 후 값(산식은 `playerItemUse` 와 같다).
- 파티 카드(`partyPreview(scene, { cards: true, onActor })`)는 필드와 같은 charset 을 정면으로 걷게 한다
  (`shopPartyWalker` → 공용 `partyWalker`, CSS 변수 `--party-walk-0..2` 순환, 타이머 없음). 장비할 수 없는 동료는 회색으로 멈춘다.
  카드는 버튼이며 Tab 포커스 링(`shopDecisionInput` STOCK_GROUPS)에 들어간다. 런타임은 포인터를 막으므로 결정키로 고른다.
- 비교 창(`shopComparisonSummary(..., { statement })`)은 고른 동료 한 명의 명세서다: 걷기 그림 · 이름 · Lv ·
  「부위 현재 장비 → 새 장비」, 능력치마다 「현재 → 변경 후 ▲▼ ±차이」(떨어지면 빨강), 얻고 잃는 특수 효과 태그.
- 크기별: 640×480 급은 같은 배치에서 명세서 초상만 뺀다. 320×240 급은 목록 · 한 줄 파티 창(걷는 그림 + 한 마디) ·
  설명/소지금만 두고 명세서는 「상세 / 장비 비교」 창에 맡긴다. 공용 압축 규칙이 파티 창을 숨기므로 프리셋이 되살린다.
- 세션·세이브·거래 규칙은 바뀌지 않았다. 「구매 후 장착」 같은 새 거래 경로는 없다.
- 시각 증거: `node scripts/qa/runtime/shop-surface-shots.mjs [--preset <id>] --out <dir>` 은 출하 플레이어로
  같은 픽스처를 띄워 입구·무기·갑옷·회복약과 640×480·320×240 을 찍는다. 이번 전후 비교는 `verify-shots/shop-modern/`.

## 도트 창 통일 — ESC 메뉴·장비·아이템·여관·전투 결과 (2026-09-28)

상점 기본 프리셋 `pixel` 과 같은 창 체계(청색 도트 창 · 이중 흰 테두리 · 손가락 커서 · 걷는 파티 ·
「현재 → 변경 후 ▲▼」)를 나머지 런타임 화면의 기본값으로 넓혔다.

- ESC 메뉴 기본 스킨이 `workbench` → **`pixel`**(`MENU_SKINS.pixel`, `DEFAULT_MENU_SKIN_ID`).
  `menuUiStyle` 을 저장하지 않은 프로젝트는 새 기본을 따르고, `"workbench"` 를 **명시적으로 저장한** 프로젝트는 그대로다
  (저장 정규화는 기본값 `pixel` 만 지운다). 스킨 플래그 `partyStats` 가 도트 창 계열 표시를 켠다.
  - 첫 화면(landing party): 파티 창 = 걷는 그림(`player/partyWalker.ts`, 상점 파티 카드와 같은 구현) · 이름 · 직업/Lv ·
    상태이상 줄(`PlayerStatusMenuPartyRow.stateNames`, 세션 `actorStateIds`) · HP/MP/EX 숫자와 막대
    (`nextLevel.remaining` = 다음 레벨까지 남은 EXP). 오른쪽에 명령 · 소지금 · 장소 · 시간 · 장 창.
  - 장비: 부위 목록에도 현재 능력치(증감 0 인 `statDelta`)가 서고, 끝에 **「최강 장비」** 행
    (`bestEquipmentPlan` — 부위마다 가진 후보 중 네 능력치 합이 최대인 것, 저주·고정 부위는 건너뜀.
    실행은 `optimizeStatusMenuEquipment` 가 부위별 `transitionActorEquipment` 로 원자적으로 적용). 후보 행 값은
    「공격+12 · 1개」처럼 가장 큰 변화 둘과 소지 수. 비교 행마다 `status-menu-delta`(▲n/▼n).
  - 아이템 대상: 카드에 상태 줄(「독 → 정상」, `previewMenuItemTarget` 의 `stateIds`/`curedStateIds`)과
    회복량 ▲n. 늘어날 막대 구간이 깜빡인다. 제목 문자열(「회복약 · 4개」)은 바꾸지 않았다(여러 테스트의 계약).
- 여관: 메뉴 스킨이 `partyStats` 면 `layoutPixelInn`(playSceneCommerce.ts)이 기존 노드(제목·인사·질문·예/아니오)를
  도트 창 격자로 옮기고 파티 창(`inn-party-row-<actorId>`, HP/MP 「60 → 514 ▲454」)과 요약 창
  (`inn-summary-gold` 「1,200 → 1,120 G」, 회복 합계)을 더한다. 거래·휴식 연출·분기 규칙은 그대로다.
- 전투 결과: 승리 + `partyStats` + 포켓몬 전투가 아니면 `syncPixelResultParty`(battleDirectorDom.ts)가 합계 창 ·
  파티 창(`battle-result-party-<actorId>`: 걷는 그림 · Lv 전후 · LEVEL UP · EXP 막대 · 다음 Lv까지) ·
  레벨 업 창(`battle-result-levelup-<actorId>`: HP·MP·공격·방어·정신·민첩 현재 → 오른 뒤 ▲, 새 스킬 MP)을 더한다.
  기존 보상 행(경험치·골드·아이템, 공개 단계·세기)은 전리품 창으로 그대로 남는다. 걷는 그림은
  `battleResultPanel(snapshot, stage, audioContext)` 로 받은 플레이 세션이 있을 때만 그린다(에디터 전투 테스트는 이름 첫 글자).
- 스타일은 `src/styles/runtime/pixelWindows.css` 한 장(색 변수 `--px-*`). 메뉴·여관은 320×240 논리 픽셀,
  전투 결과는 640×480 전투 무대라 두 배 값이다.
- 런타임 QA 하네스에 `systemPatch`(시나리오가 QA 사본의 `project.system` 만 덮는다)가 생겼다. workbench 배치를
  계약으로 보던 시나리오(esc-menu · item-menu · item-care · life-full · dream-explore)는 `menuUiStyle: "workbench"` 로 고정했다.
- 증거: `npm run qa:runtime -- --scenario esc-pixel`(첫 화면 · 대상 · 해독 · 장비 부위/후보 · 최강 장비),
  `--scenario inn-battle-pixel`(여관 · 레벨 업 결과). `verify-shots/runtime-qa/<시나리오>/SUMMARY.md` 를 먼저 읽는다.
## Persistent battle reports and formation (2026-09-21)

Existing `actorRows` and `partyActorIds` save/load paths remain authoritative. Optional `battleReports` is normalized at create/parse/restore and defaults empty for old saves (20 reports, 120 real timeline lines each). Esc → 기록 → 전투 기록 reads completed outcomes; Esc → 파티 → 진형 edits active order and front/back. Contracts and parent-owned verification: `openwiki/feature16-battle-ui.md`.

Feature16 integration removed fabricated comparison numbers and cart/checkout claims,
stock urgency text and the redundant split heading. Story-mode shortcuts honor
buyOnly/sellOnly; real item comparison and purchase/sale handlers remain authoritative.

## 퀘스트 일지의 긴 문장과 키보드 읽기 (2026-09-24)

`questsDetail`의 요약·상태·단계 행은 `data-quest-row`로 표시한다. 런타임
`statusMenuEdgeDock.css`에서 해당 행만 한 열로 배치하여 긴 제목과 설명의 겹침을 막는다.
일지에는 실행 버튼이 없으므로 `moveSelectedDetailAction`은 quests에 한해 ↑↓ 입력을
목록 높이의60% 스크롤로 처리한다. 기존 선택 가능한 행의 커서/실행 동작은 유지한다.
사건 등록은 기존 상태를 읽는 `define_quest` 그래프 메타를 사용하며, 단순 일지 연결을 위해
`create_quest`로 기존 이벤트를 재컴파일하지 않는다. 검증 기록은
`docs/qa/saesol-three-hour-ai-authoring.md`의 요청61 절을 참조한다.

## 갤러리와 줄 음성 (2026-09-25)

`system.gallery.enabled` 가 참일 때만 ESC 메뉴 기록에 항목이 생긴다. 표시 이름은
`system.gallery.label` 이고, 비우면 「갤러리」다. 꺼 두어도 커스텀 이름은 남는다.
`showPicture.recordInGallery` 가 참인 그림을 실행하면 `session.galleryUnlocks` 에
리소스 id 가 본 순서로 쌓이고 Save 스냅샷에 들어간다. 같은 그림은 한 번만 남는다.
목록에서 결정하면 `.play-stage` 안의 `gallery-viewer` 가 그 그림을 화면 크기로 연다.

`text.voiceResourceId` 는 그 줄이 열릴 때 음성 파일을 한 번 재생한다. 배경음·효과음 채널은
건드리지 않고, 설정 「대사 목소리」 음량을 쓴다. 파일이 있으면 글자 삑 소리는 내지 않는다.
줄이 바뀌거나 대사창이 닫히면 멈춘다.

## 강하게 다시 하기(New Game+)와 장 표시 (2026-09-26)

- **클리어 기록.** `triggerEnding` 이 엔딩을 실제로 열 때(이름 있는 호출의 조건이 거짓이면 기록하지 않는다)
  인터프리터는 `returnToTitle` 스텝에 `clear: { endingId }` 만 싣는다. 에필로그가 있으면 그 끝의 합성 `ending`
  명령이 같은 값을 싣는다(모듈 WeakMap 표식 — 저작된 `ending` 명령은 클리어가 아니다). 인터프리터는 저장소를 모른다.
  씬(`playSceneInterpreter`·`playSceneSchedulers`)은 `reportEndingClear` 로 레지스트리 콜백 `recordEndingClear` 를
  부르고, 플레이어가 `src/player/clearRecord.ts` 로 localStorage 에 `ClearRecord { endingIds, clearedAt, carry }` 를 쓴다.
- **키.** `clearRecordKey()`(saveSlots.ts) — 세이브와 같은 게임별 규칙: 발행 게임은 `…:lineage:<id>:clear-record:v1`,
  내보낸 게임은 `<saveNamespace>:clear-record:v1`, 편집기는 `oprn:clear-record:v1`. 내보낸 게임끼리 섞이지 않는다.
- **타이틀.** `system.newGamePlus.enabled` 이고 기록이 있으면 `title-new-game-plus` 가 「새 게임」 바로 뒤에 선다.
  이름은 `menuLabels.newGamePlus` > `newGamePlus.label` > 「강하게 다시 하기」. 고르면 `startGame({ newGamePlus: true })`
  → 새 세션에 `applyClearCarry`(project/newGamePlus.ts): carry 로 고른 레벨·경험치/스킬/장비/소지품/소지금만 입히고
  (삭제된 배우·아이템 id 는 버림, 레벨이 오르면 최대 HP/MP 재계산) `session.flags.ngplus = true`.
  스위치·변수·상자·맵 상태·위치는 새 게임 그대로다.
- **엔딩 조건** `{ kind: "newGamePlus", value }` 는 `EndingCondition` 전용(일반 `Condition`/`CONDITION_KINDS` 에는 없다)이고
  트리거 시점의 `flags.ngplus` 를 본다.
- **장 표시.** `system.chapter = { variableId, labels }` — 현재 변수 값의 이름이 ESC 메뉴 머리 `status-menu-chapter` 에 보이고,
  저장 스냅샷 메타 `chapterLabel`(선택, 스키마 버전 그대로 — 옛 세이브는 필드 없이 읽힌다)로 남아 불러오기 카드
  `save-slot-N-chapter` 에 보인다.
- 검증: `node scripts/runtime-qa.mjs --scenario ct-ngplus`(픽스처 `scripts/qa/runtime/ct-ngplus-fixture.mts` 는 runTool 만 쓴다).

## 탈것 — 소형선·대형선·비행선 (2026-09-26)

- **저작.** `system.vehicles?: { id: "boat"|"ship"|"airship"; characterIndex; mapId?; x?; y? }[]` (생략 = 탈것 없음, 기존 프로젝트 동작 그대로).
  정규화 `normalizeVehicleConfigs`(`src/project/vehicles.ts`)가 화이트리스트에 들어 있어 왕복에 살아남는다. 편집기 도구 `place_vehicle`.
- **세션.** `session.vehicle?: { boardedId?; positions?: { [id]: { mapId, x, y, direction? } } }`. 탄 탈것은 주인공과 한 몸이라 위치를
  적지 않고, 세운 자리는 positions → 저작 위치 순으로 푼다(`vehicleLocation`). 세이브 스냅숏 `session.vehicle` 은 있을 때만 쓰고,
  불러올 때 없으면 **지운다**(이전 세션의 탑승을 끌고 오지 않는다). 파서 `parseVehicleSessionState`.
- **타기·내리기** (`src/player/playSceneVehicles.ts`). 걷는 중 확인 키는 정면(없으면 발밑)의 세운 탈것이 조사보다 먼저다.
  타면 주인공이 그 칸으로 옮겨 가고 `resolvePlayerSpriteResource` 가 `tex_easyrpg_charset_vehicles` 의 칸을 돌려준다;
  `syncFollowerSprites` 는 탑승 중 동료를 그리지 않는다. 탄 채로 확인 키는 내리기뿐이다: 배는 정면의 걸을 수 있고 막는
  이벤트가 없는 칸으로 내리고 배는 그 칸에 남는다; 비행선은 통행 가능한 칸이면 그 자리에 내려앉는다 — 지형 기록이 있는 칸(태그 1..N)은 그 `airshipLand` 를 따르고, 태그 0 보통 땅은 기록이 없어 허용이다. 기본 지형 기록은 **순서 = 타일셋 태그 − 1** 로 [물(배 허용·착륙 불가), 모래, 눈, 돌] 이다(2026-09-27 이전 기본값은 [초원, 숲, "사막"=terrain_water] 이라 기본 물 위로 배가 못 다녔다; 저장된 프로젝트는 자기 기록을 그대로 쓴다).
  내리면 동료 궤적이 `placePlayerOnCurrentMap` 으로 새로 깔린다. 명령 `Get On/Off Vehicle` 은 인터프리터 스텝 `{kind:"vehicle", boarded}`
  로 같은 함수를 부른다(전경·병렬 양쪽). 조건이 안 맞으면 아무 일도 없다.
- **통행.** 탑승 중 `tryStartVehicleStep` 이 일반 걸음(턱·밀기·반복 맵 접기 포함)을 대신한다. 배는 지형 레코드 `vehiclePassage.boat/.ship`
  이 참인 칸만 가고 같은 층 이벤트에 막힌다(접촉 트리거는 발동하지 않는다). 비행선은 맵 안이면 어디든 간다. 대형선·비행선은 걸음 프레임이
  절반(2배속), 소형선은 걷기와 같다. 비행선 걸음은 지형 피해·접촉 트리거·인카운트를 건너뛴다(구역 드나듦은 판정한다).
- **그림.** 세운 탈것은 이 맵에 있을 때 `syncVehicleSprites` 가 캐릭터 깊이 규칙으로 그린다(`loadMap` 뒤, `refreshRuntimeSurfaces`).
  `Set Vehicle Location` 은 세운 자리를 옮긴다(맵 비우면 현재 맵; 탄 탈것은 옮기지 않는다). 프리로드는 `system.vehicles` 가 있으면
  탈것 시트를 싣는다 — id 만 저장하므로 문자열 수집에 안 걸린다.
- **남은 것.** `Change Vehicle Graphic` 은 여전히 플래그만 쓴다. 비행선 고도 그림자·탑승 BGM·맵 이동 중 탑승 유지 전환은 없다
  (다른 맵으로 옮겨도 boardedId 는 유지되고 주인공이 그 모습으로 도착한다).
- 검증: `node scripts/runtime-qa.mjs --scenario ct-vehicle` (픽스처 `scripts/qa/runtime/ct-vehicle-fixture.mts`). 관측 축
  `playerTextureKey`·`followerSpriteCount`·`vehicleBoarded`·`parkedVehicleSprites` 는 `scripts/lib/runtimeQa.mjs` 에 있다.

## 명작 공백 G3 — 난이도·타이틀 변형·파티 묶음·스킬 장착·조합·몬스터 교환 (2026-09-27)

쯔꾸르·JRPG 명작 20편 대조 공백(#12 #14 #17 #18 #19 #22)을 채웠다. 모두 옵트인이라 새 필드가 없는 옛 프로젝트는 그대로다.

- **난이도(#19)** — `system.difficulties: DifficultyRecord[]`(적 HP·공격·EXP·골드·인카운트 배율, 1 = 그대로, 0.1~10으로 자른다)와 `defaultDifficultyId`.
  두 줄 이상이면 새 게임이 선택 창(`title-screen[data-screen=difficulty]`, `difficulty-option-<id>`)을 연다. 세션은 `difficultyId`를 들고 다니며
  명령 `setDifficulty`로 바꾸고, 페이지·분기 조건 `difficulty`로 읽는다. 배율은 `src/project/difficulty.ts`에서 전투 개시·보상·인카운트에 곱한다.
- **타이틀 변형(#17)** — `system.titleScreen.variants: TitleScreenVariant[]`. `when`은 `endingSeen` / `clearCount(atLeast)` / `saveMapId`이고 **위에서부터 처음 맞는 줄**이
  배경·음악을 덮는다(`src/project/titleVariants.ts`). `titleScreen.resumeOnLaunch`면 가장 최근 저장(자동 저장 포함)으로 타이틀을 건너뛰고, 불러오지 못하면 타이틀로 떨어진다.
- **파티 묶음(#22)** — 명령 `storeParty` / `recallParty`(`partySetId`). 멤버와 맵 위치를 함께 저장하고, 지금 파티는 `activePartySetId`로 자동 저장된 뒤 바뀐다(FF6 3분할, 콥스파티 분기).
- **스킬 장착(#18)** — `ActorRecord.loadoutSlots`(1~12). 있으면 전투는 **장착한 스킬만** 쓰고(`applySkillLoadoutsToBattlers`), 메뉴 스킬 화면에서 장착을 바꾼다. 생략 = 배운 스킬 전부.
- **아이템 조합·대상 사용(#12)** — 메뉴 아이템 화면의 「조합」이 `craftRecipes`를 두 재료로 찾는다(`combineItems`). 「바라보는 대상에 사용」은 정면 이벤트를 실행하며
  세션 `itemUsedId`를 걸어 두고, 그 이벤트 페이지가 조건 `itemUsed`로 반응한다(`src/player/itemUseOnTarget.ts`).
- **몬스터 방출·교환·합체(#14)** — 명령 `removeMonster`(인스턴스 놓아주기), `tradeMonster`(종 A 한 마리 → 종 B), `fuseMonsters`(`system.monsterFusions` 규칙으로 둘을 하나로).
  세 명령 모두 저장 왕복을 고정하는 계약 테스트가 `test/commandContracts/`에 있다.

검증: `test/mgL7sys*.test.ts` 6개와 계약 테스트 6개. 출하 플레이어 화면 증거는 `scripts/qa/runtime/masterpiece-system.scenario.mjs`(난이도 선택 → 흑백 필터 → 롤링 HP·움직이는 배경 → 라이브라).


## 오프닝 fade 표시 시간과 장면 유지 시간 (2026-10-03)

`cinematicSequence.ts`는 pan/zoom에 전체 장면 유지 시간(`--cinematic-motion-ms`)을 쓰고,
fade에는 별도 `--cinematic-fade-ms`(최대 600ms, 더 짧은 장면은 해당 시간)를 쓴다.
기존 fade는 6초 장면의 끝에야 그림이 온전히 보였고 수동 장면은 8초 동안 어두웠다.
양의 타이머, durationMs:0 확인 대기, 키보드 소유권, 음악 수명, reduced-motion은 유지한다.
실제 출하 브라우저에서 수정 전 1.4초 투명도 0.25/0.20과 수정 후 0.7초 투명도 1을 확인했다.
증거와 재현: `verify-shots/monster-assistant-opening-2026-10-03/`,
`scripts/qa/runtime/opening-assistant-native.cjs`. 전체 테스트/게이트 실행 결과가 아니다.

한국어 시네마틱 자막은 `word-break: keep-all`로 단어 사이에서 줄을 바꾸고,
한 단어 자체가 무대보다 길 때는 기존 `overflow-wrap:anywhere`로 넘침을 피한다.
24.5초 도입의 초대 문장에서 “기다린/다”로 갈라지던 실제960×720 화면을 근거로 수정했다.

## Original monster campaign journal and field menus (2026-10-03)

Optional `system.monsterCampaign` exposes ESC → 기록 → 몬스터 도감 / 지역 지도 / 배지·목표.
Journal seen/caught receipts persist in the existing session switches, remain after
boxing/release/evolution, and use actual revealed enemies and committed captures.
The map follows authored coordinates and real transfer connections; badges and
next objectives read live switches. Unknown species hide name and art. Ownership,
source routing and bounded browser evidence: [monster-campaign-menu.md](monster-campaign-menu.md).

## Monster party common UI dogfood follow-up (2026-10-03)

When `system.battleParty === "monsters"` or legacy `monsterBattleParty === true`,
common menu overview/status/skills and medicine shop previews derive from live
`monsterParty` instances rather than the field actor. `playerMonsterPartyModel.ts`
normalizes legacy missing skill/PP data using the same monster collection rules
as combat, resolves types through authored database element names, and exposes
current HP, current total PP, battle stats and known moves. Actor RPG projects
retain their actor paths. Actor equipment/row/formation commands are hidden only
for monster party projects because those controls cannot modify monster battlers.

ESC → 파티 → 몬스터 → Enter opens the current instance detail (art, type, HP,
effective stats, known moves/current PP); explicit 보관함/파티 이동 is a separate
row. Esc returns to the prior list and preserves its cursor. Pending move replace
and reject choices remain available. The menu rejects boxing the last valid party
monster in monster battle mode, gives a reason, and refreshes runtime surfaces
following successful party movement. This UI guard does not forbid authored
interpreter commands or external tools from intentionally clearing a party.

Save `partyLevel` metadata follows the leading monster in monster party mode.
Medicine purchase previews model one virtual owned copy without mutating session,
and call the shared `previewMonsterMedicine` eligibility/HP/PP rules. Shop party
cards use current monster identity/art; unavailable effects keep their reason.
Regression coverage is authored in `test/monsterPartyMenuDogfood.test.ts` (both
party flags, empty party, inspect-before-move, known moves/PP, last-member reason,
shop preview purity, save/load UI state, element labels, actor path compatibility).
Tests were not run by the worktree agent under AGENTS.md session restrictions;
shipping-player dogfood verification is owned by the integrating supervisor.

## Collector supply shop (2026-10-04)

`collector` is an authored white pixel supply-counter skin, sharing native commerce,
quantity selection, buy/sell, budget, inventory and keyboard handlers. It removes
actor equipment party preview from this surface; prices/merchant budgets are unchanged.
`effectiveShopUiPreset(step, project)` resolves explicit `meta.oprnShopPreset`, then
event preset, then pixel. The project override is serialized through older hosts
without writing an unsupported enum into their shop commands. `configure_shop_presentation`
selects it or clears it with event-default; read_game_systems shows effective counts.
The editor command picker also exposes collector for hosts that accept the current
schema. configureMonsterPresentation authors collector for future collector games.

Native supply-shop QA found a preserved0G capture-ball sell-price override, despite
an80G catalog buy price. `set_sell_prices` changes that real authored table; this
campaign now authors40G. Presentation tools do not invent prices. read_game_systems
exposes sellPriceOverrides and the system review fingerprint includes that table.
Collector detail uses one column and omits equipment comparison controls for supplies.
Native Tab→ArrowRight→Enter switches buy/sell. Real pointer clicks remain blocked by
the existing runtime input policy; test with the supported keyboard, not synthetic clicks.
