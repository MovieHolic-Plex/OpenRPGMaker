import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { TilesetAiConversationSnapshot, TilesetAiConversationTurn } from "@/editor/tilesetAiConversationSession";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type ConversationOptions = {
  readonly busy: boolean;
  readonly onAnswer: (answer: string) => Promise<void>;
  readonly onDiscard: (proposalId: string) => void;
  readonly onGoSummary: () => void;
  readonly snapshot: TilesetAiConversationSnapshot;
  readonly tileset: TilesetDef;
};

export function renderTilesetAiWorkspaceConversation(options: ConversationOptions): HTMLElement {
  return el("section", {
    class: "tileset-ai-workspace-conversation",
    attrs: { "aria-busy": String(options.busy), "aria-label": "AI와 타일셋 대화" },
    dataset: { testid: "tileset-ai-workspace-conversation" },
    children: [
      renderConversationHeader(options.snapshot),
      el("div", {
        class: "tileset-ai-conversation-scroll",
        children: [
          renderIntro(options.snapshot),
          ...options.snapshot.turns.map(renderTurn),
          renderCurrentQuestion(options),
          renderNextQuestion(options),
        ],
      }),
    ],
  });
}

function renderConversationHeader(snapshot: TilesetAiConversationSnapshot): HTMLElement {
  const pending = snapshot.current ? "질문 진행 중" : snapshot.confirmed.length > 0 ? "적용 대기" : "분석 대기";
  return el("header", {
    class: "tileset-ai-conversation-header",
    children: [
      el("div", { children: [el("strong", { text: "AI와 함께 정리하기" }), el("span", { text: "모르는 것만 물어볼게요" })] }),
      el("span", { class: "tileset-ai-conversation-state", text: pending }),
    ],
  });
}

function renderIntro(snapshot: TilesetAiConversationSnapshot): HTMLElement {
  if (snapshot.state.status === "analyzing") {
    return renderAssistantBubble("전체 타일셋을 다시 보고 있어요. 답변을 반영해 패턴을 정리하는 중입니다.", "thinking");
  }
  if (snapshot.state.status === "offline" || snapshot.state.status === "error") {
    return renderAssistantBubble(snapshot.state.message, "error");
  }
  if (snapshot.state.status === "stale") {
    return renderAssistantBubble("타일셋이 바뀌었어요. 아래의 ‘다시 전체 분석’으로 최신 상태를 읽어 주세요.", "error");
  }
  const count = snapshot.confirmed.length;
  return renderAssistantBubble(
    count > 0
      ? `전체 타일셋을 훑었어요. 제가 확신한 ${count}개 묶음은 적용 대기 중이고, 애매한 부분만 질문할게요.`
      : "전체 타일셋을 훑었어요. 제가 애매하게 본 부분부터 하나씩 여쭤볼게요.",
    "normal",
  );
}

function renderTurn(turn: TilesetAiConversationTurn): HTMLElement {
  if (turn.role === "user") {
    return el("div", { class: "tileset-ai-chat-row user", children: [el("div", { class: "tileset-ai-chat-bubble user", text: turn.text })] });
  }
  return renderAssistantBubble(turn.text, turn.tone === "confirmation" ? "confirmation" : "normal");
}

function renderCurrentQuestion(options: ConversationOptions): HTMLElement {
  const proposal = options.snapshot.current;
  if (!proposal) {
    const text = options.snapshot.confirmed.length > 0
      ? "더 물어볼 내용이 없어요. 아래 ‘확정된 항목 적용’ 버튼을 눌러 프로젝트에 반영할 수 있어요."
      : "분석을 시작하면 제가 먼저 타일셋을 보고 필요한 것만 질문할게요.";
    return renderAssistantBubble(text, "confirmation");
  }
  return el("article", {
    class: "tileset-ai-question-card",
    attrs: { tabindex: "-1" },
    dataset: { testid: "tileset-ai-workspace-question", proposalId: proposal.id },
    children: [
      el("div", {
        class: "tileset-ai-question-context",
        children: [
          el("span", {
            class: "tileset-ai-question-thumb",
            attrs: { "aria-hidden": "true", style: tilesetTileBackgroundStyle(options.tileset, proposal.tileIds[0] ?? 0, 56) },
          }),
          el("div", {
            children: [
              el("span", { class: "tileset-ai-question-kicker", text: `현재 질문 · ${proposal.tileIds.length}칸` }),
              el("strong", { text: proposal.name }),
              el("small", { text: `AI 신뢰도 ${Math.round(proposal.confidence * 100)}%` }),
              el("span", {
                class: "tileset-ai-question-confidence",
                attrs: {
                  role: "progressbar",
                  "aria-label": "AI 신뢰도",
                  "aria-valuemin": "0",
                  "aria-valuemax": "100",
                  "aria-valuenow": String(Math.round(proposal.confidence * 100)),
                },
                children: [el("i", { attrs: { style: `width:${Math.round(proposal.confidence * 100)}%` } })],
              }),
            ],
          }),
        ],
      }),
      el("p", { class: "tileset-ai-question-text", text: proposal.question }),
      el("details", {
        class: "tileset-ai-question-evidence",
        children: [
          el("summary", { text: "AI가 이렇게 본 이유" }),
          el("p", { text: proposal.evidence || "타일 모양과 주변 패턴을 함께 비교해 추측했습니다." }),
        ],
      }),
      el("div", {
        class: "tileset-ai-quick-replies",
        children: [
          ...proposal.quickReplies.map((reply, index) => el("button", {
            text: reply,
            attrs: { type: "button", ...(options.busy ? { disabled: "true" } : {}) },
            dataset: { testid: `tileset-ai-workspace-quick-${index}` },
            on: { click: () => { void options.onAnswer(reply); } },
          })),
          el("button", {
            class: "tileset-ai-quick-discard",
            text: "이 제안 버리기",
            attrs: { type: "button", title: "이 묶음은 반영하지 않고 넘어갑니다", ...(options.busy ? { disabled: "true" } : {}) },
            dataset: { testid: "tileset-ai-workspace-discard" },
            on: { click: () => { options.onDiscard(proposal.id); } },
          }),
        ],
      }),
      renderComposer(options),
    ],
  });
}

function renderComposer(options: ConversationOptions): HTMLElement {
  const input = el("textarea", {
    attrs: {
      rows: "2",
      placeholder: "예: 가로로만 반복돼. 양 끝은 모서리 타일이야.",
      "aria-label": "AI 질문에 답변",
      ...(options.busy ? { disabled: "true" } : {}),
    },
    dataset: { testid: "tileset-ai-workspace-answer" },
  });
  const submit = (): void => {
    const answer = input.value.trim();
    if (answer) void options.onAnswer(answer);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submit();
  });
  return el("div", {
    class: "tileset-ai-answer-composer",
    children: [
      input,
      el("button", {
        class: "database-footer-button primary",
        text: "답변 보내기",
        attrs: { type: "button", ...(options.busy ? { disabled: "true" } : {}) },
        dataset: { testid: "tileset-ai-workspace-send" },
        on: { click: submit },
      }),
    ],
  });
}

function renderNextQuestion(options: ConversationOptions): HTMLElement {
  const snapshot = options.snapshot;
  if (!snapshot.next) {
    if (!snapshot.current && snapshot.confirmed.length > 0 && !options.busy) {
      return el("div", {
        class: "tileset-ai-next-question finish",
        dataset: { testid: "tileset-ai-workspace-finish" },
        children: [
          el("span", { text: "질문이 끝났어요. 확정된 묶음을 프로젝트에 반영할 차례입니다." }),
          el("button", {
            class: "database-footer-button primary",
            text: "3단계 · 적용 확인 →",
            attrs: { type: "button" },
            dataset: { testid: "tileset-ai-workspace-finish-goto-summary" },
            on: { click: options.onGoSummary },
          }),
        ],
      });
    }
    return el("span", {
      class: "tileset-ai-next-question empty",
      text: snapshot.current ? "이 질문이 마지막이에요" : "다음 질문 없음",
    });
  }
  return el("div", {
    class: "tileset-ai-next-question",
    dataset: { testid: "tileset-ai-workspace-next" },
    children: [el("span", { text: "다음 질문" }), el("strong", { text: snapshot.next.name })],
  });
}

function renderAssistantBubble(text: string, tone: "confirmation" | "error" | "normal" | "thinking"): HTMLElement {
  return el("div", {
    class: `tileset-ai-chat-row assistant ${tone}`,
    children: [
      el("span", { class: "tileset-ai-chat-avatar", text: "AI", attrs: { "aria-hidden": "true" } }),
      el("div", { class: "tileset-ai-chat-bubble assistant", text }),
    ],
  });
}
