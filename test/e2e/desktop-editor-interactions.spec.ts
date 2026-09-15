import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { createBlankProject } from "@/project/defaults";

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;
const MODES = ["basic", "expert"] as const;
// 맵 메뉴(2026-08-26)·게임 메뉴(2026-09-03)는 사라졌다. 도구 메뉴는 표준·초보에만 있고 전문가는
// 인라인 버튼이라 모드별 필수 목록이 다르다.
const REQUIRED_FOCUS_TARGETS = [
  "menu-project",
  "menu-help",
  "layer-event",
] as const;

type EditorMode = (typeof MODES)[number];
type Viewport = (typeof VIEWPORTS)[number];
type Rect = { readonly bottom: number; readonly height: number; readonly left: number; readonly right: number; readonly top: number; readonly width: number };
type DesktopInteractionMetric = {
  readonly focusTrace: Readonly<Record<string, Rect>>;
  readonly mode: EditorMode;
  readonly pointerBoxes: readonly { readonly height: number; readonly testId: string | null; readonly width: number }[];
  readonly toolsPopup: Rect;
  readonly viewport: Viewport;
};
const EVIDENCE_DIR = process.env.DESKTOP_INTERACTION_EVIDENCE_DIR ?? "";

function desktopEventProject() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("desktop interaction project has no start map");
  map.events = Array.from({ length: 18 }, (_, index) => {
    const event = createDefaultGameEvent(index % 18, Math.floor(index / 18));
    event.id = `desktop-interaction-event-${index + 1}`;
    return event;
  });
  return project;
}

function expectContained(rect: { readonly bottom: number; readonly left: number; readonly right: number; readonly top: number }, viewport: Viewport, label: string): void {
  expect.soft(rect.left, `${label}: left`).toBeGreaterThanOrEqual(0);
  expect.soft(rect.top, `${label}: top`).toBeGreaterThanOrEqual(0);
  expect.soft(rect.right, `${label}: right`).toBeLessThanOrEqual(viewport.width);
  expect.soft(rect.bottom, `${label}: bottom`).toBeLessThanOrEqual(viewport.height);
}

async function rect(page: Page, target: Locator): Promise<Rect> {
  return target.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { bottom: box.bottom, height: box.height, left: box.left, right: box.right, top: box.top, width: box.width };
  });
}

async function reachByTab(page: Page, target: Locator, viewport: Viewport, label: string): Promise<Rect> {
  for (let press = 0; press < 160; press += 1) {
    // This only observes the browser's active element after a trusted Tab keypress; it never assigns focus.
    if (await target.evaluate((node) => document.activeElement === node)) {
      await expect(target).toBeFocused();
      const targetRect = await rect(page, target);
      expectContained(targetRect, viewport, label);
      return targetRect;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`${label} was not reached by keyboard Tab traversal`);
}

async function assertEventRowsActivate(page: Page, viewport: Viewport): Promise<void> {
  const layerEvent = page.getByTestId("layer-event");
  await reachByTab(page, layerEvent, viewport, "event layer keyboard activation");
  await page.keyboard.press("Enter");
  const rows = page.locator("[data-testid^='event-list-row-desktop-interaction-event-']");
  await expect(rows).toHaveCount(18);
  const first = rows.first();
  const last = rows.last();
  for (const [label, row] of [["first", first], ["last", last]] as const) {
    await row.scrollIntoViewIfNeeded();
    const rowBox = await row.boundingBox();
    expect(rowBox?.width, `${label} event row width`).toBeGreaterThan(0);
    expect(rowBox?.height, `${label} event row height`).toBeGreaterThan(0);
    await row.click();
    await expect(row).toHaveClass(/active/);
    await expect(page.getByTestId("event-editor-launch")).toBeVisible();
  }
}

async function runDesktopScenario(
  browser: Browser,
  mode: EditorMode,
  viewport: Viewport,
  project: ReturnType<typeof desktopEventProject>,
): Promise<{ readonly issues: readonly string[]; readonly metric: DesktopInteractionMetric }> {
  const context = await browser.newContext({ viewport });
  const browserIssues: string[] = [];
  await context.addInitScript(({ editorMode, seededProject }) => {
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", editorMode);
    window.__OPRN_E2E_PROJECT__ = seededProject;
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: function desktopInteractionFixtureAudio(): HTMLAudioElement {
        return document.createElement("audio");
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: (): Promise<void> => Promise.resolve(),
    });
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" || input instanceof URL
        ? new URL(input, window.location.href).href
        : input.url;
      if (url === "http://127.0.0.1:17831/v1/browser/hello" || url.startsWith("http://127.0.0.1:17831/v1/browser/next")) {
        return Promise.resolve(new Response("{}", { headers: { "Content-Type": "application/json" }, status: 200 }));
      }
      if (url === `${window.location.origin}/__oprn/ai-activity`) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.startsWith("http://dbserver:8100/rest/v1/ai_activity_logs") || url.startsWith("http://dbserver:8100/rest/v1/ai_analysis_runs")) {
        return Promise.resolve(new Response("[]", { headers: { "Content-Type": "application/json" }, status: 201 }));
      }
      return realFetch(input, init);
    };
  }, { editorMode: mode, seededProject: project });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") browserIssues.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown";
    const optionalBridgeRefusal = request.url() === "http://127.0.0.1:17831/v1/browser/hello" && reason === "net::ERR_CONNECTION_REFUSED";
    if (!optionalBridgeRefusal) browserIssues.push(`requestfailed: ${request.url()} ${reason}`);
  });

  try {
    await page.goto(`/?desktopInteraction=${mode}-${viewport.width}`);
    await expect(page.getByTestId("edit-canvas")).toBeVisible();
    await expect(page.getByTestId("editor-statusbar")).toHaveCount(0);
    const focusTrace: Record<string, Rect> = {};
    for (const testId of REQUIRED_FOCUS_TARGETS) {
      focusTrace[testId] = await reachByTab(page, page.getByTestId(testId), viewport, `${mode}/${viewport.width} ${testId}`);
    }

    const tools = page.getByTestId("menu-tools");
    await reachByTab(page, tools, viewport, `${mode}/${viewport.width} menu-tools popup trigger`);
    await page.keyboard.press("Enter");
    const popup = page.getByTestId("menu-popup-tools");
    await expect(popup).toBeVisible();
    if (viewport.width === 1024) {
      await popup.getByRole("menuitem").first().evaluate((node) => {
        node.textContent = "긴 한국어 메뉴 항목 ".repeat(32);
      });
    }
    const popupRect = await rect(page, popup);
    expectContained(popupRect, viewport, `${mode}/${viewport.width} tools popup`);
    if (EVIDENCE_DIR) await page.screenshot({ path: join(EVIDENCE_DIR, `${mode}-${viewport.width}x${viewport.height}-tools-open.png`) });
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(tools).toBeFocused();

    if (mode === "expert") await assertEventRowsActivate(page, viewport);
    const pointerBoxes = await page.locator([
      "button[data-testid^='menu-']:visible",
      "button[data-testid^='layer-']:visible",
      "button[data-testid^='event-list-row-']:visible",
    ].join(", ")).evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { height: box.height, testId: button.getAttribute("data-testid"), width: box.width };
    }));
    for (const box of pointerBoxes) {
      expect(Math.min(box.width, box.height), `${mode}/${viewport.width} ${box.testId ?? "button"} pointer box`).toBeGreaterThanOrEqual(32);
    }
    const metric = { focusTrace, mode, pointerBoxes, toolsPopup: popupRect, viewport };
    if (EVIDENCE_DIR) await page.screenshot({ path: join(EVIDENCE_DIR, `${mode}-${viewport.width}x${viewport.height}-settled.png`) });
    return { issues: browserIssues, metric };
  } finally {
    await context.close();
  }
}

const capturedMetrics: DesktopInteractionMetric[] = [];
const capturedBrowserIssues: string[] = [];

test.beforeAll(async () => {
  if (EVIDENCE_DIR) await mkdir(EVIDENCE_DIR, { recursive: true });
});

test.afterAll(async () => {
  if (EVIDENCE_DIR) {
    await writeFile(join(EVIDENCE_DIR, "metrics.json"), `${JSON.stringify(capturedMetrics, null, 2)}\n`, "utf8");
    await writeFile(join(EVIDENCE_DIR, "focus-trace.json"), `${JSON.stringify(capturedMetrics.map(({ focusTrace, mode, viewport }) => ({ focusTrace, mode, viewport })), null, 2)}\n`, "utf8");
    await writeFile(join(EVIDENCE_DIR, "browser-policy.json"), `${JSON.stringify({ allowed: "exact http://127.0.0.1:17831/v1/browser/hello net::ERR_CONNECTION_REFUSED only", optionalDependencyFixtures: optionalFixtureDescriptions(), issues: capturedBrowserIssues }, null, 2)}\n`, "utf8");
  }
});

for (const mode of MODES) {
  for (const viewport of VIEWPORTS) {
    test(`${mode} ${viewport.width}x${viewport.height} keyboard tour stays operable`, async ({ browser }) => {
      test.setTimeout(45_000);
      const result = await runDesktopScenario(browser, mode, viewport, desktopEventProject());
      capturedBrowserIssues.push(...result.issues);
      capturedMetrics.push(result.metric);
      expect(result.issues).toEqual([]);
    });
  }
}

function optionalFixtureDescriptions(): readonly string[] {
  return [
    "Audio constructor: silent HTMLAudioElement without a source",
    "HTMLMediaElement.play: resolved promise",
    "fetch http://127.0.0.1:17831/v1/browser/{hello,next}: 200 {}",
    "fetch /__oprn/ai-activity: 204",
    "fetch dbserver ai_activity_logs: 201 []",
    "fetch dbserver ai_analysis_runs: 201 []",
  ] as const;
}
