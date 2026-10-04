# OPRN Studio Project Wiki

This is the AI-facing wiki entry point for this specific editor project. It is meant to be read before modifying the codebase, especially by coding agents that need to understand how to safely operate on the editor.

## Purpose

The wiki exists to make AI work project-aware:

- Each project keeps its own `openwiki` directory.
- Agents read the local wiki before edits instead of relying on memory from another repo.
- The wiki captures ownership boundaries, high-risk flows, and validation expectations.
- The wiki is updated when the project changes, so future agents inherit current context.

This is not the in-app user manual. It is the pre-edit context layer for agents.

## Required pre-edit read order

1. Read this file.
2. Read `openwiki/quickstart.md` — 환경 보정, **게이트와 그 기준선 실측값**, 기능→진입 파일 표.
   이 절차를 건넌 에이전트는 자기 환경 함정을 생소한 불량 코드로 오진한다.
3. Read `openwiki/INDEX.md` — 위키 41쪽의 크기·절 좌표·주의 표지(통째 읽기가 잘리는 7쪽, 모지바키 9쪽,
   없는 파일을 가리키는 참조 60여 건). 필요한 절만 줄 번호로 잘라 읽는다 — 위키 전체는 약 27만 토큰이다.
4. Read the focused page for the area being changed:
   - Editor pre-edit routing & cautions (read first): `openwiki/editor-pre-edit-routing.md`
   - Editor observability (mutation 계측 초크포인트, 편집 감사 로그, 오류 트랩, 디버깅 레시피): `openwiki/editor-observability.md`
   - Editor event authoring: `openwiki/editor-event-authoring.md`, `openwiki/editor-event-commands.md`, `openwiki/editor-event-command-fixes.md`
   - Editor database: `openwiki/editor-database.md`
   - 직업 승급·스킬 트리: `openwiki/growth-trees.md`
   - World generation rules (authored water/forest/road numbers + natural-language keyword rules): `openwiki/world-generation-rules.md`
   - Editor AI panel & tools: `openwiki/editor-ai-panel.md`, `openwiki/editor-ai-tools.md`, `openwiki/ai-context-compaction.md`
   - Editor misc workflows: `openwiki/editor-workflows-misc.md`
   - Editor validation: `openwiki/editor-validation.md`
   - Editor genre-pack authoring contract: `openwiki/editor-genre-packs.md`
   - Interior room harness: `openwiki/editor-interior-room-harness.md`
   - 슈퍼하네싱 기물 파생(방향·상태·모션·크기, 사람 선택, 공용 자동 게시): `openwiki/harnesses/interior-prop-derivations.md` → `openwiki/harnesses/interior-prop-derivations-operations.md`. 기존 공간 실행기와의 연결 범위: `openwiki/harnesses/super-harness-integration.md`.
   - 캐릭터 GIF 공방(GPT 자유 저작·결손 검사·사람의 남김/폐기·선택 팩): `openwiki/charset-actor-harness.md`
   - Editor index: `openwiki/editor-workflows.md` (slim TOC linking to the above)
   - 연결 던전 생성 (방 그래프·복합 절벽·맥락 소품): `openwiki/connected-dungeon-generation.md`
   - Castle / keep map modules (`map_castle_keep` gold): `openwiki/castle-map.md`
   - **Slates 32px로 마을을 만들 때 먼저 읽을 그림 포함 조립 지침:** `openwiki/slates-agent-entry.md` → `openwiki/slates-dense-town.md` → `openwiki/slates-assembly-playbook.md` → 구조 학습·표본·구역 도감·저작 지침 (성곽·돌출층·깊은 지붕·46개 구역·검토 보류 항목).
   - 촘촘한 50×50 성곽 마을의 최신 밀도 지침·실측 결과: `openwiki/slates-dense-town.md`, `docs/experiments/slates-astra-v3/RESULT.md`.
   - Slates 문서 개정·단계별 감독자 검토의 실제 결과와 한계: `docs/experiments/slates-astra-v2/RESULT.md`.
   - 성채 참고 이미지의 구도·색·지형·생활감 및 직전 제작물 반려 근거: `tiledata/castle-tiles-rpgs/README.md` (새 성채 저작 전에 읽기; 원본/반려/수정 이미지와 실측 좌표 포함)
   - Large river/market village generation (bbox → houses → roads): `openwiki/large-village-generation.md`
   - Terrain autotiles, template-block anchors, water/animation wiring: `openwiki/autotiles.md`
   - Runtime pre-edit routing & cautions (read first): `openwiki/runtime-pre-edit-routing.md`
   - Runtime battle: `openwiki/runtime-battle.md`
   - Character battle motion (136 actors, current class/equipment, contact geometry): `openwiki/character-battle-motion.md`
   - 측면 전투의 타격감·정지 시계·검 포즈/소리·피격 반동: `openwiki/battle-impact-contact.md`
   - 공용 몬스터 140종 · 옛 그림 폐기 · native 초상/포즈 · RM2003 스킬 비교: `openwiki/native-enemy-retirement.md`
   - 지원 전투 규칙 2종(RM식 `rm2k3`, 포켓몬식 `gen1`)과 스킨 12종(유리 뼈대 변형 11 + 몬스터 대치 1, 2026-09-25): `openwiki/runtime-battle.md` 의 "지원 전투 시스템은 둘뿐이다" 절
   - Runtime sessions & state: `openwiki/runtime-sessions.md`
   - Team project host, local/remote SQLite, membership and asset ownership: `openwiki/team-project-host.md`
   - Runtime project schema & persistence: `openwiki/runtime-project-schema.md`
   - Runtime M2 flow controls: `openwiki/runtime-m2-flow-controls.md`
   - Runtime index: `openwiki/runtime-and-data.md` (slim TOC linking to the above)
   - State system (authored definition, ontology, runtime application, editor surface): `openwiki/state-system.md`
   - Stardew-like product model and P1/P2 scope: `openwiki/stardew-core-elements-research.md`
   - Boot flow, mode switching, module boundaries: `openwiki/architecture.md`
   - CC0 BGM catalog (281 tracks, CDN wiring, audio defaults): `openwiki/bgm-catalog.md`
   - CC0 SE catalog (635 sounds, in-repo assets, provisional labels): `openwiki/se-catalog.md`
   - Test and evidence strategy: `openwiki/testing.md`
   - Screenshot-only agent UI discovery pilot: `openwiki/ui-discovery-pilot.md`
   - Community site (Next.js asset/game sharing, PostgreSQL tables `openrpg_*`): `openwiki/community-site.md`
4. Inspect the actual source files named by the focused page before editing.

## Project identity

OPRN Studio is a browser-based top-down tile JRPG maker/editor. It combines:

- An editor mode for maps, events, resources, database records, and project save/import/export.
- A play mode for testing authored projects.
- A project data model shared by editor, player, persistence, and tests.
- RM2k3-inspired authoring and runtime behavior.

## Main ownership boundaries

- `src/app` owns app boot, mode switching, shell setup, and Phaser game lifecycle coordination.
- `src/editor` owns authored-content editing. It should update project data, not runtime session state.
- `src/player` owns play-mode UI, runtime scene wiring, dialogue, title/load surfaces, and scene interaction.
- `src/battle` owns battle state, rules, turn flow, command resolution, rewards, and battle snapshots.
- `src/project` owns canonical project data, defaults, migrations, validation, persistence, and remote/local storage boundaries.
- `src/assets` owns bundled/generated asset resolution, slicing, transparency, and preview helpers.
- `src/styles` owns visual presentation. Avoid moving behavior into CSS-only workarounds.
- Editor CSS is organized by the named cascade layers in `src/styles/index.css`. Dynamic
  panel sheets must join their owning layer; `src/editor/panels/spatialPlaceLibrary.css`
  is loaded by the database panel and therefore wraps its rules in `@layer database`.
- The editor entry does not load the runtime surface (`src/styles/runtime/index.css`) eagerly; only
  `runtime/fonts.css` is eager. Surfaces that render runtime DOM call `preloadRuntimeStyles()`
  (`src/app/runtimeStyles.ts`). See `openwiki/editor-pre-edit-routing.md` 「편집기 CSS·목록 비용」.
- Large editor sheets are split at top-level rule or section boundaries. The original
  facade keeps its first chunk and the owning surface `index.css` imports later `.part-N.css`
  chunks directly in the same layer and order. CSS contract tests that inspect a whole
  sheet use `test/cssFamily.ts` so they see the same import family as the app.
- The resource manager is a lazy editor surface that can open before the database CSS
  chunk. `src/styles/resources/resource-manager.css` therefore owns its fixed backdrop,
  centered window, header, and flex body shell; the nested URL importer in
  `resource-manager.part-6.css` owns the same fixed backdrop and header contract. Do not
  make either surface depend on opening the database modal first.
- The AI sidebar and editor-owned AI dialogs mount before the database CSS chunk. Their
  first-paint geometry and visual family are loaded by
  `src/styles/database/editor-startup-ai.css` in the static `database` layer, while
  `ai-modal-shell.css` owns the generic editor-owned dialog shell. The manifest is the
  single bootstrap owner for the AI panel, composer, deck, cards, and team sidebar;
  those imports are removed from the lazy database suffix to avoid a second copy.
  `database/editor-owned-ai-modal-shell.css` still reapplies the modal body scroll
  contract after the database layer arrives. DB record sheets remain lazy, but no AI
  surface may depend on opening the database modal before it is styled.
- `test` and `test/e2e` are part of the contract. Update or add focused tests for changed behavior.

## Authored tile placement references

현재 프로젝트의 **DB → 타일 → 참고문서 → 용도**가 우선이다. [타일셋 참고문서](tileset-reference-documents.md)의 MD·이미지 선행 읽기 계약을 따른다. 저장소 학습 자료는 연구 출처이며 프로젝트 정본을 대체하지 않는다.

숲·마을 타일 저작 전에 [tiledata/forest-villages](../tiledata/forest-villages/README.md)의 사용자 검수 규칙·승인본·실패 사례를 읽는다. 새 마을 사례와 전체 스크린샷도 이 디렉토리에 저장한다.

## How an AI should use this wiki

Use this checklist before editing:

- Identify the feature area and read the matching wiki page.
- Name the source files that own the behavior before opening random files.
- Preserve the authored-project versus runtime-session split.
- Keep persistence and migration changes deterministic and backward compatible.
- For UI work, verify through the browser surface and save screenshots or logs under `output/evidence` or `evidence`.
- If the change reveals stale wiki guidance, update the wiki as part of the same work.

## 프로젝트 정본 저장 (see root `AGENTS.md`)

콘텐츠 작업은 Electron/팀 호스트의 SQLite 프로젝트에 저장한 뒤 같은 대상을 재로드해야 완료다.
브리지 없는 preview·메모리·dev-showcase는 정본 저장을 대신하지 않는다.
과거 기록은 오프라인 아카이브에서 복구한다. 외부 DB 연결은 사용하지 않는다. 현재 경로는
[team-project-host.md](team-project-host.md), 제거 현황은 [storage-retirement.md](storage-retirement.md)를 따른다.
순수 엔진 코드와 단위 테스트용 최소 fixture는 콘텐츠 저장 의무의 예외다.

## Desktop UI integration truth (2026-08-11)

- New projects (2026-10-01) start from a playable example, a blank project, or explicit AI planning.
  The launcher shares the editor's warm palette. Example/blank projects use a first-edit guide in the existing
  right assistant dock and do not require an AI connection. Existing projects retain their normal assistant UI.
  Interview answer receipts and bounded reading transitions are documented in `editor-genre-packs.md`.

- The supported editor floor is desktop `1024px`; the acceptance shell matrix is `1024×768`, `1280×800`, and `1440×900` in both Basic and Expert. No mobile or touch layout is promised below that floor.
- Database is a topbar work window with an explicit dock mode. Runtime Test Play scales fit-without-crop: whole-number for the shipped player, unfloored fit for the editor Test Play window (which also auto-starts the run and offers 다시 시작 / 타이틀부터), and title options keep roving keyboard focus with keyboard-only activation; touch controls require an explicit mobile-build override.
- The editor shell is the warm cream studio (`src/styles/tokens.css` is the SoT, `color-scheme: light` in `src/styles/index.css:75`; bridges in `src/styles/editor/core.part-1.css`, `src/styles/database/tabs-b-shell-layout.css`, `src/styles/shell/figma-editor/01-shell-topbar-team.css`; cream ladder `canvas #E7E0D0 < inset #EFE9DC < base #F7F3EA < surface #FCF9F2 < raised #FFFDF8 < overlay #FFFFFF`). The unified cream entry (welcome / recovery / coach) shares one visual language — welcome/recovery/coach are cream panels on the same ladder, not separate dark surfaces. Previous dark values live in git history only. First visit is **Beginner**. With empty layout storage, AI boots open in **float** mode over the canvas; the map/tile/event tool sidebar is the left docked column. Stored `chatDock` (`float` or `side`) and collapse preferences are honored without a layout-cache wipe, and side dock remains a toggle. The agent plate, map briefing (`지금 이 맵`), at most three `@>` next-move rows, 지시 / 질문 / 계획 composer modes, work strip, selection minibar, restore control, and session persist across UI modes. Event-editor ownership is the desktop matrix `1586×992`, `1280×900`, `1024×768`, and `960×900`; it keeps its two-column workbench without strip/footer overlap or coachmark occlusion.
- Shared application confirms/alerts participate in `modalStack`; they expose title/message relationships, trap action focus, route Escape only to the top layer, and restore an attached opener.
- Modern Exteriors asset packaging, custom-atlas semantics, seeding, remote persistence, and Modern browser diagnostics are blocked pending repository-visible redistribution rights. Those blocked workstreams are not evidence for the implemented desktop UI scope and must not be substituted with a local fixture or DB write.

## Per-project wiki structure

For each project that uses this pattern, keep:

- `AGENTS.md` at repo root: tells AI systems where the local wiki lives and what to read first.
- `openwiki/PROJECT_WIKI.md`: project-specific AI entry point.
- `openwiki/quickstart.md`: 에이전트의 첫 10분 — 환경·게이트 기준선·기능→파일 라우터.
- `openwiki/INDEX.md`: 생성 항해 색인(`npm run openwiki:index`) — 포기하지 말고 재생성해라.
- `openwiki/architecture.md`: ownership boundaries and boot/runtime structure.
- `openwiki/editor-workflows.md`: slim index to editor topic pages.
- `openwiki/runtime-and-data.md`: slim index to runtime topic pages.
- `openwiki/testing.md`: verification contract.
- Optional focused pages for large subsystems.

Do not share one wiki across unrelated projects. Cross-project memory should be explicit links or copied guidance that has been reviewed for the target project.

## Staleness rule

If source behavior disagrees with the wiki, the source wins for the immediate fix. Then update the wiki so the next agent does not repeat the stale assumption.

- 공용 전투 동작 32종·이동/가속/배우 경로·실제 턴 기믹·편집기/조수 저작: [battle-motion-programs.md](battle-motion-programs.md).

## 지형 설치 도구 (2026-10-03)

태양 방향·고도·지형/집/나무의 땅 그림자, 기본 off·편집기/플레이어/조수 이미지 공통 계산: [sunlight-shadows.md](sunlight-shadows.md).

높이·표면·강·군집 선택, 네 방향 경사로·두 둑 다리·군집 복원·시작점 통행 미리보기: [terrain-placement-tools.md](terrain-placement-tools.md).

지형 설계·적용 후 제어점 재편집·자동 경사 연결·침식/평활화·수심/폭포·게임 상태 경로 검사·공용 도장·시야 토글/발사체 높이: [terrain-design-suite.md](terrain-design-suite.md).

## 조선 설화 콘텐츠 팩

선택형 아이템·장비·몬스터·행동·직업·기술 묶음: [joseon-folklore-content.md](joseon-folklore-content.md). 기존 RM2003 데이터와 런타임을 쓴다.
