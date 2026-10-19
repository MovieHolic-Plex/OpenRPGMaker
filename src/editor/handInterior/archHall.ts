// 건축 복도(복도 방 `arch-hall`) - 2026-10-20 R19 사용자 「'방' 의 모양이 ㅁ자가 아닐 수도 있고, 복도가 있을 수도 있고 .. 현실적인 구조를 갖게 해라」.
// 학교·병원·관공서·호텔처럼 방이 줄지은 시설은 줄과 줄 사이에 가로 복도(벽면 2줄 + 바닥 4줄)가 한 칸 칸막이를 두고 건물 너비로 깔린다 -
// 위 줄 방도 아래 줄 방도 이 복도에서 문으로 든다(방을 지나 다른 방으로 가지 않는다). 복도 방은 견본이 없어 여기서 벽·걸이·벤치를 직접 정한다.
import type { InteriorTemplateItem } from "./templates";

export const HALL_KIND = "arch-hall";
/** 복도 높이(벽면 2줄 + 바닥 4줄). */
export const HALL_H = 6;

export type HallDress = "school" | "hospital" | "office" | "hotel" | "public";

interface DressSet { readonly floor: string; readonly wall: string; readonly north: readonly string[]; readonly hang: readonly string[]; readonly south: readonly string[] }
export const HALL_DRESS: Readonly<Record<HallDress, DressSet>> = {
  school: { floor: "mci-tile-concourse", wall: "mci-wall-lobby", north: ["school-cleaning-locker", "school-cleaning-locker", "school-cleaning-locker", "office-water-cooler"], hang: ["mci-notice-board", "mci-wall-clock", "mci-art-frame", "mci-notice-board"], south: ["mci-bench-metal", "mci-plant-tall"] },
  hospital: { floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", north: ["hospital-water-dispenser", "hospital-med-cabinet", "hospital-water-dispenser"], hang: ["mci-wall-clock", "mci-route-map", "mci-notice-board"], south: ["mci-wait-bench", "mci-plant-tall", "mci-wait-bench"] },
  office: { floor: "mci-carpet-office", wall: "mci-wall-office", north: ["mci-mailboxes", "office-water-cooler", "mci-mailboxes"], hang: ["mci-art-frame", "mci-wall-clock", "mci-notice-board"], south: ["mci-bench-metal", "mci-plant-tall"] },
  hotel: { floor: "mci-carpet-office", wall: "mci-wall-lobby", north: ["mci-mailboxes", "office-water-cooler"], hang: ["mci-art-frame", "mci-art-frame", "mci-wall-clock"], south: ["mci-plant-tall", "mci-bench-metal"] },
  public: { floor: "mci-stone-lobby", wall: "mci-wall-lobby", north: ["mci-mailboxes", "office-water-cooler", "mci-mailboxes"], hang: ["mci-notice-board", "mci-wall-clock", "mci-route-map"], south: ["mci-wait-bench", "mci-plant-tall"] },
};

/** 복도 방의 벽 가구·걸이·벤치 후보(절대 좌표) - 문 앞·겹침은 furnishRooms 가 거르고 옆으로 비킨다. */
export function hallItems(room: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }, dress: HallDress, size: (id: string) => number): InteriorTemplateItem[] {
  const set = HALL_DRESS[dress];
  const w = room.x1 - room.x0 + 1;
  const out: InteriorTemplateItem[] = [];
  const lay = (ids: readonly string[], y: number, pitch: number, start: number) => {
    let x = room.x0 + start, i = 0;
    while (x + 1 <= room.x1 - 1) {
      const id = ids[i % ids.length]!;
      const iw = Math.max(1, size(id));
      if (x + iw > room.x1) break;
      out.push({ t: "o", id, x, y });
      x += pitch + iw; i++;
    }
  };
  if (w >= 8) {
    lay(set.north, room.y0 + 2, 5, 2);
    lay(set.hang, room.y0, 4, 3);
    lay(set.south, room.y1, 8, 3);
  }
  return out;
}
