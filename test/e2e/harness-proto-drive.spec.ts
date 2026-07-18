// 보이지 않는 하네스 프로토 — 수직 슬라이스 실동 검증 + 증거 스크린샷 4장.
// 루프: 성벽 단면 반복 페인트 → 휴지 → 그림 제안 카드 → [등록] → 팔레트 '내 스탬프' → 스탬프로 찍기.
// 주의: Supabase 설정 없이 돌릴 것(.env.local 비활성) — 맵 편집 락이 원격 테이블을 건드리지 않도록.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOT_DIR = process.env.HARNESS_PROTO_SHOT_DIR
  ? path.resolve(process.env.HARNESS_PROTO_SHOT_DIR)
  : path.resolve("output/evidence/harness-proto");

// 성벽 정단면(북→남): 데크 상변 → 보행면 → 데크 하변 → 정면 → 정면 하단.
const WALL_ROWS = [19, 49, 109, 51, 81] as const;
const WALL_HALF_SPAN = 4; // 중심 ±4 → 9열

type DebugState = {
  project: {
    startMapId: string;
    maps: Record<string, { width: number; height: number; lowerTiles: number[] }>;
    tilesets: Record<string, { structureKits?: { id: string; width: number; height: number }[] }>;
  };
  editor: { currentMapId: string | null; zoom: number };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function selectTile(page: Page, tile: number): Promise<void> {
  const direct = page.getByTestId(`chipset-tile-${tile}`);
  if ((await direct.count()) > 0) {
    await direct.scrollIntoViewIfNeeded();
    await direct.click();
  } else {
    // 폴백: 찾기 탭에서 번호 검색.
    await page.getByTestId("quick-tile-toggle").click();
    await page.getByTestId("tile-search-input").fill(String(tile));
    await page.getByTestId(`quick-tile-${tile}`).click();
    await page.getByTestId("palette-work-tab-paint").click();
  }
  await expect(page.getByTestId("selected-tile-status")).toContainText(String(tile));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

/** 페인트 단계 중 중간(미완성 단면) 제안 카드가 뜨면 [무시]로 치운다 — 클릭 가로채기 방지.
 * 중간 단면의 서명은 최종 5줄 단면과 다르므로 세션 톰스톤이 최종 제안을 막지 않는다.
 * 안전장치: 최종 목표인 "5줄 단면" 카드는 절대 무시하지 않는다(톰스톤 오염 방지). */
async function ignorePrematureSuggestion(page: Page): Promise<void> {
  const ignoreButton = page.getByTestId("harness-suggestion-ignore");
  if (!(await ignoreButton.isVisible().catch(() => false))) return;
  const sub = await page.getByTestId("harness-suggestion-sub").textContent().catch(() => "");
  if (sub?.includes("5줄")) return;
  await ignoreButton.click();
  await page.waitForTimeout(120);
}

test("invisible harness loop: paint → suggest → register → stamp", async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?blankProject=1");

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500); // Phaser 부트 안정화

  // Supabase 설정이 없어야 한다(.env.local 제거) — 맵 편집 락이 원격 테이블을 건드리지 않도록.
  // 락 배너가 보이면 환경이 잘못된 것: 절대 takeover 하지 않고 실패시킨다.
  await expect(page.getByTestId("map-lock-banner-takeover")).toBeHidden();

  // 하위 레이어 + 연필.
  await page.getByTestId("layer-lower").click();
  await page.getByTestId("tool-paint").click();

  // ── 캔버스 좌표 캘리브레이션: 중심 프로브 1점을 실제로 찍고, 어느 타일이 변했는지 역산 ──
  await selectTile(page, WALL_ROWS[0]);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing canvas box");
  const probePx = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(probePx.x, probePx.y);
  await page.waitForTimeout(150);

  const afterProbe = await debugState(page);
  const mapId = afterProbe.editor.currentMapId ?? afterProbe.project.startMapId;
  const map = afterProbe.project.maps[mapId];
  const zoom = afterProbe.editor.zoom || 2;
  const tilePx = 16 * zoom;
  const probeIndex = map.lowerTiles.findIndex((tileValue) => tileValue === WALL_ROWS[0]);
  expect(probeIndex, "probe paint must land on the map").toBeGreaterThanOrEqual(0);
  const center = { x: probeIndex % map.width, y: Math.floor(probeIndex / map.width) };
  // 맵이 캔버스 중앙 정렬이면 타일 "중심"을 정확히 계산(경계 걸침 플레이크 제거).
  // 중앙 정렬 가정이 프로브와 어긋나면 프로브 상대 좌표로 폴백.
  const originX = box.x + (box.width - map.width * tilePx) / 2;
  const originY = box.y + (box.height - map.height * tilePx) / 2;
  const centered =
    Math.floor((probePx.x - originX) / tilePx) === center.x
    && Math.floor((probePx.y - originY) / tilePx) === center.y;
  const pxOf = (tx: number, ty: number): { x: number; y: number } =>
    centered
      ? { x: originX + (tx + 0.5) * tilePx, y: originY + (ty + 0.5) * tilePx }
      : { x: probePx.x + (tx - center.x) * tilePx, y: probePx.y + (ty - center.y) * tilePx };

  // ── 성벽 5줄 단면을 가로 9열로 반복 페인트 (행 단위 드래그, 누락 칸은 개별 보정 클릭) ──
  const wallTop = center.y;
  const spanX0 = center.x - WALL_HALF_SPAN;
  const spanX1 = center.x + WALL_HALF_SPAN;
  expect(spanX0).toBeGreaterThanOrEqual(0);
  expect(spanX1).toBeLessThan(map.width);
  expect(wallTop + WALL_ROWS.length).toBeLessThanOrEqual(map.height);

  // 아래 4줄을 먼저, 맨 윗줄(19)을 마지막에 — 마지막 완성 행이 캔버스 상단에 있어
  // 제안 카드(하단 오버레이)가 보정 클릭을 가로채는 경합이 구조적으로 사라진다.
  for (const row of [1, 2, 3, 4, 0]) {
    await selectTile(page, WALL_ROWS[row]);
    await ignorePrematureSuggestion(page);
    const y = wallTop + row;
    const start = pxOf(spanX0, y);
    const end = pxOf(spanX1, y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 36 });
    await page.mouse.up();
    // 드래그가 건너뛴 칸 보정(검증 재시도 포함) — 열 단면 동일성이 감지의 전제.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.waitForTimeout(120);
      const state = await debugState(page);
      const tiles = state.project.maps[mapId].lowerTiles;
      const missing: number[] = [];
      for (let x = spanX0; x <= spanX1; x += 1) {
        if (tiles[y * map.width + x] !== WALL_ROWS[row]) missing.push(x);
      }
      if (missing.length === 0) break;
      await ignorePrematureSuggestion(page);
      for (const x of missing) {
        const point = pxOf(x, y);
        await page.mouse.click(point.x, point.y);
      }
    }
  }

  // 검증: 전체 벽이 정확히 찍혔는가.
  const painted = await debugState(page);
  for (let row = 0; row < WALL_ROWS.length; row += 1) {
    for (let x = spanX0; x <= spanX1; x += 1) {
      expect(
        painted.project.maps[mapId].lowerTiles[(wallTop + row) * map.width + x],
        `wall cell (${x},${wallTop + row})`,
      ).toBe(WALL_ROWS[row]);
    }
  }

  // ① 붓질 직후 — 예절: 휴지 전에는 카드가 없다.
  await expect(page.getByTestId("harness-suggestion-card")).toBeHidden();
  await page.screenshot({ path: path.join(SHOT_DIR, "01-paint.png") });

  // ② 휴지기(2초) 후 — 그림 제안 카드 (크롭 + 조립 렌더 + 등록/무시).
  await expect(page.getByTestId("harness-suggestion-card")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("harness-suggestion-crop")).toBeVisible();
  await expect(page.getByTestId("harness-suggestion-preview")).toBeVisible();
  await expect(page.getByTestId("harness-suggestion-sub")).toContainText("5줄 단면");
  await page.waitForTimeout(600); // 칩셋 이미지 비동기 드로우 안정화
  await page.screenshot({ path: path.join(SHOT_DIR, "02-suggest.png") });

  // ③ [등록] → 프로젝트 저장 + 팔레트 '내 스탬프' 선반 아이콘.
  await page.getByTestId("harness-suggestion-register").click();
  await expect(page.getByTestId("structure-kit-shelf")).toBeVisible({ timeout: 5_000 });
  const registered = await debugState(page);
  const tilesetsWithKits = Object.values(registered.project.tilesets).filter(
    (tileset) => (tileset.structureKits?.length ?? 0) > 0,
  );
  expect(tilesetsWithKits.length).toBe(1);
  expect(tilesetsWithKits[0].structureKits![0]).toMatchObject({ width: 1, height: 5 });
  await page.waitForTimeout(600); // 선반 아이콘 드로우
  await page.screenshot({ path: path.join(SHOT_DIR, "03-palette.png") });

  // ④ 등록된 스탬프로 맵의 다른 곳(벽 위쪽 빈터)에 찍기 — 드래그 한 번에 6열.
  const stampY = wallTop - 6;
  expect(stampY, "stamp target rows must fit above the wall").toBeGreaterThanOrEqual(0);
  const stampX0 = Math.max(0, spanX0 - 2);
  const stampX1 = stampX0 + 5;
  const stampStart = pxOf(stampX0, stampY);
  const stampEnd = pxOf(stampX1, stampY);
  await page.mouse.move(stampStart.x, stampStart.y);
  await page.mouse.down();
  await page.mouse.move(stampEnd.x, stampEnd.y, { steps: 24 });
  await page.mouse.up();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.waitForTimeout(150);
    const stampedTiles = (await debugState(page)).project.maps[mapId].lowerTiles;
    const missing: number[] = [];
    for (let x = stampX0; x <= stampX1; x += 1) {
      if (stampedTiles[stampY * map.width + x] !== WALL_ROWS[0]) missing.push(x);
    }
    if (missing.length === 0) break;
    for (const x of missing) {
      const point = pxOf(x, stampY);
      await page.mouse.click(point.x, point.y);
    }
  }

  // 검증: 스탬프 열들이 5줄 단면 그대로인가.
  const final = await debugState(page);
  for (let x = stampX0; x <= stampX1; x += 1) {
    for (let row = 0; row < WALL_ROWS.length; row += 1) {
      expect(
        final.project.maps[mapId].lowerTiles[(stampY + row) * map.width + x],
        `stamped cell (${x},${stampY + row})`,
      ).toBe(WALL_ROWS[row]);
    }
  }

  // 예절: 기등록 패턴은 재제안하지 않는다 — 휴지 2초를 넘겨도 침묵.
  await page.waitForTimeout(2_600);
  await expect(page.getByTestId("harness-suggestion-card")).toBeHidden();
  await page.screenshot({ path: path.join(SHOT_DIR, "04-stamp.png") });
});
