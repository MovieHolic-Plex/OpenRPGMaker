// sf_station 구성기 시험 출력 — 종류:씨앗 목록을 짜서 /tmp/sfc/out.json(칸 배열)으로 쓴다. 그림은 compose_render.py. 실행: SPECS="station:1,street:2" node_modules/.bin/vite-node scripts/content/sf-station/compose_probe.ts
import { composeSfStationMap, SF_DEFAULT_SIZE, type SfMapKind } from "@/project/sfStationComposer";
import { createSfStationTileset } from "@/project/defaults/sfStation";
import { writeFileSync } from "node:fs";
const ts = createSfStationTileset();
const out: Record<string, unknown> = {};
for (const spec of (process.env.SPECS ?? "station:1,lab:1,street:1,moonbase:1").split(",")) {
  const [kind, seedS] = spec.split(":"); const seed = Number(seedS);
  const sz = SF_DEFAULT_SIZE[kind as SfMapKind];
  const map: any = { id: "m", name: "m", width: sz.w, height: sz.h, tilesetId: "sf_station", tileSize: 16, lowerTiles: new Array(sz.w * sz.h).fill(60), upperTiles: new Array(sz.w * sz.h).fill(-1), events: [] };
  const r = composeSfStationMap(map, ts, kind as SfMapKind, seed);
  out[spec] = { w: map.width, h: map.height, lower: map.lowerTiles, l2: map.lowerOverlayTiles ?? null, upper: map.upperTiles, summary: r.summary, placed: r.placed, areas: r.areas, spawn: r.spawn, skipped: r.skipped };
  console.log(spec, r.summary, "skipped", r.skipped);
}
writeFileSync(process.env.OUT ?? "/tmp/sfc/out.json", JSON.stringify(out));
