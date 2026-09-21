import { describe, expect, it } from "vitest";
import { projectRecoveredPathFromHref } from "@/project/projectRecoveryLocation";

describe("LegacyDb recovery URL", () => {
  it("leaves fresh project mode when DB connection succeeds", () => {
    expect(projectRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1")).toBe("/?projectRecovered=1");
  });

  it("preserves unrelated params and hash while enabling canonical LegacyDb load", () => {
    expect(projectRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1&zoom=2#map")).toBe(
      "/?zoom=2&projectRecovered=1#map",
    );
  });
});
