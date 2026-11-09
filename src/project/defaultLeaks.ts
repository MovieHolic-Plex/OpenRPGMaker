// project/defaultLeaks.ts
// 엔진 기본값이 «다 지었다»고 말하는 게임에 남았는가 — 순수 함수(프로젝트만 읽는다). 기준은 빈 프로젝트(createBlankProject) 자체다.
//
// 왜(2026-11-09 오너 「엔진의 기본값이 게임에 새지 않게 해라」, terra-autopilot 24판 실측): 타이틀 배경 기본 16/24, 시작 장비 기본 18/24,
// 엔딩 배경을 안 정해 엔딩이 기본 타이틀 그림을 깐 판 13/24. 조수 v2 출하 검사(ai/v2/shipChecks)는 조수 경로에서만 돌아 `./oprn check`
// (runGameCheck)에는 이 검사가 없었다. qa 층이 ai 층을 끌어오지 않도록 비교를 project 층에 둔다.
// 빈 프로젝트의 기본값은 그대로 둔다 — 이 목록은 «저작자가 손대지 않았다»를 말할 뿐 값을 지우지 않는다.
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import { createBlankProject } from "./defaults";
import type { Project } from "./types";

export interface DefaultLeak {
  readonly id: "title-name" | "title-image" | "ending-bg" | "start-gear";
  /** 저작자가 고쳐야 할 정확한 필드 경로. */
  readonly field: string;
  readonly message: string;
}

let factoryCache: Project | undefined;
const factory = (): Project => (factoryCache ??= createBlankProject() as Project);

/** 빈 프로젝트가 깔아 둔 그림 id — 타이틀 배경·오프닝 기본 장면. 엔딩·타이틀 대체 그림으로 쓰면 어느 게임이나 같은 그림이 된다. */
export function factoryArtResourceIds(): ReadonlySet<string> {
  const f = factory();
  const ids = new Set<string>();
  const add = (id: unknown) => { if (typeof id === "string" && id) ids.add(id); };
  add(f.system.titleScreen?.backgroundResourceId);
  add(f.system.titleResourceId);
  for (const scene of f.system.opening?.scenes ?? []) add("resourceId" in scene ? scene.resourceId : undefined);
  return ids;
}

/**
 * 엔진이 번들로 싣고 오는 그림인가 — 오프닝 스틸 카탈로그(oprn-still-*·oprn-pack-still-*)와 번들 타이틀 그림(oprn-title-*). 어느 게임이나 고를 수 있는 같은 그림이라
 * 타이틀·엔딩 그림으로 그대로 두면 게임마다 같은 그림이 된다(2026-11-09 오너: 「기본 타이틀 그림이 들어가면 게임적 가치가 없다」). 맵 화면(map-view:)·올린 그림·생성 그림은 아니다.
 */
export function isBundledPictureId(id: string | undefined): boolean {
  if (!id) return false;
  return id.startsWith("oprn-title-") || findOpeningStillMood(id) !== undefined;
}

/** 엔딩이 실제로 까는 그림 id(엔딩 자신의 배경 → 타이틀 그림 → 오프닝 마지막 스틸) — 플레이어 endingBackdropResourceId 와 같은 순서. */
export function endingBackdropCandidates(project: Project, presentationBackground?: string): string[] {
  const openingStill = (project.system.opening?.scenes ?? []).flatMap((scene) => (scene.kind === "image" ? [scene.resourceId] : [])).at(-1);
  return [presentationBackground, project.system.titleScreen?.backgroundResourceId, project.system.titleResourceId, openingStill]
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** 아직 아무것도 짓지 않은 빈 프로젝트(맵 1장 이하·이벤트 0·엔딩 0)는 조용하다 — 값이 기본인 것이 당연하다. */
function isUntouchedBlank(project: Project): boolean {
  const maps = Object.values(project.maps ?? {});
  return maps.length <= 1 && maps.every((map) => (map.events ?? []).length === 0) && (project.endings ?? []).length === 0;
}

export function projectDefaultLeaks(project: Project, options: { readonly includeBlank?: boolean } = {}): DefaultLeak[] {
  if (!options.includeBlank && isUntouchedBlank(project)) return [];
  const f = factory();
  const out: DefaultLeak[] = [];
  const title = project.system.titleScreen;
  const ftitle = f.system.titleScreen;
  const shownTitle = String(title?.title ?? project.meta.title ?? "");

  if (shownTitle === String(ftitle?.title) || project.meta.title === f.meta.title) {
    out.push({ id: "title-name", field: "system.titleScreen.title · meta.title", message: `게임 제목이 엔진 기본 「${f.meta.title}」이다 — set_title_screen{title} 로 이 게임의 제목을 쓴다.` });
  }
  const titleBg = title?.backgroundResourceId ?? project.system.titleResourceId;
  const art = factoryArtResourceIds();
  if (titleBg && art.has(titleBg)) {
    out.push({ id: "title-image", field: "system.titleScreen.backgroundResourceId", message: `타이틀 그림이 엔진 기본(${titleBg})이다 — list_resources{kind:'backdrop', query:<배경 낱말>} 로 이 이야기에 맞는 그림을 골라 set_title_screen{backgroundResourceId} 로 바꾼다.` });
  }

  // 엔딩 그림: 엔딩이 자기 그림을 안 정하면 플레이어는 타이틀 그림을 깐다 — 그것이 기본 그림이면 어느 게임이나 같은 눈 마을이 엔딩에 뜬다.
  const defaultEnding = (project.endings ?? []).filter((ending) => {
    const shown = endingBackdropCandidates(project, ending.presentation?.backgroundResourceId)[0];
    return shown !== undefined && art.has(shown);
  });
  if (defaultEnding.length) {
    out.push({ id: "ending-bg", field: "endings[].presentation.backgroundResourceId", message: `엔딩 ${defaultEnding.length}개(${defaultEnding.slice(0, 3).map((e) => e.name || e.id).join("·")})가 엔진 기본 그림을 깐다 — define_ending 의 presentation.backgroundResourceId 에 그 엔딩의 장소 그림을 준다.` });
  }

  // 시작 장비: 이 게임이 장비를 직접 지었는데(공장 장비 밖 id) 주인공은 공장 장비 그대로다 — 지은 장비가 주인공에게 닿지 않았다.
  // 장비를 한 개도 안 지은 게임은 말하지 않는다(공장 장비가 전투 게임의 정상 출발이다). 전투 없는 게임은 ship 검사 combat-leftovers 가 따로 짚는다.
  const factoryEquipment = new Set(f.database.equipment.map((e) => e.id));
  const authoredEquipment = project.database.equipment.some((e) => !factoryEquipment.has(e.id));
  if (authoredEquipment) {
    const fActors = new Map(f.database.actors.map((a) => [a.id, a]));
    const held = (project.system.startActorIds ?? []).flatMap((id) => {
      const actor = project.database.actors.find((a) => a.id === id);
      const base = fActors.get(id)?.initialEquipment ?? {};
      return actor ? Object.entries(actor.initialEquipment ?? {}).filter(([slot, eq]) => eq && base[slot] === eq).map(([slot, eq]) => `${actor.name} ${slot}:${String(eq)}`) : [];
    });
    if (held.length) out.push({ id: "start-gear", field: "database.actors[].initialEquipment", message: `이 게임이 장비를 지었는데 시작 파티는 엔진 기본 장비(${held.slice(0, 4).join(", ")})를 들고 있다 — upsert_actor{id, initialEquipment} 로 이 게임의 장비를 준다.` });
  }
  return out;
}
