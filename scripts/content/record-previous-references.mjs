// Record the shipped revision of every category in a bundled reference asset, before its content changes
// under a new category id. The ensure functions then retire an old category only while it is an exact
// shipped copy; a project's own edits to it are kept.
// Usage: node scripts/content/record-previous-references.mjs src/assets/sharedFieldRouteReferences.json tiledata/field-routes/previous-reference.json
import fs from "node:fs";
import { withTsModule } from "../ontology-ts-loader.mjs";

const [asset, target] = process.argv.slice(2);
const categories = Object.values(JSON.parse(fs.readFileSync(asset, "utf8")));
const recorded = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : [];
await withTsModule("src/project/tilesetReferences.ts", "record-previous.mjs", ({ referenceRevision }) => {
  for (const c of categories) if (!recorded.some((r) => r.id === c.id)) recorded.push({ id: c.id, revision: referenceRevision(c) });
});
fs.writeFileSync(target, JSON.stringify(recorded, null, 2) + "\n");
console.log(recorded);
