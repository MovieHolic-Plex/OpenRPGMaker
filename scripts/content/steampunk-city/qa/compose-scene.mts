// 스팀펑크 도시 구성기 QA — 구운 번들 정의(src/assets/steampunkCityTileset.json)로 composeSteampunkCity 를 돌려 칸 배열을 JSON 으로 쓴다(그림은 render_scene.py).
//   node_modules/.bin/vite-node scripts/content/steampunk-city/qa/compose-scene.mts -- <out.json> <style> <W> <H> <seed> [건물,…]
import fs from "node:fs";
import data from "../../../../src/assets/steampunkCityTileset.json";
import { composeSteampunkCity, steampunkPaletteFromTileset, type SteampunkStyle } from "../../../../src/project/steampunkCityComposer";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [out, style, W, H, seed, blds] = args;
const pal = steampunkPaletteFromTileset(data as never);
const r = composeSteampunkCity({ width: Number(W), height: Number(H), style: style as SteampunkStyle, seed: Number(seed), buildings: blds ? blds.split(",") : undefined }, pal);
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), style, seed: Number(seed), lower: r.lower, upper: r.upper, buildings: r.buildings, start: r.start, exits: r.exits, props: r.props, zones: r.zones, notes: r.notes }));
console.log(`${style} ${W}x${H} seed ${seed}: 건물 ${r.buildings.length} · 소품 ${r.props.length} · ${r.notes.join(" / ")}`);
