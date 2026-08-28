import { expect, test } from "@playwright/test";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

/* 실측 회귀: 병렬 에이전트가 브라우저 QA 중에 `src/` 를 저장하면 HMR 이 리로드를 밀어넣어
 * 페이지가 날아갔다(openwiki/testing.md). Playwright 가 띄운 서버는 E2E_FREEZE_DEV_SERVER 로
 * 얼려 두므로, 여기서 실제로 소스 파일을 건드려 보고 페이지가 살아남는지 고정한다.
 *
 * 스텁이 아니라 진짜 파일 쓰기를 한다 — 파일 감시가 살아 있으면 이 테스트는 실패해야 한다.
 * webServer 를 재사용한 실행(이미 떠 있던 개발 서버)에서는 얼지 않은 게 정상이므로 건너뛴다. */

const CANARY = "src/main.ts";

test("a concurrent src edit does not reload the page under QA", async ({ page }) => {
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });

  // 리로드가 일어나면 사라지는 표식. 페이지 컨텍스트가 살아 있는지 판별하는 유일한 근거다.
  await page.evaluate(() => {
    (window as unknown as { __qaCanary?: string }).__qaCanary = "alive";
  });
  expect(await page.evaluate(() => (window as unknown as { __qaCanary?: string }).__qaCanary)).toBe("alive");

  const before = readFileSync(CANARY, "utf8");
  try {
    appendFileSync(CANARY, `\n// qa-freeze-probe ${before.length}\n`);
    // HMR 이 살아 있다면 이 시간 안에 리로드가 들어온다(vite 는 저장 즉시 전파한다).
    await page.waitForTimeout(3_000);

    const canary = await page.evaluate(() => (window as unknown as { __qaCanary?: string }).__qaCanary);
    expect(canary, "src 저장이 QA 중인 페이지를 리로드시켰다 — dev 서버가 얼지 않았다").toBe("alive");
  } finally {
    writeFileSync(CANARY, before);
  }
});
