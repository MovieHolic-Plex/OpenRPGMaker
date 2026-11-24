import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXPEDITION_HERO_BACK, expeditionTrainerFront, gymLeaderArt, inferTrainerRoleFromName, typeArt, TRAINER_HERO_BACK } from "@/project/examples/monsterExpedition/trainerArt";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { isolateTimers } from "./mergedTeardown";

// 몬스터 마을 ⑤ 트레이너 전투 소개 그림 — 캠페인·place_trainer 가 번들 trainerSprite 를 배정한다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterTownTrainerArt", () => {
  isolateTimers();
  const bundled = JSON.parse(readFileSync(resolve("public/assets/battle-trainers/index.json"), "utf8")) as { trainers: Record<string, unknown> };
  const roles = new Set(Object.keys(bundled.trainers));
  describe("trainerArt", () => {
    it("배정하는 모든 역할은 번들 public/assets/battle-trainers 에 실제로 있다", () => {
      const used = new Set<string>([EXPEDITION_HERO_BACK, "hero_f_front"]);
      for (const key of ["water", "dojo", "grass", "fire", "psychic", "ice", "ghost", "dragon", "unknown"]) used.add(gymLeaderArt(key));
      for (const type of ["water", "ice", "rock", "ground", "fighting", "steel", "normal", "grass", "bug", "fire", "dark", "poison", "ghost", "psychic", "electric", "fairy", "dragon", "flying", undefined]) used.add(typeArt(type));
      for (let i = 0; i < 8; i++) used.add(expeditionTrainerFront(`grunt_${i}`, "부하")!);
      for (const role of used) expect(roles.has(role), role).toBe(true);
    });

    it("관장·두목·라이벌·부하·회사원 접미사마다 그림이 정해진다", () => {
      expect(expeditionTrainerFront("leader", "관장", "gym_water")).toBe("gym_water");
      expect(expeditionTrainerFront("boss", "두목")).toBe("punk");
      expect(expeditionTrainerFront("rival", "라이벌")).toBe("hero_f_front");
      expect(expeditionTrainerFront("company_2", "연구원")).toBe("scientist");
      expect(expeditionTrainerFront("grunt_0", "부하")).toBeTruthy();
      expect(expeditionTrainerFront("trainer_0", "낚시꾼 하루")).toBe("fisher");
      expect(expeditionTrainerFront("unknown_suffix", "누군가")).toBeUndefined();
    });

    it("이름 말로 번들 역할을 고르고, 근거가 없으면 지어내지 않는다", () => {
      expect(inferTrainerRoleFromName("곤충채집 소년")).toBe("bug_catcher");
      expect(inferTrainerRoleFromName("등산가 철수")).toBe("hiker");
      expect(inferTrainerRoleFromName("연구원 민")).toBe("scientist");
      expect(inferTrainerRoleFromName("김철수")).toBeUndefined();
    });
  });
});

describe("monsterTrainerArt", () => {
  isolateTimers();
  // 시각 QA D03: 캠페인 트레이너 troop 이 인물 그림 없이 만들어져 전투에 사람이 없었다.
  const bundled = JSON.parse(readFileSync('public/assets/battle-trainers/index.json', 'utf8')).trainers as Record<string, { front?: string; back?: string }>;
  describe('monster campaign trainer pictures', () => {
    const { project } = createMonsterExpedition({});
    const trainers = project.database.troops.filter(t => t.trainerBattle);

    it('gives every trainer troop a bundled front picture and the hero back picture', () => {
      expect(trainers.length).toBeGreaterThan(40);
      for (const troop of trainers) {
        expect(troop.trainerSprite, troop.id).toBeDefined();
        expect(bundled[troop.trainerSprite!.front]?.front, `${troop.id} front`).toBeTruthy();
        expect(bundled[troop.trainerSprite!.back ?? '']?.back, `${troop.id} back`).toBeTruthy();
      }
      expect(bundled[TRAINER_HERO_BACK]?.back).toBeTruthy();
    });

    it('leaves wild troops without trainer pictures', () => {
      for (const troop of project.database.troops.filter(t => !t.trainerBattle)) expect(troop.trainerSprite).toBeUndefined();
    });

    it('puts different faces on the gym leaders and the elite four', () => {
      const faces = (re: RegExp) => trainers.filter(t => re.test(t.id)).map(t => t.trainerSprite!.front);
      const leaders = faces(/gym_leader$/u);
      expect(leaders.length).toBe(8);
      expect(new Set(leaders).size).toBeGreaterThanOrEqual(6);
      const elite = trainers.filter(t => /league_\d_league_challenge$/u.test(t.id) && !/챔피언/u.test(t.name)).map(t => t.trainerSprite!.front);
      expect(new Set(elite).size).toBe(elite.length);
    });

    it('uses the water and rock gym pictures for the matching leaders', () => {
      const byType = (town: string) => trainers.find(t => t.id === `mx_troop_mx_map_${town}_gym_leader`)!.trainerSprite!.front;
      expect(byType('harbor')).toBe('gym_water');
      expect(byType('dune')).toBe('gym_rock');
    });
  });
});
