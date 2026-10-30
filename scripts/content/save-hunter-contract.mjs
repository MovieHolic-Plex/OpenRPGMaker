// Save a baked 「사냥꾼 계약」 project into its canonical local project store, reopen it and prove the reload is identical.
// The flagship is built by code (flagship/hunter → bake-flagship-demos); this keeps a SQLite 정본 of each bake.
// Usage: node scripts/content/save-hunter-contract.mjs <baked hunter-contract.project.json> [--dir .oprn-projects/hunter-contract]
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";
const src = process.argv[2];
if (!src) { console.error("usage: save-hunter-contract.mjs <project.json> [--dir <projectDir>]"); process.exit(2); }
const dirArg = process.argv.indexOf("--dir");
const rel = dirArg > 0 ? process.argv[dirArg + 1] : ".oprn-projects/hunter-contract";
const dir = rel.startsWith("/") ? rel : process.cwd() + "/" + rel;
const project = JSON.parse(fs.readFileSync(src, "utf8"));
await withTsModule("electron/local-store/store.ts", "hunter-contract-store.mjs", async (api) => {
  let s = await api.initLocalProjectStore({ projectDir: dir }), id;
  try {
    const before = s.loadSnapshot();
    id = s.info().projectId;
    const r = await s.saveSerialized(JSON.stringify(project), before?.sha256 ?? null);
    assert.equal(r.kind, "saved");
  } finally { s.close(); }
  s = await api.openLocalProjectStore({ projectDir: dir });
  try {
    const a = s.loadSnapshot();
    const got = JSON.parse(JSON.stringify(a.project));
    // The store's load migrates the legacy opening scene shape (image → animatic); everything else must be byte-identical.
    // 번들 타일셋(bundledTilesetDiff 로 저장된 것)은 불러오면 번들 정의로 되살아난다 — 저장한 차이 키만 같으면 된다.
    for (const [id, saved] of Object.entries(project.tilesets ?? {})) {
      if (!saved?.bundledTilesetDiff || !got.tilesets?.[id]) continue;
      got.tilesets[id] = Object.fromEntries(Object.keys(saved).filter((k) => k !== "bundledTilesetDiff").map((k) => [k, got.tilesets[id][k]]));
      project.tilesets[id] = Object.fromEntries(Object.entries(saved).filter(([k]) => k !== "bundledTilesetDiff"));
    }
    for (const key of ["maps", "database", "tilesets", "mapTree", "startMapId", "startPos", "assets"]) {
      if (!isDeepStrictEqual(got[key], project[key])) {
        const d = [];
        const w = (x, y, path) => { if (d.length > 8 || isDeepStrictEqual(x, y)) return; if (x && y && typeof x === "object" && typeof y === "object") { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) w(x[k], y[k], path + "." + k); } else d.push(path + " saved=" + JSON.stringify(y)?.slice(0, 80) + " reloaded=" + JSON.stringify(x)?.slice(0, 80)); };
        w(got[key], project[key], key);
        assert.fail(`Reload differs in ${key}:\n${d.join("\n")}`);
      }
    }
    const strip = (p) => ({ ...p, system: { ...p.system, opening: undefined } });
    if (!isDeepStrictEqual(strip(got), strip(project))) {
      const diff = [];
      const walk = (x, y, path) => {
        if (diff.length > 8) return;
        if (isDeepStrictEqual(x, y)) return;
        if (x && y && typeof x === "object" && typeof y === "object") {
          for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], path + "." + k);
        } else diff.push(path + " saved=" + JSON.stringify(y)?.slice(0, 80) + " reloaded=" + JSON.stringify(x)?.slice(0, 80));
      };
      walk(strip(got), strip(project), "");
      throw new Error("Reload differs:\n" + diff.join("\n"));
    }
    console.log(JSON.stringify({ projectId: id, projectDir: rel, revision: a.revision, sha256: a.sha256, saved: true, reopened: true, maps: Object.keys(project.maps).length }));
  } finally { s.close(); }
});
