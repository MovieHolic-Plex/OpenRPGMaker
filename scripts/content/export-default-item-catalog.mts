import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defaultDatabase } from "../../src/project/defaults/defaultDatabase";
import { defaultEquipmentRecords } from "../../src/project/defaults/defaultDatabaseEquipmentRecords";
import { CC0_ICON_ASSETS } from "../../src/assets/cc0IconAssets";

const outIndex = process.argv.indexOf("--out");
const destination = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : "output/item-catalog/default-catalog.json");
const database = defaultDatabase();
const catalog = {
  items: database.items,
  equipment: defaultEquipmentRecords(),
  skills: database.skills.map(({ id, name }) => ({ id, name })),
  states: database.states.map(({ id, name }) => ({ id, name })),
  icons: CC0_ICON_ASSETS,
};
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(catalog, null, 2) + "\n");
console.log(JSON.stringify({ destination, items: catalog.items.length, equipment: catalog.equipment.length, icons: catalog.icons.length }));
