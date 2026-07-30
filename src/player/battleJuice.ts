import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";

export type BattleJuiceEvent =
  | "command-select"
  | "command-confirm"
  | "command-cancel"
  | "attack-swing"
  | "hit-damage"
  | "hit-critical"
  | "hit-miss"
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
  defend: "easyrpg-sound-barrier1",
  escape: "easyrpg-sound-escape",
  victory: "easyrpg-sound-chime2",
  defeat: "easyrpg-sound-collapse1",
};

// Some RTP builds omit alternate names; fall back to a safe click.
const SFX_FALLBACK: Partial<Record<BattleJuiceEvent, string>> = {
  "hit-miss": "easyrpg-sound-buzzer1",
  escape: "easyrpg-sound-cancel2",
  victory: "easyrpg-sound-item1",
};

const DEFAULT_VOLUME = 0.4;

export function emitBattleJuice(event: BattleJuiceEvent, target?: HTMLElement | null): void {
  playBattleSfx(event);
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

export function playBattleSfx(event: BattleJuiceEvent): void {
  const primary = BATTLE_SFX[event];
  const fallback = SFX_FALLBACK[event];
  if (!tryPlay(primary) && fallback) tryPlay(fallback);
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
