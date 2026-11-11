// 구성기 공용 — 어디로도 가지 않는 한 칸 폭 골목 찾기.
// 왜(2026-11-11 Terra «초승달 궁전»): 성벽과 집 줄 사이의 맨모래 띠가 집 사이 틈으로 길과 이어져 있었고, 지붕 모서리가 그 띠를 막다른 토막으로 잘랐다.
// 걷는 사람은 길로 알고 들어가 막힌다. 구성기가 그런 골목의 어귀를 제 소품(항아리·상자)으로 막는다 — 여기서는 막을 칸만 고른다.
export interface AlleyBoard {
  readonly W: number;
  readonly H: number;
  /** 걸을 수 있는 칸. */
  walk(x: number, y: number): boolean;
  /** 쓰임 없는 맨땅(길·광장·정원·문 앞·예약 칸이 아니다). */
  plain(x: number, y: number): boolean;
}

type Cell = { readonly x: number; readonly y: number };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** 이보다 큰 맨땅 덩이는 빈터다(막다른 주머니가 아니다). */
const MAX_POCKET = 60;
/** 어귀 뒤로 걸어 들어갈 칸이 이만큼은 있어야 막다른 골목이다. */
const MIN_BEHIND = 2;

/**
 * start 에서 걸어 닿는 칸 가운데 «막다른 골목의 어귀» 칸들. 골목 = 양옆이 막힌 맨땅 칸이 이어진 줄. 골목 칸을 뺀 나머지 덩이 가운데
 * 쓰임 있는 칸이 있거나 MAX_POCKET 보다 큰 덩이가 «갈 곳»이다. 갈 곳에 한 군데로만 닿는 골목(다른 끝은 막다르거나 작은 맨땅 주머니)의 그 닿는 칸을 돌려준다.
 * 갈 곳 두 군데를 잇는 골목(지나가는 길)과 넓은 터 안의 좁은 틈은 고르지 않는다.
 */
export function deadAlleyMouths(board: AlleyBoard, start: Cell): Cell[] {
  const { W, H } = board;
  const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1);
  const flood = (seed: number, inside: (k: number) => boolean, mark: (k: number) => void): number[] => {
    const cells = [seed]; mark(seed);
    for (let i = 0; i < cells.length; i++) for (const [dx, dy] of DIRS) {
      const k = at((cells[i]! % W) + dx, Math.floor(cells[i]! / W) + dy);
      if (k >= 0 && inside(k)) { mark(k); cells.push(k); }
    }
    return cells;
  };
  if (!board.walk(start.x, start.y)) return [];
  const reach = new Set<number>();
  flood(at(start.x, start.y), (k) => !reach.has(k) && board.walk(k % W, Math.floor(k / W)), (k) => reach.add(k));
  const neck = new Set<number>();
  for (const k of reach) {
    const x = k % W, y = Math.floor(k / W);
    if (!board.plain(x, y)) continue;
    const n = board.walk(x, y - 1), s = board.walk(x, y + 1), e = board.walk(x + 1, y), w = board.walk(x - 1, y);
    if (((n || s) && !e && !w) || ((e || w) && !n && !s)) neck.add(k);
  }
  const comp = new Map<number, number>(), goes: boolean[] = [], size: number[] = [];
  for (const k of reach) {
    if (neck.has(k) || comp.has(k)) continue;
    const id = goes.length;
    const cells = flood(k, (c) => reach.has(c) && !neck.has(c) && !comp.has(c), (c) => comp.set(c, id));
    goes.push(cells.length > MAX_POCKET || cells.some((c) => !board.plain(c % W, Math.floor(c / W))));
    size.push(cells.length);
  }
  const done = new Set<number>(), mouths: Cell[] = [];
  for (const k of neck) {
    if (done.has(k)) continue;
    const alley = flood(k, (c) => neck.has(c) && !done.has(c), (c) => done.add(c));
    // 골목이 갈 곳에 닿는 자리(칸·방향)를 센다 — 한 군데뿐이면 막다른 골목이다.
    const around = alley.flatMap((c) => DIRS.map(([dx, dy]) => ({ c, id: comp.get(at((c % W) + dx, Math.floor(c / W) + dy)) })).filter((n): n is { c: number; id: number } => n.id !== undefined));
    const contacts = around.filter((n) => goes[n.id]);
    // 그 뒤에 걸어 들어갈 데가 두 칸은 있어야 막는다(한 칸짜리 구석은 그대로 둔다).
    const behind = alley.length - 1 + [...new Set(around.filter((n) => !goes[n.id]).map((n) => n.id))].reduce((sum, id) => sum + size[id]!, 0);
    if (contacts.length === 1 && behind >= MIN_BEHIND) mouths.push({ x: contacts[0]!.c % W, y: Math.floor(contacts[0]!.c / W) });
  }
  return mouths;
}
