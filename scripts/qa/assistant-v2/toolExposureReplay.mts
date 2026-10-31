// 기록된 모델 호출(turns/*.json toolArgs — 모델이 직접 부른 것)을 새 v2 도구 노출(src/ai/v2/toolExposure.ts)에 다시 대 본다.
//   bun scripts/qa/assistant-v2/toolExposureReplay.mts [runRoot …]   (기본: ~/z-project/assistant-whole-game/suite 의 scenes/runs · scenes-duel · runs)
// 세는 것:
//   - 호출마다: 처음부터 실림 / 필요할 때 실림(load_tools·이름 호출로 닿음) / 닿지 않음. «닿지 않음» 중 예전 노출에선 닿던 것 = 회귀(0 이어야 한다).
//   - 인자 검증: 예전 광고 스키마가 받던 인자를 새 광고 스키마(영어 사본·같은 모양 걷기)가 거절하면 회귀(0 이어야 한다). 검증기는 실행기와 같은 pi-ai validateToolArguments.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { validateToolArguments } from "@oh-my-pi/pi-ai";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { withTodoLoop } from "../../../src/ai/v2/loop/todoTools.ts";
import { exposeV2Tools } from "../../../src/ai/v2/toolExposure.ts";
import { v2ExtraToolNames, wantsGameTools } from "../../../src/ai/v2/game.ts";
import { musicOnly } from "../../../src/ai/v2/musicWords.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { PiToolShape } from "../../../src/ai/piAgent/toolAdapter.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const base = join(homedir(), "z-project/assistant-whole-game/suite");
const roots = process.argv.slice(2).length ? process.argv.slice(2) : ["scenes/runs", "scenes-duel", "runs"].map((r) => join(base, r));

function* turnFiles(dir: string): Generator<string> {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* turnFiles(p);
    else if (e.endsWith(".json") && dir.endsWith("/turns")) yield p;
  }
}
const modelOf = (p: string) => p.includes("terra") ? "terra" : p.includes("opus") ? "opus" : undefined;

interface Built { readonly before: Map<string, PiToolShape>; readonly upFront: Map<string, PiToolShape>; readonly lazy: ReadonlyMap<string, PiToolShape> }
const cache = new Map<string, Built>();
function build(task: string): Built {
  const hit = cache.get(task); if (hit) return hit;
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env: PiAssistantV2Env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} };
  const all = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  // 예전 노출 = 이 요청 묶음(v2 동사 + v2ExtraToolNames)을 다 싣는다(v2ToolPool 은 이번에 더한 것이라 뺀다).
  const offered = new Set(v2ExtraToolNames(task));
  const pooled = wantsGameTools(task) && !musicOnly(task);
  const before = new Map(all.filter((t) => !pooled || !isRegistry(t.name) || offered.has(t.name)).map((t) => [t.name, t]));
  const exp = exposeV2Tools(env, all);
  const built = { before, upFront: new Map(exp.tools.map((t) => [t.name, t])), lazy: exp.lazy };
  cache.set(task, built);
  return built;
}
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
const isRegistry = (name: string) => { try { return !!getTool(name); } catch { return false; } };

const accepts = (tool: PiToolShape, args: unknown): boolean => {
  try { validateToolArguments(tool as never, { type: "toolCall", id: "r", name: tool.name, arguments: (args ?? {}) as Record<string, unknown> } as never); return true; } catch { return false; }
};

const count = { calls: 0, upFront: 0, lazy: 0, unreachable: 0, unreachableBefore: 0, regressions: 0, argOldOk: 0, argNewOk: 0, argRegressions: 0 };
const perModel: Record<string, { calls: number; upFront: number; lazy: number }> = {};
const lazyHits = new Map<string, number>();
const regressions: string[] = []; const argRegressions: string[] = []; const unreachableNames = new Map<string, number>();
for (const root of roots) for (const file of turnFiles(root)) {
  const model = modelOf(file); if (!model) continue;
  let turn: { input?: string; toolArgs?: { name: string; args: unknown }[] };
  try { turn = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }
  const task = String(turn.input ?? "");
  if (!turn.toolArgs?.length) continue;
  const b = build(task);
  const pm = perModel[model] ??= { calls: 0, upFront: 0, lazy: 0 };
  for (const call of turn.toolArgs) {
    count.calls++; pm.calls++;
    const now = b.upFront.get(call.name) ?? b.lazy.get(call.name);
    if (b.upFront.has(call.name)) { count.upFront++; pm.upFront++; }
    else if (b.lazy.has(call.name)) { count.lazy++; pm.lazy++; lazyHits.set(call.name, (lazyHits.get(call.name) ?? 0) + 1); }
    else {
      count.unreachable++; unreachableNames.set(call.name, (unreachableNames.get(call.name) ?? 0) + 1);
      if (b.before.has(call.name)) { count.regressions++; regressions.push(`${call.name} ← ${file}`); }
      else count.unreachableBefore++;
    }
    const old = b.before.get(call.name);
    if (old && now) {
      const o = accepts(old, call.args); const n = accepts(now, call.args);
      if (o) count.argOldOk++;
      if (n) count.argNewOk++;
      if (o && !n) { count.argRegressions++; argRegressions.push(`${call.name} ← ${file}`); }
    }
  }
}
console.log(JSON.stringify({ ...count, perModel, distinctTasks: cache.size }, null, 1));
console.log("on-demand hits (called by name, would load on first use):", [...lazyHits].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}×${c}`).join(" "));
console.log("unreachable names (also unreachable before):", [...unreachableNames].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}×${c}`).join(" "));
if (regressions.length) console.log("REACH REGRESSIONS:\n" + regressions.slice(0, 20).join("\n"));
if (argRegressions.length) console.log("ARG REGRESSIONS:\n" + argRegressions.slice(0, 20).join("\n"));
