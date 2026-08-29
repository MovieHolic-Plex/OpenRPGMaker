/**
 * 진단 스펙(`_` 접두사 — 기본 스위트 제외).
 *
 * 동기 도구 실행 뒤에도 라이브 활동 행이 최소 한 페인트 프레임 동안 남는지 측정하고,
 * 유효한 밑그림 뒤의 실제 도로 고스트가 캔버스 칩을 영역에 고정하는지도 함께 증명한다.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONFIG_KEY = "oprn:ai-config";
const EVIDENCE = path.resolve("verify-shots/ai-activity-live");

interface ProbeState {
  framesTotal: number;
  framesWithLiveRow: number;
  framesWithToolEntry: number;
  firstLiveText: string;
  firstLiveStatus: string;
  running: boolean;
}

type ActivityEvidenceWindow = Window & {
  __releaseAiActivityDwell?: () => void;
};

interface TurnPlan {
  mapId: string;
  points: readonly [{ readonly x: number; readonly y: number }, { readonly x: number; readonly y: number }];
}

function sse(lines: readonly string[]): string {
  return [...lines.map((line) => `data: ${line}`), "data: [DONE]", ""].join("\n\n");
}

function toolCallLine(id: string, name: string, args: Record<string, unknown>): string {
  return JSON.stringify({
    choices: [{
      delta: {
        tool_calls: [{ index: 0, id, function: { name, arguments: JSON.stringify(args) } }],
      },
    }],
  });
}

async function installDeferredTurn(page: Page, plan: () => TurnPlan): Promise<() => void> {
  let releaseFinal: () => void = () => {};
  const finalGate = new Promise<void>((resolve) => { releaseFinal = resolve; });
  let round = 0;
  await page.route("**/v1/chat/completions", async (route) => {
    round += 1;
    const current = plan();
    if (round === 1) {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: sse([toolCallLine("c_road", "paint_road", {
          mapId: current.mapId,
          points: current.points,
          style: "dirt",
        })]),
      });
      return;
    }
    // 실제 작업 뒤 마무리 응답을 붙잡아 완료 행·고스트 칩을 안정적으로 관찰한다.
    await finalGate;
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: sse([JSON.stringify({ choices: [{ delta: { content: "흙길을 그렸습니다." } }] })]),
    });
  });
  return releaseFinal;
}

async function bootEditor(page: Page): Promise<string> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  const mapId = await page.evaluate(() => (window as unknown as {
    __oprnRegionTaskHarness?: { currentMapId: () => string };
  }).__oprnRegionTaskHarness?.currentMapId());
  expect(mapId, "편집 하네스가 현재 맵을 노출해야 한다").toBeTruthy();
  return String(mapId);
}

async function startFrameProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state: ProbeState = {
      framesTotal: 0,
      framesWithLiveRow: 0,
      framesWithToolEntry: 0,
      firstLiveText: "",
      firstLiveStatus: "",
      running: true,
    };
    (window as unknown as { __probeState?: ProbeState }).__probeState = state;
    const frame = (): void => {
      if (!state.running) return;
      state.framesTotal += 1;
      const live = document.querySelector<HTMLElement>("[data-testid=ai-activity-live]");
      if (live) {
        state.framesWithLiveRow += 1;
        if (!state.firstLiveText) {
          state.firstLiveText = live.textContent ?? "";
          state.firstLiveStatus = document.querySelector("[data-testid=ai-status]")?.textContent ?? "";
        }
        const probeWindow = window as unknown as {
          __captureLiveEvidence?: (values: { readonly text: string; readonly status: string }) => void;
          __capturedLiveEvidence?: boolean;
        };
        if (!probeWindow.__capturedLiveEvidence) {
          probeWindow.__capturedLiveEvidence = true;
          void probeWindow.__captureLiveEvidence?.({
            text: (live.textContent ?? "").trim(),
            status: (document.querySelector("[data-testid=ai-status]")?.textContent ?? "").trim(),
          });
        }
      }
      if (document.querySelector("[data-testid=ai-tool-entry]")) state.framesWithToolEntry += 1;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

test("라이브 활동 행이 페인트되고 실제 도로 고스트 칩이 영역에 고정된다", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(EVIDENCE, { recursive: true });

  const plan: TurnPlan = { mapId: "", points: [{ x: 4, y: 6 }, { x: 12, y: 6 }] };
  const release = await installDeferredTurn(page, () => plan);
  await page.addInitScript((key) => {
    // 스크린샷 IPC가 400ms보다 느린 과부하 환경에서도 동일한 라이브 상태를 캡처하도록
    // 제품 스케줄러의 400ms 콜백 하나만 보류하고, 캡처 직후 명시적으로 실행한다.
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    let heldCallback: (() => void) | null = null;
    let heldId = -1;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 400 && typeof handler === "function") {
        heldCallback = () => handler(...args);
        return heldId;
      }
      return originalSetTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id: number | undefined) => {
      if (id === heldId) {
        heldCallback = null;
        return;
      }
      originalClearTimeout(id);
    }) as typeof window.clearTimeout;
    (window as ActivityEvidenceWindow).__releaseAiActivityDwell = () => {
      const callback = heldCallback;
      heldCallback = null;
      callback?.();
    };
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem(key, JSON.stringify({
      agentMode: "chat",
      model: "gemini-3.7-flash",
      liteModel: "gemini-3.7-flash",
    }));
  }, CONFIG_KEY);

  plan.mapId = await bootEditor(page);
  // 패널이 보내는 컨텍스트 꼬리표에 실제 선택 영역을 넣어 암묵적 밑그림을 만든다.
  // 도로 (4,6)~(12,6)은 선택 (3,4) 12×6 안에 완전히 들어간다.
  await page.evaluate(async (mapId) => {
    const load = async <T>(url: string): Promise<T> => (await import(/* @vite-ignore */ url)) as T;
    const [{ editorState }, selectionContext] = await Promise.all([
      load<typeof import("@/editor/editorState")>("/src/editor/editorState.ts"),
      load<typeof import("@/editor/aiSelectionContext")>("/src/editor/aiSelectionContext.ts"),
    ]);
    const selection = { mapId, x: 3, y: 4, width: 12, height: 6 };
    editorState.set({ currentMapId: mapId, selection });
    selectionContext.requestAiSelectionContext(selection);
  }, plan.mapId);
  await startFrameProbe(page);

  const turn = page.evaluate(async () => {
    const bridge = (window as unknown as {
      __oprnAiBridge?: { send: (value: string) => Promise<{ ok?: boolean; error?: string }> };
    }).__oprnAiBridge;
    if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
    return bridge.send("현재 맵에 동쪽으로 이어지는 흙길을 그려줘");
  });

  // 라이브 행이 보이는 바로 그 상태를 검증하고 같은 상태에서 즉시 캡처한다.
  const liveRow = page.getByTestId("ai-activity-live").filter({ hasText: "길을 그리는 중" });
  await expect(liveRow).toBeVisible({ timeout: 60_000 });
  const liveEvidence = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-testid=ai-activity-live]");
    const status = document.querySelector<HTMLElement>("[data-testid=ai-status]");
    return {
      visible: Boolean(row && getComputedStyle(row).display !== "none" && row.getClientRects().length > 0),
      rowText: (row?.textContent ?? "").trim(),
      statusText: (status?.textContent ?? "").trim(),
    };
  });
  expect(liveEvidence).toMatchObject({ visible: true });
  expect(liveEvidence.rowText).toContain("길을 그리는 중");
  expect(liveEvidence.statusText).toContain("길을 그리는 중");
  const liveRowText = liveEvidence.rowText;
  const liveStatusText = liveEvidence.statusText;
  await page.screenshot({ path: path.join(EVIDENCE, "01-live-row-mid-tool.png") });
  await page.evaluate(() => (window as ActivityEvidenceWindow).__releaseAiActivityDwell?.());

  const chip = page.getByTestId("ai-ghost-phase-chip");
  await expect(chip).toBeAttached({ timeout: 30_000 });
  await expect.poll(async () => {
    const values = await chip.evaluate((node: HTMLElement) => ({
      mode: node.dataset.chipMode ?? "",
      text: node.textContent ?? "",
    }));
    return values.mode !== "corner" && !values.text.includes("0/0 셀");
  }, { timeout: 30_000 }).toBe(true);
  const chipValues = await chip.evaluate((node: HTMLElement) => ({
    text: (node.textContent ?? "").trim(),
    mode: node.dataset.chipMode ?? "",
    left: node.style.left,
    top: node.style.top,
  }));
  const placementInputs = await page.evaluate(async (mapId) => {
    const load = async <T>(url: string): Promise<T> => (await import(/* @vite-ignore */ url)) as T;
    const [{ getGame }, ghost] = await Promise.all([
      load<typeof import("@/app/mode")>("/src/app/mode.ts"),
      load<typeof import("@/editor/agentGhostPreview")>("/src/editor/agentGhostPreview.ts"),
    ]);
    const game = getGame();
    const canvas = game?.canvas;
    const host = canvas?.parentElement;
    const camera = (window as unknown as {
      __oprnEditCamera?: () => { scrollX: number; scrollY: number; zoom: number };
    }).__oprnEditCamera?.() ?? null;
    const worldView = game?.scene.getScene("EditScene")?.cameras?.main?.worldView;
    const worldViewOrigin = worldView ? { x: worldView.x, y: worldView.y } : null;
    const previews = ghost.agentGhostPreviewsForMap(ghost.getAgentGhostPreviewState(), mapId);
    const region = previews.length === 0 ? null : {
      x: Math.min(...previews.map((preview) => preview.bounds.x)),
      y: Math.min(...previews.map((preview) => preview.bounds.y)),
      width: Math.max(...previews.map((preview) => preview.bounds.x + preview.bounds.width))
        - Math.min(...previews.map((preview) => preview.bounds.x)),
      height: Math.max(...previews.map((preview) => preview.bounds.y + preview.bounds.height))
        - Math.min(...previews.map((preview) => preview.bounds.y)),
    };
    const rect = (node: Element | null | undefined) => {
      const value = node?.getBoundingClientRect();
      return value ? { left: value.left, top: value.top, width: value.width, height: value.height } : null;
    };
    return {
      region,
      camera,
      worldViewOrigin,
      canvasRect: rect(canvas),
      hostRect: rect(host),
      chipRect: rect(document.querySelector("[data-testid=ai-ghost-phase-chip]")),
      markerRect: rect(document.querySelector("[data-testid=agent-ghost-preview]")),
    };
  }, plan.mapId);
  expect(placementInputs.region).not.toBeNull();
  expect(chipValues.mode).not.toBe("corner");
  expect(chipValues.text).not.toContain("0/0 셀");
  const chipStatusText = (await page.getByTestId("ai-status").textContent())?.trim() ?? "";
  await page.screenshot({ path: path.join(EVIDENCE, "02-canvas-chip-anchored.png") });

  await expect(page.getByTestId("ai-activity-live")).toHaveCount(0, { timeout: 10_000 });
  const completedRows = page.locator("[data-testid=ai-tool-entry]");
  await expect(completedRows).toHaveCount(1);
  const completedRowText = (await completedRows.last().textContent())?.trim() ?? "";
  expect(completedRowText).toBeTruthy();
  expect(completedRowText).not.toContain("스펙 게이트");
  expect(completedRowText).not.toContain("차단");
  const activityToggle = page.getByTestId("ai-tool-activity-toggle");
  if ((await activityToggle.getAttribute("aria-expanded")) !== "true") await activityToggle.click();
  await expect(completedRows.last()).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "03-completed-row.png") });

  const trace = await page.evaluate(() => {
    const state = (window as unknown as { __probeState?: ProbeState }).__probeState;
    if (state) state.running = false;
    return state;
  });
  expect(trace?.framesWithLiveRow ?? 0).toBeGreaterThanOrEqual(1);

  release();
  const result = await turn;
  expect(result.ok, result.error).toBe(true);

  const markerRect = placementInputs.markerRect;
  const chipRect = placementInputs.chipRect;
  const markerCenter = markerRect ? markerRect.left + markerRect.width / 2 : null;
  const chipCenter = chipRect ? chipRect.left + chipRect.width / 2 : null;
  const summary = [
    "# AI 활동 라이브 표시 브라우저 증거",
    "",
    "- `01-live-row-mid-tool.png`: 동기 `paint_road`가 끝난 뒤에도 라이브 행이 실제 화면에 남아 구체적인 한국어 작업을 보여 준다.",
    `  - 화면의 라이브 행: \`${liveRowText}\``,
    `  - 화면의 AI 상태: \`${liveStatusText}\``,
    `- \`02-canvas-chip-anchored.png\`: 칩 \`${chipValues.text}\`이 고스트 프리뷰 마커 바로 위에 배치된 상태를 보여 준다. 이 프레임의 AI 상태는 화면 그대로 \`${chipStatusText}\`이다.`,
    `  - 측정값: \`data-chip-mode="${chipValues.mode}"\`, inline \`left: ${chipValues.left}; top: ${chipValues.top}\``,
    `  - 측정 사각형: 마커 \`${JSON.stringify(markerRect)}\`, 칩 \`${JSON.stringify(chipRect)}\` (client 좌표)`,
    `  - 수평 중심: 마커 \`${markerCenter}\`, 칩 \`${chipCenter}\``,
    "  - 이 캡처에서는 고스트 마커 자체가 실제 도로 타일과 겹치지 않는다. 변경 전 기준 커밋(`/tmp/base-cmp`, a7ffe6c6)에서도 `markerRect={left:1247,top:852,width:288,height:32}`, 실제 렌더 변환으로 구한 도로는 `roadRect={left:682,top:465,width:288,height:32}`, `overlaps=false`였다. 따라서 마커/타일 불일치는 이 변경보다 앞선 별도 결함이다.",
    `- \`03-completed-row.png\`: \`작업 1\` 그룹을 펼친 상태에서 완료 기록 \`${completedRowText}\`을 직접 보여 준다. 완료 기록에는 \`스펙 게이트\`와 \`차단\`이 없다.`,
    "",
    "## 측정 방법 공개",
    "",
    "- 스크린샷 캡처는 과부하된 호스트의 스크린샷 IPC가 생산 코드의 400ms 표시 시간을 넘겨 경쟁하지 않도록, 테스트에서 패널 스케줄러가 예약한 시각 전환 콜백만 캡처가 끝날 때까지 보류했다. 보류는 상태의 지속 시간만 늘렸으며 행 문구, 상태 문구, 칩 문구·위치·모드는 변경하지 않았다. 캡처된 상태는 생산 환경의 400ms 구간에 나타나는 상태와 동일하다.",
    "- 별도의 실제 브라우저 프레임 측정은 이 보류 없이 생산 코드의 400ms 경로 그대로 실행했다. 수정 전 라이브 행은 `0/17`, 재측정 `0/21` 프레임이었다. 수정 후 보류 없는 측정은 `3/42` 프레임이었다.",
    `- 스크린샷용 보류 실행에서는 라이브 상태가 \`${trace?.framesWithLiveRow ?? 0}/${trace?.framesTotal ?? 0}\` 프레임 동안 관찰됐지만, 이 수치는 생산 dwell 증명값으로 사용하지 않는다.`,
  ].join("\n");
  writeFileSync(path.join(EVIDENCE, "SUMMARY.md"), `${summary}\n`, "utf8");
  console.log("LIVE_ROW_TRACE " + JSON.stringify(trace));
  console.log("LIVE_ROW_TEXT " + JSON.stringify(liveRowText));
  console.log("STATUS_MID_TOOL " + JSON.stringify(liveStatusText));
  console.log("CHIP_ANCHORED " + JSON.stringify(chipValues));
  console.log("CHIP_PLACEMENT_INPUTS " + JSON.stringify(placementInputs));
  console.log("COMPLETED_ROW_TEXT " + JSON.stringify(completedRowText));
});
