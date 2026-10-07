// 실내 칩셋 정책 한 줄(2026-09-29): 실내는 손 도트 v5(atlas_biome_interior)만. 옛 실내 칩셋은 폐기(retiredInteriorTilesets.ts).
export const HAND_INTERIOR_POLICY_LINE =
  "새 실내(집·가게·여관·저택·교회·성 방·지하 등)는 손 도트 실내 칩셋 atlas_biome_interior 으로 골조를 짓는다: "
  + "list_tileset_references({tilesetId:\"atlas_biome_interior\"}) 의 손 도트 실내 조립법(읽는 순서·구조 규칙·가까운 예제 하나)을 읽고, 가구는 list_hand_interior_parts({room:\"빵집\"} 또는 {query:\"여관 벽\"}) 로 찾은 뒤(설명·놓는 곳·짝 소품이 행에 있어 가구 사전 문서를 따로 읽지 않는다) "
  + "build_hand_interior_room(plan 문자열 · floor · wall · zones · objects · tables · lines · goods · links) 한 번으로 짓는다 — 벽면·천장은 plan 에서 자동이다. "
  + "집 밖 한 칸 문에 연결하는 실내 출구도 가로 한 칸만 연다. plan 마지막 줄의 '..' 두 칸 출구는 한 칸 문과 맞지 않는다. 기본 exitWidth는 1이며 start 한 칸 선언으로 두 칸 틈을 대신하지 않는다. 넓은 대문을 명시한 경우에만 그 문 폭에 맞춘 exitWidth를 쓴다. "
  + "가구를 고르기 전에 list_spatial_designs({kind:\"object\",query:\"장소·물건 이름\"})로 사용자 선택 공용 기물을 먼저 찾는다. 검색 결과의 사용자 선택 태그를 우선하되 시대·장소·기능이 맞는 것만 쓴다. "
  + "shared_hand_interior_harness의 킷은 방 골조를 만든 다음 stamp_object로 배치한다. 공용 킷 id를 build_hand_interior_room의 objects에 넘기지 않는다. 같은 자리에 기본 가구를 중복으로 놓지 않고 출입구·통로·접근 칸을 남긴다. "
  + "옛 실내 칩셋(easyrpg_chipset_interior·tibo_interior_expanded·LPC 가구)과 place_concept·방 세션은 폐기되어 거부된다. 층이 여럿이면 층마다 한 맵, 계단 칸에 links 로 이동을 단다(아직 없는 맵을 가리키는 links 는 거부 — 1층을 links 없이 → 2층을 1층 links 와 함께 → 1층을 replace:true 로 2층 links 를 넣어 다시). "
  + "일본 현대 집(현관 타타키·화실 다다미·LDK·욕실·화장실·아파트 원룸)은 같은 두 도구에 tileset:\"jp_city\" 를 준다 — 부품은 list_hand_interior_parts({tileset:\"jp_city\", room:\"화실\"}), 조립법은 list_tileset_references({tilesetId:\"jp_city\"}) 의 일본 실내 용도(jp-interior). 일본 거리(jp_city) 맵의 집에 들어가는 실내도 이 길이다.";
