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

// 사용자가 실제로 만나는 상태: 명령이 하나도 없는 새 이벤트 + 넓은 창.
// 앞선 캡처는 명령 11개 · 페이지 3개 · 1500px 였어서 잘림/여백 문제를 놓쳤다.
test("empty event on a wide viewport stays clean", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1950, height: 1200 });

  const { project, eventId } = emptyEventProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);

  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await page.waitForTimeout(600);

  const probe = await modal.evaluate((root) => {
    const measure = (selector: string) => {
      const node = root.querySelector<HTMLElement>(selector);
      if (!node) return null;
      return {
        clientH: node.clientHeight,
        scrollH: node.scrollHeight,
        clientW: node.clientWidth,
        scrollW: node.scrollWidth,
        clipped: node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1,
      };
    };
    const confirm = root.querySelector<HTMLElement>("[data-testid='event-editor-confirm']");
    return {
      tab: measure(".event-page-tab-rich"),
      tabStrip: measure(".event-page-number-tabs"),
      graphic: measure(".event-page-graphic-section, .event-graphic-field"),
      confirmBg: confirm ? getComputedStyle(confirm).backgroundColor : null,
    };
  });
  // eslint-disable-next-line no-console
  console.log("[empty]", JSON.stringify(probe));

  await modal.screenshot({ path: `${DIR}/07-empty-wide.png` });

  // 근접 캡처 — 채점표 A(카드 밀도)와 E(선택 없는 인스펙터)는 전체 셸 샷으로는 못 본다.
  await modal.locator(".event-editor-card").screenshot({ path: `${DIR}/08-card.png` });
  await modal
    .locator(".event-editor-inspector-column")
    .screenshot({ path: `${DIR}/09-inspector-idle.png` });

  // 탭 내용이 잘리면 안 된다 (이름 + 조건 요약 두 줄이 다 보여야 한다).
  expect(probe.tab?.clipped, "page tab clips its content").toBeFalsy();
  // 카드 안 이름/캐릭터 ID 는 312px 레일에서 겹치지 않고 각자 한 줄을 쓴다.
  const card = await modal.locator(".event-editor-card").evaluate((root) => {
    const name = root.querySelector<HTMLElement>('[data-testid="event-page-name-input"]');
    const charLabel = root.querySelector<HTMLElement>(".event-character-id-label > span");
    if (!name || !charLabel) return null;
    const a = name.getBoundingClientRect();
    const b = charLabel.getBoundingClientRect();
    return { overlap: a.bottom > b.top + 1 && a.top < b.bottom - 1 && a.right > b.left && a.left < b.right };
  });
  expect(card?.overlap, "name input overlaps the character-id label").toBe(false);
});

function emptyEventProject(): { project: Project; eventId: string } {
  const project = createBlankProject();
  const startMap = project.maps[project.startMapId];
  if (!startMap) throw new Error("missing start map");
  const eventId = "event_empty_demo";
  startMap.events.push({
    id: eventId,
    name: "페이지 1",
    x: 46,
    y: 47,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_empty",
        name: "페이지 1",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  } as never);
  return { project, eventId };
}

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

test("diagnose page tab strip geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1950, height: 1200 });
  const { project, eventId } = emptyEventProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await page.waitForTimeout(500);
  const info = await modal.evaluate((root) => {
    const section = root.querySelector<HTMLElement>(".event-editor");
    const kids = section ? [...section.children].map((c) => ({
      cls: (c as HTMLElement).className.slice(0, 46),
      mt: getComputedStyle(c as HTMLElement).marginTop,
      mb: getComputedStyle(c as HTMLElement).marginBottom,
      order: getComputedStyle(c as HTMLElement).order,
      gridRow: getComputedStyle(c as HTMLElement).gridRowStart,
      pos: getComputedStyle(c as HTMLElement).position,
      h: Math.round((c as HTMLElement).getBoundingClientRect().height),
      y: Math.round((c as HTMLElement).getBoundingClientRect().top),
    })) : [];
    const ts = root.querySelector<HTMLElement>(".event-editor-top-strip");
    const tsKids = ts ? [...ts.children].map((c) => {
      const e = c as HTMLElement; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { cls: e.className.slice(0,44), h: Math.round(r.height), w: Math.round(r.width), minH: cs.minHeight, disp: cs.display };
    }) : [];
    const tsCss = ts ? { display: getComputedStyle(ts).display, minHeight: getComputedStyle(ts).minHeight, alignItems: getComputedStyle(ts).alignItems, gap: getComputedStyle(ts).gap, padding: getComputedStyle(ts).padding, rows: getComputedStyle(ts).gridTemplateRows, cols: getComputedStyle(ts).gridTemplateColumns, alignContent: getComputedStyle(ts).alignContent } : null;
    const ok = root.querySelector<HTMLElement>("[data-testid='event-editor-ok']");
    const okInfo = ok ? { cls: ok.className, bg: getComputedStyle(ok).backgroundColor, parent: (ok.parentElement as HTMLElement)?.className } : null;
    const strip = root.querySelector<HTMLElement>(".event-page-number-tabs");
    if (!strip) return { error: "no strip", kids, okInfo };
    const cs = getComputedStyle(strip);
    const parent = strip.parentElement as HTMLElement | null;
    return {
      kids, okInfo, tsKids, tsCss,
      stripRect: strip.getBoundingClientRect().toJSON(),
      stripCss: { height: cs.height, minHeight: cs.minHeight, alignItems: cs.alignItems, overflowX: cs.overflowX, padding: cs.padding },
      parentClass: parent?.className,
      sectionCss: section ? { gap: getComputedStyle(section).gap, alignContent: getComputedStyle(section).alignContent, display: getComputedStyle(section).display, rows: getComputedStyle(section).gridTemplateRows, flow: getComputedStyle(section).gridAutoFlow } : null,
      parentCss: parent ? { display: getComputedStyle(parent).display, height: getComputedStyle(parent).height, gridTemplate: getComputedStyle(parent).gridTemplateColumns } : null,
      children: [...strip.children].map((c) => ({
        cls: (c as HTMLElement).className,
        w: Math.round((c as HTMLElement).getBoundingClientRect().width),
        h: Math.round((c as HTMLElement).getBoundingClientRect().height),
      })),
    };
  });
  // eslint-disable-next-line no-console
  console.log("[geom]", JSON.stringify(info, null, 1));
});

// 목업 대비 구조 체크리스트. 항목이 실제로 존재/작동하는지 기계적으로 센다.
test("mockup parity checklist", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await page.waitForTimeout(600);

  const result = await modal.evaluate((root) => {
    const has = (sel: string) => !!root.querySelector(sel);
    const rect = (sel: string) => {
      const n = root.querySelector<HTMLElement>(sel);
      return n ? n.getBoundingClientRect() : null;
    };
    const tabs = rect(".event-page-number-tabs");
    const rail = rect(".event-editor-settings-column");
    const canvas = rect(".event-editor-commands-column");
    const insp = rect(".event-editor-inspector-column");
    const card = rect(".event-editor-card");
    const val = rect(".event-draft-validation");
    const gutters = new Set<string>();
    for (const item of root.querySelectorAll<HTMLElement>(".cmd-item[data-command-category]")) {
      const p = item.querySelector<HTMLElement>(":scope > .cmd-head > .cmd-prefix");
      if (p) gutters.add(getComputedStyle(p).backgroundColor);
    }
    const okBtn = root.querySelector<HTMLElement>(".btn.event-editor-footer-button.primary");
    const legend = rect(".event-command-legend");
    const list = rect(".cmd-list");
    const idleStats = has(".event-inspector-stats") || has("[data-testid='event-inspector-body']");
    return {
      "가로 페이지 탭": !!tabs && tabs.width > 400 && tabs.height < 80,
      "탭 조건 요약": has("[data-testid='event-page-tab-cond-1']"),
      "이벤트 카드": has(".event-editor-card") && has(".event-editor-card-sprite"),
      "카드가 레일 최상단": !!card && !!rail && card.top - rail.top < 24,
      "3열 배치": !!rail && !!canvas && !!insp && rail.right <= canvas.left + 24 && canvas.right <= insp.left + 24,
      // 목업 비율: 레일 312 / 인스펙터 348 (가운데가 남는 폭 전부).
      "열 폭 312·348": !!rail && !!insp && Math.abs(rail.width - 312) <= 2 && Math.abs(insp.width - 348) <= 2,
      "블록 캔버스 거터 다색": gutters.size >= 4,
      "인라인 인스펙터": has(".event-editor-inspector-column"),
      "카테고리 범례": has(".event-command-legend"),
      // 범례는 툴바 줄이 아니라 캔버스 아래 자기 한 줄.
      "범례가 캔버스 아래": !!legend && !!list && legend.top >= list.bottom - 4,
      "인스펙터에 읽을 것": idleStats,
      "하단 검증 스트립": !!val && !!canvas && val.top >= canvas.bottom - 8,
      "황동 확인 버튼": !!okBtn && getComputedStyle(okBtn).backgroundColor === "rgb(217, 164, 65)",
    };
  });
  const pass = Object.values(result).filter(Boolean).length;
  const total = Object.keys(result).length;
  // eslint-disable-next-line no-console
  console.log("[parity]", JSON.stringify(result), `=> ${pass}/${total}`);
  expect(pass, JSON.stringify(result)).toBeGreaterThanOrEqual(total - 1);
});


// 뷰포트 매트릭스 — 목업 불변식(3열 312/유연/348, 단일 행 탭, 하단 스트립)이
// 실제 사용자가 쓰는 창 크기에서 깨지지 않는지 기계적으로 확인한다.
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1500, height: 1000 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

for (const vp of VIEWPORTS) {
  test(`mockup invariants hold at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { project, eventId } = mockupProject();
    await seedProjectFromSupabaseCanonical(page, project);
    await openEventEditor(page, eventId);
    const modal = page.getByTestId("event-editor-modal");
    await expect(modal).toBeVisible();
    await page.waitForTimeout(600);

    const result = await modal.evaluate((root) => {
      const rect = (sel: string) => {
        const n = root.querySelector<HTMLElement>(sel);
        return n ? n.getBoundingClientRect() : null;
      };
      const modalRect = root.getBoundingClientRect();
      const tabs = rect(".event-page-number-tabs");
      const rail = rect(".event-editor-settings-column");
      const canvas = rect(".event-editor-commands-column");
      const insp = rect(".event-editor-inspector-column");
      const val = rect(".event-draft-validation");
      const list = rect(".cmd-list");
      const legend = rect(".event-command-legend");
      const bench = root.querySelector<HTMLElement>(".event-editor-workbench");
      const inX = (r: DOMRect | null) => !!r && r.left >= modalRect.left - 1 && r.right <= modalRect.right + 1;
      return {
        "3열 배치": !!rail && !!canvas && !!insp && rail.right <= canvas.left + 24 && canvas.right <= insp.left + 24,
        "열 폭 312·348": !!rail && !!insp && Math.abs(rail.width - 312) <= 2 && Math.abs(insp.width - 348) <= 2,
        "캔버스가 눌리지 않음": !!canvas && !!rail && !!insp && canvas.width >= 300,
        "탭 단일 행": !!tabs && tabs.height < 80 && tabs.width > 400,
        "열이 모달 안에": inX(rail) && inX(canvas) && inX(insp),
        "검증 스트립 하단": !!val && !!canvas && val.top >= canvas.bottom - 8,
        "범례가 캔버스 아래": !!legend && !!list && legend.top >= list.bottom - 4,
        "가로 스크롤 없음": !bench || bench.scrollWidth <= bench.clientWidth + 1,
        "레일 gfx/trig 겹침 없음": (() => {
          const gfx = rect('[data-testid="event-classic-graphic"]');
          const trig = rect(".event-page-trigger-priority-stack");
          return !!gfx && !!trig && trig.top >= gfx.bottom - 2;
        })(),
      };
    });
    const pass = Object.values(result).filter(Boolean).length;
    const total = Object.keys(result).length;
    // eslint-disable-next-line no-console
    console.log(`[parity ${vp.width}x${vp.height}]`, JSON.stringify(result), `=> ${pass}/${total}`);
    expect(pass, JSON.stringify(result)).toBe(total);

    await modal.screenshot({ path: `${DIR}/07-shell-${vp.width}.png` });
  });
}