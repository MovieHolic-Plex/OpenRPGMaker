// 진단 전용: 이벤트 에디터의 세 보기(목록/스토리/미리보기) + 도구 팝오버의 플로우를
// 와이드 뷰포트에서 나란히 캡처하고, 같은 명령 트리를 세 렌더가 어떻게 다르게 말하는지
// 기계적으로 뽑아 온다. 적대적 리뷰용이라 assert 는 최소로 두고 관측값을 파일로 남긴다.
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

// EVIDENCE_TAG=before|after 로 같은 촬영을 두 번 돌려 좌우 비교를 만든다.
const TAG = process.env.EVIDENCE_TAG ?? "after";
const OUT = `output/evidence/event-view-overlap-review/${TAG}`;
const WIDE = { width: 2560, height: 1440 };

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-view-overlap-review");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
});

function say(body: string): Command {
  return { kind: "text", speaker: "촌장", body };
}

/** 세 보기가 모두 무언가를 그릴 수밖에 없는 페이지: 분기 6종 전부 등장. */
function branchRichPage(): EventPage {
  const commands: Command[] = [
    say("마을 창고가 털렸다네. 도와주겠나?"),
    {
      kind: "choices",
      prompt: "창고를 조사할까?",
      options: [
        { text: "조사한다", branch: [{ kind: "setSwitch", switchId: "0001", value: true }, say("좋아, 따라오게.")] },
        { text: "거절한다", branch: [say("그렇군… 마음이 바뀌면 오게.")] },
      ],
      cancelBehavior: "branch",
      cancelBranch: [say("(대답을 피했다)")],
    },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "0001", value: true },
      then: [say("자물쇠가 부서져 있다.")],
      else: [say("창고는 잠겨 있다.")],
    },
    { kind: "loop", body: [say("발자국을 따라간다…"), { kind: "wait", ms: 300 }, { kind: "breakLoop" }] },
    {
      kind: "shop",
      itemIds: [DEFAULT_ITEM_ID],
      allowSell: true,
      branchOnTransaction: true,
      transactionBranch: [say("거래 감사합니다!")],
      branchOnFailedTransaction: true,
      failedTransactionBranch: [say("돈이 모자라시군요.")],
    },
    {
      kind: "battleProcessing",
      troopId: DEFAULT_TROOP_ID,
      canEscape: true,
      canLose: true,
      branchOnResult: true,
      victoryBranch: [{ kind: "changeGold", op: "+=", amount: 200 }, say("도둑을 잡았다!")],
      defeatBranch: [say("놓쳤다…")],
      escapeBranch: [say("도둑이 달아났다.")],
    },
    { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 },
  ];
  return {
    id: "p1",
    name: "창고 조사",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 0 },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function reviewProject(): { project: Project; eventId: string } {
  const project = createBlankProject();
  project.switches = [{ id: "0001", name: "창고 조사 수락" }];
  project.characters = { "village-chief": { displayName: "촌장" } };
  const startMapId = project.startMapId;
  if (!startMapId) throw new Error("blank project has no startMapId");
  const start = project.maps[startMapId];
  if (!start) throw new Error("start map missing");
  const event: GameEvent = {
    id: "0001",
    name: "촌장",
    x: 6,
    y: 6,
    trigger: { kind: "action" },
    commands: [],
    characterId: "village-chief",
    pages: [branchRichPage()],
  };
  start.events = [event];
  return { project, eventId: event.id };
}

async function openEditor(page: Page, mapId: string, eventId: string): Promise<Locator> {
  await page.evaluate(async ({ activeMapId, id }) => {
    const modalModule = await import("/src/editor/panels/eventEditor/modal.ts");
    modalModule.openEventEditorModal(activeMapId, id);
  }, { activeMapId: mapId, id: eventId });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

test("세 보기와 플로우를 와이드 뷰포트에서 캡처하고 표현 차이를 뽑는다", async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize(WIDE);
  const { project, eventId } = reviewProject();
  await seedProjectFromSupabaseCanonical(page, project);
  const editor = await openEditor(page, project.startMapId!, eventId);

  const shot = async (name: string) => {
    await page.waitForTimeout(220);
    await editor.screenshot({ path: `${OUT}/${name}.png` });
  };

  // ── 1) 목록
  await editor.getByTestId("event-view-toggle-list").click();
  await expect(editor.locator(".event-contents-fieldset .cmd-list")).toBeVisible();
  await shot("01-list");

  // ── 2) 스토리
  await editor.getByTestId("event-view-toggle-storyboard").click();
  await expect(editor.getByTestId("event-storyboard")).toBeVisible();
  await shot("02-storyboard");

  // ── 3) 미리보기 (세그먼트 컨트롤 경로)
  await editor.getByTestId("event-view-toggle-preview").click();
  await expect(editor.getByTestId("event-page-preview")).toBeVisible();
  await shot("03-preview-via-toggle");

  // ── 4) 미리보기 입구 수. 2026-08-31 이후 세그먼트 하나뿐이어야 한다.
  //     before 태그로도 돌려야 하므로 단정하지 않고 개수를 관측값으로 남긴다.
  await editor.getByTestId("event-view-toggle-list").click();
  const duplicatePreviewButtons = await editor.getByTestId("event-command-quick-preview").count();
  await editor.getByTestId("event-view-toggle-preview").click();
  await expect(editor.getByTestId("event-page-preview")).toBeVisible();
  await shot("04-preview-single-entry");

  // ── 5) 플로우 (⌘ 툴바 버튼 → 도구 팝오버 안 아코디언)
  await editor.getByTestId("event-command-quick-flow").click();
  const flow = editor.getByTestId("event-script-flowchart");
  await expect(flow).toHaveJSProperty("open", true);
  await shot("05-flow-via-toolbar-button");
  await editor.getByTestId("event-flowchart-body").screenshot({ path: `${OUT}/05b-flow-body.png` });

  // ── 6) 툴바 자체 클로즈업 (중복 컨트롤 확인용)
  await editor.locator(".event-editor-command-toolbar").screenshot({ path: `${OUT}/06-toolbar.png` });

  // ── 관측: 각 표시면이 이 페이지를 어떻게 말하는지
  const probe = await page.evaluate(() => {
    const text = (node: Element | null) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
    const modal = document.querySelector('[data-testid="event-editor-modal"]');
    const grab = (sel: string) => Array.from(modal?.querySelectorAll(sel) ?? []).map((n) => text(n));
    const rect = (sel: string) => {
      const node = modal?.querySelector(sel);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      storyChipRows: (modal?.querySelectorAll(".event-storyboard-card-branches") ?? []).length,
      storyBranchLabels: grab(".event-storyboard-branch-label"),
      flowBranchLabels: grab(".event-flow-branch-label"),
      flowNodeCount: (modal?.querySelectorAll(".event-flow-node") ?? []).length,
      storyCardCount: (modal?.querySelectorAll(".event-storyboard-card") ?? []).length,
      storyLeafCount: (modal?.querySelectorAll(".event-storyboard-branch-command").length ?? 0),
      listRowCount: (modal?.querySelectorAll(".cmd-list [data-cmd-path]") ?? []).length,
      flowChipStatus: text(modal?.querySelector("[data-testid='event-flow-chip-status']") ?? null),
      commandCount: text(modal?.querySelector("[data-testid='event-editor-command-count']") ?? null),
      previewPosition: text(modal?.querySelector(".event-script-live-position") ?? null),
      toolbarButtons: grab(".event-editor-command-toolbar button").filter((t) => t.length > 0),
      geometry: {
        modal: rect('[data-testid="event-editor-modal"]'),
        flowBody: rect("[data-testid='event-flowchart-body']"),
        toolsPopover: rect(".event-editor-aux-tools"),
        commandsColumn: rect(".event-editor-commands-column"),
        inspector: rect("[data-testid='event-editor-inspector']"),
        settings: rect(".event-editor-settings-column"),
      },
    };
  });

  // 미리보기 스텝 수를 끝까지 넘겨 세어 본다 (분기 전개 방식 확인).
  await editor.getByTestId("event-view-toggle-preview").click();
  await expect(editor.getByTestId("event-page-preview")).toBeVisible();
  const previewSteps: string[] = [];
  for (let i = 0; i < 60; i += 1) {
    const caption = await editor.getByTestId("event-script-live-caption").textContent();
    const pos = await editor.locator(".event-script-live-position").textContent();
    previewSteps.push(`${pos ?? "?"} ${caption ?? ""}`.replace(/\s+/g, " ").trim());
    const [cur, total] = (pos ?? "0/0").split("/").map((n) => Number.parseInt(n, 10));
    if (!Number.isFinite(cur) || !Number.isFinite(total) || cur >= total) break;
    await editor.getByTestId("event-script-live-next").click();
    await page.waitForTimeout(60);
  }
  await shot("07-preview-last-step");

  await writeFile(
    `${OUT}/probe.json`,
    JSON.stringify({ tag: TAG, duplicatePreviewButtons, probe, previewSteps }, null, 2),
    "utf8"
  );
  // eslint-disable-next-line no-console
  console.log("PROBE", JSON.stringify({ tag: TAG, duplicatePreviewButtons, probe, previewSteps }, null, 2));
});

test("좁은 폭에서 툴바와 세 보기가 어떻게 무너지는지", async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  const { project, eventId } = reviewProject();
  await page.setViewportSize({ width: 1366, height: 900 });
  await seedProjectFromSupabaseCanonical(page, project);
  const editor = await openEditor(page, project.startMapId!, eventId);
  await editor.getByTestId("event-view-toggle-storyboard").click();
  await page.waitForTimeout(250);
  await editor.screenshot({ path: `${OUT}/08-1366-storyboard.png` });
  await editor.locator(".event-editor-command-toolbar").screenshot({ path: `${OUT}/08b-1366-toolbar.png` });

  const wrap = await page.evaluate(() => {
    const bar = document.querySelector(".event-editor-command-toolbar");
    if (!bar) return null;
    const rows = new Set<number>();
    for (const child of Array.from(bar.children)) rows.add(Math.round(child.getBoundingClientRect().y));
    const barRect = bar.getBoundingClientRect();
    const overflow = Array.from(bar.children)
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.right > barRect.right + 1).length;
    return { rowCount: rows.size, barHeight: Math.round(barRect.height), childrenOverflowing: overflow };
  });
  // eslint-disable-next-line no-console
  console.log("TOOLBAR_WRAP_1366", JSON.stringify(wrap));
});
