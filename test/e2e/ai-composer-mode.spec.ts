/**
 * 컴포저 모드(질문/계획) 실표면 증거 스펙 — 실제 편집기에서 모드 칩을 눌러 보낸다.
 *
 * 무엇을 증명하나:
 *  - 질문 모드: 목업 LLM 이 쓰기 툴(fill_region)을 불러도 맵 셀이 바뀌지 않고, 요청 본문의 tools 에
 *    쓰기 스키마가 하나도 없다.
 *  - 지시 모드(기본): 실제 쓰기와 항목 상태를 확인하고 소유 턴 종료 후 라이브 계획은 제거된다.
 *  - 지시 모드(교착): 스펙 게이트에 막히는 대본이면 항목이 3회 만에 「막힘」으로 표시되고 턴이 끝난다
 *    (2026-09-03 실측 회귀: 예전에는 Ralph 가 같은 항목을 173/256 번 재주입했다).
 *  - 계획 모드: 플래너가 new_plan 을 내면 계획 체크리스트(`ai-work-plan-checklist`)만 뜨고 tools 가 실린
 *    LLM 호출(툴 루프)이 0회이며 맵 셀이 그대로다.
 *
 * 실행:
 *   npx playwright test test/e2e/ai-composer-mode.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SessionTurnOptions, TurnResult } from "../../src/ai/assistantSession";
import type { WorkPlan } from "../../src/ai/workPlan";

const EVIDENCE = path.resolve("output/evidence/ai-composer-mode");
mkdirSync(EVIDENCE, { recursive: true });

interface LlmLog {
  toolRounds: number;
  writeToolNamesSeen: string[];
  callsWithTools: number;
  callsWithoutTools: number;
}

const WRITE_TOOL_HINTS = ["fill_region", "paint_tiles", "paint_road", "place_npc", "place_props", "set_build_spec", "set_title_screen", "set_map_properties"];
const LIVE_PLAN = '[data-testid="ai-work-plan-checklist"], [data-testid="ai-plan-book"], [data-testid="ai-autonomous-feed"]';

interface HeldTurn {
  options: SessionTurnOptions;
  result: TurnResult;
  plan: WorkPlan | null;
}

async function holdSessionReturn(page: Page) {
  // Plan-only completion has no HTTP round after publishing its plan. Hold only the
  // real return value, not planning/tool execution, so owner finally cannot race inspection.
  let announce: (value: HeldTurn) => void = () => {};
  let release: () => void = () => {};
  const held = new Promise<HeldTurn>((resolve) => { announce = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  await page.exposeFunction("__composerTurnHeld", async (value: HeldTurn) => {
    announce(value);
    await released;
  });
  await page.evaluate(async () => {
    const modulePath = "/src/ai/assistantSession.ts";
    const { AssistantSession } = await import(modulePath) as typeof import("../../src/ai/assistantSession");
    const original = AssistantSession.prototype.sendUserMessage;
    AssistantSession.prototype.sendUserMessage = async function (...args) {
      const result = await original.apply(this, args);
      const bridge = window as unknown as { __composerTurnHeld: (value: HeldTurn) => Promise<void> };
      await bridge.__composerTurnHeld({ options: args[3] ?? {}, result, plan: this.getWorkPlan() });
      return result;
    };
  });
  return { held, release };
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Session did not reach the held return")), 60_000);
    })]);
  } finally { clearTimeout(timer); }
}

function terminal(page: Page, instruction: string) {
  return page.waitForRequest((request) => {
    if (!request.url().endsWith("/__oprn/ai-activity") || request.method() !== "POST") return false;
    const record = request.postDataJSON();
    return record.instruction === instruction && record.result?.pending !== true && record.result?.stoppedReason !== undefined;
  }, { timeout: 60_000 });
}

/**
 * 어느 모드든 같은 대본: 플래너 콜(툴 없음)엔 new_plan(2항목), 툴 콜엔 쓰기 툴을 `writeRounds` 번(기본 1), 그 뒤 마무리 문장.
 * 쓰기 툴은 기본 `fill_region`(질문·계획 모드 — 스펙 게이트에 막혀도 상관없다). `writeTool: "set_map_properties"` 는
 * 지시 모드 라이브 체크 검증용 — 밑그림 없는 빈 프로젝트에서도 실제로 성공하는 쓰기라 항목이 자동 완료된다.
 */
async function installScriptedLlm(
  page: Page,
  target: () => { mapId: string; rect: { x: number; y: number; w: number; h: number } },
  opts: { readonly writeRounds?: number; readonly writeTool?: "fill_region" | "set_map_properties" } = {},
): Promise<LlmLog> {
  const writeRounds = opts.writeRounds ?? 1;
  const writeTool = opts.writeTool ?? "fill_region";
  const log: LlmLog = { toolRounds: 0, writeToolNamesSeen: [], callsWithTools: 0, callsWithoutTools: 0 };
  await page.route("**/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON() as { tools?: readonly { function: { name: string } }[] } | null;
    const tools = body?.tools ?? [];
    let message: Record<string, unknown>;
    if (tools.length === 0) {
      log.callsWithoutTools += 1;
      message = {
        role: "assistant",
        content: JSON.stringify({
          action: "new_plan",
          goal: "광장 연못 2단계",
          layers: [{ title: "연못", items: [
            { title: "연못 채우기", instruction: `${writeTool} 으로 광장에 연못`, successTools: [writeTool] },
            { title: "가장자리 정리", instruction: `${writeTool} 으로 테두리`, successTools: [writeTool] },
          ] }],
        }),
      };
    } else {
      log.callsWithTools += 1;
      for (const tool of tools) if (WRITE_TOOL_HINTS.includes(tool.function.name)) log.writeToolNamesSeen.push(tool.function.name);
      if (log.toolRounds < writeRounds) {
        log.toolRounds += 1;
        const { mapId, rect } = target();
        const args = writeTool === "fill_region"
          ? { mapId, rect, material: "물", shape: "circle", layer: "lower", reason: "연못" }
          : { mapId, name: `연못 광장 ${log.toolRounds}단계`, reason: "단계 이름 반영" };
        message = {
          role: "assistant",
          content: "",
          tool_calls: [{
            id: `call_write_${log.toolRounds}`,
            type: "function",
            function: { name: writeTool, arguments: JSON.stringify(args) },
          }],
        };
      } else {
        message = { role: "assistant", content: "이 맵은 광장 하나로 이뤄져 있습니다." };
      }
    }
    await route.fulfill({ contentType: "application/json", status: 200, body: JSON.stringify({ choices: [{ message }] }) });
  });
  return log;
}

async function bootEditor(page: Page): Promise<string> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  const guest = page.getByTestId("login-guest");
  const bootReady = guest.or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 120_000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await bootReady;
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("ai-input")).toBeVisible();
  const mapId = await page.evaluate(() => (window as unknown as { __oprnRegionTaskHarness?: { currentMapId: () => string } }).__oprnRegionTaskHarness?.currentMapId());
  expect(mapId).toBeTruthy();
  return String(mapId);
}

function readCell(page: Page, mapId: string, x: number, y: number): Promise<number | null> {
  return page.evaluate(({ id, cx, cy }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { readCell: (mapId: string, layer: string, x: number, y: number) => number | null };
    }).__oprnRegionTaskHarness;
    return harness ? harness.readCell(id, "lower", cx, cy) : null;
  }, { id: mapId, cx: x, cy: y });
}

async function sendViaComposer(page: Page, mode: "ask" | "plan" | "do", text: string): Promise<void> {
  const chip = page.getByTestId(`ai-composer-mode-${mode}`);
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("ai-input").fill(text);
  await page.getByTestId("ai-send").click();
}

test.describe("컴포저 모드가 실제로 세션을 바꾼다", () => {
  test.describe.configure({ timeout: 180_000, retries: 0 });

  test("질문 모드: 쓰기 툴 미노출 + fill_region 호출도 맵을 못 바꾼다", async ({ page }) => {
    const target = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    const log = await installScriptedLlm(page, () => target);
    target.mapId = await bootEditor(page);
    const center = { x: 5, y: 5 };
    const before = await readCell(page, target.mapId, center.x, center.y);
    expect(before).not.toBeNull();

    const turn = await holdSessionReturn(page);
    const instruction = "이 맵은 어떻게 구성돼 있어?";
    await sendViaComposer(page, "ask", instruction);
    const held = await bounded(turn.held);
    expect(held.options.composerMode).toBe("ask");
    expect(log.callsWithTools).toBeGreaterThan(0);
    const done = terminal(page, instruction);
    turn.release();
    const receipt = (await done).postDataJSON();
    expect(receipt.result.stoppedReason).toBe("final");
    expect(receipt.result.appliedCalls).toBe(0);

    expect(log.writeToolNamesSeen, "질문 모드 요청 tools 에 쓰기 스키마가 실렸다").toEqual([]);
    expect(await readCell(page, target.mapId, center.x, center.y)).toBe(before);
    await expect(page.locator("[data-testid='ai-change-card']")).toHaveCount(0);
    await page.screenshot({ path: path.join(EVIDENCE, "ask-mode-no-change.png"), animations: "disabled" });
    writeFileSync(path.join(EVIDENCE, "ask-mode.json"), JSON.stringify({ before, after: await readCell(page, target.mapId, center.x, center.y), log, held, receipt }, null, 2));
  });

  test("계획 모드: 계획 체크리스트만 뜨고 툴 루프는 돌지 않는다", async ({ page }) => {
    const target = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    const log = await installScriptedLlm(page, () => target);
    target.mapId = await bootEditor(page);
    const center = { x: 5, y: 5 };
    const before = await readCell(page, target.mapId, center.x, center.y);

    const turn = await holdSessionReturn(page);
    const instruction = "광장에 연못을 두 단계로 만들어줘";
    await sendViaComposer(page, "plan", instruction);
    const held = await bounded(turn.held);
    expect(held.options.composerMode).toBe("plan");
    expect(held.plan?.layers.flatMap((layer) => layer.items)).toHaveLength(2);
    await expect(page.getByTestId("ai-work-plan-checklist")).toBeVisible();
    await page.getByTestId("ai-plan-book-open").click();
    await expect(page.getByTestId("ai-plan-book")).toBeVisible();
    const done = terminal(page, instruction);
    turn.release();
    const receipt = (await done).postDataJSON();
    expect(receipt.result.stoppedReason).toBe("final");
    expect(receipt.result.appliedCalls).toBe(0);
    await expect(page.locator(LIVE_PLAN)).toHaveCount(0);

    // 툴 없는 호출은 의도 선언자 + 플래너 두 번이다. 핵심은 tools 가 실린 호출(툴 루프)이 0회라는 것.
    expect(log.callsWithoutTools).toBeGreaterThanOrEqual(1);
    expect(log.callsWithTools, "계획 모드에서 툴 루프가 돌았다").toBe(0);
    await expect(page.getByTestId("ai-autonomous-budget")).toHaveCount(0);
    expect(await readCell(page, target.mapId, center.x, center.y)).toBe(before);
    await expect(page.getByTestId("ai-chat-log")).toContainText(held.result.assistantText);
    await page.screenshot({ path: path.join(EVIDENCE, "plan-mode-card-only.png"), animations: "disabled" });
    writeFileSync(path.join(EVIDENCE, "plan-mode.json"), JSON.stringify({ before, log, held, receipt }, null, 2));
  });
  test("지시 모드: 실제 쓰기·라이브 항목을 보존하고 턴 종료 후 목록을 제거한다", async ({ page }) => {
    const target = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    // 두 항목 모두 set_map_properties 로 끝난다 — 라운드 1 → 항목 1 완료, 라운드 2 → 항목 2 완료, 그 뒤 마무리 문장.
    // (fill_region 은 밑그림 없는 빈 맵에서 스펙 게이트에 막혀 항목이 영원히 in_progress 로 남는다 — 실측.)
    const log = await installScriptedLlm(page, () => target, { writeRounds: 2, writeTool: "set_map_properties" });
    target.mapId = await bootEditor(page);

    const turn = await holdSessionReturn(page);
    const instruction = "광장에 연못을 두 단계로 만들어줘";
    await sendViaComposer(page, "do", instruction);
    const held = await bounded(turn.held);
    expect(held.options.composerMode).toBe("do");

    const checklist = page.getByTestId("ai-work-plan-checklist");
    await expect(checklist).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("ai-plan-book-open").click();
    await expect(page.getByTestId("ai-plan-book")).toBeVisible();
    await page.getByTestId("ai-plan-book-next").click();
    const items = page.getByTestId("ai-autonomous-item");
    await expect(items).toHaveCount(2, { timeout: 60_000 });
    // 첫 툴이 성공하면 첫 항목에 체크가 붙는다(라이브).
    await expect(items.nth(0)).toHaveAttribute("data-status", "done", { timeout: 60_000 });
    await page.screenshot({ path: path.join(EVIDENCE, "do-mode-live-check.png"), animations: "disabled" });

    await expect(items.nth(1)).toHaveAttribute("data-status", "done");
    expect(held.plan?.layers.flatMap((layer) => layer.items.map((item) => item.status))).toEqual(["done", "done"]);
    await expect(checklist).toHaveAttribute("data-active", "true");
    const done = terminal(page, instruction);
    turn.release();
    const receipt = (await done).postDataJSON();
    expect(receipt.result.stoppedReason).toBe("final");
    expect(receipt.result.appliedCalls).toBe(2);
    expect(receipt.toolCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "set_map_properties", ok: true }),
      expect.objectContaining({ name: "run_lint", ok: true }),
    ]));
    const name = await page.evaluate(async (mapId) => {
      const modulePath = "/src/project/store.ts";
      const { store } = await import(modulePath) as typeof import("../../src/project/store");
      return store.getCurrent().maps[mapId]?.name;
    }, target.mapId);
    expect(name).toBe("연못 광장 2단계");
    await expect(page.locator(LIVE_PLAN)).toHaveCount(0);
    await expect(page.getByTestId("ai-run-stop")).toHaveCount(0);
    expect(log.toolRounds).toBe(2);
    await page.screenshot({ path: path.join(EVIDENCE, "do-mode-settled-list.png"), animations: "disabled" });
    writeFileSync(path.join(EVIDENCE, "do-mode.json"), JSON.stringify({ log, held, receipt, name }, null, 2));
  });

  test("지시 모드(교착): 스펙 게이트에 막히면 항목이 「막힘」으로 표시되고 턴이 끝난다", async ({ page }) => {
    const target = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    // fill_region 은 밑그림 없는 빈 맵에서 스펙 게이트에 막힌다 — 모델이 몇 번 더 시도해도 같다.
    const log = await installScriptedLlm(page, () => target, { writeRounds: 30, writeTool: "fill_region" });
    target.mapId = await bootEditor(page);

    const before = await readCell(page, target.mapId, 5, 5);
    const turn = await holdSessionReturn(page);
    const instruction = "광장에 연못을 두 단계로 만들어줘";
    await sendViaComposer(page, "do", instruction);
    const held = await bounded(turn.held);
    expect(held.options.composerMode).toBe("do");

    const checklist = page.getByTestId("ai-work-plan-checklist");
    await expect(checklist).toBeVisible({ timeout: 60_000 });
    // 무한 재주입이 아니라 막힘으로 끝난다.
    await expect(checklist).toHaveAttribute("data-blocked", "true", { timeout: 120_000 });
    await expect(checklist).toHaveAttribute("data-active", "true");
    await page.getByTestId("ai-plan-book-open").click();
    await page.getByTestId("ai-plan-book-next").click();
    await expect(page.getByTestId("ai-autonomous-item").nth(0)).toHaveAttribute("data-status", "blocked");
    // 사용자는 왜 막혔는지 읽을 수 있다.
    await expect(page.getByTestId("ai-plan-book").getByTestId("ai-work-item-blocked-note")).toBeVisible();
    // 왕복이 손에 꼽는 수준에서 멈춘다(예전엔 173회였다). 같은 실패 4회에서 끊긴다.
    expect(log.toolRounds).toBeLessThanOrEqual(6);
    await page.screenshot({ path: path.join(EVIDENCE, "do-mode-blocked-item.png"), animations: "disabled" });
    const done = terminal(page, instruction);
    turn.release();
    const receipt = (await done).postDataJSON();
    expect(receipt.result.stoppedReason).toBe("final");
    expect(receipt.result.appliedCalls).toBe(0);
    expect(receipt.toolCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "fill_region", ok: false }),
    ]));
    expect(await readCell(page, target.mapId, 5, 5)).toBe(before);
    await expect(page.locator(LIVE_PLAN)).toHaveCount(0);
    const blockedNote = held.plan?.layers[0]?.items[0]?.note;
    if (!blockedNote) throw new Error("Blocked item lost its reason");
    await expect(page.getByTestId("ai-chat-log")).toContainText(blockedNote);
    writeFileSync(path.join(EVIDENCE, "do-mode-blocked.json"), JSON.stringify({ log, held, receipt }, null, 2));
  });
});
