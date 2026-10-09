// 인스펙터 제목/힌트용 요약. commandSummary 는 리스트 줄 계약이라 선택지 옵션·취소까지
// 전부 나열하는데, 인스펙터 카드에서는 그게 제목을 밀어낸다. 선택지 명령만 프롬프트
// 한 줄(없으면 개수)로 압축하고, 나머지 종류는 기존 요약을 그대로 쓴다.

import type { Command } from "@/project/types";
import { commandSummary } from "./commandSummary";

/**
 * 인스펙터 상단 `.event-inspector-title` 과 카드 `.event-inspector-card-hint` 가
 * 공유하는 제목. 선택지면 프롬프트만, 아니면 commandSummary 와 동일하다.
 */
export function inspectorTitle(command: Command): string {
  if (command.kind === "choices") {
    const prompt = oneLine(command.prompt ?? "");
    return prompt.length > 0 ? prompt : `선택지 ${command.options.length}개`;
  }
  try {
    return commandSummary(command);
  } catch {
    return command.kind;
  }
}

// commandSummary 의 oneLine 과 동일 규약(공백 접기 + 80자 말줄임). 선택지만 쓰므로
// 리스트 쪽 헬퍼를 import 하지 않고 여기에 둔다.
function oneLine(value: string): string {
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length <= 80) return t;
  return `${t.slice(0, 78).trimEnd()}…`;
}
