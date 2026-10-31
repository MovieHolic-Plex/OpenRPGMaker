// Script A/B PoC — print what the v2 model would see for each request with the script switch on/off.
//   OPRN_V2_SCRIPTS=0 bun scripts/qa/script-ab/exposure.mts   (B arm)
//   bun scripts/qa/script-ab/exposure.mts                     (A arm)
import { readFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { buildV2SystemPrompt } from "../../../src/ai/v2/prompt.ts";
import { withTodoLoop } from "../../../src/ai/v2/loop/todoTools.ts";
import { exposeV2Tools } from "../../../src/ai/v2/toolExposure.ts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const prompts = JSON.parse(readFileSync(new URL("./prompts.json", import.meta.url), "utf8")).prompts as { id: string; text: string }[];
const SCRIPT = /script/i;
for (const { id, text } of prompts) {
  const project = createBlankProject();
  const sys = buildV2SystemPrompt(project, project.startMapId, text).join("\n");
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env: PiAssistantV2Env = { ctx, request: { task: text, provider: "local-cli:claude", mapIds: [], project } as never,
    emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} };
  const exposure = exposeV2Tools(env, withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks));
  const upFront = exposure.tools.map((t) => t.name).filter((n) => SCRIPT.test(n));
  const lazy = [...exposure.lazy.keys()].filter((n) => SCRIPT.test(n));
  const lines = sys.split("\n").filter((l) => /author_script|script command|event-scripts|game\.random/i.test(l)).map((l) => l.slice(0, 90));
  console.log(JSON.stringify({ id, scriptsEnv: process.env.OPRN_V2_SCRIPTS ?? "(unset)", sysChars: sys.length, upFrontScriptTools: upFront, lazyScriptTools: lazy,
    getTool_author_script: Boolean(getTool("author_script")), scriptPromptLines: lines }));
}
