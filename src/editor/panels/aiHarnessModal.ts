// editor/panels/aiHarnessModal.ts
// 🔬 AI 내부 로그 뷰어 — 오케스트레이션 내부 동작(단계 전환·주입 원문·툴 호출·토큰 사용)을
// 타임라인으로 보여준다. 채팅 버블은 요약본이고, 여기가 원본 관측 지점이다.
// 데이터 원천: 감사 로그(AuditEntry, 영속) + 살아있는 세션 스냅샷(주입 포함 원본 메시지).

import type { AuditEntry, HarnessSnapshot } from "@/ai/assistantSession";
import { EMPTY_SESSION_USAGE, type SessionUsageTotals } from "@/ai/sessionUsage";
import type { AiUiEvent } from "@/ai/uiEventTypes";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";

// aiChatPanel의 StatusTransition과 같은 모양 — 순환 의존을 피하려고 구조만 받는다.
interface StatusPoint {
  readonly at: string;
  readonly status: string;
}

export interface HarnessModalInput {
  readonly audit: readonly AuditEntry[];
  readonly statusTimeline: readonly StatusPoint[];
  readonly getSnapshot: () => HarnessSnapshot | null;
  /**
   * 사람이 조수 표면에서 누른 것(src/ai/uiEventLog.ts). audit 과 시간순으로 병합해 한 줄씩 흐르게
   * 한다 — 「압축을 누른 직후 턴이 깨졌다」류는 두 스트림을 따로 보면 절대 안 보인다.
   */
  readonly uiActions?: readonly AiUiEvent[];
  /** 이 세션이 실제로 태운 토큰. 없으면 배지를 그리지 않는다(0 과 미지원을 섞지 않는다). */
  readonly getUsage?: () => SessionUsageTotals;
  /** 이 턴이 만든 프로젝트 커밋 id. */
  readonly commitIds?: readonly string[];
  /** 기록이 어디까지 갔는지 — 로컬 전용이면 배지로 알린다. */
  readonly persistence?: { readonly remote: boolean; readonly diskMirror: boolean };
}

/** 타임라인 한 줄의 원천. 두 스트림을 시간순으로 병합하기 위한 판별 유니온. */
type TimelineRow =
  | { readonly at: string; readonly kind: "audit"; readonly entry: AuditEntry }
  | { readonly at: string; readonly kind: "ui"; readonly event: AiUiEvent };

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

/**
 * 프론트 액션 한 줄. 위임 수집분은 action 이 `click:<testid>` 라 그대로 읽히고, 의미 이벤트는
 * `detail` 에 결과 수치가 있으므로 그것을 접이식으로 붙인다 — 「눌렀다」와 「무엇이 바뀌었다」는
 * 다른 정보다.
 */
function renderUiActionRow(event: AiUiEvent): HTMLElement {
  const time = el("span", { class: "harness-time", text: timeLabel(event.at) });
  const head = [
    time,
    badge(event.disabled ? "ui-blocked" : "ui", event.disabled ? "손(막힘)" : "손"),
    el("code", { class: "harness-tool-name", text: event.action }),
    el("span", { class: "harness-text", text: [event.surface, event.label].filter(Boolean).join(" · ").slice(0, 120) }),
  ];
  if (!event.detail) return el("div", { class: "harness-row is-ui", children: head });
  return el("div", { class: "harness-row is-ui", children: [detailsRow(head, JSON.stringify(event.detail, null, 1))] });
}

/**
 * 두 스트림을 시간순으로 병합한다. `at` 이 없는 audit 항목(초기 상태줄 등)은 **직전 항목의 시각을
 * 물려받는다** — 빈 문자열로 정렬하면 그것들이 전부 맨 앞으로 몰려 순서가 거짓이 된다.
 */
export function mergeHarnessTimeline(
  audit: readonly AuditEntry[],
  uiActions: readonly AiUiEvent[],
): readonly TimelineRow[] {
  let carried = "";
  const auditRows: TimelineRow[] = audit.map((entry) => {
    if (entry.at) carried = entry.at;
    return { at: carried, kind: "audit", entry };
  });
  const uiRows: TimelineRow[] = uiActions.map((event) => ({ at: event.at, kind: "ui", event }));
  // 시각이 같으면 audit 를 먼저 둔다(안정 정렬) — 액션의 결과가 그 액션보다 앞서 보이지 않게 한다.
  return [...auditRows, ...uiRows]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (a.row.at === b.row.at ? a.index - b.index : a.row.at < b.row.at ? -1 : 1))
    .map(({ row }) => row);
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
    {
      exportedAt: new Date().toISOString(),
      snapshot: input.getSnapshot(),
      audit: input.audit,
      statusTimeline: input.statusTimeline,
      uiActions: input.uiActions ?? [],
      usage: input.getUsage?.() ?? null,
      commitIds: input.commitIds ?? [],
      persistence: input.persistence ?? null,
    },
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
  const uiActions = input.uiActions ?? [];
  const toolEntries = input.audit.filter((entry) => entry.kind === "tool");
  const okCount = toolEntries.filter((entry) => entry.kind === "tool" && entry.ok).length;
  const injectionCount = input.audit.filter((entry) => entry.kind === "status" && entry.text.startsWith(ORCH_AUDIT_PREFIX)).length;
  const phaseCount = input.audit.filter((entry) => entry.kind === "status" && entry.text.startsWith(PHASE_AUDIT_PREFIX)).length;
  // 토큰은 호출 지점 집계(sessionUsage)에서 온다. 예전에는 감사 로그 문자열에서
  // `/출력 토큰 ~(\d+)/` 로 긁었는데, 그 값은 출력만 세고 요약·플래너 콜을 빼먹고 문구를 한 글자
  // 고치면 조용히 0 이 됐다. 게이지는 이미 옮겼고 이 배지가 마지막 정규식이었다.
  const usage = input.getUsage?.() ?? EMPTY_SESSION_USAGE;
  const usageBadges = usage.calls > 0
    ? [
        badge("stat", `토큰 입력 ${usage.promptTokens.toLocaleString()} / 출력 ${usage.completionTokens.toLocaleString()}`),
        badge("stat", `LLM 호출 ${usage.calls}회`),
        // 미집계 호출은 "0 토큰" 과 다르다 — 합계가 과소집계임을 그 자리에서 밝힌다.
        ...(usage.callsWithoutUsage > 0 ? [badge("warn", `사용량 미보고 ${usage.callsWithoutUsage}회`)] : []),
      ]
    : [];
  const persistence = input.persistence;
  // 워크트리 19/53 이 project storage 미설정 + 디스크 미러 없음으로 아무것도 안 남기던 상태를 드러낸다.
  const persistenceBadge = persistence && !persistence.remote && !persistence.diskMirror
    ? [badge("warn", "기록 로컬 전용 — 300건 링버퍼")]
    : [];

  const summary = el("div", {
    class: "harness-summary",
    dataset: { testid: "ai-harness-summary" },
    children: [
      badge("model", `감독 ${snapshot?.model ?? "?"}`),
      ...(snapshot?.liteModel ? [badge("model", `실행 ${snapshot.liteModel}`)] : []),
      badge("stat", `툴 ✓${okCount}/✗${toolEntries.length - okCount}`),
      badge("stat", `주입 ${injectionCount}건`),
      badge("stat", `단계 전환 ${phaseCount}회`),
      ...(uiActions.length > 0 ? [badge("stat", `프론트 액션 ${uiActions.length}건`)] : []),
      ...(input.commitIds && input.commitIds.length > 0 ? [badge("stat", `커밋 ${input.commitIds.length}건`)] : []),
      ...usageBadges,
      ...persistenceBadge,
    ],
  });

  const merged = mergeHarnessTimeline(input.audit, uiActions);
  const timeline = el("div", {
    class: "harness-timeline",
    dataset: { testid: "ai-harness-timeline" },
    children: merged.length > 0
      ? merged.map((row) => (row.kind === "ui" ? renderUiActionRow(row.event) : renderEntryRow(row.entry)))
      : [el("p", { class: "harness-empty", text: "아직 기록이 없습니다. 대화를 시작하면 단계 전환·주입·툴 호출·프론트 액션이 여기에 쌓입니다." })],
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
    children: [deckIcon("x")],
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
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "AI 내부 로그" },
        children: [
          el("header", {
            class: "database-modal-header harness-header",
            children: [el("h2", { text: "AI 내부 로그" }), downloadButton, closeButton],
          }),
          el("p", {
            class: "harness-hint",
            text: "계획→실행→검수 전환, 시스템 주입 원문, 툴 호출 인자/결과, 토큰 사용을 시간순으로 기록합니다. 항목을 펼치면 원문이 보입니다. (개발·디버그용)",
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
