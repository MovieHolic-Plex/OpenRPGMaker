// project/genreLockMonsterAssetsDiff.ts
// 몬스터 자산 역방향 잠금의 사용처 판정(2026-10-17) — genreLockMonsterAssets.ts(허용·거부 표)의 짝이다.
// 도구 실행이 만든 draft 에서 **새로 생기거나 바뀐** 몬스터 전용 칩셋·캐릭터 칩·얼굴·전투 그림·전투 스킨만 보고 거부한다 — 이미 그려진 것은 건드리지 않는다(기존 프로젝트 불변).
// 같은 방식의 정방향 판정은 genreLock.ts(assertGenreLock)·genreLockCharsets.ts·genreLockVisuals.ts. 조수·도구 경로(ctx.assistantRun)에서만 부른다.

import { collectCharsetUses } from "./genreLockCharsetUses";
import { BUNDLED_TRAINER_ROLE_IDS, collectBattleUses, collectFaceUses, type VisualCatalogFilter, type VisualUse } from "./genreLockVisuals";
import { isMonsterCollectOnlyCharset } from "./charsetFamily";
import { isMonsterTilesetId, monsterAssetsAllowed, monsterSystemFieldChanges, type MonsterAssetTurn } from "./genreLockMonsterAssets";
import { backdropFamilyOf, battlerFamilyOf, faceFamilyOf, trainerArtFamilyOf } from "./visualFamily";
import type { Project } from "./types";

type Evidence = Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>;

// ── 몬스터 전용 그림 판정(거부 목록의 그림 쪽 명시표) ──────────────────────────────────────────────
//   얼굴: scarloxy-face(Scarloxy 트레이너·도장 보스 얼굴) — OPRN 몬스터 얼굴·RTP 몬스터 얼굴은 일반 보스·적에도 쓰므로 허용
//   몬스터 전투 그림: scarloxy-monster · harness-monster — generic-enemy(슬라임·박쥐·골렘 …)·업로드는 허용
//   트레이너 전투 그림: 번들 역할 14종 전부(oprn-trainer) — 업로드·캠페인 전용 그림은 허용
//   전투 배경: scarloxy-backdrop · emerald-terrain · pokemon-backdrop — battle-scenery-*·RTP 파노라마·업로드는 허용
//   전투 화면 스킨: pokemon(몬스터 대치) — retro2003(도트 측면)은 허용
//   걷기 칩: Scarloxy 트레이너(scarloxy-people) · 몬스터 수집 하네스 칩 — RTP Monster·Animal·OPRN Monster4~6 은 허용
//   맵 칩셋: oprn-monster · oprn-monster-emerald — Scarloxy ChipSet(scarloxy)·버들항 등은 허용(몬스터 잠금도 허용 목록에 넣지 않는 장르 중립 시트)
export function monsterOnlyVisual(project: Pick<Project, "assets">, kind: VisualUse["kind"], id: string): boolean {
  switch (kind) {
    case "face": return faceFamilyOf(project, id) === "scarloxy-face";
    case "battler": { const family = battlerFamilyOf(project, id); return family === "scarloxy-monster" || family === "harness-monster"; }
    case "trainer": return trainerArtFamilyOf(project, id, BUNDLED_TRAINER_ROLE_IDS) === "oprn-trainer";
    case "backdrop": { const family = backdropFamilyOf(project, id); return family === "scarloxy-backdrop" || family === "emerald-terrain" || family === "pokemon-backdrop"; }
  }
}

export class MonsterAssetLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonsterAssetLockError";
  }
}

const KIND_LABEL: Readonly<Record<VisualUse["kind"], string>> = { face: "Scarloxy 트레이너 얼굴", battler: "몬스터 수집 전투 그림", trainer: "몬스터 수집 트레이너 전투 그림", backdrop: "몬스터 수집 전투 배경" };

const HOW_TO_UNLOCK = "사용자가 정말 몬스터 수집(포켓몬식) 게임을 원하는지 한 문장으로 되묻고 턴을 끝내라 — 원하면 「몬스터 수집 게임 만들어 줘」라고 말하는 요청 턴부터 풀린다. 조수가 임의로 풀지 않는다.";
const PREFIX = "몬스터 수집 잠금: 이 프로젝트는 몬스터 수집 게임이 아니고 이번 요청도 몬스터 수집 요청이 아니다";

export interface MonsterAssetViolation {
  readonly kind: "tileset" | "system" | "charset" | "visual";
  readonly where: string;
  readonly detail: string;
}

function tilesetViolations(before: Project, after: Project): MonsterAssetViolation[] {
  const out: MonsterAssetViolation[] = [];
  for (const [id, next] of Object.entries(after.maps)) {
    const previous = before.maps[id];
    if (previous && previous.tilesetId === next.tilesetId) continue;
    if (isMonsterTilesetId(after, next.tilesetId)) out.push({ kind: "tileset", where: `맵 ${id}「${next.name ?? ""}」`, detail: `칩셋 ${next.tilesetId}(몬스터 수집 칩셋)` });
  }
  return out;
}

/** 「maps/<맵>/events/<이벤트>」·「database/actors/<배우>」 처럼 그림 주인까지의 경로 — 페이지를 갈아 끼워도(replacePages) 같은 주인이다. */
const ownerOf = (path: string): string => path.split("/").slice(0, path.startsWith("maps/") ? 4 : 3).join("/");

function charsetViolations(before: Project, after: Project): MonsterAssetViolation[] {
  const old = collectCharsetUses(before);
  // 이미 그 이벤트·배우가 쓰던 칩은 그대로 둘 수 있다 — 기존 NPC 의 페이지를 다시 쓰면서 원래 그림을 지키려다 거부당해
  // 다른 칩으로 바꿔 버렸다(2026-10-25 빵집 주인). 새 칩만 막는다.
  const kept = new Set([...old].map(([path, use]) => `${ownerOf(path)}|${use.resourceId}|${use.characterIndex}`));
  const out: MonsterAssetViolation[] = [];
  for (const [path, use] of collectCharsetUses(after)) {
    const previous = old.get(path);
    if (previous && previous.resourceId === use.resourceId && previous.characterIndex === use.characterIndex) continue;
    if (kept.has(`${ownerOf(path)}|${use.resourceId}|${use.characterIndex}`)) continue;
    if (use.unresolved !== undefined || !use.resourceId) continue;
    if (isMonsterCollectOnlyCharset(after, use.resourceId)) out.push({ kind: "charset", where: use.where, detail: `캐릭터 칩 ${use.resourceId}#${use.characterIndex}(몬스터 수집 트레이너·하네스 칩)` });
  }
  return out;
}

const visualKey = (use: VisualUse): string => `${use.kind}|${use.owner}|${use.slot}|${use.id}`;

function visualViolations(before: Project, after: Project): MonsterAssetViolation[] {
  const seen = new Map<string, number>();
  for (const old of [...collectFaceUses(before), ...collectBattleUses(before)]) seen.set(visualKey(old), (seen.get(visualKey(old)) ?? 0) + 1);
  const out: MonsterAssetViolation[] = [];
  for (const current of [...collectFaceUses(after), ...collectBattleUses(after)]) {
    const left = seen.get(visualKey(current)) ?? 0;
    if (left > 0) { seen.set(visualKey(current), left - 1); continue; }
    if (monsterOnlyVisual(after, current.kind, current.id)) out.push({ kind: "visual", where: current.where, detail: `${KIND_LABEL[current.kind]} ${current.id}` });
  }
  return out;
}

/** before → after 사이에 새로 생기거나 바뀐 몬스터 전용 자산 전부. 몬스터 자산이 허용된 프로젝트·턴이면 빈 배열(before 로 판정 — 도구가 스스로 장르를 켜서 풀 수 없다). */
export function monsterAssetViolations(before: Project, after: Project, turn?: MonsterAssetTurn): MonsterAssetViolation[] {
  if (monsterAssetsAllowed(before as Evidence, turn)) return [];
  return [
    ...tilesetViolations(before, after),
    ...monsterSystemFieldChanges(before, after).map((field): MonsterAssetViolation => ({ kind: "system", where: field, detail: `시스템 설정 ${field}` })),
    ...charsetViolations(before, after),
    ...visualViolations(before, after),
  ];
}

function rejection(toolName: string, violation: MonsterAssetViolation): string {
  const alternative = violation.kind === "tileset" ? "허용 칩셋(버들항·이 프로젝트의 다른 계열)으로 맵을 만들거나 tilesetId 를 바꿔 다시 불러라."
    : violation.kind === "charset" ? "graphic 을 생략하거나 query 를 일반 말(villager·여행자·병사)로 주면 일반 칩이 골라지고, list_npc_graphics 가 이 프로젝트에서 쓸 수 있는 칩만 보여 준다."
    : violation.kind === "visual" ? "list_resources 가 이 프로젝트에서 쓸 수 있는 그림만 보여 준다 — 그 안에서 고르거나 그림 없이 둔다."
    : "그 시스템 설정은 건드리지 않는다(전투 방식은 기본 도트 측면).";
  return `${PREFIX} — ${toolName} 이 ${violation.where} 에 ${violation.detail} 를 쓰려 해 거부했다. ${alternative} ${HOW_TO_UNLOCK}`;
}

/**
 * 도구 실행이 만든 draft 의 몬스터 자산 판정 입구(toolRunner 가 부른다 — 조수·도구 경로만).
 * 칩셋·시스템 설정은 항상 거부한다. 캐릭터 칩·얼굴·전투 그림은 `lenient`(통째로 들이는 도구: 캠페인·장소 가져오기)면 막지 않고 개수만 경고한다 — 정방향 잠금과 같은 규칙.
 * 몬스터 자산이 허용된 프로젝트·턴은 아무것도 하지 않는다.
 */
export function assertMonsterAssetLock(before: Project, draft: Project, args: { toolName: string; turn?: MonsterAssetTurn; lenient?: boolean }): string[] {
  const violations = monsterAssetViolations(before, draft, args.turn);
  if (!violations.length) return [];
  const hard = violations.filter((violation) => violation.kind === "tileset" || violation.kind === "system" || !args.lenient);
  if (hard.length) throw new MonsterAssetLockError(rejection(args.toolName, hard[0]!));
  return [`${PREFIX} — ${args.toolName} 이 몬스터 수집 전용 그림 ${violations.length}곳을 들여왔다(예: ${violations[0]!.where} ${violations[0]!.detail}) — 통째로 들이는 도구라 막지 않았다. 그 그림은 이 프로젝트에서 새로 고르지 않는다.`];
}

// ── 검색·기본 선택 필터(조수 도구 실행 구간) ────────────────────────────────────────────────────────

/** 몬스터 자산이 막힌 프로젝트에서 조수 검색에 나오지 않게 하는 필터. 허용된 프로젝트·턴이면 undefined(아무것도 거르지 않는다). */
export function monsterAssetCatalogFilters(project: Project, turn?: MonsterAssetTurn): { readonly charset: (entry: { readonly textureKey: string }) => boolean; readonly visual: VisualCatalogFilter } | undefined {
  if (monsterAssetsAllowed(project as Evidence, turn)) return undefined;
  return {
    charset: (entry) => !isMonsterCollectOnlyCharset(project, entry.textureKey),
    visual: {
      face: (id) => !monsterOnlyVisual(project, "face", id),
      battler: (id) => !monsterOnlyVisual(project, "battler", id),
      backdrop: (id) => !monsterOnlyVisual(project, "backdrop", id),
    },
  };
}
