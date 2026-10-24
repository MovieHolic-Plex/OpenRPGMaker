/**
 * 『폴른 스타』 마을 사람들 손질(2026-10-24, 사용자 피드백 A·B·C·2·3·6).
 *
 * - A: 로한의 대장간이 엘레나·이리스가 쥘 수 있는 것도 판다(재고는 townLife.ts SMITHY_GOODS). 이리스(총사)의 직업 허용 목록은
 *   시작 장비 넷뿐이라 손 석궁·화승총·가죽 갑옷·여행 모자·장신구 쪽 허용 목록에 이리스를 더한다.
 * - B: 대장장이 로한이 꼬마 칩(People1 #0, 토비와 같은 그림)이었다 → 두건 두른 수염 장정 Actor2 #4(짝 얼굴 Actor1 #12).
 *   이름과 맞지 않던 광장 사람들·문지기·약재상도 공용 칩 중 이름에 맞는 사람으로 바꾼다(새 사람 그림은 만들지 않는다).
 * - C: 말하는 사람마다 흉상. 칩 → 공용 대응표(sharedCharacterGraphics.json)의 짝 얼굴 → 그 얼굴의 표정 세트 흉상.
 *   같은 흉상을 두 사람이 나눠 쓰지 않는다(이름 있는 사람이 먼저 갖는다). 감정이 뚜렷한 줄에는 대사 표정을 단다.
 * - 2: 행렬이 떠난 뒤 광장 둘레를 아이 셋이 빠르게 뛰며 술래잡기를 한다(People1 #1 · People4 #0 · People5 #1).
 * - 3: 마을 외진 막다른 구석의 이끼 낀 상자에 「새벽샘 별조각 목걸이」(주는 피해 +30% — 물리·마법 모두, 치명타율 +10%) 하나.
 * - 6: 길가에서 손만 뻗으면 열리던 거리 수납의 보상은 걷어 냈다(townLife.ts STREET_FINDS) — 마을 쪽 값진 것은
 *   리노가 지키는 초소 두 상자(행렬 뒤), 이 숨은 상자뿐이다.
 */
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { findSharedPortrait, sharedExpressionSetIdOf, sharedPortraitId } from "@/assets/sharedPortraitAssets";
import { isPassable } from "@/project/collision";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { sharedFaceIdForCharset } from "@/project/sharedCharacterFaceResolver";
import type { Command, Condition, EquipmentRecord, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_PREFIX } from "../fallenStarStory";

const SW_VALEN_MARCHED = "sw_fs_valen_marched";
type Cell = { x: number; y: number };

function eventLists(event: GameEvent): Command[][] {
  const out: Command[][] = [];
  const walk = (list: Command[] | undefined): void => {
    if (!Array.isArray(list)) return;
    out.push(list);
    for (const cmd of list) {
      const rec = cmd as unknown as Record<string, unknown>;
      for (const key of ["then", "else", "otherwise", "commands", "body"]) if (Array.isArray(rec[key])) walk(rec[key] as Command[]);
      for (const opt of (rec.options as { branch?: Command[]; commands?: Command[] }[] | undefined) ?? []) { walk(opt?.branch); walk(opt?.commands); }
      for (const br of (rec.branches as { commands?: Command[] }[] | undefined) ?? []) walk(br?.commands);
    }
  };
  for (const page of event.pages ?? []) walk(page.commands as Command[]);
  walk(event.commands as Command[]);
  return out;
}

function setChip(map: GameMap | undefined, eventId: string, texture: string, characterIndex: number): void {
  const event = map?.events.find((e) => e.id === eventId);
  if (!event) throw new Error(`[fallen-star cast] 이벤트가 없다: ${eventId}`);
  for (const page of event.pages ?? []) {
    if (!page.graphic?.sprite) continue;
    const direction = page.graphic.direction ?? "down";
    page.graphic = { ...page.graphic, sprite: { type: "bundled", id: texture }, direction, pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }) };
  }
}

function renameSpeaker(map: GameMap, eventId: string, name: string): void {
  const event = map.events.find((e) => e.id === eventId);
  if (!event) return;
  const old = event.name;
  event.name = name;
  if (!old) return;
  for (const page of event.pages ?? []) if (page.name.startsWith(old)) page.name = name + page.name.slice(old.length);
  for (const list of eventLists(event)) for (const cmd of list) {
    const rec = cmd as unknown as { kind: string; speaker?: string };
    if (rec.kind === "text" && rec.speaker === old) rec.speaker = name;
  }
}

/** B — 이름에 맞는 칩. 모두 기존 RTP 걷기 칩이다. */
function recast(project: Project): void {
  const hub = project.maps.fs_hub!;
  setChip(project.maps.fs_smithy, "ev_fs_smith", "tex_easyrpg_charset_actor2", 4); // 두건 두른 수염 장정
  setChip(project.maps.fs_apothecary, "ev_fs_apothecary", "tex_easyrpg_charset_people2", 2); // 머리 민 약초꾼(백발 장로 얼굴은 하넬 몫)
  setChip(hub, "ev_fs_gate", "tex_easyrpg_charset_people3", 7); // 푸른 갑옷 문지기
  setChip(hub, "ev_fs_crowd_b", "tex_easyrpg_charset_people3", 5); // 아낙(예전: 어린 소녀)
  setChip(hub, "ev_fs_crowd_e", "tex_easyrpg_charset_people2", 3); // 처녀(예전: 이국 의상)
  setChip(hub, "ev_fs_crowd_f", "tex_easyrpg_charset_people1", 2); // 청년(예전: 여자아이)
  renameSpeaker(hub, "ev_fs_crowd_a", "농부네 꼬마"); // 빵모자 아이 칩 — 「우리 밭에도 불똥이 튀었는데」는 아이 입에도 맞다
}

/** A — 이리스가 쥘 수 있는 것. 무기는 총사답게 석궁·총, 몸은 가벼운 가죽, 장신구는 둘이 같이 쓰던 것 전부. */
function equipIris(project: Project): void {
  const IRIS = "actor_fs_iris";
  const direct = new Set(["equip_gen_dagger_scout", "equip_gen_crossbow_hand", "equip_gen_gun_flint", "equip_gen_armor_leather", "equip_gen_hat_traveler", "equip_gen_helm_leather"]);
  for (const eq of project.database.equipment) {
    const shared = eq.slot === "accessory" && eq.equippableActorIds.includes("actor_hero") && eq.equippableActorIds.includes("actor_mage");
    if ((direct.has(eq.id) || shared) && !eq.equippableActorIds.includes(IRIS)) eq.equippableActorIds.push(IRIS);
  }
}

// ── C: 흉상 ──────────────────────────────────────────────────────────
/**
 * 흉상이 걷기 칩·얼굴과 다른 사람으로 읽히는 세트 — 48px 표정 얼굴 칸을 쓴다.
 * 푸른 머리 머리띠(발렌): 얼굴과 발렌 칩은 금빛 머리띠인데 흉상·전신은 광대 모자를 썼다.
 */
const FACE_CELL_SETS = new Set(["shared-blue-headband-expressions"]);
const CELL_OF_EMOTION: Readonly<Record<string, string>> = { happy: "02", surprised: "04", angry: "09", sad: "10" };

function bustOfFace(faceId: string | undefined): string | undefined {
  const setId = sharedExpressionSetIdOf(faceId);
  if (setId && FACE_CELL_SETS.has(setId)) return `${setId}-00`;
  const id = setId ? sharedPortraitId(setId, "bust", "base") : undefined;
  return id && findSharedPortrait(id) ? id : undefined;
}

/**
 * 화자 → 흉상. `faces` 의 얼굴(동료·이야기 인물)은 같은 세트 흉상으로 올리고, 나머지 화자는 그 이름의 이벤트 칩에서 찾는다.
 * 같은 흉상을 쓰는 다른 사람(다른 이벤트)이 이미 있으면 뒤의 사람은 흉상 없이 둔다 — 서로 다른 사람이 같은 얼굴이면 안 된다.
 */
export function fallenSpeakerBusts(project: Project, faces: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  const owner = new Map<string, string>(); // 흉상 → 주인(이벤트 id 또는 화자)
  const claim = (speaker: string, bust: string | undefined, who: string): void => {
    if (!bust) return;
    const had = owner.get(bust);
    if (had && had !== who) return;
    owner.set(bust, who);
    out[speaker] = bust;
  };
  // 같은 얼굴을 받은 별칭(리노 → 심문회 기사)은 같은 사람으로 본다.
  for (const [speaker, face] of Object.entries(faces)) claim(speaker, bustOfFace(face) ?? face, `face:${face}`);

  const people: { name: string; id: string; face?: string }[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events) {
    const graphic = event.pages?.find((p) => p.graphic?.sprite && !p.graphic.transparent)?.graphic;
    const sprite = graphic?.sprite as { type?: string; id?: string } | undefined;
    if (!sprite?.id || sprite.type !== "bundled" || !/charset/.test(sprite.id)) continue;
    const { characterIndex } = decodeCharsetFrameIndex(graphic?.pattern ?? 0);
    people.push({ name: event.name ?? "", id: event.id, face: sharedFaceIdForCharset(sprite.id, characterIndex) });
  }
  const speakers = new Map<string, number>();
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const list of eventLists(event)) for (const cmd of list) {
    const rec = cmd as unknown as { kind: string; speaker?: string };
    if (rec.kind === "text" && rec.speaker?.trim()) speakers.set(rec.speaker.trim(), (speakers.get(rec.speaker.trim()) ?? 0) + 1);
  }
  // 대사가 많은 사람부터(이름 있는 마을 사람이 광장 군중보다 먼저 흉상을 갖는다).
  for (const [speaker] of [...speakers].sort((a, b) => b[1] - a[1])) {
    if (out[speaker] || faces[speaker] !== undefined) continue;
    const person = people.find((p) => p.name === speaker)
      ?? people.find((p) => p.name.endsWith(` ${speaker}`))
      ?? people.find((p) => speaker.startsWith(`${p.name} `));
    if (person) claim(speaker, bustOfFace(person.face), person.id);
  }
  return out;
}

/** 감정이 뚜렷한 줄 — 대사 표정(기쁨·슬픔·분노·놀람)이 같은 세트의 흉상으로 바뀐다. 이미 표정이 있으면 두지 않는다. */
const EMOTIONS: readonly [RegExp, RegExp, string][] = [
  [/교단 광신도|광신도 설교자/, /!/, "angry"],
  [/^동문 문지기$/, /뭘 하는 거냐/, "angry"],
  [/^리노$/, /물러서라|압수품이다/, "angry"],
  [/^리사$/, /나가요|분명히 말했죠/, "angry"],
  [/^심문관 발렌$/, /깨어나라|부서져라/, "angry"],
  [/^심문관 발렌$/, /틀렸기를 바란다|그 집에 있었다/, "sad"],
  [/마르타$/, /제 창고/, "angry"],
  [/오스본$/, /나가게|분명히 일렀네/, "angry"],
  [/토마$/, /나가시오|내가 말했잖소/, "angry"],
  [/토마$/, /어이쿠/, "surprised"],
  [/토마$/, /반죽이 부풀었네/, "happy"],
  [/^대장장이 로한$/, /도둑 잡는 척/, "angry"],
  [/^대장장이 로한$/, /좀 더 다정하게/, "sad"],
  [/^엘레나$/, /이 별 무늬/, "surprised"],
  [/^이리스$/, /답이 왔어요/, "surprised"],
  [/^이리스$/, /고마워요/, "happy"],
  [/^이리스$/, /혼자 남는 건 싫어요|오늘 일도 지워져요/, "sad"],
  [/^꼬마 토비$/, /소원 빌었다|기계여도 돼|소원 들어준/, "happy"],
  [/^카엘$/, /겁먹었어/, "sad"],
  [/^천문대장 하넬$/, /손이 떨렸다/, "sad"],
];
function tagEmotions(project: Project): number {
  let n = 0;
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const list of eventLists(event)) for (const cmd of list) {
    const rec = cmd as unknown as { kind: string; speaker?: string; body?: string; emotion?: string };
    if (rec.kind !== "text" || !rec.speaker || rec.emotion) continue;
    const hit = EMOTIONS.find(([who, body]) => who.test(rec.speaker!) && body.test(rec.body ?? ""));
    if (hit) { rec.emotion = hit[2]; n += 1; }
  }
  return n;
}

// ── 2: 뛰노는 아이들 ─────────────────────────────────────────────────
function roadIds(project: Project, hub: GameMap): Set<number> {
  const ts = project.tilesets[hub.tilesetId] as unknown as { autotileGroups?: { id: string; memberTileIds: number[] }[]; tileGroups?: { id: string; tileIds: number[] }[] };
  return new Set<number>([
    ...(ts.autotileGroups?.find((g) => g.id === "beodeul_road_autotile")?.memberTileIds ?? []),
    ...(ts.tileGroups?.find((g) => g.id === "beodeul:plaza")?.tileIds ?? []),
  ]);
}
const DIR: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** 광장 가까이 길·풀밭을 한 바퀴 도는 큰 직사각형 고리(클수록 먼저). 문 앞·사람 곁·지붕 밑은 피한다. */
export function findLoop(project: Project, hub: GameMap, near: Cell): Cell[] | null {
  const doors = hub.events.filter((e) => JSON.stringify(e.pages ?? []).includes('"kind":"transfer"'));
  const open = (x: number, y: number): number => Object.values(DIR).filter(([dx, dy]) => isPassable(project, hub, x + dx, y + dy)).length;
  // 둘레 칸: 걸을 수 있고, 사람·수납이 서 있지 않고, 문 바로 앞이 아니다(안쪽은 집 한 채여도 된다 — 한 블록을 빙 돈다).
  const ok = (x: number, y: number): boolean => x >= 1 && y >= 1 && x < hub.width - 1 && y < hub.height - 1
    && isPassable(project, hub, x, y) && open(x, y) >= 2
    && !hub.events.some((e) => e.x === x && e.y === y)
    && !doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
  let best: { cells: Cell[]; score: number } | null = null;
  for (let w = 16; w >= 5; w -= 1) for (let h = Math.min(10, w); h >= 2; h -= 1) {
    if (w * h < 10) continue;
    for (let y0 = Math.max(1, near.y - 18); y0 <= near.y + 18; y0 += 1) for (let x0 = Math.max(1, near.x - 20); x0 <= near.x + 20; x0 += 1) {
      const ring: Cell[] = [];
      for (let x = x0; x < x0 + w; x += 1) ring.push({ x, y: y0 });
      for (let y = y0 + 1; y < y0 + h; y += 1) ring.push({ x: x0 + w - 1, y });
      for (let x = x0 + w - 2; x >= x0; x -= 1) ring.push({ x, y: y0 + h - 1 });
      for (let y = y0 + h - 2; y > y0; y -= 1) ring.push({ x: x0, y });
      if (!ring.every((c) => ok(c.x, c.y))) continue;
      // 한 블록을 빙 도는 고리(높이 셋 이상)를 길쭉한 왕복 띠보다, 긴 고리를 짧은 것보다, 가까운 것을 먼 것보다.
      const score = (h >= 3 ? -40 : 0) - ring.length + 0.5 * (Math.abs(x0 + w / 2 - near.x) + Math.abs(y0 + h / 2 - near.y));
      if (!best || score < best.score) best = { cells: ring, score };
    }
  }
  return best?.cells ?? null;
}

function addRunningKids(project: Project, hub: GameMap): Cell[] | null {
  const near = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_event`) ?? project.startPos ?? { x: 24, y: 24 };
  const ring = findLoop(project, hub, near);
  if (!ring) throw new Error("[fallen-star cast] 아이들이 뛸 고리를 찾지 못했다");
  const step = (a: Cell, b: Cell): string => Object.entries(DIR).find(([, [dx, dy]]) => a.x + dx === b.x && a.y + dy === b.y)![0];
  const moves = ring.map((c, i) => step(c, ring[(i + 1) % ring.length]!));
  const kids: [string, string, number, string, string][] = [
    ["kid_run_a", "tex_easyrpg_charset_people1", 1, "술래 아이", "잡았다…! 아니, 놓쳤다! 거기 서!"],
    ["kid_run_b", "tex_easyrpg_charset_people4", 0, "도망치는 아이", "약 오르지~ 별지기 형도 술래 할래?"],
    ["kid_run_c", "tex_easyrpg_charset_people5", 1, "도망치는 아이", "심문관님 갔다! 이제 뛰어도 돼!"],
  ];
  kids.forEach(([key, tex, index, name, line], k) => {
    const id = `ev_${FS_PREFIX}_${key}`;
    hub.events = hub.events.filter((e) => e.id !== id);
    const at = Math.round((k * ring.length) / kids.length) % ring.length;
    const route = [...moves.slice(at), ...moves.slice(0, at)].map((dir) => ({ kind: "move", dir }));
    const direction = moves[at] as "up" | "down" | "left" | "right";
    const hidden = { id: `${id}_p0`, name: "행렬 전(집 안)", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] };
    const play = {
      id: `${id}_p1`, name: `${name} · 술래잡기`, conditions: [{ kind: "switch", switchId: SW_VALEN_MARCHED, value: true }],
      graphic: { sprite: { type: "bundled", id: tex }, direction, pattern: charsetFrameIndex({ characterIndex: index, direction, pattern: 1 }) },
      trigger: { kind: "action" }, priority: "same", animationType: "normal",
      movement: { type: "custom", speed: 5, frequency: 5, route: { moves: route, repeat: true, skippable: false } },
      commands: [{ kind: "text", speaker: name, body: line }],
    };
    hub.events.push({ id, name, x: ring[at]!.x, y: ring[at]!.y, trigger: { kind: "action" }, commands: [], placementRole: "npc", pages: [hidden, play] } as unknown as GameEvent);
  });
  return ring;
}

// ── 3: 숨은 목걸이 ──────────────────────────────────────────────────
export const FS_DAWNWELL_NECKLACE = "equip_fs_dawnwell_necklace";

function ensureNecklace(project: Project): void {
  const list = project.database.equipment;
  if (list.some((e) => e.id === FS_DAWNWELL_NECKLACE)) return;
  const base = list.find((e) => e.id === "equip_necklace");
  const record = normalizeEquipmentRecord({
    ...(base ? JSON.parse(JSON.stringify(base)) as EquipmentRecord : {}),
    id: FS_DAWNWELL_NECKLACE,
    name: "새벽샘 별조각 목걸이",
    slot: "accessory",
    price: 0,
    description: "서른 해 전 새벽샘에 떨어진 별의 조각을 꿴 목걸이. 쥔 손에 별의 무게가 실린다 — 주는 피해 +30% · 치명타율 +10%.",
    statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
    criticalRate: 10,
    damageDealtPercent: 30,
    equippableActorIds: ["actor_hero", "actor_fs_elena", "actor_fs_iris"],
    equippableClassIds: [],
    cursed: false,
  } as EquipmentRecord);
  list.push(record);
}

/**
 * 길에서 가장 먼 막다른 칸(트인 쪽이 하나) — 집 뒤 골목 끝이나 울타리 구석. 상자 그림을 얹어도 다른 칸·문이 끊기지 않는 곳만.
 * 「먼」은 길(포석·광장)에서 걸어 들어가야 하는 걸음 수다.
 */
function placeHidden(project: Project, hub: GameMap, tile: number): Cell | null {
  const W = hub.width, H = hub.height;
  const roads = roadIds(project, hub);
  const doors = hub.events.filter((e) => JSON.stringify(e.pages ?? []).includes('"kind":"transfer"'));
  const meta = (project.tilesets[hub.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const pass = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && isPassable(project, hub, x, y);
  const reach = (): Set<string> => {
    const s = project.startPos ?? { x: 0, y: 0 };
    const seen = new Set<string>([`${s.x},${s.y}`]);
    const q: Cell[] = [s];
    while (q.length) {
      const c = q.shift()!;
      for (const [dx, dy] of Object.values(DIR)) {
        const nx = c.x + dx, ny = c.y + dy, k = `${nx},${ny}`;
        if (seen.has(k)) continue;
        const door = doors.some((d) => d.x === nx && d.y === ny);
        if (!door && !pass(nx, ny)) continue;
        seen.add(k);
        if (!door) q.push({ x: nx, y: ny });
      }
    }
    return seen;
  };
  const before = reach();
  // 길에서의 걸음 수(길 칸에서 시작하는 BFS).
  const dist = new Map<string, number>();
  const q: Cell[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (roads.has(hub.lowerTiles[y * W + x]!) && before.has(`${x},${y}`)) { dist.set(`${x},${y}`, 0); q.push({ x, y }); }
  while (q.length) {
    const c = q.shift()!;
    const d = dist.get(`${c.x},${c.y}`)!;
    for (const [dx, dy] of Object.values(DIR)) {
      const nx = c.x + dx, ny = c.y + dy, k = `${nx},${ny}`;
      if (dist.has(k) || !before.has(k) || !pass(nx, ny)) continue;
      dist.set(k, d + 1); q.push({ x: nx, y: ny });
    }
  }
  const candidates = [...dist].map(([k, d]) => { const [x, y] = k.split(",").map(Number) as [number, number]; return { x, y, d }; })
    .filter(({ x, y }) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1)
    .filter(({ x, y }) => Object.values(DIR).filter(([dx, dy]) => pass(x + dx, y + dy)).length === 1)
    .filter(({ x, y }) => (hub.upperTiles[y * W + x] ?? -1) < 0 && (hub.upperOverlayTiles?.[y * W + x] ?? -1) < 0)
    .filter(({ x, y }) => !/다리|물|바다|water/i.test(meta[hub.lowerTiles[y * W + x] ?? -1]?.label ?? ""))
    .filter(({ x, y }) => !hub.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 2))
    .sort((a, b) => b.d - a.d);
  for (const c of candidates) {
    const i = c.y * W + c.x;
    const old = hub.upperTiles[i]!;
    hub.upperTiles[i] = tile;
    const after = reach();
    const sideOpen = Object.values(DIR).some(([dx, dy]) => after.has(`${c.x + dx},${c.y + dy}`));
    if (sideOpen && doors.every((g) => !before.has(`${g.x},${g.y}`) || after.has(`${g.x},${g.y}`))
      && [...before].filter((k) => k !== `${c.x},${c.y}`).every((k) => after.has(k))) return { x: c.x, y: c.y };
    hub.upperTiles[i] = old;
  }
  return null;
}

function hiddenNecklace(project: Project, hub: GameMap): Cell | null {
  ensureNecklace(project);
  const spot = placeHidden(project, hub, 26606);
  if (!spot) throw new Error("[fallen-star cast] 목걸이를 숨길 구석을 찾지 못했다");
  const id = `ev_${FS_PREFIX}_cache_dawnwell`;
  const pg = (pid: string, name: string, conditions: Condition[], commands: Command[]): EventPage => ({
    id: pid, name, conditions, graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "same", trigger: { kind: "action" }, commands,
  } as unknown as EventPage);
  hub.events.push({
    id, name: "수납 · 이끼 낀 상자", x: spot.x, y: spot.y, trigger: { kind: "action" }, commands: [],
    pages: [
      pg(`${id}_p0`, "뒤지기", [], [
        { kind: "text", body: "골목 끝, 이끼가 덮인 상자다.\n못이 녹슬어 뚜껑이 쉽게 들린다." },
        { kind: "text", body: "기름 먹인 천에 싸인 목걸이 하나.\n작은 돌이 별빛처럼 희미하게 빛난다." },
        { kind: "text", body: "천에 바늘땀으로 「새벽샘」.\n서른 해 전, 별이 떨어진 마을의 이름이다." },
        { kind: "changeItem", itemId: FS_DAWNWELL_NECKLACE, op: "+=", amount: 1 },
        { kind: "text", body: "「새벽샘 별조각 목걸이」를 손에 넣었다." },
        { kind: "setSelfSwitch", key: "A", value: true },
      ] as unknown as Command[]),
      pg(`${id}_p1`, "빈 상자", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition], [
        { kind: "text", body: "이끼 낀 빈 상자다. 누가 여기 숨겨 두었을까." } as Command,
      ]),
    ],
  } as unknown as GameEvent);
  return spot;
}

/**
 * 얼굴 칸(shared-…-expressions-00)을 쓰는 화자의 표정 줄 — 런타임 대사 표정은 흉상·전신만 바꾸므로 그 줄 앞뒤에
 * 표정 칸 얼굴과 기본 칸 얼굴을 직접 끼운다. applySpeakerFaces 뒤에 부른다.
 */
export function applyFaceCellEmotions(project: Project): number {
  let n = 0;
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const list of eventLists(event)) {
    let face: (Command & { resourceId?: string }) | undefined;
    for (let i = 0; i < list.length; i += 1) {
      const cmd = list[i] as Command & { resourceId?: string; emotion?: string };
      if (cmd.kind === "changeFace") { face = cmd; continue; }
      if (cmd.kind !== "text" || !cmd.emotion || !face?.resourceId) continue;
      const m = /^(shared-.+-expressions)-00$/u.exec(face.resourceId);
      const cell = cmd.emotion ? CELL_OF_EMOTION[cmd.emotion] : undefined;
      if (!m || !cell) continue;
      list.splice(i, 0, { ...face, resourceId: `${m[1]}-${cell}` } as Command);
      list.splice(i + 2, 0, { ...face } as Command);
      i += 2;
      n += 1;
    }
  }
  return n;
}

/**
 * 숲은 마을 **북쪽**이다(2026-10-24 결정 — 마을의 숲 출구가 북쪽 성문이다). 예전 대사·읽을거리·의뢰 글·스위치 이름이 「동쪽 숲」
 * 「동문」이라 했던 것을 모두 북쪽으로 맞춘다. 이야기 파일들이 각자 문구를 들고 있어(여러 작업이 나눠 고친다) 맨 끝에 한 번 고친다.
 * 건드리지 않는 곳: 지하 입구 화로 퍼즐(fs_vault_gate — 「첫 불은 동쪽」은 화로 방향이다)·오프닝 연출(system 의 cinematic/presentation,
 * 오프닝 담당이 따로 고친다).
 */
const NORTH: readonly [RegExp, string][] = [
  [/동쪽 숲/g, "북쪽 숲"],
  [/동문/g, "북문"],
  [/동쪽은 이틀 안에/g, "북쪽은 이틀 안에"],
  // 렌즈가 가리키는 하늘탑도 북쪽이다 — 숲과 섞이지 않게 「숲 너머」로 못 박는다.
  [/북쪽이라… 옛 별지기들이 마지막으로 세운\n하늘탑이 그쪽에 있다\./g, "북쪽이라… 숲 너머 산맥 끝에, 옛 별지기들이\n마지막으로 세운 하늘탑이 있다."],
];
export function applyNorthForest(project: Project): number {
  let n = 0;
  const fix = (value: string): string => {
    let out = value;
    for (const [re, to] of NORTH) out = out.replace(re, to);
    if (out !== value) n += 1;
    return out;
  };
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return fix(node);
    if (Array.isArray(node)) { for (let i = 0; i < node.length; i += 1) node[i] = walk(node[i]); return node; }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "dataUrl" || k === "lowerTiles" || k === "upperTiles" || k === "lowerOverlayTiles" || k === "upperOverlayTiles") continue;
        (node as Record<string, unknown>)[k] = walk(v);
      }
    }
    return node;
  };
  for (const [id, map] of Object.entries(project.maps)) {
    if (id === "fs_vault_gate") continue;
    walk(map.events);
    map.name = fix(map.name);
  }
  walk(project.switches);
  walk(project.variables);
  walk((project as unknown as { quests?: unknown }).quests);
  walk(project.commonEvents);
  for (const list of [project.database.items, project.database.equipment]) walk(list);
  return n;
}

export type FallenTownCastResult = { kidsLoop: Cell[] | null; necklace: Cell | null; emotions: number };

export function applyFallenTownCast(project: Project): FallenTownCastResult {
  const hub = project.maps.fs_hub;
  if (!hub) throw new Error("[fallen-star cast] 광장 맵이 없다");
  recast(project);
  equipIris(project);
  const kidsLoop = addRunningKids(project, hub);
  const necklace = hiddenNecklace(project, hub);
  const emotions = tagEmotions(project);
  return { kidsLoop, necklace, emotions };
}
