/**
 * 진단 전용(`_` 접두): 밑그림 게이트·청사진 오버레이를 **실제 조수 턴**과 결정론 오버레이로 관측한다.
 * 2026-09-03 적대적 리뷰의 실측 하네스 — 게이트를 고친 뒤 같은 문장으로 다시 돌려 전후를 비교한다.
 *
 *   DEV_SERVER_PORT=<이 트리의 포트> E2E_RETRIES=0 BP_OUT=/tmp/blueprint-shots \
 *     npx playwright test test/e2e/_blueprint-gate-live.spec.ts --project=chromium --workers=1
 *
 * E1 은 모델 없이 `/src/editor/agentBlueprint.ts` 를 페이지에서 import 해 청사진 상태를 직접 구동한다.
 * E2 는 `__oprnAiBridge.send` 로 실제 턴을 보내고(인증 `/auth/status` 필요) 청사진 revision 이 바뀔 때마다
 * 스크린샷을 남긴 뒤 `e2-result.json` 에 감사 로그·툴 인자·변경 칸·밑그림 카드 텍스트를 쓴다.
 * 산출물은 BP_OUT(기본 /tmp/blueprint-shots)로만 쓴다 — 저장소 안에 쓰면 dev 서버 감시가 페이지를 리로드한다.
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

const OUT = process.env.BP_OUT ?? "/tmp/blueprint-shots";
const MAP_ID = "map_ice_grand_plain_64";
const PROMPT = process.env.BP_PROMPT ?? "맵 왼쪽 위 (4,4)부터 (36,30) 안에 집 2채, 그 사이를 잇는 흙길, 주민 2명으로 작은 마을을 지어줘";

test.beforeEach(() => { test.setTimeout(900_000); });

async function gotoWithRetry(page: Page, url: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await page.waitForTimeout(1500);
    }
  }
}

async function bootEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ maxToolCalls: 40, maxTokens: 32768, agentMode: "chat" }));
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on("dialog", (dialog) => { void dialog.accept(); });
  // 이 머신은 첫 로드가 ERR_NETWORK_CHANGED·의존성 재최적화로 빈 화면이 되는 일이 잦다 — 부팅까지 재적재한다.
  let booted = false;
  for (let attempt = 0; attempt < 6 && !booted; attempt += 1) {
    if (attempt === 0) await gotoWithRetry(page, `/?devProject=1&icePlain64=1&map=${MAP_ID}`);
    else await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    for (let wait = 0; wait < 15 && !booted; wait += 1) {
      await page.waitForTimeout(1000);
      const guest = page.getByTestId("login-guest");
      if (await guest.isVisible().catch(() => false)) await guest.click();
      booted = await page.evaluate(() => document.querySelectorAll("[data-testid]").length > 5).catch(() => false);
    }
  }
  if (!booted) throw new Error("editor did not boot");
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible().catch(() => false)) await start.click();
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.getByTestId("ai-input").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
  // 카메라를 시공 영역(왼쪽 위)으로, 줌 1x — 기본 카메라는 맵 오른쪽 아래를 보고 있어 밑그림이 화면 밖이다.
  await page.evaluate(async ({ mapId }) => {
    const es = await import("/src/editor/editorState.ts");
    es.editorState.set({ zoom: 1 });
    const nav = await import("/src/editor/editorReferenceNavigation.ts");
    nav.focusEditorRegion({ mapId, x: 0, y: 0, w: 48, h: 34 });
  }, { mapId: MAP_ID });
  await page.waitForTimeout(1200);
}

const VILLAGE_SPEC = {
  mapId: MAP_ID,
  title: "얼음 평원 마을(진단)",
  buildOrder: ["clear", "terrain", "road", "house", "prop", "market", "npc"],
  assets: [
    { id: "clear_all", kind: "clear", x: 0, y: 0, w: 64, h: 64, confirmDestroy: true },
    { id: "pond", kind: "terrain", x: 30, y: 4, w: 8, h: 6, shape: "circle" },
    { id: "main_road", kind: "road", x: 2, y: 14, w: 40, h: 2 },
    { id: "house_a", kind: "house", x: 4, y: 4, w: 7, h: 8 },
    { id: "house_b", kind: "house", x: 14, y: 4, w: 7, h: 8 },
    { id: "house_c", kind: "house", x: 4, y: 18, w: 8, h: 9 },
    { id: "tree_a", kind: "tree", layer: "upper", x: 4, y: 4, w: 3, h: 3 },
    { id: "npc_1", kind: "npc", x: 12, y: 16, w: 1, h: 1 },
    { id: "npc_2", kind: "npc", x: 13, y: 16, w: 1, h: 1 },
    { id: "npc_3", kind: "npc", x: 14, y: 16, w: 1, h: 1 },
    { id: "shop", kind: "market", x: 24, y: 18, w: 6, h: 5 },
    { id: "lake_edge", kind: "lakeshore", x: 40, y: 4, w: 5, h: 5 },
  ],
};

test("E1 결정론적 청사진 오버레이 — 라벨 겹침·1×1·상하위 중첩·미번역 kind·라벨 절벽 + 실제 맵 P7", async ({ page }) => {
  await bootEditor(page);
  await page.screenshot({ path: `${OUT}/e1-00-boot.png` });

  const probe = await page.evaluate(async ({ spec, mapId }) => {
    const bp = await import("/src/editor/agentBlueprint.ts");
    const bs = await import("/src/ai/buildSpec.ts");
    const w = window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: any } } };
    const project = w.__oprnProjectE2E?.currentProject().project;
    const map = project?.maps?.[mapId];
    const baseTile = map ? map.lowerTiles[10 * map.width + 10] : null;
    const built = map ? bs.builtCellsInRegions(map, [{ mapId, x: 0, y: 0, w: map.width, h: map.height }]).count : null;
    const houseSpec = project ? bs.validateBuildSpec(project, { mapId, assets: [{ id: "h", kind: "house", x: 4, y: 4, w: 7, h: 8 }] }) : null;
    const clearSpec = project ? bs.validateBuildSpec(project, { mapId, assets: [{ id: "c", kind: "clear", x: 4, y: 4, w: 7, h: 8 }] }) : null;
    const villageSpec = project ? bs.validateBuildSpec(project, spec) : null;
    bp.setAgentBlueprintFromSpec(spec);
    return { mapSize: map ? [map.width, map.height] : null, baseTile, built, houseSpec, clearSpec, villageSpec, state: bp.getAgentBlueprintState() };
  }, { spec: VILLAGE_SPEC, mapId: MAP_ID });
  writeFileSync(`${OUT}/e1-probe.json`, JSON.stringify(probe, null, 2));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/e1-01-planned.png` });
  await page.getByTestId("edit-canvas").screenshot({ path: `${OUT}/e1-01-planned-canvas.png` });

  // 진행: 길 → 집 a → 집 b(정리 칸·길 done 으로 내려감)
  await page.evaluate(async ({ mapId }) => {
    const bp = await import("/src/editor/agentBlueprint.ts");
    bp.markAgentBlueprintProgress("paint_road", { mapId, points: [{ x: 2, y: 14 }, { x: 41, y: 14 }] }, { write: true });
  }, { mapId: MAP_ID });
  await page.waitForTimeout(500);
  await page.getByTestId("edit-canvas").screenshot({ path: `${OUT}/e1-02-road-building-canvas.png` });
  await page.evaluate(async ({ mapId }) => {
    const bp = await import("/src/editor/agentBlueprint.ts");
    bp.markAgentBlueprintProgress("author_house", { kind: "single", mapId, wings: [{ x: 4, y: 4, w: 7, h: 8 }] }, { write: true });
  }, { mapId: MAP_ID });
  await page.waitForTimeout(500);
  await page.getByTestId("edit-canvas").screenshot({ path: `${OUT}/e1-03-house-a-building-canvas.png` });
  const midState = await page.evaluate(async () => (await import("/src/editor/agentBlueprint.ts")).getAgentBlueprintState());
  writeFileSync(`${OUT}/e1-mid-state.json`, JSON.stringify(midState, null, 2));

  // 라벨 절벽: 41개 이상이면 라벨이 전부 사라진다
  await page.evaluate(async ({ mapId }) => {
    const bp = await import("/src/editor/agentBlueprint.ts");
    const assets = [] as any[];
    for (let i = 0; i < 45; i += 1) assets.push({ id: `p${i}`, kind: "prop", x: 2 + (i % 9) * 4, y: 2 + Math.floor(i / 9) * 4, w: 3, h: 3 });
    bp.setAgentBlueprintFromSpec({ mapId, title: "라벨 절벽", assets });
  }, { mapId: MAP_ID });
  await page.waitForTimeout(500);
  await page.getByTestId("edit-canvas").screenshot({ path: `${OUT}/e1-04-45assets-no-labels-canvas.png` });
  await page.evaluate(async ({ mapId }) => {
    const bp = await import("/src/editor/agentBlueprint.ts");
    const assets = [] as any[];
    for (let i = 0; i < 40; i += 1) assets.push({ id: `p${i}`, kind: "prop", x: 2 + (i % 9) * 4, y: 2 + Math.floor(i / 9) * 4, w: 3, h: 3 });
    bp.setAgentBlueprintFromSpec({ mapId, title: "라벨 40", assets });
  }, { mapId: MAP_ID });
  await page.waitForTimeout(500);
  await page.getByTestId("edit-canvas").screenshot({ path: `${OUT}/e1-05-40assets-labels-canvas.png` });
  await page.evaluate(async () => (await import("/src/editor/agentBlueprint.ts")).clearAgentBlueprint());
});

test("E2 실제 조수 턴 — 밑그림 카드·오버레이 진행·게이트 감사·시공 결과 대조", async ({ page }) => {
  const auth = await page.request.get("/auth/status").then((res) => res.json() as Promise<{ connected: boolean; provider: string }>);
  expect(auth.connected, JSON.stringify(auth)).toBe(true);
  await bootEditor(page);
  const before = await page.evaluate(({ mapId }) => {
    const w = window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: any } } };
    const map = w.__oprnProjectE2E!.currentProject().project.maps[mapId];
    (window as any).__bpBefore = { lower: [...map.lowerTiles], upper: [...map.upperTiles], events: map.events.length, width: map.width, height: map.height };
    return { events: map.events.length };
  }, { mapId: MAP_ID });
  await page.screenshot({ path: `${OUT}/e2-00-before.png` });

  const t0 = Date.now();
  await page.evaluate(async (prompt: string) => {
    const w = window as any;
    w.__bpTurn = { done: false };
    w.__bpAuditStart = w.__oprnAiBridge.audit().length;
    w.__oprnAiBridge.send(prompt).then((r: unknown) => { w.__bpTurn = { done: true, result: r }; }).catch((e: unknown) => { w.__bpTurn = { done: true, error: String(e) }; });
  }, PROMPT);

  const timeline: unknown[] = [];
  let lastRevision = -1;
  let cardSeen = false;
  let shots = 0;
  while (Date.now() - t0 < 720_000) {
    const snap = await page.evaluate(async () => {
      const bp = await import("/src/editor/agentBlueprint.ts");
      const w = window as any;
      return { done: w.__bpTurn?.done === true, state: bp.getAgentBlueprintState(), status: w.__oprnAiBridge.status().lastStatus, audit: w.__oprnAiBridge.audit().length - w.__bpAuditStart };
    });
    const card = await page.getByTestId("ai-build-spec-summary").count();
    if (snap.state.revision !== lastRevision || (card > 0 && !cardSeen)) {
      lastRevision = snap.state.revision;
      if (card > 0) cardSeen = true;
      const sec = Math.round((Date.now() - t0) / 1000);
      timeline.push({ sec, status: snap.status, audit: snap.audit, revision: snap.state.revision, entries: snap.state.entries.map((e: any) => `${e.order}:${e.id}:${e.kind}@${e.x},${e.y} ${e.w}x${e.h} ${e.status}`) });
      if (shots < 30) {
        shots += 1;
        await page.screenshot({ path: `${OUT}/e2-t${String(sec).padStart(3, "0")}-rev${snap.state.revision}.png` });
      }
    }
    if (snap.done) break;
    await page.waitForTimeout(3000);
  }
  const elapsed = Date.now() - t0;
  await page.screenshot({ path: `${OUT}/e2-99-after.png` });
  await page.getByTestId("edit-canvas").screenshot({ path: `${OUT}/e2-99-after-canvas.png` });
  const card = page.getByTestId("ai-build-spec-summary");
  if (await card.count()) {
    await card.first().evaluate((el) => { (el as HTMLDetailsElement).open = true; el.scrollIntoView(); });
    await page.waitForTimeout(300);
    await card.first().screenshot({ path: `${OUT}/e2-98-spec-card.png` }).catch(() => {});
  }

  const after = await page.evaluate(async ({ mapId }) => {
    const bp = await import("/src/editor/agentBlueprint.ts");
    const w = window as any;
    const map = w.__oprnProjectE2E.currentProject().project.maps[mapId];
    const b = w.__bpBefore;
    const changed: { x: number; y: number }[] = [];
    for (let i = 0; i < map.lowerTiles.length; i += 1) {
      if (map.lowerTiles[i] !== b.lower[i] || map.upperTiles[i] !== b.upper[i]) changed.push({ x: i % map.width, y: Math.floor(i / map.width) });
    }
    const bbox = changed.length ? changed.reduce((acc, c) => ({ x0: Math.min(acc.x0, c.x), y0: Math.min(acc.y0, c.y), x1: Math.max(acc.x1, c.x), y1: Math.max(acc.y1, c.y) }), { x0: 1e9, y0: 1e9, x1: -1, y1: -1 }) : null;
    const audit = w.__oprnAiBridge.audit().slice(w.__bpAuditStart);
    const cards = [...document.querySelectorAll("[data-testid='ai-build-spec-summary']")].map((el) => el.textContent ?? "");
    const harness = w.__oprnAiBridge.harness();
    const toolArgs: unknown[] = [];
    for (const msg of harness?.messages ?? []) {
      for (const call of msg.tool_calls ?? []) {
        if (["set_build_spec", "author_house", "paint_road", "place_npc", "author_village", "fill_region", "place_props", "lay_path", "build_wall", "tile_erase"].includes(call.function?.name)) {
          toolArgs.push({ name: call.function.name, args: call.function.arguments?.slice(0, 1500) });
        }
      }
    }
    const requested = { x0: 4, y0: 4, x1: 36, y1: 30 };
    const outsideRequested = changed.filter((c) => c.x < requested.x0 || c.x > requested.x1 || c.y < requested.y0 || c.y > requested.y1);
    return {
      cards, toolArgs, changed, outsideRequested,
      turn: w.__bpTurn, changedCells: changed.length, bbox, events: map.events.map((e: any) => ({ name: e.name, x: e.x, y: e.y })),
      state: bp.getAgentBlueprintState(), audit,
      mapsNow: Object.keys(w.__oprnProjectE2E.currentProject().project.maps),
      cardText: document.querySelector("[data-testid='ai-build-spec-summary']")?.textContent ?? null,
      statusText: w.__oprnAiBridge.status(),
    };
  }, { mapId: MAP_ID });
  writeFileSync(`${OUT}/e2-result.json`, JSON.stringify({ prompt: PROMPT, provider: auth.provider, elapsedMs: elapsed, before, timeline, ...after }, null, 2));
  console.log(`[bp-e2] ${elapsed}ms changed=${after.changedCells} bbox=${JSON.stringify(after.bbox)} events=${after.events.length} audit=${after.audit.length}`);
});
