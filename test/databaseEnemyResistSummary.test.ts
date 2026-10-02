import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { enemyResistSummary } from "@/editor/panels/databaseEnemyResistSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function firstEnemy(): EnemyRecord {
  const enemy = store.getCurrent().database.enemies[0];
  if (!enemy) throw new Error("missing default enemy");
  return enemy;
}

function renderEnemyForm(): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  const rerender = (): void => {
    form.replaceChildren();
    const live = store.getCurrent().database.enemies.find((entry) => entry.id === firstEnemy().id)!;
    renderEnemyRecordForm(form as unknown as HTMLElement, live, rerender);
  };
  rerender();
  return form;
}

function allByDataset(root: FakeElement, key: string): FakeElement[] {
  const found: FakeElement[] = [];
  const walk = (node: FakeElement): void => {
    if (node.dataset[key] !== undefined) found.push(node);
    for (const child of node.children as unknown as FakeElement[]) walk(child);
  };
  walk(root);
  return found;
}

describe("enemy 약점·저항 summary", () => {
  it("lists only grades that differ from the default, in the table's own vocabulary", () => {
    const project = store.getCurrent();
    const [weakElement, resistElement] = project.database.elements ?? [];
    if (!weakElement || !resistElement) throw new Error("blank project needs two elements");
    const enemy: EnemyRecord = {
      ...firstEnemy(),
      elementRates: { [weakElement.id]: "A", [resistElement.id]: "D", ghost_element: "A" },
      stateRates: { state_death: "E", state_poison: "C", state_sleep: "A" },
    };
    const summary = enemyResistSummary(project, enemy);
    const texts = summary.highlights.map((entry) => entry.text);
    const weak = (weakElement.damageMultipliers?.A ?? 100) / 100;
    const resist = (resistElement.damageMultipliers?.D ?? 100) / 100;
    expect(texts).toContain(`${weakElement.name} ×${weak} 약점`);
    expect(texts).toContain(`${resistElement.name} ×${resist}`);
    expect(texts).toContain("전투불능 무효");
    // C → 60%: 기본(100%)과 다르므로 보인다. A(100%)는 기본과 같아 숨는다.
    expect(summary.highlights.some((entry) => entry.id === "state_poison" && entry.text.endsWith("60%만 걸림"))).toBe(project.database.states.some((state) => state.id === "state_poison"));
    expect(summary.highlights.some((entry) => entry.id === "state_sleep")).toBe(false);
    expect(summary.highlights.find((entry) => entry.kind === "dangling")?.text).toBe("목록에 없는 속성 1개");
    expect(summary.total).toBe(summary.stateCount + summary.elementCount);
  });

  it("keeps every rate row inside a collapsed full table and refreshes chips when a grade changes", () => {
    const host = renderEnemyForm();
    const card = findByTestId(host, "db-enemy-card-resist");
    const table = findByTestId(host, "db-enemy-resist-table") as unknown as { open?: boolean } | null;
    expect(card).not.toBeNull();
    expect(table?.open).toBe(false);
    // 기존 표 카드·행 testid 는 그대로 표 안에 있다.
    const tableNode = findByTestId(host, "db-enemy-resist-table")!;
    expect(findByTestId(tableNode, "db-enemy-card-state")).not.toBeNull();
    expect(findByTestId(tableNode, "db-enemy-card-element")).not.toBeNull();
    expect(findByTestId(tableNode, "db-picker-enemy-state-rate-state_death")).not.toBeNull();
    expect(findByTestId(host, "db-enemy-resist-chips")?.hidden).toBe(true);
    expect(findByTestId(host, "db-enemy-resist-note")?.textContent).toContain("모두 기본값");

    const element = store.getCurrent().database.elements?.[0];
    if (!element) throw new Error("missing element");
    const select = findByTestId(tableNode, `db-picker-enemy-element-rate-${element.id}`)!;
    select.value = "E";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(firstEnemy().elementRates[element.id]).toBe("E");
    const chip = findByTestId(host, `db-enemy-resist-chip-element-${element.id}`);
    expect(chip?.textContent).toContain(element.name);
    expect(findByTestId(host, "db-enemy-resist-chips")?.hidden).toBe(false);
    expect(findByTestId(host, "db-enemy-resist-note")?.textContent).toMatch(/^나머지 \d+개는 기본값입니다\.$/u);

    chip?.dispatchEvent(new Event("click", { bubbles: true }));
    expect((findByTestId(host, "db-enemy-resist-table") as unknown as { open?: boolean }).open).toBe(true);
  });

  it("shows every enemy card, including the ones beginner mode used to hide", () => {
    const host = renderEnemyForm();
    for (const id of [
      "db-enemy-card-critical", "db-enemy-card-options", "db-enemy-card-action-combat", "db-enemy-card-species",
      "db-enemy-card-resist", "db-enemy-card-stats", "db-enemy-card-rewards", "db-enemy-graphic-set",
    ]) {
      expect(findByTestId(host, id), id).not.toBeNull();
    }
    expect(allByDataset(host, "dbUx")).toEqual([]);
    // 치명타 힌트는 「N번에 1번 (x%)」 말투다.
    const critical = store.getCurrent().database.enemies[0]!.criticalHit;
    const hint = findByTestId(host, "db-enemy-card-critical")?.textContent ?? "";
    expect(hint).toContain(critical.enabled ? `${critical.oneIn}번에 1번` : "치명타 사용 안 함");
    expect(hint).not.toContain("1/");
  });
});
