import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";
import { seedProjectForEditor } from "./projectSeed";

/**
 * AI 이벤트 작업함 화면 증거(진단 스펙 — 기본 스위트 제외).
 *
 *   DEV_SERVER_PORT=9926 npx playwright test test/e2e/_event-ai-queue-shots.spec.ts
 *
 * LLM 엔드포인트는 가로챈다. 응답은 요청 문장에서 이벤트 JSON 을 지어내고, 문장마다 다른 시간만큼
 * 붙잡아 두어 **여러 작업이 실제로 겹쳐 도는** 모습을 찍는다. 실패 한 건(없는 아이템)도 섞는다.
 * 결과: verify-shots/event-ai-queue/*.png + SUMMARY.json
 */
const SHOT_DIR = "verify-shots/event-ai-queue";

test.setTimeout(240_000);

type Spot = { readonly x: number; readonly y: number; readonly prompt: string };

const SPOTS: readonly Spot[] = [
  { x: 2, y: 4, prompt: "열면 회복약 2개를 주고, 이미 열었으면 «비어 있다»고 말한다" },
  { x: 4, y: 4, prompt: "마을 소문을 한 줄 말하는 주민" },
  { x: 6, y: 4, prompt: "«북쪽: 숲 / 동쪽: 항구» 표지판" },
  { x: 8, y: 4, prompt: "처음 말 걸면 인사하고, 두 번째부터는 «또 왔군» 이라고만 말하는 노인" },
  { x: 2, y: 8, prompt: "마을 소문을 한 줄 말하는 아이" },
  { x: 4, y: 8, prompt: "열면 회복약 1개를 주는 작은 상자" },
  { x: 6, y: 8, prompt: "«우물 물은 맑다» 표지판" },
  { x: 8, y: 8, prompt: "열면 별빛 해독약을 주는 상자" },
];

function eventFor(prompt: string): unknown {
  if (prompt.includes("해독약")) {
    return { name: "해독약 상자", pages: [{ name: "처음", graphic: "charset:tex_easyrpg_charset_object1:6", trigger: "action", priority: "same", conditions: [],
      commands: [{ kind: "changeItem", itemId: "item_star_antidote", op: "+=", amount: 1 }] }] };
  }
  if (prompt.includes("상자") || prompt.includes("회복약")) {
    return {
      name: prompt.includes("2개") ? "보물상자" : "작은 상자",
      pages: [
        { name: "처음 열 때", graphic: "charset:tex_easyrpg_charset_object1:6", trigger: "action", priority: "same", conditions: [],
          commands: [
            { kind: "text", body: "상자를 열었다. 회복약이 들어 있다.", speaker: "" },
            { kind: "changeItem", itemId: "item_potion", op: "+=", amount: prompt.includes("2개") ? 2 : 1 },
            { kind: "setSelfSwitch", key: "A", value: true },
          ] },
        { name: "이미 열었음", graphic: "charset:tex_easyrpg_charset_object1:6", trigger: "action", priority: "same",
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          commands: [{ kind: "text", body: "비어 있다.", speaker: "" }] },
      ],
    };
  }
  if (prompt.includes("표지판")) {
    const body = prompt.match(/«(.+)»/u)?.[1] ?? "안내문";
    return { name: "표지판", pages: [{ name: "읽기", graphic: "none", trigger: "action", priority: "same", conditions: [],
      commands: [{ kind: "text", body, speaker: "" }] }] };
  }
  if (prompt.includes("노인")) {
    return {
      name: "노인",
      pages: [
        { name: "첫 만남", graphic: "charset:tex_easyrpg_charset_people1:4", trigger: "action", priority: "same", conditions: [],
          commands: [{ kind: "text", body: "처음 보는 얼굴이군. 어서 오게.", speaker: "노인" }, { kind: "setSelfSwitch", key: "A", value: true }] },
        { name: "다시 만남", graphic: "charset:tex_easyrpg_charset_people1:4", trigger: "action", priority: "same",
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          commands: [{ kind: "text", body: "또 왔군.", speaker: "노인" }] },
      ],
    };
  }
  return { name: prompt.includes("아이") ? "아이" : "주민", pages: [{ name: "대화", graphic: "charset:tex_easyrpg_charset_people1:" + (prompt.includes("아이") ? 6 : 1), trigger: "action", priority: "same", conditions: [],
    commands: [{ kind: "text", body: "요즘 숲에서 늑대 소리가 들려요.", speaker: "" }] }] };
}

function delayFor(prompt: string): number {
  let hash = 0;
  for (const char of prompt) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 1800 + (hash % 5) * 900;
}

const calls: { prompt: string; startedAt: number; endedAt: number }[] = [];

async function mockLlm(page: Page): Promise<void> {
  await page.route("**/chat/completions", async (route: Route) => {
    const body = route.request().postDataJSON() as { messages?: { role: string; content: string }[] };
    const user = body.messages?.find((message) => message.role === "user")?.content ?? "";
    const startedAt = Date.now();
    await new Promise((resolve) => setTimeout(resolve, delayFor(user)));
    calls.push({ prompt: user, startedAt, endedAt: Date.now() });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(eventFor(user)) }, finish_reason: "stop" }] }),
    });
  });
}

/**
 * 빈 프로젝트는 **브라우저 안에서** 만든다. 스펙 프로세스에서 createBlankProject 를 import 하면 앱 모듈
 * 그래프의 JSON 자산이 import attribute 없이 로드돼 스펙이 아예 뜨지 않는다(event-layer-ai-author.spec.ts 머리말).
 */
async function probeProject(page: Page): Promise<unknown> {
  await page.goto("/");
  return page.evaluate(async () => {
    const mod = (await import("/src/project/defaults.ts")) as typeof import("@/project/defaults");
    const project = mod.createBlankProject();
    project.meta = { ...project.meta, title: "작업함 증거" };
    return JSON.parse(JSON.stringify(project));
  });
}

async function tileCenter(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  // EditScene 이 카메라 해석기를 등록할 때까지 기다린다(씬 create 는 부팅보다 늦다).
  // waitForFunction 은 async 술어의 Promise 를 참으로 봐서 null 을 돌려줄 수 있다 — 직접 돈다.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const point = await page.evaluate(async ({ x, y }) => {
      const mod = (await import("/src/editor/regionClientRect.ts")) as typeof import("@/editor/regionClientRect");
      const rect = mod.resolveRegionClientRect({ x, y, width: 1, height: 1 });
      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    }, { x, y });
    if (point) return point;
    await page.waitForTimeout(250);
  }
  throw new Error("tile resolver missing");
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: SHOT_DIR + "/" + name + ".png" });
}

test("작업함: 여러 칸을 연달아 맡기고, 동시에 만들어지고, 몰아서 확인·배치한다", async ({ page }) => {
  await mkdir(SHOT_DIR, { recursive: true });
  await mockLlm(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-ai-queue");
    window.localStorage.setItem("oprn:editor-ui-mode", "standard");
    window.localStorage.setItem("oprn:ai-config", JSON.stringify({ version: 2, authMode: "chatgpt", model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash" }));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const project = await probeProject(page);
  await seedProjectForEditor(page, project);
  await page.getByTestId("layer-event").click();

  // 1. 우클릭 메뉴 — AI 항목이 맨 위, 단축키 A.
  const first = SPOTS[0]!;
  const p0 = await tileCenter(page, first.x, first.y);
  await page.mouse.click(p0.x, p0.y, { button: "right" });
  const menuItem = page.getByTestId("event-layer-event-ai-queue");
  await expect(menuItem).toBeVisible();
  await shoot(page, "01-context-menu");

  // 2. 칸 옆 한 줄 입력창 — 편집기가 뜨지 않고 맵이 보인다.
  await page.keyboard.press("a");
  const input = page.getByTestId("event-ai-prompt-input");
  await expect(input).toBeFocused();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await input.fill(first.prompt);
  await shoot(page, "02-prompt-popover");
  await input.press("Enter");

  // 3. 나머지 칸을 기다리지 않고 연달아 맡긴다.
  for (const spot of SPOTS.slice(1)) {
    const point = await tileCenter(page, spot.x, spot.y);
    await page.mouse.click(point.x, point.y, { button: "right" });
    await page.keyboard.press("a");
    await expect(input).toBeFocused();
    await input.fill(spot.prompt);
    await input.press("Enter");
  }
  await expect(page.getByTestId("event-ai-job")).toHaveCount(SPOTS.length);
  const runningSoon = await page.locator('[data-testid="event-ai-job"][data-state="running"]').count();
  await shoot(page, "03-many-running");

  // 4. 끝난 것부터 확인 대기로 올라온다. 해독약은 없는 아이템이라 막힌다.
  await expect(page.locator('[data-testid="event-ai-job"][data-state="ready"]')).toHaveCount(SPOTS.length - 1, { timeout: 60_000 });
  await expect(page.locator('[data-testid="event-ai-job"][data-state="failed"]')).toHaveCount(1, { timeout: 60_000 });
  await page.locator('[data-testid="event-ai-job"][data-state="ready"]').first().click();
  await shoot(page, "04-review-card");

  // 5. 키보드로 훑고 Enter 로 하나 배치.
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="event-ai-job"][data-state="placed"]')).toHaveCount(1);
  await shoot(page, "05-placed-one");

  // 6. 나머지를 한 번에 배치.
  await page.getByTestId("event-ai-place-all").click();
  await expect(page.locator('[data-testid="event-ai-job"][data-state="placed"]')).toHaveCount(SPOTS.length - 1);
  await page.locator('[data-testid="event-ai-job"][data-state="failed"]').click();
  await shoot(page, "06-all-placed-one-blocked");

  // 7. 맵에 실제로 들어갔는지 스토어로 확인한다(페이지 수·셀프 스위치 조건 포함).
  const placed = await page.evaluate(async () => {
    const mod = (await import("/src/project/store.ts")) as typeof import("@/project/store");
    const project = mod.store.getCurrent();
    const map = project.maps[project.startMapId]!;
    return map.events.map((event) => ({
      name: event.name, x: event.x, y: event.y, pages: event.pages?.length ?? 0,
      secondPageCondition: event.pages?.[1]?.conditions?.[0] ?? null,
      sprite: event.pages?.[0]?.graphic?.sprite?.id ?? null,
    }));
  });
  expect(placed).toHaveLength(SPOTS.length - 1);
  const chest = placed.find((event) => event.name === "보물상자");
  expect(chest?.pages).toBe(2);
  expect(chest?.secondPageCondition).toEqual({ kind: "selfSwitch", key: "A", value: true });

  // 8. 되돌리기 한 번은 마지막 배치 하나만 되돌린다. 캔버스를 클릭하면 그 클릭 자체가 편집이 될 수 있어
  //    히스토리 API 를 직접 한 번 부른다(Ctrl+Z 와 같은 함수 — hotkeys.ts runUndoWithFeedback → undoMapEdit).
  const undo = await page.evaluate(async () => {
    const store = ((await import("/src/project/store.ts")) as typeof import("@/project/store")).store;
    const history = (await import("/src/editor/mapEditHistory.ts")) as typeof import("@/editor/mapEditHistory");
    const count = () => store.getCurrent().maps[store.getCurrent().startMapId]!.events.length;
    const before = count();
    const names = () => store.getCurrent().maps[store.getCurrent().startMapId]!.events.map((event) => event.name);
    const namesBefore = names();
    history.undoMapEdit();
    const namesAfter = names();
    return { before, after: count(), removed: namesBefore.filter((name, index) => namesAfter[index] !== name) };
  });
  expect(undo.after).toBe(undo.before - 1);
  const afterUndo = undo;

  const overlaps = calls.filter((a) => calls.some((b) => b !== a && b.startedAt < a.endedAt && a.startedAt < b.endedAt)).length;
  const maxParallel = Math.max(...calls.map((a) => calls.filter((b) => b.startedAt <= a.startedAt && a.startedAt < b.endedAt).length));
  await writeFile(SHOT_DIR + "/SUMMARY.json", JSON.stringify({
    jobs: SPOTS.length, llmCalls: calls.length, runningRightAfterQueueing: runningSoon, maxParallelCalls: maxParallel,
    callsThatOverlappedAnother: overlaps, placedEvents: placed, eventsAfterOneUndo: afterUndo,
  }, null, 2));
  expect(maxParallel).toBeGreaterThan(1);
});
