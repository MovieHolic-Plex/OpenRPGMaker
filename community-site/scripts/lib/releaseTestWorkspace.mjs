import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sourceSite = path.join(sourceRoot, "community-site");
const require = createRequire(path.join(sourceSite, "package.json"));

/** Plain node:test entry support, using only the checkout's installed dependencies.
 * Copy source inputs explicitly: never consume a checkout's .next, env or runtime archive. */
export async function prepareReleaseTestWorkspace({ directory, databaseUrl, evidenceDirectory }) {
  const repo = path.join(directory, "repo");
  const site = path.join(repo, "community-site");
  await mkdir(site, { recursive: true });
  for (const name of ["src", "package.json", "package-lock.json", "tsconfig.json"]) {
    await cp(path.join(sourceRoot, name), path.join(repo, name), { recursive: true });
  }
  for (const name of ["app", "components", "lib", "public", "package.json", "package-lock.json", "tsconfig.json"]) {
    await cp(path.join(sourceSite, name), path.join(site, name), { recursive: true });
  }
  await symlink(await realpath(path.join(sourceRoot, "node_modules")), path.join(repo, "node_modules"), "dir");
  await symlink(await realpath(path.join(sourceSite, "node_modules")), path.join(site, "node_modules"), "dir");

  // Keep the real Next configuration, limiting only QA worker count and trace scope.
  await build({ entryPoints: [path.join(sourceSite, "next.config.ts")],
    outfile: path.join(site, "next.config.base.mjs"), bundle: true, platform: "node", format: "esm", packages: "external" });
  await writeFile(path.join(site, "next.config.mjs"),
    `import config from "./next.config.base.mjs";\nexport default { ...config, outputFileTracingRoot: ${JSON.stringify(repo)}, experimental: { ...config.experimental, cpus: 2 } };\n`);

  const bundle = path.join(repo, "release-test-api.mjs");
  await build({ stdin: { resolveDir: repo, contents: `
    export { createGameRelease, createRuntimeManifest, jsonBytes } from "./src/project/gameRelease.ts";
    export { writeStoredZip } from "./src/project/packageZip.ts";
    export { createReleaseUploadHandler, readBoundedJson } from "./community-site/lib/releaseUpload.ts";
    export { createReleaseLoader, insertReleaseListing } from "./community-site/lib/releaseStore.ts";
    export { createReleasePlayHandler, createReleaseDownloadHandler } from "./community-site/lib/releaseRoutes.ts";
    export { validateReleaseArchive } from "./community-site/lib/releaseArchive.ts";
  ` }, outfile: bundle, bundle: true, platform: "node", format: "esm", target: "node24", packages: "external" });

  assert.equal(existsSync(path.join(site, ".next")), false, "QA must build from clean artifacts");
  const buildLog = path.join(evidenceDirectory, "next-build.log");
  console.log(`Building isolated community source from clean artifacts: ${site}`);
  const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", "--webpack"], {
    cwd: site, env: { ...process.env, COMMUNITY_DATABASE_URL: databaseUrl },
    encoding: "utf8", stdio: "pipe", timeout: 300_000, maxBuffer: 4 * 1024 * 1024,
  });
  await writeFile(buildLog, `${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Isolated Next build failed; see ${buildLog}`);
  assert.ok((await readFile(path.join(site, ".next", "BUILD_ID"), "utf8")).trim());
  return { site, api: await import(pathToFileURL(bundle).href) };
}
