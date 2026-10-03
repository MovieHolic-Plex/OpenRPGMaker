// Save the UI capture to an isolated SQLite folder, close it, and reload it.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "../ontology-ts-loader.mjs";

const folder = resolve(".vite-cache/terrain-design-store");
await withTsModule(resolve("electron/local-store/store.ts"), "terrain-store.mjs", async ({ initLocalProjectStore, openLocalProjectStore }) => {
  const first = await initLocalProjectStore({ projectDir: folder });
  let saved, projectId;
  try {
    saved = await first.saveSerialized(readFileSync(".vite-cache/terrain-design-fixture.json", "utf8"));
    if (saved.kind !== "saved") throw new Error("QA store conflict");
    projectId = first.projectId;
  } finally { first.close(); }
  const second = await openLocalProjectStore({ projectDir: folder });
  let result;
  try {
    const loaded = second.loadSnapshot();
    if (!loaded) throw new Error("Missing saved QA document");
    const p = loaded.project, m = p.maps[p.startMapId];
    result = {
      projectId, store: folder, revision: loaded.revision,
      stamps: p.terrainStamps?.length, locks: m.terrainDesign?.lockedCells?.length,
      shallowCells: m.terrainDesign?.waterDepth?.filter(v => v === 1).length,
      deepCells: m.terrainDesign?.waterDepth?.filter(v => v > 1).length,
      rampCells: m.relief?.ramps?.filter(Boolean).length, groups: m.doodadGroups?.length,
      canonicalReload: true, isolatedQAFixture: true,
    };
  } finally { second.close(); }
  if (!(result.stamps === 1 && result.locks === 9 && result.shallowCells > 0 && result.deepCells > 0 && result.rampCells > 0 && result.groups > 0)) throw new Error("Roundtrip lost terrain data");
  writeFileSync("verify-shots/terrain-design-suite/sqlite-roundtrip.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
});
