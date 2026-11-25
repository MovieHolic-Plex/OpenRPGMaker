import assert from "node:assert/strict";
import { test } from "node:test";
import { findHomes } from "./check-new-test-files.mjs";

const files = {
  "test/battleRuntime.test.ts": 'import { runBattle } from "@/runtime/battle/battleRuntime";\nit("a", () => {});\n',
  "test/other.test.ts": 'import { x } from "@/editor/other";\nit("b", () => {});\n',
  "test/battleFixBug123.test.ts": 'import { runBattle } from "@/runtime/battle/battleRuntime";\nimport { createBlankProject } from "@/project/defaults";\nit("c", () => {});\n',
  "test/brandNew.test.ts": 'import { y } from "@/editor/brandNewModule";\nit("d", () => {});\n',
};
const read = (p) => files[p];

test("새 파일의 주 모듈을 이미 시험하는 파일을 집으로 찾는다", () => {
  const [r] = findHomes(["test/battleFixBug123.test.ts"], Object.keys(files), read);
  assert.equal(r.mod, "@/runtime/battle/battleRuntime");
  assert.deepEqual(r.homes, ["test/battleRuntime.test.ts"]);
});

test("같은 모듈을 시험하는 파일이 없으면 집이 비고, 새 파일끼리는 서로의 집이 되지 않는다", () => {
  const out = findHomes(["test/brandNew.test.ts", "test/battleFixBug123.test.ts"], Object.keys(files), read);
  assert.deepEqual(out[0].homes, []);
  assert.deepEqual(out[1].homes, ["test/battleRuntime.test.ts"]);
});
