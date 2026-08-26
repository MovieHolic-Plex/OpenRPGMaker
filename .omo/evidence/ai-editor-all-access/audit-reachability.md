# Audit — AssistantSession tool-exposure reachability

Date: 2026-08-26
Author: lead (replacement for `audit-reachability` node `st_01a03d46`, which completed after a 90s provider timeout and wrote no file)
Scope: `src/ai/assistantSession.ts`, `src/editor/assistantToolMode.ts`, `src/editor/tools/toolRegistry.ts`, `src/editor/tools/discoveryTools.ts`, `src/ai/approvalPolicy.ts`, `src/editor/regionTask`, focused AI tests.

## Classification

- **SAFE** — active typed tool cannot be permanently hidden; discovery or pins restore it.
- **RISK** — reachable only after a search/keyword that the model may fail to emit.
- **CONFIRMED GAP** — an authored editor capability has no typed tool, or an in-editor AI surface cannot use the registry.

## Architecture claims

| Claim | Label | Source |
| --- | --- | --- |
| Deprecated tools are hidden from `activeTools()` / `toOpenAiTools` | SAFE | `toolRegistry.ts:200` |
| Per-round domain exposure is capped at 40 | SAFE | `toolRegistry.ts:224` `MAX_EXPOSED_TOOLS` |
| Pins + round-robin prevent last-domain wipeout | SAFE | `toolRegistry.ts:229-431` |
| Database domain is never dropped wholesale | SAFE | `toolRegistry.ts:453` `removableDomains` skips `database` |
| Strong-intent / UI domains are not domain-dropped | SAFE | `toolRegistry.ts` `domainPriority >= 3` only |
| `find_tools` is attached outside the 40-tool window every LLM round | SAFE | `assistantSession.ts:1965-1969` |
| Successful `find_tools` names escalate for the rest of the user turn (max 16) | SAFE | `assistantSession.ts:110,2203-2211` |
| Exact tool names in the user text are re-merged via `mentionedToolSchemas` | SAFE | `assistantSession.ts:1948` |
| Plan `successTools` stay reserved while a work plan is active | SAFE | `assistantSession.ts:1951` `planRequiredToolSchemas` |
| Quest persist tools reserved when quest domain is active | SAFE | `assistantSession.ts:1951-1953` |
| Destructive tools still go through approval even under autoApprove | SAFE | `approvalPolicy.ts` `DESTRUCTIVE_TOOLS` |
| Region-task uses the same registry; planner is skipped | SAFE | region-task skip + same `runTool` |
| `find_tools` returns at most 6 matches | RISK | `discoveryTools.ts` `MAX_DISCOVERY_RESULTS = 6` |
| Escalation lasts only the current user turn | RISK | `turnEscalatedToolNames` reset per send |
| A tool whose description does not match the query is reported as "없습니다" | RISK | `discoveryTools.ts:70` empty-match summary |
| `set_map_properties` / `set_project_settings` are not pinned | RISK | `PINNED_TOOLS_BY_DOMAIN` map/system lists omit them |
| Monster keywords activate `battle`+`database`, not `system`+`map` | RISK | `assistantToolMode.ts` INTENT_KEYWORDS |
| Farm/life keywords do not activate `database` | CONFIRMED GAP | `assistantToolMode.ts` no `생활/제작/레시피` |
| Resource import/delete/tileset-from-upload have no write tool | CONFIRMED GAP | only `list_resources` |
| Battle-animation create/update has no upsert tool | CONFIRMED GAP | `dbTools.ts` collections include `battleAnimations` for duplicate/delete only |
| Life-system authored data (skills/recipes/energy/shipping/animals/weather/collections/characters) has no tools | CONFIRMED GAP | `audit-game-domains.md` §6 |
| User structure-kit registration has no tool | CONFIRMED GAP | `structureKitTools.ts` list+stamp only |
| `get_database_records` returns `{id,name}` only | CONFIRMED GAP | `queryTools.ts:511-556` |
| Event AI assist never enters `AssistantSession` / registry | CONFIRMED GAP | `eventEditor/aiAssist.ts` → `eventCommandAssist.ts` |
| Tileset AI workspace never enters `AssistantSession` / registry | CONFIRMED GAP | `tilesetAiWorkspaceModal.ts` + native review session |
| Map clipboard copy/paste and `shiftMapContent` have no tools | CONFIRMED GAP | `mapClipboard.ts`, `mapShiftActions.ts` |
| Autotile group authoring / tile graft have no tools | CONFIRMED GAP | `tilesetActions.ts` |

## Executable RED assertions

1. `getTool("upsert_life_skill")` is defined and `toOpenAiTools({ mode: "database" })` includes it. Fails today.
2. `getTool("upsert_recipe")` (or one `upsert_life_system` facade covering recipes/energy/shipping/makers) is defined. Fails today.
3. `runTool(..., "get_database_records", { collection: "enemies", include: "full" })` returns `stats`. Fails today (`include` rejected / omitted).
4. `runTool(..., "find_tools", { query: "리소스 가져오기" })` returns a write tool (`upsert_resource` or `import_resource`). Fails today (empty or `list_resources` only).
5. `runTool(..., "find_tools", { query: "전투 애니메이션" })` returns `upsert_battle_animation`. Fails today.
6. Prompt `몬스터 포획 시스템을 켜고 사냥터를 만들어` activates domains that expose `configure_monster_system` AND `make_hunting_ground`. Fails today (system/map not both on).
7. Prompt `생활 스킬이랑 레시피 추가해` activates `database` and exposes a life write tool. Fails today.
8. Event AI assist module graph contains a call into `AssistantSession` or `runTool`. Fails today.
9. `getTool("register_structure_kit")` is defined. Fails today.
10. `getTool("shift_map")` or `copy_map_region` is defined. Fails today.

## Verdict

Active registry tools are **not permanently hidden** under the 40-cap if the model calls `find_tools` with a matching query. That is not the same as "every editor function is accessible". Large authored-data surfaces (life system, resources, battle animations, structure-kit learning, full DB reads, map clipboard/shift, isolated event/tileset AIs) have **no typed contract**, so the assistant truthfully-but-wrongly reports that the editor cannot do them.

SAFE for existing registry tools + discovery.
CONFIRMED GAP for authored capabilities that never entered the registry.
