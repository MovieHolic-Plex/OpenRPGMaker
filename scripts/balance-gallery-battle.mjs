// rpg-zzu-house-template-gallery 전투 밸런스 정규화 (적대적 리뷰 2차 §5)
// - 액터: Lv1 HP 514 → 44 스케일로 전면 재곡선(위협이 산술적으로 0이던 원인).
// - 몬스터: 티어 정리(드래곤 > 슬라임), 적 공격력을 새 스케일에 맞춤(한 대 15~30%).
// - 급소: 액터 1/16, 적도 1/30 활성화.
// - 스킬: 검격 MP 0 → 4 (기본 공격을 무의미하게 만들던 무료 상위호환 제거).
import { createHash } from "node:crypto";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const baseUrl = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
const projectId = "rpg-zzu-house-template-gallery";
if (!baseUrl || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}
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
if (!rows?.[0]) { console.error("project not found"); process.exit(1); }
const project = rows[0].current_json;
const db = project.database;

// ── 액터 스탯 곡선 재작성 ──
const actorCurve = (start, growth, length) =>
  Array.from({ length }, (_, i) => Math.round(start + growth * i));

for (const actor of db.actors) {
  const curves = actor.parameterCurves;
  if (!curves) continue;
  const len = Array.isArray(curves.maxHp) ? curves.maxHp.length : 99;
  curves.maxHp = actorCurve(44, 6, len);
  curves.maxMp = actorCurve(24, 3, len);
  curves.attack = actorCurve(16, 1.6, len);
  curves.defense = actorCurve(10, 1.1, len);
  curves.mind = actorCurve(12, 1.4, len);
  curves.agility = actorCurve(12, 1.2, len);
  actor.critical = { enabled: true, chanceDenominator: 16 };
}

// ── 몬스터 티어: hp / atk / def (한 대 = 주인공 44HP 의 15~30%) ──
const ENEMY_TIERS = {
  enemy_slime: { maxHp: 15, attack: 8, defense: 4 },
  enemy_meadow_slime: { maxHp: 20, attack: 9, defense: 5 },
  enemy_cave_bat: { maxHp: 25, attack: 10, defense: 5 },
  enemy_stone_golem: { maxHp: 34, attack: 11, defense: 8 },
  enemy_extra_006: { maxHp: 45, attack: 12, defense: 6 },   // 좀비
  enemy_extra_007: { maxHp: 50, attack: 13, defense: 7 },   // 사마귀
  enemy_extra_008: { maxHp: 55, attack: 14, defense: 8 },   // 오크
  enemy_extra_009: { maxHp: 58, attack: 15, defense: 8 },   // 실프
  enemy_extra_010: { maxHp: 62, attack: 16, defense: 9 },   // 레모라
  enemy_dragon: { maxHp: 70, attack: 13, defense: 10 },     // 드래곤 = 최상위 탱커
};
const patchedEnemies = [];
for (const enemy of db.enemies) {
  const tier = ENEMY_TIERS[enemy.id];
  if (tier) {
    enemy.stats = { ...enemy.stats, ...tier };
  } else if (enemy.stats?.attack > 20) {
    // 목록 밖 몬스터: 이전 상향 패치(34~58)의 스케일을 새 스케일로 환산.
    enemy.stats = { ...enemy.stats, attack: Math.max(8, Math.min(18, Math.round(enemy.stats.attack * 0.3))) };
  }
  enemy.criticalHit = { enabled: true, oneIn: 30 };
  patchedEnemies.push({ id: enemy.id, name: enemy.name, ...enemy.stats });
}

// ── 스킬: 무료 상위호환 제거 ──
for (const skill of db.skills ?? []) {
  if (skill.name === "검격" && (skill.mpCost ?? 0) === 0) skill.mpCost = 4;
}

// ── 산술 검증 출력 (dmg = 1.5*atk − def/2, 분산 ±20%) ──
const heroAtk = 16, heroDef = 10, heroHp = 44;
const table = patchedEnemies.filter((e) => ENEMY_TIERS[e.id]).map((e) => {
  const heroDmg = Math.max(1, Math.round(heroAtk * 1.5 - e.defense / 2));
  const enemyDmg = Math.max(1, Math.round(e.attack * 1.5 - heroDef / 2));
  return {
    enemy: e.name, hp: e.maxHp,
    heroDmg, hitsToKill: Math.ceil(e.maxHp / heroDmg),
    enemyDmg, pctOfHeroHp: Math.round(enemyDmg / heroHp * 100) + "%",
  };
});
console.table(table);

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
  console.error("save failed", saveRes.status, (await saveRes.text()).slice(0, 500));
  process.exit(1);
}
console.log("saved:", payload.current_sha256.slice(0, 12));
