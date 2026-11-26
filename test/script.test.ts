import { beforeAll, describe, expect, it } from "vitest";
import { compileScript, prepareScriptCompiler, scriptCommandFields } from "@/editor/script/compile";
import { SCRIPT_TS_LIB_ENTRY, SCRIPT_TS_LIB_SOURCES, SCRIPT_TS_VERSION } from "@/editor/script/tsLibSources.generated";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { preloadScriptEngine, projectUsesScripts } from "@/player/script/engine";
import { SCRIPT_API } from "@/project/script/apiSpec";
import { buildGameApiDts, scriptDtsIds } from "@/project/script/dts";
import { normalizeScriptLibrary } from "@/project/script/library";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project, Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { commandsToScript } from "@/editor/script/eventToScript";
import { scriptFlow, type ScriptFlowNode } from "@/editor/script/scriptInsight";
import { unwrapScriptForEditor } from "@/editor/script/scriptUnwrapAdapter";
import { readScriptLog } from "@/player/script/scriptLog";
import { HOST_API } from "@/player/script/hostApi";
import { createRngState } from "@/util/rng";
import { isolateTimers } from "./mergedTeardown";

// test/scriptCompile.test.ts — TS compile, type check, static effects and the generated game .d.ts.
describe("scriptCompile", () => {
  isolateTimers();
  beforeAll(async () => {
    await Promise.all([prepareScriptCompiler(), preloadScriptEngine()]);
  }, 60_000);
  function project(): Project {
    const value = createBlankProject();
    value.switches.push({ id: "sw_door", name: "Door open" }, { id: "lever_1", name: "Lever 1" });
    value.variables.push({ id: "rep", name: "Reputation" });
    return value;
  }
  describe("compileScript", () => {
    it("compiles a clean script, keeps top-level await and extracts effects", () => {
      const result = compileScript(`if (game.getSwitch("lever_1")) {\n  game.setSwitch("sw_door", true);\n  await game.showMessage("Click!");\n}\n`, { project: project() });
      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.compiled).toContain("await game.showMessage");
      expect(result.effects.reads).toEqual([{ kind: "switch", id: "lever_1" }]);
      expect(result.effects.writes).toEqual([{ kind: "switch", id: "sw_door" }]);
      expect(result.summary).toContain("스위치 sw_door");
      expect(result.sourceHash).toMatch(/^[0-9a-f]{16}$/u);
    });

    it("reports type errors with 1-based lines", () => {
      const result = compileScript(`const ok = 1;\nconst name: string = game.gold();\n`, { project: project() });
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ line: 2, severity: "error", source: "type" }));
    });

    it("rejects DOM, network and timers at type-check time", () => {
      const result = compileScript(`document.title = "x";\nfetch("https://example.com");\nsetTimeout(() => {}, 10);\n`, { project: project() });
      const messages = result.diagnostics.map((entry) => entry.message).join("\n");
      expect(messages).toContain("document");
      expect(messages).toContain("fetch");
      expect(messages).toContain("setTimeout");
    });

    it("syntax errors leave compiled empty", () => {
      const result = compileScript(`await game.showMessage("hi"`, { project: project() });
      expect(result.ok).toBe(false);
      expect(result.compiled).toBe("");
      expect(result.diagnostics[0]).toMatchObject({ source: "syntax", severity: "error" });
    });

    it("warns about unknown ids with a suggestion and about un-awaited calls", () => {
      const result = compileScript(`game.setSwitch("sw_dor", true);\ngame.showMessage("hi");\n`, { project: project() });
      expect(result.ok).toBe(true);
      const messages = result.diagnostics.map((entry) => entry.message);
      expect(messages.some((message) => message.includes('Unknown switch "sw_dor"') && message.includes('"sw_door"'))).toBe(true);
      expect(messages.some((message) => message.includes("is not awaited"))).toBe(true);
    });

    it("records computed ids as dynamic", () => {
      const result = compileScript(`const ids = ["lever_1", "lever_2"];\nfor (const id of ids) game.getSwitch(id);\n`, { project: project() });
      expect(result.effects.dynamic).toEqual([{ api: "getSwitch", line: 2 }]);
    });

    it("extracts ids from game.cmd objects", () => {
      const result = compileScript(`await game.cmd({ kind: "changeItem", itemId: "potion", op: "+=", amount: 1 });\n`, { project: project() });
      expect(result.effects.writes).toContainEqual({ kind: "item", id: "potion" });
    });

    it("type-checks and links @lib modules; non-library imports are errors", () => {
      const value = project();
      const lib = compileScript(`export function price(base: number, rep: number): number {\n  return Math.round(base * (1 - Math.min(rep, 50) / 100));\n}\n`, { project: value, libraryId: "shop" });
      expect(lib.ok).toBe(true);
      value.scriptLibrary = [{ id: "shop", source: `export function price(base: number, rep: number): number {\n  return Math.round(base * (1 - Math.min(rep, 50) / 100));\n}\n`, compiled: lib.compiled }];
      const good = compileScript(`import { price } from "@lib/shop";\ngame.setVar("cost", price(200, game.getVar("rep")));\n`, { project: value });
      expect(good.ok).toBe(true);
      expect(good.effects.calls).toContainEqual({ kind: "library", id: "shop" });
      const wrongType = compileScript(`import { price } from "@lib/shop";\nprice("200", 1);\n`, { project: value });
      expect(wrongType.ok).toBe(false);
      const bad = compileScript(`import fs from "fs";\n`, { project: value });
      expect(bad.ok).toBe(false);
    });

    it("compiled output runs in the sandbox", () => {
      const value = project();
      const result = compileScript(`const pick = await game.showChoices(["no", "yes"]);\nif (pick === 1) game.addGold(50);\n`, { project: value });
      const command = scriptCommandFields(`…`, result, "gift");
      const session: PlaySessionLike = {
        flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {}, partyActorIds: [],
        actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {}, currentMapId: value.startMapId, x: 0, y: 0, audio: {}, pictures: {},
      };
      const interpreter = createInterpreter([command], session, value);
      let step = interpreter.start();
      expect(step.kind).toBe("choices");
      step = interpreter.resume(1);
      expect(step.kind).toBe("done");
      expect(session.gold).toBe(50);
    });
  });
  describe("game .d.ts", () => {
    it("declares every API row and the project's ids", () => {
      const value = project();
      const dts = buildGameApiDts(scriptDtsIds(value, value.startMapId));
      for (const entry of SCRIPT_API) expect(dts).toContain(`  ${entry.name}(`);
      expect(dts).toContain('"sw_door"');
      expect(dts).toContain("declare const game: Game;");
    });

    it("inlined lib files match the installed typescript5 (regenerate with scripts/content/generate-script-ts-libs.mjs)", async () => {
      const fsName = "node:fs";
      const fs = (await import(fsName)) as { readFileSync: (path: string, encoding: "utf8") => string };
      const installed = JSON.parse(fs.readFileSync("node_modules/typescript5/package.json", "utf8")) as { version: string };
      expect(SCRIPT_TS_VERSION).toBe(installed.version);
      expect(Object.keys(SCRIPT_TS_LIB_SOURCES)).toContain(SCRIPT_TS_LIB_ENTRY);
      expect(SCRIPT_TS_LIB_SOURCES["lib.es5.d.ts"]).toBe(fs.readFileSync("node_modules/typescript5/lib/lib.es5.d.ts", "utf8"));
    });
  });
  describe("script persistence", () => {
    it("normalizeScriptLibrary drops bad rows and keeps good ones", () => {
      const library = normalizeScriptLibrary([
        { id: "shop", source: "export {}", compiled: "", name: " Shop " },
        { id: "Bad Id", source: "", compiled: "" },
        { id: "shop", source: "dup", compiled: "" },
        "junk",
      ]);
      expect(library).toEqual([{ id: "shop", source: "export {}", compiled: "", name: "Shop" }]);
      expect(normalizeScriptLibrary([])).toBeUndefined();
    });

    it("project scriptLibrary and script commands survive serialize → deserialize", () => {
      const value = project();
      value.scriptLibrary = [{ id: "shop", source: "export const a = 1;", compiled: "exports.a = 1;", sourceHash: "0123456789abcdef", apiVersion: 1 }];
      const map = value.maps[value.startMapId];
      if (!map) throw new Error("no start map");
      map.events.push({ id: "ev_s", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "script", source: "game.addGold(1)", compiled: "game.addGold(1);", name: "tip" }] });
      const restored = deserialize(serialize(value));
      expect(restored.scriptLibrary).toEqual(value.scriptLibrary);
      expect(restored.maps[value.startMapId]?.events.find((event) => event.id === "ev_s")?.commands).toEqual([
        { kind: "script", source: "game.addGold(1)", compiled: "game.addGold(1);", name: "tip" },
      ]);
    });
  });
});

// test/scriptInsight.test.ts — the plain-language reading of a script (src/editor/script/scriptInsight.ts) and the
// "명령으로 풀기" adapter (src/editor/script/scriptUnwrapAdapter.ts) behind the event list's script lines.
describe("scriptInsight", () => {
  isolateTimers();
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
});

// test/scriptSandbox.test.ts — runtime contract of the script sandbox (src/player/script/*).
// Hand-written JS (no compiler) so this file only exercises the QuickJS runtime and the interpreter bridge.
describe("scriptSandbox", () => {
  isolateTimers();
  beforeAll(async () => {
    await preloadScriptEngine();
  });
  function session(project: Project): PlaySessionLike {
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      actorExperience: {},
      actorLevels: {},
      actorEquipment: {},
      actorVitals: {},
      currentMapId: project.startMapId,
      x: 2,
      y: 3,
      audio: {},
      pictures: {},
    };
  }
  function run(compiled: string, options: { project?: Project; answers?: unknown[]; tail?: Command[]; seed?: (s: PlaySessionLike) => void } = {}) {
    const project = options.project ?? createBlankProject();
    const live = session(project);
    options.seed?.(live);
    const commands: Command[] = [{ kind: "script", source: "", compiled }, ...(options.tail ?? [{ kind: "setFlag", flag: "end", value: true }])];
    const interpreter = createInterpreter(commands, live, project);
    const answers = [...(options.answers ?? [])];
    const steps: StepResult[] = [];
    let step = interpreter.start();
    for (let guard = 0; step.kind !== "done" && guard < 500; guard++) {
      steps.push(step);
      step = interpreter.resume(answers.shift() as never);
    }
    const errors = steps.filter((entry) => entry.kind === "text" && entry.body.startsWith("[Script error")).map((entry) => (entry as { body: string }).body);
    return { session: live, steps, errors };
  }
  describe("script sandbox API table", () => {
    it("implements every SCRIPT_API row exactly once", () => {
      expect(Object.keys(HOST_API).sort()).toEqual(SCRIPT_API.map((entry) => entry.name).sort());
    });
  });
  describe("script sandbox isolation", () => {
    it("exposes no DOM, network, storage, timers or Node", () => {
      const { session: live, errors } = run(
        `game.setText("globals", [typeof window, typeof document, typeof fetch, typeof XMLHttpRequest, typeof localStorage, typeof setTimeout, typeof process, typeof require, typeof __host, typeof WebAssembly].join(","));`
      );
      expect(errors).toEqual([]);
      // `require` is the wrapper parameter for @lib imports; everything else is absent.
      expect(live.stringVariables?.globals).toBe("undefined,undefined,undefined,undefined,undefined,undefined,undefined,function,undefined,undefined");
    });

    it("game is frozen and cannot be replaced", () => {
      const { errors } = run(`"use strict"; game.setSwitch = () => {};`);
      expect(errors[0]).toMatch(/read-only|not writable|TypeError/u);
    });

    it("stops an infinite loop and continues the event", () => {
      const started = performance.now();
      const { session: live, errors } = run(`for (;;) {}`);
      expect(errors[0]).toContain("infinite loop");
      expect(live.flags.end).toBe(true);
      expect(performance.now() - started).toBeLessThan(5000);
    });

    it("stops runaway memory use", () => {
      const { session: live, errors } = run(`const parts = []; for (;;) parts.push({ x: parts.length, y: "s" + parts.length });`);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/memory|stopped/u);
      expect(live.flags.end).toBe(true);
    });

    it("reports an awaited promise that can never settle", () => {
      const { errors } = run(`await new Promise(() => {});`);
      expect(errors[0]).toContain("never finishes");
    });

    it("validates arguments with the API name in the message", () => {
      const { errors } = run(`game.setVar(42, 1);`);
      expect(errors[0]).toContain("game.setVar: id must be a non-empty string");
    });
  });
  describe("script determinism", () => {
    it("Math.random and game.random follow the saved game RNG", () => {
      const seeded = { seed: (s: PlaySessionLike) => { s.rng = createRngState(12345); } };
      const first = run(`game.setText("r", [Math.random(), game.random(100)].join("|"));`, seeded).session.stringVariables?.r;
      const second = run(`game.setText("r", [Math.random(), game.random(100)].join("|"));`, seeded).session.stringVariables?.r;
      expect(first).toBeTruthy();
      expect(first).toBe(second);
    });

    it("Date is the play clock, not the wall clock", () => {
      const { session: live } = run(`game.setVar("year", new Date().getUTCFullYear()); game.setVar("now", Date.now() - Date.UTC(2000, 0, 1));`, {
        seed: (s) => { s.playTimeSeconds = 90; },
      });
      expect(live.variables.year).toBe(2000);
      expect(live.variables.now).toBe(90_000);
    });
  });
  describe("script awaitables", () => {
    it("cancelled choices resolve -1 when settings.cancel is 'cancel'", () => {
      const { session: live, steps } = run(`game.setVar("pick", await game.showChoices(["a", "b"], { cancel: "cancel" }));`, { answers: [-1] });
      expect(steps[0]).toMatchObject({ kind: "choices", cancelBehavior: "branch" });
      expect(live.variables.pick).toBe(-1);
    });

    it("inputNumber returns the number and leaves no reserved variable", () => {
      const { session: live } = run(`game.setVar("code", await game.inputNumber({ digits: 4 }));`, { answers: [1234] });
      expect(live.variables.code).toBe(1234);
      expect(live.variables.__script_result).toBeUndefined();
    });

    it("battle resolves with the session battle result", () => {
      const { session: live, steps } = run(`game.setText("result", await game.battle("troop_x", { canLose: true }));`, {
        answers: ["escape"],
        seed: (s) => { s.battleResult = "escape"; },
      });
      expect(steps[0]).toMatchObject({ kind: "battleProcessing", troopId: "troop_x", canLose: true });
      expect(live.stringVariables?.result).toBe("escape");
    });

    it("transfer ends the event like the Transfer command", () => {
      const project = createBlankProject();
      const { session: live, steps } = run(`await game.transfer("${project.startMapId}", 1, 1); game.setSwitch("after", true);`, { project });
      expect(steps.map((step) => step.kind)).toEqual(["transfer"]);
      expect(live.switches.after).toBeUndefined();
      expect(live.flags.end).toBeUndefined();
    });

    it("un-awaited calls still run in call order", () => {
      const { steps } = run(`game.showMessage("one"); game.showMessage("two");`);
      expect(steps.map((step) => (step as { body?: string }).body)).toEqual(["one", "two"]);
    });

    it("game.cmd runs any event command and rejects invalid ones", () => {
      const ok = run(`await game.cmd({ kind: "changeGold", op: "+=", amount: 7 });`);
      expect(ok.session.gold).toBe(7);
      const bad = run(`await game.cmd({ kind: "nope" });`);
      expect(bad.errors[0]).toContain("game.cmd");
    });

    it("callCommonEvent runs the common event before the script continues", () => {
      const project = createBlankProject();
      project.commonEvents.push({ id: "ce_bonus", name: "bonus", trigger: "none", commands: [{ kind: "changeGold", op: "+=", amount: 5 }] } as never);
      const { session: live } = run(`await game.callCommonEvent("ce_bonus"); game.setVar("gold", game.gold());`, { project });
      expect(live.variables.gold).toBe(5);
    });
  });
  describe("script library modules", () => {
    it("require('@lib/<id>') loads the compiled library", () => {
      const project = createBlankProject();
      project.scriptLibrary = [{ id: "shop", source: "export const price = …", compiled: `"use strict"; exports.price = (base, rep) => Math.round(base * (1 - rep / 100));` }];
      const { session: live, errors } = run(`const shop = require("@lib/shop"); game.setVar("price", shop.price(200, 25));`, { project });
      expect(errors).toEqual([]);
      expect(live.variables.price).toBe(150);
    });

    it("unknown or non-library imports fail visibly", () => {
      expect(run(`require("@lib/missing");`).errors[0]).toContain("does not exist");
      expect(run(`require("fs");`).errors[0]).toContain("Only project library modules");
    });
  });
  describe("script logging and detection", () => {
    it("game.log and console.log reach the script log", () => {
      run(`game.log("hello", { a: 1 }); console.log("world");`);
      const messages = readScriptLog().map((entry) => entry.message);
      expect(messages).toContain('hello {"a":1}');
      expect(messages).toContain("world");
    });

    it("projectUsesScripts finds scripts in pages, branches and common events", () => {
      const project = createBlankProject();
      expect(projectUsesScripts(project)).toBe(false);
      project.commonEvents.push({ id: "ce", name: "ce", trigger: "none", commands: [{ kind: "choices", options: [{ text: "a", branch: [{ kind: "script", source: "", compiled: "1" }] }] }] } as never);
      expect(projectUsesScripts(project)).toBe(true);
    });
  });
});
