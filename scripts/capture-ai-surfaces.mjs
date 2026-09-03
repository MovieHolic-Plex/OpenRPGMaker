// scripts/capture-ai-surfaces.mjs
// 에디터 안 AI 표면 3종의 증거 캡처 — ① 이벤트 편집기 「AI로 명령 만들기」 도크 ② 데이터베이스
// 「AI 어시스턴트」 바 ③ 데이터베이스 「AI로 생성」 대화상자. 같은 스크립트를 기준선 서버와
// 작업 서버에 각각 겨눠 before/after 를 뜬다.
//
//   BASE=http://127.0.0.1:9845 TAG=after REAL=1 node scripts/capture-ai-surfaces.mjs
//   BASE=http://127.0.0.1:9846 TAG=before REAL=1 node scripts/capture-ai-surfaces.mjs
//
// REAL=1 이면 실제 LLM(동반 서비스 OAuth)을 부른다 — 이벤트 초안 1회, DB 바 턴 1회, 레코드 생성
// 1회(그림 없음). ART=1 이면 생성에 그림까지 붙인다(30~80초). WIDTH/HEIGHT 로 뷰포트를 바꾼다.
// 결과: <OUT>/<장면>.png + log.json + SUMMARY.md. 기본 OUT 은 .omo/evidence/ai-surfaces-ux/<TAG>.
//
// 옛 UI(기준선)에도 돈다 — 없는 testid 는 건너뛰고 로그에 남긴다.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:9845";
const TAG = process.env.TAG ?? "after";
const REAL = process.env.REAL === "1";
const ART = process.env.ART === "1";
const WIDTH = Number(process.env.WIDTH ?? 1440);
const HEIGHT = Number(process.env.HEIGHT ?? 900);
const OUT = resolve(process.env.OUT ?? `.omo/evidence/ai-surfaces-ux/${TAG}`);
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (key, value) => {
  log.push({ key, value, at: new Date().toISOString() });
  console.log(`[${key}]`, typeof value === "string" ? value : JSON.stringify(value));
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 300)));
page.on("response", (response) => {
  if (/\/v1\/(chat|images)/u.test(response.url())) note("llm", `${response.status()} ${response.url().replace(BASE, "")}`);
});
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:editor-session-id", "ai-surfaces-capture");
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  note("shot", name);
};
const has = async (testid) => (await page.getByTestId(testid).count()) > 0;
const textOf = async (testid) => (await has(testid)) ? (await page.getByTestId(testid).innerText()).slice(0, 600) : null;

async function boot() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
      await page.waitForFunction(() => Boolean(document.querySelector("[data-testid='edit-canvas'] canvas")), null, { timeout: 60_000 });
      return;
    } catch (error) {
      // 공유 머신은 ERR_NETWORK_CHANGED 로 첫 적재가 통째로 깨질 수 있다 — 재적재만이 답이다.
      note("boot-retry", String(error).slice(0, 160));
    }
  }
  throw new Error("editor did not boot");
}

async function waitPhase(testid, done, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const phase = await page.getByTestId(testid).getAttribute("data-phase").catch(() => null);
    const text = (await textOf(testid)) ?? "";
    if (done(phase, text)) return { phase, text, ms: Date.now() - started };
    await page.waitForTimeout(400);
  }
  return { phase: null, text: await textOf(testid), ms: Date.now() - started, timedOut: true };
}

// ── ① 이벤트 편집기 도크 ──────────────────────────────────────────────────
await boot();
const ids = await page.evaluate(() => {
  const store = window.__oprnEditorStore;
  const mapId = store.getCurrent().startMapId;
  store.update((draft) => {
    draft.maps[mapId].events.push({
      id: "ev_ai_capture", x: 5, y: 5, commands: [],
      pages: [{
        id: "p1", name: "상자", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: "나무 상자를 열어본다.", speaker: "" },
          { kind: "text", body: "잠겨 있다.", speaker: "" },
        ],
      }],
    });
  });
  return { mapId };
});
await page.evaluate(async ({ mapId }) => {
  const modal = await import("/src/editor/panels/eventEditor/modal.ts");
  modal.openEventEditorModal(mapId, "ev_ai_capture");
}, ids);
const editor = page.getByTestId("event-editor-modal");
await editor.waitFor({ state: "visible", timeout: 30_000 });
await page.waitForTimeout(500);
await shot("10-event-editor-default");
await editor.getByTestId("event-view-toggle-list").click();
await editor.getByTestId("event-command-quick-ai").click();
await page.waitForTimeout(300);
await shot("11-event-dock-open");
note("event-dock-open-box", await editor.getByTestId("ai-event-assist").boundingBox());
await editor.getByTestId("ai-event-input").fill("이미 열었으면 «비어 있다»고 말하고, 처음 열면 회복약 2개를 주고 이 이벤트 기억 A를 켠다.");
if (REAL) {
  await editor.getByTestId("ai-event-generate").click();
  await page.waitForTimeout(700);
  await shot("12-event-dock-busy");
  note("event-status-busy", await textOf("ai-event-status"));
  const started = Date.now();
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-testid='ai-event-status']");
    return status && !status.classList.contains("busy");
  }, null, { timeout: 180_000 }).catch(() => note("event-generate-timeout", true));
  note("event-generate-ms", Date.now() - started);
  await page.waitForTimeout(400);
  await shot("13-event-dock-result");
  note("event-status-result", await textOf("ai-event-status"));
  note("event-chip-result", await textOf("ai-event-chip-status"));
  note("event-result-title", await textOf("ai-event-result-title"));
  note("event-result-meta", await textOf("ai-event-result-meta"));
  note("event-generate-label", await textOf("ai-event-generate"));
  note("event-staged-toggle-labels", await editor.locator(".cmd-staged-toggle").allInnerTexts().then((all) => [...new Set(all)]));
  const apply = editor.getByTestId("ai-event-apply");
  if (await apply.isVisible() && await apply.isEnabled()) {
    await apply.click();
    await page.waitForTimeout(500);
    await shot("14-event-dock-applied");
    note("event-status-applied", await textOf("ai-event-status"));
    note("event-chip-applied", await textOf("ai-event-chip-status"));
  }
}
// 편집기 닫기(취소 → 적용하지 않은 변경 확인창이 뜨면 버리기).
await editor.getByTestId("event-editor-cancel").click();
await page.waitForTimeout(400);
const discard = page.getByTestId("app-modal-confirm");
if (await discard.count() && await discard.first().isVisible()) await discard.first().click();
await page.waitForTimeout(400);

// ── ② 데이터베이스 AI 바 ──────────────────────────────────────────────────
await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 20_000 });
await page.locator(".db-tab-group-label", { hasText: "몬스터" }).first().click();
await page.waitForTimeout(200);
await page.getByTestId("db-tab-enemies").click();
await page.waitForTimeout(600);
await page.getByTestId("database-ai-toggle").click();
await page.waitForTimeout(300);
await shot("20-db-ai-bar-open");
note("db-bar-box", await page.getByTestId("database-ai-bar").boundingBox());
note("db-bar-text", await textOf("database-ai-bar"));
note("db-bar-suggestions", await page.locator("[data-testid^='database-ai-suggestion-']").allInnerTexts());
if (REAL) {
  const balance = page.getByTestId("database-ai-suggestion-balance");
  if (await balance.count()) await balance.click();
  else await page.getByTestId("database-ai-input").fill("선택한 몬스터를 중반 난이도에 맞춰 스탯과 보상을 조정해줘");
  await page.getByTestId("database-ai-run").click();
  await page.waitForTimeout(1200);
  await shot("21-db-ai-sent");
  note("db-toast", await page.locator("[data-testid='toast']").allInnerTexts().catch(() => []));
  if (await has("database-ai-turn")) {
    note("db-turn-status-early", await textOf("database-ai-turn-status"));
    const working = await waitPhase("database-ai-turn-status", (phase) => phase === "working" || phase === "done" || phase === "error", 120_000);
    if (working.phase === "working") await shot("22-db-ai-working");
    const done = await waitPhase("database-ai-turn-status", (phase) => phase === "done" || phase === "error", 180_000);
    note("db-turn-done", done);
    await page.waitForTimeout(400);
    await shot("23-db-ai-done");
    note("db-turn-text", await textOf("database-ai-turn"));
    note("db-turn-box", await page.getByTestId("database-ai-turn").boundingBox());
    note("db-undo-visible", await page.getByTestId("database-ai-turn-undo").isVisible().catch(() => false));
  } else {
    // 옛 UI: 진행이 화면에 없다. 같은 시간을 기다린 뒤 무엇이 보이는지 남긴다.
    await page.waitForTimeout(25_000);
    await shot("23-db-ai-done");
    note("db-old-ui-visible-after-25s", await textOf("database-ai-bar"));
    note("db-bridge-audit-tail", await page.evaluate(() => (window.__oprnAiBridge?.audit?.() ?? []).slice(-4).map((entry) => entry.summary ?? entry.text?.slice(0, 120) ?? entry.kind)));
  }
  note("db-list-geometry", await page.evaluate(() => {
    const pane = document.querySelector(".oprn-record-list-pane");
    const list = pane?.querySelector(".db-list");
    const toolbar = pane?.querySelector(".db-toolbar");
    const rect = (node) => { const box = node?.getBoundingClientRect(); return box ? { y: Math.round(box.y), bottom: Math.round(box.bottom) } : null; };
    return { list: rect(list), toolbar: rect(toolbar), overlap: list && toolbar ? Math.max(0, Math.round(list.getBoundingClientRect().bottom - toolbar.getBoundingClientRect().top)) : null };
  }));
}

// ── ③ 「AI로 생성」 대화상자 ──────────────────────────────────────────────
await page.getByTestId("db-ai-generate-open").first().click();
const dialog = page.getByTestId("db-ai-generate-dialog-enemy");
await dialog.waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(300);
await shot("30-db-generate-dialog");
note("db-generate-dialog-box", await dialog.locator("[role='dialog']").boundingBox());
note("db-generate-dialog-text", await textOf("db-ai-generate-dialog-enemy"));
if (await has("db-ai-generate-example-0")) await page.getByTestId("db-ai-generate-example-0").click();
else await page.getByTestId("db-ai-generate-brief").fill("얼음 동굴에 사는 서슬 늑대. 빠르고 물리 공격 위주, 초중반 난이도.");
if (!ART) await page.getByTestId("db-ai-generate-artwork").uncheck();
await shot("31-db-generate-filled");
if (REAL) {
  await page.getByTestId("db-ai-generate-run").click();
  await page.waitForTimeout(700);
  await shot("32-db-generate-busy");
  note("db-generate-busy", await textOf("db-ai-generate-status"));
  const started = Date.now();
  await page.waitForFunction(() => /^(완료|실패)/u.test(document.querySelector("[data-testid='db-ai-generate-status']")?.textContent ?? ""), null, { timeout: 240_000 }).catch(() => note("db-generate-timeout", true));
  note("db-generate-ms", Date.now() - started);
  await page.waitForTimeout(400);
  await shot("33-db-generate-done");
  note("db-generate-status", await textOf("db-ai-generate-status"));
  note("db-generate-result", await textOf("db-ai-generate-result"));
  await page.getByTestId("db-ai-generate-close").click();
  await page.waitForTimeout(600);
  await shot("34-db-after-generate");
}
note("page-errors", pageErrors);

const summary = [
  `# AI 표면 캡처 — ${TAG}`,
  "",
  `- 서버: ${BASE} · 뷰포트 ${WIDTH}×${HEIGHT} · 실제 LLM: ${REAL ? "예" : "아니오"} · 그림: ${ART ? "예" : "아니오"}`,
  `- 생성: ${new Date().toISOString()}`,
  "",
  "| 항목 | 값 |",
  "|---|---|",
  ...log
    .filter((entry) => entry.key !== "shot" && entry.key !== "llm")
    .map((entry) => `| ${entry.key} | ${typeof entry.value === "string" ? entry.value.replace(/\n/gu, " / ").slice(0, 300) : JSON.stringify(entry.value).slice(0, 300)} |`),
  "",
  "## 장면",
  ...log.filter((entry) => entry.key === "shot").map((entry) => `- ${entry.value}.png`),
  "",
];
writeFileSync(`${OUT}/SUMMARY.md`, summary.join("\n"));
writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 2));
await browser.close();
