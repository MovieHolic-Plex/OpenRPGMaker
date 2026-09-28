// QA-only copy of the item runtime fixture: an inn keeper and a one-slime battle next to the start tile.
// Covers the default pixel window inn (party before → after, gold before → after), battle result
// (walking party, EXP bars, one level-up window per hero, loot before → after) and the troop's
// 「전투 뒤」 victory list (a line of text + a switch, run once on the field). Game content is untouched.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function writeInnBattlePixelFixture() {
  const project = JSON.parse(await readFile(new URL('../../../test/fixtures/projects/item-runtime-qa-v3.json', import.meta.url), 'utf8'));
  delete project.system.menuUiStyle;
  project.session.gold = 1200;
  const map = project.maps[project.startMapId];
  const graphic = structuredClone(map.events[0].pages[0].graphic);
  const page = (id, commands) => ({ id, name: id, conditions: [], graphic, trigger: { kind: 'action' }, priority: 'same',
    movement: { type: 'fixed', speed: 3, frequency: 3 }, commands });
  const { x, y } = project.startPos;
  map.events = map.events.filter((event) => !(Math.abs(event.x - x) <= 1 && Math.abs(event.y - y) <= 1));
  // 오른쪽: 여관 주인(1인 20G, 넷이면 80G) · 왼쪽: 슬라임 전투(경험치를 크게 줘서 레벨 업을 보인다).
  map.events.push({ id: 'qa_inn', x: x + 1, y, trigger: { kind: 'action' }, commands: [], pages: [page('qa_inn_page', [{ kind: 'inn', price: 80 }])] });
  map.events.push({ id: 'qa_battle', x: x - 1, y, trigger: { kind: 'action' }, commands: [], pages: [page('qa_battle_page', [{ kind: 'battleProcessing', troopId: 'troop_slime', canEscape: true, canLose: true }])] });
  const slime = project.database.enemies.find((enemy) => enemy.id === 'enemy_slime');
  slime.stats.maxHp = 1;
  slime.rewards.exp = 9500; // Lv 1 → 6 (곡선 base 1 · extra 677 · accel 40) — 능력치가 실제로 오르는 구간
  slime.rewards.gold = 24;
  slime.rewards.dropRatePercent = 100; // 전리품 창의 「보유 n → n+1」 을 보인다
  // 전투 뒤 이벤트 — 승리 후 필드에서 대사 한 줄 + 스위치. 전투를 연 맵 이벤트에는 아무것도 없다.
  const troop = project.database.troops.find((entry) => entry.id === 'troop_slime');
  troop.afterBattle = { victory: [
    { kind: 'text', body: '슬라임 정찰대를 물리쳤다. 길이 열렸다.' },
    { kind: 'setSwitch', switchId: 'sw_0001', value: true },
  ] };
  const path = resolve('verify-shots/runtime-qa/_fixtures/inn-battle-pixel.json');
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}

