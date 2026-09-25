// editor/tools/flagHelpers.ts
// 스위치/변수를 이름과 함께 등록하는 순수 헬퍼(중복 없이). 여러 툴/컴파일러가 공유하며
// 순환 의존을 피하기 위해 중립 모듈로 분리한다.

import type { Project } from "@/project/types";

export function ensureNamedSwitch(project: Project, id: string, name: string): void {
  const record = project.switches.find((entry) => entry.id === id);
  if (record) {
    if (record.name === "") record.name = name;
  } else {
    project.switches.push({ id, name });
  }
  project.session.switches[id] ??= false;
}

export function ensureNamedVariable(project: Project, id: string, name: string): void {
  const record = project.variables.find((entry) => entry.id === id);
  if (record) {
    if (record.name === "") record.name = name;
  } else {
    project.variables.push({ id, name });
  }
  project.session.variables[id] ??= 0;
}

/**
 * 이벤트·명령 트리가 가리키는 스위치/변수 중 프로젝트에 없는 것을 등록한다(이름 = id).
 *
 * 2026-09-24 갤러리 호러 도그푸딩: 모델이 `sw_intro_done`·`var_petals` 를 새 id 로 바로 쓴 upsert_event 4건이
 * 전부 커밋 게이트의 「switchId가 존재하지 않습니다」로 통째로 반려됐고, 대사·조건을 다시 보내느라 호출을 낭비했다.
 * 새 id 를 쓰는 것은 흔한 저작 방식이고(편집기도 새 스위치를 이름 붙여 만든다) 추측으로 잃는 것이 없다 —
 * 등록하고 경고로 알린다. 오타 여부는 「켜는 곳 없음」 경고가 따로 짚는다.
 */
export function declareReferencedFlags(project: Project, root: unknown): { switches: string[]; variables: string[] } {
  const switchIds = new Set(project.switches.map((entry) => entry.id));
  const variableIds = new Set(project.variables.map((entry) => entry.id));
  const added = { switches: [] as string[], variables: [] as string[] };
  const seen = new Set<unknown>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === "string" && child.trim()) {
        const id = child.trim();
        if (key === "switchId" && !switchIds.has(id)) {
          ensureNamedSwitch(project, id, id);
          switchIds.add(id);
          added.switches.push(id);
        } else if (key === "variableId" && !variableIds.has(id)) {
          ensureNamedVariable(project, id, id);
          variableIds.add(id);
          added.variables.push(id);
        }
        continue;
      }
      visit(child);
    }
  };
  visit(root);
  return added;
}

export function declaredFlagsWarning(added: { switches: readonly string[]; variables: readonly string[] }): string | undefined {
  const parts = [
    added.switches.length > 0 ? `스위치 ${added.switches.join(", ")}` : "",
    added.variables.length > 0 ? `변수 ${added.variables.join(", ")}` : "",
  ].filter(Boolean);
  return parts.length > 0
    ? `없던 ${parts.join(" · ")} 를 새로 등록했습니다(이름 = id). 이름을 붙이려면 rename_switch/rename_variable.`
    : undefined;
}
