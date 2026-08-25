import fs from "node:fs";
import path from "node:path";
import {
  auditCombinedTownAutotiles,
  repairCombinedTownAutotilesWithSummary,
} from "../src/project/combinedTownAutotileAudit.ts";
import { DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME } from "../src/project/defaults/constants.ts";
import { deserialize, serialize } from "../src/project/io.ts";
import {
  listSupabaseProjects,
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";
import { sha256HexText } from "../src/util/sha256.ts";

function loadEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const filename of [".env", ".env.local"]) {
    if (!fs.existsSync(filename)) continue;
    for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) values[match[1]!] = match[2]!.replace(/^['"]|['"]$/g, "");
    }
  }
  return values;
}

const env = { ...loadEnv(), ...process.env };
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");

function canonicalJsonString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJsonString(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonString(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function loadRawProject(projectId: string): Promise<Project | null> {
  const endpoint = `${url}/rest/v1/projects?project_id=eq.${encodeURIComponent(projectId)}&select=current_json`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Accept-Profile": "rpg_zzu",
    },
  });
  if (!response.ok) throw new Error(`raw project read failed (${response.status}): ${await response.text()}`);
  const rows = await response.json() as readonly { readonly current_json?: unknown }[];
  return (rows[0]?.current_json ?? null) as Project | null;
}

const rows = await listSupabaseProjects({ url, anonKey });
const reports = [];
const repairs: { readonly projectId: string; readonly changedCells: number; readonly changedMaps: readonly string[] }[] = [];
const loadErrors: { readonly projectId: string; readonly message: string }[] = [];
const write = process.argv.includes("--write");
const repairInMemory = write || process.argv.includes("--repair-in-memory");
const staged: { readonly projectId: string; readonly original: Project; readonly repaired: Project; readonly changedCells: number }[] = [];
for (const row of rows) {
  let project: Project | null;
  let usedRawFallback = false;
  try {
    project = await loadProjectFromSupabase({ url, anonKey, projectId: row.projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadErrors.push({ projectId: row.projectId, message });
    project = await loadRawProject(row.projectId);
    usedRawFallback = true;
  }
  if (!project || !Object.values(project.maps).some((map) => map.tilesetId === DEFAULT_TILESET_ID)) continue;
  if (repairInMemory) {
    const repair = repairCombinedTownAutotilesWithSummary(project);
    repairs.push({ projectId: row.projectId, changedCells: repair.changedCells, changedMaps: repair.changedMaps });
    if (write && repair.changedCells > 0) {
      if (usedRawFallback) throw new Error(`refusing to write fallback-loaded project ${row.projectId}`);
      staged.push({ projectId: row.projectId, original: project, repaired: repair.project, changedCells: repair.changedCells });
    }
    project = repair.project;
  }
  reports.push(auditCombinedTownAutotiles(project, row.projectId));
}
const totals = reports.reduce((sum, report) => ({ projects: sum.projects + 1, maps: sum.maps + report.maps,
  lowerCells: sum.lowerCells + report.lowerCells, memberCells: sum.memberCells + report.memberCells,
  findings: sum.findings + report.findings.length }), { projects: 0, maps: 0, lowerCells: 0, memberCells: 0, findings: 0 });
const groupIds = [...new Set(reports.flatMap((report) => report.effectiveGroupIds))].sort();
const output = { chipset: { id: DEFAULT_TILESET_ID, name: DEFAULT_TILESET_NAME }, rows: rows.length,
  mode: write ? "write" : repairInMemory ? "repair-in-memory" : "audit", totals, groupIds, repairs, loadErrors, reports };

console.log(`${DEFAULT_TILESET_NAME} is the chipset display name, not an exact project title.`);
console.log(`rows=${rows.length} activeProjects=${totals.projects} maps=${totals.maps} lowerCells=${totals.lowerCells} memberCells=${totals.memberCells} groups=${groupIds.length} findings=${totals.findings}`);
console.log(`projectIds=${reports.map((report) => report.projectId).join(",")}`);
if (repairInMemory) {
  const changedProjects = repairs.filter((repair) => repair.changedCells > 0);
  console.log(`repairInMemory=true changedProjects=${changedProjects.length} changedCells=${changedProjects.reduce((sum, repair) => sum + repair.changedCells, 0)}`);
}
for (const error of loadErrors) console.log(`loadFallback=${JSON.stringify(error)}`);
for (const report of reports) for (const finding of report.findings) console.log(JSON.stringify(finding));

const writeProofs: unknown[] = [];
const proveIdsArg = process.argv.find((arg) => arg.startsWith("--prove-ids="));
const proveIds = new Set([
  ...staged.map((stage) => stage.projectId),
  ...(proveIdsArg ? proveIdsArg.slice("--prove-ids=".length).split(",").filter(Boolean) : []),
]);
if (write) {
  if (!process.argv.includes("--confirm-write=combined-town-autotiles")) {
    throw new Error("--write requires --confirm-write=combined-town-autotiles");
  }
  if (totals.findings !== 0) throw new Error(`refusing to write with ${totals.findings} in-memory findings`);
  for (const stage of staged) {
    const config = { url, anonKey, projectId: stage.projectId };
    const preSaveSha256 = await sha256HexText(serialize(stage.original));
    const canonicalRepaired = deserialize(serialize(stage.repaired));
    const result = await saveProjectToSupabase(canonicalRepaired, config);
    if (result.kind !== "saved" || !result.project || !result.sha256) {
      throw new Error(`save failed for ${stage.projectId}: ${JSON.stringify(result)}`);
    }
    if (result.project.meta.title !== stage.original.meta.title) {
      throw new Error(`save changed title for ${stage.projectId}`);
    }
    const proof = await proveReloadedRow({
      url, anonKey, projectId: stage.projectId, expectedTitle: stage.original.meta.title,
      changedCells: stage.changedCells, preSaveSha256, savedSha256: result.sha256, savedProject: result.project,
    });
    writeProofs.push(proof);
    console.log(`saveReload=${JSON.stringify(proof)}`);
    proveIds.delete(stage.projectId);
  }
  for (const projectId of [...proveIds].sort()) {
    const proof = await proveReloadedRow({ url, anonKey, projectId, changedCells: 0 });
    writeProofs.push(proof);
    console.log(`saveReload=${JSON.stringify(proof)}`);
  }
}

async function proveReloadedRow(input: {
  readonly url: string;
  readonly anonKey: string;
  readonly projectId: string;
  readonly expectedTitle?: string;
  readonly changedCells: number;
  readonly preSaveSha256?: string;
  readonly savedSha256?: string;
  readonly savedProject?: Project;
}): Promise<Record<string, unknown>> {
  const config = { url: input.url, anonKey: input.anonKey, projectId: input.projectId };
  const reloaded = await loadProjectFromSupabase(config);
  if (!reloaded) throw new Error(`fresh reload returned null for ${input.projectId}`);
  if (input.expectedTitle && reloaded.meta.title !== input.expectedTitle) {
    throw new Error(`reload title mismatch for ${input.projectId}: ${reloaded.meta.title}`);
  }
  const rowResponse = await fetch(
    `${input.url}/rest/v1/projects?project_id=eq.${encodeURIComponent(input.projectId)}&select=current_json,current_sha256,title`,
    { headers: { apikey: input.anonKey, Authorization: `Bearer ${input.anonKey}`, "Accept-Profile": "rpg_zzu" } },
  );
  if (!rowResponse.ok) throw new Error(`row proof read failed for ${input.projectId}: ${rowResponse.status}`);
  const rows = await rowResponse.json() as readonly { current_json: unknown; current_sha256: string; title: string }[];
  const row = rows[0];
  if (!row) throw new Error(`row missing after save for ${input.projectId}`);
  if (input.savedSha256 && row.current_sha256 !== input.savedSha256) {
    throw new Error(`stored sha mismatch for ${input.projectId}: saved=${input.savedSha256} row=${row.current_sha256}`);
  }
  const reloadedSha256 = await sha256HexText(serialize(reloaded));
  const canonicalStored = await sha256HexText(canonicalJsonString(row.current_json));
  const canonicalReloaded = await sha256HexText(canonicalJsonString(JSON.parse(serialize(reloaded))));
  const canonicalSaved = input.savedProject
    ? await sha256HexText(canonicalJsonString(JSON.parse(serialize(input.savedProject))))
    : canonicalStored;
  const reloadedAudit = auditCombinedTownAutotiles(reloaded, input.projectId);
  if (canonicalStored !== canonicalReloaded || canonicalSaved !== canonicalReloaded || reloadedAudit.findings.length !== 0) {
    throw new Error(`reload proof failed for ${input.projectId}: canonicalStored=${canonicalStored} canonicalReloaded=${canonicalReloaded} findings=${reloadedAudit.findings.length}`);
  }
  return {
    projectId: input.projectId,
    projectTitle: reloaded.meta.title,
    changedCells: input.changedCells,
    preSaveSha256: input.preSaveSha256 ?? null,
    savedSha256: input.savedSha256 ?? row.current_sha256,
    storedSha256: row.current_sha256,
    reloadedSha256,
    canonicalStored,
    canonicalReloaded,
    reloadedFindings: reloadedAudit.findings.length,
  };
}

const jsonIndex = process.argv.indexOf("--json");
if (jsonIndex >= 0) {
  const jsonPath = process.argv[jsonIndex + 1];
  if (!jsonPath) throw new Error("--json requires a path");
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify({ ...output, writeProofs }, null, 2)}\n`, "utf8");
}
process.exitCode = totals.findings > 0 ? 1 : 0;
