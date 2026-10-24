// 런타임 QA 시나리오의 `projectGenerator` — 생성기 게임(kind: generator)의 프로젝트를 **실행 시점에**
// 제품과 같은 코드 경로로 만든다. 커밋된 시나리오가 tmp 산출물을 가리키면 다른 기계에서 안 돌기 때문에,
// 큰 생성기 게임은 픽스처를 커밋하는 대신 여기서 다시 만든다(실측: scarloxy-demo project.json 72MB).
//
// 실행기는 build-games.mjs 와 같다: npx 캐시에 기대지 않도록 tsx 판을 고정하고, .css import 는 스텁으로 받는다.
// 산출물은 build-games 와 같은 자리(tmp/qp/games/<game>/project.json)에 두고 있으면 재사용한다 —
// 생성기 소스를 고친 뒤에는 `QA_REGENERATE_GENERATED=1` 로 다시 만들거나 그 폴더를 지워라.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const GENERATOR = join(REPO_ROOT, "scripts/qa/play/generate-project.mts");
const CSS_STUB = join(REPO_ROOT, "tiledata/jp-city/refs/css-stub.mjs");
const TSX_VERSION = "tsx@4.23.15";

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`${command} ${args.join(" ")} → exit ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

/**
 * `scenario.projectGenerator.game` 의 project.json 을 만들고 경로를 돌려준다.
 * 이미 있으면 재사용한다(`QA_REGENERATE_GENERATED=1` 이면 다시 만든다).
 */
export async function materializeGeneratedProject(gameId, { outRoot = "tmp/qp/games" } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(gameId ?? ""))) throw new Error(`projectGenerator.game 은 kebab-case: ${gameId}`);
  if (!existsSync(GENERATOR)) throw new Error(`생성기 실행기가 없다: ${GENERATOR}`);
  const dir = resolve(REPO_ROOT, outRoot, gameId);
  const target = join(dir, "project.json");
  const reuse = existsSync(target) && process.env.QA_REGENERATE_GENERATED !== "1";
  if (reuse) {
    const info = await stat(target);
    process.stdout.write(`projectGenerator: 재사용 ${target} (${info.size} bytes, ${info.mtime.toISOString()})\n`);
    return target;
  }
  await mkdir(dir, { recursive: true });
  const startedAt = Date.now();
  const result = await run("npx", ["--yes", TSX_VERSION, "--import", CSS_STUB, GENERATOR, gameId, dir]);
  if (!existsSync(target)) throw new Error(`projectGenerator: ${gameId} 생성 뒤 project.json 이 없다\n${result.stdout.slice(-1000)}`);
  const info = await stat(target);
  process.stdout.write(`projectGenerator: 생성 ${target} (${info.size} bytes, ${Math.round((Date.now() - startedAt) / 1000)}s)\n`);
  return target;
}
