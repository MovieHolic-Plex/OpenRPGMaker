// 묶음 p2 — 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석, 스킬 형식은 retroClassSkills.ts(RetroClassSkill).
// 생성 파일: scripts/asset-gen/pixel-fx/r2w3_emit.py (정본 목록은 r2w3_skills.py). 직접 고치지 말고 목록을 고친 뒤 다시 생성한다.
import type { RetroRosterBatch } from "@/assets/retroRoster";

export const BATCH: RetroRosterBatch = {
  skills: [
    { id: "skill_gypsy_tarot_flick", classId: "class_gypsy", actorId: "actor_gypsy", name: "타로 던지기", level: 1, motion: "shoot", description: "타로 카드를 부채질하듯 날려 적을 벤다", layers: [{ key: "gypsy_card", anchor: "projectile", frame: 32, frames: 4 }, { key: "gypsy_card_hit", anchor: "target", frame: 64, frames: 8 }] },
    { id: "skill_gypsy_crystal_gaze", classId: "class_gypsy", actorId: "actor_gypsy", name: "수정구의 환영", level: 3, motion: "cast", description: "수정구를 띄워 환영 광선을 쏘고 산산이 부순다", layers: [{ key: "gypsy_crystal", anchor: "target", frame: 64, frames: 10 }] },
    { id: "skill_gypsy_curse_card", classId: "class_gypsy", actorId: "actor_gypsy", name: "저주 카드", level: 5, motion: "cast", description: "검은 카드를 내리꽂아 해골 독기로 저주한다", layers: [{ key: "gypsy_curse", anchor: "target", frame: 64, frames: 10 }] },
    { id: "skill_gypsy_wheel_fortune", classId: "class_gypsy", actorId: "actor_gypsy", name: "운명의 수레바퀴", level: 7, motion: "cast", description: "황금 수레바퀴를 돌려 모든 적의 운을 뒤튼다", layers: [{ key: "gypsy_wheel", anchor: "allTargets", frame: 64, frames: 10 }] },
    { id: "skill_gypsy_veil_dance", classId: "class_gypsy", actorId: "actor_gypsy", name: "베일 춤", level: 10, motion: "buff", description: "베일 리본과 금화를 휘감아 몸을 가볍게 한다", layers: [{ key: "gypsy_dance", anchor: "user", frame: 64, frames: 10 }] },
    { id: "skill_gypsy_lovers_charm", classId: "class_gypsy", actorId: "actor_gypsy", name: "연인의 매혹", level: 12, motion: "cast", description: "붉은 하트와 보랏빛 하트가 얽혀 적의 마음을 사로잡는다", layers: [{ key: "gypsy_lovers", anchor: "target", frame: 64, frames: 10 }] },
    { id: "skill_gypsy_card_storm", classId: "class_gypsy", actorId: "actor_gypsy", name: "카드 회오리", level: 16, motion: "spin", description: "카드 수십 장이 회오리로 적진을 갈아 버린다", layers: [{ key: "gypsy_cardstorm", anchor: "allTargets", frame: 64, frames: 10 }] },
    { id: "skill_gypsy_star_prophecy", classId: "class_gypsy", actorId: "actor_gypsy", name: "별의 점괘", level: 22, motion: "finisher", description: "「별」 카드를 세워 하늘의 별빛을 쏟아붓는 필살기", layers: [{ key: "gypsy_fate_sky", anchor: "screen", frame: 128, frames: 12 }, { key: "gypsy_fate_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  ],
  partyPixel: []
};
