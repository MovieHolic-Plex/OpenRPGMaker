// 출하 기본값 — 겉모습·소리: 필드 HUD, 전투 곡·전투 배경, 파티 칩·이름, 창 모양. 차례는 shipDefaults.ts 의 applyShipDefaults.
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { findNpcGraphicMatches, queryNpcGraphics } from "@/assets/charsetQuery";
import { climateBattleBackground, dungeonBattleBackground, isForestNamedMap, placeNameBattleBackground } from "@/battle/battleBackdrop";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID, FIELD_BATTLE_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { createBlankProject } from "@/project/defaults";
import { blueprintPremiseText } from "@/project/blueprintAssembly";
import { sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { charsetBattlerForCharacter } from "@/assets/charsetBattlers";
import { bustOfChip } from "./speakerBust";
import type { Project } from "@/project/types";
import { applyThemeBackdrop } from "../place/placeTheme";
import { asPresetHud, HUD_SOURCES, normalizeFieldHud, projectCanLoseHp, projectHudUse, resolvedHudWidgets, unusedHudGauges } from "@/project/fieldHud";
import { hudIsStoryTemplate } from "../judge/hudTitleChecks";
import { battleSites } from "../judge/combatChecks";

export type Obj = Record<string, unknown>;

let factoryCache: Project | undefined;

const factory = (): Project => (factoryCache ??= createBlankProject() as Project);

/**
 * 필드 HUD 를 아무도 고르지 않았다(편집기 기본 — 하트 체력·숫자). set_field_hud 와 같은 값으로 고른다: 체력이 줄 일(전투·피해·조우)이
 * 없으면 끈다({off:true} — 목표 줄만), 있으면 공포는 꽃잎 생명(horror), 싸우는 판타지는 고전 창(classic), 그 밖은 하트 모험(hearts).
 * 실측(2026-11-05 gpt-only-game 6차): 전투 없는 학교 연애가 체력 하트와 「514 / 514」를 내내 띄웠다.
 */
export function fillFieldHud(project: Project, story: string): string[] {
  // 2D 액션 전투는 명령 없이 체력을 깎는다(projectCanLoseHp 는 턴제 전투·피해 명령만 본다).
  const action = project.system.actionCombat?.enabled === true;
  if (!action && !projectCanLoseHp(project)) {
    project.system.fieldHud = { theme: "chase", vitals: false, clock: false, tools: false, objective: true, hideEmpty: true, widgets: [] };
    return ["필드 HUD 끔(체력이 줄 일이 없다 — 목표 줄만)"];
  }
  const premise = premiseOf(project, story);
  const theme = /공포|호러|귀신|유령|괴담|좀비|horror/iu.test(premise) ? "horror" : !action && /마왕|용사|기사|판타지|RPG|던전/iu.test(premise) ? "classic" : "hearts";
  // 목표 줄은 둔다(기본 HUD 에서도 보이던 줄) — normalizeFieldHud 는 빠진 objective 를 끈다.
  const next = normalizeFieldHud({ theme, objective: true });
  delete next.widgets;
  project.system.fieldHud = next;
  return [`필드 HUD → ${theme}`];
}

/**
 * 필드 HUD 를 이 게임이 실제로 쓰는 것에 맞춘다 — 끝맺음마다 돈다(같은 게임에 두 번 돌아도 같은 결과).
 *  - 아무도 안 골랐거나 이야기 기본 템플릿 그대로면 fillFieldHud 가 고른다. 전에는 «HUD 선택» 관문이 모델에게 고르라고 시켰는데, 모델은 테마가 무엇을
 *    띄우는지 모른 채 이름으로 골랐다(2026-11-11 Terra 두 판 모두 adventure = 체력·마력 막대 + 도구 5칸 + 스태미나, 실시간 액션용).
 *  - 고른 테마가 띄우는 몸 게이지 가운데 이 게임이 쓰지 않는 것(체력이 줄 일이 없는데 체력, 마력 드는 기술이 없는데 마력, 액션 전투가 아닌데 스태미나)은 뺀다.
 *    그 판은 체력만 꺼서 「마력 43/43」 막대 하나가 모래 위에 혼자 떠 있었다.
 *  - 저자가 직접 짠 widgets(꽃잎 생명·호감 게이지)는 건드리지 않는다. 전에 뺀 게이지는 전투·기술이 생기면 돌아온다(asPresetHud).
 */
export function reconcileFieldHud(project: Project, story: string): string[] {
  if (project.system.fieldHud === undefined || hudIsStoryTemplate(project)) return fillFieldHud(project, story);
  const hud = asPresetHud(project.system.fieldHud);
  if (hud.widgets !== undefined) return [];
  // adventure 는 실시간 액션 전투의 HUD 다(체력·마력 막대 + 도구 5칸 + 스태미나 — 화면 왼쪽 위 3분의 1). 턴제 게임에 고른 것은 이름으로 고른 것이라
  // 함수가 고르는 값으로 바꾼다. 몸 게이지를 끄기로 한 것은 지킨다.
  if (hud.theme === "adventure" && project.system.actionCombat?.enabled !== true) {
    const notes = fillFieldHud(project, story);
    if (!hud.vitals && project.system.fieldHud) project.system.fieldHud = { ...project.system.fieldHud, vitals: false };
    return [`필드 HUD adventure(실시간 액션용)는 턴제 게임에 맞지 않아 바꿨다 — ${notes.join(" ")}`];
  }
  const shown = (config: typeof hud) => resolvedHudWidgets(config).map((w) => w.id).join(",");
  const unused = unusedHudGauges(hud, projectHudUse(project));
  const drop = new Set(unused.map((w) => w.id));
  const next = unused.length ? { ...hud, widgets: resolvedHudWidgets(hud).filter((w) => !drop.has(w.id)) } : hud;
  if (shown(next) === shown(project.system.fieldHud)) return [];
  project.system.fieldHud = next;
  return unused.length ? [`필드 HUD(${hud.theme})에서 이 게임이 쓰지 않는 게이지를 뺐다: ${unused.map((w) => w.label || HUD_SOURCES[w.source]).join(", ")}`] : [`필드 HUD(${hud.theme})에 전에 뺀 게이지를 되돌렸다(이제 쓰인다)`];
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
/** 이야기 글 — 청사진이 있으면 그것, 없으면(v1) 제목 + 요청 글. */
export const premiseOf = (project: Project, story: string): string => project.gameBlueprint ? blueprintPremiseText(project, project.gameBlueprint) : `${project.meta.title ?? ""} ${story}`.trim();

export function fillBattleBgm(project: Project, story: string): string[] {
  const fallback = String((factory().system as unknown as Obj).battleBgmResourceId ?? "");
  const premise = premiseOf(project, story);
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
 * 이 맵과 같은 종류라고 말할 수 있는 겹 배경 — 눈 기후, 던전·동굴(이름·칩셋), 숲·사막 이름, 버들항 들판 칩셋의 마을·들(평원).
 * 그 밖(실내 칩셋·도시 이름·모르는 칩셋)은 undefined — 다른 지형 그림을 짐작으로 깔지 않는다.
 */
function sameKindBackground(project: Project, mapId: string): string | undefined {
  const sure = climateBattleBackground(project, mapId) ?? dungeonBattleBackground(project, mapId);
  if (sure) return sure;
  if (isForestNamedMap(project, mapId)) return DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
  const named = placeNameBattleBackground(project, mapId);
  if (named === "battle-scenery-desert") return named;
  return project.maps[mapId]?.tilesetId === "beodeul_city" ? "battle-scenery-plains" : undefined;
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
 * 전투가 나는데 배경을 안 정한 맵에 그 장소의 배경을 맵 값으로 적는다. 차례: 세계·종류 표(place/placeTheme) → 같은 종류라고 말할 수 있는 겹 배경
 * (sameKindBackground) → 들어오는 길을 거꾸로 따라 가장 가까운 던전·동굴 조상(「마왕의 방」은 「마왕의 동굴」 안쪽이다) → «그 맵 그대로»(필드 화면).
 * 짐작으로 다른 지형 그림(실내 = 동굴, 도시 = 풀밭, 모르면 숲)을 깔지 않는다. 지형 태그 배경은 런타임에서 맵 값보다 앞서므로 그대로 이긴다.
 */
export function fillBattleBackgrounds(project: Project, evidence: string): string[] {
  const out: string[] = [];
  for (const mapId of [...new Set(evidence.split(",").map((s) => s.trim()).filter(Boolean))]) {
    const map = project.maps[mapId];
    if (!map || map.battleBackground) continue;
    // 세계 장소는 그 장소의 테마가 먼저다 — 이름 낱말로는 「잠든 태양의 피라미드」 가 사막인지 모른다(숲 배경이 됐다).
    const themed = applyThemeBackdrop(project, mapId);
    if (themed.note) { out.push(themed.note); continue; }
    const id = sameKindBackground(project, mapId) ?? nearestDungeonAncestor(project, mapId) ?? FIELD_BATTLE_BACKGROUND_ID;
    map.battleBackground = id;
    out.push(`전투 배경 ${map.name || mapId} → ${id}`);
  }
  return out;
}

/**
 * 도트 측면 전투가 있는 게임은 적 발밑에 이름표와 체력 막대를 띄운다(『폴른 스타』와 같은 기본 — battleLook.enemyNames·enemyHp).
 * 도트 측면 스킨은 원작처럼 적 체력을 숨기는 것이 기본이라, 얼마나 남았는지 모른 채 «공격» 만 누르게 됐다. 저작자가 이미 고른 칸은 그대로 둔다.
 */
export function fillEnemyHpLook(project: Project): string[] {
  const monsters = project.system.battleParty === "monsters" || project.system.monsterBattleParty === true || project.system.battleUiStyle === "pokemon";
  if (monsters || !battleSites(project).length) return [];
  const look = { ...(project.system.battleLook ?? {}) };
  if (look.enemyHp !== undefined && look.enemyNames !== undefined) return [];
  if (look.enemyHp === undefined) look.enemyHp = true;
  if (look.enemyNames === undefined) look.enemyNames = true;
  project.system.battleLook = look;
  return ["전투 화면 — 적 이름표·체력 막대 켬"];
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
  // 흉상(대화창)과 전투 그림이 둘 다 그 칩의 것인 칩이 먼저다 — 얼굴 낱장뿐인 칩은 그런 칩이 어느 검색어에도 없을 때만.
  // «청년 전사»(people5)는 흉상도 전투 그림도 없어 대화창에는 이름표만, 전투에는 다른 사람(기본 검사)이 섰다(2026-11-12 r1w-fun).
  // 다만 흉상은 «맞는 칩» 안에서만 앞선다: 성별이 어긋나거나 아이가 아닌데 아이 칩이면 흉상이 있어도 맞는 칩(낱장뿐이어도) 뒤다 —
  // 검색어 하나의 결과 12개에는 느슨하게 걸린 다른 성별·나이의 칩도 섞여 있다.
  const wanted = female ? "female" : "male";
  const child = /소녀|소년|아이|어린/u.test(text);
  const picks: (ChipPick | undefined)[] = [undefined, undefined, undefined, undefined]; // 맞음+흉상 · 맞음 · 안 맞음+흉상 · 안 맞음
  for (const query of queries) {
    for (const match of queryNpcGraphics(query, 12, overrides)) {
      const entry = match.entry;
      const asset = findCharsetAsset(entry.textureKey);
      if (!asset) continue;
      const key = `${asset.id}#${entry.characterIndex}`;
      if (avoid.has(key)) continue;
      const face = sharedFaceForCharset(entry.textureKey, entry.characterIndex)?.resourceId;
      if (!face) continue; // 짝 얼굴이 검토된 칩만 — 모습과 얼굴이 같은 인물이어야 한다.
      const misfit = (!!entry.gender && entry.gender !== "none" && entry.gender !== wanted) || (entry.age === "child" && !child);
      const whole = !!bustOfChip(entry.textureKey, entry.characterIndex) && !!charsetBattlerForCharacter(asset.id, entry.characterIndex);
      const slot = (misfit ? 2 : 0) + (whole ? 0 : 1);
      picks[slot] ??= { resourceId: asset.id, index: entry.characterIndex, label: entry.label, face };
      if (slot === 0) return picks[0];
    }
  }
  return picks.find((pick) => !!pick);
}

/**
 * 시작 파티 중 편집기 기본 칩·기본 얼굴이 남은 인물: 이름·청사진 이야기(장르·제목·목표·요청)로 공용 칩을 고르고 그 칩의 검토된 짝 얼굴을 준다.
 * 모델이 고른 칩은 두고 얼굴만 기본이면 그 칩의 짝 얼굴, 짝이 없으면 얼굴을 비운다(다른 인물 얼굴을 붙이지 않는다).
 */
export function fillPartyLooks(project: Project, story: string): string[] {
  const f = factory();
  const fActors = new Map(f.database.actors.map((a) => [a.id, a]));
  const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  const premise = premiseOf(project, story);
  const used = new Set<string>([...f.database.actors.filter((a) => (project.system.startActorIds ?? []).includes(a.id)).map((a) => `${a.characterResourceId}#${a.characterIndex ?? 0}`),
    ...party.map((a) => `${a.characterResourceId}#${a.characterIndex ?? 0}`)]);
  // 맵에 선 사람의 칩도 피한다 — 주인공이 마을 사람과 같은 얼굴로 서지 않게(사람을 놓을 때는 주인공 칩을 피하지만 주인공은 그 뒤에 정해진다).
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    const g = page.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    const asset = g?.sprite?.id ? findCharsetAsset(g.sprite.id) : undefined;
    if (asset && typeof g?.pattern === "number") used.add(`${asset.id}#${decodeCharsetFrameIndex(g.pattern).characterIndex}`);
  }
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
        // 전투에 서는 그림도 그 칩의 것으로 — 없는 칩이면 비워 런타임 기본에 맡긴다(다른 사람의 전투 그림을 남기지 않는다).
        const battler = charsetBattlerForCharacter(pick.resourceId, pick.index);
        if (battler) actor.battleCharacterResourceId = battler; else delete (actor as { battleCharacterResourceId?: string }).battleCharacterResourceId;
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
 * 청사진 제목+인물 id 해시로 하나. 프로젝트의 다른 인물·이벤트·청사진 인물 이름에 든 이름은 건너뛴다 — 같은 이름뿐 아니라 그 이름을 품은 것도
 * (2026-11-12 Haiku r1h-mystery: 용의자 「이도윤 (조카)」가 있는 게임의 주인공이 「도윤」이 되어 엔딩이 «도윤은 … 이 여정을 끝까지 걸어냈다» 로 맺었다).
 */
export function fillPartyNames(project: Project, story: string): string[] {
  const f = factory();
  const fActors = new Map(f.database.actors.map((a) => [a.id, a]));
  const taken = new Set<string>([...project.database.actors.map((a) => a.name.trim()), ...Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => String(e.name ?? "").trim())),
    ...(project.gameBlueprint?.steps ?? []).flatMap((s) => [s.who ?? "", s.event])].filter(Boolean));
  const used = (name: string) => [...taken].some((other) => other.includes(name));
  const seed = project.gameBlueprint?.title ?? project.meta.title ?? "";
  const out: string[] = [];
  for (const id of project.system.startActorIds ?? []) {
    const actor = project.database.actors.find((a) => a.id === id);
    if (!actor || fActors.get(id)?.name !== actor.name) continue;
    const chip = sharedChipLabel(actor.characterResourceId ?? "", actor.characterIndex ?? 0);
    const premise = project.gameBlueprint ? blueprintPremiseText(project, project.gameBlueprint) : story;
    const pool = FEMALE.test(`${chip} ${premise}`) ? FEMALE_NAMES : MALE_NAMES;
    const start = hashText(`${seed}|${id}`) % pool.length;
    const name = Array.from({ length: pool.length }, (_, i) => pool[(start + i) % pool.length]!).find((n) => !used(n));
    if (!name) continue;
    const relabeled = renameSpeaker(project, actor.name, name);
    out.push(`${actor.name} 이름 → ${name}${relabeled ? ` (대사 화자 ${relabeled}줄)` : ""}`);
    actor.name = name;
    taken.add(name);
  }
  return out;
}

/** 이름을 바꾼 인물의 옛 이름을 화자로 쓴 대사(text.speaker)를 새 이름으로 — 안 그러면 대사창에 「주인공」이 남는다. 바꾼 줄 수. */
function renameSpeaker(project: Project, from: string, to: string): number {
  let n = 0;
  const visit = (node: unknown, depth = 0): void => {
    if (depth > 24 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1); return; }
    const o = node as Obj;
    if (o.kind === "text" && typeof o.speaker === "string" && o.speaker.trim() === from) { o.speaker = to; n += 1; }
    for (const value of Object.values(o)) if (value && typeof value === "object") visit(value, depth + 1);
  };
  for (const map of Object.values(project.maps)) visit(map.events ?? []);
  visit(project.commonEvents ?? []);
  return n;
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
export function fillWindowLook(project: Project, story: string): string[] {
  const premise = project.gameBlueprint ? `${blueprintPremiseText(project, project.gameBlueprint)} ${project.gameBlueprint.ending.how}` : premiseOf(project, story);
  const style: NonNullable<Project["system"]["menuUiStyle"]> = /추리|탐정|미스터리|사건|탈출|밀실|escape|공포|호러|귀신|유령|horror/iu.test(premise) ? "journal"
    : /마왕|용사|기사|판타지|RPG|던전|전투|모험/iu.test(premise) || battleSitesExist(project) ? "classic" : "field-list";
  project.system.menuUiStyle = style;
  return [`메뉴 모양 → ${style}`];
}

const battleSitesExist = (project: Project): boolean => Object.values(project.maps).some((m) => JSON.stringify(m.events ?? []).includes('"battleProcessing"'));
