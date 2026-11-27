import { battlerSpriteNode } from "@/player/battleFieldDom";
import { HIT_INTENSITY_STYLE, type BattleHitIntensity } from "@/player/battleHitIntensity";
import { BattlePlaybackClock } from "@/player/battlePlaybackClock";

interface Contact {
  readonly clock: BattlePlaybackClock;
  readonly burst: HTMLCanvasElement;
  readonly recoil?: Animation;
}

/** 착탄 섬광 색 두 개(ActorRecord.battleHitFlash). 없으면 기본 흰·금 섬광. */
export interface BattleHitFlashTint {
  readonly core: string;
  readonly edge: string;
}

export interface ContactPalette {
  /** 첫 두 프레임의 바깥 다이아. */
  readonly early: string;
  /** 3프레임부터의 바깥 다이아와 살 끝. */
  readonly late: string;
  /** 안쪽 다이아와 살 앞부분. */
  readonly core: string;
}

export const DEFAULT_CONTACT_PALETTE: ContactPalette = { early: "#fff5b8", late: "#ffc75a", core: "#ffffff" };

function mixHex(a: string, b: string): string {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round((channel(a, i) + channel(b, i)) / 2).toString(16).padStart(2, "0")).join("")}`;
}

/** 색이 없으면 기본 팔레트 그대로. 있으면 core·edge 와 그 중간색(첫 프레임 바깥)을 쓴다. */
export function contactPalette(tint?: BattleHitFlashTint): ContactPalette {
  if (!tint) return DEFAULT_CONTACT_PALETTE;
  return { early: mixHex(tint.core, tint.edge), late: tint.edge, core: tint.core };
}

/** Original binary-alpha, 64px impact drawing with OT2-style razor diagonal blade cleave.
 *  No blur, gradients or external art. `slashDir` alternates slash angle (1 = ↘, -1 = ↗) on multi-hits. */
export function drawContactFrame(
  ctx: Pick<CanvasRenderingContext2D, "clearRect" | "fillRect" | "fillStyle">,
  frame: number,
  strength: number,
  palette: ContactPalette = DEFAULT_CONTACT_PALETTE,
  slashDir: 1 | -1 = 1,
): void {
  ctx.clearRect(0, 0, 64, 64);
  const drawDiagonalCleave = (dir: 1 | -1, halfLen: number, thickness: number, coreOnly: boolean) => {
    for (let i = -halfLen; i <= halfLen; i += 1) {
      const progress = 1 - Math.abs(i) / Math.max(1, halfLen);
      const w = Math.max(1, Math.round(thickness * Math.pow(progress, 0.7)));
      const x = Math.round(32 + i);
      const y = Math.round(32 + i * 0.78 * dir);
      if (!coreOnly) {
        ctx.fillStyle = frame < 2 ? palette.early : palette.late;
        ctx.fillRect(x - w, y - w, w * 2 + 1, w * 2 + 1);
      }
      const cw = Math.max(1, w - 1);
      ctx.fillStyle = palette.core;
      ctx.fillRect(x - cw, y - cw, cw * 2 + 1, cw * 2 + 1);
    }
  };
  // Frame 0-2: razor OT2 blade-tear slashing right across the target's body!
  if (frame < 3) {
    const halfLen = Math.min(29, (frame === 0 ? 22 : frame === 1 ? 26 : 24) + strength);
    const thick = frame === 0 ? 3 : frame === 1 ? 2 : 1;
    drawDiagonalCleave(slashDir, halfLen, thick, frame === 2);
    // Heavy / critical strikes add a dramatic crossing X-cleave!
    if (strength >= 2 && frame < 2) {
      drawDiagonalCleave((slashDir === 1 ? -1 : 1), Math.round(halfLen * 0.78), frame === 0 ? 2 : 1, false);
    }
  }
  const radius = Math.max(0, (frame < 2 ? 8 : 9 - frame * 2) + strength);
  ctx.fillStyle = frame < 2 ? palette.early : palette.late;
  // Compact bright contact flash core at the slash intersection.
  for (let y = -radius; y <= radius; y++) {
    const half = radius - Math.abs(y);
    ctx.fillRect(32 - half, 32 + y, half * 2 + 1, 1);
  }
  ctx.fillStyle = palette.core;
  const core = Math.max(0, radius - 3);
  for (let y = -core; y <= core; y++) {
    const half = core - Math.abs(y);
    ctx.fillRect(32 - half, 32 + y, half * 2 + 1, 1);
  }
  // Sharp directional slash sparks flying off along the cleave axis & orthogonal burst
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [dx, dy] of directions) {
    const alongSlash = Math.sign(dx! * dy!) === slashDir;
    const count = Math.max(1, (alongSlash ? 8 : 5) - frame);
    for (let step = 0; step < count; step++) {
      const distance = (alongSlash ? 10 : 12) + frame * 3 + step * (alongSlash ? 2 : 1);
      ctx.fillStyle = step < 3 ? palette.core : palette.late;
      ctx.fillRect(32 + dx! * distance, 32 + dy! * distance, frame < 3 ? 2 : 1, frame < 3 ? 2 : 1);
    }
  }
}

function drawContact(canvas: HTMLCanvasElement, frame: number, strength: number, palette: ContactPalette, slashDir: 1 | -1): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawContactFrame(ctx, frame, strength, palette, slashDir);
}

/** Contact flash holds with the action; the defender recoils when that hold releases. */
export function createBattleImpactController(field: HTMLElement) {
  const contacts = new Map<HTMLElement, Contact>();
  let slashCount = 0;
  const remove = (target: HTMLElement, contact: Contact) => {
    contact.clock.dispose();
    contact.recoil?.cancel();
    contact.burst.remove();
    if (contacts.get(target) === contact) contacts.delete(target);
  };
  return {
    strike(target: HTMLElement, intensity: BattleHitIntensity, reactionScale=1, tint?: BattleHitFlashTint): void {
      const palette = contactPalette(tint);
      const previous = contacts.get(target);
      if (previous) remove(target, previous);
      slashCount += 1;
      const slashDir: 1 | -1 = slashCount % 2 === 1 ? 1 : -1;
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
      drawContact(burst, 0, strength, palette, slashDir);
      const { knockbackPx, squash } = HIT_INTENSITY_STYLE[intensity];
      const direction = Number.parseFloat(getComputedStyle(target).getPropertyValue("--hit-dir-x")) || (target.classList.contains("battle-enemy") ? -1 : 1);
      const distance = Math.round(knockbackPx * 0.65 * reactionScale) * direction;
      const recoil = sprite.animate?.([
        { translate: `${Math.round(distance * 0.25)}px 0px`, scale: `${1 + squash} ${1 - squash}`, offset: 0 },
        { translate: `${distance}px -2px`, scale: `${1 + squash} ${1 - squash}`, offset: 0.16 },
        { translate: `${Math.round(-distance * 0.18)}px 0px`, scale: `${1 - squash * 0.5} ${1 + squash * 0.5}`, offset: 0.55 },
        { translate: "0px 0px", scale: "1 1", offset: 1 },
      ], { duration: intensity === "crushing" ? 320 : 240, easing: "linear" });
      const contact: Contact = { burst, recoil, clock: new BattlePlaybackClock() };
      contacts.set(target, contact);
      for (let frame = 1; frame < 6; frame++) contact.clock.schedule(() => drawContact(burst, frame, strength, palette, slashDir), frame * 28);
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
