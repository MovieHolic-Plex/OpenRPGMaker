// 실내 칸 배치(spec.layout) 손 시험 — 모델 없이 칸 배치 JSON 으로 make_place 를 부르고, 거절 글(Rejected/You sent/Fixed call)·고치기 소진 뒤 빼고 깔기·
// 맵 위치 기록·할 일 검사(layout_built·room_graph)·1배 그림을 찍는다.
//   bun scripts/qa/assistant-v2/layoutProbe.mts <snapshot.json> <layout.json> [outDir]
import fs from "node:fs";
import { loadHeadlessProject } from "../../../src/headless/index.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { runTodoCheck } from "../../../src/ai/v2/todo/checks.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const [snap, lf, out = "/tmp/layout-probe"] = process.argv.slice(2);
if (!snap || !lf) { console.error("usage: layoutProbe.mts <snapshot.json> <layout.json> [outDir]"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const layout = JSON.parse(fs.readFileSync(lf, "utf8"));
// 벽 우선 실험 배치(agent/bbox-walls)엔 landmark 칸이 없다 — 첫 기물을 랜드마크로 삼고 objects 에도 그대로 남겨 «같은 것 두 번 = 하나» 를 같이 본다.
if (layout.outer_wall && !layout.landmark && layout.objects?.length) layout.landmark = { ...layout.objects[0], purpose: "probe landmark" };
const fresh = () => {
  const project = loadHeadlessProject(fs.readFileSync(snap, "utf8"));
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task: "작은 마을 여관 1층을 만들어 줘. 다른 맵은 만들지 말고 이 장소 하나만 지어 줘.", provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", checkpoint: async () => {} } as unknown as PiAssistantV2Env;
  const tools = createV2Tools(env, new V2Session());
  const call = async (name: string, args: unknown) => { const r = await tools.find((t) => t.name === name)!.execute("p", args); return JSON.parse((r.content[0] as { text: string }).text); };
  return { env, call };
};

// 1) 좋은 배치
{
  const { env, call } = fresh();
  const made = await call("make_place", { spec: { type: "interior", name: "Probe Inn", layout } });
  console.log(`[good] ok=${made.ok} map=${made.mapIds?.[0]}\n  summary=${String(made.summary).slice(0, 400)}\n  warnings=${JSON.stringify(made.warnings ?? []).slice(0, 600)}`);
  const mapId = made.mapIds?.[0];
  if (mapId) {
    const m = env.ctx.project.maps[mapId]!;
    for (const l of m.locations ?? []) console.log("  loc", l.name, l.x, l.y, l.w, l.h, (l.tags ?? []).join("|").slice(0, 200));
    for (const kind of ["layout_built", "room_graph"] as const) console.log(`  ${kind}`, JSON.stringify(runTodoCheck(env.ctx.project, { kind, map: "Probe Inn" }, { refs: { mapIds: [mapId] } })).slice(0, 600));
    fs.writeFileSync(`${out}/good.png`, renderMapPng(env.ctx.project, m, 2).png);
    // 자기 검토 두 바퀴: 1) 기물 하나 빼기 2) 빈 고침 → layout_review ✓
    const first = (layout.objects ?? [])[1];
    const r1 = await call("review_layout", { mapId, problems: ["probe: one piece removed"], patch: first ? { remove_objects: [{ id: first.id, x: first.x, y: first.y }] } : {} });
    console.log(`[review 1] ok=${r1.ok} ${String(r1.summary).slice(0, 200)}`);
    console.log("  layout_review", JSON.stringify(runTodoCheck(env.ctx.project, { kind: "layout_review", map: "Probe Inn" }, { refs: { mapIds: [mapId] } })).slice(0, 300));
    const r2 = await call("review_layout", { mapId, problems: [], patch: { remove_objects: [{ id: "", x: 0, y: 0 }], add_objects: [] } });
    console.log(`[review 2] ok=${r2.ok} ${String(r2.summary).slice(0, 200)}`);
    console.log("  layout_review", JSON.stringify(runTodoCheck(env.ctx.project, { kind: "layout_review", map: "Probe Inn" }, { refs: { mapIds: [mapId] } })).slice(0, 300));
    console.log("  layout_built", JSON.stringify(runTodoCheck(env.ctx.project, { kind: "layout_built", map: "Probe Inn" }, { refs: { mapIds: [mapId] } })).slice(0, 300));
    const bad = await call("edit_place", { patch: { mapId, layoutPatch: { remove_objects: [{ id: "golden unicorn", x: 1, y: 1 }] } } });
    console.log(`[layoutPatch bad] ok=${bad.ok} ${String(bad.summary).slice(0, 300)}`);
    // 상한: 다시 짓기 4번째도 막히지 않아야 한다
    for (let k = 0; k < 3; k++) { const r = await call("review_layout", { mapId, problems: [], patch: {} }); console.log(`[review ${k + 3}] ok=${r.ok} ${String(r.summary).slice(0, 120)}`); }
    fs.writeFileSync(`${out}/reviewed.png`, renderMapPng(env.ctx.project, env.ctx.project.maps[mapId]!, 2).png);
  }
}
// 2) 틀린 배치: 없는 id·겹침 → 거절 셋, 넷째는 걸린 기물을 빼고 깐다
{
  const { env, call } = fresh();
  const bad = { ...layout, objects: [...(layout.objects ?? []), { id: "golden unicorn", x: 3, y: 8 }, { ...(layout.objects?.[0] ?? {}) }] };
  for (let i = 0; i < 4; i++) {
    const r = await call("make_place", { spec: { type: "interior", name: "Probe Bad", layout: bad } });
    console.log(`\n[bad ${i}] ok=${r.ok} ${String(r.summary).slice(0, i === 0 ? 1400 : 300)}${r.ok ? `\n  warnings=${JSON.stringify(r.warnings ?? []).slice(0, 400)}` : ""}`);
    if (r.ok) { const id = r.mapIds[0]; fs.writeFileSync(`${out}/bad-dropped.png`, renderMapPng(env.ctx.project, env.ctx.project.maps[id]!, 2).png); break; }
  }
}
// 3) 던전으로 보낸 감옥 → 실내 길(배치 없으면 되돌려 보냄)
{
  const { call } = fresh();
  const r = await call("make_place", { spec: { type: "dungeon", name: "성 지하 감옥", theme: "감방과 간수" } });
  console.log(`\n[jail as dungeon] ok=${r.ok} notFailure=${r.notFailure} ${String(r.summary).slice(0, 300)}`);
}
