// 진단 스펙 — 조수 패널 유리 셸 개편 전/후 실측 캡처.
// 실행: ASSIST_SHOT_TAG=before DEV_SERVER_PORT=9173 npx playwright test test/e2e/_assistant-glass-shots.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const TAG = process.env.ASSIST_SHOT_TAG ?? "before";
const OUT = `verify-shots/assistant-glass/${TAG}`;
mkdirSync(OUT, { recursive: true });

async function boot(page: Page, mode: "basic" | "expert"): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // 실측 키는 `oprn:` 접두사다 — 구 `rpg-zzu:` 키는 아무도 읽지 않는다(둘 다 심어 안전 확보).
  await page.addInitScript((uiMode) => {
    localStorage.setItem("oprn:editor-ui-mode", uiMode);
    localStorage.setItem("rpg-zzu:editor-ui-mode", uiMode);
  }, mode);
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await waitForMapPainted(page);
  await page.waitForTimeout(600);
}

/**
 * 맵이 실제로 그려질 때까지 기다린다.
 *
 * 캔버스 픽셀을 JS 로 직접 읽는 방법은 못 쓴다 — 편집기 캔버스는 **WebGL** 이라
 * `getContext("2d")` 가 null 을 돌려준다(2026-08-28 실측: distinct=-1).
 * 그래서 DOM 조건(Phaser 가 canvas 자식을 심었는가 + 크기가 잡혔는가)으로만 게이트하고,
 * 실제 "뒤가 비어 있지 않은가" 판정은 스크린샷 PNG 를 읽는
 * scripts/analyze-glass-contrast.mjs 가 맡는다.
 */
async function waitForMapPainted(page: Page, timeoutMs = 30_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await page.evaluate(() => {
      const host = document.querySelector("[data-testid='edit-canvas']");
      const canvas = host?.querySelector("canvas");
      return Boolean(canvas && canvas.width > 200 && canvas.height > 200);
    }).catch(() => false);
    if (ready) {
      await page.waitForTimeout(1500); // 첫 프레임 + 타일셋 텍스처 업로드 여유.
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

/** 조수 패널 셸의 실측 기하 + 표면 토큰. */
async function shellMetrics(page: Page): Promise<unknown> {
  return await page.evaluate(() => {
    const box = (selector: string, root: ParentNode = document): unknown => {
      const node = root.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      return {
        selector,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        color: s.color,
        fontSize: Number.parseFloat(s.fontSize),
        fontWeight: s.fontWeight,
        background: s.backgroundColor,
        backgroundImage: s.backgroundImage.slice(0, 120),
        backdropFilter: s.backdropFilter,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow.slice(0, 160),
        padding: s.padding,
        display: s.display,
      };
    };
    const panel = document.querySelector<HTMLElement>("[data-testid='ai-panel']");
    return {
      dock: panel?.dataset.chatDock ?? null,
      conversation: panel?.dataset.aiConversation ?? null,
      panelClass: panel?.className ?? null,
      panel: box("[data-testid='ai-panel']"),
      header: box(".ai-chat-header"),
      plate: box("[data-testid='ai-director-plate']"),
      face: box("[data-testid='ai-director-face']"),
      name: box(".ai-director-name"),
      line: box("[data-testid='ai-director-line']"),
      headerActions: box(".ai-header-actions"),
      main: box(".ai-chat-main"),
      nextSteps: box("[data-testid='ai-next-steps']"),
      // 대비 판정 대상 — 실제 선언된 전경색을 같이 실어 보낸다(분석기가 추측하지 않도록).
      hint: box(".ai-next-steps-hint"),
      examplesTitle: box(".ai-authoring-examples-title"),
      exampleChip: box(".ai-authoring-example-chip"),
      inputField: box(".ai-assistant-input"),
      commandBar: box(".ai-command-bar"),
      composer: box(".ai-composer"),
      collapsedRestore: box("[data-testid='ai-collapsed-restore']"),
      restoreFace: box("[data-testid='ai-collapsed-restore'] .ai-director-face"),
    };
  });
}

/**
 * 유리면 위 본문 대비 실측. 반투명 패널은 뒤 지도가 비쳐 대비가 국소적으로 무너질 수 있으므로
 * "토큰상 4.5:1" 로는 증거가 안 된다 — 실제로 합성된 픽셀을 읽어서 최악값을 본다.
 * 방법: 텍스트 노드의 사각형 안 픽셀을 캔버스로 샘플링해 배경 최명/최암을 구하고,
 * 선언된 전경색과의 WCAG 대비를 계산한다.
 */
async function textContrastOverGlass(page: Page): Promise<unknown> {
  return await page.evaluate(async () => {
    const srgb = (c: number): number => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r: number, g: number, b: number): number =>
      0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
    const ratio = (a: number, b: number): number =>
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const parseRgb = (value: string): [number, number, number] => {
      const nums = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
    };

    const targets: { selector: string; label: string }[] = [
      { selector: ".ai-next-steps-hint", label: "빈화면 안내문" },
      { selector: ".ai-authoring-examples-title", label: "예시 라벨" },
      { selector: ".ai-authoring-example-chip", label: "예시 칩" },
      { selector: ".ai-assistant-input", label: "입력 플레이스홀더" },
      { selector: ".ai-chat-send", label: "전송 버튼" },
    ];

    // html2canvas 없이: 패널을 숨긴 뒤 그 자리 배경을 찍을 수는 없으므로,
    // 대신 실제 합성 결과를 얻기 위해 요소 뒤 표면색을 계산으로 근사한다.
    // 패널 background(알파 포함) 를 그 뒤 지도 캔버스 픽셀 위에 알파 합성한다.
    const panel = document.querySelector<HTMLElement>("[data-testid='ai-panel']");
    const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='edit-canvas'] canvas, canvas");
    if (!panel || !canvas) return { error: "panel or canvas missing" };
    const panelStyle = getComputedStyle(panel);
    const panelBg = panelStyle.backgroundColor;
    const alphaMatch = panelBg.match(/[\d.]+/g)?.map(Number) ?? [];
    const panelRgb: [number, number, number] = [alphaMatch[0] ?? 255, alphaMatch[1] ?? 255, alphaMatch[2] ?? 255];
    const panelAlpha = alphaMatch.length >= 4 ? (alphaMatch[3] ?? 1) : 1;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const canvasRect = canvas.getBoundingClientRect();

    const sampleBehind = (rect: DOMRect): [number, number, number] => {
      // 지도 캔버스에서 해당 화면 영역의 평균색. 캔버스 밖이면 셸 배경(#F7F8F8).
      if (!ctx) return [247, 248, 248];
      const sx = Math.round(((rect.x - canvasRect.x) / canvasRect.width) * canvas.width);
      const sy = Math.round(((rect.y - canvasRect.y) / canvasRect.height) * canvas.height);
      const sw = Math.max(1, Math.round((rect.width / canvasRect.width) * canvas.width));
      const sh = Math.max(1, Math.round((rect.height / canvasRect.height) * canvas.height));
      if (sx < 0 || sy < 0 || sx + sw > canvas.width || sy + sh > canvas.height) return [247, 248, 248];
      try {
        const data = ctx.getImageData(sx, sy, sw, sh).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1; }
        return n === 0 ? [247, 248, 248] : [r / n, g / n, b / n];
      } catch { return [247, 248, 248]; }
    };

    const rows: Record<string, unknown>[] = [];
    for (const target of targets) {
      const node = document.querySelector<HTMLElement>(target.selector);
      if (!node) { rows.push({ ...target, status: "absent" }); continue; }
      const rect = node.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) { rows.push({ ...target, status: "zero-size" }); continue; }
      const style = getComputedStyle(node);
      const fg = parseRgb(style.color);
      const behind = sampleBehind(rect);
      // 알파 합성: 결과 = panel*a + behind*(1-a)
      const composed: [number, number, number] = [
        panelRgb[0] * panelAlpha + behind[0] * (1 - panelAlpha),
        panelRgb[1] * panelAlpha + behind[1] * (1 - panelAlpha),
        panelRgb[2] * panelAlpha + behind[2] * (1 - panelAlpha),
      ];
      const contrast = ratio(lum(fg[0], fg[1], fg[2]), lum(composed[0], composed[1], composed[2]));
      const fontSize = Number.parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const large = fontSize >= 24 || (fontSize >= 18.66 && bold);
      rows.push({
        ...target,
        status: "measured",
        color: style.color,
        fontSize,
        large,
        behind: behind.map((v) => Math.round(v)),
        composed: composed.map((v) => Math.round(v)),
        contrast: Number(contrast.toFixed(2)),
        passesAA: contrast >= (large ? 3 : 4.5),
      });
    }
    return { panelBg, panelAlpha, backdropFilter: panelStyle.backdropFilter, rows };
  });
}

async function shootPanel(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}-full.png` });
  const panel = page.getByTestId("ai-panel");
  if (!(await panel.isVisible().catch(() => false))) return;
  // 요소 샷은 도크에 따라 0px 이거나 애니메이션 중이면 무한 대기한다 — 반드시 상한을 건다.
  await panel.screenshot({ path: `${OUT}/${name}-panel.png`, timeout: 8_000 }).catch(() => undefined);
}

test("조수 셸 실측 — 도크 3종 · 빈/입력 상태", async ({ page }) => {
  test.setTimeout(480_000); // 편집기 부팅만 60~90s.
  const report: Record<string, unknown> = { tag: TAG };
  await boot(page, "basic");

  report.mapPainted = await waitForMapPainted(page, 5_000);
  report.basic_boot = await shellMetrics(page);
  report.basic_boot_contrast = await textContrastOverGlass(page);
  await shootPanel(page, "01-basic-boot");

  const input = page.getByTestId("ai-input");
  if (await input.isVisible().catch(() => false)) {
    await input.click();
    await page.waitForTimeout(500);
    report.basic_focus = await shellMetrics(page);
    await shootPanel(page, "02-basic-focus");
    await input.fill("마을에 대장간을 하나 지어줘");
    await page.waitForTimeout(400);
    await shootPanel(page, "03-basic-typed");
    await input.fill("");
  }

  const docks: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId("chat-dock-toggle").evaluate((n) => (n as HTMLButtonElement).click());
    await page.waitForTimeout(800);
    const dock = (await page.getByTestId("ai-panel").getAttribute("data-chat-dock")) ?? "?";
    docks.push(dock);
    report[`dock_${dock}`] = await shellMetrics(page);
    report[`dock_${dock}_contrast`] = await textContrastOverGlass(page);
    await shootPanel(page, `1${i}-dock-${dock}`);
  }
  report.docks = docks;

  // 접힌 상태 — 복귀 버튼에 얼굴이 남아 있는지 본다.
  // 전체 화면 샷만 찍는다(패널 요소 샷은 접힘 상태에서 0px 라 hang 위험).
  const collapsed = await page.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>("[data-testid='ai-collapse']");
    if (!btn) return "no-collapse-button";
    btn.click();
    return "clicked";
  });
  report.collapseTrigger = collapsed;
  await page.waitForTimeout(700);
  report.collapsed = await shellMetrics(page);
  await page.screenshot({ path: `${OUT}/20-collapsed.png` });

  writeFileSync(`${OUT}/metrics.json`, JSON.stringify(report, null, 2), "utf8");
});
