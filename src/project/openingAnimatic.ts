/** Authored 2D timeline. Times are shot-local milliseconds, geometry is stage pixels. */
export type AnimaticEase = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step';
export type AnimaticKey = { atMs: number; value: number; ease?: AnimaticEase };
export type AnimaticProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity' | 'frame';
export type AnimaticTracks = Partial<Record<AnimaticProperty, AnimaticKey[]>>;
export type AnimaticLayer = {
  id: string;
  kind: 'image' | 'text' | 'shape' | 'particles';
  role?: 'background' | 'actor' | 'foreground' | 'prop' | 'effect' | 'credit';
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
  crop?: { x: number; y: number; width: number; height: number };
  sheet?: { frameWidth: number; frameHeight: number; columns: number; count: number; fps: number; loop?: boolean };
  typography?: { fontSize?: number; weight?: number; align?: 'left' | 'center' | 'right'; typewriterMs?: number };
  particles?: { preset: 'rain' | 'snow' | 'sparks' | 'dust' | 'stars'; count: number; seed: number; speed?: number; size?: number };
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
  layers: AnimaticLayer[]; camera?: AnimaticCamera; audioCues?: AnimaticAudioCue[];
  transition?: { kind: 'cut' | 'fade' | 'wipe-left' | 'wipe-right' | 'iris' | 'flash'; durationMs: number; color?: string };
};
export const ANIMATIC_LIMITS = { layers: 32, keysPerTrack: 128, audioCues: 32, particles: 200, dimension: 1920 } as const;
export const ANIMATIC_PROPERTIES: AnimaticProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'frame'];
const EASES: AnimaticEase[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'step'];
const COLOR = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgba?|hsla?)\([\d\s.,%+-]+\)|transparent|black|white)$/i;
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
      number(k.value, path + '.value', range[0], range[1], property === 'frame'); option(k.ease, EASES, path + '.ease');
    }
  }
}
/** Strict and additive: unsupported animation fields are errors, never silently discarded. */
export function validateOpeningAnimatic(value: unknown, durationMs: number, path = 'animatic'): asserts value is OpeningAnimatic {
  number(durationMs, path + '.durationMs', 1, 120000, true);
  const a = object(value, path); fields(a, ['width', 'height', 'background', 'letterbox', 'layers', 'camera', 'audioCues', 'transition'], path);
  number(a.width, path + '.width', 64, ANIMATIC_LIMITS.dimension, true); number(a.height, path + '.height', 64, ANIMATIC_LIMITS.dimension, true);
  color(a.background, path + '.background'); if (a.letterbox !== undefined) number(a.letterbox, path + '.letterbox', 0, 0.25);
  if (!Array.isArray(a.layers) || a.layers.length > ANIMATIC_LIMITS.layers) throw Error(`${path}.layers: at most32 layers required`);
  const ids = new Set<string>();
  for (const [i, raw] of a.layers.entries()) {
    const p = `${path}.layers[${i}]`, l = object(raw, p);
    fields(l, ['id', 'kind', 'role', 'resourceId', 'text', 'color', 'shape', 'x', 'y', 'width', 'height', 'anchorX', 'anchorY', 'scaleX', 'scaleY', 'rotation', 'opacity', 'startMs', 'endMs', 'space', 'parallax', 'blend', 'keys', 'crop', 'sheet', 'typography', 'particles'], p);
    id(l.id, p + '.id'); if (ids.has(String(l.id))) throw Error(p + ': duplicate layer id'); ids.add(String(l.id));
    option(l.kind, ['image', 'text', 'shape', 'particles'], p + '.kind'); if (!l.kind) throw Error(p + ': kind required');
    option(l.role, ['background', 'actor', 'foreground', 'prop', 'effect', 'credit'], p + '.role');
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
    if (l.kind === 'image') id(l.resourceId, p + '.resourceId');
    else if (l.resourceId !== undefined || l.crop !== undefined || l.sheet !== undefined) throw Error(p + ': image fields on nonimage layer');
    if (l.kind === 'text') { if (typeof l.text !== 'string' || l.text.length > 4000) throw Error(p + ': text length must be0..4000'); }
    else if (l.text !== undefined || l.typography !== undefined) throw Error(p + ': typography on nontext layer');
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
      if (t.weight !== undefined) number(t.weight, p + '.weight', 100, 900, true);
      option(t.align, ['left', 'center', 'right'], p + '.align'); if (t.typewriterMs !== undefined) number(t.typewriterMs, p + '.typewriterMs', 0, durationMs, true);
    }
    if (l.kind === 'particles') {
      const q = object(l.particles, p + '.particles'); fields(q, ['preset', 'count', 'seed', 'speed', 'size'], p + '.particles');
      option(q.preset, ['rain', 'snow', 'sparks', 'dust', 'stars'], p + '.preset'); if (!q.preset) throw Error(p + ': particle preset required');
      number(q.count, p + '.count', 1, ANIMATIC_LIMITS.particles, true); number(q.seed, p + '.seed', 0, 2147483647, true);
      if (q.speed !== undefined) number(q.speed, p + '.speed', 0, 2000); if (q.size !== undefined) number(q.size, p + '.size', 0.5, 100);
    } else if (l.particles !== undefined) throw Error(p + ': particles on nonparticle layer');
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
    option(t.kind, ['cut', 'fade', 'wipe-left', 'wipe-right', 'iris', 'flash'], path + '.transition.kind'); if (!t.kind) throw Error(path + ': transition kind required');
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
  }
  for (const track of Object.values(a.camera?.keys ?? {})) for (const k of track) k.atMs = scale(k.atMs);
  if (a.camera?.shake) { a.camera.shake.atMs = scale(a.camera.shake.atMs); a.camera.shake.durationMs = scale(a.camera.shake.durationMs); }
  for (const c of a.audioCues ?? []) for (const key of ['atMs', 'durationMs', 'fadeInMs', 'fadeOutMs'] as const) if (c[key] !== undefined) c[key] = scale(c[key]!);
  if (a.transition) a.transition.durationMs = Math.min(3000, scale(a.transition.durationMs));
  validateOpeningAnimatic(a, toMs); return a;
}
