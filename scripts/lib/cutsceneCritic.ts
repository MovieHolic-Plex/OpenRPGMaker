// 인게임 컷신을 만든 모델과 다른 계열의 독립 판정자가 «맵 그림 + 핵심 장면 시트 + 객관 측정치»를 보고 합격 여부를 가린다.
// 판정자를 호출하지 못하면 막지 않고 'unjudged' 로 남긴다 — 판정 불가를 합격으로 보고하지 않는다.
import { completeProvider } from './ohMyPiPiAiRuntime.ts';
import { resolveRequestApiKey } from './aiAuthRuntime.ts';
import Jimp from 'jimp';

export type CutsceneCritique = {
  readonly verdict: 'accept' | 'regenerate' | 'unjudged';
  readonly scores: Readonly<Record<string, number>>;
  readonly fix: string;
  readonly judge: string;
};

const JUDGES = [
  { id: 'gemini', provider: 'google-antigravity', model: 'gemini-3.8-flash', effort: 'medium' },
  { id: 'gpt', provider: 'openai-codex', model: 'gpt-6.1-sol', effort: 'medium' },
] as const;

const RUBRIC = `You are a strict director reviewing an in-game opening cutscene for a 2D game, judging ONLY from the evidence given: (1) a render of the real start map, (2) a contact sheet of key frames of the scripted cutscene (pictures drawn over a plain backdrop; built-in pictures may appear as grey boxes), (3) measured numbers from a deterministic probe (visible seconds, size relative to the screen, travel, overlap, tint/weather/sound counts).
Score 0-10: subject (the intended subject is clearly visible and reads as the story's focus), scale (size and spacing fit the screen and the landscape; tiny figures in a big landscape is good, huge overlapping sprites is bad), motion (the probe shows real travel and timing; the sheet shows progression, not one frozen pose), mood (map colour/tint/weather/props match the stated time and feeling — a bright daytime map for a night scene is a failure), staging (map is composed, not a flat empty field; nothing broken like stray placeholder tiles), polish (would a player think this is a considered opening, not a prototype).
Do not reward intent; reward only what the evidence shows. verdict "accept" only if every score >= 6 and total >= 40; otherwise "regenerate" with ONE concrete, actionable fix in "fix" (in Korean, naming the tool/step to change). Reply with JSON only: {"scores":{"subject":0,"scale":0,"motion":0,"mood":0,"staging":0,"polish":0},"verdict":"accept|regenerate","fix":"..."}`;

async function jpeg(dataUrl: string): Promise<string> {
  const image = await Jimp.read(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  if (image.bitmap.width > 960) image.resize(960, Jimp.AUTO);
  return `data:image/jpeg;base64,${(await image.quality(82).getBufferAsync(Jimp.MIME_JPEG)).toString('base64')}`;
}

export async function critiqueCutscene(input: {
  readonly brief: string; readonly probeSummary: string; readonly mapImage?: string; readonly sheetImage?: string; readonly signal?: AbortSignal;
}): Promise<CutsceneCritique> {
  const unjudged = (why: string): CutsceneCritique => ({ verdict: 'unjudged', scores: {}, fix: why, judge: 'none' });
  if (!input.mapImage && !input.sheetImage) return unjudged('판정에 쓸 그림이 없습니다.');
  const parts: Array<Record<string, unknown>> = [{ type: 'text', text: `Requested opening: ${input.brief}\nProbe: ${input.probeSummary}` }];
  if (input.mapImage) parts.push({ type: 'text', text: 'Start map render:' }, { type: 'image_url', image_url: { url: await jpeg(input.mapImage) } });
  if (input.sheetImage) parts.push({ type: 'text', text: 'Cutscene key frames (left to right, top to bottom):' }, { type: 'image_url', image_url: { url: await jpeg(input.sheetImage) } });
  for (const judge of JUDGES) {
    let apiKey: string | undefined;
    try { apiKey = await resolveRequestApiKey(judge.provider) as string | undefined; } catch { apiKey = undefined; }
    if (!apiKey) continue;
    try {
      const { completion } = await completeProvider(judge.provider, {
        model: judge.model, reasoning: { effort: judge.effort },
        messages: [{ role: 'system', content: RUBRIC }, { role: 'user', content: parts }],
      }, { apiKey, signal: input.signal }) as { completion: { choices: Array<{ message: { content?: string } }> } };
      const parsed = JSON.parse((completion.choices[0]?.message.content ?? '').match(/\{[\s\S]*\}/)?.[0] ?? 'null') as { scores?: Record<string, number>; verdict?: string; fix?: string } | null;
      if (!parsed?.scores || typeof parsed.verdict !== 'string') continue;
      const values = Object.values(parsed.scores).map(Number);
      const ok = parsed.verdict === 'accept' && values.every(v => v >= 6) && values.reduce((a, b) => a + b, 0) >= 40;
      return { verdict: ok ? 'accept' : 'regenerate', scores: parsed.scores, fix: String(parsed.fix ?? ''), judge: judge.id };
    } catch (error) { if (input.signal?.aborted) throw error; }
  }
  return unjudged('판정자를 호출하지 못했습니다(연결 없음/응답 형식 오류).');
}
