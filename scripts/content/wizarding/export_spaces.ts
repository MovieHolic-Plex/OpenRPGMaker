// build_wizarding_space 도구를 실제 경로(새 빈 프로젝트 초안)로 돌려 13공간(+변형)을 짓고 검증한 뒤 장소 게시용 JSON 으로 내보낸다.
//   npx tsx --tsconfig tsconfig.app.json scripts/content/wizarding/export_spaces.ts [--seeds 1,2,3]
// 검사: 오류 0 · 통행 한 덩이(components 1) · 문 칸·시작 칸이 그 덩이 안. 시드 1 결과만 tiledata/wizarding/spaces/<id>.json 으로 쓴다.
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { WIZARDING_SPACE_TOOLS } from "@/editor/tools/wizardingSpaceTools";
import { WIZARDING_SPACE_SPEC } from "@/editor/wizarding/builder";

const seedsArg = process.argv.indexOf("--seeds");
const seeds = seedsArg > 0 ? process.argv[seedsArg + 1]!.split(",").map(Number) : [1, 2, 3];
const build = WIZARDING_SPACE_TOOLS.find((t) => t.name === "build_wizarding_space")!;
const outDir = "tiledata/wizarding/spaces";
mkdirSync(outDir, { recursive: true });
const jobs: { space: string; variant?: string }[] = [];
for (const [space, r] of Object.entries(WIZARDING_SPACE_SPEC.spaces)) {
  jobs.push({ space });
  for (const v of Object.keys(r.variants ?? {})) jobs.push({ space, variant: v });
}
let bad = 0;
for (const job of jobs) {
  for (const seed of seeds) {
    const draft = createBlankProject();
    const id = `wz-space-${job.space}${job.variant ? `-${job.variant}` : ""}`;
    let line = `${id} seed ${seed}: `;
    try {
      const res = build.run!(draft, { space: job.space, ...(job.variant ? { variant: job.variant } : {}), seed, mapId: id }) as { data: any; summary: string };
      const d = res.data; const map = draft.maps[d.mapId]!;
      const walk = d.walkability;
      const ok = walk.components === 1;
      if (!ok) bad++;
      line += `${d.width}x${d.height} walk ${walk.walkableCount} comps ${walk.components} pockets ${walk.ignoredPockets} doors ${d.doorCells.length} furniture ${d.placed.length} warn ${d.warnings.length}${ok ? "" : "  ✗"}`;
      if (seed === seeds[0]) {
        writeFileSync(`${outDir}/${id}.json`, JSON.stringify({
          id, space: job.space, variant: job.variant ?? null, name: map.name, w: map.width, h: map.height,
          lowerTiles: map.lowerTiles, lowerOverlayTiles: map.lowerOverlayTiles, upperTiles: map.upperTiles, upperOverlayTiles: map.upperOverlayTiles,
          spawn: d.spawn, doorCells: d.doorCells, placed: d.placed, seed,
        }));
      }
    } catch (e) { bad++; line += `ERROR ${(e as Error).message.slice(0, 200)}`; }
    console.log(line);
  }
}
console.log(bad ? `실패 ${bad}` : "전부 통과");
process.exit(bad ? 1 : 0);
