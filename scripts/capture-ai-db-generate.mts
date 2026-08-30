import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Page, type Route } from "@playwright/test";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const BASE = process.env.CAPTURE_BASE ?? "http://127.0.0.1:8790";
const OUT = "verify-shots/ai-db-generate";
const GENERATION_TIMEOUT_MS = 240_000;
const IMAGE_DELAY_MS = Number(process.env.CAPTURE_IMAGE_DELAY_MS ?? "0");

const BRIEF: Record<"enemy" | "item", string> = {
  enemy: "얼음 동굴에 사는 서슬 늑대. 빠르고 물리 공격 위주, 초중반 난이도의 야수형 몬스터.",
  item: "전투 중에도 쓸 수 있는 상급 회복약. HP 를 넉넉히 회복하는 소모품.",
};
const RECORD_JSON: Record<"enemy" | "item", string> = {
  enemy: JSON.stringify({
    name: "서슬 늑대",
    stats: { maxHp: 180, maxMp: 20, attack: 28, defense: 16, mind: 10, agility: 24 },
    rewards: { exp: 45, gold: 32, dropRatePercent: 15 },
  }),
  item: JSON.stringify({
    name: "상급 회복약",
    description: "깊은 상처까지 덮는 진한 약. 전투 중에도 쓸 수 있다.",
    price: 220,
    type: "medicine",
    scope: "ally",
    occasion: "always",
    consumable: true,
    hpRecovery: { flat: 220, percentMax: 0 },
  }),
};
const ARTWORK_FILE: Record<"enemy" | "item", string> = {
  enemy: `${OUT}/raw-enemy-frost-wolf.jpg`,
  item: `${OUT}/raw-item-hi-potion.jpg`,
};

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`[shot] ${OUT}/${name}.png`);
}

async function artworkDataUrl(kind: "enemy" | "item"): Promise<string> {
  const bytes = await readFile(ARTWORK_FILE[kind]);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

async function installStubs(page: Page, artwork: Record<"enemy" | "item", string>): Promise<() => "enemy" | "item"> {
  let pending: "enemy" | "item" = "enemy";
  await page.exposeFunction("__captureKind", () => pending);

  await page.route("**/v1/chat/completions", async (route: Route) => {
    const body = route.request().postDataJSON() as { messages?: { content?: unknown }[] };
    const text = JSON.stringify(body.messages ?? []);
    pending = text.includes("아이템") ? "item" : "enemy";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "capture",
        object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content: RECORD_JSON[pending] }, finish_reason: "stop" }],
      }),
    });
  });

  await page.route("**/v1/images/generations", async (route: Route) => {
    if (IMAGE_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, IMAGE_DELAY_MS));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        image: {
          dataUrl: artwork[pending],
          mimeType: "image/jpeg",
          model: "gemini-3.1-flash-image",
          provider: "google-antigravity",
        },
      }),
    });
  });

  await page.route("**/supabase/**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/__oprn/**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  return () => pending;
}

async function bootEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
  await gotoWithRetry(page, `${BASE}/?freshProject=1`, {
    waitUntil: "domcontentloaded",
    attempts: 4,
    onRetry: (error: unknown, attempt: number) => console.log(`[goto retry ${attempt}] ${String(error).slice(0, 120)}`),
  });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 30_000 });
}

async function selectTab(page: Page, testId: string): Promise<void> {
  const button = page.getByTestId(testId);
  if (!(await button.isVisible())) {
    const groups = page.locator('[data-testid^="db-tab-group-"]');
    const total = await groups.count();
    for (let index = 0; index < total; index += 1) {
      await groups.nth(index).click();
      if (await button.isVisible()) break;
    }
  }
  await button.click({ force: true });
}

async function runGeneration(page: Page, kind: "enemy" | "item"): Promise<{ status: string; previewBytes: number }> {
  await selectTab(page, kind === "item" ? "db-tab-items" : "db-tab-enemies");
  await page.getByTestId("db-ai-generate-open").waitFor({ state: "visible", timeout: 20_000 });
  await shoot(page, `${kind}-1-toolbar`);

  await page.getByTestId("db-ai-generate-open").click();
  await page.getByTestId(`db-ai-generate-dialog-${kind}`).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByTestId("db-ai-generate-brief").fill(BRIEF[kind]);
  await shoot(page, `${kind}-2-dialog`);

  await page.getByTestId("db-ai-generate-run").click();
  const status = page.getByTestId("db-ai-generate-status");
  if (IMAGE_DELAY_MS > 0) {
    await page.getByTestId("db-ai-generate-close").filter({ hasText: "취소" }).waitFor({ timeout: 20_000 });
    await shoot(page, `${kind}-2b-inflight-cancel`);
  }
  await status.filter({ hasText: /^(완료|실패)/ }).waitFor({ state: "visible", timeout: GENERATION_TIMEOUT_MS });
  const statusText = (await status.textContent()) ?? "";
  await shoot(page, `${kind}-3-result`);

  const previewBytes = await page.getByTestId("db-ai-generate-preview").evaluate((node) => {
    const image = node as HTMLImageElement;
    return image.hidden ? 0 : image.src.length;
  });

  await page.getByTestId("db-ai-generate-close").click();
  await page.getByTestId(`db-ai-generate-dialog-${kind}`).waitFor({ state: "detached", timeout: 20_000 });
  await shoot(page, `${kind}-4-record`);
  return { status: statusText, previewBytes };
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const artwork = {
    enemy: await artworkDataUrl("enemy"),
    item: await artworkDataUrl("item"),
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 300)));

  const report: Record<string, unknown> = { base: BASE };
  try {
    await installStubs(page, artwork);
    await bootEditor(page);
    await shoot(page, "00-database-open");
    report.enemy = await runGeneration(page, "enemy");
    report.item = await runGeneration(page, "item");
  } catch (error) {
    report.failure = error instanceof Error ? error.message.slice(0, 400) : String(error);
    report.bodyHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 1500)).catch(() => "");
    await shoot(page, "99-boot-failure").catch(() => undefined);
    throw error;
  } finally {
    report.consoleErrors = consoleErrors.slice(0, 10);
    report.pageErrors = pageErrors.slice(0, 10);
    await writeFile(`${OUT}/summary.json`, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
}

await main();
