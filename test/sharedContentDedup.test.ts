import { describe, expect, it } from "vitest";
import { dedupeSharedContent, inflateSharedContentResponse } from "../src/project/sharedContentDedup";
import type { SharedContentSnapshot } from "../src/project/sharedContentSchema";

const long = (seed: string) => `${seed}:`.repeat(600);

function snapshotWith(...strings: string[]): SharedContentSnapshot {
  return {
    revision: "r1",
    libraries: { a: { version: 1, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, sourceProjectId: "p", previews: Object.fromEntries(strings.map((s, i) => [`k${i}`, s])) } },
  } as unknown as SharedContentSnapshot;
}

describe("shared content transport dedup", () => {
  it("puts a repeated long string on the wire once and restores identical values", () => {
    const original = snapshotWith(long("x"), long("x"), long("y"), "short", "short");
    const deduped = dedupeSharedContent(original)!;
    expect(deduped.strings).toEqual([long("x")]);
    const wire = JSON.stringify(deduped);
    expect(wire.split(long("x")).length - 1).toBe(1);
    expect(inflateSharedContentResponse(JSON.parse(wire))).toEqual(original);
  });

  it("keeps key order and leaves a snapshot without repeats alone", () => {
    expect(dedupeSharedContent(snapshotWith(long("x"), long("y")))).toBeNull();
    const original = snapshotWith(long("x"), long("x"));
    const restored = inflateSharedContentResponse(JSON.parse(JSON.stringify(dedupeSharedContent(original))));
    expect(Object.keys(restored.libraries.a!.previews)).toEqual(["k0", "k1"]);
  });

  it("refuses to dedup when a real string could be mistaken for a marker", () => {
    expect(dedupeSharedContent(snapshotWith(long("x"), long("x"), "\u0000S0"))).toBeNull();
  });

  it("passes an old-format response through untouched", () => {
    const old = snapshotWith(long("x"), long("x"));
    expect(inflateSharedContentResponse(JSON.parse(JSON.stringify(old)))).toEqual(old);
  });
});
