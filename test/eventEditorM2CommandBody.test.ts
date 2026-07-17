import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const MOVE_PICTURE_COMMAND = {
  kind: "m2Command",
  commandId: "m2-052-move-picture",
  fields: {
    pictureId: "pic_cloud",
    resourceId: "easyrpg-picture-cloud",
    x: 12,
    y: 34,
  },
} satisfies Command;

function contextWithReplaceSpy(replaceCommand: CommandEditContext["actions"]["replaceCommand"]): CommandEditContext {
  return {
    path: [2],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

describe("event editor M2 command body", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    const firstActor = project.database.actors[0];
    const firstClass = project.database.classes[0];
    const firstAnimation = project.database.battleAnimations[0];
    if (firstActor) firstActor.name = "테스트 주인공";
    if (firstClass) firstClass.name = "테스트 직업";
    if (firstAnimation) firstAnimation.name = "테스트 애니메이션";
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders Move Picture with a friendly picture resource picker and preview instead of a raw resource id input", () => {
    const context = contextWithReplaceSpy(vi.fn());

    const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));

    expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
    expect(findByTestId(body, "m2-command-resourceId-input")).toBeNull();
    const picker = findByTestId(body, "m2-command-resourceId-picker");
    const preview = findByTestId(body, "m2-command-resourceId-preview");
    expect(picker?.tagName).toBe("SELECT");
    expect(picker?.attrs["aria-label"]).toBe("그림 리소스 선택");
    expect(picker?.value).toBe("easyrpg-picture-cloud");
    expect(picker?.textContent).toContain("EasyRPG RTP Cloud Picture");
    expect(preview?.attrs["aria-label"]).toBe("선택한 그림 리소스 미리보기");
    expect(preview?.textContent).toContain("EasyRPG RTP Cloud Picture");
  });

  it("keeps Move Picture numeric fields editable through the normal command replace path", () => {
    const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
    const context = contextWithReplaceSpy(replaceCommand);

    const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));
    const pictureId = findByTestId(body, "m2-command-pictureId-input");
    const x = findByTestId(body, "m2-command-x-input");
    const y = findByTestId(body, "m2-command-y-input");
    expect(pictureId?.value).toBe("pic_cloud");
    expect(x?.value).toBe("12");
    expect(y?.value).toBe("34");
    if (!x) throw new Error("missing Move Picture X input");

    x.value = "48";
    x.dispatchEvent(new Event("change"));

    expect(replaceCommand).toHaveBeenCalledWith([2], {
      ...MOVE_PICTURE_COMMAND,
      fields: {
        ...MOVE_PICTURE_COMMAND.fields,
        x: 48,
      },
    });
  });

  it("renders database-backed generic command ids as Korean record selectors instead of raw text inputs", () => {
    const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
    const context = contextWithReplaceSpy(replaceCommand);

    const body = renderWithFakeDom(
      () =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-091-change-actor-class",
          fields: { target: "actor_hero", operation: "set", value: "class_hero" },
        }) ?? document.createElement("div")
    );

    expect(Boolean(findByTestId(body, "m2-command-target-input"))).toBe(false);
    expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
    const actor = findByTestId(body, "m2-command-target-record-select");
    const actorName = findByTestId(body, "m2-command-target-record-selected-name");
    const actorClass = findByTestId(body, "m2-command-value-record-select");
    expect(actor?.tagName).toBe("SELECT");
    expect(actor?.attrs["aria-label"]).toBe("주인공 선택");
    expect(actor?.textContent).toContain("테스트 주인공");
    expect(actorName?.textContent).toContain("테스트 주인공");
    expect(actorClass?.tagName).toBe("SELECT");
    expect(actorClass?.attrs["aria-label"]).toBe("직업 선택");
    expect(actorClass?.textContent).toContain("테스트 직업");
  });

  it("renders generic animation ids as battle animation record selectors", () => {
    const context = contextWithReplaceSpy(vi.fn());

    const body = renderWithFakeDom(
      () =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-054-show-animation",
          fields: { target: "this-event", animationId: "anim_sword" },
        }) ?? document.createElement("div")
    );

    expect(Boolean(findByTestId(body, "m2-command-animationId-input"))).toBe(false);
    const animation = findByTestId(body, "m2-command-animationId-record-select");
    expect(animation?.tagName).toBe("SELECT");
    expect(animation?.attrs["aria-label"]).toBe("전투 애니메이션 선택");
    expect(animation?.textContent).toContain("테스트 애니메이션");
  });

  it("renders system graphic values as resource selectors with a preview", () => {
    const context = contextWithReplaceSpy(vi.fn());

    const body = renderWithFakeDom(
      () =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-029-change-system-graphic",
          fields: { target: "window", operation: "set", value: "easyrpg-system-system" },
        }) ?? document.createElement("div")
    );

    expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
    const picker = findByTestId(body, "m2-command-value-resource-picker");
    const preview = findByTestId(body, "m2-command-value-resource-preview");
    expect(picker?.tagName).toBe("SELECT");
    expect(picker?.attrs["aria-label"]).toBe("시스템 그래픽 선택");
    expect(picker?.textContent).toContain("EasyRPG RTP System System");
    expect(preview?.dataset.resourceId).toBe("easyrpg-system-system");
  });

  it("renders map/event location commands with friendly event, map, and coordinate controls", () => {
    const context = contextWithReplaceSpy(vi.fn());

    const body = renderWithFakeDom(
      () =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-040-set-event-location",
          fields: { target: "event_starter_mina", mapId: "map_starter_village", x: 3, y: 4 },
        }) ?? document.createElement("div")
    );

    expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
    expect(findByTestId(body, "m2-command-target-record-select")?.tagName).toBe("SELECT");
    expect(findByTestId(body, "m2-command-mapId-record-select")?.tagName).toBe("SELECT");
    expect(findByTestId(body, "m2-command-x-input")?.value).toBe("3");
    expect(findByTestId(body, "m2-command-y-input")?.value).toBe("4");
  });

  it("renders modern commands as guided controls instead of raw note fields", () => {
    const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
    const context = contextWithReplaceSpy(replaceCommand);

    const body = renderWithFakeDom(
      () =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-201-camera-control",
          fields: { mode: "panTo", target: "player", x: 10, y: 12, zoom: 1.25, durationMs: 450 },
        }) ?? document.createElement("div")
    );

    expect(body.textContent).toContain("필요한 값을 선택하고 확인을 누르세요.");
    expect(findByTestId(body, "m2-command-mode-option-select")?.tagName).toBe("SELECT");
    expect(findByTestId(body, "m2-command-target-option-select")?.tagName).toBe("SELECT");
    expect(findByTestId(body, "m2-command-x-input")?.value).toBe("10");
    expect(findByTestId(body, "m2-command-y-input")?.value).toBe("12");
    expect(findByTestId(body, "m2-command-zoom-input")?.value).toBe("1.25");
    expect(findByTestId(body, "m2-command-durationMs-input")?.value).toBe("450");
    expect(findByTestId(body, "m2-command-note-input")).toBeNull();
  });

  it("routes Advanced Dialogue into the native text form (merged)", async () => {
    // Advanced Dialogue is now existingKind:text — generic m2 body is not used.
    const { m2CommandById } = await import("@/editor/eventCommands/m2Catalog");
    const entry = m2CommandById("m2-209-advanced-dialogue");
    expect(entry?.existingKind).toBe("text");
    expect(entry?.bodyStrategy).toBe("existing");
  });

  it("explains Wait for All Movement intent for authors", () => {
    const context = contextWithReplaceSpy(vi.fn());
    const body = renderWithFakeDom(() =>
      renderM2CommandBody(context, {
        kind: "m2Command",
        commandId: "m2-058-wait-for-all-movement",
        fields: {},
      }) ?? document.createElement("div")
    );

    expect(findByTestId(body, "m2-command-intent-card")).not.toBeNull();
    expect(findByTestId(body, "m2-command-intent-body")?.textContent).toContain("강제 이동");
    expect(findByTestId(body, "m2-command-no-params")).not.toBeNull();
    expect(findByTestId(body, "m2-command-note-input")).toBeNull();
    expect(body.textContent).toContain("대기 대상");
    expect(body.textContent).not.toContain("필요한 값을 선택하고 확인을 누르세요");
  });

});
