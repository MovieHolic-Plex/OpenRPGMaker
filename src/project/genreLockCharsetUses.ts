// project/genreLockCharsetUses.ts
// 장르 잠금의 캐릭터 칩 「사용처 수집」(2026-10-16) — genreLock.ts(켤 때 기록)와 genreLockCharsets.ts(도구 판정)가 같이 쓰는 가벼운 잎 모듈이다.
// 의미표(charsetSemantics)·전투 시트표(charsetBattlers)를 끌어오지 않는다 — genreLock.ts 는 플레이어 번들에도 들어가므로(databaseRecordModel 이 가져온다) 에셋 표를 더하지 않는다.

import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Project } from "./types";

export interface CharsetUse {
  /** 리소스 id 또는 텍스처 키(저장된 그대로). 전투 그림이면 원본 걷기 칩의 리소스 id. */
  readonly resourceId: string;
  readonly characterIndex: number;
  /** 안내 문장에 쓰는 위치(「맵 map_a 이벤트 ev_1」). */
  readonly where: string;
  /** 걷기 그림을 직접 적은 것이 아니라 이 배우의 걷기 그림을 가리키는 명령(addFollower·changeParty)이면 그 배우 id(2026-10-16 잠금 누수 감사 #4). */
  readonly viaActor?: string;
  /** 배우의 전투 그림(battleCharacterResourceId)이면 그 그림 id — 원본 걷기 칩 계열로 판정한다(#6). */
  readonly battler?: string;
  /** 풀 수 없는 참조(캐릭터 외형 DB 에 없는 appearanceId) — 항상 허용 밖으로 본다(#10). 값 = 그 id. */
  readonly unresolved?: string;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/**
 * 전투 그림 id 의 원본 걷기 칩. 걷기 칩 전투 시트(`charset-battler-actor1-3`·`…-people2-0`·`…-actor3-0-samurai`)와 파티 도트 시트(`party-pixel-animal-0`)만 풀린다 —
 * 직접 저작한 그림(silver-swordswoman 등)은 걷기 칩이 아니라 undefined(계열 없음 = 판정 밖).
 */
export function battlerSourceChip(battlerId: string): { readonly resourceId: string; readonly characterIndex: number } | undefined {
  const walk = /^charset-battler-(actor[1-4]|people[1-5])-([0-7])(?:-|$)/u.exec(battlerId);
  if (walk) return { resourceId: `easyrpg-charset-${walk[1]}`, characterIndex: Number(walk[2]) };
  const refmap = /^charset-battler-refmap-doll(\d+)-([0-7])$/u.exec(battlerId);
  if (refmap) return { resourceId: `oprn-charset-refmap-doll${refmap[1]}`, characterIndex: Number(refmap[2]) };
  const pixel = /^party-pixel-(actor[1-4]|people[1-5]|monster[1-6]|animal)-([0-9])$/u.exec(battlerId);
  if (pixel) return { resourceId: `easyrpg-charset-${pixel[1]}`, characterIndex: Number(pixel[2]) };
  return undefined;
}

/** 프로젝트가 가진 걷기 그림 사용처 전부. 키는 안정적인 id 경로(이벤트·페이지·배우 id)라 이동·삭제는 새 선택이 아니다. */
export function collectCharsetUses(project: Pick<Project, "maps" | "database" | "commonEvents">): Map<string, CharsetUse> {
  const found = new Map<string, CharsetUse>();
  const actors = new Map(project.database.actors.map((actor) => [actor.id, actor]));
  const appearances = new Map((project.database.characterAppearances ?? []).map((look) => [look.id, look]));
  const add = (path: string, resourceId: unknown, characterIndex: number, where: string, extra: Partial<CharsetUse> = {}) => {
    if (typeof resourceId === "string" && resourceId) found.set(path, { resourceId, characterIndex, where, ...extra });
  };
  // 배우 id 로 걷기 그림을 가리키는 명령 — 그 배우의 칩이 곧 화면에 나온다.
  const addActorRef = (path: string, actorId: string, where: string) => {
    const actor = actors.get(actorId);
    if (actor?.characterResourceId) add(path, actor.characterResourceId, actor.characterIndex ?? 0, where, { viaActor: actorId });
  };
  const addAppearance = (path: string, appearanceId: string, where: string) => {
    const look = appearances.get(appearanceId);
    if (!look) found.set(path, { resourceId: "", characterIndex: 0, where, unresolved: appearanceId });
    else if (look.charset?.resourceId) add(path, look.charset.resourceId, look.charset.characterIndex ?? 0, where);
  };
  const visit = (value: unknown, path: string, where: string) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}/${String(object(item)?.id ?? index)}`, where)); return; }
    const row = object(value);
    if (!row) return;
    const graphic = object(row.graphic);
    const sprite = object(graphic?.sprite);
    if (sprite && graphic?.transparent !== true) {
      add(`${path}/graphic`, sprite.id, decodeCharsetFrameIndex(typeof graphic?.pattern === "number" ? graphic.pattern : 0).characterIndex, where);
    } else if (graphic && !sprite && graphic.transparent !== true && typeof graphic.appearanceId === "string" && graphic.appearanceId) {
      addAppearance(`${path}/graphic`, graphic.appearanceId, where);
    }
    // 이벤트 레벨의 옛 sprite 필드(페이지 graphic 이 투명이면 안 보이지만 저장·내보내기에 남는다) — 2026-10-16 잠금 누수 감사 #9.
    const legacy = object(row.sprite);
    if (legacy && typeof legacy.id === "string" && legacy.id) add(`${path}/sprite`, legacy.id, 0, where);
    if (typeof row.characterResourceId === "string") add(`${path}/actor`, row.characterResourceId, typeof row.characterIndex === "number" ? row.characterIndex : 0, where);
    if (typeof row.battleCharacterResourceId === "string") {
      const chip = battlerSourceChip(row.battleCharacterResourceId);
      if (chip) add(`${path}/battler`, chip.resourceId, chip.characterIndex, where, { battler: row.battleCharacterResourceId });
    }
    if (row.kind === "addFollower" && typeof row.actorId === "string" && row.actorId) addActorRef(`${path}/follow:${row.actorId}`, row.actorId, where);
    if (row.kind === "changeParty" && (row.action === "add" || row.action === "lead") && typeof row.actorId === "string" && row.actorId) addActorRef(`${path}/party:${row.actorId}`, row.actorId, where);
    for (const [key, child] of Object.entries(row)) if (key !== "graphic" && key !== "sprite" && child && typeof child === "object") visit(child, `${path}/${key}`, where);
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) visit(event, `maps/${map.id}/events/${event.id}`, `맵 ${map.id} 이벤트 ${event.id}「${event.name ?? ""}」`);
  }
  for (const actor of project.database.actors) {
    const where = `배우 ${actor.id}「${actor.name ?? ""}」`;
    visit(actor, `database/actors/${actor.id}`, where);
    // 걷기 칩 없이 외형 프리셋(appearanceId)으로만 그림을 정한 배우(#10) — 외형 DB 에 없는 id 는 풀 수 없다.
    if (actor.appearanceId && !actor.characterResourceId) addAppearance(`database/actors/${actor.id}/appearance`, actor.appearanceId, where);
  }
  for (const common of project.commonEvents) visit(common, `commonEvents/${common.id}`, `공용 이벤트 ${common.id}`);
  // 몬스터 종의 필드 걷기 그림(따라다니기·필드 표시) — 종이 여럿이면 칩이 맵에 나온다(#10).
  for (const species of project.database.monsterSpecies ?? []) {
    const where = `몬스터 종 ${species.id}「${species.name ?? ""}」`;
    const fieldSprite = object(object(species.graphic?.fieldGraphic)?.sprite);
    if (fieldSprite && object(species.graphic?.fieldGraphic)?.transparent !== true) {
      add(`database/monsterSpecies/${species.id}/fieldGraphic`, fieldSprite.id, decodeCharsetFrameIndex(typeof object(species.graphic?.fieldGraphic)?.pattern === "number" ? object(species.graphic?.fieldGraphic)!.pattern as number : 0).characterIndex, where);
    } else if (typeof species.graphic?.fieldCharsetId === "string") add(`database/monsterSpecies/${species.id}/fieldCharset`, species.graphic.fieldCharsetId, 0, where);
  }
  return found;
}
