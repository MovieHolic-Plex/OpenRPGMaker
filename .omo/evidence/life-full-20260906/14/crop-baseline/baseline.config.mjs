import { mergeConfig } from "vitest/config";
import currentConfig from "../../../../../vitest.config.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const out = fileURLToPath(new URL("./", import.meta.url));
const identity = JSON.parse(readFileSync(`${out}/identity.json`, "utf8"));
const replacements = new Map(identity.sourceOverrides.map(entry => [resolve(entry.path), entry]));
const loaded = new Set();
export default mergeConfig(currentConfig, {
  cacheDir: `${out}/cache`,
  plugins: [{
    name: "task14-unchanged-baseline-source",
    enforce: "pre",
    load(id) {
      const entry = replacements.get(id.split("?")[0]);
      if (!entry) return null;
      loaded.add(entry.path);
      writeFileSync(`${out}/loaded-sources.json`, JSON.stringify([...loaded].sort(), null, 2) + "\n");
      // Load verbatim git-show baseline source at its original module id. All other
      // production files are verified unchanged, and the corrected test is untouched.
      return readFileSync(`${out}/source/${entry.path}`, "utf8");
    },
  }],
  test: { maxWorkers: 1, minWorkers: 1 },
});
