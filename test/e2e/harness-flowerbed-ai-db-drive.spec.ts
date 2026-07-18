// 보이지 않는 하네스 2차 실증 — 성이 아닌 패턴(울타리 화단)으로:
//  유저 페인트 학습 → [등록] → DB '스탬프' 탭에서 타일 렌더로 관리(이름 변경) →
//  AI 하네스 경로(list_structure_kits / stamp_structure_kit + 시스템 프롬프트 다이제스트) 증거 채집 →
//  AI 시공 결과를 캔버스에서 확인.
// 주의: Supabase 설정 없이 돌릴 것(.env.local 비활성).
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOT_DIR = process.env.HARNESS_PROTO_SHOT_DIR
  ? path.resolve(process.env.HARNESS_PROTO_SHOT_DIR)
  : path.resolve("output/evidence/harness-proto");

// 울타리 화단 3줄 단면(상위 레이어): 울타리 379 / 꽃 288 / 울타리 379. 하위는 잔디 받침.
const BED_ROWS = [379, 288, 379] as const;
const BED_HALF_SPAN = 4; // 중심 ±4 → 9열 반복
const KIT_RENAME = "울타리 화단";

type DebugState = {
  project: {
    startMapId: string;
    maps: Record<string, { width: number; height: number; lowerTiles: number[]; upperTiles: number[] }>;
    tilesets: Record<string, { structureKits?: { id: string; name?: string; width: number; height: number }[] }>;
  };
  editor: { currentMapId: string | null; zoom: number };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

// 울타리·꽃은 상위 레이어 타일 — layer-upper 팔레트 시트에 대표 칸이 그대로 있다.
// (찾기 탭 폴백은 이 기준선에서 0×0 렌더 결함이 있어 쓰지 않는다.)
async function selectTile(page: Page, tile: number): Promise<void> {
  const direct = page.getByTestId(`chipset-tile-${tile}`);
  await expect(direct, `chipset-tile-${tile} must be on the current palette sheet`).toHaveCount(1);
  await direct.scrollIntoViewIfNeeded();
  await direct.click();
  await expect(page.getByTestId("selected-tile-status")).toContainText(String(tile));
}

/** 미완성 단면 카드가 페인트 클릭을 가로채면 [무시] — 최종 3줄 카드는 건드리지 않는다. */
async function ignorePrematureSuggestion(page: Page): Promise<void> {
  const ignoreButton = page.getByTestId("harness-suggestion-ignore");
  if (!(await ignoreButton.isVisible().catch(() => false))) return;
  const sub = await page.getByTestId("harness-suggestion-sub").textContent().catch(() => "");
  if (sub?.includes("3줄")) return;
  await ignoreButton.click();
  await page.waitForTimeout(120);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("flowerbed: learn → DB manage (tile-visualized) → AI harness stamps it", async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?blankProject=1");

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("map-lock-banner-takeover")).toBeHidden();

  await page.getByTestId("layer-upper").click();
  await page.getByTestId("tool-paint").click();

  // ── 캘리브레이션: 울타리 379(상위 레이어) 프로브 → upperTiles에서 역산 ──
  await selectTile(page, BED_ROWS[0]);
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
  const probeIndex = map.upperTiles.findIndex((tileValue) => tileValue === BED_ROWS[0]);
  expect(probeIndex, "probe paint must land on the upper layer").toBeGreaterThanOrEqual(0);
  const center = { x: probeIndex % map.width, y: Math.floor(probeIndex / map.width) };
  const originX = box.x + (box.width - map.width * tilePx) / 2;
  const originY = box.y + (box.height - map.height * tilePx) / 2;
  const centered =
    Math.floor((probePx.x - originX) / tilePx) === center.x
    && Math.floor((probePx.y - originY) / tilePx) === center.y;
  const pxOf = (tx: number, ty: number): { x: number; y: number } =>
    centered
      ? { x: originX + (tx + 0.5) * tilePx, y: originY + (ty + 0.5) * tilePx }
      : { x: probePx.x + (tx - center.x) * tilePx, y: probePx.y + (ty - center.y) * tilePx };

  // ── 화단 3줄 × 9열 페인트. 순서 [위 울타리, 아래 울타리, 꽃]:
  //    울타리 2줄만으로는 어휘 2종이라 감지가 침묵 → 중간 제안 자체가 안 뜬다. ──
  const bedTop = center.y;
  const spanX0 = center.x - BED_HALF_SPAN;
  const spanX1 = center.x + BED_HALF_SPAN;
  expect(spanX0).toBeGreaterThanOrEqual(0);
  expect(spanX1).toBeLessThan(map.width);
  expect(bedTop + BED_ROWS.length).toBeLessThanOrEqual(map.height);

  for (const row of [0, 2, 1]) {
    await selectTile(page, BED_ROWS[row]);
    await ignorePrematureSuggestion(page);
    const y = bedTop + row;
    const start = pxOf(spanX0, y);
    const end = pxOf(spanX1, y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 36 });
    await page.mouse.up();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.waitForTimeout(120);
      const state = await debugState(page);
      const tiles = state.project.maps[mapId].upperTiles;
      const missing: number[] = [];
      for (let x = spanX0; x <= spanX1; x += 1) {
        if (tiles[y * map.width + x] !== BED_ROWS[row]) missing.push(x);
      }
      if (missing.length === 0) break;
      await ignorePrematureSuggestion(page);
      for (const x of missing) {
        const point = pxOf(x, y);
        await page.mouse.click(point.x, point.y);
      }
    }
  }

  const painted = await debugState(page);
  for (let row = 0; row < BED_ROWS.length; row += 1) {
    for (let x = spanX0; x <= spanX1; x += 1) {
      expect(
        painted.project.maps[mapId].upperTiles[(bedTop + row) * map.width + x],
        `bed cell (${x},${bedTop + row})`,
      ).toBe(BED_ROWS[row]);
    }
  }

  // ── 휴지 → 카드 → [등록] ──
  await expect(page.getByTestId("harness-suggestion-card")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("harness-suggestion-sub")).toContainText("3줄 단면");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, "05-flowerbed-suggest.png") });
  await page.getByTestId("harness-suggestion-register").click();
  await expect(page.getByTestId("structure-kit-shelf")).toBeVisible({ timeout: 5_000 });

  // ── 데이터베이스 '스탬프' 탭: 타일 렌더 시각화 + 이름 변경(관리) ──
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-structure-kits").click();
  const registered = await debugState(page);
  const kitEntry = Object.values(registered.project.tilesets)
    .flatMap((tileset) => tileset.structureKits ?? [])[0];
  expect(kitEntry, "kit must be stored in project tilesets").toBeTruthy();
  const kitId = kitEntry!.id;
  await expect(page.getByTestId(`structure-kit-db-${kitId}`)).toBeVisible();
  await expect(page.getByTestId(`structure-kit-db-unit-${kitId}`)).toBeVisible();
  await expect(page.getByTestId(`structure-kit-db-preview-${kitId}`)).toBeVisible();
  const nameInput = page.getByTestId(`structure-kit-db-name-${kitId}`);
  await nameInput.fill(KIT_RENAME);
  await nameInput.blur();
  await page.waitForTimeout(400); // rerender + 아이콘 드로우
  await page.screenshot({ path: path.join(SHOT_DIR, "06-db-structure-kits.png") });

  const renamed = await debugState(page);
  const renamedKit = Object.values(renamed.project.tilesets)
    .flatMap((tileset) => tileset.structureKits ?? [])
    .find((kit) => kit.id === kitId);
  expect(renamedKit?.name).toBe(KIT_RENAME);

  await page.getByTestId("database-modal-close").click();
  // 이름 변경으로 dirty 세션이면 하단 확인 바가 끼어든다 — "저장하고 닫기".
  const dirtySave = page.getByTestId("database-dirty-save");
  if (await dirtySave.isVisible().catch(() => false)) await dirtySave.click();
  await expect(page.getByTestId("database-modal")).toBeHidden();

  // ── AI 하네스 증거: 에디터 툴 훅(어시스턴트와 동일한 runTool 진입점)으로 조회·시공,
  //    시스템 프롬프트(contextBuilder)에 킷 다이제스트가 실리는지 실측 ──
  const botOrigin = { x: Math.max(0, spanX0 - 2), y: 2 };
  const botRepeat = 7;
  const evidence = await page.evaluate(async ({ mapIdIn, kitName, origin, repeat }) => {
    const w = window as unknown as {
      __rpgzzuEditorTool?: (name: string, args: Record<string, unknown>) => unknown;
    };
    if (!w.__rpgzzuEditorTool) throw new Error("editor tool hook missing");
    const list = w.__rpgzzuEditorTool("list_structure_kits", { mapId: mapIdIn });
    const contextModule = await import("/src/ai/contextBuilder.ts");
    const storeModule = await import("/src/project/store.ts");
    const prompt: string = contextModule.buildSystemPrompt(storeModule.store.getCurrent(), { currentMapId: mapIdIn });
    const digestStart = prompt.indexOf("## 내 스탬프");
    const digest = digestStart >= 0 ? prompt.slice(digestStart, digestStart + 600) : "(다이제스트 없음)";
    const stamp = w.__rpgzzuEditorTool("stamp_structure_kit", {
      mapId: mapIdIn,
      kitName,
      origin,
      repeat,
    });
    return { list, digest, stamp };
  }, { mapIdIn: mapId, kitName: KIT_RENAME, origin: botOrigin, repeat: botRepeat });

  fs.writeFileSync(
    path.join(SHOT_DIR, "07-ai-harness-evidence.json"),
    JSON.stringify(evidence, null, 2),
    "utf8",
  );

  const listResult = evidence.list as { ok: boolean; data?: { kits: { name: string; rows: { tiles: number[]; upperTiles?: number[] }[] }[] } };
  expect(listResult.ok).toBe(true);
  expect(listResult.data!.kits[0]!.name).toBe(KIT_RENAME);
  expect(listResult.data!.kits[0]!.rows.map((row) => row.upperTiles?.[0])).toEqual([379, 288, 379]);
  expect(evidence.digest).toContain(KIT_RENAME);
  expect(evidence.digest).toContain("stamp_structure_kit");
  const stampResult = evidence.stamp as { ok: boolean; summary: string };
  expect(stampResult.ok, stampResult.summary).toBe(true);

  // AI 시공 결과 검증: (botOrigin)부터 7열 × 3줄이 화단 그대로.
  const final = await debugState(page);
  const finalMap = final.project.maps[mapId];
  for (let x = botOrigin.x; x < botOrigin.x + botRepeat; x += 1) {
    for (let row = 0; row < BED_ROWS.length; row += 1) {
      expect(
        finalMap.upperTiles[(botOrigin.y + row) * finalMap.width + x],
        `AI-stamped cell (${x},${botOrigin.y + row})`,
      ).toBe(BED_ROWS[row]);
    }
  }

  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOT_DIR, "07-ai-stamped.png") });
});
