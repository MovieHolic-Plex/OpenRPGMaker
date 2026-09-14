// 맵 속성 「맵 배경」 탭의 미리보기 증거 캡처.
//
// 캔버스는 맵 배경을 그리지 않는다(빈 칸 체커가 의도된 신호라 덮지 않는다 — 편집기 라우팅 문서).
// 그래서 저작자가 고른 배경을 눈으로 확인하는 자리는 이 탭의 미리보기 하나뿐이고, 그 표면이
// 실제 브라우저에서 뜨는지(그림이 실제로 로드되는지)를 여기서 확인한다.
//
//   node scripts/capture-map-background-preview.mjs [outDir]
//
// 결과: <outDir>/background-tab.png + 콘솔에 픽커 옵션 testid 와 미리보기 원본 크기.
import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const PORT = process.env.DEV_SERVER_PORT ?? "9814";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.argv[2] ?? "verify-shots/editor-map-bg-preview";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
  await gotoWithRetry(page, `${BASE}/?freshProject=1`);
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });

  // 맵 설정의 진입은 팔레트의 타일셋 이름 칩이다 — 표준 모드에서 맵 도크가 항상 떠 있지 않고,
  // 트리 행 더블클릭은 그 도크가 열려 있어야 한다.
  await page.getByTestId("palette-tileset-name").first().click();

  const dialog = page.getByRole("dialog", { name: "맵 설정", exact: true });
  await page.getByTestId("map-props-tab-background").click();
  await page.getByTestId("map-bg-enable").check();
  await page.getByTestId("map-bg-image-set").click();

  // 픽커가 내놓는 배경 옵션 — id 규약을 여기서 관측해 둔다(추측하지 않는다).
  const optionIds = await page.locator('[data-testid^="map-bg-image-dialog-option-"]').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("data-testid")),
  );
  console.log("picker options:", optionIds.slice(0, 6), "total", optionIds.length);
  const sky = optionIds.find((id) => id?.includes("easyrpg-backdrop-sky1"));
  if (!sky) throw new Error("픽커에 easyrpg-backdrop-sky1 옵션이 없습니다");
  await page.getByTestId(sky).click();
  await page.getByTestId("map-bg-image-dialog-ok").click();

  const preview = page.getByTestId("map-bg-preview");
  await preview.waitFor({ state: "visible", timeout: 15_000 });
  // 「떴다」 가 아니라 「그림이 실제로 로드됐다」 를 본다 — 깨진 img 도 visible 이다.
  const size = await preview.evaluate((node) => ({
    src: node.getAttribute("src"),
    naturalWidth: node.naturalWidth,
    naturalHeight: node.naturalHeight,
  }));
  console.log("preview:", JSON.stringify(size));
  if (!(size.naturalWidth > 0)) throw new Error("미리보기 그림이 로드되지 않았습니다");

  await page.getByTestId("map-bg-scroll-x").fill("2");
  await page.getByTestId("map-bg-loop-x").check();
  await page.screenshot({ path: `${OUT}/background-tab.png` });

  // 캔버스 미리보기: 토글 전에는 배경이 안 보이고(빈 칸 체커가 불투명), 켜면 배경이 비친다.
  // 배경은 **빈 칸이 뚫린 창**으로만 보이므로, 판정할 면적을 먼저 비운다(편집기 툴 훅으로
  // 카메라가 보고 있는 타일 범위를 지운다 — 맵이 크면(100×100) 고정 좌표로 지우면 화면 밖이다.
  // 하층을 지운다 — 손으로 지우는 시늉을 하지 않는다).
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  const mapId = new URL(page.url()).searchParams.get("map");
  if (!mapId) throw new Error("맵 id 를 URL 에서 찾지 못했습니다");
  // 빈 칸은 «통행 불가» 라 프로젝트 무결성 검사가 큰 사각형을 거부한다(전송 목적지가 막힌다).
  // 그래서 카메라 중앙에서 작은 패치부터 시도해 **커밋되는** 크기를 찾는다 — 거부를 우회하지 않는다.
  const erased = await page.evaluate(
    ([id]) => {
      const camera = window.__oprnEditCamera();
      const tile = 16;
      const centerX = Math.floor((camera.scrollX + camera.width / camera.zoom / 2) / tile);
      const centerY = Math.floor((camera.scrollY + camera.height / camera.zoom / 2) / tile);
      for (const [width, height] of [[8, 5], [6, 4], [4, 3], [3, 2], [2, 2]]) {
        const from = { x: centerX, y: centerY };
        const to = { x: centerX + width - 1, y: centerY + height - 1 };
        const result = window.__oprnEditorTool("paint_tiles", {
          mapId: id, layer: "lower", mode: "rect", tile: -1, from, to,
        });
        if (result?.ok) return { ok: true, width, height, from, to };
      }
      return { ok: false };
    },
    [mapId],
  );
  console.log("erase:", JSON.stringify(erased));
  if (!erased.ok) throw new Error("빈 칸을 만들지 못했습니다 — 미리보기 차이를 보일 수 없습니다");
  const canvas = page.getByTestId("edit-canvas");
  const toggle = page.getByTestId("map-background-preview-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(600);
  await canvas.screenshot({ path: `${OUT}/canvas-without-preview.png` });

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: `${OUT}/canvas-with-preview.png` });
  console.log("done ->", OUT);
} finally {
  await browser.close();
}
