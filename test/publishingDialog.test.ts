// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createRuntimeManifest, jsonBytes } from "@/project/gameRelease";
import { preparePublication } from "@/project/publication";
import { openPublishingDialog } from "@/editor/panels/publishingDialog";

function button(name: string): HTMLButtonElement {
  const node = document.querySelector(`[data-testid="publication-${name}"]`);
  if (!(node instanceof HTMLButtonElement)) throw new Error(`Missing ${name}`);
  return node;
}
async function fixture(prepared = false) {
  const project = createBlankProject();
  if (prepared) project.meta.publication = preparePublication("a".repeat(64));
  const runtime = await createRuntimeManifest([{ name: "web/player.js", bytes: new Uint8Array([1]) }], []);
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  let mutations = 0;
  await openPublishingDialog({ project, opener, apply: publication => { project.meta.publication = publication; mutations++; },
    exportZip: async () => {}, exportHtml: async () => {}, fetchBytes: async path => path.endsWith("default.json")
      ? jsonBytes({ runtimeTarget: runtime.runtimeTarget }) : jsonBytes(runtime) });
  return { project, opener, mutations: () => mutations, runtime };
}
afterEach(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); document.body.replaceChildren(); });
describe("publishing modal controls", () => {
  it("stages preparation and cancels without changing the project", async () => {
    const { project, opener, mutations } = await fixture();
    button("prepare").click(); button("cancel").click();
    expect(project.meta.publication).toBeUndefined(); expect(mutations()).toBe(0);
    expect(document.activeElement).toBe(opener);
  });
  it("applies preparation through the normal mutation callback", async () => {
    const { project, mutations, runtime } = await fixture();
    button("prepare").click(); button("apply").click();
    expect(project.meta.publication?.runtimeTarget).toBe(runtime.runtimeTarget);
    expect(mutations()).toBe(1);
  });
  it("keeps game identity but isolates saves on explicit engine upgrade", async () => {
    const { project, runtime } = await fixture(true);
    const original = project.meta.publication;
    button("upgrade").click(); button("apply").click();
    expect(project.meta.publication?.gameId).toBe(original?.gameId);
    expect(project.meta.publication?.saveCompatibilityId).not.toBe(original?.saveCompatibilityId);
    expect(project.meta.publication?.runtimeTarget).toBe(runtime.runtimeTarget);
  });
  it("forks only when the staged fork is applied", async () => {
    const { project } = await fixture(true);
    const original = project.meta.publication;
    button("fork").click(); button("apply").click();
    expect(project.meta.publication?.gameId).not.toBe(original?.gameId);
  });
  it("accepts the immediate predecessor only after an explicit checkbox action", async () => {
    const { project } = await fixture(true);
    const original = project.meta.publication;
    button("upgrade").click();
    const checkbox = document.querySelector('[data-testid="publication-accept-predecessor"]');
    if (!(checkbox instanceof HTMLInputElement)) throw new Error("Missing compatibility choice");
    checkbox.click(); button("apply").click();
    expect(project.meta.publication?.acceptedSaveCompatibilityIds).toEqual([original?.saveCompatibilityId]);
  });
  it("keeps focus inside the dialog even before publication exists", async () => {
    await fixture();
    expect(document.querySelector('[data-testid="publication-dialog"]')?.contains(document.activeElement)).toBe(true);
  });
  it("restores an explicit persistent opener after a transient menu is removed", async () => {
    const project = createBlankProject();
    const opener = document.createElement("button"), transient = document.createElement("button");
    document.body.append(opener, transient); transient.focus();
    await openPublishingDialog({ project, opener, apply: () => {}, exportZip: async () => {}, exportHtml: async () => {},
      fetchBytes: async () => { throw new Error("unavailable"); } });
    transient.remove(); button("cancel").click();
    expect(document.activeElement).toBe(opener);
  });
});
