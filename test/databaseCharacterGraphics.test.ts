// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { renderCharacterGraphicsTab } from "@/editor/panels/databaseCharacterGraphicsView";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { exportCharacterGraphics, listCharacterSprites } from "@/project/characterGraphics";
import { resetMapEditHistory, undoMapEdit, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { resourceReferenceMessage } from "@/editor/databaseReferences";

const textureKey = "tex_easyrpg_charset_people1";
const faceId = "easyrpg-faceset-actor2-15";
function get(id: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
function input(id: string, value: string, event = "input") {
  const node = get(id) as HTMLInputElement;
  node.focus(); node.value = value; node.dispatchEvent(new Event(event, { bubbles: true }));
  return node;
}
function mount() { document.body.replaceChildren(); renderCharacterGraphicsTab(document.body, mount); }
function importedRow() { return { textureKey, characterIndex: 0, label: "미검토 이름 수정", note: "검토 대기", status: "pending", faceResourceId: null }; }
function importJson(mappings: unknown[]) {
  input("db-cg-import-json", JSON.stringify({ schema: "oprn-npc-face-mapping", version: 1, mappings }));
  get("db-cg-import-apply").click();
}
function sprite() { return listCharacterSprites(store.getCurrent()).find((row) => row.textureKey === textureKey && row.characterIndex === 0)!; }

beforeEach(() => { store.replace(createBlankProject()); resetMapEditHistory(); mount(); });

describe("Character/Face Graphics database surface", () => {
  it("is reachable through the System tab group and exhaustive icon registry", () => {
    document.body.replaceChildren(); setDatabaseActiveTab("characterGraphics"); renderDatabasePanel(document.body);
    expect(get("db-tab-character-graphics")).toBeTruthy();
    expect(getDatabaseActiveTab()).toBe("characterGraphics");
    expect(get("db-character-graphics").querySelector(".db-ws-list-pane")).not.toBeNull();
  });
  it("imports pending labels and edits them without reviewing or losing focus", () => {
    importJson([importedRow()]);
    get(`db-cg-sprite-${textureKey}-0`).click();
    expect((get("db-cg-sprite-label") as HTMLInputElement).value).toBe("미검토 이름 수정");
    const control = input("db-cg-sprite-label", "다시 고친 이름");
    expect(document.activeElement).toBe(control);
    expect(sprite()).toMatchObject({ label: "다시 고친 이름", status: "pending", faceResourceId: null });
    expect(getMapEditHistoryState().canUndo).toBe(true);
    undoMapEdit();
    expect(sprite().label).toBe("미검토 이름 수정");
  });
  it("imports a real File through the file input and signals completion through the store", async () => {
    const file = new File([JSON.stringify({ schema: "oprn-npc-face-mapping", version: 1, mappings: [importedRow()] })], "mapping.json", { type: "application/json" });
    const control = get("db-cg-import-file") as HTMLInputElement;
    Object.defineProperty(control, "files", { configurable: true, value: [file] });
    let unsubscribe = () => {};
    let timeout: ReturnType<typeof setTimeout>;
    const changed = new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Import did not update the store")), 5000);
      unsubscribe = store.subscribe((_project, change) => {
        if (change.label === "캐릭터·얼굴 JSON 가져오기") resolve();
      });
    });
    try {
      control.dispatchEvent(new Event("change", { bubbles: true }));
      await changed;
      expect(sprite()).toMatchObject({ label: importedRow().label, status: "pending", faceResourceId: null });
    } finally { clearTimeout(timeout!); unsubscribe(); }
  });
  it("rejects an invalid import atomically and does not add history", () => {
    const before = JSON.stringify(store.getCurrent());
    importJson([importedRow(), { ...importedRow(), characterIndex: 1, status: "mapped", faceResourceId: "unknown-face" }]);
    expect(get("db-cg-message").dataset.state).toBe("error");
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
  it("assigns by face image, preserves independent attributes, and explicitly clears to no-face", () => {
    get(`db-cg-sprite-${textureKey}-0`).click();
    input("db-cg-sprite-attribute-skin", "어두운");
    input("db-cg-picker-search", faceId);
    get(`db-cg-assign-${faceId}`).click();
    expect(sprite().faceResourceId).toBeNull();
    get("db-cg-apply-face").click();
    expect(sprite()).toMatchObject({ status: "mapped", faceResourceId: faceId, quality: "unspecified" });
    input("db-cg-quality", "approximate", "change");
    get("db-cg-view-faces").click();
    get(`db-cg-face-${faceId}`).click();
    expect((get("db-cg-face-attribute-skin") as HTMLInputElement).value).toBe("");
    input("db-cg-face-attribute-skin", "밝은");
    input("db-cg-face-label", "얼굴 이름");
    get("db-cg-view-sprites").click();
    input("db-cg-status", "no-face", "change");
    expect(sprite()).toMatchObject({ status: "no-face", faceResourceId: null, attributes: { skin: "어두운" } });
    expect(exportCharacterGraphics(store.getCurrent()).faces.find((row) => row.resourceId === faceId)).toMatchObject({ label: "얼굴 이름", attributes: { skin: "밝은" } });
  });
  it("guards deletion of a manually mapped face until its mapping is cleared", () => {
    const project = store.getCurrent();
    project.resourceProfiles.push({ kind: "faceset", assetId: "uploaded-face-test", name: "업로드 얼굴" });
    mount();
    get(`db-cg-sprite-${textureKey}-0`).click();
    input("db-cg-picker-search", "uploaded-face-test");
    get("db-cg-assign-uploaded-face-test").click();
    get("db-cg-apply-face").click();
    expect(resourceReferenceMessage("uploaded-face-test")).not.toBeNull();
    input("db-cg-status", "no-face", "change");
    expect(resourceReferenceMessage("uploaded-face-test")).toBeNull();
  });
  it("filters image candidates and sprites independently without mutating project", () => {
    const before = JSON.stringify(store.getCurrent());
    get(`db-cg-sprite-${textureKey}-0`).click();
    input("db-cg-picker-search", faceId);
    expect(get("db-cg-face-candidates").querySelectorAll("button")).toHaveLength(1);
    const search = input("db-cg-sprites-search", "no-such-sprite");
    expect(document.activeElement).toBe(search);
    expect(get("db-cg-list").querySelectorAll(".db-ws-row")).toHaveLength(0);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });
});
