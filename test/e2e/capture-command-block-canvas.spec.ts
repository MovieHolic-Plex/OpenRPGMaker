import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { openEventEditor, screenshotEvidence } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { Command, Project } from "@/project/types";

// 명령 리스트를 블록 캔버스로 바꾼 CSS(event-editor.blocks.css)가 실제 에디터에서
// 어떻게 보이는지 캡처한다. 카테고리 6종과 중첩 분기가 한 화면에 모두 나오도록 구성.
// 실행: npx playwright test capture-command-block-canvas.spec.ts
const EVIDENCE_DIR = "output/evidence/command-block-canvas";

test("command list renders as a block canvas with category gutters", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 1100 });
  const { project, eventId } = blockCanvasProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);

  const list = page.locator(".event-contents-fieldset .cmd-list").first();
  await expect(list).toBeVisible();

  // 거터가 실제로 카테고리 색을 물고 있는지 — CSS 변수가 계산값으로 내려왔는지 확인.
  const gutterColors = await list.evaluate((root) => {
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
  console.log("gutter colors:", JSON.stringify(gutterColors));

  // 폴백 회색(#626b7d)만 나오면 카테고리 매핑이 안 붙은 것이다.
  const distinct = new Set(Object.values(gutterColors));
  expect(distinct.size).toBeGreaterThan(2);

  // 거터가 텍스트가 아니라 3px 막대인지.
  const gutterBox = await list
    .locator(".cmd-item > .cmd-head > .cmd-prefix")
    .first()
    .evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
  expect(gutterBox.width).toBeGreaterThan(1);
  expect(gutterBox.width).toBeLessThan(6);
  expect(gutterBox.height).toBeGreaterThan(10);

  await screenshotEvidence(page, EVIDENCE_DIR, "block-canvas-full.png");
  await list.screenshot({ path: `${EVIDENCE_DIR}/block-canvas-list.png` });
});

function blockCanvasProject(): { project: Project; eventId: string } {
  const project = createBlankProject();
  const startMap = project.maps[project.startMapId];
  if (!startMap) throw new Error("missing start map");

  const mapId = project.startMapId;
  const variableId = project.variables[0]?.id ?? "";
  const switchId = project.switches[0]?.id ?? "";
  const itemId = project.database.items[0]?.id ?? "";

  // 카테고리 6종 + 2단 중첩 분기를 한 화면에.
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
  const eventId = "event_block_canvas_demo";
  startMap.events.push({
    id: eventId,
    name: "의뢰 중개인 미라",
    x: 8,
    y: 8,
    trigger: { kind: "action" },
    pages: [
      {
        id: "page_block_canvas_demo",
        name: "의뢰 중개인 미라",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      },
    ],
  } as never);
  return { project, eventId };
}
