/**
 * AI 제안 즉시 적용 + 좌하단 되돌리기 복구 증거 스펙 (실제 에디터 표면).
 *
 * 무엇을 증명하나:
 *  - 스크립트된 AI 턴(실 LLM 없음, `/v1/chat/completions` 목업) 하나가 승인 카드
 *    (`ai-proposal-card`, "이 맵에 넣기") 없이 **바로 맵에 적용**된다. 이 턴은 예전 게이트를
 *    통과하지 못하는 조합이다(set_build_spec 은 LOW_RISK_SPATIAL_TOOLS 밖 → classifyProposalSafety
 *    가 review-required 로 분류) — 즉 예전에는 반드시 카드가 떴다.
 *  - 적용 결과는 로그의 자동 적용 비교 카드(`ai-auto-applied-card`)로 남는다.
 *  - **왼쪽 아래 되돌리기(`oprn-tool-undo`)** 한 번으로 그 적용이 원복된다 — 승인 대신 쓰는
 *    복구 경로가 실제로 동작함을 타일 값으로 확인한다.
 *
 * 왜 목업 경로인가: loadAiConfig()(src/ai/llmClient.ts)는 저장된 authMode/baseUrl/apiKey 를
 * 무시하고 항상 동반 서비스로 나간다(dev 에서는 같은 오리진 `/v1`). 그래서 라우트 자체를
 * 가로채 플래너 1콜 + 툴 루프 2라운드 + 마무리 1콜을 결정적으로 대본화한다.
 *
 * 실행:
 *   DEV_SERVER_PORT=9861 npx playwright test test/e2e/ai-apply-without-approval.spec.ts --project=chromium
 * dev 서버는 playwright.config 의 webServer 가 관리한다(스위트 종료 시 자동 종료).
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/ai-apply-without-approval");
const PROPOSAL_CARD = "[data-testid='ai-proposal-card']";
const APPLIED_CARD = "[data-testid='ai-auto-applied-card']";
const UNDO_BUTTON = "[data-testid='oprn-tool-undo']";

const timeline: string[] = [];

mkdirSync(EVIDENCE, { recursive: true });

// dev 서버는 playwright.config 의 webServer 가 띄우고 스위트 종료 시 직접 내린다
// (`reuseExistingServer: true`). 스펙이 같은 포트를 따로 spawn/kill 하면 그 관리자와 싸워서
// "포트가 아직 살아 있다" 는 거짓 실패만 만든다 — 실측으로 확인했다. 그래서 여기서는 서버를
// 건드리지 않고, 증거 영수증(타일 타임라인)만 남긴다.

// ── 대본화된 AI 턴 ──────────────────────────────────────────────────────────
interface TurnPlan {
  mapId: string;
  rect: { x: number; y: number; w: number; h: number };
}

/** 플래너(툴 없음) → set_build_spec → fill_region → 마무리 문장. */
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
      message = { role: "assistant", content: "연못을 넣었습니다." };
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
  // 빈 프로젝트로 띄운다: 샘플 마을(`?freshProject=1`)에는 수관 아래 밑동이 없는 나무가 이미
  // 있어 배치 검증(validateLayoutPlacement)이 이 프로젝트의 모든 AI 적용을 막는다 — 그 기존
  // 결함은 이 스펙의 대상이 아니다.
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
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

/** 맵 안쪽의 안전한 사각형 — 하네스 readCell 로 네 귀퉁이가 맵 안인지 확인한다. */
async function pickRegion(page: Page, mapId: string): Promise<TurnPlan["rect"]> {
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __oprnRegionTaskHarness?: unknown }).__oprnRegionTaskHarness === "object"), {
      timeout: 30_000,
      intervals: [200],
    })
    .toBe(true);
  const rect = await page.evaluate(({ id }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { readCell: (mapId: string, layer: string, x: number, y: number) => number | null };
    }).__oprnRegionTaskHarness;
    if (!harness) return null;
    const size = { w: 6, h: 6 };
    for (let y = 2; y < 40; y += 1) {
      for (let x = 2; x < 40; x += 1) {
        if (harness.readCell(id, "lower", x + size.w - 1, y + size.h - 1) === null) continue;
        return { x, y, ...size };
      }
    }
    return null;
  }, { id: mapId });
  expect(rect, "맵 안에서 채울 영역을 찾지 못했다").toBeTruthy();
  return rect as TurnPlan["rect"];
}

function readCell(page: Page, mapId: string, x: number, y: number): Promise<number | null> {
  return page.evaluate(({ id, cx, cy }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { readCell: (mapId: string, layer: string, x: number, y: number) => number | null };
    }).__oprnRegionTaskHarness;
    return harness ? harness.readCell(id, "lower", cx, cy) : null;
  }, { id: mapId, cx: x, cy: y });
}

function startTurn(page: Page, text: string): Promise<{ ok?: boolean; error?: string }> {
  return page.evaluate(async (prompt) => {
    const bridge = (window as unknown as {
      __oprnAiBridge?: { send: (value: string) => Promise<{ ok?: boolean; error?: string }> };
    }).__oprnAiBridge;
    if (!bridge) throw new Error("window.__oprnAiBridge 미등록 — AI 패널이 마운트되지 않았다");
    return bridge.send(prompt);
  }, text);
}

test.describe("AI 제안 즉시 적용 + 좌하단 되돌리기", () => {
  test.describe.configure({ timeout: 180_000 });

  test("승인 카드 없이 맵에 적용되고 되돌리기 한 번으로 원복된다", async ({ page }) => {
    const plan: TurnPlan = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    await installScriptedTurn(page, () => plan);
    plan.mapId = await bootEditor(page);
    plan.rect = await pickRegion(page, plan.mapId);
    const center = { x: plan.rect.x + Math.floor(plan.rect.w / 2), y: plan.rect.y + Math.floor(plan.rect.h / 2) };

    const beforeTile = await readCell(page, plan.mapId, center.x, center.y);
    expect(beforeTile, "적용 전 타일 값을 읽어야 한다").not.toBeNull();
    timeline.push(`before=${String(beforeTile)}`);

    const result = await startTurn(page, "광장 가운데에 둥근 연못을 만들어줘");
    expect(result.ok, `브리지 턴 실패: ${result.error ?? ""}`).toBe(true);

    // 경계 1: 승인 카드가 아예 뜨지 않는다 — 바로 적용된다.
    await expect(page.locator(APPLIED_CARD)).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(PROPOSAL_CARD)).toHaveCount(0);
    await expect
      .poll(() => readCell(page, plan.mapId, center.x, center.y), { timeout: 30_000, intervals: [200] })
      .not.toBe(beforeTile);
    const appliedTile = await readCell(page, plan.mapId, center.x, center.y);
    timeline.push(`applied=${String(appliedTile)}`);
    await page.screenshot({ path: path.join(EVIDENCE, "applied-without-approval.png"), animations: "disabled" });

    // 경계 2: 좌하단 되돌리기 한 번으로 원복 — 승인 대신 쓰는 복구 경로.
    const undo = page.locator(UNDO_BUTTON);
    await expect(undo).toBeVisible({ timeout: 15_000 });
    await undo.click();
    await expect
      .poll(() => readCell(page, plan.mapId, center.x, center.y), { timeout: 30_000, intervals: [200] })
      .toBe(beforeTile);
    timeline.push(`after-undo=${String(await readCell(page, plan.mapId, center.x, center.y))}`);
    await page.screenshot({ path: path.join(EVIDENCE, "reverted-by-sidebar-undo.png"), animations: "disabled" });

    writeFileSync(
      path.join(EVIDENCE, "tile-timeline.txt"),
      `${["map: " + plan.mapId, `cell: (${center.x},${center.y})`, ...timeline].join("\n")}\n`,
      "utf8",
    );
  });
});
