// 기본 DB(새 프로젝트가 받는 것)의 전투 깊이를 실측한다. grep 으로는 헬퍼 함수 뒤에
// 숨은 실제 값을 못 본다 — 만들어서 세는 게 유일하게 정확하다. 읽기 전용.
import { defaultDatabase } from "@/project/defaults/defaultDatabase";

const db = defaultDatabase();
const count = (label: string, arr: readonly unknown[] | undefined) =>
  console.log(`${label.padEnd(14)} ${arr?.length ?? 0}`);

console.log("=== 레코드 수 ===");
for (const key of ["elements", "states", "skills", "items", "classes", "actors", "enemies", "troops", "equipment"] as const) {
  count(key, (db as Record<string, readonly unknown[]>)[key]);
}

console.log("\n=== 속성(elements) ===");
for (const e of (db.elements ?? []) as any[]) {
  console.log(`  ${String(e.id).padEnd(22)} ${String(e.name).padEnd(10)} kind=${e.kind}`);
}

console.log("\n=== 상태이상(states) ===");
for (const s of (db.states ?? []) as any[]) {
  console.log(`  ${String(s.id).padEnd(22)} ${s.name}`);
}

console.log("\n=== 스킬: 상태이상을 부여/해제하는가 ===");
const stateIds = new Set((db.states ?? []).map((s: any) => s.id));
let withState = 0;
for (const sk of (db.skills ?? []) as any[]) {
  // 스킬 레코드 전체를 훑어 알려진 state id 를 실제로 참조하는지 본다.
  // 필드명을 추측하면(addStates/stateIds…) 스키마가 다를 때 조용히 0 이 나온다.
  const blob = JSON.stringify(sk);
  const hits = [...stateIds].filter((id) => blob.includes(`"${id}"`));
  if (hits.length) withState++;
  console.log(`  ${String(sk.id).padEnd(24)} ${String(sk.name).padEnd(12)} element=${String(sk.elementId ?? "-").padEnd(8)}`
    + ` 상태=${hits.length ? hits.join(",") : "-"}`);
}
console.log(`  → 상태이상을 건드리는 스킬: ${withState}/${(db.skills ?? []).length}`);

console.log("\n=== 직업 곡선: Lv1 / Lv50 ===");
for (const c of (db.classes ?? []) as any[]) {
  const at = (k: string, lv: number) => c.parameterCurves?.[k]?.[lv - 1] ?? "?";
  console.log(`  ${String(c.name).padEnd(8)} atk ${at("attack", 1)}→${at("attack", 50)}  def ${at("defense", 1)}→${at("defense", 50)}`
    + `  mind ${at("mind", 1)}→${at("mind", 50)}  agi ${at("agility", 1)}→${at("agility", 50)}  skills=${(c.skillIds ?? []).length}`);
}

console.log("\n=== 적: 스킬/행동패턴을 가졌는가 ===");
for (const e of (db.enemies ?? []) as any[]) {
  const patterns = e.actionPatterns ?? e.actions ?? [];
  console.log(`  ${String(e.id).padEnd(22)} ${String(e.name).padEnd(12)} 행동패턴=${patterns.length} 속성저항=${Object.keys(e.elementRates ?? {}).length}`);
}

console.log("\n=== 트룹 ===");
for (const t of (db.troops ?? []) as any[]) {
  console.log(`  ${String(t.id).padEnd(22)} ${String(t.name).padEnd(14)} 적=${(t.members ?? []).length} 전투이벤트=${(t.pages ?? t.events ?? []).length}`);
}
