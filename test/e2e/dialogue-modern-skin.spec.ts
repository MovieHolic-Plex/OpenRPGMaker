import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

const EVIDENCE_DIR = "output/evidence/dialogue-modern-skin";

test("modern dialogue skin stays adaptive across chip, bust, choices, and transparent top states", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await seedProjectFromSupabaseCanonical(page, modernDialogueProject());
  await page.getByTestId("mode-play").click({ force: true });
  await startNewGameFromTitle(page);

  await page.getByTestId("event-ev_modern_chip").click({ force: true });
  const dialogueBox = page.getByTestId("dialogue-box");
  await expect(dialogueBox).toContainText("몬스터 회복 센터에 오신 걸 환영합니다.");

  const chipState = await readDialogueState(page);
  expect(chipState.box.borderWidth).toBeLessThanOrEqual(2);
  expect(chipState.box.borderImageSource).toBe("none");
  expect(chipState.box.borderRadius).toBeGreaterThanOrEqual(4);
  expect(chipState.box.backgroundImage).toContain("gradient");
  expect(chipState.box.leftGutter).toBeGreaterThanOrEqual(16);
  expect(chipState.box.rightGutter).toBeGreaterThanOrEqual(16);
  expect(chipState.face?.mode).toBe("chip");
  expect(chipState.face?.right).toBeLessThanOrEqual((chipState.body?.left ?? 0) + 1);
  await capture(page, "dialogue-chip-1280.png");
  await page.setViewportSize({ width: 768, height: 768 });
  await capture(page, "dialogue-chip-768.png");
  await page.setViewportSize({ width: 375, height: 812 });
  await capture(page, "dialogue-chip-375.png");
  await page.setViewportSize({ width: 1280, height: 900 });

  await finishDialogue(page);
  await expect(page.getByTestId("runtime-choice-1")).toContainText("상태를 확인한다");
  const selectedChoice = await page.locator(".choice-btn.selected").evaluate((node) => {
    if (!(node instanceof HTMLElement)) throw new Error("selected choice is not an element");
    const style = getComputedStyle(node);
    return {
      borderRadius: parseFloat(style.borderRadius),
      backgroundColor: style.backgroundColor,
    };
  });
  expect(selectedChoice.borderRadius).toBeGreaterThanOrEqual(2);
  expect(selectedChoice.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  await capture(page, "dialogue-choices-1280.png");
  await page.keyboard.press("Enter");

  await page.getByTestId("event-ev_modern_bust").click({ force: true });
  await expect(dialogueBox).toContainText("큰 초상화도 본문을 가리지 않습니다.");
  const bustState = await readDialogueState(page);
  expect(bustState.face?.mode).toBe("bust");
  expect(bustState.face?.right).toBeLessThanOrEqual((bustState.body?.left ?? 0) + 1);
  await capture(page, "dialogue-bust-1280.png");
  await finishDialogue(page);

  await page.getByTestId("event-ev_modern_top").click({ force: true });
  await expect(dialogueBox).toContainText("플레이어를 가리면 위로 이동합니다.");
  await expect(dialogueBox).toHaveAttribute("data-message-format", "transparent");
  await expect(dialogueBox).toHaveAttribute("data-message-position", "top");
  const topState = await readDialogueState(page);
  expect(topState.box.top).toBeLessThan(topState.stage.top + topState.stage.height / 2);
  expect(topState.box.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  await capture(page, "dialogue-transparent-top-1280.png");
});

type DialogueState = {
  readonly stage: { readonly top: number; readonly height: number };
  readonly box: {
    readonly top: number;
    readonly borderWidth: number;
    readonly borderRadius: number;
    readonly borderImageSource: string;
    readonly backgroundColor: string;
    readonly backgroundImage: string;
    readonly leftGutter: number;
    readonly rightGutter: number;
  };
  readonly face?: { readonly mode: string; readonly right: number };
  readonly body?: { readonly left: number };
};

async function readDialogueState(page: Page): Promise<DialogueState> {
  return page.evaluate(() => {
    const stage = document.querySelector(".play-stage");
    const box = document.querySelector('[data-testid="dialogue-box"]');
    if (!(stage instanceof HTMLElement) || !(box instanceof HTMLElement)) {
      throw new Error("dialogue stage is not rendered");
    }
    const stageRect = stage.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const boxStyle = getComputedStyle(box);
    const face = box.querySelector('[data-testid="dialogue-face"]');
    const body = box.querySelector(".body");
    const faceRect = face instanceof HTMLElement ? face.getBoundingClientRect() : undefined;
    const bodyRect = body instanceof HTMLElement ? body.getBoundingClientRect() : undefined;
    return {
      stage: { top: stageRect.top, height: stageRect.height },
      box: {
        top: boxRect.top,
        borderWidth: parseFloat(boxStyle.borderTopWidth),
        borderRadius: parseFloat(boxStyle.borderRadius),
        borderImageSource: boxStyle.borderImageSource,
        backgroundColor: boxStyle.backgroundColor,
        backgroundImage: boxStyle.backgroundImage,
        leftGutter: boxRect.left - stageRect.left,
        rightGutter: stageRect.right - boxRect.right,
      },
      ...(faceRect && face instanceof HTMLElement
        ? { face: { mode: face.dataset.faceMode ?? "", right: faceRect.right } }
        : {}),
      ...(bodyRect ? { body: { left: bodyRect.left } } : {}),
    };
  });
}

async function finishDialogue(page: Page): Promise<void> {
  const box = page.getByTestId("dialogue-box");
  await box.click({ force: true });
}

async function capture(page: Page, filename: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${filename}`, animations: "disabled" });
}

function modernDialogueProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project start map is missing");
  map.events.push(
    event("ev_modern_chip", 4, 4, [
      { kind: "changeFace", resourceId: "easyrpg-faceset-actor1", faceIndex: 0, position: "left", flipHorizontally: false },
      { kind: "text", speaker: "접수원", body: "몬스터 회복 센터에 오신 걸 환영합니다." },
      {
        kind: "choices",
        prompt: "도와드릴 일이 있을까요?",
        cancelBehavior: "choice2",
        options: [
          { text: "몬스터를 회복한다", branch: [] },
          { text: "상태를 확인한다", branch: [] },
        ],
      },
    ]),
    event("ev_modern_bust", 5, 4, [
      { kind: "changeFace", resourceId: "generated-face-actor1-bust", faceIndex: 0, position: "left", flipHorizontally: false },
      { kind: "text", speaker: "접수원", body: "큰 초상화도 본문을 가리지 않습니다." },
    ]),
    event("ev_modern_top", 6, 4, [
      {
        kind: "displayTextSettings",
        format: "transparent",
        position: "top",
        preventObscuringPlayer: false,
        allowEventMovementDuringWait: false,
      },
      { kind: "text", speaker: "안내", body: "플레이어를 가리면 위로 이동합니다." },
    ]),
  );
  return project;
}

function event(id: string, x: number, y: number, commands: Command[]): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
}
