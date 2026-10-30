// Print what the v2 model reads: the system prompt (for a few task shapes), every knowledge card, and the tool list
// (name · description · parameter schema). v1 registry tools (game tools) are marked [v1] — their text is v1-owned.
//   bun scripts/qa/assistant-v2/dumpPrompt.mts > /tmp/v2-prompt-after.txt
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { buildV2SystemPrompt, V2_CORE_PROMPT, V2_CARDS } from "../../../src/ai/v2/prompt.ts";
import { withTodoLoop } from "../../../src/ai/v2/loop/todoTools.ts";
import { MONSTER_TOWN_CARD } from "../../../src/ai/v2/builders/monsterTown.ts";
import { JOSEON_CARD } from "../../../src/ai/v2/builders/joseon.ts";
import { WIZARDING_CARD } from "../../../src/ai/v2/builders/wizarding.ts";
import { SCENE_CARD } from "../../../src/ai/v2/scene.ts";
import { BLUEPRINT_CARD } from "../../../src/ai/v2/blueprint.ts";
import { MAKE_GAME_CARD } from "../../../src/ai/v2/makeGame.ts";
import { GAME_CARD, TERRAIN_CARD, MUSIC_TIER, FALLEN_TIERS, storeTierCard } from "../../../src/ai/v2/game.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const TASKS = [
  "아늑한 선술집을 만들어 줘. 바 카운터와 벽난로가 있어야 해.",
  "공포 게임 하나 만들어 줘 — 폐교 탐험, 단서와 금고, 보스 전투, 엔딩, 상점, 퀘스트, 배경음악, 강과 다리, 스토어 그림.",
];
const out: string[] = [];
const hr = (t: string) => out.push(`\n================ ${t} ================`);
// rough token estimate: Hangul chars count ~1/1.5 token, everything else ~1/4.
const hangul = (s: string) => (s.match(/[ㄱ-ㆎ가-힣]/gu) ?? []).length;
const est = (s: string) => Math.round(hangul(s) / 1.5 + (s.length - hangul(s)) / 4);
const stats: string[] = [];
const stat = (label: string, s: string) => stats.push(`${label}: chars ${s.length} · hangul ${hangul(s)} · est tokens ${est(s)}`);

hr("CORE PROMPT");
out.push(V2_CORE_PROMPT);
hr("ALWAYS CARDS");
out.push(...V2_CARDS);
stat("core prompt", V2_CORE_PROMPT);
stat("always cards", V2_CARDS.join("\n"));
hr("CONDITIONAL CARDS");
const condStart = out.length;
out.push(MONSTER_TOWN_CARD, JOSEON_CARD, WIZARDING_CARD, SCENE_CARD, BLUEPRINT_CARD, MAKE_GAME_CARD, GAME_CARD, TERRAIN_CARD, MUSIC_TIER.card);
for (const t of FALLEN_TIERS) if (t.card) out.push(t.card);
out.push(storeTierCard("스토어에서 그림과 음악을 찾아 넣어 줘"));
stat("conditional cards (all)", out.slice(condStart).join("\n"));

for (const task of TASKS) {
  const project = createBlankProject();
  hr(`SYSTEM PROMPT for task: ${task}`);
  const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
  out.push(sys);
  stat(`system prompt [${task.slice(0, 20)}…]`, sys);
}

for (const task of TASKS) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env: PiAssistantV2Env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never,
    emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
  };
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  hr(`TOOLS (${tools.length}) for task: ${task}`);
  const v2Text: string[] = []; const v1Text: string[] = [];
  for (const t of tools) {
    const v1 = getTool(t.name) ? " [v1]" : "";
    const line = `--- ${t.name}${v1}\n${t.description}\n${JSON.stringify(t.parameters)}`;
    out.push(line);
    (v1 ? v1Text : v2Text).push(line);
  }
  stat(`v2 tools (${v2Text.length}) [${task.slice(0, 20)}…]`, v2Text.join("\n"));
  stat(`v1 tools (${v1Text.length}) [${task.slice(0, 20)}…]`, v1Text.join("\n"));
}

out.push("\n================ SIZE ================", ...stats);
process.stdout.write(out.join("\n") + "\n");
process.stderr.write(stats.join("\n") + "\n");
