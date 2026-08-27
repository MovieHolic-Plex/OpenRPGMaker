/**
 * 적대적 UI/UX 리뷰용 실브라우저 캡처 + DOM 계측.
 *
 * 산출물:
 *   verify-shots/uiux-adversarial/*.png  — 화면별 증거
 *   verify-shots/uiux-adversarial/audit.json — 히트영역/대비/절단/접근성 이름 계측
 *
 * 임시 진단 스크립트다. 리뷰가 끝나면 지운다.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/uiux-adversarial";
const BASE = "http://127.0.0.1:9999/";
mkdirSync(OUT, { recursive: true });

const shots = [];
const audits = {};
const notes = [];

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

/** 화면 하나를 찍고 목록에 기록한다. */
async function shot(page, id, caption) {
  const path = `${OUT}/${id}.png`;
  await page.screenshot({ path });
  shots.push({ id, file: `${id}.png`, caption });
  return path;
}

/** dev 서버가 간헐적으로 연결을 거부하므로 재시도를 감싼다(실측: ERR_CONNECTION_REFUSED 1회). */
async function gotoWithRetry(page, url) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      return;
    } catch (error) {
      lastError = error;
      notes.push(`goto 재시도 ${attempt + 1}: ${String(error).slice(0, 80)}`);
      await page.waitForTimeout(4000);
    }
  }
  throw lastError;
}

/** 부팅 → (필요시) 예제 프로젝트 → 코치마크 정리. */
async function boot(page, { skipCoach = true, uiMode = null } = {}) {
  if (uiMode) {
    await page.addInitScript((mode) => {
      try { localStorage.setItem("rpg-zzu:editor-ui-mode", mode); } catch {}
    }, uiMode);
  }
  await gotoWithRetry(page, BASE);
  await page.waitForTimeout(7000);
  const sample = page.locator("[data-testid='load-error-start-sample']");
  const blocked = (await sample.count()) > 0;
  if (blocked) {
    await sample.click();
    await page.waitForFunction(() => document.querySelector("canvas") !== null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(4000);
  }
  if (skipCoach) {
    for (let i = 0; i < 5; i += 1) {
      const skip = page.locator("[data-testid='coach-mark-skip']");
      if (await skip.count()) { await skip.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); } else break;
    }
    await page.waitForTimeout(1500);
  }
  return { blocked };
}

/** 접근성/치수 계측: 히트영역, 대비, 텍스트 절단, 접근 가능한 이름, 뷰포트 이탈. */
const MEASURE = () => {
  const px = (v) => Math.round(v * 10) / 10;
  const lum = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number);
    const a = m[3] === undefined ? 1 : Number(m[3]);
    if (a === 0) return null;
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const effectiveBg = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      const m = bg.match(/[\d.]+/g);
      if (m && (m[3] === undefined || Number(m[3]) > 0.5)) return bg;
      node = node.parentElement;
    }
    return "rgb(255,255,255)";
  };
  const ratio = (fg, bg) => {
    const a = lum(fg); const b = lum(bg);
    if (a === null || b === null) return null;
    const hi = Math.max(a, b); const lo = Math.min(a, b);
    return px((hi + 0.05) / (lo + 0.05));
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const label = (el) =>
    (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim();

  const controls = [...document.querySelectorAll("button, [role=button], a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(visible);

  const smallTargets = controls
    .map((el) => { const r = el.getBoundingClientRect(); return { label: label(el).slice(0, 28), cls: String(el.className).slice(0, 48), w: px(r.width), h: px(r.height), x: px(r.x), y: px(r.y) }; })
    .filter((t) => t.w < 32 || t.h < 32)
    .sort((a, b) => a.w * a.h - b.w * b.h);

  const namelessIconButtons = controls
    .filter((el) => el.tagName === "BUTTON" || el.getAttribute("role") === "button")
    .filter((el) => {
      const text = (el.textContent || "").trim();
      const hasAria = el.getAttribute("aria-label") || el.getAttribute("title");
      // 텍스트가 없거나 기호(2자 이하)뿐이고 aria-label/title 도 없는 버튼
      return !hasAria && (text.length === 0 || (text.length <= 2 && !/[가-힣a-zA-Z0-9]/.test(text)));
    })
    .map((el) => ({ text: (el.textContent || "").trim(), cls: String(el.className).slice(0, 48), rect: (() => { const r = el.getBoundingClientRect(); return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }; })() }));

  const textNodes = [...document.querySelectorAll("button, a, label, span, div, p, h1, h2, h3, h4, li, td, th, summary, option")]
    .filter((el) => visible(el))
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));

  const lowContrast = textNodes
    .map((el) => {
      const s = getComputedStyle(el);
      const cr = ratio(s.color, effectiveBg(el));
      const size = parseFloat(s.fontSize);
      const bold = Number(s.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      return { text: el.textContent.trim().slice(0, 34), cls: String(el.className).slice(0, 44), color: s.color, bg: effectiveBg(el), size: px(size), ratio: cr, need, fail: cr !== null && cr < need };
    })
    .filter((x) => x.fail)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 40);

  const tinyText = textNodes
    .map((el) => ({ text: el.textContent.trim().slice(0, 30), cls: String(el.className).slice(0, 40), size: px(parseFloat(getComputedStyle(el).fontSize)) }))
    .filter((x) => x.size > 0 && x.size < 11)
    .sort((a, b) => a.size - b.size)
    .slice(0, 25);

  const clipped = [...document.querySelectorAll("*")]
    .filter((el) => visible(el) && el.children.length === 0 && (el.textContent || "").trim().length > 1)
    .filter((el) => {
      const s = getComputedStyle(el);
      return el.scrollWidth > el.clientWidth + 1 && (s.overflowX === "hidden" || s.textOverflow === "ellipsis" || s.overflow === "hidden");
    })
    .map((el) => ({ text: el.textContent.trim().slice(0, 34), cls: String(el.className).slice(0, 44), scrollW: el.scrollWidth, clientW: el.clientWidth }))
    .slice(0, 25);

  const offViewport = [...document.querySelectorAll("button, input, [role=button], [class*=panel], [class*=modal], [class*=dialog]")]
    .filter(visible)
    .map((el) => { const r = el.getBoundingClientRect(); return { cls: String(el.className).slice(0, 44), label: label(el).slice(0, 24), right: px(r.right), bottom: px(r.bottom), x: px(r.x), y: px(r.y) }; })
    .filter((x) => x.right > innerWidth + 2 || x.bottom > innerHeight + 2 || x.x < -2 || x.y < -2)
    .slice(0, 25);

  const dupIds = (() => {
    const seen = new Map();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id, n]) => ({ id, n }));
  })();

  const landmarks = {
    main: document.querySelectorAll("main").length,
    nav: document.querySelectorAll("nav").length,
    h1: [...document.querySelectorAll("h1")].map((e) => e.textContent.trim().slice(0, 30)),
    ariaLive: document.querySelectorAll("[aria-live]").length,
    docTitle: document.title,
    lang: document.documentElement.lang || null,
  };

  const bigEmpty = [...document.querySelectorAll("[class*=panel], [class*=log], [class*=list], [class*=body], [class*=host]")]
    .filter(visible)
    .map((el) => { const r = el.getBoundingClientRect(); return { cls: String(el.className).slice(0, 44), w: px(r.width), h: px(r.height), text: (el.textContent || "").trim().length, kids: el.children.length }; })
    .filter((x) => x.h > 220 && x.text === 0)
    .slice(0, 15);

  return {
    viewport: { w: innerWidth, h: innerHeight },
    bodyClass: document.body.className,
    controlCount: controls.length,
    smallTargets: smallTargets.slice(0, 30),
    smallTargetCount: smallTargets.length,
    namelessIconButtons,
    lowContrast,
    lowContrastCount: lowContrast.length,
    tinyText,
    clipped,
    offViewport,
    dupIds,
    landmarks,
    bigEmpty,
  };
};

// ─────────────────────────────────────────────────────────────
// 1) 첫 부팅: 저장본 로드 실패 화면 (개입 없음)
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().replace(/\s+/g, " ").slice(0, 240)); });
  page.on("requestfailed", (r) => consoleErrors.push(`requestfailed ${r.url().slice(0, 90)}`));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await shot(page, "01-boot-load-error", "첫 진입: 저장된 프로젝트 로드 실패 화면(개입 없음)");
  audits.bootError = { ...(await page.evaluate(MEASURE)), consoleErrors: [...new Set(consoleErrors)].slice(0, 12) };
  // 상세 접기 펼침
  const details = page.locator("[data-testid='project-load-error-details']");
  if (await details.count()) {
    await details.first().click().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "02-boot-load-error-details", "로드 실패 상세를 펼친 상태");
  }
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
// 2) 초보 모드 기본값: 코치마크가 뜬 첫 화면
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await boot(page, { skipCoach: false, uiMode: "beginner" });
  await shot(page, "03-beginner-coachmark", "초보 모드 첫 화면: 코치마크가 어시스턴트 인사말을 덮는다");
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
// 3) 초보 모드 작업 화면 + 주요 상호작용
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().replace(/\s+/g, " ").slice(0, 200)); });
  await boot(page, { uiMode: "beginner" });
  await shot(page, "04-beginner-workspace", "초보 모드 작업 화면: AI 패널이 맵 위에 떠 있다");
  audits.beginner = { ...(await page.evaluate(MEASURE)), consoleErrors: [...new Set(consoleErrors)].slice(0, 10) };

  // 키보드 포커스 링 확인
  const focusTrail = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    focusTrail.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 26),
        outline: `${s.outlineStyle} ${s.outlineWidth}`,
        boxShadow: s.boxShadow === "none" ? "none" : "set",
        offscreen: r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight,
      };
    }));
  }
  audits.focusTrail = focusTrail;
  await shot(page, "05-beginner-focus-12tab", "Tab 12회 후 포커스 위치(포커스 링 가시성 확인)");

  // 타일 패널 열기 — 좌측 레일 하단 버튼(aria-label '타일 패널')
  const tileBtn = page.locator("button[aria-label='타일 패널'], button[title='타일 패널']").first();
  if (await tileBtn.count()) { await tileBtn.click().catch(() => {}); await page.waitForTimeout(2500); }
  else notes.push("타일 패널 버튼을 찾지 못했다");
  await shot(page, "06-beginner-tile-panel", "타일 패널을 연 상태");
  audits.tilePanel = await page.evaluate(MEASURE);

  // 맵 패널 열기
  const mapBtn = page.locator("button[aria-label='맵 패널'], button[title='맵 패널']").first();
  if (await mapBtn.count()) { await mapBtn.click().catch(() => {}); await page.waitForTimeout(2000); }
  else notes.push("맵 패널 버튼을 찾지 못했다");
  await shot(page, "07-beginner-map-panel", "타일 패널과 맵 패널을 동시에 연 상태");

  // 메뉴 열기
  for (const [id, name] of [["08-menu-project", "프로젝트"], ["09-menu-tools", "도구"], ["10-menu-help", "도움말"]]) {
    const btn = page.locator(".editor-menubar button, [class*=menubar] button", { hasText: new RegExp(`^${name}$`) }).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(700);
      await shot(page, id, `${name} 메뉴를 펼친 상태`);
      audits[`menu_${name}`] = await page.evaluate(() => {
        const open = document.querySelector("[class*=menu-popover], [class*=menu-dropdown], [role=menu], [class*=menu-list]");
        if (!open) return null;
        const items = [...open.querySelectorAll("button, [role=menuitem]")].map((e) => (e.textContent || "").trim());
        const r = open.getBoundingClientRect();
        return { itemCount: items.length, items: items.slice(0, 40), h: Math.round(r.height), bottom: Math.round(r.bottom), viewportH: innerHeight, overflowsViewport: r.bottom > innerHeight + 2 };
      });
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
// 4) 표준 / 전문가 모드
for (const [id, mode, caption] of [
  ["11-standard-workspace", "standard", "표준 모드 작업 화면"],
  ["12-expert-workspace", "expert", "전문가 모드 작업 화면"],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await boot(page, { uiMode: mode });
  await shot(page, id, caption);
  audits[mode] = await page.evaluate(MEASURE);
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
// 5) 데이터베이스 모달 / 이벤트 편집 / AI 설정
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await boot(page, { uiMode: "expert" });

  const dataBtn = page.locator("[class*=menubar] button, [class*=workspace] button", { hasText: /^데이터$/ }).first();
  const dataFallback = page.locator("button", { hasText: /데이터/ }).first();
  const dataTarget = (await dataBtn.count()) ? dataBtn : ((await dataFallback.count()) ? dataFallback : null);
  if (dataTarget) {
    await dataTarget.click({ timeout: 5000 }).catch((e) => notes.push(`데이터 클릭 실패: ${String(e).slice(0, 70)}`));
    await page.waitForTimeout(4000);
    await shot(page, "13-database-modal", "데이터베이스 모달");
    audits.database = await page.evaluate(MEASURE);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1000);
  } else {
    notes.push("데이터 버튼을 찾지 못했다");
  }

  // 캔버스 이벤트 더블클릭으로 이벤트 편집기 열기
  await gotoWithRetry(page, `${BASE}?classicCapture=2`);
  await page.waitForTimeout(7000);
  const s2 = page.locator("[data-testid='load-error-start-sample']");
  if (await s2.count()) { await s2.click(); await page.waitForTimeout(10000); }
  for (let i = 0; i < 4; i += 1) {
    const skip = page.locator("[data-testid='coach-mark-skip']");
    if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(400); } else break;
  }
  await page.waitForTimeout(2500);
  const modalOpen = await page.locator("[class*=event-editor], [class*=eventEditor]").count();
  if (modalOpen) {
    await shot(page, "14-event-editor", "이벤트 편집기 모달(3페이지 시드)");
    audits.eventEditor = await page.evaluate(MEASURE);
  } else {
    notes.push("이벤트 편집기: classicCapture=2 경로로 모달이 열리지 않았다");
    await shot(page, "14-event-editor", "이벤트 편집기 진입 시도 결과");
  }
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
// 6) AI 설정 모달 + 오프라인 브리지 상태에서 프롬프트 전송
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await boot(page, { uiMode: "beginner" });
  const aiSettings = page.locator("button", { hasText: "AI 설정" }).first();
  if (await aiSettings.count()) {
    await aiSettings.click().catch(() => {});
    await page.waitForTimeout(1800);
    await shot(page, "15-ai-settings", "AI 설정 모달");
    audits.aiSettings = await page.evaluate(MEASURE);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(800);
  }
  const input = page.locator("[data-testid='ai-input']").first();
  if (await input.count()) {
    await input.click().catch(() => {});
    await input.fill("마을 광장에 분수를 놓아줘").catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, "16-ai-prompt-typed", "AI 지시문을 입력한 상태");
    const send = page.locator("[data-testid='ai-send']").first();
    if (await send.count()) { await send.click().catch(() => {}); }
    await page.waitForTimeout(9000);
    await shot(page, "17-ai-offline-result", "브리지 미가동 상태에서 지시를 보낸 결과");
    audits.aiOffline = await page.evaluate(() => {
      const status = document.querySelector("[data-testid='ai-status']");
      const log = document.querySelector("[data-testid='ai-chat-log']");
      return {
        statusText: status ? status.textContent.trim().slice(0, 200) : null,
        logText: log ? log.textContent.replace(/\s+/g, " ").trim().slice(0, 600) : null,
        toastCount: document.querySelectorAll("[class*=toast], [role=alert]").length,
        toastText: [...document.querySelectorAll("[class*=toast], [role=alert]")].map((e) => e.textContent.trim().slice(0, 160)),
      };
    });
  }
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
// 7) 반응형: 좁은 뷰포트
for (const vp of [
  { id: "18-viewport-1280x720", w: 1280, h: 720 },
  { id: "19-viewport-1024x768", w: 1024, h: 768 },
  { id: "20-viewport-768x1024", w: 768, h: 1024 },
  { id: "21-viewport-390x844", w: 390, h: 844 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await boot(page, { uiMode: "beginner" });
  await shot(page, vp.id, `${vp.w}×${vp.h} 뷰포트`);
  audits[vp.id] = await page.evaluate(MEASURE);
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
// 8) 테스트 플레이(런타임)
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await boot(page, { uiMode: "beginner" });
  const test = page.locator("button", { hasText: /테스트/ }).first();
  if (await test.count()) {
    await test.click().catch(() => {});
    await page.waitForTimeout(9000);
    await shot(page, "22-testplay", "테스트 플레이 실행 화면");
    audits.testplay = await page.evaluate(MEASURE);
  }
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/audit.json`, JSON.stringify({ shots, audits, notes }, null, 2));
console.log(JSON.stringify({ shotCount: shots.length, shots: shots.map((s) => s.id), notes }, null, 2));
