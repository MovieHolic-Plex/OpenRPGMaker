// 게임 하나를 짓는 v2 턴(첫 화면 «회상 형 게임 만들어 줘» + 회상 스토리)에 모델이 받는 도구마다 작업 표시가 무엇이라고 쓰는지 센다(모델 호출 없음).
// qa1124 측정 판을 정식화: 영어 원문 이름표 수, «작업을 진행하는 중» 일반 문구 수.
//   npx vite-node --script scripts/qa/assistant-ui/toolLabelCoverage.mts [outDir]
import fs from "node:fs";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { buildWelcomeFreeTextPrompt } from "@/editor/welcomeGenrePresets";
import { toolLabel } from "@/editor/panels/aiToolLabels";
import { aiActivityActionLabel } from "@/editor/aiActivityNarration";
import { isQuietTool } from "@/editor/panels/aiLiveStatus";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { ToolContext } from "@/editor/tools/types";

const GENERIC = "작업을 진행하는 중";
const out = process.argv.slice(2).find((arg) => arg !== "--") ?? "/tmp/tool-label-coverage";
fs.mkdirSync(out, { recursive: true });
const project = createNewProjectSeed("story-cutscene" as never);
const task = buildWelcomeFreeTextPrompt("회상 형 게임 만들어 줘", { label: "회상 스토리", tone: "투더문식 회상" });
const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
const session = new V2Session();
const env: PiAssistantV2Env = {
  ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never,
  emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
} as never;
const exposure = exposeV2Tools(env, withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks));
const names = [...new Set([...exposure.tools.map((t) => t.name), ...exposure.lazy.keys()])].sort();
const rows = names.map((name) => {
  const label = toolLabel(name);
  return { name, quiet: isQuietTool(name), rawLabel: label === name.replace(/_/gu, " "), label, action: aiActivityActionLabel(name, false, label) };
});
const shown = rows.filter((r) => !r.quiet);
const summary = {
  tools: rows.length, quiet: rows.filter((r) => r.quiet).length, shownInSteps: shown.length,
  shownWithRawEnglishLabel: shown.filter((r) => r.rawLabel).length,
  shownWithGenericAction: shown.filter((r) => r.action === GENERIC).length,
  rawExamples: shown.filter((r) => r.rawLabel).map((r) => r.name),
  genericExamples: shown.filter((r) => r.action === GENERIC).map((r) => r.name),
};
fs.writeFileSync(`${out}/labels.json`, JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 1));
