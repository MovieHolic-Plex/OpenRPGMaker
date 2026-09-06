/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { field } from "@/editor/panels/eventEditor/dom";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it("associates distinct labels when HTTP exposes getRandomValues without randomUUID", () => {
  // Given the crypto surface supported by the project's existing HTTP ID utility.
  let seed = 0;
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => {
      bytes.fill(++seed);
      return bytes;
    },
  });
  const first = document.createElement("input");
  const second = document.createElement("input");

  // When actual shared field rows are mounted in that environment.
  const rows = [field("First field", first), field("Second field", second)];
  document.body.append(...rows);

  // Then each label targets its own control, without a secure-context-only API.
  expect(first.id).not.toBe("");
  expect(second.id).not.toBe(first.id);
  expect(rows[0]?.querySelector("label")?.control).toBe(first);
  expect(rows[1]?.querySelector("label")?.control).toBe(second);
});
