// 사용자 정의 팀 명세. 팀원 = 이름 + 종류(시공/검수) + 프롬프트 + 툴 범위 + 턴 상한 (+ 모델).
// 코딩 하네스의 에이전트 정의처럼 사용자가 팀원을 추가·수정하고, 팀장은 이 목록에서 골라 배정한다.
// 순수 모듈 — 저장은 teamSpecStore, 실행은 scripts/lib/piTeamRuntime.ts.

import type { Project } from "@/project/types";
import { buildPiAgentSystemPrompt, describeScopedMaps } from "./systemPrompt";

export type PiTeamMemberKind = "builder" | "reviewer";

export interface PiTeamMember {
  /** 안정된 식별자(영문·숫자·-_). 팀장이 assign_map_agent 의 member 로 부른다. */
  readonly id: string;
  readonly label: string;
  readonly kind: PiTeamMemberKind;
  /** 팀장이 배정할 때 참고하는 한 줄 소개. */
  readonly summary: string;
  /** 역할 프롬프트. 범위·절차 문장은 런타임이 앞에 붙인다. */
  readonly prompt: string;
  /** 노출 툴 도메인. 비우면 전부(검수는 그중 읽기 툴만). */
  readonly toolDomains: readonly string[];
  readonly maxTurns: number;
  /** 비우면 세션 모델. */
  readonly model?: string;
  readonly enabled: boolean;
}

export interface PiTeamSpec {
  readonly version: 1;
  /** 팀장 프롬프트에 덧붙일 사용자 지침(선택). */
  readonly orchestratorNotes: string;
  readonly members: readonly PiTeamMember[];
}

export const TEAM_TOOL_DOMAINS = ["core", "tile", "map", "event", "database", "system", "world", "quest", "battle"] as const;

export const DEFAULT_TEAM_MEMBERS: readonly PiTeamMember[] = [
  {
    id: "builder",
    label: "맵 만들기",
    kind: "builder",
    summary: "집과 길을 만들고 지형을 다듬어요.",
    prompt: "너는 팀의 시공 에이전트다. 팀장이 준 작업만 하고, 끝나면 무엇을 어디에 만들었는지 좌표와 함께 한두 문장으로 보고한다.",
    toolDomains: [],
    maxTurns: 40,
    enabled: true,
  },
  {
    id: "decorator",
    label: "맵 꾸미기",
    kind: "builder",
    summary: "기존 건물과 길을 유지하며 나무와 소품을 더해요.",
    prompt: "너는 팀의 장식 에이전트다. 이미 지어진 집과 길은 그대로 두고, 빈 땅에 소품·나무·꽃·울타리로 생활감을 더한다. 통행로를 막지 않는다. 끝나면 무엇을 어디에 놓았는지 보고한다.",
    toolDomains: ["core", "tile", "map"],
    maxTurns: 30,
    enabled: false,
  },
  {
    id: "reviewer",
    label: "결과 확인",
    kind: "reviewer",
    summary: "직접 바꾸지 않고, 잘 만들어졌는지 확인해요.",
    prompt: "get_map_region 과 run_lint(reachability 포함)로 작업 결과를 확인한다: 요청한 구조물이 실제로 있는가, 길이 이어지는가, 집과 길이 겹치지 않는가, lint error 가 없는가.",
    toolDomains: [],
    maxTurns: 10,
    enabled: true,
  },
];

export function defaultTeamSpec(): PiTeamSpec {
  return { version: 1, orchestratorNotes: "", members: DEFAULT_TEAM_MEMBERS.map((member) => ({ ...member, toolDomains: [...member.toolDomains] })) };
}

const ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export function slugifyMemberId(label: string, taken: ReadonlySet<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "member";
  const seed = /^[a-z]/.test(base) ? base : `m-${base}`;
  let candidate = seed;
  let n = 2;
  while (taken.has(candidate)) candidate = `${seed}-${n++}`;
  return candidate;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** 저장된 JSON 을 명세로 정규화한다. 깨진 항목은 버리고, 팀원이 하나도 없으면 기본 팀으로 돌아간다. */
export function normalizeTeamSpec(raw: unknown): PiTeamSpec {
  if (!raw || typeof raw !== "object") return defaultTeamSpec();
  const rec = raw as { members?: unknown; orchestratorNotes?: unknown };
  const seen = new Set<string>();
  const members: PiTeamMember[] = [];
  for (const item of Array.isArray(rec.members) ? rec.members : []) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const kind: PiTeamMemberKind = m.kind === "reviewer" ? "reviewer" : "builder";
    const label = str(m.label).trim().slice(0, 24);
    if (!label) continue;
    let id = str(m.id).trim();
    // 중복 id 는 원래 id 에서 번호를 붙이고, 형식이 틀린 id 는 이름으로 새로 만든다.
    if (!ID_PATTERN.test(id)) id = slugifyMemberId(label, seen);
    else if (seen.has(id)) id = slugifyMemberId(id, seen);
    seen.add(id);
    const domains = Array.isArray(m.toolDomains) ? m.toolDomains.filter((d): d is string => typeof d === "string" && (TEAM_TOOL_DOMAINS as readonly string[]).includes(d)) : [];
    const maxTurns = Number(m.maxTurns);
    members.push({
      id,
      label,
      kind,
      summary: str(m.summary).trim().slice(0, 200),
      prompt: str(m.prompt).trim().slice(0, 4000),
      toolDomains: domains,
      maxTurns: Number.isFinite(maxTurns) && maxTurns >= 1 ? Math.min(120, Math.round(maxTurns)) : kind === "reviewer" ? 10 : 40,
      ...(str(m.model).trim() ? { model: str(m.model).trim() } : {}),
      enabled: m.enabled !== false,
    });
  }
  if (members.length === 0) return defaultTeamSpec();
  return { version: 1, orchestratorNotes: str(rec.orchestratorNotes).slice(0, 2000), members };
}

export function enabledMembers(spec: PiTeamSpec, kind?: PiTeamMemberKind): PiTeamMember[] {
  return spec.members.filter((member) => member.enabled && (!kind || member.kind === kind));
}

/** 팀장이 배정 툴에서 참고하는 팀원 목록 문장. */
export function describeTeamMembers(spec: PiTeamSpec): string[] {
  const builders = enabledMembers(spec, "builder");
  const reviewers = enabledMembers(spec, "reviewer");
  return [
    `시공 팀원(assign_map_agent 의 member): ${builders.map((m) => `${m.id}「${m.label}」 — ${m.summary || m.prompt.slice(0, 60)}`).join(" / ") || "(없음)"}`,
    `검수 팀원(review_map 의 member): ${reviewers.map((m) => `${m.id}「${m.label}」 — ${m.summary || m.prompt.slice(0, 60)}`).join(" / ") || "(없음 — 검수 생략)"}`,
  ];
}

/** 팀원의 시스템 프롬프트 = 범위·절차(공통) + 팀원 프롬프트. */
export function memberSystemPrompt(member: PiTeamMember, project: Project, mapIds: readonly string[]): string[] {
  if (member.kind === "reviewer") {
    return [
      `너는 팀의 검수 에이전트「${member.label}」다. 읽기 도구만 있다. 아무것도 고치지 않는다.`,
      ...describeScopedMaps(project, mapIds),
      member.prompt,
      "확인이 끝나면 반드시 report_review 를 한 번 호출한다. ok 는 문제가 없을 때만 true. findings 에는 고쳐야 할 점을 좌표와 함께 짧게 적는다(없으면 빈 배열).",
    ];
  }
  return [...buildPiAgentSystemPrompt(project, mapIds), `너는 팀의「${member.label}」에이전트다. ${member.prompt}`];
}
