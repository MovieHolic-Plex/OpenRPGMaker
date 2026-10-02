import { readFile, writeFile } from "node:fs/promises";
import { defaultItemRecords } from "../../src/project/defaults/defaultDatabaseItemRecords";

// Keep authored JSON prices identical to the common seed's one pricing authority.
const path = "src/project/defaults/sharedItemCatalog.json";
const authored = JSON.parse(await readFile(path, "utf8"));
const defaults = new Map(defaultItemRecords().map(item => [item.id, item.price]));
for (const item of authored) {
  if (!defaults.has(item.id)) throw new Error(`Unregistered shared item: ${item.id}`);
  item.price = defaults.get(item.id);
}
await writeFile(path, JSON.stringify(authored, null, 2) + "\n");
console.log(JSON.stringify({ pricedSharedItems: authored.length }));
