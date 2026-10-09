/**
 * Assistant panel UI QA: capture screenshots + layout measurements for the
 * modern redesign (before/after comparison).
 *
 * Usage: node scripts/qa/assistant-ui-modern-qa.mjs --label before
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyLegacyEnvAliases } from "../lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9819";
const label = (() => {
  const i = process.argv.indexOf("--label");
  return i > 0 ? process.argv[i + 1] : "run";
})();
const OUT = process.env.QA_OUT ?? "output/evidence/assistant-ui-modern";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("dialog", (d) => d.accept());
await mkdir(OUT, { recursive: true });

const shot = async (name, locator) => {
  const file = path.join(OUT, `${label}-${name}.png`);
  if (locator) await locator.screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: false });
  console.log("shot", file);
  return file;
};

await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
const panel = page.getByTestId("ai-panel");
await panel.waitFor({ state: "attached", timeout: 20_000 });
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) {
  await restore.click();
  await panel.waitFor({ state: "visible", timeout: 10_000 });
}
await page.waitForFunction(
  () => {
    const el = document.querySelector('[data-testid="ai-panel"]');
    return !!el && el.getBoundingClientRect().height > 200;
  },
  { timeout: 20_000 },
);

const measure = await page.evaluate(() => {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const q = (sel) => document.querySelector(sel);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      padTop: px(cs.paddingTop),
      padBottom: px(cs.paddingBottom),
      padLeft: px(cs.paddingLeft),
      gap: px(cs.rowGap || cs.gap),
      radius: px(cs.borderTopLeftRadius),
      bg: cs.backgroundColor,
      overflowX: el.scrollWidth - el.clientWidth,
    };
  };
  const panelEl = q('[data-testid="ai-panel"]');
  const outline = [];
  const walk = (el, depth) => {
    if (depth > 4 || !el) return;
    for (const child of Array.from(el.children)) {
      const r = child.getBoundingClientRect();
      if (r.height > 0 || r.width > 0) {
        outline.push({
          depth,
          tag: child.tagName.toLowerCase(),
          cls: child.className?.toString().slice(0, 90) ?? "",
          testid: child.getAttribute("data-testid"),
          w: Math.round(r.width),
          h: Math.round(r.height),
          empty: child.textContent.trim().length === 0,
        });
      }
      walk(child, depth + 1);
    }
  };
  walk(panelEl, 0);
  return {
    panel: box(panelEl),
    header: box(q(".ai-chat-header")),
    body: box(q(".ai-chat-body") || q(".ai-chat-scroll") || q(".ai-chat-messages")),
    composer: box(q(".ai-command-bar")),
    textarea: box(q('[data-testid="ai-chat-input"]') || q(".ai-command-bar textarea")),
    outline,
    emptyBlocks: outline.filter((o) => o.empty && o.h >= 16 && o.w >= 80).length,
  };
});

await shot("full-editor");
await shot("panel", panel);
const header = panel.locator(".ai-chat-header");
if (await header.count()) await shot("header", header.first());
const bar = panel.locator(".ai-command-bar");
if (await bar.count()) await shot("composer", bar.first());

// Narrow extreme: shrink viewport so the docked panel gets its minimum width.
await page.setViewportSize({ width: 900, height: 720 });
await page.waitForTimeout(300);
const narrow = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="ai-panel"]');
  const body = document.querySelector(".ai-chat-body") || document.querySelector(".ai-chat-scroll");
  const send = document.querySelector('[data-testid="ai-send"]');
  const vis = (n) => {
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), inView: r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1 };
  };
  return {
    panelOverflowX: el ? el.scrollWidth - el.clientWidth : null,
    bodyOverflowX: body ? body.scrollWidth - body.clientWidth : null,
    panel: vis(el),
    send: vis(send),
  };
});
await shot("narrow");
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(200);

// 긴 대화: 지난 대화 복원 경로로 로그를 진짜 마운트에 채운다. DOM 주입은 안 된다 — 로그는 턴이
// 시작될 때까지 숨은 rising 오버레이 마운트에 있어서 주입한 줄은 화면에 안 나온다. 전송은
// LLM 동반 서버가 없으면 한 턴에서 마힌다 — 복원은 사용자가 부트 진짜로 마주치는 긴 대화 그대로다.
const seeded = await page.evaluate(() => {
  const store = window.__oprnEditorStore ?? null;
  const project = store?.getCurrent?.() ?? null;
  if (!project) return { ok: false, reason: "no store bridge" };
  const key = `${project.meta.title.trim() || "(untitled)"}::${project.startMapId}`;
  const entries = [];
  for (let i = 0; i < 8; i += 1) {
    entries.push({ kind: "user", text: `마을 입구에서 광장까지 길을 이어줘 ${i + 1}` });
    entries.push({
      kind: "assistant",
      text: `돌길 2칸 폭으로 연결하고 만나는 지점에 NPC 세 명을 배치했습니다. (${i + 1}번째 턴)`,
    });
  }
  localStorage.setItem(
    "oprn:ai-conversations",
    JSON.stringify([{ id: "conv_qa_long", title: "긴 대화 QA", model: "qa", savedAt: Date.now(), projectContextKey: key, entries }]),
  );
  return { ok: true, key, entries: entries.length };
});
console.log("seeded", JSON.stringify(seeded));
await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
const restore2 = page.getByTestId("ai-collapsed-restore");
if (await restore2.isVisible().catch(() => false)) await restore2.click();
await page
  .waitForFunction(
    () => {
      const log = document.querySelector('[data-testid="ai-chat-log"]');
      return !!log && (log.textContent ?? "").includes("마을 입구에서");
    },
    undefined,
    { timeout: 30_000 },
  )
  .catch(() => {});
// 회발 로그 지대는 대화가 비어 있을 때 접혀 있고 입력 포커스에 펼진다 — 복원된 긴 대화를
// 보려면 사용자와 같이 입력칸을 짚어야 한다.
await page.getByTestId("ai-input").click();
await page
  .waitForFunction(
    () => {
      const log = document.querySelector('[data-testid="ai-chat-log"]');
      return !!log && log.getBoundingClientRect().height > 0;
    },
    undefined,
    { timeout: 15_000 },
  )
  .catch(() => {});
const longConv = await page.evaluate(() => {
  const panel = document.querySelector('[data-testid="ai-panel"]');
  const log = document.querySelector('[data-testid="ai-chat-log"]');
  const header = document.querySelector(".ai-chat-header");
  const bar = document.querySelector(".ai-command-bar");
  if (!panel || !log || !header || !bar) return { error: "missing nodes" };
  const rows = Array.from(log.children).filter((n) => n.getBoundingClientRect().height > 0);
  const scrollOwner = (() => {
    let node = log;
    while (node && node !== document.body) {
      if (node.scrollHeight - node.clientHeight > 1 && getComputedStyle(node).overflowY !== "visible") {
        return { cls: node.className?.toString().slice(0, 60) ?? "", over: node.scrollHeight - node.clientHeight };
      }
      node = node.parentElement;
    }
    return null;
  })();
  const barRect = bar.getBoundingClientRect();
  const headRect = header.getBoundingClientRect();
  const rowsClippedByChrome = rows.filter((n) => {
    const r = n.getBoundingClientRect();
    return r.top < headRect.bottom - 1 || r.bottom > barRect.top + 1;
  }).length;
  return {
    visibleRows: rows.length,
    conversationAttr: panel.dataset.aiConversation ?? null,
    restoredTextPresent: (log.textContent ?? "").includes("마을 입구에서"),
    logVisible: log.getBoundingClientRect().height > 0,
    scrollOwner,
    rowsClippedByChrome,
    composerInViewport: barRect.bottom <= window.innerHeight + 1,
    logOverflowX: log.scrollWidth - log.clientWidth,
    panelOverflowX: panel.scrollWidth - panel.clientWidth,
  };
});
await shot("long-conversation");

const report = { label, base: BASE, measure, narrow, longConv, consoleErrors };
const file = path.join(OUT, `${label}-measure.json`);
await writeFile(file, JSON.stringify(report, null, 2));
console.log("measure", file);
console.log(JSON.stringify({ panel: measure.panel, header: measure.header, body: measure.body, composer: measure.composer, emptyBlocks: measure.emptyBlocks, narrow, longConv, consoleErrors }, null, 2));
await browser.close();
