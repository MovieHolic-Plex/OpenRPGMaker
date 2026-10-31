// 방 그래프 손 시험 — 모델 없이 방 그래프(zones x·y·landmark·stairs + connections)로 make_place 를 부르고,
// 조화 결과(방 사각형·연결)·room-graph 이름표·room_graph 검사·방별 빈 바닥·지문 거절을 찍는다.
//   bun scripts/qa/assistant-v2/roomGraphProbe.mts <snapshot.json> [outDir]
import fs from "node:fs";
import { loadHeadlessProject } from "../../../src/headless/index.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { runTodoCheck } from "../../../src/ai/v2/todo/checks.ts";
import { harmonizeRoomGraph, RoomGraphError } from "../../../src/editor/handInterior/roomGraph.ts";
import { copiedReference, ROOM_IDEAS } from "../../../src/ai/v2/roomIdeas.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const [snap, out = "/tmp/room-graph-probe"] = process.argv.slice(2);
if (!snap) { console.error("usage: roomGraphProbe.mts <snapshot.json> [outDir]"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
let seed = 7; Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };

// 1) 조화기 단독: 자리 어긋남·충돌·입구 남쪽·고립 방
const r = (id: string, w: number, h: number, x: number, y: number) => ({ id, kind: "study", w, h, x, y });
const tryG = (label: string, g: Parameters<typeof harmonizeRoomGraph>[0]) => {
  try { const o = harmonizeRoomGraph(g); console.log(`[harmonize] ${label}: ${o.width}x${o.height} rooms=${o.rooms.map((q) => `${q.id}(${q.x0},${q.y0}-${q.x1},${q.y1})`).join(" ")} exit=${JSON.stringify(o.exit)} notes=${o.notes.join("; ")}`); }
  catch (e) { console.log(`[harmonize] ${label}: REJECT ${(e as Error).message}${e instanceof RoomGraphError && e.fixed ? ` | fixed: ${e.fixed}` : ""}`); }
};
tryG("rough 3 rooms", { rooms: [r("hall", 10, 7, 0, 8), r("dome", 12, 7, -1, 0), r("side", 5, 5, 11, 9)], connections: [{ a: "hall", b: "dome", type: "open" }, { a: "hall", b: "side", type: "door" }], entrance: "hall" });
tryG("lonely room", { rooms: [r("hall", 10, 7, 0, 8), r("dome", 12, 7, 0, 0)], connections: [], entrance: "hall" });
tryG("entrance not south", { rooms: [r("hall", 10, 7, 0, 0), r("cellar", 6, 5, 0, 9)], connections: [{ a: "hall", b: "cellar" }], entrance: "hall" });
const cp = ROOM_IDEAS.find((q) => q.id === "rooms2-29")!.plan;
console.log("[fingerprint] copy of rooms2-29:", JSON.stringify(copiedReference(cp)));
console.log("[fingerprint] own plan:", JSON.stringify(copiedReference({ w: 24, h: 18, rooms: [{ name: "a", x: 1, y: 10, w: 10, h: 7 }, { name: "b", x: 1, y: 1, w: 22, h: 8 }, { name: "c", x: 12, y: 10, w: 5, h: 5 }] })));

// 2) make_place 끝까지: 천문대 3실(돔 홀 망원경·입구 홀·계단 곁방)
const project = loadHeadlessProject(fs.readFileSync(snap, "utf8"));
const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
const env = { ctx, request: { task: "Build an observatory interior", provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", checkpoint: async () => {} } as unknown as PiAssistantV2Env;
const tools = createV2Tools(env, new V2Session());
const call = async (name: string, args: unknown) => { const res = await tools.find((t) => t.name === name)!.execute("p", args); return JSON.parse((res.content[0] as { text: string }).text); };
const zones = [
  { id: "hall", kind: "study", purpose: "entrance hall", x: 0, y: 9, role: "entrance", landmark: "fireplace", design: { shape: "rect", w: 10, h: 5, door: "center", floor: "boards", wall: "plaster", groups: [
    { name: "hearth", at: "north", items: [{ id: "fireplace" }] }, { name: "seats", at: "sw", rug: "red", items: [{ id: "armchair" }, { id: "roundtable", dx: 1 }] }, { name: "shelf", at: "ne", items: [{ id: "bookshelf 2w" }] }] } },
  { id: "dome", kind: "study", purpose: "telescope dome", x: -1, y: 0, landmark: "great telescope", design: { shape: "rect", w: 12, h: 6, floor: "parquet", wall: "stone", groups: [
    { name: "telescope", at: "center", items: [{ id: "great telescope" }] }, { name: "globes", at: "nw", items: [{ id: "globe" }] }, { name: "books", at: "ne", items: [{ id: "bookshelf 3w" }] }] } },
  { id: "stair", kind: "study", purpose: "stair room", x: 11, y: 9, stairs: "up", landmark: "stairs up wood", design: { shape: "rect", w: 5, h: 4, floor: "dplank", wall: "plaster", groups: [
    { name: "stairs", at: "north", items: [{ id: "stairs up wood" }] }, { name: "crate", at: "sw", items: [{ id: "crate" }] }] } },
];
const made = await call("make_place", { type: "interior", name: "Probe Observatory", zones, connections: [{ a: "hall", b: "dome", type: "open" }, { a: "hall", b: "stair", type: "door" }], entrance: "hall" });
console.log(`\n[make_place] ok=${made.ok} map=${made.mapIds?.[0]} summary=${String(made.summary).slice(0, 600)}`);
const mapId = made.mapIds?.[0];
if (mapId) {
  const m = env.ctx.project.maps[mapId]!;
  console.log(`  size ${m.width}x${m.height}`);
  for (const l of m.locations ?? []) console.log("  loc", l.name, l.x, l.y, l.w, l.h, (l.tags ?? []).join("|"));
  console.log("  room_graph", JSON.stringify(runTodoCheck(env.ctx.project, { kind: "room_graph", map: "Probe Observatory" }, { refs: { mapIds: [mapId] } })));
  fs.writeFileSync(`${out}/observatory.png`, renderMapPng(env.ctx.project, m, 2).png);
}
// 3) 지문: rooms2-29 평면을 그대로 옮긴 그래프 → 거절돼야 한다
const z29 = cp.rooms.map((q, i) => ({ id: q.name, kind: "study", purpose: q.name, x: q.x, y: q.y, design: { shape: "rect", w: q.w, h: q.h - 2, floor: "boards", wall: "plaster", groups: [{ name: "box", at: "center", items: [{ id: "crate" }] }] }, ...(i === 0 ? {} : {}) }));
const copy = await call("make_place", { type: "interior", name: "Probe Copy", zones: z29, connections: [{ a: "hall", b: "kitchen" }, { a: "hall", b: "storeroom" }], entrance: "hall" });
console.log(`\n[copy] ok=${copy.ok} summary=${String(copy.summary).slice(0, 400)}`);
