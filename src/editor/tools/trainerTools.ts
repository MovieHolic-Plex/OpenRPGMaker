// editor/tools/trainerTools.ts
// place_trainer — 시야선 트레이너(3세대 포켓몬 문법): 시선 방향 직선에 들어서면 머리 위 「!」 → 트레이너가 걸어와 말을 걸고 전투
// → 이기면 보상·승리 대사, 그 뒤로는 다시 걸어오지 않고 말을 걸어야만 재대결.
// place_field_enemy 는 야생 심볼 도구라 보상·승리 대사·재대결이 없다(2026-10-15 감사: 트레이너를 그 도구로 놓으면 전부 사라졌다).
// 새 런타임 개념이 아니다: page.detectionEncounter(발견 이벤트, 엔진은 완비) + battleProcessing + 승리 스위치 페이지의 조립이다.
import type { Command, Dir, EventPage, EventPageGraphic, GameEvent, GameMap, Project } from '@/project/types';
import { canMove } from '@/project/collision';
import { genId } from '@/util/id';
import { ToolError, type ToolDefinition, type ToolExecResult, type JsonSchema } from './types';
import { inMapBounds, requireMap } from './mapHelpers';
import { resolveGraphic, usedCharsetGraphicKeysOnMap, type GraphicSpec } from './eventCompile';
import { ensureNamedSwitch } from './flagHelpers';
import { assertEventShape, placementAdjustedWarning, resolveEventPlacement, upsertEventIntoMap } from './eventTools';
import { walkableFromAnchors } from './transferReachability';
import { entryCells } from '@/project/eventPassageBlock';
import { GRAPHIC_SPEC_SCHEMA } from './schemaShapes';
import { charsetFrameIndex, decodeCharsetFrameIndex } from '@/assets/easyrpgRtp';
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel } from '@/project/monsterCollection';
import { demoEnemy, demoTroop } from '@/project/defaults/scarloxyDemoGame';
import { expeditionEnemyActions } from '@/project/examples/monsterExpedition/enemyActions';
import { EXPEDITION_HERO_BACK, inferTrainerRoleFromName } from '@/project/examples/monsterExpedition/trainerArt';

const DIRS: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const FACINGS = ['up', 'down', 'left', 'right'] as const;
const EMOTES = ['exclamation', 'anger', 'question', 'none'] as const;
const DEFAULT_SIGHT = 4;
const KEYS = ['mapId', 'x', 'y', 'name', 'troopId', 'team', 'facing', 'sightRange', 'emote', 'approachSpeed', 'before', 'after', 'rematchLine', 'rematch', 'rewardGold', 'rewardItems', 'winSwitchId', 'canEscape', 'graphic', 'trainerSprite', 'id'] as const;

const isDir = (value: unknown): value is Dir => typeof value === 'string' && Object.hasOwn(DIRS, value);

/** 모르는 키를 조용히 버리지 않는다 — 가장 가까운 선언된 키를 말해 준다. */
function rejectUnknownKeys(args: Record<string, unknown>): void {
  for (const key of Object.keys(args)) {
    if ((KEYS as readonly string[]).includes(key)) continue;
    const near = (KEYS as readonly string[]).find((known) => known.toLowerCase().startsWith(key.toLowerCase().slice(0, 4)) || key.toLowerCase().startsWith(known.toLowerCase().slice(0, 4)));
    const hint: Record<string, string> = {
      dialogue: 'before(전투 전 대사) / after(승리 후 대사)', lines: 'before / after', text: 'before', reward: 'rewardGold / rewardItems', rewards: 'rewardGold / rewardItems',
      sight: 'sightRange', range: 'sightRange', direction: 'facing', dir: 'facing', switchId: 'winSwitchId', troop: 'troopId', party: 'team', pokemon: 'team', monsters: 'team',
      level: 'team[].level', speciesId: 'team[].speciesId', behavior: '이 도구는 항상 시야선 트레이너(제자리에서 보다가 걸어옴)입니다. 순찰·추격하는 야생은 place_field_enemy',
    };
    throw new ToolError(`place_trainer 는 '${key}' 칸을 받지 않습니다(조용히 버리면 보상·재대결·시선이 사라지므로 거절합니다).${hint[key] ? ` ${hint[key]} 를 쓰세요.` : near ? ` '${near}' 를 말씀하신 건가요?` : ''} 받는 칸: ${KEYS.join(', ')}`, { code: 'unknown-trainer-field' });
  }
}

/** 시작 칸에서 dir 로 걸어 닿는 곧은 칸 수(최대 limit). 막히면 거기까지. */
function clearRun(project: Project, map: GameMap, from: { x: number; y: number }, dir: Dir, limit: number, blocked: ReadonlySet<string>): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  let at = { ...from };
  for (let i = 0; i < limit; i++) {
    const next = { x: at.x + DIRS[dir][0], y: at.y + DIRS[dir][1] };
    if (!inMapBounds(map, next.x, next.y) || blocked.has(`${next.x},${next.y}`) || !canMove(project, map, at.x, at.y, next.x, next.y)) break;
    cells.push(next);
    at = next;
  }
  return cells;
}

interface TeamMember { speciesId: string; level: number }

function parseTeam(draft: Project, raw: unknown): TeamMember[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6) throw new ToolError('team 은 {speciesId, level} 1~6마리 배열입니다. 예: [{"speciesId":"species_otter_1","level":12}]', { code: 'invalid-args' });
  const species = new Set((draft.database.monsterSpecies ?? []).map((entry) => entry.id));
  return raw.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new ToolError(`team[${i}] 는 {speciesId, level} 객체입니다.`, { code: 'invalid-args' });
    const record = entry as Record<string, unknown>;
    for (const key of Object.keys(record)) if (key !== 'speciesId' && key !== 'level') throw new ToolError(`team[${i}].${key} 는 받지 않는 칸입니다 — speciesId, level 만.`, { code: 'unknown-trainer-field' });
    const speciesId = typeof record.speciesId === 'string' ? record.speciesId : '';
    if (!species.has(speciesId)) throw new ToolError(`team[${i}].speciesId '${speciesId}' 는 정의된 몬스터 종이 아닙니다. 종: ${[...species].slice(0, 8).join(', ') || '(없음 — define_monster_species / define_monster_families 먼저)'}`, { code: 'species-not-found' });
    const level = Number(record.level);
    if (!Number.isInteger(level) || level < 1 || level > 100) throw new ToolError(`team[${i}].level 은 1..100 정수입니다.`, { code: 'invalid-args' });
    return { speciesId, level };
  });
}

/** team → enemy + troop(trainerBattle:true, uncapturable:true) 자동 생성. 같은 id 가 있으면 덮어쓴다(재호출 안전). */
function buildTrainerTroop(draft: Project, eventId: string, name: string, team: readonly TeamMember[], warnings: string[], prizeInEvent: boolean): string {
  const species = new Map((draft.database.monsterSpecies ?? []).map((entry) => [entry.id, entry]));
  const enemyIds = team.map((member, i) => {
    const record = species.get(member.speciesId)!;
    const enemyId = `enemy_${eventId}_${i}`;
    const skills = monsterSkillIdsAtLevel(record, member.level);
    const stats = monsterBattleStatsForSpecies(record, member.level, { hp: 12, atk: 12, def: 12, spd: 12 });
    const enemy = demoEnemy(enemyId, record.name, record.graphic.monsterResourceId ?? '', stats,
      { exp: Math.round(member.level * (member.level < 20 ? 6 : 4)), gold: prizeInEvent ? 0 : member.level * 16 }, skills, { level: member.level, speciesId: member.speciesId });
    enemy.actions = expeditionEnemyActions(skills, draft.database.skills);
    const at = draft.database.enemies.findIndex((entry) => entry.id === enemyId);
    if (at >= 0) draft.database.enemies[at] = enemy; else draft.database.enemies.push(enemy);
    if (!record.graphic.monsterResourceId) warnings.push(`${record.name} 종에 전투 그림(monsterResourceId)이 없어 트레이너의 몬스터가 그림 없이 나옵니다.`);
    return enemyId;
  });
  const troopId = `troop_${eventId}`;
  const troop = { ...demoTroop(troopId, name, '', enemyIds.map((enemyId, i) => ({ enemyId, x: 84 + i * 20, y: 82 })), { uncapturable: true, trainerBattle: true }),
    activeSlots: 1, battleFlow: 'strict' as const, autoAlign: true, previewBackgroundResourceId: undefined };
  const at = draft.database.troops.findIndex((entry) => entry.id === troopId);
  if (at >= 0) draft.database.troops[at] = troop; else draft.database.troops.push(troop);
  return troopId;
}

function rewardCommands(draft: Project, args: Record<string, unknown>): Command[] {
  const out: Command[] = [];
  if (args.rewardGold !== undefined) {
    const gold = Number(args.rewardGold);
    if (!Number.isInteger(gold) || gold < 0 || gold > 9_999_999) throw new ToolError('rewardGold 는 0..9999999 정수입니다.', { code: 'invalid-args' });
    if (gold > 0) out.push({ kind: 'changeGold', op: '+=', amount: gold });
  }
  if (args.rewardItems !== undefined) {
    if (!Array.isArray(args.rewardItems) || args.rewardItems.length > 8) throw new ToolError('rewardItems 는 {itemId, amount} 최대 8개 배열입니다.', { code: 'invalid-args' });
    for (const [i, entry] of args.rewardItems.entries()) {
      const record = (entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}) as Record<string, unknown>;
      for (const key of Object.keys(record)) if (key !== 'itemId' && key !== 'amount') throw new ToolError(`rewardItems[${i}].${key} 는 받지 않는 칸입니다 — itemId, amount 만.`, { code: 'unknown-trainer-field' });
      const itemId = typeof record.itemId === 'string' ? record.itemId : '';
      if (!draft.database.items.some((item) => item.id === itemId)) throw new ToolError(`rewardItems[${i}].itemId '${itemId}' 는 없는 아이템입니다. 아이템: ${draft.database.items.slice(0, 8).map((item) => item.id).join(', ')} (없으면 upsert_item 먼저)`, { code: 'item-not-found' });
      const amount = record.amount === undefined ? 1 : Number(record.amount);
      if (!Number.isInteger(amount) || amount < 1 || amount > 99) throw new ToolError(`rewardItems[${i}].amount 는 1..99 정수입니다.`, { code: 'invalid-args' });
      out.push({ kind: 'changeItem', itemId, op: '+=', amount });
    }
  }
  return out;
}

const text = (body: string, speaker?: string): Command => ({ kind: 'text', body, ...(speaker ? { speaker } : {}) });
const schema = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({ type: 'object', additionalProperties: false, properties, required });

export const TRAINER_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'place_trainer',
    mode: 'write',
    description:
      '시야선 트레이너 한 명을 한 호출로 놓는다(3세대 포켓몬 문법): 주인공이 트레이너의 시선 방향 직선(sightRange 칸, 벽·사람이 가림)에 들어서면 머리 위 「!」 → 트레이너가 걸어와 말을 걸고(before 대사) → 전투 → 이기면 보상(rewardGold·rewardItems)과 승리 대사(after), 승리 스위치가 켜져 **다시 걸어오지 않으며** 말을 걸면 재대결 선택(rematch). 지면 기존 패배 경로(게임 오버·블랙아웃), 진 뒤 센터에서 돌아와 다시 시선에 들면 또 걸어온다. ' +
      '트레이너의 파티는 troopId(upsert_troop 한 무리) 또는 team([{speciesId, level}] 1~6마리 — enemy·troop 을 자동 생성, 트레이너 전투 = 포획 불가·상금 레벨×16) 중 하나로 준다. ' +
      '체육관 졸개·1번 도로 트레이너·라이벌 길목은 모두 이 도구로 놓는다(체육관은 퍼즐 앞뒤 통로에 3~4명, 한 자리에서 다른 트레이너와 5칸 이상 떨어뜨려). facing 을 생략하면 입구·문에 걸리지 않으면서 곧은 통로가 가장 긴 쪽을 자동으로 고른다. ' +
      '쓰지 말 것: 야생 몬스터 심볼(place_field_enemy), 말을 걸어야만 싸우는 보스·관장(place_battle_blocker + upsert_troop_battle_page), 랜덤 인카운터(set_encounter_table). 도착 위치는 출입구·시작점 2칸 안·도달 불가 칸을 거부하고, 시선이 입구에 닿으면(들어서자마자 걸림) 거부한다.',
    parameters: schema({
      mapId: { type: 'string' },
      x: { type: 'integer' },
      y: { type: 'integer' },
      name: { type: 'string', description: '트레이너 이름·직업(대사 화자, 예: 산책하는 소년). 생략=트레이너' },
      troopId: { type: 'string', description: '이미 만든 적 무리 id. team 과 둘 중 하나' },
      team: { type: 'array', description: '트레이너 파티 1~6마리 {speciesId, level} — enemy·troop 을 자동 생성(trainerBattle·포획 불가). troopId 와 둘 중 하나', items: { type: 'object', additionalProperties: false, properties: { speciesId: { type: 'string' }, level: { type: 'integer' } }, required: ['speciesId', 'level'] } },
      facing: { type: 'string', enum: [...FACINGS], description: '바라볼 방향(시선이 뻗는 쪽). 생략하면 자동' },
      sightRange: { type: 'integer', description: '시선 칸 수 2..8(기본 4)' },
      emote: { type: 'string', enum: [...EMOTES], description: '발견 말풍선(기본 exclamation, none=없음)' },
      approachSpeed: { type: 'integer', description: '걸어오는 속도 1..8(기본 4, 주인공 걷기보다 빠르지 않게)' },
      before: { type: 'string', description: '전투 전 대사(생략=「승부다!」)' },
      after: { type: 'string', description: '승리 후 대사(생략=「졌다… 강하구나.」). 보상이 있으면 받았다는 문장이 자동으로 이어진다' },
      rematchLine: { type: 'string', description: '이긴 뒤 다시 말을 걸었을 때 인사(rematch:true 일 때, 생략=기본 문장)' },
      rematch: { type: 'boolean', description: '이긴 뒤 말을 걸면 「다시 겨룰까?」 선택지(기본 true). false 면 인사만' },
      rewardGold: { type: 'integer', description: '승리 상금(골드). team 으로 만들 때는 이 값이 상금 전부(생략하면 몬스터마다 레벨×16). troopId 로 쓸 때는 그 무리의 전투 상금에 더해진다' },
      rewardItems: { type: 'array', description: '승리 보상 아이템 [{itemId, amount}]', items: { type: 'object', additionalProperties: false, properties: { itemId: { type: 'string' }, amount: { type: 'integer' } }, required: ['itemId'] } },
      winSwitchId: { type: 'string', description: '승리 시 켜지는 스위치(생략 시 자동 생성). 문 열림·진행 조건으로 쓸 수 있다' },
      canEscape: { type: 'boolean', description: '도망 허용(기본 false — 트레이너전은 도망 불가)' },
      graphic: { ...GRAPHIC_SPEC_SCHEMA, description: '생략=사람(트레이너) 도트 자동 선택. 새 그림·생성 인물은 만들지 않는다' },
      trainerSprite: { type: 'object', additionalProperties: false, description: '전투 화면의 트레이너 인물 그림(몬스터 대치 전투 소개·볼 던지기). 생략하면 name 의 직업 말(소년·소녀·연구원·낚시꾼·등산가·곤충채집·불량·노인)에서 번들 그림을 자동 배정하고, 말이 없으면 연출 없이 시작', properties: {
        front: { type: 'string', description: '상대 앞모습: 번들 역할 id(boy·girl·fisher·hiker·bug_catcher·gym_rock·gym_water·scientist·punk·elder) 또는 업로드 그림 id' },
        back: { type: 'string', description: '내 뒷모습: 번들 역할 id(hero_m·hero_f) 또는 업로드 그림 id(생략=hero_m)' },
      }, required: ['front'] },
      id: { type: 'string' },
    }, ['mapId', 'x', 'y']),
    invalidArgsHint: '대사는 before(전투 전)·after(승리 후), 보상은 rewardGold·rewardItems[{itemId,amount}], 파티는 troopId 또는 team[{speciesId,level}], 시선은 facing·sightRange. 그 밖의 칸은 받지 않습니다.',
    invalidArgsExample: { mapId: 'map_route_1', x: 10, y: 14, name: '산책하는 소년', team: [{ speciesId: 'species_pipbug_1', level: 5 }], before: '눈이 마주쳤네! 승부다!', after: '졌다… 강하구나.', rewardItems: [{ itemId: 'item_potion', amount: 1 }] },
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      rejectUnknownKeys(args);
      const map = requireMap(draft, args.mapId as string);
      const x = Number(args.x), y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !inMapBounds(map, x, y)) throw new ToolError(`트레이너 위치가 맵 밖입니다: (${String(args.x)}, ${String(args.y)})`, { code: 'trainer-out-of-bounds', mapId: map.id });
      const hasTroop = typeof args.troopId === 'string' && args.troopId.trim() !== '';
      if (hasTroop === (args.team !== undefined)) throw new ToolError('troopId 와 team 중 정확히 하나를 주세요 — troopId=이미 만든 적 무리, team=[{speciesId, level}] 로 파티를 바로 정의(enemy·troop 자동 생성).', { code: 'invalid-args' });
      const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : '트레이너';
      const sightRange = args.sightRange === undefined ? DEFAULT_SIGHT : Number(args.sightRange);
      if (!Number.isInteger(sightRange) || sightRange < 2 || sightRange > 8) throw new ToolError('sightRange 는 2..8 칸입니다.', { code: 'invalid-args' });
      const approachSpeed = args.approachSpeed === undefined ? 4 : Number(args.approachSpeed);
      if (!Number.isInteger(approachSpeed) || approachSpeed < 1 || approachSpeed > 8) throw new ToolError('approachSpeed 는 1..8 입니다.', { code: 'invalid-args' });
      const emote = args.emote === undefined ? 'exclamation' : args.emote;
      if (typeof emote !== 'string' || !(EMOTES as readonly string[]).includes(emote)) throw new ToolError(`emote 는 ${EMOTES.join('|')} 입니다.`, { code: 'invalid-args' });
      if (args.facing !== undefined && !isDir(args.facing)) throw new ToolError(`facing 은 ${FACINGS.join('|')} 입니다.`, { code: 'invalid-args' });
      if (args.rematch !== undefined && typeof args.rematch !== 'boolean') throw new ToolError('rematch 는 true|false 입니다.', { code: 'invalid-args' });

      const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : genId('ev_trainer');
      const placement = resolveEventPlacement(draft, map, x, y, { kind: 'character', ignoreEventId: id, label: `트레이너 '${name}'`, code: 'trainer-impassable' });
      const start = { x: placement.x, y: placement.y };
      const warnings: string[] = [];

      // 출입구·시작점 곁과 도달 불가 칸은 거부 — 들어서자마자 걸리거나 못 만나는 트레이너가 된다.
      const entries = entryCells(draft, map);
      const near = entries.filter((entry) => Math.abs(entry.x - start.x) + Math.abs(entry.y - start.y) <= 2);
      if (near.length) throw new ToolError(`출입구·시작점 2칸 안에는 트레이너를 둘 수 없습니다: (${start.x}, ${start.y}) 곁 ${JSON.stringify(near.slice(0, 3))}. 더 안쪽 칸으로 옮기세요.`, { code: 'trainer-unsafe-spot', mapId: map.id, x: start.x, y: start.y });
      const reach = walkableFromAnchors(draft, map);
      if (reach && !reach.has(start.y * map.width + start.x)) throw new ToolError(`(${start.x}, ${start.y}) 은 시작점·출입구에서 걸어 닿지 못하는 칸입니다 — 플레이어가 만날 수 없는 트레이너입니다. 닿을 수 있는 바닥에 놓으세요.`, { code: 'trainer-unreachable', mapId: map.id, x: start.x, y: start.y });

      // 시선 — 다른 이벤트 칸은 시야를 가린다. 입구에 닿는 시선은 거부(맵에 들어서자마자 전투가 열린다).
      const occupied = new Set(map.events.filter((event) => event.id !== id).map((event) => `${event.x},${event.y}`));
      const touchesEntry = (cells: readonly { x: number; y: number }[]) => cells.some((cell) => entries.some((entry) => Math.max(Math.abs(entry.x - cell.x), Math.abs(entry.y - cell.y)) <= 1));
      let facing: Dir;
      let ray: { x: number; y: number }[];
      if (args.facing !== undefined) {
        facing = args.facing as Dir;
        ray = clearRun(draft, map, start, facing, sightRange, occupied);
        if (touchesEntry(ray)) throw new ToolError(`facing:${facing} 시선이 입구·시작점에 닿아 맵에 들어서자마자 전투가 열립니다. 다른 방향이나 sightRange 를 줄이거나 입구에서 먼 칸에 놓으세요.`, { code: 'trainer-ambush', mapId: map.id, x: start.x, y: start.y });
        if (ray.length < 2) throw new ToolError(`facing:${facing} 쪽으로 곧게 트인 칸이 ${ray.length}칸뿐입니다(최소 2). 벽·사람·지형에 막혔습니다 — 다른 방향 또는 트인 칸에 놓으세요(get_map_region 으로 확인).`, { code: 'trainer-blind', mapId: map.id, x: start.x, y: start.y });
      } else {
        let best: { dir: Dir; run: { x: number; y: number }[] } | undefined;
        for (const dir of ['down', 'left', 'right', 'up'] as const) {
          const run = clearRun(draft, map, start, dir, sightRange, occupied);
          while (run.length && touchesEntry(run)) run.pop();
          if (!best || run.length > best.run.length) best = { dir, run };
        }
        if (!best || best.run.length < 2) throw new ToolError(`(${start.x}, ${start.y}) 에서 곧게 트인 시선 칸이 2칸 미만이거나 입구에 걸립니다 — 넓은 통로 칸에 다시 놓으세요(get_map_region 으로 확인).`, { code: 'trainer-blind', mapId: map.id, x: start.x, y: start.y });
        facing = best.dir; ray = best.run;
        warnings.push(`facing 자동: ${facing} (곧은 시선 ${ray.length}칸)`);
      }
      const range = Math.min(sightRange, ray.length);
      if (range < sightRange) warnings.push(`시선이 ${ray.length}칸에서 막혀 실제 시선은 ${range}칸입니다.`);

      // 파티
      let troopId: string;
      if (hasTroop) {
        troopId = (args.troopId as string).trim();
        const troop = draft.database.troops.find((entry) => entry.id === troopId);
        if (!troop) throw new ToolError(`존재하지 않는 troopId: ${troopId} — ${draft.database.troops.slice(0, 8).map((entry) => entry.id).join(', ') || '(적 그룹 없음 — team 으로 파티를 직접 주거나 upsert_troop 먼저)'}`, { code: 'troop-not-found', mapId: map.id });
        if (troop.trainerBattle !== true) warnings.push(`적 그룹 '${troopId}' 는 trainerBattle:true 가 아니라 이 트레이너의 몬스터를 포획할 수 있습니다 — upsert_troop {id:'${troopId}', trainerBattle:true, uncapturable:true}.`);
      } else {
        troopId = buildTrainerTroop(draft, id, name, parseTeam(draft, args.team), warnings, args.rewardGold !== undefined);
      }

      if (args.trainerSprite !== undefined) {
        const sprite = args.trainerSprite as Record<string, unknown> | null;
        const front = sprite && typeof sprite === 'object' && !Array.isArray(sprite) && typeof sprite.front === 'string' ? sprite.front.trim() : '';
        if (!sprite || !front) throw new ToolError('trainerSprite 는 {front, back?} 객체이고 front 가 필요합니다. 예: {"front":"boy","back":"hero_m"}', { code: 'invalid-args' });
        for (const key of Object.keys(sprite)) if (key !== 'front' && key !== 'back') throw new ToolError(`trainerSprite.${key} 는 받지 않는 칸입니다 — front, back 만.`, { code: 'unknown-trainer-field' });
        const back = typeof sprite.back === 'string' && sprite.back.trim() ? sprite.back.trim() : 'hero_m';
        const troopRecord = draft.database.troops.find((entry) => entry.id === troopId);
        if (troopRecord) troopRecord.trainerSprite = { front, back };
      } else {
        // 전투 그림을 안 줬으면 이름·직업 말(소년·연구원·등산가…)에서 번들 앞모습을 고른다 — 없으면 소개 연출 없이 시작(지어내지 않는다).
        const troopRecord = draft.database.troops.find((entry) => entry.id === troopId);
        const role = troopRecord && !troopRecord.trainerSprite ? inferTrainerRoleFromName(name) : undefined;
        if (troopRecord && role) {
          troopRecord.trainerSprite = { front: role, back: EXPEDITION_HERO_BACK };
          warnings.push(`전투 그림 자동 배정: ${role}(앞모습)·${EXPEDITION_HERO_BACK}(뒷모습) — 이름 「${name}」에서 골랐습니다. 바꾸려면 trainerSprite:{front,back} 를 주세요.`);
        } else if (troopRecord && !troopRecord.trainerSprite) {
          warnings.push(`전투 그림 없음 — 이름 「${name}」로는 번들 트레이너를 고를 수 없어 전투가 소개 연출 없이 시작합니다. trainerSprite:{front:'boy'|'girl'|'fisher'|'hiker'|'bug_catcher'|'gym_rock'|'gym_water'|'scientist'|'punk'|'elder'} 를 주세요.`);
        }
      }

      // 그림 — 사람(트레이너) 도트
      let base: EventPageGraphic | undefined;
      if (args.graphic !== undefined) base = resolveGraphic(args.graphic as GraphicSpec, { overrides: draft.charsetLabels });
      else {
        for (const query of ['조련사', 'trainer', 'villager']) {
          try { base = resolveGraphic({ query }, { overrides: draft.charsetLabels, avoidKeys: usedCharsetGraphicKeysOnMap(map), seed: `${map.id}:${name}:${start.x},${start.y}` }); if (query === 'villager') warnings.push('조련사 도트를 못 찾아 주민 도트를 썼습니다 — graphic 으로 사람 도트를 고르세요(list_npc_graphics).'); break; } catch (error) { if (!(error instanceof ToolError)) throw error; }
        }
        if (!base) throw new ToolError('사람 도트를 찾지 못했습니다 — graphic:{query|textureKey,characterIndex} 로 직접 고르세요(list_npc_graphics).', { code: 'graphic-not-found' });
      }
      const pattern = typeof base.pattern === 'number' ? base.pattern : 0;
      const look = decodeCharsetFrameIndex(pattern);
      const graphic: EventPageGraphic = { ...base, direction: facing, pattern: charsetFrameIndex({ characterIndex: look.characterIndex, direction: facing, pattern: 1 }) };

      const winSwitchId = typeof args.winSwitchId === 'string' && args.winSwitchId.trim() ? args.winSwitchId.trim() : `sw_${id}_won`;
      ensureNamedSwitch(draft, winSwitchId, `트레이너 승리: ${name}`);
      const canEscape = args.canEscape === true;
      const rewards = rewardCommands(draft, args);
      const before = typeof args.before === 'string' && args.before.trim() ? args.before.trim() : '눈이 마주쳤다! 승부다!';
      const after = typeof args.after === 'string' && args.after.trim() ? args.after.trim() : '졌다… 강하구나.';
      const rematch = args.rematch !== false;
      const intro: Command[] = [text(before, name)];
      const fight: Command = {
        kind: 'battleProcessing', troopId, canEscape, canLose: false, branchOnResult: true,
        victoryBranch: [{ kind: 'setSwitch', switchId: winSwitchId, value: true }, text(after, name), ...rewards,
          ...(rewards.length ? [text('보상을 받았다!')] : [])],
        ...(canEscape ? { escapeBranch: [text('다시 준비해서 돌아오자.')] } : {}),
      };
      const rematchFight = (): Command => ({ ...fight, victoryBranch: [text('멋진 재대결이었다!', name)] });
      const common = { movement: { type: 'fixed', speed: 3, frequency: 3 }, priority: 'same', overlapForbidden: true, trigger: { kind: 'action' } } as const;
      const first: EventPage = {
        id: `${id}_sight`, name: '시야선 트레이너', conditions: [], graphic: structuredClone(graphic), ...common, commands: [...intro, fight],
        detectionEncounter: { sight: { range, lineOfSight: true, facing: 'forward' }, emote: emote === 'none' ? null : emote as 'exclamation' | 'anger' | 'question', emoteMs: emote === 'none' ? 0 : 600, approachSpeed },
      };
      const second: EventPage = {
        id: `${id}_rematch`, name: '재대결', conditions: [{ kind: 'switch', switchId: winSwitchId, value: true }], graphic: structuredClone(graphic), ...common,
        commands: rematch
          ? [text(typeof args.rematchLine === 'string' && args.rematchLine.trim() ? args.rematchLine.trim() : '다시 만났구나. 한 번 더 겨뤄 볼래?', name),
            { kind: 'choices', prompt: '재대결할까?', options: [{ text: '다시 겨룬다', branch: [...intro, rematchFight()] }, { text: '다음에', branch: [] }], cancelBehavior: 'branch', cancelBranch: [] }]
          : [text(typeof args.rematchLine === 'string' && args.rematchLine.trim() ? args.rematchLine.trim() : after, name)],
      };
      const event: GameEvent = { id, name, x: start.x, y: start.y, trigger: { kind: 'action' }, commands: [], pages: [first, second], placementRole: 'npc' };
      assertEventShape(event, warnings, event, draft);
      upsertEventIntoMap(map, event);

      if (placement.adjusted) warnings.push(placementAdjustedWarning(`트레이너 '${name}'`, { x, y }, start));
      const trainers = map.events.filter((entry) => entry.pages?.some((page) => page.detectionEncounter)).length;
      if (trainers > 6) warnings.push(`이 맵의 시야선 트레이너가 ${trainers}명입니다 — 한 통로에 몰리면 연전이 됩니다. 보통 3~4명, 서로 5칸 이상.`);
      const close = map.events.filter((entry) => entry.id !== id && entry.pages?.some((page) => page.detectionEncounter) && Math.abs(entry.x - start.x) + Math.abs(entry.y - start.y) < 4);
      if (close.length) warnings.push(`다른 트레이너 ${close.map((entry) => entry.id).join(', ')} 와 4칸 안에 있습니다 — 한꺼번에 시야에 들면 연달아 걸어옵니다.`);

      return {
        summary: `${map.name} (${start.x}, ${start.y}) 에 시야선 트레이너 '${name}' — ${facing} 쪽 ${range}칸, 파티 ${troopId}, 승리 스위치 ${winSwitchId}${rewards.length ? `, 보상 ${rewards.length}건` : ''}${rematch ? ', 재대결 가능' : ''}`,
        data: { eventId: id, troopId, winSwitchId, facing, sightRange: range, x: start.x, y: start.y, adjusted: placement.adjusted },
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  },
];
