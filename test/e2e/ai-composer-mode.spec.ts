/**
 * 컴포저 모드(질문/계획) 실표면 증거 스펙 — 실제 편집기에서 모드 칩을 눌러 보낸다.
 *
 * 무엇을 증명하나:
 *  - 질문 모드: 목업 LLM 이 쓰기 툴(fill_region)을 불러도 맵 셀이 바뀌지 않고, 요청 본문의 tools 에
 *    쓰기 스키마가 하나도 없다.
 *  - 지시 모드(기본): 계획이 뜨고 툴이 성공할 때마다 항목에 체크가 붙으며, 턴이 끝나도 목록이 남는다.
 *  - 계획 모드: 플래너가 new_plan 을 내면 계획 체크리스트(`ai-work-plan-checklist`)만 뜨고 tools 가 실린
 *    LLM 호출(툴 루프)이 0회이며 맵 셀이 그대로다.
 *
 * 실행:
 *   npx playwright test test/e2e/ai-composer-mode.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve("verify-shots/ai-composer-mode");
mkdirSync(EVIDENCE, { recursive: true });

interface LlmLog {
  toolRounds: number;
  writeToolNamesSeen: string[];
  callsWithTools: number;
  callsWithoutTools: number;
}

const WRITE_TOOL_HINTS = ["fill_region", "paint_tiles", "paint_road", "place_npc", "place_props", "set_build_spec", "set_title_screen"];

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
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible().catch(() => false)) await guest.click();
    await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 15_000 });
    const booted = await page
      .getByTestId("edit-canvas")
      .waitFor({ state: "visible", timeout: attempt === 3 ? 60_000 : 25_000 })
      .then(() => true)
      .catch(() => false);
    if (booted) break;
    if (attempt === 3) throw new Error("dev 서버가 세 번 시도해도 편집 캔버스를 띄우지 못했다");
    await page.waitForTimeout(4_000);
  }
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __oprnRegionTaskHarness?: unknown }).__oprnRegionTaskHarness === "object"), { timeout: 30_000, intervals: [200] })
    .toBe(true);
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

async function sendViaComposer(page: Page, mode: "ask" | "plan", text: string): Promise<void> {
  const chip = page.getByTestId(`ai-composer-mode-${mode}`);
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("ai-input").fill(text);
  await page.getByTestId("ai-send").click();
}

async function waitFinal(page: Page, text: string): Promise<void> {
  await expect(page.getByTestId("ai-chat-log")).toContainText(text, { timeout: 60_000 });
}

test.describe("컴포저 모드가 실제로 세션을 바꾼다", () => {
  test.describe.configure({ timeout: 180_000 });

  test("질문 모드: 쓰기 툴 미노출 + fill_region 호출도 맵을 못 바꾼다", async ({ page }) => {
    const target = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    const log = await installScriptedLlm(page, () => target);
    target.mapId = await bootEditor(page);
    const center = { x: 5, y: 5 };
    const before = await readCell(page, target.mapId, center.x, center.y);
    expect(before).not.toBeNull();

    await sendViaComposer(page, "ask", "이 맵은 어떻게 구성돼 있어?");
    await expect.poll(() => log.callsWithTools, { timeout: 60_000, intervals: [250] }).toBeGreaterThan(0);
    await waitFinal(page, "광장 하나로");

    expect(log.writeToolNamesSeen, "질문 모드 요청 tools 에 쓰기 스키마가 실렸다").toEqual([]);
    expect(await readCell(page, target.mapId, center.x, center.y)).toBe(before);
    await expect(page.locator("[data-testid='ai-change-card']")).toHaveCount(0);
    await page.screenshot({ path: path.join(EVIDENCE, "ask-mode-no-change.png"), animations: "disabled" });
    writeFileSync(path.join(EVIDENCE, "ask-mode.json"), JSON.stringify({ before, after: await readCell(page, target.mapId, center.x, center.y), log }, null, 2));
  });

  test("계획 모드: 계획 체크리스트만 뜨고 툴 루프는 돌지 않는다", async ({ page }) => {
    const target = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    const log = await installScriptedLlm(page, () => target);
    target.mapId = await bootEditor(page);
    const center = { x: 5, y: 5 };
    const before = await readCell(page, target.mapId, center.x, center.y);

    await sendViaComposer(page, "plan", "광장에 연못을 두 단계로 만들어줘");
    await expect(page.getByTestId("ai-work-plan-checklist")).toBeVisible({ timeout: 60_000 });
    await waitFinal(page, "계속");

    // 툴 없는 호출은 의도 선언자 + 플래너 두 번이다. 핵심은 tools 가 실린 호출(툴 루프)이 0회라는 것.
    expect(log.callsWithoutTools).toBeGreaterThanOrEqual(1);
    expect(log.callsWithTools, "계획 모드에서 툴 루프가 돌았다").toBe(0);
    await expect(page.getByTestId("ai-autonomous-budget")).toHaveCount(0);
    expect(await readCell(page, target.mapId, center.x, center.y)).toBe(before);
    await expect(page.getByTestId("ai-chat-log")).toContainText("계속");
    await page.screenshot({ path: path.join(EVIDENCE, "plan-mode-card-only.png"), animations: "disabled" });
    writeFileSync(path.join(EVIDENCE, "plan-mode.json"), JSON.stringify({ before, log }, null, 2));
  });
  test("지시 모드: 할 일 목록이 뜨고 툴 성공마다 체크가 붙으며 턴이 끝나도 남는다", async ({ page }) => {
    const target = { mapId: "", rect: { x: 2, y: 2, w: 6, h: 6 } };
    // 두 항목 모두 set_map_properties 로 끝난다 — 라운드 1 → 항목 1 완료, 라운드 2 → 항목 2 완료, 그 뒤 마무리 문장.
    // (fill_region 은 밑그림 없는 빈 맵에서 스펙 게이트에 막혀 항목이 영원히 in_progress 로 남는다 — 실측.)
    const log = await installScriptedLlm(page, () => target, { writeRounds: 2, writeTool: "set_map_properties" });
    target.mapId = await bootEditor(page);

    await page.getByTestId("ai-input").fill("광장에 연못을 두 단계로 만들어줘");
    await page.getByTestId("ai-send").click();

    const checklist = page.getByTestId("ai-work-plan-checklist");
    await expect(checklist).toBeVisible({ timeout: 60_000 });
    // 항목은 서랍 밖에 바로 보인다.
    const items = page.getByTestId("ai-autonomous-item");
    await expect(items).toHaveCount(2, { timeout: 60_000 });
    // 첫 툴이 성공하면 첫 항목에 체크가 붙는다(라이브).
    await expect(items.nth(0)).toHaveAttribute("data-status", "done", { timeout: 60_000 });
    await page.screenshot({ path: path.join(EVIDENCE, "do-mode-live-check.png"), animations: "disabled" });

    await waitFinal(page, "광장 하나로");
    // 턴이 끝나도 목록은 남고, 둘 다 체크된 채 「모두 완료」다. 활동(중지)만 꺼진다.
    await expect(checklist).toHaveAttribute("data-active", "false", { timeout: 60_000 });
    await expect(items.nth(1)).toHaveAttribute("data-status", "done");
    await expect(checklist).toHaveAttribute("data-complete", "true");
    await expect(page.getByTestId("ai-run-status")).toHaveText("모두 완료");
    await expect(page.getByTestId("ai-run-stop")).toHaveCount(0);
    expect(log.toolRounds).toBe(2);
    await page.screenshot({ path: path.join(EVIDENCE, "do-mode-settled-list.png"), animations: "disabled" });
    writeFileSync(path.join(EVIDENCE, "do-mode.json"), JSON.stringify({ log }, null, 2));
  });
});
