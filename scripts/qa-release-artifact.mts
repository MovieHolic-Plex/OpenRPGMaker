import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { preparePublication } from "@/project/publication";
import { createWebPlayerExportPackage } from "@/project/webExport";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { verifyGameRelease } from "@/project/gameRelease";
import { contractPath } from "@/project/playerDeploymentPaths";
import { readTrustedRuntime, RUNTIME_ARCHIVE_FOLDER } from "./lib/runtimeArchive";

const archiveRoot = resolve(RUNTIME_ARCHIVE_FOLDER);
const selected = JSON.parse(await readFile(resolve(archiveRoot, "default.json"), "utf8"));
const runtime = await readTrustedRuntime(archiveRoot, selected.runtimeTarget);
const out = resolve(process.argv[2] ?? "verify-shots/release-artifact");
await mkdir(out, { recursive: true });
// Narrow isolated engine fixture, never authored or uploaded to a project DB.
const project = createBlankProject();
project.meta.publication = preparePublication(runtime.runtimeTarget);
const requests: string[] = [];
const prefix = `/runtime-archive/${runtime.runtimeTarget}/`;
const fetchBytes = async (url: string) => {
  assert.ok(url.startsWith(prefix), `Unexpected current dependency ${url}`);
  requests.push(url);
  return new Uint8Array(await readFile(resolve(archiveRoot, runtime.runtimeTarget, contractPath(url.slice(prefix.length)))));
};
const zip = await createWebPlayerExportPackage(project, { fetchBytes });
const zipBytes = new Uint8Array(await zip.blob.arrayBuffer());
const verified = await verifyGameRelease(zipBytes, runtime);
const html = await createStandaloneHtmlExport(project, { fetchBytes });
await writeFile(resolve(out, "release.zip"), zipBytes);
await writeFile(resolve(out, "release.html"), new Uint8Array(await html.blob.arrayBuffer()));
await writeFile(resolve(out, "report.json"), JSON.stringify({ releaseId: verified.manifest.releaseId,
  runtimeTarget: runtime.runtimeTarget, publication: verified.manifest.publication,
  files: verified.manifest.files, zipBytes: zipBytes.length, htmlBytes: html.blob.size,
  requestedOnlySelectedArchive: true, requestCount: requests.length }, null, 2));
console.log(`Verified actual ZIP and generated offline HTML: ${out}`);
