// Read-only probe: which of the B7 tools are up-front for a game request, before/after the change.
//   vite-node --script ../../../.dori/state/lanes/terra-experiments-123/run/probe-exposure.mts -- "<task>"
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { exposeV2Tools } from "../../../src/ai/v2/toolExposure.ts";
import { v2ExtraToolNames } from "../../../src/ai/v2/game.ts";

const raw = process.argv.slice(2).filter((a) => a !== "--");
const task = raw[0] ?? "재밌는 게임 만들어 줘.";
const project = createBlankProject();
const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "openai-compat:opencodex", mapIds: [], project },
  emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, lazyToolsVia: "tool" } as never;
const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
const upFront = exposure.tools.map((t) => t.name);
const offered = new Set(v2ExtraToolNames(task));
const probe = ["upsert_item", "compile_puzzle", "place_npc", "upsert_enemy", "set_title_screen"];
console.log(JSON.stringify({
  task, upFrontCount: upFront.length,
  perTool: Object.fromEntries(probe.map((n) => [n, { upFront: upFront.includes(n), offered: offered.has(n), lazy: exposure.lazy.has(n) }])),
}, null, 1));
