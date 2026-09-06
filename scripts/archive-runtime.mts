import { resolve } from "node:path";
import { retainRuntime, RUNTIME_ARCHIVE_FOLDER } from "./lib/runtimeArchive";

const root = process.cwd();
const manifest = await retainRuntime({ repoRoot: root, archiveRoot: resolve(root, RUNTIME_ARCHIVE_FOLDER),
  webRoot: resolve(root, "dist/export-player"), standaloneRoot: resolve(root, "dist/standalone-player"),
  publicRoot: resolve(root, "public") });
console.log(`Retained runtime ${manifest.runtimeTarget}`);
