/**
 * 실제 모델(gemini-3.7-flash, Antigravity OAuth)로 2026-08-29 15:44 지시를 다시 돌린다.
 *
 * 왜 필요한가: 스키마 수정의 근거는 "모델이 선언되지 않은 필드를 낼 수 없다" 였고, 그 증명은
 * 목업 LLM 으로 했다. 목업은 스키마에 구속되지 않으므로 "이제 실제 모델이 overExisting 을 내는가"
 * 는 목업으로 답할 수 없다. 그래서 진짜 모델을 붙여 한 턴을 그대로 돌린다.
 *
 * 하드 단정은 최소로 둔다 — 실제 모델은 매번 다른 계획을 낸다. 대신 무엇이 일어났는지를
 * receipt.json 에 남긴다: 거부 횟수, overExisting 을 실제로 냈는지, 종료 사유, 바뀐 칸 수.
 *
 * 실행(인증 파일 경로를 반드시 넘긴다 — 에이전트 셸의 HOME 은 /home/main 이 아니다):
 *   RPG_ZZU_OH_MY_PI_AUTH_PATH=/home/main/.rpg-zzu/oh-my-pi-auth.json \
 *   DEV_SERVER_PORT=9613 SHOT_DIR=<절대경로> \
 *   npx playwright test test/e2e/real-model-tree-turn.spec.ts --project=chromium --workers=1
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SHOT_DIR = path.resolve(process.env.SHOT_DIR ?? ".omo/evidence/real-model-tree/run");
mkdirSync(SHOT_DIR, { recursive: true });

/** 15:44 에 사용자가 실제로 보낸 문장. 한 글자도 바꾸지 않는다. */
const INSTRUCTION = "나무를 굉장히 많이 심어라. 2x2 나무를 많이심어서 아예 통행불가능하게하고 중간중간에 물도흐르게";
/** 통행 실측 창 — 모델이 어디에 심을지는 모르니 24×24 전체를 본다. */
const PROBE_AREA = { x: 0, y: 0, w: 24, h: 24 } as const;

async function logText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const log = document.querySelector(".ai-glass-log") ?? document.querySelector("[data-testid='ai-log']");
    return (log?.textContent ?? "").replace(/\s+/g, " ").trim();
  });
}

async function bootEditor(page: Page): Promise<string> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    // 영역 작업과 같은 압력을 준다(REGION_TASK_MAX_TOOL_CALLS = 24). authMode 는 코드가
    // 무조건 OAuth 로 고정하므로 여기서 지정하지 않는다.
    localStorage.setItem("oprn:ai-config", JSON.stringify({ maxToolCalls: 24, maxTokens: 32768, agentMode: "chat" }));
  });
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  return String(await page.evaluate(() => (window as unknown as {
    __oprnRegionTaskHarness?: { currentMapId: () => string };
  }).__oprnRegionTaskHarness?.currentMapId()));
}

function runTool(page: Page, name: string, args: Record<string, unknown>): Promise<unknown> {
  return page.evaluate(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
    const run = (window as unknown as {
      __oprnEditorTool?: (name: string, args: Record<string, unknown>) => unknown;
    }).__oprnEditorTool;
    if (!run) throw new Error("window.__oprnEditorTool 미등록");
    return run(toolName, toolArgs);
  }, { toolName: name, toolArgs: args });
}

/** 영역 안 통행 가능 칸 수 — "아예 통행불가능하게" 가 달성됐는지 세는 유일한 방법. */
function passableCount(page: Page, mapId: string, area: { x: number; y: number; w: number; h: number }): Promise<number | null> {
  return page.evaluate(({ id, rect }: { id: string; rect: { x: number; y: number; w: number; h: number } }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { passableCount?: (m: string, a: { x: number; y: number; w: number; h: number }) => number | null };
    }).__oprnRegionTaskHarness;
    return harness?.passableCount?.(id, rect) ?? null;
  }, { id: mapId, rect: area });
}

/** upper 레이어 24×24 스냅샷 — 실제로 뭐가 올라갔는지 턴 전/후로 센다. */
function readUpper(page: Page, mapId: string): Promise<(number | null)[]> {
  return page.evaluate(({ id }: { id: string }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { readCell: (m: string, l: "upper" | "lower", x: number, y: number) => number | null };
    }).__oprnRegionTaskHarness;
    const values: (number | null)[] = [];
    for (let y = 0; y < 24; y += 1) for (let x = 0; x < 24; x += 1) values.push(harness?.readCell(id, "upper", x, y) ?? null);
    return values;
  }, { id: mapId });
}

test.describe("실제 모델 나무 심기 턴", () => {
  test.describe.configure({ timeout: 900_000 });

  test("gemini-3.7-flash 가 거부 루프 없이 한 턴을 끝낸다", async ({ page }) => {
    // 실제 모델을 쓰는 스펙이므로 LLM 목업을 걸지 않는다. 인증이 살아 있는지 먼저 본다.
    const auth = await page.request.get("/auth/status").then((res) => res.json());
    expect(auth.connected, "Antigravity OAuth 세션이 필요하다 — /auth/status connected:false").toBe(true);

    const mapId = await bootEditor(page);
    // 15:44 의 조건 재현: 나무를 놓으려는 자리에 이미 다른 지형이 있어야 검증기가
    // overExisting 을 요구한다. 빈 맵이면 그 분기 자체가 안 돌아 시험이 무의미하다.
    await runTool(page, "fill_region", { mapId, rect: { x: 3, y: 3, w: 10, h: 10 }, material: "물", shape: "rect", layer: "lower" });
    const before = await readUpper(page, mapId);
    const passableBefore = await passableCount(page, mapId, PROBE_AREA);
    await page.screenshot({ path: path.join(SHOT_DIR, "r0-before.png"), animations: "disabled" });

    const startedAt = Date.now();
    const turn = await page.evaluate(async (prompt: string) => {
      const bridge = (window as unknown as {
        __oprnAiBridge?: { send: (value: string) => Promise<unknown> };
      }).__oprnAiBridge;
      if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
      return bridge.send(prompt);
    }, INSTRUCTION);
    const elapsedMs = Date.now() - startedAt;

    const after = await readUpper(page, mapId);
    const passableAfter = await passableCount(page, mapId, PROBE_AREA);
    const text = await logText(page);
    const rejections = (text.match(/밑그림 검증 실패/g) ?? []).length;
    const repeated = (text.match(/직전과 동일/g) ?? []).length;

    const changedCells = after.filter((value, index) => value !== before[index]).length;
    const receipt = {
      model: "gemini-3.7-flash",
      provider: auth.provider,
      instruction: INSTRUCTION,
      elapsedMs,
      turn,
      specRejections: rejections,
      repeatedSpecFlagged: repeated,
      // 모델이 실제로 그 필드를 냈는가 — 이 스펙의 존재 이유다.
      emittedOverExisting: text.includes("overExisting\": \"") || /overExisting":\s*"(clear|keep)"/.test(text),
      // 밀집 배치를 실제로 골랐는가 + 통행 칸이 줄었다고 보고했는가.
      emittedDensePacking: /packing":\s*"dense"/.test(text) || text.includes("밀집"),
      reportedPassability: /통행 가능 칸 \d+→\d+/.test(text),
      // 승인 대기로 끝났다면 그 사실을 말했는가(모델의 "시공했습니다" 를 덮는 안내).
      statedPendingHonestly: text.includes("아직 맵에 반영되지 않았습니다"),
      upperChangedIn24x24: changedCells,
      passableBefore,
      passableAfter,
      logText: text.slice(0, 12_000),
    };
    writeFileSync(path.join(SHOT_DIR, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    await page.screenshot({ path: path.join(SHOT_DIR, "r1-after.png"), animations: "disabled" });
    const log = page.locator(".ai-glass-log");
    if (await log.count() > 0) {
      await log.first().screenshot({ path: path.join(SHOT_DIR, "r2-log.png"), animations: "disabled" }).catch(() => {});
    }

    // 하드 단정은 둘만 둔다.
    //
    // 1) 되살아나면 안 되는 것은 "같은 명세를 그대로 재제출하는 루프" 다. 거부 횟수 자체를
    //    잣대로 삼으면(예전 판: rejections < 3) 건강한 반복까지 실패로 잡는다 — 실측 1회차는
    //    거부 4회였지만 전부 다른 사유(에셋 교차)였고 턴은 정상적으로 수렴했다.
    expect(repeated, `직전과 동일한 명세 재제출 ${repeated}회 — 거부 루프가 되살아났다`).toBe(0);
    // 2) 한 턴이 실제로 맵을 건드려야 한다. 0칸이면 예산만 태우고 끝난 그 실패다.
    expect(changedCells, "upper 24×24 에서 바뀐 칸이 없다 — 턴이 아무것도 하지 않았다").toBeGreaterThan(0);
    // 3) 통행을 막으라는 지시였으므로 통행 가능 칸이 줄어야 한다. 나무를 몇 그루 심었는지가
    //    아니라 이 숫자가 지시 이행의 증거다.
    expect(passableBefore, "passableCount 하네스가 없다 — dev 서버가 낡은 코드다").not.toBeNull();
    expect(passableAfter!, `통행 가능 칸 ${passableBefore}→${passableAfter} — 지나갈 길이 그대로다`)
      .toBeLessThan(passableBefore!);
  });

  // 승인 대기 안내("아직 맵에 반영되지 않았습니다") 검증은 삭제했다 — 승인 게이트 자체가
  // 없어졌다(approvalPolicy: 즉시 적용, 복구는 되돌리기). 영역 작업이 조수 세션으로 합쳐진 뒤
  // 스코프 턴의 적용·클립 계약은 test/scopedAssistantTurn.test.ts 와
  // test/aiChatPanelUxRepairs.test.ts 가 실측한다.
});
