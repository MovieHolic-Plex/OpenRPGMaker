import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { Agent, get } from "node:http";
import path from "node:path";

const evidence = path.resolve("output/evidence/assistant-sticky");
const instruction = "기존 월드맵을 정확히 가로 22칸, 세로 17칸으로 변경해줘.";

function signal() {
  let resolve: () => void = () => { throw new Error("Signal not initialized"); };
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Missing sticky-checklist event")), 60_000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function boot(page: Page) {
  // A bounded static-only relay avoids stale pooled sockets on this shared host.
  // It changes no application response, retries nothing, and owns its connection pool.
  const agent = new Agent({ keepAlive: false, maxSockets: 12 });
  page.once("close", () => agent.destroy());
  await page.route("http://127.0.0.1:*/**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || !(url.pathname === "/" || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(url.pathname))) return route.fallback();
    const response = await new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>((resolve, reject) => {
      const request = get(url, { agent }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.once("error", reject);
        incoming.once("end", () => resolve({
          status: incoming.statusCode ?? 502,
          headers: Object.fromEntries(Object.entries(incoming.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
          body: Buffer.concat(chunks),
        }));
      });
      request.once("error", reject);
      request.setTimeout(60_000, () => request.destroy(new Error(`Static GET deadline: ${url.pathname}`)));
    });
    await route.fulfill(response);
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/auth/status?*", (route) => route.fulfill({
    json: { connected: true, authKind: "oauth", expired: false, env: false },
  }));
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({
      configVersion: 2, agentMode: "auto", autonomyLevel: "balanced",
    }));
  });
  const ready = page.getByTestId("login-guest").or(page.getByTestId("ai-input")).first()
    .waitFor({ state: "visible", timeout: 90_000 });
  await page.goto("/?blankProject=1&aiBridge=0", { waitUntil: "domcontentloaded" });
  await ready;
  if (await page.getByTestId("login-guest").isVisible()) await page.getByTestId("login-guest").click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  return page.evaluate(async () => {
    const modulePath = "/src/project/store.ts";
    const { store } = await import(modulePath);
    return String(store.getCurrent().startMapId);
  });
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`) });
  return page.getByTestId("ai-sticky-checklist").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      text: node.textContent,
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      position: style.position,
      overflow: node.scrollWidth > node.clientWidth,
      rows: Array.from(node.querySelectorAll<HTMLElement>("[data-testid=ai-sticky-item]"))
        .map((row) => ({ id: row.dataset.itemId, status: row.dataset.status, text: row.textContent })),
    };
  });
}

test("real panel rejects early completion, verifies applied dimensions and keeps the left note", async ({ page }) => {
  // Full editor boot plus twelve captures can exceed three minutes while other
  // worktrees run their gates. Individual event/HTTP deadlines stay bounded.
  test.setTimeout(300_000);
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const mapId = await boot(page);
  const firstHeld = signal();
  const releaseFirst = signal();
  const wrongHeld = signal();
  const releaseWrong = signal();
  const requests: { round: number; tools: string[] }[] = [];
  let round = 0;
  const plan = {
    action: "new_plan", goal: "월드맵 크기를 정확히 맞추기",
    acceptance: [{
      id: "size", title: "월드맵을 가로 22칸, 세로 17칸으로 변경",
      criteria: [{ kind: "mapDimensions", target: { mapId }, width: 22, height: 17 }],
    }],
    layers: [{ title: "지도 편집", items: [{
      id: "resize", title: "월드맵 크기 변경", instruction: "resize_map으로 정확한 크기를 적용한다",
      successTools: ["resize_map"],
    }] }],
  };
  await page.route("**/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON();
    const tools: string[] = (request.tools ?? []).map((tool: { function: { name: string } }) => tool.function.name);
    let message: object;
    if (tools.length === 0) {
      message = { role: "assistant", content: JSON.stringify({
        mode: "modify", space: "outdoor", targetMapId: mapId, useSelection: false,
        needsPlan: true, tools: ["resize_map"], summary: instruction, ...plan,
      }) };
    } else {
      const current = round++;
      requests.push({ round: current, tools });
      if (current === 1) {
        firstHeld.resolve();
        await releaseFirst.promise;
      }
      if (current === 3) {
        wrongHeld.resolve();
        await releaseWrong.promise;
      }
      message = current === 1 || current === 3
        ? { role: "assistant", content: "지도의 크기를 적용합니다.", tool_calls: [{
          id: `resize_${current}`, type: "function", function: {
            name: "resize_map",
            arguments: JSON.stringify({
              mapId, width: current === 1 ? 21 : 22, height: 17,
              reason: "요청한 월드맵 크기를 실제 맵 데이터에 적용합니다.",
            }),
          },
        }] }
        : { role: "assistant", content: "월드맵 크기 변경을 완료했습니다." };
    }
    await route.fulfill({ json: { choices: [{ message, finish_reason: "stop" }] } });
  });

  const terminal = page.waitForRequest((request) => {
    if (!request.url().includes("/ai-activity") || request.method() !== "POST") return false;
    const record = request.postDataJSON();
    return record.instruction === instruction && record.result?.pending !== true
      && record.result?.stoppedReason !== undefined;
  }, { timeout: 120_000 }).then(
    (request) => ({ kind: "completed" as const, record: request.postDataJSON() }),
    (error: unknown) => ({ kind: "closed" as const, error }),
  );
  await page.getByTestId("ai-input").fill(instruction);
  await page.getByTestId("ai-send").click();
  const artifacts: Record<string, unknown> = {};
  try {
    await bounded(firstHeld.promise);
    const note = page.getByTestId("ai-sticky-checklist");
    await expect(note).toBeVisible();
    expect(await note.locator("[data-status=verified]").count()).toBe(0);
    artifacts.active = await capture(page, "sticky-active");
    releaseFirst.resolve();

    await bounded(wrongHeld.promise);
    expect(await note.locator("[data-status=verified]").count()).toBe(0);
    artifacts.insufficient = await capture(page, "sticky-insufficient");
    releaseWrong.resolve();
    const terminalResult = await terminal;
    if (terminalResult.kind === "closed") throw terminalResult.error;
    const settled = terminalResult.record;
    await expect(page.getByTestId("ai-sticky-item").first()).toHaveAttribute("data-status", "verified");
    artifacts.complete = await capture(page, "sticky-complete");
    artifacts.terminal = settled.result;
    artifacts.map = await page.evaluate(async (id) => {
      const modulePath = "/src/project/store.ts";
      const { store } = await import(modulePath);
      const map = store.getCurrent().maps[id];
      return { width: map.width, height: map.height };
    }, mapId);
    expect(artifacts.map).toEqual({ width: 22, height: 17 });

    const toggle = page.getByTestId("ai-sticky-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    artifacts.collapsed = await capture(page, "sticky-collapsed");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.getByTestId("ai-sticky-item").first().locator("summary").click();
    await expect(page.getByTestId("ai-sticky-evidence").first()).toBeVisible();
    await page.getByTestId("ai-sticky-navigate").first().click();

    for (const size of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      artifacts[`layout-${size.width}`] = await capture(page, `sticky-${size.width}`);
      const box = await note.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error("Sticky note has no layout box");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      expect(await note.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      const obscuredTools = await page.evaluate(() => {
        const note = document.querySelector("[data-testid=ai-sticky-checklist]");
        return Array.from(document.querySelectorAll<HTMLElement>("[data-testid^=oprn-tool-]"))
          .filter((control) => {
            const rect = control.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return hit !== null && note?.contains(hit);
          })
          .map((control) => control.dataset.testid);
      });
      expect(obscuredTools, "sticky note must not cover the editor's existing tools").toEqual([]);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    artifacts.reducedMotion = await capture(page, "sticky-reduced-motion");
    await page.getByTestId("ai-collapse").click();
    await expect(note).toBeVisible();
    artifacts.chatCollapsed = await capture(page, "sticky-chat-collapsed");
    await page.getByTestId("oprn-tool-undo").click();
    await expect(page.getByTestId("ai-sticky-item").first()).not.toHaveAttribute("data-status", "verified");
    artifacts.invalidated = await capture(page, "sticky-invalidated");
    await page.getByTestId("ai-collapsed-restore").click();
    await page.getByTestId("ai-new-chat").click();
    await expect(note).toHaveCount(0);
    artifacts.newChat = { noteCount: await note.count() };
    artifacts.requests = requests;
  } finally {
    releaseFirst.resolve();
    releaseWrong.resolve();
    writeFileSync(path.join(evidence, "browser-actions.json"), JSON.stringify(artifacts, null, 2));
  }
});

test("stopping a real turn retains unverified promises and new chat clears their ownership", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(evidence, { recursive: true });
  const mapId = await boot(page);
  const held = signal();
  const release = signal();
  await page.route("**/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON();
    if (request.tools?.length) {
      held.resolve();
      await release.promise;
      await route.fulfill({ json: { choices: [{ message: {
        role: "assistant", content: "작업을 멈췄습니다.",
      } }] } });
      return;
    }
    await route.fulfill({ json: { choices: [{ message: {
      role: "assistant", content: JSON.stringify({
        mode: "modify", space: "outdoor", needsPlan: true, targetMapId: mapId,
        tools: ["resize_map"], summary: "지도 크기 변경", action: "new_plan",
        goal: "중단된 지도 작업",
        acceptance: [{ id: "size", title: "지도 크기 변경", criteria: [
          { kind: "mapDimensions", target: { mapId }, width: 40, height: 30 },
        ] }],
        layers: [{ title: "지도", items: [{
          title: "지도 크기 변경", instruction: "resize_map으로 지도를 변경한다",
          successTools: ["resize_map"],
        }] }],
      }),
    } }] } });
  });
  await page.getByTestId("ai-input").fill("기존 지도를 가로 40칸, 세로 30칸으로 바꿔줘.");
  await page.getByTestId("ai-send").click();
  try {
    await bounded(held.promise);
    await expect(page.getByTestId("ai-sticky-checklist")).toBeVisible();
    await page.getByTestId("ai-abort").click();
    release.resolve();
    await expect(page.getByTestId("ai-sticky-item").first()).toHaveAttribute("data-status", "blocked");
    const stopped = await capture(page, "sticky-stopped");
    expect(stopped.rows.every((row) => row.status !== "verified")).toBe(true);
    await page.getByTestId("ai-new-chat").click();
    await expect(page.getByTestId("ai-sticky-checklist")).toHaveCount(0);
    writeFileSync(path.join(evidence, "browser-stop.json"), JSON.stringify({ stopped, newChatNoteCount: 0 }, null, 2));
  } finally {
    release.resolve();
  }
});
