import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { WorldCodexSession } from "@/editor/panels/worldCodexSession";
import { deleteWorldEntity, setPersistedCodexView } from "@/editor/panels/worldManager";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { deserialize, serialize } from "@/project/io";
import { worldCanonPromptSection } from "@/ai/worldCanonContext";
import { lintWorld } from "@/project/world";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let cleanup: () => void;
beforeEach(() => {
  cleanup = installFakeDom(); store.replace(createBlankProject()); resetMapEditHistory();
  setPersistedCodexView("overview", null);
});
afterEach(() => cleanup());
function control(root: FakeElement, id: string): FakeElement {
  const found = findByTestId(root, id); if (!found) throw new Error(id); return found;
}
function input(root: FakeElement, id: string, value: string): void {
  const found = control(root, id); found.value = value; found.dispatchEvent(new Event("input"));
}
function canonView(): FakeElement {
  const host = document.createElement("div"); renderWorldCanonTab(host, () => {}); return host as unknown as FakeElement;
}

describe("world authoring data preservation", () => {
  it("merges law notes and toggles with the latest law values", () => {
    const host = canonView();
    // 스프레드 뷰: 법칙 카드 -> 대화상자에서 선택/비고 -> 저장. tri-state 데이터 계약은 그대로다.
    function openLaw(id: string): void {
      control(host, "db-world-canon-law-" + id).click();
    }
    function commitLaw(id: string, option: "unset" | "no" | "yes", note: string): void {
      openLaw(id);
      if (option !== "unset") control(document.body as unknown as FakeElement, "db-world-canon-law-" + id + "-option-" + option).click();
      const noteBox = control(document.body as unknown as FakeElement, "db-world-canon-law-" + id + "-note") as unknown as FakeElement & { value: string };
      noteBox.value = note; noteBox.dispatchEvent(new Event("input"));
      control(document.body as unknown as FakeElement, "db-world-canon-law-" + id + "-save").click();
    }
    commitLaw("power", "unset", "피의 대가");
    commitLaw("gods", "yes", "여신");
    expect(store.getCurrent().worldCanon?.laws).toEqual({ power: { note: "피의 대가" }, gods: { note: "여신", present: true } });
  });

  it("round-trips explicit absence without inventing laws for legacy blank projects", () => {
    const project = createBlankProject();
    expect(worldCanonPromptSection(deserialize(serialize(project)).worldCanon)).toBeNull();
    project.worldCanon = { laws: { gods: { present: false } } };
    const loaded = deserialize(serialize(project));
    expect(loaded.worldCanon).toEqual(project.worldCanon);
    expect(worldCanonPromptSection(loaded.worldCanon)).toContain("신: 없음");
    expect(worldCanonPromptSection(loaded.worldCanon)).not.toContain("죽음:");
  });

  it("limits every bounded authoring control at the input boundary", () => {
    const host = canonView();
    for (const [id, max] of Object.entries({ name: 120, premise: 280, era: 80, tech: 80, body: 50000 })) {
      expect(control(host, `db-world-canon-${id}`).getAttribute("maxlength"), id).toBe(String(max));
    }
    // 법칙 비고 상한은 카드 안이 아니라 카드가 여는 대화상자 소유다.
    for (const kind of ["power", "gods", "death", "money"]) {
      control(host, "db-world-canon-law-" + kind).click();
      const noteBox = control(document.body as unknown as FakeElement, "db-world-canon-law-" + kind + "-note");
      expect(noteBox.getAttribute("maxlength"), kind).toBe("160");
      control(document.body as unknown as FakeElement, "db-world-canon-law-" + kind + "-save").click();
    }
  });

  it("retains inputs across categories and a rebuilt tab, then commits through the modal session", () => {
    const session = new WorldCodexSession();
    let panel = renderWorldPanel({ embedded: true, state: session.state }) as unknown as FakeElement;
    control(panel, "world-add-entity").click();
    input(panel, "world-edit-name", "보존할 이름"); input(panel, "world-edit-summary", "보존할 요약");
    control(panel, "world-tab-character").click();
    expect(control(panel, "world-edit-name").value).toBe("보존할 이름");
    panel = renderWorldPanel({ embedded: true, state: session.state }) as unknown as FakeElement;
    expect(control(panel, "world-edit-summary").value).toBe("보존할 요약");
    expect(session.isDirty()).toBe(true);
    expect(session.commit()).toBe(true); expect(session.isDirty()).toBe(false);
    expect(deserialize(serialize(store.getCurrent())).world?.entities[0]).toMatchObject({ name: "보존할 이름", summary: "보존할 요약" });
  });

  it("never commits an old modal draft into a different project", () => {
    const session = new WorldCodexSession();
    const panel = renderWorldPanel({ state: session.state }) as unknown as FakeElement;
    control(panel, "world-add-entity").click(); input(panel, "world-edit-name", "이전 프로젝트 카드");
    store.replaceProject(createBlankProject());
    expect(session.commit()).toBe(false);
    expect(store.getCurrent().world?.entities ?? []).toEqual([]);
  });

  it("retains the search node and draft while filtering", () => {
    const panel = renderWorldPanel() as unknown as FakeElement;
    control(panel, "world-add-entity").click(); input(panel, "world-edit-name", "작성 중");
    const search = control(panel, "world-search"); input(panel, "world-search", "검색");
    expect(control(panel, "world-search")).toBe(search);
    expect(control(panel, "world-edit-name").value).toBe("작성 중");
  });

  it("does not clear an invalid locked edit when the modal attempts to commit", () => {
    store.update((project) => { project.world = { entities: [{ id: "w_lock", type: "concept", name: "잠김", summary: "", origin: "user", locked: true }], relations: [] }; });
    const session = new WorldCodexSession();
    const panel = renderWorldPanel({ state: session.state }) as unknown as FakeElement;
    control(panel, "world-card-w_lock").click(); control(panel, "world-edit-toggle").click();
    input(panel, "world-edit-name", "변경 시도");
    expect(session.commit()).toBe(false); expect(session.state.editError).toContain("잠금");
    expect(session.isDirty()).toBe(true); session.discard(); expect(session.isDirty()).toBe(false);
  });

  it("deletes a card and its relations, keeps referenced game data, and restores it with undo", () => {
    const mapId = store.getCurrent().startMapId;
    store.update((project) => { project.world = {
      entities: [{ id: "w_a", type: "place", name: "장소", summary: "", origin: "user", refs: [{ kind: "map", id: mapId }] }, { id: "w_b", type: "character", name: "주민", summary: "", origin: "user", locked: true }],
      relations: [{ a: "w_b", b: "w_a", kind: "locatedIn" }],
    }; });
    const before = structuredClone(store.getCurrent().world);
    expect(deleteWorldEntity("w_b")).toBe(false);
    expect(deleteWorldEntity("w_a")).toBe(true);
    expect(store.getCurrent().world?.relations).toEqual([]); expect(store.getCurrent().maps[mapId]).toBeTruthy();
    expect(undoMapEdit()).toBe(true); expect(store.getCurrent().world).toEqual(before);
  });

  it("does not call a named transfer event an unregistered NPC", () => {
    const project = createBlankProject(); const map = project.maps[project.startMapId];
    const base = { id: "p", name: "집 문", conditions: [], trigger: { kind: "action" }, graphic: { sprite: { type: "bundled", id: "door" } }, commands: [{ kind: "transfer", mapId: map.id, x: 0, y: 0 }] };
    map.events = [{ id: "door", x: 1, y: 1, pages: [base] }] as never;
    expect(lintWorld({ entities: [], relations: [] }, project).some((issue) => issue.code === "world-npc-unregistered")).toBe(false);
  });
});
