#!/usr/bin/env node
/**
 * 변경 영향만 도는 Vitest 래퍼.
 *
 * 왜 필요한가 (2026-09-14 실측, 이 박스): 전체 `npm test` 는 2,093 파일 / 21,894 케이스로
 * wall 1,715 s(28분 35초)다. 스위트는 진짜 연산이다 — 가장 무거운
 * `test/aiAssistantSession.test.ts` 단독 실행이 wall 4분 24초에 CPU 88%. 그래서 워커·pool
 * 튜닝(`--pool=threads`, `--no-isolate`, `--maxWorkers`)으로는 줄지 않는다. 남은 레버는
 * **도는 파일 수**뿐이고, git diff 에서 역참조로 좁힌 이 경로가 실측 254 s(4분 14초, 454 파일)다.
 *
 * `--changed` 는 import 그래프까지 타고 넓히므로 "내가 만진 파일" 보다 넓게 잡는다
 * (커밋 diff 6건 → 454 파일). 그래서 커밋 전 신호로는 충분하고, 머지 전 게이트는
 * 여전히 `npm run gates` 다.
 *
 * 사용:
 *   npm run test:changed                    # HEAD 대비 (커밋 안 한 변경)
 *   npm run test:changed -- origin/main     # 브랜치 기준
 *   npm run test:changed -- HEAD~1          # 직전 커밋 포함
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ref = process.argv[2] ?? "HEAD";
if (process.argv.length > 3) {
  console.error(`인자는 기준 ref 하나만 받는다: npm run test:changed -- <ref> (받은 값: ${process.argv.slice(2).join(" ")})`);
  process.exit(2);
}

const root = process.cwd();
const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8" });
if (inside.status !== 0 || inside.stdout.trim() !== "true") {
  console.error("git 저장소가 아니라 --changed 를 쓸 수 없다.");
  process.exit(2);
}
const resolved = spawnSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { cwd: root, encoding: "utf8" });
if (resolved.status !== 0) {
  console.error(`기준 ref 를 찾을 수 없다: ${ref}`);
  process.exit(2);
}

// `npm test` 와 같은 플래그(--configLoader bundle)로 돌려야 게이트와 결과가 어긋나지 않는다.
const runner = join(dirname(fileURLToPath(import.meta.url)), "run-vitest.mjs");
console.log(`[test:changed] 기준 ${ref} (${resolved.stdout.trim().slice(0, 12)}) 이후 변경 영향만 실행`);
const result = spawnSync(process.execPath, [runner, "run", "--changed", ref, "--configLoader", "bundle"], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
