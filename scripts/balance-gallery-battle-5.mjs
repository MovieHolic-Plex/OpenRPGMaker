// 데모 콘텐츠 5차 (감독 지시: 잔여 문제 전부 수정 + UX)
// 1) §19 전투 배경-지형 연동: 배경 해석 순서가 override → 트룹 → 지형이라, 모든 트룹에
//    previewBackground 가 저작돼 있으면 지형 연동이 영구히 가려진다. 서식지 고유가 아닌
//    일반 트룹의 트룹 배경을 걷어 인게임 인카운터가 지형(terrains[].battleBackground)을
//    따르게 한다. Scarloxy 트룹(물가/유적/보스)은 서식지 연출이므로 유지.
// 2) 아이템·포획 플로우 활성화: 시작 인벤토리가 비어 있어 전투의 아이템 커맨드가 항상
//    비활성이고 포획은 노출조차 안 됐다(코덱스 리뷰 의심 항목). 회복약 3, 포획 구슬 2.
// 3) 스킬 서브메뉴의 중복 "공격"(위력 8, 기본 공격보다 약함) 제거 — 기본 공격 커맨드와
//    겹쳐 혼란만 줬다.
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
const log = [];

// 1) 일반 트룹의 트룹 배경 제거 → 지형 연동 활성화
const GENERIC_TROOPS = new Set(["troop_slime", "troop_slime_pair", "troop_bat_swarm", "troop_forest_hornets", "troop_golem_guard", "troop_dragon"]);
for (const troop of db.troops ?? []) {
  if (GENERIC_TROOPS.has(troop.id) && troop.previewBackgroundResourceId) {
    log.push(`troop ${troop.id}: previewBackground ${troop.previewBackgroundResourceId} 제거(지형 연동)`);
    delete troop.previewBackgroundResourceId;
  }
}

// 2) 시작 인벤토리
project.session = project.session ?? {};
project.session.inventory = project.session.inventory ?? {};
if (!project.session.inventory.item_potion) {
  project.session.inventory.item_potion = 3;
  log.push("inventory: 회복약 3");
}
const orb = db.items.find((item) => item.id === "item_capture_orb");
if (orb?.captureProfile && !project.session.inventory.item_capture_orb) {
  project.session.inventory.item_capture_orb = 2;
  log.push("inventory: 포획 구슬 2");
} else if (!orb?.captureProfile) {
  log.push("(포획 구슬에 captureProfile 없음 — 미지급)");
}

// 3) 중복 "공격" 스킬 제거 (액터 + 클래스 습득 목록)
const hero = db.actors.find((actor) => actor.id === "actor_hero");
if (hero?.learnedSkills?.some((entry) => entry.skillId === "skill_attack")) {
  hero.learnedSkills = hero.learnedSkills.filter((entry) => entry.skillId !== "skill_attack");
  log.push("hero.learnedSkills: skill_attack 제거");
}
const heroClass = (db.classes ?? []).find((cls) => cls.id === hero?.classId);
if (heroClass?.learnedSkills?.some((entry) => entry.skillId === "skill_attack")) {
  heroClass.learnedSkills = heroClass.learnedSkills.filter((entry) => entry.skillId !== "skill_attack");
  log.push("class.learnedSkills: skill_attack 제거");
}

console.log(log.join("\n") || "(no changes)");

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
