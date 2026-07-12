#!/usr/bin/env node
// 최근 AI 활동 로그 조회 — Supabase (전용 테이블 또는 ai_analysis_runs 폴백) + 로컬 디스크.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function listRemote(env, limit) {
  const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) return { error: "no supabase env" };
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Accept-Profile": "rpg_zzu",
  };
  // primary
  let primary = [];
  try {
    const r = await fetch(
      `${url}/rest/v1/ai_activity_logs?select=log_id,channel,instruction,map_id,created_at&order=created_at.desc&limit=${limit}`,
      { headers },
    );
    if (r.ok) primary = await r.json();
    else primary = { status: r.status, body: await r.text() };
  } catch (e) {
    primary = { error: String(e) };
  }
  // fallback
  let fallback = [];
  try {
    const r = await fetch(
      `${url}/rest/v1/ai_analysis_runs?tileset_id=eq.__ai_activity__&select=run_id,prompt_context_json,created_at&order=created_at.desc&limit=${limit}`,
      { headers },
    );
    if (r.ok) {
      const rows = await r.json();
      fallback = rows.map((row) => ({
        log_id: row.run_id,
        channel: row.prompt_context_json?.channel,
        instruction: row.prompt_context_json?.instruction,
        map_id: row.prompt_context_json?.mapId,
        created_at: row.created_at,
        source: "fallback",
      }));
    } else {
      fallback = { status: r.status, body: await r.text() };
    }
  } catch (e) {
    fallback = { error: String(e) };
  }
  return { primary, fallback };
}

function listDisk(limit) {
  const dir = join(process.cwd(), "output", "ai-activity");
  if (!existsSync(dir)) return [];
  const indexPath = join(dir, "index.json");
  if (existsSync(indexPath)) {
    try {
      return JSON.parse(readFileSync(indexPath, "utf8")).slice(0, limit);
    } catch {
      /* fall through */
    }
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "latest.json")
    .slice(0, limit);
}

const limit = Number(process.argv[2] || 10);
const env = loadEnvLocal();
const disk = listDisk(limit);
const remote = await listRemote(env, limit);
console.log(JSON.stringify({ disk, remote }, null, 2));
