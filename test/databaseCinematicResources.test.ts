import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listDatabaseResourceOptions,
  openDatabaseResourcePickerDialog,
  resourcePickerControl,
} from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: () => void;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.assets.uploaded["movie-upload"] = {
    id: "movie-upload",
    name: "Uploaded movie",
    kind: "movie",
    dataUrl: "data:video/webm;base64,AAAA",
    meta: {},
  };
  project.assets.uploaded["picture-upload"] = {
    id: "picture-upload",
    name: "Picture",
    kind: "picture",
    dataUrl: "data:image/png;base64,AAAA",
    meta: {},
  };
  project.assets.uploaded["voice-upload"] = {
    id: "voice-upload",
    name: "Voice",
    kind: "sound",
    dataUrl: "data:audio/ogg;base64,AAAA",
    meta: {},
  };
  project.resourceProfiles.push(
    { kind: "movie", name: "Profile movie", assetId: "profile-movie" },
    { kind: "movie", name: "Movie profile name", assetId: "movie-upload" },
  );
  store.replace(project);
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreDom();
});

describe("Database cinematic resource selection", () => {
  it("lists project movie profiles and uploads once", () => {
    const project = store.getCurrent();
    const before = JSON.stringify(project);
    const options = listDatabaseResourceOptions("movie", project);
    expect(options.map((entry) => entry.id).sort()).toEqual([
      "movie-upload",
      "profile-movie",
    ]);
    expect(JSON.stringify(project)).toBe(before);
    expect(listDatabaseResourceOptions("image", project).map((entry) => entry.id))
      .toContain("picture-upload");
    expect(listDatabaseResourceOptions("sound", project).map((entry) => entry.id))
      .toContain("voice-upload");
  });

  it("searches and confirms movies without images or another player", () => {
    const onConfirm = vi.fn();
    const update = vi.spyOn(store, "update");
    openDatabaseResourcePickerDialog({
      kind: "movie",
      title: "Movie",
      currentId: "movie-upload",
      testidPrefix: "cinematic-movie",
      onConfirm,
    });
    const body = document.body as unknown as FakeElement;
    const dialog = findByTestId(body, "cinematic-movie");
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelectorAll("img, video, audio")).toHaveLength(0);

    const search = findByTestId(body, "cinematic-movie-search")!;
    search.value = "profile-movie";
    search.dispatchEvent(new Event("input"));
    expect(findByTestId(body, "cinematic-movie-option-movie-upload")).toBeNull();
    const option = findByTestId(body, "cinematic-movie-option-profile-movie");
    expect(option).not.toBeNull();
    option!.click();
    findByTestId(body, "cinematic-movie-ok")!.click();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0].resourceId).toBe("profile-movie");
    expect(update).not.toHaveBeenCalled();
  });

  it("preserves cancel and clear semantics without store mutation", () => {
    const onConfirm = vi.fn();
    const update = vi.spyOn(store, "update");
    const open = (): void => openDatabaseResourcePickerDialog({
      kind: "movie",
      title: "Movie",
      currentId: "movie-upload",
      allowClear: true,
      testidPrefix: "cinematic-movie",
      onConfirm,
    });
    const body = document.body as unknown as FakeElement;
    open();
    findByTestId(body, "cinematic-movie-cancel")!.click();
    expect(onConfirm).not.toHaveBeenCalled();
    open();
    findByTestId(body, "cinematic-movie-clear")!.click();
    expect(onConfirm.mock.calls[0][0].resourceId).toBe("");
    expect(update).not.toHaveBeenCalled();
  });

  it("reuses the inline picker without image probes, playback or AI generation", () => {
    const onChange = vi.fn();
    const rerender = vi.fn();
    const row = resourcePickerControl({
      kind: "movie",
      label: "Movie",
      resourceId: "movie-upload",
      testid: "cinematic-movie",
      onChange,
      rerender,
    }) as unknown as FakeElement;
    expect(row.querySelectorAll("img, video, audio")).toHaveLength(0);
    expect(findByTestId(row, "cinematic-movie-ai-generate")).toBeNull();
    document.body.append(row as unknown as Node);
    findByTestId(row, "cinematic-movie-set")!.click();
    const body = document.body as unknown as FakeElement;
    findByTestId(body, "cinematic-movie-dialog-option-profile-movie")!.click();
    findByTestId(body, "cinematic-movie-dialog-ok")!.click();
    expect(onChange.mock.calls[0][0].resourceId).toBe("profile-movie");
    expect(rerender).toHaveBeenCalledOnce();
  });
});
