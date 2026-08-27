/**
 * ⋯ 오버플로 안에 갇혀 있던 기능 9개가 실제로 도달되는지 하나씩 눌러 확인한다.
 *
 * 왜 별도 스크립트인가: probe-sidebar-contract 는 "버튼과 드롭다운이 보이는가"까지만 본다.
 * 감독 관심사는 "복사·붙여넣기·인스펙터·규칙 감사·작업 기록·붓 크기 1~4 를 쓸 수 있는가"이므로
 * 항목마다 클릭 → 관측 가능한 결과(선택 상태·패널 등장·붓 크기 반영)까지 확인한다.
 *
 * 사용: npx tsx scripts/probe-overflow-features.mts [--port 9814] [--mode standard] [--tag after]
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const PORT = arg("port", "9814");
const MODE = arg("mode", "standard");
const TAG = arg("tag", "after");
const OUT = arg("out", ".omo/evidence/left-sidebar-repair");

async function openOverflow(page: Page): Promise<boolean> {
  const trigger = page.getByTestId("oprn-tool-overflow");
  if (!(await trigger.count())) return false;
  const dd = page.getByTestId("toolbar-overflow-dropdown");
  if (!(await dd.count())) {
    await trigger.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(220);
  }
  return (await dd.count()) > 0;
}

/** 클릭 가능성의 진짜 기준: 그 좌표에서 elementFromPoint 가 그 버튼(또는 그 자손)을 돌려주는가. */
async function hitReachable(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    if (!el) return "absent";
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return "zero-size";
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return "offscreen";
    const hit = document.elementFromPoint(cx, cy);
    if (!hit) return "no-hit";
    return el === hit || el.contains(hit) ? "reachable" : `blocked-by:${(hit as HTMLElement).tagName}.${(hit as HTMLElement).className}`;
  }, testid);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((mode) => {
    localStorage.setItem("oprn:editor-ui-mode", mode as string);
    localStorage.setItem("rpg-zzu:editor-ui-mode", mode as string);
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  }, MODE);
  await page.goto(`http://127.0.0.1:${PORT}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForTimeout(900);

  const features: Record<string, string> = {};
  const opened = await openOverflow(page);
  features["⋯ 열림"] = opened ? "ok" : "FAILED";

  for (const id of ["copy-button", "paste-button", "oprn-tool-inspector", "toolbar-toggle-ruleAudit", "toolbar-toggle-history", "brush-size-1", "brush-size-2", "brush-size-3", "brush-size-4"]) {
    if (!(await openOverflow(page))) { features[id] = "menu-unavailable"; continue; }
    features[id] = await hitReachable(page, id);
  }

  /* 붓 크기는 눌러서 상태가 실제로 바뀌는지까지 본다 — 도달성만으로는 기능 회복을 증명하지 못한다. */
  const brush: Record<string, string> = {};
  for (const size of ["2", "4", "1"]) {
    if (!(await openOverflow(page))) { brush[size] = "menu-unavailable"; continue; }
    await page.getByTestId(`brush-size-${size}`).click({ timeout: 5000 }).catch((e) => { brush[size] = `click-error:${String(e).split("\n")[0]}`; });
    await page.waitForTimeout(300);
    if (!(await openOverflow(page))) { brush[size] = brush[size] ?? "reopen-failed"; continue; }
    brush[size] = await page.evaluate((s) => {
      const btn = document.querySelector(`[data-testid="brush-size-${s}"]`) as HTMLElement | null;
      return btn ? `aria-checked=${btn.getAttribute("aria-checked")}` : "absent";
    }, size);
  }

  /* 인스펙터·기록 패널이 정말 화면에 나오는가. */
  const panels: Record<string, string> = {};
  for (const [id, label] of [["oprn-tool-inspector", "인스펙터"], ["toolbar-toggle-history", "작업 기록"]] as const) {
    if (!(await openOverflow(page))) { panels[label] = "menu-unavailable"; continue; }
    await page.getByTestId(id).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(320);
    panels[label] = await page.evaluate((text) => {
      const dd = document.querySelector('[data-testid="toolbar-overflow-dropdown"]') as HTMLElement | null;
      if (!dd) return "dropdown-gone";
      const r = dd.getBoundingClientRect();
      return `${dd.textContent?.includes(text) ? "section-visible" : "section-missing"} h=${Math.round(r.height)} onscreen=${r.y >= 0 && r.y + r.height <= 900}`;
    }, label);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(180);
  }

  const rect = (sel: string) => page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2) };
  }, sel);
  const geometry = { aiPanel: await rect('[data-testid="ai-panel"]'), leftPanel: await rect(".left-panel") };

  const out = { tag: TAG, mode: MODE, at: new Date().toISOString(), features, brush, panels, geometry };
  const file = join(OUT, `${TAG}-${MODE}-overflow-features.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log(`\nwrote ${file}`);
  await openOverflow(page);
  await page.screenshot({ path: join(OUT, `${TAG}-${MODE}-overflow-open.png`) });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
