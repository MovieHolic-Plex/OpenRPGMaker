import { afterEach, describe, expect, it, vi } from "vitest";
import { listAudioResources, type AudioResourceProject } from "@/assets/audioResourceCatalog";
import { BGM_CATALOG, bgmTrackLabel } from "@/assets/bgmCatalog";
import { CC0_MUSIC_ASSETS, CC0_SOUND_ASSETS } from "@/assets/cc0AudioAssets";
import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import * as generatedRegistry from "@/assets/generatedAssetResourceResolver";
import { moodTagsForAsset } from "@/assets/resourceMoodTags";
import { SE_CATALOG } from "@/assets/seCatalog";

// The real manifest currently has no audio entries. Substitute only its metadata
// provider so promotion eligibility is exercised rather than vacuously passing.
vi.mock("@/assets/oprnGeneratedAssetPlan", () => ({
  GENERATED_ASSET_PLAN: {
    assets: [
      { resourceId: "qa-generated-music", resourceKind: "music", status: "promoted" },
      { resourceId: "qa-generated-sound", resourceKind: "sound", status: "promoted" },
      { resourceId: "qa-pending-music", resourceKind: "music", status: "planned" },
      { resourceId: "cc0-bgm-qa-promoted", resourceKind: "picture", status: "promoted" },
    ],
  },
}));

afterEach(() => vi.restoreAllMocks());

const empty: AudioResourceProject = {
  assets: { uploaded: {} },
  resourceProfiles: [],
};

describe("shared audio resource catalog", () => {
  it.each(["music", "sound"] as const)("preserves all builtin IDs and their order when listing %s", (kind) => {
    // Given
    const sources = {
      music: [...BGM_CATALOG, ...CC0_MUSIC_ASSETS, ...EASYRPG_MUSIC_ASSETS],
      sound: [...SE_CATALOG, ...CC0_SOUND_ASSETS, ...EASYRPG_SOUND_ASSETS],
    };
    const expectedIds = [...new Set(sources[kind].map(entry => entry.id))];
    // When
    const resources = listAudioResources(kind, empty);
    // Then
    expect(resources.slice(0, expectedIds.length).map(entry => entry.id)).toEqual(expectedIds);
    expect(resources.every(entry => entry.kind === kind)).toBe(true);
    expect(new Set(resources.map(entry => entry.id)).size).toBe(resources.length);
  });

  it("uses shipped briefs when listing catalog BGM without an override", () => {
    // Given / When
    const resources = new Map(listAudioResources("music", empty).map(entry => [entry.id, entry]));
    // Then
    for (const track of BGM_CATALOG) {
      expect(resources.get(track.id)).toMatchObject({
        name: bgmTrackLabel(track),
        description: track.brief,
        descriptionSource: "catalog-brief",
      });
      expect(resources.get(track.id)?.tags).toEqual(expect.arrayContaining([...track.tags]));
    }
  });

  it("labels derived metadata when listing catalog SE", () => {
    // Given / When
    const resources = new Map(listAudioResources("sound", empty).map(entry => [entry.id, entry]));
    // Then
    for (const entry of SE_CATALOG) {
      expect(resources.get(entry.id)?.descriptionSource).toBe("metadata-derived");
      expect(resources.get(entry.id)?.description.length).toBeGreaterThan(0);
      expect(resources.get(entry.id)?.tags).toEqual(expect.arrayContaining([...entry.tags]));
    }
  });

  it.each(["music", "sound"] as const)("retains existing legacy tags when listing %s", (kind) => {
    // Given
    const legacy = { music: EASYRPG_MUSIC_ASSETS, sound: EASYRPG_SOUND_ASSETS };
    // When
    const resources = new Map(listAudioResources(kind, empty).map(entry => [entry.id, entry]));
    // Then
    for (const asset of legacy[kind]) {
      expect(resources.get(asset.id)).toMatchObject({
        name: asset.name,
        descriptionSource: "metadata-derived",
        tags: moodTagsForAsset(asset),
      });
    }
  });

  it("uses metadata rather than missing descriptions when listing the small CC0 set", () => {
    // Given / When
    const resources = [
      ...listAudioResources("music", empty),
      ...listAudioResources("sound", empty),
    ];
    // Then
    for (const asset of [...CC0_MUSIC_ASSETS, ...CC0_SOUND_ASSETS]) {
      expect(resources.find(entry => entry.id === asset.id)).toMatchObject({
        name: asset.name,
        descriptionSource: "metadata-derived",
      });
    }
  });

  it.each(["", "AUDIO_DESC_QA_20260906"])("suppresses the inherited brief when an override is %j", (description) => {
    // Given
    const id = "cc0-bgm-rtp-fld-001";
    const project: AudioResourceProject = {
      ...empty,
      audioDescriptions: { music: { [id]: description } },
    };
    // When
    const entry = listAudioResources("music", project).find(resource => resource.id === id);
    // Then
    expect(entry).toMatchObject({ id, description, descriptionSource: "project" });
    expect(entry?.tags).toEqual(
      listAudioResources("music", empty).find(resource => resource.id === id)?.tags,
    );
    const original = BGM_CATALOG.find(track => track.id === id);
    expect(original).toBeDefined();
    expect(entry?.tags).not.toContain(original?.brief);
  });

  it("does not register resources when only orphan overrides exist", () => {
    // Given
    const project: AudioResourceProject = {
      ...empty,
      audioDescriptions: { music: { qa_orphan: "authored" }, sound: { qa_orphan: "" } },
    };
    // When
    const resources = [...listAudioResources("music", project), ...listAudioResources("sound", project)];
    // Then
    expect(resources.some(entry => entry.id === "qa_orphan")).toBe(false);
  });

  it("includes only promoted generated entries when listing declared audio", () => {
    // Given / When
    const music = listAudioResources("music", empty);
    const sound = listAudioResources("sound", empty);
    // Then
    expect(music.find(entry => entry.id === "qa-generated-music")).toMatchObject({
      description: "", descriptionSource: "missing",
    });
    expect(sound.find(entry => entry.id === "qa-generated-sound")).toMatchObject({
      description: "", descriptionSource: "missing",
    });
    expect(music.some(entry => entry.id === "qa-pending-music")).toBe(false);
    expect(music.some(entry => entry.id === "qa-generated-sound")).toBe(false);
    expect(music.some(entry => entry.id === "cc0-bgm-qa-promoted")).toBe(true);
  });

  it("uses existing prefix eligibility when enumerating registered generated IDs", () => {
    // Given
    vi.spyOn(generatedRegistry, "builtinGeneratedResourceIds").mockReturnValue([
      "cc0-bgm-qa-registered", "cc0-se-qa-registered", "generated-picture-qa",
      "cc0-bgm-qa-promoted",
    ]);
    // When
    const music = listAudioResources("music", empty);
    const sound = listAudioResources("sound", empty);
    // Then
    expect(music.find(entry => entry.id === "cc0-bgm-qa-registered")?.descriptionSource).toBe("missing");
    expect(sound.find(entry => entry.id === "cc0-se-qa-registered")?.descriptionSource).toBe("missing");
    expect(music.filter(entry => entry.id === "cc0-bgm-qa-promoted")).toHaveLength(1);
    expect(music.some(entry => entry.id === "generated-picture-qa")).toBe(false);
  });

  it("orders profiles before uploads while uploaded names win over duplicate profiles", () => {
    // Given
    const project: AudioResourceProject = {
      resourceProfiles: [
        { kind: "music", assetId: "qa_shared", name: "profile-name" },
        { kind: "music", assetId: "qa_profile", name: "profile-only" },
        { kind: "music", name: "unbound-profile" },
      ],
      assets: { uploaded: { qa_shared: { kind: "music", name: "upload-name" } } },
      audioDescriptions: { music: { qa_shared: "AUDIO_DESC_QA_20260906" } },
    };
    // When
    const resources = listAudioResources("music", project);
    // Then
    expect(resources.slice(-2)).toMatchObject([
      { id: "qa_profile", name: "profile-only", description: "", descriptionSource: "missing" },
      { id: "qa_shared", name: "upload-name", description: "AUDIO_DESC_QA_20260906", descriptionSource: "project" },
    ]);
    expect(resources.filter(entry => entry.id === "qa_shared")).toHaveLength(1);
  });

  it.each(["sound", "picture"] as const)("honors explicit uploaded %s despite a music profile and prefix", (uploadedKind) => {
    // Given
    const id = "cc0-bgm-qa-upload";
    const project: AudioResourceProject = {
      resourceProfiles: [{ kind: "music", assetId: id, name: "profile" }],
      assets: { uploaded: { [id]: { kind: uploadedKind, name: "explicit-upload" } } },
    };
    // When
    const resources = listAudioResources("music", project);
    // Then
    expect(resources.some(entry => entry.id === id)).toBe(false);
  });

  it("keeps separate IDs when uploads share the same display name", () => {
    // Given
    const project: AudioResourceProject = {
      ...empty,
      assets: { uploaded: {
        qa_one: { kind: "sound", name: "same-name" },
        qa_two: { kind: "sound", name: "same-name" },
      } },
    };
    // When
    const resources = listAudioResources("sound", project);
    // Then
    expect(resources.slice(-2)).toMatchObject([
      { id: "qa_one", name: "same-name", description: "", descriptionSource: "missing" },
      { id: "qa_two", name: "same-name", description: "", descriptionSource: "missing" },
    ]);
  });

  it("reads current project overrides without mutating or caching input", () => {
    // Given
    const id = "cc0-bgm-rtp-fld-001";
    const projects = ["FIRST", "", "SECOND"].map(description => Object.freeze({
      ...empty,
      audioDescriptions: Object.freeze({ music: Object.freeze({ [id]: description }) }),
    }));
    const before = JSON.stringify(projects);
    // When
    const descriptions = projects.map(project =>
      listAudioResources("music", project).find(entry => entry.id === id)?.description,
    );
    // Then
    expect(descriptions).toEqual(["FIRST", "", "SECOND"]);
    expect(JSON.stringify(projects)).toBe(before);
    expect(Object.hasOwn(empty, "audioDescriptions")).toBe(false);
  });
});
