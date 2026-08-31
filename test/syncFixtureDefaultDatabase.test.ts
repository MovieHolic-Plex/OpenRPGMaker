import { describe, expect, it } from "vitest";
import { syncDefaultRecords } from "../scripts/lib/fixtureDefaultDatabase.mts";

type Row = { id: string; name: string; price?: number };

const codeDefaults: Row[] = [
  { id: "a", name: "코드 A", price: 100 },
  { id: "b", name: "코드 B", price: 200 },
];

describe("syncDefaultRecords", () => {
  it("기본값 id 레코드는 코드 값으로 교체되어 낡은 값이 사라진다", () => {
    const shipped: Row[] = [{ id: "a", name: "픽스처의 낡은 A", price: 70 }];

    const { records, report } = syncDefaultRecords(shipped, codeDefaults);

    expect(records.find((row) => row.id === "a")).toEqual({ id: "a", name: "코드 A", price: 100 });
    expect(report.refreshed).toEqual(["a"]);
    expect(report.added).toEqual(["b"]);
  });

  it("코드에 없는 저작 전용 레코드는 필드까지 그대로 남는다", () => {
    const authored: Row = { id: "authored_only", name: "손으로 만든 레코드", price: 999 };
    const shipped: Row[] = [{ id: "a", name: "낡은 A" }, authored];

    const { records, report } = syncDefaultRecords(shipped, codeDefaults);

    expect(report.authoredKept).toEqual(["authored_only"]);
    expect(records.find((row) => row.id === "authored_only")).toEqual(authored);
  });

  it("코드 기본값 순서를 따르고 저작 전용 레코드를 뒤에 붙인다", () => {
    const shipped: Row[] = [
      { id: "authored_only", name: "저작" },
      { id: "b", name: "낡은 B" },
    ];

    const { records } = syncDefaultRecords(shipped, codeDefaults);

    expect(records.map((row) => row.id)).toEqual(["a", "b", "authored_only"]);
  });

  it("두 번 돌려도 결과가 같다", () => {
    const shipped: Row[] = [{ id: "a", name: "낡은 A" }, { id: "authored_only", name: "저작" }];

    const once = syncDefaultRecords(shipped, codeDefaults).records;
    const twice = syncDefaultRecords(once, codeDefaults).records;

    expect(twice).toEqual(once);
  });

  it("코드 레코드를 복제해 담으므로 결과를 고쳐도 코드 기본값이 오염되지 않는다", () => {
    const { records } = syncDefaultRecords([], codeDefaults);
    const first = records[0];
    if (first === undefined) throw new Error("레코드가 비었다");
    first.name = "오염 시도";

    expect(codeDefaults[0]?.name).toBe("코드 A");
  });
});
