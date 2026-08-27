// Temp hostile-review probe: keyboard/dismiss/duplicate-onboarding behavior of the
// first-run director briefing. Companion to tmp-welcome-adversarial-shots.mjs.
import { chromium } from "playwright";

const URL = "http://localhost:9999/?forceWelcome=1";

async function open(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.removeItem("oprn:editor-welcome-dismissed"); } catch {}
  });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='editor-welcome']", { timeout: 45000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

const browser = await chromium.launch();
const out = {};

// --- desktop behavior ---
{
  const { ctx, page } = await open(browser, { width: 1440, height: 900 });

  out.escape = await (async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    return { overlayStillMounted: await page.locator("[data-testid='editor-welcome']").count() > 0 };
  })();

  out.tabTrap = await (async () => {
    const seen = [];
    for (let i = 0; i < 24; i += 1) {
      await page.keyboard.press("Tab");
      seen.push(await page.evaluate(() => {
        const a = document.activeElement;
        if (!a) return "none";
        const inside = !!a.closest("[data-testid='editor-welcome']");
        return `${inside ? "IN " : "OUT "}${a.tagName}.${(a.className || "").toString().split(" ")[0]}`;
      }));
    }
    return { escapedDialog: seen.some((s) => s.startsWith("OUT")), firstEscapeAt: seen.findIndex((s) => s.startsWith("OUT")), trail: seen };
  })();

  out.scrimClick = await (async () => {
    await page.locator(".editor-welcome-scrim").click({ position: { x: 40, y: 40 } });
    await page.waitForTimeout(300);
    return { overlayStillMounted: await page.locator("[data-testid='editor-welcome']").count() > 0 };
  })();

  out.competingOnboarding = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { visibility: s.visibility, display: s.display, opacity: s.opacity, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    };
    const asking = [...document.querySelectorAll("body *")]
      .filter((e) => e.children.length === 0 && /무엇을 둘까요|어떤 게임을 만들까요|만들 수 있어요|하나를 누르면/.test(e.textContent || ""))
      .map((e) => ({ text: e.textContent.trim().slice(0, 46), cls: (e.className || "").toString().slice(0, 60), vis: vis(e) }));
    return {
      askingPrompts: asking,
      aiChatDock: vis(document.querySelector("[data-testid='ai-chat-panel'], .ai-chat-panel, .ai-dock")),
      aiCommandBar: vis(document.querySelector(".ai-command-bar")),
      bodyClass: document.body.className,
    };
  });

  out.contrastAndTargets = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const ratio = (fg, bg) => { const a = lum(parse(fg)), b = lum(parse(bg)); const hi = Math.max(a, b), lo = Math.min(a, b); return +((hi + 0.05) / (lo + 0.05)).toFixed(2); };
    const pick = (sel) => {
      const e = document.querySelector(sel); if (!e) return null;
      const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      const stageBg = getComputedStyle(document.querySelector(".editor-welcome-stage")).backgroundColor;
      return { sel, color: s.color, fontSize: s.fontSize, target: { w: Math.round(r.width), h: Math.round(r.height) }, contrastVsStage: ratio(s.color, stageBg) };
    };
    const input = document.querySelector(".editor-welcome-prompt-input");
    return {
      skip: pick(".editor-welcome-skip"),
      blurb: pick(".editor-welcome-template-blurb"),
      inspiration: pick(".editor-welcome-card-inspiration"),
      inputBoxShadowWhenBlurred: (() => { input.blur(); return getComputedStyle(input).boxShadow; })(),
      starterLineCount: [...document.querySelectorAll(".editor-welcome-template-starter")].map((e) => {
        const s = getComputedStyle(e); return Math.round(e.scrollHeight / parseFloat(s.lineHeight === "normal" ? "16" : s.lineHeight));
      }),
      starterWraps: [...document.querySelectorAll(".editor-welcome-template-starter")].map((e) => e.getBoundingClientRect().height),
      cardBottomYs: [...document.querySelectorAll(".editor-welcome-template-option")].map((e) => Math.round(e.getBoundingClientRect().bottom)),
      starterTopYs: [...document.querySelectorAll(".editor-welcome-template-starter")].map((e) => Math.round(e.getBoundingClientRect().top)),
    };
  });

  await ctx.close();
}

// --- mobile reachability ---
{
  const { ctx, page } = await open(browser, { width: 390, height: 844 });
  out.mobileReachability = await page.evaluate(async () => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.y), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
    const before = { title: r(".editor-welcome-title"), input: r(".editor-welcome-prompt-input"), stage: r(".editor-welcome-stage") };
    const stage = document.querySelector(".editor-welcome-stage");
    const st = getComputedStyle(stage);
    window.scrollTo(0, 99999);
    stage.scrollTop = 99999;
    document.querySelector(".editor-welcome-briefing").scrollTop = 99999;
    await new Promise((res) => setTimeout(res, 250));
    const after = { title: r(".editor-welcome-title"), input: r(".editor-welcome-prompt-input") };
    return {
      before, after,
      docScrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      pageYOffset: window.scrollY,
      stageOverflowY: st.overflowY,
      briefingOverflowY: getComputedStyle(document.querySelector(".editor-welcome-briefing")).overflowY,
      titleAboveViewport: (r(".editor-welcome-title")?.bottom ?? 0) < 0,
      inputAboveViewport: (r(".editor-welcome-prompt-input")?.bottom ?? 0) < 0,
    };
  });
  out.mobileInputClickable = await (async () => {
    try {
      await page.locator("[data-testid='editor-welcome-prompt-input']").click({ timeout: 3000 });
      return { clickable: true };
    } catch (e) {
      return { clickable: false, err: String(e).split("\n")[0].slice(0, 160) };
    }
  })();
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 1));
