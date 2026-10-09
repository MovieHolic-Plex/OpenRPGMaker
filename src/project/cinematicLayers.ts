/** Independent illustrated actors; normalized stage coordinates, never pixels. */
export type CinematicLayerFrame = { at: number; x: number; y: number; scale: number; opacity: number; rotation: number };
export type CinematicLayer = {
  resourceId: string;
  width: number;
  depth: 'background' | 'foreground';
  easing: 'linear' | 'ease-in-out' | 'ease-out';
  frames: CinematicLayerFrame[];
};

/** Strict shared load/tool/editor boundary. at is progress 0..1 within the shot. */
export function parseCinematicLayers(raw: unknown): CinematicLayer[] {
  const record = (value: unknown, fields: string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('레이어는 객체여야 합니다.');
    if (Object.keys(value).some(key => !fields.includes(key))) throw new TypeError('지원하지 않는 레이어 필드입니다.');
    return value as Record<string, unknown>;
  };
  const number = (value: unknown, min: number, max: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new TypeError(`레이어 숫자는 ${min}~${max} 범위여야 합니다.`);
    return value;
  };
  if (!Array.isArray(raw) || raw.length > 4) throw new TypeError('레이어는 최대 4개입니다.');
  return raw.map(value => {
    const layer = record(value, ['resourceId', 'width', 'depth', 'easing', 'frames']);
    if (typeof layer.resourceId !== 'string' || !layer.resourceId.trim()) throw new TypeError('레이어 resourceId가 필요합니다.');
    if (layer.depth !== 'background' && layer.depth !== 'foreground') throw new TypeError('레이어 depth는 background/foreground입니다.');
    if (!['linear', 'ease-in-out', 'ease-out'].includes(String(layer.easing))) throw new TypeError('레이어 easing이 올바르지 않습니다.');
    if (!Array.isArray(layer.frames) || layer.frames.length < 2 || layer.frames.length > 8) throw new TypeError('레이어 frames는 2~8개입니다.');
    const frames = layer.frames.map(frame => {
      const f = record(frame, ['at', 'x', 'y', 'scale', 'opacity', 'rotation']);
      return { at: number(f.at, 0, 1), x: number(f.x, -0.5, 1.5), y: number(f.y, -0.5, 1.5),
        scale: number(f.scale, 0.1, 3), opacity: number(f.opacity, 0, 1), rotation: number(f.rotation, -180, 180) };
    });
    if (frames[0].at !== 0 || frames.at(-1)!.at !== 1 || frames.some((f, i) => i > 0 && f.at <= frames[i - 1].at)) throw new TypeError('레이어 시간은 0에서 1까지 엄격히 증가해야 합니다.');
    return { resourceId: layer.resourceId.trim(), width: number(layer.width, 0.05, 1.5),
      depth: layer.depth, easing: layer.easing as CinematicLayer['easing'], frames };
  });
}
