import type { PiAgentRequest } from '../../src/ai/piAgent/protocol';
import type { PiToolCallRecord, PiToolShape } from '../../src/ai/piAgent/toolAdapter';
import { formatPiToolSuccess } from '../../src/ai/piAgent/toolAdapter';
import type { ToolContext, ToolResult } from '../../src/editor/tools/types';
import { TITLE_ART_TOOL } from '../../src/editor/tools/titleArtTools';
import { OPENING_IMAGE_TOOL } from '../../src/editor/tools/cinematicTools';
import { generateTitleArt, titleArtToolCalls } from '../../src/editor/titleArtGeneration';
import { generateOpeningStill } from '../../src/editor/openingImageGeneration';
import { fitTitleArtEffects } from '../../src/editor/titleArtFitting';
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID } from '../../src/ai/imageModelCatalog';
import type { PiOpeningProduction } from '../../src/ai/piAgent/openingProduction';
import type { ActivityVisual } from '../../src/ai/activityVisual';
import { activityThumbnail, generateBestStill } from './openingStillCritic';
import { generateProviderImage } from './ohMyPiImageRuntime';
import { generateCodexImage } from './codexImageRuntime';
import { completeProvider } from './ohMyPiPiAiRuntime';
import type { GenerateAiImageRequest } from '../../src/ai/imageGenerationClient';
import type { Project } from '../../src/project/types';

export const PI_PRESENTATION_GENERATORS = [TITLE_ART_TOOL, OPENING_IMAGE_TOOL] as const;

/** Replace the UI handoff with a real, exclusive authoring tool in the Bun worker. */
export function createPiPresentationTool(
  definition: { name: string; description: string; parameters: unknown },
  ctx: ToolContext,
  request: PiAgentRequest,
  options: {
    apiKey?: string;
    providerApiKeys?: Record<string, string | undefined>;
    readOnlyTools?: boolean;
    apply: (name: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
    onCall: (record: PiToolCallRecord) => void;
    openingProduction?: PiOpeningProduction;
    progress?: (summary: string, toolCallId: string) => void;
    renderToolImage?: (project: Project, toolName: string, data: unknown, signal?: AbortSignal) => Promise<string>;
  },
): PiToolShape {
  const keyFor = (provider: string) => options.providerApiKeys?.[provider] ?? (provider === request.provider ? options.apiKey : undefined);
  return {
    ...definition, label: definition.name, concurrency: 'exclusive',
    description: definition.name === TITLE_ART_TOOL
      ? '작품 타이틀 키아트를 실제 생성하고 그림에 효과를 맞춘 뒤 등록·타이틀 연결까지 수행한다. 성공 응답에는 실제 그림과 resourceId가 있다.'
      : '작품 오프닝의 전체화면 그림을 실제 생성·등록한다. 반환된 resourceId를 set_opening의 image 장면에 연결한다. 성공 응답에는 실제 그림이 있다.',
    async execute(id, params, signal) {
      if (request.readOnly || options.readOnlyTools) throw new Error('읽기 전용 실행에서는 그림을 생성하거나 등록할 수 없습니다.');
      const before = ctx.project;
      const args = params && typeof params === 'object' ? params as Record<string, unknown> : {};
      let result: ToolResult;
      let dataUrl: string;
      let visuals: ActivityVisual[] = [];
      try {
        signal?.throwIfAborted();
        const generateImage = async ({ prompt, signal: imageSignal, referenceImages }: GenerateAiImageRequest) => {
          const provider = request.imageProvider ?? DEFAULT_IMAGE_PROVIDER_ID;
          const model = request.imageModel ?? (provider === DEFAULT_IMAGE_PROVIDER_ID ? DEFAULT_IMAGE_MODEL : 'codex-image-default');
          const payload = { prompt, model, ...(referenceImages ? { referenceImages } : {}) };
          // Codex 는 가끔 그림 대신 글로 답한다 — 같은 요청을 몇 번 더 시도한다(후보 3장이 모두 0장이 되던 실측).
          let image: Awaited<ReturnType<typeof generateCodexImage>> | undefined;
          for (let attempt = 0; !image; attempt++) {
            try {
              image = provider === 'openai-codex'
                ? await generateCodexImage(payload, { apiKey: keyFor(provider), signal: imageSignal })
                : await generateProviderImage(provider, payload, { apiKey: keyFor(provider), signal: imageSignal });
            } catch (error) {
              if (attempt >= 3 || imageSignal?.aborted || !/이미지가 없습니다/u.test(error instanceof Error ? error.message : String(error))) throw error;
            }
          }
          return { dataUrl: `data:${image.mimeType};base64,${image.base64}`, mimeType: image.mimeType, model: image.model, provider: image.provider };
        };
        let resourceId: string;
        const say = (summary: string) => options.progress?.(summary, id);
        if (definition.name === TITLE_ART_TOOL) {
          const count = Math.min(3, Math.max(1, Math.trunc(Number(args.candidates)) || 1));
          const pickingImage: typeof generateImage = count < 2 ? generateImage : async req => {
            say(`타이틀 키아트 후보 ${count}장을 생성하는 중`);
            const best = await generateBestStill(() => generateImage(req).then(img => ({ ok: true as const, ...img })), count,
              { ...(options.openingProduction?.criticContext({ ...args, focus: args.focus ?? 'the key landmark or hero of the title art', captionSide: 'left' }) ?? { prompt: String(args.prompt ?? '') }) }, signal,
              { stage: say, candidate: (cid, url) => { void activityThumbnail(url).then(uploaded => visuals.push({ kind: 'asset', title: `타이틀 후보 ${cid}`, caption: '판정 대기', phase: 'draft', target: `candidate:${id}:${cid}`, uploaded })).catch(() => undefined); } });
            say(`판정 ${best.critique.verdict} — 선택 ${best.critique.winnerId}`);
            if (!best.still.ok) throw new Error('타이틀 후보 생성 실패');
            return best.still;
          };
          const art = await generateTitleArt(args, { signal, generateImage: pickingImage,
            fitEffects: (preset, image, fitSignal, brief) => fitTitleArtEffects(preset, image, { signal: fitSignal, brief,
              chat: async chatRequest => {
                const vision = request.roleModels?.deep ?? { provider: request.provider, model: request.model };
                const response = await completeProvider(vision.provider, { ...chatRequest, model: vision.model }, { apiKey: keyFor(vision.provider), signal: fitSignal });
                return { message: { role: 'assistant' as const, content: response.completion.choices[0].message.content }, finishReason: response.completion.choices[0].finish_reason ?? null };
              },
            }),
          });
          if (!art.ok) throw new Error(art.summary);
          dataUrl = art.dataUrl; resourceId = art.resourceId;
          for (const call of titleArtToolCalls(art)) await options.apply(call.name, call.args, signal);
          result = { ok: true, summary: '타이틀 원화를 생성·등록하고 작품 타이틀에 연결했습니다. 등장 순서·전환은 set_title_screen으로 구성하세요.',
            data: { resourceId, titleScreen: ctx.project.system.titleScreen } };
        } else {
          const withBible = options.openingProduction?.withBible(args) ?? args;
          const count = Math.min(3, Math.max(1, Math.trunc(Number(args.candidates)) || 1));
          const stillOptions = { signal, generateImage,
            hasTransparentPixels: async dataUrl => {
              const { default: Jimp } = await import('jimp');
              const { data } = (await Jimp.read(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'))).bitmap;
              let clear = 0, solid = 0;
              for (let i = 3; i < data.length; i += 4) { if (data[i] < 16) clear++; if (data[i] > 240) solid++; }
              return clear > data.length / 400 && solid > data.length / 400;
            },
            resolveReference: async (resourceId, refSignal) => {
              if (!options.renderToolImage) throw new Error('오프닝 참조 그림을 읽을 경로가 없습니다.');
              const png = await options.renderToolImage(ctx.project, 'show_title_opening', { resourceId }, refSignal);
              return png.startsWith('data:') ? png : `data:image/png;base64,${png}`;
            },
          };
          say(count > 1 ? `오프닝 그림 후보 ${count}장 생성 중 (${String(withBible.angle ?? withBible.focus ?? '').slice(0, 40)})` : '오프닝 그림을 생성하는 중');
          let art: Awaited<ReturnType<typeof generateOpeningStill>>;
          if (count > 1) {
            const best = await generateBestStill(() => generateOpeningStill(withBible, stillOptions), count, options.openingProduction?.criticContext(withBible) ?? { prompt: String(args.prompt ?? '') }, signal,
              { stage: say, candidate: (cid, url) => { void activityThumbnail(url).then(uploaded => visuals.push({ kind: 'asset', title: `후보 ${cid}`, caption: '판정 대기', phase: 'draft', target: `candidate:${id}:${cid}`, uploaded })).catch(() => undefined); } });
            art = best.still;
            say(`판정 ${best.critique.verdict} — 선택 ${best.critique.winnerId} (${best.critique.scores.map(sc => `${sc.id}:${sc.total}`).join(' ')})`);
            if (art.ok) options.openingProduction?.critic(art.resourceId, best.critique.verdict);
          } else art = await generateOpeningStill(withBible, stillOptions);
          if (!art.ok) throw new Error(art.summary);
          dataUrl = art.dataUrl; resourceId = art.resourceId;
          await options.apply('upsert_resource', { resource: { id: resourceId, name: art.name, kind: 'picture', dataUrl } }, signal);
          result = { ok: true, summary: '오프닝 장면 원화를 생성·등록했습니다. resourceId를 set_opening의 image 장면에 연결하세요.', data: { resourceId, name: art.name } };
        }
        signal?.throwIfAborted();
      } catch (error) {
        // Registration + title connection are one operation; failed generations cannot leave orphan assets.
        ctx.project = before;
        result = { ok: false, summary: error instanceof Error ? error.message : String(error) };
        options.onCall({ toolCallId: id, name: definition.name, args, result });
        throw error;
      }
      // Bytes belong only in the project and model image part, never in the text transcript/tool log.
      try { visuals = [...visuals.map(v => ({ ...v, caption: '후보' })), { kind: 'asset', title: String((result.data as { name?: string } | undefined)?.name ?? resourceId), caption: '최종 선택', phase: 'read', target: `resource:${resourceId}`, resourceId, uploaded: await activityThumbnail(dataUrl) }]; } catch { /* thumbnails are best effort */ }
      options.onCall({ toolCallId: id, name: definition.name, args, result, visuals });
      return { details: result, content: [{ type: 'text', text: formatPiToolSuccess(result) },
        { type: 'image', mimeType: dataUrl.slice(5, dataUrl.indexOf(';')), data: dataUrl.slice(dataUrl.indexOf(',') + 1) }] };
    },
  };
}
