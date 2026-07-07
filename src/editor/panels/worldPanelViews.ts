import { WORLD_ENTITY_TYPES, type ProjectWorld, type WorldEntity, type WorldRelation } from "@/project/world/types";
import type { LintIssue } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { renderMarkdown } from "@/util/markdown";
import { renderEntityMedia } from "./worldMediaRenderer";
import {
  type WorldLintSummary,
  type WorldPanelOptions,
  type WorldPanelState,
  currentWorld,
  draftFromEntity,
  ENTITY_TYPE_LABELS,
  field,
  highestSeverity,
  isWorldEntityType,
  labelWithControl,
  option,
  ORIGIN_LABELS,
  RELATION_KIND_LABELS,
  relationsForEntity,
  saveDraft,
  SEVERITY_LABELS,
  startNewDraft,
  TABS,
  toggleEntityLock,
  visibleEntities,
} from "./worldManager";
import { renderRefEditor, renderRefJumps } from "./worldRefEditor";
import { renderRelationEditor } from "./worldRelationEditor";

export function renderHeader(state: WorldPanelState, refresh: () => void, options: WorldPanelOptions): HTMLElement {
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

export function renderMain(
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
