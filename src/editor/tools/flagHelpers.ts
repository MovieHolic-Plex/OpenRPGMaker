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
