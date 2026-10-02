import type { Project } from '@/project/types';
import { questDefId, type QuestDef, type QuestCost, type QuestEffects } from './questDef';

/** Validate all authored references before the compiler changes a project. */
export function validateQuestReferences(project: Project, def: QuestDef): void {
  const fail = (message: string): never => { throw new Error(message); };
  const point = (p: { mapId: string; x: number; y: number; locationId?: string }) => {
    const map = project.maps[p.mapId];
    if (!map) fail(`존재하지 않는 맵: ${p.mapId}`);
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height) fail(`맵 밖 퀘스트 좌표: ${p.mapId} (${p.x},${p.y})`);
  };
  const target = (ref: QuestDef['giver']) => {
    if ('create' in ref) point(ref.create);
    else if (!project.maps[ref.mapId]?.events.some(event => event.id === ref.eventId)) fail(`존재하지 않는 이벤트: ${ref.mapId}/${ref.eventId}`);
  };
  const item = (id: string) => { if (!project.database.items.some(item => item.id === id)) fail(`존재하지 않는 아이템: ${id}`); };
  const troop = (id: string) => { if (!project.database.troops.some(troop => troop.id === id)) fail(`존재하지 않는 부대: ${id}`); };
  const items = (list: QuestCost['items']) => {
    for (const entry of list ?? []) { item(entry.itemId); if (!Number.isSafeInteger(entry.count) || entry.count < 1 || entry.count > 999999) fail('아이템 수량은 1~999999 정수여야 합니다.'); }
    if (new Set(list?.map(entry => entry.itemId)).size !== (list?.length ?? 0)) fail('같은 아이템 요구 수량은 한 항목으로 합쳐 주세요.');
  };
  const cost = (value: QuestCost | undefined) => {
    items(value?.items);
    if (value?.gold !== undefined && (!Number.isSafeInteger(value.gold) || value.gold < 0 || value.gold > 999999)) fail('골드 수량은 0~999999 정수여야 합니다.');
  };
  const effects = (value: QuestEffects | undefined) => {
    for (const actor of value?.actors ?? []) if (!project.database.actors.some(entry => entry.id === actor)) fail(`존재하지 않는 배우: ${actor}`);
    for (const flag of value?.switches ?? []) if (!flag.id || typeof flag.value !== 'boolean') fail('결과 스위치가 올바르지 않습니다.');
    for (const flag of value?.variables ?? []) if (!flag.id || !Number.isFinite(flag.value)) fail('결과 변수가 올바르지 않습니다.');
    // Generated progress flags belong to the compiler, not user-defined effects.
    for (const flag of [...(value?.switches ?? []), ...(value?.variables ?? [])]) if (flag.id.startsWith(`sw_${def.key}_`) || flag.id.startsWith(`var_${def.key}_`)) fail('결과 플래그에 퀘스트 내부 진행 ID를 사용하지 마세요.');
  };
  target(def.giver); cost(def.rewards); items(def.onAcceptItems); effects(def.effects);
  if (!def.steps.length || def.steps.length > 12) fail('퀘스트는 1~12 단계로 구성하세요.');
  if ((project.quests ?? []).some(quest => questDefId(quest) === def.key)) fail('이미 존재하는 퀘스트 key입니다. 새 key를 사용하세요.');
  for (const key of def.requiresQuestKeys ?? []) {
    const required = project.quests?.find(quest => questDefId(quest) === key);
    if (!required || !('steps' in required) || key === def.key) fail(`완료를 요구할 단계 퀘스트가 없습니다: ${key}`);
  }
  for (const step of def.steps) {
    if (step.timePhase && !['morning','day','evening','night'].includes(step.timePhase)) fail('올바르지 않은 시간대입니다.');
    if ('target' in step) {
      target(step.target);
      if (!('create' in def.giver) && !('create' in step.target) && def.giver.mapId === step.target.mapId && def.giver.eventId === step.target.eventId) fail('목표 인물은 보고를 받는 의뢰인과 다른 이벤트를 사용하세요.');
    }
    if (step.kind === 'collect') {
      item(step.itemId);
      if (!Number.isSafeInteger(step.count) || step.count < 1 || step.sources.length < step.count) fail('수집 목표 수량 이상의 일회성 수집원이 필요합니다.');
      step.sources.forEach(source => { point(source); if (source.kind === 'drop') troop(source.troopId); });
    } else if (step.kind === 'kill') { troop(step.troopId); point(step.at); }
    else if (step.kind === 'reach') point(step);
    else if (step.kind === 'inspect') { point(step.at); if (!step.lines.length) fail('조사 단계에 단서 대사를 넣어 주세요.'); }
    else if (step.kind === 'craft') {
      point(step.at);
      if (!project.system.craftRecipes?.some(recipe => recipe.id === step.recipeId)) fail(`존재하지 않는 제작법: ${step.recipeId}`);
    } else if (step.kind === 'deliver') { items([{ itemId: step.itemId, count: step.count }]); items(step.gives); }
    else if (step.kind === 'escort') {
      point(step.destination);
      const sourceMap = 'create' in step.target ? step.target.create.mapId : step.target.mapId;
      if (sourceMap !== step.destination.mapId && project.system.companions?.clearOnTransfer) fail('맵 간 동행은 system.companions.clearOnTransfer:false가 필요합니다.');
    }
    else if (step.kind === 'choice') {
      if (step.options.length < 2 || step.options.length > 6 || !step.options.some(option => option.completes !== false)) fail('선택은 2~6개이며 성공 선택지가 필요합니다.');
      for (const option of step.options) { cost(option.cost); effects(option.effects); if (option.troopId) troop(option.troopId); }
    }
  }
  for (const gate of def.gates ?? []) { point(gate); if (!Number.isInteger(gate.requiresStep) || gate.requiresStep < 0 || gate.requiresStep >= def.steps.length) fail('gate.requiresStep 범위 오류'); }
  for (const change of def.worldChanges ?? []) {
    if (!project.maps[change.target.mapId]?.events.some(event => event.id === change.target.eventId)) fail('세계 변화는 이미 존재하는 mapId/eventId를 참조해야 합니다.');
    if (!change.lines.length) fail('세계 변화 대사를 넣어 주세요.');
  }
}
