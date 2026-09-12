import { HOUSE_STUDIES, type HouseStudy } from "./houseStudyDesigns.mts";

/** Extend the reviewed 11/12 geometry with discrete, occluded roof planes.
 * Each new floor reserves a visible slope on BOTH sides of the upper building.
 */
export function houseHeightVariant(base: HouseStudy, floors: 2 | 3 | 4): HouseStudy {
  if (!base.upperStorey || !["inn", "workshop"].includes(base.id)) throw new Error("Requires a reviewed 2-storey house");
  if (floors === 2) return structuredClone(base);
  const slate = base.volumes[0]?.color === "slate";
  const width = base.width + (floors - 2) * 4;
  const height = base.height + (floors - 2) * 5;
  return { id: `${base.id}-${floors}f`, name: `${slate ? "12" : "11"}번 구조 · ${floors}층`,
    note: "양쪽 경사면과 층별 처마 · 위층이 아래 지붕을 가리는 구조",
    width, height, volumes:[],stackedCore:{source:structuredClone(base),levels:floors-2,inset:2,rise:5},
    doors: [{ x: Math.floor(width / 2), y: height - 1 }] };
}

/** Facade observations for checking the actual baked rows, including base bands. */
export function houseHeightFacades(study:HouseStudy) {
  const source=study.stackedCore?.source ?? study;
  const levels=study.stackedCore?.levels ?? 0,inset=study.stackedCore?.inset ?? 0,rise=study.stackedCore?.rise ?? 5;
  const upper=source.upperStorey!;
  const result=[{...upper,x:upper.x+levels*inset,bottomBand:false}];
  for(let level=0;level<=levels;level++)result.push({x:(levels-level)*inset,y:source.height+level*rise-3,
    w:source.width+level*inset*2,h:3,bottomBand:true});
  return result;
}

export const HOUSE_HEIGHT_STUDIES = ["inn", "workshop"].flatMap(id => {
  const base = HOUSE_STUDIES.find(study => study.id === id)!;
  return ([2, 3, 4] as const).map(floors => ({ family: id === "inn" ? 11 : 12, floors, study: houseHeightVariant(base, floors) }));
});
