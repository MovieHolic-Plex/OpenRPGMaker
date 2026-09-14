export const CINEMATIC_SCENE_LIMIT = 100;
export const CINEMATIC_DURATION_MAX_MS = 120_000;

export type CinematicMotion = "none" | "fade" | "pan" | "zoom";

/** Mutable authored records, shared by project persistence and editor mutations. */
export type CinematicScene =
  | { id: string; kind: "text"; narration: string; narrationAudioResourceId?: string; durationMs: number }
  | { id: string; kind: "image"; resourceId: string; narration: string; narrationAudioResourceId?: string; durationMs: number; motion: CinematicMotion }
  | { id: string; kind: "video"; resourceId: string; narration: string; narrationAudioResourceId?: string; durationMs: number };

/** musicResourceId: 시퀀스 전체에 깔리는 배경음악(장면별 내레이션 음성과 별개). */
export type CinematicSequence = {
  enabled: boolean;
  skippable: boolean;
  musicResourceId?: string;
  scenes: CinematicScene[];
};

export type GameOverSettings = {
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
  const { sequence, backgroundResourceId, ...text } = settings;
  const backgroundId = backgroundResourceId?.trim();
  return {
    ...text,
    ...(sequence !== undefined ? { sequence: normalizeCinematicSequence(sequence) } : {}),
    ...(backgroundId ? { backgroundResourceId: backgroundId } : {}),
  };
}
