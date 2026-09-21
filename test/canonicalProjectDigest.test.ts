import { describe, expect, it } from "vitest";
import {
  canonicalProjectDigest,
  stableProjectSerialize,
  browserCanonicalDigestSource,
  evaluateBrowserCanonicalDigest,
} from "../scripts/lib/canonical-project-digest.mjs";
import { createBlankProject } from "../src/project/defaults";
import type { Project } from "../src/project/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The break: `qa:horror` (Slice A) binds the browser to the project via projectId only,
 * so any LegacyDb row with the matching id passes even when its real content differs. A
 * deterministic digest over the actual project data — computed independently on Node and in the
 * browser from that same data — is required, and a mismatch must fail. A shift of startMapId
 * or startPos x/y in the loaded content must be rejected, not silently accepted.
 *
 * This names the break: derive expected from the actual project object, calculate the digest
 * deterministically, and refuse when the observed digest differs.
 */
describe("canonical project content digest", () => {
  function sampleProject(): Project {
    const project = createBlankProject();
    project.meta.title = "푸른 액자의 밤";
    project.startMapId = "map_horror_blue_gallery";
    project.startPos = { x: 13, y: 13 };
    project.maps = {
      map_horror_blue_gallery: {
        id: "map_horror_blue_gallery",
        name: "푸른 액자 전시실",
        width: 26,
        height: 18,
        tilesetId: "default",
        tileSize: 16,
        lowerTiles: [],
        upperTiles: [],
        events: [],
        bgm: { mode: "custom", resourceId: "cc0-bgm-dungeon", fadeInMs: 800 },
      } as Project["maps"][string],
    };
    project.mapTree = { mapId: "map_horror_blue_gallery", children: [] };
    return project;
  }

  it("REJECTS two different contents (mismatched digest)", () => {
    const a = canonicalProjectDigest(sampleProject());
    const b = canonicalProjectDigest({ ...sampleProject(), startPos: { x: 12, y: 13 } });
    expect(a).not.toBe(b);
  });

  it("is deterministic: same content yields same digest", () => {
    const a = canonicalProjectDigest(sampleProject());
    const b = canonicalProjectDigest(sampleProject());
    expect(a).toBe(b);
  });

  it("is stable under key reordering (canonical serialize)", () => {
    // Both browser and LegacyDb project data arrive as parsed JSON, so compare two
    // different orderings of the same JSON-normalized object.
    const normalized = JSON.parse(JSON.stringify(sampleProject()));
    const a = canonicalProjectDigest(normalized);
    // Move the first key to last to reorder object keys (content unchanged).
    const keys = Object.keys(normalized);
    const first = keys[0];
    const reordered: Record<string, unknown> = {};
    for (const key of keys) {
      if (key !== first) reordered[key] = normalized[key];
    }
    reordered[first] = normalized[first];
    expect(canonicalProjectDigest(reordered)).toBe(a);
  });

  it("stable serialize is a string; digest is 64-hex", () => {
    expect(typeof stableProjectSerialize(sampleProject())).toBe("string");
    expect(stableProjectSerialize(sampleProject())).toMatch(/startMapId/);
    expect(canonicalProjectDigest(sampleProject())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("browser-side digest source reproduces the Node digest (independent same-data agreement)", async () => {
    const fn = new Function(`return ${browserCanonicalDigestSource}`)();
    const browserDigest = await fn(sampleProject());
    expect(browserDigest).toBe(canonicalProjectDigest(sampleProject()));
  });

  it("passes the digest source into the browser evaluator instead of closing over Node scope", async () => {
    const project = sampleProject();
    let receivedSource = "";
    const digest = await evaluateBrowserCanonicalDigest(project, async (fn, input) => {
      receivedSource = input.source;
      return await fn(input);
    });

    expect(receivedSource).toBe(browserCanonicalDigestSource);
    expect(digest).toBe(canonicalProjectDigest(project));
  });
});
