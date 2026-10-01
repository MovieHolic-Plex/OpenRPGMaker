import type { Project } from '@/project/types';
import type { QuestDef, QuestStepKind } from './questDef';
import type { QuestPresetId } from './questPresetIds';
export { QUEST_PRESET_IDS, type QuestPresetId } from './questPresetIds';

export const QUEST_STEP_LABELS: Record<QuestStepKind, string> = {
  talk: '인물과 대화', collect: '물건 찾기', kill: '전투에서 승리', reach: '목적지 도착',
  inspect: '단서 조사', deliver: '물건 전달', choice: '해결 방법 선택', escort: '인물과 동행', craft: '물건 제작',
};
export const QUEST_CATEGORIES = ['인물과 조사', '수집과 거래', '탐험과 퍼즐', '전투와 구조', '선택과 관계', '세계와 이야기'] as const;
export interface QuestPreset {
  readonly id: QuestPresetId;
  readonly category: typeof QUEST_CATEGORIES[number];
  readonly title: string;
  readonly description: string;
  readonly pattern: readonly QuestStepKind[];
  readonly example: string;
  readonly alternate: string;
  readonly requirement?: string;
  readonly flow: readonly string[];
  readonly objective: string;
}
function preset(id: QuestPresetId, category: QuestPreset['category'], title: string, description: string, pattern: readonly QuestStepKind[], example: string, alternate: string, requirement = ''): QuestPreset {
  return { id, category, title, description, pattern, example, alternate, requirement, objective: pattern.map(kind => QUEST_STEP_LABELS[kind]).join(' → '), flow: ['의뢰 수락', ...pattern.map(kind => QUEST_STEP_LABELS[kind]), '보고하고 보상'] };
}

// Sources and game-to-mechanic mapping: openwiki/quest-preset-research.md.
// These are playable structures, not copied game scripts or promises of identical minigames.
export const QUEST_PRESETS: readonly QuestPreset[] = [
  preset('errand', '인물과 조사', '심부름', '한 사람에게 소식을 전하고 돌아오는 작은 부탁', ['talk'], '촌장이 약초꾼에게 내일 시장이 열린다는 소식을 전해 달라고 한다.', '여관 주인이 항구의 선원에게 고향 소식을 전해 달라고 부탁한다.'),
  preset('lost_item', '수집과 거래', '분실물 찾기', '잃어버린 물건 하나를 찾아 주인에게 돌려주기', ['collect'], '아이가 우물 근처에서 잃어버린 목걸이를 찾고 있다.', '할머니가 꽃가게 주변에서 잃어버린 집 열쇠를 찾아 달라고 한다.', 'collect는 count=1, pickup 수집원 하나. 보고할 때 실제 소지품을 확인하고 반환한다.'),
  preset('hunt', '전투와 구조', '위협 제거', '길을 막는 적을 물리치고 의뢰인에게 보고하기', ['kill'], '상인이 숲길을 막고 있는 몬스터 때문에 배달을 못 하고 있다.', '농부가 밭을 망치는 몬스터를 쫓아내 달라고 한다.'),
  preset('delivery', '수집과 거래', '물품 배달', '받은 꾸러미를 다른 인물에게 직접 전달하기', ['deliver'], '약제사가 환자에게 보낼 약 꾸러미를 맡긴다.', '제빵사가 등대지기에게 따뜻한 빵을 전해 달라고 한다.', 'onAcceptItems에 실제 배달품을 지급. deliver가 수량을 확인하고 소비한다.'),
  preset('gather', '수집과 거래', '재료 모으기', '여러 곳에서 필요한 수량의 재료를 모으기', ['collect'], '약제사가 강가에 자라는 약초 세 개를 부탁한다.', '대장장이가 부러진 다리를 고칠 나무 조각 세 개를 구한다.', 'collect.count는 2 이상, count 이상의 sources가 필요하다. 보고할 때 실제 수량을 확인하고 납품한다.'),
  preset('trade_chain', '수집과 거래', '교환 사슬', '물건을 차례로 교환해 원하는 물건 얻기', ['deliver', 'deliver'], '어부에게 빵을 건네 낚싯줄을 받고, 재봉사에게 낚싯줄을 주어 붉은 리본을 얻는다.', '행상인과 정원사에게 차례로 물건을 교환하여 희귀 씨앗을 구한다.', 'onAcceptItems로 첫 물품을 지급. 각 deliver.gives가 다음 교환 물품을 지급한다. 아이템 ID는 서로 달라야 한다.'),
  preset('crafting', '수집과 거래', '제작 의뢰', '실제 제작법으로 물건을 만들고 납품하기', ['craft', 'deliver'], '대장장이가 재료를 주며 튼튼한 도구를 제작해 농부에게 전해 달라고 한다.', '요리사가 식재료를 맡기며 여행자를 위한 음식을 만들어 달라고 한다.', 'system.craftRecipes의 실제 recipeId 사용. 제작법이 없으면 먼저 등록. onAcceptItems에 필요한 재료를 지급하고 결과 아이템을 deliver한다.'),
  preset('investigate', '인물과 조사', '사건 조사', '제보를 듣고 단서를 조사해 진실 확인하기', ['talk', 'inspect', 'talk'], '여관의 사라진 장부를 두고 목격자의 말을 듣고 책상을 조사해 범인을 확인한다.', '밤마다 울리는 종소리의 원인을 주민의 증언과 종탑의 흔적으로 알아낸다.'),
  preset('witness_chain', '인물과 조사', '증언 맞추기', '여러 증언을 모아 답을 골라 사건 해결하기', ['talk', 'talk', 'choice'], '두 주민의 서로 다른 증언을 듣고 사라진 수레가 간 방향을 고른다.', '경비병과 상인의 말을 비교하여 도난 사건의 용의자를 알아낸다.', 'choice에는 오답(completes:false)과 정답을 넣고, 앞선 대화가 정답의 단서를 제공한다.'),
  preset('treasure_hunt', '탐험과 퍼즐', '보물 추적', '단서를 따라 이동하여 숨겨진 물건 찾기', ['inspect', 'reach', 'collect'], '낡은 지도에 적힌 바위를 찾아가 묻힌 동전을 발견한다.', '선원의 쪽지에 적힌 등대 아래 장소를 찾아 작은 보물 상자를 발견한다.'),
  preset('exploration', '탐험과 퍼즐', '유적 탐사', '목적지에 도착해 유물이나 흔적 조사하기', ['reach', 'inspect'], '학자가 무너진 유적에 남은 문양을 조사해 달라고 한다.', '수로 관리인이 오래된 배수구의 상태를 살펴봐 달라고 한다.'),
  preset('patrol', '탐험과 퍼즐', '순찰과 답사', '여러 지점을 순서대로 방문하기', ['reach', 'reach', 'reach'], '경비대장이 성문, 시장, 항구의 세 순찰 지점을 확인해 달라고 한다.', '지도 제작자가 산길의 세 표식을 순서대로 방문해 달라고 한다.'),
  preset('escort', '전투와 구조', '안전한 동행', '실제로 따라오는 인물을 목적지까지 안내하기', ['escort'], '길을 잃은 여행자가 여관까지 함께 가 달라고 부탁한다.', '약초꾼이 안전한 길을 따라 마을 입구까지 안내해 달라고 한다.'),
  preset('rescue', '전투와 구조', '구출과 귀환', '적을 물리친 뒤 인물을 데리고 돌아오기', ['kill', 'escort'], '숲에 갇힌 주민을 위협하는 적을 물리치고 마을로 안내한다.', '광부를 지키는 적을 처치한 뒤 광부와 함께 출구로 돌아온다.'),
  preset('boss_hunt', '전투와 구조', '현상금 보스', '표적의 은신처를 찾아 강적 쓰러뜨리기', ['reach', 'kill'], '경비대가 숲의 은신처에 있는 우두머리에 현상금을 걸었다.', '사냥꾼이 폐허를 점거한 강적을 찾아달라고 부탁한다.'),
  preset('gauntlet', '전투와 구조', '연속 전투', '단계별 전투를 순서대로 통과하기', ['kill', 'kill', 'kill'], '수련장에서 세 번의 시련을 통과하고 실력을 인정받는다.', '성문의 세 방어선을 돌파해 주민들이 다닐 길을 확보한다.'),
  preset('duel', '전투와 구조', '도전과 결투', '도전을 선택하고 실제 전투에서 승리하기', ['choice'], '검술 교관이 실력을 겨루자며 결투를 제안한다.', '경비병이 통행 자격을 증명하려면 자신을 이겨 보라고 한다.', 'choice의 성공 선택지에 실제 troopId를 지정한다. 승리만 완료하고 도주·패배는 미완료다.'),
  preset('puzzle_choice', '탐험과 퍼즐', '단서와 수수께끼', '단서를 읽고 정답을 골라 잠금 풀기', ['inspect', 'choice'], '석판의 단서를 읽고 문지기에게 올바른 암호를 고른다.', '도서관의 문양을 조사하고 장서함을 여는 정답을 찾는다.', 'choice는 정답과 completes:false 오답을 포함. 오답은 재도전 가능. gates로 해금할 길을 하나 이상 지정한다.'),
  preset('mechanism', '탐험과 퍼즐', '장치 작동', '여러 장치를 순서대로 조사해 길 열기', ['inspect', 'inspect'], '유적의 두 제어판을 순서대로 작동시켜 닫힌 문을 연다.', '물길의 두 밸브를 순서대로 돌려 막힌 통로를 연다.', 'gates를 하나 이상 넣고 마지막 단계 완료 후 통과시킨다. 장치 작동 대사를 lines에 넣는다.'),
  preset('alternate_solution', '선택과 관계', '여러 해결 방법', '협상·지불·전투 중 방법을 골라 해결하기', ['choice'], '길을 막은 인물에게 비용을 지불하거나 결투에서 이겨 통과한다.', '분쟁을 협상으로 풀거나 필요한 물건을 건네 해결한다.', '최소 두 성공 선택지. 한 선택지는 cost, 다른 선택지는 troopId를 지정하여 실제 다른 해결 방법을 제공한다. gates도 하나 이상 지정한다.'),
  preset('moral_choice', '선택과 관계', '선택과 결과', '선택을 기록하고 서로 다른 결과 남기기', ['choice'], '도난당한 약을 원래 주인에게 돌려줄지 아픈 주민에게 건넬지 결정한다.', '두 세력 중 누구를 도울지 선택하여 이후 이야기를 바꾼다.', '두 성공 선택지 각각 effects.switches에 서로 다른 스위치를 true로 기록. 선택 변수와 결과를 이후 이벤트의 조건으로 활용한다.'),
  preset('recruitment', '선택과 관계', '동료 영입', '부탁을 해결하고 실제 배우를 파티에 합류시키기', ['talk', 'kill'], '떠돌이 검사의 사정을 듣고 위협을 해결하면 검사가 동료로 합류한다.', '경비병의 부탁을 해결해 함께 여행할 동료를 얻는다.', 'effects.actors에 실제 배우 ID를 하나 이상 지정. 미등록 배우를 NPC 이름으로 대신하지 않는다.'),
  preset('world_repair', '세계와 이야기', '마을의 변화', '재료를 납품하고 통로나 주민의 상태 바꾸기', ['collect', 'deliver'], '다리 수리에 쓸 재료를 모아 목수에게 건네면 통행이 다시 열린다.', '마을의 우물을 고칠 재료를 모아 관리인에게 납품하고 주민의 대사를 바꾼다.', 'gates를 하나 이상 지정하고 납품 후 개방. worldChanges에 실제 기존 이벤트를 지정하여 보고 후 대사를 바꾼다.'),
  preset('time_echo', '세계와 이야기', '과거와 미래', '다른 시대의 맵을 연결해 행동의 흔적 확인하기', ['inspect', 'reach', 'talk'], '과거의 기록을 바로잡고 미래의 마을로 이동하여 달라진 사람들의 반응을 확인한다.', '옛 시대의 장치를 조사한 뒤 후대의 마을에서 그 이야기를 들려준다.', '최소 두 실제 맵을 사용하고 이동 이벤트도 연결한다. worldChanges에 미래 맵의 기존 NPC를 지정하여 보고 뒤 상태가 지속되게 한다. 시간 여행 자체는 맵 전환으로 저작한다.'),
  preset('appointment', '세계와 이야기', '시간대 약속', '정해진 시간대에 인물을 만나기', ['talk'], '밤에만 정보를 주는 항구의 밀고자를 만나러 간다.', '아침에 출근하는 역장에게 여행 허가를 부탁한다.', 'talk.timePhase는 morning/day/evening/night 중 하나. 시간 시스템을 활성화하고 플레이어가 기다리거나 시간을 바꿀 실제 경로도 제공한다.'),
  preset('repeatable_contract', '수집과 거래', '반복 의뢰', '완료 뒤 다시 수락하여 새로 수행하는 의뢰', ['collect'], '약제사의 게시판에서 약초를 모으는 반복 의뢰를 받는다.', '작업장에 필요한 자재를 반복해서 구해 주고 매번 보고한다.', 'repeatable:true. 실제 수량을 납품한 뒤 회차별 보상 한 번. 수집원과 진행 상태는 새 수락 시 초기화한다.'),
  preset('story_chain', '세계와 이야기', '연속 이야기', '대화·조사·수집·전달·선택을 이어 작은 모험 만들기', ['talk', 'inspect', 'collect', 'deliver', 'choice'], '여관의 부탁으로 목격자를 만나고 흔적을 조사해 물건을 찾아 돌려준 뒤 사건의 결말을 선택한다.', '사라진 등대 열쇠를 찾아 돌려주는 과정에서 항구의 비밀을 알아내고 선택을 남긴다.', '모든 단계는 sequence. 앞선 단계에서 얻은 단서·아이템을 다음 단계가 실제로 사용한다. 독립된 후속 퀘스트는 requiresQuestKeys로 잠근다.'),
  preset('custom', '세계와 이야기', '직접 조합', '아홉 가지 목표를 원하는 순서로 이어 만들기', ['talk', 'inspect', 'deliver'], '마을의 부탁을 듣고 흔적을 조사해 필요한 물건을 전해 준다.', '인물을 만나고 목적지를 탐험한 뒤 선택으로 이야기를 마무리한다.', 'def.blueprint에 요청한 목표 종류 배열을 넣고 실제 steps가 정확히 같은 순서가 되게 한다.'),
];

export function questPreset(id: string): QuestPreset | undefined { return QUEST_PRESETS.find(preset => preset.id === id); }

export function questPresetIssue(project: Project, def: QuestDef): string | null {
  if (!def.presetId) return null;
  const preset = questPreset(def.presetId);
  if (!preset) return '알 수 없는 퀘스트 프리셋입니다.';
  const expected = def.presetId === 'custom' ? def.blueprint : preset.pattern;
  if (!expected?.length || expected.length > 12 || def.steps.length !== expected.length || def.steps.some((step, i) => step.kind !== expected[i])) return `${preset.title}: 목표 구조가 프리셋과 다릅니다 (${(expected ?? []).join(' → ')}).`;
  if (def.steps.length > 1 && def.order !== 'sequence') return '여러 단계 프리셋은 order:"sequence"로 저작하세요.';
  const collect = def.steps.find(step => step.kind === 'collect');
  const choices = def.steps.filter(step => step.kind === 'choice');
  const issue = (message: string) => `${preset.title}: ${message}`;
  if (def.presetId === 'errand') {
    const step = def.steps[0];
    if (step.kind === 'talk' && 'eventId' in def.giver && 'eventId' in step.target && def.giver.mapId === step.target.mapId && def.giver.eventId === step.target.eventId) return issue('소식을 받을 NPC는 의뢰인과 달라야 합니다.');
  }
  if (def.presetId === 'lost_item' && (!collect || collect.kind !== 'collect' || collect.count !== 1 || collect.sources.length !== 1 || collect.sources[0].kind !== 'pickup')) return issue('pickup 하나와 count:1을 사용하세요.');
  if (['delivery','trade_chain'].includes(def.presetId)) {
    const first = def.steps[0];
    if (first.kind !== 'deliver' || !def.onAcceptItems?.some(item => item.itemId === first.itemId && item.count >= first.count)) return issue('수락할 때 첫 배달품의 실제 수량을 지급하세요.');
  }
  if (def.presetId === 'trade_chain') {
    const first = def.steps[0], next = def.steps[1];
    if (first.kind !== 'deliver' || next.kind !== 'deliver' || !first.gives?.some(item => item.itemId === next.itemId && item.count >= next.count)) return issue('첫 교환 물품이 다음 교환의 요구를 충족해야 합니다.');
  }
  if (def.presetId === 'crafting') {
    const craft = def.steps[0], delivery = def.steps[1];
    const recipe = craft.kind === 'craft' ? project.system.craftRecipes?.find(recipe => recipe.id === craft.recipeId) : undefined;
    if (!recipe || delivery.kind !== 'deliver' || recipe.outputItemId !== delivery.itemId || (recipe.outputCount ?? 1) < delivery.count) return issue('제작 결과 물품과 납품할 물품·수량이 일치해야 합니다.');
  }
  if (def.presetId === 'gather' && (!collect || collect.kind !== 'collect' || collect.count < 2)) return issue('둘 이상의 재료를 수집하세요.');
  if (def.presetId === 'trade_chain' && def.steps.some(step => step.kind === 'deliver' && (!step.gives?.length || step.gives.some(item => item.itemId === step.itemId)))) return issue('각 교환은 서로 다른 실제 물품을 지급해야 합니다.');
  if (['witness_chain','puzzle_choice'].includes(def.presetId) && !choices.some(step => step.kind === 'choice' && step.options.some(option => option.completes === false))) return issue('오답은 completes:false로 저작하세요.');
  if (['mechanism','puzzle_choice','alternate_solution','world_repair'].includes(def.presetId) && !def.gates?.length) return issue('해금할 실제 통로를 gates에 지정하세요.');
  if (def.presetId === 'duel' && !choices.some(step => step.kind === 'choice' && step.options.some(option => option.troopId))) return issue('성공 선택지에 실제 결투 부대를 지정하세요.');
  if (def.presetId === 'alternate_solution' && !choices.some(step => step.kind === 'choice' && step.options.some(option => option.cost) && step.options.some(option => option.troopId) && step.options.filter(option => option.completes !== false).length >= 2)) return issue('비용 지불과 전투를 서로 다른 성공 선택지로 제공하세요.');
  if (def.presetId === 'moral_choice' && !choices.some(step => {
    if (step.kind !== 'choice') return false;
    const results = step.options.filter(option => option.completes !== false).map(option => option.effects?.switches?.filter(flag => flag.value).map(flag => flag.id).sort() ?? []);
    return results.length >= 2 && results.every(result => result.length > 0) && new Set(results.map(result => result.join('|'))).size >= 2;
  })) return issue('선택마다 다른 결과 스위치를 기록하세요.');
  if (def.presetId === 'recruitment' && !def.effects?.actors?.length) return issue('합류할 실제 배우를 effects.actors에 지정하세요.');
  if (['world_repair','time_echo'].includes(def.presetId) && !def.worldChanges?.length) return issue('상태가 바뀔 기존 이벤트를 worldChanges에 지정하세요.');
  if (def.presetId === 'time_echo') {
    const maps = new Set(def.steps.flatMap(step => step.kind === 'reach' ? [step.mapId] : step.kind === 'inspect' ? [step.at.mapId] : step.kind === 'talk' ? ['create' in step.target ? step.target.create.mapId : step.target.mapId] : []));
    if (maps.size < 2) return issue('과거와 미래는 서로 다른 실제 맵을 사용하세요.');
  }
  if (def.presetId === 'appointment' && !def.steps[0]?.timePhase) return issue('만날 시간대를 timePhase에 지정하세요.');
  if (def.presetId === 'appointment' && !project.system.timeSystem?.enabled) return issue('플레이 중 시간대가 바뀌도록 시간 시스템을 활성화하세요.');
  if (def.presetId === 'repeatable_contract' && !def.repeatable) return issue('repeatable:true를 지정하세요.');
  return null;
}

export function questPresetPrompt(options: { presetId: QuestPresetId; idea: string; gold: number; mapId: string; mapName: string; blueprint?: readonly QuestStepKind[] }): string {
  const preset = questPreset(options.presetId)!;
  if (!Number.isSafeInteger(options.gold) || options.gold < 0 || options.gold > 999999) throw new Error('보상은 0~999999 사이의 정수로 입력하세요.');
  const pattern = options.blueprint ?? preset.pattern;
  const custom = options.blueprint !== undefined;
  return [
    `「${preset.title}」 프리셋으로 플레이 가능한 퀘스트 하나를 만들어줘.`,
    `현재 맵: ${options.mapName} (mapId=${options.mapId}).`,
    `이야기 소재: ${options.idea.trim() || preset.example}`,
    `완료 보상: ${options.gold}G. 목표 종류와 순서: ${pattern.join(' → ')}.`,
    '현재 프로젝트의 맵·NPC·아이템·부대·제작법·배우를 먼저 조회하고 어울리는 기존 인물과 장소를 활용해줘. 필요한 목표는 접근 가능한 칸에 배치해줘.',
    '제작법이 필요하면 upsert_craft_recipe, 시간대 약속은 configure_time_system, 맵 간 동행 유지 설정은 configure_companion_rules를 활용해줘. 실제 게임 데이터로 먼저 준비한 뒤 create_quest를 호출해줘.',
    '새 NPC나 적의 필드 그림은 list_npc_graphics로 실제 그림을 조회하여 고르고, 정확한 이름이나 textureKey를 사용해줘. 투명 조사 이벤트는 기존 소품 주변에 배치하고 인물의 대사로 찾을 곳을 알려줘.',
    `create_quest의 def.presetId="${custom ? 'custom' : preset.id}", def.order="sequence"를 반드시 지정. ${custom ? `def.blueprint=${JSON.stringify(pattern)}. 실제 steps를 이 구조와 정확히 맞춰줘.` : preset.requirement ?? ''}`,
    'talk/choice/deliver/escort는 target, collect는 itemId/count/sources, kill은 troopId/at, reach는 mapId/x/y, inspect는 at/lines, craft는 recipeId/at. 각 step.label에 플레이어가 이해할 목표 이름을 넣어줘.',
    'deliver는 소지 수량을 확인하고 소비한다. 교환은 gives에 다음 물품을 지정. choice는 options에 text, completes:false(오답), cost(골드·아이템), troopId(전투), effects(결과 플래그·배우)를 지정할 수 있다. escort는 target NPC를 실제 동행시키고 destination에 도착하면 완료. craft는 실제 제작 성공만 완료.',
    '목표 인물은 보고 의뢰인과 다른 이벤트로 지정. 수락 대사는 받은 일과 목적지·단서를 알려주고, 완료 후에는 감사 대사로 바뀌게 def.dialogue를 채워줘. 수락 전·앞 단계 전에는 목표가 진행되지 않고 보상은 보고할 때 한 번만 지급된다.',
    '여러 맵을 쓰면 실제 이동 이벤트를 연결해줘. 맵 간 동행은 system.companions.clearOnTransfer:false가 필요하다. 결과 스위치로 조건 페이지를 만들 때는 등록된 정확한 ID를 사용. 독립 후속 의뢰는 requiresQuestKeys에 앞 퀘스트 key를 지정.',
    '생성한 퀘스트와 이벤트 ID, 의뢰인과 목표 위치, 확인할 플레이 순서를 보고해줘. 자동 완주 증거가 없는 퀘스트를 검증 완료라고 보고하지 마.',
  ].join('\n');
}
