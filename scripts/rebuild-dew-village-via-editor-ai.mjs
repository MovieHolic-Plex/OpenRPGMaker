/**
 * 내장 에디터 AI 어시스턴트로 《이슬 마을의 종》을 재구성한다.
 *
 * 전제:
 *   - npm run mcp:assistant  (브리지 17831)
 *   - npm run dev            (9173, AI 설정은 .env.local VITE_LLM_*)
 *
 * 실행:
 *   node scripts/rebuild-dew-village-via-editor-ai.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9173";
const PROJECT_ID = process.env.DEW_PROJECT_ID ?? "rpg-zzu-dew-village";
const EVIDENCE = "output/evidence/dew-village-ai-rebuild";
const TURN_TIMEOUT_MS = Number(process.env.AI_TURN_TIMEOUT_MS ?? 420_000);

function loadEnvLocal() {
  const text = readFileSync(".env.local", "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const env = loadEnvLocal();

const PROMPTS = [
  // 1) 세계관·메타 + 마을 맵 공간
  [
    "《이슬 마을의 종》 데모 게임을 처음부터 다시 만든다.",
    "프로젝트 제목은 '이슬 마을의 종', 타이틀 화면 제목은 '이슬 마을'로 맞춰라.",
    "현재 시작 맵을 이슬 마을로 쓰고, 맵 이름을 '이슬 마을'로 바꾼 뒤",
    "작은 항구 마을처럼 꾸며라: 잔디 바탕, 중앙 십자 흙길, 한쪽 연못/물, 집 2~3채, 시작 위치는 광장 근처.",
    "가능하면 build_village 또는 집 키트/도로 도구를 써라. 맵 크기는 최소 24×24.",
  ].join(" "),

  // 2) 두 번째 맵
  [
    "맵을 하나 더 추가해 이름을 '갈대 언덕'으로 하고,",
    "이슬 마을 남쪽과 갈대 언덕을 서로 이동하는 transfer 이벤트를 연결해라.",
    "갈대 언덕은 풀밭+길+약간의 물/숲 느낌으로 탐험 구간을 만들어라.",
  ].join(" "),

  // 3) 퀘스트 루프 이벤트
  [
    "플레이 가능한 퀘스트 루프를 완성해라.",
    "1) 이슬 마을에 촌장 '미르' NPC: 종이 깨졌다고 말하고, 선택지로 의뢰 수락 시 스위치 sw_0001 켠다.",
    "2) 약사 '노아'는 회복(recoverAll) 대사.",
    "3) 아이 '루'는 갈대 언덕 단서 대사.",
    "4) 갈대 언덕에 슬라임 적 이벤트: 의뢰 수락 후에만 상호작용, 전투(troop_slime) 후 sw_0002와 아이템 보상.",
    "5) 미르 완료 페이지: sw_0002 조건으로 보상 골드+아이템, sw_0003, ending 명령으로 엔딩.",
    "스위치 이름도 종 의뢰/종 조각/종 복구로 맞춰라. 페이지 조건을 반드시 써라.",
  ].join(" "),
];

async function waitBridge(page, timeoutMs = 60_000) {
  await page.waitForFunction(
    () => typeof window.__rpgzzuAiBridge?.send === "function" && window.__rpgzzuAiBridge.status?.()?.panelMounted !== false,
    null,
    { timeout: timeoutMs }
  );
  // expand panel if needed
  await page.evaluate(() => {
    const s = window.__rpgzzuAiBridge?.status?.();
    if (s && !s.ready) return;
    // open via restore button if collapsed
    const restore = document.querySelector('[data-testid="ai-collapsed-restore"]');
    if (restore instanceof HTMLElement) restore.click();
  });
}

async function sendTurn(page, text, label) {
  console.log(`\n=== AI turn: ${label} ===`);
  console.log(text.slice(0, 160) + (text.length > 160 ? "…" : ""));
  const result = await page.evaluate(
    async ({ msg, timeoutMs }) => {
      const bridge = window.__rpgzzuAiBridge;
      if (!bridge?.send) return { ok: false, error: "no bridge" };
      const status0 = bridge.status?.();
      if (status0 && status0.configReady === false) {
        return { ok: false, error: "AI config not ready (API key?)", status: status0 };
      }
      // soft timeout wrapper
      const p = bridge.send(msg);
      const t = new Promise((resolve) =>
        setTimeout(() => resolve({ ok: false, error: `client timeout ${timeoutMs}ms`, status: bridge.status?.() }), timeoutMs)
      );
      return await Promise.race([p, t]);
    },
    { msg: text, timeoutMs: TURN_TIMEOUT_MS }
  );
  console.log("result ok=", result?.ok, "error=", result?.error);
  console.log("assistant:", (result?.lastAssistantText ?? "").slice(0, 400));
  const audit = result?.audit ?? [];
  const toolLines = audit.filter((a) => a.kind === "tool" || a.name).slice(-12);
  if (toolLines.length) console.log("tools:", toolLines.map((a) => a.name || a.summary || a.kind).join(", "));
  return result;
}

async function acceptPendingIfAny(page) {
  // autoApprove should handle most; still click accept if visible
  const accept = page.getByTestId("ai-proposal-accept").or(page.locator('[data-testid*="proposal-accept"]'));
  if (await accept.first().isVisible().catch(() => false)) {
    await accept.first().click({ force: true });
    await page.waitForTimeout(500);
    console.log("clicked proposal accept");
  }
}

async function projectSnapshot(page) {
  const raw = await page.getByTestId("project-export-json").textContent();
  if (!raw) return null;
  try {
    return JSON.parse(raw).project;
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(EVIDENCE, { recursive: true });
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
    liteModel: env.VITE_VITE_LLM_MODEL || "google/gemini-3.1-flash-lite",
    apiKey: env.VITE_LLM_API_KEY || env.VITE_LLM_API_KEY || "",
    maxToolCalls: 200,
    maxTokens: 32768,
    reasoningEffort: "low",
    autoApprove: true,
  };

  if (!supabaseDraft.url || !supabaseDraft.anonKey) {
    throw new Error("VITE_SUPABASE_* missing in .env.local");
  }
  if (!aiConfig.apiKey) {
    throw new Error("VITE_LLM_API_KEY / VITE_LLM_API_KEY missing");
  }

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

  console.log("goto", BASE, "project", PROJECT_ID);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });

  // DB required screen?
  const dbRequired = page.getByTestId("db-required-panel");
  if (await dbRequired.isVisible().catch(() => false)) {
    console.log("DB required screen — connecting…");
    const connect = page.getByTestId("db-config-connect");
    if (await connect.isVisible().catch(() => false)) {
      await connect.click();
    } else {
      // form may be open
      await page.getByRole("button", { name: /연결/ }).first().click().catch(() => undefined);
    }
    await page.waitForTimeout(2000);
  }

  // If still not editor, try open DB status and connect
  if (!(await page.getByTestId("edit-canvas").isVisible().catch(() => false))) {
    const status = page.getByTestId("db-connection-status");
    if (await status.isVisible().catch(() => false)) {
      await status.click();
      await page.getByTestId("db-config-connect").click().catch(async () => {
        await page.getByRole("button", { name: /연결/ }).first().click();
      });
      await page.waitForTimeout(2500);
    }
  }

  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  console.log("editor canvas visible");
  await page.screenshot({ path: path.join(EVIDENCE, "01-editor-loaded.png"), fullPage: true });

  // Ensure remote project is dew-village (reconnect if needed)
  await page.evaluate(async (projectId) => {
    const draftRaw = localStorage.getItem("oprn:supabase-project-config");
    if (draftRaw) {
      const draft = JSON.parse(draftRaw);
      if (draft.projectId !== projectId) {
        draft.projectId = projectId;
        localStorage.setItem("oprn:supabase-project-config", JSON.stringify(draft));
      }
    }
  }, PROJECT_ID);

  // reconnect to be sure
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
    /* already connected */
  }

  await waitBridge(page);
  console.log("AI bridge ready", await page.evaluate(() => window.__rpgzzuAiBridge?.status?.()));

  // Wipe / reset content instruction first so AI rebuilds rather than patches junk
  await sendTurn(
    page,
    "이 프로젝트는 데모 재작성 중이다. 기존 맵/이벤트가 있으면 정리하고, 곧 이슬 마을 데모를 새로 짓는다. 먼저 현재 시작 맵 이름을 '이슬 마을'로 맞추고 타일을 잔디 위주로 정리해라.",
    "prep"
  );
  await acceptPendingIfAny(page);
  await page.screenshot({ path: path.join(EVIDENCE, "02-after-prep.png"), fullPage: true });

  for (let i = 0; i < PROMPTS.length; i += 1) {
    const r = await sendTurn(page, PROMPTS[i], `step-${i + 1}`);
    await acceptPendingIfAny(page);
    // extra accept for multi-proposal
    for (let k = 0; k < 3; k += 1) {
      await acceptPendingIfAny(page);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(EVIDENCE, `03-step-${i + 1}.png`), fullPage: true });
    if (r && r.ok === false && String(r.error || "").includes("timeout")) {
      console.warn("turn timed out — continuing");
    }
  }

  // Save to remote
  console.log("\n=== save project ===");
  await page.getByTestId("toolbar-save").click().catch(() => undefined);
  await page.waitForTimeout(2000);
  const saveResult = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    try {
      const r = await store.flush();
      return r;
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  });
  console.log("flush", saveResult);

  // Wait export json
  await page.waitForTimeout(400);
  let project = null;
  for (let i = 0; i < 20; i += 1) {
    project = await projectSnapshot(page);
    if (project) break;
    await page.waitForTimeout(200);
  }
  if (!project) throw new Error("no project export after AI rebuild");

  await writeFile(path.join(EVIDENCE, "project-after-ai.json"), JSON.stringify(project, null, 2) + "\n", "utf8");
  // also refresh fixture for sample adventure
  await writeFile("src/project/defaults/fixtures/dew-village-demo.json", JSON.stringify(project, null, 2) + "\n", "utf8");
  await writeFile("test/fixtures/projects/dew-village-demo.json", JSON.stringify(project, null, 2) + "\n", "utf8");

  const mapNames = Object.values(project.maps || {}).map((m) => m.name);
  const events = Object.values(project.maps || {}).flatMap((m) => m.events || []);
  const summary = {
    title: project.meta?.title,
    maps: mapNames,
    eventCount: events.length,
    hasChoices: JSON.stringify(project).includes('"choices"'),
    hasBattle: JSON.stringify(project).includes("battleProcessing"),
    hasEnding: JSON.stringify(project).includes('"ending"'),
    hasMir: JSON.stringify(project).includes("미르"),
    projectId: PROJECT_ID,
  };
  console.log("\n=== summary ===");
  console.log(summary);
  await writeFile(path.join(EVIDENCE, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  await page.screenshot({ path: path.join(EVIDENCE, "04-final.png"), fullPage: true });

  await browser.close();
  console.log("\nDone. Evidence:", EVIDENCE);
  if (!summary.hasMir && summary.eventCount < 3) {
    console.error("AI rebuild looks thin — check evidence screenshots/logs");
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
