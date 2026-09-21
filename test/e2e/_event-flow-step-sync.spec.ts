// 진단 전용 · 좁은 목표: 플로우가 **네 번째 보기 방식**이 된 뒤
//   (1) 미리보기 위에 겹치는 일이 구조적으로 불가능해졌는지,
//   (2) 미리보기가 보던 단계를 플로우가 이어받아 짚는지
// 두 가지만 실측해 파일로 남긴다.
//
// 큰 진단 스펙(_event-view-overlap-review)과 나누는 이유: 그쪽은 와이드 뷰포트 전체
// 스크린샷 8장 + 미리보기 22단계 순회라 부하가 걸린 머신에서 10분을 넘긴다. 보고서에 필요한
// 두 장짜리 증거를 그 예산에 묶어 두면 매번 같이 굶는다. 여기서는 단계를 2번만 넘긴다.
//
// 클릭에 짧은 개별 timeout 을 주는 것도 의도다: 버튼이 정말 죽었으면 테스트 예산을 다
// 태우지 않고 몇 초 안에 실패해야 원인을 구분할 수 있다.
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openEditor, reviewProject } from "./eventViewReviewFixture";
import { seedProjectForEditor } from "./projectSeed";

const OUT = `output/evidence/event-view-overlap-review/${process.env.EVIDENCE_TAG ?? "after"}`;
const CLICK = { timeout: 20_000 } as const;

// 기본 캡(30초)은 이 스펙에 안 맞는다. 앱 부팅 + LegacyDb 시드만으로 부하 걸린 머신에서
// 1분 넘게 쓰므로, 캡이 먼저 터져 «클릭이 죽었다»는 엉뚱한 결론이 나온다. 실제로 그렇게 한 번
// 헛짚었다: 버튼 박스는 6프레임 내내 1픽셀도 안 움직이고 애니메이션도 없었다.
test.setTimeout(240_000);

test("플로우가 미리보기의 현재 단계를 이어받고, 겹칠 자리가 없다", async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-flow-step-sync");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 2560, height: 1440 });
  const { project, eventId } = reviewProject();
  await seedProjectForEditor(page, project);
  const editor = await openEditor(page, project.startMapId!, eventId);

  // ── 플로우 입구가 보기 세그먼트인지 (팝오버 시절 버튼은 사라졌는지)
  const flowIsViewMode = (await editor.getByTestId("event-view-toggle-flow").count()) > 0;
  const legacyFlowPopoverButtons = await editor.getByTestId("event-command-quick-flow").count();
  const duplicatePreviewButtons = await editor.getByTestId("event-command-quick-preview").count();
  expect(flowIsViewMode, "플로우는 네 번째 보기 세그먼트여야 한다").toBe(true);

  // ── 미리보기에서 두 단계 넘긴다. 3단계는 선택지 「조사한다」 분기 **안쪽**
  //    (경로 [1,0,0] = 1번 명령 → 0번 선택지 → 그 안 0번 명령)이라
  //    「최상위 명령 n번째」로는 절대 못 짚는 자리다 — 경로 기반 짚기의 시험대.
  await editor.getByTestId("event-view-toggle-preview").click(CLICK);
  await expect(editor.getByTestId("event-page-preview")).toBeVisible();
  await editor.getByTestId("event-script-live-next").click(CLICK);
  await editor.getByTestId("event-script-live-next").click(CLICK);
  const previewPosition = (await editor.locator(".event-script-live-position").textContent())?.trim() ?? null;
  await editor.getByTestId("event-page-preview").screenshot({ path: `${OUT}/10-preview-step3.png` });

  // ── 플로우로 넘어간다.
  await editor.getByTestId("event-view-toggle-flow").click(CLICK);
  await expect(editor.getByTestId("event-page-flow")).toBeVisible();
  await page.waitForTimeout(200);
  await editor.getByTestId("event-page-flow").screenshot({ path: `${OUT}/09-flow-step-sync.png` });

  const measured = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="event-editor-modal"]');
    const flow = modal?.querySelector("[data-testid='event-page-flow']");
    const body = modal?.querySelector("[data-testid='event-flowchart-body']");
    const play = modal?.querySelector("[data-testid='event-script-live-play']");
    const box = (node: Element | null | undefined) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      // 미리보기 자체가 DOM 에 없으므로 덮을 컨트롤도 없다 = 겹침이 구조적으로 불가능.
      previewControlsPresentWhileFlowOpen: Boolean(play),
      flowBox: box(flow),
      flowBodyBox: box(body),
      statusText: (modal?.querySelector("[data-testid='event-page-flow-current']")?.textContent ?? "").trim(),
      currentNodes: (modal?.querySelectorAll(".event-flow-node.is-current") ?? []).length,
      currentNodePath: modal?.querySelector<HTMLElement>(".event-flow-node.is-current")?.dataset.cmdPath ?? null,
      ariaCurrent: modal?.querySelector(".event-flow-node.is-current")?.getAttribute("aria-current") ?? null,
      totalNodes: (modal?.querySelectorAll(".event-flow-node") ?? []).length,
    };
  });

  // 짚는 자리는 정확히 한 곳이고, 선택지 분기 안쪽 경로여야 한다.
  expect(measured.currentNodes).toBe(1);
  expect(measured.currentNodePath).toBe(JSON.stringify([1, 0, 0]));
  expect(measured.ariaCurrent).toBe("step");
  expect(measured.previewControlsPresentWhileFlowOpen).toBe(false);

  // ── 노드를 누르면 목록·스토리와 같은 인스펙터가 채워지는지
  await editor.locator(".event-flow-node.is-current").click(CLICK);
  const inspectorFilled = await editor.getByTestId("event-editor-inspector").locator("*").count();

  const summary = {
    flowIsViewMode,
    legacyFlowPopoverButtons,
    duplicatePreviewButtons,
    previewPosition,
    ...measured,
    inspectorChildCountAfterNodeClick: inspectorFilled,
  };
  await writeFile(`${OUT}/probe-flow.json`, JSON.stringify(summary, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log("FLOW_PROBE", JSON.stringify(summary, null, 2));
});
