// 자료집 → 시스템 → 게임 설정 전수 점검(가벼운 Playwright, vitest 아님).
//   A. 구획마다 모든 컨트롤 목록(라벨·testid·aria·title·잠김·크기)과 넘침을 1280×800·1920×1080 에서 잰다 + 캡처.
//   B. 컨트롤을 하나씩 실제로 바꿔 store 에 들어가는지(저장), serialize→deserialize 뒤에도 남는지(재로드)를 본다.
//   C. 바뀐 system 키를 런타임(src/player·src/runtime) 코드가 읽는지 정적으로 찾는다.
// 사용: DEV_SERVER_PORT=<포트> node scripts/qa/db-system-audit.mjs [outDir]
//   이 머신은 크로미움이 ERR_NETWORK_CHANGED 로 모듈을 끊으므로 `unshare -rn` 격리 netns 에서 dev 서버와 같이 돌린다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9823";
const OUT = process.argv[2] ?? "verify-shots/db-system-audit";
const SKIP_A = process.argv.includes("--persist-only");
const SKIP_B = process.argv.includes("--layout-only");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });

async function openSystem(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, { timeout: 180000, waitUntil: "commit" });
  await page.waitForFunction(() => !!window.__oprnEditorStore, null, { timeout: 180000 });
  page.setDefaultTimeout(15000);
  await page.waitForTimeout(6000); // 새 프로젝트 비동기 로드가 끝나기 전에 모달을 열면 닫힌다.
  await page.evaluate(async () => { (await import("/src/editor/panels/databaseModal.ts")).openDatabaseModal("system"); });
  await page.getByTestId("database-modal").waitFor();
  await page.getByTestId("db-system-section-nav").waitFor();
  return { context, page };
}

const sectionSlugs = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid^="db-system-nav-"]')].map((b) => b.dataset.testid.replace("db-system-nav-", "")));

// A — 목록·넘침
const inventory = {};
for (const viewport of SKIP_A ? [] : [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  const vp = `${viewport.width}x${viewport.height}`;
  const { context, page } = await openSystem(viewport);
  for (const slug of await sectionSlugs(page)) {
    await page.getByTestId(`db-system-nav-${slug}`).click();
    await page.waitForTimeout(350);
    await page.getByTestId("database-modal").screenshot({ path: join(OUT, `${vp}-${slug}.png`) });
    inventory[`${vp}/${slug}`] = await page.evaluate((slug) => {
      const section = document.querySelector(`[data-system-section="${slug}"]`);
      const host = document.querySelector('[data-testid="db-system-sections"]');
      const hostRect = host.getBoundingClientRect();
      const labelOf = (node) => {
        const row = node.closest(".db-field, label, .db-toggle-row, .db-checkbox-field");
        const span = row?.querySelector(":scope > span, :scope > label, .db-field-label");
        return (span?.textContent ?? row?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
      };
      // aria-hidden 인 시험 호환 id 칸(.db-authoring-id)은 사람이 쓰는 컨트롤이 아니다.
      const controls = [...section.querySelectorAll("input, select, textarea, button")].filter((n) => n.offsetParent !== null && n.getAttribute("aria-hidden") !== "true").map((n) => {
        const r = n.getBoundingClientRect();
        return {
          tag: n.tagName.toLowerCase(), type: n.type ?? "", testid: n.dataset.testid ?? n.closest("[data-testid]")?.dataset.testid ?? "",
          ownTestid: !!n.dataset.testid,
          label: n.tagName === "BUTTON" ? n.textContent.trim().replace(/\s+/g, " ").slice(0, 60) : labelOf(n),
          aria: n.getAttribute("aria-label") ?? "", title: n.getAttribute("title") ?? "",
          disabled: n.disabled === true, w: Math.round(r.width), h: Math.round(r.height),
          clippedRight: r.right > hostRect.right + 1, tiny: r.width > 0 && (r.width < 16 || r.height < 14),
        };
      });
      const overflow = [...section.querySelectorAll("*")].filter((n) => n.offsetParent !== null && n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 2 && getComputedStyle(n).overflowX !== "auto" && getComputedStyle(n).overflowX !== "scroll")
        .slice(0, 20).map((n) => `${n.tagName.toLowerCase()}.${[...n.classList].join(".")}[${n.dataset.testid ?? ""}] ${n.scrollWidth}>${n.clientWidth} "${(n.textContent ?? "").trim().slice(0, 40)}"`);
      const english = [...section.querySelectorAll("label, span, p, strong, h2, h3, h4, legend, option, button, summary")]
        .filter((n) => n.offsetParent !== null && n.children.length === 0 && /^[A-Za-z][A-Za-z _/-]{3,}$/.test((n.textContent ?? "").trim()))
        .map((n) => n.textContent.trim()).slice(0, 20);
      return { count: controls.length, controls, overflow, english, hostScrollWidth: host.scrollWidth, hostClientWidth: host.clientWidth };
    }, slug);
  }
  // 탭 버튼 세 계약(textContent·aria-label·title 같음) — 시스템 탭 레일 버튼.
  inventory[`${vp}/tab-button`] = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="db-tab-system"]');
    return b ? { text: b.textContent.trim(), aria: b.getAttribute("aria-label"), title: b.getAttribute("title") } : null;
  });
  await context.close();
}
if (!SKIP_A) writeFileSync(join(OUT, "inventory.json"), JSON.stringify(inventory, null, 1));
console.log("A done");

// B — 저장·재로드
const results = [];
if (!SKIP_B) {
  const { context, page } = await openSystem({ width: 1280, height: 800 });
  await page.evaluate(async () => {
    const io = await import("/src/project/io.ts");
    window.__qaRoundtrip = () => { try { return JSON.stringify(io.deserialize(io.serialize(window.__oprnEditorStore.getCurrent())).system); } catch (error) { return JSON.stringify({ __reloadError: String(error).slice(0, 160) }); } };
    window.__qaSystem = () => JSON.stringify(window.__oprnEditorStore.getCurrent().system);
    window.__qaMeta = () => JSON.stringify(window.__oprnEditorStore.getCurrent().meta);
  });
  let roundBefore = await page.evaluate(() => window.__qaRoundtrip());
  for (const slug of await sectionSlugs(page)) {
    if (slug === "overview") continue;
    console.log("B section", slug);
    await page.getByTestId(`db-system-nav-${slug}`).click();
    await page.waitForTimeout(300);
    const ids = await page.evaluate((slug) => [...new Set([...document.querySelectorAll(`[data-system-section="${slug}"] [data-testid]`)]
      .filter((n) => n.offsetParent !== null && n.matches("input, select, textarea") && !n.disabled && n.getAttribute("aria-hidden") !== "true" && !n.classList.contains("db-authoring-id"))
      .map((n) => n.dataset.testid))], slug);
    for (const testid of ids) {
      const before = await page.evaluate(() => [window.__qaSystem(), window.__qaMeta()]);
      const loc = page.locator(`[data-system-section="${slug}"] [data-testid="${testid}"]`).first();
      if (!(await loc.isVisible().catch(() => false)) || await loc.isDisabled().catch(() => true)) { results.push({ slug, testid, action: "skip-hidden" }); continue; }
      const kind = await loc.evaluate((n) => n.tagName === "SELECT" ? "select" : n.type === "checkbox" ? "checkbox" : n.type === "number" ? "number" : n.type === "color" ? "color" : n.type === "range" ? "range" : n.type === "file" ? "file" : "text");
      let action = kind;
      try {
        if (kind === "select") {
          const next = await loc.evaluate((n) => [...n.options].find((o) => !o.disabled && o.value !== n.value)?.value ?? null);
          if (next === null) { results.push({ slug, testid, action: "select-single" }); continue; }
          await loc.selectOption(next); action = `select→${next}`;
        } else if (kind === "checkbox") { await loc.evaluate((n) => n.click()); }
        else if (kind === "number") {
          // 공용 스테퍼(▲)가 있으면 그것을, 없으면 값 +1 후 change.
          const stepped = await loc.evaluate((n) => { const inc = n.closest(".db-number-stepper, .db-field")?.querySelector(".db-number-stepper-inc"); if (inc && !inc.disabled) { inc.click(); return true; } return false; });
          if (stepped) action = "number+step";
          else { const v = Number(await loc.inputValue()); await loc.fill(String((Number.isFinite(v) ? v : 0) + 1)); await loc.press("Tab"); action = "number+1"; }
        } else if (kind === "range") { await loc.evaluate((n) => { n.value = String(Math.min(Number(n.max || 100), Number(n.value) + Number(n.step || 1) * 3)); n.dispatchEvent(new Event("input", { bubbles: true })); n.dispatchEvent(new Event("change", { bubbles: true })); }); }
        else if (kind === "color") { await loc.evaluate((n) => { n.value = n.value === "#123456" ? "#654321" : "#123456"; n.dispatchEvent(new Event("input", { bubbles: true })); n.dispatchEvent(new Event("change", { bubbles: true })); }); }
        else if (kind === "file") { results.push({ slug, testid, action: "skip-file" }); continue; }
        else { await loc.fill("QA 점검"); await loc.press("Tab"); action = "text"; }
      } catch (error) { results.push({ slug, testid, action, error: String(error).slice(0, 120) }); continue; }
      await page.waitForTimeout(150);
      const [after, afterMeta, round] = await page.evaluate(() => [window.__qaSystem(), window.__qaMeta(), window.__qaRoundtrip()]);
      const diffKeys = (a, b) => { const A = JSON.parse(a), B = JSON.parse(b); return [...new Set([...Object.keys(A), ...Object.keys(B)])].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k])); };
      const changed = diffKeys(before[0], after);
      const metaChanged = diffKeys(before[1], afterMeta);
      const reloadError = JSON.parse(round).__reloadError;
      if (reloadError) { results.push({ slug, testid, action, changed, reloadError }); roundBefore = await page.evaluate(() => window.__qaRoundtrip()); continue; }
      // 재로드 판정: 바뀐 키가 재로드(serialize→deserialize)한 결과에서도 이전 재로드 결과와 달라야 한다.
      const prev = JSON.parse(roundBefore), next = JSON.parse(round);
      const lost = changed.filter((k) => JSON.stringify(prev[k]) === JSON.stringify(next[k]));
      roundBefore = round;
      results.push({ slug, testid, action, changed, metaChanged, lostOnReload: lost });
    }
  }
  await context.close();
}

// C — 런타임이 그 키를 읽나(정적)
const runtimeFiles = [];
const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|js)$/.test(name)) runtimeFiles.push(p); } };
for (const dir of ["src/player", "src/runtime"]) { try { walk(dir); } catch {} }
const runtimeText = runtimeFiles.map((p) => readFileSync(p, "utf8")).join("\n");
for (const r of results) r.runtimeReads = (r.changed ?? []).map((k) => `${k}:${new RegExp(`\\b${k}\\b`).test(runtimeText) ? "yes" : "NO"}`);
writeFileSync(join(OUT, "persistence.json"), JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.error || r.reloadError || (r.changed && r.changed.length === 0 && (!r.metaChanged || r.metaChanged.length === 0)) || (r.lostOnReload && r.lostOnReload.length));
console.log(`B: ${results.length} controls, ${bad.length} suspicious`);
for (const r of bad) console.log(" ", JSON.stringify(r));
await browser.close();
