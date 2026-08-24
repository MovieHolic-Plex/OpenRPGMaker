// scripts/lib/horror-capture-rules.d.mts
// Type declarations for the pure horror-capture decision helpers.

export interface StartMapBgmLike {
  bgm?: { mode?: string; resourceId?: string };
}

export interface RequiredStartBgm {
  resourceId: string;
  url: string;
}

export interface ObservedAudio {
  requestedUrls: readonly string[];
  played: readonly string[];
}

export declare function planServerOwnership(probe: {
  kind: "already-listening" | "free";
  servesThisApp?: boolean;
}): { action: "spawn" };

export declare function assertExpectedStart(
  observed: { currentMapId: string; x: number; y: number },
  expected: { mapId: string; x: number; y: number },
): void;

export declare function assertObservedDigest(observedDigest: string, expectedDigest: string): void;

export declare function deriveRequiredStartBgm(input: {
  startMap: StartMapBgmLike;
  resolveUrl: (resourceId: string) => string | null;
}): RequiredStartBgm;

export declare function assertRequiredBgmObserved(
  required: RequiredStartBgm,
  observed: ObservedAudio,
): void;

export declare function browserScreenshotNames(): {
  title: string;
  playStart: string;
};

export declare function assertScreenshotOrder(input: {
  titleAtMs: number;
  playStartAtMs: number;
}): void;
