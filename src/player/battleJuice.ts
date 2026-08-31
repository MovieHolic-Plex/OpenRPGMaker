import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { beginBattleResultAudio, playAuthoredBattleResultCue } from "@/player/battleAudio";
import { playBattleSfx as playSynthVoice, type BattleSfxKind } from "@/player/battleSfx";

export type BattleJuiceEvent =
  | "command-select"
  | "command-confirm"
  | "command-cancel"
  | "attack-swing"
  | "hit-damage"
  | "hit-critical"
  | "hit-miss"
  | "hit-heal"
  | "faint"
  | "defend"
  | "escape"
  | "victory"
  | "defeat";

const BATTLE_SFX: Record<BattleJuiceEvent, string> = {
  "command-select": "easyrpg-sound-cursor1",
  "command-confirm": "easyrpg-sound-decision1",
  "command-cancel": "easyrpg-sound-cancel1",
  "attack-swing": "easyrpg-sound-attack1",
  "hit-damage": "easyrpg-sound-damage2",
  "hit-critical": "easyrpg-sound-blow4",
  "hit-miss": "easyrpg-sound-evade1",
  "hit-heal": "easyrpg-sound-recovery5",
  faint: "easyrpg-sound-collapse2",
  defend: "easyrpg-sound-barrier1",
  escape: "easyrpg-sound-escape",
  victory: "easyrpg-sound-chime1",
  defeat: "easyrpg-sound-collapse1",
};

// Some RTP builds omit alternate names; fall back to a safe click.
const SFX_FALLBACK: Partial<Record<BattleJuiceEvent, string>> = {
  "hit-miss": "easyrpg-sound-buzzer1",
  "hit-heal": "easyrpg-sound-recovery7",
  faint: "easyrpg-sound-fall1",
  escape: "easyrpg-sound-cancel2",
  victory: "easyrpg-sound-item1",
};

/**
 * 합성 보이스(battleSfx.ts)는 **샘플이 없을 때만** 우는 폴백이다.
 *
 * 예전에는 battleDom 이 사건 하나에 `playBattleSfx`(합성)와 `emitBattleJuice`(샘플)를
 * 둘 다 불러서, 한 번의 타격에 노이즈·톤·샘플이 2ms 안에 겹쳐 울렸다(실측: 26ms
 * Attack1.wav / 592 노이즈 / 593 톤 / 594 Damage2.wav). 어택 트랜지언트가 서로를
 * 마스킹해 오히려 약하게 들린다. 사건 1개 = 소리 1개가 이 파일의 계약이다.
 */
const SYNTH_VOICE: Record<BattleJuiceEvent, BattleSfxKind> = {
  "command-select": "cursor",
  "command-confirm": "confirm",
  "command-cancel": "cancel",
  "attack-swing": "cursor",
  "hit-damage": "hit",
  "hit-critical": "critical",
  "hit-miss": "miss",
  "hit-heal": "heal",
  faint: "faint",
  defend: "confirm",
  escape: "escape",
  victory: "victory",
  defeat: "defeat",
};

// 샘플과 합성 폴백의 체감 크기를 맞춘 값. 합성 마스터는 0.14(battleSfx.ts)이고
// 샘플은 원음이 커서 0.4 에서 대략 같은 라우드니스로 들린다.
const DEFAULT_VOLUME = 0.4;

export function emitBattleJuice(event: BattleJuiceEvent, target?: HTMLElement | null): void {
  playBattleCue(event);
  if (!target) return;
  const motion =
    event === "hit-critical"
      ? "battle-juice-critical"
      : event === "hit-damage"
        ? "battle-juice-hit"
        : event === "hit-miss"
          ? "battle-juice-miss"
          : event === "attack-swing"
            ? "battle-juice-swing"
            : event === "defend"
              ? "battle-juice-defend"
              : null;
  if (!motion) return;
  target.classList.remove("battle-juice-hit", "battle-juice-critical", "battle-juice-miss", "battle-juice-swing", "battle-juice-defend");
  window.requestAnimationFrame(() => {
    target.classList.add(motion);
    window.setTimeout(() => target.classList.remove(motion), event === "defend" ? 520 : 420);
  });
}

/**
 * 전투 사건 1개에 소리 1개. 프로젝트 샘플 → 대체 샘플 → 합성 보이스 순으로
 * **처음 성공한 하나만** 낸다. 호출자는 여기 말고 다른 오디오 경로를 겹치지 말 것.
 */
export function playBattleCue(event: BattleJuiceEvent): void {
  if (event === "victory" || event === "defeat" || event === "escape") {
    beginBattleResultAudio();
    if (playAuthoredBattleResultCue(store.getCurrent(), event)) return;
  }
  // 저작 슬롯이 비었을 때: 승리는 합성 팡파레(전투곡에 묻히지 않게 BGM 을 먼저 끊는다).
  if (event === "victory") {
    playSynthVoice("victory");
    return;
  }
  const primary = BATTLE_SFX[event];
  const fallback = SFX_FALLBACK[event];
  if (tryPlay(primary)) return;
  if (fallback && tryPlay(fallback)) return;
  playSynthVoice(SYNTH_VOICE[event]);
}

function tryPlay(soundResourceId: string): boolean {
  const url = resolveAssetResourceUrl(soundResourceId, { project: store.getCurrent() });
  if (!url) return false;
  const audio = new Audio(url);
  audio.volume = DEFAULT_VOLUME;
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException) return;
    console.warn("[battle-juice] sound playback failed", error);
  });
  return true;
}

export function flashBattleField(root: HTMLElement, kind: "hit" | "critical" | "victory" | "defeat"): void {
  root.classList.remove("battle-flash-hit", "battle-flash-critical", "battle-flash-victory", "battle-flash-defeat", "battle-screen-shake");
  const className =
    kind === "critical"
      ? "battle-flash-critical"
      : kind === "victory"
        ? "battle-flash-victory"
        : kind === "defeat"
          ? "battle-flash-defeat"
          : "battle-flash-hit";
  window.requestAnimationFrame(() => {
    root.classList.add(className);
    if (kind === "critical") {
      root.classList.add("battle-screen-shake");
    }
    window.setTimeout(() => {
      root.classList.remove(className, "battle-screen-shake");
    }, kind === "victory" || kind === "defeat" ? 700 : kind === "critical" ? 400 : 280);
  });
}
