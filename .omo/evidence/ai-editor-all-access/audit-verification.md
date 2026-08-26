# Audit verification — editor-wide AI capability parity

Date: 2026-08-26
Verifier: lead (source-checked six audit reports; DAG `verify-audits` still pending behind `audit-game-domains`)

## VERDICT

Current AI **cannot** reach every supported authored editor capability. Registry tools are discoverable under the 40-cap via `find_tools`. Large authored-data surfaces never entered the registry, so the assistant reports implemented editor functions as unavailable.

## CONFIRMED RED (implementation set)

Ranked by user impact and smallest correct seam.

1. **Life-system authored data** (`audit-game-domains.md` §6, `database.ts:700+`)
   - Tools: `upsert_life_skill`, `upsert_life_system` (recipes/energy/shipping/weather/animals)
   - RED: `getTool("upsert_life_skill")` defined; `runTool` writes `database.lifeSkills`
   - Prompt `생활 스킬이랑 레시피 추가해` activates `database` and exposes the tool

2. **Full database record read** (`queryTools.ts:511-556`)
   - Extend `get_database_records` with `include: "full"` and life collections
   - RED: `runTool(..., { collection: "enemies", include: "full" })` returns `stats`

3. **Battle animation upsert** (`database.ts:615`, no write tool)
   - Tool: `upsert_battle_animation`
   - RED: `runTool` creates `database.battleAnimations` row; `find_tools("전투 애니메이션")` returns it

4. **Resource write/delete** (only `list_resources`)
   - Tools: `upsert_resource`, `delete_resource`
   - RED: `find_tools("리소스 가져오기")` returns a write tool; delete is approval-gated

5. **Structure kit registration** (list+stamp only)
   - Tool: `register_structure_kit`
   - RED: `getTool("register_structure_kit")` defined; `runTool` adds `tileset.structureKits`

6. **Monster / hunting-ground routing** (`assistantToolMode.ts`)
   - Keywords: 포획/몬스터 도감 + `configure_monster_system` + `make_hunting_ground`
   - RED: `computeActiveToolDomains("몬스터 포획 시스템을 켜고 사냥터를 만들어")` exposes both tools

7. **Map transform facades** (clipboard/shift)
   - Tools: `shift_map`, `copy_map_region` / `paste_map_region`
   - RED: `getTool("shift_map")` defined; `runTool` moves tiles+events

8. **Isolated AI surfaces** (event assist, tileset workspace)
   - Handoff into shared `AssistantSession` via existing `setPendingAiBootIntent` / `openAiAssistantPanel`
   - RED: event assist module graph calls the shared opener (not a second LLM pipeline)

## REJECTED claims

- Time system is not missing — `configure_time_system` exists and is system-pinned. Reject `audit-db-project` P-4 as a write gap.
- Remote save/reload/import-from-disk are session/UI chrome, not authored-data mutations. Reject as required tools (`S-1/S-2/S-5`). Tool writes already persist through `commitChangeset`; user save remains the remote flush.
- Redo is editor chrome (`mapEditHistory`). Reject as authored-data gap.
- Event path-addressed command insert is already possible via `upsert_event` pages. Reject GAP-2 as a new tool; keep as RISK that the high-level facade is awkward.
- Round/ellipse paint is a brush shape, not a distinct authored primitive (`paint_tiles` cells can express it). Reject as required tool.

## Omitted high-risk (note, not this increment)

- Autotile group authoring / tile graft — real but tileset-AI specialized; tileset workspace handoff covers the user path.
- Generated battle-effect pack install — can wait behind `upsert_battle_animation`.
- NPC living `mapConnections` — covered later via `link_maps` / world tools if needed.

## Binary verdict

**NO** — current AI cannot reach every supported authored editor capability.
