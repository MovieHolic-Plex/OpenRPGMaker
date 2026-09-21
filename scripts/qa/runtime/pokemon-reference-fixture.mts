// Transient UI contract fixture; does not author or save an application demo.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createScarloxyPokemonDemoProject } from '../../../src/project/defaults/defaultProject';
const project = createScarloxyPokemonDemoProject();
// 마을에서 시작해 상점·회복·이벤트 흐름까지 검증한다. 전투는 마을 남쪽 이벤트로 진입.
project.startMapId = 'map_pkmn_town';
project.startPos = { x: 13, y: 12 };
const map = project.maps[project.startMapId]!;
for (const troop of project.database.troops) { troop.previewBackgroundResourceId = undefined; troop.autoAlign = true; }
for (const terrain of project.database.terrains ?? []) terrain.battleBackgroundResourceId = undefined;
const species = project.database.monsterSpecies!;
// 테스트용 즉시 파티 + 마을 입구에서 바로 전투에 들어갈 수 있는 트리거.
map.events.push({
  id: 'ev_qa_battle_trigger',
  x: 13,
  y: 13,
  trigger: { kind: 'action' },
  commands: [],
  pages: [{
    id: 'ev_qa_battle_trigger_page',
    name: 'QA 전투 트리거',
    conditions: [],
    graphic: { transparent: true },
    trigger: { kind: 'action' },
    priority: 'same',
    movement: { type: 'fixed', speed: 3, frequency: 3 },
    commands: [
      { kind: 'giveMonster', speciesId: 'species_scarloxy_mossling', level: 11 },
      { kind: 'giveMonster', speciesId: 'species_scarloxy_sparchu', level: 7 },
      { kind: 'battleProcessing', troopId: 'troop_pkmn_grass_a', canEscape: true, canLose: true },
    ],
  }],
});
// 전투 없이 몬스터만 지급하는 트리거 — 진화·기술 검증을 깨끗한 필드 상태에서 한다.
map.events.push({
  id: 'ev_qa_give_trigger',
  x: 14,
  y: 13,
  trigger: { kind: 'action' },
  commands: [],
  pages: [{
    id: 'ev_qa_give_trigger_page',
    name: 'QA 지급 트리거',
    conditions: [],
    graphic: { transparent: true },
    trigger: { kind: 'action' },
    priority: 'same',
    movement: { type: 'fixed', speed: 3, frequency: 3 },
    commands: [
      { kind: 'giveMonster', speciesId: 'species_scarloxy_mossling', level: 11 },
      { kind: 'giveMonster', speciesId: 'species_scarloxy_sparchu', level: 7 },
    ],
  }],
});
// 진화 실측용 — 스파르츄(7레벨)를 신드릴로 진화시키는 이벤트. QA 트리거와 같은 칸에 놓고
// 셀프스위치로 1회만 동작한다. 인스턴스 id 는 giveMonster 가 monster_1 부터 순차 부여한다.
map.events.push({
  id: 'ev_qa_evolve_trigger',
  x: 12,
  y: 13,
  trigger: { kind: 'action' },
  commands: [],
  pages: [{
    id: 'ev_qa_evolve_trigger_page',
    name: 'QA 진화 트리거',
    conditions: [],
    graphic: { transparent: true },
    trigger: { kind: 'action' },
    priority: 'same',
    movement: { type: 'fixed', speed: 3, frequency: 3 },
    commands: [
      { kind: 'text', speaker: '박사', body: '실험이다! 몬스터를 진화시켜 보겠다!' },
      { kind: 'evolveMonster', instanceId: 'monster_2', toSpeciesId: 'species_scarloxy_cindrill', successBranch: [{ kind: 'text', body: '진화 성공!' }], failureBranch: [{ kind: 'text', body: '진화 실패…' }] },
    ],
  }],
});
mkdirSync('verify-shots/runtime-qa/pokemon-reference', { recursive: true });
writeFileSync('verify-shots/runtime-qa/pokemon-reference/fixture.json', JSON.stringify(project));
