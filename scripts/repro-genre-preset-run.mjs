/**
 * 진단 하네스: 웰컴 장르 프리셋 포스터를 실제로 클릭하고 자율 런이 어디서 죽는지 관측한다.
 * 산출물: output/repro/genre-preset/<preset>/ (스크린샷 + timeline.json + audit.json + state.json)
 *
 * 사용: node scripts/repro-genre-preset-run.mjs [presetId] [--minutes N] [--headed]
 * 기본 presetId=monster-collect
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const presetId = process.argv[2]?.startsWith("--") ? "monster-collect" : (process.argv[2] ?? "monster-collect");
const minutes = Number(process.argv[process.argv.indexOf("--minutes") + 1]) || 6;
const headed = process.argv.includes("--headed");
const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:9310").replace(/\/$/, "");
const OUT = join(process.cwd(), "output", "repro", "genre-preset", presetId);
mkdirSync(OUT, { recursive: true });

const timeline = [];
const mark = (kind, detail) => {
  const entry = { t: Date.now(), kind, detail };
  timeline.push(entry);
  console.log(`[${new Date(entry.t).toISOString().slice(11, 19)}] ${kind}: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`);
};

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

page.on("console", (msg) => {
  const type = msg.type();
  if (type === "error" || type === "warning") mark(`console.${type}`, msg.text().slice(0, 500));
});
page.on("pageerror", (error) => mark("pageerror", String(error).slice(0, 500)));
page.on("requestfailed", (req) => {
  if (/\/v1\/|\/legacyDb|\/auth\//.test(req.url())) mark("requestfailed", `${req.method()} ${req.url()} ${req.failure()?.errorText}`);
});
page.on("response", async (res) => {
  const url = res.url();
  if (!/\/v1\/chat\/completions|\/auth\/|\/legacyDb\/rest/.test(url)) return;
  mark("response", `${res.status()} ${res.request().method()} ${url.replace(BASE, "")}`);
  if (res.status() >= 400) {
    let body = "";
    try { body = (await res.text()).slice(0, 600); } catch { body = "<unreadable>"; }
    mark("response.body", body);
  }
});

// 페이지에 store 전역이 없다. 관측 가능한 것만 쓴다: localStorage 프로젝트 사본 + 맵 트리 DOM.
const projectState = async () => page.evaluate(() => {
  const keys = Object.keys(localStorage);
  const counts = (project) => {
    const maps = Object.values(project.maps ?? {});
    return {
      title: project.meta?.title ?? null,
      genre: project.system?.genre ?? null,
      monsterCollection: project.system?.monsterCollection ?? null,
      battleUiStyle: project.system?.battleUiStyle ?? null,
      mapCount: maps.length,
      eventCount: maps.reduce((sum, m) => sum + (m.events?.length ?? 0), 0),
      encounterMaps: maps.filter((m) => (m.encounterRate ?? 0) > 0 && (m.encounterTable?.length ?? 0) > 0).length,
      monsterSpecies: (project.database?.monsterSpecies ?? []).length,
      troops: (project.database?.troops ?? []).length,
      items: (project.database?.items ?? []).length,
      monsterParty: (project.session?.monsterParty ?? []).length,
    };
  };
  const stored = {};
  for (const key of keys.filter((k) => k.startsWith("oprn:dev-project"))) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      const project = raw?.project ?? raw;
      stored[key] = project && typeof project === "object" ? counts(project) : "<unparsed>";
    } catch (error) { stored[key] = `<parse-error:${String(error).slice(0, 60)}>`; }
  }
  return {
    oprnKeys: keys.filter((k) => k.startsWith("oprn:")),
    stored,
    mapTreeItems: document.querySelectorAll("[data-testid^='map-tree-item'], .map-tree-item, .map-list-item").length,
    topbarTitle: document.querySelector(".topbar-project-title, [data-testid='topbar-project-title']")?.textContent?.trim() ?? null,
    proposalCards: document.querySelectorAll("[data-testid^='ai-proposal'], .ai-proposal-card").length,
  };
});

const harnessSnapshot = async () => page.evaluate(() => {
  const h = window.__oprnAiHarness;
  if (!h) return { available: false };
  const audit = (h.getAudit?.() ?? []).map((a) => ({ kind: a.kind, text: String(a.text ?? "").slice(0, 300) }));
  const snap = h.getHarness?.() ?? null;
  return {
    available: true,
    state: h.getState?.() ?? null,
    auditCount: audit.length,
    audit: audit.slice(-160),
    workPlan: snap?.workPlan ?? snap?.plan ?? null,
    harnessKeys: snap ? Object.keys(snap) : [],
  };
});

const shot = async (name) => {
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
};

try {
  mark("boot", `${BASE}/?forceWelcome=1&freshProject=1`);
  await page.goto(`${BASE}/?forceWelcome=1&freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.evaluate(() => {
    localStorage.removeItem("oprn:editor-welcome-dismissed");
    localStorage.removeItem("oprn:ai-config");
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });

  const welcome = page.getByTestId("editor-welcome");
  try {
    await welcome.waitFor({ state: "visible", timeout: 60_000 });
    mark("welcome", "visible");
  } catch {
    mark("welcome", "NOT VISIBLE");
    await shot("00-no-welcome");
    const dbGate = await page.getByTestId("db-required-panel").count();
    mark("db-required-panel", dbGate);
    throw new Error("welcome-not-visible");
  }
  await shot("01-welcome");
  mark("state.before", await projectState());

  const card = page.locator(`.editor-welcome-template-option[data-preset-id="${presetId}"] .editor-welcome-template-card`);
  const count = await card.count();
  mark("poster", { presetId, count });
  if (count !== 1) throw new Error(`poster-not-found:${count}`);

  await card.click();
  mark("click", "poster clicked");
  await welcome.waitFor({ state: "detached", timeout: 30_000 });
  mark("welcome", "detached");
  await shot("02-after-click");

  // 채팅 입력창에 프롬프트가 들어갔는지 / 턴이 실제로 시작됐는지.
  const composer = page.getByTestId("ai-input").first();
  const inputValue = await composer.inputValue().catch(() => "<no ai-input>");
  mark("composer.value", String(inputValue).slice(0, 300));
  mark("panel.dom", await page.evaluate(() => ({
    aiPanel: document.querySelectorAll(".ai-chat-panel, [data-testid='ai-chat-log']").length,
    settingsModal: document.querySelectorAll("[data-testid='ai-settings-modal'], .ai-settings-modal").length,
    toasts: [...document.querySelectorAll(".toast, [data-testid='toast']")].map((n) => n.textContent?.trim() ?? ""),
    bubbles: [...document.querySelectorAll(".ai-bubble, .ai-chat-log > *")].slice(0, 6).map((n) => (n.textContent ?? "").trim().slice(0, 120)),
  })));

  const deadline = Date.now() + minutes * 60_000;
  let tick = 0;
  let lastAuditCount = -1;
  while (Date.now() < deadline) {
    tick += 1;
    const snap = await harnessSnapshot();
    if (snap.available && snap.auditCount !== lastAuditCount) {
      lastAuditCount = snap.auditCount;
      mark("audit.tail", snap.audit.slice(-6).map((a) => `${a.kind}|${a.text}`));
      mark("harness.state", { state: snap.state, workPlan: snap.workPlan ? "present" : null, keys: snap.harnessKeys });
    } else if (!snap.available && tick % 6 === 1) {
      mark("harness", "window.__oprnAiHarness unavailable");
    }
    if (tick % 6 === 0) {
      mark("state.tick", await projectState());
      await shot(`tick-${String(tick).padStart(3, "0")}`);
    }
    // 상태줄 텍스트(진행 표시) 캡처.
    const status = await page.getByTestId("ai-status").first().textContent().catch(() => null);
    if (status) mark("status", status.trim().slice(0, 160));
    await page.waitForTimeout(5_000);
  }

  mark("state.after", await projectState());
  const finalSnap = await harnessSnapshot();
  writeFileSync(join(OUT, "audit.json"), JSON.stringify(finalSnap, null, 2));
  writeFileSync(join(OUT, "state.json"), JSON.stringify(await projectState(), null, 2));
  await shot("99-final");
} catch (error) {
  mark("fatal", String(error).slice(0, 500));
  await shot("99-fatal").catch(() => {});
  try {
    writeFileSync(join(OUT, "audit.json"), JSON.stringify(await harnessSnapshot(), null, 2));
  } catch { /* ignore */ }
} finally {
  writeFileSync(join(OUT, "timeline.json"), JSON.stringify(timeline, null, 2));
  await browser.close();
  console.log(`\n[repro] evidence → ${OUT}`);
}
