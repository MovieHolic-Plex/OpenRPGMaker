// 사막·동양풍 방 QA — vite-node compose-room.mts -- <out.json> <kind> <W> <H> <seed>   (DE_DIR 로 구운 정의 폴더)
import fs from "node:fs";
import path from "node:path";
import { composeDesertRoom, desertPaletteFromTileset, type DesertRoomKind } from "../../../../src/project/desertEastComposer";

const dir = process.env.DE_DIR ?? path.resolve(import.meta.dirname ?? __dirname, "../../../../src/assets");
const data = JSON.parse(fs.readFileSync(path.join(dir, "desertEastTileset.json"), "utf8"));
const pieces = JSON.parse(fs.readFileSync(path.join(dir, "desertEastPieces.json"), "utf8"));
const [out, kind, W, H, seed] = process.argv.slice(2).filter((a) => a !== "--");
const r = composeDesertRoom({ width: Number(W), height: Number(H), kind: kind as DesertRoomKind, seed: Number(seed) }, desertPaletteFromTileset(data, pieces));
fs.writeFileSync(out!, JSON.stringify({ width: Number(W), height: Number(H), kind, lower: r.lower, upper: r.upper, doors: r.doors, props: r.props, notes: r.notes }));
console.log(`${kind} ${W}x${H}: 가구 ${r.props.length} · ${r.notes.join(" / ")}`);
