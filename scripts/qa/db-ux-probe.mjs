#!/usr/bin/env node
// 데이터베이스 모달 UI/UX 계측 하네스 — 29탭을 순회하며 4축을 한 번에 측정한다.
//
// 왜 하네스인가: PR #194 가 line-height 잘림을 "눈으로 골라 고치다" 5번 틀린 기록이 있다
// (docs/2026-08-29-database-uiux-brainstorm.md §3-A). 잘림은 부모-자식이 아니라 요소
// 자신의 overflow 안에서 일어나므로 스크린샷으로는 판정이 안 된다. 계산된 line box 대
// 글리프 잉크를 코드로 물어봐야 한다.
//
// 측정 4축:
//   1. native  — select/number/checkbox/radio/range/details 가 OS 위젯 외형인지
//   2. images  — <img> 와 background-image 가 실제로 그려지는지 (naturalWidth/HTTP/0px)
//   3. text    — 요소 자신의 overflow 가 자기 글리프를 깎는지 + 11px 미만 노드
//   4. space   — 탭별 헤더 비용과 가용 작업 영역 높이
//
// 사용:
//   PROBE_BASE=http://127.0.0.1:9873/ PROBE_OUT=verify-shots/db-ux/before \
//     node scripts/qa/db-ux-probe.mjs
//   PROBE_ONLY=actors,items node scripts/qa/db-ux-probe.mjs   # 일부 탭만
//   PROBE_SHOTS=0 ... # 스크린샷 생략 (측정만)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:9873/";
const OUT = process.env.PROBE_OUT ?? "verify-shots/db-ux/probe";
const UI_MODE = process.env.PROBE_UI_MODE ?? "expert";
const ONLY = process.env.PROBE_ONLY ? process.env.PROBE_ONLY.split(",") : null;
const WIDTH = Number(process.env.PROBE_W ?? 1680);
const HEIGHT = Number(process.env.PROBE_H ?? 1050);
const SHOTS = process.env.PROBE_SHOTS !== "0";
// 탭 상태만 재는 것으로는 부족하다: 배우 탭의 `외형`, 시스템 탭의 섹션 내보가 모든
// 이미지 표면을 숨기고 있어서(상위 진입 직후 display:none) 상위만 찍으면 "이미지 이상 0건" 이라는
// 거짃 신탁이 나은다. PROBE_SUBNAV=1 은 탭마다 하위 네뱄게이션을 전수 순회해 각 섹션을 열어 재계산한다.
const SUBNAV = process.env.PROBE_SUBNAV === "1";

// 정본은 소스 레지스트리다. 2026-08-30 실측: `residents` 는 존재하지 않고 `factions`·`tilesets`
// 가 존재한다(`src/editor/panels/database.ts:36` DatabaseTab 유니온). 목록을 틀리면
// "탭 없음" 오류가 개선 지표를 오염시킨다.
const TABS = [
  "overview", "actors", "classes", "skills", "items", "equipment",
  "enemies", "monster-species", "troops", "elements", "states", "animations",
  "battle-screen", "battle-commands", "terrain", "tilesets", "crops", "characters",
  "life-crafting", "life-collections", "farm-animals", "farm-spatial",
  "daily-weather", "factions", "structure-kits", "common-events",
  "switches", "variables", "terms", "system",
  "tileset-autotile", "tileset-unlabeled", "world-canon", "world-codex",
  "world-gen", "tileset-spaces", "scratch-concepts", "villages",
];

mkdirSync(OUT, { recursive: true });

async function bootEditor(target) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await gotoWithRetry(target, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
      await target.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
      return;
    } catch (err) {
      lastError = err;
      console.log(`boot attempt ${attempt} failed: ${String(err).slice(0, 110)}`);
      await target.waitForTimeout(1500);
    }
  }
  throw lastError;
}

/** 페이지 안에서 도는 측정 본체. 반환값은 순수 데이터만. */
const MEASURE = () => {
  const root = document.querySelector(".database-modal-backdrop");
  if (!(root instanceof HTMLElement)) return null;
  const body = root.querySelector(".database-modal-body .db-body");

  const visible = (node) => {
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // ---- 1. native controls ------------------------------------------------
  const native = { select: [], number: [], check: [], range: [], details: [] };
  for (const node of root.querySelectorAll("select")) {
    const cs = getComputedStyle(node);
    if (cs.appearance !== "none" && cs.webkitAppearance !== "none") {
      native.select.push({ cls: node.className || "(none)", appearance: cs.appearance, testid: node.dataset.testid ?? null });
    }
  }
  for (const node of root.querySelectorAll('input[type="number"]')) {
    const cs = getComputedStyle(node);
    // 스피너를 지우는 정본은 appearance:textfield / -moz-appearance:textfield.
    if (cs.appearance !== "textfield" && cs.appearance !== "none") {
      native.number.push({ cls: node.className || "(none)", appearance: cs.appearance, testid: node.dataset.testid ?? null });
    }
  }
  for (const node of root.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    const cs = getComputedStyle(node);
    if (cs.appearance !== "none" && !cs.accentColor) {
      native.check.push({ type: node.type, cls: node.className || "(none)" });
    }
  }
  for (const node of root.querySelectorAll('input[type="range"]')) {
    const cs = getComputedStyle(node);
    if (cs.appearance !== "none") native.range.push({ cls: node.className || "(none)", appearance: cs.appearance });
  }
  for (const node of root.querySelectorAll("details > summary")) {
    const cs = getComputedStyle(node);
    if (cs.listStyleType !== "none" && cs.display !== "flex" && cs.display !== "block") {
      native.details.push({ cls: node.className || "(none)", display: cs.display, listStyleType: cs.listStyleType });
    }
  }

  // ---- 2. images --------------------------------------------------------
  // 0px 상자는 두 종류다: (a) 비활성 섹션 안에 있어서 안 그려지는 것 = 버그 아님,
  // (b) 실제로 보이는 자리에서 크기가 0 으로 접힌 것 = 사용자가 말한 "이미지가 안 보인다".
  // 둘을 섞으면 버그 아닌 것을 고치게 되므로 은닉 조상을 찾아 분류한다.
  const hiddenAncestor = (node) => {
    let cur = node;
    while (cur && cur !== document.documentElement) {
      if (cur instanceof HTMLElement) {
        const cs = getComputedStyle(cur);
        if (cs.display === "none") return { why: "display:none", cls: cur.className || cur.tagName.toLowerCase() };
        if (cs.visibility === "hidden") return { why: "visibility:hidden", cls: cur.className || cur.tagName.toLowerCase() };
        if (cs.contentVisibility === "hidden") return { why: "content-visibility:hidden", cls: cur.className || cur.tagName.toLowerCase() };
        if (cur.hasAttribute("hidden")) return { why: "[hidden]", cls: cur.className || cur.tagName.toLowerCase() };
        if (cur.getAttribute("aria-hidden") === "true") return { why: "aria-hidden", cls: cur.className || cur.tagName.toLowerCase() };
      }
      cur = cur.parentElement;
    }
    return null;
  };
  const images = { imgBroken: [], imgZero: [], imgHidden: [], bgUrls: [], bgZero: [], bgHidden: [] };
  for (const node of root.querySelectorAll("img")) {
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const entry = {
      src: (node.currentSrc || node.src || "").slice(-120),
      cls: node.className || "(none)",
      alt: node.alt || null,
      w: Math.round(r.width), h: Math.round(r.height),
      cssW: cs.width, cssH: cs.height,
      naturalWidth: node.naturalWidth, complete: node.complete,
    };
    if (node.complete && node.naturalWidth === 0) images.imgBroken.push(entry);
    else if (r.width < 1 || r.height < 1) {
      const hid = hiddenAncestor(node);
      if (hid) images.imgHidden.push({ ...entry, hiddenBy: `${hid.why}@${String(hid.cls).split(" ")[0]}` });
      else images.imgZero.push(entry);
    }
  }
  for (const node of root.querySelectorAll("*")) {
    const cs = getComputedStyle(node);
    const bg = cs.backgroundImage;
    if (!bg || bg === "none" || !bg.includes("url(")) continue;
    const url = bg.slice(bg.indexOf("url(") + 4).replace(/^["']/, "").replace(/["']\)?.*$/, "");
    if (!url || url.startsWith("data:")) continue;
    const r = node.getBoundingClientRect();
    const entry = { url: url.slice(-120), cls: node.className || "(none)", w: Math.round(r.width), h: Math.round(r.height), cssW: cs.width, cssH: cs.height };
    images.bgUrls.push(entry);
    if (r.width < 1 || r.height < 1) {
      const hid = hiddenAncestor(node);
      if (hid) images.bgHidden.push({ ...entry, hiddenBy: `${hid.why}@${String(hid.cls).split(" ")[0]}` });
      else images.bgZero.push(entry);
    }
  }

  // ---- 3. text: 요소 자신의 클리핑 + 작은 폰트 ---------------------------
  // 진단 기준선(docs/2026-08-29-database-uiux-brainstorm.md)이 "11px 미만" 을 셌고
  // verify-shots/db-ux/before/probe.json 도 그 기준으로 366 을 기록했다. 비교 가능성을 지키려면
  // 같은 문턱을 써야 한다 — 11.5 로 올리면 11px 선언 726건이 새로 걸려 before/after 가 다른 자를
  // 쓰게 된다. 실측: 11.5 문턱에서 걸리는 726건은 전부 정확히 11px 이고 11px 미만은 0건이다.
  const TINY_FLOOR = 11;
  const text = { selfClipped: [], tinyFont: [], lowLineHeight: [], tinyPseudo: [] };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    if (node instanceof HTMLElement && visible(node)) {
      const label = `${node.tagName.toLowerCase()}.${String(node.className || "").split(" ")[0]}`;
      // 가상 요소의 content 는 자식 텍스트 노드가 아니라서 아래 ownText 검사에 절대 걸리지
      // 않는다. 그런데 실제로는 글자가 그려진다 — 이미지 실패 문구가 대표적이다.
      // 재지 않으면 tinyFont 0 이 "작은 글자가 없다" 가 아니라 "안 봤다" 가 된다.
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(node, pseudo);
        const raw = ps.content;
        if (!raw || raw === "none" || raw === "normal") continue;
        const shown = raw.startsWith('"') && raw.length > 2 ? raw.slice(1, -1) : "";
        if (!shown.trim()) continue;
        const pfs = parseFloat(ps.fontSize);
        if (pfs > 0 && pfs < TINY_FLOOR) {
          text.tinyPseudo.push({ el: `${label}${pseudo}`, fs: pfs, sample: shown.slice(0, 20) });
        }
      }
      // 자체 텍스트를 가진 요소만
      const ownText = Array.from(node.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim().length > 0);
      if (ownText) {
        const cs = getComputedStyle(node);
        const fs = parseFloat(cs.fontSize);
        const lh = cs.lineHeight === "normal" ? fs * 1.2 : parseFloat(cs.lineHeight);
        const ratio = fs > 0 ? lh / fs : 0;
        const clipsSelf = cs.overflowY === "hidden" || cs.overflowY === "clip";
        // 요소 자신이 클립하는데 콘텐츠가 상자를 넘는다 → 글리프가 깎인다
        if (clipsSelf && node.scrollHeight > node.clientHeight + 1) {
          text.selfClipped.push({ el: label, over: node.scrollHeight - node.clientHeight, fs, lh, sample: node.textContent.trim().slice(0, 24) });
        }
        if (fs < TINY_FLOOR) text.tinyFont.push({ el: label, fs, sample: node.textContent.trim().slice(0, 18) });
        if (ratio > 0 && ratio < 1.2) text.lowLineHeight.push({ el: label, fs, lh, ratio: Number(ratio.toFixed(3)) });
      }
    }
    node = walker.nextNode();
  }

  // ---- 4. space --------------------------------------------------------
  const headerSel = [
    ".db-battle-studio-heading", ".db-record-intro", ".db-life-header", ".db-life-panel",
    ".db-overview-hero", ".db-ws-hero", ".db-tab-note", ".db-collection-gate-warn",
  ];
  const headers = [];
  for (const sel of headerSel) {
    for (const n of root.querySelectorAll(sel)) {
      const r = n.getBoundingClientRect();
      if (r.height > 0) headers.push({ sel, h: Number(r.height.toFixed(1)) });
    }
  }
  const bodyRect = body instanceof HTMLElement ? body.getBoundingClientRect() : null;
  const ws = root.querySelector(".db-shared-workspace, .db-body");
  const wsRect = ws instanceof HTMLElement ? ws.getBoundingClientRect() : null;
  const win = root.querySelector(".database-modal-window");
  const winRect = win instanceof HTMLElement ? win.getBoundingClientRect() : null;

  return {
    native: {
      selectUnskinned: native.select.length,
      numberUnskinned: native.number.length,
      checkUnskinned: native.check.length,
      rangeUnskinned: native.range.length,
      detailsMarker: native.details.length,
      samples: {
        select: native.select.slice(0, 6),
        number: native.number.slice(0, 4),
        details: native.details.slice(0, 4),
      },
    },
    images: {
      imgBroken: images.imgBroken.length,
      imgZero: images.imgZero.length,
      imgHidden: images.imgHidden.length,
      bgTotal: images.bgUrls.length,
      bgZero: images.bgZero.length,
      bgHidden: images.bgHidden.length,
      brokenSamples: images.imgBroken.slice(0, 8),
      zeroSamples: images.imgZero.slice(0, 8),
      hiddenSamples: images.imgHidden.slice(0, 8),
      bgZeroSamples: images.bgZero.slice(0, 8),
      bgHiddenSamples: images.bgHidden.slice(0, 8),
      bgUrlList: images.bgUrls.slice(0, 40).map((e) => e.url),
    },
    text: {
      selfClipped: text.selfClipped.length,
      tinyFont: text.tinyFont.length,
      tinyPseudo: text.tinyPseudo.length,
      pseudoSamples: Object.entries(
        text.tinyPseudo.reduce((acc, e) => { const k = `${e.el}@${e.fs}px "${e.sample}"`; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})
      ).slice(0, 6),
      lowLineHeight: text.lowLineHeight.length,
      clipSamples: text.selfClipped.slice(0, 10),
      tinySamples: Object.entries(
        text.tinyFont.reduce((acc, e) => { const k = `${e.el}@${e.fs}px`; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})
      ).sort((a, b) => b[1] - a[1]).slice(0, 10),
      lhSamples: Object.entries(
        text.lowLineHeight.reduce((acc, e) => { const k = `${e.el}@${e.ratio}`; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})
      ).sort((a, b) => b[1] - a[1]).slice(0, 10),
    },
    space: {
      headers,
      headerTotal: Number(headers.reduce((s, h) => s + h.h, 0).toFixed(1)),
      bodyH: bodyRect ? Number(bodyRect.height.toFixed(1)) : null,
      workspaceH: wsRect ? Number(wsRect.height.toFixed(1)) : null,
      windowW: winRect ? Number(winRect.width.toFixed(1)) : null,
      windowH: winRect ? Number(winRect.height.toFixed(1)) : null,
      windowLeft: winRect ? Number(winRect.left.toFixed(1)) : null,
    },
  };
};

/** background-image / img URL 이 실제로 200 인지 네트워크로 확인한다. */
async function checkUrls(page, urls) {
  const unique = [...new Set(urls)].slice(0, 120);
  if (unique.length === 0) return [];
  return page.evaluate(async (list) => {
    const out = [];
    for (const u of list) {
      try {
        const res = await fetch(u, { method: "GET" });
        if (!res.ok) out.push({ url: u.slice(-120), status: res.status });
      } catch (err) {
        out.push({ url: u.slice(-120), status: `fetch-error: ${String(err).slice(0, 60)}` });
      }
    }
    return out;
  }, unique);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message.slice(0, 200)));
const failedRequests = [];
page.on("requestfailed", (req) => {
  const u = req.url();
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) failedRequests.push({ url: u.slice(-140), err: req.failure()?.errorText ?? "?" });
});
page.on("response", (res) => {
  const u = res.url();
  if (res.status() >= 400 && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) failedRequests.push({ url: u.slice(-140), err: `HTTP ${res.status()}` });
});

await page.addInitScript((mode) => localStorage.setItem("oprn:editor-ui-mode", mode), UI_MODE);
await bootEditor(page);
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.waitForTimeout(800);

const report = { base: BASE, uiMode: UI_MODE, viewport: { WIDTH, HEIGHT }, at: new Date().toISOString(), tabs: {} };
for (const slug of TABS) {
  if (ONLY && !ONLY.includes(slug)) continue;
  try {
    const clicked = await page.evaluate((id) => {
      const node = document.querySelector(`[data-testid="db-tab-${id}"]`);
      if (!(node instanceof HTMLElement)) return false;
      node.scrollIntoView({ block: "nearest" });
      node.click();
      return true;
    }, slug);
    if (!clicked) throw new Error(`tab button not found: db-tab-${slug}`);
    await page.waitForTimeout(650);
    if (SHOTS) await page.screenshot({ path: `${OUT}/${slug}.png` });
    const m = await page.evaluate(MEASURE);
    if (!m) throw new Error("database backdrop not found");
    m.badUrls = await checkUrls(page, m.images.bgUrlList);
    delete m.images.bgUrlList;
    report.tabs[slug] = m;
    console.log(
      `ok  ${slug.padEnd(18)} sel=${m.native.selectUnskinned} num=${m.native.numberUnskinned} det=${m.native.detailsMarker}` +
      ` | imgBroken=${m.images.imgBroken} imgZero=${m.images.imgZero} bgZero=${m.images.bgZero} hidden=${m.images.imgHidden + m.images.bgHidden} badUrl=${m.badUrls.length}` +
      ` | clip=${m.text.selfClipped} tiny=${m.text.tinyFont} pseudo=${m.text.tinyPseudo} lh=${m.text.lowLineHeight}` +
      ` | hdr=${m.space.headerTotal} ws=${m.space.workspaceH}`
    );

    if (SUBNAV) {
      // 하위 네뱄 후보: 실제로 이 레포지토리에 있는 섹션 전환 계약들.
      const subs = await page.evaluate(() => {
        const body = document.querySelector(".database-modal-body .db-body");
        if (!(body instanceof HTMLElement)) return [];
        const seen = new Set();
        const out = [];
        const cands = body.querySelectorAll(
          '[data-testid^="db-actor-tab-"], [data-testid^="db-system-nav-"], [role="tab"],' +
          ' .db-battle-studio-nav button, .db-life-crafting-rail button, .db-system-section-nav'
        );
        for (const n of cands) {
          if (!(n instanceof HTMLElement)) continue;
          const key = n.dataset.testid || `${n.className}:${n.textContent.trim().slice(0, 12)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(key);
        }
        return out;
      });
      const subReports = {};
      for (const key of subs) {
        const ok = await page.evaluate((k) => {
          const body = document.querySelector(".database-modal-body .db-body");
          if (!(body instanceof HTMLElement)) return false;
          const nodes = body.querySelectorAll(
            '[data-testid^="db-actor-tab-"], [data-testid^="db-system-nav-"], [role="tab"],' +
            ' .db-battle-studio-nav button, .db-life-crafting-rail button, .db-system-section-nav'
          );
          for (const n of nodes) {
            if (!(n instanceof HTMLElement)) continue;
            const nk = n.dataset.testid || `${n.className}:${n.textContent.trim().slice(0, 12)}`;
            if (nk === k) { n.scrollIntoView({ block: "nearest" }); n.click(); return true; }
          }
          return false;
        }, key);
        if (!ok) continue;
        await page.waitForTimeout(350);
        const sm = await page.evaluate(MEASURE);
        if (!sm) continue;
        const safeKey = key.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
        if (SHOTS) await page.screenshot({ path: `${OUT}/${slug}__${safeKey}.png` });
        subReports[safeKey] = {
          images: { imgBroken: sm.images.imgBroken, imgZero: sm.images.imgZero, bgZero: sm.images.bgZero, zeroSamples: sm.images.zeroSamples, bgZeroSamples: sm.images.bgZeroSamples },
          native: { numberUnskinned: sm.native.numberUnskinned, rangeUnskinned: sm.native.rangeUnskinned, detailsMarker: sm.native.detailsMarker },
          text: { selfClipped: sm.text.selfClipped, tinyFont: sm.text.tinyFont, clipSamples: sm.text.clipSamples },
        };
        if (sm.images.imgZero || sm.images.bgZero || sm.text.selfClipped) {
          console.log(`    sub ${safeKey}: imgZero=${sm.images.imgZero} bgZero=${sm.images.bgZero} clip=${sm.text.selfClipped}`);
        }
      }
      report.tabs[slug].subsections = subReports;
    }
  } catch (err) {
    report.tabs[slug] = { error: String(err).slice(0, 200) };
    console.log(`ERR ${slug}: ${String(err).slice(0, 140)}`);
  }
}

report.failedImageRequests = failedRequests;
report.pageErrors = consoleErrors.slice(0, 20);

const sum = (pick) => Object.values(report.tabs).reduce((s, t) => s + (t?.error ? 0 : pick(t)), 0);
report.totals = {
  selectUnskinned: sum((t) => t.native.selectUnskinned),
  numberUnskinned: sum((t) => t.native.numberUnskinned),
  checkUnskinned: sum((t) => t.native.checkUnskinned),
  rangeUnskinned: sum((t) => t.native.rangeUnskinned),
  detailsMarker: sum((t) => t.native.detailsMarker),
  imgBroken: sum((t) => t.images.imgBroken),
  imgZero: sum((t) => t.images.imgZero),
  imgHidden: sum((t) => t.images.imgHidden),
  bgZero: sum((t) => t.images.bgZero),
  bgHidden: sum((t) => t.images.bgHidden),
  badUrls: sum((t) => t.badUrls.length),
  selfClipped: sum((t) => t.text.selfClipped),
  tinyFont: sum((t) => t.text.tinyFont),
  tinyPseudo: sum((t) => t.text.tinyPseudo),
  lowLineHeight: sum((t) => t.text.lowLineHeight),
  failedImageRequests: failedRequests.length,
  tabsMeasured: Object.values(report.tabs).filter((t) => !t?.error).length,
  tabsErrored: Object.values(report.tabs).filter((t) => t?.error).length,
};
const heights = Object.entries(report.tabs).filter(([, t]) => !t?.error).map(([s, t]) => [s, t.space.workspaceH]);
const hv = heights.map(([, h]) => h).filter((h) => typeof h === "number");
report.totals.workspaceHeightSwing = hv.length ? Number((Math.max(...hv) - Math.min(...hv)).toFixed(1)) : null;
report.workspaceHeights = Object.fromEntries(heights);

// 하위 섹션을 여는 상태에서의 거드 집계 — 여기서 적발리는 것이 상위 상태만 재면 보이지 않는다.
if (SUBNAV) {
  let sZero = 0, sBgZero = 0, sClip = 0, sCount = 0;
  const offenders = [];
  for (const [slug, t] of Object.entries(report.tabs)) {
    for (const [key, s] of Object.entries(t?.subsections ?? {})) {
      sCount += 1;
      sZero += s.images.imgZero; sBgZero += s.images.bgZero; sClip += s.text.selfClipped;
      if (s.images.imgZero || s.images.bgZero || s.text.selfClipped) {
        offenders.push({ tab: slug, sub: key, imgZero: s.images.imgZero, bgZero: s.images.bgZero, selfClipped: s.text.selfClipped,
          zeroSamples: s.images.zeroSamples, bgZeroSamples: s.images.bgZeroSamples, clipSamples: s.text.clipSamples });
      }
    }
  }
  report.totals.subsectionsVisited = sCount;
  report.totals.subImgZero = sZero;
  report.totals.subBgZero = sBgZero;
  report.totals.subSelfClipped = sClip;
  report.subsectionOffenders = offenders;
}

writeFileSync(`${OUT}/probe.json`, JSON.stringify(report, null, 2));
console.log("\n=== TOTALS ===");
console.log(JSON.stringify(report.totals, null, 2));
console.log(`\nreport: ${OUT}/probe.json`);

await page.close();
await browser.close();
