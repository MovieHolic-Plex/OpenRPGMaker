// 조수 도크 축 삭제(3도크 → 입력줄 1개) 전/후 실측 캡처.
//
// Playwright 는 이 환경에 설치돼 있지 않다(@playwright/test 없음). 대신 이미 있는
// puppeteer-core + 시스템 Chrome 을 쓴다. 브라우저 바이너리는 CHROME_PATH 로 덮을 수 있다.
//
// 실행:
//   node scripts/capture-hud-dock-collapse.mjs --tag before --dock glass --port 10008
//   node scripts/capture-hud-dock-collapse.mjs --tag after                --port 10007
import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const TAG = arg("tag", "after");
const DOCK = arg("dock", "");
const PORT = arg("port", "10007");
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const OUT = `verify-shots/hud-dock-collapse/${TAG}${DOCK ? `-${DOCK}` : ""}`;
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 맵 캔버스가 실제로 크기를 잡을 때까지 기다린다. 편집기 캔버스는 WebGL 이라 픽셀을 못 읽는다. */
async function waitForMapPainted(page, timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await page.evaluate(() => {
      const host = document.querySelector("[data-testid='edit-canvas']");
      const canvas = host?.querySelector("canvas");
      if (!canvas) return false;
      const r = canvas.getBoundingClientRect();
      return r.width > 200 && r.height > 200;
    });
    if (ready) return true;
    await sleep(250);
  }
  return false;
}

async function clickIfVisible(page, testid) {
  const handle = await page.$(`[data-testid='${testid}']`);
  if (!handle) return false;
  const box = await handle.boundingBox().catch(() => null);
  if (!box) return false;
  await handle.click().catch(() => undefined);
  return true;
}

async function clickByText(page, label) {
  const clicked = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === text && b.offsetParent,
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
  return clicked;
}

/** 캔버스 폭 / 조수 점유 면적 / 상태 클래스 — "맵이 넓어졌다"의 근거. */
async function measure(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    };
    const panel = document.querySelector("[data-testid='ai-panel']");
    const layout = document.querySelector("[data-testid='editor-layout']");
    const canvas = rect("[data-testid='edit-canvas']");
    const panelRect = rect("[data-testid='ai-panel']");
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const coverage = panelRect ? (panelRect.w * panelRect.h) / (viewport.w * viewport.h) : 0;
    return {
      viewport,
      canvas,
      panel: panelRect,
      chatDock: panel?.dataset.chatDock ?? null,
      logSlot: panel?.dataset.logSlot ?? null,
      stateClasses: panel
        ? [...panel.classList].filter((c) => c.startsWith("is-") || c.startsWith("chat-dock"))
        : [],
      bodyDockClasses: [...document.body.classList].filter((c) => c.startsWith("ai-chat-dock")),
      sideWidthVar: layout ? getComputedStyle(layout).getPropertyValue("--ai-chat-side-width").trim() : null,
      sidePanelPresent: Boolean(document.querySelector("[data-testid='chat-side-panel']")),
      risingOverlayPresent: Boolean(document.querySelector("[data-testid='ai-rising-overlay']")),
      volatileZonePresent: Boolean(document.querySelector("[data-testid='ai-rising-volatile-zone']")),
      nextStepsVisible: Boolean(document.querySelector("[data-testid='ai-next-steps']")?.offsetParent),
      resizeHandleParent:
        document.querySelector("[data-testid='ai-resize-handle']")?.parentElement?.className ?? null,
      assistantCoveragePct: Math.round(coverage * 1000) / 10,
      canvasWidthPct: canvas ? Math.round((canvas.w / viewport.w) * 1000) / 10 : null,
    };
  });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1600,1000"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.evaluateOnNewDocument((dock) => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
    if (dock) {
      localStorage.setItem(
        "oprn:editor-layout:v4",
        JSON.stringify({ leftWidth: 280, mapTreeHeight: 220, chatDock: dock }),
      );
    }
  }, DOCK);

  await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await clickIfVisible(page, "login-guest");
  await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 90_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) await clickByText(page, label);
  await clickIfVisible(page, "ai-collapsed-restore");
  // before 트리의 glass 카드는 **접힌 채**(is-glass-folded) 부팅한다 — 셰브론을 눌러
  // 펼쳐야 도크의 실제 크기가 잡힌다. after 트리에는 fold 축이 없어 무해하다.
  if (await page.$(".ai-chat-panel.is-glass-folded")) await clickIfVisible(page, "ai-collapse");
  await waitForMapPainted(page);
  await sleep(900);

  // 도크 선택은 localStorage 로는 안 걸린다(?freshProject=1 이 레이아웃 키를 갈아 버린다).
  // 숨은 `chat-dock-toggle` 을 눌러 원하는 도크까지 순환시킨다 — before 트리에만 있다.
  if (DOCK) {
    for (let i = 0; i < 4; i += 1) {
      const now = await page.evaluate(
        () => document.querySelector("[data-testid='ai-panel']")?.dataset.chatDock ?? null,
      );
      if (now === DOCK) break;
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector("[data-testid='chat-dock-toggle']");
        if (!btn) return false;
        btn.click();
        return true;
      });
      if (!clicked) break;
      await sleep(700);
    }
    if (await page.$(".ai-chat-panel.is-glass-folded")) await clickIfVisible(page, "ai-collapse");
    await sleep(800);
  }

  const data = await measure(page);
  writeFileSync(`${OUT}/measure.json`, JSON.stringify(data, null, 2));
  await page.screenshot({ path: `${OUT}/01-editor-idle.png` });

  const panel = await page.$("[data-testid='ai-panel']");
  if (panel) await panel.screenshot({ path: `${OUT}/02-assistant-surface.png` }).catch(() => undefined);

  if (await clickIfVisible(page, "ai-input")) {
    await sleep(600);
    await page.screenshot({ path: `${OUT}/03-composer-focus.png` });
  }

  console.log(`[hud-shot ${TAG}${DOCK ? `-${DOCK}` : ""}] ${JSON.stringify(data)}`);
} finally {
  await browser.close();
}
