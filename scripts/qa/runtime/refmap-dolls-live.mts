// 실제 모델이 REFMAP 변형 인물 칩(RefmapDoll<n>)을 불러오는지 본다 — OpenAI 호환 끝점 하나, 조수의 진짜 도구 스키마(list_npc_graphics·place_npc)와 runTool.
// 판타지 새 프로젝트에 말로 부탁한 사람들을 놓게 하고, 놓인 NPC 그림이 RefmapDoll 칸인지 센다. 키는 출력하지 않는다(네트워크 의존, CI 밖).
//
//   OPRN_LIVE_BASE_URL=http://127.0.0.1:10200/v1 OPRN_LIVE_MODEL=klb/claude-opus-5.5 \
//     npx vite-node --script scripts/qa/runtime/refmap-dolls-live.mts [--json out.json]
import { writeFileSync } from "node:fs";
import { toolSchemasForNames } from "@/ai/planToolExposure";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const BASE = process.env.OPRN_LIVE_BASE_URL ?? "http://127.0.0.1:10200/v1";
const MODEL = process.env.OPRN_LIVE_MODEL ?? "klb/claude-opus-5.5";
const KEY = process.env.OPRN_LIVE_API_KEY ?? "oprn-no-key";
const ASKS = [
  "시작 맵에 여관 메이드 한 명과 수염 난 늙은 상인 한 명을 놓아 줘. 둘 다 인사 한마디씩.",
  "빨간 머리 여자 기사를 시작 맵 (6, 4)에 세워 줘.",
  "어린 소녀와 귀족 아가씨를 시작 맵에 놓고 각자 대사 하나.",
];

type Msg = { role: string; content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string };
const tools = toolSchemasForNames(["list_npc_graphics", "place_npc"]);

async function chat(messages: Msg[]): Promise<Msg> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages, tools }),
    });
    if (res.ok) return ((await res.json()) as { choices: { message: Msg }[] }).choices[0]!.message;
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) { await new Promise((r) => setTimeout(r, 15_000)); continue; }
    throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

const runs = [];
for (const ask of ASKS) {
  const project: Project = createBlankProject();
  const ctx: { project: Project; currentMapId: string; assistantRun: true } = { project, currentMapId: project.startMapId, assistantRun: true as const };
  const messages: Msg[] = [
    { role: "system", content: `너는 RPG 에디터의 조수다. 도구로만 프로젝트를 바꾼다. 시작 맵 id 는 ${project.startMapId} 이다. 사람 그림은 list_npc_graphics 로 고른 칸을 graphic 에 그대로 쓴다.` },
    { role: "user", content: ask },
  ];
  const calls: string[] = [];
  for (let turn = 0; turn < 10; turn++) {
    const reply = await chat(messages);
    messages.push(reply);
    if (!reply.tool_calls?.length) break;
    for (const call of reply.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* 빈 인자 */ }
      const result = runTool(ctx, call.function.name, args, { dryRun: false });
      calls.push(`${call.function.name} ${result.ok ? "ok" : "FAIL"} ${JSON.stringify(args).slice(0, 160)}`);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 8000) });
    }
  }
  const map = ctx.project.maps[project.startMapId]!;
  const npcs = (map.events ?? []).map((e) => {
    const g = JSON.stringify((e.pages?.[0] as { graphic?: unknown } | undefined)?.graphic ?? {});
    const doll = /refmap[_-]doll(\d+)/u.exec(g);
    return { name: e.name, graphic: g.slice(0, 160), doll: !!doll, sheet: doll ? `RefmapDoll${doll[1]}` : "" };
  });
  runs.push({ ask, calls, npcs, answer: String(messages.at(-1)?.content ?? "").slice(0, 300) });
  console.log(`\n${ask}\n  ${calls.join("\n  ")}\n  → ${npcs.map((n) => `${n.name}: ${n.sheet || n.graphic}`).join(", ")}`);
}
const summary = { model: MODEL, asks: runs.length, npcs: runs.flatMap((r) => r.npcs).length, dollNpcs: runs.flatMap((r) => r.npcs).filter((n) => n.doll).length };
console.log(JSON.stringify(summary));
const out = process.argv.indexOf("--json");
if (out >= 0) writeFileSync(process.argv[out + 1]!, JSON.stringify({ summary, runs }, null, 1));
