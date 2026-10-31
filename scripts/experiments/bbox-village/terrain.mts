// bbox-village: code terrain (existing generator, codeTerrainFor) for a brief → terrain.json + preview PNG.
//   bun scripts/experiments/bbox-village/terrain.mts <port|hill> <out dir>
import fs from "node:fs";
const R = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const { villageArgs, villageMapSize } = await import(`${R}/src/ai/v2/builders/village.ts`);
const { codeTerrainFor } = await import(`${R}/src/editor/tools/authorBeodeulTown.ts`);
const { terrainPreviewPng } = await import(`${R}/src/editor/tools/beodeulTerrainPreview.ts`);
const [brief, out] = process.argv.slice(2);
const B = JSON.parse(fs.readFileSync(`${R}/scripts/experiments/bbox-village/briefs.json`, "utf8"))[brief!];
const spec = { type: "village", ...B.spec };
const va: any = { ...villageArgs(spec as any).args, ...(B.landform ? { landform: B.landform } : {}) };
const [W, H] = villageMapSize(spec as any, va);
const t = codeTerrainFor(String(va.theme ?? "river"), va, W, H, B.seed);
fs.mkdirSync(out!, { recursive: true });
fs.writeFileSync(`${out}/terrain-raw.png`, terrainPreviewPng(t, 10));
fs.writeFileSync(`${out}/terrain.json`, JSON.stringify({ brief, theme: va.theme, va, W, H, seed: B.seed, character: t.character, high: t.high, maxLevel: t.maxLevel, note: t.note,
  levels: Array.from(t.levels), water: Array.from(t.water), river: t.river, crossings: t.crossings, areas: t.areas, cliffBreaks: t.cliffBreaks }));
console.log(brief, W, H, va.theme, t.character, "maxLevel", t.maxLevel, t.note);
