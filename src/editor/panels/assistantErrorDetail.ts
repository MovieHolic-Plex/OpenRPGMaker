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
