/**
 * 톱바(메뉴바·워크스페이스 바·트레일링)와 좌측 사이드바가 같은 명령을 몇 개나 중복으로
 * 내놓는지 실측하는 증거 캡처. 3개 UI 모드 x (전체 화면 · 좌패널 · 각 메뉴 팝업).
 *
 * 사용:
 *   OPRN_URL=http://127.0.0.1:9861 CHROME_DEDUPE_LABEL=before \
 *     npx tsx scripts/capture-chrome-dedupe-evidence.mts
 *
 * 출력: output/evidence/chrome-dedupe/<label>/*.png + surface.json
 *   surface.json 은 각 표면이 내놓는 **라벨 목록**이라 before/after 를 기계로 비교할 수 있다.
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env["OPRN_URL"] ?? "http://127.0.0.1:9861";
const LABEL = process.env["CHROME_DEDUPE_LABEL"] ?? "before";
const OUT = join(process.cwd(), "output", "evidence", "chrome-dedupe", LABEL);
type Mode = "beginner" | "standard" | "expert";
const MODES: readonly Mode[] = ["beginner", "standard", "expert"];

type SurfaceDump = {
  readonly mode: Mode;
  readonly menuBar: readonly string[];
  readonly menus: Record<string, readonly string[]>;
  readonly authoringTasks: readonly string[];
  readonly panelsMenu: readonly string[];
  readonly trailing: readonly string[];
  readonly classicToolbar: readonly string[];
  readonly leftRailTools: readonly string[];
  readonly leftRailLayers: readonly string[];
  readonly leftRailPanels: readonly string[];
  readonly leftPanelHeadings: readonly string[];
};

const dumps: SurfaceDump[] = [];

async function boot(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript((m) => {
    localStorage.setItem("oprn:editor-ui-mode", m as string);
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  }, mode);
  await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  for (const testid of ["editor-welcome-close", "editor-welcome-dismiss", "coachmark-done", "welcome-start-blank"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".left-panel").waitFor({ state: "visible", timeout: 30_000 });
}

async function texts(page: Page, selector: string): Promise<readonly string[]> {
  return page.$$eval(selector, (nodes) =>
    nodes
      .map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim())
      .filter((text) => text.length > 0),
  );
}

async function shot(page: Page, name: string, selector?: string): Promise<void> {
  const path = join(OUT, `${name}.png`);
  if (selector) {
    const target = page.locator(selector).first();
    if (!(await target.isVisible().catch(() => false))) return;
    await target.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage: false });
  }
  console.log("shot", name);
}

/** 메뉴 팝업을 열고 항목 라벨을 걷은 뒤 스크린샷. 팝업은 body 직속이라 창 전체를 찍는다. */
async function openMenu(page: Page, testid: string, name: string, mode: Mode): Promise<readonly string[]> {
  const trigger = page.getByTestId(testid).first();
  await trigger.waitFor({ state: "visible", timeout: 5_000 });
  await trigger.click();
  const popup = page.locator(".oprn-menu-popup.open, .oprn-menu-popup:not([hidden])").first();
  // 기대 메뉴가 없으면 "중복 없음"을 뜻하는 빈 배열로 기록하지 말고 증거 생성을 실패시킨다.
  await popup.waitFor({ state: "visible", timeout: 5_000 });
  const items = await texts(page, ".oprn-menu-popup:not([hidden]) .oprn-menu-command, .oprn-menu-popup:not([hidden]) .workspace-panel-toggle");
  await shot(page, `${mode}-menu-${name}`);
  await page.keyboard.press("Escape").catch(() => {});
  await page.mouse.click(5, 400).catch(() => {});
  return items;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const mode of MODES) {
      // boot()의 addInitScript는 context 수명 동안 누적된다. 모드마다 새 context를 써서 이전
      // 모드 초기화가 다음 탐색에 다시 실행되지 않게 한다.
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on("pageerror", (error) => console.log("pageerror", error.message));
      try {
        await boot(page, mode);
        await shot(page, `${mode}-full`);
        await shot(page, `${mode}-topbar`, "[data-testid='oprn-menu-bar']");
        await shot(page, `${mode}-classic-toolbar`, "[data-testid='oprn-toolbar']");
        await shot(page, `${mode}-left-panel`, ".left-panel");
        const menus: Record<string, readonly string[]> = {};
        for (const [testid, name] of [
          ["menu-project", "project"],
          ["menu-tools", "tools"],
          ["menu-game", "game"],
          ["menu-help", "help"],
        ] as const) {
          menus[name] = await openMenu(page, testid, name, mode);
        }
        const panelsMenu = await openMenu(page, "workspace-panels-button", "panels", mode);
        dumps.push({
          mode,
          menuBar: await texts(page, ".oprn-menu-bar .oprn-menu-item"),
          menus,
          authoringTasks: await texts(page, "[data-testid='authoring-task-launcher'] button"),
          panelsMenu,
          trailing: await page.$$eval("[data-testid='editor-topbar-trailing'] button", (nodes) =>
            nodes.map((node) => (node.getAttribute("aria-label") ?? node.textContent ?? "").replace(/\s+/gu, " ").trim()).filter((t) => t.length > 0),
          ),
          classicToolbar: await texts(page, "[data-testid='oprn-toolbar'] button"),
          leftRailTools: await texts(page, "[data-testid='basic-tool-list'] button"),
          leftRailLayers: await texts(page, "[data-testid='basic-layer-list'] button"),
          leftRailPanels: await texts(page, "[data-testid='basic-panel-toggles'] button"),
          leftPanelHeadings: await texts(page, ".left-panel .panel-title, .left-panel .palette-header, .left-panel h2, .left-panel h3"),
        });
        if (mode === "standard") {
          await page.setViewportSize({ width: 1180, height: 800 });
          const activeChip = page.locator(".authoring-task-btn.is-active");
          await activeChip.waitFor({ state: "visible", timeout: 5_000 });
          const activeStyle = await activeChip.evaluate((node) => {
            const style = getComputedStyle(node);
            return { boxShadow: style.boxShadow, textDecorationLine: style.textDecorationLine };
          });
          if (activeStyle.boxShadow === "none" || activeStyle.textDecorationLine !== "none") {
            throw new Error(`1180px 저작 작업 활성 상태가 칩 어휘와 다름: ${JSON.stringify(activeStyle)}`);
          }
          await shot(page, "standard-authoring-tasks-1180", "[data-testid='authoring-task-launcher']");
        }
      } finally {
        await context.close();
      }
    }
    writeFileSync(join(OUT, "surface.json"), `${JSON.stringify(dumps, null, 2)}\n`, "utf8");
    console.log("wrote", join(OUT, "surface.json"));
  } finally {
    await browser.close();
  }
}

await main();
