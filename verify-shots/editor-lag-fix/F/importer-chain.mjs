// 사용법: node importer-chain.mjs <entry.ts> <대상 경로 부분문자열>
// esbuild metafile 로 entry 에서 대상 모듈까지의 (최단) import 사슬을 찍는다. 번들은 쓰지 않는다.
import { build } from "esbuild";
import { resolve } from "node:path";
const root = process.cwd();
const [entry, target] = process.argv.slice(2);
const r = await build({
  absWorkingDir: root,
  entryPoints: [resolve(root, entry)],
  bundle: true,
  write: false,
  metafile: true,
  platform: "node",
  format: "esm",
  external: ["electron", "node:*"],
  logLevel: "silent",
  loader: { ".png": "dataurl" },
});
const inputs = r.metafile.inputs;
const start = Object.keys(inputs).find((k) => resolve(root, k) === resolve(root, entry));
const prev = new Map([[start, null]]);
const queue = [start];
let hit = null;
while (queue.length) {
  const cur = queue.shift();
  if (cur.includes(target)) { hit = cur; break; }
  for (const imp of inputs[cur]?.imports ?? []) {
    if (!inputs[imp.path] || prev.has(imp.path)) continue;
    prev.set(imp.path, cur);
    queue.push(imp.path);
  }
}
if (!hit) { console.log("도달 못함"); process.exit(0); }
const chain = [];
for (let c = hit; c; c = prev.get(c)) chain.push(c);
console.log(chain.reverse().join("\n -> "));
