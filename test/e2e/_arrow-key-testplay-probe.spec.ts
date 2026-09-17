// 진단용: 테스트 플레이 창에서 실제 arrow 키가 이동으로 이어지는지 경계마다 계측한다.
// 1차 프로브에서 "갓 부팅한 상태"는 통과했다(실제 ArrowRight 로 x 16->18).
// 그래서 이번엔 텍스트 입력 포커스 가설을 직접 찍는다: 편집기 텍스트 필드에
// 포커스가 들어간 뒤 arrow 가 죽는가, 그리고 플레이 캔버스를 눌러 복구되는가.
//
// 클릭은 창 드래그/오버레이 때문에 자주 hang 하므로 포커스는 evaluate 로 준다.
// 결과는 각 단계에서 즉시 출력한다(끝에 모아 찍으면 타임아웃에 전부 날아간다).
import { expect, test, type Page } from "@playwright/test";

type Reading = {
  readonly x: number;
  readonly y: number;
  readonly inputEnabled: unknown;
  readonly active: string;
  readonly textEntryFocused: boolean;
};

async function read(page: Page): Promise<Reading> {
  return page.evaluate(() => {
    const raw = document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { /* ignore */ }
    const player = (parsed.player ?? {}) as { x?: number; y?: number };
    const a = document.activeElement as HTMLElement | null;
    const tag = a ? a.tagName : "null";
    const type = a && (a as HTMLInputElement).type ? `[${(a as HTMLInputElement).type}]` : "";
    const cls = a?.className && typeof a.className === "string" ? `.${a.className.split(/\s+/)[0]}` : "";
    const isText = !!a && (
      tag === "TEXTAREA"
      || a.isContentEditable
      || (tag === "INPUT" && !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes((a as HTMLInputElement).type))
    );
    return {
      x: player.x ?? -1,
      y: player.y ?? -1,
      inputEnabled: parsed.inputEnabled,
      active: `${tag}${type}${cls}`,
      textEntryFocused: isText,
    };
  });
}

async function pressAndMeasure(page: Page, key: string): Promise<{ moved: boolean; from: Reading; to: Reading }> {
  const from = await read(page);
  await page.keyboard.down(key);
  await page.waitForTimeout(500);
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
  const to = await read(page);
  return { moved: from.x !== to.x || from.y !== to.y, from, to };
}

async function report(page: Page, label: string): Promise<void> {
  const arrow = await pressAndMeasure(page, "ArrowRight");
  const wasd = await pressAndMeasure(page, "d");
  console.log(
    `[PROBE] ${arrow.moved ? "PASS" : "FAIL"} ${label}`
    + ` | arrow=${arrow.moved ? "move" : "DEAD"} (${arrow.from.x},${arrow.from.y})->(${arrow.to.x},${arrow.to.y})`
    + ` | wasd=${wasd.moved ? "move" : "DEAD"} (${wasd.from.x},${wasd.from.y})->(${wasd.to.x},${wasd.to.y})`
    + ` | active=${arrow.from.active} textEntry=${arrow.from.textEntryFocused} inputEnabled=${String(arrow.from.inputEnabled)}`
  );
}

test("probe: does text-entry focus kill arrow keys in test play", async ({ page }, testInfo) => {
  testInfo.setTimeout(170_000);
  page.on("pageerror", (error) => console.log(`[PROBE] pageerror: ${error.message}`));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/?devProject=1&logCabinShowcase=1&arrowProbe=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  if (await page.getByTestId("title-screen").count()) {
    await expect(page.getByTestId("title-new-game")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("runtime-state-json")).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(1000);

  // 어떤 텍스트 입력들이 실제로 잡히는지 먼저 본다.
  const inventory = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']")) as HTMLElement[];
    return all.slice(0, 40).map((el) => {
      const type = (el as HTMLInputElement).type ?? "";
      const inPlay = !!el.closest(".player-layout");
      const inWindow = !!el.closest("[data-testid='test-play-window']");
      const rect = el.getBoundingClientRect();
      return `${el.tagName}[${type}] .${String(el.className).split(/\s+/)[0]} play=${inPlay} window=${inWindow} vis=${rect.width > 0 && rect.height > 0}`;
    });
  });
  console.log("[PROBE] inputs:\n  " + inventory.join("\n  "));

  await report(page, "0. 갓 부팅 (기준선)");

  // 1. 편집기 어딘가의 텍스트 입력에 포커스를 준다(클릭이 아니라 focus()).
  const focused = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll("input, textarea")) as HTMLInputElement[];
    const target = cands.find((el) => {
      const skip = ["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"];
      if (skip.includes(el.type)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!target) return "none";
    target.focus();
    return `${target.tagName}[${target.type}].${String(target.className).split(/\s+/)[0]}`;
  });
  console.log(`[PROBE] focus() -> ${focused}`);
  await page.waitForTimeout(200);
  await report(page, "1. 텍스트 입력 포커스 중");

  // 2. 플레이 캔버스를 눌러 포커스를 되찾을 수 있나? (포인터 차단기가 mousedown 을 막는다)
  const canvas = page.locator("[data-testid='test-play-window'] canvas").first();
  if (await canvas.count()) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
      await report(page, "2. 플레이 캔버스 클릭으로 복구 시도");
    }
  } else {
    console.log("[PROBE] SKIP 2: canvas 없음");
  }

  // 3. 명시적 blur 로는 복구되나? (복구되면 원인은 포커스가 확정)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.waitForTimeout(300);
  await report(page, "3. 명시적 blur 후");

  await page.screenshot({ path: testInfo.outputPath("arrow-probe-final.png") });
  console.log("[PROBE] SHOT " + testInfo.outputPath("arrow-probe-final.png"));
});
