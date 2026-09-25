// Publish one atlas map pipeline (tiledata/atlas-<name>/catalog.json) to the host shared-content SQLite (공용 DB):
// towns and biome fields as 지역 (regions), dungeon floors, ship decks and scene buildings as 장소 (places), via
// lib/shared-library.mjs (baked shared atlas, pixel-identical render check, reload compare).
// Tileset definitions: the catalog's own `tilesets`, else the pipeline's tileset builder (towns: atlas-towns-entry.ts,
// biomes: atlasBiomes.ts / blank project world sheet), fetched from the dev server.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/publish-atlas-shared-library.mjs <towns|biomes|dungeons|scenes> [--part k/n] [--dry]
// --part k/n publishes the k-th of n equal slices as library oprn-atlas-<name>-20260925-<k> (the host limit is 60MB per library).
import fs from "node:fs";
import { chromium } from "playwright";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { publishLibrary } from "./lib/shared-library.mjs";

const name = process.argv[2];
const DRY = process.argv.includes("--dry");
const DEV_URL = process.env.DEV_URL;
const dir = `tiledata/atlas-${name}`;
const catalog = JSON.parse(fs.readFileSync(`${dir}/catalog.json`, "utf8"));
const all = Array.isArray(catalog.maps) ? catalog.maps : Object.values(catalog.maps);
const partArg = process.argv[process.argv.indexOf("--part") + 1];
const [k, n] = process.argv.includes("--part") ? partArg.split("/").map(Number) : [1, 1];
const size = Math.ceil(all.length / n);
const maps = all.slice((k - 1) * size, k * size);
const plans = Object.fromEntries((Array.isArray(catalog.plans) ? catalog.plans : Object.values(catalog.plans)).map((p) => [p.id, p]));
const ids = [...new Set(maps.map((m) => m.tilesetId))];

async function tilesetDefs() {
  if (catalog.tilesets) return Array.isArray(catalog.tilesets) ? Object.fromEntries(catalog.tilesets.map((t) => [t.id, t])) : catalog.tilesets;
  if (name === "towns") {
    const { townTilesets } = await import("./lib/atlas-town-map.mjs");
    return withTsModule("scripts/content/lib/atlas-towns-entry.ts", "atlas-publish-entry.mjs", (api) => townTilesets(api));
  }
  const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
  try {
    const page = await b.newPage();
    await page.route("**/__defs", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
    await page.goto(DEV_URL + "/__defs");
    return await page.evaluate(async (ids) => {
      const { createAtlasBiomeTileset } = await import("/src/project/defaults/atlasBiomes.ts");
      const blank = (await import("/src/project/defaults/blankProject.ts")).createBlankProject().tilesets;
      return Object.fromEntries(ids.map((id) => [id, id === "atlas_biome_world" ? blank[id] : createAtlasBiomeTileset(id.replace("atlas_biome_", ""))]));
    }, ids);
  } finally { await b.close(); }
}

const LABEL = { towns: "마을", biomes: "바이옴", dungeons: "던전", scenes: "장면" };
const defs = await tilesetDefs();
const tilesets = Object.fromEntries(ids.map((id) => {
  if (!defs?.[id]?.count) throw new Error(`no tileset definition for ${id}`);
  return [id, { id: `shared_atlas_${id.replace(/^(atlas_|oprn_)/, "")}`, name: `${defs[id].name ?? id} (아틀라스 ${LABEL[name]} 공용)`, def: defs[id] }];
}));

const style = (id) => /tibo/.test(id) ? "Tibo" : "EasyRPG";
const tag = (tilesetId, category, env, ...purposes) => [`그림체:${style(tilesetId)}`, `장소유형:${category}`, `공간형태:${env}`, ...purposes.map((p) => `용도:${p}`), "RPG 판타지"];
const xy = (e) => Array.isArray(e) ? e : e && Number.isFinite(e.x) ? [e.x, e.y] : undefined;

const entries = maps.map((map) => {
  const p = plans[map.id] ?? {};
  const base = { id: map.id.replace(/_/g, "-").toLowerCase(), name: map.name ?? p.name ?? map.id, map, key: map.tilesetId, entry: xy(p.entry) };
  if (name === "towns") return { ...base, as: "region", regionKind: "settlement", tags: tag(map.tilesetId, "마을·도시", "실외", "마을"), limitations: p.note ?? "" };
  if (name === "biomes") {
    const world = map.tilesetId === "atlas_biome_world";
    return { ...base, as: "region", regionKind: "terrain", tags: tag(map.tilesetId, "자연", "실외", world ? "월드맵" : "탐험"),
      limitations: world ? "월드·지역 지도: 검수 전(올스탑 시점 미완)" : p.note ?? "" };
  }
  if (name === "dungeons") return { ...base, as: "place", tags: tag(map.tilesetId, "던전·유적", /roof|temple/.test(map.id) ? "건물 내부" : "지하", "탐험") };
  const region = p.as === "region";
  const ship = /ship/.test(map.tilesetId);
  return { ...base, as: region ? "region" : "place", ...(region ? { regionKind: "terrain" } : {}),
    tags: p.placeTags?.length ? p.placeTags : tag(map.tilesetId, ship ? "이동수단" : "건물·시설", ship ? "건물 내부" : "실외", ship ? "항해" : "시설") };
});

const out = await publishLibrary({ id: `oprn-atlas-${name}-20260925${n > 1 ? "-" + k : ""}`, sourceProjectId: `atlas-${name}-20260925`, devUrl: DEV_URL, tilesets, entries,
  proof: `${dir}/shared-library-proof${n > 1 ? "-" + k : ""}.json`, dry: DRY });
console.log(JSON.stringify({ ...out, tilesets: Object.keys(out.tilesets) }, null, 2));
