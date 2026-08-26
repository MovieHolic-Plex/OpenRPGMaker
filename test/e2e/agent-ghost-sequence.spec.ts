/**
 * 고스트 프리뷰 순차 공개 + 상태칩 증거 스펙 (실제 에디터 표면).
 *
 * 무엇을 증명하나:
 *  - 스크립트된 AI 턴(=실 LLM 없음, /v1/chat/completions 목업) 한 번이 맵 캔버스 호스트에
 *    ai-ghost-phase-chip 과 agent-ghost-preview 마커를 실제로 띄운다.
 *  - 칩 문구가 ghostPhaseChipInfo 계약(`… 중 · n/N 셀 · <tool>`)을 그대로 따른다.
 *
 * 왜 목업 경로인가: loadAiConfig()(src/ai/llmClient.ts)는 저장된 authMode/baseUrl/apiKey 를
 * 무시하고 언제나 oh-my-pi 동반 서비스로 나간다(dev 에서는 같은 오리진 `/v1`). 그래서
 * localStorage 로 baseUrl 을 바꾸는 예전 방식(test/e2e/tileset-ai-native-review.spec.ts)이
 * 아니라 `**\/v1/chat/completions` 자체를 라우트로 가로챈다 — 플래너 1콜 + 툴 루프 2라운드 +
 * 마무리 1콜을 결정적으로 대본화한다.
 *
 * 실행:
 *   DEV_SERVER_PORT=9860 npx playwright test test/e2e/agent-ghost-sequence.spec.ts --project=chromium
 * 서버는 이 스펙이 직접 띄우고(이미 떠 있으면 재사용) afterAll 에서 프로세스 트리를 죽인 뒤
 * 포트가 더 이상 연결을 받지 않는 것까지 확인한다.
 */
import { expect, test, type Page } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.DEV_SERVER_PORT ?? "9860");
const ORIGIN = `http://127.0.0.1:${PORT}`;
const EVIDENCE = path.resolve(".omo/evidence/ai-action-visibility");
const CHIP = "[data-testid='ai-ghost-phase-chip']";
const MARKER = "[data-testid='agent-ghost-preview']";

let startedServer: { pid: number } | null = null;
const chipTimeline: string[] = [];

mkdirSync(EVIDENCE, { recursive: true });

// ── 서버 수명주기 ───────────────────────────────────────────────────────────
function listening(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: PORT });
    const done = (value: boolean): void => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1_000, () => done(false));
  });
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await listening()) {
      const response = await fetch(ORIGIN).catch(() => null);
      if (response?.ok) return;
    }
    if (Date.now() > deadline) throw new Error(`dev server did not answer on ${ORIGIN} within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

/** 포트를 LISTEN 중인 PID 목록 — 스펙이 띄우지 않은(재사용한) 서버도 정리 대상이다. */
function listenerPids(): readonly number[] {
  if (process.platform !== "win32") {
    const out = execFileSync("bash", ["-lc", `lsof -ti tcp:${PORT} -s TCP:LISTEN || true`], { encoding: "utf8" });
    return out.split(/\s+/u).flatMap((token) => (token.trim() === "" ? [] : [Number(token)]));
  }
  const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
  const pids = new Set<number>();
  for (const line of out.split(/\r?\n/u)) {
    if (!line.includes(`:${PORT} `) || !line.includes("LISTENING")) continue;
    const pid = Number(line.trim().split(/\s+/u).at(-1));
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

function killTree(pid: number): void {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {
    // 이미 죽었으면 통과 — afterAll 은 포트 상태로 최종 판정한다.
  }
}

test.beforeAll(async () => {
  if (await listening()) return; // 이미 떠 있으면 재사용(playwright webServer 규약과 동일).
  const child = spawn("npm", ["run", "dev:worktree"], {
    cwd: process.cwd(),
    env: { ...process.env, DEV_SERVER_PORT: String(PORT), DEV_SERVER_NO_TLS: "1" },
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
    stdio: "ignore",
  });
  child.unref();
  startedServer = { pid: child.pid ?? 0 };
  await waitForServer(90_000);
});

test.afterAll(async () => {
  const pids = new Set<number>([...listenerPids(), ...(startedServer?.pid ? [startedServer.pid] : [])]);
  for (const pid of pids) killTree(pid);
  let closed = false;
  for (let attempt = 0; attempt < 25 && !closed; attempt += 1) {
    closed = !(await listening());
    if (!closed) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const receipt = [
    `dev server port: ${PORT}`,
    `killed pids: ${[...pids].join(", ") || "(none found)"}`,
    `port accepts connections after kill: ${String(!closed)}`,
    `chip timeline: ${JSON.stringify(chipTimeline)}`,
  ].join("\n");
  writeFileSync(path.join(EVIDENCE, "e2e-server-cleanup.txt"), `${receipt}\n`, "utf8");
  console.log(`\n[cleanup receipt]\n${receipt}`);
  expect(closed, `port ${PORT} still accepts connections after kill`).toBe(true);
});

// ── 대본화된 AI 턴 ──────────────────────────────────────────────────────────
/**
 * 플래너(툴 없음) → set_build_spec → fill_region → 마무리 문장.
 * fill_region 은 스펙 게이트를 통과해야 실행되므로 set_build_spec 라운드가 반드시 먼저다.
 */
interface TurnPlan {
  mapId: string;
  rect: { x: number; y: number; w: number; h: number };
}

async function installScriptedTurn(page: Page, plan: () => TurnPlan): Promise<void> {
  let toolRounds = 0;
  await page.route("**/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON() as { tools?: readonly unknown[] } | null;
    const hasTools = (body?.tools ?? []).length > 0;
    let message: Record<string, unknown>;
    if (!hasTools) {
      message = { role: "assistant", content: JSON.stringify({ action: "direct", reason: "단일 지형 채우기로 충분" }) };
    } else if (toolRounds === 0) {
      toolRounds += 1;
      message = {
        role: "assistant",
        content: "",
        tool_calls: [{
          id: "call_spec",
          type: "function",
          function: {
            name: "set_build_spec",
            arguments: JSON.stringify({
              mapId: plan().mapId,
              title: "광장 연못 초안",
              assets: [{ id: "pond", kind: "terrain", ...plan().rect, shape: "circle", layer: "lower", overExisting: "keep" }],
              density: "normal",
            }),
          },
        }],
      };
    } else if (toolRounds === 1) {
      toolRounds += 1;
      message = {
        role: "assistant",
        content: "",
        tool_calls: [{
          id: "call_fill",
          type: "function",
          function: {
            name: "fill_region",
            arguments: JSON.stringify({ mapId: plan().mapId, rect: plan().rect, material: "물", shape: "circle", layer: "lower" }),
          },
        }],
      };
    } else {
      message = { role: "assistant", content: "연못 초안을 올렸습니다. 확인해 주세요." };
    }
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({ choices: [{ message }] }),
    });
  });
}

async function bootEditor(page: Page): Promise<string> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  const mapId = await page.evaluate(() => (window as unknown as {
    __oprnRegionTaskHarness?: { currentMapId: () => string };
  }).__oprnRegionTaskHarness?.currentMapId());
  expect(mapId, "편집 하네스가 현재 맵을 노출해야 한다").toBeTruthy();
  return String(mapId);
}

/**
 * 고스트가 화면에 실제로 보이는 자리를 엔진 좌표 훅(__oprnEditWorldToClient)으로 고른다.
 * 카메라 스크롤/줌 규약을 스펙에 복제하지 않고, 채팅 도크·제안 카드가 덮지 않는 우상단
 * 클라이언트 좌표에 대응하는 타일을 역탐색한다.
 */
async function pickVisibleRegion(page: Page, mapId: string): Promise<TurnPlan["rect"]> {
  // 좌표 훅은 EditScene.create() 에서 설치된다 — 캔버스가 보인 직후에는 아직 없을 수 있다.
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __oprnEditWorldToClient?: unknown }).__oprnEditWorldToClient === "function"), {
      timeout: 30_000,
      intervals: [200],
    })
    .toBe(true);
  const rect = await page.evaluate(({ id }) => {
    const w = window as unknown as {
      __oprnEditWorldToClient?: (worldX: number, worldY: number) => { x: number; y: number };
      __oprnRegionTaskHarness?: { readCell: (mapId: string, layer: string, x: number, y: number) => number | null };
    };
    const toClient = w.__oprnEditWorldToClient;
    const harness = w.__oprnRegionTaskHarness;
    if (!toClient || !harness) return null;
    const TILE = 16;
    const size = { w: 10, h: 8 };
    for (let ty = 0; ty < 200; ty += 1) {
      for (let tx = 0; tx < 200; tx += 1) {
        const point = toClient(tx * TILE, ty * TILE);
        if (point.x < 1040 || point.x > 1120 || point.y < 100 || point.y > 170) continue;
        // 영역 네 귀퉁이가 모두 맵 안이어야 한다(readCell 은 맵 밖이면 null).
        if (harness.readCell(id, "lower", tx + size.w - 1, ty + size.h - 1) === null) continue;
        return { x: tx, y: ty, ...size };
      }
    }
    return null;
  }, { id: mapId });
  expect(rect, "카메라 시야 안에서 고스트를 그릴 영역을 찾지 못했다").toBeTruthy();
  return rect as TurnPlan["rect"];
}

/** 채팅 도크를 접어 맵 캔버스(칩·마커)를 가리지 않게 한다 — 증거 스크린샷 가독성. */
async function collapseChatDock(page: Page): Promise<void> {
  const collapse = page.getByTestId("ai-collapse");
  if (!(await collapse.isVisible().catch(() => false))) return;
  await collapse.click();
  await expect(page.getByTestId("ai-collapsed-restore")).toBeVisible({ timeout: 10_000 });
}

/** 브리지 턴을 시작하고 기다리지 않는다 — 애니메이션 중간 상태를 관찰해야 한다. */
function startTurn(page: Page, text: string): Promise<{ ok?: boolean; error?: string }> {
  return page.evaluate(async (prompt) => {
    const bridge = (window as unknown as {
      __oprnAiBridge?: { send: (value: string) => Promise<{ ok?: boolean; error?: string }> };
    }).__oprnAiBridge;
    if (!bridge) throw new Error("window.__oprnAiBridge 미등록 — AI 패널이 마운트되지 않았다");
    return bridge.send(prompt);
  }, text);
}

test.describe("에이전트 고스트 순차 공개 + 상태칩", () => {
  test.describe.configure({ timeout: 180_000 });

  test("스크립트된 턴이 맵 캔버스에 상태칩과 고스트 마커를 띄운다", async ({ page }) => {
    const plan: TurnPlan = { mapId: "", rect: { x: 26, y: 13, w: 10, h: 8 } };
    await installScriptedTurn(page, () => plan);
    plan.mapId = await bootEditor(page);
    plan.rect = await pickVisibleRegion(page, plan.mapId);

    // 경계 1: 턴 이전 — 칩도 마커도 없다.
    await expect(page.locator(CHIP)).toHaveCount(0);
    await expect(page.locator(MARKER)).toHaveCount(0);
    await page.screenshot({ path: path.join(EVIDENCE, "e2e-ghost-1.png"), animations: "disabled" });

    const turn = startTurn(page, "광장 가운데에 둥근 연못을 만들어줘");

    // 경계 2: 애니메이션 중 — 진행 문구(`… 중 · n/N 셀 · <tool>`)가 실제로 붙는다.
    const chip = page.locator(CHIP);
    await expect(chip).toHaveCount(1, { timeout: 60_000 });
    await expect(chip).toContainText("중", { timeout: 60_000 });
    await expect(chip).toHaveText(/중 · \d+\/\d+ 셀 · \S+/u, { timeout: 60_000 });
    chipTimeline.push((await chip.textContent()) ?? "");

    // 칩과 고스트 마커는 맵 캔버스 호스트(캔버스의 부모)에 붙는다.
    expect(await chip.evaluate((node) => Boolean(node.parentElement?.querySelector("canvas")))).toBe(true);
    await expect(page.locator(MARKER)).not.toHaveCount(0, { timeout: 60_000 });
    expect(await page.locator(MARKER).first().evaluate((node) => Boolean(node.parentElement?.querySelector("canvas")))).toBe(true);
    await collapseChatDock(page);
    await expect(chip).toBeVisible();
    await expect(page.locator(MARKER).first()).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, "e2e-ghost-2.png"), animations: "disabled" });

    // 경계 3: 공개가 끝나면 칩은 '초안 완성 · 검토 대기'로 넘어가고 마커는 그대로 남는다.
    const result = await turn;
    expect(result.ok, `브리지 턴 실패: ${result.error ?? ""}`).toBe(true);
    await expect(page.locator(MARKER)).not.toHaveCount(0);
    await expect(chip).toHaveText("초안 완성 · 검토 대기", { timeout: 15_000 });
    chipTimeline.push((await chip.textContent()) ?? "");
    await page.screenshot({ path: path.join(EVIDENCE, "e2e-ghost-3.png"), animations: "disabled" });
  });

  // 공개 스케줄은 씬 update 이벤트에 붙은 티커가 굴린다(AgentGhostPreviewRenderer.startTicker).
  // 여기서는 실제 프레임 루프 위에서 칩이 "작업 중"에서 "초안 완성 · 검토 대기"까지 가는지 본다.
  test("상태칩이 공개 스케줄 완료 후 '초안 완성'으로 넘어간다", async ({ page }) => {
    const plan: TurnPlan = { mapId: "", rect: { x: 26, y: 13, w: 10, h: 8 } };
    await installScriptedTurn(page, () => plan);
    plan.mapId = await bootEditor(page);
    plan.rect = await pickVisibleRegion(page, plan.mapId);

    const turn = startTurn(page, "광장 가운데에 둥근 연못을 만들어줘");
    const chip = page.locator(CHIP);
    await expect(chip).toHaveCount(1, { timeout: 60_000 });
    expect((await turn).ok).toBe(true);

    // 공개 스케줄(타일 스윕 ≤2500ms + 마지막 셀 300ms + 샤인 450ms)의 두 배를 준다.
    await expect
      .poll(async () => (await chip.textContent()) ?? "", { timeout: 12_000, intervals: [250] })
      .toContain("초안 완성");
  });
});
