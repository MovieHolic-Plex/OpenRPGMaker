// build_gothic_place 도구를 실제 경로(새 빈 프로젝트 초안)로 돌려 야외 3종 + 실내 8종(+변형)을 짓고 검증한 뒤 JSON 으로 내보낸다.
//   npx tsx --tsconfig tsconfig.app.json scripts/content/gothic-manor/export_places.ts [--seeds 1,2,3]
// 검사: 도구 오류 0 · 시작 칸에서 걸어 닿는 칸 > 0. 시드 첫 값 결과를 tiledata/gothic-manor/places/<id>.json 으로 쓴다(참고문서 예제·검수 그림 원본).
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { GOTHIC_PLACE_TOOLS, GOTHIC_SPACE_SPEC } from "@/editor/tools/gothicPlaceTools";
import { GOTHIC_PLACE_KINDS } from "@/editor/gothic/composer";

const seedsArg = process.argv.indexOf("--seeds");
const seeds = seedsArg > 0 ? process.argv[seedsArg + 1]!.split(",").map(Number) : [1, 2, 3];
const build = GOTHIC_PLACE_TOOLS.find((t) => t.name === "build_gothic_place")!;
const outDir = "tiledata/gothic-manor/places";
mkdirSync(outDir, { recursive: true });
const jobs: { place: string; variant?: string }[] = GOTHIC_PLACE_KINDS.map((place) => ({ place }));
for (const [space, r] of Object.entries(GOTHIC_SPACE_SPEC.spaces)) {
  jobs.push({ place: space });
  for (const v of Object.keys(r.variants ?? {})) jobs.push({ place: space, variant: v });
}
let bad = 0;
for (const job of jobs) {
  for (const seed of seeds) {
    const draft = createBlankProject();
    const id = `gm-place-${job.place}${job.variant ? `-${job.variant}` : ""}`;
    let line = `${id} seed ${seed}: `;
    try {
      const t0 = Date.now();
      const res = build.run!(draft, { place: job.place, ...(job.variant ? { variant: job.variant } : {}), seed, mapId: id }) as { data: any; summary: string };
      const d = res.data; const map = draft.maps[d.mapId]!;
      line += `${d.width}x${d.height} walk ${d.walkableCount} doors ${(d.entrances ?? d.doorCells ?? []).length} placed ${Array.isArray(d.placed) ? d.placed.length : d.placed} warn ${d.warnings.length} ${Date.now() - t0}ms`;
      if (d.warnings.length) line += ` [${d.warnings.slice(0, 3).join(" / ")}]`;
      if (seed === seeds[0]) {
        writeFileSync(`${outDir}/${id}.json`, JSON.stringify({
          id, place: job.place, variant: job.variant ?? null, name: map.name, w: map.width, h: map.height,
          lowerTiles: map.lowerTiles, lowerOverlayTiles: map.lowerOverlayTiles, upperTiles: map.upperTiles, upperOverlayTiles: map.upperOverlayTiles,
          spawn: d.spawn, entrances: d.entrances ?? null, exits: d.exits ?? null, doorCells: d.doorCells ?? null, seed,
        }));
      }
    } catch (e) { bad++; line += `ERROR ${(e as Error).message.slice(0, 300)}`; }
    console.log(line);
  }
}
console.log(bad ? `실패 ${bad}` : "전부 통과");
process.exit(bad ? 1 : 0);
