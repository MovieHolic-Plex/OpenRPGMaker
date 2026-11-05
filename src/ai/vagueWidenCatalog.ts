// 모호한 생성 요청(「마을 만들어줘」「던전 만들어줘」…)을 넓히는 장면 수식어 표.
//
// 왜(2026-11-03 사용자): 「마을을 만들어달라 하면 어떤 마을? 을 물어보는 게 아니라 일단 만들기는 시작해야 한다. AI 가 적당히 수식어를 넣어서
// 생성해야 한다 — 언덕 위 풍차가 있는 마을, 강을 낀 집 4채 마을, 숲 속 고요한 마을, 사막 마을… 물론 보유한 칩들 내에서」.
// 그래서 수식어마다 «그 장면에 꼭 있어야 하는 그림»(needs)을 적는다. 프로젝트에 그 그림이 없으면 그 수식어는 고르지 않는다(vagueWiden.ts).
// 각 수식어의 recipe 는 이미 있는 시공 도구의 인자다 — 새 시공기를 만들지 않는다. 문장은 모델에게 가는 지시라 한국어 그대로 둔다.

export type WidenSubject = "village" | "dungeon" | "forest" | "house" | "castle";
export const WIDEN_SUBJECTS: readonly WidenSubject[] = ["village", "dungeon", "forest", "house", "castle"];

/** 수식어가 기대는 그림. 하나라도 없으면 그 수식어는 후보가 아니다. */
export type WidenNeed =
  | { readonly kind: "tileset"; readonly id: string }
  /** 타일셋의 구조 키트(structureKits[].id) — 풍차·성문루처럼 그 장면의 얼굴이 되는 그림. */
  | { readonly kind: "kit"; readonly tileset: string; readonly id: string }
  /** 던전 시공기(author_dungeon)의 버들항 어댑터가 그 종류를 짓는가 — dungeonKit/capabilities 가 정본이다. */
  | { readonly kind: "dungeon"; readonly type: string };

export interface WidenModifier {
  readonly id: string;
  readonly subject: WidenSubject;
  /** 사용자에게 보이는 장면 이름(「언덕 위 풍차 마을」). 시작 한 줄에 그대로 나간다. */
  readonly label: string;
  /** 장면 수식어 2~3개 — 다양성 지표가 이 낱말 집합을 센다. */
  readonly traits: readonly string[];
  /** 짓는 법 한 줄(도구 이름과 인자). 모델이 그대로 따른다. */
  readonly recipe: string;
  readonly needs: readonly WidenNeed[];
}

const BD = "beodeul_city";
const kit = (id: string): WidenNeed => ({ kind: "kit", tileset: BD, id });
const ts = (id: string): WidenNeed => ({ kind: "tileset", id });
const dg = (type: string): WidenNeed => ({ kind: "dungeon", type });

export const WIDEN_MODIFIERS: readonly WidenModifier[] = [
  // ── 마을(author_beodeul_town) ──
  { id: "village-windmill-hill", subject: "village", label: "언덕 위 풍차 마을", traits: ["언덕", "풍차", "밀밭"],
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", landform:\"hill\", form:\"scatter\", roofs:\"moss\"}) → 높은 단 빈 풀밭에 stamp_object({objectId:\"kit:beodeul_city/bd-windmill\"}) 로 풍차 들을 앉힌다",
    needs: [ts(BD), kit("bd-windmill")] },
  { id: "village-river-four", subject: "village", label: "강을 낀 집 네 채 마을", traits: ["강", "다리", "집 네 채"],
    recipe: "author_beodeul_town({theme:\"river\", water:\"river\", form:\"riverbank\", houseCount:4})",
    needs: [ts(BD)] },
  { id: "village-quiet-forest", subject: "village", label: "숲 속 고요한 마을", traits: ["숲속", "고요함", "이끼 지붕"],
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", woods:\"dense\", form:\"scatter\", roofs:\"moss\", forestType:\"mixed\"})",
    needs: [ts(BD)] },
  { id: "village-desert-oasis", subject: "village", label: "오아시스 사막 마을", traits: ["사막", "오아시스", "모래길"],
    recipe: "author_beodeul_town({theme:\"desert\", terrain:\"basin\"})",
    needs: [ts(BD)] },
  { id: "village-snow-slope", subject: "village", label: "눈 덮인 비탈 마을", traits: ["눈", "비탈", "겨울"],
    recipe: "author_beodeul_town({theme:\"snow\", terrain:\"hillside\"})",
    needs: [ts(BD)] },
  { id: "village-fishing-port", subject: "village", label: "바닷가 포구 마을", traits: ["바다", "포구", "길가 집"],
    recipe: "author_beodeul_town({theme:\"coast\", form:\"street\", roofs:\"slate\"})",
    needs: [ts(BD)] },
  { id: "village-mountain-log", subject: "village", label: "전나무 산골 통나무 마을", traits: ["산골", "통나무집", "전나무"],
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", terrain:\"highland\", form:\"scatter\", roofs:\"log\", forestType:\"conifer\"})",
    needs: [ts(BD)] },
  { id: "village-market-square", subject: "village", label: "광장에 장이 서는 강가 마을", traits: ["장터", "광장", "강"],
    recipe: "author_beodeul_town({theme:\"river\", water:\"river\", form:\"plaza\", roofs:\"red\"})",
    needs: [ts(BD)] },
  { id: "village-swamp-stilts", subject: "village", label: "늪가 마른 둔덕 마을", traits: ["늪", "둔덕", "물안개"],
    recipe: "author_beodeul_town({theme:\"swamp\", terrain:\"ridge\"})",
    needs: [ts(BD)] },
  { id: "village-walled", subject: "village", label: "성벽으로 두른 남문 마을", traits: ["성벽", "남문", "슬레이트 지붕"],
    recipe: "author_beodeul_town({theme:\"river\", walls:true, wallGate:\"S\", form:\"street\", roofs:\"slate\"})",
    needs: [ts(BD), kit("bd-wall-gatehouse"), kit("bd-wall-tower")] },
  { id: "village-farm", subject: "village", label: "헛간과 울타리 밭이 있는 농촌", traits: ["농가", "헛간", "울타리 밭"],
    recipe: "author_beodeul_town({theme:\"river\", form:\"scatter\", roofs:\"moss\"}) → 빈 풀밭에 stamp_object(kit:beodeul_city/bd-farm-barn · bd-farm-fenced-plot) 로 농가 덩이",
    needs: [ts(BD), kit("bd-farm-barn"), kit("bd-farm-fenced-plot")] },
  { id: "village-terraced-medieval", subject: "village", label: "계단식 비탈의 중세 일터 마을", traits: ["계단식 비탈", "중세 일터", "작은 광장"],
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", landform:\"terraces\", form:\"street\", roofs:\"medieval\"})",
    needs: [ts(BD)] },

  // ── 던전(author_dungeon, 버들항 어댑터) ──
  { id: "dungeon-catacomb-loop", subject: "dungeon", label: "고리로 도는 이끼 지하묘지", traits: ["지하묘지", "고리 배치", "언데드"],
    recipe: "author_dungeon({type:\"catacomb\", layout:\"loop\"})", needs: [ts(BD), dg("catacomb")] },
  { id: "dungeon-flooded-cave", subject: "dungeon", label: "지하 호수가 있는 자연 동굴", traits: ["동굴", "지하 호수", "갈래 홀"],
    recipe: "author_dungeon({type:\"cave\", layout:\"hub\"})", needs: [ts(BD), dg("cave")] },
  { id: "dungeon-lava", subject: "dungeon", label: "용암 줄기 위 다리 화산 동굴", traits: ["화산", "용암", "돌다리"],
    recipe: "author_dungeon({type:\"volcano\"})", needs: [ts(BD), dg("volcano")] },
  { id: "dungeon-ice", subject: "dungeon", label: "빙판 호수가 있는 얼음 동굴", traits: ["얼음", "빙판", "눈 바닥"],
    recipe: "author_dungeon({type:\"ice\"})", needs: [ts(BD), dg("ice")] },
  { id: "dungeon-ruined-temple", subject: "dungeon", label: "덩굴 덮인 폐허 신전", traits: ["폐허 신전", "열주 홀", "덩굴"],
    recipe: "author_dungeon({type:\"temple\", layout:\"linear\"})", needs: [ts(BD), dg("temple")] },
  { id: "dungeon-sewer", subject: "dungeon", label: "보행로와 다리가 있는 지하 수로", traits: ["하수도", "물길", "보행로"],
    recipe: "author_dungeon({type:\"sewer\"})", needs: [ts(BD), dg("sewer")] },
  { id: "dungeon-mine", subject: "dungeon", label: "광차 선로가 뻗은 버려진 광산", traits: ["광산", "갱도", "광차"],
    recipe: "author_dungeon({type:\"mine\"})", needs: [ts(BD), dg("mine")] },
  { id: "dungeon-tower", subject: "dungeon", label: "세 층으로 오르는 마법탑", traits: ["마법탑", "세 층", "마법진"],
    recipe: "author_dungeon({type:\"tower\", floors:3, direction:\"up\"})", needs: [ts(BD), dg("tower")] },
  { id: "dungeon-pyramid", subject: "dungeon", label: "모래 함정이 있는 사막 왕묘", traits: ["피라미드", "사암 회랑", "모래 함정"],
    recipe: "author_dungeon({type:\"pyramid\"})", needs: [ts(BD), dg("pyramid")] },
  { id: "dungeon-labyrinth", subject: "dungeon", label: "두꺼운 벽의 돌 미궁", traits: ["미궁", "좁은 통로", "막다른 길"],
    recipe: "author_dungeon({type:\"labyrinth\"})", needs: [ts(BD), dg("labyrinth")] },
  { id: "dungeon-swamp", subject: "dungeon", label: "널판 길이 놓인 늪지 던전", traits: ["늪", "널판 길", "둔덕"],
    recipe: "author_dungeon({type:\"swamp\"})", needs: [ts(BD), dg("swamp")] },

  // ── 숲(author_forest_route) ──
  { id: "forest-misty-two", subject: "forest", label: "안개 낀 두 갈래 숲길", traits: ["안개", "갈림길", "숲길 두 장"],
    recipe: "author_forest_route({side:\"north\", count:2, moods:[\"normal\",\"fog\"], designs:[{bends:3, branches:[{at:0.3,toward:\"left\",end:\"chest\"}]},{bends:4, width:\"narrow\"}]})",
    needs: [ts(BD)] },
  { id: "forest-meadow-clearing", subject: "forest", label: "큰 빈터가 열린 밝은 숲", traits: ["밝음", "큰 빈터", "넓은 길"],
    recipe: "author_forest_route({side:\"north\", count:1, terrain:\"forest\", designs:[{bends:2, width:\"wide\", clearings:[{at:0.5,size:\"large\",toward:\"center\"}]}]})",
    needs: [ts(BD)] },
  { id: "forest-night-deep", subject: "forest", label: "밤이 깊은 구불구불한 숲", traits: ["밤", "굽이 많은 길", "좁은 길"],
    recipe: "author_forest_route({side:\"north\", count:2, moods:[\"dim\",\"night\"], designs:[{bends:5, width:\"narrow\"},{bends:6, width:\"narrow\"}]})",
    needs: [ts(BD)] },
  { id: "forest-edge-field", subject: "forest", label: "풀밭에서 들어가는 숲 어귀", traits: ["숲 어귀", "풀밭", "나무 벽 틈"],
    recipe: "author_forest_route({side:\"north\", count:2, terrains:[\"edge\",\"forest\"]})", needs: [ts(BD)] },
  { id: "forest-hidden-treasure", subject: "forest", label: "숨은 물건이 있는 세 장짜리 깊은 숲", traits: ["깊은 숲", "숨은 물건", "숲 세 장"],
    recipe: "author_forest_route({side:\"north\", count:3, hiddenPerMap:2, moods:[\"normal\",\"dim\",\"dark\"]})", needs: [ts(BD)] },
  { id: "forest-dungeon-grove", subject: "forest", label: "고목과 연못이 있는 숲 던전", traits: ["숲 던전", "고목", "연못"],
    recipe: "author_dungeon({type:\"forest\"})", needs: [ts(BD), dg("forest")] },

  // ── 집(place_terrain_house + build_hand_interior_room) ──
  { id: "house-log-cabin", subject: "house", label: "숲 가장자리 통나무 오두막", traits: ["통나무", "오두막", "숲 가장자리"],
    recipe: "inspect_terrain 의 houseKits 에서 통나무 오두막(bd-out-cabin)을 골라 place_terrain_house({kitId}) → build_hand_interior_room 으로 작은 실내 → create_transfer_pair",
    needs: [ts(BD), kit("bd-out-cabin"), ts("atlas_biome_interior")] },
  { id: "house-farmhouse", subject: "house", label: "헛간이 딸린 농가", traits: ["농가", "헛간", "마당"],
    recipe: "place_terrain_house 로 집 한 채 → 곁에 stamp_object({objectId:\"kit:beodeul_city/bd-farm-barn\"}) → build_hand_interior_room 으로 부엌 딸린 실내 → create_transfer_pair",
    needs: [ts(BD), kit("bd-farm-barn"), ts("atlas_biome_interior")] },
  { id: "house-two-storey", subject: "house", label: "2층 붉은 지붕 마을집", traits: ["2층", "붉은 지붕", "다락"],
    recipe: "place_terrain_house({style, stories:2}) → build_hand_interior_room 으로 1층 거실·계단 실내 → create_transfer_pair",
    needs: [ts(BD), ts("atlas_biome_interior")] },
  { id: "house-well-yard", subject: "house", label: "우물 마당 앞 작은 집", traits: ["우물", "앞마당", "작은 집"],
    recipe: "place_terrain_house 로 집 한 채 → 문 앞 마당에 stamp_object({objectId:\"kit:beodeul_city/bd-out-well-plaza\"}) → build_hand_interior_room → create_transfer_pair",
    needs: [ts(BD), kit("bd-out-well-plaza"), ts("atlas_biome_interior")] },

  // ── 성 ──
  { id: "castle-royal-keep", subject: "castle", label: "왕성 아래 성문 마을", traits: ["왕성", "성문", "성 아래 마을"],
    recipe: "author_beodeul_town({theme:\"river\", walls:true, wallGate:\"S\", form:\"street\", roofs:\"slate\", width:72, height:56}) → 북쪽 빈터에 stamp_object({objectId:\"kit:beodeul_city/bd-castle\"})",
    needs: [ts(BD), kit("bd-castle"), kit("bd-wall-gatehouse")] },
  { id: "castle-fortress-dungeon", subject: "castle", label: "감옥과 병영이 있는 요새 내부", traits: ["요새", "감옥", "병영"],
    recipe: "author_dungeon({type:\"castle\", layout:\"hub\"})", needs: [ts(BD), dg("castle")] },
  { id: "castle-twin-floor", subject: "castle", label: "옥좌가 있는 2층 성채", traits: ["성채", "2층", "옥좌"],
    recipe: "author_dungeon({type:\"castle\", name:\"성채\", floors:2, direction:\"up\", floorRooms:[[{kind:\"entrance\"},{kind:\"hall\"},{kind:\"library\"},{kind:\"storage\"}],[{kind:\"shrine\"},{kind:\"boss\"}]]})", needs: [ts(BD), dg("castle")] },
  { id: "castle-walled-town", subject: "castle", label: "망루가 선 성곽 도시", traits: ["성곽", "망루", "남북 성문"],
    recipe: "author_beodeul_town({theme:\"river\", walls:true, wallGate:\"NS\", form:\"plaza\", roofs:\"slate\"})",
    needs: [ts(BD), kit("bd-wall-gatehouse"), kit("bd-wall-tower")] },
];
