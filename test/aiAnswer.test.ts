import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEditorReferenceIndex, type EditorReferenceIndex, type EditorReferenceTarget, findEditorReferences, resolveEditorReferenceQuery } from "@/editor/aiAnswerLinks";
import { decorateEditorReferences, renderAssistantAnswer } from "@/editor/panels/aiAnswerLinkRender";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project, GameEvent, GameMap } from "@/project/types";
import { renderMarkdown } from "@/util/markdown";
import { FakeElement, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("aiAnswerLinkRender", () => {
  isolateTimers();
  function fixture(): Project {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    if (!start) throw new Error("blank project has no start map");
    start.name = "햇살 마을";
    const house = createBlankMap("상인 하나의 집", 20, 16);
    house.id = "map_house_interior_1";
    project.maps[house.id] = house;
    return project;
  }
  function merchant() {
    return {
      id: "ev_new_merchant",
      x: 3,
      y: 4,
      trigger: { kind: "action" as const },
      commands: [],
      pages: [{
        id: "ev_new_merchant_page_1",
        name: "새로 온 상인",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" as const },
        priority: "same" as const,
        movement: { type: "fixed" as const, speed: 3 as const, frequency: 3 as const },
        commands: [],
      }],
    };
  }
  function index(): EditorReferenceIndex {
    return buildEditorReferenceIndex(fixture());
  }
  function links(root: HTMLElement): FakeElement[] {
    return (root as unknown as FakeElement).querySelectorAll("[data-testid=ai-answer-link]");
  }
  describe("assistant answer internal links", () => {
    let restoreDom: (() => void) | null = null;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("turns an authored map name inside the answer into a navigation button", () => {
      const text = "우측 하단 마을 구역에 ‘상인 하나의 집’(실내 맵 1채)이 마련되어 있습니다.";
      const root = renderMarkdown(text);

      const created = decorateEditorReferences(root, index(), () => true);
      const buttons = links(root);

      expect(created).toBe(1);
      expect(buttons.map((button) => button.textContent)).toEqual(["상인 하나의 집"]);
      expect(buttons[0]?.tagName).toBe("BUTTON");
      expect(buttons[0]?.attrs.type).toBe("button");
    });

    it("keeps the surrounding sentence intact around the link", () => {
      const text = "‘상인 하나의 집’ 안에는 아직 상점 NPC가 없습니다.";
      const root = renderMarkdown(text);

      decorateEditorReferences(root, index(), () => true);

      expect(root.textContent).toBe(text);
    });

    it("clicking a link navigates to that target exactly once", () => {
      const navigated: EditorReferenceTarget[] = [];
      const root = renderMarkdown("‘상인 하나의 집’으로 가보세요.");

      decorateEditorReferences(root, index(), (target) => {
        navigated.push(target);
        return true;
      });
      const button = links(root)[0];
      if (!button) throw new Error("link not created");
      button.click();

      expect(navigated).toEqual([{ kind: "map", mapId: "map_house_interior_1" }]);
    });

    it("never links names inside code spans or fenced code", () => {
      const root = renderMarkdown(["`상인 하나의 집`", "", "```", "상인 하나의 집", "```"].join("\n"));

      const created = decorateEditorReferences(root, index(), () => true);

      expect(created).toBe(0);
      expect(links(root)).toHaveLength(0);
    });

    it("does not decorate an existing markdown link label", () => {
      const root = renderMarkdown("[상인 하나의 집](https://example.com/docs)");

      expect(decorateEditorReferences(root, index(), () => true)).toBe(0);
    });

    it("renderAssistantAnswer wires the live project index into the bubble body", () => {
      store.replace(fixture());

      const body = renderAssistantAnswer("‘상인 하나의 집’은 아직 비어 있습니다.");

      expect(links(body).map((button) => button.dataset.refKind)).toEqual(["map"]);
    });

    it("맵 변경 뒤 새 이벤트 이름으로 색인을 다시 만든다", () => {
      const project = fixture();
      store.replace(project);
      renderAssistantAnswer("햇살 마을은 조용합니다.");
      store.updateMap(project.startMapId, (map) => {
        const event = merchant();
        const page = event.pages[0];
        if (!page) throw new Error("event page is missing");
        page.name = "새로 온 상인";
        map.events.push(event);
      });

      const body = renderAssistantAnswer("새로 온 상인을 만나보세요.");

      expect(links(body).map((button) => button.dataset.refLabel)).toEqual(["새로 온 상인"]);
    });

    it("같은 이름이 여러 곳이면 한 곳을 고르지 않는다", () => {
      const project = createBlankProject();
      const first = createBlankMap("여관", 20, 16);
      first.id = "map_inn_a";
      const second = createBlankMap("여관", 20, 16);
      second.id = "map_inn_b";
      project.maps = { [first.id]: first, [second.id]: second };
      project.startMapId = first.id;
      store.replace(project);

      const body = renderAssistantAnswer("여관은 두 곳입니다.");

      expect(links(body).map((button) => button.dataset.refKind)).toEqual(["ambiguous"]);
    });
  });
});

describe("aiAnswerLinks", () => {
  isolateTimers();
  function eventNamed(id: string, name: string, x: number, y: number): GameEvent {
    return {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page_1`,
          name,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    };
  }
  function mapWith(id: string, name: string, events: GameEvent[] = []): GameMap {
    const map = createBlankMap(name, 20, 20);
    map.id = id;
    map.events = events;
    return map;
  }
  function projectWith(maps: readonly GameMap[]): Project {
    const project = createBlankProject();
    project.maps = {};
    for (const map of maps) project.maps[map.id] = map;
    const first = maps[0];
    if (first) project.startMapId = first.id;
    return project;
  }
  describe("buildEditorReferenceIndex", () => {
    it("indexes map names and named map events, longest label first", () => {
      const project = projectWith([
        mapWith("map_village", "마을 광장", [eventNamed("ev_hana", "상인 하나", 4, 7)]),
        mapWith("map_house_interior_1", "상인 하나의 집"),
      ]);

      const labels = buildEditorReferenceIndex(project).entries.map((entry) => entry.label);

      expect(labels[0]).toBe("상인 하나의 집");
      expect(labels).toContain("마을 광장");
      expect(labels).toContain("상인 하나");
    });

    it("marks a label shared by several places as ambiguous instead of guessing one", () => {
      const project = projectWith([
        mapWith("map_a", "여관", [eventNamed("ev_1", "주민", 1, 1)]),
        mapWith("map_b", "여관", [eventNamed("ev_2", "주민", 2, 2)]),
      ]);

      const index = buildEditorReferenceIndex(project);
      const inn = index.entries.find((entry) => entry.label === "여관");
      const villager = index.entries.find((entry) => entry.label === "주민");

      expect(inn?.target).toEqual({ kind: "ambiguous", label: "여관", count: 2 });
      expect(villager?.target).toEqual({ kind: "ambiguous", label: "주민", count: 2 });
    });

    it("skips names too short or without letters to be recognizable in prose", () => {
      const project = projectWith([mapWith("map_short", "A"), mapWith("map_digits", "12"), mapWith("map_ok", "동굴")]);

      const labels = buildEditorReferenceIndex(project).entries.map((entry) => entry.label);

      expect(labels).toEqual(["동굴"]);
    });

    it("is stable regardless of map insertion order", () => {
      const first = projectWith([mapWith("map_b", "북쪽 숲"), mapWith("map_a", "남쪽 들")]);
      const second = projectWith([mapWith("map_a", "남쪽 들"), mapWith("map_b", "북쪽 숲")]);

      expect(buildEditorReferenceIndex(first).entries).toEqual(buildEditorReferenceIndex(second).entries);
    });
  });
  describe("findEditorReferences", () => {
    const project = projectWith([
      mapWith("map_village", "마을", [eventNamed("ev_hana", "상인 하나", 4, 7)]),
      mapWith("map_house_interior_1", "상인 하나의 집"),
    ]);
    const index = buildEditorReferenceIndex(project);
    const boundaryIndex: EditorReferenceIndex = {
      entries: [
        { label: "광장", target: { kind: "map", mapId: "map_square" } },
        { label: "마을", target: { kind: "map", mapId: "map_village" } },
        { label: "집", target: { kind: "map", mapId: "map_house" } },
      ],
    };

    it("finds a quoted name in the assistant's own sentence", () => {
      const text = "건물 중에는 우측 하단 마을 구역에 ‘상인 하나의 집’(실내 맵 1채)이 마련되어 있습니다.";

      const spans = findEditorReferences(text, index);
      const labels = spans.map((span) => span.label);

      expect(labels).toContain("상인 하나의 집");
      const house = spans.find((span) => span.label === "상인 하나의 집");
      expect(text.slice(house?.start ?? 0, house?.end ?? 0)).toBe("상인 하나의 집");
      expect(house?.target).toEqual({ kind: "map", mapId: "map_house_interior_1" });
    });

    it("prefers the longest name and never overlaps spans", () => {
      const spans = findEditorReferences("상인 하나의 집에 들어가세요.", index);

      expect(spans).toHaveLength(1);
      expect(spans[0]?.label).toBe("상인 하나의 집");
    });

    it("이름 뒤에 이어진 완전한 조사와 한 번의 보조사 결합을 허용한다", () => {
      const cases = [
        ...[
          "하고", "한테", "께서", "마다", "조차", "밖에", "에서",
          "으로", "에게", "까지", "부터", "처럼", "보다",
        ].map((particle) => ({ sentence: `마을${particle}`, label: "마을" })),
        { sentence: "집에", label: "집" },
        { sentence: "집을", label: "집" },
        { sentence: "집이", label: "집" },
        { sentence: "집에서", label: "집" },
        { sentence: "집에서는", label: "집" },
        { sentence: "집으로도", label: "집" },
        { sentence: "집까지만", label: "집" },
        { sentence: "집하고", label: "집" },
        { sentence: "집한테", label: "집" },
        { sentence: "집께서", label: "집" },
        { sentence: "집마다", label: "집" },
        { sentence: "집조차", label: "집" },
        { sentence: "집밖에", label: "집" },
        { sentence: "집부터", label: "집" },
        { sentence: "집처럼", label: "집" },
        { sentence: "집보다", label: "집" },
        { sentence: "집에게", label: "집" },
        { sentence: "집이에요", label: "집" },
        { sentence: "광장에서", label: "광장" },
        { sentence: "마을.", label: "마을" },
        { sentence: "마을’", label: "마을" },
        { sentence: "마을", label: "마을" },
      ];

      for (const { sentence, label } of cases) {
        expect(findEditorReferences(sentence, boundaryIndex).map((span) => span.label)).toContain(label);
      }
    });

    it("조사 첫 음절로 시작하는 합성어는 거부한다", () => {
      for (const sentence of [
        "마을이장", "마을의사", "마을도서관", "마을과수원", "마을이야기",
        "마을도로", "마을지도", "마을하나", "마을마차",
      ]) {
        expect(findEditorReferences(sentence, index)).toEqual([]);
      }
    });

    it("더 긴 단어의 일부인 이름은 거부한다", () => {
      for (const sentence of [
        "마을길을 깔았습니다", "마을회관을 지었습니다", "새마을 계획",
        "마을길", "마을회관", "새마을", "마을도로를 깔았습니다",
      ]) {
        expect(findEditorReferences(sentence, index)).toEqual([]);
      }
    });

    it("returns spans sorted by position", () => {
      const spans = findEditorReferences("마을 남쪽에 상인 하나의 집이 있습니다. 마을 북쪽은 비었습니다.", index);

      expect(spans.map((span) => span.start)).toEqual([...spans.map((span) => span.start)].sort((a, b) => a - b));
      expect(spans.length).toBeGreaterThanOrEqual(3);
    });

    it("returns nothing for an empty index or empty text", () => {
      expect(findEditorReferences("마을", { entries: [] })).toEqual([]);
      expect(findEditorReferences("", index)).toEqual([]);
    });
  });
  describe("resolveEditorReferenceQuery", () => {
    const project = projectWith([
      mapWith("map_village", "마을 광장", [
        eventNamed("ev_hana", "상인 하나", 4, 7),
        eventNamed("ev_dul", "상인 둘", 8, 9),
      ]),
      mapWith("map_house_interior_1", "상인 하나의 집"),
    ]);
    const index = buildEditorReferenceIndex(project);

    it("정확한 이름은 더 긴 부분 일치보다 우선한다", () => {
      expect(resolveEditorReferenceQuery(index, "상인 하나")).toEqual({
        kind: "found",
        entry: {
          label: "상인 하나",
          target: {
            kind: "event",
            mapId: "map_village",
            eventId: "ev_hana",
            x: 4,
            y: 7,
          },
        },
      });
    });

    it("부분 이름이 한 종류뿐이면 그 이름을 찾는다", () => {
      expect(resolveEditorReferenceQuery(index, "하나의")).toEqual({
        kind: "found",
        entry: expect.objectContaining({ label: "상인 하나의 집" }),
      });
    });

    it("서로 다른 부분 이름이 여럿이면 후보를 모두 보고한다", () => {
      expect(resolveEditorReferenceQuery(index, "상인")).toEqual({
        kind: "ambiguous",
        labels: ["상인 둘", "상인 하나", "상인 하나의 집"],
      });
    });

    it("모르는 이름이나 빈 이름은 찾지 못했다고 보고한다", () => {
      expect(resolveEditorReferenceQuery(index, "없는 이름")).toEqual({ kind: "missing" });
      expect(resolveEditorReferenceQuery(index, "   ")).toEqual({ kind: "missing" });
    });
  });
});
