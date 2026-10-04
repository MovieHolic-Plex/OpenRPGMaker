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
import { generateProviderImage } from './ohMyPiImageRuntime';
import { generateCodexImage } from './codexImageRuntime';
import { completeProvider } from './ohMyPiPiAiRuntime';

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
      try {
        signal?.throwIfAborted();
        const generateImage = async ({ prompt, signal: imageSignal }: { prompt: string; signal?: AbortSignal }) => {
          const provider = request.imageProvider ?? DEFAULT_IMAGE_PROVIDER_ID;
          const model = request.imageModel ?? (provider === DEFAULT_IMAGE_PROVIDER_ID ? DEFAULT_IMAGE_MODEL : 'codex-image-default');
          const payload = { prompt, model };
          const image = provider === 'openai-codex'
            ? await generateCodexImage(payload, { apiKey: keyFor(provider), signal: imageSignal })
            : await generateProviderImage(provider, payload, { apiKey: keyFor(provider), signal: imageSignal });
          return { dataUrl: `data:${image.mimeType};base64,${image.base64}`, mimeType: image.mimeType, model: image.model, provider: image.provider };
        };
        let resourceId: string;
        if (definition.name === TITLE_ART_TOOL) {
          const art = await generateTitleArt(args, { signal, generateImage,
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
          const art = await generateOpeningStill(args, { signal, generateImage });
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
      options.onCall({ toolCallId: id, name: definition.name, args, result });
      return { details: result, content: [{ type: 'text', text: formatPiToolSuccess(result) },
        { type: 'image', mimeType: dataUrl.slice(5, dataUrl.indexOf(';')), data: dataUrl.slice(dataUrl.indexOf(',') + 1) }] };
    },
  };
}
