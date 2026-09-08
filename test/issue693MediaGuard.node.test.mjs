import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeMediaWrite } from "../scripts/qa/issue693-media-guard.mjs";

const owner = "oprn-2222222222";
const other = "oprn-3333333333";
const url = table => `http://127.0.0.1/rest/v1/${table}`;

test("metadata includes only bounded routing fields, not embedded project data", () => {
  const body = JSON.stringify({ project_id: owner, current_json: { project_id: other, privateData: "sentinel" } });
  assert.deepEqual(summarizeMediaWrite(url("projects"), "POST", body), { target: owner, rows: 1, bodyLength: body.length });
});

for (const table of ["maps", "tilesets"]) {
  test(`${table} validates every top-level row, including the last row`, () => {
    const rows = [{ project_id: owner }, { project_id: owner }, { project_id: owner }];
    const body = JSON.stringify(rows);
    assert.deepEqual(summarizeMediaWrite(url(table), "POST", body), { target: owner, rows: 3, bodyLength: body.length });
    for (const invalid of [{ project_id: other }, {}, null, [], "not-a-row"]) {
      assert.equal(summarizeMediaWrite(url(table), "POST", JSON.stringify([...rows, invalid])).error, "mixed-or-invalid-row-targets");
    }
  });
}

test("child DELETE requires one exact target filter and no body", () => {
  assert.deepEqual(summarizeMediaWrite(url(`maps?project_id=eq.${owner}`), "DELETE"), { target: owner, rows: 0, bodyLength: 0 });
  for (const query of ["", `?project_id=like.${owner}`, `?project_id=eq.${owner}&project_id=eq.${other}`]) {
    assert(summarizeMediaWrite(url(`maps${query}`), "DELETE").error);
  }
  assert(summarizeMediaWrite(url(`projects?project_id=eq.${owner}`), "DELETE").error);
  assert(summarizeMediaWrite(url(`maps?project_id=eq.${owner}`), "DELETE", "{}").error);
});

test("query and row targets cannot disagree", () => {
  assert.equal(summarizeMediaWrite(url(`maps?project_id=eq.${other}`), "POST", JSON.stringify([{ project_id: owner }])).error,
    "query-body-target-mismatch");
});

test("unsupported shapes and methods cannot establish ownership", () => {
  for (const [table, method, body] of [
    ["projects", "POST", "{"], ["projects", "POST", null], ["projects", "POST", "[]"],
    ["maps", "POST", "[]"], ["maps", "POST", "{}"], ["projects", "PATCH", JSON.stringify({ project_id: owner })],
    ["rpc/save", "POST", JSON.stringify({ project_id: owner })],
  ]) assert(summarizeMediaWrite(url(table), method, body).error);
});
