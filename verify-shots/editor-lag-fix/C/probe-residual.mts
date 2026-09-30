// C: 격리 이후 카드당 잔여 비용 분해.
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { deserialize, deserializeParsed } from "../../../src/project/io/serialize";
import { isolateProject } from "../../../src/editor/spatial/compileIsolation";
import { previewPlaceMaps } from "../../../src/editor/panels/spatialPlacePreview";

const store = await openLocalProjectStore({ projectDir: "/tmp/lag-proj-C" });
const raw = store.exportSerialized()!;
const project = deserialize(raw);
store.close();
const t = <T,>(l: string, f: () => T): T => { const s = performance.now(); const r = f(); console.log(l.padEnd(34), Math.round(performance.now() - s), "ms"); return r; };

for (let i = 0; i < 2; i++) t("isolateProject", () => isolateProject(project));
const light = t("light stringify+parse", () => JSON.parse(JSON.stringify({ ...project, tilesets: {} })));
console.log("light bytes", JSON.stringify(light).length);
const stubs: Record<string, unknown> = {};
for (const [id, ts] of Object.entries(project.tilesets)) {
  const s: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ts)) if (!["referenceDocuments", "tileMeta", "tileGroups", "autotileGroups", "palettePresets", "structureKits"].includes(k)) s[k] = v;
  stubs[id] = s;
}
t("deserializeParsed(light+stubs)", () => deserializeParsed({ ...light, tilesets: stubs }));
t("deserializeParsed(light, no tilesets)", () => { try { return deserializeParsed({ ...JSON.parse(JSON.stringify({ ...project, tilesets: {} })), tilesets: {} }); } catch (e) { return String(e).slice(0, 80); } });
const place = Object.values(project.spatialAuthoring!.library.places)[0];
for (let i = 0; i < 2; i++) t("previewPlaceMaps", () => previewPlaceMaps({ project, place, floor: null }));
