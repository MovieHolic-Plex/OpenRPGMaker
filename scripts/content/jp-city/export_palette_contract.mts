// 일본 로케일 팔레트 계약(src/editor/jpCity/paletteContract.ts) -> tiledata/jp-city/palette-contract.json
//   bun scripts/content/jp-city/export_palette_contract.mts
// bake_jp.py 가 이 JSON 의 colors(허용 색에 더한다)와 normalize(modern3 색 -> 계약 색, 바깥 칸에만)를 읽는다.
import fs from "node:fs";
import { chromaOf, JP_CONTRACT_COLORS, JP_PALETTE_FAMILIES, JP_RETIRED_RAMPS, JP_SUPPORT_RAMPS, normalizeJpColor } from "../../../src/editor/jpCity/paletteContract.ts";

const PAL = "tiledata/atlas-pick/palette/modern3.pal";
const OUT = "tiledata/jp-city/palette-contract.json";
const normalize: Record<string, { to: string; ramp: string; chroma: number; why: string }> = {};
for (const line of fs.readFileSync(PAL, "utf8").split("\n")) {
  const m = /^@rampc\s+(\w+)\s+(.*)$/.exec(line);
  if (!m) continue;
  const hexes = m[2]!.match(/#[0-9a-f]{6}/g) ?? [];
  hexes.forEach((hex, step) => {
    const to = normalizeJpColor(hex, { ramp: m[1]!, step, length: hexes.length });
    if (to === hex || normalize[hex]) return;
    normalize[hex] = { to, ramp: m[1]!, chroma: Math.round(chromaOf(hex) * 100) / 100, why: JP_RETIRED_RAMPS.includes(m[1]!) ? "retired-ramp" : "over-chroma" };
  });
}
const out = {
  version: 1,
  source: "src/editor/jpCity/paletteContract.ts",
  families: JP_PALETTE_FAMILIES.map((f) => ({ id: f.id, index: f.index, ko: f.ko, materials: f.materials.map((mat) => ({ id: mat.id, ko: mat.ko, steps: mat.steps, chromaCap: mat.chromaCap })) })),
  colors: JP_CONTRACT_COLORS.map((c) => c.hex),
  supportRamps: JP_SUPPORT_RAMPS,
  retiredRamps: JP_RETIRED_RAMPS,
  normalize,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`${OUT}: 계약 색 ${out.colors.length} · 정규화 대상 modern3 색 ${Object.keys(normalize).length}`);
for (const [from, n] of Object.entries(normalize)) console.log(`  ${from} (${n.ramp}, ${n.chroma}) -> ${n.to} ${n.why}`);
