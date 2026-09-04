/**
 * 개념 꾸러미 여관 — **실제 에디터**에서 내장 조수에게 「여관 지어줘」라고 시킨다. 진단·증거 스펙(`_` 접두).
 *
 * 무엇을 증명하나:
 *  1. 조수가 핀 없이 `place_concept` 에 닿아 여관 맵을 만든다(실제 모델 턴, 감사 로그로 관측).
 *  2. 만들어진 맵이 에디터 캔버스에 그려진다(스크린샷).
 *  3. 사람이 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 나무를 고치면(주막 개명·피아노 삭제·객실 책장) 다음 요청이 그 나무를 따른다.
 *  4. 칩이 런타임에서 작동한다 — 테스트 플레이로 침대 앞에서 조사하면 여관(inn) 창이 뜬다.
 *
 * 실행(인증 파일 경로 필수 — 에이전트 셸 HOME 이 다를 수 있다):
 *   RPG_ZZU_OH_MY_PI_AUTH_PATH=/home/main/.rpg-zzu/oh-my-pi-auth.json DEV_SERVER_PORT=9877 \
 *   npx playwright test test/e2e/_place-concept-inn-evidence.spec.ts --project=chromium --workers=1
 * 산출: reports/place-concept-inn/e2e/*.png + receipt.json (보고서 생성기가 읽는다).
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "./oprn-database-helpers";
import { startNewGameFromTitle } from "./runtimeInput";

const OUT_DIR = path.resolve(process.env.SHOT_DIR ?? "reports/place-concept-inn/e2e");
mkdirSync(OUT_DIR, { recursive: true });

const INTERIOR_TILESET_ID = "easyrpg_chipset_interior";
const INSTRUCTION_INN = "여관 지어줘";
// 「주막 만들어줘」는 이미 여관 맵이 있으면 모델이 「기존 맵을 주막으로 단장」으로 읽었다(2026-09-02 1차 실측:
// furnish_interior_space ×4 + NPC). 고친 나무로 **새 맵**을 짓게 하려면 그 뜻을 문장에 둔다.
const INSTRUCTION_TAVERN = "주막을 새 맵으로 지어줘";

type AuditEntry = { readonly kind: string; readonly name?: string; readonly summary?: string; readonly text?: string };
type TurnResult = { readonly ok: boolean; readonly error?: string; readonly audit: readonly AuditEntry[]; readonly lastAssistantText?: string };
type ProjectView = {
  readonly maps: Record<string, {
    readonly name: string;
    readonly tilesetId: string;
    readonly width: number;
    readonly height: number;
    readonly events: readonly { readonly id: string; readonly x: number; readonly y: number; readonly pages?: readonly { readonly name?: string; readonly commands: readonly { readonly kind: string }[] }[] }[];
  }>;
  readonly startMapId: string;
};

async function bootEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ maxToolCalls: 40, maxTokens: 32768, agentMode: "chat" }));
  });
  await page.setViewportSize({ width: 1440, height: 980 });
  // 브라우저 confirm() 은 기본적으로 취소된다 — 닫기 확인 같은 물음은 승낙한다.
  page.on("dialog", (dialog) => { void dialog.accept(); });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible().catch(() => false)) await start.click();
}

function readProject(page: Page): Promise<ProjectView> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: unknown } } }).__oprnProjectE2E;
    if (!hook) throw new Error("window.__oprnProjectE2E 미등록");
    const project = hook.currentProject().project as ProjectView;
    const maps: ProjectView["maps"] = {};
    for (const [id, map] of Object.entries(project.maps)) {
      maps[id] = {
        name: map.name,
        tilesetId: map.tilesetId,
        width: map.width,
        height: map.height,
        events: (map.events ?? []).map((event) => ({
          id: event.id,
          x: event.x,
          y: event.y,
          pages: (event.pages ?? []).map((entry) => ({ name: entry.name, commands: entry.commands.map((command) => ({ kind: command.kind })) })),
        })),
      };
    }
    return { maps, startMapId: project.startMapId };
  });
}

/** 감사 로그는 세션 누적이다 — 이 턴에서 새로 생긴 항목만 돌려준다. */
function sendToAssistant(page: Page, text: string): Promise<TurnResult> {
  return page.evaluate(async (prompt: string) => {
    const bridge = (window as unknown as { __oprnAiBridge?: { send: (value: string) => Promise<unknown>; audit: () => readonly unknown[] } }).__oprnAiBridge;
    if (!bridge) throw new Error("window.__oprnAiBridge 미등록");
    const before = bridge.audit().length;
    const result = (await bridge.send(prompt)) as TurnResult;
    return {
      ok: result.ok,
      error: result.error,
      lastAssistantText: result.lastAssistantText,
      audit: result.audit.slice(before).map((entry) => ({ kind: entry.kind, name: entry.name, summary: entry.summary, text: entry.text?.slice(0, 600) })),
    };
  }, text);
}

/** 캔버스 증거 사진에는 조수 패널을 잠시 숨긴다(맵을 가린다). */
async function canvasShot(page: Page, file: string): Promise<void> {
  await page.evaluate(() => {
    for (const node of document.querySelectorAll<HTMLElement>(".ai-chat-panel, [data-testid='chat-float-host']")) node.style.visibility = "hidden";
  });
  await page.waitForTimeout(300);
  await page.getByTestId("edit-canvas").screenshot({ path: file, animations: "disabled" });
  await page.evaluate(() => {
    for (const node of document.querySelectorAll<HTMLElement>(".ai-chat-panel, [data-testid='chat-float-host']")) node.style.visibility = "";
  });
}

function runEditorTool(page: Page, name: string, args: Record<string, unknown>): Promise<unknown> {
  return page.evaluate(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
    const run = (window as unknown as { __oprnEditorTool?: (n: string, a: Record<string, unknown>) => unknown }).__oprnEditorTool;
    if (!run) throw new Error("window.__oprnEditorTool 미등록");
    return run(toolName, toolArgs);
  }, { toolName: name, toolArgs: args });
}

async function openDatabaseAnyMode(page: Page): Promise<void> {
  // 전문가 모드는 툴바 버튼, 기본/표준 모드는 도구 메뉴 → 데이터베이스….
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await openDatabase(page);
    return;
  }
  await page.getByTestId("menu-tools").click();
  await page.getByTestId("menu-tools-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible({ timeout: 15_000 });
}

async function openConceptTab(page: Page): Promise<void> {
  await openDatabaseAnyMode(page);
  const tab = page.getByTestId("db-tab-scratch-concepts");
  if (!(await tab.isVisible().catch(() => false))) {
    const group = page.getByTestId("db-tab-group-world");
    if (await group.count()) await group.click();
  }
  await tab.click({ force: true });
  await page.getByTestId(`scratch-concept-tileset-${INTERIOR_TILESET_ID}`).click();
  await expect(page.getByTestId("scratch-concept-board")).toBeVisible();
}

async function closeDatabase(page: Page): Promise<void> {
  // 세션에 변경이 있으면 닫기가 「저장하고 닫기 / 되돌리고 닫기 / 계속 편집」을 묻는다 — 저장하고 닫는다.
  await page.getByTestId("database-modal-close").click();
  const save = page.getByTestId("database-dirty-save");
  if (await save.isVisible({ timeout: 1_500 }).catch(() => false)) await save.click();
  await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 15_000 });
}

async function selectMapInTree(page: Page, mapId: string): Promise<void> {
  const node = page.getByTestId(`map-tree-node-${mapId}`);
  await expect(node).toBeVisible({ timeout: 15_000 });
  await node.click({ force: true });
  await page.waitForTimeout(1800);
}

function toolEntries(turn: TurnResult): { name: string; summary: string }[] {
  return turn.audit.filter((entry) => entry.kind === "tool").map((entry) => ({ name: entry.name ?? "", summary: entry.summary ?? "" }));
}

function newMapIds(before: ProjectView, after: ProjectView, tilesetId: string): string[] {
  return Object.keys(after.maps).filter((id) => !(id in before.maps) && after.maps[id]!.tilesetId === tilesetId);
}

test.describe("개념 꾸러미 여관 — 실제 조수 턴", () => {
  test.describe.configure({ timeout: 1_200_000 });

  test("조수가 place_concept 로 여관을 짓고, 고친 나무로 주막을 짓고, 침대에서 여관 창이 뜬다", async ({ page }) => {
    const auth = await page.request.get("/auth/status").then((res) => res.json() as Promise<{ connected: boolean; provider: string }>);
    expect(auth.connected, `조수 인증이 없다 — /auth/status ${JSON.stringify(auth)}`).toBe(true);

    await bootEditor(page);
    console.log("[inn-e2e] editor booted");
    const receipt: Record<string, unknown> = { provider: auth.provider, startedAt: new Date().toISOString(), instructions: [INSTRUCTION_INN, INSTRUCTION_TAVERN] };
    const flush = (): void => writeFileSync(path.join(OUT_DIR, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    try {

    // 1) 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」 — 초안 나무.
    await openConceptTab(page);
    await page.getByTestId("database-modal").screenshot({ path: path.join(OUT_DIR, "01-db-concept-tab.png"), animations: "disabled" });
    await closeDatabase(page);
    console.log("[inn-e2e] concept tab shot done");

    // 2) 「여관 지어줘」 — 실제 모델 턴.
    const before = await readProject(page);
    const t0 = Date.now();
    const innTurn = await sendToAssistant(page, INSTRUCTION_INN);
    const innElapsed = Date.now() - t0;
    const afterInn = await readProject(page);
    const innTools = toolEntries(innTurn);
    const innMapIds = newMapIds(before, afterInn, INTERIOR_TILESET_ID);
    receipt.innTurn = { elapsedMs: innElapsed, ok: innTurn.ok, error: innTurn.error, tools: innTools, assistantText: innTurn.lastAssistantText, newMaps: innMapIds };
    await page.screenshot({ path: path.join(OUT_DIR, "02-chat-after-inn.png"), animations: "disabled" });
    console.log(`[inn-e2e] inn turn ${innElapsed}ms tools=${innTools.map((entry) => entry.name).join(",")} newMaps=${innMapIds.join(",")}`);

    expect(innTools.some((entry) => entry.name === "place_concept"), `place_concept 호출 없음 — 호출: ${innTools.map((entry) => entry.name).join(",")}`).toBe(true);
    expect(innMapIds.length, "실내 칩셋 새 맵이 없다").toBeGreaterThan(0);
    const innMapId = innMapIds[0]!;
    const innMap = afterInn.maps[innMapId]!;
    receipt.innMap = { id: innMapId, name: innMap.name, size: `${innMap.width}x${innMap.height}`, events: innMap.events.map((event) => `${event.pages?.[0]?.name ?? event.id}@${event.x},${event.y}`) };

    await selectMapInTree(page, innMapId);
    await canvasShot(page, path.join(OUT_DIR, "03-editor-inn-canvas.png"));
    await page.screenshot({ path: path.join(OUT_DIR, "03b-editor-inn-full.png"), animations: "disabled" });

    // 3) 사람이 나무를 고친다 — 주막 개명, 피아노 삭제, 객실에 책장.
    await openConceptTab(page);
    const facilityName = page.getByTestId("scratch-concept-facility-name");
    await facilityName.fill("주막");
    await facilityName.press("Enter");
    await facilityName.dispatchEvent("change");
    await page.getByTestId("scratch-concept-thing-piano").click();
    await page.getByTestId("scratch-concept-thing-remove").click();
    await page.getByTestId("scratch-concept-thing-add-bedroom").click();
    await page.getByTestId("scratch-concept-pick-bookshelf").click();
    await page.getByTestId("database-modal").screenshot({ path: path.join(OUT_DIR, "04-db-edited.png"), animations: "disabled" });
    await closeDatabase(page);

    // 4) 「주막 만들어줘」 — 고친 나무로.
    const t1 = Date.now();
    const tavernTurn = await sendToAssistant(page, INSTRUCTION_TAVERN);
    const tavernElapsed = Date.now() - t1;
    const afterTavern = await readProject(page);
    const tavernTools = toolEntries(tavernTurn);
    const tavernMapIds = newMapIds(afterInn, afterTavern, INTERIOR_TILESET_ID);
    console.log(`[inn-e2e] tavern turn ${tavernElapsed}ms tools=${tavernTools.map((entry) => entry.name).join(",")} newMaps=${tavernMapIds.join(",")}`);
    receipt.tavernTurn = { elapsedMs: tavernElapsed, ok: tavernTurn.ok, error: tavernTurn.error, tools: tavernTools, assistantText: tavernTurn.lastAssistantText, newMaps: tavernMapIds };
    expect(tavernTools.some((entry) => entry.name === "place_concept"), `주막: place_concept 호출 없음 — ${tavernTools.map((entry) => entry.name).join(",")}`).toBe(true);
    expect(tavernMapIds.length, "주막 새 맵이 없다").toBeGreaterThan(0);
    const tavernMapId = tavernMapIds[0]!;
    const tavernMap = afterTavern.maps[tavernMapId]!;
    receipt.tavernMap = { id: tavernMapId, name: tavernMap.name, size: `${tavernMap.width}x${tavernMap.height}`, events: tavernMap.events.map((event) => `${event.pages?.[0]?.name ?? event.id}@${event.x},${event.y}`) };
    const tavernHasPiano = tavernMap.events.some((event) => event.id.includes("_piano_"));
    receipt.tavernHasPianoEvent = tavernHasPiano;

    await selectMapInTree(page, tavernMapId);
    await canvasShot(page, path.join(OUT_DIR, "05-editor-tavern-canvas.png"));

    // 5) 런타임 — 여관 침대 앞에서 조사하면 여관(inn) 창.
    const bedEvent = innMap.events.find((event) => (event.pages ?? []).some((entry) => entry.commands.some((command) => command.kind === "inn")));
    expect(bedEvent, "여관 맵에 inn 이벤트(침대)가 없다").toBeDefined();
    const startResult = await runEditorTool(page, "set_start_position", { mapId: innMapId, x: bedEvent!.x, y: bedEvent!.y + 1 });
    receipt.startPosition = { mapId: innMapId, x: bedEvent!.x, y: bedEvent!.y + 1, result: startResult };
    await page.getByTestId("topbar-test-play").click();
    const playWindow = page.getByTestId("test-play-window");
    await expect(playWindow).toBeVisible({ timeout: 30_000 });
    await startNewGameFromTitle(page, { timeoutMs: 45_000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const input = (window as unknown as { __oprnInput?: { face: (d: string) => void; action: () => void } }).__oprnInput;
      if (!input) throw new Error("window.__oprnInput 미등록");
      input.face("up");
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      (window as unknown as { __oprnInput?: { action: () => void } }).__oprnInput?.action();
    });
    const innScene = page.getByTestId("inn-scene");
    await expect(innScene, "침대 앞 조사에 여관 창이 뜨지 않았다").toBeVisible({ timeout: 15_000 });
    await playWindow.screenshot({ path: path.join(OUT_DIR, "06-runtime-inn-scene.png"), animations: "disabled" });
    receipt.runtimeInnSceneShown = true;
    console.log("[inn-e2e] runtime inn scene shown");
    } finally {
      receipt.finishedAt = new Date().toISOString();
      flush();
    }
  });
});
