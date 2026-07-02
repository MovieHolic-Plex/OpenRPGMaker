import { describe, expect, it } from "vitest";
import { supabaseRecoveredPathFromHref } from "@/project/supabaseRecoveryLocation";

describe("Supabase recovery URL", () => {
  it("leaves fresh project mode when DB connection succeeds", () => {
    expect(supabaseRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1")).toBe("/?supabaseRecovered=1");
  });

  it("preserves unrelated params and hash while enabling canonical Supabase load", () => {
    expect(supabaseRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1&zoom=2#map")).toBe(
      "/?zoom=2&supabaseRecovered=1#map",
    );
  });
});
