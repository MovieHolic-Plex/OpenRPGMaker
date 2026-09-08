/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { AUDIO_DESCRIPTION_SOURCE_LABELS, listAudioResources, type AudioResourceProject } from "@/assets/audioResourceCatalog";
import data from "@/assets/audioAiDescriptions.json";
import { audioAiDraftDescription, getAudioAiDescription } from "@/assets/audioAiDescriptions";
import { BGM_CATALOG } from "@/assets/bgmCatalog";
import { CC0_MUSIC_ASSETS, CC0_SOUND_ASSETS } from "@/assets/cc0AudioAssets";
import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { SE_CATALOG } from "@/assets/seCatalog";
import { moodTagsForAsset } from "@/assets/resourceMoodTags";
import { searchResources } from "@/assets/resourceSearch";
import { audioDescriptionView } from "@/editor/panels/audioResourcePresentation";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import {
  AUDIO_DESCRIPTION_MAX_LENGTH,
  resetAudioDescriptionOverride,
  setAudioDescriptionOverride,
} from "@/project/audioDescriptions";

const empty: AudioResourceProject = { assets: { uploaded: {} }, resourceProfiles: [] };
const musicId = "cc0-bgm-rtp-fld-001";
const soundId = "cc0-se-orp-interface-interface2";

describe("shared AI audio draft integration", () => {
  it.each([["music", musicId], ["sound", soundId]] as const)(
    "inherits an AI draft for shipped %s without a project override",
    (kind, id) => {
      const resource = listAudioResources(kind, empty).find(entry => entry.id === id);
      expect(resource).toMatchObject({ id, descriptionSource: "ai-listening" });
      expect(resource?.description.length).toBeGreaterThan(0);
    },
  );

  it.each(["", "PROJECT_AUDIO_SENTINEL"])("keeps explicit %j ahead of a draft and resets to the draft", description => {
    const ref = { kind: "music", resourceId: musicId } as const;
    const inherited = listAudioResources("music", empty).find(entry => entry.id === musicId);
    const overrides = setAudioDescriptionOverride(undefined, ref, description);
    expect(listAudioResources("music", { ...empty, audioDescriptions: overrides })
      .find(entry => entry.id === musicId)).toMatchObject({ description, descriptionSource: "project" });
    const reset = resetAudioDescriptionOverride(overrides, ref);
    expect(reset).toBeUndefined();
    const resetProject = reset === undefined ? empty : { ...empty, audioDescriptions: reset };
    const restored = listAudioResources("music", resetProject).find(entry => entry.id === musicId);
    expect(restored).toEqual(inherited);
    expect(restored?.descriptionSource).toBe("ai-listening");
  });

  it.each(["cc0-bgm-rtp-lft-001", "cc0-bgm-rtp-rad-001", "cc0-bgm-rtp-prx-006"])(
    "retains the creative brief for withheld %s", id => {
      const track = BGM_CATALOG.find(entry => entry.id === id);
      expect(track).toBeDefined();
      expect(listAudioResources("music", empty).find(entry => entry.id === id)).toMatchObject({
        description: track?.brief, descriptionSource: "catalog-brief",
      });
    },
  );

  it("does not mutate projects, register orphan overrides, or cross kind partitions", () => {
    const project: AudioResourceProject = {
      ...empty,
      audioDescriptions: { sound: { [musicId]: "WRONG_KIND", orphan: "ORPHAN" } },
      assets: { uploaded: { [musicId]: { kind: "sound", name: "same-id-other-kind" } } },
    };
    const before = JSON.stringify(project);
    const music = listAudioResources("music", project);
    const sound = listAudioResources("sound", project);
    expect(music.find(entry => entry.id === musicId)?.descriptionSource).toBe("ai-listening");
    expect(getAudioAiDescription("sound", musicId)).toBeUndefined();
    expect(getAudioAiDescription("music", soundId)).toBeUndefined();
    expect(getAudioAiDescription("music", "orphan")).toBeUndefined();
    expect(sound.find(entry => entry.id === musicId)).toMatchObject({
      description: "WRONG_KIND", descriptionSource: "project",
    });
    expect([...music, ...sound].some(entry => entry.id === "orphan")).toBe(false);
    expect(JSON.stringify(project)).toBe(before);
    expect(Object.hasOwn(empty, "audioDescriptions")).toBe(false);
  });

  it("ships only valid, unique, known drafts with retained model and review provenance", () => {
    const resources = [listAudioResources("music", empty), listAudioResources("sound", empty)].flat();
    const published = resources.filter(entry => entry.descriptionSource === "ai-listening");
    expect(published).toHaveLength(data.entries.length);
    expect(new Set(data.entries.map(entry => `${entry.kind}:${entry.id}`)).size).toBe(data.entries.length);
    expect(data.source).toBe("ai-listening");
    expect(data.verification).toBe("unverified-ai-draft");
    for (const draft of data.entries) {
      expect(draft.status).toBe("ok");
      expect(draft.result.audio_available).toBe(true);
      expect(audioAiDraftDescription(draft)).toBe(draft.result.description);
      expect(draft.result.description.trim().length).toBeGreaterThan(0);
      expect(draft.result.description.length).toBeLessThanOrEqual(AUDIO_DESCRIPTION_MAX_LENGTH);
      expect(["gemini-3.8-flash-high", "gemini-3.1-pro-high"]).toContain(draft.model);
      expect(["unverified-ai-draft", "human-corrected-ai-draft"]).toContain(draft.review);
      expect(Object.keys(draft.evidence).length).toBeGreaterThan(0);
      expect(resources.find(entry => entry.kind === draft.kind && entry.id === draft.id))
        .toMatchObject({ description: draft.result.description, descriptionSource: "ai-listening" });
    }
    expect(data.entries.find(entry => entry.id === "cc0-bgm-rtp-btl-001"))
      .toMatchObject({ model: "gemini-3.1-pro-high", review: "human-corrected-ai-draft" });
    for (const id of ["cc0-se-orp-npc-slime-slime8", "cc0-se-kis-footstep-carpet-003", "easyrpg-sound-ice9"]) {
      expect(data.entries.find(entry => entry.id === id))
        .toMatchObject({ model: "gemini-3.1-pro-high", review: "unverified-ai-draft" });
    }
    const smoke = data.entries.find(entry => entry.id === "cc0-se-orp-interface-interface1");
    expect(smoke).toMatchObject({ model: "gemini-3.8-flash-high", review: "unverified-ai-draft" });
    expect(smoke).not.toHaveProperty("analyzedAt");
  });

  it.each(["music", "sound"] as const)("preserves builtin ordering and tags for %s", kind => {
    const sources = {
      music: [...BGM_CATALOG, ...CC0_MUSIC_ASSETS, ...EASYRPG_MUSIC_ASSETS],
      sound: [...SE_CATALOG, ...CC0_SOUND_ASSETS, ...EASYRPG_SOUND_ASSETS],
    };
    const ids = [...new Set(sources[kind].map(entry => entry.id))];
    const resources = listAudioResources(kind, empty);
    expect(resources.slice(0, ids.length).map(entry => entry.id)).toEqual(ids);
    for (const resource of resources) {
      const bgm = BGM_CATALOG.find(entry => entry.id === resource.id);
      const se = SE_CATALOG.find(entry => entry.id === resource.id);
      const cc0 = [...CC0_MUSIC_ASSETS, ...CC0_SOUND_ASSETS].find(entry => entry.id === resource.id);
      const legacy = [...EASYRPG_MUSIC_ASSETS, ...EASYRPG_SOUND_ASSETS].find(entry => entry.id === resource.id);
      if (bgm) expect(resource.tags).toEqual([...bgm.tags, bgm.category, bgm.titleEn, bgm.trackCode]);
      else if (se) expect(resource.tags).toEqual([...se.tags, se.category, se.baseName]);
      else if (cc0) expect(resource.tags).toEqual(["cc0", kind]);
      else if (legacy) expect(resource.tags).toEqual(moodTagsForAsset(legacy));
    }
  });

  it("keeps failed MIDI and undescribed uploads on prior metadata", () => {
    const project: AudioResourceProject = {
      ...empty, assets: { uploaded: { qa_missing: { kind: "music", name: "uploaded" } } },
    };
    const resources = listAudioResources("music", project);
    for (const excluded of data.exclusions.filter(entry => entry.reason === "fail")) {
      const asset = EASYRPG_MUSIC_ASSETS.find(entry => entry.id === excluded.id);
      expect(asset).toBeDefined();
      if (!asset) throw new TypeError(`Missing legacy fixture ${excluded.id}`);
      expect(resources.find(entry => entry.id === asset.id)).toMatchObject({
        description: [asset.name, ...moodTagsForAsset(asset)].join(" · "),
        descriptionSource: "metadata-derived",
      });
    }
    expect(resources.find(entry => entry.id === "qa_missing"))
      .toMatchObject({ description: "", descriptionSource: "missing" });
  });

  it.each([["music", musicId, "bgm"], ["sound", soundId, "se"]] as const)(
    "shares shipped %s drafts with search and the actual description view", (kind, id, searchKind) => {
      const draft = data.entries.find(entry => entry.id === id);
      if (!draft) throw new TypeError(`Missing shipped fixture ${id}`);
      const resource = listAudioResources(kind, empty).find(entry => entry.id === id);
      if (!resource) throw new TypeError(`Missing resource fixture ${id}`);
      const metadata = [resource.name, ...resource.tags].map(value => value.toLowerCase());
      const token = draft.result.description.split(/\s+/u)
        .find(word => word.length > 2 && !metadata.some(value => value.includes(word.toLowerCase())));
      if (!token) throw new TypeError(`Missing description-only token for ${id}`);
      const view = audioDescriptionView(resource);
      expect(view.dataset.descriptionSource).toBe("ai-listening");
      expect(view.querySelector('[data-testid="audio-description-text"]')?.textContent).toBe(draft.result.description);
      expect(view.querySelector('[data-testid="audio-description-source"]')?.textContent)
        .toBe(AUDIO_DESCRIPTION_SOURCE_LABELS["ai-listening"]);
      expect(searchResources(searchKind, token, { audioProject: empty }))
        .toContainEqual(expect.objectContaining({ resourceId: id, description: draft.result.description, descriptionSource: "ai-listening" }));
      const cleared = { ...empty, audioDescriptions: { [kind]: { [id]: "" } } };
      expect(searchResources(searchKind, token, { audioProject: cleared })
        .some(entry => entry.resourceId === id)).toBe(false);
    },
  );

  it("does not persist shared defaults when listing then saving a project", () => {
    const project = createBlankProject();
    const before = serialize(project);
    listAudioResources("music", project);
    listAudioResources("sound", project);
    expect(serialize(project)).toBe(before);
    expect(Object.hasOwn(deserialize(before), "audioDescriptions")).toBe(false);
  });
});

describe("AI draft acceptance boundary", () => {
  const valid = { status: "ok", result: { audio_available: true, description: "AI_DRAFT_SENTINEL" } };
  it("accepts the exact bounded description without rewriting it", () => {
    expect(audioAiDraftDescription(valid)).toBe(valid.result.description);
    const description = "x".repeat(AUDIO_DESCRIPTION_MAX_LENGTH);
    expect(audioAiDraftDescription({ ...valid, result: { audio_available: true, description } })).toBe(description);
  });
  it.each([
    {}, { status: "ok" }, { status: "ok", result: null },
    { result: valid.result }, { status: "no-audio", result: valid.result },
    { status: "fail", result: valid.result },
    { status: "ok", result: { description: "FLAG_MISSING" } },
    ...[false, "true", 1].map(audio_available => ({ ...valid, result: { ...valid.result, audio_available } })),
    ...[undefined, "", " \n ", 42, "x".repeat(AUDIO_DESCRIPTION_MAX_LENGTH + 1)]
      .map(description => ({ ...valid, result: { ...valid.result, description } })),
  ])("rejects unsuccessful or incomplete record %#", record => {
    expect(audioAiDraftDescription(record)).toBeUndefined();
  });
});
