import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, eventOf, fail, keepsInOrder, mapOf, pass, runOn, sameExcept, withoutEvent } from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';
import { attempt, commandsOfKind, deepCommands, distinct, eventIn, newEventsOn, newRows, withoutFlags, withoutRows } from './group-6b-shared';

const blankNew = (ids: string[]) => (doc: any) => {
  for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !ids.includes(event.id));
  withoutFlags(doc);
};
const textOf = (event: any): Array<{ speaker?: string; body: string }> => commandsOfKind(event, 'text').map(command => ({ speaker: command.speaker, body: String(command.body ?? '') }));

// ── title-bgm ──────────────────────────────────────────────────────────────

const titleBgm: Family = {
  id: 'title-bgm',
  area: 'system',
  mode: 'write',
  title: '타이틀 곡·필드 기본 곡 지정(다른 곡은 그대로)',
  variants: [
    { key: 'title-ledger', prompt: '타이틀 화면에서 「새벽의 의뢰서」가 흐르게 해줘.', args: { title: 'cc0-bgm-rtp-ttl-001' } },
    { key: 'field-town-polite', prompt: '맵마다 따로 정하지 않은 곳에서 기본으로 흐르는 필드 음악을 마을 곡(cc0-bgm-rtp-twn-001)으로 바꿔 주세요. 타이틀 곡은 건드리지 마세요.', args: { field: 'cc0-bgm-rtp-twn-001' } },
    { key: 'title-mystery-terse', prompt: '타이틀 BGM → cc0-bgm-rtp-mys-001.', args: { title: 'cc0-bgm-rtp-mys-001' } },
    { key: 'both', prompt: '타이틀 곡은 cc0-bgm-rtp-ttl-001, 필드 기본 곡은 밤 분위기의 cc0-bgm-rtp-ngt-001 로 둘 다 정해 줘.', args: { title: 'cc0-bgm-rtp-ttl-001', field: 'cc0-bgm-rtp-ngt-001' } },
    { key: 'field-night-explained', prompt: '기본 필드 BGM을 cc0-bgm-rtp-ngt-001 로 바꿔 줘. 전투 곡·타이틀 곡·맵별로 정해 둔 곡은 그대로 두고.', args: { field: 'cc0-bgm-rtp-ngt-001' } },
  ],
  judge(input, args) {
    const before: any = (input.before as any).system, after: any = (input.after as any).system;
    const title = args.title as string | undefined, field = args.field as string | undefined;
    if (title) { if (after.titleScreen?.musicResourceId !== title) return fail('타이틀 곡 ' + (after.titleScreen?.musicResourceId ?? '(없음)') + ' — ' + title + ' 여야 한다'); }
    else if (!isDeepStrictEqual(before.titleScreen?.musicResourceId, after.titleScreen?.musicResourceId)) return fail('요청하지 않은 타이틀 곡이 바뀌었다');
    if (field) { if (after.defaultBgmResourceId !== field) return fail('필드 기본 곡 ' + (after.defaultBgmResourceId ?? '(없음)') + ' — ' + field + ' 여야 한다'); }
    else if (before.defaultBgmResourceId !== after.defaultBgmResourceId) return fail('요청하지 않은 필드 기본 곡이 바뀌었다');
    if (before.battleBgmResourceId !== after.battleBgmResourceId) return fail('전투 곡까지 바뀌었다');
    for (const id of Object.keys((input.before as any).maps)) {
      if (!isDeepStrictEqual((input.before as any).maps[id]?.bgm, (input.after as any).maps[id]?.bgm)) return fail(id + ' 맵 BGM 까지 바뀌었다');
    }
    const blank = (doc: any) => { if (doc.system?.titleScreen) delete doc.system.titleScreen.musicResourceId; delete doc.system.defaultBgmResourceId; };
    return sameExcept(input.before, input.after, blank) ? pass('타이틀=' + (title ?? '유지') + ' 필드=' + (field ?? '유지')) : fail('곡 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    let next = project;
    if (args.title) next = runOn(next, 'set_game_audio', { role: 'title', resourceId: args.title });
    if (args.field) next = runOn(next, 'set_game_audio', { role: 'field-default', resourceId: args.field });
    return next;
  },
  wrongs(project, args): FamilyOutcome[] {
    const title = args.title as string | undefined, field = args.field as string | undefined;
    const reference = titleBgm.reference!(clone(project), args) as Project;
    const set = (role: string, resourceId: string, extra: Record<string, unknown> = {}) => (base: Project) => runOn(base, 'set_game_audio', { role, resourceId, ...extra });
    const track = (title ?? field)!;
    return distinct(reference, [
      // 역할을 바꿔 건 오답: 타이틀 곡을 필드에, 필드 곡을 타이틀에
      attempt(() => runOn(clone(project), 'set_game_audio', { role: title ? 'field-default' : 'title', resourceId: track })),
      // 전투 곡만 바꾼 오답
      attempt(() => runOn(clone(project), 'set_game_audio', { role: 'battle-default', resourceId: track })),
      // 엉뚱한 곡
      attempt(() => {
        let next = clone(project);
        if (title) next = set('title', 'cc0-bgm-rtp-btl-002')(next);
        if (field) next = set('field-default', 'cc0-bgm-rtp-twn-001' === field ? 'cc0-bgm-rtp-mys-001' : 'cc0-bgm-rtp-twn-001')(next);
        return next;
      }),
      // 한 맵에만 건 오답
      attempt(() => runOn(clone(project), 'set_game_audio', { role: 'maps', mapIds: [MAP], resourceId: track })),
      // 둘 다 요청한 변형에서 한쪽만 한 오답
      title && field ? attempt(() => runOn(clone(project), 'set_game_audio', { role: 'title', resourceId: title })) : undefined,
    ]);
  },
};

// ── cutscene-script ────────────────────────────────────────────────────────

type Line = { speaker: string; text: string };

const cutsceneScript: Family = {
  id: 'cutscene-script',
  area: 'story',
  mode: 'write',
  title: '대사 컷신 이벤트(발동 방식·스위치 켜기)',
  variants: [
    { key: 'elder-two-lines', prompt: '(15,5) 칸을 조사하면 촌장이 「오래전 이야기를 해 주마.」 하고 나서 「이 마을엔 전설이 있단다.」 라고 말하는 컷신을 만들어 줘.', args: { x: 15, y: 5, trigger: 'action', lines: [{ speaker: '촌장', text: '오래전 이야기를 해 주마.' }, { speaker: '촌장', text: '이 마을엔 전설이 있단다.' }] } },
    { key: 'two-speakers-polite', prompt: '(16,5) 칸을 조사하면 소녀 「다래」가 「저기 좀 보세요!」, 이어서 경비병 「한울」이 「무슨 일이냐?」 라고 주고받는 컷신을 넣어 주세요.', args: { x: 16, y: 5, trigger: 'action', lines: [{ speaker: '다래', text: '저기 좀 보세요!' }, { speaker: '한울', text: '무슨 일이냐?' }] } },
    { key: 'sets-switch', prompt: '(17,5) 칸에서 촌장이 「성문을 열어라!」 하고 외치는 컷신을 만들고, 컷신이 끝나면 「성문 개방」 스위치가 켜지게 해줘.', args: { x: 17, y: 5, trigger: 'action', lines: [{ speaker: '촌장', text: '성문을 열어라!' }], switchId: 'sw_catalog_gate_open' } },
    { key: 'auto-once-terse', prompt: '(9,13) 맵에 들어오면 한 번만 자동으로 나그네가 「여기가 잿불 마을인가…」 하고 중얼거리는 컷신.', args: { x: 9, y: 13, trigger: 'auto', once: true, lines: [{ speaker: '나그네', text: '여기가 잿불 마을인가…' }] } },
    { key: 'archive-explained', prompt: '(19,3) 칸을 조사하면 학자 「서아」가 「봉인이 풀렸군요.」 라고 말한 뒤 「서고 봉인 해제」 스위치를 켜는 컷신을 만들어 줘. 다른 이벤트는 건드리지 마.', args: { x: 19, y: 3, trigger: 'action', lines: [{ speaker: '서아', text: '봉인이 풀렸군요.' }], switchId: 'sw_catalog_archive_unlock' } },
  ],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const lines = args.lines as Line[];
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== 1) return fail('새 이벤트가 ' + fresh.length + '개다(하나여야 한다)');
    const event = fresh[0];
    if (event.x !== x || event.y !== y) return fail('컷신 위치 (' + event.x + ',' + event.y + ') — (' + x + ',' + y + ') 여야 한다');
    const wantTrigger = strArg(args, 'trigger');
    const kinds = [event.trigger?.kind, ...(event.pages ?? []).map((page: any) => page.trigger?.kind)];
    if (!kinds.includes(wantTrigger)) return fail('발동이 ' + kinds.join(',') + ' — ' + wantTrigger + ' 여야 한다');
    const spoken = textOf(event);
    let at = 0;
    for (const entry of spoken) if (at < lines.length && entry.body.includes(lines[at]!.text) && (entry.speaker ?? '').includes(lines[at]!.speaker)) at++;
    if (at !== lines.length) return fail('대사·화자가 순서대로 나오지 않는다: ' + JSON.stringify(spoken));
    const flips = deepCommands(event).filter(command => command.kind === 'setSwitch');
    if (typeof args.switchId === 'string') {
      if (!flips.some(command => command.switchId === args.switchId && command.value === true)) return fail('스위치 ' + args.switchId + ' 를 켜지 않는다');
      if (flips.some(command => command.switchId !== args.switchId)) return fail('요청하지 않은 스위치를 건드린다');
    } else if (flips.length) return fail('요청하지 않은 스위치를 건드린다: ' + flips.map(command => command.switchId).join(','));
    const gatedOnce = (event.pages ?? []).some((page: any) => (page.conditions ?? []).some((condition: any) => condition.kind === 'selfSwitch'));
    if (args.once === true && !gatedOnce) return fail('한 번만 재생하는 셀프스위치 조건이 없다');
    if (args.once !== true && gatedOnce) return fail('요청하지 않은 한 번만 재생 제한이 있다');
    if (commandsOfKind(event, 'transfer', 'battleProcessing', 'shop').length) return fail('요청하지 않은 이동·전투·상점 명령이 있다');
    return sameExcept(input.before, input.after, blankNew([event.id])) ? pass('컷신 (' + x + ',' + y + ') ' + lines.length + '줄') : fail('컷신 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const lines = args.lines as Line[];
    const beats: any[] = lines.map(line => ({ kind: 'say', speaker: line.speaker, text: line.text }));
    if (typeof args.switchId === 'string') beats.push({ kind: 'switch', switchId: args.switchId, value: true });
    return runOn(project, 'script_cutscene', { mapId: MAP, x: args.x, y: args.y, trigger: args.trigger, beats, ...(args.once === true ? { once: true } : {}) });
  },
  wrongs(project, args): FamilyOutcome[] {
    const lines = args.lines as Line[];
    const reference = cutsceneScript.reference!(clone(project), args) as Project;
    const make = (patch: Record<string, unknown>, mine: Line[] = lines, withSwitch = typeof args.switchId === 'string') => attempt(() => {
      const beats: any[] = mine.map(line => ({ kind: 'say', speaker: line.speaker, text: line.text }));
      if (withSwitch) beats.push({ kind: 'switch', switchId: args.switchId, value: true });
      return runOn(clone(project), 'script_cutscene', { mapId: MAP, x: args.x, y: args.y, trigger: args.trigger, beats, ...(args.once === true ? { once: true } : {}), ...patch });
    });
    const other = typeof args.switchId === 'string' && args.switchId === 'sw_catalog_gate_open' ? 'sw_catalog_lighthouse_lit' : 'sw_catalog_gate_open';
    return distinct(reference, [
      make({ x: numArg(args, 'x') + 3, y: numArg(args, 'y') + 1 }),
      lines.length > 1 ? make({}, lines.slice(0, -1)) : make({}, [{ ...lines[0]!, text: '……' }]),
      make({}, lines.map(line => ({ ...line, speaker: line.speaker + '의 형' }))),
      typeof args.switchId === 'string' ? make({}, lines, false) : make({}, lines, true),
      typeof args.switchId === 'string' ? attempt(() => runOn(clone(project), 'script_cutscene', { mapId: MAP, x: args.x, y: args.y, trigger: args.trigger, beats: [...lines.map(line => ({ kind: 'say', speaker: line.speaker, text: line.text })), { kind: 'switch', switchId: other, value: true }] })) : undefined,
      args.trigger === 'action' ? make({ trigger: 'playerTouch' }) : make({ trigger: 'action', once: undefined }),
    ]);
  },
};

// ── cutscene-switch-gate ───────────────────────────────────────────────────

const cutsceneSwitchGate: Family = {
  id: 'cutscene-switch-gate',
  area: 'story',
  mode: 'write',
  title: '스위치가 켜지면 자동으로 딱 한 번 재생되는 컷신',
  variants: [
    { key: 'gate-open', prompt: '「성문 개방」 스위치가 켜지는 순간 (15,5) 에서 병사가 「성문이 열렸다!」 하고 외치는 컷신이 자동으로 한 번만 나오게 해줘.', args: { x: 15, y: 5, switchId: 'sw_catalog_gate_open', lines: [{ speaker: '병사', text: '성문이 열렸다!' }] } },
    { key: 'lighthouse-polite', prompt: '등대 점화 스위치가 켜지면 (16,5) 에서 등대지기가 「드디어 불이 들어왔군.」 이라고 혼잣말하는 장면이 저절로, 한 번만 재생되도록 만들어 주세요.', args: { x: 16, y: 5, switchId: 'sw_catalog_lighthouse_lit', lines: [{ speaker: '등대지기', text: '드디어 불이 들어왔군.' }] } },
    { key: 'archive-terse', prompt: '서고 봉인 해제되면 (17,5) 학자 컷신 자동 1회: 「문이 열렸다.」', args: { x: 17, y: 5, switchId: 'sw_catalog_archive_unlock', lines: [{ speaker: '학자', text: '문이 열렸다.' }] } },
    { key: 'two-lines', prompt: '분수 작동 스위치가 켜지면 (9,13) 에서 소녀가 「와, 물이 나와!」 그리고 「시원해!」 라고 연달아 말하는 컷신을 자동으로 한 번만 틀어 줘.', args: { x: 9, y: 13, switchId: 'sw_catalog_fountain_flow', lines: [{ speaker: '소녀', text: '와, 물이 나와!' }, { speaker: '소녀', text: '시원해!' }] } },
    { key: 'beacon-explained', prompt: '봉화 점화 스위치가 켜지면 (19,3) 에서 파수꾼이 「봉화가 올랐다!」 라고 외치는 컷신이 자동으로 나오게 해 줘. 스위치가 꺼져 있을 땐 나오면 안 되고, 한 번 본 뒤엔 다시 안 나와야 해. 다른 이벤트는 건드리지 마.', args: { x: 19, y: 3, switchId: 'sw_catalog_beacon_lit', lines: [{ speaker: '파수꾼', text: '봉화가 올랐다!' }] } },
  ],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y'), switchId = strArg(args, 'switchId');
    const lines = args.lines as Line[];
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== 1) return fail('새 이벤트가 ' + fresh.length + '개다(하나여야 한다)');
    const event = fresh[0];
    if (event.x !== x || event.y !== y) return fail('위치 (' + event.x + ',' + event.y + ') — (' + x + ',' + y + ') 여야 한다');
    const pages: any[] = event.pages ?? [];
    const playing = pages.filter(page => (page.commands ?? []).some((command: any) => command.kind === 'text'));
    if (!playing.length) return fail('대사가 있는 페이지가 없다');
    for (const page of playing) {
      if (page.trigger?.kind !== 'auto') return fail('재생 페이지가 자동 시작(auto)이 아니다: ' + page.trigger?.kind);
      const conditions: any[] = page.conditions ?? [];
      if (!conditions.some(condition => condition.kind === 'switch' && condition.switchId === switchId && condition.value !== false)) return fail('재생 페이지에 스위치 ' + switchId + ' 켜짐 조건이 없다');
      if (!conditions.some(condition => condition.kind === 'selfSwitch' && condition.value === false)) return fail('한 번만 재생하는 셀프스위치(꺼짐) 조건이 없다');
      if (!(page.commands ?? []).some((command: any) => command.kind === 'setSelfSwitch' && command.value === true)) return fail('재생 중 셀프스위치를 켜 다음엔 안 나오게 하는 명령이 없다');
    }
    const spoken = textOf(event);
    let at = 0;
    for (const entry of spoken) if (at < lines.length && entry.body.includes(lines[at]!.text) && (entry.speaker ?? '').includes(lines[at]!.speaker)) at++;
    if (at !== lines.length) return fail('대사·화자가 순서대로 나오지 않는다: ' + JSON.stringify(spoken));
    if (commandsOfKind(event, 'setSwitch').some(command => command.switchId === switchId)) return fail('컷신이 자기 조건 스위치를 만지고 있다');
    return sameExcept(input.before, input.after, blankNew([event.id])) ? pass(switchId + ' 켜지면 (' + x + ',' + y + ') 컷신 1회') : fail('컷신 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const lines = args.lines as Line[];
    return runOn(project, 'script_cutscene', { mapId: MAP, x: args.x, y: args.y, trigger: 'auto', once: true, requiresSwitches: [args.switchId], beats: lines.map(line => ({ kind: 'say', speaker: line.speaker, text: line.text })) });
  },
  wrongs(project, args): FamilyOutcome[] {
    const lines = args.lines as Line[];
    const reference = cutsceneSwitchGate.reference!(clone(project), args) as Project;
    const switchId = strArg(args, 'switchId');
    const other = switchId === 'sw_catalog_gate_open' ? 'sw_catalog_lighthouse_lit' : 'sw_catalog_gate_open';
    const make = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'script_cutscene', { mapId: MAP, x: args.x, y: args.y, trigger: 'auto', once: true, requiresSwitches: [switchId], beats: lines.map(line => ({ kind: 'say', speaker: line.speaker, text: line.text })), ...patch }));
    return distinct(reference, [
      make({ requiresSwitches: undefined }),
      make({ once: undefined }),
      make({ requiresSwitches: [other] }),
      make({ trigger: 'action' }),
      make({ x: numArg(args, 'x') + 3, y: numArg(args, 'y') + 1 }),
      lines.length > 1 ? make({ beats: lines.slice(0, 1).map(line => ({ kind: 'say', speaker: line.speaker, text: line.text })) }) : make({ beats: [{ kind: 'say', speaker: lines[0]!.speaker, text: '……' }] }),
    ]);
  },
};

// ── timed-escape ───────────────────────────────────────────────────────────

type Rect = { x: number; y: number; width: number; height: number };
type EscapeArgs = { seconds: number; start: Rect; exit: Rect; checkpoint: { x: number; y: number }; area: Rect; from: string; bands: number };
const inRect = (rect: Rect, x: number, y: number) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;

const timedEscape: Family = {
  id: 'timed-escape',
  area: 'story',
  mode: 'write',
  title: '제한 시간 탈출(시작 칸·출구·체크포인트·무너지는 바닥)',
  variants: [
    { key: 'ice-west-60', prompt: '(2,10) 칸을 밟으면 60초 카운트다운이 시작되고, (3,10)~(18,11) 바닥이 서쪽부터 네 번에 나뉘어 무너지는 탈출 구간을 만들어줘. 출구는 (20,10), 시간이 다 되면 (1,10) 으로 되돌아가야 해.', args: { seconds: 60, start: { x: 2, y: 10, width: 1, height: 1 }, exit: { x: 20, y: 10, width: 1, height: 1 }, checkpoint: { x: 1, y: 10 }, area: { x: 3, y: 10, width: 16, height: 2 }, from: 'west', bands: 4 } },
    { key: 'tower-east-45-polite', prompt: '무너지는 다리를 하나 만들어 주세요. (20,11) 을 밟으면 45초 타이머가 돌고, (4,10)~(18,11) 바닥이 동쪽부터 세 번에 걸쳐 무너집니다. 반대편 출구는 (2,11) 이고, 실패하면 (21,11) 로 돌아가요.', args: { seconds: 45, start: { x: 20, y: 11, width: 1, height: 1 }, exit: { x: 2, y: 11, width: 1, height: 1 }, checkpoint: { x: 21, y: 11 }, area: { x: 4, y: 10, width: 15, height: 2 }, from: 'east', bands: 3 } },
    { key: 'ice-90-terse', prompt: '탈출 구간: 시작 (2,11), 출구 (20,11), 90초, 복귀 (1,11), 바닥 (3,10)~(18,11) 서쪽부터 두 번에 나눠 붕괴.', args: { seconds: 90, start: { x: 2, y: 11, width: 1, height: 1 }, exit: { x: 20, y: 11, width: 1, height: 1 }, checkpoint: { x: 1, y: 11 }, area: { x: 3, y: 10, width: 16, height: 2 }, from: 'west', bands: 2 } },
    { key: 'short-30', prompt: '(3,10) 을 밟으면 30초 안에 (17,10) 까지 가야 하는 짧은 탈출을 만들어 줘. 바닥은 (4,10)~(16,11) 이 서쪽부터 다섯 번에 걸쳐 무너지고, 실패하면 (2,10) 으로 돌아가게.', args: { seconds: 30, start: { x: 3, y: 10, width: 1, height: 1 }, exit: { x: 17, y: 10, width: 1, height: 1 }, checkpoint: { x: 2, y: 10 }, area: { x: 4, y: 10, width: 13, height: 2 }, from: 'west', bands: 5 } },
    { key: 'long-120-explained', prompt: '(19,10) 에서 시작하면 120초 동안 달려 (3,10) 출구에 닿아야 하는 탈출을 만들어 줘. (4,10)~(18,11) 바닥이 동쪽부터 여섯 번에 걸쳐 무너지고, 시간이 다 되면 (20,10) 으로 돌려보내 줘. 다른 이벤트는 건드리지 말고.', args: { seconds: 120, start: { x: 19, y: 10, width: 1, height: 1 }, exit: { x: 3, y: 10, width: 1, height: 1 }, checkpoint: { x: 20, y: 10 }, area: { x: 4, y: 10, width: 15, height: 2 }, from: 'east', bands: 6 } },
  ],
  judge(input, args) {
    const spec = args as unknown as EscapeArgs;
    const fresh = newEventsOn(input.before, input.after);
    if (!fresh.length) return fail('새 이벤트가 없다');
    const all = (event: any) => deepCommands(event);
    const starters = fresh.filter(event => all(event).some(command => command.kind === 'timer' && command.action === 'start'));
    if (!starters.length) return fail('타이머를 시작하는 이벤트가 없다');
    const bad = starters.find(event => !all(event).some(command => command.kind === 'timer' && command.action === 'start' && command.seconds === spec.seconds));
    if (bad) return fail('타이머 시간이 ' + spec.seconds + '초가 아니다: ' + JSON.stringify(all(bad).filter(command => command.kind === 'timer')));
    if (!starters.some(event => inRect(spec.start, event.x, event.y))) return fail('시작 칸 (' + spec.start.x + ',' + spec.start.y + ') 에 타이머 시작 이벤트가 없다');
    const stoppers = fresh.filter(event => all(event).some(command => command.kind === 'timer' && command.action === 'set' && command.seconds === 0));
    if (!stoppers.some(event => inRect(spec.exit, event.x, event.y))) return fail('출구 칸 (' + spec.exit.x + ',' + spec.exit.y + ') 에 타이머를 멈추는 이벤트가 없다');
    const returns = fresh.flatMap(event => all(event)).filter(command => command.kind === 'transfer');
    if (!returns.length) return fail('실패했을 때 되돌리는 이동 명령이 없다');
    if (!returns.every(command => command.mapId === MAP && command.x === spec.checkpoint.x && command.y === spec.checkpoint.y)) return fail('되돌아가는 곳이 (' + spec.checkpoint.x + ',' + spec.checkpoint.y + ') 가 아니다: ' + JSON.stringify(returns.map(command => [command.x, command.y])));
    const cells = fresh.flatMap(event => all(event)).filter(command => command.kind === 'changeTile').map(command => ({ x: Number(command.x), y: Number(command.y) }));
    if (!cells.length) return fail('무너지는 바닥(changeTile)이 없다');
    const out = cells.find(cell => !inRect(spec.area, cell.x, cell.y));
    if (out) return fail('무너지는 칸 (' + out.x + ',' + out.y + ') 이 지정한 구간 밖이다');
    const axis = spec.from === 'west' || spec.from === 'east' ? 'x' : 'y';
    const quarter = Math.max(1, Math.floor(cells.length / 4));
    const mean = (list: Array<{ x: number; y: number }>) => list.reduce((sum, cell) => sum + cell[axis], 0) / list.length;
    const early = mean(cells.slice(0, quarter)), late = mean(cells.slice(-quarter));
    const forward = spec.from === 'west' || spec.from === 'north';
    if (forward ? !(early < late) : !(early > late)) return fail('무너지는 순서가 ' + spec.from + ' 쪽부터가 아니다(앞 ' + early.toFixed(1) + ' / 뒤 ' + late.toFixed(1) + ')');
    const timers = new Set(all(starters[0]).filter(command => command.kind === 'timer').map(command => command.timerId));
    void timers;
    return sameExcept(input.before, input.after, blankNew(fresh.map(event => event.id))) ? pass('제한 시간 탈출 ' + spec.seconds + '초 · 무너지는 칸 ' + cells.length) : fail('탈출 장치 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const spec = args as unknown as EscapeArgs;
    return runOn(project, 'make_timed_escape', { mapId: MAP, escapeId: 'ref', seconds: spec.seconds, start: spec.start, exit: spec.exit, checkpoint: spec.checkpoint, area: spec.area, from: spec.from, bands: spec.bands });
  },
  wrongs(project, args): FamilyOutcome[] {
    const spec = args as unknown as EscapeArgs;
    const reference = timedEscape.reference!(clone(project), args) as Project;
    const make = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'make_timed_escape', { mapId: MAP, escapeId: 'ref', seconds: spec.seconds, start: spec.start, exit: spec.exit, checkpoint: spec.checkpoint, area: spec.area, from: spec.from, bands: spec.bands, ...patch }));
    const opposite = spec.from === 'west' ? 'east' : 'west';
    return distinct(reference, [
      make({ seconds: spec.seconds === 60 ? 90 : 60 }),
      make({ from: opposite }),
      make({ exit: { ...spec.exit, x: spec.exit.x + (spec.exit.x > 10 ? -2 : 2) } }),
      make({ checkpoint: { x: spec.checkpoint.x, y: spec.checkpoint.y === 10 ? 11 : 10 } }),
      make({ start: { ...spec.start, x: spec.start.x + (spec.start.x > 10 ? -2 : 2) } }),
      make({ area: { x: spec.area.x, y: 13, width: spec.area.width, height: 2 } }),
    ]);
  },
};

// ── common-event-cutscene ──────────────────────────────────────────────────

type CommonSpec = { name: string; lines: string[]; eventId: string };

const commonEventCutscene: Family = {
  id: 'common-event-cutscene',
  area: 'story',
  mode: 'write',
  title: '공용 이벤트(호출용 장면)를 만들고 NPC 이벤트에서 부른다',
  variants: [
    { key: 'village-news', prompt: '「마을 소식」이라는 공용 이벤트를 만들어서 「오늘은 장이 서는 날이다.」라고 나오게 하고, 마을 주민에게 말을 걸 때 그 공용 이벤트를 부르게 해줘. 주민의 기존 대사는 그대로.', args: { name: '마을 소식', lines: ['오늘은 장이 서는 날이다.'], eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'festival-polite', prompt: '공용 이벤트 「축제 안내」를 하나 만들어 주세요. 「내일 밤에 축제가 열립니다.」, 「모두 광장으로 모여 주세요.」 두 줄이 나오고, 여관 주인 이벤트가 마지막에 그걸 부르게 해 주세요.', args: { name: '축제 안내', lines: ['내일 밤에 축제가 열립니다.', '모두 광장으로 모여 주세요.'], eventId: 'ev_ember_inn' }, setup: { event: 'ev_ember_inn' } },
    { key: 'scene-terse', prompt: '공용 이벤트 「경고」 만들고 「조심해!」 한 줄, 장면 연출 이벤트에서 호출.', args: { name: '경고', lines: ['조심해!'], eventId: 'ev_test_cutscene' }, setup: { event: 'ev_test_cutscene' } },
    { key: 'child-greeting', prompt: '「인사말」이라는 공용 이벤트로 「안녕, 모험가!」를 말하게 하고, 아이(미루) 이벤트에서 그걸 호출하도록 연결해 줘.', args: { name: '인사말', lines: ['안녕, 모험가!'], eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '「통행 규칙」 공용 이벤트에 「밤에는 성문이 닫힌다.」 「통행증이 있어야 한다.」 두 줄을 넣어 만들고, 파수꾼(경비)에게 말을 걸면 그 공용 이벤트를 부르게 해 줘. 공용 이벤트 본문만 따로 만들고 파수꾼의 기존 명령은 건드리지 마.', args: { name: '통행 규칙', lines: ['밤에는 성문이 닫힌다.', '통행증이 있어야 한다.'], eventId: 'ev_ember_guard' }, setup: { event: 'ev_ember_guard' } },
  ],
  judge(input, args) {
    const spec = args as unknown as CommonSpec;
    const added = (((input.after as any).commonEvents ?? []) as any[]).filter(entry => !((input.before as any).commonEvents ?? []).some((old: any) => old.id === entry.id));
    if (added.length !== 1) return fail('새 공용 이벤트가 ' + added.length + '개다(하나여야 한다)');
    const common = added[0];
    if (!String(common.name ?? '').includes(spec.name)) return fail('공용 이벤트 이름 「' + common.name + '」 — 「' + spec.name + '」 여야 한다');
    const spoken = (common.commands ?? []).filter((command: any) => command.kind === 'text').map((command: any) => String(command.body ?? ''));
    let at = 0;
    for (const body of spoken) if (at < spec.lines.length && body.includes(spec.lines[at]!)) at++;
    if (at !== spec.lines.length) return fail('공용 이벤트 대사가 ' + JSON.stringify(spoken) + ' — ' + JSON.stringify(spec.lines) + ' 여야 한다');
    if (common.trigger !== 'none') return fail('호출용 공용 이벤트인데 trigger 가 ' + common.trigger + ' (자동 실행) 이다');
    const before = eventIn(input.before, spec.eventId), after = eventIn(input.after, spec.eventId);
    if (!before || !after) return fail(spec.eventId + ' 이벤트가 사라졌다');
    const calls = deepCommands(after).filter(command => command.kind === 'callCommonEvent');
    const oldCalls = deepCommands(before).filter(command => command.kind === 'callCommonEvent');
    if (calls.length !== oldCalls.length + 1 || !calls.some(command => command.commonEventId === common.id)) return fail(spec.eventId + ' 가 새 공용 이벤트(' + common.id + ')를 부르지 않는다');
    const flat = (event: any) => (event.pages ?? []).flatMap((page: any) => page.commands ?? []);
    if (!keepsInOrder(flat(before), flat(after))) return fail(spec.eventId + ' 의 기존 명령이 사라졌거나 순서가 바뀌었다');
    const blank = (doc: any) => { withoutEvent(spec.eventId)(doc); doc.commonEvents = (doc.commonEvents ?? []).filter((entry: any) => entry.id !== common.id); };
    return sameExcept(input.before, input.after, blank) ? pass('공용 이벤트 ' + common.id + ' 를 ' + spec.eventId + ' 가 호출') : fail('공용 이벤트·호출 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const spec = args as unknown as CommonSpec;
    const created = runOn(project, 'upsert_common_event', { id: 'ce_ref', name: spec.name, trigger: 'none', commands: spec.lines.map(body => ({ kind: 'text', body })) });
    const event = eventOf(created, spec.eventId);
    return runOn(created, 'patch_event_page', { mapId: MAP, eventId: spec.eventId, pageIndex: 0, set: { commands: [...event.pages[0].commands, { kind: 'callCommonEvent', commonEventId: 'ce_ref' }] } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const spec = args as unknown as CommonSpec;
    const reference = commonEventCutscene.reference!(clone(project), args) as Project;
    const common = (patch: Record<string, unknown> = {}) => runOn(clone(project), 'upsert_common_event', { id: 'ce_ref', name: spec.name, trigger: 'none', commands: spec.lines.map(body => ({ kind: 'text', body })), ...patch });
    const call = (base: Project, eventId: string, replace = false) => {
      const event = eventOf(base, eventId);
      return runOn(base, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...(replace ? [] : event.pages[0].commands), { kind: 'callCommonEvent', commonEventId: 'ce_ref' }] } });
    };
    const other = spec.eventId === 'ev_utility_npc' ? 'ev_test_cutscene' : 'ev_utility_npc';
    return distinct(reference, [
      // 부르는 쪽이 빠진 부분 수행
      attempt(() => common()),
      // 엉뚱한 NPC 가 부른다
      attempt(() => call(common(), other)),
      // 기존 명령을 지우고 호출만 남긴다
      attempt(() => call(common(), spec.eventId, true)),
      // 공용 이벤트가 요청과 다른 대사
      attempt(() => call(common({ commands: [{ kind: 'text', body: '……' }] }), spec.eventId)),
      // 호출용이 아니라 자동 실행 공용 이벤트
      attempt(() => call(common({ trigger: 'auto' }), spec.eventId)),
      // 이름 틀림
      attempt(() => call(common({ name: spec.name + ' 임시' }), spec.eventId)),
    ].map(outcome => outcome) as Array<Project | undefined>);
  },
};

void newRows; void withoutRows; void mapOf;

export const GROUP_6B_STORY: readonly Family[] = [titleBgm, cutsceneScript, cutsceneSwitchGate, timedEscape, commonEventCutscene];
