// npm run bake:demos 의 입구. OPRN_ASSUME_ALL_BGM_INSTALLED 를 OS 와 무관하게 넘기려고 셸 대신 여기서 띄운다
// (Windows cmd 는 `VAR=1 명령` 을 모른다). 굽기 본체는 bake-flagship-demos.mts.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const result = spawnSync(process.execPath, [
  "--max-old-space-size=12000",
  "node_modules/vite-node/dist/cli.mjs",
  "--script",
  "scripts/content/bake-flagship-demos.mts",
  ...process.argv.slice(2),
], { cwd: root, stdio: "inherit", env: { ...process.env, OPRN_ASSUME_ALL_BGM_INSTALLED: "1" } });
process.exit(result.status ?? 1);
