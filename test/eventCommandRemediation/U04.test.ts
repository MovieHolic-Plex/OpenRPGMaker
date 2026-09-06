import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { resolveMovieResourceUrl } from "@/editor/panels/eventEditor/playMoviePreview";
import { createInterpreter } from "@/player/interpreter";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import type { Command, Project } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "../fakeDom";
import {
  mediaProject, movie, MOVIE_URL, OTHER_MOVIE_ID,
  persisted, picture, SENTINEL, type MediaCommand,
} from "./U04.fixture";

function control(testId: string): FakeElement {
  const element = findByTestId(document.body as unknown as FakeElement, testId);
  if (!element) throw new Error(`Missing intended media control: ${testId}`);
  return element;
}

function change(testId: string, value: string): void {
  const element = control(testId);
  element.value = value;
  element.dispatchEvent(new Event("change"));
}

// Use the production dialog's staged replaceCommand, Confirm and Cancel callbacks.
// This fixture does not implement a substitute transaction or patch the form output.
function openMedia(command: MediaCommand) {
  const onApply = vi.fn<(command: Command) => void>();
  openEventCommandEditDialog({ initial: command, onApply });
  return {
    onApply,
    confirm(): MediaCommand {
      control("event-command-edit-ok").click();
      const saved = onApply.mock.calls.at(-1)?.[0];
      if (!saved || (saved.kind !== "showPicture" && saved.kind !== "playMovie")) {
        throw new Error("U04 Confirm did not apply a media command");
      }
      return saved;
    },
    cancel(): void { control("event-command-edit-cancel").click(); },
  };
}

let restoreDom: () => void;
let previousProject: Project;
beforeEach(() => {
  restoreDom = installFakeDom();
  resetModalStackForTest();
  previousProject = store.getCurrent();
  store.replace(mediaProject());
});
afterEach(() => {
  // Also close dialogs left open by the intentionally RED missing-control checks.
  document.body.replaceChildren();
  resetModalStackForTest();
  store.replace(previousProject);
  restoreDom();
});

describe("G3-F10 native showPicture optional wait preservation", () => {
  const cases = [500, 0].flatMap((durationMs) =>
    [true, false, undefined].map((waitForPicture) => ({ durationMs, waitForPicture })),
  );
  it.each(cases)("coordinate edit preserves wait=$waitForPicture at duration=$durationMs through Confirm/deserialize/reopen", ({ durationMs, waitForPicture }) => {
    // Explicitly remove the field for omitted cases; the fixture's default is authored true.
    const initial = picture(waitForPicture, durationMs);
    if (waitForPicture === undefined) delete initial.waitForPicture;
    const original = structuredClone(initial);
    const dialog = openMedia(initial);
    change("show-picture-x-input", "30");
    expect(dialog.onApply).not.toHaveBeenCalled();
    expect(initial).toEqual(original);
    const saved = dialog.confirm();
    const loaded = persisted(saved);
    const expected = { ...original, x: 30 };
    expect.soft(saved).toEqual(expected);
    expect.soft(loaded.command).toEqual(expected);

    const reopened = openMedia(loaded.command);
    expect(control("show-picture-x-input").value).toBe("30");
    expect(control("show-picture-y-input").value).toBe("20");
    expect(control("show-picture-scale-input").value).toBe("50");
    expect(control("show-picture-opacity-input").value).toBe("50");
    expect(control("show-picture-rotation-input").value).toBe("15");
    expect(control("show-picture-duration-input").value).toBe(String(durationMs));
    reopened.cancel();
    expect(reopened.onApply).not.toHaveBeenCalled();
    const interpreter = createInterpreter([loaded.command, SENTINEL], startSession(loaded.project, 4), loaded.project);
    expect.soft(interpreter.start()).toMatchObject({ ...expected, waitForPicture });
    expect(interpreter.resume(undefined)).toMatchObject(SENTINEL);
  });

  it.each([true, false])("exposes an editable wait toggle; authored $0 survives a later coordinate edit", (waitForPicture) => {
    const dialog = openMedia(picture(!waitForPicture));
    // Intended new control follows the existing native animation/movie segmented-select API.
    // No such control exists at the audited base; absence is itself part of G3-F10.
    expect(control("show-picture-wait-select").value).toBe(String(!waitForPicture));
    control(`show-picture-wait-select-segment-${waitForPicture}`).click();
    change("show-picture-x-input", "30");
    expect(persisted(dialog.confirm()).command).toEqual({ ...picture(waitForPicture), x: 30 });
  });

  it.each([true, false, undefined])("parser/interpreter characterization: unedited wait=$0 is not lost downstream", (waitForPicture) => {
    const initial = picture(waitForPicture);
    if (waitForPicture === undefined) delete initial.waitForPicture;
    const loaded = persisted(initial);
    expect(loaded.command).toEqual(initial);
    const interpreter = createInterpreter([loaded.command, SENTINEL], startSession(loaded.project, 4), loaded.project);
    expect(interpreter.start()).toMatchObject({ ...initial, waitForPicture });
    expect(interpreter.resume(undefined)).toMatchObject(SENTINEL);
  });
});

describe("G5-F2 native playMovie default-true and explicit-false contract", () => {
  const combinations = [
    { wait: true, skippable: true }, { wait: true, skippable: false },
    { wait: false, skippable: true }, { wait: false, skippable: false },
  ];

  it.each(["wait", "skippable"] as const)("omitted %s opens as true, matching the interpreter", (field) => {
    const loaded = persisted(movie());
    const interpreter = createInterpreter([loaded.command], startSession(loaded.project, 4), loaded.project);
    expect(interpreter.start()).toMatchObject({ kind: "playMovie", wait: true, skippable: true });
    const dialog = openMedia(loaded.command);
    expect.soft(control(`play-movie-${field}-select`).value).toBe("true");
    expect.soft(control(`play-movie-${field}-select-segment-true`).getAttribute("aria-pressed")).toBe("true");
    dialog.cancel();
    expect(dialog.onApply).not.toHaveBeenCalled();
  });

  it.each(combinations)("resource edit retains independent wait=$wait skippable=$skippable", (flags) => {
    const initial = movie(flags);
    const original = structuredClone(initial);
    const dialog = openMedia(initial);
    expect(control("play-movie-wait-select").value).toBe(String(flags.wait));
    expect(control("play-movie-skippable-select").value).toBe(String(flags.skippable));
    change("play-movie-resource-select", OTHER_MOVIE_ID);
    expect(dialog.onApply).not.toHaveBeenCalled();
    expect(initial).toEqual(original);
    const saved = dialog.confirm();
    const loaded = persisted(saved);
    const expected = { ...original, resourceId: OTHER_MOVIE_ID };
    expect.soft(saved).toEqual(expected);
    expect.soft(loaded.command).toEqual(expected);
    expect(resolveMovieResourceUrl(OTHER_MOVIE_ID, loaded.project)).toBe(MOVIE_URL);
    const reopened = openMedia(loaded.command);
    expect.soft(control("play-movie-wait-select").value).toBe(String(flags.wait));
    expect.soft(control("play-movie-skippable-select").value).toBe(String(flags.skippable));
    expect(control("play-movie-preview-video").getAttribute("src")).toBe(MOVIE_URL);
    reopened.cancel();
    expect(reopened.onApply).not.toHaveBeenCalled();
    const interpreter = createInterpreter([loaded.command], startSession(loaded.project, 4), loaded.project);
    expect.soft(interpreter.start()).toEqual(expected);
  });

  it.each(combinations)("explicit toggle selection saves wait=$wait skippable=$skippable, not default-true omission", (flags) => {
    const dialog = openMedia(movie({ wait: !flags.wait, skippable: !flags.skippable }));
    control(`play-movie-wait-select-segment-${flags.wait}`).click();
    control(`play-movie-skippable-select-segment-${flags.skippable}`).click();
    const saved = dialog.confirm();
    const loaded = persisted(saved);
    expect.soft(saved).toEqual(movie(flags));
    expect.soft(loaded.command).toEqual(movie(flags));
    const reopened = openMedia(loaded.command);
    expect.soft(control("play-movie-wait-select").value).toBe(String(flags.wait));
    expect.soft(control("play-movie-skippable-select").value).toBe(String(flags.skippable));
    reopened.cancel();
    const interpreter = createInterpreter([loaded.command], startSession(loaded.project, 4), loaded.project);
    expect.soft(interpreter.start()).toEqual(movie(flags));
  });

  it.each<{ wait?: boolean; skippable?: boolean }>([{}, ...combinations])("parser/interpreter characterization: unedited flags %j retain their semantics", (flags) => {
    const loaded = persisted(movie(flags));
    expect(loaded.command).toEqual(movie(flags));
    const interpreter = createInterpreter([loaded.command, SENTINEL], startSession(loaded.project, 4), loaded.project);
    expect(interpreter.start()).toEqual(movie({ wait: flags.wait !== false, skippable: flags.skippable !== false }));
    expect(interpreter.resume(undefined)).toMatchObject(SENTINEL);
  });
});

it.each([
  { finding: "G3-F10", initial: picture(), field: "show-picture-x-input", value: "30" },
  { finding: "G5-F2", initial: movie({ wait: true, skippable: true }), field: "play-movie-wait-select", value: "false" },
])("$finding Cancel discards staged edits without mutating the input", ({ initial, field, value }) => {
  const original = structuredClone(initial);
  const dialog = openMedia(initial);
  change(field, value);
  dialog.cancel();
  expect(dialog.onApply).not.toHaveBeenCalled();
  expect(initial).toEqual(original);
  const reopened = openMedia(initial);
  expect(control(field).value).toBe(initial.kind === "showPicture" ? "10" : "true");
  reopened.cancel();
});
