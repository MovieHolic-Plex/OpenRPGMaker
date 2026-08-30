#!/usr/bin/env node
// "데이터베이스에서 이미지가 안 보인다" 전용 추적기.
//
// 왜 별도 스크립트인가: db-ux-probe.mjs 는 `.database-modal-backdrop` 안만 잰다. 그런데
// 실제 이미지 탐색 표면인 **리소스 선택 다이얼로그**는 자체 backdrop 으로 뜰 수 있어
// 그 스코프에 안 잡힌다. 갤러리 뷰 카드 썸네일도 목록 뷰 기본 경로에서는 렌더되지 않는다.
// 그래서 이 스크립트는 document 전체를 재고, 이미지가 실제로 뜨는 상호작용 경로를 직접 밟는다.
//
// 사용: HUNT_BASE=http://127.0.0.1:9873/ HUNT_OUT=verify-shots/db-ux/imagehunt \
//         node scripts/qa/db-image-hunt.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.HUNT_BASE ?? "http://127.0.0.1:9873/";
const OUT = process.env.HUNT_OUT ?? "verify-shots/db-ux/imagehunt";
const UI_MODE = process.env.HUNT_UI_MODE ?? "expert";
mkdirSync(OUT, { recursive: true });

/** document 전체에서 이미지 표면을 잰다. hidden 조상은 버그가 아니므로 분류해 뺀다. */
const MEASURE_DOC = () => {
  const hiddenAncestor = (node) => {
    let cur = node;
    while (cur && cur !== document.documentElement) {
      if (cur instanceof HTMLElement) {
        const cs = getComputedStyle(cur);
        if (cs.display === "none") return `display:none@${String(cur.className || cur.tagName).split(" ")[0]}`;
        if (cs.visibility === "hidden") return `visibility:hidden@${String(cur.className || cur.tagName).split(" ")[0]}`;
        if (cur.hasAttribute("hidden")) return `[hidden]@${String(cur.className || cur.tagName).split(" ")[0]}`;
      }
      cur = cur.parentElement;
    }
    return null;
  };
  const broken = [], zero = [], hidden = [], bgZero = [], bgHidden = [];
  for (const node of document.querySelectorAll("img")) {
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const e = {
      src: (node.currentSrc || node.src || "").slice(-110), cls: String(node.className || "(none)").slice(0, 60),
      w: Math.round(r.width), h: Math.round(r.height), cssW: cs.width, cssH: cs.height,
      nat: node.naturalWidth, complete: node.complete,
    };
    if (node.complete && node.naturalWidth === 0) broken.push(e);
    else if (r.width < 1 || r.height < 1) { const hid = hiddenAncestor(node); if (hid) hidden.push({ ...e, hiddenBy: hid }); else zero.push(e); }
  }
  for (const node of document.querySelectorAll("*")) {
    const cs = getComputedStyle(node);
    const bg = cs.backgroundImage;
    if (!bg || bg === "none" || !bg.includes("url(")) continue;
    const url = bg.slice(bg.indexOf("url(") + 4).replace(/^["']/, "").replace(/["']\)?.*$/, "");
    if (!url || url.startsWith("data:")) continue;
    const r = node.getBoundingClientRect();
    const e = { url: url.slice(-110), cls: String(node.className || "(none)").slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), cssW: cs.width, cssH: cs.height };
    if (r.width < 1 || r.height < 1) { const hid = hiddenAncestor(node); if (hid) bgHidden.push({ ...e, hiddenBy: hid }); else bgZero.push(e); }
  }
  return { broken, zero, hidden: hidden.length, bgZero, bgHidden: bgHidden.length,
    imgTotal: document.querySelectorAll("img").length };
};

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
const netFail = [];
page.on("requestfailed", (r) => { if (/\.(png|jpe?g|gif|webp|svg)/i.test(r.url())) netFail.push({ url: r.url().slice(-120), err: r.failure()?.errorText }); });
page.on("response", (r) => { if (r.status() >= 400 && /\.(png|jpe?g|gif|webp|svg)/i.test(r.url())) netFail.push({ url: r.url().slice(-120), err: `HTTP ${r.status()}` }); });

await page.addInitScript((m) => localStorage.setItem("oprn:editor-ui-mode", m), UI_MODE);
for (let a = 1; a <= 5; a += 1) {
  try {
    await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
    await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
    break;
  } catch (e) { if (a === 5) throw e; await page.waitForTimeout(1500); }
}
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.waitForTimeout(700);

const findings = {};
const record = async (name, note = "") => {
  await page.waitForTimeout(450);
  const m = await page.evaluate(MEASURE_DOC);
  // 스크린샷은 증거일 뿐 판정 근거가 아니다. 편집기에는 상시 애니메이션이 있어 기본 대기
  // 정책이 60s 를 넘겨 스윕 전체를 죽인 사례가 있었다(실측). 애니메이션을 멈추고 짧게 끊고,
  // 실패해도 계측은 살린다 — 한 표면의 스크린샷 실패로 29개 표면의 측정을 잃지 않는다.
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled", timeout: 15_000 });
  } catch (err) {
    console.log(`      (screenshot skipped for ${name}: ${String(err).slice(0, 70)})`);
  }
  findings[name] = { note, ...m };
  const bad = m.broken.length + m.zero.length + m.bgZero.length;
  console.log(`${bad > 0 ? "BAD " : "ok  "}${name.padEnd(34)} imgs=${m.imgTotal} broken=${m.broken.length} zero=${m.zero.length} bgZero=${m.bgZero.length} (hidden ${m.hidden}/${m.bgHidden})`);
  for (const e of m.broken.slice(0, 5)) console.log(`      BROKEN cls=${e.cls} css=${e.cssW}x${e.cssH} nat=${e.nat} src=...${e.src.slice(-46)}`);
  for (const e of m.zero.slice(0, 5)) console.log(`      ZERO   cls=${e.cls} css=${e.cssW}x${e.cssH} nat=${e.nat} src=...${e.src.slice(-46)}`);
  for (const e of m.bgZero.slice(0, 5)) console.log(`      BGZERO cls=${e.cls} css=${e.cssW}x${e.cssH} url=...${e.url.slice(-46)}`);
};

const clickTab = async (slug) => {
  const ok = await page.evaluate((s) => {
    const n = document.querySelector(`[data-testid="db-tab-${s}"]`);
    if (!(n instanceof HTMLElement)) return false;
    n.scrollIntoView({ block: "nearest" }); n.click(); return true;
  }, slug);
  if (!ok) console.log(`(tab ${slug} missing)`);
  await page.waitForTimeout(600);
  return ok;
};

/** 라벨 텍스트로 버튼을 눌러본다. 없으면 조용히 넘어간다. */
const clickText = async (label, scope = "body") => {
  const ok = await page.evaluate(([lab, sc]) => {
    const root = document.querySelector(sc) ?? document.body;
    for (const n of root.querySelectorAll("button, [role=button], summary, label")) {
      if (n instanceof HTMLElement && n.textContent.trim().includes(lab)) { n.scrollIntoView({ block: "nearest" }); n.click(); return true; }
    }
    return false;
  }, [label, scope]);
  await page.waitForTimeout(500);
  return ok;
};

// ── 1. 갤러리 뷰: 카드 썸네일 경로 (목록 기본 경로에서는 렌더되지 않는다) ──
for (const slug of ["items", "actors", "equipment", "skills", "enemies", "characters"]) {
  if (!(await clickTab(slug))) continue;
  await record(`${slug}-list`, "목록 뷰 기본");
  if (await clickText("갤러리")) await record(`${slug}-gallery`, "갤러리 뷰 카드 썸네일");
  if (await clickText("목록")) { /* 원복 */ }
}

// ── 2. 리소스 선택 다이얼로그: 실제 이미지 브라우징 표면 ──
await clickTab("items");
const opened = await page.evaluate(() => {
  // 아이템 검사 열의 이미지/아이콘 설정 버튼.
  const btns = Array.from(document.querySelectorAll(".database-modal-window button"))
    .filter((b) => b instanceof HTMLElement && /설정|변경|선택/.test(b.textContent ?? ""));
  if (btns.length === 0) return false;
  btns[0].scrollIntoView({ block: "nearest" });
  btns[0].click();
  return true;
});
if (opened) { await page.waitForTimeout(900); await record("resource-picker-dialog", "리소스 선택 다이얼로그"); }
else console.log("(resource picker button not found)");

// ── 3. 배우 외형 섹션: charset/faceset 크롭 경로 ──
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(400);
await clickTab("actors");
if (await clickText("외형")) await record("actors-appearance", "배우 외형 섹션 charset/faceset");

// ── 4. 시스템 탭 섹션 전수 ──
await clickTab("system");
const sysNav = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid^="db-system-nav-"]')).map((n) => n.dataset.testid));
for (const id of sysNav) {
  await page.evaluate((i) => { const n = document.querySelector(`[data-testid="${i}"]`); if (n instanceof HTMLElement) n.click(); }, id);
  await record(`system-${id.replace("db-system-nav-", "")}`, "시스템 섹션");
}

writeFileSync(`${OUT}/hunt.json`, JSON.stringify({ at: new Date().toISOString(), base: BASE, uiMode: UI_MODE, netFail, findings }, null, 2));
const totals = Object.values(findings).reduce((a, f) => ({
  broken: a.broken + f.broken.length, zero: a.zero + f.zero.length, bgZero: a.bgZero + f.bgZero.length,
}), { broken: 0, zero: 0, bgZero: 0 });
console.log("\n=== HUNT TOTALS ===");
console.log(JSON.stringify({ ...totals, netFail: netFail.length, surfaces: Object.keys(findings).length }, null, 2));
console.log(`report: ${OUT}/hunt.json`);
await page.close();
await browser.close();
