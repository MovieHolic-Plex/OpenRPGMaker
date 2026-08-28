import { expect, test } from "@playwright/test";
import { gotoWithRetry, isTransientNavigationError } from "../../scripts/lib/goto-retry.mjs";

/* `gotoWithRetry` 의 값어치는 "크로미움이 실제로 던지는 에러 문자열"을 알아보는 데 있다.
 * 스텁 유닛 테스트(test/gotoRetry.test.ts)는 우리가 흉내낸 문자열만 검증하므로,
 * 여기서 진짜 크로미움 네트워크 스택이 낸 거부를 한 번 통과시킨다.
 * ERR_NETWORK_CHANGED 는 호스트 네트워크를 흔들어야 나와 테스트로 만들 수 없어서,
 * 같은 계열(전송 계층 중단)인 connectionreset 을 첫 시도에만 주입한다. */
test("gotoWithRetry recovers from a real transport-level abort and reports the retry", async ({ page }) => {
  let aborted = 0;
  await page.route("**/*", async (route) => {
    if (route.request().isNavigationRequest() && aborted === 0) {
      aborted += 1;
      await route.abort("connectionreset");
      return;
    }
    await route.continue();
  });

  const retries: number[] = [];
  const seenErrors: unknown[] = [];

  const response = await gotoWithRetry(page, "/?freshProject=1", {
    waitUntil: "commit",
    delayMs: 50,
    onRetry: (error, attempt) => {
      retries.push(attempt);
      seenErrors.push(error);
    },
  });

  expect(aborted).toBe(1);
  expect(retries).toEqual([1]);
  expect(isTransientNavigationError(seenErrors[0])).toBe(true);
  expect(response?.ok()).toBe(true);
});

test("gotoWithRetry does not retry a genuinely broken navigation", async ({ page }) => {
  await page.route("**/*", async (route) => {
    if (route.request().isNavigationRequest()) {
      await route.abort("connectionrefused");
      return;
    }
    await route.continue();
  });

  let attempts = 0;
  await expect(
    gotoWithRetry(page, "/?freshProject=1", {
      waitUntil: "commit",
      delayMs: 50,
      onRetry: () => {
        attempts += 1;
      },
    }),
  ).rejects.toThrow(/ERR_CONNECTION_REFUSED/);
  expect(attempts).toBe(0);
});
