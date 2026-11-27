// ESC 허브 메뉴 QA 픽스처 — 구운 폴른 스타(play.json)에 system.menuLayout=hub 를 얹는다.
//   npm run bake:demos -- --out /tmp/fsb --only chrono-bell
//   node scripts/qa/runtime/esc-hub-fixture.mjs /tmp/fsb/demos/chrono-bell.play.json
//   npm run qa:runtime -- --scenario checkpoints --checkpoint-set esc-hub-desktop --checkpoint all
//   npm run qa:runtime -- --scenario checkpoints --checkpoint-set esc-hub-phone --checkpoint all
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const source = process.argv[2] ?? "/tmp/fsb/demos/chrono-bell.play.json";
const out = resolve(REPO_ROOT, process.argv[3] ?? ".omo/esc-hub/fixture.json");
const legacyOut = resolve(REPO_ROOT, process.argv[4] ?? ".omo/esc-hub/fixture-legacy.json");
const project = JSON.parse(await readFile(source, "utf8"));
await mkdir(dirname(out), { recursive: true });
await writeFile(legacyOut, JSON.stringify(project));
project.system = { ...project.system, menuLayout: "hub" };
await writeFile(out, JSON.stringify(project));
console.log(JSON.stringify({ out, legacyOut, menuLayout: project.system.menuLayout }));
