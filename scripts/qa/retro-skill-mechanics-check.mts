// retro2003 로스터 스킬 기믹 검사 — 묶음(src/assets/retroRosterSkills/<묶음>.ts)의 mechanic 칸이 설계 규칙을 지키는가.
// 규칙의 정본은 src/assets/retroSkillMechanics.ts 의 RETRO_SKILL_DESIGN_GUIDE. 이 검사는 그 규칙 1~3 과 앵커·상태 id 를 기계로 잰다.
//
//   node_modules/.bin/vite-node --script scripts/qa/retro-skill-mechanics-check.mts [--batch a2] [--all]
//
// 오류(exit 1): 없는 상태 id · 직업의 순수 1타 3개 이상 · 기믹 종류 4종 미만 · 필살기(level 22)가 순수 1타 ·
//               전체 공격인데 연출이 한 대상에만(allTargets/screen 층 없음) · allTargets 연출인데 단일 대상(area 없음).
// 경고: 이름이 약속한 효과(흡수·연막·슬로우·관통…)가 레코드에 없음 — 낱말 검사라 오탐이 있다. 고치거나 이유를 적는다.
import { defaultSkillRecords, defaultStateRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { retroRosterClass } from "@/assets/retroRoster";
import type { SkillRecord } from "@/project/types";

const args = process.argv.slice(2);
const batchArg = args.includes("--batch") ? args[args.indexOf("--batch") + 1] : undefined;

const skills = new Map(defaultSkillRecords().map((skill) => [skill.id, skill]));
const states = new Set(["state_death", ...defaultStateRecords().map((state) => state.id)]);

const has = (skill: SkillRecord, stateId: string, op: "add" | "remove" = "add") =>
  (skill.stateEffects ?? []).some((effect) => effect.stateId === stateId && (effect.operation ?? "add") === op);
const hasAny = (skill: SkillRecord, ids: readonly string[]) => ids.some((id) => has(skill, id) || has(skill, id, "remove"));

/** 이름·설명 낱말 → 레코드가 해야 하는 일. 낱말 검사라 오탐이 있다(경고). */
const PROMISES: readonly [RegExp, (skill: SkillRecord) => boolean, string, ("name" | "both")?][] = [
  [/슬로우/, (s) => has(s, "state_agility_down"), "슬로우 → state_agility_down"],
  [/헤이스트/, (s) => has(s, "state_agility_up"), "헤이스트 → state_agility_up"],
  [/스톱|시간 정지/, (s) => has(s, "state_stop"), "스톱 → state_stop"],
  [/연막|눈을 가|눈을 멀/, (s) => has(s, "state_blind"), "연막·눈가림 → state_blind"],
  [/그래비티|중력/, (s) => /b\.hp/.test(s.damageFormula ?? ""), "중력 → 현재 HP 비례 formula"],
  [/흡수|드레인|흡혈|흡정|빨아/, (s) => (s.drainPercent ?? 0) > 0 || s.effect.kind === "steal", "흡수 → drain"],
  [/독|포이즌|맹독/, (s) => hasAny(s, ["state_poison", "state_deep_poison"]), "독 → state_poison/deep_poison"],
  [/수면|잠재|재운|자장/, (s) => hasAny(s, ["state_sleep"]), "수면 → state_sleep"],
  [/마비|저리/, (s) => hasAny(s, ["state_paralysis"]), "마비 → state_paralysis"],
  [/침묵|사일런스|입을 막/, (s) => hasAny(s, ["state_silence"]), "침묵 → state_silence"],
  [/석화|돌로 만/, (s) => hasAny(s, ["state_petrify"]), "석화 → state_petrify"],
  [/부활|소생|되살/, (s) => has(s, "state_death", "remove"), "부활 → revive"],
  [/프로텍트/, (s) => has(s, "state_protect"), "프로텍트 → state_protect"],
  [/버서크|광폭|광란/, (s) => has(s, "state_berserk"), "버서크 → state_berserk"],
  [/(두|세|네|다섯|여섯|2|3|4|5|6)\s*(번|연|연속|연격|연사|연타|연참)|연타|연격|난타|난무/, (s) => (s.hitSequence?.length ?? 1) > 1, "연타 → hits 여러 개", "name"],
  [/꿰뚫|관통/, (s) => s.area?.shape === "line" || s.scope === "allEnemies", "관통 → area line", "name"],
  [/훔치|스틸|강탈|슬쩍/, (s) => s.effect.kind === "steal", "훔치기 → kind steal"],
  [/정화|해독|씻어|디스펠/, (s) => (s.stateEffects ?? []).some((e) => e.operation === "remove"), "정화 → states op remove"],
];

function isPlain(skill: SkillRecord): boolean {
  return (skill.hitSequence?.length ?? 1) <= 1 && !skill.stateEffects?.length && !skill.drainPercent && !skill.hpCostPercent
    && !skill.area && !skill.damageFormula && skill.effect.kind === "damage" && skill.scope !== "allEnemies";
}

/** 기믹 종류(규칙 1 의 「서로 다른 기믹 최소 4종」). */
function mechanicKinds(skill: SkillRecord): string[] {
  const kinds: string[] = [];
  if ((skill.hitSequence?.length ?? 1) > 1) kinds.push("다단");
  if (skill.area) kinds.push("범위 모양");
  if (skill.scope === "allEnemies") kinds.push("전체 공격");
  if (skill.damageFormula) kinds.push("비율 수식");
  if (skill.hpCostPercent) kinds.push("대가");
  if (skill.drainPercent) kinds.push("흡수");
  if (skill.effect.kind === "healing") kinds.push(has(skill, "state_death", "remove") ? "부활" : "회복");
  if (skill.effect.kind === "steal") kinds.push("훔치기");
  if (skill.effect.kind === "scan") kinds.push("탐지");
  for (const effect of skill.stateEffects ?? []) {
    if (effect.stateId === "state_death") continue;
    if (effect.operation === "remove") kinds.push("해제");
    else if (/_up$|protect|shell|regen/.test(effect.stateId)) kinds.push("강화");
    else if (/wet|oiled/.test(effect.stateId)) kinds.push("약점 만들기");
    else if (/stop|agility/.test(effect.stateId)) kinds.push("시간");
    else kinds.push("상태 이상");
  }
  return [...new Set(kinds)];
}

const errors: string[] = [];
const warnings: string[] = [];
const byClass = new Map<string, { batch: string; rows: { id: string; name: string; level: number; record: SkillRecord }[] }>();

for (const contract of RETRO_ROSTER_SKILLS) {
  const batch = retroRosterClass(contract.classId)?.batch ?? "?";
  if (batchArg && batch !== batchArg) continue;
  const record = skills.get(contract.id);
  const label = `${contract.id} 「${contract.name}」`;
  if (!record) { errors.push(`${label}: SkillRecord 없음`); continue; }
  const entry = byClass.get(contract.classId) ?? { batch, rows: [] };
  entry.rows.push({ id: contract.id, name: contract.name, level: contract.level, record });
  byClass.set(contract.classId, entry);
  for (const effect of record.stateEffects ?? []) if (!states.has(effect.stateId)) errors.push(`${label}: 없는 상태 ${effect.stateId}`);
  // state_death 는 부활(remove)만 엔진이 안다. add(즉사)는 조용히 무시된다(applyStateEffects 가 레코드 없는 상태를 건너뛴다).
  if ((record.stateEffects ?? []).some((effect) => effect.stateId === "state_death" && (effect.operation ?? "add") === "add")) errors.push(`${label}: state_death add(즉사)는 엔진이 지원하지 않는다 — 비율 수식·석화 등으로`);
  const anchors = new Set(contract.layers.map((layer) => layer.anchor));
  // 피해 없는 전체 약화(support)는 상태 숫자가 적마다 뜨므로 시전자 층만 있어도 된다.
  if (record.scope === "allEnemies" && record.effect.kind === "damage" && !anchors.has("allTargets") && !anchors.has("screen")) {
    errors.push(`${label}: 전체 공격(scope allEnemies)인데 연출 층이 한 대상에만 뜬다 — 타격 층 anchor 를 allTargets 로, 또는 scope enemy + area`);
  }
  if (anchors.has("allTargets") && record.scope === "enemy" && !record.area) {
    errors.push(`${label}: allTargets 연출인데 단일 대상 — scope allEnemies 또는 area 를 준다`);
  }
  for (const [pattern, ok, want] of PROMISES) if (pattern.test(contract.name) && !ok(record)) warnings.push(`${label}: 이름이 약속 — ${want}`);
  for (const [pattern, ok, want, where] of PROMISES) if (where !== "name" && !pattern.test(contract.name) && pattern.test(contract.description) && !ok(record)) warnings.push(`${label}: 설명이 약속 — ${want} (「${contract.description}」)`);
}

for (const [classId, { batch, rows }] of byClass) {
  const plain = rows.filter((row) => isPlain(row.record));
  if (plain.length > 2) errors.push(`[${batch}] ${classId}: 순수 1타 ${plain.length}개(최대 2) — ${plain.map((row) => row.name).join(", ")}`);
  const kinds = new Set(rows.flatMap((row) => mechanicKinds(row.record)));
  if (kinds.size < 4) errors.push(`[${batch}] ${classId}: 기믹 ${kinds.size}종(최소 4) — ${[...kinds].join(", ")}`);
  const finisher = rows.find((row) => row.level === 22);
  if (finisher && isPlain(finisher.record)) errors.push(`[${batch}] ${classId}: 필살기 「${finisher.name}」가 순수 1타`);
}

console.log(`검사 ${batchArg ?? "전체"}: 직업 ${byClass.size} · 스킬 ${[...byClass.values()].reduce((n, c) => n + c.rows.length, 0)} · 오류 ${errors.length} · 경고 ${warnings.length}`);
if (errors.length) console.log("\n오류\n" + errors.map((line) => "  " + line).join("\n"));
if (warnings.length) console.log("\n경고\n" + warnings.map((line) => "  " + line).join("\n"));
process.exitCode = errors.length ? 1 : 0;
