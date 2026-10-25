// 테스트 러너(vitest·bun test·playwright test·gates)는 GitHub CI 에서만 돈다 (hard rule, 2026-10-25).
//
// 왜: 이 저장소는 공개 저장소라 CI 가 모든 PR 에서 같은 검사를 돌린다. 개발 기계에서 에이전트들이
// 「바꾼 파일만」 vitest 를 겹쳐 돌려 부하가 196까지 올랐다(실측). 지시문 금지만으로는 막지 못했다.
//
// GitHub Actions 는 CI=true 를 넣는다. 로컬에서는 사용자가 그 메시지에서 직접 시켰을 때만
// OPRN_LOCAL_TESTS=1 을 붙여 연다. 에이전트가 스스로 붙이는 것은 금지다(AGENTS.md).
export function assertCiOnlyTests(runner) {
  if (process.env.CI === "true" || process.env.CI === "1") return;
  if (process.env.OPRN_LOCAL_TESTS === "1") return;
  process.stderr.write(
    `\n[ci-only] ${runner} 는 로컬에서 돌리지 않는다. PR 을 올리면 GitHub CI 가 돌린다.\n` +
      `[ci-only] 사용자가 이번 메시지에서 직접 시킨 경우에만 OPRN_LOCAL_TESTS=1 을 붙인다. AGENTS.md 「테스트는 GitHub CI 에서만」.\n\n`,
  );
  process.exit(1);
}
