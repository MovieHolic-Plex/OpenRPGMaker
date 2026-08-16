/**
 * 내장 AI 마을 생성 능력 실험 드라이버.
 * 전제: npm run dev (9999, 이 워크트리), Supabase(dbserver), /api/cpen 프록시.
 * 시드: npx tsx scripts/seed-ai-village-lab.mts  (rpg-zzu-ai-village-lab, 100x100 빈 맵)
 *
 * 측정 목표: 에디터 내장 AI 어시스턴트가
 *  1) 자연어 "마을 만들어줘" 한 턴에서 어디까지 짓는가 (도구 사용 폭)
 *  2) 후속 확장 턴(수역·소품·NPC·퀘스트)에서 얼마나 정확히 이어붙이는가
 *  3) 최종 저장→재로드가 성공하는가
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const ACTIVITY_LATEST = path.resolve("output/ai-activity/latest.json");

function readLatestTurn() {
  try {
    const j = JSON.parse(readFileSync(ACTIVITY_LATEST, "utf8"));
    return { at: j.at ?? "", ok: j.result?.ok ?? null, error: j.result?.error ? String(j.result.error) : null };
  } catch {
    return null;
  }
}

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const PROJECT_ID = "rpg-zzu-ai-village-lab";
const EVIDENCE = "output/evidence/ai-village-lab";
const TURN_MS = Number(process.env.AI_TURN_TIMEOUT_MS ?? 1_500_000);
const MODEL = process.env.AI_MODEL ?? "cpen/gemini-3-flash";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL ?? "cpen/gpt-5-6-luna";

function loadEnv() {
  return Object.fromEntries(
    [".env", ".env.local"]
      .flatMap((f) => (readFileSync(f, "utf8").match(/^[A-Z0-9_]+=.*$/gm) ?? []))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

function logLine(msg) {
  console.log(msg);
  appendFileSync(path.join(EVIDENCE, "run-log.txt"), msg + "\n");
}

/**
 * 턴 설계 의도:
 * T1 "마을 만들어줘" — 순수 자연어, 도구 이름 제시 없음. 모델이 스스로 build_village를 선택하는지 본다.
 * T2 수역+랜드마크 — 좌표 없이 "강가 마을 느낌"만 요구해 공간 추론 능력을 본다.
 * T3 NPC·퀘스트 — 마을에 서사를 얹어 이벤트/스위치/변수 설계 능력을 본다.
 * T4 자기 검증 — run_lint/query 계열로 스스로 문제를 찾게 해 메타 인지를 본다.
 */
const STEPS = [
  {
    id: "T1",
    title: "자연어 마을 생성(도구 힌트 없음)",
    text: "이 100x100 빈 맵에 마을 하나 만들어줘.",
  },
  {
    id: "T2",
    title: "수역·랜드마크 확장",
    text: "이제 마을에 강이랑 호수를 추가해줘. 강은 마을을 가로지르는 게 아니라 한쪽에 흐르게. 호수 근처엔 낚시꾼 NPC도 한 명. 기존 집이랑 길은 건드리지 마.",
  },
  {
    id: "T3",
    title: "NPC·퀘스트 저작",
    text: "마을에 사람 좀 살게 해줘: 촌장 1명, 상인 1명, 주민 5명 정도. 그리고 간단한 의뢰 하나 - 촌장이 부탁해서 근처에서 약초 3개 모아오는 퀘스트. 스위치/변수 이름까지 제대로 정하고, 완료 보상도 있어야 해.",
  },
  {
    id: "T4",
    title: "자기 검증 턴",
    text: "방금 만든 마을 전체를 검토해봐. 길이 건축물을 뚫고 지나가는 곳 없는지, NPC가 통행 불가칸에 서 있는 건 없는지, 퀘스트 플레이스루가 논리적으로 맞는지. 문제가 있으면 고치고, 결과를 알려줘.",
  },
];

async function sendTurn(page, step) {
  logLine(`\n=== ${step.id} ${step.title} ===`);
  const t0 = Date.now();
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
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  logLine(`[${dt}s] ok=${result?.ok} err=${result?.error ?? ""}`);
  logLine("assistant: " + String(result?.lastAssistantText ?? "").slice(0, 800));
  const tools = (result?.audit ?? []).filter((a) => a.name).map((a) => a.name);
  if (tools.length) logLine("tools(" + new Set(tools).size + "): " + [...new Set(tools)].join(", "));
  const calls = (result?.audit ?? []).filter((a) => a.name && a.durationMs != null);
  if (calls.length) {
    const total = calls.reduce((s, c) => s + (c.durationMs ?? 0), 0);
    logLine(`tool-calls=${calls.length} tool-time=${(total / 1000).toFixed(1)}s`);
  }
  return result;
}

/** 턴 후 실제 결과 확인(bridge 반환 ok는 전달 성공일 뿐). activity 디스크 POST가 bridge 반환보다
 * 늦게 도착하는 레이스가 있어(실측 ~1초), beforeAt 이후 레코드를 최대 timeoutMs 폴링 대기한다. */
async function waitForActivityUpdate(beforeAt, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rec = readLatestTurn();
    if (rec && rec.at && rec.at > beforeAt) return rec;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function clickAccept(page, testid) {
  // DOM click 이벤트 직접 발화 — 뷰포트/가시성과 무관하게 동작(ghost 툴바가 스크롤 밖이어도 ok)
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, testid);
}

async function acceptAll(page, step) {
  let accepted = 0;
  let fixTurns = 0;
  for (let i = 0; i < 16; i += 1) {
    const modalVisible = await page.locator('[data-testid="ai-proposal-accept"]').isVisible().catch(() => false);
    const ghostVisible = await page.locator('[data-testid="ghost-inline-accept"]').isVisible().catch(() => false);
    let clicked = false;
    if (modalVisible) {
      clicked = await clickAccept(page, "ai-proposal-accept");
    } else if (ghostVisible) {
      clicked = await clickAccept(page, "ghost-inline-accept");
    }
    if (clicked) {
      accepted += 1;
      await page.waitForTimeout(1000);
      // accept 후 상태 확인 — 배치 검증 실패면 결함 수정 턴을 주입하고 재시도
      const st = await page.evaluate(() => document.querySelector('[data-testid="ai-status"]')?.textContent ?? "");
      if (/배치 검증 실패/.test(st)) {
        logLine(`accept-status: ${st}`);
        if (fixTurns >= 2 || !step) break;
        fixTurns += 1;
        logLine(`배치 검증 실패 — 수정 턴 주입 (${fixTurns})`);
        const fixMsg =
          "아까 만든 마을을 배치 검증에서 거부했다: 물 타일 위에 소품/나무가 있고, 통행 불가 지형 위에 나무가 있다. " +
          "그 잘못 배치된 나무/소품들을 육지의 통행 가능한 잔디 칸으로 옮겨서 검증을 통과하게 고쳐라. " +
          "기존 집·길·수역은 건드리지 마.";
        await sendTurn(page, { id: `${step.id}-fix${fixTurns}`, title: "배치 결함 수정", text: fixMsg });
        await page.waitForTimeout(1500);
        continue;
      }
      if (/적용 실패|오류/.test(st)) logLine(`accept-status: ${st}`);
    } else break;
  }
  if (accepted) logLine(`accepted proposals: ${accepted}`);
  return accepted;
}

async function snapshot(page) {
  await page.waitForTimeout(300);
  const raw = await page.getByTestId("project-export-json").textContent().catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw).project;
  } catch {
    return null;
  }
}

async function forceSave(page) {
  return page.evaluate(async (pid) => {
    const { store } = await import("/src/project/store.ts");
    const { saveProjectToSupabase } = await import("/src/project/supabaseProjectSync.ts");
    const { supabaseProjectConfig } = await import("/src/project/supabaseProjectConfig.ts");
    const project = store.getCurrent();
    const cfg = supabaseProjectConfig();
    if (!cfg) return { kind: "no-config" };
    try {
      const r = await saveProjectToSupabase(project, { ...cfg, projectId: pid });
      return {
        kind: r.kind,
        title: project.meta?.title,
        maps: Object.keys(project.maps).map((id) => ({
          id,
          name: project.maps[id]?.name,
          w: project.maps[id]?.width,
          h: project.maps[id]?.height,
          events: project.maps[id]?.events?.length ?? 0,
        })),
      };
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  }, PROJECT_ID);
}

const env = loadEnv();
await mkdir(EVIDENCE, { recursive: true });
writeFileSync(path.join(EVIDENCE, "run-log.txt"), `start ${new Date().toISOString()} model=${MODEL}\n`);

const supabaseDraft = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: PROJECT_ID,
  source: "custom",
};
const aiConfig = {
  authMode: "apiKey",
  baseUrl: "/api/cpen",
  model: MODEL,
  liteModel: MODEL,
  apiKey: "",
  maxToolCalls: 200,
  maxTokens: 32768,
  reasoningEffort: "low",
  autoApprove: true,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("dialog", (d) => d.accept());
page.on("console", (m) => {
  const t = m.text();
  if (/error|LlmError|fail/i.test(t)) appendFileSync(path.join(EVIDENCE, "console.txt"), t + "\n");
});

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

logLine(`goto ${BASE} project ${PROJECT_ID}`);
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });

if (await page.getByTestId("db-required-panel").isVisible().catch(() => false)) {
  await page.getByTestId("db-config-connect").click().catch(async () => {
    await page.getByRole("button", { name: /연결/ }).first().click();
  });
  await page.waitForTimeout(2500);
}

await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });

try {
  await page.getByTestId("db-connection-status").click({ timeout: 5000 });
  const pid = page.locator('input[name="projectId"]');
  if (await pid.isVisible().catch(() => false)) {
    await pid.fill(PROJECT_ID);
    await page.getByTestId("db-config-connect").click();
    await page.waitForTimeout(4000);
  } else await page.keyboard.press("Escape");
} catch {
  /* */
}

await page.waitForFunction(() => typeof window.__rpgzzuAiBridge?.send === "function", null, { timeout: 60_000 });
await page.evaluate(() => {
  document.querySelector('[data-testid="ai-collapsed-restore"]')?.click?.();
});
logLine("bridge " + JSON.stringify(await page.evaluate(() => window.__rpgzzuAiBridge?.status?.())));
await page.screenshot({ path: path.join(EVIDENCE, "00-loaded.png"), fullPage: true });

const perTurn = [];
let currentModel = MODEL;
for (const step of STEPS) {
  const beforeAt = readLatestTurn()?.at ?? "";
  let r = null;
  let attempt = 0;
  let lastVerdict = null;
  while (attempt < 3) {
    attempt += 1;
    r = await sendTurn(page, step);
    const verdict = await waitForActivityUpdate(beforeAt);
    lastVerdict = verdict;
    if (verdict && verdict.ok) {
      logLine(`turn-verified ok (attempt ${attempt})`);
      break;
    }
    logLine(`turn NOT ok (attempt ${attempt}): ${verdict ? verdict.error : "no activity record"}`);
    if (attempt >= 3) break;
    // 2차 시도부터는 모델 폴백 (retry loop에서는 이미 pending 제안이 남아 재실행이 안 되므로
    // 1차 성공이 핵심 — 폴백은 이론상 경로만 유지)
    if (attempt >= 2 && currentModel !== FALLBACK_MODEL) {
      currentModel = FALLBACK_MODEL;
      await page.evaluate((m) => {
        const cfg = JSON.parse(localStorage.getItem("rpg-zzu:ai-config") ?? "{}");
        cfg.model = m;
        cfg.liteModel = m;
        localStorage.setItem("rpg-zzu:ai-config", JSON.stringify(cfg));
        window.location.reload();
      }, currentModel);
      await page.waitForTimeout(6000);
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 }).catch(() => {});
      await page.waitForFunction(() => typeof window.__rpgzzuAiBridge?.send === "function", null, { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(3_000); // 컨텍스트 재안정화
      logLine(`model fallback -> ${currentModel}`);
    }
  }
  logLine(`verdict=${JSON.stringify({ attempt, ok: lastVerdict?.ok, model: currentModel })}`);
  const accepted = await acceptAll(page, step);
  await page.screenshot({ path: path.join(EVIDENCE, `${step.id}.png`), fullPage: true });
  const snap = await snapshot(page);
  const info = snap
    ? Object.values(snap.maps || {}).map((m) => `${m.name} ${m.width}x${m.height} e${(m.events || []).length}`)
    : [];
  if (info.length) logLine("snapshot maps: " + info.join(" | "));
  perTurn.push({
    id: step.id,
    ok: r?.ok ?? false,
    error: r?.error ?? null,
    tools: [...new Set((r?.audit ?? []).filter((a) => a.name).map((a) => a.name))],
    toolCallCount: (r?.audit ?? []).filter((a) => a.name && a.durationMs != null).length,
    accepted,
    maps: snap ? Object.values(snap.maps || {}).map((m) => ({ name: m.name, w: m.width, h: m.height, events: (m.events || []).length })) : [],
  });
  writeFileSync(path.join(EVIDENCE, "per-turn.json"), JSON.stringify(perTurn, null, 2) + "\n");
  // T1 직후 1회 중간 저장(충돌 리스크 감소) — 단, 맵이 비어 있으면(리셋 직후) 저장 스킵
  if (step.id === "T1") {
    const snap0 = await snapshot(page);
    const m0 = Object.values(snap0?.maps ?? {})[0];
    const nonEmpty = m0 && JSON.stringify(m0.tiles ?? m0).length > 2000;
    if (nonEmpty) {
      const mid = await forceSave(page);
      logLine("mid-save " + JSON.stringify(mid));
    } else {
      logLine("mid-save SKIPPED (map appears empty/reset)");
    }
  }
}

const finalSave = await forceSave(page);
logLine("final-save " + JSON.stringify(finalSave));

// 저장 후 재로드 검증 (hard rule: save → load 증명)
const reload = await page.evaluate(async (pid) => {
  const { loadProjectFromSupabase } = await import("/src/project/supabaseProjectSync.ts");
  const { supabaseProjectConfig } = await import("/src/project/supabaseProjectConfig.ts");
  const cfg = supabaseProjectConfig();
  if (!cfg) return { ok: false, error: "no-config" };
  const p = await loadProjectFromSupabase({ ...cfg, projectId: pid });
  if (!p) return { ok: false, error: "load null" };
  return {
    ok: true,
    title: p.meta?.title,
    maps: Object.values(p.maps).map((m) => ({ name: m.name, w: m.width, h: m.height, events: (m.events || []).length })),
    switchesNamed: (p.switches || []).filter((s) => s.name).length,
    variablesNamed: (p.variables || []).filter((v) => v.name).length,
  };
}, PROJECT_ID);
logLine("reload-verify " + JSON.stringify(reload));
writeFileSync(path.join(EVIDENCE, "reload-verify.json"), JSON.stringify(reload, null, 2) + "\n");

const project = await snapshot(page);
if (project) {
  writeFileSync(path.join(EVIDENCE, "project-final.json"), JSON.stringify(project, null, 2) + "\n");
  const ser = JSON.stringify(project);
  const summary = {
    title: project.meta?.title,
    projectId: PROJECT_ID,
    model: MODEL,
    maps: Object.values(project.maps).map((m) => ({ name: m.name, w: m.width, h: m.height, events: (m.events || []).length })),
    npcs: ser.split('"place_npc"').length - 1,
    hasQuestSwitches: (project.switches || []).some((s) => /퀘|의뢰|약초/.test(s.name || "")),
    hasChoices: ser.includes("choices"),
    hasTransfer: ser.includes("transfer"),
    startInVillage: project.startPos,
    turns: perTurn,
  };
  writeFileSync(path.join(EVIDENCE, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  logLine("SUMMARY " + JSON.stringify(summary, null, 2));
}

await page.screenshot({ path: path.join(EVIDENCE, "99-final.png"), fullPage: true });
await browser.close();
logLine("done " + new Date().toISOString());
