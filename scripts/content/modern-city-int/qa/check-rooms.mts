// modern_city 실내 — 예제 평면 9장과 layout.program 9개를 조수 도구 그대로(build_hand_interior_room) 지어 오류·경고를 본다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/check-rooms.mts [--json out.json]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isPassable } from "@/project/collision";
const EX = "tiledata/modern-city/interior/examples";
const project = createEmptyToolProject("mci");
const out: Record<string, unknown> = {};
let bad = 0;
function reach(mapId: string) {
  const m = project.maps[mapId]!; const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && isPassable(project, m, x, y);
  let start: [number, number] | null = null;
  for (let x = 0; x < m.width && !start; x++) if (ok(x, m.height - 1)) start = [x, m.height - 1];
  let walk = 0; for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (ok(x, y)) walk++;
  if (!start) return { walk, reached: 0 };
  const seen = new Set([start.join(",")]); const q = [start];
  while (q.length) { const [x, y] = q.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && ok(x + dx!, y + dy!)) { seen.add(k); q.push([x + dx!, y + dy!]); } } }
  return { walk, reached: seen.size };
}
for (const f of readdirSync(EX).filter((x) => x.endsWith(".json")).sort()) {
  const ex = JSON.parse(readFileSync(`${EX}/${f}`, "utf8"));
  const id = f.replace(/\.json$/, "");
  for (const mode of ["plan", "program"] as const) {
    const mapId = `mci-${mode}-${id}`;
    try {
      const args = mode === "plan"
        ? { tileset: "modern_city", mapId, name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], ...(ex.exitWidth ? { exitWidth: ex.exitWidth } : {}), start: [{ x: ex.start[0], y: ex.start[1] }], links: [] }
        : { tileset: "modern_city", mapId, name: ex.name, floor: ex.floor, wall: ex.wall, layout: { program: id } };
      const r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, args as never);
      const w = [...(r.warnings ?? [])].filter((m) => !String(m).startsWith("평면이 참고 예제"));
      const rr = reach(mapId);
      out[mapId] = { warnings: w, ...rr, size: `${project.maps[mapId]!.width}x${project.maps[mapId]!.height}` };
      if (w.length || rr.reached < rr.walk) bad++;
      console.log(`${w.length || rr.reached < rr.walk ? "WARN" : "OK  "} ${mapId} ${project.maps[mapId]!.width}x${project.maps[mapId]!.height} 걸음 ${rr.reached}/${rr.walk}${w.length ? "\n   " + w.join("\n   ") : ""}`);
    } catch (e) { bad++; console.log(`FAIL ${mapId} ${(e as Error).message}`); out[mapId] = { error: (e as Error).message }; }
  }
}
const j = process.argv.indexOf("--json"); if (j > 0) writeFileSync(process.argv[j + 1]!, JSON.stringify({ maps: out, project: { tilesets: { modern_city: undefined } } }, null, 1));
process.exitCode = bad;
