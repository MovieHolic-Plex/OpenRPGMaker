import { describe, expect, it } from "vitest";
import { searchResources } from "@/assets/resourceSearch";
import { runTool } from "@/editor/tools/toolRunner";
import {
  AUDIO_SEARCH_ID,
  AUDIO_SEARCH_SENTINEL,
  audioSearchProject,
  catalogDescriptionProbe,
} from "./support/audioSearchFixture";

describe("effective audio description search", () => {
  it.each([
    ["music", "bgm"],
    ["sound", "se"],
  ] as const)("finds a description-only upload when searching %s", (audioKind, searchKind) => {
    // Given: the sentinel is absent from names, IDs, and tags.
    const project = audioSearchProject(audioKind);
    const options = { charsetLabels: [], audioProject: project };
    // When
    const matches = searchResources(searchKind, AUDIO_SEARCH_SENTINEL, options);
    // Then
    expect(matches).toEqual([
      expect.objectContaining({
        id: `${searchKind}:${AUDIO_SEARCH_ID}`,
        resourceId: AUDIO_SEARCH_ID,
        label: "upload-name",
        description: AUDIO_SEARCH_SENTINEL,
        descriptionSource: "project",
        score: 40,
      }),
    ]);
  });

  it.each([
    ["music", "bgm"],
    ["sound", "se"],
  ] as const)("returns the same authored result through the AI tool for %s", (audioKind, kind) => {
    // Given
    const project = audioSearchProject(audioKind);
    // When
    const result = runTool({ project }, "list_resources", {
      kind,
      query: AUDIO_SEARCH_SENTINEL,
    });
    // Then
    expect(result).toMatchObject({
      ok: true,
      data: {
        matches: [{
          id: `${kind}:${AUDIO_SEARCH_ID}`,
          resourceId: AUDIO_SEARCH_ID,
          label: "upload-name",
          description: AUDIO_SEARCH_SENTINEL,
          descriptionSource: "project",
          descriptionTruncated: false,
        }],
        total: 1,
        nextOffset: null,
      },
    });
  });

  it.each(["", AUDIO_SEARCH_SENTINEL])("suppresses the old brief when the override is %j", description => {
    // Given
    const { track, token } = catalogDescriptionProbe();
    const project = audioSearchProject();
    project.audioDescriptions = { music: { [track.id]: description } };
    const options = { charsetLabels: [], audioProject: project };
    // When
    const matches = searchResources("bgm", token, options);
    // Then
    expect(matches.map(match => match.id)).not.toContain(`bgm:${track.id}`);
  });

  it.each(["", AUDIO_SEARCH_SENTINEL])("suppresses the inherited AI result when the override is %j", description => {
    // Given
    const { track, token } = catalogDescriptionProbe();
    const project = audioSearchProject();
    project.audioDescriptions = { music: { [track.id]: description } };
    // When
    const result = runTool({ project }, "list_resources", { kind: "bgm", query: token });
    // Then
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(expect.objectContaining({
      matches: expect.not.arrayContaining([
        expect.objectContaining({ id: `bgm:${track.id}` }),
      ]),
    }));
  });

  it("restores the shipped brief when the override key is absent", () => {
    // Given
    const { track, token } = catalogDescriptionProbe();
    const project = audioSearchProject();
    project.audioDescriptions = {};
    const options = { charsetLabels: [], audioProject: project };
    // When
    const matches = searchResources("bgm", token, options);
    // Then: shipped-copy equality, not a pinned prose fragment.
    expect(matches).toContainEqual(expect.objectContaining({
      id: `bgm:${track.id}`,
      resourceId: track.id,
      description: track.brief,
      descriptionSource: "catalog-brief",
    }));
  });

  it("restores the AI catalog result when the override key is absent", () => {
    // Given
    const { track, token } = catalogDescriptionProbe();
    const project = audioSearchProject();
    project.audioDescriptions = {};
    // When
    const result = runTool({ project }, "list_resources", { kind: "bgm", query: token });
    // Then
    expect(result).toMatchObject({
      ok: true,
      data: {
        matches: expect.arrayContaining([expect.objectContaining({
          id: `bgm:${track.id}`,
          resourceId: track.id,
          description: track.brief.slice(0, 240),
          descriptionSource: "catalog-brief",
          descriptionTruncated: track.brief.length > 240,
        })]),
      },
    });
  });

  it("uses the supplied project when a previous search used a different project", () => {
    // Given
    const first = audioSearchProject("music", "PROJECT_ONE_41A");
    const second = audioSearchProject("music", "PROJECT_TWO_92B");
    const firstOptions = { charsetLabels: [], audioProject: first };
    searchResources("bgm", "*", firstOptions);
    const options = { charsetLabels: [], audioProject: second };
    // When
    const matches = searchResources("bgm", "PROJECT_TWO_92B", options);
    // Then
    expect(matches).toEqual([expect.objectContaining({
      resourceId: AUDIO_SEARCH_ID,
      description: "PROJECT_TWO_92B",
    })]);
  });

  it("uses the new project when the AI context switches projects", () => {
    // Given
    const context = { project: audioSearchProject("music", "PROJECT_ONE_41A") };
    runTool(context, "list_resources", { kind: "bgm", query: "PROJECT_ONE_41A" });
    context.project = audioSearchProject("music", "PROJECT_TWO_92B");
    // When
    const result = runTool(context, "list_resources", { kind: "bgm", query: "PROJECT_TWO_92B" });
    // Then
    expect(result).toMatchObject({
      ok: true,
      data: {
        matches: [{ resourceId: AUDIO_SEARCH_ID, description: "PROJECT_TWO_92B" }],
        total: 1,
        nextOffset: null,
      },
    });
  });

  it("deduplicates upload/profile IDs when browsing audio", () => {
    // Given
    const options = { charsetLabels: [], audioProject: audioSearchProject() };
    // When
    const matches = searchResources("bgm", "*", options);
    // Then
    expect(matches.filter(match => match.id === `bgm:${AUDIO_SEARCH_ID}`))
      .toEqual([expect.objectContaining({ label: "upload-name" })]);
    expect(matches).toContainEqual(expect.objectContaining({
      id: "bgm:qa-audio-profile-only",
      description: "",
      descriptionSource: "missing",
    }));
  });

  it("preserves whole-query and split-query scoring when descriptions are searched", () => {
    // Given
    const options = {
      charsetLabels: [],
      audioProject: audioSearchProject("music", "ALPHA_61 BETA_92"),
    };
    // When
    const scores = ["ALPHA_61 BETA_92", "ALPHA_61", "BETA_92 ALPHA_61"]
      .map(query => searchResources("bgm", query, options)[0]?.score);
    // Then
    expect(scores).toEqual([40, 20, 60]);
  });
});
