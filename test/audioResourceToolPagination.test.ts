import { describe, expect, it } from "vitest";
import { searchResources } from "@/assets/resourceSearch";
import { runTool } from "@/editor/tools/toolRunner";
import {
  AUDIO_SEARCH_DATA_URL,
  AUDIO_SEARCH_ID,
  AUDIO_SEARCH_SENTINEL,
  audioSearchProject,
} from "./support/audioSearchFixture";

describe("list_resources pagination", () => {
  it.each([
    { offset: undefined, limit: undefined, start: 0, count: 20, next: 20 },
    { offset: 0, limit: 1, start: 0, count: 1, next: 1 },
    { offset: 0, limit: 50, start: 0, count: 50, next: 50 },
    { offset: 20, limit: 20, start: 20, count: 20, next: 40 },
    { offset: 50, limit: 50, start: 50, count: 3, next: null },
    { offset: 53, limit: 20, start: 53, count: 0, next: null },
    { offset: 70, limit: 20, start: 70, count: 0, next: null },
  ])("returns the requested slice when offset=$offset and limit=$limit", spec => {
    // Given
    const project = audioSearchProject();
    const ids = Array.from({ length: 53 }, (_, index) => `qa-page-${index}`);
    project.resourceProfiles = [];
    project.assets.uploaded = Object.fromEntries(ids.map(id => [
      id,
      { id, kind: "music" as const, name: id, dataUrl: AUDIO_SEARCH_DATA_URL, meta: {} },
    ]));
    project.audioDescriptions = {
      music: Object.fromEntries(ids.map(id => [id, AUDIO_SEARCH_SENTINEL])),
    };
    // When
    const result = runTool({ project }, "list_resources", {
      kind: "bgm",
      query: AUDIO_SEARCH_SENTINEL,
      ...(spec.offset === undefined ? {} : { offset: spec.offset }),
      ...(spec.limit === undefined ? {} : { limit: spec.limit }),
    });
    // Then
    expect(result).toMatchObject({
      ok: true,
      data: {
        matches: ids.slice(spec.start, spec.start + spec.count).map(id =>
          expect.objectContaining({ id: `bgm:${id}`, resourceId: id }),
        ),
        total: 53,
        nextOffset: spec.next,
      },
    });
  });

  it.each([
    { offset: -1 }, { offset: 0.5 }, { offset: NaN },
    { offset: Infinity }, { offset: null }, { offset: "bad" },
    { limit: 0 }, { limit: -1 }, { limit: 51 },
    { limit: 1.5 }, { limit: Infinity }, { limit: null },
  ])("rejects invalid pagination when arguments are %j", pagination => {
    // Given
    const project = audioSearchProject();
    // When
    const result = runTool({ project }, "list_resources", {
      kind: "bgm",
      query: "*",
      ...pagination,
    });
    // Then
    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]),
    });
  });

  it.each([239, 240, 241])("clips only tool-list descriptions when their length is %i UTF-16 units", length => {
    // Given: the supplementary character exercises UTF-16 rather than code-point counting.
    const description = `🙂${"x".repeat(length - 2)}`;
    const project = audioSearchProject("music", description);
    const options = { charsetLabels: [], audioProject: project };
    const full = searchResources("bgm", description, options);
    // When
    const result = runTool({ project }, "list_resources", { kind: "bgm", query: description });
    // Then
    expect(full).toEqual([expect.objectContaining({ description })]);
    expect(result).toMatchObject({
      ok: true,
      data: {
        matches: [{
          resourceId: AUDIO_SEARCH_ID,
          description: description.slice(0, 240),
          descriptionTruncated: length > 240,
        }],
        total: 1,
        nextOffset: null,
      },
    });
  });

  it("returns an exhausted page when the query has no matches", () => {
    // Given
    const project = audioSearchProject();
    // When
    const result = runTool({ project }, "list_resources", {
      kind: "bgm", query: "NO_MATCH_617AFF",
    });
    // Then
    expect(result).toMatchObject({
      ok: true, data: { matches: [], total: 0, nextOffset: null },
    });
  });

  it("retains the non-audio default cap and result shape when browsing charsets", () => {
    // Given
    const project = audioSearchProject();
    const all = searchResources("charset", "*", { charsetLabels: project.charsetLabels });
    // When
    const result = runTool({ project }, "list_resources", { kind: "charset", query: "*" });
    // Then
    expect(result).toMatchObject({
      ok: true,
      data: { matches: all.slice(0, 20), total: all.length, nextOffset: 20 },
    });
  });
});
