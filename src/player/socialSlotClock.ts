// player/socialSlotClock.ts — 호감 대화가 쓴 시간대 한 칸만큼 시계를 민다(project/socialLoop.ts 의 분 계산을 쓴다).
import { advanceTimeAcrossDayBoundaries } from "@/player/dayTransition";
import { resolveSocialLoop, socialSlotMinutes } from "@/project/socialLoop";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

/** 소셜 루프가 켜져 있고 시간 시스템이 있으면 한 칸 분량 시계를 민다(하루 경계는 넘지 않는다). 움직인 분을 돌려준다. */
export function advanceSocialSlotClock(project: Project, session: PlaySession): number {
  const loop = resolveSocialLoop(project);
  if (!loop) return 0;
  const minutes = socialSlotMinutes(project, session, loop);
  if (minutes <= 0) return 0;
  const advanced = advanceTimeAcrossDayBoundaries(project, session, minutes);
  return advanced.ok ? minutes : 0;
}
