import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { openEventEditor } from "./eventEditorCertEvidence";
import { findShadowedPages, findUnwrittenSelfSwitchGates } from "@/project/eventPageShadow";
import { projectLint } from "@/project/lint/projectLint";
import type { GameEvent, Project } from "@/project/types";

// 라이브 저작 결과(reports/ai-event-pages/*-progress-npc-project.json)를 실제 에디터에 띄워
// 페이지 탭·등장 조건을 눈으로 확인할 수 있는 증거 PNG 를 만든다.
// 실행: DEV_SERVER_PORT=<port> npx playwright test _ai-event-page-evidence.spec.ts
const SHOT_DIR = "verify-shots/ai-event-pages";
const REPORT_DIR = "reports/ai-event-pages";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test.setTimeout(180_000);

function loadProject(label: string): Project {
  return JSON.parse(readFileSync(`${REPORT_DIR}/${label}-progress-npc-project.json`, "utf8")) as Project;
}

function authoredNpc(project: Project): { mapId: string; event: GameEvent } {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if ((event.pages ?? []).length >= 2) return { mapId: map.id, event };
    }
  }
  throw new Error("다중 페이지 NPC 를 찾지 못했습니다");
}

async function waitForCanvasReady(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-testid='edit-canvas'] canvas") as HTMLCanvasElement | null;
    return !!node && node.width > 0 && node.height > 0;
  });
}

for (const label of ["before", "after-gated"] as const) {
  test(`event page evidence: ${label}`, async ({ page }) => {
    const project = loadProject(label);
    const { event } = authoredNpc(project);

    // 기계 판정을 먼저 파일로 남긴다 — 스크린샷이 흔들려도 근거는 남는다.
    const shadows = findShadowedPages(event.pages);
    const gates = findUnwrittenSelfSwitchGates(event);
    const lint = projectLint(project).filter((issue) =>
      issue.code === "event-page-shadowed" || issue.code === "event-selfswitch-gate-unwritten");
    test.info().attach(`${label}-verdict.json`, {
      body: JSON.stringify({
        eventId: event.id,
        pages: (event.pages ?? []).map((page, index) => ({
          number: index + 1,
          id: page.id,
          conditions: page.conditions,
          commandKinds: (page.commands ?? []).map((command) => command.kind),
        })),
        shadowedPages: shadows,
        unwrittenSelfSwitchGates: gates,
        lintCodes: lint.map((issue) => `${issue.code}: ${issue.message}`),
      }, null, 2),
      contentType: "application/json",
    });

    await page.setViewportSize({ width: 1600, height: 1000 });
    await seedProjectFromSupabaseCanonical(page, project);
    await waitForCanvasReady(page);
    await page.screenshot({ path: `${SHOT_DIR}/${label}-01-editor-map.png` });

    // 좌표 더블클릭 추측 대신 정식 경로(레이어→이벤트 툴→목록 행→열기)를 쓴다.
    await openEventEditor(page, event.id);
    await expect(page.getByTestId("event-page-tabs")).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/${label}-02-event-pages.png` });

    // 각 페이지 탭을 돌며 등장 조건을 펼쳐 찍는다.
    const tabs = page.getByTestId("event-page-tabs").locator("button");
    const tabCount = await tabs.count();
    for (let index = 0; index < tabCount; index += 1) {
      await tabs.nth(index).click().catch(() => {});
      await page.evaluate(() => {
        const node = document.querySelector("[data-testid='event-classic-conditions']");
        if (node instanceof HTMLDetailsElement) node.open = true;
      });
      await expect(page.getByTestId("event-page-props")).toBeVisible();
      await page.screenshot({ path: `${SHOT_DIR}/${label}-03-page${index + 1}-conditions.png` });
    }
  });
}
