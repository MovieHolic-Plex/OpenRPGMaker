// 조립 건물 표본용 칸 배열 덤프(gate_assembled.py 가 부른다). 입력 JSON: [{name, role, w, side, floors, floorKind, wall, ground, roof, doorType}] → 출력 JSON: {name: {rect, placements}}
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
if (!process.env.JP_UNDER_TSX) {
  const r = spawnSync("npx", ["--no-install", "tsx", fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit", cwd: ROOT, env: { ...process.env, JP_UNDER_TSX: "1" } });
  process.exit(r.status ?? 1);
}
const { buildJpCityBuilding } = await import(pathToFileURL(join(ROOT, "src/editor/jpCity/builder.ts")).href);
const { sfDoorCol } = await import(pathToFileURL(join(ROOT, "src/project/jpCityStreetComposer.ts")).href);
const [inp, out] = process.argv.slice(2);
const res = {};
for (const s of JSON.parse(readFileSync(inp, "utf-8"))) {
  const r = buildJpCityBuilding({ w: s.w, floors: s.floors, floorKind: s.floorKind, wall: s.wall, ground: s.ground, roof: s.roof, door: { type: s.doorType, col: sfDoorCol(s.w, s.side) } });
  res[s.name] = { ok: r.ok, errors: r.issues.filter((i) => i.severity === "error").map((i) => `${i.code}:${i.message}`), rect: r.rect, placements: r.placements };
}
writeFileSync(out, JSON.stringify(res));
