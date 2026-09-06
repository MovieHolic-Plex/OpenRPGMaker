// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { preparePublication, upgradePublication } from "@/project/publication";
import { appendPredecessorSaveImports } from "@/player/predecessorSaveImports";
import { createSaveSnapshot, readSaveSlot, saveSlotKey, setSavePublication } from "@/player/saveSlots";

afterEach(() => { localStorage.clear(); setSavePublication(undefined); document.body.replaceChildren(); });
it("copies an explicitly accepted predecessor through a visible load control", () => {
  const project = createBlankProject();
  const original = preparePublication("a".repeat(64)); project.meta.publication = original;
  setSavePublication(original);
  const raw = JSON.stringify(createSaveSnapshot(project, startSession(project, 1)), null, 2);
  const sourceKey = saveSlotKey(1); localStorage.setItem(sourceKey, raw);
  project.meta.publication = { ...upgradePublication(original, "b".repeat(64)), acceptedSaveCompatibilityIds: [original.saveCompatibilityId] };
  setSavePublication(project.meta.publication);
  const host = document.createElement("section"); document.body.append(host);
  const loaded: number[] = [];
  appendPredecessorSaveImports(host, { project, storage: localStorage, onLoadSlot: slot => loaded.push(slot) });
  const button = host.querySelector("button");
  if (!button) throw new Error("Missing copy control");
  button.click();
  expect(loaded).toEqual([1]);
  expect(localStorage.getItem(sourceKey)).toBe(raw);
  expect(readSaveSlot(localStorage, 1)).toMatchObject({ kind: "present", snapshot: { identity: { saveCompatibilityId: project.meta.publication.saveCompatibilityId } } });
});
