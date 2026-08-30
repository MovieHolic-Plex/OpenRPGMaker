// Live probe: type "퀘스트 만들어줘" in a real Chromium window and record
// what the assistant actually does (network, chat, project.quests).
//
//   DEV_SERVER_PORT=9173 npx playwright test test/e2e/_quest-create-live-probe.spec.ts --headed --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(
  "C:/Users/USER/.herdr/worktrees/rpg-zzu/worktree-rapid-river-7006/output/evidence/quest-create-live-probe",
);
mkdirSync(OUT, { recursive: true });

const lines: string[] = [];
function log(line: string): void {
  console.log(line);
  lines.push(line);
}

async function dismissChrome(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 4_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible({ timeout: 3_000 }).catch(() => false)) await start.click();
  for (const label of ["건너뛰기", "닫기", "그만 보기", "빈 맵으로 시작"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) await btn.click().catch(() => undefined);
  }
}

test("live: 퀘스트 만들어줘 does work in a real browser", async ({ page }) => {
  test.setTimeout(180_000);
  const net: { method: string; url: string; status: number; body: string }[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`CONSOLE-ERROR ${msg.text().slice(0, 400)}`);
  });
  page.on("pageerror", (err) => log(`PAGE-ERROR ${String(err).slice(0, 400)}`));
  page.on("requestfailed", (req) => {
    log(`REQ-FAILED ${req.failure()?.errorText} ${req.url().slice(0, 200)}`);
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/(api|auth|__rpgzzu|v1)\b/.test(url)) return;
    let body = "";
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      body = "<unreadable>";
    }
    net.push({ method: res.request().method(), url: url.slice(0, 180), status: res.status(), body });
    log(`HTTP ${res.status()} ${res.request().method()} ${url.slice(0, 160)}`);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("rpg-zzu:coachmarks-basic-v1", "1");
    localStorage.removeItem("rpg-zzu:ai-panel-collapsed");
    for (const key of ["rpg-zzu:editor-layout", "rpg-zzu:editor-layout:v2", "rpg-zzu:editor-layout:v3", "rpg-zzu:editor-layout:v4"]) {
      localStorage.removeItem(key);
    }
  });
  await page.goto("/?freshProject=1");
  await dismissChrome(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-input")).toBeVisible({ timeout: 20_000 });

  const before = await page.evaluate(() => {
    const store = (window as unknown as { __rpgzzuStore?: { getCurrent?: () => { quests?: unknown[]; maps?: Record<string, { events?: unknown[] }> } } }).__rpgzzuStore;
    const project = store?.getCurrent?.();
    const eventCount = project ? Object.values(project.maps ?? {}).reduce((n, map) => n + (map.events?.length ?? 0), 0) : -1;
    return {
      quests: project?.quests ?? null,
      eventCount,
      providerId: JSON.parse(localStorage.getItem("rpg-zzu:ai-config") ?? "{}").providerId ?? null,
      config: localStorage.getItem("rpg-zzu:ai-config"),
    };
  });
  log(`BEFORE quests=${JSON.stringify(before.quests)} events=${before.eventCount} provider=${before.providerId}`);
  log(`BEFORE config=${(before.config ?? "<none>").slice(0, 300)}`);
  await page.screenshot({ path: path.join(OUT, "01-before.png") });

  await page.getByTestId("ai-input").fill("퀘스트 만들어줘. 촌장이 잃어버린 반지를 우물에서 찾아오면 100골드.");
  await page.screenshot({ path: path.join(OUT, "02-typed.png") });
  await page.getByTestId("ai-send").click();
  log("SEND clicked");
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: path.join(OUT, "03-after-send-2s.png") });

  await page.waitForTimeout(45_000);
  await page.screenshot({ path: path.join(OUT, "04-after-45s.png") });

  const after = await page.evaluate(() => {
    const store = (window as unknown as { __rpgzzuStore?: { getCurrent?: () => { quests?: unknown[]; maps?: Record<string, { events?: unknown[] }> } } }).__rpgzzuStore;
    const project = store?.getCurrent?.();
    const eventCount = project ? Object.values(project.maps ?? {}).reduce((n, map) => n + (map.events?.length ?? 0), 0) : -1;
    const logText = [...document.querySelectorAll("[data-testid=ai-command-row], [data-testid=ai-command-row-assistant], [data-testid=ai-command-row-user], .ai-chat-log, .ai-work-strip")]
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 40);
    return {
      quests: project?.quests ?? null,
      eventCount,
      providerId: JSON.parse(localStorage.getItem("rpg-zzu:ai-config") ?? "{}").providerId ?? null,
      sendDisabled: (document.querySelector("[data-testid=ai-send]") as HTMLButtonElement | null)?.disabled ?? null,
      inputValue: (document.querySelector("[data-testid=ai-input]") as HTMLTextAreaElement | null)?.value ?? null,
      panelText: (document.querySelector("[data-testid=ai-panel]")?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1200),
      logText,
    };
  });
  log(`AFTER quests=${JSON.stringify(after.quests)} events=${after.eventCount} provider=${after.providerId}`);
  log(`AFTER sendDisabled=${after.sendDisabled} input=${JSON.stringify(after.inputValue)}`);
  log(`AFTER panel=${after.panelText}`);
  for (const row of after.logText) log(`LOG ${row.slice(0, 240)}`);

  writeFileSync(path.join(OUT, "network.json"), JSON.stringify(net, null, 2));
  writeFileSync(path.join(OUT, "_probe-log.txt"), lines.join("\n") + "\n");
  await page.screenshot({ path: path.join(OUT, "05-final.png") });
});
