import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { preparePublication } from "@/project/publication";
import { createWebPlayerExportPackage, prepareWebExport } from "@/project/webExport";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { contractPath, isRecord } from "@/project/playerDeploymentPaths";
import { RELEASE_COLLECTOR_FILE } from "@/project/releaseDependencies";
import { operatorRuntimeWithCollector, validateReleaseArchive } from "../community-site/lib/releaseArchive";
import { readTrustedRuntime, RUNTIME_ARCHIVE_FOLDER } from "./lib/runtimeArchive";

const archive = resolve(RUNTIME_ARCHIVE_FOLDER);
const pointer: unknown = JSON.parse(await readFile(resolve(archive, "default.json"), "utf8"));
assert.ok(isRecord(pointer) && typeof pointer.runtimeTarget === "string");
const runtime = await readTrustedRuntime(archive, pointer.runtimeTarget);
assert.equal(runtime.collectorVersion, 2);
const trusted = await operatorRuntimeWithCollector(runtime,
  new Uint8Array(await readFile(resolve(archive, runtime.runtimeTarget, "web", RELEASE_COLLECTOR_FILE))));
const prefix = `/runtime-archive/${runtime.runtimeTarget}/`;
const fetchBytes = async (url: string): Promise<Uint8Array> => {
  assert.ok(url.startsWith(prefix), "QA must only read the selected retained runtime");
  return new Uint8Array(await readFile(resolve(archive, runtime.runtimeTarget, contractPath(url.slice(prefix.length)))));
};
const rows = [];
for (const variant of ["background", "custom-bgm", "both"] as const) {
  const project = createBlankProject();
  project.meta.publication = preparePublication(runtime.runtimeTarget);
  const map = project.maps[project.startMapId];
  assert.ok(map);
  if (variant !== "custom-bgm") map.background = { imageId: "", scrollX: 0, scrollY: 0 };
  if (variant !== "background") map.bgm = { mode: "custom", resourceId: "" };
  const before = serialize(project);
  const prepared = prepareWebExport(project);
  const expectedProjectBytes = Buffer.from(prepared.projectJson);
  const exported = await createWebPlayerExportPackage(project, { fetchBytes });
  const zip = Buffer.from(await exported.blob.arrayBuffer());
  const accepted = await validateReleaseArchive(zip, async () => trusted);
  const actual = accepted.entries.get("project.json");
  assert.ok(actual);
  assert.equal(Buffer.from(actual).equals(expectedProjectBytes), true, "Community validation must preserve exact project bytes");
  assert.equal(accepted.bytes.equals(zip), true, "Community validation must preserve exact ZIP bytes");
  const standalone = await createStandaloneHtmlExport(project, { fetchBytes });
  const html = await standalone.blob.text();
  const payload = /<script[^>]+id="oprn-release-payloads"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(payload);
  const values: unknown = JSON.parse(payload[1]);
  assert.ok(isRecord(values) && typeof values["project.json"] === "string");
  assert.equal(Buffer.from(values["project.json"], "base64").equals(expectedProjectBytes), true, "HTML must preserve the same prepared project");
  assert.equal(serialize(project) === before, true, "Export must not mutate authored clear selections");
  rows.push({ variant, pass: true, releaseId: accepted.manifest.releaseId,
    zipBytes: zip.length, htmlBytes: standalone.blob.size, exactProjectBytes: true, exactZipBytes: true });
}
const out = resolve(process.argv[2] ?? "verify-shots/release-map-clears");
await mkdir(out, { recursive: true });
await writeFile(resolve(out, "report.json"), JSON.stringify({ runtimeTarget: runtime.runtimeTarget, pass: true, rows }, null, 2));
console.log(`PASS actual retained map-clear exports and community validation: ${rows.length} variants`);
