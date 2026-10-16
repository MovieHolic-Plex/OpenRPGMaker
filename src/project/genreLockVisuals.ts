// project/genreLockVisuals.ts
// 장르 잠금의 얼굴·전투 그림 쪽 판정(2026-10-16) — genreLock.ts(표·허용 판정)의 짝이고 genreLockCharsets.ts(걷기 칩)와 같은 방식이다.
// 도구 실행이 만든 draft 에서 **새로 생기거나 바뀐** 얼굴(faceset)·몬스터 전투 그림·트레이너 전투 그림·전투 배경·전투 화면 스킨만 보고, 허용 계열 밖이면:
//   1) 가장 가까운 허용 그림이 있으면 거부하고 그 그림을 알려 준다(무음 대체 금지).
//   2) 허용 그림 중 맞는 것이 아예 없는 칸(예: 사람 흉상·전신, 번들에 없는 몬스터)은 **거부 대신 「생성 대기」**로 저장한다 — 허용 밖 그림을 빼고 칸을 비워 두며,
//      어떻게 만들면 되는지(생성형 초상 경로·사람이 고르는 하네스)를 결과 경고로 알린다. 지어낸 그림을 넣지 않는다.
// 이미 그려진 그림(잠금 이전부터 있던 것)은 건드리지 않는다. 강제 대상은 조수·도구 경로(ctx.assistantRun)뿐 — 사용자의 손 편집은 막지 않는다.

import reviewedCatalog from "@/assets/sharedCharacterGraphics.json";
import trainerIndex from "../../public/assets/battle-trainers/index.json";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import expressionSources from "../../scripts/shared-face-expression-sources.json";
import { facePresentationForResource } from "./facePresentation";
import { activeGenreLock, type ActiveGenreLock } from "./genreLock";
import {
  BACKDROP_FAMILY_LABELS, BATTLER_FAMILY_LABELS, FACE_FAMILY_LABELS, TRAINER_ART_FAMILY_LABELS,
  backdropFamilyOf, battlerFamilyOf, faceFamilyOf, skinFamilyOf, trainerArtFamilyOf,
} from "./visualFamily";
import type { Project } from "./types";

export type VisualKind = "face" | "battler" | "trainer" | "backdrop";

const KIND_LABELS: Readonly<Record<VisualKind, string>> = { face: "얼굴·흉상·전신", battler: "몬스터 전투 그림", trainer: "트레이너 전투 그림", backdrop: "전투 배경" };

/** 번들 트레이너 역할 id → 보기 좋은 이름·화면 방향. */
const TRAINER_ROLES: ReadonlyMap<string, { readonly label: string; readonly view: "front" | "back" }> = new Map(
  Object.entries((trainerIndex as { trainers: Record<string, { label: string; view: "front" | "back" }> }).trainers).map(([role, entry]) => [role, { label: entry.label, view: entry.view }]),
);
const BUNDLED_TRAINER_ROLES: ReadonlySet<string> = new Set(TRAINER_ROLES.keys());

export interface VisualUse {
  readonly kind: VisualKind;
  /** 리소스 id(전투 배경은 `emerald:<갈래>` 표기도 그대로). */
  readonly id: string;
  /** 안정적인 소유자 키(배우·이벤트·적·종·적 그룹·지형·맵 id) — 명령 순서가 바뀌어도 새 선택으로 세지 않는다. */
  readonly owner: string;
  /** 같은 소유자 안에서 어느 칸인가(`faceResourceId`·`changeFace`·`front`·`back`·`trainer.front` …). */
  readonly slot: string;
  /** 안내 문장에 쓰는 위치(「맵 map_a 이벤트 ev_1」). */
  readonly where: string;
  /** 안내 문장에 쓰는 소유자 이름(적·종·적 그룹·이벤트 이름). 대안을 고르는 단서다. */
  readonly ownerName: string;
  /** 얼굴 전용: 표시 방식. */
  readonly presentation?: "face" | "bust" | "full";
  /** 이 그림을 칸에서 빼 「생성 대기」로 비운다. */
  readonly remove: () => void;
}

const use = (u: VisualUse): VisualUse => u;

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

// ── 사용처 수집 ───────────────────────────────────────────────────────────────────────────────────────

/** 이벤트·공용 이벤트·적 그룹 안의 얼굴(changeFace 명령·`face` 객체·`faceResourceId`)을 모두 센다. */
function walkFaces(value: unknown, owner: string, where: string, ownerName: string, out: VisualUse[], parent?: unknown[]): void {
  if (Array.isArray(value)) { for (const item of value) walkFaces(item, owner, where, ownerName, out, value); return; }
  const row = object(value);
  if (!row) return;
  if (row.kind === "changeFace" && typeof row.resourceId === "string" && row.resourceId) {
    const command = row, list = parent;
    out.push(use({
      kind: "face", id: row.resourceId, owner, slot: "changeFace", where, ownerName,
      presentation: (row.presentation as "face" | "bust" | "full" | undefined) ?? facePresentationForResource(row.resourceId),
      remove: () => { const at = list?.indexOf(command) ?? -1; if (at >= 0) list!.splice(at, 1); },
    }));
  }
  for (const [key, child] of Object.entries(row)) {
    if (key === "face" && object(child) && typeof object(child)!.resourceId === "string") {
      const face = object(child)!;
      out.push(use({
        kind: "face", id: face.resourceId as string, owner, slot: "face", where, ownerName,
        presentation: (face.presentation as "face" | "bust" | "full" | undefined) ?? facePresentationForResource(face.resourceId as string),
        remove: () => { delete row.face; },
      }));
    } else if (key === "faceResourceId" && typeof child === "string" && child) {
      out.push(use({ kind: "face", id: child, owner, slot: "faceResourceId", where, ownerName, presentation: facePresentationForResource(child), remove: () => { delete row.faceResourceId; } }));
    } else if (child && typeof child === "object") walkFaces(child, owner, where, ownerName, out, undefined);
  }
}

export function collectFaceUses(project: Project): VisualUse[] {
  const out: VisualUse[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) walkFaces(event, `map:${map.id}/${event.id}`, `맵 ${map.id} 이벤트 ${event.id}「${event.name ?? ""}」`, event.name ?? event.id, out);
  }
  for (const actor of project.database.actors) walkFaces(actor, `actor:${actor.id}`, `배우 ${actor.id}「${actor.name ?? ""}」`, actor.name ?? actor.id, out);
  for (const common of project.commonEvents) walkFaces(common, `common:${common.id}`, `공용 이벤트 ${common.id}`, common.id, out);
  for (const troop of project.database.troops) walkFaces({ battleEventPages: troop.battleEventPages, afterBattle: troop.afterBattle }, `troop:${troop.id}`, `적 그룹 ${troop.id}`, troop.name, out);
  for (const appearance of project.database.characterAppearances ?? []) {
    for (const slot of ["face", "bust", "full"] as const) {
      const ref = appearance[slot];
      if (ref?.resourceId) out.push(use({ kind: "face", id: ref.resourceId, owner: `appearance:${appearance.id}`, slot, where: `캐릭터 외형 ${appearance.id}「${appearance.name}」`, ownerName: appearance.name, presentation: slot, remove: () => { delete appearance[slot]; } }));
    }
  }
  return out;
}

export function collectBattleUses(project: Project): VisualUse[] {
  const out: VisualUse[] = [];
  for (const enemy of project.database.enemies) {
    if (enemy.monsterResourceId) out.push(use({ kind: "battler", id: enemy.monsterResourceId, owner: `enemy:${enemy.id}`, slot: "front", where: `적 ${enemy.id}「${enemy.name}」`, ownerName: enemy.name, remove: () => { delete enemy.monsterResourceId; } }));
  }
  for (const species of project.database.monsterSpecies ?? []) {
    for (const [slot, key] of [["front", "monsterResourceId"], ["back", "backResourceId"]] as const) {
      const id = species.graphic?.[key];
      if (id) out.push(use({ kind: "battler", id, owner: `species:${species.id}`, slot, where: `몬스터 종 ${species.id}「${species.name}」`, ownerName: species.name, remove: () => { delete species.graphic[key]; } }));
    }
  }
  for (const troop of project.database.troops) {
    const where = `적 그룹 ${troop.id}「${troop.name}」`;
    const sprite = troop.trainerSprite;
    if (sprite) {
      for (const slot of ["front", "back", "throw", "backThrow"] as const) {
        const id = sprite[slot];
        if (id) out.push(use({ kind: "trainer", id, owner: `troop:${troop.id}`, slot, where, ownerName: troop.name, remove: () => { if (slot === "front") delete troop.trainerSprite; else delete sprite[slot]; } }));
      }
    }
    if (troop.previewBackgroundResourceId) out.push(use({ kind: "backdrop", id: troop.previewBackgroundResourceId, owner: `troop:${troop.id}`, slot: "previewBackground", where, ownerName: troop.name, remove: () => { delete troop.previewBackgroundResourceId; } }));
    for (const [index, layer] of (troop.backdropLayers ?? []).entries()) {
      if (layer.resourceId) out.push(use({ kind: "backdrop", id: layer.resourceId, owner: `troop:${troop.id}`, slot: `layer${index}`, where, ownerName: troop.name, remove: () => { delete layer.resourceId; } }));
    }
  }
  for (const terrain of project.database.terrains ?? []) {
    if (terrain.battleBackgroundResourceId) out.push(use({ kind: "backdrop", id: terrain.battleBackgroundResourceId, owner: `terrain:${terrain.id}`, slot: "terrainBackground", where: `지형 ${terrain.id}「${terrain.name}」`, ownerName: terrain.name, remove: () => { delete terrain.battleBackgroundResourceId; } }));
  }
  for (const map of Object.values(project.maps)) {
    if (map.battleBackground) out.push(use({ kind: "backdrop", id: map.battleBackground, owner: `map:${map.id}`, slot: "mapBackground", where: `맵 ${map.id}「${map.name}」`, ownerName: map.name, remove: () => { delete map.battleBackground; } }));
  }
  return out;
}

// ── 허용 판정 ─────────────────────────────────────────────────────────────────────────────────────────

/** 이 그림이 잠금 허용 계열인가. 잠금이 없거나 이 장르가 그 종류를 안 잠그면 항상 true. */
export function genreLockAllowsVisual(project: Pick<Project, "system" | "assets">, kind: VisualKind, id: string): boolean {
  const active = activeGenreLock(project);
  if (!active) return true;
  if (kind === "face") return !active.allowedFaces || active.allowedFaces.has(faceFamilyOf(project, id));
  if (!active.allowedBattle) return true;
  switch (kind) {
    case "battler": return active.allowedBattle.has(`battler:${battlerFamilyOf(project, id)}`);
    case "trainer": return active.allowedBattle.has(`trainer:${trainerArtFamilyOf(project, id, BUNDLED_TRAINER_ROLES)}`);
    case "backdrop": return active.allowedBattle.has(`backdrop:${backdropFamilyOf(project, id)}`);
  }
}

function familyLabel(project: Project, kind: VisualKind, id: string): string {
  switch (kind) {
    case "face": return FACE_FAMILY_LABELS[faceFamilyOf(project, id)];
    case "battler": return BATTLER_FAMILY_LABELS[battlerFamilyOf(project, id)];
    case "trainer": return TRAINER_ART_FAMILY_LABELS[trainerArtFamilyOf(project, id, BUNDLED_TRAINER_ROLES)];
    case "backdrop": return BACKDROP_FAMILY_LABELS[backdropFamilyOf(project, id)];
  }
}

function allowedLabels(active: ActiveGenreLock, kind: VisualKind): string {
  if (kind === "face") return [...(active.allowedFaces ?? [])].map((family) => FACE_FAMILY_LABELS[family as keyof typeof FACE_FAMILY_LABELS] ?? family).join("·");
  const prefix = `${kind}:`;
  const labels = kind === "battler" ? BATTLER_FAMILY_LABELS : kind === "trainer" ? TRAINER_ART_FAMILY_LABELS : BACKDROP_FAMILY_LABELS;
  return [...(active.allowedBattle ?? [])].filter((family) => family.startsWith(prefix)).map((family) => (labels as Record<string, string>)[family.slice(prefix.length)] ?? family).join("·");
}

// ── 가장 가까운 허용 그림 ────────────────────────────────────────────────────────────────────────────

export interface VisualAlternative {
  readonly id: string;
  readonly label: string;
  /** 같이 지정해야 하는 칸(몬스터 뒷모습 등). */
  readonly note?: string;
}

const norm = (value: string): string => value.normalize("NFKC").toLowerCase();
/** 어느 몬스터 그림에나 붙는 말 — 이름 겹침 판정에서 뺀다(안 빼면 「enemy」 한 낱말로 아무 그림이나 가장 가까운 대안이 된다). */
const GENERIC_WORDS: ReadonlySet<string> = new Set(["monster", "monsters", "enemy", "enemies", "generated", "harness", "scarloxy", "easyrpg", "front", "back", "boss", "몬스터", "적", "괴물", "보스", "야생", "야생의"]);
const wordsOf = (value: string): string[] => norm(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1 && !/^\d+$/u.test(word) && !GENERIC_WORDS.has(word));

type MappingRow = { textureKey: string; characterIndex: number; status: string; faceResourceId: string | null };
const MAPPINGS = reviewedCatalog.mappings as readonly MappingRow[];

/** 공용 표정 세트 줄기 → 원본 얼굴 id(`easyrpg-faceset-actor1-00`). 표정 세트·흉상·전신이 어느 인물에서 파생됐는지 가린다. */
const SET_BASE_FACE: ReadonlyMap<string, string> = new Map(
  (expressionSources as readonly { stem: string; baseSheet: string; baseCell: number }[]).map((source) =>
    [`shared-${source.stem}`, `easyrpg-faceset-${source.baseSheet.toLowerCase()}-${String(source.baseCell).padStart(2, "0")}`]),
);

function baseFaceIdOf(id: string): string {
  const match = /^(shared-.+?-expressions)(?:-|$)/u.exec(id.toLowerCase());
  return (match && SET_BASE_FACE.get(match[1]!)) ?? id;
}

/** 걷기 칩 소유자(이벤트·배우)의 칩 위치. 소유자 키로 찾는다. */
function ownerChip(project: Project, owner: string): { resourceId: string; characterIndex: number } | undefined {
  if (owner.startsWith("actor:")) {
    const actor = project.database.actors.find((entry) => entry.id === owner.slice(6));
    return actor?.characterResourceId ? { resourceId: actor.characterResourceId, characterIndex: actor.characterIndex ?? 0 } : undefined;
  }
  const match = /^map:([^/]+)\/(.+)$/u.exec(owner);
  const event = match ? project.maps[match[1]!]?.events.find((entry) => entry.id === match[2]) : undefined;
  const graphic = event?.pages?.find((page) => page.graphic?.sprite && !page.graphic.transparent)?.graphic;
  const sprite = graphic?.sprite;
  return sprite ? { resourceId: sprite.id, characterIndex: decodeCharsetFrameIndex(typeof graphic?.pattern === "number" ? graphic.pattern : 0).characterIndex } : undefined;
}

/** 허용 얼굴 중 가장 가까운 것. 소유자 걷기 칩의 짝 얼굴이 허용이면 그것, 아니면 성별·나이가 맞는 허용 사람 얼굴. 흉상·전신은 허용 계열에 없다. */
export function genreLockFaceAlternative(project: Project, rejected: VisualUse): VisualAlternative | undefined {
  const active = activeGenreLock(project);
  if (!active?.allowedFaces || rejected.presentation === "bust" || rejected.presentation === "full") return undefined;
  const chip = ownerChip(project, rejected.owner);
  const paired = chip ? reviewedFaceIdForCharset(chip.resourceId, chip.characterIndex) : undefined;
  if (paired && genreLockAllowsVisual(project, "face", paired) && facePresentationForResource(paired) === "face") {
    return { id: paired, label: "이 인물 걷기 그림의 짝 얼굴", note: "faceResourceId 를 생략해도 짝 얼굴이 자동으로 붙는다" };
  }
  const base = baseFaceIdOf(rejected.id);
  const wantedChip = MAPPINGS.find((row) => row.faceResourceId === base);
  const wanted = wantedChip ? findCharsetSemantic(wantedChip.textureKey, wantedChip.characterIndex) : undefined;
  const candidates = MAPPINGS
    .filter((row) => row.status === "mapped" && row.faceResourceId && faceFamilyOf(project, row.faceResourceId) === "scarloxy-face")
    .map((row) => ({ row, semantic: findCharsetSemantic(row.textureKey, row.characterIndex) }))
    .map((entry) => ({ ...entry, score: (wanted?.gender && entry.semantic?.gender === wanted.gender ? 2 : 0) + (wanted?.age && entry.semantic?.age === wanted.age ? 1 : 0) }))
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best ? { id: best.row.faceResourceId!, label: findCharsetSemantic(best.row.textureKey, best.row.characterIndex)?.label ?? best.row.faceResourceId! } : undefined;
}

/** 이름·태그가 겹치는 허용 몬스터 그림. 겹치는 낱말이 하나도 없으면 undefined(지어내지 않는다 — 「생성 대기」). */
export function genreLockBattlerAlternative(project: Project, rejected: VisualUse): VisualAlternative | undefined {
  const active = activeGenreLock(project);
  if (!active?.allowedBattle) return undefined;
  const all = listMonsterResources(project);
  const old = all.find((resource) => resource.resourceId === rejected.id);
  // 거부된 그림의 이름·태그(슬라임·해골 …)와 소유자 이름이 단서다. 제네릭 낱말은 wordsOf 가 뺀다.
  const wanted = new Set([...wordsOf(rejected.ownerName), ...(old ? [...wordsOf(old.name), ...old.tags.flatMap(wordsOf)] : []), ...wordsOf(rejected.id)]);
  const front = rejected.slot !== "back";
  const scored = all
    .filter((resource) => genreLockAllowsVisual(project, "battler", resource.resourceId))
    .filter((resource) => !front || !/-back$/u.test(resource.resourceId))
    .map((resource) => ({ resource, score: [...new Set([...wordsOf(resource.name), ...resource.tags.flatMap(wordsOf), ...wordsOf(resource.resourceId)])].filter((word) => wanted.has(word)).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.resource;
  if (!best) return undefined;
  const back = /^harness-monster-(.+)-front$/u.exec(best.resourceId);
  return { id: best.resourceId, label: best.name, ...(back ? { note: `뒷모습은 species.graphic.backResourceId = harness-monster-${back[1]}-back` } : {}) };
}

/** 소유자 이름·걷기 칩 의미로 고른 번들 트레이너 앞모습 역할. 근거가 없으면 undefined. */
function trainerRoleFor(project: Project, troopId: string, troopName: string): string | undefined {
  const text = norm(troopName);
  const keyword: readonly [RegExp, string][] = [
    [/물 도장|물 관장|water gym/u, "gym_water"], [/바위 도장|바위 관장|rock gym/u, "gym_rock"], [/낚시|fisher/u, "fisher"], [/등산|hiker/u, "hiker"],
    [/곤충|채집|bug catcher/u, "bug_catcher"], [/연구|박사|scientist/u, "scientist"], [/불량|펑크|punk/u, "punk"], [/노인|할아버지|할머니|elder/u, "elder"],
    [/소녀|아가씨|girl/u, "girl"], [/소년|boy/u, "boy"],
  ];
  for (const [pattern, role] of keyword) if (pattern.test(text)) return role;
  // 이 적 그룹과 싸우는 트레이너 이벤트의 걷기 칩 의미(성별·나이)로.
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const fights = JSON.stringify(event.pages ?? event.commands).includes(`"troopId":"${troopId}"`);
      if (!fights) continue;
      const graphic = event.pages?.find((page) => page.graphic?.sprite && !page.graphic.transparent)?.graphic;
      const sprite = graphic?.sprite;
      if (!sprite) continue;
      const semantic = findCharsetSemantic(sprite.id.startsWith("tex_") ? sprite.id : `tex_${sprite.id.replace(/-/gu, "_")}`, decodeCharsetFrameIndex(typeof graphic?.pattern === "number" ? graphic.pattern : 0).characterIndex);
      if (!semantic) continue;
      if (/물 도장/u.test(semantic.label)) return "gym_water";
      if (/도장 보스|관장/u.test(semantic.label)) return undefined;
      if (semantic.age === "elder") return "elder";
      if (semantic.gender === "female") return "girl";
      if (semantic.gender === "male" && (semantic.age === "child" || semantic.age === "youth")) return "boy";
    }
  }
  return undefined;
}

export function genreLockTrainerAlternative(project: Project, rejected: VisualUse): VisualAlternative | undefined {
  const active = activeGenreLock(project);
  if (!active?.allowedBattle) return undefined;
  const view = rejected.slot === "back" || rejected.slot === "backThrow" ? "back" : "front";
  if (view === "back") return { id: "hero_m", label: TRAINER_ROLES.get("hero_m")?.label ?? "hero_m", note: "여성 주인공이면 hero_f" };
  if (rejected.slot === "throw" || rejected.slot === "backThrow") return undefined;
  const role = trainerRoleFor(project, rejected.owner.replace(/^troop:/u, ""), rejected.ownerName);
  return role && TRAINER_ROLES.has(role) ? { id: role, label: TRAINER_ROLES.get(role)!.label } : undefined;
}

const BIOME_KEYWORDS: readonly [RegExp, string][] = [
  [/설원|눈|얼음|snow|ice/u, "snow"], [/사막|모래|desert|sand/u, "desert"], [/동굴|던전|cave|dungeon|지하/u, "cave"], [/숲|forest|wood/u, "forest"],
];

export function genreLockBackdropAlternative(project: Project, rejected: VisualUse): VisualAlternative | undefined {
  const active = activeGenreLock(project);
  if (!active?.allowedBattle) return undefined;
  const text = norm(`${rejected.id} ${rejected.ownerName}`);
  const biome = BIOME_KEYWORDS.find(([pattern]) => pattern.test(text))?.[1] ?? "plains";
  return { id: `battle-scenery-${biome}`, label: `도트 겹 배경(${biome})`, note: "몬스터 대치 스킨은 이 id 를 줄무늬 정본 바닥으로 풀고, 도트 측면 스킨은 겹 배경으로 푼다" };
}

function alternativeFor(project: Project, violation: VisualUse): VisualAlternative | undefined {
  switch (violation.kind) {
    case "face": return genreLockFaceAlternative(project, violation);
    case "battler": return genreLockBattlerAlternative(project, violation);
    case "trainer": return genreLockTrainerAlternative(project, violation);
    case "backdrop": return genreLockBackdropAlternative(project, violation);
  }
}

// ── 거부·생성 대기 문장 ──────────────────────────────────────────────────────────────────────────────

/** 「생성 대기」 안내 — 이 칸에 맞는 번들 그림이 없을 때 어떻게 채우는지. */
function pendingRoute(violation: VisualUse): string {
  switch (violation.kind) {
    case "face": return violation.presentation === "face"
      ? "얼굴은 비워 두었다(대사는 초상 없이 나온다). 이 인물의 얼굴이 꼭 필요하면 캐릭터 외형 DB 에 외형을 만들고 generate_character_appearance 로 사용자가 후보를 받게 한다 — 그 그림은 이 프로젝트에 올라가므로 허용된다."
      : "흉상·전신은 비워 두었다(이 장르 번들에는 사람 흉상·전신이 없다 — 얼굴만 나온다). 꼭 필요하면 캐릭터 외형 DB 에 외형을 만들고 generate_character_appearance 로 흉상 후보를 받게 한다(생성형 초상).";
    case "battler": return "전투 그림은 비워 두었다. 새 몬스터 그림(앞·뒷모습)은 사람이 고르는 하네스(npm run harness -- monster-collect-species)에서 만들고, 만든 그림이 번들에 들어오면 monsterResourceId·backResourceId 로 지정한다. 일반 적 그림으로 때우지 않는다.";
    case "trainer": return "트레이너 전투 그림은 비워 두었다(전투는 소개 연출 없이 시작한다). 새 트레이너 그림은 사람이 고르는 하네스(npm run harness -- battle-trainer-sprites)에서 만든다.";
    case "backdrop": return "";
  }
}

export function genreLockVisualRejection(project: Project, args: { toolName: string; violation: VisualUse; alternative: VisualAlternative | undefined }): string {
  const active = activeGenreLock(project)!;
  const { violation, alternative } = args;
  const visuals = active.def.visuals!;
  const label = `${violation.id}(${familyLabel(project, violation.kind, violation.id)})`;
  // 적 레코드의 그림이 종(species)에서 물려받은 것이면 도구 호출 인자로는 못 고친다 — 종의 그림을 먼저 허용 그림으로 바꾸라고 알린다.
  const enemy = violation.kind === "battler" && violation.owner.startsWith("enemy:") ? project.database.enemies.find((entry) => entry.id === violation.owner.slice(6)) : undefined;
  const inherited = enemy?.speciesId ? ` 이 적은 몬스터 종 ${enemy.speciesId} 의 그림을 물려받았다 — define_monster_species 로 그 종의 graphic.monsterResourceId 를 허용 그림으로 바꾼 뒤 다시 부르라.` : "";
  return `장르 잠금(${active.def.label}): 이 프로젝트는 ${visuals.kitNoun}(${KIND_LABELS[violation.kind]}: ${allowedLabels(active, violation.kind)})만 새 그림에 쓴다.${inherited} `
    + `${args.toolName} 이 ${violation.where} 의 ${KIND_LABELS[violation.kind]} 칸(${violation.slot})에 ${label} 을 쓰려 해 거부했다 — 다른 그림으로 바꿔 넣지 않았다. `
    + (alternative ? `가장 가까운 허용 그림: ${alternative.id}「${alternative.label}」${alternative.note ? ` (${alternative.note})` : ""} — 이것으로 다시 부르라. ` : "")
    + `list_resources 는 허용 그림만 보여 준다. 사용자가 정말 이 그림을 원하면 장르 잠금을 풀어야 한다(${active.def.relockHint}에서 끈다) — 조수가 임의로 풀지 않는다.`;
}

export function genreLockVisualPendingNote(project: Project, args: { toolName: string; violation: VisualUse }): string {
  const active = activeGenreLock(project)!;
  const { violation } = args;
  return `장르 잠금(${active.def.label}) — 생성 대기: ${args.toolName} 이 ${violation.where} 의 ${KIND_LABELS[violation.kind]} 칸(${violation.slot})에 허용 밖 그림 ${violation.id}(${familyLabel(project, violation.kind, violation.id)})를 지정했는데 `
    + `이 장르 번들에는 맞는 그림이 없다. ${pendingRoute(violation)}`;
}

export class GenreLockVisualError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenreLockVisualError";
  }
}

// ── 판정 입구 ─────────────────────────────────────────────────────────────────────────────────────────

const keyOf = (u: VisualUse): string => `${u.kind}|${u.owner}|${u.slot}|${u.id}`;

/** before → after 사이에 새로 생기거나 바뀐, 허용 밖 계열의 그림. 같은 칸·같은 그림 개수가 늘어난 만큼만 센다. */
export function genreLockVisualViolations(before: Project, after: Project): VisualUse[] {
  const active = activeGenreLock(after);
  if (!active?.allowedFaces && !active?.allowedBattle) return [];
  const seen = new Map<string, number>();
  for (const old of [...collectFaceUses(before), ...collectBattleUses(before)]) seen.set(keyOf(old), (seen.get(keyOf(old)) ?? 0) + 1);
  const out: VisualUse[] = [];
  for (const current of [...collectFaceUses(after), ...collectBattleUses(after)]) {
    const key = keyOf(current);
    const left = seen.get(key) ?? 0;
    if (left > 0) { seen.set(key, left - 1); continue; }
    if (!genreLockAllowsVisual(after, current.kind, current.id)) out.push(current);
  }
  return out;
}

/** 전투 화면 스킨: 허용 밖 스킨으로 **바뀐** 경우만(이미 그 스킨이던 프로젝트는 건드리지 않는다). 몬스터 수집은 몬스터 대치·도트 측면 둘 다 허용이라 보통 비어 있다. */
function skinViolation(before: Project, after: Project): string | undefined {
  const active = activeGenreLock(after);
  if (!active?.allowedBattle) return undefined;
  const skinOf = (project: Project): string => project.system.battleUiStyle ?? "retro2003";
  const next = skinOf(after);
  if (next === skinOf(before) || active.allowedBattle.has(skinFamilyOf(next))) return undefined;
  const allowed = [...active.allowedBattle].filter((family) => family.startsWith("skin:")).map((family) => family.slice(5)).join(" | ");
  return `장르 잠금(${active.def.label}): 전투 화면 스킨을 ${next} 로 바꾸려 해 거부했다 — 허용 스킨: ${allowed}. battleUiStyle 은 그대로 둔다.`;
}

export interface VisualEnforcement {
  readonly warnings: string[];
}

/**
 * 도구 실행이 만든 draft 의 얼굴·전투 그림 판정 입구(toolRunner 가 부른다).
 * enforce: 허용 그림이 있는 위반은 첫 건에서 GenreLockVisualError(대안 안내), 맞는 허용 그림이 없는 위반은 칸을 비워 「생성 대기」로 저장하고 경고로 남긴다.
 *          그림 없이 새로 생긴 트레이너 적 그룹에는 근거가 확실한 번들 트레이너 그림을 채운다.
 * warn: 막지도 바꾸지도 않고 경고만 낸다. 얼굴·전투 그림을 안 잠그는 장르·잠금 없음은 빈 배열.
 * `lenient` = 프로젝트 내용을 통째로 들이는 도구(캠페인 생성·장소 가져오기)는 막지 않고 개수만 알린다.
 */
export function enforceGenreLockVisuals(before: Project, draft: Project, args: { toolName: string; lenient?: boolean }): string[] {
  const active = activeGenreLock(draft);
  if (!active?.allowedFaces && !active?.allowedBattle) return [];
  const warnings: string[] = [];
  const pendingOwners = new Set<string>();
  const skin = skinViolation(before, draft);
  if (skin) {
    if (active.lock.mode === "enforce" && !args.lenient) throw new GenreLockVisualError(skin);
    warnings.push(`[경고 모드] ${skin}`);
  }
  const violations = genreLockVisualViolations(before, draft);
  if (violations.length) {
    if (args.lenient) {
      return [...warnings, `장르 잠금(${active.def.label}): ${args.toolName} 이 허용 밖 얼굴·전투 그림 ${violations.length}곳을 들여왔다(예: ${violations[0]!.where} ${violations[0]!.id}) — 통째로 들이는 도구라 막지 않았다. 그 그림은 ${active.def.visuals!.kitNoun}로 바꾸는 편이 맞다.`];
    }
    const planned = violations.map((violation) => ({ violation, alternative: alternativeFor(draft, violation) }));
    if (active.lock.mode !== "enforce") {
      return [...warnings, ...planned.map(({ violation, alternative }) => `[경고 모드] ${genreLockVisualRejection(draft, { toolName: args.toolName, violation, alternative })}`)];
    }
    const rejected = planned.find((entry) => entry.alternative);
    if (rejected) throw new GenreLockVisualError(genreLockVisualRejection(draft, { toolName: args.toolName, violation: rejected.violation, alternative: rejected.alternative }));
    for (const { violation } of planned) {
      violation.remove();
      warnings.push(genreLockVisualPendingNote(draft, { toolName: args.toolName, violation }));
      pendingOwners.add(violation.owner);
    }
  }
  if (active.lock.mode === "enforce" && !args.lenient) warnings.push(...fillTrainerSprites(before, draft, pendingOwners));
  return warnings;
}

/**
 * 이번에 새로 생겼거나 바뀐 트레이너 적 그룹이 전투 그림 없이 저장됐으면, 이름·걷기 칩 의미로 근거가 확실한 번들 트레이너 앞모습(+기본 주인공 뒷모습)을 채운다.
 * 근거가 없으면 지어내지 않고 「생성 대기」 안내만 남긴다. 저작자가 이미 정한 trainerSprite 는 건드리지 않는다.
 */
function fillTrainerSprites(before: Project, draft: Project, alreadyPending: ReadonlySet<string>): string[] {
  const warnings: string[] = [];
  const old = new Map(before.database.troops.map((troop) => [troop.id, JSON.stringify(troop)]));
  for (const troop of draft.database.troops) {
    // 몬스터 캠페인(mx_troop_*)의 트레이너 그림은 필드 이벤트의 걷기 칩에서 읽는다(emeraldTrainerIntro) — 여기서 채우면 그 규칙을 덮는다.
    if (troop.trainerBattle !== true || troop.trainerSprite || troop.id.startsWith("mx_troop_") || alreadyPending.has(`troop:${troop.id}`) || old.get(troop.id) === JSON.stringify(troop)) continue;
    const role = trainerRoleFor(draft, troop.id, troop.name);
    if (role && TRAINER_ROLES.get(role)?.view === "front") {
      troop.trainerSprite = { front: role, back: "hero_m" };
      warnings.push(`장르 잠금: 트레이너 적 그룹 ${troop.id}「${troop.name}」에 전투 그림 ${role}(앞모습)·hero_m(뒷모습)을 채웠다. 맞지 않으면 upsert_troop 의 trainerSprite 로 바꾼다(번들 역할: ${[...BUNDLED_TRAINER_ROLES].join(", ")}).`);
    } else {
      warnings.push(`장르 잠금 — 생성 대기: 트레이너 적 그룹 ${troop.id}「${troop.name}」에 맞는 번들 트레이너 전투 그림이 없어 비워 두었다(전투는 소개 연출 없이 시작한다). `
        + `번들 역할(${[...BUNDLED_TRAINER_ROLES].join(", ")}) 중 맞는 것이 있으면 upsert_troop 의 trainerSprite 로 지정하고, 없으면 사람이 고르는 하네스(npm run harness -- battle-trainer-sprites)에서 만든다.`);
    }
  }
  return warnings;
}

// ── 검색·기본 선택 필터(조수 도구 실행 구간) ────────────────────────────────────────────────────────

export interface VisualCatalogFilter {
  readonly face: (id: string) => boolean;
  readonly battler: (id: string) => boolean;
  readonly backdrop: (id: string) => boolean;
}

let activeCatalogFilter: VisualCatalogFilter | undefined;

/** 강제 중인 얼굴·전투 그림 잠금이 아니면 undefined. */
export function genreLockVisualCatalogFilter(project: Project): VisualCatalogFilter | undefined {
  const active = activeGenreLock(project);
  if (!active || active.lock.mode !== "enforce" || (!active.allowedFaces && !active.allowedBattle)) return undefined;
  return {
    face: (id) => genreLockAllowsVisual(project, "face", id),
    battler: (id) => genreLockAllowsVisual(project, "battler", id),
    backdrop: (id) => genreLockAllowsVisual(project, "backdrop", id),
  };
}

/** 동기 실행 구간에서만 켠다(try/finally 로 되돌린다) — 중간에 await 하는 비동기 도구에는 걸지 않는다. */
export function withGenreLockVisualCatalog<T>(filter: VisualCatalogFilter | undefined, run: () => T): T {
  const previous = activeCatalogFilter;
  activeCatalogFilter = filter;
  try { return run(); } finally { activeCatalogFilter = previous; }
}

/** 지금 도구 실행 구간에 걸려 있는 필터(없으면 undefined). */
export function activeGenreLockVisualCatalog(): VisualCatalogFilter | undefined {
  return activeCatalogFilter;
}

// ── 점검 보고(check_genre_lock) ────────────────────────────────────────────────────────────────────

export interface VisualPending {
  readonly kind: VisualKind;
  readonly where: string;
  readonly note: string;
}

export interface VisualOutsider {
  readonly kind: VisualKind;
  readonly id: string;
  readonly family: string;
  readonly where: string;
  readonly nearestAllowed: string | null;
}

export interface GenreLockVisualReport {
  readonly active: boolean;
  readonly faceFamilies: readonly string[];
  readonly battleFamilies: readonly string[];
  /** 지금 쓰이는 허용 밖 그림. 기본 DB 풀(전 장르 공용 배우·적·종 레코드)은 빼고, 장면에 놓였거나 게임이 쓰는 것만 센다. */
  readonly outsiders: readonly VisualOutsider[];
  /** 그림이 비어 「생성 대기」인 칸. */
  readonly pending: readonly VisualPending[];
}

/**
 * 장르 잠금 아래 얼굴·전투 그림 현황. 「기본 DB 풀」(새 프로젝트가 전 장르 공통으로 싣는 배우 100·적 100여 개·종 10개)은 게임이 쓰지 않으면 세지 않는다 —
 * 풀 전체를 위반으로 보고하면 항상 수백 건이라 쓸모가 없다. 세는 것: 이벤트·공용 이벤트의 얼굴, 시작 배우, 몬스터 도감(campaign) 종, 맵이 부르는 적 그룹의 적과 전투 그림·배경.
 */
export function genreLockVisualReport(project: Project): GenreLockVisualReport {
  const active = activeGenreLock(project);
  if (!active || (!active.allowedFaces && !active.allowedBattle)) return { active: false, faceFamilies: [], battleFamilies: [], outsiders: [], pending: [] };
  const startActors = new Set(project.system.startActorIds ?? []);
  const campaignSpecies = new Set(project.system.monsterCampaign?.speciesIds ?? []);
  const usedTroops = new Set<string>();
  for (const map of Object.values(project.maps)) {
    for (const entry of map.encounterTable ?? []) usedTroops.add(entry.troopId);
    for (const event of map.events) for (const match of JSON.stringify(event.pages ?? event.commands).matchAll(/"troopId":"([^"]+)"/gu)) usedTroops.add(match[1]!);
  }
  const usedEnemies = new Set(project.database.troops.filter((troop) => usedTroops.has(troop.id)).flatMap((troop) => troop.enemyIds));
  const considered = [...collectFaceUses(project), ...collectBattleUses(project)].filter((entry) => {
    if (entry.owner.startsWith("actor:")) return startActors.has(entry.owner.slice(6));
    if (entry.owner.startsWith("species:")) return campaignSpecies.has(entry.owner.slice(8));
    if (entry.owner.startsWith("enemy:")) return usedEnemies.has(entry.owner.slice(6));
    if (entry.owner.startsWith("troop:")) return usedTroops.has(entry.owner.slice(6));
    return true;
  });
  const outsiders = considered.filter((entry) => !genreLockAllowsVisual(project, entry.kind, entry.id)).map((entry): VisualOutsider => ({
    kind: entry.kind, id: entry.id, family: familyLabel(project, entry.kind, entry.id), where: `${entry.where} (${entry.slot})`, nearestAllowed: alternativeFor(project, entry)?.id ?? null,
  }));
  const pending: VisualPending[] = [];
  if (active.allowedBattle) {
    for (const troop of project.database.troops) {
      if (troop.trainerBattle === true && !troop.trainerSprite && !troop.id.startsWith("mx_troop_")) pending.push({ kind: "trainer", where: `적 그룹 ${troop.id}「${troop.name}」`, note: "트레이너 전투 그림 없음 — 번들 역할을 trainerSprite 로 지정하거나 battle-trainer-sprites 하네스에서 만든다" });
    }
    for (const species of project.database.monsterSpecies ?? []) {
      if (!species.graphic?.transparent && !species.graphic?.monsterResourceId) pending.push({ kind: "battler", where: `몬스터 종 ${species.id}「${species.name}」`, note: "몬스터 전투 그림 없음 — monster-collect-species 하네스에서 앞·뒷모습을 만든다" });
    }
    for (const enemy of project.database.enemies) {
      if (!enemy.transparent && !enemy.monsterResourceId) pending.push({ kind: "battler", where: `적 ${enemy.id}「${enemy.name}」`, note: "몬스터 전투 그림 없음" });
    }
  }
  return {
    active: true,
    faceFamilies: [...(active.allowedFaces ?? [])].map((family) => FACE_FAMILY_LABELS[family as keyof typeof FACE_FAMILY_LABELS] ?? family),
    battleFamilies: [...(active.allowedBattle ?? [])],
    outsiders, pending,
  };
}

/** 허용 얼굴·전투 그림 한 줄 요약(DB 화면 배지·안내용). 이 장르가 안 잠그면 빈 문자열. */
export function genreLockVisualSummary(project: Pick<Project, "system">): string {
  const active = activeGenreLock(project);
  if (!active?.def.visuals) return "";
  return active.def.visuals.kitNoun;
}
