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
import { defaultPlaceLeaks, editorDefaultsLeft, endingClosureProblems, endingConditionsUnset, emptySparkles, selfLoopTransfers, silentLockedExits, writtenStateIds } from "./shipChecks";
import { strayStepCopies } from "./blueprint";
import { doorCellBlocked, lateStartObjective, objectiveCommand, offArtEntrances, planObjective, repeatingStartObjectives, staleMilestoneTargets, withWhere } from "./discoverability";
import { normalizeGameOverSettings } from "@/project/cinematicSettings";
import { fieldMenu, storyFieldMenu } from "@/project/fieldMenu";
import { syncMenuFeatures, syncMenuUiStyle } from "@/project/menuSystem";
import { FACTORY_HERO_ARMS } from "./genreDefaults";
import { fitGateLevelCurve, fitRequiredBattlesToStarters, fitRouteLevelsToGates } from "./monsterRouteLevels";

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
  applied.push(...keepProgressOnDefeat(project));
  if (left.has("combat-leftovers")) applied.push(...clearCombatLeftovers(project));
  if (offArtEntrances(project).length) applied.push(...moveEntrancesOntoArt(project));
  if (repeatingStartObjectives(project).length) applied.push(...moveRepeatingStartObjective(project));
  if (lateStartObjective(project)) applied.push(...pullBackStartObjective(project));
  if (staleMilestoneTargets(project).length) applied.push(...fillStaleObjectives(project));
  applied.push(...fillGymArrivalObjectives(project));
  applied.push(...fitGateLevelCurve(project));
  applied.push(...fitRouteLevelsToGates(project));
  // 곡선 뒤 마지막: 고를 수 있는 스타터 각각이 혼자 필수 전투를 이기게 상대 레벨을 내린다(모델 레벨 아래로도).
  applied.push(...fitRequiredBattlesToStarters(project));
  if (endingConditionsUnset(project).length) applied.push(...dropDeadEndingConditions(project));
  if (selfLoopTransfers(project).length) applied.push(...dropSelfLoopTransfers(project));
  if (emptySparkles(project).length) applied.push(...dropEmptySparkles(project));
  if (strayStepCopies(project).length) applied.push(...dropStrayStepCopies(project));
  if (silentLockedExits(project).length) applied.push(...explainLockedExits(project));
  applied.push(...attachEndingToLastStep(project));
  // 목표 줄이 있는데 필드 HUD 가 「현재 목표」 줄을 숨기면 켠다(출하 검사 objective-missing — 2026-10-29 vm4 argon 탈출, 목표 글은 다 있었다).
  {
    const hud = project.system.fieldHud as { objective?: boolean } | undefined;
    if (hud && hud.objective === false && JSON.stringify(project.maps).includes('"surface":"objectiveChip"')) { hud.objective = true; applied.push("필드 HUD 「현재 목표」 줄 켬"); }
  }
  applied.push(...forkStackedEndingCalls(project));
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
 * 이름 붙은 triggerEnding 이 줄줄이 붙어 있으면(「평범」 엔딩 → 「혼자」 엔딩) 첫 호출만 돈다 — 이름 붙은 호출은 엔딩 조건을 보지 않고 그 엔딩으로 끝낸다
 * (selectEnding). 모델은 「호감이 되면 평범, 아니면 혼자」를 뜻했다. 앞 엔딩에 조건이 있으면 그 조건으로 가르는 fork 사슬로 바꾼다
 * (조건 없는 엔딩에서 사슬이 끝난다). 2026-10-29 standin romance 「다음 주에도, 단골손님」 뒤 「커피 한 잔의 거리」가 영영 안 열렸다.
 */
/**
 * 엔딩이 정의됐는데 어떤 명령도 엔딩을 부르지 않으면(출하 검사 no-ending-trigger) 청사진 마지막 단계 이벤트에 붙인다 —
 * 그 이벤트가 전투를 하면 승리 갈래 끝에, 아니면 첫 페이지 끝에. 조건 없는 엔딩을 먼저 고른다.
 * 왜(2026-10-29 vm4 argon jrpg): 마지막 단계가 마왕 전투였고 경로 짓기는 «전투가 든 이벤트라 다시 짓지 않음»으로 건너뛰어, 엔딩이 정의만 있고 끝낼 수 없었다.
 */
function attachEndingToLastStep(project: Project): string[] {
  const endings = project.endings ?? [];
  const steps = project.gameBlueprint?.steps ?? [];
  if (!endings.length || !steps.length) return [];
  let calls = false;
  const scan = (node: unknown): void => {
    if (calls || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(scan); return; }
    const o = node as Obj;
    if (o.kind === "triggerEnding" || o.kind === "ending") { calls = true; return; }
    Object.values(o).forEach(scan);
  };
  for (const map of Object.values(project.maps)) scan(map.events ?? []);
  scan(project.commonEvents ?? []);
  if (calls) return [];
  const last = steps.at(-1)!;
  const place = Object.values(project.maps).find((m) => m.id === last.place || m.name === last.place);
  const maps = place ? [place, ...Object.values(project.maps).filter((m) => m !== place)] : Object.values(project.maps);
  let hit: { map: (typeof maps)[number]; event: NonNullable<(typeof maps)[number]["events"]>[number] } | undefined;
  for (const map of maps) {
    const event = (map.events ?? []).find((e) => e.id === last.event || e.name === last.event);
    if (event) { hit = { map, event }; break; }
  }
  if (!hit) return [];
  const ending = endings.find((e) => !(e.conditions ?? []).length) ?? endings[0]!;
  const call = { kind: "triggerEnding", endingId: ending.id };
  const isVictoryFork = (c: Obj) => c.kind === "fork" && (c.condition as Obj | undefined)?.kind === "battleResult" && (c.condition as Obj).result === "victory" && Array.isArray(c.then);
  for (const page of hit.event.pages ?? []) {
    const commands = page.commands as unknown as Obj[] | undefined;
    if (!Array.isArray(commands)) continue;
    const fork = commands.find(isVictoryFork);
    if (fork) { (fork.then as unknown[]).push(call); return [`엔딩 「${ending.name}」을 마지막 단계 「${hit.event.name ?? hit.event.id}」 승리 뒤에 붙임`]; }
    const battle = commands.find((c) => c.kind === "battleProcessing");
    if (battle) {
      if (battle.branchOnResult === true && Array.isArray(battle.victoryBranch)) (battle.victoryBranch as unknown[]).push(call);
      else commands.splice(commands.indexOf(battle) + 1, 0, { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: [call] });
      return [`엔딩 「${ending.name}」을 마지막 단계 「${hit.event.name ?? hit.event.id}」 승리 뒤에 붙임`];
    }
  }
  const first = hit.event.pages?.[0];
  if (!first || !Array.isArray(first.commands)) return [];
  (first.commands as unknown as Obj[]).push(call);
  return [`엔딩 「${ending.name}」을 마지막 단계 「${hit.event.name ?? hit.event.id}」 끝에 붙임`];
}

function forkStackedEndingCalls(project: Project): string[] {
  const endings = new Map((project.endings ?? []).map((e) => [e.id, e]));
  const out: string[] = [];
  const named = (c: unknown): string | undefined => {
    const o = c as Obj | undefined;
    return o && o.kind === "triggerEnding" && typeof o.endingId === "string" && endings.has(o.endingId) ? o.endingId : undefined;
  };
  const fixList = (list: unknown[], where: string): void => {
    for (let i = 0; i < list.length; i++) {
      const first = named(list[i]);
      if (!first) continue;
      let j = i + 1;
      while (j < list.length && named(list[j])) j++;
      const run = list.slice(i, j).map((c) => named(c)!);
      if (run.length < 2 || !(endings.get(first)!.conditions ?? []).length) continue;
      let chain: unknown[] = [{ kind: "triggerEnding", endingId: run[run.length - 1] }];
      for (const id of run.slice(0, -1).reverse()) {
        const conds = structuredClone(endings.get(id)!.conditions ?? []);
        chain = conds.length ? [{ kind: "fork", condition: conds.length === 1 ? conds[0] : { kind: "all", conditions: conds }, then: [{ kind: "triggerEnding", endingId: id }], else: chain }] : [{ kind: "triggerEnding", endingId: id }];
      }
      list.splice(i, run.length, ...chain);
      out.push(`${where}: 엔딩 ${run.map((id) => endings.get(id)!.name).join(" → ")} 를 조건으로 가름`);
    }
    for (const c of list) visit(c, where);
  };
  const visit = (node: unknown, where: string): void => {
    if (!node || typeof node !== "object") return;
    for (const v of Object.values(node as Obj)) {
      if (Array.isArray(v)) { if (v.some((x) => x && typeof x === "object" && "kind" in (x as Obj))) fixList(v, where); else for (const x of v) visit(x, where); }
      else if (v && typeof v === "object") visit(v, where);
    }
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) {
    const commands = page.commands as unknown[] | undefined;
    if (Array.isArray(commands)) fixList(commands, `${map.name ?? map.id} ${event.name ?? event.id}`);
  }
  for (const common of (project.commonEvents ?? []) as unknown as Obj[]) {
    if (Array.isArray(common.commands)) fixList(common.commands as unknown[], `공통 ${String(common.name ?? common.id)}`);
  }
  return out;
}

/**
 * 전투 없는 게임의 전투 기본값(출하 검사 combat-leftovers 와 같은 판정): ESC 메뉴를 이야기용(configure_field_menu{preset:'story'} 와 같은 항목)으로 —
 * 저작한 메뉴가 있으면 스킬·장비·상태·진형·전투 기록 칸만 뺀다 — 하고, 파티의 공장 기본 무기·방어구(검·방패…)만 뺀다(고른 장비는 그대로).
 * 2026-10-29 standin magic·vm2 flash 추리: 전투 없는 게임 ESC 메뉴에 스킬·장비가, 주인공 손에 검·방패가 남았다.
 */
const COMBAT_MENU = new Set(["skills", "equipment", "status", "row", "formation", "battle-reports"]);
function clearCombatLeftovers(project: Project): string[] {
  const out: string[] = [];
  const authored = project.meta.oprnFieldMenu;
  const current = fieldMenu(project);
  const kept = current?.entries.filter((row) => !COMBAT_MENU.has(row.command)) ?? [];
  if (!current || kept.length !== current.entries.length) {
    const next = current && kept.length ? { version: 1 as const, entries: kept } : storyFieldMenu();
    project.meta.oprnFieldMenu = next;
    // 메뉴를 처음 저작하면 창 모양도 맞춘다 — 이미 고른 모양(메뉴 모양 기본값 journal·classic)은 그대로.
    if (!authored) syncMenuUiStyle(project, true, project.system.menuUiStyle && project.system.menuUiStyle !== "pixel" ? project.system.menuUiStyle : undefined);
    syncMenuFeatures(project, next);
    out.push(`ESC 메뉴 → ${next.entries.map((row) => row.label).join("·")}`);
  }
  for (const id of project.system.startActorIds ?? []) {
    const actor = project.database.actors.find((a) => a.id === id);
    const equipment = actor?.initialEquipment as Record<string, unknown> | undefined;
    if (!actor || !equipment) continue;
    const gone = Object.entries(FACTORY_HERO_ARMS).filter(([slot, item]) => equipment[slot] === item).map(([slot]) => slot);
    for (const slot of gone) delete equipment[slot];
    if (gone.length) out.push(`${actor.name} 기본 장비 ${gone.join("·")} 뺌`);
  }
  return out;
}

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
 * 패배하면 진행을 지킨 채 다시 일어나게 한다 — 게임 오버 결과를 정하지 않으면(outcome 생략 = 메뉴) 기록된 체크포인트가 없을 때
 * 메뉴에는 「타이틀로 돌아가기」만 남아 새로 시작할 수밖에 없었다(2026-10-29 vm5 flash jrpg: 「패배하면 시작 지점·0G·첫 목표로 돌아가
 * 상자 보상 등 진행이 사라짐, 복귀 지점 안내 없음」). 결과를 recover(귀환)로 — 런타임 createDefeatRecovery 가 진행·소지품을 그대로 두고
 * 파티를 회복시켜 마지막 체크포인트, 없으면 recoveryFallback, 없으면 시작 지점으로 옮긴다. 화면 글(「다시 일어나 도전하자」)은 그대로 쓴다.
 * 체크포인트 저장 이벤트가 있어도 그 앞에서 지면 메뉴는 「타이틀로」뿐이었다(vm5 terra: 동굴 세이브 지점 전에 박쥐에게 전멸). 공포 연출(잡히면 끝)·
 * 작가가 결과를 정한 게임 오버는 둔다.
 */
function keepProgressOnDefeat(project: Project): string[] {
  const settings = project.system.gameOver;
  if (!settings || settings.outcome || settings.presentation === "horror" || settings.presentation === "blackout") return [];
  project.system.gameOver = { ...settings, outcome: "recover" };
  return [`게임 오버 → 귀환(진행·소지품 유지, 회복 뒤 마지막 체크포인트·${settings.recoveryFallback ? "지정한 자리" : "시작 지점"}으로) — 「타이틀로」만 남던 메뉴 대신`];
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
export function fillStaleObjectives(project: Project): string[] {
  const out: string[] = [];
  const steps = project.gameBlueprint?.steps ?? [];
  const object = (word: string): string => `${word}${hasFinal(word.replace(/[」』"”')\]\s]+$/u, "")) ? "을" : "를"}`;
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
 * 맵에 들어올 때마다 도는 페이지(장면 분위기)에 걸린 시작 목표를 한 번만 도는 자리로 옮긴다(planObjective at:start 가 그 페이지에서 빼고 다시 건다).
 * 왜(2026-10-29 vm2 deepseek 방탈출 A6): 열쇠를 얻고 저장 → 불러오기 하자 분위기 페이지가 다시 돌며 「일지를 읽자」로 되돌렸다.
 */
function moveRepeatingStartObjective(project: Project): string[] {
  const first = repeatingStartObjectives(project)[0];
  if (!first) return [];
  const plan = planObjective(project, { at: "start", text: first.message });
  if (!plan.ok) return [];
  for (const { mapId, event: next } of plan.events) {
    const map = project.maps[mapId];
    if (!map) continue;
    const has = map.events.some((e) => e.id === next.id);
    map.events = has ? map.events.map((e) => e.id === next.id ? next as unknown as typeof e : e) : [...map.events, next as unknown as (typeof map.events)[number]];
  }
  return [`시작 목표를 매번 도는 「${first.eventId}」에서 옮김: ${plan.summary}`];
}

/** 뒤 단계를 말하는 시작 목표(lateStartObjective)를 첫 단계 할 일로 되돌린다 — 자리 힌트는 planObjective 가 첫 단계 이벤트로 붙인다. */
function pullBackStartObjective(project: Project): string[] {
  const late = lateStartObjective(project);
  if (!late) return [];
  const plan = planObjective(project, { at: "start", text: late.first });
  if (!plan.ok) return [];
  for (const { mapId, event: next } of plan.events) {
    const map = project.maps[mapId];
    if (!map) continue;
    const has = map.events.some((e) => e.id === next.id);
    map.events = has ? map.events.map((e) => e.id === next.id ? next as unknown as typeof e : e) : [...map.events, next as unknown as (typeof map.events)[number]];
  }
  return [`시작 목표 「${late.message}」 는 뒤 단계 일이라 첫 단계로: ${plan.summary}`];
}

/**
 * 몬스터 원정의 체육관 마을에 들어서면 「현재 목표」가 그 체육관을 가리킨다 — 배지마다(monsterCampaign.badges) 그 마을(cityMapId)로 들어오는
 * 다른 원정 장소(locations: 길·마을·던전·리그)의 이동 명령 앞에, 배지 목표(objectives 의 switchId = 배지 스위치)의 앞 조건이 켜지고 배지는 아직일 때 목표 글(방위 붙임)을 건다.
 * 왜(2026-10-29 standin monster 「새싹 몬스터 모험」): 박사가 건 「1번길 풀숲에서 몬스터를 잡고 새순 마을로 가자」가 마을에 와서도 그대로였고,
 * 체육관을 가리키는 목표는 길가 라이벌(말을 걸지 않아도 되는 이벤트)만 걸었다. 같은 프로젝트에 두 번 불러도 결과가 같다.
 */
function fillGymArrivalObjectives(project: Project): string[] {
  const campaign = project.system.monsterCampaign;
  if (!campaign?.badges?.length) return [];
  const out: string[] = [];
  for (const badge of campaign.badges) {
    const objective = campaign.objectives?.find((o) => o.switchId === badge.switchId);
    const city = project.maps[badge.cityMapId];
    if (!objective || !city) continue;
    const message = withWhere(project, city.id, objective.title.trim().replace(/[.。]$/u, ""));
    const conditions: Obj[] = [{ kind: "switch", switchId: badge.switchId, value: false }];
    if (objective.requiresSwitchId) conditions.unshift({ kind: "switch", switchId: objective.requiresSwitchId, value: true });
    const guard = (): Obj => ({ kind: "fork", condition: conditions.length > 1 ? { kind: "all", conditions } : conditions[0], then: [objectiveCommand(message)] });
    const already = (cmd: unknown): boolean => !!cmd && typeof cmd === "object" && (cmd as Obj).kind === "fork" && JSON.stringify((cmd as Obj).then ?? []).includes(JSON.stringify(message));
    let placed = 0;
    const visit = (list: unknown[]): void => {
      for (let i = 0; i < list.length; i += 1) {
        const cmd = list[i] as Obj | undefined;
        if (!cmd || typeof cmd !== "object") continue;
        for (const value of Object.values(cmd)) {
          if (Array.isArray(value)) visit(value);
          else if (value && typeof value === "object") for (const inner of Object.values(value as Obj)) if (Array.isArray(inner)) visit(inner);
        }
        if (cmd.kind === "transfer" && cmd.mapId === city.id && !already(list[i - 1])) {
          list.splice(i, 0, guard());
          i += 1;
          placed += 1;
        }
      }
    };
    // 원정 장소(길·다른 마을·던전)에서 들어올 때만 — 마을 안 건물(센터·상점·체육관)에서 나올 때 덮으면 라이벌·체육관 장치가 건 더 자세한 목표가 지워진다.
    const from = new Set(campaign.locations.map((location) => location.mapId).filter((id) => id !== city.id));
    for (const map of Object.values(project.maps)) {
      if (!from.has(map.id)) continue;
      for (const event of map.events ?? []) for (const page of event.pages ?? []) if (Array.isArray(page.commands)) visit(page.commands as unknown[]);
    }
    if (placed) out.push(`체육관 마을 「${city.name ?? city.id}」에 들어서면 목표 「${message}」(이동 ${placed}곳)`);
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

// ── 제자리 옮기기 ─────────────────────────────────────────────────────────

/** 같은 맵 1칸 이내로 옮기는 명령을 지운다(selfLoopTransfers). 옮기기만 하던 투명 이벤트는 통째로 지운다. */
function dropSelfLoopTransfers(project: Project): string[] {
  const notes: string[] = [];
  for (const loop of selfLoopTransfers(project)) {
    const map = project.maps[loop.mapId];
    const event = map?.events.find((e) => e.id === loop.eventId);
    if (!map || !event) continue;
    const strip = (list: unknown): unknown[] => (Array.isArray(list) ? list : []).flatMap((raw) => {
      const c = raw as Record<string, unknown>;
      if (c?.kind === "transfer" && c.mapId === loop.mapId && c.x === loop.to.x && c.y === loop.to.y) return [];
      const copy: Record<string, unknown> = { ...c };
      for (const [key, value] of Object.entries(copy)) if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "kind" in (v as object))) copy[key] = strip(value);
      if (Array.isArray(copy.options)) copy.options = (copy.options as Record<string, unknown>[]).map((o) => ({ ...o, branch: strip(o.branch) }));
      return [copy];
    });
    const pages = (event.pages ?? []).map((page) => ({ ...page, commands: strip(page.commands) as typeof page.commands }));
    const empty = pages.every((page) => !(page.commands ?? []).length) && pages.every((page) => (page.graphic as { transparent?: boolean } | undefined)?.transparent === true);
    map.events = empty ? map.events.filter((e) => e.id !== event.id) : map.events.map((e) => e.id === event.id ? { ...e, pages } : e);
    notes.push(`제자리 옮기기 ${empty ? "이벤트" : "명령"} 지움: ${map.name ?? map.id} ${event.id}(${loop.x},${loop.y})`);
  }
  return notes;
}

/** 아무 일도 안 하는 페이지의 반짝임을 뗀다(emptySparkles). 반짝임은 «여기 할 일이 있다» 는 약속이다. */
function dropEmptySparkles(project: Project): string[] {
  const notes: string[] = [];
  for (const hit of emptySparkles(project)) {
    const map = project.maps[hit.mapId];
    const event = map?.events.find((e) => e.id === hit.eventId);
    const page = event?.pages?.[hit.page] as unknown as Record<string, unknown> | undefined;
    if (!page) continue;
    delete page.nearSparkle;
    notes.push(`빈 반짝임 뗌: ${map!.name ?? map!.id} ${hit.eventId}(${hit.x},${hit.y})`);
  }
  return notes;
}

/** 다른 맵에 남은 단계 이벤트 사본(싸움·엔딩)을 지운다 — 청사진 장소의 정본만 남긴다(strayStepCopies). */
function dropStrayStepCopies(project: Project): string[] {
  const notes: string[] = [];
  for (const hit of strayStepCopies(project)) {
    const map = project.maps[hit.mapId];
    if (!map) continue;
    const ev = map.events.find((e) => e.id === hit.eventId);
    map.events = map.events.filter((e) => e.id !== hit.eventId);
    notes.push(`단계 사본 지움: ${map.name ?? map.id} 「${ev?.name ?? hit.eventId}」(${hit.x},${hit.y}) — 정본은 ${project.maps[hit.canonicalMapId]?.name ?? hit.canonicalMapId}`);
  }
  return notes;
}

const withJosa = (word: string, batchim: string, plain: string): string => {
  const code = (word.trim().at(-1) ?? "").charCodeAt(0) - 0xac00;
  return `${word}${code >= 0 && code <= 11171 ? (code % 28 ? batchim : plain) : `${batchim}(${plain})`}`;
};
/** 조건부 출구에 «막힐 때 이유 한 줄» 페이지를 맨 앞에 넣는다(silentLockedExits). 이유는 첫 조건에서 — 아이템이면 그 이름, 스위치면 켜는 이벤트 이름. */
function explainLockedExits(project: Project): string[] {
  const notes: string[] = [];
  const sets = (value: unknown, switchId: string): boolean => {
    if (Array.isArray(value)) return value.some((v) => sets(v, switchId));
    if (!value || typeof value !== "object") return false;
    const r = value as Record<string, unknown>;
    if (r.kind === "setSwitch" && r.switchId === switchId && r.value !== false) return true;
    return Object.values(r).some((v) => sets(v, switchId));
  };
  const setterName = (switchId: string): string | undefined => {
    for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
      if (ev.name && !/^ev_objective/u.test(ev.id) && sets(ev.pages ?? [], switchId)) return ev.name;
    }
    return undefined;
  };
  for (const hit of silentLockedExits(project)) {
    const map = project.maps[hit.mapId];
    const ev = map?.events.find((e) => e.id === hit.eventId);
    if (!map || !ev) continue;
    const pages = ev.pages as unknown as Record<string, unknown>[];
    const lockedPage = pages.find((p) => JSON.stringify(p.commands ?? []).includes('"kind":"transfer"'))!;
    const cond = ((lockedPage.conditions as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
    let line = "아직 이쪽으로는 갈 수 없다.";
    if (cond.kind === "item" && typeof cond.itemId === "string") {
      const item = project.database.items.find((i) => i.id === cond.itemId);
      if (item?.name) line = `${withJosa(item.name, "이", "가")} 있어야 지나갈 수 있을 것 같다.`;
    } else if (cond.kind === "switch" && typeof cond.switchId === "string") {
      const name = setterName(cond.switchId);
      if (name) line = `먼저 「${name}」${withJosa(name, "을", "를").slice(name.length)} 마쳐야 지나갈 수 있을 것 같다.`;
    }
    const page = { ...structuredClone(lockedPage), conditions: [], commands: [{ kind: "text", body: line }] };
    (ev as { pages: unknown[] }).pages = [page, ...pages];
    notes.push(`조건부 출구에 막힘 안내: ${map.name ?? map.id} (${ev.x},${ev.y}) 「${line}」`);
  }
  return notes;
}
