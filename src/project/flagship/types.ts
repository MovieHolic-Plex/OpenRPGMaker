import type { NewProjectChoiceId } from "@/editor/newProjectChoices";
import type { Project } from "@/project/types";

export const FLAGSHIP_DEMO_IDS = [
  "chrono-bell",
  "emerald-crown",
  "shitamachi-fourth-season",
  "first-love",
  "isekai-godding",
] as const;

export type FlagshipDemoId = (typeof FLAGSHIP_DEMO_IDS)[number];

export interface FlagshipBeat {
  readonly id: string;
  /** Target elapsed minute in the canonical playthrough pacing curve. */
  readonly atMinute: number;
  readonly act: string;
  readonly mapKey: string;
  readonly sceneTitle: string;
  /** What the player experiences / tactile hook in this beat. */
  readonly playerFeel: string;
  /** Engine commands & authoring tools exercised in this beat. */
  readonly mechanics: readonly string[];
  /** Bundled shared asset IDs / tilesets / sprites locked for this beat. */
  readonly sharedAssets: readonly string[];
}

export interface FlagshipCastMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly assetId: string;
}

export interface FlagshipStyleLock {
  readonly demoId: FlagshipDemoId;
  readonly presetId: NewProjectChoiceId;
  readonly resolution: { readonly width: number; readonly height: number };
  readonly cameraZoom: number;
  readonly dialogueStyle: string;
  readonly allowedTilesetIds: readonly string[];
  readonly allowedCharsetPrefixes: readonly string[];
  readonly allowedPortraitPrefixes: readonly string[];
  /** Copyrighted IP proper nouns that must never appear in the canonical demo. */
  readonly bannedProperNouns: readonly string[];
}

export interface FlagshipBeatManifest {
  readonly id: FlagshipDemoId;
  readonly title: string;
  readonly subtitle: string;
  readonly genreChoiceId: NewProjectChoiceId;
  readonly targetMinutes: number;
  readonly mapCount: number;
  readonly endingCount: number;
  readonly releaseOrder: 1 | 2 | 3 | 4 | 5 | 6;
  readonly priorityRank: 1 | 2 | 3 | 4 | 5 | 6;
  readonly summary: string;
  readonly thumb: string;
  readonly cast: readonly FlagshipCastMember[];
  readonly beats: readonly FlagshipBeat[];
  readonly styleLock: FlagshipStyleLock;
}

export interface FlagshipDemoBuildResult {
  readonly id: FlagshipDemoId;
  readonly manifest: FlagshipBeatManifest;
  readonly project: Project;
  readonly serialized: string;
}

export interface FlagshipDemoSpec {
  readonly id: FlagshipDemoId;
  readonly choiceId: NewProjectChoiceId;
  readonly manifest: FlagshipBeatManifest;
  readonly build: () => FlagshipDemoBuildResult;
}

export interface FlagshipStyleLockAudit {
  readonly id?: FlagshipDemoId;
  readonly demoId: FlagshipDemoId;
  readonly ok: boolean;
  readonly violations: readonly string[];
  readonly mapCount: number;
  readonly endingCount: number;
  readonly changeTileCount: number;
  readonly openingShotCount: number;
}

export type FlagshipStyleLockReport = FlagshipStyleLockAudit;
