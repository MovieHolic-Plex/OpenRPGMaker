import { describe, expect, it } from "vitest";
import { collectEndingWarnings } from "../src/project/endings";
import type { EndingDef } from "../src/project/types";

const ending = (id: string, priority: number): EndingDef => ({ id, name: id, conditions: [], priority } as EndingDef);

describe("collectEndingWarnings — priority 는 조건으로 고르는 호출에서만 의미가 있다", () => {
  const endings = [ending("a", 10), ending("b", 5), ending("c", 5)];

  it("기본값은 예전처럼 같은 조건 집합의 priority 경고를 낸다", () => {
    const warnings = collectEndingWarnings(endings);
    expect(warnings.some((w) => w.includes("엔딩 도달 불능: b"))).toBe(true);
  });

  it("이름으로만 부르는 프로젝트(priorityMatters:false)에서는 소음 경고를 내지 않는다", () => {
    expect(collectEndingWarnings(endings, { priorityMatters: false })).toEqual([]);
  });

  it("priorityMatters:false 라도 불가능한 조건 충돌은 계속 알린다", () => {
    const impossible = { id: "x", name: "x", priority: 1, conditions: [
      { kind: "switch", switchId: "s", value: true }, { kind: "switch", switchId: "s", value: false },
    ] } as EndingDef;
    expect(collectEndingWarnings([impossible], { priorityMatters: false }).join("\n")).toContain("ON/OFF");
  });
});
