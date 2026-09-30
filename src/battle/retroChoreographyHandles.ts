// 연출 레코드 손잡이(speed · tint · screen)를 **완성된 타임라인 위에 얹는** 순수 함수.
//
// 손잡이가 하나도 없으면 입력 객체를 그대로 돌려준다 — 기본 연출(계약)은 A1 과 바이트까지 같아야 한다.
// 런타임(src/player/retroSkillChoreography)과 편집기 미리보기(databaseSkillRetroStage)가 같은 함수를 쓴다.
//
// 순서: 화면 효과 추가(원래 시간축) → 레코드 전체 색 채우기 → 속도 배율. 속도는 마지막에 모든 시각·길이를 나눈다.
import type { SkillChoreographyRecord } from "@/project/types/database";
import { retroTintFilter } from "@/assets/retroChoreographyTints";
import { RETRO_SOUND_FLASH, type RetroSkillTimeline, type RetroTimelineEvent } from "@/battle/retroSkillTimeline";

/** 흔들림 길이·번쩍임 길이·어둠 길이(원래 시간축 ms). */
export const HANDLE_SHAKE_MS = 320;
export const HANDLE_FLASH_MS = 260;
export const HANDLE_DIM_MS = 520;
const DIM_LEAD_MS = 160;
const CUTIN_AT = 200;
const CUTIN_MS = 820;

type HandleRecord = Pick<SkillChoreographyRecord, "speed" | "tint" | "screen">;

function speedOf(record: HandleRecord): number {
  const s = record.speed;
  return typeof s === "number" && Number.isFinite(s) && s > 0 && s !== 1 ? s : 1;
}

function hasScreen(record: HandleRecord): boolean {
  const screen = record.screen;
  return Boolean(screen && ((screen.shake ?? 0) > 0 || screen.flash || screen.dim || screen.cutIn));
}

export function hasChoreographyHandles(record: HandleRecord | undefined): boolean {
  if (!record) return false;
  return speedOf(record) !== 1 || Boolean(record.tint && record.tint !== "original") || hasScreen(record);
}

/** 화면 효과를 붙일 기준 시각: 첫 hit → 첫 사용자 아님 fx → 대표 시각. */
function anchorMs(timeline: RetroSkillTimeline): number {
  const hit = timeline.events.find((event) => event.kind === "hit");
  if (hit) return hit.at;
  const fx = timeline.events.find((event) => event.kind === "fx" && event.anchor !== "user");
  return fx ? fx.at : timeline.representativeMs;
}

function scaled(event: RetroTimelineEvent, speed: number): RetroTimelineEvent {
  const at = Math.round(event.at / speed);
  switch (event.kind) {
    case "pose": case "sound": return { ...event, at };
    case "fx": return { ...event, at, frameMs: Math.max(1, Math.round(event.frameMs / speed)) };
    case "projectile": return { ...event, at, durationMs: Math.max(1, Math.round(event.durationMs / speed)), frameMs: Math.max(1, Math.round(event.frameMs / speed)) };
    default: return { ...event, at, durationMs: Math.max(1, Math.round(event.durationMs / speed)) };
  }
}

export function applyChoreographyHandles(timeline: RetroSkillTimeline, record: HandleRecord | undefined): RetroSkillTimeline {
  if (!hasChoreographyHandles(record)) return timeline;
  const rec = record!;
  let events: RetroTimelineEvent[] = [...timeline.events];
  let durationMs = timeline.durationMs;
  const screen = rec.screen;
  if (screen && hasScreen(rec)) {
    const at = anchorMs(timeline);
    if ((screen.shake ?? 0) > 0) { events.push({ kind: "screen", at, durationMs: HANDLE_SHAKE_MS, effect: "shake", intensity: screen.shake }); durationMs = Math.max(durationMs, at + HANDLE_SHAKE_MS); }
    if (screen.flash) { events.push({ kind: "screen", at, durationMs: HANDLE_FLASH_MS, effect: "flash", color: screen.flash }); durationMs = Math.max(durationMs, at + HANDLE_FLASH_MS); }
    if (screen.dim) { const start = Math.max(0, at - DIM_LEAD_MS); events.push({ kind: "screen", at: start, durationMs: HANDLE_DIM_MS, effect: "dim" }); durationMs = Math.max(durationMs, start + HANDLE_DIM_MS); }
    if (screen.cutIn && !events.some((event) => event.kind === "screen" && event.effect === "cutin")) {
      events.push({ kind: "sound", at: 160, id: RETRO_SOUND_FLASH }, { kind: "screen", at: CUTIN_AT, durationMs: CUTIN_MS, effect: "cutin" });
      durationMs = Math.max(durationMs, CUTIN_AT + CUTIN_MS);
    }
  }
  const filter = rec.tint && rec.tint !== "original" ? retroTintFilter(rec.tint) : undefined;
  if (filter) {
    events = events.map((event) => (event.kind === "fx" || event.kind === "projectile") && event.filter === undefined ? { ...event, filter } : event);
  }
  const speed = speedOf(rec);
  let representativeMs = timeline.representativeMs;
  if (speed !== 1) {
    events = events.map((event) => scaled(event, speed));
    durationMs = Math.round(durationMs / speed);
    representativeMs = Math.round(representativeMs / speed);
  }
  events.sort((a, b) => a.at - b.at);
  return { ...timeline, durationMs, representativeMs, events };
}
