import { describe, expect, it } from "vitest";
import {
  planServerOwnership,
  assertExpectedStart,
  assertObservedDigest,
} from "../scripts/lib/horror-capture-rules.mjs";

/**
 * The break: `capture-horror-browser-evidence.mts` `reserveDevServer` reuses any
 * already-listening server that "serves this app" (`servesThisApp`). That lets the browser
 * QA attach to an existing arbitrary Vite server instead of owning its own freshly verified-free
 * port + exact spawned process from this worktree — so an occupied/foreign port is silently
 * accepted, shutdown closes nothing it spawned, and another agent's/app's server can satisfy QA.
 *
 * The start-live-session and content-digest bindings are also missing: the capture asserts
 * projectId only, so a LegacyDb row with the right id but the wrong startMapId/startPos, or
 * different content, still passes.
 *
 * This names both breaks: the ownership planner must reject an occupied/foreign port (never reuse),
 * and the capture rules must fail on a live-session start mismatch and on a content-digest
 * mismatch.
 */
describe("horror capture server ownership & binding rules", () => {
  it("REJECTS reusing an occupied port even when it serves this app (no silent reuse)", () => {
    expect(() => planServerOwnership({ kind: "already-listening", servesThisApp: true }))
      .toThrow(/포트|점유|reuse|재사용|occupied/i);
  });

  it("REJECTS an occupied foreign port", () => {
    expect(() => planServerOwnership({ kind: "already-listening", servesThisApp: false }))
      .toThrow(/포트|점유|occupied/i);
  });

  it("ACCEPTS a verified-free port and requires spawning a fresh owned process", () => {
    const plan = planServerOwnership({ kind: "free" });
    expect(plan.action).toBe("spawn");
  });

  it("REJECTS a live start that differs from the expected mapId/pos", () => {
    expect(() =>
      assertExpectedStart(
        { currentMapId: "map_horror_service_corridor", x: 3, y: 11 },
        { mapId: "map_horror_blue_gallery", x: 13, y: 13 },
      ),
    ).toThrow(/시작 맵|해당 좌표|mapId|startMapId|startPos/i);
  });

  it("ACCEPTS a live start equal to expected mapId/x/y", () => {
    const exact = { currentMapId: "map_horror_blue_gallery", x: 13, y: 13 };
    expect(() =>
      assertExpectedStart(exact, { mapId: exact.currentMapId, x: exact.x, y: exact.y }),
    ).not.toThrow();
  });

  it("REJECTS a wrong start x (observed eats into expected-pos budget)", () => {
    expect(() =>
      assertExpectedStart(
        { currentMapId: "map_horror_blue_gallery", x: 14, y: 13 },
        { mapId: "map_horror_blue_gallery", x: 13, y: 13 },
      ),
    ).toThrow(/시작 맵|좌표|startPos/i);
  });

  it("REJECTS a content-digest mismatch", () => {
    expect(() =>
      assertObservedDigest("abc123", "def456"),
    ).toThrow(/다이제스트|digest|불일치|mismatch/i);
  });

  it("ACCEPTS a matching content digest", () => {
    expect(() => assertObservedDigest("abc123", "abc123")).not.toThrow();
  });
});
