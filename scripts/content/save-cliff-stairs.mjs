// Apply the cheeked cliff stairs (fix-cliff-stairs.mjs) inside a canonical local project, save, reopen and prove the
// reload is identical, then write the reloaded export (feeds prepare-*-regions). For stores whose pipeline has no save
// script of its own (forest villages: .oprn-projects/village-diversity-20260923).
// Usage: node scripts/content/save-cliff-stairs.mjs .oprn-projects/<dir> <reloaded-out.json>
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { fixMapStairs } from "./fix-cliff-stairs.mjs";

const [dirArg, out] = process.argv.slice(2);
if (!dirArg || !out) throw Error("Usage: save-cliff-stairs.mjs <projectDir> <reloaded-out.json>");
const dir = fs.realpathSync(dirArg);
await withTsModule("electron/local-store/store.ts", "cliff-stairs-store.mjs", async (api) => {
  let s = await api.openLocalProjectStore({ projectDir: dir }), project, id, changed = {};
  try {
    const before = s.loadSnapshot();
    id = s.info().projectId;
    project = JSON.parse(JSON.stringify(before.project));
    for (const m of Object.values(project.maps ?? {})) { const c = fixMapStairs(m); if (c.length) changed[m.id] = c.length; }
    if (Object.keys(changed).length) assert.equal((await s.saveSerialized(JSON.stringify(project), before.sha256)).kind, "saved");
  } finally { s.close(); }
  s = await api.openLocalProjectStore({ projectDir: dir });
  try {
    const a = s.loadSnapshot();
    assert(isDeepStrictEqual(JSON.parse(JSON.stringify(a.project)), project), "Reload differs");
    fs.writeFileSync(out, JSON.stringify(a.project));
    console.log({ projectId: id, projectDir: dirArg, revision: a.revision, sha256: a.sha256, changed });
  } finally { s.close(); }
});
