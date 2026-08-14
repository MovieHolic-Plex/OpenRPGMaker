import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { normalizeTypeChart } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderSystem(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderSystemTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

function chip(host: FakeElement, attacker: string, defender: string): FakeElement {
  const node = findByTestId(host, `db-type-chart-${attacker}-${defender}`);
  if (!node) throw new Error(`missing chip ${attacker}->${defender}`);
  return node;
}

function multiplier(attacker: string, defender: string): number | undefined {
  return store.getCurrent().system.typeChart?.multipliers?.[attacker]?.[defender];
}

describe("database type chart chip matrix", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
    store.update((draft) => {
      draft.system.typeChart = normalizeTypeChart({ types: ["fire", "water", "grass"], multipliers: {} });
    });
    resetMapEditHistory();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("chip click cycles 0→0.25→0.5→1→1.5→2→3→4→0 with normalized writes and no rerender storm", () => {
    store.update((draft) => {
      draft.system.typeChart = normalizeTypeChart({
        types: ["fire", "water", "grass"],
        multipliers: { fire: { water: 0 } },
      });
    });
    const host = renderSystem();
    const fireWater = chip(host, "fire", "water");
    expect(fireWater.tagName).toBe("BUTTON");
    expect(fireWater.dataset.attacker).toBe("fire");
    expect(fireWater.dataset.defender).toBe("water");
    expect(fireWater.dataset.value).toBe("0");
    expect(fireWater.dataset.state).toBe("down");

    const historyBefore = getMapEditHistoryEntries().length;
    const expected = [0.25, 0.5, 1, 1.5, 2, 3, 4, 0];
    for (const value of expected) {
      fireWater.click();
      // store 에 정규화된 승수가 기록된다.
      expect(multiplier("fire", "water")).toBe(value);
      // 칩 dataset 도 같은 값으로 로컬 갱신된다.
      expect(fireWater.dataset.value).toBe(String(value));
      expect(fireWater.dataset.state).toBe(value > 1 ? "up" : value < 1 ? "down" : "neutral");
    }

    // 같은 DOM 노드 — 클릭이 전체 재렌더(호스트 재구축)를 유발하지 않는다.
    expect(chip(host, "fire", "water")).toBe(fireWater);
    // 클릭 1회 = 스냅샷 1개(updateTypeChartCell 경로), 8회 클릭 = 8개.
    expect(getMapEditHistoryEntries().length).toBe(historyBefore + expected.length);
    // 4→0 wrap 후 라벨도 갱신된다.
    expect(fireWater.textContent).toBe("0");
  });

  it("preview shows 'fire → grass 2.0x' after interacting with the fire→grass cell", () => {
    const host = renderSystem();
    const preview = findByTestId(host, "db-type-preview");
    if (!preview) throw new Error("missing preview");

    const fireGrass = chip(host, "fire", "grass");
    fireGrass.click(); // 1 → 1.5
    fireGrass.click(); // 1.5 → 2
    expect(multiplier("fire", "grass")).toBe(2);
    expect(preview.textContent).toContain("공격→방어");
    expect(preview.textContent).toContain("fire → grass 2.0x");

    // hover(마우스 진입)도 미리보기를 갱신한다.
    const fireWater = chip(host, "fire", "water");
    fireWater.dispatchEvent(new Event("mouseenter"));
    expect(preview.textContent).toContain("fire → water 1.0x");
  });

  it("contextmenu popover clamps 7→4 and -1→0, keeps 1.25, and Escape closes without writing", () => {
    const host = renderSystem();
    const fireWater = chip(host, "fire", "water");
    const popover = findByTestId(host, "db-type-chart-popover");
    const input = findByTestId(host, "db-type-chart-popover-input");
    const confirm = findByTestId(host, "db-type-chart-popover-confirm");
    if (!popover || !input || !confirm) throw new Error("missing popover nodes");

    fireWater.dispatchEvent(new Event("contextmenu"));
    expect(popover.hidden).toBe(false);
    input.value = "7";
    confirm.click();
    expect(multiplier("fire", "water")).toBe(4);
    expect(fireWater.dataset.value).toBe("4");
    expect(popover.hidden).toBe(true);

    fireWater.dispatchEvent(new Event("contextmenu"));
    input.value = "-1";
    confirm.click();
    expect(multiplier("fire", "water")).toBe(0);
    expect(fireWater.dataset.value).toBe("0");
    expect(popover.hidden).toBe(true);

    fireWater.dispatchEvent(new Event("contextmenu"));
    input.value = "1.25";
    confirm.click();
    expect(multiplier("fire", "water")).toBe(1.25);
    expect(fireWater.dataset.value).toBe("1.25");
    expect(popover.hidden).toBe(true);

    // Escape 는 쓰지 않고 닫는다.
    fireWater.dispatchEvent(new Event("contextmenu"));
    input.value = "2";
    const escapeEvent = new Event("keydown");
    Object.defineProperty(escapeEvent, "key", { configurable: true, value: "Escape" });
    input.dispatchEvent(escapeEvent);
    expect(popover.hidden).toBe(true);
    expect(multiplier("fire", "water")).toBe(1.25);
  });

  it("blank type list still deletes system.typeChart", () => {
    const host = renderSystem();
    expect(findByTestId(host, "db-type-chart-matrix")).not.toBeNull();

    const types = findByTestId(host, "db-field-system-type-chart-types");
    if (!types) throw new Error("missing types input");
    types.value = "";
    types.dispatchEvent(new Event("change"));

    expect(store.getCurrent().system.typeChart).toBeUndefined();
    expect(findByTestId(host, "db-type-chart-matrix")).toBeNull();
  });

  it("diagonal cells are disabled and dimmed, and clicks on them do not write", () => {
    const host = renderSystem();
    const diagonal = chip(host, "fire", "fire");
    expect(diagonal.disabled).toBe(true);
    expect(diagonal.dataset.state).toBe("diag");

    diagonal.click();
    expect(multiplier("fire", "fire")).toBe(1);
    // diagonal 칩에는 contextmenu 리스너가 없다 — 팝오버가 열리지 않는다.
    diagonal.dispatchEvent(new Event("contextmenu"));
    const popover = findByTestId(host, "db-type-chart-popover");
    if (!popover) throw new Error("missing popover");
    expect(popover.hidden).toBe(true);
  });
});
