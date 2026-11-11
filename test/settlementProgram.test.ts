// 정착지 목적표 계약(settlementProgram.ts) — 구성기가 묻는 건물 예산: 역할이 먼저, 채움 집은 선언한 수만큼, 그 뒤에는 아무것도 주지 않는다.
import { describe, expect, it } from "vitest";
import { BuildingBudget, DEFAULT_FILLER, fillerOf, placeableRoles, programArg, type SettlementDecl } from "@/project/settlementProgram";

const DECL: SettlementDecl = {
  roles: {
    home: { ko: "집", kits: ["house-a", "house-b"], anyKit: true },
    shop: { ko: "가게", kits: ["shop-front", "shop-small"], room: "shop" },
    keep: { ko: "성", kits: ["keep"], room: "hall" },
  },
  kinds: {
    town: { roles: ["shop", "home"] },
    capital: { roles: ["keep", "shop", "home"], filler: 5, landmark: "keep" },
  },
};
const any = () => true;
const first = (kits: readonly string[]) => kits[0]!;

describe("정착지 목적표 — 건물 예산", () => {
  it("역할을 차례대로 먼저 주고, 채움 집은 선언한 수(없으면 기본 2)만큼만 준다", () => {
    const budget = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }, { id: "h", role: "home", label: "나지라의 집" }] });
    expect(budget.total).toBe(2 + DEFAULT_FILLER);
    expect(budget.next(any, ["plain"], first)).toEqual({ kit: "shop-front", need: { id: "s", role: "shop" } });
    expect(budget.next(any, ["plain"], first)?.need?.id).toBe("h");
    expect(budget.next(any, ["plain"], first)).toEqual({ kit: "plain" });
    expect(budget.next(any, ["plain"], first)).toEqual({ kit: "plain" });
    expect(budget.open).toBe(false);
    expect(budget.next(any, ["plain"], first)).toBeUndefined();
  });

  it("역할의 얼굴 키트가 그 자리에 안 맞으면 대안 키트, 그것도 안 맞으면 그 자리는 채움 집이 받고 역할은 다음 자리를 기다린다", () => {
    const budget = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }], filler: 1 });
    expect(budget.next((kit) => kit !== "shop-front", ["plain"], first)?.kit).toBe("shop-small");
    const tight = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }], filler: 1 });
    expect(tight.next((kit) => kit === "plain", ["plain"], first)).toEqual({ kit: "plain" });
    expect(tight.wants("shop")).toBe(true);
    expect(tight.next((kit) => kit === "plain", ["plain"], first)).toBeUndefined();
    expect(tight.unplaced().map((need) => need.id)).toEqual(["s"]);
  });

  it("그 종류가 선언하지 않은 역할은 처음부터 빠지고, 종류가 선언한 채움 수를 쓴다", () => {
    const program = { roles: [{ id: "k", role: "keep" }, { id: "s", role: "shop" }] };
    expect(placeableRoles(DECL, "town", program).map((need) => need.id)).toEqual(["s"]);
    expect(fillerOf(DECL, "capital", program)).toBe(5);
    expect(fillerOf(DECL, "capital", { ...program, filler: 0 })).toBe(0);
  });

  it("구성기가 스스로 정한 자리는 claim·fill 로 예산에서 뗀다", () => {
    const budget = new BuildingBudget(DECL, "capital", { roles: [{ id: "landmark", role: "keep" }, { id: "s", role: "shop" }], filler: 1 });
    expect(budget.claim(["keep"])?.id).toBe("landmark");
    expect(budget.claim(["keep"])).toBeUndefined();
    expect(budget.claim()?.id).toBe("s");
    expect(budget.fill()).toBe(true);
    expect(budget.fill()).toBe(false);
    expect(budget.open).toBe(false);
  });

  it("도구 인자: 모르는 역할·겹친 id 는 던지고, 없으면 undefined", () => {
    expect(programArg(undefined, DECL)).toBeUndefined();
    expect(programArg({ roles: [{ id: "a", role: "home", label: " 미라의 집 " }], filler: 3 }, DECL)).toEqual({ roles: [{ id: "a", role: "home", label: "미라의 집" }], filler: 3 });
    expect(() => programArg({ roles: [{ id: "a", role: "castle" }] }, DECL)).toThrow(/role must be one of/u);
    expect(() => programArg({ roles: [{ id: "a", role: "home" }, { id: "a", role: "shop" }] }, DECL)).toThrow(/repeated/u);
  });
});
