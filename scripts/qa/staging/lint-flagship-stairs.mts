// 계단 입구 검사(stair-entrance-blocked · stair-misfacing · stair-trigger-off)를 대표 데모 셋에 돌린다.
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/staging/lint-flagship-stairs.mts [--json]
const { createFlagshipDemoProject } = await import("../../../src/project/flagship");
const { lintStairEntrances } = await import("../../../src/project/lint/stairEntranceLint");
const { findPlacedStairs } = await import("../../../src/project/stairs/detect");
const demos = [["first-love", "첫사랑"], ["chrono-bell", "Fallen Star"], ["emerald-crown", "Astra Horizon"]] as const;
const out: Record<string, unknown> = {};
for (const [id, label] of demos) {
  const project = createFlagshipDemoProject(id as never).project;
  const stairs = Object.values(project.maps).flatMap((m) => findPlacedStairs(project, m).map((s) => ({ map: m.id, kit: s.kitId, x: s.x, y: s.y, leads: s.contract.leads })));
  const issues = lintStairEntrances(project);
  out[label] = { stairs, issues };
  if (!process.argv.includes("--json")) {
    console.log(`\n== ${label} (${id}) — 계단 ${stairs.length}개, 경고 ${issues.length}건`);
    for (const s of stairs) console.log(`  계단 ${s.map} ${s.kit} @(${s.x},${s.y}) ${s.leads}`);
    for (const i of issues) console.log(`  [${i.code}] ${i.mapId} ${i.message}`);
  }
}
if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(out, null, 1));
