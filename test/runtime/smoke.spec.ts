// 런타임(내보내기 플레이어) 전용 QA 게이트.
//
// 기본 e2e 스위트(`playwright.config.ts`, testDir=test/e2e)와 **의도적으로 분리**돼 있다.
// 그 설정의 webServer 는 `npm run dev`(에디터 셸 + 메인 vite config)를 띄우는데,
// 메인 config 는 VITE_CACHE_DIR 이 없으면 공유 `node_modules/.vite` 를 쓴다. 런타임 QA 는
// 자체 vite 서버를 전용 cacheDir 로 띄우므로 그 서버가 필요 없고, 켜면 공유 캐시만 흔든다.
// 실행: npm run qa:runtime:gate
import { expect, test } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";
import { dialogueScenario } from "../../scripts/qa/runtime/dialogue.scenario.mjs";
import { smokeScenario } from "../../scripts/qa/runtime/smoke.scenario.mjs";

// 시나리오마다 픽스처가 다르다 — 각 픽스처의 실물 특성에 기대치를 맞췄기 때문이다.
// 근거는 각 시나리오 파일 상단 주석에 있다.
const SCENARIOS = [smokeScenario, dialogueScenario];

test.setTimeout(300_000);

for (const scenario of SCENARIOS) {
  test(`런타임 게이트: ${scenario.id}`, async ({ page }) => {
    const server = await startPlayerQaServer();
    try {
      const report = await runRuntimeQa(page, scenario, { serverUrl: server.url });

      expect(report.errors, `런타임 에러:\n${report.errors.join("\n")}`).toEqual([]);

      const failed = report.beats.filter((beat) => beat.failures.length > 0);
      const detail = failed.map((beat) => `${beat.id}: ${beat.failures.join(", ")}`).join("\n");
      expect(failed.map((beat) => beat.id), `비트 실패:\n${detail}`).toEqual([]);
    } finally {
      await server.close();
    }
  });
}
