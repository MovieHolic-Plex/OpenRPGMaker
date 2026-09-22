// @vitest-environment happy-dom
// 장소 갤러리 레이아웃 계약 (2026-09-21) — 목록이 기본, 선택과 편집기 진입의 분리.
//
// 실측 근거(1600×1000, 편집기 셸 안):
//  - 개편 전: 그리드 791×424, 5열 2줄 = 한 화면 10장. 카드를 누르면 선택과 동시에 편집기가 열려
//    「맵에 놓기」 액션 줄을 볼 수 없었다(listView: card.id !== selected?.id).
//  - 개편 후: 그리드 1332×527, 7열 = 한 화면 14장. 첫 클릭은 선택만, 편집기는 「편집」 버튼.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { libraryPlaceCardId } from "@/editor/panels/spatialPlaceQuery";
import {
  resetSpatialAuthoringSessions,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import { store } from "@/project/store";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";

const previous = store.getCurrent();
const previousEditor = editorState.get();
let host: HTMLDivElement;

function paint(): void {
  renderDatabasePanel(host);
}

function village() {
  const place = Object.values(store.getCurrent().spatialAuthoring?.library.places ?? {})
    .find((entry) => entry.kind === "settlement");
  if (!place) throw new Error("missing village");
  return place;
}

function cardSelector(id: string): string {
  return "[data-testid='spatial-card-" + id + "']";
}

beforeEach(() => {
  resetSpatialAuthoringSessions();
  store.replace(placeCompilerFixture(7), { preserveEventDrafts: false });
  editorState.set({ currentMapId: store.getCurrent().startMapId });
  host = document.createElement("div");
  host.className = "database-modal-body";
  document.body.append(host);
});

afterEach(() => {
  host.remove();
  resetSpatialAuthoringSessions();
  store.replace(previous, { preserveEventDrafts: false });
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

describe("places gallery library-first layout", () => {
  it("shows the gallery, not the editor, when the tab first renders", () => {
    setDatabaseActiveTab("spatialPlaces");
    paint();
    expect(host.querySelector("[data-testid='spatial-gallery']")).not.toBeNull();
    // 2026-09-22 목업 개편: 목적 스트립(파이프라인 안내 띠)은 제거됐다 — 한 줄 머리가 그 역할을 대신한다.
    expect(host.querySelector("[data-testid='spatial-purpose']")).toBeNull();
    expect(host.querySelector("[data-testid='place-library-count']")).not.toBeNull();
    // 편집기는 목록에서 명시적으로 들어간다.
    expect(host.querySelector("[data-testid='composition-board']")).toBeNull();
  });

  it("marks the body library-only until the inspector toggle opens the stage", () => {
    setDatabaseActiveTab("spatialPlaces");
    paint();
    // 2026-09-22 목업 개편: 렌더 직후가 아니라 **카드를 고른 뒤** 속성이 열린다.
    expect(host.querySelector(".spatial-body")?.classList.contains("is-library-only")).toBe(true);
    // 스테이지는 DOM 에 남는다 — 접기만 하므로 토글이 죽은 버튼이 되지 않는다.
    expect(host.querySelector(".spatial-stage")).not.toBeNull();
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-inspector-toggle']")?.click();
    expect(host.querySelector(".spatial-body")?.classList.contains("is-library-only")).toBe(false);
  });

  it("opens the inspector when a place card is selected", () => {
    setDatabaseActiveTab("spatialPlaces");
    paint();
    const id = libraryPlaceCardId(village().id);
    host.querySelector<HTMLButtonElement>(cardSelector(id))?.click();
    expect(spatialSession().inspectorOpen).toBe(true);
    expect(host.querySelector(".spatial-body")?.classList.contains("is-library-only")).toBe(false);
  });

  it("selects on first card click without entering the editor", () => {
    setDatabaseActiveTab("spatialPlaces");
    paint();
    const id = libraryPlaceCardId(village().id);
    host.querySelector<HTMLButtonElement>(cardSelector(id))?.click();
    expect(spatialSession().galleryCardId).toBe(id);
    expect(spatialSession().listView).toBe(true);
    expect(host.querySelector("[data-testid='spatial-cell-actions']")).not.toBeNull();
    expect(host.querySelector("[data-testid='composition-board']")).toBeNull();
    expect(host.querySelector("[data-testid='spatial-gallery']")).not.toBeNull();
  });

  it("enters the editor from the selected card edit action", () => {
    setDatabaseActiveTab("spatialPlaces");
    paint();
    const id = libraryPlaceCardId(village().id);
    host.querySelector<HTMLButtonElement>(cardSelector(id))?.click();
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-cell-edit']")?.click();
    expect(spatialSession().listView).toBe(false);
    // 자식이 있는 장소는 복합 편집기 대신 장소 캔버스(층·방)로 들어간다 — 이 픽스처의 마을이 그렇다.
    // 복합 편집기로 가는 장소(composition 보유)는 셸을 통째로 바꾸므로 여기서 단정하지 않는다.
    expect(host.querySelector("[data-testid='spatial-places-board']")).not.toBeNull();
  });

  it("enters the editor when the same selected card is clicked again", () => {
    setDatabaseActiveTab("spatialPlaces");
    paint();
    const id = libraryPlaceCardId(village().id);
    host.querySelector<HTMLButtonElement>(cardSelector(id))?.click();
    host.querySelector<HTMLButtonElement>(cardSelector(id))?.click();
    expect(spatialSession().listView).toBe(false);
    expect(host.querySelector("[data-testid='spatial-places-board']")).not.toBeNull();
  });

  it("offers a filter reset when the gallery matches nothing", () => {
    setDatabaseActiveTab("spatialPlaces");
    paint();
    const search = host.querySelector<HTMLInputElement>("[data-testid='place-filter-search']");
    if (!search) throw new Error("missing place search");
    search.value = "zzzz-no-match";
    search.dispatchEvent(new Event("input"));
    expect(host.querySelector("[data-testid='spatial-gallery-empty']")).not.toBeNull();
    const reset = host.querySelector<HTMLButtonElement>("[data-testid='spatial-filter-reset']");
    expect(reset, "0건 화면의 탈출구").not.toBeNull();
    reset?.click();
    expect(host.querySelectorAll("[data-card-id]").length).toBeGreaterThan(1);
  });
});
