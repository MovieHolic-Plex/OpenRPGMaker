/**
 * 맵 전부 정리 → 마을 + 던전 (내장 에디터 AI).
 * 전제: npm run dev (9173), npm run mcp:assistant, .env.local
 *
 *   node scripts/wipe-village-dungeon-via-editor-ai.mjs
 */
import { chromium } from "playwright";
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9173";
const PROJECT_ID = process.env.RPG_ZZU_PROJECT_ID ?? "rpg-zzu-dew-30min";
const EVIDENCE = "output/evidence/wipe-village-dungeon";
const TURN_MS = Number(process.env.AI_TURN_TIMEOUT_MS ?? 600_000);

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

function log(msg) {
  console.log(msg);
  mkdirSync(EVIDENCE, { recursive: true });
  appendFileSync(path.join(EVIDENCE, "run-log.txt"), msg + "\n");
}

const STEPS = [
  {
    id: "S0",
    title: "맵 정리 + 마을 골격",
    text: [
      "이 프로젝트 콘텐츠를 처음부터 다시 짓는다. 목표: 마을 1장 + 던전 1장 + transfer.",
      "1) get_project_summary로 맵 목록을 확인하라.",
      "2) 시작 맵이 아닌 맵은 remove_map으로 모두 삭제하라 (confirmDestroy 필요하면 true).",
      "3) 시작 맵이 없거나 너무 작으면 create_map name:\"이슬 마을\" width:64 height:64 로 만들고 set_start_map 등으로 시작 맵으로 지정.",
      "4) 시작 맵 이름을 '이슬 마을'로 맞추고, 가능하면 64x64 이상 유지.",
      "5) 이 시작 맵에 build_village 실행:",
      "build_village({ mapId:시작맵, width:64, height:64, name:\"이슬 마을\", theme:\"작은 강가 마을\", houses:10, pathStyle:\"sand\", kitMix:\"mixed\", interior:true, fences:true, decor:true, edgeTrees:\"conifer\", plazaLayout:\"center\", seed:42, skipTerrain:false })",
      "시작 위치를 광장 근처로 맞춰라. 던전은 아직 만들지 마라.",
    ].join(" "),
  },
  {
    id: "S1",
    title: "던전 + 워프 + NPC",
    text: [
      "이슬 마을은 유지하고 던전을 추가한다.",
      "1) create_map name:\"폐광 던전\" width:40 height:40.",
      "2) 던전 맵: 어두운 흙/돌 바닥 위주 fill_region, 입구에서 안쪽으로 paint_road 또는 통로,",
      "   안쪽에 작은 원형 연못 또는 함정 느낌 1개. place_props로 돌/상자 소량.",
      "3) create_transfer_pair: 이슬 마을 북쪽 가장자리(통행 가능 칸) ↔ 폐광 던전 남쪽 입구.",
      "4) 이슬 마을 광장 place_npc '미르'(촌장): 대사로 폐광 던전을 안내.",
      "5) 폐광 던전 안쪽 place_npc 또는 적 이벤트 1: battleProcessing troop_slime (없으면 기본 슬라임), canEscape true.",
      "6) 마을에 ambient NPC 2~3명 place_npc (짧은 대사).",
      "기존 마을 시공을 지우지 마라. 다른 맵을 더 만들지 마라.",
    ].join(" "),
  },
];

async function waitBridge(page, timeoutMs = 90_000) {
  await page.waitForFunction(
    () => typeof window.__rpgzzuAiBridge?.send === "function",
    null,
    { timeout: timeoutMs }
  );
  await page.evaluate(() => {
    const restore = document.querySelector('[data-testid="ai-collapsed-restore"]');
    if (restore instanceof HTMLElement) restore.click();
  });
}

async function sendTurn(page, step) {
  log(`\n=== ${step.id} ${step.title} ===`);
  log(step.text.slice(0, 220) + "…");
  const result = await page.evaluate(
    async ({ msg, timeoutMs }) => {
      const bridge = window.__rpgzzuAiBridge;
      if (!bridge?.send) return { ok: false, error: "no bridge" };
      const st = bridge.status?.();
      if (st && st.configReady === false) return { ok: false, error: "config not ready", status: st };
      const p = bridge.send(msg);
      const t = new Promise((resolve) =>
        setTimeout(() => resolve({ ok: false, error: `timeout ${timeoutMs}`, status: bridge.status?.() }), timeoutMs)
      );
      return Promise.race([p, t]);
    },
    { msg: step.text, timeoutMs: TURN_MS }
  );
  log(`ok=${result?.ok} err=${result?.error ?? ""}`);
  log("assistant: " + String(result?.lastAssistantText ?? "").slice(0, 600));
  const tools = (result?.audit ?? []).filter((a) => a.name).map((a) => a.name);
  if (tools.length) log("tools: " + [...new Set(tools)].join(", "));
  const harness = result?.harness ?? result?.workPlan;
  if (harness) log("harness/workPlan: " + JSON.stringify(harness).slice(0, 400));
  writeFileSync(path.join(EVIDENCE, `${step.id}-result.json`), JSON.stringify(result, null, 2).slice(0, 200_000));
  return result;
}

async function acceptAll(page) {
  for (let k = 0; k < 5; k += 1) {
    const accept = page.getByTestId("ai-proposal-accept").or(page.locator('[data-testid*="proposal-accept"]'));
    if (await accept.first().isVisible().catch(() => false)) {
      await accept.first().click({ force: true });
      await page.waitForTimeout(400);
      log("clicked proposal accept");
    } else break;
  }
}

async function projectSnapshot(page) {
  const raw = await page.getByTestId("project-export-json").textContent().catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw).project;
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(path.join(EVIDENCE, "run-log.txt"), "");
  const env = loadEnv();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(60_000);
  page.on("dialog", (d) => d.accept());

  const supabaseDraft = {
    url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
    anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
    projectId: PROJECT_ID,
    source: "custom",
  };
  const aiConfig = {
    baseUrl: env.VITE_VITE_LLM_API_URL || env.VITE_LLM_API_URL || "https://example.invalid/v1",
    model: env.VITE_VITE_LLM_MODEL || env.VITE_LLM_MODEL || "google/gemini-3.1-flash-lite",
    liteModel: env.VITE_llm-provider_LITE_MODEL || env.VITE_VITE_LLM_MODEL || "google/gemini-3.1-flash-lite",
    apiKey: env.VITE_LLM_API_KEY || env.VITE_LLM_API_KEY || "",
    maxToolCalls: 200,
    maxTokens: 32768,
    reasoningEffort: "low",
    autoApprove: true,
  };

  if (!supabaseDraft.url || !supabaseDraft.anonKey) throw new Error("VITE_SUPABASE_* missing");
  if (!aiConfig.apiKey) throw new Error("API key missing");

  await page.addInitScript(
    ({ supabaseDraft, aiConfig }) => {
      localStorage.clear();
      localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
      localStorage.setItem("rpg-zzu:ai-panel-collapsed", "0");
      localStorage.setItem("rpg-zzu:supabase-project-config", JSON.stringify(supabaseDraft));
      localStorage.setItem("rpg-zzu:ai-config", JSON.stringify(aiConfig));
    },
    { supabaseDraft, aiConfig }
  );

  log(`goto ${BASE} project=${PROJECT_ID}`);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });

  const dbRequired = page.getByTestId("db-required-panel");
  if (await dbRequired.isVisible().catch(() => false)) {
    log("DB required — connecting");
    await page.getByTestId("db-config-connect").click().catch(async () => {
      await page.getByRole("button", { name: /연결/ }).first().click();
    });
    await page.waitForTimeout(2500);
  }

  if (!(await page.getByTestId("edit-canvas").isVisible().catch(() => false))) {
    await page.getByTestId("db-connection-status").click().catch(() => undefined);
    const pid = page.locator('input[name="projectId"]');
    if (await pid.isVisible().catch(() => false)) {
      await pid.fill(PROJECT_ID);
      await page.getByTestId("db-config-connect").click();
      await page.waitForTimeout(3000);
    }
  }

  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  log("editor ready");
  await page.screenshot({ path: path.join(EVIDENCE, "01-editor.png"), fullPage: true });

  await waitBridge(page);
  log("bridge " + JSON.stringify(await page.evaluate(() => window.__rpgzzuAiBridge?.status?.())));

  for (const step of STEPS) {
    const r = await sendTurn(page, step);
    await acceptAll(page);
    await page.screenshot({ path: path.join(EVIDENCE, `${step.id}.png`), fullPage: true });
    if (r && r.ok === false && String(r.error || "").includes("timeout")) {
      log("WARN turn timeout — continue");
    }
  }

  log("\n=== save ===");
  await page.getByTestId("toolbar-save").click().catch(() => undefined);
  await page.waitForTimeout(1500);
  const flush = await page.evaluate(async () => {
    try {
      const { store } = await import("/src/project/store.ts");
      return await store.flush();
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  });
  log("flush " + JSON.stringify(flush));

  let project = null;
  for (let i = 0; i < 25; i += 1) {
    project = await projectSnapshot(page);
    if (project) break;
    await page.waitForTimeout(200);
  }
  if (!project) throw new Error("no project export");

  writeFileSync(path.join(EVIDENCE, "project-after.json"), JSON.stringify(project, null, 2));
  const maps = Object.values(project.maps || {});
  const summary = {
    projectId: PROJECT_ID,
    title: project.meta?.title,
    maps: maps.map((m) => `${m.name} ${m.width}x${m.height} events=${(m.events || []).length}`),
    mapCount: maps.length,
    eventCount: maps.reduce((n, m) => n + (m.events || []).length, 0),
    hasVillage: maps.some((m) => /마을|village|장터/i.test(m.name)),
    hasDungeon: maps.some((m) => /던전|폐광|dungeon|광산|동굴/i.test(m.name)),
    hasTransfer: JSON.stringify(project).includes("transfer") || JSON.stringify(project).includes("changeMap"),
    hasMir: JSON.stringify(project).includes("미르"),
  };
  log("\n=== summary ===\n" + JSON.stringify(summary, null, 2));
  writeFileSync(path.join(EVIDENCE, "summary.json"), JSON.stringify(summary, null, 2));
  await page.screenshot({ path: path.join(EVIDENCE, "99-final.png"), fullPage: true });
  await browser.close();

  if (!summary.hasVillage || !summary.hasDungeon || summary.mapCount < 2) {
    log("FAIL: village/dungeon incomplete");
    process.exitCode = 2;
  } else {
    log("OK village+dungeon");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
