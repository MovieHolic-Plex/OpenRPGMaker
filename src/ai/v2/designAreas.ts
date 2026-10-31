// 방 설계의 구역 칸(design.areas) — 서로 다른 구역 2~4개, 구역마다 쓰임 한 줄·초점 물건·플레이어가 오갈 이유(게임 내용과 이어서).
//
// 왜(2026-10-30 mapvqa ③, 판정자 gpt-6.1-sol, 사용자 기준 방 assistant-rooms-2 와 쌍 비교): 진 방의 판정자 원문은 「한눈에 소비되는 작은 서재」
// 「조사할 목적지가 없다」, 이긴 쪽은 「철창으로 나뉜 서고와 마법진」「난롯가·카운터·위층 계단」「객실·조리실·저장실을 오가는 구조」였다.
// 처음엔 칸이 비면 make_place·edit_place 가 되돌려 보냈다(agent/fix-venues c863679d62, 미측정). 지금은 되돌려 보내지 않는다 —
// 빌더가 구역과 실제로 놓인 자리를 맵 이름표로 남기고(src/editor/handInterior/designAreaRecord.ts), 할 일 고리의 검사 room_zones
// (todo/checks.ts)가 «구역 수·초점 놓임·닿음·갈 이유·반복»을 맵 데이터로 본다. 함수는 구역을 만들지 않는다.
import type { PlaceSpec } from "./types";

export const AREA_MIN = 2, AREA_MAX = 4;

/** 요청이 정말 작은 방인가(한 구역을 허락) — loop/roomZones.ts 의 SMALL_ROOM_WORDS 와 같은 낱말. */
export function wantsSmallRoom(spec: PlaceSpec, task: string): boolean {
  return spec.size === "small" || /작은\s*방|좁은|조그만|자그마한|단칸|한\s*칸|골방|창고\s*하나|cramped|tiny|small room/iu.test(task);
}
