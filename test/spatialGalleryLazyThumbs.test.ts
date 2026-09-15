/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderSpatialAuthoringShell } from "@/editor/panels/spatialShell";
import {
  flushSpatialCardThumbs,
  resetSpatialCardThumbs,
} from "@/editor/panels/spatialCardThumbs";
import { resetSpatialAuthoringSessions } from "@/editor/panels/spatialAuthoringSession";

const previous = store.getCurrent();

function mountPlaces(): HTMLElement {
  const host = document.createElement("div");
  renderSpatialAuthoringShell(host, "places", () => {});
  return host;
}

function slots(host: HTMLElement, state: "pending" | "ready"): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(`[data-thumb='${state}']`)];
}

beforeEach(() => {
  resetSpatialAuthoringSessions();
  resetSpatialCardThumbs();
  store.replace(createBlankProject(), { preserveEventDrafts: false });
});

describe("데이터베이스 장소·오브젝트·지역 탭 갤러리 썸네일", () => {
  it("탭을 여는 렌더에서는 카드 썸네일을 굽지 않는다", () => {
    // Given/When: 장소 탭이 마운트된다.
    const host = mountPlaces();

    // Then: 카드는 전부 자리표시자다 — 마운트가 N장의 맵 컴파일을 떠안지 않는다.
    expect(slots(host, "pending").length).toBeGreaterThan(0);
    expect(slots(host, "ready")).toHaveLength(0);
  });

  it("보이게 되면 굽고, 다시 렌더해도 같은 그림을 재사용한다", () => {
    // Given: 한 번 구워 둔 갤러리.
    const first = mountPlaces();
    flushSpatialCardThumbs();
    const ready = slots(first, "ready");
    expect(ready.length).toBeGreaterThan(0);
    const art = ready[0]!.firstElementChild;
    expect(art).not.toBeNull();

    // When: 카드를 고르는 등으로 셸이 통째로 다시 렌더된다.
    const second = mountPlaces();

    // Then: 구운 그림이 그대로 붙는다 — 재렌더가 컴파일을 다시 지불하지 않는다.
    const reused = slots(second, "ready");
    expect(reused.length).toBe(ready.length);
    expect(reused[0]!.firstElementChild).toBe(art);
  });

  it("프로젝트가 바뀌면 구워 둔 그림을 버린다", () => {
    // Given: 구워 둔 갤러리.
    const first = mountPlaces();
    flushSpatialCardThumbs();
    const art = slots(first, "ready")[0]?.firstElementChild;
    expect(art).not.toBeNull();

    // When: 프로젝트 내용이 바뀐다.
    store.update((draft) => {
      draft.name = `${draft.name}-edited`;
    });

    // Then: 다음 렌더는 다시 자리표시자로 시작한다(낡은 그림을 내보내지 않는다).
    const second = mountPlaces();
    expect(slots(second, "ready")).toHaveLength(0);
    expect(slots(second, "pending").length).toBeGreaterThan(0);
    flushSpatialCardThumbs();
    expect(slots(second, "ready")[0]?.firstElementChild).not.toBe(art);
  });
});

store.replace(previous, { preserveEventDrafts: false });
