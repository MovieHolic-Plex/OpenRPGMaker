import { expect, it } from "vitest";
import { canonicalJsonOf, canonicalJsonString } from "@/project/persistence/core/canonicalJson";
import { authoredIdentity, composeProjectIdentity, contentIdentity, projectIdentityParts } from "@/project/authoredProjectBaseline";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// 체크포인트 적용 권위는 이 문자열의 **동일성**에 산다. 빠른 경로는 예전 왕복과 글자까지 같아야 한다.
const roundtrip = (value: unknown): string => canonicalJsonString(JSON.parse(JSON.stringify(value)));

it("matches the stringify → parse → canonical round trip on JSON edge cases", () => {
  const sparse: unknown[] = [1, , 3]; // eslint-disable-line no-sparse-arrays
  const values: unknown[] = [
    { z: 1, a: { y: [3, 2, 1], b: null }, m: "한글   \"따옴표\"" },
    { u: undefined, f() { return 1; }, s: Symbol("x"), keep: 0 },
    [undefined, () => 1, Symbol("y"), NaN, Infinity, -0, 1e21, 5e-7],
    sparse,
    { when: new Date(0), boxed: [new Number(3), new String("s"), new Boolean(false)] },
    { custom: { toJSON: (key: string) => ({ key, v: [1, { b: 2, a: 1 }] }) } },
    { nested: [{ b: 1, a: [{ d: undefined, c: [null] }] }], "10": "n", "2": "m", "": "empty" },
    { lone: "\ud800", emoji: "😀" },
    Object.assign(Object.create(null), { b: 1, a: 2 }),
    "text", 42, true, null,
  ];
  for (const value of values) expect(canonicalJsonOf(value)).toBe(roundtrip(value));
  expect(canonicalJsonOf(undefined)).toBeUndefined();
  expect(() => contentIdentity(undefined)).toThrow();
});

it("composes proposal, authored and complete identities exactly as the full serializations", () => {
  const project = createBlankProject() as Project & Record<string, unknown>;
  project.world = {
    entities: [
      { id: "npc", type: "character", name: "NPC", summary: "사람", origin: "user" },
      { id: "doc", type: "guideline", name: "지침", summary: "문서", origin: "user" },
    ],
    relations: [{ a: "npc", b: "place", kind: "locatedIn" }],
  } as Project["world"];
  project.optionalGone = undefined;
  const parts = projectIdentityParts(project);
  expect(composeProjectIdentity(parts, "proposal")).toBe(roundtrip({ ...project, world: undefined }));
  expect(composeProjectIdentity(parts, "complete")).toBe(roundtrip(project));
  const { world, ...rest } = project;
  const legacyAuthored = roundtrip({ ...rest, world: {
    entities: world!.entities.filter(entity => !entity.wiki && entity.type !== "guideline"),
    relations: world!.relations,
  } });
  expect(composeProjectIdentity(parts, "authored")).toBe(legacyAuthored);
  expect(authoredIdentity(project)).toBe(legacyAuthored);
  delete (project as { world?: unknown }).world;
  expect(composeProjectIdentity(projectIdentityParts(project), "complete")).toBe(roundtrip(project));
});
