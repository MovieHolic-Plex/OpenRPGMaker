// 집 안은 그 집의 바깥을 따른다 — 문이 달린 바깥 맵의 칩셋이 방 짓기 사양과 모습 표(looks)를 가지면 그 칩셋으로 짓고,
// 벽면은 그 집 킷의 양식(킷 태그 style:<양식>)에 맞는 것으로 바꾼다. 요청 낱말은 보지 않는다 — 문이 달린 집이 고른다.
// (2026-11-15 오너: 버들항 목골 여관 안이 통나무집이었다 — 실내 칩셋이 바깥과 무관하게 손 도트 v5 하나였고 명세에 바깥 집이 없었다.)
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { isBareTileMap } from "../../blankStart";
import { kitTier } from "@/project/kitTier";
import { roomTemplates } from "@/editor/handInterior/templates";
import type { Project } from "@/project/types";
import type { PlaceSpec } from "../../shared/types";

/** cat·tier = 그 집 킷의 갈래(cat:farm·harbour·town·castle)·크기 단(tier:small·medium·large·xlarge) 태그 — 사는 사람의 물건·실내 크기 단이 읽는다(요청 낱말이 아니라 문이 달린 집의 자료). */
export interface ExteriorLook { readonly tileset: string; readonly kit?: string; readonly style?: string; readonly cat?: string; readonly tier?: string }

/** 바깥 맵(또는 명세가 적은 바깥)의 칩셋이 «집 안도 짓는 칩셋»(사양 + 모습 표 + 방 견본)이면 그 모습. */
export function exteriorLook(project: Project, spec: Pick<PlaceSpec, "exterior">, parentMapId?: string): ExteriorLook | undefined {
  // 명세에 바깥이 없으면 짓는 순간의 지금 맵 — 다만 잔디 한 장뿐인 빈 맵(빈 프로젝트의 시작 맵)은 마을이 아니다(interiorTilesetFor 와 같은 규칙).
  const parent = project.maps[parentMapId ?? ""];
  const tilesetId = spec.exterior?.tileset ?? (parent && !isBareTileMap(parent) ? parent.tilesetId : undefined);
  const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;
  const S = roomSpecOf(tileset);
  if (!tileset || !S?.looks?.style || !roomTemplates(tileset.id).length) return undefined;
  const kit = spec.exterior?.kit;
  const kitDef = kit ? tileset.structureKits?.find((k) => k.id === kit) : undefined;
  const tags = kitDef?.ai?.tags ?? [];
  const style = spec.exterior?.style ?? tags.find((t) => t.startsWith("style:") && t !== "style:any")?.slice(6);
  const tag = (head: string) => tags.find((t) => t.startsWith(head))?.slice(head.length);
  // 단: 킷의 tier 태그, 태그 없는 옛 사본의 킷은 킷 자료(문 하나에 딸린 넓이)로 센다 — src/project/kitTier.ts.
  const cat = tag("cat:"), tier = kitTier(kitDef);
  return { tileset: tileset.id, ...(kit ? { kit } : {}), ...(style ? { style } : {}), ...(cat ? { cat } : {}), ...(tier ? { tier } : {}) };
}

/** 그 집 안의 벽면: 견본·설계가 쓴 «집 벽»(모습 표 looks.style[양식] 의 열쇠)만 그 양식의 벽면으로 바꾼다. 표에 없는 벽(빵집 벽돌·예배당 돌)과 양식을 모르는 집은 그대로. */
export function exteriorWall(S: HandInteriorSpec, look: ExteriorLook | undefined, wall: string | undefined): string | undefined {
  const to = look?.style && wall ? S.looks?.style?.[look.style]?.[wall] : undefined;
  return to && S.walls[to] ? to : wall;
}
