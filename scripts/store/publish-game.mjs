// npm run store:publish-game 의 입구 — 데모 빌드가 큰 힙을 쓰므로 vite-node 를 힙 옵션과 함께 띄운다. 본체는 publish-game.mts.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const result = spawnSync(process.execPath, [
  "--max-old-space-size=12000",
  "node_modules/vite-node/dist/cli.mjs",
  "--script",
  "scripts/store/publish-game.mts",
  ...process.argv.slice(2),
], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
