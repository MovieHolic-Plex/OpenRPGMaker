import { formatEditorDate } from "@/i18n";
import { WORLD_ENTITY_TYPES, type ProjectWorld, type WorldEntity, type WorldRelation } from "@/project/world/types";
import type { LintIssue } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { renderMarkdown } from "@/util/markdown";
import { isAiHiddenEntity } from "@/project/world/visibility";
import { worldDocumentAiState, type WorldDocumentAiState } from "@/ai/worldAiReach";
import { renderEntityMedia } from "./worldMediaRenderer";
import {
  type WorldLintSummary,
  type WorldPanelOptions,
  type WorldPanelState,
  currentWorld,
  draftFromEntity,
  finishWorldDraft,
  deleteWorldEntity,
  ENTITY_TYPE_LABELS,
  field,
  highestSeverity,
  isWorldEntityType,
  labelWithControl,
  lintMessageForDisplay,
  option,
  ORIGIN_LABELS,
  RELATION_KIND_LABELS,
  relationsForEntity,
  renderFactionMaterialization,
  saveDraft,
  setPersistedCodexView,
  SEVERITY_LABELS,
  startNewDraft,
  TABS,
  toggleEntityLock,
  toggleEntityVisibility,
  visibleEntities,
} from "./worldManager";
import { renderRefEditor, renderRefJumps } from "./worldRefEditor";
import { renderRelationEditor } from "./worldRelationEditor";
import { popoverToggle, worldPopoverChip, worldPropertyBar } from "./worldDocumentProperties";

export function renderHeader(state: WorldPanelState, refresh: () => void, options: WorldPanelOptions): HTMLElement {
  const search = el("input", {
    class: "world-search-input",
    attrs: { type: "search", placeholder: "설정집 검색", "aria-label": "설정집 검색" },
    value: state.search,
    dataset: { testid: "world-search" },
  }) as HTMLInputElement;
  search.addEventListener("input", () => {
    state.search = search.value;
    state.documentOpen = false;
    refresh();
  });

  const addType = el("select", {
    class: "world-add-type",
    attrs: { "aria-label": "추가할 문서 종류" },
    dataset: { testid: "world-add-type" },
  }) as HTMLSelectElement;
  for (const type of WORLD_ENTITY_TYPES) addType.append(option(type, ENTITY_TYPE_LABELS[type], type === state.addType));
  addType.value = state.addType;
  addType.addEventListener("change", () => {
    if (isWorldEntityType(addType.value)) state.addType = addType.value;
  });

  const controls: HTMLElement[] = [
    el("button", {
      class: "btn small world-list-toggle",
      text: "목록",
      attrs: { type: "button" },
      dataset: { testid: "world-list-toggle" },
      on: { click: () => { state.documentOpen = !state.documentOpen; refresh(); } },
    }),
    search,
    addType,
    el("button", {
      class: "btn small primary world-add-button",
      text: "+ 새 문서",
      attrs: { type: "button" },
      dataset: { testid: "world-add-entity" },
      on: {
        click: () => {
          if (!finishWorldDraft(state)) { refresh(); return; }
          startNewDraft(state, currentWorld(store.getCurrent()), state.addType);
          refresh();
        },
      },
    }),
    el("button", {
      class: "btn small world-gallery-toggle",
      text: "갤러리",
      attrs: { type: "button", "aria-pressed": String(state.gallery) },
      dataset: { testid: "world-gallery-toggle" },
      on: { click: (event) => {
        state.gallery = !state.gallery;
        if (event.currentTarget instanceof HTMLElement) event.currentTarget.setAttribute("aria-pressed", String(state.gallery));
        refresh();
      } },
    }),
  ];
  if (options.onClose) {
    controls.push(
      el("button", {
        class: "database-modal-close world-panel-close",
        text: "×",
        attrs: { type: "button", title: "닫기", "aria-label": "설정집 닫기" },
        on: { click: options.onClose },
      }),
    );
  }

  const toolbar = el("div", { class: "world-panel-controls", children: controls });
  if (options.embedded) {
    return el("header", {
      class: "world-panel-header world-panel-header-embedded",
      children: [toolbar],
    });
  }
  return el("header", {
    class: "world-panel-header",
    children: [
      el("div", {
        class: "world-panel-title",
        children: [el("h2", { text: "설정집" })],
      }),
      toolbar,
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
      el("div", {
        class: "world-tabbar",
        children: [
          renderTabs(state, world, refresh),
          el("span", {
            class: "world-result-count",
            text: `${visibleEntities(world.entities, state.tab, state.search).length}개 문서`,
            attrs: { role: "status" },
            dataset: { testid: "world-result-count" },
          }),
        ],
      }),
      renderCardGrid(state, world, project, lint, refresh),
      ...(state.tab === "faction" || state.tab === "place-faction" ? [el("details", {
        class: "world-browser-tools",
        children: [el("summary", { text: "전투 진영으로 반영" }), renderFactionMaterialization(refresh)],
      })] : []),
      el("details", {
        class: "world-browser-tools",
        children: [el("summary", { text: "프로젝트 검사" }), renderGlobalLint(lint)],
      }),
    ],
  });
  return el("div", {
    class: "world-panel-main",
    children: [browser, renderWikiPane(state, world, project, lint, refresh)],
  });
}

/**
 * 종류 필터. 버튼 아홉 개가 목록 위를 두 줄 차지하던 것을 「분류 전체 ▾」 한 칩으로 접는다.
 * 버튼(`world-tab-*`)은 그대로 팝오버 안에 있고, 고르면 닫힌다.
 */
function renderTabs(state: WorldPanelState, world: ProjectWorld, refresh: () => void): HTMLElement {
  const toggle = popoverToggle(() => state.openPopover, (id) => { state.openPopover = id; }, "category");
  const active = TABS.find((tab) => tab.key === state.tab);
  return worldPopoverChip({
    label: `분류 ${active?.label ?? "전체"}`,
    title: "문서 종류별로 거르기",
    testid: "world-category",
    ...toggle,
    body: [el("nav", {
      class: "world-tabs",
      attrs: { "aria-label": "설정집 탭" },
      children: TABS.map((tab) =>
        el("button", {
          class: `world-tab${state.tab === tab.key ? " active" : ""}`,
          attrs: { type: "button", "aria-pressed": String(state.tab === tab.key) },
          dataset: { testid: `world-tab-${tab.key}` },
          children: [
            el("span", { text: tab.label }),
            el("span", { class: "world-tab-count", text: String(visibleEntities(world.entities, tab.key, "").length), attrs: { "aria-hidden": "true" } }),
          ],
          on: {
            click: () => {
              state.tab = tab.key;
              state.documentOpen = false;
              state.openPopover = undefined;
              if (isWorldEntityType(tab.key)) state.addType = tab.key;
              setPersistedCodexView(state.tab, state.selectedId);
              refresh();
            },
          },
        })
      ),
    })],
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
    return el("div", { class: "world-card-grid empty", children: [
      el("p", { text: state.search ? "검색 결과가 없습니다." : "아직 등록한 문서가 없습니다." }),
      el("button", {
        class: "btn small",
        text: state.search ? "검색 초기화" : `${ENTITY_TYPE_LABELS[state.addType]} 추가`,
        attrs: { type: "button" },
        dataset: { testid: "world-empty-action" },
        on: { click: () => {
          if (state.search) state.search = "";
          else {
            if (!finishWorldDraft(state)) { refresh(); return; }
            startNewDraft(state, world, state.addType);
          }
          refresh();
        } },
      }),
    ] });
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

  const selectCard = (): void => {
    if (!finishWorldDraft(state)) { refresh(); return; }
    state.selectedId = entity.id;
    state.documentOpen = true;
    state.editDraft = null;
    state.editError = "";
    setPersistedCodexView(state.tab, state.selectedId);
    refresh();
  };
  return el("article", {
    class: `world-card${state.selectedId === entity.id ? " active" : ""}`,
    attrs: {
      // 요약은 선택한 행에서만 보인다 — 나머지 행은 마우스를 올리면 툴팁으로 읽는다.
      title: entity.summary ? `${entity.name || "(이름 없음)"} — ${entity.summary}` : entity.name || "(이름 없음)",
      tabindex: "0", role: "button", "aria-label": entity.name || "(이름 없음)",
    },
    dataset: { testid: `world-card-${entity.id}`, entityId: entity.id, entityType: entity.type },
    on: {
      click: selectCard,
      keydown: (event) => {
        if (event.target === event.currentTarget && event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          selectCard();
        }
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
              ...(isAiHiddenEntity(entity) ? [el("span", {
                class: "world-ai-hidden-badge",
                text: "AI 숨김",
                attrs: { title: "이 문서는 조수·NPC 대사 작성기 등 AI에게 보내지 않습니다" },
                dataset: { testid: `world-ai-hidden-badge-${entity.id}` },
              })] : []),
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
    const hasDocuments = visibleEntities(world.entities, "overview", "").length > 0;
    return el("article", {
      class: "world-wiki-view empty",
      dataset: { testid: "world-wiki-view" },
      children: [
        el("h3", { text: hasDocuments ? "읽고 쓸 문서를 선택하세요" : "세계의 첫 이야기를 남겨보세요" }),
        el("p", { text: hasDocuments ? "목록에서 문서를 열거나 새 문서를 추가할 수 있습니다." : "인물, 장소, 사건을 하나씩 연결해 설정집을 만듭니다." }),
      ],
    });
  }
  const issues = lint.byEntityId.get(entity.id) ?? [];
  const relations = relationsForEntity(world, entity.id);
  const aiHidden = isAiHiddenEntity(entity);
  const pop = (id: string) => popoverToggle(() => state.openPopover, (next) => { state.openPopover = next; }, id);
  const provenance = renderWikiProvenance(entity, world, pop("provenance"));
  const refs = entity.refs ?? [];
  const bar = worldPropertyBar([
    el("span", { class: "world-chip static world-type-badge", text: ENTITY_TYPE_LABELS[entity.type], attrs: { title: "종류" } }),
    // 태그는 작가의 글이다 — 화면 번역 대상이 아니다.
    ...(entity.tags ?? []).map((tag) => el("span", { class: "world-chip static world-tag", text: tag, attrs: { "data-i18n-skip": "" } })),
    el("button", {
      class: `world-chip world-visibility-button${aiHidden ? " hidden" : ""}`,
      text: aiHidden ? "AI 숨김" : "AI 공개",
      attrs: {
        type: "button",
        "aria-pressed": String(aiHidden),
        title: aiHidden
          ? "이 문서는 AI에게 보내지 않습니다. 누르면 다시 공개합니다"
          : "이 문서는 AI가 읽을 수 있습니다. 누르면 AI에게 숨깁니다",
      },
      dataset: { testid: "world-visibility-toggle", entityId: entity.id },
      on: {
        click: () => {
          toggleEntityVisibility(entity.id);
          refresh();
        },
      },
    }),
    worldPopoverChip({
      label: `연결 ${relations.length + refs.length}`,
      body: [renderRelationChips(relations, world, entity.id, state, refresh), renderRefJumps(refs, project)],
      testid: "world-links-chip",
      title: "문서 관계와 연결된 게임 항목",
      ...pop("links"),
    }),
    ...provenance,
    ...wikiRetrievalNote(worldDocumentAiState(entity)),
  ]);
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
              el("button", {
                class: "btn small",
                text: "삭제",
                attrs: { type: "button", ...(entity.locked ? { disabled: "", title: "잠금을 푼 뒤 삭제하세요" } : {}) },
                dataset: { testid: "world-delete-entity" },
                on: { click: () => {
                  const count = relationsForEntity(currentWorld(store.getCurrent()), entity.id).length;
                  if (!globalThis.confirm(`「${entity.name}」 문서를 삭제할까요? 관계 ${count}개도 제거됩니다. 연결된 게임 항목은 유지되며 실행 취소로 복원할 수 있습니다.`)) return;
                  if (deleteWorldEntity(entity.id)) { state.selectedId = null; refresh(); }
                } },
              }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "world-document-layout",
        children: [
          bar,
          el("div", { class: "world-document-content", children: [
            ...(issues.length ? [renderIssueList(issues, [])] : []),
            renderMarkdownBody(entity.body ?? ""),
          ] }),
        ],
      }),
    ],
  });
}

/** 평소(AI가 읽는 문서)에는 안내를 띄우지 않는다 — 숨김·미작성일 때만 칩 바 끝에 한 줄로 알린다. */
function wikiRetrievalNote(state: WorldDocumentAiState): HTMLElement[] {
  return state === "reads" ? [] : [wikiRetrievalHint(state)];
}

function wikiRetrievalHint(state: WorldDocumentAiState): HTMLElement {
  const text = state === "hidden"
    ? "이 문서는 AI에게 숨겨져 있습니다. 조수·NPC 대사 작성기·설정 기록기 어디에도 보내지 않습니다."
    : state === "blank"
      ? "요약과 본문이 비어 있어 AI에게 보낼 내용이 없습니다."
      : "제작 조수는 현재 요청과 관련된 위키 문서만 제한된 분량으로 참고합니다. 본문·연결·출처가 포함될 수 있으며, 대체된 지침은 현재 지침으로 사용하지 않습니다.";
  return el("p", { class: "world-muted world-prop-note", attrs: { title: text }, dataset: { testid: "world-ai-state-hint", aiState: state }, text });
}

function renderWikiProvenance(
  entity: WorldEntity,
  world: ProjectWorld,
  toggle: { readonly open: boolean; readonly onToggle: (open: boolean) => void },
): HTMLElement[] {
  const wiki = entity.wiki;
  if (!wiki) return [];
  const basis = { explicit: "명시한 내용", inferred: "추론한 내용", observed: "적용 결과로 확인" }[wiki.basis];
  const kind = { declaration: "제작 선언", knowledge: "프로젝트 지식", progress: "진행 기록" }[wiki.kind];
  const successors = world.entities.filter((entry) => entry.wiki?.supersedes?.includes(entity.id));
  const detail = el("section", {
    class: "world-edit-section",
    dataset: { testid: "world-wiki-provenance", basis: wiki.basis, kind: wiki.kind, superseded: String(successors.length > 0) },
    children: [
      el("p", { class: "world-muted", text: `${kind} · ${basis}` }),
      el("p", { class: "world-muted", text: successors.length
        ? `대체된 문서 · 현재 지침으로 사용하지 않음: ${successors.map((entry) => `${entry.name} (${entry.id})`).join(", ")}`
        : "대체되지 않은 문서" }),
      ...(wiki.supersedes?.length ? [el("p", { class: "world-muted", text: `이 문서가 대체한 기록: ${wiki.supersedes.join(", ")}` })] : []),
      el("details", {
        class: "world-browser-tools",
        dataset: { testid: "world-wiki-sources" },
        children: [
          el("summary", { text: `출처 ${wiki.sources.length}개` }),
          ...wiki.sources.map((source, index) => el("div", {
            class: "world-edit-section",
            dataset: { testid: `world-wiki-source-${index}`, sourceId: source.id, sourceKind: source.kind },
            children: [
              el("strong", { text: `${{ user: "사용자 발언", application: "실제 적용", manual: "수동 편집" }[source.kind]} · ${source.id}` }),
              el("p", { class: "world-muted", text: formatEditorDate(new Date(source.at)) }),
              el("p", { text: source.text.length > 320 ? `${source.text.slice(0, 320)}…` : source.text }),
              ...(source.text.length > 320 ? [el("details", { children: [
                el("summary", { text: "전체 출처 보기" }), el("p", { text: source.text }),
              ] })] : []),
            ],
          })),
        ],
      }),
    ],
  });
  // 늘 보이는 것은 「종류 · 근거」 한 칩뿐이다. 대체된 문서만 경고색으로 눈에 띄게 한다.
  return [worldPopoverChip({
    label: successors.length ? "대체된 문서" : `${kind} · ${basis}`,
    body: [detail],
    testid: "world-provenance-chip",
    title: "문서 출처와 현재 지침 여부",
    ...(successors.length ? { tone: "warn" as const } : {}),
    ...toggle,
  })];
}

function renderEditPane(state: WorldPanelState, world: ProjectWorld, project: Project, refresh: () => void): HTMLElement {
  const draft = state.editDraft;
  if (!draft) throw new Error("missing world draft");

  const nameInput = el("input", {
    class: "world-edit-input world-document-title",
    attrs: { type: "text", "aria-label": "이름", placeholder: "문서 제목" },
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
  const visibilitySelect = el("select", {
    class: "world-edit-input",
    attrs: { "aria-label": "공개 범위" },
    dataset: { testid: "world-edit-visibility" },
  }) as HTMLSelectElement;
  // 칩 한 칸에 들어가도록 짧은 글자를 보이고, 풀어 쓴 설명은 항목 툴팁으로 둔다.
  const publicOption = option("public", "AI 공개", draft.visibility === "public");
  publicOption.title = "공개 — AI가 읽을 수 있음";
  const hiddenOption = option("ai-hidden", "AI 숨김", draft.visibility === "ai-hidden");
  hiddenOption.title = "비밀 — AI에게 보내지 않음";
  visibilitySelect.append(publicOption, hiddenOption);
  visibilitySelect.value = draft.visibility;

  const syncDraft = (): void => {
    draft.name = nameInput.value;
    draft.summary = summaryInput.value;
    draft.tagsText = tagsInput.value;
    draft.body = bodyInput.value;
    if (isWorldEntityType(typeSelect.value)) draft.type = typeSelect.value;
    draft.locked = lockedInput.checked;
    draft.visibility = visibilitySelect.value === "ai-hidden" ? "ai-hidden" : "public";
    state.onDraftChange?.();
  };
  for (const control of [nameInput, summaryInput, tagsInput, bodyInput, typeSelect, lockedInput, visibilitySelect]) {
    control.addEventListener("input", syncDraft);
    control.addEventListener("change", syncDraft);
  }

  const pop = (id: string) => popoverToggle(() => state.openPopover, (next) => { state.openPopover = next; }, id);
  const linkCount = draft.refs.length + draft.relations.filter((relation) => relation.a === draft.id || relation.b === draft.id).length;
  // 속성은 본문 위 한 줄 칩 바에 둔다: 짧은 값은 칩 안 입력, 긴 편집기(연결)는 팝오버.
  const bar = worldPropertyBar([
    field("종류", typeSelect),
    field("태그", tagsInput),
    field("공개 범위", visibilitySelect),
    labelWithControl("편집 잠금", lockedInput),
    worldPopoverChip({
      label: `연결 ${linkCount}`,
      body: [
        renderRefEditor(draft, project, syncDraft, refresh),
        renderRelationEditor(draft, world, syncDraft, refresh),
      ],
      testid: "world-links-chip",
      title: "문서 관계와 연결된 게임 항목",
      ...pop("links"),
    }),
    ...wikiRetrievalNote(draft.visibility === "ai-hidden" ? "hidden" : "reads"),
  ]);

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
            ],
          }),
          el("div", {
            class: "world-wiki-actions",
            children: [
              el("button", {
                class: "btn small primary",
                text: "편집 완료",
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
      ...(!visibleEntities([{ id: draft.id, type: draft.type, name: draft.name, summary: draft.summary, body: draft.body, tags: draft.tagsText.split(","), origin: draft.origin }], state.tab, state.search).length ? [
        el("p", {
          class: "world-draft-context",
          text: "작성 중인 문서는 현재 필터 밖에 있습니다. 입력은 유지됩니다.",
          dataset: { testid: "world-draft-outside-filter", entityId: draft.id },
        }),
      ] : []),
      el("div", {
        class: "world-document-layout",
        children: [
          bar,
          el("div", { class: "world-document-content world-edit-fields", children: [
            nameInput,
            field("한 줄 요약", summaryInput),
            field("본문", bodyInput),
            ...(world.entities.find((entry) => entry.id === draft.id)?.wiki ? [el("p", {
              class: "world-muted",
              text: world.entities.find((entry) => entry.id === draft.id)?.wiki?.sources.some((source) => source.kind === "application")
                ? "실제 적용 기록은 그대로 보존됩니다. 편집 완료 시 별도의 수동 지식 메모로 저장하며, 새 적용 증거로 취급하지 않습니다."
                : "수동 저장은 출처 이력에 추가됩니다. 제목·요약·본문을 바꾸면 기존 자동 전투 방식 지정은 해제됩니다.",
            })] : []),
          ] }),
        ],
      }),
    ],
  });
}

function renderIssueList(entityIssues: readonly LintIssue[], globalIssues: readonly LintIssue[]): HTMLElement {
  const items = (issues: readonly LintIssue[]): HTMLElement => el("ul", {
    children: issues.map((issue) => el("li", {
      class: `world-lint-item ${issue.severity}`,
      text: `${SEVERITY_LABELS[issue.severity]} · ${lintMessageForDisplay(issue.message)}`,
      dataset: { severity: issue.severity },
    })),
  });
  return el("section", {
    class: `world-lint-list${entityIssues.length + globalIssues.length === 0 ? " empty" : ""}`,
    dataset: { testid: "world-lint-list" },
    children: [
      ...(entityIssues.length ? [el("strong", { text: "이 문서 검사" }), items(entityIssues)] : []),
      ...(globalIssues.length ? [el("details", {
        dataset: { testid: "world-global-lint" },
        children: [el("summary", { text: `전체 프로젝트 확인 사항 ${globalIssues.length}개` }), items(globalIssues)],
      })] : []),
      ...(entityIssues.length + globalIssues.length === 0 ? [el("span", { text: "설정집 검사 이슈 없음" })] : []),
    ],
  });
}

function renderGlobalLint(lint: WorldLintSummary): HTMLElement {
  return renderIssueList([], lint.global.length > 0 ? lint.global : lint.all.filter((issue) => issue.code === "world-npc-unregistered" || issue.code === "world-item-unregistered"));
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
                state.tab = other?.type ?? "overview";
                state.search = "";
                state.documentOpen = true;
                state.editDraft = null;
                state.editError = "";
                setPersistedCodexView(state.tab, state.selectedId);
                refresh();
              },
            },
          });
        }),
      }),
    ],
  });
}
