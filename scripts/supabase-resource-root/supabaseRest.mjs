import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { DEFAULT_PROJECT_ID, sha256Text } from "./catalog.mjs";

const SUPABASE_SCHEMA = "rpg_zzu";

export async function configFromEnv() {
  const fileEnv = await readEnvFile(".env.local");
  const url = envValue("VITE_SUPABASE_URL", fileEnv);
  const anonKey = envValue("VITE_SUPABASE_ANON_KEY", fileEnv);
  const projectId = envValue("VITE_SUPABASE_PROJECT_ID", fileEnv) || DEFAULT_PROJECT_ID;
  if (!url || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment or .env.local");
  }
  return { anonKey, projectId, url: url.replace(/\/$/, "") };
}

export async function loadCurrentJson(config) {
  const query = new URLSearchParams({
    select: "current_json",
    project_id: `eq.${config.projectId}`,
  });
  const response = await fetch(`${config.url}/rest/v1/projects?${query.toString()}`, {
    headers: supabaseHeaders(config, "read"),
  });
  if (!response.ok) {
    throw new Error(`Supabase load failed ${response.status}: ${await response.text()}`);
  }
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.current_json) throw new Error(`Supabase project not found: ${config.projectId}`);
  return row.current_json;
}

export async function upsertCurrentJson(config, currentJson) {
  const query = new URLSearchParams({ on_conflict: "project_id" });
  const serialized = JSON.stringify(currentJson);
  const response = await fetch(`${config.url}/rest/v1/projects?${query.toString()}`, {
    method: "POST",
    headers: supabaseHeaders(config, "write"),
    body: JSON.stringify({
      project_id: config.projectId,
      title: projectTitle(currentJson),
      schema_version: currentJson.version,
      current_json: currentJson,
      current_sha256: sha256Text(serialized),
      map_count: Object.keys(currentJson.maps ?? {}).length,
      tileset_count: Object.keys(currentJson.tilesets ?? {}).length,
      terrain_template_count: terrainTemplateCount(currentJson),
    }),
  });
  if (!response.ok) {
    throw new Error(`Supabase upsert failed ${response.status}: ${await response.text()}`);
  }
}

export async function writeBackup(currentJson, projectId) {
  const backupDir = ".omo/supabase-backups";
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = path.join(backupDir, `${stamp}-${projectId}-before-resource-root-sync.json`);
  await writeJson(backupPath, currentJson);
  return backupPath;
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const text = await readFile(filePath, "utf8");
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    values[key] = unquote(line.slice(separator + 1).trim());
  }
  return values;
}

function envValue(key, fileEnv) {
  return process.env[key]?.trim() || fileEnv[key]?.trim() || "";
}

function unquote(value) {
  if (value.startsWith("\"") && value.endsWith("\"")) return value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function supabaseHeaders(config, mode) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Accept: "application/json",
    ...(mode === "read" ? { "Accept-Profile": SUPABASE_SCHEMA } : { "Content-Profile": SUPABASE_SCHEMA }),
    ...(mode === "write" ? { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" } : {}),
  };
}

function projectTitle(currentJson) {
  const title = currentJson.meta?.title;
  return typeof title === "string" && title.trim().length > 0 ? title.trim() : "RPG Zzu";
}

function terrainTemplateCount(currentJson) {
  return Object.values(currentJson.tilesets ?? {}).reduce((count, tileset) => count + (tileset.terrainTemplates?.length ?? 0), 0);
}
