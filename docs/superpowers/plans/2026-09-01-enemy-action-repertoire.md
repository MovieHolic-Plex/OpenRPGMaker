# 적 행동 레퍼토리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본 DB 의 적 106마리에게 계열별 행동 레퍼토리를 주어, 이미 작동하는 효용도 AI·상태이상·속성 저항이 실제 전투에서 발화하게 한다.

**Architecture:** 새 엔진 코드는 없다. (1) 적 전용 속성 공격 스킬 6종을 기존 `skill()` 헬퍼로 추가하고, (2) `roleParameterCurves(role)` 관용구를 따라 `archetypeActions(archetype)` 헬퍼를 만들어 각 적 레코드의 `actions` 배열에 부여한다. 행동 선택은 이미 있는 효용도 AI 가 한다.

**Tech Stack:** TypeScript, vitest, tsx. 기존 헬퍼 `skill()` / `supportSkill()` / `normalizeEnemyRecord()`.

**Spec:** `docs/superpowers/specs/2026-09-01-enemy-action-repertoire-design.md`

## Global Constraints

- **적 행동 조건은 `{kind:"always"}` 와 `{kind:"turn", start, interval}` 뿐이다.** HP 조건은 스키마에 없다. 상황 판단은 효용도 AI 에 맡긴다.
- **적 `maxMp` 는 전원 10.** 보스 계열 10마리만 40 으로 올린다. 4MP 특수기는 MP10 으로 2회뿐이다.
- **무료 스킬**(mpCost 0): `skill_attack`(위력10) `skill_sword_slash`(22) `skill_throwing_knife`(18) `skill_poison_sting`(8, 독85%). 모든 적은 무료 기본기를 최소 1개 가진다 — MP 고갈 시 행동 불능을 막는다.
- **신규 스킬은 플레이어 직업에 배정하지 않는다.** `classRecords` 의 `skillIds` 를 건드리지 않는다.
- 레코드 필드명은 `mpCost`(× `cost`), 적 행동 배열은 `actions`(× `actionPatterns`).
- 회귀 판정은 실패 **집합** 비교다. 이 저장소는 공유 머신에서 돌아 실패 **수**가 흔들린다.

---

### Task 1: 변경 전 기준선 스냅샷

전/후 비교의 "전"을 먼저 고정한다. 변경 후에 재면 비교 대상이 사라진다.

**Files:**
- Create: `scripts/qa/battle-depth-baseline.mts`
- Create: `verify-shots/battle-depth/baseline.json` (산출물, 커밋함)

**Interfaces:**
- Produces: `verify-shots/battle-depth/baseline.json` — Task 6 이 같은 스크립트를 다시 돌려 비교한다.

- [ ] **Step 1: 계측 스크립트를 쓴다**

```ts
// scripts/qa/battle-depth-baseline.mts
// 기본 트룹의 전투 깊이를 수치로 고정한다. 변경 전/후를 같은 seed 로 비교하기 위한 것.
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateBattle } from "@/battle/simulate";
import { defaultDatabase, defaultSystem, defaultSession } from "@/project/defaults/defaultDatabase";
import type { Project } from "@/project/types";

const project = { database: defaultDatabase(), system: defaultSystem(), session: defaultSession(), maps: {} } as unknown as Project;
const db = project.database as any;

const out: Record<string, unknown> = {};
out.enemyActionCounts = Object.fromEntries(
  db.enemies.map((e: any) => [e.id, (e.actions ?? []).length]),
);
out.enemiesWithOneAction = db.enemies.filter((e: any) => (e.actions ?? []).length <= 1).length;
out.enemyMaxMp = Object.fromEntries(db.enemies.map((e: any) => [e.id, e.stats?.maxMp ?? 0]));
out.skillIds = db.skills.map((s: any) => s.id);

out.sims = {};
for (const troop of db.troops) {
  (out.sims as any)[troop.id] = simulateBattle({
    project, troopId: troop.id, heroLevel: 5, n: 50, seed: 12345,
  });
}
mkdirSync("verify-shots/battle-depth", { recursive: true });
writeFileSync("verify-shots/battle-depth/baseline.json", JSON.stringify(out, null, 2));
console.log("적 행동 1개뿐:", out.enemiesWithOneAction, "/", db.enemies.length);
for (const [id, r] of Object.entries(out.sims as any)) {
  console.log(`  ${id.padEnd(22)}`, JSON.stringify(r));
}
```

- [ ] **Step 2: 돌려서 실제 수치를 본다**

Run: `npx tsx scripts/qa/battle-depth-baseline.mts`
Expected: `적 행동 1개뿐: 106 / 106` 이 찍히고 트룹 7개의 시뮬 결과가 출력된다.

`simulateBattle` 의 반환 필드명이 예상과 다르면 출력 그대로 기록하면 된다 — 이 스크립트는 비교용이라 필드명을 몰라도 된다.

- [ ] **Step 3: 커밋**

`verify-shots/runtime-qa/` 만 gitignore 대상이므로 `verify-shots/battle-depth/` 는 커밋된다(의도한 것 — 기준선은 증거다).

```bash
git add scripts/qa/battle-depth-baseline.mts verify-shots/battle-depth/baseline.json
git commit -m "test(battle): 적 행동 레퍼토리 변경 전 기준선을 고정한다"
```

---

### Task 2: 적 전용 속성 공격 스킬 6종

**Files:**
- Modify: `src/project/defaults/defaultDatabaseStarterRecords.ts` (54행 `skill_water` 다음)
- Test: `test/enemyElementalSkills.test.ts`

**Interfaces:**
- Produces: 스킬 id `skill_ice` `skill_thunder` `skill_earth` `skill_wind` `skill_dark` `skill_holy`. Task 3·4 가 `actions[].skillId` 로 참조한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// test/enemyElementalSkills.test.ts
// 적이 8속성 전부로 공격할 수 있어야 적마다 저작된 11개 속성 저항이 의미를 갖는다.
// 기존에는 fire/water/grass 3종뿐이었고 나머지는 "뇌전석 효과" 같은 아이템 효과
// 스킬로만 존재해 적 기술 이름으로 쓰면 어색했다.
import { describe, expect, it } from "vitest";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";

describe("적 속성 공격 스킬", () => {
  it("8속성 각각에 아이템 효과가 아닌 공격 스킬이 있다", () => {
    const skills = (defaultDatabase() as any).skills as any[];
    const combat = skills.filter((s) => !String(s.id).startsWith("skill_item_"));
    for (const element of ["fire", "ice", "thunder", "water", "earth", "wind", "dark", "holy"]) {
      const match = combat.filter((s) => s.elementId === element && s.scope === "enemy" && (s.power ?? 0) > 0);
      expect(match.length, `${element} 속성 공격 스킬이 없다`).toBeGreaterThan(0);
    }
  });

  it("신규 6종은 MP 4 이고 적 MP(10)로 2회 쓸 수 있다", () => {
    const skills = (defaultDatabase() as any).skills as any[];
    for (const id of ["skill_ice", "skill_thunder", "skill_earth", "skill_wind", "skill_dark", "skill_holy"]) {
      const s = skills.find((x) => x.id === id);
      expect(s, `${id} 없음`).toBeDefined();
      expect(s.mpCost.flat).toBe(4);
      expect(s.scope).toBe("enemy");
    }
  });

  it("신규 6종은 플레이어 직업에 배정되지 않는다", () => {
    const db = defaultDatabase() as any;
    const assigned = new Set(db.classes.flatMap((c: any) => c.skillIds ?? []));
    for (const id of ["skill_ice", "skill_thunder", "skill_earth", "skill_wind", "skill_dark", "skill_holy"]) {
      expect(assigned.has(id), `${id} 가 직업에 배정됐다`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/enemyElementalSkills.test.ts`
Expected: FAIL — `ice 속성 공격 스킬이 없다`, `skill_ice 없음`

- [ ] **Step 3: 스킬 6종을 추가한다**

`defaultDatabaseStarterRecords.ts` 의 `skill("skill_water", …)` 줄(54행) 바로 다음에 넣는다. 위력은 기존 `skill_fire`(30) / `skill_water`(28) 와 같은 대역으로 맞춘다.

```ts
    // 적 전용 속성 공격. 적마다 11개씩 저작된 속성 저항은 적이 속성 공격을 해야만
    // 의미를 갖는데, 기존에는 fire/water/grass 3종뿐이라 나머지 저항이 전부 사문이었다.
    // 아이템 효과 스킬(skill_item_thunder_stone = "뇌전석 효과")을 적 기술로 재사용하면
    // 드래곤의 기술 이름이 "뇌전석 효과"로 뜬다. 그래서 별도 레코드를 둔다.
    skill("skill_ice", "빙결", "enemy", 30, "anim_gen_ice_shatter", "얼음 속성으로 적을 얼립니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "ice" }),
    skill("skill_thunder", "낙뢰", "enemy", 30, "anim_gen_thunder_strike", "번개 속성으로 적을 내리칩니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "thunder" }),
    skill("skill_earth", "암석 파쇄", "enemy", 30, "anim_gen_earth_spike", "대지 속성으로 적을 짓누릅니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "earth" }),
    skill("skill_wind", "질풍참", "enemy", 28, "anim_gen_wind_slice", "바람 속성으로 적을 베어냅니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "wind" }),
    skill("skill_dark", "암흑 파동", "enemy", 30, "anim_gen_shadow_pulse", "어둠 속성으로 적을 침식합니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "dark" }),
    skill("skill_holy", "성광", "enemy", 30, "anim_gen_holy_beam", "신성 속성으로 적을 정화합니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "holy" }),
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run test/enemyElementalSkills.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/project/defaults/defaultDatabaseStarterRecords.ts test/enemyElementalSkills.test.ts
git commit -m "feat(battle): 적 전용 속성 공격 스킬 6종을 추가한다"
```

---

### Task 3: `archetypeActions()` 헬퍼 + 스타터 적 6마리

기본 트룹 7개가 실제로 쓰는 적은 스타터 6마리다. 데모에서 바로 보이므로 먼저 한다.

**Files:**
- Create: `src/project/defaults/enemyActionArchetypes.ts`
- Modify: `src/project/defaults/defaultDatabaseStarterRecords.ts` (적 6마리의 `actions`)
- Test: `test/enemyActionArchetypes.test.ts`

**Interfaces:**
- Consumes: Task 2 의 스킬 id 6종
- Produces:
  - `export type EnemyArchetype = "blob" | "venom" | "brute" | "curse" | "caster" | "bulwark" | "tactician" | "flyer" | "boss"`
  - `export function archetypeActions(archetype: EnemyArchetype, elementSkillId?: string): EnemyActionPattern[]`
  - `export const SPIRIT_ELEMENT_SKILLS: Record<string, string>` — 정령 개체 id → 속성 스킬 id
  - Task 4 가 두 심볼을 모두 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// test/enemyActionArchetypes.test.ts
import { describe, expect, it } from "vitest";
import { archetypeActions, SPIRIT_ELEMENT_SKILLS } from "@/project/defaults/enemyActionArchetypes";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";

const FREE_SKILLS = new Set(["skill_attack", "skill_sword_slash", "skill_throwing_knife", "skill_poison_sting"]);

describe("archetypeActions", () => {
  const archetypes = ["blob", "venom", "brute", "curse", "caster", "bulwark", "tactician", "flyer", "boss"] as const;

  it("모든 아키타입이 행동을 2개 이상 준다 — 1개면 효용도 AI 가 선택할 게 없다", () => {
    for (const a of archetypes) {
      expect(archetypeActions(a, "skill_fire").length, a).toBeGreaterThanOrEqual(2);
    }
  });

  it("모든 아키타입이 MP 0 스킬을 최소 1개 갖는다 — MP 고갈 시 행동 불능을 막는다", () => {
    for (const a of archetypes) {
      const ids = archetypeActions(a, "skill_fire").map((p) => p.skillId);
      expect(ids.some((id) => FREE_SKILLS.has(id)), `${a}: ${ids.join(",")}`).toBe(true);
    }
  });

  it("참조하는 스킬이 전부 실재한다", () => {
    const known = new Set(((defaultDatabase() as any).skills as any[]).map((s) => s.id));
    for (const a of archetypes) {
      for (const p of archetypeActions(a, "skill_fire")) {
        expect(known.has(p.skillId), `${a} → ${p.skillId} 없음`).toBe(true);
      }
    }
    for (const skillId of Object.values(SPIRIT_ELEMENT_SKILLS)) {
      expect(known.has(skillId), `${skillId} 없음`).toBe(true);
    }
  });

  it("boss 만 turn 조건 패턴을 갖는다", () => {
    for (const a of archetypes) {
      const hasTurn = archetypeActions(a, "skill_fire").some((p) => p.condition.kind === "turn");
      expect(hasTurn, a).toBe(a === "boss");
    }
  });
});

describe("스타터 적", () => {
  it("기본 트룹이 쓰는 적이 전부 행동 2개 이상을 갖는다", () => {
    const db = defaultDatabase() as any;
    const used = new Set(db.troops.flatMap((t: any) => (t.members ?? []).map((m: any) => m.enemyId)));
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) {
      const enemy = db.enemies.find((e: any) => e.id === id);
      expect(enemy, `${id} 없음`).toBeDefined();
      expect((enemy.actions ?? []).length, `${id} 행동 부족`).toBeGreaterThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/enemyActionArchetypes.test.ts`
Expected: FAIL — 모듈 `enemyActionArchetypes` 를 찾을 수 없다

- [ ] **Step 3: 헬퍼를 만든다**

```ts
// src/project/defaults/enemyActionArchetypes.ts
// 계열별 적 행동 레퍼토리.
//
// 왜 필요한가: 기본 DB 의 적 106마리가 전부 동일한 단 하나의 패턴
// (skill_attack / always)만 가져서, 이미 작동하는 세 시스템이 발화하지 못했다 —
// 효용도 AI(선택지 1개), 상태이상 12종(적이 걸 수단 없음), 속성 저항(적 공격이 무속성).
//
// 왜 조건이 아니라 효용도에 맡기는가: EnemyActionCondition 은 `always` 와 `turn` 뿐이라
// "HP 50% 아래면 강타" 를 저작할 수 없다. 대신 `always` 패턴을 여러 개 주면, 이미
// 대상 HP 비율·킬샷 가능 여부·회복 필요를 실시간으로 읽는 효용도 AI
// (runtime.ts chooseEnemyAction)가 상황에 맞게 고른다.
//
// MP 예산: 적 maxMp 는 보스를 뺀 전원이 10 이다. 4MP 특수기는 2회뿐이므로 모든
// 아키타입에 MP 0 스킬을 최소 1개 넣어 고갈 시 행동 불능을 막는다.
import type { EnemyActionPattern } from "../types/database";

export type EnemyArchetype =
  | "blob" | "venom" | "brute" | "curse" | "caster"
  | "bulwark" | "tactician" | "flyer" | "boss";

function always(skillId: string, priority: number): EnemyActionPattern {
  return {
    skillId: skillId as EnemyActionPattern["skillId"],
    priority,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

function everyNthTurn(skillId: string, priority: number, interval: number): EnemyActionPattern {
  return {
    skillId: skillId as EnemyActionPattern["skillId"],
    priority,
    condition: { kind: "turn", start: interval, interval },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

/** 정령·원소 계열은 개체마다 속성이 다르다. 저항 프로필에서 추론하지 않는다 —
 *  저항은 "무엇에 강한가" 이지 "무엇을 쓰는가" 가 아니다. 명시적으로 적는다. */
export const SPIRIT_ELEMENT_SKILLS: Record<string, string> = {
  enemy_spirit_fire: "skill_fire",
  enemy_spirit_water: "skill_water",
  enemy_spirit_earth: "skill_earth",
  enemy_spirit_wind: "skill_wind",
  enemy_spirit_light: "skill_holy",
  enemy_spirit_dark: "skill_dark",
  enemy_wisp_blue: "skill_ice",
  enemy_sylph_air: "skill_wind",
  enemy_undine_sea: "skill_water",
  enemy_salamander_flame: "skill_fire",
};

/**
 * @param elementSkillId `caster`/`curse`/`bulwark`/`boss` 가 쓸 속성 공격 스킬.
 *   생략하면 무속성 `skill_arcane_bolt` 로 폴백한다.
 */
export function archetypeActions(archetype: EnemyArchetype, elementSkillId?: string): EnemyActionPattern[] {
  const elemental = elementSkillId ?? "skill_arcane_bolt";
  switch (archetype) {
    case "blob":
      return [always("skill_attack", 5), always("skill_poison_sting", 4)];
    case "venom":
      return [always("skill_attack", 5), always("skill_poison_sting", 5), always("skill_weaken", 3)];
    case "brute":
      return [always("skill_attack", 5), always("skill_sword_slash", 5), always("skill_focus", 3)];
    case "curse":
      return [always("skill_attack", 5), always("skill_dark", 4), always("skill_weaken", 3)];
    case "caster":
      return [always("skill_attack", 4), always(elemental, 6)];
    case "bulwark":
      return [always("skill_attack", 5), always("skill_earth", 4), always("skill_focus", 3)];
    case "tactician":
      return [always("skill_attack", 5), always("skill_sword_slash", 4), always("skill_weaken", 3), always("skill_heal", 4)];
    case "flyer":
      return [always("skill_attack", 5), always("skill_throwing_knife", 4), always("skill_sleep_mist", 3)];
    case "boss":
      // 보스는 maxMp 40 이라 특수기를 전투 내내 유지한다. turn 조건은 보스 전용이다.
      return [
        always("skill_attack", 4),
        always("skill_sword_slash", 5),
        always(elemental, 5),
        everyNthTurn(elemental, 9, 3),
      ];
  }
}
```

- [ ] **Step 4: 스타터 적 6마리에 적용한다**

`defaultDatabaseStarterRecords.ts` 에서 적 6마리의 `actions` 를 교체한다. 계열 배정:

| 적 | 아키타입 | 이유 |
|---|---|---|
| `enemy_slime` | `blob` | 슬라임 |
| `enemy_meadow_slime` | `blob` | 슬라임 |
| `enemy_cave_bat` | `flyer` | 비행 |
| `enemy_stone_golem` | `bulwark` | 구조물 |
| `enemy_mine_skel_archer` | `curse` | 언데드 |
| `enemy_dragon` | `boss` | 보스 (`elementSkillId: "skill_fire"` — 붉은 드래곤) |

각 레코드의 `actions: [...]` 를 `actions: archetypeActions("blob")` 형태로 바꾸고, 파일 상단에 import 를 추가한다:

```ts
import { archetypeActions } from "./enemyActionArchetypes";
```

`enemy_dragon` 만 `archetypeActions("boss", "skill_fire")` 이다.

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run test/enemyActionArchetypes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/project/defaults/enemyActionArchetypes.ts src/project/defaults/defaultDatabaseStarterRecords.ts test/enemyActionArchetypes.test.ts
git commit -m "feat(battle): 계열별 행동 레퍼토리 헬퍼와 스타터 적 6마리를 붙인다"
```

---

### Task 4: 생성된 적 100마리에 계열별 부여

**Files:**
- Modify: `src/project/defaults/generatedEnemyRecords.ts`
- Test: `test/enemyActionArchetypes.test.ts` (테스트 추가)

**Interfaces:**
- Consumes: Task 3 의 `archetypeActions()`, `SPIRIT_ELEMENT_SKILLS`

계열은 파일에 이미 주석으로 구획돼 있다. 구획별 아키타입:

| 파일 내 구획 | 마리 | 아키타입 |
|---|---|---|
| 슬라임·젤리 | 8 | `blob` |
| 곤충·절지 | 12 | `venom` |
| 야수 | 14 | `brute` |
| 언데드 | 12 | `curse` |
| 정령·원소 | 10 | `caster` (+ `SPIRIT_ELEMENT_SKILLS[id]`) |
| 골렘·구조물 | 10 | `bulwark` |
| 인간형 | 15 | `tactician` |
| 수생·비행 | 9 | `flyer` |
| 드래곤·보스 | 10 | `boss` |

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`test/enemyActionArchetypes.test.ts` 끝에 붙인다.

```ts
describe("적 전원", () => {
  it("행동이 1개뿐인 적이 없다", () => {
    const db = defaultDatabase() as any;
    const shallow = db.enemies.filter((e: any) => (e.actions ?? []).length <= 1).map((e: any) => e.id);
    expect(shallow, `행동 1개뿐: ${shallow.join(", ")}`).toEqual([]);
  });

  it("정령 10마리가 서로 다른 속성 공격을 쓴다 — 속성 저항이 의미를 가지려면", () => {
    const db = defaultDatabase() as any;
    const spiritIds = Object.keys(SPIRIT_ELEMENT_SKILLS);
    const used = new Set<string>();
    for (const id of spiritIds) {
      const enemy = db.enemies.find((e: any) => e.id === id);
      expect(enemy, `${id} 없음`).toBeDefined();
      for (const p of enemy.actions) {
        const skill = db.skills.find((s: any) => s.id === p.skillId);
        if (skill?.elementId) used.add(skill.elementId);
      }
    }
    // 불·물·대지·바람·신성·암흑·얼음 = 7종 이상이 정령 계열에서 실제로 쓰인다.
    expect(used.size, `쓰인 속성: ${[...used].join(",")}`).toBeGreaterThanOrEqual(7);
  });

  it("모든 적이 MP 0 스킬을 최소 1개 갖는다", () => {
    const db = defaultDatabase() as any;
    const free = new Set(db.skills.filter((s: any) => (s.mpCost?.flat ?? 0) === 0).map((s: any) => s.id));
    const stuck = db.enemies
      .filter((e: any) => !(e.actions ?? []).some((p: any) => free.has(p.skillId)))
      .map((e: any) => e.id);
    expect(stuck, `MP 고갈 시 행동 불능: ${stuck.join(", ")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/enemyActionArchetypes.test.ts`
Expected: FAIL — `행동 1개뿐: enemy_slime_blue, enemy_slime_red, …` (100마리)

- [ ] **Step 3: 100마리의 `actions` 를 교체한다**

`generatedEnemyRecords.ts` 상단에 import 를 추가한다:

```ts
import { archetypeActions, SPIRIT_ELEMENT_SKILLS } from "./enemyActionArchetypes";
```

각 레코드의 인라인 `"actions":[{"skillId":"skill_attack","priority":5,"condition":{"kind":"always"}}]` 를 지우고, 구획별로 `actions` 를 넘긴다. 인라인 JSON 안에 함수 호출을 넣을 수 없으므로 스프레드로 바꾼다:

```ts
      // 슬라임·젤리
      normalizeEnemyRecord({ ...{"id":"enemy_slime_blue","name":"푸른 슬라임", /* …기존 필드 그대로… */ }, actions: archetypeActions("blob") }),
```

정령 10마리만 개체 속성을 넘긴다:

```ts
      normalizeEnemyRecord({ ...{"id":"enemy_spirit_fire", /* … */ }, actions: archetypeActions("caster", SPIRIT_ELEMENT_SKILLS.enemy_spirit_fire) }),
```

기계적 반복이므로, 원본 JSON 에서 `"actions":[…]` 만 제거하고 뒤에 `, actions: archetypeActions(…)` 를 붙이는 편집이다. 스탯·보상·리소스 id 는 **한 글자도 바꾸지 않는다.**

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run test/enemyActionArchetypes.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 스탯이 변하지 않았음을 확인한다**

Run: `npx tsx scripts/qa/battle-depth-baseline.mts` 는 아직 돌리지 말 것(Task 6). 대신:

```bash
npx tsx -e '
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { readFileSync } from "node:fs";
const base = JSON.parse(readFileSync("verify-shots/battle-depth/baseline.json","utf8"));
const db:any = defaultDatabase();
const now = Object.fromEntries(db.enemies.map((e:any)=>[e.id, e.stats?.maxMp ?? 0]));
const diff = Object.keys(base.enemyMaxMp).filter(k => base.enemyMaxMp[k] !== now[k]);
console.log("maxMp 변경된 적:", diff.length ? diff.join(", ") : "없음");
'
```

Expected: `maxMp 변경된 적: 없음` (보스 MP 는 Task 5 에서 올린다)

- [ ] **Step 6: 커밋**

```bash
git add src/project/defaults/generatedEnemyRecords.ts test/enemyActionArchetypes.test.ts
git commit -m "feat(battle): 생성된 적 100마리에 계열별 행동 레퍼토리를 부여한다"
```

---

### Task 5: 보스 계열 `maxMp` 40

**Files:**
- Modify: `src/project/defaults/generatedEnemyRecords.ts` (드래곤·보스 구획 10마리)
- Modify: `src/project/defaults/defaultDatabaseStarterRecords.ts` (`enemy_dragon`)
- Test: `test/enemyActionArchetypes.test.ts` (테스트 추가)

- [ ] **Step 1: 실패하는 테스트를 추가한다**

```ts
describe("보스 MP 예산", () => {
  const BOSS_IDS = [
    "enemy_dragon", "enemy_dragon_whelp", "enemy_dragon_red", "enemy_dragon_blue",
    "enemy_dragon_bone", "enemy_hydra_three", "enemy_behemoth_horn", "enemy_demon_lord",
    "enemy_angel_fallen", "enemy_eye_floating", "enemy_plant_carnivore",
  ];

  it("보스는 4MP 특수기를 10회 쓸 수 있다", () => {
    const db = defaultDatabase() as any;
    for (const id of BOSS_IDS) {
      const e = db.enemies.find((x: any) => x.id === id);
      expect(e, `${id} 없음`).toBeDefined();
      expect(e.stats.maxMp, id).toBe(40);
    }
  });

  it("보스가 아닌 적의 maxMp 는 10 그대로다", () => {
    const db = defaultDatabase() as any;
    const boss = new Set(BOSS_IDS);
    const odd = db.enemies.filter((e: any) => !boss.has(e.id) && e.stats.maxMp !== 10).map((e: any) => e.id);
    expect(odd, `예상 밖 maxMp: ${odd.join(", ")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/enemyActionArchetypes.test.ts`
Expected: FAIL — `expected 10 to be 40`

- [ ] **Step 3: 보스 11마리의 `maxMp` 를 40 으로 바꾼다**

드래곤·보스 구획 10마리 + 스타터의 `enemy_dragon`. 각 레코드 `"stats":{…,"maxMp":10,…}` 를 `"maxMp":40` 으로. **다른 스탯은 건드리지 않는다.**

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run test/enemyActionArchetypes.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/project/defaults/generatedEnemyRecords.ts src/project/defaults/defaultDatabaseStarterRecords.ts test/enemyActionArchetypes.test.ts
git commit -m "feat(battle): 보스 계열 maxMp 를 40 으로 올려 특수기를 유지시킨다"
```

---

### Task 6: 통합 검증 — 시뮬 전/후 비교와 런타임 증명

**Files:**
- Create: `verify-shots/battle-depth/after.json`
- Modify: (필요 시) `src/project/defaults/enemyActionArchetypes.ts` — 밸런스가 무너진 아키타입만

- [ ] **Step 1: 변경 후 수치를 낸다**

```bash
npx tsx scripts/qa/battle-depth-baseline.mts
mv verify-shots/battle-depth/baseline.json verify-shots/battle-depth/after.json
git show HEAD~4:verify-shots/battle-depth/baseline.json > verify-shots/battle-depth/baseline.json
```

`HEAD~4` 가 Task 1 커밋이 아니면 `git log --oneline` 으로 확인해 해당 SHA 를 쓴다.

- [ ] **Step 2: 전/후를 비교한다**

```bash
npx tsx -e '
import { readFileSync } from "node:fs";
const b = JSON.parse(readFileSync("verify-shots/battle-depth/baseline.json","utf8"));
const a = JSON.parse(readFileSync("verify-shots/battle-depth/after.json","utf8"));
console.log("행동 1개뿐:", b.enemiesWithOneAction, "→", a.enemiesWithOneAction);
for (const id of Object.keys(b.sims)) {
  console.log(`\n${id}`);
  console.log("  before", JSON.stringify(b.sims[id]));
  console.log("  after ", JSON.stringify(a.sims[id]));
}'
```

판정 기준:
- `행동 1개뿐: 106 → 0`
- 트룹 7개 **어느 것도 승률이 0% 로 무너지지 않는다.** 무너진 트룹이 있으면 해당 아키타입의 상태이상 스킬 `priority` 를 낮추고 Step 1 부터 다시 한다.
- 평균 타수가 증가한다(전투에 길이가 생겼다는 뜻)

- [ ] **Step 3: 런타임에서 실제로 보이는지 증명한다**

DOM 에만 있고 화면에 없던 사례를 이미 겪었다. 실제 화면을 본다.

Run: `TROOP=troop_dragon STEPS=12 node scripts/qa/probe-battle-walkthrough.mjs`

Expected: 로그에 적이 `skill_attack` 외의 기술을 쓴 메시지가 나오고, `verify-shots/runtime-qa/battle-walk/default-troop_dragon/` 스크린샷에 상태이상 아이콘 또는 속성 피해가 보인다.

- [ ] **Step 4: 전체 회귀를 기준선 집합과 비교한다**

```bash
npx vitest run --reporter=json --outputFile=/tmp/after-repertoire.json > /dev/null 2>&1
node -e '
const base=require("/tmp/baseline-vitest.json"), after=require("/tmp/after-repertoire.json");
const set=r=>new Set(r.testResults.filter(t=>t.status!=="passed").map(t=>t.name.split("/").pop()));
const b=set(base), a=set(after);
console.log("신규 회귀:", [...a].filter(x=>!b.has(x)));
console.log("해소됨:", [...b].filter(x=>!a.has(x)));'
```

`/tmp/baseline-vitest.json` 이 없으면 이 브랜치의 첫 커밋 이전 상태에서 한 번 더 떠야 한다. 판정은 실패 **집합**이다(수가 아니다 — 공유 머신이라 흔들린다).

Expected: `신규 회귀: []`

- [ ] **Step 5: 커밋**

```bash
git add verify-shots/battle-depth/after.json
git commit -m "test(battle): 행동 레퍼토리 전/후 시뮬 수치를 기록한다"
```

---

## Self-Review

**스펙 커버리지**

| 스펙 요구 | 태스크 |
|---|---|
| 적 전용 속성 공격 6종 | Task 2 |
| 계열별 레퍼토리 (`archetypeActions`) | Task 3 (헬퍼+스타터), Task 4 (100마리) |
| 정령 개체 → 속성 명시적 표 | Task 3 `SPIRIT_ELEMENT_SKILLS` |
| 보스 `maxMp` 40 | Task 5 |
| `simulate_battle` 전/후 비교 | Task 1(전) + Task 6(후) |
| 런타임 화면 증명 | Task 6 Step 3 |
| 실패 **집합** 회귀 비교 | Task 6 Step 4 |
| 비목표(직업 곡선·속성·상태 정의 불변) | Task 4 Step 5 가 스탯 불변을 확인, Task 2 테스트가 직업 미배정을 확인 |

**타입 일관성:** `archetypeActions(archetype, elementSkillId?)` 시그니처가 Task 3 정의와 Task 4 호출에서 일치. `SPIRIT_ELEMENT_SKILLS` 는 `Record<string, string>` 으로 Task 3 정의, Task 4 에서 인덱싱. `EnemyActionPattern` 은 `src/project/types/database.ts:536` 의 기존 타입.

**남은 리스크:** Task 4 는 100개 레코드의 기계적 편집이라 손이 미끄러지기 쉽다. Task 4 Step 5 의 스탯 불변 확인이 그 안전망이다.
