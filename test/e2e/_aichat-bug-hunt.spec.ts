/**
 * 진단 스펙 — 에디터 AI 채팅(aichat) 실제 결함 사냥.
 *
 * 라이브 LLM 없이 `chat/completions` 를 SSE 로 스텁해 턴 흐름을 결정적으로 재생한다.
 * 목적은 회귀 계약이 아니라 **증거 수집**이므로 각 단계는 soft-fail 이고, 무슨 일이 있어도
 * REPORT.md 를 남긴다.
 *
 * Run:
 *   DEV_SERVER_PORT=9841 E2E_RETRIES=0 npx playwright test test/e2e/_aichat-bug-hunt.spec.ts --project=chromium
 */
import { test, type Page, type ConsoleMessage } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve("verify-shots/aichat-bug-hunt");
mkdirSync(EVIDENCE, { recursive: true });

const AI_CONFIG = {
  authMode: "apiKey",
  providerId: "openai",
  baseUrl: "http://127.0.0.1:59999/v1",
  model: "hunt-model",
  liteModel: "hunt-model",
  apiKey: "sk-hunt",
  maxToolCalls: 8,
  maxTokens: 4096,
  reasoningEffort: "off",
  agentMode: "chat",
  configVersion: 2,
};

function sse(chunks: unknown[]): string {
  return [...chunks.map((c) => `data: ${JSON.stringify(c)}`), "data: [DONE]", ""].join("\n\n");
}

const notes: string[] = [];
function note(line: string): void {
  notes.push(line);
  console.log(`[hunt] ${line}`);
}

async function step(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    note(`STEP FAIL ${name}: ${(error as Error).message.split("\n")[0].slice(0, 200)}`);
  }
}

/** 요소의 실제 도달성: DOM 존재 + 계산된 display/visibility + 화면 rect. */
async function reach(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (!node) return "absent";
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return `display=${style.display} visibility=${style.visibility} rect=${Math.round(rect.width)}x${Math.round(rect.height)}`;
  }, testid);
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((config) => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.removeItem("oprn:ai-panel-collapsed");
    localStorage.setItem("oprn:ai-config", JSON.stringify(config));
  }, AI_CONFIG);

  let turn = 0;
  await page.route("**/chat/completions", async (route) => {
    turn += 1;
    const body = turn === 1
      ? sse([
          { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "create_map", arguments: JSON.stringify({ id: "map_hunt", name: "사냥터", width: 8, height: 6 }) } }] } }] },
        ])
      : sse([{ choices: [{ delta: { content: "맵을 만들었습니다." } }] }]);
    await route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body });
  });

  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 25_000 });
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible({ timeout: 3_000 }).catch(() => false)) await welcome.click();
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), animations: "disabled" }).catch(() => {});
}

const META_IDS = [
  "ai-command-menu-toggle",
  "ai-new-chat",
  "ai-collapse",
  "ai-command-menu-settings",
  "ai-dock-mode-btn",
  "ai-chat-toolbar",
  "ai-more-menu-toggle",
  "ai-context-chips",
  "ai-input",
  "ai-send",
  "ai-status",
] as const;

test("aichat 결함 사냥", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text().slice(0, 240)}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message.slice(0, 240)}`));

  await boot(page);
  await shot(page, "01-boot-glass");

  // 도크별 메타 진입점 도달성 — glass(기본) / side / float.
  for (const dock of ["glass", "side", "float"] as const) {
    await step(`dock=${dock}`, async () => {
      await page.evaluate((target) => {
        const state = (window as unknown as { __oprnEditorState?: { set(patch: unknown): void } }).__oprnEditorState;
        if (state) state.set({ chatDock: target });
        else localStorage.setItem("oprn:chat-dock", target);
      }, dock);
      if (dock !== "glass") {
        // 상태 브리지가 없으면 숨은 호환 훅으로 도크를 돌린다.
        const current = await page.evaluate(() => document.querySelector("[data-testid='ai-panel']")?.className ?? "");
        if (!current.includes(`chat-dock-${dock}`)) {
          for (let i = 0; i < 3; i += 1) {
            await page.getByTestId("chat-dock-toggle").dispatchEvent("click").catch(() => {});
            await page.waitForTimeout(400);
            const cls = await page.evaluate(() => document.querySelector("[data-testid='ai-panel']")?.className ?? "");
            if (cls.includes(`chat-dock-${dock}`)) break;
          }
        }
      }
      await page.waitForTimeout(500);
      const cls = await page.evaluate(() => document.querySelector("[data-testid='ai-panel']")?.className ?? "?");
      note(`[dock ${dock}] panel class = ${cls}`);
      for (const id of META_IDS) note(`[dock ${dock}] ${id}: ${await reach(page, id)}`);
      // ☰ 를 여어 메뉴 항목이 실제로 화면에 나오는지까지 재다(DOM 생존 ≠ 도달 가능).
      const toggle = page.getByTestId("ai-command-menu-toggle");
      if (await toggle.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await toggle.click({ timeout: 3_000 }).catch(() => {});
        await page.waitForTimeout(300);
        note(`[dock ${dock}] ☰ open → ai-settings-toggle: ${await reach(page, "ai-command-menu-settings")}`);
        note(`[dock ${dock}] ☰ open → ai-command-menu-dock: ${await reach(page, "ai-command-menu-dock")}`);
        const labels = await page.locator("[data-testid^='ai-command-menu-'], [data-testid='ai-settings-toggle']").evaluateAll((nodes) =>
          nodes
            .filter((n) => (n as HTMLElement).getBoundingClientRect().height > 0)
            .map((n) => (n as HTMLElement).textContent?.trim().slice(0, 16))
        );
        note(`[dock ${dock}] ☰ 보이는 항목 = ${labels.join(" | ")}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      } else {
        note(`[dock ${dock}] ☰ 보이지 않음 — 메타 메뉴 도달 불가`);
      }
      await shot(page, `02-dock-${dock}`);
    });
  }

  // 기본 도크(glass)로 되돌리고 턴을 굴린다.
  await step("back to glass", async () => {
    await page.evaluate(() => {
      const state = (window as unknown as { __oprnEditorState?: { set(patch: unknown): void } }).__oprnEditorState;
      state?.set({ chatDock: "glass" });
    });
    await page.waitForTimeout(400);
  });

  await step("send turn", async () => {
    await page.getByTestId("ai-input").fill("8x6 맵 하나 만들어줘", { timeout: 5_000 });
    await page.getByTestId("ai-send").click({ timeout: 5_000 });
    await page.waitForTimeout(8_000);
    await shot(page, "03-after-turn");
    const logText = (await page.getByTestId("ai-chat-log").textContent().catch(() => "")) ?? "";
    note(`chat log after turn (${logText.length}자): ${logText.replace(/\s+/g, " ").slice(0, 700)}`);
    note(`status = ${await page.getByTestId("ai-status").textContent().catch(() => "?")}`);
    const maps = await page.evaluate(() => {
      const bridge = (window as unknown as { __oprnStore?: { getCurrent(): { maps: Record<string, { name: string }> } } }).__oprnStore;
      return bridge ? Object.values(bridge.getCurrent().maps).map((m) => m.name) : ["<no store bridge>"];
    });
    note(`maps after turn = ${JSON.stringify(maps).slice(0, 300)}`);
  });

  // 접기/펼치기 왕복.
  await step("collapse round trip", async () => {
    await page.getByTestId("ai-collapse").click({ timeout: 4_000 });
    await page.waitForTimeout(700);
    note(`collapsed class = ${await page.evaluate(() => document.querySelector("[data-testid='ai-panel']")?.className ?? "?")}`);
    await shot(page, "04-collapsed");
    const restore = page.getByTestId("ai-collapsed-restore");
    note(`ai-collapsed-restore: ${await reach(page, "ai-collapsed-restore")}`);
    await restore.click({ timeout: 4_000 }).catch(async () => {
      await page.getByTestId("ai-collapse").click({ timeout: 4_000 });
    });
    await page.waitForTimeout(700);
    note(`expanded class = ${await page.evaluate(() => document.querySelector("[data-testid='ai-panel']")?.className ?? "?")}`);
    await shot(page, "05-expanded");
  });

  // 새 대화 → 재부팅 복원.
  await step("reload restore", async () => {
    await page.reload();
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 4_000 }).catch(() => false)) await guest.click();
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 25_000 });
    await page.waitForTimeout(2_000);
    const restored = (await page.getByTestId("ai-chat-log").textContent().catch(() => "")) ?? "";
    note(`after reload chat log (${restored.length}자): ${restored.replace(/\s+/g, " ").slice(0, 400)}`);
    await shot(page, "06-after-reload");
  });

  note(`--- console errors (${errors.length}, unique ${new Set(errors).size}) ---`);
  for (const e of [...new Set(errors)].slice(0, 40)) note(e);
  writeFileSync(path.join(EVIDENCE, "REPORT.md"), notes.join("\n"), "utf8");
});
