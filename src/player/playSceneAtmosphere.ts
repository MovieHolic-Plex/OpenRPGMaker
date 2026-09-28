import { getAudioEngine } from "./audio";
import type Phaser from "phaser";
import type { PlaySceneContext } from "./playSceneTypes";
import { ATMOSPHERE_PRESETS, normalizeAtmosphereEffects, type AtmosphereEffect, type AtmosphereKind } from "@/project/atmosphere";
import { ensureFogTexture, FOG_BAKE_ROWS_PER_FRAME } from "./weather/fogTexture";
import { runtimePixelDensity } from "./runtimeViewScale";

type State = { layer: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics;
  mist: Map<string, Phaser.GameObjects.TileSprite>; times: Map<string, number>; clock: number; mapId: string };
const states = new WeakMap<PlaySceneContext, State>();
const wrap = (n: number, size: number) => ((n % size) + size) % size;
const random = (n: number, salt: number) => {
  let v = Math.imul(n + salt, 1597334677);
  v = Math.imul(v ^ (v >>> 16), 2246822519);
  return ((v ^ (v >>> 13)) >>> 0) / 4294967296;
};
const hazeKinds = new Set<AtmosphereKind>(["poison", "smog", "steam", "sand"]);

/** Full-screen map decoration; shares weather clock but never changes gameplay weather. */
export function syncAtmosphere(scene: PlaySceneContext): void {
  const effects = normalizeAtmosphereEffects(scene.map?.atmosphereEffects);
  const audio = getAudioEngine();
  audio.atmosphere.update(effects, audio.isUnlocked());
  let state = states.get(scene);
  if (!state && !effects.length) return;
  if (!state) {
    const layer = scene.add.container(0, 0).setDepth(800_010).setScrollFactor(0);
    const graphics = scene.add.graphics().setScrollFactor(0);
    layer.add(graphics);
    state = { layer, graphics, mist: new Map(), times: new Map(), clock: scene.weatherClockMs, mapId: scene.map.id };
    states.set(scene, state);
    scene.events.once("shutdown", () => { audio.atmosphere.stop(); states.delete(scene); });
  }
  const { layer, graphics, mist, times } = state;
  if (state.mapId !== scene.map.id) { times.clear(); state.mapId = scene.map.id; }
  const dt = Math.max(0, scene.weatherClockMs - state.clock) / 1000;
  state.clock = scene.weatherClockMs;
  graphics.clear();
  layer.setVisible(effects.length > 0);
  for (const sprite of mist.values()) sprite.setVisible(false);
  const { width: canvasWidth, height: canvasHeight } = scene.cameras.main;
  const zoom = scene.cameras.main.zoom || 1;
  // 논리 px 로 그린다 — 캔버스 픽셀 밀도가 올라가도 입자·안개 크기가 같다(playSceneWeather 와 같은 식).
  const density = runtimePixelDensity(scene);
  const width = canvasWidth / density;
  const height = canvasHeight / density;
  layer.setPosition(canvasWidth / 2 * (1 - 1 / zoom), canvasHeight / 2 * (1 - 1 / zoom)).setScale(density / zoom);
  for (const effect of effects) {
    const time = (times.get(effect.kind) ?? 0) + dt * effect.speed;
    times.set(effect.kind, time);
    if (effect.amount <= 0 || effect.opacity <= 0) continue;
    const color = effect.tint ? Number.parseInt(effect.tint.slice(1), 16) : ATMOSPHERE_PRESETS.find(p => p.id === effect.kind)!.color;
    if (hazeKinds.has(effect.kind)) {
      const key = ensureFogTexture(scene.textures, undefined, FOG_BAKE_ROWS_PER_FRAME, scene.game?.loop?.frame);
      for (let index = 0; key && index < 2; index++) {
        const id = `${effect.kind}-${index}`;
        let sprite = mist.get(id);
        if (!sprite) {
          sprite = scene.add.tileSprite(0, 0, width, height, key).setOrigin(0).setScrollFactor(0);
          mist.set(id, sprite); layer.addAt(sprite, 0);
        }
        if (sprite.width !== width || sprite.height !== height) sprite.setSize(width, height);
        sprite.setTileScale((2.3 - index * 0.8) * effect.size, (effect.kind === "steam" ? 1.8 : 1) * effect.size);
        sprite.tilePositionX = time * (effect.kind === "sand" ? 65 : 9) * (index ? -0.6 : 1) + index * 131;
        sprite.tilePositionY = time * (effect.kind === "steam" ? -23 : -3) + index * 77;
        sprite.setTint(color).setAlpha(effect.opacity * effect.amount * 0.7).setVisible(true);
      }
    }
    if (effect.kind === "underwater") {
      graphics.fillStyle(0x147fba, effect.opacity * effect.amount * 0.22);
      graphics.fillRect(0, 0, width, height);
    }
    if (effect.kind === "sunrays" || effect.kind === "underwater") rays(graphics, effect, time, width, height, color);
    particles(graphics, effect, time, width, height, color);
  }
}

function rays(g: Phaser.GameObjects.Graphics, e: AtmosphereEffect, t: number, w: number, h: number, color: number): void {
  for (let i = 0; i < Math.ceil(7 * e.amount); i++) {
    const x = random(i, 81) * w + Math.sin(t * 0.3 + i) * 13;
    const spread = (18 + random(i, 33) * 25) * e.size;
    for (let band = 4; band > 0; band--) {
      const half = spread * band / 4;
      g.fillStyle(color, e.opacity * 0.018 * (0.7 + 0.3 * Math.sin(t * 0.7 + i)));
      g.fillPoints([{ x: x - half / 4, y: 0 }, { x: x + half / 4, y: 0 },
        { x: x - h * 0.32 + half, y: h }, { x: x - h * 0.32 - half, y: h }], true);
    }
  }
}

function particles(g: Phaser.GameObjects.Graphics, e: AtmosphereEffect, t: number, w: number, h: number, color: number): void {
  const kind = e.kind;
  if (kind === "smog" || kind === "steam" || kind === "poison") return;
  const glow = ["fireflies", "magic", "spirits", "embers", "sparks", "runes", "shades", "frost"].includes(kind);
  const count = Math.round(e.amount * (kind === "runes" ? 12 : kind === "sand" ? 110 : glow ? 38 : 65));
  for (let i = 0; i < count; i++) {
    const a = random(i, 17), b = random(i, 43), phase = random(i, 99) * Math.PI * 2;
    const up = kind === "shades" || kind === "runes" || kind === "underwater" || kind === "magic" || kind === "spirits" || kind === "embers";
    const velocity = kind === "leaks" ? 140 + a * 80 : kind === "sand" ? 15 : 7 + a * 19;
    const drift = kind === "sand" ? 120 : kind === "leaves" || kind === "petals" ? 19 : 3;
    const sway = Math.sin(t * (0.5 + a) + phase) * (kind === "spirits" ? 25 : 10);
    const x = wrap(b * (w + 40) + t * drift + sway, w + 40) - 20;
    const y = wrap(a * (h + 40) + t * velocity * (up ? -1 : 1), h + 40) - 20;
    let alpha = e.opacity * (0.45 + a * 0.55);
    const radius = (0.7 + a * 1.8) * e.size;
    if (glow) alpha *= 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.8 + phase), 2);
    if (kind === "runes") {
      const r = radius * 7, rotation = t * 0.25 + phase;
      g.lineStyle(0.65, color, alpha * 0.65); g.strokeCircle(x, y, r);
      const points = Array.from({ length: 6 }, (_, n) => ({ x: x + Math.cos(rotation + n * Math.PI / 3) * r * 0.78, y: y + Math.sin(rotation + n * Math.PI / 3) * r * 0.78 }));
      g.strokePoints([points[0]!, points[2]!, points[4]!], true);
      g.strokePoints([points[1]!, points[3]!, points[5]!], true);
      for (let n = 0; n < 6; n++) {
        const a = rotation + n * Math.PI / 3;
        g.lineBetween(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2);
      }
    } else if (kind === "shades") {
      for (let band = 3; band > 0; band--) {
        g.lineStyle(radius * band * 1.2, color, alpha * 0.12);
        g.beginPath(); g.moveTo(x, y);
        for (let n = 1; n <= 6; n++) g.lineTo(x + Math.sin(t * 1.3 + phase + n * 0.45) * radius * n, y + n * radius * 2.5);
        g.strokePath();
      }
    } else if (kind === "frost") {
      g.lineStyle(0.65, color, alpha);
      for (let n = 0; n < 3; n++) {
        const a = t * 0.2 + phase + n * Math.PI / 3;
        g.lineBetween(x - Math.cos(a) * radius * 2, y - Math.sin(a) * radius * 2, x + Math.cos(a) * radius * 2, y + Math.sin(a) * radius * 2);
      }
    } else if (kind === "sparks") {
      const flash = wrap(t * 0.45 + b, 1);
      if (flash > 0.18) continue;
      g.lineStyle(0.8 * e.size, color, alpha);
      g.beginPath(); g.moveTo(x - radius * 4, y - radius * 3);
      g.lineTo(x, y); g.lineTo(x - radius, y + radius * 2); g.lineTo(x + radius * 4, y + radius * 4); g.strokePath();
    } else if (kind === "underwater") {
      g.lineStyle(0.7, color, alpha * 0.65); g.strokeCircle(x, y, radius * 1.7);
      g.fillStyle(0xe6ffff, alpha * 0.75); g.fillCircle(x - radius * 0.6, y - radius * 0.6, Math.max(0.45, radius * 0.3));
    } else if (kind === "leaves" || kind === "petals") {
      const rotation = t * (0.8 + a) + phase;
      const long = radius * 2, short = radius * (0.25 + Math.abs(Math.sin(rotation)) * 0.6);
      const points = [[-long, 0], [-long * 0.3, -short], [long, 0], [long * 0.3, short]].map(([dx, dy]) => ({
        x: x + dx! * Math.cos(rotation) - dy! * Math.sin(rotation), y: y + dx! * Math.sin(rotation) + dy! * Math.cos(rotation),
      }));
      g.fillStyle(!e.tint && i % 3 === 0 ? (kind === "petals" ? 0xffe9f2 : 0xb65a31) : color, alpha); g.fillPoints(points, true);
      if (kind === "leaves") { g.lineStyle(0.4, 0x764329, alpha * 0.8); g.lineBetween(points[0]!.x, points[0]!.y, points[2]!.x, points[2]!.y); }
    } else if (kind === "leaks" || kind === "sand") {
      g.lineStyle(kind === "leaks" ? 0.8 : 0.5, color, alpha * 0.65);
      g.lineBetween(x, y, x + (kind === "sand" ? radius * 5 : 0), y + (kind === "leaks" ? radius * 5 : radius));
    } else {
      if (glow) {
        for (let band = 3; band > 0; band--) { g.fillStyle(color, alpha * 0.035); g.fillCircle(x, y, radius * band * 2); }
        if (kind === "spirits" || kind === "embers") {
          g.lineStyle(radius, color, alpha * 0.2); g.lineBetween(x, y, x - sway * 0.2, y + radius * 7);
        }
      }
      g.fillStyle(glow ? 0xfff4da : color, alpha); g.fillCircle(x, y, glow ? radius * 0.55 : radius * 0.5);
      if (kind === "magic") {
        g.lineStyle(0.6, color, alpha); g.lineBetween(x - radius * 2, y, x + radius * 2, y); g.lineBetween(x, y - radius * 2, x, y + radius * 2);
      }
    }
  }
}
