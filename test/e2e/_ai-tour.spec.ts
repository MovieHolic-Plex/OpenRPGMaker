// AI 기능 투어 — 실제로 써 보면서 스크린샷을 남긴다(리포트 소재).
// `_` 접두사라 기본 e2e 실행에서 제외된다(진단용).
//
// 실행: DEV_SERVER_PORT=9999 npx playwright test test/e2e/_ai-tour.spec.ts --project=chromium
import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = "evidence/ai-tour";
mkdirSync(OUT, { recursive: true });

// 번호는 호출부에서 고정한다. 자동 증가 카운터를 쓰면 테스트 하나가 실패해 워커가 재시작될 때
// 카운터가 0 으로 돌아가 앞서 찍은 파일을 덮어쓴다(실제로 당했다).
async function shot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`SHOT ${name}`);
}

declare global {
  interface Window {
    __oprnRegionTaskHarness?: {
      currentMapId: () => string;
      openModal: (mapId: string, region: { x: number; y: number; width: number; height: number }) => void;
    };
  }
}

async function boot(page: Page, mode: "basic" | "expert" = "basic"): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on("response", (res) => {
    if (res.url().includes("chat/completions")) console.log(`RES ${res.status()}`);
  });
  // 페이로드 실측용 — DUMP_REQUEST 를 주면 첫 요청 본문을 그대로 파일로 남긴다.
  let dumped = false;
  page.on("request", (req) => {
    if (!req.url().includes("chat/completions")) return;
    const raw = req.postData() ?? "";
    try {
      const body = JSON.parse(raw);
      console.log(`REQ model=${body.model} tools=${Array.isArray(body.tools) ? body.tools.length : 0} bytes=${raw.length}`);
    } catch { /* 본문 없음 */ }
    if (raw && !dumped && process.env.DUMP_REQUEST) {
      dumped = true;
      writeFileSync(process.env.DUMP_REQUEST, raw, "utf8");
    }
  });
  // 전문가 모드는 코치마크도 뜨지 않고 도구/하네스 진입점이 모두 노출된다.
  await page.addInitScript((m) => localStorage.setItem("oprn:editor-ui-mode", m), mode);
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
  // 온보딩 코치마크가 화면을 가리면 스크린샷이 지저분해진다 — 있으면 닫는다.
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  await expect(page.getByTestId("ai-input")).toBeVisible({ timeout: 20_000 });
}

/** AI 턴이 끝날 때까지 — 중단 버튼이 사라지면 완료. */
async function waitForTurn(page: Page, timeout = 180_000): Promise<void> {
  const abort = page.getByTestId("ai-abort");
  await abort.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  await abort.waitFor({ state: "detached", timeout }).catch(() => undefined);
  await page.waitForTimeout(1200);
}

/** 턴이 끝나면 패널이 접히는 경우가 있어 스크린샷 전에 항상 펼쳐 둔다. */
/**
 * 스크린샷 대상 패널. 예전에는 접힘 복귀 알약을 눌러 펼쳤다 — 띠는 상주하므로 펼칠 것이
 * 없다(스펙 §2). 그대로 돌려주고, 이름은 호출부가 많아 유지한다.
 */
function ensurePanel(page: Page): Locator {
  return page.getByTestId("ai-panel");
}

// 페이로드 실측 전용 — 첫 요청 본문만 받고 끝낸다(응답을 기다리지 않아 빠르다).
test("⓿ 요청 페이로드 덤프", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.getByTestId("ai-input").fill("맵 전체 크기가 몇 칸인지 알려줘. 도구로 확인하고 한 문장으로 답해.");
  await page.getByTestId("ai-send").click();
  for (let i = 0; i < 40; i += 1) {
    if (process.env.DUMP_REQUEST && existsSync(process.env.DUMP_REQUEST)) break;
    await page.waitForTimeout(500);
  }
  const abort = page.getByTestId("ai-abort");
  if (await abort.isVisible().catch(() => false)) await abort.click().catch(() => undefined);
});

test("① 첫 화면과 진입점", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await shot(page, "01-editor-boot");

  const panel = page.getByTestId("ai-panel");
  await shot(panel, "02-ai-panel-start");

  const examples = page.getByTestId("ai-start-examples");
  if (await examples.isVisible().catch(() => false)) await shot(examples, "03-start-examples");

  const gallery = page.getByTestId("ai-start-visual-gallery");
  if (await gallery.isVisible().catch(() => false)) await shot(gallery, "04-start-visual-gallery");

  const status = page.getByTestId("ai-connection-status");
  if (await status.isVisible().catch(() => false)) await shot(status, "05-connection-status");
});

test("② 도구 목록", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  // 원래 앞에 "슬래시 스킬" 절이 있었다 — 스킬 기능이 제품에서 빠지면서
  // `ai-slash-list` / `ai-slash-view-all` / `ai-skill-drawer` 가 모두 사라졌다.
  // 툴 브라우저 진입점도 `ai-tools-browser` 상시 버튼에서 ☰ 메뉴 항목으로 내려왔다.
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.waitForTimeout(300);
  const toolsItem = page.getByTestId("ai-command-menu-tools");
  if (await toolsItem.isVisible().catch(() => false)) {
    await toolsItem.click();
    const modal = page.getByTestId("tool-browser-modal");
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await shot(modal, "08-tool-browser-basic");
    const showAll = page.getByTestId("tool-browser-show-all");
    if (await showAll.isVisible().catch(() => false)) {
      await showAll.click();
      await page.waitForTimeout(400);
      await shot(modal, "09-tool-browser-basic-all");
    }
    await page.getByTestId("tool-browser-close").click();
  } else {
    log("ABSENT ai-command-menu-tools");
  }
});

test("③ 연결 설정", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await page.getByTestId("topbar-ai-settings").click();
  const modal = page.getByTestId("ai-settings-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await shot(modal, "10-settings-modal");

  const body = page.getByTestId("ai-settings-body");
  if (await body.isVisible().catch(() => false)) await shot(body, "11-settings-body");
  await page.getByTestId("ai-settings-close").click();
});

test("④ 실제 대화 한 턴 — 도구로 프로젝트를 읽는다", async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);

  await page.getByTestId("ai-input").fill("지금 이 프로젝트에 맵이 몇 개고 이름이 뭔지 도구로 확인해서 알려줘.");
  await shot(page.getByTestId("ai-panel"), "12-chat-typed");
  await page.getByTestId("ai-send").click();
  await page.waitForTimeout(2500);
  await shot(page.getByTestId("ai-panel"), "13-chat-thinking");

  await waitForTurn(page);
  await shot(ensurePanel(page), "14-chat-answer");

  const toolToggle = page.getByTestId("ai-tool-activity-toggle").first();
  if (await toolToggle.isVisible().catch(() => false)) {
    await toolToggle.click();
    await page.waitForTimeout(600);
    await shot(ensurePanel(page), "15-chat-tool-activity");
  }
  const quick = page.getByTestId("ai-quick-replies");
  if (await quick.isVisible().catch(() => false)) await shot(quick, "16-chat-quick-replies");

  const log = (await page.getByTestId("ai-chat-log").innerText().catch(() => "")) ?? "";
  console.log("CHATLOG >>> " + log.slice(0, 1500));
  expect(log.length).toBeGreaterThan(80);
});

test("⑤ 실제 영역 작업 — 지정한 사각형만 고쳐 준다", async ({ page }) => {
  // 실제 LLM 왕복이라 느리다. 한 번은 240초 안에 못 끝내 실패했다 — 넉넉히 준다.
  test.setTimeout(480_000);
  await boot(page);

  await page.evaluate(() => {
    const harness = window.__oprnRegionTaskHarness!;
    harness.openModal(harness.currentMapId(), { x: 4, y: 4, width: 10, height: 8 });
  });
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await shot(modal, "17-region-modal-open");

  // 지시가 두루뭉술하면 모델이 "바꿀 것 없음"으로 끝내는 일이 잦다 — 크기와 모양을 못박는다.
  await page.getByTestId("region-task-input").fill("이 영역 한가운데를 지름 6칸짜리 둥근 물웅덩이로 채워줘. 물 타일로 원형으로 채우면 된다.");
  await shot(modal, "18-region-typed");
  // AI 가 그 영역에서 아무것도 안 바꾸고 끝내는 경우가 실제로 있다("이 영역에서 바뀐 것이
  // 없습니다"). 실패가 아니라 모델 편차라 몇 번 다시 시켜 본다.
  let reachedReview = false;
  for (let attempt = 1; attempt <= 3 && !reachedReview; attempt += 1) {
    await page.getByTestId("region-task-run").click();
    if (attempt === 1) {
      await page.waitForTimeout(3000);
      await shot(modal, "19-region-running");
    }
    for (let i = 0; i < 120; i += 1) {
      const stage = await modal.getAttribute("data-stage");
      if (stage === "review") { reachedReview = true; break; }
      await page.waitForTimeout(1000);
    }
    if (!reachedReview) {
      const summary = await page.getByTestId("region-task-summary").innerText().catch(() => "");
      console.log(`RETRY ${attempt}: ${summary}`);
    }
  }
  expect(reachedReview, "3번 시도했지만 제안이 만들어지지 않았다").toBe(true);
  await shot(modal, "20-region-review");

  await page.getByTestId("region-task-advanced-toggle").click();
  await page.waitForTimeout(400);
  await shot(modal, "21-region-advanced");

  await page.getByTestId("region-task-apply").click();
  await page.waitForTimeout(1500);
  await shot(page, "22-region-applied-canvas");
});

test("⑥ 선택 영역 칩 · 되돌리기 · 내보내기 · 하네스", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);

  const more = page.getByTestId("ai-more-menu-toggle");
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await page.waitForTimeout(400);
    await shot(page.getByTestId("ai-panel"), "23-more-menu");
    await page.keyboard.press("Escape");
  }

  const harnessBtn = page.getByTestId("ai-harness");
  if (await harnessBtn.isVisible().catch(() => false)) {
    await harnessBtn.click();
    const modal = page.getByTestId("ai-harness-modal");
    if (await modal.isVisible().catch(() => false)) {
      await shot(modal, "harness-modal");
      await page.getByTestId("ai-harness-close").click();
    }
  }

  const newSession = page.getByTestId("ai-new-session");
  if (await newSession.isVisible().catch(() => false)) {
    await newSession.click();
    await page.waitForTimeout(600);
    await shot(page.getByTestId("ai-panel"), "24-new-session");
  }

  const history = page.getByTestId("ai-start-history");
  if (await history.isVisible().catch(() => false)) await shot(history, "25-history");
});

test("⑦ 전문가 모드 — 도구 목록과 하네스", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, "expert");
  await shot(page, "26-expert-editor");
  await shot(ensurePanel(page), "27-expert-ai-panel");

  // 도구 목록·하네스는 툴바의 「더보기」 메뉴 안에 있다.
  const openMore = async (): Promise<void> => {
    const toggle = page.getByTestId("ai-more-menu-toggle");
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(400);
    }
  };

  await openMore();
  const toolsBtn = page.getByTestId("ai-more-tools");
  if (await toolsBtn.isVisible().catch(() => false)) {
    await toolsBtn.click();
    const modal = page.getByTestId("tool-browser-modal");
    if (await modal.isVisible({ timeout: 8000 }).catch(() => false)) {
      await shot(modal, "28-tool-browser");
      const showAll = page.getByTestId("tool-browser-show-all");
      if (await showAll.isVisible().catch(() => false)) {
        await showAll.click();
        await page.waitForTimeout(500);
        await shot(modal, "29-tool-browser-all");
      }
      const search = page.getByTestId("tool-browser-search");
      if (await search.isVisible().catch(() => false)) {
        await search.fill("맵");
        await page.waitForTimeout(600);
        await shot(modal, "30-tool-browser-search");
      }
      await page.getByTestId("tool-browser-close").click();
    }
  }

  await openMore();
  const historyBtn = page.getByTestId("ai-more-history");
  if (await historyBtn.isVisible().catch(() => false)) {
    await historyBtn.click();
    await page.waitForTimeout(900);
    await shot(page, "31-full-history");
    await page.keyboard.press("Escape");
  }

  // 더보기 메뉴 자체 — AI 작업 결과를 되돌리고 내보내는 곳.
  await openMore();
  const menu = page.getByTestId("ai-more-menu");
  if (await menu.isVisible().catch(() => false)) await shot(menu, "32-command-menu");
});

test("⑧ 캔버스에서 영역을 끌면 그 자리에 AI 팝오버", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, "expert");

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스 없음");

  // 우클릭 드래그 = 영역 선택 → 놓으면 포인터 근처에 영역 작업 팝오버.
  await page.mouse.move(box.x + 220, box.y + 200);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 420, box.y + 340, { steps: 12 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(900);

  const popover = page.getByTestId("region-task-popover");
  if (await popover.isVisible().catch(() => false)) {
    await shot(page, "33-region-popover-in-place");
    await shot(popover, "34-region-popover");
    await page.getByTestId("region-task-close").click();
  } else {
    await shot(page, "35-canvas-selection");
  }

  // 선택 영역이 AI 패널의 문맥 칩으로 올라온다.
  const chip = page.getByTestId("ai-selection-chip");
  if (await chip.isVisible().catch(() => false)) await shot(ensurePanel(page), "36-selection-chip");
});

test("⑨ 이벤트 편집기의 AI 도우미", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, "expert");

  // NPC 를 더블클릭하면 이벤트 편집기가 열린다 — 그 안에 AI 도우미가 있다.
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스 없음");
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1200);

  const assist = page.getByTestId("ai-event-assist");
  if (await assist.isVisible().catch(() => false)) {
    await shot(page, "37-event-editor");
    await shot(assist, "38-event-ai-assist");
  } else {
    await shot(page, "39-event-editor-not-opened");
  }
});
