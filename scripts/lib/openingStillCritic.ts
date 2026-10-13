// 오프닝 그림 후보를 독립 판정자가 비교해 하나를 고른다. 생성 모델(ChatGPT)과 다른 계열의 판정자를 먼저 쓴다.
// 모델 호출이 실패하면 막지 않고 첫 후보로 진행하되 verdict 를 'unjudged' 로 남긴다 — 판정 불가를 합격으로 보고하지 않는다.
import { jpegDataUrl } from './jpegShrink.ts';
import { completeProvider } from './ohMyPiPiAiRuntime.ts';
import { resolveRequestApiKey } from './aiAuthRuntime.ts';

export type StillCandidate = { readonly id: string; readonly dataUrl: string };
export type StillContext = {
  readonly prompt: string; readonly focus?: string; readonly cast?: string; readonly angle?: string; readonly light?: string;
  readonly palette?: string; readonly artStyle?: string; readonly captionSide?: string;
  readonly motifs?: readonly string[]; readonly previousAngles?: readonly string[];
};
export type StillScore = { readonly id: string; readonly focal: number; readonly story: number; readonly cast: number; readonly composition: number; readonly light: number; readonly style: number; readonly slop: number; readonly defects: number; readonly total: number; readonly notes: string };
export type StillCritique = {
  readonly verdict: 'accept' | 'regenerate' | 'unjudged'; readonly winnerId: string; readonly scores: readonly StillScore[];
  readonly fix: string; readonly judge: string;
};

const JUDGES = [
  { id: 'gemini', provider: 'google-antigravity', model: 'gemini-3.8-flash', effort: 'medium' },
  { id: 'gpt', provider: 'openai-codex', model: 'gpt-6.1-sol', effort: 'medium' },
] as const;

const RUBRIC = `You are a strict art director judging candidate stills for the opening of a 2D game. Judge only what is visible. Be harsh: a pretty but generic image is a failure.
Score every candidate 0-10 on: focal (the eye lands on ONE intended subject, the rest is subordinate), story (it shows the story moment and its visible consequence, not just a nice place), cast (ONLY the allowed people/creatures appear; any extra figure, silhouette or crowd scores 0-2), composition (deliberate vantage, off-centre focal point, leading lines, differs from the previous shots' angles; a centred symmetric postcard scores <=4), light (a motivated key light, clear value hierarchy, follows the palette), style (matches the requested art style technique, consistent drawing language), slop (10 = no generic AI-wallpaper signs; deduct for floating motes/orbs, default teal-orange grade, every object lit equally, crowded props, plastic gradients, invented landmarks not in the brief), defects (10 = none; deduct for anatomy errors, text/letters, artifacts, cropped subject).
total = focal+story+cast+composition+light+style+slop+defects (max 80). Choose the winner by total, but a candidate with cast<=2 or defects<=3 cannot win if another candidate does not have that fault.
verdict: "accept" if the winner has total>=56 and no sub-score below 5; otherwise "regenerate" and give ONE concrete, visual prompt fix in "fix" (what to add or forbid, in English).
Reply with JSON only: {"scores":[{"id":"...","focal":0,"story":0,"cast":0,"composition":0,"light":0,"style":0,"slop":0,"defects":0,"total":0,"notes":"one short sentence"}],"winnerId":"...","verdict":"accept|regenerate","fix":"..."}`;

/** Small JPEG for the activity feed (the tool_end visual cap is 1MB per image). */
export const activityThumbnail = (dataUrl: string): Promise<string> => jpegDataUrl(dataUrl, 640, 70);

const shrink = (dataUrl: string): Promise<string> => jpegDataUrl(dataUrl, 960, 82);

export async function critiqueOpeningStills(candidates: readonly StillCandidate[], context: StillContext, signal?: AbortSignal): Promise<StillCritique> {
  const unjudged = (why: string): StillCritique => ({ verdict: 'unjudged', winnerId: candidates[0]!.id, scores: [], fix: why, judge: 'none' });
  if (candidates.length === 1) return unjudged('후보가 하나라 비교하지 않았습니다.');
  const brief = [
    `Story moment: ${context.prompt}`, `Intended focal point: ${context.focus ?? '(not specified)'}`, `Allowed cast: ${context.cast ?? 'only what the story moment names'}`,
    `Requested angle: ${context.angle ?? '(not specified)'}`, `Previous shots' angles: ${(context.previousAngles ?? []).join(' | ') || '(none)'}`,
    `Light: ${context.light ?? '(not specified)'}`, `Palette: ${context.palette ?? '(not specified)'}`, `Art style: ${context.artStyle ?? '(not specified)'}`,
    `Motifs that should recur: ${(context.motifs ?? []).join(' | ') || '(none)'}`, `Caption area: ${context.captionSide ?? 'bottom'} should be naturally quiet`,
  ].join('\n');
  const images = await Promise.all(candidates.map(async c => ({ id: c.id, url: await shrink(c.dataUrl) })));
  for (const judge of JUDGES) {
    let apiKey: string | undefined;
    try { apiKey = await resolveRequestApiKey(judge.provider) as string | undefined; } catch { apiKey = undefined; }
    if (!apiKey) continue;
    try {
      const { completion } = await completeProvider(judge.provider, {
        model: judge.model, reasoning: { effort: judge.effort },
        messages: [{ role: 'system', content: RUBRIC }, { role: 'user', content: [
          { type: 'text', text: brief + `\nCandidate ids in order: ${images.map(i => i.id).join(', ')}` },
          ...images.flatMap(i => [{ type: 'text', text: `Candidate ${i.id}:` }, { type: 'image_url', image_url: { url: i.url } }]),
        ] }],
      }, { apiKey, signal }) as { completion: { choices: Array<{ message: { content?: string } }> } };
      const text = completion.choices[0]?.message.content ?? '';
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? 'null') as { scores?: StillScore[]; winnerId?: string; verdict?: string; fix?: string } | null;
      if (!parsed?.scores?.length || !candidates.some(c => c.id === parsed.winnerId)) continue;
      return { verdict: parsed.verdict === 'accept' ? 'accept' : 'regenerate', winnerId: parsed.winnerId!, scores: parsed.scores, fix: String(parsed.fix ?? ''), judge: judge.id };
    } catch (error) { if (signal?.aborted) throw error; }
  }
  return unjudged('판정자를 호출하지 못했습니다(연결 없음/응답 형식 오류).');
}

/** n 장을 병렬로 만들고 판정자가 고른 한 장과 판정을 돌려준다. 실패한 후보는 건너뛰며 하나도 없으면 첫 오류를 그대로 던진다. */
export async function generateBestStill<T extends { readonly ok: boolean; readonly dataUrl?: string }>(
  generate: () => Promise<T>, count: number, context: StillContext, signal?: AbortSignal,
  hooks?: { readonly stage?: (summary: string) => void; readonly candidate?: (id: string, dataUrl: string) => void },
): Promise<{ readonly still: T; readonly critique: StillCritique; readonly candidates: readonly { id: string; still: T }[] }> {
  const results = await Promise.all(Array.from({ length: count }, (_, i) => generate().then(still => ({ id: String.fromCharCode(65 + i), still })).catch(error => ({ id: String.fromCharCode(65 + i), error }))));
  hooks?.stage?.(`후보 ${results.length}장 중 ${results.filter(r => 'still' in r && r.still.ok).length}장 생성 완료`);
  const ok = results.filter((r): r is { id: string; still: T } => 'still' in r && r.still.ok && !!r.still.dataUrl);
  if (!ok.length) { const first = results[0]!; if ('still' in first) return { still: first.still, critique: { verdict: 'unjudged', winnerId: first.id, scores: [], fix: '모든 후보 생성 실패', judge: 'none' }, candidates: [] }; throw first.error; }
  for (const r of ok) hooks?.candidate?.(r.id, r.still.dataUrl!);
  hooks?.stage?.('독립 판정자가 후보를 비교하는 중');
  const critique = await critiqueOpeningStills(ok.map(r => ({ id: r.id, dataUrl: r.still.dataUrl! })), context, signal);
  return { still: ok.find(r => r.id === critique.winnerId)!.still, critique, candidates: ok };
}
