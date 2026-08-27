/**
 * 좌측 사이드바 도구 계약 실측 프로브 (ulw-loop 증거 도구).
 *
 * 왜 스크립트인가: 이 6개 결함은 전부 "좌패널 폭 안에서 실제로 도달/포커스/커서가 되는가"라서
 * 유닛 테스트가 증명할 수 없다(happy-dom 에 레이아웃이 없다). 브라우저에서 rect·activeElement·
 * computed cursor 를 직접 읽어 JSON 으로 박제한다.
 *
 * 사용: npx tsx scripts/probe-sidebar-contract.mts [--port 9814] [--mode standard] [--out <dir>] [--tag before]
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Rect = { x: number; y: number; width: number; height: number } | null;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const PORT = arg("port", "9814");
const MODE = arg("mode", "standard");
const TAG = arg("tag", "now");
const OUT = arg("out", ".omo/evidence/left-sidebar-repair");
const BASE = `http://127.0.0.1:${PORT}`;

/** 도구 선택 채널: 보이는 버튼이 있으면 버튼 클릭, 잘려 있으면 단축키.
 *  왜 두 채널인가: 프리픽스 트리에서는 통행/장면 버튼이 스트립 밖으로 잘려 클릭이 불가능하다. */
const TOOL_CHANNEL: ReadonlyArray<{ tool: string; testid?: string; key?: string }> = [
  { tool: "paint", testid: "tool-paint", key: "b" },
  { tool: "select", testid: "tool-select", key: "v" },
  { tool: "erase", testid: "tool-erase", key: "e" },
  { tool: "fill", testid: "tool-fill", key: "g" },
  { tool: "eyedropper", testid: "tool-eyedropper", key: "i" },
  { tool: "pan", key: "4" },
  { tool: "collision", key: "6" },
  { tool: "event", key: "7" },
];

async function activeInfo(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "null";
    const id = el.dataset?.testid;
    return `${el.tagName}${id ? `[${id}]` : ""}`;
  });
}

function contains(outer: Rect, inner: Rect): boolean | null {
  if (!outer || !inner) return null;
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((mode) => {
    localStorage.setItem("oprn:editor-ui-mode", mode as string);
    localStorage.setItem("rpg-zzu:editor-ui-mode", mode as string);
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  }, MODE);
  await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForTimeout(900);

  const rect = (sel: string) => page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2) };
  }, sel);

  /* ── C5: 조수 카드 + 좌패널 기하 (절대 흔들리면 안 되는 것) ── */
  const geometry = {
    aiPanel: await rect('[data-testid="ai-panel"]'),
    leftPanel: await rect(".left-panel"),
    leftPaletteRoot: await rect('[data-testid="left-palette-root"]'),
    canvas: await rect('[data-testid="edit-canvas"]'),
  };

  /* ── C1: ⋯ 오버플로 도달성 ── */
  const strip = await rect('[data-testid="tool-grid"]');
  const toolbarRow = await page.evaluate(() => {
    const el = document.querySelector('[role="toolbar"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      rect: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2) },
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      overflowX: getComputedStyle(el).overflowX,
    };
  });
  const trigger = await rect('[data-testid="oprn-tool-overflow"]');
  const overflow: Record<string, unknown> = {
    toolbarRow,
    triggerRect: trigger,
    triggerInsideToolbar: contains(toolbarRow?.rect ?? null, trigger),
    triggerInsideLeftPanel: contains(geometry.leftPanel, trigger),
  };
  try {
    await page.locator('[data-testid="oprn-tool-overflow"]').click({ timeout: 4000, force: true });
    await page.waitForTimeout(250);
    const dd = await rect('[data-testid="toolbar-overflow-dropdown"]');
    overflow.dropdownRect = dd;
    overflow.dropdownVisible = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="toolbar-overflow-dropdown"]') as HTMLElement | null;
      if (!el) return "absent";
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return JSON.stringify({ display: cs.display, visibility: cs.visibility, opacity: cs.opacity, w: r.width, h: r.height });
    });
    overflow.dropdownOnScreen = dd ? dd.x >= 0 && dd.y >= 0 && dd.width > 0 && dd.height > 0 && dd.x + dd.width <= 1440 && dd.y + dd.height <= 900 : null;
    overflow.hitTestAtDropdownCenter = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="toolbar-overflow-dropdown"]') as HTMLElement | null;
      if (!el) return "absent";
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) as HTMLElement | null;
      if (!hit) return "none";
      return `${hit.tagName}.${hit.className}|insideDropdown=${el.contains(hit)}`;
    });
    /* ── C3: Escape / 바깥 클릭으로 닫히는가 + 포커스 복귀 ── */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    overflow.afterEscapeOpen = await page.evaluate(() => Boolean(document.querySelector('[data-testid="toolbar-overflow-dropdown"]')));
    overflow.afterEscapeFocus = await activeInfo(page);
    if (overflow.afterEscapeOpen) {
      const canvas = await rect('[data-testid="edit-canvas"]');
      if (canvas) await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
      await page.waitForTimeout(250);
      overflow.afterOutsideClickOpen = await page.evaluate(() => Boolean(document.querySelector('[data-testid="toolbar-overflow-dropdown"]')));
    }
  } catch (e) {
    overflow.clickError = String(e).split("\n")[0];
  }
  await page.screenshot({ path: join(OUT, `${TAG}-${MODE}-overflow.png`), clip: geometry.leftPanel ?? undefined });

  /* ── C2: 포커스 생존 + 화살표 이동 ── */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const focus: Record<string, unknown> = {};
  await page.getByTestId("tool-fill").focus();
  focus.beforeEnter = await activeInfo(page);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  focus.afterEnterTool = await page.evaluate(() => document.body.dataset.editorTool ?? "?");
  focus.afterEnterFocus = await activeInfo(page);
  await page.getByTestId("tool-select").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  focus.afterArrowRight = await activeInfo(page);
  await page.keyboard.press("Home");
  await page.waitForTimeout(150);
  focus.afterHome = await activeInfo(page);
  focus.tabStopsInToolbar = await page.evaluate(() => {
    const bar = document.querySelector('[role="toolbar"]');
    if (!bar) return -1;
    return [...bar.querySelectorAll("button")].filter((b) => !(b as HTMLButtonElement).disabled && (b as HTMLElement).tabIndex >= 0).length;
  });

  /* ── C4: 도구별 커서 + 레이어 패리티 ── */
  const cursors: Record<string, string> = {};
  const readCursor = () => page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="edit-canvas"]') as HTMLElement | null;
    return { tool: document.body.dataset.editorTool ?? "?", cursor: canvas ? getComputedStyle(canvas).cursor : "no-canvas" };
  });
  for (const spec of TOOL_CHANNEL) {
    let applied = false;
    if (spec.testid) {
      const btn = page.getByTestId(spec.testid);
      if (await btn.count()) {
        await btn.first().click({ force: true, timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(220);
        applied = (await readCursor()).tool === spec.tool;
      }
    }
    if (!applied && spec.key) {
      // 단축키는 캔버스가 키를 받는 상태에서만 듣는다 — 캔버스를 먼저 눌러 포커스를 준다.
      const canvas = await rect('[data-testid="edit-canvas"]');
      if (canvas) await page.mouse.click(canvas.x + 40, canvas.y + 40);
      await page.waitForTimeout(120);
      await page.keyboard.press(spec.key);
      await page.waitForTimeout(220);
    }
    const got = await readCursor();
    cursors[spec.tool] = `${got.tool}=>${got.cursor}${got.tool === spec.tool ? "" : " (APPLY-FAILED)"}`;
  }
  const activeLayerLabel = () => page.evaluate(() => {
    const btn = document.querySelector('.left-layer-btn.is-active, .left-layer-btn[aria-pressed="true"]') as HTMLElement | null;
    return btn?.textContent?.trim() ?? "none";
  });
  // 레이어 패리티는 반드시 바닥에서 출발해야 한다 — 앞선 커서 루프가 7(장면)로 레이어를 이벤트로 옮긴다.
  const parity: Record<string, unknown> = {};
  const lowerLayerBtn = page.locator(".left-layer-btn").first();
  if (await lowerLayerBtn.count()) {
    await lowerLayerBtn.click({ force: true, timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  parity.layerBeforeEventTool = await activeLayerLabel();
  const eventBtn = page.getByTestId("tool-event");
  if (await eventBtn.count()) {
    await eventBtn.click({ force: true, timeout: 4000 }).catch((e) => { parity.eventClickError = String(e).split("\n")[0]; });
    await page.waitForTimeout(350);
  }
  parity.toolAfterEventClick = await page.evaluate(() => document.body.dataset.editorTool ?? "?");
  parity.layerAfterEventToolClick = await activeLayerLabel();

  const out = { tag: TAG, mode: MODE, port: PORT, at: new Date().toISOString(), geometry, overflow, focus, cursors, parity };
  const file = join(OUT, `${TAG}-${MODE}-contract.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log(`\nwrote ${file}`);
  await page.screenshot({ path: join(OUT, `${TAG}-${MODE}-full.png`), fullPage: false });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
