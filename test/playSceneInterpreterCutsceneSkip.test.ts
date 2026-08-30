import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUTSCENE_END_LABEL } from "@/player/cutsceneControl";
import { runCommands } from "@/player/playSceneInterpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { installFakeDom } from "./fakeDom";

const cameraControl = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock("@/player/playSceneCamera", () => ({
  applyCameraControl: cameraControl,
}));

const SKIPPED_SWITCH = "sw_skipped_command";
const FINISHED_SWITCH = "sw_cutscene_finished";
const SKIP_HINT_TESTID = "cutscene-skip-hint";

type Fixture = {
  readonly project: Project;
  readonly scene: PlaySceneContext;
  readonly visibleOverlays: Map<string, string>;
};

function createFixture(): Fixture {
  const project = createBlankProject();
  const session = startSession(project, 7);
  session.switches[SKIPPED_SWITCH] = false;
  session.switches[FINISHED_SWITCH] = false;
  const registry = new Map<string, unknown>([[
    "dialogue",
    {
      showText: vi.fn(async () => undefined),
      showChoices: vi.fn(async () => 0),
      showNumberInput: vi.fn(async () => 0),
      hide: vi.fn(),
      close: vi.fn(),
    },
  ]]);
  const visibleOverlays = new Map<string, string>();
  const autonomousNPCs = new Map<string, unknown>();
  const scene = {
    session,
    running: false,
    inputEnabled: true,
    lastActionTargetKey: "",
    tileY: 0,
    map: { height: 1 },
    autonomousNPCs,
    commandMoveRouteEventIds: new Set(),
    playerRoute: null,
    moving: false,
    game: { registry: { get: (key: string) => registry.get(key) } },
    setInputEnabled: vi.fn(),
    refreshRuntimeSurfaces: vi.fn(),
    syncRuntimeState: vi.fn(),
    showRuntimeOverlay: (testId: string, text: string) => visibleOverlays.set(testId, text),
    clearRuntimeOverlay: (testId: string) => visibleOverlays.delete(testId),
    // The mover stays registered forever, so a wait on it can only end through a skip.
    registerAutonomousMover: (eventId: string) => autonomousNPCs.set(eventId, {}),
  } as unknown as PlaySceneContext;
  return { project, scene, visibleOverlays };
}

function skippableCutscene(blockingCommand: Command): readonly Command[] {
  return [
    { kind: "cutsceneControl", mode: "begin", skippable: true },
    blockingCommand,
    { kind: "setSwitch", switchId: SKIPPED_SWITCH, value: true },
    { kind: "label", name: CUTSCENE_END_LABEL },
    { kind: "cutsceneControl", mode: "end" },
    { kind: "setSwitch", switchId: FINISHED_SWITCH, value: true },
  ];
}

function pressEscape(): void {
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, { key: "Escape" });
  document.dispatchEvent(event);
}

// The blocked wait never settles on its own: the camera promise is pending forever and the
// mover only clears through animation frames this fixture never flushes. So the awaited
// promise below resolves only when the skip actually interrupts the wait.
async function expectDoubleEscapeSkips(fixture: Fixture, commands: readonly Command[]): Promise<void> {
  store.replaceProject(fixture.project);

  // When: the cutscene blocks and the player presses Escape twice.
  const running = runCommands(fixture.scene, commands);
  expect(fixture.scene.session.switches[SKIPPED_SWITCH]).toBe(false);
  await Promise.resolve();
  pressEscape();
  pressEscape();
  await running;

  // Then: execution jumps past the blocked content to the cutscene end label.
  expect(fixture.scene.session.switches[SKIPPED_SWITCH]).toBe(false);
  expect(fixture.scene.session.switches[FINISHED_SWITCH]).toBe(true);
}

let restoreDom: (() => void) | null = null;
let previousProject: Project | null = null;

beforeEach(() => {
  restoreDom = installFakeDom({ animationFrames: "manual" });
  previousProject = store.getCurrent();
  vi.spyOn(performance, "now").mockReturnValue(1_000);
  cameraControl.mockReset();
  cameraControl.mockImplementation(() => new Promise(() => undefined));
});

afterEach(() => {
  vi.restoreAllMocks();
  if (previousProject) store.replaceProject(previousProject);
  previousProject = null;
  restoreDom?.();
  restoreDom = null;
});

describe("skippable cutscene skip hint", () => {
  it("shows the hint while a skippable cutscene blocks and clears it when the cutscene ends", async () => {
    // Given: a skippable cutscene blocked on camera completion.
    const fixture = createFixture();
    store.replaceProject(fixture.project);
    const running = runCommands(
      fixture.scene,
      skippableCutscene({
        kind: "m2Command",
        commandId: "m2-201-camera-control",
        fields: { mode: "panTo", target: "screen", x: 3, y: 4, durationMs: 300, wait: true },
      })
    );

    // When: the player is waiting on the blocked camera move.
    // Then: the Korean skip hint is on screen, and it disappears once the cutscene finishes.
    expect(fixture.visibleOverlays.get(SKIP_HINT_TESTID)).toBe("Esc Esc: \ucef7\uc2e0 \uac74\ub108\ub6f0\uae30");

    pressEscape();
    pressEscape();
    await running;

    expect(fixture.visibleOverlays.has(SKIP_HINT_TESTID)).toBe(false);
  });

  it("leaves the hint hidden when the cutscene is not skippable", async () => {
    // Given: a cutscene that never enables skipping.
    const fixture = createFixture();
    store.replaceProject(fixture.project);
    cameraControl.mockResolvedValue(undefined);

    // When: it runs to completion.
    await runCommands(fixture.scene, [
      { kind: "cutsceneControl", mode: "begin", skippable: false },
      {
        kind: "m2Command",
        commandId: "m2-201-camera-control",
        fields: { mode: "panTo", target: "screen", x: 3, y: 4, durationMs: 300, wait: true },
      },
      { kind: "cutsceneControl", mode: "end" },
    ]);

    // Then: no skip hint was ever shown.
    expect(fixture.visibleOverlays.has(SKIP_HINT_TESTID)).toBe(false);
  });
});

describe("skippable cutscene blocking waits", () => {
  it("skips a camera wait on double Escape", async () => {
    // Given: a skippable cutscene blocked on camera completion.
    const fixture = createFixture();
    const commands = skippableCutscene({
      kind: "m2Command",
      commandId: "m2-201-camera-control",
      fields: { mode: "panTo", target: "screen", x: 3, y: 4, durationMs: 300, wait: true },
    });

    await expectDoubleEscapeSkips(fixture, commands);
    expect(cameraControl).toHaveBeenCalledOnce();
  });

  it("skips a move-event wait on double Escape", async () => {
    // Given: a skippable cutscene blocked on an unfinished event route.
    const fixture = createFixture();
    const commands = skippableCutscene({
      kind: "moveEvent",
      eventId: "npc",
      route: { moves: [{ kind: "move", dir: "right" }], repeat: false, wait: true },
    });

    await expectDoubleEscapeSkips(fixture, commands);
  });
});
