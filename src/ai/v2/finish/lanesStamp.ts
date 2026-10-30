// 출구·이동 칸 마감의 맵 지문 — 마감 뒤 장소를 다시 지었는지 본다(finish 단계 lanes·lanes-stamp, finishBuildPending).
import type { PiAssistantV2Env } from "../env";
import type { V2Session } from "../verbs";
import type { Project } from "@/project/types";

/**
 * 출구·이동 칸 마감이 본 맵들의 지문 — 맵 크기·타일 층·이벤트 자리. 마감은 한 실행에 한 번이라, 그 뒤 화면 검수 고치기 차례에서
 * 모델이 make_place·edit_place 로 장소를 다시 지으면 새 방은 마감을 못 받는다(2026-10-29 vm6 argon 탈출: 고치기 차례에 밀실을 7×8 로 다시 지어
 * 자물쇠 상자 (3,6)가 철문 (3,7) 앞을 막은 채 출하). 지문이 달라졌으면 마감을 다시 돈다.
 */
export function lanesStamp(project: Project): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => { h = Math.imul(h ^ (n | 0), 0x01000193) >>> 0; };
  const str = (t: string) => { for (let i = 0; i < t.length; i++) mix(t.charCodeAt(i)); };
  for (const id of Object.keys(project.maps).sort()) {
    const map = project.maps[id]!;
    str(id); mix(map.width); mix(map.height);
    for (const [key, value] of Object.entries(map).sort(([a], [b]) => a.localeCompare(b))) {
      if (!/Tiles$/u.test(key) || !Array.isArray(value)) continue;
      str(key);
      for (const t of value as unknown[]) mix(typeof t === "number" ? t : -2);
    }
    for (const ev of map.events ?? []) { str(ev.id); mix(ev.x); mix(ev.y); }
  }
  return h.toString(16);
}
export const LANES_RERUN_CAP = 2;
/** 마감을 돈 뒤 맵이 바뀌었나(다시 돌 횟수가 남았을 때만). */
export const lanesStale = (env: PiAssistantV2Env, session: V2Session) =>
  session.autoLanesDone && session.lanesStamp !== undefined && session.lanesReruns < LANES_RERUN_CAP && session.lanesStamp !== lanesStamp(env.ctx.project);
