// QA-only copy of the item runtime fixture for the default pixel ESC menu. Game content is untouched.
// Shows walking party windows, a poisoned member, a heal target preview and "best equipment".
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function writeEscPixelFixture() {
  const project = JSON.parse(await readFile(new URL('../../../test/fixtures/projects/item-runtime-qa-v3.json', import.meta.url), 'utf8'));
  for (const item of project.database.items) {
    if (['item_potion', 'item_ether', 'item_antidote', 'item_antidote_plus'].includes(item.id)) item.type = 'medicine';
  }
  delete project.system.menuUiStyle; // 기본 스킨(pixel) 경로 그대로
  project.session.inventory = {
    ...project.session.inventory,
    equip_iron_sword: 1, equip_steel_armor: 1, equip_gen_helm_iron: 1, equip_gen_ring_power: 1,
  };
  project.session.gold = 1200;
  // 마도사는 독 — 첫 화면과 해독제 대상 카드가 「독 → 정상」 을 보여야 한다. 세션 상태는 project.session 에서
  // 이어지지 않으므로, 한 번만 도는 자동 이벤트가 실제 「Change State」 명령으로 건다(셀프 스위치로 종료).
  const map = project.maps[project.startMapId];
  map.events.push({
    id: 'qa_poison_mage', x: 0, y: 0, trigger: { kind: 'auto' }, commands: [],
    pages: [
      { id: 'qa_poison_once', name: 'QA 독', conditions: [], graphic: { direction: 'down', pattern: 1 }, trigger: { kind: 'auto' }, priority: 'below',
        movement: { type: 'fixed', speed: 3, frequency: 3 },
        commands: [
          { kind: 'm2Command', commandId: 'm2-019-change-state', fields: { target: 'actor_mage', operation: 'add', value: 'state_poison' } },
          { kind: 'setSelfSwitch', key: 'A', value: true },
        ] },
      { id: 'qa_poison_done', name: 'QA 독 끝', conditions: [{ kind: 'selfSwitch', key: 'A', value: true }], graphic: { direction: 'down', pattern: 1 }, trigger: { kind: 'action' }, priority: 'below',
        movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [] },
    ],
  });
  const path = resolve('verify-shots/runtime-qa/_fixtures/esc-pixel.json');
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}

