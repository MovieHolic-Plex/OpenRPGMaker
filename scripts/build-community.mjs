import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export class CommunityBuildPipelineError extends Error {
  name = "CommunityBuildPipelineError";

  constructor(step) {
    super(`community release stopped at ${step}`);
    this.step = step;
  }
}

export const COMMUNITY_BUILD_STEPS = Object.freeze([
  Object.freeze({ name: "build-player", cwd: "repo", script: "build:player" }),
  Object.freeze({ name: "sync-player", cwd: "site", script: "sync:player" }),
  Object.freeze({ name: "verify-player", cwd: "site", script: "verify:player" }),
  Object.freeze({ name: "build-community", cwd: "site", script: "build" }),
]);

export async function runCommunityBuildPipeline(options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? path.dirname(fileURLToPath(new URL("../package.json", import.meta.url))));
  const siteRoot = path.resolve(options.siteRoot ?? path.join(repoRoot, "community-site"));
  const runner = options.runner ?? runNpmScript;
  for (const step of COMMUNITY_BUILD_STEPS) {
    try {
      await runner({
        step: step.name,
        script: step.script,
        cwd: step.cwd === "repo" ? repoRoot : siteRoot,
      });
    } catch {
      throw new CommunityBuildPipelineError(step.name);
    }
  }
}

async function runNpmScript({ script, cwd }) {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  await new Promise((resolve, reject) => {
    const child = spawn(executable, ["run", script], { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new CommunityBuildPipelineError(script));
    });
  });
}

async function main() {
  try {
    await runCommunityBuildPipeline();
  } catch (error) {
    if (error instanceof CommunityBuildPipelineError) {
      console.error(`community-build failed [${error.step}]: release pipeline stopped`);
    } else {
      console.error("community-build failed [unexpected]: release pipeline stopped");
    }
    process.exitCode = 1;
  }
}

const directUrl = process.argv[1] === undefined ? "" : pathToFileURL(path.resolve(process.argv[1])).href;
if (directUrl === import.meta.url) await main();
