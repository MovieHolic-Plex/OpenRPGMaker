# 장르 프리셋 Spec Sheet — 장기작업을 코드로 강제하는 수락 계약

작성 2026-08-30. 대상: `src/editor/welcomeGenrePresets.ts`, `src/editor/genrePacks.ts`,
`src/ai/workPlan.ts`, `src/ai/assistantSession.ts`.

## 요지

장르 프리셋 클릭이 아무것도 만들지 못하는 원인은 하니스의 능력 부족이 아니다. 하니스는 이미
48턴 자율 계속 · 항목별 산출물 게이트 · 레이어 검증 · 마일스톤 자동 적용 · 런 종료 저장 증명을
**코드로** 강제한다. 문제는 프리셋이 그 기계에 **산문 프롬프트**로 들어가고, 그 산문이 하니스와
반대되는 지시("제안만 하고 승인 기다려라")를 담고 있으며, 팩의 기계 판정 계약이 런과 연결되지
않은 채 별도로 놀고 있다는 것이다.

**권고: 하니스 재작성 금지.** 프리셋 → 하니스 경계에 기계가 읽는 spec sheet 를 놓고, 기존 강제
지점 4곳에 그걸 물린다. 새 강제 기구를 발명하지 않는다.

## 실측 — 무엇이 이미 코드 강제인가

| 강제 항목 | 현재 상태 | 근거 |
|---|---|---|
| 자율 계속 (총 예산) | 있음. 48턴 | `assistantSession.ts:534` `AGENT_RUN_MAX_TOTAL_STEPS = 48` |
| 턴당 Ralph 스텝 | 있음. 12 | `workPlan.ts:168` `MAX_WORK_PLAN_AUTO_STEPS_PER_TURN` |
| 계획 미완료면 자동 계속 | 있음 | `assistantSession.ts:1051` `runAutonomousDriver` / `1075` `shouldAutoContinue` |
| 항목 완료 = 툴 성공 매칭 | 있음 | `workPlan.ts` `advanceWorkPlanFromTools` + `successTools` |
| 항목 완료 = 산출물 실사 | 있음 | `workItemOutcome.ts` `verifyCreatedMapsAuthored` / `verifyTargetMapChanged` / `verifyAuthoredBossPhases` / `verifyAuthoredQuestsPlayable` |
| 레이어 종료 검증 | 있음 | `assistantSession.ts:1718` `sweepFinishedLayers` + `agentVerification.ts` `classifyLayer` |
| 승인 없이 저장소 반영 | 있음 (자율 런) | `assistantSession.ts:1569` `maybeAutoApplyMilestone` |
| 런 종료 저장 증명 | 있음 | `assistantSession.ts` `maybeRunEndProof` → `agent_run_saved` |
| 코드가 직접 세운 WorkPlan | **선례 있음** | `workPlan.ts:775` `buildDefaultWorkPlan` |
| 팩 요구사항의 기계 판정 | 있으나 **런과 무관** | `genrePacks.ts` `requirementConfigured` / `evaluateGenrePackConfiguration` |
| 프리셋 → 목표 전달 | **산문 프롬프트뿐** | `welcomeGenrePresets.ts:51-58`, `editorWelcome.ts:229` |
| 프리셋 → 결정적 적용 | **없음** | `applyGenrePreset` 호출처는 `reset_project`(`projectTools.ts:57`)와 ⚙ 경로(`genrePacks.ts:261`)뿐 |

즉 강제 기계는 다 있고, 프리셋만 그 밖에 있다. `welcomePresetToGenrePreset`
(`genrePresets.ts:68`)과 `consumePendingWelcomePipeline`(`aiBootIntent.ts:52`)은 호출처 0건 —
배선이 끊긴 채 타입만 남아 있다.

## 설계 원칙

1. **spec sheet 는 산문이 아니라 술어다.** 각 조항은 `(project) => boolean` 로 판정되어야 한다.
   판정 불가능한 조항은 spec 에 넣지 않는다.
2. **기존 계약을 확장한다.** `GenrePackRequirement`(`kind` + `runtimeCapability`)가 이미 그
   형태다. 두 번째 요구사항 테이블을 만들지 않는다.
3. **없는 툴·없는 엔진 기능을 조항으로 쓰지 않는다.** 조항마다 실제 레지스트리 툴 이름을 단다.
   `openwiki/editor-genre-packs.md` 가 금지한 "fictional executable adapter ID" 와 같은 규칙이다.
4. **수락은 fail-closed.** 조항 미충족 = 런 미완료. 모델의 "완료했습니다" 문장은 근거가 아니다.

## Spec sheet 스키마

`GenrePackRequirement` 를 수락 조항으로 승격한다. 추가 필드 3개.

```ts
// src/editor/genrePacks.ts — 기존 타입 확장
export type GenrePackRequirement = {
  readonly id: string;
  readonly kind: GenrePackRequirementKind;   // 술어 선택자 (기존)
  readonly runtimeCapability: string;        // (기존)

  /** 사람이 읽는 수락 문장. WorkPlan item.doneWhen 으로 그대로 나간다. */
  readonly acceptance: string;
  /** 이 조항을 만족시키는 실제 레지스트리 툴. WorkPlan item.successTools 로 나간다. */
  readonly authoringTools: readonly string[];
  /** 조항 하나를 항목 하나로 내보낼 때의 지시문. */
  readonly instruction: string;
};
```

`kind` 는 계속 `requirementConfigured(project, kind)`(`genrePacks.ts:355`) 의 단일 스위치로
판정한다. 새 조항을 넣을 때 스위치에 케이스를 추가하는 것이 유일한 확장 경로이며, 스위치는
exhaustive 라 타입 검사가 누락을 잡는다.

### monster-collect 에 필요한 신규 `kind`

| 신규 kind | 술어 | 근거 필드 |
|---|---|---|
| `start-position-reachable` | 시작 맵 존재 + `startPos` in-bounds + passable | `collision.ts` `inBounds`/`isPassable` (farm 경로가 이미 씀) |
| `map-encounter-table` | 어떤 맵이 `encounterRate > 0` && `encounterTable.length > 0` | `types/project.ts:48,52` |
| `starter-party` | `session.monsterParty.length > 0` && 모든 인스턴스가 `session.monsterInstances` 에 있음 | `types/project.ts:313,314` |
| `monster-species-battle-ready` | `database.monsterSpecies` 각 종이 실존 troop/스킬 참조를 가짐 | `collectProjectReferenceIssues` 재사용 |

## monster-collect spec sheet (전문)

레이어 순서 = 의존 순서. 하니스가 레이어 단위로 검증을 쓸어담으므로 순서가 계약이다.

### L1 시스템

| id | kind | acceptance | authoringTools |
|---|---|---|---|
| `monster-collection` | `system-monster-collection` | `system.monsterCollection === true` | `configure_monster_system` |

이 레이어는 **AI 를 태우지 않는다** — 프리셋 클릭 시점에 `applyGenrePreset` 로 결정적으로
적용하고 done 으로 시작한다 (아래 배선 ①).

### L2 데이터

| id | kind | acceptance | authoringTools |
|---|---|---|---|
| `monster-species` | `database-monsters` | `database.monsterSpecies.length >= 3` | `define_monster_species` |
| `monster-troops` | `database-troops` | `database.troops.length >= 1`, 각 troop 이 실존 종을 참조 | `upsert_troop` |
| `monster-species-battle-ready` | `monster-species-battle-ready` | 종·troop 참조 무결성 0건 | `upsert_troop`, `run_lint` |
| `care-items` | `database-items`(기존 확장) | 회복/포획 아이템 각 1종 이상 | `upsert_item` |

### L3 세계

| id | kind | acceptance | authoringTools |
|---|---|---|---|
| `start-map` | `map` | 맵 1장 이상 | `create_map`, `fill_region` |
| `start-position-reachable` | `start-position-reachable` | 시작 좌표가 통행 가능하고 시작 맵 안 | `set_start_position` |
| `encounter-ground` | `map-encounter-table` | 조우율 > 0 인 맵 + 가중 조우표 | `make_hunting_ground`, `set_encounter_table` |
| `starter-event` | `map-event` | 스타터 지급 이벤트 1개 | `upsert_event`, `give_starter_monsters` |
| `starter-party` | `starter-party` | 세션에 스타터 1마리 편입 | `give_starter_monsters` |

### L4 검수

| id | kind | acceptance | authoringTools |
|---|---|---|---|
| `project-lint-errors` | `project-lint-errors` | lint error 0건 | `run_lint` |
| `project-reference-integrity` | `project-reference-integrity` | 참조 이슈 0건 | `run_lint` |
| `battle-simulated` | (신규) `battle-simulated` | 조우표의 troop 으로 전투 시뮬 1회 성공 | `simulate_battle` |
| `walkthrough` | (신규) `walkthrough-passed` | 시작→풀숲→조우→포획 워크스루 통과 | `play_walkthrough` |

L4 의 두 조항은 `agentVerification.ts` 의 레이어 분류가 이미 최종 레이어에 워크스루를 요구하는
방식과 같은 성격이다. 새 검증기를 만들지 말고 그 경로를 재사용한다.

## 하니스 배선 — 강제 지점 4곳

### ① 결정적 선적용 (AI 전에)

포스터 클릭 시 `applyGenrePreset(project, packId)` 를 먼저 커밋한다. 지금은 호출조차 안 된다.
`editorWelcome.ts:229` `startPreset` 이 `EditorWelcomeResult.systemPresetPlan` 을 이미 운반할 수
있으므로 필드를 새로 만들 필요가 없다. `mode.ts:186` 의 `replaceWithBlank: false` 하드코딩과
`welcomeGenrePresets.ts:51` 의 `"이미 blank로 교체된 상태"` 문장 중 하나는 반드시 거짓이므로 —
결정적 적용을 넣는 이 단계에서 둘을 일치시킨다.

### ② spec sheet → WorkPlan 파생 (플래너를 신뢰하지 않는다)

`buildWorkPlanFromGenreSpec(packId): WorkPlan` 를 `src/ai/workPlan.ts` 에 추가한다.
`buildDefaultWorkPlan`(`workPlan.ts:775`)이 이미 코드가 `workPlanFromOrchestratorDecision` 으로
계획을 세우는 선례다. 매핑은 기계적이다.

```
requirement.instruction    → item.instruction
requirement.acceptance     → item.doneWhen
requirement.authoringTools → item.successTools
레이어(L1..L4)             → plan.layers
```

프리셋 경로는 오케스트레이터 플래너를 **건너뛰고** 이 계획을 심는다. 모델이 계획을 안 세워서
`shouldAutoContinue` 가 첫 턴에 false 를 반환하는 현재 경로(`assistantSession.ts:1082`
`if (!this.workPlan || isWorkPlanComplete(this.workPlan)) return false;`)가 이걸로 닫힌다.

### ③ 항목 완료 게이트 = spec 술어

`advanceWorkPlanFromTools` 의 `WorkItemOutcomeGate` 에 spec 조항 술어를 꽂는다.

```ts
const gate: WorkItemOutcomeGate = (item) => {
  const kind = specKindForItem(item);
  if (!kind) return { ok: true };
  return requirementConfigured(store.getCurrent(), kind)
    ? { ok: true }
    : { ok: false, reason: `수락 미충족: ${item.doneWhen}` };
};
```

`workItemOutcome.ts` 가 `verifyCreatedMapsAuthored` 로 "맵이 만들어졌지만 비어 있음"을 잡는 것과
정확히 같은 형태다. 이게 들어가면 `define_monster_species` 를 호출했지만 종이 0개인 상태로
항목이 done 되는 경로가 막힌다.

### ④ 런 종료 수락 게이트

`maybeRunEndProof` 앞에 `evaluateGenrePackConfiguration(project, packId)` 를 세운다.
`configured === false` 면 미충족 조항 목록을 시스템 메시지로 되돌리고 자율 런을 계속한다 —
예산(48턴)이 남아 있는 한 모델은 미충족 조항을 다시 잡는다. 예산 소진 시 감사에
`genre_spec_unmet` + 조항 id 목록을 남기고 멈춘다. `evaluateGenrePackPlayableReadiness` 의
fail-closed 계약(`playable: false` 고정)은 그대로 둔다. spec 충족은 `configured` 이지
`playable` 이 아니다.

## 프롬프트에서 지울 문장

`WELCOME_GENRE_CHECKLIST_LINES`(`welcomeGenrePresets.ts:51-58`) 중 자율 런과 모순되는 2줄:

- 7번 `"모든 쓰기는 제안(changeset)으로만 제시하고, 사용자 승인 전에는 커밋하지 않는다."`
- 8번 `"작업이 끝나면 사용자에게 제안 승인/거부를 요청하는 문장으로 마친다."`

자율 런에는 승인 카드가 없다(`assistantSession.ts:1563-1567` 주석: "승인 카드를 없앴으므로
보류는 사용자가 풀 수 없는 교착이 된다"). 존재하지 않는 게이트를 기다리라는 지시는 모델을
"설명하고 끝내기"로 유도한다. 체크리스트 1~6번은 spec sheet 로 대체되므로 프롬프트는 톤 문장과
목표 한 줄만 남는다.

## 비목표

- **도감·요약·PC 박스·센터 UI 는 이 스펙의 범위가 아니다.** AI 툴 225개는 전부 `Project`
  데이터를 쓰는 툴이고 런타임 UI 코드를 만드는 툴은 없다. 48턴을 다 써도 도감 화면은 생기지
  않는다. `welcomeGenrePresets.ts:67` 의 blurb `"수집 · 조우 · 도감"` 은 그 화면이 생길 때까지
  약속을 줄이는 편이 정직하다.
- 새 하니스, 새 에이전트 루프, 새 검증 프레임워크. 위 4개 배선은 모두 기존 함수에 인자를 꽂는
  수준이다.
- `system.genre` 분기를 플레이어/런타임에 넣는 일. `openwiki/editor-genre-packs.md` 가 금지한다.

## 검증 계획

| 대상 | 검증 |
|---|---|
| spec sheet 무결성 | 조항의 `authoringTools` 가 전부 실존 툴인지 레지스트리 대조 (단위 테스트, 픽스처 아님) |
| kind 스위치 exhaustive | 기존 컴파일 타임 가드 유지 (`genrePacks.ts` 말미 `GENRE_PACK_IDS.forEach`) |
| WorkPlan 파생 | `buildWorkPlanFromGenreSpec("monster-collect")` → 레이어 4개, 항목별 `successTools` 비어 있지 않음 |
| 완료 게이트 | 종 0개 상태에서 `define_monster_species` 성공 신호만 준 뒤 항목이 done 되지 않음을 단정 |
| 런 종료 게이트 | 조항 1개를 일부러 비운 프로젝트로 `configured === false` + 감사에 `genre_spec_unmet` |
| 결정적 선적용 | 포스터 클릭 후 AI 0턴 상태에서 `system.monsterCollection === true` |
| 저장 | 콘텐츠를 저작하므로 Supabase 저장 후 재로드 검증 필수 (`AGENTS.md` hard rule). project id 를 완료 보고에 남긴다 |

비결정성 금지: 자율 런 테스트는 고정 대기(sleep/polling)를 쓰지 않고 세션 이벤트
(`milestone_applied`, `status`)를 구독해 기다린다.

## 실행 순서

1. `GenrePackRequirement` 확장 + monster-collect 조항 작성 + 신규 `kind` 술어 (코드만, DB 무관)
2. 프리셋 클릭의 결정적 선적용 (배선 ①) + 프롬프트 모순 2줄 제거
3. `buildWorkPlanFromGenreSpec` + 플래너 우회 (배선 ②)
4. 완료 게이트 (배선 ③) → 런 종료 게이트 (배선 ④)
5. `openwiki/editor-genre-packs.md` 갱신 (spec sheet 계약 + 4개 강제 지점).
   `openwiki/editor-ai-panel.md` 는 자율 런에 승인 카드가 없다는 사실과 프리셋 경로가 그
   경로를 탄다는 점을 명시한다.

1~2 단계만으로도 "클릭했는데 하나도 안 된다"는 사라진다 (토글이 결정적으로 들어가고, 모델이
쓰기를 금지당하지 않는다). 3~4 단계가 장기작업 강제의 본체다.
