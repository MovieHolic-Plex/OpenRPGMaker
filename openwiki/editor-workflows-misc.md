> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Other Editor Workflows

> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Map/event search, audio test, help modal, themed dungeons, resource manager, village pipeline, AI chat panel, and other editor workflows.

## Other Editor Workflows

### 팔레트·맵 목록·진행의 표시 비용 (2026-10-04, UX 감사 2차)

근거: `verify-shots/editor-ux-audit-round2-20261004/agents/palette-maps.md`와 같은 폴더
`README.md`의 네이티브 맵 전환/접힌 진행 관측. 기준 커밋은
`7ce9a7655510e82360efe154bc888a0754e06d04`. 아래는 구현 계약이며 수정 후 성능 실측이 아니다.

- `mapList.ts`는 맵 수를 렌더당 한 번 구하고 `RenderNodeContext.canDeleteMap`으로 행에 전달한다.
  행 클릭은 선택 전후 **그 목록 컨테이너의 렌더 판수**를 비교한다. 맵 전환의 동기 구독자가
  이미 그렸으면 명시 갱신을 생략한다. 구독 없는 스위처, 같은 맵 다중 선택, 폴더, 거부된 이동은
  계속 명시 갱신하며 새 행에 초점을 돌린다. 단순히 맵 id가 바뀌었다는 이유로 갱신을 생략하지 않는다.
- 활동 막대의 접힘은 부모뿐 아니라 도구/각 표면의 `root.hidden`에 반영한다. 숨은 진행은 프레임을
  예약하지 않고, 접히기 전에 예약된 프레임도 실제 렌더에서 거른다. 다시 펼치면 현재 프로젝트를 평가한다.
  `countJourneyCommittedEvents`는 `committedEvents`와 같은 포함 규칙으로 **본문을 복제하지 않고** 센다:
  새 초안 제외, 편집 초안은 원본이 있을 때 포함, remote-delete 제외, remote-change 원본 포함.
  이벤트 배열 정체성으로 메모한다(store의 배열/이벤트 불변성 계약). 타일/높이 변경의 새 맵 객체는
  배열을 유지하므로 이벤트를 다시 순회하지 않는다. 이벤트/초안/프로젝트 교체는 새 배열로 무효화한다.
  진행은 scope와 다섯 단계 출력이 같으면 행을 갈아 끼우지 않는다. 테스트 부팅 지문 판정은 기존 규약이다.

진행 회귀 소스: `test/ux2ProgressCommittedCounts.test.ts`(작성만, 실행 안 함).
감독자 네이티브 QA: 같은 크기의 0/2,000이벤트 사본(짧은/긴 명령)을 준비한다.
「진행」 펼침/같은 버튼으로 접힘/「그리기」 각각에서 연속 획과 타일 선택을 비교한다.
접힌 부모와 진행 root가 모두 hidden인지, 숨은 진행 평가/행 교체가 0인지, 펼친 진행의 수 계산이
이벤트 structuredClone을 부르지 않는지 함수별로 확인한다(앱의 다른 복제와 분리).
첫 실제 완료 변화 후 같은 출력의 획은 진행 행을 보존해야 한다. 숨은 동안 이벤트 확정/삭제·
초안 열기/취소·프로젝트 전환을 한 뒤 다시 펼쳐 최신 수/완료를 확인한다. 편집 초안 원본 포함,
새 초안/remote-delete 제외, 테스트 부팅 성공 후 편집의 완료 해제까지 확인하고 새 증거를 남긴다.

맵 회귀 소스: `test/ux2MapNavigationRefresh.test.ts`(작성만, 실행 안 함).
감독자 네이티브 QA: 사본 프로젝트의 20/80/200개 펼친 맵에서 「맵」의 다른 행을 왕복한다.
`map-sidebar-list`의 childList **비우기/붙이기 한 쌍**과 `renderMapList` 1회를 확인한다.
폴더, 같은 맵 Ctrl/Meta 토글, Shift 범위, 1024 상한 초과 맵 거부, 도구의 맵 스위처도
갱신·선택 표시·초점·활성 맵 리빌을 확인한다. 200개는 썸네일 120개 캐시의 교체 비용을 따로 기록한다.

### 첫 사용자 시작과 저장 안내 (2026-10-03)

- 첫 방문은 `editorWelcome.ts`의 전체 창 장면에서 시작한다. `src/start/firstWorldArrival.ts`를 데스크톱 시작 화면과 공유한다. 장르 선택은 로컬 참고 장면을 전환하고 첫 문장 입력창만 연다. 선택만으로 연결·인터뷰·저장·AI 호출을 하지 않는다.
- 전체 화면은 배경이 viewport에 고정되고 소유자(`editor-welcome-first-world` / launcher `is-first-world`)가 격리된 스택을 제공하는 구조다. 폭 제한은 내용에만 적용한다. 편집기의 1060px 창·흰 여백·별도 scrim은 제거했고, 브랜드/장르/어두운 입력창/보조 경로를 같은 장면에 배치한다. 낮은 데스크톱 창에서는 간격을 줄이고 좁은 화면은 세로 스크롤을 허용한다. `verify-shots/first-world-fullscreen/`은 화면 크기별 실제 viewport 캡처다.
- ‘이 이야기로 시작’을 누르면 AI 연결 관문 → 기획 인터뷰로 이어지고, 원문은 인터뷰의 `initialAnswer`로 전달된다. 연결을 미루거나 인터뷰를 취소하면 선택과 문장을 유지한다. 연결 관문이 없는 호출에서 `canGenerate()`가 false면 연결 안내와 설정 버튼을 표시한다. 장르를 고르지 않은 자유 입력도 제출 시 연결을 확인하고 기존 조수 경로로 넘긴다.
- 장면은 기존 `public/assets/project-interview/` 그림·영상이다. 움직임 끄기는 로비와 같은 설정을 쓰며 OS 모션 감소·문서 가림을 반영한다. 페이지 종료 때 영상과 리스너를 정리한다. 참고 그림의 등장인물은 저자의 주인공 설정이 아니다.
- 각 장르 포스터 아래 `AI 없이 직접 만들기`는 작은 ⚙를 대체한다. 확인 창에서 빈 맵과 장르 기본 설정을 저장함을 설명하고, 실제 `store.flush()` 성공 후에만 환영 창을 닫는다. `mode.ts`의 성공 안내는 그리기 → 테스트 순서를 제시한다.
- 환영 창은 `modalStack`에 등록하고 Tab 순환을 제공한다. 중첩 인터뷰/확인은 자신의 Escape만 처리한다. 저장 적용 중 Escape는 환영 창을 닫지 않는다.
- `welcomeGenreSystemPresetAction.ts`는 새 시드를 채택하기 전 `prepareProjectMedia`로 inline 소재를 한 파일씩 저장하고 ref로 바꾼다. 공용 소재를 포함한 시드를 곧장 복제/직렬화하면 153MB JSON 저장 직전 renderer V8 OOM을 재현했다. 준비 실패/대상 폴더·projectId 변경이면 채택하지 않으며 기존 열린 문서는 유지된다. 채택 직전에도 대상과 원래 열린 문서 객체·버전을 다시 확인해 준비 중 로컬 편집/동료 갱신을 덮어쓰지 않는다. 준비 중 안내를 표시한다. 계약 회귀는 `test/persistence/prepareProjectMedia.test.ts`.
- 저장 칩은 `프로젝트 저장`/`저장 위치 없음`/`임시 작업 · 저장 안 됨`을 구분한다. 임시 세션은 파일 내보내기를 안내한다. 도움말과 README도 같은 용어를 쓴다.
- 프로젝트 메뉴의 `백업에서 복구...`는 목록 선택 → 검증한 새 사본 생성 → 현재 작업 저장 → 새 사본 열기다. 진행 안내를 표시하고 복구/저장 동안 열린 대상이 바뀌면 새 대상은 유지한다. 현재 저장 실패 시 사본은 남기고 현재 화면을 유지하며 내보내기/열기를 안내한다. 선택 취소는 쓰기를 하지 않는다.
- 복구 UI: `src/editor/ui/backupRestoreDialog.ts`; 저장소 계약은 `team-project-host.md`의 백업과 이전 절. 회귀 사례는 `test/editorWelcome.test.ts`, `test/localStore/recovery.test.ts`에 추가했다. 테스트 실행은 감독자/사용자 지시를 따른다.
- 첫 문장 화면 증거: `verify-shots/first-world-arrival/`와 `scripts/capture-first-world-arrival.mjs`. 실제 컴포넌트의 연결/인터뷰 취소, 원문 인계, 장르 변경, 직접 만들기 확인과 저장 대기, 320px·모션 감소, en/ja/zh를 확인했다. 저장·연결 콜백을 격리한 브라우저 확인이므로 실제 AI 생성이나 SQLite 저장 증거는 아니다.

### New-project name and player title (2026-09-07)

`store.loadNewRemoteProject` and `store.loadNewRemoteProjectTransactionally`
apply an explicit project name to both `meta.title` and an absent/default
`system.titleScreen.title`. A deliberately different player title is preserved;
existing projects are not renamed on load. The transactional path names its
cloned candidate before saving, so remote verification covers the player title
without mutating the caller's seed. Regression tests:
`loadNewRemoteProject.test.ts`, `transactionalNewRemoteProject.test.ts`.

### 걸을 때 적 만나기 — rectangle authoring (2026-09-06)

- Select with the sidebar's **선택** tool and left-drag, then click the visible
  **걸을 때 적 만나기** selection chip. Right-drag/context entry is also available,
  but right-click knowledge is not required. The always-visible canvas button
  with the same label opens the region list and offers **맵에서 범위 선택하기**.
- The worksheet contains selected **groups**, not individual monsters. **+ 그룹 추가**
  opens a searchable existing-group picker (name, ID or composition). Rows show
  group name, member thumbnails/counts, direct weight and live normalized relative
  share. Authored `members` take precedence over legacy `enemyIds`; hidden members
  are included and labelled. Already-selected groups cannot be added again; legacy
  duplicate condition variants remain separate rows. No troop generation or AI call.
- Each row has its own **출현 조건** disclosure exposing named switch, variable
  threshold, party's highest level range, time phase and season. These remain the
  existing `encounterTable[].conditions.region` rectangles, not a new schema.
  Time/season conditions require game-time configuration. Overlapping rectangles
  and unconditional table rows mix by eligible relative weight.
- Frequency is **map-wide**, 10/30/60 respectively, not a per-area probability or
  an exact step count. Existing positive rates are retained by default; zero is
  lifted to normal when saved. Terrain can modify the effective rate. Real-time
  action-combat maps reject this flow, because that runtime does not start random
  turn-based encounters. Tiles must be walkable; this feature does not paint grass.
- First conversion from legacy `troopIds` requires an explicit decision:
  **맵 전체 출현도 유지** copies the existing list to unconditional table entries
  (including duplicate weighting); **기존 전체 출현 대신 선택한 범위만** clears the
  old list. Undo restores it. Existing tables and other rectangles are preserved.
  On imported tables with dormant `troopIds`, deleting the last table region
  explicitly warns/asks about restoring the old map-wide encounters.
- Indigo outlines are editor-only and excluded from map-only capture. Open the
  canvas region list for **편집 · 삭제**. To replace bounds, make a fresh selection,
  reopen the list, and choose **현재 선택으로 범위 바꾸기**, then confirm in the form.
  Identical rectangles are one group; a move onto an existing identical rectangle
  is rejected rather than silently merging groups. Delete requires a second click
  and removes only those rules, never tiles or shared/generated troops.
- On another selection, **마지막 설정 가져오기** copies group IDs/weights/conditions
  from the last successful save in this project session; destination-map frequency
  is retained. This memory is not persisted and resets on project switching.
- Owner: `src/editor/walkEncounterAuthoring.ts` validates before one map-only snapshot and one
  labelled map-scoped `store.update`. It never mutates `database.troops`, including
  old automatically generated troops. Undo does not revert unrelated group edits.
  `src/editor/panels/walkEncounterModal.ts` / `src/editor/panels/walkEncounterOptions.ts`
  own local drafts and native subdialog-stack/focus/Escape. Cancel is mutation-free.
  Weight input updates only output nodes, preserving focus/caret. Relative shares
  describe the current worksheet, not actual conditional/overlapping eligibility.
  Missing groups stay visible and block save; replace/remove is explicit.
  Group edit opens the existing Troops database, then reveals the chosen record
  (first-open session reset requires this order). A narrow `openDatabaseModal`
  onClose callback restores the same in-memory draft; initial and apply-time stale
  validation blocks project/map/settings changes. The encounter modal is closed
  while DB owns Escape. Empty databases offer direct group editor entry.
  `src/editor/hotkeys.ts` prevents
  editor shortcuts/project undo from leaking into these draft dialogs.
  Project identity, map, map dimensions, encounter table/rate/legacy list, references
  and locks are rechecked on apply. Unrelated tile/name/database edits are retained;
  changed encounter settings require closing/reopening, not a stale overwrite.
- Coverage: `test/walkEncounterAuthoring.test.ts` and `test/walkEncounterModal.test.ts` cover
  real store/history/load/runtime eligibility and DOM actions. Browser scenario:
  `DEV_SERVER_PORT=<supervisor-port> E2E_RETRIES=0 npx playwright test
  test/e2e/walk-encounter-authoring.spec.ts` (1024/1280/1440, blank local project,
  no remote content writes). It subscribes before selection/mutation triggers and
  captures worksheet/picker/per-row condition forms. On Linux Firefox hosts that abort the large dev
  CSS module, `WALK_QA_ROUTE_CSS=1` transports that unmodified response through
  Playwright's request client. Controls are hit-tested and clicked with real
  pointer coordinates; no forced clicks or fixed sleeps. Supervisor owns
  execution and visual acceptance.

### Game export delivery (2026-09-06)

#### Versioned publication (opt-in)

- `프로젝트 → 게임 및 배포` stages preparation, version label, explicit engine
  upgrade, fork and accepted save lineages. Apply uses the normal annotated store
  mutation; Cancel/Escape does not persist the draft and restores opener focus.
  Upgrade offers only the installed engine, starts a new save lineage, and offers
  an explicit checkbox to accept its immediate predecessor. No marketplace or
  anonymous listing mutation is introduced. Test Play labels itself a current
  editor-engine preview, not a selected-engine preview.
- `.runtime-archive/<sha256>/` is operator-controlled, append-only storage outside
  destructive `dist`. It retains web, standalone, both SDK manifests and public
  assets. Back it up and deploy it with the editor/community operator data; never
  populate it from uploads. `runtime.json` binds Project4, Save4/5/6 and collector
  contract 1. Unsupported metadata or missing targets fail without substitution.
  Collector behavior changes must bump that contract; old targets must not be
  reinterpreted with a different collector.
- Current runtime factories/retention append `capabilities` to the canonical
  runtime body, currently `["community-save-isolation-v1"]`. The target digest
  therefore binds both executable inventory and capability claims. The optional
  versioned-token list is extensible independently of `collectorVersion` (still
  1); no dependency collector change is implied. Parsing an old manifest leaves
  the field absent and verifies its original canonical digest. Standalone's
  embedded verifier hashes the complete runtime body, including capabilities
  when present, and accepts honest old manifests for offline export. Only new
  community uploads require the isolation capability from operator provenance.
- `npm run build` retains both freshly built variants. For runtime-only work:
  `npm run build:player && npm run build:standalone:bundle && npm run archive:runtime`.
  Retention runs the existing SDK/deployment/source/secret checks, compares the
  standalone SDK against the same sources, copies one file at a time and rehashes
  the staged inventory before atomic installation. A duplicate digest verifies
  the existing bytes rather than replacing them. `default.json` alone is mutable.
  Dev reuses the retained default only after verifying both SDKs, all archived
  bytes, current repository source inputs and the complete mutable public directory
  (including files outside the SDK source inventory). A matching default requires
  no build, copy or pointer write. Missing/stale/corrupt defaults trigger a build;
  a failed build returns an error, not the stale default. Each request flight is
  revalidated because operator archive writes are deliberately unwatched.
  The response contains the target actually verified, without rereading the mutable
  pointer after verification. Selected-target GETs never build or substitute it.
- `devPlayerBundlesPlugin.config` excludes the entire `.runtime-archive` directory,
  staging directories and retained descendants before Vite creates its watcher.
  Ignoring only the plugin's revision counter is insufficient: archived HTML writes
  otherwise trigger Vite full reloads and discard the live publishing modal/draft.
  Existing ignore rules and an explicit `watch: null` are preserved. Regression:
  `test/devRuntimeArchive.test.ts` runs a real Vite server and actual SDK/archive
  fixtures, checks watcher exclusion plus ordinary HTML reload delivery, verifies
  builder-free reuse, and rejects changed sources/public bytes/digests/pointers.
- Identity-bearing ZIP exports contain exact prepared project bytes, SDK,
  executable closure and assets plus `release.json`. Its canonical body digest
  excludes the manifest itself. The entire selected runtime's required inventory
  is retained: current conditional pruning cannot prove an older engine's closure.
  Legacy non-publication exports keep their existing pruning tests and behavior.
- Collector-version-2 publication exports use the selected archive's frozen
  `dependency-collector.js`, not `prepared.assets`, to resolve authored dependency
  closure. The self-contained bundle reuses export/resource validation logic and
  freezes catalogs at build time. Both web and standalone SDKs inventory identical
  collector bytes; runtime retention rejects divergence. Development builds and
  production SDK writers emit the companion before inventory/closure verification.
  The current-source SDK inventory includes the collector build recipe. Browser
  and Node deployment validators include only this named companion in addition
  to the exact Vite closure; arbitrary stale executable files remain rejected.
- Standalone HTML keeps inert base64 script/project/style payloads, both SDKs,
  raw CSS, decoded asset hashes, runtime provenance and a release ID. Its bootstrap
  verifies the complete inventory, runtime digest, project identity and original
  versus transformed executable/style bytes before launching. Self-contained
  provenance is not operator trust: community accepts only ZIPs verified against
  its independently retained runtime manifest, never arbitrary uploaded HTML/JS.
- Version-2 standalone provenance also carries the frozen collector, bound to
  both runtime variants. After verifying its hash, the offline bootstrap checks
  authored public/embedded dependencies before appending runtime script/style.
  Coherently removing PNG/music and recomputing the standalone manifest cannot
  bypass this closure. Version-1 standalone manifests keep their old digest and
  bootstrap compatibility; they do not gain eligibility for new community uploads.
- Run visible export/offline/save-load QA with
  `npm run qa:export -- --editor-url http://127.0.0.1:<worktree-port> --publication --out verify-shots/release-versioning`.
  This uses an isolated local project and blocks remote writes. It exercises real
  menu preparation and downloads, verifies the ZIP, plays root/nested URLs and
  `file://`, checks failure surfaces, then checks current-engine Test Play.
  It retains `game.zip`, `game.html`, `release.json` and browser evidence for the
  parent's immutable-community-route QA. Run without `--publication` for legacy.
- `node scripts/qa-publication-controls.mjs <older-release-report> <output-dir>`
  owns an isolated Vite server and Firefox profile. It imports a private copy
  with a retained older runtime, then checks staged upgrade, two viewport sizes,
  cancellation/focus, fork cancellation, and explicit predecessor acceptance.
  The older report and installed default must name different retained runtimes.
- `node scripts/qa-community-release.mjs <private-local-community-origin> <game.zip> <output-dir>`
  uploads the actual editor QA ZIP through the community form, checks its
  immutable redirect and byte-identical download, then plays through the quest,
  sideview battle, save and reload under the community CSP. Use only a private
  local community database. The gameplay fixture explicitly selects `rm2003`;
  an unspecified style can correctly select frontview with no ally sprites.
  QA preserves complete request URLs when matching previously decoded audio
  cancellations; release-qualified URLs can exceed 200 characters.
- `npx vite-node scripts/qa-release-artifact.mts` runs the real ZIP/HTML exporters
  against the retained installed runtime with a narrow blank engine fixture and
  refuses every non-selected-archive fetch. It writes files and a digest report
  under `verify-shots/release-artifact`; it is artifact verification, not browser
  gameplay evidence and never writes to a database.
  `node scripts/qa-release-offline.mjs` then opens that HTML over `file://`, blocks
  HTTP requests, boots and moves through real keyboard input, using prearmed
  DOM/frame signals rather than sleeps. It writes `.qa.json` and a screenshot
  beside the HTML. The full editor-menu/export harness remains the acceptance
  path for authored gameplay and save/load.

- Project menu web ZIP and standalone HTML exports use real production player builds even during ordinary Vite development. `scripts/lib/devPlayerBundles.ts`, registered by `vite.config.ts`, builds both player variants on the first export request; no manual `build:player` step is needed.
- Builds run in production child processes, not inside the editor's development module environment. Concurrent requests share one build; relevant source/public changes invalidate it. Each server owns a temporary output directory under its cache and removes it on close.
- `/export-player/` and `/standalone-player/` requests are handled before SPA fallback. Build failure or an absent file returns an error rather than editor HTML or stale output. The existing menu catches rejected exports before `downloadBlob`; required media failures are no longer an informational warning after a broken HTML download.
- Browser acceptance must begin with these menu buttons and play the downloaded files outside the editor server. See `npm run qa:export` in `openwiki/testing.md`; normal Test Play is a separate adjacent-surface regression.

### Audio descriptions and live resource ownership

The Resource Manager's music/sound categories use the complete shared catalog from
`src/assets/audioResourceCatalog.ts`. Select a row to see its name/tags, editable
effective description/source and editor-only preview. Raw ID follows description.
Search matches names, IDs, tags and descriptions;
the empty-description filter tests the effective value, including deliberate clears.
`audio-description-search`, `audio-description-input` and `audio-description-save`
are the feature's browser test controls.

Save trims new input and writes one project override, including `""`. Restore default
removes the override and restores the shared AI draft if available, otherwise prior metadata.
Source labels distinguish project text, **AI 분석 초안** (`ai-listening`), BGM creative briefs,
metadata-derived descriptions and missing descriptions. AI drafts are not independently
verified acoustic facts; instrument, vocal and numeric claims may be wrong. The synchronous
editor-only overlay and recovery provenance are documented in `openwiki/bgm-catalog.md`.
Explicit empty project overrides beat drafts; no defaults are copied into saves. Neither selection nor preview
authors metadata. Implementation lives in `src/editor/panels/audioDescriptionEditor.ts`,
`audioDescriptionDetail.ts`, `audioDescriptionDirtyDialog.ts` and
`audioResourcePresentation.ts` under the same panels directory.

Dirty row/category/close transitions offer Save, Discard and Cancel. Cancel retains the
input node, caret and selected resource; a refresh doesn't erase a dirty draft.
Project replacement ends the old draft's ownership, and an in-flight import can't write
into another project. The textarea keeps native text undo; project history applies outside
text controls. Escape and focus restoration remain owned by the modal stack.

Successful audio import selects the upload for description editing without changing file
validation. `src/editor/panels/resourceManagerAudioDelete.ts` checks real references before
deleting. A successful deletion removes the upload, matching `ResourceProfile` rows and its
override in one history operation. A blocked deletion leaves all three intact; bundled audio
isn't a file-deletion target. `src/editor/tools/resourceTools.ts` also removes matching
profiles through the tool deletion path.

| Consumer | Shared metadata path |
| --- | --- |
| Map BGM, system/title/battle music and sound slots | `src/editor/panels/databaseResourcePickerDialog.ts` |
| Toolbar audio test dialog | `src/editor/panels/audioTestDialog.ts` |
| Normal event `playAudio` form | `src/editor/panels/eventEditor/commandBodyAdvanced.ts` |
| M2 audio form and command preview | `src/editor/panels/eventEditor/commandBodyM2.ts`, `previewAudio.ts` |
| AI search and detail | `src/assets/resourceSearch.ts`, `src/editor/tools/queryTools.ts`, `src/editor/tools/audioDescriptionTools.ts` |
| Event prompt candidates | `src/ai/eventAudioPrompt.ts`, separate from full-ID eligibility |

An open music/sound picker or audio-test dialog subscribes to project/assets changes, refreshes descriptions and
search results, and invalidates a removed selected ID so it can't be confirmed. Closing the
dialog releases its subscription; switching projects closes it. Reopened consumers use the
latest project. Don't introduce per-surface fallback descriptions or global description storage.
Reopening the audio-test dialog closes the previous instance through its modal teardown,
including its store subscription and audio settings; removing its DOM alone leaks ownership.

The three audio surfaces share `src/editor/panels/audioPreviewPlayer.ts` and the editor-only
`src/editor/panels/audioPreviewSession.ts`, never the gameplay `getAudioEngine` singleton. Selection
does not autoplay. Music loops, sound ends and immediately replays; play/pause,
stop/rewind, current/duration and seek are consistent. Unknown duration disables
seek; sub-second durations show hundredths. Media events, not fulfilled play
promises, establish playing state. Metadata preload is loading without play intent.
Rejected/stale requests and buffering/errors remain visible and accessible.

`src/editor/panels/audioResourcePreview.ts` owns selected/inline reading views; inline removal is
observed with MutationObserver, and project replacement disposes it. No media or
nested play button exists per picker thumbnail. Search retains the selected player.
Dialog/category/project/source teardown releases media listeners, WebAudio nodes
and context. The closed Advanced disclosure owns preview volume/tempo/pan/fade and
reset, not authored values. Native volume follows elapsed media progression for
fade across loops, excluding seek jumps and pauses. Pan requests a CORS-enabled
media/WebAudio route; ordinary cross-origin native playback needs no CORS header.
A CORS error is visible; resetting pan recovers the native route.

Prefixes: `audio-test-*`, `db-resource-picker-audio-*`, and
`audio-description-preview-*` for transport/settings. Authored
`audio-description-reset` remains exclusively Restore default. Manager audio-only
geometry widens the reading/editing rail; its body scrolls above fixed transport.
The event command preview is an honest static summary, never a fake waveform.
Focused contracts: `test/audioPreviewSession.test.ts`, `test/audioPreviewSurfaces.test.ts`.

Coverage includes `test/audioDescriptionEditor.test.ts`,
`test/audioDescriptionLifecycle.test.ts`, `test/audioDescriptionPickerSurfaces.test.ts`,
`test/audioDescriptionCommandSurfaces.test.ts`,
`test/audioDescriptionResourceLifecycle.test.ts`, `test/e2e/audio-descriptions.spec.ts`
and `test/e2e/audio-description-search.spec.ts`. See `openwiki/testing.md` for scoped
browser setup and separate exported-player evidence.


### Genre-neutral authoring launcher and journey (2026-08-24)

- The topbar's four front actions (`Map | Event | Data | Test`) and the matching Ctrl+K commands share `runAuthoringTask` in `src/editor/authoringTasks.ts`. Map selects the real tile drawer/layer, Event selects the real event drawer/layer, Data opens `openDatabaseModal`, and Test dispatches the established `oprn:test-play-window` request. These actions do not require AI.
- Workspace presets remain layout data in `workspaceLayout.ts`, but they are exposed only as `레이아웃` choices in the panel menu. `setWorkspacePreset` changes docks while preserving the current `EditorUiMode`/density; do not turn layout presets back into fake work actions.
- `src/editor/authoringJourney.ts` models `프로젝트 → 맵 → 이벤트 → 데이터 → 테스트`. Evidence is explicit: actually loaded project identity, map change, committed (not draft) event, database/system change, and a successful boot fingerprint for the current committed project. Manual controls on Map/Event/Data record only `acknowledged` and never turn an empty stage into completion. Progress is scoped by an actual loaded LegacyDb project id; projects without a loaded remote row receive a fresh local-session id instead of reusing the config draft's default target.
- **Test Play as a testing instrument (2026-08-25):** the full 시연 실행 window is built for edit→test round-trips, not for a demo run. `testPlayModal.ts` passes `surfaceScaleMode: "fit"` (the shipped player keeps whole-number scaling) and `autoStartRun`, so the run boots straight into play instead of the title screen; the author's last choice persists in `localStorage` (`oprn:test-play-auto-start`). The titlebar carries `test-play-restart` (다시 시작, also **F5** with `preventDefault` so the editor is not reloaded) and `test-play-title` (타이틀부터); both drive the `PlayerRunControls` handle that `renderPlayer` hands back through `onRunControlsReady`, and both are mounted only on the full window — the selected-event and troop-battle shells have no run handle. **Skip-title is a visible option (2026-08-26):** the titlebar checkbox `test-play-skip-title` (타이틀 건너뛰기) shows the stored preference and applies it to the open window (checked → `restartRun`, unchecked → `returnToTitle`); the two buttons keep it in sync, so the preference is never hidden state that silently changes the next launch. `runtimeDebugPanel.ts` is the live instrument: switch/variable/item options are labelled by id when the record name is empty (they used to be skipped entirely, which rendered zero switch options and dead ON/OFF buttons), long lists have filter inputs, and a live readout (`runtime-debug-live-state`) shows map/position/input state without clicking, self-stopping once the panel is detached. The selected switch's current value sits next to ON/OFF (`runtime-debug-switch-value`, `data-switch-value`) and refreshes on the click itself, so an author no longer has to open the full JSON dump to see whether the write landed. Regression: `test/e2e/testplay-runtime-instrument.spec.ts`, `test/playSurfaceScale.test.ts`, `test/runtimeDebugPanel.test.ts`.
- **플레이 서피스가 떠 있는 동안 키보드는 게임의 것이다 (2026-08-30):** 편집 Phaser 게임은 시연 실행 창 뒤에서 계속 살아 있고(`testPlayModal.ts` 는 `trackGlobalGame: false` 로 플레이 게임을 별도 소유하므로 편집 게임은 파괴되지 않는다), Phaser 키보드 플러그인은 `window` 를 듣는다. 그래서 가드가 없으면 **게임에서 걸으려고 누른 방향키가 `EditScene.panWithArrowKey` 로도 들어가** 편집 카메라를 한 번에 6타일(Shift 16타일) 밀어낸다. 사용자에게는 «테스트 끝내고 오니 맵이 사라졌다» 로 보인다 — 실측: 1440×900 / `?freshProject=1` 에서 방향키 24+12회 뒤 닫으면 편집 카메라 `scrollX` 가 323→1123 으로 밀려 100×100 맵이 우하단 모서리 조각만 남았다. 방향키만이 아니다 — 1~7 도구, F5~F7 레이어, +/- 줌, Ctrl+Z 되돌리기가 전부 같은 경로다. 포인터는 `installPlayPointerBlocker` 가 이미 막고 있었고 키보드만 새고 있었다. 소유권 판정은 `hotkeys.ts` 의 **`isPlaySurfaceOwningKeyboard()`** 하나가 갖는다: `.test-play-modal-backdrop`(`openTestPlayShell` 을 지나는 모든 테스트 셸 — 전투 테스트 셸은 `mountBattleScene` 직통이라 `.player-layout` 이 없다) **또는** `.player-layout`(`renderPlayer` 가 마운트하는 플레이 셸, 모달 없는 `enterMode("play")` 까지 덮는다). 소비 지점은 두 곳뿐이고 **`EditScene.ts` 는 손대지 않는다**: `shouldIgnoreEditorShortcut` 과 `historyHotkeyOwnedByPanel`. 후자가 필요한 이유는 `EditScene.handleKeyDown` 이 히스토리 키(Ctrl+Z/Y)를 일반 가드보다 **먼저** 처리하기 때문이다(체크박스 포커스가 되돌리기를 삼키던 결함 대응). `historyHotkeyOwnedByPanel()` 이 소유권을 넘기면 `handleKeyDown` 이 자연스럽게 `shouldIgnoreEditorShortcut` 로 내려가 전부 침묵한다. 회귀: `test/playSurfaceKeyboardOwnership.test.ts`(DOM 소유권 계약 9건), `test/e2e/testplay-editor-camera-ownership.spec.ts`(실브라우저 `__oprnEditCamera` 값으로 단정). 증거: `verify-shots/testplay-editor-camera-ownership/`.
- Test is never completed by its launch click or synchronous `renderPlayer` return. `player.ts` calls `onPlayBootSuccess` only after `PlayScene` readiness; `testPlayModal.ts` then emits `AUTHORING_TEST_BOOT_SUCCESS_EVENT` with the tested project fingerprint. Any map/event/database/system/project mutation invalidates that fingerprint, and a stale success event is ignored. **Broken references no longer discard the evidence (2026-08-29):** `recordSuccessfulTestBoot` used to drop a real boot fingerprint whenever `collectProjectReferenceIssues` was non-empty, which pinned the Test stage at incomplete forever.
- `src/editor/panels/authoringJourneyStrip.ts` mounts as a 32px canvas-corner icon (`authoring-journey-toggle`); the stage list is a popover, not a persistent bottom strip. Broken aggregate project references expose their exact issue list plus a **데이터에서 복구** route. **They are a signal, not a lock (2026-08-29):** the fail-closed `passesAuthoringTestGate()` boundary (`src/editor/authoringTestGate.ts`) is **removed**, along with the Test button's `disabled`/`aria-disabled` state and the `AUTHORING_TEST_GATE_BLOCKED_EVENT` refresh hop. Measured reason: the bundled animation pack leaves stale projects with ~18 dangling `anim_gen_*` references, so all four Test entries (field, selected-event, troop, random-troop) silently rewound and showed only «참조 문제 N개를 해결해야 테스트할 수 있습니다» — an author could not run anything. The issue count now rides in the task button title and the Data stage list. The flow is AI-independent.
- Focused coverage: `test/authoringTasks.test.ts`, `test/authoringJourney.test.ts`, `test/commandRegistry.test.ts`, and `test/selectedEventTestModal.test.ts`.


- **Keyboard ownership on the map surface (2026-08-27):** the Phaser canvas is **not focusable**, so `document.activeElement` stays on whatever DOM field was last clicked. Measured defect: after typing in the assistant composer (`ai-input`) or clicking the tile search box (`tile-search-input`), painting the map left focus in that field and `Ctrl+Z` deleted a character from the prompt instead of undoing the map ("마을에 길 하나" → "마을에 길 하", map unchanged); every letter/F-key/zoom chord died the same way through `shouldIgnoreEditorShortcut`. Contract now: `src/editor/mapSurfaceFocus.ts` (`bindMapSurfaceFocusHandoff`, wired on the `.phaser-container` host in `panels/editor.ts`) releases a parked **text-entry** focus on canvas `pointerdown` (capture) — non-text controls (checkbox/range/button) keep focus. History chords are routed in `EditScene.handleKeyDown` through `handleHistoryHotkey` **before** the coarse `shouldIgnoreEditorShortcut` gate via `isHistoryHotkeyChord` + `historyHotkeyOwnedByPanel` (the latter keeps `databaseModal` / event-editor modal from undoing twice), so map undo/redo always answers with a toast (`되돌렸습니다 — <label>` / `되돌릴 작업이 없습니다`) instead of failing silently. Ctrl+Z while a text field genuinely holds focus still belongs to the browser. Tests: `test/mapSurfaceFocus.test.ts`, `test/e2e/undo-hotkey-focus-handoff.spec.ts`.

- **모달 뒤로 단축키가 새던 경로 (2026-09-14 고침):** `shouldIgnoreEditorShortcut`(`hotkeys.ts`)의 모달 셀렉터 목록에는 `.oprn-modal` / `.modal-backdrop` 만 있었고, 공용 confirm·alert·prompt 가 쓰는 `.app-modal-overlay`(`modal.ts:61/179`, `persistenceRecoveryUi.ts:111`, `aiGateModal.ts:65`)가 빠져 있었다 — 맵 삭제 확인창이 떠 있는데도 F키·숫자 도구 전환·Delete 가 배경 편집기에 그대로 적용됐다. 히스토리 키는 이 가드보다 **먼저** 처리되므로(`EditScene.handleKeyDown`, 체크박스 포커스가 되돌리기를 삼키던 P11-C 대응), `historyHotkeyOwnedByPanel()` 이 `hasOpenModalLayer()` 로 소유권을 양보하게 했다 — 이제 확인 도중 Ctrl+Z 가 뒤에서 프로젝트를 되돌리지 않는다. P11-C 동작(체크박스/슬라이더 포커스에서 되돌리기 유지)은 그대로다. 계약: `test/editorShortcutModalGuard.test.ts`.

- **Map/event search (toolbar-search):** `src/editor/panels/mapEventSearchModal.ts` + pure model `src/editor/panels/mapEventSearchModel.ts`. Styles: `src/styles/editor/map-event-search.css` (imported from `src/styles/index.css`). Centered modal with keyword (variable/switch/event name), range (selected map / common / all), and result tabs. Missing CSS previously left the dialog as raw unstyled fieldsets.

- **Audio test dialog (toolbar-sound-test, 음악/효과음):** `src/editor/panels/audioTestDialog.ts`. Styles: `src/styles/editor/audio-test-dialog.css` (imported from `src/styles/index.css`). Studio list/document window with independent scrolls and fixed shared transport. Right document leads with name/tags/description; preview settings are a native Advanced disclosure. MIDI remains marked unplayable. Tests: `test/e2e/oprn-audio-test-dialog.spec.ts` (expert-mode toolbar, native editor media values and unchanged runtime mixer).

- **Help modal (toolbar-help, 도움말):** `src/editor/panels/helpModal.ts` (`openHelpModal`). Styles: `src/styles/editor/help-modal.css` (imported from `src/styles/index.css`). In-app wiki-style editor guide: sticky TOC nav (개요/화면 구성/지도/이벤트/데이터베이스/소재·세계관·오디오/테스트 플레이/저장·공유/단축키) with scroll-spy highlighting, sectioned prose + bullets + note callouts, per-section editor screenshots (served from `public/assets/help/*.png`, regenerated via `npx playwright test capture-help-guide-images.spec.ts`), and kbd-cap shortcut cards at the end. Replaces the old `SHORTCUT_HELP` toast. Opened from the classic toolbar 도움말 button, 도움말 menu → 단축키 · 도움말, and the Ctrl+K palette command `help-shortcuts` (`commandRegistry.ts`). Esc / backdrop / 닫기 button close it. Guide content lives as `GUIDE_SECTIONS` data in the module — edit that array to change the docs. Tests: `test/e2e/oprn-help-modal.spec.ts`.
- **Event editor help (event-editor-help, 이벤트 에디터 도움말):** `src/editor/panels/eventEditor/eventEditorHelp.ts` (`openEventEditorHelp`). Same wiki UI (sticky TOC + scroll-spy + per-section screenshots) reusing the `.help-modal-*` classes; small glyph-spacing in `src/styles/editor/event-editor-help.css` (imported from `src/styles/index.css`). Detailed sections scoped to the event editor only: 개요/이벤트와 페이지/실행 조건/명령/명령 카테고리/그래픽과 외형/이동 경로/분기와 선택지/전투·상점·여관/AI 보조/단축키. Command-category rows mirror `commandCategoryIcons.ts` glyphs. Opened from the event editor footer **도움말** button (`event-editor-help` testid) — previously a dead button with no handler. Layers above the event editor modal (z-index 290 > 120) and registers with `modalStack` so Esc closes the help first, not the event editor. Screenshots served from `public/assets/help/event-editor/*.png` (reuses `public/assets/help/event.png` for the overview); regenerated via `npx playwright test capture-event-editor-help-images.spec.ts`.

- **Themed dungeons (lava/stone/ice):** shared layout builders live in `src/project/defaults/dungeonThemedLayouts.ts` (`buildDungeonThemeMap`). Scripts `scripts/build-dungeon-themed-maps.mts` and `scripts/extend-home-8pyeong-with-dungeons.mts` must use this module so visuals do not diverge. Lava/chasm retain shaped hazards and plank bridges. Ice is different: the user-authored LegacyDb map `rpg-zzu-dungeon-theme-gallery/map_g_ice_grand` is the read-only canon, and all new ice ridges must use `src/project/defaults/iceDiagonalTerrain.ts`. Its vertical columns are left `286 → 316… → 346` and right `287 → 317… → 347`; `[286,287]` is a peak and `[287,286]` can be a valley. The six tiles are solid interior landmarks, never ceiling-band tiles or free-repeat palette pieces. `scripts/build-grand-ice-cave.mts` only verifies the canon; `scripts/build-ice-pass-map.mts` writes the separate derived map `map_g_ice_canonical_generated` and proves save/reload equality without mutating the canon. Tests: `test/iceDiagonalTerrain.test.ts`, `test/dungeonThemedLayouts.test.ts`, `test/dungeonRoomPipeline.test.ts`.
- **Complex monsters / multi-member troops:** `src/project/defaults/complexMonsterAuthoring.ts` builds EnemyRecord + TroopRecord (members with x/y layout, previewBackground, optional battleEventPages intro) and field battle events (live switch OFF / defeated switch ON). `seedHomeDungeonComplexTroops` seeds themed packs for home dungeons. Prefer this helper (or `upsert_enemy`/`upsert_troop`) over wiring only field charset sprites. Tests: `test/complexMonsterAuthoring.test.ts`.
- Resource manager behavior usually connects through asset and tileset tooling in `src/editor/tilesetImage.ts`, `src/editor/tilesetActions.ts`, and the related editor panels under `src/editor/panels/`.
- **Map-tree Test Play start:** `mapList.ts` routes “여기서 시연 실행” through `bestTestStartCell` in `mapParentLink.ts`. The authored project start is preserved on the start map; other maps choose an event-free passable tile nearest the map center. Do not regress this to `firstFreeCell`: that helper only finds an event-free coordinate and can select a solid outer wall/void in Interior maps. Regression: `test/mapCreateSpec.test.ts`.
- Combined Town window tiles 85 and 87 are upper-layer transparent overlays. Painting them should preserve the lower wall/floor tile underneath so alpha pixels reveal that lower tile.
- Map area copy/paste treats the selected rectangle as a two-layer map block: copy stores both lower and upper tile arrays (with stacks), and paste writes both layers at the destination regardless of the currently active layer. **Paste preview mode:** Ctrl+V enters a floating ghost that follows the cursor; left-click confirms, Esc/right-click cancels (`mapClipboard.ts` `enterPastePreview`/`movePastePreview`/`confirmPastePreview`/`cancelPastePreview`). The floating selection toolbar stays on right-drag/select-tool regions (`shouldShowSelectionActionChips`); Ctrl+V hides it, and confirming paste does **not** reselect the stamped cells so the bar does not jump onto the destination. The selection bar (`selectionActionChips.ts`) is a composer: a one-line auto-growing AI prompt plus icon buttons for 다듬기/복사/붙여넣기/지우기/걷기 전투/구조물 저장/해제 (see `editor-pre-edit-routing.md`, 2026-09-25).
- Tile metadata tools live in `src/editor/tools/tileMetadataTools.ts`; `set_group_junction` and `set_group_overlay` add or update optional tile-group structural rules, while `upsert_tile_group` can persist those arrays with the rest of the group metadata. Cluster rule authoring lives in `src/editor/tools/clusterRuleTools.ts`: `set_cluster_rule` adds or updates tile-group `rules`, and `upsert_tile_group` can persist the same rules array.
- Manual tile pen placement and AI tile placement enforce hard cluster adjacency before committing map edits. Manual `paintTile` rejects the whole placement with a toast when required companion tiles would leave the map or hit protected cells; `paint_tiles` expands hard-rule companion tiles atomically or skips impossible cells, and `scatter_object` treats hard-rule groups such as conifer 1x2 and broadleaf 2x2 as full footprints; summaries mention cluster companion placement.
- **Road/path tools never bulldoze structures (2026-08-30).** `paint_road` and `lay_path` used to paint their polyline blind: `setLower`/`paintRoadCell` overwrote the lower tile and blanked the upper tile, so any house between two waypoints lost its walls and roof. Both tools now route through `src/editor/tools/roadObstacles.ts`. `roadObstacleMaskFor` classifies every impassable in-bounds cell by looking at **each blocking layer**: `structure` (walls, roofs, building fronts — never painted, always detoured), `water` (detoured first, crossed only when no dry detour exists, with the crossing coordinates in a warning that tells the caller to bridge instead), and clearable scatter (trees, fences, stakes — painted over exactly as before, so a road through a forest stays straight instead of snaking around every trunk). A clearable upper tile never unlocks a structural lower tile: a fence dropped on top of a wall keeps the cell protected. Empty cells are never obstacles — `tilePassability` calls `EMPTY` impassable, so counting them would make a fresh blank map unpaintable.
  - `repairRoadPath` takes **only the centerline**; width cells go through `filterRoadWidthCells`, because width cells are scattered perpendicular samples and running path reconnection over them invents road corridors through unrelated open ground.
  - Contract: an obstacle-free candidate path is returned unchanged (byte-identical legacy output, and out-of-bounds cells stay in the list so the palette-picker RNG consumption order is preserved). Blocked cells surface as `data.obstacleCells`/`structureCells` plus a `통행 불가 …` warning; a blocked first/last waypoint surfaces as `data.endpointBlocked` plus a warning and the road stops at the last open cell. A road that cannot be reconnected is **not committed**: both tools throw with the gap coordinates (`road-blocked`/`path-blocked`) so the model can retry with better waypoints, and painting nothing while everything was blocked is an error rather than a success summary. ★-passable upper overlays (bridge planks, wall ladders) survive under a road instead of being blanked.
  - `stamp_structure` town paths take the same mask (`paintTownPathNetwork(map, rects, skip)`, threaded through `stampTownCityPlot`/`stampDbHouseVariant`), so a stamped cross path or door approach cannot replace an existing building's ground. Still unprotected by design: the stamped template's own house body and yard fence overlap whatever sits at the chosen origin (placement choice, not routing), and `fill_region`, `tile_erase kind=all`, and content-builder road painters (`dbExtractedHouseTemplate.paintAutoRoad`) keep their existing behavior.
  - Regression: `test/roadObstacleAvoidance.test.ts`.
- AI natural scatter options are integrated at the tool edge. `paint_road` accepts `naturalness`/`seed`; `naturalness:0` preserves the legacy `lineCells` path, while higher values call `wobblePath` and still reuse existing road/sand autotile shaping. `scatter_object` chooses uniform/poisson/cluster candidate ordering from naturalness, but protected-cell checks, spacing, hard-rule atomic footprints, and structure edits remain on the existing placement path. `build_house` and `stamp_structure` may jitter origin by up to two cells and fall back to the requested origin if no jitter candidate passes the existing bounds checks.
- Village pipeline (`villageBuilder.ts` + `villageSession.ts` + `villagePlan.ts` + `villageRequirements.ts` + `villageTerrainPass.ts` + `villageEvaluate.ts`): user query/theme ??**common-sense `requirements`** (e.g. 강촌마을 ??river+forest+village). **LLM plans `buildOrder`** (e.g. lake/river villages put `water` before `settlement`; mountain villages start with settlement). Multi-turn: **`run_village_session`** / **`start_village_session`??advance_village_build`**. **Inside `settlement`:** exterior kits blue-stone/bright-plaster/amber-wood/slate-wood + 1?? stories; interiors derived from exterior (stories/footprint/kit/owner -> scale+program and chained floor maps); houses first ??plaza/roads with **house-footprint mask** (roads skip house cells; reconnect components around houses) ??restore doors ??fences ??yards ??NPCs. Roads must not overwrite house lower/upper tiles. Forest layers after settlement when required. Tree catalog **`list_village_tree_assets`**, **`plant_tree_clusters({ style:"broadleaf-2x2" })`**, **`evaluate_village_layer`**. **숲 밀도(2026-08-30):** 숲은 나무 몇 그루가 아니라 그 지대를 덮는 지형이다. 밀도의 단일 근거는 `src/editor/tools/forestDensity.ts` 의 `ForestDensity`(sparse 15% / normal 40% / dense 80% / impassable 100% 커버리지) 이고 기본값은 **dense** 다. 밀도는 모델이 `place_props.density` / `author_village.forestDensity` enum으로 넣는다(숲·삼림 → dense, **울창·빽빽·밀림·통행 불가 → impassable**, 드문드문·가로수 → sparse). 사용자 문장을 코드가 정규식으로 읽지 않는다. **선언값과 실측이 일치해야 한다**: `dense`·`impassable` 은 둘 다 `packing:"dense"`(선형 packer, 간격 0)로 나가고 `sparse`·`normal` 은 자연 산포다. `normal` 은 간격 1이다 — 왜(24×24 양 수종 실측): 간격 2는 선언 40%에 대해 18.1%/25.5%에 멈췄고, 간격 1은 자연스러운 산포를 유지하면서 35.1%/43.9%에 닿았다. `dense` 를 자연 산포로 보내면 간격을 지키다 일찍 포기해 24×24 에서 231그루 요청 중 79그루만 놓고 커버리지 44% · **통행 가능 72.6%** 에 멈췄고(선언은 80%), 성능도 최악이었다 — 96×96 은 399초에 죽였고 100×100 은 240초 상한도 못 넘겼다. 선형 packer 로 바꾼 뒤 100×100 이 **213ms**, 커버리지 99.6% · 통행 가능 20.0% 다. `count` 가 후보보다 작고 2칸 폭 나무면, seeded 2차원 error diffusion이 행별 quota와 가로 여백을 따로 분산해 긴 열·대각 반복을 끊는다. 보호셀·기존 구조 때문에 그 경로를 쓸 수 없으면 seeded hard-core 표본으로 **빠질 후보**를 인접하지 않게 먼저 뽑은 뒤 필요한 만큼 결정적으로 보충한다. 왜(실측): 등간격 구현은 실제 칩셋에서 shift 6,4 상관 0.400의 대각 격자를 만들었다. 두 경로 모두 후보 셔플·상수 근방 검사라 선형 시간과 정확한 개수를 유지하면서 빈틈을 유기적으로 흩뜨린다.

**숲은 합성이다(2026-08-30 렌더 실측).** 밀도만 올리고 한 재료를 `packing:"dense"` 로 채우면 화면은 **산울타리 밭**으로 읽혔다 — 같은 칩이 격자로 반복되고 밑동 없는 수관 사슬만 남았다. `src/editor/tools/forestComposition.ts` 의 `plantForestComposition` 이 dense·impassable 을 한 경로에서 조립한다: 활엽수·침엽수·덤불을 지분대로 심고(요청 재료가 주종), 밑동을 **상위 레이어로 올리고 그 칸에 지면을 되돌리며**(하위에 두면 밑동 칩의 투명 화소가 그냥 구멍이 된다 — `skyStairMaps.ts` 가 이미 쓰는 방식), 남은 맨땅에 하층식생을 깐다. 보고는 `measureForestArea` 로 나무·덤불·하층식생을 **따로** 센다(덤불을 나무로 세면 실적 부풀리기다).

**"지나갈 수 없다"는 통행 가능 칸 수가 아니라 경로다.** 수관 타일(260·262·263)은 칩셋에서 4방향 통행 가능이다(주인공이 나무 뒤로 지나가는 관례). 그래서 커버리지 100% 인 숲도 수관 칸을 타고 걸어서 통과된다 — 판정은 `mapHelpers.reachableCellCount` 로 한다. 이 값은 영역 자체 경계를 시작점으로 간주하지 않고 **바로 바깥 인접 칸에서 directional `canMove` 로 실제 진입 가능한 경계만 seed**한 뒤, 영역 안도 같은 `canMove` 로 탐색한다. 왜(4×4 실측): 바깥 한 겹이 solid 덤불로 완전히 닫혀 입구 0개인 영역을 예전 경계 seed는 16/16칸 진입 가능으로 잘못 보고했다. `impassable` 만 `closeGapsWithBushes` 로 그 연결요소를 덤불로 닫고(길·물·보호셀은 절대 덮지 않는다), `dense` 는 "지나갈 수 있는 두꺼운 숲"으로 남긴다. 24×24 실측: dense 통행 가능 152칸 중 **닿는 칸 33**, impassable 통행 가능 144칸 중 **닿는 칸 0**. `repairTreePairs` 는 숲 합성이 gap closure에 쓰는 것으로 해석한 **blocking-bush 타일 id만** 명시적으로 수관 교체에서 제외한다 — 모든 비수관 오버레이를 제외하면 나무 상자 237 같은 일반 소품도 고아 밑동 보정을 영구히 막았다. 일반 가구·상자·장식은 원래 계약대로 수관으로 보정한다.

**모델이 닿는 경로가 정본이다.** `plant_tree_clusters`·`run_village_session`·`build_village`·`start_village_session` 은 `CONSTRUCTION_WRITE_SUPERSEDED` + `llmExposed:false` 라 **모델에게는 없는 툴**이다. 숲마을 칩(`forest_harmony`)에서 `place_props`의 `density` `dense`·`impassable`은 침엽수 260/290이 아니라 굽이숲 수관(`forest_harmony_grove_47`)과 3줄 밑동을 깐다. 그 외 칩셋의 밀도는 두 라이브 표면에 있다: (1) `place_props({ material:"침엽수"|"활엽수", density })` — `count`·`packing`을 면적에서 자동 산출하되 수종별 간격·자연도는 DB 「세계 → 생성 규칙」의 저작값을 따른다(영역 AI 가 이름을 아는 유일한 배치 툴이다. 옛 권고였던 "count = area/4 + packing:dense" 는 실측으로 침엽수 75% · 활엽수 50% 가 통행 가능해 숲이 아니었다). (2) `author_village` → `runTerrainConstraintPass` → `applyTerrainPassFromMasks` 가 `requirements.forestDensity`(모델이 `author_village`/`place_props` 에 넣은 enum)를 소비한다. 사용자 테마 문장을 정규식으로 읽지 않는다 — 옛 캡 `면적/10`·`min(10, 면적/28)` 이 여기 남아 있어서 「울창한 숲 마을」이 실측 숲 밴드 커버리지 27.7% · 통행 가능 79.5%(50×50) 였다. 지금은 커버리지 83.6% · 밖에서 닿는 칸 43/336 = 12.8% (50×50) 다 — 남는 통행 칸(29.8%)은 숲 밴드를 가로지르는 마을 도로라서 정상이다(도로·물·보호셀은 절대 덮지 않는다). 통행 가능 칸 비율을 밀도 근거로 읽지 마라: 같은 밴드가 통행 가능 29.8% 인데 밖에서 걸어 들어올 수 있는 칸은 12.8% 다. 활엽수 군락을 **먼저** 심고 침엽수 선형 packer 로 목표 커버리지를 채운다 — 순서를 뒤집으면 2×2 원자가 들어갈 틈이 없어 품질 게이트가 흔들린다.

**숲마을 숲의 꾸밈과 지나가는 수관 (2026-09-26).** 숲마을 칩의 `place_props` 숲(굽이숲 경로, `constructionTools.placeGroveCanopy`)은 수관만 깔지 않고 `village/forestDressing.ts` 가 영역 크기에 맞춰 꾸민다. 순서가 계약이다.
1. **물은 수관보다 먼저.** `forestWaterKindFor`: dense 만, 150칸·짧은 변 8 이상이면 연못, 480칸·짧은 변 14 이상이면 긴 변을 관통하는 개울(폭 3~4). impassable 은 물이 없다. 0번 애니메이션 물로 칠하고(2026-09-27, 옛 `forest_harmony_lake_47` 1517~1563 은 프레임이 한 장이라 멈춰 보였다) 수관 `free` 에서 물 칸을 빼야 한다 — 굽이숲 `free` 는 합본 마을 물 번호만 알아서 숲마을 물 위에 수관을 덮었다(실측). 2칸 폭 개울은 물가 칩만 남아 수면 없는 검은 띠로 보였다.
2. **지나가는 수관(★) 숨은 길.** `forestGrove.ensureWalkableCanopy` 가 굽이숲 58칸을 같은 원본으로 새 슬롯에 한 벌 더 이식하고 통행+상위(★)로 둔다(그룹 `forest_harmony_grove_walk_47`, 두 그룹은 서로 connect). ★ 는 이동 판정에서 건너뛰어 잔디가 통행을 정하고(`collision.layeredPassability`) 런타임은 항상 캐릭터 위에 그린다(`characterDepth.mapUpperTileDepth`). dense 만 `carveSecretCanopyPaths` 가 수관 가장자리(바로 밖이 잔디)에서 3~7칸 파고들어 8방향이 수관·밑동인 주머니에서 끝난다. 밑동 칸은 지나지 않는다. 캐릭터 그림은 한 칸보다 커서 머리가 윗칸에 걸친다 — 길 바로 위의 막힌 수관 칸에는 같은 그림의 ★ 사본을 4층(`upperOverlayTiles`)에 겹쳐 둔다. 통행은 3층(막힘)이 그대로 정하고 그림만 캐릭터 위다(실측: 겹치기 전에는 주머니에서 머리가 잎 위로 나왔다). 결과 `data.secretSpots` 가 보물 자리고, 요약이 `place_chest` 좌표를 안내한다. impassable 은 숨은 길도 없다.
3. **풀밭 꾸밈은 마지막.** 남은 맨 풀밭 칸 수에 비례(작은 나무 70칸·덤불 45칸·꽃관목 768 90칸·돌 29/537 60칸당 하나), 둘레 1칸 비움.
실측(seed 21, dense): 10×8 물 0·소품 0, 20×16 연못 28칸·돌 2, 40×30 개울 133칸·작은 나무 6·덤불 13·돌 14·숨은 길 4곳. 합본 마을 경로(`plantForestComposition`) 결과는 바뀌지 않는다(같은 seed 해시 동일).

**PR #355 생성 규칙과의 우선순위.** `src/project/worldGenRules.ts` 와 DB 「세계 → 생성 규칙」 탭은 우회하거나 복제하지 않는다. `forestBandDepth` 는 숲 밴드 기하를, `coniferGap`/`broadleafGap` 과 `*Naturalness` 는 수종별 배치 성질을 계속 정한다. `requirements.forestDensity` 가 있으면 이번 요청이 **COUNT와 PACKING**을 이기며, enum을 생략한 요청은 `coniferCountFor`/`broadleafCountFor` 를 포함한 저작 기본값으로 돌아간다. 계약은 `test/forestDensityPriority.test.ts` 의 «모델 density enum이 저작 기본값을 이긴다»다.

`village/decor.ts` 는 `edgeTrees==="dense"` 일 때만 이 축을 탄다. 그 산포의 area 는 숲 밴드가 아니라 **마을 전역**이라 밀도를 그대로 쓰면 집·길 사이까지 메워지므로 `INTERIOR_TREE_SHARE`(0.25) 로 지분만 갖고, 진짜 두꺼운 밴드는 terrainPass 가 채운다(실측: 전역에 밀도를 그대로 밀었을 때 50×50 시공이 1.6s → 107s). `edgeTrees==="conifer"` 는 숲 요청이 아니므로 옛 개수를 유지한다.

`count` 는 **맵 칸** 기준으로 계산한다(`treeFootprintCells`: 활엽수 2칸·침엽수 1칸) — 스탬프 타일 수(4·2)로 세면 수관(upper)과 밑동(lower)이 같은 칸에 적층되므로 개수가 절반이 되어 impassable 이 50% 에서 멈춘다(실측). `forest_conifer` 와 `forest_big` 은 같은 rect 를 두 번 훑으므로 커버리지를 `CONIFER_COVERAGE_SHARE`(0.45/0.55)로 나눠 갖는다. 시공 요약은 실측 커버리지("나무 덮은 비율 N%")를 함께 낸다. Tests: `test/forestDensity.test.ts` — 산술이 아니라 `passableCellCount` 실측 통행성 + 선언 커버리지 도달 + 100×100 시간 + `author_village` 경로를 잠근다. One-shot: **`run_village_pipeline`** / **`build_village`**. Look gate needs water/trees/**?? tree2x2Clusters** when forest required. See `docs/village-plan-architecture-easy.md`.
- **Natural village v2 reference-first grammar (2026-07-16):** `scripts/natural-village/*` is a coordinate-authored 64횞56 reference and must not import the village construction harness. It established the rules now copied by `build_village`: use four kits and distinct templates before repeats; support 1??F houses; place windows on one row per floor with a blank wall row between floors; keep exactly one 116/146 door pair per house; distribute houses through staggered natural slots; use a narrow meandering commons loop plus north/south/west/east `roadAnchors`; use a walkable wood market deck; replace closed rectangular lots with short fence fragments; scatter conifers and 2횞2 broadleaf groves through interior as well as edges; keep at least six prop tile kinds; give every generated villager morning/day/evening schedules, varied activities, and both fixed/random movement. Generated maps retain `layoutPlan.kind="village-harness-natural-v2"` with house regions and explicit quality-target tags. `evaluate_village_look` treats missing exits, orphan doors, adjacent windows, insufficient shape/kit diversity, missing schedules, one movement style, one tree species, weak prop variety, overlong straight road runs, excessive fence cells, or weak interior tree distribution as harness quality failures. Explicit all-house kit/template choices lower their corresponding target instead of being overwritten by the gate.

## 편집기 z 층 밴드와 토스트 (2026-08-30, PR #308)

편집기 층은 `src/styles/tokens.css` 의 토큰으로 정한다. 위로 갈수록:
`--z-modal 2100` → `--z-modal-overlay 2200` → `--z-modal-top 2300` → `--z-proposal 2500`
→ `--z-app-modal 2600` → AI 넓은 비교 오버레이 `calc(var(--z-app-modal) + 20)` = 2620
→ **`--z-toast 2700`**.

**토스트가 앱 모달보다 위인 이유 (실측).** 이전 `1000` 은 테스트 플레이 창의 **백드롭**
(`.test-play-modal-backdrop { z-index: 1300 }`, `src/styles/map/resource-system.part-1.css:263`)
에 가려졌다. 런타임 디버그 막대 때문이 아니다 — 그건 `z-index: 60`
(`src/player/runtimeDebugPanel.ts:65`) 으로 그 백드롭 **안에** 있어 1000 을 직접 이길 수 없다.
그래서 «시작 전 자동 복구» 같은 알림이 테스트 플레이 창에서 보이지 않았다. 눈에 안 보이는
알림은 없는 알림이다.

**올려도 안전한 이유.** `.toast-stack` 과 `.toast` 가 둘 다 `pointer-events: none` 이고
`has-action` 토스트만 `auto` 로 되살린다(`src/styles/editor/palette-player.css:543`, `:559`,
`:592-595`). 그래서 모달의 입력·확인 단추·백드롭 클릭이 전부 토스트를 통과한다. 토스트는
`modalStack` 에 등록하지 않으므로 Esc 대상이 되지 않고 포커스도 빼앗지 않는다.

런타임 밴드(picture-layer 26 ~ picture-layer-item 45)는 `.play-stage` **안쪽** 별도 서브트리라
이 숫자들과 섞이지 않는다. 두 밴드를 한 자리로 합치려 하지 마라 — 서로를 가린다.

계약 테스트는 `test/editorZLayerOrder.test.ts` 다. `--z-toast` 를 앱 모달 아래로 내리면
실패한다(실측: 2400 으로 내려 2건 실패). 이전에는 이 순서를 지키는 것이 **아무것도 없었다** —
`test/runtimePictureStacking.test.ts` 는 런타임 밴드만 재고 편집기 토큰은 보지 않는다.

아직 토큰을 안 쓰는 인라인 층 둘이 토스트보다 위다: `quickBattleModal` 오버레이 `9999`
(`src/editor/panels/quickBattleModal.ts:38`), 이벤트 목록 호버 툴팁 `320`. 정리 대상이다.

## 초보 맵 사이드바 «목록 | 상세» 2단 탐색기 (2026-08-30, PR #311)

> 2026-09-27 편집 모드 삭제로 초보 레일은 없어졌다. `mapList.ts` 의 `switcher` 변형(`is-basic-flyout` / `map-item-basic`)은 사이드바 맵 스위처가 계속 쓴다.

초보 모드 맵 사이드바는 이제 두 칸이다 — 왼쪽 목록(`renderMapList(host, { variant: "basic" })`),
오른쪽 상세(`src/editor/panels/mapInspectorPane.ts`, 데이터는 `src/project/mapInspection.ts`).

**기능은 하나도 줄지 않았다** (도달성 전수 대조). 필터·facet, 트리 행 다중선택, 썸네일, 펼치기
토글, 드래그 재정렬, 우클릭 메뉴, 행 `⋯` 메뉴, quick `+`, 중간클릭 시연, 더블클릭 설정, 인라인
이름 변경, 마퀴 선택, 컨텍스트 메뉴 13개 항목이 모두 남아 있다. 삭제·복제·시작맵 지정 같은
동작은 행 `⋯` / 우클릭 / 키보드(F2·Delete) / 새 상세 칸 액션 줄 중 최소 셋에서 도달한다.

바뀐 것은 **정보 배치**다. 행 메타에서 `문N` 숫자가 빠지고 0일 때 `고립` 만 남는데, 분해값은
상세 칸 「연결」 칩(`map-inspector-link-outgoing/incoming/connection`)과 행 메타 `title` 툴팁
양쪽에 있다. 옛 조작법 힌트 문구도 트리 `title` 툴팁으로 옮겼다 — 발견성은 약해졌다.

목록은 ARIA tree 패턴이다: roving `tabindex` + `aria-selected` + `aria-expanded`, Arrow/Home/End,
Enter·Space 선택, Ctrl+Enter 시연, F2, Delete, Shift+F10. 플레이 상태 메뉴는
`aria-activedescendant` 를 쓰지만 트리에는 roving tabindex 가 맞다 — 둘 다 확립된 패턴이다.
아직 없는 것: 상세 칸이 선택된 행과 `aria-controls`/`aria-describedby` 로 묶이지 않아 스크린
리더에서 두 칸의 연결이 암시되지 않는다.

좁은 창(≤1100px)에서 상세 칸은 숨지 않고 목록 아래로 쌓인다(`map-panel.modern.css:889-912`).

## 커스텀 셀렉트는 열릴 때 modalStack 층이 된다 (2026-08-30)

`installEventEditorCustomSelects` 의 팝오버는 열릴 때 `registerModal` 로 **최상위 층**이 되고
닫힐 때 해제된다. 이게 없으면 Esc 한 번이 드롭다운과 모달을 **같이** 닫는다: `modalStack` 은
keydown 을 document **캡처** 단계에서 잡아 `stopPropagation` 하므로(`ui/modalStack.ts:25`,
`:28-37`), 캡처가 document → root 순으로 흐르는 동안 컴포넌트의 Esc 핸들러는 아예 실행되지
않는다. "한 층에 Esc 하나" 가 `modalStack` 의 존재 이유이므로 중첩 팝오버는 반드시 등록한다.

계약 테스트는 `test/customSelectEscapeLayer.test.ts` 다. 등록을 지우면 2건 실패한다(실측).
`test/aiSettingsModalLayout.test.ts` 는 깊이 1만 단정하고 드롭다운을 열어놓고 Esc 를 누르는
경로를 실행하지 않아 이 결함을 통과시켰다 — 깊이만 재는 단정으로는 층 소유를 증명하지 못한다.

- **Natural village v2 reference-first grammar (2026-07-16):** `scripts/natural-village/*` is a coordinate-authored 64횞56 reference and must not import the village construction harness. It established the rules now copied by `build_village`: use four kits and distinct templates before repeats; support 1??F houses; place windows on one row per floor with a blank wall row between floors; keep exactly one 116/146 door pair per house (**reference script only** — it runs with `doorEvent:false`; `build_village` itself now leaves the door cell as kit wall and lets the Object1 door event be the door); distribute houses through staggered natural slots; use a narrow meandering commons loop plus north/south/west/east `roadAnchors`; use a walkable wood market deck; replace closed rectangular lots with short fence fragments; scatter conifers and 2횞2 broadleaf groves through interior as well as edges; keep at least six prop tile kinds; give every generated villager morning/day/evening schedules, varied activities, and both fixed/random movement. Generated maps retain `layoutPlan.kind="village-harness-natural-v2"` with house regions and explicit quality-target tags. `evaluate_village_look` treats missing exits, orphan doors, adjacent windows, insufficient shape/kit diversity, missing schedules, one movement style, one tree species, weak prop variety, overlong straight road runs, excessive fence cells, or weak interior tree distribution as harness quality failures. Explicit all-house kit/template choices lower their corresponding target instead of being overwritten by the gate.

## 맵 설정 가독성·편집 연속성 (2026-09-05)

- 진입점은 `mapPropertiesDialog.ts`, 폼은 `mapProps.ts`, 스타일은 `src/styles/editor/map-props.css`다. 맵 트리 더블클릭/메뉴와 팔레트의 타일셋 이름이 같은 창을 연다.
- 8개 섹션은 계속 DOM에 함께 두되, **왼쪽 고정 바로가기 + 본문 한 열**로 읽는다. 기존 `map-props-tab-*` testid는 스크롤 내비다. `aria-current=location`은 본문 스크롤에 따라 갱신하고, 바로가기 클릭은 해당 제목에 초점을 준다. 마지막 섹션도 상단에 도달하도록 최소 높이를 확보한다.
- 맵 창에만 폭 최대 1000px·높이 최대 820px(뷰포트에서 48px 제외)을 적용한다. 헤더는 줄어들지 않아 맵 이름이 잘리지 않는다. 본문 스크롤러는 `.map-props-body` 하나이며, 제목 18px/설명·라벨 최소 13px, 입력·내비 14px, 체크박스 18px이다. 공용 서브다이얼로그의 `input min-height:32px`가 체크박스를 늘리지 않도록 맵 스코프로 재정의한다.
- 배경/BGM/출현 조건/미니맵 변경은 **변경한 section만** 다시 그린다. 다른 섹션의 미적용 크기·JSON 입력은 DOM 자체를 보존한다. 같은 섹션의 미적용 JSON과 details 열림 상태도 복원하며, 커스텀 셀렉트의 MutationObserver 갱신 후 초점과 스크롤을 복구한다. 다시 창 전체를 `renderMapProps`하면 이 계약이 깨진다.
- 맵/전투 배경·BGM은 `mapResourceField`의 현재 리소스 이름과 선택 버튼을 사용한다. 검색·그림 미리보기·미리듣기는 기존 `openDatabaseResourcePickerDialog`가 소유한다. 맵 폼에 원시 리소스 ID 입력이나 AI 생성 폼을 중복 배치하지 않는다. 맵 선택기(`.db-enemy-dialog-backdrop[data-testid^="map-"]`)에만 18px 제목·14px 검색/버튼·38px 동작 영역을 적용한다.
- 크기 적용은 4~128칸 정수만 받으며 축소는 타일 삭제·이벤트/시작점 이동을 안내하고 확인받는다. 일반 설정은 입력 변경 즉시 반영되고 크기/JSON만 적용 버튼을 사용한다. 행동 제한·배경 이동·BGM 연속 편집은 store의 최신 값을 사용해 앞선 변경을 덮어쓰지 않는다. 랜덤 전투 슬라이더와 숫자는 같은 0~100 범위다.
- 미니맵 이미지는 플레이 중 미니맵을 재현한 것이 아니라 맵 참고 이미지임을 표시하고 `fitDisplay` 240×180px 안에 맞춘다. 구현 계획(`fog v1` 등)은 제품 안내에서 제거했다.
- 브라우저 회귀: `DEV_SERVER_PORT=<워크트리 포트> npx playwright test test/e2e/map-settings-ux.spec.ts`. 초보/전문가 각각 1024×768·1280×800·1440×900에서 모든 바로가기와 글자/헤더/스크롤을 측정한다. 별도 시나리오는 미적용 입력 보존, 키보드 초점, 연속 제한 설정, 출현 조건과 그림 선택, 축소 취소를 검증한다. 실제 출현 행을 추가한 상태에서 그룹 선택/가중치/비율/삭제의 카드 내부 배치도 측정한다. `freshProject`는 순수 UI 검증용으로만 사용하며 게임 콘텐츠를 납품하는 작업이 아니다.
## 왼쪽 사이드바 3모드 적대적 리뷰 (2026-09-05)

> 2026-09-27 편집 모드 삭제: `basicTilePalette.ts`·초보 레일·모드 왕복은 없어졌다. 아래 초보 항목은 기록이다. `left-sidebar-adversarial.spec.ts` 는 이제 한 화면을 세 뷰포트에서 확인한다.

- **초보 타일 창은 전체 공용 팔레트다.** `basicTilePalette.ts`가 `makeGridPalette` / `makeCustomPalette`를 사용한다. 앞 48칸만 자르던 목록은 삭제했다. RPG2K 팔레트는 레이어 분류·오토타일 대표 축약을 따르고, 커스텀 시트는 원본 행·열과 저작 라벨을 보존한다. 검색과 2차원 roving 탐색도 공용 구현이다. 초보 `basic-tile-*` testid는 유지한다.
- **초보 복귀 시 이전 폭을 지운다.** `applyLayout`의 초보 분기는 표준·전문가가 남긴 인라인 `width`를 비운 뒤 CSS의 72px 레일 폭을 측정한다. `min-width:72px !important`는 기존 `width:300px`를 덮지 못한다. 새 컨텍스트로 모드별 부팅만 하면 못 잡히므로 실제 모드 왕복에서 패널 폭과 캔버스 시작점을 단정한다.
- **레일을 비우기 전에 포커스를 읽어야 한다.** `renderTilePalette`는 초보 분기를 `clearChildren`보다 먼저 호출한다. 실제 브라우저는 노드 제거 시 포커스를 body로 옮기므로, 자식에서 뒤늦게 캡처하면 복원할 수 없다. fakeDom으로 `renderBasicLeftRail`만 직접 호출하던 테스트는 이 결함을 놓쳤다.
- `sidebarFocus`는 텍스트 입력의 선택 범위·커서를 함께 복원하고 `preventScroll`로 복원에 따른 점프를 막는다. 초보 타일 창은 핀 상태에서 선택하거나 다시 그릴 때 시트의 세로·가로 스크롤을 보존한다.
- 타일 버튼은 pointerdown 외에 보조기기의 `click(detail=0)` 활성화도 받는다. 물리 클릭(detail>0)을 다시 처리하지 않아 중복 선택을 피한다.
- **작은 데스크톱에서 타일과 맵을 함께 비교할 수 있어야 한다.** 표준·전문가 1024×768에서 기존 280px 타일 예약은 맵 목록을 48px(한 행)로 줄였다. `paletteSheetReserveCap`은 도크 높이 800px 미만에서 200px를 예약한다. CSS의 짧은 창 시트 최소 높이도 200px로 맞춘다. 큰 창의 280px 예약, 사용자 수동 분할과 접기 동작은 유지한다.
- 검증: `test/e2e/left-sidebar-adversarial.spec.ts`는 실제 보기 메뉴로 3모드를 전환하고 1440×900 / 1280×800 / 1024×768에서 버튼 중심 hit-test, 맵 마지막 행 도달, 최소 3행 가시성, 키보드·검색 커서·핀·모드 복귀를 확인한다. 단위 계약은 `basicTilePalette.test.ts`, `sidebarFocus.test.ts`와 기존 레일·그리드 테스트다. 순수 에디터 변경이므로 원격 프로젝트 데이터는 변경하지 않는다.


## Authoring viewport navigation (issue 693, 2026-09-08)

- The assistant remains FLOAT. `EditScene.cameraVisibleArea` owns its actual
  occlusion; no side-dock model or assistant diagnostics UI is introduced.
  The published world rectangle now uses the inverse rendered camera transform
  (`getWorldPoint`), because Phaser rounds `worldView` for culling. Camera scroll
  stays fractional for pointer-anchored zoom; nearest-neighbor artwork is retained.
- `EditScene.syncNavigationGeometry` preserves the unobstructed focal point on
  assistant collapse/open/resize, keyboard zoom and canvas resize. Its previous
  geometry is a layout snapshot, not an independent camera offset store. Resize
  and assistant DOM observers invalidate the existing measurement cache; edit
  gestures defer recentering until release. Map changes reset that snapshot.
- `editorCameraBounds` in `cameraFocusViewport` grants asymmetric half-viewport
  padding plus 32 CSS pixels so either map edge can reach the unobstructed center.
  `panels/editor.applyEditorUiModeLayout` no longer replaces map bounds with a
  temporary viewport box or re-applies stale offsets across animation frames.
  `cameraStability.viewportCenterWorld` matches Phaser 3.90's `scroll + size/2`.
- `CameraScrollbars` projects these bounds into two named native scroll regions
  mounted beside the canvas, inside its existing host. Thumb fraction includes
  inspection padding; corner subtraction scales track content and position alike.
  Native notifications may follow an engine frame: do not overwrite pending input.
  No idle-frame DOM writes, shell scroll offsets or parallel viewport state.
  The projection cache includes both canvas dimensions: assistant breakpoints can
  keep the unobstructed span and world origin unchanged during a canvas-only
  resize. Tracks must still move to the new canvas edges and recompute their
  content/position ratios. Width-only and height-only regressions retain the same
  view/worldView objects and verify subsequent native input is converted once.
- Canvas-only cancelable Ctrl+wheel consumes browser zoom and steps existing
  0.25/0.5/1/2/3/4/6/8 levels around the pointer, including trackpad Ctrl-style pinch on
  Linux/Windows/macOS. Command-only and ordinary wheel retain their previous
  behavior. An in-flight edit consumes Ctrl+wheel without changing coordinates.
- Neutral primary pan is Select on an outside-map target with no selection,
  stamp, paste preview or active edit. Inside-map Select and paint/event tools
  retain their editing priority. Explicit Pan, Space and middle drag are unchanged.
- Focused regressions: `cameraStability`, `cameraFocusViewport`, `cameraScrollbars`,
  `editSceneCameraFocus`, `editSceneRender`. Real browser driver:
  `scripts/qa/issue693-navigation.mjs` (`BASE_URL`, `EVIDENCE_DIR`, optional
  `QA_WIDTH`). It uses real Phaser/native input and local-only large/small projects,
  subscribes to exact input/scroll/resize/render events, and covers all three
  desktop sizes, assistant states, both scroll endpoints and edit alignment.
  Full build/gates and independent screenshot review remain lead-owned.

### Common expression recovery (2026-09-17)

The common expression selector now contains 76 characters / 1216 expressions:
Actor1, Actor2, People1 and People2 (16 each), Monster 1–12. Monster 13–16 are not imported.
`src/assets/faceExpressionSets.ts` registers the selector; `scripts/shared-face-expression-sources.json`
records stable stems, base portrait mapping, original attachment filenames and source hashes.
Masters live in `public/assets/shared/faceset/source/`. Rebuild with
`node scripts/prepare-shared-faceset.mjs --all` then `node scripts/slice-faceset-sheets.mjs`.
Verify using `node scripts/slice-faceset-sheets.mjs --verify` (1328 total faces including 112 base/generated faces).
The preparation command checks source hashes before center-sampling each cell to 48px;
explicit cell bounds exclude gutters in three older supplied sheets.
Preserve the masters, manifest, runtime sheets, generated singles and both TS catalogs together in Git:
registration in a temporary worktree alone does not preserve the import after that worktree is removed.

Bust and full-body portraits (2026-10-01): each of the 76 sets also has `public/assets/shared/portraits/<stem>/{bust,full}-<expression>.png`
for all 16 face-cell expressions (2432 files, catalogued by `src/assets/sharedPortraitAssets.ts`, not by `slice-faceset-sheets.mjs`). They were generated from the set's face
cells plus the paired walking sprite (face↔sprite pairing as in `src/assets/sharedCharacterGraphics.json`; People1 faces 8 and 12 have no sprite).
Regenerate / review / finalize with `scripts/content/portraits/` (README there). Adding a new expression set means adding its folder too —
`test/sharedPortraitAssets.test.ts` requires all 32 files per set.

### 제작자 페이지에서 타일셋 받기 (2026-09-24)

칩셋 탭의 **제작자 페이지**는 데스크톱 앱 안에 itch.io 페이지만 연다. 사용자는 그 페이지에서
직접 Download를 누르고, 받은 zip·그림은 현재 프로젝트의 업로드 타일셋으로만 들어간다.
zip SHA-256이 `BUNDLED_PACK_CATALOG` 또는 이 브라우저에 기억된 기록과 같으면 시트 이름과
칸 크기를 그대로 적용한다. 처음 보는 zip은 한 번 고른 뒤 그 해시에 붙여 다음부터 묻지 않는다.
앱이 팩을 대신 받아 두거나 다른 프로젝트에 나눠 주지 않는다. 허용 호스트는 `itch.io`와
`itch.zone`이다. 웹 편집기에는 같은 가져오기 칸만 있고, 이미 받은 zip을 올릴 수 있다.
진입은 `src/editor/panels/assetSourceBrowser.ts`, 창은 `electron/main/assetBrowser.ts`,
해시 표는 `src/editor/assetBrowser/packCatalog.ts`.



## 필드 키트 — 미니게임·필드 능력·순간이동·걸음 상태·클릭 이동 (명작 공백 G3, 2026-09-27)

명작 20선 대조에서 「변수 곡예로 흉내」에 머물던 필드 기능 다섯을 명령·DB 로 올렸다.

| 공백 | 저작 | 런타임 | 파일 |
|---|---|---|---|
| #1 미니게임 키트 | 모던 명령 `Key Poll`(m2-219) · `Timed Choice`(m2-220) · `Quick Time Event`(m2-221) · `High Score`(m2-222) | Key Poll 은 필드 씬이 매 프레임 쓰는 `session.heldInput`(방향 2/4/6/8, 결정·취소·달리기)을 변수·스위치로 옮긴다 — 병렬 이벤트 루프에서 읽으면 실시간 조작이 된다. 제한시간 선택지는 기존 선택지 창 + AbortSignal(시간 초과 0), QTE 는 순서(성공 1/실패 0)·연타(횟수). 최고 점수는 `session.highScores`(세이브 포함), `submitLow` 는 시간 기록용 | `interpreter/minigameCommands.ts`, `playSceneMinigames.ts`, `heldKeyTracker.ts` |
| #5 필드 능력 | 스킬 DB 「필드 능력(공통 이벤트)」 = `SkillRecord.fieldCommonEventId` | 메뉴 스킬 목록에서 고르면 MP 를 내고 메뉴를 닫은 뒤 공통 이벤트를 돌린다. 정면 이벤트 id 는 문자열 변수 `fieldAbilityTarget`, 정면 좌표는 변수 `fieldAbilityX/Y`, 쓴 배우는 `fieldAbilityUser` | `player/fieldAbility.ts`, `PlayScene.useFieldAbility` |
| #24 순간이동 | `Set Teleportation Point`(m2-072, mapId 비우면 현재 위치, `label` 선택) · `Teleport Menu`(m2-223) | 지점은 `session.teleportPoints` 목록(맵당 한 줄, 최대 48)에 쌓이고 메뉴는 현재 맵·사라진 맵을 뺀다. `Teleportation On/Off` 가 꺼져 있으면 결과 변수 -1, 멈추지 않는다 | `project/teleportPoints.ts` |
| #25 걸음 상태 | 상태 DB HP 패널의 「맵 이동(걸음당)」 + 새 칸 간격·N걸음 후 풀림·걸음 피해로 쓰러짐 | `hpReleaseStep`/`mpReleaseStep` 은 편집기에만 있고 읽는 런타임이 없었다. 이제 걸음마다 적용, 기본은 HP 1 에서 멈춘다(`fieldStepCanKill` 이면 0 → 전원이면 필드 패배) | `project/stateFieldSteps.ts` |
| #32 클릭 이동 | 시스템 DB 「클릭(탭)으로 걷기」 = `system.pointerMovement` | 맵 타일을 누르면 `planPathfindMove` 로 걸어간다. 이벤트 실행·컷신 잠금·이동 중에는 무시 | `playScenePointerMove.ts` |

- 카탈로그 개수 계약: m2 카탈로그 131종, 맵·공통 full 36종(`test/m2EventCommandCatalog.test.ts`, `test/m2RuntimeSupportCompleteness.test.ts`). 새 모던 명령을 더하면 두 숫자를 같이 올린다.
- 새 세션 칸 `teleportPoints`·`highScores`·`stateStepCounts` 는 세이브 왕복, `heldInput` 은 세이브하지 않는다.
- 테스트: `test/mgL6FieldKit.test.ts`.
