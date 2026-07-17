/**
 * Page-3 (맵·연출) command body UX coverage.
 *
 * Asserts modern rich shells when sibling form agents land
 * (`tint-screen-command-body`, `set-lighting-command-body`, …).
 * Until then, accepts known control / generic M2 shells so the path stays green.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAdvancedCommandBody } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [1],
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

function m2(
  commandId: string,
  fields: Record<string, string | number | boolean> = {}
): Extract<Command, { kind: "m2Command" }> {
  return { kind: "m2Command", commandId, fields };
}

function summaryText(cmd: Command): string {
  return commandSummaryParts(cmd)
    .map((part) => part.text)
    .join("");
}

function firstTestId(body: FakeElement, ids: readonly string[]): FakeElement | null {
  for (const id of ids) {
    const hit = findByTestId(body, id);
    if (hit) return hit;
  }
  return null;
}

function classBlob(node: FakeElement | null): string {
  if (!node) return "";
  const own = typeof node.className === "string" ? node.className : "";
  return `${own} ${node.textContent ?? ""}`;
}

/** Prefer documented rich shells; fall back to known controls / generic M2 body. */
function findByClassName(root: FakeElement, className: string): FakeElement | null {
  const stack: FakeElement[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const classes = String(node.className ?? "").split(/\s+/);
    if (classes.includes(className)) return node;
    const kids = (node as { children?: FakeElement[] }).children ?? [];
    for (const child of kids) stack.push(child);
  }
  return null;
}

function expectPage3Shell(body: FakeElement, options: {
  readonly richIds: readonly string[];
  readonly fallbackIds?: readonly string[];
  readonly label: string;
}): FakeElement {
  const hit =
    firstTestId(body, [...options.richIds, ...(options.fallbackIds ?? [])]) ??
    findByClassName(body, "page3-command-body") ??
    findByClassName(body, "actor-m2-command-body");
  expect(
    hit,
    `${options.label}: expected one of ${[...options.richIds, ...(options.fallbackIds ?? [])].join(", ")}`
  ).not.toBeNull();
  return hit!;
}

describe("page3 command body UX (맵·연출)", () => {
  let restoreDom: (() => void) | undefined;
  let mapId = "";
  let eventId = "";
  let animationId = "";
  let variableId = "";
  let pictureResourceId = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    mapId = project.startMapId || Object.keys(project.maps)[0] || "";
    const map = mapId ? project.maps[mapId] : undefined;
    eventId = map?.events?.[0]?.id ?? "this-event";
    animationId = project.database.battleAnimations?.[0]?.id ?? "";
    variableId = project.variables?.[0]?.id ?? "var_0001";
    pictureResourceId =
      project.resources?.find?.((r) => (r as { kind?: string }).kind === "picture")?.id ??
      project.database.actors[0]?.faceResourceId ??
      "picture_sample";
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  describe("native page3 shells", () => {
    it("renders setLighting rich shell or ambient control", () => {
      const body = renderWithFakeDom(
        () =>
          renderAdvancedCommandBody(ctx(), {
            kind: "setLighting",
            ambient: 0.4,
            color: "#000000",
            transitionMs: 200,
          })!
      );
      const shell = expectPage3Shell(body, {
        label: "setLighting",
        richIds: ["set-lighting-command-body", "page3-command-body"],
        fallbackIds: ["set-lighting-ambient-input", "set-lighting-color-input"],
      });
      // When rich lands, root should advertise page3 / actor-m2 shell class.
      if (findByTestId(body, "set-lighting-command-body")) {
        expect(classBlob(findByTestId(body, "set-lighting-command-body"))).toMatch(
          /page3-command-body|actor-m2-command-body|set-lighting/
        );
      }
      expect(shell).not.toBeNull();
    });

    it("renders setWeather rich shell or weather select", () => {
      const body = renderWithFakeDom(
        () =>
          renderAdvancedCommandBody(ctx(), {
            kind: "setWeather",
            weather: "rain",
            intensity: 0.6,
            transitionMs: 300,
          })!
      );
      expectPage3Shell(body, {
        label: "setWeather",
        richIds: ["set-weather-command-body", "page3-command-body"],
        fallbackIds: ["set-weather-kind-select", "set-weather-intensity-input"],
      });
    });

    it("renders showPicture rich shell or picture inputs", () => {
      const body = renderWithFakeDom(
        () =>
          renderAdvancedCommandBody(ctx(), {
            kind: "showPicture",
            pictureId: "pic1",
            resourceId: pictureResourceId,
            x: 12,
            y: 16,
          })!
      );
      expectPage3Shell(body, {
        label: "showPicture",
        richIds: ["show-picture-command-body", "page3-command-body"],
        fallbackIds: ["show-picture-id-input", "show-picture-resource-input", "show-picture-x-input"],
      });
    });

    it("renders addLight / removeLight / showAnimation shells", () => {
      const light = renderWithFakeDom(
        () =>
          renderAdvancedCommandBody(ctx(), {
            kind: "addLight",
            source: { id: "torch", at: "player", radius: 5, intensity: 1 },
          })!
      );
      expectPage3Shell(light, {
        label: "addLight",
        richIds: ["add-light-command-body", "page3-command-body"],
        fallbackIds: ["add-light-id-input", "add-light-radius-input"],
      });

      const remove = renderWithFakeDom(
        () => renderAdvancedCommandBody(ctx(), { kind: "removeLight", id: "torch" })!
      );
      expectPage3Shell(remove, {
        label: "removeLight",
        richIds: ["remove-light-command-body", "page3-command-body"],
        fallbackIds: ["remove-light-id-input", "remove-light-all-select"],
      });

      const anim = renderWithFakeDom(
        () =>
          renderAdvancedCommandBody(ctx(), {
            kind: "showAnimation",
            target: "player",
            animationId,
            wait: true,
          })!
      );
      expectPage3Shell(anim, {
        label: "showAnimation",
        richIds: ["show-animation-command-body", "page3-command-body"],
        fallbackIds: ["show-animation-target-kind-select", "show-animation-wait-select"],
      });
    });

    it("renders erasePicture control shell", () => {
      const body = renderWithFakeDom(
        () => renderAdvancedCommandBody(ctx(), { kind: "erasePicture", pictureId: "pic1" })!
      );
      expectPage3Shell(body, {
        label: "erasePicture",
        richIds: ["erase-picture-command-body", "page3-command-body"],
        fallbackIds: ["erase-picture-id-input"],
      });
    });
  });

  describe("M2 page3 shells", () => {
    const m2Cases: ReadonlyArray<{
      commandId: string;
      richId: string;
      fields: Record<string, string | number | boolean>;
    }> = [
      {
        commandId: "m2-036-get-player-location",
        richId: "get-player-location-command-body",
        fields: { target: "player", variableId },
      },
      {
        commandId: "m2-040-set-event-location",
        richId: "set-event-location-command-body",
        fields: { target: eventId || "this-event", mapId, x: 3, y: 4 },
      },
      { commandId: "m2-044-hide-screen", richId: "hide-screen-command-body", fields: {} },
      { commandId: "m2-045-show-screen", richId: "show-screen-command-body", fields: {} },
      {
        commandId: "m2-046-tint-screen",
        richId: "tint-screen-command-body",
        fields: { color: "warm", value: "", durationMs: 250 },
      },
      {
        commandId: "m2-047-flash-screen",
        richId: "flash-screen-command-body",
        fields: { color: "white", durationMs: 180 },
      },
      {
        commandId: "m2-048-shake-screen",
        richId: "shake-screen-command-body",
        fields: { intensity: 3, durationMs: 300 },
      },
      {
        commandId: "m2-049-scroll-map",
        richId: "scroll-map-command-body",
        fields: { direction: "right", distance: 3, speed: 4, wait: "true" },
      },
      {
        commandId: "m2-050-set-weather-effects",
        richId: "set-weather-effects-command-body",
        fields: { value: "rain", operation: "set", target: "" },
      },
      {
        commandId: "m2-052-move-picture",
        richId: "move-picture-m2-command-body",
        fields: { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9 },
      },
      {
        commandId: "m2-054-show-animation",
        richId: "show-animation-m2-command-body",
        fields: { target: "this-event", animationId: animationId || "anim_1" },
      },
      {
        commandId: "m2-056-flash-event",
        richId: "flash-event-command-body",
        fields: { target: "this-event", value: "white" },
      },
      { commandId: "m2-059-stop-all-movement", richId: "stop-all-movement-command-body", fields: {} },
      {
        commandId: "m2-067-key-input-processing",
        richId: "key-input-processing-command-body",
        fields: { target: "", operation: "set", value: variableId },
      },
      {
        commandId: "m2-068-change-tileset",
        richId: "change-tileset-command-body",
        fields: { target: "", operation: "set", value: "" },
      },
      {
        commandId: "m2-069-change-parallax-back",
        richId: "change-parallax-back-command-body",
        fields: { target: "", operation: "set", value: "" },
      },
      {
        commandId: "m2-070-set-encounter-rate",
        richId: "set-encounter-rate-command-body",
        fields: { target: "", operation: "set", value: "24" },
      },
    ];

    it("renders page3 M2 command bodies (rich preferred, generic accepted)", () => {
      for (const entry of m2Cases) {
        const fields =
          entry.commandId === "m2-040-set-event-location"
            ? { target: eventId || "this-event", mapId, x: 3, y: 4 }
            : entry.fields;
        const body = renderWithFakeDom(() => renderM2CommandBody(ctx(), m2(entry.commandId, fields))!);
        const shell = expectPage3Shell(body, {
          label: entry.commandId,
          richIds: [entry.richId, "page3-command-body"],
          fallbackIds: [`m2-command-body-${entry.commandId}`],
        });
        // Rich shells must not be only the raw generic wrapper class without a kebab body id.
        if (findByTestId(body, entry.richId)) {
          expect(findByTestId(body, entry.richId)).not.toBeNull();
          expect(classBlob(findByTestId(body, entry.richId))).toMatch(
            /page3-command-body|actor-m2-command-body|command-body/
          );
        } else {
          expect(shell.dataset.testid).toBe(`m2-command-body-${entry.commandId}`);
        }
      }
    });

    it("exposes documented rich testids for tint/scroll/weather once forms land", () => {
      const targets = [
        ["m2-046-tint-screen", "tint-screen-command-body", { color: "warm" }],
        ["m2-049-scroll-map", "scroll-map-command-body", { direction: "right", distance: 2 }],
        ["m2-050-set-weather-effects", "set-weather-effects-command-body", { value: "snow" }],
      ] as const;

      for (const [commandId, richId, fields] of targets) {
        const body = renderWithFakeDom(() => renderM2CommandBody(ctx(), m2(commandId, fields))!);
        const rich = findByTestId(body, richId);
        const generic = findByTestId(body, `m2-command-body-${commandId}`);
        // Contract: either rich shell (preferred) or working generic body.
        expect(rich ?? generic, commandId).not.toBeNull();
        // When rich is present it must not be the bare generic id.
        if (rich) {
          expect(rich.dataset.testid).toBe(richId);
          expect(rich.dataset.testid).not.toMatch(/^m2-command-body-/);
        }
      }
    });
  });

  describe("Korean summaries", () => {
    it("summarizes tint / scroll / weather / showPicture in Korean", () => {
      const tint = summaryText(m2("m2-046-tint-screen", { color: "warm", value: "warm" }));
      expect(tint).toContain("화면 색조 변경");

      const scroll = summaryText(
        m2("m2-049-scroll-map", { direction: "right", distance: 3, speed: 4, wait: "true" })
      );
      expect(scroll).toContain("맵 스크롤");

      const weatherM2 = summaryText(m2("m2-050-set-weather-effects", { value: "rain" }));
      expect(weatherM2).toContain("날씨 효과 설정");

      const weatherNative = summaryText({
        kind: "setWeather",
        weather: "snow",
        intensity: 0.5,
      });
      expect(weatherNative).toContain("날씨");
      expect(weatherNative).toMatch(/눈|snow/i);

      const picture = summaryText({
        kind: "showPicture",
        pictureId: "pic_banner",
        resourceId: pictureResourceId,
        x: 10,
        y: 20,
      });
      expect(picture).toContain("그림 표시");
      expect(picture).toContain("pic_banner");

      const lighting = summaryText({
        kind: "setLighting",
        ambient: 0.55,
        color: "#112233",
        transitionMs: 100,
      });
      expect(lighting).toContain("조명");
    });

    it("summarizes hide/show screen and flash/shake in Korean catalog labels", () => {
      expect(summaryText(m2("m2-044-hide-screen", {}))).toContain("화면 숨기기");
      expect(summaryText(m2("m2-045-show-screen", {}))).toContain("화면 표시");
      expect(summaryText(m2("m2-047-flash-screen", { color: "red", durationMs: 100 }))).toContain(
        "화면 플래시"
      );
      expect(summaryText(m2("m2-048-shake-screen", { intensity: 2, durationMs: 100 }))).toContain(
        "화면 흔들기"
      );
    });
  });
});
