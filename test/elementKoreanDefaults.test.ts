// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { elementDisplayName } from "@/battle/skillHelp";
import { elementGradeWord } from "@/editor/panels/databaseElementPresentation";

// qa1124 항목 8(오너 2026-11-24 «'전투 규칙' 의 속성은 이해하기가 어렵다»): 새 프로젝트 속성 이름이 영어(Sword·Hit·ATK…)였고
// 배율은 등급 문자(A~E)로만 보였다.
describe("속성 이름·배율 낱말", () => {
  it("새 프로젝트 기본 속성 이름에 영어가 없다", () => {
    const names = (createBlankProject().database.elements ?? []).map((element) => element.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => /[A-Za-z]/u.test(name))).toEqual([]);
  });

  it("작가가 손대지 않은 예전 영어 기본 이름은 한국어로 보이고, 작가가 바꾼 이름은 그대로다", () => {
    const db = (name: string) => ({ database: { elements: [{ id: "atk", name, kind: "magical" as const, rateLabels: ["A", "B", "C", "D", "E"] as const, damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } }] } }) as never;
    expect(elementDisplayName(db("ATK"), "atk")).toBe("공격력");
    expect(elementDisplayName(db("내 공격"), "atk")).toBe("내 공격");
  });

  it("배율을 낱말로 읽는다", () => {
    expect([200, 150, 100, 50, 0, -100, 300].map(elementGradeWord)).toEqual(["2배", "1.5배", "보통", "절반", "무효", "흡수", "3배"]);
  });
});
