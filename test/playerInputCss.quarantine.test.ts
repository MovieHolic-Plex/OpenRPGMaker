import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { shippedCssClosure, unownedPointerCss } from "../scripts/lib/playerInputCss.mjs";

describe("shipping player pointer CSS closure", () => {
  it("contains no unowned hover, active, or pointer cursor rules", async () => {
    const files = await shippedCssClosure(resolve("src/player/player.css"));
    const violations = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      violations.push(...unownedPointerCss(source, relative(process.cwd(), file)));
    }
    expect(violations).toEqual([]);
  });

  it("follows imported stylesheets and rejects newly imported violations", async () => {
    expect(unownedPointerCss(".choice:hover { color: red; }", "bad.css")).toEqual([
      "bad.css: .choice:hover",
    ]);
    expect(unownedPointerCss("button { cursor: pointer; }", "bad.css")).toEqual([
      "bad.css: button",
    ]);
    expect(
      unownedPointerCss(
        "[data-play-input-owner='host-fullscreen']:hover { cursor: pointer; }",
        "owned.css",
      ),
    ).toEqual([]);
  });
});
