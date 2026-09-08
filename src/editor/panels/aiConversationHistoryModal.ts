// editor/panels/aiConversationHistoryModal.ts
// 저장된 대화 목록 — 맵 범위 조회 · 열기(이어가기) · 삭제 · 제목 검색 · 명시적 원격 복구.
//
// 스코프: 지금 프로젝트만 보인다. 남의 프로젝트 대화는 나열하지도 이어가지도 않는다.
// 현재 맵 보기는 그 맵에서 시작했거나 그 맵을 대상으로 한 **대화 전체**다. 턴을 잘라 잇지 않는다.
// 삭제는 대화 전체·이 브라우저의 억제(tombstone)이며 서버 복사본 삭제를 약속하지 않는다.

import type { AuditEntry } from "@/ai/assistantSession";
import {
  deleteConversationForScope,
  hydrateConversationArchive,
  loadConversationForScope,
  queryConversationArchive,
  type ConversationArchiveSummary,
  type ConversationRecord,
  type ConversationSummary,
} from "@/ai/conversationStore";
import { recordAiUiEvent } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";
import { installAiModalFocus } from "./aiModalFocus";
import { el } from "@/util/dom";
import { createPendingWorkTracker } from "@/util/pendingWork";
import { deckIcon } from "./aiDeckIcons";

export const AI_HISTORY_ARCHIVE_PAGE_SIZE = 20;

export type HistoryKnownMap = {
  readonly id: string;
  readonly name: string;
};

type HistoryFilter = "current" | "all" | "unknown" | "map" | "legacy";
type RecoverStatus = "idle" | "loading" | "ok" | "error";

let openBackdrop: HTMLElement | null = null;
let activeHistoryClose: (() => void) | null = null;
const modalPendingWork = createPendingWorkTracker();

/** 모달의 비동기 목록 갱신·열기·삭제·복구가 모두 끝날 때까지 기다린다. */
export function whenAiConversationHistoryModalSettled(): Promise<void> {
  return modalPendingWork.settled();
}

export function closeAiConversationHistoryModal(): void {
  activeHistoryClose?.();
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history filter: ${String(value)}`);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function formatSavedAt(savedAt: number): string {
  if (!Number.isFinite(savedAt) || savedAt <= 0) return "시각 미기록";
  const date = new Date(savedAt);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 지금 프로젝트 것을 앞으로, 그 안에서는 최근 저장 순으로. */
export function sortConversationsForScope(
  conversations: readonly ConversationSummary[],
  scopeKey: string,
): readonly ConversationSummary[] {
  return [...conversations].sort((left, right) => {
    const leftMine = left.projectContextKey === scopeKey ? 0 : 1;
    const rightMine = right.projectContextKey === scopeKey ? 0 : 1;
    if (leftMine !== rightMine) return leftMine - rightMine;
    return right.savedAt - left.savedAt;
  });
}

export function filterConversationsByTitle(
  conversations: readonly ConversationSummary[],
  query: string,
): readonly ConversationSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return conversations;
  return conversations.filter((conversation) => conversation.title.toLowerCase().includes(needle));
}

function mapLabel(id: string, knownMaps: readonly HistoryKnownMap[]): string {
  for (const map of knownMaps) {
    if (map.id === id) return map.name;
  }
  return `없는 맵 (${id})`;
}

function emptyCopy(filter: HistoryFilter, query: string, durable: boolean): string {
  if (query.trim()) return "검색 결과가 없습니다.";
  switch (filter) {
    case "current":
      return "이 맵에서 시작한 대화나 이 맵을 대상으로 한 대화가 없습니다.";
    case "unknown":
      return "맵 출처를 알 수 없는 대화가 없습니다.";
    case "map":
      return "이 맵과 연결된 대화가 없습니다.";
    case "all":
      return durable
        ? "이 브라우저에 이 프로젝트 대화가 없습니다. 서버에 더 있을 수 있습니다."
        : "이 세션에 이 프로젝트 대화가 없습니다. 서버에 더 있을 수 있습니다.";
    case "legacy":
      return "프로젝트에 묶이지 않은 옛 기록이 없습니다.";
    default:
      return assertNever(filter);
  }
}

function legacyTurnText(entry: AuditEntry): string {
  switch (entry.kind) {
    case "user":
    case "assistant":
    case "status":
      return entry.text;
    case "tool":
      return `${entry.name}: ${entry.summary}`;
    default:
      return assertNever(entry);
  }
}

export function openAiConversationHistoryModal(options: {
  /** 현재 프로젝트의 대화 스코프 키(conversationScopeKey). 열 때 캡처한 값. */
  readonly scopeKey: string;
  /** 지금 화면에 열려 있는 대화 id — 목록에서 「현재」로 표시하고 열기를 막는다. */
  readonly currentConversationId: string;
  /** Live panel/project/conversation ownership, not only this modal's identity. */
  readonly isCurrent?: () => boolean;
  /** 열 때 캡처한 현재 맵. 없으면 현재-맵 필터는 빈 목록이다. */
  readonly currentMapId: string | null;
  readonly knownMaps: readonly HistoryKnownMap[];
  readonly onOpen: (record: ConversationRecord) => void;
}): HTMLElement {
  closeAiConversationHistoryModal();

  const capturedScope = options.scopeKey;
  const hydrateAbort = new AbortController();
  let filter: HistoryFilter = "current";
  let selectedMapId: string | null = null;
  let loaded: ConversationArchiveSummary[] = [];
  let hasMore = false;
  let durable = true;
  let archiveMapIds: readonly string[] = [];
  let listError: string | null = null;
  let renderGeneration = 0;
  let selectionGeneration = 0;
  let inspectGeneration = 0;
  let expandedId: string | null = null;
  let expandedRecord: ConversationRecord | null = null;

  const list = el("div", { class: "ai-history-list", dataset: { testid: "ai-history-list" } });
  const search = el("input", {
    class: "ai-history-search",
    attrs: { type: "search", placeholder: "제목으로 찾기", "aria-label": "대화 제목 검색" },
    dataset: { testid: "ai-history-search" },
  });

  const filterCurrent = el("button", {
    class: "ai-history-filter",
    text: "이 맵",
    attrs: { type: "button", "aria-pressed": "true" },
    dataset: { testid: "ai-history-filter-current" },
    on: { click: () => setFilter("current") },
  });
  const filterAll = el("button", {
    class: "ai-history-filter",
    text: "전체",
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "ai-history-filter-all" },
    on: { click: () => setFilter("all") },
  });
  const filterUnknown = el("button", {
    class: "ai-history-filter",
    text: "출처 없음",
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "ai-history-filter-unknown" },
    on: { click: () => setFilter("unknown") },
  });
  const filterLegacy = el("button", {
    class: "ai-history-filter",
    text: "스코프 없음",
    attrs: { type: "button", "aria-pressed": "false", title: "프로젝트에 묶이지 않은 옛 기록 — 읽기만" },
    dataset: { testid: "ai-history-filter-legacy" },
    on: { click: () => setFilter("legacy") },
  });
  const filters = el("div", {
    class: "ai-history-filters",
    attrs: { role: "group", "aria-label": "대화 기록 범위" },
    children: [filterCurrent, filterAll, filterUnknown, filterLegacy],
  });
  const mapSelect = el("div", {
    class: "ai-history-map-select",
    attrs: { role: "group", "aria-label": "맵 선택" },
    dataset: { testid: "ai-history-map-select" },
  });
  const recoverButton = el("button", {
    class: "ai-history-recover",
    text: "서버에서 이 프로젝트 기록 가져오기",
    attrs: {
      type: "button",
      title: "없는 기록을 가져오고, 가져오기 시작 후 바뀌지 않은 이전 로컬 기록만 더 최신 서버 기록으로 갱신합니다. 모델을 부르지 않습니다.",
    },
    dataset: { testid: "ai-history-recover" },
    on: { click: () => void modalPendingWork.track(runRecover()) },
  });
  const recoverStatus = el("p", {
    class: "ai-history-recover-status",
    dataset: { testid: "ai-history-recover-status", state: "idle" },
  });
  recoverStatus.hidden = true;

  const isCurrentModal = (): boolean => openBackdrop === backdrop && (options.isCurrent?.() ?? true);

  const historyNote = el("p", {
    class: "ai-history-note",
    text: "여는 순간 지금 대화는 기록에 저장됩니다. 목록만 보면 지금 대화는 그대로입니다.",
  });

  const refreshFilterChrome = (): void => {
    filterCurrent.setAttribute("aria-pressed", String(filter === "current"));
    filterAll.setAttribute("aria-pressed", String(filter === "all"));
    filterUnknown.setAttribute("aria-pressed", String(filter === "unknown"));
    filterLegacy.setAttribute("aria-pressed", String(filter === "legacy"));
    recoverButton.hidden = filter === "legacy";
    mapSelect.hidden = filter === "legacy";
    historyNote.textContent = filter === "legacy"
      ? "프로젝트에 묶이지 않은 기록입니다. 읽기만 되며 지금 대화로 이어가지 않습니다."
      : "여는 순간 지금 대화는 기록에 저장됩니다. 목록만 보면 지금 대화는 그대로입니다.";
    renderMapSelect();
  };

  const collectMapIds = (): string[] => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const add = (id: string): void => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    };
    if (options.currentMapId) add(options.currentMapId);
    for (const map of options.knownMaps) add(map.id);
    for (const id of archiveMapIds) add(id);
    for (const row of loaded) {
      for (const id of row.mapIds) add(id);
    }
    return ids;
  };

  const renderMapSelect = (): void => {
    const inProject = new Set(options.knownMaps.map((map) => map.id));
    mapSelect.replaceChildren(
      ...collectMapIds().map((id) => {
        const active = (filter === "current" && id === options.currentMapId)
          || (filter === "map" && selectedMapId === id);
        const label = mapLabel(id, options.knownMaps);
        return el("button", {
          class: "ai-history-map-option",
          text: label,
          attrs: {
            type: "button",
            "aria-pressed": String(active),
            title: inProject.has(id) ? label : "현재 프로젝트에 없는 맵 — 출처 없음이 아닙니다",
          },
          dataset: { mapId: id },
          on: {
            click: () => {
              if (id === options.currentMapId) setFilter("current");
              else setFilter("map", id);
            },
          },
        });
      }),
    );
  };

  const setRecover = (status: RecoverStatus, message: string): void => {
    recoverButton.disabled = status === "loading";
    recoverButton.setAttribute("aria-busy", String(status === "loading"));
    recoverStatus.hidden = status === "idle" || message.length === 0;
    recoverStatus.dataset.state = status;
    recoverStatus.textContent = message;
  };

  const setFilter = (next: HistoryFilter, mapId?: string): void => {
    filter = next;
    selectedMapId = next === "map" ? mapId ?? null : null;
    inspectGeneration += 1;
    expandedId = null;
    expandedRecord = null;
    // Scoped actions must disappear before the unscoped query can yield.
    if (next === "legacy") list.replaceChildren();
    refreshFilterChrome();
    void modalPendingWork.track(fetchPage(false));
  };

  const renderRows = (): void => {
    if (listError) {
      list.replaceChildren(
        el("p", {
          class: "ai-history-empty",
          text: listError,
          dataset: { testid: "ai-history-error" },
        }),
      );
      return;
    }
    if (loaded.length === 0) {
      list.replaceChildren(
        el("p", {
          class: "ai-history-empty",
          text: emptyCopy(filter, search.value, durable),
          dataset: { testid: "ai-history-empty" },
        }),
      );
      return;
    }
    const nodes: HTMLElement[] = loaded.map((row) => filter === "legacy" ? renderLegacyRow(row) : renderRow(row));
    if (hasMore) {
      nodes.push(el("button", {
        class: "ai-history-load-more",
        text: "더 보기",
        attrs: { type: "button" },
        dataset: { testid: "ai-history-load-more" },
        on: { click: () => void modalPendingWork.track(fetchPage(true)) },
      }));
    }
    list.replaceChildren(...nodes);
  };

  const renderRow = (row: ConversationArchiveSummary): HTMLElement => {
    const isCurrent = row.id === options.currentConversationId;
    const mapLine = row.mapIds.map((id) => mapLabel(id, options.knownMaps)).join(" · ");
    const flags: HTMLElement[] = [];
    if (row.mapAttribution !== "complete") {
      flags.push(el("span", {
        class: "ai-history-flag",
        text: row.mapAttribution === "unknown" ? "맵 출처 없음" : "맵 정보 일부",
        dataset: { testid: "ai-history-attribution", attribution: row.mapAttribution },
      }));
    }
    if (row.transcriptCompacted) {
      flags.push(el("span", {
        class: "ai-history-flag",
        text: "압축된 기록",
        dataset: { testid: "ai-history-compacted" },
      }));
    }
    const openButton = el("button", {
      class: "ai-history-open",
      attrs: {
        type: "button",
        ...(isCurrent ? { "aria-disabled": "true" } : {}),
        title: isCurrent ? "지금 열려 있는 대화입니다" : "이 대화 전체를 이어서 엽니다",
      },
      dataset: { testid: "ai-history-open" },
      children: [
        el("span", { class: "ai-history-title", text: row.title }),
        ...(row.preview ? [el("span", { class: "ai-history-preview", text: row.preview, dataset: { testid: "ai-history-preview" } })] : []),
        el("span", {
          class: "ai-history-meta",
          text: [
            formatSavedAt(row.savedAt),
            `턴 ${row.turnCount}`,
            row.model,
            ...(isCurrent ? ["현재"] : []),
          ].join(" · "),
        }),
        ...(mapLine ? [el("span", { class: "ai-history-maps", text: mapLine })] : []),
        ...(flags.length > 0 ? [el("span", { class: "ai-history-flags", children: flags })] : []),
      ],
      on: {
        click: () => void modalPendingWork.track((async () => {
          if (isCurrent || !isCurrentModal() || filter === "legacy") return;
          const generation = renderGeneration;
          const selection = ++selectionGeneration;
          let record: ConversationRecord | null;
          try {
            record = await loadConversationForScope(row.id, capturedScope);
          } catch (error) {
            if (!isCurrentModal() || generation !== renderGeneration || selection !== selectionGeneration) return;
            setRecover("error", errorMessage(error, "대화를 읽지 못했습니다. 다시 열어 주세요."));
            return;
          }
          if (!isCurrentModal() || generation !== renderGeneration || selection !== selectionGeneration) return;
          if (!record || record.id !== row.id || record.projectContextKey !== capturedScope) {
            recordAiUiEvent({
              surface: "history-modal",
              action: AI_UI_ACTIONS.conversationRestore,
              testid: "ai-history-open",
              detail: { conversationId: row.id, kind: "missing" },
            });
            setRecover("error", "이 대화를 찾을 수 없습니다. 목록을 새로 확인하거나 서버 기록을 가져와 주세요.");
            await fetchPage(false);
            return;
          }
          recordAiUiEvent({
            surface: "history-modal",
            action: AI_UI_ACTIONS.conversationRestore,
            testid: "ai-history-open",
            detail: {
              conversationId: row.id,
              entries: record.entries.length,
              turnCount: row.turnCount,
              foreignProject: false,
            },
          });
          close();
          options.onOpen(record);
        })()),
      },
    });
    const deleteButton = el("button", {
      class: "ai-history-delete",
      children: [deckIcon("x", { size: 15 })],
      attrs: {
        type: "button",
        title: "이 대화 전체를 이 브라우저에서 지웁니다. 서버 복사본은 남습니다.",
        "aria-label": `${row.title} 대화 전체 삭제 (이 브라우저만)`,
      },
      dataset: { testid: "ai-history-delete" },
      on: {
        click: () => void modalPendingWork.track((async () => {
          if (!isCurrentModal() || filter === "legacy") return;
          ++selectionGeneration;
          recordAiUiEvent({
            surface: "history-modal",
            action: AI_UI_ACTIONS.conversationDelete,
            testid: "ai-history-delete",
            label: row.title,
            detail: { conversationId: row.id, turnCount: row.turnCount, wasCurrent: isCurrent, wholeConversation: true },
          });
          try {
            await deleteConversationForScope(row.id, capturedScope);
          } catch (error) {
            if (!isCurrentModal()) return;
            listError = errorMessage(error, "이 브라우저에서 대화를 지우지 못했습니다.");
            renderRows();
            return;
          }
          if (!isCurrentModal()) return;
          await fetchPage(false);
        })()),
      },
    });
    return el("div", {
      class: "ai-history-row",
      dataset: { testid: "ai-history-row", ...(isCurrent ? { current: "1" } : {}) },
      children: [openButton, deleteButton],
    });
  };

  const inspectLegacy = async (id: string, collapse: boolean): Promise<void> => {
    if (collapse) {
      expandedId = null;
      expandedRecord = null;
      renderRows();
      return;
    }
    const generation = ++inspectGeneration;
    try {
      const record = await loadConversationForScope(id, null);
      if (!isCurrentModal() || filter !== "legacy" || generation !== inspectGeneration) return;
      if (!record) {
        setRecover("error", "이 대화를 찾을 수 없습니다. 목록을 새로 확인하거나 서버 기록을 가져와 주세요.");
        return;
      }
      expandedId = id;
      expandedRecord = record;
      renderRows();
    } catch (error) {
      if (!isCurrentModal() || filter !== "legacy" || generation !== inspectGeneration) return;
      setRecover("error", errorMessage(error, "대화를 읽지 못했습니다. 다시 열어 주세요."));
    }
  };

  const renderLegacyRow = (row: ConversationArchiveSummary): HTMLElement => {
    const expanded = expandedId === row.id && expandedRecord?.id === row.id;
    const inspect = el("button", {
      class: "ai-history-legacy-inspect",
      text: expanded ? "기록 접기" : "기록 읽기",
      attrs: { type: "button", "aria-expanded": String(expanded) },
      dataset: { testid: "ai-history-legacy-inspect" },
      on: { click: () => void modalPendingWork.track(inspectLegacy(row.id, expanded)) },
    });
    const cardChildren: HTMLElement[] = [
      el("span", { class: "ai-history-title", text: row.title }),
      ...(row.preview ? [el("span", { class: "ai-history-preview", text: row.preview, dataset: { testid: "ai-history-preview" } })] : []),
      el("span", {
        class: "ai-history-meta",
        text: [formatSavedAt(row.savedAt), `턴 ${row.turnCount}`, row.model].join(" · "),
      }),
      ...(row.mapIds.length > 0
        ? [el("span", { class: "ai-history-maps", text: row.mapIds.join(" · ") })]
        : []),
    ];
    if (row.mapAttribution !== "complete") {
      cardChildren.push(el("span", {
        class: "ai-history-flag",
        text: row.mapAttribution === "unknown" ? "맵 출처 없음" : "맵 정보 일부",
        dataset: { testid: "ai-history-attribution", attribution: row.mapAttribution },
      }));
    }
    if (row.transcriptCompacted) {
      cardChildren.push(el("span", {
        class: "ai-history-flag",
        text: "압축된 기록",
        dataset: { testid: "ai-history-compacted" },
      }));
    }
    cardChildren.push(inspect);
    if (expanded && expandedRecord) {
      cardChildren.push(el("div", {
        class: "ai-history-legacy-body",
        dataset: { testid: "ai-history-legacy-body" },
        children: expandedRecord.entries.map((entry) => el("p", {
          class: "ai-history-legacy-turn",
          text: legacyTurnText(entry),
          dataset: { kind: entry.kind },
        })),
      }));
    }
    return el("div", {
      class: "ai-history-row",
      dataset: { testid: "ai-history-row", unscoped: "1" },
      children: [el("div", { class: "ai-history-legacy-card", children: cardChildren })],
    });
  };

  const fetchPage = async (append: boolean): Promise<void> => {
    const generation = ++renderGeneration;
    if (recoverStatus.dataset.state === "loading") setRecover("idle", "");
    listError = null;
    if (!append) loaded = [];
    if (filter === "current" && !options.currentMapId) {
      hasMore = false;
      if (generation !== renderGeneration || !isCurrentModal()) return;
      renderRows();
      renderMapSelect();
      return;
    }
    try {
      const offset = append ? loaded.length : 0;
      const result = await queryConversationArchive({
        projectContextKey: filter === "legacy" ? null : capturedScope,
        query: search.value,
        offset,
        limit: AI_HISTORY_ARCHIVE_PAGE_SIZE,
        ...(filter === "unknown" ? { unknownOnly: true } : {}),
        ...(filter === "current" && options.currentMapId ? { mapId: options.currentMapId } : {}),
        ...(filter === "map" && selectedMapId ? { mapId: selectedMapId } : {}),
      });
      if (generation !== renderGeneration || !isCurrentModal()) return;
      durable = result.durable;
      loaded = append ? [...loaded, ...result.records] : [...result.records];
      hasMore = result.hasMore;
    } catch (error) {
      if (generation !== renderGeneration || !isCurrentModal()) return;
      listError = errorMessage(error, "대화 기록을 읽지 못했습니다.");
      loaded = [];
      hasMore = false;
    }
    renderRows();
    renderMapSelect();
  };

  const refreshArchiveMapIds = async (): Promise<void> => {
    const generation = renderGeneration;
    try {
      const catalog = await queryConversationArchive({
        projectContextKey: capturedScope,
        // Map choices cover the whole scoped archive, not just its newest rows.
        limit: Number.MAX_SAFE_INTEGER,
      });
      if (!isCurrentModal() || generation !== renderGeneration) return;
      const ids = new Set<string>();
      for (const row of catalog.records) {
        for (const id of row.mapIds) ids.add(id);
      }
      archiveMapIds = [...ids];
    } catch (error) {
      if (!isCurrentModal() || generation !== renderGeneration) return;
      setRecover("error", errorMessage(error, "대화 맵 목록을 읽지 못했습니다."));
    }
    renderMapSelect();
  };

  const runRecover = async (): Promise<void> => {
    if (!isCurrentModal() || recoverButton.disabled || filter === "legacy") return;
    const generation = ++renderGeneration;
    ++selectionGeneration;
    const isRecoveryCurrent = () => isCurrentModal() && generation === renderGeneration;
    setRecover("loading", "가져오는 중…");
    try {
      const result = await hydrateConversationArchive({
        projectContextKey: capturedScope,
        signal: hydrateAbort.signal,
        isCurrent: isRecoveryCurrent,
      });
      if (!isRecoveryCurrent()) return;
      const incomplete = result.rejected > 0;
      setRecover(
        incomplete ? "error" : "ok",
        [
          incomplete ? "가져오기가 끝나지 않았습니다" : "가져오기 완료",
          `가져옴 ${result.imported}`,
          `건너뜀 ${result.skipped}`,
          ...(result.rejected > 0 ? [`거부 ${result.rejected}`] : []),
          result.durable ? "" : "이 세션 메모리에만 있습니다",
        ].filter((part) => part.length > 0).join(" · "),
      );
      if (incomplete) recoverStatus.dataset.state = "incomplete";
      await refreshArchiveMapIds();
      if (isRecoveryCurrent()) await fetchPage(false);
    } catch (error) {
      if (!isRecoveryCurrent() || isAbortError(error)) return;
      setRecover("error", errorMessage(error, "서버 기록을 가져오지 못했습니다."));
      // A failed GET can still have been overtaken by a valid local save.
      await refreshArchiveMapIds();
      if (isRecoveryCurrent()) await fetchPage(false);
    }
  };

  search.addEventListener("input", () => void modalPendingWork.track(fetchPage(false)));

  const closeButton = el("button", {
    class: "database-modal-close",
    children: [deckIcon("x")],
    attrs: { type: "button", "aria-label": "대화 기록 닫기" },
    dataset: { testid: "ai-history-close" },
  });

  const backdrop = el("div", {
    class: "database-modal-backdrop ai-history-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "ai-history-modal" },
    children: [
      el("section", {
        class: "database-modal-window ai-history-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "이전 대화" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [el("h2", { text: "이전 대화" }), closeButton],
          }),
          el("div", {
            class: "ai-history-body",
            dataset: { testid: "ai-history-body" },
            children: [
              filters,
              mapSelect,
              search,
              el("div", {
                class: "ai-history-recover-row",
                children: [recoverButton, recoverStatus],
              }),
              historyNote,
              list,
            ],
          }),
        ],
      }),
    ],
  });

  const restoreFocus = installAiModalFocus(backdrop);
  const close = registerModal(backdrop, () => {
    hydrateAbort.abort();
    renderGeneration += 1;
    inspectGeneration += 1;
    backdrop.remove();
    if (openBackdrop === backdrop) openBackdrop = null;
    if (activeHistoryClose === close) activeHistoryClose = null;
    restoreFocus();
  });
  activeHistoryClose = close;
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop && isTopModal(backdrop)) close();
  });

  document.body.append(backdrop);
  openBackdrop = backdrop;
  void modalPendingWork.track((async () => {
    await refreshArchiveMapIds();
    await fetchPage(false);
  })());
  search.focus?.();
  return backdrop;
}
