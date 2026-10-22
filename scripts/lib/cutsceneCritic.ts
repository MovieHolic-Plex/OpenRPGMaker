// 인게임 컷신을 만든 모델과 다른 계열의 독립 판정자가 «맵 그림 + 핵심 장면 시트 + 객관 측정치»를 보고 합격 여부를 가린다.
// 판정자를 호출하지 못하면 막지 않고 'unjudged' 로 남긴다 — 판정 불가를 합격으로 보고하지 않는다.
import { completeProvider } from './ohMyPiPiAiRuntime.ts';
import { resolveRequestApiKey } from './aiAuthRuntime.ts';
import { jpegDataUrl } from './jpegShrink.ts';

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
FIRST check intent fit against the request: if it asks for figures walking/marching on the real map (or says it is not a picture slideshow), static or sliding sprites without frame animation, or a full-screen illustration hiding the map, cap subject at 3; if it asks for illustration-style cuts, map-less sprites are fine. Do not penalise either style per se — only mismatch with the request. If a motion strip is given, motion is judged from it: identical sprite poses across frames while the position changes (sliding) caps motion at 3; a tint that is absent when the brief asks for night caps mood at 3; sprites overlapping the hero standing in the scene cap staging at 4. IMPORTANT: the cutscene is built from screen-space picture layers drawn over the real map (that is the editor's standard staging method, with real walk-frame swaps) — judge only how it LOOKS in the frames; never criticise the picture-layer technique itself and never recommend map-event move routes, NPC events or editor menus. Your fix must name a visible problem and a change in staging values (position, scale, timing, tint, hero placement, sound), not a different mechanism. If the request names a mood or atmosphere (night, fog, snow, dusk…), never advise weakening or removing it to make the map or sprites easier to see — fix visibility by contrast, placement, scale or sprite brightness instead; a night scene that is simply bright daylight caps mood at 3. Do not reward intent; reward only what the evidence shows. verdict "accept" only if every score >= 6 and total >= 40; otherwise "regenerate" with ONE concrete, actionable fix in "fix" (in Korean, naming the tool/step to change). Reply with JSON only: {"scores":{"subject":0,"scale":0,"motion":0,"mood":0,"staging":0,"polish":0},"verdict":"accept|regenerate","fix":"..."}`;

const jpeg = (dataUrl: string): Promise<string> => jpegDataUrl(dataUrl, 960, 82);

export async function critiqueCutscene(input: {
  readonly brief: string; readonly probeSummary: string; readonly mapImage?: string; readonly sheetImage?: string; readonly motionImage?: string; readonly signal?: AbortSignal;
  /** 전용 판정자(다른 계열) 키·연결이 없을 때 쓰는 이 실행의 보조 대화(방 루프의 독립 비평과 같은 경로). 없으면 판정 불가로 남는다. */
  readonly fallbackChat?: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
}): Promise<CutsceneCritique> {
  const unjudged = (why: string): CutsceneCritique => ({ verdict: 'unjudged', scores: {}, fix: why, judge: 'none' });
  if (!input.mapImage && !input.sheetImage && !input.motionImage) return unjudged('판정에 쓸 그림이 없습니다.');
  const parts: Array<Record<string, unknown>> = [{ type: 'text', text: `Requested opening: ${input.brief}\nProbe: ${input.probeSummary}` }];
  if (input.mapImage) parts.push({ type: 'text', text: 'Start map render:' }, { type: 'image_url', image_url: { url: await jpeg(input.mapImage) } });
  if (input.sheetImage) parts.push({ type: 'text', text: 'Cutscene key frames (left to right, top to bottom):' }, { type: 'image_url', image_url: { url: await jpeg(input.sheetImage) } });
  if (input.motionImage) parts.push({ type: 'text', text: 'Motion strip: 8 consecutive frames 0.35s apart over the real map with the scene tint applied. Judge whether the walkers actually animate (legs/frames change, not a static sprite sliding), whether they overlap the hero or each other, and whether the tint/night mood holds:' }, { type: 'image_url', image_url: { url: await jpeg(input.motionImage) } });
  const judgeReply = (content: string, judge: string): CutsceneCritique | null => {
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? 'null') as { scores?: Record<string, number>; verdict?: string; fix?: string } | null;
    if (!parsed?.scores || typeof parsed.verdict !== 'string') return null;
    const values = Object.values(parsed.scores).map(Number);
    const ok = parsed.verdict === 'accept' && values.every(v => v >= 6) && values.reduce((a, b) => a + b, 0) >= 40;
    return { verdict: ok ? 'accept' : 'regenerate', scores: parsed.scores, fix: String(parsed.fix ?? ''), judge };
  };
  for (const judge of JUDGES) {
    let apiKey: string | undefined;
    try { apiKey = await resolveRequestApiKey(judge.provider) as string | undefined; } catch { apiKey = undefined; }
    if (!apiKey) continue;
    try {
      const { completion } = await completeProvider(judge.provider, {
        model: judge.model, reasoning: { effort: judge.effort },
        messages: [{ role: 'system', content: RUBRIC }, { role: 'user', content: parts }],
      }, { apiKey, signal: input.signal }) as { completion: { choices: Array<{ message: { content?: string } }> } };
      const critique = judgeReply(completion.choices[0]?.message.content ?? '', judge.id);
      if (critique) return critique;
    } catch (error) { if (input.signal?.aborted) throw error; }
  }
  // 전용 판정자가 없는 환경(로컬 CLI 조수 대용 등) — 2026-10-23 실측: 컷신 측정은 통과했는데 판정이 「연결 없음」으로 끝나 매번 미검증이었다.
  // 만든 대화와 섞이지 않는 새 보조 대화로 같은 기준을 묻는다. 판정자 이름은 'session' 으로 남겨 다른 계열 판정과 구분한다.
  if (input.fallbackChat) {
    try {
      const critique = judgeReply(await input.fallbackChat([{ role: 'system', content: RUBRIC }, { role: 'user', content: parts }], input.signal), 'session');
      if (critique) return critique;
    } catch (error) { if (input.signal?.aborted) throw error; }
  }
  return unjudged('판정자를 호출하지 못했습니다(연결 없음/응답 형식 오류).');
}
