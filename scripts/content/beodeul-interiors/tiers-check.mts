// 크기 단 구성을 실제 빌더로 지어 본다 — 구성 × 평면 벌 × 게임 열쇠. 도구가 거절하거나 닿지 못하는 바닥이 남으면 적는다.
//   bun scripts/content/beodeul-interiors/tiers-check.mts [중형|medium|large|xlarge|<구성 id>] [열쇠 수=3]
//   BD_LAYERS=<파일> 을 주면 지은 맵의 네 층 칸 번호를 적는다(render.py 가 그린다 — 저장소 밖).
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { createBeodeulCityTileset } from "../../../src/project/defaults/beodeulCity.ts";
import { BEODEUL_INTERIOR_SPEC as S } from "../../../src/editor/handInterior/builder.ts";
import { tierTableOf } from "../../../src/editor/handInterior/tierPlan.ts";
import { buildTier } from "../../../src/ai/v2/place/builders/interiorTier.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const want = process.argv[2] ?? "", keys = Number(process.argv[3] ?? 3);
const table = tierTableOf("beodeul_city")!;
const out: Record<string, unknown> = {}; let bad = 0, built = 0;
const styles = ["halftimber", "log", "harbourstone", "violetslate"];
for (const [pid, p] of Object.entries(table.programs)) {
  if (want && want !== p.tier && want !== pid) continue;
  for (let s = 0; s < p.shapes.length; s++) for (let k = 0; k < keys; k++) {
    const project = createBlankProject(); const ts = createBeodeulCityTileset(); project.tilesets[ts.id] = ts;
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const run = createBuildRun(ctx);
    const main = p.serves[k % p.serves.length]!, notes: string[] = [];
    const r = buildTier(run, { type: "interior", name: p.ko } as never, { tilesetId: ts.id, roomSpec: S, outside: { tileset: ts.id, tier: p.tier, style: styles[(s + k) % styles.length]! }, mainKind: main, named: true,
      varietyKey: `열쇠${k}|${p.ko}`, mapId: undefined, force: { program: pid, shape: s } }, notes);
    const tag = `${pid}/${p.shapes[s]!.id}#${k}`;
    if (!r?.ok) { bad++; console.error(`${tag}: ${notes.join(" / ")}`); continue; }
    built++;
    if (r.missingArt.length) { bad++; console.error(`${tag}: ${r.missingArt.join(" / ")}`); }
    const maps = r.mapIds.map((id) => run.ctx.project.maps[id]!);
    const want2 = 1 + (p.maps?.length ?? 0);
    if (maps.length !== want2) { bad++; console.error(`${tag}: 맵 ${maps.length}장(구성은 ${want2}장)`); }
    for (const [i, m] of maps.entries()) {
      const links = (m.events ?? []).filter((e) => JSON.stringify(e).includes('"transfer"')).length;
      if (i > 0 && !links) { bad++; console.error(`${tag}: 딸린 맵 ${m.name} 에 이동이 없다`); }
      out[`${tag.replace("/", "__")}${i ? `@${i}` : ""}`] = { name: m.name, w: m.width, h: m.height, links, layers: [m.lowerTiles, m.lowerOverlayTiles ?? [], m.upperTiles, m.upperOverlayTiles ?? []] };
    }
    console.log(`${tag}: ${maps.map((m) => `${m.width}×${m.height}`).join(" + ")} — ${r.summary}`);
  }
}
console.log(`지은 것 ${built} · 문제 ${bad}`);
if (process.env.BD_LAYERS) fs.writeFileSync(process.env.BD_LAYERS, JSON.stringify(out));
if (bad) process.exit(1);
