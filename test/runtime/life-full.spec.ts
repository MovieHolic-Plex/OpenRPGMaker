import { expect, test, type Page } from "@playwright/test";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import type { Project } from "../../src/project/types";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

/* Task 18: the life ledger and save/resume on the REAL player surface.
 *
 * Why this harness and not scripts/qa/runtime: that runner drives input through
 * input.ts injectActionEdge(), which pushes an edge into the PHASER key manager. The
 * status menu is DOM and listens for window keydown, so injected edges move the world
 * (tilling, harvesting) but never reach the menu — measured across seven attempts at
 * the collapsed rail. Playwright presses real keys, which the DOM receives, exactly as
 * test/runtime/status-menu-adversarial.spec.ts already proves. */

const OUT = "verify-shots/runtime-qa/life-full-menu";
const NAMESPACE = "runtime-life-full-menu";
let server: Awaited<ReturnType<typeof startPlayerQaServer>>;
let project: Project;

type QaWindow = Window & {
  __OPENRPG_BOOT__?: { projectUrl: string; saveNamespace: string; qaInstrumentation: boolean };
  __oprnDebug?: { readState: () => Record<string, unknown> };
};

test.beforeAll(async () => {
  server = await startPlayerQaServer();
  project = JSON.parse(readFileSync("test/fixtures/life-full.project.json", "utf8")) as Project;
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/SUMMARY.md`, "# Life ledger + save/resume on the real player surface\n");
});

test.afterAll(async () => { await server?.close(); });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function boot(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.addInitScript((namespace) => {
    (window as QaWindow).__OPENRPG_BOOT__ = { projectUrl: "/__life-qa/project.json", saveNamespace: namespace, qaInstrumentation: true };
  }, NAMESPACE);
  await page.route("**/__life-qa/project.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 150_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as QaWindow).__oprnDebug?.readState().currentMapId), null, { timeout: 120_000 });
  await expect(page.getByTestId("play-loading-overlay")).toHaveCount(0, { timeout: 120_000 });
  return errors;
}

// Real keys, mirroring status-menu-adversarial.spec.ts: x closes a detail, ArrowDown
// walks the rail, z confirms.
async function rail(page: Page, id: string) {
  for (let i = 0; i < 8 && await page.locator("[data-testid='main-menu'].status-menu-detail-focus").count(); i++) {
    await page.keyboard.press("x");
  }
  for (let i = 0; i < 8; i++) {
    if (await page.locator(`[data-testid='status-menu-command-${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(`status-menu-command-${id}`)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

/* keyBindings.ts 계약: "메뉴(menu) : X · Esc — 필드에서 메뉴 열기/닫기는 취소와 같은 키다".
 * 즉 취소 키를 무작정 반복하면 닫은 뒤 다시 열린다. 한 번 누르고 사라졌는지 확인하고,
 * 남아 있으면(하위 화면이라 back 만 된 경우) 다시 한 번만 누른다. */
async function closeMenu(page: Page) {
  for (let i = 0; i < 10; i++) {
    if (!(await page.getByTestId("main-menu").count())) return;
    await page.keyboard.press("Escape");
    // 닫힘이 반영될 틈을 준 뒤 상태로 판단한다 — 눌린 횟수를 세지 않는다.
    await page.getByTestId("main-menu").waitFor({ state: "detached", timeout: 1_500 }).catch(() => {});
  }
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
}

async function choose(page: Page, id: string) {
  for (let i = 0; i < 24; i++) {
    if (await page.locator(`[data-testid='${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(id)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

test("생활 원장을 실제 메뉴로 열고 저장 슬롯까지 도달한다", async ({ page }) => {
  const errors = await boot(page);

  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await shot(page, "01-main-menu");

  // 기록 그룹 -> 생활 원장. 주입 엣지로는 7회 열리지 않았던 지점이다.
  await rail(page, "record-menu");
  await shot(page, "02-record-group-open");
  await expect(page.getByTestId("status-menu-group-command-life-ledger")).toBeVisible({ timeout: 20_000 });

  await choose(page, "status-menu-group-command-life-ledger");
  await expect(page.getByTestId("life-ledger-tab-shipping")).toBeVisible({ timeout: 20_000 });
  await shot(page, "03-life-ledger-shipping");

  // 시스템 그룹 -> 저장. 로드도 같은 그룹에 있다.
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await shot(page, "04-system-group-open");
  await expect(page.getByTestId("status-menu-group-command-save")).toBeVisible({ timeout: 20_000 });

  await choose(page, "status-menu-group-command-save");
  await expect(page.getByTestId("save-slot-1")).toBeVisible({ timeout: 20_000 });
  await shot(page, "05-save-slots");

  expect(errors, "player console/page errors").toEqual([]);
  await appendFile(`${OUT}/SUMMARY.md`, "\n- 생활 원장 + 저장 슬롯 도달: 실제 키 입력\n");
});

test("출하 투입 -> 수면 정산 -> 저장 -> 로드 재개를 실제 메뉴로 증명한다", async ({ page }) => {
  const errors = await boot(page);

  // 1) 출하함에 실제로 넣는다. 야생 부추는 픽스처 시작 재고에 있다.
  await page.keyboard.press("x");
  await rail(page, "record-menu");
  await choose(page, "status-menu-group-command-life-ledger");
  await expect(page.getByTestId("life-ledger-tab-shipping")).toBeVisible({ timeout: 20_000 });

  // 상세 항목은 onActivate 기반이라 키보드로 결정한다(.click 은 대상이 아니다 — 실측: 타임아웃).
  await expect(page.getByTestId("life-ledger-shipping-deposit-item_wild_leek")).toBeVisible({ timeout: 20_000 });
  await choose(page, "life-ledger-shipping-deposit-item_wild_leek");
  // 투입 성공의 제품측 증거: 꺼내기 항목이 생긴다.
  await expect(page.getByTestId("life-ledger-shipping-withdraw-item_wild_leek")).toBeVisible({ timeout: 20_000 });
  await shot(page, "10-deposited");

  const goldBefore = (await page.getByTestId("status-menu-gold").textContent()) ?? "";

  // 2) 메뉴를 닫고 잠자리에서 하루를 넘긴다 — 정산은 날짜 전환에 일어난다.
  await closeMenu(page);
  // 실측: 침대 ev_bed 는 map_farming_demo (3,3) 이다. 앞서 map_farm/(5,3) 으로 추측해
  // 텔레포트가 조용히 실패했고, gameTime 전체 비교가 minute 0->1 을 하루 전환으로 오인했다.
  await page.evaluate(() => {
    const w = window as unknown as { __oprnDebug?: { teleport?: (m: string, x: number, y: number) => void } };
    w.__oprnDebug?.teleport?.("map_farming_demo", 3, 4);
  });
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("z");
  // 잠자리 확인 대사를 넘긴다.
  for (let i = 0; i < 6; i++) await page.keyboard.press("z");
  // 하루가 실제로 넘어가야 한다.
  const before = await page.evaluate(() => {
    const s = (window as QaWindow).__oprnDebug?.readState() as { gameTime?: Record<string, number>; gold?: number } | undefined;
    return { gameTime: s?.gameTime, gold: s?.gold };
  });
  console.log("BEFORE_SLEEP=" + JSON.stringify(before));
  // 하루가 넘어가면 gameTime 이 바뀐다 — 필드명을 추측하지 않고 스냅샷 전체를 비교한다.
  // minute 이 흐르는 것은 하루 전환이 아니다 — day 자체가 늘어야 한다.
  await page.waitForFunction((prevDay) => {
    const s = (window as QaWindow).__oprnDebug?.readState() as { gameTime?: { day?: number } } | undefined;
    return typeof s?.gameTime?.day === "number" && s.gameTime.day > prevDay;
  }, before.gameTime?.day ?? 1, { timeout: 60_000 });
  const after = await page.evaluate(() => {
    const s = (window as QaWindow).__oprnDebug?.readState() as { gameTime?: Record<string, number>; gold?: number } | undefined;
    return { gameTime: s?.gameTime, gold: s?.gold };
  });
  console.log("AFTER_SLEEP=" + JSON.stringify(after));
  await shot(page, "11-after-sleep");

  // 3) 정산 결과: 골드가 늘어야 한다.
  await page.keyboard.press("x");
  const goldAfter = (await page.getByTestId("status-menu-gold").textContent()) ?? "";
  expect(goldAfter, `정산 전 ${goldBefore} -> 후 ${goldAfter}`).not.toBe(goldBefore);
  await shot(page, "12-settled-gold");

  // 4) 저장한다.
  await rail(page, "system-menu");
  // 저장 전에 로드 칸이 비활성(빈 칸)이어야 한다 — 남은 상태로 통과하는 것을 막는다.
  await choose(page, "status-menu-group-command-load");
  // disabled 는 DOM 속성이 아니다(playerStatusMenu.ts:380 은 onActivate 연결만 건너뛴다).
  // 제품이 실제로 보여주는 문자열로 확인한다: 저장 전에는 "비어 있음".
  await expect(page.getByTestId("load-slot-1")).toContainText("비어 있음", { timeout: 20_000 });
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-save");
  await expect(page.getByTestId("save-slot-1")).toBeVisible({ timeout: 20_000 });
  await choose(page, "save-slot-1");
  await shot(page, "13-saved");

  // 5) 같은 세션에서 로드로 재개한다. 슬롯이 present 여야 활성화된다.
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-load");
  // 저장 후에는 같은 칸이 "저장됨"으로 바뀌어야 한다 — 내 저장이 원인임을 못박는다.
  await expect(page.getByTestId("load-slot-1")).toContainText("저장됨", { timeout: 20_000 });
  await choose(page, "load-slot-1");
  // 재개 후 플레이가 다시 살아야 한다.
  await expect(page.getByTestId("main-menu")).toHaveCount(0, { timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as QaWindow).__oprnDebug?.readState().currentMapId), null, { timeout: 60_000 });
  await shot(page, "14-resumed");

  expect(errors, "player console/page errors").toEqual([]);
  await appendFile(`${OUT}/SUMMARY.md`, `\n- 출하 투입 -> 정산(${goldBefore} -> ${goldAfter}) -> 저장 -> 로드 재개\n`);
});

/* 51행 커버리지: 생활 장부 9탭은 K(출하)·L(기술/제작/꾸러미)·A(동물)·S(건물)·수집·박물관·복구
 * 행들이 실제로 렌더되는 표면이다. 탭마다 내용이 실제로 그려지는지 확인하고 증거를 남긴다.
 * recovery 탭은 세션 클레임이 없으면 나타나지 않을 수 있어 존재 여부를 실측해 기록한다. */
const LEDGER_TABS = [
  ["shipping", "출하"], ["bundles", "꾸러미"], ["skills", "기술"], ["makers", "가공 설비"],
  ["animals", "동물 돌봄"], ["spaces", "건물·꾸미기"], ["collections", "수집 도감"],
  ["museum", "박물관"], ["recovery", "복구"],
] as const;

test("생활 장부 9탭이 실제 플레이 화면에서 내용을 렌더한다", async ({ page }) => {
  const errors = await boot(page);
  await page.keyboard.press("x");
  await rail(page, "record-menu");
  await choose(page, "status-menu-group-command-life-ledger");
  await expect(page.getByTestId("life-ledger-tab-shipping")).toBeVisible({ timeout: 20_000 });

  const seen: Record<string, string> = {};
  for (const [id, label] of LEDGER_TABS) {
    const tab = page.getByTestId(`life-ledger-tab-${id}`);
    if (!(await tab.count())) { seen[id] = "탭 없음(해당 데이터 없음)"; continue; }
    // force 클릭은 탭을 바꾸지 못한다(실측: 8개 탭이 전부 출하 내용으로 남았고, 강화한
    // aria-selected 단정이 "꾸러미 미선택"으로 잡아냈다). 탭은 actionIndex 를 가진
    // status-menu-detail-action 이므로 커서 이동 + 확인 키로 고른다.
    await choose(page, `life-ledger-tab-${id}`);
    await expect(tab, `${label} 미선택`).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
    // 패널은 testid 가 아니라 id 로 식별된다(playerStatusMenuDetailRenderer.ts:92,101).
    const panel = page.locator("#life-ledger-tab-panel");
    const text = ((await panel.innerText()) ?? "").replace(/\s+/g, " ").trim();
    // 탭 목록은 패널 밖이므로 여기 텍스트는 그 탭의 실제 내용이다.
    expect(text.length, `${label} 내용 없음`).toBeGreaterThan(0);
    seen[id] = text.slice(0, 80);
    await shot(page, `20-ledger-${id}`);
  }

  await appendFile(`${OUT}/SUMMARY.md`, `\n## 생활 장부 탭 실측\n${LEDGER_TABS.map(([id, l]) => `- ${l}(${id}): ${seen[id] ?? "미확인"}`).join("\n")}\n`);
  await writeFile(`${OUT}/ledger-tabs.json`, JSON.stringify(seen, null, 2));
  expect(errors, "player console/page errors").toEqual([]);
});

/* R 계열(주민/관계) 행은 기록 그룹의 관계 화면이 실제 표면이다. 픽스처에는 촌장·광부·
 * 목수·약초사가 있고 friendship 이 세션에 들어간다. */
test("주민 관계 화면이 실제 플레이에서 인물과 친밀도를 렌더한다", async ({ page }) => {
  const errors = await boot(page);
  await page.keyboard.press("x");
  await rail(page, "record-menu");
  await choose(page, "status-menu-group-command-relationships");

  const panel = page.getByTestId("status-menu-detail");
  await expect(panel).toBeVisible({ timeout: 20_000 });
  // 실측: 시작 세션은 "알려진 관계가 없습니다 / 호감이 기록된 관계만 표시됩니다".
  // 제품이 옳다 — 빈 상태를 정직하게 보여준다. 그러니 먼저 실제로 관계를 만든다.
  const empty = ((await panel.innerText()) ?? "").replace(/\s+/g, " ").trim();
  expect(empty, "빈 상태 문구가 아니다").toContain("관계");
  await shot(page, "30-relationships-empty");

  // 촌장에게 말을 건다(ev_npc_mayor @14,5 → changeFriendship).
  await closeMenu(page);
  await page.evaluate(() => {
    const w = window as unknown as { __oprnDebug?: { teleport?: (m: string, x: number, y: number) => void } };
    w.__oprnDebug?.teleport?.("map_farming_demo", 14, 6);
  });
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("z");
  // 실측: 촌장 대사가 실제로 열린다("밭은 잘 돌아가나?"). 대사창이 남아 있으면 메뉴 키가
  // 대사로 먹히므로, 눌린 횟수가 아니라 대사창이 사라진 것을 조건으로 삼는다.
  // 실측: 촌장 상호작용은 단순 대사가 아니라 선택지 메뉴다 — 대화하기 / 선물하기 / 취소.
  // 앞선 z 연타는 이 메뉴를 지나쳐 다른 분기를 탔다. 첫 항목이 이미 선택돼 있으므로
  // 확인 키 한 번으로 "대화하기"를 고른다.
  await expect(page.getByText("대화하기")).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("z");
  // 이어지는 대사를 끝까지 넘긴다 — 남은 대사창이 있으면 메뉴 키가 대사로 먹힌다.
  for (let i = 0; i < 12; i++) {
    if (!(await page.getByTestId("dialogue-speaker").count())) break;
    await page.keyboard.press("z");
    await page.getByTestId("dialogue-speaker").waitFor({ state: "detached", timeout: 1_500 }).catch(() => {});
  }
  await expect(page.getByTestId("dialogue-speaker")).toHaveCount(0);

  await page.keyboard.press("x");
  await rail(page, "record-menu");
  await choose(page, "status-menu-group-command-relationships");
  const text = ((await page.getByTestId("status-menu-detail").innerText()) ?? "").replace(/\s+/g, " ").trim();
  // 대화 뒤에는 그 주민이 실제로 목록에 올라와야 한다.
  expect(text, "대화 후에도 촌장이 관계 목록에 없다").toContain("촌장");
  await shot(page, "30-relationships");
  await writeFile(`${OUT}/relationships.txt`, text);

  // 퀘스트도 같은 그룹이다(L0/기록 계열).
  await page.keyboard.press("x");
  await rail(page, "record-menu");
  await choose(page, "status-menu-group-command-quests");
  await expect(page.getByTestId("status-menu-detail")).toBeVisible({ timeout: 20_000 });
  await shot(page, "31-quests");

  expect(errors, "player console/page errors").toEqual([]);
  await appendFile(`${OUT}/SUMMARY.md`, `\n- 관계 화면: ${text.slice(0, 90)}\n`);
});
