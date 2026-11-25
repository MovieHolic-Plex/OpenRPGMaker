import { describe, expect, it } from "vitest";
import { duplicateInto } from "@/editor/databaseCopy";

type NamedRecord = { readonly id: string; name: string };

// fix(db): " Copy" 하드코딩 접미사를 "사본"으로 바꾸면서, 이름 충돌 시 번호가 증가해야
// 한다는 계약(P6)을 고정한다 — 반복 복제나 이미 "…사본" 접미사가 붙은 레코드를 다시
// 복제해도 "…사본 사본" 같은 접미사 중첩이 생기지 않아야 한다.
describe("duplicateInto — 사본 naming", () => {
  it("appends ' 사본' on the first duplicate", () => {
    const records: NamedRecord[] = [{ id: "a", name: "슬라임" }];
    duplicateInto(records, "a", "b");
    expect(records[1]?.name).toBe("슬라임 사본");
  });

  it("increments a trailing number when the plain 사본 name is already taken", () => {
    const records: NamedRecord[] = [
      { id: "a", name: "슬라임" },
      { id: "b", name: "슬라임 사본" },
    ];
    duplicateInto(records, "a", "c");
    expect(records[2]?.name).toBe("슬라임 사본 2");
  });

  it("keeps incrementing past existing numbered copies", () => {
    const records: NamedRecord[] = [
      { id: "a", name: "슬라임" },
      { id: "b", name: "슬라임 사본" },
      { id: "c", name: "슬라임 사본 2" },
    ];
    duplicateInto(records, "a", "d");
    expect(records[3]?.name).toBe("슬라임 사본 3");
  });

  it("duplicating an already-copied record uses the root name, not a nested suffix", () => {
    const records: NamedRecord[] = [
      { id: "a", name: "슬라임" },
      { id: "b", name: "슬라임 사본" },
    ];
    duplicateInto(records, "b", "c");
    expect(records[2]?.name).toBe("슬라임 사본 2");
    expect(records[2]?.name).not.toContain("사본 사본");
  });
});
