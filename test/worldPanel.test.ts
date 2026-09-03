import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent, Project } from "@/project/types";
import type { WorldEntity } from "@/project/world";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = worldProject();
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  store.replace(createBlankProject());
});

describe("worldPanel", () => {
  it("renders the world panel tabs and overview cards including item and concept", () => {
    const panel = renderPanel();

    expect(requireTestId(panel, "world-panel")).toBeTruthy();
    expect(requireTestId(panel, "world-tab-overview").textContent).toBe("개요");
    expect(panel.textContent).toContain("인물 1");
    expect(panel.textContent).toContain("아이템 1");
    expect(panel.textContent).toContain("개념 1");
    expect(findByTestId(panel, "world-card-w_item")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_concept")).toBeTruthy();
  });

  it("drops the dialog title when embedded in the database", () => {
    const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
    expect(panel.classList.contains("world-panel-embedded")).toBe(true);
    expect(panel.querySelector("h2")).toBeNull();
  });

  it("filters the character tab to character cards", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-tab-character").click();

    expect(findByTestId(panel, "world-card-w_char")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_place")).toBeNull();
    expect(findByTestId(panel, "world-card-w_faction")).toBeNull();
  });

  it("filters the place and faction tab together", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-tab-place-faction").click();

    expect(findByTestId(panel, "world-card-w_place")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_faction")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_char")).toBeNull();
  });

  it("previews and explicitly applies lore factions from the place and faction tab", () => {
    const project = worldProject();
    project.world = {
      entities: [
        ...project.world!.entities,
        entity({ id: "w_rivals", type: "faction", name: "별등 경쟁 상단" }),
      ],
      relations: [
        ...project.world!.relations,
        { a: "w_faction", b: "w_rivals", kind: "enemyOf" },
      ],
    };
    store.replace(project);
    const panel = renderPanel();

    requireTestId(panel, "world-tab-place-faction").click();
    expect(requireTestId(panel, "world-faction-materialization")).toBeTruthy();
    requireTestId(panel, "world-faction-materialization-preview").click();

    expect(store.getCurrent().factions).toBeUndefined();
    expect(requireTestId(panel, "world-faction-materialization-summary").textContent).toContain("진영 추가 2");
    expect(requireTestId(panel, "world-faction-materialization-summary").textContent).toContain("관계 추가 1");

    requireTestId(panel, "world-faction-materialization-apply").click();

    expect(store.getCurrent().factions?.defs.map((def) => def.id)).toEqual(["w_faction", "w_rivals"]);
    expect(store.getCurrent().factions?.relations).toEqual([{ a: "w_faction", b: "w_rivals", stance: -1 }]);
  });

  it("replans instead of overwriting faction edits made after preview", () => {
    const project = worldProject();
    project.world = {
      entities: [
        ...project.world!.entities,
        entity({ id: "w_rivals", type: "faction", name: "별등 경쟁 상단" }),
      ],
      relations: [{ a: "w_faction", b: "w_rivals", kind: "enemyOf" }],
    };
    store.replace(project);
    const panel = renderPanel();
    requireTestId(panel, "world-tab-place-faction").click();
    requireTestId(panel, "world-faction-materialization-preview").click();

    store.update((draft) => {
      draft.factions = { defs: [{ id: "hand_authored", name: "수기 진영" }], relations: [] };
    });
    requireTestId(panel, "world-faction-materialization-apply").click();

    expect(store.getCurrent().factions?.defs).toEqual([{ id: "hand_authored", name: "수기 진영" }]);
    expect(requireTestId(panel, "world-faction-materialization-summary").textContent).toContain("진영 추가 2");

    requireTestId(panel, "world-faction-materialization-apply").click();
    expect(store.getCurrent().factions?.defs).toEqual([
      { id: "hand_authored", name: "수기 진영" },
      { id: "w_faction", name: "별등 상단", aggression: 1, worldEntityId: "w_faction" },
      { id: "w_rivals", name: "별등 경쟁 상단", aggression: 1, worldEntityId: "w_rivals" },
    ]);
  });

  it("filters the event tab to event cards", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-tab-event").click();

    expect(findByTestId(panel, "world-card-w_event")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_char")).toBeNull();
  });

  it("filters the guideline tab to production notes", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-tab-guideline").click();

    expect(findByTestId(panel, "world-card-w_guide")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_event")).toBeNull();
  });

  it("searches name, summary, body, and tags within the current tab", () => {
    const panel = renderPanel();
    const search = requireTestId(panel, "world-search");

    search.value = "비밀태그";
    search.dispatchEvent(new Event("input"));

    expect(findByTestId(panel, "world-card-w_concept")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_char")).toBeNull();

    search.value = "수호자 본문";
    search.dispatchEvent(new Event("input"));

    expect(findByTestId(panel, "world-card-w_char")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_concept")).toBeNull();
  });

  it("toggles locked state from the card and writes to project world", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-lock-toggle").click();

    const entity = currentEntity("w_char");
    expect(entity?.locked).toBe(true);
    expect(panel.textContent).toContain("잠김");
  });

  it("opens wiki view with rendered markdown when a card is clicked", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-card-w_char").click();

    const wiki = requireTestId(panel, "world-wiki-view");
    expect(wiki.dataset.entityId).toBe("w_char");
    expect(wiki.querySelector(".md")).toBeTruthy();
    expect(wiki.textContent).toContain("배경");
    expect(wiki.textContent).toContain("세계를 지킨다");
  });

  it("moves between wiki entries through relation chips", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-card-w_char").click();
    const chip = requireTestId(panel, "world-relation-chip");
    chip.click();

    const wiki = requireTestId(panel, "world-wiki-view");
    expect(wiki.dataset.entityId).toBe("w_faction");
    expect(wiki.textContent).toContain("별등 상단");
  });

  it("jumps from a map ref to the editor map selection", () => {
    const panel = renderPanel();
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: null });

    requireTestId(panel, "world-card-w_place").click();
    requireTestId(panel, `world-ref-jump-map-${mapId}`).click();

    expect(editorState.get().currentMapId).toBe(mapId);
  });

  it("renders character cards with the existing charset preview path", () => {
    const panel = renderPanel();
    const card = requireTestId(panel, "world-card-w_char");
    const sprite = card.querySelector(".world-card-sprite");

    expect(sprite?.dataset.spriteId).toBe("tex_easyrpg_charset_actor1");
  });

  it("maps missing ref lint errors to the card badge", () => {
    const project = worldProject([
      entity({ id: "w_broken", name: "사라진 인물", refs: [{ kind: "actor", id: "actor_missing" }] }),
    ]);
    project.database.actors = [];
    store.replace(project);

    const panel = renderPanel();
    const badge = requireTestId(panel, "world-lint-badge-w_broken");

    expect(badge.dataset.severity).toBe("error");
    expect(badge.textContent).toContain("오류");
  });

  it("shows selected world lint issues in the wiki view", () => {
    const project = worldProject([
      entity({ id: "w_broken", name: "사라진 인물", refs: [{ kind: "actor", id: "actor_missing" }] }),
    ]);
    project.database.actors = [];
    store.replace(project);
    const panel = renderPanel();

    requireTestId(panel, "world-card-w_broken").click();

    const list = requireTestId(panel, "world-lint-list");
    expect(list.textContent).toContain("세계관 w_broken");
    expect(list.textContent).toContain("actor:actor_missing");
  });

  it("maps unlinked lore warnings to the card badge", () => {
    store.replace(worldProject([entity({ id: "w_unlinked", type: "place", name: "안개숲", refs: [] })]));

    const panel = renderPanel();

    expect(requireTestId(panel, "world-lint-badge-w_unlinked").dataset.severity).toBe("warning");
  });

  it("saves direct edits through normalized project world", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-card-w_char").click();
    requireTestId(panel, "world-edit-toggle").click();
    requireTestId(panel, "world-edit-name").value = "아린 수정";
    requireTestId(panel, "world-edit-summary").value = "새 요약";
    requireTestId(panel, "world-edit-tags").value = "hero, edited";
    requireTestId(panel, "world-edit-body").value = "# 새 본문";
    requireTestId(panel, "world-edit-type").value = "concept";
    requireTestId(panel, "world-edit-save").click();

    const saved = currentEntity("w_char");
    expect(saved?.id).toBe("w_char");
    expect(saved?.name).toBe("아린 수정");
    expect(saved?.type).toBe("concept");
    expect(saved?.tags).toEqual(["hero", "edited"]);
    expect(saved?.body).toBe("# 새 본문");
  });

  it("adds refs from the edit mode picker", () => {
    const panel = renderPanel();
    const mapId = store.getCurrent().startMapId;

    requireTestId(panel, "world-card-w_char").click();
    requireTestId(panel, "world-edit-toggle").click();
    requireTestId(panel, "world-ref-kind").value = "map";
    requireTestId(panel, "world-ref-id").value = mapId;
    requireTestId(panel, "world-ref-add").click();
    requireTestId(panel, "world-edit-save").click();

    expect(currentEntity("w_char")?.refs).toContainEqual({ kind: "map", id: mapId });
  });

  it("adds relations from the edit mode relation controls", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-card-w_char").click();
    requireTestId(panel, "world-edit-toggle").click();
    requireTestId(panel, "world-relation-target").value = "w_place";
    requireTestId(panel, "world-relation-kind").value = "locatedIn";
    requireTestId(panel, "world-relation-add").click();
    requireTestId(panel, "world-edit-save").click();

    expect(store.getCurrent().world?.relations).toContainEqual({ a: "w_char", b: "w_place", kind: "locatedIn" });
  });

  it("removes relations from the edit mode relation list", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-card-w_char").click();
    requireTestId(panel, "world-edit-toggle").click();
    requireTestId(panel, "world-relation-remove-0").click();
    requireTestId(panel, "world-edit-save").click();

    expect(store.getCurrent().world?.relations.some((relation) => relation.kind === "memberOf")).toBe(false);
  });

  it("creates a new world entry with a w_ id", () => {
    const panel = renderPanel();

    requireTestId(panel, "world-add-entity").click();
    requireTestId(panel, "world-edit-name").value = "새 규범";
    requireTestId(panel, "world-edit-summary").value = "새 제작 규범";
    requireTestId(panel, "world-edit-type").value = "guideline";
    requireTestId(panel, "world-edit-save").click();

    const created = store.getCurrent().world?.entities.find((entry) => entry.name === "새 규범");
    expect(created?.id.startsWith("w_")).toBe(true);
    expect(created?.type).toBe("guideline");
  });
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderWorldPanel());
}

function requireTestId(root: FakeElement, testId: string): FakeElement {
  const element = findByTestId(root, testId);
  if (!element) throw new Error(`missing test id ${testId}`);
  return element;
}

function currentEntity(id: string): WorldEntity | undefined {
  return store.getCurrent().world?.entities.find((entry) => entry.id === id);
}

function worldProject(entities?: readonly WorldEntity[]): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.name = "별등 마을";
  map.events.push(testEvent());
  project.database.actors[0] = {
    ...project.database.actors[0],
    id: "actor_arin",
    name: "아린",
    characterResourceId: "easyrpg-charset-actor1",
  };
  project.database.items = [{ id: "item_orb", name: "별빛 구슬" } as never];
  project.database.skills = [{ id: "skill_light", name: "빛" } as never];
  const worldEntities = entities ?? defaultWorldEntities(project.startMapId);
  project.world = {
    entities: worldEntities,
    relations: worldEntities.some((entry) => entry.id === "w_char") && worldEntities.some((entry) => entry.id === "w_faction")
      ? [{ a: "w_char", b: "w_faction", kind: "memberOf" }]
      : [],
  };
  return project;
}

function defaultWorldEntities(mapId: string): readonly WorldEntity[] {
  return [
    entity({
      id: "w_char",
      type: "character",
      name: "아린",
      summary: "마을의 수호자",
      body: "## 배경\n수호자 본문. 세계를 지킨다.",
      tags: ["hero"],
      refs: [{ kind: "actor", id: "actor_arin" }],
    }),
    entity({
      id: "w_place",
      type: "place",
      name: "별등 마을",
      summary: "별빛 축제가 열리는 마을",
      refs: [{ kind: "map", id: mapId }],
    }),
    entity({ id: "w_faction", type: "faction", name: "별등 상단", summary: "마을을 돕는 상단", refs: [{ kind: "map", id: mapId }] }),
    entity({ id: "w_event", type: "event", name: "별빛 축제", summary: "마을의 큰 사건", refs: [{ kind: "event", id: "ev_festival" }] }),
    entity({ id: "w_guide", type: "guideline", name: "문체", summary: "차분하게 쓴다", body: "대사는 짧게." }),
    entity({ id: "w_item", type: "item", name: "별빛 구슬", summary: "작은 빛을 품은 물건", refs: [{ kind: "item", id: "item_orb" }] }),
    entity({ id: "w_concept", type: "concept", name: "별빛", summary: "세계를 잇는 힘", body: "비밀태그와 이어진다.", tags: ["비밀태그"] }),
  ];
}

function entity(patch: Partial<WorldEntity> = {}): WorldEntity {
  return {
    id: "w_entity",
    type: "character",
    name: "세계관 항목",
    summary: "요약",
    origin: "user",
    ...patch,
  };
}

function testEvent(): GameEvent {
  return {
    id: "ev_festival",
    x: 3,
    y: 4,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_festival",
        name: "축제 안내",
        conditions: [],
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  };
}
