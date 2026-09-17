// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCharacterGraphicsTab } from "@/editor/panels/databaseCharacterGraphicsView";
import { createBlankProject } from "@/project/defaults/blankProject";
import { store } from "@/project/store";
import { listCharacterSprites, type CharacterGraphicsDocument } from "@/project/characterGraphics";
import { emptySharedCharacterGraphics, sharedCharacterGraphicsProject, validateSharedCharacterGraphics } from "@/project/sharedCharacterGraphics";
import { resetMapEditHistory, getMapEditHistoryState } from "@/editor/mapEditHistory";

const textureKey = "tex_easyrpg_charset_people1";
const faceId = "easyrpg-faceset-actor2-15";
let saved: CharacterGraphicsDocument;
let revision: number;
let rejectWrite: boolean;
let host: HTMLElement;
function get(id: string): HTMLElement {
  const node = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
function input(id: string, value: string, event = "input") {
  const node = get(id) as HTMLInputElement;
  node.focus(); node.value = value; node.dispatchEvent(new Event(event, { bubbles: true }));
  return node;
}
async function mount() {
  host = document.createElement("div"); document.body.replaceChildren(host);
  renderCharacterGraphicsTab(host);
  await vi.waitFor(() => expect(get("db-cg-shared-scope")).toBeTruthy());
}
async function accepted() { await vi.waitFor(() => expect(get("db-cg-message").textContent).toContain("공용 저장 완료")); }
async function importJson(mappings: unknown[]) {
  input("db-cg-import-json", JSON.stringify({ schema: "oprn-npc-face-mapping", version: 1, mappings }));
  get("db-cg-import-apply").click();
  await accepted();
}
function sprite() { return listCharacterSprites(sharedCharacterGraphicsProject(saved)).find(row => row.textureKey === textureKey && row.characterIndex === 0)!; }

beforeEach(async () => {
  saved = emptySharedCharacterGraphics(); revision = 0; rejectWrite = false;
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, options?: RequestInit) => {
    if (options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      if (rejectWrite || body.revision !== String(revision)) return Response.json({ error: "다른 창에서 공용 자료가 변경됐습니다." }, { status: 409 });
      saved = validateSharedCharacterGraphics(body.document); revision++;
    }
    return Response.json({ document: saved, revision: String(revision) });
  }));
  store.replace(createBlankProject()); resetMapEditHistory(); await mount();
});
afterEach(() => vi.unstubAllGlobals());

describe("Shared Character/Face Graphics database surface", () => {
  it("persists a manual connection across projects without changing game data or undo", async () => {
    const before = JSON.stringify(store.getCurrent());
    get(`db-cg-sprite-${textureKey}-0`).click();
    input("db-cg-picker-search", faceId);
    get(`db-cg-assign-${faceId}`).click();
    expect(sprite().faceResourceId).toBeNull();
    get("db-cg-apply-face").click(); await accepted();
    expect(sprite()).toMatchObject({ status: "mapped", faceResourceId: faceId });
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
    store.replace(createBlankProject()); await mount();
    get(`db-cg-sprite-${textureKey}-0`).click();
    expect((get("db-cg-status") as HTMLSelectElement).value).toBe("mapped");
  });
  it("commits text on change, preserving the whole value during typing", async () => {
    get(`db-cg-sprite-${textureKey}-0`).click();
    const control = input("db-cg-sprite-label", "다시 고친 이름");
    expect(document.activeElement).toBe(control);
    expect(revision).toBe(0);
    control.dispatchEvent(new Event("change", { bubbles: true })); await accepted();
    expect(sprite()).toMatchObject({ label: "다시 고친 이름", status: "pending", faceResourceId: null });
  });
  it("imports legacy pending labels without turning suggestions into assignments", async () => {
    await importJson([{ textureKey, characterIndex: 0, label: "미검토 이름 수정", note: "검토 대기", status: "pending", faceResourceId: null }]);
    expect(sprite()).toMatchObject({ label: "미검토 이름 수정", status: "pending", faceResourceId: null });
  });
  it("rejects invalid imports before any shared write", () => {
    input("db-cg-import-json", JSON.stringify({ schema: "oprn-npc-face-mapping", version: 1, mappings: [{ textureKey, characterIndex: 0, label: "bad", note: "", status: "mapped", faceResourceId: "unknown-face" }] }));
    get("db-cg-import-apply").click();
    expect(get("db-cg-message").dataset.state).toBe("error");
    expect(revision).toBe(0);
  });
  it("retains the accepted mapping and recovery JSON when a concurrent write is rejected", async () => {
    await importJson([{ textureKey, characterIndex: 0, label: "기존 연결", note: "", status: "mapped", faceResourceId: faceId }]);
    get(`db-cg-sprite-${textureKey}-0`).click();
    rejectWrite = true;
    input("db-cg-status", "no-face", "change");
    await vi.waitFor(() => expect(get("db-cg-message").dataset.state).toBe("error"));
    expect(sprite().faceResourceId).toBe(faceId);
    expect((get("db-cg-import-json") as HTMLTextAreaElement).value).toContain('"no-face"');
  });
  it("clears a mapping explicitly without changing the face attributes", async () => {
    await importJson([{ textureKey, characterIndex: 0, label: "연결", note: "", status: "mapped", faceResourceId: faceId }]);
    get(`db-cg-sprite-${textureKey}-0`).click();
    input("db-cg-status", "no-face", "change"); await accepted();
    expect(sprite()).toMatchObject({ status: "no-face", faceResourceId: null, quality: "unspecified" });
  });
  it("shows a read error rather than silently replacing the library with an empty project", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "read failed" }, { status: 500 })));
    host = document.createElement("div"); document.body.replaceChildren(host); renderCharacterGraphicsTab(host);
    await vi.waitFor(() => expect(get("db-cg-message").textContent).toContain("read failed"));
    expect(host.querySelector('[data-testid="db-cg-apply-face"]')).toBeNull();
  });
});
