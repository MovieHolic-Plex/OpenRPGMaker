// 캠퍼스 구성기 QA — 구운 번들 정의(src/assets/modernCampusTileset.json)로 composeCampus 를 돌려 칸 배열을 JSON 으로 쓴다(그림은 render_scene.py).
//   node_modules/.bin/vite-node scripts/content/modern-campus/qa/compose-scene.mts -- <out.json> <school|university> <W> <H> <seed>
import fs from "node:fs";
import data from "../../../../src/assets/modernCampusTileset.json";
import { composeCampus, campusPaletteFromTileset } from "../../../../src/project/campusComposer";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [out, style, W, H, seed] = args;
const pal = campusPaletteFromTileset(data as never);
const r = composeCampus({ width: Number(W), height: Number(H), style: style as "school" | "university", seed: Number(seed) }, pal);
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), style, seed: Number(seed), lower: r.lower, upper: r.upper, buildings: r.buildings, start: r.start, gate: r.gate, props: r.props, notes: r.notes }));
console.log(`${style} ${W}x${H} seed ${seed}: 건물 ${r.buildings.length} · 소품 ${r.props.length} · ${r.notes.join(" / ")}`);
