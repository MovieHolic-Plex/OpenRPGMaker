import type { OpeningAnimatic } from "./openingAnimatic";
import type { CinematicPresentation } from './cinematicPresentation';
import type { CinematicDirection } from './cinematicDirection';

export const CINEMATIC_SCENE_LIMIT = 100;
export const CINEMATIC_DURATION_MAX_MS = 120_000;
/** Default game-over field darken. CSS `--terminal-fade-ms` uses the same 900ms fallback. */
export const DEFAULT_GAME_OVER_FADE_OUT_MS = 900;
/** Also included by the web exporter when no project-specific game-over art is authored. */
export const DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID = "easyrpg-game-over-game-over";

export type CinematicMotion = "none" | "fade" | "pan" | "zoom";

/** Mutable authored records, shared by project persistence and editor mutations. */
export type CinematicScene =
  | { id: string; kind: "text"; narration: string; narrationAudioResourceId?: string; presentation?: CinematicPresentation; durationMs: number }
  | { id: string; kind: "image"; resourceId: string; narration: string; narrationAudioResourceId?: string; presentation?: CinematicPresentation; durationMs: number; motion: CinematicMotion; direction?: CinematicDirection }
  | { id: string; kind: "animatic"; composition: OpeningAnimatic; narration: string; narrationAudioResourceId?: string; presentation?: CinematicPresentation; durationMs: number }
  | { id: string; kind: "video"; resourceId: string; narration: string; narrationAudioResourceId?: string; presentation?: CinematicPresentation; durationMs: number };

/** musicResourceId: 시퀀스 전체에 깔리는 배경음악(장면별 내레이션 음성과 별개). */
export type CinematicSequence = {
  enabled: boolean;
  skippable: boolean;
  musicResourceId?: string;
  scenes: CinematicScene[];
  /** Opening only. Absent preserves the historic New Game entry. */
  entry?: { mode: "new-game" | "before-title" | "attract"; idleMs?: number; repeatDelayMs?: number };
};

export type DefeatPresentation = "classic" | "horror" | "blackout";
export type RecoveryDestination = { mapId: string; x: number; y: number };
/** Each authored ending can own its closing image, mood and credits. */
export type EndingPresentation = {
  musicResourceId?: string;
  tone?: "warm" | "dark";
  backgroundResourceId?: string;
  credits?: string;
  /** Small line above the ending heading. Absent: romance projects say "두 사람의 이야기", others "우리의 여정". */
  kicker?: string;
  /** 엔딩 CG 위 배지(예: 「진 엔딩」). 비우면 엔딩 id·상대·분위기로 고른 글을 게임 언어로 쓴다(HAPPY ENDING·다음 이야기에 계속 …). */
  badge?: string;
  /** 마지막 장의 큰 글자. 비우면 「끝」, 막·장 끝 엔딩(id 에 act1·chapter2)이면 「제1막 끝」 — 게임 언어. */
  finalTitle?: string;
  /** 엔딩 CG 위에 엔딩 상대·주인공 전신 초상을 세울지. 비우면(auto) 호감 엔딩에 세운다. none = 배경 그림에 두 사람이 이미 그려진 결말 그림일 때(초상이 겹쳐 두 번 나온다). */
  portraits?: "auto" | "none";
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
  /**
   * 귀환 지점의 **물러날 자리** — `recovery` 가 없고 마지막 체크포인트(회복 센터 직원)도 없을 때만 쓴다(없으면 시작 지점).
   * 체크포인트는 불러오기 뒤에는 사라지므로, 몬스터 수집 게임은 첫 마을 센터를 여기에 둔다(D31).
   */
  recoveryFallback?: RecoveryDestination;
  /** 귀환(outcome recover) 때 잃는 소지금 비율(0~100). 생략·0 = 잃지 않음. 포켓몬식 블랙아웃은 50. */
  goldLossPercent?: number;
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
    ...(sequence.entry ? { entry: { ...sequence.entry } } : {}),
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
      return normalized.kind === "text" || normalized.kind === "animatic" ? normalized : { ...normalized, resourceId: normalized.resourceId.trim() };
    }),
  };
}

export function normalizeGameOverSettings(settings: GameOverSettings): GameOverSettings {
  const { sequence, backgroundResourceId, recovery, recoveryFallback, timing, musicResourceId, ...text } = settings;
  const backgroundId = backgroundResourceId?.trim();
  return {
    ...text,
    ...(recovery ? { recovery: { ...recovery, mapId: recovery.mapId.trim() } } : {}),
    ...(recoveryFallback ? { recoveryFallback: { ...recoveryFallback, mapId: recoveryFallback.mapId.trim() } } : {}),
    ...(timing ? { timing: { ...timing } } : {}),
    ...(musicResourceId?.trim() ? { musicResourceId: musicResourceId.trim() } : {}),
    ...(sequence !== undefined ? { sequence: normalizeCinematicSequence(sequence) } : {}),
    ...(backgroundId ? { backgroundResourceId: backgroundId } : {}),
  };
}
