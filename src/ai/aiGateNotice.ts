// ai/aiGateNotice.ts
// 「AI 변경이 게이트에 막혔다」를 사용자에게 보여줄 알림 한 장으로 옮기는 순수 모듈(DOM 금지).
//
// 왜 필요한가 (2026-08-30 실측) — AI 가 만든 변경을 적용 직전에 되돌리는 차단 게이트가 네 곳
// 있는데, 사용자에게 남는 흔적이 게이트마다 달랐다:
//   1. 배치 검증(layoutValidationBlocking)  — 시스템 버블 + 토스트
//   2. 무결성 커밋 게이트(commitChangeset)   — **토스트 한 장뿐**, 채팅에는 아무 기록도 없음
//   3. 툴 실행/턴 오류                       — 오류 버블(재시도 링크)
//   4. 이벤트 명령 AI 반려                   — 도크 안 한 줄 상태 텍스트
// 2번은 토스트가 사라지면 흔적이 없어서, 사용자 입장에서 "AI 가 아무것도 안 했다" 와 구분되지
// 않았다("이벤트 지워달라니까 왜 안 되냐"의 실제 경험). 그래서 차단 게이트는 전부 모달로 올린다.
//
// 이 모듈은 **무엇을 보여줄지**만 정한다. 그리기는 editor/ui/aiGateModal.ts 가 한다.
// 사유는 요약하지 않고 게이트가 내놓은 것을 그대로 싣는다 — 첫 줄만 남기고 버리면 원인이 사라진다.

import type { LintIssue } from "@/project/lint/projectLint";

export type AiGateKind =
  /** 배치 검증(물/벽 위 소품, 수관 밑동 누락 등)이 적용을 막았다. */
  | "layout-validation"
  /** 무결성 커밋 게이트가 이 변경이 **새로 만든** 오류를 잡아 적용을 막았다. */
  | "commit-rejected"
  /** 툴 실행이 실패해 턴이 끝났고, 적용된 변경은 0건이다. */
  | "turn-error"
  /** 이벤트 편집기의 명령 AI 가 초안을 만들지 못했다. */
  | "event-command-assist";

export interface AiGateNotice {
  readonly kind: AiGateKind;
  readonly title: string;
  /** 무엇이 막혔는지 한 문장. */
  readonly headline: string;
  /** 게이트가 내놓은 사유 전량(표시 상한까지). */
  readonly reasons: readonly string[];
  /** 사용자가 다음에 할 수 있는 것. */
  readonly nextSteps: readonly string[];
  /** 접어두는 기술 원문(검증기 메시지 등). 없으면 생략. */
  readonly detail?: string;
}

/** 모달에 나열하는 사유 상한. 넘치면 마지막 줄에 남은 건수를 적는다. */
export const MAX_GATE_REASONS = 8;

function clampReasons(messages: readonly string[]): readonly string[] {
  // 같은 문장이 맵마다 반복되면 화면만 밀린다 — 순서는 유지하고 중복만 접는다.
  const unique = [...new Set(messages.map((message) => message.trim()).filter((message) => message.length > 0))];
  if (unique.length <= MAX_GATE_REASONS) return unique;
  const shown = unique.slice(0, MAX_GATE_REASONS - 1);
  return [...shown, `…외 ${unique.length - shown.length}건`];
}

function issueLine(issue: LintIssue): string {
  const where = issue.mapId
    ? `[${issue.mapId}${typeof issue.x === "number" && typeof issue.y === "number" ? ` (${issue.x}, ${issue.y})` : ""}] `
    : "";
  return `${where}${issue.message}`;
}

/** 배치 검증 차단 — 타일/소품이 놓일 수 없는 자리에 놓였다. */
export function layoutGateNotice(issues: readonly LintIssue[]): AiGateNotice {
  const blocking = issues.filter((issue) => issue.severity === "error");
  // 경고만 남은 배열이 들어오는 경우는 차단이 아니다. 그래도 호출부가 부르면 사유는 보여준다.
  const source = blocking.length > 0 ? blocking : issues;
  return {
    kind: "layout-validation",
    title: "배치 검증에 막혔습니다",
    headline: "AI 변경안이 놓을 수 없는 자리에 타일·소품을 두어, 프로젝트에 아무것도 적용하지 않았습니다.",
    reasons: clampReasons(source.map(issueLine)),
    nextSteps: [
      "어디에 놓을지(맵·좌표·영역)를 문장에 적어 다시 요청해 보세요.",
      "물 위·벽 위처럼 원래 놓을 수 없는 자리라면, 먼저 그 자리의 지형을 바꿔야 합니다.",
    ],
  };
}

/** 무결성 커밋 게이트 차단 — 이 변경이 새 오류를 만들었다. */
export function commitGateNotice(blockingMessages: readonly string[]): AiGateNotice {
  const reasons = clampReasons(blockingMessages);
  return {
    kind: "commit-rejected",
    title: "무결성 검사에 막혔습니다",
    headline:
      "AI 변경안이 프로젝트를 깨뜨리는 오류를 새로 만들어, 저장소에는 아무것도 반영하지 않았습니다(되돌릴 것도 없습니다).",
    reasons: reasons.length > 0 ? reasons : ["무결성 오류(사유를 확인할 수 없습니다)"],
    nextSteps: [
      "요청을 더 좁게 나눠(한 맵·한 이벤트씩) 다시 시켜 보세요.",
      "지우기 요청이었다면, 그 대상을 가리키는 다른 이벤트·명령이 남아 있는지 확인하세요.",
    ],
  };
}

/** 툴 실행/턴 오류로 적용이 0건이 된 경우. */
export function turnErrorNotice(input: {
  readonly message: string;
  readonly toolNames?: readonly string[];
}): AiGateNotice {
  const tools = [...new Set((input.toolNames ?? []).filter((name) => name.length > 0))];
  const reasons = clampReasons([
    input.message,
    ...(tools.length > 0 ? [`실행한 도구: ${tools.join(", ")}`] : []),
  ]);
  const notFound = /찾을 수 없|not[- ]found/iu.test(input.message);
  return {
    kind: "turn-error",
    title: "AI 작업이 오류로 끝났습니다",
    headline: "이번 요청은 도중에 실패했고, 프로젝트에 적용된 변경은 0건입니다.",
    reasons,
    nextSteps: notFound
      ? [
        "대상을 맵에서 먼저 클릭해 고른 다음 다시 말해 보세요 — AI 가 어느 것인지 특정하지 못했습니다.",
        "이름 대신 «맵 이름 + 좌표»로 지목하면 더 잘 찾습니다.",
      ]
      : [
        "같은 문장으로 한 번 더 시도해 보세요 — 일시적인 실패일 수 있습니다.",
        "계속 같은 오류가 나오면 요청을 더 작게 쪼개 보세요.",
      ],
    detail: input.message,
  };
}

/** 이벤트 편집기 명령 AI 반려. append scope 는 «지우기·고치기» 자체가 표현 불가다. */
export function eventCommandGateNotice(input: {
  readonly message: string;
  readonly scope: "page" | "append";
  readonly commandCount: number;
}): AiGateNotice {
  const appendScope = input.scope === "append";
  const reasons = clampReasons([
    input.message,
    ...(appendScope
      ? [
        `이 페이지는 명령이 ${input.commandCount}개로 너무 길어, AI 에게 목록 전체를 보여주지 못했습니다.`
        + " 그래서 이번 요청은 «뒤에 새로 붙이기»만 할 수 있고, 지우기·고치기·순서 바꾸기는 표현할 수 없습니다.",
      ]
      : []),
  ]);
  return {
    kind: "event-command-assist",
    title: "명령 초안을 만들지 못했습니다",
    headline: appendScope
      ? "페이지가 길어 AI 는 명령을 «뒤에 붙이는» 것만 할 수 있고, 이번 요청은 그걸로 표현되지 않았습니다."
      : "AI 가 요청에 맞는 명령 목록을 만들지 못했습니다. 명령 목록은 그대로입니다.",
    reasons,
    nextSteps: appendScope
      ? [
        "지울 명령을 목록에서 직접 고른 뒤 도구막대의 지우기를 쓰세요.",
        "페이지를 둘로 나누면(명령 수를 줄이면) AI 가 목록을 고치는 방식으로 돌아옵니다.",
      ]
      : [
        "무엇을 어떻게 바꿀지 한 문장으로 더 구체적으로 적어 보세요.",
        "고칠 명령을 목록에서 먼저 고르면 AI 가 «이거»를 그 명령으로 읽습니다.",
      ],
    detail: input.message,
  };
}

/** 모달의 «사유 복사» 가 클립보드에 넣는 평문. 버그 신고에 그대로 붙일 수 있게 만든다. */
export function aiGateNoticeToPlainText(notice: AiGateNotice): string {
  const lines = [`[${notice.kind}] ${notice.title}`, notice.headline, "", "막힌 이유:"];
  lines.push(...notice.reasons.map((reason) => `- ${reason}`));
  lines.push("", "이렇게 해 보세요:");
  lines.push(...notice.nextSteps.map((step) => `- ${step}`));
  if (notice.detail && notice.detail !== notice.reasons[0]) {
    lines.push("", "원문:", notice.detail);
  }
  return lines.join("\n");
}
