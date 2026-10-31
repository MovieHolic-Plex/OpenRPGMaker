// test/scriptInsight.test.ts — the event editor's script card data (src/editor/script/scriptInsight.ts):
// chips from compiler effects, top-level tunables and their in-place edit, the flow tree, and the
// "명령으로 풀기" adapter (src/editor/script/scriptUnwrapAdapter.ts). Also the one-shot AI box prompt/parse
// contract (src/ai/scriptAssist.ts) with a fake chat.
import { beforeAll, describe, expect, it } from "vitest";
import { compileScript, prepareScriptCompiler } from "@/editor/script/compile";
import { commandsToScript } from "@/editor/script/eventToScript";
import { scriptChips, scriptFlow, scriptFlowStats, scriptTunables, setScriptTunable, type ScriptFlowNode } from "@/editor/script/scriptInsight";
import { unwrapScriptForEditor } from "@/editor/script/scriptUnwrapAdapter";
import { runScriptAssist } from "@/ai/scriptAssist";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";

beforeAll(async () => {
  await prepareScriptCompiler();
}, 60_000);

function project(): Project {
  const p = createBlankProject();
  p.switches.push({ id: "sw_gate", name: "창고 문 열림" } as Project["switches"][number]);
  p.variables.push({ id: "var_fail", name: "실패 횟수" } as Project["variables"][number]);
  return p;
}

const LOCK = [
  "const ANSWER = 4213; // 정답",
  "const HINT_AFTER = 3; // 몇 번 틀리면 힌트",
  'const input = await game.inputNumber();',
  "if (input === ANSWER) {",
  '  game.setSwitch("sw_gate", true);',
  '  await game.showMessage("철컥 — 문이 열렸다.");',
  "} else {",
  '  game.addVar("var_fail", 1);',
  '  if (game.getVar("var_fail") >= HINT_AFTER) await game.showMessage("힌트: 시계를 봐.");',
  "}",
].join("\n");

describe("scriptChips", () => {
  it("names reads and writes from the compiler effects", () => {
    const p = project();
    const compiled = compileScript(LOCK, { project: p });
    expect(compiled.ok).toBe(true);
    const chips = scriptChips(compiled.effects, p);
    const write = chips.filter((chip) => chip.access === "write").map((chip) => chip.label);
    const read = chips.filter((chip) => chip.access === "read").map((chip) => chip.label);
    expect(write.some((label) => label.includes("창고 문 열림"))).toBe(true);
    expect(write.some((label) => label.includes("실패 횟수"))).toBe(true);
    expect(read.some((label) => label.includes("실패 횟수"))).toBe(true);
  });
});

describe("scriptTunables", () => {
  it("lists top-level literal consts with their comment and edits one in place", () => {
    const tunables = scriptTunables(LOCK);
    expect(tunables.map((entry) => [entry.name, entry.value, entry.comment])).toEqual([
      ["ANSWER", "4213", "정답"],
      ["HINT_AFTER", "3", "몇 번 틀리면 힌트"],
    ]);
    const edited = setScriptTunable(LOCK, tunables[1]!, "5");
    expect("source" in edited && edited.source.split("\n")[1]).toBe("const HINT_AFTER = 5; // 몇 번 틀리면 힌트");
    expect("source" in edited && edited.source.split("\n").slice(2)).toEqual(LOCK.split("\n").slice(2));
    expect("error" in setScriptTunable(LOCK, tunables[1]!, "abc")).toBe(true);
  });
});

describe("scriptFlow", () => {
  it("draws branches with names instead of locals", () => {
    const nodes = scriptFlow(LOCK, project());
    const branch = nodes.find((node): node is Extract<ScriptFlowNode, { k: "branch" }> => node.k === "branch");
    expect(branch).toBeDefined();
    expect(branch!.head).toContain("4213");
    expect(branch!.arms.map((arm) => arm.label)).toEqual(["예", "아니오"]);
    const stats = scriptFlowStats(nodes);
    expect(stats.steps).toBeGreaterThan(3);
  });

  it("words a game.cmd passthrough through the describe hook", () => {
    const source = 'await game.cmd({"kind":"changeFace","faceId":"x"});';
    const plain = scriptFlow(source);
    const described = scriptFlow(source, undefined, undefined, (command) => `얼굴 바꾸기 ${String(command.faceId)}`);
    expect(plain[0]).toMatchObject({ k: "step", text: "명령 changeFace" });
    expect(described[0]).toMatchObject({ k: "step", text: "얼굴 바꾸기 x" });
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

    const blocked = unwrapScriptForEditor("let n = 0;\nn = game.getVar(\"var_fail\") * 2;\ngame.setVar(\"var_fail\", n);", p);
    expect(blocked.status).toBe("blocked");
    expect(blocked.status === "blocked" && blocked.line).toBeGreaterThan(0);
    expect(blocked.status === "blocked" && blocked.reason.length).toBeGreaterThan(0);
    expect(unwrapScriptForEditor("  ", p).status).toBe("blocked");
  });
});

describe("runScriptAssist", () => {
  it("parses the JSON reply and feeds compile errors back once", async () => {
    const p = project();
    const replies = [
      JSON.stringify({ source: "game.setSwitch(", summary: ["x"], examples: [] }),
      "```json\n" + JSON.stringify({ source: LOCK.replace("4213", "1111"), summary: ["정답은 1111이다."], examples: [{ label: "정답", numbers: [1111] }] }) + "\n```",
    ];
    const seen: string[] = [];
    const chat = (async (_config: unknown, request: { messages: { role: string; content: unknown }[] }) => {
      seen.push(String(request.messages.at(-1)?.content ?? ""));
      return { message: { role: "assistant", content: replies.shift() ?? "" } };
    }) as unknown as NonNullable<Parameters<typeof runScriptAssist>[0]["chat"]>;
    const result = await runScriptAssist({
      config: { provider: "openai", model: "m", apiKey: "k" } as never,
      project: p,
      source: LOCK,
      request: "change the answer to 1111",
      mode: "edit",
      locale: "ko",
      chat,
    });
    expect(result.attempts).toBe(2);
    expect(result.source).toContain("1111");
    expect(result.lines).toEqual(["정답은 1111이다."]);
    expect(result.examples).toEqual([{ label: "정답", numbers: [1111] }]);
    expect(seen[1]).toContain("does not compile");
  });
});
