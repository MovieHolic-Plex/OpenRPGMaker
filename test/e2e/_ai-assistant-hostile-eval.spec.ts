// AI 어시스턴트 적대적 UI/UX·프론트엔드·비주얼 QA — 실브라우저 증거 수집.
// `_` 접두사라 기본 e2e 실행에서 제외된다(진단용).
//
// 실행: DEV_SERVER_PORT=9433 npx playwright test test/e2e/_ai-assistant-hostile-eval.spec.ts --project=chromium
import { expect, test, type Locator, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { AI_ACTIVITY_DISK_ENDPOINT } from "@/ai/activityLogEndpoint";

const OUT = "verify-shots/ai-assistant-hostile";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/_probe-log.txt`;

function log(line: string): void {
  console.log(line);
  appendFileSync(LOG, line + "\n", "utf8");
}

async function shot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: `${OUT}/${name}.png` }).catch((e) => log(`SHOT-FAIL ${name}: ${e}`));
  log(`SHOT ${name}`);
}

/** 콘솔 에러/페이지 예외를 파일로 남긴다(프론트엔드 QA 증거). */
function collectErrors(page: Page, tag: string): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`CONSOLE-ERROR [${tag}] ${msg.text().slice(0, 400)}`);
  });
  page.on("pageerror", (err) => log(`PAGE-ERROR [${tag}] ${String(err).slice(0, 400)}`));
  page.on("requestfailed", (req) => log(`REQ-FAILED [${tag}] ${req.failure()?.errorText} ${req.url().slice(0, 160)}`));
}

async function boot(
  page: Page,
  mode: "basic" | "expert" = "basic",
  vp = { width: 1600, height: 1000 },
  path = "/?freshProject=1",
): Promise<void> {
  await page.setViewportSize(vp);
  await page.addInitScript((m) => localStorage.setItem("oprn:editor-ui-mode", m), mode);
  await page.goto(path);
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-input")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function ensurePanel(page: Page): Promise<Locator> {
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) {
    await restore.click();
    await page.waitForTimeout(500);
  }
  return page.getByTestId("ai-panel");
}

/** 패널 안 인터랙티브 요소의 히트타겟·잘림·명암비를 실측한다. */
async function probePanel(page: Page, tag: string): Promise<void> {
  const report = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ai-panel"]');
    if (!panel) return { error: "no panel" };
    const lines: string[] = [];
    // 1) 히트타겟: 보이는 버튼/입력 중 한 변이 24px 미만
    const interactive = panel.querySelectorAll("button, [role=button], input, select, textarea, a");
    const small: string[] = [];
    for (const el of interactive) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 24 || r.height < 24) {
        const label = (el.getAttribute("data-testid") || el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 16) || el.tagName).trim();
        small.push(`${label}=${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    if (small.length) lines.push(`SMALL-HIT-TARGETS(<24px): ${small.join(", ")}`);
    // 2) 텍스트 잘림: scrollWidth가 clientWidth보다 큰데 overflow가 hidden/ellipsis
    const clipped: string[] = [];
    for (const el of panel.querySelectorAll("*")) {
      const h = el as HTMLElement;
      if (!h.textContent?.trim()) continue;
      if (h.children.length > 0) continue;
      const cs = getComputedStyle(h);
      if (h.scrollWidth > h.clientWidth + 2 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis") {
        clipped.push(`${(h.getAttribute("data-testid") || h.className || h.tagName).toString().slice(0, 40)}(${h.textContent.trim().slice(0, 20)})`);
      }
      if (clipped.length >= 8) break;
    }
    if (clipped.length) lines.push(`CLIPPED-NO-ELLIPSIS: ${clipped.join(" | ")}`);
    // 3) 명암비: 텍스트 잎 노드의 색 대비(간이 — 배경은 조상에서 첫 불투명색)
    function lum(c: number[]): number {
      const s = c.map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    }
    function parse(c: string): number[] | null {
      const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a < 0.9) return null; // 반투명은 합성 필요 — 간이 측정에선 건너뜀
      return [+m[1], +m[2], +m[3]];
    }
    const lowContrast: string[] = [];
    const seen = new Set<string>();
    for (const el of panel.querySelectorAll("*")) {
      const h = el as HTMLElement;
      if (h.children.length > 0 || !h.textContent?.trim()) continue;
      const r = h.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const fg = parse(getComputedStyle(h).color);
      if (!fg) continue;
      let bg: number[] | null = null;
      let p: HTMLElement | null = h;
      while (p && p !== document.body) {
        const b = getComputedStyle(p).backgroundColor;
        const pb = parse(b);
        if (pb) { bg = pb; break; }
        p = p.parentElement;
      }
      if (!bg) continue;
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const fs = parseFloat(getComputedStyle(h).fontSize);
      const need = fs >= 18.66 ? 3 : 4.5;
      if (ratio < need) {
        const key = `${getComputedStyle(h).color}|${getComputedStyle(h).fontSize}|${(h.textContent || "").trim().slice(0, 12)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lowContrast.push(`${(h.getAttribute("data-testid") || h.className || h.tagName).toString().slice(0, 36)}("${h.textContent.trim().slice(0, 14)}") ${ratio.toFixed(2)}:1@${fs}px`);
      }
      if (lowContrast.length >= 12) break;
    }
    if (lowContrast.length) lines.push(`LOW-CONTRAST(<4.5:1 or 3:1): ${lowContrast.join(" | ")}`);
    // 4) 패널 지오메트리
    const pr = (panel as HTMLElement).getBoundingClientRect();
    lines.push(`PANEL-RECT: x=${Math.round(pr.x)} y=${Math.round(pr.y)} w=${Math.round(pr.width)} h=${Math.round(pr.height)} vw=${innerWidth} vh=${innerHeight}`);
    return { lines };
  });
  if ("error" in report && report.error) log(`PROBE [${tag}] ${report.error}`);
  for (const l of ("lines" in report ? report.lines : []) ?? []) log(`PROBE [${tag}] ${l}`);
}

test("A 초보 부팅 — 첫 화면·시작 표면", async ({ page }) => {
  test.setTimeout(180_000);
  collectErrors(page, "A");
  await boot(page);
  await shot(page, "A01-boot-full");
  const panel = page.getByTestId("ai-panel");
  await shot(panel, "A02-panel-start");
  for (const [tid, name] of [
    ["ai-start-examples", "A03-start-examples"],
    ["ai-start-visual-gallery", "A04-visual-gallery"],
    ["ai-connection-status", "A05-connection-status"],
    ["ai-start-recent-work", "A06-recent-work"],
    ["ai-start-history", "A07-history"],
  ] as const) {
    const el = page.getByTestId(tid);
    if (await el.isVisible().catch(() => false)) await shot(el, name);
    else log(`ABSENT ${tid}`);
  }
  await probePanel(page, "A-start");
});

test("B 입력 UX — 슬래시·서랍·긴 입력·오버플로", async ({ page }) => {
  test.setTimeout(180_000);
  collectErrors(page, "B");
  await boot(page);
  const input = page.getByTestId("ai-input");

  await input.fill("/");
  await page.waitForTimeout(700);
  await shot(page.getByTestId("ai-panel"), "B01-slash-list");
  const viewAll = page.getByTestId("ai-slash-view-all");
  if (await viewAll.isVisible().catch(() => false)) {
    // 실사용 클릭이 오버레이에 먹히는지 실측(5초) → 먹히면 force로 계속 진행
    const dead = await viewAll.click({ timeout: 5_000 }).then(() => false).catch(() => true);
    log(`SLASH-VIEW-ALL-CLICK-DEAD: ${dead}`);
    if (dead) await viewAll.click({ force: true });
    const drawer = page.getByTestId("ai-skill-drawer");
    if (await drawer.isVisible().catch(() => false)) {
      await shot(page, "B02-skill-drawer-full");
      await shot(drawer, "B03-skill-drawer");
      await page.keyboard.press("Escape");
    }
  }

  // 긴 여러 줄 입력 — textarea 성장/스크롤
  await input.fill("");
  await input.fill(Array.from({ length: 30 }, (_, i) => `${i + 1}번째 줄 — 마을 동쪽 숲에 보물상자 이벤트를 만들어 줘`).join("\n"));
  await page.waitForTimeout(400);
  await shot(page.getByTestId("ai-panel"), "B04-input-30lines");
  // 공백 없는 초장문 한 단어 — 가로 오버플로
  await input.fill("가".repeat(600));
  await page.waitForTimeout(300);
  await shot(page.getByTestId("ai-panel"), "B05-input-600chars-nospace");
  const inputBox = await input.boundingBox();
  log(`INPUT-BOX after 600 chars: ${JSON.stringify(inputBox)}`);
  await input.fill("");
  await probePanel(page, "B-input");
});

test("C 모달·툴바 — 설정/도구/더보기/도킹/글꼴", async ({ page }) => {
  test.setTimeout(240_000);
  collectErrors(page, "C");
  await boot(page);

  // 설정 진입점: 맵 집중 헤더의 AI 설정, 없으면 패널 ☰ 메뉴 항목.
  let settings = page.getByTestId("topbar-ai-settings");
  if (!(await settings.isVisible().catch(() => false))) {
    settings = page.getByTestId("ai-settings-toggle");
    if (!(await settings.isVisible().catch(() => false))) {
      const railMenu = page.getByTestId("ai-command-menu-toggle");
      if (await railMenu.isVisible().catch(() => false)) {
        await railMenu.click();
        await page.waitForTimeout(250);
      }
      settings = page.getByTestId("ai-settings-command-bar");
    }
  }
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
    const modal = page.getByTestId("ai-settings-modal");
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await shot(page, "C01-settings-full");
    await shot(modal, "C02-settings-modal");
    const adv = page.getByTestId("ai-settings-advanced");
    if (await adv.isVisible().catch(() => false)) {
      if ((await adv.getAttribute("open")) === null) await adv.click();
      await page.waitForTimeout(400);
      await shot(modal, "C03-settings-advanced");
    }
    await page.getByTestId("ai-settings-close").click();
  } else log("ABSENT topbar-ai-settings");

  const tools = page.getByTestId("ai-tools-browser");
  if (await tools.isVisible().catch(() => false)) {
    await tools.click();
    const modal = page.getByTestId("tool-browser-modal");
    if (await modal.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await shot(modal, "C04-tool-browser");
      const showAll = page.getByTestId("tool-browser-show-all");
      if (await showAll.isVisible().catch(() => false)) {
        await showAll.click();
        await page.waitForTimeout(400);
        await shot(modal, "C05-tool-browser-all");
      }
      await page.getByTestId("tool-browser-close").click();
    }
  } else log("ABSENT ai-tools-browser(초보)");

  let more = page.getByTestId("ai-more-menu-toggle");
  if (!(await more.isVisible().catch(() => false))) more = page.getByTestId("ai-command-menu-toggle");
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await page.waitForTimeout(400);
    await shot(page, "C06-more-menu");
    const cmdMenu = page.getByTestId("ai-command-menu");
    if (await cmdMenu.isVisible().catch(() => false)) await shot(cmdMenu, "C06b-command-menu");
    await page.keyboard.press("Escape");
  } else log("ABSENT ai-more-menu-toggle/ai-command-menu-toggle(초보)");

  const dock = page.getByTestId("ai-dock-toggle");
  if (await dock.isVisible().catch(() => false)) {
    await dock.click();
    await page.waitForTimeout(600);
    await shot(page, "C07-dock-toggled");
    await dock.click();
    await page.waitForTimeout(600);
  } else log("ABSENT ai-dock-toggle");

  const font = page.getByTestId("ai-font-cycle");
  if (await font.isVisible().catch(() => false)) {
    await font.click();
    await page.waitForTimeout(300);
    await shot(page.getByTestId("ai-panel"), "C08-font-cycled-1");
    await font.click();
    await page.waitForTimeout(300);
    await shot(page.getByTestId("ai-panel"), "C09-font-cycled-2");
  } else log("ABSENT ai-font-cycle");
});

test("D 실제 대화 한 턴 — 상태 전이·말풍선·후속 UI", async ({ page }) => {
  test.setTimeout(300_000);
  collectErrors(page, "D");
  await boot(page);
  const input = page.getByTestId("ai-input");
  await input.fill("지금 이 프로젝트에 맵이 몇 개고 이름이 뭔지 도구로 확인해서 알려줘.");
  await shot(page.getByTestId("ai-panel"), "D01-typed");
  const send = page.getByTestId("ai-send");
  // 마우스로 보내기 클릭이 되는가(5초 실측). 안 되면 Enter로 폴백.
  const sendDead = await send.click({ timeout: 5_000 }).then(() => false).catch(() => true);
  log(`SEND-CLICK-DEAD: ${sendDead}`);
  if (sendDead) await input.press("Enter");
  await page.waitForTimeout(300);
  // 전송 직후 재전송 가드 — send가 비활성인지
  log(`SEND-DISABLED-AFTER-CLICK: ${await send.isDisabled().catch(() => "?")} | INPUT-VALUE: "${await input.inputValue().catch(() => "?")}"`);
  await page.waitForTimeout(2000);
  await shot(page.getByTestId("ai-panel"), "D02-thinking");
  const abort = page.getByTestId("ai-abort");
  await abort.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  await abort.waitFor({ state: "detached", timeout: 240_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  // 턴 종료 후 패널이 저절로 접혔는가?
  const collapsed = await page.getByTestId("ai-collapsed-restore").isVisible().catch(() => false);
  log(`PANEL-AUTO-COLLAPSED-AFTER-TURN: ${collapsed}`);
  await shot(await ensurePanel(page), "D03-answer");
  await shot(page, "D04-answer-full");
  const toolToggle = page.getByTestId("ai-tool-activity-toggle").first();
  if (await toolToggle.isVisible().catch(() => false)) {
    await toolToggle.click();
    await page.waitForTimeout(500);
    await shot(await ensurePanel(page), "D05-tool-activity");
  }
  const quick = page.getByTestId("ai-quick-replies");
  if (await quick.isVisible().catch(() => false)) await shot(quick, "D06-quick-replies");
  await probePanel(page, "D-answer");
  await expect.poll(async () => page.evaluate(async ({ endpoint, instruction }) => {
    const response = await fetch(endpoint);
    if (!response.ok) return false;
    const latest = await response.json() as { instruction?: string };
    return latest.instruction === instruction;
  }, { endpoint: AI_ACTIVITY_DISK_ENDPOINT, instruction: "지금 이 프로젝트에 맵이 몇 개고 이름이 뭔지 도구로 확인해서 알려줘." }), { timeout: 15_000 }).toBe(true);
  log("DISK-MIRROR: persisted");
  const logText = (await page.getByTestId("ai-chat-log").innerText().catch(() => "")) ?? "";
  log("CHATLOG >>> " + logText.replace(/\n/g, " / ").slice(0, 1200));
});

test("E 리사이즈·접기 — 극단값", async ({ page }) => {
  test.setTimeout(180_000);
  collectErrors(page, "E");
  await boot(page);
  const handle = page.getByTestId("ai-resize-handle");
  if (await handle.isVisible().catch(() => false)) {
    const hb = await handle.boundingBox();
    if (hb) {
      // 최대로 넓히기(왼쪽 끝까지 드래그)
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(10, hb.y + hb.height / 2, { steps: 15 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      await shot(page, "E01-resize-max");
      await probePanel(page, "E-max");
      // 최소로 좁히기(오른쪽 끝까지)
      const hb2 = await handle.boundingBox();
      if (hb2) {
        await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
        await page.mouse.down();
        await page.mouse.move(1590, hb2.y + hb2.height / 2, { steps: 15 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        await shot(page, "E02-resize-min");
        await probePanel(page, "E-min");
      }
    }
  } else log("ABSENT ai-resize-handle");

  const collapse = page.getByTestId("ai-collapse");
  if (await collapse.isVisible().catch(() => false)) {
    await collapse.click();
    await page.waitForTimeout(600);
    await shot(page, "E03-collapsed");
    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) {
      await shot(restore, "E04-collapsed-restore-chip");
      await restore.click();
      await page.waitForTimeout(500);
      await shot(page, "E05-restored");
    } else log("COLLAPSED BUT NO RESTORE CHIP VISIBLE");
  } else log("ABSENT ai-collapse");
});

test("F 뷰포트 — 1280·1024·1920", async ({ page }) => {
  test.setTimeout(240_000);
  collectErrors(page, "F");
  await boot(page, "basic", { width: 1280, height: 800 });
  await shot(page, "F01-1280x800");
  await probePanel(page, "F-1280");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(800);
  await shot(page, "F02-1024x768");
  await probePanel(page, "F-1024");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(800);
  await shot(page, "F03-1920x1080");
  await probePanel(page, "F-1920");
});

test("G 전문가 모드 — 선택 칩·영역 팝오버·히스토리", async ({ page }) => {
  test.setTimeout(240_000);
  collectErrors(page, "G");
  await boot(page, "expert");
  await shot(page, "G01-expert-boot");
  await shot(await ensurePanel(page), "G02-expert-panel");
  await probePanel(page, "G-expert");

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 220, box.y + 200);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(box.x + 420, box.y + 340, { steps: 12 });
    await page.mouse.up({ button: "right" });
    await page.waitForTimeout(900);
    const popover = page.getByTestId("region-task-popover");
    if (await popover.isVisible().catch(() => false)) {
      await shot(page, "G03-region-popover-in-place");
      await shot(popover, "G04-region-popover");
      await page.getByTestId("region-task-close").click().catch(() => undefined);
    } else await shot(page, "G05-canvas-selection-no-popover");
    const chip = page.getByTestId("ai-selection-chip");
    if (await chip.isVisible().catch(() => false)) {
      await shot(await ensurePanel(page), "G06-selection-chip");
    } else log("ABSENT ai-selection-chip after right-drag");
  }

  const more = page.getByTestId("ai-more-menu-toggle");
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await page.waitForTimeout(400);
    const menu = page.getByTestId("ai-more-menu");
    if (await menu.isVisible().catch(() => false)) await shot(menu, "G07-more-menu");
    const historyBtn = page.getByTestId("ai-more-history");
    if (await historyBtn.isVisible().catch(() => false)) {
      await historyBtn.click();
      await page.waitForTimeout(900);
      await shot(page, "G08-full-history");
      await page.keyboard.press("Escape");
    }
  }
});

test("H 히트테스트 — 오버레이가 삼키는 클릭 지도", async ({ page }) => {
  test.setTimeout(180_000);
  collectErrors(page, "H");
  await boot(page);
  const input = page.getByTestId("ai-input");
  await input.click();
  await input.fill("테스트 문장");
  await page.waitForTimeout(600);
  await shot(page, "H01-input-focused-overlay-up");
  // 보내기 버튼 중심·슬래시 토글·캔버스 여러 점에서 topmost 요소를 실측
  const hits = await page.evaluate(() => {
    const pts: Array<[string, number, number]> = [];
    const send = document.querySelector('[data-testid="ai-send"]');
    if (send) {
      const r = send.getBoundingClientRect();
      pts.push(["send-center", r.x + r.width / 2, r.y + r.height / 2]);
    }
    const canvas = document.querySelector('[data-testid="edit-canvas"]');
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      for (const [fx, fy, name] of [[0.3, 0.85, "canvas-30%-85%"], [0.5, 0.8, "canvas-50%-80%"], [0.9, 0.85, "canvas-90%-85%"], [0.5, 0.4, "canvas-50%-40%"]] as Array<[number, number, string]>) {
        pts.push([name, r.x + r.width * fx, r.y + r.height * fy]);
      }
    }
    return pts.map(([name, x, y]) => {
      const el = document.elementFromPoint(x, y);
      const id = el ? (el.getAttribute("data-testid") || el.className.toString().slice(0, 44) || el.tagName) : "null";
      return `${name}@(${Math.round(x)},${Math.round(y)}) -> ${id}`;
    });
  });
  for (const h of hits) log(`HITTEST(focused) ${h}`);
  // idle 페이드(6초) 후 같은 지점 재실측
  await page.waitForTimeout(7_000);
  await shot(page, "H02-after-idle-fade");
  const hits2 = await page.evaluate(() => {
    const send = document.querySelector('[data-testid="ai-send"]');
    const canvas = document.querySelector('[data-testid="edit-canvas"]');
    const out: string[] = [];
    if (send) {
      const r = send.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      out.push(`send-center -> ${el ? el.getAttribute("data-testid") || el.className.toString().slice(0, 44) : "null"}`);
    }
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width * 0.5, r.y + r.height * 0.8);
      out.push(`canvas-50%-80% -> ${el ? el.getAttribute("data-testid") || el.className.toString().slice(0, 44) : "null"}`);
    }
    return out;
  });
  for (const h of hits2) log(`HITTEST(idle-faded) ${h}`);
  const panelClass = await page.getByTestId("ai-panel").getAttribute("class");
  log(`PANEL-CLASS: ${panelClass}`);
});

test("I 빈 상태 CTA → 실작업 제안 흐름", async ({ page }) => {
  test.setTimeout(420_000);
  collectErrors(page, "I");
  await boot(page);
  await page.getByTestId("ai-input").click();
  await page.waitForTimeout(500);
  const cta = page.getByTestId("ai-empty-cta-village");
  if (!(await cta.isVisible().catch(() => false))) {
    log("ABSENT ai-empty-cta-village");
    return;
  }
  await shot(page, "I01-cta-visible");
  const ctaDead = await cta.click({ timeout: 5_000 }).then(() => false).catch(() => true);
  log(`CTA-CLICK-DEAD: ${ctaDead}`);
  if (ctaDead) await cta.click({ force: true });
  await page.waitForTimeout(2_000);
  await shot(page, "I02-cta-sent");
  const abort = page.getByTestId("ai-abort");
  await abort.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  await shot(page, "I03-running");
  await abort.waitFor({ state: "detached", timeout: 300_000 }).catch(() => undefined);
  await page.waitForTimeout(1_500);
  await shot(page, "I04-after-turn-full");
  // 제안 pill/카드/완료 스트립 — 승인 UX의 핵심 표면
  for (const [tid, name] of [
    ["ai-proposal-pill", "I05-proposal-pill"],
    ["ai-proposal-card", "I06-proposal-card"],
    ["ai-completion-strip", "I07-completion-strip"],
    ["ai-proposal-modal", "I08-proposal-modal"],
  ] as const) {
    const el2 = page.locator(`[data-testid="${tid}"]`).first();
    if (await el2.isVisible().catch(() => false)) await shot(el2, name);
    else log(`ABSENT ${tid} after CTA turn`);
  }
  const pill = page.locator('[data-testid="ai-proposal-pill"]').first();
  if (await pill.isVisible().catch(() => false)) {
    await pill.click().catch(() => undefined);
    await page.waitForTimeout(800);
    await shot(page, "I09-proposal-opened");
  }
  await probePanel(page, "I-proposal");
});
test("J 실제 복합 턴 — 다중 도구 실패 자동복구·디스크 진단", async ({ page }) => {
  test.setTimeout(900_000);
  collectErrors(page, "J");
  await boot(page, "expert", { width: 1600, height: 1000 }, "/?blankProject=1");
  const instruction = "적대적 통합 QA다. 시작 마을에 야외 집 2채와 주민 2명을 만들고, 별도의 실내 방 하나도 모두 만들어라. 불/얼음/번개 속성 상성표와 각 속성 몬스터, 선택지가 있는 컷신, switch ending_flag가 켜졌을 때 진엔딩을 정의해라. 각 단계 결과를 다시 읽어 검증하고 변경은 제안으로 남겨라.";
  const input = page.getByTestId("ai-input");
  const send = page.getByTestId("ai-send");
  await input.fill(instruction);
  await send.click();
  await expect(send).toBeDisabled({ timeout: 10_000 });
  await expect(send).toBeEnabled({ timeout: 720_000 });
  await page.waitForTimeout(2_000);

  await expect.poll(async () => page.evaluate(async ({ endpoint, expected }) => {
    const response = await fetch(endpoint);
    if (!response.ok) return false;
    const latest = await response.json() as { instruction?: string };
    return latest.instruction === expected;
  }, { endpoint: AI_ACTIVITY_DISK_ENDPOINT, expected: instruction }), { timeout: 20_000 }).toBe(true);

  const record = await page.evaluate(async (endpoint) => {
    const response = await fetch(endpoint);
    return response.json() as Promise<{
      result?: { ok?: boolean };
      diagnostics?: { kinds?: string[]; failedTools?: string[] };
      toolCalls?: { name?: string; ok?: boolean }[];
    }>;
  }, AI_ACTIVITY_DISK_ENDPOINT);
  const toolCalls = record.toolCalls ?? [];
  const successfulTools = toolCalls.filter((call) => call.ok !== false).map((call) => call.name);
  const diagnosedFailures = [...new Set(
    toolCalls.filter((call) => call.ok === false).map((call) => call.name).filter((name): name is string => Boolean(name)),
  )];
  expect(record.result?.ok).toBe(true);
  if (diagnosedFailures.length > 0) {
    expect(record.diagnostics?.kinds ?? []).toContain("tool-failure");
    expect(record.diagnostics?.failedTools ?? []).toEqual(expect.arrayContaining(diagnosedFailures));
  } else {
    expect(record.diagnostics?.kinds ?? []).not.toContain("tool-failure");
  }
  const successfulToolSet = new Set(successfulTools);
  expect(["author_village", "author_house", "build_house_kit"].some((name) => successfulToolSet.has(name))).toBe(true);
  expect(["start_interior_room_session", "run_interior_room_pipeline", "create_map"].some((name) => successfulToolSet.has(name))).toBe(true);
  expect(["place_npc", "make_villager"].some((name) => successfulToolSet.has(name))).toBe(true);
  expect(successfulTools).toEqual(expect.arrayContaining([
    "create_transfer_pair",
    "set_type_chart",
    "upsert_enemy",
    "script_cutscene",
    "define_ending",
  ]));
  await shot(page, "J01-complex-turn-final");
  log(`COMPLEX-SUCCESS-TOOLS: ${successfulTools.join(",")} | RECOVERED: ${diagnosedFailures.join(",") || "none"}`);
});
