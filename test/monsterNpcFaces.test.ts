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
});
