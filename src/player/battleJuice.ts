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

export function spawnDamagePopup(
  host: HTMLElement,
  options: {
    readonly amount: number;
    readonly critical?: boolean;
    readonly miss?: boolean;
    readonly heal?: boolean;
    readonly anchor?: DOMRect | null;
    /** Prefer field-local coords so the pop sits over battlers, not the HUD. */
    readonly field?: HTMLElement | null;
  }
): void {
  const popup = document.createElement("div");
  popup.className = "battle-damage-popup";
  popup.dataset.testid = "battle-damage-popup";
  if (options.miss) {
    popup.classList.add("is-miss");
    popup.textContent = "MISS";
  } else if (options.heal) {
    popup.classList.add("is-heal");
    popup.textContent = `+${options.amount}`;
  } else if (options.critical) {
    popup.classList.add("is-critical");
    popup.textContent = String(options.amount);
  } else {
    popup.textContent = String(options.amount);
  }

  const field = options.field ?? host.querySelector<HTMLElement>(".battle-field");
  const mount = field ?? host;
  const mountRect = mount.getBoundingClientRect();
  const anchor = options.anchor;
  const x = anchor ? anchor.left + anchor.width / 2 - mountRect.left : mountRect.width * 0.36;
  const y = anchor ? anchor.top + anchor.height * 0.2 - mountRect.top : mountRect.height * 0.42;
  popup.style.left = `${Math.max(10, Math.min(mountRect.width - 10, x))}px`;
  popup.style.top = `${Math.max(8, Math.min(mountRect.height - 18, y))}px`;
  if (getComputedStyle(mount).position === "static") mount.style.position = "relative";
  mount.append(popup);
  window.setTimeout(() => popup.remove(), 900);
}

export function flashBattleField(root: HTMLElement, kind: "hit" | "critical" | "victory" | "defeat"): void {
  root.classList.remove("battle-flash-hit", "battle-flash-critical", "battle-flash-victory", "battle-flash-defeat");
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
    window.setTimeout(() => root.classList.remove(className), kind === "victory" || kind === "defeat" ? 700 : 280);
  });
}
