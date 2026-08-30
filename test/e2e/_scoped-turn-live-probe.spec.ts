/**
 * 통합 검증 — 실제 모델로 «스코프 걸린 조수 턴» 한 판을 사람 손 순서 그대로 돌린다.
 *
 * 계획서 §검증 6 을 손으로 하는 대신 프로브로 고정한다. 확인 항목은 넷이다.
 *   (a) 영역 안에만 깔리는가        — 바뀐 칸 전체가 선택 사각형 안인지 좌표로 센다
 *   (b) 캔버스 사각형 배지가 뜨는가 — REGION_TASK_STATUS_EVENT 를 처음부터 받아 적는다
 *   (c) 이어서 "좀 더 많이" 가 통하는가 — 다시 무장하지 않고 후속 턴이 도는지
 *   (d) 되돌리기 한 번에 원복되는가 — 도구막대 undo 1회 뒤 직전 스냅샷과 같은지
 *
 * 목업 LLM 을 걸지 않는다. 클립·기억·배지의 **결정적** 계약은 test/scopedAssistantTurn.test.ts
 * 가 이미 잠갔고, 이 파일이 답하는 것은 "진짜 모델이 낸 계획에도 그 계약이 성립하는가" 다.
 * 그래서 하드 단정은 모델의 선택에 좌우되지 않는 것만 남기고, 나머지는 receipt.json 에 적는다.
 *
 * 실행(에이전트 셸의 HOME 은 /home/main 이 아니라 인증 경로를 반드시 넘긴다):
 *   RPG_ZZU_OH_MY_PI_AUTH_PATH=/home/main/.rpg-zzu/oh-my-pi-auth.json \
 *   DEV_SERVER_PORT=9173 SHOT_DIR=<절대경로> \
 *   npx playwright test test/e2e/_scoped-turn-live-probe.spec.ts --project=chromium --workers=1
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SHOT_DIR = path.resolve(process.env.SHOT_DIR ?? ".omo/evidence/scoped-turn-live/run");
mkdirSync(SHOT_DIR, { recursive: true });

const FIRST = "여기 나무 좀 심어줘";
const FOLLOW_UP = "좀 더 많이";

interface StatusRecord {
  readonly running: boolean;
  readonly runId?: string;
  readonly mapId?: string;
  readonly region?: { x: number; y: number; width: number; height: number };
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 맵 전체를 (lower, upper) 두 겹으로 떠 온다 — 바뀐 칸을 좌표까지 알아야 (a) 를 셀 수 있다. */
async function readMap(page: Page, mapId: string): Promise<readonly (number | null)[]> {
  return page.evaluate(({ id }: { id: string }) => {
    const w = window as unknown as {
      __oprnRegionTaskHarness?: {
        readCell: (m: string, l: "lower" | "upper", x: number, y: number) => number | null;
      };
      __oprnProjectDims?: { width: number; height: number };
    };
    const harness = w.__oprnRegionTaskHarness;
    const dims = w.__oprnProjectDims;
    if (!harness || !dims) throw new Error("harness/dims 미등록");
    const cells: (number | null)[] = [];
    for (let y = 0; y < dims.height; y += 1) {
      for (let x = 0; x < dims.width; x += 1) {
        cells.push(harness.readCell(id, "lower", x, y));
        cells.push(harness.readCell(id, "upper", x, y));
      }
    }
    return cells;
  }, { id: mapId });
}

/** 두 스냅샷의 차이를 (x,y) 좌표로 환산한다. 한 칸당 2개(lower/upper)씩 들어 있다. */
function diffCells(
  before: readonly (number | null)[],
  after: readonly (number | null)[],
  width: number,
): readonly { x: number; y: number; layer: "lower" | "upper" }[] {
  const changed: { x: number; y: number; layer: "lower" | "upper" }[] = [];
  for (let i = 0; i < after.length; i += 1) {
    if (after[i] === before[i]) continue;
    const cell = Math.floor(i / 2);
    changed.push({ x: cell % width, y: Math.floor(cell / width), layer: i % 2 === 0 ? "lower" : "upper" });
  }
  return changed;
}

function outsideOf(rect: Rect, cells: readonly { x: number; y: number }[]): readonly { x: number; y: number }[] {
  return cells.filter(
    (c) => c.x < rect.x || c.y < rect.y || c.x >= rect.x + rect.width || c.y >= rect.y + rect.height,
  );
}

async function waitForTurn(page: Page, timeout = 600_000): Promise<void> {
  const abort = page.getByTestId("ai-abort");
  await abort.waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
  await abort.waitFor({ state: "detached", timeout }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

async function statuses(page: Page): Promise<readonly StatusRecord[]> {
  return page.evaluate(
    () => (window as unknown as { __probeStatuses?: StatusRecord[] }).__probeStatuses ?? [],
  ) as Promise<readonly StatusRecord[]>;
}

async function logText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const log =
      document.querySelector("[data-testid='ai-chat-log']") ?? document.querySelector(".ai-glass-log");
    return (log?.textContent ?? "").replace(/\s+/g, " ").trim();
  });
}

test.describe("스코프 턴 실모델 프로브", () => {
  test.describe.configure({ timeout: 1_800_000 });

  test("우클릭 드래그로 잡은 사각형 안에서만 작업하고, 후속 턴이 이어지고, 한 번에 되돌아간다", async ({ page }) => {
    // OAuth 액세스 토큰은 한 시간도 못 간다 — 턴 하나가 10분대라 시작 전에 한 번 갱신한다.
    // (갱신 실패는 곧 로그인 만료다. 그때는 사람이 다시 로그인해야 하고 이 프로브는 못 돈다.)
    await page.request.post("/auth/refresh", { data: {} }).catch(() => undefined);
    const auth = (await page.request.get("/auth/status").then((res) => res.json())) as {
      connected?: boolean;
      provider?: string;
    };
    expect(auth.connected, "Antigravity OAuth 세션이 필요하다 — /auth/status connected:false").toBe(true);

    await page.addInitScript(() => {
      localStorage.setItem("oprn:editor-ui-mode", "expert");
      localStorage.setItem("oprn:editor-welcome-dismissed", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem(
        "oprn:ai-config",
        JSON.stringify({ maxToolCalls: 24, maxTokens: 32768, agentMode: "chat" }),
      );
      // (b) 배지 — 창을 보는 게 아니라 이벤트를 처음부터 받아 적는다.
      const bucket: unknown[] = [];
      (window as unknown as { __probeStatuses: unknown[] }).__probeStatuses = bucket;
      window.addEventListener("oprn:region-task-status", (event) => {
        bucket.push((event as CustomEvent).detail);
      });
    });

    await page.setViewportSize({ width: 1440, height: 980 });
    await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible().catch(() => false)) await guest.click();
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });

    const dims = await page.evaluate(() => {
      const text = document.querySelector("[data-testid='project-export-json']")?.textContent ?? "";
      const state = JSON.parse(text) as {
        project: { startMapId: string; maps: Record<string, { width: number; height: number }> };
        editor: { currentMapId: string | null };
      };
      const mapId = state.editor.currentMapId ?? state.project.startMapId;
      const map = state.project.maps[mapId];
      if (!map) throw new Error("현재 맵을 찾을 수 없다");
      (window as unknown as { __oprnProjectDims: unknown }).__oprnProjectDims = {
        width: map.width,
        height: map.height,
      };
      return { mapId, width: map.width, height: map.height };
    });

    // ── 우클릭 드래그로 영역을 잡는다(실제 제스처) ────────────────────────────
    const canvas = page.getByTestId("edit-canvas").locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas bounding box missing");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 70, cy - 50);
    await page.mouse.down({ button: "right" });
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(cx - 70 + (140 * i) / 6, cy - 50 + (100 * i) / 6);
      await page.waitForTimeout(30);
    }
    await page.mouse.up({ button: "right" });

    await expect(page.getByTestId("selection-action-chips")).toBeVisible({ timeout: 15_000 });
    const region = await page.evaluate(() => {
      const text = document.querySelector("[data-testid='project-export-json']")?.textContent ?? "";
      const state = JSON.parse(text) as {
        editor: { selection: { mapId: string; x: number; y: number; width: number; height: number } | null };
      };
      return state.editor.selection;
    });
    expect(region, "우클릭 드래그가 선택을 만들지 못했다").not.toBeNull();
    const rect: Rect = { x: region!.x, y: region!.y, width: region!.width, height: region!.height };
    await page.screenshot({ path: path.join(SHOT_DIR, "01-region-armed.png"), animations: "disabled" });

    // 칩 → 조수: 선택을 이번 턴의 스코프로 무장시키는 유일한 경로.
    await page.getByTestId("selection-chip-ai").click();
    await expect(page.getByTestId("ai-input")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, "02-assistant-armed.png"), animations: "disabled" });

    // ── 턴 1 ────────────────────────────────────────────────────────────────
    // 전송은 **Enter** 로 한다. `ai-send` 는 입력이 비었을 때 `aria-disabled="true"` 를 달고
    // (진짜 disabled 는 턴 진행 중에만 쓴다는 패널의 의도된 설계), Playwright 1.61 의
    // actionability 는 aria-disabled 를 "not enabled" 로 읽어 클릭을 무한 재시도한다 —
    // 실측으로 31분을 태웠다. Enter 는 사용자가 실제로 쓰는 경로이면서 그 게이트를 안 탄다.
    const before = await readMap(page, dims.mapId);
    const send = async (text: string): Promise<void> => {
      const input = page.getByTestId("ai-input");
      await input.fill(text);
      await expect(input).toHaveValue(text);
      await input.press("Enter");
    };
    await send(FIRST);
    await waitForTurn(page);
    const mid = await readMap(page, dims.mapId);
    const turn1Changed = diffCells(before, mid, dims.width);
    const turn1Outside = outsideOf(rect, turn1Changed);
    const turn1Statuses = await statuses(page);
    await page.screenshot({ path: path.join(SHOT_DIR, "03-turn1-applied.png"), animations: "disabled" });

    // ── 턴 2 (다시 무장하지 않는다) ──────────────────────────────────────────
    await send(FOLLOW_UP);
    await waitForTurn(page);
    const afterTurn2 = await readMap(page, dims.mapId);
    const turn2Changed = diffCells(mid, afterTurn2, dims.width);
    const turn2Outside = outsideOf(rect, turn2Changed);
    await page.screenshot({ path: path.join(SHOT_DIR, "04-turn2-applied.png"), animations: "disabled" });

    // ── 되돌리기 한 번 ──────────────────────────────────────────────────────
    // 마지막으로 맵을 바꾼 턴이 한 번에 사라져야 한다. 턴 2 가 아무것도 바꾸지 않았다면
    // (모델이 문장만 답한 경우) 기준선은 턴 1 앞이 된다.
    const undoBaseline = turn2Changed.length > 0 ? mid : before;
    await page.getByTestId("oprn-tool-undo").click();
    await page.waitForTimeout(1500);
    const afterUndo = await readMap(page, dims.mapId);
    const undoResidue = diffCells(undoBaseline, afterUndo, dims.width);
    await page.screenshot({ path: path.join(SHOT_DIR, "05-after-undo.png"), animations: "disabled" });

    const text = await logText(page);
    const receipt = {
      provider: auth.provider,
      mapId: dims.mapId,
      mapSize: { width: dims.width, height: dims.height },
      region: rect,
      turn1: {
        instruction: FIRST,
        changedCells: turn1Changed.length,
        outsideRegion: turn1Outside.length,
        outsideSample: turn1Outside.slice(0, 12),
      },
      turn2: {
        instruction: FOLLOW_UP,
        changedCells: turn2Changed.length,
        outsideRegion: turn2Outside.length,
        outsideSample: turn2Outside.slice(0, 12),
      },
      undo: {
        baseline: turn2Changed.length > 0 ? "turn1-end" : "turn1-start",
        residueCells: undoResidue.length,
      },
      statusEvents: turn1Statuses,
      // 클립이 실제로 돌았으면 로그에 되돌림 문구가 남는다(모델이 밖을 칠했을 때만).
      mentionedClip: text.includes("되돌렸습니다"),
      mentionedHarnessWarning: text.includes("플레이 가능성 경고"),
      logText: text.slice(0, 12_000),
    };
    writeFileSync(path.join(SHOT_DIR, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    // ── 단정: 모델의 선택에 좌우되지 않는 것만 ───────────────────────────────
    // (a) 영역 밖은 한 칸도 없어야 한다. 턴이 0칸이면 공허한 통과이므로 함께 본다.
    expect(turn1Changed.length, "턴 1 이 맵을 전혀 바꾸지 않았다 — 스코프 턴이 돌지 않았다").toBeGreaterThan(0);
    expect(turn1Outside, `턴 1 이 영역 밖 ${turn1Outside.length}칸을 건드렸다`).toEqual([]);
    expect(turn2Outside, `턴 2 가 영역 밖 ${turn2Outside.length}칸을 건드렸다`).toEqual([]);
    // (b) 배지: 켜졌고, 같은 runId 로 꺼졌고, 사각형이 내가 잡은 것과 같다.
    expect(turn1Statuses.length, "region-task-status 이벤트가 없다 — 배지가 뜨지 않았다").toBeGreaterThanOrEqual(2);
    expect(turn1Statuses[0]).toMatchObject({ running: true, mapId: dims.mapId, region: rect });
    const lastOff = [...turn1Statuses].reverse().find((s) => s.running === false);
    expect(lastOff, "배지가 꺼지지 않았다").toBeTruthy();
    expect(lastOff?.runId).toBe(turn1Statuses[0]?.runId);
    // (c) 후속 턴이 다시 무장하지 않고도 돌았다 — 세션이 살아 있다는 관측 가능한 증거.
    expect(text).toContain(FOLLOW_UP);
    // (d) 되돌리기 한 번에 마지막 턴이 통째로 사라진다.
    expect(undoResidue, `되돌리기 뒤 ${undoResidue.length}칸이 남았다 — 한 번에 원복되지 않는다`).toEqual([]);
  });
});
