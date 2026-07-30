// Fetch the live map_snow_mountain_60 from Supabase (maps table = map-content SoT).
// Reads .env locally; never prints secrets.
import { readFileSync, writeFileSync } from "node:fs";

function env(key: string): string {
  const line = readFileSync(".env", "utf-8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing in .env`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

const url = env("VITE_SUPABASE_URL");
const key = env("VITE_SUPABASE_ANON_KEY");
const projectId = "rpg-zzu-quest-demo";
const mapId = "map_snow_mountain_60";

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const projRows = (await getJson(
  `projects?project_id=eq.${projectId}&select=current_json`,
)) as Array<{ current_json: { maps?: Record<string, unknown> } }>;
if (projRows.length === 0) throw new Error("project row not found");
const maps = projRows[0]!.current_json.maps ?? {};
const m = maps[mapId] as { width: number; height: number; tilesetId: string; name: string; lowerTiles: number[]; upperTiles: number[]; events: unknown[] } | undefined;
if (!m) throw new Error(`map ${mapId} not in project (${Object.keys(maps).length} maps)`);
writeFileSync("tmp/snow60-live.json", JSON.stringify(m));
console.log(JSON.stringify({
  name: m.name,
  width: m.width,
  height: m.height,
  tilesetId: m.tilesetId,
  lower: m.lowerTiles.length,
  upper: m.upperTiles.length,
  events: m.events.length,
}));
