// Fresh redraw audit; the retired-resource ledger remains an input for ID compatibility.
// Asset/reference inspection only: no test runner, store writes or user project mutation.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { PIXEL_ENEMY_SHEETS, pixelEnemyCell } from "../../src/assets/pixelEnemySheets";
import { pixelEnemyPortraitPath } from "../../src/assets/pixelEnemyPortraits";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl, generatedAssetPromotedPathToUrl } from "../../src/assets/generatedAssetResourceResolver";
import { defaultBattleRecords } from "../../src/project/defaults/defaultDatabaseBattleRecords";
import { createBlankProject } from "../../src/project/defaults";
import { collectWebExportAssets } from "../../src/project/webExportAssets";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidence = path.join(root, "verify-shots/legacy-monsters");
const outputEvidence = path.join(root, "verify-shots/monster-redraw-all");
const before = JSON.parse(readFileSync(path.join(outputEvidence, "before.json"), "utf8")) as Record<string,{sheetSha256:string;retained:boolean}>;
const beforeById = new Map(PIXEL_ENEMY_SHEETS.map(sheet => [sheet.resourceId,before[path.basename(sheet.path,".png")]?.sheetSha256]));
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const errors: string[] = [];
const inspect = (ok: boolean, message: string) => { if (!ok) errors.push(message); };
const retired = JSON.parse(readFileSync(path.join(evidence, "retired-resource-map.json"), "utf8")) as Record<string, string>;
const requested = JSON.parse(readFileSync(path.join(evidence, "requested-species.json"), "utf8")) as string[];
const registered = new Set(builtinGeneratedResourceIds());
inspect(new Set(PIXEL_ENEMY_SHEETS.map(s => s.resourceId)).size === PIXEL_ENEMY_SHEETS.length, "Duplicate native ID");
const native = PIXEL_ENEMY_SHEETS.map(sheet => {
  const bytes = readFileSync(path.join(root, "public", sheet.path));
  const png = PNG.sync.read(bytes), cell = pixelEnemyCell(sheet);
  const portraitPath = pixelEnemyPortraitPath(sheet);
  const portraitBytes = readFileSync(path.join(root, "public", portraitPath));
  const portrait = PNG.sync.read(portraitBytes);
  inspect(png.width === cell*3 && png.height === cell*3, `${sheet.resourceId}: pose dimensions`);
  inspect(portrait.width === cell && portrait.height === cell, `${sheet.resourceId}: portrait dimensions`);
  const colors = new Set<string>(), alpha = new Set<number>();
  for (let i=0;i<png.data.length;i+=4) {
    alpha.add(png.data[i+3]);
    if (png.data[i+3]) colors.add(png.data.subarray(i,i+3).toString("hex"));
  }
  inspect(colors.size <= 32, `${sheet.resourceId}: palette budget`);
  inspect([...alpha].every(a => a === 0 || a === 255), `${sheet.resourceId}: fractional alpha`);
  for (let y=0;y<cell;y++) inspect(portrait.data.subarray(y*cell*4,(y+1)*cell*4).equals(
    png.data.subarray(y*png.width*4,(y*png.width+cell)*4)), `${sheet.resourceId}: portrait differs at row ${y}`);
  inspect(resolveAssetResourceUrl(sheet.resourceId) === `/${portraitPath}`, `${sheet.resourceId}: resolver exposes wrong image`);
  return { ...sheet, cell, colors: colors.size, alpha: [...alpha].sort((a,b)=>a-b), sheetSha256:sha(bytes), portraitPath, portraitSha256:sha(portraitBytes) };
});
const oldIds = Object.keys(retired).map(resourceId => {
  const url = resolveAssetResourceUrl(resourceId);
  inspect(registered.has(resourceId), `Dropped registered species ${resourceId}`);
  inspect(Boolean(url && existsSync(path.join(root,"public",url))), `Missing replacement ${resourceId}: ${url}`);
  inspect(url !== retired[resourceId], `Still resolves retired painting ${resourceId}`);
  inspect(generatedAssetPromotedPathToUrl(`public${retired[resourceId]}`) === url, `Stale manifest does not migrate ${resourceId}`);
  return { resourceId, url };
});
for (const id of requested) inspect(native.some(s => s.resourceId === id), `Requested replacement missing ${id}`);
const battle = defaultBattleRecords();
for (const row of battle.enemies) inspect(Boolean(row.monsterResourceId && resolveAssetResourceUrl(row.monsterResourceId)), `Default enemy unresolved: ${row.id}`);
const project = createBlankProject();
const beforeIds = project.database.enemies.map(e => [e.id,e.monsterResourceId]);
const reopened = JSON.parse(JSON.stringify(project));
inspect(JSON.stringify(reopened.database.enemies.map((e: {id:string;monsterResourceId?:string}) => [e.id,e.monsterResourceId])) === JSON.stringify(beforeIds), "Serialized common enemy IDs changed");
const assets = collectWebExportAssets(project);
const paths = new Set(assets.filter(a=>a.kind === "public").map(a=>a.sourcePath));
const missingEnemyExports = battle.enemies.flatMap(e=> {
  const url = resolveAssetResourceUrl(e.monsterResourceId);
  return url && !paths.has(url.slice(1)) ? [e.id] : [];
});
inspect(missingEnemyExports.length === 0, `Missing default enemy exports: ${missingEnemyExports.join(", ")}`);
const customId = requested[0];
const uploaded = { assets: {uploaded: {[customId]: {id:customId,kind:"monster" as const,name:"custom",dataUrl:"data:image/png;base64,AA==",meta:{}}} } };
inspect(resolveAssetResourceUrl(customId,{project:uploaded}) === "data:image/png;base64,AA==", "A common ID masks a project upload");
const report = { scope:"Fresh monster redraw asset/reference/serialization inspection; no SQLite project or test suite executed", requestedSpecies:PIXEL_ENEMY_SHEETS.length,
  freshRedraws:native.filter(row => beforeById.get(row.resourceId)!==row.sheetSha256).length, totalNativeSheets:native.length, preservedOldResourceIds:oldIds.length, defaultEnemies:battle.enemies.length,
  serializedCommonIdsUnchanged:true, missingEnemyExports, maximumColors:Math.max(...native.map(s=>s.colors)), native, oldIds, errors };
writeFileSync(path.join(outputEvidence,"asset-audit.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({requestedSpecies:report.requestedSpecies,totalNativeSheets:native.length,preservedOldResourceIds:oldIds.length,defaultEnemies:report.defaultEnemies,maximumColors:report.maximumColors,errors},null,2));
if (errors.length) process.exitCode=1;
