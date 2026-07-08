// evals/goldenTask.ts
// 골든 태스크 정의 + 스펙 매처. 자동 채점 = projectLint + 스펙 매처(+ 선택적 도달성).
// 러너는 Phase 1 헤드리스 툴 실행기 위에서 동작하며, 실제 LLM 호출은 llmSolver로 주입한다.

import { projectLint } from "@/project/lint/projectLint";
import type { ReachabilitySpec } from "@/project/lint/reachability";
import type { Command, GameEvent, Project } from "@/project/types";
import { questDefId } from "@/project/quest/questDef";

// 최종 프로젝트가 만족해야 할 사양 하나.
export interface SpecMatcher {
  readonly describe: string;
  check(project: Project): boolean;
}

export interface GoldenTask {
  readonly id: string;
  readonly prompt: string; // LLM에게 줄 자연어 지시.
  initialProject(): Project;
  readonly matchers: readonly SpecMatcher[];
  readonly reachability?: readonly ReachabilitySpec[];
}

export interface EvalScore {
  readonly taskId: string;
  readonly passed: boolean;
  readonly score: number; // 0~1
  readonly lintErrors: number;
  readonly matcherResults: readonly { readonly describe: string; readonly passed: boolean }[];
  readonly reachabilityPassed: boolean;
}

// 최종 프로젝트를 채점한다: lint 0 error + 전 매처 통과 + (있으면) 도달성.
export function scoreProject(project: Project, task: GoldenTask): EvalScore {
  const issues = projectLint(project, { reachability: task.reachability });
  const lintErrors = issues.filter((issue) => issue.severity === "error").length;
  const reachabilityIssues = issues.filter((issue) => issue.code === "reachability").length;
  const reachabilityPassed = reachabilityIssues === 0;
  const matcherResults = task.matchers.map((matcher) => ({ describe: matcher.describe, passed: safeCheck(matcher, project) }));

  const checks = [lintErrors === 0, reachabilityPassed, ...matcherResults.map((result) => result.passed)];
  const score = checks.filter(Boolean).length / checks.length;
  const passed = lintErrors === 0 && reachabilityPassed && matcherResults.every((result) => result.passed);
  return { taskId: task.id, passed, score, lintErrors, matcherResults, reachabilityPassed };
}

function safeCheck(matcher: SpecMatcher, project: Project): boolean {
  try {
    return matcher.check(project);
  } catch {
    return false;
  }
}

// --- 매처 빌더(골든 태스크 작성 편의) ---

export function mapCountAtLeast(n: number): SpecMatcher {
  return { describe: `맵이 ${n}개 이상`, check: (project) => Object.keys(project.maps).length >= n };
}

export function switchNamed(id: string): SpecMatcher {
  return { describe: `스위치 ${id} 명명됨`, check: (project) => project.switches.some((def) => def.id === id && def.name !== "") };
}

export function itemExists(id: string): SpecMatcher {
  return { describe: `아이템 ${id} 존재`, check: (project) => project.database.items.some((item) => item.id === id) };
}

export function troopExists(id: string): SpecMatcher {
  return { describe: `트룹 ${id} 존재`, check: (project) => project.database.troops.some((troop) => troop.id === id) };
}

export function questExists(key: string): SpecMatcher {
  return { describe: `퀘스트 ${key} 존재`, check: (project) => (project.quests ?? []).some((quest) => questDefId(quest) === key) };
}

// 어떤 맵에든 특정 kind의 커맨드를 가진 이벤트가 존재하는지.
export function hasEventWithCommand(commandKind: Command["kind"]): SpecMatcher {
  return {
    describe: `${commandKind} 커맨드를 가진 이벤트 존재`,
    check: (project) => Object.values(project.maps).some((map) => map.events.some((event) => eventHasCommand(event, commandKind))),
  };
}

function eventHasCommand(event: GameEvent, kind: Command["kind"]): boolean {
  const found = { hit: false };
  const walk = (commands: readonly Command[]): void => {
    for (const command of commands) {
      if (command.kind === kind) found.hit = true;
      if (command.kind === "choices") {
        for (const option of command.options) walk(option.branch);
        if (command.cancelBranch) walk(command.cancelBranch);
      } else if (command.kind === "fork") {
        walk(command.then);
        if (command.else) walk(command.else);
      } else if (command.kind === "loop") {
        walk(command.body);
      }
    }
  };
  walk(event.commands);
  for (const page of event.pages ?? []) walk(page.commands);
  return found.hit;
}

export function custom(describe: string, check: (project: Project) => boolean): SpecMatcher {
  return { describe, check };
}
