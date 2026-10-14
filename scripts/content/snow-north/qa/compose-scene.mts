// 설원 구성기 QA — 구운 번들 정의(src/assets/snowNorthTileset.json)로 composeSnowNorth 을 돌려 칸 배열을 JSON 으로 쓴다(그림은 render_scene.py).
//   node_modules/.bin/vite-node scripts/content/snow-north/qa/compose-scene.mts -- <out.json> <style> <W> <H> <seed>
import fs from "node:fs";
import data from "../../../../src/assets/snowNorthTileset.json";
import { composeSnowNorth, snowNorthPaletteFromTileset, type SnowNorthStyle } from "../../../../src/project/snowNorthComposer";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [out, style, W, H, seed] = args;
const pal = snowNorthPaletteFromTileset(data as never);
const r = composeSnowNorth({ width: Number(W), height: Number(H), style: style as SnowNorthStyle, seed: Number(seed) }, pal);
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), style, seed: Number(seed), lower: r.lower, upper: r.upper, buildings: r.buildings, start: r.start, exits: r.exits, props: r.props, zones: r.zones, notes: r.notes }));
console.log(`${style} ${W}x${H} seed ${seed}: 집 ${r.buildings.length} · 소품 ${r.props.length} · ${r.notes.join(" / ")}`);
