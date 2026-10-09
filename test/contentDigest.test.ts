import { expect, it } from "vitest";
import { canonicalJsonOf } from "@/project/persistence/core/canonicalJson";
import { jsonContentDigest, shareContentDigests } from "@/project/persistence/core/contentDigest";
import { projectIdentityDigest } from "@/project/authoredProjectBaseline";
import { createBlankProject } from "@/project/defaults";

const fresh = (value: unknown) => jsonContentDigest(JSON.parse(JSON.stringify(value)));

it("gives equal digests exactly when canonical JSON is equal", () => {
  const sparse: unknown[] = [1, , 3]; // eslint-disable-line no-sparse-arrays
  const values: unknown[] = [
    { z: 1, a: { y: [3, 2, 1], b: null } }, { a: { b: null, y: [3, 2, 1] }, z: 1 },
    { u: undefined, f() { return 1; }, keep: 0 }, { keep: 0 }, { keep: -0 },
    [undefined, () => 1, NaN, Infinity, -0], [null, null, null, null, 0],
    sparse, [1, null, 3], { when: new Date(0) }, { when: "1970-01-01T00:00:00.000Z" },
    { custom: { toJSON: () => ({ b: 2, a: 1 }) } }, { custom: { a: 1, b: 2 } },
    { long: "숲".repeat(400) }, { long: `${"숲".repeat(399)}나` },
    "text", 42, true, null, "42", [42], ["42"], {}, [], "{}", "[]",
  ];
  for (const left of values) {
    for (const right of values) {
      expect(jsonContentDigest(left) === jsonContentDigest(right)).toBe(canonicalJsonOf(left) === canonicalJsonOf(right));
    }
  }
  expect(jsonContentDigest(undefined)).toBeUndefined();
});

it("detects in-place edits at any depth without a generation bump", () => {
  const project = createBlankProject();
  project.meta.title = "숲🌲".repeat(1000);
  const before = jsonContentDigest(project);
  const map = Object.values(project.maps)[0]!;
  map.lowerTiles[3] = (map.lowerTiles[3] ?? 0) + 1;
  const edited = jsonContentDigest(project);
  expect(edited).not.toBe(before);
  expect(edited).toBe(fresh(project));
  map.lowerTiles[3] = (map.lowerTiles[3] ?? 0) - 1;
  expect(jsonContentDigest(project)).toBe(before);
  const holder: Record<string, unknown> = { child: { text: "x".repeat(300) } };
  const withChild = jsonContentDigest(holder);
  holder.child = undefined;
  expect(jsonContentDigest(holder)).not.toBe(withChild);
  expect(jsonContentDigest(holder)).toBe(fresh(holder));
});

it("keeps shared memories correct for clones, stale sources and mismatched pairs", () => {
  const source = createBlankProject();
  const digest = jsonContentDigest(source);
  const copy = structuredClone(source);
  shareContentDigests(source, copy);
  expect(jsonContentDigest(copy)).toBe(digest);
  source.meta.title = "원본만 바뀜";
  expect(jsonContentDigest(copy)).toBe(digest);
  const stale = structuredClone(source);
  shareContentDigests(source, stale);
  expect(jsonContentDigest(stale)).toBe(fresh(source));
  const a = { x: { y: [1, { z: "a".repeat(300) }] } };
  jsonContentDigest(a);
  const b = { x: { y: [2, { z: "b".repeat(300) }] } };
  shareContentDigests(a, b);
  expect(jsonContentDigest(b)).toBe(fresh(b));
});

it("distinguishes proposal, authored and complete project identities like the full strings", () => {
  const project = createBlankProject();
  project.world = {
    entities: [
      { id: "npc", type: "character", name: "NPC", summary: "사람", origin: "user" },
      { id: "doc", type: "guideline", name: "지침", summary: "문서", origin: "user" },
    ],
    relations: [],
  } as typeof project.world;
  const proposal = projectIdentityDigest(project, "proposal");
  const authored = projectIdentityDigest(project, "authored");
  project.world!.entities[1]!.summary = "지침만 바뀜";
  expect(projectIdentityDigest(project, "proposal")).toBe(proposal);
  expect(projectIdentityDigest(project, "authored")).toBe(authored);
  project.world!.entities[0]!.summary = "인물이 바뀜";
  expect(projectIdentityDigest(project, "authored")).not.toBe(authored);
  expect(projectIdentityDigest(project, "proposal")).toBe(proposal);
});
