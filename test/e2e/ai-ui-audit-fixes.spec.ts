import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isWikiExtraction } from "../wikiTransportFixture";

const evidence = path.resolve("output/evidence/ai-ui-fixes", process.env.AI_UI_PHASE ?? "green");
mkdirSync(evidence, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    if (!sessionStorage.getItem("ai-ui-fix-initialized")) {
      sessionStorage.setItem("ai-ui-fix-initialized", "1");
      localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat" }));
    }
  });
  if (process.env.E2E_STATIC_RELAY === "1") {
    const origin = new URL(String(test.info().project.use.baseURL)).origin;
    await page.route(`${origin}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET"
        || !(url.pathname === "/" || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(url.pathname))) {
        return route.fallback();
      }
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries([...response.headers].filter(
          ([key]) => !["content-length", "content-encoding", "transfer-encoding"].includes(key),
        )),
        body: Buffer.from(await response.arrayBuffer()),
      });
    });
  }
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await ready(page);
}

async function ready(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  await page.locator("[data-testid='login-guest']:visible, [data-testid='ai-input']:visible, [data-testid='ai-collapsed-restore']:visible")
    .first().waitFor({ state: "visible", timeout: 60_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
}

async function history(page: Page): Promise<void> {
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByRole("menuitem", { name: "전체 기록", exact: true }).click();
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await page.locator(`[data-custom-select-for="${id}"]`).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function geometry(node: Locator) {
  return node.evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  });
}

async function resizeTo(page: Page, width: number, trigger: () => Promise<void>): Promise<void> {
  const signal = await page.evaluateHandle((expected) => {
    const deck = document.querySelector('[data-testid="ai-deck"]');
    const handle = document.querySelector('[data-testid="ai-resize-handle"]');
    if (!deck || !handle) throw new Error("Missing resize surface");
    let stop = () => {};
    const done = new Promise<boolean>((resolve) => {
      const finish = (matched: boolean) => {
        clearTimeout(deadline);
        sizeObserver.disconnect();
        ariaObserver.disconnect();
        resolve(matched);
      };
      const check = () => {
        if (deck.getBoundingClientRect().width === expected
          && handle.getAttribute("aria-valuenow") === String(expected)) finish(true);
      };
      const sizeObserver = new ResizeObserver(check);
      const ariaObserver = new MutationObserver(check);
      const deadline = setTimeout(() => finish(false), 5000);
      stop = () => finish(false);
      sizeObserver.observe(deck);
      ariaObserver.observe(handle, { attributes: true, attributeFilter: ["aria-valuenow"] });
      check();
    });
    return { done, stop: () => stop() };
  }, width);
  try {
    await trigger();
    expect(await signal.evaluate((state) => state.done), `resize to ${width}px`).toBe(true);
  } finally {
    await signal.evaluate((state) => state.stop());
    await signal.dispose();
  }
}

async function capture(page: Page, suffix = ""): Promise<void> {
  const name = `${page.viewportSize()?.width}-${test.info().title.replace(/[^a-zA-Z0-9_-]+/g, "-")}${suffix}`;
  await page.screenshot({ path: path.join(evidence, `${name}.png`) });
  const state = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[data-testid='ai-panel']");
    return {
      panelClass: panel?.className, panelStyle: panel?.getAttribute("style"),
      focus: document.activeElement?.getAttribute("data-testid"),
      viewport: [innerWidth, innerHeight],
    };
  });
  writeFileSync(path.join(evidence, `${name}.json`), JSON.stringify({
    ...state,
    errors: test.info().errors.map((error) => error.message),
  }, null, 2));
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test.describe(`${viewport.width}`, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => {
      test.setTimeout(120_000);
      await boot(page);
    });
    test.afterEach(async ({ page }) => {
      if (!page.isClosed()) await capture(page);
    });

    test("F1 history popovers remain visible and clickable", async ({ page }) => {
      await history(page);
      for (const [toggle, popover] of [
        ["ai-command-menu-toggle", "ai-command-menu"],
        ["ai-preference-toggle", "ai-preference-popover"],
        ["ai-context-meter", "ai-context-panel"],
      ] as const) {
        await page.getByTestId(toggle).click();
        const box = await geometry(page.getByTestId(popover));
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(viewport.height);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width);
        const reachable = await page.getByTestId(popover).evaluate((node) => {
          const target = node.querySelector("button, input");
          if (!(target instanceof HTMLElement)) return false;
          const r = target.getBoundingClientRect();
          return target.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
        expect(reachable).toBe(true);
        await page.keyboard.press("Escape");
        await expect(page.getByTestId(popover)).toBeHidden();
      }
    });

    test("F2 history collapse leaves only restore", async ({ page }) => {
      await history(page);
      await page.getByTestId("ai-collapse").click();
      await expect(page.getByTestId("ai-deck")).toBeHidden();
      await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible();
      await page.getByTestId("ai-collapsed-restore").click();
      await expect(page.getByTestId("ai-input")).toBeVisible();
    });

    test("F3 history to studio removes old deck and permits exit", async ({ page }) => {
      await history(page);
      await page.getByTestId("topbar-ai-studio").click();
      await expect(page.getByTestId("ai-deck")).toBeHidden();
      await page.getByTestId("ai-studio-exit").click();
      await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-studio|is-history-open/);
      await expect(page.getByTestId("ai-input")).toBeVisible();
    });

    test("F4 history has a visible close action", async ({ page }) => {
      await history(page);
      await page.getByTestId("ai-command-menu-toggle").click();
      await page.getByRole("menuitem", { name: /전체 기록/ }).click();
      await expect(page.getByTestId("ai-panel")).not.toHaveClass(/is-history-open/);
    });

    test("F5 studio collapsed columns reclaim monitor width", async ({ page }) => {
      await page.getByTestId("topbar-ai-studio").click();
      const shell = page.locator(".ai-studio-shell");
      const before = await geometry(page.getByTestId("ai-studio-monitor"));
      const columnsBefore = await shell.evaluate((n) => getComputedStyle(n).gridTemplateColumns);
      await page.getByTestId("ai-studio-scenes-collapse").click();
      await page.getByTestId("ai-studio-chat-collapse").click();
      const columns = await shell.evaluate((n) => getComputedStyle(n).gridTemplateColumns.split(" "));
      expect(columns[0]).toBe("52px");
      expect(columns.at(-1)).toBe("52px");
      expect((await geometry(page.getByTestId("ai-studio-monitor"))).width).toBeGreaterThan(before.width);
      await page.getByTestId("ai-studio-scenes-collapse").click();
      await page.getByTestId("ai-studio-chat-collapse").click();
      expect(await shell.evaluate((n) => getComputedStyle(n).gridTemplateColumns)).toBe(columnsBefore);
    });

    test("F6 topbar settings immediately synchronize panel", async ({ page }) => {
      await page.getByTestId("topbar-ai-settings").click();
      // 페인별로 나뉘었으므로 탭을 오가며 고른다 — 수동 저장 버튼은 없고 change 가 자동 저장을 태운다.
      await page.getByTestId("ai-settings-tab-behavior").click();
      await choose(page, "ai-config-autonomy", "최대");
      await page.getByTestId("ai-settings-tab-display").click();
      await choose(page, "ai-font-size", "크게");
      await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-ai-font-size", "large");
      await expect(page.getByTestId("ai-composer-autonomy")).toHaveValue("max");
      await page.getByTestId("ai-background-opacity").focus();
      await page.keyboard.press("End");
      expect(await page.getByTestId("ai-panel").evaluate((n) => n.style.getPropertyValue("--ai-background-opacity"))).toBe("100%");
      await page.getByTestId("ai-settings-close").click();
      await expect(page.getByTestId("topbar-ai-settings")).toBeFocused();
    });

    for (const kind of ["settings", "history"]) {
      test(`F7 ${kind} contains focus and restores opener`, async ({ page }) => {
        const opener = page.getByTestId(kind === "settings" ? "topbar-ai-settings" : "ai-open-conversations");
        await opener.click();
        await page.getByTestId(`ai-${kind}-close`).focus();
        await page.keyboard.press("Shift+Tab");
        const inside = await page.getByTestId(`ai-${kind}-modal`).evaluate((n) => n.contains(document.activeElement));
        expect(inside).toBe(true);
        await page.keyboard.press("Tab");
        await expect(page.getByTestId(`ai-${kind}-close`)).toBeFocused();
        if (kind === "settings") {
          // 글자 크기는 「표시」페인에 있다 — 페인을 먼저 연다.
          await page.getByTestId("ai-settings-tab-display").click();
          await page.locator("[data-custom-select-for='ai-font-size']").click();
          await expect(page.getByRole("listbox")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("listbox")).toBeHidden();
          await expect(page.getByTestId("ai-settings-modal")).toBeVisible();
        }
        await page.keyboard.press("Escape");
        await expect(page.getByTestId(`ai-${kind}-modal`)).toBeHidden();
        await expect(opener).toBeFocused();
      });
    }

    test("F8 both settings entries expose temperature choices", async ({ page }) => {
      for (const entry of ["topbar", "panel"]) {
        if (entry === "topbar") await page.getByTestId("topbar-ai-settings").click();
        else {
          await page.getByTestId("ai-command-menu-toggle").click();
          await page.getByTestId("ai-command-menu-settings").click();
        }
        // 대기 화면 선택은 「대기 화면」추가 페인에 있다.
        await page.getByTestId("ai-settings-tab-extra-temperature").click();
        for (const value of ["map-first", "ink-only", "quiet-gold"]) {
          await page.getByTestId(`ai-command-temperature-${value}`).click();
          await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-temperature", value);
        }
        await page.getByTestId("ai-settings-close").click();
      }
    });

    test("F9 empty export gives visible feedback", async ({ page }) => {
      await page.getByTestId("ai-command-menu-toggle").click();
      await page.getByTestId("ai-command-menu-export").click();
      await expect(page.locator(".toast")).toBeVisible();
    });

    test("F1 F9 long conversation keeps menu reachable and export functional", async ({ page }) => {
      const sentinel = "UI-FIX-TRANSCRIPT-END";
      await page.route("**/v1/chat/completions", async (route) => {
        const request = route.request().postDataJSON();
        const content = isWikiExtraction(request.messages)
          ? JSON.stringify({ upserts: [] })
          : request.tools?.length
          ? `${Array.from({ length: 24 }, (_, i) => `Paragraph ${i}: read-only UI fixture.`).join("\n\n")}\n\n${sentinel}`
          : JSON.stringify({ mode: "question", space: "none", needsPlan: false, tools: [], action: "direct", reason: "read-only" });
        if (request.stream) {
          await route.fulfill({ contentType: "text/event-stream", body:
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\n`
            + `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
          });
        } else {
          await route.fulfill({ json: { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] } });
        }
      });
      await page.getByTestId("ai-composer-autonomy").selectOption("readonly");
      await page.getByTestId("ai-input").fill("UI_FIX_TRANSCRIPT");
      const [completed] = await Promise.all([
        page.waitForRequest((request) => request.url().endsWith("/__oprn/ai-activity")
          && request.method() === "POST" && request.postDataJSON()?.instruction === "UI_FIX_TRANSCRIPT"
          && request.postDataJSON()?.result?.stoppedReason !== undefined, { timeout: 60_000 }),
        page.getByTestId("ai-send").click(),
      ]);
      expect(completed.postDataJSON().result.stoppedReason).toBe("final");
      await expect(page.getByTestId("ai-chat-log")).toContainText(sentinel);
      await page.getByTestId("ai-command-menu-toggle").click();
      const box = await geometry(page.getByTestId("ai-command-menu"));
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(viewport.height);
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByTestId("ai-command-menu-export").click(),
      ]);
      expect(download.suggestedFilename()).toBe("ai-session-audit.json");
      expect(await download.failure()).toBeNull();
      await download.delete();
      await page.getByTestId("ai-new-chat").click();
      await page.getByTestId("ai-open-conversations").click();
      await page.getByTestId("ai-history-open").first().click();
      await expect(page.getByTestId("ai-chat-log")).toContainText(sentinel);
    });

    test("F10 idle resize updates geometry ARIA and persistence", async ({ page }) => {
      const deck = page.getByTestId("ai-deck");
      const handle = page.getByTestId("ai-resize-handle");
      const before = await geometry(deck);
      await handle.focus();
      await resizeTo(page, before.width + 8, () => page.keyboard.press("ArrowLeft"));
      expect((await geometry(deck)).width).toBe(before.width + 8);
      await expect(handle).toHaveAttribute("aria-valuenow", String(before.width + 8));
      const box = await geometry(handle);
      await resizeTo(page, before.width + 88, async () => {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();
      });
      const resized = await geometry(deck);
      expect(resized.width).toBe(before.width + 88);
      await page.getByTestId("ai-input").focus();
      await expect(handle).toHaveAttribute("aria-valuenow", String(resized.width));
      await page.reload({ waitUntil: "domcontentloaded" });
      await ready(page);
      await resizeTo(page, resized.width, async () => {});
      expect((await geometry(deck)).width).toBe(resized.width);
    });
  });
}
