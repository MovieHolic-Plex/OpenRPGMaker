import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import {
  applyFactionsFromWorldPlan,
  planFactionsFromWorld,
  type FactionsFromWorldPlan,
} from "@/project/factionsFromWorld";
import { normalizeProjectFactions } from "@/project/factions";
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
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

export type WorldTabKey = "overview" | WorldEntityType | "place-faction" | "item-concept";

export type WorldPanelOptions = {
  readonly initialEntityId?: string;
  readonly initialTab?: WorldTabKey;
  readonly onClose?: () => void;
  /** 자료집 탭 안에 심을 때. 제목/닫기를 빼고 셸 크기를 따른다. */
  readonly embedded?: boolean;
  readonly state?: WorldPanelState;
};

export type WorldPanelState = {
  tab: WorldTabKey;
  search: string;
  selectedId: string | null;
  addType: WorldEntityType;
  editDraft: WorldEditDraft | null;
  editError: string;
  documentOpen: boolean;
  gallery: boolean;
  propertiesOpen: boolean;
  onDraftChange?: () => void;
};

export function createWorldPanelState(options: WorldPanelOptions = {}): WorldPanelState {
  return { tab: options.initialTab ?? "overview", search: "", selectedId: options.initialEntityId ?? null,
    addType: "character", editDraft: null, editError: "",
    documentOpen: Boolean(options.initialEntityId), gallery: false, propertiesOpen: false };
}

export function hasWorldDraftChanges(state: WorldPanelState): boolean {
  const draft = state.editDraft;
  if (!draft) return false;
  if (draft.isNew) return Boolean(draft.name.trim() || draft.summary.trim() || draft.body.trim() || draft.tagsText.trim() || draft.refs.length
    || draft.locked || draft.type !== "character" || draft.relations.some((relation) => relation.a === draft.id || relation.b === draft.id));
  const world = store.getCurrent().world;
  const stored = world?.entities.find((entity) => entity.id === draft.id);
  return !stored || JSON.stringify(draftFromEntity(stored, world?.relations ?? [])) !== JSON.stringify(draft);
}

/** Card navigation commits a changed draft; validation failures keep the editor open. */
export function finishWorldDraft(state: WorldPanelState): boolean {
  if (hasWorldDraftChanges(state)) saveDraft(state, currentWorld(store.getCurrent()));
  else state.editDraft = null;
  state.onDraftChange?.();
  return state.editDraft === null;
}

export type WorldEditDraft = {
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
  /** Snapshot of the document opened by this editor, not a project-wide revision. */
  baseEntity?: string;
};

export type WorldLintSummary = {
  readonly all: readonly LintIssue[];
  readonly byEntityId: ReadonlyMap<string, readonly LintIssue[]>;
  readonly global: readonly LintIssue[];
};

/** 모달 리렌더를 넘겨 살아남는 설정집 보기 상태(탭·선택). 저장할 때마다 새 패널이
 * 태어나 선택이 풀리고 탭이 개요로 돌아가던 문제를 막는다. world가 바뀌면
 * ensureSelectedEntity·tab 유효성 검사에서 정리된다. */
let persistedCodexTab: WorldTabKey = "overview";
let persistedCodexSelectedId: string | null = null;

export function getPersistedCodexView(): { tab: WorldTabKey; selectedId: string | null } {
  return { tab: persistedCodexTab, selectedId: persistedCodexSelectedId };
}

export function setPersistedCodexView(tab: WorldTabKey, selectedId: string | null): void {
  persistedCodexTab = tab;
  persistedCodexSelectedId = selectedId;
}

export const TABS: readonly { readonly key: WorldTabKey; readonly label: string }[] = [
  { key: "overview", label: "전체" },
  { key: "character", label: "인물" },
  { key: "place", label: "장소" },
  { key: "faction", label: "세력" },
  { key: "event", label: "사건" },
  { key: "item", label: "아이템" },
  { key: "concept", label: "개념" },
  { key: "guideline", label: "제작 노트" },
];

export const ENTITY_TYPE_LABELS: Record<WorldEntityType, string> = {
  character: "인물",
  place: "장소",
  faction: "세력",
  event: "사건",
  item: "아이템",
  concept: "개념",
  guideline: "제작 노트",
};

export const ORIGIN_LABELS: Record<WorldOrigin, string> = {
  user: "사용자",
  ai: "AI",
  interview: "인터뷰",
};

export const REF_KIND_LABELS: Record<WorldRefKind, string> = {
  map: "맵",
  event: "이벤트",
  item: "아이템",
  skill: "스킬",
  actor: "주인공",
};

export const RELATION_KIND_LABELS: Record<WorldRelationKind, string> = {
  memberOf: "소속",
  locatedIn: "위치",
  knows: "아는 사이",
  enemyOf: "적대",
  allyOf: "동맹",
  causedBy: "원인",
  owns: "소유",
  custom: "관계",
};

export const SEVERITY_LABELS: Record<LintSeverity, string> = {
  error: "오류",
  warning: "주의",
  info: "정보",
};

const SEVERITY_RANK: Record<LintSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

export function jumpToWorldRefTarget(ref: WorldRef, project: Project = store.getCurrent()): boolean {
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

export function saveDraft(state: WorldPanelState, _world: ProjectWorld): void {
  const world = currentWorld(store.getCurrent());
  const draft = state.editDraft;
  if (!draft) return;
  const stored = world.entities.find((entry) => entry.id === normalizeWorldEntityId(draft.id));
  if (!draft.isNew) {
    if (!stored || (draft.baseEntity !== undefined && JSON.stringify(stored) !== draft.baseEntity)) {
      state.editError = "이 문서가 다른 작업에서 변경되거나 삭제되었습니다. 초안을 보관한 뒤 문서를 다시 열어주세요.";
      return;
    }
    if (stored?.locked === true && draft.locked) {
      state.editError = "잠긴 카드는 잠금을 푼 뒤에 편집할 수 있습니다.";
      return;
    }
  }
  const wiki = stored?.wiki;
  // Application evidence is immutable: manual edits become a separate explicit note.
  // The original document retains its sources, supersession and observed claims.
  const manualNote = wiki?.sources.some((source) => source.kind === "application") === true;
  const textChanged = stored && (draft.name.trim() !== stored.name || draft.summary.trim() !== stored.summary || draft.body !== (stored.body ?? ""));
  const manualSource = wiki ? {
    id: genId("manual"), kind: "manual" as const, at: Date.now(),
    text: [manualNote ? `수동 편집 메모 · 원본 ${draft.id}` : "수동 편집", draft.name.trim() || "새 카드", draft.summary.trim(), draft.body].filter(Boolean).join("\n\n"),
  } : undefined;
  const entity: WorldEntity = {
    id: manualNote ? nextWorldId(world) : normalizeWorldEntityId(draft.id),
    type: draft.type,
    name: draft.name.trim() || "새 카드",
    summary: draft.summary.trim(),
    ...(draft.body.trim() ? { body: draft.body } : {}),
    ...(parseTags(draft.tagsText).length > 0 ? { tags: parseTags(draft.tagsText) } : {}),
    ...(draft.refs.length > 0 ? { refs: [...draft.refs] } : {}),
    origin: manualNote ? "user" : draft.origin,
    ...(draft.locked ? { locked: true } : {}),
    ...(wiki && manualSource ? { wiki: manualNote ? {
      kind: "knowledge", basis: "explicit", sources: [manualSource],
      ...(wiki.topic ? { topic: wiki.topic } : {}),
    } : {
      ...wiki, basis: "explicit", sources: [...wiki.sources, manualSource],
      ...(textChanged ? { combatMode: undefined } : {}),
    } } : {}),
  };
  const exists = world.entities.some((entry) => entry.id === entity.id);
  const entities = exists
    ? world.entities.map((entry) => (entry.id === entity.id ? entity : entry))
    : [...world.entities, entity];
  try {
    const normalized = normalizeWorld({ entities, relations: [
      ...world.relations.filter((relation) => manualNote || (relation.a !== draft.id && relation.b !== draft.id)),
      ...draft.relations.filter((relation) => relation.a === draft.id || relation.b === draft.id).map((relation) => manualNote ? {
        ...relation, a: relation.a === draft.id ? entity.id : relation.a, b: relation.b === draft.id ? entity.id : relation.b,
      } : relation),
    ] });
    recordProjectSnapshot(draft.isNew ? "세계관 추가" : "세계관 편집");
    store.update((project) => {
      project.world = normalized;
    }, { scope: "project", label: draft.isNew ? "설정집 카드 추가" : "설정집 카드 편집" });
    state.selectedId = entity.id;
    state.documentOpen = true;
    if (!entityInTab(entity, state.tab)) state.tab = entity.type;
    if (!visibleEntities([entity], state.tab, state.search).length) state.search = "";
    state.editDraft = null;
    state.editError = "";
    setPersistedCodexView(state.tab, state.selectedId);
  } catch (error) {
    state.editError = error instanceof Error ? error.message : "세계관 저장에 실패했습니다.";
  }
}

export function deleteWorldEntity(entityId: string): boolean {
  const world = currentWorld(store.getCurrent());
  const entity = world.entities.find((entry) => entry.id === entityId);
  if (!entity) return false;
  if (entity.locked) { toast("잠금을 푼 뒤 삭제하세요", "error"); return false; }
  if (entity.wiki?.supersedes?.length || world.entities.some((entry) => entry.wiki?.supersedes?.includes(entityId))) {
    toast("대체 이력에 연결된 문서는 삭제할 수 없습니다. 이전 지침이 다시 적용되지 않도록 이력을 보존합니다.", "error");
    return false;
  }
  recordProjectSnapshot("설정집 카드 삭제");
  store.update((project) => {
    project.world = normalizeWorld({
      entities: world.entities.filter((entry) => entry.id !== entityId),
      relations: world.relations.filter((relation) => relation.a !== entityId && relation.b !== entityId),
    });
    for (const faction of project.factions?.defs ?? []) {
      if (faction.worldEntityId === entityId) delete faction.worldEntityId;
    }
  }, { scope: "project", label: "설정집 카드 삭제" });
  return true;
}

export function toggleEntityLock(entityId: string): void {
  const world = currentWorld(store.getCurrent());
  const entities = world.entities.map((entity) => {
    if (entity.id !== entityId) return entity;
    return { ...entity, locked: !entity.locked };
  });
  const normalized = normalizeWorld({ entities, relations: world.relations });
  recordProjectSnapshot("세계관 잠금 변경");
  store.update((project) => {
    project.world = normalized;
  }, { scope: "project", label: "설정집 카드 잠금 변경" });
}

export function startNewDraft(state: WorldPanelState, world: ProjectWorld, type: WorldEntityType): void {
  const id = nextWorldId(world);
  state.selectedId = id;
  state.documentOpen = true;
  setPersistedCodexView(state.tab, state.selectedId);
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

export function draftFromEntity(entity: WorldEntity, relations: readonly WorldRelation[]): WorldEditDraft {
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
    baseEntity: JSON.stringify(entity),
  };
}

export function summarizeWorldLint(world: ProjectWorld, project: Project): WorldLintSummary {
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

export function highestSeverity(issues: readonly LintIssue[]): LintSeverity | null {
  let best: LintSeverity | null = null;
  for (const issue of issues) {
    if (!best || SEVERITY_RANK[issue.severity] > SEVERITY_RANK[best]) best = issue.severity;
  }
  return best;
}

export function visibleEntities(entities: readonly WorldEntity[], tab: WorldTabKey, search: string): readonly WorldEntity[] {
  const query = normalizeSearch(search);
  return entities.filter((entity) => entityInTab(entity, tab) && (!query || entityMatchesSearch(entity, query)));
}

export function currentWorld(project: Project): ProjectWorld {
  return normalizeProjectWorld(project);
}

/**
 * 장소·세력 탭의 명시적 세계관→전투 진영 반영 표면.
 * 미리보기와 적용을 한 컨트롤 안에 묶어, 버튼을 눌렀다는 이유만으로 프로젝트가 바뀌지 않게 한다.
 */
export function renderFactionMaterialization(refresh: () => void): HTMLElement {
  const host = el("section", {
    class: "world-overview",
    dataset: { testid: "world-faction-materialization" },
  });
  const renderClosed = (): void => {
    host.replaceChildren(
      el("div", {
        children: [
          el("strong", { text: "전투 진영으로 반영" }),
          el("p", {
            class: "world-counts",
            text: "세계관 세력과 적대·동맹 관계를 전투 진영표의 빈 칸에만 옮깁니다. 수기 데이터는 덮어쓰지 않습니다.",
          }),
        ],
      }),
      el("button", {
        class: "btn small primary",
        text: "변경안 미리보기",
        attrs: { type: "button" },
        dataset: { testid: "world-faction-materialization-preview" },
        on: { click: renderPreview },
      }),
    );
  };
  const renderPreview = (): void => {
    const latestProject = store.getCurrent();
    const latestWorld = currentWorld(latestProject);
    const plan = planFactionsFromWorld(latestWorld, latestProject.factions);
    host.replaceChildren(...factionPlanPreviewNodes(host, plan, refresh));
  };
  renderClosed();
  return host;
}

function factionPlanPreviewNodes(
  host: HTMLElement,
  plan: FactionsFromWorldPlan,
  refresh: () => void,
): HTMLElement[] {
  const conflicts = plan.issues.filter((issue) => issue.severity === "conflict").length;
  const warnings = plan.issues.length - conflicts;
  const mapped = plan.mapping.filter((entry) => entry.status !== "blocked");
  const mappingRows = mapped.map((entry) =>
    el("li", {
      text: `${entry.worldEntityName}: ${entry.worldEntityId} → ${entry.combatFactionId}${entry.status === "existing" ? " (이미 있음)" : ""}`,
    })
  );
  const relationRows = plan.diff.relations.added.map((relation) =>
    el("li", { text: `${relation.a} ↔ ${relation.b}: ${relation.stance}` })
  );
  const issueRows = plan.issues.map((issue) =>
    el("li", {
      class: `world-lint-item ${issue.severity === "conflict" ? "warning" : "info"}`,
      text: `${issue.severity === "conflict" ? "충돌" : "안내"} · ${issue.message}`,
    })
  );
  const apply = el("button", {
    class: "btn small primary",
    text: plan.hasChanges ? "변경안 적용" : "적용할 변경 없음",
    attrs: { type: "button", ...(plan.hasChanges ? {} : { disabled: "true" }) },
    dataset: { testid: "world-faction-materialization-apply" },
    on: {
      click: () => {
        if (!plan.hasChanges) return;
        const latestProject = store.getCurrent();
        const latestPlan = planFactionsFromWorld(currentWorld(latestProject), latestProject.factions);
        if (!sameFactionMaterializationPreview(plan, latestPlan)) {
          host.replaceChildren(...factionPlanPreviewNodes(host, latestPlan, refresh));
          toast("프로젝트가 바뀌어 최신 변경안을 다시 표시했습니다. 내용을 확인한 뒤 적용하세요.", "info");
          return;
        }
        recordProjectSnapshot("세계관 세력을 전투 진영으로 반영");
        store.update((draft) => {
          const factions = normalizeProjectFactions(applyFactionsFromWorldPlan(latestPlan));
          if (factions) draft.factions = factions;
          else delete draft.factions;
        }, { scope: "database", collection: "factions" });
        toast(
          `전투 진영 반영: 진영 ${latestPlan.diff.defs.added.length}개 · 관계 ${latestPlan.diff.relations.added.length}개`,
          "ok",
        );
        refresh();
      },
    },
  });
  return [
    el("div", {
      children: [
        el("strong", { text: "전투 진영 변경안" }),
        el("p", {
          class: "world-counts",
          dataset: { testid: "world-faction-materialization-summary" },
          text:
            `진영 추가 ${plan.diff.defs.added.length} · 변경 ${plan.diff.defs.changed.length} · 삭제 ${plan.diff.defs.removed.length} / ` +
            `관계 추가 ${plan.diff.relations.added.length} · 변경 ${plan.diff.relations.changed.length} · 삭제 ${plan.diff.relations.removed.length} / ` +
            `충돌 ${conflicts} · 안내 ${warnings}`,
        }),
      ],
    }),
    ...(mappingRows.length > 0
      ? [el("div", { children: [el("strong", { text: "세력 ID" }), el("ul", { children: mappingRows })] })]
      : []),
    ...(relationRows.length > 0
      ? [el("div", { children: [el("strong", { text: "전투 태도" }), el("ul", { children: relationRows })] })]
      : []),
    ...(issueRows.length > 0
      ? [el("div", { class: "world-lint-list", children: [el("strong", { text: "충돌·안내" }), el("ul", { children: issueRows })] })]
      : []),
    el("div", {
      class: "world-chip-row",
      children: [
        apply,
        el("button", {
          class: "btn small",
          text: "미리보기 닫기",
          attrs: { type: "button" },
          dataset: { testid: "world-faction-materialization-cancel" },
          on: {
            click: () => {
              host.replaceChildren();
              refresh();
            },
          },
        }),
      ],
    }),
  ];
}

function sameFactionMaterializationPreview(
  shown: FactionsFromWorldPlan,
  latest: FactionsFromWorldPlan,
): boolean {
  // 적용 대상뿐 아니라 충돌·ID 매핑까지 같아야 사용자가 확인한 변경안으로 본다.
  return JSON.stringify({ mapping: shown.mapping, diff: shown.diff, issues: shown.issues, result: shown.result })
    === JSON.stringify({ mapping: latest.mapping, diff: latest.diff, issues: latest.issues, result: latest.result });
}

export function ensureSelectedEntity(state: WorldPanelState, world: ProjectWorld): void {
  if (state.editDraft) return;
  if (state.selectedId && visibleEntities(world.entities, state.tab, state.search).some((entity) => entity.id === state.selectedId)) return;
  state.selectedId = null;
  setPersistedCodexView(state.tab, null);
}

export function relationsForEntity(world: ProjectWorld, entityId: string): readonly WorldRelation[] {
  return world.relations.filter((relation) => relation.a === entityId || relation.b === entityId);
}

export function refDisplayLabel(ref: WorldRef, project: Project): string {
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

export function refOptions(project: Project, kind: WorldRefKind): readonly { readonly id: string; readonly label: string }[] {
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

export function findEvent(project: Project, eventId: string): { readonly mapId: string; readonly mapName: string; readonly event: GameEvent } | null {
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return { mapId: map.id, mapName: map.name || map.id, event };
  }
  return null;
}

export function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "world-edit-field",
    children: [el("span", { text: label }), control],
  });
}

export function labelWithControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "world-edit-field inline",
    children: [control, el("span", { text: label })],
  });
}

export function option(value: string, label: string, selected: boolean): HTMLOptionElement {
  const node = el("option", { text: label, attrs: { value } }) as HTMLOptionElement;
  node.selected = selected;
  return node;
}

export function isWorldEntityType(value: string): value is WorldEntityType {
  return (WORLD_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isWorldRefKind(value: string): value is WorldRefKind {
  return (WORLD_REF_KINDS as readonly string[]).includes(value);
}

export function isWorldRelationKind(value: string): value is WorldRelationKind {
  return (WORLD_RELATION_KINDS as readonly string[]).includes(value);
}

function entityInTab(entity: WorldEntity, tab: WorldTabKey): boolean {
  switch (tab) {
    case "overview":
      return true;
    case "character":
      return entity.type === "character";
    case "place-faction":
      return entity.type === "place" || entity.type === "faction";
    case "place":
    case "faction":
    case "item":
    case "concept":
      return entity.type === tab;
    case "event":
      return entity.type === "event";
    case "item-concept":
      return entity.type === "item" || entity.type === "concept";
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

function eventDisplayName(event: GameEvent): string {
  for (let index = (event.pages ?? []).length - 1; index >= 0; index -= 1) {
    const name = event.pages?.[index]?.name.trim();
    if (name) return name;
  }
  return event.id;
}
