// 인물 연출 검사(scene-speaker-absent·scene-talk-far·scene-talk-facing)를 대표 데모 셋에 돌린다.
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/staging/lint-flagship-staging.mts [--json]
const { createFlagshipDemoProject } = await import("../../../src/project/flagship");
const { lintSceneStaging, stagingLintStats } = await import("../../../src/project/lint/sceneStagingLint");
const demos = [["first-love", "첫사랑"], ["chrono-bell", "Fallen Star"], ["emerald-crown", "Astra Horizon"]] as const;
const out: Record<string, unknown[]> = {};
for (const [id, label] of demos) {
  const project = createFlagshipDemoProject(id as never).project;
  Object.assign(stagingLintStats, { lines: 0, resolved: 0, measured: 0 });
  const issues = lintSceneStaging(project);
  out[label] = issues;
  if (!process.argv.includes("--json")) {
    const byCode = new Map<string, number>();
    for (const i of issues) byCode.set(i.code, (byCode.get(i.code) ?? 0) + 1);
    console.log(`\n== ${label} (${id}) — ${issues.length} 건 ${JSON.stringify(Object.fromEntries(byCode))} · 화자 있는 대사 ${stagingLintStats.lines}줄 / 인물로 푼 줄 ${stagingLintStats.resolved} / 거리·방향 잰 줄 ${stagingLintStats.measured}`);
    for (const i of issues) console.log(`  [${i.code}] ${i.mapId} ${i.message}`);
  }
}
if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(out, null, 1));
