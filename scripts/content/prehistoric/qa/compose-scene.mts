// 선사 구성기 QA — 구운 번들 정의(src/assets/prehistoricTileset.json)로 composePrehistoric 을 돌려 칸 배열을 JSON 으로 쓴다(그림은 render_scene.py).
//   node_modules/.bin/vite-node scripts/content/prehistoric/qa/compose-scene.mts -- <out.json> <style> <W> <H> <seed>
import fs from "node:fs";
import data from "../../../../src/assets/prehistoricTileset.json";
import { composePrehistoric, prehistoricPaletteFromTileset, type PrehistoricStyle } from "../../../../src/project/prehistoricComposer";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [out, style, W, H, seed] = args;
const pal = prehistoricPaletteFromTileset(data as never);
const r = composePrehistoric({ width: Number(W), height: Number(H), style: style as PrehistoricStyle, seed: Number(seed) }, pal);
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), style, seed: Number(seed), lower: r.lower, upper: r.upper, buildings: r.buildings, start: r.start, exits: r.exits, props: r.props, zones: r.zones, notes: r.notes }));
console.log(`${style} ${W}x${H} seed ${seed}: 집 ${r.buildings.length} · 소품 ${r.props.length} · ${r.notes.join(" / ")}`);
