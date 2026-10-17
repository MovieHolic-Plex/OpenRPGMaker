import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMonsterExpedition } from '@/project/examples/monsterExpedition';
import { TRAINER_HERO_BACK } from '@/project/examples/monsterExpedition/trainerArt';

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
