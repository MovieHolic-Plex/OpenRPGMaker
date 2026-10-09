// 화면 밖 타일 컬링이 **보이는 그림을 바꾸지 않는다**는 브라우저 증거.
//
// jsdom 테스트는 픽셀을 만들지 않으므로 컬링이 화면을 갉아먹어도 통과한다. 여기서는 큰 맵을
// 띄우고 실제 캔버스를 찍은 뒤, 플레이어를 여러 칸 걸어 카메라가 타일 경계를 여러 번 넘게
// 하고 다시 찍는다. 같은 스펙을 origin/main 워크트리에서도 돌려 PNG 를 비교하면 컬링 전후가
// 같은 그림인지 확인할 수 있다.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectForEditor } from "./projectSeed";

const SIZE = 60;
/** 통과해도 남는 증거 경로 — Playwright 첨부는 성공 시 디스크에 남지 않는다. */
const EVIDENCE = path.resolve(".omo/evidence/runtime-perf");

/**
 * 스크린샷 가운데 60% 안의 어두운 픽셀 비율. 캔버스는 레터박스(좌우 검은 띠)로 감싸여
 * 있어서 전체를 재면 정상 화면도 15% 넘게 검다 — 그래서 지도 내용이 확실한 중앙만 본다.
 *
 * 왜 in-page getImageData 가 아닌가: WebGL 캔버스는 preserveDrawingBuffer 없이 합성 뒤
 * 버퍼가 비므로 drawImage → getImageData 가 전부 투명 검정으로 읽힌다(실측 blackRatio 1).
 */
async function keepShot(testInfo: import("@playwright/test").TestInfo, name: string, body: Buffer): Promise<void> {
  await testInfo.attach(name, { body, contentType: "image/png" });
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(path.join(EVIDENCE, name), body);
}

function centerDarkRatio(png: Buffer): number {
  const image = PNG.sync.read(png);
  const x0 = Math.floor(image.width * 0.2);
  const x1 = Math.floor(image.width * 0.8);
  const y0 = Math.floor(image.height * 0.2);
  const y1 = Math.floor(image.height * 0.8);
  let dark = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (image.width * y + x) << 2;
      total += 1;
      if (image.data[offset] < 12 && image.data[offset + 1] < 12 && image.data[offset + 2] < 12) dark += 1;
    }
  }
  return total === 0 ? 1 : dark / total;
}

test.setTimeout(150_000);
test.use({ serviceWorkers: "block" });

test("큰 맵에서 컬링을 켜도 화면에 빈 칸이 생기지 않는다", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  const project = createBlankProject();
  const map = createBlankMap("컬링 증거 맵", SIZE, SIZE);
  map.id = "map_culling";
  map.tilesetId = project.maps[project.startMapId]!.tilesetId;
  // 체커보드로 깔아 한 칸이라도 빠지면 눈에 보이게 한다.
  map.lowerTiles = Array.from({ length: SIZE * SIZE }, (_, index) => {
    const x = index % SIZE;
    const y = Math.floor(index / SIZE);
    return (x + y) % 2 === 0 ? TILE.GRASS : TILE.PATH;
  });
  map.upperTiles = new Array(SIZE * SIZE).fill(-1);
  map.events = [];
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 20, y: 20 };

  await seedProjectForEditor(page, project);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });

  const canvas = page.locator("[data-testid='test-play-window'] canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1200);

  const before = await canvas.screenshot();
  await keepShot(testInfo, "culling-start.png", before);

  // 카메라가 타일 경계를 여러 번 넘게 걷는다 — 컬링 창이 매번 다시 계산된다.
  for (let step = 0; step < 8; step += 1) await tapKey(page, "ArrowRight", 220);
  for (let step = 0; step < 6; step += 1) await tapKey(page, "ArrowDown", 220);
  await page.waitForTimeout(900);

  const after = await canvas.screenshot();
  await keepShot(testInfo, "culling-after-walk.png", after);

  // 걸었으니 그림은 달라야 한다(카메라가 실제로 움직였다는 확인).
  expect(Buffer.compare(before, after)).not.toBe(0);

  // 걷기 전·후 모두 화면 가운데에 "아무것도 안 그려진" 영역이 없어야 한다.
  // 컬링이 보이는 타일까지 숨기면 배경색(#000)이 드러난다.
  expect(centerDarkRatio(before), "시작 화면 가운데가 비어 있다").toBeLessThan(0.02);
  expect(centerDarkRatio(after), "걸은 뒤 화면 가운데가 비어 있다 — 컬링이 보이는 타일을 숨겼다")
    .toBeLessThan(0.02);

  // 되돌아가도 앞서 숨겼던 타일이 다시 보여야 한다.
  for (let step = 0; step < 8; step += 1) await tapKey(page, "ArrowLeft", 220);
  for (let step = 0; step < 6; step += 1) await tapKey(page, "ArrowUp", 220);
  await page.waitForTimeout(900);

  const returned = await canvas.screenshot();
  await keepShot(testInfo, "culling-returned.png", returned);
  expect(centerDarkRatio(returned), "돌아온 자리에 타일이 다시 나타나지 않았다").toBeLessThan(0.02);
});
