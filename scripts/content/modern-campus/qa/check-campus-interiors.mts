// modern_campus 실내 평면 5장(tiledata/modern-campus/interior/plans/*.json)을 **조수 도구 그대로**(build_hand_interior_room, tileset modern_campus)
// 지어 엔진 통행(BFS)·도구 경고를 본다. 파이썬 검증기(campus_plans.py)는 builder.ts 규칙을 옮긴 것이라 엔진 출력이 아니다 — 이 검사가 엔진 쪽이다.
//   bun scripts/content/modern-campus/qa/check-campus-interiors.mts [--out /tmp/campus-int]
// 출력: 평면마다 OK/WARN/FAIL + PNG(--out). 종료 코드 = WARN+FAIL 수.
import fs from "node:fs";
import { renderMapPng } from "../../../qa-game/render.mts";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "../../../../src/editor/tools/handInteriorTools.ts";
import { createEmptyToolProject } from "../../../../src/editor/tools/emptyProject.ts";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/campus-int"); fs.mkdirSync(OUT, { recursive: true });
const DIR = "tiledata/modern-campus/interior/plans";
const project: any = createEmptyToolProject("chk"); ensureBundledTilesets(project);
let bad = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const ex = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); const id = f.replace(/\.json$/, "");
  try {
    const r: any = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "modern_campus", mapId: `chk-${id}`, name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], exitWidth: 2, start: [{ x: ex.start[0], y: ex.start[1] }], links: [] });
    const w = [...(r.warnings ?? [])].filter((m: string) => !m.startsWith("평면이 참고 예제"));
    if (w.length) bad++;
    const m = project.maps[`chk-${id}`]!;
    fs.writeFileSync(`${OUT}/${id}.png`, renderMapPng(project, m).png);
    console.log(`${w.length ? "WARN" : "OK  "} ${id} ${m.width}x${m.height}${w.length ? "\n  - " + w.join("\n  - ") : ""}`);
  } catch (e: any) { bad++; console.log(`FAIL ${id}: ${String(e.message ?? e).slice(0, 400)}`); }
}
process.exit(bad);
