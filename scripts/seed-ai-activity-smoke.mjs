#!/usr/bin/env node
// Smoke: write one AI activity row via Supabase (uses fallback table if needed).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) throw new Error("missing .env.local");
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnvLocal();
const url = env.VITE_SUPABASE_URL.replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY;
const projectId = env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery";
const logId = randomUUID();
const instruction = process.argv[2] || "smoke: agent applied activity log fallback";

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  "Content-Profile": "rpg_zzu",
  Prefer: "resolution=merge-duplicates,return=representation",
};

const payload = {
  id: logId,
  at: new Date().toISOString(),
  channel: "region",
  instruction,
  mapId: "smoke_map",
  result: { ok: true, applied: true, changedCells: 1 },
  toolCalls: [{ name: "place_props", args: { count: 1 }, summary: "smoke" }],
  audit: [{ kind: "user", text: instruction }],
};

// 1) try dedicated table
let r = await fetch(`${url}/rest/v1/ai_activity_logs?on_conflict=log_id`, {
  method: "POST",
  headers,
  body: JSON.stringify([
    {
      log_id: logId,
      project_id: projectId,
      channel: "region",
      instruction,
      map_id: "smoke_map",
      payload_json: payload,
    },
  ]),
});
let body = await r.text();
console.log("primary", r.status, body.slice(0, 300));

if (!r.ok) {
  // 2) fallback analysis runs
  r = await fetch(`${url}/rest/v1/ai_analysis_runs?on_conflict=run_id`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        run_id: logId,
        project_id: projectId,
        tileset_id: "__ai_activity__",
        selected_tile_ids_json: [],
        prompt_context_json: {
          kind: "ai-activity-log",
          channel: "region",
          instruction,
          mapId: "smoke_map",
        },
        result_json: payload,
      },
    ]),
  });
  body = await r.text();
  console.log("fallback", r.status, body.slice(0, 500));
}

// list
const list = await fetch(
  `${url}/rest/v1/ai_analysis_runs?tileset_id=eq.__ai_activity__&select=run_id,prompt_context_json,created_at&order=created_at.desc&limit=5`,
  {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Accept-Profile": "rpg_zzu",
    },
  },
);
console.log("list", list.status, await list.text());
