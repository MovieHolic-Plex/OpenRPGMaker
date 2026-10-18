/**
 * 바로 깔기 3-Tier 명령 분류 & 가드 계약 + 지우기/옮기기/깔기 Playwright 실검증 스크립트
 *
 * 검증 시나리오:
 *   Case 1 (깔기): "광장 주변에 가로등 두 개와 화분 놓아줘"
 *   Case 2-A (지우기 1): "오른쪽 위 나무 지워줘"
 *   Case 2-B (지우기 2): "광장 분수대 없애줘"
 *   Case 2-C (옮기기 1): "우물을 광장 한가운데로 옮겨줘"
 *   Case 2-D (옮기기 2): "집을 오른쪽으로 4칸 옮겨줘"
 *   Case 3-A (거부 가드 1): "퀘스트 세우기" -> FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT + 원클릭 핸드오프 버튼
 *   Case 3-B (거부 가드 2): "광장에 보스 이벤트 만들기" -> FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT + 원클릭 핸드오프 동작 검증
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT ?? "9897");
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.OUT ?? "/home/main/claude-viz/stamp-jrpg/fastpath-guard");
fs.mkdirSync(OUT, { recursive: true });

// 모델 계획 응답 대본 (깔기·지우기·옮기기 단계)
const MODEL_PLANS = {
  "광장 주변에 가로등 두 개와 화분 놓아줘": {
    steps: [
      { tool: "place_object", args: { name: "가로등", count: 2, area: { x: 10, y: 7, w: 12, h: 10 } }, label: "광장 주변 가로등 2개" },
      { tool: "place_object", args: { name: "화분", count: 2, area: { x: 11, y: 8, w: 10, h: 9 } }, label: "광장 주변 화분 2개" },
    ],
  },
  "오른쪽 위 나무 지워줘": {
    steps: [
      { tool: "erase_object", args: { query: "나무", region: "오른쪽 위" }, label: "오른쪽 위 나무 지우기" },
    ],
  },
  "광장 분수대 없애줘": {
    steps: [
      { tool: "erase_object", args: { query: "분수대", region: "광장" }, label: "광장 분수대 지우기" },
    ],
  },
  "우물을 광장 한가운데로 옮겨줘": {
    steps: [
      { tool: "move_object", args: { query: "우물", toRegion: "광장 한가운데" }, label: "우물을 광장 한가운데로 옮기기" },
    ],
  },
  "집을 오른쪽으로 4칸 옮겨줘": {
    steps: [
      { tool: "move_object", args: { query: "집", dx: 4, dy: 0 }, label: "집을 오른쪽으로 4칸 옮기기" },
    ],
  },
};

async function startViteServer() {
  const proc = spawn("./node_modules/.bin/vite", ["--port", String(PORT), "--host", "127.0.0.1"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("vite start timeout")), 45_000);
    proc.stdout.on("data", (chunk) => {
      const text = String(chunk);
      if (text.includes(String(PORT)) || text.includes("Local:")) {
        clearTimeout(timer);
        resolve(undefined);
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  return proc;
}

const viteProc = await startViteServer();
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.addInitScript(() => {
    localStorage.setItem("oprn:ai-stamp-place", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
    localStorage.setItem(
      "oprn:ai-config",
      JSON.stringify({
        authMode: "apiKey",
        baseUrl: "http://127.0.0.1:9999/v1",
        model: "gemini-4-argon-medium",
        liteModel: "gemini-4-argon-medium",
        apiKey: "qa-stub-key",
      }),
    );
  });

  const modelCalls = [];
  await page.route("**/v1/chat/completions", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const messages = body.messages ?? [];
    const users = messages.filter((m) => m.role !== "system");
    let payload = {};
    try {
      payload = JSON.parse(String(users[0]?.content ?? "{}"));
    } catch {
      payload = {};
    }
    const sentence = String(payload.sentence ?? "");
    const plan = MODEL_PLANS[sentence] ?? { steps: [] };
    modelCalls.push({ sentence, plan });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "qa-fastpath",
        model: body.model ?? "stub",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(plan) } }],
      }),
    });
  });

  await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.waitForFunction(() => typeof window.__oprnEditorTool === "function", null, { timeout: 30_000 });

  // 테스트용 버들항 마을 맵 준비 (광장 + 분수대 + 오른쪽 위 나무 + 우물 + 집)
  const mapId = await page.evaluate(async () => {
    const t = window.__oprnEditorTool;
    const must = (name, args) => {
      const r = t(name, args);
      if (!r.ok) throw new Error(`${name} failed: ${r.summary}`);
      return r;
    };
    const id = "t_fastpath_qa";
    must("create_map", { name: "버들항 광장 마을", id, width: 32, height: 22, tilesetId: "beodeul_city" });
    must("fill_region", { mapId: id, rect: { x: 0, y: 0, w: 32, h: 22 }, material: "버들항 풀밭" });
    // 가운데 광장 바닥 (x: 11..21, y: 7..15, 11x9)
    must("fill_region", { mapId: id, rect: { x: 11, y: 7, w: 11, h: 9 }, material: "버들항 광장 판석" });
    // 1) 광장 분수대 (4×4 돌 수반 bd-pick-desert-oasis-well at 14,9)
    must("stamp_tileset_object", { mapId: id, objectId: "bd-pick-desert-oasis-well", at: { x: 14, y: 9 }, overwrite: true });
    // 2) 오른쪽 위 나무 두 그루 (bd-tree-03a8f7 at 23,2 and bd-tree-3e8732 at 27,3)
    must("stamp_tileset_object", { mapId: id, objectId: "bd-tree-03a8f7", at: { x: 23, y: 2 }, overwrite: true });
    must("stamp_tileset_object", { mapId: id, objectId: "bd-tree-3e8732", at: { x: 27, y: 3 }, overwrite: true });
    // 3) 왼쪽 아래 돌 우물 (bd-prop-well_roofed 2×2 at 4,15)
    must("stamp_tileset_object", { mapId: id, objectId: "bd-prop-well_roofed", at: { x: 4, y: 15 }, overwrite: true });
    // 4) 왼쪽 위 살림집 한 채 (bd-house-h103_1 5×6 at 2,2)
    must("stamp_tileset_object", { mapId: id, objectId: "bd-house-h103_1", at: { x: 2, y: 2 }, overwrite: true });

    const { editorState } = await import("/src/editor/editorState.ts");
    editorState.set({ currentMapId: id, selection: null });
    return id;
  });

  await page.waitForFunction(
    (id) => typeof window.__oprnEditWorldToClient === "function" && window.__oprnEditMapViewport?.()?.mapId === id,
    mapId,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1500);

  // AI 패널이 접혀 있으면 펼치기
  const expandBtn = page.locator("button[aria-label='AI 패널 펼치기']").first();
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
    await page.waitForTimeout(400);
  }

  // 바로 깔기 토글 켜기 확인
  await page.evaluate(async () => {
    const { setStampPlaceOn } = await import("/src/editor/stampPlaceMode.ts");
    setStampPlaceOn(true);
  });
  await page.waitForTimeout(500);

  const report = [];

  async function runFastPathPrompt(stepId, promptText, expectRejected = false) {
    await page.screenshot({ path: path.join(OUT, `${stepId}-before.png`) });
    const beforeSnap = await page.evaluate(({ mapId }) => {
      const m = window.__oprnEditorStore.getCurrent().maps[mapId];
      return {
        lower: [...m.lowerTiles],
        upper: [...m.upperTiles],
        placements: structuredClone(m.structurePlacements ?? []),
        events: m.events.length,
      };
    }, { mapId });

    const beforeCalls = modelCalls.length;
    const composer = page.locator("textarea[data-testid=ai-input], textarea.ai-assistant-input").first();
    await composer.waitFor({ state: "visible", timeout: 15_000 });
    await composer.fill(promptText);
    await composer.press("Enter");

    if (expectRejected) {
      await page.waitForSelector("[data-testid=fast-path-guard-rejected]", { timeout: 15_000 });
      await page.waitForTimeout(600);
    } else {
      await page.waitForTimeout(1800);
    }

    await page.screenshot({ path: path.join(OUT, `${stepId}-after.png`) });
    const afterSnap = await page.evaluate(({ mapId }) => {
      const m = window.__oprnEditorStore.getCurrent().maps[mapId];
      return {
        lower: [...m.lowerTiles],
        upper: [...m.upperTiles],
        placements: structuredClone(m.structurePlacements ?? []),
        events: m.events.length,
      };
    }, { mapId });

    let changedTiles = 0;
    for (let i = 0; i < beforeSnap.lower.length; i++) {
      if (beforeSnap.lower[i] !== afterSnap.lower[i] || beforeSnap.upper[i] !== afterSnap.upper[i]) changedTiles++;
    }

    const lastBubbleText = await page.evaluate(() => {
      const bubbles = [...document.querySelectorAll(".cluster-ai-bubble")];
      return (bubbles.at(-1)?.textContent ?? "").trim();
    });

    const item = {
      stepId,
      promptText,
      changedTiles,
      modelCallsDelta: modelCalls.length - beforeCalls,
      beforePlacements: beforeSnap.placements.map((p) => ({ id: p.id, kitId: p.kitId, x: p.x, y: p.y, w: p.w, h: p.h })),
      afterPlacements: afterSnap.placements.map((p) => ({ id: p.id, kitId: p.kitId, x: p.x, y: p.y, w: p.w, h: p.h })),
      lastBubbleText,
    };
    console.log(`[${stepId}] "${promptText}" -> changedTiles=${changedTiles}, modelCalls=${item.modelCallsDelta}`);
    console.log(`   bubble: ${lastBubbleText.replace(/\s+/g, " ")}`);
    report.push(item);
    return item;
  }

  // Case 1: 깔기 (Place)
  await runFastPathPrompt("case1-place", "광장 주변에 가로등 두 개와 화분 놓아줘", false);

  // Case 2-A: 오른쪽 위 나무 지우기 (Erase)
  await runFastPathPrompt("case2a-erase-tree", "오른쪽 위 나무 지워줘", false);

  // Case 2-B: 광장 분수대 없애기 (Erase)
  await runFastPathPrompt("case2b-erase-fountain", "광장 분수대 없애줘", false);

  // Case 2-C: 우물을 광장 한가운데로 옮기기 (Move to region)
  await runFastPathPrompt("case2c-move-well", "우물을 광장 한가운데로 옮겨줘", false);

  // Case 2-D: 집을 오른쪽으로 4칸 옮기기 (Move relative shift)
  await runFastPathPrompt("case2d-move-house", "집을 오른쪽으로 4칸 옮겨줘", false);

  // Case 3-A: 퀘스트 세우기 (Fast-Path Hard Rejection Guard)
  await runFastPathPrompt("case3a-reject-quest", "퀘스트 세우기", true);

  // Case 3-B: 보스 이벤트 만들기 거부 가드 + 원클릭 일반 AI 조수 모드 전환 버튼 클릭 검증
  await runFastPathPrompt("case3b-reject-boss-event", "광장에 보스 이벤트 만들기", true);

  // 원클릭 핸드오프 버튼 클릭 후 상태 확인
  const handoffBtn = page.locator("[data-testid=fast-path-handoff-btn]").last();
  await handoffBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "case3c-handoff-clicked.png") });
  const stampModeAfterHandoff = await page.evaluate(async () => {
    const { isStampPlaceOn } = await import("/src/editor/stampPlaceMode.ts");
    return isStampPlaceOn();
  });
  console.log(`[handoff] stampPlaceOn after clicking handoff button: ${stampModeAfterHandoff}`);

  fs.writeFileSync(
    path.join(OUT, "fastpath-guard-report.json"),
    JSON.stringify({ report, stampModeAfterHandoff, pageErrors }, null, 2),
  );
} finally {
  if (browser) await browser.close();
  viteProc.kill("SIGTERM");
}
