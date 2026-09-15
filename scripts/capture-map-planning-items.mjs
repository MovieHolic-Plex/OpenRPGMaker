/**
 * OPRN-019 보존 기획 항목 — 브라우저 실측 증거.
 * 사용: npm run dev:worktree (포트 9853) 를 띄운 뒤
 *       node scripts/capture-map-planning-items.mjs
 * 출력: verify-shots/oprn-019/*.png
 *
 * 찍는 것:
 *  1. 스튜디오 덱 「기획」 탭 — 목록·상태·편집/은퇴/삭제 컨트롤.
 *  2. 컴포저 「보존 기획 재사용」 팝오버 — 없음/전체/선택 + 보내기 전 미리보기.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9853";
const OUT = path.resolve("verify-shots/oprn-019");
fs.mkdirSync(OUT, { recursive: true });

async function dismissOverlays(page) {
  for (const testid of ["editor-welcome-skip", "editor-welcome-close", "modal-close"]) {
    const node = page.getByTestId(testid);
    if (await node.isVisible().catch(() => false)) await node.click().catch(() => {});
  }
  for (const label of ["건너뛰기", "닫기", "나중에"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("shot", name);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30_000);

  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 60_000 });
  await dismissOverlays(page);

  // 보존 기획 항목 세 줄을 실제 저작 경로(mapPlanningActions)로 심는다 — 화면이 읽는 그 데이터다.
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { addMapPlanningItem } = await import("/src/editor/mapPlanningActions.ts");
    const mapId = store.getCurrent().startMapId;
    addMapPlanningItem(mapId, "북쪽 광장과 우물은 그대로 남긴다");
    addMapPlanningItem(mapId, "동쪽 부두는 목재로 유지 — 석재로 바꾸지 말 것", { origin: "spec", specAssetId: `${mapId}:dock` });
    addMapPlanningItem(mapId, "남쪽 옛 다리는 이번 개편에서 철거 예정");
  });

  // 조수 패널을 펼친다.
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click().catch(() => {});
  await page.waitForSelector("[data-testid='ai-command-bar']", { timeout: 30_000 });

  // ── 1. 스튜디오 덱 「기획」 탭 ──────────────────────────────────────────
  // 사람이 누르는 진입로는 톱바 버튼이다(패널 속 `ai-studio-toggle` 은 숨은 테스트 훅).
  await page.getByTestId("topbar-ai-studio").click();
  await page.waitForSelector("[data-testid='ai-studio-shell']", { timeout: 30_000 });
  await page.getByTestId("ai-studio-tab-planning").click();
  await page.waitForSelector("[data-testid='ai-planning-list']", { timeout: 30_000 });
  await shot(page, "01-studio-deck-planning-list");
  const deck = page.locator("[data-testid='ai-studio-deck']");
  await deck.screenshot({ path: path.join(OUT, "02-planning-list-crop.png") });
  console.log("shot 02-planning-list-crop");

  // 은퇴한 항목이 목록에 남되 재사용 후보에서 빠지는 모습.
  const rows = page.locator("[data-testid='ai-planning-item']");
  const lastId = await rows.last().getAttribute("data-item-id");
  await page.getByTestId(`ai-planning-retire-${lastId}`).click();
  await page.waitForSelector(`[data-item-id='${lastId}'][data-status='retired']`, { timeout: 15_000 });
  await deck.screenshot({ path: path.join(OUT, "03-planning-retired-crop.png") });
  console.log("shot 03-planning-retired-crop");

  // 스튜디오를 닫고 기본 조수로 돌아온다.
  await page.getByTestId("ai-studio-exit").click();
  await page.waitForSelector("[data-testid='ai-command-bar']", { timeout: 30_000 });

  // ── 2. 컴포저 재사용 선택 ─────────────────────────────────────────────
  await page.getByTestId("ai-planning-toggle").click();
  await page.waitForSelector("[data-testid='ai-planning-reuse']", { timeout: 30_000 });
  await shot(page, "04-reuse-default-none");

  await page.getByTestId("ai-planning-reuse-mode-all").click();
  await page.waitForSelector("[data-testid='ai-planning-reuse-preview']:not([hidden])", { timeout: 15_000 });
  await shot(page, "05-reuse-all-preview");

  await page.getByTestId("ai-planning-reuse-mode-selected").click();
  await page.waitForSelector("[data-testid='ai-planning-reuse-items']", { timeout: 15_000 });
  const picks = page.locator("[data-testid^='ai-planning-reuse-pick-']");
  await picks.first().check();
  await page.waitForSelector("[data-testid='ai-planning-reuse-preview']:not([hidden])", { timeout: 15_000 });
  await shot(page, "06-reuse-selected-preview");

  const popover = page.locator("[data-testid='ai-planning-popover']");
  await popover.screenshot({ path: path.join(OUT, "07-reuse-popover-crop.png") });
  console.log("shot 07-reuse-popover-crop");

  // 팝오버를 닫으면 컴포저 칩이 무엇이 실릴지 말한다.
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-testid='ai-planning-chip']", { timeout: 15_000 });
  await page.locator("[data-testid='ai-context-chips']").screenshot({ path: path.join(OUT, "08-composer-chip-crop.png") });
  console.log("shot 08-composer-chip-crop");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
