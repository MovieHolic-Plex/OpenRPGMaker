import type { ItemRecord } from "../types";
import { normalizeItemRecord } from "../databaseRecordModel";

type CatalogItemInput = Partial<ItemRecord> & Pick<ItemRecord, "id" | "name" | "description"> & {
  icon: string;
};

function catalogItem(input: CatalogItemInput): ItemRecord {
  const { icon, ...record } = input;
  return normalizeItemRecord({
    scope: "none",
    price: 0,
    type: "normalGoods",
    occasion: "never",
    consumable: false,
    ...record,
    imageResourceId: icon,
    iconResourceId: icon,
  });
}

function fieldFood(input: CatalogItemInput & { hp?: number; mp?: number }): ItemRecord {
  const { hp = 0, mp = 0, ...record } = input;
  return catalogItem({
    ...record,
    type: "medicine",
    scope: "ally",
    occasion: "field",
    consumable: true,
    animationId: mp > 0 && hp === 0 ? "anim_magic" : "anim_heal",
    hpRecovery: { flat: hp, percentMax: 0 },
    mpRecovery: { flat: mp, percentMax: 0 },
  });
}

function medicine(input: CatalogItemInput & { hp?: number; mp?: number; healStateIds?: string[] }): ItemRecord {
  const { hp = 0, mp = 0, healStateIds = [], ...record } = input;
  return catalogItem({
    ...record,
    type: "medicine",
    scope: "ally",
    occasion: "always",
    consumable: true,
    animationId: mp > 0 && hp === 0 ? "anim_magic" : "anim_heal",
    hpRecovery: { flat: hp, percentMax: 0 },
    mpRecovery: { flat: mp, percentMax: 0 },
    healStateIds,
    stateEffects: healStateIds.map((stateId) => ({ stateId, chance: 100, operation: "remove" })),
  });
}

function battleItem(input: CatalogItemInput & { skillId: string }): ItemRecord {
  return catalogItem({
    ...input,
    type: "special",
    scope: "enemy",
    occasion: "battle",
    occasionField: false,
    occasionBattle: true,
    consumable: true,
  });
}

/** The hand-authored Jetrel icon catalog that predates the generated 100-icon pack. */
export function expandedDefaultItemRecords(): ItemRecord[] {
  return [
    // Field food and medicine.
    fieldFood({ id: "item_ale", name: "맥아주", price: 30, description: "야영 중 아군 하나의 HP를 25 회복하는 구수한 술입니다.", icon: "cc0-jetrel-ale", hp: 25 }),
    medicine({ id: "item_antidote_plus", name: "고급 해독제", price: 90, description: "아군 하나의 독과 수면 상태를 함께 치료합니다.", icon: "cc0-jetrel-antidote-plus", healStateIds: ["state_poison", "state_sleep"] }),
    fieldFood({ id: "item_apple", name: "붉은 사과", price: 15, description: "야영 중 아군 하나의 HP를 15 회복하는 잘 익은 과일입니다.", icon: "cc0-jetrel-apple", hp: 15 }),
    medicine({ id: "item_bandages", name: "응급 붕대", price: 35, description: "아군 하나의 HP를 35 회복하도록 상처를 단단히 감쌉니다.", icon: "cc0-jetrel-bandages", hp: 35 }),
    fieldFood({ id: "item_bread", name: "호밀빵", price: 30, description: "야영 중 아군 하나의 HP를 30 회복하는 든든한 빵입니다.", icon: "cc0-jetrel-bread", hp: 30 }),
    fieldFood({ id: "item_candy", name: "별사탕", price: 35, description: "야영 중 아군 하나의 MP를 8 회복하는 반짝이는 사탕입니다.", icon: "cc0-jetrel-candy", mp: 8 }),
    fieldFood({ id: "item_cheese", name: "숙성 치즈", price: 45, description: "야영 중 아군 하나의 HP를 40 회복하는 숙성 식품입니다.", icon: "cc0-jetrel-cheese", hp: 40 }),
    fieldFood({ id: "item_coffee", name: "진한 커피", price: 65, description: "야영 중 아군 하나의 MP를 15 회복하는 진한 음료입니다.", icon: "cc0-jetrel-coffee", mp: 15 }),
    fieldFood({ id: "item_cookie", name: "버터 과자", price: 20, description: "야영 중 아군 하나의 HP를 20 회복하는 바삭한 과자입니다.", icon: "cc0-jetrel-cookie", hp: 20 }),
    medicine({ id: "item_eye_drops", name: "잠깨는 안약", price: 45, description: "아군 하나의 수면 상태를 맑은 약액으로 치료합니다.", icon: "cc0-jetrel-eye-drops", healStateIds: ["state_sleep"] }),
    medicine({ id: "item_herb_blue", name: "푸른 마력초", price: 80, description: "아군 하나의 MP를 20 회복하는 푸른빛 약초입니다.", icon: "cc0-jetrel-herb-blue", mp: 20 }),
    medicine({ id: "item_herb_green", name: "초록 약초", price: 40, description: "아군 하나의 HP를 40 회복하는 향긋한 약초입니다.", icon: "cc0-jetrel-herb-green", hp: 40 }),
    medicine({ id: "item_honey", name: "야생화 꿀", price: 70, description: "아군 하나의 HP를 50, MP를 5 회복하는 달콤한 꿀입니다.", icon: "cc0-jetrel-honey", hp: 50, mp: 5 }),
    medicine({ id: "item_mana_tea", name: "마력차", price: 140, description: "아군 하나의 MP를 35 회복하는 마법 잎차입니다.", icon: "cc0-jetrel-mana-tea", mp: 35 }),
    catalogItem({ id: "item_phoenix_down", name: "불사조 깃", type: "medicine", scope: "ally", price: 450, description: "쓰러진 아군 하나를 최대 HP의 50%로 되살립니다.", icon: "cc0-jetrel-phoenix-down", occasion: "field", occasionField: true, occasionBattle: false, consumable: true, animationId: "anim_heal", onlyEffectiveOnDeadActors: true, hpRecovery: { flat: 0, percentMax: 50 } }),
    fieldFood({ id: "item_rice_ball", name: "소금 주먹밥", price: 50, description: "야영 중 아군 하나의 HP를 45 회복하는 소박한 식사입니다.", icon: "cc0-jetrel-rice-ball", hp: 45 }),
    fieldFood({ id: "item_soup", name: "채소 수프", price: 75, description: "야영 중 아군 하나의 HP를 70 회복하는 따뜻한 수프입니다.", icon: "cc0-jetrel-soup", hp: 70 }),
    medicine({ id: "item_stamina_drink", name: "활력 음료", price: 120, description: "아군 하나의 HP를 60, MP를 15 회복하는 활력제입니다.", icon: "cc0-jetrel-stamina-drink", hp: 60, mp: 15 }),
    fieldFood({ id: "item_stew", name: "사냥꾼 스튜", price: 110, description: "야영 중 아군 하나의 HP를 100 회복하는 푸짐한 스튜입니다.", icon: "cc0-jetrel-stew", hp: 100 }),
    fieldFood({ id: "item_tea", name: "향긋한 차", price: 50, description: "야영 중 아군 하나의 MP를 12 회복하는 향긋한 찻물입니다.", icon: "cc0-jetrel-tea", mp: 12 }),
    fieldFood({ id: "item_water_flask", name: "가죽 물통", price: 10, description: "야영 중 아군 하나의 HP를 10 회복하는 깨끗한 물입니다.", icon: "cc0-jetrel-water-flask", hp: 10 }),
    fieldFood({ id: "item_wine", name: "포도주", price: 45, description: "야영 중 아군 하나의 HP를 35, MP를 8 회복하는 과실주입니다.", icon: "cc0-jetrel-wine", hp: 35, mp: 8 }),

    // 전투 발동품.
    battleItem({ id: "item_bomb", name: "철제 폭탄", price: 100, description: "전투 중 적 하나에게 물리 피해를 주는 소형 폭탄입니다.", icon: "cc0-jetrel-bomb", skillId: "skill_throwing_knife" }),
    battleItem({ id: "item_fire_bomb", name: "화염 폭탄", price: 140, description: "전투 중 적 하나에게 화염 마법 피해를 일으킵니다.", icon: "cc0-jetrel-fire-bomb", skillId: "skill_fire" }),
    battleItem({ id: "item_holy_water", name: "정화 성수", price: 130, description: "전투 중 적 하나에게 성스러운 마법 피해를 줍니다.", icon: "cc0-jetrel-holy-water", skillId: "skill_item_holy_water" }),
    battleItem({ id: "item_ice_shard", name: "빙결 파편", price: 120, description: "전투 중 적 하나에게 차가운 물 마법 피해를 줍니다.", icon: "cc0-jetrel-ice-shard", skillId: "skill_water" }),
    battleItem({ id: "item_sleeping_powder", name: "수면 가루", price: 110, description: "전투 중 적 하나를 수면 상태에 빠뜨릴 수 있습니다.", icon: "cc0-jetrel-sleeping-powder", skillId: "skill_sleep_mist" }),
    battleItem({ id: "item_smoke_bomb", name: "약화 연막탄", price: 100, description: "전투 중 적 하나의 방어를 낮추는 연막을 퍼뜨립니다.", icon: "cc0-jetrel-smoke-bomb", skillId: "skill_weaken" }),
    battleItem({ id: "item_thunder_stone", name: "뇌전석", price: 150, description: "전투 중 적 하나에게 응축된 번개 마법 피해를 방출합니다.", icon: "cc0-jetrel-thunder-stone", skillId: "skill_item_thunder_stone" }),

    // 기술서, 두루마리, 배지, 농기구.
    catalogItem({ id: "item_skill_book", name: "집중의 기술서", type: "book", scope: "ally", price: 300, description: "아군 하나가 집중 기술을 익히도록 가르치는 기술서입니다.", icon: "cc0-jetrel-skill-book", learnedSkillId: "skill_focus", occasion: "field", occasionField: true, occasionBattle: false, consumable: true }),
    catalogItem({ id: "item_blank_scroll", name: "빈 마법 두루마리", price: 40, description: "주문을 기록하거나 마법 문서를 제작할 때 쓰는 빈 두루마리입니다.", icon: "cc0-jetrel-scroll" }),
    catalogItem({ id: "item_guild_badge", name: "길드 견습 배지", price: 0, description: "모험가 길드의 견습 회원임을 증명하는 황동 배지입니다.", icon: "cc0-jetrel-badge" }),
    catalogItem({ id: "item_hoe", name: "괭이", price: 50, description: "농경지의 흙을 갈아 씨앗을 심을 밭으로 만드는 농기구입니다.", icon: "cc0-jetrel-hoe", farmTool: "hoe" }),
    catalogItem({ id: "item_pickaxe", name: "곡괭이", price: 100, description: "광산과 들판의 바위를 깨뜨려 광물을 캐는 농기구입니다.", icon: "cc0-jetrel-pickaxe", farmTool: "pickaxe" }),
    catalogItem({ id: "item_watering_can", name: "물뿌리개", price: 80, description: "농경지의 작물에 물을 주어 성장을 돕는 농기구입니다.", icon: "cc0-jetrel-watering-can", farmTool: "wateringCan" }),
    catalogItem({ id: "item_axe", name: "도끼", price: 100, description: "숲의 나무를 베어 목재를 얻는 농기구입니다.", icon: "cc0-jetrel-gen-axe-great", farmTool: "axe" }),

    // Ammunition, crafting materials, harvests, and sellable goods.
    catalogItem({ id: "item_arrow_bundle", name: "화살 묶음", price: 25, description: "활과 함정을 제작할 때 쓰는 곧은 화살 묶음입니다.", icon: "cc0-jetrel-arrow-bundle" }),
    catalogItem({ id: "item_battery", name: "소형 전지", price: 80, description: "기계 장치에 전력을 공급하는 제작용 소형 전지입니다.", icon: "cc0-jetrel-battery" }),
    catalogItem({ id: "item_bone", name: "마수의 뼈", price: 30, description: "무기와 장신구를 만드는 데 쓰는 단단한 마수의 뼈입니다.", icon: "cc0-jetrel-bone" }),
    catalogItem({ id: "item_bullet", name: "화승총 탄환", price: 35, description: "화승총과 화약 장치를 제작할 때 쓰는 금속 탄환입니다.", icon: "cc0-jetrel-bullet" }),
    catalogItem({ id: "item_candle", name: "밀랍초", price: 15, description: "조명 도구 제작이나 어두운 제단 퀘스트에 쓰는 초입니다.", icon: "cc0-jetrel-candle" }),
    catalogItem({ id: "item_claw", name: "마수의 발톱", price: 45, description: "날붙이와 사냥 장비 제작에 쓰는 날카로운 발톱입니다.", icon: "cc0-jetrel-claw" }),
    catalogItem({ id: "item_coal", name: "석탄", price: 30, description: "용광로 연료와 화약 제작에 쓰는 검은 광물입니다.", icon: "cc0-jetrel-coal" }),
    catalogItem({ id: "item_corn", name: "옥수수", price: 120, description: "수확한 뒤 상점 판매나 요리 재료로 쓰는 노란 작물입니다.", icon: "cc0-jetrel-corn" }),
    catalogItem({ id: "item_crystal", name: "마력 수정", price: 400, description: "마법 장비와 주문 촉매를 제작하는 데 쓰는 수정입니다.", icon: "cc0-jetrel-crystal" }),
    catalogItem({ id: "item_earth_ore", name: "대지 광석", price: 90, description: "대지 속성 장비를 제련할 때 쓰는 묵직한 광석입니다.", icon: "cc0-jetrel-earth-ore" }),
    catalogItem({ id: "item_egg", name: "달걀", price: 100, description: "가축에게서 얻어 상점에 팔거나 요리에 쓰는 신선한 수확물입니다.", icon: "cc0-jetrel-egg" }),
    catalogItem({ id: "item_fang", name: "마수의 송곳니", price: 55, description: "독침과 사냥 장신구를 제작할 때 쓰는 뾰족한 송곳니입니다.", icon: "cc0-jetrel-fang" }),
    catalogItem({ id: "item_fish", name: "은빛 생선", price: 70, description: "낚시로 얻어 상점에 팔거나 해산물 요리에 쓰는 생선입니다.", icon: "cc0-jetrel-fish" }),
    catalogItem({ id: "item_gear", name: "정밀 톱니", price: 65, description: "시계와 자동 장치를 조립할 때 쓰는 정밀 부품입니다.", icon: "cc0-jetrel-gear" }),
    catalogItem({ id: "item_gem_emerald", name: "천연 에메랄드", price: 450, description: "고급 장신구 제작이나 보석상 납품에 쓰는 초록 보석입니다.", icon: "cc0-jetrel-gem-emerald" }),
    catalogItem({ id: "item_gem_ruby", name: "천연 루비", price: 500, description: "화염 장비 제작이나 보석상 납품에 쓰는 붉은 보석입니다.", icon: "cc0-jetrel-gem-ruby" }),
    catalogItem({ id: "item_gem_sapphire", name: "천연 사파이어", price: 480, description: "냉기 장비 제작이나 보석상 납품에 쓰는 푸른 보석입니다.", icon: "cc0-jetrel-gem-sapphire" }),
    catalogItem({ id: "item_gold_bar", name: "왕실 금괴", price: 1000, description: "고급 장비 제작이나 큰돈이 필요할 때 판매하는 순금괴입니다.", icon: "cc0-jetrel-gold-bar" }),
    catalogItem({ id: "item_hide", name: "질긴 가죽", price: 50, description: "갑옷과 가방을 제작할 때 쓰는 질긴 짐승 가죽입니다.", icon: "cc0-jetrel-hide" }),
    catalogItem({ id: "item_ink", name: "검은 잉크", price: 25, description: "주문서와 기록 문서를 작성할 때 쓰는 검은 잉크입니다.", icon: "cc0-jetrel-ink" }),
    catalogItem({ id: "item_iron_ore", name: "철 광석", price: 120, description: "채굴한 뒤 철제 도구 제작이나 상점 판매에 쓰는 광석입니다.", icon: "cc0-jetrel-iron-ore" }),
    catalogItem({ id: "item_leather_patch", name: "재단 가죽 조각", price: 35, description: "가죽 방어구를 제작하거나 수선할 때 쓰는 재단 조각입니다.", icon: "cc0-jetrel-leather-patch" }),
    catalogItem({ id: "item_meat", name: "짐승 고기", price: 60, description: "사냥으로 얻어 상점에 팔거나 고기 요리에 쓰는 식재료입니다.", icon: "cc0-jetrel-meat" }),
    catalogItem({ id: "item_milk", name: "우유", price: 180, description: "가축에게서 얻어 상점에 팔거나 유제품 가공에 쓰는 수확물입니다.", icon: "cc0-jetrel-milk" }),
    catalogItem({ id: "item_mushroom", name: "숲 버섯", price: 40, description: "숲에서 채집해 상점에 팔거나 연금술 재료로 쓰는 버섯입니다.", icon: "cc0-jetrel-mushroom" }),
    catalogItem({ id: "item_oil", name: "등불 기름", price: 30, description: "등불 연료와 화염 도구 제작에 쓰는 정제 기름입니다.", icon: "cc0-jetrel-oil" }),
    catalogItem({ id: "item_pearl", name: "큰 진주", price: 350, description: "고급 장신구 제작이나 해안 상점 납품에 쓰는 진주입니다.", icon: "cc0-jetrel-pearl" }),
    catalogItem({ id: "item_potato", name: "감자", price: 70, description: "밭에서 수확해 상점에 팔거나 든든한 요리에 쓰는 작물입니다.", icon: "cc0-jetrel-potato" }),
    catalogItem({ id: "item_scale", name: "마룡의 비늘", price: 600, description: "최상급 방어구 제작이나 길드 의뢰 납품에 쓰는 비늘입니다.", icon: "cc0-jetrel-scale" }),
    catalogItem({ id: "item_screw", name: "강철 나사", price: 20, description: "기계 장치와 공구를 조립할 때 쓰는 강철 부품입니다.", icon: "cc0-jetrel-screw" }),
    catalogItem({ id: "item_seed_bag", name: "씨앗 자루", price: 45, description: "농사 의뢰 납품이나 여러 작물 씨앗의 보관에 쓰는 자루입니다.", icon: "cc0-jetrel-seed-bag" }),
    catalogItem({ id: "item_shell", name: "무지개 조개", price: 90, description: "해변에서 주워 장신구 제작이나 상점 판매에 쓰는 조개입니다.", icon: "cc0-jetrel-shell" }),
    catalogItem({ id: "item_soap", name: "허브 비누", price: 25, description: "생활용품 제작이나 마을 주민의 납품 의뢰에 쓰는 비누입니다.", icon: "cc0-jetrel-soap" }),
    catalogItem({ id: "item_strawberry", name: "딸기", price: 60, description: "밭에서 수확해 상점에 팔거나 달콤한 요리에 쓰는 과일입니다.", icon: "cc0-jetrel-strawberry" }),
    catalogItem({ id: "item_tomato", name: "토마토", price: 100, description: "밭에서 수확해 상점에 팔거나 신선한 요리에 쓰는 작물입니다.", icon: "cc0-jetrel-tomato" }),
    catalogItem({ id: "item_wind_feather", name: "바람새 깃털", price: 110, description: "민첩 장비 제작이나 사냥꾼 길드 납품에 쓰는 가벼운 깃털입니다.", icon: "cc0-jetrel-wind-feather" }),
    catalogItem({ id: "item_wood", name: "목재", price: 35, description: "가구와 농장 시설을 제작할 때 쓰는 잘 다듬은 목재입니다.", icon: "cc0-jetrel-wood" }),

    // Event keys, evidence, and trade goods.
    catalogItem({ id: "item_bell", name: "은빛 손종", price: 0, description: "잠든 문지기를 깨우는 이벤트 조건으로 쓰는 작은 종입니다.", icon: "cc0-jetrel-bell" }),
    catalogItem({ id: "item_camera", name: "낡은 사진기", price: 0, description: "유적의 단서를 촬영하는 조사 퀘스트 조건으로 쓰는 사진기입니다.", icon: "cc0-jetrel-camera" }),
    catalogItem({ id: "item_clock", name: "태엽 시계", price: 120, description: "시계공의 수리 의뢰에 납품하거나 골동품점에 판매하는 시계입니다.", icon: "cc0-jetrel-clock" }),
    catalogItem({ id: "item_coin_pouch", name: "동전 주머니", price: 150, description: "분실물 퀘스트에 돌려주거나 상점에 판매할 수 있는 주머니입니다.", icon: "cc0-jetrel-coin-pouch" }),
    catalogItem({ id: "item_compass", name: "탐험가 나침반", price: 0, description: "미지의 지역으로 진입하는 탐험 이벤트 조건에 쓰는 나침반입니다.", icon: "cc0-jetrel-compass" }),
    catalogItem({ id: "item_fishing_rod", name: "낚싯대", price: 90, description: "낚시 이벤트를 시작하거나 어부의 퀘스트를 진행하는 도구입니다.", icon: "cc0-jetrel-fishing-rod" }),
    catalogItem({ id: "item_flute", name: "목동의 피리", price: 0, description: "흩어진 가축을 부르는 이벤트 조건으로 쓰는 나무 피리입니다.", icon: "cc0-jetrel-flute" }),
    catalogItem({ id: "item_lantern", name: "광부의 등불", price: 70, description: "어두운 광산 진입 이벤트나 광부 퀘스트에 쓰는 등불입니다.", icon: "cc0-jetrel-lantern" }),
    catalogItem({ id: "item_letter", name: "배달 편지", price: 0, description: "수신인에게 전해야 하는 배달 퀘스트의 증표입니다.", icon: "cc0-jetrel-letter" }),
    catalogItem({ id: "item_map", name: "낡은 지역 지도", price: 0, description: "숨겨진 장소를 발견하는 탐험 이벤트 조건으로 쓰는 지도입니다.", icon: "cc0-jetrel-map" }),
    catalogItem({ id: "item_medal", name: "용병 훈장", price: 0, description: "용병 길드의 신뢰를 증명하는 퀘스트용 훈장입니다.", icon: "cc0-jetrel-medal" }),
    catalogItem({ id: "item_mirror", name: "은제 거울", price: 180, description: "저택의 유령을 비추는 이벤트 조건이나 골동품 납품에 쓰입니다.", icon: "cc0-jetrel-mirror" }),
    catalogItem({ id: "item_net", name: "사냥 그물", price: 55, description: "작은 짐승을 붙잡는 사냥 이벤트 조건으로 쓰는 튼튼한 그물입니다.", icon: "cc0-jetrel-net" }),
    catalogItem({ id: "item_notebook", name: "모험 수첩", price: 0, description: "조사한 단서를 기록하고 추적하는 퀘스트 조건으로 쓰는 수첩입니다.", icon: "cc0-jetrel-notebook" }),
    catalogItem({ id: "item_old_key_scroll", name: "봉인 해제문", price: 0, description: "고대 열쇠의 봉인을 푸는 이벤트 조건으로 쓰는 두루마리입니다.", icon: "cc0-jetrel-old-key-scroll" }),
    catalogItem({ id: "item_pass", name: "성문 통행증", price: 0, description: "경비병을 지나 성 안으로 들어가는 이벤트 조건에 쓰는 증서입니다.", icon: "cc0-jetrel-pass" }),
    catalogItem({ id: "item_quill", name: "기록용 깃펜", price: 20, description: "서기관의 문서 제작 의뢰에 납품하는 잘 다듬은 깃펜입니다.", icon: "cc0-jetrel-quill" }),
    catalogItem({ id: "item_radio", name: "휴대 무전기", price: 0, description: "원거리 동료와 연락하는 구조 퀘스트 조건으로 쓰는 장치입니다.", icon: "cc0-jetrel-radio" }),
    catalogItem({ id: "item_rope", name: "튼튼한 밧줄", price: 40, description: "절벽을 오르거나 구조 작업을 진행하는 이벤트 조건에 쓰입니다.", icon: "cc0-jetrel-rope" }),
    catalogItem({ id: "item_ticket", name: "축제 입장권", price: 0, description: "마을 축제장에 입장하는 이벤트 조건으로 쓰는 표입니다.", icon: "cc0-jetrel-ticket" }),
    catalogItem({ id: "item_torch", name: "모험가 횃불", price: 25, description: "어두운 동굴을 조사하는 이벤트 조건이나 탐험 납품에 쓰입니다.", icon: "cc0-jetrel-torch" }),
    catalogItem({ id: "item_trophy", name: "우승 트로피", price: 0, description: "대회 우승 사실을 증명하고 보상 이벤트를 여는 기념품입니다.", icon: "cc0-jetrel-trophy" }),
  ];
}
