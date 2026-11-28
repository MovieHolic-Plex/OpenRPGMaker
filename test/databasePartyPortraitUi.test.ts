import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { findByTestId, installFakeDom, type FakeNode } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetDatabaseRecordViewSession();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  resetDatabaseRecordViewSession();
});

describe("Party portrait selection and actor studio UX", () => {
  it("maps Monster5 mimic and clockwork soldier to existing generated faces", () => {
    expect(reviewedFaceIdForCharset("easyrpg-charset-monster5", 0)).toBe("generated-faceset-missing-monster-00");
    expect(reviewedFaceIdForCharset("easyrpg-charset-monster5", 6)).toBe("generated-faceset-missing-people-13");
  });

  it("opens the face picker when double-clicking either the left list thumbnail or the right hero face", () => {
    store.replace(createBlankProject());
    const actor = store.getCurrent().database.actors[0]!;
    const host = document.createElement("div");
    renderRecordTab(host, "actors", () => {});

    const heroFace = findByTestId(host as unknown as FakeNode, "db-actor-hero-face-pick");
    expect(heroFace).not.toBeNull();
    heroFace?.dispatchEvent(new Event("dblclick", { bubbles: true, cancelable: true }));
    expect(findByTestId(document.body as unknown as FakeNode, "db-actor-resource-dialog")).not.toBeNull();

    // Close dialog via cancel
    findByTestId(document.body as unknown as FakeNode, "db-actor-resource-dialog-cancel")?.dispatchEvent(new Event("click"));
    expect(findByTestId(document.body as unknown as FakeNode, "db-actor-resource-dialog")).toBeNull();

    // Double-click left thumbnail
    const leftFace = findByTestId(host as unknown as FakeNode, `db-actor-row-face-${actor.id}`);
    expect(leftFace).not.toBeNull();
    leftFace?.dispatchEvent(new Event("dblclick", { bubbles: true, cancelable: true }));
    expect(findByTestId(document.body as unknown as FakeNode, "db-actor-resource-dialog")).not.toBeNull();
  });

  it("renders a 1-frame charset crop fallback instead of a squished sheet when an actor has no face", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    delete actor.faceResourceId;
    store.replace(project);
    const host = document.createElement("div");
    renderRecordTab(host, "actors", () => {});

    const hero = findByTestId(host as unknown as FakeNode, "db-record-hero");
    expect(hero?.querySelector(".actor-face-fallback-slot")).not.toBeNull();
    expect(hero?.querySelector(".actor-face-image")).toBeNull();
    expect(host.querySelector(".db-list-thumb-charset-fallback")).not.toBeNull();
  });

  it("confirms and closes the faceset grid picker on double-click and shows group filter chips", () => {
    store.replace(createBlankProject());
    const picked: string[] = [];
    openDatabaseResourcePickerDialog({
      kind: "faceset",
      title: "얼굴 리소스",
      currentId: "easyrpg-faceset-actor1-00",
      testidPrefix: "face-grid",
      onConfirm: (result) => picked.push(result.resourceId),
    });
    const body = document.body as unknown as FakeNode;
    expect(findByTestId(body, "face-grid-groups")).not.toBeNull();
    const list = findByTestId(body, "face-grid-list");
    expect(list?.className).toContain("db-resource-picker-list-faces");

    findByTestId(body, "face-grid-option-easyrpg-faceset-actor1-05")?.dispatchEvent(new Event("dblclick", { bubbles: true }));
    expect(picked).toEqual(["easyrpg-faceset-actor1-05"]);
    expect(findByTestId(body, "face-grid")).toBeNull();
  });

  it("persists the active actor section tab across actor switches and filters actors with quick chips", () => {
    store.replace(createBlankProject());
    const actors = store.getCurrent().database.actors;
    expect(actors.length).toBeGreaterThan(1);
    const host = document.createElement("div");
    const rerender = (): void => {
      host.replaceChildren();
      renderRecordTab(host, "actors", rerender);
    };
    rerender();

    findByTestId(host as unknown as FakeNode, "db-actor-tab-appearance")?.click();
    findByTestId(host as unknown as FakeNode, `db-record-row-${actors[1]!.id}`)?.click();
    expect(findByTestId(host as unknown as FakeNode, "db-actor-tab-appearance")?.attrs["aria-selected"]).toBe("true");

    findByTestId(host as unknown as FakeNode, "db-actor-filter-party")?.click();
    expect(findByTestId(host as unknown as FakeNode, "db-actor-filter-party")?.attrs["aria-pressed"]).toBe("true");
  });
});
