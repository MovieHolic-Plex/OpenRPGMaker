/**
 * 「현재 목표」 안내창 자리 고르기 — 순수 함수(화면 논리 px).
 *
 * 예전에는 오른쪽 위 고정(테마 HUD 는 top:88px)이라, 카메라가 주인공을 화면 가운데에 두는
 * 작은 방·좁은 맵에서 주인공 옆 가구·NPC·주인공 머리를 덮었다(장부 hud.json 93건, 14게임 전부).
 * 후보 자리(네 모서리·위아래 가운데·맵 바깥 여백 띠)마다 무엇을 덮는지 값을 매겨 가장 덜 덮는 곳을 고른다.
 *  - 주인공·인물(이벤트 그림)·다른 HUD 를 덮는 것이 가장 비싸다. 입구와 그 위 건물 얼굴(간판)도 덮지 않으려 한다.
 *  - 맵 바깥 여백(작은 방 둘레의 빈 화면)은 공짜다. 거기 들어가도록 창 폭을 줄인 후보도 낸다.
 *  - 지금 자리가 거의 같은 값이면 옮기지 않는다(걷는 동안 깜빡이지 않게).
 */
export type PlacementRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type ObjectivePlacementInput = {
  readonly stage: { readonly width: number; readonly height: number };
  /** 지금 그려진 창 크기(최대 폭 maxWidth 로 줄바꿈된 결과). */
  readonly box: { readonly width: number; readonly height: number };
  /** 창이 쓸 수 있는 최대 폭. 맵 위아래 여백 띠에 넣을 때 줄 수를 줄이려고 자연 폭보다 넓힐 수 있다. */
  readonly maxWidth: number;
  /** 창 폭을 이보다 좁히지 않는다. */
  readonly minWidth: number;
  /** 맵 바깥 여백 띠에 넣을 때는 이 폭까지 좁힌다(글자 크기는 그대로, 줄만 는다). 없으면 minWidth. */
  readonly minBandWidth?: number;
  /** 폭 w 로 줄바꿈했을 때 실제 창 높이. 없으면 넓이 보존으로 어림한다. */
  readonly measure?: (width: number) => number;
  readonly margin: number;
  readonly player: PlacementRect | null;
  readonly actors: readonly PlacementRect[];
  /** 입구와 그 위 건물 얼굴(간판·지붕 표지) — 인물보다 싸게 피한다. 없으면 없음. */
  readonly landmarks?: readonly PlacementRect[];
  readonly hud: readonly PlacementRect[];
  /** 맵이 화면에 그려진 사각형(화면 밖으로 넘친 부분 포함). 없으면 화면 전체가 맵이다. */
  readonly map: PlacementRect | null;
  readonly current: ObjectivePlacement | null;
};

export type ObjectivePlacement = { readonly x: number; readonly y: number; readonly width: number };

type Candidate = PlacementRect & { readonly bias: number };

export function chooseObjectivePlacement(input: ObjectivePlacementInput): ObjectivePlacement {
  const candidates = objectiveCandidates(input);
  let best: Candidate | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const cost = placementCost(candidate, input) + candidate.bias;
    if (cost < bestCost) { best = candidate; bestCost = cost; }
  }
  const current = input.current;
  if (current && best) {
    const kept = candidateAt(current, input);
    // 지금 자리가 크게 나쁘지 않으면 그대로 둔다 — 한 칸 걸을 때마다 창이 뛰지 않게.
    if (kept && placementCost(kept, input) <= bestCost + 0.6) return current;
  }
  if (!best) return { x: input.margin, y: input.margin, width: input.box.width };
  return { x: Math.round(best.x), y: Math.round(best.y), width: Math.round(best.width) };
}

function objectiveCandidates(input: ObjectivePlacementInput): Candidate[] {
  const { stage, margin: m } = input;
  const out: Candidate[] = [];
  const add = (x: number, y: number, width: number, height: number, bias: number): void => {
    if (width < Math.min(input.minWidth, input.minBandWidth ?? input.minWidth) - 0.5 || x < 0 || y < 0 || x + width > stage.width + 0.5 || y + height > stage.height + 0.5) return;
    out.push({ x, y, width, height, bias });
  };
  const corners = (width: number, height: number, extra: number): void => {
    const right = stage.width - width - m, bottom = stage.height - height - m, center = (stage.width - width) / 2;
    add(right, m, width, height, 0 + extra);
    add(m, m, width, height, 0.15 + extra);
    add(center, m, width, height, 0.25 + extra);
    add(right, bottom, width, height, 0.35 + extra);
    add(m, bottom, width, height, 0.45 + extra);
    add(center, bottom, width, height, 0.5 + extra);
  };
  corners(input.box.width, input.box.height, 0);
  // 좁힌 창: 넓이를 보존해 높이를 어림(줄 수가 는다). 맵 바깥 옆 여백에 들어가는 후보를 만든다.
  const map = input.map;
  const widths = new Set<number>();
  for (const fraction of [0.75, 0.6]) widths.add(Math.round(input.box.width * fraction));
  for (const width of widths) {
    if (width >= input.box.width || width < input.minWidth) continue;
    const height = estimatedHeight(input, width);
    corners(width, height, 0.3);
    if (map) {
      // 옆 여백 띠 가운데 높이(맵이 화면 가운데에 작게 있을 때).
      const y = Math.max(m, Math.min(stage.height - height - m, map.y));
      add(m, y, width, height, 0.4);
      add(stage.width - width - m, y, width, height, 0.4);
    }
  }
  if (map) bandCandidates(input, map, add);
  if (map) {
    // 맵 위·아래 여백 띠(맵 가장자리 바로 바깥).
    const above = map.y - input.box.height - m;
    if (above >= m) add(Math.max(m, Math.min(stage.width - input.box.width - m, map.x + map.width - input.box.width)), above, input.box.width, input.box.height, 0.1);
    const below = map.y + map.height + m;
    if (below + input.box.height <= stage.height - m) add(Math.max(m, Math.min(stage.width - input.box.width - m, map.x + map.width - input.box.width)), below, input.box.width, input.box.height, 0.3);
  }
  return out;
}

/**
 * 맵 바깥 여백 띠 후보 — 방을 전혀 덮지 않는 자리. 옆 띠는 띠 폭에 맞춰 창을 좁히고(줄 수가 는다),
 * 위아래 띠는 띠 높이에 들어가는 가장 좁은 폭을 찾는다. 들어가지 않는 띠는 후보를 내지 않는다.
 */
function bandCandidates(input: ObjectivePlacementInput, map: PlacementRect, add: (x: number, y: number, width: number, height: number, bias: number) => void): void {
  const { stage, margin: m, box } = input;
  const minBand = Math.max(1, input.minBandWidth ?? input.minWidth);
  const leftRoom = Math.floor(map.x - 2 * m), rightRoom = Math.floor(stage.width - (map.x + map.width) - 2 * m);
  const sides: Array<[number, (width: number) => number]> = [
    [rightRoom, width => stage.width - width - m],
    [leftRoom, () => m],
  ];
  sides.forEach(([room, xOf], index) => {
    if (room < minBand) return;
    const width = Math.min(box.width, room);
    const height = estimatedHeight(input, width);
    const x = xOf(width);
    // 같은 여백 자리면 키가 낮은 창(줄이 적은 창)이 낫다.
    const bias = 0.05 * index + 0.5 * height / stage.height;
    add(x, m, width, height, bias);
    add(x, Math.max(m, Math.min(stage.height - height - m, map.y)), width, height, bias + 0.02);
    add(x, stage.height - height - m, width, height, bias + 0.04);
  });
  const aboveRoom = Math.floor(map.y - 2 * m), belowRoom = Math.floor(stage.height - (map.y + map.height) - 2 * m);
  const bands: Array<[number, (height: number) => number]> = [[aboveRoom, () => m], [belowRoom, height => stage.height - height - m]];
  bands.forEach(([room, yOf], index) => {
    if (room <= 0) return;
    // 가장 좁으면서 띠 높이에 들어가는 폭(넓을수록 줄이 준다 — 자연 폭부터 화면 폭까지).
    const maxWide = Math.min(Math.max(box.width, Math.floor(input.maxWidth)), Math.floor(stage.width - 2 * m));
    const tries = [box.width];
    for (let k = 1; k <= 4; k++) tries.push(Math.round(box.width + (maxWide - box.width) * k / 4));
    for (const width of tries) {
      if (width < minBand) continue;
      const height = estimatedHeight(input, width);
      if (height > room) continue;
      const y = yOf(height), tall = 0.5 * height / stage.height;
      add(stage.width - width - m, y, width, height, 0.1 + 0.1 * index + tall);
      add(m, y, width, height, 0.15 + 0.1 * index + tall);
      break;
    }
  });
}

/**
 * 「Z 조사」 같은 상호작용 안내 자리 — 아래 가운데가 기본이고, 그 자리가 주인공·인물·다른 HUD·방을 덮으면
 * 아래 왼쪽·오른쪽(작은 방이면 둘레 여백)으로 비킨다. 아래 가운데에 고정했을 때 방 아래로 난 유일한 출구 통로를 덮었다
 * (2026-10-29 적대 VQA mt3 argon 79·terra 185·212). 지금 자리가 거의 같은 값이면 옮기지 않는다.
 */
export function choosePromptPlacement(input: Pick<ObjectivePlacementInput, "stage" | "margin" | "player" | "actors" | "hud" | "map"> & {
  readonly box: { readonly width: number; readonly height: number };
  readonly current: { readonly x: number; readonly y: number } | null;
}): { readonly x: number; readonly y: number } {
  const { stage, box, margin: m } = input;
  const bottom = stage.height - box.height - m * 2;
  const candidates: Candidate[] = [
    { x: (stage.width - box.width) / 2, y: bottom, width: box.width, height: box.height, bias: 0 },
    { x: m, y: bottom, width: box.width, height: box.height, bias: 0.2 },
    { x: stage.width - box.width - m, y: bottom, width: box.width, height: box.height, bias: 0.25 },
  ];
  const cost = (rect: PlacementRect): number => placementCost(rect, input as ObjectivePlacementInput);
  let best = candidates[0]!, bestCost = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const value = cost(candidate) + candidate.bias;
    if (value < bestCost) { best = candidate; bestCost = value; }
  }
  if (input.current) {
    const kept = { ...input.current, width: box.width, height: box.height };
    if (kept.x >= 0 && kept.x + box.width <= stage.width + 0.5 && cost(kept) <= bestCost + 0.3) return input.current;
  }
  return { x: Math.round(best.x), y: Math.round(best.y) };
}

function estimatedHeight(input: ObjectivePlacementInput, width: number): number {
  const box = input.box;
  if (input.measure && Math.round(width) !== Math.round(box.width)) return input.measure(Math.round(width));
  if (width >= box.width) return box.height;
  // 줄 하나 더 생길 여유를 둔다(줄바꿈은 어절 단위라 넓이보다 조금 더 든다).
  return Math.ceil(box.height * (box.width / width) * 1.1);
}

function candidateAt(current: ObjectivePlacement, input: ObjectivePlacementInput): Candidate | null {
  const height = estimatedHeight(input, current.width);
  if (current.x < 0 || current.y < 0 || current.x + current.width > input.stage.width + 0.5 || current.y + height > input.stage.height + 0.5) return null;
  return { x: current.x, y: current.y, width: current.width, height, bias: 0 };
}

function placementCost(box: PlacementRect, input: ObjectivePlacementInput): number {
  const boxArea = Math.max(1, box.width * box.height);
  let cost = 0;
  if (input.player) {
    const player = inflate(input.player, 6);
    cost += 60 * overlap(box, player) / Math.max(1, area(player));
  }
  for (const actor of input.actors) cost += 10 * overlap(box, inflate(actor, 2)) / Math.max(1, area(actor));
  for (const landmark of input.landmarks ?? []) cost += 6 * overlap(box, landmark) / Math.max(1, area(landmark));
  for (const hud of input.hud) cost += 80 * overlap(box, inflate(hud, 2)) / Math.max(1, Math.min(boxArea, area(hud)));
  // 맵 위를 덮는 넓이(여백 위는 공짜). 0~3.
  const map = input.map ?? { x: 0, y: 0, width: input.stage.width, height: input.stage.height };
  const onMap = overlap(box, map);
  // 방을 조금이라도 덮으면 고정 벌점 — 여백에 통째로 들어가는 자리가 있으면 그쪽이 늘 이긴다(주인공·HUD 덮음은 여전히 더 비싸다).
  if (input.map && onMap > 0) cost += 4;
  cost += 3 * onMap / boxArea;
  return cost;
}

function inflate(rect: PlacementRect, by: number): PlacementRect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + by * 2, height: rect.height + by * 2 };
}

function area(rect: PlacementRect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function overlap(a: PlacementRect, b: PlacementRect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
