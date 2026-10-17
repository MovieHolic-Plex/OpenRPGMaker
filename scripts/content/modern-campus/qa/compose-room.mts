// 캠퍼스 실내 QA — 예제 평면(tiledata/modern-campus/interior/plans/<이름>.json)을 실제 엔진 조립기(buildHandInteriorLayers, 캠퍼스 사양)로 짓고 칸 배열을 JSON 으로 쓴다.
//   node_modules/.bin/vite-node scripts/content/modern-campus/qa/compose-room.mts -- <plan.json> <out.json>
import fs from "node:fs";
import { buildHandInteriorLayers, CAMPUS_INTERIOR_SPEC } from "../../../../src/editor/handInterior/builder";
import { createModernCampusTileset } from "../../../../src/project/defaults/modernCampus";

const [planPath, out] = process.argv.slice(2).filter((a) => a !== "--");
const p = JSON.parse(fs.readFileSync(planPath!, "utf8"));
const ts = createModernCampusTileset();
const r = buildHandInteriorLayers({ plan: p.plan, floor: p.floor, wall: p.wall, zones: p.zones, objects: p.objects, tables: p.tables, goods: p.goods, start: p.start ? [{ x: p.start[0], y: p.start[1] }] : undefined, exitWidth: 2 }, ts, CAMPUS_INTERIOR_SPEC);
const merge = (a: number[], b: number[]) => a.map((t, i) => (b[i]! >= 0 ? b[i]! : -1));
fs.writeFileSync(out!, JSON.stringify({ width: r.width, height: r.height, lower: r.lowerTiles, lower2: r.lowerOverlayTiles, upper: r.upperTiles, upper2: r.upperOverlayTiles, issues: r.issues }));
console.log(`${p.name}: ${r.width}x${r.height} · 문제 ${r.issues.length} ${r.issues.slice(0, 5).map((i) => i.code + ":" + i.message).join(" / ")}`);
void merge;
