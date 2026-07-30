import { readFileSync, writeFileSync } from "node:fs";

function env(key: string): string {
  const line = readFileSync(".env", "utf-8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}
const url = env("VITE_SUPABASE_URL");
const key = env("VITE_SUPABASE_ANON_KEY");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "rpg_zzu" };

const res = await fetch(`${url}/rest/v1/projects?project_id=eq.rpg-zzu-quest-demo&select=current_json`, { headers });
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const rows = (await res.json()) as Array<{ current_json: unknown }>;
if (rows.length === 0) throw new Error("project row not found");
const project = rows[0]!.current_json as Record<string, unknown>;
writeFileSync("tmp/quest-demo-live.json", JSON.stringify(project));

const maps = project.maps as Record<string, { id: string; name: string; width: number; height: number; tilesetId: string }>;
console.log("maps:", Object.values(maps).map((m) => `${m.id} (${m.name}, ${m.width}x${m.height}, ${m.tilesetId})`).join("\n  "));
console.log("mapTree:", JSON.stringify(project.mapTree ?? project.map_tree ?? null)?.slice(0, 500));
console.log("startMapId:", project.startMapId, "| tilesets:", Object.keys(project.tilesets as object).join(","));
console.log("top keys:", Object.keys(project).join(","));
