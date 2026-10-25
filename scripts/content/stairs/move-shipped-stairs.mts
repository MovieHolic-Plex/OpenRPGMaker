// 공용 장소에서 남쪽 벽에 붙어 앞 칸이 벽이던 계단 그림을 한 줄 위로 옮긴다(2026-10-22, 계단 입구 계약 후속).
// 계단 그림 칸(키트 타일)만 옮기고 나머지 칸은 그대로 둔다. 비운 칸은 그 층의 배경으로 — 위 층(겹·윗층)은 -1,
// 아래층(바닥)에 그려진 계단(마법 학교)은 옮긴 자리의 원래 바닥 타일로 메운다. 층 이동·도착은 이어서
// fit-bundled-places.mts --write 가 계약대로 다시 맞춘다(짝 계단 포함).
// 실행: npx --no-install tsx scripts/content/stairs/move-shipped-stairs.mts [--write]
//   대상: 일본 집 2층 · 맨션 외복도 · 학교 3층(public/assets/region-references/*.oprn.json — 위층이라 스냅샷·미리보기는 1층 그대로)
//         마법 학교 시계탑 · 부엉이 탑(tiledata/wizarding/spaces/*.json — 그다음 render_spaces.py · publish_places_wz.py)
import fs from "node:fs";
import path from "node:path";

type Layered = { width: number; height: number; lowerTiles: number[]; lowerOverlayTiles: number[]; upperTiles: number[]; upperOverlayTiles: number[] };
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
const ROOT = process.cwd();
const kitTiles = (tilesetFile: string, kitId: string): Set<number> => {
  const ts = JSON.parse(fs.readFileSync(path.join(ROOT, "src/assets", tilesetFile), "utf8"));
  const kit = ts.structureKits.find((k: { id: string }) => k.id === kitId);
  if (!kit) throw new Error(`키트 없음 ${kitId}`);
  return new Set<number>(kit.rows.flatMap((r: { tiles?: number[]; upperTiles?: number[] }) => [...(r.tiles ?? []), ...(r.upperTiles ?? [])]).filter((t: number) => t >= 0));
};

/** (x,y,w,h) 계단 그림을 dy 만큼 옮긴다. 옮긴 칸 수를 돌려준다. */
function moveStair(m: Layered, kit: Set<number>, x: number, y: number, w: number, h: number, dy: number): number {
  const W = m.width;
  const picked: Array<{ layer: (typeof LAYERS)[number]; dx: number; ry: number; t: number }> = [];
  for (const layer of LAYERS) for (let ry = 0; ry < h; ry++) for (let dx = 0; dx < w; dx++) {
    const t = m[layer][(y + ry) * W + x + dx]!;
    if (kit.has(t)) picked.push({ layer, dx, ry, t });
  }
  if (picked.length < w * h) throw new Error(`계단 그림이 (${x},${y}) ${w}×${h} 에 다 있지 않다 (${picked.length})`);
  // 비운 칸의 바닥: 새 자리 맨 윗줄이 덮기 전 아래층 타일(같은 열).
  const floorBelow = Array.from({ length: w }, (_, dx) => m.lowerTiles[(y + dy) * W + x + dx]!);
  for (const p of picked) m[p.layer][(y + p.ry) * W + x + p.dx] = p.layer === "lowerTiles" ? floorBelow[p.dx]! : -1;
  for (const p of picked) m[p.layer][(y + p.ry + dy) * W + x + p.dx] = p.t;
  return picked.length;
}

const JP = [
  { file: "public/assets/region-references/jp-city-house.oprn.json", map: "jp-city-house-2f", kit: "jp-in-stairwell-down-wood", x: 19, y: 8 },
  { file: "public/assets/region-references/jp-city-mansion-lobby.oprn.json", map: "jp-city-mansion-corridor", kit: "jp-in-mc-stairwell-down", x: 19, y: 2 },
  { file: "public/assets/region-references/jp-city-school-1f.oprn.json", map: "jp-city-school-3f", kit: "jp-in-sc-stairwell-down", x: 23, y: 11 },
];
const WZ = [
  { file: "tiledata/wizarding/spaces/wz-space-clocktower.json", kit: "wz-clock-stair", x: 1, y: 12 },
  { file: "tiledata/wizarding/spaces/wz-space-owlery.json", kit: "wz-owl-stair-up", x: 1, y: 9 },
];
const write = process.argv.includes("--write");
for (const j of JP) {
  const p = JSON.parse(fs.readFileSync(j.file, "utf8"));
  const m = p.maps[j.map];
  const kit = kitTiles("jpCityTileset.json", j.kit);
  const n = moveStair(m, kit, j.x, j.y, 2, 3, -1);
  console.log(`${j.map} ${j.kit} (${j.x},${j.y}) → (${j.x},${j.y - 1}) 칸 ${n}`);
  if (write) fs.writeFileSync(j.file, JSON.stringify(p));
}
for (const z of WZ) {
  const sp = JSON.parse(fs.readFileSync(z.file, "utf8"));
  const m = { ...sp, width: sp.w, height: sp.h };
  const n = moveStair(m, kitTiles("wizardingWorldTileset.json", z.kit), z.x, z.y, 2, 2, -1);
  for (const pl of sp.placed) if (pl.kit === z.kit && pl.x === z.x && pl.y === z.y) pl.y -= 1;
  console.log(`${sp.id} ${z.kit} (${z.x},${z.y}) → (${z.x},${z.y - 1}) 칸 ${n}`);
  if (write) fs.writeFileSync(z.file, JSON.stringify(sp));
}
