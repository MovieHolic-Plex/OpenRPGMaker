import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeChipsWithAreas,
  changePreviewChips,
  changePreviewRegion,
  openWideChangeViewer,
  renderChangePreviewCard,
  type ChangeShotRenderer,
} from "@/editor/panels/aiChangePreview";
import type { ChangeSummary } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";
import { documentListenerCount, FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function changeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function firstMapId(project: Project): string {
  const mapId = Object.keys(project.maps)[0];
  if (!mapId) throw new Error("빈 프로젝트에 맵이 없다");
  return mapId;
}

/** before/after 쌍 — after 는 (4,5) 타일 한 칸만 바꾼다. */
function tilePair(): { before: Project; after: Project; mapId: string } {
  const before = createBlankProject();
  const mapId = firstMapId(before);
  const after = structuredClone(before) as Project;
  const map = after.maps[mapId];
  if (!map) throw new Error("맵 복제 실패");
  const index = 5 * map.width + 4;
  map.lowerTiles[index] = (map.lowerTiles[index] ?? 0) + 1;
  return { before, after, mapId };
}

function stubRenderer(): ChangeShotRenderer {
  return vi.fn(async () => document.createElement("canvas") as HTMLCanvasElement);
}

/** 마이크로태스크 큐를 비운다 — 타이머/슬립 없음. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function requireTestId(root: FakeElement, testId: string): FakeElement {
  const found = findByTestId(root, testId);
  if (!found) throw new Error(`testid 없음: ${testId}`);
  return found;
}

function card(root: HTMLElement): FakeElement {
  if (root instanceof FakeElement) return root;
  throw new Error("FakeElement 기대");
}

function dispatchDocumentKey(key: string): void {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  document.dispatchEvent(event);
}

describe("changePreviewRegion", () => {
  it("타일 변경 bbox 에 패딩을 더한 영역을 쓴다", () => {
    const { before, after, mapId } = tilePair();
    const region = changePreviewRegion(before, after, mapId);
    expect(region).toEqual({ x: 1, y: 2, width: 7, height: 7 });
  });

  it("변경 bbox 가 없으면 after 맵 전체를 쓴다", () => {
    const before = createBlankProject();
    const after = structuredClone(before) as Project;
    const mapId = firstMapId(after);
    const map = after.maps[mapId];
    if (!map) throw new Error("맵 없음");
    expect(changePreviewRegion(before, after, mapId)).toEqual({ x: 0, y: 0, width: map.width, height: map.height });
  });

  it("양쪽 프로젝트에 맵이 없으면 null", () => {
    const before = createBlankProject();
    const after = createBlankProject();
    expect(changePreviewRegion(before, after, "map-does-not-exist")).toBeNull();
  });
});

describe("changePreviewChips", () => {
  it("0 이 아닌 항목만 한국어 라벨로, 고정 순서로 낸다", () => {
    const chips = changePreviewChips(
      changeSummary({
        tilesChanged: 128,
        eventsAdded: 2,
        eventsModified: 1,
        mapsAdded: 1,
        dbRecordsChanged: 3,
        tilesetsChanged: 1,
        switchesAdded: 2,
        variablesAdded: 1,
        worldEntitiesAdded: 3,
        endingsChanged: 1,
      }),
    );
    expect(chips).toEqual([
      "타일 128",
      "이벤트 +2",
      "이벤트 수정 1",
      "맵 +1",
      "DB 3",
      "타일셋 1",
      "스위치 +2",
      "변수 +1",
      "세계관 +3",
      "엔딩 1",
    ]);
  });

  it("변경이 없으면 빈 배열", () => {
    expect(changePreviewChips(changeSummary())).toEqual([]);
  });

  it("개수가 아닌 축(세션·시스템)은 이름만 낸다", () => {
    expect(changePreviewChips(changeSummary({ sessionChanged: true, systemChanged: true }))).toEqual(["세션", "시스템"]);
  });
});

describe("changeChipsWithAreas", () => {
  it("카운터 뒤에 카운터 밖 영역 이름을 붙인다 — 검토 카드가 빈 줄로 끝나지 않는다", () => {
    expect(changeChipsWithAreas(changeSummary({ tilesChanged: 3 }), ["퀘스트", "스토리 플래그"])).toEqual([
      "타일 3",
      "퀘스트",
      "스토리 플래그",
    ]);
  });

  it("요약이 없어도(카운터 밖 변경만 있어도) 이름은 남는다", () => {
    expect(changeChipsWithAreas(undefined, ["퀘스트"])).toEqual(["퀘스트"]);
  });

  it("같은 이름을 두 번 붙이지 않는다", () => {
    expect(changeChipsWithAreas(changeSummary({ sessionChanged: true }), ["세션"])).toEqual(["세션"]);
  });
});

describe("renderChangePreviewCard", () => {
  it("계약된 testid 와 before/after 순서를 지킨다", () => {
    const { before, after, mapId } = tilePair();
    const root = card(
      renderChangePreviewCard({
        before,
        after,
        mapId,
        title: "숲길에 나무를 심었습니다",
        detail: "타일 12칸",
        chips: ["타일 12"],
        renderShot: stubRenderer(),
      }),
    );
    expect(root.dataset.testid).toBe("ai-change-card");
    expect(root.className).toContain("ai-change-card");
    expect(requireTestId(root, "ai-change-expand").textContent).toBe("넓게 보기");
    expect(requireTestId(root, "ai-change-card").querySelector(".ai-change-title")?.textContent).toBe(
      "숲길에 나무를 심었습니다",
    );
    const pair = requireTestId(root, "ai-change-pair");
    const kinds = pair.querySelectorAll(".ai-change-shot").map((shot) => shot.dataset.kind);
    expect(kinds).toEqual(["before", "after"]);
    const labels = pair.querySelectorAll(".ai-change-shot-label").map((node) => node.textContent);
    // 데크(2026-09-03): DESIGN.md 의 「지금 / 적용 후」 어휘로 통일.
    expect(labels).toEqual(["지금", "적용 후"]);
    expect(findByTestId(root, "ai-change-shot-before")).not.toBeNull();
    expect(findByTestId(root, "ai-change-shot-after")).not.toBeNull();
    expect(pair.querySelector(".ai-change-arrow")).not.toBeNull();
    expect(root.querySelector(".ai-change-chip")?.textContent).toBe("타일 12");
    expect(root.querySelector(".ai-change-detail")?.textContent).toBe("타일 12칸");
    expect(findByTestId(root, "ai-change-undo")).toBeNull();
  });

  it("onUndo 가 있을 때만 되돌리기 버튼이 있고, 클릭은 한 번 호출한다", () => {
    const { before, after, mapId } = tilePair();
    const onUndo = vi.fn();
    const root = card(
      renderChangePreviewCard({ before, after, mapId, title: "변경", onUndo, renderShot: stubRenderer() }),
    );
    const undo = requireTestId(root, "ai-change-undo");
    expect(undo.textContent).toBe("되돌리기");
    undo.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("주입 렌더러의 캔버스가 after 컨테이너 안에 붙는다", async () => {
    const { before, after, mapId } = tilePair();
    const renderShot = stubRenderer();
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot }));
    expect(requireTestId(root, "ai-change-shot-after").children).toHaveLength(0);
    await flushMicrotasks();
    const afterShot = requireTestId(root, "ai-change-shot-after");
    expect(afterShot.children.map((child) => child.tagName)).toEqual(["CANVAS"]);
    expect(requireTestId(root, "ai-change-shot-before").children.map((child) => child.tagName)).toEqual(["CANVAS"]);
    expect(renderShot).toHaveBeenCalledTimes(2);
  });

  it("렌더러가 실패하면 폴백 문구를 넣는다", async () => {
    const { before, after, mapId } = tilePair();
    const renderShot: ChangeShotRenderer = vi.fn(async () => {
      throw new Error("no canvas");
    });
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot }));
    await flushMicrotasks();
    const fallbacks = root.querySelectorAll(".ai-change-shot-fallback");
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks[0]?.textContent).toBe("미리보기 불가");
    expect(requireTestId(root, "ai-change-shot-after").querySelector(".ai-change-shot-fallback")).not.toBeNull();
  });
});

describe("openWideChangeViewer", () => {
  it("body 에 붙고 모드 토글이 data-mode 를 바꾼다", () => {
    const { before, after, mapId } = tilePair();
    const viewer = openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });
    const root = card(viewer.root);
    expect(document.body.contains(root)).toBe(true);
    expect(root.dataset.testid).toBe("ai-change-wide");
    const body = root.querySelector(".ai-change-wide-body");
    expect(body?.dataset.mode).toBe("side");
    requireTestId(root, "ai-change-wide-mode-overlay").click();
    expect(body?.dataset.mode).toBe("overlay");
    requireTestId(root, "ai-change-wide-mode-side").click();
    expect(body?.dataset.mode).toBe("side");
    viewer.close();
  });

  it("슬라이더가 after 클립을 갱신한다", () => {
    const { before, after, mapId } = tilePair();
    const viewer = openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });
    const root = card(viewer.root);
    const slider = requireTestId(root, "ai-change-wide-slider");
    const afterShot = requireTestId(root, "ai-change-wide-shot-after");
    slider.value = "40";
    slider.dispatchEvent(new Event("input"));
    expect(afterShot.style.clipPath).toBe("inset(0 60% 0 0)");
    viewer.close();
  });

  it("닫기 버튼·배경 클릭·Escape 로 닫히고 두 번째 Escape 는 아무 일도 안 한다", () => {
    const { before, after, mapId } = tilePair();
    const open = (): ReturnType<typeof openWideChangeViewer> =>
      openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });

    const byButton = open();
    requireTestId(card(byButton.root), "ai-change-wide-close").click();
    expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();

    const byBackdrop = open();
    card(byBackdrop.root).click();
    expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();

    const byEscape = open();
    expect(documentListenerCount("keydown")).toBe(1);
    dispatchDocumentKey("Escape");
    expect(documentListenerCount("keydown")).toBe(0);
    expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();
    expect(document.body.contains(card(byEscape.root))).toBe(false);
    dispatchDocumentKey("Escape");
    expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();
    byEscape.close();
  });
});

/** 지도 그림이 같아지는 쌍 — 맵 밖 변경(퀘스트·설정·이벤트 내용)만 다르다. */
function nonMapPair(mutate: (after: Project, mapId: string) => void): { before: Project; after: Project; mapId: string } {
  const before = createBlankProject();
  const mapId = firstMapId(before);
  const after = structuredClone(before) as Project;
  mutate(after, mapId);
  return { before, after, mapId };
}
/** 썸네일이 읽는 것은 id·x·y 뿐이다 — 나머지 필드는 계약 밖이라 최소값으로 채운다. */
function eventAt(x: number, y: number, name: string): GameEvent {
  return { id: "event_1", name, x, y, pages: [] } as unknown as GameEvent;
}

describe("그림이 같으면 비교 대신 사실을 말한다", () => {
  it("타일·이벤트 좌표가 그대로면 두 장을 그리지 않고 안내를 낸다", () => {
    const { before, after, mapId } = nonMapPair((project) => {
      project.meta = { ...project.meta, author: "다른 사람" };
    });
    const renderShot = stubRenderer();

    const root = card(renderChangePreviewCard({ before, after, mapId, title: "작가를 바꿨습니다", renderShot }));

    expect(findByTestId(root, "ai-change-pair")).toBeNull();
    expect(findByTestId(root, "ai-change-expand")).toBeNull();
    expect(requireTestId(root, "ai-change-word-diff").textContent).toContain("지도 그림에 나타나지 않습니다");
    // 두 장을 그리지 않으므로 렌더러를 부르지 않는다 — 같은 그림을 두 번 그리는 비용도 없다.
    expect(renderShot).not.toHaveBeenCalled();
  });

  it("이벤트 내용만 바뀐 경우도 두 장 대신 안내다(그림은 좌표만 그린다)", () => {
    const { before, after, mapId } = nonMapPair((project, id) => {
      project.maps[id]!.events = [eventAt(1, 1, "이름만 바뀐 이벤트")];
    });
    before.maps[mapId]!.events = [eventAt(1, 1, "원래 이름")];
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "대사를 고쳤습니다", renderShot: stubRenderer() }));
    expect(findByTestId(root, "ai-change-pair")).toBeNull();
    expect(findByTestId(root, "ai-change-word-diff")).not.toBeNull();
  });

  it("타일은 같아도 타일셋 정의가 바뀌면 그림이 다르므로 두 장을 그린다", () => {
    const { before, after, mapId } = nonMapPair((project, id) => {
      const tilesetId = project.maps[id]!.tilesetId;
      const tileset = project.tilesets[tilesetId]!;
      project.tilesets[tilesetId] = { ...tileset, name: `${tileset.name} (개정)` };
    });
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "타일셋 개정", renderShot: stubRenderer() }));
    expect(findByTestId(root, "ai-change-pair")).not.toBeNull();
    expect(findByTestId(root, "ai-change-word-diff")).toBeNull();
  });

  it("이벤트가 움직이면 (타일이 그대로여도) 두 장을 그린다", () => {
    const { before, after, mapId } = nonMapPair((project, id) => {
      project.maps[id]!.events = [eventAt(2, 1, "NPC")];
    });
    before.maps[mapId]!.events = [eventAt(1, 1, "NPC")];
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "NPC 를 옮겼습니다", renderShot: stubRenderer() }));
    expect(findByTestId(root, "ai-change-pair")).not.toBeNull();
  });

  it("안내 문구는 칩이 없으면 '위 항목' 을 가리키지 않는다", () => {
    const { before, after, mapId } = nonMapPair((project) => {
      project.meta = { ...project.meta, author: "다른 사람" };
    });
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot: stubRenderer() }));
    expect(requireTestId(root, "ai-change-word-diff").textContent).not.toContain("위 항목");
  });

  it("넓은 뷰어도 같은 판정을 쓴다 — 같으면 비교 모드를 만들지 않는다", () => {
    const { before, after, mapId } = nonMapPair((project) => {
      project.meta = { ...project.meta, author: "다른 사람" };
    });
    const viewer = openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });
    const root = card(viewer.root);
    expect(findByTestId(root, "ai-change-word-diff")).not.toBeNull();
    expect(findByTestId(root, "ai-change-wide-mode-side")).toBeNull();
    expect(findByTestId(root, "ai-change-wide-shot-before")).toBeNull();
    viewer.close();
  });
});

describe("카드가 말하는 상태", () => {
  it("기본은 영수증(적용됨)이다", () => {
    const { before, after, mapId } = tilePair();
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot: stubRenderer() }));
    expect(root.querySelector(".ai-change-badge")?.textContent).toBe("적용됨");
    expect(root.dataset.state).toBe("applied");
  });

  it("검토 대기 카드는 「적용 전」 이고 되돌리기가 없다", () => {
    const { before, after, mapId } = tilePair();
    const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", state: "proposed", renderShot: stubRenderer() }));
    expect(root.querySelector(".ai-change-badge")?.textContent).toBe("적용 전");
    expect(root.dataset.state).toBe("proposed");
    expect(findByTestId(root, "ai-change-undo")).toBeNull();
  });
});
