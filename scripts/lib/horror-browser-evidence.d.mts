// Type declarations for horror-browser-evidence.mjs (shared by qa script and regression test).

export const CAPTURE_HORROR_BROWSER_EVIDENCE_NAME: "capture-horror-browser-evidence";

export interface HorrorBrowserEvidenceRead {
  readonly projectId: string;
  readonly observedAt: string;
  readonly route: string;
  readonly capturedBy: string;
  readonly title: { readonly resourceId: string; readonly imageLoaded: boolean };
  readonly desktopTouchPadVisible: boolean;
  readonly mapStart: {
    readonly mapId: string;
    readonly x: number;
    readonly y: number;
    readonly passable: boolean;
  };
  readonly expectedStart: { readonly mapId: string; readonly x: number; readonly y: number };
  readonly contentDigest: { readonly observed: string; readonly expected: string };
  readonly bgm: { readonly requested: boolean; readonly played: boolean };
  readonly consoleErrorCount: number;
}

export interface ReadHorrorBrowserEvidenceOptions {
  readonly targetProjectId: string;
  readonly maxStalenessMs?: number;
  readonly now?: number;
  readonly captureName?: string;
}

export function validateHorrorBrowserEvidenceShape(parsed: unknown): Record<string, unknown>;

export function readHorrorBrowserEvidence(
  filePath: string,
  opts: ReadHorrorBrowserEvidenceOptions,
): HorrorBrowserEvidenceRead;

export function browserEvidenceOutputPath(): string;
