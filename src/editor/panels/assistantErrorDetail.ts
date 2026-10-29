import { serializeTrappedErrors } from "@/app/errorTrap";
import { createLogger, serializeLogEntries } from "@/util/logger";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const log = createLogger("assistant-error");

export type AssistantErrorDetailInput = {
  readonly message: string;
  /** Stack dump from `formatThrownDiagnostic`, when the throw site still had the Error. */
  readonly thrown?: string;
  readonly request?: string;
};

function section(title: string, body: string): string {
  const text = body.trim();
  return `## ${title}\n${text === "" ? "(없음)" : text}`;
}

/** Snapshot logs at the moment the bubble is mounted, then keep that text for copy. */
export function composeAssistantErrorReport(input: AssistantErrorDetailInput): string {
  log.error(input.message);
  const logs = serializeLogEntries({ limit: 80 });
  const trapped = serializeTrappedErrors({ limit: 20, excludeResource: true });
  const lines = [
    "AI 조수 오류",
    `메시지: ${input.message}`,
  ];
  if (input.request && input.request.trim() !== "") lines.push(`요청: ${input.request}`);
  lines.push(
    "",
    section("예외", input.thrown ?? "(이 경로는 메시지 문자열만 남겼습니다. 스택은 아래 로그·트랩을 보세요.)"),
    "",
    section("최근 로그 (최신 80건)", logs),
    "",
    section("최근 예외 트랩 (리소스 404 제외, 최신 20건)", trapped),
  );
  return lines.join("\n");
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to a selectable textarea */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** "자세히 보기" opens a selectable <pre>; "복사" puts that same text on the clipboard. */
export function mountAssistantErrorDetail(bubble: HTMLElement, input: AssistantErrorDetailInput): void {
  const report = composeAssistantErrorReport(input);
  const pre = el("pre", {
    class: "ai-error-detail",
    text: report,
    attrs: { hidden: "" },
    dataset: { testid: "ai-error-detail" },
  });
  const toggle = el("button", {
    class: "ai-assistant-action ai-error-detail-toggle",
    text: "자세히 보기",
    attrs: { type: "button", "aria-expanded": "false", title: "오류 스택과 최근 로그를 엽니다. 본문은 선택할 수 있습니다." },
    dataset: { testid: "ai-error-detail-toggle" },
    on: {
      click: () => {
        const open = pre.hidden;
        pre.hidden = !open;
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "자세히 접기" : "자세히 보기";
      },
    },
  });
  const copy = el("button", {
    class: "ai-assistant-action ai-error-detail-copy",
    text: "복사",
    attrs: { type: "button", title: "진단 로그 전체를 클립보드에 복사합니다" },
    dataset: { testid: "ai-error-detail-copy" },
    on: {
      click: () => {
        void copyText(report).then((ok) => {
          toast(ok ? "오류 로그를 복사했습니다." : "복사에 실패했습니다. 펼친 본문을 직접 선택하세요.", ok ? "ok" : "error");
        });
      },
    },
  });
  bubble.append(el("div", { class: "ai-retry-row ai-error-detail-row", children: [toggle, copy] }), pre);
}

export type AiFailureKind = "quota" | "auth" | "network" | "other";

export type AiFailureSummary = {
  readonly kind: AiFailureKind;
  /** 사람이 읽는 한두 문장. 원시 JSON·서버 원문은 넣지 않는다. */
  readonly summary: string;
  /** 접힌 「원문」에만 보이는 서버 응답. 사람 문장과 같으면 null. */
  readonly raw: string | null;
};

const QUOTA = /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit|한도/i;
const AUTH = /\b40[13]\b|unauthori[sz]ed|forbidden|로그인|인증/i;
const NETWORK = /failed to fetch|network|ECONN|ETIMEDOUT|\b50[0-4]\b|닿지 못|timeout|시간 초과/i;

/** 「Resets in 67h25m0s」·「retry after 30s」 같은 꼬리에서 남은 시간을 초로 읽는다. */
export function parseResetSeconds(raw: string): number | null {
  const reset = /resets?\s+in\s+((?:\d+\s*[dhms]\s*)+)/i.exec(raw) ?? /retry\s+after\s+((?:\d+\s*[dhms]?\s*)+)/i.exec(raw);
  if (!reset) return null;
  let seconds = 0;
  let matched = false;
  for (const part of reset[1].matchAll(/(\d+)\s*([dhms]?)/gi)) {
    matched = true;
    const value = Number(part[1]);
    const unit = part[2].toLowerCase();
    seconds += unit === "d" ? value * 86400 : unit === "h" ? value * 3600 : unit === "m" ? value * 60 : value;
  }
  return matched && seconds > 0 ? seconds : null;
}

/** 「약 2일 19시간」 — 큰 단위 둘까지만. */
export function formatWaitKo(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.max(1, Math.round((seconds % 3600) / 60));
  if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  if (hours > 0) return `${hours}시간 ${minutes % 60 === 0 ? "" : `${minutes % 60}분`}`.trim();
  return `${minutes}분`;
}

/**
 * 공급자 오류 문자열을 사람 문장으로 바꾼다(C-73). 예전 말풍선은 「요청 한도 초과(429): 잠시 후 다시
 * 시도하세요. — {"error":"Cloud Code Assist API error (429): …Resets in 67h25m0s…"}」처럼 이스케이프된 JSON 과
 * 영어 원문을 그대로 붙였고, 「잠시 후」가 같은 줄의 67시간과 모순됐다. 원문은 접힌 상세에만 둔다.
 */
export function describeAiFailure(reason: string, now: Date = new Date()): AiFailureSummary {
  const raw = reason.trim();
  const kind: AiFailureKind = QUOTA.test(raw) ? "quota" : AUTH.test(raw) ? "auth" : NETWORK.test(raw) ? "network" : "other";
  if (kind === "quota") {
    const wait = parseResetSeconds(raw);
    const when = wait === null ? null : new Date(now.getTime() + wait * 1000);
    const at = when ? `${when.getMonth() + 1}월 ${when.getDate()}일 ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}` : "";
    const summary = wait === null
      ? "이 AI 계정의 사용 한도에 닿았습니다. 한도가 풀린 뒤 다시 시도하거나 AI 설정에서 다른 연결을 고르세요."
      : `이 AI 계정의 사용 한도에 닿았습니다. 약 ${formatWaitKo(wait)} 뒤(${at}쯤) 다시 쓸 수 있습니다. 지금 쓰려면 AI 설정에서 다른 연결을 고르세요.`;
    return { kind, summary, raw };
  }
  if (kind === "auth") return { kind, summary: "AI 연결이 끊겼습니다. AI 설정에서 다시 로그인한 뒤 다시 시도하세요.", raw };
  if (kind === "network") return { kind, summary: "AI 연결 서비스에 닿지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.", raw };
  // 사람 문장 부분만 남긴다 — JSON 이 시작되기 전까지, 구분자 「 — 」 앞까지.
  const human = raw.split(/\s+—\s+|\{/u)[0]!.trim().replace(/[:：]\s*$/u, "");
  const summary = human && !/[{}]/u.test(human) ? human : "요청을 처리하지 못했습니다. 다시 시도하세요.";
  return { kind, summary, raw: summary === raw ? null : raw };
}

/** 실패 말풍선에 「다시 시도」·「AI 설정 열기」와 접힌 원문을 붙인다. 원문은 펼치기 전에는 보이지 않는다. */
export function mountAiFailureActions(
  bubble: HTMLElement,
  input: { readonly failure: AiFailureSummary; readonly onRetry: () => void; readonly onOpenSettings: () => void },
): void {
  const retry = el("button", {
    class: "ai-assistant-action is-primary ai-failure-retry",
    text: "다시 시도",
    attrs: { type: "button" },
    dataset: { testid: "ai-failure-retry" },
    on: { click: () => input.onRetry() },
  });
  const settings = el("button", {
    class: "ai-assistant-action ai-failure-open-settings",
    text: "AI 설정 열기",
    attrs: { type: "button" },
    dataset: { testid: "ai-failure-open-settings" },
    on: { click: () => input.onOpenSettings() },
  });
  bubble.dataset.failureKind = input.failure.kind;
  bubble.append(el("div", { class: "ai-retry-row ai-failure-actions", children: [retry, settings] }));
  if (input.failure.raw) {
    bubble.append(el("details", {
      class: "ai-failure-raw",
      dataset: { testid: "ai-failure-raw" },
      children: [
        el("summary", { text: "서버가 보낸 원문" }),
        el("pre", { class: "ai-error-detail", text: input.failure.raw }),
      ],
    }));
  }
}
