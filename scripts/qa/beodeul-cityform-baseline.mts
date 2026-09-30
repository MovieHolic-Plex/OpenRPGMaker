// 라운드 3(및 그 이후) 결과 맵을 새 도시 형태 자(src/editor/tools/cityForm.ts)로 다시 잰다. r3 실행은 이 자가 없던 때라 서로 비교하려면 같은 자로 재야 한다.
//   bun scripts/qa/beodeul-cityform-baseline.mts verify-shots/beodeul-assistant-r3/fresh [...]   → <dir>/cityform.json 과 표준 출력
// map.json 에는 structurePlacements 가 없으므로 trace.json 의 stamp_object 성공 호출에서 복원한다(킷 크기는 타일셋 킷 정의).
import fs from "node:fs";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { analyzeCityForm } from "../../src/editor/tools/cityForm.ts";
import type { Project } from "../../src/project/types.ts";

const dirs = process.argv.slice(2);
const project = createBlankProject() as Project;
ensureBundledTilesets(project);
const ts = project.tilesets.beodeul_city!;
const kits = new Map((ts.structureKits ?? []).map((k) => [k.id, k]));
for (const dir of dirs) {
  const m = JSON.parse(fs.readFileSync(`${dir}/map.json`, "utf8"));
  const trace = JSON.parse(fs.readFileSync(`${dir}/trace.json`, "utf8")) as { name: string; ok: boolean; args: string }[];
  const structurePlacements = trace.filter((t) => t.name === "stamp_object" && t.ok).map((t, i) => {
    const a = JSON.parse(t.args); const id = String(a.objectId).replace(/^kit:beodeul_city\//, ""); const k = kits.get(id);
    return k ? { id: `p${i}`, kitId: id, x: Number(a.x), y: Number(a.y), w: k.width, h: k.height, before: [], afterHash: "" } : null;
  }).filter(Boolean);
  const map = { ...m, structurePlacements } as never;
  const r = analyzeCityForm(project, map);
  fs.writeFileSync(`${dir}/cityform.json`, JSON.stringify(r, null, 1));
  const c = { deadEnds: r.deadEnds.length, longStraight: r.lines.longStraight.length, longest: r.lines.longestLen, lines: r.lines.count, meanDepth: r.graph.meanDepth, maxDepth: r.graph.maxDepth, comps: r.graph.components, isolated: r.graph.isolated.length,
    cv: r.spacing.cv, bent: r.bentStreetCells, canal: r.canal, nodes: r.nodes.length, landmarks: r.landmarks.length, blocks: r.blocks.count, distinct: r.blocks.distinct, nbr: r.blocks.neighbourRepeats.length, over: r.blocks.overused.length };
  console.log(dir, JSON.stringify(c));
}
