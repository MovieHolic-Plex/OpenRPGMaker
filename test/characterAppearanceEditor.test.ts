import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { CharacterAppearanceRecord, Command } from "@/project/types";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => { vi.unstubAllGlobals(); restoreDom?.(); });

function fakeHost(): HTMLDivElement & FakeElement {
  const host = document.createElement("div");
  if (!(host instanceof FakeElement)) throw new TypeError("Expected installed fake DOM");
  document.body.append(host);
  return host;
}

function control(root: FakeElement, id: string): FakeElement {
  const node = findByTestId(root, id);
  if (!node) throw new TypeError(`Missing control ${id}`);
  return node;
}

function input(root: FakeElement, id: string, value: string, event = "input"): FakeElement {
  const node = control(root, id);
  node.value = value;
  node.dispatchEvent(new Event(event));
  return node;
}

const appearance: CharacterAppearanceRecord = {
  id: "appearance_test", name: "Mira", description: "Blue coat",
  charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 3 },
  face: { resourceId: "generated-actor-hero-01-face" },
};

async function catalog(records: CharacterAppearanceRecord[] = []) {
  const { store } = await import("@/project/store");
  const project = createBlankProject();
  project.database.characterAppearances = structuredClone(records);
  store.replace(project);
  const { renderCharacterAppearancesTab, selectCharacterAppearance } = await import("@/editor/panels/databaseAppearanceView");
  selectCharacterAppearance(records[0]?.id ?? "");
  const host = fakeHost();
  renderCharacterAppearancesTab(host);
  return { store, host };
}

async function generatedCandidate() {
  const result = await catalog([{ id: "candidate", name: "Candidate", description: "Blue coat" }]);
  const { appearanceGenerationController: controller } = await import("@/editor/characterAppearanceGeneration");
  controller.cancel();
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ image: {
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    mimeType: "image/png", model: "test", provider: "test",
  } }), { status: 200, headers: { "Content-Type": "application/json" } }));
  // Subscribe before the click. The test timeout bounds this exact state signal.
  const candidate = new Promise<void>((resolve, reject) => {
    const unsubscribe = controller.subscribe((state) => {
      if (state.status === "candidate") { unsubscribe(); resolve(); }
      if (state.status === "error") { unsubscribe(); reject(new Error(state.error)); }
    });
  });
  control(result.host, "appearance-generate-face").click();
  await candidate;
  return { ...result, controller };
}

describe("character appearance editor", () => {
  it("exposes the appearance catalog through the existing database renderer", async () => {
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    const { renderDatabasePanel, setDatabaseActiveTab } = await import("@/editor/panels/database");
    // 공유 외형은 레일 칸이 아니라 주인공 탭의 보기다 — 주인공 본문 위 보기 전환 줄에서 연다.
    setDatabaseActiveTab("actors");
    const host = document.createElement("div");
    renderDatabasePanel(host);
    if (!(host instanceof FakeElement)) throw new TypeError("Expected installed fake DOM");
    expect(findByTestId(host, "db-tab-character-appearances")).toBeNull();
    expect(findByTestId(host, "db-subview-character-appearances")).not.toBeNull();
  }, 180_000);

  it("creates a valid partial record with no automatic graphics", async () => {
    const { store, host } = await catalog();
    control(host, "appearance-add").click();
    expect(store.getCurrent().database.characterAppearances).toHaveLength(1);
    const record = store.getCurrent().database.characterAppearances?.[0];
    expect(record?.charset).toBeUndefined();
    expect(record?.face).toBeUndefined();
    expect(record?.bust).toBeUndefined();
    expect(findByTestId(host, "appearance-generate-charset")).toBeNull();
    for (const slot of ["charset", "face", "bust"]) expect(findByTestId(host, `appearance-upload-${slot}`)).not.toBeNull();
  });

  it("retains search and detail input identity through IME filtering", async () => {
    const { store, host } = await catalog([appearance]);
    const search = control(host, "appearance-search");
    const name = control(host, "appearance-name");
    const before = store.getCurrent();
    search.focus();
    search.dispatchEvent(new Event("compositionstart"));
    input(host, "appearance-search", "존재하지 않음");
    search.dispatchEvent(new Event("compositionend"));
    expect(control(host, "appearance-search")).toBe(search);
    expect(control(host, "appearance-name")).toBe(name);
    expect(document.activeElement).toBe(search);
    expect(store.getCurrent()).toBe(before);
  });

  it("commits metadata without replacing the focused editor", async () => {
    const { store, host } = await catalog([appearance]);
    const name = control(host, "appearance-name");
    name.focus();
    input(host, "appearance-name", "미라");
    expect(control(host, "appearance-name")).toBe(name);
    expect(document.activeElement).toBe(name);
    expect(store.getCurrent().database.characterAppearances?.[0]?.name).toBe("미라");
    expect(control(host, "appearance-dialogue-preview").textContent).toContain("미라");
  });

  it("duplicates the selected record with independently editable slots", async () => {
    const { store, host } = await catalog([appearance]);
    control(host, "appearance-duplicate").click();
    const [original, copy] = store.getCurrent().database.characterAppearances ?? [];
    expect(copy?.id).not.toBe(original?.id);
    expect(copy?.charset).toEqual(original?.charset);
    expect(copy?.charset).not.toBe(original?.charset);
    control(host, "appearance-clear-face").click();
    const records = store.getCurrent().database.characterAppearances;
    expect(records?.[0]?.face).toEqual(appearance.face);
    expect(records?.[1]?.face).toBeUndefined();
  });
  it("shows the shared catalog classification read-only beside linked slots", async () => {
    const { host } = await catalog([appearance]);
    const charsetLine = findByTestId(host, "appearance-shared-charset");
    if (!charsetLine) throw new TypeError("Missing shared charset line");
    expect(charsetLine.textContent).toContain("금발 붉은 갑옷 기사");
    expect(charsetLine.textContent).toContain("얼굴 지정");
    const faceLine = findByTestId(host, "appearance-shared-face");
    if (!faceLine) throw new TypeError("Missing shared face line");
    expect(faceLine.textContent).toContain("공용 분류 없음");
  });

  it("states missing shared rows on an empty record without writing project data", async () => {
    const { store, host } = await catalog();
    control(host, "appearance-add").click();
    const before = store.getCurrent();
    expect(findByTestId(host, "appearance-shared-charset")?.textContent).toContain("아직 그림이 없습니다");
    expect(findByTestId(host, "appearance-shared-face")?.textContent).toContain("아직 그림이 없습니다");
    expect(findByTestId(host, "appearance-shared-bust")).toBeNull();
    expect(store.getCurrent()).toBe(before);
  });
  it("deletes an unused record and allows undo", async () => {
    const { store, host } = await catalog([appearance]);
    control(host, "appearance-delete").click();
    expect(store.getCurrent().database.characterAppearances).toEqual([]);
    const { undoMapEdit } = await import("@/editor/mapEditHistory");
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().database.characterAppearances?.[0]?.id).toBe(appearance.id);
  });

  it("guards deletion against live usage added after rendering", async () => {
    const { store, host } = await catalog([appearance]);
    store.update((project) => { const actor = project.database.actors[0]; if (actor) actor.appearanceId = appearance.id; });
    control(host, "appearance-delete").click();
    expect(store.getCurrent().database.characterAppearances).toHaveLength(1);
  });

  it("links and unlinks an actor without copying or deleting direct graphics", async () => {
    const { store } = await catalog([appearance]);
    const actor = store.getCurrent().database.actors[0];
    if (!actor) throw new TypeError("Missing actor fixture");
    const before = { charset: actor.characterResourceId, face: actor.faceResourceId, index: actor.characterIndex };
    const { renderActorRecordForm } = await import("@/editor/panels/actorRecordView");
    const host = fakeHost();
    host.append(renderActorRecordForm(actor, () => {}));
    input(host, "actor-appearance-select", appearance.id, "change");
    const linked = store.getCurrent().database.actors[0];
    expect(linked?.appearanceId).toBe(appearance.id);
    expect({ charset: linked?.characterResourceId, face: linked?.faceResourceId, index: linked?.characterIndex }).toEqual(before);
    expect(control(host, "db-field-face-resource").disabled).toBe(true);
    input(host, "actor-appearance-select", "", "change");
    expect(store.getCurrent().database.actors[0]?.appearanceId).toBeUndefined();
    expect(control(host, "db-field-face-resource").disabled).toBe(false);
  });

  it("keeps page linking local and restores legacy graphics on unlink", async () => {
    const { store } = await catalog([appearance]);
    const { addEvent } = await import("@/editor/eventActions");
    const { addEventPage } = await import("@/editor/eventPages");
    const mapId = store.getCurrent().startMapId;
    const eventId = addEvent(mapId, 2, 2);
    addEventPage(mapId, eventId);
    const event = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId);
    const page = event?.pages?.[0];
    if (!page) throw new TypeError("Missing page fixture");
    const original = structuredClone(page.graphic);
    const { renderEventPageProps } = await import("@/editor/panels/eventEditor/pageProps");
    const host = fakeHost();
    host.append(renderEventPageProps(mapId, eventId, page, event));
    input(host, "event-page-appearance-select", appearance.id, "change");
    const pages = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages;
    expect(pages?.[0]?.graphic.appearanceId).toBe(appearance.id);
    expect(pages?.[1]?.graphic.appearanceId).toBeUndefined();
    input(host, "event-page-appearance-select", "", "change");
    expect(store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0]?.graphic).toEqual({ ...original, appearanceId: undefined });
  });

  it("stores a shared portrait binding and explicit presentation through the command form", async () => {
    const { store } = await catalog([appearance]);
    const { renderCoreCommandBody } = await import("@/editor/panels/eventEditor/commandBodyCore");
    let command: Command = { kind: "changeFace", resourceId: "generated-actor-hero-02-face", position: "left", flipHorizontally: false };
    const unused = () => { throw new TypeError("Unexpected command action"); };
    const form = renderCoreCommandBody({ path: [0], actions: {
      addCommand: unused, insertCommand: unused, deleteCommand: unused, moveCommand: unused, moveCommandTo: unused,
      replaceCommand: (_path, next) => {
        command = next;
        store.update((project) => { project.commonEvents[0] = { id: "appearance_command", name: "Portrait", trigger: "none", commands: [next] }; });
      },
    } }, command);
    if (!(form instanceof FakeElement)) throw new TypeError("Missing command form");
    input(form, "event-command-face-appearance", appearance.id, "change");
    input(form, "event-command-face-presentation", "bust", "change");
    expect(command).toMatchObject({ appearanceId: appearance.id, presentation: "bust", resourceId: "generated-actor-hero-02-face" });
    expect(store.getCurrent().commonEvents[0]?.commands[0]).toEqual(command);
    input(form, "event-command-face-appearance", "", "change");
    expect(command).not.toHaveProperty("appearanceId");
    expect(command).toMatchObject({ resourceId: "generated-actor-hero-02-face" });
  });

  it("keeps generated candidates detached until image load and explicit Apply", async () => {
    const { store, host, controller } = await generatedCandidate();
    const apply = control(host, "appearance-apply-face");
    const image = control(host, "appearance-candidate-face").querySelector("img");
    if (!image) throw new TypeError("Candidate preview missing");
    // FakeElement deliberately does not reflect boolean attributes into properties.
    expect(apply.getAttribute("disabled")).not.toBeNull();
    apply.click();
    expect(store.getCurrent().database.characterAppearances?.[0]?.face).toBeUndefined();
    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1 });
    image.dispatchEvent(new Event("load"));
    expect(apply.disabled).toBe(false);
    apply.click();
    const id = store.getCurrent().database.characterAppearances?.[0]?.face?.resourceId;
    expect(id).toBeTruthy();
    expect(id ? store.getCurrent().assets.uploaded[id]?.kind : undefined).toBe("faceset");
    expect(controller.getState().status).toBe("idle");
  });

  it("refuses broken candidate images and cancels without writing project data", async () => {
    const { store, host, controller } = await generatedCandidate();
    const before = store.getCurrent();
    const image = control(host, "appearance-candidate-face").querySelector("img");
    if (!image) throw new TypeError("Candidate preview missing");
    image.dispatchEvent(new Event("error"));
    const apply = control(host, "appearance-apply-face");
    expect(apply.disabled).toBe(true);
    apply.click();
    expect(store.getCurrent()).toBe(before);
    control(host, "appearance-cancel-generation").click();
    expect(controller.getState().status).toBe("idle");
    expect(store.getCurrent()).toBe(before);
  });
});
