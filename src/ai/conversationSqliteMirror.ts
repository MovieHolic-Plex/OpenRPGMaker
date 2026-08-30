// 대화 감사 항목의 **실시간** 로컬 미러(dev SQLite). 이중 기록의 앞쪽 절반이다.
//
//   SQLite  : 감사 항목이 생기는 즉시 1건 append (이 파일)
//   Supabase: 턴이 끝날 때 대화 전체 upsert (conversationStore.saveConversation)
//
// 왜 필요한가(실측): Supabase 저장은 턴 종료 `finally` 한 곳에서만 일어나고 localStorage 는 50건
// 링버퍼다. 그래서 응답 대기·스트리밍 중에 새로고침하거나 탭을 닫으면 그 턴의 사용자 지시가
// 어디에도 남지 않았다. 지금은 사용자가 엔터를 누른 그 순간 로컬 DB 에 한 줄이 들어간다.
//
// 미러 상태 기계는 활동 로그 미러(activityLog.ts)와 같은 이유로 같은 모양이다 — `import.meta.env.DEV`
// 같은 정적 가드는 프로덕션 빌드에서 POST 를 함수째로 tree-shake 해 미러를 무증상으로 죽였다.
// 그래서 한 번 찔러보고 실패하면 끄고, 실패는 반드시 한 번 경고한다.

import type { AuditEntry } from "@/ai/assistantSession";
import { AI_CONVERSATION_DISK_ENDPOINT } from "@/ai/conversationMirrorEndpoint";
import { genId } from "@/util/id";

/** fetch keepalive 는 64 KiB 상한이다. 큰 툴 감사 항목은 일반 요청으로 보낸다. */
const MAX_KEEPALIVE_BYTES = 60 * 1024;

export interface ConversationMirrorInput {
  readonly conversationId: string;
  readonly entry: AuditEntry;
  readonly projectContextKey?: string;
  readonly model?: string;
}

export interface ConversationMirrorBody {
  readonly conversationId: string;
  readonly entryId: string;
  readonly at: string;
  readonly kind: AuditEntry["kind"];
  readonly text: string;
  readonly toolName?: string;
  readonly projectContextKey?: string;
  readonly model?: string;
  readonly payload: AuditEntry;
}

/** 항목 종류별 표시 텍스트 — 툴 항목은 summary 가 사람이 읽는 줄이다. */
function entryText(entry: AuditEntry): string {
  return entry.kind === "tool" ? entry.summary : entry.text;
}

export function buildConversationMirrorRequest(input: ConversationMirrorInput): {
  readonly body: string;
  readonly keepalive: boolean;
  readonly payload: ConversationMirrorBody;
} {
  const payload: ConversationMirrorBody = {
    conversationId: input.conversationId,
    entryId: genId("ent"),
    at: input.entry.at ?? new Date().toISOString(),
    kind: input.entry.kind,
    text: entryText(input.entry),
    ...(input.entry.kind === "tool" ? { toolName: input.entry.name } : {}),
    ...(input.projectContextKey ? { projectContextKey: input.projectContextKey } : {}),
    ...(input.model ? { model: input.model } : {}),
    payload: input.entry,
  };
  const body = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(body).byteLength;
  return { body, keepalive: bytes <= MAX_KEEPALIVE_BYTES, payload };
}

type MirrorState = "unknown" | "enabled" | "disabled";

function initialMirrorState(): MirrorState {
  const flag = import.meta.env.VITE_AI_CONVERSATION_SQLITE_MIRROR;
  if (flag === "0" || flag === "false") return "disabled";
  if (flag === "1" || flag === "true") return "enabled";
  return "unknown";
}

let mirrorState: MirrorState = initialMirrorState();
let mirrorWarned = false;

function warnMirrorFailure(reason: string): void {
  if (mirrorWarned) return;
  mirrorWarned = true;
  console.warn(
    `[ai-conversation] SQLite 미러 실패 (${AI_CONVERSATION_DISK_ENDPOINT}: ${reason}) — output/ai-conversations.sqlite 가 갱신되지 않는다.`,
  );
}

function disableMirror(reason: string): void {
  if (mirrorState !== "enabled") mirrorState = "disabled";
  warnMirrorFailure(reason);
}

/** 테스트용 상태 초기화 — 한 테스트의 실패가 다음 테스트의 미러를 꺼 두지 않게 한다. */
export function _resetConversationMirrorStateForTest(): void {
  mirrorState = initialMirrorState();
  mirrorWarned = false;
}

/**
 * 감사 항목 1건을 로컬 DB 로 보낸다. 대화 흐름을 막지 않는 fire-and-forget 이며 절대 throw 하지
 * 않는다(이 경로의 실패가 사용자 턴을 깨서는 안 된다).
 */
export function mirrorConversationEntry(input: ConversationMirrorInput): void {
  if (mirrorState === "disabled" || typeof fetch === "undefined") return;
  const request = buildConversationMirrorRequest(input);
  void (async () => {
    try {
      const res = await fetch(AI_CONVERSATION_DISK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: request.body,
        keepalive: request.keepalive,
      });
      if (res.ok) {
        mirrorState = "enabled";
        return;
      }
      disableMirror(`${res.status} ${res.statusText}`);
    } catch (error) {
      disableMirror(error instanceof Error ? error.message : String(error));
    }
  })();
}
