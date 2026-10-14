// 사막·동양풍 구성기 QA — 구운 정의(기본 src/assets, DE_DIR 로 다른 폴더)로 composeDesertEast 를 돌려 칸 배열 JSON 을 쓴다(그림은 render_scene.py).
//   node_modules/.bin/vite-node scripts/content/desert-east/qa/compose-scene.mts -- <out.json> <kind> <W> <H> <seed>
import fs from "node:fs";
import path from "node:path";
import { composeDesertEast, desertPaletteFromTileset, type DesertKind } from "../../../../src/project/desertEastComposer";

const dir = process.env.DE_DIR ?? path.resolve(import.meta.dirname ?? __dirname, "../../../../src/assets");
const data = JSON.parse(fs.readFileSync(path.join(dir, "desertEastTileset.json"), "utf8"));
const pieces = JSON.parse(fs.readFileSync(path.join(dir, "desertEastPieces.json"), "utf8"));
const args = process.argv.slice(2).filter((a) => a !== "--");
const [out, kind, W, H, seed] = args;
const pal = desertPaletteFromTileset(data, pieces);
const r = composeDesertEast({ width: Number(W), height: Number(H), kind: kind as DesertKind, seed: Number(seed), debugKeepUnreachable: !!process.env.DE_DEBUG }, pal);
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), kind, seed: Number(seed), lower: r.lower, upper: r.upper, buildings: r.buildings, zones: r.zones, start: r.start, props: r.props, notes: r.notes }));
console.log(`${kind} ${W}x${H} seed ${seed}: 건물 ${r.buildings.length} · 소품 ${r.props.length} · 구역 ${r.zones.length} · ${r.notes.join(" / ")}`);
