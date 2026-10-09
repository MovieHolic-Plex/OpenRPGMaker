import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classicEnemyFormation, enemyBattlers } from "@/battle/battleBattlers";
import { monsterSpeciesReferenceMessage } from "@/editor/databaseReferences";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { kindOfBattleEventCondition } from "@/editor/panels/databaseTroopBattleEventConditions";
import { updateTroopBattleEventPage } from "@/editor/panels/databaseTroopBattleEventActions";
import { createBlankProject } from "@/project/defaults";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { monsterEvolutionCycleSpeciesIds, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { store } from "@/project/store";
import type { MonsterSpeciesRecord, TroopRecord } from "@/project/types";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function species(patch: Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">): MonsterSpeciesRecord {
  return normalizeMonsterSpeciesRecord(patch);
}

function firstEnemyForm(): { form: FakeElement; enemyId: string } {
  const enemy = store.getCurrent().database.enemies[0];
  if (!enemy) throw new Error("enemy fixture missing");
  const form = new FakeElement("div");
  renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
  return { form, enemyId: enemy.id };
}

function setNumber(form: FakeElement, testid: string, value: string): FakeElement {
  const input = findByTestId(form, testid);
  if (!input) throw new Error(`missing field ${testid}`);
  input.value = value;
  input.dispatchEvent(new Event("input"));
  return input;
}

describe("F1 포획률 스케일 마이그레이션", () => {
  it("0~100 스케일로 저작된 값을 0~1로 이관하고 이미 0~1인 값은 그대로 둔다", () => {
    expect(species({ id: "a", name: "a", captureRate: 40 }).captureRate).toBe(0.4);
    expect(species({ id: "a", name: "a", captureRate: 0.4 }).captureRate).toBe(0.4);
  });

  it("출하 기본 종족이 1.0으로 뭉개지지 않는다", () => {
    const records = defaultBattleRecords().monsterSpecies ?? [];
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.captureRate).toBeLessThanOrEqual(1);
      expect(record.captureRate).toBeLessThan(1);
    }
  });
});

describe("F2 적 그룹 좌표", () => {
  it("에디터가 만든 좌표가 런타임에서 재배치되지 않는다", () => {
    const project = store.getCurrent();
    const enemyId = project.database.enemies[0]?.id;
    if (!enemyId) throw new Error("enemy fixture missing");
    const members = [0, 1, 2, 3].map((index) => ({ enemyId, ...classicEnemyFormation(index), hidden: false }));
    for (const member of members) expect(member.x).toBeLessThanOrEqual(150);
    const troop: TroopRecord = {
      ...project.database.troops[0]!,
      members,
      enemyIds: members.map((member) => member.enemyId),
    };
    const battlers = enemyBattlers(project, troop);
    battlers.forEach((battler, index) => {
      expect(battler.battleX).toBe(members[index]!.x);
      expect(battler.battleY).toBe(members[index]!.y);
    });
  });
});

describe("F3 전투 이벤트 조건 편집", () => {
  it("첫 조건을 편집해도 추가 조건이 살아 있다", () => {
    const troopId = store.getCurrent().database.troops[0]!.id;
    store.update((project) => {
      const troop = project.database.troops.find((entry) => entry.id === troopId)!;
      troop.battleEventPages = [
        {
          id: "page-1",
          name: "테스트",
          span: "battle",
          conditions: [
            { kind: "turn", start: 1, interval: 1 },
            { kind: "switch", switchId: "0001", value: true },
          ],
          commands: [],
        },
      ];
    });
    const troop = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!;
    const page = troop.battleEventPages[0]!;
    const stored = page.conditions;
    updateTroopBattleEventPage(troop, page, { conditions: [{ kind: "turn", start: 3, interval: 1 }, ...stored.slice(1)] });
    const after = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!.battleEventPages[0]!;
    expect(after.conditions).toHaveLength(2);
    expect(after.conditions[1]?.kind).toBe("switch");
  });

  it("전용 폼이 없는 조건 종류는 undefined 를 반환해 편집을 잠근다", () => {
    expect(kindOfBattleEventCondition({ kind: "selfSwitch", switchId: "A", value: true } as never)).toBeUndefined();
    expect(kindOfBattleEventCondition({ kind: "turn", start: 1, interval: 1 })).toBe("turn");
    expect(kindOfBattleEventCondition(undefined)).toBe("none");
  });
});

describe("F4/F6 적 숫자 필드", () => {
  it("레벨 입력이 화면값과 저장값 모두 99로 클램프된다", () => {
    const { form, enemyId } = firstEnemyForm();
    const input = setNumber(form, "db-field-enemy-level", "120");
    expect(input.value).toBe("99");
    expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemyId)?.level).toBe(99);
  });

  it("드롭률 입력이 화면에서 100으로 클램프된다", () => {
    const { form } = firstEnemyForm();
    expect(setNumber(form, "db-field-enemy-drop-rate", "500").value).toBe("100");
  });
});

describe("F9 공격 패턴 표", () => {
  it("행동이 0개면 유령 행 대신 빈 상태를 보여주고, 행 추가가 실제 행동을 만든다", () => {
    const enemy = store.getCurrent().database.enemies[0]!;
    store.update((project) => {
      const target = project.database.enemies.find((entry) => entry.id === enemy.id)!;
      target.actions = [];
    });
    const live = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)!;
    const form = new FakeElement("div");
    renderEnemyRecordForm(form as unknown as HTMLElement, live);
    expect(findByTestId(form, "db-enemy-actions-empty")).toBeTruthy();
    expect(findByTestId(form, "db-enemy-action-row-0")).toBeFalsy();
    findByTestId(form, "db-enemy-action-add")?.click();
    expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)?.actions).toHaveLength(1);
  });
});

describe("F5 진화 사이클", () => {
  it("A→B→A 를 사이클로 검출하고 검증 이슈를 낸다", () => {
    const a = species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] });
    const b = species({ id: "sp_b", name: "B", evolutions: [{ toSpeciesId: "sp_a", requires: { level: 9 } }] });
    expect(monsterEvolutionCycleSpeciesIds([a, b])).toEqual(["sp_a", "sp_b"]);
    store.update((project) => {
      project.database.monsterSpecies = [a, b];
    });
    const issues = collectProjectReferenceIssues(store.getCurrent());
    expect(issues.filter((issue) => issue.includes("사이클"))).toHaveLength(1);
  });
});

describe("F16 종족 삭제 가드", () => {
  it("giveMonster 명령이 참조하는 종족은 삭제 가드에 걸린다", () => {
    store.update((project) => {
      project.database.monsterSpecies = [species({ id: "sp_a", name: "A" })];
      project.commonEvents = [
        { id: "ce_1", name: "테스트", trigger: "none", commands: [{ kind: "giveMonster", speciesId: "sp_a", level: 5 }] } as never,
      ];
    });
    expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeUndefined();
    expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeNull();
  });

  it("다른 종족의 진화 대상이면 삭제 가드에 걸린다", () => {
    store.update((project) => {
      project.database.monsterSpecies = [
        species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] }),
        species({ id: "sp_b", name: "B" }),
      ];
    });
    expect(monsterSpeciesReferenceMessage("sp_b")).toContain("진화");
  });
});
