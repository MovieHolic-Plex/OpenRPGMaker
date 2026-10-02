import { battlerSpriteNode } from "@/player/battleFieldDom";
import { HIT_INTENSITY_STYLE, type BattleHitIntensity } from "@/player/battleHitIntensity";
import { BattlePlaybackClock } from "@/player/battlePlaybackClock";

interface Contact {
  readonly clock: BattlePlaybackClock;
  readonly burst: HTMLCanvasElement;
  readonly recoil?: Animation;
}

/** Original binary-alpha, 64px impact drawing. No blur, gradients or external art. */
function drawContact(canvas: HTMLCanvasElement, frame: number, strength: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, 64, 64);
  const radius = Math.max(0, (frame < 2 ? 10 : 11 - frame * 2) + strength);
  ctx.fillStyle = frame < 2 ? "#fff5b8" : "#ffc75a";
  // Diamond silhouette and jagged spokes share the same final pixel grid.
  for (let y = -radius; y <= radius; y++) {
    const half = radius - Math.abs(y);
    ctx.fillRect(32 - half, 32 + y, half * 2 + 1, 1);
  }
  ctx.fillStyle = "#ffffff";
  const core = Math.max(0, radius - 3);
  for (let y = -core; y <= core; y++) {
    const half = core - Math.abs(y);
    ctx.fillRect(32 - half, 32 + y, half * 2 + 1, 1);
  }
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [dx, dy] of directions) {
    for (let step = 0; step < Math.max(1, 7 - frame); step++) {
      const distance = 12 + frame * 3 + step;
      ctx.fillStyle = step < 3 ? "#ffffff" : "#ffc75a";
      ctx.fillRect(32 + dx! * distance, 32 + dy! * distance, frame < 3 ? 2 : 1, frame < 3 ? 2 : 1);
    }
  }
}

/** Contact flash holds with the action; the defender recoils when that hold releases. */
export function createBattleImpactController(field: HTMLElement) {
  const contacts = new Map<HTMLElement, Contact>();
  const remove = (target: HTMLElement, contact: Contact) => {
    contact.clock.dispose();
    contact.recoil?.cancel();
    contact.burst.remove();
    if (contacts.get(target) === contact) contacts.delete(target);
  };
  return {
    strike(target: HTMLElement, intensity: BattleHitIntensity): void {
      const previous = contacts.get(target);
      if (previous) remove(target, previous);
      const sprite = battlerSpriteNode(target);
      const box = sprite.getBoundingClientRect();
      const fieldBox = field.getBoundingClientRect();
      const sx = fieldBox.width / (field.offsetWidth || 1), sy = fieldBox.height / (field.offsetHeight || 1);
      const burst = document.createElement("canvas");
      burst.width = burst.height = 64;
      burst.className = "battle-impact-burst";
      burst.dataset.testid = "battle-impact-burst";
      burst.setAttribute("aria-hidden", "true");
      burst.style.left = `${Math.round((box.left + box.width / 2 - fieldBox.left) / sx)}px`;
      // Transparent headroom on short native creatures is recorded by the sprite fitter.
      const topPad = (Number.parseFloat(target.style.getPropertyValue("--battle-sprite-top-pad")) || 0) / 100;
      burst.style.top = `${Math.round((box.top + box.height * (topPad + (1 - topPad) * 0.52) - fieldBox.top) / sy)}px`;
      field.append(burst);
      const strength = intensity === "crushing" ? 4 : intensity === "heavy" ? 2 : 0;
      drawContact(burst, 0, strength);
      const { knockbackPx, squash } = HIT_INTENSITY_STYLE[intensity];
      const direction = Number.parseFloat(getComputedStyle(target).getPropertyValue("--hit-dir-x")) || (target.classList.contains("battle-enemy") ? -1 : 1);
      const distance = Math.round(knockbackPx * 0.65) * direction;
      const recoil = sprite.animate?.([
        { translate: `${Math.round(distance * 0.25)}px 0px`, scale: `${1 + squash} ${1 - squash}`, offset: 0 },
        { translate: `${distance}px -2px`, scale: `${1 + squash} ${1 - squash}`, offset: 0.16 },
        { translate: `${Math.round(-distance * 0.18)}px 0px`, scale: `${1 - squash * 0.5} ${1 + squash * 0.5}`, offset: 0.55 },
        { translate: "0px 0px", scale: "1 1", offset: 1 },
      ], { duration: intensity === "crushing" ? 320 : 240, easing: "linear" });
      const contact: Contact = { burst, recoil, clock: new BattlePlaybackClock() };
      contacts.set(target, contact);
      for (let frame = 1; frame < 6; frame++) contact.clock.schedule(() => drawContact(burst, frame, strength), frame * 28);
      contact.clock.schedule(() => { burst.remove(); }, 175);
      contact.clock.schedule(() => remove(target, contact), 340);
    },
    hold(active: boolean): void {
      for (const contact of contacts.values()) {
        if (active) {
          contact.clock.pause();
          contact.recoil?.pause();
        } else {
          contact.clock.resume();
          if (contact.recoil?.playState === "paused") contact.recoil.play();
        }
      }
    },
    destroy(): void {
      for (const [target, contact] of contacts) remove(target, contact);
    },
  };
}
