/**
 * 밑그림 거부 루프 — 실제 에디터 표면 캡처 스펙 (수정 전/후 대조용).
 *
 * 무엇을 찍나 (2026-08-29 15:44 "나무를 굉장히 많이 심어라" 재현):
 *  A. 기존 타일이 있는 자리에 overExisting 없는 명세를 내면 검증기가 거부한다. 그 거부를
 *     같은 내용으로(키 순서만 바꿔) 두 번 더 재제출한다 — 실측 로그에서 모델이 한 그대로다.
 *     수정 후에는 요약에 "직전과 동일" 이 붙고 거부 메시지가 채울 필드 이름을 짚는다.
 *  B. 마무리 문장 없이 도구 예산을 소진시킨 턴. 수정 후에는 패널이 침묵하지 않는다.
 *
 * 하드 단정을 두지 않는다 — 수정 전 트리(HEAD~1)에서도 그대로 돌려 같은 잣대로 비교해야 한다.
 * 보이는 것을 스크린샷 + receipt.json 으로 기록만 한다.
 *
 * 실행:
 *   DEV_SERVER_PORT=9871 SHOT_DIR=<절대경로> npx playwright test \
 *     test/e2e/spec-reject-loop-capture.spec.ts --project=chromium
 */
import { test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SHOT_DIR = path.resolve(process.env.SHOT_DIR ?? ".omo/evidence/spec-reject-loop/after");
mkdirSync(SHOT_DIR, { recursive: true });

const receipt: Record<string, unknown> = { shotDir: SHOT_DIR };

/** 도구 호출 로그의 한 줄 요약들 — 패널이 실제로 보여주는 문자열. */
async function toolSummaries(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-testid='ai-tool-line'], .ai-tool-line, [data-testid^='ai-tool']")]
      .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0),
  );
}

/** 패널 로그 전체 텍스트 — 마무리 문장이 있는지 보려면 이게 제일 확실하다. */
async function logText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const log = document.querySelector(".ai-glass-log") ?? document.querySelector("[data-testid='ai-log']");
    return (log?.textContent ?? "").replace(/\s+/g, " ").trim();
  });
}

/** 접혀 있는 "작업 N ▸" 그룹을 모두 펼친다 — 접힌 상태로 찍으면 거부 루프가 화면에 안 남는다. */
async function expandToolLog(page: Page): Promise<void> {
  const toggles = page.getByTestId("ai-tool-activity-toggle");
  const count = await toggles.count();
  for (let index = 0; index < count; index += 1) {
    await toggles.nth(index).click().catch(() => {});
  }
  await page.waitForTimeout(300);
}

async function bootEditor(page: Page, maxToolCalls: number): Promise<string> {
  await page.addInitScript((limit: number) => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    // 예산 소진 시나리오를 몇 라운드로 끝내려면 안전핀을 낮춘다(기본 200).
    localStorage.setItem("oprn:ai-config", JSON.stringify({ maxToolCalls: limit, maxTokens: 8192, agentMode: "chat" }));
  }, maxToolCalls);
  await page.setViewportSize({ width: 1440, height: 980 });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible().catch(() => false)) await guest.click();
    const booted = await page
      .getByTestId("edit-canvas")
      .waitFor({ state: "visible", timeout: attempt === 3 ? 60_000 : 25_000 })
      .then(() => true)
      .catch(() => false);
    if (booted) break;
    if (attempt === 3) throw new Error("dev 서버가 편집 캔버스를 띄우지 못했다");
    await page.waitForTimeout(4_000);
  }
  const mapId = await page.evaluate(() => (window as unknown as {
    __oprnRegionTaskHarness?: { currentMapId: () => string };
  }).__oprnRegionTaskHarness?.currentMapId());
  return String(mapId);
}

function startTurn(page: Page, text: string): Promise<{ ok?: boolean; error?: string }> {
  return page.evaluate(async (prompt: string) => {
    const bridge = (window as unknown as {
      __oprnAiBridge?: { send: (value: string) => Promise<{ ok?: boolean; error?: string }> };
    }).__oprnAiBridge;
    if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
    return bridge.send(prompt);
  }, text);
}

/** (0,0)~(15,15) upper 레이어 — 소품이 실제로 올라갔는지 턴 전/후를 비교하려면 이게 필요하다.
 *  좁게(6×6) 보면 보식이 밑그림 밖에 자리를 잡을 때 0으로 잡혀 사실과 어긋난다. */
async function readUpperWindow(page: Page, mapId: string): Promise<(number | null)[]> {
  return page.evaluate(({ id }: { id: string }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { readCell: (m: string, l: "upper" | "lower", x: number, y: number) => number | null };
    }).__oprnRegionTaskHarness;
    const values: (number | null)[] = [];
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) values.push(harness?.readCell(id, "upper", x, y) ?? null);
    return values;
  }, { id: mapId });
}

/** 기존 타일을 깔아 배치 충돌(PLACEMENT_CONFLICT_MIN=4칸)을 만든다. */
async function seedExistingTiles(
  page: Page,
  mapId: string,
  rect: { x: number; y: number; w: number; h: number },
  material = "물",
): Promise<unknown> {
  return page.evaluate(
    ({ id, r, m }: { id: string; r: { x: number; y: number; w: number; h: number }; m: string }) => {
      const run = (window as unknown as {
        __oprnEditorTool?: (name: string, args: Record<string, unknown>) => unknown;
      }).__oprnEditorTool;
      if (!run) throw new Error("window.__oprnEditorTool 미등록");
      return run("fill_region", { mapId: id, rect: r, material: m, shape: "rect", layer: "lower" });
    },
    { id: mapId, r: rect, m: material },
  );
}

test.describe("밑그림 거부 루프 캡처", () => {
  test.describe.configure({ timeout: 240_000 });

  test("A: overExisting 없는 명세를 같은 내용으로 3회 재제출한다", async ({ page }) => {
    const state = { mapId: "" };
    let round = 0;
    // 1~3라운드: 같은 명세(키 순서만 다름). 4라운드: overExisting 을 넣은 명세. 이후 마무리.
    const conflictAsset = { id: "trees_dense", kind: "prop", x: 4, y: 4, w: 6, h: 6 };
    await page.route("**/v1/chat/completions", async (route) => {
      const body = route.request().postDataJSON() as { tools?: readonly unknown[] } | null;
      if ((body?.tools ?? []).length === 0) {
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify({ action: "direct", reason: "단일 배치" }) } }] }),
        });
        return;
      }
      round += 1;
      let args: Record<string, unknown>;
      if (round === 1) {
        args = { mapId: state.mapId, title: "울창한 숲", assets: [conflictAsset] };
      } else if (round === 2) {
        // 키 순서만 뒤집은 같은 내용 — 실측 로그의 314바이트 동일 payload 재현.
        args = { assets: [{ w: 6, kind: "prop", x: 4, h: 6, y: 4, id: "trees_dense" }], title: "울창한 숲", mapId: state.mapId };
      } else if (round === 3) {
        args = { title: "울창한 숲", assets: [{ h: 6, id: "trees_dense", y: 4, kind: "prop", w: 6, x: 4 }], mapId: state.mapId };
      } else {
        args = { mapId: state.mapId, title: "울창한 숲", assets: [{ ...conflictAsset, overExisting: "keep" }] };
      }
      const message = round <= 4
        ? { role: "assistant", content: "", tool_calls: [{ id: `call_${round}`, type: "function", function: { name: "set_build_spec", arguments: JSON.stringify(args) } }] }
        : { role: "assistant", content: "숲 밑그림을 확정했습니다." };
      await route.fulfill({ contentType: "application/json", status: 200, body: JSON.stringify({ choices: [{ message }] }) });
    });

    // 5회차 마무리 문장까지 나올 여유를 준다 — 4로 두면 A 도 예산 소진으로 끝나 B 와 섞인다.
    state.mapId = await bootEditor(page, 8);
    await seedExistingTiles(page, state.mapId, { x: 3, y: 3, w: 8, h: 8 });
    await page.screenshot({ path: path.join(SHOT_DIR, "a0-map-seeded.png"), animations: "disabled" });

    const turn = await startTurn(page, "나무를 굉장히 많이 심어라. 2x2 나무를 많이심어서 아예 통행불가능하게");
    await page.waitForTimeout(2_500);
    await expandToolLog(page);

    receipt.scenarioA = {
      bridge: turn,
      rounds: round,
      toolSummaries: await toolSummaries(page),
      logText: (await logText(page)).slice(0, 2400),
    };
    await page.screenshot({ path: path.join(SHOT_DIR, "a1-reject-loop-panel.png"), fullPage: false, animations: "disabled" });
    const log = page.locator(".ai-glass-log");
    if (await log.count() > 0) {
      await log.first().screenshot({ path: path.join(SHOT_DIR, "a2-reject-loop-log.png"), animations: "disabled" }).catch(() => {});
    }
  });

  test("B: 마무리 문장 없이 도구 예산을 소진한 턴", async ({ page }) => {
    let round = 0;
    await page.route("**/v1/chat/completions", async (route) => {
      const body = route.request().postDataJSON() as { tools?: readonly unknown[] } | null;
      if ((body?.tools ?? []).length === 0) {
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify({ action: "direct", reason: "조회 반복" }) } }] }),
        });
        return;
      }
      round += 1;
      // 마무리 문장을 절대 내지 않는다 — 예산 소진으로만 끝나게 한다.
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: "",
              tool_calls: [{ id: `call_${round}`, type: "function", function: { name: "get_project_summary", arguments: "{}" } }],
            },
          }],
        }),
      });
    });

    await bootEditor(page, 4);
    const turn = await startTurn(page, "맵 상태를 계속 조회해");
    await page.waitForTimeout(2_500);

    const text = await logText(page);
    receipt.scenarioB = {
      bridge: turn,
      rounds: round,
      mentionsBudget: text.includes("예산"),
      logText: text.slice(0, 2400),
    };
    await page.screenshot({ path: path.join(SHOT_DIR, "b1-truncated-turn-panel.png"), animations: "disabled" });
    const log = page.locator(".ai-glass-log");
    if (await log.count() > 0) {
      await log.first().screenshot({ path: path.join(SHOT_DIR, "b2-truncated-turn-log.png"), animations: "disabled" }).catch(() => {});
    }
  });

  test("C: 거부를 한 번 받고 overExisting 을 채워 실제로 나무를 심는 턴", async ({ page }) => {
    const state = { mapId: "" };
    let round = 0;
    await page.route("**/v1/chat/completions", async (route) => {
      const body = route.request().postDataJSON() as { tools?: readonly unknown[] } | null;
      if ((body?.tools ?? []).length === 0) {
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify({ action: "direct", reason: "숲 조성" }) } }] }),
        });
        return;
      }
      round += 1;
      const asset = { id: "trees_dense", kind: "prop", x: 4, y: 4, w: 6, h: 6 };
      let message: Record<string, unknown>;
      if (round === 1) {
        // 첫 제출은 overExisting 없이 — 검증기가 필드 이름을 짚어 거부한다.
        message = { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "set_build_spec", arguments: JSON.stringify({ mapId: state.mapId, title: "울창한 숲", assets: [asset] }) } }] };
      } else if (round === 2) {
        // 거부 메시지가 부른 필드를 채워 재제출 — 스키마에 선언돼 있어야 모델이 낼 수 있다.
        message = { role: "assistant", content: "", tool_calls: [{ id: "c2", type: "function", function: { name: "set_build_spec", arguments: JSON.stringify({ mapId: state.mapId, title: "울창한 숲", assets: [{ ...asset, overExisting: "keep" }] }) } }] };
      } else if (round === 3) {
        message = { role: "assistant", content: "", tool_calls: [{ id: "c3", type: "function", function: { name: "place_props", arguments: JSON.stringify({ mapId: state.mapId, area: { x: 4, y: 4, w: 6, h: 6 }, material: "침엽수", count: 24, minGap: 1, naturalness: 0.5, seed: 7 }) } }] };
      } else {
        message = { role: "assistant", content: "물가 위쪽 6×6 구역에 침엽수를 채웠습니다." };
      }
      await route.fulfill({ contentType: "application/json", status: 200, body: JSON.stringify({ choices: [{ message }] }) });
    });

    state.mapId = await bootEditor(page, 8);
    // 물이 아니라 모래를 깐다 — 물은 place_props 가 전부 건너뛰어(0개 배치) 심는 장면이 안 나온다.
    await seedExistingTiles(page, state.mapId, { x: 3, y: 3, w: 8, h: 8 }, "모래");
    await page.screenshot({ path: path.join(SHOT_DIR, "c0-before-turn.png"), animations: "disabled" });
    const upperBefore = await readUpperWindow(page, state.mapId);

    const turn = await startTurn(page, "나무를 굉장히 많이 심어라. 2x2 나무를 많이심어서 아예 통행불가능하게");
    await page.waitForTimeout(3_000);

    await expandToolLog(page);
    const upperAfter = await readUpperWindow(page, state.mapId);
    const changedCells = upperAfter.filter((value, index) => value !== upperBefore[index]).length;

    receipt.scenarioC = {
      bridge: turn,
      rounds: round,
      upperChangedIn16x16: changedCells,
      toolSummaries: (await toolSummaries(page)).slice(-4),
      logText: (await logText(page)).slice(-1200),
    };
    await page.screenshot({ path: path.join(SHOT_DIR, "c1-after-turn.png"), animations: "disabled" });
    // 변경 카드의 이전→이후 썸네일이 "실제로 심겼다" 를 가장 분명히 보여준다.
    const card = page.getByTestId("ai-change-card");
    if (await card.count() > 0) {
      await card.first().screenshot({ path: path.join(SHOT_DIR, "c2-change-card.png"), animations: "disabled" }).catch(() => {});
    }
  });

  // --grep 으로 한 시나리오만 다시 찍어도 나머지 기록이 지워지지 않게 병합해서 쓴다.
  test.afterAll(() => {
    const file = path.join(SHOT_DIR, "receipt.json");
    let previous: Record<string, unknown> = {};
    if (existsSync(file)) {
      try {
        previous = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      } catch {
        previous = {};
      }
    }
    writeFileSync(file, `${JSON.stringify({ ...previous, ...receipt }, null, 2)}\n`, "utf8");
  });
});
