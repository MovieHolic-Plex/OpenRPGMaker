// 크기 단 탐침(모델 없음): 버들항 마을 N곳(기본 30)을 실제 조수 동사(write_blueprint → build_places)로 짓고,
//  ① 마을에 선 문 달린 집의 단 분포(킷 태그 tier: — 없으면 «태그 없음») ② 그 마을에 달린 실내가 실제로 몇 방·몇 장으로 지어졌나(= 어느 단) ③ 청한 큰 건물이 바깥에 섰나.
//   bun scripts/qa/assistant-v2/tierProbe.mts <outDir> [count=30] [--png N]     # --png N: 앞 N 마을은 바깥·안 그림도 남긴다
// 게임 QA 라 신기루 VM 에서 돌린다(~/z-project/assistant-fable-runs/vm-qa/README.md). 결과: <outDir>/tier-probe.json · tier-probe.md(표).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import { WORLDS } from "../../../src/ai/v2/place/world.ts";
import { buildingEntrances } from "../../../src/ai/v2/place/entrances.ts";
import { kitTierByFootprint } from "../../../src/project/kitTier.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const out = process.argv[2] ?? "qa-runs/v2scratch/tier-probe";
const count = Number(process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : 30);
const pngN = process.argv.includes("--png") ? Number(process.argv[process.argv.indexOf("--png") + 1]) : 0;
fs.mkdirSync(out, { recursive: true });
const world = WORLDS.find((w) => w.id === "beodeul")!;
const has = (id: string) => world.kinds.some((k) => k.id === id);
// 이야기 다섯 벌 — 실내 장소의 종류만 다르다(이름은 종류의 한국어 이름 그대로: 낱말로 고르지 않는다는 것을 본다).
const STORIES: { id: string; rooms: [string, string][] }[] = [
  { id: "여관·가게·집", rooms: [["inn", "여관"], ["shop", "가게"], ["house", "촌장의 집"]] },
  { id: "회관·여관·집", rooms: [["hall", "회관"], ["inn", "여관"], ["house", "어부의 집"]] },
  { id: "성당·가게·집", rooms: [["church", "성당"], ["shop", "가게"], ["house", "농부의 집"]] },
  { id: "성·여관", rooms: [["castle", "성"], ["inn", "여관"]] },
  { id: "집 둘·가게", rooms: [["house", "한스의 집"], ["house", "마리의 집"], ["shop", "가게"]] },
];
const VILLAGES = ["village", "port", "swamp-village"];
const tagOf = (tags: readonly string[] | undefined, head: string) => tags?.find((t) => t.startsWith(head))?.slice(head.length);

interface Row { i: number; village: string; story: string; doors: Record<string, number>; kits: string[]; rooms: { place: string; kind: string; built: boolean; kit?: string; kitTier?: string; kitTag?: string; interior?: string; roomCount: number; maps: number; size: string; wanted: boolean; stood: boolean }[]; notes: string[] }
const rows: Row[] = [];

async function one(i: number): Promise<void> {
  const vk = VILLAGES[i % VILLAGES.length]!, story = STORIES[i % STORIES.length]!;
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const key = `["project","tier-probe-${i}"]`;
  const env: PiAssistantV2Env = { ctx, request: { task: "버들항에서 벌어지는 판타지 RPG 게임 하나 만들어 줘.", provider: "local-cli:claude", mapIds: [], project, projectKey: key } as never,
    emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }), render: async () => "", checkpoint: async () => {} };
  const tools = createV2Tools(env, session);
  const call = async (name: string, args: unknown): Promise<Record<string, unknown>> => {
    const tool = tools.find((t) => t.name === name); if (!tool) return { ok: false, summary: `no tool ${name}` };
    const res = await tool.execute(`c-${name}`, args);
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
    try { return JSON.parse(text) as Record<string, unknown>; } catch { return { ok: false, summary: text.slice(0, 300) }; }
  };
  const vName = `${world.kinds.find((k) => k.id === vk)!.ko} ${i}`;
  const rooms = story.rooms.filter(([k]) => has(k));
  // 청사진은 장소 여섯 곳 이상이어야 받는다 — 동굴·폐광·깊은 숲·옛 신전으로 채운다(마을 밖 장소).
  const fill = [["cave", "동굴"], ["mine", "폐광"], ["deep-forest", "깊은 숲"], ["temple", "옛 신전"]].slice(0, Math.max(3, 6 - 1 - rooms.length));
  const places = [{ name: vName, kind: vk }, ...rooms.map(([kind, name]) => ({ name, kind, from: vName })), ...fill.map(([kind, name]) => ({ name: name!, kind: kind!, from: vName }))];
  const WHO = ["촌장 하르", "떠돌이 상인 미라"];
  const steps = places.map((p, n) => ({ id: `s${n + 1}`, kind: n < 2 ? "talk" : "find", ...(n < 2 ? { who: WHO[n] } : {}), place: p.name, event: n < 2 ? WHO[n]! : `${p.name}의 단서`, action: `${p.name}에서 단서를 찾는다`, ...(n ? { needs: `단서 ${n}` } : {}), gives: n === places.length - 1 ? "엔딩" : `단서 ${n + 1}`, feeling: "궁금함" }));
  const notes: string[] = [];
  const bp = await call("write_blueprint", { title: `크기 단 탐침 ${i}`, genre: "모험", playerGoal: "단서를 따라간다.", places, steps, ending: { name: "끝", how: "마지막 단서를 찾았다.", feeling: "안도" } });
  let bpOk = bp.ok;
  for (let t = 0; t < 2 && !bpOk; t++) { const again = await call("write_blueprint", { title: `크기 단 탐침 ${i}`, genre: "모험", playerGoal: "단서를 따라간다.", places, steps, ending: { name: "끝", how: "마지막 단서를 찾았다.", feeling: "안도" } }); bpOk = again.ok; if (!bpOk && t === 1) notes.push(`blueprint: ${String(again.summary).slice(0, 300)}`); }
  const built = await call("build_places", {});
  if (!built.ok) notes.push(`build_places: ${String(built.summary).slice(0, 300)}`);
  const p: Project = ctx.project;
  const byName = (n: string) => Object.values(p.maps).find((m) => m.name === n);
  const vmap = byName(vName);
  const row: Row = { i, village: vk, story: story.id, doors: {}, kits: [], rooms: [], notes };
  rows.push(row);
  if (!vmap) { notes.push("마을이 지어지지 않았다"); return; }
  const ts = p.tilesets[vmap.tilesetId]!;
  // buildingEntrances 는 킷 «이름»을 준다 — id 로도 이름으로도 찾는다.
  const kit = (id: string | undefined) => ts.structureKits?.find((k) => k.id === id) ?? ts.structureKits?.find((k) => k.name === id);
  const ents = buildingEntrances(p, vmap);
  const gateTiles = new Map<number, string>();
  for (const q of ts.structureKits ?? []) for (const part of q.parts ?? []) { if (part.kind !== "entrance") continue;
    for (let y = part.dy; y < part.dy + (part.h ?? 1); y++) for (let x = part.dx; x < part.dx + (part.w ?? 1); x++) for (const t of [q.rows?.[y]?.tiles?.[x], q.rows?.[y]?.upperTiles?.[x]]) if (typeof t === "number" && t > 0 && !gateTiles.has(t)) gateTiles.set(t, q.id); }
  const gateKitAt = (x: number, y: number) => { const i = y * vmap.width + x; for (const layer of ["upperTiles", "upperOverlayTiles", "lowerOverlayTiles", "lowerTiles"] as const) { const t = (vmap as unknown as Record<string, ArrayLike<number> | undefined>)[layer]?.[i]; if (typeof t === "number" && gateTiles.has(t)) return kit(gateTiles.get(t)); } return undefined; };
  // 문은 마을 짓기가 스스로 적은 목록(킷 id · 문 앞 칸)으로 센다 — 맵의 칸으로 거꾸로 읽으면 문 그림 칸을 같이 쓰는 킷끼리 섞인다. 목록이 없으면(옛 길) 맵에서 읽는다.
  const told = ((session.places.get(vmap.id)?.result as { state?: { doors?: { x: number; y: number; kit?: string }[] } } | undefined)?.state?.doors ?? []).filter((d) => kit(d.kit));
  const doorList: { x: number; y: number; kit: string }[] = told.length ? told.map((d) => ({ x: d.x, y: d.y, kit: kit(d.kit)!.id })) : ents.map((e) => ({ x: e.front.x, y: e.front.y, kit: kit(e.kit)?.id ?? "" })).filter((d) => d.kit);
  const seen = new Set<string>();
  for (const d of doorList) {
    const k = kit(d.kit)!; const at = `${k.id}@${d.x},${d.y}`; if (seen.has(at)) continue; seen.add(at);
    // 두 칸 너비 문루는 문 앞 칸이 둘이다 — 한 채로 센다.
    if (seen.has(`${k.id}@${d.x - 1},${d.y}`)) continue;
    const tier = tagOf(k.ai?.tags, "tier:") ?? "태그 없음";
    row.doors[tier] = (row.doors[tier] ?? 0) + 1; row.kits.push(k.id);
  }
  for (const [kind, name] of rooms) {
    const need = world.kinds.find((k) => k.id === kind) as { building?: { kinds: string[]; tiers: string[]; cat?: string } } | undefined;
    const m = byName(name);
    const extra = Object.values(p.maps).filter((q) => (q.name ?? "").startsWith(`${name} · `) || q.name === `${name} 2층`);
    // 이 방으로 들어가는 문: 마을 맵에서 이 맵으로 가는 이동 이벤트 자리 → 그 자리(또는 바로 위)의 입구 킷
    const ev = m ? (vmap.events ?? []).find((e) => JSON.stringify(e.pages ?? []).includes(`"mapId":"${m.id}"`)) : undefined;
    const ent = ev ? ents.find((e) => (e.front.x === ev.x && e.front.y === ev.y) || (e.x === ev.x && e.y === ev.y)) : undefined;
    // 걸어서 지나는 문루(통로 칸이 입구인 킷)는 buildingEntrances 가 세지 않는다 — 이동 이벤트 자리의 칸이 어느 킷의 입구 칸인지로 찾는다.
    const own = ev ? doorList.find((d) => d.x === ev.x && (d.y === ev.y + 1 || d.y === ev.y)) : undefined;
    const k = kit(own?.kit) ?? kit(ent?.kit) ?? (ev ? gateKitAt(ev.x, ev.y) ?? gateKitAt(ev.x, ev.y - 1) : undefined);
    if (k && !row.kits.includes(k.id)) { row.kits.push(k.id); const t0 = tagOf(k.ai?.tags, "tier:") ?? "태그 없음"; row.doors[t0] = (row.doors[t0] ?? 0) + 1; }
    const stood = !!need?.building && row.kits.some((id) => { const q = kit(id)!; const t = tagOf(q.ai?.tags, "tier:") ?? kitTierByFootprint(q); const inside = tagOf(q.ai?.tags, "interior:")?.split("+"); return !!t && need.building!.tiers.includes(t) && (inside ? inside.some((x) => need.building!.kinds.includes(x)) : !!need.building!.cat && tagOf(q.ai?.tags, "cat:") === need.building!.cat); });
    row.rooms.push({ place: name, kind, built: !!m, ...(k || ent ? { kit: k?.id ?? ent!.kit } : {}), ...(k ? { kitTier: tagOf(k.ai?.tags, "tier:") ?? kitTierByFootprint(k) ?? "?", kitTag: tagOf(k.ai?.tags, "tier:") ?? "태그 없음", ...(tagOf(k.ai?.tags, "interior:") ? { interior: tagOf(k.ai?.tags, "interior:")! } : {}) } : {}),
      roomCount: m ? (m.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")).length : 0, maps: m ? 1 + extra.length : 0, size: m ? `${m.width}×${m.height}` : "", wanted: !!need?.building, stood });
  }
  if (i < pngN) {
    const dir = path.join(out, `v${String(i).padStart(2, "0")}`); fs.mkdirSync(dir, { recursive: true });
    const save = (m: GameMap | undefined, f: string) => { if (m) fs.writeFileSync(path.join(dir, f), renderMapPng(p, m).png); };
    save(vmap, "00-village.png");
    rooms.forEach(([, name], n) => { save(byName(name), `${String(n + 1).padStart(2, "0")}-${name}.png`); Object.values(p.maps).filter((q) => (q.name ?? "").startsWith(`${name} · `)).forEach((q, j) => save(q, `${String(n + 1).padStart(2, "0")}-${name}-m${j + 1}.png`)); });
  }
}

const only = process.argv.includes("--only") ? Number(process.argv[process.argv.indexOf("--only") + 1]) : -1;
// --seeds N: 같은 마을을 난수 씨앗 1..N 으로 되풀이해 짓는다(자동 짓기의 장소 salt 는 Math.random 이다 — 씨앗을 박아야 같은 결과를 다시 낼 수 있다). --rand S: 그 씨앗 하나로. 아무것도 안 주면 마을 i 는 씨앗 i+1 — 같은 명령은 같은 표를 낸다.
const seedsN = process.argv.includes("--seeds") ? Number(process.argv[process.argv.indexOf("--seeds") + 1]) : 0;
const randS = process.argv.includes("--rand") ? Number(process.argv[process.argv.indexOf("--rand") + 1]) : 0;
const pin = (seed: number) => { let v = (seed * 2654435761) >>> 0; Math.random = () => { v = (Math.imul(v, 1103515245) + 12345) >>> 0; return v / 2 ** 32; }; };
if (seedsN && only >= 0) { for (let sd = 1; sd <= seedsN; sd++) { pin(sd); await one(only); const r = rows.at(-1)!; r.notes.unshift(`seed ${sd}`); console.log(`[seed ${sd}] ${r.rooms.map((q) => `${q.place}←${q.kit ?? "?"} 방${q.roomCount}·맵${q.maps}`).join(" | ")} || ${r.kits.join(",")}`); } }
else for (let i = 0; i < count; i++) { if (only >= 0 && i !== only) continue; pin(randS || i + 1); try { await one(i); } catch (e) { rows.push({ i, village: "?", story: "?", doors: {}, kits: [], rooms: [], notes: [`ERR ${(e as Error).stack?.slice(0, 600)}`] }); } console.log(`[${i + 1}/${count}] ${JSON.stringify(rows.at(-1)).slice(0, 400)}`); }

// 요약: 방 수 → 지어진 단(한 방 = 소형, 2~4 = 중형, 5~8 = 대형, 9 이상 또는 맵 3장 이상 = 초대형).
const builtTier = (r: Row["rooms"][number]) => (!r.built ? "못 지음" : r.maps >= 3 || r.roomCount >= 9 ? "xlarge" : r.roomCount >= 5 ? "large" : r.roomCount >= 2 ? "medium" : "small");
const doorSum: Record<string, number> = {}; for (const r of rows) for (const [t, n] of Object.entries(r.doors)) doorSum[t] = (doorSum[t] ?? 0) + n;
const cross: Record<string, Record<string, number>> = {}; const byKind: Record<string, Record<string, number>> = {};
let wanted = 0, stood = 0;
for (const r of rows) for (const q of r.rooms) {
  const a = q.kitTag ?? "문 못 찾음", b = builtTier(q);
  (cross[a] ??= {})[b] = ((cross[a] ??= {})[b] ?? 0) + 1; (byKind[q.kind] ??= {})[b] = ((byKind[q.kind] ??= {})[b] ?? 0) + 1;
  if (q.wanted) { wanted++; if (q.stood) stood++; }
}
const T = ["small", "medium", "large", "xlarge", "못 지음"];
const md = [`# 크기 단 탐침 — 마을 ${rows.length}곳`, "", "## ① 마을에 선 문 달린 집의 단(킷 태그)", "", `| 단 | 문 수 |`, `|---|---|`, ...Object.entries(doorSum).sort().map(([t, n]) => `| ${t} | ${n} |`), "",
  "## ② 실내가 달린 문의 킷 단 → 실제로 지어진 단", "", `| 문의 킷 단 \\ 지어진 것 | ${T.join(" | ")} |`, `|---|${T.map(() => "---").join("|")}|`, ...Object.entries(cross).sort().map(([a, v]) => `| ${a} | ${T.map((t) => v[t] ?? 0).join(" | ")} |`), "",
  "## ③ 장소 종류별 지어진 단", "", `| 장소 종류 | ${T.join(" | ")} |`, `|---|${T.map(() => "---").join("|")}|`, ...Object.entries(byKind).sort().map(([a, v]) => `| ${a} | ${T.map((t) => v[t] ?? 0).join(" | ")} |`), "",
  `청한 큰 건물(종류에 building 이 있는 장소) ${wanted}곳 가운데 바깥에 그 쓰임·단의 킷이 선 것 ${stood}곳.`, "",
  "## 마을마다", "", "| # | 마을 | 이야기 | 문(단별) | 실내: 장소(종류) ← 문의 킷[단] → 방 수·맵 수 |", "|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.i} | ${r.village} | ${r.story} | ${Object.entries(r.doors).map(([t, n]) => `${t} ${n}`).join(" · ")} | ${r.rooms.map((q) => `${q.place}(${q.kind}) ← ${q.kit ?? "?"}[${q.kitTag ?? "?"}] → 방 ${q.roomCount}·맵 ${q.maps}${q.wanted ? (q.stood ? " ✔섰다" : " ✘안 섰다") : ""}`).join("<br>")}${r.notes.length ? `<br>⚠ ${r.notes.join(" / ").slice(0, 200)}` : ""} |`)].join("\n");
fs.writeFileSync(path.join(out, "tier-probe.json"), JSON.stringify({ rows, doorSum, cross, byKind, wanted, stood }, null, 1));
fs.writeFileSync(path.join(out, "tier-probe.md"), md + "\n");
console.log(md.split("\n").slice(0, 28).join("\n"));
