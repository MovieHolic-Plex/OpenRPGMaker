// 조수 v2 출하 기본값 채우기 — 싼 모델이 끝내 못 고쳐 출하가 막히거나 경고만 남는 출하 검사 여섯(2026-10-29 vm1 측정):
// battle-bgm · battle-background · party-faces · hero-look · ending-closure · default-place-leak.
//
// 왜: flash 판은 도구를 틀리게 부르거나 아예 부르지 않아 같은 막힘이 끝까지 남았다(vm1 flash/jrpg: 전투 곡·전투 배경·주인공 칩·
// 얼굴이 편집기 기본, 엔딩은 청사진 how 한 줄, 제목·엔딩이 기본 칩셋 이름 「버들항」). 고르는 규칙이 이미 있는 것은 그 규칙으로
// 결정적으로 채운다 — 무엇이 남았는지는 출하 검사 함수 자체(shipChecks)로 판단해 검사와 채우기가 어긋나지 않게 한다.
//
// 규칙: 저작자(사람·조수)가 고른 값은 덮지 않는다. 출하 검사가 «기본값이 남았다»고 짚는 항목만 바꾼다. 새 그림·곡은 만들지 않는다.
// 끝맺음 조립(assistantV2Runtime autoBuild, applyBlueprintAssembly 뒤)에서 게임 하나를 만드는 요청일 때만 부른다. 같은 프로젝트에
// 두 번 불러도 결과가 같다(두 번째는 바꿀 것이 없다).
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { findNpcGraphicMatches, queryNpcGraphics } from "@/assets/charsetQuery";
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import { climateBattleBackground, dungeonBattleBackground, interiorBattleBackground, placeNameBattleBackground } from "@/battle/battleBackdrop";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { createBlankProject } from "@/project/defaults";
import { blueprintPlaceName, pickTitleArtForStory, blueprintPremiseText, blueprintStoryText } from "@/project/blueprintAssembly";
import { sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import type { Project } from "@/project/types";
import { defaultPlaceLeaks, editorDefaultsLeft, endingClosureProblems, endingConditionsUnset, writtenStateIds } from "./shipChecks";
import { doorCellBlocked, offArtEntrances, planObjective, staleMilestoneTargets } from "./discoverability";
import { normalizeGameOverSettings } from "@/project/cinematicSettings";

type Obj = Record<string, unknown>;

let factoryCache: Project | undefined;
const factory = (): Project => (factoryCache ??= createBlankProject() as Project);

/** 출하 기본값을 채운다. 바꾼 항목 설명을 돌려준다(없으면 빈 배열). task 는 실행 지시문(앞선 요청 메모 포함). */
export function applyShipDefaults(project: Project, task = project.gameBlueprint?.request ?? ""): string[] {
  const applied: string[] = [];
  const left = new Set(editorDefaultsLeft(project).map((b) => b.id));
  if (left.has("battle-bgm")) applied.push(...fillBattleBgm(project));
  if (left.has("battle-background")) applied.push(...fillBattleBackgrounds(project, editorDefaultsLeft(project).find((b) => b.id === "battle-background")?.evidence ?? ""));
  if (left.has("hero-look") || left.has("party-faces")) applied.push(...fillPartyLooks(project));
  // 이름은 모습 뒤(고른 칩의 성별로 이름을 고른다), 엔딩 맺음 앞(맺음 글이 새 이름을 쓴다).
  if (left.has("party-names")) applied.push(...fillPartyNames(project));
  if (left.has("window-look")) applied.push(...fillWindowLook(project));
  if (left.has("game-over")) applied.push(...fillGameOver(project));
  if (offArtEntrances(project).length) applied.push(...moveEntrancesOntoArt(project));
  if (staleMilestoneTargets(project).length) applied.push(...fillStaleObjectives(project));
  if (endingConditionsUnset(project).length) applied.push(...dropDeadEndingConditions(project));
  if (endingClosureProblems(project).length) applied.push(...fillEndingClosure(project));
  // 기본 지명 걷어내기는 엔딩 글을 채운 뒤에 — 채운 글(청사진 느낌 칸)에도 그 지명이 들 수 있다.
  applied.push(...removeDefaultPlaceWords(project, task));
  return applied;
}

// ── 전투 곡 ─────────────────────────────────────────────────────────────

const BATTLE_MUSIC = /전투|battle|보스|boss|결전/iu;
const NOT_BATTLE_LOOP = /승리|종료|end of battle|jend|victory|fanfare|팡파레|전투 전|준비/iu;
const DARK_PREMISE = /마왕|공포|호러|암흑|어둠|저주|괴물|결전|horror|demon/iu;
const DARK_MUSIC = /어둡|묵직|긴장|위협|시네마틱|오케스트라|보스|결전/u;

/**
 * 전투 곡: 이 프로젝트에서 실제로 재생되는 음악 목록(listAudioResources — 런타임·도구가 쓰는 같은 목록)의 전투 곡 중 편집기 기본이 아닌 것.
 * 어두운 이야기(마왕·공포)는 어둡고 묵직한 곡, 아니면 그 밖의 곡을 먼저. 같은 프로젝트 → 같은 곡.
 */
function fillBattleBgm(project: Project): string[] {
  const fallback = String((factory().system as unknown as Obj).battleBgmResourceId ?? "");
  const premise = project.gameBlueprint ? blueprintPremiseText(project, project.gameBlueprint) : `${project.meta.title ?? ""}`;
  const dark = DARK_PREMISE.test(premise);
  const candidates = listAudioResources("music", project)
    .filter((r) => r.id !== fallback && BATTLE_MUSIC.test(`${r.id} ${r.name} ${r.tags.join(" ")}`) && !NOT_BATTLE_LOOP.test(`${r.id} ${r.name} ${r.tags.join(" ")}`))
    .map((r, order) => {
      const text = `${r.name} ${r.tags.join(" ")} ${r.description}`;
      // EasyRPG 곡은 마지막(오리지널 CC0 곡이 먼저), 이야기 분위기와 곡 분위기가 맞으면 앞.
      const score = (r.id.startsWith("easyrpg-") ? 0 : 4) + (DARK_MUSIC.test(text) === dark ? 2 : 0) - order / 1000;
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);
  const pick = candidates[0]?.r;
  if (!pick) return [];
  project.system.battleBgmResourceId = pick.id;
  return [`전투 곡 ${fallback} → ${pick.id}(${pick.name})`];
}

// ── 전투 배경 ───────────────────────────────────────────────────────────

/** 청사진 단계 순서로 이 맵 바로 앞 단계의 장소 맵들(장소는 맵 id 또는 맵 이름). */
function blueprintPredecessors(project: Project, mapId: string): string[] {
  const steps = project.gameBlueprint?.steps ?? [];
  const map = project.maps[mapId];
  const matches = (place: string) => Object.values(project.maps).filter((m) => m.id === place || (!!m.name?.trim() && m.name.trim() === place.trim())).map((m) => m.id);
  const out: string[] = [];
  for (let i = 1; i < steps.length; i += 1) {
    const here = steps[i]!.place;
    if (here !== mapId && map?.name?.trim() !== here.trim()) continue;
    for (const id of matches(steps[i - 1]!.place)) if (id !== mapId) out.push(id);
  }
  return out;
}

/** 들어오는 길을 거꾸로 따라(가까운 것부터) 처음 만나는 던전·동굴 맵의 배경. 없으면 undefined. */
function nearestDungeonAncestor(project: Project, mapId: string): string | undefined {
  const seen = new Set([mapId]);
  let frontier = [mapId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) for (const from of [...entranceSources(project, id), ...blueprintPredecessors(project, id)].sort()) {
      if (seen.has(from)) continue;
      seen.add(from);
      const own = project.maps[from]?.battleBackground;
      if (own === "battle-scenery-cave") return own;
      const dungeon = dungeonBattleBackground(project, from);
      if (dungeon) return dungeon;
      next.push(from);
    }
    frontier = next;
  }
  return undefined;
}

/**
 * 전투가 나는데 배경을 안 정한 맵에 런타임이 고를 배경을 맵 값으로 적는다 — resolveBattleBackdrop 의 맵 단계와 같은 순서
 * (기후 → 던전·동굴 → 장소 이름 → 실내 칩셋 → 숲). 지형 태그 배경은 런타임에서 맵 값보다 앞서므로 그대로 이긴다.
 */
function runtimeMapBackground(project: Project, mapId: string): string | undefined {
  return climateBattleBackground(project, mapId) ?? dungeonBattleBackground(project, mapId) ?? placeNameBattleBackground(project, mapId)
    ?? interiorBattleBackground(project, mapId);
}

/** 이 맵으로 들어오는 이동 명령(transfer)이 있는 다른 맵들 — 맵 id 순서. */
function entranceSources(project: Project, mapId: string): string[] {
  const out = new Set<string>();
  const visit = (node: unknown, from: string, depth = 0): void => {
    if (depth > 24 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) visit(item, from, depth + 1); return; }
    const o = node as Obj;
    if (o.kind === "transfer" && o.mapId === mapId && from !== mapId) out.add(from);
    for (const value of Object.values(o)) if (value && typeof value === "object") visit(value, from, depth + 1);
  };
  for (const map of Object.values(project.maps).sort((a, b) => a.id.localeCompare(b.id))) visit(map.events ?? [], map.id);
  return [...out];
}

/**
 * 전투가 나는데 배경을 안 정한 맵에 런타임이 고를 배경을 맵 값으로 적는다 — resolveBattleBackdrop 의 맵 단계와 같은 순서
 * (기후 → 던전·동굴 → 장소 이름 → 실내 칩셋). 그 단계가 아무것도 못 고르는 맵(「마왕의 방」)은 들어오는 길(이동 명령 + 청사진 단계 순서)을 거꾸로 따라
 * 가장 가까운 던전·동굴 조상의 배경, 없으면 바로 들어오는 맵의 배경, 그것도 없으면 런타임 기본(숲). 지형 태그 배경은 런타임에서 맵 값보다 앞서므로 그대로 이긴다.
 */
function fillBattleBackgrounds(project: Project, evidence: string): string[] {
  const out: string[] = [];
  for (const mapId of [...new Set(evidence.split(",").map((s) => s.trim()).filter(Boolean))]) {
    const map = project.maps[mapId];
    if (!map || map.battleBackground) continue;
    // 맵 그래프(이동 명령 + 청사진 단계 순서)를 거꾸로 따라 가장 가까운 던전·동굴 조상 — 「마왕의 방」은 「마왕의 동굴」 안쪽이다.
    const ancestor = nearestDungeonAncestor(project, mapId);
    const sources = entranceSources(project, mapId).map((from) => project.maps[from]?.battleBackground ?? runtimeMapBackground(project, from)).filter((id): id is string => !!id);
    const inherited = ancestor ?? sources[0];
    const id = runtimeMapBackground(project, mapId) ?? inherited ?? DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
    map.battleBackground = id;
    out.push(`전투 배경 ${map.name || mapId} → ${id}`);
  }
  return out;
}

// ── 파티 모습·얼굴 ───────────────────────────────────────────────────────

const FEMALE = /소녀|여자|여성|그녀|아가씨|공주|여학생|언니|누나|딸|어머니|엄마|할머니|여왕|마녀|무녀|수녀/u;
/** 이야기 낱말 → 공용 캐릭터 칩 검색어(남·여 순서). 짝 얼굴이 검토된 칩만 고른다. */
const ROLE_QUERIES: readonly { readonly re: RegExp; readonly male: readonly string[]; readonly female: readonly string[] }[] = [
  { re: /마법사|마도|마녀|마법/u, male: ["청년 남성"], female: ["젊은 여성 마법사", "젊은 여성"] },
  { re: /기사|병사|검사|전사|용사|마왕|모험|판타지|던전|RPG/iu, male: ["청년 전사", "청년 병사", "청년 남성"], female: ["젊은 여성 마법사", "젊은 여성"] },
  { re: /소녀|아이|어린/u, male: ["소년", "청년 남성"], female: ["어린 소녀", "여자아이"] },
];
const DEFAULT_QUERIES = { male: ["청년 남성", "파란 머리 청년"], female: ["젊은 여성", "청년 남성"] } as const;

interface ChipPick { readonly resourceId: string; readonly index: number; readonly label: string; readonly face?: string }

function pickChip(text: string, avoid: ReadonlySet<string>, overrides: Project["charsetLabels"]): ChipPick | undefined {
  const female = FEMALE.test(text);
  const role = ROLE_QUERIES.find((r) => r.re.test(text));
  const queries = [...(role ? (female ? role.female : role.male) : []), ...(female ? DEFAULT_QUERIES.female : DEFAULT_QUERIES.male)];
  for (const query of queries) {
    for (const match of queryNpcGraphics(query, 12, overrides)) {
      const asset = findCharsetAsset(match.entry.textureKey);
      if (!asset) continue;
      const key = `${asset.id}#${match.entry.characterIndex}`;
      if (avoid.has(key)) continue;
      const face = sharedFaceForCharset(match.entry.textureKey, match.entry.characterIndex)?.resourceId;
      if (!face) continue; // 짝 얼굴이 검토된 칩만 — 모습과 얼굴이 같은 인물이어야 한다.
      return { resourceId: asset.id, index: match.entry.characterIndex, label: match.entry.label, face };
    }
  }
  return undefined;
}

/**
 * 시작 파티 중 편집기 기본 칩·기본 얼굴이 남은 인물: 이름·청사진 이야기(장르·제목·목표·요청)로 공용 칩을 고르고 그 칩의 검토된 짝 얼굴을 준다.
 * 모델이 고른 칩은 두고 얼굴만 기본이면 그 칩의 짝 얼굴, 짝이 없으면 얼굴을 비운다(다른 인물 얼굴을 붙이지 않는다).
 */
function fillPartyLooks(project: Project): string[] {
  const f = factory();
  const fActors = new Map(f.database.actors.map((a) => [a.id, a]));
  const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  const premise = project.gameBlueprint ? blueprintPremiseText(project, project.gameBlueprint) : String(project.meta.title ?? "");
  const used = new Set<string>([...f.database.actors.filter((a) => (project.system.startActorIds ?? []).includes(a.id)).map((a) => `${a.characterResourceId}#${a.characterIndex ?? 0}`),
    ...party.map((a) => `${a.characterResourceId}#${a.characterIndex ?? 0}`)]);
  const out: string[] = [];
  for (const actor of party) {
    const fa = fActors.get(actor.id);
    if (!fa) continue;
    const lookDefault = fa.characterResourceId === actor.characterResourceId && (fa.characterIndex ?? 0) === (actor.characterIndex ?? 0);
    const faceDefault = !!actor.faceResourceId && fa.faceResourceId === actor.faceResourceId;
    if (lookDefault) {
      const nickname = actor.nickname && actor.nickname !== "없음" ? actor.nickname : "";
      const pick = pickChip(`${actor.name} ${nickname} ${premise}`, used, project.charsetLabels);
      if (pick) {
        actor.characterResourceId = pick.resourceId;
        actor.characterIndex = pick.index;
        used.add(`${pick.resourceId}#${pick.index}`);
        const faceNote = faceDefault || !actor.faceResourceId ? (actor.faceResourceId = pick.face, ` + 짝 얼굴 ${pick.face}`) : "";
        out.push(`${actor.name} 모습 → ${pick.label}(${pick.resourceId}#${pick.index})${faceNote}`);
        continue;
      }
    }
    if (faceDefault) {
      const paired = sharedFaceForCharset(actor.characterResourceId ?? "", actor.characterIndex ?? 0)?.resourceId;
      if (paired && paired !== fa.faceResourceId) { actor.faceResourceId = paired; out.push(`${actor.name} 얼굴 → 지금 칩의 짝 얼굴 ${paired}`); }
      else if (!lookDefault) { delete (actor as { faceResourceId?: string }).faceResourceId; out.push(`${actor.name} 얼굴 비움(지금 칩에 검토된 짝 얼굴이 없다)`); }
    }
  }
  return out;
}

// ── 파티 이름 · 창 모양 · 게임 오버 · 입구 그림 ──────────────────────────────

const MALE_NAMES = ["도윤", "하람", "이안", "시온", "태오", "라온"] as const;
const FEMALE_NAMES = ["서린", "유하", "아린", "하은", "소이", "나래"] as const;
const hashText = (text: string): number => { let h = 2166136261; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * 시작 파티 중 편집기 기본 이름(「주인공」)이 남은 인물에 이름을 준다 — 칩 이름표·이야기 낱말이 여성을 말하면 여성 이름, 아니면 남성 이름에서
 * 청사진 제목+인물 id 해시로 하나. 프로젝트의 다른 인물·이벤트 이름과 겹치는 이름은 건너뛴다.
 */
function fillPartyNames(project: Project): string[] {
  const f = factory();
  const fActors = new Map(f.database.actors.map((a) => [a.id, a]));
  const taken = new Set<string>([...project.database.actors.map((a) => a.name.trim()), ...Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => String(e.name ?? "").trim()))]);
  const seed = project.gameBlueprint?.title ?? project.meta.title ?? "";
  const out: string[] = [];
  for (const id of project.system.startActorIds ?? []) {
    const actor = project.database.actors.find((a) => a.id === id);
    if (!actor || fActors.get(id)?.name !== actor.name) continue;
    const chip = sharedChipLabel(actor.characterResourceId ?? "", actor.characterIndex ?? 0);
    const premise = project.gameBlueprint ? blueprintPremiseText(project, project.gameBlueprint) : "";
    const pool = FEMALE.test(`${chip} ${premise}`) ? FEMALE_NAMES : MALE_NAMES;
    const start = hashText(`${seed}|${id}`) % pool.length;
    const name = Array.from({ length: pool.length }, (_, i) => pool[(start + i) % pool.length]!).find((n) => !taken.has(n));
    if (!name) continue;
    out.push(`${actor.name} 이름 → ${name}`);
    actor.name = name;
    taken.add(name);
  }
  return out;
}

/** 칩 이름표(「젊은 여성 마법사」) — 성별 낱말을 읽는 데만 쓴다. */
function sharedChipLabel(resourceId: string, index: number): string {
  const textureKey = findCharsetAsset(resourceId)?.textureKey ?? resourceId;
  return findNpcGraphicMatches("*").find((m) => m.entry.textureKey === textureKey && m.entry.characterIndex === index)?.entry.label ?? "";
}

/**
 * 대화창·메뉴 모양을 아무도 고르지 않았다 — 장르로 ESC 메뉴 모양(menuUiStyle)을 고른다: 싸우는 판타지는 고전 청색 창, 추리·탈출·공포는 수첩,
 * 그 밖은 여행 세로 명령창. 대사창 룩(연애 VN)·창 스킨은 건드리지 않는다.
 */
function fillWindowLook(project: Project): string[] {
  const premise = project.gameBlueprint ? `${blueprintPremiseText(project, project.gameBlueprint)} ${project.gameBlueprint.ending.how}` : String(project.meta.title ?? "");
  const style: NonNullable<Project["system"]["menuUiStyle"]> = /추리|탐정|미스터리|사건|탈출|밀실|escape|공포|호러|귀신|유령|horror/iu.test(premise) ? "journal"
    : /마왕|용사|기사|판타지|RPG|던전|전투|모험/iu.test(premise) || battleSitesExist(project) ? "classic" : "field-list";
  project.system.menuUiStyle = style;
  return [`메뉴 모양 → ${style}`];
}
const battleSitesExist = (project: Project): boolean => Object.values(project.maps).some((m) => JSON.stringify(m.events ?? []).includes('"battleProcessing"'));

/**
 * 죽거나 질 수 있는데 게임 오버 화면이 기본이다 — 공포는 공포 연출(잡혔다), 그 밖은 고전(쓰러졌다). 글은 주인공 이름으로 짧게, 다시 하기·타이틀 단추는 기본.
 */
function fillGameOver(project: Project): string[] {
  const premise = project.gameBlueprint ? blueprintPremiseText(project, project.gameBlueprint) : String(project.meta.title ?? "");
  const hero = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])?.name?.trim() ?? "";
  const horror = /공포|호러|귀신|유령|괴담|좀비|horror/iu.test(premise);
  const settings = horror
    ? { presentation: "horror" as const, title: "붙잡혔다", message: hero ? `${topic(hero)} 어둠 속에서 더는 도망칠 곳이 없었다.` : "어둠 속에서 더는 도망칠 곳이 없었다." }
    : { presentation: "classic" as const, title: "쓰러졌다", message: hero ? `${topic(hero)} 힘이 다해 쓰러지고 말았다. 다시 일어나 도전하자.` : "힘이 다해 쓰러지고 말았다. 다시 일어나 도전하자." };
  project.system.gameOver = normalizeGameOverSettings(settings);
  return [`게임 오버 → ${settings.presentation} 「${settings.title}」`];
}

/**
 * 그려진 입구(계단·문짝) 옆 맨바닥에 선 문·이야기 이벤트를 그림 칸으로 옮긴다(offArtEntrances — 출하 검사와 같은 판정). 그 칸이 막힌 칸이면
 * 부딪혀 열리게(priority same, 겹침 금지). 다른 맵에서 그 칸으로 도착하는 이동이 있으면 옮기지 않는다(밟자마자 되돌아가는 왕복).
 */
function moveEntrancesOntoArt(project: Project): string[] {
  const out: string[] = [];
  const arrivals = new Set<string>();
  const visit = (node: unknown, depth = 0): void => {
    if (depth > 24 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1); return; }
    const o = node as Obj;
    if (o.kind === "transfer" && typeof o.mapId === "string") arrivals.add(`${o.mapId}|${String(o.x)},${String(o.y)}`);
    for (const value of Object.values(o)) if (value && typeof value === "object") visit(value, depth + 1);
  };
  for (const map of Object.values(project.maps)) visit(map.events ?? []);
  for (const ce of project.commonEvents ?? []) visit(ce);
  const start = { mapId: project.startMapId, x: project.startPos?.x, y: project.startPos?.y };
  for (const entry of offArtEntrances(project)) {
    const map = project.maps[entry.mapId];
    const event = map?.events.find((e) => e.id === entry.eventId);
    if (!map || !event) continue;
    if (arrivals.has(`${entry.mapId}|${entry.door.x},${entry.door.y}`)) continue;
    if (start.mapId === entry.mapId && start.x === entry.door.x && start.y === entry.door.y) continue;
    const blocked = doorCellBlocked(project, entry.mapId, entry.door.x, entry.door.y);
    event.x = entry.door.x;
    event.y = entry.door.y;
    if (blocked) for (const page of event.pages ?? []) { page.priority = "same"; page.overlapForbidden = true; }
    out.push(`입구 「${entry.name}」(${map.name || map.id}) (${entry.x},${entry.y}) → 그림 칸 (${entry.door.x},${entry.door.y})${blocked ? " · 부딪혀 열림" : ""}`);
  }
  return out;
}

/**
 * 이야기를 한 단계 넘기면서 다음 목표를 안 바꾸는 이정표 이벤트(objectiveGaps)에 다음 목표를 건다 — 청사진 다음 단계 이벤트가 있으면 그것,
 * 없으면 이 이벤트가 켠 스위치·준 아이템을 읽는 첫 이벤트를 「찾아가자」로. 거는 자리·「어디」 힌트는 set_objective 와 같은 planObjective.
 * 다음 대상을 모르면(엔딩 정의만 읽는다) 건너뛴다.
 */
function fillStaleObjectives(project: Project): string[] {
  const out: string[] = [];
  const steps = project.gameBlueprint?.steps ?? [];
  const object = (word: string): string => `${word}${hasFinal(word) ? "을" : "를"}`;
  for (const { event, readers } of staleMilestoneTargets(project)) {
    const k = steps.findIndex((step) => step.event === event.eventId || step.event === event.name);
    const nextStep = k >= 0 ? steps[k + 1] : undefined;
    const stepTarget = nextStep ? Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === nextStep.event || e.name === nextStep.event).map((e) => String(e.name ?? e.id))).at(0) : undefined;
    const target = stepTarget ?? readers.map((r) => r.name).find((n) => n && !/^ev_/u.test(n));
    if (!target) continue;
    const plan = planObjective(project, { text: `${object(`「${target}」`)} 찾아가자`, eventId: event.eventId, mapId: event.mapId });
    if (!plan.ok) continue;
    for (const { mapId, event: next } of plan.events) {
      const map = project.maps[mapId];
      if (!map) continue;
      map.events = map.events.map((e) => e.id === next.id ? next as unknown as typeof e : e);
    }
    out.push(`다음 목표: ${event.name} 뒤 → 「${target}」`);
  }
  return out;
}

/**
 * 엔딩 조건 중 아무 이벤트도 켜지 않는 스위치·변수(endingConditionsUnset)를 뺀다 — 엔딩을 부르는 이벤트가 곧 관문이다.
 * 켜는 곳이 있는 조건·친밀도·회차 조건은 그대로 둔다.
 */
function dropDeadEndingConditions(project: Project): string[] {
  const written = writtenStateIds(project);
  const targeted = new Set(endingConditionsUnset(project).map((b) => b.evidence.split(":")[0]!));
  const out: string[] = [];
  for (const ending of (project.endings ?? []).filter((e) => targeted.has(e.id))) {
    const keep = (ending.conditions ?? []).filter((c) => !((c.kind === "switch" && c.value !== false && !written.switches.has(c.switchId)) || (c.kind === "variable" && !written.variables.has(c.variableId))));
    if (keep.length === (ending.conditions ?? []).length) continue;
    out.push(`엔딩 「${ending.name}」 조건 ${(ending.conditions ?? []).length - keep.length}개 뺌(켜는 이벤트 없음)`);
    ending.conditions = keep;
  }
  return out;
}

// ── 엔딩 마무리 ─────────────────────────────────────────────────────────

const hasFinal = (word: string): boolean => { const c = word.trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
const topic = (word: string): string => `${word}${hasFinal(word) ? "은" : "는"}`;
const subject = (word: string): string => `${word}${hasFinal(word) ? "이" : "가"}`;
const sentence = (text: string): string => { const t = text.trim().replace(/[.。!?]+$/u, ""); return t ? `${t}.` : ""; };
/** 「…다」로 끝나는 말(문장)인가 — 아니면 명사구(「평화가 찾아온 마을의 안도감」). */
const isClause = (text: string): boolean => /다[.!?]?$/u.test(text.trim());

/** 엔딩 그림 — 청사진 이야기에 강하게 맞는 번들 그림, 없으면 이야기 종류별 맺음 스틸(풍토가 이야기와 부딪치지 않는 것). */
const ENDING_STILLS: readonly { readonly re: RegExp; readonly id: string }[] = [
  { re: /눈 덮인|설원|겨울|얼음/u, id: "oprn-still-snow-village" },
  { re: /사막|피라미드|오아시스/u, id: "oprn-still-desert-ruin" },
  { re: /공포|호러|귀신|유령|괴담|저택|horror/iu, id: "oprn-still-festival" },
  { re: /마왕|왕국|용사|영웅|기사|판타지|모험|RPG/iu, id: "oprn-still-kingdom-day" },
  { re: /추리|탐정|미스터리|사건|범인|여관/u, id: "oprn-still-moon-meadow" },
  { re: /학교|학생|교실|도시|현대|일상|친구|탈출|escape/iu, id: "oprn-still-lullaby" },
  { re: /농장|농사|귀농|목장/u, id: "oprn-still-farm-golden" },
];
function endingArt(project: Project): string | undefined {
  const blueprint = project.gameBlueprint;
  if (!blueprint) return undefined;
  const premise = blueprintPremiseText(project, blueprint);
  const strong = pickTitleArtForStory(premise, blueprintStoryText(project, blueprint));
  if (strong && findOpeningStillMood(strong.id)) return strong.id;
  const text = `${premise}\n${blueprint.ending.name}\n${blueprint.ending.how}`;
  return (ENDING_STILLS.find((s) => s.re.test(text)) ?? { id: "oprn-still-farm-golden" }).id;
}

/**
 * 장면으로 맺지 않는 엔딩(endingClosureProblems)에 청사진 ending.how·feeling 과 주인공 이름으로 짧은 맺음 글을 덧붙이고,
 * 마지막 그림이 없으면 이야기에 맞는 스틸을 준다. 모델이 쓴 줄은 그대로 두고 앞에 둔다.
 */
function fillEndingClosure(project: Project): string[] {
  const blueprint = project.gameBlueprint;
  if (!blueprint) return [];
  // 이름이 편집기 기본(「주인공」)이어도 그 이름으로 맺는다 — 기본 이름은 party-names 가 따로 짚는다.
  const heroName = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])?.name?.trim() ?? "";
  const place = blueprintPlaceName(project, blueprint);
  const art = endingArt(project);
  const out: string[] = [];
  const failing = new Map(endingClosureProblems(project).map((b) => [b.evidence.split(":")[0]!, b.message]));
  for (const ending of project.endings ?? []) {
    const problem = failing.get(ending.id);
    if (!problem) continue;
    const needLines = problem.includes("맺음 대사가"), needPerson = problem.includes("인물의 매듭"), needImage = problem.includes("마지막 그림");
    const beats = ((ending.epilogue ?? []) as unknown as Obj[]);
    const said = () => beats.filter((b) => (b.kind === "say" || b.kind === "text") && typeof b.text === "string" && String(b.text).trim()).map((b) => String(b.text).trim());
    const has = (line: string) => said().some((t) => t.replace(/\s+/gu, "").includes(line.replace(/[.\s]+/gu, "")));
    const add = (line: string) => { if (line && !has(line)) beats.push({ kind: "say", text: line }); };
    const enough = () => { const lines = said(); return lines.length >= 3 && lines.reduce((n, t) => n + t.length, 0) >= 80; };
    const before = said().length;
    if (needLines) add(sentence(blueprint.ending.how));
    if ((needLines || needPerson) && heroName) add(`${topic(heroName)} ${place ? `${place}에서 시작한 ` : ""}이 여정을 끝까지 걸어냈다.`);
    const feeling = blueprint.ending.feeling.trim();
    if (feeling && !enough()) add(isClause(feeling) ? sentence(feeling) : `${subject(feeling)} 오래도록 남았다.`);
    if (!enough()) add(sentence(blueprint.steps.at(-1)?.action ?? ""));
    if (!enough() && heroName) add(`${heroName}의 이야기는 여기서 한 매듭을 짓는다.`);
    (ending as unknown as Obj).epilogue = beats;
    const added = said().length - before;
    const pictured = !needImage;
    if (!pictured && art) { ending.presentation = { ...(ending.presentation ?? {}), backgroundResourceId: art } as typeof ending.presentation; }
    if (added || (!pictured && art)) out.push(`엔딩 「${ending.name}」 맺음${added ? ` 글 ${added}줄` : ""}${!pictured && art ? ` · 그림 ${art}` : ""}`);
  }
  return out;
}

// ── 기본 지명 걷어내기 ───────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const GENERIC_PLACE = /^(마을|도시|항구|동굴|이곳|곳)$/u;

/**
 * 제목·엔딩이 기본 시작 칩셋 지명(「버들항」)을 게임 주제로 삼았다(defaultPlaceLeaks) — 그 지명을 이야기 장소의 보통 이름으로 바꾼다:
 * 「버들항 마을」 → 「마을」, 「버들항의 평화」 → 「마을의 평화」. 보통 이름은 청사진 첫 장소에서 지명을 뺀 말(없으면 「마을」).
 * 제목이 보통 이름 하나만 남으면 고친 엔딩 이름(그것도 없으면 장르)을 제목으로 쓴다. 맵 이름은 건드리지 않는다(검사 대상이 아니다).
 */
function removeDefaultPlaceWords(project: Project, task: string): string[] {
  const out: string[] = [];
  for (const leak of defaultPlaceLeaks(project, task)) {
    const word = leak.evidence.split(":")[0]!.trim();
    if (!word) continue;
    const firstPlace = project.gameBlueprint ? blueprintPlaceName(project, project.gameBlueprint) : "";
    const noun = firstPlace.replace(new RegExp(escapeRe(word), "gu"), "").replace(/^[\s의]+|\s+$/gu, "").trim() || "마을";
    const strip = (text: string): string => text
      .replace(new RegExp(`${escapeRe(word)}\\s*${escapeRe(noun)}`, "gu"), noun)
      .replace(new RegExp(escapeRe(word), "gu"), noun)
      .replace(new RegExp(`${escapeRe(noun)}\\s+${escapeRe(noun)}`, "gu"), noun);
    const touched: string[] = [];
    for (const ending of project.endings ?? []) {
      const name = strip(ending.name);
      if (name !== ending.name) { touched.push(`엔딩 「${ending.name}」→「${name}」`); ending.name = name; }
      const pres = ending.presentation as Obj | undefined;
      if (pres && typeof pres.finalTitle === "string") pres.finalTitle = strip(pres.finalTitle);
      for (const beat of ((ending.epilogue ?? []) as unknown as Obj[])) {
        if (typeof beat.text === "string") beat.text = strip(beat.text);
        if (Array.isArray(beat.lines)) beat.lines = (beat.lines as unknown[]).map((l) => typeof l === "string" ? strip(l) : l);
      }
    }
    const title = project.system.titleScreen;
    const retitle = (current: string): string => {
      const next = strip(current);
      if (next === current) return current;
      if (!GENERIC_PLACE.test(next.trim())) return next;
      return (project.endings ?? []).map((e) => e.name).find((n) => n && !n.includes(word)) ?? project.gameBlueprint?.genre ?? next;
    };
    if (title?.title?.includes(word)) { const next = retitle(title.title); touched.push(`타이틀 「${title.title}」→「${next}」`); title.title = next; }
    if (String(project.meta.title ?? "").includes(word)) project.meta = { ...project.meta, title: retitle(project.meta.title) };
    if (touched.length) out.push(`기본 지명 「${word}」 걷어냄: ${touched.slice(0, 4).join(" · ")}`);
  }
  return out;
}
