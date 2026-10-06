import { eventWithoutDraft, rebaseOpenEditDraft } from "@/project/eventDrafts";
import type { GameEvent, MapId, Project } from "@/project/types";
import { projectRepository } from "@/project/persistence/repository";
import { shareContentDigests } from "@/project/persistence/core/contentDigest";
import { shareUploadedAssets, withoutSharedDictionaries } from "@/project/projectClone";

/**
 * 스토어가 적용마다 만드는 복제. 이 파일은 맵의 이벤트만 고치므로 타일셋은 복제하지 않고 같은 객체를
 * 가리킨다(스토어 타일셋은 update draft 로만 바뀐다 — projectClone.cloneProjectForMutation). 나머지는 복제하고
 * 원본의 정체성 요약 기억을 넘겨 다음 적용 권위 검사가 처음부터 돌지 않게 한다.
 * 실측: 2026-09-25, 26 MB 프로젝트에서 AI 체크포인트마다 전체 복제와 요약 재계산이 1 s 넘게 걸렸다.
 * 2026-09-26 앱(82MB·타일셋 354칸): 툴 한 번의 store.replace 가 타일셋을 또 통째로 복제했다.
 * 2026-09-28 새 프로젝트(149MB, 업로드 자산 66MB): 업로드 자산도 복제해서 바로 깔기 적용 하나가 복제 180ms +
 * 요약 기억 불일치로 한가할 때 전체 요약 1.4s 를 치렀다. 업로드 자산도 항목째 공유한다(projectClone 계약).
 */
function cloneKeepingDigests(project: Project): Project {
  // 키 순서를 지키려고 빈 사전을 같은 자리에 두고 복제한 뒤 갈아 끼운다(직렬화 바이트가 같아야 한다).
  const next = structuredClone(withoutSharedDictionaries(project)) as Project;
  next.tilesets = { ...project.tilesets };
  shareUploadedAssets(project, next);
  shareContentDigests(project, next);
  return next;
}

export type EventDraftVaultEntry = {
  readonly mapId: MapId;
  readonly event: GameEvent;
  readonly updatedAt: number;
};

const vault = new Map<string, EventDraftVaultEntry>();
const vaultEntrySources = new WeakMap<EventDraftVaultEntry, GameEvent>();
const serializedEntries = new WeakMap<EventDraftVaultEntry, string>();
const draftLists = new WeakMap<readonly GameEvent[], readonly GameEvent[]>();
/** Store event arrays are immutable; tile edits keep their identity. Retain only
 * the live drafts so unrelated painting never re-scans every command event. */
function liveDrafts(events: readonly GameEvent[]): readonly GameEvent[] {
  let drafts = draftLists.get(events);
  if (!drafts) { drafts = events.filter(event => !!event.draft); draftLists.set(events, drafts); }
  return drafts;
}
let vaultRevision = 0;
let serializedRevision = -1;
let serializedVaultEntries = "";

function setVaultEntry(key: string, entry: EventDraftVaultEntry): void {
  vault.set(key, entry);
  vaultRevision++;
}

function clearVaultEntries(): void {
  vault.clear();
  vaultRevision++;
  serializedVaultEntries = "";
  serializedRevision = -1;
}
/** History must use full reconciliation when a draft could restore event data. */
export function hasEventDraftVaultEntries(): boolean { return vault.size > 0; }
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimerProjectId: string | null = null;
const PERSIST_DELAY_MS = 250;

export function eventDraftVaultKey(mapId: MapId, eventId: string): string {
  return `${mapId}::${eventId}`;
}

export function clearEventDraftVault(): void {
  clearVaultEntries();
  scheduleEventDraftVaultPersist();
}

export function forgetEventDraftVaultEntry(mapId: MapId, eventId: string): void {
  if (!vault.delete(eventDraftVaultKey(mapId, eventId))) return;
  vaultRevision++;
  scheduleEventDraftVaultPersist();
}

export function rememberEventDraftVaultEntry(mapId: MapId, event: GameEvent): void {
  if (!event.draft) {
    forgetEventDraftVaultEntry(mapId, event.id);
    return;
  }
  const key = eventDraftVaultKey(mapId, event.id);
  const existing = vault.get(key);
  if (existing && vaultEntrySources.get(existing) === event) return;
  const entry: EventDraftVaultEntry = {
    mapId,
    event: structuredClone(event),
    updatedAt: Date.now(),
  };
  vaultEntrySources.set(entry, event);
  setVaultEntry(key, entry);
  scheduleEventDraftVaultPersist();
}

/**
 * 보관 항목이 어느 프로젝트 이벤트 객체에서 복제됐는지. 스토어 계약상 이벤트 객체는 제자리에서 고치지 않고
 * 안 바뀐 맵은 update 마다 같은 객체를 유지하므로(projectClone.finishProjectUpdate), 같은 객체면 다시 복제하지 않는다.
 * 항목 객체를 열쇠로 삼아, 다른 경로(rememberEventDraftVaultEntry 등)가 항목을 새로 쓰면 자동으로 무효가 된다.
 * 실측(2026-09-30, 큰 프로젝트): update 한 번에 초안 이벤트 복제가 약 20ms.
 */

export function syncEventDraftVaultFromProject(project: Project): void {
  let changed = false;
  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const event of liveDrafts(map.events)) {
      if (!event.draft) continue;
      const key = eventDraftVaultKey(mapId, event.id);
      const existing = vault.get(key);
      if (existing && existing.mapId === mapId && vaultEntrySources.get(existing) === event) continue;
      const entry: EventDraftVaultEntry = {
        mapId,
        event: structuredClone(event),
        updatedAt: Date.now(),
      };
      vaultEntrySources.set(entry, event);
      setVaultEntry(key, entry);
      changed = true;
    }
  }
  // Do not drop vault entries that are only temporarily missing from project —
  // reapply path restores them. Explicit forget/clear handles intentional discard.
  if (changed) scheduleEventDraftVaultPersist();
}

export function listEventDraftVaultEntries(): readonly EventDraftVaultEntry[] {
  return [...vault.values()].map((entry) => ({
    mapId: entry.mapId,
    event: structuredClone(entry.event),
    updatedAt: entry.updatedAt,
  }));
}

/** Restore an in-memory vault snapshot after an aborted local project switch. */
export function restoreEventDraftVaultEntries(entries: readonly EventDraftVaultEntry[]): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    persistTimerProjectId = null;
  }
  clearVaultEntries();
  for (const entry of entries) {
    setVaultEntry(eventDraftVaultKey(entry.mapId, entry.event.id), {
      mapId: entry.mapId,
      event: structuredClone(entry.event),
      updatedAt: entry.updatedAt,
    });
  }
}

export function getEventDraftVaultEntry(mapId: MapId, eventId: string): EventDraftVaultEntry | null {
  const entry = vault.get(eventDraftVaultKey(mapId, eventId));
  if (!entry) return null;
  return {
    mapId: entry.mapId,
    event: structuredClone(entry.event),
    updatedAt: entry.updatedAt,
  };
}

/**
 * Re-apply every vaulted open draft onto a project snapshot that may have lost them
 * (autosave merge, undo/replace, AI accept, remote reload). If the incoming
 * snapshot changed or deleted an edit draft's original event, keep the local
 * work and mark the draft so the editor can ask the author to resolve it.
 */
export function applyEventDraftVault(project: Project): Project {
  if (vault.size === 0) return project;
  const next = cloneKeepingDigests(project);
  for (const entry of vault.values()) {
    const map = next.maps[entry.mapId];
    if (!map || !entry.event.draft) continue;
    const index = map.events.findIndex((event) => event.id === entry.event.id);
    if (index >= 0) {
      // A live draft has already been reconciled by projectWithLiveDrafts. Do
      // not compare its working body with its original a second time here.
      if (map.events[index]?.draft) {
        rememberEventDraftVaultEntry(entry.mapId, map.events[index]!);
        continue;
      }
      const incoming = map.events[index];
      const draft = entry.event.draft;
      const conflict = draft?.kind === "edit"
        ? !incoming
          ? "remote-delete"
          : draft.original && JSON.stringify(eventWithoutDraft(incoming)) !== JSON.stringify(draft.original)
            ? "remote-change"
            : undefined
        : undefined;
      const placed = rebaseOpenEditDraft(map.events, entry.event);
      if (conflict && placed.draft) {
        placed.draft = { ...placed.draft, conflict: { kind: conflict, detectedAt: Date.now() } };
      }
      map.events[index] = placed;
      rememberEventDraftVaultEntry(entry.mapId, placed);
    } else {
      const restored = structuredClone(entry.event);
      if (restored.draft?.kind === "edit") {
        restored.draft = { ...restored.draft, conflict: { kind: "remote-delete", detectedAt: Date.now() } };
      }
      map.events.push(restored);
    }
  }
  return next;
}

/**
 * Merge live project drafts with vault, then apply vault onto `incoming`.
 * Live in-flight editor edits win; vault covers drafts missing from `live`
 * (e.g. after a remote snapshot already wiped them).
 */
export function preserveEventDraftsOnProject(incoming: Project, live: Project): Project {
  // Refresh vault from live first so in-flight editor edits win over stale vault rows.
  for (const [mapId, map] of Object.entries(live.maps)) {
    for (const event of liveDrafts(map.events)) {
      if (!event.draft) continue;
      rememberEventDraftVaultEntry(mapId, event);
    }
  }
  const withLiveDrafts = projectWithLiveDrafts(incoming, live);
  return applyEventDraftVault(withLiveDrafts);
}

function projectWithLiveDrafts(incoming: Project, live: Project): Project {
  const next = cloneKeepingDigests(incoming);
  for (const [mapId, liveMap] of Object.entries(live.maps)) {
    const targetMap = next.maps[mapId];
    if (!targetMap) continue;
    for (const liveEvent of liveDrafts(liveMap.events)) {
      if (!liveEvent.draft) continue;
      const index = targetMap.events.findIndex((event) => event.id === liveEvent.id);
      const incoming = index >= 0 ? targetMap.events[index] : undefined;
      const conflict = liveEvent.draft.kind === "edit"
        ? !incoming
          ? "remote-delete"
          : liveEvent.draft.original && JSON.stringify(eventWithoutDraft(incoming)) !== JSON.stringify(liveEvent.draft.original)
            ? "remote-change"
            : undefined
        : undefined;
      const preserved = structuredClone(liveEvent);
      if (conflict && preserved.draft) {
        preserved.draft = { ...preserved.draft, conflict: { kind: conflict, detectedAt: Date.now() } };
      }
      if (index >= 0) {
        const placed = rebaseOpenEditDraft(targetMap.events, preserved);
        targetMap.events[index] = placed;
        rememberEventDraftVaultEntry(mapId, placed);
      } else {
        targetMap.events.push(preserved);
      }
    }
  }
  return next;
}

export function restoreEventFromVaultIntoProject(
  project: Project,
  mapId: MapId,
  eventId: string
): GameEvent | null {
  const entry = getEventDraftVaultEntry(mapId, eventId);
  if (!entry) return null;
  const map = project.maps[mapId];
  if (!map) return null;
  const index = map.events.findIndex((event) => event.id === eventId);
  if (index >= 0) {
    map.events[index] = structuredClone(entry.event);
  } else {
    map.events.push(structuredClone(entry.event));
  }
  return structuredClone(entry.event);
}

export function eventDraftVaultStorageKey(projectId = resolveVaultProjectId()): string {
  return `oprn:event-draft-vault:${projectId}`;
}

export function persistEventDraftVaultNow(projectId = resolveVaultProjectId()): void {
  cancelPendingPersistSupersededBy(projectId);
  const localStorage = browserLocalStorage();
  if (!localStorage) return;
  const key = eventDraftVaultStorageKey(projectId);
  try {
    if (vault.size === 0) {
      serializedVaultEntries = "";
      serializedRevision = vaultRevision;
      localStorage.removeItem(key);
      return;
    }
    if (serializedRevision !== vaultRevision) {
      serializedVaultEntries = [...vault.values()].map(entry => {
        let text = serializedEntries.get(entry);
        if (text === undefined) { text = JSON.stringify(entry); serializedEntries.set(entry, text); }
        return text;
      }).join(",");
      serializedRevision = vaultRevision;
    }
    // Entries are privately owned immutable copies. Public reads still clone;
    // persistence can reuse their JSON without cloning all command trees again.
    localStorage.setItem(key, `{"version":1,"savedAt":${Date.now()},"entries":[${serializedVaultEntries}]}`);
  } catch (error) {
    console.warn("[eventDraftVault] localStorage persist failed:", error);
  }
}

export function loadEventDraftVaultFromLocalStorage(projectId = resolveVaultProjectId()): number {
  const localStorage = browserLocalStorage();
  if (!localStorage) return 0;
  const raw = localStorage.getItem(eventDraftVaultStorageKey(projectId));
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      entries?: Array<{ mapId?: string; event?: GameEvent; updatedAt?: number }>;
    };
    if (!Array.isArray(parsed.entries)) return 0;
    let loaded = 0;
    for (const item of parsed.entries) {
      if (!item?.mapId || !item.event?.id || !item.event.draft) continue;
      setVaultEntry(eventDraftVaultKey(item.mapId, item.event.id), {
        mapId: item.mapId,
        event: structuredClone(item.event),
        updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
      });
      loaded += 1;
    }
    return loaded;
  } catch (error) {
    console.warn("[eventDraftVault] localStorage restore failed:", error);
    return 0;
  }
}

export function scheduleEventDraftVaultPersist(projectId = resolveVaultProjectId()): void {
  if (!browserLocalStorage()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimerProjectId = projectId;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistTimerProjectId = null;
    persistEventDraftVaultNow(projectId);
  }, PERSIST_DELAY_MS);
}

function cancelPendingPersistSupersededBy(projectId: string): void {
  if (!persistTimer || persistTimerProjectId !== projectId) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  persistTimerProjectId = null;
}

function browserLocalStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

/** @internal */
export function _resetEventDraftVaultForTest(): void {
  clearVaultEntries();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    persistTimerProjectId = null;
  }
}

function resolveVaultProjectId(): string {
  return projectRepository().currentTarget()?.projectId ?? "local";
}
