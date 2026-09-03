/**
 * 조수 데크 유리면 대비 게이트 — 실제 합성 스크린샷 픽셀로 WCAG 대비를 잰다.
 *
 * 왜 스크린샷인가: 맵 캔버스는 WebGL 이라 JS 로 뒤 픽셀을 못 읽고, 알파를 손으로 합성하면 backdrop-filter 의
 * blur/saturate 가 빠진다(scripts/analyze-glass-contrast.mjs 와 같은 근거). 여기서는 데크의 글자 요소마다
 * 뷰포트 사각형과 computed color 를 실어 보내고, 같은 PNG 에서 사각형 픽셀을 밝기순 정렬해 75 분위를 배경으로 본다.
 *
 * 사용: BASE=http://127.0.0.1:<포트> node scripts/check-ai-deck-contrast.mjs
 * 출력: docs/2026-09-03-ai-assistant-modern-ui-assets/after/contrast.json (+ contrast-*.png). AA 미달이 있으면 exit 1.
 */
import { chromium } from "@playwright/test";
import Jimp from "jimp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9861";
const OUT = join(process.cwd(), "docs", "2026-09-03-ai-assistant-modern-ui-assets", "after");
mkdirSync(OUT, { recursive: true });

const srgb = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (a, b) => { const [la, lb] = [lum(a), lum(b)]; return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const parseRgb = (value) => { const n = (value ?? "").match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]; return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0]; };

function backgroundOf(img, [x, y, w, h]) {
  const px = [];
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) {
    const ix = Math.round(x + dx), iy = Math.round(y + dy);
    if (ix < 0 || iy < 0 || ix >= img.bitmap.width || iy >= img.bitmap.height) continue;
    const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(ix, iy));
    px.push([r, g, b]);
  }
  if (px.length === 0) return null;
  px.sort((p, q) => lum(p) - lum(q));
  return px[Math.floor(px.length * 0.75)];
}

/** 대비를 잴 글자 요소. 첫 매치 하나만 잰다(같은 스타일이 반복된다). */
const TARGETS = [
  ["레일 이름", ".ai-deck-rail-name"],
  ["레일 맵", ".ai-deck-rail-ctx"],
  ["레일 상태 문장", ".ai-deck-rail-state .ai-assistant-status"],
  ["사용자 말풍선", ".ai-command-row[data-role='user'] > .ai-command-row-body"],
  ["조수 산문", ".ai-command-row[data-role='assistant'] > .ai-command-row-body"],
  ["작업 헤더", ".ai-tool-activity-toggle-text"],
  ["추천 힌트", ".ai-next-steps-hint"],
  ["추천 문장", ".ai-suggest-row-text"],
  ["추천 근거", ".ai-suggest-row-why"],
  ["입력 플레이스홀더", "[data-testid='ai-input']"],
  ["모드 옵션(비선택)", ".ai-composer-mode-option:not(.is-on)"],
  ["모델 칩", ".ai-composer-model"],
  ["컨텍스트 핀", ".ai-context-chip"],
  ["알약 이름", ".ai-collapsed-restore-name"],
];

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.removeItem("oprn:ai-panel-collapsed");
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 4_000 }).catch(() => false)) await guest.click();
    const ok = await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
    if (ok) break;
  }
  for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 20_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(1200);
}

async function seedAndOpen(page) {
  await page.evaluate(async () => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const { store } = await load("/src/project/store.ts");
    const { conversationScopeKey } = await load("/src/ai/conversationStore.ts");
    const contextKey = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    localStorage.setItem("oprn:ai-conversations", JSON.stringify([{
      id: "contrast-fixture", title: "대비 측정", model: "fixture", savedAt: Date.now(), projectContextKey: contextKey,
      entries: [
        { kind: "user", text: "시장 광장 북쪽에 우물을 하나 놓고, 상인 두 명을 광장 주변에 세워줘" },
        { kind: "tool", name: "get_map_region", args: { x: 0, y: 0, w: 60, h: 45 }, ok: true, summary: "시장 마을 60×45" },
        { kind: "tool", name: "stamp_structure", args: { x: 24, y: 11 }, ok: true, summary: "우물 1 · 타일 9칸" },
        { kind: "tool", name: "place_npc", args: { x: 22, y: 14 }, ok: true, summary: "상인 「하나」 (22,14)" },
        { kind: "assistant", text: "광장 북쪽 (24,11) 에 우물을 놓고 상인 둘을 광장 양쪽에 세웠습니다." },
      ],
    }]));
  });
  await page.getByTestId("ai-open-conversations").click();
  await page.getByTestId("ai-history-open").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("ai-history-open").first().click();
  await page.getByTestId("ai-command-row-user").first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function measure(page, name) {
  const path = join(OUT, `contrast-${name}.png`);
  await page.screenshot({ path });
  const nodes = await page.evaluate((targets) => targets.map(([label, selector]) => {
    const node = [...document.querySelectorAll(selector)].find((candidate) => candidate.getClientRects().length > 0);
    if (!node) return { label, missing: true };
    const rect = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const color = node.matches("[data-testid='ai-input']") ? getComputedStyle(node, "::placeholder").color || cs.color : cs.color;
    return { label, rect: [rect.x, rect.y, rect.width, rect.height], color, fontSize: Number.parseFloat(cs.fontSize), fontWeight: cs.fontWeight };
  }), TARGETS);
  const img = await Jimp.read(path);
  const rows = [];
  for (const node of nodes) {
    if (node.missing || node.rect[2] < 4 || node.rect[3] < 4) continue;
    const bg = backgroundOf(img, node.rect);
    if (!bg) continue;
    const ratio = contrast(parseRgb(node.color), bg);
    const bold = Number(node.fontWeight) >= 700;
    const threshold = node.fontSize >= 24 || (node.fontSize >= 18.66 && bold) ? 3 : 4.5;
    rows.push({ label: node.label, color: node.color, bg: `rgb(${bg.join(",")})`, fontSize: node.fontSize, ratio: Number(ratio.toFixed(2)), threshold, pass: ratio >= threshold });
  }
  return { name, shot: `contrast-${name}.png`, rows };
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await boot(page);
const states = [];
await page.getByTestId("ai-input").click();
await page.waitForTimeout(400);
states.push(await measure(page, "focused"));
await page.keyboard.press("Escape");
await seedAndOpen(page);
states.push(await measure(page, "conversation"));
await page.getByTestId("ai-collapse").click();
await page.waitForTimeout(400);
states.push(await measure(page, "collapsed"));
await browser.close();

const failures = states.flatMap((state) => state.rows.filter((row) => !row.pass).map((row) => ({ state: state.name, ...row })));
writeFileSync(join(OUT, "contrast.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), states, failures }, null, 2));
for (const state of states) {
  console.log(`\n[${state.name}]`);
  for (const row of state.rows) console.log(`  ${row.pass ? "ok  " : "FAIL"} ${row.ratio.toFixed(2)}:1  ${row.label}  fg=${row.color} bg=${row.bg} ${row.fontSize}px`);
}
console.log(failures.length === 0 ? "\nAA 미달 0건" : `\nAA 미달 ${failures.length}건`);
process.exit(failures.length === 0 ? 0 : 1);
