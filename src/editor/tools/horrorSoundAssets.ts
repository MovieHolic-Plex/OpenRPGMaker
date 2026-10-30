// 공포 기본 효과음(심장 고동·발소리 한 걸음)을 프로젝트에 한 번 만들어 다시 쓴다.
// 음원 묶음에 없는 소리라 내장 합성(@/assets/originalSound)으로 굽는다 — generate_original_se 와 같은 자산 모양.
import { musicWavDataUrl } from "@/assets/originalMusic";
import { renderOriginalSound } from "@/assets/originalSound";
import { HORROR_SOUNDS } from "@/ai/v2/horrorSounds";
import { setAudioDescriptionOverride } from "@/project/audioDescriptions";
import type { EventFootsteps, Project } from "@/project/types";
import { ToolError } from "./types";
import { genId } from "@/util/id";

/** key = HORROR_SOUNDS 의 key(heartbeat·step·creak…). 같은 이름의 소리가 있으면 그 id. */
export function ensureHorrorSound(draft: Project, key: string): string {
  const preset = HORROR_SOUNDS.find((sound) => sound.key === key);
  if (!preset) throw new Error(`공포 효과음 '${key}' 이 없습니다.`);
  const have = Object.values(draft.assets.uploaded ?? {}).find((asset) => asset.kind === "sound" && asset.name === preset.name);
  if (have) return have.id;
  const rendered = renderOriginalSound(preset.patch);
  const id = genId("original_se");
  draft.assets.uploaded[id] = { id, kind: "sound", name: preset.name, dataUrl: musicWavDataUrl(rendered.bytes), meta: {}, generatedBy: "original-sound" };
  draft.audioDescriptions = setAudioDescriptionOverride(draft.audioDescriptions, { kind: "sound", resourceId: id }, `${preset.brief}\n공포 기본 패치·내장 합성. ${rendered.durationSeconds.toFixed(2)}초.`);
  return id;
}

const intArg = (value: unknown, lo: number, hi: number, name: string): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new ToolError(`${name} 는 ${lo}..${hi} 입니다.`, { code: "invalid-args" });
  return Math.round(n);
};

/** footsteps 인자 — false(끔) | {se?, everySteps?, radius?, volume?}. se 를 안 주면 빈 문자열(도구가 기본 발소리로 채운다). */
export function readFootstepsArg(raw: unknown): EventFootsteps | false {
  if (raw === false) return false;
  if (raw === true) return { se: '' };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new ToolError('footsteps 는 {se?,everySteps?,radius?,volume?} 또는 false 입니다.', { code: 'invalid-args' });
  const r = raw as Record<string, unknown>;
  const se = r.se === undefined ? '' : typeof r.se === 'string' ? r.se.trim() : undefined;
  if (se === undefined) throw new ToolError('footsteps.se 는 효과음 id 문자열입니다.', { code: 'invalid-args' });
  const every = intArg(r.everySteps, 1, 8, 'footsteps.everySteps');
  const radius = intArg(r.radius, 2, 30, 'footsteps.radius');
  const volume = r.volume === undefined ? undefined : Number(r.volume);
  if (volume !== undefined && (!Number.isFinite(volume) || volume < 0 || volume > 1)) throw new ToolError('footsteps.volume 은 0..1 입니다.', { code: 'invalid-args' });
  return { se, ...(every !== undefined ? { everySteps: every } : {}), ...(radius !== undefined ? { radius } : {}), ...(volume !== undefined ? { volume } : {}) };
}

/** 발소리 se 가 비었으면 공포 기본 구두 발소리를 만들어 채운다. */
export function resolveFootstepsSe(draft: Project, footsteps: EventFootsteps | false | undefined): EventFootsteps | false | undefined {
  if (!footsteps || footsteps.se) return footsteps;
  return { ...footsteps, se: ensureHorrorSound(draft, 'step') };
}
