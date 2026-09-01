import { normalizeEnemyRecord, normalizeTroopRecord } from "../databaseRecordModel";
import { normalizeMonsterSpeciesRecord } from "../monsterCollection";
import { DEFAULT_ENEMY_ID, DEFAULT_TROOP_ID } from "./constants";
import { archetypeActions } from "./enemyActionArchetypes";
import { generatedEnemyRecords } from "./generatedEnemyRecords";

export function defaultBattleRecords() {
  return {
    enemies: [
      normalizeEnemyRecord({"id":"enemy_slime","name":"슬라임","speciesId":"species_wild_slime","monsterResourceId":"generated-enemy-slime-01","stats":{"maxHp":15,"maxMp":10,"attack":8,"defense":5,"mind":10,"agility":10},"rewards":{"exp":5,"gold":4,"dropRatePercent":15},"actions":archetypeActions("blob")}),
      normalizeEnemyRecord({"id":"enemy_meadow_slime","name":"초원 슬라임","speciesId":"species_king_slime","monsterResourceId":"generated-enemy-slime-01","stats":{"maxHp":20,"maxMp":10,"attack":9,"defense":6,"mind":10,"agility":10},"rewards":{"exp":7,"gold":6,"dropRatePercent":15},"actions":archetypeActions("blob")}),
            // ── 액션 전투 리밸런스(2026-08) ─────────────────────────────────────────
      // 광산 1층(map_mine_1f, actionCombat 옵트인)이 이 레코드들을 실시간 전투로 스폰한다.
      // 기본 주인공 1레벨 스윙(공격력 45, 보너스 0) 기준 스윙 데미지는
      // computeSwingDamage = round(45 - defense/2) (분산 0.9~1.1) 이고,
      // 한방 컷이던 25~30 hp 를 3~8방 컷으로 올렸다(턴제에서도 같은 수치를 읽는다):
      //   박쥐  hp 150 / def 14 → 스윙 38, 4방
      //   골렘  hp 200 / def 30 → 스윙 30, 7방
      //   궁수  hp 130 / def 20 → 스윙 35, 4방
      normalizeEnemyRecord({"id":"enemy_cave_bat","name":"동굴 박쥐","speciesId":"species_cave_bat","monsterResourceId":"generated-enemy-bat-01","stats":{"maxHp":150,"maxMp":10,"attack":11,"defense":14,"mind":10,"agility":10},"rewards":{"exp":9,"gold":8,"dropRatePercent":15},"actions":archetypeActions("flyer"),"actionProfile":{"contactDamage":10,"aggroRange":7,"moveIntervalMs":220,"knockbackResist":0,"attack":{"kind":"melee","windupMs":300,"recoverMs":250,"damage":14,"range":1,"cooldownMs":800}}}),
            normalizeEnemyRecord({"id":"enemy_stone_golem","name":"돌 골렘","speciesId":"species_stone_golem","monsterResourceId":"generated-enemy-golem-01","stats":{"maxHp":200,"maxMp":10,"attack":12,"defense":30,"mind":10,"agility":10},"rewards":{"exp":11,"gold":10,"dropRatePercent":15},"actions":archetypeActions("bulwark"),"actionProfile":{"contactDamage":24,"aggroRange":5,"moveIntervalMs":600,"knockbackResist":0.8,"attack":{"kind":"melee","windupMs":1100,"recoverMs":500,"damage":40,"range":1,"cooldownMs":1600}}}),
      normalizeEnemyRecord({"id":"enemy_dragon","name":"붉은 드래곤","speciesId":"species_ember_drake","monsterResourceId":"generated-enemy-dragon-01","stats":{"maxHp":35,"maxMp":10,"attack":14,"defense":9,"mind":10,"agility":10},"rewards":{"exp":13,"gold":12,"dropRatePercent":15},"actions":archetypeActions("boss", "skill_fire")}),
      // enemy_extra_006~120 115건 제거(2026-08-28). maxHp 40,45,50,55… / attack 15,17,18,20… 의
      // 등차수열 더미였고 아트도 enemy-art-NNN.png 공용 슬롯이었다. 실제 몬스터는 위 5종 +
      // enemy_mine_skel_archer + generatedEnemyRecords() 100종이다.
      // 폐광 원거리 적 — 벽 뒤 갱도에서 투석(투사체) 사격. 박쥐보다 단단하고 사거리가 길다.
      // hp 130 / def 20 → 기본 스윙 35, 4방. 리소스는 해골 계열을 재사용한다.
      // 배틀러는 `generated-enemy-skeleton-01`(384×384) 이다. 필러 시절엔
      // `generated-enemy-skeleton-01-enemy_extra_105` 였는데, 그 id 는 레지스트리에 없어
      // enemy_extra_NNN 정규식 폴백으로 떨어졌고 legacy `enemy-art-105.png` **64×64** 가
      // 떴다(나머지 105종은 전부 384×384). 필러 115건 제거 때 남은 유일한 잔재였다.
      // 전용 아트인 `generated-enemy-skeleton-archer` 는 쓰지 않는다 — 그건 이미
      // generatedEnemyRecords() 의 enemy_skeleton_archer 것이고, dbImageMatching 이
      // 생성 로스터의 1:1 아트 매핑을 강제한다(`-01` 접미사만 공유 예외).
      // speciesId 없음: 짝이던 species_extra_105 가 더미 species 와 함께 제거됐다(2026-08-28).
      // generatedEnemyRecords() 100종도 speciesId 를 달지 않으므로 기본 로스터의 표준 형태다.
      normalizeEnemyRecord({"id":"enemy_mine_skel_archer","name":"광산 해골 궁수","speciesId":"species_mine_skeleton","monsterResourceId":"generated-enemy-skeleton-01","stats":{"maxHp":130,"maxMp":10,"attack":13,"defense":20,"mind":10,"agility":10},"rewards":{"exp":12,"gold":11,"dropItemId":"item_bone","dropRatePercent":15},"actions":archetypeActions("curse"),"actionProfile":{"contactDamage":8,"aggroRange":9,"moveIntervalMs":450,"knockbackResist":0,"attack":{"kind":"projectile","windupMs":700,"recoverMs":300,"damage":18,"range":8,"cooldownMs":1400,"projectileSpeedTilesPerSec":7}}}),
      ...generatedEnemyRecords(),
    ],
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
      normalizeMonsterSpeciesRecord({"id":"species_wild_slime","name":"슬라임","types":["normal"],"graphic":{"monsterResourceId":"generated-enemy-slime-01","graphicHue":0,"transparent":true,"flying":false},"baseStats":{"maxHp":20,"maxMp":10,"attack":10,"defense":8,"mind":8,"agility":10},"captureRate":0.4,"skillsByLevel":[{"level":1,"skillId":"skill_attack"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_king_slime","name":"초원 슬라임","types":["normal"],"graphic":{"monsterResourceId":"generated-enemy-slime-01","graphicHue":0,"transparent":true,"flying":false},"baseStats":{"maxHp":22,"maxMp":10,"attack":11,"defense":9,"mind":8,"agility":10},"captureRate":0.4,"skillsByLevel":[{"level":1,"skillId":"skill_attack"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_cave_bat","name":"동굴 박쥐","types":["normal"],"graphic":{"monsterResourceId":"generated-enemy-bat-01","graphicHue":0,"transparent":true,"flying":false},"baseStats":{"maxHp":24,"maxMp":10,"attack":12,"defense":10,"mind":8,"agility":10},"captureRate":0.4,"skillsByLevel":[{"level":1,"skillId":"skill_attack"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_stone_golem","name":"돌 골렘","types":["normal"],"graphic":{"monsterResourceId":"generated-enemy-golem-01","graphicHue":0,"transparent":true,"flying":false},"baseStats":{"maxHp":26,"maxMp":10,"attack":13,"defense":11,"mind":8,"agility":10},"captureRate":0.4,"skillsByLevel":[{"level":1,"skillId":"skill_attack"}]}),
      normalizeMonsterSpeciesRecord({"id":"species_ember_drake","name":"붉은 드래곤","types":["normal"],"graphic":{"monsterResourceId":"generated-enemy-dragon-01","graphicHue":0,"transparent":true,"flying":false},"baseStats":{"maxHp":28,"maxMp":10,"attack":14,"defense":12,"mind":8,"agility":10},"captureRate":0.4,"skillsByLevel":[{"level":1,"skillId":"skill_attack"}]}),
      // 광산 해골 궁수의 짝 종족. 필드 스폰 적은 speciesId 로 종족을 가리켜야 포획·도감·진화
      // 파이프라인에 들어간다 — 이 레코드가 없던 동안 광산 궁수만 종족 없는 적으로 떠 있었다.
      normalizeMonsterSpeciesRecord({"id":"species_mine_skeleton","name":"광산 해골","types":["normal"],"graphic":{"monsterResourceId":"generated-enemy-skeleton-01","graphicHue":0,"transparent":true,"flying":false},"baseStats":{"maxHp":25,"maxMp":10,"attack":13,"defense":12,"mind":8,"agility":10},"captureRate":0.4,"skillsByLevel":[{"level":1,"skillId":"skill_attack"}]}),
      // enemy_extra_006~120 짝이던 species_extra_006~120 115건은 함께 제거했다(2026-08-28).
    ],
  };
}
