// 전국·에도 구성기 QA — 구운 번들 정의(src/assets/sengokuEdoTileset.json)로 composeSengokuEdo 를 돌려 칸 배열을 JSON 으로 쓴다(그림은 render_scene.py).
//   node_modules/.bin/vite-node scripts/content/sengoku-edo/qa/compose-scene.mts -- <out.json> <style> <W> <H> <seed>
import fs from "node:fs";
import data from "../../../../src/assets/sengokuEdoTileset.json";
import { composeSengokuEdo, sengokuPaletteFromTileset, type SengokuStyle } from "../../../../src/project/sengokuEdoComposer";

const [out, style, W, H, seed] = process.argv.slice(2).filter((a) => a !== "--");
const pal = sengokuPaletteFromTileset(data as never);
const r = composeSengokuEdo({ width: Number(W), height: Number(H), style: style as SengokuStyle, seed: Number(seed) }, pal);
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), style, seed: Number(seed), lower: r.lower, upper: r.upper, buildings: r.buildings, start: r.start, props: r.props, notes: r.notes }));
console.log(`${style} ${W}x${H} seed ${seed}: 건물 ${r.buildings.length} · 소품 ${r.props.length} · ${r.notes.join(" / ")}`);
