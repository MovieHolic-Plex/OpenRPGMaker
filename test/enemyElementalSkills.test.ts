// 적이 8속성 전부로 공격할 수 있어야 적마다 저작된 11개 속성 저항이 의미를 갖는다.
// 기존에는 fire/water/grass 3종뿐이었고 나머지는 "뇌전석 효과" 같은 아이템 효과
// 스킬로만 존재해 적 기술 이름으로 쓰면 어색했다.
import { describe, expect, it } from "vitest";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";

describe("적 속성 공격 스킬", () => {
  it("8속성 각각에 아이템 효과가 아닌 공격 스킬이 있다", () => {
    const skills = (defaultDatabase() as any).skills as any[];
    const combat = skills.filter((s) => !String(s.id).startsWith("skill_item_"));
    for (const element of ["fire", "ice", "thunder", "water", "earth", "wind", "dark", "holy"]) {
      const match = combat.filter((s) => s.elementId === element && s.scope === "enemy" && (s.power ?? 0) > 0);
      expect(match.length, `${element} 속성 공격 스킬이 없다`).toBeGreaterThan(0);
    }
  });

  it("신규 6종은 MP 4 이고 적 MP(10)로 2회 쓸 수 있다", () => {
    const skills = (defaultDatabase() as any).skills as any[];
    for (const id of ["skill_ice", "skill_thunder", "skill_earth", "skill_wind", "skill_dark", "skill_holy"]) {
      const s = skills.find((x) => x.id === id);
      expect(s, `${id} 없음`).toBeDefined();
      expect(s.mpCost.flat).toBe(4);
      expect(s.scope).toBe("enemy");
    }
  });

  it("신규 6종은 플레이어 직업에 배정되지 않는다", () => {
    const db = defaultDatabase() as any;
    const assigned = new Set(db.classes.flatMap((c: any) => c.skillIds ?? []));
    for (const id of ["skill_ice", "skill_thunder", "skill_earth", "skill_wind", "skill_dark", "skill_holy"]) {
      expect(assigned.has(id), `${id} 가 직업에 배정됐다`).toBe(false);
    }
  });
});
