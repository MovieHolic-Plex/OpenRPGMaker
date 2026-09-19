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
   - Editor index: `openwiki/editor-workflows.md` (slim TOC linking to the above)
   - 연결 던전 생성 (방 그래프·복합 절벽·맥락 소품): `openwiki/connected-dungeon-generation.md`
   - Castle / keep map modules (`map_castle_keep` gold): `openwiki/castle-map.md`
   - Large river/market village generation (bbox → houses → roads): `openwiki/large-village-generation.md`
   - Terrain autotiles, template-block anchors, water/animation wiring: `openwiki/autotiles.md`
   - Runtime pre-edit routing & cautions (read first): `openwiki/runtime-pre-edit-routing.md`
   - Runtime battle: `openwiki/runtime-battle.md`
   - 지원 전투 시스템 2종(RM식 `rm2k3`/`rm2003`, 포켓몬식 `gen1`/`pokemon`) 정책과 지원 종료 목록: `openwiki/runtime-battle.md` 의 "지원 전투 시스템은 둘뿐이다 (2026-08-28)" 절
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
   - Community site (Next.js asset/game sharing, Supabase tables `openrpg_*`): `openwiki/community-site.md`
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
- Large editor sheets are split at top-level rule or section boundaries. The original
  facade keeps its first chunk and the owning surface `index.css` imports later `.part-N.css`
  chunks directly in the same layer and order. CSS contract tests that inspect a whole
  sheet use `test/cssFamily.ts` so they see the same import family as the app.
- The resource manager is a lazy editor surface that can open before the database CSS
  chunk. `src/styles/resources/resource-manager.css` therefore owns its fixed backdrop,
  centered window, header, and flex body shell; do not make it depend on opening the
  database modal first.
- `test` and `test/e2e` are part of the contract. Update or add focused tests for changed behavior.

## How an AI should use this wiki

Use this checklist before editing:

- Identify the feature area and read the matching wiki page.
- Name the source files that own the behavior before opening random files.
- Preserve the authored-project versus runtime-session split.
- Keep persistence and migration changes deterministic and backward compatible.
- For UI work, verify through the browser surface and save screenshots or logs under `output/evidence` or `evidence`.
- If the change reveals stale wiki guidance, update the wiki as part of the same work.

## Supabase DB mandatory (see root `AGENTS.md`)

Root `AGENTS.md` hard rule: **do not finish map/event/demo/content work without Supabase save + reload proof.**  
`blankProject` / `freshProject` / `dev-showcase` skip remote persistence — never treat those sessions as a complete deliverable.  
Engine-only code changes and narrow unit-test fixtures are the only default exceptions.

## Desktop UI integration truth (2026-08-11)

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
