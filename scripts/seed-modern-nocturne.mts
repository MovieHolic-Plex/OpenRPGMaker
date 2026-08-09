import fs from "node:fs";
import { createModernNocturneProject, MODERN_MAP, MODERN_NOCTURNE_PROJECT_ID } from "../src/project/defaults/modernNocturneGame.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const filename of [".env.local", ".env"]) {
    if (!fs.existsSync(filename)) continue;
    for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u);
      if (match) env[match[1]!] ??= match[2]!.replace(/^["']|["']$/gu, "");
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");
const config = { url, anonKey, projectId: MODERN_NOCTURNE_PROJECT_ID };
const project = createModernNocturneProject();
const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved.kind, MODERN_NOCTURNE_PROJECT_ID);
const loaded = await loadProjectFromSupabase(config);
if (!loaded) throw new Error("Supabase reload returned null");
if (loaded.meta.title !== project.meta.title) throw new Error(`title mismatch: ${loaded.meta.title}`);
if (!loaded.maps[MODERN_MAP.city] || !loaded.maps[MODERN_MAP.rooftop]) throw new Error("reloaded project is missing authored maps");
if (loaded.tilesets.tileset_modern_exteriors?.image.id !== "tex_modern_exteriors_nocturne") throw new Error("reloaded project is missing Modern Exteriors tileset");
console.log("[verified]", JSON.stringify({
  projectId: MODERN_NOCTURNE_PROJECT_ID,
  title: loaded.meta.title,
  maps: Object.keys(loaded.maps),
  cityEvents: loaded.maps[MODERN_MAP.city]?.events.length,
  rooftopEvents: loaded.maps[MODERN_MAP.rooftop]?.events.length,
  tileset: loaded.tilesets.tileset_modern_exteriors?.name,
}));
