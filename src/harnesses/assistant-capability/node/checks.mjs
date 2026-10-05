// Independent result checks: no tool sequence and no executor's self-verdict.
import { isDeepStrictEqual } from 'node:util';
export const MAP = 'map_ember_village';
export const CHILD = 'ev_ember_child';
export const OLD_LINE = '숲의 약초꾼 세라 누나가 반짝이는 풀을 찾고 있대! 나도 보고 싶다~';
const equal = isDeepStrictEqual;
function changedPaths(a, b, path = '', out = []) {
  if (out.length >= 20 || equal(a, b)) return out;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') { out.push(path); return out; }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    changedPaths(a[key], b[key], path ? `${path}.${key}` : key, out);
    if (out.length >= 20) break;
  }
  return out;
}
export const eventOf = (project, id = CHILD) => project.maps[MAP]?.events.find(e => e.id === id);
export function commandsOf(commands) {
  const out = [];
  for (const c of commands ?? []) {
    out.push(c);
    if (c.kind === 'choices') {
      for (const o of c.options ?? []) out.push(...commandsOf(o.branch));
      out.push(...commandsOf(c.cancelBranch));
    }
    if (c.kind === 'fork') out.push(...commandsOf(c.then), ...commandsOf(c.else));
  }
  return out;
}
const textOf = event => (event?.pages ?? []).flatMap(p => commandsOf(p.commands)).filter(c => c.kind === 'text').map(c => c.body);
const check = (id, ok, detail) => ({ id, ok: Boolean(ok), detail });
export function evaluate(entry, before, after, answer = '') {
  const original = eventOf(before), current = eventOf(after);
  const checks = [];
  const unchanged = () => equal(before, after);
  switch (entry.check) {
    case 'inspect':
      checks.push(check('answer-grounded', ['미루', '마사', '15', '8', '7', '12'].every(v => answer.includes(v)) && answer.includes('반짝이는 풀'), 'NPC 이름·위치·첫 대사·15G를 원문 답에서 확인'));
      checks.push(check('read-only', unchanged(), '조회 후 게임 콘텐츠 전체 불변')); break;
    case 'plan':
      checks.push(check('plan-answer', answer.trim().length >= 30 && /보상|25|한 번|일회/.test(answer), '실제 계획 답변 존재'));
      checks.push(check('plan-no-write', unchanged(), '계획 단계 게임 콘텐츠 전체 불변')); break;
    case 'line':
      checks.push(check('exact-first-line', current?.pages?.[0]?.commands?.[0]?.kind === 'text' && current.pages[0].commands[0].body === '동문에서 만나자.', '동일 이벤트 첫 페이지 첫 문장 정확히 교체'));
      checks.push(check('old-line-removed', !textOf(current).includes(OLD_LINE), '옛 문장 잔존 없음')); break;
    case 'move': checks.push(check('exact-position', current?.x === 9 && current?.y === 7, '기존 ID가 (9,7)에 위치')); break;
    case 'delete': checks.push(check('target-deleted', !current && after.maps[MAP]?.events.length === before.maps[MAP].events.length - 1, '지정 이벤트만 한 개 삭제')); break;
    case 'item': checks.push(check('exact-price', after.database.items.find(i => i.id === 'item_potion')?.price === 30, '동일 회복약 가격 30')); break;
    case 'rename': checks.push(check('same-map-renamed', after.maps[MAP]?.name === '새벽 마을', '동일 맵 ID의 이름 교체')); break;
    case 'inn': {
      const inn = eventOf(after, 'ev_ember_inn');
      checks.push(check('inn-price', inn?.pages?.[0]?.commands?.some(c => c.kind === 'inn' && c.price === 25), '실제 숙박 명령 25G'));
      checks.push(check('inn-message', textOf(inn).some(t => t.includes('25G')) && !textOf(inn).some(t => t.includes('15G')), '안내 25G·옛 요금 제거')); break;
    }
    case 'choice': {
      const choice = commandsOf(current?.pages?.[0]?.commands).find(c => c.kind === 'choices');
      const options = choice?.options ?? [];
      const pageCommands=current?.pages?.[0]?.commands??[],index=pageCommands.indexOf(choice);
      const question=choice?.prompt==='어디로 갈까?'||(index>=0&&pageCommands.slice(0,index).some(c=>c.kind==='text'&&c.body==='어디로 갈까?'));
      checks.push(check('two-choices', question && options.length === 2 && options[0]?.text === '동문' && options[1]?.text === '여관', '요청 질문·선택지 두 개·순서(선행 질문 대사도 허용)'));
      checks.push(check('both-branches', options[0]?.branch?.some(c => c.kind === 'text' && c.body === '동문에서 만나자.') && options[1]?.branch?.some(c => c.kind === 'text' && c.body === '여관에서 쉬자.'), '두 분기에 서로 다른 정확한 대사'));
      checks.push(check('no-reward', !commandsOf(current?.pages?.[0]?.commands).some(c => ['changeGold','changeItem','setSwitch','setVariable','setSelfSwitch','transfer'].includes(c.kind)), '보상·전역 상태 변경·이동 없음(취소 분기 포함)')); break;
    }
    case 'reward': {
      const commands = (current?.pages ?? []).flatMap(p => commandsOf(p.commands));
      checks.push(check('reward-25', commands.some(c => c.kind === 'changeGold' && c.op === '+=' && c.amount === 25), '실제 25G 보상 명령'));
      checks.push(check('first-and-repeat-lines', textOf(current).includes('처음 선물이야.') && textOf(current).includes('이미 선물을 줬어.'), '첫 대화·재대화 문장'));
      checks.push(check('guarded-reward', commands.some(c => c.kind === 'setSelfSwitch' || c.kind === 'setSwitch') && ((current?.pages ?? []).some(p => p.conditions?.some(c => ['selfSwitch','switch'].includes(c.kind))) || commands.some(c => c.kind === 'fork')), '보상 재실행 방지 구조 존재; 실제 반복 지급은 플레이로 별도 검사')); break;
    }
    default: throw Error(`검증기 없는 과제: ${entry.check}`);
  }
  // Compare complete documents after replacing ONLY the fields the task may edit.
  // This catches deletion/recreation, duplicate NPCs, other maps, changed pages,
  // graphics, database records and start/session changes, even when the target passes.
  const projected = structuredClone(after);
  const e = eventOf(projected);
  if (entry.check === 'line' && e?.pages?.[0]?.commands?.[0]) e.pages[0].commands[0] = structuredClone(original.pages[0].commands[0]);
  if (entry.check === 'move' && e) { e.x = original.x; e.y = original.y; }
  if (entry.check === 'delete' && !e) {
    const i = before.maps[MAP].events.findIndex(value => value.id === CHILD);
    projected.maps[MAP].events.splice(i, 0, structuredClone(original));
  }
  if (entry.check === 'item') {
    const i = projected.database.items.find(i => i.id === 'item_potion');
    if (i) i.price = before.database.items.find(i => i.id === 'item_potion').price;
  }
  if (entry.check === 'rename' && projected.maps[MAP]) projected.maps[MAP].name = before.maps[MAP].name;
  if (entry.check === 'inn') {
    const inn = eventOf(projected, 'ev_ember_inn'), old = eventOf(before, 'ev_ember_inn');
    for (let i = 0; i < (inn?.pages?.[0]?.commands?.length ?? 0); i++) {
      const cmd = inn.pages[0].commands[i], prior = old.pages[0].commands[i];
      if (cmd.kind === 'text' && prior?.kind === 'text') cmd.body = prior.body;
      if (cmd.kind === 'inn' && prior?.kind === 'inn') cmd.price = prior.price;
    }
  }
  if (['choice','reward'].includes(entry.check) && e?.pages?.[0]) {
    const originalIds = new Set(original.pages.map(p => p.id));
    // New pages permitted only for the one-time reward, never replacing old pages.
    if (entry.check === 'reward') e.pages = e.pages.filter(p => originalIds.has(p.id));
    const first = e.pages.find(p => p.id === original.pages[0].id);
    if (first) {
      first.commands = structuredClone(original.pages[0].commands);
      if (entry.check === 'reward') first.conditions = structuredClone(original.pages[0].conditions);
    }
    if (entry.check === 'reward') {
      const priorIds = new Set(before.switches.map(s => s.id));
      projected.switches = projected.switches.filter(s => priorIds.has(s.id));
      for (const key of Object.keys(projected.session.switches)) {
        if (!(key in before.session.switches) && projected.session.switches[key] === false) delete projected.session.switches[key];
      }
    }
  }
  const protectedEqual=equal(before, projected);
  checks.push(check('protected-document', protectedEqual, protectedEqual ? '허용 필드 이외의 프로젝트 전체 보존' : `허용 범위 밖 변경: ${changedPaths(before, projected).join(', ')}`));
  return { required: checks.filter(c => c.id !== 'protected-document'), adversarial: checks.filter(c => c.id === 'protected-document') };
}

export function knownGood(entry, before) {
  const after = structuredClone(before), e = eventOf(after), p = e.pages[0];
  const text = body => ({ kind: 'text', body, speaker: '꼬마 미루' });
  switch (entry.check) {
    case 'line': p.commands[0].body = '동문에서 만나자.'; break;
    case 'move': e.x = 9; e.y = 7; break;
    case 'delete': after.maps[MAP].events = after.maps[MAP].events.filter(e => e.id !== CHILD); break;
    case 'item': after.database.items.find(i => i.id === 'item_potion').price = 30; break;
    case 'rename': after.maps[MAP].name = '새벽 마을'; break;
    case 'inn': for (const c of eventOf(after, 'ev_ember_inn').pages[0].commands) { if(c.kind==='inn')c.price=25; if(c.kind==='text')c.body=c.body.replace('15G','25G'); } break;
    case 'choice': p.commands = [{ kind:'choices', prompt:'어디로 갈까?', options:[{text:'동문',branch:[text('동문에서 만나자.')]},{text:'여관',branch:[text('여관에서 쉬자.')]}], cancelBehavior:'branch', cancelBranch:[] }]; break;
    case 'reward': {
      p.commands=[text('처음 선물이야.'),{kind:'changeGold',op:'+=',amount:25},{kind:'setSelfSwitch',key:'A',value:true}];
      const repeat=structuredClone(p); repeat.id='child_reward_done'; repeat.conditions=[{kind:'selfSwitch',key:'A',value:true}];repeat.commands=[text('이미 선물을 줬어.')];
      e.pages.splice(1,0,repeat);break;
    }
  }
  return after;
}
export function resultStatus(result) {
  const gates = Object.values(result.gates ?? {});
  if (gates.some(g => g.status === 'fail')) return 'fail';
  if (gates.some(g => g.status === 'blocked')) return 'blocked';
  if (!gates.length) return 'unexecuted';
  if (['execution','requirements','adversarial','runtime','persistence','visual'].some(key => !result.gates[key])) return 'pending';
  if (gates.some(g => g.status === 'pending')) return 'pending';
  return gates.length > 0 && gates.every(g => ['pass','not-required'].includes(g.status)) ? 'pass' : 'unexecuted';
}
