// 밸런스 4차(코덱스 리뷰 C8): 1차 밸런스가 "검격 mpCost 0→4"를 의도했지만 스키마에
// 없는 필드(mpCost 숫자)를 써서 헛돌았다 — 실제 스키마는 mpCost: {flat, percentMax}.
// MP 0 · 위력 22 검격이 기본 공격(위력 8)의 완전한 상위호환이라 자동전투가 검격만
// 반복하고 MP 자원 선택이 무의미했다.
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

const slash = db.skills.find((s) => s.id === "skill_sword_slash");
if (!slash) { console.error("skill_sword_slash not found"); process.exit(1); }
console.log("검격 mp:", JSON.stringify(slash.mpCost), "→ {flat: 4}");
slash.mpCost = { ...slash.mpCost, flat: 4 };

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
