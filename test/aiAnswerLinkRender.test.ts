import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEditorReferenceIndex, type EditorReferenceIndex, type EditorReferenceTarget } from "@/editor/aiAnswerLinks";
import { decorateEditorReferences, renderAssistantAnswer } from "@/editor/panels/aiAnswerLinkRender";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { renderMarkdown } from "@/util/markdown";
import { FakeElement, installFakeDom } from "./fakeDom";

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
