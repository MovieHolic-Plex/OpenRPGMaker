import { describe, expect, it } from 'vitest';
import { decodeCharsetFrameIndex } from '@/assets/easyrpgRtp';
import { createMonsterExpedition } from '@/project/examples/monsterExpedition';

// 시각 QA D02: 마을 사람 191 이벤트가 한 시트의 몇 칸으로 몰려 관장·직원·안내원이 같은 얼굴이었다.
describe('monster campaign NPC faces', () => {
  const { project } = createMonsterExpedition({});
  const faces = new Map<string, string>();
  for (const map of Object.values(project.maps)) for (const event of map.events) {
    const graphic = event.pages?.[0]?.graphic;
    const id = graphic?.sprite?.id;
    if (graphic && !graphic.transparent && id?.startsWith('tex_scarloxy_charset_people')) {
      faces.set(`${map.id}/${event.id}`, `${id}#${decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex}`);
    }
  }

  it('never gives an NPC the player chip', () => {
    for (const [event, face] of faces) expect(face, event).not.toBe('tex_scarloxy_charset_people1#0');
  });

  it('spreads NPCs over the whole genre chip set', () => {
    expect(new Set(faces.values()).size).toBeGreaterThanOrEqual(9);
  });

  it('keeps each gym leader distinct from the grunts in the same gym', () => {
    for (const [event, face] of faces) {
      if (!/_gym\/.*_leader$/u.test(event)) continue;
      const map = event.split('/')[0]!;
      for (const [other, otherFace] of faces) if (other.startsWith(`${map}/`) && /_grunt_\d$/u.test(other)) expect(otherFace, `${other} vs ${event}`).not.toBe(face);
    }
  });

  it('keeps nurse and shopkeeper faces apart in the same town', () => {
    for (const [event, face] of faces) {
      if (!/_nurse$/u.test(event)) continue;
      const shop = [...faces].find(([other]) => other.split('/')[0] === event.split('/')[0] && /_shop$/u.test(other));
      if (shop) expect(shop[1]).not.toBe(face);
    }
  });

  // 3차 적대 감사 D34: 오프닝 흉상은 박사인데 연구소 NPC 칩은 밀짚모자 청년이었다. 기존 변형 직군 칩 「박사 · 흰 가운」(ScarloxyPeople3 #5)을 쓴다. 이 테스트는 작성만 하고 실행하지 않았다.
  it('gives the lab professor the existing white-coat doctor chip, not the straw hat', () => {
    const professors = Object.values(project.maps).flatMap((map) => map.events.filter((event) => event.id.endsWith('_professor')));
    expect(professors.length).toBeGreaterThan(0);
    for (const event of professors) {
      const graphic = event.pages![0]!.graphic!;
      expect(graphic.sprite?.id).toBe('tex_oprn_charset_scarloxy_people3');
      expect(decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex).toBe(5);
    }
  });

  // D35: 관장 파티가 같은 종을 되풀이하고 졸개와 같은 레벨 한 줄이었다.
  it('gym leaders field distinct species with a higher-level ace', () => {
    const { database } = project;
    const leaders = database.troops.filter((troop) => /_gym_leader$/u.test(troop.id));
    expect(leaders.length).toBeGreaterThan(0);
    for (const troop of leaders) {
      const enemies = troop.enemyIds.map((id) => database.enemies.find((enemy) => enemy.id === id)!);
      const species = enemies.map((enemy) => enemy.speciesId);
      expect(new Set(species).size, troop.id).toBe(species.length);
      const levels = enemies.map((enemy) => enemy.level ?? 0);
      expect(levels.at(-1)!, troop.id).toBeGreaterThan(levels[0]!);
    }
  });
});
