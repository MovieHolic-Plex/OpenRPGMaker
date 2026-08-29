/**
 * 조수(AI 어시스턴트) 패널 축소/크기조절 QA.
 *
 * 목적: "패널을 접을(축소) 수 있는 눌 수 있는 컨트롤이 화면에 있는가"와
 * "드래그로 실제로 크기가 변하는가"를 도크(glass/side/float)마다 실측한다.
 *
 * Usage:
 *   RPG_ZZU_URL=http://127.0.0.1:9823 node scripts/qa/assistant-resize-collapse-qa.mjs --label before
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9823";
const label = (() => {
  const i = process.argv.indexOf("--label");
  return i > 0 ? process.argv[i + 1] : "run";
})();
const OUT = process.env.QA_OUT ?? "output/evidence/assistant-resize-collapse";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("dialog", (d) => d.accept());
await mkdir(OUT, { recursive: true });

const shot = async (name) => {
  const file = path.join(OUT, `${label}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
};

await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
const panel = page.getByTestId("ai-panel");
await panel.waitFor({ state: "attached", timeout: 20_000 });

/** 화면에 실제로 보이고 히트테스트로 닿는 컨트롤만 센다. */
const probe = async () => {
  return page.evaluate(() => {
    const panelEl = document.querySelector('[data-testid="ai-panel"]');
    if (!panelEl) return { error: "no panel" };
    const rect = panelEl.getBoundingClientRect();
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      // hidden/inert 조상 검사
      let node = el;
      while (node && node !== document.body) {
        if (node.hasAttribute?.("hidden") || node.inert) return false;
        const ncs = getComputedStyle(node);
        if (ncs.display === "none" || ncs.visibility === "hidden") return false;
        node = node.parentElement;
      }
      return true;
    };
    const hitAt = (x, y) => {
      const el = document.elementFromPoint(Math.round(x), Math.round(y));
      if (!el) return null;
      const testid = el.closest("[data-testid]")?.dataset?.testid ?? null;
      return { tag: el.tagName.toLowerCase(), cls: el.className?.toString?.().slice(0, 90) ?? "", testid };
    };
    const ctl = (testid) => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      if (!el) return { present: false, visible: false };
      const r = el.getBoundingClientRect();
      return {
        present: true,
        visible: visible(el),
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.x),
        y: Math.round(r.y),
        hit: r.width > 0 ? hitAt(r.x + r.width / 2, r.y + r.height / 2) : null,
      };
    };
    const handleEl = document.querySelector('[data-testid="ai-resize-handle"]');
    const handleRect = handleEl?.getBoundingClientRect() ?? null;
    const resizeTargetEl = panelEl.dataset.chatDock === "float"
      ? document.querySelector('[data-testid="ai-command-bar"]')
      : panelEl;
    const targetRect = resizeTargetEl?.getBoundingClientRect() ?? rect;
    return {
      dock: panelEl.dataset.chatDock,
      panelClass: panelEl.className,
      target: {
        testid: resizeTargetEl?.getAttribute("data-testid") ?? null,
        rect: {
          w: Math.round(targetRect.width),
          h: Math.round(targetRect.height),
          x: Math.round(targetRect.x),
          y: Math.round(targetRect.y),
        },
      },
      panel: {
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      },
      inlineStyle: panelEl.getAttribute("style") ?? "",
      collapsed: panelEl.classList.contains("is-collapsed"),
      controls: {
        collapse: ctl("ai-collapse"),
        restore: ctl("ai-collapsed-restore"),
        resizeHandle: ctl("ai-resize-handle"),
      },
      // 손잡이 코너 히트테스트: 실제 포인터가 손잡이에 닿는지
      handleCornerHit: handleRect
        ? hitAt(handleRect.x + handleRect.width - 3, handleRect.y + handleRect.height - 3)
        : null,
      // 패널 안에서 보이는 모든 버튼 라벨 (사용자가 실제로 누를 수 있는 것)
      visibleButtons: Array.from(panelEl.querySelectorAll("button"))
        .filter((b) => visible(b))
        .map((b) => ({
          testid: b.dataset.testid ?? null,
          label: (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 40),
        })),
    };
  });
};

const setDock = async (dock) => {
  await page.evaluate((d) => {
    const w = window;
    if (typeof w.__oprnSetChatDock === "function") {
      w.__oprnSetChatDock(d);
      return;
    }
    // 폴백: 숨은 훅 버튼으로 도크 순환
    const btn = document.querySelector('[data-testid="chat-dock-toggle"]');
    for (let i = 0; i < 3; i += 1) {
      const panelEl = document.querySelector('[data-testid="ai-panel"]');
      if (panelEl?.dataset.chatDock === d) return;
      btn?.click();
    }
  }, dock);
  await page.waitForFunction(
    (d) => document.querySelector('[data-testid="ai-panel"]')?.dataset.chatDock === d,
    dock,
    { timeout: 5_000 },
  );
};

/** 손잡이를 드래그해서 dock별 실제 surface 크기가 바뀌는지 확인한다. */
const dragResize = async (dx, dy) => {
  const before = await probe();
  const h = before.controls.resizeHandle;
  if (!h.present || !h.visible) return { attempted: false, reason: "handle not visible", before, after: before };
  const cx = h.x + h.w / 2;
  const cy = h.y + h.h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 5 });
  await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
  const after = await probe();
  return {
    attempted: true,
    targetTestid: before.target.testid,
    dx,
    dy,
    before: before.target.rect,
    after: after.target.rect,
    changedW: after.target.rect.w - before.target.rect.w,
    changedH: after.target.rect.h - before.target.rect.h,
    worked: Math.abs(after.target.rect.w - before.target.rect.w) > 8 || Math.abs(after.target.rect.h - before.target.rect.h) > 8,
  };
};

/** 화면에 보이는 컨트롤만으로 패널을 접을 수 있는지. 숨은 훅 버튼은 쓰지 않는다. */
const tryVisibleCollapse = async () => {
  const p = await probe();
  const c = p.controls.collapse;
  if (!c.present) return { possible: false, reason: "no ai-collapse element" };
  if (!c.visible) return { possible: false, reason: "ai-collapse exists but is not visible (hidden/inert toolbar)" };
  await page.getByTestId("ai-collapse").click();
  await page.getByTestId("ai-panel").evaluate((node) => {
    if (!node.classList.contains("is-collapsed")) throw new Error("collapse state did not apply");
  });
  const after = await probe();
  return { possible: after.collapsed, reason: after.collapsed ? "collapsed via visible control" : "click did not collapse" };
};

const report = { label, base: BASE, at: new Date().toISOString(), docks: {}, consoleErrors: [] };

for (const dock of ["glass", "side", "float"]) {
  await setDock(dock);
  const shotFile = await shot(`${dock}-idle`);
  const before = await probe();
  const growDelta = dock === "glass" ? { dx: 160, dy: 120 } : { dx: -160, dy: 120 };
  const resize = await dragResize(growDelta.dx, growDelta.dy);
  const shrink = resize.worked
    ? await dragResize(-growDelta.dx, -growDelta.dy)
    : { attempted: false, reason: "grow failed" };
  const collapse = await tryVisibleCollapse();
  const collapsedShot = collapse.possible ? await shot(`${dock}-collapsed`) : null;
  if (collapse.possible) {
    // 다시 펼쳐 다음 도크 측정에 영향 없게
    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) await restore.click();
    await page.getByTestId("ai-panel").evaluate((node) => {
      if (node.classList.contains("is-collapsed")) throw new Error("restore state did not apply");
    });
  }
  report.docks[dock] = { probe: before, resizeGrow: resize, resizeShrink: shrink, collapse, shots: [shotFile, collapsedShot].filter(Boolean) };
}

report.consoleErrors = consoleErrors.slice(0, 20);
const jsonFile = path.join(OUT, `${label}-measure.json`);
await writeFile(jsonFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
console.log("\nwrote", jsonFile);
await browser.close();
