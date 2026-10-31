// editor/script/scriptUnwrapAdapter.ts — the event editor's view of "명령으로 풀기" (script → event commands).
// One place decides whether the button is enabled and what the disabled reason says. The converter itself is
// scriptToEvent.ts (exact subset, behavior-preserving); this only adapts its result for the script card.
import type { Command, Project } from "@/project/types";
import { scriptToCommands, scriptUnwrapProblemText } from "./scriptToEvent";
import { scriptCompilerReady } from "./tsEnv";

export type ScriptUnwrapState =
  | { readonly status: "ok"; readonly commands: Command[] }
  /** reason = fixed Korean literal per problem code (the DOM i18n catalog translates it); line = first problem, 1-based. */
  | { readonly status: "blocked"; readonly reason: string; readonly line?: number; readonly problems: number }
  | { readonly status: "unavailable"; readonly reason: string };

const cache = new Map<string, ScriptUnwrapState>();

export function unwrapScriptForEditor(source: string, project: Project): ScriptUnwrapState {
  if (!source.trim()) return { status: "blocked", reason: "빈 스크립트입니다.", problems: 1 };
  if (!scriptCompilerReady()) return { status: "unavailable", reason: "불러오는 중…" };
  const hit = cache.get(source);
  if (hit && hit.status !== "ok") return hit;
  let state: ScriptUnwrapState;
  try {
    const result = scriptToCommands(source, { project });
    if (result.ok) {
      state = result.commands.length ? { status: "ok", commands: result.commands } : { status: "blocked", reason: "풀어 낼 명령이 없습니다.", problems: 1 };
    } else {
      const first = result.problems[0];
      state = first
        ? { status: "blocked", reason: scriptUnwrapProblemText(first, "ko"), line: first.line, problems: result.problems.length }
        : { status: "blocked", reason: "명령으로 바꿀 수 없는 문장입니다", problems: 1 };
    }
  } catch {
    state = { status: "blocked", reason: "명령으로 바꿀 수 없는 문장입니다", problems: 1 };
  }
  // ok results carry commands that callers mutate/clone, so only the (string-only) blocked states are cached.
  if (state.status !== "ok") {
    if (cache.size > 32) cache.clear();
    cache.set(source, state);
  }
  return state;
}
