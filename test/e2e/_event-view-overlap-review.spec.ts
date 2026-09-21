// 진단 전용: 이벤트 에디터의 세 보기(목록/스토리/미리보기) + 도구 팝오버의 플로우를
// 와이드 뷰포트에서 나란히 캡처하고, 같은 명령 트리를 세 렌더가 어떻게 다르게 말하는지
// 기계적으로 뽑아 온다. 적대적 리뷰용이라 assert 는 최소로 두고 관측값을 파일로 남긴다.
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openEditor, reviewProject } from "./eventViewReviewFixture";
import { seedProjectForEditor } from "./projectSeed";

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

test("세 보기와 플로우를 와이드 뷰포트에서 캡처하고 표현 차이를 뽑는다", async ({ page }) => {
  // 진단용 캡처다: 2560×1440 모달 전체 스크린샷 8장 + 미리보기 22단계 순회라 기본 180초 캡을
  // 넘긴다(특히 이 머신은 다른 워크트리와 CPU/RAM 을 나눠 쓴다). 커버리지를 깎지 말고 예산을 준다.
  test.slow();
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize(WIDE);
  const { project, eventId } = reviewProject();
  await seedProjectForEditor(page, project);
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

  // ── 4) 미리보기 입구 수. 2026-08-30 이후 세그먼트 하나뿐이어야 한다.
  //     before 태그로도 돌려야 하므로 단정하지 않고 개수를 관측값으로 남긴다.
  await editor.getByTestId("event-view-toggle-list").click();
  const duplicatePreviewButtons = await editor.getByTestId("event-command-quick-preview").count();
  await editor.getByTestId("event-view-toggle-preview").click();
  await expect(editor.getByTestId("event-page-preview")).toBeVisible();
  await shot("04-preview-single-entry");

  // ── 5) 플로우. 2026-08-30 이후 네 번째 보기 방식이다(예전에는 ⌘ 툴바 버튼 →
  //     도구 팝오버 안 아코디언이라 미리보기 위에 겹쳐 떴다).
  //     before 태그로도 돌려야 하므로 둘 중 있는 입구를 쓰고 어느 쪽이었는지를 관측값으로 남긴다.
  const flowIsViewMode = (await editor.getByTestId("event-view-toggle-flow").count()) > 0;
  const legacyFlowPopoverButtons = await editor.getByTestId("event-command-quick-flow").count();
  if (flowIsViewMode) {
    await editor.getByTestId("event-view-toggle-flow").click();
    await expect(editor.getByTestId("event-page-flow")).toBeVisible();
  } else {
    await editor.getByTestId("event-command-quick-flow").click();
    await expect(editor.getByTestId("event-script-flowchart")).toHaveJSProperty("open", true);
  }
  await shot("05-flow-via-toolbar-button");
  await editor.getByTestId("event-flowchart-body").screenshot({ path: `${OUT}/05b-flow-body.png` });

  // ── 5b) 겹침 실측: 플로우를 띄운 상태에서 미리보기의 재생 컨트롤이 가려지는가.
  //     팝오버 시절에는 「자동 재생」 버튼 중심점이 플로우 본문에 먹혔다.
  const flowOcclusion = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="event-editor-modal"]');
    const play = modal?.querySelector("[data-testid='event-script-live-play']");
    const body = modal?.querySelector("[data-testid='event-flowchart-body']");
    if (!play || !body) return { playPresentWithFlow: false, playCoveredByFlow: false };
    const p = play.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return {
      playPresentWithFlow: true,
      playCoveredByFlow: Boolean(hit && body.contains(hit))
        || (cx > b.x && cx < b.x + b.width && cy > b.y && cy < b.y + b.height),
    };
  });

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

  // ── 8) 플로우가 미리보기의 «현재 단계» 를 이어받는가. 팝오버 시절에는 이 표시가 없었다.
  const flowStepSync = flowIsViewMode
    ? await (async () => {
        await editor.getByTestId("event-view-toggle-flow").click();
        await expect(editor.getByTestId("event-page-flow")).toBeVisible();
        await page.waitForTimeout(160);
        await editor.getByTestId("event-page-flow").screenshot({ path: `${OUT}/09-flow-step-sync.png` });
        return page.evaluate(() => {
          const modal = document.querySelector('[data-testid="event-editor-modal"]');
          return {
            statusText: (modal?.querySelector("[data-testid='event-page-flow-current']")?.textContent ?? "").trim(),
            currentNodes: (modal?.querySelectorAll(".event-flow-node.is-current") ?? []).length,
            currentNodePath: modal?.querySelector<HTMLElement>(".event-flow-node.is-current")?.dataset.cmdPath ?? null,
          };
        });
      })()
    : { statusText: null, currentNodes: 0, currentNodePath: null };

  const summary = {
    tag: TAG,
    duplicatePreviewButtons,
    flowIsViewMode,
    legacyFlowPopoverButtons,
    flowOcclusion,
    flowStepSync,
    probe,
    previewSteps,
  };
  await writeFile(`${OUT}/probe.json`, JSON.stringify(summary, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log("PROBE", JSON.stringify(summary, null, 2));
});

test("좁은 폭에서 툴바와 세 보기가 어떻게 무너지는지", async ({ page }) => {
  test.slow();
  await mkdir(OUT, { recursive: true });
  const { project, eventId } = reviewProject();
  await page.setViewportSize({ width: 1366, height: 900 });
  await seedProjectForEditor(page, project);
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
