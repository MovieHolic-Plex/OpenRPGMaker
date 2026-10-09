/**
 * 좌측 사이드바 도구 증거 캡처 — 3개 UI 모드 x 도구별 활성 상태 + 플라이아웃/오버플로.
 * 사용: npx tsx scripts/capture-left-sidebar-tools.mts
 * 출력: output/evidence/left-sidebar-review/shots/*.png + manifest.json
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9999";
const OUT = join(process.cwd(), "output", "evidence", "left-sidebar-review", "shots");
type Mode = "editor";

type Shot = { readonly file: string; readonly mode: Mode; readonly caption: string; readonly kind: string };
const shots: Shot[] = [];

async function snap(page: Page, name: string, mode: Mode, caption: string, kind: string, selector?: string): Promise<void> {
  const file = `${name}.png`;
  const path = join(OUT, file);
  if (selector) {
    const el = page.locator(selector).first();
    await el.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage: false });
  }
  shots.push({ file, mode, caption, kind });
  console.log("shot", file);
}

async function boot(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript((m) => {
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    // AI 패널을 접어 캔버스를 드러낸다 (aiPanelLayout.ts 키).
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  }, mode);
  await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  try {
    await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 60_000 });
  } catch (error) {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, `_boot-fail-${mode}.png`), fullPage: false });
    throw error;
  }
  await page.locator(".left-panel").waitFor({ state: "visible", timeout: 30_000 });
  // 웰컴/코치마크 오버레이가 있으면 닫는다.
  for (const testid of ["editor-welcome-close", "editor-welcome-dismiss", "coachmark-done", "welcome-start-blank"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
}

/** 도구 버튼을 눌러 활성 상태를 만들고 사이드바를 찍는다. */
async function captureTool(page: Page, mode: Mode, testid: string, label: string): Promise<void> {
  const btn = page.getByTestId(testid).first();
  if (!(await btn.isVisible().catch(() => false))) {
    console.log("absent", mode, testid);
    return;
  }
  if (!(await btn.isEnabled().catch(() => false))) {
    await snap(page, `${mode}-tool-${testid}-disabled`, mode, `${label} — 비활성 상태(disabled)`, "tool", ".left-panel");
    return;
  }
  await btn.click();
  await page.locator(`body[data-editor-tool]`).waitFor({ timeout: 5_000 }).catch(() => {});
  const tool = await page.evaluate(() => document.body.dataset.editorTool ?? "?");
  await snap(page, `${mode}-tool-${testid}`, mode, `${label} 선택 — body[data-editor-tool]="${tool}"`, "tool", ".left-panel");
}

async function run(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv[2] as Mode | undefined;
  const modes: readonly Mode[] = only ? [only] : ["editor"];
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

  for (const mode of modes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("pageerror", mode, e.message));
    await boot(page, mode);

    await snap(page, `${mode}-shell`, mode, `${mode} 모드 전체 화면 (1440x900)`, "shell");
    await snap(page, `${mode}-sidebar`, mode, `${mode} 모드 좌측 사이드바 전체`, "sidebar", ".left-panel");

    {
      // 되돌리기 버튼이 살아 있는 상태를 찍으려면 편집 이력이 하나 필요하다 — 캔버스를 한 번 칠한다.
      const paintBtn = page.getByTestId("tool-paint").first();
      if (await paintBtn.isVisible().catch(() => false)) await paintBtn.click();
      const canvas = page.locator('[data-testid="edit-canvas"]');
      const box = await canvas.boundingBox();
      if (box) await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
      for (const [testid, label] of [
        ["oprn-tool-undo", "되돌리기"],
        ["tool-select", "영역 선택"],
        ["tool-paint", "칠하기 (pen)"],
        ["tool-erase", "지우기"],
        ["oprn-tool-rect", "사각형 채우기"],
        ["oprn-tool-round", "타원 채우기"],
        ["tool-fill", "이어진 영역 채우기"],
        ["tool-eyedropper", "타일 집기"],
        ["tool-pan", "화면 밀기"],
        ["tool-collision", "통행 표시"],
        ["tool-event", "장면 놓기"],
      ] as const) {
        await captureTool(page, mode, testid, label);
      }
      // 툴바 한 줄만 크게
      const bar = page.getByTestId("oprn-tile-toolbar");
      if (await bar.isVisible().catch(() => false)) {
        await snap(page, `${mode}-toolbar-row`, mode, "타일 그리기 도구막대 한 줄 (아이콘 전용)", "toolbar", '[data-testid="oprn-tile-toolbar"]');
      }
      // 오버플로
      const overflow = page.getByTestId("oprn-tool-overflow");
      if (await overflow.isVisible().catch(() => false)) {
        await overflow.click();
        await page.getByTestId("toolbar-overflow-dropdown").waitFor({ timeout: 5_000 }).catch(() => {});
        await snap(page, `${mode}-overflow`, mode, "⋯ 더 보기 — 복사/붙여넣기 · 인스펙터 · 규칙 감사 · 작업 기록 · 브러시 크기", "overflow", ".left-panel");
        const inspector = page.getByTestId("oprn-tool-inspector");
        if (await inspector.isVisible().catch(() => false)) {
          await inspector.click();
          await snap(page, `${mode}-overflow-inspector`, mode, "오버플로 안의 인스펙터 — 채우기·스포이드가 여기 한 번 더 있다", "overflow", ".left-panel");
        }
        await overflow.click().catch(() => {});
      }
      // 레이어 스위처
      const layers = page.getByTestId("left-layer-switcher");
      if (await layers.isVisible().catch(() => false)) {
        await snap(page, `${mode}-layer-switcher`, mode, "사이드바 레이어 전환 (바닥/상위/이벤트)", "layer", '[data-testid="left-layer-switcher"]');
      }
      // 이벤트 레이어 좌패널
      const ev = page.getByTestId("layer-event");
      if (await ev.isVisible().catch(() => false)) {
        await ev.click();
        await page.waitForTimeout(0);
        await snap(page, `${mode}-layer-event-panel`, mode, "이벤트 레이어 — 좌패널이 이벤트 편집기로 바뀐다", "layer", ".left-panel");
        await page.getByTestId("layer-lower").first().click().catch(() => {});
      }
    }
    await context.close();
  }

  await browser.close();
  const manifestPath = join(OUT, only ? `manifest-${only}.json` : "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(shots, null, 2));
  console.log("total", shots.length);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
