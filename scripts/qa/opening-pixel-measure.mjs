// 오프닝 픽셀 애니메틱 객관 측정 — 참조(crimson-oath 캡처)와 같은 축으로 조수 결과를 잰다.
// 정본·네트워크를 쓰지 않는다. 사용: node scripts/qa/opening-pixel-measure.mjs <project.json> [<out.json>]
import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw Error('Usage: opening-pixel-measure.mjs <project.json> [out.json]');
const project = JSON.parse(fs.readFileSync(file, 'utf8'));
const scenes = project.system?.opening?.scenes ?? [];

/** beat 안에서 «동시에 살아 있는 것» 수 — 무대 위에서 실제로 상태가 변하는 레이어만 센다. */
function animatedLayers(composition) {
  return composition.layers.filter((l) => {
    if (l.region) return true;                       // 영역 루프(물·구름·길 무늬·팔레트 순환)
    if (l.walk) return true;                         // 보폭 맞춘 걷기
    if (l.particles) return true;                    // 별·눈·먼지
    if (l.shaft?.dust || l.shaft?.pulse) return true;
    if (l.glow?.pulse) return true;
    if (l.emote) return true;
    if ((l.sheet?.fps ?? 0) > 0) return true;
    const keys = Object.keys(l.keys ?? {}).filter((k) => k !== 'opacity');
    return keys.length > 0;
  }).map((l) => ({ id: l.id, kind: l.kind, what: l.region ? `region:${l.region.mode}` : l.walk ? 'walk' : l.shaft ? `shaft${l.shaft.dust ? '+dust' : ''}` : l.glow ? 'glow' : l.emote ? `emote:${l.emote.preset}` : l.particles ? `particles:${l.particles.preset}` : (l.sheet?.fps ? 'sheet' : Object.keys(l.keys ?? {}).filter(k => k !== 'opacity').join('+')) }));
}

const shots = [];
for (const scene of scenes) {
  if (scene.kind !== 'animatic') { shots.push({ id: scene.id, kind: scene.kind, durationMs: scene.durationMs ?? 0 }); continue; }
  const c = scene.composition;
  const captions = c.layers.filter((l) => l.kind === 'caption').flatMap((l) => (l.caption?.cues ?? []).map((cue) => ({ atMs: cue.atMs, text: cue.text, color: cue.color ?? l.color ?? null, chars: [...cue.text].length, typewriterMs: cue.typewriterMs ?? null, fontSize: l.typography?.fontSize ?? 12 })));
  const textLayers = c.layers.filter((l) => l.kind === 'text').map((l) => ({ id: l.id, chars: [...(l.text ?? '')].length, fontSize: l.typography?.fontSize ?? null }));
  const spriteLayers = c.layers.filter((l) => l.kind === 'image' && l.resourceId).map((l) => {
    const asset = project.assets.uploaded[l.resourceId];
    const frameWidth = l.sheet?.frameWidth ?? (asset?.kind === 'charset' ? 24 : null);
    const ratio = frameWidth ? l.width / frameWidth : null;
    return { id: l.id, resourceId: l.resourceId, assetKind: asset?.kind ?? null, width: l.width, height: l.height, frameWidth, integerMultiple: ratio === null ? null : Math.abs(ratio - Math.round(ratio)) < 0.01, ratio: ratio === null ? null : Number(ratio.toFixed(3)), sampling: l.sampling ?? null };
  });
  shots.push({
    id: scene.id, kind: 'animatic', durationMs: scene.durationMs,
    grid: c.pixelGrid ?? null, letterbox: c.letterbox ?? null, background: c.background ?? null,
    transition: c.transition ?? null, camera: c.camera ? { keys: Object.keys(c.camera.keys ?? {}), shake: !!c.camera.shake } : null,
    layers: c.layers.length, animated: animatedLayers(c), animatedCount: animatedLayers(c).length,
    captions, textLayers, sprites: spriteLayers,
    audioCues: (c.audioCues ?? []).map((a) => ({ id: a.id, atMs: a.atMs, durationMs: a.durationMs })),
    fractionalGeometry: c.layers.filter((l) => (l.kind === 'image' || l.kind === 'shape') && (!Number.isInteger(l.width) || !Number.isInteger(l.height))).map((l) => l.id),
  });
}
const animatics = shots.filter((s) => s.kind === 'animatic');
const totalMs = shots.reduce((n, s) => n + (s.durationMs ?? 0), 0);
const animatedCounts = animatics.map((s) => s.animatedCount);
const textSizes = animatics.flatMap((s) => [...s.captions.map((c) => c.fontSize), ...s.textLayers.map((t) => t.fontSize).filter(Boolean)]);
const measurement = {
  file,
  shotCount: shots.length, animaticShots: animatics.length, stillShots: shots.filter((s) => s.kind === 'image').length, textShots: shots.filter((s) => s.kind === 'text').length, videoShots: shots.filter((s) => s.kind === 'video').length,
  totalMs, totalSeconds: Number((totalMs / 1000).toFixed(1)), averageShotMs: animatics.length ? Math.round(totalMs / shots.length) : 0,
  averageSimultaneousMotion: animatedCounts.length ? Number((animatedCounts.reduce((a, b) => a + b, 0) / animatedCounts.length).toFixed(2)) : 0,
  minSimultaneousMotion: animatedCounts.length ? Math.min(...animatedCounts) : 0,
  gridShots: animatics.filter((s) => s.grid).length, letterboxedShots: animatics.filter((s) => s.letterbox).length,
  transitions: animatics.map((s) => `${s.id}:${s.transition?.kind ?? 'none'}`),
  emoteLayers: animatics.flatMap((s) => s.animated.filter((a) => a.what.startsWith('emote')).map((a) => `${s.id}:${a.what}`)),
  regionLoops: animatics.flatMap((s) => s.animated.filter((a) => a.what.startsWith('region')).map((a) => `${s.id}:${a.what}`)),
  shafts: animatics.flatMap((s) => s.animated.filter((a) => a.what.startsWith('shaft')).map((a) => `${s.id}:${a.what}`)),
  glows: animatics.flatMap((s) => s.animated.filter((a) => a.what.startsWith('glow')).map((a) => `${s.id}:${a.what}`)),
  walks: animatics.flatMap((s) => s.animated.filter((a) => a.what === 'walk').map((a) => `${s.id}:${a.id}`)),
  particleLayers: animatics.flatMap((s) => s.animated.filter((a) => a.what.startsWith('particles')).map((a) => `${s.id}:${a.what}`)),
  captionCues: animatics.reduce((n, s) => n + s.captions.length, 0),
  captionChars: animatics.flatMap((s) => s.captions).map((c) => c.chars),
  captionColors: [...new Set(animatics.flatMap((s) => s.captions.map((c) => c.color)))],
  textSizes,
  spriteScale: animatics.flatMap((s) => s.sprites.map((sp) => ({ shot: s.id, ...sp }))),
  nonIntegerSprites: animatics.flatMap((s) => s.sprites.filter((sp) => sp.integerMultiple === false).map((sp) => `${s.id}:${sp.id} ${sp.frameWidth}px→${sp.width}px (${sp.ratio}x)`)),
  fractionalGeometry: animatics.flatMap((s) => s.fractionalGeometry.map((id) => `${s.id}:${id}`)),
  musicResourceId: project.system?.opening?.musicResourceId ?? null,
  entryMode: project.system?.opening?.entry?.mode ?? 'new-game(default)',
  openingEnabled: project.system?.opening?.enabled ?? false,
  backgroundDifference: project.system?.opening?.scenes?.length ? null : null,
  titleArt: project.system?.titleScreen?.backgroundResourceId ?? null,
  startMapId: project.startMapId,
  shots,
};
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(measurement, null, 1));
const { shots: _omit, ...brief } = measurement;
console.log(JSON.stringify(brief, null, 1));
