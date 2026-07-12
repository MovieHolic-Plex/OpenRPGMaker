import fs from "node:fs";
import { loadProjectFromSupabase, listSupabaseProjects } from "../src/project/supabaseProjectSync.ts";
import { describeChipsetTile } from "../src/project/defaults/chipsetMapping.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const base = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
};
const defaultId = env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery";

const listed = await listSupabaseProjects(base).catch(() => []);
console.log("projects", listed.map((x) => `${x.projectId} | ${x.title}`).join("\n"));

const p = await loadProjectFromSupabase({ ...base, projectId: defaultId });
if (!p) {
  console.log("NO_PROJECT", defaultId);
  process.exit(1);
}

console.log("\nloaded", defaultId, "title=", p.meta.title);
for (const [id, ts] of Object.entries(p.tilesets)) {
  let user = 0;
  const userSamples: unknown[] = [];
  for (let i = 0; i < ts.count; i += 1) {
    const m = ts.tileMeta?.[i];
    if (!m) continue;
    if (m.source === "user" || m.userLocked) {
      user += 1;
      if (userSamples.length < 30) {
        userSamples.push({
          i,
          label: m.label,
          desc: (m.description ?? "").slice(0, 100),
          layer: m.defaultLayer,
          passage: m.passage,
        });
      }
    }
  }
  console.log("tileset", id, ts.name, "count", ts.count, "userMeta", user, "groups", ts.tileGroups?.length ?? 0);
  if (userSamples.length) console.log(JSON.stringify(userSamples, null, 2));

  // chipset default castle wall indexes if combined town
  if (id.includes("combined") || ts.name.toLowerCase().includes("town")) {
    const sample = [246, 247, 248, 276, 306, 336, 337, 338];
    console.log(
      "default castle-ish descriptors",
      sample.map((i) => {
        try {
          const d = describeChipsetTile(i);
          return { i, label: d.label, key: d.key };
        } catch {
          return { i, label: "?" };
        }
      }),
    );
  }
}
