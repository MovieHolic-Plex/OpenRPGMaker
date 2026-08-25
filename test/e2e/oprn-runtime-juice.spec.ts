import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".omo/ulw-loop/rpg-zzu-menu-juice/evidence";
const RED_LOG = `${EVIDENCE_DIR}/red-runtime-juice-log.json`;
const GREEN_LOG = `${EVIDENCE_DIR}/green-runtime-juice-log.json`;
const GREEN_SCREENSHOT = `${EVIDENCE_DIR}/green-runtime-juice-menu.png`;

type RuntimeJuiceEvent =
  | "menu-back"
  | "menu-close"
  | "menu-confirm"
  | "menu-invalid"
  | "menu-open"
  | "menu-select"
  | "title-confirm"
  | "title-enter"
  | "title-select";

type RuntimeJuiceLogEntry = {
  readonly event: RuntimeJuiceEvent;
  readonly soundResourceId: string;
  readonly motionClass: string;
  readonly durationMs: number;
};

test("title and status menu controls emit tactile motion and sound feedback", async ({ page }, testInfo) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await installAudioProbe(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, createBlankProject(), "/?e2eVitals=1");
  await openTestPlayWindow(page);

  await triggerAndExpectLiveJuiceClass(page, "title-screen", "juice-title-select", () => page.keyboard.press("ArrowDown"));
  await triggerAndExpectLiveJuiceClass(page, "title-screen", "juice-title-select", () => page.keyboard.press("ArrowUp"));
  await triggerAndExpectLiveJuiceClass(page, "title-screen", "juice-title-confirm", () => page.keyboard.press("Enter"));
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(120);

  await triggerAndExpectLiveJuiceClass(page, "main-menu", "juice-menu-open", () => page.keyboard.press("x"));
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.screenshot({ path: GREEN_SCREENSHOT, fullPage: true });
  await triggerAndExpectLiveJuiceClass(page, "main-menu", "juice-menu-select", () => page.keyboard.press("ArrowDown"));
  await triggerAndExpectLiveJuiceClass(page, "main-menu", "juice-menu-confirm", () => page.keyboard.press("Enter"));
  await triggerAndExpectLiveJuiceClass(page, "main-menu", "juice-menu-back", () => page.keyboard.press("Escape"));
  await triggerAndExpectLiveJuiceClass(page, "main-menu", "juice-menu-close", () => page.keyboard.press("x"));
  await expect(page.getByTestId("main-menu")).toHaveCount(0);

  const log = await runtimeJuiceLog(page);
  const path = log.length === 0 ? RED_LOG : GREEN_LOG;
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  await testInfo.attach("runtime-juice-log.json", {
    body: `${JSON.stringify(log, null, 2)}\n`,
    contentType: "application/json",
  });

  expect(log.map((entry) => entry.event)).toEqual([
    "title-enter",
    "title-select",
    "title-select",
    "title-confirm",
    "menu-open",
    "menu-select",
    "menu-confirm",
    "menu-back",
    "menu-close",
  ]);
  expect(new Set(log.map((entry) => entry.soundResourceId)).size).toBeGreaterThanOrEqual(4);
  expect(log.every((entry) => entry.motionClass.startsWith("juice-"))).toBe(true);
  const audioPlays = await audioProbeLog(page);
  expect(audioPlays).toHaveLength(log.length);
  expect(new Set(audioPlays.map((entry) => entry.src)).size).toBeGreaterThanOrEqual(4);
});

test("keyboard to-title command confirms on the live status menu before transitioning", async ({ page }) => {
  await installAudioProbe(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, createBlankProject(), "/?e2eVitals=1");
  await openTestPlayWindow(page);

  await triggerAndExpectLiveJuiceClass(page, "title-screen", "juice-title-confirm", () => page.keyboard.press("Enter"));
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(120);
  await triggerAndExpectLiveJuiceClass(page, "main-menu", "juice-menu-open", () => page.keyboard.press("x"));

  // to-title 은 레일 마지막 항목 — items 에서 ArrowUp 1회 랩으로 도달 (커맨드 추가에 강건).
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(30);
  await triggerAndExpectLiveJuiceClass(page, "main-menu", "juice-menu-confirm", () => page.keyboard.press("Enter"));
  await expect(page.getByTestId("title-screen").last()).toBeVisible({ timeout: 5000 });
});

async function openTestPlayWindow(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("mode-play").click();
  const modal = page.getByTestId("test-play-window");
  await page.waitForTimeout(250);
  if (!(await modal.isVisible())) {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
    });
  }
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(modal.getByTestId("title-screen")).toBeVisible({ timeout: 10000 });
}

async function runtimeJuiceLog(page: Page): Promise<readonly RuntimeJuiceLogEntry[]> {
  return page.evaluate(() => {
    const testWindow = window as Window & {
      readonly __oprnJuiceLog?: () => readonly RuntimeJuiceLogEntry[];
    };
    return testWindow.__oprnJuiceLog?.() ?? [];
  });
}

async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const audioPlays: { src: string; volume: number }[] = [];
    class RuntimeJuiceAudioProbe {
      public readonly src: string;
      public volume = 1;

      public constructor(src: string) {
        this.src = String(src);
      }

      public play(): Promise<void> {
        audioPlays.push({ src: this.src, volume: this.volume });
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: RuntimeJuiceAudioProbe,
    });
    Object.defineProperty(window, "__oprnAudioProbe", {
      configurable: true,
      value: () => [...audioPlays],
    });
  });
}

async function triggerAndExpectLiveJuiceClass(
  page: Page,
  testId: string,
  className: string,
  action: () => Promise<unknown>
): Promise<void> {
  await page.evaluate(({ expectedClass, expectedTestId }) => {
    const testWindow = window as Window & { __oprnPendingJuiceClass?: Promise<boolean> };
    testWindow.__oprnPendingJuiceClass = new Promise<boolean>((resolve) => {
      const hasLiveClass = (): boolean => Array.from(document.querySelectorAll<HTMLElement>(`[data-testid='${expectedTestId}']`))
        .some((node) => node.isConnected && node.classList.contains(expectedClass));
      const observer = new MutationObserver(() => {
        if (!hasLiveClass()) return;
        observer.disconnect();
        resolve(true);
      });
      observer.observe(document.body, {
        attributeFilter: ["class"],
        attributes: true,
        childList: true,
        subtree: true,
      });
      window.setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, 1500);
    });
  }, { expectedClass: className, expectedTestId: testId });
  await action();
  const observed = page.evaluate(() => {
    const testWindow = window as Window & { __oprnPendingJuiceClass?: Promise<boolean> };
    return testWindow.__oprnPendingJuiceClass;
  });
  await expect(observed).resolves.toBe(true);
}

async function audioProbeLog(page: Page): Promise<readonly { src: string; volume: number }[]> {
  return page.evaluate(() => {
    const testWindow = window as Window & {
      readonly __oprnAudioProbe?: () => readonly { src: string; volume: number }[];
    };
    return testWindow.__oprnAudioProbe?.() ?? [];
  });
}
