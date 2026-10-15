import { describe, expect, it } from "vitest";
import { resolveRelationTarget } from "@/editor/panels/worldRelationTarget";
import type { WorldEntity } from "@/project/world/types";

const card = (id: string, name: string): WorldEntity => ({ id, type: "place", name, summary: "", origin: "user" });
const targets = [card("w_a", "은빛 항구"), card("w_b", "은빛 상단"), card("w_c", "폐탑"), card("w_d", "폐탑 지하")];
const labels = new Map(targets.map((entity) => [entity.id, entity.name] as const));

describe("연결 속성 입력 → 문서 id", () => {
  it("id 와 정확한 이름은 바로 찾는다", () => {
    expect(resolveRelationTarget("w_a", targets, labels)).toEqual({ kind: "found", id: "w_a" });
    expect(resolveRelationTarget(" 은빛 항구 ", targets, labels)).toEqual({ kind: "found", id: "w_a" });
  });
  it("정확한 이름이 부분 일치보다 먼저다", () => {
    expect(resolveRelationTarget("폐탑", targets, labels)).toEqual({ kind: "found", id: "w_c" });
  });
  it("유일한 부분 일치만 찾고, 여럿이면 모호하다고 돌려준다", () => {
    expect(resolveRelationTarget("지하", targets, labels)).toEqual({ kind: "found", id: "w_d" });
    expect(resolveRelationTarget("은빛", targets, labels)).toEqual({ kind: "ambiguous" });
  });
  it("없는 이름과 빈 입력은 저장하지 않는다", () => {
    expect(resolveRelationTarget("없는 문서", targets, labels)).toEqual({ kind: "none" });
    expect(resolveRelationTarget("  ", targets, labels)).toEqual({ kind: "none" });
  });
  it("같은 이름이 둘이면 「이름 · id」 표시 이름으로 고른다", () => {
    const dup = [card("w_x", "마을"), card("w_y", "마을")];
    const dupLabels = new Map([["w_x", "마을 · w_x"], ["w_y", "마을 · w_y"]]);
    expect(resolveRelationTarget("마을", dup, dupLabels)).toEqual({ kind: "ambiguous" });
    expect(resolveRelationTarget("마을 · w_y", dup, dupLabels)).toEqual({ kind: "found", id: "w_y" });
  });
});
