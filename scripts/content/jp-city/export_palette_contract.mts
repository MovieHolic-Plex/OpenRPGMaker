// 일본 로케일 팔레트 계약(src/editor/jpCity/paletteContract.ts) -> tiledata/jp-city/palette-contract.json
//   bun scripts/content/jp-city/export_palette_contract.mts
// bake_jp.py 가 이 JSON 의 colors(허용 색에 더한다)와 normalize(modern3 색 -> 계약 색, 바깥 칸에만)를 읽는다.
// version 2(2026-10-20): 재료에 확장 램프 `ramp`(6~10단)·하위 램프 `subRamps`(3~10단), 이름 붙은 램프 전부를 펼친 `ramps`
// (`<재료>` 핵심 5단 · `<재료>+` 확장 · `<재료>/<하위>`). `steps` 는 여전히 핵심 5단이라 v1 독자(jp_regions_pack 등)는 그대로 돈다.
import fs from "node:fs";
import { chromaOf, JP_CONTRACT_COLORS, JP_PALETTE_FAMILIES, JP_RETIRED_RAMPS, JP_SUPPORT_RAMPS, materialRamps, normalizeJpColor, validateJpPaletteContract } from "../../../src/editor/jpCity/paletteContract.ts";

const problems = validateJpPaletteContract();
if (problems.length) {
  console.error(`팔레트 계약 검사 실패 ${problems.length}건:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

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
  version: 2,
  source: "src/editor/jpCity/paletteContract.ts",
  families: JP_PALETTE_FAMILIES.map((f) => ({
    id: f.id, index: f.index, ko: f.ko,
    materials: f.materials.map((mat) => ({
      id: mat.id, ko: mat.ko, steps: mat.steps, chromaCap: mat.chromaCap,
      ...(mat.ramp ? { ramp: mat.ramp } : {}),
      ...(mat.subRamps ? { subRamps: mat.subRamps.map((r) => ({ id: r.id, ko: r.ko, steps: r.steps, chromaCap: r.chromaCap ?? mat.chromaCap })) } : {}),
    })),
  })),
  ramps: Object.fromEntries(JP_PALETTE_FAMILIES.flatMap((f) => f.materials.flatMap((m) => materialRamps(m).map((r) => [r.name, r.steps])))),
  colors: JP_CONTRACT_COLORS.map((c) => c.hex),
  supportRamps: JP_SUPPORT_RAMPS,
  retiredRamps: JP_RETIRED_RAMPS,
  normalize,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`${OUT}: 계약 색 ${out.colors.length} · 정규화 대상 modern3 색 ${Object.keys(normalize).length}`);
for (const [from, n] of Object.entries(normalize)) console.log(`  ${from} (${n.ramp}, ${n.chroma}) -> ${n.to} ${n.why}`);
