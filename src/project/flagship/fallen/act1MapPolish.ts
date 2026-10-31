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
import type { Command, EventPage, Project } from "@/project/types";
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

/**
 * 떨어진 별(은빛 관)에 언제든, 관 둘레 어느 칸에서든 말을 걸 수 있게 한다 — 모든 숲·이야기 단계 뒤(chronoBell.ts, 빈터 마감 다음).
 *
 * 사용자 신고(1.26 운영, 2026-11-01): 「그 운석 ..? 그 관이라고해야하나 그거 말을 걸수가 없는데」. 원인 둘:
 * 1. 조사 칸은 관 그림(3×2, 조사 칸 바로 위) 아래 한 칸뿐이었다 — 관 그림 옆·위에서 관을 보고 눌러도 아무 일이 없었다.
 *    몸 사각(footprint 3×3, 조사 칸이 아랫줄 가운데)을 관 그림까지 넓힌다. 우선순위는 그대로 «아래»라 통행은 바뀌지 않는다.
 * 2. 퍼즐 쪽은 숲지기 브람에게 먼저 말을 걸어야(sw_fs_main_step0) 켜졌고, 그 전·주 퀘스트 전에는 쪽이 아예 없었다 — 숲길의 브람을
 *    지나쳐 공터로 바로 오면 관은 «없는 것»이었다. 브람 없이 와도 같은 퍼즐을 열고(브람 단계도 함께 마친다), 그 밖의 때는 짧은 한 줄.
 */
export function makeFallenPodExaminable(project: Project, forestId: string): void {
  const map = project.maps[forestId];
  const pod = map?.events.find((e) => e.id === `ev_${FS_PREFIX}_main_inspect1`);
  if (!map || !pod?.pages?.length) return;
  const STEP0 = "sw_fs_main_step0";
  const active = pod.pages.find((p) => p.conditions.some((c) => c.kind === "switch" && c.switchId === STEP0 && c.value === true));
  if (!active) throw new Error("[fallen-star act1] 떨어진 별 퍼즐 쪽(브람 뒤)을 찾지 못했다");
  const narrate = (body: string): Command => ({ kind: "text", body } as Command);
  const base = { graphic: { transparent: true }, trigger: { kind: "action" as const }, priority: "below" as const, overlapForbidden: false, movement: active.movement };
  // 브람 없이 온 때 — 브람 단계(진행 스위치·진행 변수)를 마치고 같은 퍼즐로. 브람 뒤 쪽보다 앞에 두어 그 쪽이 이긴다.
  const early: EventPage = {
    ...structuredClone(active),
    id: `${active.id}_early`,
    name: "떨어진 별(브람 전)",
    conditions: active.conditions.filter((c) => !(c.kind === "switch" && c.switchId === STEP0)) as EventPage["conditions"],
    commands: [
      { kind: "setSwitch", switchId: STEP0, value: true } as Command,
      { kind: "setVariable", variableId: "var_fs_main_progress", op: "+=", value: 1 } as Command,
      ...structuredClone(active.commands),
    ],
  };
  // 주 퀘스트 전 — 조건 없는 맨 앞 쪽(다른 쪽이 하나도 안 맞을 때만).
  const idle: EventPage = {
    ...base, id: `${pod.id}_idle`, name: "떨어진 별(퀘스트 전)", conditions: [],
    commands: [narrate("그을린 구덩이에 사람 키만 한\n은빛 알이 박혀 있다. 아직 뜨겁다.")],
  } as EventPage;
  pod.pages = pod.pages.filter((p) => p.id !== early.id && p.id !== idle.id);
  pod.pages.splice(pod.pages.indexOf(active), 0, early);
  pod.pages.unshift(idle);
  for (const page of pod.pages) page.footprint = { width: 3, height: 3 };
}
