import type {
  AudioDescriptionOverrides,
  AudioResourceKind,
  ResourceProfile,
  UploadedAsset,
} from "@/project/types";
import { getAudioDescriptionOverride } from "@/project/audioDescriptions";
import { bgmCdnBase } from "./bgmCdn";
import { findBgmRuntimeEntry } from "./bgmCatalogRuntime";
import { getAudioAiDescription } from "./audioAiDescriptions";
import { isBgmFileInstalled } from "./installedBgm";
import { BGM_CATALOG, bgmTrackLabel } from "./bgmCatalog";
import { CC0_AUDIO_ASSETS } from "./cc0AudioAssets";
import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS } from "./easyrpgRtp";
import { builtinGeneratedResourceIds } from "./generatedAssetResourceResolver";
import { GENERATED_ASSET_PLAN } from "./oprnGeneratedAssetPlan";
import { moodTagsForAsset } from "./resourceMoodTags";
import { SE_CATALOG } from "./seCatalog";

export function isCatalogBgmAvailable(resourceId: string): boolean {
  const bgm = findBgmRuntimeEntry(resourceId);
  return !bgm || bgmCdnBase() !== null || isBgmFileInstalled(bgm.fileName);
}

export type AudioResourceProject = {
  readonly audioDescriptions?: AudioDescriptionOverrides;
  readonly resourceProfiles: readonly Pick<ResourceProfile, "kind" | "name" | "assetId">[];
  readonly assets: {
    readonly uploaded: Readonly<Record<string, Pick<UploadedAsset, "kind" | "name">>>;
  };
};

export type AudioDescriptionSource =
  | "project"
  | "ai-listening"
  | "catalog-brief"
  | "metadata-derived"
  | "missing";

export const AUDIO_DESCRIPTION_SOURCE_LABELS = {
  project: "프로젝트 설명",
  "ai-listening": "AI 분석 초안",
  "catalog-brief": "곡 기획 설명",
  "metadata-derived": "메타데이터 기반 설명",
  missing: "설명 없음",
} as const satisfies Readonly<Record<AudioDescriptionSource, string>>;

export type AudioResource = {
  readonly id: string;
  readonly kind: AudioResourceKind;
  readonly name: string;
  readonly tags: readonly string[];
  readonly description: string;
  readonly descriptionSource: AudioDescriptionSource;
};

const AUDIO_ID_PREFIXES = {
  music: ["easyrpg-music-", "cc0-music-", "cc0-bgm-"],
  sound: ["easyrpg-sound-", "cc0-sound-", "cc0-se-"],
} as const satisfies Record<AudioResourceKind, readonly string[]>;

/** Preserve the existing generated/profile eligibility rules. */
function matchesAudioKind(
  kind: AudioResourceKind,
  resourceKind: string | undefined,
  id: string,
): boolean {
  return resourceKind === kind || AUDIO_ID_PREFIXES[kind].some(prefix => id.startsWith(prefix));
}

/**
 * Editor metadata only. Enumeration does not establish playback capability,
 * register orphan IDs, or write catalog defaults into the project.
 */
export function listAudioResources(
  kind: AudioResourceKind,
  project: AudioResourceProject,
): readonly AudioResource[] {
  // Local accumulator preserves the first occurrence and source ordering.
  const resources = new Map<string, AudioResource>();
  const add = (
    id: string,
    name: string,
    metadata: Pick<AudioResource, "tags" | "description" | "descriptionSource"> = {
      tags: [],
      description: "",
      descriptionSource: "missing",
    },
  ): void => {
    if (id.length === 0 || resources.has(id)) return;
    if (!isCatalogBgmAvailable(id)) return;
    resources.set(id, { id, kind, name: name || id, ...metadata });
  };

  const addCatalog: Record<AudioResourceKind, () => void> = {
    music: () => {
      for (const track of BGM_CATALOG) {
        add(track.id, bgmTrackLabel(track), {
          tags: [...track.tags, track.category, track.titleEn, track.trackCode],
          description: track.brief,
          descriptionSource: "catalog-brief",
        });
      }
    },
    sound: () => {
      for (const entry of SE_CATALOG) {
        add(entry.id, `${entry.title} — ${entry.category} (${entry.seconds.toFixed(2)}s)`, {
          tags: [...entry.tags, entry.category, entry.baseName],
          description: `${entry.title} — ${entry.category}; ${entry.seconds.toFixed(2)}s; ${entry.tags.join(", ")}`,
          descriptionSource: "metadata-derived",
        });
      }
    },
  };
  addCatalog[kind]();

  for (const asset of CC0_AUDIO_ASSETS) {
    if (asset.kind !== kind) continue;
    add(asset.id, asset.name, {
      tags: ["cc0", kind],
      description: `${asset.name} (${kind})`,
      descriptionSource: "metadata-derived",
    });
  }

  const legacy = { music: EASYRPG_MUSIC_ASSETS, sound: EASYRPG_SOUND_ASSETS };
  for (const asset of legacy[kind]) {
    const tags = moodTagsForAsset(asset);
    add(asset.id, asset.name, {
      tags,
      description: [asset.name, ...tags].join(" · "),
      descriptionSource: "metadata-derived",
    });
  }

  for (const asset of GENERATED_ASSET_PLAN.assets) {
    if (asset.status !== "promoted") continue;
    if (matchesAudioKind(kind, asset.resourceKind, asset.resourceId)) {
      add(asset.resourceId, asset.resourceId);
    }
  }
  for (const id of builtinGeneratedResourceIds()) {
    if (matchesAudioKind(kind, undefined, id)) add(id, id);
  }

  for (const profile of project.resourceProfiles) {
    const id = profile.assetId;
    if (!id || Object.hasOwn(project.assets.uploaded, id)) continue;
    if (matchesAudioKind(kind, profile.kind, id)) add(id, profile.name);
  }
  for (const [id, uploaded] of Object.entries(project.assets.uploaded)) {
    // Unlike legacy prefix inference, an upload's explicit kind is authoritative.
    if (uploaded.kind === kind) add(id, uploaded.name);
  }

  return [...resources.values()].map(resource => {
    const override = getAudioDescriptionOverride(project.audioDescriptions, {
      kind,
      resourceId: resource.id,
    });
    if (override !== undefined) {
      return { ...resource, description: override, descriptionSource: "project" };
    }
    const draft = getAudioAiDescription(kind, resource.id);
    return draft === undefined
      ? resource
      : { ...resource, description: draft, descriptionSource: "ai-listening" };
  });
}
