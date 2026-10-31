// test/scriptInsight.test.ts — the plain-language reading of a script (src/editor/script/scriptInsight.ts) and the
// "명령으로 풀기" adapter (src/editor/script/scriptUnwrapAdapter.ts) behind the event list's script lines.
import { beforeAll, describe, expect, it } from "vitest";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { commandsToScript } from "@/editor/script/eventToScript";
import { scriptFlow, type ScriptFlowNode } from "@/editor/script/scriptInsight";
import { unwrapScriptForEditor } from "@/editor/script/scriptUnwrapAdapter";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";

beforeAll(async () => {
  await prepareScriptCompiler();
}, 60_000);

function project(): Project {
  const p = createBlankProject();
  p.switches.push({ id: "sw_gate", name: "창고 문 열림" } as Project["switches"][number]);
  p.variables.push({ id: "var_fail", name: "실패 횟수" } as Project["variables"][number]);
  p.variables.push({ id: "var_rep", name: "평판" } as Project["variables"][number]);
  p.variables.push({ id: "var_price", name: "포션 값" } as Project["variables"][number]);
  return p;
}

const LOCK = [
  "const ANSWER = 4213; // 정답",
  "const HINT_AFTER = 3;",
  "const input = await game.inputNumber();",
  "if (input === ANSWER) {",
  '  game.setSwitch("sw_gate", true);',
  '  await game.showMessage("철컥 — 문이 열렸다.");',
  "} else {",
  '  game.addVar("var_fail", 1);',
  '  if (game.getVar("var_fail") >= HINT_AFTER) await game.showMessage("힌트: 시계를 봐.");',
  "}",
].join("\n");

const steps = (nodes: readonly ScriptFlowNode[]): string[] =>
  nodes.flatMap((node) => (node.k === "step" ? [node.text] : node.k === "loop" ? [node.head, ...steps(node.body)] : [node.head, ...node.arms.flatMap((arm) => steps(arm.body))]));

describe("scriptFlow", () => {
  it("words branches with names and literal values instead of locals", () => {
    const nodes = scriptFlow(LOCK, project());
    const branch = nodes.find((node): node is Extract<ScriptFlowNode, { k: "branch" }> => node.k === "branch");
    expect(branch?.head).toBe("입력한 숫자 = 4213");
    expect(branch!.arms.map((arm) => arm.label)).toEqual(["예", "아니오"]);
    expect(steps(nodes)).toContain("변수 「실패 횟수」 ≥ 3");
  });

  it("writes formulas as a readable line with names, words and symbols", () => {
    const source = [
      "const BASE = 100;",
      'const price = Math.floor(BASE * (1 - game.getVar("var_rep") / 200));',
      'game.setVar("var_price", price);',
    ].join("\n");
    const text = steps(scriptFlow(source, project()));
    expect(text[0]).toBe("price = 내림(100 × (1 − 변수 「평판」 ÷ 200))");
  });

  it("shows a literal list once and words a game.cmd passthrough through the describe hook", () => {
    expect(steps(scriptFlow("const ORDER = [3, 1, 4, 2];"))).toEqual(["정해 둔 목록 ORDER: 3, 1, 4, 2"]);
    const source = 'await game.cmd({"kind":"changeFace","faceId":"x"});';
    expect(scriptFlow(source)[0]).toMatchObject({ k: "step", text: "명령 changeFace" });
    expect(scriptFlow(source, undefined, undefined, (command) => `얼굴 바꾸기 ${String(command.faceId)}`)[0]).toMatchObject({ k: "step", text: "얼굴 바꾸기 x" });
  });
});

describe("unwrapScriptForEditor", () => {
  it("round-trips a converted event page and refuses code with a reason and line", () => {
    const p = project();
    const commands = [
      { kind: "text", body: "어서 와." },
      { kind: "setSwitch", switchId: "sw_gate", value: true },
    ] as unknown as Command[];
    const { source } = commandsToScript(commands);
    const ok = unwrapScriptForEditor(source, p);
    expect(ok.status).toBe("ok");
    expect(ok.status === "ok" && ok.commands.map((command) => command.kind)).toEqual(["text", "setSwitch"]);

    const blocked = unwrapScriptForEditor('let n = 0;\nn = game.getVar("var_fail") * 2;\ngame.setVar("var_fail", n);', p);
    expect(blocked.status).toBe("blocked");
    expect(blocked.status === "blocked" && blocked.line).toBeGreaterThan(0);
    expect(blocked.status === "blocked" && blocked.reason.length).toBeGreaterThan(0);
    expect(unwrapScriptForEditor("  ", p).status).toBe("blocked");
  });
});
