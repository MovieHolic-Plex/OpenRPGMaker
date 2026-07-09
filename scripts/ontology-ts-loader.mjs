import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ONTOLOGY_ENTRY = resolve(REPO_ROOT, "src/project/ontology/index.ts");

export async function withOntologyModule(callback) {
  return withTsModule(ONTOLOGY_ENTRY, "ontology.mjs", callback);
}

export async function withTsModule(entryPoint, outputName, callback) {
  const tempDir = await mkdtemp(resolve(tmpdir(), "rpg-zzu-ontology-"));
  const outputFile = resolve(tempDir, outputName);
  await build({
    absWorkingDir: REPO_ROOT,
    bundle: true,
    entryPoints: [entryPoint],
    format: "esm",
    logLevel: "silent",
    outfile: outputFile,
    platform: "node",
    plugins: [{
      name: "rpg-zzu-src-alias",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@\// }, (args) => ({
          path: resolveAlias(args.path),
        }));
      },
    }],
  });
  try {
    const ontologyModule = await import(`${pathToFileURL(outputFile).href}?cacheBust=${Date.now()}`);
    return await callback(ontologyModule);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function resolveAlias(path) {
  const resolved = resolve(REPO_ROOT, "src", path.slice(2));
  if (extname(resolved)) return resolved;
  const typedPath = `${resolved}.ts`;
  if (existsSync(typedPath)) return typedPath;
  const indexPath = resolve(resolved, "index.ts");
  return existsSync(indexPath) ? indexPath : resolved;
}
