// 밸런스 3차: Scarloxy 데모 몬스터 6종이 새 티어(슬라임 15 ~ 드래곤 70) 밖에 있었다
// (라르베아 68 ~ 아트록스 126). Lv1 주인공(HP44, 타 32±)이 "아트록스와 부하"(총 198HP,
// 라운드당 피해 ~10)를 산술적으로 못 이겼다(적대 리뷰 3차 실측: 최적 플레이로 패배).
// 잡몹은 1~2타, 미니보스 3타, 보스전은 부하 선처리 후 3타 구도로 맞춘다.
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

const STATS = {
  enemy_scarloxy_larvea: { maxHp: 22, attack: 10 },   // 68 → 잡몹(2타)
  enemy_scarloxy_plumette: { maxHp: 24, attack: 12 }, // 70 →
  enemy_scarloxy_finsta: { maxHp: 26, attack: 12 },   // 71 → 둘이 나오는 트룹
  enemy_scarloxy_sparchu: { maxHp: 28, attack: 12 },  // 72 → 보스전 부하(1~2타 선처리)
  enemy_scarloxy_friolera: { maxHp: 45, attack: 14 }, // 92 → 미니보스(3타)
  enemy_scarloxy_atrox: { maxHp: 60, attack: 14 },    // 126/atk17 → 보스(3타), 화력도 완화
};
const changed = [];
for (const enemy of db.enemies) {
  const next = STATS[enemy.id];
  if (!next) continue;
  for (const [k, v] of Object.entries(next)) {
    if (enemy.stats[k] !== v) {
      changed.push(`${enemy.name}.${k}: ${enemy.stats[k]} → ${v}`);
      enemy.stats[k] = v;
    }
  }
}
console.log(changed.join("\n") || "(no changes)");

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
