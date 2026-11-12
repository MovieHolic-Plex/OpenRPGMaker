/**
 * 「현재 목표」 안내창과 상호작용 안내의 자리 — 순수 함수(화면 논리 px).
 *
 * 목표 창은 한 자리에 머문다: 오른쪽 위, 그 자리에 다른 고정 HUD(시계·소지금)가 있으면 그 바로 밑.
 * 2026-10-29~11-11 에는 후보 자리(네 모서리·위아래 가운데·맵 바깥 여백)마다 무엇을 덮는지 값을 매겨 걸을 때마다 다시 골랐다.
 * 주인공·인물을 덜 덮었지만 맵마다 오른쪽 위 · 왼쪽 아래 · 가운데 위 · 오른쪽 아래로 옮겨 다녀 «목표가 어디 있는지» 를 매번 찾아야 했다
 * (2026-11-12 증기의 심장 직접 플레이). 덮는 문제는 자리를 옮기지 않고 푼다 — 주인공과 마주 본 것이 창 밑에 들면 창이 흐려진다(hudYield.ts).
 */
export type PlacementRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type ObjectivePlacementInput = {
  readonly stage: { readonly width: number; readonly height: number };
  /** 지금 그려진 창 크기. */
  readonly box: { readonly width: number; readonly height: number };
  readonly margin: number;
  readonly player: PlacementRect | null;
  readonly actors: readonly PlacementRect[];
  readonly hud: readonly PlacementRect[];
  /** 맵이 화면에 그려진 사각형(화면 밖으로 넘친 부분 포함). 없으면 화면 전체가 맵이다. */
  readonly map: PlacementRect | null;
};

export type ObjectivePlacement = { readonly x: number; readonly y: number; readonly width: number };

type Candidate = PlacementRect & { readonly bias: number };

/**
 * 목표 창의 자리 — 오른쪽 위 모서리에서, 그 자리를 차지한 고정 HUD(시계·소지금·미니맵) 밑으로 내려 쌓는다.
 * 주인공·인물·맵은 보지 않는다(걸어도 자리가 바뀌지 않는다). `hud` 에는 주인공을 피해 옮겨 앉는 칸을 넣지 않는다 — 그 칸이 목표 창을 비킨다.
 */
export function objectiveHome(input: Pick<ObjectivePlacementInput, "stage" | "box" | "margin" | "hud">): ObjectivePlacement {
  const { stage, box, margin: m } = input;
  const x = Math.max(m, stage.width - box.width - m);
  let y = m;
  for (let pass = 0; pass <= input.hud.length; pass += 1) {
    const hit = input.hud.find((hud) => overlap({ x, y, width: box.width, height: box.height }, inflate(hud, 2)) > 0);
    if (!hit) break;
    y = hit.y + hit.height + m;
  }
  // 위쪽이 HUD 로 꽉 차 화면 아래 절반까지 밀리면 모서리에 그대로 둔다(그런 구성은 저작자가 목표 줄을 끈다).
  if (y + box.height > stage.height / 2) y = m;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(box.width) };
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

function placementCost(box: PlacementRect, input: ObjectivePlacementInput): number {
  const boxArea = Math.max(1, box.width * box.height);
  let cost = 0;
  if (input.player) {
    const player = inflate(input.player, 6);
    cost += 60 * overlap(box, player) / Math.max(1, area(player));
  }
  for (const actor of input.actors) cost += 10 * overlap(box, inflate(actor, 2)) / Math.max(1, area(actor));
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
