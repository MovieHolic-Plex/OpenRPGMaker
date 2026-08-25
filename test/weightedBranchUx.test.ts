import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newM2Command } from "@/editor/eventCommandFactory";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary, commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import {
  formatWeightedBranchSummary,
  parseWeightedBranchTable,
  rowsForWeightedBranchEditor,
  serializeWeightedBranchTable,
  weightedBranchPercents,
} from "@/editor/panels/eventEditor/weightedBranchTable";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("weightedBranchTable helpers", () => {
  it("parses label=weight lines and drops invalid rows", () => {
    const rows = parseWeightedBranchTable("성공=1\nbroken\nzero=0\n실패=3\n\nbad=NaN");
    expect(rows).toEqual([
      { label: "성공", weight: 1 },
      { label: "실패", weight: 3 },
    ]);
  });

  it("round-trips serialize/parse for positive weights", () => {
    const table = serializeWeightedBranchTable([
      { label: "rare", weight: 1 },
      { label: "common", weight: 9 },
      { label: "skip", weight: 0 },
    ]);
    expect(table).toBe("rare=1\ncommon=9");
    expect(parseWeightedBranchTable(table)).toEqual([
      { label: "rare", weight: 1 },
      { label: "common", weight: 9 },
    ]);
  });

  it("falls back when every weight is non-positive", () => {
    expect(serializeWeightedBranchTable([{ label: "x", weight: 0 }])).toBe("결과1=1");
  });

  it("seeds editor rows when table is empty", () => {
    expect(rowsForWeightedBranchEditor("")).toEqual([
      { label: "성공", weight: 1 },
      { label: "실패", weight: 1 },
    ]);
  });

  it("computes integer percents that sum to 100", () => {
    const percents = weightedBranchPercents([
      { label: "a", weight: 1 },
      { label: "b", weight: 1 },
      { label: "c", weight: 1 },
    ]);
    expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(percents).toEqual([34, 33, 33]);
  });

  it("formats human summary with residual last percent", () => {
    expect(formatWeightedBranchSummary("rare=1\ncommon=9", "loot_roll", "전리품")).toBe(
      "rare 10% · common 90% → 변수 전리품",
    );
    expect(formatWeightedBranchSummary("a=1\nb=1\nc=1\nd=1", "")).toContain("외 1");
    expect(formatWeightedBranchSummary("a=1\nb=1\nc=1\nd=1", "")).toContain("변수 (미선택)");
  });
});

describe("weighted branch command UX", () => {
  let restoreDom: (() => void) | undefined;
  let replaced: Command | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    replaced = undefined;
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders row editor instead of raw table textarea", () => {
    const cmd = {
      ...newM2Command("m2-211-weighted-branch"),
      fields: {
        table: "success=1\nfailure=1",
        resultVariableId: "",
      },
    };
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [0],
          actions: {
            addCommand: () => {},
            insertCommand: () => {},
            replaceCommand: (_path, command) => {
              replaced = command;
            },
            deleteCommand: () => {},
            moveCommand: () => {},
            moveCommandTo: () => {},
          },
          lockKind: true,
        },
        cmd,
      ),
    );

    expect(findByTestId(body, "m2-command-body-m2-211-weighted-branch")).toBeTruthy();
    expect(findByTestId(body, "weighted-branch-rows")).toBeTruthy();
    expect(findByTestId(body, "weighted-branch-help")?.textContent).toContain("가중치로 하나 고르기");
    expect(findByTestId(body, "weighted-branch-guide")?.textContent).toContain("조건 분기");
    expect(findByTestId(body, "m2-command-table-textarea")).toBeFalsy();
    expect(body.textContent).toContain("50%");
  });

  it("summarizes outcomes without dumping field keys", () => {
    const parts = commandSummaryParts({
      kind: "m2Command",
      commandId: "m2-211-weighted-branch",
      fields: {
        table: "성공=1\n실패=1",
        resultVariableId: "loot_roll",
      },
    });
    const text = parts.map((part) => part.text).join("");
    expect(text).toContain("가중 분기");
    expect(text).toContain("성공 50%");
    expect(text).toContain("실패 50%");
    expect(text).toContain("변수");
    expect(text).not.toContain("table:");
    expect(text).not.toContain("resultVariableId");
    expect(commandSummary({
      kind: "m2Command",
      commandId: "m2-211-weighted-branch",
      fields: { table: "성공=1\n실패=1", resultVariableId: "" },
    })).toContain("변수 (미선택)");
  });

  it("new command defaults to Korean 50/50 table", () => {
    const cmd = newM2Command("m2-211-weighted-branch");
    expect(String(cmd.fields.table)).toContain("성공=1");
    expect(String(cmd.fields.table)).toContain("실패=1");
  });
});
