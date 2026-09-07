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
  const older = await createRuntimeManifest([{ name: "web/player.js", bytes: new Uint8Array([1]) }], []);
  if (prepared) project.meta.publication = preparePublication(older.runtimeTarget);
  const runtime = await createRuntimeManifest([{ name: "web/player.js", bytes: new Uint8Array([2]) },
    { name: "web/dependency-collector.js", bytes: new Uint8Array([3]) }], []);
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  let mutations = 0;
  await openPublishingDialog({ project, opener, apply: publication => { project.meta.publication = publication; mutations++; },
    exportZip: async () => {}, exportHtml: async () => {}, fetchBytes: async path => path.endsWith("default.json")
      ? jsonBytes({ runtimeTarget: runtime.runtimeTarget })
      : jsonBytes(path.includes(older.runtimeTarget) ? older : runtime) });
  return { project, opener, mutations: () => mutations, runtime, older };
}
afterEach(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); document.body.replaceChildren(); });
describe("publishing modal controls", () => {
  const collectorValue = (kind: "installed" | "selected") => {
    const node = document.querySelector(`[data-testid="publication-${kind}-collector"]`);
    if (!(node instanceof HTMLInputElement)) throw new Error(`Missing ${kind} collector value`);
    return node.value;
  };
  it("shows verified installed collector 2 before and after prepare/fork", async () => {
    const { runtime } = await fixture();
    expect(runtime.collectorVersion).toBe(2);
    expect(collectorValue("installed")).toBe("2");
    expect(collectorValue("selected")).toBe("");
    button("prepare").click();
    expect(collectorValue("selected")).toBe("2");
    button("fork").click();
    expect(collectorValue("selected")).toBe("2");
  });
  it("shows the selected older collector through fork and the installed version after upgrade", async () => {
    const { older } = await fixture(true);
    expect(older.collectorVersion).toBe(1);
    expect(collectorValue("installed")).toBe("2");
    expect(collectorValue("selected")).toBe("1");
    button("fork").click();
    expect(collectorValue("selected")).toBe("1");
    button("upgrade").click();
    expect(collectorValue("selected")).toBe("2");
    button("fork").click();
    expect(collectorValue("selected")).toBe("2");
  });
  it("stages preparation and cancels without changing the project", async () => {
    const { project, opener, mutations } = await fixture();
    button("prepare").click(); button("cancel").click();
    expect(project.meta.publication).toBeUndefined(); expect(mutations()).toBe(0);
    expect(document.activeElement).toBe(opener);
  });
  it.each(["installed", "selected"] as const)("does not display an unverified %s runtime's collector", async kind => {
    const project = createBlankProject();
    const runtime = await createRuntimeManifest([{ name: "web/dependency-collector.js", bytes: new Uint8Array([1]) }], []);
    const wrongTarget = "a".repeat(64);
    if (kind === "selected") project.meta.publication = preparePublication(wrongTarget);
    await openPublishingDialog({ project, apply: () => {}, exportZip: async () => {}, exportHtml: async () => {},
      fetchBytes: async path => path.endsWith("default.json")
        ? jsonBytes({ runtimeTarget: kind === "installed" ? wrongTarget : runtime.runtimeTarget }) : jsonBytes(runtime) });
    expect(collectorValue(kind)).toBe("");
    if (kind === "installed") expect(button("prepare").disabled).toBe(true);
    else expect(collectorValue("installed")).toBe("2");
  });
  it("keeps the upgraded collector and edited version when older manifest verification finishes", async () => {
    const project = createBlankProject();
    const older = await createRuntimeManifest([{ name: "web/player.js", bytes: new Uint8Array([1]) }], []);
    const runtime = await createRuntimeManifest([{ name: "web/dependency-collector.js", bytes: new Uint8Array([2]) }], []);
    project.meta.publication = preparePublication(older.runtimeTarget);
    let requested!: () => void, deliver!: (bytes: Uint8Array) => void;
    const selectedRequested = new Promise<void>(resolve => { requested = resolve; });
    const selectedBytes = new Promise<Uint8Array>(resolve => { deliver = resolve; });
    const opened = openPublishingDialog({ project, apply: () => {}, exportZip: async () => {}, exportHtml: async () => {},
      fetchBytes: async path => {
        if (path.endsWith("default.json")) return jsonBytes({ runtimeTarget: runtime.runtimeTarget });
        if (path.includes(older.runtimeTarget)) { requested(); return selectedBytes; }
        return jsonBytes(runtime);
      } });
    await selectedRequested;
    expect(collectorValue("selected")).toBe("");
    button("upgrade").click();
    const version = document.querySelector<HTMLInputElement>('[data-testid="publication-version"]')!;
    version.value = "2.1";
    deliver(jsonBytes(older));
    await opened;
    expect(collectorValue("selected")).toBe("2");
    expect(version.value).toBe("2.1");
  }, 5000);
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
