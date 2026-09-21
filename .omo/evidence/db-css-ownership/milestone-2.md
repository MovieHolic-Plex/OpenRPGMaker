# Milestone 2: frozen-checkpoint handoff, NOT R1-R8 completion

## Checkpoint state

- Worktree: /home/main/z-project/rpg-zzu-db-css-ownership-20260906
- Branch: agent/db-css-ownership-20260906
- Last verified implementation commit: e80eb71089bbfb245b688e396ed65831eedc70b3.
- No amend, push, PR update or merge was performed by this child.
- All subsequent implementation, tests, inventory and evidence remain preserved
  in this worktree. No second implementation commit is made: the extended browser
  suite is not green, and the last six CSS cleanup edits postdate the full build.
- Source is stable to freeze for independent inspection and continuation. It is
  NOT a verified-green final checkpoint and is NOT ready for approval/merge.
- The last browser runner completed with exit 1 (five failures). No validator is
  intentionally left running. The owned Vite server remains on 10331, PID 661511.
  Its frozen transform cache predates the final CSS edits: restart ONLY that owned
  server before validating this working tree. Never use the root's 9841 server.
- Parent-authored initial-review.md remains unchanged after inclusion in e80eb710.

## Completed implementation since e80eb710

- Shared actor/enemy section classes replace their competing navigation chrome.
  Shared navigation lives in workspace-modern.css; CRUD states/chrome in Studio
  v2. Obsolete actor tab class and duplicate legacy CRUD/ghost/card declarations
  were removed, not hidden under a new final stylesheet.
- Shared captions use 12.5px. Classless readability rules exclude captions;
  nested native numeric labels inherit the caption; specialized caption font
  declarations were removed while keeping their column composition.
- 387 literal font consumers were replaced or superseded by existing role tokens.
  The guard now includes database/component-loaded sheets, external DB owner
  sheets, complete shorthand aliases and family aliases. No dependencies changed.
- Classes/Troops: removed legacy form margins (4px + 8px), removed outer scroll
  rules, and allocated the Troops notice plus workspace within bounded rows.
- Bare Life numeric fields retain their existing change-only callback and regain
  native spinners. Shared numeric composites alone suppress the native spinner.
- The existing all-tabs render test is a required surface-gate axis and derives
  its 32 primary destinations directly from TAB_GROUPS.

## Completed validators and exact results

### Primary matrix and shared roles

Command:
~~~sh
DEV_SERVER_PORT=10331 E2E_RETRIES=0 npm run test:e2e -- --config playwright.db-css.config.ts --project firefox --grep 'equivalent shared|required 32-primary'
~~~
Exit 0; 2 tests passed in 9.0m. The matrix covered all 32 actual primary
sidebar destinations at 1440x900 and 1024x900 (64/64 cases); missing/empty bodies,
registry mismatch and modal geometry changes fail the contract. The companion
role/caption/Classes-Troops test passed. Original rendered RED had 14 failures.

This is an INTERMEDIATE source capture, not a final-source pass:
- revision: e80eb71089bbfb245b688e396ed65831eedc70b3
- source diff SHA256: 3305f62305bfed36c7888d70a5a07aa94c6c4b1585c5abe235559f6ee023b52b
- server PID at capture: 343346; cwd: /home/main/z-project/rpg-zzu-db-css-ownership-20260906
- Full per-control/computed/overflow/image JSON:
  output/evidence/db-css-ownership/primary-matrix.json (64 cases).
- 64 screenshots: output/evidence/db-css-ownership/<destination>-<width>.png.
- Log: /tmp/db-css-matrix1.log.
- Later native-spinner and final duplicate/card/CRUD cleanup edits require a
  fresh matrix before final acceptance.

### Related tests

Command:
~~~sh
npm test -- test/fontFamilyTokenGuard.test.ts test/databaseAllTabsRenderWalk.test.ts test/databaseNumericLabelTrust.test.ts test/databaseControlsNumberField.test.ts test/databaseModernControls.test.ts test/databaseStudioV2.test.ts test/databaseRadioCustomGuard.test.ts test/databaseSelectChevronGuard.test.ts test/databasePartyBuildStudio.test.ts test/databaseEnemyActionDialogTrust.test.ts test/databaseEnemyDialogFocus.test.ts test/databaseLifeCraftingView.test.ts test/databaseSpeciesSearchNavigation.test.ts test/databaseListGeometry.test.ts test/databaseListVirtualizer.test.ts test/databaseInventoryCatalog.test.ts test/databaseImageFailurePlaceholder.test.ts test/databaseAnimationFrameSelect.test.ts test/databaseAnimationCellStaleClosure.test.ts test/databaseAnimationCacheLifecycle.test.ts test/databaseConceptFirstNav.test.ts test/databaseSystemStudio.test.ts test/databaseWorldCanonView.test.ts
~~~
Exit 0; 23 files, 266 tests passed. Log: /tmp/db-css-related-final.log.
Earlier focused font guard: 9/9 passed; numeric primitive suites: 56 passed.
The pre-existing growth-tree radio guard failure was repaired by narrowing its
focus selector to leave radio chrome with the shared native owner; guard 4/4 passed.

### Typecheck/build/CSS/diagnostics

- npm run typecheck:app: exit 0, /tmp/db-css-typecheck2.log.
- npm run build: exit 0, /tmp/db-css-build2.log. App/player/standalone built.
  Existing circular-chunk, mixed import, unresolved runtime asset and chunk-size
  warnings remain. This build predates the final six CSS-only cleanup edits;
  do not call it a final-source build. Earlier e80eb710 full build also passed.
- At the handoff boundary, npm run audit:db-css-ownership: exit 0;
  npm run gates:css: exit 0; node --check scripts/audit-db-css-ownership.mjs:
  exit 0; git diff --check: exit 0.
  Logs: /tmp/db-css-checkpoint-inventory.log, /tmp/db-css-checkpoint-css.log.
- TypeScript/script LSP reported no diagnostics on the changed source/test/script
  files checked. CSS diagnostics could not run because configured Biome is not
  installed. No dependency was installed and no error suppression was added.
  Changed CSS was parsed with PostCSS; CSS budget/graph/live-class gates pass.

### Surface gate: baseline-relative failure, not suppressed

npm run gates:surface: exit 1; 6 failed / 108 passed assertions in 10 files.
The six failed assertion identities are all present in the supervisor's frozen
169-failure baseline. The new required DB rendered axis passed. No baselines
or unrelated prose tests were modified. Full log: /tmp/db-css-surface-final.log.
Exact frozen reference: /tmp/rpg-zzu-css-baseline-20260906.json, base
49067218aebf889d98c2dc05be08231787483427. Supervisor full final gates remain due.

- test/eventEditorCommitProbe.baseline.test.ts :: 이벤트 편집기 커밋 프로브 축 (1) 컨트롤 조작 → 저장 커맨드 스냅샷이 기준선과 같다
- test/eventEditorCommitProbe.baseline.test.ts :: no-commit 래칫 무커밋 컨트롤 집합이 허용 목록과 정확히 일치한다
- test/eventEditorFormSurface.baseline.test.ts :: 이벤트에디터 폼 표면 스냅샷 기준선과 일치한다
- test/eventEditorInteractionSurface.baseline.test.ts :: 이벤트에디터 상호작용 후 폼 표면 스냅샷 기준선과 일치한다
- test/eventEditorM2Surface.baseline.test.ts :: M2 명령 폼 표면 스냅샷 기준선과 일치한다
- test/eventEditorPortalSurface.baseline.test.ts :: 포털(피커/모달) 표면 스냅샷 기준선과 일치한다

## Extended browser command: FAILED, corrections are not yet reverified

~~~sh
DEV_SERVER_PORT=10331 E2E_RETRIES=0 npm run test:e2e -- --config playwright.db-css.config.ts --project firefox --grep 'numeric and native|animation lifecycle|equipment, navigation|rendered contracts reject|CRUD confirmation'
~~~
Exit 1; five tests failed. Full output: /tmp/db-css-target3.log.
The executed tests used an earlier version of the harness. Current working-tree
corrections below have NOT had a green browser run; do not infer one.

1. numeric and native control states preserve input and change semantics:
   180000ms overall timeout; exact assertion expected inline-flex but computed
   flex. Flex-item blockification makes flex the correct computed value. The
   current assertion is corrected. The earlier detached fixture / incorrect
   Life parent-refresh assumption was removed by closing the actual Life modal
   after verifying its real change-only path, then mounting a clearly test-only
   shared-primitive CSS host. Remaining native state/caret assertions need rerun.
2. animation lifecycle, lower panels, keyboard and resource dialog at supported
   heights: Playback frame did not advance. The old observer watched the cell
   node that the real renderer replaces every frame. Current code observes its
   parent cell layer and compares the new cell's style. Wheel lower-panel checks
   ran before this failure, but lifecycle/keyboard/picker coverage is not closed.
3. equipment, navigation, virtualized reveal, variants and distinctive child
   routes: 360000ms timeout during the virtualized-search/reveal section; final
   output also reports target page/context/browser closed. Current test subscribes
   before search and awaits the exact debounced empty-list + restored-focus state
   before navigating. This correction is unverified. Equipment checks and actor/
   enemy navigation/portrait failure checks ran earlier in that test, but no
   whole-test PASS is claimed; System/child-route coverage remains incomplete.
4. rendered contracts reject reintroduced animation and stepper ownership
   conflicts: 120000ms timeout at page.addStyleTag. Mutation rejection is NOT
   proved by this run. The original pre-fix regression RED remains preserved.
5. CRUD confirmation and representative shared text contrast: 120000ms timeout
   at page.evaluate. Confirmation and contrast are NOT verified by this run.

The current dedicated config retains Chromium and Firefox, zero retries, and
explicit owned-server use. It now disables only optional tracing (the prior
trace recorded every Vite module and produced 100MB+ files per failing case).
PNG/JSON evidence and all assertions remain. Per-action deadlines are now 15s
(with explicit 60s boot readiness); this is not a timeout-to-pass conversion.
Do not run concurrent Playwright commands into the same test-results directory.

## Machine-readable inventory checkpoint

- Generator: scripts/audit-db-css-ownership.mjs, exposed by npm run audit:db-css-ownership.
- Artifact: .omo/evidence/db-css-ownership/ownership-inventory.json.
- Parsed declaration nodes: 21345 -> 21144
  (net 201 removed; comments excluded; custom properties included).
- 689 removed/replaced declaration mappings;
  105 CSS/component-load edges; 200 retained-important entries with group justifications.
- Explicit role chrome declarations / contributing files:
  steppers 53/3 -> 34/2 (System remains a variant);
  caption typography 28/10 -> 9/3 (animation/System remain variants);
  section chrome 35/5 -> 14/2 (Life badge state retained);
  CRUD chrome 78/10 -> 18/2 (tileset disabled-state variant retained).
- These are source inventory metrics, not a complete computed-cascade or pixel
  equivalence proof. Final semantic mapping review remains: in particular the
  removed db-ws-row border-radius currently maps to the broad cards role and
  should be refined to the surviving list-row rule. Import/retained-important
  classifications also need the final review requested in R1.

## Remaining R1-R8 acceptance on resume

- R1: refine/audit declaration-to-owner mappings (notably list row), document the
  final owner table and retained-important groups, update focused wiki/DESIGN
  ownership notes, regenerate final inventory against the frozen implementation.
- R2: rerun corrected lifecycle tests at 1440x900, 1024x900 and 1024x768; complete
  after-battle/return/reopen/playback, timing/sheet keyboard/picker evidence.
  Classes/Troops main-scroller correction has an intermediate rendered PASS.
- R3: rerun the corrected full native/disabled/bounds/decimal/empty/change/caption/
  caret/collapse test. Basic item stepper 32px is independently verified in e80eb710;
  populated Life native appearance RED and change-only path are recorded, not a
  full final native-state PASS.
- R4: finish rendered disabled/destructive confirmation and complete interaction
  state checks. Basic equivalent actor/enemy/shared navigation and CRUD sizing
  passed the intermediate test; no final acceptance yet.
- R5: finish long-label/native-relationship browser checks at both widths after
  current harness corrections. Intermediate item/enemy/Life captions are 12.5px.
- R6: complete representative computed project-font/mono/runtime preview checks
  after readiness. Expanded source guard passes; computed System case not finished.
- R7: run the entire final-source 64-case matrix and all targeted tests in one
  reliable run; prove the deliberate CSS mutations fail the shared contracts;
  validate mandatory DB coverage failure behavior and preserve all existing tests.
- R8: complete Equipment/gallery/virtualized reveal, System 1024x768, actual child
  routes, tileset/world/runtime/empty/error variants, Escape/focus, contrast,
  final changed-file diagnostics/typecheck/build and supervisor assertion-level
  full-gate comparison. Bind final evidence to the frozen revision/server.

No screenshot has received pixel-level visual approval. Both supervisor provider
paths failed to receive pixels. Retain screenshots for human review; DOM/computed
and event evidence is not an aesthetic PASS. No remote LegacyDb game writes were
performed: test contexts use freshProject and abort non-GET/HEAD/OPTIONS requests.

## Changed paths preserved after the first implementation commit

- package.json
- playwright.db-css.config.ts
- scripts/check-surface-gates.mjs
- src/editor/panels/actorRecordView.ts
- src/editor/panels/databaseEnemyStudio.ts
- src/editor/panels/databaseLifeCraftingView.ts
- src/styles/database/actors.css
- src/styles/database/battle-studio.css
- src/styles/database/core.part-1.css
- src/styles/database/curve-editors.css
- src/styles/database/desktop-record-shell/01-modal-shell.css
- src/styles/database/desktop-record-shell/02-class-layout.css
- src/styles/database/desktop-record-shell/03-class-panels.css
- src/styles/database/desktop-record-shell/04-modern-records.css
- src/styles/database/desktop-record-shell/05-dense-workbenches.css
- src/styles/database/desktop-record-shell/07-utility-tabs.css
- src/styles/database/desktop-record-shell/10-tab-chrome-unify.css
- src/styles/database/desktop-record-shell/11-life-authoring.css
- src/styles/database/desktop-record-shell/13-actor-studio.css
- src/styles/database/desktop-record-shell/14-party-ux-fixes.css
- src/styles/database/desktop.css
- src/styles/database/elements.css
- src/styles/database/enemies.part-1.css
- src/styles/database/enemies.part-2.css
- src/styles/database/enemies.part-3.css
- src/styles/database/growth-tree.css
- src/styles/database/light-theme.css
- src/styles/database/modern-controls.css
- src/styles/database/modern/crops-characters.css
- src/styles/database/modern/enemies.css
- src/styles/database/modern/equipment-items.css
- src/styles/database/modern/factions.css
- src/styles/database/modern/skills.css
- src/styles/database/modern/spatial-collections.css
- src/styles/database/modern/tilesets.css
- src/styles/database/modern/troops.css
- src/styles/database/modern/utility-records.css
- src/styles/database/modern/village.css
- src/styles/database/modern/weather-animals.css
- src/styles/database/overview-dashboard.css
- src/styles/database/play-resolution.css
- src/styles/database/scratch-concept.css
- src/styles/database/sidebar.css
- src/styles/database/states.css
- src/styles/database/studio-theme.css
- src/styles/database/studio-v2.css
- src/styles/database/tabs-a.part-1.css
- src/styles/database/tabs-b-shell-layout.css
- src/styles/database/tilesets-terrain.css
- src/styles/database/tilesets.css
- src/styles/database/title-workbench.css
- src/styles/database/workspace-modern.css
- src/styles/editor/event-editor-legacy.part-1.css
- test/databaseAllTabsRenderWalk.test.ts
- test/e2e/database-css-ownership.spec.ts
- test/fontFamilyTokenGuard.test.ts
- scripts/audit-db-css-ownership.mjs (new, untracked)
- .omo/evidence/db-css-ownership/ownership-inventory.json and checkpoint/RED artifacts
  (new ignored evidence; preserve/force-add explicitly when committing).

All manual source edits were applied through /tmp/apply_patch, the available
patch wrapper in this child toolset. Validator-generated artifacts are retained.
