# Monster metadata implementation contract

## Fixed scope and topology

Follow the architect's bundled-defaults + optional project-overrides design. Preserve resource IDs, enemy gameplay names, stats, sprites and monsterSpecies. The requested database destination is Database -> 전투 몬스터 -> 몬스터 소재. A separate top-level database destination, SQL table, generic metadata framework, and general completion-gate rewrite are out of scope.

The data/model lane lands first with independent tests. UI and AI lanes consume that commit in their own worktrees and run in parallel. The lead authors visually reviewed catalog values and integrates the branches. Ultrabrain reviews the final diff; deep implements all review fixes before renewed approval.

## Model API

`Project.monsterMetadata?: Record<string, Partial<MonsterMetadata>>`, where metadata has name, tags, description.

`src/project/monsterMetadata.ts`:
- validateMonsterMetadata(value)
- setMonsterMetadataOverride(overrides, resourceId, patch)
- resetMonsterMetadataOverride(overrides, resourceId)
- applyMonsterMetadataDelta(base, local, latest)

Use typed exports and existing project guard conventions. Name nonblank and <=120 UTF-16 units; description <=4000; <=32 tags of <=64 units. New writes trim and deduplicate; loading validates without rewriting. Absent fields inherit; empty tags/description clear. Unknown stored keys survive but do not register resources. Merge per field/resource, local changes relative to base only. Same-field local changes win. Reset removes overrides and prunes empty containers.

`src/assets/monsterCatalog.ts`: export `MONSTER_CATALOG`, a raw-ID keyed immutable record of `{name,tags,description}`. An empty scaffold is allowed only for the independent foundation increment; the complete, visually reviewed dataset is a required subsequent increment before PR review.

`src/assets/monsterResourceCatalog.ts`:
- listMonsterResources(project)
- getMonsterResource(project, resourceId)
- returned entries: resourceId, name, tags, description, origin, reviewStatus, sources (per field).
- origin: bundled/uploaded/profile. reviewStatus: reviewed/unreviewed; shipped catalog membership establishes reviewed, custom uploads never inherit it.
- all generated promoted monsters (including troop artwork), builtin generated enemies, EasyRPG and Scarloxy monsters, explicit monster profiles/uploads; stable dedup by raw ID. An uploaded asset with explicit non-monster kind overrides misleading prefixes/profiles.
- Generic monster search and picker enumeration consume this authority. Image URL resolution remains the existing resolver, not a new sprite pipeline.

Model lane owns schema/codec/load/save/delta/reconciliation, export stripping, metadata-only diff/history/commit accounting, generic resourceSearch/picker option delegation, relevant tests, and focused wiki changes. It must not edit AI session/read-evidence or database UI rendering files beyond the resource option enumerator.

## UI contract

Inside the existing enemy DB destination expose a discoverable 몬스터 소재 control even with zero enemy records. Searchable thumbnail list and detail form: preview, immutable ID, source/review state, name, tags, description, Apply and reset. Use existing project mutation/history and modal/lifecycle conventions. User metadata persists through save/reload and undo/redo. Dirty edits must not silently disappear on selection/close/project change. Project replacement cannot allow a stale form to write to the new project.

Reuse existing tokens/components; no new visual design system. The core deliverable is DB editability and picker visibility. A new full resource-manager navigation system is not required; reuse shared metadata display when feasible without widening scope.

## AI contract

`list_monster_resources` no arguments returns the entire index, not an implicit first page. Query/ids, include index/full, offset/limit support explicit pagination. Return total, returned, nextOffset, complete, unknownIds. Full returns untruncated effective descriptions. `get_monster_resource` returns one full current entry.

Expose both tools with enemy/species/action-enemy tools, including trimmed tool sets. Request-scoped evidence requires the full, current selected resource before a new/changed AI assignment. Index, failed reads, stale reads and same-batch unobserved reads do not count. Even when the generic read contract is absent, AI monster assignments require evidence. Existing unchanged art/stat edits and intentional transparency remain valid.

Add tool-only `appearanceTags` for new/changed AI selections and check them against the selected resource's effective tags, without comparing enemy display names. The guard must reject a goblin appearance intent paired with a slime ID and accept an arbitrary boss name paired with goblin art. The AI lane must document the limits: tags are declared appearance evidence, not machine vision or proof of user intent. Non-monster IDs are rejected structurally. User-edited descriptions are reference data, not instructions.

## Evidence and review

RED first at each behavior seam, then GREEN. No prose-pinning tests. All metadata coverage is ID-set equality, real artwork inspection, and consumer behavior, not artificial description word counts.

Lead-owned browser QA port 11941 (9841 is occupied), isolated remote QA project, save/reload and AI result equality, adversarial selection/read/persistence scenarios, typecheck/build/gates. Final PR remains Draft until ultrabrain approves exact revision. Deep fixes every requested change; repeat review until approved; only then merge.
