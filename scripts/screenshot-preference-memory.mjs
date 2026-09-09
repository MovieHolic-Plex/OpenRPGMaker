/**
 * 사람 성향 기억 + 공용 프롬프트 봉투 증거 캡처.
 *
 * 실제 LLM 자격증명 없이 **진짜 전송 경로**를 지나가게 하려고 `/v1/chat/completions` 를
 * page.route 로 가로챈다. 스텁이 응답만 만들고, 요청(엔드포인트·헤더·본문)은 앱이 만든
 * 그대로 기록한다 — 이게 "라우트가 하나로 합쳐졌다"의 유일한 실물 증거다.
 *
 * 사용: RPG_ZZU_URL=http://127.0.0.1:9761 node scripts/screenshot-preference-memory.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9761";
const OUT = "output/evidence/ai-preference-memory";
const VIEWPORT = { width: 1500, height: 940 };

const captured = [];
const notes = {};

async function shot(page, name, locator) {
  const file = path.join(OUT, name);
  if (locator) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file });
  }
  console.log("shot", name);
  return name;
}

function stubReply(body) {
  const system = String(body?.messages?.[0]?.content ?? "");
  // 증류기 판별 — 시스템 프롬프트로 채널을 가른다.
  if (system.includes("작업 성향을 정리하는 요약기")) {
    return JSON.stringify({
      upsert: [
        { text: "마을 규모는 집 4채 이하로 작게 유지한다", scope: "global", strength: "strong" },
      ],
      drop: [],
    });
  }
  if (body?.response_format?.type === "json_object") {
    // 타일셋 매핑 채널 — 스키마 고정 JSON.
    return JSON.stringify({ terrainTiles: [], propTiles: [], minimumQuestions: [] });
  }
  return "알겠습니다. 마을은 작게 유지하겠습니다.";
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: VIEWPORT });
page.on("dialog", (d) => d.accept());
page.on("console", (m) => {
  if (m.type() === "error") console.log("[browser error]", m.text().slice(0, 200));
});
await mkdir(OUT, { recursive: true });

// ── 사전 주입: 전문가 UI 모드 + 동반 서비스(OAuth) 설정 ──────────────────
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", JSON.stringify({ mode: "expert" }));
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem(
    "oprn:ai-config",
    JSON.stringify({
      authMode: "chatgpt",
      providerId: "google-antigravity",
      baseUrl: "/v1",
      model: "gemini-3.7-flash",
      liteModel: "gemini-3.7-flash",
      apiKey: "",
      maxToolCalls: 8,
      maxTokens: 4096,
      agentMode: "chat",
    }),
  );
});

await page.route("**/chat/completions", async (route) => {
  const request = route.request();
  let body = null;
  try {
    body = request.postDataJSON();
  } catch {
    body = null;
  }
  captured.push({
    at: captured.length,
    url: request.url(),
    method: request.method(),
    headers: request.headers(),
    model: body?.model ?? null,
    temperature: body?.temperature ?? null,
    responseFormat: body?.response_format ?? null,
    maxTokens: body?.max_tokens ?? null,
    systemPromptHead: String(body?.messages?.[0]?.content ?? "").slice(0, 900),
    systemPromptChars: String(body?.messages?.[0]?.content ?? "").length,
    userContentKinds: Array.isArray(body?.messages?.[1]?.content)
      ? body.messages[1].content.map((p) => p.type)
      : typeof body?.messages?.[1]?.content === "string"
        ? ["text"]
        : [],
  });
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: "stub",
      model: body?.model ?? "gemini-3.7-flash",
      choices: [{ index: 0, message: { role: "assistant", content: stubReply(body) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }),
  });
});

console.log("goto…");
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
await page.waitForTimeout(1800);

// ── 1) 문맥: 에디터 전체 ───────────────────────────────────────────────
const panel = page.getByTestId("ai-panel");
await panel.waitFor({ state: "attached", timeout: 20_000 });
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) {
  await restore.click();
  await page.waitForTimeout(500);
}
await shot(page, "01-editor-overview.png");

// ── 2) 성향 목록 빈 상태 ───────────────────────────────────────────────
// 진입점은 채팅 컴포저 액션 행의 ⌾ 버튼이다(2026-08-30 감독 지시) — 톱바 `AI 설정` 모달이
// 아니다. 성향을 배우는 자리와 고치는 자리를 같은 패널에 둔다.
async function openPreferences() {
  const opened = await page.getByTestId("ai-preference-popover").isVisible().catch(() => false);
  if (opened) return;
  await page.getByTestId("ai-preference-toggle").click();
  await page.getByTestId("ai-preference-settings").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(350);
}
async function closePreferences() {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
}

await openPreferences();
const section = page.getByTestId("ai-preference-settings");
await shot(page, "02-preference-empty.png", section);
notes.emptyText = (await section.textContent())?.replace(/\s+/g, " ").trim() ?? "";

// ── 3) 사람이 직접 추가 ────────────────────────────────────────────────
await page.getByTestId("ai-preference-add-input").fill("적은 항상 3마리 이하로 배치해 줘");
await page.getByTestId("ai-preference-add").click();
await page.waitForTimeout(300);
await shot(page, "03-preference-manual-added.png", section);
notes.manualStored = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("oprn:ai-preference-memory") ?? "{}"),
);

// ── 4) 관측된 성향 2층(전역 + 프로젝트) ────────────────────────────────
await closePreferences();
notes.projectScopeKey = await page.evaluate(async () => {
  const store = await import("/src/project/store.ts");
  const conv = await import("/src/ai/conversationStore.ts");
  return conv.conversationScopeKey(store.store.getProjectIdentity(), store.store.getCurrent());
});
await page.evaluate(async (scopeKey) => {
  const mem = await import("/src/ai/preferenceMemory.ts");
  mem.savePreferenceFacts([
    {
      id: "obs-scale",
      text: "마을 규모는 집 4채 이하로 작게 유지한다",
      scope: "global",
      strength: "strong",
      evidence: 4,
      source: "observed",
      updatedAt: 1_756_500_000_000,
    },
    {
      id: "obs-tone",
      text: "어둡고 음침한 분위기를 선호한다",
      scope: "global",
      strength: "medium",
      evidence: 2,
      source: "observed",
      updatedAt: 1_756_500_000_000,
    },
    {
      id: "man-enemy",
      text: "적은 항상 3마리 이하로 배치해 줘",
      scope: "global",
      strength: "strong",
      evidence: 1,
      source: "manual",
      updatedAt: 1_756_500_000_000,
      pinned: true,
    },
    {
      id: "proj-horror",
      text: "이 게임은 호러 톤이다 — 밝은 색 타일을 쓰지 않는다",
      scope: "project",
      projectScopeKey: scopeKey,
      strength: "strong",
      evidence: 3,
      source: "stated",
      updatedAt: 1_756_500_000_000,
    },
    {
      id: "proj-other",
      text: "남의 프로젝트 사실 — 이 화면에 보이면 유출이다",
      scope: "project",
      projectScopeKey: "local:다른게임::map-9",
      strength: "strong",
      evidence: 9,
      source: "observed",
      updatedAt: 1_756_500_000_000,
    },
  ]);
}, notes.projectScopeKey);

await openPreferences();
await shot(page, "04-preference-two-tiers.png", section);
notes.twoTierText = (await section.textContent())?.replace(/\s+/g, " ").trim() ?? "";
notes.leakCheck = notes.twoTierText.includes("남의 프로젝트 사실") ? "LEAKED" : "격리됨";
// 패널 전체를 잡는다. 팝오버는 `bottom: 100%` 로 바 **위로** 열리므로 `.ai-command-bar` 로
// 자르면 버튼만 남고 목록이 프레임 밖으로 빠진다(실측 — 04b 첫 판이 그렇게 나왔다).
await shot(page, "04b-preference-in-composer.png", panel);

// ── 5) 고정 토글 ───────────────────────────────────────────────────────
const rowByText = (text) =>
  page.locator("[data-testid='ai-preference-row']").filter({ hasText: text }).first();
const toneRow = rowByText("어둡고 음침한");
const tonePin = toneRow.getByTestId("ai-preference-pin");
notes.pinBefore = await tonePin.getAttribute("aria-pressed");
await tonePin.click();
await page.waitForTimeout(250);
notes.pinAfter = await page
  .locator("[data-testid='ai-preference-row']")
  .filter({ hasText: "어둡고 음침한" })
  .first()
  .getByTestId("ai-preference-pin")
  .getAttribute("aria-pressed");
await shot(page, "05-preference-pinned.png", section);

// ── 6) 삭제 ────────────────────────────────────────────────────────────
notes.rowsBeforeDelete = await page.locator("[data-testid='ai-preference-row']").count();
await rowByText("어둡고 음침한").getByTestId("ai-preference-delete").click();
await page.waitForTimeout(250);
notes.rowsAfterDelete = await page.locator("[data-testid='ai-preference-row']").count();
await shot(page, "06-preference-deleted.png", section);

// 지운 것을 되살려 프롬프트 예시를 원래대로 유지한다.
await page.evaluate(async () => {
  const mem = await import("/src/ai/preferenceMemory.ts");
  mem.upsertPreferenceFact({
    text: "어둡고 음침한 분위기를 선호한다",
    scope: "global",
    strength: "medium",
    source: "observed",
  });
});
await closePreferences();

// ── 7) 실제 시스템 프롬프트 블록 ───────────────────────────────────────
notes.prompt = await page.evaluate(async (scopeKey) => {
  const mem = await import("/src/ai/preferenceMemory.ts");
  const env = await import("/src/ai/systemPromptEnvelope.ts");
  const block = mem.buildPreferenceMemorySection(scopeKey);
  return {
    memorySection: block,
    memorySectionChars: block.length,
    eventCommand: env.composeSystemPrompt({
      surface: "event-command",
      body: "(이벤트 명령 변환 채널의 본문은 길어서 생략)",
      includePolicy: false,
      includeMemory: true,
      projectScopeKey: scopeKey,
    }),
    tileset: env.composeSystemPrompt({
      surface: "tileset-analysis",
      body: "Return exactly one JSON object for the requested tileset metadata.",
      includePolicy: false,
      includeMemory: false,
    }),
    structureKit: env.composeSystemPrompt({
      surface: "structure-kit",
      body: "(구조 키트 채널 본문 생략)",
      includePolicy: true,
      includeMemory: true,
      projectScopeKey: scopeKey,
    }),
  };
}, notes.projectScopeKey);

// ── 8) 되돌리기 신호 → 집계 ────────────────────────────────────────────
notes.signals = await page.evaluate(async () => {
  const sig = await import("/src/ai/preferenceSignals.ts");
  const fmt = (counters) =>
    Object.entries(counters).map(([key, c]) => `${key}: +${c.pos} / -${c.neg}`);
  const scenarios = [];
  const reset = () => localStorage.removeItem("oprn:ai-preference-signals");

  // A) 시공 → 사람이 Ctrl+Z
  reset();
  sig.observeTurn({ instruction: "마을 만들어 줘. 집 8채로 크게", toolNames: ["author_house"], changed: true });
  sig.noteAiChangeUndone({ toolNames: ["author_house"] });
  scenarios.push({
    name: "되돌리기",
    story: ["\"마을 만들어 줘. 집 8채로 크게\" → 시공됨", "사람이 Ctrl+Z"],
    counters: fmt(sig.loadPreferenceSignals().counters),
    pending: sig.loadPreferenceSignals().pending.map((p) => `${p.kind} (${p.weight})`),
  });

  // A-2) 되돌린 턴에 정정까지 붙어도 이중 계산되지 않는다
  sig.observeTurn({ instruction: "아니 너무 크다고", toolNames: [], changed: false });
  scenarios.push({
    name: "되돌리기 + 정정(이중 계산 없음)",
    story: ["위 상태에서 곧바로 \"아니 너무 크다고\""],
    counters: fmt(sig.loadPreferenceSignals().counters),
    pending: sig.loadPreferenceSignals().pending.map((p) => `${p.kind} (${p.weight})`),
  });

  // B) 되돌리지 않고 말로만 정정
  reset();
  sig.observeTurn({ instruction: "마을 만들어 줘. 집 8채로 크게", toolNames: ["author_house"], changed: true });
  sig.observeTurn({ instruction: "아니 그게 아니라 너무 크다고", toolNames: [], changed: false });
  scenarios.push({
    name: "정정 발화만",
    story: ["시공됨(되돌리지 않음)", "60초 안에 \"아니 그게 아니라 너무 크다고\""],
    counters: fmt(sig.loadPreferenceSignals().counters),
    pending: sig.loadPreferenceSignals().pending.map((p) => `${p.kind} (${p.weight})`),
  });

  // C) 무사 통과
  reset();
  sig.observeTurn({ instruction: "여관 하나 지어 줘", toolNames: ["author_inn"], changed: true });
  sig.observeTurn({ instruction: "좋다. 이제 상점도", toolNames: ["place_npc"], changed: true });
  scenarios.push({
    name: "무사 통과",
    story: ["\"여관 하나 지어 줘\" → 시공됨", "다음 턴까지 불만 없음"],
    counters: fmt(sig.loadPreferenceSignals().counters),
    pending: sig.loadPreferenceSignals().pending.map((p) => `${p.kind} (${p.weight})`),
  });

  // D) 창 밖(60초 초과) 정정은 신호가 아니다
  reset();
  const t0 = 1_756_500_000_000;
  let state = sig.observeTurnIn(sig.loadPreferenceSignals(), {
    instruction: "마을 만들어 줘. 집 8채로 크게",
    toolNames: ["author_house"],
    changed: true,
    at: t0,
  });
  state = sig.observeTurnIn(state, {
    instruction: "아니 너무 크다",
    toolNames: [],
    changed: false,
    at: t0 + sig.CORRECTION_WINDOW_MS + 1,
  });
  scenarios.push({
    name: "60초 지난 뒤 정정",
    story: ["시공됨", `${sig.CORRECTION_WINDOW_MS / 1000}초 + 1ms 뒤 "아니 너무 크다"`],
    counters: fmt(state.counters),
    pending: state.pending.map((p) => `${p.kind} (${p.weight})`),
  });

  reset();
  return {
    scenarios,
    weights: { undo: sig.UNDO_WEIGHT, correction: sig.CORRECTION_WEIGHT, settled: sig.SETTLED_WEIGHT },
    windowMs: sig.CORRECTION_WINDOW_MS,
    threshold: sig.DISTILL_PENDING_THRESHOLD,
    cues: { correction: sig.CORRECTION_CUES, stated: sig.STATED_PREFERENCE_CUES },
  };
});

// ── 9) 채팅 1턴 — 명시 선언 → 즉시 증류 → 시스템 버블 ──────────────────
console.log("chat turn…");
const capturedBeforeChat = captured.length;
await page.getByTestId("ai-input").fill("앞으로 마을은 항상 집 4채 이하로 작게 만들어 줘");
await page.getByTestId("ai-send").click();
await page
  .locator(".ai-bubble-system, [data-role=system]")
  .filter({ hasText: "기억했습니다" })
  .first()
  .waitFor({ state: "visible", timeout: 60_000 })
  .catch(() => console.log("!! 성향 버블 대기 실패 — 로그로 확인"));
await page.waitForTimeout(1200);
await shot(page, "07-chat-memory-bubble.png", page.getByTestId("ai-chat-log"));
await shot(page, "07b-chat-panel-full.png", panel);
notes.chatLogText = (await page.getByTestId("ai-chat-log").textContent())?.replace(/\s+/g, " ").trim() ?? "";
notes.chatRequestCount = captured.length - capturedBeforeChat;

// ── 10) 타일셋 채널 — 같은 전송층을 지나는지 ────────────────────────────
console.log("tileset channel…");
const beforeTileset = captured.length;
notes.tilesetResult = await page.evaluate(async () => {
  const client = await import("/src/editor/panels/tilesetAiClient.ts");
  return await client.requestTilesetMapping({
    prompt: "이 타일셋의 지형/소품 칸을 분류해 주세요.",
    imageDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  });
});
notes.tilesetRequests = captured.slice(beforeTileset);

// ── 11) 성향이 프로젝트를 넘어 남는지 ──────────────────────────────────
console.log("cross-project…");
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
await page.waitForTimeout(1500);
// 주의: `?freshProject=1` 은 제목·시작맵이 같아 **조회 키가 그대로다.** 그래서 "다른
// 프로젝트"는 키를 바꿔 확인한다 — 전역은 남고 프로젝트 층만 갈리는지가 요점이다.
notes.afterReload = await page.evaluate(async (thisKey) => {
  const mem = await import("/src/ai/preferenceMemory.ts");
  const here = mem.listPreferenceFacts(thisKey);
  const other = mem.listPreferenceFacts("local:다른게임::map-9");
  const none = mem.listPreferenceFacts();
  const fmt = (facts) => facts.map((f) => `[${f.strength}] ${f.text} (근거 ${f.evidence})`);
  return {
    sameProject: { global: fmt(here.global), project: fmt(here.project) },
    otherProject: { global: fmt(other.global), project: fmt(other.project) },
    noKey: { global: fmt(none.global), project: fmt(none.project) },
    sectionSameProject: mem.buildPreferenceMemorySection(thisKey),
    sectionOtherProject: mem.buildPreferenceMemorySection("local:다른게임::map-9"),
  };
}, notes.projectScopeKey);
const restore2 = page.getByTestId("ai-collapsed-restore");
if (await restore2.isVisible().catch(() => false)) {
  await restore2.click();
  await page.waitForTimeout(400);
}
await openPreferences();
await shot(page, "08-preference-survives-new-project.png", page.getByTestId("ai-preference-settings"));

notes.captured = captured;
await writeFile(path.join(OUT, "evidence.json"), JSON.stringify(notes, null, 2));
console.log("requests captured:", captured.length);
console.log("done →", OUT);
await browser.close();
