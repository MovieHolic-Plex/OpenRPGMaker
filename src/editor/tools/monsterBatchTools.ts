import type { ToolDefinition, ToolExecResult } from './types';
import { ToolError } from './types';
import type { MonsterSpeciesRecord, Project } from '@/project/types';
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel, normalizeMonsterSpeciesRecord } from '@/project/monsterCollection';
import { demoEnemy, demoTroop } from '@/project/defaults/scarloxyDemoGame';
import { expeditionEnemyActions } from '@/project/examples/monsterExpedition/enemyActions';
import { bases, buildMoves, learnset, EXPEDITION_EXP_CURVE } from '@/project/examples/monsterExpedition/roster';
import { replacer } from '@/project/examples/monsterExpedition/campaignNames';
import { isUntouchedDefaultTypeChart, typeChartForPreset } from '@/project/typeCharts';
import { ensureMonsterGraphic, pickUnusedMonsterResource } from './monsterGraphicAssignment';
import { monsterAbilitySchema, validateSpeciesAbility } from './dbTools';

// 도감을 한 번에 채우는 배치 도구 둘. define_monster_species 는 한 종씩이라 100종 도감은 호출 100번 + 진화 순서 맞추기였다
// (2026-10-14 자유도 감사: 154호출). 여기서는 계통 단위로 한 번에 정의하고, 계통마다 따로 검증해 일부가 실패해도 나머지는 남긴다.

const SLUG = /^[a-z][a-z0-9_]{1,30}$/;
const BASE_TYPES = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'steel', 'fairy']);
const CAPTURE_RATES = [0.72, 0.42, 0.2];
const MAX_FAMILIES = 40;

interface StageArg { ability?: unknown; machineSkillIds?: unknown; note?: unknown; monsterResourceId?: unknown; name?: unknown; id?: unknown; types?: unknown; evolveAtLevel?: unknown; baseStats?: unknown; appearanceTags?: unknown; skills?: unknown }
interface FamilyArg { ability?: unknown; machineSkillIds?: unknown; family?: unknown; types?: unknown; stages?: unknown; stats?: unknown }
interface Failure { family: string; reason: string }

const asRecord = (v: unknown): Record<string, unknown> | undefined => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined;
const asStrings = (v: unknown): string[] | undefined => Array.isArray(v) && v.every(x => typeof x === 'string') ? v as string[] : undefined;

/** 기술이 아직 없는 프로젝트(스타터 팩 없이 만든 빈 프로젝트)면 표준 90기술을 한 번만 깐다. */
function ensureTypeMoves(draft: Project): void {
  const have = new Set(draft.database.skills.map(s => s.id));
  const missing = buildMoves(draft).filter(m => !have.has(m.id));
  if (missing.length) draft.database.skills.push(...missing);
}

/** 상성표가 아직 기본(불·물·풀 셋)이면 그대로는 normal·ghost 같은 흔한 타입이 전부 거부된다 — 요청이 쓴 타입에 맞춰 표준 상성표를 먼저 깐다. 이미 손댄 표는 건드리지 않는다(허용 밖 타입은 계통별 오류로 안내). */
function seedTypeChartForFamilies(draft: Project, families: FamilyArg[]): string | undefined {
  if (!isUntouchedDefaultTypeChart(draft.system.typeChart)) return undefined;
  const wanted = new Set<string>();
  for (const f of families) {
    for (const t of asStrings(f.types) ?? []) wanted.add(t);
    for (const st of Array.isArray(f.stages) ? f.stages as StageArg[] : []) for (const t of asStrings(st?.types) ?? []) wanted.add(t);
  }
  if (![...wanted].some(t => !['fire', 'water', 'grass'].includes(t))) return undefined;
  const preset = wanted.has('fairy') ? 'gen6' : 'gen3';
  const chart = typeChartForPreset(preset);
  if (!chart) return undefined;
  draft.system.typeChart = chart;
  return `상성표가 기본(불·물·풀)이라 요청한 타입을 쓸 수 없어 표준 ${preset} 상성표(${chart.types.length}타입)를 먼저 깔았습니다 — 다른 표를 쓰려면 set_type_chart 를 부르세요.`;
}

function defineFamily(draft: Project, raw: FamilyArg, takenIds: Set<string>, takenNames: Set<string>, overwrite: boolean, autoGraphics: boolean, usedArt: Set<string>, warnings: string[]): string[] {
  const family = typeof raw.family === 'string' ? raw.family : '';
  if (!SLUG.test(family)) throw new Error(`family 는 영문 소문자·숫자·밑줄 2~31자(예: otter_line): ${JSON.stringify(raw.family)}`);
  const stages = Array.isArray(raw.stages) ? raw.stages as StageArg[] : [];
  if (stages.length < 1 || stages.length > 3) throw new Error('stages 는 1~3개(기본형→진화형 순서)');
  const chart = new Set(draft.system.typeChart?.types ?? [...BASE_TYPES]);
  const familyTypes = asStrings(raw.types);
  if (!familyTypes?.length || familyTypes.length > 2) throw new Error('types 는 1~2개');
  const stats = Array.isArray(raw.stats) && raw.stats.length === 5 && raw.stats.every(n => typeof n === 'number' && n > 0 && n <= 255) ? raw.stats as number[] : undefined;
  if (raw.stats !== undefined && !stats) throw new Error('stats 는 [체력,공격,방어,특수,속도] 숫자 다섯 개(1~255)');
  const ids: string[] = [], names: string[] = [];
  const records: MonsterSpeciesRecord[] = [];
  let previousLevel = 0;
  for (const [i, st] of stages.entries()) {
    const name = typeof st.name === 'string' ? st.name.trim() : '';
    if (!name || name.length > 40) throw new Error(`${i + 1}단계 name 이 비었거나 40자를 넘습니다`);
    const id = typeof st.id === 'string' && st.id.trim() ? st.id.trim() : `species_${family}_${i + 1}`;
    if (new Set(ids).has(id) || takenIds.has(id)) throw new Error(`종 id 중복: ${id}${overwrite ? '' : ' (이미 있는 종을 고치려면 overwrite:true)'}`);
    if (names.includes(name) || takenNames.has(name)) throw new Error(`종 이름 중복: ${name}`);
    const types = asStrings(st.types) ?? familyTypes;
    if (!types.length || types.length > 2) throw new Error(`${name}: types 는 1~2개`);
    const unknown = types.filter(t => !chart.has(t));
    if (unknown.length) throw new Error(`${name}: 알 수 없는 타입 ${unknown.join(', ')} — 허용: ${[...chart].join(', ')}.${unknown.some(t => ['dark', 'steel', 'fairy'].includes(t)) ? " 악·강철·페어리는 set_type_chart {preset:'gen3'|'gen6'} 를 먼저 부르면 상성표에 들어갑니다." : ' 새 타입은 set_type_chart 로 상성표에 먼저 추가하세요.'}`);
    const evolveAt = typeof st.evolveAtLevel === 'number' ? Math.round(st.evolveAtLevel) : [16, 32][i]!;
    if (i < stages.length - 1 && (evolveAt <= previousLevel || evolveAt > 99)) throw new Error(`${name}: evolveAtLevel 은 앞 단계보다 크고 99 이하여야 합니다(받은 값 ${evolveAt})`);
    if (i < stages.length - 1) previousLevel = evolveAt;
    ids.push(id); names.push(name);
    const factorStage = 3 - stages.length + 1 + i;
    const primary = BASE_TYPES.has(types[0]!) ? types[0]! : 'normal';
    const secondary = BASE_TYPES.has(types[1] ?? types[0]!) ? (types[1] ?? 'normal') : 'normal';
    const custom = asRecord(st.baseStats);
    const baseStats = custom ? { ...bases(stats ?? [85, 85, 85, 85, 85], factorStage), ...Object.fromEntries(Object.entries(custom).filter(([, v]) => typeof v === 'number')) } : bases(stats ?? [85, 85, 85, 85, 85], factorStage);
    const learned = Array.isArray(st.skills) ? (st.skills as { level?: unknown; skillId?: unknown }[]).map(s => ({ level: Number(s.level), skillId: String(s.skillId) })) : learnset(primary, secondary);
    const known = new Set(draft.database.skills.map(s => s.id));
    const missingSkill = learned.find(s => !known.has(s.skillId) || !Number.isFinite(s.level) || s.level < 1);
    if (missingSkill) throw new Error(`${name}: 존재하지 않는 skillId 또는 잘못된 level: ${JSON.stringify(missingSkill)}`);
    // 특성·기술머신 제한: 단계에 적은 값이 계통 값을 덮는다. define_monster_species 와 같은 검증(허용 값을 알려 거절).
    const abilityRaw = st.ability !== undefined ? st.ability : raw.ability;
    const machineRaw = st.machineSkillIds !== undefined ? st.machineSkillIds : raw.machineSkillIds;
    const machineSkillIds = machineRaw === undefined ? undefined : asStrings(machineRaw);
    if (machineRaw !== undefined && !machineSkillIds) throw new Error(`${name}: machineSkillIds 는 기술 id 문자열 배열입니다`);
    const unknownMachine = (machineSkillIds ?? []).filter(skillId => !known.has(skillId));
    if (unknownMachine.length) throw new Error(`${name}: machineSkillIds 에 없는 기술 ${unknownMachine.join(', ')} — 기술(upsert_skill)을 먼저 만드세요`);
    records.push(normalizeMonsterSpeciesRecord({
      id, name, types, ...(abilityRaw !== undefined ? { ability: abilityRaw } : {}), ...(machineSkillIds?.length ? { machineSkillIds } : {}), graphic: { graphicHue: 0, transparent: false, flying: false, ...(typeof st.monsterResourceId === 'string' && st.monsterResourceId ? { monsterResourceId: st.monsterResourceId } : {}) },
      baseStats, expCurve: { ...EXPEDITION_EXP_CURVE }, captureRate: CAPTURE_RATES[Math.min(i + (3 - stages.length), 2)]!,
      skillsByLevel: learned, evolutions: [],
    } as Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, 'id' | 'name'>));
    const abilityWarning = validateSpeciesAbility(draft, abilityRaw, records[records.length - 1]!);
    if (abilityWarning && !warnings.includes(abilityWarning)) warnings.push(abilityWarning);
  }
  for (const [i, record] of records.entries()) {
    if (i < records.length - 1) record.evolutions = [{ toSpeciesId: records[i + 1]!.id, requires: { level: typeof stages[i]!.evolveAtLevel === 'number' ? Math.round(stages[i]!.evolveAtLevel as number) : [16, 32][i]! } }];
    const label = `families[${family}].stages[${i}].graphic`;
    try {
      ensureMonsterGraphic(draft, record, record.graphic, label, warnings, asStrings(stages[i]!.appearanceTags));
    } catch (error) {
      if (!autoGraphics) throw error;
      const pick = pickUnusedMonsterResource(draft, usedArt, stages[i]!.appearanceTags as unknown[] | undefined);
      if (!pick) throw new Error(`${record.name}: 남은 카탈로그 몬스터 외형이 없습니다(전부 다른 종이 쓰는 중) — 이 계통의 monsterResourceId 를 직접 지정하거나 종 수를 줄이세요`);
      record.graphic.monsterResourceId = pick.id;
      warnings.push(`${record.name}: 맞는 외형이 없어 아직 안 쓰는 「${pick.label}」(${pick.id})를 자동 배정했습니다(autoGraphics) — 이름과 어울리는지 확인하세요.`);
    }
    if (record.graphic.monsterResourceId) usedArt.add(record.graphic.monsterResourceId);
  }
  const list = draft.database.monsterSpecies ??= [];
  // 도감 화면은 monsterCampaign.speciesIds 를 순회한다 — 종 레코드만 있고 여기 없으면 100종을 정의해도 도감에는 안 나온다.
  const campaign = draft.system.monsterCampaign;
  if (campaign) records.forEach((record, i) => {
    if (!campaign.speciesIds.includes(record.id)) campaign.speciesIds.push(record.id);
    const note = typeof stages[i]!.note === 'string' && (stages[i]!.note as string).trim() ? (stages[i]!.note as string).trim() : `${record.name}: ${(record.types ?? []).join('·')} 타입 몬스터.`;
    campaign.speciesNotes[record.id] = note;
  });
  // 원정 정의가 없는 수집 게임: 도감은 종 레코드 전부를 훑고, 설명은 종 레코드의 dexNote 에서 읽는다.
  else records.forEach((record, i) => {
    const note = typeof stages[i]!.note === 'string' ? (stages[i]!.note as string).trim() : '';
    if (note) record.dexNote = note.slice(0, 200);
  });
  for (const record of records) {
    const at = list.findIndex(s => s.id === record.id);
    if (at >= 0) list[at] = record; else list.push(record);
  }
  return ids;
}


interface SpawnArg { mapIds?: unknown; minLevel?: unknown; includeEvolved?: unknown }

/** 새로 정의한 종을 야생 조우표에 올려 도감이 실제로 채워지게 한다 — 정의만 하고 어디서도 안 나오면 100종이 6종처럼 보인다. */
function spawnInWild(draft: Project, created: { family: string; ids: string[] }[], spawn: SpawnArg): { placed: number; skipped: string[]; mapIds: string[]; troopIds: string[] } {
  const mapIds = (asStrings(spawn.mapIds) ?? []).filter((id, i, all) => all.indexOf(id) === i);
  if (!mapIds.length) throw new ToolError('spawn.mapIds 가 비었습니다.', { code: 'invalid-args' });
  const missing = mapIds.filter(id => !draft.maps[id]);
  if (missing.length) throw new ToolError(`spawn.mapIds 에 없는 맵: ${missing.join(', ')} — 허용 예시: ${Object.keys(draft.maps).slice(0, 5).join(', ')}`, { code: 'map-not-found' });
  const minLevel = typeof spawn.minLevel === 'number' ? Math.max(2, Math.round(spawn.minLevel)) : 4;
  const species = new Map((draft.database.monsterSpecies ?? []).map(s => [s.id, s]));
  const skipped: string[] = [];
  const troopIds: string[] = [];
  let placed = 0, cursor = 0;
  for (const { ids } of created) {
    let level = minLevel;
    for (const [i, id] of ids.entries()) {
      const record = species.get(id);
      if (!record) continue;
      if (i > 0 && spawn.includeEvolved !== true) continue; // 진화형은 키워서 얻는다 — 기본은 기본형만 야생에 둔다
      const evolveAt = (species.get(ids[i - 1] ?? '')?.evolutions ?? []).find(e => e.toSpeciesId === id)?.requires.level;
      level = Math.max(level, evolveAt ?? 0);
      const map = draft.maps[mapIds[cursor++ % mapIds.length]!]!;
      const enemyId = `enemy_wild_${id}`;
      const skills = monsterSkillIdsAtLevel(record, level);
      if (!draft.database.enemies.some(e => e.id === enemyId)) {
        const enemy = demoEnemy(enemyId, record.name, record.graphic.monsterResourceId ?? '', monsterBattleStatsForSpecies(record, level, { hp: 12, atk: 12, def: 12, spd: 12 }),
          { exp: Math.round(level * 5), gold: 0 }, skills, { level, speciesId: id });
        enemy.actions = expeditionEnemyActions(skills, draft.database.skills);
        draft.database.enemies.push(enemy);
      }
      const troopId = `troop_wild_${id}`;
      if (!draft.database.troops.some(t => t.id === troopId)) {
        draft.database.troops.push({ ...demoTroop(troopId, `야생의 ${record.name}`, '', [{ enemyId, x: 84, y: 82 }], { uncapturable: false, trainerBattle: false }), activeSlots: 1, battleFlow: 'strict', autoAlign: true, previewBackgroundResourceId: undefined });
      }
      map.encounterTable ??= [];
      if (map.encounterTable.some(e => e.troopId === troopId)) { skipped.push(`${record.name}: ${map.name} 에 이미 있음`); continue; }
      // 그 맵 표의 첫 항목 조건(서식지 위치·시작 스위치)을 물려받는다 — 마을 광장에서 튀어나오지 않게.
      const inherited = map.encounterTable.find(e => e.conditions)?.conditions;
      map.encounterTable.push({ troopId, weight: 3, ...(inherited ? { conditions: { ...inherited } } : {}) });
      if (!map.encounterRate) map.encounterRate = 14;
      placed++;
      troopIds.push(troopId);
    }
  }
  return { placed, skipped, mapIds, troopIds };
}

const defineMonsterFamilies: ToolDefinition = {
  name: 'define_monster_families',
  description: '몬스터 종 계통(기본형→진화형 1~3단계)을 한 번에 여러 개 정의한다(최대 40계통). 도감 수십~100종을 채울 때 define_monster_species 를 종마다 부르지 말고 이걸 쓴다. 각 계통은 따로 검증되어 하나가 틀려도 나머지는 저장되며, 실패한 계통과 이유는 data.failed 에 나온다. 능력치는 stats(최종형 기준 [체력,공격,방어,특수,속도])로 단계별 비율 자동 계산, 기술은 타입 기본 학습표, 그림은 monsterResourceId 지정 → 이름·appearanceTags 로 카탈로그 검색 → autoGraphics:true 면 안 쓰는 외형 자동 배정(카탈로그 160종 한도, 모자라면 그 계통만 실패). 진화 레벨 기본 16·32.',
  mode: 'write',
  domains: ['database'],
  parameters: {
    type: 'object', additionalProperties: false, required: ['families'],
    properties: {
      families: { type: 'array', minItems: 1, maxItems: MAX_FAMILIES, description: '정의할 계통들', items: {
        type: 'object', additionalProperties: false, required: ['family', 'types', 'stages'],
        properties: {
          family: { type: 'string', description: '계통 키(영문 소문자·숫자·밑줄, 예: otter_line). id 기본값 species_<family>_<단계>' },
          types: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2, description: '계통 기본 타입 1~2개(grass·fire·water 등 상성표 타입)' },
          stats: { type: 'array', items: { type: 'number' }, minItems: 5, maxItems: 5, description: '최종형 기준 [체력,공격,방어,특수,속도](각 1~255). 생략=85 균등' },
          ability: { ...monsterAbilitySchema, description: '계통 모든 단계의 특성(종마다 하나). 단계의 ability 가 있으면 그것이 우선. 모양은 define_monster_species species.ability 와 같다 — name(직접 지은 이름)과 kind 필수. 모르는 종류·빠진 매개변수는 그 계통만 허용 값과 함께 실패' },
          machineSkillIds: { type: 'array', items: { type: 'string' }, description: '계통 모든 단계가 기술머신·비전머신으로 배울 수 있는 기술 id(비우면 제한 없음). 단계의 값이 있으면 우선' },
          stages: { type: 'array', minItems: 1, maxItems: 3, description: '기본형부터 진화 순서', items: {
            type: 'object', additionalProperties: false, required: ['name'],
            properties: {
              name: { type: 'string', maxLength: 40 },
              id: { type: 'string', description: '생략하면 species_<family>_<단계>' },
              types: { type: 'array', items: { type: 'string' }, description: '이 단계만 타입이 다를 때(진화하며 타입 추가 등)' },
              evolveAtLevel: { type: 'integer', minimum: 2, maximum: 99, description: '다음 단계로 진화하는 레벨(마지막 단계는 무시). 기본 16, 32' },
              baseStats: { type: 'object', additionalProperties: true, description: '이 단계 능력치 일부 덮어쓰기(maxHp·attack·defense·mind·agility)' },
              note: { type: 'string', maxLength: 200, description: '도감 생태 설명 한두 문장(생략하면 이름·타입만 적은 기본 문장)' },
              monsterResourceId: { type: 'string', description: '카탈로그 몬스터 외형 id(list_resources kind:monster). 생략하면 이름·appearanceTags 로 찾는다' },
              appearanceTags: { type: 'array', items: { type: 'string' }, description: '그림 고르기용 겉모습 낱말(예: 새, 물가, 덩굴)' },
              ability: { ...monsterAbilitySchema, description: '이 단계의 특성(계통 ability 를 덮는다)' },
              machineSkillIds: { type: 'array', items: { type: 'string' }, description: '이 단계의 기술머신 제한(계통 값을 덮는다)' },
              skills: { type: 'array', description: '학습표를 직접 정할 때 [{level, skillId}]. 생략=타입 기본 학습표', items: { type: 'object', additionalProperties: false, required: ['level', 'skillId'], properties: { level: { type: 'integer', minimum: 1 }, skillId: { type: 'string' } } } },
            },
          } },
        },
      } },
      autoGraphics: { type: 'boolean', description: '이름·appearanceTags 로 맞는 카탈로그 외형을 못 찾은 종에 아직 안 쓰는 외형을 자동 배정한다(경고로 어떤 외형인지 알려 준다). 도감을 대량으로 채울 때 true. false 면 외형을 못 찾은 계통은 실패로 보고된다.' },
      spawn: { type: 'object', additionalProperties: false, required: ['mapIds'], description: '새 종을 야생 조우표에 올린다(정의만 하면 어디서도 안 나온다). 종을 mapIds 맵들에 돌려가며 배치, 진화형은 진화 레벨 이상에서만. 맵의 기존 서식지 조건을 물려받는다.', properties: {
        mapIds: { type: 'array', items: { type: 'string' }, minItems: 1, description: '조우를 둘 맵 id들(야생 풀숲이 있는 길·서식지)' },
        minLevel: { type: 'integer', minimum: 2, maximum: 99, description: '기본형 야생 레벨(기본 4)' },
        includeEvolved: { type: 'boolean', description: '진화형도 야생에 둘지(진화 레벨 이상으로). 기본 false — 진화형은 키워서 얻는다' },
      } },
      overwrite: { type: 'boolean', description: '이미 있는 종 id 를 덮어쓸지(기본 false: 겹치는 계통은 실패로 보고)' },
    },
  },
  run(draft, args): ToolExecResult {
    const families = Array.isArray(args.families) ? args.families as FamilyArg[] : [];
    if (!families.length) throw new ToolError('families 가 비었습니다.', { code: 'invalid-args' });
    if (families.length > MAX_FAMILIES) throw new ToolError(`한 번에 ${MAX_FAMILIES}계통까지. 나눠서 호출하세요.`, { code: 'invalid-args' });
    const overwrite = args.overwrite === true;
    const autoGraphics = args.autoGraphics === true;
    const seeded = seedTypeChartForFamilies(draft, families);
    ensureTypeMoves(draft);
    const usedArt = new Set<string>([...(draft.database.monsterSpecies ?? []).map(s => s.graphic.monsterResourceId), ...draft.database.enemies.map(e => e.monsterResourceId)].filter((id): id is string => !!id));
    const warnings: string[] = seeded ? [seeded] : [];
    const failed: Failure[] = [];
    const created: { family: string; ids: string[] }[] = [];
    const seenKeys = new Set<string>();
    for (const raw of families) {
      const key = typeof raw.family === 'string' ? raw.family : '(없음)';
      const before = structuredClone(draft.database.monsterSpecies ?? []);
      const beforeAssets = Object.keys(draft.assets.uploaded).length;
      try {
        if (seenKeys.has(key)) throw new Error(`계통 키 중복: ${key}`);
        seenKeys.add(key);
        const existing = draft.database.monsterSpecies ?? [];
        const takenIds = new Set(overwrite ? [] : existing.map(s => s.id));
        const takenNames = new Set(existing.filter(s => !overwrite || !Array.isArray(raw.stages) || !(raw.stages as StageArg[]).some(st => st.id === s.id)).map(s => s.name));
        const ids = defineFamily(draft, raw, takenIds, takenNames, overwrite, autoGraphics, usedArt, warnings);
        created.push({ family: key, ids });
      } catch (error) {
        draft.database.monsterSpecies = before;
        if (Object.keys(draft.assets.uploaded).length !== beforeAssets) warnings.push(`${key}: 실패한 계통이 올린 자산 변동을 확인하세요.`);
        failed.push({ family: key, reason: (error instanceof Error ? error.message : String(error)).replace(/^Error: /, '') });
      }
    }
    if (!created.length) throw new ToolError(`모든 계통이 실패했습니다: ${failed.map(f => `${f.family}(${f.reason})`).join(' / ')}`, { code: 'monster-families-all-failed' });
    let spawned: ReturnType<typeof spawnInWild> | undefined;
    const spawnArg = asRecord(args.spawn);
    if (spawnArg) spawned = spawnInWild(draft, created, spawnArg);
    const total = draft.database.monsterSpecies?.length ?? 0;
    const speciesCount = created.reduce((n, c) => n + c.ids.length, 0);
    // 만든 종 id 를 응답에 그대로 돌려준다 — 모델이 id 를 추측해(species_<family>_<단계>) 이어지는 도구(upsert_enemy·place_trainer·define_monster_species)에서 실패하지 않게.
    const speciesNames = new Map((draft.database.monsterSpecies ?? []).map(s => [s.id, s.name]));
    const speciesIds = created.flatMap(c => c.ids);
    const idPreview = created.slice(0, 6).map(c => `${c.family}=[${c.ids.join(', ')}]`).join(' · ') + (created.length > 6 ? ` … 외 ${created.length - 6}계통(전체 data.created)` : '');
    return {
      summary: `${created.length}계통 ${speciesCount}종 정의${failed.length ? ` — ${failed.length}계통 실패(${failed.map(f => f.family).join(', ')}): data.failed 확인` : ''}. 도감 전체 ${total}종${spawned ? ` · 야생 조우 ${spawned.placed}건 배치(${spawned.mapIds.length}맵)` : ' · 야생 조우는 spawn 인자 또는 author_wild_route 로 따로 배치'}. 만든 종 id: ${idPreview}.`,
      data: { created: created.map(c => ({ ...c, species: c.ids.map(id => ({ id, name: speciesNames.get(id) ?? id })) })), speciesIds, failed, totalSpecies: total, ...(spawned ? { spawned } : {}) },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

interface RenameArg { speciesId?: unknown; name?: unknown }

const renameMonsterSpecies: ToolDefinition = {
  name: 'rename_monster_species',
  description: '몬스터 종 이름을 바꾸고 그 이름이 쓰인 모든 곳을 함께 고친다 — 도감 종 레코드, 적 이름, 전투 무리 이름(「야생의 …」), 맵 이벤트 대사·말하는 이, 선택지, 도감 설명(monsterCampaign.speciesNotes), 엔딩·공통 이벤트. 한글 조사(이/가·은/는·을/를·와/과·로/으로)는 새 이름 받침에 맞춘다. 여러 종을 한 번에(최대 60). 종 id 는 그대로다. 다른 종 이름의 일부인 이름(「새싹」→「새싹토」 안에 있음)은 오염을 막으려 건너뛰고 data.failed 에 이유를 적는다.',
  mode: 'write',
  domains: ['database', 'world', 'system'],
  parameters: {
    type: 'object', additionalProperties: false, required: ['renames'],
    properties: { renames: { type: 'array', minItems: 1, maxItems: 60, items: {
      type: 'object', additionalProperties: false, required: ['speciesId', 'name'],
      properties: { speciesId: { type: 'string', description: '바꿀 종 id(read_collection monsterSpecies 로 조회)' }, name: { type: 'string', maxLength: 40, description: '새 이름' } },
    } } },
  },
  run(draft, args): ToolExecResult {
    const renames = Array.isArray(args.renames) ? args.renames as RenameArg[] : [];
    const species = draft.database.monsterSpecies ?? [];
    const byId = new Map(species.map(s => [s.id, s]));
    const failed: { speciesId: string; reason: string }[] = [];
    const accepted: { id: string; from: string; to: string }[] = [];
    const target = new Map<string, string>(); // id → 새 이름
    for (const r of renames) {
      const id = typeof r.speciesId === 'string' ? r.speciesId : '';
      const to = typeof r.name === 'string' ? r.name.trim() : '';
      const current = byId.get(id);
      if (!current) { failed.push({ speciesId: id || '(없음)', reason: `monsterSpecies 에 없는 id — 허용 예시: ${species.slice(0, 5).map(s => s.id).join(', ')}` }); continue; }
      if (!to || to.length > 40) { failed.push({ speciesId: id, reason: '새 이름이 비었거나 40자를 넘습니다' }); continue; }
      if (to === current.name) { failed.push({ speciesId: id, reason: '이미 그 이름입니다' }); continue; }
      if (target.has(id)) { failed.push({ speciesId: id, reason: '같은 호출에 같은 종이 두 번 나왔습니다' }); continue; }
      target.set(id, to);
    }
    // 최종 이름 중복 점검 — 앞에 나온 요청이 이름을 먼저 차지하고, 바꾸지 않는 종의 이름은 이미 차지돼 있다.
    const claimed = new Map<string, string>();
    for (const s of species) if (!target.has(s.id)) claimed.set(s.name, s.id);
    for (const [id, to] of [...target]) {
      const owner = claimed.get(to);
      if (owner && owner !== id) { failed.push({ speciesId: id, reason: `새 이름 「${to}」이(가) 다른 종(${owner})과 겹칩니다` }); target.delete(id); continue; }
      claimed.set(to, id);
    }
    // 이름이 다른 종 이름의 일부면 본문 치환이 그 종 이름을 깨뜨린다.
    for (const [id] of [...target]) {
      const from = byId.get(id)!.name;
      const inside = species.filter(s => s.id !== id && s.name.includes(from) && !target.has(s.id));
      if (inside.length) { failed.push({ speciesId: id, reason: `「${from}」은(는) 다른 종 이름(${inside.map(s => `${s.name}`).join(', ')})의 일부라 본문 치환이 그 이름을 깨뜨립니다 — 그 종도 같은 호출에서 함께 바꾸세요` }); target.delete(id); }
    }
    for (const [id, to] of target) accepted.push({ id, from: byId.get(id)!.name, to });
    if (!accepted.length) throw new ToolError(`바꿀 수 있는 종이 없습니다: ${failed.map(f => `${f.speciesId}(${f.reason})`).join(' / ')}`, { code: 'monster-rename-none' });
    const pairs = accepted.map(a => [a.from, a.to] as const);
    const bucket = (value: unknown) => { const r = replacer(pairs); r.walk(value); return r.count(); };
    const counts = {
      species: bucket(draft.database.monsterSpecies),
      enemies: bucket(draft.database.enemies),
      troops: bucket(draft.database.troops),
      events: bucket(draft.maps),
      pokedexNotes: bucket(draft.system.monsterCampaign),
      commonEvents: bucket((draft as unknown as Record<string, unknown>).commonEvents),
      endings: bucket(draft.endings),
      otherDatabase: bucket(Object.fromEntries(Object.entries(draft.database).filter(([k]) => !['monsterSpecies', 'enemies', 'troops'].includes(k)))),
      session: bucket(draft.session),
    };
    // 도감 종 이름은 위 치환이 이미 바꿨지만, 조사 없는 단독 문자열이 아니면 놓칠 수 있어 명시로 확정한다.
    for (const a of accepted) byId.get(a.id)!.name = a.to;
    const total = Object.values(counts).reduce((n, v) => n + v, 0);
    return {
      summary: `${accepted.length}종 이름 변경(${accepted.map(a => `${a.from}→${a.to}`).join(', ')}), 연결된 문자열 ${total}곳 갱신${failed.length ? ` — ${failed.length}건 건너뜀(data.failed)` : ''}.`,
      data: { renamed: accepted, failed, replaced: counts },
    };
  },
};

export const MONSTER_BATCH_TOOLS: readonly ToolDefinition[] = [defineMonsterFamilies, renameMonsterSpecies];
