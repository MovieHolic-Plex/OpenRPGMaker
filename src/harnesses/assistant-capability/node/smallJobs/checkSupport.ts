// 작은 일 판정의 공용 부품: 저장 문서 읽기, 말 걸기 한 번 따라가 보기(interact), 자리 판정.
// 판정 종류는 checks.ts(첫 묶음) · checksData.ts(자료·설정) · checksPlay.ts(말 걸기·장면)가 이 파일의 부품으로 짠다.
import { resolveEventPage } from '../../../../project/io';
import { changeFriendship, evalCondition } from '../../../../project/session';
import type { Project } from '../../../../project/types';
import { blockedOn } from '../matrixNativeSpec';

export type CheckSpec = { kind: string } & Record<string, any>;
export type Allow = { newMaps?: number; movedEvents?: string[]; renamedMaps?: string[]; title?: boolean; removedEvents?: string[]; /** 시작 위치를 옮기는 일. */ startPos?: boolean };
export type Verdict = { pass: boolean; reason: string; outcome: { ok: boolean; note: string }; damage: string[]; sideEdits: string[] };
export type Doc = Record<string, any>;
export type Ev = { id: string; x: number; y: number; name?: string; pages?: any[]; [key: string]: any };
export type Result = { ok: boolean; note: string };
export const ok = (note: string): Result => ({ ok: true, note });
export const no = (note: string): Result => ({ ok: false, note });

// ── 문서 읽기 ───────────────────────────────────────────────────────────────
export const eventsOf = (doc: Doc, mapId: string): Ev[] => doc.maps?.[mapId]?.events ?? [];
export const eventOf = (doc: Doc, mapId: string, eventId: string): Ev | undefined => eventsOf(doc, mapId).find(event => event.id === eventId);
export const mapName = (doc: Doc, mapId: string): string => doc.maps?.[mapId]?.name ?? mapId;
/** 이벤트의 모든 명령(모든 페이지, 선택지·분기·반복 안까지). */
export function commandsDeep(commands: any[] | undefined, out: any[] = []): any[] {
  for (const command of commands ?? []) {
    if (!command || typeof command !== 'object') continue;
    out.push(command);
    for (const key of ['then', 'else', 'body', 'branch', 'transactionBranch', 'failedTransactionBranch', 'cancelBranch', 'victoryBranch', 'escapeBranch', 'defeatBranch', 'commands']) if (Array.isArray(command[key])) commandsDeep(command[key], out);
    for (const option of command.options ?? []) if (Array.isArray(option?.branch)) commandsDeep(option.branch, out);
  }
  return out;
}
export const pagesOf = (event: Ev): any[] => event.pages?.length ? event.pages : [{ commands: event.commands ?? [], trigger: event.trigger, conditions: [] }];
export const allCommands = (event: Ev): any[] => pagesOf(event).flatMap(page => commandsDeep(page.commands));
/** 띄어쓰기·문장부호·따옴표를 무시한 포함 비교 — 「"어서 와!"」와 「어서 와」를 같은 말로 본다. */
export const squash = (text: unknown): string => String(text ?? '').normalize('NFC').replace(/[\s"'“”‘’「」『』.,!?~…·\-]/gu, '');
export const includesPhrase = (body: unknown, phrase: string): boolean => squash(body).includes(squash(phrase));
export const hasSprite = (event: Ev): boolean => pagesOf(event).some(page => page.graphic && !page.graphic.transparent && (page.graphic.sprite || typeof page.graphic.tile === 'number' || page.graphic.tileId !== undefined));
export const triggerKinds = (event: Ev): string[] => pagesOf(event).map(page => page.trigger?.kind ?? event.trigger?.kind ?? 'action');
export function upperTileAt(doc: Doc, mapId: string, x: number, y: number): boolean {
  const map = doc.maps?.[mapId];
  if (!map) return false;
  const i = y * map.width + x;
  return ['upperTiles', 'upperOverlayTiles', 'lowerOverlayTiles'].some(key => Array.isArray(map[key]) && (map[key][i] ?? -1) >= 0);
}
/** 눈에 보이는 것이 그 칸에 있나: 이벤트 그림이 있거나 그 칸에 윗층 타일이 깔려 있다. */
/** 처음 말을 걸었을 때 그 글이 나오는가. */
export const saysFirst = (doc: Doc, event: Ev, phrase: string): boolean => interact(event, freshSession(), doc).texts.some(body => includesPhrase(body, phrase));
export const visibleAt = (doc: Doc, mapId: string, event: Ev): boolean => hasSprite(event) || upperTileAt(doc, mapId, event.x, event.y);
export const inBounds = (doc: Doc, mapId: string, x: number, y: number): boolean => { const map = doc.maps?.[mapId]; return !!map && x >= 0 && y >= 0 && x < map.width && y < map.height; };
export const cheb = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const inRect = (rect: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }): boolean => p.x >= rect.x && p.y >= rect.y && p.x < rect.x + rect.w && p.y < rect.y + rect.h;
/**
 * 문서 사본 — 타일셋 본문은 복제하지 않고 같은 객체를 가리킨다. 타일셋이 문서의 거의 전부(복제 1.4초 중 1.3초)이고,
 * 도구 실행기는 원본 타일셋을 제자리에서 고치지 않는다(읽은 것만 복제하는 createDraft 의 계약) — 그래서 나눠 써도 안전하다.
 */
export function cloneDoc<T>(project: T): T {
  const { tilesets, ...rest } = project as Record<string, any>;
  return { ...structuredClone(rest), tilesets: { ...tilesets } } as T;
}
export const blockedCache = new WeakMap<object, Map<string, Set<string>>>();
export function blocked(doc: Doc, mapId: string): Set<string> {
  let perDoc = blockedCache.get(doc);
  if (!perDoc) blockedCache.set(doc, perDoc = new Map());
  let cells = perDoc.get(mapId);
  if (!cells) perDoc.set(mapId, cells = blockedOn(cloneDoc(doc) as unknown as Project, mapId));
  return cells;
}
export const passable = (doc: Doc, mapId: string, x: number, y: number): boolean => inBounds(doc, mapId, x, y) && !blocked(doc, mapId).has(`${x},${y}`);
/** 그 칸에 다른 이벤트(같은 높이로 서 있는 것)가 겹치지 않는다. */
export const cellFree = (doc: Doc, mapId: string, self: Ev): boolean => !eventsOf(doc, mapId).some(other => other.id !== self.id && other.x === self.x && other.y === self.y && pagesOf(other).some(page => (page.priority ?? 'same') === 'same'));
/** 새로 생긴 이벤트(전에 없던 id). mapId 를 주면 그 맵만. */
export function newEvents(before: Doc, after: Doc, mapId?: string): Array<{ mapId: string; event: Ev }> {
  const out: Array<{ mapId: string; event: Ev }> = [];
  for (const id of mapId ? [mapId] : Object.keys(after.maps ?? {})) {
    const had = new Set(eventsOf(before, id).map(event => event.id));
    for (const event of eventsOf(after, id)) if (!had.has(event.id)) out.push({ mapId: id, event });
  }
  return out;
}
/** 같은 이름의 아이템이 여럿일 수 있다 — 그중 어느 것이든 그 이름으로 친다. */
export const itemIdsByName = (doc: Doc, name: string): string[] => (doc.database?.items ?? []).filter((item: any) => item.name === name).map((item: any) => item.id);

// ── 말 걸기 한 번을 따라가 본다 ─────────────────────────────────────────────
// 엔진의 페이지 고르기(resolveEventPage)와 조건 평가(evalCondition)를 그대로 쓰고, 상태를 바꾸는 명령만 흉내 낸다.
// 「한 번만 준다」「열쇠가 있을 때만 다른 글」은 명령이 있다는 것만으로는 알 수 없어서, 두 번 말을 걸어 본다.
export type Play = {
  session: any; texts: string[]; items: Record<string, number>; gold: number; shops: any[]; battles: any[];
  /** 실행된 명령(순서대로, 분기 안까지). */
  ran: any[];
  /** 선택지 질문 글. */
  prompts: string[];
  /** 고른 선택지 글(순서대로). picks 를 준 실행에서만 뜻이 있다. */
  picked: string[];
  /** 만난 갈림(선택지·여관)마다 갈래 수 — 모든 길을 세는 데 쓴다. */
  arity: number[];
  /** 실제로 고른 번호(준 picks + 모자란 자리는 0). */
  picks: number[];
  /** 파티 전원 회복(recoverAll · 여관 숙박)이 있었다. */
  recovered: boolean;
  /** 내민 아이템 id(presentItem — picks 를 준 실행에서만). */
  presented: string[];
  /** 받은 몬스터 종 id(giveMonster). */
  monsters: string[];
  /** 게임을 끝낸 명령(엔딩·게임 오버·즉사) — 처음 것. halt 를 주면 여기서 멈춘다. */
  ended?: { kind: 'ending' | 'gameOver'; endingId?: string };
};
export type PlayOptions = {
  /** 갈림마다 고를 번호. 생략하면 선택지의 모든 갈래를 차례로 합친다(첫 묶음의 판정이 쓰는 방식). 여관은 0=묵는다 1=거절. */
  picks?: number[];
  /** 'victory' 면 전투를 이긴 것으로 치고 victoryBranch 를 잇는다. 생략하면 전투 뒤 분기를 따라가지 않는다. */
  battle?: 'victory';
  /** 엔딩·게임 오버·즉사 명령에서 멈춘다(엔진과 같다). 생략하면 끝까지 돈다(앞 묶음의 판정이 쓰는 방식). */
  halt?: boolean;
  /** 선택지를 글로 고른다(암호 숫자 누르기) — 번호를 돌려주면 picks 보다 먼저 쓴다. */
  choose?: (texts: string[], prompt: string) => number | undefined;
  /** 숫자 입력(inputNumber)에 넣을 값. 생략하면 0. */
  enter?: (command: any) => number;
};
export const freshSession = (inventory: Record<string, number> = {}): any => ({ switches: {}, variables: {}, selfSwitches: {}, inventory: { ...inventory }, gold: 0, partyActorIds: [], timers: {}, flags: {}, friendship: {} });
class Jump extends Error { constructor(readonly label: string) { super(label); } }
export function interact(event: Ev, session: any, doc?: Doc, options: PlayOptions = {}): Play {
  const play: Play = { session, texts: [], items: {}, gold: 0, shops: [], battles: [], ran: [], prompts: [], picked: [], arity: [], picks: [], recovered: false, presented: [], monsters: [] };
  const page = event.pages?.length ? resolveEventPage(event as never, session) : { commands: event.commands ?? [] };
  const num = (value: unknown): number => (typeof value === 'number' ? value : NaN);
  /** 갈림 하나: 갈래 수를 적고 이번 실행이 고를 번호를 돌려준다. */
  const decide = (count: number): number => {
    const pick = Math.min(Math.max(0, count - 1), options.picks![play.arity.length] ?? 0);
    play.arity.push(count); play.picks.push(pick);
    return pick;
  };
  /** 아이템·돈 주고받기(명령과 같은 셈). */
  const giveItem = (itemId: string, delta: number): void => { session.inventory[itemId] = (session.inventory[itemId] ?? 0) + delta; play.items[itemId] = (play.items[itemId] ?? 0) + delta; };
  const end = (ended: NonNullable<Play['ended']>): void => { play.ended ??= ended; };
  const run = (commands: any[] | undefined, depth: number): void => {
    if (depth > 12) return;
    for (const command of commands ?? []) {
      if (options.halt && play.ended) return;
      if (!command || typeof command !== 'object') continue;
      play.ran.push(command);
      if (command.kind === 'text') play.texts.push(String(command.body ?? ''));
      else if (command.kind === 'shop') play.shops.push(command);
      else if (command.kind === 'battleProcessing') {
        play.battles.push(command);
        if (options.battle === 'victory') { session.battleResult = 'victory'; run(command.victoryBranch, depth + 1); }
      } else if (command.kind === 'changeItem' || command.kind === 'changeGold') {
        const held = command.kind === 'changeItem' ? session.inventory[command.itemId] ?? 0 : session.gold;
        const next = command.op === '=' ? num(command.amount) : command.op === '-=' ? held - num(command.amount) : held + num(command.amount);
        if (command.kind === 'changeItem') { session.inventory[command.itemId] = next; play.items[command.itemId] = (play.items[command.itemId] ?? 0) + (next - held); }
        else { session.gold = next; play.gold += next - held; }
      } else if (command.kind === 'setSelfSwitch') (session.selfSwitches[event.id] ??= {})[command.key] = command.value;
      else if (command.kind === 'setSwitch') session.switches[command.switchId] = command.value === 'toggle' ? !session.switches[command.switchId] : command.value === true;
      else if (command.kind === 'setVariable') {
        const held = session.variables[command.variableId] ?? 0, value = num(command.value);
        session.variables[command.variableId] = command.op === '+=' ? held + value : command.op === '-=' ? held - value : command.op === '*=' ? held * value : command.op === '/=' ? held / value : value;
      } else if (command.kind === 'fork') run(evalCondition(session, command.condition, event as never) ? command.then : command.else, depth + 1);
      // 공통 이벤트 호출은 그 명령들을 이어서 돈다(부르는 이벤트의 셀프 스위치를 쓴다).
      else if (command.kind === 'callCommonEvent') run((doc?.commonEvents ?? []).find((common: any) => common?.id === command.commonEventId)?.commands, depth + 1);
      else if (command.kind === 'choices') {
        if (command.prompt) play.prompts.push(String(command.prompt));
        const list: any[] = command.options ?? [];
        // 선택지는 사용자가 무엇을 고를지 모른다 — picks 가 없으면 모든 갈래를 차례로 따라가 합친다.
        if (!options.picks) for (const option of list) run(option?.branch, depth + 1);
        else if (list.length) {
          const chosen = options.choose?.(list.map(option => String(option?.text ?? option?.label ?? '')), String(command.prompt ?? ''));
          const option = list[chosen === undefined ? decide(list.length) : Math.min(list.length - 1, Math.max(0, chosen))];
          play.picked.push(String(option?.text ?? option?.label ?? '')); run(option?.branch, depth + 1);
        }
      } else if (command.kind === 'recoverAll') { if (!command.actorId) play.recovered = true; }
      else if (command.kind === 'changeParty') {
        const party: string[] = session.partyActorIds ??= [];
        if (command.action === 'add' && !party.includes(command.actorId)) party.push(command.actorId);
        if (command.action === 'remove') session.partyActorIds = party.filter(id => id !== command.actorId);
      } else if (command.kind === 'inn' && options.picks) {
        // 여관 명령은 스스로 묻고, 묵으면 요금을 받고 전원을 회복한다.
        if (decide(2) === 0) { const price = num(command.price); if (Number.isFinite(price)) { session.gold -= price; play.gold -= price; } play.recovered = true; play.picked.push('(여관) 묵는다'); }
        else play.picked.push('(여관) 거절');
      } else if (command.kind === 'changeFriendship') changeFriendship(session, command.npcKey, num(command.delta), event as never);
      else if (command.kind === 'giveMonster') play.monsters.push(String(command.speciesId));
      else if (command.kind === 'inputNumber') session.variables[command.variableId] = options.enter?.(command) ?? 0;
      else if (command.kind === 'timer') {
        const id = command.timerId ?? 'timer1';
        if (command.action === 'set') session.timers[id] = num(command.seconds);
        if (command.action === 'start') { if (Number.isFinite(num(command.seconds))) session.timers[id] = num(command.seconds); (session.timerRunning ??= {})[id] = true; }
        if (command.action === 'stop') (session.timerRunning ??= {})[id] = false;
      } else if (command.kind === 'triggerEnding') {
        // 조건이 있는 엔딩은 부르는 순간에도 조건을 본다(거짓이면 다음 명령으로 넘어간다).
        const ending = (doc?.endings ?? []).find((entry: any) => entry?.id === command.endingId);
        if (!ending || (ending.conditions ?? []).every((condition: any) => evalCondition(session, condition, event as never))) end({ kind: 'ending', endingId: command.endingId });
      } else if (command.kind === 'gameOver' || command.kind === 'killPlayer') end({ kind: 'gameOver' });
      else if (command.kind === 'presentItem' && options.picks) {
        // 가진 후보마다 한 갈래 + 닫기. 내밀 것이 없으면 묻지 않고 닫은 것으로 친다.
        const held: string[] = (command.itemIds ?? Object.keys(session.inventory)).filter((id: string) => (session.inventory[id] ?? 0) > 0);
        const pick = held.length ? decide(held.length + 1) : held.length;
        if (pick >= held.length) { play.picked.push('(내밀기) 닫는다'); run(command.cancelBranch, depth + 1); continue; }
        const itemId = held[pick]!, match = (command.options ?? []).find((option: any) => option?.itemId === itemId);
        play.presented.push(itemId); play.picked.push(`(내밀기) ${itemId}`);
        if (match && command.consume) giveItem(itemId, -1);
        run(match ? match.branch : command.otherwiseBranch, depth + 1);
      } else if (command.kind === 'gotoLabel' && options.picks) throw new Jump(String(command.name));
    }
  };
  // 라벨로 되돌아가기(「아니오」면 처음 목록으로)는 맨 위 명령 줄의 그 라벨부터 다시 돈다 — 갈림을 고르는 실행에서만, 두 번까지.
  let list: any[] = page?.commands ?? [], jumps = 0;
  for (;;) {
    try { run(list, 0); break; }
    catch (error) {
      if (!(error instanceof Jump)) throw error;
      const at = (page?.commands ?? []).findIndex((command: any) => command?.kind === 'label' && command.name === error.label);
      if (at < 0 || ++jumps > 2) break;
      list = (page?.commands ?? []).slice(at);
    }
  }
  return play;
}
/** 갈림(선택지·여관)의 모든 길을 한 번씩 따라간 결과. 길마다 makeSession 으로 새 상태에서 시작한다. */
export function playPaths(event: Ev, makeSession: () => any, doc: Doc, options: Omit<PlayOptions, 'picks'> = {}, limit = 48): Play[] {
  const out: Play[] = [], stack: number[][] = [[]];
  while (stack.length && out.length < limit) {
    const picks = stack.pop()!;
    const play = interact(event, makeSession(), doc, { ...options, picks });
    out.push(play);
    for (let at = picks.length; at < play.arity.length; at++) for (let pick = 1; pick < play.arity[at]!; pick++) stack.push([...play.picks.slice(0, at), pick]);
  }
  return out;
}
/** 그 상태에서 고른 페이지와 그 페이지의 발동 방식. 조건이 맞는 페이지가 없으면 null. */
export function activePage(event: Ev, session: any): { page: any; trigger: string } | null {
  const page = event.pages?.length ? resolveEventPage(event as never, session) : { commands: event.commands ?? [], trigger: event.trigger };
  return page ? { page, trigger: (page as any).trigger?.kind ?? event.trigger?.kind ?? 'action' } : null;
}
/** 점(.)으로 이은 경로의 값. */
export const valueAt = (root: any, path: string): unknown => path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), root);
export function placeNote(spec: CheckSpec, after: Doc, mapId: string, event: Ev): string | null {
  if (!inBounds(after, mapId, event.x, event.y)) return `맵 밖 (${event.x},${event.y})`;
  if (spec.nearEvent) {
    const anchor = eventOf(after, mapId, spec.nearEvent.eventId);
    if (!anchor) return `기준 이벤트 ${spec.nearEvent.eventId} 가 없다`;
    const d = cheb(anchor, event);
    if (d < 1 || d > (spec.nearEvent.max ?? 1)) return `${anchor.name ?? anchor.id}(${anchor.x},${anchor.y})에서 ${d}칸 — ${spec.nearEvent.max ?? 1}칸 안이어야 한다`;
  }
  if (spec.inRect && !inRect(spec.inRect, event)) return `(${event.x},${event.y})는 기대 자리 x${spec.inRect.x}~${spec.inRect.x + spec.inRect.w - 1}, y${spec.inRect.y}~${spec.inRect.y + spec.inRect.h - 1} 밖`;
  return null;
}
export const where = (after: Doc, mapId: string, event: Ev): string => `${mapName(after, mapId)} (${event.x},${event.y})`;
