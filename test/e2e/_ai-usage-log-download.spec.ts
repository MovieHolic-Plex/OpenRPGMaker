// ☰ 「사용 로그 내려받기」 실브라우저 증거 — 메뉴에 실제로 보이는지 + 눌러서 받은 .txt 내용.
// `_` 접두사라 기본 e2e 실행에서 제외된다(증거용).
//
// 실행: DEV_SERVER_PORT=9443 npx playwright test test/e2e/_ai-usage-log-download.spec.ts --project=chromium
//
// happy-dom 단위 테스트(`test/aiUsageLogDownload.test.ts`)가 못 보는 것만 여기서 본다:
// 실제 링버퍼(localStorage) → 실제 앵커 클릭 → 브라우저가 저장한 파일. 저장 경로에
// 손대지 않고 Playwright 의 download 이벤트로 받은 파일을 그대로 읽어 증거로 남긴다.
//
// 2026-09-09 최초 증거는 이 러너가 아니라 Playwright MCP 브라우저로 받았다(작업 트리에
// @playwright/test 가 설치되어 있지 않아 러너 자체가 뜨지 않는다). 결과물은
// verify-shots/ai-usage-log/ 에 있고, 그때 배운 것을 이 파일의 단정에 반영했다 —
// 화면 조작도 같은 링버퍼에 쌓이므로 기록 건수·순번은 못 박지 않는다.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-usage-log";
mkdirSync(OUT, { recursive: true });

/** src/ai/activityLog.ts 의 저장 키 — 기록 API 를 태우면 원격 미러 fetch 가 붙는다. */
const ACTIVITY_STORAGE_KEY = "oprn:ai-activity-logs";

const SEEDED = [
  {
    id: "evi-2",
    at: "2026-09-09T04:10:00.000Z",
    channel: "chat",
    model: "gemini-3-pro",
    instruction: "마을 광장에\n분수를 놓아줘",
    mapId: "map-1",
    mapName: "마을",
    region: { x: 2, y: 3, width: 4, height: 5 },
    result: {
      ok: true,
      applied: true,
      changedCells: 12,
      changedEvents: 1,
      assistantText: "분수를 놓았습니다.",
      recap: { elapsedMs: 3200, promptTokens: 1200, completionTokens: 340, llmCalls: 2, toolCalls: 1, ralphContinues: 0, volumeContinues: 0, process: [] },
    },
    toolCalls: [{ name: "place_tiles", args: { x: 2, y: 3 }, ok: true, summary: "12칸 배치" }],
    audit: [
      { kind: "user", text: "마을 광장에 분수를 놓아줘" },
      { kind: "status", text: "턴 종료" },
    ],
  },
  {
    id: "evi-1",
    at: "2026-09-09T04:00:00.000Z",
    channel: "region",
    model: "gemini-3-pro",
    instruction: "여기 길을 이어줘",
    result: { ok: false, applied: false, error: "좌표가 맵 밖입니다" },
    toolCalls: [{ name: "place_tiles", args: {}, ok: false, summary: "실패", reason: "좌표가 맵 밖" }],
    audit: [{ kind: "status", text: "중단" }],
  },
];

test("☰ 사용 로그 내려받기 — 메뉴 항목과 받은 txt", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript((seed) => {
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-activity-logs", seed);
  }, JSON.stringify(SEEDED));
  page.on("pageerror", (err) => console.log(`PAGE-ERROR ${String(err).slice(0, 300)}`));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });

  // 씨앗이 실제로 링버퍼 자리에 있는지 먼저 확인한다(부팅이 키를 지우면 여기서 붉은불).
  const seeded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, ACTIVITY_STORAGE_KEY);
  expect(seeded).toBeGreaterThanOrEqual(2);

  await page.getByTestId("ai-command-menu-toggle").click();
  const item = page.getByTestId("ai-command-menu-usage-log");
  await expect(item).toBeVisible();
  await page.screenshot({ path: `${OUT}/menu-open.png` });

  const download = page.waitForEvent("download");
  await item.click();
  const saved = await download;
  expect(saved.suggestedFilename()).toMatch(/^ai-usage-log-.*\.txt$/u);
  const path = await saved.path();
  expect(path).toBeTruthy();
  const text = await import("node:fs/promises").then((fs) => fs.readFile(path as string, "utf8"));
  writeFileSync(`${OUT}/${saved.suggestedFilename()}`, text, "utf8");

  expect(text).toContain("AI 조수 사용 로그");
  // 건수·순번은 못 박지 않는다: 화면 조작(ui 채널)도 같은 링버퍼에 쌓여서 메뉴를 여는
  // 것만으로 기록이 하나 늘어난다. 씨앗 두 건이 온전히 실려 나갔는지만 본다.
  expect(text).toMatch(/기록: \d+건 \(최신 순\)/u);
  expect(text).toContain("2026-09-09T04:10:00.000Z · 대화 · 성공");
  expect(text).toContain("지시:\n  마을 광장에\n  분수를 놓아줘");
  expect(text).toContain("자원: 3.2초 · LLM 2회 · 도구 1회 · 토큰 1200/340");
  expect(text).toContain("1. [ok] place_tiles — 12칸 배치");
  expect(text).toContain("2026-09-09T04:00:00.000Z · 영역 작업 · 실패");
  expect(text).toContain("오류: 좌표가 맵 밖입니다");
  console.log(`SAVED ${OUT}/${saved.suggestedFilename()} (${text.length}자)`);

  // 저장 뒤 토스트가 건수를 말한다 — 사용자가 "받았는지" 를 아는 유일한 신호다.
  const toast = page.locator(".toast-message").filter({ hasText: "사용 로그" }).first();
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText("txt 로 저장했습니다");
  await page.screenshot({ path: `${OUT}/after-download.png` });

  // 빈 로그 계약: 파일을 만들지 않고 안내만 한다.
  await page.evaluate((key) => localStorage.removeItem(key), ACTIVITY_STORAGE_KEY);
  let extraDownloads = 0;
  page.on("download", () => { extraDownloads += 1; });
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByTestId("ai-command-menu-usage-log").click();
  await expect(page.locator(".toast-message").filter({ hasText: "아직 저장된 조수 사용 기록이 없습니다" }).first()).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: `${OUT}/empty-log-toast.png` });
  expect(extraDownloads).toBe(0);
});
