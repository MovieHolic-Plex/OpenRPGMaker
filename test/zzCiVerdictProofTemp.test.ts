// 임시 파일 — ci-vitest-files 끝줄(VERDICT: NEW-FAIL)을 증명하려고 일부러 깨뜨린 시험이다. 증명 뒤 지운다(PR #4741).
import { expect, it } from "vitest";

it("일부러 깨뜨린 시험 — 기준선에 없는 파일이 떨어지면 NEW-FAIL 로 적히는지 본다", () => {
  expect(1).toBe(2);
});
