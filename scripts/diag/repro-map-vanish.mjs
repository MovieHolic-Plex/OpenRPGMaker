// 진단: 테스트 플레이(시연 실행)를 닫은 뒤 편집 맵 캔버스가 사라지는지 실측한다.
// 여러 시나리오(즉시닫기/걷기/전체화면/다시시작/타이틀/전투)를 각각 새 페이지에서 돌려
// 어느 경로가 편집 맵을 지우는지 좁힌다.
//
// 사용: node scripts/diag/repro-map-vanish.mjs [--url http://127.0.0.1:9860] [--only walk]
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const BASE = arg("url", "http://127.0.0.1:9860");
const ONLY = arg("only", "");
const BOOT = arg("boot", "?freshProject=1");
const OUT = arg("out", "verify-shots/map-vanish");
mkdirSync(OUT, { recursive: true });

const EDIT_CANVAS = '[data-testid="edit-canvas"] canvas';

async function probe(page, out, label) {
  const info = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="edit-canvas"]');
    const c = host?.querySelector("canvas");
    const cs = c ? getComputedStyle(c) : null;
    const layout = document.querySelector(".editor-layout");
    const bridge = window.__oprnProjectE2E?.snapshot?.();
    return {
      canvasCount: host ? host.querySelectorAll("canvas").length : -1,
      buffer: c ? `${c.width}x${c.height}` : null,
      css: cs ? `${cs.width}x${cs.height}` : null,
      display: cs?.display ?? null,
      visibility: cs?.visibility ?? null,
      hostRect: host ? `${host.clientWidth}x${host.clientHeight}` : null,
      layoutRect: layout ? `${layout.clientWidth}x${layout.clientHeight}` : null,
      shellRect: (() => {
        const s = document.querySelector('[data-testid="editor-canvas-scroll-shell"]');
        return s ? `${s.clientWidth}x${s.clientHeight}` : null;
      })(),
      ctxLost: (window.__ctxLost ?? []).length,
      modalPresent: !!document.querySelector('[data-testid="test-play-modal-backdrop"]'),
      mapTreeRows: document.querySelectorAll('[data-testid^="map-tree-item"], .map-tree-row').length,
      mapIds: bridge ? Object.keys(bridge.project?.maps ?? {}) : null,
      currentMapId: window.__oprnEditorTool?.currentMapId?.() ?? null,
    };
  });
  let pngBytes = null;
  try {
    const buf = await page.locator(EDIT_CANVAS).first().screenshot({ path: `${out}/${label}.png` });
    pngBytes = buf.length;
  } catch { /* no canvas */ }
  const rec = { label, ...info, pngBytes };
  console.log("  " + JSON.stringify(rec));
  return rec;
}

async function bootEditor(page) {
  await page.goto(`${BASE}/${BOOT}`, { waitUntil: "domcontentloaded" });
  await page.locator(EDIT_CANVAS).first().waitFor({ state: "visible", timeout: 90_000 });
  await page.getByTestId("mode-play").waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForFunction(
    () => {
      const c = document.querySelector('[data-testid="edit-canvas"] canvas');
      return !!c && c.width > 100;
    },
    null,
    { timeout: 60_000 },
  );
}

async function openPlay(page) {
  await page.getByTestId("mode-play").click();
  await page.getByTestId("test-play-window").waitFor({ state: "visible", timeout: 90_000 });
  await page.getByTestId("runtime-state-json").waitFor({ state: "attached", timeout: 90_000 });
}

async function closePlay(page) {
  await page.getByTestId("test-play-window-close").click();
  await page.getByTestId("test-play-window").waitFor({ state: "detached", timeout: 30_000 });
  await page.locator(EDIT_CANVAS).first().waitFor({ state: "attached", timeout: 30_000 });
  // 복귀 후 두 프레임 안정화 (rAF 체인, 고정 sleep 금지)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const scenarios = {
  immediate: async () => { /* open → close */ },
  walk: async (page) => {
    for (const key of ["ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight", "ArrowUp"]) {
      await page.keyboard.press(key);
    }
    await page.waitForFunction(() => !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 10_000 });
  },
  walkFar: async (page) => {
    // 게임에서 오래 걸어 다니는 흐름. 편집기 EditScene 이 같은 방향키를 카메라 팬으로
    // 먹으면 편집 카메라가 맵 밖으로 밀려나 복귀 시 빈 화면이 된다.
    for (let i = 0; i < 24; i += 1) await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowDown");
  },
  fullscreenToggle: async (page) => {
    await page.getByTestId("test-play-window-maximize").click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="test-play-window"]')?.dataset.windowMode === "fullscreen",
      null,
      { timeout: 10_000 },
    );
  },
  restart: async (page) => {
    await page.getByTestId("test-play-restart").click();
    await page.getByTestId("runtime-state-json").waitFor({ state: "attached", timeout: 60_000 });
  },
  titleBoot: async (page) => {
    await page.getByTestId("test-play-title").click();
    await page.getByTestId("title-screen").waitFor({ state: "visible", timeout: 60_000 });
  },
};

const results = {};
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

for (const [name, act] of Object.entries(scenarios)) {
  if (ONLY && ONLY !== name) continue;
  console.log(`\n[${name}]`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (t.includes("ERR_CONNECTION_REFUSED")) return;
    consoleErrors.push(t.slice(0, 240));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 240)}`));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.__ctxLost = [];
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...a) {
      if (String(a[0]).includes("webgl")) {
        this.addEventListener("webglcontextlost", () => window.__ctxLost.push(Date.now()));
      }
      return orig.apply(this, a);
    };
  });
  const out = `${OUT}/${name}`;
  mkdirSync(out, { recursive: true });
  try {
    await bootEditor(page);
    const before = await probe(page, out, "1-before");
    await openPlay(page);
    await act(page);
    const during = await probe(page, out, "2-during");
    await closePlay(page);
    const after = await probe(page, out, "3-after");
    await page.screenshot({ path: `${out}/4-after-full.png` });
    results[name] = {
      before,
      during,
      after,
      consoleErrors,
      verdict:
        after.pngBytes === null ? "CANVAS GONE"
        : Math.abs((after.pngBytes ?? 0) - (before.pngBytes ?? 0)) > (before.pngBytes ?? 1) * 0.2 ? "PIXELS CHANGED"
        : "ok",
    };
  } catch (error) {
    await page.screenshot({ path: `${out}/error.png` }).catch(() => {});
    results[name] = { error: String(error).slice(0, 400), consoleErrors };
  }
  console.log(`  verdict: ${results[name].verdict ?? results[name].error}`);
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}/records.json`, JSON.stringify(results, null, 2));
console.log("\n=== SUMMARY ===");
for (const [k, v] of Object.entries(results)) console.log(`${k}: ${v.verdict ?? "ERROR " + v.error}`);
