import { describe, expect, it } from "vitest";
import {
  buildEditorReferenceIndex,
  findEditorReferences,
  resolveEditorReferenceQuery,
} from "@/editor/aiAnswerLinks";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { EditorReferenceIndex } from "@/editor/aiAnswerLinks";
import type { GameEvent, GameMap, Project } from "@/project/types";

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
    mapWith("map_village", "마을 광장", [eventNamed("ev_hana", "상인 하나", 4, 7)]),
    mapWith("map_house_interior_1", "상인 하나의 집"),
  ]);
  const index = buildEditorReferenceIndex(project);

  it("prefers an exact name over a longer containing name", () => {
    expect(resolveEditorReferenceQuery(index, "상인 하나")?.target).toEqual({
      kind: "event",
      mapId: "map_village",
      eventId: "ev_hana",
      x: 4,
      y: 7,
    });
  });

  it("falls back to the shortest partial match", () => {
    expect(resolveEditorReferenceQuery(index, "하나의")?.label).toBe("상인 하나의 집");
  });

  it("returns null for an unknown or blank name", () => {
    expect(resolveEditorReferenceQuery(index, "없는 이름")).toBeNull();
    expect(resolveEditorReferenceQuery(index, "   ")).toBeNull();
  });
});
