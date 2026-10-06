/** Real drawn poses for a confirm-paced portrait. A single horizontal strip. */
export type OpeningPortraitMotion = {
  resourceId: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frames: number[];
  fps: number;
  sceneFrames?: Record<string, number[]>;
};

export function validateOpeningPortraitMotion(value: unknown, sceneIds?: readonly string[]): asserts value is OpeningPortraitMotion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Opening portrait motion must be an object');
  const m = value as Record<string, unknown>;
  if (Object.keys(m).some(k => !['resourceId', 'frameWidth', 'frameHeight', 'frameCount', 'frames', 'fps', 'sceneFrames'].includes(k))) throw Error('Unknown opening portrait motion field');
  if (typeof m.resourceId !== 'string' || !m.resourceId.trim() || m.resourceId.length > 200) throw Error('Invalid opening portrait motion resource');
  for (const key of ['frameWidth', 'frameHeight', 'frameCount'] as const) {
    const maximum = key === 'frameCount' ? 32 : 256, minimum = key === 'frameCount' ? 2 : 1;
    if (!Number.isSafeInteger(m[key]) || Number(m[key]) < minimum || Number(m[key]) > maximum) throw Error(`Invalid portrait motion ${key}`);
  }
  if (typeof m.fps !== 'number' || !Number.isFinite(m.fps) || m.fps < 1 || m.fps > 12) throw Error('Portrait motion fps must be 1..12');
  const frames = (list: unknown): void => {
    if (!Array.isArray(list) || list.length < 1 || list.length > 128 || list.some(f => !Number.isSafeInteger(f) || f < 0 || f >= Number(m.frameCount))) throw Error('Invalid portrait motion frame order');
  };
  frames(m.frames);
  if (m.sceneFrames !== undefined) {
    if (!m.sceneFrames || typeof m.sceneFrames !== 'object' || Array.isArray(m.sceneFrames)) throw Error('Invalid portrait motion scene frames');
    const entries = Object.entries(m.sceneFrames);
    if (entries.length > 64) throw Error('Too many portrait motion scene orders');
    for (const [id, order] of entries) {
      if (!id || id.length > 200 || sceneIds && !sceneIds.includes(id)) throw Error('Unknown portrait motion scene');
      frames(order);
    }
  }
}

/** Unsafe/custom runtime input falls back to the ordinary still portrait. */
export function safeOpeningPortraitMotion(value: unknown, sceneIds?: readonly string[]): OpeningPortraitMotion | undefined {
  try { validateOpeningPortraitMotion(value, sceneIds); return value; } catch { return undefined; }
}
