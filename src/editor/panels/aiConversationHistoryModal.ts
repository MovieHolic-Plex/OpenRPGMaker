// editor/panels/aiConversationHistoryModal.ts
// 저장된 대화 목록 — 열기(이어가기) · 삭제 · 제목 검색.
//
// 왜 이제야 있는가 (실측): 저장 쪽은 처음부터 다 돌고 있었다. `saveConversation` 이 매 턴 끝에
// 50건 링버퍼 + Supabase 미러까지 밀어넣고, `loadConversation`/`searchConversations` 도 구현돼
// 있었다. 그런데 **호출 지점이 없었다** — 감독 콘솔 전환에서 오버레이 시작 화면의 '이전 대화
// 이어가기' 버튼과 기록 검색 카드가 함께 사라졌고, 부팅 시 자동 복원만 남았다
// (aiChatPanel.ts 의 그 자리 주석이 이 사실을 적어 두고 "다시 붙일 때 이 조합을 되살리면 된다"
// 고 남겨 놨다). 이 모달이 그 조합이다.
//
// 스코프 표기: 대화는 프로젝트 키(conversationScopeKey)로 묶여 있다. 지금 프로젝트의 대화를
// 먼저 보여주고 남의 프로젝트 것은 꼬리표를 달아 뒤로 보낸다 — 복원 자체는 막지 않는다
// (같은 편집자가 두 프로젝트를 번갈아 하는 것이 정상 사용이다).

import {
  deleteConversation,
  listConversations,
  loadConversation,
  type ConversationRecord,
  type ConversationSummary,
} from "@/ai/conversationStore";
import { recordAiUiEvent } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";

let openBackdrop: HTMLElement | null = null;

export function closeAiConversationHistoryModal(): void {
  openBackdrop?.remove();
  openBackdrop = null;
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

export function openAiConversationHistoryModal(options: {
  /** 현재 프로젝트의 대화 스코프 키(conversationScopeKey). */
  readonly scopeKey: string;
  /** 지금 화면에 열려 있는 대화 id — 목록에서 「현재」로 표시하고 열기를 막는다. */
  readonly currentConversationId: string;
  readonly onOpen: (record: ConversationRecord) => void;
}): HTMLElement {
  closeAiConversationHistoryModal();

  const list = el("div", { class: "ai-history-list", dataset: { testid: "ai-history-list" } });
  const search = el("input", {
    class: "ai-history-search",
    attrs: { type: "search", placeholder: "제목으로 찾기", "aria-label": "대화 제목 검색" },
    dataset: { testid: "ai-history-search" },
  }) as HTMLInputElement;

  const renderList = (): void => {
    const all = sortConversationsForScope(listConversations(), options.scopeKey);
    const rows = filterConversationsByTitle(all, search.value);
    if (rows.length === 0) {
      list.replaceChildren(
        el("p", {
          class: "ai-history-empty",
          text: all.length === 0 ? "저장된 대화가 없습니다." : "검색 결과가 없습니다.",
          dataset: { testid: "ai-history-empty" },
        }),
      );
      return;
    }
    list.replaceChildren(
      ...rows.map((row) => {
        const isCurrent = row.id === options.currentConversationId;
        const foreign = row.projectContextKey !== undefined && row.projectContextKey !== options.scopeKey;
        const openButton = el("button", {
          class: "ai-history-open",
          attrs: {
            type: "button",
            ...(isCurrent ? { "aria-disabled": "true" } : {}),
            title: isCurrent ? "지금 열려 있는 대화입니다" : "이 대화를 이어서 엽니다",
          },
          dataset: { testid: "ai-history-open" },
          children: [
            el("span", { class: "ai-history-title", text: row.title }),
            // 마지막 발화 미리보기 — 제목·날짜·턴 수만으로는 어느 대화인지 고를 근거가 없었다(데크 2026-09-03).
            ...(row.preview ? [el("span", { class: "ai-history-preview", text: row.preview, dataset: { testid: "ai-history-preview" } })] : []),
            el("span", {
              class: "ai-history-meta",
              text: [
                `${formatSavedAt(row.savedAt)}`,
                `턴 ${row.turnCount}`,
                row.model,
                ...(foreign ? ["다른 프로젝트"] : []),
                ...(isCurrent ? ["현재"] : []),
              ].join(" · "),
            }),
          ],
          on: {
            click: () => {
              if (isCurrent) return;
              const record = loadConversation(row.id);
              if (!record) {
                // 목록에는 있는데 본문이 없다 — 조용히 새로 그리면 사라진 이유가 남지 않는다.
                recordAiUiEvent({
                  surface: "history-modal",
                  action: AI_UI_ACTIONS.conversationRestore,
                  testid: "ai-history-open",
                  detail: { conversationId: row.id, kind: "missing" },
                });
                renderList();
                return;
              }
              // 복원한 칸 수가 곧 «어디까지 이어졌는가» 다. 클릭만으로는 알 수 없다.
              recordAiUiEvent({
                surface: "history-modal",
                action: AI_UI_ACTIONS.conversationRestore,
                testid: "ai-history-open",
                detail: {
                  conversationId: row.id,
                  entries: record.entries.length,
                  turnCount: row.turnCount,
                  foreignProject: foreign,
                },
              });
              close();
              options.onOpen(record);
            },
          },
        });
        const deleteButton = el("button", {
          class: "ai-history-delete",
          text: "✕",
          attrs: { type: "button", title: "이 기록을 지웁니다", "aria-label": `${row.title} 기록 삭제` },
          dataset: { testid: "ai-history-delete" },
          on: {
            click: () => {
              // 삭제는 되돌릴 수 없다 — 무엇을 지웠는지가 남아야 «없어졌다» 를 설명할 수 있다.
              recordAiUiEvent({
                surface: "history-modal",
                action: AI_UI_ACTIONS.conversationDelete,
                testid: "ai-history-delete",
                label: row.title,
                detail: { conversationId: row.id, turnCount: row.turnCount, wasCurrent: isCurrent },
              });
              deleteConversation(row.id);
              renderList();
            },
          },
        });
        return el("div", {
          class: "ai-history-row",
          dataset: { testid: "ai-history-row", ...(isCurrent ? { current: "1" } : {}) },
          children: [openButton, deleteButton],
        });
      }),
    );
  };

  search.addEventListener("input", renderList);

  const closeButton = el("button", {
    class: "database-modal-close",
    text: "×",
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
          // `database-modal-body` 를 **쓰지 않는다**: sidebar.css 가
          // `.database-modal-backdrop .database-modal-window .database-modal-body` (0,3,0) 로
          // `display:flex; flex-direction:row` 를 박아 둔다(DB 스튜디오 사이드바 전제).
          // 그 클래스를 달면 검색·안내·목록이 가로 3열로 늘어선다(실측 2026-08-30).
          el("div", {
            class: "ai-history-body",
            dataset: { testid: "ai-history-body" },
            children: [
              search,
              el("p", {
                class: "ai-history-note",
                text: "여는 순간 지금 대화는 기록에 저장되고, 열린 대화의 요약이 조수에게 다시 주입됩니다.",
              }),
              list,
            ],
          }),
        ],
      }),
    ],
  });

  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
    openBackdrop = null;
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });

  renderList();
  document.body.append(backdrop);
  // Escape 는 공용 모달 스택이 라우팅한다 — 자체 document 리스너는 데이터베이스 모달의
  // Escape 핸들러와 같은 버블 단계라 등록 순서에 따라 바깥이 먼저 닫혔다.
  registerModal(backdrop, close);
  openBackdrop = backdrop;
  search.focus?.();
  return backdrop;
}
