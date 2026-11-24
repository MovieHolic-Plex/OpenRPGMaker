import { describe, expect, it } from "vitest";
import { elementMultiplierFor } from "@/battle/battlePredict";
import { affinitySentences, nextAffinityGrade } from "@/editor/panels/databaseElementAffinity";
import { createBlankProject } from "@/project/defaults";
import { applyDefaultElementAffinities } from "@/project/defaults/defaultElementAffinities";

describe("기본 적 예시 상성 (qa1124 8-2·8-3)", () => {
  it("새 프로젝트 기본 적에 약점이 생기고 골렘은 타격 2배다", () => {
    const project = createBlankProject();
    expect(project.database.enemies.some((enemy) => Object.values(enemy.elementRates ?? {}).some((grade) => grade !== "C"))).toBe(false);
    const changed = applyDefaultElementAffinities(project.database.enemies, project.database.elements ?? []);
    expect(changed).toBeGreaterThan(0);
    const golem = project.database.enemies.find((enemy) => enemy.id === "enemy_stone_golem")!;
    expect(golem.elementRates?.hit).toBe("A");
    expect(elementMultiplierFor(project, "hit", golem.id)).toBe(2);
    expect(affinitySentences(project, "hit").length).toBeGreaterThan(0);
  });

  it("작가가 정한 등급은 덮지 않는다", () => {
    const project = createBlankProject();
    const golem = project.database.enemies.find((enemy) => enemy.id === "enemy_stone_golem")!;
    golem.elementRates = { ...golem.elementRates, hit: "E" };
    applyDefaultElementAffinities(project.database.enemies, project.database.elements ?? []);
    expect(golem.elementRates.hit).toBe("E");
  });

  it("한 번 누르면 보통 → 2배 → 1.5배 → 절반 → 무효 → 보통", () => {
    expect(["C", "A", "B", "D", "E"].map((grade) => nextAffinityGrade(grade as never))).toEqual(["A", "B", "D", "E", "C"]);
  });
});
