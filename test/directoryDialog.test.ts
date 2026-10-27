import { describe, expect, it } from "vitest";
import {
  chosenDirectory,
  directoryDialogParent,
  directoryDialogProperties,
  pickAppWindow,
} from "../electron/main/directoryDialog";

function owner(destroyed = false): { isDestroyed(): boolean } {
  return { isDestroyed: () => destroyed };
}

describe("directory dialog parent", () => {
  it("attaches the dialog to a live window", () => {
    const window = owner();
    expect(directoryDialogParent(window)).toBe(window);
    expect(directoryDialogProperties(false)).toEqual(["openDirectory"]);
    expect(directoryDialogProperties(true)).toEqual(["openDirectory", "createDirectory"]);
  });

  it("does not attach a destroyed window or a missing one", () => {
    expect(directoryDialogParent(owner(true))).toBeUndefined();
    expect(directoryDialogParent(null)).toBeUndefined();
    expect(directoryDialogParent(undefined)).toBeUndefined();
  });

  it("treats cancel and an empty path as no choice", () => {
    expect(chosenDirectory({ canceled: true, filePaths: ["/tmp/game"] })).toBeNull();
    expect(chosenDirectory({ canceled: false, filePaths: [] })).toBeNull();
    expect(chosenDirectory({ canceled: false, filePaths: [""] })).toBeNull();
    expect(chosenDirectory({ canceled: false, filePaths: ["/tmp/game", "/tmp/other"] })).toBe("/tmp/game");
  });
});

describe("file menu window", () => {
  const alive = (name: string) => ({ name, destroyed: false });
  const dead = (name: string) => ({ name, destroyed: true });
  const isAppWindow = (window: { name: string }) => window.name.startsWith("app");
  const isDestroyed = (window: { destroyed: boolean }) => window.destroyed;

  it("keeps a focused editor window", () => {
    const editor = alive("app-editor");
    const splash = alive("splash");
    expect(pickAppWindow({
      focused: editor,
      lastFocused: splash,
      windows: [editor],
      isAppWindow,
      isDestroyed,
    })).toBe(editor);
  });

  it("does not open a folder into the splash or a team window", () => {
    const editor = alive("app-editor");
    const splash = alive("splash");
    expect(pickAppWindow({
      focused: splash,
      lastFocused: editor,
      windows: [editor],
      isAppWindow,
      isDestroyed,
    })).toBe(editor);
  });

  it("skips a destroyed last window and uses a live app window", () => {
    const gone = dead("app-old");
    const editor = alive("app-editor");
    expect(pickAppWindow({
      focused: null,
      lastFocused: gone,
      windows: [gone, editor],
      isAppWindow,
      isDestroyed,
    })).toBe(editor);
  });

  it("returns null when every app window is gone", () => {
    expect(pickAppWindow({
      focused: alive("splash"),
      lastFocused: dead("app-old"),
      windows: [dead("app-old")],
      isAppWindow,
      isDestroyed,
    })).toBeNull();
  });
});
