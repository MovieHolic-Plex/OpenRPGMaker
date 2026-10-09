import bank from './interviewSceneBank.json';
import data from './projectInterviewScenes.json';
import type { GameInterview } from '@/project/gameInterview';
import type { GameDesignAnswers } from '@/project/gameDesignBrief';
import { INTERVIEW_SCENE_CATALOG_SIGNATURE, INTERVIEW_SCENE_SLOTS, INTERVIEW_SCENE_STYLE_VERSION, interviewSceneKey } from './interviewScenePlan';

type BankEntry = { url: string; sha256: string; promptSha256: string };
const entries: Record<string, BankEntry> = bank.scenes;

/**
 * 배경 PNG(1,000장 넘게 약 2.3GB)는 저장소에 넣지 않고 공개 R2 에서 받는다(2026-10-09).
 * 목록(interviewSceneBank.json)은 하네스 build 가 쓰는 /assets 경로 그대로 두고, 읽을 때 CDN 주소로 바꾼다.
 * 올리기·내려받기: scripts/content/sync-interview-scenes.mjs
 */
export const INTERVIEW_SCENE_CDN = 'https://cdn.openrpgmaker.com/interview-scene-bank/';
const LOCAL_PREFIX = '/assets/harnesses/interview-scene-bank/';
export function interviewSceneUrl(url: string): string {
  return url.startsWith(LOCAL_PREFIX) ? INTERVIEW_SCENE_CDN + url.slice(LOCAL_PREFIX.length) : url;
}

export function interviewBankScene(key: string): BankEntry | undefined {
  if (bank.styleVersion !== INTERVIEW_SCENE_STYLE_VERSION || bank.catalogSignature !== INTERVIEW_SCENE_CATALOG_SIGNATURE) return undefined;
  const entry = entries[key];
  return entry && { ...entry, url: interviewSceneUrl(entry.url) };
}

/** Free text and optional custom facts never get a stock image falsely labelled as matching. */
export function fixedInterviewSceneKey(draft: GameInterview, answers: GameDesignAnswers): string | undefined {
  if (draft.secondary || draft.blend || draft.concept.trim() || draft.protagonist.trim() || draft.notes.trim()) return undefined;
  const genre = data.genres.find(g => g.id === draft.genre);
  if (!genre) return undefined;
  const choices: string[] = [];
  let gap = false;
  for (const [index, q] of genre.questions.entries()) {
    const slot = INTERVIEW_SCENE_SLOTS[index]!;
    const answer = answers[slot];
    const id = draft.choiceIds[slot];
    if (!answer && !id) { gap = true; continue; }
    const option = q.options.find(o => o.id === id);
    if (gap || !option || answer?.text !== `${option.label} — ${option.detail}`) return undefined;
    choices.push(option.id);
  }
  return interviewSceneKey(draft.genre, choices);
}

/** Predict actual next clicks, including revisiting an earlier answer with later answers kept. */
export function nextInterviewBankKeys(draft: GameInterview, answers: GameDesignAnswers, questionId?: string): string[] {
  const key = fixedInterviewSceneKey(draft, answers);
  if (!key) return [];
  const genre = data.genres.find(g => g.id === draft.genre)!;
  const next = questionId ? genre.questions.findIndex(q => q.id === questionId) : key.split('--').length - 1;
  const question = genre.questions[next];
  if (!question) return [];
  const slot = INTERVIEW_SCENE_SLOTS[next]!;
  return question.options.map(option => fixedInterviewSceneKey({ ...draft, choiceIds: { ...draft.choiceIds, [slot]: option.id } }, {
    ...answers, [slot]: { question: question.title, label: question.label, text: `${option.label} — ${option.detail}`, source: 'user' },
  })).filter((k): k is string => !!k);
}

/** Per-dialog bounded decoded image cache; no eager download of the entire scene bank. */
export class InterviewSceneCache {
  private readonly images = new Map<string, { image: HTMLImageElement; ready: boolean; pending: Promise<HTMLImageElement> }>();
  private disposed = false;
  ready(key: string): HTMLImageElement | undefined {
    const cached = this.images.get(key);
    return cached?.ready ? cached.image : undefined;
  }
  load(key: string): Promise<HTMLImageElement> | undefined {
    if (this.disposed) return undefined;
    const entry = interviewBankScene(key);
    if (!entry) return undefined;
    const cached = this.images.get(key);
    if (cached) return cached.pending;
    const image = new Image(); image.decoding = 'async'; image.src = entry.url;
    const item = { image, ready: false, pending: Promise.resolve(image) };
    item.pending = image.decode().then(() => { if (!this.disposed) item.ready = true; return image; }).catch(error => {
      if (this.images.get(key) === item) this.images.delete(key);
      throw error;
    });
    this.images.set(key, item);
    return item.pending;
  }
  preload(keys: string[]): void {
    if (this.disposed) return;
    const keep = new Set(keys.slice(0, 5));
    for (const [key, item] of this.images) if (!keep.has(key)) { item.image.removeAttribute('src'); this.images.delete(key); }
    for (const key of keep) void this.load(key)?.catch(() => { /* A missing file falls back at the selected scene only. */ });
  }
  dispose(): void {
    this.disposed = true;
    for (const item of this.images.values()) item.image.removeAttribute('src');
    this.images.clear();
  }
}
