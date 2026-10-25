// 계단 검사 증거용 — 장소 파일/프로젝트의 계단마다 주변 칸 덩어리와 표시(앞 칸·이동 칸·이벤트·도착)를 JSON 으로 낸다.
// 그림은 /tmp/stair/mapcrop.py 가 그린다. 실행: npx --no-install tsx scripts/qa/staging/stair-crops.mts <place.oprn.json|project.json> <outPrefix> [mapId]
import fs from "node:fs";
import path from "node:path";
const { findPlacedStairs, walkableCell } = await import("../../../src/project/stairs/detect");
const { stairApproachCells, stairTriggerCells } = await import("../../../src/project/stairs/contract");
const [file, prefix, only] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(file!, "utf8"));
p.tilesets = { ...(p.tilesets ?? {}) };
for (const f of fs.readdirSync("src/assets").filter((f) => /Tileset\.json$/u.test(f))) {
  const t = JSON.parse(fs.readFileSync(path.join("src/assets", f), "utf8"));
  if (!p.tilesets[t.id]) p.tilesets[t.id] = t;
}
const specs: unknown[] = [];
for (const m of Object.values<any>(p.maps ?? {})) {
  if (only && m.id !== only) continue;
  findPlacedStairs(p, m).forEach((s: any, i: number) => {
    const marks: any[] = [];
    for (const a of stairApproachCells(s)) marks.push({ ...a, c: walkableCell(p, m, a.x, a.y) ? "approach" : "bad" });
    for (const t of stairTriggerCells(s)) marks.push({ ...t, c: "trigger", inset: 6 });
    for (const e of m.events ?? []) marks.push({ x: e.x, y: e.y, c: "event", inset: 10 });
    for (const o of Object.values<any>(p.maps)) for (const e of o.events ?? []) for (const pg of [e, ...(e.pages ?? [])]) for (const c of pg.commands ?? []) if (c?.kind === "transfer" && c.mapId === m.id) marks.push({ x: c.x, y: c.y, c: "arrive", inset: 14 });
    const box = [Math.max(0, s.x - 4), Math.max(0, s.y - 4), Math.min(m.width - 1, s.x + s.contract.w + 3), Math.min(m.height - 1, s.y + s.contract.h + 4)];
    specs.push({ map: m.id, kit: s.kitId, leads: s.contract.leads, w: m.width, h: m.height, tileset: m.tilesetId, box, marks: marks.filter((k) => k.x >= box[0] && k.x <= box[2] && k.y >= box[1] && k.y <= box[3]),
      layers: { lowerTiles: m.lowerTiles, lowerOverlayTiles: m.lowerOverlayTiles, upperTiles: m.upperTiles, upperOverlayTiles: m.upperOverlayTiles }, out: `${prefix}-${m.id}-${i}.png` });
  });
}
process.stdout.write(JSON.stringify(specs));
