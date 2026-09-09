import { describe, expect, it } from "bun:test";
import { literal, ownedConnection } from "./spatial-db-session.mts";
import { GuardRejectionMismatch, requireStatus } from "./spatial-db-guards.mts";

describe("disposable database proof boundaries", () => {
  it("escapes SQL syntax when a fixture contains apostrophes", () => {
    // Given
    const input = "task20'); DELETE FROM rpg_zzu.projects; --";
    // When
    const encoded = literal(input);
    // Then: all fixture bytes remain inside one SQL string literal.
    expect(encoded).toBe("'task20''); DELETE FROM rpg_zzu.projects; --'");
  });
  it("preserves raw JSON when archive bytes contain quotes", () => {
    // Given
    const input = { backup: { json: '{"name":"legacy\'s shop","goods":[]}' } };
    // When
    const encoded = literal(input);
    // Then
    expect(encoded).toBe(`'${JSON.stringify(input).replaceAll("'", "''")}'`);
  });
  for (const connection of [undefined, "postgresql://production/db", "host=/tmp/foreign/socket dbname=postgres user=main",
    "host=/tmp/spatial-sql-st_01a07acd.valid/socket dbname=postgres user=main host=remote"]) {
    it(`rejects an unowned connection when configured as ${connection ?? "absent"}`, () => {
      // Given: no connection is opened by this parser.
      const original = process.env["SPATIAL_TEST_DATABASE_URL"];
      if (connection === undefined) delete process.env["SPATIAL_TEST_DATABASE_URL"];
      else process.env["SPATIAL_TEST_DATABASE_URL"] = connection;
      try {
        // When / Then
        expect(() => ownedConnection()).toThrow();
      } finally {
        if (original === undefined) delete process.env["SPATIAL_TEST_DATABASE_URL"];
        else process.env["SPATIAL_TEST_DATABASE_URL"] = original;
      }
    });
  }
  it("fails the unchanged rejection assertion when a removed guard accepts a write", () => {
    // Given
    const actual = 200;
    // When / Then
    expect(() => requireStatus(actual, 409)).toThrow(GuardRejectionMismatch);
  });
  it("accepts the rejection when the original guard is restored", () => {
    // Given
    const actual = 409;
    // When / Then
    expect(() => requireStatus(actual, 409)).not.toThrow();
  });
});
