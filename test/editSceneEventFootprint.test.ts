/** @vitest-environment happy-dom */
// 편집 맵과 내장 플레이어가 이벤트를 **몸 사각**으로 다루는지 — 2차 스펙 §5.
//
// 판별력 규칙: 프로브는 앵커 칸을 겨냥하지 않는다. 앵커는 1x1 이어도 같은 결과라
// 아무것도 증명하지 않는다.
import { describe, expect, it } from "vitest";
import {
  editorSpriteScale,
  eventMarkerTileScale,
  renderEventMarkers,
} from "@/editor/editSceneEventMarkers";
import {
  eventAtPoint,
  eventBodyRect,
  eventCoversPoint,
  findEventCoveringPoint,
  overlappingEventPairs,
} from "@/project/eventFootprintQuery";
import { runtimeEventView } from "@/project/runtimeEventState";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import type { CharacterFootprint, EventPage, GameEvent, GameMap } from "@/project/types";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "p1",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...overrides,
  };
}

function event(
  id: string,
  x: number,
  y: number,
  footprint?: CharacterFootprint,
  extra: Partial<EventPage> = {}
): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [page({ footprint, ...extra })],
  };
}

function mapWith(events: readonly GameEvent[]): GameMap {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  return { ...map, events: [...events] };
}

describe("eventBodyRect — 발자국은 첫 페이지에서 읽는다", () => {
  it("발자국 없는 이벤트는 앵커 한 칸이다(항등)", () => {
    expect(eventBodyRect(event("e", 5, 7))).toEqual({ left: 5, right: 5, top: 7, bottom: 7 });
  });

  it("3x3 은 발밑에서 위로 자란다", () => {
    expect(eventBodyRect(event("e", 5, 7, { width: 3, height: 3 })))
      .toEqual({ left: 4, right: 6, top: 5, bottom: 7 });
  });

  it("짝수 폭은 앵커가 중앙 왼쪽이다", () => {
    expect(eventBodyRect(event("e", 5, 7, { width: 2, height: 2 })))
      .toEqual({ left: 5, right: 6, top: 6, bottom: 7 });
  });
});

describe("findEventCoveringPoint — 비앵커 칸 클릭이 선택으로 잡힌다", () => {
  const golem = event("golem", 5, 7, { width: 3, height: 3 });
  const events = [golem];

  it("상체 칸을 클릭해도 같은 이벤트다 — 앵커 점 비교는 여기서 빈 칸이라 답했다", () => {
    for (const [x, y] of [[4, 5], [5, 5], [6, 5], [4, 6], [6, 6], [4, 7], [6, 7]] as const) {
      expect(findEventCoveringPoint(events, x, y)?.id).toBe("golem");
    }
  });

  it("몸 사각 밖은 잡히지 않는다", () => {
    for (const [x, y] of [[3, 6], [7, 6], [5, 4], [5, 8]] as const) {
      expect(findEventCoveringPoint(events, x, y)).toBeUndefined();
    }
  });

  it("발자국 없는 이벤트는 앵커 한 칸만 잡는다(항등)", () => {
    const plain = [event("plain", 2, 3)];
    expect(findEventCoveringPoint(plain, 2, 3)?.id).toBe("plain");
    expect(findEventCoveringPoint(plain, 3, 3)).toBeUndefined();
    expect(findEventCoveringPoint(plain, 2, 2)).toBeUndefined();
  });

  it("겹치면 배열 순서가 이긴다 — 2차에서 규칙을 바꾸지 않고 명문화만 한다", () => {
    const first = event("first", 5, 7, { width: 3, height: 3 });
    const second = event("second", 5, 6, { width: 3, height: 3 });
    expect(findEventCoveringPoint([first, second], 4, 6)?.id).toBe("first");
    expect(findEventCoveringPoint([second, first], 4, 6)?.id).toBe("second");
  });

  it("eventAtPoint 는 맵의 정적 목록에 대한 래퍼다", () => {
    const map = mapWith([golem]);
    expect(eventAtPoint(map, 6, 5)?.id).toBe("golem");
    expect(eventAtPoint(map, 7, 5)).toBeUndefined();
  });

  it("eventCoversPoint 는 단일 이벤트 판정이다", () => {
    expect(eventCoversPoint(golem, 4, 5)).toBe(true);
    expect(eventCoversPoint(golem, 3, 5)).toBe(false);
  });
});

describe("overlappingEventPairs — 앵커 키로는 못 잡던 겹침", () => {
  it("앵커가 다른데 몸이 겹치는 두 이벤트를 잡는다", () => {
    // 앵커 문자열 키(`x,y`)는 5,7 과 5,6 을 서로 다르다고 본다 — 그래서 못 잡았다.
    const pairs = overlappingEventPairs([
      event("a", 5, 7, { width: 3, height: 3 }),
      event("b", 5, 6, { width: 3, height: 3 }),
    ]);
    expect(pairs).toHaveLength(1);
    expect([pairs[0]?.a.id, pairs[0]?.b.id]).toEqual(["a", "b"]);
  });

  it("몸이 안 닿으면 쌍이 없다", () => {
    expect(overlappingEventPairs([
      event("a", 2, 7, { width: 3, height: 3 }),
      event("b", 8, 7, { width: 3, height: 3 }),
    ])).toHaveLength(0);
  });

  it("발자국 없는 이벤트끼리는 같은 칸일 때만 겹친다(항등)", () => {
    expect(overlappingEventPairs([event("a", 4, 4), event("b", 5, 4)])).toHaveLength(0);
    expect(overlappingEventPairs([event("a", 4, 4), event("b", 4, 4)])).toHaveLength(1);
  });
});

describe("editorSpriteScale — 배율이 있으면 실제 크기", () => {
  it("배율 없는 그림은 예전처럼 한 칸으로 축소한다", () => {
    expect(editorSpriteScale(undefined, 24, 32)).toBe(eventMarkerTileScale(24, 32));
    expect(editorSpriteScale({}, 24, 32)).toBe(eventMarkerTileScale(24, 32));
  });

  it("배율이 있으면 그 값을 그대로 쓴다 — 타일에 맞춰 줄이지 않는다", () => {
    expect(editorSpriteScale({ scale: 3 }, 24, 32)).toBe(3);
    expect(editorSpriteScale({ scale: 0.5 }, 24, 32)).toBe(0.5);
  });

  it("비정규 배율은 1 로 굳는다", () => {
    expect(editorSpriteScale({ scale: Number.NaN }, 24, 32)).toBe(1);
  });
});

type FakeRect = {
  readonly kind: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  strokeColor: number | null;
  data: Record<string, unknown>;
};

type FakeImage = {
  readonly kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scale: number;
};

type FakeObject = FakeRect | FakeImage | { readonly kind: "other" };

function fakeMarkerScene(): { scene: unknown; layer: { add(o: FakeObject): void }; objects: FakeObject[] } {
  const objects: FakeObject[] = [];
  const scene = {
    cameras: { main: { zoom: 1 } },
    add: {
      rectangle(x: number, y: number, width: number, height: number): FakeRect {
        const rect: FakeRect = {
          kind: "rectangle",
          x,
          y,
          width,
          height,
          originX: 0.5,
          originY: 0.5,
          strokeColor: null,
          data: {},
        };
        return Object.assign(rect, {
          setOrigin(ox: number, oy: number) {
            rect.originX = ox;
            rect.originY = oy;
            return rect;
          },
          setStrokeStyle(_w: number, color: number) {
            rect.strokeColor = color;
            return rect;
          },
          setData(key: string, value: unknown) {
            rect.data[key] = value;
            return rect;
          },
        });
      },
      image(x: number, y: number): FakeImage {
        const image: FakeImage = {
          kind: "image",
          x,
          y,
          width: 24,
          height: 32,
          originX: 0.5,
          originY: 0.5,
          scale: 1,
        };
        return Object.assign(image, {
          setOrigin(ox: number, oy: number) {
            image.originX = ox;
            image.originY = oy;
            return image;
          },
          setScale(value: number) {
            image.scale = value;
            return image;
          },
        });
      },
      container() {
        return { add() {}, setAlpha() {} };
      },
      circle() {
        return { setStrokeStyle() {} };
      },
      text() {
        return { setOrigin() { return {}; } };
      },
    },
  };
  const layer = { add: (o: FakeObject) => objects.push(o) };
  return { scene, layer, objects };
}

function renderMarkers(events: readonly GameEvent[]): FakeObject[] {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [...events];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: null, selectedEventPageId: null });
  const { scene, layer, objects } = fakeMarkerScene();
  renderEventMarkers(
    {
      scene: scene as never,
      overlayLayer: layer as never,
    },
    store.getCurrent().maps[mapId]!,
    "event"
  );
  return objects;
}

describe("renderEventMarkers — 편집 맵에 몸 사각과 통행 행을 그린다", () => {
  const SPRITE = { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, scale: 3 } as const;

  it("3x3 몸은 사각 오버레이 두 장을 낳는다 — 통행 음영과 몸 외곽선", () => {
    const objects = renderMarkers([
      event("golem", 5, 7, { width: 3, height: 3 }, { passRows: 1 }),
    ]);
    const rects = objects.filter((o): o is FakeRect => o.kind === "rectangle");
    const bodyRect = rects.find((r) => r.data.testid === "event-body-rect");
    expect(bodyRect).toBeTruthy();
    // 몸 사각: 왼쪽 4, 위 5 에서 3x3 타일.
    expect([bodyRect?.x, bodyRect?.y, bodyRect?.width, bodyRect?.height]).toEqual([64, 80, 48, 48]);
    expect([bodyRect?.originX, bodyRect?.originY]).toEqual([0, 0]);
    // 통행 음영은 하단 한 행만 — 48x16.
    const pass = rects.find((r) => r.data.testid === undefined && r.height === 16);
    expect([pass?.x, pass?.y, pass?.width]).toEqual([64, 112, 48]);
  });

  it("통행 행이 몸 높이와 같으면 음영이 몸 사각을 다 덮는다", () => {
    const objects = renderMarkers([
      event("golem", 5, 7, { width: 3, height: 3 }, { passRows: 3 }),
    ]);
    const rects = objects.filter((o): o is FakeRect => o.kind === "rectangle");
    const pass = rects.find((r) => r.data.testid === undefined);
    expect([pass?.width, pass?.height]).toEqual([48, 48]);
  });

  it("발자국 없는 이벤트는 예전 한 칸 마커 그대로다(항등)", () => {
    const objects = renderMarkers([event("plain", 5, 7)]);
    const rects = objects.filter((o): o is FakeRect => o.kind === "rectangle");
    expect(rects).toHaveLength(1);
    // TILE_SIZE - 4 = 12, 중앙 원점 — 1차와 같은 마커다.
    expect([rects[0]?.width, rects[0]?.height, rects[0]?.originX]).toEqual([12, 12, 0.5]);
    expect(rects[0]?.data.testid).toBeUndefined();
  });

  it("크기를 지정하지 않은 이벤트의 그림은 예전처럼 타일 중앙에 축소된다(항등)", () => {
    const objects = renderMarkers([
      event("plain", 5, 7, undefined, { graphic: { sprite: SPRITE.sprite } }),
    ]);
    const image = objects.find((o): o is FakeImage => o.kind === "image");
    // 1차와 같다: 타일 중앙(88,120), 원점 0.5/0.5, 한 칸 축소.
    expect([image?.x, image?.y]).toEqual([88, 120]);
    expect([image?.originX, image?.originY]).toEqual([0.5, 0.5]);
    expect(image?.scale).toBe(eventMarkerTileScale(24, 32));
  });

  it("1x1 이라도 배율을 지정하면 발밑 기준 실제 크기로 바뀐다", () => {
    const objects = renderMarkers([
      event("scaled", 5, 7, undefined, { graphic: { sprite: SPRITE.sprite, scale: 2 } }),
    ]);
    const image = objects.find((o): o is FakeImage => o.kind === "image");
    expect([image?.x, image?.y, image?.scale]).toEqual([88, 128, 2]);
    expect(image?.originY).toBe(1);
  });

  it("스프라이트를 실제 배율로 몸 사각 발밑 중앙에 세운다", () => {
    const objects = renderMarkers([
      event("golem", 5, 7, { width: 3, height: 3 }, { passRows: 1, graphic: SPRITE }),
    ]);
    const image = objects.find((o): o is FakeImage => o.kind === "image");
    expect(image).toBeTruthy();
    expect(image?.scale).toBe(3);
    // 앵커 칸(5,7) 의 가로 중앙 = 5*16+8 = 88, 발밑 = (7+1)*16 = 128.
    expect([image?.x, image?.y]).toEqual([88, 128]);
    expect([image?.originX, image?.originY]).toEqual([0.5, 1]);
  });

  it("몸 사각이 겹친 이벤트는 외곽선 색이 다르다(저작 시점 경고)", () => {
    const objects = renderMarkers([
      event("a", 5, 7, { width: 3, height: 3 }),
      event("b", 5, 6, { width: 3, height: 3 }),
    ]);
    const warned = objects.filter(
      (o): o is FakeRect => o.kind === "rectangle" && o.data.testid === "event-body-overlap"
    );
    expect(warned).toHaveLength(2);
  });

  it("겹치지 않으면 경고 외곽선이 없다", () => {
    const objects = renderMarkers([
      event("a", 2, 7, { width: 3, height: 3 }),
      event("b", 8, 7, { width: 3, height: 3 }),
    ]);
    expect(objects.some((o) => o.kind === "rectangle" && o.data.testid === "event-body-overlap")).toBe(false);
  });
});

describe("내장 플레이어 마커 — 클릭 히트박스가 몸 사각이다", () => {
  function marker(footprint?: CharacterFootprint): HTMLElement {
    const host = document.createElement("div");
    host.style.width = "320px";
    host.style.height = "240px";
    document.body.append(host);
    // 마커는 export-QA 부트에서만 존재한다(`instrumented`). 플래그 없이 만들면
    // `upsertEventMarker` 가 조용히 반환해 히트박스를 관측할 대상 자체가 없다.
    const overlay = new RuntimeDomOverlay(() => host, { qaInstrumentation: true });
    const source = event("golem", 5, 7, footprint);
    overlay.upsertEventMarker(runtimeEventView(source, {}, {}));
    const found = host.querySelector<HTMLElement>("[data-testid='event-golem']");
    if (!found) throw new Error("marker missing");
    return found;
  }

  it("3x3 은 48x48 히트박스가 되고 위치도 몸 사각 좌상단이다", () => {
    const element = marker({ width: 3, height: 3 });
    expect(element.style.width).toBe("48px");
    expect(element.style.height).toBe("48px");
    // 몸 사각 좌상단 (4,5) → 64,80 px.
    expect(element.dataset.mapX).toBe("64");
    expect(element.dataset.mapY).toBe("80");
  });

  it("발자국 없는 이벤트는 한 칸 그대로다(항등)", () => {
    const element = marker();
    expect(element.style.width).toBe("16px");
    expect(element.dataset.mapX).toBe("80");
    expect(element.dataset.mapY).toBe("112");
  });
});
