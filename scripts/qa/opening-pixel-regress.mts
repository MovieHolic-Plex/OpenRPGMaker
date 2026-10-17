// Step-B/C 회귀 프로브 — 이번 수정(2026-10-16)이 실제로 그 입력을 받아들이는지 조사한다.
//   1) list_opening_media 한국어 질의 → 첫 페이지 폴백 + queryMatchedNothing
//   2) prepareOpeningImageRequest 의 빈 문자열 referenceResourceId → 거부하지 않음
//   3) configure_opening_entry new-game + idleMs → 거부하지 않고 버림
//   4) cinematicDirection transition.kind 'dither' → 파서가 받아들임 (렌더러가 이미 지원)
//   5) pixelate(..., extraPalette) → 공유 색을 먼저 쓰고 남은 자리를 채움
import fs from 'node:fs';
import { listDatabaseResourceOptions } from '../../src/editor/resourceOptions.ts';
import { runTool } from '../../src/editor/tools/index.ts';
import { prepareOpeningImageRequest } from '../../src/editor/tools/cinematicTools.ts';
import { parseCinematicDirection } from '../../src/project/cinematicDirection.ts';
import { pixelate } from '../../src/editor/cutsceneArt/imageProcess.ts';
import { measureOpeningAnimatic } from '../../src/project/openingAnimaticMeasure.ts';import type { Project } from '../../src/project/types.ts';
import { generateCinematicStill } from '../../src/editor/openingImageGeneration.ts';
import { ImageGenerationError } from '../../src/ai/imageGenerationClient.ts';
import { PiOpeningProduction, OPENING_PRODUCTION_PROMPT } from '../../src/ai/piAgent/openingProduction.ts';
import { OPENING_STORYBOOK_TOOLS } from '../../src/editor/tools/openingStorybookTools.ts';

const project = JSON.parse(fs.readFileSync('/tmp/opening-run-2/fixture/base-fixed.json', 'utf8')) as Project;
const results: Record<string, unknown> = {};

// 1) 한국어 질의 폴백
const ctx = { project, assistantRun: true } as never;
const korean = runTool(ctx, 'list_opening_media', { kind: 'charset', query: '기사 마을 사람' });
results.koreanCharsetQuery = { ok: korean.ok, summary: korean.summary, count: (korean.data as { matches?: unknown[] }).matches?.length, queryMatchedNothing: (korean.data as { queryMatchedNothing?: boolean }).queryMatchedNothing };
const english = runTool(ctx, 'list_opening_media', { kind: 'charset', query: 'charset' });
results.englishCharsetQuery = { ok: english.ok, count: (english.data as { matches?: unknown[] }).matches?.length };
results.catalogCharsets = listDatabaseResourceOptions('charset', project).length;

// 2) 빈 문자열 optional 참고 그림
try { const brief = prepareOpeningImageRequest({ prompt: '어두운 성당 제단, 사람 없음', referenceResourceIds: [], referenceResourceId: '' }, project); results.emptyReference = { ok: true, refs: brief.referenceResourceIds }; }
catch (error) { results.emptyReference = { ok: false, error: String(error) }; }
try { const brief = prepareOpeningImageRequest({ prompt: 'x'.repeat(8), referenceResourceIds: ['easyrpg-charset-actor1', ''] }, project); results.mixedReference = { ok: true, refs: brief.referenceResourceIds }; }
catch (error) { results.mixedReference = { ok: false, error: String(error) }; }

// 3) new-game + idleMs
const draft = JSON.parse(JSON.stringify(project)) as Project;
draft.system.opening = { enabled: true, skippable: true, scenes: [] } as never;
const entryCtx = { project: draft, assistantRun: true } as never;
const entry = runTool(entryCtx, 'configure_opening_entry', { mode: 'new-game', idleMs: 500 });
results.entryNewGameWithIdle = { ok: entry.ok, summary: entry.summary, entry: (draft.system.opening as { entry?: unknown }).entry };
const entry2 = runTool(entryCtx, 'configure_opening_entry', { mode: 'attract', idleMs: 500 });
results.entryAttractBadIdle = { ok: entry2.ok, summary: entry2.summary };

// 4) direction.transition dither
try { results.directionDither = { ok: true, parsed: parseCinematicDirection({ transition: { kind: 'dither', durationMs: 650 } }) }; }
catch (error) { results.directionDither = { ok: false, error: String(error) }; }

// 5) pixelate 384×216 고정 출력 — 오프닝 모든 그림이 같은 네이티브 격자로 내려간다
const w = 64, h = 36;
const img = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const i = (y * w + x) * 4; img.data[i] = 20 + x * 3; img.data[i + 1] = 40 + y * 5; img.data[i + 2] = 120; img.data[i + 3] = 255; }
const out = pixelate(img, 384, 216, 40);
const colors = new Set<string>();
for (let i = 0; i < out.width * out.height; i += 1) colors.add(`${out.data[i * 4]},${out.data[i * 4 + 1]},${out.data[i * 4 + 2]}`);
results.pixelateFixedGrid = { size: [out.width, out.height], paletteColors: colors.size };

// 6) place_opening_background 가 무대를 정확히 덮고, 검사가 더는 지적하지 않는다
const bgDraft = JSON.parse(JSON.stringify(project)) as Project;
bgDraft.system.opening = { enabled: true, skippable: true, scenes: [{ id: 'bg-shot', kind: 'animatic', durationMs: 6000, narration: '', composition: { width: 384, height: 216, background: '#000000', letterbox: 0.15, pixelGrid: { width: 384, height: 216 }, layers: [] } }] } as never;
const bgCtx = { project: bgDraft, assistantRun: true } as never;
const placed = runTool(bgCtx, 'place_opening_background', { shotId: 'bg-shot', layerId: 'bg', resourceId: 'oprn-still-snow-village' });
// 쓰기 도구는 ctx.project 를 «새 초안» 으로 갈아 끼운다 — 입력 객체가 아니라 ctx 를 다시 읽어야 한다.
const bgAfter = bgCtx.project as Project;
const bgScene = (bgAfter.system.opening as { scenes: { composition: { layers: unknown[] } }[] }).scenes[0]!;
const bgLayer = bgScene.composition.layers[0] as { x: number; y: number; width: number; height: number; anchorX?: number; anchorY?: number } | undefined;
const coverage = measureOpeningAnimatic(bgAfter);
results.placeBackground = { ok: placed.ok, summary: placed.summary, layerCount: bgScene.composition.layers.length, layer: bgLayer ?? null, coverageIssues: coverage.issues.filter((i) => i.includes('무대를 다 덮지')).length };

// 대조군: 같은 배경을 upsert 로 x:0,y:0 으로 놓으면 검사가 지적해야 한다
const badCtx = { project: bgAfter, assistantRun: true } as never;
runTool(badCtx, 'upsert_opening_layer', { shotId: 'bg-shot', layer: { id: 'bg2', kind: 'image', role: 'background', resourceId: 'oprn-still-snow-village', x: 0, y: 0, width: 384, height: 216, sampling: 'nearest' } });
results.upsertQuadrantCaught = measureOpeningAnimatic(badCtx.project).issues.filter((i) => i.includes('무대를 다 덮지')).length;

// 7) backdrop conflicts are scoped to the edited background operation, not every mutation
const scopedDraft = JSON.parse(JSON.stringify(bgAfter)) as Project;
scopedDraft.system.opening!.scenes.push({ id: 'other-shot', kind: 'animatic', durationMs: 6000, narration: '', composition: { width: 384, height: 216, background: '#000000', pixelGrid: { width: 384, height: 216 }, layers: [{ id: 'other-bg', kind: 'image', role: 'background', resourceId: 'oprn-still-snow-village', x: 0, y: 0, width: 384, height: 216, anchorX: 0, anchorY: 0, sampling: 'nearest' }] } } as never);
const scopedCtx = { project: scopedDraft, assistantRun: true } as never;
const unrelatedEdit = runTool(scopedCtx, 'upsert_opening_layer', { shotId: 'bg-shot', layer: { id: 'prop', kind: 'shape', role: 'prop', shape: 'rect', x: 20, y: 20, width: 8, height: 8, color: '#ffffff' } });
const removeConflict = runTool(scopedCtx, 'remove_opening_layer', { shotId: 'other-shot', layerId: 'other-bg' });
results.scopedBackdropConflict = { unrelatedEditOk: unrelatedEdit.ok, removeOffendingBackgroundOk: removeConflict.ok };

// 8) set_opening accepts an existing animatic shot alias and removes stale zero-duration book scenes
const setDraft = JSON.parse(JSON.stringify(bgAfter)) as Project;
const setCtx = { project: setDraft, assistantRun: true } as never;
const setResult = runTool(setCtx, 'set_opening', { enabled: true, skippable: true, scenes: [
  { id: 'bg-shot', kind: 'animatic', durationMs: 6000, composition: { shotId: 'bg-shot' } },
  { id: 'second-shot', kind: 'animatic', durationMs: 6000, composition: { shotId: 'bg-shot' } },
  { id: 'old-book', kind: 'image', durationMs: 0, resourceId: 'oprn-still-snow-village' },
] });
const savedScenes = (setCtx.project as Project).system.opening?.scenes ?? [];
results.animaticSetOpening = { ok: setResult.ok, sceneCount: savedScenes.length, kinds: savedScenes.map(scene => scene.kind), zeroDuration: savedScenes.filter(scene => scene.durationMs === 0).length };

// 9) replacing a shot cannot silently erase layers without clearLayers:true
const replaceCtx = { project: bgAfter, assistantRun: true } as never;
const replacement = runTool(replaceCtx, 'create_opening_animatic_shot', { shotId: 'bg-shot', durationMs: 6000, width: 384, height: 216, replace: true });
results.replaceLayerGuard = { ok: replacement.ok, summary: replacement.summary };

// 10) review gate surfaces missing caption/motion/actor/camera and transition requirements
const gate = measureOpeningAnimatic(bgAfter);
results.reviewGate = { issueCount: gate.issues.length, hasCaptionIssue: gate.issues.some(issue => issue.includes('자막 트랙')), hasMotionIssue: gate.issues.some(issue => issue.includes('실제로 움직이는')), hasCameraIssue: gate.issues.some(issue => issue.includes('카메라 키')) };

const unsafeScroll = runTool({ project: bgAfter, assistantRun: true } as never, 'set_opening_region_loop', { shotId: 'bg-shot', layerId: 'bg', region: { x: 0, y: 0, width: 384, height: 216, mode: 'scroll-x', pixels: 1 } });
results.backgroundScrollGate = { ok: unsafeScroll.ok, blocked: !unsafeScroll.ok && /전체 배경.*scroll/iu.test(unsafeScroll.summary ?? '') };

const effectCtx = { project: bgAfter, assistantRun: true } as never;
const effectResult = runTool(effectCtx, 'upsert_opening_layer', { shotId: 'bg-shot', layer: { id: 'eye_glow', kind: 'image', role: 'effect', resourceId: 'oprn-still-snow-village', x: 40, y: 40, width: 90, height: 90, sheet: { frameWidth: 8, frameHeight: 8, columns: 1, count: 1, fps: 0 }, sampling: 'nearest' } });
results.effectScaleGate = { ok: effectResult.ok, blocked: !effectResult.ok && /효과 스트립.*정수배/iu.test(effectResult.summary ?? '') };

const captionDraft = JSON.parse(JSON.stringify(bgAfter)) as Project;
captionDraft.system.opening!.scenes[0]!.composition.layers.push({ id: 'caption', kind: 'caption', x: 0, y: 0, width: 384, height: 32, typography: { fontSize: 11 }, caption: { cues: [{ atMs: 0, text: 'a', color: '#fff0dc' }, { atMs: 2000, text: 'b', color: '#ff6878' }] } } as never);
const captionMeasure = measureOpeningAnimatic(captionDraft);
results.captionColourGate = { issue: captionMeasure.issues.some(issue => issue.includes('한 샷 안에서 자막 색')) };

const quotaResult = await generateCinematicStill({ prompt: 'empty kingdom backdrop', role: 'backdrop' }, 'opening', {
  project: JSON.parse(fs.readFileSync('/tmp/opening-run-5/fixture/run5.json', 'utf8')) as Project,
  generateImage: async () => { throw new ImageGenerationError('429 QUOTA_EXHAUSTED'); },
});
results.quotaFallback = { ok: quotaResult.ok, summary: quotaResult.ok ? '' : quotaResult.summary, mentionsUnusedCandidate: !quotaResult.ok && /사용하지 않은 전용 그림 후보/iu.test(quotaResult.summary) };
const routeProduction = new PiOpeningProduction(true, '수정이 지키는 왕국의 새로하기 오프닝을 만들어줘');
const direction = OPENING_STORYBOOK_TOOLS[0]!.run(project, {}) as { data?: { recipes?: { style?: string }[] } };
results.pixelAnimaticRoute = {
  requiresPixelAnimatic: routeProduction.requiresPixelAnimatic,
  firstRecipe: direction.data?.recipes?.[0]?.style ?? null,
  promptForcesRoute: /pixel-animatic-opening.*강제|강제.*pixel-animatic-opening/iu.test(OPENING_PRODUCTION_PROMPT),
};

console.log(JSON.stringify(results, null, 1));
