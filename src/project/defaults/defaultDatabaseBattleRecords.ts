import { normalizeEnemyRecord, normalizeTroopRecord } from "../databaseRecordModel";
import { normalizeMonsterSpeciesRecord } from "../monsterCollection";
import { DEFAULT_ENEMY_ID, DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "./constants";
import { archetypeActions } from "./enemyActionArchetypes";
import { generatedEnemyRecords } from "./generatedEnemyRecords";
import { withRetroMonsterSkills } from "./retroMonsterSkillRecords";

export function defaultBattleRecords() {
  return {
    // 도트 시트(PIXEL_ENEMY_SHEETS)가 있는 적은 레벨대별 몬스터 스킬(RETRO_MONSTER_SKILLSETS)을 행동으로 받는다.
    // generatedEnemyRecords() 자체는 아키타입 출력 그대로 둔다(test/enemyActionArchetypes 의 역판정 계약).
    enemies: [
      normalizeEnemyRecord({"id":"enemy_slime","name":"슬라임","level":1,"speciesId":"species_wild_slime","monsterResourceId":"generated-enemy-slime-01","stats":{"maxHp":324,"maxMp":10,"attack":57,"defense":15,"mind":57,"agility":34},"rewards":{"exp":98,"gold":30,"dropRatePercent":15},"actions":archetypeActions("blob")}),
      normalizeEnemyRecord({"id":"enemy_meadow_slime","name":"초원 슬라임","level":3,"speciesId":"species_king_slime","monsterResourceId":"generated-enemy-slime-01","stats":{"maxHp":107,"maxMp":10,"attack":36,"defense":16,"mind":36,"agility":34},"rewards":{"exp":40,"gold":37,"dropRatePercent":15},"actions":archetypeActions("blob")}),
            // ── 액션 전투 리밸런스(2026-08) ─────────────────────────────────────────
      // 광산 1층(map_mine_1f, actionCombat 옵트인)이 이 레코드들을 실시간 전투로 스폰한다.
      // 기본 주인공 1레벨 스윙(공격력 22, 보너스 0) 기준 스윙 데미지는
      // computeSwingDamage = round(22 - defense/2) (분산 0.9~1.1) 이고,
      // 턴제 TTK 3~5 / TTD 6 설계(2026-09)로 재보정했다(턴제와 같은 수치를 읽는다):
      //   박쥐  hp 108 / def 18 → 테스트(공45) 스윙 36, 3방 · 턴제 3마리 무리 TTK 4.5
      //   골렘  hp 240 / def 30 → 테스트(공45) 스윙 30, 8방 · 턴제 무리 속 탱커 TTK 7 (탱커형)
      //   궁수  hp 256 / def 27 → 테스트(공45) 스윙 32, 8방 · 턴제 Lv16 TTK 3.2 (원거리 견제)
      //   ※ 궁수는 액션 전투와 공유라 턴제 4.5타 목표 대신 액션 8방 상한에 맞춘다.
      normalizeEnemyRecord({"id":"enemy_cave_bat","name":"동굴 박쥐","level":6,"speciesId":"species_cave_bat","monsterResourceId":"generated-enemy-bat-01","stats":{"maxHp":108,"maxMp":10,"attack":37,"defense":18,"mind":37,"agility":35},"rewards":{"exp":40,"gold":37,"dropRatePercent":15},"actions":archetypeActions("flyer"),"actionProfile":{"contactDamage":10,"aggroRange":7,"moveIntervalMs":220,"knockbackResist":0,"attack":{"kind":"melee","windupMs":300,"recoverMs":250,"damage":14,"range":1,"cooldownMs":800}}}),
            normalizeEnemyRecord({"id":"enemy_stone_golem","name":"돌 골렘","level":26,"speciesId":"species_stone_golem","monsterResourceId":"generated-enemy-golem-01","stats":{"maxHp":240,"maxMp":10,"attack":50,"defense":30,"mind":50,"agility":47},"rewards":{"exp":100,"gold":92,"dropRatePercent":15},"actions":archetypeActions("bulwark"),"actionProfile":{"contactDamage":24,"aggroRange":5,"moveIntervalMs":600,"knockbackResist":0.8,"attack":{"kind":"melee","windupMs":1100,"recoverMs":500,"damage":40,"range":1,"cooldownMs":1600}}}),
      // maxMp 40: 4MP 속성기 10회 예산. 다른 보스 10마리(generatedEnemyRecords)와 같은 값이다.
      // MP 가 비용 미만이면 turn 조건 버스트까지 점수 계산 전에 필터되므로(runtime.ts:1798)
      // maxMp 10 으로는 3턴 주기 버스트가 6턴 안에 소진됐다. mind = attack 규약(생성 로스터와
      // 동일)을 적용한다 — 마법 정체성기가 물리 무료기에 영구히 지던 문제를 끊는다.
      // 레벨 40·보스 티어(TTK 8 / TTD 4) — 권장 파티 Lv40 기준 최종 결전.
      normalizeEnemyRecord({"id":"enemy_dragon","name":"붉은 드래곤","level":40,"speciesId":"species_ember_drake","monsterResourceId":"generated-enemy-dragon-01","stats":{"maxHp":1176,"maxMp":40,"attack":192,"defense":43,"mind":192,"agility":67},"rewards":{"exp":353,"gold":222,"dropRatePercent":15},"actions":archetypeActions("boss", "skill_fire")}),
      // enemy_extra_006~120 115건 제거(2026-08-28). maxHp 40,45,50,55… / attack 15,17,18,20… 의
      // 등차수열 더미였고 아트도 enemy-art-NNN.png 공용 슬롯이었다. 실제 몬스터는 위 5종 +
      // enemy_mine_skel_archer + generatedEnemyRecords() 100종이다.
      // 폐광 원거리 적 — 벽 뒤 갱도에서 투석(투사체) 사격. 박쥐보다 단단하고 사거리가 길다.
      // 레벨 16·TTK 4 / TTD 6 — 중반 원거리 견제. 실시간 actionProfile 수치는 유지한다.
      // 광산 궁수는 활을 든 전용 해골 궁수 아트를 쓴다. enemy_skeleton_archer와
      // 역할이 같으므로 이 한 쌍의 공유를 dbImageMatching에서 명시적으로 허용한다.
      // 검을 든 skeleton-01로 가짜 1:1 매핑을 만들거나 legacy enemy_extra 폴백을 쓰지 않는다.
      normalizeEnemyRecord({"id":"enemy_mine_skel_archer","name":"광산 해골 궁수","level":16,"speciesId":"species_mine_skeleton","monsterResourceId":"generated-enemy-skeleton-archer","stats":{"maxHp":256,"maxMp":10,"attack":75,"defense":27,"mind":75,"agility":38},"rewards":{"exp":108,"gold":68,"dropItemId":"item_bone","dropRatePercent":15},"actions":archetypeActions("curse"),"actionProfile":{"contactDamage":8,"aggroRange":9,"moveIntervalMs":450,"knockbackResist":0,"attack":{"kind":"projectile","windupMs":700,"recoverMs":300,"damage":18,"range":8,"cooldownMs":1400,"projectileSpeedTilesPerSec":7}}}),
      ...generatedEnemyRecords(),
    ].map(withRetroMonsterSkills),
    troops: [
      normalizeTroopRecord({
        id: DEFAULT_TROOP_ID,
        name: "슬라임 정찰대",
        enemyIds: [DEFAULT_ENEMY_ID],
        members: [{ enemyId: DEFAULT_ENEMY_ID, x: 88, y: 96 }],
        autoAlign: false,
        previewBackgroundResourceId: "generated-battle-reference-forest",
        battleEventPages: [],
      }),
      normalizeTroopRecord({
        id: "troop_slime_pair",
        name: "초원 슬라임 둘",
        enemyIds: ["enemy_meadow_slime", "enemy_meadow_slime"],
        members: [
          { enemyId: "enemy_meadow_slime", x: 72, y: 88 },
          { enemyId: "enemy_meadow_slime", x: 116, y: 120 },
        ],
        autoAlign: false,
        previewBackgroundResourceId: "generated-battle-reference-forest",
        battleEventPages: [],
      }),
      normalizeTroopRecord({
        id: "troop_bat_swarm",
        name: "동굴 박쥐 떼",
        enemyIds: ["enemy_cave_bat", "enemy_cave_bat", "enemy_cave_bat"],
        members: [
          { enemyId: "enemy_cave_bat", x: 68, y: 64 },
          { enemyId: "enemy_cave_bat", x: 104, y: 100 },
          { enemyId: "enemy_cave_bat", x: 72, y: 132 },
        ],
        autoAlign: false,
        previewBackgroundResourceId: "generated-battle-reference-forest",
        battleEventPages: [],
      }),
      // ── 잿불의 유산 진행에 필요한 전투 그룹 3종 ─────────────────────────────
      // 왜 여기 있는가(2026-07-26 실측): emberQuestGame 이 troop_forest_hornets /
      // troop_golem_guard / troop_dragon 을 battleProcessing 으로 부르는데 **어디에도 정의가
      // 없었다**. projectLint 가 "troopId가 존재하지 않습니다" 로 error 3건을 냈고, 그 전투들은
      // 실행되지 않는다 — 게임을 끝까지 깰 수 없는 직접 원인이다.
      // (emberQuestGame 의 keepTroops 필터는 이 id 들을 통과시키므로 정의만 있으면 된다.)
      //
      // members 좌표를 주지 않는 이유: 엔진이 members 가 없으면 좌안 고전 진형
      // (x=84+(i%2)*44, y=52+i*36)으로 배치하고, x>150 인 좌표는 다시 끌어온다
      // (battleBattlers.ts:238-259). 좌표를 손으로 찍으면 그 규칙과 어긋날 뿐이다.
      //
      // 난이도 곡선: 슬라임 둘 → 말벌(셋) → 박쥐 떼(셋) → 골렘 호위(셋) → 드래곤(단독 보스).
      normalizeTroopRecord({
        id: "troop_forest_hornets",
        name: "숲 말벌 무리",
        // 슬라임 둘의 다음 단계 — 수는 하나 늘고 빠른 개체가 섞인다.
        enemyIds: ["enemy_meadow_slime", "enemy_cave_bat", "enemy_meadow_slime"],
        autoAlign: true,
        previewBackgroundResourceId: "generated-battle-reference-forest",
        battleEventPages: [],
      }),
      normalizeTroopRecord({
        id: "troop_golem_guard",
        name: "석상 수호병",
        // 폐광 보스 — 단단한 본체 + 빠른 호위 둘. 박쥐 떼보다 화력이 높다.
        enemyIds: ["enemy_cave_bat", "enemy_stone_golem", "enemy_cave_bat"],
        autoAlign: true,
        previewBackgroundResourceId: "generated-battle-reference-forest",
        battleEventPages: [],
      }),
      normalizeTroopRecord({
        id: "troop_mine_archers",
        name: "광산 해골 궁수",
        // 폐광 갱도의 원거리 견제 — 단독 배치. 액션 전투 맵 스폰 전용.
        enemyIds: ["enemy_mine_skel_archer"],
        autoAlign: true,
        previewBackgroundResourceId: "generated-battle-reference-forest",
        battleEventPages: [],
      }),
      normalizeTroopRecord({
        id: "troop_dragon",
        name: "붉은 드래곤",
        // 최종 보스 — 단독. 호위를 붙이면 canLose=false 결전이 과해진다.
        enemyIds: ["enemy_dragon"],
        autoAlign: true,
        previewBackgroundResourceId: "generated-battle-reference-forest",
        battleEventPages: [],
      }),
    ],
    monsterSpecies: [
      // ── 스타터 3종(포획·육성 튜토리얼용) ───────────────────────────────
      // B6 밸런스 튜닝 스펙(4e7a9590): 탱커 리프링·속공 스파킷·밸런스 아쿠아링.
      // give_starter_monsters·밸런스·언락 테스트가 이 id 를 직접 참조한다.
      normalizeMonsterSpeciesRecord({"id":"species_leafling","name":"리프링","types":["grass"],"graphic":{"monsterResourceId":"generated-enemy-leafling-01","graphicHue":0,"transparent":false,"flying":false},"baseStats":{"maxHp":36,"maxMp":6,"attack":7,"defense":13,"mind":9,"agility":12},"captureRate":0.45,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":3,"skillId":"skill_leaf"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_sparkit","name":"스파킷","types":["fire"],"graphic":{"monsterResourceId":"generated-enemy-sparkit-fire","graphicHue":0,"transparent":false,"flying":false},"baseStats":{"maxHp":25,"maxMp":8,"attack":7,"defense":8,"mind":11,"agility":16},"captureRate":0.45,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":3,"skillId":"skill_fire"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_aqualing","name":"아쿠아링","types":["water"],"graphic":{"monsterResourceId":"generated-enemy-aqualing-01","graphicHue":0,"transparent":false,"flying":false},"baseStats":{"maxHp":30,"maxMp":8,"attack":7,"defense":11,"mind":12,"agility":13},"captureRate":0.45,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":3,"skillId":"skill_water"}]}),
      // ── 야생 5종 + 광산 해골 ───────────────────────────────────────────
      // a06dd69d 스펙 복원: 타입·포획률·기술·진화가 전부 달랐던 시절의 값이다.
      // 2026-08-28 다이어트 때 스탯 등차수열로 평탄화돼 6종 전부
      // normal/포획 0.4/skill_attack 하나로 뭉개졌다. 타입은 기본 차트(fire/water/grass)에
      // 속한 것만 쓴다 — 차트 밖 타입은 배율 1 고정이라 다양화로 안 보인다.
      normalizeMonsterSpeciesRecord({"id":"species_wild_slime","name":"슬라임","types":["grass"],"graphic":{"monsterResourceId":"generated-enemy-slime-01","graphicHue":0,"transparent":false,"flying":false},"baseStats":{"maxHp":18,"maxMp":4,"attack":10,"defense":7,"mind":6,"agility":16},"expCurve":{"base":2,"extra":1,"acceleration":1},"captureRate":0.7,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":7,"skillId":"skill_leaf"}],"evolutions":[{"toSpeciesId":"species_king_slime","requires":{"level":7}}]}),
      normalizeMonsterSpeciesRecord({"id":"species_king_slime","name":"초원 슬라임","types":["water","grass"],"graphic":{"monsterResourceId":"generated-enemy-slime-01","graphicHue":45,"transparent":false,"flying":false},"baseStats":{"maxHp":42,"maxMp":10,"attack":18,"defense":14,"mind":10,"agility":12},"expCurve":{"base":3,"extra":2,"acceleration":1},"captureRate":0.2,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":7,"skillId":"skill_water"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_cave_bat","name":"동굴 박쥐","types":["fire"],"graphic":{"monsterResourceId":"generated-enemy-bat-01","graphicHue":0,"transparent":false,"flying":true},"baseStats":{"maxHp":20,"maxMp":6,"attack":9,"defense":6,"mind":8,"agility":18},"captureRate":0.55,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":4,"skillId":"skill_fire"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_stone_golem","name":"돌 골렘","types":["grass"],"graphic":{"monsterResourceId":"generated-enemy-golem-01","graphicHue":0,"transparent":false,"flying":false},"baseStats":{"maxHp":64,"maxMp":8,"attack":16,"defense":18,"mind":8,"agility":4},"captureRate":0.35,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":5,"skillId":"skill_leaf"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_ember_drake","name":"붉은 드래곤","types":["fire"],"graphic":{"monsterResourceId":"generated-enemy-dragon-01","graphicHue":0,"transparent":false,"flying":false},"baseStats":{"maxHp":70,"maxMp":10,"attack":22,"defense":20,"mind":12,"agility":14},"captureRate":0.15,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":6,"skillId":"skill_fire"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_forest_hornet","name":"숲 말벌","types":["grass"],"graphic":{"monsterResourceId":"easyrpg-monster-hornet","graphicHue":0,"transparent":false,"flying":true},"baseStats":{"maxHp":26,"maxMp":4,"attack":13,"defense":8,"mind":7,"agility":20},"captureRate":0.5,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":4,"skillId":"skill_leaf"}]}),
      // 광산 해골 궁수(enemy_mine_skel_archer)의 짝 종족. 포획·도감·진화 파이프라인에
      // 들어가려면 speciesId 참조가 있어야 한다. 갱도 등불 컨셉으로 fire — 차트 밖 타입은
      // 배율이 안 보이므로 fire/water/grass 중에서 고른다.
      normalizeMonsterSpeciesRecord({"id":"species_mine_skeleton","name":"광산 해골","types":["fire"],"graphic":{"monsterResourceId":"generated-enemy-skeleton-01","graphicHue":0,"transparent":false,"flying":false},"baseStats":{"maxHp":30,"maxMp":8,"attack":14,"defense":12,"mind":10,"agility":12},"captureRate":0.35,"skillsByLevel":[{"level":1,"skillId":DEFAULT_SKILL_ID},{"level":4,"skillId":"skill_fire"}]}),
      // enemy_extra_006~120 짝이던 species_extra_006~120 115건은 함께 제거했다(2026-08-28).
    ],
  };
}
