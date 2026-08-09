/** Page-3 (map and presentation) command body behavior contracts. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function stagedContext(initial: Command): {
  readonly context: CommandEditContext;
  readonly current: () => Command;
} {
  let staged = structuredClone(initial);
  return {
    context: {
      path: [1],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand: (_path, command) => { staged = structuredClone(command); },
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
      getCurrentCommand: () => staged,
    },
    current: () => staged,
  };
}

function m2(
  commandId: string,
  fields: Record<string, string | number | boolean> = {}
): Extract<Command, { kind: "m2Command" }> {
  return { kind: "m2Command", commandId, fields };
}


function change(node: FakeElement | null, value: string): void {
  expect(node).not.toBeNull();
  if (!node) return;
  node.value = value;
  node.dispatchEvent(new Event("change"));
}

function execute(command: Extract<Command, { kind: "m2Command" }>) {
  const project = store.getCurrent();
  const session = startSession(project);
  const entry = m2CommandById(command.commandId);
  expect(entry).toBeTruthy();
  if (entry) executeM2RuntimeCommand(session, entry, command, { project });
  return session;
}

describe("page3 command body UX (맵·연출)", () => {
  let restoreDom: (() => void) | undefined;
  let pictureResourceId = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    pictureResourceId =
      project.resources?.find?.((r) => (r as { kind?: string }).kind === "picture")?.id ??
      project.database.actors[0]?.faceResourceId ??
      "picture_sample";
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });


  describe("M2 page3 form-to-runtime contracts", () => {
    it("commits tint fields and applies them to runtime screen state", () => {
      const initial = m2("m2-046-tint-screen", { color: "neutral", value: "", duration: 0 });
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
      findByTestId(body, "tint-screen-color-blue")?.click();
      change(findByTestId(body, "tint-screen-duration-input"), "240");

      const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
      expect(command.fields).toMatchObject({ color: "blue", value: "", duration: 240 });
      const session = execute(command);
      expect(session.m2Runtime?.screen).toMatchObject({ tint: "blue", tintDurationMs: 240 });
    });

    it("commits flash fields and applies the flash color to runtime", () => {
      const initial = m2("m2-047-flash-screen", { color: "white", value: "white", durationMs: 180 });
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
      change(findByTestId(body, "flash-screen-color"), "red");
      change(findByTestId(body, "flash-screen-duration-input"), "320");

      const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
      expect(command.fields).toMatchObject({ color: "red", value: "red", durationMs: 320 });
      expect(execute(command).m2Runtime?.screen.flash).toBe("red");
    });

    it("commits shake fields and applies the intensity to runtime", () => {
      const initial = m2("m2-048-shake-screen", { intensity: "3", value: 3, durationMs: 300 });
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
      change(findByTestId(body, "shake-screen-intensity"), "6");
      change(findByTestId(body, "shake-screen-duration-input"), "450");

      const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
      expect(command.fields).toMatchObject({ intensity: "6", value: 6, durationMs: 450 });
      expect(execute(command).m2Runtime?.screen.shake).toBe(6);
    });

    it("commits scroll fields and applies the canonical map runtime record", () => {
      const initial = m2("m2-049-scroll-map", { direction: "down", distance: 1, speed: 4, wait: "true", mode: "return" });
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
      change(findByTestId(body, "scroll-map-direction"), "right");
      change(findByTestId(body, "scroll-map-distance-input"), "5");

      const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
      expect(command.fields).toMatchObject({ direction: "right", distance: 5, speed: 4, wait: "true", mode: "return" });
      expect(execute(command).m2Runtime?.map.scroll_map).toMatchObject({ value: "", x: 0, y: 0 });
    });

    it("commits weather fields and applies parsed weather to runtime", () => {
      const initial = m2("m2-050-set-weather-effects", { value: "none", transitionMs: 0, durationMs: 0 });
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
      findByTestId(body, "set-weather-effects-kind-snow")?.click();
      change(findByTestId(body, "set-weather-effects-intensity-input"), "0.75");
      change(findByTestId(body, "set-weather-effects-transition-input"), "400");

      const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
      expect(command.fields).toMatchObject({ value: "snow,0.75", transitionMs: 400, durationMs: 400 });
      expect(execute(command).m2Runtime?.screen.weather).toBe("snow,0.75");
    });

    it("commits picture movement and updates the runtime picture slot", () => {
      const initial = m2("m2-052-move-picture", { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9, durationMs: 0 });
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
      change(findByTestId(body, "move-picture-m2-x-input"), "24");
      change(findByTestId(body, "move-picture-m2-y-input"), "30");
      change(findByTestId(body, "move-picture-m2-duration-input"), "500");

      const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
      expect(command.fields).toMatchObject({ pictureId: "pic1", x: 24, y: 30, durationMs: 500, duration: 500 });
      const session = startSession(store.getCurrent());
      session.pictures = { pic1: { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9 } };
      executeM2RuntimeCommand(session, m2CommandById(command.commandId)!, command, { project: store.getCurrent() });
      expect(session.pictures.pic1).toMatchObject({ pictureId: "pic1", resourceId: pictureResourceId, x: 24, y: 30, durationMs: 500 });
    });

    it("commits encounter rate and applies the runtime map value", () => {
      const initial = m2("m2-070-set-encounter-rate", { value: 24, valueSource: "number", valueVariableId: "" });
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
      change(findByTestId(body, "set-encounter-rate-value-input"), "12");

      const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
      expect(command.fields).toMatchObject({ target: "map", operation: "set", value: 12, valueSource: "number" });
      expect(execute(command).m2Runtime?.map.encounter_rate?.value).toBe("12");
    });
  });

});
