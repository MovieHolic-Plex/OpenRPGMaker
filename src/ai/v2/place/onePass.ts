// 구성기가 한 번에 짜는 장소(세계 장소 · 칩셋 풀 마을) — 같은 맵을 다시 짓지 않는다.
// 거절 글은 그 맵에서 되는 길을 준다(전에는 «남은 문제는 보고에 적는다» 뿐이라 판정자가 짚은 빈 땅·자리 문제를 고칠 길이 없었다).

/** 한 번에 짠 장소를 다시 지으라는 호출의 거절 글(모델이 읽는다). */
export const onePassRefusal = (name: string): string =>
  `«${name}» was laid by its composer in one pass and is not re-laid — nothing was changed. Change it in place with the tools that work on any map: `
  + "furnish_outdoor_area (fill bare outdoor ground), place_object (a drawn object), add_people / move_event / add_event (people and events). "
  + "For a different layout build another place instead (make_place, or build_places{add:[{name, kind}]} in a world game).";
