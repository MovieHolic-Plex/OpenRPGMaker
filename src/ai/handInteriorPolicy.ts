// 실내 칩셋 정책 한 줄(2026-09-29): 실내는 손 도트 v5(atlas_biome_interior)만. 옛 실내 칩셋은 폐기(retiredInteriorTilesets.ts).
export const HAND_INTERIOR_POLICY_LINE =
  "새 실내(집·가게·여관·저택·교회·성 방·지하 등)는 손 도트 실내 칩셋 atlas_biome_interior 하나로만 짓는다: "
  + "list_tileset_references({tilesetId:\"atlas_biome_interior\"}) 의 손 도트 실내 조립법(읽는 순서·구조 규칙·가까운 예제 하나)을 읽고, 가구는 list_hand_interior_parts({room:\"빵집\"} 또는 {query:\"여관 벽\"}) 로 찾은 뒤(설명·놓는 곳·짝 소품이 행에 있어 가구 사전 문서를 따로 읽지 않는다) "
  + "build_hand_interior_room(plan 문자열 · floor · wall · zones · objects · tables · lines · goods · links) 한 번으로 짓는다 — 벽면·천장은 plan 에서 자동이다. "
  + "옛 실내 칩셋(easyrpg_chipset_interior·tibo_interior_expanded·LPC 가구)과 place_concept·방 세션은 폐기되어 거부된다. 층이 여럿이면 층마다 한 맵, 계단 칸에 links 로 이동을 단다.";
