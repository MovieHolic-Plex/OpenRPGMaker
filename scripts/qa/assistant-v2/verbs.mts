// 조수 v2 동사 연기 시험(모델 없이 동사만): make_place → 그림·검사·비평 → edit_place, 이미 지은 방 고치기(입양).
//   bun scripts/qa/assistant-v2/verbs.mts <outDir> [--critic]   (--critic 이면 로컬 claude CLI(sonnet)로 실제 비평가를 부른다)
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { createV2Tools, V2Session, v2FinishGate } from "../../../src/ai/v2/verbs.ts";
import { buildV2SystemPrompt } from "../../../src/ai/v2/prompt.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { LOCAL_CLI_ADAPTERS, localCliBinary } from "../../lib/localCliAgent/registry.ts";

const out = process.argv[2] ?? "qa-runs/v2scratch/verbs";
const realCritic = process.argv.includes("--critic");
fs.mkdirSync(out, { recursive: true });

function crop(project: ToolContext["project"], mapId: string): string {
  const map = project.maps[mapId]!;
  return `data:image/png;base64,${Buffer.from(renderMapPng(project, map).png).toString("base64")}`;
}

async function sideChat(messages: readonly unknown[]): Promise<string> {
  const images: { mimeType: string; data: string }[] = [];
  const text = messages.map((message) => {
    const m = message as { content?: unknown };
    return Array.isArray(m.content) ? m.content.map((part) => {
      const p = part as { type?: string; text?: string; image_url?: { url?: string } };
      const match = p.type === "image_url" ? /^data:(image\/[a-z+.-]+);base64,(.+)$/isu.exec(p.image_url?.url ?? "") : null;
      if (match) { images.push({ mimeType: match[1]!, data: match[2]! }); return `[그림 ${images.length}]`; }
      return p.text ?? "";
    }).join("\n") : String(m.content ?? "");
  }).join("\n\n");
  if (!realCritic) return JSON.stringify({ imagesSeen: images.length, axes: { composition: 7, view: 8, doors: 8 }, score: 7, majors: [] });
  return LOCAL_CLI_ADAPTERS.claude.complete(text, { binary: localCliBinary("claude"), model: "sonnet", images });
}

async function scenario(name: string, setup: (ctx: ToolContext) => void, calls: { tool: string; args: unknown }[], task: string) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  setup(ctx);
  const session = new V2Session();
  const log: string[] = [];
  const env: PiAssistantV2Env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never,
    emit: (e) => log.push(`event ${e.type} ${(e as { summary?: string }).summary ?? ""}`),
    record: (r) => log.push(`record ${r.name} ok=${r.result.ok} logs=${r.constructionLogs?.length ?? 0} — ${String(r.result.summary).slice(0, 160)}`),
    sideChat,
    render: async (mapId) => crop(ctx.project, mapId),
    checkpoint: async (label) => { log.push(`checkpoint ${label}`); },
  };
  const tools = createV2Tools(env, session);
  console.log(`\n### ${name}  (system prompt ${buildV2SystemPrompt(ctx.project, ctx.currentMapId).join("\n").length} chars)`);
  let i = 0;
  for (const call of calls) {
    const tool = tools.find((t) => t.name === call.tool)!;
    const t0 = Date.now();
    const res = await tool.execute(`c${++i}`, call.args);
    const textPart = res.content.find((c) => c.type === "text") as { text: string };
    const parsed = JSON.parse(textPart.text) as Record<string, unknown>;
    console.log(`-- ${call.tool} ${Date.now() - t0}ms images=${res.content.filter((c) => c.type === "image").length}`);
    console.log(JSON.stringify(parsed).slice(0, 1500));
    for (const [n, c] of res.content.entries()) if (c.type === "image") fs.writeFileSync(path.join(out, `${name}-${i}-${n}.png`), Buffer.from((c as { data: string }).data, "base64"));
  }
  console.log("gate:", v2FinishGate(session) ?? "(통과 — 더 돌지 않음)");
  console.log(log.join("\n"));
}

await scenario("tavern", () => {}, [
  { tool: "make_place", args: { spec: { type: "interior", name: "참나무 선술집", zones: [{ kind: "tavern", purpose: "손님 홀", anchors: ["바 카운터", "벽난로", "올라가는 계단"] }, { kind: "kitchen", purpose: "부엌" }] } } },
  { tool: "edit_place", args: { patch: { mapId: "map_blank_start", dressing: 2 } } },
], "아늑한 선술집을 만들어 줘. 바 카운터와 벽난로, 2층 손님방으로 가는 계단이 있어야 해.");

await scenario("edit-existing", (ctx) => {
  const r = getTool("build_hand_interior_room")!.run(ctx.project, { mapId: "map_blank_start", name: "선술집", layout: { rooms: [{ kind: "tavern" }, { kind: "kitchen" }] } }) as { ok: boolean; summary: string };
  console.log("setup:", r.ok, String(r.summary).slice(0, 120));
}, [
  { tool: "edit_place", args: { patch: { mapId: "map_blank_start", dressing: 2, set: { exits: ["south", "north"] } } } },
], "이 방을 좀 더 아늑하게 꾸며 주고, 뒤쪽(북쪽 벽)에 뒷문도 하나 내 줘.");

await scenario("village", () => {}, [
  { tool: "make_place", args: { spec: { type: "village", name: "버들 마을", size: "medium", theme: "river", features: ["plaza", "fields"] } } },
], "강가에 있는 작은 마을을 만들어 줘. 광장과 밭이 있으면 좋겠어.");

await scenario("dungeon", () => {}, [
  { tool: "make_place", args: { spec: { type: "dungeon", name: "옛 지하묘지", theme: "catacomb", floors: 2, features: ["boss", "chests"] } } },
], "2층짜리 지하묘지 던전을 만들어 줘. 맨 아래에 보스, 보물상자도.");
