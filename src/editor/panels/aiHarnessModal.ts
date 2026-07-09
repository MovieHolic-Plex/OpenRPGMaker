// editor/panels/aiHarnessModal.ts
// 🔬 AI 하네스 뷰어 — 오케스트레이션 내부 동작(단계 전환·주입 원문·툴 호출·토큰 사용)을
// 타임라인으로 보여준다. 채팅 버블은 요약본이고, 여기가 원본 관측 지점이다.
// 데이터 원천: 감사 로그(AuditEntry, 영속) + 살아있는 세션의 하네스 스냅샷(주입 포함 원본 메시지).

import type { AuditEntry, HarnessSnapshot } from "@/ai/assistantSession";
import { el } from "@/util/dom";

// aiChatPanel의 StatusTransition과 같은 모양 — 순환 의존을 피하려고 구조만 받는다.
interface StatusPoint {
  readonly at: string;
  readonly status: string;
}

export interface HarnessModalInput {
  readonly audit: readonly AuditEntry[];
  readonly statusTimeline: readonly StatusPoint[];
  readonly getSnapshot: () => HarnessSnapshot | null;
}

const ORCH_AUDIT_PREFIX = "오케스트레이션 주입: ";
const PHASE_AUDIT_PREFIX = "phase:";
const PHASE_LABELS: Record<string, string> = { plan: "계획", execute: "실행", review: "검수" };

// status 감사 항목을 하네스 의미 단위로 분류한다(문자열 프리픽스 계약 — assistantSession과 합의).
type StatusFlavor = "phase" | "injection" | "turn-end" | "retry" | "plain";
function statusFlavor(text: string): StatusFlavor {
  if (text.startsWith(PHASE_AUDIT_PREFIX)) return "phase";
  if (text.startsWith(ORCH_AUDIT_PREFIX)) return "injection";
  if (text.startsWith("턴 종료") || text.startsWith("턴 중단")) return "turn-end";
  if (text.includes("재시도")) return "retry";
  return "plain";
}

function timeLabel(at?: string): string {
  if (!at) return "";
  const idx = at.indexOf("T");
  return idx >= 0 ? at.slice(idx + 1, idx + 9) : at;
}

function badge(kind: string, text: string): HTMLElement {
  return el("span", { class: `harness-badge is-${kind}`, text });
}

function detailsRow(summaryChildren: HTMLElement[], bodyText: string): HTMLElement {
  return el("details", {
    class: "harness-row-details",
    children: [
      el("summary", { class: "harness-row-summary", children: summaryChildren }),
      el("pre", { class: "harness-row-raw", text: bodyText }),
    ],
  });
}

function renderEntryRow(entry: AuditEntry): HTMLElement {
  const time = el("span", { class: "harness-time", text: timeLabel(entry.at) });
  if (entry.kind === "user") {
    return el("div", {
      class: "harness-row",
      children: [time, badge("user", "사용자"), el("span", { class: "harness-text", text: entry.text.slice(0, 160) })],
    });
  }
  if (entry.kind === "assistant") {
    const toolNames = (entry.toolCalls ?? []).map((call) => call.name).join(", ");
    const head = [time, badge("assistant", "모델"),
      el("span", { class: "harness-text", text: entry.text ? entry.text.slice(0, 160) : toolNames ? `툴 요청: ${toolNames}` : "(빈 응답)" })];
    const raw = [entry.text, ...(entry.toolCalls ?? []).map((call) => `→ ${call.name} ${call.args}`)].filter(Boolean).join("\n");
    return raw.length > 160 ? el("div", { class: "harness-row", children: [detailsRow(head, raw)] }) : el("div", { class: "harness-row", children: head });
  }
  if (entry.kind === "tool") {
    const head = [
      time,
      badge(entry.ok ? "tool-ok" : "tool-fail", entry.ok ? "✓ 툴" : "✗ 툴"),
      el("code", { class: "harness-tool-name", text: entry.name }),
      el("span", { class: "harness-text", text: entry.summary.slice(0, 120) }),
    ];
    const raw = [
      `인자: ${JSON.stringify(entry.args, null, 1)}`,
      ...(entry.issues && entry.issues.length > 0 ? [`이슈:\n${entry.issues.map((issue) => `  - ${issue}`).join("\n")}`] : []),
    ].join("\n");
    return el("div", { class: "harness-row", children: [detailsRow(head, raw)] });
  }
  // status 계열 — 하네스 의미 단위로 배지를 나눈다.
  const flavor = statusFlavor(entry.text);
  if (flavor === "phase") {
    const phase = entry.text.slice(PHASE_AUDIT_PREFIX.length);
    return el("div", {
      class: "harness-row is-phase",
      children: [time, badge("phase", `단계 → ${PHASE_LABELS[phase] ?? phase}`)],
    });
  }
  if (flavor === "injection") {
    const content = entry.text.slice(ORCH_AUDIT_PREFIX.length);
    return el("div", {
      class: "harness-row",
      children: [detailsRow([time, badge("injection", "주입"), el("span", { class: "harness-text", text: content.slice(0, 120) })], content)],
    });
  }
  const kind = flavor === "turn-end" ? "turn-end" : flavor === "retry" ? "retry" : "status";
  const label = flavor === "turn-end" ? "턴" : flavor === "retry" ? "재시도" : "상태";
  return el("div", {
    class: "harness-row",
    children: [time, badge(kind, label), el("span", { class: "harness-text", text: entry.text.slice(0, 200) })],
  });
}

function messageContentText(content: unknown): string {
  if (typeof content === "string") return content;
  return JSON.stringify(content, null, 1);
}

function renderRawMessages(snapshot: HarnessSnapshot | null): HTMLElement {
  if (!snapshot || snapshot.messages.length === 0) {
    return el("p", {
      class: "harness-empty",
      text: "살아있는 세션이 없어 원본 메시지를 볼 수 없습니다(제안 수락/거부 시 세션이 폐기됨). 타임라인(감사 로그)은 계속 남습니다.",
    });
  }
  return el("div", {
    class: "harness-raw-messages",
    children: snapshot.messages.map((message, index) => {
      const text = messageContentText(message.content);
      // 이미지 파트가 섞인 메시지는 data URL이 수 MB일 수 있어 프리뷰만 남긴다.
      const shown = text.length > 4000 ? `${text.slice(0, 4000)}\n…(총 ${text.length}자, 생략)` : text;
      return el("details", {
        class: "harness-row-details",
        children: [
          el("summary", {
            class: "harness-row-summary",
            children: [
              el("span", { class: "harness-time", text: `#${index}` }),
              badge(`role-${message.role}`, message.role),
              el("span", { class: "harness-text", text: text.slice(0, 120) }),
            ],
          }),
          el("pre", { class: "harness-row-raw", text: shown }),
        ],
      });
    }),
  });
}

function downloadHarnessJson(input: HarnessModalInput): void {
  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), snapshot: input.getSnapshot(), audit: input.audit, statusTimeline: input.statusTimeline },
    null,
    2
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ai-harness.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openHarnessModal(input: HarnessModalInput): HTMLElement {
  document.querySelector("[data-testid='ai-harness-modal']")?.remove();

  const snapshot = input.getSnapshot();
  const toolEntries = input.audit.filter((entry) => entry.kind === "tool");
  const okCount = toolEntries.filter((entry) => entry.kind === "tool" && entry.ok).length;
  const injectionCount = input.audit.filter((entry) => entry.kind === "status" && entry.text.startsWith(ORCH_AUDIT_PREFIX)).length;
  const phaseCount = input.audit.filter((entry) => entry.kind === "status" && entry.text.startsWith(PHASE_AUDIT_PREFIX)).length;
  // 토큰 합계: "출력 토큰 ~N" 꼬리표가 붙은 턴 종료 라인들을 합산한다(근사치).
  const tokenTotal = input.audit.reduce((total, entry) => {
    if (entry.kind !== "status") return total;
    const match = /출력 토큰 ~(\d+)/.exec(entry.text);
    return match ? total + Number(match[1]) : total;
  }, 0);

  const summary = el("div", {
    class: "harness-summary",
    children: [
      badge("model", `감독 ${snapshot?.model ?? "?"}`),
      ...(snapshot?.liteModel ? [badge("model", `실행 ${snapshot.liteModel}`)] : []),
      badge("stat", `툴 ✓${okCount}/✗${toolEntries.length - okCount}`),
      badge("stat", `주입 ${injectionCount}건`),
      badge("stat", `단계 전환 ${phaseCount}회`),
      ...(tokenTotal > 0 ? [badge("stat", `출력 토큰 ~${tokenTotal}`)] : []),
    ],
  });

  const timeline = el("div", {
    class: "harness-timeline",
    dataset: { testid: "ai-harness-timeline" },
    children: input.audit.length > 0
      ? input.audit.map(renderEntryRow)
      : [el("p", { class: "harness-empty", text: "아직 기록이 없습니다. 대화를 시작하면 단계 전환·주입·툴 호출이 여기에 쌓입니다." })],
  });

  const rawSection = el("details", {
    class: "harness-raw-section",
    children: [
      el("summary", { text: `원본 메시지 ${snapshot?.messages.length ?? 0}개 (시스템 프롬프트·오케스트레이션 주입 포함)` }),
      renderRawMessages(snapshot),
    ],
  });

  const downloadButton = el("button", {
    class: "ai-assistant-action",
    text: "JSON 다운로드",
    attrs: { type: "button", title: "타임라인 + 원본 메시지 스냅샷을 JSON으로 저장" },
    dataset: { testid: "ai-harness-download" },
    on: { click: () => downloadHarnessJson(input) },
  });
  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
    attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "ai-harness-close" },
  });

  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "ai-harness-modal" },
    children: [
      el("section", {
        class: "database-modal-window harness-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "AI 하네스 타임라인" },
        children: [
          el("header", {
            class: "database-modal-header harness-header",
            children: [el("h2", { text: "🔬 AI 하네스 — 내부 동작 타임라인" }), downloadButton, closeButton],
          }),
          el("p", {
            class: "harness-hint",
            text: "계획→실행→검수 전환, 오케스트레이션 주입 원문, 툴 호출 인자/결과, 토큰 사용을 시간순으로 기록합니다. 항목을 펼치면 원문이 보입니다.",
          }),
          summary,
          el("div", { class: "database-modal-body harness-body", children: [timeline, rawSection] }),
        ],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener?.("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener?.("keydown", onKeyDown);

  document.body.append(backdrop);
  return backdrop;
}
