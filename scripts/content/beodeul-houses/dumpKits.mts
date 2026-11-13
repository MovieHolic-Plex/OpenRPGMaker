// 집 벌(house set)이 덮는 건물 킷의 칸 정보를 뽑는다 — 조립(assemble.py)·굽기(bake.py)가 읽는 tiledata/beodeul-houses/kits.json.
//   bun scripts/content/beodeul-houses/dumpKits.mts
// 킷마다: 칸 크기 · 그림 있는 칸 · 문 칸 · 칸마다 통행/위아래/이름표 · 같은 그림을 쓰는 킷 묶음(pictures).
// 덮는 목록 = 강가·포구 마을 시공기가 놓는 붉은 기와 가족(살림집·가게집·여관·방앗간) + 높은 곳 건물 + 일터 건물(beodeulVillage.ts 의 목록과 같다).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";

const CITY = "h101_0 h101_1 h102_0 h102_1 h103_0 h103_1 h103_2 h104_0 h106_1 h107_0 h107_1 h109_1 h110_0 h111_0 h111_1 h112_0 h113_0 h113_1 h116_0 h116_1 h117_0 h117_1 h119_0 h120_0 h122_0 h123_1 h129_0 h131_0 h132_0 h134_0 h135_0 h137_0 h138_0 h139_0";
export const HOUSE_SET_KITS = [...CITY.split(" ").map((n) => `bd-house-${n}`), "bd-house-inn", "bd-house-h124_0", "bd-house-h104_1", "bd-house-h109_0",
  "bd-house-mk-tower-house", "bd-house-mk-chapel", "bd-house-mk-manor", "bd-farm-barn", "bd-house-mk-tithe-barn", "bd-house-mk-granary-mill", "bd-house-mk-warehouse"];
const project = createBlankProject();
const ts = project.tilesets.beodeul_city!;
const byId = new Map((ts.structureKits ?? []).map((k) => [k.id, k]));
const tileAt = (k: NonNullable<ReturnType<typeof byId.get>>, i: number, j: number): number => { const r = k.rows[j]!; const up = r.upperTiles?.[i] ?? -1; return up >= 0 ? up : r.tiles[i] ?? -1; };
const pictures = new Map<string, string[]>();
const kits = HOUSE_SET_KITS.map((id) => {
  const k = byId.get(id); if (!k) throw new Error(`킷 없음: ${id}`);
  if (k.rows.some((r) => r.tiles.some((t) => t >= 0))) throw new Error(`${id}: 아래층 칸이 있는 건물 킷은 다루지 않는다`);
  const grid = k.rows.map((r) => (r.upperTiles ?? []).join(",")).join("/");
  (pictures.get(grid) ?? pictures.set(grid, []).get(grid)!).push(id);
  const cells = k.rows.map((_, j) => Array.from({ length: k.width }, (_, i) => { const t = tileAt(k, i, j); if (t < 0) return null;
    const p = ts.passability[t]!; return { pass: p.up || p.down || p.left || p.right ? 1 : 0, upper: ts.priority[t] === "upper" ? 1 : 0, label: ts.tileMeta?.[t]?.label ?? "" }; }));
  const door = (k.parts ?? []).find((p) => p.kind === "entrance");
  return { id, name: k.name, w: k.width, h: k.height, door: door ? { dx: door.dx, dy: door.dy, w: door.w ?? 1, h: door.h ?? 1 } : null, cells };
});
const out = { note: "생성 파일 — scripts/content/beodeul-houses/dumpKits.mts", kits, pictures: [...pictures.values()] };
const file = path.resolve(import.meta.dir, "../../../tiledata/beodeul-houses/kits.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`킷 ${kits.length} · 그림 ${out.pictures.length} → ${file}`);
