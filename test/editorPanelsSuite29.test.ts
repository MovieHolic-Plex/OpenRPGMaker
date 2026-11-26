// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { mixedFixture } from "./support/spatialMixedFixture";
import { bindSpatialAuthoringControllerFactory, clearAuthoringSession, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { renderSpatialCompositionWorkspace } from "@/editor/panels/spatialCompositionWorkspace";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { editComposition } from "@/editor/panels/spatialCompositionAccess";
import { spatialId } from "@/project/spatial/domain";
import { isolateTimers } from "./mergedTeardown";

describe("databaseGroupStrip", () => {
  isolateTimers();
  /**
   * 그룹 띠 — 띠를 누르면 옆 목록이 그 그룹 구획으로 바뀐다.
   * 결함(2026-09-28): syncGroupStrip 이 부를 때마다 보는 그룹을 활성 탭의 그룹으로 되돌려,
   * 띠를 눌러도 목록이 그대로였다. 활성 탭이 **바뀐 때만** 따라가야 한다.
   */
  const previous = store.getCurrent();
  function host(): HTMLElement {
    const root = document.createElement("div");
    root.className = "database-modal-body";
    document.body.replaceChildren(root);
    renderDatabasePanel(root);
    return root;
  }
  function viewed(root: HTMLElement): string | undefined {
    return root.querySelector<HTMLElement>(".db-tabs")?.dataset.viewGroup;
  }
  function inView(root: HTMLElement, testid: string): string | undefined {
    return root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.dataset.inView;
  }
  beforeEach(() => {
    store.replace(createBlankProject(), { preserveEventDrafts: false });
    setDatabaseActiveTab("classes");
  });
  afterEach(() => {
    document.body.replaceChildren();
    store.replace(previous, { preserveEventDrafts: false });
  });
  describe("자료집 그룹 띠", () => {
    it("띠를 누르면 보는 구획이 바뀌고 활성 탭은 그 그룹의 첫 탭으로 간다", () => {
      const root = host();
      expect(viewed(root)).toBe("party");
      expect(inView(root, "db-tab-classes")).toBe("1");
      expect(inView(root, "db-tab-enemies")).toBe("0");

      root.querySelector<HTMLElement>('[data-testid="db-group-strip-battle"]')!.click();

      expect(viewed(root)).toBe("battle");
      expect(inView(root, "db-tab-enemies")).toBe("1");
      expect(inView(root, "db-tab-classes")).toBe("0");
      const strip = root.querySelector<HTMLElement>('[data-testid="db-group-strip-battle"]')!;
      expect(strip.getAttribute("aria-pressed")).toBe("true");
      expect(root.querySelector<HTMLElement>('[data-testid="db-group-strip-party"]')!.getAttribute("aria-pressed")).toBe("false");
      // 8684ab7daf: 그룹을 바꾸면 본문·크럼도 그 그룹으로 간다 — 기억한 탭이 없으면 첫 보이는 탭(빈 프로젝트는 첫 탭)에 착지한다.
      expect(root.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-enemies");
    });

    it("레일은 접힌 채 시작하고, 묶음을 누르면 열리고, 탭을 고르거나 같은 묶음을 다시 누르면 닫힌다", () => {
      const root = host();
      expect(root.dataset.railOpen).toBe("0");
      root.querySelector<HTMLElement>('[data-testid="db-group-strip-battle"]')!.click();
      expect(root.dataset.railOpen).toBe("1");
      root.querySelector<HTMLElement>('[data-testid="db-tab-states"]')!.click();
      expect(root.dataset.railOpen).toBe("0");
      expect(root.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-states");
      const battle = root.querySelector<HTMLElement>('[data-testid="db-group-strip-battle"]')!;
      battle.click();
      expect(root.dataset.railOpen).toBe("1");
      battle.click();
      expect(root.dataset.railOpen).toBe("0");
    });

    it("다른 구획의 탭을 고르면 그 탭 그룹이 계속 보인다", () => {
      const root = host();
      root.querySelector<HTMLElement>('[data-testid="db-group-strip-battle"]')!.click();
      root.querySelector<HTMLElement>('[data-testid="db-tab-enemies"]')!.click();
      expect(viewed(root)).toBe("battle");
      expect(root.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-enemies");

      root.querySelector<HTMLElement>('[data-testid="db-group-strip-system"]')!.click();
      expect(viewed(root)).toBe("system");
    });

    it("프로그램 점프(조수·딥링크)는 새 활성 탭의 그룹으로 띠를 옮긴다", () => {
      const root = host();
      root.querySelector<HTMLElement>('[data-testid="db-group-strip-battle"]')!.click();
      setDatabaseActiveTab("skills");
      const rerooted = host();
      expect(viewed(rerooted)).toBe("party");
      expect(inView(rerooted, "db-tab-skills")).toBe("1");
    });
  });
});

describe("spatialCompositionWorkspace", () => {
  isolateTimers();
  const previous = store.getCurrent();
  beforeEach(() => { clearAuthoringSession(); const fixture = mixedFixture();
    for (const records of [fixture.spatialAuthoring!.library.places, fixture.spatialAuthoring!.library.regions, fixture.spatialAuthoring!.library.worlds]) for (const [id, value] of Object.entries(records)) records[id] = { ...value, composition: { ...value.composition!, tiles: [] } };
    store.replace(fixture, { preserveEventDrafts: false }); bindSpatialAuthoringControllerFactory(createSpatialAuthoringController); });
  afterEach(() => { document.body.replaceChildren(); clearAuthoringSession(); bindSpatialAuthoringControllerFactory(null); store.replace(previous, { preserveEventDrafts: false }); });
  const source = { kind: "space" as const, id: spatialId("room-design") };
  function mount() {
    const render = () => document.body.replaceChildren(renderSpatialCompositionWorkspace({ ...spatialSession(), tab: "spaces" }, { id: "room", name: "Room", kind: "spaces", source: "own", usage: 0, canonicalSource: source }, render));
    render();
  }
  function click(id: string) { document.querySelector<HTMLButtonElement>(`[data-testid='${id}']`)!.click(); }
  it("moves and removes a selected direct member with consecutive keyboard edits, then applies", () => {
    mount();
    document.querySelector<HTMLButtonElement>(".spatial-mixed-member")!.click();
    expect(document.activeElement?.getAttribute("data-testid")).toBe("composition-board");
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(6);
    expect(store.getCurrent().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(4);
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members).toHaveLength(0);
    click("composition-undo");
    expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members).toHaveLength(1);
    expect(previewAuthoringDraft().kind).toBe("ok"); expect(applyAuthoringPreview().kind).toBe("ok");
    expect(store.getCurrent().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(6);
  });
  it("rejects shrinking across a child's footprint without poisoning the draft", () => {
    const before = visibleAuthoringProject();
    expect(editComposition(source, value => ({ ...value, height: 7 }))).not.toBeNull();
    expect(visibleAuthoringProject()).toBe(before);
    expect(editComposition(source, value => ({ ...value, width: 22 }))).toBeNull();
    expect(previewAuthoringDraft().kind).toBe("ok");
  });
  it("offers a single place material category in both place editors", () => {
    for (const [kind, id, tab, allowed] of [["space", "room-design", "spaces", ["tile", "object", "place"]], ["place", "inn", "places", ["tile", "object", "place"]], ["region", "town", "regions", ["tile", "object", "place"]], ["world", "world", "worlds", ["tile", "object", "place", "region"]]] as const) {
      const root = renderSpatialCompositionWorkspace({ ...spatialSession(), tab }, { id, name: id, kind: tab, source: "own", usage: 0, canonicalSource: { kind, id: spatialId(id) } }, () => {});
      expect([...root.querySelectorAll("[data-testid^='composition-material-']")].map(el => el.getAttribute("data-testid")!.replace("composition-material-", ""))).toEqual(allowed);
    }
  });
  it("shows both room and building materials together while excluding self and ancestors", () => {
    const render = () => document.body.replaceChildren(renderSpatialCompositionWorkspace({ ...spatialSession(), tab: "regions" }, {
      id: "town", name: "마을", kind: "regions", source: "own", usage: 0, canonicalSource: { kind: "region", id: spatialId("town") },
    }, render));
    render();
    click("composition-material-place");
    expect(document.querySelector("[data-testid='composition-asset-room-design']")).not.toBeNull();
    expect(document.querySelector("[data-testid='composition-asset-inn']")).not.toBeNull();
    expect(document.querySelector("[data-testid='composition-material-space']")).toBeNull();
    mount();
    click("composition-material-place");
    expect(document.querySelector("[data-testid='composition-asset-room-design']")).toBeNull();
    expect(document.querySelector("[data-testid='composition-asset-inn']")).toBeNull();
  });
});
