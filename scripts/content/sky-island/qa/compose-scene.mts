// 하늘섬 구성기 QA — 구운 번들 정의(src/assets/skyIslandTileset.json)로 composeSkyIsland 를 돌려 칸 배열을 JSON 으로 쓴다(그림은 render_scene.py).
//   node_modules/.bin/vite-node scripts/content/sky-island/qa/compose-scene.mts -- <out.json> <style> <W> <H> <seed>
//   style: village · shrine · dock · archipelago · room-cottage · room-shrine · room-cabin · room-observatory
import fs from "node:fs";
import data from "../../../../src/assets/skyIslandTileset.json";
import { composeSkyIsland, skyPaletteFromTileset, type SkyComposeStyle } from "../../../../src/project/skyIslandComposer";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [out, style, W, H, seed] = args;
const pal = skyPaletteFromTileset(data as never);
const r = composeSkyIsland({ width: Number(W), height: Number(H), style: style as SkyComposeStyle, seed: Number(seed) }, pal);
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), style, seed: Number(seed), lower: r.lower, upper: r.upper, buildings: r.buildings, bridges: r.bridges, start: r.start, exits: r.exits, props: r.props, zones: r.zones, notes: r.notes }));
console.log(`${style} ${W}x${H} seed ${seed}: 건물 ${r.buildings.length} · 다리 ${r.bridges.length} · 소품 ${r.props.length} · 쓰임 ${r.zones.length}${r.notes.length ? " · " + r.notes.join(" / ") : ""}`);
