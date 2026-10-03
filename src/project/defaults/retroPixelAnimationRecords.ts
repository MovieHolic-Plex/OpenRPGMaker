import {
  RETRO_PIXEL_FX_FRAME,
  RETRO_PIXEL_FX_FRAMES,
  RETRO_PIXEL_FX_KEYS,
  RETRO_PIXEL_FX_NAMES,
  RETRO_PIXEL_FX_SOUNDS,
  retroPixelAnimationId,
  retroPixelFxResourceId,
  type RetroPixelFxKey,
} from "@/assets/retroPixelAnimations";
import { normalizeBattleAnimationRecord } from "../databaseAnimationRecordModel";
import type { BattleAnimationRecord } from "../types";

/** 도트 측면 전투 전용 도트 효과 기록(anim_px_<key>). 64px 칸 8장을 순서대로 재생한다. */
export function retroPixelAnimationRecord(key: RetroPixelFxKey): BattleAnimationRecord {
  return normalizeBattleAnimationRecord({
    id: retroPixelAnimationId(key),
    name: `도트 ${RETRO_PIXEL_FX_NAMES[key]}`,
    resourceId: retroPixelFxResourceId(key),
    sheet: { frameWidth: RETRO_PIXEL_FX_FRAME, frameHeight: RETRO_PIXEL_FX_FRAME, columns: RETRO_PIXEL_FX_FRAMES },
    scope: "singleTarget",
    position: "center",
    frames: Array.from({ length: RETRO_PIXEL_FX_FRAMES }, (_unused, pattern) => ({
      cells: [{ pattern, x: 0, y: -8, zoom: 100, opacity: 255, visible: true }],
    })),
    timings: [
      { frameIndex: 1, soundResourceId: RETRO_PIXEL_FX_SOUNDS[key] },
      {
        frameIndex: 2,
        flash: { target: "target", color: { red: 255, green: 255, blue: 255, gray: 0 }, durationFrames: 3 },
      },
    ],
  });
}

export function retroPixelAnimationRecords(): BattleAnimationRecord[] {
  return RETRO_PIXEL_FX_KEYS.map(retroPixelAnimationRecord);
}

/**
 * 프로젝트에 anim_px_* 기록이 없을 때(불러오기 수리를 안 타는 내보낸 플레이어·옛 저장본) 쓰는 기본 기록.
 * 저자가 같은 id 를 고쳤으면 프로젝트 기록이 이긴다 — 호출자가 먼저 프로젝트에서 찾는다.
 */
export function bundledRetroPixelAnimation(animationId: string): BattleAnimationRecord | undefined {
  const key = RETRO_PIXEL_FX_KEYS.find((entry) => retroPixelAnimationId(entry) === animationId);
  return key ? retroPixelAnimationRecord(key) : undefined;
}
