// test/eventReadability.test.ts — the naming pieces behind the event list's readability pass (2026-11-01):
// short switch/variable names (src/editor/shortRecordName.ts) and the Korean labels a script gives its own code
// (src/editor/script/scriptLabels.ts). Wiki: openwiki/script-sandbox.md 「목록에서 읽히는 스크립트」.
import { describe, expect, it } from "vitest";
import { shortRecordName } from "@/editor/shortRecordName";
import { hasBatchim, josa, readIdentifier, readScriptLabels } from "@/editor/script/scriptLabels";
import { shortArmLabel } from "@/editor/panels/eventEditor/scriptLines";

describe("shortRecordName", () => {
  it("drops the description written into a name and never returns an empty name", () => {
    expect(shortRecordName("레버 퍼즐 진행 단계(0~4, 올바르게 당긴 레버 수)")).toBe("레버 퍼즐 진행 단계");
    expect(shortRecordName("마을 평판 (레버 퍼즐 해결 시 +10)")).toBe("마을 평판");
    expect(shortRecordName("레버 퍼즐(3→1→4→2)을 풀어 창고 문이 열림")).toBe("레버 퍼즐을 풀어 창고 문이 열림");
    expect(shortRecordName("평판 — 마을에서의 주인공 평판 (로직은 다음 작업에서 연결)")).toBe("평판");
    expect(shortRecordName("포션 할인율 % (평판×3, 최대 30)")).toBe("포션 할인율");
    expect(shortRecordName("지금 포션 가격 = 50 × (100-할인율) / 100, 소수점 버림")).toBe("지금 포션 가격");
    expect(shortRecordName("마을 평판. 할머니 퀘스트 완료 시 +10")).toBe("마을 평판");
    expect(shortRecordName("평판")).toBe("평판");
    expect(shortRecordName("(괄호만)")).toBe("(괄호만)");
  });
});

describe("readScriptLabels", () => {
  it("reads trailing-comment names, @label tags, JSDoc helper labels and heading comments", () => {
    const labels = readScriptLabels([
      "// 가격 계산",
      "const pct = discountPercent(rep); // 할인율",
      "const BASE = 120, MAX_OFF = 30; // 기본 가격, 최대 할인",
      'const url = "http://x"; // 주소',
      "// @label A: 이미 당김",
      "// @label LEVERS: 레버들",
      "/** @label 할인된 값 */",
      "function discounted(n: number) { return n; }",
      "",
      "// 틀린 순서: 원위치",
      "if (x) {",
      "}",
    ].join("\n"));
    expect(labels.names.get("pct")).toBe("할인율");
    expect(labels.names.get("BASE")).toBe("기본 가격");
    expect(labels.names.get("MAX_OFF")).toBe("최대 할인");
    expect(labels.names.get("url")).toBe("주소");
    expect(labels.names.get("LEVERS")).toBe("레버들");
    expect(labels.names.get("discounted")).toBe("할인된 값");
    expect(labels.selfSwitches.get("A")).toBe("이미 당김");
    expect([...labels.headings.entries()]).toEqual([[2, "가격 계산"], [11, "틀린 순서: 원위치"]]);
  });

  it("does not take a comma list that does not match the declarators, nor eslint/ts comments as headings", () => {
    const labels = readScriptLabels(["const a = 1, b = 2; // 하나", "// eslint-disable-next-line", "game.wait(1);"].join("\n"));
    expect(labels.names.size).toBe(0);
    expect(labels.headings.size).toBe(0);
  });
});

describe("readIdentifier / josa", () => {
  it("reads known words and keeps unknown identifiers", () => {
    expect(readIdentifier("discountedPrice")).toBe("할인된 가격");
    expect(readIdentifier("discountPercent")).toBe("할인율");
    expect(readIdentifier("ORDER")).toBe("순서");
    expect(readIdentifier("ev_lever1")).toBe("레버 1");
    expect(readIdentifier("BASE_PRICE")).toBe("기본 가격");
    expect(readIdentifier("sx")).toBeUndefined();
  });

  it("picks the particle by the last syllable or digit", () => {
    expect(josa("돈", "이", "가")).toBe("돈이");
    expect(josa("개수", "이", "가")).toBe("개수가");
    expect(hasBatchim("3")).toBe(true);
    expect(hasBatchim("4")).toBe(false);
    expect(hasBatchim("「평판」")).toBe(true);
  });

  it("says branch arms the short way in the list", () => {
    expect(shortArmLabel("조건이 맞을 때")).toBe("그러면");
    expect(shortArmLabel("조건이 맞지 않을 때")).toBe("아니면");
    expect(shortArmLabel("이겼을 때")).toBe("이겼을 때");
  });
});
