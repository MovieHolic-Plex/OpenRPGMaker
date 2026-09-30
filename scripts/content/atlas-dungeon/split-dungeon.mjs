// atlas_biome_dungeon — the ship / dungeon blocks of the old atlas_biome_interior sheet (commit 8e02e8e4e, cells
// 2160~3299) cut out into their own oprn-atlas tileset when atlas_biome_interior became the hand-pixel v5 sheet.
// Tibo furniture graft slots are blanked (ship 480~509, dungeon 480~482 of each block); the combined-town grafts
// (dungeon 483~488), the cellar → dungeon entrance pieces and the baked water/abyss looks stay.
// Output: public/assets/atlas-interior/dungeon-chipset.png + src/assets/atlasBiomeDungeonTileset.json
// Usage: node scripts/content/atlas-dungeon/split-dungeon.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const REV = "8e02e8e4e";
const OFF = 2160;
const old = JSON.parse(execFileSync("git", ["show", `${REV}:src/assets/atlasBiomeInteriorTileset.json`], { maxBuffer: 1 << 28 }).toString());
fs.writeFileSync("/tmp/atlas-old-interior.png", execFileSync("git", ["show", `${REV}:public/assets/atlas-interior/interior-chipset.png`], { maxBuffer: 1 << 28 }));
const BLANK = [...Array.from({ length: 30 }, (_, i) => 480 + i), 510 + 480, 510 + 481, 510 + 482];
execFileSync("python3", ["-c", `
from PIL import Image
im=Image.open('/tmp/atlas-old-interior.png').convert('RGBA')
out=im.crop((0,${OFF / 30}*16,480,im.height))
for t in ${JSON.stringify(BLANK)}:
    x,y=(t%30)*16,(t//30)*16
    out.paste((0,0,0,0),(x,y,x+16,y+16))
out.save('public/assets/atlas-interior/dungeon-chipset.png')
print(out.size)`], { stdio: "inherit" });
const SOLID = { up: false, down: false, left: false, right: false };
const a = structuredClone(old.append);
for (const t of BLANK) {
  a.terrain[t] = 0; a.priority[t] = "lower"; a.passability[t] = { ...SOLID };
  a.tileMeta[t] = { label: "", description: "빈 칸(옛 Tibo 가구 이식 자리, 실내가 손 도트 v5 로 바뀌며 비움).", source: "unknown" };
}
const shift = (v) => (typeof v === "number" && v >= 0 ? v - OFF : v);
const reId = (id) => id.replace(/^atlas-interior:/, "atlas-dungeon:").replace(/^atlas-interior-/, "atlas-dungeon-");
for (const m of a.tileMeta) {
  if (typeof m.description === "string") m.description = m.description.replace(/\(\+(\d+)\)/g, (_, n) => `(+${Number(n) - OFF})`).replace(/\+2160 = (\d+)/g, (_, n) => `+0 = ${Number(n) - OFF}`).replace(/\+2670 = (\d+)/g, (_, n) => `+510 = ${Number(n) - OFF}`).replace(/\(\+2670 = (\d+)\)/g, "");
  if (Array.isArray(m.tags)) m.tags = m.tags.map((t) => (t === "아틀라스 실내" ? "아틀라스 던전" : t));
}
const tileGroups = old.tileGroups.map((g) => ({
  ...structuredClone(g), id: reId(g.id), tileIds: g.tileIds.map(shift),
  description: String(g.description ?? "").replace(/(\d{4})/g, (n) => (Number(n) >= OFF ? String(Number(n) - OFF) : n)),
  placementRules: String(g.placementRules ?? "").replace(/(\d{4})/g, (n) => (Number(n) >= OFF ? String(Number(n) - OFF) : n)),
}));
const autotileGroups = old.autotileGroups.map((g) => {
  const n = structuredClone(g);
  n.id = reId(g.id);
  n.memberTileIds = g.memberTileIds.map(shift);
  if (g.connectTileIds) n.connectTileIds = g.connectTileIds.map(shift);
  if (g.triggerTileIds) n.triggerTileIds = g.triggerTileIds.map(shift);
  n.variantMap = Object.fromEntries(Object.entries(g.variantMap).map(([k, v]) => [k, shift(v)]));
  if (g.interiorVariants) n.interiorVariants = g.interiorVariants.map(shift);
  return n;
});
const structureKits = old.structureKits.map((k) => {
  const n = structuredClone(k);
  n.id = reId(k.id);
  n.rows = k.rows.map((r) => ({ tiles: r.tiles.map(shift), upperTiles: r.upperTiles?.map(shift) }));
  n.ai.tags = n.ai.tags.map((t) => (t === "아틀라스 실내" ? "아틀라스 던전" : t));
  n.learnedFrom = "atlas-dungeon";
  return n;
});
const count = a.terrain.length;
const out = {
  id: "atlas_biome_dungeon", name: "배·던전 · 생성 칩셋 공용 (아틀라스)", textureKey: "tex_atlas_biome_dungeon", family: "oprn-atlas",
  count, blocks: { ship: [0, 509], dungeon: [510, 1019], entrance: [1020, 1079], dungeonComposed: [1080, count - 1] },
  terrain: a.terrain, priority: a.priority, passability: a.passability, tileMeta: a.tileMeta, tileGroups, autotileGroups, structureKits,
};
fs.writeFileSync("src/assets/atlasBiomeDungeonTileset.json", JSON.stringify(out) + "\n");
console.log({ count, tileGroups: tileGroups.length, autotileGroups: autotileGroups.length, kits: structureKits.length, blanked: BLANK.length });
