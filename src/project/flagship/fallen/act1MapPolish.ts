/**
 * 폴른 스타 1막 맵 마감 — 모든 숲·추락지 단계 뒤에 한 번(chronoBell.ts, 2막 여는 비트 다음).
 *
 * 추락지 빈터: 여러 단계(숲 바닥 덮개·불씨 줄기·덤불 마감)가 각자 칸을 고르다 들꽃·독버섯이 가로 두 줄, 불씨 자국이 한 줄에
 * 두 칸 간격, 고사리가 가로 셋으로 늘어서 「꾸민 화단」으로 읽혔다(fs-act1-vqa). 빈터의 낱 장식을 걷고, 관이 북동쪽에서
 * 미끄러져 박힌 자리로 다시 짠다 — 북동 쪽은 그을린 미끄럼 자국(불씨·숯), 동쪽은 충격에 눕은 덤불, 불이 닿지 않은
 * 서·북쪽 가장자리에만 들꽃·버섯 덩이가 남는다. 구덩이 둑·관·마른 고목·쓰러진 통나무·그루터기·나무는 건드리지 않는다.
 * 좌표는 떨어진 별(조사 칸) 기준 상대 칸 — 관 자리가 옮겨져도 같은 그림이 된다. 새 그림 없음(버들항 장소 칸만).
 */
import { isPassable } from "@/project/collision";
import type { Project } from "@/project/types";
import { FS_PREFIX } from "../fallenStarStory";

/** 빈터에서 걷는 낱 장식(위 겹). 나무·줄기·관·고목·통나무·그루터기는 이름이 달라 남는다. */
const LOOSE = /^버들항 장소 · (풀밭 들꽃 무더기|들꽃·고사리 무더기|독버섯|낮은 헤더 덤불|고사리|징검돌|불씨 자국|숯더미)/;

/** [이름표, 관 기준 dx, dy] — 두 칸 그림(숯더미)은 왼쪽 칸 이름표의 다음 칸이 오른쪽 칸이다. */
const CRASH_DRESS: ReadonlyArray<readonly [string, number, number]> = [
  // 구덩이 안 — 관 곁 숯더미와 불씨 둘(서로 어긋나게).
  ["숯더미", 3, -2], ["불씨 자국 A", -3, -1], ["불씨 자국 A", 2, -3],
  // 북동 미끄럼 자국 — 관이 들어온 쪽으로 불씨·숯이 점점 성기게.
  ["불씨 자국 A", 3, -4], ["불씨 자국 A", 5, -5], ["숯더미", 6, -6],
  // 동쪽 — 충격에 눕은 덤불과 남은 불씨(덩이지게, 줄 짓지 않게).
  ["고사리 A", 5, -2], ["낮은 헤더 덤불 C", 6, -1], ["불씨 자국 A", 7, -1], ["낮은 헤더 덤불 B", 9, 0], ["고사리 A", 8, 1],
  // 서쪽 마른 고목 아래 — 그늘진 버섯 덩이.
  ["낮은 헤더 덤불 C", -6, 0], ["징검돌 C", -5, 0], ["독버섯 B", -4, 0], ["낮은 헤더 덤불 C", -4, 1], ["독버섯 C", -3, 1],
  // 북서·북쪽 가장자리 — 불이 닿지 않은 들꽃 몇 포기.
  ["징검돌 C", -6, -4], ["고사리 B", -5, -4], ["풀밭 들꽃 무더기 C", -5, -6], ["풀밭 들꽃 무더기 B", -4, -5], ["낮은 헤더 덤불 A", -1, -7], ["고사리 B", 1, -6],
];

export function polishFallenCrashClearing(project: Project, forestId: string): void {
  const map = project.maps[forestId];
  if (!map) return;
  const pod = map.events.find((e) => e.id === `ev_${FS_PREFIX}_main_inspect1`);
  if (!pod) return;
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const W = map.width, H = map.height;
  const label = (t: number | undefined) => (t !== undefined && t >= 0 ? meta[t]?.label ?? "" : "");
  // 빈터(관 기준 서 7 · 동 10 · 북 7 · 남 2)의 낱 장식을 걷는다.
  for (let y = Math.max(0, pod.y - 7); y <= Math.min(H - 1, pod.y + 2); y += 1) {
    for (let x = Math.max(0, pod.x - 7); x <= Math.min(W - 1, pod.x + 10); x += 1) {
      const i = y * W + x;
      if (LOOSE.test(label(map.upperTiles[i]))) map.upperTiles[i] = -1;
    }
  }
  const tileOf = (name: string) => meta.findIndex((m) => m?.label === `버들항 장소 · ${name}`);
  const occupied = (x: number, y: number) => map.events.some((e) => e.x === x && e.y === y && !/^ev_field_enemy/.test(e.id));
  // 빈 풀 칸 — 위 겹이 비고, 걸을 수 있고, 이벤트가 없다. 구덩이 칸(흙)도 된다(구덩이 안 불씨).
  const freeCell = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
    && (map.upperTiles[y * W + x] ?? -1) < 0 && (map.upperOverlayTiles?.[y * W + x] ?? -1) < 0
    && isPassable(project, map, x, y) && !occupied(x, y);
  for (const [name, dx, dy] of CRASH_DRESS) {
    const t = tileOf(name);
    if (t < 0) continue;
    const x = pod.x + dx, y = pod.y + dy;
    const wide = name === "숯더미";
    if (!freeCell(x, y) || (wide && !freeCell(x + 1, y))) continue;
    map.upperTiles[y * W + x] = t;
    if (wide) map.upperTiles[y * W + x + 1] = t + 1;
  }
}
