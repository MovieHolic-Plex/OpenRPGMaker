import { expect, test, type Locator, type Page } from "@playwright/test";
import { revealDbRailTab } from "./dbRail";

// QA 네 건: 탭 전용 저장 표시, ChatGPT 안내와 줌 막대 겹침, 조수에게 맡기기의 런타임 오류, 칭호·영어·가져오기 토스트.
// 동반 서비스가 없어도 안내 띠가 뜨게 로그인 없음으로 응답한다. 작은 일은 409 다음 500(Bun 없음)을 흉내 낸다.

const BUN_ERROR = "bun 이 필요합니다. oh-my-pi 제공자 로그인/전송은 Bun 에서만 로드됩니다.";
const RUNTIME_KO = "AI 실행 환경을 쓸 수 없어요. Bun 런타임이 설치되지 않았거나 시작되지 않았습니다.";
const IMPORT_KO = "이 파일은 프로젝트 JSON이 아닙니다.";

// 로컬 데스크톱 검증은 시스템 Chrome 이다(E2E_CHANNEL=chrome). CI 는 프로젝트의 Playwright Chromium 을 쓴다.
if (process.env.E2E_CHANNEL === "chrome") {
  test.use({
    channel: "chrome",
    launchOptions: {
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    },
  });
}

async function stubSignedOut(page: Page): Promise<void> {
  await page.route("**/auth/status**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ connected: false }),
  }));
}

async function openEditor(page: Page, search: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/${search}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("toolbar-save")).toBeVisible({ timeout: 30_000 });
}

async function hitTestId(page: Page, target: Locator): Promise<string | null> {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  return page.evaluate(({ x, y }) => {
    const node = document.elementFromPoint(x, y);
    return node?.closest("[data-testid]")?.getAttribute("data-testid") ?? node?.tagName ?? null;
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
}

test.describe("QA editor honesty", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test("blank project tells the truth about saving, the notice, actors, and import", async ({ page }) => {
    await stubSignedOut(page);
    await openEditor(page, "?blankProject=1");

    const save = page.getByTestId("toolbar-save");
    await expect(save).toHaveAttribute("data-autosave-kind", "unsaved-session");
    await expect(save).toContainText("저장 안 됨 · 이 탭만");
    await expect(save).not.toHaveClass(/is-failing/);
    await expect(page.getByTestId("toolbar-save-autosave")).toContainText("저장 안 됨 · 이 탭에만 있어요");
    await page.screenshot({ path: "/opt/cursor/artifacts/after-save-chip-ko.png" });

    const noticeButton = page.getByTestId("image-generation-notice-action");
    await expect(noticeButton).toBeVisible({ timeout: 20_000 });
    expect(await hitTestId(page, noticeButton)).toBe("image-generation-notice-action");
    await noticeButton.click();
    await expect(page.getByTestId("ai-settings-modal")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "/opt/cursor/artifacts/after-notice-settings-ko.png" });
    await page.getByTestId("ai-settings-close").click();
    await expect(page.getByTestId("ai-settings-modal")).toBeHidden();

    await page.getByTestId("toolbar-database").click();
    await revealDbRailTab(page, "actors");
    await expect(page.getByTestId("db-tab-actors")).toBeVisible({ timeout: 60_000 });
    await revealDbRailTab(page, "actors");
    await page.getByTestId("db-tab-actors").click();
    await page.getByTestId("database-footer-apply").evaluate((button: HTMLElement) => button.click()); // 평소 숨은 「지금 저장」(btn-trim-r2)
    await expect(save).toHaveAttribute("data-autosave-kind", "unsaved-session");
    await expect(save).not.toHaveClass(/is-failing/);
    await expect(page.getByTestId("db-footer-status")).not.toHaveAttribute("data-status-kind", "error");
    await expect(page.getByTestId("database-save-error")).toBeHidden();
    await page.screenshot({ path: "/opt/cursor/artifacts/after-save-now-ko.png" });

    await page.getByTestId("db-add-record").click();
    const nickname = page.getByTestId("db-field-actor-nickname");
    await expect(nickname).toHaveValue("");
    await page.screenshot({ path: "/opt/cursor/artifacts/after-nickname-empty.png" });
    await page.getByTestId("database-modal-close").click();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
    await expect(save).toHaveAttribute("data-autosave-kind", "unsaved-session");
    await expect(save).toContainText("저장 안 됨 · 이 탭만");

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("menu-project").click();
    await page.getByTestId("menu-project-import").click();
    await (await chooserPromise).setFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("not json {") });
    await page.getByTestId("app-modal-confirm").click();
    const toast = page.getByTestId("toast");
    await expect(toast).toContainText(IMPORT_KO, { timeout: 15_000 });
    await expect(toast).not.toContainText(/Unexpected token|JSON\.parse/i);
    await page.screenshot({ path: "/opt/cursor/artifacts/after-import-toast-ko.png" });

    let runs = 0;
    await page.route("**/v1/agent/run**", (route) => {
      runs += 1;
      const body = runs === 1
        ? { error: "heavy-missing", missing: ["demo"] }
        : { error: BUN_ERROR };
      return route.fulfill({ status: runs === 1 ? 409 : 500, contentType: "application/json", body: JSON.stringify(body) });
    });
    const openTask = page.getByTestId("editor-zoom-controls").getByTestId("small-task-open");
    await openTask.click();
    const task = page.locator(".small-task").filter({ visible: true });
    await expect(task).toBeVisible();
    await task.locator("input").fill("이름을 더 짧게");
    await task.locator("button[type='submit']").click();
    await expect(task).toContainText(RUNTIME_KO, { timeout: 20_000 });
    await expect(task).not.toContainText("로그인이 만료");
    await page.screenshot({ path: "/opt/cursor/artifacts/after-small-task-runtime-ko.png" });
  });

  test("english mode localizes the same surfaces and keeps the notice clickable", async ({ page }) => {
    await stubSignedOut(page);
    await openEditor(page, "?blankProject=1&lang=en");

    const save = page.getByTestId("toolbar-save");
    await expect(save).toHaveAttribute("data-autosave-kind", "unsaved-session");
    await expect(save).toContainText("Not saved · this tab only");
    await expect(save).not.toHaveClass(/is-failing/);
    await page.screenshot({ path: "/opt/cursor/artifacts/after-save-chip-en.png" });

    const noticeButton = page.getByTestId("image-generation-notice-action");
    await expect(noticeButton).toBeVisible({ timeout: 20_000 });
    expect(await hitTestId(page, noticeButton)).toBe("image-generation-notice-action");
    const noticeBox = await page.getByTestId("image-generation-notice").boundingBox();
    if (noticeBox) {
      await page.screenshot({
        path: "/opt/cursor/artifacts/after-notice-en.png",
        clip: { x: 0, y: Math.max(0, noticeBox.y - 8), width: 1440, height: Math.min(220, noticeBox.height + 80) },
      });
    }
    await noticeButton.click();
    await expect(page.getByTestId("ai-settings-modal")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("ai-settings-close").click();

    // 열린 조수 위에서는 상단 「조수」 가 걷힌다(버튼 줄이기 2회차) — 접혀 있을 때만 연다.
    if (await page.getByTestId("ai-panel").evaluate((n) => n.classList.contains("is-collapsed")).catch(() => false)) await page.getByTestId("topbar-assistant").click();
    await page.getByTestId("ai-command-menu-toggle").click();
    const meter = page.getByTestId("ai-context-meter");
    await expect(meter).toBeVisible({ timeout: 15_000 });
    await meter.click();
    await expect(page.getByTestId("ai-context-usage")).toHaveText("No requests yet", { timeout: 15_000 });
    await expect(page.getByTestId("ai-context-usage")).not.toContainText("아직 요청 없음");
    await expect(page.getByTestId("ai-status-stop")).toHaveText("■ Stop");
    await expect(page.getByTestId("ai-status-stop")).not.toContainText("멈춤");
    // 멈춤 단추는 작업이 없을 때 상태 줄과 함께 숨는다. 번역된 글자를 화면에 남기려고 줄만 드러낸다.
    await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('[data-testid="ai-status-bar"]');
      if (!bar) return;
      bar.hidden = false;
      bar.style.position = "fixed";
      bar.style.left = "240px";
      bar.style.right = "auto";
      bar.style.bottom = "28px";
      bar.style.zIndex = "40";
      bar.style.width = "auto";
      bar.style.background = "white";
    });
    await page.screenshot({ path: "/opt/cursor/artifacts/after-assistant-en.png" });

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("menu-project").click();
    await page.getByTestId("menu-project-import").click();
    await (await chooserPromise).setFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("<html>") });
    await page.getByTestId("app-modal-confirm").click();
    const toast = page.getByTestId("toast");
    await expect(toast).toContainText("This file is not project JSON", { timeout: 15_000 });
    await expect(toast).not.toContainText(/Unexpected token|JSON\.parse/i);
    await page.screenshot({ path: "/opt/cursor/artifacts/after-import-toast-en.png" });
  });
});
