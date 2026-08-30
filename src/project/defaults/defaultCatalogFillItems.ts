import { normalizeItemRecord } from "../databaseRecordModel";
import type { ItemRecord } from "../types";

function catalogFillItem(record: Parameters<typeof normalizeItemRecord>[0]): ItemRecord {
  return normalizeItemRecord(record);
}

/** 저밀도 아이템 유형을 저작 예시로 활용할 수 있도록 보충한다. */
export function defaultCatalogFillItemRecords(): ItemRecord[] {
  return [
    // 기술 습득서
    catalogFillItem({ id: "item_catalog_attack_manual", name: "투척술 교범", type: "book", scope: "ally", price: 240, description: "선택한 아군에게 원거리에서 단검을 던지는 투척술을 가르칩니다.", iconResourceId: "cc0-jetrel-book-sword", imageResourceId: "cc0-jetrel-book-sword", occasion: "field", consumable: true, learnedSkillId: "skill_throwing_knife" }),
    catalogFillItem({ id: "item_catalog_fire_grimoire", name: "홍염 마도서", type: "book", scope: "ally", price: 390, description: "선택한 아군에게 불꽃을 다루는 화염 마법을 가르칩니다.", iconResourceId: "cc0-jetrel-book-magic", imageResourceId: "cc0-jetrel-book-magic", occasion: "field", consumable: true, learnedSkillId: "skill_fire" }),
    catalogFillItem({ id: "item_catalog_water_grimoire", name: "청류 마도서", type: "book", scope: "ally", price: 380, description: "선택한 아군이 물줄기를 쏘는 물대포 기술을 배웁니다.", iconResourceId: "cc0-jetrel-book-magic", imageResourceId: "cc0-jetrel-book-magic", occasion: "field", consumable: true, learnedSkillId: "skill_water" }),
    catalogFillItem({ id: "item_catalog_leaf_scroll", name: "푸른 잎 비전서", type: "book", scope: "ally", price: 350, description: "선택한 아군에게 날카로운 잎날 공격법을 전수합니다.", iconResourceId: "cc0-jetrel-scroll", imageResourceId: "cc0-jetrel-scroll", occasion: "field", consumable: true, learnedSkillId: "skill_leaf" }),
    catalogFillItem({ id: "item_catalog_healing_tome", name: "온기의 치유서", type: "book", scope: "ally", price: 420, description: "선택한 아군이 상처를 회복시키는 치유 기술을 익힙니다.", iconResourceId: "cc0-jetrel-skill-book", imageResourceId: "cc0-jetrel-skill-book", occasion: "field", consumable: true, learnedSkillId: "skill_heal" }),
    catalogFillItem({ id: "item_catalog_poison_codex", name: "독침 연구서", type: "book", scope: "ally", price: 370, description: "선택한 아군에게 독을 묻힌 침 공격 요령을 가르칩니다.", iconResourceId: "cc0-jetrel-notebook", imageResourceId: "cc0-jetrel-notebook", occasion: "field", consumable: true, learnedSkillId: "skill_poison_sting" }),
    catalogFillItem({ id: "item_catalog_sleep_scroll", name: "꿈안개 주문서", type: "book", scope: "ally", price: 410, description: "선택한 아군이 적을 잠재우는 수면 안개를 습득합니다.", iconResourceId: "cc0-jetrel-scroll", imageResourceId: "cc0-jetrel-scroll", occasion: "field", consumable: true, learnedSkillId: "skill_sleep_mist" }),
    catalogFillItem({ id: "item_catalog_weaken_manual", name: "쇠약의 전술서", type: "book", scope: "ally", price: 400, description: "선택한 아군에게 적의 방어를 낮추는 약화술을 전합니다.", iconResourceId: "cc0-jetrel-skill-book", imageResourceId: "cc0-jetrel-skill-book", occasion: "field", consumable: true, learnedSkillId: "skill_weaken" }),

    // 영구 성장 씨앗
    catalogFillItem({ id: "item_catalog_balance_seed", name: "균형의 씨앗", type: "seed", scope: "ally", price: 540, description: "선택한 아군의 공격력과 방어력을 영구히 1씩 높입니다.", iconResourceId: "cc0-jetrel-seed-bag", imageResourceId: "cc0-jetrel-seed-bag", occasion: "field", consumable: true, seedParameterBonuses: { attack: 1, defense: 1, mind: 0, agility: 0 } }),
    catalogFillItem({ id: "item_catalog_insight_seed", name: "통찰의 씨앗", type: "seed", scope: "ally", price: 560, description: "선택한 아군의 정신력과 민첩성을 영구히 1씩 더합니다.", iconResourceId: "cc0-jetrel-gen2-wisdom-seed", imageResourceId: "cc0-jetrel-gen2-wisdom-seed", occasion: "field", consumable: true, seedParameterBonuses: { attack: 0, defense: 0, mind: 1, agility: 1 } }),
    catalogFillItem({ id: "item_catalog_mastery_seed", name: "숙련의 씨앗", type: "seed", scope: "ally", price: 1200, description: "선택한 아군의 네 가지 전투 능력을 영구히 1씩 올립니다.", iconResourceId: "cc0-jetrel-gen2-might-seed", imageResourceId: "cc0-jetrel-gen2-might-seed", occasion: "field", consumable: true, seedParameterBonuses: { attack: 1, defense: 1, mind: 1, agility: 1 } }),

    // 이벤트 스위치 기동품
    catalogFillItem({ id: "item_catalog_gate_relay", name: "성문 기동패", type: "switch", scope: "none", price: 0, description: "메뉴에서 사용해 성문 개방 이벤트 스위치를 켭니다.", iconResourceId: "cc0-jetrel-gen2-bridge-relay", imageResourceId: "cc0-jetrel-gen2-bridge-relay", occasion: "field", consumable: true, switchId: "sw_catalog_gate_open" }),
    catalogFillItem({ id: "item_catalog_lighthouse_relay", name: "등대 점화패", type: "switch", scope: "none", price: 0, description: "메뉴에서 사용해 등대 불빛 점화 스위치를 작동시킵니다.", iconResourceId: "cc0-jetrel-gen2-sun-relay", imageResourceId: "cc0-jetrel-gen2-sun-relay", occasion: "field", consumable: true, switchId: "sw_catalog_lighthouse_lit" }),
    catalogFillItem({ id: "item_catalog_lift_relay", name: "승강기 기동패", type: "switch", scope: "none", price: 0, description: "메뉴에서 사용해 광산 승강기 운행 스위치를 켭니다.", iconResourceId: "cc0-jetrel-gear", imageResourceId: "cc0-jetrel-gear", occasion: "field", consumable: true, switchId: "sw_catalog_mine_lift" }),
    catalogFillItem({ id: "item_catalog_fountain_relay", name: "분수 작동패", type: "switch", scope: "none", price: 0, description: "메뉴에서 사용해 광장 분수의 작동 스위치를 전환합니다.", iconResourceId: "cc0-jetrel-crystal", imageResourceId: "cc0-jetrel-crystal", occasion: "field", consumable: true, switchId: "sw_catalog_fountain_flow" }),
    catalogFillItem({ id: "item_catalog_archive_relay", name: "서고 해제패", type: "switch", scope: "none", price: 0, description: "메뉴에서 사용해 비밀 서고의 잠금 해제 스위치를 켭니다.", iconResourceId: "cc0-jetrel-old-key-scroll", imageResourceId: "cc0-jetrel-old-key-scroll", occasion: "field", consumable: true, switchId: "sw_catalog_archive_unlock" }),
    catalogFillItem({ id: "item_catalog_beacon_relay", name: "봉화 점화패", type: "switch", scope: "none", price: 0, description: "메뉴에서 사용해 산마루 봉화 점화 스위치를 작동시킵니다.", iconResourceId: "cc0-jetrel-torch", imageResourceId: "cc0-jetrel-torch", occasion: "field", consumable: true, switchId: "sw_catalog_beacon_lit" }),
    catalogFillItem({ id: "item_catalog_aqueduct_relay", name: "수로 전환패", type: "switch", scope: "none", price: 0, description: "메뉴에서 사용해 지하 수로의 흐름 전환 스위치를 켭니다.", iconResourceId: "cc0-jetrel-gen2-moon-relay", imageResourceId: "cc0-jetrel-gen2-moon-relay", occasion: "field", consumable: true, switchId: "sw_catalog_aqueduct_route" }),
  ];
}
