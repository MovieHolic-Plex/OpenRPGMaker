#!/usr/bin/env node
// 내보낸 게임(플레이어 빌드)에 실리는 소스·패키지를 import 그래프로 뽑는다.
// 런타임은 MIT 로 나가므로(LICENSE-RUNTIME.md) 에디터·하네스 코드가 끌려 들어오는지, 고지가 필요한 외부 패키지가 무엇인지 본다.
//
//   node scripts/oss/runtime-graph.mjs [--json]
//
// vite.player.config.ts 의 별칭 두 개를 그대로 흉내 낸다. esbuild metafile 은 tree-shaking 전 입력이라
// 실제 번들보다 넓게 잡힌다 — "끌려 들어올 수 있는 것" 의 상한으로 읽을 것.
import { build } from "esbuild";
import path from "node:path";

const root = process.cwd();
const src = (p) => path.join(root, "src", p);
const EMPTY = [".png", ".css", ".svg", ".woff2", ".woff", ".ttf", ".mp3", ".ogg", ".wav", ".gif", ".webp", ".jpg", ".mid"];

const alias = {
  name: "player-alias",
  setup(b) {
    b.onResolve({ filter: /^@\/app\/mode$/ }, () => ({ path: src("player/exportAppModeShim.ts") }));
    b.onResolve({ filter: /^@\/project\/store$/ }, () => ({ path: src("player/exportProjectStoreShim.ts") }));
    b.onResolve({ filter: /^@\// }, (a) => b.resolve(`./${a.path.slice(2)}`, { resolveDir: src(""), kind: a.kind }));
    b.onResolve({ filter: /\?(raw|url|inline|worker)$/ }, (a) => ({ path: a.path, external: true }));
  },
};

const result = await build({
  entryPoints: ["src/player/exportEntry.ts"],
  bundle: true, write: false, metafile: true, format: "esm", platform: "browser", logLevel: "error",
  plugins: [alias], external: ["node:*"],
  loader: Object.fromEntries(EMPTY.map((ext) => [ext, "empty"])),
});

const inputs = Object.keys(result.metafile.inputs);
const sources = inputs.filter((f) => f.startsWith("src/"));
const packages = [...new Set(inputs.filter((f) => f.includes("node_modules/")).map((f) => {
  const parts = f.split("node_modules/").pop().split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}))].sort();
const suspicious = sources.filter((f) => /^src\/(editor|harnesses|testing|qa|benchmark|evals)\//.test(f));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ sources, packages, suspicious }, null, 2));
} else {
  const byDir = {};
  for (const f of sources) { const d = f.split("/").slice(0, 2).join("/"); byDir[d] = (byDir[d] ?? 0) + 1; }
  console.log(`소스 ${sources.length}개`);
  for (const [d, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${d} ${n}`);
  console.log(`외부 패키지: ${packages.join(", ") || "(없음)"}`);
  console.log(`런타임에 있으면 안 되는 쪽(editor·harnesses·testing 등) ${suspicious.length}개`);
  for (const f of suspicious) console.log(`  ${f}`);
}
