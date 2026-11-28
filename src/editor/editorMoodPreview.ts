// editor/editorMoodPreview.ts
// 에디터 캔버스 실시간 분위기 · 후처리(PostFX) · 환경 입자(Atmosphere) · 기후 · 야간 조명 미리보기 레이어.
// - 원본 타일 데이터는 건드리지 않고, phaserContainer CSS 필터 + 비중첩 2D 오버레이 캔버스로 즉시 시각화한다.
// - 애니메이션 입자/기후가 없을 때는 RAF 루프를 완전히 멈춰 유휴 CPU 점유율을 0으로 유지한다.
// - 상단 미니맵 HUD의 ☀ 분위기 팝오버 [👁 미리보기] 토글로 언제든 끄고 켤 수 있다.

import { resolveCurrentMapId } from "@/editor/mapSelection";
import { ATMOSPHERE_PRESETS, normalizeAtmosphereEffects, type AtmosphereEffect } from "@/project/atmosphere";
import { normalizeMapClimate } from "@/project/mapClimate";
import { resolvePostFx, type ResolvedPostFx } from "@/project/postFx";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import { el } from "@/util/dom";

export const EDITOR_MOOD_PREVIEW_KEY = "oprn:editor-mood-preview";
export const EDITOR_MOOD_PREVIEW_EVENT = "oprn:editor-mood-preview-change";

const FRAME_INTERVAL_MS = 33; // ~30fps

export function isEditorMoodPreviewEnabled(): boolean {
  try {
    return localStorage.getItem(EDITOR_MOOD_PREVIEW_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setEditorMoodPreviewEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(EDITOR_MOOD_PREVIEW_KEY, enabled ? "1" : "0");
  } catch { /* ignore restricted storage */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EDITOR_MOOD_PREVIEW_EVENT, { detail: { enabled } }));
  }
}

export function subscribeEditorMoodPreview(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => listener();
  window.addEventListener(EDITOR_MOOD_PREVIEW_EVENT, handler);
  return () => window.removeEventListener(EDITOR_MOOD_PREVIEW_EVENT, handler);
}

function hexToRgb(hex: string | number, fallback: readonly [number, number, number] = [255, 255, 255]): [number, number, number] {
  if (typeof hex === "number") {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length === 6) {
    const num = Number.parseInt(clean, 16);
    if (Number.isFinite(num)) return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  return [fallback[0], fallback[1], fallback[2]];
}

function presetColorRgb(effect: AtmosphereEffect): [number, number, number] {
  if (effect.tint) return hexToRgb(effect.tint);
  const found = ATMOSPHERE_PRESETS.find((p) => p.id === effect.kind);
  return found ? hexToRgb(found.color) : [255, 255, 255];
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function wrap01(v: number): number {
  const r = v % 1;
  return r < 0 ? r + 1 : r;
}

export function mapHasActiveMood(map: GameMap | undefined): boolean {
  if (!map) return false;
  if (map.postFx && map.postFx.preset && map.postFx.preset !== "none") return true;
  if (map.sunlight?.enabled) return true;
  if (map.cloudShadows?.enabled) return true;
  if (normalizeAtmosphereEffects(map.atmosphereEffects).length > 0) return true;
  const climate = normalizeMapClimate(map.climate);
  if (climate?.mode === "fixed" && climate.weather !== "none" && climate.intensity > 0.01) return true;
  if (map.defaultLighting && map.defaultLighting.ambient > 0.02) return true;
  if (map.terrainDesign?.gameplay?.visionBlocking) return true;
  return false;
}

export function mountEditorMoodPreview(canvasArea: HTMLElement, phaserContainer: HTMLElement): () => void {
  const host = el("div", {
    class: "editor-mood-preview-layer",
    attrs: { "aria-hidden": "true" },
    dataset: { testid: "editor-mood-preview-layer" },
  });
  host.style.cssText = "position:absolute;left:0;right:0;bottom:0;top:calc(var(--persistence-banner-height, 0px) + var(--image-generation-notice-height, 0px));pointer-events:none;z-index:4;overflow:hidden;";

  const canvas = el("canvas", {
    class: "editor-mood-preview-canvas",
    attrs: { "aria-hidden": "true" },
    dataset: { testid: "editor-mood-preview-canvas" },
  }) as HTMLCanvasElement;
  canvas.style.cssText = "width:100%;height:100%;display:block;pointer-events:none;";
  host.append(canvas);

  // Insert right after editor-canvas-scroll-shell so all HUD/dock chrome stays crisp on top.
  const scrollShell = canvasArea.querySelector(".editor-canvas-scroll-shell");
  if (scrollShell && scrollShell.nextSibling) {
    canvasArea.insertBefore(host, scrollShell.nextSibling);
  } else {
    canvasArea.append(host);
  }

  let rafId = 0;
  let lastDrawAt = 0;
  let logicalW = 0;
  let logicalH = 0;
  let pixelRatio = 1;

  const offscreenLight = typeof document !== "undefined" ? document.createElement("canvas") : null;

  function syncCanvasSize(): boolean {
    const rect = canvasArea.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || canvasArea.clientWidth || 800));
    const h = Math.max(1, Math.round(rect.height || canvasArea.clientHeight || 600));
    const dpr = Math.min(1.5, Math.max(1, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1));
    if (w === logicalW && h === logicalH && dpr === pixelRatio) return false;
    logicalW = w;
    logicalH = h;
    pixelRatio = dpr;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    return true;
  }

  function currentMap(): GameMap | undefined {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    return mapId ? project.maps[mapId] : undefined;
  }

  function applyPhaserFilter(postFx: ResolvedPostFx | null): void {
    if (!postFx || !postFx.active) {
      if (phaserContainer.style.filter) phaserContainer.style.filter = "";
      return;
    }
    const k = postFx.intensity;
    const sat = 1 + (postFx.sat - 1) * k;
    const con = 1 + (postFx.contrast - 1) * k;
    const exp = 1 + (postFx.expose - 1) * k;
    const next = `saturate(${sat.toFixed(3)}) contrast(${con.toFixed(3)}) brightness(${exp.toFixed(3)})`;
    if (phaserContainer.style.filter !== next) {
      phaserContainer.style.filter = next;
    }
  }

  function drawPostFxOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    postFx: ResolvedPostFx,
    map: GameMap,
    suppressGodRays: boolean,
  ): void {
    const k = postFx.intensity;
    // 1. Subtle lift/gain color grading wash
    const rShift = (postFx.gain[0] - 1) * 0.55 + postFx.lift[0] * 1.35;
    const gShift = (postFx.gain[1] - 1) * 0.55 + postFx.lift[1] * 1.35;
    const bShift = (postFx.gain[2] - 1) * 0.55 + postFx.lift[2] * 1.35;
    const maxShift = Math.max(Math.abs(rShift), Math.abs(gShift), Math.abs(bShift));
    if (maxShift > 0.015) {
      const cr = Math.round(Math.max(0, Math.min(255, 128 + rShift * 380)));
      const cg = Math.round(Math.max(0, Math.min(255, 128 + gShift * 380)));
      const cb = Math.round(Math.max(0, Math.min(255, 128 + bShift * 380)));
      const alpha = Math.min(0.24, maxShift * 0.55 * k);
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(alpha * 1.6).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(alpha * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 2. Tilt-shift DoF subtle top/bottom atmospheric haze
    if (postFx.dof * k > 0.08) {
      const dofAlpha = Math.min(0.22, postFx.dof * k * 0.24);
      const rr = Math.round(postFx.rayColor[0] * 255);
      const rg = Math.round(postFx.rayColor[1] * 255);
      const rb = Math.round(postFx.rayColor[2] * 255);
      const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.16);
      topGrad.addColorStop(0, `rgba(${rr}, ${rg}, ${rb}, ${dofAlpha.toFixed(3)})`);
      topGrad.addColorStop(1, `rgba(${rr}, ${rg}, ${rb}, 0)`);
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, w, h * 0.16);
    }

    // 3. Diagonal God-Rays
    const rays = suppressGodRays && postFx.adaptWeather ? 0 : postFx.godRays * k;
    if (rays > 0.02) {
      const rr = Math.round(postFx.rayColor[0] * 255);
      const rg = Math.round(postFx.rayColor[1] * 255);
      const rb = Math.round(postFx.rayColor[2] * 255);
      const fromWest = (map.sunlight?.azimuth ?? 135) > 180;
      drawSunShafts(ctx, w, h, [rr, rg, rb], Math.min(0.32, rays * 0.85), fromWest);
    }

    // 4. Radial Vignette
    const vig = postFx.vignette * k;
    if (vig > 0.03) {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const outerR = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, outerR * 0.36, cx, cy, outerR);
      grad.addColorStop(0, "rgba(8, 10, 18, 0)");
      grad.addColorStop(0.65, `rgba(8, 10, 18, ${(vig * 0.28).toFixed(3)})`);
      grad.addColorStop(1, `rgba(6, 8, 16, ${Math.min(0.76, vig * 0.86).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // 5. Film Grain / Bayer Dither subtle texture
    const grain = Math.max(postFx.grain, postFx.bayerDither * 0.8) * k;
    if (grain > 0.06) {
      ctx.save();
      const step = 6;
      const alpha = Math.min(0.11, grain * 0.24);
      ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.45).toFixed(3)})`;
      for (let i = 0; i < 180; i += 1) {
        const gx = Math.floor(hash01(i * 3.17) * (w / step)) * step;
        const gy = Math.floor(hash01(i * 7.91) * (h / step)) * step;
        ctx.fillRect(gx, gy, 2, 2);
      }
      ctx.restore();
    }
  }

  function drawSunShafts(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rgb: readonly [number, number, number],
    strength: number,
    fromRight: boolean,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const shafts = [
      { pos: 0.12, width: 0.16, alpha: 0.95 },
      { pos: 0.34, width: 0.22, alpha: 1.0 },
      { pos: 0.60, width: 0.14, alpha: 0.78 },
      { pos: 0.80, width: 0.18, alpha: 0.65 },
    ];
    for (const s of shafts) {
      const startX = fromRight ? w * (1 - s.pos * 0.75) : w * (s.pos * 0.75);
      const endX = fromRight ? startX - w * 0.42 : startX + w * 0.42;
      const beamW = w * s.width;
      const grad = ctx.createLinearGradient(startX, 0, endX, h * 0.92);
      const peak = (strength * s.alpha).toFixed(3);
      grad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${peak})`);
      grad.addColorStop(0.55, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(strength * s.alpha * 0.42).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(startX - beamW * 0.35, 0);
      ctx.lineTo(startX + beamW * 0.65, 0);
      ctx.lineTo(endX + beamW * 0.85, h);
      ctx.lineTo(endX - beamW * 0.45, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCloudShadows(ctx: CanvasRenderingContext2D, w: number, h: number, map: GameMap, tSec: number): void {
    const cs = map.cloudShadows;
    if (!cs?.enabled) return;
    const count = Math.max(2, Math.min(8, Math.round(cs.amount ?? 4)));
    const opacity = Math.max(0.08, Math.min(0.55, cs.opacity ?? 0.26));
    const speed = Math.max(0.1, Math.min(3, cs.speed ?? 1));
    const scale = Math.max(0.5, Math.min(2.2, cs.scale ?? 1));
    ctx.save();
    for (let i = 0; i < count; i += 1) {
      const rx = wrap01(hash01(i * 19.3 + 1.7) + tSec * 0.018 * speed) * (w * 1.35) - w * 0.17;
      const ry = wrap01(hash01(i * 31.7 + 4.2) + tSec * 0.008 * speed) * (h * 1.25) - h * 0.12;
      const rad = Math.max(w, h) * (0.18 + hash01(i * 11.1) * 0.12) * scale;
      const grad = ctx.createRadialGradient(rx, ry, rad * 0.15, rx, ry, rad);
      grad.addColorStop(0, `rgba(15, 23, 42, ${opacity.toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(15, 23, 42, ${(opacity * 0.48).toFixed(3)})`);
      grad.addColorStop(1, "rgba(15, 23, 42, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rad * 1.35, rad * 0.78, -0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWeather(ctx: CanvasRenderingContext2D, w: number, h: number, weather: string, intensity: number, tSec: number): void {
    const amt = Math.max(0.15, Math.min(1, intensity));
    if (weather === "rain" || weather === "storm") {
      const isStorm = weather === "storm";
      const count = Math.round((isStorm ? 120 : 85) * amt);
      ctx.save();
      ctx.strokeStyle = isStorm
        ? `rgba(186, 224, 255, ${(0.34 + amt * 0.28).toFixed(3)})`
        : `rgba(176, 218, 255, ${(0.28 + amt * 0.26).toFixed(3)})`;
      ctx.lineWidth = isStorm ? 1.5 : 1.2;
      ctx.beginPath();
      const slantX = isStorm ? -14 : -7;
      const lenY = isStorm ? 26 : 19;
      for (let i = 0; i < count; i += 1) {
        const speed = (isStorm ? 1.35 : 0.95) * (0.85 + hash01(i * 5.1) * 0.4);
        const px = wrap01(hash01(i * 13.7) - tSec * 0.22 * speed) * (w + 40) - 20;
        const py = wrap01(hash01(i * 29.3) + tSec * 0.85 * speed) * (h + 40) - 20;
        ctx.moveTo(px, py);
        ctx.lineTo(px + slantX, py + lenY);
      }
      ctx.stroke();
      ctx.restore();
    } else if (weather === "snow") {
      const count = Math.round(78 * amt);
      ctx.save();
      for (let i = 0; i < count; i += 1) {
        const depth = 0.5 + hash01(i * 7.3) * 0.85;
        const sway = Math.sin(tSec * 1.6 + i * 1.7) * 14 * depth;
        const px = wrap01(hash01(i * 17.9) + tSec * 0.04 * depth) * w + sway;
        const py = wrap01(hash01(i * 41.1) + tSec * 0.16 * depth) * h;
        const r = (1.5 + hash01(i * 3.9) * 2.4) * depth;
        ctx.fillStyle = `rgba(240, 249, 255, ${(0.45 + 0.38 * amt).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (weather === "fog") {
      drawMistBands(ctx, w, h, [206, 218, 232], 0.24 * amt, tSec, 0.35);
    }
  }

  function drawMistBands(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rgb: readonly [number, number, number],
    alpha: number,
    tSec: number,
    speed: number,
  ): void {
    ctx.save();
    for (let i = 0; i < 5; i += 1) {
      const cx = wrap01(hash01(i * 23.1 + 0.3) + tSec * 0.025 * speed * (i % 2 === 0 ? 1 : -0.8)) * (w * 1.4) - w * 0.2;
      const cy = h * (0.18 + i * 0.17);
      const rx = w * (0.38 + hash01(i * 9.7) * 0.18);
      const ry = h * 0.20;
      const grad = ctx.createRadialGradient(cx, cy, ry * 0.1, cx, cy, rx);
      grad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.65, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(alpha * 0.45).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function drawAtmosphereEffect(ctx: CanvasRenderingContext2D, w: number, h: number, effect: AtmosphereEffect, tSec: number): void {
    const rgb = presetColorRgb(effect);
    const kind = effect.kind;
    const opacity = Math.max(0.12, Math.min(1, effect.opacity));
    const speed = Math.max(0.15, effect.speed);
    const size = Math.max(0.5, effect.size);

    if (kind === "sunrays") {
      drawSunShafts(ctx, w, h, rgb, Math.min(0.36, 0.14 + effect.amount * 0.24) * opacity, false);
      return;
    }

    if (kind === "smog" || kind === "steam" || kind === "poison") {
      drawMistBands(ctx, w, h, rgb, Math.min(0.30, (0.12 + effect.amount * 0.2) * opacity), tSec, speed * 0.6);
    }

    if (kind === "underwater") {
      ctx.save();
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(0.12 * opacity).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    const baseCount = kind === "runes" ? 18 : kind === "shades" ? 16 : kind === "sparks" ? 24 : 46;
    const count = Math.max(6, Math.round(baseCount * (0.35 + effect.amount * 0.85)));

    ctx.save();
    for (let i = 0; i < count; i += 1) {
      const s1 = hash01(i * 17.13 + kind.length * 3.7);
      const s2 = hash01(i * 31.79 + kind.charCodeAt(0));
      const s3 = hash01(i * 47.53 + 9.1);
      const sp = speed * (0.65 + s3 * 0.7);

      let px = 0;
      let py = 0;
      if (kind === "embers" || kind === "underwater" || kind === "spirits" || kind === "magic") {
        px = wrap01(s1 + Math.sin(tSec * 0.9 + i) * 0.025 + tSec * 0.02 * sp) * w;
        py = wrap01(s2 - tSec * 0.11 * sp) * h;
      } else if (kind === "sand") {
        px = wrap01(s1 + tSec * 0.36 * sp) * w;
        py = wrap01(s2 + tSec * 0.06 * sp) * h;
      } else if (kind === "leaks") {
        px = s1 * w;
        py = wrap01(s2 + tSec * 0.42 * sp) * h;
      } else if (kind === "fireflies" || kind === "runes" || kind === "shades") {
        px = wrap01(s1 + Math.sin(tSec * 0.45 * sp + i * 2.1) * 0.04) * w;
        py = wrap01(s2 + Math.cos(tSec * 0.38 * sp + i * 1.7) * 0.04) * h;
      } else {
        // petals, leaves, frost, ash, dust, etc.
        px = wrap01(s1 + tSec * 0.075 * sp + Math.sin(tSec * 1.3 + i) * 0.02) * w;
        py = wrap01(s2 + tSec * 0.11 * sp) * h;
      }

      const pulse = kind === "fireflies" || kind === "magic" || kind === "spirits" || kind === "sparks"
        ? 0.45 + 0.55 * Math.abs(Math.sin(tSec * 2.4 + i * 1.9))
        : 0.75 + 0.25 * s3;
      const a = Math.min(0.95, opacity * pulse);

      if (kind === "petals" || kind === "leaves") {
        const rx = (kind === "leaves" ? 5.0 : 4.2) * size * (0.8 + s3 * 0.45);
        const ry = rx * 0.54;
        const rot = tSec * 1.4 * sp + i * 1.3;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (kind === "fireflies" || kind === "spirits" || kind === "magic" || kind === "embers") {
        const r = (kind === "embers" ? 2.1 : 2.8) * size * (0.75 + s3 * 0.5);
        const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3.4);
        glow.addColorStop(0, `rgba(255, 255, 245, ${a.toFixed(3)})`);
        glow.addColorStop(0.35, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.82).toFixed(3)})`);
        glow.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "runes") {
        const r = 7.5 * size * (0.7 + s3 * 0.6);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(tSec * 0.5 + i);
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.68).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-r * 0.65, -r * 0.65, r * 1.3, r * 1.3);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (kind === "frost") {
        const r = 3.4 * size * (0.75 + s3 * 0.45);
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.85).toFixed(3)})`;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(px - r, py);
        ctx.lineTo(px + r, py);
        ctx.moveTo(px, py - r);
        ctx.lineTo(px, py + r);
        ctx.stroke();
      } else if (kind === "leaks") {
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.8).toFixed(3)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + 8 * size);
        ctx.stroke();
      } else if (kind === "sparks") {
        if (pulse > 0.72) {
          ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a.toFixed(3)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px - 4 * size, py - 3 * size);
          ctx.lineTo(px + 1 * size, py + 1 * size);
          ctx.lineTo(px - 1 * size, py + 4 * size);
          ctx.lineTo(px + 5 * size, py + 7 * size);
          ctx.stroke();
        }
      } else if (kind === "underwater") {
        const r = 3.2 * size * (0.65 + s3 * 0.7);
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.75).toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === "shades") {
        const r = 18 * size * (0.7 + s3 * 0.6);
        const grad = ctx.createRadialGradient(px, py, r * 0.1, px, py, r);
        grad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.42).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "sand") {
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.68).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + 12 * size, py + 2 * size);
        ctx.stroke();
      } else {
        const r = 2.0 * size * (0.7 + s3 * 0.55);
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(a * 0.78).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawDefaultLighting(ctx: CanvasRenderingContext2D, w: number, h: number, map: GameMap): void {
    const lighting = map.defaultLighting;
    if (!lighting || lighting.ambient <= 0.02 || !offscreenLight) return;

    const lw = Math.max(1, Math.round(w * 0.5));
    const lh = Math.max(1, Math.round(h * 0.5));
    if (offscreenLight.width !== lw || offscreenLight.height !== lh) {
      offscreenLight.width = lw;
      offscreenLight.height = lh;
    }
    const lctx = offscreenLight.getContext("2d");
    if (!lctx) return;

    const rgb = hexToRgb(lighting.color || "#070b18", [7, 11, 24]);
    const darkness = Math.min(0.84, lighting.ambient * 0.86);
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${darkness.toFixed(3)})`;
    lctx.fillRect(0, 0, lw, lh);

    const flashSource = lighting.sources?.find((s) => s.at === "player") ?? lighting.sources?.[0];
    const radiusTiles = flashSource?.radius ?? 0;
    if (radiusTiles > 0) {
      const cx = lw * 0.52;
      const cy = lh * 0.48;
      const rPx = Math.max(48, Math.min(lw, lh) * (0.14 + radiusTiles * 0.045));
      lctx.globalCompositeOperation = "destination-out";
      const cut = lctx.createRadialGradient(cx, cy, rPx * 0.18, cx, cy, rPx);
      cut.addColorStop(0, "rgba(0, 0, 0, 0.96)");
      cut.addColorStop(0.55, "rgba(0, 0, 0, 0.58)");
      cut.addColorStop(1, "rgba(0, 0, 0, 0)");
      lctx.fillStyle = cut;
      lctx.beginPath();
      lctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      lctx.fill();
    }

    ctx.save();
    ctx.drawImage(offscreenLight, 0, 0, w, h);
    if (radiusTiles > 0) {
      // Subtle warm lantern/flashlight rim glow in center
      const cx = w * 0.52;
      const cy = h * 0.48;
      const rPx = Math.max(96, Math.min(w, h) * (0.14 + radiusTiles * 0.045));
      const warm = ctx.createRadialGradient(cx, cy, 0, cx, cy, rPx * 0.85);
      warm.addColorStop(0, "rgba(255, 236, 190, 0.13)");
      warm.addColorStop(1, "rgba(255, 236, 190, 0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = warm;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function renderFrame(nowMs: number): void {
    syncCanvasSize();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, logicalW, logicalH);

    if (!isEditorMoodPreviewEnabled()) {
      applyPhaserFilter(null);
      host.hidden = true;
      stopLoop();
      return;
    }

    const map = currentMap();
    if (!map) {
      applyPhaserFilter(null);
      host.hidden = true;
      stopLoop();
      return;
    }

    const project = store.getCurrent();
    const postFx = resolvePostFx(map.postFx, project.system?.postFx);
    const effects = normalizeAtmosphereEffects(map.atmosphereEffects);
    const climate = normalizeMapClimate(map.climate);
    const fixedWeather = climate?.mode === "fixed" && climate.weather !== "none" && climate.intensity > 0.01
      ? climate
      : null;
    const hasClouds = Boolean(map.cloudShadows?.enabled);
    const hasLighting = Boolean(map.defaultLighting && map.defaultLighting.ambient > 0.02);

    applyPhaserFilter(postFx);

    const anyOverlay = postFx.active || effects.length > 0 || Boolean(fixedWeather) || hasClouds || hasLighting;
    host.hidden = !anyOverlay;
    if (!anyOverlay) {
      stopLoop();
      return;
    }

    const tSec = nowMs * 0.001;
    const suppressRays = Boolean(
      (fixedWeather && (fixedWeather.weather === "rain" || fixedWeather.weather === "storm" || fixedWeather.weather === "fog"))
      || hasLighting,
    );

    if (hasClouds) {
      drawCloudShadows(ctx, logicalW, logicalH, map, tSec);
    }
    for (const effect of effects) {
      drawAtmosphereEffect(ctx, logicalW, logicalH, effect, tSec);
    }
    if (fixedWeather) {
      drawWeather(ctx, logicalW, logicalH, fixedWeather.weather, fixedWeather.intensity, tSec);
    }
    if (hasLighting) {
      drawDefaultLighting(ctx, logicalW, logicalH, map);
    }
    if (postFx.active) {
      drawPostFxOverlay(ctx, logicalW, logicalH, postFx, map, suppressRays);
    }

    const needsAnimation = effects.length > 0 || Boolean(fixedWeather) || hasClouds;
    if (needsAnimation) ensureLoop();
    else stopLoop();
  }

  function tick(now: number): void {
    rafId = 0;
    if (!host.isConnected) return;
    if (now - lastDrawAt >= FRAME_INTERVAL_MS) {
      lastDrawAt = now;
      renderFrame(now);
    } else {
      ensureLoop();
    }
  }

  function ensureLoop(): void {
    if (rafId || typeof requestAnimationFrame !== "function") return;
    if (typeof document !== "undefined" && document.hidden) return;
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop(): void {
    if (rafId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
    }
    rafId = 0;
  }

  const refreshNow = (): void => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    lastDrawAt = now;
    renderFrame(now);
  };

  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => refreshNow())
    : null;
  resizeObserver?.observe(canvasArea);

  const unsubStore = store.subscribe(() => refreshNow());
  const unsubPreviewToggle = subscribeEditorMoodPreview(() => refreshNow());
  const onVisibility = (): void => {
    if (document.hidden) stopLoop();
    else refreshNow();
  };
  document.addEventListener("visibilitychange", onVisibility);

  refreshNow();

  return () => {
    stopLoop();
    resizeObserver?.disconnect();
    unsubStore();
    unsubPreviewToggle();
    document.removeEventListener("visibilitychange", onVisibility);
    phaserContainer.style.filter = "";
    host.remove();
  };
}
