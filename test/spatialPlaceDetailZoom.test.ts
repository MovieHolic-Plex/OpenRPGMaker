/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderSpatialAuthoringShell } from "@/editor/panels/spatialShell";
import { flushSpatialCardThumbs, resetSpatialCardThumbs } from "@/editor/panels/spatialCardThumbs";
import { resetSpatialAuthoringSessions } from "@/editor/panels/spatialAuthoringSession";

const previous = store.getCurrent();

function mountPlaces(): HTMLElement {
  const body = document.createElement("div");
  body.className = "database-modal-body";
  document.body.append(body);
  const rerender = (): void => {
    body.replaceChildren();
    renderSpatialAuthoringShell(body, "places", rerender);
  };
  rerender();
  return body;
}

beforeEach(() => {
  document.body.replaceChildren();
  resetSpatialAuthoringSessions();
  resetSpatialCardThumbs();
  store.replace(createBlankProject(), { preserveEventDrafts: false });
});

describe("장소 카드 두 번 클릭 확대", () => {
  it("목록을 다시 그린 뒤에도 상세에 같은 그림이 커진다", () => {
    const body = mountPlaces();
    flushSpatialCardThumbs();
    const card = body.querySelector<HTMLButtonElement>(".spatial-card");
    expect(card).not.toBeNull();
    const listed = card!.querySelector("img");
    expect(listed?.getAttribute("src")).toBeTruthy();

    card!.click();
    const again = body.querySelector<HTMLButtonElement>(`[data-testid="${card!.dataset.testid}"]`);
    expect(again).not.toBeNull();
    again!.click();

    const detail = document.body.querySelector("[data-testid='spatial-place-detail']");
    const stage = detail?.querySelector("[data-zoom='detail']");
    expect(detail, stage?.textContent ?? "no detail").not.toBeNull();
    const zoom = document.body.querySelector<HTMLImageElement>("[data-testid='spatial-place-detail'] .spatial-place-zoom-art");
    expect(zoom, stage?.textContent ?? "no zoom").not.toBeNull();
    expect(zoom!.src.endsWith(listed!.getAttribute("src") ?? "missing")).toBe(true);
    expect(zoom!.closest(".database-modal-body")).toBeNull();
  });
});

store.replace(previous, { preserveEventDrafts: false });
