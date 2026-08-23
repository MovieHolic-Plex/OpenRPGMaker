/**
 * 내장 AI로 이슬 마을 퀘스트 로직만 보강 후 Supabase 강제 저장.
 * 전제: npm run dev (9173) + npm run mcp:assistant
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9173";
const PROJECT_ID = "rpg-zzu-dew-village";
const EVIDENCE = "output/evidence/dew-village-ai-rebuild";

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const env = loadEnv();
const supabaseDraft = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: PROJECT_ID,
  source: "custom",
};
const aiConfig = {
  baseUrl: env.VITE_VITE_LLM_API_URL || "https://example.invalid/v1",
  model: env.VITE_VITE_LLM_MODEL || "google/gemini-3.1-flash-lite",
  liteModel: env.VITE_VITE_LLM_MODEL || "google/gemini-3.1-flash-lite",
  apiKey: env.VITE_LLM_API_KEY || env.VITE_LLM_API_KEY || "",
  maxToolCalls: 200,
  maxTokens: 32768,
  reasoningEffort: "low",
  autoApprove: true,
};

const MSG = [
  "퀘스트 로직을 반드시 완성해라.",
  "(1) 촌장 미르: choices로 의뢰 수락/거절, 수락 시 setSwitch sw_0001 true.",
  "페이지 조건으로 진행중/완료 페이지. 완료(sw_0002)에서 changeGold, changeItem, setSwitch sw_0003, ending.",
  "(2) 약사 노아 place_npc + recoverAll.",
  "(3) 아이 루 단서 대사.",
  "(4) 갈대 언덕 슬라임: 조건 sw_0001, battleProcessing troop_slime, setSwitch sw_0002, 보상.",
  "스위치 이름도 설정. 기존 미르/루를 수정하거나 교체해도 된다.",
].join(" ");

await mkdir(EVIDENCE, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("dialog", (d) => d.accept());

await page.addInitScript(
  ({ supabaseDraft, aiConfig }) => {
    localStorage.clear();
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
    localStorage.setItem("oprn:supabase-project-config", JSON.stringify(supabaseDraft));
    localStorage.setItem("oprn:ai-config", JSON.stringify(aiConfig));
  },
  { supabaseDraft, aiConfig }
);

console.log("goto", BASE);
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });

try {
  await page.getByTestId("db-connection-status").click({ timeout: 5000 });
  const pid = page.locator('input[name="projectId"]');
  if (await pid.isVisible().catch(() => false)) {
    await pid.fill(PROJECT_ID);
    await page.getByTestId("db-config-connect").click();
    await page.waitForTimeout(3000);
  } else {
    await page.keyboard.press("Escape");
  }
} catch {
  /* ok */
}

await page.waitForFunction(() => typeof window.__oprnAiBridge?.send === "function", null, { timeout: 60_000 });
await page.evaluate(() => {
  const r = document.querySelector('[data-testid="ai-collapsed-restore"]');
  if (r instanceof HTMLElement) r.click();
});

console.log("AI quest turn…");
const result = await page.evaluate(async (msg) => {
  const p = window.__oprnAiBridge.send(msg);
  const t = new Promise((res) => setTimeout(() => res({ ok: false, error: "timeout" }), 420_000));
  return Promise.race([p, t]);
}, MSG);
console.log("ok", result?.ok, "err", result?.error);
console.log((result?.lastAssistantText || "").slice(0, 600));

for (let i = 0; i < 6; i += 1) {
  const acc = page.locator('[data-testid*="proposal-accept"], [data-testid="ai-proposal-accept"]').first();
  if (await acc.isVisible().catch(() => false)) {
    await acc.click({ force: true });
    await page.waitForTimeout(400);
    console.log("accepted proposal");
  }
}

const saveOut = await page.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const { saveProjectToSupabase } = await import("/src/project/supabaseProjectSync.ts");
  const { supabaseProjectConfig } = await import("/src/project/supabaseProjectConfig.ts");
  const project = store.getCurrent();
  const cfg = supabaseProjectConfig();
  if (!cfg) return { kind: "no-config" };
  try {
    const r = await saveProjectToSupabase(project, cfg);
    return {
      kind: r.kind,
      title: project.meta?.title,
      maps: Object.keys(project.maps).length,
      events: Object.values(project.maps).reduce((n, m) => n + (m.events?.length || 0), 0),
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
});
console.log("save", saveOut);

await page.waitForTimeout(400);
const raw = await page.getByTestId("project-export-json").textContent();
const project = raw ? JSON.parse(raw).project : null;
if (project) {
  writeFileSync(`${EVIDENCE}/project-after-quest.json`, `${JSON.stringify(project, null, 2)}\n`);
  writeFileSync("src/project/defaults/fixtures/dew-village-demo.json", `${JSON.stringify(project, null, 2)}\n`);
  writeFileSync("test/fixtures/projects/dew-village-demo.json", `${JSON.stringify(project, null, 2)}\n`);
  const ser = JSON.stringify(project);
  console.log({
    choices: ser.includes("choices"),
    battle: ser.includes("battleProcessing"),
    ending: ser.includes("ending"),
    recover: ser.includes("recoverAll"),
    mir: ser.includes("미르"),
  });
}
await page.screenshot({ path: `${EVIDENCE}/05-quest-pass.png`, fullPage: true });
await browser.close();
console.log("done");
