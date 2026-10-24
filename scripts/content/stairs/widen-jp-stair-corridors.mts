// 일본 공용 장소 세 곳의 복도에 바닥 한 줄을 더해 내려가는 계단통을 바닥 안에 놓는다(2026-10-22, 계단 다시 그리기).
// 계단통 키트(2×2 발밑 + 난간 16px)는 구멍 줄 · 밟는 줄 · 그 남쪽 앞 칸 = 바닥 세 줄이 필요한데, 이 세 곳 복도는 바닥이 두 줄뿐이라
// #3256 이 계단통을 한 줄 올려 구멍이 벽면을 파고들었다. 여기서는 복도 마지막 바닥 줄을 한 번 더 깔아(그 줄 아래는 모두 한 줄 내린다)
// 계단통을 다시 한 줄 내린다 — 그림 맨 윗줄(난간) = 벽면 아랫줄, 구멍 = 첫 바닥 줄, 밟는 줄 = 둘째, 앞 칸 = 셋째(새 줄).
// 이동·도착은 이어서 fit-bundled-places.mts --write 가 계약대로 다시 맞춘다.
// 실행: npx --no-install tsx scripts/content/stairs/widen-jp-stair-corridors.mts [--write]   (두 번 돌려도 같은 결과 — 높이로 이미 넓힌 맵을 건너뛴다)
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
type MapLike = { id: string; width: number; height: number; events?: Array<{ x: number; y: number }> } & Record<(typeof LAYERS)[number], number[]>;

const kitTiles = (kitId: string): Set<number> => {
  const ts = JSON.parse(fs.readFileSync(path.join(ROOT, "src/assets/jpCityTileset.json"), "utf8"));
  const kit = ts.structureKits.find((k: { id: string }) => k.id === kitId);
  if (!kit) throw new Error(`키트 없음 ${kitId}`);
  return new Set<number>(kit.rows.flatMap((r: { tiles?: number[]; upperTiles?: number[] }) => [...(r.tiles ?? []), ...(r.upperTiles ?? [])]).filter((t: number) => t >= 0));
};

// file · map · 복제할 바닥 줄(그 아래에 같은 줄 하나를 더한다) · 원래 높이 · 계단통 키트와 지금 그림 맨 윗줄
const TARGETS = [
  { file: "public/assets/region-references/jp-city-house.oprn.json", map: "jp-city-house-2f", row: 10, height: 12, kit: "jp-in-stairwell-down-wood", x: 19, y: 7 },
  { file: "public/assets/region-references/jp-city-mansion-lobby.oprn.json", map: "jp-city-mansion-corridor", row: 4, height: 7, kit: "jp-in-mc-stairwell-down", x: 19, y: 1 },
  { file: "public/assets/region-references/jp-city-school-1f.oprn.json", map: "jp-city-school-3f", row: 13, height: 15, kit: "jp-in-sc-stairwell-down", x: 23, y: 1 + 9 },
];

/** 이 맵을 가리키는 좌표(이동 명령·시작 위치)를 r 아래에서 한 줄 내린다. */
function shiftRefs(node: unknown, mapId: string, r: number): number {
  let n = 0;
  if (Array.isArray(node)) { for (const v of node) n += shiftRefs(v, mapId, r); return n; }
  if (!node || typeof node !== "object") return 0;
  const o = node as Record<string, unknown>;
  if (o.mapId === mapId && typeof o.y === "number" && o.y > r) { o.y += 1; n++; }
  if (o.toMapId === mapId && typeof o.toY === "number" && o.toY > r) { o.toY += 1; n++; }
  for (const v of Object.values(o)) n += shiftRefs(v, mapId, r);
  return n;
}

const write = process.argv.includes("--write");
for (const t of TARGETS) {
  const p = JSON.parse(fs.readFileSync(t.file, "utf8"));
  const m: MapLike = p.maps[t.map];
  if (m.height !== t.height) { console.log(`${t.map} 높이 ${m.height} — 이미 넓혔다, 건너뜀`); continue; }
  const W = m.width;
  // ① 복도 마지막 바닥 줄(row)을 한 번 더 깐다(계단통은 그 줄보다 위라 먼저 넓혀도 자리가 그대로다).
  for (const layer of LAYERS) {
    const a = m[layer];
    m[layer] = [...a.slice(0, (t.row + 1) * W), ...a.slice(t.row * W, (t.row + 1) * W), ...a.slice((t.row + 1) * W)];
  }
  m.height += 1;
  // ② 계단통 그림을 한 줄 내린다(구멍이 벽면에서 첫 바닥 줄로). 비운 칸은 위 층 -1(아래층 바닥·벽면은 그대로).
  const kit = kitTiles(t.kit);
  const moved: Array<{ layer: (typeof LAYERS)[number]; i: number; t: number }> = [];
  for (const layer of LAYERS) for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) {
    const i = (t.y + dy) * W + t.x + dx; const v = m[layer][i]!;
    if (kit.has(v)) { moved.push({ layer, i, t: v }); m[layer][i] = -1; }
  }
  if (moved.length < 6) throw new Error(`${t.map} 계단통 그림이 (${t.x},${t.y}) 에 다 있지 않다 (${moved.length})`);
  for (const mv of moved) m[mv.layer][mv.i + W] = mv.t;
  // ③ 그 아래 이벤트·이 맵을 가리키는 이동·시작 위치를 한 줄 내린다.
  let ev = 0;
  for (const e of m.events ?? []) if (e.y > t.row) { e.y += 1; ev++; }
  const refs = shiftRefs(p.maps, t.map, t.row) + (p.startMapId === t.map && p.startPos?.y > t.row ? (p.startPos.y += 1, 1) : 0);
  console.log(`${t.map} 줄 ${t.row} 복제 → 높이 ${m.height} · 계단통 (${t.x},${t.y})→(${t.x},${t.y + 1}) · 이벤트 ${ev} · 참조 ${refs}`);
  if (write) fs.writeFileSync(t.file, JSON.stringify(p));
}
