// 단계×테마 표들이 같이 쓰는 재료 — 조수가 맵을 까는 테마·장소 종류마다 실제 빌더로 맵 한 장을 짓는다(stageMatrix.mts · whereMatrix.mts).
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { WORLDS, worldPlaceSpec } from "../../../src/ai/v2/place/world.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Src { theme: string; kind: string; indoor: boolean; danger: boolean; project: any; mapId: string; doors: { x: number; y: number; kit?: string }[]; note: string }

export function mkRun(project: any, mapId?: string): any {
  const ctx: any = { project, currentMapId: mapId ?? project.startMapId, assistantRun: true };
  const calls: any[] = [];
  return { ctx, calls, call: (tool: string, args: any) => { let r; try { r = runTool(ctx, tool, args); } catch (e) { r = { ok: false, summary: `${tool} threw ${(e as Error).message}` }; } calls.push({ tool, args, ok: r.ok, summary: String(r.summary ?? "").slice(0, 200) }); return r; } };
}

function buildOne(theme: string, kind: string, spec: any, flags: { indoor?: boolean; danger?: boolean }): Src | { theme: string; kind: string; error: string } {
  const project = createBlankProject();
  const run = mkRun(project);
  const builder = builderFor(spec);
  if (!builder) return { theme, kind, error: "no builder" };
  let res: any;
  try { res = builder.build(run, spec); } catch (e) { return { theme, kind, error: `threw ${(e as Error).message.slice(0, 200)}` }; }
  if (!res.ok || !res.mapIds?.length) return { theme, kind, error: String(res.summary).slice(0, 240) };
  const mapId = res.entrance?.mapId ?? res.mapIds[0];
  const p = run.ctx.project;
  const map = p.maps[mapId];
  // 앵커: 시작점이 이 맵이 아니면 들어오는 칸을 시작으로
  if (p.startMapId !== mapId || !isPassable(p, map, p.startPos.x, p.startPos.y)) {
    const e = res.entrance && res.entrance.mapId === mapId ? res.entrance : undefined;
    let spot = e && isPassable(p, map, e.x, e.y) ? { x: e.x, y: e.y } : undefined;
    if (!spot) for (let y = map.height - 1; y >= 0 && !spot; y--) for (let x = 0; x < map.width && !spot; x++) if (isPassable(p, map, x, y)) spot = { x, y };
    run.ctx.project = { ...run.ctx.project, startMapId: mapId, startPos: spot };
  }
  return { theme, kind, indoor: !!flags.indoor, danger: !!flags.danger, project: run.ctx.project, mapId, doors: (res.state?.doors ?? []) as any[], note: String(res.summary).slice(0, 120) };
}

export async function* sources(only?: (theme: string, kind: string) => boolean): AsyncGenerator<Src | { theme: string; kind: string; error: string }> {
  const want = (t: string, k: string) => !only || only(t, k);
  for (const world of WORLDS) {
    for (const kind of world.kinds) {
      if (!want(world.id, kind.id)) continue;
      const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
      yield buildOne(world.id, kind.id, spec, { indoor: kind.indoor, danger: kind.danger });
    }
  }
  const extras: [string, string, any, { indoor?: boolean; danger?: boolean }][] = [
    ["joseon", "village", { type: "village", name: "조선 마을", style: "joseon", salt: 7 }, {}],
    ["joseon", "interior", { type: "interior", name: "조선 주막", style: "joseon", salt: 7 }, { indoor: true }],
    ["wizarding", "village", { type: "village", name: "마법 학교 뜰", style: "wizarding", salt: 7 }, {}],
    ["wizarding", "interior", { type: "interior", name: "마법 학교 교실", style: "wizarding", salt: 7 }, { indoor: true }],
    ["jp_city", "street", { type: "street", name: "상점가", style: "jp-modern", salt: 7 }, {}],
    ["jp_city", "house", { type: "house", name: "일본 가정집", style: "jp-modern", salt: 7 }, { indoor: true }],
    ["modern_kr", "street", { type: "street", name: "서울 골목", style: "kr-modern", salt: 7 }, {}],
    ["dungeon", "forest", { type: "dungeon", name: "깊은 숲", theme: "forest", size: "small", salt: 7 }, { danger: true }],
    ["dungeon", "pyramid", { type: "dungeon", name: "피라미드", theme: "pyramid", size: "small", salt: 7 }, { danger: true }],
    ["dungeon", "ice", { type: "dungeon", name: "얼음 동굴", theme: "ice", size: "small", salt: 7 }, { danger: true }],
  ];
  for (const [theme, kind, spec, flags] of extras) if (want(theme, kind)) {
    let got = buildOne(theme, kind, spec, flags);
    for (let t = 0; t < 8 && "error" in got && /불러오는 중/u.test(got.error); t++) { await new Promise((r) => setTimeout(r, 1500)); got = buildOne(theme, kind, spec, flags); }
    yield got;
  }
}
