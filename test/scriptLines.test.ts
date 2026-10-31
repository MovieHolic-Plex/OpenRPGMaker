// @vitest-environment happy-dom
// test/scriptLines.test.ts — a script command reads like event lines in the event list
// (src/editor/panels/eventEditor/scriptLines.ts): exact command lines when the script converts, one plain line per
// statement (「조건 분기」 · 「계산: …」) when it does not.
import { beforeAll, describe, expect, it } from "vitest";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { scriptLineNodes } from "@/editor/panels/eventEditor/scriptLines";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

beforeAll(async () => {
  await prepareScriptCompiler();
}, 60_000);

function project(): Project {
  const p = createBlankProject();
  p.switches.push({ id: "sw_gate", name: "창고 문 열림" } as Project["switches"][number]);
  p.variables.push({ id: "var_rep", name: "평판" } as Project["variables"][number]);
  p.variables.push({ id: "var_price", name: "포션 값" } as Project["variables"][number]);
  return p;
}

const text = (nodes: readonly HTMLElement[]): string[] => nodes.map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim());

describe("scriptLineNodes", () => {
  it("shows the converted commands' own lines when the script converts exactly", () => {
    const lines = text(scriptLineNodes({ source: 'if (game.getSwitch("sw_gate")) {\n  await game.showMessage("열렸다.");\n}' }, project()));
    expect(lines.length).toBeGreaterThanOrEqual(3);
    // names come from the open project (store); this test project is not loaded there, so the id shows
    expect(lines.some((line) => line.includes("조건 분기") && (line.includes("창고 문 열림") || line.includes("sw_gate")))).toBe(true);
    expect(lines.some((line) => line.includes("열렸다."))).toBe(true);
  });

  it("falls back to one plain line per statement, formulas as 「계산」", () => {
    const source = [
      "const BASE = 100;",
      'const price = Math.floor(BASE * (1 - game.getVar("var_rep") / 200));',
      'game.setVar("var_price", price);',
      'if (game.getVar("var_rep") >= 10) await game.showMessage("단골이네!");',
    ].join("\n");
    const lines = text(scriptLineNodes({ source }, project()));
    expect(lines.some((line) => line.includes("계산: price = 내림(100 × (1 − 변수 「평판」 ÷ 200))"))).toBe(true);
    expect(lines.some((line) => line.includes("조건 분기: 변수 「평판」 ≥ 10"))).toBe(true);
    expect(lines.some((line) => line.includes("단골이네!"))).toBe(true);
  });

  it("is empty for an empty script", () => {
    expect(scriptLineNodes({ source: "  " }, project())).toEqual([]);
  });
});
