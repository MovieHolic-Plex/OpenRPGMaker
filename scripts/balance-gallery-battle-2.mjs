// 밸런스 2차: 적 스킬 power 가 구스케일(주인공 HP 514 기준)로 남아 있어
// 급소가 뜨면 새 체력(44)을 풀피에서 원샷했다(실측: 불씨 뿜기 급소 100 피해).
// 적 스킬 power 를 새 스케일로 환산하고, 적 급소는 다시 끈다(×3 배율이 즉사 스파이크).
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
const db = project.database;

const SKILL_POWERS = {
  skill_attack: 8,
  skill_scarloxy_scratch: 8,   // 할퀴기 18 →
  skill_scarloxy_leaf: 10,     // 잎날리기 24 →
  skill_scarloxy_splash: 10,   // 물장구 24 →
  skill_scarloxy_ember: 11,    // 불씨 뿜기 26 →
  skill_scarloxy_ice: 12,      // 얼음 조각 28 →
  skill_scarloxy_burst: 16,    // 대폭발 36 →
};
const changed = [];
for (const skill of db.skills) {
  const next = SKILL_POWERS[skill.id];
  if (next !== undefined && skill.power !== next) {
    changed.push(`${skill.name}: ${skill.power} → ${next}`);
    skill.power = next;
  }
}
for (const enemy of db.enemies) {
  enemy.criticalHit = { enabled: false, oneIn: 30 };
}
console.log(changed.join("\n") || "(no skill changes)");

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
