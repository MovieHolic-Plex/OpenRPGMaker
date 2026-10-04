import { build } from "esbuild";
const root = "/home/main/z-project/rpg-zzu/.claude/worktrees/agent-a3711e758c37afb00";
for (const entry of ["electron/main/main.ts", "electron/serve/runtime.ts", "electron/browser/bridge.ts"]) {
  const r = await build({ absWorkingDir: root, entryPoints: [root + "/" + entry], bundle: true, write: false, metafile: true, platform: "node", format: "esm", external: ["electron", "node:*"], logLevel: "silent", loader: { ".png": "dataurl" } }).catch((e) => ({ errors: e.errors }));
  if (!r.metafile) { console.log(entry, "ERR", JSON.stringify(r.errors?.slice(0, 2))); continue; }
  const inputs = Object.entries(r.metafile.inputs).map(([k, v]) => [k, v.bytes]);
  const big = inputs.filter(([k]) => k.endsWith(".json") && k.startsWith("src/")).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const defaults = inputs.filter(([k]) => k.startsWith("src/project/defaults")).length;
  console.log(entry, "inputs", inputs.length, "defaults-files", defaults, "src-json", JSON.stringify(big));
}
