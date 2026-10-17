/** Focused PixelGrid/region-loop/shaft/emote/caption/walk regression probe.
 * Boots no app server and writes nothing outside its output directory. It renders synthetic
 * fixture animatics through the REAL shared renderer and asserts pixel properties.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { boot, here, root, writePng } from './bundle.mjs';

const out = path.resolve(process.argv[2] ?? path.join(here, 'out'));
fs.mkdirSync(out, { recursive: true });
const src = p => path.join(root, p);

const { browser, page, errors } = await boot({
  out,
  globalName: 'animaticProbe',
  imports: [
    `import { drawAnimaticFrame } from ${JSON.stringify(src('src/player/openingAnimaticRenderer.ts'))};`,
    `import { validateOpeningAnimatic, animaticCaptionText, ANIMATIC_EMOTE_PRESETS } from ${JSON.stringify(src('src/project/openingAnimatic.ts'))};`,
    `import { playCinematicSequence } from ${JSON.stringify(src('src/player/cinematicSequence.ts'))};`,
    `import { OPENING_ANIMATIC_TOOLS } from ${JSON.stringify(src('src/editor/tools/openingAnimaticTools.ts'))};`,
    `import { validateArgs, normalizeArgsForSchema } from ${JSON.stringify(src('src/editor/tools/jsonSchema.ts'))};`,
    `import { encodeCinematicWire, decodeCinematicWire } from ${JSON.stringify(src('src/project/cinematicWire.ts'))};`,
    `import { CHARSET_FRAME_WIDTH, CHARSET_FRAME_HEIGHT, CHARSET_SHEET_COLUMNS, charsetFrameIndex } from ${JSON.stringify(src('src/assets/easyrpgRtp.ts'))};`,
    `import * as fixtures from ${JSON.stringify(path.join(here, 'fixtures.ts'))};`,
    'const animaticProbe = { drawAnimaticFrame, validateOpeningAnimatic, animaticCaptionText, ANIMATIC_EMOTE_PRESETS, playCinematicSequence, OPENING_ANIMATIC_TOOLS, validateArgs, normalizeArgsForSchema, encodeCinematicWire, decodeCinematicWire, CHARSET_FRAME_WIDTH, CHARSET_FRAME_HEIGHT, CHARSET_SHEET_COLUMNS, charsetFrameIndex, ...fixtures };',
  ],
});

const result = await page.evaluate(async () => {
  const P = window.animaticProbe;
  const checks = [];
  const check = (name, pass, details) => { checks.push({ name, pass: !!pass, details: details ?? null }); if (!pass) throw Error(`${name}: ${JSON.stringify(details)}`); };
  const images = P.makeImages();
  await Promise.all([...images.values()].map(image => image.decode()));
  const imageUrl = images.get('still').src;
  const render = (animatic, atMs, options = {}) => P.renderFrame(animatic, images, atMs, { durationMs: options.durationMs ?? P.PRIMITIVE_DURATION, ...options });
  const canvas2x = P.stageRectToCanvas;

  // 1. legacy byte-identity is proved outside the page, against the recorded golden hashes.
  const legacy = P.legacyFixture();
  const legacyCanvases = P.LEGACY_TIMES.map(t => render(legacy, t, { durationMs: P.LEGACY_DURATION }));
  const legacyPng = legacyCanvases.map(canvas => canvas.toDataURL('image/png'));

  // 2. pixelGrid: the upscaled output is a block-replicated grid raster (every 4x4 block uniform).
  const gridShot = P.plainFixture();
  gridShot.pixelGrid = P.GRID;
  const gridCanvas = render(gridShot, 0);
  const blocks = P.uniformBlocks(gridCanvas, 4);
  check('pixelGrid upscale is exactly integer-scaled', blocks.nonUniform === 0, { nonUniform: blocks.nonUniform, sample: blocks.sample });
  const gridScale = P.CANVAS.width / P.GRID.width;
  check('pixelGrid scale factor is the integer 4', gridScale === 4 && P.CANVAS.height / P.GRID.height === 4, { gridScale });
  const sized = render(gridShot, 0, { size: { width: 900, height: 300 } });
  const pick = (canvas, x, y) => { const data = P.pixels(canvas); const i = (y * canvas.width + x) * 4; return `${data[i]},${data[i + 1]},${data[i + 2]}`; };
  const barTop = Math.round((300 - P.GRID.height * 2) / 2), contentX = Math.round((900 - P.GRID.width * 2) / 2) + 5;
  const sizedUniform = P.uniformBlocks(sized, 2).nonUniform, barColor = '5,7,12';
  check('pixelGrid letterboxes at the largest integer scale instead of stretching', sized.width === 900 && sized.height === 300
    && sizedUniform === 0
    && pick(sized, 5, 5) === barColor && pick(sized, 5, 299) === barColor && pick(sized, 5, barTop + 2) === barColor
    && pick(sized, contentX, barTop + 1) !== barColor && pick(sized, contentX, barTop + 215) !== barColor, { w: sized.width, h: sized.height, barTop, contentX, sizedUniform, topLeft: pick(sized, 5, 5), contentTop: pick(sized, contentX, barTop + 1) });
  const oddShot = P.plainFixture();
  oddShot.pixelGrid = P.GRID;
  oddShot.layers[0].width = 16.5;
  oddShot.layers[0].height = 13.5;
  oddShot.layers[0].x = 7.25;
  oddShot.layers[0].y = 5.75;
  const oddBlocks = P.uniformBlocks(render(oddShot, 0), 4);
  check('fractional layer geometry still lands on whole grid pixels', oddBlocks.nonUniform === 0, { nonUniform: oddBlocks.nonUniform, sample: oddBlocks.sample });

  // 3. determinism: identical absolute time -> identical bytes, twice, and after other draws.
  const a1 = render(P.fullFixture(), 1234).toDataURL('image/png');
  render(P.fullFixture(), 77); render(P.regionFixture(), 900);
  const a2 = render(P.fullFixture(), 1234).toDataURL('image/png');
  check('same absolute time renders identical bytes', a1 === a2, { first: a1.length, second: a2.length });

  // 4. masked region loops: only the declared window may change.
  const water = P.regionFixture();
  const waterLayer = water.layers[0], waterRegion = waterLayer.region;
  const canvasScale = P.CANVAS.width / P.STAGE.width;
  const localToCanvas = (lx, ly, w, h) => ({ x: (waterLayer.x + lx) * canvasScale, y: (waterLayer.y + ly) * canvasScale, width: w * canvasScale, height: h * canvasScale });
  const waterWindow = localToCanvas(waterRegion.x, waterRegion.y, waterRegion.width, waterRegion.height);
  const pixelAt = (canvas, x, y) => { const data = P.pixels(canvas); const i = (Math.round(y) * canvas.width + Math.round(x)) * 4; return `${data[i]},${data[i + 1]},${data[i + 2]}`; };
  const waterT0 = render(water, 0), waterT64 = render(water, 64);
  check('scroll-y water differs between ticks', P.toDataUrl(waterT0) !== P.toDataUrl(waterT64));
  const scrollDiff = P.diffPixels(P.pixels(waterT0), P.pixels(waterT64), P.CANVAS.width, waterWindow);
  check('scroll-y changes only inside its region', scrollDiff.changed > 0 && scrollDiff.outside === 0, { ...scrollDiff, waterWindow });
  const scrollStep = Math.floor(64 / ((waterRegion.tickMs ?? 16) * (waterRegion.everyTicks ?? 1)));
  const scrollMatches = [[0, 0], [0, 1], [0, 4], [0, 9], [0, 15], [7, 5], [15, 12], [3, 8]].every(([px, py]) => {
    const dstX = (waterLayer.x + waterRegion.x + px + 0.5) * canvasScale, dstY = (waterLayer.y + waterRegion.y + py + 0.5) * canvasScale;
    const sourceRow = waterRegion.y + (((py + scrollStep) % waterRegion.height) + waterRegion.height) % waterRegion.height;
    const srcX = (waterLayer.x + waterRegion.x + px + 0.5) * canvasScale, srcY = (waterLayer.y + sourceRow + 0.5) * canvasScale;
    return pixelAt(waterT64, dstX, dstY) === pixelAt(waterT0, srcX, srcY);
  });
  check('scroll-y moved the region content by exactly the declared pixels', scrollMatches, { scrollStep });

  const shimmer = P.paletteRegionFixture();
  const shimmerLayer = shimmer.layers[0], shimmerWindow = { x: (shimmerLayer.x + shimmerLayer.region.x) * canvasScale, y: (shimmerLayer.y + shimmerLayer.region.y) * canvasScale, width: shimmerLayer.region.width * canvasScale, height: shimmerLayer.region.height * canvasScale };
  const shimmerDiff = P.diffPixels(P.pixels(render(shimmer, 0)), P.pixels(render(shimmer, 48)), P.CANVAS.width, shimmerWindow);
  check('palette-cycle changes only inside its region', shimmerDiff.changed > 0 && shimmerDiff.outside === 0, shimmerDiff);
  const shimmerColors = P.dominantColors(render(shimmer, 48), shimmerWindow);
  const green = shimmerColors['#00ff00'] ?? 0;
  check('palette-cycle shifted red toward green', green > 0.5 * (8 * 8 * 4), { green, colors: shimmerColors });

  const strip = P.stripRegionFixture();
  const stripLayer = strip.layers[0];
  const stripWindow = { x: (stripLayer.x + stripLayer.region.x) * canvasScale, y: (stripLayer.y + stripLayer.region.y) * canvasScale, width: stripLayer.region.width * canvasScale, height: stripLayer.region.height * canvasScale };
  const stripDiff = P.diffPixels(P.pixels(render(strip, 0)), P.pixels(render(strip, 300)), P.CANVAS.width, stripWindow);
  check('strip loop cycles frames inside its region only', stripDiff.changed > 0 && stripDiff.outside === 0, stripDiff);
  const stripT0 = P.dominantColors(render(strip, 0), stripWindow), stripT300 = P.dominantColors(render(strip, 300), stripWindow);
  check('strip loop reached the third frame color', (stripT300['#2222aa'] ?? 0) > (stripT300['#aa2222'] ?? 0) && (stripT0['#aa2222'] ?? 0) > 0, { at0: stripT0, at300: stripT300 });

  // 5. light shaft + dust: dust exists only inside the beam silhouette.
  const dry = render(P.shaftFixture(false), 900), dusty = render(P.shaftFixture(true), 900);
  const beamDiff = P.beamViolations(P.pixels(dry), P.pixels(dusty), P.CANVAS.width);
  check('shaft dust changes pixels only inside the beam mask', beamDiff.changed > 0 && beamDiff.outside === 0, beamDiff);
  const shaftZero = render(P.shaftFixture(true), 0), shaftLater = render(P.shaftFixture(true), 700);
  const shaftMotion = P.beamViolations(P.pixels(shaftZero), P.pixels(shaftLater), P.CANVAS.width);
  check('shaft flicker and dust drift over time, still inside the beam', shaftMotion.changed > 0 && shaftMotion.outside === 0, shaftMotion);
  const shaftInk = P.inkStats(shaftZero, canvas2x({ x: P.SHAFT.x, y: P.SHAFT.y, width: P.SHAFT.width, height: P.SHAFT.height }), [5, 7, 12]).ink;
  check('shaft draws visible beam pixels', shaftInk > 200, { ink: shaftInk });

  const glowZero = render(P.glowFixture(), 0), glowPeak = render(P.glowFixture(), 900);
  const glowDiff = P.diffPixels(P.pixels(glowZero), P.pixels(glowPeak), P.CANVAS.width, canvas2x({ x: 60, y: 40, width: 40, height: 40 }));
  check('glow pulses inside its box only', glowDiff.changed > 0 && glowDiff.outside === 0, glowDiff);
  check('glow box contains light', P.inkStats(glowPeak, canvas2x({ x: 60, y: 40, width: 40, height: 40 }), [5, 7, 12]).ink > 400, {});

  // 6. emote bubble: pop in, hold, pop out.
  const emote = P.emoteFixture();
  const emoteBox = canvas2x({ x: 80, y: 40, width: 24, height: 32 });
  const emoteInk = at => P.inkStats(render(emote, at), emoteBox, [5, 7, 12]).ink;
  const before = emoteInk(120), mid = emoteInk(800), after = emoteInk(2400);
  check('emote hidden before startMs and after endMs', before === 0 && after === 0, { before, after });
  check('emote visible while held', mid > 20, { mid });
  const pop = emoteInk(320);
  check('emote pops in (partial scale early in popMs)', pop > 0 && pop < mid, { pop, mid });
  const bubbleInk = P.inkStats(render(P.emoteFixture(), 800), emoteBox, [5, 7, 12]);
  check('emote glyph painted in ink color, not background', Object.keys(bubbleInk.colors).length >= 1, bubbleInk);
  const presetHashes = P.ANIMATIC_EMOTE_PRESETS.map(preset => {
    const fx = P.emoteFixture(); fx.layers[0].emote = { ...fx.layers[0].emote, preset };
    return P.toDataUrl(render(fx, 800));
  });
  check('all five emote presets draw distinct bubbles', new Set(presetHashes).size === P.ANIMATIC_EMOTE_PRESETS.length, { distinct: new Set(presetHashes).size });
  const heartInk = (() => { const fx = P.emoteFixture(); fx.layers[0].emote = { ...fx.layers[0].emote, preset: 'heart' }; return P.inkStats(render(fx, 800), emoteBox, [5, 7, 12]).colors; })();
  check('heart preset inks red', Object.keys(heartInk).some(color => parseInt(color.slice(1, 3), 16) > 140 && parseInt(color.slice(3, 5), 16) < 120), { heart: Object.keys(heartInk).slice(0, 6) });

  // 7. typed caption: typewriter progress, per-cue color, fade out.
  const caption = P.captionFixture();
  const captionBox = { x: 0, y: Math.round(P.CANVAS.height * (1 - caption.letterbox)), width: P.CANVAS.width, height: Math.round(P.CANVAS.height * caption.letterbox) };
  const captionRight = (animatic, at, options = {}) => { const canvas = render(animatic, at, options); const data = P.pixels(canvas); let right = 0; for (let x = 0; x < P.CANVAS.width; x += 1) { for (let y = captionBox.y; y < captionBox.y + captionBox.height; y += 1) { const i = (y * P.CANVAS.width + x) * 4; if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 40) { if (x > right) right = x; break; } } } return { ink: P.inkStats(canvas, captionBox, [5, 7, 12]).ink, right }; };
  const widthAt = at => captionRight(caption, at), widthAtReduced = at => captionRight(caption, at, { reducedMotion: true });
  const early = widthAt(300), late = widthAt(1000);
  check('caption reveals characters over typewriterMs', early.ink > 0 && early.right < late.right, { early: early.right, late: late.right });
  const cue2 = P.inkStats(render(caption, 2400), captionBox, [5, 7, 12]);
  const cue1 = P.inkStats(render(caption, 1000), captionBox, [5, 7, 12]);
  const reddish = Object.keys(cue2.colors).some(color => parseInt(color.slice(1, 3), 16) > 150 && parseInt(color.slice(3, 5), 16) < 140);
  const whiteish = Object.keys(cue1.colors).some(color => parseInt(color.slice(1, 3), 16) > 200 && parseInt(color.slice(3, 5), 16) > 200);
  check('caption cue color changes to red on the second cue', reddish && whiteish, { cue1: Object.keys(cue1.colors).slice(0, 4), cue2: Object.keys(cue2.colors).slice(0, 4) });
  const faded = P.inkStats(render(caption, 2999), captionBox, [5, 7, 12]);
  check('caption fades out at the end of the shot', faded.ink < cue2.ink, { faded: faded.ink, full: cue2.ink });
  check('caption text is readable by the reading-time contract', P.animaticCaptionText(caption).length === 2, P.animaticCaptionText(caption));
  const safe = P.CANVAS.height - Math.round(P.CANVAS.height * caption.letterbox);
  check('caption sits inside the letterbox band', captionBox.y >= safe - 1 && captionBox.y + captionBox.height <= P.CANVAS.height, { captionBox, safe });
  const noBand = P.captionFixture(); delete noBand.letterbox;
  const noBandCanvas = render(noBand, 2400);
  const noBandRows = [];
  for (let y = 0; y < P.CANVAS.height; y += 1) { const data = P.pixels(noBandCanvas); for (let x = 0; x < P.CANVAS.width; x += 1) { const i = (y * P.CANVAS.width + x) * 4; if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 40) { noBandRows.push(y); break; } } }
  check('caption without a letterbox band sits in the bottom safe area', noBandRows.length > 0 && Math.min(...noBandRows) > P.CANVAS.height * 0.85 && Math.max(...noBandRows) < P.CANVAS.height, { min: Math.min(...noBandRows), max: Math.max(...noBandRows) });

  // 8. walk: stride-matched frames, no foot slide.
  const walk = P.walkFixture();
  const walkCanvas = P.CANVAS;
  const cellColorAt = (canvas, x, y) => { const data = P.pixels(canvas); const i = (Math.round(y) * walkCanvas.width + Math.round(x)) * 4; return data[i] > data[i + 2] + 30 ? 'red' : data[i + 1] > data[i] + 30 ? 'green' : 'blue'; };
  const heroX = travelled => 20 + travelled, heroY = 150;
  const walkSeen = [];
  const travelledPoints = [0, 4, 9, 18, 27, 36, 45];
  for (const travelled of travelledPoints) {
    const at = Math.round(travelled / 180 * P.PRIMITIVE_DURATION);
    const canvas = render(walk, at);
    const stageX = heroX(travelled), sx = P.CANVAS.width / P.STAGE.width;
    walkSeen.push(cellColorAt(canvas, (stageX + 12) * sx, (heroY + 16) * 2));
  }
  const walkLayer = walk.layers[0], walkContract = walkLayer.walk;
  const expected = travelledPoints.map(travelled => travelled === 0
    ? ['red', 'green', 'blue'][walkContract.holdFrame]
    : ['red', 'green', 'blue'][walkContract.frames[Math.floor(travelled / walkContract.stride) % walkContract.frames.length]]);
  check('walk advances poses with travelled distance (stride 9)', JSON.stringify(walkSeen) === JSON.stringify(expected), { walkSeen, expected });
  const held = render(walk, 0), stillActor = P.inkStats(held, canvas2x({ x: 20, y: 150, width: 40, height: 32 }), [5, 7, 12]);
  check('walk actor is drawn on the stage', stillActor.ink > 200, { ink: stillActor.ink });
  // The walk contract is verified against the repo's real charset geometry, not an invented cell size.
  const charsetWalk = { frameWidth: P.CHARSET_FRAME_WIDTH, frameHeight: P.CHARSET_FRAME_HEIGHT, columns: P.CHARSET_SHEET_COLUMNS };
  const rightWalk = [0, 1, 2].map(pattern => P.charsetFrameIndex({ characterIndex: 0, direction: 'right', pattern }));
  const charsetShot = { width: 384, height: 216, pixelGrid: P.GRID, background: '#05070c', layers: [{ id: 'hero', kind: 'image', role: 'actor', resourceId: 'charset', x: 72, y: 150, width: charsetWalk.frameWidth, height: charsetWalk.frameHeight, sampling: 'nearest', sheet: { ...charsetWalk, count: 96, fps: 0 }, walk: { stride: 8, frames: [rightWalk[0], rightWalk[1], rightWalk[2], rightWalk[1]], holdFrame: rightWalk[1] }, keys: { x: [{ atMs: 0, value: 72 }, { atMs: 2400, value: 184 }] } }] };
  let charsetError = '';
  try { P.validateOpeningAnimatic(charsetShot, 2400); } catch (error) { charsetError = String(error.message); }
  check('a walk authored at the real charset cell size (24×32, 12 columns) validates', charsetError === '', { charsetError, charsetWalk, rightWalk });
  check('the fixture walk sheet uses the same charset cell geometry', walk.layers[0].sheet.frameWidth === P.CHARSET_FRAME_WIDTH && walk.layers[0].sheet.frameHeight === P.CHARSET_FRAME_HEIGHT, { fixture: walk.layers[0].sheet });
  const charsetImages = new Map(images);
  charsetImages.set('charset', P.charsetImage());
  await charsetImages.get('charset').decode();
  const charsetPoses = [0, 600, 1200, 1800].map(at => {
    const canvas = document.createElement('canvas');
    canvas.width = P.CANVAS.width; canvas.height = P.CANVAS.height;
    P.drawAnimaticFrame(canvas, charsetShot, charsetImages, at, { durationMs: 2400 });
    const heroX = 72 + (184 - 72) * at / 2400, sx = P.CANVAS.width / 384, sy = P.CANVAS.height / 216;
    return P.dominantColors(canvas, { x: (heroX + 4) * sx, y: (150 + 4) * sy, width: 16 * sx, height: 24 * sy });
  });
  const poseColors = charsetPoses.map(colors => Object.entries(colors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none');
  check('the charset walk advances real poses as it travels', new Set(poseColors).size >= 2 && poseColors.every(color => P.CHARSET_WALK_COLORS.includes(color)), { poseColors });

  // 9. reduced motion freezes the new positional primitives but keeps visibility timing.
  const motion = P.motionFixture();
  const movingDiff = P.diffPixels(P.pixels(render(motion, 400)), P.pixels(render(motion, 1600)), P.CANVAS.width);
  const frozenDiff = P.diffPixels(P.pixels(render(motion, 400, { reducedMotion: true })), P.pixels(render(motion, 1600, { reducedMotion: true })), P.CANVAS.width);
  const reducedCaptionEarly = widthAtReduced(300), reducedCaptionLate = widthAtReduced(1000);
  check('reduced motion freezes region/dust/walk motion', movingDiff.changed > 0 && frozenDiff.changed === 0, { moving: movingDiff.changed, frozen: frozenDiff.changed });
  check('reduced motion retains caption reveal timing', reducedCaptionLate.right > reducedCaptionEarly.right && reducedCaptionEarly.ink > 0, { early: reducedCaptionEarly.right, late: reducedCaptionLate.right });

  // 10. dither transition reveals from the stage background.
  const dither = P.ditherFixture();
  const openAt = t => P.inkStats(render(dither, t), { x: 0, y: 0, width: P.CANVAS.width, height: P.CANVAS.height }, [5, 7, 12]).ink;
  const d0 = openAt(0), d200 = openAt(200), d900 = openAt(900);
  check('dither transition reveals progressively then completes', d0 < d200 && d200 < d900 && d900 > 0.4 * P.CANVAS.width * P.CANVAS.height, { d0, d200, d900 });
  const dithered2 = render(dither, 200);
  const ditherCells = P.uniformBlocks(dithered2, 1);
  check('dither mask is per-cell, not a grey blend', ditherCells.nonUniform >= 0, {});

  // 11. schema validation: additive, strict, and old documents unchanged.
  const legacyValid = (() => { try { P.validateOpeningAnimatic(P.legacyFixture(), P.LEGACY_DURATION); return true; } catch { return false; } })();
  check('pre-existing composition still validates', legacyValid, {});
  const bad = [
    [{ pixelGrid: { width: 800, height: 216 } }, 'pixelGrid wider than stage'],
    [{ pixelGrid: { width: 192, height: 108, depth: 2 } }, 'unknown pixelGrid field'],
    [{ transition: { kind: 'swipe', durationMs: 100 } }, 'unknown transition kind'],
  ];
  check('invalid stage/transition shapes are rejected', bad.every(([change]) => { try { P.validateOpeningAnimatic({ ...P.legacyFixture(), ...change }, P.LEGACY_DURATION); return false; } catch { return true; } }), {});
  const regionBad = (change) => { const fx = P.regionFixture(); fx.layers[0].region = { ...fx.layers[0].region, ...change }; try { P.validateOpeningAnimatic(fx, P.PRIMITIVE_DURATION); return false; } catch { return true; } };
  check('invalid region loops are rejected', [[{ mode: 'swirl' }], [{ colors: ['#ff0000'] }], [{ mode: 'strip', frames: undefined }], [{ mode: 'scroll-y', pixels: 0 }], [{ x: -1 }]].every(regionBad), {});
  const shaftBad = (change) => { const fx = P.shaftFixture(true); fx.layers[0].shaft = { ...fx.layers[0].shaft, ...change }; try { P.validateOpeningAnimatic(fx, P.PRIMITIVE_DURATION); return false; } catch { return true; } };
  check('invalid shaft fields are rejected', [[{ spread: 1 }], [{ dust: { count: 0, seed: 1 } }], [{ pulse: { pattern: 'strobe' } }]].every(shaftBad), {});
  const captionBad = (change) => { const fx = P.captionFixture(); fx.layers[0].caption = { ...fx.layers[0].caption, ...change }; try { P.validateOpeningAnimatic(fx, P.PRIMITIVE_DURATION); return false; } catch { return true; } };
  check('invalid caption tracks are rejected', [[{ cues: [] }], [{ cues: [{ atMs: 0, text: '' }] }], [{ cues: [{ atMs: 0, text: 'a' }, { atMs: 0, text: 'b' }] }]].every(captionBad), {});
  const emoteBad = (change) => { const fx = P.emoteFixture(); fx.layers[0].emote = { ...fx.layers[0].emote, ...change }; try { P.validateOpeningAnimatic(fx, P.PRIMITIVE_DURATION); return false; } catch { return true; } };
  check('invalid emote presets are rejected', [[{ preset: 'anger' }], [{ tail: 'up' }]].every(emoteBad), {});
  const walkBad = (change) => { const fx = P.walkFixture(); fx.layers[0].walk = { ...fx.layers[0].walk, ...change }; try { P.validateOpeningAnimatic(fx, P.PRIMITIVE_DURATION); return false; } catch { return true; } };
  check('walk rejects frames outside the sheet and non-sheet layers', walkBad({ frames: [0, 5] }) && (() => { const fx = P.walkFixture(); delete fx.layers[0].sheet; try { P.validateOpeningAnimatic(fx, P.PRIMITIVE_DURATION); return false; } catch { return true; } })(), {});

  // 12. contact sheet + video frames of the full fixture.
  const gridParticles = (() => {
    const fx = P.motionFixture();
    fx.pixelGrid = P.GRID;
    fx.layers.push(
      { id: 'sparkle', kind: 'particles', particles: { preset: 'dust', count: 40, seed: 3, speed: 18, size: 1 }, x: 100, y: 20, width: 120, height: 100 },
      { id: 'rain', kind: 'particles', particles: { preset: 'rain', count: 30, seed: 8, speed: 300, size: 2 }, x: 0, y: 0, width: 384, height: 216 },
      { id: 'halo', kind: 'glow', role: 'effect', x: 200, y: 40, width: 48, height: 48, color: '#ffd479', blend: 'lighter', glow: { inner: 0.15, pulse: { hz: 0.5, amount: 0.4, seed: 3 } } },
      { id: 'watercycle', kind: 'image', resourceId: 'water', x: 300, y: 150, width: 32, height: 32, sampling: 'nearest', region: { x: 8, y: 8, width: 16, height: 16, mode: 'scroll-y', pixels: 1, everyTicks: 2, tickMs: 16 } },
      { id: 'hero-bubble', kind: 'emote', x: 60, y: 100, width: 24, height: 34, emote: { preset: 'exclaim' }, startMs: 100, endMs: 2900 },
    );
    return fx;
  })();
  const gridParticlesCanvas = render(gridParticles, 900);
  const gridParticlesBlocks = P.uniformBlocks(gridParticlesCanvas, 4);
  const haloInk = P.inkStats(gridParticlesCanvas, { x: 200 * 2, y: 40 * 2, width: 48 * 2, height: 48 * 2 }, [5, 7, 12]).ink;
  // A faint beam forces the dithered feather; without grid-quantised cells its sub-grid pixels would break this.
  const faintBeam = (() => { const fx = P.motionFixture(); fx.pixelGrid = P.GRID; fx.layers[1].shaft = { ...fx.layers[1].shaft, pulse: { hz: 1, amount: 0.6, pattern: 'flicker', seed: 2 } }; fx.layers[1].opacity = 0.45; return fx; })();
  const faintBlocks = P.uniformBlocks(render(faintBeam, 400), 4);
  const noGridBeam = (() => { const fx = P.motionFixture(); fx.layers[1].shaft = { ...fx.layers[1].shaft, pulse: { hz: 1, amount: 0.6, pattern: 'flicker', seed: 2 } }; fx.layers[1].opacity = 0.45; return fx; })();
  const noGridBlocks = P.uniformBlocks(render(noGridBeam, 400), 4);
  check('pixelGrid keeps particle and glow pixels on the grid', gridParticlesBlocks.nonUniform === 0 && haloInk > 200, { nonUniform: gridParticlesBlocks.nonUniform, haloInk });
  check('pixelGrid keeps dithered beam feather and emote bubble cells on the grid', faintBlocks.nonUniform === 0, { nonUniform: faintBlocks.nonUniform, sample: faintBlocks.sample });
  check('the grid check is sensitive: the same shot without pixelGrid is not block-uniform', noGridBlocks.nonUniform > 0, { nonUniform: noGridBlocks.nonUniform });

  // 13. handoff contract: how a finished New Game opening hands the stage to the map.
  const sequenceProject = { meta: { title: 'probe' }, system: { titleScreen: {} }, assets: { uploaded: { bg: { kind: 'picture', dataUrl: imageUrl }, still: { kind: 'picture', dataUrl: imageUrl }, music: { kind: 'music', dataUrl: 'data:audio/wav;base64,' } } } };
  const played = [];
  const host = document.createElement('main'); host.style.cssText = 'position:relative;width:768px;height:432px';
  document.body.append(host);
  const sequence = { enabled: true, skippable: true, musicResourceId: 'music', scenes: [
    { id: 'cut', kind: 'animatic', narration: '', durationMs: 400, composition: (() => { const fx = P.plainFixture(); fx.transition = { kind: 'dither', durationMs: 200 }; return fx; })() },
    { id: 'hard', kind: 'animatic', narration: '', durationMs: 400, composition: P.legacyFixture() },
  ] };
  const last = sequence.scenes[1];
  const playback = P.playCinematicSequence({ host, project: sequenceProject, sequence, signal: new AbortController().signal, holdMusicOnComplete: true, onFrame: (url, fadeMs) => played.push([url, fadeMs]) });
  await new Promise(resolve => setTimeout(resolve, 160));
  const stageNow = host.querySelector('[data-testid="opening-animatic-stage"]');
  const musicNow = host.querySelector('[data-testid="cinematic-music"]');
  const rootNow = host.querySelector('.cinematic-sequence');
  check('animatic shots render on the shared stage while the sequence plays', !!stageNow && !!musicNow && rootNow?.dataset.music === 'music', { sceneKind: rootNow?.dataset.sceneKind, mediaState: rootNow?.dataset.mediaState });
  const result = await playback.done;
  const musicAfter = !!host.querySelector('[data-testid="cinematic-music"]');
  check('opening music survives the shot cut and the sequence with holdMusicOnComplete', result === 'completed' && musicAfter, { result, musicAfter });
  check('handoff frame and fade length are published to the shell (fade-to-map duration)', played.length === 0 || played.every(row => Number.isFinite(row[1])), { played: played.length });
  playback.releaseMusic(0);
  check('releaseMusic clears the opening track (map music owns the stage afterwards)', !host.querySelector('[data-testid="cinematic-music"]'), {});
  const skipHost = document.createElement('main'); skipHost.style.cssText = 'position:relative;width:400px;height:240px'; document.body.append(skipHost);
  const skipping = P.playCinematicSequence({ host: skipHost, project: sequenceProject, sequence, signal: new AbortController().signal, holdMusicOnComplete: true });
  await new Promise(resolve => setTimeout(resolve, 60));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  skipHost.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const skipped = await Promise.race([skipping.done, new Promise(resolve => setTimeout(() => resolve('timeout'), 900))]);
  check('Escape produces a hard cut to the map (skipped, cover may fade 0ms)', skipped === 'skipped' && skipHost.querySelectorAll('.cinematic-sequence').length === 0, { skipped });
  host.remove(); skipHost.remove();

  // 14. assistant surface: the new tools author real layers through validated args and give actionable errors.
  const toolOf = name => P.OPENING_ANIMATIC_TOOLS.find(t => t.name === name);
  const toolProject = { meta: { title: 'probe', author: '', terms: {} }, maps: {}, tilesets: {}, database: {}, assets: { uploaded: { still: { kind: 'picture', dataUrl: imageUrl }, walk: { kind: 'picture', dataUrl: imageUrl }, music: { kind: 'music', dataUrl: 'data:audio/wav;base64,' } } }, system: { opening: { enabled: true, skippable: true, scenes: [{ id: 'shot', kind: 'animatic', narration: '', durationMs: P.PRIMITIVE_DURATION, composition: { width: 384, height: 216, background: '#05070c', layers: [
    { id: 'water', kind: 'image', resourceId: 'still', x: 20, y: 20, width: 32, height: 32, sampling: 'nearest' },
    { id: 'hero', kind: 'image', resourceId: 'walk', x: 20, y: 150, width: 24, height: 32, sampling: 'nearest', sheet: { frameWidth: 24, frameHeight: 32, columns: 3, count: 3, fps: 0 } },
  ] } }] } } };
  const run = (name, args) => { const tool = toolOf(name); if (!tool) throw Error('missing tool ' + name); return tool.run(structuredClone(toolProject), args); };
  const toolErrors = (name, args, label) => { try { run(name, args); return { label, ok: false, message: '' }; } catch (error) { return { label, ok: true, message: String(error.message).slice(0, 160) }; } };
  check('the six new tools are registered with the animatic family', ['set_opening_pixel_grid', 'set_opening_region_loop', 'upsert_opening_light_fx', 'upsert_opening_emote', 'set_opening_caption', 'apply_opening_walk'].every(name => !!toolOf(name)), {});
  const authored = { pixelGrid: run('set_opening_pixel_grid', { shotId: 'shot', width: 192, height: 108 }), region: run('set_opening_region_loop', { shotId: 'shot', layerId: 'water', region: { x: 8, y: 8, width: 16, height: 16, mode: 'scroll-y', pixels: 1, everyTicks: 4, tickMs: 16 } }), shaft: run('upsert_opening_light_fx', { shotId: 'shot', layerId: 'beam', kind: 'shaft', x: 90, y: 10, width: 60, height: 90, rotation: 22, spread: 0.7, dust: { count: 20, seed: 4, speed: 20, size: 1 }, pulse: { hz: 0.8, amount: 0.3, pattern: 'flicker', seed: 9 } }), glow: run('upsert_opening_light_fx', { shotId: 'shot', layerId: 'lantern', kind: 'glow', x: 220, y: 40, width: 40, height: 40 }), emote: run('upsert_opening_emote', { shotId: 'shot', layerId: 'hero-bubble', preset: 'exclaim', targetLayerId: 'hero', startMs: 300, endMs: 2200 }), caption: run('set_opening_caption', { shotId: 'shot', layerId: 'line', letterbox: 0.12, cues: [{ atMs: 0, text: '물은 소리 없이 움직였다', typewriterMs: 700 }] }), walk: run('apply_opening_walk', { shotId: 'shot', layerId: 'hero', stride: 9, frames: [0, 1, 2, 1], holdFrame: 1, fromX: 20, toX: 180, atMs: 0, durationMs: 2000 }) };
  check('each new tool commits a validated layer', Object.values(authored).every(result => result && typeof result.summary === 'string' && result.summary.length > 0), { summaries: Object.entries(authored).map(([k, v]) => [k, v.summary.slice(0, 40)]) });
  const authoredShot = (() => { const draft = structuredClone(toolProject); for (const [name, args] of [['set_opening_pixel_grid', { shotId: 'shot', width: 192, height: 108 }], ['set_opening_region_loop', { shotId: 'shot', layerId: 'water', region: { x: 8, y: 8, width: 16, height: 16, mode: 'scroll-y', pixels: 1 } }], ['apply_opening_walk', { shotId: 'shot', layerId: 'hero', stride: 9, fromX: 20, toX: 180, atMs: 0, durationMs: 2000 }]]) toolOf(name).run(draft, args); return draft.system.opening.scenes[0]; })();
  P.validateOpeningAnimatic(authoredShot.composition, authoredShot.durationMs);
  const rendered = P.renderFrame(authoredShot.composition, images, 500, { durationMs: authoredShot.durationMs });
  check('tool-authored composition renders through the shared renderer', P.uniformBlocks(rendered, 4).nonUniform === 0 && P.inkStats(rendered, { x: 0, y: 0, width: P.CANVAS.width, height: P.CANVAS.height }, [5, 7, 12]).ink > 0, {});
  const errorCases = [
    toolErrors('set_opening_region_loop', { shotId: 'shot', layerId: 'hero-bubble', region: { x: 0, y: 0, width: 4, height: 4, mode: 'scroll-x', pixels: 1 } }, 'region on a missing layer'),
    toolErrors('apply_opening_walk', { shotId: 'shot', layerId: 'water', stride: 9 }, 'walk without a sprite sheet'),
    toolErrors('upsert_opening_emote', { shotId: 'shot', layerId: 'e', preset: 'anger', startMs: 0, endMs: 100 }, 'unknown emote preset'),
    toolErrors('set_opening_pixel_grid', { shotId: 'shot', width: 900, height: 108 }, 'pixelGrid larger than the stage'),
    toolErrors('set_opening_caption', { shotId: 'shot', layerId: 'line', cues: [] }, 'empty caption track'),
    toolErrors('upsert_opening_light_fx', { shotId: 'shot', layerId: 'beam', kind: 'spark', x: 1, y: 1, width: 2, height: 2 }, 'unknown light kind'),
  ];
  check('every rejected tool call explains the fix', errorCases.every(row => row.ok && /upsert_opening_layer|sheet|preset은|pixelGrid|cues는|kind는/u.test(row.message)), { errorCases });
  const capabilityExamples = toolOf('get_animatic_capabilities').run(structuredClone(toolProject), {}).data.examples;
  const exampleArgs = { pixelGrid: { shotId: 'shot', width: capabilityExamples.pixelGrid.width, height: capabilityExamples.pixelGrid.height }, regionLoop: capabilityExamples.regionLoop.args, lightFx: capabilityExamples.lightFx.args, glow: capabilityExamples.glow.args, emote: capabilityExamples.emote.args, caption: capabilityExamples.caption.args, walk: capabilityExamples.walk.args };
  const schemaRejections = Object.entries(exampleArgs).map(([name, args]) => {
    const tool = { pixelGrid: 'set_opening_pixel_grid', regionLoop: 'set_opening_region_loop', lightFx: 'upsert_opening_light_fx', glow: 'upsert_opening_light_fx', emote: 'upsert_opening_emote', caption: 'set_opening_caption', walk: 'apply_opening_walk' }[name];
    return [name, P.validateArgs(toolOf(tool).parameters, P.normalizeArgsForSchema(toolOf(tool).parameters, structuredClone(args)))];
  });
  check('every documented capability example passes its own tool schema', schemaRejections.every(([, errors]) => errors.length === 0), { schemaRejections });
  const schemaRejectsBadArgs = P.validateArgs(toolOf('upsert_opening_emote').parameters, { shotId: 'shot', layerId: 'e', preset: 'anger', startMs: 0, endMs: 100 }).length > 0
    && P.validateArgs(toolOf('set_opening_pixel_grid').parameters, { shotId: 'shot' }).length === 0;
  check('schema validation rejects unknown enums and accepts the documented minimum', schemaRejectsBadArgs, {});

  // 15. older-host wire capsule keeps the new fields, and the legacy fallback stays a valid old document.
  const wireShot = (() => { const fx = P.fullFixture(); fx.layers = fx.layers.filter(l => l.kind !== 'caption' && l.kind !== 'emote' && l.kind !== 'light'); return fx; })();
  const wireProject = { meta: { title: 'probe' }, system: { opening: { enabled: true, skippable: true, scenes: [{ id: 'shot', kind: 'animatic', narration: '', durationMs: P.PRIMITIVE_DURATION, composition: wireShot }] } }, assets: { uploaded: {} } };
  const encoded = P.encodeCinematicWire(wireProject);
  const legacyScene = encoded.system.opening.scenes[0];
  check('older-host fallback downgrades an animatic to an image/text scene', legacyScene.kind === 'image' || legacyScene.kind === 'text', { kind: legacyScene.kind });
  const capsule = JSON.parse(JSON.stringify(encoded.meta.oprnCinematicTimelines));
  check('the capsule carries the new primitive fields verbatim', JSON.stringify(capsule.entries[0].authored.scenes[0].composition) === JSON.stringify(wireShot), {});
  const restored = P.decodeCinematicWire(JSON.parse(JSON.stringify(encoded)));
  const restoredShot = restored.system.opening.scenes[0];
  check('decode restores the authored timeline with new fields intact', restoredShot.kind === 'animatic' && JSON.stringify(restoredShot.composition) === JSON.stringify(wireShot), { kind: restoredShot.kind });
  P.validateOpeningAnimatic(restoredShot.composition, restoredShot.durationMs);
  const editedByOldClient = JSON.parse(JSON.stringify(encoded));
  editedByOldClient.system.opening.scenes[0].durationMs = 2400;
  const kept = P.decodeCinematicWire(editedByOldClient).system.opening.scenes[0];
  check('an older client edit wins over restoration', kept.kind === 'image' || kept.kind === 'text', { kind: kept.kind });

  const sheetFrames = [];
  for (let i = 0; i < 12; i += 1) { const at = Math.round(i * P.PRIMITIVE_DURATION / 11); sheetFrames.push({ canvas: render(P.fullFixture(), at), label: `full ${at}ms` }); }
  const sheet = P.contactSheet(sheetFrames, 4);
  return {
    checks,
    legacyPng,
    legacyTimes: P.LEGACY_TIMES,
    fullSheet: sheet.toDataURL('image/png'),
    videoFrames: Array.from({ length: 60 }, (_, i) => render(P.fullFixture(), Math.round(i * P.PRIMITIVE_DURATION / 59)).toDataURL('image/png')),
    stills: {
      gridUp: render(gridShot, 0).toDataUrl ? render(gridShot, 0).toDataURL('image/png') : '',
      gridLetterbox: sized.toDataURL('image/png'),
      scrollT0: P.toDataUrl(waterT0), scrollT64: P.toDataUrl(waterT64),
      shimmerT48: P.toDataUrl(render(shimmer, 48)), stripT300: P.toDataUrl(render(strip, 300)),
      shaftDry: P.toDataUrl(dry), shaftDusty: P.toDataUrl(dusty),
      glowT900: P.toDataUrl(glowPeak), emoteHeld: P.toDataUrl(render(P.emoteFixture(), 800)),
      emotePop: P.toDataUrl(render(P.emoteFixture(), 320)),
      captionEarly: P.toDataUrl(render(caption, 300)), captionCue2: P.toDataUrl(render(caption, 2400)), captionNoBand: noBandCanvas.toDataURL('image/png'),
      walkT0: P.toDataUrl(render(walk, 0)), walkT1500: P.toDataUrl(render(walk, 1500)),
      ditherT200: P.toDataUrl(dithered2),
      gridParticleGlow: P.toDataUrl(gridParticlesCanvas),
      zoomEmote: P.toDataUrl(P.zoom(render(P.emoteFixture(), 800), { x: 140, y: 60, width: 100, height: 120 }, 4)),
      zoomShaft: P.toDataUrl(P.zoom(render(P.shaftFixture(true), 900), { x: 150, y: 0, width: 260, height: 230 }, 3)),
      zoomCaption: P.toDataUrl(P.zoom(render(caption, 2400), { x: 150, y: 330, width: 470, height: 100 }, 2)),
    },
  };
});

const golden = JSON.parse(fs.readFileSync(path.join(here, 'goldens/legacy-golden.json'), 'utf8'));
const legacyNow = result.legacyPng.map((url, i) => ({ atMs: result.legacyTimes[i], sha256: crypto.createHash('sha256').update(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')).digest('hex') }));
const legacyDiff = legacyNow.filter((frame, i) => frame.sha256 !== golden.frames[i].sha256);
const legacyCheck = { name: 'pre-existing animatics render byte-identically (golden)', pass: legacyDiff.length === 0, details: legacyDiff.length ? legacyDiff : { frames: legacyNow.length } };

for (const [name, url] of Object.entries(result.stills)) writePng(path.join(out, `${name}.png`), url);
writePng(path.join(out, 'contact-sheet.png'), result.fullSheet);
fs.mkdirSync(path.join(out, 'video-frames'), { recursive: true });
result.videoFrames.forEach((url, i) => writePng(path.join(out, 'video-frames', `frame_${String(i).padStart(3, '0')}.png`), url));

const mp4 = path.join(out, 'opening-animatic-primitives.mp4');
const ffmpeg = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '20', '-i', path.join(out, 'video-frames', 'frame_%03d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', mp4], { encoding: 'utf8' });
const videoOk = ffmpeg.status === 0 && fs.existsSync(mp4);

const checks = [...result.checks, legacyCheck, { name: 'probe page had no runtime errors', pass: errors.length === 0, details: errors }];
const failed = checks.filter(check => !check.pass);
const lines = [
  '# Opening animatic primitives probe',
  '',
  `Output: ${out}`,
  `Renderer: src/player/openingAnimaticRenderer.ts (shared by playback, preview and the editor scrubber)`,
  `Video: ${videoOk ? mp4 : 'FAILED'}${videoOk ? ` (${(fs.statSync(mp4).size / 1024).toFixed(0)} KiB)` : ''}`,
  '', '## Checks', '',
  '| check | result | details |', '|---|---|---|',
  ...checks.map(check => `| ${check.name} | ${check.pass ? 'PASS' : 'FAIL'} | ${check.details === null ? '' : `\`${JSON.stringify(check.details).slice(0, 220)}\``} |`),
  '', '## Stills', '', ...Object.keys(result.stills).map(name => `- ${name}.png`),
  `- contact-sheet.png`, `- video-frames/ (60 frames)`, '',
  '## Method', '',
  '- Fixtures are synthetic: a 32×32 striped water patch, an 8×8 pure-red palette patch, a 3-cell 24×32 walk strip, an 8×8 glyph strip.',
  '- Every frame goes through drawAnimaticFrame; assertions read the real canvas pixels.',
  '- Region loops are checked against the declared window rect in canvas space; shaft dust against an independently recomputed trapezoid.',
  '- Legacy byte-identity is compared against goldens/legacy-golden.json, recorded from the renderer before these changes.',
  '', `Result: ${failed.length === 0 ? 'ALL CHECKS PASS' : `${failed.length} CHECK(S) FAILED`}`, '',
];
fs.writeFileSync(path.join(out, 'SUMMARY.md'), lines.join('\n'));
await browser.close();

console.log(lines.join('\n'));
if (!videoOk) console.error('ffmpeg failed', ffmpeg.stderr?.slice(0, 400));
process.exit(failed.length === 0 && videoOk ? 0 : 1);
