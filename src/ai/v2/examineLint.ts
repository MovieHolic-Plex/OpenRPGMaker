// 조수 v2 — 조사(살펴보기) 이벤트 검사: 걸어 가서 살필 수 있나, 같은 물건에 조사가 둘 붙지 않았나.
//
// 왜(2026-11-04 폴른 스타 월드 정비, ultrabrain 판정): 손으로 단 조사 31개 중 셋이 틀렸다 —
//  - 광장 망원경 (21,17): 유일하게 열린 옆 칸이 갇힌 칸이라 걸어 닿지 못했다.
//  - 숲 사당 (26,11): 같은 사당 그림에 이미 `ev_fs_forest_shrine` 이 있어 두 조사가 다른 이야기를 했다.
//  - 눈길 짐수레 (14,25): 같은 수레의 `ev_fs2_snow_wagon` 과 겹쳐 수레 하나가 서로 다른 이야기를 했다.
// 검사 대상은 «조사만 하는» 이벤트(모든 페이지가 확인 키 발동, 이동 명령 없음). 사람·문·자동 장면은 보지 않는다.
// 돌아다니는 사람(고정이 아닌 이동)은 비켜 가므로 길을 막는 것으로 치지 않는다.
import type { LintIssue } from "@/project/lint/projectLint";
import { objectClusterAt } from "@/project/objectFootprint";
import type { GameEvent, Project } from "@/project/types";
import { anchorsOf, blockersOf, bodyReached, reachFrom } from "./eventReach";

const triggerOf = (page: { trigger?: unknown }): string =>
  String(typeof page.trigger === "string" ? page.trigger : (page.trigger as { kind?: string } | undefined)?.kind ?? "action");

function hasTransfer(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasTransfer);
  if (!node || typeof node !== "object") return false;
  if ((node as { kind?: unknown }).kind === "transfer") return true;
  return Object.values(node as object).some((value) => value && typeof value === "object" && hasTransfer(value));
}

/** 조사만 하는 이벤트 — 모든 페이지가 확인 키 발동이고 이동이 없다. */
export function isExamineOnly(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  return pages.length > 0 && pages.every((page) => triggerOf(page) === "action") && !hasTransfer(pages);
}

const moving = (event: GameEvent): boolean => (event.pages ?? []).some((page) => (page.movement?.type ?? "fixed") !== "fixed");

export function lintExamineEvents(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const map of Object.values(project.maps)) {
    const examines = (map.events ?? []).filter(isExamineOnly);
    if (!examines.length) continue;
    const anchors = anchorsOf(project, map);
    if (anchors.length) {
      const blocked = blockersOf(map);
      for (const event of map.events ?? []) if (moving(event)) blocked.delete(event.y * map.width + event.x);
      const reach = reachFrom(project, map, anchors, blocked);
      for (const event of examines) {
        if (bodyReached(map, reach, event)) continue;
        issues.push({
          severity: "warning", code: "scene-examine-unreachable", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
          message: `조사 「${event.name || event.id}」(${event.x},${event.y}) 에 걸어 가 닿을 수 없다 — 옆 칸이 모두 막혔거나 갇힌 칸이다. 같은 물건의 열린 쪽 칸으로 옮기거나 뺀다.`,
        });
      }
    }
    const seen = new Map<string, GameEvent>();
    for (const event of map.events ?? []) {
      const object = objectClusterAt(project, map, event.x, event.y);
      if (!object) continue;
      const key = `${object.label}|${Math.min(...object.cells)}`;
      const first = seen.get(key);
      if (!first) { seen.set(key, event); continue; }
      if (!isExamineOnly(event) && !isExamineOnly(first)) continue;
      issues.push({
        severity: "warning", code: "scene-examine-duplicate", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
        message: `「${object.label}」 하나에 이벤트가 둘이다 — ${first.id}(${first.x},${first.y}) 와 ${event.id}(${event.x},${event.y}). 같은 물건이 두 이야기를 한다. 하나로 합치거나 다른 물건으로 옮긴다.`,
      });
    }
  }
  return issues;
}
