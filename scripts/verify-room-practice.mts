/** '방 연습' 프로젝트 라운드트립 검증 — Supabase에서 다시 로드해 구성 확인. */
import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const project = await loadProjectFromSupabase({
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: "rpg-zzu-room-practice",
});
if (!project) throw new Error("로드 실패");
console.log("title:", project.meta.title);
console.log("startMapId:", project.startMapId, "startPos:", JSON.stringify(project.startPos));
console.log("maps:", Object.keys(project.maps).length);
for (const map of Object.values(project.maps)) {
  console.log(` - ${map.id}: ${map.name} (${map.width}×${map.height}, tileset=${map.tilesetId})`);
}
const interior = project.tilesets[Object.values(project.maps)[0]!.tilesetId];
console.log("tileset ok:", Boolean(interior), "autotileGroups:", interior?.autotileGroups?.length ?? 0);
