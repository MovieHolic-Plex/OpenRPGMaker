// editor/tools/routePropPolicy.ts
// 도로·필드 맵(mapRole "field")에 마을·항구·농장 소품을 찍지 못하게 한다(2026-10-06 실측).
// 몬스터 수집 첫 판에서 조수가 author_wild_route 로 1번 도로를 깐 뒤 올리브 나무·건초더미·밀단·그물 건조대·바닷가재 통발을
// 길가에 찍었다 — 「도로에 어울리는 소품」 기준이 없어 버들항 장소 세트를 아무거나 골랐다.
// 길섶 꾸미기는 깊은 숲길·산길 세트(고사리·들꽃·돌·그루터기·쓰러진 통나무)를 쓴다.

import type { GameMap } from "@/project/types";
import { ToolError } from "./types";

const SETTLEMENT_PROP = new RegExp(
  "(^|/)bd-(house|block|forum|cathedral|castle|manor|estate|harbour|canal|windmill|garden)-"
  + "|(^|/)bd-pick-(fishing-port|riverside-mill|vineyard|walled-market|wheat-roman|headland-lighthouse|shipwreck-reef)-"
  + "|^obj:house/",
);

export function rejectSettlementPropOnRoute(map: GameMap, objectId: string): void {
  if (map.mapRole !== "field" || !SETTLEMENT_PROP.test(objectId)) return;
  throw new ToolError(
    `${objectId} 는 마을·항구·농장 소품이라 도로·필드 맵 ${map.id}(${map.name})에 찍지 않는다. `
    + "길섶은 list_spatial_designs({kind:\"object\",query:\"deep-forest-path\"}) 의 고사리·들꽃·돌·그루터기·쓰러진 통나무나 mountain-pass 소품, 나무(bd-tree-*)로 꾸민다.",
    { code: "settlement-prop-on-route", mapId: map.id },
  );
}
