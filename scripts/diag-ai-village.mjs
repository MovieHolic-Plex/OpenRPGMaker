// 진단2: T1 한 턴 → accept 클릭 → 실패 사유(시스템 버블·status·store)를 DOM에서 캡처.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

const BASE = "http://127.0.0.1:9999";
const PROJECT_ID = "rpg-zzu-ai-village-lab";
const EVIDENCE = "output/evidence/ai-village-diagnose2";
const MODEL = "cpen/gpt-5-6-luna";

function loadEnv() {
  return Object.fromEntries(
    [".env", ".env.local"]
      .flatMap((f) => (readFileSync(f, "utf8").match(/^[A-Z0-9_]+=.*$/gm) ?? []))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
  );
}
const env = loadEnv();
const supabaseDraft = { url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY ?? "", projectId: PROJECT_ID, source: "custom" };
const aiConfig = { authMode: "apiKey", baseUrl: "/api/cpen", model: MODEL, liteModel: MODEL, apiKey: "", maxToolCalls: 200, maxTokens: 32768, reasoningEffort: "low", autoApprove: true };

await mkdir(EVIDENCE, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("dialog", (d) => d.accept());
page.on("console", (m) => { if (m.type() === "error") writeFileSync(EVIDENCE + "/console.txt", m.text() + "\n", { flag: "a" }); });
await page.addInitScript(({ supabaseDraft, aiConfig }) => {
  localStorage.clear();
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:ai-panel-collapsed", "0");
  localStorage.setItem("oprn:supabase-project-config", JSON.stringify(supabaseDraft));
  localStorage.setItem("oprn:ai-config", JSON.stringify(aiConfig));
}, { supabaseDraft, aiConfig });

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
await page.waitForFunction(() => typeof window.__rpgzzuAiBridge?.send === "function", null, { timeout: 60_000 });

const t0 = Date.now();
const r = await page.evaluate(async ({ msg }) => {
  const bridge = window.__rpgzzuAiBridge;
  const p = bridge.send(msg);
  const t = new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "timeout 600s" }), 600_000));
  return Promise.race([p, t]);
}, { msg: "이 100x100 빈 맵에 마을 하나 만들어줘. 강가 장터 마을 느낌으로, 집 16채 정도에 길과 광장을 갖춘 마을로." });
console.log("T1 elapsed:", ((Date.now() - t0) / 1000).toFixed(1) + "s", "ok:", r?.ok, "err:", r?.error ?? "");

// accept 시도: ghost/modal DOM 클릭
const clicked = await page.evaluate(() => {
  const ghost = document.querySelector('[data-testid="ghost-inline-accept"]');
  const modal = document.querySelector('[data-testid="ai-proposal-accept"]');
  const target = modal ?? ghost;
  if (!target) return { clicked: false, which: "none", status: document.body.textContent?.match(/적용|대기|완료|오류/g)?.slice(0, 5) };
  target.click();
  return { clicked: true, which: modal ? "modal" : "ghost" };
});
console.log("accept click:", JSON.stringify(clicked));

// accept 후 상태 스냅샷: status 텍스트 + 시스템 버블 + store 요약
await page.waitForTimeout(2500);
const state = await page.evaluate(() => {
  const status = document.querySelector("[data-testid=ai-status-text], .ai-status-text")?.textContent ?? "";
  const systemBubbles = [...document.querySelectorAll(".ai-chat-bubble.ai-chat-system, [class*=ai-chat-bubble]")]
    .map((el) => (el.textContent ?? "").trim())
    .filter((t) => t && (t.includes("적용") || t.includes("실패") || t.includes("오류") || t.includes("배치") || t.includes("제안")));
  let store = null;
  try {
    const raw = document.querySelector('[data-testid="project-export-json"]')?.textContent;
    if (raw) {
      const p = JSON.parse(raw).project;
      store = { maps: Object.keys(p.maps).length, events: Object.values(p.maps).reduce((s, m) => s + (m.events?.length ?? 0), 0) };
    }
  } catch {}
  return { status, systemBubbles, store };
});
console.log("AFTER:", JSON.stringify(state, null, 1));

// forceSave: store.getCurrent()를 실제 Supabase에 저장 + 재로드 + 타일 검증
const save = await page.evaluate(async (pid) => {
  const { store } = await import("/src/project/store.ts");
  const { saveProjectToSupabase } = await import("/src/project/supabaseProjectSync.ts");
  const { supabaseProjectConfig } = await import("/src/project/supabaseProjectConfig.ts");
  const project = store.getCurrent();
  const cfg = supabaseProjectConfig();
  if (!cfg) return { kind: "no-config" };
  try {
    const r = await saveProjectToSupabase(project, { ...cfg, projectId: pid });
    const m = Object.values(project.maps)[0];
    const lh = {};
    for (const t of m?.lowerTiles ?? []) lh[t] = (lh[t] || 0) + 1;
    const top = Object.entries(lh).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { kind: r.kind, maps: Object.keys(project.maps).length, events: Object.values(project.maps).reduce((s, x) => s + (x.events?.length ?? 0), 0), lowerTop: top };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}, PROJECT_ID);
console.log("SAVE:", JSON.stringify(save));
const reload = await page.evaluate(async (pid) => {
  const { loadProjectFromSupabase } = await import("/src/project/supabaseProjectSync.ts");
  const { supabaseProjectConfig } = await import("/src/project/supabaseProjectConfig.ts");
  const cfg = supabaseProjectConfig();
  if (!cfg) return { ok: false, error: "no-config" };
  const p = await loadProjectFromSupabase({ ...cfg, projectId: pid });
  if (!p) return { ok: false, error: "null" };
  const m = Object.values(p.maps)[0];
  const lh = {};
  for (const t of m?.lowerTiles ?? []) lh[t] = (lh[t] || 0) + 1;
  return { ok: true, maps: Object.keys(p.maps).length, events: Object.values(p.maps).reduce((s, x) => s + (x.events?.length ?? 0), 0), lowerTop: Object.entries(lh).sort((a, b) => b[1] - a[1]).slice(0, 6) };
}, PROJECT_ID);
console.log("RELOAD:", JSON.stringify(reload));
writeFileSync(EVIDENCE + "/diag.json", JSON.stringify({ elapsed: ((Date.now() - t0) / 1000).toFixed(1), ok: r?.ok, err: r?.error ?? null, accept: clicked, after: state, save, reload }, null, 2));
await page.screenshot({ path: EVIDENCE + "/after.png", fullPage: true });
await browser.close();
console.log("DONE");
