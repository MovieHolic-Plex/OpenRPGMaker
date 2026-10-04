import type { CinematicDirection } from './cinematicDirection';

export const CINEMATIC_SCENE_LIMIT = 100;
export const CINEMATIC_DURATION_MAX_MS = 120_000;
/** Also included by the web exporter when no project-specific game-over art is authored. */
export const DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID = "easyrpg-game-over-game-over";

export type CinematicMotion = "none" | "fade" | "pan" | "zoom";

/** Mutable authored records, shared by project persistence and editor mutations. */
export type CinematicScene =
  | { id: string; kind: "text"; narration: string; narrationAudioResourceId?: string; durationMs: number }
  | { id: string; kind: "image"; resourceId: string; narration: string; narrationAudioResourceId?: string; durationMs: number; motion: CinematicMotion; direction?: CinematicDirection }
  | { id: string; kind: "video"; resourceId: string; narration: string; narrationAudioResourceId?: string; durationMs: number };

/** musicResourceId: 시퀀스 전체에 깔리는 배경음악(장면별 내레이션 음성과 별개). */
export type CinematicSequence = {
  enabled: boolean;
  skippable: boolean;
  musicResourceId?: string;
  scenes: CinematicScene[];
};

export type DefeatPresentation = "classic" | "horror" | "blackout";
export type RecoveryDestination = { mapId: string; x: number; y: number };
/** Each authored ending can own its closing image, mood and credits. */
export type EndingPresentation = {
  musicResourceId?: string;
  tone?: "warm" | "dark";
  backgroundResourceId?: string;
  credits?: string;
};

export type GameOverOutcome = "menu" | "recover" | "title";
export type GameOverTiming = { fadeOutMs?: number; silenceMs?: number; menuDelayMs?: number; messageHoldMs?: number };
export const GAME_OVER_DEFINITION_LIMIT = 64;
export type GameOverDefinition = { id: string; name: string; settings: GameOverSettings };
export type GameOverSystem = { gameOver?: GameOverSettings; gameOvers?: GameOverDefinition[]; defaultGameOverId?: string };

export function resolveGameOverSettings(system: GameOverSystem, id?: string): GameOverSettings | undefined {
  const selected = id ?? system.defaultGameOverId;
  // A broken explicit reference must never recover at some other definition's location.
  return selected ? system.gameOvers?.find(row => row.id === selected)?.settings : system.gameOver;
}
export function gameOverOutcome(settings: GameOverSettings | undefined): GameOverOutcome {
  return settings?.outcome ?? (settings?.presentation === "blackout" ? "recover" : "menu");
}

export type GameOverSettings = {
  outcome?: GameOverOutcome;
  timing?: GameOverTiming;
  musicResourceId?: string;
  presentation?: DefeatPresentation;
  /** Blackout preserves progress; this is a destination, never a save rollback. */
  recovery?: RecoveryDestination;
  sequence?: CinematicSequence;
  title?: string;
  message?: string;
  retryLabel?: string;
  titleLabel?: string;
  backgroundResourceId?: string;
};

/** Wire shape is checked before normalization; never discard disabled authored content. */
export function normalizeCinematicSequence(sequence: CinematicSequence): CinematicSequence {
  const musicResourceId = sequence.musicResourceId?.trim();
  return {
    enabled: sequence.enabled,
    skippable: sequence.skippable,
    ...(musicResourceId ? { musicResourceId } : {}),
    scenes: sequence.scenes.map((scene) => {
      const { narrationAudioResourceId, ...fields } = scene;
      const audioId = narrationAudioResourceId?.trim();
      const normalized = {
        ...fields,
        id: scene.id.trim(),
        ...(audioId ? { narrationAudioResourceId: audioId } : {}),
      };
      return normalized.kind === "text" ? normalized : { ...normalized, resourceId: normalized.resourceId.trim() };
    }),
  };
}

export function normalizeGameOverSettings(settings: GameOverSettings): GameOverSettings {
  const { sequence, backgroundResourceId, recovery, timing, musicResourceId, ...text } = settings;
  const backgroundId = backgroundResourceId?.trim();
  return {
    ...text,
    ...(recovery ? { recovery: { ...recovery, mapId: recovery.mapId.trim() } } : {}),
    ...(timing ? { timing: { ...timing } } : {}),
    ...(musicResourceId?.trim() ? { musicResourceId: musicResourceId.trim() } : {}),
    ...(sequence !== undefined ? { sequence: normalizeCinematicSequence(sequence) } : {}),
    ...(backgroundId ? { backgroundResourceId: backgroundId } : {}),
  };
}
