import { readFile, writeFile } from "node:fs/promises";
import { CC0_ICON_ASSETS, resolveCc0IconAssetUrl } from "../../src/assets/cc0IconAssets";
import { collectWebExportAssets } from "../../src/project/webExportAssets";
import type { Project } from "../../src/project/types";

// Use the saved new-project document, without creating or changing a user project.
const project = JSON.parse(await readFile("output/item-catalog/new-project-export.json", "utf8")) as Project;
const exported = new Map(collectWebExportAssets(project).map((asset) => [asset.zipPath, asset]));
const manifest = JSON.parse(await readFile("assets/item-catalog/generation-manifest.json", "utf8")) as {
  entries: Record<string, { sha256: string }>;
};
const missingExportPaths: string[] = [];
const unresolvedIcons: string[] = [];
let generatedBytes = 0;
let generatedFiles = 0;
for (const icon of CC0_ICON_ASSETS) {
  if (resolveCc0IconAssetUrl(icon.id) !== `/${icon.path}`) unresolvedIcons.push(icon.id);
  const asset = exported.get(icon.path);
  if (!asset || asset.kind !== "public" || asset.sourcePath !== icon.path) missingExportPaths.push(icon.path);
  if (manifest.entries[icon.id]) {
    generatedBytes += (await readFile(`public/${icon.path}`)).byteLength;
    generatedFiles++;
  }
}
const report = {
  items: project.database.items.length,
  registeredIcons: CC0_ICON_ASSETS.length,
  exportedIcons: CC0_ICON_ASSETS.length - missingExportPaths.length,
  unresolvedIcons,
  missingExportPaths,
  generatedFiles,
  generatedBytes,
  pendingArtwork: CC0_ICON_ASSETS.length - generatedFiles,
};
await writeFile("output/item-catalog/export-assets-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
if (unresolvedIcons.length || missingExportPaths.length) process.exitCode = 1;
