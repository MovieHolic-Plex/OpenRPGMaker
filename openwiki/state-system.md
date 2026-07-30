# State System (상태)

End-to-end map of the state/status-effect system: authored definition, runtime application, engine defaults, and editor surface. Read this when a user asks “상태가 뭔가요?” / “정의와 적용의 차이?” / “독·수면은 어떻게 동작하나요?”, or before editing state records, state ontology, or the state DB view.

## TL;DR (use this when explaining to a user)

- **상태(State)** = 배틀 중 대상에게 적용되는 상태이상·강화 효과의 **정의**(레시피). 독·수면·공격상승 같은 것.
- 두 레이어가 같은 이름을 공유하므로 헷갈리기 쉽다:
  - **정의(`database.states`)** — “독이 뭔지, 턴당 얼마 깎이는지”를 프로젝트에 저작하는 데이터. 에디터 DB 탭 / `upsert_state` 도구로 편집. Supabase `current_json` 에 저장.
  - **적용(`PlaySession.actorStateIds`)** — “지금 A배우자가 독에 걸려 있다”는 실시간 기록. 배틀 중 Change State 명령으로 부여/해제, 세이브 슬롯에 영속.
- 핵심 차이 한 줄: **정의는 “독이 어떤 효과인지”, 적용은 “누가 지금 독에 걸려있는지”.** 정의를 바꾸면 해당 상태가 걸린 모든 대상의 효과가 바뀐다.

## Layers and ownership

| Layer | Type | Location | Lifecycle |
|---|---|---|---|
| Authored definition | `StateRecord` | `ProjectDatabaseRecords.states[]` (`src/project/types/database.ts:562`) | Project data → Supabase `current_json` |
| Engine default template | `StateOntology` | `STATE_ONTOLOGY` in `src/project/ontology/databaseStateOntology.ts` | Hardcoded; fallback when record fields are absent |
| Runtime application | `PlaySession.actorStateIds` | `src/project` session model | Save slot; Change State command mutates |

`StateRecord` fields are **optional (sparse)** — the record only stores user overrides; missing fields fall back to the ontology template. `normalizeStateRecord` (`src/project/databaseRecordModel.ts`) preserves values as-is without arbitrary clamping; `resolvedStateValues(id, name, record)` merges record-overrides onto `stateOntologyFor(id, name)` for view/runtime resolution.

## StateRecord fields (authored)

Defined at `src/project/types/database.ts:562`. All fields optional except `id`, `name`.

RM2K3-compatible editable fields:
- `removalCondition` — 해제 조건 (“전투 종료 후 유지” / “피격 또는 전투 종료” / “전투 종료” / “즉시 해제” / “턴 경과”)
- `restriction` — 행동 제한 (“없음” / “행동 불가” / “아군에게 공격 불가” / “스킬 사용 불가” / “물리 공격 불가”)
- `priority` — 우선순위(동시 상태 정렬)
- `accuracyModifier` — 명중률 보정
- `animationIndex` — 상태 적용 시 애니메이션
- `recoverNaturallyFromTurn` / `recoverNaturallyChance` — N턴째부터 자연 회복 확률
- `recoverWhenHitChance` — 피격 시 회복 확률
- `hpReleaseTurn` / `hpReleaseStep` — HP 감소(턴% / 걸음당)
- `mpReleaseTurn` / `mpReleaseStep` — MP 감소(턴% / 걸음당)
- `specialFlags` — 특수 플래그 (“100% 회피” / “마법 반사” / “장비 고정” / “회피 불가” / “장비 고정 영향 없음”)
- `lockedParameters` — 봉인 파라미터 (예: 수면 = 공격/정신/방어/민첩)

Runtime effects (`runtimeEffects?: StateRuntimeEffects`):
- `restrictsAction` — 행동 봉쇄
- `hpDamagePercentPerTurn` — 턴당 HP % 피해
- `attackMultiplier` / `defenseMultiplier` — 공격·방어 배율 (공격상승=2, 방어하락=0.5 식)
- `removeOnBattleEnd` — 전투 종료 시 해제

> Note: `hpReleaseTurn`/`mpReleaseTurn` (record) and `hpTurn`/`mpTurn` (ontology) have **different schemas** — the ontology stores a display string like “매 턴 최대 HP의 -6%”, the record stores a number. `resolvedStateValues` maps between them. Do not assume they are interchangeable.

## StateOntology (engine default template)

`StateOntology` in `src/project/ontology/databaseStateOntology.ts`. A complete template with every field filled, looked up by `stateOntologyFor(id, name)`. Unknown ids get a generic fallback template.

The built-in `STATE_ONTOLOGY` covers the five default states:

| id | name | color | restriction | key runtime effect |
|---|---|---|---|---|
| `state_poison` | 독 | 초록 `#7fc665` | 없음 | 매 턴 최대 HP -6%, 전투 종료 후에도 유지(해독 필요), 3턴부터 20% 자연 회복 |
| `state_sleep` | 수면 | 보라 `#b9a2df` | 행동 불가 | 공격/정신/방어/민첩 봉인, 피격 시 50% 해제, 회피 불가 |
| `state_attack_up` | 공격 상승 | 빨강 `#e68b8b` | 없음 | 공격 2배, 전투 종료 시 해제 |
| `state_defense_up` | 방어 상승 | (없음 hex 기본) | 없음 | 방어 2배, 전투 종료 시 해제 (record에만 `runtimeEffects` 명시) |
| `state_defense_down` | 방어 하락 | 파랑 `#8bb6e6` | 없음 | 방어 절반, 전투 종료 시 해제 |

`StateOntology.summary` is a one-line Korean description intended for surfacing in the editor UI; the state DB view already renders it at the bottom of the form (`db-state-ontology-summary`).

## Default seed (new projects)

`defaultStateRecords()` in `src/project/defaults/defaultDatabaseStarterRecords.ts:96` seeds the five records above into `createBlankProject` → `saveProjectToSupabase`. Per the DB-is-truth rule, `repairSupabaseCurrentJson` no longer backfills missing records from these defaults on load — a sparse DB row loads as-is. Defaults only seed **new** projects.

## Editor surface

`src/editor/panels/databaseStateRecordView.ts` renders the state DB record form (`renderStateRecordForm`). Layout is an RM2K3-style workbench (`.db-state-rm2k3-workbench`) with fieldsets: 기본 설정 / 명중률 보정 / 특수 / 상태 유효도 / 회복 방법 / 행동 제한 / HP / MP / 애니메이션 / 참조, plus the ontology summary line at the bottom.

- A top-of-form inline help box (`.db-state-info-help`, `data-testid=db-state-info-help`) explains what a State is and the definition-vs-application distinction. Keep it short and Korean; it is the user-facing answer to “상태가 뭔가요?”.
- `resolvedStateValues` is the single merge point — both the view and runtime should go through it rather than reading `StateRecord` fields directly when a value may be inherited from ontology.
- References panel lists skills/items whose `stateEffects[].stateId` matches this state (switch-effect skills are excluded — they manipulate switches, not states).
- CSS lives in `src/styles/database/desktop-record-shell/06-states.css`. The workbench uses an explicit `grid-template-areas` layout at ≥981px; adding a new top-level child before the workbench (like the help box) is safe because it sits outside the grid.

## Runtime application

- `PlaySession.actorStateIds` records which states are currently applied per actor; `Change State` event command adds/removes; persisted in save slots.
- Field-state overrides also live on `PlaySession` (`actorStateIds`), never on the project database record — runtime overrides must not mutate authored `StateRecord`.
- Battle state application, damage-over-time, recovery rolls, and removal conditions are owned by `src/battle` (see `runtime-battle.md`).
- State `removalCondition` / `restriction` / `runtimeEffects` are consumed by battle resolution; the editor only authors them.

## Common confusion points

1. **“상태” ambiguity** — could mean the authored definition, the ontology template, or the runtime applied state. Always disambiguate by layer when explaining.
2. **Record vs ontology** — a sparse `StateRecord` with only `{id, name, priority}` is valid; everything else comes from `stateOntologyFor`. Do not treat missing fields as zero/empty.
3. **`hpReleaseTurn` (number) vs `hpTurn` (string)** — different schemas; `resolvedStateValues` maps. Editors writing raw record values must use the numeric form.
4. **`state_defense_up`** has `runtimeEffects` defined in the default record (not just ontology) — the only default state that does this explicitly. Other defaults rely on ontology.
5. **DB-is-truth** — editing `StateRecord` fields in a running project must round-trip through Supabase save; local JSON is cache-only.

## Files to inspect before editing

- `src/project/types/database.ts` — `StateRecord`, `StateRuntimeEffects`, `DatabaseRecords.states`
- `src/project/ontology/databaseStateOntology.ts` — `StateOntology`, `STATE_ONTOLOGY`, `stateOntologyFor`, `resolvedStateValues`
- `src/project/databaseRecordModel.ts` — `normalizeStateRecord`
- `src/project/defaults/defaultDatabaseStarterRecords.ts` — `defaultStateRecords`
- `src/editor/panels/databaseStateRecordView.ts` — DB form view + inline help
- `src/styles/database/desktop-record-shell/06-states.css` — state workbench + help box styles
- `src/editor/tools/dbTools.ts` — `upsert_state` write tool (read-modify-write, allowed-field guidance)
- `src/battle/` — runtime application (see `runtime-battle.md`)
- `src/project/` session model — `PlaySession.actorStateIds` (see `runtime-sessions.md`)

## Related pages

- `openwiki/editor-database.md` — DB editor tabs and record mutation contracts.
- `openwiki/runtime-battle.md` — battle turn flow, damage, state application at runtime.
- `openwiki/runtime-sessions.md` — `PlaySession` shape, save slots, runtime overrides.
- `openwiki/runtime-project-schema.md` — DB-is-truth rule, persistence boundaries.
