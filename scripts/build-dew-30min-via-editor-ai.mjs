/**
 * 《이슬 장터 — 30분》 단계별 내장 AI 시공.
 * 전제: npm run dev (9173), npm run mcp:assistant
 * 시드: npx tsx scripts/wipe-and-seed-dew-30min.mts
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9173";
const PROJECT_ID = "rpg-zzu-dew-30min";
const EVIDENCE = "output/evidence/dew-30min-plan";
const TURN_MS = Number(process.env.AI_TURN_TIMEOUT_MS ?? 480_000);

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

function logLine(msg) {
  console.log(msg);
  appendFileSync(path.join(EVIDENCE, "run-log.txt"), msg + "\n");
}

/** 한 턴 = 한 목표. 도구 이름·수치를 문장에 박아 모델이 추측하지 않게 한다. */
const STEPS = [
  {
    id: "S01",
    title: "100x100 마을 시공",
    text: [
      "지금 시작 맵 '이슬 장터 마을'은 이미 100x100 빈 잔디다.",
      "이 맵(mapId는 현재 시작 맵)에 다음을 **정확히** 실행하라:",
      "build_village({ mapId: 현재시작맵, width:100, height:100, name:\"이슬 장터 마을\", theme:\"강가 장터 마을\", houses:16, pathStyle:\"sand\", kitMix:\"mixed\", interior:true, fences:true, decor:true, edgeTrees:\"conifer\", plazaLayout:\"center\", seed:30, skipTerrain:false })",
      "성공 후 시작 위치를 광장 중앙 근처(대략 맵 중앙)로 맞춰라.",
      "다른 맵을 새로 만들지 말고 **기존 100x100 맵에만** 시공하라.",
    ].join(" "),
  },
  {
    id: "S02",
    title: "수역·랜드마크",
    text: [
      "현재 맵(100x100 이슬 장터 마을)에만 작업하라.",
      "1) 북동 사분면(대략 x=70..95, y=5..30)에 원형 호수: fill_region shape:circle material 물/호수.",
      "2) 서쪽 가장자리 x=0..6 전 높이에 강물 띠 fill_region rect.",
      "3) 광장 중앙 근처(시작 위치 옆)에 조사 가능한 표지판 이벤트 1개: text로 '북쪽 숲·서쪽 폐광·동쪽 종탑 사당'.",
      "set_build_spec으로 구역을 잡고 진행하라. 집/길을 지우지 마라.",
    ].join(" "),
  },
  {
    id: "S03a",
    title: "달빛 숲 맵",
    text: [
      "새 맵을 만든다: create_map 또는 동등 도구로 name:\"달빛 숲\", width:40, height:40.",
      "잔디 바탕 + 중앙 세로 흙길 paint_road + 작은 원형 연못 1.",
      "place_props로 나무 소량.",
      "create_transfer_pair로 이슬 장터 마을 북쪽(대략 y=2, x=50 근처 통행 가능 칸) ↔ 달빛 숲 남쪽 입구를 연결.",
      "좌표가 막히면 통행 가능한 인접 칸을 골라라. 맵 이름만으로 찾아라.",
    ].join(" "),
  },
  {
    id: "S03b",
    title: "폐광·사당 맵",
    text: [
      "맵 추가 1: name:\"폐광 입구\" 36x36. 어두운 바닥/흙 위주, 가로 중앙 길.",
      "맵 추가 2: name:\"종탑 사당\" 24x24. 중앙 넓은 바닥.",
      "이슬 장터 마을 서쪽 가장자리 ↔ 폐광 입구 동쪽 입구 transfer.",
      "이슬 장터 마을 동쪽 가장자리 ↔ 종탑 사당 서쪽 입구 transfer.",
      "create_transfer_pair 사용. 기존 100x100 마을 맵을 삭제하지 마라.",
    ].join(" "),
  },
  {
    id: "S04",
    title: "Q1 장로·약초",
    text: [
      "스위치: sw_0001=Q1수락, var_0001=약초개수, sw_0002=Q1완료. 이름을 설정하라.",
      "이슬 장터 마을 광장에 촌장 '미르' place_npc:",
      "페이지1: 종이 약해졌다고 설명 + choices 수락/나중에. 수락 시 setSwitch sw_0001 true, setVariable var_0001 = 0.",
      "페이지2: 조건 sw_0001 on & sw_0002 off & (가능하면 var_0001 < 3): 약초 3개 모으라고 상기.",
      "페이지3: 조건 var_0001 >= 3 또는 sw_0002: 아직 안 켜졌으면 보상 후 setSwitch sw_0002, changeGold +=100, changeItem 포션+1, Q2 예고.",
      "달빛 숲에 약초 이벤트 3개(서로 다른 좌표): 조건 sw_0001, text 줍기, setVariable var_0001 +=1, 2페이지는 빈자리.",
      "달빛 숲 슬라임 1: 조건 sw_0001, battleProcessing troop_slime, canEscape true.",
    ].join(" "),
  },
  {
    id: "S05",
    title: "Q2 광산 열쇠",
    text: [
      "스위치 sw_0003=Q2수락, sw_0004=열쇠획득.",
      "미르 또는 마을 경비 NPC: sw_0002 이후에만 Q2 제안 choices → setSwitch sw_0003.",
      "폐광 입구 안쪽에 '열쇠 슬라임': 조건 sw_0003, battleProcessing troop_slime 또는 troop_slime_pair, 승리 후 setSwitch sw_0004, changeItem.",
      "폐광 상자 1: changeGold +=50.",
      "종탑 사당 쪽 문은 아직 잠글 필요 없으면 대사만: sw_0004 없으면 '열쇠가 필요하다'.",
    ].join(" "),
  },
  {
    id: "S06",
    title: "Q3 종탑 엔딩",
    text: [
      "스위치 sw_0005=Q3수락, sw_0006=보스클리어.",
      "미르: sw_0004 이후 Q3 수락 setSwitch sw_0005.",
      "종탑 사당 중앙 보스 이벤트: 조건 sw_0005 & !sw_0006, battleProcessing troop_golem_guard(없으면 troop_slime_pair),",
      "승리 후 setSwitch sw_0006, changeGold +=200, ending title:\"이슬 장터\" message:\"종이 다시 울리고 장터에 아침이 돌아왔다.\"",
      "클리어 후 페이지: 이미 끝났다 대사.",
      "마을 치유사 '노아' recoverAll, 상인 shop 가능하면 기본 아이템.",
    ].join(" "),
  },
  {
    id: "S07",
    title: "밀도 NPC",
    text: [
      "이슬 장터 마을에 ambient NPC 6명 이상 place_npc (상인 손님, 아이, 어부 등).",
      "각자 1~2줄 대사. 서로 이름·장소를 언급해 마을이 살게.",
      "이동 type random 일부 허용. 기존 퀘스트 이벤트를 덮어쓰지 마라.",
    ].join(" "),
  },
];

async function sendTurn(page, step) {
  logLine(`\n=== ${step.id} ${step.title} ===`);
  logLine(step.text.slice(0, 200) + "…");
  const result = await page.evaluate(
    async ({ msg, timeoutMs }) => {
      const bridge = window.__oprnAiBridge;
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
  logLine(`ok=${result?.ok} err=${result?.error ?? ""}`);
  logLine("assistant: " + String(result?.lastAssistantText ?? "").slice(0, 500));
  const tools = (result?.audit ?? []).filter((a) => a.name).map((a) => a.name);
  if (tools.length) logLine("tools: " + [...new Set(tools)].join(", "));
  return result;
}

async function acceptAll(page) {
  for (let i = 0; i < 8; i += 1) {
    const acc = page.locator('[data-testid*="proposal-accept"], [data-testid="ai-proposal-accept"]').first();
    if (await acc.isVisible().catch(() => false)) {
      await acc.click({ force: true });
      await page.waitForTimeout(500);
      logLine("accepted proposal");
    } else break;
  }
}

async function snapshot(page) {
  await page.waitForTimeout(300);
  const raw = await page.getByTestId("project-export-json").textContent();
  if (!raw) return null;
  try {
    return JSON.parse(raw).project;
  } catch {
    return null;
  }
}

async function forceSave(page) {
  return page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { saveProjectToSupabase } = await import("/src/project/supabaseProjectSync.ts");
    const { supabaseProjectConfig } = await import("/src/project/supabaseProjectConfig.ts");
    const project = store.getCurrent();
    const cfg = supabaseProjectConfig();
    if (!cfg) return { kind: "no-config" };
    try {
      const r = await saveProjectToSupabase(project, { ...cfg, projectId: "rpg-zzu-dew-30min" });
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
  });
}

const env = loadEnv();
await mkdir(EVIDENCE, { recursive: true });
writeFileSync(path.join(EVIDENCE, "run-log.txt"), `start ${new Date().toISOString()}\n`);

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

await page.waitForFunction(() => typeof window.__oprnAiBridge?.send === "function", null, { timeout: 60_000 });
await page.evaluate(() => {
  document.querySelector('[data-testid="ai-collapsed-restore"]')?.click?.();
});
logLine("bridge " + JSON.stringify(await page.evaluate(() => window.__oprnAiBridge?.status?.())));
await page.screenshot({ path: path.join(EVIDENCE, "00-loaded.png"), fullPage: true });

for (const step of STEPS) {
  await sendTurn(page, step);
  await acceptAll(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${step.id}.png`), fullPage: true });
  const snap = await snapshot(page);
  if (snap) {
    const maps = Object.values(snap.maps || {}).map((m) => `${m.name} ${m.width}x${m.height} e${(m.events || []).length}`);
    logLine("snapshot maps: " + maps.join(" | "));
  }
  // mid-save to reduce conflict risk
  if (step.id === "S01" || step.id === "S03b" || step.id === "S06") {
    const mid = await forceSave(page);
    logLine("mid-save " + JSON.stringify(mid));
  }
}

const finalSave = await forceSave(page);
logLine("final-save " + JSON.stringify(finalSave));

const project = await snapshot(page);
if (project) {
  writeFileSync(path.join(EVIDENCE, "project-final.json"), JSON.stringify(project, null, 2) + "\n");
  writeFileSync("src/project/defaults/fixtures/dew-village-demo.json", JSON.stringify(project, null, 2) + "\n");
  writeFileSync("test/fixtures/projects/dew-village-demo.json", JSON.stringify(project, null, 2) + "\n");
  const ser = JSON.stringify(project);
  const summary = {
    title: project.meta?.title,
    projectId: PROJECT_ID,
    maps: Object.values(project.maps).map((m) => ({
      name: m.name,
      w: m.width,
      h: m.height,
      events: (m.events || []).length,
    })),
    has100: Object.values(project.maps).some((m) => m.width >= 100 && m.height >= 100),
    choices: ser.includes("choices"),
    battle: ser.includes("battleProcessing"),
    ending: ser.includes("ending"),
    transfer: ser.includes("transfer"),
    recover: ser.includes("recoverAll"),
    mir: ser.includes("미르"),
  };
  writeFileSync(path.join(EVIDENCE, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  logLine("SUMMARY " + JSON.stringify(summary, null, 2));
}

await page.screenshot({ path: path.join(EVIDENCE, "99-final.png"), fullPage: true });
await browser.close();
logLine("done " + new Date().toISOString());
