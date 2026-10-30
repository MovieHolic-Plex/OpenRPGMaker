// project/genreLockCharsets.ts
// 장르 잠금의 캐릭터 칩 쪽 판정(2026-10-16) — genreLock.ts(표·허용 판정)의 짝이다.
// 맵 칩셋 잠금(assertGenreLock)과 같은 방식: 도구 실행이 만든 draft 에서 **새로 생기거나 바뀐** 걷기 그림만 보고, 허용 계열 밖이면 거부 + 가장 가까운 허용 대안을 알린다.
// 이미 그려진 그림(잠금 이전부터 있던 NPC·배우)은 건드리지 않는다. 강제 대상은 조수·도구 경로(ctx.assistantRun)뿐 — 사용자의 손 편집은 막지 않는다.

import { findCharsetAsset } from "@/assets/charsetCatalog";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { CHARSET_SEMANTICS, findCharsetSemantic, type CharsetSemanticEntry } from "@/assets/charsetSemantics";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { charsetFamilyOf, CHARSET_FAMILY_LABELS } from "./charsetFamily";
import { defaultPartyRecords } from "./defaults/defaultDatabasePartyRecords";
import { activeGenreLock, enableGenreLock, genreLockAllowsCharsetUse, genreLockCharsetFamiliesOfPreset, refreshGrandfatheredCharsets, type ActiveGenreLock, type GenreLockMode, type GenreLockPresetId } from "./genreLock";
import { faceFamilyOf } from "./visualFamily";
import { peopleChipCatalogFilter } from "./peopleChipLock";
import { battlerSourceChip, collectCharsetUses, type CharsetUse } from "./genreLockCharsetUses";
import type { Project } from "./types";

// 사용처 수집은 genreLock.ts 도 쓰므로 잎 모듈(genreLockCharsetUses.ts)로 옮겼다 — 기존 이름은 여기서 그대로 다시 내보낸다.
export { collectCharsetUses, type CharsetUse };

const textureKeyOf = (idOrTextureKey: string): string => findCharsetAsset(idOrTextureKey)?.textureKey ?? idOrTextureKey;

export interface CharsetViolation extends CharsetUse {
  readonly path: string;
}

/** before → after 사이에 새로 생기거나 바뀐, 허용 밖 계열의 걷기 그림. */
export function genreLockCharsetViolations(before: Project, after: Project): CharsetViolation[] {
  const active = activeGenreLock(after);
  if (!active?.allowedCharsets) return [];
  const old = collectCharsetUses(before);
  const out: CharsetViolation[] = [];
  for (const [path, use] of collectCharsetUses(after)) {
    const previous = old.get(path);
    if (previous && previous.resourceId === use.resourceId && previous.characterIndex === use.characterIndex) continue;
    if (genreLockAllowsCharsetUse(after, use)) continue;
    out.push({ ...use, path });
  }
  return out;
}

const PEOPLE_FAMILIES: ReadonlySet<string> = new Set(["rtp-people", "shared-actor", "scarloxy-people", "heroes", "modern", "refmap-doll"]);
const CREATURE_TAGS = ["몬스터", "동물", "생물"];

function isCreatureEntry(entry: CharsetSemanticEntry | undefined): boolean {
  return !!entry && (entry.gender === "none" || CREATURE_TAGS.some((tag) => entry.tags.includes(tag)));
}

interface RankedCharset { readonly entry: CharsetSemanticEntry; readonly score: number }

/**
 * 거부·교체할 칩과 비슷한 허용 칩 순위(좋은 것부터). 사람이면 허용 사람 칩 중 성별·나이가 맞는 것, 생물이면 허용 생물 칩.
 * 번들 의미표(charsetSemantics)에 있는 칸만 후보다. 허용 계열에 사람/생물 칩이 없으면 빈 배열.
 */
function rankedAlternatives(project: Pick<Project, "assets">, families: ReadonlySet<string>, rejected: { readonly resourceId: string; readonly characterIndex: number }, preferTag?: string): RankedCharset[] {
  const family = charsetFamilyOf(project, rejected.resourceId);
  const semantic = findCharsetSemantic(textureKeyOf(rejected.resourceId), rejected.characterIndex);
  const wantsPeople = PEOPLE_FAMILIES.has(family) || (family === "wizarding" && !isCreatureEntry(semantic));
  const score = (entry: CharsetSemanticEntry) => (semantic?.gender && entry.gender === semantic.gender ? 2 : 0) + (semantic?.age && entry.age === semantic.age ? 1 : 0)
    + (preferTag && entry.tags.includes(preferTag) ? 4 : 0);
  return CHARSET_SEMANTICS
    .filter((entry) => {
      const entryFamily = charsetFamilyOf(project, entry.textureKey);
      if (!families.has(entryFamily)) return false;
      // 허용 계열 안에서 사람이면 사람 칩 계열(트레이너·RTP·현대 인물 …) 어느 것이든 후보다 — 몬스터 잠금은 Scarloxy 만, 연애 잠금은 Modern 만 허용 목록에 있어 서로 섞이지 않는다.
      return wantsPeople ? PEOPLE_FAMILIES.has(entryFamily) : entryFamily === "oprn-creature" || entryFamily === "rtp-creature";
    })
    .map((entry) => ({ entry, score: score(entry) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * 순위 맨 위와 «같은 급» 후보 — 점수가 같거나, 나이만 어긋난 후보(점수 1 차이, 성별·보스 가중은 같음).
 * 점수 동률만 쓰면 성별·나이가 딱 맞는 칩이 하나뿐일 때 서로 다른 원본이 모두 그 한 칩으로 몰린다(poke-adv-lock-1 #8).
 */
function sameTierCandidates(ranked: readonly RankedCharset[]): RankedCharset[] {
  const tier = ranked[0]!.score >> 1;
  return ranked.filter((candidate) => (candidate.score >> 1) === tier);
}

export interface CharsetAlternative { readonly textureKey: string; readonly characterIndex: number; readonly label: string }

/** 거부한 칩과 가장 비슷한 허용 칩(안내용). 잠금이 없거나 허용 칩이 없으면 undefined. */
export function genreLockCharsetAlternative(project: Project, rejected: { readonly resourceId: string; readonly characterIndex: number }): CharsetAlternative | undefined {
  const active = activeGenreLock(project);
  if (!active?.allowedCharsets) return undefined;
  const best = rankedAlternatives(project, active.allowedCharsets, rejected)[0]?.entry;
  return best ? { textureKey: best.textureKey, characterIndex: best.characterIndex, label: best.label } : undefined;
}

function allowedCharsetLabels(active: ActiveGenreLock): string {
  return [...active.allowedCharsets!].map((id) => CHARSET_FAMILY_LABELS[id as keyof typeof CHARSET_FAMILY_LABELS] ?? id).join("·");
}

/** 거부 메시지 — 허용 계열, 가장 가까운 대안, 쓰는 법을 모두 싣는다. 무음 대체는 하지 않는다. */
export function genreLockCharsetRejection(project: Project, args: { toolName: string; violation: CharsetViolation }): string {
  const active = activeGenreLock(project)!;
  const { violation } = args;
  const kit = active.def.charsets!.kitNoun;
  if (violation.unresolved !== undefined) {
    return `장르 잠금(${active.def.label}): ${args.toolName} 이 ${violation.where} 에 캐릭터 외형 DB 에 없는 appearanceId「${violation.unresolved}」를 썼다 — 어떤 그림인지 알 수 없어 거부했다. `
      + `database.characterAppearances 에 실제로 있는 id 를 쓰거나, graphic 에 ${kit} 칩({textureKey, characterIndex})을 직접 적는다.`;
  }
  const semantic = findCharsetSemantic(textureKeyOf(violation.resourceId), violation.characterIndex);
  const label = semantic?.label ?? `${violation.resourceId}#${violation.characterIndex}`;
  const alt = genreLockCharsetAlternative(project, violation);
  if (violation.viaActor !== undefined) {
    return `장르 잠금(${active.def.label}): ${args.toolName} 이 ${violation.where} 에서 배우 ${violation.viaActor} 를 동료·파티로 부르려 했는데, 그 배우의 걷기 그림「${label}」(${CHARSET_FAMILY_LABELS[charsetFamilyOf(project, violation.resourceId)]})은 ${kit} 밖이라 거부했다 — 다른 배우로 바꿔 넣지 않았다. `
      + `${kit} 칩을 쓰는 배우를 부르거나, 이 배우를 쓰려면 upsert_actor 로 characterResourceId·characterIndex 를 허용 칩으로 먼저 바꾼다.`
      + (alt ? ` 가장 가까운 허용 칩: 「${alt.label}」(characterResourceId:"${alt.textureKey}", characterIndex:${alt.characterIndex}).` : "");
  }
  if (violation.battler !== undefined) {
    return `장르 잠금(${active.def.label}): ${args.toolName} 이 ${violation.where} 의 전투 그림 ${violation.battler}(원본 걷기 칩 「${label}」, ${CHARSET_FAMILY_LABELS[charsetFamilyOf(project, violation.resourceId)]})를 쓰려 해 거부했다 — ${kit} 계열에는 사람 전투 시트가 없다. `
      + `battleCharacterResourceId 는 비워 두라(걷기 칩에 맞는 기본 전투 그림이 자동으로 선다).`;
  }
  return `장르 잠금(${active.def.label}): 이 프로젝트는 ${kit}(${allowedCharsetLabels(active)})만 새 캐릭터 그림에 쓴다. `
    + `${args.toolName} 이 ${violation.where} 에 「${label}」(${violation.resourceId}#${violation.characterIndex}, ${CHARSET_FAMILY_LABELS[charsetFamilyOf(project, violation.resourceId)]})을 쓰려 해 거부했다 — 다른 그림으로 바꿔 넣지 않았다. `
    + (alt ? `가장 가까운 허용 칩: 「${alt.label}」 → graphic:{textureKey:"${alt.textureKey}", characterIndex:${alt.characterIndex}} 로 다시 부르라. ` : "")
    + `graphic 을 생략하거나 query 를 "villager"·"트레이너" 같은 일반 말로 주면 허용 칩이 알아서 골라지고, list_npc_graphics 도 허용 칩만 보여 준다. `
    + `사용자가 정말 이 그림을 원하면 장르 잠금을 풀어야 한다(${active.def.relockHint}에서 끈다) — 조수가 임의로 풀지 않는다.`;
}

export class GenreLockCharsetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenreLockCharsetError";
  }
}

/**
 * 도구 실행이 만든 draft 의 캐릭터 그림 판정 입구(toolRunner 가 부른다).
 * enforce 면 첫 위반에서 GenreLockCharsetError, warn 이면 경고 문장 목록을 돌려준다. 캐릭터를 안 잠그는 장르·잠금 없음은 빈 배열.
 * `lenient` = 프로젝트 내용을 통째로 들이는 도구(캠페인 생성·장소 가져오기)는 막지 않고 개수만 알린다.
 */
export function assertGenreLockCharsets(before: Project, draft: Project, args: { toolName: string; lenient?: boolean }): string[] {
  const active = activeGenreLock(draft);
  if (!active?.allowedCharsets) return [];
  const violations = genreLockCharsetViolations(before, draft);
  if (!violations.length) return [];
  if (args.lenient) {
    return [`장르 잠금(${active.def.label}): ${args.toolName} 이 허용 밖 캐릭터 그림 ${violations.length}곳을 들여왔다(예: ${violations[0]!.where}) — 통째로 들이는 도구라 막지 않았다. 그 그림은 ${active.def.charsets!.kitNoun}로 바꾸는 편이 맞다.`];
  }
  const message = genreLockCharsetRejection(draft, { toolName: args.toolName, violation: violations[0]! });
  if (active.lock.mode === "enforce") throw new GenreLockCharsetError(message);
  return [`[경고 모드] ${message}`];
}

function forwardCharsetFilter(project: Project): ((entry: Pick<CharsetSemanticEntry, "textureKey">) => boolean) | undefined {
  const active = activeGenreLock(project);
  if (!active?.allowedCharsets || active.lock.mode !== "enforce") return undefined;
  const allowed = active.allowedCharsets;
  return (entry) => allowed.has(charsetFamilyOf(project, entry.textureKey));
}

/**
 * 허용 칩만 보이게 하는 카탈로그 필터(조수 실행 중 list_npc_graphics·그림 질의·기본 선택이 쓴다). 강제 중인 캐릭터 잠금도 사람 칩 잠금(peopleChipLock.ts)도 없으면 undefined.
 * 두 잠금을 한 필터로 묶는다 — 기본 선택 경로가 이 필터로 withNpcGraphicCatalogFilter 를 다시 걸면 바깥 필터를 덮기 때문이다.
 */
export function genreLockCharsetCatalogFilter(project: Project): ((entry: Pick<CharsetSemanticEntry, "textureKey">) => boolean) | undefined {
  const forward = forwardCharsetFilter(project);
  const people = peopleChipCatalogFilter(project);
  return forward && people ? (entry) => forward(entry) && people(entry) : forward ?? people;
}

/** 장르 잠금이 캐릭터 칩을 허용 계열(칸이 적은 키트)로 강제하는가 — 다른 인물과 같은 칩 피하기를 프로젝트 전체로 넓히는 근거. */
export function genreLockLimitsCharsets(project: Project): boolean {
  return forwardCharsetFilter(project) !== undefined;
}

export interface CharsetRemapResult {
  /** 그림을 바꾼 이벤트 페이지 수. */
  readonly pagesChanged: number;
  /** 원래 칩 → 새 칩(안내·보고용). */
  readonly mapping: ReadonlyArray<{ readonly from: string; readonly to: string; readonly label: string }>;
}

/**
 * 새로 만든 프로젝트(캠페인 생성 직후)의 이벤트 걷기 그림 중 프리셋 허용 계열 밖인 것을 가장 비슷한 허용 칩으로 바꾼다.
 * 같은 원래 칩은 늘 같은 새 칩으로 가고(같은 인물이 맵마다 다른 사람이 되지 않는다), 비슷한 후보가 여럿이면 덜 쓴 칩부터 골라 한 칩에 몰리지 않게 한다.
 * 방향·걸음 모양(pattern)은 그대로 둔다. 이 함수는 **방금 생성한 프로젝트 전용**이다 — 저작자가 그린 기존 프로젝트에는 쓰지 않는다(잠금 켜기도 쓰지 않는다).
 * 업로드한 칩·허용 계열 칩·투명 그림은 건드리지 않는다.
 */
export function remapCharsetsToPreset(project: Project, preset: GenreLockPresetId): CharsetRemapResult {
  const families = genreLockCharsetFamiliesOfPreset(preset);
  if (!families) return { pagesChanged: 0, mapping: [] };
  const allowed = new Set<string>(families);
  const chosen = new Map<string, CharsetAlternative>();
  const usage = new Map<string, number>();
  const usageOf = (candidate: RankedCharset) => usage.get(`${candidate.entry.textureKey}#${candidate.entry.characterIndex}`) ?? 0;
  // 관장·보스 이벤트는 팩의 「도장 보스」 칩(물·불·풀 보스)을 우선한다 — 일반 주민 칩으로 가면 체육관 관장이 길손과 같아 보인다.
  const BOSS_EVENT = /(^|_)(gym_)?(leader|boss)$/u;
  let pagesChanged = 0;
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) {
        const graphic = page.graphic;
        const spriteId = graphic?.sprite?.id;
        if (!graphic || graphic.transparent || !spriteId || allowed.has(charsetFamilyOf(project, spriteId))) continue;
        const decoded = decodeCharsetFrameIndex(typeof graphic.pattern === "number" ? graphic.pattern : 0);
        const boss = BOSS_EVENT.test(event.id);
        const sourceKey = `${spriteId}#${decoded.characterIndex}${boss ? "|boss" : ""}`;
        let target = chosen.get(sourceKey);
        if (!target) {
          const ranked = rankedAlternatives(project, allowed, { resourceId: spriteId, characterIndex: decoded.characterIndex }, boss ? "보스" : undefined);
          if (!ranked.length) continue;
          const top = sameTierCandidates(ranked);
          const least = top.reduce((best, candidate) => (usageOf(candidate) < usageOf(best) ? candidate : best), top[0]!);
          target = { textureKey: least.entry.textureKey, characterIndex: least.entry.characterIndex, label: least.entry.label };
          chosen.set(sourceKey, target);
          usage.set(`${target.textureKey}#${target.characterIndex}`, usageOf(least) + 1);
        }
        page.graphic = {
          ...graphic,
          sprite: { type: "bundled", id: target.textureKey },
          pattern: charsetFrameIndex({ characterIndex: target.characterIndex, direction: decoded.direction, pattern: decoded.pattern }),
        };
        pagesChanged += 1;
      }
    }
  }
  return { pagesChanged, mapping: [...chosen].map(([from, to]) => ({ from, to: `${to.textureKey}#${to.characterIndex}`, label: to.label })) };
}

// ── 잠금을 켜는 순간의 정리(2026-10-16 잠금 누수 감사 #3·#4) ───────────────────────────────────────────────

export interface CharsetSettleResult {
  /** 허용 칩으로 바꾼, 손대지 않은 기본 명단 배우 수. */
  readonly rosterActorsRemapped: number;
  /** 허용 칩으로 바꾼 이벤트 페이지 수(작은 새 프로젝트일 때만). */
  readonly pagesRemapped: number;
  /** 정리 뒤에도 남은 허용 밖 칩 사용처(「잠금 이전부터 있던 칩」으로 기록된다 — 막지 않는다). */
  readonly remaining: number;
}

/**
 * 손대지 않은 **기본 명단 배우**(새 프로젝트가 장르와 무관하게 싣는 배우 100여 명)의 걷기 칩·얼굴·전투 그림을 허용 칩으로 바꾼다.
 * 저작자가 칩을 바꾼 배우·기본 명단에 없는 배우는 건드리지 않는다. 같은 원래 칩은 늘 같은 새 칩으로 가고, 비슷한 후보가 여럿이면 덜 쓴 칩부터 골라 한 칩에 몰리지 않는다.
 * 주인공(actor_hero)은 enableGenreLock 이 따로 맞춘다.
 */
function remapDefaultRosterActors(project: Project, active: ActiveGenreLock): number {
  const allowed = active.allowedCharsets;
  if (!allowed) return 0;
  const defaults = new Map(defaultPartyRecords().actors.map((actor) => [actor.id, actor]));
  const chosen = new Map<string, RankedCharset>();
  const usage = new Map<string, number>();
  const keyOf = (candidate: RankedCharset) => `${candidate.entry.textureKey}#${candidate.entry.characterIndex}`;
  let changed = 0;
  for (const actor of project.database.actors) {
    const base = defaults.get(actor.id);
    // 주인공: 걷기 칩·얼굴은 enableGenreLock 이 맞추지만, 칩이 이미 허용 계열인 주인공(몬스터 캠페인의 Scarloxy 트레이너)은 그 길이 일찍 끝나
    // 옛 RTP Actor1 전투 시트(charset-battler-actor1-0)가 남았다(감사 3판 lock #6). 허용 밖 걷기 칩 출처의 전투 그림만 비운다.
    if (actor.id === "actor_hero" && actor.battleCharacterResourceId !== undefined) {
      const heroBattler = battlerSourceChip(actor.battleCharacterResourceId);
      if (heroBattler && !allowed.has(charsetFamilyOf(project, heroBattler.resourceId))) { delete actor.battleCharacterResourceId; changed += 1; }
    }
    if (actor.id === "actor_hero" || !base || !actor.characterResourceId) continue;
    // 저작자가 바꾼 배우는 두는다 — 기본 칩 그대로인 배우만 기본 명단이다.
    if (actor.characterResourceId !== base.characterResourceId || (actor.characterIndex ?? 0) !== (base.characterIndex ?? 0)) continue;
    let touched = false;
    if (!allowed.has(charsetFamilyOf(project, actor.characterResourceId))) {
      const sourceKey = `${actor.characterResourceId}#${actor.characterIndex ?? 0}`;
      let target = chosen.get(sourceKey);
      if (!target) {
        const ranked = rankedAlternatives(project, allowed, { resourceId: actor.characterResourceId, characterIndex: actor.characterIndex ?? 0 });
        if (!ranked.length) continue;
        const top = sameTierCandidates(ranked);
        target = top.reduce((best, candidate) => ((usage.get(keyOf(candidate)) ?? 0) < (usage.get(keyOf(best)) ?? 0) ? candidate : best), top[0]!);
        chosen.set(sourceKey, target);
        usage.set(keyOf(target), (usage.get(keyOf(target)) ?? 0) + 1);
      }
      actor.characterResourceId = findCharsetAsset(target.entry.textureKey)?.id ?? target.entry.textureKey;
      actor.characterIndex = target.entry.characterIndex;
      touched = true;
    }
    // 얼굴: 허용 밖 얼굴이면 새 걷기 칩의 검토된 짝 얼굴로, 짝이 없으면 비운다(옛 칩의 얼굴이 새 칩과 어긋난 채 남지 않는다).
    // (동물 배우 7명의 People2 8~15 얼굴은 계열표상 「생물 얼굴」이라 허용이고, 비워 두어도 normalizeActorRecord 가 검토된 짝으로 다시 채운다 — 감사 3판 lock #4 메모.)
    if (actor.faceResourceId !== undefined && active.allowedFaces && !active.allowedFaces.has(faceFamilyOf(project, actor.faceResourceId))) {
      const paired = reviewedFaceIdForCharset(actor.characterResourceId, actor.characterIndex ?? 0);
      if (paired && active.allowedFaces.has(faceFamilyOf(project, paired))) actor.faceResourceId = paired; else delete actor.faceResourceId;
      touched = true;
    }
    // 전투 그림: 허용 계열에는 사람 전투 시트가 없으므로 허용 밖 걷기 칩에서 온 시트는 비운다(폴백 기본 도트가 선다).
    const battlerChip = actor.battleCharacterResourceId !== undefined ? battlerSourceChip(actor.battleCharacterResourceId) : undefined;
    if (battlerChip && !allowed.has(charsetFamilyOf(project, battlerChip.resourceId))) { delete actor.battleCharacterResourceId; touched = true; }
    if (touched) changed += 1;
  }
  return changed;
}

/** 이벤트 페이지 명령 속 changeFace 중 허용 밖 얼굴을 그 페이지(방금 허용 칩으로 바뀐) 걷기 칩의 짝 얼굴로 바꾼다. 짝이 없으면 그 명령을 뺀다(대사는 초상 없이 나온다). */
function settleEventFaces(project: Project, active: ActiveGenreLock): number {
  const faces = active.allowedFaces;
  if (!faces) return 0;
  let changed = 0;
  const walk = (list: unknown[], paired: string | undefined) => {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const item = list[index];
      if (Array.isArray(item)) { walk(item, paired); continue; }
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (row.kind === "changeFace" && typeof row.resourceId === "string" && !faces.has(faceFamilyOf(project, row.resourceId))) {
        if (paired) row.resourceId = paired; else list.splice(index, 1);
        changed += 1;
        continue;
      }
      for (const child of Object.values(row)) if (Array.isArray(child)) walk(child, paired);
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) {
        const sprite = page.graphic && !page.graphic.transparent ? page.graphic.sprite : undefined;
        const chip = sprite ? { resourceId: sprite.id, characterIndex: decodeCharsetFrameIndex(typeof page.graphic?.pattern === "number" ? page.graphic.pattern : 0).characterIndex } : undefined;
        const face = chip ? reviewedFaceIdForCharset(chip.resourceId, chip.characterIndex) : undefined;
        walk((page.commands ?? []) as unknown[], face && faces.has(faceFamilyOf(project, face)) ? face : undefined);
      }
    }
  }
  return changed;
}

/**
 * 방금 켠 잠금에 맞춰 이미 있던 캐릭터 그림을 정리한다 — enableGenreLock 이 true 를 돌려준 직후에 부른다.
 *  · 손대지 않은 기본 명단 배우는 허용 칩으로 바꾼다(항상).
 *  · 이벤트 페이지의 허용 밖 걷기 그림은 **작은 새 프로젝트(맵 하나 이하)에서 remapEvents 가 켜져 있을 때만** 바꾼다 — 여러 맵을 가진 저작 프로젝트의 그림은 막지도 바꾸지도 않고 보고만 한다.
 *  · 그래도 남은 허용 밖 칩은 「잠금 이전부터 있던 칩」으로 기록한다(check_genre_lock·프롬프트가 보고, genreLockReport.charsetPreexisting).
 */
export function settleCharsetsOnLock(project: Project, options: { readonly remapEvents?: boolean } = {}): CharsetSettleResult {
  const active = activeGenreLock(project);
  if (!active?.allowedCharsets) return { rosterActorsRemapped: 0, pagesRemapped: 0, remaining: 0 };
  const rosterActorsRemapped = remapDefaultRosterActors(project, active);
  const young = Object.keys(project.maps).length <= 1;
  const pagesRemapped = options.remapEvents !== false && young ? remapCharsetsToPreset(project, active.lock.preset).pagesChanged : 0;
  if (pagesRemapped) settleEventFaces(project, active);
  refreshGrandfatheredCharsets(project);
  return { rosterActorsRemapped, pagesRemapped, remaining: activeGenreLock(project)?.lock.grandfatheredCharsetPaths?.length ?? 0 };
}

/** enableGenreLock + settleCharsetsOnLock. 잠금이 새로 켜졌으면 true. 조수·프리셋 경로는 이것을 쓴다(손 편집 토글은 remapEvents:false). */
export function enableGenreLockSettled(project: Project, preset: GenreLockPresetId, mode: GenreLockMode = "enforce", options: { readonly remapEvents?: boolean } = {}): boolean {
  const changed = enableGenreLock(project, preset, mode);
  if (changed) settleCharsetsOnLock(project, options);
  return changed;
}
