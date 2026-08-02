// 데모 콘텐츠 6차: 포획 구슬(5차 지급)이 있어도 포획 커맨드는
// system.monsterCollection === true 일 때만 노출된다(battleCommands.ts:53).
// "몬스터 초원 데모"라는 콘텐츠 의도(적 전원 speciesId 저작, 포획 구슬 아이템 존재)에
// 맞춰 수집을 켠다. battleParty/monsterBattleParty 는 건드리지 않는다(영웅 전투 유지).
import { createHash } from "node:crypto";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const baseUrl = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
const projectId = "rpg-zzu-house-template-gallery";
const readHeaders = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Accept-Profile": "rpg_zzu" };
const writeHeaders = {
  apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json",
  "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation", "Content-Profile": "rpg_zzu",
};
const sha256Hex = (text) => createHash("sha256").update(text, "utf8").digest("hex");

const res = await fetch(
  `${baseUrl}/rest/v1/projects?select=current_json,current_sha256,title,schema_version&project_id=eq.${encodeURIComponent(projectId)}`,
  { headers: readHeaders },
);
const rows = await res.json();
const project = rows[0].current_json;
console.log("monsterCollection:", project.system.monsterCollection, "→ true");
project.system.monsterCollection = true;

const serialized = JSON.stringify(project);
const payload = {
  project_id: projectId,
  title: project.meta?.title || rows[0].title || projectId,
  schema_version: project.version ?? rows[0].schema_version ?? 3,
  current_json: project,
  current_sha256: sha256Hex(serialized),
  map_count: Object.keys(project.maps).length,
  tileset_count: Object.keys(project.tilesets || {}).length,
  terrain_template_count: 0,
};
const saveRes = await fetch(`${baseUrl}/rest/v1/projects?on_conflict=project_id`, {
  method: "POST", headers: writeHeaders, body: JSON.stringify(payload),
});
if (!saveRes.ok) {
  console.error("save failed", saveRes.status, (await saveRes.text()).slice(0, 400));
  process.exit(1);
}
console.log("saved:", payload.current_sha256.slice(0, 12));
