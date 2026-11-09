import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, eventOf, fail, mapOf, pass, runOn, sameExcept, withoutEvent, type Verdict } from '../matrixNativeSpec';
import { attempt, distinct, eventOn } from './group-4-shared';
import type { Family, FamilyOutcome } from './types';

const troopOf = (project: Project, id: string): any => ((project as any).database.troops as any[]).find(troop => troop.id === id);
const walk = (list: any[] | undefined): any[] => (list ?? []).flatMap((command: any) => {
  if (!command || typeof command !== 'object') return [command];
  const nested: any[] = [];
  if (command.kind === 'choices') for (const option of command.options ?? []) nested.push(...walk(option.branch));
  if (command.kind === 'fork') nested.push(...walk(command.then), ...walk(command.else));
  if (command.kind === 'battleProcessing') nested.push(...walk(command.victoryBranch), ...walk(command.defeatBranch), ...walk(command.escapeBranch));
  return [command, ...nested];
});
const allCommands = (event: any): any[] => (event?.pages ?? []).flatMap((page: any) => walk(page.commands));
const pageCommands = (page: any): any[] => walk(page?.commands);

type Phase = { atHpPercent: number; message?: string; enrageStateId?: string; healPercent?: number };
type PhaseArgs = { troopId: string; enemyId?: string; phases: Phase[] };

const BOSS_HP: Record<string, number> = { enemy_dragon: 1176 };

const bossPhases: Family = {
  id: 'boss-phases',
  area: 'boss',
  mode: 'write',
  title: '보스 HP 구간별 페이즈(대사·상태·회복) 저작',
  variants: [
    { key: 'dragon-two', prompt: '붉은 드래곤이 HP 70% 이하가 되면 「제법이구나!」라고 말하며 공격 상승 상태가 되고, 30% 이하가 되면 「끝이다!」라고 외치게 페이즈를 만들어줘.', args: { troopId: 'troop_dragon', phases: [{ atHpPercent: 70, message: '제법이구나!', enrageStateId: 'state_attack_up' }, { atHpPercent: 30, message: '끝이다!' }] } },
    { key: 'dragon-heal-polite', prompt: '붉은 드래곤 보스전에 페이즈를 하나 넣어 주세요. HP 50% 이하일 때 「아직 끝나지 않았다」라고 말하고 최대 체력의 20%를 회복합니다.', args: { troopId: 'troop_dragon', phases: [{ atHpPercent: 50, message: '아직 끝나지 않았다', healPercent: 20 }] } },
    { key: 'golem-rage', prompt: '석상 수호병 전투에서 돌 골렘이 HP 40% 이하가 되면 「부서져도 지킨다」라고 말하며 버서크 상태가 되게 해줘. 기준은 돌 골렘이야.', args: { troopId: 'troop_golem_guard', enemyId: 'enemy_stone_golem', phases: [{ atHpPercent: 40, message: '부서져도 지킨다', enrageStateId: 'state_berserk' }] } },
    { key: 'dragon-three-terse', prompt: '붉은 드래곤 3페이즈: 80%에서 「불꽃이여」, 50%에서 「분노하라」(방어 하락 상태), 20%에서 「소멸하라」.', args: { troopId: 'troop_dragon', phases: [{ atHpPercent: 80, message: '불꽃이여' }, { atHpPercent: 50, message: '분노하라', enrageStateId: 'state_defense_down' }, { atHpPercent: 20, message: '소멸하라' }] } },
    { key: 'golem-two-explained', prompt: '석상 수호병의 돌 골렘 페이즈를 짜 줘. 돌 골렘 HP가 60% 이하면 「균열이 간다」, 25% 이하면 「마지막 힘」이라고 말하고 그때 최대 체력의 10%를 회복해. 순서대로 발동해야 해.', args: { troopId: 'troop_golem_guard', enemyId: 'enemy_stone_golem', phases: [{ atHpPercent: 60, message: '균열이 간다' }, { atHpPercent: 25, message: '마지막 힘', healPercent: 10 }] } },
  ],
  judge(input, args) {
    const want = args as unknown as PhaseArgs;
    const before = troopOf(input.before, want.troopId), after = troopOf(input.after, want.troopId);
    if (!after) return fail(`${want.troopId} 가 사라졌다`);
    const wasPages: any[] = before.battleEventPages ?? [], nowPages: any[] = after.battleEventPages ?? [];
    for (const old of wasPages) if (!isDeepStrictEqual(old, nowPages.find(page => page.id === old.id))) return fail(`기존 전투 이벤트 페이지 ${old.id} 가 바뀌었다`);
    const added = nowPages.filter(page => !wasPages.some(old => old.id === page.id));
    if (added.length !== want.phases.length) return fail(`새 전투 페이지가 ${added.length}개 — ${want.phases.length}개여야 한다`);
    const enemies: any[] = (input.after as any).database.enemies;
    const bossId = want.enemyId ?? (after.enemyIds ?? [])[0];
    for (const phase of want.phases) {
      const page = added.find(entry => (entry.conditions ?? []).some((condition: any) => condition.kind === 'enemyHpBelow' && condition.percent === phase.atHpPercent));
      if (!page) return fail(`HP ${phase.atHpPercent}% 이하 조건 페이지가 없다`);
      const condition = page.conditions.find((entry: any) => entry.kind === 'enemyHpBelow');
      if (want.enemyId && condition.enemyId !== want.enemyId) return fail(`HP 조건 대상이 ${condition.enemyId} — ${want.enemyId} 여야 한다`);
      if (!(after.enemyIds ?? []).includes(condition.enemyId)) return fail(`HP 조건 대상 ${condition.enemyId} 가 이 트룹의 적이 아니다`);
      const commands = pageCommands(page);
      if (phase.message && !commands.some(command => command.kind === 'text' && String(command.body ?? '').includes(phase.message!))) return fail(`HP ${phase.atHpPercent}% 페이지에 「${phase.message}」 대사가 없다`);
      if (phase.enrageStateId && !commands.some(command => command.kind === 'm2Command' && command.fields?.value === phase.enrageStateId)) return fail(`HP ${phase.atHpPercent}% 페이지에 ${phase.enrageStateId} 상태 부여가 없다`);
      if (!phase.enrageStateId && commands.some(command => command.kind === 'm2Command' && /change-enemy-state/.test(String(command.commandId)))) return fail(`HP ${phase.atHpPercent}% 페이지에 요청하지 않은 상태 부여가 있다`);
      if (phase.healPercent !== undefined) {
        const max = enemies.find(enemy => enemy.id === condition.enemyId)?.stats?.maxHp ?? BOSS_HP[bossId ?? ''] ?? 1;
        const heal = commands.find(command => command.kind === 'm2Command' && /change-enemy-hp/.test(String(command.commandId)));
        const expected = max * phase.healPercent / 100;
        if (!heal || Math.abs(Number(heal.fields?.value) - expected) > Math.max(2, expected * 0.05)) return fail(`HP ${phase.atHpPercent}% 페이지의 회복량이 ${heal?.fields?.value ?? '없음'} — 최대 체력의 ${phase.healPercent}%(약 ${Math.round(expected)})여야 한다`);
      } else if (commands.some(command => command.kind === 'm2Command' && /change-enemy-hp/.test(String(command.commandId)))) return fail(`HP ${phase.atHpPercent}% 페이지에 요청하지 않은 회복이 있다`);
    }
    const blank = (doc: any) => { const troop = doc.database.troops.find((entry: any) => entry.id === want.troopId); if (troop) delete troop.battleEventPages; };
    return sameExcept(input.before, input.after, blank) ? pass(`${want.troopId} 페이즈 ${want.phases.length}개`) : fail('그 트룹의 전투 페이지 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as PhaseArgs;
    return runOn(clone(project), 'author_boss_phases', { troopId: want.troopId, ...(want.enemyId ? { enemyId: want.enemyId } : {}), phases: want.phases });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as PhaseArgs;
    const reference = bossPhases.reference!(clone(project), args) as Project;
    const run = (phases: Phase[], troopId = want.troopId, enemyId = want.enemyId) => attempt(() => runOn(clone(project), 'author_boss_phases', { troopId, ...(enemyId ? { enemyId } : {}), phases }));
    const shifted = want.phases.map((phase, index) => index === 0 ? { ...phase, atHpPercent: Math.max(5, phase.atHpPercent - 10) } : phase);
    return distinct(reference, [
      run(want.phases.slice(0, -1).length ? want.phases.slice(0, -1) : [{ atHpPercent: 50, message: '무관한 대사' }]),
      run(shifted),
      run(want.phases.map((phase, index) => index === 0 ? { ...phase, message: '엉뚱한 대사' } : phase)),
      run(want.phases, want.troopId === 'troop_dragon' ? 'troop_slime' : 'troop_dragon', undefined),
    ]);
  },
};

const BOSS_EVENT = 'ev_ember_guard';
const BOSS_SWITCH_IDS = ['sw_boss_down', 'sw_boss_defeated'];
type BossEventArgs = { eventId: string; troopId: string; canEscape: boolean; canLose: boolean };

function dropNewSwitches(doc: any, before: Project): void {
  const known = new Set(((before as any).switches ?? []).map((entry: any) => entry.id));
  doc.switches = (doc.switches ?? []).filter((entry: any) => known.has(entry.id));
  for (const id of Object.keys(doc.session?.switches ?? {})) if (!known.has(id)) delete doc.session.switches[id];
}

function bossBattle(command: any): boolean { return command.kind === 'battleProcessing'; }

function switchesSetOnVictory(event: any): string[] {
  return (event?.pages ?? []).flatMap((page: any) => walk(page.commands))
    .filter(bossBattle)
    .flatMap((battle: any) => walk(battle.victoryBranch))
    .filter((command: any) => command.kind === 'setSwitch' && command.value !== false)
    .map((command: any) => command.switchId);
}

const bossTroopEvent: Family = {
  id: 'boss-troop-event',
  area: 'boss',
  mode: 'write',
  title: '이벤트에서 보스 전투를 열고 승리하면 스위치를 켠다',
  variants: [
    { key: 'guard-dragon', prompt: '경비병에게 말을 걸면 붉은 드래곤과 전투가 시작되고, 이기면 「보스 처치」 스위치가 켜지게 해줘.', args: { eventId: BOSS_EVENT, troopId: 'troop_dragon', canEscape: false, canLose: false, nameHint: '보스' }, setup: { event: BOSS_EVENT } },
    { key: 'shop-golem', prompt: '잡화점 주인 이벤트를 보스전으로 바꿔 줘. 석상 수호병과 싸우고, 승리하면 스위치를 하나 켜서 기록해 주세요. 도망은 못 치게.', args: { eventId: 'ev_test_shop', troopId: 'troop_golem_guard', canEscape: false, canLose: false }, setup: { event: 'ev_test_shop' } },
    { key: 'resident-bats-escape', prompt: '마을 주민에게 말을 걸면 동굴 박쥐 떼와 전투. 이기면 스위치가 켜지고 도망은 가능하게 해 줘.', args: { eventId: 'ev_utility_npc', troopId: 'troop_bat_swarm', canEscape: true, canLose: false }, setup: { event: 'ev_utility_npc' } },
    { key: 'cutscene-terse', prompt: '장면 연출 이벤트 끝에 슬라임 정찰대 전투, 승리하면 스위치 ON.', args: { eventId: 'ev_test_cutscene', troopId: 'troop_slime', canEscape: true, canLose: false }, setup: { event: 'ev_test_cutscene' } },
    { key: 'guard-mine-lose', prompt: '경비병과 광산 해골 궁수 보스전을 열어 줘. 져도 게임오버가 되지 않게 하고, 이기면 스위치를 켜.', args: { eventId: BOSS_EVENT, troopId: 'troop_mine_archers', canEscape: false, canLose: true }, setup: { event: BOSS_EVENT } },
  ],
  judge(input, args) {
    const want = args as unknown as BossEventArgs;
    const before = eventOf(input.before, want.eventId), after = eventOf(input.after, want.eventId);
    if (!before || !after) return fail(`${want.eventId} 이벤트가 사라졌다`);
    const battles = allCommands(after).filter(bossBattle);
    if (battles.length !== 1) return fail(`전투 명령이 ${battles.length}개 — 하나여야 한다`);
    const battle = battles[0];
    if (battle.troopId !== want.troopId) return fail(`전투 상대 ${battle.troopId} — ${want.troopId} 여야 한다`);
    if (Boolean(battle.canEscape) !== want.canEscape) return fail(`도주 허용 ${battle.canEscape} — ${want.canEscape} 여야 한다`);
    if (Boolean(battle.canLose) !== want.canLose) return fail(`패배 허용 ${battle.canLose} — ${want.canLose} 여야 한다`);
    const flags = switchesSetOnVictory(after);
    if (flags.length < 1) return fail('승리 분기에서 켜지는 스위치가 없다');
    const known = new Set(((input.after as any).switches ?? []).map((entry: any) => entry.id));
    const unknown = flags.filter(id => !known.has(id));
    if (unknown.length) return fail(`승리 분기가 존재하지 않는 스위치(${unknown.join(',')})를 켠다`);
    const defeatedFlags = (battle.defeatBranch ?? []).filter((command: any) => command.kind === 'setSwitch');
    if (defeatedFlags.some((command: any) => flags.includes(command.switchId))) return fail('패배 분기에서도 같은 스위치를 켠다');
    const was = (before.pages ?? []).flatMap((page: any) => page.commands ?? []);
    const now = (after.pages ?? []).flatMap((page: any) => page.commands ?? []);
    let at = 0;
    for (const command of now) if (at < was.length && isDeepStrictEqual(was[at], command)) at++;
    if (at !== was.length) return fail(`${want.eventId} 의 기존 명령이 사라졌거나 순서가 바뀌었다`);
    const blank = (doc: any) => { withoutEvent(want.eventId)(doc); dropNewSwitches(doc, input.before); };
    return sameExcept(input.before, input.after, blank) ? pass(`${want.eventId}: ${want.troopId} 전투, 승리 시 ${flags.join(',')} ON`) : fail('그 이벤트·스위치 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as BossEventArgs;
    return patchBoss(clone(project), want, 'sw_boss_down');
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as BossEventArgs;
    const reference = bossTroopEvent.reference!(clone(project), args) as Project;
    const switchId = 'sw_boss_down';
    const base = () => clone(project);
    const otherTroop = want.troopId === 'troop_slime' ? 'troop_dragon' : 'troop_slime';
    return distinct(reference, [
      attempt(() => patchBoss(base(), { ...want, troopId: otherTroop }, switchId)),
      attempt(() => patchBoss(base(), { ...want, canEscape: !want.canEscape }, switchId)),
      attempt(() => { const event = eventOf(base(), want.eventId); return runOn(base(), 'patch_event_page', { mapId: MAP, eventId: want.eventId, pageIndex: 0, set: { commands: [...event.pages[0].commands, { kind: 'battleProcessing', troopId: want.troopId, canEscape: want.canEscape, canLose: want.canLose }] } }); }),
      attempt(() => patchBoss(base(), want, switchId, 'defeat')),
    ]);
  },
};

function patchBoss(project: Project, want: BossEventArgs, switchId: string, branch: 'victory' | 'defeat' = 'victory'): Project {
  const event = eventOf(project, want.eventId);
  const flag = [{ kind: 'setSwitch', switchId, value: true }];
  const battle: any = { kind: 'battleProcessing', troopId: want.troopId, canEscape: want.canEscape, canLose: want.canLose, victoryBranch: branch === 'victory' ? flag : [], defeatBranch: branch === 'defeat' ? flag : [] };
  return runOn(project, 'patch_event_page', { mapId: MAP, eventId: want.eventId, pageIndex: 0, set: { commands: [...event.pages[0].commands, battle] } });
}

const GATE_BOSS = 'ev_ember_guard';
const GATE_DOOR = 'ev_house_door';
type GateArgs = { troopId: string; destMap: string; destX: number; destY: number };
const bossGateAfter: Family = {
  id: 'boss-gate-after',
  area: 'gate',
  mode: 'write',
  title: '보스를 쓰러뜨린 뒤에만 집 문이 열리도록 연결',
  variants: [
    { key: 'dragon-interior', prompt: '경비병이 붉은 드래곤과 싸우게 하고, 그 보스를 이기면 집 문이 열려서 집 안(map_interior) (2,2)로 들어갈 수 있게 해줘. 이기기 전에는 계속 잠겨 있어야 해.', args: { troopId: 'troop_dragon', destMap: 'map_interior', destX: 2, destY: 2 }, setup: { event: GATE_BOSS } },
    { key: 'golem-plaza', prompt: '경비병과 석상 수호병 전투를 만들고, 승리하면 집 문이 광장 (3,3)으로 이어지게 해 주세요. 승리 전에는 닫힌 채 그대로여야 합니다.', args: { troopId: 'troop_golem_guard', destMap: 'map_plaza', destX: 3, destY: 3 }, setup: { event: GATE_BOSS } },
    { key: 'slime-field', prompt: '경비병이 슬라임 정찰대와 싸워서 이기면 집 문이 숲길 (12,2)로 통하게 해 줘. 이기기 전엔 문이 안 열려.', args: { troopId: 'troop_slime', destMap: 'map_field', destX: 12, destY: 2 }, setup: { event: GATE_BOSS } },
    { key: 'bats-interior-terse', prompt: '박쥐 떼 보스전 → 승리하면 집 문 열림(집 안 (4,4)).', args: { troopId: 'troop_bat_swarm', destMap: 'map_interior', destX: 4, destY: 4 }, setup: { event: GATE_BOSS } },
    { key: 'archers-plaza-explained', prompt: '광산 해골 궁수를 경비병 이벤트의 보스전으로 만들고, 이기면 닫혀 있던 집 문이 열려 광장 (5,5)로 들어가게 연결해 줘. 문의 기존 닫힘 대사는 이기기 전 상태로 남겨 둬.', args: { troopId: 'troop_mine_archers', destMap: 'map_plaza', destX: 5, destY: 5 }, setup: { event: GATE_BOSS } },
  ],
  judge(input, args) {
    const want = args as unknown as GateArgs;
    const boss = eventOf(input.after, GATE_BOSS), door = eventOf(input.after, GATE_DOOR);
    const bossBefore = eventOf(input.before, GATE_BOSS), doorBefore = eventOf(input.before, GATE_DOOR);
    if (!boss || !door) return fail('보스 이벤트나 문 이벤트가 사라졌다');
    const battles = allCommands(boss).filter(bossBattle);
    if (battles.length !== 1 || battles[0].troopId !== want.troopId) return fail(`보스 이벤트의 전투가 ${battles.map((battle: any) => battle.troopId).join(',') || '없음'} — ${want.troopId} 하나여야 한다`);
    const flags = switchesSetOnVictory(boss);
    if (!flags.length) return fail('승리 분기에서 켜지는 스위치가 없다');
    const known = new Set(((input.after as any).switches ?? []).map((entry: any) => entry.id));
    const gateFlag = flags.find(id => known.has(id) && (door.pages ?? []).some((page: any) => (page.conditions ?? []).some((condition: any) => condition.kind === 'switch' && condition.switchId === id && condition.value !== false)));
    if (!gateFlag) return fail('문에 그 승리 스위치를 조건으로 하는 페이지가 없다');
    const open = (door.pages ?? []).filter((page: any) => (page.conditions ?? []).some((condition: any) => condition.kind === 'switch' && condition.switchId === gateFlag));
    const transfers = open.flatMap((page: any) => walk(page.commands)).filter((command: any) => command.kind === 'transfer');
    if (!transfers.some((command: any) => command.mapId === want.destMap && command.x === want.destX && command.y === want.destY)) return fail(`열린 문의 이동이 ${want.destMap} (${want.destX},${want.destY}) 가 아니다`);
    const closed = (door.pages ?? []).filter((page: any) => !(page.conditions ?? []).some((condition: any) => condition.kind === 'switch' && condition.switchId === gateFlag));
    if (!closed.length || closed.some((page: any) => walk(page.commands).some((command: any) => command.kind === 'transfer'))) return fail('이기기 전의 문이 이미 이동시키거나 닫힌 페이지가 없다');
    if (!isDeepStrictEqual(closed[0], doorBefore.pages[0])) return fail('문의 원래 닫힘 페이지가 바뀌었다');
    const was = (bossBefore.pages ?? []).flatMap((page: any) => page.commands ?? []);
    const now = (boss.pages ?? []).flatMap((page: any) => page.commands ?? []);
    let at = 0;
    for (const command of now) if (at < was.length && isDeepStrictEqual(was[at], command)) at++;
    if (at !== was.length) return fail('보스 이벤트의 기존 명령이 사라졌거나 순서가 바뀌었다');
    const blank = (doc: any) => { withoutEvent(GATE_BOSS, GATE_DOOR)(doc); dropNewSwitches(doc, input.before); };
    return sameExcept(input.before, input.after, blank) ? pass(`${want.troopId} 승리(${gateFlag}) 후 문 → ${want.destMap}`) : fail('보스·문 이벤트 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as GateArgs;
    return buildGate(clone(project), want, true);
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as GateArgs;
    const reference = bossGateAfter.reference!(clone(project), args) as Project;
    const base = () => clone(project);
    return distinct(reference, [
      attempt(() => buildGate(base(), want, false)),
      attempt(() => buildGate(base(), { ...want, destX: want.destX + 3 }, true)),
      attempt(() => buildGate(base(), { ...want, troopId: want.troopId === 'troop_slime' ? 'troop_dragon' : 'troop_slime' }, true)),
      attempt(() => { const project2 = buildGate(base(), want, true); const door = eventOf(project2, GATE_DOOR); return runOn(project2, 'patch_event_page', { mapId: MAP, eventId: GATE_DOOR, pageIndex: 0, set: { commands: [{ kind: 'transfer', mapId: want.destMap, x: want.destX, y: want.destY }] } }); }),
    ]);
  },
};

function buildGate(project: Project, want: GateArgs, gated: boolean): Project {
  const boss = eventOf(project, GATE_BOSS);
  const flag = [{ kind: 'setSwitch', switchId: 'sw_boss_down', value: true }];
  const battle: any = { kind: 'battleProcessing', troopId: want.troopId, canEscape: false, canLose: false, victoryBranch: flag, defeatBranch: [] };
  const withBoss = runOn(project, 'patch_event_page', { mapId: MAP, eventId: GATE_BOSS, pageIndex: 0, set: { commands: [...boss.pages[0].commands, battle] } });
  return runOn(withBoss, 'add_event_page', {
    mapId: MAP, eventId: GATE_DOOR,
    page: { name: '열린 문', conditions: gated ? [{ kind: 'switch', switchId: 'sw_boss_down', value: true }] : [], commands: [{ kind: 'transfer', mapId: want.destMap, x: want.destX, y: want.destY, fade: 'black' }] },
  });
}

export const BOSS_FAMILIES: readonly Family[] = [bossPhases, bossTroopEvent, bossGateAfter];
void eventOn; void mapOf; void BOSS_SWITCH_IDS;
export type { Verdict };
