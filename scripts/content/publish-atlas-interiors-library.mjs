// Publish the atlas interiors (100 Tibo rooms) to the host shared-content SQLite (공용 DB) as their own library:
// every map as a reviewed place (root → floor place → raster kit) on a `shared_` copy of the Tibo interior sheet
// (rows 69~71 included). Reads the canonical save (output/evidence/atlas-interiors/reloaded.json, written by
// save-atlas-interiors.mjs after reopening the .oprn-projects SQLite folder); publishLibrary refuses unless every map
// renders pixel-identically with the original and the shared tileset. Writes tiledata/atlas-interiors/shared-library-proof.json.
// Objects are not here: they are the bundled catalog tiledata/atlas-interiors/shared-objects.json.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/publish-atlas-interiors-library.mjs [--dry]
import fs from "node:fs";
import { publishLibrary } from "./lib/shared-library.mjs";

const LIBRARY_ID = "oprn-atlas-interiors-20260925";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const project = read("output/evidence/atlas-interiors/reloaded.json");
const catalog = read("tiledata/atlas-interiors/catalog.json");
const storage = read("tiledata/atlas-interiors/storage-proof.json");

// 용도 by group (spatialPlaceClassification: 그림체 / 장소유형 / 공간형태 / 용도).
const PURPOSE = {
  homes: "주택", shops: "상업시설", taverns: "숙박", guilds: "공공시설", schools: "공공시설", civic: "공공시설", civic2: "공공시설",
  crafts: "공방", castle: "성", sacred: "종교", ships: "항해",
};
function tags(plan) {
  const id = plan.id;
  const underground = /-b1$|cellar|vault|crypt|below-deck/.test(id);
  const category = plan.group === "ships" ? "이동수단" : "건물·시설";
  let purpose = PURPOSE[plan.group];
  if (plan.group === "climate") purpose = /house|cabin/.test(id) ? "주택" : /inn/.test(id) ? "숙박" : /bazaar|trading|cider/.test(id) ? "상업시설" : /forge/.test(id) ? "공방" : /shrine/.test(id) ? "종교" : "시설";
  if (/tavern/.test(id)) purpose = "음식";
  if (/theater|casino|bath|hot-spring|auction/.test(id)) purpose = "오락";
  if (/jail/.test(id)) purpose = "감옥";
  return ["그림체:Tibo", `장소유형:${category}`, `공간형태:${underground ? "지하" : "건물 내부"}`, `용도:${purpose}`, "RPG 판타지", "atlas 실내"];
}

const entries = catalog.plans.map((plan) => {
  const map = project.maps[plan.id];
  if (!map) throw new Error(`${plan.id} missing from the canonical save`);
  return { id: plan.id, name: plan.name, map, key: "tibo_interior_expanded", as: "place", tags: tags(plan), entry: plan.entry };
});
const result = await publishLibrary({
  id: LIBRARY_ID,
  sourceProjectId: storage.projectId,
  devUrl: process.env.DEV_URL,
  proof: "tiledata/atlas-interiors/shared-library-proof.json",
  tilesets: {
    tibo_interior_expanded: { id: "shared_atlas_tibo_interior", name: "실내 확장 · Tibo (atlas 실내 공용, 뒷모습 긴 의자·탁자 앞면 포함)",
      def: project.tilesets.tibo_interior_expanded, docs: /^(rpg-interiors-(?!ship|sewer)|fantasy-interiors)/ },
  },
  entries,
  dry: process.argv.includes("--dry"),
});
console.log(result);
