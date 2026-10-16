// project/genreLockCharsets.ts
// 장르 잠금의 캐릭터 칩 쪽 판정(2026-10-16) — genreLock.ts(표·허용 판정)의 짝이다.
// 맵 칩셋 잠금(assertGenreLock)과 같은 방식: 도구 실행이 만든 draft 에서 **새로 생기거나 바뀐** 걷기 그림만 보고, 허용 계열 밖이면 거부 + 가장 가까운 허용 대안을 알린다.
// 이미 그려진 그림(잠금 이전부터 있던 NPC·배우)은 건드리지 않는다. 강제 대상은 조수·도구 경로(ctx.assistantRun)뿐 — 사용자의 손 편집은 막지 않는다.

import { findCharsetAsset } from "@/assets/charsetCatalog";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { CHARSET_SEMANTICS, findCharsetSemantic, type CharsetSemanticEntry } from "@/assets/charsetSemantics";
import { charsetFamilyOf, CHARSET_FAMILY_LABELS } from "./charsetFamily";
import { activeGenreLock, genreLockAllowsCharset, genreLockCharsetFamiliesOfPreset, type ActiveGenreLock, type GenreLockPresetId } from "./genreLock";
import type { Project } from "./types";

const textureKeyOf = (idOrTextureKey: string): string => findCharsetAsset(idOrTextureKey)?.textureKey ?? idOrTextureKey;

export interface CharsetUse {
  /** 리소스 id 또는 텍스처 키(저장된 그대로). */
  readonly resourceId: string;
  readonly characterIndex: number;
  /** 안내 문장에 쓰는 위치(「맵 map_a 이벤트 ev_1」). */
  readonly where: string;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** 프로젝트가 가진 걷기 그림 사용처 전부. 키는 안정적인 id 경로(이벤트·페이지·배우 id)라 이동·삭제는 새 선택이 아니다. */
export function collectCharsetUses(project: Project): Map<string, CharsetUse> {
  const found = new Map<string, CharsetUse>();
  const add = (path: string, resourceId: unknown, characterIndex: number, where: string) => {
    if (typeof resourceId === "string" && resourceId) found.set(path, { resourceId, characterIndex, where });
  };
  const visit = (value: unknown, path: string, where: string) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}/${String(object(item)?.id ?? index)}`, where)); return; }
    const row = object(value);
    if (!row) return;
    const graphic = object(row.graphic);
    const sprite = object(graphic?.sprite);
    if (sprite && graphic?.transparent !== true) {
      add(`${path}/graphic`, sprite.id, decodeCharsetFrameIndex(typeof graphic?.pattern === "number" ? graphic.pattern : 0).characterIndex, where);
    }
    if (typeof row.characterResourceId === "string") add(`${path}/actor`, row.characterResourceId, typeof row.characterIndex === "number" ? row.characterIndex : 0, where);
    for (const [key, child] of Object.entries(row)) if (key !== "graphic" && child && typeof child === "object") visit(child, `${path}/${key}`, where);
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) visit(event, `maps/${map.id}/events/${event.id}`, `맵 ${map.id} 이벤트 ${event.id}「${event.name ?? ""}」`);
  }
  for (const actor of project.database.actors) visit(actor, `database/actors/${actor.id}`, `배우 ${actor.id}「${actor.name ?? ""}」`);
  for (const common of project.commonEvents) visit(common, `commonEvents/${common.id}`, `공용 이벤트 ${common.id}`);
  return found;
}

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
    if (genreLockAllowsCharset(after, use.resourceId)) continue;
    out.push({ ...use, path });
  }
  return out;
}

const PEOPLE_FAMILIES: ReadonlySet<string> = new Set(["rtp-people", "shared-actor", "scarloxy-people", "heroes", "modern"]);
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
      return wantsPeople ? entryFamily === "scarloxy-people" || entryFamily === "rtp-people" : entryFamily === "oprn-creature" || entryFamily === "rtp-creature";
    })
    .map((entry) => ({ entry, score: score(entry) }))
    .sort((a, b) => b.score - a.score);
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
  const semantic = findCharsetSemantic(textureKeyOf(violation.resourceId), violation.characterIndex);
  const label = semantic?.label ?? `${violation.resourceId}#${violation.characterIndex}`;
  const alt = genreLockCharsetAlternative(project, violation);
  const kit = active.def.charsets!.kitNoun;
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

/** 허용 칩만 보이게 하는 카탈로그 필터(조수 실행 중 list_npc_graphics·그림 질의가 쓴다). 강제 중인 캐릭터 잠금이 아니면 undefined. */
export function genreLockCharsetCatalogFilter(project: Project): ((entry: Pick<CharsetSemanticEntry, "textureKey">) => boolean) | undefined {
  const active = activeGenreLock(project);
  if (!active?.allowedCharsets || active.lock.mode !== "enforce") return undefined;
  const allowed = active.allowedCharsets;
  return (entry) => allowed.has(charsetFamilyOf(project, entry.textureKey));
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
          const top = ranked.filter((candidate) => candidate.score === ranked[0]!.score);
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
