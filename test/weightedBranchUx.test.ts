import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newM2Command } from "@/editor/eventCommandFactory";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { parseWeightedBranchTable, serializeWeightedBranchTable, weightedBranchPercents } from "@/editor/panels/eventEditor/weightedBranchTable";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("weighted branch storage", () => {
  it("matches runtime numeric-field parsing when names are blank or contain extra separators", () => {
    expect(parseWeightedBranchTable("=2\na=3=extra\nzero=0\nbad=NaN").map(row => row.weight)).toEqual([2, 3]);
  });
  it("keeps one runtime outcome when a name contains separators or newlines", () => {
    const table = serializeWeightedBranchTable([{ label: "a=b\nc", weight: 0.1234567890123456 }]);
    expect(table.split("\n")).toHaveLength(1);
    expect(table.split("=")).toHaveLength(2);
    expect(parseWeightedBranchTable(table)[0]?.weight).toBe(0.1234567890123456);
  });
  it("does not round tiny positive odds to zero", () => {
    const percentages = weightedBranchPercents([{ label: "a", weight: 1 }, { label: "b", weight: 99999 }]);
    expect(percentages[0]).toBeCloseTo(0.001, 8);
    expect(percentages.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 10);
  });
});

describe("weighted branch command UX", () => {
  let restoreDom: () => void;
  let replaced: Command | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    replaced = undefined;
  });
  afterEach(() => restoreDom());

  function render(table = "success=1\nfailure=1", resultVariableId = "") {
    const cmd = { ...newM2Command("m2-211-weighted-branch"), fields: { table, resultVariableId, custom: "preserved" } };
    return renderWithFakeDom(() => renderCommandBody({
      path: [0], lockKind: true, getCurrentCommand: () => replaced ?? cmd,
      actions: {
        addCommand: () => {}, insertCommand: () => {},
        replaceCommand: (_path, command) => { replaced = command; },
        deleteCommand: () => {}, moveCommand: () => {}, moveCommandTo: () => {},
      },
    }, cmd));
  }
  function control(body: FakeElement, id: string): FakeElement {
    const node = findByTestId(body, id);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }
  function change(node: FakeElement, value: string, event = "input") {
    node.value = value;
    node.dispatchEvent(new Event(event));
  }
  function fields() {
    if (replaced?.kind !== "m2Command") throw new Error("No command update");
    return replaced.fields;
  }
  it("initializes percentages, row bars and zero-based mapping without writing on open", () => {
    const body = render();
    expect(control(body, "weighted-branch-chance-0").value).toBe("50");
    expect(control(body, "weighted-branch-chance-1").value).toBe("50");
    expect(control(body, "weighted-branch-meter-0").getAttribute("aria-valuenow")).toBe("50");
    expect(control(body, "weighted-branch-index-0").textContent).toBe("0");
    expect(control(body, "weighted-branch-index-1").textContent).toBe("1");
    expect(replaced).toBeUndefined();
  });
  it("redistributes the remainder proportionally when one percentage changes", () => {
    const body = render("a=2\nb=3\nc=5");
    const input = control(body, "weighted-branch-chance-0");
    input.focus();
    change(input, "60");
    const rows = parseWeightedBranchTable(String(fields().table));
    expect(rows).toHaveLength(3);
    expect(rows[0]?.weight).toBe(60);
    expect(rows[1]?.weight).toBeCloseTo(15, 12);
    expect(rows[2]?.weight).toBeCloseTo(25, 12);
    expect(control(body, "weighted-branch-chance-1").value).toBe("15");
    expect(control(body, "weighted-branch-meter-2").getAttribute("aria-valuenow")).toBe("25");
    expect(control(body, "weighted-branch-chance-0")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(fields().custom).toBe("preserved");
  });
  it("preserves exact authored table when only the destination changes", () => {
    store.update((project) => { project.variables.push({ id: "roll", name: "Roll" }); });
    const table = " =2\r\na=3=legacy\r\nbad\r\nz=0";
    const body = render(table);
    const picker = control(body, "weighted-branch-result-variable").querySelector("select");
    if (!picker) throw new Error("Missing picker select");
    change(picker, "roll", "change");
    expect(fields().table).toBe(table);
    expect(fields().resultVariableId).toBe("roll");
    expect(control(body, "weighted-branch-destination").dataset.variableId).toBe("roll");
  });
  it("preserves exact weight precision and focused name node while composing", () => {
    const body = render("a=0.1234567890123456\nb=3");
    const name = control(body, "weighted-branch-label-0");
    name.focus();
    name.dispatchEvent(new Event("compositionstart"));
    change(name, "성");
    expect(replaced).toBeUndefined();
    name.value = "성공";
    name.dispatchEvent(new Event("compositionend"));
    expect(parseWeightedBranchTable(String(fields().table))[0]).toEqual({ label: "성공", weight: 0.1234567890123456 });
    expect(control(body, "weighted-branch-label-0")).toBe(name);
    expect(document.activeElement).toBe(name);
  });
  it("leaves the committed table unchanged for incomplete and out-of-range percentages", () => {
    const body = render();
    const input = control(body, "weighted-branch-chance-0");
    for (const value of ["", "-1", "101"]) {
      change(input, value);
      expect(replaced).toBeUndefined();
      expect(input.getAttribute("aria-invalid")).toBe("true");
    }
  });
  it("keeps zero-chance rows editable but excludes them from runtime mapping", () => {
    const body = render("a=1\nb=1\nc=1");
    change(control(body, "weighted-branch-chance-1"), "0");
    expect(parseWeightedBranchTable(String(fields().table)).map(row => row.label)).toEqual(["a", "c"]);
    expect(control(body, "weighted-branch-index-1").dataset.resultValue).toBe("");
    expect(control(body, "weighted-branch-index-2").textContent).toBe("1");
    expect(control(body, "weighted-branch-chance-1").value).toBe("0");
  });
  it("focuses the new name on add and the nearest remaining name on removal", () => {
    const body = render();
    control(body, "weighted-branch-add-row").click();
    expect(document.activeElement).toBe(control(body, "weighted-branch-label-2"));
    expect(parseWeightedBranchTable(String(fields().table))).toHaveLength(3);
    control(body, "weighted-branch-remove-2").click();
    expect(document.activeElement).toBe(control(body, "weighted-branch-label-1"));
    expect(parseWeightedBranchTable(String(fields().table))).toHaveLength(2);
  });
  it("shows a nonzero display and proportional meter for sub-percent outcomes", () => {
    const body = render("rare=1\ncommon=99999999");
    expect(Number(control(body, "weighted-branch-chance-0").value)).toBeGreaterThan(0);
    expect(Number(control(body, "weighted-branch-meter-0").getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  });
  function openModal(table: string) {
    openEventCommandEditDialog({
      initial: { ...newM2Command("m2-211-weighted-branch"), fields: { table, resultVariableId: "roll" } },
      onApply: command => { replaced = command; },
    });
    return renderWithFakeDom(() => document.body);
  }
  it.each(["", "-1", "101"])("blocks modal Confirm with invalid chance %j and focuses the field", invalid => {
    const body = openModal("a=60\nb=40");
    const input = control(body, "weighted-branch-chance-0");
    change(input, invalid);
    control(body, "event-command-edit-ok").click();
    expect(replaced).toBeUndefined();
    expect(findByTestId(body, "event-command-edit-dialog") !== null).toBe(true);
    expect(document.activeElement === input).toBe(true);
    control(body, "event-command-edit-cancel").click();
  });
  it("retains named zero rows through actual Confirm and reopen with positive-only mapping", () => {
    const body = openModal("a=1\npaused=1\nc=1");
    change(control(body, "weighted-branch-chance-1"), "0");
    control(body, "event-command-edit-ok").click();
    const table = String(fields().table);
    expect(findByTestId(body, "event-command-edit-dialog")).toBeNull();
    openModal(table);
    expect(control(body, "weighted-branch-label-1").value).toBe("paused");
    expect(control(body, "weighted-branch-chance-1").value).toBe("0");
    expect(control(body, "weighted-branch-index-1").dataset.resultValue).toBe("");
    expect(control(body, "weighted-branch-index-2").dataset.resultValue).toBe("1");
    expect(parseWeightedBranchTable(table).map(row => row.label)).toEqual(["a", "c"]);
    control(body, "event-command-edit-cancel").click();
  });
  it("blocks an authored all-zero table without silently seeding positive chances", () => {
    const body = openModal("a=0\nb=0");
    expect(control(body, "weighted-branch-chance-0").value).toBe("0");
    control(body, "event-command-edit-ok").click();
    expect(replaced).toBeUndefined();
    expect(findByTestId(body, "event-command-edit-dialog") !== null).toBe(true);
    change(control(body, "weighted-branch-chance-0"), "100");
    control(body, "event-command-edit-ok").click();
    expect(fields().table).toBe("a=100\nb=0");
  });
  it("keeps the last positive row when removing it would enable zero-chance outcomes", () => {
    const body = openModal("a=100\npaused=0");
    control(body, "weighted-branch-remove-0").click();
    expect(control(body, "weighted-branch-label-0").value).toBe("a");
    expect(control(body, "weighted-branch-chance-1").value).toBe("0");
    control(body, "event-command-edit-cancel").click();
  });
  it("does not show certainty for the counterpart of a tiny positive chance", () => {
    const body = render("rare=1\ncommon=999999");
    expect(control(body, "weighted-branch-chance-0").value).toBe("0.0001");
    expect(control(body, "weighted-branch-chance-1").value).toBe("99.9999");
  });
  it("keeps a lone result at 100 percent and prevents removing it", () => {
    const body = render("only=8");
    expect(control(body, "weighted-branch-chance-0").value).toBe("100");
    expect(control(body, "weighted-branch-chance-0").disabled).toBe(true);
    expect(control(body, "weighted-branch-remove-0").disabled).toBe(true);
  });
});
