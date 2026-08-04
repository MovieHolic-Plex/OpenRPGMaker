import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { Command, Project } from "@/project/types";

// 목업대로 바꾼 이벤트 에디터 화면을 조각별로 캡처한다.
// 실행: npx playwright test eventEditorMockupShots.spec.ts
const DIR = "output/evidence/event-editor-mockup";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test.setTimeout(120_000);

test("event editor matches the approved mockup", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });

  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);

  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await page.waitForTimeout(600);

  // 1) 전체 — 목업의 셸 대조용
  await modal.screenshot({ path: `${DIR}/01-shell.png` });

  // 2) 명령 리스트 = 블록 캔버스
  const list = modal.locator(".cmd-list").first();
  await expect(list).toBeVisible();
  await list.screenshot({ path: `${DIR}/02-block-canvas.png` });

  // 거터가 카테고리별로 실제 다른 색을 물었는지 (폴백 회색만 나오면 매핑 실패)
  const gutters = await list.evaluate((root) => {
    const out: Record<string, string> = {};
    for (const item of root.querySelectorAll<HTMLElement>(".cmd-item[data-command-category]")) {
      const category = item.dataset.commandCategory ?? "?";
      const prefix = item.querySelector<HTMLElement>(":scope > .cmd-head > .cmd-prefix");
      if (!prefix || out[category]) continue;
      out[category] = getComputedStyle(prefix).backgroundColor;
    }
    return out;
  });
  // eslint-disable-next-line no-console
  console.log("[gutters]", JSON.stringify(gutters));
  expect(new Set(Object.values(gutters)).size).toBeGreaterThan(2);

  // 3) 좌측 설정 컬럼 (레일)
  const settings = modal.locator(".event-editor-settings-column").first();
  if (await settings.count()) {
    await settings.screenshot({ path: `${DIR}/03-rail.png` });
  }

  // 4) 페이지 탭 — 이름 + 조건 요약이 보여야 한다
  const tabStrip = modal.locator("[data-testid='event-classic-page-tabs']").first();
  await expect(tabStrip).toBeVisible();
  await expect(tabStrip.locator("[data-testid='event-page-tab-cond-1']")).toHaveText("조건 없음");
  await tabStrip.screenshot({ path: `${DIR}/04-page-tabs.png` });

  // 5) 인라인 인스펙터 — 명령을 클릭하면 모달 없이 우측에서 편집된다
  const inspector = modal.getByTestId("event-editor-inspector");
  await expect(inspector.getByTestId("event-inspector-empty")).toBeVisible();

  await list.locator(".cmd-item").first().locator(".cmd-head").click();
  await expect(inspector.getByTestId("event-inspector-body")).toBeVisible();
  // 모달이 새로 열리지 않아야 한다 — 이게 "모달 3겹 제거"의 핵심.
  await expect(page.locator("[data-testid='event-command-edit-dialog']")).toHaveCount(0);
  // eslint-disable-next-line no-console
  console.log("[inspector]", (await inspector.getByTestId("event-inspector-title").innerText()).trim());
  await inspector.screenshot({ path: `${DIR}/05-inspector.png` });
  await modal.screenshot({ path: `${DIR}/01-shell.png` });

  // 6) 커맨드 팔레트 — 검색 우선 + 키보드 후보
  await modal.getByTestId("event-command-toolbar-add").first().click();
  const picker = page.getByTestId("event-command-picker-search");
  await expect(picker).toBeVisible();
  await picker.fill("소지금");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);

  const active = page.locator(".event-command-picker-command.keyboard-active");
  await expect(active).toHaveCount(1);
  // eslint-disable-next-line no-console
  console.log("[palette] keyboard candidate:", (await active.first().innerText()).replace(/\s+/g, " ").trim());

  const dialog = page.getByTestId("event-command-picker").first();
  await dialog.screenshot({ path: `${DIR}/06-palette.png` });
});

function mockupProject(): { project: Project; eventId: string } {
  const project = createBlankProject();
  const startMap = project.maps[project.startMapId];
  if (!startMap) throw new Error("missing start map");

  const mapId = project.startMapId;
  const variableId = project.variables[0]?.id ?? "";
  const switchId = project.switches[0]?.id ?? "";
  const secondSwitchId = project.switches[1]?.id ?? switchId;
  const itemId = project.database.items[0]?.id ?? "";

  // 카테고리 6종 + 중첩 분기가 한 화면에 나오도록.
  const commands: Command[] = [
    { kind: "text", speaker: "의뢰 중개인 미라", body: "서쪽길 슬라임과 동쪽길 박쥐떼 때문에 상인들이 발이 묶였어." },
    {
      kind: "choices",
      prompt: "두 길목을 정리해 줄래?",
      options: [
        {
          text: "맡는다",
          branch: [
            { kind: "setSwitch", switchId, value: true },
            { kind: "setVariable", variableId, op: "=", value: 0 },
            { kind: "text", speaker: "의뢰 중개인 미라", body: "좋아. 서쪽과 동쪽 길목을 확인하고 돌아와." },
          ],
        },
        {
          text: "나중에",
          branch: [{ kind: "text", speaker: "의뢰 중개인 미라", body: "시장 사람들은 여기서 기다릴게." }],
        },
      ],
      cancelBehavior: "choice2",
    },
    { kind: "showPicture", pictureId: "pic_demo", resourceId: "easyrpg-picture-cloud", x: 24, y: 32 },
    { kind: "playAudio", resourceId: "bgm-demo-town", loop: true },
    { kind: "transfer", mapId, x: 7, y: 10, direction: "down", fade: "black" },
    { kind: "changeGold", op: "+=", amount: 120 },
    { kind: "changeItem", itemId, op: "+=", amount: 2 },
    { kind: "setWeather", weather: "rain", intensity: 60 },
    { kind: "cutsceneControl", mode: "begin", skippable: true },
    { kind: "wait", ms: 500 },
    { kind: "cutsceneControl", mode: "end" },
  ];

  const eventId = "event_mockup_demo";
  const basePage = {
    graphic: {},
    trigger: { kind: "action" as const },
    priority: "same" as const,
    movement: { type: "fixed" as const, speed: 3, frequency: 3 },
  };

  startMap.events.push({
    id: eventId,
    name: "의뢰 중개인 미라",
    x: 8,
    y: 8,
    trigger: { kind: "action" },
    // GameEvent.commands 는 필수다 — 빠지면 로드 시 걸러진다.
    commands: [],
    pages: [
      { id: "page_offer", name: "의뢰 제안", conditions: [], ...basePage, commands },
      {
        id: "page_active",
        name: "진행 중",
        conditions: [
          { kind: "switch", switchId, value: true },
          { kind: "variable", variableId, op: "<", value: 2 },
        ],
        ...basePage,
        commands: [{ kind: "text", speaker: "의뢰 중개인 미라", body: "아직 길목이 완전히 열리지 않았어." }],
      },
      {
        id: "page_done",
        name: "완료 후",
        conditions: [{ kind: "switch", switchId: secondSwitchId, value: true }],
        ...basePage,
        commands: [{ kind: "text", speaker: "의뢰 중개인 미라", body: "덕분에 시장이 다시 움직여." }],
      },
    ],
  } as never);

  return { project, eventId };
}

export type { Page };
