// 저장본(원본 JSON)과 로더가 돌려준 프로젝트의 명령 차이 — 로더가 조용히 고친 필드를 드러낸다.
//
// 런타임은 로더를 거친 모양을 본다. 그래서 로더의 정규화(예: changeParty 의 speciesId → actorId)가 플레이는
// 살리지만, 생성기(조수·도구)가 잘못 썼다는 사실은 원본에만 남는다. 그 차이를 경고로 낸다.

import type { Project } from "@/project/types";
import { allPages, childLists, visitPageCommands, type RawCommand } from "./walk";
import { whereText, type CommandWhere, type Finding } from "./types";

function shallow(command: RawCommand): Record<string, unknown> {
  const branchKeys = new Set(childLists(command).map((child) => child.key.split(/[.[]/u)[0]));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(command).sort()) {
    if (branchKeys.has(key)) continue;
    if (key === "options" && Array.isArray(command.options)) {
      out.options = command.options.map((option) => (option && typeof option === "object" ? { ...(option as Record<string, unknown>), branch: undefined } : option));
      continue;
    }
    out[key] = command[key];
  }
  return out;
}

/**
 * 로더가 **없던 칸에 기본값만 채운** 것은 고친 게 아니다(예: shop 의 branchOnTransaction:false).
 * 2026-09-24 몬스터 도그푸딩: 올바른 상점 명령마다 load-normalized 경고가 떠서 진짜 정규화 흔적을 가렸다.
 */
function isDefaultLike(value: unknown): boolean {
  if (value === false || value === null || value === undefined || value === "" || value === 0) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "object" && Object.keys(value as object).length === 0;
}

function withoutAddedDefaults(original: Record<string, unknown>, loaded: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(loaded)) {
    if (!(key in original) && isDefaultLike(value)) continue;
    out[key] = value;
  }
  return out;
}

function commandsByWhere(project: Project): Map<string, { command: RawCommand; where: CommandWhere }> {
  const out = new Map<string, { command: RawCommand; where: CommandWhere }>();
  for (const page of allPages(project)) visitPageCommands(page, ({ command, where }) => out.set(whereText(where), { command, where }));
  return out;
}

export function diffLoadNormalization(raw: unknown, loaded: Project): Finding[] {
  if (!raw || typeof raw !== "object" || !(raw as { maps?: unknown }).maps) return [];
  let before: Map<string, { command: RawCommand; where: CommandWhere }>;
  try {
    before = commandsByWhere(raw as Project);
  } catch {
    return [];
  }
  const after = commandsByWhere(loaded);
  const findings: Finding[] = [];
  for (const [key, entry] of before) {
    const now = after.get(key);
    if (!now) continue;
    const original = entry.command;
    const originalShape = shallow(original);
    const a = JSON.stringify(originalShape);
    const b = JSON.stringify(withoutAddedDefaults(originalShape, shallow(now.command)));
    if (a === b) continue;
    findings.push({
      severity: "warning", code: "load-normalized",
      message: `저장본의 ${String(original.kind)} 명령을 로더가 고쳐서 읽었습니다 — 생성기가 잘못 쓴 흔적입니다. 저장본 ${a.slice(0, 200)} → 로드 ${b.slice(0, 200)}`,
      where: now.where,
    });
  }
  return findings;
}
