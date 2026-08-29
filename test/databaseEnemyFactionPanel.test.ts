import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

function restoreBrowserGlobal<Key extends keyof FakeBrowserGlobals>(key: Key, value: FakeBrowserGlobals[Key]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }
  Object.defineProperty(globalThis, key, { configurable: true, value });
}

function renderEnemyForm(): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  const enemy = firstEnemy();
  const rerender = (): void => {
    form.replaceChildren();
    renderEnemyRecordForm(form as unknown as HTMLElement, liveEnemy(enemy.id), rerender);
  };
  rerender();
  return form;
}

function firstEnemy(): EnemyRecord {
  const enemy = store.getCurrent().database.enemies[0];
  if (!enemy) throw new Error("missing default enemy");
  return enemy;
}

function liveEnemy(id: string): EnemyRecord {
  const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === id);
  if (!enemy) throw new Error(`missing enemy: ${id}`);
  return enemy;
}

function changeSelect(select: FakeElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

describe("enemy faction assignment panel", () => {
  it("shows the effective enemy faction for an empty sparse value", () => {
    const host = renderEnemyForm();
    const select = findByTestId(host, "db-picker-enemy-faction");
    const effective = findByTestId(host, "db-enemy-faction-effective");

    expect(select?.value).toBe("enemy");
    expect(effective?.dataset.effectiveFactionId).toBe("enemy");
    expect(effective?.textContent).toContain("미저장 · enemy로 전투");
    expect(findByTestId(host, "db-enemy-faction-default-clears")?.textContent).toContain("저장된 소속 진영 값이 삭제");
    expect(findByTestId(host, "db-enemy-faction-guide")?.textContent).toContain("[진영] 탭");
    expect(firstEnemy().factionId).toBeUndefined();
  });

  it("surfaces a dangling stored id without mutating it during render", () => {
    const project = createBlankProject();
    project.database.enemies[0]!.factionId = "deleted_guard";
    store.replace(project);
    const before = JSON.stringify(firstEnemy());

    const host = renderEnemyForm();
    const select = findByTestId(host, "db-picker-enemy-faction");
    const effective = findByTestId(host, "db-enemy-faction-effective");
    const missing = findByTestId(host, "db-enemy-faction-missing");

    expect(select?.value).toBe("deleted_guard");
    expect(select?.textContent).toContain("deleted_guard · 존재하지 않는 진영");
    expect(effective?.dataset.storedFactionId).toBe("deleted_guard");
    expect(effective?.dataset.effectiveFactionId).toBe("enemy");
    expect(effective?.textContent).toContain("존재하지 않는 진영deleted_guard저장됨 · enemy로 전투");
    expect(missing?.textContent).toContain("저장된 진영 ID 'deleted_guard'가 존재하지 않는 진영");
    expect(missing?.textContent).toContain("런타임에서는 enemy로 전투");
    expect(findByTestId(host, "db-enemy-hero")?.textContent).toContain("진영 deleted_guard (존재하지 않음 · enemy로 전투)");
    expect(JSON.stringify(firstEnemy())).toBe(before);
    expect(firstEnemy().factionId).toBe("deleted_guard");
  });

  it("repairs a dangling faction by clearing the stored value", () => {
    const project = createBlankProject();
    project.database.enemies[0]!.factionId = "deleted_guard";
    store.replace(project);
    const host = renderEnemyForm();

    findByTestId(host, "db-enemy-faction-clear-missing")?.click();

    expect(firstEnemy().factionId).toBeUndefined();
    expect(findByTestId(host, "db-enemy-faction-missing")).toBeNull();
    expect(findByTestId(host, "db-picker-enemy-faction")?.value).toBe("enemy");
  });

  it("repairs a dangling faction by assigning an existing faction", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "경비대" }], relations: [] };
    project.database.enemies[0]!.factionId = "deleted_guard";
    store.replace(project);
    const host = renderEnemyForm();
    const select = findByTestId(host, "db-picker-enemy-faction");
    if (!select) throw new Error("missing faction select");

    changeSelect(select, "guard");

    expect(firstEnemy().factionId).toBe("guard");
    expect(findByTestId(host, "db-enemy-faction-missing")).toBeNull();
    expect(findByTestId(host, "db-picker-enemy-faction")?.value).toBe("guard");
  });

  it("writes an authored faction through the enemy record mutation path", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "bandit", name: "산적" }], relations: [] };
    store.replace(project);
    const host = renderEnemyForm();
    const select = findByTestId(host, "db-picker-enemy-faction");
    if (!select) throw new Error("missing faction select");

    changeSelect(select, "bandit");

    expect(firstEnemy().factionId).toBe("bandit");
    expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("레코드에 저장됨");
    expect(findByTestId(host, "db-picker-enemy-faction")?.value).toBe("bandit");
  });

  it("clears an explicitly stored enemy value only after an authored round trip and explains it", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "bandit", name: "산적" }], relations: [] };
    project.database.enemies[0]!.factionId = "enemy";
    store.replace(project);
    const host = renderEnemyForm();
    const select = findByTestId(host, "db-picker-enemy-faction");
    if (!select) throw new Error("missing faction select");

    expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("레코드에 저장됨");
    expect(findByTestId(host, "db-enemy-faction-default-clears")?.textContent).toContain("저장된 소속 진영 값이 삭제");

    changeSelect(select, "bandit");
    const changed = findByTestId(host, "db-picker-enemy-faction");
    if (!changed) throw new Error("missing rerendered faction select");
    changeSelect(changed, "enemy");

    expect(firstEnemy().factionId).toBeUndefined();
    expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("미저장 · enemy로 전투");
  });

  it("clears the authored key when returning to the effective enemy default and explains that behavior", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "bandit", name: "산적" }], relations: [] };
    project.database.enemies[0]!.factionId = "bandit";
    store.replace(project);
    const host = renderEnemyForm();
    const select = findByTestId(host, "db-picker-enemy-faction");
    if (!select) throw new Error("missing faction select");

    expect(findByTestId(host, "db-enemy-faction-default-clears")?.textContent).toBe(
      "적 (enemy) · 기본값을 선택하면 저장된 소속 진영 값이 삭제됩니다.",
    );
    changeSelect(select, "enemy");

    expect(firstEnemy().factionId).toBeUndefined();
    expect(findByTestId(host, "db-enemy-faction-effective")?.dataset.effectiveFactionId).toBe("enemy");
    expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("미저장 · enemy로 전투");
  });

  it("reads player and peer stances from the resolved runtime faction table", () => {
    const project = createBlankProject();
    project.factions = {
      defs: [
        { id: "bandit", name: "산적", color: "#76512d" },
        { id: "guard", name: "경비대" },
      ],
      relations: [
        { a: "bandit", b: "guard", stance: -1 },
      ],
    };
    project.database.enemies[0]!.factionId = "bandit";
    store.replace(project);
    const host = renderEnemyForm();

    const player = findByTestId(host, "db-enemy-faction-stance-player");
    const guard = findByTestId(host, "db-enemy-faction-stance-guard");
    expect(player?.dataset.stance).toBe("0");
    expect(player?.textContent).toBe("플레이어 기준 0 · 중립");
    expect(guard?.dataset.stance).toBe("-1");
    expect(guard?.textContent).toBe("경비대 -1 · 적");
    expect(guard?.style["--db-enemy-faction-stance-color"]).toBe("#e0564a");
    expect(findByTestId(host, "db-enemy-faction-color")?.style["--db-enemy-faction-color"]).toBe("#76512d");
  });

  it("keeps all seven authored hostile relationships in the primary list", () => {
    const project = createBlankProject();
    project.factions = {
      defs: Array.from({ length: 7 }, (_, index) => ({
        id: `faction_${String.fromCharCode(97 + index)}`,
        name: `진영 ${String.fromCharCode(65 + index)}`,
      })),
      relations: [
        { a: "faction_a", b: "enemy", stance: -1 },
        ...Array.from({ length: 6 }, (_, index) => ({
          a: "faction_a",
          b: `faction_${String.fromCharCode(98 + index)}`,
          stance: -1 as const,
        })),
      ],
    };
    project.database.enemies[0]!.factionId = "faction_a";
    store.replace(project);
    const host = renderEnemyForm();

    const primary = findByTestId(host, "db-enemy-faction-relationships-primary");

    expect(primary?.querySelectorAll(".db-enemy-faction-stance")).toHaveLength(7);
    expect(primary?.textContent).toContain("적 -1 · 적");
    for (const id of ["b", "c", "d", "e", "f", "g"]) {
      expect(findByTestId(primary ?? host, `db-enemy-faction-stance-faction_${id}`)?.dataset.stance).toBe("-1");
    }
    expect(findByTestId(host, "db-enemy-faction-relationships-more")).toBeNull();
  });

  it("bounds peer pills, prioritizes authored relationships, and collapses the neutral remainder", () => {
    const project = createBlankProject();
    project.factions = {
      defs: [
        { id: "bandit", name: "산적" },
        ...Array.from({ length: 7 }, (_, index) => ({ id: `neutral_${index + 1}`, name: `중립 ${index + 1}` })),
        { id: "guard", name: "경비대" },
        { id: "trader", name: "상인회" },
      ],
      relations: [
        { a: "bandit", b: "guard", stance: -1 },
        { a: "bandit", b: "trader", stance: 0 },
      ],
    };
    project.database.enemies[0]!.factionId = "bandit";
    store.replace(project);
    const host = renderEnemyForm();

    const primary = findByTestId(host, "db-enemy-faction-relationships-primary");
    const more = findByTestId(host, "db-enemy-faction-relationships-more");
    const collapsedBody = more?.querySelector(".db-ws-card-body");
    const toggle = more?.querySelector("button");

    expect(primary?.querySelectorAll(".db-enemy-faction-stance")).toHaveLength(7);
    expect(primary?.textContent).toContain("경비대 -1 · 적");
    expect(primary?.textContent).toContain("상인회 0 · 중립");
    expect(more?.textContent).toContain("비적대 관계 3개");
    expect(more?.textContent).toContain("중립 3개 포함");
    expect(more?.dataset.neutralCount).toBe("3");
    expect(collapsedBody?.getAttribute("hidden")).toBe("");
    expect(toggle?.getAttribute("aria-label")).toBe("비적대 관계 3개 펼치기");
    expect(findByTestId(host, "db-enemy-faction-stance-neutral_7")?.textContent).toBe("중립 7 0 · 중립");

    toggle?.click();
    expect(collapsedBody?.getAttribute("hidden")).toBeNull();
    expect(toggle?.getAttribute("aria-label")).toBe("비적대 관계 3개 접기");
  });
});
