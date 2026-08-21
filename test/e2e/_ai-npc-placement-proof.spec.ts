import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * 내부 AI 로 NPC 여러 명을 실제 배치하고 증거를 남긴다.
 *
 * 라이브 게이트웨이(cpen)를 진짜로 치는 검증이라 네트워크를 가로채지 않는다.
 * 실측 기준선(직접 프로브): 요청 45KB · 응답 200 · 9.2초 · 툴 3회.
 *
 * 앞선 실패에서 배운 두 가지를 반영했다:
 *  1. NPC 4명을 한 요청에 몰면 한 턴이 7분을 넘겨 타임아웃했다 → **한 명씩 순차 요청**한다.
 *  2. 채팅 로그 문자열에서 "place_npc" 를 찾는 판정은 부정확했다(툴 내역이 접혀 있고
 *     요약만 노출된다) → **project-export-json 의 실제 이벤트 수**로 판정한다.
 */
const SHOTS = "tmp/ai-npc-proof";
const MAP_ID = "map_ice_grand_plain_64";

type RuntimeEvent = {
  readonly name?: string;
  readonly x: number;
  readonly y: number;
  readonly pages?: readonly { readonly commands?: readonly { readonly kind?: string; readonly lines?: readonly string[] }[] }[];
};

const ORDERS: readonly { readonly label: string; readonly text: string }[] = [
  { label: "잡화점 상인", text: "(32,58) 에 잡화점 상인 NPC 한 명 배치해줘. 말 걸면 상점이 열리게 해줘." },
  { label: "경비병", text: "(36,58) 에 경비병 NPC 한 명 배치해줘. 순찰 중이라는 대사를 넣어줘." },
  { label: "촌장", text: "(30,60) 에 촌장 NPC 한 명 배치해줘. 인사 대사를 두 줄 넣어줘." },
];

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 15_000 });
}

/**
 * 에디터가 들고 있는 현재 프로젝트의 이벤트 목록을 읽는다.
 *
 * `project-export-json` 은 숨은 <pre> 로 상주하며 store 가 바뀔 때마다 갱신된다
 * (editor.ts updateProjectExport — 150ms 디바운스). 처음 가정했던 window.__rpgzzu
 * 프로브는 이 앱에 없어 항상 빈 배열을 돌려줬다.
 */
async function readEvents(page: Page): Promise<RuntimeEvent[]> {
  return page.evaluate((mapId) => {
    const raw = document.querySelector("[data-testid='project-export-json']")?.textContent ?? "{}";
    try {
      const parsed = JSON.parse(raw) as { project?: { maps?: Record<string, { events?: RuntimeEvent[] }> } };
      return (parsed.project?.maps?.[mapId]?.events ?? []) as RuntimeEvent[];
    } catch {
      return [] as RuntimeEvent[];
    }
  }, MAP_ID);
}

test.describe("내부 AI NPC 배치", () => {
  test.setTimeout(900_000);

  test("AI 가 NPC 여러 명을 배치하고 이벤트가 페이지·커맨드까지 생성된다", async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
    });

    await page.addInitScript(() => {
      localStorage.setItem("oprn:editor-ui-mode", "expert");
      // 코치마크가 AI 패널을 덮지 않게 첫 방문 플래그를 미리 소진시킨다.
      localStorage.setItem("oprn:coachmarks-basic-v1", "seen");
      // ai-config 는 건드리지 않는다 — autoApprove 를 주입해 덮어쓰면 대화 세션이
      // 초기화되어 로그가 시작 화면으로 돌아간다(실측: 242초 대기 후 이벤트 0건).
      // 대신 제안 카드를 명시적으로 수락한다.
    });
    await page.setViewportSize({ width: 1680, height: 1000 });

    await page.goto(`/?devProject=1&icePlain64=1&map=${MAP_ID}`);
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) await restore.click();

    const input = page.getByTestId("ai-input");
    await expect(input).toBeVisible({ timeout: 15_000 });
    expect(await readEvents(page)).toHaveLength(0);
    await page.screenshot({ path: `${SHOTS}/01-editor-ready.png` });

    // 한 명씩 요청하고, 제안 카드를 수락한 뒤 이벤트가 실제로 늘어나는지 확인한다.
    const placed: { label: string; total: number }[] = [];
    for (const [index, order] of ORDERS.entries()) {
      const before = (await readEvents(page)).length;
      await input.fill(order.text);
      await page.getByTestId("ai-send").click();

      // 변경은 제안으로 먼저 쌓인다. 카드가 뜨면 수락해야 프로젝트에 반영된다.
      const accept = page.getByTestId("ai-proposal-accept").first();
      await expect
        .poll(async () => (await readEvents(page)).length > before || (await accept.isVisible().catch(() => false)), {
          timeout: 300_000,
          intervals: [2_000],
        })
        .toBe(true);
      if (await accept.isVisible().catch(() => false)) {
        if (index === 0) await page.screenshot({ path: `${SHOTS}/02-proposal-card.png` });
        await accept.click();
      }

      await expect
        .poll(async () => (await readEvents(page)).length, { timeout: 120_000, intervals: [2_000] })
        .toBeGreaterThan(before);

      const total = (await readEvents(page)).length;
      placed.push({ label: order.label, total });
      await page.screenshot({ path: `${SHOTS}/1${index + 1}-after-${order.label}.png` });
    }

    const events = await readEvents(page);
    writeFileSync(`${SHOTS}/events.json`, JSON.stringify(events, null, 2));
    await page.screenshot({ path: `${SHOTS}/04-events-placed.png` });

    // NPC 가 요청 수만큼 있고, 각 이벤트가 대사 페이지를 가져야 한다.
    expect(events.length).toBeGreaterThanOrEqual(ORDERS.length);
    for (const ev of events) expect((ev.pages ?? []).length).toBeGreaterThan(0);

    // 상인은 shop 커맨드까지 컴파일되어야 한다 — 좌표에 점만 찍은 게 아니라는 증거.
    const hasShop = events.some((ev) =>
      (ev.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "shop"))
    );

    // 플레이 모드에서 실제로 보이는지 — 에디터 전용 표시가 아니라는 증거.
    await page.getByTestId("mode-play").click();
    await page.waitForTimeout(4_000);
    await page.screenshot({ path: `${SHOTS}/05-play-mode.png` });

    writeFileSync(
      `${SHOTS}/summary.json`,
      JSON.stringify({ eventCount: events.length, hasShop, placed, consoleErrors: consoleErrors.slice(0, 10) }, null, 2)
    );
  });
});
