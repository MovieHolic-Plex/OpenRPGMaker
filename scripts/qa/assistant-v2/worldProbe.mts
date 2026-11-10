// 조수 v2 게임 세계 증명(모델 없음): 세계마다 청사진(장소 목록) → build_world → build_blueprint_path 를 실제 동사로 돌려
// 지어진 맵 수·세는 맵 수·시작에서 걸어 닿는지·청사진 막힘을 표로 내고 맵 PNG 를 남긴다. 낱말 없는 요청의 세계 고르기 분포도 본다.
//   bun scripts/qa/assistant-v2/worldProbe.mts <outDir> [worldId...]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { buildV2SystemPrompt } from "../../../src/ai/v2/prompt.ts";
import { WORLDS, pickWorld, type WorldSetting } from "../../../src/ai/v2/world.ts";
import { countMaps } from "../../../src/ai/v2/mapCount.ts";
import { walkGame } from "../../../src/ai/v2/makeGame.ts";
import { walkBlueprint } from "../../../src/ai/v2/blueprint.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const out = process.argv[2] ?? "qa-runs/v2scratch/world";
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });

const REQUEST: Record<string, string> = {
  beodeul: "버들항에서 벌어지는 판타지 RPG 게임 하나 만들어 줘.",
  snow_north: "북방 설원에서 벌어지는 게임 하나 만들어 줘.",
  desert_east: "사막 오아시스에서 벌어지는 게임 하나 만들어 줘.",
  pirate_isles: "해적 게임 하나 만들어 줘.",
  sky_island: "하늘섬 모험 게임 하나 만들어 줘.",
  steampunk_city: "스팀펑크 게임 하나 만들어 줘.",
  prehistoric: "공룡이 나오는 원시 부족 게임 하나 만들어 줘.",
  sengoku_edo: "사무라이 게임 하나 만들어 줘.",
  sf_station: "우주 정거장 SF 게임 하나 만들어 줘.",
  wasteland: "좀비 아포칼립스 게임 하나 만들어 줘.",
};

// 1) 낱말 없는 요청의 세계 분포 — 프로젝트 열쇠 200개.
{
  const project = createBlankProject();
  for (const request of ["재밌는 게임 만들어 줘.", "판타지 RPG 게임 하나 만들어 줘."]) {
    const tally = new Map<string, number>();
    for (let i = 0; i < 200; i++) { const w = pickWorld(project, `["project","p${i}"]`, request); tally.set(w?.id ?? "(none)", (tally.get(w?.id ?? "(none)") ?? 0) + 1); }
    console.log(`pick «${request}» ×200: ${[...tally].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  }
}

async function probe(world: WorldSetting): Promise<void> {
  const task = REQUEST[world.id]!;
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env: PiAssistantV2Env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","probe-${world.id}"]` } as never,
    emit: () => {}, record: () => {},
    sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }),
    render: async () => "", checkpoint: async () => {},
  };
  const tools = createV2Tools(env, session);
  const call = async (name: string, args: unknown): Promise<Record<string, unknown>> => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) return { ok: false, summary: `no tool ${name}` };
    const res = await tool.execute(`c-${name}`, args);
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
    try { return JSON.parse(text) as Record<string, unknown>; } catch { return { ok: false, summary: text.slice(0, 300) }; }
  };
  const prompt = buildV2SystemPrompt(ctx.project, ctx.currentMapId, task, undefined, `["project","probe-${world.id}"]`).join("\n");
  const hasCard = prompt.includes(`[World of this game — ${world.name}]`);
  // 장소: 종류를 차례로 8곳까지(종류가 적은 세계는 두 번씩), 단계는 앞 6곳에 하나씩.
  const kinds = world.kinds.length >= 6 ? world.kinds.slice(0, 8) : [...world.kinds, ...world.kinds].slice(0, 6);
  const places = kinds.map((k, i) => ({ name: `${k.ko}${kinds.findIndex((x) => x.id === k.id) === i ? "" : " 둘"}`, kind: k.id }));
  const steps = places.slice(0, 6).map((p, i) => ({ id: `s${i + 1}`, place: p.name, event: `${p.name}의 단서 ${i + 1}`, action: `${p.name}에서 단서를 찾는다`, ...(i ? { needs: `단서 ${i}` } : {}), gives: i === 5 ? "엔딩" : `단서 ${i + 1}`, feeling: "호기심" }));
  const bp = await call("write_blueprint", { title: `${world.ko} 시험`, genre: "모험", playerGoal: "단서를 따라 마지막 장소까지 가자.", places, steps, ending: { name: "끝", how: "마지막 단서를 찾았다.", feeling: "안도" } });
  const built = await call("build_world", {});
  const pathRes = await call("build_blueprint_path", {});
  const p = ctx.project;
  const worldMaps = places.map((pl) => Object.values(p.maps).find((m) => m.name === pl.name)).filter((m): m is NonNullable<typeof m> => !!m);
  const counted = countMaps(p);
  const walk = walkGame(p, worldMaps.map((m) => m.id));
  const blockers = walkBlueprint(p).blockers;
  const tilesets = [...new Set(Object.values(p.maps).map((m) => m.tilesetId))];
  console.log(`\n== ${world.id} card=${hasCard ? "yes" : "NO"} prompt=${prompt.length}ch blueprint=${bp.ok} build_world=${built.ok} path=${pathRes.ok}`);
  console.log(`   maps ${worldMaps.length}/${places.length} · counted ${counted.counted.length} · reached ${walk.reached.length}/${worldMaps.length} · noWayBack ${walk.noWayBack.length} · tilesets ${tilesets.join(",")} · start «${p.maps[p.startMapId]?.name}»`);
  if (!bp.ok) console.log(`   blueprint: ${String(bp.summary).slice(0, 400)}`);
  if (!built.ok) console.log(`   build_world: ${String(built.summary).slice(0, 700)}`);
  for (const line of (built.links as string[] | undefined) ?? []) console.log(`   · ${line.slice(0, 220)}`);
  if (!pathRes.ok) console.log(`   path: ${String(pathRes.summary).slice(0, 400)}`);
  for (const u of counted.uncounted) console.log(`   uncounted «${u.name}» ${u.reason} ${u.detail.slice(0, 100)}`);
  for (const b of blockers.slice(0, 5)) console.log(`   blocker ${b.id}: ${b.message.slice(0, 200)}`);
  const dir = path.join(out, world.id);
  fs.mkdirSync(dir, { recursive: true });
  worldMaps.forEach((m, i) => fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(2, "0")}-${places[i]!.kind}.png`), renderMapPng(p, m).png));
  fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(p));
}

for (const world of WORLDS) {
  if (only.length && !only.includes(world.id)) continue;
  try { await probe(world); } catch (e) { console.log(`== ${world.id} ERR ${(e as Error).stack?.slice(0, 900)}`); }
}
