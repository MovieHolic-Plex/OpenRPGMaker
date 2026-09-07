/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { PlayScene } from "@/player/PlayScene";
import { createDialogueUI } from "@/player/dialogue";
import { runCommands } from "@/player/playSceneInterpreter";

vi.mock("@/app/phaserRuntime", () => ({ getLoadedPhaser: () => ({ Scene: class {} }) }));

const previousProject = store.getCurrent();
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  store.replaceProject(previousProject);
});

function setup() {
  const project = createBlankProject();
  store.replaceProject(project);
  const host = document.createElement("div");
  document.body.append(host);
  const dialogue = createDialogueUI(host);
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing map choice fixture");
  const scene = Object.assign(new PlayScene(), {
    session: startSession(project),
    map,
    game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : key === "dialogueHost" ? host : undefined } },
    setInputEnabled: (value: boolean): void => { scene.inputEnabled = value; },
    refreshRuntimeSurfaces: (): void => {},
    clearRuntimeOverlay: (): void => {},
  });
  return { project, scene, dialogue, host };
}

describe("map choice cancellation after shared dialogue lifecycle repair", () => {
  it("settles an old event without rejection or stale work when the session is replaced", async () => {
    const { project, scene, dialogue, host } = setup();
    const oldSession = scene.session;
    const execution = runCommands(scene, [
      { kind: "choices", options: [{ text: "Continue", branch: [] }], cancelBehavior: "disallow" },
      { kind: "setFlag", flag: "stale_tail", value: true },
    ]);
    const settled = execution.then(() => ({ resolved: true }), error => ({ resolved: false, error }));
    expect(host.querySelector(".choices-active")).not.toBeNull();
    scene.session = startSession(project);
    scene.inputEnabled = false;
    dialogue.hide();
    expect(await settled).toEqual({ resolved: true });
    expect(oldSession.flags.stale_tail).toBeUndefined();
    expect(scene.session.flags.stale_tail).toBeUndefined();
    expect(scene.inputEnabled).toBe(false);
  });

  it("does not swallow a genuine dialogue failure", async () => {
    const { scene, dialogue } = setup();
    const failure = new Error("Injected dialogue failure");
    vi.spyOn(dialogue, "showChoices").mockRejectedValue(failure);
    await expect(runCommands(scene, [
      { kind: "choices", options: [{ text: "Continue", branch: [] }] },
    ])).rejects.toBe(failure);
  });
});
