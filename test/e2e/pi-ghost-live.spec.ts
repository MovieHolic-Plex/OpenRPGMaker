/**
 * 캔버스 시공 표시(밑그림)의 살아 있는 게이트.
 *
 * 무엇을 지키나: 조수에게 지시를 내리면 **턴이 끝나기 전에** AI 가 깐 칸이 캔버스에 보인다.
 * 2026-09-17 회귀 — 조수 채팅이 Pi 로 이사하며 고스트를 먹이는 코드가 안 딸려 왔다. Pi 는 루프가
 * Bun 워커에 있고 결과 프로젝트가 맨 끝 `done` 에만 실려서, base↔초안 diff 로 굴러가던 고스트가
 * 턴 내내 먹을 재료가 없었다. 이제 워커가 툴마다 `map_delta` 를 흘리고 브라우저가 초안을 복원한다.
 *
 * 왜 이 스펙이 필요한가: 세션 경로만 보던 `agent-ghost-sequence.spec.ts` 는 이 회귀를 못 잡는다 —
 * 조수의 유일한 실행 경로가 Pi 인데 그쪽을 한 줄도 지나지 않기 때문이다.
 *
 * 실 LLM 없음: `/v1/agent/run` 을 페이지 안에서 NDJSON 으로 대본화한다. `route.fulfill` 은 본문을
 * 한 덩어리로 주므로 «턴 도중» 을 만들 수 없어, `fetch` 를 갈아 끼워 스트림을 손으로 잡아 둔다.
 *
 * 실행: npx playwright test test/e2e/pi-ghost-live.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";

interface GhostScriptProbe {
  calls: number;
  streamed: boolean;
  doneSent: boolean;
  mapId: string | null;
  paintedCells: number;
  release: (() => void) | null;
}

declare global {
  interface Window { __piGhostScript?: GhostScriptProbe }
}

/** 페이지 안에서 고스트 스토어를 직접 읽는다 — 캔버스는 픽셀이라 DOM 만으로는 칸 수를 못 센다. */
async function ghostCells(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(async () => {
    const mod = await import("/src/editor/agentGhostPreview.ts");
    return mod.getAgentGhostPreviewState().previews.reduce((sum: number, preview: { cells: unknown[] }) => sum + preview.cells.length, 0);
  });
}

test("Pi 턴 도중에 AI 가 깐 칸이 캔버스에 보이고, 검토 대기까지 남고, 버리면 사라진다", async ({ page }) => {
  test.setTimeout(180_000);

  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");

    const probe: GhostScriptProbe = { calls: 0, streamed: false, doneSent: false, mapId: null, paintedCells: 0, release: null };
    window.__piGhostScript = probe;

    const originalFetch = window.fetch.bind(window);
    const ndjson = (events: readonly unknown[]): string => `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
    const headers = { "Content-Type": "application/x-ndjson" };

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/v1/agent/run")) return originalFetch(input as RequestInfo, init);

      const raw = typeof init?.body === "string" ? init.body : input instanceof Request ? await input.clone().text() : "{}";
      const body = JSON.parse(raw) as { project: { maps: Record<string, { width: number; lowerTiles: number[] }> }; readOnly?: boolean; currentMapId?: string; mapIds?: string[] };
      probe.calls += 1;

      // 1단계: Ultrabrain 계획 턴(읽기 전용). 말만 하고 끝난다 — 프로젝트는 그대로여야 한다.
      if (body.readOnly) {
        return new Response(ndjson([
          { type: "start", provider: "scripted", model: "scripted-plan", toolCount: 0 },
          { type: "turn", index: 1 },
          { type: "assistant", text: "1. 광장 자리에 바닥을 깐다. 2. 가장자리를 정리한다." },
          { type: "done", project: body.project, stats: { ms: 10, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] },
        ]), { status: 200, headers });
      }

      // 2단계: 시공 턴. 툴 하나가 6×4 칸을 칠한 것으로 하고, 증분을 흘린 뒤 `done` 을 손에 쥔다.
      const mapId = body.currentMapId ?? body.mapIds?.[0] ?? Object.keys(body.project.maps)[0]!;
      const map = body.project.maps[mapId]!;
      probe.mapId = mapId;
      const cells: { i: number; t: number }[] = [];
      for (let y = 2; y < 6; y += 1) for (let x = 2; x < 8; x += 1) cells.push({ i: y * map.width + x, t: 17 });
      probe.paintedCells = cells.length;
      const after = JSON.parse(JSON.stringify(body.project)) as typeof body.project;
      for (const cell of cells) after.maps[mapId]!.lowerTiles[cell.i] = cell.t;

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          const write = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          write({ type: "start", provider: "scripted", model: "scripted-build", toolCount: 8 });
          write({ type: "turn", index: 1 });
          write({ type: "tool_start", id: "t1", name: "paint_tiles", args: { mapId } });
          write({ type: "tool_end", id: "t1", name: "paint_tiles", ok: true, summary: `${cells.length}칸을 칠했습니다` });
          write({ type: "map_delta", maps: [{ mapId, layers: [{ layer: "lower", cells }] }] });
          probe.streamed = true;
          // 여기서 스트림을 붙잡는다 — 이 창이 곧 「턴 도중」이다.
          await new Promise<void>((resolve) => { probe.release = resolve; });
          write({ type: "assistant", text: "광장 바닥을 깔았습니다." });
          write({ type: "done", project: after, stats: { ms: 900, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [`maps.${mapId}`] });
          probe.doneSent = true;
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers });
    }) as typeof fetch;
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  // 조화 검수는 이미지 왕복이 필요하다 — 여기서는 검수를 못 하고 수동 검토로 떨어지는 쪽이 정본 경로다.
  await page.route("**/v1/chat/completions", (route) => route.fulfill({ status: 503, json: { error: "scripted: 검수 없음" } }));
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/auth/**", (route) => route.fulfill({ json: { ok: true, authenticated: true } }));

  const guest = page.getByTestId("login-guest");
  const bootReady = guest.or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 120_000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await bootReady;
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("ai-input")).toBeVisible();

  await page.getByTestId("ai-input").fill("/pi 광장 바닥을 깔아줘");
  await page.getByTestId("ai-send").click();

  // ── 경계 1: 턴 도중. 증분은 왔고 done 은 아직이다. ──
  await page.waitForFunction(() => window.__piGhostScript?.streamed === true, undefined, { timeout: 120_000 });
  expect(await page.evaluate(() => window.__piGhostScript!.doneSent)).toBe(false);

  const marker = page.getByTestId("agent-ghost-preview").first();
  await expect(marker).toBeVisible({ timeout: 15_000 });
  const painted = await page.evaluate(() => window.__piGhostScript!.paintedCells);
  expect(await ghostCells(page)).toBe(painted);
  // 실행 중 도구가 그 맵을 가리킨다 — 상태칩의 원천.
  const running = await page.evaluate(async () => {
    const mod = await import("/src/editor/agentGhostPreview.ts");
    const state = mod.getAgentGhostPreviewState();
    return { name: state.runningToolName, mapId: state.runningToolMapId };
  });
  expect(running).toEqual({ name: "paint_tiles", mapId: await page.evaluate(() => window.__piGhostScript!.mapId) });

  // ── 경계 2: 턴 종료 → 검토 대기. 사용자가 고르는 동안 밑그림은 캔버스에 남는다. ──
  await page.evaluate(() => { window.__piGhostScript!.release?.(); });
  await expect(page.getByTestId("ai-team-phase")).toHaveText("검토 대기", { timeout: 60_000 });
  await expect(marker).toBeVisible();
  expect(await ghostCells(page)).toBe(painted);

  // ── 경계 3: 버리기 → 밑그림도 함께 사라진다(프로젝트는 그대로). ──
  await page.getByTestId("ai-team-discard").click();
  await expect(page.getByTestId("agent-ghost-preview")).toHaveCount(0, { timeout: 15_000 });
  expect(await ghostCells(page)).toBe(0);
});
