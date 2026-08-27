// 타일 시맨틱 재감사(2026-08-27)의 교정 결과가 **실제 에디터 화면**에 뜨는지 지킨다.
//
// 대상: retro_exterior 179번. 출하 데이터에는 "붉은 지붕 하단 처마"(role=roof) 로 적혀 있었고,
// 14~20배 크롭 재판독 결과 지붕이 아니라 붉은 제비꼬리 깃발(role=decoration) 이었다.
// 잘못된 라벨은 AI 검색/배치에 그대로 새어 나가므로, 교정이 테이블에만 있고 화면에는
// 안 뜨는 상태를 막는 것이 이 스펙의 목적이다.
//
// 경로: DB · 타일셋 탭 → 레트로 바깥 타일셋 → 타일 그림판 179번 셀 우클릭 → "의미 편집…"
// 다이얼로그. 라벨 입력칸 값은 tileset.tileMeta[179] 이고, 이 값은 번들 칩셋일 때
// themePacks.seedBundledSemanticTileMeta 가 RETRO_EXTERIOR_TILE_SEMANTICS 에서 시드한다.
// 즉 이 한 줄이 [시맨틱 테이블 → tileMeta 시드 → DB 화면] 배선 전체를 통과한다.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroExterior";
import { bootDbLane, switchTabAnyMode } from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS } from "./oprn-database-helpers";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

const TILESETS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "tilesets")!;
const RETRO_EXTERIOR_ROW = "tileset-db-row-easyrpg_chipset_retro_exterior";
const TILE = 179;
const SHOT_PATH = path.join(".omo", "evidence", "tile-reaudit", "browser", "corrected-label-179.png");

// 기대값은 소스 테이블에서 그대로 읽는다(하드코딩 금지 — 테이블이 유일한 진실).
const EXPECTED = RETRO_EXTERIOR_TILE_SEMANTICS.find((entry) => entry.index === TILE)!;

test("교정된 179번 타일 의미가 타일셋 DB 의미 편집 다이얼로그에 뜬다", async ({ page }) => {
  expect(EXPECTED, `시맨틱 테이블에 ${TILE}번 항목이 없다`).toBeTruthy();
  expect(EXPECTED.label).toContain("깃발");
  expect(EXPECTED.role).toBe("decoration");

  await bootDbLane(page, { mode: "expert", viewport: { width: 1600, height: 1000 } });
  await switchTabAnyMode(page, TILESETS_TAB);

  await page.getByTestId(RETRO_EXTERIOR_ROW).click({ force: true });
  await expect(page.getByTestId(RETRO_EXTERIOR_ROW)).toHaveClass(/active/);
  await expect(page.getByTestId("tileset-db-preview")).toBeVisible({ timeout: 15_000 });

  const cell = page.getByTestId(`tileset-db-cell-${TILE}`);
  await expect(cell).toBeAttached();
  await cell.click({ button: "right", force: true });

  const menu = page.getByTestId("tileset-tile-context-menu");
  await expect(menu).toBeVisible({ timeout: 10_000 });
  await expect(menu).toHaveAttribute("data-tile", String(TILE));
  await menu.getByTestId("tileset-ctx-edit-meaning").click();

  const dialog = page.getByTestId("tileset-meaning-dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const labelField = page.getByTestId("tileset-meaning-dialog-label");
  await expect(labelField).toBeVisible();

  const shown = await labelField.inputValue();
  // 화면 라벨이 교정된 테이블 라벨과 글자 단위로 같아야 한다.
  expect(shown, `179번 라벨이 테이블과 다르다: 화면="${shown}"`).toBe(EXPECTED.label);
  // 교정된 명사가 있어야 하고, 틀린 옛 라벨의 명사는 남아 있으면 안 된다.
  expect(shown).toContain("깃발");
  expect(shown).not.toContain("처마");
  expect(shown).not.toContain("지붕");

  // 다이얼로그 본문 전체(설명 포함)에도 옛 오독이 남아 있으면 안 된다.
  const bodyText = [shown, await page.getByTestId("tileset-meaning-dialog-description").inputValue()].join(" ");
  expect(bodyText).not.toContain("처마");
  expect(bodyText).not.toContain("지붕");

  mkdirSync(path.dirname(SHOT_PATH), { recursive: true });
  await dialog.screenshot({ path: SHOT_PATH });
});
