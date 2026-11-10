// 조수 v2 — 사람(NPC) 빌더.
//
// 모델은 «누가·어디쯤·무슨 말»만 쓴다(PersonSpec). 칸 번호는 이 파일이 정한다:
//  - 자리 낱말(입구·광장·문 앞·…)을 실제로 걸어 닿는 칸으로 옮기고,
//  - 막힌 칸·문(이동) 칸·외길을 막는 칸은 후보에서 뺀 뒤,
//  - 놓은 칸을 막힌 칸으로 두고 길찾기를 다시 돌려 «전에 닿던 칸에 아직 다 닿는지» 확인한다.
// 놓기는 v1 place_npc, 그림은 graphic.query, 대사는 페이지(첫 만남 / 두 번째부터).
import type { Dir, GameEvent, GameMap, Project } from "@/project/types";
import { queryNpcGraphics } from "@/assets/charsetQuery";
import { sharedCharsetRow } from "@/project/sharedCharacterFaceResolver";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { activeMonsterTurn } from "@/project/genreLockMonsterAssets";
import { monsterAssetCatalogFilters } from "@/project/genreLockMonsterAssetsDiff";
import { genreLockCharsetCatalogFilter } from "@/project/genreLockCharsets";
import type { BuildRun, ContentBuildResult, PersonSpec } from "./types";
import { exitThroats, laneCells, wanderReach } from "./place/placementRules";
import { Cell, findMap, eventsOf, eventBlockers, walkStart, keepsMapConnected } from "./place/cells";
import { resolveWhere } from "./place/where";

export const PEOPLE_CARD =
  "People spec: {role,name?,where?,at?,looks?,firstTalk?,laterTalk?,movement?,mapId?}. " +
  "role = a role like 문지기 (gatekeeper) · 촌장 (village chief) · 상인 (merchant) (also used to pick art — villagers never get monster or skeleton art; chips with a matching face come first). looks = appearance words (경비병 guard · 노인 old man · 소녀 girl · old woman). " +
  "where words: 입구·성문 (entrance/gate — roadside where the road leaves the map, facing the road) / 광장·가운데 (square/center) / 문 앞 (in front of the door) / «X 옆·앞·뒤» (beside/in front of/behind X: counter, bar, fireplace, well — found by chipset labels) / " +
  "한쪽·벽 쪽 (one side/by the wall) / 북쪽 벽 (north wall; also 남·동·서) / 구석 (corner) / 창가 (by the window) — add a room word (홀 hall · 부엌 kitchen · 침실 bedroom) to stay inside that room («홀 한쪽», «부엌 화덕 옆») / omit (near the start point). English words (entrance, center, behind the counter) also work. " +
  "at:{x,y} only when really needed — a blocked cell moves to the nearest walkable cell. " +
  "firstTalk = lines the first time you talk (array), laterTalk = lines from the second time on (array; omit to repeat the same lines). " +
  "movement: still (default, stays put) · wander (roams — switched to still near exit throats or roads) · patrol (treated as still). " +
  "The builder picks only spots that do not block paths and checks them with pathfinding after placing. Never stand people in the middle of a road or rail track — sidewalk, inside a shop, bench, behind a counter or by a door. " +
  "Shopkeepers and clerks get where «카운터 뒤» (behind the counter) — they stand on the counter's north (owner) side; in front of the counter is the customer spot.";

// ───────────────────────── 그림 고르기 ─────────────────────────

// v1 charset 검색은 «경비병·문지기·촌장» 같은 역할 낱말을 모른다. 역할·외형 낱말을 아는 질의로 바꾸고, 후보 중에서
// 마을 사람에게 맞지 않는 그림(몬스터·언데드·해골 투구)을 빼고, 검토된 짝 얼굴이 있는 그림을 먼저 고른다
// (2026-10-23 v1/v2 눈가림 비교: v2 문지기가 해골 투구 갑옷(적처럼 읽힘)에 얼굴 없음).
const ROLE_LOOKS: ReadonlyArray<readonly [RegExp, readonly string[], ("male" | "female")?]> = [
  [/경비|문지기|수문장|파수|위병|보초|병사|군인|초병|guard|sentry|gatekeeper|soldier|watchman/i, ["병사", "guard"], "male"],
  [/촌장|이장|장로|원로|마을 ?어른|elder|chief|headman|mayor/i, ["할아버지", "노인"], "male"],
  // 청사진 단계 이름의 직함(2026-10-28 standin joseon·magic: 포졸·주모·종사관·교수·사서가 전부 「중년 남성 주민」이 됐다).
  [/포졸|포교|나졸|군졸|순라/i, ["병사", "guard"], "male"],
  [/종사관|사또|대감|양반|관원|나리|선비|영주|귀족|noble|lord/i, ["귀족", "노학자"], "male"],
  [/주모|여주인|안주인|주인댁/i, ["아줌마", "여관 주인"], "female"],
  [/교장|학장|headmaster|principal/i, ["교수", "노학자"]],
  [/교수|박사|학자|연구원|professor|scholar|researcher/i, ["교수", "노학자", "박사"]],
  [/사서|librarian/i, ["사서", "노학자"]],
  [/선생|교사|스승|teacher|tutor/i, ["선생", "교수"]],
  [/의사|doctor|medic/i, ["박사", "연구원"]],
  [/할머니|노파|old woman|grandma/i, ["할머니", "노인"], "female"],
  [/할아버지|노인|영감|old man|grandpa/i, ["할아버지", "노인"], "male"],
  [/여관|바텐더|술집 ?주인|주점 ?주인|innkeeper|bartender|barkeep/i, ["여관 주인", "상인"]],
  [/상인|장사|점원|가게|행상|merchant|shopkeeper|vendor|clerk|peddler/i, ["상인", "여관 주인"]],
  [/소녀|여자아이|girl/i, ["소녀", "아이"], "female"],
  [/소년|남자아이|boy/i, ["소년", "아이"], "male"],
  [/아이|꼬마|어린이|child|kid/i, ["아이"]],
  [/기사|knight|paladin/i, ["기사", "병사"]],
  [/마법사|마녀|wizard|mage|witch/i, ["마법사"]],
  [/신부|사제|수녀|성직자|priest|monk|nun|cleric/i, ["사제", "priest"]],
  [/왕|king/i, ["king"], "male"],
  [/농부|농사|farmer/i, ["아저씨", "주민"]],
  [/아주머니|아줌마|부인|여성|woman/i, ["아줌마", "여성"], "female"],
  [/아저씨|남성|man\b/i, ["아저씨", "남성"], "male"],
];
const HOSTILE = /몬스터|언데드|해골|스켈레톤|좀비|유령|악마|뱀파이어|오크|고블린|슬라임|마물|monster|undead|skeleton|zombie|ghost|demon|vampire|orc|goblin|slime/i;

const CHILD_LOOK = /아이|어린이|소년|소녀|꼬마|child|kid|boy|girl/iu;
const ODD_LOOK = /이국|터번|닌자|요정|난쟁이|수녀|해적|광대|ninja|fairy|dwarf|nun|pirate|clown/i;

interface PersonGraphic {
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly label: string;
  readonly faceResourceId?: string;
  readonly query: string;
}

/** 역할·외형 낱말 → v1 이 알아듣는 질의 순서(중복 제거, 마지막은 주민). */
function graphicQueries(looks: string | undefined, role: string | undefined): string[] {
  const out: string[] = [];
  const add = (q: string | undefined): void => {
    const t = (q ?? "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const word of [looks, role]) {
    add(word);
    for (const [re, alts] of ROLE_LOOKS) if (word && re.test(word)) for (const a of alts) add(a);
  }
  add("villager");
  return out;
}

function wantedGender(looks: string | undefined, role: string | undefined): "male" | "female" | undefined {
  for (const word of [looks, role]) for (const [re, , g] of ROLE_LOOKS) if (word && g && re.test(word)) return g;
  return undefined;
}

/** 이 맵 화풍에 맞는 칩 계열인가 — 판타지(버들항·손 도트 실내) 맵에는 EasyRPG 사람 칩, 현대 맵에는 현대 칩. */
function familyFits(map: GameMap, textureKey: string): boolean {
  const modern = /jp_|modern|city_modern|campus|school|office/i.test(map.tilesetId);
  const fantasyChip = /^tex_easyrpg_charset_(people|actor)|^tex_(oprn_charset_)?scarloxy_(charset_)?people/i.test(textureKey);
  return modern ? !fantasyChip : fantasyChip;
}

/**
 * 역할·외형에 맞는 «우호적인 사람» 칩 하나. 몬스터·언데드는 역할 자체가 그것일 때만, 짝 얼굴 있는 칩 먼저, 맵 화풍 계열 먼저,
 * 같은 맵에 이미 쓴 칩은 뒤로.
 */
export function pickPersonGraphic(project: Project, map: GameMap, role: string | undefined, looks: string | undefined): PersonGraphic | undefined {
  const asked = `${role ?? ""} ${looks ?? ""}`;
  const hostileOk = HOSTILE.test(asked);
  const gender = wantedGender(looks, role);
  const used = new Set<string>();
  for (const e of eventsOf(map)) {
    const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    if (g?.sprite?.id && typeof g.pattern === "number" && g.pattern >= 3) used.add(`${g.sprite.id}#${decodeCharsetFrameIndex(g.pattern).characterIndex}`);
  }
  // 주인공(시작 파티) 칩은 NPC 에 쓰지 않는다 — 2026-10-29 vm mystery: 용의자 「마부 한스」가 탐정 주인공과 같은 칩으로 서 있었다.
  const resKey = (s: string) => s.replace(/^tex_/u, "").replace(/[_-]/gu, "").toLowerCase();
  const heroes = new Set((project.system?.startActorIds ?? []).flatMap((id) => {
    const actor = project.database.actors.find((a) => a.id === id) as { characterResourceId?: string; characterIndex?: number } | undefined;
    return actor?.characterResourceId ? [`${resKey(actor.characterResourceId)}#${actor.characterIndex ?? 0}`] : [];
  }));
  const overrides = (project as unknown as { charsetLabels?: Parameters<typeof queryNpcGraphics>[2] }).charsetLabels;
  let best: (PersonGraphic & { score: number }) | undefined;
  // 장르 잠금(몬스터 수집·현대 연애)이 강제 중이면 허용 칩만 — 막힌 칩을 골라 place_npc 가 거부하던 길을 미리 막는다.
  const allowed = genreLockCharsetCatalogFilter(project);
  // 몬스터 수집 전용 칩(Scarloxy 트레이너·주민)은 몬스터 수집 게임이 아니면 고르지 않는다 — 도구 실행 구간 밖에서 부르면 카탈로그 필터가 없어
  // 그 칩이 뽑혔고, 뒤이은 upsert_event 가 «몬스터 수집 잠금»으로 거절돼 청사진 경로가 통째로 안 지어졌다(2026-11-10 worldProbe «촌장 하르»).
  const monsterOk = monsterAssetCatalogFilters(project, activeMonsterTurn())?.charset;
  const queries = graphicQueries(looks, role);
  // 다른 맵에서 이미 쓴 칩(게임 전체) — 같은 맵만큼은 아니어도 뒤로 민다(게임의 사람들이 서로 달라 보이게).
  const usedElsewhere = new Set<string>();
  for (const other of Object.values(project.maps)) {
    if (other.id === map.id) continue;
    for (const e of eventsOf(other)) {
      const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
      if (g?.sprite?.id && typeof g.pattern === "number" && g.pattern >= 3) usedElsewhere.add(`${g.sprite.id}#${decodeCharsetFrameIndex(g.pattern).characterIndex}`);
    }
  }
  // 마지막 질의(«villager» — 역할 낱말을 못 알아들었거나 알아들은 칩이 이 맵에 안 맞을 때의 기본)는 이름으로 사람 칩을 돌려 고른다 — 순위 1등 고정이면 «족장 바라»·«무당 누리»·«동굴 지기 아루»가
  // 모두 같은 「중년 남성 주민」으로 섰다(2026-11-10 Terra fun-w2: 사람 다섯이 한 얼굴).
  const nameHash = [...asked.trim()].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  queries.forEach((q, qi) => {
    // 이름으로 돌려 고를 때는 주민 한 줄(«villager» 4명)이 아니라 사람 칩 전체(«마을 사람»)에서 고른다.
    const spin = qi === queries.length - 1;
    const wide = spin ? queryNpcGraphics("마을 사람", 60, overrides) : [];
    const matches = wide.length >= 8 ? wide : queryNpcGraphics(q, 30, overrides);
    const rotate = spin && matches.length > 1 ? nameHash % matches.length : 0;
    matches.forEach((m, rank0) => {
      const rank = rotate ? (rank0 - rotate + matches.length) % matches.length : rank0;
      const e = m.entry;
      const text = `${e.label} ${e.tags.join(" ")} ${e.textureKey}`;
      // 「몬스터 수집」 장르 꼬리표가 붙은 사람 칩(Scarloxy 트레이너·주민)은 적이 아니다 — 그 낱말을 빼고 적 낱말을 본다.
      const hostileText = text.replace(/몬스터 ?수집|monster[- ]?collect(ion|ing)?/giu, "");
      if (!hostileOk && (HOSTILE.test(hostileText) || /monster/i.test(e.textureKey))) return;
      if (allowed && !allowed(e)) return;
      if (monsterOk && !monsterOk(e)) return;
      const row = sharedCharsetRow(e.textureKey, e.characterIndex);
      const face = row?.status === "mapped" && row.faceResourceId ? row.faceResourceId : undefined;
      const key = `${e.textureKey}#${e.characterIndex}`;
      // 맵 화풍과 다른 계열은 얼굴 짝(70)보다 무겁게 친다 — 현대 편의점 점장이 얼굴 있는 판타지 RTP 주민 칩으로 뽑혔고, 첫 사람 칩이라 사람 칩 잠금이
      // RTP 로 걸려 뒤이은 행인의 현대 칩 검색(여학생)이 0 개가 됐다(2026-10-31 asst-parity 마왕 편의점 opus 후).
      const score = qi * 100 + rank + (face ? 0 : 70) + (familyFits(map, e.textureKey) ? 0 : 120)
        + (gender && e.gender && e.gender !== "none" && e.gender !== gender ? 25 : 0) + (used.has(key) ? 15 : usedElsewhere.has(key) ? 8 : 0)
        + (heroes.has(`${resKey(e.textureKey)}#${e.characterIndex}`) ? 300 : 0)
        // 특이한 차림(이국 터번·닌자·요정·난쟁이·수녀)은 그렇게 말했을 때만 — 마을 촌장이 터번 노인으로 나왔다.
        + (ODD_LOOK.test(text) && !ODD_LOOK.test(asked) ? 20 : 0)
        // 아이 칩은 아이라고 했을 때만 — 이름으로 돌려 고르다 «족장 바라» 가 남자아이로 서지 않게.
        + (CHILD_LOOK.test(e.label) && !CHILD_LOOK.test(asked) ? 40 : 0);
      if (!best || score < best.score) best = { textureKey: e.textureKey, characterIndex: e.characterIndex, label: e.label, query: q, score, ...(face ? { faceResourceId: face } : {}) };
    });
  });
  if (!best) return undefined;
  const { score: _score, ...pick } = best;
  return pick;
}

/** 놓은 NPC 의 모든 페이지 그림을 그 방향으로 돌려 세운다(문지기는 길 쪽을 본다). */
function faceNpc(run: BuildRun, mapId: string, eventId: string, dir: Dir): void {
  const map = findMap(run.ctx.project, mapId);
  const event = map ? eventsOf(map).find((e) => e.id === eventId) : undefined;
  (event?.pages ?? []).forEach((page, pageIndex) => {
    const g = page.graphic as { sprite?: unknown; pattern?: number; direction?: Dir } | undefined;
    if (!g?.sprite) return;
    const characterIndex = typeof g.pattern === "number" && g.pattern >= 3 ? decodeCharsetFrameIndex(g.pattern).characterIndex : 0;
    run.call("patch_event_page", { mapId, eventId, pageIndex, set: { graphic: { ...g, direction: dir, pattern: charsetFrameIndex({ characterIndex, direction: dir, pattern: 1 }) } } });
  });
}

// ───────────────────────── 사람 놓기 ─────────────────────────

function cleanLines(lines: readonly string[] | undefined): string[] {
  return (lines ?? []).map((s) => String(s).trim()).filter(Boolean);
}

/**
 * place_npc 한 번: 역할·외형에 맞는 우호적 사람 칩(짝 얼굴 우선)을 골라 {textureKey,characterIndex} 로 놓는다 — 대사가 있으면
 * place_npc 가 그 칩의 검토된 짝 얼굴을 대사 앞에 붙인다. 고른 칩으로 실패하면 질의 낱말 → 도구 기본 그림 순서로 물러난다.
 */
export function placeNpcWithGraphic(run: BuildRun, map: GameMap, baseArgs: Record<string, unknown>, role: string | undefined, looks: string | undefined, label: string, warnings: string[]): { result: ReturnType<BuildRun["call"]>; graphic?: PersonGraphic } {
  const graphic = pickPersonGraphic(run.ctx.project, map, role, looks);
  if (graphic) {
    const result = run.call("place_npc", { ...baseArgs, graphic: { textureKey: graphic.textureKey, characterIndex: graphic.characterIndex } });
    if (result.ok) {
      if (!graphic.faceResourceId) warnings.push(`${label}: 고른 그림 '${graphic.label}' 에 검토된 짝 얼굴이 없어 대화창에 얼굴이 안 나온다.`);
      return { result, graphic };
    }
  } else warnings.push(`${label}: 역할·외형(${[role, looks].filter(Boolean).join("·")})에 맞는 사람 그림을 못 찾았다.`);
  let result: ReturnType<BuildRun["call"]> | undefined;
  for (const q of graphicQueries(looks, role)) {
    result = run.call("place_npc", { ...baseArgs, graphic: { query: q } });
    if (result.ok) { warnings.push(`${label}: 그림을 질의 '${q}' 로 놓았다(직접 고르기 실패).`); return { result }; }
  }
  result = run.call("place_npc", baseArgs);
  if (result.ok) warnings.push(`${label}: 그림을 못 골라 도구 기본 그림으로 놓았다.`);
  return { result };
}

export function buildPeople(run: BuildRun, people: readonly PersonSpec[], mapId?: string): ContentBuildResult {
  const warnings: string[] = [];
  const eventIds: { mapId: string; eventId: string }[] = [];
  const mapIds = new Set<string>();
  const used: Cell[] = [];
  const notes: string[] = [];
  const firstCall = run.calls.length;
  let failed = 0;

  for (const person of people) {
    const targetMapId = person.mapId ?? mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
    const label = person.name ?? person.role;
    const map = findMap(run.ctx.project, targetMapId);
    if (!map) {
      warnings.push(`${label}: 맵 '${targetMapId}' 이 없다.`);
      failed++;
      continue;
    }
    // 이미 이 맵에 같은 이름의 NPC 가 있으면 새로 세우지 않는다(2026-10-24 스위트: 대장장이 그림이 바뀌고 촌장이 둘이 됐다).
    //   그림·얼굴·자리는 그대로 두고, 대사를 준 경우에만 첫 페이지의 대사를 바꾼다(얼굴 명령은 남김).
    const existing = person.name ? eventsOf(map).find((e) => (e.name ?? "").trim().toLowerCase() === person.name!.trim().toLowerCase()) : undefined;
    if (existing && existing.pages?.length) {
      const lines = [...cleanLines(person.firstTalk), ...cleanLines(person.laterTalk)];
      if (lines.length) {
        const p0 = existing.pages[0]!;
        const keep = (p0.commands ?? []).filter((c) => (c as { kind?: string }).kind !== "text");
        const firstPage = { ...structuredClone(p0), commands: [...structuredClone(keep), ...lines.map((body) => ({ kind: "text", speaker: existing.name, body }))] };
        const up = run.call("upsert_event", { mapId: targetMapId, replacePages: true, event: { id: existing.id, pages: [firstPage, ...existing.pages.slice(1).map((pg) => structuredClone(pg))] } });
        if (!up.ok) warnings.push(`${label}: 기존 NPC 대사 고치기 실패 — ${String(up.summary).slice(0, 160)}`);
      }
      eventIds.push({ mapId: targetMapId, eventId: existing.id });
      mapIds.add(targetMapId);
      notes.push(`${label} — 이미 있는 NPC(${existing.id}) 를 그대로 씀(그림·자리 유지${lines.length ? ", 대사만 바꿈" : ""})`);
      continue;
    }
    // 바깥 맵에서는 같은 부름의 사람끼리 바로 옆에 붙여 세우지 않는다(마을 광장에 둘이 겹쳐 선 줄처럼 보였다) — 실내는 바 앞 손님처럼 붙어도 된다.
    const outdoor = (map as unknown as { climate?: { mode?: string } }).climate?.mode !== "indoor";
    const avoid = outdoor ? used.flatMap((c) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: c.x + dx, y: c.y + dy })))) : used;
    // at {x:0,y:0} 은 모델이 빈 칸을 채운 자리표시다(2026-10-29 room-vig6 tavern: 셋 다 at (0,0) → 맵 왼쪽 위에서 가장 가까운 칸 (6,4)·(7,4)·(6,5) 에 몰렸다).
    // (0,0) 은 어느 맵에서나 벽·가장자리 칸이라 진짜 자리로 쓰지 않는다 — 자리 낱말(where)로 푼다.
    const at = person.at && !(person.at.x === 0 && person.at.y === 0) ? person.at : undefined;
    const where = resolveWhere(run.ctx.project, map, person.where, { at, avoid, role: `${person.role} ${person.name ?? ""}` });
    if (where.note) warnings.push(`${label}: ${where.note}`);
    const cell = where.cell;

    const first = cleanLines(person.firstTalk);
    const later = cleanLines(person.laterTalk);
    const pages: Record<string, unknown>[] = [];
    if (first.length > 0 && later.length > 0) {
      pages.push({ name: "첫 만남", lines: first, commands: [{ kind: "setSelfSwitch", key: "A", value: true }] });
      pages.push({ name: "다시 말 걸면", lines: later, conditions: [{ kind: "selfSwitch", key: "A", value: true }] });
    } else if (first.length > 0 || later.length > 0) {
      pages.push({ name: "대화", lines: first.length > 0 ? first : later });
    }

    let movement = person.movement === "wander" ? "random" : "fixed";
    if (movement === "random") {
      // 배회가 닿는 칸에 하나뿐인 출구 길목·차도가 있으면 제자리로 — 마을 동쪽 외길 출구에서 농부가 배회해 길을 막았다(2026-10-25 J5).
      const roam = wanderReach(run.ctx.project, map, { id: "__new__", x: cell.x, y: cell.y, pages: [] } as unknown as GameEvent);
      const throats = exitThroats(run.ctx.project, map);
      const lanes = laneCells(run.ctx.project, map);
      const hit = [...roam].find((i) => throats.has(i) || lanes.has(i));
      if (hit !== undefined) {
        movement = "fixed";
        warnings.push(`${label}: 배회하면 ${throats.has(hit) ? "하나뿐인 출구 길목" : "차도·선로"} (${hit % map.width},${Math.floor(hit / map.width)})까지 걸어가 길을 막을 수 있어 제자리(still)로 두었다.`);
      } else warnings.push(`${label}: wander 는 걸어 다니다 길목에 설 수 있어 «길을 막지 않는다» 보장이 약해진다.`);
    }
    if (person.movement === "patrol") warnings.push(`${label}: patrol 은 v1 에 순찰 경로 도구가 없어 제자리(fixed)로 두었다.`);

    const baseArgs: Record<string, unknown> = { mapId: targetMapId, name: label, x: cell.x, y: cell.y, movement };
    if (pages.length > 0) baseArgs.pages = pages;
    const placedNpc = placeNpcWithGraphic(run, map, baseArgs, person.role, person.looks, label, warnings);
    const result = placedNpc.result;
    if (!result.ok) {
      warnings.push(`${label}: 놓기 실패 — ${String(result.summary).slice(0, 160)}`);
      failed++;
      continue;
    }
    for (const w of result.warnings ?? []) warnings.push(`${label}: ${w}`);
    const data = (result.data ?? {}) as { eventId?: string; x?: number; y?: number; adjusted?: boolean };
    const placed = { x: data.x ?? cell.x, y: data.y ?? cell.y };
    used.push(placed);
    mapIds.add(targetMapId);
    if (data.eventId) eventIds.push({ mapId: targetMapId, eventId: data.eventId });
    if (data.eventId && where.face) faceNpc(run, targetMapId, data.eventId, where.face);
    notes.push(`${label} (${placed.x},${placed.y})${where.how ? ` ${where.how}` : ""} · 그림 ${placedNpc.graphic ? `${placedNpc.graphic.label}${placedNpc.graphic.faceResourceId ? "+얼굴" : "(짝 얼굴 없음)"}` : "도구 기본"}${where.face ? ` · ${where.face} 를 봄` : ""}`);

    // 놓은 뒤 확인: 이 NPC 칸을 막고도 전에 닿던 칸에 다 닿는가.
    const after = findMap(run.ctx.project, targetMapId);
    if (after && movement === "fixed") {
      const blockers = eventBlockers(after);
      blockers.delete(placed.y * after.width + placed.x);
      const start = walkStart(run.ctx.project, after);
      if (!keepsMapConnected(run.ctx.project, after, start, placed, blockers)) {
        warnings.push(`${label}: (${placed.x},${placed.y}) 에 놓고 보니 길을 막는다 — 도구가 칸을 옮겼을 수 있다. 자리를 다시 정해야 한다.`);
      }
    }
  }

  const ok = failed === 0 && eventIds.length > 0;
  return {
    ok,
    mapIds: [...mapIds],
    summary: ok
      ? `사람 ${eventIds.length}명 놓음: ${notes.join(" / ")}`
      : `사람 ${people.length}명 중 ${failed}명 실패`,
    warnings,
    missingArt: [],
    calls: run.calls.slice(firstCall),
    eventIds,
  };
}
