// 야외 마을 다시 짓기(모델 없음): 실제 조수 판(run-dir)의 make_place 마을 명세 + 결과 요약(form·seed·크기)으로
// 지금 코드의 마을 도구를 다시 돌려 1배 PNG 로 찍는다 — 빌더 수정 전/후를 같은 마을에서 비교한다.
// 기록에 없는 손잡이(숲 종류·땅 모양)는 후보를 다 지어 보고 실제 맵과 칸이 가장 많이 같은 것을 고른다(같은 코드면 100%).
// 동굴(type cave·theme cave)은 요약에 씨앗이 없어 같은 명세 + 판마다 고정 salt 로 짓는다(전/후가 같은 배치, 꾸밈만 비교).
//   bun scripts/qa/assistant-v2/outdoorRebuild.mts <outDir> <run-dir>...   (DUMP_PROJECT=1 이면 project.json 도)
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { villageArgs } from "../../../src/ai/v2/builders/village.ts";
import { builderFor } from "../../../src/ai/v2/builders/index.ts";
import type { PlaceSpec } from "../../../src/ai/v2/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const [out, ...dirs] = process.argv.slice(2);
if (!out || !dirs.length) throw new Error("outdoorRebuild <outDir> <run-dir>...");
fs.mkdirSync(out, { recursive: true });

function* walk(o: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(o)) { for (const v of o) yield* walk(v); return; }
  if (o && typeof o === "object") { yield o as Record<string, unknown>; for (const v of Object.values(o)) yield* walk(v); }
}
const same = (a: GameMap, b: GameMap) => {
  if (a.width !== b.width || a.height !== b.height) return 0;
  let n = 0; for (let i = 0; i < a.lowerTiles.length; i++) if (a.lowerTiles[i] === b.lowerTiles[i] && a.upperTiles[i] === b.upperTiles[i]) n++;
  return n / a.lowerTiles.length;
};

for (const dir of dirs) {
  const tag = dir.replace(/\/+$/, "").split("/").slice(-3).join("-");
  const actual: Project = readProjectSqlite(path.join(dir, "project"));
  const turns = fs.readdirSync(path.join(dir, "session/turns")).filter((f) => f.endsWith(".json")).sort();
  const specs: PlaceSpec[] = []; const sums: string[] = [];
  for (const f of turns) for (const o of walk(JSON.parse(fs.readFileSync(path.join(dir, "session/turns", f), "utf8")))) {
    if (o.name === "make_place" && (o.input ?? o.args ?? o.arguments) && typeof (o.input ?? o.args ?? o.arguments) === "object") specs.push((o.input ?? o.args ?? o.arguments) as PlaceSpec);
    if (o.type === "tool_end" && o.name === "make_place" && typeof o.summary === "string") sums.push(o.summary);
  }
  const villages = sums.map((s) => s.match(/^(.+?): (\w+) (\w+) 마을 .*\((\d+)×(\d+), seed (\d+)\)/u)).filter(Boolean) as RegExpMatchArray[];
  for (const [i, m] of villages.entries()) {
    const [, name, theme, form, w, h, seed] = m;
    const spec = specs.find((s) => s.type === "village" && s.name === name) ?? { type: "village", name } as PlaceSpec;
    const target = Object.values(actual.maps).find((mp) => mp.name === name && mp.width === Number(w) && mp.height === Number(h));
    const base = { ...villageArgs(spec).args, name, theme, form, seed: Number(seed), width: Number(w), height: Number(h) };
    let best: { score: number; project: Project; mapId: string; args: Record<string, unknown> } | undefined;
    for (const forestType of [base.forestType, "broadleaf", "conifer", "mixed"]) for (const terrain of [base.terrain, "terraces"]) {
      const project = createBlankProject();
      const run = createBuildRun({ project, currentMapId: project.startMapId, assistantRun: true });
      const args = { ...base, ...(forestType ? { forestType } : {}), ...(terrain ? { terrain } : {}), mapId: project.startMapId };
      const r = run.call("author_beodeul_town", args);
      const id = (r.data as { mapId?: string } | undefined)?.mapId ?? project.startMapId;
      const map = run.ctx.project.maps[id];
      if (!r.ok || !map) continue;
      const score = target ? same(map, target) : 0;
      if (!best || score > best.score) best = { score, project: run.ctx.project, mapId: id, args };
      if (!target || score > 0.999) break;
    }
    if (!best) { console.log(`${tag} ${name}: 다시 짓기 실패`); continue; }
    const map = best.project.maps[best.mapId]!;
    const file = path.join(out, `${tag}-v${i}.png`);
    fs.writeFileSync(file, renderMapPng(best.project, map).png);
    if (process.env.DUMP_PROJECT) fs.writeFileSync(file.replace(/\.png$/, ".project.json"), JSON.stringify(best.project));
    console.log(`${file} ${name} ${form} seed ${seed} ${w}×${h} 실제와 같은 칸 ${(best.score * 100).toFixed(1)}% start=${JSON.stringify(best.project.startPos)} args=${JSON.stringify({ forestType: best.args.forestType, terrain: best.args.terrain })}`);
  }
  const caves = specs.filter((s) => s.type === "cave" || ((s.type === "dungeon") && /cave|동굴/.test(`${s.theme ?? ""} ${s.name}`)));
  for (const [i, spec0] of caves.entries()) {
    const spec = { ...spec0, salt: [...tag].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1_000_000 } as PlaceSpec;
    const builder = builderFor(spec);
    if (!builder) continue;
    const project = createBlankProject();
    const run = createBuildRun({ project, currentMapId: project.startMapId, assistantRun: true });
    await builder.prepare?.(spec);
    const res = builder.build(run, spec);
    for (const [f, id] of res.mapIds.entries()) {
      const map = run.ctx.project.maps[id]; if (!map) continue;
      const file = path.join(out, `${tag}-c${i}-f${f}.png`);
      fs.writeFileSync(file, renderMapPng(run.ctx.project, map).png);
      if (process.env.DUMP_PROJECT) fs.writeFileSync(file.replace(/\.png$/, ".project.json"), JSON.stringify({ ...run.ctx.project, maps: { [id]: map } }));
      console.log(`${file} ${spec.name} ${map.width}×${map.height} salt ${spec.salt} ${res.ok ? "" : "실패 " + res.summary.slice(0, 120)}`);
    }
  }
}
