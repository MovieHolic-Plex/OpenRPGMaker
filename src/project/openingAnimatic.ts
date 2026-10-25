/** Authored 2D timeline. Times are shot-local milliseconds, geometry is stage pixels. */
export type AnimaticEase = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step';
export type AnimaticKey = { atMs: number; value: number; ease?: AnimaticEase };
export type AnimaticProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity' | 'frame';
export type AnimaticTracks = Partial<Record<AnimaticProperty, AnimaticKey[]>>;
export type AnimaticLayerKind = 'image' | 'text' | 'shape' | 'particles' | 'shaft' | 'glow' | 'emote' | 'caption';
export const ANIMATIC_LAYER_KINDS: readonly AnimaticLayerKind[] = ['image', 'text', 'shape', 'particles', 'shaft', 'glow', 'emote', 'caption'];
/** Integer-pixel composition: the whole shot rasterises into one low-resolution buffer, then upscales by an integer factor. */
export type AnimaticPixelGrid = { width: number; height: number };
/** Seeded intensity modulation. 'pulse' breathes on a sine; 'flicker' steps on hashed noise (torch, failing light). */
export type AnimaticPulse = { hz?: number; amount?: number; pattern?: 'pulse' | 'flicker'; seed?: number };
export type AnimaticDust = { count: number; seed: number; speed?: number; size?: number };
export type AnimaticShaft = { spread?: number; softness?: number; dust?: AnimaticDust; pulse?: AnimaticPulse };
export type AnimaticGlow = { inner?: number; pulse?: AnimaticPulse };
export type AnimaticEmote = { preset: 'exclaim' | 'question' | 'ellipsis' | 'heart' | 'sweat'; tail?: 'down' | 'none'; popMs?: number; outMs?: number };
/**
 * Region loop: only the region window animates. Layer-local coordinates equal source image pixels
 * when the layer has no crop, so the region doubles as the tile source for the scroll modes.
 */
export type AnimaticRegionLoop = {
  x: number; y: number; width: number; height: number;
  mode: 'scroll-x' | 'scroll-y' | 'palette-cycle' | 'strip';
  /** scroll: distance advanced per step. */
  pixels?: number;
  /** steps happen once every this many ticks. */
  everyTicks?: number;
  /** stated tick rate in milliseconds (default 16). "1 px every 4 frames at 60fps" = pixels:1, everyTicks:4, tickMs:16. */
  tickMs?: number;
  /** scroll: tile the source region (default true). false slides once and leaves the window empty at the far edge. */
  wrap?: boolean;
  /** palette-cycle: source colors remapped to the next color each step. */
  colors?: string[];
  /** strip: horizontal frame strip replayed inside the window. */
  frames?: { frameWidth: number; frameHeight: number; count: number; fps: number };
};
export type AnimaticCaptionCue = { atMs: number; text: string; color?: string; typewriterMs?: number };
/** Bottom letterbox caption. Position is safe-area aware; per cue color/typewriter, then fade out. */
export type AnimaticCaption = { cues: AnimaticCaptionCue[]; safeArea?: number; fadeOutMs?: number };
/** Stride-matched walk: the sprite frame advances with travelled distance, so feet do not slide. */
export type AnimaticWalk = { stride: number; frames: number[]; holdFrame?: number; phase?: number };
export type AnimaticLayer = {
  id: string;
  kind: AnimaticLayerKind;
  role?: 'background' | 'actor' | 'foreground' | 'prop' | 'effect' | 'credit';
  /** Semantic actor tag used by opening review (knight/villager/mage/hero/monster). */
  characterRole?: 'knight' | 'villager' | 'mage' | 'hero' | 'monster' | 'crowd';
  /** Named states map to sprite-sheet frame indices (for crystal/eye/sword state changes). */
  stateFrames?: Record<string, number>;
  resourceId?: string;
  text?: string;
  color?: string;
  shape?: 'rect' | 'ellipse' | 'line';
  x: number; y: number; width: number; height: number;
  anchorX?: number; anchorY?: number;
  scaleX?: number; scaleY?: number; rotation?: number; opacity?: number;
  startMs?: number; endMs?: number;
  space?: 'world' | 'screen'; parallax?: number;
  blend?: 'source-over' | 'lighter' | 'screen' | 'multiply';
  keys?: AnimaticTracks;
  sampling?: 'nearest' | 'linear';
  crop?: { x: number; y: number; width: number; height: number };
  sheet?: { frameWidth: number; frameHeight: number; columns: number; count: number; fps: number; loop?: boolean };
  typography?: { fontSize?: number; weight?: number; align?: 'left' | 'center' | 'right'; typewriterMs?: number };
  particles?: { preset: AnimaticParticlePreset; count: number; seed: number; speed?: number; size?: number };
  region?: AnimaticRegionLoop;
  shaft?: AnimaticShaft;
  glow?: AnimaticGlow;
  emote?: AnimaticEmote;
  caption?: AnimaticCaption;
  walk?: AnimaticWalk;
};
export type AnimaticCamera = {
  x?: number; y?: number; zoom?: number; rotation?: number;
  keys?: Partial<Record<'x' | 'y' | 'zoom' | 'rotation', AnimaticKey[]>>;
  shake?: { atMs: number; durationMs: number; amplitude: number; frequency?: number; seed?: number };
};
export type AnimaticAudioCue = {
  id: string; resourceId: string; atMs: number; durationMs: number;
  volume?: number; fadeInMs?: number; fadeOutMs?: number; offsetMs?: number; loop?: boolean;
};
export type OpeningAnimatic = {
  width: number; height: number; background?: string; letterbox?: number;
  pixelGrid?: AnimaticPixelGrid;
  /**
   * Playback backing store. 'smooth' (default): the canvas is stage-sized and the browser scales it up (soft).
   * 'nearest': the canvas is the largest integer multiple of the stage that fits the displayed box, so
   * nearest-sampled art keeps square pixels and text/glows render at that resolution.
   */
  upscale?: 'smooth' | 'nearest';
  layers: AnimaticLayer[]; camera?: AnimaticCamera; audioCues?: AnimaticAudioCue[];
  transition?: { kind: 'cut' | 'fade' | 'wipe-left' | 'wipe-right' | 'iris' | 'flash' | 'dither'; durationMs: number; color?: string };
};
/**
 * Seeded particle presets. petals = cherry-blossom petals drifting down and sideways while they tumble (two-tone flake, the flat
 * side flips); paper = A4 sheets fluttering down, rotating as they fall (white rectangles with a shade edge).
 */
export type AnimaticParticlePreset = 'rain' | 'snow' | 'sparks' | 'dust' | 'stars' | 'petals' | 'paper';
export const ANIMATIC_PARTICLE_PRESETS: readonly AnimaticParticlePreset[] = ['rain', 'snow', 'sparks', 'dust', 'stars', 'petals', 'paper'];
export const ANIMATIC_LIMITS = { layers: 32, keysPerTrack: 128, audioCues: 32, particles: 200, captionCues: 32, dimension: 1920 } as const;
export const ANIMATIC_TRANSITION_KINDS = ['cut', 'fade', 'wipe-left', 'wipe-right', 'iris', 'flash', 'dither'] as const;
export const ANIMATIC_REGION_MODES = ['scroll-x', 'scroll-y', 'palette-cycle', 'strip'] as const;
export const ANIMATIC_EMOTE_PRESETS = ['exclaim', 'question', 'ellipsis', 'heart', 'sweat'] as const;
export const ANIMATIC_PROPERTIES: AnimaticProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'frame'];
const EASES: AnimaticEase[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'step'];
const COLOR = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgba?|hsla?)\([\d\s.,%+-]+\)|transparent|black|white)$/i;
/** Parses every color form the validator accepts (hex 3/4/6/8, rgb[a], hsl[a], black/white/transparent) to [r,g,b,a 0..1]. */
export function parseCssColor(input: string): [number, number, number, number] | null {
  const c = input.trim().toLowerCase();
  if (c === 'black') return [0, 0, 0, 1];
  if (c === 'white') return [255, 255, 255, 1];
  if (c === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]{3,8})$/.exec(c);
  if (hex && [3, 4, 6, 8].includes(hex[1]!.length)) {
    const h = hex[1]!.length <= 4 ? hex[1]!.split('').map(ch => ch + ch).join('') : hex[1]!;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(c);
  if (!fn) return null;
  const parts = fn[2]!.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const num = (v: string, scale: number) => v.endsWith('%') ? parseFloat(v) / 100 * scale : parseFloat(v);
  const alpha = parts[3] === undefined ? 1 : Math.max(0, Math.min(1, num(parts[3], 1)));
  if (fn[1]!.startsWith('rgb')) {
    const rgb = parts.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(num(v, 255)))));
    return rgb.some(Number.isNaN) ? null : [rgb[0]!, rgb[1]!, rgb[2]!, alpha];
  }
  const hue = (((parseFloat(parts[0]!) % 360) + 360) % 360) / 360, sat = Math.max(0, Math.min(1, num(parts[1]!, 1))), lig = Math.max(0, Math.min(1, num(parts[2]!, 1)));
  if ([hue, sat, lig].some(Number.isNaN)) return null;
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat, pp = 2 * lig - q;
  const chan = (t0: number) => { const t = (t0 + 1) % 1; const v = t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; return Math.round(v * 255); };
  return sat === 0 ? [Math.round(lig * 255), Math.round(lig * 255), Math.round(lig * 255), alpha] : [chan(hue + 1 / 3), chan(hue), chan(hue - 1 / 3), alpha];
}
function object(v: unknown, path: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error(`${path}: object required`);
  return v as Record<string, unknown>;
}
function fields(v: Record<string, unknown>, allowed: string[], path: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) throw Error(`${path}.${k}: unsupported field`);
}
function number(v: unknown, path: string, min: number, max: number, integer = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || integer && !Number.isSafeInteger(v)) throw Error(`${path}: ${min}..${max} ${integer ? 'integer' : 'number'} required`);
  return v;
}
function id(v: unknown, path: string): void { if (typeof v !== 'string' || !v.trim() || v.length > 160) throw Error(`${path}: nonempty id required`); }
function option(v: unknown, values: readonly string[], path: string): void { if (v !== undefined && (typeof v !== 'string' || !values.includes(v))) throw Error(`${path}: ${values.join('/')} required`); }
function color(v: unknown, path: string): void { if (v !== undefined && (typeof v !== 'string' || !COLOR.test(v))) throw Error(`${path}: CSS hex/rgb color required`); }
function boolean(v: unknown, path: string): void { if (v !== undefined && typeof v !== 'boolean') throw Error(`${path}: boolean required`); }
function pulse(value: unknown, path: string): void {
  const p = object(value, path); fields(p, ['hz', 'amount', 'pattern', 'seed'], path);
  if (p.hz !== undefined) number(p.hz, path + '.hz', 0.05, 20);
  if (p.amount !== undefined) number(p.amount, path + '.amount', 0, 1);
  option(p.pattern, ['pulse', 'flicker'], path + '.pattern');
  if (p.seed !== undefined) number(p.seed, path + '.seed', 0, 2147483647, true);
}
function dust(value: unknown, path: string): void {
  const d = object(value, path); fields(d, ['count', 'seed', 'speed', 'size'], path);
  number(d.count, path + '.count', 1, ANIMATIC_LIMITS.particles, true); number(d.seed, path + '.seed', 0, 2147483647, true);
  if (d.speed !== undefined) number(d.speed, path + '.speed', 0, 200);
  if (d.size !== undefined) number(d.size, path + '.size', 0.5, 8);
}
export function validateAnimaticTracks(value: unknown, properties: string[], durationMs: number, path = 'keys'): void {
  if (value === undefined) return;
  const tracks = object(value, path); fields(tracks, properties, path);
  for (const [property, raw] of Object.entries(tracks)) {
    if (!Array.isArray(raw) || !raw.length || raw.length > ANIMATIC_LIMITS.keysPerTrack) throw Error(`${path}.${property}: 1..128 keys required`);
    let previous = -1;
    for (const [i, item] of raw.entries()) {
      const k = object(item, `${path}.${property}[${i}]`); fields(k, ['atMs', 'value', 'ease'], path);
      const at = number(k.atMs, path + '.atMs', 0, durationMs, true);
      if (at <= previous) throw Error(`${path}.${property}: times must be strictly increasing`);
      previous = at;
      const range = property === 'opacity' ? [0, 1] : property === 'zoom' ? [0.05, 20] : property === 'frame' ? [0, 4095] : property.startsWith('scale') ? [-20, 20] : [-20000, 20000];
      number(k.value, path + '.value', range[0], range[1], property === 'frame');
      option(k.ease, EASES, path + '.ease');
    }
  }
}
/** Strict and additive: unsupported animation fields are errors, never silently discarded. */
export function validateOpeningAnimatic(value: unknown, durationMs: number, path = 'animatic'): asserts value is OpeningAnimatic {
  number(durationMs, path + '.durationMs', 1, 120000, true);
  const a = object(value, path); fields(a, ['width', 'height', 'background', 'letterbox', 'pixelGrid', 'upscale', 'layers', 'camera', 'audioCues', 'transition'], path);
  option(a.upscale, ['smooth', 'nearest'], path + '.upscale');
  number(a.width, path + '.width', 64, ANIMATIC_LIMITS.dimension, true); number(a.height, path + '.height', 64, ANIMATIC_LIMITS.dimension, true);
  color(a.background, path + '.background'); if (a.letterbox !== undefined) number(a.letterbox, path + '.letterbox', 0, 0.25);
  if (a.pixelGrid !== undefined) {
    const g = object(a.pixelGrid, path + '.pixelGrid'); fields(g, ['width', 'height'], path + '.pixelGrid');
    const gw = number(g.width, path + '.pixelGrid.width', 16, ANIMATIC_LIMITS.dimension, true), gh = number(g.height, path + '.pixelGrid.height', 16, ANIMATIC_LIMITS.dimension, true);
    if (gw > Number(a.width) || gh > Number(a.height)) throw Error(`${path}.pixelGrid: must not exceed the stage size (${a.width}×${a.height})`);
  }
  if (!Array.isArray(a.layers) || a.layers.length > ANIMATIC_LIMITS.layers) throw Error(`${path}.layers: at most32 layers required`);
  const ids = new Set<string>();
  for (const [i, raw] of a.layers.entries()) {
    const p = `${path}.layers[${i}]`, l = object(raw, p);
    fields(l, ['id', 'kind', 'role', 'characterRole', 'stateFrames', 'resourceId', 'text', 'color', 'shape', 'x', 'y', 'width', 'height', 'anchorX', 'anchorY', 'scaleX', 'scaleY', 'rotation', 'opacity', 'startMs', 'endMs', 'space', 'parallax', 'blend', 'keys', 'sampling', 'crop', 'sheet', 'typography', 'particles', 'region', 'shaft', 'glow', 'emote', 'caption', 'walk'], p);
    id(l.id, p + '.id'); if (ids.has(String(l.id))) throw Error(p + ': duplicate layer id'); ids.add(String(l.id));
    option(l.kind, ANIMATIC_LAYER_KINDS, p + '.kind'); if (!l.kind) throw Error(p + ': kind required');
    option(l.role, ['background', 'actor', 'foreground', 'prop', 'effect', 'credit'], p + '.role');
    option(l.characterRole, ['knight', 'villager', 'mage', 'hero', 'monster', 'crowd'], p + '.characterRole');
    if (l.stateFrames !== undefined) {
      const states = object(l.stateFrames, p + '.stateFrames'); 
      for (const [state, frame] of Object.entries(states)) {
        if (!state.trim()) throw Error(`${p}.stateFrames: state names must be nonempty`);
        number(frame, `${p}.stateFrames.${state}`, 0, 4095, true);
      }
    }
    for (const k of ['x', 'y']) number(l[k], p + '.' + k, -20000, 20000);
    for (const k of ['width', 'height']) number(l[k], p + '.' + k, 1, 20000);
    for (const k of ['anchorX', 'anchorY', 'opacity']) if (l[k] !== undefined) number(l[k], p + '.' + k, 0, 1);
    for (const k of ['scaleX', 'scaleY']) if (l[k] !== undefined) number(l[k], p + '.' + k, -20, 20);
    if (l.rotation !== undefined) number(l.rotation, p + '.rotation', -20000, 20000);
    if (l.parallax !== undefined) number(l.parallax, p + '.parallax', 0, 2);
    const start = l.startMs === undefined ? 0 : number(l.startMs, p + '.startMs', 0, durationMs, true);
    const end = l.endMs === undefined ? durationMs : number(l.endMs, p + '.endMs', 0, durationMs, true);
    if (end <= start) throw Error(p + ': endMs must exceed startMs');
    option(l.space, ['world', 'screen'], p + '.space'); option(l.blend, ['source-over', 'lighter', 'screen', 'multiply'], p + '.blend'); color(l.color, p + '.color');
    validateAnimaticTracks(l.keys, ANIMATIC_PROPERTIES, durationMs, p + '.keys');
    if (l.kind === 'image') { id(l.resourceId, p + '.resourceId'); option(l.sampling, ['nearest', 'linear'], p + '.sampling'); }
    else if (l.resourceId !== undefined || l.sampling !== undefined || l.crop !== undefined || l.sheet !== undefined) throw Error(p + ': image fields on nonimage layer');
    if (l.kind === 'text' || l.kind === 'caption') { if (l.kind === 'text' && (typeof l.text !== 'string' || l.text.length > 4000)) throw Error(p + ': text length must be0..4000'); }
    else if (l.text !== undefined || l.typography !== undefined) throw Error(p + ': typography on nontext layer');
    if (l.kind === 'text' && typeof l.text !== 'string') throw Error(p + ': text layer requires text');
    if (l.kind === 'shape') option(l.shape, ['rect', 'ellipse', 'line'], p + '.shape');
    else if (l.shape !== undefined) throw Error(p + ': shape on nonshape layer');
    if (l.crop !== undefined) {
      const crop = object(l.crop, p + '.crop'); fields(crop, ['x', 'y', 'width', 'height'], p + '.crop');
      for (const k of ['x', 'y']) number(crop[k], p + '.crop.' + k, 0, 20000, true);
      for (const k of ['width', 'height']) number(crop[k], p + '.crop.' + k, 1, 20000, true);
    }
    if (l.sheet !== undefined) {
      if (l.crop !== undefined) throw Error(p + ': sheet and crop are exclusive');
      const s = object(l.sheet, p + '.sheet'); fields(s, ['frameWidth', 'frameHeight', 'columns', 'count', 'fps', 'loop'], p + '.sheet');
      for (const k of ['frameWidth', 'frameHeight', 'columns', 'count']) number(s[k], p + '.sheet.' + k, 1, 4096, true);
      number(s.fps, p + '.sheet.fps', 0, 60); if (s.loop !== undefined && typeof s.loop !== 'boolean') throw Error(p + ': sheet.loop must be boolean');
      for (const k of (l.keys as AnimaticTracks | undefined)?.frame ?? []) if (k.value >= Number(s.count)) throw Error(p + ': frame key exceeds sheet count');
    } else if ((l.keys as AnimaticTracks | undefined)?.frame) throw Error(p + ': frame keys require a sprite sheet');
    if (l.typography !== undefined) {
      const t = object(l.typography, p + '.typography'); fields(t, ['fontSize', 'weight', 'align', 'typewriterMs'], p + '.typography');
      if (t.fontSize !== undefined) number(t.fontSize, p + '.fontSize', 8, 300);
      if (t.weight !== undefined) {
        if (t.weight === 'normal' || t.weight === 'regular') t.weight = 400;
        else if (t.weight === 'medium') t.weight = 500;
        else if (t.weight === 'semibold') t.weight = 600;
        else if (t.weight === 'bold' || t.weight === 'heavy' || t.weight === 'black') t.weight = 700;
        number(t.weight, p + '.weight', 100, 900, true);
      }
      option(t.align, ['left', 'center', 'right'], p + '.align'); if (t.typewriterMs !== undefined) number(t.typewriterMs, p + '.typewriterMs', 0, durationMs, true);
    }
    if (l.kind === 'particles') {
      const q = object(l.particles, p + '.particles'); fields(q, ['preset', 'count', 'seed', 'speed', 'size'], p + '.particles');
      option(q.preset, ANIMATIC_PARTICLE_PRESETS, p + '.preset'); if (!q.preset) throw Error(p + ': particle preset required');
      number(q.count, p + '.count', 1, ANIMATIC_LIMITS.particles, true); number(q.seed, p + '.seed', 0, 2147483647, true);
      if (q.speed !== undefined) number(q.speed, p + '.speed', 0, 2000); if (q.size !== undefined) number(q.size, p + '.size', 0.5, 100);
    } else if (l.particles !== undefined) throw Error(p + ': particles on nonparticle layer');
    if (l.kind === 'shaft') {
      const s = object(l.shaft, p + '.shaft'); fields(s, ['spread', 'softness', 'dust', 'pulse'], p + '.shaft');
      const spread = s.spread === undefined ? 0.6 : number(s.spread, p + '.shaft.spread', 0, 0.95);
      if (spread >= 1) throw Error(p + '.shaft.spread: below1 required');
      if (s.softness !== undefined) number(s.softness, p + '.shaft.softness', 0, 1);
      if (s.dust !== undefined) dust(s.dust, p + '.shaft.dust');
      if (s.pulse !== undefined) pulse(s.pulse, p + '.shaft.pulse');
    } else if (l.shaft !== undefined) throw Error(p + ': shaft fields on non-shaft layer');
    if (l.kind === 'glow') {
      const g = object(l.glow, p + '.glow'); fields(g, ['inner', 'pulse'], p + '.glow');
      if (g.inner !== undefined) number(g.inner, p + '.glow.inner', 0, 0.95);
      if (g.pulse !== undefined) pulse(g.pulse, p + '.glow.pulse');
    } else if (l.glow !== undefined) throw Error(p + ': glow fields on non-glow layer');
    if (l.kind === 'emote') {
      const e = object(l.emote, p + '.emote'); fields(e, ['preset', 'tail', 'popMs', 'outMs'], p + '.emote');
      option(e.preset, ANIMATIC_EMOTE_PRESETS, p + '.emote.preset'); if (!e.preset) throw Error(p + '.emote.preset: required');
      option(e.tail, ['down', 'none'], p + '.emote.tail');
      if (e.popMs !== undefined) number(e.popMs, p + '.emote.popMs', 0, 3000, true);
      if (e.outMs !== undefined) number(e.outMs, p + '.emote.outMs', 0, 3000, true);
      if (Number(l.width) > 256 || Number(l.height) > 256) throw Error(p + ': emote bubble box must be at most256×256');
    } else if (l.emote !== undefined) throw Error(p + ': emote fields on non-emote layer');
    if (l.kind === 'caption') {
      const c = object(l.caption, p + '.caption'); fields(c, ['cues', 'safeArea', 'fadeOutMs'], p + '.caption');
      if (!Array.isArray(c.cues) || !c.cues.length || c.cues.length > ANIMATIC_LIMITS.captionCues) throw Error(p + '.caption.cues: 1..32 cues required');
      let previous = -1;
      for (const [ci, rawCue] of c.cues.entries()) {
        const cue = object(rawCue, `${p}.caption.cues[${ci}]`); fields(cue, ['atMs', 'text', 'color', 'typewriterMs'], `${p}.caption.cues[${ci}]`);
        const at = number(cue.atMs, `${p}.caption.cues[${ci}].atMs`, 0, durationMs, true);
        if (at <= previous) throw Error(`${p}.caption.cues: times must be strictly increasing`); previous = at;
        if (typeof cue.text !== 'string' || !cue.text.length || cue.text.length > 200) throw Error(`${p}.caption.cues[${ci}].text: 1..200 characters required`);
        color(cue.color, `${p}.caption.cues[${ci}].color`);
        if (cue.typewriterMs !== undefined) number(cue.typewriterMs, `${p}.caption.cues[${ci}].typewriterMs`, 0, durationMs, true);
      }
      if (c.safeArea !== undefined) number(c.safeArea, p + '.caption.safeArea', 0, 0.25);
      if (c.fadeOutMs !== undefined) number(c.fadeOutMs, p + '.caption.fadeOutMs', 0, Math.min(3000, durationMs), true);
    } else if (l.caption !== undefined) throw Error(p + ': caption fields on non-caption layer');
    if (l.region !== undefined) {
      if (l.kind !== 'image') throw Error(p + ': region loops are image layers only');
      if (l.sheet !== undefined) throw Error(p + ': region and sheet are exclusive — a strip loop uses region.frames');
      const r = object(l.region, p + '.region'); fields(r, ['x', 'y', 'width', 'height', 'mode', 'pixels', 'everyTicks', 'tickMs', 'wrap', 'colors', 'frames'], p + '.region');
      for (const k of ['x', 'y', 'width', 'height']) number(r[k], p + '.region.' + k, k === 'x' || k === 'y' ? 0 : 1, 20000, true);
      option(r.mode, ANIMATIC_REGION_MODES, p + '.region.mode'); if (!r.mode) throw Error(p + '.region.mode: required');
      const scroll = r.mode === 'scroll-x' || r.mode === 'scroll-y';
      if (scroll) number(r.pixels, p + '.region.pixels', 1, 64, true);
      else if (r.pixels !== undefined) throw Error(p + '.region.pixels: scroll modes only');
      if (r.everyTicks !== undefined) number(r.everyTicks, p + '.region.everyTicks', 1, 600, true);
      if (r.tickMs !== undefined) number(r.tickMs, p + '.region.tickMs', 1, 1000, true);
      boolean(r.wrap, p + '.region.wrap');
      if (r.mode === 'palette-cycle') {
        if (!Array.isArray(r.colors) || r.colors.length < 2 || r.colors.length > 8) throw Error(p + '.region.colors: 2..8 colors required for palette-cycle');
        for (const [ci, c] of r.colors.entries()) color(c, `${p}.region.colors[${ci}]`);
      } else if (r.colors !== undefined) throw Error(p + '.region.colors: palette-cycle only');
      if (r.mode === 'strip') {
        const f = object(r.frames, p + '.region.frames'); fields(f, ['frameWidth', 'frameHeight', 'count', 'fps'], p + '.region.frames');
        for (const k of ['frameWidth', 'frameHeight', 'count']) number(f[k], p + '.region.frames.' + k, 1, 4096, true);
        number(f.fps, p + '.region.frames.fps', 0.5, 60);
      } else if (r.frames !== undefined) throw Error(p + '.region.frames: strip mode only');
    }
    if (l.walk !== undefined) {
      if (l.kind !== 'image' || l.sheet === undefined) throw Error(p + ': walk requires an image layer with a sprite sheet');
      if (l.region !== undefined) throw Error(p + ': walk and region are exclusive');
      const w = object(l.walk, p + '.walk'); fields(w, ['stride', 'frames', 'holdFrame', 'phase'], p + '.walk');
      number(w.stride, p + '.walk.stride', 1, 4096, true);
      const count = Number((l.sheet as { count: number }).count);
      if (!Array.isArray(w.frames) || !w.frames.length || w.frames.length > 16) throw Error(p + '.walk.frames: 1..16 frame indices required');
      for (const [fi, frame] of w.frames.entries()) {
        number(frame, `${p}.walk.frames[${fi}]`, 0, count - 1, true);
      }
      if (w.holdFrame !== undefined) number(w.holdFrame, p + '.walk.holdFrame', 0, count - 1, true);
      if (w.phase !== undefined) number(w.phase, p + '.walk.phase', 0, 1);
    }
  }
  if (a.camera !== undefined) {
    const c = object(a.camera, path + '.camera'); fields(c, ['x', 'y', 'zoom', 'rotation', 'keys', 'shake'], path + '.camera');
    for (const k of ['x', 'y', 'rotation']) if (c[k] !== undefined) number(c[k], path + '.camera.' + k, -20000, 20000);
    if (c.zoom !== undefined) number(c.zoom, path + '.camera.zoom', 0.05, 20);
    validateAnimaticTracks(c.keys, ['x', 'y', 'zoom', 'rotation'], durationMs, path + '.camera.keys');
    if (c.shake !== undefined) {
      const s = object(c.shake, path + '.camera.shake'); fields(s, ['atMs', 'durationMs', 'amplitude', 'frequency', 'seed'], path + '.camera.shake');
      number(s.atMs, path + '.shake.atMs', 0, durationMs, true); number(s.durationMs, path + '.shake.durationMs', 1, durationMs, true);
      if (Number(s.atMs) + Number(s.durationMs) > durationMs) throw Error(path + ': shake exceeds shot');
      number(s.amplitude, path + '.shake.amplitude', 0, 100); if (s.frequency !== undefined) number(s.frequency, path + '.shake.frequency', 1, 60);
      if (s.seed !== undefined) number(s.seed, path + '.shake.seed', 0, 2147483647, true);
    }
  }
  if (a.transition !== undefined) {
    const t = object(a.transition, path + '.transition'); fields(t, ['kind', 'durationMs', 'color'], path + '.transition');
    option(t.kind, ANIMATIC_TRANSITION_KINDS, path + '.transition.kind'); if (!t.kind) throw Error(path + ': transition kind required');
    number(t.durationMs, path + '.transition.durationMs', 0, Math.min(3000, durationMs), true); color(t.color, path + '.transition.color');
  }
  if (a.audioCues !== undefined) {
    if (!Array.isArray(a.audioCues) || a.audioCues.length > ANIMATIC_LIMITS.audioCues) throw Error(path + ': at most32 audio cues');
    const cueIds = new Set<string>();
    for (const raw of a.audioCues) {
      const q = object(raw, path + '.audioCue'); fields(q, ['id', 'resourceId', 'atMs', 'durationMs', 'volume', 'fadeInMs', 'fadeOutMs', 'offsetMs', 'loop'], path + '.audioCue');
      id(q.id, path + '.cue.id'); id(q.resourceId, path + '.cue.resourceId'); if (cueIds.has(String(q.id))) throw Error(path + ': duplicate cue id'); cueIds.add(String(q.id));
      number(q.atMs, path + '.cue.atMs', 0, durationMs, true); number(q.durationMs, path + '.cue.durationMs', 1, durationMs, true);
      if (Number(q.atMs) + Number(q.durationMs) > durationMs) throw Error(path + ': audio cue exceeds shot');
      if (q.volume !== undefined) number(q.volume, path + '.cue.volume', 0, 1);
      for (const k of ['fadeInMs', 'fadeOutMs']) if (q[k] !== undefined) number(q[k], path + '.cue.' + k, 0, Number(q.durationMs), true);
      if (q.offsetMs !== undefined) number(q.offsetMs, path + '.cue.offsetMs', 0, 3600000, true);
      if (q.loop !== undefined && typeof q.loop !== 'boolean') throw Error(path + ': cue.loop must be boolean');
    }
  }
}
export function animaticResourceIds(a: OpeningAnimatic): string[] {
  return [...new Set([...a.layers.flatMap(l => l.kind === 'image' ? [l.resourceId!] : []), ...(a.audioCues ?? []).map(c => c.resourceId)])];
}
/** Caption cue text, which reading-time checks must count like narration. */
export function animaticCaptionText(a: OpeningAnimatic): string[] {
  return a.layers.flatMap(l => l.kind === 'caption' ? (l.caption?.cues ?? []).map(c => c.text) : []);
}
export function sampleAnimaticTrack(keys: AnimaticKey[] | undefined, atMs: number, fallback: number): number {
  if (!keys?.length) return fallback;
  if (atMs <= keys[0].atMs) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i]; if (atMs > b.atMs) continue;
    let t = (atMs - a.atMs) / (b.atMs - a.atMs);
    switch (b.ease ?? 'linear') { case 'step': t = atMs < b.atMs ? 0 : 1; break; case 'ease-in': t *= t; break; case 'ease-out': t = 1 - (1 - t) ** 2; break; case 'ease-in-out': t = t * t * (3 - 2 * t); break; }
    return a.value + (b.value - a.value) * t;
  }
  return keys[keys.length - 1].value;
}
/** Seeded intensity multiplier shared by shafts and glows. Pure function of time. */
export function animaticPulseValue(pulse: AnimaticPulse | undefined, atMs: number, startMs = 0): number {
  if (!pulse) return 1;
  const amount = pulse.amount ?? 0.25, hz = pulse.hz ?? 1;
  if ((pulse.pattern ?? 'pulse') === 'flicker') {
    const step = Math.max(16, Math.round(1000 / (hz * 6))), tick = Math.floor(Math.max(0, atMs - startMs) / step);
    let v = (pulse.seed ?? 1) ^ Math.imul(tick + 1, 0x9e3779b9); v >>>= 0; v ^= v >>> 16; v = Math.imul(v, 0x85ebca6b); v ^= v >>> 13;
    return Math.max(0, 1 - amount * ((v >>> 0) / 4294967296));
  }
  return Math.max(0, 1 + amount * Math.sin((Math.max(0, atMs - startMs) / 1000) * hz * Math.PI * 2));
}
export function animaticCueVolume(c: AnimaticAudioCue, t: number): number {
  const local = t - c.atMs; if (local < 0 || local >= c.durationMs) return 0;
  const fade = Math.min(c.fadeInMs ? local / c.fadeInMs : 1, c.fadeOutMs ? (c.durationMs - local) / c.fadeOutMs : 1, 1);
  return Math.max(0, fade) * (c.volume ?? 1);
}

/** Scale every authored time together. Reject collapsed keys rather than corrupting a shot. */
export function retimeOpeningAnimatic(composition: OpeningAnimatic, fromMs: number, toMs: number): OpeningAnimatic {
  number(toMs, 'durationMs', 1, 120000, true);
  const a = structuredClone(composition), scale = (v: number) => Math.round(v * toMs / fromMs);
  for (const l of a.layers) {
    if (l.startMs !== undefined) l.startMs = scale(l.startMs);
    if (l.endMs !== undefined) l.endMs = scale(l.endMs);
    for (const track of Object.values(l.keys ?? {})) for (const k of track) k.atMs = scale(k.atMs);
    if (l.typography?.typewriterMs !== undefined) l.typography.typewriterMs = scale(l.typography.typewriterMs);
    if (l.caption) {
      for (const cue of l.caption.cues) { cue.atMs = scale(cue.atMs); if (cue.typewriterMs !== undefined) cue.typewriterMs = scale(cue.typewriterMs); }
      if (l.caption.fadeOutMs !== undefined) l.caption.fadeOutMs = scale(l.caption.fadeOutMs);
    }
  }
  for (const track of Object.values(a.camera?.keys ?? {})) for (const k of track) k.atMs = scale(k.atMs);
  if (a.camera?.shake) { a.camera.shake.atMs = scale(a.camera.shake.atMs); a.camera.shake.durationMs = scale(a.camera.shake.durationMs); }
  for (const c of a.audioCues ?? []) for (const key of ['atMs', 'durationMs', 'fadeInMs', 'fadeOutMs'] as const) if (c[key] !== undefined) c[key] = scale(c[key]!);
  if (a.transition) a.transition.durationMs = Math.min(3000, scale(a.transition.durationMs));
  validateOpeningAnimatic(a, toMs); return a;
}
