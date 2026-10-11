// 새 게임 시작 맵 다양성 프로브 — 번들 컨셉 카드마다 「옛 고정 뼈대」와 「기획 구상 뼈대」를 깔아 렌더하고, 판정·모양 통계를 남긴다.
//   bun scripts/qa/start-variety-probe.mts [--out output/evidence/start-variety] [--limit 12]
// 결과: <out>/<slug>-{old,new}-{start,route}.png, <out>/report.json (viz 페이지가 읽는다)
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { newProjectChoiceById } from "../../src/editor/newProjectChoices.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { conceptBrief } from "../../src/concepts/brief.ts";
import { bundledConcepts } from "../../src/concepts/source.ts";
import { buildPlayableSegmentSkeleton, judgePlayableSegment, SEGMENT_ROUTE_MAP_ID, supportsPlayableSegment } from "../../src/project/playableSegment.ts";
import { planStartForBrief } from "../../src/project/startVariety.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "output/evidence/start-variety");
const LIMIT = Number(arg("limit", "12"));
fs.mkdirSync(OUT, { recursive: true });

const rows: Record<string, unknown>[] = [];
const picked = bundledConcepts().filter((c) => c.presetId === "adventure-jrpg" || c.presetId === "story-cutscene" || c.presetId === "monster-collect");
// 장르가 고루 섞이게 장르별로 번갈아 뽑는다.
const byGenre = new Map<string, typeof picked>();
for (const c of picked) byGenre.set(c.presetId, [...(byGenre.get(c.presetId) ?? []), c]);
const queue: typeof picked = [];
for (let i = 0; queue.length < LIMIT; i++) {
  let any = false;
  for (const list of byGenre.values()) if (list[i]) { queue.push(list[i]!); any = true; if (queue.length >= LIMIT) break; }
  if (!any) break;
}

for (const concept of queue) {
  const choice = newProjectChoiceById(concept.presetId)!;
  const base = createNewProjectSeed(choice.packId, concept.title) as Project;
  ensureBundledTilesets(base);
  base.gameDesignBrief = { ...conceptBrief(concept), generationPending: true };
  if (!supportsPlayableSegment(base)) continue;
  const plan = planStartForBrief(base.gameDesignBrief, base.meta.title);
  const row: Record<string, unknown> = { slug: concept.slug, title: concept.title, genre: concept.presetId, stage: concept.stage, hint: concept.tilesetHint ?? null, plan };
  for (const legacy of [true, false]) {
    const tag = legacy ? "old" : "new";
    try {
      const t0 = Date.now();
      const project = buildPlayableSegmentSkeleton(structuredClone(base), { legacy });
      const verdict = judgePlayableSegment(project);
      const start = project.maps[project.startMapId]!;
      const route = project.maps[SEGMENT_ROUTE_MAP_ID]!;
      fs.writeFileSync(`${OUT}/${concept.slug}-${tag}-start.png`, renderMapPng(project, start).png);
      fs.writeFileSync(`${OUT}/${concept.slug}-${tag}-route.png`, renderMapPng(project, route).png);
      row[tag] = { ok: verdict.ok, blockers: verdict.ok ? [] : verdict.blockers.slice(0, 3), start: [start.width, start.height], route: [route.width, route.height], tileset: start.tilesetId, ms: Date.now() - t0 };
    } catch (error) {
      row[tag] = { ok: false, error: String((error as Error).message ?? error).slice(0, 200) };
    }
  }
  rows.push(row);
  console.log(concept.slug, concept.presetId, plan.theme, plan.form, plan.terrain, `${plan.routeW}x${plan.routeH}`, "old", (row.old as any)?.ok, "new", (row.new as any)?.ok, (row.new as any)?.error ?? (row.new as any)?.blockers?.[0] ?? "");
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
