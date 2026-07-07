import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
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

export type WorldTabKey = "overview" | "character" | "place-faction" | "event" | "guideline";

export type WorldPanelOptions = {
  readonly initialEntityId?: string;
  readonly onClose?: () => void;
};

export type WorldPanelState = {
  tab: WorldTabKey;
  search: string;
  selectedId: string | null;
  addType: WorldEntityType;
  editDraft: WorldEditDraft | null;
  editError: string;
};

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
};

export type WorldLintSummary = {
  readonly all: readonly LintIssue[];
  readonly byEntityId: ReadonlyMap<string, readonly LintIssue[]>;
  readonly global: readonly LintIssue[];
};

export const TABS: readonly { readonly key: WorldTabKey; readonly label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "character", label: "인물" },
  { key: "place-faction", label: "장소·세력" },
  { key: "event", label: "사건" },
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

export function saveDraft(state: WorldPanelState, world: ProjectWorld): void {
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
  }, { scope: "project" });
}

export function startNewDraft(state: WorldPanelState, world: ProjectWorld, type: WorldEntityType): void {
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

export function ensureSelectedEntity(state: WorldPanelState, world: ProjectWorld): void {
  if (state.editDraft) return;
  if (state.selectedId && world.entities.some((entity) => entity.id === state.selectedId)) return;
  state.selectedId = null;
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
