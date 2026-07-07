import { EASYRPG_CHARSET_ASSETS } from "@/assets/easyrpgRtp";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { renderEventGraphicIcon } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { drawTransferFallback, drawTransferMapPreview } from "@/editor/panels/eventEditor/transferMapPreview";
import { lintWorld, normalizeProjectWorld, normalizeWorld } from "@/project/world";
import {
  WORLD_ENTITY_TYPES,
  WORLD_REF_KINDS,
  WORLD_RELATION_KINDS,
  type ProjectWorld,
  type WorldEntity,
  type WorldEntityType,
  type WorldOrigin,
  type WorldRef,
  type WorldRefKind,
  type WorldRelation,
  type WorldRelationKind,
} from "@/project/world/types";
import type { LintIssue, LintSeverity } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import type { GameEvent, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { genId } from "@/util/id";
import { renderMarkdown } from "@/util/markdown";
import { toast } from "@/util/toast";

type WorldTabKey = "overview" | "character" | "place-faction" | "event" | "guideline";

type WorldPanelOptions = {
  readonly initialEntityId?: string;
  readonly onClose?: () => void;
};

type WorldPanelState = {
  tab: WorldTabKey;
  search: string;
  selectedId: string | null;
  addType: WorldEntityType;
  editDraft: WorldEditDraft | null;
  editError: string;
};

type WorldEditDraft = {
  id: string;
  type: WorldEntityType;
  name: string;
  summary: string;
  tagsText: string;
  body: string;
  refs: WorldRef[];
  origin: WorldOrigin;
  locked: boolean;
  relations: WorldRelation[];
  isNew: boolean;
};

type WorldLintSummary = {
  readonly all: readonly LintIssue[];
  readonly byEntityId: ReadonlyMap<string, readonly LintIssue[]>;
  readonly global: readonly LintIssue[];
};

const TABS: readonly { readonly key: WorldTabKey; readonly label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "character", label: "인물" },
  { key: "place-faction", label: "장소·세력" },
  { key: "event", label: "사건" },
  { key: "guideline", label: "제작 노트" },
];

const ENTITY_TYPE_LABELS: Record<WorldEntityType, string> = {
  character: "인물",
  place: "장소",
  faction: "세력",
  event: "사건",
  item: "아이템",
  concept: "개념",
  guideline: "제작 노트",
};

const ORIGIN_LABELS: Record<WorldOrigin, string> = {
  user: "사용자",
  ai: "AI",
  interview: "인터뷰",
};

const REF_KIND_LABELS: Record<WorldRefKind, string> = {
  map: "맵",
  event: "이벤트",
  item: "아이템",
  skill: "스킬",
  actor: "주인공",
};

const RELATION_KIND_LABELS: Record<WorldRelationKind, string> = {
  memberOf: "소속",
  locatedIn: "위치",
  knows: "아는 사이",
  enemyOf: "적대",
  allyOf: "동맹",
  causedBy: "원인",
  owns: "소유",
  custom: "관계",
};

const SEVERITY_LABELS: Record<LintSeverity, string> = {
  error: "오류",
  warning: "주의",
  info: "정보",
};

const SEVERITY_RANK: Record<LintSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

export function openWorldPanel(): HTMLElement {
  document.querySelector("[data-testid='world-panel-modal']")?.remove();

  let closed = false;
  const backdrop = el("div", {
    class: "database-modal-backdrop world-panel-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "world-panel-modal" },
  });
  const close = (): void => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  const panel = renderWorldPanel({ onClose: close });
  backdrop.append(panel);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  panel.querySelector<HTMLElement>("[data-testid='world-search']")?.focus();
  return panel;
}

export function renderWorldPanel(options: WorldPanelOptions = {}): HTMLElement {
  const state: WorldPanelState = {
    tab: "overview",
    search: "",
    selectedId: options.initialEntityId ?? null,
    addType: "character",
    editDraft: null,
    editError: "",
  };
  const root = el("section", {
    class: "world-panel",
    attrs: { role: "dialog", "aria-label": "세계관" },
    dataset: { testid: "world-panel" },
  });

  const refresh = (): void => {
    const project = store.getCurrent();
    const world = currentWorld(project);
    const lint = summarizeWorldLint(world, project);
    ensureSelectedEntity(state, world);
    clearChildren(root);
    root.append(renderHeader(state, refresh, options), renderMain(state, world, project, lint, refresh));
  };

  refresh();
  return root;
}

export function jumpToWorldRef(ref: WorldRef, project: Project = store.getCurrent()): boolean {
  switch (ref.kind) {
    case "map":
      if (selectEditorMap(ref.id)) return true;
      toast("연결된 맵을 찾을 수 없습니다.", "error");
      return false;
    case "actor":
      if (!project.database.actors.some((record) => record.id === ref.id)) {
        toast("연결된 주인공을 찾을 수 없습니다.", "error");
        return false;
      }
      setSelectedRecordId("actors", ref.id);
      openDatabaseModal("actors");
      return true;
    case "item":
      if (!project.database.items.some((record) => record.id === ref.id)) {
        toast("연결된 아이템을 찾을 수 없습니다.", "error");
        return false;
      }
      setSelectedRecordId("items", ref.id);
      openDatabaseModal("items");
      return true;
    case "skill":
      if (!project.database.skills.some((record) => record.id === ref.id)) {
        toast("연결된 스킬을 찾을 수 없습니다.", "error");
        return false;
      }
      setSelectedRecordId("skills", ref.id);
      openDatabaseModal("skills");
      return true;
    case "event": {
      const match = findEvent(project, ref.id);
      if (!match) {
        toast("연결된 이벤트를 찾을 수 없습니다.", "error");
        return false;
      }
      selectEditorMap(match.mapId, { clearEventSelection: false });
      openEventEditorModal(match.mapId, ref.id);
      return true;
    }
  }
}

function renderHeader(state: WorldPanelState, refresh: () => void, options: WorldPanelOptions): HTMLElement {
  const search = el("input", {
    class: "world-search-input",
    attrs: { type: "search", placeholder: "세계관 검색", "aria-label": "세계관 검색" },
    value: state.search,
    dataset: { testid: "world-search" },
  }) as HTMLInputElement;
  search.addEventListener("input", () => {
    state.search = search.value;
    refresh();
  });

  const addType = el("select", {
    class: "world-add-type",
    attrs: { "aria-label": "추가할 세계관 타입" },
  }) as HTMLSelectElement;
  for (const type of WORLD_ENTITY_TYPES) addType.append(option(type, ENTITY_TYPE_LABELS[type], type === state.addType));
  addType.value = state.addType;
  addType.addEventListener("change", () => {
    if (isWorldEntityType(addType.value)) state.addType = addType.value;
  });

  const controls: HTMLElement[] = [
    search,
    addType,
    el("button", {
      class: "btn small primary world-add-button",
      text: "+ 추가",
      attrs: { type: "button" },
      dataset: { testid: "world-add-entity" },
      on: {
        click: () => {
          startNewDraft(state, currentWorld(store.getCurrent()), state.addType);
          refresh();
        },
      },
    }),
  ];
  if (options.onClose) {
    controls.push(
      el("button", {
        class: "database-modal-close world-panel-close",
        text: "x",
        attrs: { type: "button", title: "닫기", "aria-label": "세계관 닫기" },
        on: { click: options.onClose },
      }),
    );
  }

  return el("header", {
    class: "world-panel-header",
    children: [
      el("div", {
        class: "world-panel-title",
        children: [el("h2", { text: "세계관" })],
      }),
      el("div", { class: "world-panel-controls", children: controls }),
    ],
  });
}

function renderMain(
  state: WorldPanelState,
  world: ProjectWorld,
  project: Project,
  lint: WorldLintSummary,
  refresh: () => void
): HTMLElement {
  const browser = el("section", {
    class: "world-browser",
    children: [
      renderTabs(state, refresh),
      ...(state.tab === "overview" ? [renderOverview(world, state, refresh)] : []),
      renderCardGrid(state, world, project, lint, refresh),
    ],
  });
  return el("div", {
    class: "world-panel-main",
    children: [browser, renderWikiPane(state, world, project, lint, refresh)],
  });
}

function renderTabs(state: WorldPanelState, refresh: () => void): HTMLElement {
  return el("nav", {
    class: "world-tabs",
    attrs: { "aria-label": "세계관 탭" },
    children: TABS.map((tab) =>
      el("button", {
        class: `world-tab${state.tab === tab.key ? " active" : ""}`,
        text: tab.label,
        attrs: { type: "button", "aria-pressed": String(state.tab === tab.key) },
        dataset: { testid: `world-tab-${tab.key}` },
        on: {
          click: () => {
            state.tab = tab.key;
            refresh();
          },
        },
      })
    ),
  });
}

function renderOverview(world: ProjectWorld, state: WorldPanelState, refresh: () => void): HTMLElement {
  const countItems = WORLD_ENTITY_TYPES.map((type) => `${ENTITY_TYPE_LABELS[type]} ${world.entities.filter((entity) => entity.type === type).length}`);
  const recent = world.entities.slice(-5).reverse();
  return el("section", {
    class: "world-overview",
    children: [
      el("div", { class: "world-counts", text: countItems.join(" · ") }),
      el("div", {
        class: "world-recent",
        children: [
          el("strong", { text: "최근 항목" }),
          ...(recent.length > 0
            ? recent.map((entity) =>
              el("button", {
                class: "world-recent-chip",
                text: entity.name || "(이름 없음)",
                attrs: { type: "button" },
                on: {
                  click: () => {
                    state.selectedId = entity.id;
                    state.editDraft = null;
                    refresh();
                  },
                },
              })
            )
            : [el("span", { class: "world-muted", text: "아직 항목이 없습니다." })]),
        ],
      }),
    ],
  });
}

function renderCardGrid(
  state: WorldPanelState,
  world: ProjectWorld,
  project: Project,
  lint: WorldLintSummary,
  refresh: () => void
): HTMLElement {
  const entities = visibleEntities(world.entities, state.tab, state.search);
  if (entities.length === 0) {
    return el("div", { class: "world-card-grid empty", text: "표시할 세계관 항목이 없습니다." });
  }
  return el("div", {
    class: "world-card-grid",
    children: entities.map((entity) => renderWorldCard(entity, project, lint.byEntityId.get(entity.id) ?? [], state, refresh)),
  });
}

function renderWorldCard(
  entity: WorldEntity,
  project: Project,
  issues: readonly LintIssue[],
  state: WorldPanelState,
  refresh: () => void
): HTMLElement {
  const lock = el("button", {
    class: `world-lock-button${entity.locked ? " locked" : ""}`,
    text: entity.locked ? "잠김" : "열림",
    attrs: { type: "button", title: entity.locked ? "잠금 해제" : "잠금" },
    dataset: { testid: "world-lock-toggle", entityId: entity.id },
    on: {
      click: (event) => {
        event.stopPropagation();
        toggleEntityLock(entity.id);
        refresh();
      },
    },
  });
  const badge = highestSeverity(issues);
  const issueBadge = badge
    ? el("span", {
      class: `world-lint-badge ${badge}`,
      text: `${SEVERITY_LABELS[badge]} ${issues.length}`,
      dataset: { testid: `world-lint-badge-${entity.id}`, severity: badge },
    })
    : null;

  return el("button", {
    class: `world-card${state.selectedId === entity.id ? " active" : ""}`,
    attrs: { type: "button", title: entity.name || "(이름 없음)" },
    dataset: { testid: `world-card-${entity.id}`, entityId: entity.id, entityType: entity.type },
    on: {
      click: () => {
        state.selectedId = entity.id;
        state.editDraft = null;
        state.editError = "";
        refresh();
      },
    },
    children: [
      el("div", {
        class: "world-card-media",
        children: [renderEntityMedia(entity, project), ...(issueBadge ? [issueBadge] : [])],
      }),
      el("div", {
        class: "world-card-content",
        children: [
          el("div", {
            class: "world-card-title-row",
            children: [
              el("strong", { class: "world-card-title", text: entity.name || "(이름 없음)" }),
              lock,
            ],
          }),
          el("p", { class: "world-card-summary", text: entity.summary || "요약 없음" }),
          el("div", {
            class: "world-card-badges",
            children: [
              el("span", { class: "world-type-badge", text: ENTITY_TYPE_LABELS[entity.type] }),
              el("span", { class: "world-origin-badge", text: ORIGIN_LABELS[entity.origin] }),
            ],
          }),
        ],
      }),
    ],
  });
}

function renderWikiPane(
  state: WorldPanelState,
  world: ProjectWorld,
  project: Project,
  lint: WorldLintSummary,
  refresh: () => void
): HTMLElement {
  if (state.editDraft) return renderEditPane(state, world, project, refresh);
  const entity = state.selectedId ? world.entities.find((entry) => entry.id === state.selectedId) : undefined;
  if (!entity) {
    return el("article", {
      class: "world-wiki-view empty",
      dataset: { testid: "world-wiki-view" },
      children: [
        renderGlobalLint(lint),
        el("p", { text: "카드를 선택하면 세계관 내용을 볼 수 있습니다." }),
      ],
    });
  }
  const issues = lint.byEntityId.get(entity.id) ?? [];
  const relations = relationsForEntity(world, entity.id);
  return el("article", {
    class: "world-wiki-view",
    dataset: { testid: "world-wiki-view", entityId: entity.id },
    children: [
      el("header", {
        class: "world-wiki-header",
        children: [
          el("div", {
            class: "world-wiki-heading",
            children: [
              el("span", { class: "world-type-badge", text: ENTITY_TYPE_LABELS[entity.type] }),
              el("h3", { text: entity.name || "(이름 없음)" }),
              el("p", { text: entity.summary || "요약 없음" }),
            ],
          }),
          el("div", {
            class: "world-wiki-actions",
            children: [
              el("button", {
                class: `world-lock-button${entity.locked ? " locked" : ""}`,
                text: entity.locked ? "잠김" : "열림",
                attrs: { type: "button", title: entity.locked ? "잠금 해제" : "잠금" },
                dataset: { testid: "world-lock-toggle", entityId: entity.id },
                on: {
                  click: () => {
                    toggleEntityLock(entity.id);
                    refresh();
                  },
                },
              }),
              el("button", {
                class: "btn small",
                text: "편집",
                attrs: { type: "button" },
                dataset: { testid: "world-edit-toggle" },
                on: {
                  click: () => {
                    state.editDraft = draftFromEntity(entity, world.relations);
                    state.editError = "";
                    refresh();
                  },
                },
              }),
            ],
          }),
        ],
      }),
      renderIssueList(issues, lint.global),
      renderTagList(entity.tags ?? []),
      renderMarkdownBody(entity.body ?? ""),
      renderRelationChips(relations, world, entity.id, state, refresh),
      renderRefJumps(entity.refs ?? [], project),
    ],
  });
}

function renderEditPane(state: WorldPanelState, world: ProjectWorld, project: Project, refresh: () => void): HTMLElement {
  const draft = state.editDraft;
  if (!draft) throw new Error("missing world draft");

  const nameInput = el("input", {
    class: "world-edit-input",
    attrs: { type: "text", "aria-label": "이름" },
    value: draft.name,
    dataset: { testid: "world-edit-name" },
  }) as HTMLInputElement;
  const summaryInput = el("input", {
    class: "world-edit-input",
    attrs: { type: "text", "aria-label": "요약" },
    value: draft.summary,
    dataset: { testid: "world-edit-summary" },
  }) as HTMLInputElement;
  const tagsInput = el("input", {
    class: "world-edit-input",
    attrs: { type: "text", "aria-label": "태그" },
    value: draft.tagsText,
    dataset: { testid: "world-edit-tags" },
  }) as HTMLInputElement;
  const bodyInput = el("textarea", {
    class: "world-edit-body",
    attrs: { "aria-label": "본문", spellcheck: "false" },
    value: draft.body,
    dataset: { testid: "world-edit-body" },
  }) as HTMLTextAreaElement;
  const typeSelect = el("select", {
    class: "world-edit-input",
    attrs: { "aria-label": "타입" },
    dataset: { testid: "world-edit-type" },
  }) as HTMLSelectElement;
  for (const type of WORLD_ENTITY_TYPES) typeSelect.append(option(type, ENTITY_TYPE_LABELS[type], type === draft.type));
  typeSelect.value = draft.type;
  const lockedInput = el("input", {
    attrs: { type: "checkbox", "aria-label": "잠금" },
  }) as HTMLInputElement;
  lockedInput.checked = draft.locked;

  const syncDraft = (): void => {
    draft.name = nameInput.value;
    draft.summary = summaryInput.value;
    draft.tagsText = tagsInput.value;
    draft.body = bodyInput.value;
    if (isWorldEntityType(typeSelect.value)) draft.type = typeSelect.value;
    draft.locked = lockedInput.checked;
  };

  return el("article", {
    class: "world-wiki-view world-edit-view",
    dataset: { testid: "world-wiki-view", entityId: draft.id, mode: "edit" },
    children: [
      el("header", {
        class: "world-wiki-header",
        children: [
          el("div", {
            class: "world-wiki-heading",
            children: [
              el("span", { class: "world-type-badge", text: draft.isNew ? "새 항목" : "편집 중" }),
              el("h3", { text: draft.name.trim() || "새 세계관" }),
            ],
          }),
          el("div", {
            class: "world-wiki-actions",
            children: [
              el("button", {
                class: "btn small primary",
                text: "저장",
                attrs: { type: "button" },
                dataset: { testid: "world-edit-save" },
                on: {
                  click: () => {
                    syncDraft();
                    saveDraft(state, world);
                    refresh();
                  },
                },
              }),
              el("button", {
                class: "btn small",
                text: "취소",
                attrs: { type: "button" },
                dataset: { testid: "world-edit-cancel" },
                on: {
                  click: () => {
                    state.editDraft = null;
                    state.editError = "";
                    refresh();
                  },
                },
              }),
            ],
          }),
        ],
      }),
      ...(state.editError ? [el("div", { class: "world-edit-error", dataset: { testid: "world-edit-error" }, text: state.editError })] : []),
      el("div", {
        class: "world-edit-fields",
        children: [
          field("타입", typeSelect),
          field("이름", nameInput),
          field("요약", summaryInput),
          field("태그", tagsInput),
          labelWithControl("잠금", lockedInput),
          field("본문", bodyInput),
        ],
      }),
      renderRefEditor(draft, project, syncDraft, refresh),
      renderRelationEditor(draft, world, syncDraft, refresh),
    ],
  });
}

function renderIssueList(entityIssues: readonly LintIssue[], globalIssues: readonly LintIssue[]): HTMLElement {
  const issues = [...entityIssues, ...globalIssues];
  if (issues.length === 0) return el("section", { class: "world-lint-list empty", dataset: { testid: "world-lint-list" }, text: "세계관 검사 이슈 없음" });
  return el("section", {
    class: "world-lint-list",
    dataset: { testid: "world-lint-list" },
    children: [
      el("strong", { text: "세계관 검사" }),
      el("ul", {
        children: issues.map((issue) =>
          el("li", {
            class: `world-lint-item ${issue.severity}`,
            text: `${SEVERITY_LABELS[issue.severity]} · ${issue.message}`,
            dataset: { severity: issue.severity },
          })
        ),
      }),
    ],
  });
}

function renderGlobalLint(lint: WorldLintSummary): HTMLElement {
  return renderIssueList([], lint.global.length > 0 ? lint.global : lint.all.filter((issue) => issue.code === "world-npc-unregistered" || issue.code === "world-item-unregistered"));
}

function renderTagList(tags: readonly string[]): HTMLElement {
  if (tags.length === 0) return el("div", { class: "world-tags empty", text: "태그 없음" });
  return el("div", {
    class: "world-tags",
    children: tags.map((tag) => el("span", { class: "world-tag", text: tag })),
  });
}

function renderMarkdownBody(body: string): HTMLElement {
  const section = el("section", { class: "world-markdown" });
  if (!body.trim()) {
    section.append(el("p", { class: "world-muted", text: "본문이 없습니다." }));
    return section;
  }
  section.append(renderMarkdown(body));
  return section;
}

function renderRelationChips(
  relations: readonly WorldRelation[],
  world: ProjectWorld,
  entityId: string,
  state: WorldPanelState,
  refresh: () => void
): HTMLElement {
  if (relations.length === 0) return el("section", { class: "world-relations empty", text: "관계 없음" });
  return el("section", {
    class: "world-relations",
    children: [
      el("strong", { text: "관계" }),
      el("div", {
        class: "world-chip-row",
        children: relations.map((relation) => {
          const otherId = relation.a === entityId ? relation.b : relation.a;
          const other = world.entities.find((entry) => entry.id === otherId);
          const label = `${RELATION_KIND_LABELS[relation.kind]} · ${other?.name ?? otherId}`;
          return el("button", {
            class: "world-relation-chip",
            text: relation.note ? `${label} (${relation.note})` : label,
            attrs: { type: "button" },
            dataset: { testid: "world-relation-chip", targetId: otherId },
            on: {
              click: () => {
                state.selectedId = otherId;
                state.editDraft = null;
                state.editError = "";
                refresh();
              },
            },
          });
        }),
      }),
    ],
  });
}

function renderRefJumps(refs: readonly WorldRef[], project: Project): HTMLElement {
  if (refs.length === 0) return el("section", { class: "world-ref-jumps empty", text: "연결된 게임 항목 없음" });
  return el("section", {
    class: "world-ref-jumps",
    children: [
      el("strong", { text: "연결된 게임 항목" }),
      el("div", {
        class: "world-chip-row",
        children: refs.map((ref) =>
          el("button", {
            class: "world-ref-chip",
            text: refDisplayLabel(ref, project),
            attrs: { type: "button" },
            dataset: { testid: `world-ref-jump-${ref.kind}-${ref.id}`, refKind: ref.kind, refId: ref.id },
            on: { click: () => jumpToWorldRef(ref, project) },
          })
        ),
      }),
    ],
  });
}

function renderRefEditor(draft: WorldEditDraft, project: Project, syncDraft: () => void, refresh: () => void): HTMLElement {
  const kindSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-ref-kind" } }) as HTMLSelectElement;
  for (const kind of WORLD_REF_KINDS) kindSelect.append(option(kind, REF_KIND_LABELS[kind], kind === "map"));
  kindSelect.value = "map";
  const idSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-ref-id" } }) as HTMLSelectElement;
  const populateIds = (): void => {
    clearChildren(idSelect);
    const kind = isWorldRefKind(kindSelect.value) ? kindSelect.value : "map";
    const options = refOptions(project, kind);
    for (const item of options) idSelect.append(option(item.id, item.label, false));
    if (options.length === 0) idSelect.append(option("", "선택할 항목 없음", true));
    idSelect.value = options[0]?.id ?? "";
  };
  kindSelect.addEventListener("change", populateIds);
  populateIds();

  return el("section", {
    class: "world-edit-section",
    children: [
      el("h4", { text: "연결" }),
      el("div", {
        class: "world-edit-list",
        children: draft.refs.length > 0
          ? draft.refs.map((ref, index) =>
            el("div", {
              class: "world-edit-row",
              children: [
                el("span", { text: refDisplayLabel(ref, project) }),
                el("button", {
                  class: "btn small",
                  text: "제거",
                  attrs: { type: "button" },
                  dataset: { testid: `world-ref-remove-${index}` },
                  on: {
                    click: () => {
                      syncDraft();
                      draft.refs.splice(index, 1);
                      refresh();
                    },
                  },
                }),
              ],
            })
          )
          : [el("p", { class: "world-muted", text: "연결이 없습니다." })],
      }),
      el("div", {
        class: "world-edit-add-row",
        children: [
          kindSelect,
          idSelect,
          el("button", {
            class: "btn small",
            text: "연결 추가",
            attrs: { type: "button" },
            dataset: { testid: "world-ref-add" },
            on: {
              click: () => {
                syncDraft();
                if (!isWorldRefKind(kindSelect.value) || !idSelect.value) return;
                const next = { kind: kindSelect.value, id: idSelect.value };
                if (!draft.refs.some((ref) => ref.kind === next.kind && ref.id === next.id)) draft.refs.push(next);
                refresh();
              },
            },
          }),
        ],
      }),
    ],
  });
}

function renderRelationEditor(draft: WorldEditDraft, world: ProjectWorld, syncDraft: () => void, refresh: () => void): HTMLElement {
  const targetSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-relation-target" } }) as HTMLSelectElement;
  const targets = world.entities.filter((entity) => entity.id !== draft.id);
  for (const entity of targets) targetSelect.append(option(entity.id, entity.name || entity.id, false));
  if (targets.length === 0) targetSelect.append(option("", "대상 없음", true));
  targetSelect.value = targets[0]?.id ?? "";
  const kindSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-relation-kind" } }) as HTMLSelectElement;
  for (const kind of WORLD_RELATION_KINDS) kindSelect.append(option(kind, RELATION_KIND_LABELS[kind], kind === "knows"));
  kindSelect.value = "knows";
  const noteInput = el("input", {
    class: "world-edit-input",
    attrs: { type: "text", placeholder: "메모" },
    dataset: { testid: "world-relation-note" },
  }) as HTMLInputElement;
  const related = draft.relations
    .map((relation, index) => ({ relation, index }))
    .filter(({ relation }) => relation.a === draft.id || relation.b === draft.id);

  return el("section", {
    class: "world-edit-section",
    children: [
      el("h4", { text: "관계" }),
      el("div", {
        class: "world-edit-list",
        children: related.length > 0
          ? related.map(({ relation, index }) => {
            const otherId = relation.a === draft.id ? relation.b : relation.a;
            const other = world.entities.find((entity) => entity.id === otherId);
            return el("div", {
              class: "world-edit-row",
              children: [
                el("span", { text: `${RELATION_KIND_LABELS[relation.kind]} · ${other?.name ?? otherId}` }),
                el("button", {
                  class: "btn small",
                  text: "제거",
                  attrs: { type: "button" },
                  dataset: { testid: `world-relation-remove-${index}` },
                  on: {
                    click: () => {
                      syncDraft();
                      draft.relations.splice(index, 1);
                      refresh();
                    },
                  },
                }),
              ],
            });
          })
          : [el("p", { class: "world-muted", text: "관계가 없습니다." })],
      }),
      el("div", {
        class: "world-edit-add-row",
        children: [
          kindSelect,
          targetSelect,
          noteInput,
          el("button", {
            class: "btn small",
            text: "관계 추가",
            attrs: { type: "button" },
            dataset: { testid: "world-relation-add" },
            on: {
              click: () => {
                syncDraft();
                if (!targetSelect.value || !isWorldRelationKind(kindSelect.value)) return;
                draft.relations.push({
                  a: draft.id,
                  b: targetSelect.value,
                  kind: kindSelect.value,
                  ...(noteInput.value.trim() ? { note: noteInput.value.trim() } : {}),
                });
                refresh();
              },
            },
          }),
        ],
      }),
    ],
  });
}

function saveDraft(state: WorldPanelState, world: ProjectWorld): void {
  const draft = state.editDraft;
  if (!draft) return;
  const entity: WorldEntity = {
    id: normalizeWorldEntityId(draft.id),
    type: draft.type,
    name: draft.name.trim() || "새 세계관",
    summary: draft.summary.trim(),
    ...(draft.body.trim() ? { body: draft.body } : {}),
    ...(parseTags(draft.tagsText).length > 0 ? { tags: parseTags(draft.tagsText) } : {}),
    ...(draft.refs.length > 0 ? { refs: [...draft.refs] } : {}),
    origin: draft.origin,
    ...(draft.locked ? { locked: true } : {}),
  };
  const exists = world.entities.some((entry) => entry.id === entity.id);
  const entities = exists
    ? world.entities.map((entry) => (entry.id === entity.id ? entity : entry))
    : [...world.entities, entity];
  try {
    const normalized = normalizeWorld({ entities, relations: draft.relations });
    recordProjectSnapshot(draft.isNew ? "세계관 추가" : "세계관 편집");
    store.update((project) => {
      project.world = normalized;
    }, { scope: "project" });
    state.selectedId = entity.id;
    state.editDraft = null;
    state.editError = "";
  } catch (error) {
    state.editError = error instanceof Error ? error.message : "세계관 저장에 실패했습니다.";
  }
}

function toggleEntityLock(entityId: string): void {
  const world = currentWorld(store.getCurrent());
  const entities = world.entities.map((entity) => {
    if (entity.id !== entityId) return entity;
    return { ...entity, locked: !entity.locked };
  });
  const normalized = normalizeWorld({ entities, relations: world.relations });
  recordProjectSnapshot("세계관 잠금 변경");
  store.update((project) => {
    project.world = normalized;
  }, { scope: "project" });
}

function startNewDraft(state: WorldPanelState, world: ProjectWorld, type: WorldEntityType): void {
  const id = nextWorldId(world);
  state.selectedId = id;
  state.editDraft = {
    id,
    type,
    name: "",
    summary: "",
    tagsText: "",
    body: "",
    refs: [],
    origin: "user",
    locked: false,
    relations: [...world.relations],
    isNew: true,
  };
  state.editError = "";
}

function draftFromEntity(entity: WorldEntity, relations: readonly WorldRelation[]): WorldEditDraft {
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    summary: entity.summary,
    tagsText: (entity.tags ?? []).join(", "),
    body: entity.body ?? "",
    refs: [...(entity.refs ?? [])],
    origin: entity.origin,
    locked: entity.locked === true,
    relations: [...relations],
    isNew: false,
  };
}

function renderEntityMedia(entity: WorldEntity, project: Project): HTMLElement {
  if (entity.type === "character") {
    const actorRef = entity.refs?.find((ref) => ref.kind === "actor");
    const actor = actorRef ? project.database.actors.find((record) => record.id === actorRef.id) : undefined;
    const asset = actor?.characterResourceId
      ? EASYRPG_CHARSET_ASSETS.find((candidate) => candidate.id === actor.characterResourceId)
      : undefined;
    if (asset) {
      const preview = renderEventGraphicIcon({ sprite: { type: "bundled", id: asset.textureKey } });
      preview.classList.add("world-card-sprite");
      return preview;
    }
  }
  if (entity.type === "place") {
    const mapRef = entity.refs?.find((ref) => ref.kind === "map");
    if (mapRef) return renderMapThumbnail(project, mapRef.id);
  }
  return renderPlaceholder(entity);
}

function renderMapThumbnail(project: Project, mapId: string): HTMLElement {
  const map = project.maps[mapId];
  if (!map) return renderPlaceholder({ name: "?", type: "place" } as WorldEntity);
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.className = "world-card-map-canvas";
  canvas.dataset.testid = `world-map-thumb-${mapId}`;
  const wrap = el("div", {
    class: "world-card-map-thumb",
    attrs: { role: "img", "aria-label": `${map.name} 맵` },
    children: [canvas],
  });
  const hasCanvas = typeof canvas.getContext === "function";
  if (!hasCanvas) {
    wrap.dataset.fallback = "true";
    return wrap;
  }
  const zoom = Math.min(1, 96 / Math.max(map.width * map.tileSize, map.height * map.tileSize, 1));
  const selection = { x: -1, y: -1, zoom };
  void drawTransferMapPreview({ canvas, project, mapId, selection, isCurrent: () => canvas.isConnected }).catch(() => {
    drawTransferFallback({ canvas, map, selection });
  });
  return wrap;
}

function renderPlaceholder(entity: Pick<WorldEntity, "name" | "type">): HTMLElement {
  const text = entity.name.trim().charAt(0) || ENTITY_TYPE_LABELS[entity.type].charAt(0);
  return el("div", {
    class: `world-card-placeholder ${entity.type}`,
    attrs: { "aria-hidden": "true" },
    text,
  });
}

function summarizeWorldLint(world: ProjectWorld, project: Project): WorldLintSummary {
  const all = lintWorld(world, project);
  const byEntityId = new Map<string, LintIssue[]>();
  const global: LintIssue[] = [];
  for (const issue of all) {
    const matches = world.entities.filter((entity) => issue.message.includes(entity.id));
    if (matches.length === 0) {
      global.push(issue);
      continue;
    }
    for (const entity of matches) {
      const current = byEntityId.get(entity.id) ?? [];
      current.push(issue);
      byEntityId.set(entity.id, current);
    }
  }
  return { all, byEntityId, global };
}

function highestSeverity(issues: readonly LintIssue[]): LintSeverity | null {
  let best: LintSeverity | null = null;
  for (const issue of issues) {
    if (!best || SEVERITY_RANK[issue.severity] > SEVERITY_RANK[best]) best = issue.severity;
  }
  return best;
}

function visibleEntities(entities: readonly WorldEntity[], tab: WorldTabKey, search: string): readonly WorldEntity[] {
  const query = normalizeSearch(search);
  return entities.filter((entity) => entityInTab(entity, tab) && (!query || entityMatchesSearch(entity, query)));
}

function entityInTab(entity: WorldEntity, tab: WorldTabKey): boolean {
  switch (tab) {
    case "overview":
      return true;
    case "character":
      return entity.type === "character";
    case "place-faction":
      return entity.type === "place" || entity.type === "faction";
    case "event":
      return entity.type === "event";
    case "guideline":
      return entity.type === "guideline";
  }
}

function entityMatchesSearch(entity: WorldEntity, query: string): boolean {
  return [
    entity.name,
    entity.summary,
    entity.body ?? "",
    ...(entity.tags ?? []),
  ].some((value) => normalizeSearch(value).includes(query));
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function currentWorld(project: Project): ProjectWorld {
  return normalizeProjectWorld(project);
}

function ensureSelectedEntity(state: WorldPanelState, world: ProjectWorld): void {
  if (state.editDraft) return;
  if (state.selectedId && world.entities.some((entity) => entity.id === state.selectedId)) return;
  state.selectedId = null;
}

function relationsForEntity(world: ProjectWorld, entityId: string): readonly WorldRelation[] {
  return world.relations.filter((relation) => relation.a === entityId || relation.b === entityId);
}

function parseTags(value: string): readonly string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeWorldEntityId(id: string): string {
  return id.startsWith("w_") ? id : `w_${id}`;
}

function nextWorldId(world: ProjectWorld): string {
  const ids = new Set(world.entities.map((entity) => entity.id));
  let id = genId("w");
  while (ids.has(id)) id = genId("w");
  return id;
}

function refDisplayLabel(ref: WorldRef, project: Project): string {
  switch (ref.kind) {
    case "map":
      return `${REF_KIND_LABELS.map} · ${project.maps[ref.id]?.name ?? ref.id}`;
    case "actor":
      return `${REF_KIND_LABELS.actor} · ${project.database.actors.find((record) => record.id === ref.id)?.name ?? ref.id}`;
    case "item":
      return `${REF_KIND_LABELS.item} · ${project.database.items.find((record) => record.id === ref.id)?.name ?? ref.id}`;
    case "skill":
      return `${REF_KIND_LABELS.skill} · ${project.database.skills.find((record) => record.id === ref.id)?.name ?? ref.id}`;
    case "event": {
      const match = findEvent(project, ref.id);
      return `${REF_KIND_LABELS.event} · ${match ? `${match.mapName}/${eventDisplayName(match.event)}` : ref.id}`;
    }
  }
}

function refOptions(project: Project, kind: WorldRefKind): readonly { readonly id: string; readonly label: string }[] {
  switch (kind) {
    case "map":
      return Object.values(project.maps).map((map) => ({ id: map.id, label: map.name || map.id }));
    case "actor":
      return project.database.actors.map((record) => ({ id: record.id, label: record.name || record.id }));
    case "item":
      return project.database.items.map((record) => ({ id: record.id, label: record.name || record.id }));
    case "skill":
      return project.database.skills.map((record) => ({ id: record.id, label: record.name || record.id }));
    case "event":
      return Object.values(project.maps).flatMap((map) =>
        map.events.map((event) => ({ id: event.id, label: `${map.name || map.id}/${eventDisplayName(event)}` }))
      );
  }
}

function findEvent(project: Project, eventId: string): { readonly mapId: string; readonly mapName: string; readonly event: GameEvent } | null {
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return { mapId: map.id, mapName: map.name || map.id, event };
  }
  return null;
}

function eventDisplayName(event: GameEvent): string {
  for (let index = (event.pages ?? []).length - 1; index >= 0; index -= 1) {
    const name = event.pages?.[index]?.name.trim();
    if (name) return name;
  }
  return event.id;
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "world-edit-field",
    children: [el("span", { text: label }), control],
  });
}

function labelWithControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "world-edit-field inline",
    children: [control, el("span", { text: label })],
  });
}

function option(value: string, label: string, selected: boolean): HTMLOptionElement {
  const node = el("option", { text: label, attrs: { value } }) as HTMLOptionElement;
  node.selected = selected;
  return node;
}

function isWorldEntityType(value: string): value is WorldEntityType {
  return (WORLD_ENTITY_TYPES as readonly string[]).includes(value);
}

function isWorldRefKind(value: string): value is WorldRefKind {
  return (WORLD_REF_KINDS as readonly string[]).includes(value);
}

function isWorldRelationKind(value: string): value is WorldRelationKind {
  return (WORLD_RELATION_KINDS as readonly string[]).includes(value);
}
