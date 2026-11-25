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
  nodes.flatMap((node) => (node.k === "step" || node.k === "heading" ? [node.text] : node.k === "loop" ? [node.head, ...steps(node.body)] : [node.head, ...node.arms.flatMap((arm) => steps(arm.body))]));
const sentences = (nodes: readonly ScriptFlowNode[]): string[] =>
  nodes.flatMap((node) => (node.k === "branch" ? [node.sentence, ...node.arms.flatMap((arm) => sentences(arm.body))] : node.k === "loop" ? sentences(node.body) : []));

describe("scriptFlow", () => {
  it("words branches with names and literal values instead of locals", () => {
    const nodes = scriptFlow(LOCK, project());
    const branch = nodes.find((node): node is Extract<ScriptFlowNode, { k: "branch" }> => node.k === "branch");
    expect(branch?.head).toBe("입력한 숫자 = 4213");
    expect(branch!.arms.map((arm) => arm.label)).toEqual(["예", "아니오"]);
    expect(steps(nodes)).toContain("실패 횟수 ≥ 3");
    expect(sentences(nodes)).toEqual(["입력한 숫자가 4213이면", "실패 횟수가 3 이상이면"]);
  });

  it("writes formulas as a readable line with names, words and symbols", () => {
    const source = [
      "const BASE = 100;",
      'const price = Math.floor(BASE * (1 - game.getVar("var_rep") / 200));',
      'game.setVar("var_price", price);',
    ].join("\n");
    const text = steps(scriptFlow(source, project()));
    // `price` has no label comment, so it reads by the word (가격); the variable reads by its short name
    expect(text[0]).toBe("가격 정하기 — 내림(100 × (1 − 평판 ÷ 200))");
  });

  it("shows a literal list once and words a game.cmd passthrough through the describe hook", () => {
    expect(steps(scriptFlow("const ORDER = [3, 1, 4, 2];"))).toEqual(["정해 둔 순서: 3, 1, 4, 2"]);
    expect(steps(scriptFlow("const QZX = [1, 2];"))).toEqual(["정해 둔 목록 QZX: 1, 2"]);
    const source = 'await game.cmd({"kind":"changeFace","faceId":"x"});';
    expect(scriptFlow(source)[0]).toMatchObject({ k: "step", text: "명령 changeFace" });
    expect(scriptFlow(source, undefined, undefined, (command) => `얼굴 바꾸기 ${String(command.faceId)}`)[0]).toMatchObject({ k: "step", text: "얼굴 바꾸기 x" });
  });
});

describe("scriptFlow ternary wording", () => {
  it("reads one a ? b : c as 「(a 이면 b, 아니면 c)」 and leaves strings, objects and ?? alone", () => {
    const src = [
      'const pick = game.getVar("var_rep");',
      "const count = pick === 0 ? 1 : 3;",
      "let bonus = 0;",
      "bonus = pick >= 10 ? 5 : 0;",
      "const total = 2 + (pick > 5 ? 1 : 0);",
      'const msg = pick > 5 ? "a: b" : "c?";',
      "const o = { a: 1 };",
      'const n = game.getVar("var_rep") ?? 0;',
    ].join("\n");
    const lines = steps(scriptFlow(src, project()));
    // a top-level ternary reads with the condition as a sentence; one inside a sum keeps the bracket form
    expect(lines).toContain("개수 정하기 — 평판이 0이면 1, 아니면 3");
    expect(lines).toContain("보너스 = 평판이 10 이상이면 5, 아니면 0");
    expect(lines).toContain("총액 정하기 — 2 + (평판 > 5 이면 1, 아니면 0)");
    expect(lines).toContain("메시지 정하기 — 평판이 5보다 크면 「a: b」, 아니면 「c?」");
    expect(lines).toContain("o = { a: 1 }");
    expect(lines).toContain("n = 평판 ?? 0");
  });
});

describe("scriptFlow names, sentences and headings (2026-11-01)", () => {
  it("uses the script's own Korean labels, step headings and «» message holes", () => {
    const source = [
      "// 가격 계산",
      "const BASE = 120; // 기본 가격",
      'const rep = game.getVar("var_rep");',
      "const price = Math.floor(BASE * (100 - rep) / 100); // 오늘 가격",
      "",
      "// 손님 맞이",
      "if (game.gold() < price) {",
      "  await game.showMessage(`${price}골드가 필요해요.`);",
      "} else {",
      "  game.addGold(-price);",
      "}",
      "// @label A: 이미 받음",
      "if (game.getSelfSwitch('A')) await game.showMessage('또 왔네.');",
    ].join("\n");
    const nodes = scriptFlow(source, project());
    expect(nodes.filter((node) => node.k === "heading").map((node) => node.k === "heading" && node.text)).toEqual(["가격 계산", "손님 맞이"]);
    const lines = steps(nodes);
    expect(lines).toContain("오늘 가격 정하기 — 내림(120 × (100 − 평판) ÷ 100)");
    expect(lines).toContain("「«오늘 가격»골드가 필요해요.」");
    expect(lines).toContain("돈에서 오늘 가격만큼 빼기");
    expect(sentences(nodes)).toEqual(["돈이 오늘 가격보다 적으면", "이 이벤트가 「이미 받음」 상태이면"]);
    expect(lines.join("\n")).not.toMatch(/\b(price|rep|BASE)\b/u);
  });

  it("reads choices, order lists, event ids and unlabeled self switch A as sentences", () => {
    const p = project();
    const map = Object.values(p.maps)[0]!;
    map.events.push({ id: "ev_lever1", x: 0, y: 0, pages: [] } as unknown as (typeof map.events)[number]);
    const source = [
      "const N = 3;",
      "const ORDER = [3, 1, 4, 2];",
      "const LEVERS = ['ev_lever1'];",
      'const step = game.getVar("var_fail");',
      "if (game.getSelfSwitch('A')) {",
      "  await game.showMessage('이미 당겼다.');",
      "} else if (ORDER[step] === N) {",
      "  game.setSelfSwitch('A', true);",
      "} else {",
      "  for (const id of LEVERS) game.setSelfSwitch('A', false, id);",
      "}",
      "const pick = await game.showChoices(['1병 (10G)', '3병', '그만']);",
      "if (pick === 0 || pick === 1) game.addItem('item_potion', pick === 0 ? 1 : 3);",
    ].join("\n");
    const nodes = scriptFlow(source, p);
    const lines = steps(nodes);
    expect(lines).toContain("정해 둔 순서: 3, 1, 4, 2");
    expect(lines).toContain("정해 둔 레버 목록: 레버 1");
    expect(lines).toContain("레버 목록의 각 레버마다");
    expect(lines).toContain("그 레버에서 했다는 기억 지우기");
    expect(lines).toContain("이 이벤트에서 했다고 기억하기");
    expect(sentences(nodes)).toEqual(["이 이벤트에서 이미 했으면", "3번이 지금 차례면", "「1병」이나 「3병」을 골랐으면"]);
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
