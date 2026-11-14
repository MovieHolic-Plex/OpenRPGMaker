#!/usr/bin/env node
// Sameness across built games: per game the set of (tilesetId, tile index) painted on any layer of any map, then the
// pairwise Jaccard overlap of those sets. Also counts tilesets, maps and the distinct genres among games that produced
// a project. Reads <runs dir>/<id>/check/project.json (written by build-one.sh).
//   node scripts/game-factory/sameness.mjs <runs dir> [--ids g01,g02] > sameness.json
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "");
const idx = process.argv.indexOf("--ids");
const want = idx > 0 ? new Set(process.argv[idx + 1].split(",")) : null;
const games = [];
for (const id of readdirSync(dir).sort()) {
  if (want && !want.has(id)) continue;
  const file = resolve(dir, id, "check", "project.json");
  if (!existsSync(file)) continue;
  const project = JSON.parse(readFileSync(file, "utf8"));
  const spec = existsSync(resolve(dir, id, "spec.json")) ? JSON.parse(readFileSync(resolve(dir, id, "spec.json"), "utf8")) : {};
  const tiles = new Set();
  const tilesets = new Set();
  for (const map of Object.values(project.maps ?? {})) {
    tilesets.add(map.tilesetId);
    for (const layer of ["lowerTiles", "lowerOverlayTiles", "upperTiles"]) {
      for (const t of map[layer] ?? []) if (typeof t === "number" && t >= 0) tiles.add(`${map.tilesetId}:${t}`);
    }
  }
  games.push({ id, genre: spec.genre ?? null, maps: Object.keys(project.maps ?? {}).length, tilesets: [...tilesets], tiles });
}
const pairs = [];
for (let i = 0; i < games.length; i += 1) for (let j = i + 1; j < games.length; j += 1) {
  const a = games[i].tiles; const b = games[j].tiles;
  let inter = 0; for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  pairs.push({ a: games[i].id, b: games[j].id, jaccard: union ? inter / union : 0 });
}
const values = pairs.map((p) => p.jaccard).sort((x, y) => x - y);
const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
const median = values.length ? values[Math.floor(values.length / 2)] : null;
const tilesetCount = new Set(games.flatMap((g) => g.tilesets)).size;
console.log(JSON.stringify({
  games: games.length,
  pairs: pairs.length,
  jaccard: { mean, median, max: values.at(-1) ?? null, min: values[0] ?? null },
  mostSimilar: [...pairs].sort((x, y) => y.jaccard - x.jaccard).slice(0, 5),
  distinctGenres: new Set(games.map((g) => g.genre).filter(Boolean)).size,
  distinctTilesets: tilesetCount,
  perGame: games.map((g) => ({ id: g.id, genre: g.genre, maps: g.maps, tilesets: g.tilesets, distinctTiles: g.tiles.size })),
}, null, 2));
