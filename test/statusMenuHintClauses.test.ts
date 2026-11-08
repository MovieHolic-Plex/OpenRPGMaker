import { describe, expect, it } from "vitest";
import { statusMenuHintClauses } from "@/player/playerStatusMenuDetailRenderer";

describe("statusMenuHintClauses", () => {
  it("marks every clause of a keys-only hint so touch devices can hide the whole line", () => {
    const clauses = statusMenuHintClauses("↑↓로 임무 목록을 읽습니다. ← 메뉴로 돌아갑니다.");
    expect(clauses.map((c) => c.key)).toEqual([true, true]);
  });

  it("keeps key-free clauses visible and marks only the key clause", () => {
    const clauses = statusMenuHintClauses("설명은 커서를 올리면 아래에 보입니다. 필드 스킬만 Enter로 사용합니다.");
    expect(clauses.map((c) => c.key)).toEqual([false, true]);
    expect(statusMenuHintClauses("파티원을 선택하세요.").map((c) => c.key)).toEqual([false]);
  });

  it("joins back to the original text so desktop shows the same hint", () => {
    for (const hint of ["Enter 사용 · Esc 아이템 목록", "목록 끝에서 분류·정렬 변경 · ↑↓ 이동 · Enter 선택", "결정 키로 화면 가득 봅니다. 연 뒤 좌우로 넘깁니다."]) {
      expect(statusMenuHintClauses(hint).map((c) => c.text).join("")).toBe(hint);
    }
  });
});
